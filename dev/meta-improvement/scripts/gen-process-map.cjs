#!/usr/bin/env node
/**
 * gen-process-map.cjs — Tier-2 anti-drift generator for the interactive
 * BPMN-style PROCESS map (sibling of gen-ecosystem-map.cjs).
 *
 * Builds docs/guide/ecosystem-processes.html: a Cytoscape.js drill-down graph of
 * EVERY ecosystem process (lane -> process -> step/gateway), with produces/consumes
 * data edges, cross-process flow, cascade + lineage edges, and hook/validation-rule
 * metadata surfaced in the side-panel (not as graph nodes).
 *
 * Single source of truth split:
 *   - SSOT (harvested, NEVER hand-copied):
 *       · command SET                       → commands/**\/*.md
 *       · 24-artifact catalog + names       → docs/pmo/artifacts/*.md
 *       · gate id set + metadata            → docs/guide/ecosystem-map.overlay.json (gates)
 *       · validation rule id set + metadata → docs/guide/ecosystem-map.overlay.json (validation)
 *       · artifact tier / lineage / groups  → docs/guide/ecosystem-map.overlay.json (artifacts)
 *       · _build stamp (date, sha, counts)  → disk + git
 *   - EDITORIAL (hand-maintained) — docs/guide/process-graph.overlay.json:
 *       lanes; processes[] with steps[]; crossEdges; cascadeEdges.
 *
 * The merged DATA is injected (inert application/json) into the
 * `/*__PROCESS_DATA__*\/` token of docs/guide/ecosystem-processes.template.html.
 *
 * Run:
 *   node dev/meta-improvement/scripts/gen-process-map.cjs            (write HTML)
 *   node dev/meta-improvement/scripts/gen-process-map.cjs --selftest (integrity asserts only)
 *   node dev/meta-improvement/scripts/gen-process-map.cjs --check    (CI: non-zero if stale)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CMD_DIR = path.join(ROOT, 'commands');
const ART_DIR = path.join(ROOT, 'docs', 'pmo', 'artifacts');
const ECO_OVERLAY = path.join(ROOT, 'docs', 'guide', 'ecosystem-map.overlay.json');
const PROC_OVERLAY = path.join(ROOT, 'docs', 'guide', 'process-graph.overlay.json');
const TEMPLATE = path.join(ROOT, 'docs', 'guide', 'ecosystem-processes.template.html');
const OUT = path.join(ROOT, 'docs', 'guide', 'ecosystem-processes.html');
const REL_SELF = 'dev/meta-improvement/scripts/gen-process-map.cjs';
const TOKEN = '/*__PROCESS_DATA__*/';

const KIND_ENUM = new Set(['start', 'task', 'gateway', 'checkpoint', 'subprocess', 'end']);
const STATUS_ENUM = new Set(['shipped', 'partial', 'conditional', 'planned']);

// ─────────────────────────────── SSOT harvest ───────────────────────────────
function harvestCommandKeys() {
  const out = new Set();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const module = path.relative(CMD_DIR, p).split(path.sep)[0];
      out.add(`${module}:${path.basename(e.name, '.md')}`);
    }
  })(CMD_DIR);
  return out;
}

