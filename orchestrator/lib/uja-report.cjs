#!/usr/bin/env node
'use strict';
/**
 * uja-report.cjs — the DETERMINISTIC core of the Orchestrator P8 `user-journey-acceptance`
 * process (DEC-DEV-0225). Two jobs, both facts-about-bytes that MUST NOT be eyeballed by an LLM:
 *
 *   preflight — is the target project EQUIPPED to run browser user-journeys? (Playwright installed?
 *               journeys authored at the convention path? — a Definition-of-Readiness check)
 *   parse     — given a Playwright JSON reporter output, what is the VERDICT?
 *               (PASS | FAIL | ENV_NOT_READY) — a deterministic reduction over the report bytes.
 *
 * ── WHY A DETERMINISTIC LIB (same lesson as deploy-manifest.cjs / runtime-readiness.cjs) ──────────
 * "Did every journey pass" is a FACT ABOUT BYTES sitting behind an acceptance gate. A stochastic
 * answer is a coin-flip in BOTH directions: a false FAIL blocks a good release, and — the graver
 * one — a false PASS ships a broken first-user-touch (the live precedent: P6/P7/deploy all green,
 * yet the pilot's post-login landed on a 404 because nothing exercised the real journey). So the
 * parse lives in CODE and the harness process is a TRANSPORT: it runs `node uja-report.cjs …` via
 * Bash and relays the JSON verbatim (the harness .mjs may not require() a lib — DEC-DEV-0073 §D.1).
 *
 * ── THE ZERO-EVIDENCE RULE (the load-bearing safety property) ─────────────────────────────────────
 * A report with 0 journeys/tests is NOT a PASS. A gate that goes green on zero evidence is the worst
 * thing this lib can emit (it is exactly the "false DEPLOYED" class one layer over: a green verdict
 * that verified nothing). An empty / unparseable report ⇒ `uja_result: 'ENV_NOT_READY'` — "could not
 * judge" (DoR gap: journeys missing or not discovered), which routes to a re-run, never to `done`.
 *
 * Clock-free and side-effect-free on `parse` (N parses of one report are byte-identical); `preflight`
 * only READS the FS. Exit 0 for any successful read (a broken report/target is DATA: a verdict +
 * reasons); exit 2 on a usage error.
 *
 * Node stdlib only; run with `node orchestrator/lib/uja-report.cjs (preflight|parse) …`.
 */

const fs = require('node:fs');
const path = require('node:path');

const UJA_REPORT_SCHEMA_VERSION = 1;

// The journey-file convention (DEC-DEV-0225): one *.spec.ts under the journeys dir == one journey.
const JOURNEY_SPEC_RE = /\.spec\.(?:ts|tsx|js|mjs|cjs)$/;
const PLAYWRIGHT_CONFIGS = [
  'playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs',
];

// ---------------------------------------------------------------------------
// parse — the verdict reduction over a Playwright JSON report (PURE)
// ---------------------------------------------------------------------------

/**
 * Did this spec pass? Prefer Playwright's own `spec.ok` boolean (authoritative); fall back to the
 * per-test result statuses when it is absent. A spec with NO test results is NOT a pass (a journey
 * that never actually ran must never count as green — the zero-evidence rule at the spec level).
 */
function specPassed(spec) {
  if (spec && typeof spec.ok === 'boolean') return spec.ok;
  const tests = (spec && Array.isArray(spec.tests)) ? spec.tests : [];
  if (!tests.length) return false;
  return tests.every((t) => Array.isArray(t.results) && t.results.length > 0
    && t.results.every((r) => r && (r.status === 'passed' || r.status === 'skipped')));
}

/** Flatten the Playwright suite tree into { file, title, passed } specs. Recurses describe blocks. */
function collectSpecs(suites, inheritedFile, out) {
  if (!Array.isArray(suites)) return;
  for (const s of suites) {
    if (!s || typeof s !== 'object') continue;
    const file = (typeof s.file === 'string' && s.file) ? s.file : inheritedFile;
    for (const spec of (Array.isArray(s.specs) ? s.specs : [])) {
      if (!spec || typeof spec !== 'object') continue;
      const specFile = (typeof spec.file === 'string' && spec.file) ? spec.file : (file || 'unknown');
      out.push({ file: specFile, title: String(spec.title == null ? '' : spec.title), passed: specPassed(spec) });
    }
    if (Array.isArray(s.suites)) collectSpecs(s.suites, file, out);
  }
}

