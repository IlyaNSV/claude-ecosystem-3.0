#!/usr/bin/env node
/**
 * dup-complexity.cjs — M2 (дублирование) + M6 (тренд сложности) без внешних зависимостей.
 *
 * Дублирование: скользящее окно в 25 значащих строк, нормализация (отступы/строковые литералы/
 * числа), хеш окна; клон = окно, встретившееся ≥2 раз в РАЗНЫХ файлах или далеко в том же файле.
 * Метрика — доля строк, покрытых клонами (сопоставима по смыслу с jscpd %duplicated lines).
 *
 * Сложность: на 5 исторических точках — LOC runtime, число файлов, средний размер файла,
 * суммарный «ветвящийся» счёт (if/for/while/case/catch/&&/||/?:) как прокси цикломатики,
 * и отношение к числу поставленных FM.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const HOME = process.env.USERPROFILE || process.env.HOME;
const REPO = path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-CLONE');
const OUT = path.resolve(__dirname, '..', 'DATASET');
const git = (args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

const CODE_RE = /\.(ts|tsx|js|jsx|cjs|mjs)$/i;
const isRuntime = (p) => /^(apps|packages|src)\//.test(p) && !/(\.test\.|\.spec\.|\/tests?\/|__tests__|\/e2e\/)/.test(p);
const isTest = (p) => /(\.test\.|\.spec\.|\/tests?\/|__tests__|\/e2e\/)/.test(p);

const normalize = (l) => l.trim()
  .replace(/\/\/.*$/, '')
  .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, 'S')
  .replace(/\b\d+(\.\d+)?\b/g, 'N')
  .replace(/\s+/g, ' ');

function filesAt(ref) {
  return git(['ls-tree', '-r', '--name-only', ref]).split('\n').map((s) => s.trim()).filter(Boolean);
}
function readAt(ref, file) {
  try { return git(['show', `${ref}:${file}`]); } catch { return ''; }
}

// ─────────────────────────── M2: дублирование на HEAD
function duplicationAt(ref) {
  const files = filesAt(ref).filter((f) => CODE_RE.test(f) && (isRuntime(f) || isTest(f)) && !f.startsWith('.claude/'));
  const W = 25;
  const seen = new Map();          // hash -> [{file, start}]
  const lineCount = new Map();     // file -> значащих строк
  const covered = new Map();       // file -> Set(строк, покрытых клоном)
  for (const f of files) {
    const raw = readAt(ref, f).split('\n');
    const norm = [];
    raw.forEach((l, i) => { const nl = normalize(l); if (nl.length > 12) norm.push([nl, i]); });
    lineCount.set(f, norm.length);
    for (let i = 0; i + W <= norm.length; i++) {
      const chunk = norm.slice(i, i + W).map((x) => x[0]).join('\n');
      const h = crypto.createHash('sha1').update(chunk).digest('hex').slice(0, 16);
      const arr = seen.get(h) || [];
      arr.push({ file: f, start: i, lines: norm.slice(i, i + W).map((x) => x[1]) });
      seen.set(h, arr);
    }
  }
  let clonePairs = 0;
  for (const [, arr] of seen) {
    if (arr.length < 2) continue;
    const distinct = new Set(arr.map((a) => a.file));
    if (distinct.size === 1 && arr.length < 2) continue;
    clonePairs++;
    for (const a of arr) {
      const s = covered.get(a.file) || new Set();
      for (const ln of a.lines) s.add(ln);
      covered.set(a.file, s);
    }
  }
  const totalLines = [...lineCount.values()].reduce((a, b) => a + b, 0);
  const coveredLines = [...covered.values()].reduce((a, s) => a + s.size, 0);
  return { files: files.length, totalLines, coveredLines, ratio: totalLines ? coveredLines / totalLines : 0, clonePairs };
}

// ─────────────────────────── M6: сложность на исторических точках
function complexityAt(ref) {
  const files = filesAt(ref).filter((f) => CODE_RE.test(f) && !f.startsWith('.claude/'));
  const rt = files.filter(isRuntime), te = files.filter(isTest);
  let loc = 0, branches = 0, fns = 0, maxFile = 0;
  for (const f of rt) {
    const src = readAt(ref, f);
    const lines = src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
    loc += lines.length;
    if (lines.length > maxFile) maxFile = lines.length;
    branches += (src.match(/\b(if|for|while|case|catch)\b|&&|\|\||\?\s*[^:\s]/g) || []).length;
    fns += (src.match(/\b(function|=>|class)\b/g) || []).length;
  }
  let testLoc = 0;
  for (const f of te) testLoc += readAt(ref, f).split('\n').filter((l) => l.trim()).length;
  return { runtime_files: rt.length, test_files: te.length, runtime_loc: loc, test_loc: testLoc, branches, fns, max_file_loc: maxFile, branch_density: loc ? +(branches / loc).toFixed(3) : 0 };
}

// ─────────────────────────── прогон
const POINTS = [
  ['2026-07-08', 'старт эпохи пилота'],
  ['2026-07-14', 'первые релизы'],
  ['2026-07-17', 'начало RUN-A'],
  ['2026-07-20', 'конец RUN-A'],
  ['2026-07-22', 'начало RUN-B'],
  ['HEAD', 'HEAD (конец RUN-B)'],
];
const rows = [];
for (const [pt, label] of POINTS) {
  let ref = pt;
  if (pt !== 'HEAD') {
    ref = git(['rev-list', '-1', `--before=${pt}T23:59:59`, 'HEAD']).trim();
    if (!ref) { console.log(`точка ${pt}: коммитов нет — пропуск`); continue; }
  }
  const c = complexityAt(ref);
  rows.push({ point: pt, label, ref: ref.slice(0, 7), ...c });
  console.log(`${pt} (${ref.slice(0, 7)}): runtime ${c.runtime_files} файлов / ${c.runtime_loc} LOC | test ${c.test_files}/${c.test_loc} | ветвлений ${c.branches} (плотность ${c.branch_density}) | макс. файл ${c.max_file_loc}`);
}
const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
fs.writeFileSync(path.join(OUT, 'complexity_trend.csv'), [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.keys(rows[0]).map((h) => esc(r[h])).join(','))].join('\n') + '\n');

console.log('\n— дублирование —');
for (const [pt] of [['2026-07-17'], ['HEAD']]) {
  let ref = pt === 'HEAD' ? 'HEAD' : git(['rev-list', '-1', `--before=${pt}T23:59:59`, 'HEAD']).trim();
  const d = duplicationAt(ref);
  console.log(`${pt}: файлов ${d.files}, значащих строк ${d.totalLines}, покрыто клонами ${d.coveredLines} → ${(d.ratio * 100).toFixed(1)}% (окно 25 строк, ${d.clonePairs} клон-групп)`);
}
