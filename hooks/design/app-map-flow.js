#!/usr/bin/env node
/**
 * app-map-flow.js — extract a screen-level USER FLOW graph from a Navigation Map (NM).
 * Consumed by app-map-html.js (the HTML walker generator).
 *
 * Source of truth = NM (per-feature). We READ it, never duplicate:
 *   - screens (id → title) from the §1 Mermaid node defs   SIn["SI-N · Title"]
 *   - edges (from → to, trigger, guard) from the §3 "Screen Transitions" markdown table
 * SI ids normalized to canonical "SI-N" (mermaid uses "SIn"; table uses "SI-N").
 * Non-SI targets (FM-005 (billing), login, object storage, inbox, …) become external nodes.
 * "любой"/"any" source rows are skipped (global session-expired edge — not part of the walk).
 *
 * Usage:  node app-map-flow.js <path/to/NM-XXX.md>     → prints {feature, screens, edges, externals} JSON
 * Exit:   0 ok, 2 file/parse error.
 */
'use strict';

const fs = require('fs');

function normSI(token) {
  // "SI3" | "SI-3" | "SI-2 (error)" → "SI-2"
  const m = /SI-?(\d+)/.exec(token);
  return m ? 'SI-' + m[1] : null;
}

function extractFlow(nmContent) {
  // ----- feature id (frontmatter) -----
  const featM = /^feature:\s*(FM-\d+)/m.exec(nmContent);
  const feature = featM ? featM[1] : null;

  // ----- screens from §1 Mermaid node defs: SIn["SI-N · Title"] -----
  const screens = {};
  const order = [];
  const nodeRe = /\bSI\d+\s*\[\s*"(SI-\d+[^"]*)"\s*\]/g;
  let m;
  while ((m = nodeRe.exec(nmContent))) {
    const label = m[1];
    const id = normSI(label);
    if (!id) continue;
    const title = label.replace(/^SI-\d+\s*[·:\-]*\s*/, '').trim() || id;
    if (!screens[id]) { screens[id] = title; order.push(id); }
  }

  // ----- edges from §3 "Screen Transitions" markdown table -----
  // locate the table region (heading containing "Screen Transitions" → next "## ")
  const edges = [];
  const externals = {};
  const secM = /(^|\n)#{1,4}[^\n]*Screen Transitions[\s\S]*?(?=\n#{1,4}\s|\n*$)/i.exec(nmContent);
  const region = secM ? secM[0] : nmContent;
  region.split(/\r?\n/).forEach((line) => {
    if (!/^\s*\|/.test(line)) return;                 // table rows only
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) return;
    const [fromCell, toCell, triggerCell, guardCell] = cells;
    if (/^-+$/.test(fromCell) || /^from$/i.test(fromCell)) return;  // separator / header
    const from = normSI(fromCell);
    if (!from) return;                                 // skip "любой"/external-source rows for v1
    const trigger = (triggerCell || '').replace(/\s+/g, ' ').trim();
    const guard = (guardCell || '').replace(/^—$/, '').trim();
    // To cell may list several SI ("SI-3 / SI-4") or an external ("FM-005 (billing)")
    const toSIs = (toCell.match(/SI-?\d+/g) || []).map(normSI);
    if (toSIs.length) {
      toSIs.forEach((to) => {
        if (to === from && /\(/.test(toCell)) return;  // skip self "(error)/(processing)" loops in v1 walk
        edges.push({ from, to, trigger, guard });
      });
    } else {
      // external target
      const extId = extKey(toCell);
      externals[extId] = externals[extId] || cleanExtLabel(toCell);
      edges.push({ from, to: extId, trigger, guard, external: true });
    }
  });

  return {
    feature,
    screens: order.map((id) => ({ id, title: screens[id] })),
    edges,
    externals: Object.entries(externals).map(([id, label]) => ({ id, label })),
  };
}

function extKey(cell) {
  const fm = /FM-\d+/.exec(cell);
  if (fm) return fm[0];
  return 'ext:' + cell.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}
function cleanExtLabel(cell) { return cell.replace(/\s+/g, ' ').trim(); }

// ---------- CLI ----------
if (require.main === module) {
  const file = process.argv[2];
  if (!file) { process.stderr.write('Usage: node app-map-flow.js <NM-XXX.md>\n'); process.exit(2); }
  let content;
  try { content = fs.readFileSync(file, 'utf-8'); } catch (e) { process.stderr.write('ERROR read: ' + e.message + '\n'); process.exit(2); }
  process.stdout.write(JSON.stringify(extractFlow(content), null, 2) + '\n');
}

module.exports = { extractFlow, normSI };
