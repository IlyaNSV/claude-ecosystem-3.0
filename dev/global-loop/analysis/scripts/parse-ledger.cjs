#!/usr/bin/env node
/**
 * parse-ledger.cjs — машинная структуризация ASSIST_LOG.md (план §3.2 + сырьё для M7/3.3).
 *
 * ВАЖНО: ledger — это claims, а не факты. Скрипт лишь СТРУКТУРИРУЕТ утверждения и вытаскивает
 * из них верифицируемые якоря (sha коммитов, релизы, run-id, метки сессий), чтобы каждый claim
 * можно было проверить детерминированно (M7).
 *
 * Выход: DATASET/ledger_entries.csv · DATASET/ledger_claims_raw.csv · DATASET/touchpoints_raw.csv
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const LEDGER = path.resolve(ROOT, '..', 'ASSIST_LOG.md');

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const writeCsv = (file, hdr, rows) => fs.writeFileSync(file, [hdr.join(','), ...rows.map((r) => hdr.map((h) => esc(r[h])).join(','))].join('\n') + '\n');

const text = fs.readFileSync(LEDGER, 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');

// --- нарезка на записи ###
const entries = [];
let cur = null;
lines.forEach((line, i) => {
  const m = line.match(/^###\s+(RUN-[AB])\.(\d+)\s+—\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})?\s*—?\s*(.*)$/);
  const mOther = line.match(/^###\s+([A-Z0-9-]+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})?\s*—\s*(.*)$/);
  if (m) {
    if (cur) entries.push(cur);
    cur = { run: m[1], num: Number(m[2]), id: `${m[1]}.${m[2]}`, date: m[3], time: m[4] || '', title: m[5].trim(), line_start: i + 1, body: [] };
  } else if (mOther && !cur?.body.length) {
    if (cur) entries.push(cur);
    cur = { run: 'OTHER', num: 0, id: mOther[1], date: mOther[2], time: mOther[3] || '', title: mOther[4].trim(), line_start: i + 1, body: [] };
  } else if (cur) cur.body.push(line);
});
if (cur) entries.push(cur);

// --- поля и якоря
const SHA_RE = /\b[0-9a-f]{7,40}\b/g;
const RELEASE_RE = /\b20\d{6}T\d{6}Z\b/g;
const COND_RE = /\bcond-s(\d+)\b/g;
const RUNID_RE = /\brun (?:id )?([a-z0-9]{5,12})\b/gi;
const PA_RE = /\bPA-\d+\b/g;
const DEC_RE = /\bDEC-[A-Z]+-\d+\b/g;
const ATT_RE = /attention:\s*~?\s*(\d+)\s*мин/i;
const OWNER_QUOTE_RE = /«([^»]{6,400})»/g;

const CLAIM_MARKERS = [
  { type: 'deploy', re: /DEPLOYED\s*×\s*READY|релиз\s+20\d{6}T\d{6}Z|deploy(?:ed)?\b/i },
  { type: 'test-pass', re: /PASS\s*\d+\/\d+|UJA\s*(?:PASS|GREEN)|\b\d+\/\d+\b(?=[^\n]*(?:тест|test|ассерт|PASS))|зелён|GO\s*×\s*READY|STARTS\b/i },
  { type: 'code-fix', re: /фикс|починен|исправлен|устранён|закрыт|реализован|построен|добавлен|регенерирован/i },
  { type: 'doc-sync', re: /синк|док-синк|обновлён (?:артефакт|док|спека)|записан|зафиксирован|journaled|NOTE-\d+/i },
];

const entryRows = [], claimRows = [], touchRows = [];
let claimSeq = 0, touchSeq = 0;

for (const e of entries) {
  const body = e.body.join('\n');
  const full = `${e.title}\n${body}`;
  const field = (name) => {
    const m = body.match(new RegExp(`^-\\s*${name}:\\s*([\\s\\S]*?)(?=\\n-\\s+\\w|$)`, 'mi'));
    return m ? m[1].trim().replace(/\s+/g, ' ').slice(0, 900) : '';
  };
  const uniq = (arr) => [...new Set(arr)];
  const shas = uniq((full.match(SHA_RE) || []).filter((s) => /[0-9]/.test(s) && /[a-f]/.test(s) && s.length >= 7));
  const releases = uniq(full.match(RELEASE_RE) || []);
  const conds = uniq([...full.matchAll(COND_RE)].map((m) => `s${m[1]}`));
  const runids = uniq([...full.matchAll(RUNID_RE)].map((m) => m[1]));
  const pas = uniq(full.match(PA_RE) || []);
  const decs = uniq(full.match(DEC_RE) || []);
  const attention = (full.match(ATT_RE) || [])[1] || '';
  const quotes = [...full.matchAll(OWNER_QUOTE_RE)].map((m) => m[1]);

  entryRows.push({
    id: e.id, run: e.run, num: e.num, date: e.date, time: e.time, line: e.line_start,
    title: e.title, mode: field('mode'), attention_min: attention,
    has_escalate: /ESCALATE/i.test(full) ? 1 : 0,
    has_owner_decision: /решени[ея] владельца|владелец (?:решил|разрешил|дал|зафиксировал|уточнил)|го владельца|распоряжени/i.test(full) ? 1 : 0,
    has_incident: /обрыв|API-ошибк|API Error|коллизи|погибл|упал|kill|ребут|stall/i.test(full) ? 1 : 0,
    shas: shas.join(' '), releases: releases.join(' '), cond_sessions: conds.join(' '),
    run_ids: runids.join(' '), pa_refs: pas.join(' '), dec_refs: decs.join(' '),
    owner_quotes: quotes.length, body_len: body.length,
  });

  // --- кандидаты в claims (M7): строки с verifiable-якорями
  for (const rawLine of [e.title, ...e.body]) {
    const l = rawLine.trim();
    if (l.length < 25) continue;
    if (/^#{1,4}\s/.test(l)) continue;
    const lineShas = (l.match(SHA_RE) || []).filter((s) => /[0-9]/.test(s) && /[a-f]/.test(s) && s.length >= 7);
    const lineRel = l.match(RELEASE_RE) || [];
    const types = CLAIM_MARKERS.filter((m) => m.re.test(l)).map((m) => m.type);
    if (!types.length) continue;
    // якорь = то, по чему claim можно проверить детерминированно:
    // sha коммита · id релиза · счёт прогона N/N · артефакт (.product) · run-id оркестратора
    const hasAnchor = lineShas.length || lineRel.length || /\d+\/\d+/.test(l)
      || /NOTE-\d+|PA-\d+|DEC-[A-Z]+-\d+|Req-\d+|SC-\d+|FM-\d+/.test(l) || /\brun [a-z0-9]{5,12}\b/i.test(l);
    claimRows.push({
      claim_id: `C${String(++claimSeq).padStart(3, '0')}`, entry_id: e.id, date: e.date,
      claim_type: types[0], types_all: types.join('|'),
      has_anchor: hasAnchor ? 1 : 0, shas: lineShas.join(' '), releases: lineRel.join(' '),
      text: l.replace(/\s+/g, ' ').slice(0, 500), source_ref: `ASSIST_LOG.md:${e.line_start}`,
    });
  }

  // --- тучпойнты владельца (3.2)
  if (/ESCALATE/i.test(full)) {
    const m = full.match(/ESCALATE[^\n]*([\s\S]{0,300})/i);
    touchRows.push({ tp_id: `T${String(++touchSeq).padStart(3, '0')}`, entry_id: e.id, date: e.date, time: e.time, type: 'ESCALATE', what: (m ? m[0] : '').replace(/\s+/g, ' ').slice(0, 300), source_ref: `ASSIST_LOG.md:${e.line_start}` });
  }
  for (const q of quotes) {
    const type = /^го\b|^Го\b|^ГО\b|давай|поехали|делай|сделай|запуст/i.test(q) ? 'GO'
      : /ратифиц|утвержда|принято|согласен/i.test(q) ? 'RATIFY'
        : /проверю|проверил|нашёл|у нас проблема|не работает|ошибка|тупик/i.test(q) ? 'OWNER_FINDING'
          : 'OWNER_UTTERANCE';
    touchRows.push({ tp_id: `T${String(++touchSeq).padStart(3, '0')}`, entry_id: e.id, date: e.date, time: e.time, type, what: q.replace(/\s+/g, ' ').slice(0, 400), source_ref: `ASSIST_LOG.md:${e.line_start}` });
  }
}

writeCsv(path.join(OUT, 'ledger_entries.csv'), ['id', 'run', 'num', 'date', 'time', 'line', 'title', 'mode', 'attention_min', 'has_escalate', 'has_owner_decision', 'has_incident', 'shas', 'releases', 'cond_sessions', 'run_ids', 'pa_refs', 'dec_refs', 'owner_quotes', 'body_len'], entryRows);
writeCsv(path.join(OUT, 'ledger_claims_raw.csv'), ['claim_id', 'entry_id', 'date', 'claim_type', 'types_all', 'has_anchor', 'shas', 'releases', 'text', 'source_ref'], claimRows);
writeCsv(path.join(OUT, 'touchpoints_raw.csv'), ['tp_id', 'entry_id', 'date', 'time', 'type', 'what', 'source_ref'], touchRows);

const byRun = {}; for (const e of entryRows) byRun[e.run] = (byRun[e.run] || 0) + 1;
const byType = {}; for (const c of claimRows) byType[c.claim_type] = (byType[c.claim_type] || 0) + 1;
const byTp = {}; for (const t of touchRows) byTp[t.type] = (byTp[t.type] || 0) + 1;
const attSum = entryRows.reduce((a, e) => a + (Number(e.attention_min) || 0), 0);
console.log('записей ledger:', entryRows.length, byRun);
console.log('claim-кандидатов:', claimRows.length, byType, '| с якорем:', claimRows.filter((c) => c.has_anchor === 1).length);
console.log('тучпойнтов:', touchRows.length, byTp);
console.log('заявленное attention (сумма по записям, мин):', attSum, `= ${(attSum / 60).toFixed(1)} ч`);
console.log('записей с инцидентами:', entryRows.filter((e) => e.has_incident).length, '| с решениями владельца:', entryRows.filter((e) => e.has_owner_decision).length);
