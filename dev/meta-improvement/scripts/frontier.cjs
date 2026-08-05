#!/usr/bin/env node
/**
 * frontier — read-side сводка «фронтира» репо: что открыто, чем заблокировано, где статусы разошлись.
 *
 * ── ПОЧЕМУ ПРОИЗВОДНЫЙ ОТЧЁТ, А НЕ РЕЕСТР ──
 * Открытые решения и блокировки живут в каноне ПО-ДОКУМЕНТНО: `status:` в шапке шва/трека,
 * маркер `Gated:` в теле плана, таблица «Открытые решения» в SPEC модуля, список OQ-* в
 * протоколе. Сводного среза поперёк них нет ни одного — а завести его write-side'ом запрещает
 * DEC-DEV-0227: «ручной реестр состояния обречён отставать» (dev/README.md:16). Живой
 * прецедент цены: `dev/global-loop/SEAM.md` пять суток стоял CLOSED рядом с PLAN.md ACTIVE, и
 * заметить это было нечем. Поэтому фронтир не ВЕДЁТСЯ, а ВЫЧИСЛЯЕТСЯ при каждом запуске из
 * маркеров, которые и так пишутся. SSOT остаётся на своём месте; этот скрипт только читает.
 *
 * ── ПОСТУРА ──
 * WARN-ONLY НАВСЕГДА, exit 0 всегда: это ОТЧЁТ, не гейт. Гейт обязан быть точным, а фронтир
 * набирается эвристиками поверх свободной прозы — цена ложного срабатывания здесь «прочитал
 * лишнюю строку», а в гейте «остановил всем коммиты». Встраивание в `npm run verify` — решение
 * владельца, не автора скрипта.
 * Закрытые треки в секциях ③-④ ПРОПУСКАЮТСЯ: блокировки закрытого трека — это история, а не
 * фронтир. Регексы намеренно УЗКИЕ (урок check-counts.js): пропущенная строка = один документ
 * не попал в сводку, ложная = сводка, которой перестают верить.
 *
 * ── ЧЕГО ЗДЕСЬ НЕТ (v1, честно) ──
 * Маркеры пилотных проектов (PA-NNN парковки Process Fabric, чекбоксы `.kiro` tasks.md) —
 * вне скоупа: они живут в продуктовом проекте, а не в каноне экосистемы.
 *
 * Usage: node dev/meta-improvement/scripts/frontier.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function repoRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { return process.cwd(); }
}
const ROOT = repoRoot();

// dev/ — треки и протоколы, docs/ — модульные SPEC с таблицами «Открытые решения».
// _archive исключён по той же причине, что и в check-links: там история, и она имеет право
// быть «незакрытой» навсегда.
const SCAN_ROOTS = ['dev', 'docs'];
const EXCLUDE = /(^|[\\/])(_archive|node_modules|\.git)([\\/]|$)/;
const TRACK_FILES = new Set(['SEAM.md', 'TRACK.md', 'PLAN.md', 'NEXT-HORIZON.md']);

// Статус читается ТОЛЬКО из шапки (первые 10 строк): ниже по телу «status:» встречается в
// цитатах, примерах и таблицах состояния, и это уже не статус документа.
const HEAD_LINES = 10;
const STATUS_RE = /^\s*>?\s*\*{0,2}status\*{0,2}\s*:\s*\*{0,2}\s*([A-Za-zА-Яа-яЁё][\w-]*)/i;
const TERMINAL = new Set(['CLOSED', 'SUPERSEDED', 'EXECUTED', 'DONE', 'ARCHIVED', 'ЗАКРЫТ']);
// «Живой» ≠ «не терминальный»: NOTE — это заметка на будущее, она трек не оживляет.
const LIVE = new Set(['ACTIVE', 'RATIFIED', 'PROPOSED', 'DRAFT', 'OPEN', 'WIP', 'IN_PROGRESS']);

// Ребро блокировки. Два разреза, оба обязательны:
//   `(?<![A-Za-z0-9-])` — отсекает суффиксную форму («event-gated», «human-gated», «DoR-gated»,
//     «gap-gated»): там «gated» — прилагательное режима, а не объявление живой блокировки.
//     `_` намеренно РАЗРЕШЁН — им начинается `_Blocked:`.
//   `(?!\s*[[{])` после двоеточия — отсекает поле данных: в ledger'ах прогонов встречается
//     `blocked:[]`, и это результат, а не ребро.
// Формы приняты по факту корпуса, а не по догадке: `**Gated:**` (vm-observability SEAM),
// `gated: вход — «го»` (release-dod TRACK), `gated на явное «го»` (host-console TRACK),
// `gated — НЕ стартует` и `**gated**` (dev/plans/TIER_2_DOC_REFORM_PLAN).
// Голое `**…**` засчитывается ТОЛЬКО для `gated`: `**blocked**`/`**BLOCKED**` в этом репо —
// имя значения статуса в спеке и ячейка в отчёте о прогоне, а не блокировка работы.
// NB `\s+на\s`, а не `\s+на\b`: JS `\b` работает по ASCII и границу кириллического слова
// не ставит — `на\b` перед пробелом не срабатывает НИКОГДА (эта опечатка молча съедала
// host-console TRACK.md:3 при первом прогоне).
const EDGE_RE =
  /(?<![A-Za-z0-9-])(?:gated(?:\s*:(?!\s*[[{])|\s*[—–]|\s+на\s|\*\*)|(?:blocked|заблокирован[а-я]*)(?:\s*:(?!\s*[[{])|\s*[—–]|\s+на\s))/i;

// Идентификаторы открытых вопросов. ФАКТИЧЕСКИЙ формат, не предполагаемый: в
// docs/orchestrator-module/SPEC.md §9 это `**OD1**`..`**OD10**` (без дефиса), в
// dev/deferred/CONTEXT_SEAM_PROTOCOL.md §8 и модульных SPEC — `OQ-CS-01`, `OQ-DM-02`, `OQ-PM-05`.
// Идентификатор должен ОТКРЫВАТЬ строку (после «- », «| », «**»): «см. OQ-DM-02» в середине
// фразы — ссылка на вопрос, а не его объявление.
const DECL_RE = /^\s*(?:\|\s*)?(?:[-*+]\s+)?\*{0,2}(OD-?\d{1,3}|OQ-[A-Z]{1,4}-\d{1,3})\b/;
// …и отделяться от текста разделителем объявления (`:`, `|`, тире, закрывающий `**`).
// «OD7. Диспетчер запарковал бы сам» и «OQ-DW-02 (может измениться pricing)» — это ссылки
// на вопрос из отчёта о прогоне и из бэклога, а не сами вопросы; их дом — SSOT-документ.
const DECL_TAIL_RE = /^\*{0,2}\s*(?::|\||[—–])/;
// Терминальность статуса. Проверяется по ~120 символам ПОСЛЕ идентификатора (в таблице — по
// последней ячейке): дальше в строке идут обоснования и ссылки, где те же слова значат другое.
const RESOLVED_RE = /✅|разреш[ёе]н|реш[ёе]н|принят|построен|реализован|исполнен|закрыт|отброшен|resolved|closed|\bdone\b/i;
// «Частично разрешён» — это открытый вопрос с историей, а не закрытый (OQ-DM-02: partially
// resolved, остаток вынесен в OQ-DM-07). Оговорка бьёт терминальное слово.
const PARTIAL_RE = /частичн|partial/i;

// ─────────────────────────────────────────────────────────────────────────────
// Сбор файлов
// ─────────────────────────────────────────────────────────────────────────────
const files = [];
function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (EXCLUDE.test(rel) || !fs.existsSync(abs)) return;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(rel, e.name);
    if (EXCLUDE.test(child)) continue;
    if (e.isDirectory()) walk(child);
    else if (e.name.endsWith('.md')) files.push(child.replace(/\\/g, '/'));
  }
}
for (const r of SCAN_ROOTS) walk(r);
files.sort();

const read = rel => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } };

// ─────────────────────────────────────────────────────────────────────────────
// ① Треки — статус каждого файла-трека из шапки
// ─────────────────────────────────────────────────────────────────────────────
const tracks = new Map();   // 'dev/<track>' → [{ name, status }]
for (const rel of files) {
  if (!rel.startsWith('dev/') || !TRACK_FILES.has(path.posix.basename(rel))) continue;
  const text = read(rel);
  if (text === null) continue;
  const head = text.split('\n').slice(0, HEAD_LINES).join('\n');
  const m = head.match(new RegExp(STATUS_RE.source, 'im'));
  const dir = path.posix.dirname(rel);
  if (!tracks.has(dir)) tracks.set(dir, []);
  tracks.get(dir).push({ name: path.posix.basename(rel), status: m ? m[1].toUpperCase() : '—' });
}

// Трек закрыт, когда есть терминальный файл и НЕТ ни одного живого. Такой трек выпадает из
// секций ③-④: его рёбра и вопросы — часть истории, а не то, обо что упирается работа сейчас.
const closedDirs = new Set();
const mismatches = [];
for (const [dir, entries] of tracks) {
  const st = entries.map(e => e.status);
  const terminal = st.filter(s => TERMINAL.has(s));
  const live = st.filter(s => LIVE.has(s));
  if (terminal.length && !live.length) closedDirs.add(dir);
  // Пара «терминальный ↔ ACTIVE» выделена из всех живых статусов не из осторожности:
  // именно на `status: ACTIVE` завязан seam-reinject-compact.js, и именно поэтому забытый
  // ACTIVE в закрытом треке — не опечатка, а приказ переделать сделанное.
  if (terminal.length && st.includes('ACTIVE')) {
    mismatches.push({ dir, entries });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ③/④ Построчный проход по живой зоне
// ─────────────────────────────────────────────────────────────────────────────
const edges = [];   // { rel, line, text }
const open = [];    // { rel, line, id, text }
const inClosedTrack = rel => [...closedDirs].some(d => rel.startsWith(d + '/'));

// Маркер бывает в хвосте длинной шапки (release-dod TRACK.md:3 — 400 символов) — обрезать
// строку с начала значит показать всё, кроме собственно ребра. Поэтому окно вокруг совпадения.
function window(line, at, width = 150) {
  const from = Math.max(0, at - 30);
  const cut = line.slice(from, from + width).trim();
  return (from > 0 ? '…' : '') + cut + (from + width < line.length ? '…' : '');
}

for (const rel of files) {
  if (inClosedTrack(rel)) continue;
  const text = read(rel);
  if (text === null) continue;
  let inFence = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;

    const edge = line.match(EDGE_RE);
    if (edge) edges.push({ rel, line: i + 1, text: window(line, edge.index) });

    const d = line.match(DECL_RE);
    if (!d) return;
    const tail = line.slice(line.indexOf(d[1]) + d[1].length);
    if (!DECL_TAIL_RE.test(tail)) return;
    // В таблице статус — последняя непустая ячейка; в списке/заголовке — хвост после ID.
    const cells = line.includes('|') ? line.split('|').map(c => c.trim()).filter(Boolean) : null;
    const isRow = cells && cells.length > 1;
    const verdict = isRow ? cells[cells.length - 1] : tail.slice(0, 120);
    if (RESOLVED_RE.test(verdict) && !PARTIAL_RE.test(verdict)) return;
    // Для таблицы читаемо «вопрос → статус», для списка — хвост строки без разметки.
    const body = isRow
      ? `${cells[1]} → [${verdict}]`
      : tail.replace(/^[\s*:|—–]+/, '').replace(/\*+\s*$/, '');
    open.push({ rel, line: i + 1, id: d[1], text: body.replace(/\s+/g, ' ').trim().slice(0, 130) });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Отчёт
// ─────────────────────────────────────────────────────────────────────────────
const trackNames = [...tracks.keys()].sort();

console.log('frontier: производный срез открытого (read-only, warn-only, exit 0)\n');

console.log('① ТРЕКИ — статус из шапки каждого файла');
for (const dir of trackNames) {
  const mark = closedDirs.has(dir) ? '✓' : '·';
  const parts = tracks.get(dir).map(e => `${e.name.replace(/\.md$/, '')}=${e.status}`).join(' · ');
  console.log(`   ${mark} ${dir.replace(/^dev\//, '')} — ${parts}`);
}
console.log('');

console.log('② ⚠ РАССОГЛАСОВАНИЯ — терминальный статус рядом с ACTIVE в одном треке');
if (!mismatches.length) console.log('   (нет)');
for (const m of mismatches) {
  console.log(`   · ${m.dir}: ${m.entries.map(e => `${e.name}=${e.status}`).join(', ')}`);
  console.log('     ACTIVE-шов ре-инжектится в каждую компактованную сессию — при закрытом ' +
    'треке это приказ переделать сделанное. Свести статусы.');
}
console.log('');

console.log('③ GATED / BLOCKED — рёбра, на которых работа стоит (закрытые треки не в счёт)');
if (!edges.length) console.log('   (нет)');
for (const e of edges) console.log(`   · ${e.rel}:${e.line}\n     ${e.text}`);
console.log('');

console.log('④ ОТКРЫТЫЕ РЕШЕНИЯ — OD/OQ без терминального вердикта в строке');
if (!open.length) console.log('   (нет)');
let lastFile = null;
for (const o of open) {
  if (o.rel !== lastFile) { console.log(`   ${o.rel}`); lastFile = o.rel; }
  console.log(`     · ${o.id} (:${o.line}) — ${o.text}`);
}
console.log('');

console.log(`ИТОГО: ${trackNames.length} треков (из них ${closedDirs.size} закрытых) · ` +
  `${mismatches.length} рассогласований · ${edges.length} gated-рёбер · ${open.length} открытых решений.`);
console.log('Отчёт производный: правится не он, а документ-источник. Он ничего не гейтит и ничего не пишет.');

process.exit(0);
