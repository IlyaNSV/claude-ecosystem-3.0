#!/usr/bin/env node
'use strict';
/**
 * context-map-session-start.js — SessionStart hook (context-map push-channel, DEC-DEV-0197 / D1).
 *
 * ЗАЧЕМ. CLAUDE.md §«Что делать в этой сессии» п.0 держал ALWAYS-ON правило «сориентируйся по
 * docs/MAP.md; когда нужно „где ПРАВДА про X“ — открой dev/INFORMATION-MAP.yaml». Телеметрия
 * 69 сессий (контекст-аудит, DEC-DEV-0197): агент почти никогда не открывал эти файлы по своей
 * воле. Правило не исполнялось — но ВХОДИЛО В КОНЪЮНКЦИЮ: ManyIFEval (Findings EMNLP 2025)
 * показывает, что соблюдение *всех* правил сразу падает 0,95 → 0,48 при n=1→10 (произведение
 * вероятностей), т.е. каждое неисполняемое always-on правило тянет вниз соблюдение ОСТАЛЬНЫХ.
 *
 * ⚠ ЭТО НЕ РЕЗ КОНТЕКСТА. Вывод аудита ОБРАТНЫЙ: «резать контекст оснований нет» (файл поднимает
 * комплаенс с 0% до 60-68%; длина файла не влияет — ICR 60,0/65,2/67,7/64,0% при 25/100/250/500
 * строк, p=0,625). Здесь меняется КАНАЛ ДОСТАВКИ, а не объём: ненадёжный канал (инструкция,
 * которую надо исполнить) → надёжный (push-инъекция, которая приходит сама). Информация не
 * удаляется: оба файла на месте, дайджест на них указывает. Правило уходит из конъюнкции.
 *
 * ЧТО ДЕЛАЕТ. Читает docs/MAP.md + dev/INFORMATION-MAP.yaml, собирает КОМПАКТНЫЙ дайджест
 * (класс информации → SSOT → кому верить при конфликте; тезис pipeline; указатели на полные
 * файлы) и инжектит его в сессию через additionalContext.
 *
 * ДЕТЕРМИНИЗМ. Дайджест ГЕНЕРИТСЯ ИЗ ФАЙЛОВ, ничего не хардкодится — иначе он протухнет, а
 * протухшая карта хуже отсутствующей (ровно тот дрейф, который аудит и ловит). Правишь
 * INFORMATION-MAP → дайджест меняется сам.
 *
 * ПАРСИНГ. YAML читается как СЫРОЙ ТЕКСТ, без зависимостей — тот же приём, что в соседнем
 * check-information-map.js (js-yaml в репо разрешается лишь транзитивно через eslint; вешать на
 * него хук старта сессии — заведомая хрупкость).
 *
 * Non-blocking, no-op-safe: ЛЮБАЯ ошибка (нет файла, битый YAML, пустой парс) → тихий exit 0.
 * Хук старта сессии не имеет права ронять сессию.
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  CONTEXT_MAP_DIGEST=0
 *   - Disable entirely: remove the SessionStart entry from .claude/settings.local.json
 *     (registration is local — that file is gitignored in the ecosystem repo).
 *
 * Registration (ecosystem repo, .claude/settings.local.json):
 *   "SessionStart": [{ "hooks": [{ "type": "command",
 *     "command": "node dev/meta-improvement/hooks/context-map-session-start.js" }] }]
 *
 * Manual inspection (human-readable digest + byte count, no JSON envelope):
 *   node dev/meta-improvement/hooks/context-map-session-start.js --print
 */

const fs = require('fs');
const path = require('path');

// Toggle OFF without touching settings.
if (process.env.CONTEXT_MAP_DIGEST === '0') process.exit(0);

const PRINT = process.argv.includes('--print');

