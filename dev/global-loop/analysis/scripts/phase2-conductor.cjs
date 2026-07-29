#!/usr/bin/env node
/**
 * phase2-conductor.cjs — Фаза II: эффективность управления (кондуктор-слой).
 *
 * Считает: автономию executor-сессий · Q&A-нагрузку на пульт · латентность контура
 * (интенция → первая работа; ESCALATE → следующее решение владельца) · реестр инцидентов ·
 * стоимость онбординга пульта · распределение внимания владельца по времени суток.
 *
 * Все числа — из машинных источников (транскрипты, run-ledger, git), ledger — только для разметки.
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
const num = (r, k) => Number(r[k]) || 0;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const sessions = readCsv(path.join(OUT, 'sessions.csv'));
const entries = readCsv(path.join(OUT, 'ledger_entries.csv'));
const intents = readCsv(path.join(OUT, 'intents.csv'));
const questions = readCsv(path.join(OUT, 'owner_questions.csv'));
const utter = readCsv(path.join(OUT, 'owner_utterances.csv'));

const L = [];
const say = (s = '') => { L.push(s); console.log(s); };

say('# Фаза II — эффективность управления (кондуктор)');
say('');

// ── 1. Executor-сессии: длительность, автономия, инциденты
say('## 1. Executor-сессии прогонов');
say('');
const exec = sessions.filter((s) => s.layer === 'executor' && ['RUN-A', 'RUN-B'].includes(s.run_epoch) && s.cond_label);
say('| сессия | эпоха | активн., мин | span, мин | tok_out (с суб.) | tool-calls | субагентов | api-ошибок | разрывов >5 мин | макс. разрыв |');
say('|---|---|---|---|---|---|---|---|---|---|');
for (const s of exec.sort((a, b) => (a.first_ts < b.first_ts ? -1 : 1))) {
  say(`| ${s.cond_label} | ${s.run_epoch} | ${s.wall_active_min} | ${s.wall_span_min} | ${(num(s, 'tok_out') + num(s, 'subagent_tok_out')).toLocaleString('ru-RU')} | ${num(s, 'tool_calls_total') + num(s, 'subagent_tool_calls')} | ${s.subagent_files} | ${s.api_error_msgs} | ${s.stall_gaps_gt5min} | ${s.max_gap_min} |`);
}
say('');
const totalExec = exec.length;
const withApiErr = exec.filter((s) => num(s, 'api_error_msgs') > 0).length;
const longStall = exec.filter((s) => num(s, 'max_gap_min') > 20).length;
say(`Сессий: **${totalExec}** · с видимой API-ошибкой в транскрипте: **${withApiErr}** · с разрывом >20 мин: **${longStall}**`);
say('');

// ── 2. Автономия: сколько сессий шли без вмешательства владельца в их окно
say('## 2. Автономия executor-сессий');
say('');
const ownerMsgs = utter.filter((u) => u.in_run_session === '1' && u.is_noise === '0').map((u) => Date.parse(u.ts + ':00Z')).filter((t) => !Number.isNaN(t));
let noTouch = 0, touched = 0;
const touchCounts = [];
for (const s of exec) {
  const t0 = Date.parse(s.first_ts), t1 = Date.parse(s.last_ts);
  const inWindow = ownerMsgs.filter((t) => t >= t0 && t <= t1).length;
  touchCounts.push(inWindow);
  if (inWindow === 0) noTouch++; else touched++;
}
say(`Сессий без единого сообщения владельца в окне их работы: **${noTouch} из ${totalExec}** (${(noTouch / totalExec * 100).toFixed(0)}%).`);
say(`Медиана вмешательств владельца на сессию: **${median(touchCounts)}**; максимум: ${Math.max(...touchCounts)}.`);
say('');
say('_Оговорка: «сообщение владельца в окне сессии» — не обязательно вмешательство в эту сессию: владелец мог обсуждать другое. Метрика — верхняя оценка вмешательств, а не точная._');
say('');

// ── 3. Q&A-нагрузка и эскалации
say('## 3. Нагрузка на пульт: вопросы владельца и эскалации');
say('');
const escEntries = entries.filter((e) => e.has_escalate === '1');
say(`Записей ledger с ESCALATE: **${escEntries.length}** из ${entries.length}; на одну executor-сессию: **${(escEntries.length / totalExec).toFixed(2)}**.`);
say(`Вопросов владельца (тип QUESTION, дедуплицировано): **${questions.length}** — из них RUN-A ${questions.filter((q) => q.epoch === 'RUN-A').length}, RUN-B ${questions.filter((q) => q.epoch === 'RUN-B').length}.`);
say('');
say('Вопросы владельца дословно (первые 12 — материал для классификации мандата H2):');
for (const q of questions.slice(0, 12)) say(`- [${q.ts}] ${q.text.slice(0, 150)}`);
say('');

// ── 4. Латентность контура: интенция → первая работа
say('## 4. Латентность контура');
say('');
const lat = [];
for (const i of intents) {
  if (num(i, 'sessions_n') === 0 && num(i, 'commits_n') === 0) continue;
  const t0 = Date.parse(i.ts + ':00Z');
  const s = sessions.filter((x) => x.layer === 'executor' && x.first_ts && Date.parse(x.first_ts) >= t0)
    .sort((a, b) => Date.parse(a.first_ts) - Date.parse(b.first_ts))[0];
  if (!s) continue;
  const d = (Date.parse(s.first_ts) - t0) / 60000;
  if (d >= 0 && d < 12 * 60) lat.push(d);
}
say(`Интенция → старт executor-сессии: медиана **${median(lat)?.toFixed(1) ?? '—'}** мин (n=${lat.length}), p25 ${lat.length ? [...lat].sort((a, b) => a - b)[Math.floor(lat.length * 0.25)].toFixed(1) : '—'}, p75 ${lat.length ? [...lat].sort((a, b) => a - b)[Math.floor(lat.length * 0.75)].toFixed(1) : '—'}.`);
say('');

// ── 5. Инциденты управления
say('## 5. Инциденты (по разметке ledger + машинный след)');
say('');
const inc = entries.filter((e) => e.has_incident === '1');
say(`Записей с признаком инцидента: **${inc.length}**.`);
say('');
say('| запись | дата | заголовок |');
say('|---|---|---|');
for (const e of inc) say(`| ${e.id} | ${e.date} | ${e.title.slice(0, 110)} |`);
say('');

// ── 6. Хост-слой: цена пульта
say('## 6. Цена пульта (хост-слой)');
say('');
const host = sessions.filter((s) => s.layer === 'host' && ['RUN-A', 'RUN-B'].includes(s.run_epoch));
say('| сессия | эпоха | активн., ч | tok_out основной | tok_out субагентов | tool-calls | ctx_processed |');
say('|---|---|---|---|---|---|---|');
for (const s of host.sort((a, b) => (a.first_ts < b.first_ts ? -1 : 1))) {
  say(`| ${s.session_id.slice(0, 8)} | ${s.run_epoch} | ${(num(s, 'wall_active_min') / 60).toFixed(1)} | ${num(s, 'tok_out').toLocaleString('ru-RU')} | ${num(s, 'subagent_tok_out').toLocaleString('ru-RU')} | ${num(s, 'tool_calls_total')} | ${num(s, 'ctx_processed').toLocaleString('ru-RU')} |`);
}
say('');

fs.writeFileSync(path.join(OUT, 'PHASE2_CONDUCTOR.md'), L.join('\n') + '\n');
console.log('\n→ DATASET/PHASE2_CONDUCTOR.md');
