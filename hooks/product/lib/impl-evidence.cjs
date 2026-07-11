#!/usr/bin/env node
'use strict';
/**
 * impl-evidence.cjs — deterministic implementation-evidence collector for the
 * Product-side result-ingest command `/product:impl-sync` (gap G02).
 *
 * WHY THIS EXISTS (gap G02):
 *   The Product → handoff → adapter → external-tool chain is one-directional. Once a
 *   feature is handed off, the implementation RESULT never flows back into `.product/`,
 *   so `FM.status` stays `planned`/`in-progress` forever even after the feature ships.
 *   This lib is the deterministic SENSOR half of the fix: it re-derives, from GROUND
 *   TRUTH on disk, whether a feature actually got implemented — orchestrator run
 *   verdicts, completed Process-Fabric lines, external spec dirs, and handoff coverage
 *   — and hands a per-FM disposition to `/product:impl-sync`. The WRITE half (flipping
 *   `FM.status → shipped`) is owner-approve-gated inside the command; this lib NEVER
 *   writes `.product/` (or anywhere) — it only reads and reports. It is a sensor, not a
 *   gate: the CLI exits 0 on normal operation regardless of what it finds.
 *
 * REUSE, NOT COPY (orchestrate-don't-duplicate, precedent handoff-staleness.cjs):
 *   The canonical id-extraction / coverage regex algorithms are the single source of
 *   truth in orchestrator/lib/coverage-oracle.cjs (extractIds / extractSourceIds /
 *   computeCoverage). This lib REQUIRES that module and calls those functions — it does
 *   NOT reimplement the regexes. The relative path `../../../orchestrator/lib/…` holds
 *   both in this repo (hooks/… + orchestrator/…) and in a pilot (.claude/hooks/… +
 *   .claude/orchestrator/…, three levels up from hooks/product/lib/ == the shared root),
 *   so the reuse survives deployment. (slugify below is NOT an oracle algorithm — it is
 *   a small local mirror of the adapter's spec-dir slug, so external dirs can be matched
 *   by title as well as by FM-id.)
 *
 * MODEL (per FM):
 *   collectEvidence pulls from four fail-tolerant sources (a missing dir/file yields
 *   empty evidence, never a throw):
 *     - runs    : .claude/orchestrator/runs/<id>/run.json mentioning the FM → gate verdict
 *     - fabric  : .claude/orchestrator/fabric/<id>/state.json (FM mention OR subject in
 *                 handoff) → fabric_done when state === 'done'
 *     - external: .kiro/specs/<dir>/… mentioning the FM, or whose dir == slug(title)
 *     - handoff : .product/handoffs/<FM>-handoff.md → source SC/BR/IC ids (§5/§6/§9)
 *   checkV01 re-checks V-01 (shipped FM must have ≥1 active SC). computeImplCoverage is
 *   an ADVISORY coverage of handoff source-ids against external spec text (never a gate).
 *   disposition folds it all into one of six per-FM verdicts.
 *
 * Node stdlib only; cross-platform (path.join). Dual-use: require() the pure helpers
 * (unit-tested, tests/product/impl-evidence.test.cjs) or run as a CLI.
 *
 * CLI:  node impl-evidence.cjs [--root <path>] [--fm FM-001[,FM-002]] [--json] [--at <ISO>]
 *   Exit 0 always on normal operation (sensor, not gate); exit 2 on usage/internal error.
 *   Reads no secret/env values.
 */

const fs = require('fs');
const path = require('path');

// Hard reuse dependency: the coverage oracle owns the canonical id/coverage regexes.
// Deployed alongside the ecosystem (orchestrator/lib in the repo, .claude/orchestrator/lib
// in a pilot). If it is genuinely absent the reuse contract is broken — fail loud rather
// than silently reimplement the algorithms this lib promises to reuse.
let oracle;
try {
  oracle = require('../../../orchestrator/lib/coverage-oracle.cjs');
} catch (e) {
  throw new Error(`impl-evidence: cannot load coverage-oracle (reuse dependency): ${e.message}`);
}
const { extractIds, extractSourceIds, computeCoverage } = oracle;

