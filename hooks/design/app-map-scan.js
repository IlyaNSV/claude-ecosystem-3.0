#!/usr/bin/env node
/**
 * app-map-scan.js — deterministic MECHANICAL-layer scanner for the App Map (AM) artifact.
 * Backs `/design:map` and the AM cascade diff (app-map-cascade.js).
 *
 * WHY a JS scanner + assistant skill, not a monolithic generator:
 *   The mechanical layer (which modules exist, which have an NM, drill-down targets, planned
 *   stubs) is pure projection of FM-* / NM-* frontmatter → fully deterministic, cheap, and
 *   diffable for cascade. The EDITORIAL layer (cross_module_edges, primary_journeys, cjm_stages)
 *   lives in app-map.md frontmatter and is woven by the assistant (skill app-map-generate.md),
 *   which reads nested YAML natively. This script deliberately does NOT parse the editorial
 *   nested YAML — it only handles the flat FM/NM frontmatter (same subset as
 *   design-artifact-validate.js parseFrontmatter), so it never goes fragile.
 *
 * Output: JSON report on stdout {modules, coverage, mermaid_skeleton, ...}. With --mermaid the
 *   mermaid_skeleton (mechanical L0: subgraphs for FMs with an NM + dashed planned stubs for the
 *   rest + click drill-down) is the canonical mechanical region the skill wraps editorial edges
 *   around. No timestamps embedded in the skeleton (kept stable for cascade diff).
 *
 * Usage:
 *   node app-map-scan.js [--root <projectDir>] [--mermaid] [--open-design-base http://localhost:7457]
 * Exit: 0 = scan ok, 2 = no project root / IO error.
 *
 * Cross-platform: filePath.replace(/\\/g,'/') per DEC-DEV-0044 (Windows backslash compat).
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------- args ----------
function parseArgs(argv) {
  const a = { root: null, mermaid: false, odBase: 'http://localhost:7457' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--root') a.root = argv[++i];
    else if (k === '--mermaid') a.mermaid = true;
    else if (k === '--open-design-base') a.odBase = argv[++i];
    else if (k === '-h' || k === '--help') a.help = true;
  }
  return a;
}

// ---------- minimal flat frontmatter parser (same subset as design-artifact-validate.js) ----------
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return {};
  const obj = {};
  m[1].split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    const key = kv[1];
    let val = kv[2].trim();
    val = val.replace(/\s+#.*$/, '').trim();
    val = val.replace(/^["'](.*)["']$/, '$1');
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    obj[key] = val;
  });
  return obj;
}

function findProjectRoot(start) {
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude')) && fs.existsSync(path.join(dir, '.product'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function listMd(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => new RegExp('^' + prefix + '-[^/]+\\.md$').test(f))
    .map((f) => path.join(dir, f));
}

function truthy(v) { return v === true || v === 'true'; }

// short label for a node: drop "&", take first 3 significant words
function shortLabel(title) {
  if (!title) return '';
  return String(title).replace(/[&]/g, '').split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
}

// scan(root) — pure mechanical layer; reused by app-map-cascade.js (no process spawn).
function scan(root) {
  const featuresDir = path.join(root, '.product', 'features');
  const mockupsDir = path.join(root, '.product', 'mockups');

  // NM index: feature -> [{id,status}]
  const nmByFeature = {};
  for (const f of listMd(mockupsDir, 'NM')) {
    const fm = parseFrontmatter(fs.readFileSync(f, 'utf-8'));
    if (!fm.id || !fm.feature) continue;
    (nmByFeature[fm.feature] = nmByFeature[fm.feature] || []).push({ id: fm.id, status: fm.status || 'unknown' });
  }

  // Modules from FM-*
  const modules = [];
  for (const f of listMd(featuresDir, 'FM')) {
    const fm = parseFrontmatter(fs.readFileSync(f, 'utf-8'));
    if (!fm.id) continue;
    const nms = nmByFeature[fm.id] || [];
    modules.push({
      id: fm.id,
      title: fm.title || '',
      short: shortLabel(fm.title),
      status: fm.status || 'unknown',
      has_ui: truthy(fm.has_ui),
      mockups: Array.isArray(fm.mockups) ? fm.mockups : (fm.mockups ? [fm.mockups] : []),
      nm: nms.map((n) => n.id),
      nm_present: nms.length > 0,
    });
  }
  modules.sort((a, b) => a.id.localeCompare(b.id));

  const uiModules = modules.filter((m) => m.has_ui);
  const live = uiModules.filter((m) => m.nm_present);     // has NM -> drill-down available (L1)
  const stubs = uiModules.filter((m) => !m.nm_present);   // has_ui but no NM -> planned stub

  return {
    modules, uiModules, live, stubs,
    // navigation_maps actually present, sorted (mechanical truth for cascade diff)
    navigation_maps: live.flatMap((m) => m.nm).sort(),
    counts: {
      modules: modules.length,
      ui_modules: uiModules.length,
      with_nm: live.length,
      planned_stubs: stubs.length,
      no_ui: modules.length - uiModules.length,
    },
    coverage_note: `${live.length}/${uiModules.length} UI-модулей имеют NM (drill-down L1); ${stubs.length} ещё planned-stub`,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write('Usage: node app-map-scan.js [--root <dir>] [--mermaid] [--open-design-base <url>]\n');
    process.exit(0);
  }
  const root = args.root ? path.resolve(args.root) : findProjectRoot(process.cwd());
  if (!root) { process.stderr.write('ERROR: no project root (.claude + .product) found\n'); process.exit(2); }

  const s = scan(root);
  const report = {
    tool: 'app-map-scan',
    artifact: 'AM',
    pmo_zone: 'D2-B04',
    project_root: root.replace(/\\/g, '/'),
    counts: s.counts,
    modules: s.modules,
    coverage_note: s.coverage_note,
  };
  if (args.mermaid) report.mermaid_skeleton = buildMermaid(s.modules, args.odBase);

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}

// ---------- mechanical L0 Mermaid skeleton (NO editorial edges — those are woven by the skill) ----------
function buildMermaid(modules, odBase) {
  const L = [];
  L.push('flowchart TD');
  L.push('    classDef live    fill:#dbe1ff,stroke:#004ac6,stroke-width:2px;');
  L.push('    classDef planned fill:#f3f3f3,stroke:#9aa0ae,stroke-dasharray:4 3,color:#6b6f7d;');
  L.push('');
  for (const m of modules) {
    if (!m.has_ui) continue;
    const key = m.id.replace(/-/g, '');           // FM-001 -> FM001 (mermaid-safe id)
    const node = 'n' + key;
    if (m.nm_present) {
      L.push(`    subgraph ${key} ["${m.id} · ${m.short}"]`);
      L.push(`      ${node}["${m.short}"]:::live`);
      L.push('    end');
      // drill-down: first NM of the feature
      L.push(`    click ${node} "${m.nm[0]}" "Открыть ${m.nm[0]} (L1 — флоу модуля)"`);
    } else {
      L.push(`    ${key}["${m.id} · ${m.short} — planned"]:::planned`);
    }
  }
  L.push('');
  L.push('    %% --- EDITORIAL EDGES woven below by skill app-map-generate.md (cross_module_edges) ---');
  return L.join('\n');
}

if (require.main === module) main();
module.exports = { scan, buildMermaid, parseFrontmatter, shortLabel, findProjectRoot };