/** The artifacts (screenshots / trace) dir the report declares — never guessed. */
function extractArtifactsDir(report) {
  const cfg = report && report.config;
  if (cfg && typeof cfg.outputDir === 'string' && cfg.outputDir) return cfg.outputDir;
  const projects = cfg && Array.isArray(cfg.projects) ? cfg.projects : [];
  const proj = projects.find((p) => p && typeof p.outputDir === 'string' && p.outputDir);
  return proj ? proj.outputDir : null;
}

/**
 * Reduce a parsed Playwright JSON report to the P8 verdict. PURE — no FS, no clock.
 * Returns { uja_result, journeys_total, journeys_passed, journeys_failed, artifacts_dir, reasons }.
 *   uja_result ∈ PASS | FAIL | ENV_NOT_READY   (ENV_NOT_READY = empty/unparseable — could-not-judge)
 *   journeys are GROUPED BY FILE — one *.spec.ts is one journey; a journey fails if ANY of its
 *   specs fails (a broken step anywhere breaks the journey).
 */
function parseReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return {
      uja_result: 'ENV_NOT_READY', journeys_total: 0, journeys_passed: 0, journeys_failed: [], artifacts_dir: null,
      reasons: ['no parseable Playwright JSON report — the journey run produced nothing to judge (could-not-judge, NOT a code FAIL): re-run once the report is produced'],
    };
  }
  const specs = [];
  collectSpecs(report.suites, null, specs);

  const byFile = new Map();
  for (const sp of specs) {
    if (!byFile.has(sp.file)) byFile.set(sp.file, []);
    byFile.get(sp.file).push(sp);
  }
  const journeys_total = byFile.size;
  const journeys_failed = [];
  let journeys_passed = 0;
  for (const [file, list] of byFile) {
    const failing = list.filter((s) => !s.passed).map((s) => s.title);
    if (failing.length) journeys_failed.push({ journey: file, failing });
    else journeys_passed += 1;
  }
  const artifacts_dir = extractArtifactsDir(report);
  const reasons = [];

  let uja_result;
  if (journeys_total === 0) {
    // THE ZERO-EVIDENCE RULE: no journey was exercised ⇒ this is NOT a PASS.
    uja_result = 'ENV_NOT_READY';
    reasons.push('the Playwright report contains 0 journeys/tests — no user journey was actually exercised. '
      + 'A gate that PASSES on zero evidence is a false green (the "false DEPLOYED" class, one layer up); '
      + 'this is could-not-judge (DoR: journeys missing or not discovered under the journeys dir), NOT a PASS.');
  } else if (journeys_failed.length) {
    uja_result = 'FAIL';
    reasons.push(`${journeys_failed.length} of ${journeys_total} journey(s) FAILED: ${journeys_failed.map((j) => j.journey).join(', ')}`);
  } else {
    uja_result = 'PASS';
    reasons.push(`all ${journeys_total} journey(s) passed`);
  }
  return { uja_result, journeys_total, journeys_passed, journeys_failed, artifacts_dir, reasons };
}

/** Read a report file and parse it. A read/JSON error is DATA (ENV_NOT_READY), never a throw. */
function readReport(file, opts) {
  const o = opts || {};
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  let raw;
  try { raw = String(readFile(file)); } catch (e) {
    return {
      uja_result: 'ENV_NOT_READY', journeys_total: 0, journeys_passed: 0, journeys_failed: [], artifacts_dir: null,
      reasons: [`Playwright report not readable at ${file}: ${e.code || e.message} — the journey run left no report (could-not-judge, NOT a FAIL): re-run`],
    };
  }
  let report;
  try { report = JSON.parse(raw); } catch (e) {
    return {
      uja_result: 'ENV_NOT_READY', journeys_total: 0, journeys_passed: 0, journeys_failed: [], artifacts_dir: null,
      reasons: [`Playwright report at ${file} is not valid JSON (${raw.length} bytes): ${e.message} — could-not-judge, NOT a FAIL`],
    };
  }
  return parseReport(report);
}

// ---------------------------------------------------------------------------
// preflight — is the target EQUIPPED to run journeys? (READS the FS)
// ---------------------------------------------------------------------------

/**
 * Definition-of-Readiness for a journey run: Playwright installed + journeys authored at the
 * convention path. A missing piece is a DoR gap the process reports as ENV_NOT_READY with a hint
 * (`/integrator:add playwright`, `author journeys at <dir>/*.spec.ts`) — NEVER a fabricated pass.
 * Returns { playwright_present, journeys_present, journeys, reasons }.
 */
