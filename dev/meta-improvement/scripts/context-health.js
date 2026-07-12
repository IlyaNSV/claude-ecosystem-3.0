#!/usr/bin/env node
/**
 * context-health.js — чек здоровья КОНТЕКСТА (DEC-DEV-0197).
 *
 * Проверяет то, что видит агент, а не то, что лежит в репо:
 *   1. бюджет резидентного слоя (что едет в КАЖДЫЙ запрос);
 *   2. контракт индекса памяти (строки MEMORY.md — крючки, а не абзацы);
 *   3. контракт записи памяти (запись ~5-10 предложений, не досье);
 *   4. МЁРТВЫЕ УКАЗАТЕЛИ — коммит-хеши, которых нет НИГДЕ (ни в одном репо на диске);
 *   5. БИТЫЕ ССЫЛКИ — пути, которые больше не резолвятся (реорганизация файлов);
 *   6. классы, которые НЕ являются ложью: cross-repo · historical · planned · unverifiable.
 *
 * Эмпирическое основание (аудит 2026-07-12, DEC-DEV-0197): дрейфует не СОДЕРЖАНИЕ памяти,
 * а КООРДИНАТЫ (хеши, пути) — их убивает squash-merge и перекладка файлов.
 *
 * ⚠ ПОЧЕМУ КЛАССОВ ШЕСТЬ, А НЕ ДВА (D4, 2026-07-13). Первая версия скрипта объявила
 * «23 мёртвых хеша». Проверка каждого показала: реально мёртв ОДИН. Остальные — живые
 * коммиты СОСЕДНИХ репо (пилот, meta-system) и честные исторические координаты
 * («непушнутый локальный коммит», «amend, новый хеш вместо…»). Инструмент врал в 22
 * случаях из 23, и strict-гейт на нём заставил бы стирать ВЕРНЫЕ записи. Отсюда правило:
 * strict падает ТОЛЬКО на фактической неправде, а всё, что merely «не резолвится отсюда»,
 * получает свой класс и не блокирует.
 *
 * Использование:
 *   node dev/meta-improvement/scripts/context-health.js            # warn-only (exit 0)
 *   node dev/meta-improvement/scripts/context-health.js --strict   # exit 1 при РЕАЛЬНОЙ неправде
 *   node dev/meta-improvement/scripts/context-health.js --json
 *
 * Аварийный тумблер (для параллельных сессий): CONTEXT_HEALTH_STRICT=0 — снимает strict,
 * чтобы чужая незакрытая координата не блокировала твой цикл.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict') && process.env.CONTEXT_HEALTH_STRICT !== '0';
const JSON_OUT = ARGS.includes('--json');

// --- пороги (эмпирические, не откровение; правь осознанно) ---
// NB: бюджетные пороги — ОРИЕНТИР, а не гейт. Аудит показал: кэш хитает 99,6% ходов,
// рез резидента вдвое экономит 2,7%. Экономический довод за резку мёртв ⇒ бюджет
// НИКОГДА не уводит в exit 1, даже под --strict.
const T = {
  memoryIndexKB: 6,
  memoryIndexLineChars: 220,
  memoryRecordKB: 8,
  projectClaudeKB: 30,
  globalClaudeKB: 15,
};

const sh = (cmd, cwd) => {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim(); }
  catch (_) { return ''; }
};

// --- где лежит память: Claude Code кодирует cwd в слаг ---
function memoryDir() {
  const explicit = ARGS.find((a) => a.startsWith('--memory-dir='));
  if (explicit) return explicit.slice('--memory-dir='.length);
  const slug = REPO.replace(/[\\/:.]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', slug, 'memory');
}

const MEM = memoryDir();
const HAS_MEM = fs.existsSync(MEM);

// ---------- ground truth #1: хеши ЭТОГО репо ----------
const hashes7 = new Set(
  sh('git log --all --format=%h', REPO).split('\n').map((h) => h.trim().slice(0, 7)).filter(Boolean)
);

// ---------- ground truth #2: хеши СОСЕДНИХ репо ----------
// Память легально ссылается на коммиты пилота / meta-system / product-radar / фабрики.
// Раньше их ловил CROSS-регексп по словам рядом — и промахивался, когда слово было дальше
// 220 символов. Теперь проверяем ФАКТ: есть ли такой коммит в соседнем репо на диске.
const siblings = new Map(); // name -> Set(hash7)
function loadSiblings() {
  const explicit = ARGS.find((a) => a.startsWith('--siblings='));
  const parent = path.dirname(REPO);
  let dirs;
  if (explicit) {
    dirs = explicit.slice('--siblings='.length).split(',').filter(Boolean);
  } else {
    if (!fs.existsSync(parent)) return;
    dirs = fs.readdirSync(parent, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(parent, d.name))
      .filter((d) => d !== REPO && fs.existsSync(path.join(d, '.git')));
  }
  for (const dir of dirs) {
    const out = sh('git log --all --format=%h', dir);
    if (!out) continue;
    siblings.set(path.basename(dir), new Set(out.split('\n').map((h) => h.trim().slice(0, 7)).filter(Boolean)));
  }
}
loadSiblings();

function findSibling(h) {
  for (const [name, set] of siblings) if (set.has(h)) return name;
  return null;
}
// объект есть в этом репо, но недостижим из refs (непушнутый / amend'нутый / squash-мёрженный)
const isHistorical = (h) => sh(`git cat-file -t ${h}`, REPO) === 'commit';

// ---------- ground truth #3: пути ----------
const PATH_BASES = [REPO, MEM, path.join(REPO, 'dev/meta-improvement'), path.join(REPO, 'dev'), path.join(REPO, 'docs')];
const tracked = sh('git ls-files', REPO).split('\n').filter(Boolean);
const byBasename = new Map();
for (const t of tracked) {
  const b = path.basename(t);
  if (!byBasename.has(b)) byBasename.set(b, []);
  byBasename.get(b).push(t);
}
// все пути, когда-либо существовавшие в истории — чтобы отличить «переехал» от «не было никогда»
const everPaths = new Set(sh('git log --all --pretty=format: --name-only', REPO).split('\n').map((s) => s.trim()).filter(Boolean));

// зоны, которые физически НЕ могут лежать в этом репо → не ложь, а другой адресат
const NOT_OUR_REPO = /^~|^\/home|^[A-Za-z]:|^\.claude\/|^\.product\/|^AppData\/|^Users\//;
const PLACEHOLDER = /YYYY|MM-DD|NNN|<[^>]*>|\*/;
// маркеры «речь про другой репо / машину» → непроверяемо отсюда, но НЕ ложь
const CROSS_RX = /meta-system|product-radar|factory-conductor|Кондуктор|пилот|my-first-test|\bVM\b|виртуалк|Radar/i;

