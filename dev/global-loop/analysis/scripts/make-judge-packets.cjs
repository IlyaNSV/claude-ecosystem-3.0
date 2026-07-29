#!/usr/bin/env node
/** make-judge-packets.cjs — готовит пакеты свидетельств для судьи M1 (по рубрике RUBRICS/intent-resolution.md) */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const PK = path.join(ROOT, 'JUDGE');
fs.mkdirSync(PK, { recursive: true });

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

const intents = readCsv(path.join(OUT, 'intents.csv'));

// общий контекст: все интенции одной строкой — нужен судье для детекта переоткрытий
const ctx = intents.map((r) => `${r.intent_id} [${r.ts} ${r.epoch}] ${r.text.slice(0, 220)}`).join('\n');
fs.writeFileSync(path.join(PK, 'ALL_INTENTS_CONTEXT.md'), `# Все интенции владельца за оба прогона (для детекта переоткрытий)\n\n\`\`\`\n${ctx}\n\`\`\`\n`);

const CHUNK = 21;
let part = 0;
for (let i = 0; i < intents.length; i += CHUNK) {
  part++;
  const slice = intents.slice(i, i + CHUNK);
  const L = [`# Пакет свидетельств ${part} — интенции ${slice[0].intent_id}…${slice[slice.length - 1].intent_id}`, ''];
  for (const r of slice) {
    L.push(`## ${r.intent_id} — ${r.ts} (${r.epoch}, тип по эвристике: ${r.type})`);
    L.push('');
    L.push('**Дословно от владельца:**');
    L.push('> ' + r.text.replace(/\n/g, ' '));
    L.push('');
    L.push(`- окно атрибуции: до ${r.window_end}`);
    L.push(`- executor-сессии в окне (${r.sessions_n}): ${r.sessions || '—'}`);
    L.push(`- коммиты пилота в окне (${r.commits_n}): ${r.commits || '—'}`);
    if (r.commit_subjects) L.push(`- о чём коммиты: ${r.commit_subjects}`);
    L.push(`- строки: +${r.ins}/−${r.del} (из них runtime: ${r.runtime_lines})`);
    L.push(`- процессные прогоны в окне (${r.processes_n}): ${r.processes || '—'}`);
    L.push(`- токенов executor+субагенты: ${Number(r.tok_out_executor).toLocaleString('ru-RU')}; активное время: ${r.wall_active_min} мин`);
    L.push(`- записи ledger в окне: ${r.ledger_entries || '—'}`);
    if (r.ledger_titles) L.push(`- заголовки записей: ${r.ledger_titles}`);
    L.push('');
  }
  fs.writeFileSync(path.join(PK, `PACKET_${part}.md`), L.join('\n') + '\n');
  console.log(`PACKET_${part}.md: ${slice.length} интенций (${slice[0].intent_id}…${slice[slice.length - 1].intent_id})`);
}
