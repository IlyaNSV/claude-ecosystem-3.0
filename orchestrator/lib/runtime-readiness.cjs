#!/usr/bin/env node
/**
 * runtime-readiness.cjs — deterministic core of the Orchestrator P7
 * `runtime-smoke-readiness` process (DEC-DEV-0120).
 *
 * WHY THIS EXISTS (RUN 01 P7 / E6 empirical, SPEC §3.2 P7):
 *   P6 answers "are the tests green + does it build?" — and a feature can pass that
 *   gate yet NOT actually start. RUN 01's runtime-smoke leg (#2129–2158) booted the
 *   dev server with 223 GREEN tests and got a 500: the process never loaded `.env`,
 *   plus 5 infra gaps. The lesson P2-1 recorded: "223 tests green ≠ application
 *   starts." P7 is the gate that closes that gap — the last check before the
 *   "до прода" segment (Vision Epic E). This lib is its deterministic heart: given a
 *   feature's run target + its §6 capability dispositions + the env readiness, decide
 *   whether a runtime smoke is even ATTEMPTABLE, and if not, WHY (and what §6 request
 *   to emit). The actual boot+diagnose is an agent step in the process; the live grade
 *   is substrate-gated (needs Integrator D3-runtime) and deferred — see below.
 *
 * COMPOSES §6, DOES NOT DUPLICATE IT (DEC-DEV-0117):
 *   The boot-blocking capabilities are the SAME `external_capabilities` manifest the
 *   5A detect-leg dispositions. P7 does NOT re-implement disposition — the process runs
 *   capability-probe.cjs first and feeds its surfaced items in here as `capabilities`.
 *   A capability with disposition BLOCK (absent secret, no dev stand-in) is a hard boot
 *   blocker → emit a §6 capability-request (route Integrator for access / Product for an
 *   undecided provider). A DEFERRED cap (a dev stand-in covers it) does NOT block the
 *   boot — it boots against the stand-in, which is DISCLOSED (mock-only boot ≠ prod-ready).
 *
 * TWO-AXIS CONTRACT (consistent with env-readiness.cjs / the gate contract):
 *   verdict   ∈ {READY_TO_SMOKE, BLOCKED_ON_CAPABILITY, ENV_NOT_READY, NOT_STARTABLE}
 *   readiness ∈ {READY, DEGRADED, ENV_NOT_READY} is an INPUT (env-readiness.cjs produces
 *   it upstream). A DEGRADED env does not block the smoke — it is disclosed.
 *
 * WHAT IS DETERMINISTIC HERE (offline, unit-tested) vs SUBSTRATE-GATED (deferred):
 *   The verdict synthesis, the run-target detection, the §6 request build, and the
 *   smoke plan (the success-signals / failure-class taxonomy from RUN 01) are pure and
 *   tested below. The LIVE boot+diagnose on a real GO'd feature, and the full Epic E
 *   deploy/provisioning round-trip, need Integrator D3-runtime tooling that does not
 *   exist yet — they are deferred (Epic E preconditions; SPEC §8 parks deploy/P7).
 *
 * DEF-4 — WORKSPACE / MONOREPO RUN TARGETS (DEC-DEV-0168, PA-056):
 *   The root package.json is NOT the only source of a run target. A live graduation run hit
 *   a pnpm-monorepo whose dev scripts live in `apps/<pkg>/package.json` — the root declares none,
 *   so the old single-manifest probe short-circuited to a FALSE NOT_STARTABLE. Fix (additive,
 *   soft-migration — absence of the new fields == old behaviour 1:1): when the root manifest
 *   declares no run target, the CLI scans workspace packages (pnpm-workspace.yaml + root
 *   `workspaces`) and detectWorkspaceRunTargets() ranks the candidates deterministically. The
 *   pure assessReadiness() takes optional origin/candidates/scan-notes and DISCLOSES a
 *   workspace-sourced target, ambiguity across >1 candidate (pin with --app <dir>), and any
 *   honest glob-parse limitation. The verdict enum is UNCHANGED.
 *
 * Like env-readiness.cjs / capability-probe.cjs: an agent runs this via Bash and RELAYS
 * its JSON — the Workflow script may not touch FS / child_process (DEC-DEV-0073 §D.1).
 * Node stdlib only; cross-platform.
 *
 * EXIT CODES: 0 ran ok (JSON on stdout) · 2 usage/internal error.
 * Dual-use: require() it for the pure functions (unit-tested), or run as a CLI.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RUNTIME_READINESS_SCHEMA_VERSION = 1;

// Runtime-smoke verdict (can we attempt a boot, and if not, why).
const VERDICT = {
  READY_TO_SMOKE: 'READY_TO_SMOKE',           // run target present, no boot-blocking cap, env not down → attempt boot
  BLOCKED_ON_CAPABILITY: 'BLOCKED_ON_CAPABILITY', // a boot-required capability is BLOCK → emit §6 request (OD7 await — deferred)
  ENV_NOT_READY: 'ENV_NOT_READY',             // a used substrate is provably down → transient; bring env up (not a §6 gap)
  NOT_STARTABLE: 'NOT_STARTABLE',             // no run target declared → cannot even attempt (scaffold/spec gap, route Product)
};

// The readiness axis this lib CONSUMES (env-readiness.cjs vocabulary).
const READINESS = { READY: 'READY', DEGRADED: 'DEGRADED', ENV_NOT_READY: 'ENV_NOT_READY' };

// Where a surfaced runtime gap routes.
const ROUTE = { INTEGRATOR: 'Integrator', PRODUCT: 'Product' };

// Capability disposition values P7 reads from capability-probe's surfaced items.
const BLOCK = 'BLOCK';
const DEFERRED = 'EXPECTED_ABSENT_BUT_DEFERRED';

// Run-target script keys we recognise, in priority order (npm/pnpm/yarn convention).
const DEV_SCRIPT_KEYS = ['dev', 'start', 'serve', 'develop'];

// ---------------------------------------------------------------------------
// Pure run-target detection (no FS): given a parsed manifest object, find the
// command that boots the app. Supports a package.json-shaped `{ scripts: {...} }`
// and an explicit `{ dev_command }` / `{ runtime: { command } }` declaration.
// Returns { command, source } or null when nothing bootable is declared.
// ---------------------------------------------------------------------------
function detectRunTarget(manifest) {
  const m = manifest && typeof manifest === 'object' ? manifest : {};
  if (typeof m.dev_command === 'string' && m.dev_command.trim()) {
    return { command: m.dev_command.trim(), source: 'dev_command' };
  }
  if (m.runtime && typeof m.runtime.command === 'string' && m.runtime.command.trim()) {
    return { command: m.runtime.command.trim(), source: 'runtime.command' };
  }
  const scripts = m.scripts && typeof m.scripts === 'object' ? m.scripts : {};
  for (const key of DEV_SCRIPT_KEYS) {
    if (typeof scripts[key] === 'string' && scripts[key].trim()) {
      return { command: `npm run ${key}`, source: `scripts.${key}` };
    }
  }
  return null;
}

// Priority rank of a detectRunTarget source (lower = higher priority): an explicit
// dev_command / runtime.command outranks a scripts.<key>, and scripts follow DEV_SCRIPT_KEYS order.
function sourceRank(source) {
  if (source === 'dev_command') return 0;
  if (source === 'runtime.command') return 1;
  const m = /^scripts\.(.+)$/.exec(source || '');
  if (m) {
    const idx = DEV_SCRIPT_KEYS.indexOf(m[1]);
    return 2 + (idx >= 0 ? idx : DEV_SCRIPT_KEYS.length);
  }
  return 99;
}

// ---------------------------------------------------------------------------
// Pure workspace run-target detection (no FS) — DEF-4 (DEC-DEV-0168).
// Input: [{ dir, manifest }] where dir is a POSIX-relative workspace-package path.
// For each manifest, run detectRunTarget(); a package with no bootable target is skipped.
// Output: deterministically-sorted candidates [{ command, source, cwd }] where
//   source = `workspace:<dir>#<original source>`, cwd = dir.
// Sort: source priority (dev_command/runtime.command > scripts, then DEV_SCRIPT_KEYS order);
//   ties broken lexicographically by dir.
// ---------------------------------------------------------------------------
function detectWorkspaceRunTargets(workspaces) {
  const list = Array.isArray(workspaces) ? workspaces : [];
  const candidates = [];
  for (const ws of list) {
    if (!ws || typeof ws !== 'object') continue;
    const dir = String(ws.dir || '');
    const t = detectRunTarget(ws.manifest);
    if (!t) continue;
    candidates.push({
      command: t.command,
      source: `workspace:${dir}#${t.source}`,
      cwd: dir,
      _rank: sourceRank(t.source),
    });
  }
  candidates.sort((a, b) => {
    if (a._rank !== b._rank) return a._rank - b._rank;
    if (a.cwd < b.cwd) return -1;
    if (a.cwd > b.cwd) return 1;
    return 0;
  });
  return candidates.map(({ _rank, ...c }) => c);
}

// ---------------------------------------------------------------------------
// Pure capability lens: which surfaced §6 items BLOCK a boot.
// A BLOCK disposition (absent secret, no dev stand-in) is a hard boot blocker.
// A DEFERRED item (dev stand-in covers it) does NOT block — it is disclosed.
// ---------------------------------------------------------------------------
function bootBlockingCaps(capabilities) {
  return (capabilities || []).filter((c) => c && c.disposition === BLOCK);
}

function deferredCaps(capabilities) {
  return (capabilities || []).filter((c) => c && c.disposition === DEFERRED);
}

/** Build the §6 capability-requests to emit for a set of boot-blocking caps. */
function buildRequests(blockingCaps) {
  return (blockingCaps || []).map((c) => {
    const routes = Array.isArray(c.routes) && c.routes.length
      ? c.routes.slice()
      : [ROUTE.INTEGRATOR].concat(c.provider_choice_pending ? [ROUTE.PRODUCT] : []);
    return {
      capability: c.capability || '(unnamed)',
      secret_env: c.secret_env || null,
      provider: c.provider || null,
      tier: c.tier || null,
      routes,
      provider_choice_pending: !!c.provider_choice_pending,
      await: 'OD7',                                   // async request→await→resume (execution deferred)
      rationale: `runtime boot requires "${c.capability || 'capability'}"`
        + `${c.secret_env ? ` (${c.secret_env})` : ''} which is BLOCK (no access, no dev stand-in)`
        + `${c.provider_choice_pending ? '; provider undecided — route Product/OD8' : ''}.`,
    };
  });
}