const findings = {
  budget: [], contract: [],
  deadPointer: [],   // ← РЕАЛЬНАЯ неправда: хеша нет нигде
  brokenLink: [],    // ← РЕАЛЬНАЯ неправда: файл был, но координата протухла
  crossRepo: [], historical: [], phantom: [], unverifiable: 0,
};
const kb = (b) => +(b / 1024).toFixed(1);

// ---------- 1. бюджет резидента ----------
const resident = [
  { id: 'global CLAUDE.md', file: path.join(os.homedir(), '.claude', 'CLAUDE.md'), limitKB: T.globalClaudeKB },
  { id: 'project CLAUDE.md', file: path.join(REPO, 'CLAUDE.md'), limitKB: T.projectClaudeKB },
  { id: 'MEMORY.md (индекс)', file: path.join(MEM, 'MEMORY.md'), limitKB: T.memoryIndexKB },
];
const budgetRows = [];
let residentBytes = 0;
for (const r of resident) {
  if (!fs.existsSync(r.file)) { budgetRows.push({ id: r.id, kb: null, limit: r.limitKB, over: false }); continue; }
  const b = fs.statSync(r.file).size;
  residentBytes += b;
  const over = kb(b) > r.limitKB;
  budgetRows.push({ id: r.id, kb: kb(b), limit: r.limitKB, over });
  if (over) findings.budget.push(`${r.id}: ${kb(b)} KB > ориентира ${r.limitKB} KB`);
}

