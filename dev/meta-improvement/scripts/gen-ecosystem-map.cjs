#!/usr/bin/env node
/**
 * gen-ecosystem-map.cjs — Tier-2 anti-drift generator for the interactive
 * ecosystem map (sibling of gen-command-catalog.cjs, DEC-DEV-0105).
 *
 * Single source of truth split:
 *   - SSOT (harvested at runtime, NEVER hand-copied into the overlay):
 *       · command SET + frontmatter description/argument-hint  → commands/**\/*.md
 *       · artifact SET + canonical names (24 types)            → docs/pmo/artifacts/*.md
 *       · validation canonical rule count                      → docs/pmo/validation.md
 *       · gate source-file existence                           → hooks/** , dev/meta-improvement/**
 *       · _build stamp (date, git sha, live counts)            → disk + git
 *   - EDITORIAL (hand-maintained) — docs/guide/ecosystem-map.overlay.json:
 *       per-command {status, st, when, arg, tags, produces, consumes, ro, source},
 *       per-artifact {tier, cardinality, lineageFrom, lineageTo}, pipeline lanes,
 *       module meta, gates, processes, validation group summary, glossary, tasks, roadmap.
 *
 * The two are MERGED into a single DATA object and injected (as inert
 * application/json) into the `/*__MAP_DATA__*\/` token of
 * docs/guide/ecosystem-map.template.html, producing docs/guide/ecosystem-map.html.
 * No hand-written inline data arrays survive in the template — regenerate, don't edit.
 *
 * Run:
 *   node dev/meta-improvement/scripts/gen-ecosystem-map.cjs            (write HTML)
 *   node dev/meta-improvement/scripts/gen-ecosystem-map.cjs --selftest (integrity asserts only)
 *   node dev/meta-improvement/scripts/gen-ecosystem-map.cjs --check    (CI: non-zero if stale)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
let yaml = null;
try { yaml = require('js-yaml'); } catch (_) { /* fallback to regex parse */ }

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CMD_DIR = path.join(ROOT, 'commands');
const ART_DIR = path.join(ROOT, 'docs', 'pmo', 'artifacts');
const VALIDATION_MD = path.join(ROOT, 'docs', 'pmo', 'validation.md');
const OVERLAY = path.join(ROOT, 'docs', 'guide', 'ecosystem-map.overlay.json');
const TEMPLATE = path.join(ROOT, 'docs', 'guide', 'ecosystem-map.template.html');
const OUT = path.join(ROOT, 'docs', 'guide', 'ecosystem-map.html');
const REL_SELF = 'dev/meta-improvement/scripts/gen-ecosystem-map.cjs';
const TOKEN = '/*__MAP_DATA__*/';

// Canonical pipeline lane ids — also derived from overlay.pipeline; kept here as
// the closed enum the selftest validates command.st membership against.
const STATUS_ENUM = ['shipped', 'partial', 'conditional', 'planned'];
const OVERLAY_TOP_KEYS = new Set([
  '_doc', 'boundaryObjects', 'pipeline', 'modules', 'commands', 'artifacts',
  'artifactGroups', 'gates', 'processes', 'validation', 'glossary', 'tasks', 'roadmap',
]);

// ─────────────────────────── frontmatter (sibling parser) ───────────────────────────
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

// ─────────────────────────────── SSOT harvest ───────────────────────────────
function harvestCommands() {
  const out = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const module = path.relative(CMD_DIR, p).split(path.sep)[0];
      const name = path.basename(e.name, '.md');
      const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
      out.push({
        module,
        name,
        key: `${module}:${name}`,
        desc: String(fm.description || '').trim(),
        argHint: String(fm['argument-hint'] || '').trim(),
      });
    }
  }
  walk(CMD_DIR);
  return out;
}