// ---------------------------------------------------------------------------
// Pure verdict synthesis — the deterministic heart.
//   precedence: NOT_STARTABLE > BLOCKED_ON_CAPABILITY > ENV_NOT_READY > READY_TO_SMOKE
// A non-blocking gap never downgrades a verdict it shouldn't; disclosures carry the
// "green boot is indicative, not proof" caveats (RUN 01 lesson).
// ---------------------------------------------------------------------------
function assessReadiness(input) {
  const inp = input && typeof input === 'object' ? input : {};
  const runTarget = inp.runTarget || null;                 // {command, source} | null
  const capabilities = inp.capabilities || [];
  const envReadiness = inp.envReadiness || 'unknown';
  const p6Verdict = inp.p6Verdict || null;
  const capabilitiesUnknown = !!inp.capabilitiesUnknown;   // §6 probe could not resolve the feature/manifest (≠ "feature has no caps")
  // DEF-4 (DEC-DEV-0168) — optional workspace inputs; absent == old behaviour bit-for-bit.
  const runTargetOrigin = inp.runTargetOrigin === 'workspace' ? 'workspace' : 'root';
  const runTargetCandidates = Array.isArray(inp.runTargetCandidates) ? inp.runTargetCandidates : [];
  const workspaceScanNotes = Array.isArray(inp.workspaceScanNotes) ? inp.workspaceScanNotes : [];

  const blocking = bootBlockingCaps(capabilities);
  const deferred = deferredCaps(capabilities);
  const requests = [];
  const disclosures = [];

  // an effectively-empty command (whitespace) is no run target — same as absent (mirrors detectRunTarget's trim).
  const hasRunTarget = !!(runTarget && runTarget.command && String(runTarget.command).trim());

  let verdict;
  if (!hasRunTarget) {
    verdict = VERDICT.NOT_STARTABLE;
  } else if (blocking.length) {
    verdict = VERDICT.BLOCKED_ON_CAPABILITY;
    requests.push(...buildRequests(blocking));
  } else if (envReadiness === READINESS.ENV_NOT_READY) {
    verdict = VERDICT.ENV_NOT_READY;
  } else {
    verdict = VERDICT.READY_TO_SMOKE;
  }

  // disclosures (orthogonal to the verdict — a smoke can be attemptable yet caveated)
  if (p6Verdict && p6Verdict !== 'GO') {
    disclosures.push(`runtime smoke runs over a non-GO impl (P6=${p6Verdict}) — the boot result is informational, not a clean pass.`);
  }
  for (const c of deferred) {
    // verdict-agnostic phrasing ("would not exercise") — the disclosure is true whether or not a
    // boot is attempted on this run (a deferred cap is disclosed on a BLOCKED verdict too).
    disclosures.push(`feature relies on a dev stand-in "${c.dev_stand_in || 'stand-in'}" for "${c.capability}" — a runtime smoke would not exercise the real ${c.provider || 'provider'} seam (mock-only boot ≠ prod-ready).`);
  }
  if (envReadiness === READINESS.DEGRADED) {
    disclosures.push('env substrate readiness is DEGRADED (an unprobed dependency) — a green boot is indicative, not proof.');
  }
  // DEF-4 (DEC-DEV-0168) workspace disclosures — orthogonal to the verdict.
  if (hasRunTarget && runTargetOrigin === 'workspace') {
    const cwd = (runTarget && runTarget.cwd) || '(unknown)';
    disclosures.push(`run target found in workspace "${cwd}" — the root package.json declares none of its own (monorepo).`);
  }
  if (runTargetCandidates.length > 1) {
    const listed = runTargetCandidates.map((c) => `${c.command} @ ${c.cwd}`).join(', ');
    disclosures.push(`multiple workspace run targets found (${listed}) — the first was auto-selected; pin explicitly with --app <dir>.`);
  }
  for (const note of workspaceScanNotes) {
    if (note) disclosures.push(String(note));
  }
  // FAIL-LOUD, NOT FAIL-OPEN: if the §6 capability probe could not resolve the named feature /
  // manifest, P7 assessed boot-readiness WITHOUT capability disposition — a hard boot-blocking
  // capability may be hidden, so a green readiness MUST disclose the gap (never a silent clean READY).
  // Mirrors env-readiness.cjs's "unprobed ≠ proven-absent → disclose" doctrine (DEC-DEV-0112): we do
  // not false-block (the live boot's missing-runtime-secret failure class is the ground-truth backstop),
  // but the absence of a probe must never read as a clean capability bill of health.
  if (capabilitiesUnknown) {
    disclosures.push('§6 capability disposition UNAVAILABLE — the probe could not resolve the feature/manifest, so boot-readiness was assessed WITHOUT capability disposition; a hard boot-blocking capability may be hidden (this readiness is NOT a clean capability check).');
  }

  return {
    verdict,
    smoke_attemptable: verdict === VERDICT.READY_TO_SMOKE,
    capabilities_unknown: capabilitiesUnknown,
    run_target: runTarget,
    run_target_candidates: runTargetCandidates,
    requests,
    disclosures,
    routes: requests.length
      ? Array.from(new Set(requests.flatMap((r) => r.routes)))
      : (verdict === VERDICT.NOT_STARTABLE ? [ROUTE.PRODUCT] : []),
  };
}

