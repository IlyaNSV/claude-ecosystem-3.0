#!/usr/bin/env node
/**
 * context-health.js — чек здоровья КОНТЕКСТА (DEC-DEV-0197).
 *
 * Проверяет то, что видит агент, а не то, что лежит в репо:
 *   1. бюджет резидентного слоя (что едет в КАЖДЫЙ запрос);
 *   2. контракт индекса памяти (строки MEMORY.md — крючки, а не абзацы);
 *   3. контракт записи памяти (запись ~5-10 предложений, не досье);
 *   4. МЁРТВЫЕ УКАЗАТЕЛИ — коммит-хеши, которых нет в git (squash-merge убивает хеш);
 *   5. БИТЫЕ ССЫЛКИ — пути, которые больше не резолвятся (реорганизация файлов);
 *   6. НЕПРОВЕРЯЕМОЕ — утверждения про другие репо/пилот/VM (влияют на поведение, но не фальсифицируемы).
 *
 * Эмпирическое основание (WS-2, аудит 2026-07-12 по 69 транскриптам + 1095 утверждений):
 * дрейф СОДЕРЖАНИЯ ≈ 0 в резиденте и ~9% в памяти, но почти весь он — дрейф УКАЗАТЕЛЕЙ.
 * Память фиксирует координаты (хеши, PR, пути), а координаты протухают при squash-merge и
 * перекладке файлов. Этот скрипт ловит именно это.
 *
 * Использование:
 *   node dev/meta-improvement/scripts/context-health.js            # warn-only (exit 0)
 *   node dev/meta-improvement/scripts/context-health.js --strict   # exit 1 при мёртвых указателях
 *   node dev/meta-improvement/scripts/context-health.js --json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const JSON_OUT = ARGS.includes('--json');

// --- пороги (эмпирические, не откровение; правь осознанно) ---
const T = {
  memoryIndexKB: 6,      // MEMORY.md — индекс однострочных крючков, не досье
  memoryIndexLineChars: 220,
  memoryRecordKB: 8,     // одна запись памяти ~5-10 предложений
  projectClaudeKB: 30,
  globalClaudeKB: 15,
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

// --- ground truth из git ---
let hashes7 = new Set();
try {
  hashes7 = new Set(
    execSync('git log --all --format=%h', { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((h) => h.trim().slice(0, 7)).filter(Boolean)
  );
} catch (_) { /* не git-репо — проверка хешей отключится */ }

// --- базы для резолва путей (память ссылается сокращённо) ---
const PATH_BASES = [REPO, MEM, path.join(REPO, 'dev/meta-improvement'), path.join(REPO, 'dev'), path.join(REPO, 'docs')];

// маркеры «речь про другой репо / машину» → непроверяемо отсюда, но НЕ ложь
const CROSS_RX = /meta-system|product-radar|factory-conductor|Кондуктор|пилот|my-first-test|\bVM\b|виртуалк|Radar/i;

const findings = { budget: [], contract: [], deadPointer: [], brokenLink: [], unverifiable: 0 };
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
  if (over) findings.budget.push(`${r.id}: ${kb(b)} KB > порога ${r.limitKB} KB`);
}

// ---------- сканер утверждений ----------
function scan(file, label) {
  const txt = fs.readFileSync(file, 'utf8');
  const near = (i, w) => txt.slice(Math.max(0, i - w), i + w);

  // мёртвые коммит-указатели: РОВНО 7 hex в бэктиках (конвенция git short hash)
  if (hashes7.size) {
    const seen = new Set();
    for (const m of txt.matchAll(/`([0-9a-f]{7})`/g)) {
      const h = m[1];
      if (seen.has(h)) continue;
      seen.add(h);
      if (hashes7.has(h)) continue;
      if (CROSS_RX.test(near(m.index, 220))) { findings.unverifiable++; continue; }
      findings.deadPointer.push({ where: label, hash: h });
    }
  }

  // битые ссылки на файлы
  const seenP = new Set();
  const rx = /`([\w./~-]+\/[\w.-]+\.(?:md|js|cjs|mjs|yaml|yml|json|sh|ts))`|\]\(([\w./-]+\.(?:md|yaml|yml|js|cjs))\)/g;
  for (const m of txt.matchAll(rx)) {
    const p = (m[1] || m[2]).replace(/^\.\//, '');
    if (seenP.has(p)) continue;
    seenP.add(p);
    if (/^~|^\/home|^[A-Za-z]:|^\.claude\//.test(p)) { findings.unverifiable++; continue; }
    if (PATH_BASES.some((b) => fs.existsSync(path.join(b, p)))) continue;
    if (CROSS_RX.test(near(m.index, 220))) { findings.unverifiable++; continue; }
    findings.brokenLink.push({ where: label, path: p });
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
const problems = dead + broken + findings.budget.length + findings.contract.length;

if (JSON_OUT) {
  console.log(JSON.stringify({ residentKB: kb(residentBytes), budgetRows, memRows, findings, problems }, null, 2));
  process.exit(STRICT && (dead || broken) ? 1 : 0);
}

console.log('\n╭─ CONTEXT HEALTH ' + '─'.repeat(46));
console.log('│');
console.log('│ РЕЗИДЕНТ — едет в КАЖДЫЙ запрос: ' + kb(residentBytes) + ' KB');
for (const r of budgetRows) {
  const val = r.kb === null ? 'нет файла' : r.kb + ' KB';
  console.log('│   ' + (r.over ? '⚠ ' : '  ') + r.id.padEnd(22) + val.padStart(10) + '   (порог ' + r.limit + ' KB)');
}
if (!HAS_MEM) console.log('│   (каталог памяти не найден — проверки памяти пропущены)');
console.log('│');
console.log('│ МЁРТВЫЕ УКАЗАТЕЛИ (коммит-хеш есть в тексте, но нет в git): ' + dead);
findings.deadPointer.slice(0, 12).forEach((d) => console.log('│   ✗ ' + d.hash + '  ← ' + d.where));
if (dead > 12) console.log('│   … ещё ' + (dead - 12));
console.log('│');
console.log('│ БИТЫЕ ССЫЛКИ (путь не резолвится ни по одной базе): ' + broken);
findings.brokenLink.slice(0, 12).forEach((d) => console.log('│   ✗ ' + d.path + '  ← ' + d.where));
if (broken > 12) console.log('│   … ещё ' + (broken - 12));
console.log('│');
if (findings.contract.length) {
  console.log('│ НАРУШЕНИЯ КОНТРАКТА ПАМЯТИ: ' + findings.contract.length);
  findings.contract.slice(0, 10).forEach((c) => console.log('│   ⚠ ' + c.slice(0, 110)));
  if (findings.contract.length > 10) console.log('│   … ещё ' + (findings.contract.length - 10));
  console.log('│');
}
console.log('│ НЕПРОВЕРЯЕМОЕ отсюда (другой репо / пилот / VM): ' + findings.unverifiable);
console.log('│   ↳ класс риска: влияет на поведение, но фальсифицировать нельзя. Держи датированным.');
console.log('│');
console.log('╰─ итог: ' + (problems ? problems + ' замечани(й)я' : 'чисто') + (STRICT ? ' [strict]' : ' [warn-only]'));
console.log('');

process.exit(STRICT && (dead || broken) ? 1 : 0);
