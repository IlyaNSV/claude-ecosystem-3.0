#!/usr/bin/env node
/** sanity-report.cjs — санитария корпуса (план §3.6): полнота, пробелы, аномалии. Пишет DATASET/SANITY.md */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');

function readCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
  const rows = []; let cur = [], field = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  const hdr = rows.shift();
  return rows.map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
}

const sessions = readCsv(path.join(OUT, 'sessions.csv'));
const hostRoles = readCsv(path.join(OUT, 'host_roles.csv'));
const num = (r, k) => Number(r[k]) || 0;
const fmt = (n) => n.toLocaleString('ru-RU');

const L = [];
L.push('# SANITY — санитария корпуса (Фаза 0, план §3.6)');
L.push('');
L.push(`Сгенерировано: \`scripts/sanity-report.cjs\` из \`sessions.csv\` + \`host_roles.csv\`. Дата снимка корпуса: 2026-07-29.`);
L.push('');

// --- 1. Полнота executor-корпуса против заявленных cond-s1..s35
const exec = sessions.filter((s) => s.layer === 'executor');
const labelled = exec.filter((s) => s.cond_label);
const labels = new Set(labelled.map((s) => s.cond_label.replace('-partial', '')));
const missing = [];
for (let i = 1; i <= 35; i++) if (!labels.has(`cond-s${i}`)) missing.push(`cond-s${i}`);

L.push('## 1. Полнота executor-корпуса');
L.push('');
L.push(`- Заявлено в ledger: **35** executor-сессий (cond-s1…s35).`);
L.push(`- Транскриптов в harvest, размеченных меткой: **${labelled.length}** (включая \`cond-s35-partial\` и \`extra-*\`).`);
L.push(`- **Не найдено:** ${missing.length ? missing.join(', ') : '—'}.`);
L.push('');

// --- 2. Executor-сессии в окнах прогонов БЕЗ метки
const unlabelled = exec.filter((s) => !s.cond_label && ['RUN-A', 'RUN-B'].includes(s.run_epoch));
L.push('## 2. Executor-сессии в окнах прогонов без cond-метки');
L.push('');
if (unlabelled.length) {
  L.push('| session_id | эпоха | начало | конец | tok_out | tools | ветка |');
  L.push('|---|---|---|---|---|---|---|');
  for (const s of unlabelled.sort((a, b) => (a.first_ts < b.first_ts ? -1 : 1))) {
    L.push(`| \`${s.session_id.slice(0, 8)}\` | ${s.run_epoch} | ${s.first_ts.slice(0, 16)} | ${s.last_ts.slice(0, 16)} | ${fmt(num(s, 'tok_out'))} | ${s.tool_calls_total} | ${s.git_branch} |`);
  }
} else L.push('— нет.');
L.push('');

// --- 3. Токен-вес субагентов (обоснование S-1)
const sumBy = (arr, k) => arr.reduce((a, r) => a + num(r, k), 0);
L.push('## 3. Вес субагентов (санитарная находка S-1)');
L.push('');
L.push('| срез | сессий | tok_out основной | tok_out субагентов | доля субагентов |');
L.push('|---|---|---|---|---|');
for (const ep of ['pre-conductor', 'RUN-A', 'RUN-B', 'post-run']) {
  for (const ly of ['executor', 'host']) {
    const g = sessions.filter((s) => s.run_epoch === ep && s.layer === ly);
    if (!g.length) continue;
    const main = sumBy(g, 'tok_out'), sub = sumBy(g, 'subagent_tok_out');
    L.push(`| ${ep} / ${ly} | ${g.length} | ${fmt(main)} | ${fmt(sub)} | ${(sub / (main + sub) * 100).toFixed(1)}% |`);
  }
}
L.push('');
L.push('> Harvest-копии на хосте субагентских транскриптов **не содержат** — токен-учёт по ним занижен на указанную долю. Все токен-метрики считаются по VM-CORPUS.');
L.push('');

