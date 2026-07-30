#!/usr/bin/env node
/**
 * metrics-core.cjs — счёт метрик Фазы I и части I-b/II из уже собранного датасета.
 * Формулы — по PREREG §5. Скрипт НИЧЕГО не интерпретирует, только считает и печатает.
 *
 * Считает: токен-томографию (M3) · loop-ratio (M12) · throughput процессов и релизов ·
 * раунды P6 · M14 time-to-feedback · overhead-разрез строк · внимание владельца.
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
const n = (r, k) => Number(r[k]) || 0;
const sum = (arr, k) => arr.reduce((a, r) => a + n(r, k), 0);
const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (x, y) => (y ? (x / y * 100).toFixed(1) + '%' : '—');
const fmt = (x) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('ru-RU'));

const sessions = readCsv(path.join(OUT, 'sessions.csv'));
const toolcalls = readCsv(path.join(OUT, 'toolcalls.csv'));
const commits = readCsv(path.join(OUT, 'commits.csv'));
const entries = readCsv(path.join(OUT, 'ledger_entries.csv'));
const utter = readCsv(path.join(OUT, 'owner_utterances.csv'));
const releases = fs.readFileSync(path.join(OUT, 'vm_releases.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const runLedger = fs.readFileSync(path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-DOCS', 'run_ledger.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const EPOCHS = ['pre-conductor', 'RUN-A', 'RUN-B'];
const L = [];
const say = (s = '') => { L.push(s); console.log(s); };

// ─────────────────────────────────────────────── M3: токен-томография
say('## M3 — токен-томография (кто жжёт токены)');
say('');
say('| эпоха | слой | сессий | tok_out основной | tok_out субагентов | tok_out ВСЕГО | ctx_processed | tool-calls |');
say('|---|---|---|---|---|---|---|---|');
const tokBy = {};
for (const ep of EPOCHS) {
  for (const ly of ['host', 'executor']) {
    const g = sessions.filter((s) => s.run_epoch === ep && s.layer === ly);
    if (!g.length) continue;
    const main = sum(g, 'tok_out'), sub = sum(g, 'subagent_tok_out');
    tokBy[`${ep}|${ly}`] = { main, sub, total: main + sub, ctx: sum(g, 'ctx_processed'), tools: sum(g, 'tool_calls_total') + sum(g, 'subagent_tool_calls'), nS: g.length, active: sum(g, 'wall_active_min') };
    say(`| ${ep} | ${ly} | ${g.length} | ${fmt(main)} | ${fmt(sub)} | ${fmt(main + sub)} | ${fmt(sum(g, 'ctx_processed'))} | ${fmt(sum(g, 'tool_calls_total') + sum(g, 'subagent_tool_calls'))} |`);
  }
}
say('');
for (const ep of ['RUN-A', 'RUN-B']) {
  const h = tokBy[`${ep}|host`], e = tokBy[`${ep}|executor`];
  if (h && e) say(`**${ep}: оверхед пульта** = tok(host) / tok(executor) = ${fmt(h.total)} / ${fmt(e.total)} = **${(h.total / e.total).toFixed(2)}** (порог PREREG: ≤0.20 спокойно, >0.40 тревога)`);
}
say('');

// ─────────────────────────────────────────────── M12: loop-ratio
say('## M12 — loop-ratio и повторные действия');
say('');
say('| эпоха | слой | tool-calls | повторов | loop-ratio | медиана по сессиям |');
say('|---|---|---|---|---|---|');
for (const ep of EPOCHS) {
  for (const ly of ['host', 'executor']) {
    const g = sessions.filter((s) => s.run_epoch === ep && s.layer === ly && n(s, 'tool_calls_total') > 0);
    if (!g.length) continue;
    const tot = sum(g, 'tool_calls_total'), dup = sum(g, 'tool_calls_dup');
    say(`| ${ep} | ${ly} | ${fmt(tot)} | ${fmt(dup)} | **${(dup / tot).toFixed(3)}** | ${median(g.map((s) => n(s, 'loop_ratio'))).toFixed(3)} |`);
  }
}
say('');
// самые повторяемые действия
const dupTop = {};
for (const t of toolcalls) {
  if (!['RUN-A', 'RUN-B'].includes(t.run_epoch)) continue;
  if (Number(t.dup_index) === 0) continue;
  const k = `${t.tool_name}|${t.file_target || ''}`;
  dupTop[k] = (dupTop[k] || 0) + 1;
}
say('Топ-8 повторяемых действий в прогонах (инструмент | цель → сколько повторов):');
for (const [k, v] of Object.entries(dupTop).sort((a, b) => b[1] - a[1]).slice(0, 8)) say(`- ${k.replace('|', ' | ')} → ${v}`);
say('');

// ─────────────────────────────────────────────── Throughput процессов
say('## Throughput процессов экосистемы (машинный run-ledger, 91 запись)');
say('');
const epochOfTs = (ts) => (ts < '2026-07-17' ? 'pre-conductor' : ts < '2026-07-21' ? 'RUN-A' : ts < '2026-07-24' ? 'RUN-B' : 'post-run');
const procBy = {};
for (const r of runLedger) {
  const ep = epochOfTs((r.started_at || '').slice(0, 10));
  const k = `${ep}|${r.process}`;
  procBy[k] = procBy[k] || { count: 0, ms: 0, verdicts: {} };
  procBy[k].count++;
  procBy[k].ms += Number(r.duration_ms) || 0;
  const v = typeof r.verdict === 'object' && r.verdict ? (r.verdict.result || r.verdict.verdict || '(объект)') : (r.verdict || r.result || '—');
  procBy[k].verdicts[v] = (procBy[k].verdicts[v] || 0) + 1;
}
say('| эпоха | процесс | прогонов | суммарно, мин | медиана, мин | вердикты |');
say('|---|---|---|---|---|---|');
for (const ep of EPOCHS) {
  for (const [k, v] of Object.entries(procBy).filter(([kk]) => kk.startsWith(ep + '|')).sort((a, b) => b[1].count - a[1].count)) {
    const proc = k.split('|')[1];
    const durs = runLedger.filter((r) => r.process === proc && epochOfTs((r.started_at || '').slice(0, 10)) === ep).map((r) => (Number(r.duration_ms) || 0) / 60000);
    say(`| ${ep} | ${proc} | ${v.count} | ${(v.ms / 60000).toFixed(0)} | ${median(durs)?.toFixed(1) ?? '—'} | ${Object.entries(v.verdicts).map(([a, b]) => `${a}×${b}`).join(', ').slice(0, 60)} |`);
  }
}
say('');

// ─────────────────────────────────────────────── Релизы
const relDates = releases.map((r) => `${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}`);
const relBy = {};
for (const d of relDates) relBy[d] = (relBy[d] || 0) + 1;
say('## Релизы (24 всего)');
say('');
say(Object.entries(relBy).map(([d, c]) => `${d}: ${c}`).join(' · '));
say('');

// ─────────────────────────────────────────────── M14: time-to-feedback
say('## M14 — time-to-feedback (коммит → первый машинный сигнал)');
say('');
const signals = [
  ...runLedger.map((r) => ({ ts: Date.parse(r.started_at), what: `run:${r.process}` })),
  ...releases.map((r) => ({ ts: Date.parse(`${r.slice(0, 4)}-${r.slice(4, 6)}-${r.slice(6, 8)}T${r.slice(9, 11)}:${r.slice(11, 13)}:${r.slice(13, 15)}Z`), what: 'release' })),
].filter((s) => !Number.isNaN(s.ts)).sort((a, b) => a.ts - b.ts);
say('| эпоха | коммитов | медиана до сигнала, мин | p25 | p75 | без сигнала в 24 ч |');
say('|---|---|---|---|---|---|');
for (const ep of EPOCHS) {
  const g = commits.filter((c) => c.epoch === ep && c.is_merge !== '1');
  const lat = [];
  let none = 0;
  for (const c of g) {
    const t = Date.parse(c.ts);
    const s = signals.find((x) => x.ts >= t);
    if (!s || (s.ts - t) > 24 * 3600 * 1000) { none++; continue; }
    lat.push((s.ts - t) / 60000);
  }
  const srt = lat.sort((a, b) => a - b);
  say(`| ${ep} | ${g.length} | **${median(srt)?.toFixed(1) ?? '—'}** | ${srt.length ? srt[Math.floor(srt.length * 0.25)].toFixed(1) : '—'} | ${srt.length ? srt[Math.floor(srt.length * 0.75)].toFixed(1) : '—'} | ${none} |`);
}
say('');

// ─────────────────────────────────────────────── Overhead-разрез строк
say('## M3 — разрез строк по назначению (коммиты пилота, без merge)');
say('');
say('| эпоха | коммитов | runtime | test | .product | .kiro spec | .claude install | прочее | markdown:code |');
say('|---|---|---|---|---|---|---|---|---|');
for (const ep of EPOCHS) {
  const g = commits.filter((c) => c.epoch === ep && c.is_merge !== '1');
  if (!g.length) continue;
  const rt = sum(g, 'runtime_lines'), te = sum(g, 'test_lines'), pr = sum(g, 'product_docs_lines'), sp = sum(g, 'spec_lines'), inf = sum(g, 'infra_lines'), dc = sum(g, 'docs_lines'), ot = sum(g, 'other_lines');
  const md = pr + sp + dc;
  say(`| ${ep} | ${g.length} | ${fmt(rt)} | ${fmt(te)} | ${fmt(pr)} | ${fmt(sp)} | ${fmt(inf)} | ${fmt(ot)} | **${(md / (rt || 1)).toFixed(2)}:1** |`);
}
say('');
say('_«markdown:code» = (.product + .kiro + docs) / runtime. Порог PREREG: ≤1.5:1 спокойно, >3:1 тревога. Класс `.claude install` — вендорённая поставка экосистемы, в отношение НЕ входит._');
say('');

// ─────────────────────────────────────────────── Внимание владельца
say('## Внимание владельца');
say('');
const attClaimed = {};
for (const e of entries) {
  const ep = e.run === 'RUN-A' ? 'RUN-A' : e.run === 'RUN-B' ? 'RUN-B' : 'other';
  attClaimed[ep] = (attClaimed[ep] || 0) + n(e, 'attention_min');
}
say(`Заявлено в ledger (поле attention): RUN-A ${attClaimed['RUN-A'] || 0} мин · RUN-B ${attClaimed['RUN-B'] || 0} мин — \`[UNVERIFIED-CLAIM]\`, самооценка автора записей.`);
const uSignal = utter.filter((u) => u.in_run_session === '1' && u.is_noise === '0' && ['RUN-A', 'RUN-B'].includes(u.epoch));
const byEp = {};
for (const u of uSignal) (byEp[u.epoch] = byEp[u.epoch] || []).push(u);
for (const [ep, arr] of Object.entries(byEp)) {
  const types = {};
  for (const a of arr) types[a.type] = (types[a.type] || 0) + 1;
  say(`${ep}: **${arr.length}** содержательных сообщений владельца (${Object.entries(types).map(([k, v]) => `${k}=${v}`).join(', ')}), медиана длины ${median(arr.map((a) => n(a, 'len')))} симв.`);
}
say('');

fs.writeFileSync(path.join(OUT, 'METRICS_CORE.md'), '# Метрики ядра (машинный счёт)\n\n' + L.join('\n') + '\n');
console.log('\n→ DATASET/METRICS_CORE.md');