// Budget: this is a push-channel, not a dump. Clips keep the digest ~3 KB / ≤50 lines.
// NB: clipping is WORD-BOUNDARY (clip()), never mid-token — a half-path
// («dev/meta-improvement/scripts/rails-build.j…») reads like a coordinate but does not resolve,
// т.е. ровно тот мёртвый указатель, который аудит и ловит. Лучше выкинуть хвост целиком.
const SSOT_CLIP = 72;
const AUTH_CLIP = 56;

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

  const infoMap = safeRead(path.join(repoRoot, 'dev', 'INFORMATION-MAP.yaml'));
  const mapMd = safeRead(path.join(repoRoot, 'docs', 'MAP.md'));

  const classes = infoMap ? parseClasses(infoMap) : [];
  const conflictRule = infoMap ? parseConflictDefault(infoMap) : '';
  const arch = mapMd ? parseMap(mapMd) : null;

  // Nothing parsed → nothing to inject. Silent no-op (не шумим пустотой).
  if (!classes.length && !arch) return;

  const digest = render({ classes, conflictRule, arch });

  if (PRINT) {
    process.stdout.write(digest + '\n');
    process.stdout.write(
      `\n--- [--print] bytes: ${Buffer.byteLength(digest, 'utf8')} · lines: ${digest.split('\n').length} ` +
      `· classes parsed: ${classes.length} ---\n`);
    return;
  }

  // Per Claude Code SessionStart contract: hookSpecificOutput MUST carry
  // hookEventName: 'SessionStart' alongside additionalContext — without it the
  // harness rejects the whole payload («missing required field "hookEventName"»,
  // live-дефект Fabric фазы 3, DEC-DEV-0162; рецидив в D7-хуках — DEC-DEV-0191).
  // (Valid JSON on stdout; exit 0; <10k chars.)
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: digest },
  }));
}

// ── render ───────────────────────────────────────────────────────────────────
function render({ classes, conflictRule, arch }) {
  const L = [];
  L.push('Context-map digest — сгенерирован на старте сессии из живых файлов ' +
    '(dev/meta-improvement/hooks/context-map-session-start.js). Карты читать отдельно НЕ нужно: ' +
    'ниже выжимка, полные файлы — по указателям в конце.');

  if (arch) {
    L.push('');
    L.push('── АРХИТЕКТУРА (docs/MAP.md) ──');
    if (arch.thesis) L.push(arch.thesis);
    if (arch.sections.length) L.push('Разделы: ' + arch.sections.join(' · '));
  }

  if (classes.length) {
    L.push('');
    L.push(`── ГДЕ ПРАВДА (dev/INFORMATION-MAP.yaml — ${classes.length} классов; ` +
      'класс → SSOT, ⚔ = кому верить при конфликте) ──');
    if (conflictRule) L.push('⚔ ДЕФОЛТ: ' + conflictRule);
    for (const c of classes) {
      let line = `  ${c.id} → ${clip(c.ssot, SSOT_CLIP)}`;
      if (c.authority) line += `  ⚔ ${clip(c.authority, AUTH_CLIP)}`;
      L.push(line);
    }
  }

  L.push('');
  L.push('Полные файлы (добор по требованию — там verify:/note:, диаграммы, детали): ' +
    'dev/INFORMATION-MAP.yaml · docs/MAP.md. Тумблер: env CONTEXT_MAP_DIGEST=0.');
  return L.join('\n');
}