// --- 4. Хост-слой: кто реально вёл прогоны
L.push('## 4. Хост-сессии: классификация по содержанию (не по mtime)');
L.push('');
const runHosts = hostRoles.filter((r) => r.role === 'conductor-run');
L.push(`Всего хост-файлов: **${hostRoles.length}**; \`conductor-run\`: **${runHosts.length}**; \`conductor-adjacent\`: **${hostRoles.filter((r) => r.role === 'conductor-adjacent').length}**; \`ecosystem-dev\`: **${hostRoles.filter((r) => r.role === 'ecosystem-dev').length}**.`);
L.push('');
L.push('| session | роль | окно (по timestamps) | промптов владельца | cond-маркеров |');
L.push('|---|---|---|---|---|');
for (const r of hostRoles.filter((x) => x.role !== 'ecosystem-dev').sort((a, b) => (a.first_ts < b.first_ts ? -1 : 1))) {
  L.push(`| \`${(r.session_id || r.source_file).slice(0, 8)}\` | ${r.role} | ${r.first_ts.slice(0, 16)} → ${r.last_ts.slice(0, 16)} | ${r.owner_prompts} | ${r.cond_dispatch} |`);
}
L.push('');
L.push('**Аномалия A-1 (машинное подтверждение коллизии RUN-B.44):** сессии `2e40ba63` и `5a97a31d` стартовали в одну минуту `2026-07-21T22:28` и обе несут ~275 cond-маркеров — две хост-сессии вели прогон параллельно, как и зафиксировано в ledger. Ledger-версия события подтверждается независимо.');
L.push('');
L.push('**Аномалия A-2:** окно поиска хост-сессий из плана (mtime 07-17..25) неверно по построению — файлы живут неделями из-за `--resume`; `f23719c7` начата 07-16T23:24 и закрыта 07-19, `2e40ba63`/`5a97a31d` покрывают 07-21…07-23. Классификация выполнена по timestamps и содержанию.');
L.push('');

// --- 5. Аномалии сессий
L.push('## 5. Аномалии отдельных сессий');
L.push('');
const anomalies = [];
for (const s of sessions) {
  if (!s.first_ts) anomalies.push([s.source_file, 'нет timestamp-записей (пустой/служебный файл)']);
  else if (num(s, 'msgs_assistant') === 0) anomalies.push([s.source_file, 'нет assistant-сообщений']);
  else if (num(s, 'max_gap_min') > 60) anomalies.push([s.session_id.slice(0, 8), `максимальный разрыв ${s.max_gap_min} мин (${s.run_epoch}/${s.layer}${s.cond_label ? ', ' + s.cond_label : ''})`]);
  if (num(s, 'parse_fail') > 0) anomalies.push([s.session_id.slice(0, 8), `${s.parse_fail} нечитаемых строк`]);
}
L.push(`Найдено записей: ${anomalies.length}`);
L.push('');
L.push('| объект | аномалия |');
L.push('|---|---|');
for (const [a, b] of anomalies.slice(0, 40)) L.push(`| \`${a}\` | ${b} |`);
L.push('');

// --- 6. API-инциденты
const withErr = sessions.filter((s) => num(s, 'api_error_msgs') > 0);
L.push('## 6. API-инциденты (машинный след)');
L.push('');
L.push(`Сессий с записями \`isApiErrorMessage\`: **${withErr.length}**; всего таких записей: **${sumBy(withErr, 'api_error_msgs')}**.`);
L.push('');
L.push('| сессия | слой/эпоха | метка | api-error записей | разрывов >5 мин | макс. разрыв, мин |');
L.push('|---|---|---|---|---|---|');
for (const s of withErr.sort((a, b) => num(b, 'api_error_msgs') - num(a, 'api_error_msgs')).slice(0, 25)) {
  L.push(`| \`${s.session_id.slice(0, 8)}\` | ${s.layer}/${s.run_epoch} | ${s.cond_label || '—'} | ${s.api_error_msgs} | ${s.stall_gaps_gt5min} | ${s.max_gap_min} |`);
}
L.push('');
L.push('> Осторожно: `isApiErrorMessage` ловит только *видимые* ошибки. Известный случай s31 (31-минутный молчаливый ретрай) в этом столбце не виден — он ловится столбцом «макс. разрыв».');
L.push('');

fs.writeFileSync(path.join(OUT, 'SANITY.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
