#!/usr/bin/env node
/**
 * verify-claims.cjs — M7: верификация самоотчётов ledger (план §3.4).
 *
 * Стратифицированная выборка claim'ов из ledger_claims_raw.csv → детерминированная проверка КАЖДОГО
 * якоря против фактов:
 *   sha        → git cat-file/log в клоне пилота И в репо экосистемы (ledger-ветка)
 *   release    → список релизов, снятый с VM (DATASET/vm_releases.txt)
 *   счёт N/N   → машинный след в транскриптах сессий, упомянутых в записи (tool_result)
 *   артефакт   → присутствие в дереве пилота (git grep по HEAD + история -S)
 *
 * Выборка ДЕТЕРМИНИРОВАННА (без random): в каждом типе claim'ы сортируются по claim_id и берётся
 * равномерный шаг — воспроизводится побайтно при повторном прогоне.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'DATASET');
const HOME = process.env.USERPROFILE || process.env.HOME;
const PILOT_DOCS = path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-DOCS');
const ECO = path.resolve(ROOT, '..', '..', '..');            // корень worktree экосистемы
const VM_CORPUS = path.join(HOME, 'WebstormProjects', 'vm-harvests', 'VM-CORPUS', '-home-cc-dev-projects-my-first-test');
const PER_TYPE = Number(process.env.PER_TYPE || 10);

// ---------- csv ----------
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

const git = (repo, args) => {
  try { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

// ---------- источники фактов ----------
const releases = new Set(fs.readFileSync(path.join(OUT, 'vm_releases.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
const sessions = readCsv(path.join(OUT, 'sessions.csv'));
const condToFile = new Map();
for (const s of sessions) {
  if (!s.cond_label) continue;
  const key = s.cond_label.replace('-partial', '').replace(/^cond-/, '');
  const f = path.join(VM_CORPUS, `${s.session_id}.jsonl`);
  if (fs.existsSync(f)) condToFile.set(key, f);
}
const entries = readCsv(path.join(OUT, 'ledger_entries.csv'));
const entryById = new Map(entries.map((e) => [e.id, e]));

const transcriptCache = new Map();
/**
 * Возвращает ДВА текста сессии:
 *   observed — только содержимое tool_result (машинный след: что инструменты реально вернули)
 *   stated   — текст ассистента и промптов (что было сказано)
 * Claim о счёте «N/N» засчитывается только по observed: утверждение модели о своём успехе
 * не может подтверждать само себя (анти-ловушка №1 плана).
 */
function transcriptParts(file) {
  if (transcriptCache.has(file)) return transcriptCache.get(file);
  const parts = { observed: '', stated: '' };
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const m = o.message;
      if (!m) continue;
      if (o.type === 'user' && Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c && c.type === 'tool_result') {
            const t = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
            parts.observed += t + '\n';
          }
        }
      } else if (o.type === 'assistant' && Array.isArray(m.content)) {
        for (const c of m.content) if (c && c.type === 'text') parts.stated += c.text + '\n';
      }
      if (o.toolUseResult) parts.observed += (typeof o.toolUseResult === 'string' ? o.toolUseResult : JSON.stringify(o.toolUseResult)) + '\n';
    }
  } catch { /* ignore */ }
  if (transcriptCache.size > 4) transcriptCache.clear();
  transcriptCache.set(file, parts);
  return parts;
}

// ---------- индексы фактов пилота (снимок с VM, read-only) ----------
const dump = fs.readFileSync(path.join(OUT, 'pilot_git_dump.txt'), 'utf8').replace(/\r\n/g, '\n');
const pilotCommits = new Map();   // полный sha -> "date|subject"
for (const line of dump.split('###NUMSTAT')[0].split('\n')) {
  const m = line.match(/^([0-9a-f]{40})\|([^|]+)\|([^|]*)\|([^|]*)\|(.*)$/);
  if (m) pilotCommits.set(m[1], `${m[2].slice(0, 10)}|${m[5].slice(0, 90)}`);
}
const headIdxRaw = fs.readFileSync(path.join(OUT, 'pilot_head_index.txt'), 'utf8').replace(/\r\n/g, '\n');
const pilotHead = new Set(headIdxRaw.split('###FILES')[0].split('\n').map((s) => s.trim()).filter((s) => /^[0-9a-f]{40}$/.test(s)));
const pilotFiles = headIdxRaw.split('###FILES')[1].split('\n').map((s) => s.trim()).filter(Boolean);

// текстовый корпус .product/.kiro пилота (для проверки артефактных ссылок)
const docsCorpus = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(md|yaml|yml|json|txt)$/i.test(e.name)) { try { docsCorpus.push([p, fs.readFileSync(p, 'utf8')]); } catch { /* ignore */ } }
  }
})(PILOT_DOCS);

