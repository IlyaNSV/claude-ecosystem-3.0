#!/usr/bin/env node
/**
 * churn-survival.cjs — M2 (self-churn) и M8-подпорка, через ВЫЖИВАЕМОСТЬ СТРОК.
 *
 * Метод: `git blame` по всем текстовым файлам HEAD даёт, какой коммит породил каждую живую строку.
 * survival(commit) = живые строки этого коммита в HEAD / строки, добавленные этим коммитом.
 * self-churn(commit) = 1 − survival. Считается по эпохам (pre-conductor / RUN-A / RUN-B).
 *
 * Прямо отвечает на вопрос владельца «не переписывает ли экосистема одно и то же по 10 раз».
 * Оговорка честности: строка, законно удалённая при развитии фичи, тоже попадает в churn —
 * поэтому смотрим ОТНОСИТЕЛЬНУЮ динамику эпох и якорь GitClear (~7.9%), а не абсолют.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME = process.env.USERPROFILE || process.env.HOME;
const REPO = path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-CLONE');
const OUT = path.resolve(__dirname, '..', 'DATASET');

const git = (args, opts = {}) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], ...opts });
const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const writeCsv = (file, hdr, rows) => fs.writeFileSync(file, [hdr.join(','), ...rows.map((r) => hdr.map((h) => esc(r[h])).join(','))].join('\n') + '\n');

const CODE_RE = /\.(ts|tsx|js|jsx|cjs|mjs|css|scss|sql|prisma)$/i;
const DOC_RE = /\.(md|mdx|yaml|yml|json)$/i;
const classify = (p) => {
  const s = p.toLowerCase();
  if (s.startsWith('.claude/')) return 'ecosystem-install';
  if (/(^|\/)(tests?|__tests__|e2e|uja)\//.test(s) || /\.(test|spec)\.[jt]sx?$/.test(s) || /\.test\.cjs$/.test(s)) return 'test';
  if (s.startsWith('.product/')) return 'product-docs';
  if (s.startsWith('.kiro/')) return 'spec';
  if (s.startsWith('apps/') || s.startsWith('packages/') || s.startsWith('src/')) return 'runtime';
  return 'other';
};
const epochOf = (ts) => (ts < '2026-07-17' ? 'pre-conductor' : ts < '2026-07-21' ? 'RUN-A' : ts < '2026-07-24' ? 'RUN-B' : 'post-run');

// --- 1. живые строки HEAD по коммитам-авторам
const files = git(['ls-files']).split('\n').map((s) => s.trim()).filter(Boolean)
  .filter((f) => CODE_RE.test(f) || DOC_RE.test(f));
console.log(`файлов к blame: ${files.length}`);

const aliveByCommit = new Map();       // sha40 -> живых строк
const aliveByCommitClass = new Map();  // sha40|class -> живых строк
let done = 0, skipped = 0;
for (const f of files) {
  let out;
  try { out = git(['blame', '--line-porcelain', '-w', 'HEAD', '--', f]); } catch { skipped++; continue; }
  const cls = classify(f);
  for (const line of out.split('\n')) {
    const m = line.match(/^([0-9a-f]{40}) \d+ \d+/);
    if (!m) continue;
    aliveByCommit.set(m[1], (aliveByCommit.get(m[1]) || 0) + 1);
    const k = `${m[1]}|${cls}`;
    aliveByCommitClass.set(k, (aliveByCommitClass.get(k) || 0) + 1);
  }
  if (++done % 200 === 0) console.log(`  blame ${done}/${files.length}`);
}
console.log(`blame готов: ${aliveByCommit.size} коммитов имеют живые строки; пропущено файлов: ${skipped}`);

// --- 2. добавленные строки по коммитам (numstat), только не-merge
const log = git(['log', '--no-merges', '--date=iso-strict', '--format=C|%H|%ad|%s', '--numstat']);
const commits = [];
let cur = null;
for (const line of log.split('\n')) {
  if (line.startsWith('C|')) {
    const [, sha, ad, ...rest] = line.split('|');
    cur = { sha, ts: ad, subject: rest.join('|').slice(0, 200), added: 0, deleted: 0, byClass: {} };
    commits.push(cur);
    continue;
  }
  const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
  if (!m || !cur) continue;
  const ins = m[1] === '-' ? 0 : Number(m[1]);
  const del = m[2] === '-' ? 0 : Number(m[2]);
  let p = m[3];
  if (p.includes('=>')) p = p.replace(/\{[^}]*=>\s*([^}]*)\}/, '$1').replace(/^.*=>\s*/, '').trim();
  if (!(CODE_RE.test(p) || DOC_RE.test(p))) continue;
  const cls = classify(p);
  cur.added += ins; cur.deleted += del;
  cur.byClass[cls] = (cur.byClass[cls] || 0) + ins;
}

const rows = commits.filter((c) => c.added > 0).map((c) => {
  const alive = aliveByCommit.get(c.sha) || 0;
  return {
    sha: c.sha.slice(0, 7), ts: c.ts, epoch: epochOf(c.ts), subject: c.subject,
    added: c.added, deleted: c.deleted, alive_in_head: alive,
    survival: +(alive / c.added).toFixed(3),
    churn: +(1 - Math.min(1, alive / c.added)).toFixed(3),
    added_runtime: c.byClass.runtime || 0, added_test: c.byClass.test || 0,
    added_product: c.byClass['product-docs'] || 0, added_spec: c.byClass.spec || 0,
    added_install: c.byClass['ecosystem-install'] || 0,
    alive_runtime: aliveByCommitClass.get(`${c.sha}|runtime`) || 0,
    alive_test: aliveByCommitClass.get(`${c.sha}|test`) || 0,
    alive_product: aliveByCommitClass.get(`${c.sha}|product-docs`) || 0,
    alive_spec: aliveByCommitClass.get(`${c.sha}|spec`) || 0,
  };
});
writeCsv(path.join(OUT, 'commit_survival.csv'), Object.keys(rows[0]), rows);

// --- 3. сводка по эпохам (числа — в отчёт, интерпретация — отдельно)
const sum = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
console.log('\nЭПОХА | коммитов | добавлено строк | живо в HEAD | survival | self-churn');
for (const ep of ['pre-conductor', 'RUN-A', 'RUN-B', 'post-run']) {
  const g = rows.filter((r) => r.epoch === ep);
  if (!g.length) continue;
  const add = sum(g, 'added'), alive = sum(g, 'alive_in_head');
  console.log(`${ep} | ${g.length} | ${add} | ${alive} | ${(alive / add).toFixed(3)} | ${(1 - alive / add).toFixed(3)}`);
}
console.log('\nПо классам (RUN-A+RUN-B, добавлено → живо):');
for (const cls of ['runtime', 'test', 'product', 'spec']) {
  const g = rows.filter((r) => ['RUN-A', 'RUN-B'].includes(r.epoch));
  const add = sum(g, `added_${cls}`), alive = sum(g, `alive_${cls}`);
  if (add) console.log(`  ${cls}: ${add} → ${alive} (survival ${(alive / add).toFixed(3)})`);
}