function assessPreflight(opts) {
  const o = opts || {};
  const root = o.root || '.';
  const journeysDir = o.journeysDir || 'tests/uja';
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  const readdir = o.readdir || ((p) => fs.readdirSync(p));
  const exists = o.exists || ((p) => fs.existsSync(p));
  const reasons = [];

  // (1) journeys present at the convention path?
  const jdir = path.join(root, journeysDir);
  let journeys = [];
  if (!exists(jdir)) {
    reasons.push(`journeys dir "${journeysDir}" does not exist under ${root} — there are no journey specs to run. `
      + `DoR: author browser journeys at ${journeysDir}/*.spec.ts (generate the key user flows from the feature's NM / navigation map).`);
  } else {
    let entries = [];
    try { entries = readdir(jdir); } catch (_e) { entries = []; }
    journeys = entries.filter((f) => JOURNEY_SPEC_RE.test(String(f))).map(String).sort();
    if (!journeys.length) {
      reasons.push(`journeys dir "${journeysDir}" exists but carries no *.spec.ts — no journey to run. `
        + `DoR: author browser journeys at ${journeysDir}/*.spec.ts (generate from the feature's NM).`);
    }
  }
  const journeys_present = journeys.length > 0;

  // (2) Playwright equipped? — a dep in package.json OR a playwright.config.* on disk.
  let pkg = null;
  try { pkg = JSON.parse(String(readFile(path.join(root, 'package.json')))); } catch (_e) { pkg = null; }
  const deps = pkg ? Object.assign({}, pkg.dependencies, pkg.devDependencies) : {};
  const hasDep = !!(deps && (deps['@playwright/test'] || deps.playwright));
  const hasConfig = PLAYWRIGHT_CONFIGS.some((c) => exists(path.join(root, c)));
  const playwright_present = hasDep || hasConfig;
  if (!playwright_present) {
    reasons.push('Playwright (@playwright/test) is not installed in the target project '
      + '(no dep in package.json, no playwright.config.*). DoR: `/integrator:add playwright`.');
  }

  return { playwright_present, journeys_present, journeys, reasons };
}

// ---------------------------------------------------------------------------
// CLI (FS + argv live here only)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') a.help = true;
    else if (t.startsWith('--')) {
      const key = t.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { a[key] = next; i += 1; } else a[key] = true;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'uja-report.cjs — deterministic core of the P8 user-journey-acceptance process (DEC-DEV-0225).',
    '',
    'PREFLIGHT:  node uja-report.cjs preflight [--root <dir>] [--journeys-dir <dir=tests/uja>]',
    '  → JSON { playwright_present, journeys_present, journeys[], reasons[] }',
    '    A DoR check: is Playwright installed + are journeys authored at <journeys-dir>/*.spec.ts?',
    '',
    'PARSE:      node uja-report.cjs parse --report <playwright-json-report>',
    '  → JSON { uja_result, journeys_total, journeys_passed, journeys_failed[], artifacts_dir, reasons[] }',
    '    uja_result  PASS | FAIL | ENV_NOT_READY. One *.spec.ts == one journey; a journey fails if',
    '                ANY of its specs fails. A report with 0 journeys is ENV_NOT_READY (could-not-judge),',
    '                NEVER a PASS — a gate that goes green on zero evidence is a false green.',
    '',
    'Clock-free on parse (N parses of one report are byte-identical). Exit 0 for any successful read',
    '(a broken report/target is DATA: verdict + reasons); exit 2 on a usage error.',
  ].join('\n') + '\n');
}

function main() {
  const sub = process.argv[2];
  const a = parseArgs(process.argv.slice(3));
  if (a.help || sub === '--help' || sub === '-h' || sub === 'help' || !sub) { printHelp(); process.exit(sub ? 0 : 2); }

  if (sub === 'preflight') {
    const out = assessPreflight({
      root: typeof a.root === 'string' ? a.root : '.',
      journeysDir: typeof a.journeysDir === 'string' ? a.journeysDir : 'tests/uja',
    });
    process.stdout.write(JSON.stringify(Object.assign({ uja_report_schema_version: UJA_REPORT_SCHEMA_VERSION }, out), null, 2) + '\n');
    process.exit(0);
  }

  if (sub === 'parse') {
    if (!a.report || a.report === true) {
      process.stderr.write('uja-report: parse needs --report <playwright-json-report>\n');
      process.exit(2);
    }
    const out = readReport(String(a.report));
    process.stdout.write(JSON.stringify(Object.assign({ uja_report_schema_version: UJA_REPORT_SCHEMA_VERSION }, out), null, 2) + '\n');
    process.exit(0);
  }

  printHelp();
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  UJA_REPORT_SCHEMA_VERSION,
  JOURNEY_SPEC_RE,
  PLAYWRIGHT_CONFIGS,
  specPassed,
  collectSpecs,
  extractArtifactsDir,
  parseReport,
  readReport,
  assessPreflight,
};
