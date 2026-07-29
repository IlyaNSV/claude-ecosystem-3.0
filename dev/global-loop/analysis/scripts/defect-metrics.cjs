#!/usr/bin/env node
/**
 * defect-metrics.cjs — Фаза I (defect-escape) + M8 (fix survival) по дефект-реестру.
 *
 * Вход: DATASET/defects.csv (собран субагентом из ledger/feedback/NOTE — каждая строка с провенансом).
 * ВАЖНО: реестр — это claims-производная (кто что зафиксировал). Поэтому:
 *   - распределения по «кто поймал» и «какой гейт должен был» берём как есть (это разметка источника);
 *   - но КАЖДЫЙ sha фикса проверяем детерминированно: существует ли коммит и жив ли он в HEAD (M8).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');

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
const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const defects = readCsv(path.join(OUT, 'defects.csv'));
const dump = fs.readFileSync(path.join(OUT, 'pilot_git_dump.txt'), 'utf8').replace(/\r\n/g, '\n');
const pilotCommits = new Map();
for (const line of dump.split('###NUMSTAT')[0].split('\n')) {
  const m = line.match(/^([0-9a-f]{40})\|([^|]+)\|([^|]*)\|([^|]*)\|(.*)$/);
  if (m) pilotCommits.set(m[1], { date: m[2].slice(0, 10), subject: m[5] });
}
const headIdx = fs.readFileSync(path.join(OUT, 'pilot_head_index.txt'), 'utf8').replace(/\r\n/g, '\n');
const headSet = new Set(headIdx.split('###FILES')[0].split('\n').map((s) => s.trim()).filter((s) => /^[0-9a-f]{40}$/.test(s)));
const findFull = (p) => (pilotCommits.has(p) ? p : [...pilotCommits.keys()].find((f) => f.startsWith(p)) || null);

const L = [];
const say = (s = '') => { L.push(s); console.log(s); };
const tally = (key) => {
  const m = {};
  for (const d of defects) m[d[key] || '—'] = (m[d[key] || '—'] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};
const pct = (x, y) => (y ? (x / y * 100).toFixed(1) + '%' : '—');

say('# Фаза I — дефекты: кто ловит, какой гейт должен был, что выжило');
say('');
say(`Всего дефектов в реестре: **${defects.length}** (источник — `);
say('`DATASET/defects.csv`, собран из ledger + feedback-файла + NOTE-реестров, каждая строка с провенансом).');
say('');

say('## Кто фактически обнаружил');
say('');
say('| кто | дефектов | доля |');
say('|---|---|---|');
for (const [k, v] of tally('caught_by')) say(`| ${k} | ${v} | ${pct(v, defects.length)} |`);
say('');
const owner = defects.filter((d) => d.caught_by === 'owner').length;
const machine = defects.filter((d) => d.caught_by === 'machine').length;
say(`**Defect-escape rate** (доля дефектов, до которых машина не добралась и поймал владелец глазами) = ${owner}/${defects.length} = **${(owner / defects.length).toFixed(3)}** (порог PREREG: ≤0.20 спокойно).`);
say(`Отношение «машина : владелец» = ${machine}:${owner} = **${(machine / (owner || 1)).toFixed(1)}:1**.`);
say('');

say('## Какой гейт ДОЛЖЕН был поймать');
say('');
say('| гейт | дефектов | доля |');
say('|---|---|---|');
for (const [k, v] of tally('gate_expected')) say(`| ${k} | ${v} | ${pct(v, defects.length)} |`);
say('');
const noGate = defects.filter((d) => /нет такого гейта/i.test(d.gate_expected || '')).length;
say(`**У ${noGate} из ${defects.length} дефектов (${pct(noGate, defects.length)}) в экосистеме НЕТ гейта, который обязан был их поймать.** Это не «гейты не сработали», а «гейта не существует» — принципиально другой класс проблемы.`);
say('');

say('## Классы дефектов');
say('');
say('| класс | дефектов |');
say('|---|---|');
for (const [k, v] of tally('class')) say(`| ${k} | ${v} |`);
say('');
say('## Статус');
say('');
say('| статус | дефектов |');
say('|---|---|');
for (const [k, v] of tally('status')) say(`| ${k} | ${v} |`);
say('');

// ── M8: выживаемость фиксов
say('## M8 — выживаемость фиксов (детерминированная проверка каждого sha)');
say('');
const survRows = [];
let checked = 0, alive = 0, missing = 0, notInHead = 0;
for (const d of defects) {
  const refs = (d.fix_ref || '').match(/\b[0-9a-f]{7,40}\b/g) || [];
  if (!refs.length) continue;
  for (const r of refs) {
    const full = findFull(r);
    checked++;
    let verdict;
    if (!full) { verdict = 'НЕ НАЙДЕН в истории пилота'; missing++; }
    else if (headSet.has(full)) { verdict = 'жив в HEAD'; alive++; }
    else { verdict = 'есть в истории, но НЕ в HEAD'; notInHead++; }
    survRows.push({ defect_id: d.defect_id, class: d.class, fix_sha: r, verdict, commit_date: full ? pilotCommits.get(full).date : '', subject: full ? pilotCommits.get(full).subject.slice(0, 120) : '' });
  }
}
fs.writeFileSync(path.join(OUT, 'fix_survival.csv'),
  ['defect_id,class,fix_sha,verdict,commit_date,subject', ...survRows.map((r) => [r.defect_id, r.class, r.fix_sha, r.verdict, r.commit_date, r.subject].map(esc).join(','))].join('\n') + '\n');
say(`Проверено sha-ссылок на фиксы: **${checked}** · живы в HEAD: **${alive}** (${pct(alive, checked)}) · есть в истории, но не в HEAD: ${notInHead} · не найдены вообще: ${missing}.`);
say('');
say(`**Fix survival rate = ${(alive / (checked || 1)).toFixed(3)}** (порог PREREG: ≥0.90 спокойно).`);
say('');
if (missing) {
  say('Ссылки на фиксы, не найденные в истории пилота (проверить вручную — возможно, это коммиты репо экосистемы):');
  for (const r of survRows.filter((x) => x.verdict.startsWith('НЕ')).slice(0, 12)) say(`- ${r.defect_id}: ${r.fix_sha}`);
  say('');
}

fs.writeFileSync(path.join(OUT, 'PHASE1_DEFECTS.md'), L.join('\n') + '\n');
console.log('\n→ DATASET/PHASE1_DEFECTS.md + fix_survival.csv');
