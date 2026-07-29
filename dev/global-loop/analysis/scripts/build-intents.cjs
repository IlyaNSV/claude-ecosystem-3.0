#!/usr/bin/env node
/**
 * build-intents.cjs — M1: реестр интенций владельца с атрибуцией работы (окна).
 *
 * Интенция = содержательное сообщение владельца в хост-сессии прогона (первичный источник —
 * дословный текст из транскрипта, НЕ пересказ в ledger).
 * Окно атрибуции: от интенции до следующей интенции (или +12 ч, что раньше).
 * В окно собираются: executor-сессии (по first_ts), коммиты пилота, токены, wall-clock,
 * записи ledger, процессные прогоны run-ledger.
 *
 * Вердикт «решена/не решена» скрипт НЕ ставит — это суждение, его выносит судья §9 по данным
 * этого файла. Скрипт готовит пакет свидетельств.
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
const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const writeCsv = (file, hdr, rows) => fs.writeFileSync(file, [hdr.join(','), ...rows.map((r) => hdr.map((h) => esc(r[h])).join(','))].join('\n') + '\n');
const num = (r, k) => Number(r[k]) || 0;

const utter = readCsv(path.join(OUT, 'owner_utterances.csv'));
const sessions = readCsv(path.join(OUT, 'sessions.csv'));
const commits = readCsv(path.join(OUT, 'commits.csv'));
const entries = readCsv(path.join(OUT, 'ledger_entries.csv'));
const runLedger = fs.readFileSync(path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-DOCS', 'run_ledger.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// интенции = не-шум, в сессиях прогонов, в окнах RUN-A/RUN-B, тип ≠ QUESTION (вопросы — Q&A-нагрузка, считаются отдельно)
const all = utter.filter((u) => u.in_run_session === '1' && u.is_noise === '0' && ['RUN-A', 'RUN-B'].includes(u.epoch))
  .sort((a, b) => (a.ts < b.ts ? -1 : 1));
// дедуп: одинаковый текст в пределах 10 минут (две хост-сессии видели одно сообщение)
const dedup = [];
for (const u of all) {
  const dup = dedup.find((d) => d.text === u.text && Math.abs(Date.parse(d.ts) - Date.parse(u.ts)) < 10 * 60 * 1000);
  if (!dup) dedup.push(u);
}
const intents = dedup.filter((u) => u.type !== 'QUESTION');
const questions = dedup.filter((u) => u.type === 'QUESTION');
console.log(`сообщений владельца (сигнал): ${all.length} → после дедупа ${dedup.length} → интенций ${intents.length}, вопросов ${questions.length}`);

const execS = sessions.filter((s) => s.layer === 'executor' && s.first_ts).map((s) => ({ ...s, t: Date.parse(s.first_ts) }));
const hostS = sessions.filter((s) => s.layer === 'host' && s.first_ts);
const comm = commits.filter((c) => c.is_merge !== '1').map((c) => ({ ...c, t: Date.parse(c.ts) }));
const runs = runLedger.map((r) => ({ ...r, t: Date.parse(r.started_at) })).filter((r) => !Number.isNaN(r.t));
const led = entries.map((e) => ({ ...e, t: Date.parse(`${e.date}T${e.time || '00:00'}:00+03:00`) }));   // ledger пишет по MSK

const rows = [];
intents.forEach((u, i) => {
  const t0 = Date.parse(u.ts + ':00Z');
  const next = intents[i + 1] ? Date.parse(intents[i + 1].ts + ':00Z') : t0 + 12 * 3600 * 1000;
  const t1 = Math.min(next, t0 + 12 * 3600 * 1000);
  const wSess = execS.filter((s) => s.t >= t0 - 5 * 60 * 1000 && s.t <= t1);
  const wComm = comm.filter((c) => c.t >= t0 && c.t <= t1 + 30 * 60 * 1000);
  const wRuns = runs.filter((r) => r.t >= t0 && r.t <= t1 + 30 * 60 * 1000);
  const wLed = led.filter((e) => e.t >= t0 - 30 * 60 * 1000 && e.t <= t1 + 30 * 60 * 1000);
  const tokExec = wSess.reduce((a, s) => a + num(s, 'tok_out') + num(s, 'subagent_tok_out'), 0);
  const wall = wSess.reduce((a, s) => a + num(s, 'wall_active_min'), 0);
  rows.push({
    intent_id: `I${String(i + 1).padStart(3, '0')}`,
    ts: u.ts, epoch: u.epoch, type: u.type, len: u.len,
    text: u.text,
    window_end: new Date(t1).toISOString().slice(0, 16),
    sessions: wSess.map((s) => s.cond_label || s.session_id.slice(0, 8)).join(' '),
    sessions_n: wSess.length,
    commits: wComm.map((c) => c.sha).slice(0, 12).join(' '),
    commits_n: wComm.length,
    commit_subjects: wComm.map((c) => c.subject).slice(0, 6).join(' | ').slice(0, 600),
    ins: wComm.reduce((a, c) => a + num(c, 'ins'), 0),
    del: wComm.reduce((a, c) => a + num(c, 'del'), 0),
    runtime_lines: wComm.reduce((a, c) => a + num(c, 'runtime_lines'), 0),
    processes: wRuns.map((r) => `${r.process}:${typeof r.verdict === 'object' && r.verdict ? (r.verdict.result || r.verdict.verdict || 'obj') : (r.verdict || r.result || '—')}`).join(' ').slice(0, 300),
    processes_n: wRuns.length,
    tok_out_executor: tokExec,
    wall_active_min: +wall.toFixed(1),
    ledger_entries: wLed.map((e) => e.id).join(' '),
    ledger_titles: wLed.map((e) => e.title).join(' | ').slice(0, 500),
  });
});
writeCsv(path.join(OUT, 'intents.csv'), Object.keys(rows[0]), rows);

const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
console.log(`intents.csv: ${rows.length} интенций`);
console.log(`  с ≥1 сессией: ${rows.filter((r) => r.sessions_n > 0).length} | с ≥1 коммитом: ${rows.filter((r) => r.commits_n > 0).length} | без следов работы: ${rows.filter((r) => r.sessions_n === 0 && r.commits_n === 0).length}`);
console.log(`  суммарно в окнах: коммитов ${sum('commits_n')}, +${sum('ins')}/-${sum('del')} строк, tok_out(exec+sub) ${sum('tok_out_executor').toLocaleString('ru-RU')}, wall ${(sum('wall_active_min') / 60).toFixed(1)} ч`);
// вопросы — отдельной таблицей (Q&A-нагрузка на пульт)
writeCsv(path.join(OUT, 'owner_questions.csv'), ['ts', 'epoch', 'len', 'text'], questions.map((q) => ({ ts: q.ts, epoch: q.epoch, len: q.len, text: q.text })));
console.log(`owner_questions.csv: ${questions.length}`);