function findPilotSha(prefix) {
  if (pilotCommits.has(prefix)) return prefix;
  for (const full of pilotCommits.keys()) if (full.startsWith(prefix)) return full;
  return null;
}

// ---------- проверки якорей ----------
function checkSha(sha) {
  const full = findPilotSha(sha);
  if (full) return { ok: true, where: 'pilot', info: pilotCommits.get(full), in_head: pilotHead.has(full) };
  const type = git(ECO, ['cat-file', '-t', sha]);
  if (type === 'commit') {
    const info = git(ECO, ['log', '-1', '--format=%h|%ad|%s', '--date=short', sha]) || '';
    return { ok: true, where: 'ecosystem', info: info.slice(0, 120), in_head: git(ECO, ['merge-base', '--is-ancestor', sha, 'HEAD']) !== null };
  }
  return { ok: false, where: '', info: '', in_head: false };
}
function checkRelease(rel) { return { ok: releases.has(rel) }; }
/** все jsonl сессии: основной транскрипт + субагенты (иначе след прогона теряется — субагенты
 *  делают основную работу, а их файлы лежат отдельно, см. санитарную находку S-1) */
function sessionFiles(mainFile) {
  const out = [mainFile];
  const dir = mainFile.replace(/\.jsonl$/, '');
  const stack = [path.join(dir, 'subagents')];
  while (stack.length) {
    const d = stack.pop();
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith('.jsonl')) out.push(p);
    }
  }
  return out;
}

const execSessions = sessions.filter((s) => s.layer === 'executor' && s.first_ts);
function sessionsNearDate(date) {
  const d = Date.parse(date + 'T00:00:00Z');
  return execSessions
    .filter((s) => Math.abs(Date.parse(s.first_ts) - d) < 36 * 3600 * 1000)
    .map((s) => path.join(VM_CORPUS, `${s.session_id}.jsonl`))
    .filter((f) => fs.existsSync(f));
}

/** формы, в которых один и тот же прогон печатается разными раннерами:
 *  «874/874» ↔ «874 passed» ↔ «Tests  874 passed» ↔ «874 of 874» */
function countForms(countStr) {
  const [n, m] = countStr.split('/');
  const forms = [countStr];
  if (n === m) forms.push(`${n} passed`, `${n} of ${m}`);
  else forms.push(`${n} of ${m}`, `${n}/${m}`);
  return [...new Set(forms)];
}

