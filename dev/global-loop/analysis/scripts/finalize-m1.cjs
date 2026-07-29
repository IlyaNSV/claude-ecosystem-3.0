#!/usr/bin/env node
/**
 * finalize-m1.cjs — сведение M1: вердикты первого прохода + слепая переоценка спорных.
 *
 * Приоритет у переоценки (она видела расширенный материал: коммиты экосистемы и factory-conductor).
 * Считает: распределение вердиктов, resolution rate, cost per resolved intent (центральное число).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const JD = path.join(ROOT, 'JUDGE');

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
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const num = (r, k) => Number(r[k]) || 0;
const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const intents = readCsv(path.join(OUT, 'intents.csv'));
const sessions = readCsv(path.join(OUT, 'sessions.csv'));

const pass1 = [1, 2, 3].flatMap((n) => readJsonl(path.join(JD, `VERDICTS_${n}.jsonl`)));
const recheck = readJsonl(path.join(JD, 'VERDICTS_RECHECK.jsonl'));
const finalMap = new Map(pass1.map((v) => [v.intent_id, { ...v, pass: 1 }]));
for (const v of recheck) finalMap.set(v.intent_id, { ...v, pass: 2 });

const rows = intents.map((i) => {
  const v = finalMap.get(i.intent_id) || { verdict: 'НЕТ ВЕРДИКТА', evidence: '', note: '', topic: '', pass: 0 };
  const p1 = pass1.find((x) => x.intent_id === i.intent_id);
  return {
    intent_id: i.intent_id, ts: i.ts, epoch: i.epoch, type: i.type,
    verdict: v.verdict, verdict_pass1: p1 ? p1.verdict : '', changed_on_recheck: v.pass === 2 && p1 && p1.verdict !== v.verdict ? 1 : 0,
    topic: v.topic, evidence: (v.evidence || '').slice(0, 300), note: (v.note || '').slice(0, 300),
    sessions_n: i.sessions_n, commits_n: i.commits_n, tok_out_executor: i.tok_out_executor,
    wall_active_min: i.wall_active_min, runtime_lines: i.runtime_lines,
    text: i.text.slice(0, 200),
  };
});
fs.writeFileSync(path.join(OUT, 'intents_verdicts.csv'),
  [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.keys(rows[0]).map((h) => esc(r[h])).join(','))].join('\n') + '\n');

const L = [];
const say = (s = '') => { L.push(s); console.log(s); };
const dist = (arr) => { const m = {}; for (const r of arr) m[r.verdict] = (m[r.verdict] || 0) + 1; return m; };

say('# M1 — интенция → результат (финальные вердикты)');
say('');
say(`Интенций: **${rows.length}**. Судейство: 3 независимых судьи (первый проход) + слепая переоценка ${recheck.length} спорных с расширенным материалом (коммиты экосистемы и factory-conductor). Приоритет — у переоценки.`);
say('');
const d = dist(rows);
say('| вердикт | интенций | доля |');
say('|---|---|---|');
const ORDER = ['RESOLVED_1', 'RESOLVED_N', 'REOPENED', 'NOT_RESOLVED', 'NO_WORK_EXPECTED', 'UNCLEAR', 'НЕТ ВЕРДИКТА'];
for (const k of ORDER) if (d[k]) say(`| ${k} | ${d[k]} | ${(d[k] / rows.length * 100).toFixed(1)}% |`);
say('');

const needWork = rows.filter((r) => r.verdict !== 'NO_WORK_EXPECTED' && r.verdict !== 'НЕТ ВЕРДИКТА');
const resolved = rows.filter((r) => ['RESOLVED_1', 'RESOLVED_N'].includes(r.verdict));
const r1 = rows.filter((r) => r.verdict === 'RESOLVED_1');
say(`Интенций, требовавших работы: **${needWork.length}** (остальные ${rows.length - needWork.length} — организационные реплики, вопросы статуса, распоряжения об остановке).`);
say(`Из них **решено: ${resolved.length}** (${(resolved.length / needWork.length * 100).toFixed(1)}%), в том числе **с первого захода: ${r1.length}** (${(r1.length / needWork.length * 100).toFixed(1)}%).`);
say(`Переоткрыто: ${rows.filter((r) => r.verdict === 'REOPENED').length} · не решено: ${rows.filter((r) => r.verdict === 'NOT_RESOLVED').length} · неразрешимо по свидетельствам: ${rows.filter((r) => r.verdict === 'UNCLEAR').length}.`);
say('');
say(`Порог PREREG для «доли с первого захода»: ≥0.60 спокойно, <0.40 тревога → фактически **${(r1.length / needWork.length).toFixed(3)}**.`);
say('');

// стоимость
const totalExecTok = ['RUN-A', 'RUN-B'].reduce((a, ep) => a + sessions.filter((s) => s.layer === 'executor' && s.run_epoch === ep).reduce((x, s) => x + num(s, 'tok_out') + num(s, 'subagent_tok_out'), 0), 0);
const totalHostTok = ['RUN-A', 'RUN-B'].reduce((a, ep) => a + sessions.filter((s) => s.layer === 'host' && s.run_epoch === ep).reduce((x, s) => x + num(s, 'tok_out') + num(s, 'subagent_tok_out'), 0), 0);
const totalTok = totalExecTok + totalHostTok;
const totalWall = ['RUN-A', 'RUN-B'].reduce((a, ep) => a + sessions.filter((s) => ['executor', 'host'].includes(s.layer) && s.run_epoch === ep).reduce((x, s) => x + num(s, 'wall_active_min'), 0), 0);

say('## Cost per resolved intent — центральное число');
say('');
say('| знаменатель | токенов на единицу | активных минут на единицу |');
say('|---|---|---|');
say(`| решённая интенция (n=${resolved.length}) | **${Math.round(totalTok / resolved.length).toLocaleString('ru-RU')}** | **${(totalWall / resolved.length).toFixed(0)}** |`);
say(`| интенция, требовавшая работы (n=${needWork.length}) | ${Math.round(totalTok / needWork.length).toLocaleString('ru-RU')} | ${(totalWall / needWork.length).toFixed(0)} |`);
say(`| любая интенция (n=${rows.length}) | ${Math.round(totalTok / rows.length).toLocaleString('ru-RU')} | ${(totalWall / rows.length).toFixed(0)} |`);
say('');
say(`Знаменатель считает **всю** стоимость обоих прогонов: исполнители с субагентами ${totalExecTok.toLocaleString('ru-RU')} токенов + пульт ${totalHostTok.toLocaleString('ru-RU')} токенов = **${totalTok.toLocaleString('ru-RU')}**; активное время ${(totalWall / 60).toFixed(1)} ч.`);
say('');

// разрез по эпохам
say('### По эпохам');
say('');
say('| эпоха | интенций | требовали работы | решено | с 1-го захода | токенов на решённую |');
say('|---|---|---|---|---|---|');
for (const ep of ['RUN-A', 'RUN-B']) {
  const g = rows.filter((r) => r.epoch === ep);
  const gw = g.filter((r) => r.verdict !== 'NO_WORK_EXPECTED');
  const gr = g.filter((r) => ['RESOLVED_1', 'RESOLVED_N'].includes(r.verdict));
  const g1 = g.filter((r) => r.verdict === 'RESOLVED_1');
  const tok = sessions.filter((s) => ['executor', 'host'].includes(s.layer) && s.run_epoch === ep).reduce((x, s) => x + num(s, 'tok_out') + num(s, 'subagent_tok_out'), 0);
  say(`| ${ep} | ${g.length} | ${gw.length} | ${gr.length} | ${g1.length} | ${gr.length ? Math.round(tok / gr.length).toLocaleString('ru-RU') : '—'} |`);
}
say('');

// изменения на переоценке
const changed = rows.filter((r) => r.changed_on_recheck === 1);
say(`## Устойчивость судейства`);
say('');
say(`На слепой переоценке с расширенным материалом изменилось **${changed.length} из ${recheck.length}** вердиктов.`);
say('');
say('| интенция | было | стало | тема |');
say('|---|---|---|---|');
for (const c of changed) say(`| ${c.intent_id} | ${c.verdict_pass1} | ${c.verdict} | ${(c.topic || '').slice(0, 60)} |`);
say('');
say('_Изменения — не «судья ошибся», а «пакет был неполон»: первый проход видел только коммиты пилота._');
say('');

// переоткрытые темы
say('## Переоткрытые интенции (что возвращалось)');
say('');
for (const r of rows.filter((x) => x.verdict === 'REOPENED')) {
  say(`- **${r.intent_id}** (${r.ts}, тема «${r.topic}»): ${r.text.slice(0, 160)}`);
}
say('');

fs.writeFileSync(path.join(OUT, 'M1_RESULT.md'), L.join('\n') + '\n');
console.log('\n→ DATASET/M1_RESULT.md + intents_verdicts.csv');
