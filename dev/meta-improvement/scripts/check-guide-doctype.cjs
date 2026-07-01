#!/usr/bin/env node
/**
 * check-guide-doctype.cjs — A3 (doc-UX batch, DEC-DEV-0136).
 *
 * Инвариант Diátaxis для USER-слоя `docs/guide/*.md`:
 *   1. У каждой доки — валидный `doc_type` из enum (+ опц. вторичный `doc_type_secondary`).
 *   2. Ручная таблица ролей в `docs/guide/README.md` («Что здесь — файлы и их роль»)
 *      не дрейфует от фронтматтера: роль в таблице ⇔ doc_type файла (это ПОТРЕБИТЕЛЬ
 *      метки — без него фронтматтер был бы линтом без читателя).
 *   3. Anti-orphan в обе стороны: каждая guide/*.md есть строкой в таблице и наоборот.
 *
 * Детерминированный, без сети, без записи. Ненулевой exit при рассинхроне (в `npm run verify`).
 * Правь фронтматтер доки / генератор (для 02-03) — таблица хаба редакторская, но проверяемая.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GUIDE = path.join(ROOT, 'docs', 'guide');
const README = path.join(GUIDE, 'README.md');

// Diátaxis (4) + `navigation` — расширение для хаба-индекса (сам README): он контейнер, не квадрант.
const ENUM = ['tutorial', 'how-to', 'reference', 'explanation', 'navigation'];

// Отображаемая метка в таблице README → enum. Регистр меток фиксирован (редакторский стиль хаба).
const LABEL_MAP = {
  'Навигация': 'navigation',
  'Tutorial': 'tutorial',
  'How-to': 'how-to',
  'Reference': 'reference',
  'Explanation': 'explanation',
};

const errs = [];

// ── фронтматтер: срезаем опц. BOM, берём ведущий ---...--- блок, парсим key: value ──
function frontmatter(src) {
  const m = String(src).replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

// ── ролевые метки файла из фронтматтера, как множество enum-значений ──
function fileRoles(fm) {
  const roles = [];
  if (fm.doc_type) roles.push(fm.doc_type);
  if (fm.doc_type_secondary) roles.push(fm.doc_type_secondary);
  return roles;
}

// ── парс таблицы «Что здесь — файлы и их роль» → { filename: [enum roles] } ──
function parseHubTable(readmeSrc) {
  const lines = readmeSrc.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Что здесь/.test(l));
  if (start < 0) { errs.push('README: не найдена секция «## Что здесь — файлы и их роль»'); return {}; }
  const table = {};
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^(##\s|---\s*$)/.test(l)) break;            // конец секции
    if (!/^\|/.test(l)) continue;                     // не строка таблицы
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const first = cells[0], roleCell = cells[1];
    if (/^\s*Файл\s*$/.test(first) || /^-+$/.test(first)) continue; // заголовок/разделитель
    // имя файла: ссылка ](NN-name.md) либо спец-случай «этот README»
    let fname = null;
    const link = first.match(/\]\(([\w.-]+\.md)\)/);
    if (link) fname = link[1];
    else if (/README/i.test(first)) fname = 'README.md';
    if (!fname) continue;
    // роли: вторая колонка, split по «·», маппинг меток
    const roles = [];
    for (const raw of roleCell.split('·').map((s) => s.trim()).filter(Boolean)) {
      if (!(raw in LABEL_MAP)) { errs.push(`README: неизвестная роль-метка «${raw}» у ${fname} (ожидалось: ${Object.keys(LABEL_MAP).join(' / ')})`); continue; }
      roles.push(LABEL_MAP[raw]);
    }
    table[fname] = roles;
  }
  return table;
}

const eqSet = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

function main() {
  const files = fs.readdirSync(GUIDE).filter((f) => /\.md$/.test(f)).sort();
  const readmeSrc = fs.readFileSync(README, 'utf8');
  const hub = parseHubTable(readmeSrc);

  const fmRoles = {};
  for (const f of files) {
    const fm = frontmatter(fs.readFileSync(path.join(GUIDE, f), 'utf8'));
    if (!fm || !fm.doc_type) { errs.push(`${f}: нет фронтматтера с doc_type`); continue; }
    if (!ENUM.includes(fm.doc_type)) errs.push(`${f}: doc_type «${fm.doc_type}» вне enum (${ENUM.join(' / ')})`);
    if (fm.doc_type_secondary && !ENUM.includes(fm.doc_type_secondary)) errs.push(`${f}: doc_type_secondary «${fm.doc_type_secondary}» вне enum`);
    fmRoles[f] = fileRoles(fm);
  }

  // anti-orphan + cross-drift
  for (const f of files) {
    if (!(f in hub)) { errs.push(`${f}: нет строки в таблице ролей README (anti-orphan)`); continue; }
    if (fmRoles[f] && !eqSet(fmRoles[f], hub[f])) {
      errs.push(`${f}: роль в README [${hub[f].join(', ')}] ≠ фронтматтер [${fmRoles[f].join(', ')}] — таблица дрейфанула от doc_type`);
    }
  }
  for (const f of Object.keys(hub)) {
    if (!files.includes(f)) errs.push(`README: строка таблицы ссылается на «${f}», которого нет в docs/guide/`);
  }

  if (errs.length) {
    console.error('check-guide-doctype: ✗ ' + errs.length + ' проблем(ы):');
    for (const e of errs) console.error('  - ' + e);
    process.exit(1);
  }
  console.log(`check-guide-doctype: ✓ ${files.length} доков, doc_type валиден и согласован с таблицей ролей README`);
}

main();
