#!/usr/bin/env node
/**
 * gen-command-catalog.cjs — Tier-2 anti-drift generator (DEC-DEV-0105).
 *
 * Reads the frontmatter (`description` + `argument-hint`) of every
 * `commands/**\/*.md` and emits a human command catalog to
 * `docs/guide/02-commands.md`. The frontmatter is the single source of
 * truth (it is what Claude Code surfaces in the slash-menu), so the
 * catalog never hand-drifts — regenerate instead of editing.
 *
 * Aligns with docs/MAP.md's "generate from frontmatter, not by hand".
 *
 * Run:  node dev/meta-improvement/scripts/gen-command-catalog.cjs
 *       node dev/meta-improvement/scripts/gen-command-catalog.cjs --check   (CI: non-zero if stale)
 */
'use strict';
const fs = require('fs');
const path = require('path');
let yaml = null;
try { yaml = require('js-yaml'); } catch (_) { /* fallback to regex parse */ }

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CMD_DIR = path.join(ROOT, 'commands');
const OUT = path.join(ROOT, 'docs', 'guide', '02-commands.md');
const REL_SELF = 'dev/meta-improvement/scripts/gen-command-catalog.cjs';

// Display order + one-line module captions.
const MODULE_ORDER = ['ecosystem', 'product', 'design', 'integrator', 'orchestrator'];
const MODULE_CAPTION = {
  ecosystem: 'Установка и обслуживание самой экосистемы',
  product: 'Ядро ежедневной работы — D1 Discovery + D2-Behavioral',
  design: 'Дизайн интерфейса — условно, при `has_ui=true`',
  integrator: 'Подключение внешних инструментов под PMO («сисадмин»)',
  orchestrator: 'Прогон PMO-процессов end-to-end (D2-Tech + D3+)',
};

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  if (yaml) {
    try { return yaml.load(m[1]) || {}; } catch (_) { /* fall through */ }
  }
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^(description|argument-hint):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

function collect() {
  const modules = {};
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const mod = path.relative(CMD_DIR, p).split(path.sep)[0];
      const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
      (modules[mod] = modules[mod] || []).push({
        name: path.basename(e.name, '.md'),
        desc: String(fm.description || '').trim(),
        arg: String(fm['argument-hint'] || '').trim(),
      });
    }
  }
  walk(CMD_DIR);
  return modules;
}

function cell(s) { return String(s).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|'); }

function render(modules) {
  const mods = Object.keys(modules).sort(
    (a, b) => ((MODULE_ORDER.indexOf(a) + 1) || 99) - ((MODULE_ORDER.indexOf(b) + 1) || 99)
  );
  let total = 0;
  let body = '';
  for (const mod of mods) {
    const list = modules[mod].sort((a, b) => a.name.localeCompare(b.name));
    total += list.length;
    body += `## /${mod}:* (${list.length})\n\n`;
    if (MODULE_CAPTION[mod]) body += `${MODULE_CAPTION[mod]}\n\n`;
    body += '| Команда | Что делает | Аргументы |\n|---|---|---|\n';
    for (const c of list) {
      const arg = c.arg ? '`' + cell(c.arg).replace(/`/g, '') + '`' : '—';
      body += `| \`/${mod}:${c.name}\` | ${cell(c.desc) || '—'} | ${arg} |\n`;
    }
    body += '\n';
  }
  const head =
    `<!-- GENERATED FILE — DO NOT EDIT BY HAND.\n` +
    `     Source of truth: frontmatter of commands/**/*.md.\n` +
    `     Regenerate: node ${REL_SELF} -->\n\n` +
    `# Каталог команд\n\n` +
    `> **Сгенерирован** из frontmatter \`commands/**/*.md\` — не править руками, ` +
    `перегенерировать: \`node ${REL_SELF}\`. Интерактивная версия — ` +
    `[ecosystem-map.html](ecosystem-map.html). Канонический статус — ` +
    `[ROADMAP](../../ROADMAP.md#где-мы-сейчас).\n\n` +
    `**Всего: ${total} команд** в ${mods.length} модулях.\n\n`;
  return head + body;
}

const out = render(collect());
const check = process.argv.includes('--check');
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
// EOL-agnostic: git autocrlf (Windows) checks the file out with CRLF on disk
// while the generator emits LF — compare content, not line endings.
const eol = (s) => s.replace(/\r\n/g, '\n');
if (check) {
  if (eol(current) !== eol(out)) {
    console.error(`gen-command-catalog: STALE — ${OUT} differs from frontmatter. Run the generator.`);
    process.exit(1);
  }
  console.log('gen-command-catalog: ✓ catalog up to date');
} else {
  fs.writeFileSync(OUT, out);
  const n = (out.match(/^\| `\//gm) || []).length;
  console.log(`gen-command-catalog: wrote ${path.relative(ROOT, OUT)} — ${n} commands`);
}