// ---------------------------------------------------------------------------
// Pure smoke plan — the success-signal / failure-class taxonomy (RUN 01 P7).
// The agent executes the boot and matches observed behaviour against these.
// ---------------------------------------------------------------------------
function smokePlan(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const command = o.command || null;
  const cwd = o.cwd || null;                            // DEF-4: the workspace-package dir to boot in (null = repo root)
  const healthCheck = o.healthCheck || null;            // e.g. "GET http://localhost:3000/health"
  const bootWindowSec = Number.isFinite(o.bootWindowSec) ? o.bootWindowSec : 30;
  return {
    command,
    cwd,
    boot_window_sec: bootWindowSec,
    success_signals: [
      'process stays up past the boot window (no immediate exit / crash loop)',
      'no uncaught exception or fatal error on the startup path',
      healthCheck
        ? `${healthCheck} returns 2xx (not 500)`
        : 'the dev server reports "listening"/"ready" (no 500 on a first request)',
    ],
    failure_classes: [
      // RUN 01 #2129–2158 taxonomy — the gaps a green test suite cannot see:
      { id: 'env-not-loaded', signal: '500 on first request; config/secret undefined at runtime', hint: 'process did not load .env / runtime config (the RUN 01 root 500)' },
      { id: 'missing-migration', signal: 'boot fails on a DB schema/relation error', hint: 'migrations not applied to the running DB' },
      { id: 'port-in-use', signal: 'EADDRINUSE on listen', hint: 'a stale process holds the port' },
      { id: 'missing-runtime-secret', signal: 'boot fails resolving an external client', hint: 'a runtime capability is absent (should have surfaced as a BLOCK cap upstream)' },
      { id: 'dependency-not-up', signal: 'connection refused to DB/cache on boot', hint: 'env substrate down (env-readiness ENV_NOT_READY)' },
    ],
  };
}

