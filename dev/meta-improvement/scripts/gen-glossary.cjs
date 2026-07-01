#!/usr/bin/env node
/**
 * gen-glossary.cjs — Tier-2 anti-drift generator (DEC-DEV-0131, doc-UX batch E1).
 *
 * Emits the canonical USER glossary `docs/guide/03-glossary.md` from a SINGLE
 * source of truth, so the 24-acronym list never hand-drifts (the failure mode
 * of the prior hand-written 00-concepts §8):
 *   - artifact canonical NAMES  ← docs/pmo/artifacts/*.md H1 headings
 *                                 (same harvest rule as gen-ecosystem-map)
 *   - tier / lineage / grouping ← docs/guide/ecosystem-map.overlay.json
 *                                 (artifacts{}, artifactGroups[])
 *   - cross-cutting terms       ← ecosystem-map.overlay.json glossary[]
 *
 * Aligns with docs/MAP.md's "generate from source, not by hand". No volatile
 * build stamp → --check is a plain EOL-agnostic content compare (deterministic).
 *
 * Run:  node dev/meta-improvement/scripts/gen-glossary.cjs
 *       node dev/meta-improvement/scripts/gen-glossary.cjs --check      (CI: non-zero if stale)
 *       node dev/meta-improvement/scripts/gen-glossary.cjs --selftest   (invariants only)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const ART_DIR = path.join(ROOT, 'docs', 'pmo', 'artifacts');
const OVERLAY = path.join(ROOT, 'docs', 'guide', 'ecosystem-map.overlay.json');
const OUT = path.join(ROOT, 'docs', 'guide', '03-glossary.md');
const REL_SELF = 'dev/meta-improvement/scripts/gen-glossary.cjs';

// canonical artifact names from the spec H1 (`# FM-* — Feature Map Entry` → "Feature Map Entry")
function harvestNames() {
  const names = {};
  for (const f of fs.readdirSync(ART_DIR)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    const id = path.basename(f, '.md');
    const txt = fs.readFileSync(path.join(ART_DIR, f), 'utf8');
    const h1 = (txt.match(/^#\s+(.+?)\s*$/m) || [])[1] || id;
    const parts = h1.split(/\s+[—–-]\s+/);
    names[id] = (parts.length > 1 ? parts.slice(1).join(' — ') : h1).trim();
  }
  return names;
}

function cell(s) { return String(s == null ? '' : s).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|'); }

// invariants — run on every invocation, fail hard (mirrors the map generators' selftest)
function selftest(names, overlay) {
  const errs = [];
  const catIds = Object.keys(names);
  const ovIds = Object.keys(overlay.artifacts || {});
  if (catIds.length !== 24) errs.push(`expected 24 artifact specs, found ${catIds.length}`);
  for (const id of ovIds) if (!names[id]) errs.push(`overlay.artifacts[${id}] has no spec H1 in docs/pmo/artifacts/${id}.md`);
  for (const id of catIds) if (!overlay.artifacts[id]) errs.push(`artifact spec ${id}.md missing from overlay.artifacts`);
  const grouped = new Set((overlay.artifactGroups || []).flatMap((g) => g.ids));
  for (const id of catIds) if (!grouped.has(id)) errs.push(`artifact ${id} is in no artifactGroup (would be dropped from the glossary)`);
  for (const g of overlay.artifactGroups || []) for (const id of g.ids) if (!names[id]) errs.push(`artifactGroup ${g.id} references unknown artifact ${id}`);
  const seen = new Set();
  for (const pair of overlay.glossary || []) {
    const term = pair && pair[0];
    if (!term || !String(term).trim()) errs.push('empty glossary term');
    else if (seen.has(term)) errs.push(`duplicate glossary term: ${term}`);
    seen.add(term);
  }
  const axSeen = new Set();
  for (const ax of overlay.namingAxes || []) {
    if (!ax.axis || !String(ax.axis).trim()) errs.push('namingAxes entry with empty "axis"');
    else { if (axSeen.has(ax.axis)) errs.push(`duplicate naming axis: ${ax.axis}`); axSeen.add(ax.axis); }
    if (!ax.what || !String(ax.what).trim()) errs.push(`namingAxes[${ax.axis}] has empty "what"`);
    if (!ax.values || !String(ax.values).trim()) errs.push(`namingAxes[${ax.axis}] has empty "values"`);
  }
  return errs;
}

function render(names, overlay) {
  const A = overlay.artifacts;
  let body = '';
  // E2 — единая легенда осей именования (editorial, из overlay.namingAxes). Разводит
  // перегруженные метки `D…`/`P…`, чтобы читатель не конфлатил разные оси. Эмитится
  // первым (это «карта карт» — ориентир перед детальными таблицами артефактов).
  if (overlay.namingAxes && overlay.namingAxes.length) {
    body += '## Оси именования — какой «D…»/«P…» о чём\n\n';
    body += '> Экосистема нумерует РАЗНЫЕ вещи похожими метками (`D…`, `P…`, домены, уровни). ' +
      'Эта таблица разводит оси — чтобы `D2` (домен пайплайна) не путать с `D.2` (шаг Design), ' +
      'а `P4` Product — с `P4` Orchestrator.\n\n';
    body += '| Ось | Что нумерует | Значения | Не путать с |\n|---|---|---|---|\n';
    for (const ax of overlay.namingAxes) {
      body += `| **${cell(ax.axis)}** | ${cell(ax.what)} | ${cell(ax.values)} | ${cell(ax.notWith || '—')} |\n`;
    }
    body += '\n';
  }
  for (const g of overlay.artifactGroups) {
    body += `## ${g.label}\n\n`;
    body += '| ID | Название | Ревью | Питает |\n|---|---|---|---|\n';
    for (const id of g.ids) {
      const m = A[id] || {};
      const feeds = (m.lineageTo && m.lineageTo.length) ? m.lineageTo.join(', ') : '—';
      body += `| \`${id}\` | ${cell(names[id] || id)} | ${m.tier || ''} | ${cell(feeds)} |\n`;
    }
    body += '\n';
  }
  body += '## Сквозные термины и вердикты\n\n';
  body += '| Термин | Значение |\n|---|---|\n';
  for (const [term, def] of overlay.glossary) body += `| **${cell(term)}** | ${cell(def)} |\n`;
  body += '\n';

  const nArt = Object.keys(names).length;
  const head =
    '---\ndoc_type: reference\n---\n' +
    '<!-- GENERATED FILE — DO NOT EDIT BY HAND.\n' +
    '     Source of truth: docs/pmo/artifacts/*.md (H1 names) + docs/guide/ecosystem-map.overlay.json (tier/lineage/glossary).\n' +
    `     Regenerate: node ${REL_SELF} -->\n\n` +
    '# Глоссарий — артефакты и сквозные термины\n\n' +
    '> **Сгенерирован** из спеков артефактов (`docs/pmo/artifacts/*.md`) и редакторского overlay — ' +
    `не править руками, перегенерировать: \`node ${REL_SELF}\`. ` +
    'Ревью-уровни: 🔴 Critical · 🟠 Strategic · 🟡 Standard · 🟢 Confirmation ' +
    '(подробно — [00-concepts §5](00-concepts.md)). «Питает» — какие артефакты выводятся из этого ' +
    '(полная родословная — [artifacts/README](../pmo/artifacts/README.md)). Интерактивно — [ecosystem-map.html](ecosystem-map.html).\n\n' +
    `**Типов артефактов: ${nArt}** + оси именования, домены, сквозные термины и вердикты.\n\n`;
  return head + body;
}

function main() {
  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  const names = harvestNames();

  const errs = selftest(names, overlay);
  if (errs.length) {
    console.error('gen-glossary: SELFTEST FAILED —');
    for (const e of errs) console.error('  ✗ ' + e);
    process.exit(1);
  }
  if (process.argv.includes('--selftest')) { console.log('gen-glossary: ✓ selftest passed (24 artifacts + groups + glossary parity)'); return; }

  const out = render(names, overlay);
  const eol = (s) => s.replace(/\r\n/g, '\n');
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (eol(current) !== eol(out)) {
      console.error(`gen-glossary: STALE — ${path.relative(ROOT, OUT)} differs from source. Run: node ${REL_SELF}`);
      process.exit(1);
    }
    console.log('gen-glossary: ✓ glossary up to date');
    return;
  }
  fs.writeFileSync(OUT, out);
  console.log(`gen-glossary: wrote ${path.relative(ROOT, OUT)} — ${Object.keys(names).length} artifacts + ${overlay.glossary.length} terms`);
}
main();