function checkCount(countStr, entry, claimDate) {
  const forms = countForms(countStr);
  const conds = (entry?.cond_sessions || '').split(' ').filter(Boolean);
  const primary = conds.map((c) => condToFile.get(c)).filter(Boolean);
  const scopes = [
    { name: 'упомянутая сессия', files: primary.flatMap(sessionFiles) },
    { name: 'сессии того же дня', files: sessionsNearDate(claimDate).flatMap(sessionFiles) },
  ];
  let statedOnly = '';
  for (const sc of scopes) {
    if (!sc.files.length) continue;
    for (const f of sc.files) {
      const p = transcriptParts(f);
      const hit = forms.find((form) => p.observed.includes(form));
      if (hit) return { ok: true, note: `машинный след «${hit}» (tool_result) — ${sc.name} ${path.basename(f).slice(0, 10)}` };
      if (!statedOnly && forms.some((form) => p.stated.includes(form))) statedOnly = `${sc.name} ${path.basename(f).slice(0, 10)}`;
    }
  }
  if (statedOnly) return { ok: false, note: `счёт «${countStr}» есть только в СЛОВАХ (${statedOnly}), машинного следа в tool_result нет` };
  if (!scopes.some((s) => s.files.length)) return { ok: null, note: 'нет транскриптов для проверки' };
  return { ok: false, note: `счёт «${countStr}» не найден ни в одной сессии окна` };
}
// --- run-ledger оркестратора: машинная запись КАЖДОГО процессного прогона (verdict/readiness/counts)
const runLedger = [];
try {
  for (const l of fs.readFileSync(path.join(PILOT_DOCS, 'run_ledger.ndjson'), 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { runLedger.push(JSON.parse(l)); } catch { /* ignore */ }
  }
} catch { /* нет файла — проверки run-id станут UNVERIFIABLE */ }

/** claim вида «run xgi11c … GO × READY» проверяется записью в run-ledger, а не словами сессии */
function checkRunId(id, claimText) {
  const rec = runLedger.find((r) => String(r.run_id || '').endsWith(id));
  if (!rec) return { ok: false, note: `run «${id}» отсутствует в run-ledger пилота` };
  const parts = [`процесс ${rec.process}, статус ${rec.status}`];
  let mismatch = false;
  // verdict в ledger бывает строкой ИЛИ объектом (структурный вердикт процесса) — нормализуем
  const vObj = rec.verdict && typeof rec.verdict === 'object' ? rec.verdict : null;
  const verdictStr = String(vObj ? (vObj.result || vObj.verdict || rec.result || '') : (rec.verdict || rec.result || ''));
  const readinessStr = String(rec.readiness || (vObj && vObj.readiness) || '');
  const claimHas = (re) => re.test(claimText);
  // Сверяем только ПРЯМЫЕ противоречия по оси вердикта (GO ↔ NO-GO / PASS ↔ FAIL).
  // Разные процессы кладут исход в разные поля (P7: verdict=READY_TO_SMOKE, исход смоука — в result),
  // поэтому «токен из claim не найден в поле X» само по себе расхождением НЕ считается.
  const allValues = [verdictStr, readinessStr, JSON.stringify(rec.result || ''), vObj ? JSON.stringify(vObj).slice(0, 2000) : ''].join(' ');
  const claimNoGo = claimHas(/\bNO-GO\b/i);
  const claimGo = !claimNoGo && claimHas(/(^|[^-\w])GO\b/);
  if (claimNoGo && /(^|[^-])\bGO\b/.test(allValues) && !/NO-GO/i.test(allValues)) mismatch = true;
  if (claimGo && /NO-GO/i.test(allValues) && !/(^|[^-])\bGO\b/.test(allValues.replace(/NO-GO/gi, ''))) mismatch = true;
  if (verdictStr) parts.push(`verdict=${verdictStr}`);
  if (readinessStr) parts.push(`readiness=${readinessStr}`);
  if (rec.conflicts !== null && rec.conflicts !== undefined) parts.push(`conflicts=${rec.conflicts}`);
  return { ok: !mismatch, note: (mismatch ? 'РАСХОЖДЕНИЕ с ledger: ' : 'подтверждён run-ledger: ') + parts.join(', ') };
}

function checkArtifact(ref) {
  // 1) файл с таким именем в дереве HEAD пилота
  if (pilotFiles.some((f) => f.includes(ref))) return { ok: true, note: 'файл в дереве HEAD пилота' };
  // 2) упоминание в .product/.kiro (снимок HEAD)
  const hit = docsCorpus.find(([, t]) => t.includes(ref));
  if (hit) return { ok: true, note: `упомянут в ${path.relative(PILOT_DOCS, hit[0]).replace(/\\/g, '/')}` };
  // 3) упоминание в subject'ах коммитов пилота
  for (const [, v] of pilotCommits) if (v.includes(ref)) return { ok: true, note: 'в subject коммита пилота' };
  // 4) репо экосистемы
  const inEco = git(ECO, ['grep', '-l', '--', ref, 'HEAD']);
  if (inEco) return { ok: true, note: 'в репо экосистемы' };
  return { ok: false, note: 'не найден ни в пилоте, ни в экосистеме' };
}

// ---------- выборка ----------
const all = readCsv(path.join(OUT, 'ledger_claims_raw.csv'));
const types = ['code-fix', 'deploy', 'test-pass', 'doc-sync'];
const sample = [];
for (const t of types) {
  const pool = all.filter((c) => c.claim_type === t && c.has_anchor === '1').sort((a, b) => a.claim_id.localeCompare(b.claim_id));
  const need = Math.min(PER_TYPE, pool.length);
  const step = Math.max(1, Math.floor(pool.length / need));
  for (let i = 0, k = 0; k < need && i < pool.length; i += step, k++) sample.push(pool[i]);
}
console.log(`выборка M7: ${sample.length} claim'ов (по типам: ${types.map((t) => `${t}=${sample.filter((s) => s.claim_type === t).length}`).join(', ')})`);

// ---------- прогон ----------
const rows = [];
for (const c of sample) {
  const entry = entryById.get(c.entry_id);
  const checks = [];
  let pass = 0, fail = 0, unk = 0;

  for (const sha of (c.shas || '').split(' ').filter(Boolean)) {
    const r = checkSha(sha);
    checks.push(`sha ${sha}: ${r.ok ? `OK (${r.where}${r.in_head ? ', в HEAD' : ', НЕ в HEAD'}) ${r.info}` : 'НЕ НАЙДЕН'}`);
    r.ok ? pass++ : fail++;
  }
  for (const rel of (c.releases || '').split(' ').filter(Boolean)) {
    const r = checkRelease(rel);
    checks.push(`release ${rel}: ${r.ok ? 'существует на VM' : 'НЕТ на VM'}`);
    r.ok ? pass++ : fail++;
  }
  // [POST-HOC 2026-07-29] Счётом прогона считается «N/M» ТОЛЬКО если рядом маркер прогона
  // или N==M. Причина уточнения: первый прогон засчитывал за «счёт» номера артефактов
  // («PA-102/103») и прогресс задач («tasks.md:156/182») — ложные срабатывания метода, а не
  // ложь ledger. Правило объявлено формально и применяется ко всем claim'ам одинаково.
  const TEST_CTX = /(PASS|passed|тест|test|ассерт|сьют|suite|UJA|journey|журне|specs?|прогон|зелён|GREEN)/i;
  const counts = [...c.text.matchAll(/\b(\d+)\/(\d+)\b/g)]
    .filter((m) => {
      // прогресс задач («tasks.md:156/182») и номера артефактов («PA-102/103») — не счёт прогона
      const left = c.text.slice(Math.max(0, m.index - 40), m.index);
      if (/tasks?(\.md)?[:\s]*$|PA-\d*$|NOTE-\d*$|Req-\d*$|-$/.test(left)) return false;
      return m[1] === m[2] || TEST_CTX.test(c.text.slice(Math.max(0, m.index - 60), m.index + 60));
    })
    .map((m) => m[0]).slice(0, 2);
  for (const cnt of counts) {
    const r = checkCount(cnt, entry, c.date);
    if (r.ok === null) { checks.push(`счёт ${cnt}: не проверен (${r.note})`); unk++; }
    else { checks.push(`счёт ${cnt}: ${r.ok ? 'подтверждён — ' + r.note : 'НЕ ПОДТВЕРЖДЁН — ' + r.note}`); r.ok ? pass++ : fail++; }
  }
  for (const rid of [...new Set([...c.text.matchAll(/\brun (?:id )?([a-z0-9]{5,12})\b/gi)].map((m) => m[1]))].slice(0, 2)) {
    const r = checkRunId(rid, c.text);
    checks.push(`run ${rid}: ${r.note}`);
    r.ok ? pass++ : fail++;
  }
  const arts = [...c.text.matchAll(/\b(NOTE-\d+|PA-\d+|DEC-[A-Z]+-\d+|Req-\d+|SC-\d+|FM-\d+)\b/g)].map((m) => m[0]).slice(0, 3);
  for (const a of [...new Set(arts)]) {
    const r = checkArtifact(a);
    checks.push(`артефакт ${a}: ${r.ok ? 'найден — ' + r.note : 'НЕ НАЙДЕН'}`);
    r.ok ? pass++ : fail++;
  }

  const verdict = (pass + fail + unk) === 0 ? 'UNVERIFIABLE'
    : fail === 0 && pass > 0 ? 'TRUE'
      : pass > 0 && fail > 0 ? 'PARTIAL'
        : fail > 0 ? 'FALSE' : 'UNVERIFIABLE';
  rows.push({
    claim_id: c.claim_id, claim_type: c.claim_type, entry_id: c.entry_id, date: c.date,
    claim_text: c.text, source_ref: c.source_ref,
    anchors_checked: pass + fail + unk, anchors_ok: pass, anchors_failed: fail, anchors_unknown: unk,
    verdict, evidence: checks.join(' ; ').slice(0, 900),
  });
  process.stdout.write(verdict === 'TRUE' ? '.' : verdict === 'PARTIAL' ? 'p' : verdict === 'FALSE' ? 'F' : '?');
}
console.log('');

writeCsv(path.join(OUT, 'claims.csv'), ['claim_id', 'claim_type', 'entry_id', 'date', 'claim_text', 'source_ref', 'anchors_checked', 'anchors_ok', 'anchors_failed', 'anchors_unknown', 'verdict', 'evidence'], rows);

const byV = {}; for (const r of rows) byV[r.verdict] = (byV[r.verdict] || 0) + 1;
console.log('\nвердикты:', byV);
for (const t of types) {
  const g = rows.filter((r) => r.claim_type === t);
  const ver = g.filter((r) => r.verdict !== 'UNVERIFIABLE');
  const tr = g.filter((r) => r.verdict === 'TRUE');
  console.log(`  ${t}: n=${g.length} верифицируемых=${ver.length} TRUE=${tr.length} accuracy=${ver.length ? (tr.length / ver.length).toFixed(3) : '—'}`);
}
const ver = rows.filter((r) => r.verdict !== 'UNVERIFIABLE');
console.log(`ИТОГО claim-accuracy = ${(rows.filter((r) => r.verdict === 'TRUE').length / ver.length).toFixed(3)} (n=${ver.length} верифицируемых из ${rows.length})`);
