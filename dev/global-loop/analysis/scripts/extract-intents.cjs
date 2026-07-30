#!/usr/bin/env node
/**
 * extract-intents.cjs — сырьё M1 (реестр интенций) и 3.2 (тучпойнты).
 *
 * ПЕРВИЧНЫЙ источник интенций — дословные сообщения владельца в ХОСТ-транскриптах прогонов
 * (owner_prompts.jsonl). Ledger — вторичный (пересказ кондуктора), используется для сверки.
 *
 * Классификация — механическая (эвристики), финальные вердикты по интенциям ставятся отдельно.
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
const writeCsv = (file, hdr, rows) => fs.writeFileSync(file, [hdr.join(','), ...rows.map((r) => hdr.map((h) => esc(r[h])).join(','))].join('\n') + '\n');

const roles = readCsv(path.join(OUT, 'host_roles.csv'));
const runFiles = new Set(roles.filter((r) => r.role === 'conductor-run' || r.role === 'conductor-adjacent').map((r) => r.source_file));

const RUN_A = ['2026-07-16T20:00', '2026-07-20T23:59'];
const RUN_B = ['2026-07-21T20:00', '2026-07-24T06:00'];
const epochOf = (ts) => (ts >= RUN_A[0] && ts <= RUN_A[1] ? 'RUN-A' : ts >= RUN_B[0] && ts <= RUN_B[1] ? 'RUN-B' : ts < RUN_A[0] ? 'pre' : 'post');

// служебное/операционное — не интенция
const NOISE = [
  /^(ок|окей|ok|да|нет|ага|хорошо|спасибо|понял|принято|отлично|супер|класс|\+)[.!\s]*$/i,
  /^(продолжай|продолжаем|дальше|далее|go on|continue)[.!\s]*$/i,
  /^\/[a-z:-]+/,                       // слэш-команды
  /^\[Request interrupted/,
  /^<[a-z-]+>/,
];
const isNoise = (t) => NOISE.some((re) => re.test(t.trim()));

const CLASS = [
  { type: 'GO', re: /^\s*(го\b|давай\b|поехали|запускай|делай|стартуй|начинай)|\bго на\b|\bдаю го\b/i },
  { type: 'FINDING', re: /не работает|ошибк|баг|тупик|не могу|падает|сломал|странно|почему.*не|пусто|не вижу|401|500|не отображ/i },
  { type: 'DIRECTIVE', re: /нужно|надо|сделай|подготовь|проверь|добавь|исправь|перезагрузи|пересобери|собери|напиши|зафиксируй/i },
  { type: 'QUESTION', re: /\?$|^как\b|^что\b|^почему\b|^можно ли|^есть ли|^а если/i },
  { type: 'DECISION', re: /решени|выбираю|вариант [AB]|ратифиц|утвержда|остаёмся|оставляем|отклоня/i },
];
const classify = (t) => (CLASS.find((c) => c.re.test(t)) || { type: 'OTHER' }).type;

const rows = [];
const lines = fs.readFileSync(path.join(OUT, 'owner_prompts.jsonl'), 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  const o = JSON.parse(line);
  const ts = (o.ts || '').slice(0, 16);
  const epoch = epochOf(ts);
  const text = o.text.replace(/\s+/g, ' ').trim();
  rows.push({
    ts, epoch, session: (o.session_id || '').slice(0, 8), source_file: o.source_file,
    in_run_session: runFiles.has(o.source_file) ? 1 : 0,
    is_noise: isNoise(text) ? 1 : 0, len: o.len,
    type: classify(text),
    text: text.slice(0, 700),
  });
}
rows.sort((a, b) => (a.ts < b.ts ? -1 : 1));
writeCsv(path.join(OUT, 'owner_utterances.csv'), ['ts', 'epoch', 'session', 'source_file', 'in_run_session', 'is_noise', 'len', 'type', 'text'], rows);

const runRows = rows.filter((r) => r.in_run_session === 1 && ['RUN-A', 'RUN-B'].includes(r.epoch));
const signal = runRows.filter((r) => !r.is_noise);
console.log(`всего владельческих сообщений: ${rows.length}`);
console.log(`в сессиях прогонов и окнах RUN-A/RUN-B: ${runRows.length} (из них не-шум: ${signal.length})`);
const byEpoch = {}; for (const r of signal) byEpoch[r.epoch] = (byEpoch[r.epoch] || 0) + 1;
const byType = {}; for (const r of signal) byType[r.type] = (byType[r.type] || 0) + 1;
console.log('по эпохам:', byEpoch);
console.log('по типам:', byType);
console.log('медианная длина сообщения:', signal.map((r) => r.len).sort((a, b) => a - b)[Math.floor(signal.length / 2)], 'симв.');
console.log('\nпримеры GO/DIRECTIVE (первые 8):');
for (const r of signal.filter((x) => ['GO', 'DIRECTIVE'].includes(x.type)).slice(0, 8)) {
  console.log(`  ${r.ts} [${r.epoch}/${r.type}] ${r.text.slice(0, 150)}`);
}