const SCHEMA_VERSION = 1;
const GATE_VERDICTS = new Set(['GO', 'NO-GO', 'MANUAL_VERIFY_REQUIRED']);

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers (fail-tolerant I/O + EOL-tolerant frontmatter parse)
// ─────────────────────────────────────────────────────────────────────────────

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
}

function stripQuotes(s) { return String(s).replace(/^["']|["']$/g, ''); }

function tsOf(iso) { const t = Date.parse(iso); return Number.isFinite(t) ? t : -Infinity; }

/**
 * ASCII/dash slug — mirror of adapters/handoff-to-ccsdd.js slugify (spec-dir name).
 * Lets external evidence match a `.kiro/specs/<slug>/` dir by FM title, not just id.
 */
function slugify(title) {
  return String(title == null ? '' : title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

/**
 * The frontmatter block string (between the first `---` fences). EOL-tolerant per the
 * CRLF lesson (DEC-DEV-0190): the fence regex accepts `\r?\n`, and callers split on
 * `/\r?\n/` — never `.` before `$` to capture a value (that leaves a trailing `\r` on
 * CRLF checkouts).
 */
function frontmatterBlock(raw) {
  const m = String(raw == null ? '' : raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

/** Flat scalar frontmatter parse (first block). Tolerant, never throws. */
function parseFm(raw) {
  const out = {};
  for (const line of frontmatterBlock(raw).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * List-valued frontmatter field: handles inline flow (`key: [A, B]`) and block form
 * (`key:` then indented `- A`). Returns [] if absent/empty. EOL-tolerant.
 */
function fmList(block, key) {
  const lines = String(block).split(/\r?\n/);
  const head = new RegExp('^' + escapeRe(key) + ':[ \\t]*(.*)$');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(head);
    if (!m) continue;
    const inline = m[1].trim();
    if (inline && inline !== '[]') {
      return inline.replace(/^\[/, '').replace(/\]$/, '')
        .split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
    }
    const items = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const li = lines[j].match(/^\s+-\s+(.*)$/);
      if (li) { items.push(stripQuotes(li[1].trim())); continue; }
      if (/^\s*$/.test(lines[j])) continue;
      if (/^\S/.test(lines[j])) break; // next top-level key
      break;
    }
    return items.filter(Boolean);
  }
  return [];
}

/** First file in `dir` whose name is `<id>.md` or `<id>-*.md`; null if none. */
function globById(dir, id) {
  let files;
  try { files = fs.readdirSync(dir); } catch (_) { return null; }
  const hit = files.find((f) => f === `${id}.md` || f.startsWith(`${id}-`));
  return hit ? path.join(dir, hit) : null;
}

/** Read one FM's frontmatter into { id, file, status, title, scenarios[] }. */
function readFm(root, fmId) {
  const file = globById(path.join(root, '.product', 'features'), fmId);
  if (!file) return null;
  const raw = readFileSafe(file);
  if (raw == null) return null;
  const flat = parseFm(raw);
  return {
    id: flat.id || fmId,
    file,
    status: flat.status || null,
    title: flat.title ? stripQuotes(flat.title) : null,
    scenarios: fmList(frontmatterBlock(raw), 'scenarios'),
  };
}

/** All FM ids present under .product/features/ (deduped, sorted). */
function discoverFmIds(root) {
  const dir = path.join(root, '.product', 'features');
  let files;
  try { files = fs.readdirSync(dir); } catch (_) { return []; }
  const set = new Set();
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const m = f.match(/^(FM-\d+)/);
    if (m) set.add(m[1]);
  }
  return [...set].sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence sources (each fail-tolerant: absent dir/file → empty, never throw)
// ─────────────────────────────────────────────────────────────────────────────

/** handoff: .product/handoffs/<FM>-handoff.md → source SC/BR/IC ids (§5/§6/§9). */
function collectHandoffEvidence(root, fmId) {
  const raw = readFileSafe(path.join(root, '.product', 'handoffs', `${fmId}-handoff.md`));
  if (raw == null) {
    return { present: false, sourceIds: { scenarios: [], rules: [], invariants: [] }, raw: '' };
  }
  return { present: true, sourceIds: extractSourceIds(raw), raw };
}

/**
 * runs: .claude/orchestrator/runs/<id>/run.json mentioning the FM (id in the JSON dump,
 * or a substring hit in args_summary). Records each match + the LATEST gate verdict
 * (GO | NO-GO | MANUAL_VERIFY_REQUIRED) by finished_at across P5/P6-class gate runs.
 */
function collectRunsEvidence(root, fmId) {
  const base = path.join(root, '.claude', 'orchestrator', 'runs');
  const matches = [];
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch (_) { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const raw = readFileSafe(path.join(base, ent.name, 'run.json'));
    if (raw == null) continue;
    let run;
    try { run = JSON.parse(raw); } catch (_) { continue; }
    const dump = JSON.stringify(run);
    const mentioned = extractIds(dump, 'FM').includes(fmId)
      || (typeof run.args_summary === 'string' && run.args_summary.includes(fmId));
    if (!mentioned) continue;
    const rs = run.result_summary || {};
    matches.push({
      run_id: run.run_id || ent.name,
      process: run.process || null,
      status: run.status || null,
      result: rs.result != null ? rs.result : null,
      verdict: rs.verdict != null ? rs.verdict : null,
      readiness: rs.readiness != null ? rs.readiness : null,
      finished_at: run.finished_at || null,
    });
  }
  const gateRuns = matches
    .map((m) => ({ m, gate: GATE_VERDICTS.has(m.result) ? m.result : (GATE_VERDICTS.has(m.verdict) ? m.verdict : null) }))
    .filter((x) => x.gate != null)
    .sort((a, b) => tsOf(b.m.finished_at) - tsOf(a.m.finished_at));
  const latest = gateRuns.length ? gateRuns[0] : null;
  return {
    count: matches.length,
    matches,
    latest_gate: latest ? latest.gate : null,
    latest_gate_run_id: latest ? latest.m.run_id : null,
  };
}

/**
 * fabric: .claude/orchestrator/fabric/<id>/state.json where the FM is mentioned OR the
 * line's `subject` appears in the handoff text. fabric_done when any matched line is 'done'.
 */
function collectFabricEvidence(root, fmId, handoffRaw) {
  const base = path.join(root, '.claude', 'orchestrator', 'fabric');
  const instances = [];
  let done = false;
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch (_) { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const raw = readFileSafe(path.join(base, ent.name, 'state.json'));
    if (raw == null) continue;
    let st;
    try { st = JSON.parse(raw); } catch (_) { continue; }
    const mentionsFm = extractIds(JSON.stringify(st), 'FM').includes(fmId);
    const subj = typeof st.subject === 'string' ? st.subject.trim() : '';
    const subjInHandoff = subj.length >= 3 && handoffRaw && handoffRaw.includes(subj);
    if (!mentionsFm && !subjInHandoff) continue;
    const state = st.state || null;
    instances.push({ instance: st.instance || ent.name, state, charter_id: st.charter_id || null });
    if (state === 'done') done = true;
  }
  return { fabric_done: done, instances };
}

/**
 * external: .kiro/specs/<dir>/ whose files mention the FM, or whose dir name == slug(title).
 * Reads ALL top-level files of a matched dir (spec.json/requirements.md/design.md/tasks.md,
 * whatever is present) — not just spec.json. Returns dir listing + file texts (for coverage).
 */
function collectExternalEvidence(root, fmId, title) {
  const base = path.join(root, '.kiro', 'specs');
  const wantSlug = slugify(title || fmId);
  const dirs = [];
  const texts = [];
  let fileCount = 0;
  let entries;
  try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch (_) { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const dirPath = path.join(base, ent.name);
    let files;
    try { files = fs.readdirSync(dirPath, { withFileTypes: true }); } catch (_) { continue; }
    const fileNames = [];
    const fileTexts = [];
    for (const f of files) {
      if (!f.isFile()) continue;
      fileNames.push(f.name);
      const raw = readFileSafe(path.join(dirPath, f.name));
      if (raw != null) fileTexts.push(raw);
    }
    const mentionsFm = extractIds(fileTexts.join('\n'), 'FM').includes(fmId);
    const slugMatch = wantSlug && ent.name === wantSlug;
    if (!mentionsFm && !slugMatch) continue;
    dirs.push({ dir: ent.name, files: fileNames.sort() });
    for (const t of fileTexts) texts.push(t);
    fileCount += fileNames.length;
  }
  return { present: dirs.length > 0, dirs, texts, file_count: fileCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public pure API
// ─────────────────────────────────────────────────────────────────────────────

/** Collect all four evidence sources for one FM. Fail-tolerant throughout. */
function collectEvidence(opts) {
  const o = opts || {};
  const root = o.root;
  const fmId = o.fmId;
  const fm = readFm(root, fmId);
  const title = fm && fm.title ? fm.title : fmId;
  const handoff = collectHandoffEvidence(root, fmId);
  return {
    fm_id: fmId,
    runs: collectRunsEvidence(root, fmId),
    fabric: collectFabricEvidence(root, fmId, handoff.raw),
    external: collectExternalEvidence(root, fmId, title),
    handoff,
  };
}

/**
 * Advisory coverage of handoff source-ids (SC/BR/IC) against concatenated external spec
 * text. Returns the oracle's coverage result, or null when there is nothing to compare
 * (no handoff source-ids, or no external file). NOT a gate — advisory only.
 */
function computeImplCoverage(sourceIds, externalTexts) {
  const s = sourceIds || {};
  const total = (s.scenarios || []).length + (s.rules || []).length + (s.invariants || []).length;
  if (total === 0) return null;
  if (!Array.isArray(externalTexts) || externalTexts.length === 0) return null;
  return computeCoverage(s, externalTexts.join('\n'));
}

/**
 * V-01 re-check (docs/pmo/validation.md §5.1): a shipped FM must carry ≥1 SC from its
 * scenarios[] in status: active. EOL-tolerant SC status parse (CRLF lesson DEC-DEV-0190).
 */
function checkV01(root, fm) {
  const scenarios = fm && Array.isArray(fm.scenarios) ? fm.scenarios : [];
  if (scenarios.length === 0) {
    return { passed: false, active_scenarios: [], reason: 'FM lists no scenarios[] (V-01 needs ≥1 active SC)' };
  }
  const active = [];
  for (const sc of scenarios) {
    const file = globById(path.join(root, '.product', 'scenarios'), sc);
    if (!file) continue;
    const raw = readFileSafe(file);
    if (raw == null) continue;
    if (parseFm(raw).status === 'active') active.push(sc);
  }
  const passed = active.length >= 1;
  return {
    passed,
    active_scenarios: active,
    reason: passed
      ? `${active.length} active scenario(s): ${active.join(', ')}`
      : `no active scenario among [${scenarios.join(', ')}] (V-01 blocks shipped transition)`,
  };
}

/**
 * Per-FM verdict (first match top-down). Returns { fm_id, current_status, disposition,
 * evidence_summary, reasons[] }. GO evidence == latest_gate 'GO' OR (fabric done AND
 * external present). ready-to-ship additionally requires V-01 to pass.
 */
function disposition(fm, evidence, v01) {
  const status = fm && fm.status ? fm.status : null;
  const runsCount = evidence.runs.count;
  const latestGate = evidence.runs.latest_gate;
  const fabricDone = evidence.fabric.fabric_done;
  const extPresent = evidence.external.present;
  const hasGoEvidence = latestGate === 'GO' || (fabricDone && extPresent);
  const reasons = [];
  let d;

  if (status === 'shipped') {
    d = 'already-shipped';
    reasons.push('FM.status is already shipped — idempotent skip.');
  } else if (status === 'deprecated') {
    d = 'deprecated';
    reasons.push('FM.status is deprecated — never propose shipped.');
  } else if (runsCount === 0 && !fabricDone && !extPresent) {
    d = 'no-evidence';
    reasons.push('No orchestrator run, no completed fabric line, and no external spec dir mentions this FM.');
  } else if (latestGate === 'NO-GO' || latestGate === 'MANUAL_VERIFY_REQUIRED') {
    d = 'gate-not-passed';
    reasons.push(`Latest implementation gate = ${latestGate} (not GO) — shipping not justified.`);
  } else if (hasGoEvidence && !v01.passed) {
    d = 'validation-blocked';
    reasons.push('GO evidence present, but V-01 fails — shipped transition would be blocked by validation.');
    reasons.push(v01.reason);
  } else if (hasGoEvidence && v01.passed) {
    d = 'ready-to-ship';
    reasons.push(latestGate === 'GO'
      ? `GO gate (${evidence.runs.latest_gate_run_id || '?'}) + V-01 passed.`
      : 'Fabric line done + external spec present + V-01 passed.');
  } else {
    // Some activity found (a run matched, or fabric done alone, or external alone) but no
    // GO gate verdict and no failing gate → conservatively not ready. Bucketed under
    // gate-not-passed (the honest "no passing gate yet" label among the six verdicts).
    d = 'gate-not-passed';
    reasons.push('Activity found (run / fabric / external) but no GO gate verdict yet — shipping not justified.');
  }

  return {
    fm_id: fm ? fm.id : null,
    current_status: status,
    disposition: d,
    evidence_summary: {
      runs: runsCount,
      latest_gate: latestGate,
      fabric_done: fabricDone,
      external_files: evidence.external.file_count,
      v01_passed: v01.passed,
    },
    reasons,
  };
}

/** Strip raw/texts from an evidence object before it goes into the emitted record. */
function emitEvidence(ev) {
  return {
    runs: {
      count: ev.runs.count,
      latest_gate: ev.runs.latest_gate,
      latest_gate_run_id: ev.runs.latest_gate_run_id,
      matches: ev.runs.matches,
    },
    fabric: { fabric_done: ev.fabric.fabric_done, instances: ev.fabric.instances },
    external: { present: ev.external.present, file_count: ev.external.file_count, dirs: ev.external.dirs },
    handoff: {
      present: ev.handoff.present,
      source_id_counts: {
        scenarios: ev.handoff.sourceIds.scenarios.length,
        rules: ev.handoff.sourceIds.rules.length,
        invariants: ev.handoff.sourceIds.invariants.length,
      },
    },
  };
}

/**
 * Scan a project. If fmIds is omitted/empty, scans every .product/features/FM-*.md.
 * Returns { schema_version, generated_at, results:[…], summary }. `at` (ISO) overrides
 * the wall clock for the generated_at stamp (test determinism).
 */
function scanProject(opts) {
  const o = opts || {};
  const root = o.root || process.cwd();
  const generatedAt = o.at || new Date().toISOString();
  let ids = o.fmIds;
  if (!Array.isArray(ids) || ids.length === 0) ids = discoverFmIds(root);

  const results = [];
  const summary = { total: 0, ready: 0, blocked: 0, no_evidence: 0, already_shipped: 0, deprecated: 0 };

  for (const fmId of ids) {
    const fm = readFm(root, fmId) || { id: fmId, status: null, scenarios: [] };
    const evidence = collectEvidence({ root, fmId });
    const v01 = checkV01(root, fm);
    const coverage = computeImplCoverage(evidence.handoff.sourceIds, evidence.external.texts);
    const disp = disposition(fm, evidence, v01);

    results.push(Object.assign({}, disp, { v01, coverage, evidence: emitEvidence(evidence) }));

    summary.total += 1;
    if (disp.disposition === 'ready-to-ship') summary.ready += 1;
    else if (disp.disposition === 'validation-blocked' || disp.disposition === 'gate-not-passed') summary.blocked += 1;
    else if (disp.disposition === 'no-evidence') summary.no_evidence += 1;
    else if (disp.disposition === 'already-shipped') summary.already_shipped += 1;
    else if (disp.disposition === 'deprecated') summary.deprecated += 1;
  }

  return { schema_version: SCHEMA_VERSION, generated_at: generatedAt, results, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

function renderHuman(report) {
  const out = ['Implementation-evidence scan (Product-side; read-only, sensor — never writes .product/)'];
  out.push(`  generated_at: ${report.generated_at}`);
  if (report.results.length === 0) {
    out.push('  (no FM found under .product/features/)');
  }
  for (const r of report.results) {
    const ev = r.evidence;
    const cov = r.coverage ? `coverage_missing ${r.coverage.missing_count}` : 'coverage n/a';
    out.push('');
    out.push(`  ${r.fm_id}  [${r.current_status || '?'}]  → ${r.disposition.toUpperCase()}`);
    out.push(`      runs ${ev.runs.count} (latest gate: ${ev.runs.latest_gate || 'none'})`
      + ` · fabric_done ${ev.fabric.fabric_done}`
      + ` · external files ${ev.external.file_count}`
      + ` · V-01 ${r.v01.passed ? 'pass' : 'FAIL'} · ${cov}`);
    for (const reason of r.reasons) out.push(`      - ${reason}`);
  }
  const s = report.summary;
  out.push('');
  out.push(`Summary: ${s.total} FM · ${s.ready} ready-to-ship · ${s.blocked} blocked`
    + ` · ${s.no_evidence} no-evidence · ${s.already_shipped} already-shipped`
    + (s.deprecated ? ` · ${s.deprecated} deprecated.` : '.'));
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI seam
// ─────────────────────────────────────────────────────────────────────────────

const VALUE_FLAGS = new Set(['--root', '--fm', '--at']);

function parseArgs(argv) {
  const a = { root: process.cwd(), json: false, fm: null, at: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--json') { a.json = true; continue; }
    if (t === '--help' || t === '-h') { a.help = true; continue; }
    if (VALUE_FLAGS.has(t)) {
      const v = argv[i + 1];
      if (v === undefined) return { error: `${t} requires a value` };
      i += 1;
      if (t === '--root') a.root = v;
      else if (t === '--fm') a.fm = v;
      else if (t === '--at') a.at = v;
      continue;
    }
    return { error: `unknown argument: ${t}` };
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'impl-evidence.cjs — deterministic implementation-evidence collector for /product:impl-sync (gap G02).',
    '',
    'Usage:',
    '  node impl-evidence.cjs [--root <path>] [--fm FM-001[,FM-002]] [--json] [--at <ISO>]',
    '',
    '  --root <path>   project root containing .product/ (default: cwd)',
    '  --fm  <ids>     comma-separated FM ids to scan (default: all .product/features/FM-*.md)',
    '  --json          machine-readable JSON (default: human report)',
    '  --at  <ISO>     override the generated_at timestamp (test determinism)',
    '',
    'Read-only sensor — never writes .product/ and reads no secret/env values.',
    `Exit 0 always on normal operation; exit 2 on usage/internal error. schema_version ${SCHEMA_VERSION}.`,
  ].join('\n') + '\n');
}

function cliMain(argv) {
  const a = parseArgs(argv);
  if (a.error) { process.stderr.write(`ERROR: ${a.error}\n`); printHelp(); return 2; }
  if (a.help) { printHelp(); return 0; }
  const fmIds = a.fm ? a.fm.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const report = scanProject({ root: path.resolve(a.root), fmIds, at: a.at });
  if (a.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else process.stdout.write(renderHuman(report) + '\n');
  return 0;
}

if (require.main === module) {
  try {
    process.exit(cliMain(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`[impl-evidence] internal error: ${(e && e.stack) || e}\n`);
    process.exit(2);
  }
}

module.exports = {
  SCHEMA_VERSION,
  // pure API
  collectEvidence,
  computeImplCoverage,
  checkV01,
  disposition,
  scanProject,
  // reporting + CLI (for tests)
  renderHuman,
  cliMain,
  parseArgs,
  // helpers exposed for tests / reuse-liveness assertions
  slugify,
  parseFm,
  fmList,
  frontmatterBlock,
  extractIds,
  extractSourceIds,
};
