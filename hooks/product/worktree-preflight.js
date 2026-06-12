#!/usr/bin/env node
/**
 * worktree-preflight.js — pre-flight check before entering a git worktree.
 *
 * Run from the MAIN checkout BEFORE `git worktree add` / EnterWorktree. Surfaces
 * hazards that the gitignored, per-checkout session-state cannot — because a new
 * worktree inherits only tracked files, and OQ-PM-02 (concurrent-session
 * detection) is not implemented in session-state.js.
 *
 * Checks:
 *   1. Git hygiene        — dirty tree / unpushed commits / stash (won't follow you)
 *   2. Pending queues     — non-empty .product/.pending/ work that stays in main
 *   3. Active session     — .sessions/current.yaml freshness + git_head_sha drift
 *   4. Beads in_progress  — the real cross-checkout coordination signal
 *   5. Shared resources   — gitignored single-copy state (.env, .design-sessions/)
 *
 * Usage:
 *   node .claude/hooks/product/worktree-preflight.js          # report, exit 0
 *   node .claude/hooks/product/worktree-preflight.js --strict # exit 1 if warnings
 *   node .claude/hooks/product/worktree-preflight.js --json   # machine-readable
 *
 * Informational by design — it advises, it does not block.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FRESH_MIN = 15; // session "active" threshold, minutes
const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const JSON_OUT = args.includes('--json');

const warnings = [];
const report = []; // { section, level: ok|warn|info, text }

// ---------- locate project root ----------

const root = findProjectRoot(process.cwd());
if (!root) {
  fail('Не найден корень проекта (нет .claude/ + .product/ вверх от cwd).');
}

// ---------- 1. Git hygiene ----------

const branch = sh('git rev-parse --abbrev-ref HEAD').out.trim() || '(detached)';
const headSha = sh('git rev-parse HEAD').out.trim().slice(0, 12);

const porcelain = sh('git status --porcelain').out.trim();
if (porcelain) {
  const n = porcelain.split(/\r?\n/).length;
  add('Git', 'warn', `Рабочее дерево НЕ чистое — ${n} изменён(ых) файл(ов). Незакоммиченные правки останутся в этом checkout (worktree их не получит).`);
} else {
  add('Git', 'ok', 'Рабочее дерево чистое.');
}

const upstream = sh('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
if (upstream.ok) {
  const ahead = sh('git rev-list --count @{u}..HEAD').out.trim();
  if (ahead && ahead !== '0') {
    add('Git', 'info', `${ahead} неотправленн(ый/ых) коммит(ов) (${upstream.out.trim()}). Они в общей истории ветки, но другой checkout их не увидит, пока не запушишь.`);
  } else {
    add('Git', 'ok', 'Нет неотправленных коммитов.');
  }
} else {
  add('Git', 'info', 'У ветки нет upstream — сверка ahead/behind пропущена.');
}

const stash = sh('git stash list').out.trim();
if (stash) {
  const n = stash.split(/\r?\n/).length;
  add('Git', 'info', `Stash непуст (${n} запис(ь/ей)). Stash общий для всех worktree (.git/refs/stash) — будет виден и там.`);
} else {
  add('Git', 'ok', 'Stash пуст.');
}

// ---------- 2. Pending queues ----------

const pendingDir = path.join(root, '.product', '.pending');
if (fs.existsSync(pendingDir)) {
  const files = fs.readdirSync(pendingDir).filter((f) => f.endsWith('.yaml'));
  let anyPending = false;
  for (const f of files.sort()) {
    const count = countYamlListItems(path.join(pendingDir, f));
    if (count > 0) {
      anyPending = true;
      add('Очереди (.product/.pending/)', 'warn', `${f} — ${count} запис(ь/ей). Эта незавершённая работа останется в main; worktree её не увидит.`);
    }
  }
  if (!anyPending) add('Очереди (.product/.pending/)', 'ok', 'Все очереди пусты.');
} else {
  add('Очереди (.product/.pending/)', 'info', 'Каталог .product/.pending/ отсутствует.');
}

// ---------- 3. Active session ----------

const curPath = path.join(root, '.product', '.sessions', 'current.yaml');
if (fs.existsSync(curPath)) {
  const cur = parseYamlFlat(fs.readFileSync(curPath, 'utf-8'));
  const cp = cur.last_checkpoint ? Date.parse(cur.last_checkpoint) : NaN;
  if (!Number.isNaN(cp)) {
    const ageMin = (Date.now() - cp) / 60000;
    const ctx = [cur.feature_id, cur.current_step, cur.status].filter(Boolean).join(' / ');
    if (ageMin >= 0 && ageMin < FRESH_MIN) {
      add('Активная сессия', 'warn', `Последний чекпоинт ${fmtAge(ageMin)} назад — возможно, прямо сейчас идёт сессия в этом checkout${ctx ? ` (${ctx})` : ''}.`);
    } else {
      add('Активная сессия', 'ok', `Последняя активность ${fmtAge(ageMin)} назад — свежей сессии нет${ctx ? ` (последнее: ${ctx})` : ''}.`);
    }
  }
  if (cur.git_head_sha && cur.git_head_sha !== headSha && cur.git_head_sha !== 'detached') {
    add('Активная сессия', 'info', `session-state записан на HEAD ${cur.git_head_sha}, а сейчас HEAD ${headSha} — снимок сессии отстал от коммитов.`);
  }
} else {
  add('Активная сессия', 'ok', 'Снимка current.yaml нет — активной сессии не зафиксировано.');
}

// ---------- 4. Beads in_progress ----------

const bd = sh('bd list --status=in_progress');
if (bd.ok) {
  // Real issue rows start with a status glyph; skip the legend / Total / rules.
  const issueLines = bd.out.split(/\r?\n/).map((s) => s.trim())
    .filter((l) => /^[○◐●✓❄]/.test(l));
  if (issueLines.length === 0) {
    add('Задачи в работе (beads)', 'ok', 'Нет задач со статусом in_progress.');
  } else {
    add('Задачи в работе (beads)', 'warn', `${issueLines.length} задач(а/и) in_progress — единственный cross-checkout сигнал координации:`);
    issueLines.slice(0, 10).forEach((l) => add('Задачи в работе (beads)', 'detail', `    ${l}`));
  }
} else {
  add('Задачи в работе (beads)', 'info', 'bd недоступен или дал ошибку — проверка пропущена.');
}

// ---------- 5. Shared gitignored resources ----------

const shared = [];
if (fs.existsSync(path.join(root, '.env'))) shared.push('.env (секреты/токены — один на машину)');
const dsDir = path.join(root, '.product', '.design-sessions');
if (fs.existsSync(dsDir)) {
  const n = countFiles(dsDir, 2000);
  shared.push(`.product/.design-sessions/ (${n}${n >= 2000 ? '+' : ''} файл(ов) — render-кеши и canonical-ассеты дизайн-сессий)`);
}
const secretsDir = path.join(root, '.claude', 'integrator', 'secrets');
if (fs.existsSync(secretsDir)) shared.push('.claude/integrator/secrets/');
if (shared.length) {
  add('Shared ресурсы (gitignored — НЕ переедут)', 'info', 'Физически один экземпляр в main checkout. Параллельный доступ из worktree не разводится ни git, ни этим pre-flight:');
  shared.forEach((s) => add('Shared ресурсы (gitignored — НЕ переедут)', 'detail', `    ${s}`));
} else {
  add('Shared ресурсы (gitignored — НЕ переедут)', 'ok', 'Заметных shared gitignored ресурсов не найдено.');
}

// ---------- output ----------

if (JSON_OUT) {
  console.log(JSON.stringify({
    root, branch, head: headSha,
    warnings: warnings.length,
    report,
  }, null, 2));
  process.exit(STRICT && warnings.length ? 1 : 0);
}

const ICON = { ok: '  ✓', warn: '  ⚠', info: '  ℹ', detail: '   ' };
console.log(`\n🔍 Worktree pre-flight — ${path.basename(root)}`);
console.log(`   checkout: ${root}  (ветка ${branch}, HEAD ${headSha})\n`);

let lastSection = null;
for (const r of report) {
  if (r.section !== lastSection) {
    console.log(`\n[${r.section}]`);
    lastSection = r.section;
  }
  console.log(`${ICON[r.level] || '  •'} ${r.text}`);
}

console.log('\n' + '─'.repeat(60));
if (warnings.length === 0) {
  console.log('Вердикт: 🟢 Чисто — можно входить в worktree.');
} else {
  console.log(`Вердикт: 🟡 ${warnings.length} предупрежден(ие/ий) — просмотри выше перед входом в worktree.`);
}
console.log('');

process.exit(STRICT && warnings.length ? 1 : 0);

// ---------- helpers ----------

function add(section, level, text) {
  if (level === 'warn') warnings.push(text);
  report.push({ section, level, text });
}

function fail(msg) {
  if (JSON_OUT) console.log(JSON.stringify({ error: msg }));
  else console.error(`worktree-preflight: ${msg}`);
  process.exit(2);
}

function sh(cmd) {
  try {
    const out = execSync(cmd, { cwd: root || process.cwd(), encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
    return { ok: true, out: out || '' };
  } catch (e) {
    return { ok: false, out: (e.stdout || '').toString(), err: (e.stderr || e.message || '').toString() };
  }
}

function findProjectRoot(start) {
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude')) && fs.existsSync(path.join(dir, '.product'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

// Count YAML list items (`- key:` / `- value`) — proxy for "non-empty queue".
// Ignores comments, blanks, mapping keys, and inline empty lists (`entries: []`).
function countYamlListItems(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf-8'); } catch (e) { return 0; }
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    if (/^\s*-\s+\S/.test(line)) count++;
  }
  return count;
}

function parseYamlFlat(text) {
  const obj = {};
  text.split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    let val = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    obj[kv[1]] = val;
  });
  return obj;
}

function fmtAge(min) {
  if (min < 1) return 'меньше минуты';
  if (min < 60) return `${Math.round(min)} мин`;
  if (min < 1440) return `${Math.round(min / 60)} ч`;
  return `${Math.round(min / 1440)} дн`;
}

function countFiles(dir, cap) {
  let n = 0;
  const stack = [dir];
  while (stack.length && n < cap) {
    const d = stack.pop();
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const ent of ents) {
      if (ent.isDirectory()) stack.push(path.join(d, ent.name));
      else { n++; if (n >= cap) break; }
    }
  }
  return n;
}
