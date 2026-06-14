#!/usr/bin/env node
/**
 * coverage-oracle.cjs — deterministic requirement-coverage oracle for the
 * Orchestrator P3 `batch-features-to-cc-sdd` process (and reusable by P6).
 *
 * WHY THIS EXISTS (RUN 01, P1-1 — DEC-DEV-0068):
 *   In the dogfood run, "did the generated spec cover every source requirement?"
 *   was answered by the spec-author subagent's own self-report. A subagent that
 *   silently dropped SC-002 also reported "all scenarios covered". The fix is a
 *   verification gate that re-derives the canonical IDs from GROUND TRUTH text
 *   (the handoff sections and the generated spec text) via regex — NEVER from a
 *   subagent claim. The Workflow gate dispatches an agent whose ONLY job is to
 *   run this script via Bash and relay its JSON; the verdict comes from code.
 *
 * DESIGN CONSTRAINTS (mirror adapters/handoff-to-ccsdd.js):
 *   - Node stdlib only (no npm deps); cross-platform LF-normalized I/O.
 *   - Self-contained: does NOT require() the integrator adapter, so the oracle
 *     keeps working regardless of where (or whether) the adapter is installed.
 *   - Section extraction uses the SAME monotonic-increase guard as the adapter
 *     (DEC-DEV-0068) so §10 UI sub-documents with restarted `## N.` numbering
 *     cannot leak their IDs into §5/§6/§9. ⚠ SYNC OBLIGATION: if the adapter's
 *     extractSections guard changes, mirror it here (the two are intentionally
 *     duplicated to decouple runtime install paths — tri-location lesson
 *     DEC-DEV-0040; both are covered by contract tests).
 *
 * EXIT CODES:
 *   0   oracle ran; in coverage mode → all source IDs covered (or extract mode)
 *   1   coverage mode → one or more source IDs missing from target spec text
 *   2   usage / read error
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ORACLE_SCHEMA_VERSION = 1;

// Canonical identifier families per handoff-spec §6 → which section owns them.
// §5 Scenarios → SC-, §6 Business Rules → BR-, §9 Invariants → IC-.
const SOURCE_FAMILIES = [
  { key: 'scenarios', section: 5, prefix: 'SC' },
  { key: 'rules', section: 6, prefix: 'BR' },
  { key: 'invariants', section: 9, prefix: 'IC' },
];

function normalizeLF(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripFrontmatter(raw) {
  const normalized = normalizeLF(raw);
  const m = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : normalized;
}

/**
 * Split a handoff body into top-level sections keyed by section number, with a
 * monotonic-increase guard. A `## N.` header opens a real section only if N
 * strictly exceeds the highest section accepted so far; restarted sub-doc
 * headers (N ≤ maxAccepted, e.g. §10 UI MK/DS/NM sub-docs) fall through into the
 * current section's body instead of clobbering an earlier section.
 * Mirror of adapters/handoff-to-ccsdd.js extractSections (keep in sync).
 */
function extractSections(rawBody) {
  const body = normalizeLF(rawBody);
  const out = new Map();
  const lines = body.split('\n');
  let currentNum = null;
  let buf = [];
  let maxAccepted = 0;

  const flush = () => {
    if (currentNum !== null) out.set(currentNum, buf.join('\n').trim());
    buf = [];
  };

  for (const line of lines) {
    const h = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (h && parseInt(h[1], 10) > maxAccepted) {
      flush();
      currentNum = parseInt(h[1], 10);
      maxAccepted = currentNum;
    } else if (currentNum !== null) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

/** Unique IDs of the form `<PREFIX>-<digits>` found in text, in first-seen order. */
function extractIds(text, prefix) {
  const re = new RegExp('\\b' + prefix + '-\\d+', 'g');
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      out.push(m[0]);
    }
  }
  return out;
}

/**
 * Ground-truth source IDs from a handoff: SC- from §5, BR- from §6, IC- from §9.
 * Returns { scenarios:[], rules:[], invariants:[] }. Independent of any subagent
 * claim — this is the whole point of the oracle.
 */
function extractSourceIds(rawHandoff) {
  const sections = extractSections(stripFrontmatter(rawHandoff));
  const out = {};
  for (const fam of SOURCE_FAMILIES) {
    out[fam.key] = extractIds(sections.get(fam.section) || '', fam.prefix);
  }
  return out;
}

/**
 * Coverage of source IDs against target spec text.
 * Returns per-family { covered:[], missing:[] } plus an aggregate `passed`.
 */