function harvestArtifactNames() {
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

function gitSha() {
  try {
    return cp.execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (_) { return ''; }
}

// ──────────────────────────────── assembly ────────────────────────────────
function assemble(proc, eco, ssot) {
  const { commandKeys, artifactNames } = ssot;
  const artIds = new Set(Object.keys(eco.artifacts));         // 24-type catalog (mirrored in eco overlay)
  const boundary = new Set(proc.boundaryObjects || []);
  const laneIds = new Set(proc.lanes.map((l) => l.id));

  // gate + rule metadata (from the ecosystem-map editorial SSOT).
  const gateMeta = {};
  for (const g of eco.gates) gateMeta[g.id] = { event: g.event, blocking: g.blocking, module: g.module, what: g.what, bypass: g.bypass, source: g.source };
  const gateIds = new Set(Object.keys(gateMeta));
  const ruleMeta = {};
  for (const grp of eco.validation.groups) for (const r of (grp.rules || [])) ruleMeta[r.id] = { scope: r.scope, severity: r.severity, what: r.what, group: grp.name };
  for (const pr of (eco.validation.processRules || [])) ruleMeta[pr.id] = { scope: pr.scope, severity: pr.severity, what: pr.what, group: 'Process rule' };
  const ruleIds = new Set(Object.keys(ruleMeta));

  // artifact meta + group placement.
  const artGroupOf = {};
  for (const g of eco.artifactGroups) for (const id of g.ids) artGroupOf[id] = g.id;
  const artMeta = {};
  for (const id of Object.keys(eco.artifacts)) {
    const a = eco.artifacts[id];
    artMeta[id] = { name: artifactNames[id] || id, tier: a.tier, cardinality: a.cardinality, lineageFrom: a.lineageFrom || [], lineageTo: a.lineageTo || [] };
  }

  const nodes = [];
  const edges = [];
  const procIds = new Set(proc.processes.map((p) => p.id));
  const stepIds = {}; // procId -> Set(stepId)

  // ── lane nodes (module pools) ──
  for (const l of proc.lanes) nodes.push({ data: { id: `lane:${l.id}`, label: l.label, kind: 'lane', color: l.color, what: l.what } });
  // ── artifacts pool + groups ──
  nodes.push({ data: { id: 'lane:artifacts', label: 'Артефакты · data objects', kind: 'lane', color: '#e3b341', what: '24 типа артефактов D1–D2 + boundary objects. Слои рёбер: produces / consumes / lineage / cascade.' } });
  for (const g of eco.artifactGroups) nodes.push({ data: { id: `grp:${g.id}`, parent: 'lane:artifacts', label: g.label, kind: 'artgroup' } });
  nodes.push({ data: { id: 'grp:boundary', parent: 'lane:artifacts', label: 'Boundary objects', kind: 'artgroup' } });
  for (const id of Object.keys(artMeta)) {
    nodes.push({ data: { id: `art:${id}`, parent: `grp:${artGroupOf[id] || 'cross'}`, label: id, kind: 'artifact', name: artMeta[id].name, tier: artMeta[id].tier, cardinality: artMeta[id].cardinality } });
  }
  for (const b of boundary) {
    nodes.push({ data: { id: `art:${b}`, parent: 'grp:boundary', label: b, kind: 'artifact', boundary: true, name: b === 'handoff' ? 'Universal handoff (13 секций)' : 'External spec (cc-sdd)' } });
  }

  // ── process + step nodes, data edges ──
  const artNode = (id) => `art:${id}`;
  for (const p of proc.processes) {
    nodes.push({ data: { id: `proc:${p.id}`, parent: `lane:${p.lane}`, label: p.label, kind: 'process', status: p.status, domain: p.domain, command: p.command, doc: p.doc, what: p.what } });
    stepIds[p.id] = new Set(p.steps.map((s) => s.id));
    for (const s of p.steps) {
      const nid = `s:${p.id}:${s.id}`;
      nodes.push({ data: {
        id: nid, parent: `proc:${p.id}`, label: s.label, kind: s.kind, status: p.status, process: p.id,
        what: s.what || '', review: s.review || '', hooks: s.hooks || [], rules: s.rules || [],
        produces: s.produces || [], consumes: s.consumes || [],
      } });
      for (const a of (s.produces || [])) edges.push({ source: nid, target: artNode(a), type: 'produces', label: '' });
      for (const a of (s.consumes || [])) edges.push({ source: artNode(a), target: nid, type: 'consumes', label: '' });
    }
  }

  // ── flow edges (control) ──
  for (const p of proc.processes) {
    const steps = p.steps;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const from = `s:${p.id}:${s.id}`;
      if (Array.isArray(s.next)) {
        for (const t of s.next) edges.push({ source: from, target: `s:${p.id}:${t}`, type: 'sequence', label: '' });
      } else if (i < steps.length - 1) {
        edges.push({ source: from, target: `s:${p.id}:${steps[i + 1].id}`, type: 'sequence', label: '' });
      }
      for (const a of (s.alt || [])) {
        if (stepIds[p.id].has(a.to)) edges.push({ source: from, target: `s:${p.id}:${a.to}`, type: 'sequence', label: a.label || '' });
        else if (procIds.has(a.to)) edges.push({ source: from, target: `proc:${a.to}`, type: a.type || 'delegate', label: a.label || '' });
      }
    }
  }
  // ── cross-process edges ──
  for (const ce of (proc.crossEdges || [])) edges.push({ source: `proc:${ce.from}`, target: `proc:${ce.to}`, type: ce.type, label: ce.label || '' });
  // ── cascade edges (artifact trigger) ──
  for (const c of (proc.cascadeEdges || [])) edges.push({ source: artNode(c.from), target: artNode(c.to), type: 'cascade', label: c.label || '' });
  // ── lineage edges (artifact DAG) ──
  for (const id of Object.keys(artMeta)) for (const t of artMeta[id].lineageTo) edges.push({ source: artNode(id), target: artNode(t), type: 'lineage', label: '' });

  // ── dedupe edges by (source,target,type); assign ids ──
  const seen = new Map();
  const outEdges = [];
  for (const e of edges) {
    const id = `${e.source}__${e.target}__${e.type}`;
    if (seen.has(id)) { if (!seen.get(id).label && e.label) seen.get(id).label = e.label; continue; }
    const obj = { id, source: e.source, target: e.target, type: e.type, label: e.label };
    seen.set(id, obj);
    outEdges.push({ data: obj });
  }

  const stepCount = proc.processes.reduce((n, p) => n + p.steps.length, 0);
  const usedHooks = new Set();
  const usedRules = new Set();
  for (const p of proc.processes) for (const s of p.steps) { (s.hooks || []).forEach((h) => usedHooks.add(h)); (s.rules || []).forEach((r) => usedRules.add(r)); }

  const DATA = {
    _build: {
      date: new Date().toISOString().slice(0, 10),
      sha: gitSha(),
      lanes: proc.lanes.length,
      processes: proc.processes.length,
      steps: stepCount,
      artifacts: artIds.size,
      hooks: usedHooks.size,
      rules: usedRules.size,
    },
    lanes: proc.lanes,
    nodes,
    edges: outEdges,
    meta: { gates: gateMeta, rules: ruleMeta, artifacts: artMeta },
  };
  Object.defineProperty(DATA, '__ctx', { value: { artIds, boundary, laneIds, gateIds, ruleIds, procIds, stepIds, commandKeys }, enumerable: false });
  return DATA;
}

// ──────────────────────────────── selftest ────────────────────────────────
function selftest(DATA, proc, eco, ssot) {
  const errs = [];
  const fail = (m) => errs.push(m);
  const { artIds, boundary, laneIds, gateIds, ruleIds, procIds, stepIds, commandKeys } = DATA.__ctx;
  const isArt = (id) => artIds.has(id) || boundary.has(id);

  // [1] lane refs.
  for (const p of proc.processes) if (!laneIds.has(p.lane)) fail(`[1] process ${p.id} lane "${p.lane}" not a declared lane`);

  // [2] process.command ∈ command set.
  for (const p of proc.processes) if (p.command && !commandKeys.has(p.command)) fail(`[2] process ${p.id} command "${p.command}" not a real command`);

  // [3] step kind enum + status enum.
  for (const p of proc.processes) {
    if (!STATUS_ENUM.has(p.status)) fail(`[3] process ${p.id} status "${p.status}" not in enum`);
    for (const s of p.steps) if (!KIND_ENUM.has(s.kind)) fail(`[3] step ${p.id}/${s.id} kind "${s.kind}" not in enum`);
  }

  // [4] produces/consumes ⊆ artifacts ∪ boundary.
  for (const p of proc.processes) for (const s of p.steps) {
    for (const a of (s.produces || [])) if (!isArt(a)) fail(`[4] step ${p.id}/${s.id} produces unknown id: ${a}`);
    for (const a of (s.consumes || [])) if (!isArt(a)) fail(`[4] step ${p.id}/${s.id} consumes unknown id: ${a}`);
  }

  // [5] hooks ⊆ gate ids; rules ⊆ validation rule ids.
  for (const p of proc.processes) for (const s of p.steps) {
    for (const h of (s.hooks || [])) if (!gateIds.has(h)) fail(`[5] step ${p.id}/${s.id} hook not a gate id: ${h}`);
    for (const r of (s.rules || [])) if (!ruleIds.has(r)) fail(`[5] step ${p.id}/${s.id} rule not a validation id: ${r}`);
  }

  // [6] next/alt resolution.
  for (const p of proc.processes) for (const s of p.steps) {
    for (const t of (s.next || [])) if (!stepIds[p.id].has(t)) fail(`[6] step ${p.id}/${s.id} next target unresolved: ${t}`);
    for (const a of (s.alt || [])) if (!stepIds[p.id].has(a.to) && !procIds.has(a.to)) fail(`[6] step ${p.id}/${s.id} alt target unresolved: ${a.to}`);
  }

  // [7] crossEdges + cascadeEdges resolution.
  for (const ce of (proc.crossEdges || [])) {
    if (!procIds.has(ce.from)) fail(`[7] crossEdge from unknown process: ${ce.from}`);
    if (!procIds.has(ce.to)) fail(`[7] crossEdge to unknown process: ${ce.to}`);
  }
  for (const c of (proc.cascadeEdges || [])) {
    if (!isArt(c.from)) fail(`[7] cascadeEdge from unknown artifact: ${c.from}`);
    if (!isArt(c.to)) fail(`[7] cascadeEdge to unknown artifact: ${c.to}`);
  }

  // [8] doc path (before #) exists on disk.
  for (const p of proc.processes) {
    if (!p.doc) continue;
    const file = p.doc.split('#')[0];
    if (!fs.existsSync(path.join(ROOT, file))) fail(`[8] process ${p.id} doc missing on disk: ${file}`);
  }

  // [9] every compound parent referenced by a node also exists as a node.
  const nodeIds = new Set(DATA.nodes.map((n) => n.data.id));
  for (const n of DATA.nodes) if (n.data.parent && !nodeIds.has(n.data.parent)) fail(`[9] node ${n.data.id} parent missing: ${n.data.parent}`);
  // [9b] every edge endpoint exists.
  for (const e of DATA.edges) {
    if (!nodeIds.has(e.data.source)) fail(`[9] edge ${e.data.id} source missing: ${e.data.source}`);
    if (!nodeIds.has(e.data.target)) fail(`[9] edge ${e.data.id} target missing: ${e.data.target}`);
  }

  // [10] _build counts sanity.
  if (DATA._build.artifacts !== 24) fail(`[10] expected 24 artifacts, got ${DATA._build.artifacts}`);
  if (DATA._build.processes !== proc.processes.length) fail(`[10] process count mismatch`);

  return errs;
}

// ──────────────────────────────── inject ────────────────────────────────
function injectPayload(template, DATA) {
  if (!template.includes(TOKEN)) throw new Error(`gen-process-map: injection marker ${TOKEN} not found in template.`);
  const payload = JSON.stringify(DATA, null, 2).replace(/</g, '\\u003c');
  return template.replace(TOKEN, payload);
}

const eol = (s) => s.replace(/\r\n/g, '\n');
const neutralizeDate = (s) => s.replace(/"date":\s*"\d{4}-\d{2}-\d{2}"/g, '"date": "____"');
const neutralizeSha = (s) => s.replace(/"sha":\s*"[0-9a-f]*"/g, '"sha": "____"');
const normalizeForCompare = (s) => neutralizeSha(neutralizeDate(eol(s)));

// ──────────────────────────────── main ────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const isCheck = argv.includes('--check');
  const isSelftest = argv.includes('--selftest');

  const proc = JSON.parse(fs.readFileSync(PROC_OVERLAY, 'utf8'));
  const eco = JSON.parse(fs.readFileSync(ECO_OVERLAY, 'utf8'));
  const ssot = { commandKeys: harvestCommandKeys(), artifactNames: harvestArtifactNames() };
  const DATA = assemble(proc, eco, ssot);

  const errs = selftest(DATA, proc, eco, ssot);
  if (errs.length) {
    console.error('gen-process-map: SELFTEST FAILED —');
    for (const e of errs) console.error('  ✗ ' + e);
    process.exit(1);
  }

  if (isSelftest) {
    console.log(`gen-process-map: ✓ selftest passed (${DATA._build.lanes} lanes · ${DATA._build.processes} processes · ${DATA._build.steps} steps · ${DATA.nodes.length} nodes · ${DATA.edges.length} edges)`);
    return;
  }

  if (!fs.existsSync(TEMPLATE)) {
    if (isCheck) { console.log(`gen-process-map: ✓ selftest passed; template not present yet — skipping HTML diff.`); return; }
    console.warn(`gen-process-map: selftest passed but template missing (${path.relative(ROOT, TEMPLATE)}) — HTML not written.`);
    return;
  }

  const fresh = injectPayload(fs.readFileSync(TEMPLATE, 'utf8'), DATA);
  if (isCheck) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (normalizeForCompare(current) !== normalizeForCompare(fresh)) {
      console.error(`gen-process-map: STALE — ${path.relative(ROOT, OUT)} differs. Run: node ${REL_SELF}`);
      process.exit(1);
    }
    console.log('gen-process-map: ✓ process map up to date');
    return;
  }

  fs.writeFileSync(OUT, fresh);
  console.log(`gen-process-map: wrote ${path.relative(ROOT, OUT)} — ${DATA._build.processes} processes · ${DATA._build.steps} steps · ${DATA.nodes.length} nodes · ${DATA.edges.length} edges · sha ${DATA._build.sha || '?'}`);
}

main();