// ---------- сканер утверждений ----------
function scan(file, label) {
  const txt = fs.readFileSync(file, 'utf8');
  const near = (i, w) => txt.slice(Math.max(0, i - w), i + w);

  // коммит-указатели: РОВНО 7 hex в бэктиках (конвенция git short hash)
  const seenH = new Set();
  for (const m of txt.matchAll(/`([0-9a-f]{7})`/g)) {
    const h = m[1];
    if (seenH.has(h)) continue;
    seenH.add(h);
    if (hashes7.has(h)) continue;                                    // жив здесь
    const sib = findSibling(h);
    if (sib) { findings.crossRepo.push({ where: label, hash: h, repo: sib }); continue; }
    if (isHistorical(h)) { findings.historical.push({ where: label, hash: h }); continue; }
    if (CROSS_RX.test(near(m.index, 220))) { findings.unverifiable++; continue; }
    findings.deadPointer.push({ where: label, hash: h });             // ← нет НИГДЕ
  }

  // ссылки на файлы
  const seenP = new Set();
  const rx = /`([\w./~-]+\/[\w.-]+\.(?:md|js|cjs|mjs|yaml|yml|json|sh|ts))`|\]\(([\w./-]+\.(?:md|yaml|yml|js|cjs))\)/g;
  for (const m of txt.matchAll(rx)) {
    const p = (m[1] || m[2]).replace(/^\.\//, '');
    if (seenP.has(p)) continue;
    seenP.add(p);
    if (NOT_OUR_REPO.test(p) || PLACEHOLDER.test(p)) { findings.unverifiable++; continue; }
    if (PATH_BASES.some((b) => fs.existsSync(path.join(b, p)))) continue;
    if (CROSS_RX.test(near(m.index, 220))) { findings.unverifiable++; continue; }

    const hits = byBasename.get(path.basename(p)) || [];
    if (hits.length) { findings.brokenLink.push({ where: label, path: p, movedTo: hits }); continue; }
    if (everPaths.has(p)) { findings.brokenLink.push({ where: label, path: p, movedTo: [] }); continue; }
    findings.phantom.push({ where: label, path: p });                 // не существовал НИКОГДА → план или выдумка
  }
}

const claudeMd = path.join(REPO, 'CLAUDE.md');
if (fs.existsSync(claudeMd)) scan(claudeMd, 'CLAUDE.md');

// ---------- 2-3. контракты памяти + скан записей ----------
const memRows = [];
if (HAS_MEM) {
  const idx = path.join(MEM, 'MEMORY.md');
  if (fs.existsSync(idx)) {
    scan(idx, 'MEMORY.md');
    const long = fs.readFileSync(idx, 'utf8').split('\n')
      .map((l, i) => ({ n: i + 1, len: l.length }))
      .filter((l) => l.len > T.memoryIndexLineChars);
    if (long.length) {
      findings.contract.push(
        `MEMORY.md: ${long.length} строк(и) длиннее ${T.memoryIndexLineChars} симв. — индекс должен быть ` +
        `однострочными крючками ("- [Title](file.md) — hook"), а не досье. Строки: ` +
        long.slice(0, 8).map((l) => `${l.n} (${l.len})`).join(', ')
      );
    }
  }
  for (const f of fs.readdirSync(MEM).filter((x) => x.endsWith('.md') && x !== 'MEMORY.md')) {
    const file = path.join(MEM, f);
    const b = fs.statSync(file).size;
    scan(file, 'memory/' + f);
    memRows.push({ f, kb: kb(b) });
    if (kb(b) > T.memoryRecordKB) {
      findings.contract.push(`memory/${f}: ${kb(b)} KB > ${T.memoryRecordKB} KB — запись раздута (правило: ~5-10 предложений; историю выноси в архивную запись)`);
    }
  }
}

// ---------- отчёт ----------
const dead = findings.deadPointer.length;
const broken = findings.brokenLink.length;
const lies = dead + broken;                       // ← ТОЛЬКО это блокирует
const problems = lies + findings.budget.length + findings.contract.length;

