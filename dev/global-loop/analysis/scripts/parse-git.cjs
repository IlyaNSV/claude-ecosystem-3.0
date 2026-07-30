#!/usr/bin/env node
/**
 * parse-git.cjs — разбор git-дампа пилота (снят с VM read-only) в таблицы Фазы I/I-b.
 *
 * Выход:
 *   DATASET/commits.csv  — коммит-уровень: даты, автор, cond-метка, строки по классам путей
 *   DATASET/files.csv    — файл-уровень: сколько раз правился, суммарные +/−, первое/последнее касание
 *
 * Классы путей (PREREG §4): runtime | test | product-docs | spec | infra | other
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const DUMP = path.join(OUT, 'pilot_git_dump.txt');

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const writeCsv = (file, hdr, rows) => fs.writeFileSync(file, [hdr.join(','), ...rows.map((r) => hdr.map((h) => esc(r[h])).join(','))].join('\n') + '\n');

function classifyPath(p) {
  const s = p.toLowerCase();
  if (/(^|\/)(tests?|__tests__|e2e|uja)\//.test(s) || /\.(test|spec)\.[jt]sx?$/.test(s) || /\.test\.cjs$/.test(s)) return 'test';
  if (s.startsWith('.product/')) return 'product-docs';
  if (s.startsWith('.kiro/')) return 'spec';
  if (s.startsWith('apps/') || s.startsWith('packages/') || s.startsWith('src/')) return 'runtime';
  if (s.startsWith('.claude/') || s.startsWith('.github/') || s.startsWith('scripts/') || s.startsWith('infra/') || s.startsWith('deploy/')) return 'infra';
  if (/^(readme|changelog|docs\/)/.test(s) || s.endsWith('.md')) return 'docs';
  return 'other';
}

const text = fs.readFileSync(DUMP, 'utf8').replace(/\r\n/g, '\n');
const metaBlock = text.split('###NUMSTAT')[0].split('###META')[1] || '';
const numstatBlock = (text.split('###NUMSTAT')[1] || '').split('###TAGS')[0];

// --- мета
const commits = new Map();
for (const line of metaBlock.split('\n')) {
  const m = line.match(/^([0-9a-f]{40})\|([^|]+)\|([^|]*)\|([^|]*)\|(.*)$/);
  if (!m) continue;
  const [, sha, ad, an, parents, subject] = m;
  commits.set(sha, {
    sha, sha7: sha.slice(0, 7), ts: ad, author: an,
    parents: parents.trim().split(/\s+/).filter(Boolean).length,
    subject: subject.slice(0, 300),
    cond_marker: (subject.match(/COND-S(\d+)/i) || [])[0] || '',
    fm_ref: [...new Set((subject.match(/FM-\d+/g) || []))].join(' '),
    type: (subject.match(/^(\w+)(\([^)]*\))?:/) || [])[1] || '',
    files: 0, ins: 0, del: 0,
    by_class: { runtime: 0, test: 0, 'product-docs': 0, spec: 0, infra: 0, docs: 0, other: 0 },
    paths: [],
  });
}

// --- numstat
const fileStats = new Map();
let cur = null;
for (const line of numstatBlock.split('\n')) {
  if (line.startsWith('C|')) {
    const [, sha] = line.split('|');
    cur = commits.get(sha) || null;
    continue;
  }
  const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
  if (!m || !cur) continue;
  const ins = m[1] === '-' ? 0 : Number(m[1]);
  const del = m[2] === '-' ? 0 : Number(m[2]);
  let p = m[3];
  if (p.includes('=>')) p = p.replace(/\{[^}]*=>\s*([^}]*)\}/, '$1').replace(/^.*=>\s*/, '').trim();
  const cls = classifyPath(p);
  cur.files++; cur.ins += ins; cur.del += del; cur.by_class[cls] += ins + del;
  cur.paths.push(p);
  const fs_ = fileStats.get(p) || { path: p, cls, touches: 0, ins: 0, del: 0, first_ts: cur.ts, last_ts: cur.ts, commits: [] };
  fs_.touches++; fs_.ins += ins; fs_.del += del;
  if (cur.ts < fs_.first_ts) fs_.first_ts = cur.ts;
  if (cur.ts > fs_.last_ts) fs_.last_ts = cur.ts;
  fs_.commits.push(cur.sha7);
  fileStats.set(p, fs_);
}

const epochOf = (ts) => (ts < '2026-07-17' ? 'pre-conductor' : ts < '2026-07-21' ? 'RUN-A' : ts < '2026-07-24' ? 'RUN-B' : 'post-run');
const rows = [...commits.values()].sort((a, b) => (a.ts < b.ts ? -1 : 1)).map((c) => ({
  sha: c.sha7, ts: c.ts, epoch: epochOf(c.ts), author: c.author, is_merge: c.parents > 1 ? 1 : 0,
  type: c.type, cond_marker: c.cond_marker, fm_ref: c.fm_ref, subject: c.subject,
  files: c.files, ins: c.ins, del: c.del,
  runtime_lines: c.by_class.runtime, test_lines: c.by_class.test,
  product_docs_lines: c.by_class['product-docs'], spec_lines: c.by_class.spec,
  infra_lines: c.by_class.infra, docs_lines: c.by_class.docs, other_lines: c.by_class.other,
  paths_sample: c.paths.slice(0, 6).join(' '),
}));
writeCsv(path.join(OUT, 'commits.csv'), Object.keys(rows[0]), rows);

const frows = [...fileStats.values()].sort((a, b) => b.touches - a.touches).map((f) => ({
  path: f.path, path_class: f.cls, touches: f.touches, ins: f.ins, del: f.del,
  first_ts: f.first_ts, last_ts: f.last_ts, commits: f.commits.slice(0, 12).join(' '),
}));
writeCsv(path.join(OUT, 'files.csv'), ['path', 'path_class', 'touches', 'ins', 'del', 'first_ts', 'last_ts', 'commits'], frows);

// --- сводка (не отчёт, а проверка вменяемости данных)
const sum = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
console.log(`коммитов: ${rows.length} | файлов затронуто: ${frows.length}`);
for (const ep of ['pre-conductor', 'RUN-A', 'RUN-B', 'post-run']) {
  const g = rows.filter((r) => r.epoch === ep && !r.is_merge);
  if (!g.length) continue;
  console.log(`${ep}: коммитов=${g.length} +${sum(g, 'ins')}/-${sum(g, 'del')} | runtime=${sum(g, 'runtime_lines')} test=${sum(g, 'test_lines')} product=${sum(g, 'product_docs_lines')} spec=${sum(g, 'spec_lines')} docs=${sum(g, 'docs_lines')}`);
}
console.log(`с COND-меткой: ${rows.filter((r) => r.cond_marker).length}`);
console.log('\nтоп-10 файлов по числу правок:');
for (const f of frows.slice(0, 10)) console.log(`  ${f.touches}× ${f.path_class.padEnd(13)} ${f.path.slice(0, 80)}`);