// ── parsing: INFORMATION-MAP.yaml (raw text, zero deps) ──────────────────────
// Classes look like:
//   - id: project-status
//     ssot: "ROADMAP.md#где-мы-сейчас"
//     authority_on_conflict: "git log > DEV_JOURNAL.md (хвост) > ROADMAP > memory"
// Values may also be block scalars (>-, |, |-) spanning several deeper-indented lines.
function parseClasses(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line)) continue; // comment

    const idM = line.match(/^\s*-\s+id:\s*(.+?)\s*$/);
    if (idM) {
      cur = { id: unquote(idM[1]), ssot: '', authority: '' };
      out.push(cur);
      continue;
    }
    if (!cur) continue;

    const kvM = line.match(/^\s{2,}([a-z_]+):\s*(.*)$/);
    if (!kvM) continue;
    const key = kvM[1];
    if (key !== 'ssot' && key !== 'authority_on_conflict') continue;

    let value = kvM[2].trim();
    if (/^[>|][-+]?$/.test(value)) {
      // Block scalar: consume the following deeper-indented lines.
      const baseIndent = line.match(/^\s*/)[0].length;
      const parts = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nxt = lines[j];
        if (!nxt.trim()) { i = j; continue; }
        const indent = nxt.match(/^\s*/)[0].length;
        if (indent <= baseIndent) break;
        parts.push(nxt.trim());
        i = j;
      }
      value = parts.join(' ');
    }
    value = unquote(value);
    if (key === 'ssot') cur.ssot = value;
    else cur.authority = value;
  }
  // Keep only classes that actually declare an SSOT (defensive against a malformed edit).
  return out.filter((c) => c.id && c.ssot);
}

// The default conflict-resolution rule lives in the header comment as design principle P2.
// Extract it verbatim from the file (never hardcode — a hardcoded copy would drift).
function parseConflictDefault(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#\s+P2\b/.test(l));
  if (start < 0) return '';
  const parts = [lines[start].replace(/^#\s+P2\s*/, '').trim()];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!/^#/.test(l)) break;                 // left the comment block
    if (/^#\s+P\d\b/.test(l)) break;          // next principle
    const body = l.replace(/^#\s*/, '').trim();
    if (!body) break;
    parts.push(body);
  }
  // The P2 text opens with its own label («Дефолт разрешения конфликта: …») — drop it so the
  // rendered line does not say it twice. If the wording changes, the strip simply no-ops.
  const raw = parts.join(' ').replace(/\s+/g, ' ').replace(/^Дефолт разрешения конфликта:\s*/i, '');
  return clip(raw, 200);
}

// ── parsing: docs/MAP.md ─────────────────────────────────────────────────────
function parseMap(text) {
  const lines = text.split(/\r?\n/);
  const thesisRaw = lines.find((l) => /Главный тезис/.test(l)) || '';
  const thesis = firstSentence(stripMd(thesisRaw), 190);
  // Section titles are "N. <name> — <gloss>"; keep the name, drop the gloss (no mid-word cuts).
  const sections = lines
    .filter((l) => /^##\s+\d+\./.test(l))
    .map((l) => clip(stripMd(l.replace(/^##\s+/, '')).split(' — ')[0], 46));
  // Nothing extractable (file corrupt / reorganized) → report ABSENT, not empty. Otherwise the
  // digest prints a bare «── АРХИТЕКТУРА ──» header with nothing under it and still claims to
  // summarize — a hollow assertion is worse than a missing section.
  if (!thesis && !sections.length) return null;
  return { thesis, sections };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function stripMd(s) {
  return s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
}
function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}
// Word-boundary clip. NEVER cuts inside a token: a truncated path
// («…/scripts/rails-build.j…») looks like a coordinate but resolves to nothing — a dead pointer,
// the exact defect class this audit was built to kill. If a single token alone busts the budget,
// keep it WHOLE and eat the overrun; correctness of a coordinate outranks line length.
function clip(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n).lastIndexOf(' ');
  if (cut > 0) return t.slice(0, cut) + '…';
  const end = t.indexOf(' ');
  return end < 0 ? t : t.slice(0, end) + '…';
}
// Keep only the leading sentence (MAP.md's thesis line carries a second, explanatory one).
// Cutting on '. ' cannot split a filename ("handoff.md." is followed by a space, "handoff.md" is not).
function firstSentence(s, maxLen) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  const i = t.indexOf('. ');
  return clip(i > 0 ? t.slice(0, i + 1) : t, maxLen);
}
function safeRead(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
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
