#!/usr/bin/env node
'use strict';
/**
 * seam-reinject-compact.js — SessionStart hook (matcher: compact) — context-seam re-injection.
 *
 * ЗАЧЕМ. Компактация схлопывает контекст в пересказ — и, как показал контекст-аудит
 * (DEC-DEV-0197), сводка компактации систематически ТЕРЯЕТ или ИНВЕРТИРУЕТ несущую интенцию
 * ("резать контекст оснований нет" схлопывается в "нашли, что контекст раздут"). Канон аудита:
 * ненадёжный канал (агент сам вспомнит / перечитает) → надёжный (push-инъекция приходит сама).
 * Тот же приём, что у context-map-session-start.js, но для ШВОВ: контракт продолжения, который
 * автор шва пометил как «прочти ПЕРВЫМ», ре-инжектится обратно СРАЗУ после компактации.
 * Документированный паттерн Claude Code «Re-inject context after compaction».
 *
 * ЧТО ДЕЛАЕТ. Находит все АКТИВНЫЕ швы (файлы по глобу dev/<dir>/SEAM.md, у которых в первых
 * 30 строках есть строка `status: ACTIVE`, регистр не важен), вырезает из каждого СТОП-блок
 * (текст от начала файла до маркера `<!-- SEAM-REINJECT-END -->`; нет маркера → первые 40 строк)
 * и инжектит их в сессию через additionalContext, с указателем на полный файл. Швов нет —
 * НЕ выводит НИЧЕГО (пустой stdout).
 *
 * ДЕТЕРМИНИЗМ. Блоки читаются из живых файлов, ничего не хардкодится — протухший шов хуже
 * отсутствующего. Правишь SEAM.md → инъекция меняется сама.
 *
 * КАП. Суммарная инъекция ограничена ~6 КБ: лишние швы отрезаются ПО ГРАНИЦЕ БЛОКА со строкой
 * «…обрезано, читай <путь>». Единственное исключение — если ПЕРВЫЙ (самый приоритетный) блок
 * один превышает кап: он обрезается по границе СТРОКИ внутри блока, чтобы важнейший шов всё
 * равно попал в контекст хотя бы частично (полный текст — по указателю).
 *
 * Non-blocking, no-op-safe: ЛЮБАЯ ошибка (нет файла, битый шов, нет каталога) → тихий exit 0.
 * Хук старта сессии не имеет права ронять сессию. Zero-deps (только fs/path).
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  SEAM_REINJECT=0
 *   - Disable entirely: remove the SessionStart(matcher:compact) entry from
 *     .claude/settings.local.json (registration is local — that file is gitignored
 *     in the ecosystem repo; unshipped-hook delivery gap = DEF-CTX-4).
 *
 * Registration (ecosystem repo, .claude/settings.local.json):
 *   "SessionStart": [{ "matcher": "compact", "hooks": [{ "type": "command",
 *     "command": "node dev/meta-improvement/hooks/seam-reinject-compact.js" }] }]
 *
 * Manual inspection (human-readable digest + byte count, no JSON envelope):
 *   node dev/meta-improvement/hooks/seam-reinject-compact.js --print
 */

const fs = require('fs');
const path = require('path');

// Toggle OFF without touching settings.
if (process.env.SEAM_REINJECT === '0') process.exit(0);

const PRINT = process.argv.includes('--print');

const HEAD_LINES_FOR_STATUS = 30;      // status: ACTIVE must appear within the first N lines
const FALLBACK_BLOCK_LINES = 40;       // no marker → inject the first N lines
const REINJECT_MARKER = '<!-- SEAM-REINJECT-END -->';
const MAX_INJECT_BYTES = 6 * 1024;     // ~6 KB HARD ceiling on the whole injection (incl. notice)
const NOTICE_RESERVE = 200;            // bytes kept free so a truncation notice always fits under the cap

try {
  main();
} catch (_) {
  process.exit(0); // fail-safe: never break session start
}
process.exit(0);

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  // SessionStart sends JSON on stdin; we only need cwd (optional).
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch { /* fine */ }

  const repoRoot = findRepoRoot(payload.cwd || process.cwd());
  if (!repoRoot) return;

  // Pilot installs / non-dev checkouts carry no dev/ tree → nothing to re-inject.
  const devDir = path.join(repoRoot, 'dev');
  let devStat;
  try { devStat = fs.statSync(devDir); } catch { return; }
  if (!devStat.isDirectory()) return;

  const seams = collectActiveSeams(devDir);

  if (PRINT) {
    if (!seams.length) {
      process.stdout.write('(no active seams found under dev/*/SEAM.md)\n');
      return;
    }
    const digest = render(seams, repoRoot);
    process.stdout.write(digest + '\n');
    process.stdout.write(
      `\n--- [--print] bytes: ${Buffer.byteLength(digest, 'utf8')} · active seams: ${seams.length} ---\n`);
    return;
  }

  // No active seam → inject NOTHING (silent no-op). Empty stdout, exit 0.
  if (!seams.length) return;

  const digest = render(seams, repoRoot);

  // Per Claude Code SessionStart contract: hookSpecificOutput MUST carry
  // hookEventName: 'SessionStart' alongside additionalContext — without it the harness
  // rejects the whole payload (live-дефект Fabric фазы 3, DEC-DEV-0162; рецидив в D7-хуках
  // DEC-DEV-0191). Valid JSON on stdout; exit 0.
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: digest },
  }));
}