/** Summary over an assessment (for the verdict line / disclosure count). */
function summarize(assessment) {
  const a = assessment && typeof assessment === 'object' ? assessment : {};
  return {
    verdict: a.verdict || null,
    smoke_attemptable: !!a.smoke_attemptable,
    requests: Array.isArray(a.requests) ? a.requests.length : 0,
    disclosures: Array.isArray(a.disclosures) ? a.disclosures.length : 0,
  };
}

// ---------------------------------------------------------------------------
// CLI (FS lives here only) — read the project manifest + (optionally) the §6
// capabilities via capability-probe, then assess. The pure functions above take
// everything as input; the CLI is the dual-use convenience assembler.
// ---------------------------------------------------------------------------
function readManifest(root) {
  const file = path.join(root || '.', 'package.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return null; }
}

// ---------------------------------------------------------------------------
// DEF-4 workspace scan (FS lives here only) — DEC-DEV-0168.
// Collect workspace-package globs from pnpm-workspace.yaml + the root package.json
// `workspaces` (array OR { packages: [...] }), expand the supported pattern classes,
// and read each package.json. Returns { workspaces:[{dir,manifest}], notes:[] }.
// ---------------------------------------------------------------------------

// Minimal pnpm-workspace.yaml parse (no YAML lib): collect the `- '<glob>'` list items
// under a top-level `packages:` key. Deliberately narrow — honest limitations become notes.
function parsePnpmWorkspaceGlobs(text) {
  const globs = [];
  let inPackages = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^packages:\s*(#.*)?$/.test(line)) { inPackages = true; continue; }
    if (!inPackages) continue;
    const m = /^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/.exec(line);
    if (m) { globs.push(m[1].trim()); continue; }
    // a non-blank line that is not a list item at column 0 closes the block
    if (/^\S/.test(line)) inPackages = false;
  }
  return globs;
}

// Expand one workspace glob into POSIX-relative dirs. Supports a literal path and a
// single-level trailing `/*` (one readdir); `!` / `**` patterns are skipped with a note.
function expandWorkspaceGlob(root, pattern, notes) {
  const p = String(pattern || '').trim();
  if (!p) return [];
  if (p.includes('!') || p.includes('**')) {
    notes.push(`glob "${p}" not expanded (unsupported pattern class)`);
    return [];
  }
  if (p.endsWith('/*')) {
    const base = p.slice(0, -2);
    let entries;
    try { entries = fs.readdirSync(path.join(root, base), { withFileTypes: true }); } catch (_e) { return []; }
    return entries.filter((e) => e.isDirectory()).map((e) => (base ? `${base}/${e.name}` : e.name));
  }
  return [p];   // literal path (a dir with no package.json is silently dropped below)
}

function readWorkspaceManifests(root) {
  const base = root || '.';
  const notes = [];
  const globs = [];

  try {
    const y = fs.readFileSync(path.join(base, 'pnpm-workspace.yaml'), 'utf8');
    globs.push(...parsePnpmWorkspaceGlobs(y));
  } catch (_e) { /* absent — fine */ }

  const rootPkg = readManifest(base);
  if (rootPkg && rootPkg.workspaces) {
    const w = rootPkg.workspaces;
    if (Array.isArray(w)) globs.push(...w);
    else if (w && typeof w === 'object' && Array.isArray(w.packages)) globs.push(...w.packages);
  }

  const seen = new Set();
  const workspaces = [];
  for (const g of globs) {
    for (const dir of expandWorkspaceGlob(base, g, notes)) {
      if (seen.has(dir)) continue;                 // dedup by dir
      seen.add(dir);
      const manifest = readManifest(path.join(base, dir));
      if (manifest) workspaces.push({ dir, manifest });   // a dir with no package.json is silently skipped
    }
  }
  return { workspaces, notes };
}

// Returns { capabilities, unresolved, reason }. A genuine probe FAILURE (require throws,
// the features dir is unreadable, the named feature is not found, a read throws) is
// `unresolved:true` — NOT the same as a feature that legitimately declares no caps (`[]`,
// unresolved:false). assessReadiness folds `unresolved` into a loud disclosure so an
// unprobeable feature never reads as a clean READY (the fail-OPEN the reviewer flagged).
function capabilitiesFor(feature, root) {
  if (!feature) return { capabilities: [], unresolved: false, reason: null };   // no per-feature §6 lens requested (whole-app boot)
  let probe;
  try {
    // best-effort reuse of the 5A detect-leg; co-located in .claude/orchestrator/lib/
    // eslint-disable-next-line global-require
    probe = require(path.join(__dirname, 'capability-probe.cjs'));
  } catch (e) {
    return { capabilities: [], unresolved: true, reason: `capability-probe load failed: ${(e && e.message) || e}` };
  }
  const dir = path.join(root || '.', '.product', 'features');
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_e) {
    return { capabilities: [], unresolved: true, reason: `cannot read ${dir}` };
  }
  const key = String(feature).toLowerCase();
  const hit = entries.filter((f) => f.endsWith('.md'))
    .find((f) => f.toLowerCase().startsWith(`${key}-`) || f.toLowerCase().includes(key));
  if (!hit) return { capabilities: [], unresolved: true, reason: `feature "${feature}" not found under .product/features` };
  try {
    const raw = fs.readFileSync(path.join(dir, hit), 'utf8').replace(/\r\n/g, '\n');
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    const items = probe.extractManifest(m ? m[1] : '');
    const capabilities = probe.surface(items, (name) => Object.prototype.hasOwnProperty.call(process.env, name) && !!process.env[name]);
    return { capabilities, unresolved: false, reason: null };
  } catch (e) {
    return { capabilities: [], unresolved: true, reason: `cannot read ${hit}: ${(e && e.message) || e}` };
  }
}

