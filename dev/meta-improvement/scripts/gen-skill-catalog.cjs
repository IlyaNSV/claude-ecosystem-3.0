#!/usr/bin/env node
/**
 * gen-skill-catalog.cjs — Tier-2 anti-drift generator (DEF-CTX-5, dev/tech-debt/CONTEXT_AUDIT_D6.md).
 *
 * Twin of gen-command-catalog.cjs (DEC-DEV-0105), applied to the OTHER big artifact
 * class: skills. Reads the frontmatter (`description`) of every `skills/**\/*.md` and
 * emits a human skill catalog to `docs/guide/08-skills.md`. The frontmatter is the
 * single source of truth (it is what the lazy-loader surfaces at discovery time), so
 * the catalog never hand-drifts — regenerate instead of editing.
 *
 * WHY THIS EXISTS. Until now the «скилл» prong of CLAUDE.md «Process triggers» Row 5 was
 * held by a hand-written FLOOR in commands/ecosystem/verify.md («expect 63+»), machine-kept
 * equal to the repo by check-inventory-sync.cjs class [6]. A floor is structurally weak: a
 * count-preserving swap (delete one skill, add another — i.e. ANY rename) slides through
 * silently, and the install can never be asked «is problem-discovery.md still there?», only
 * «how many are there?». An item-granular generated catalog closes both: renames become a
 * diff, and verify.md gets per-name expectations. Floor + class [6] are removed as redundant.
 *
 * Aligns with docs/MAP.md's "generate from frontmatter, not by hand".
 *
 * Run:  node dev/meta-improvement/scripts/gen-skill-catalog.cjs
 *       node dev/meta-improvement/scripts/gen-skill-catalog.cjs --check   (CI: non-zero if stale)
 */
'use strict';
const fs = require('fs');
const path = require('path');
let yaml = null;
try { yaml = require('js-yaml'); } catch (_) { /* fallback to regex parse */ }

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKILL_DIR = path.join(ROOT, 'skills');
const OUT = path.join(ROOT, 'docs', 'guide', '08-skills.md');
const REL_SELF = 'dev/meta-improvement/scripts/gen-skill-catalog.cjs';

// Display order + one-line module captions. Same five modules as the command catalog —
// captions reused verbatim so the two catalogs read as one system.
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
    const mm = line.match(/^(description):\s*(.*)$/);
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
      if (e.name.toLowerCase() === 'readme.md') continue; // never an inventory item
      const mod = path.relative(SKILL_DIR, p).split(path.sep)[0];
      const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
      (modules[mod] = modules[mod] || []).push({
        name: path.basename(e.name, '.md'),
        desc: String(fm.description || '').trim(),
      });
    }
  }
  walk(SKILL_DIR);
  return modules;
}

function cell(s) { return String(s).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|'); }

// The total changes on every add/remove, so the noun must agree with it (the command
// catalog can hardcode «команд» only because 50 happens to take the genitive plural).
function plural(n, [one, few, many]) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function render(modules) {
  const mods = Object.keys(modules).sort(
    (a, b) => ((MODULE_ORDER.indexOf(a) + 1) || 99) - ((MODULE_ORDER.indexOf(b) + 1) || 99)
  );
  let total = 0;
  let body = '';
  for (const mod of mods) {
    const list = modules[mod].sort((a, b) => a.name.localeCompare(b.name));
    total += list.length;
    body += `## skills/${mod}/ (${list.length})\n\n`;
    if (MODULE_CAPTION[mod]) body += `${MODULE_CAPTION[mod]}\n\n`;
    body += '| Скилл | Что делает |\n|---|---|\n';
    for (const s of list) {
      body += `| \`${mod}/${s.name}\` | ${cell(s.desc) || '—'} |\n`;
    }
    body += '\n';
  }
  const head =
    `---\ndoc_type: reference\n---\n` +
    `<!-- GENERATED FILE — DO NOT EDIT BY HAND.\n` +
    `     Source of truth: frontmatter of skills/**/*.md.\n` +
    `     Regenerate: node ${REL_SELF} -->\n\n` +
    `# Каталог скиллов\n\n` +
    `> **Сгенерирован** из frontmatter \`skills/**/*.md\` — не править руками, ` +
    `перегенерировать: \`node ${REL_SELF}\`. Скиллы — **lazy-loaded методология**: их не ` +
    `вызывают как команды, их подгружает ассистент под задачу (3-5 за раз). Путь на диске — ` +
    `\`skills/<скилл>.md\`. Команды — [02-commands.md](02-commands.md). Канонический статус — ` +
    `[ROADMAP](../../ROADMAP.md#где-мы-сейчас).\n\n` +
    `**Всего: ${total} ${plural(total, ['скилл', 'скилла', 'скиллов'])}** в ${mods.length} ` +
    `${plural(mods.length, ['модуле', 'модулях', 'модулях'])}.\n\n`;
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
    console.error(`gen-skill-catalog: STALE — ${OUT} differs from frontmatter. Run the generator.`);
    process.exit(1);
  }
  console.log('gen-skill-catalog: ✓ catalog up to date');
} else {
  fs.writeFileSync(OUT, out);
  const n = (out.match(/^\| `/gm) || []).length;
  console.log(`gen-skill-catalog: wrote ${path.relative(ROOT, OUT)} — ${n} skills`);
}
