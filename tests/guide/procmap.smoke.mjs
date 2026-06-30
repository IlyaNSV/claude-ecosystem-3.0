// Deterministic headless smoke for the GENERATED BPMN process map
// (docs/guide/ecosystem-processes.html). Renders the page in an installed
// Chrome/Edge via puppeteer-core (NO browser download — executablePath), captures
// JS errors, and asserts structural invariants + the ad-hoc grouping feature
// through the page's test hooks (window.__cy / window.__procmap).
//
// The PASS/FAIL gate is DETERMINISTIC (JS errors · element counts vs the data
// island · no NaN positions · non-zero extents · no dangling edges · grouping
// round-trip). The screenshot it writes is an artifact for a human/agent to READ
// (vision), never the gate — a vision-on-screenshot oracle is unreliable.
//
// Lane-overlap is REPORTED and hard-fails only at the dagre-disaster level (>60%),
// so the fcose force layout's run-to-run jitter never makes `npm run verify` flaky
// while a totally-broken layout is still caught.
//
// SKIPS cleanly (exit 0) when no browser or puppeteer-core is present, so
// `npm run verify` never breaks for lack of a browser. Set PUPPETEER_EXECUTABLE_PATH
// (or CHROME_PATH) to point at a specific Chrome/Edge.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const HTML = path.join(ROOT, 'docs', 'guide', 'ecosystem-processes.html');

function findBrowser() {
  const fromEnv = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH].filter(Boolean);
  const guesses = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const p of [...fromEnv, ...guesses]) {
    try { if (p && fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

function skip(msg) { console.log('[skip] procmap.smoke — ' + msg); process.exit(0); }

if (!fs.existsSync(HTML)) skip('generated map missing — run `npm run gen:procmap`: ' + HTML);
const exe = findBrowser();
if (!exe) skip('no Chrome/Edge found (set PUPPETEER_EXECUTABLE_PATH to enable)');

let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch { skip('puppeteer-core not installed'); }

const checks = [];
const ok = (cond, msg) => checks.push({ ok: !!cond, msg });

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--allow-file-access-from-files', '--no-sandbox', '--window-size=1680,1050', '--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050, deviceScaleFactor: 1 });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') jsErrors.push('console.error ' + m.text()); });

  const url = 'file:///' + HTML.replace(/\\/g, '/');
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.waitForFunction(() => !!window.__cy && !!window.__procmap, { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1800)); // let the initial fcose layout settle

  // ── layout health (measured FIRST, on the pristine default view so no prior mutation
  //    disturbs positions): sibling MODULE lanes should not grossly overlap — the dagre→fcose
  //    fix (dagre laid compounds out as global bounding boxes that stacked on each other). ──
  const overlap = await page.evaluate(() => {
    const cy = window.__cy;
    const lanes = cy.nodes('[kind="lane"]').filter((n) => n.id() !== 'lane:artifacts' && n.visible());
    const boxes = lanes.map((l) => l.boundingBox());
    const ids = lanes.map((l) => l.id());
    const area = (b) => Math.max(0, b.w) * Math.max(0, b.h);
    const inter = (a, b) => {
      const x = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
      const y = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
      return x * y;
    };
    let maxRatio = 0, worst = '';
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const small = Math.min(area(boxes[i]), area(boxes[j])) || 1;
        const r = inter(boxes[i], boxes[j]) / small;
        if (r > maxRatio) { maxRatio = r; worst = ids[i] + ' ∩ ' + ids[j]; }
      }
    }
    return { laneCount: lanes.length, maxRatio, worst };
  });
  console.log(`  lane-overlap: max ${(overlap.maxRatio * 100).toFixed(1)}% (${overlap.worst || 'n/a'}) across ${overlap.laneCount} module lanes`);
  ok(overlap.maxRatio < 0.6, `sibling lanes not grossly overlapping (max ${(overlap.maxRatio * 100).toFixed(1)}% < 60%)`);

  // ── structural invariants: expand everything, count vs the data island ──
  const struct = await page.evaluate(() => {
    const cy = window.__cy;
    const DATA = JSON.parse(document.getElementById('proc-data').textContent);
    const api = window.__procmap.getApi();
    if (api) { try { api.expandAll(); } catch (e) { /* ignore */ } }
    const realEdges = cy.edges().filter((e) => !e.hasClass('cy-expand-collapse-meta-edge'));
    let nanPos = 0;
    cy.nodes().forEach((n) => { const p = n.position(); if (!isFinite(p.x) || !isFinite(p.y)) nanPos++; });
    const bb = cy.elements().boundingBox();
    const dangling = cy.edges().filter((e) => e.source().empty() || e.target().empty()).length;
    return {
      dataNodes: DATA.nodes.length, dataEdges: DATA.edges.length,
      nodeCount: cy.nodes().length, edgeCount: realEdges.length,
      nanPos, bbW: Math.round(bb.w), bbH: Math.round(bb.h), dangling,
    };
  });
  ok(struct.nodeCount === struct.dataNodes, `all ${struct.dataNodes} nodes present after expandAll (got ${struct.nodeCount})`);
  ok(struct.edgeCount === struct.dataEdges, `all ${struct.dataEdges} edges present after expandAll (got ${struct.edgeCount})`);
  ok(struct.nanPos === 0, `no NaN/Infinity node positions (got ${struct.nanPos})`);
  ok(struct.bbW > 0 && struct.bbH > 0, `graph has non-zero extents (${struct.bbW}×${struct.bbH})`);
  ok(struct.dangling === 0, `no dangling edges (got ${struct.dangling})`);

  // ── ad-hoc grouping feature round-trip ──
  const grp = await page.evaluate(() => {
    const cy = window.__cy;
    const ids = cy.nodes('[kind="process"]').filter((n) => n.visible()).slice(0, 3).map((n) => n.id());
    cy.nodes().unselect();
    ids.forEach((id) => cy.getElementById(id).select());
    window.__procmap.group();
    const g = cy.nodes('[kind="adhoc"]');
    const made = g.length === 1 && g[0].children().length === 3;
    const danglingAfterGroup = cy.edges().filter((e) => e.source().empty() || e.target().empty()).length;
    cy.nodes().unselect();
    g.select();
    window.__procmap.ungroup();
    const removed = cy.nodes('[kind="adhoc"]').length === 0;
    const danglingAfterUngroup = cy.edges().filter((e) => e.source().empty() || e.target().empty()).length;
    return { made, removed, danglingAfterGroup, danglingAfterUngroup };
  });
  ok(grp.made, 'group(3) wraps the selection in one ad-hoc compound with 3 children');
  ok(grp.danglingAfterGroup === 0, `no dangling edges after group (got ${grp.danglingAfterGroup})`);
  ok(grp.removed, 'ungroup removes the ad-hoc compound');
  ok(grp.danglingAfterUngroup === 0, `no dangling edges after ungroup (got ${grp.danglingAfterUngroup})`);

  // ── artifact screenshot (for human/agent eyes; NOT the gate) ──
  try {
    const shot = path.join(os.tmpdir(), 'procmap-smoke.png');
    await page.screenshot({ path: shot });
    console.log('  screenshot: ' + shot);
  } catch { /* non-fatal */ }

  ok(jsErrors.length === 0, `no JS errors (got ${jsErrors.length}${jsErrors.length ? ': ' + jsErrors[0] : ''})`);

  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.msg}`);
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) { console.error(`\nprocmap.smoke: ${failed.length} FAILED`); process.exitCode = 1; }
  else console.log(`\nprocmap.smoke: ✓ ${checks.length} checks passed`);
} finally {
  await browser.close();
}