function parseArgs(argv) {
  const a = { root: '.' };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--feature': a.feature = next(); break;
      case '--root': a.root = next(); break;
      case '--app': a.app = next(); break;        // DEF-4: pin an explicit workspace-package dir
      case '--env': a.env = next(); break;        // READY | DEGRADED | ENV_NOT_READY
      case '--p6': a.p6 = next(); break;          // GO | NO-GO | MANUAL_VERIFY
      default: break;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'runtime-readiness.cjs — Orchestrator P7: is a runtime smoke ATTEMPTABLE, and if',
    'not, why (+ the §6 request to emit)? (DEC-DEV-0120).',
    '',
    'USAGE:  node runtime-readiness.cjs --feature FM-002 [--root .] [--env READY] [--p6 GO] [--app apps/web]',
    '',
    '--app <dir> pins a workspace-package dir (DEF-4 monorepo); else the root manifest is used,',
    'and if it declares no run target the workspace packages are scanned (pnpm + npm forms).',
    '',
    '→ JSON { verdict, smoke_attemptable, run_target, run_target_candidates:[…], requests:[…], disclosures:[…], plan }',
    'verdict ∈ READY_TO_SMOKE | BLOCKED_ON_CAPABILITY | ENV_NOT_READY | NOT_STARTABLE.',
    'A boot-blocking BLOCK capability ⇒ BLOCKED_ON_CAPABILITY (the OD7 await is deferred).',
  ].join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  const manifest = readManifest(args.root);
  let runTarget = detectRunTarget(manifest);
  let runTargetOrigin = 'root';
  let runTargetCandidates = [];
  let workspaceScanNotes = [];

  if (args.app) {
    // DEF-4: explicit pin of a workspace package (FS read scoped to <root>/<app>).
    const appManifest = readManifest(path.join(args.root, args.app));
    const t = detectRunTarget(appManifest);
    runTargetOrigin = 'workspace';
    runTarget = t ? { command: t.command, source: `workspace:${args.app}#${t.source}`, cwd: args.app } : null;
    runTargetCandidates = runTarget ? [runTarget] : [];
  } else if (!runTarget) {
    // DEF-4: root declares no run target — scan workspace packages (pnpm + npm forms).
    const scan = readWorkspaceManifests(args.root);
    workspaceScanNotes = scan.notes;
    const candidates = detectWorkspaceRunTargets(scan.workspaces);
    if (candidates.length) {
      runTarget = candidates[0];                 // deterministic first after sort
      runTargetOrigin = 'workspace';
      runTargetCandidates = candidates;
    }
  }

  const cap = capabilitiesFor(args.feature, args.root);
  const assessment = assessReadiness({
    runTarget,
    runTargetOrigin,
    runTargetCandidates,
    workspaceScanNotes,
    capabilities: cap.capabilities,
    capabilitiesUnknown: cap.unresolved,        // §6 probe could not resolve → loud disclosure, never a silent clean READY
    envReadiness: args.env || 'unknown',
    p6Verdict: args.p6 || null,
  });
  const plan = assessment.smoke_attemptable
    ? smokePlan({ command: runTarget && runTarget.command, cwd: runTarget && runTarget.cwd })
    : null;

  process.stdout.write(JSON.stringify({
    runtime_readiness_schema_version: RUNTIME_READINESS_SCHEMA_VERSION,
    feature: args.feature || null,
    ...assessment,
    plan,
    summary: summarize(assessment),
  }, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  RUNTIME_READINESS_SCHEMA_VERSION,
  VERDICT,
  READINESS,
  ROUTE,
  DEV_SCRIPT_KEYS,
  detectRunTarget,
  detectWorkspaceRunTargets,
  readWorkspaceManifests,
  bootBlockingCaps,
  deferredCaps,
  buildRequests,
  assessReadiness,
  smokePlan,
  summarize,
  capabilitiesFor,
};