// ── seam discovery ─────────────────────────────────────────────────────────────
// Glob dev/<dir>/SEAM.md — exactly one directory level under dev/ (matches the contract).
function collectActiveSeams(devDir) {
  let entries;
  try { entries = fs.readdirSync(devDir, { withFileTypes: true }); } catch { return []; }
  const seams = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const seamPath = path.join(devDir, ent.name, 'SEAM.md');
    let text;
    try { text = fs.readFileSync(seamPath, 'utf-8'); } catch { continue; }
    if (!isActive(text)) continue;
    seams.push({ dir: ent.name, seamPath, block: extractBlock(text) });
  }
  // Deterministic order (alphabetical by dir) so the injection is stable across runs.
  seams.sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  return seams;
}

// Active = a `status: ACTIVE` line within the first 30 lines. Case-insensitive on key AND
// value; tolerates a trailing `# comment`. Works whether the line is bare or inside
// frontmatter fences (the contract does not require fences).
function isActive(text) {
  const head = text.split(/\r?\n/).slice(0, HEAD_LINES_FOR_STATUS);
  for (const line of head) {
    const m = /^\s*status\s*:\s*(.+?)\s*$/i.exec(line);
    if (!m) continue;
    const val = m[1].replace(/\s+#.*$/, '').trim().toLowerCase();
    if (val === 'active') return true;
  }
  return false;
}

// Inject-block = text from the start of the file up to (excluding) the marker line;
// no marker → the first 40 lines. Trailing blank lines trimmed.
function extractBlock(text) {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.includes(REINJECT_MARKER));
  const slice = idx >= 0 ? lines.slice(0, idx) : lines.slice(0, FALLBACK_BLOCK_LINES);
  return slice.join('\n').replace(/\s+$/, '');
}

// ── render ───────────────────────────────────────────────────────────────────
function render(seams, repoRoot) {
  const capKb = Math.round(MAX_INJECT_BYTES / 1024);
  const header =
    'Контекст-швы (SEAM) — РЕ-ИНЖЕКЦИЯ ПОСЛЕ КОМПАКТАЦИИ ' +
    '(dev/meta-improvement/hooks/seam-reinject-compact.js). Ниже — СТОП-блоки активных швов: ' +
    'контракт продолжения, который автор пометил «прочти ПЕРВЫМ». Сводка компактации могла ' +
    'потерять или инвертировать интенцию — доверяй этим блокам и полным файлам по указателям, ' +
    'а не пересказу. Тумблер: env SEAM_REINJECT=0.';

  const parts = [header];
  let used = Buffer.byteLength(header, 'utf8');
  let stopped = seams.length; // index of the first seam NOT emitted whole (== length ⇒ all fit)

  for (let i = 0; i < seams.length; i++) {
    const s = seams[i];
    const rel = relPath(repoRoot, s.seamPath);
    const piece = `\n---\n▼ ${rel} (полный файл — прочитай целиком):\n${s.block}`;
    const pieceBytes = Buffer.byteLength(piece, 'utf8');
    // Reserve room for a truncation notice while more seams remain, so the cap is a true ceiling.
    const reserve = i < seams.length - 1 ? NOTICE_RESERVE : 0;

    if (used + pieceBytes + reserve <= MAX_INJECT_BYTES) {
      parts.push(piece);
      used += pieceBytes;
      continue;
    }
    stopped = i;
    break;
  }

  if (stopped < seams.length) {
    if (parts.length === 1) {
      // Pathological: the FIRST (highest-priority) block alone busts the cap. Clip it at a
      // LINE boundary so the most important seam still lands partially, then point at the file.
      const s = seams[0];
      const rel = relPath(repoRoot, s.seamPath);
      const piece = `\n---\n▼ ${rel} (полный файл — прочитай целиком):\n${s.block}`;
      const notice = `\n… [обрезано по капу ${capKb} КБ — читай полностью: ${rel}]`;
      const budget = MAX_INJECT_BYTES - used - Buffer.byteLength(notice, 'utf8');
      parts.push(clipToBytesAtLine(piece, budget) + notice);
    } else {
      // Normal path: stop at the block boundary; name the NEXT dropped seam + how many remain.
      const nextRel = relPath(repoRoot, seams[stopped].seamPath);
      const more = seams.length - stopped;
      parts.push(
        `\n---\n… [обрезано по капу ${capKb} КБ — ещё ${more} шов(ов) не показаны; ` +
        `читай полностью: ${nextRel}${more > 1 ? ' (и остальные активные швы)' : ''}]`);
    }
  }

  return parts.join('');
}

// ── helpers ──────────────────────────────────────────────────────────────────
function relPath(root, p) {
  try { return path.relative(root, p).replace(/\\/g, '/'); } catch { return p; }
}

// Clip a string to at most maxBytes, cutting only at a newline boundary (never mid-line —
// a half-line reads like content but is a lie). If even the first line busts the budget,
// return it whole (correctness of the head outranks the byte cap).
function clipToBytesAtLine(str, maxBytes) {
  if (maxBytes <= 0) return '';
  if (Buffer.byteLength(str, 'utf8') <= maxBytes) return str;
  const lines = str.split('\n');
  const out = [];
  let used = 0;
  for (const line of lines) {
    const add = (out.length ? 1 : 0) + Buffer.byteLength(line, 'utf8'); // +1 for the \n
    if (used + add > maxBytes) break;
    out.push(line);
    used += add;
  }
  if (!out.length) return lines[0]; // keep at least the first line whole
  return out.join('\n');
}

function findRepoRoot(start) {
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'DEV_JOURNAL.md')) && fs.existsSync(path.join(dir, 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback: hook lives at dev/meta-improvement/hooks/ → repo root is 3 up.
  const fallback = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(fallback, 'DEV_JOURNAL.md'))) return fallback;
  return null;
}