function harvestArtifacts() {
  // id → canonical name parsed from the H1 of docs/pmo/artifacts/<ID>.md.
  const names = {};
  for (const f of fs.readdirSync(ART_DIR)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    const id = path.basename(f, '.md');
    const txt = fs.readFileSync(path.join(ART_DIR, f), 'utf8');
    const h1 = (txt.match(/^#\s+(.+?)\s*$/m) || [])[1] || id;
    // "FM-* — Feature Map Entry" / "PS — Problem Statement" → take text after em-dash.
    const parts = h1.split(/\s+[—–-]\s+/);
    names[id] = (parts.length > 1 ? parts.slice(1).join(' — ') : h1).trim();
  }
  return names;
}

function harvestValidationCount() {
  const txt = fs.readFileSync(VALIDATION_MD, 'utf8');
  const m = txt.match(/(\d+)\s+активных правил/);
  if (!m) throw new Error(`gen-ecosystem-map: could not parse "N активных правила" from ${VALIDATION_MD}`);
  return parseInt(m[1], 10);
}

function gitSha() {
  try {
    return cp.execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (_) { return ''; }
}

// ──────────────────────────────── assembly ────────────────────────────────
function assemble(overlay, ssot) {
  const { commands: cmdFiles, artifactNames, validationCount } = ssot;
  const fileByKey = new Map(cmdFiles.map((c) => [c.key, c]));

  // Modules + per-command merge (SSOT desc/argHint × editorial overlay fields).
  const modules = {};
  for (const modId of Object.keys(overlay.modules)) {
    const m = overlay.modules[modId];
    modules[modId] = { id: modId, name: m.name, color: m.color, dom: m.dom, blurb: m.blurb, commands: [] };
  }
  // Build commands in deterministic (module-insertion, then name) order.
  const byModule = {};
  for (const c of cmdFiles) (byModule[c.module] = byModule[c.module] || []).push(c);
  const allCommands = [];
  for (const modId of Object.keys(modules)) {
    const list = (byModule[modId] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const f of list) {
      const ov = overlay.commands[f.key] || {};
      const arg = (typeof ov.arg === 'string' && ov.arg.trim()) ? ov.arg : f.argHint;
      const cmd = {
        cmd: `/${f.key}`,
        id: f.key,
        module: f.module,
        name: f.name,
        st: ov.st,
        status: ov.status,
        desc: f.desc,                 // SSOT frontmatter description
        arg,                          // editorial, fallback to frontmatter argument-hint
        when: ov.when || '',
        tags: ov.tags || '',
        produces: Array.isArray(ov.produces) ? ov.produces.slice() : [],
        consumes: Array.isArray(ov.consumes) ? ov.consumes.slice() : [],
        source: ov.source || `commands/${f.module}/${f.name}.md`,
      };
      if (ov.ro) cmd.ro = true;
      modules[modId].commands.push(cmd);
      allCommands.push(cmd);
    }
  }

  // Reverse-index produces/consumes → artifact producedBy/consumedBy (artifact ids only).
  const artifactIds = new Set(Object.keys(overlay.artifacts));
  const producedBy = {};
  const consumedBy = {};
  for (const id of artifactIds) { producedBy[id] = []; consumedBy[id] = []; }
  for (const c of allCommands) {
    for (const p of c.produces) if (artifactIds.has(p)) producedBy[p].push(c.id);
    for (const u of c.consumes) if (artifactIds.has(u)) consumedBy[u].push(c.id);
  }

  // Artifacts grouped per overlay.artifactGroups order.
  const artifacts = [];
  for (const g of overlay.artifactGroups) {
    const items = g.ids.map((id) => {
      const a = overlay.artifacts[id] || {};
      return {
        id,
        name: artifactNames[id] || id,
        tier: a.tier,
        cardinality: a.cardinality,
        lineageFrom: Array.isArray(a.lineageFrom) ? a.lineageFrom.slice() : [],
        lineageTo: Array.isArray(a.lineageTo) ? a.lineageTo.slice() : [],
        producedBy: producedBy[id] || [],
        consumedBy: consumedBy[id] || [],
      };
    });
    artifacts.push({ group: { id: g.id, label: g.label }, items });
  }

  // Flattened lineage edges (producer→artifact→consumer DAG source).
  const lineage = [];
  for (const id of Object.keys(overlay.artifacts)) {
    const to = overlay.artifacts[id].lineageTo || [];
    for (const t of to) lineage.push({ from: id, to: t });
  }

  const DATA = {
    _build: {
      date: new Date().toISOString().slice(0, 10),
      sha: gitSha(),
      commands: cmdFiles.length,
      artifacts: artifactIds.size,
      rules: overlay.validation.count,
      gates: overlay.gates.length,
      processes: overlay.processes.length,
    },
    pipeline: overlay.pipeline,
    modules,
    artifacts,
    lineage,
    gates: overlay.gates,
    processes: overlay.processes,
    validation: overlay.validation,
    glossary: overlay.glossary,
    tasks: overlay.tasks,
    roadmap: overlay.roadmap,
    boundaryObjects: overlay.boundaryObjects,
  };
  // Stash non-emitted cross-refs for selftest convenience.
  Object.defineProperty(DATA, '__cmdKeys', { value: new Set(fileByKey.keys()), enumerable: false });
  Object.defineProperty(DATA, '__validationCount', { value: validationCount, enumerable: false });
  Object.defineProperty(DATA, '__allCommands', { value: allCommands, enumerable: false });
  Object.defineProperty(DATA, '__producedBy', { value: producedBy, enumerable: false });
  Object.defineProperty(DATA, '__consumedBy', { value: consumedBy, enumerable: false });
  return DATA;
}

// ──────────────────────────────── selftest ────────────────────────────────
function selftest(DATA, overlay, ssot) {
  const errs = [];
  const fail = (msg) => errs.push(msg);
  const cmdKeys = new Set(Object.keys(overlay.commands));
  const fileKeys = new Set(ssot.commands.map((c) => c.key));
  const artifactIds = Object.keys(overlay.artifacts);
  const artifactIdSet = new Set(artifactIds);
  const boundary = new Set(overlay.boundaryObjects || []);
  const laneIds = new Set(overlay.pipeline.map((p) => p.id));

  // [14] JSON validity + no unknown top-level overlay keys.
  for (const k of Object.keys(overlay)) {
    if (!OVERLAY_TOP_KEYS.has(k)) fail(`[14] unknown top-level overlay key: "${k}"`);
  }

  // [1] Command SET parity (bidirectional).
  for (const fk of fileKeys) if (!cmdKeys.has(fk)) fail(`[1] command file without overlay entry: ${fk}`);
  for (const ck of cmdKeys) if (!fileKeys.has(ck)) fail(`[1] overlay.commands key without command file: ${ck}`);

  // [2] Counts parity.
  const catalogCount = ssot.commands.length;
  if (DATA._build.commands !== catalogCount) fail(`[2] _build.commands ${DATA._build.commands} != ${catalogCount} command files`);
  if (DATA._build.artifacts !== artifactIds.length) fail(`[2] _build.artifacts ${DATA._build.artifacts} != ${artifactIds.length} overlay artifacts`);
  if (DATA._build.rules !== overlay.validation.count) fail(`[2] _build.rules ${DATA._build.rules} != validation.count ${overlay.validation.count}`);
  if (DATA._build.gates !== overlay.gates.length) fail(`[2] _build.gates ${DATA._build.gates} != gates.length ${overlay.gates.length}`);
  if (DATA._build.processes !== overlay.processes.length) fail(`[2] _build.processes ${DATA._build.processes} != processes.length ${overlay.processes.length}`);

  // [3] Artifact-id parity vs catalog (exactly 24, no extra/missing).
  const catalogIds = new Set(Object.keys(ssot.artifactNames));
  for (const id of artifactIds) if (!catalogIds.has(id)) fail(`[3] overlay artifact id not in catalog: ${id}`);
  for (const id of catalogIds) if (!artifactIdSet.has(id)) fail(`[3] catalog artifact id missing from overlay: ${id}`);
  if (artifactIds.length !== 24) fail(`[3] expected 24 artifact ids, got ${artifactIds.length}`);

  // [4] produces/consumes membership ⊆ (artifact ids ∪ boundaryObjects).
  for (const c of DATA.__allCommands) {
    for (const p of c.produces) if (!artifactIdSet.has(p) && !boundary.has(p)) fail(`[4] ${c.id} produces unknown id: ${p}`);
    for (const u of c.consumes) if (!artifactIdSet.has(u) && !boundary.has(u)) fail(`[4] ${c.id} consumes unknown id: ${u}`);
  }

  // [5] Stage membership: command.st ∈ pipeline lane ids.
  for (const c of DATA.__allCommands) {
    if (!laneIds.has(c.st)) fail(`[5] ${c.id} has st="${c.st}" not in pipeline lanes`);
    if (!STATUS_ENUM.includes(c.status)) fail(`[10] ${c.id} status="${c.status}" not in enum`);
  }

  // [6] Lineage membership: lineageFrom/To ⊆ artifact ids.
  for (const id of artifactIds) {
    const a = overlay.artifacts[id];
    for (const x of a.lineageFrom || []) if (!artifactIdSet.has(x)) fail(`[6] ${id}.lineageFrom unknown id: ${x}`);
    for (const x of a.lineageTo || []) if (!artifactIdSet.has(x)) fail(`[6] ${id}.lineageTo unknown id: ${x}`);
  }

  // [7] Reverse-index closure: producedBy/consumedBy == exact set of command ids.
  const expectProd = {}; const expectCons = {};
  for (const id of artifactIds) { expectProd[id] = new Set(); expectCons[id] = new Set(); }
  for (const c of DATA.__allCommands) {
    for (const p of c.produces) if (artifactIdSet.has(p)) expectProd[p].add(c.id);
    for (const u of c.consumes) if (artifactIdSet.has(u)) expectCons[u].add(c.id);
  }
  for (const grp of DATA.artifacts) {
    for (const a of grp.items) {
      const ep = expectProd[a.id]; const ec = expectCons[a.id];
      const gotP = new Set(a.producedBy); const gotC = new Set(a.consumedBy);
      if (ep.size !== gotP.size || [...ep].some((x) => !gotP.has(x))) fail(`[7] ${a.id}.producedBy mismatch`);
      if (ec.size !== gotC.size || [...ec].some((x) => !gotC.has(x))) fail(`[7] ${a.id}.consumedBy mismatch`);
    }
  }

  // [8] validation count cross-checks.
  if (overlay.validation.count !== DATA.__validationCount) {
    fail(`[8] overlay.validation.count ${overlay.validation.count} != parsed validation.md ${DATA.__validationCount}`);
  }
  let groupSum = 0;
  for (const g of overlay.validation.groups) {
    groupSum += g.count;
    if ((g.rules || []).length > g.count) fail(`[8] group ${g.id} lists ${g.rules.length} rules > declared count ${g.count}`);
    if (!cmdKeys.has(g.linkCommand)) fail(`[13] validation group ${g.id} linkCommand not a command: ${g.linkCommand}`);
  }
  if (groupSum !== overlay.validation.count) fail(`[8] sum(groups.count) ${groupSum} != validation.count ${overlay.validation.count}`);

  // [9] Gate source existence on disk.
  for (const g of overlay.gates) {
    if (!fs.existsSync(path.join(ROOT, g.source))) fail(`[9] gate ${g.id} source missing on disk: ${g.source}`);
    if (typeof g.blocking !== 'boolean') fail(`[9] gate ${g.id} blocking must be boolean`);
  }

  // [10] roadmap status enum + must be planned.
  for (const r of overlay.roadmap) {
    if (!STATUS_ENUM.includes(r.status)) fail(`[10] roadmap ${r.id} status="${r.status}" not in enum`);
    if (r.status !== 'planned') fail(`[10] roadmap ${r.id} must be status=planned, got ${r.status}`);
  }

  // [11] Process command refs.
  for (const p of overlay.processes) {
    for (const cid of p.commands || []) if (!cmdKeys.has(cid)) fail(`[11] process ${p.id} refs unknown command: ${cid}`);
  }

  // [12] Task command refs.
  for (const t of overlay.tasks) if (!cmdKeys.has(t.cmd)) fail(`[12] task refs unknown command: ${t.cmd}`);

  return errs;
}

// ──────────────────────────────── inject ────────────────────────────────
function injectPayload(template, DATA) {
  if (!template.includes(TOKEN)) {
    throw new Error(`gen-ecosystem-map: injection marker ${TOKEN} not found in template — cannot inject.`);
  }
  // Inert application/json; escape '<' as < so embedded "<" (e.g. "magnitude <
  // min_magnitude") and any "</script>" cannot break out of the script tag.
  const payload = JSON.stringify(DATA, null, 2).replace(/</g, '\\u003c');
  return template.replace(TOKEN, payload);
}

const eol = (s) => s.replace(/\r\n/g, '\n');
// _build.date and _build.sha are volatile provenance (date rolls over daily; sha changes
// on EVERY commit, including the merge commit a PR lands as) — neutralize BOTH before the
// staleness compare, otherwise --check false-positives "STALE" after any merge or overnight
// even though no content drifted. The structural counts in _build stay byte-checked.
const neutralizeDate = (s) => s.replace(/"date":\s*"\d{4}-\d{2}-\d{2}"/g, '"date": "____"');
const neutralizeSha = (s) => s.replace(/"sha":\s*"[0-9a-f]*"/g, '"sha": "____"');
const normalizeForCompare = (s) => neutralizeSha(neutralizeDate(eol(s)));

function buildHtml(DATA) {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  return injectPayload(template, DATA);
}

// ──────────────────────────────── main ────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const isCheck = argv.includes('--check');
  const isSelftest = argv.includes('--selftest');

  const overlay = JSON.parse(fs.readFileSync(OVERLAY, 'utf8'));
  const ssot = {
    commands: harvestCommands(),
    artifactNames: harvestArtifacts(),
    validationCount: harvestValidationCount(),
  };
  const DATA = assemble(overlay, ssot);

  // Integrity asserts always run (generate / --selftest / --check).
  const errs = selftest(DATA, overlay, ssot);
  if (errs.length) {
    console.error('gen-ecosystem-map: SELFTEST FAILED —');
    for (const e of errs) console.error('  ✗ ' + e);
    process.exit(1);
  }

  if (isSelftest) {
    console.log(`gen-ecosystem-map: ✓ selftest passed (${DATA._build.commands} cmds · ${DATA._build.artifacts} artifacts · ${DATA._build.rules} rules · ${DATA._build.gates} gates · ${DATA._build.processes} processes)`);
    return;
  }

  // Template built in parallel — tolerate its absence during the build window.
  if (!fs.existsSync(TEMPLATE)) {
    if (isCheck) {
      console.log(`gen-ecosystem-map: ✓ selftest passed; template not present yet (${path.relative(ROOT, TEMPLATE)}) — skipping HTML diff.`);
      return;
    }
    console.warn(`gen-ecosystem-map: selftest passed but template missing (${path.relative(ROOT, TEMPLATE)}) — HTML not written. Build the template, then re-run.`);
    return;
  }

  const fresh = buildHtml(DATA);

  if (isCheck) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (normalizeForCompare(current) !== normalizeForCompare(fresh)) {
      console.error(`gen-ecosystem-map: STALE — ${path.relative(ROOT, OUT)} differs from generated DATA. Run: node ${REL_SELF}`);
      process.exit(1);
    }
    console.log('gen-ecosystem-map: ✓ map up to date');
    return;
  }

  fs.writeFileSync(OUT, fresh);
  console.log(`gen-ecosystem-map: wrote ${path.relative(ROOT, OUT)} — ${DATA._build.commands} cmds · ${DATA._build.artifacts} artifacts · ${DATA._build.rules} rules · sha ${DATA._build.sha || '?'}`);
}

main();
