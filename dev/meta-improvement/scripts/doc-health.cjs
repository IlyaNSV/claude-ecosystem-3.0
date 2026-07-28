#!/usr/bin/env node
/**
 * doc-health — the measuring half of the repo-hygiene skill (DEC-DEV-0227).
 *
 * ── WHY THIS EXISTS, given 20 checks already run in `npm run verify` ──
 * The existing lattice (check-links, check-counts, check-infomap, check-inventory-sync,
 * context-health, five gen:*:check) covers CONNECTIVITY, COUNTS and CATALOG SYNC. The
 * 2026-07-28 hygiene sweep found the repo had drifted along three axes NONE of them watch:
 *
 *   [1] ROTATION THRESHOLDS — CONVENTIONS §5.1 states thresholds for DEV_JOURNAL / CHANGELOG /
 *       audit-index, and nothing measured them. DEV_JOURNAL sat at 3× its own threshold
 *       (738 KB vs ~250 KB) for weeks. A rule nobody measures is a wish.
 *   [2] STALE STATUS — a `dev/<track>/SEAM.md` carrying `status: ACTIVE` is INJECTED into every
 *       compacted session by seam-reinject-compact.js. When the track is long finished, the
 *       injection is an order to redo completed work. Danger here is not age, it is
 *       age × mechanized delivery.
 *   [3] ARCHIVE LINK ROT — check-links excludes dev/_archive/ on the premise that historical
 *       paths are "validly bit-rotted". Measured: 93% of broken archive targets pointed at files
 *       that still exist — mechanical damage from moving docs deeper, not history.
 *
 * ── POSTURE ──
 * WARN-ONLY by default: prints findings, exits 0. `--strict` makes findings exit 1 — do that
 * only after the numbers have been watched for a while (the repo's own lesson: a gate on a
 * shared resource without an off switch eventually jams someone else's cycle).
 * "Blind" is never "clean": if a needed input is missing, this says so loudly and still exits 0.
 * Absence of evidence is not evidence of absence.
 *
 * Usage: node doc-health.cjs [--strict] [--json] [--quiet]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const STRICT = process.argv.includes('--strict');
const JSON_MODE = process.argv.includes('--json');
const QUIET = process.argv.includes('--quiet');

function repoRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { return process.cwd(); }
}
const ROOT = repoRoot();

const findings = [];   // { axis, severity, subject, detail }
const blind = [];      // things this checker could not evaluate — reported, never gating

const add = (axis, severity, subject, detail) => findings.push({ axis, severity, subject, detail });
const kb = n => (n / 1024).toFixed(1) + ' KB';
const readIf = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };
const sizeIf = p => { try { return fs.statSync(path.join(ROOT, p)).size; } catch { return null; } };

// ─────────────────────────────────────────────────────────────────────────────
// [1] Rotation thresholds — mirrors CONVENTIONS §5.1. Numbers live here AND there;
//     §5.1 is the SSOT for the rule, this is its measurement. If they disagree, §5.1 wins
//     and this file is the bug.
// ─────────────────────────────────────────────────────────────────────────────
const ROTATION = [
  { file: 'DEV_JOURNAL.md', maxKB: 250, countRe: /^## DEC-DEV-\d+/gm, maxCount: 50, unit: 'записей' },
  { file: 'CHANGELOG.md', maxKB: 150, countRe: null, maxCount: null, unit: 'релизов' },
  { file: 'dev/meta-improvement/audit-index.md', maxKB: 120, countRe: null, maxCount: null, unit: 'строк' },
];

for (const r of ROTATION) {
  const size = sizeIf(r.file);
  if (size === null) { blind.push(`${r.file} — нет на диске, порог не проверен`); continue; }
  if (size / 1024 > r.maxKB) {
    add('rotation', 'warn', r.file,
      `${kb(size)} при пороге ~${r.maxKB} KB (×${(size / 1024 / r.maxKB).toFixed(1)}) — CONVENTIONS §5.1`);
  }
  if (r.countRe) {
    const text = readIf(r.file);
    if (text) {
      const n = (text.match(r.countRe) || []).length;
      if (r.maxCount && n > r.maxCount) {
        add('rotation', 'warn', r.file, `${n} ${r.unit} при пороге ~${r.maxCount} — CONVENTIONS §5.1`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [2] Stale status — ACTIVE seams whose track shows no recent commits.
//     Weighted by mechanized delivery: a seam read by a hook is worse than one nobody opens.
// ─────────────────────────────────────────────────────────────────────────────
const SEAM_STALE_DAYS = 14;

function gitLastCommitDays(relPath) {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'log', '-1', '--format=%ct', '--', relPath],
      { encoding: 'utf8' }).trim();
    if (!out) return null;
    return Math.floor((Date.now() / 1000 - Number(out)) / 86400);
  } catch { return null; }
}

let seamFiles = [];
try {
  seamFiles = execFileSync('git', ['-C', ROOT, 'ls-files', 'dev/*/SEAM.md', 'dev/**/SEAM.md'],
    { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch { blind.push('git ls-files недоступен — швы не проверены'); }

for (const f of seamFiles) {
  const text = readIf(f);
  if (!text) continue;
  const m = text.match(/^status:\s*([A-Za-z_-]+)/m);
  if (!m || m[1].toLowerCase() !== 'active') continue;
  const days = gitLastCommitDays(f);
  if (days === null) { blind.push(`${f} — история коммитов недоступна`); continue; }
  if (days > SEAM_STALE_DAYS) {
    add('stale-status', 'warn', f,
      `status: ACTIVE, но последний коммит ${days} дн. назад. ACTIVE-шов ИНЖЕКТИТСЯ ` +
      `в каждую компактованную сессию (seam-reinject-compact.js) — если трек закрыт, ` +
      `это приказ переделать сделанное. Закрой шов или подтверди, что работа идёт.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [3] Archive link rot — the zone check-links deliberately skips.
// ─────────────────────────────────────────────────────────────────────────────
const LINK_RE = /\[([^\]]*)\]\(([^)\s]+?)(?:\s+"[^"]*")?\)/g;
let tracked = [];
try {
  tracked = execFileSync('git', ['-C', ROOT, 'ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
} catch { blind.push('git ls-files недоступен — ссылки в архиве не проверены'); }

const trackedSet = new Set(tracked);
const dirSet = new Set();
for (const f of tracked) {
  let d = path.posix.dirname(f);
  while (d && d !== '.') { dirSet.add(d); d = path.posix.dirname(d); }
}

let archBroken = 0, archRepairable = 0;
const byBasename = new Map();
for (const f of tracked) {
  const b = path.posix.basename(f);
  if (!byBasename.has(b)) byBasename.set(b, []);
  byBasename.get(b).push(f);
}

for (const f of tracked.filter(x => x.startsWith('dev/_archive/') && x.endsWith('.md'))) {
  const text = readIf(f);
  if (!text) continue;
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      const target = m[2];
      if (/^(https?:|mailto:|tel:|ftp:)/i.test(target) || target.startsWith('#')) continue;
      const clean = target.split('#')[0];
      if (!clean) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(f), clean)).replace(/^\.\//, '');
      if (trackedSet.has(resolved) || dirSet.has(resolved)) continue;
      archBroken++;
      if ((byBasename.get(path.posix.basename(clean)) || []).length) archRepairable++;
    }
  }
}
if (archRepairable > 0) {
  add('archive-rot', 'warn', 'dev/_archive/',
    `${archBroken} битых ссылок, из них ${archRepairable} указывают на СУЩЕСТВУЮЩИЕ файлы — ` +
    `это механический ущерб от перемещения документа вглубь (не переписали «../»), а не гниль ` +
    `истории, и он чинится массово. check-links эту зону не смотрит.`);
} else if (archBroken > 0) {
  add('archive-rot', 'info', 'dev/_archive/',
    `${archBroken} битых ссылок — ни одна не резолвится в существующий файл. Это остаточный ` +
    `класс (цели, которых в репо никогда не было: UUID-транскрипты, regex-примеры, пути с ` +
    `номером строки). Чинить нечем и не нужно — история имеет право ссылаться в никуда.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// [4] Always-on budget — every session AND every subagent pays for these.
// ─────────────────────────────────────────────────────────────────────────────
const ALWAYS_ON = [{ file: 'CLAUDE.md', maxLines: 300 }];
for (const a of ALWAYS_ON) {
  const text = readIf(a.file);
  if (text === null) { blind.push(`${a.file} — нет на диске`); continue; }
  const n = text.split('\n').length;
  if (n > a.maxLines) {
    add('always-on', 'warn', a.file,
      `${n} строк при ориентире <${a.maxLines}. Этот файл оплачивается заново КАЖДЫМ субагентом. ` +
      `Тест на строку: «её удаление приведёт к ошибке?» Если нет — в указатель.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [5] Glued lines — a single line of many KB is unreadable for human and model alike
//     and hides its content from diffs. ROADMAP.md:5 once held 36 694 characters.
// ─────────────────────────────────────────────────────────────────────────────
const GLUE_LIMIT = 4000;
for (const f of tracked.filter(x => x.endsWith('.md') && !x.startsWith('dev/_archive/'))) {
  const text = readIf(f);
  if (!text) continue;
  let worst = 0, worstLine = 0;
  text.split('\n').forEach((l, i) => { if (l.length > worst) { worst = l.length; worstLine = i + 1; } });
  if (worst > GLUE_LIMIT) {
    add('glued-line', 'warn', `${f}:${worstLine}`,
      `строка длиной ${worst} символов (порог ${GLUE_LIMIT}) — слипшийся блок, не читается ни глазом, ни диффом`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({ strict: STRICT, findings, blind }, null, 2));
} else if (!QUIET || findings.length) {
  const byAxis = {};
  for (const f of findings) (byAxis[f.axis] ||= []).push(f);
  if (!findings.length) {
    console.log('doc-health: ✓ чисто — пороги ротации, статусы швов, ссылки архива, always-on объём, слипшиеся строки.');
  } else {
    console.log(`doc-health: ${findings.length} находок${STRICT ? ' [strict]' : ' (warn-only, exit 0)'}\n`);
    const TITLES = {
      rotation: '① ПОРОГИ РОТАЦИИ (CONVENTIONS §5.1) — правило записано, но никем не измерялось',
      'stale-status': '② ПРОТУХШИЙ СТАТУС — опасен не возрастом, а механизированной доставкой',
      'archive-rot': '③ ССЫЛКИ В АРХИВЕ — зона, которую check-links не смотрит',
      'always-on': '④ ALWAYS-ON БЮДЖЕТ — платится каждой сессией И каждым субагентом',
      'glued-line': '⑤ СЛИПШИЕСЯ СТРОКИ — содержимое спрятано от диффа и от чтения',
    };
    for (const axis of Object.keys(byAxis)) {
      console.log(TITLES[axis] || axis);
      for (const f of byAxis[axis]) console.log(`   · ${f.subject}\n     ${f.detail}`);
      console.log('');
    }
  }
  if (blind.length) {
    console.log('⚠ НЕ СМОГ ПРОВЕРИТЬ (это не «чисто» — это «слепо»):');
    for (const b of blind) console.log('   · ' + b);
    console.log('');
  }
  console.log('Процедура разбора находок — dev/meta-improvement/skills/repo-hygiene.md');
}

process.exit(STRICT && findings.length ? 1 : 0);
