#!/usr/bin/env node
/**
 * baseline-m5.cjs — M5: сравнение эпохи «до кондуктора» с эпохами прогонов.
 *
 * ЧЕСТНАЯ РАМКА: эпохи решали РАЗНЫЕ задачи (до 07-17 — стройка фич с нуля; RUN-A/B — доведение
 * релиза до DoD), модели тоже менялись. Поэтому вывод КОРРЕЛЯЦИОННЫЙ: «в эпоху X показатель был
 * таким», а не «кондуктор улучшил показатель». Каузальный замер (M16) не запускался.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const HOME = process.env.USERPROFILE || process.env.HOME;

function readCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
  const rows = []; let cur = [], field = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const hdr = rows.shift();
  return rows.map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
}
const num = (r, k) => Number(r[k]) || 0;
const sum = (a, k) => a.reduce((x, r) => x + num(r, k), 0);
const fmt = (x) => Number(x).toLocaleString('ru-RU');

const sessions = readCsv(path.join(OUT, 'sessions.csv'));
const commits = readCsv(path.join(OUT, 'commits.csv')).filter((c) => c.is_merge !== '1');
const surv = readCsv(path.join(OUT, 'commit_survival.csv'));
const runLedger = fs.readFileSync(path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-DOCS', 'run_ledger.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const releases = fs.readFileSync(path.join(OUT, 'vm_releases.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);

// календарные дни активности эпохи (по коммитам)
const daysOf = (rows) => new Set(rows.map((r) => r.ts.slice(0, 10))).size;
const epochOfTs = (ts) => (ts < '2026-07-17' ? 'pre-conductor' : ts < '2026-07-21' ? 'RUN-A' : ts < '2026-07-24' ? 'RUN-B' : 'post-run');

const L = [];
const say = (s = '') => { L.push(s); console.log(s); };

say('# M5 — сравнение эпох (baseline «до кондуктора» vs прогоны)');
say('');
say('> **Конфаунды объявлены заранее:** эпохи решали разные задачи (до 07-17 — стройка фич с нуля,');
say('> RUN-A/B — доведение релиза RL-001 до DoD), модели executor\'ов менялись (handoff Fable 5 → Opus 4.8');
say('> на s6). Поэтому все выводы **корреляционные**; каузальный замер (M16) не запускался.');
say('');
say('| показатель | pre-conductor (07-08…07-16) | RUN-A (07-17…07-20) | RUN-B (07-22…07-23) |');
say('|---|---|---|---|');

const rowFor = (fn) => ['pre-conductor', 'RUN-A', 'RUN-B'].map(fn);
const line = (name, vals) => say(`| ${name} | ${vals[0]} | ${vals[1]} | ${vals[2]} |`);

const cByE = (ep) => commits.filter((c) => c.epoch === ep);
line('календарных дней с коммитами', rowFor((ep) => daysOf(cByE(ep))));
line('коммитов', rowFor((ep) => fmt(cByE(ep).length)));
line('коммитов в день', rowFor((ep) => (cByE(ep).length / (daysOf(cByE(ep)) || 1)).toFixed(1)));
line('строк добавлено', rowFor((ep) => fmt(sum(cByE(ep), 'ins'))));
line('строк удалено', rowFor((ep) => fmt(sum(cByE(ep), 'del'))));
line('соотношение +/−', rowFor((ep) => (sum(cByE(ep), 'ins') / (sum(cByE(ep), 'del') || 1)).toFixed(1) + ':1'));
line('runtime-строк', rowFor((ep) => fmt(sum(cByE(ep), 'runtime_lines'))));
line('test-строк', rowFor((ep) => fmt(sum(cByE(ep), 'test_lines'))));
line('test:runtime', rowFor((ep) => (sum(cByE(ep), 'test_lines') / (sum(cByE(ep), 'runtime_lines') || 1)).toFixed(2) + ':1'));

const sByE = (ep) => surv.filter((r) => r.epoch === ep);
line('self-churn (строки, не дожившие до HEAD)', rowFor((ep) => {
  const g = sByE(ep); const add = sum(g, 'added'), al = sum(g, 'alive_in_head');
  return add ? ((1 - al / add) * 100).toFixed(1) + '%' : '—';
}));

const rByE = (ep) => runLedger.filter((r) => epochOfTs((r.started_at || '').slice(0, 10)) === ep);
line('процессных прогонов', rowFor((ep) => rByE(ep).length));
line('прогонов в день', rowFor((ep) => (rByE(ep).length / (daysOf(cByE(ep)) || 1)).toFixed(1)));
line('часов процессного времени', rowFor((ep) => (rByE(ep).reduce((a, r) => a + (Number(r.duration_ms) || 0), 0) / 3600000).toFixed(1)));

const relByE = (ep) => releases.filter((r) => epochOfTs(`${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}`) === ep);
line('релизов на staging', rowFor((ep) => relByE(ep).length));

const sesByE = (ep, layer) => sessions.filter((s) => s.run_epoch === ep && s.layer === layer);
line('executor-сессий', rowFor((ep) => sesByE(ep, 'executor').length));
line('tok_out executor (с субагентами)', rowFor((ep) => fmt(sum(sesByE(ep, 'executor'), 'tok_out') + sum(sesByE(ep, 'executor'), 'subagent_tok_out'))));
line('активных часов executor', rowFor((ep) => (sum(sesByE(ep, 'executor'), 'wall_active_min') / 60).toFixed(1)));

// удельные показатели
line('**токенов на 1 runtime-строку**', rowFor((ep) => {
  const tok = sum(sesByE(ep, 'executor'), 'tok_out') + sum(sesByE(ep, 'executor'), 'subagent_tok_out');
  const rt = sum(cByE(ep), 'runtime_lines');
  return rt ? Math.round(tok / rt).toLocaleString('ru-RU') : '—';
}));
line('**токенов на 1 коммит**', rowFor((ep) => {
  const tok = sum(sesByE(ep, 'executor'), 'tok_out') + sum(sesByE(ep, 'executor'), 'subagent_tok_out');
  return cByE(ep).length ? Math.round(tok / cByE(ep).length).toLocaleString('ru-RU') : '—';
}));
line('**доля коммитов с процессным сигналом в 24 ч**', rowFor((ep) => {
  const g = cByE(ep);
  const sig = runLedger.map((r) => Date.parse(r.started_at)).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  let withSig = 0;
  for (const c of g) { const t = Date.parse(c.ts); if (sig.some((s) => s >= t && s - t < 24 * 3600 * 1000)) withSig++; }
  return g.length ? (withSig / g.length * 100).toFixed(0) + '%' : '—';
}));

say('');
say('_Токен-показатели по executor-слою включают субагентов (см. санитарную находку S-1: в harvest-копиях их нет)._');
say('');
fs.writeFileSync(path.join(OUT, 'M5_BASELINE.md'), L.join('\n') + '\n');
console.log('\n→ DATASET/M5_BASELINE.md');