function computeCoverage(sourceIds, targetText) {
  const families = {};
  let allMissing = 0;
  for (const fam of SOURCE_FAMILIES) {
    const src = sourceIds[fam.key] || [];
    const covered = src.filter((id) => new RegExp('\\b' + id + '\\b').test(targetText));
    const missing = src.filter((id) => !covered.includes(id));
    families[fam.key] = { source: src, covered, missing };
    allMissing += missing.length;
  }
  return { families, passed: allMissing === 0, missing_count: allMissing };
}

/**
 * Self-report cross-check: compare oracle-extracted source IDs to a subagent's
 * claimed-covered list. Discrepancies (oracle found an ID the subagent didn't
 * claim, or the subagent claimed an ID not in ground truth) are flagged.
 */
function crossCheckSelfReport(sourceIds, claimed) {
  const flat = [].concat(sourceIds.scenarios, sourceIds.rules, sourceIds.invariants);
  const claimedSet = new Set(claimed);
  const groundSet = new Set(flat);
  return {
    unclaimed_ground_truth: flat.filter((id) => !claimedSet.has(id)), // oracle has, subagent omitted
    fabricated_claims: claimed.filter((id) => !groundSet.has(id)),    // subagent claims, not in ground truth
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { handoff: null, specs: [], selfReport: null, output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--handoff') args.handoff = argv[++i];
    else if (a === '--spec') args.specs.push(argv[++i]);
    else if (a === '--self-report') args.selfReport = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.handoff && !a.startsWith('--')) args.handoff = a;
  }
  return args;
}

function printHelp() {
  console.log(`coverage-oracle.cjs — deterministic requirement-coverage oracle (Orchestrator P3/P6)

Usage:
  node coverage-oracle.cjs --handoff <handoff.md>
      extract mode: print ground-truth source IDs (SC/BR/IC) from §5/§6/§9.

  node coverage-oracle.cjs --handoff <handoff.md> --spec <requirements.md> [--spec <design.md> ...]
      coverage mode: every source ID must appear in the concatenated spec text.

  ... --self-report '<JSON array of claimed-covered IDs>'
      additionally cross-check the subagent's self-report against ground truth.

Exit codes:
  0  ran OK (extract mode) OR all source IDs covered (coverage mode)
  1  coverage mode: one or more source IDs missing from target spec text
  2  usage / read error

Schema: oracle_schema_version ${ORACLE_SCHEMA_VERSION}
`);
}

function readOrDie(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    console.error(`ERROR: cannot read ${p}: ${e.message}`);
    process.exit(2);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.handoff) {
    console.error('ERROR: --handoff <handoff.md> is required');
    printHelp();
    process.exit(2);
  }

  const sourceIds = extractSourceIds(readOrDie(args.handoff));
  const mode = args.specs.length > 0 ? 'coverage' : 'extract';

  const output = {
    oracle_schema_version: ORACLE_SCHEMA_VERSION,
    mode,
    handoff_file: path.resolve(args.handoff),
    source_ids: sourceIds,
  };

  let exitCode = 0;

  if (mode === 'coverage') {
    const targetText = args.specs.map(readOrDie).join('\n');
    const coverage = computeCoverage(sourceIds, targetText);
    output.spec_files = args.specs.map((p) => path.resolve(p));
    output.coverage = coverage;
    exitCode = coverage.passed ? 0 : 1;
  }

  if (args.selfReport) {
    let claimed;
    try {
      claimed = JSON.parse(args.selfReport);
      if (!Array.isArray(claimed)) throw new Error('not an array');
    } catch (e) {
      console.error(`ERROR: --self-report must be a JSON array of IDs: ${e.message}`);
      process.exit(2);
    }
    output.self_report_cross_check = crossCheckSelfReport(sourceIds, claimed);
    if (output.self_report_cross_check.unclaimed_ground_truth.length > 0 ||
        output.self_report_cross_check.fabricated_claims.length > 0) {
      exitCode = exitCode || 1;
    }
  }

  const json = JSON.stringify(output, null, 2);
  if (args.output) fs.writeFileSync(args.output, json, 'utf8');
  else process.stdout.write(json + '\n');
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  ORACLE_SCHEMA_VERSION,
  SOURCE_FAMILIES,
  normalizeLF,
  stripFrontmatter,
  extractSections,
  extractIds,
  extractSourceIds,
  computeCoverage,
  crossCheckSelfReport,
};