if (JSON_OUT) {
  console.log(JSON.stringify({ residentKB: kb(residentBytes), budgetRows, memRows, findings, lies, problems }, null, 2));
  process.exit(STRICT && lies ? 1 : 0);
}

console.log('\n╭─ CONTEXT HEALTH ' + '─'.repeat(46));
console.log('│');
console.log('│ РЕЗИДЕНТ — едет в КАЖДЫЙ запрос: ' + kb(residentBytes) + ' KB');
for (const r of budgetRows) {
  const val = r.kb === null ? 'нет файла' : r.kb + ' KB';
  console.log('│   ' + (r.over ? '~ ' : '  ') + r.id.padEnd(22) + val.padStart(10) + '   (ориентир ' + r.limit + ' KB)');
}
if (!HAS_MEM) console.log('│   (каталог памяти не найден — проверки памяти пропущены)');
console.log('│   ↳ ориентир, НЕ гейт: кэш хитает 99,6% ходов, рез вдвое = 2,7% экономии (DEC-DEV-0197)');
console.log('│');

console.log('│ ✗ МЁРТВЫЕ УКАЗАТЕЛИ — хеша нет НИ В ОДНОМ репо на диске: ' + dead);
findings.deadPointer.slice(0, 12).forEach((d) => console.log('│     ' + d.hash + '  ← ' + d.where));
if (dead > 12) console.log('│     … ещё ' + (dead - 12));
console.log('│');

console.log('│ ✗ БИТЫЕ ССЫЛКИ — файл существует, координата протухла: ' + broken);
findings.brokenLink.slice(0, 12).forEach((d) => {
  const to = d.movedTo.length === 1 ? '  → переехал: ' + d.movedTo[0]
    : d.movedTo.length ? '  → кандидаты: ' + d.movedTo.slice(0, 2).join(' , ') : '  → удалён из репо';
  console.log('│     ' + d.path + to);
});
if (broken > 12) console.log('│     … ещё ' + (broken - 12));
console.log('│');

if (findings.contract.length) {
  console.log('│ ~ КОНТРАКТ ПАМЯТИ (гигиена, НЕ гейт): ' + findings.contract.length);
  findings.contract.slice(0, 6).forEach((c) => console.log('│     ' + c.slice(0, 108)));
  if (findings.contract.length > 6) console.log('│     … ещё ' + (findings.contract.length - 6));
  console.log('│');
}

console.log('│ ✓ НЕ ЛОЖЬ — координаты, которые просто не резолвятся ОТСЮДА:');
console.log('│     cross-repo (коммит найден в соседнем репо): ' + findings.crossRepo.length +
            (siblings.size ? '   [проверено репо: ' + siblings.size + ']' : ''));
console.log('│     historical (объект есть, но недостижим из refs — непушнутый / amend / squash): ' + findings.historical.length);
console.log('│     planned (путь не существовал НИКОГДА — проектируемый артефакт либо выдумка, проверь): ' + findings.phantom.length);
findings.phantom.slice(0, 4).forEach((d) => console.log('│       · ' + d.path + '  ← ' + d.where));
console.log('│     unverifiable (другой репо / пилот / VM / зона пользовательского проекта): ' + findings.unverifiable);
console.log('│');

console.log('╰─ итог: ' + (lies ? lies + ' фактическ(ая/их) неправд(а/ы)' : 'фактической неправды нет') +
            (problems - lies ? ' · ' + (problems - lies) + ' замечани(е/й) гигиены' : '') +
            (STRICT ? ' [strict]' : ' [warn-only]'));
if (lies && STRICT) {
  console.log('');
  console.log('  Чинить так: координата в памяти протухла — обнови её ИЛИ убери, оставив факт.');
  console.log('  Правило (DEC-DEV-0197): память пишет РЕШЕНИЯ и УРОКИ, а не КООРДИНАТЫ.');
  console.log('  Долгоживущий якорь — номер PR (#184), а не short-hash: squash-merge убивает хеш.');
  console.log('  Чужая незакрытая координата блокирует твой цикл? → CONTEXT_HEALTH_STRICT=0 npm run verify');
}
console.log('');

process.exit(STRICT && lies ? 1 : 0);
