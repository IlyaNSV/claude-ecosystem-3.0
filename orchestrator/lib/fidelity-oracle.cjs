#!/usr/bin/env node
/**
 * fidelity-oracle.cjs — deterministic TRACE-INTEGRITY oracle for the Orchestrator
 * P4 `audit-spec-fidelity` process.
 *
 * WHY THIS EXISTS (RUN 01 E3 / P1-2 — DEC-DEV-0073; sharpened by S6/DEC-DEV-0081):
 *   coverage-oracle answers "is every PRODUCT id PRESENT in the spec?" (presence).
 *   This oracle answers the INVERSE + fabrication question: "does every id the SPEC
 *   REFERENCES actually EXIST in the .product ground truth?" RUN 01 found a generated
 *   spec citing a FICTITIOUS trace (IC-013 that no product artifact defines — D-1 #501,
 *   introduced by a cross-spec remediation). A dangling trace-ref is drift/fabrication
 *   the LLM fidelity-auditor can miss; here it is caught by CODE over ground truth.
 *
 *   This is the deterministic Layer-3 half of P4. The semantic half (value mismatches,
 *   stale event names, contradicted rules) is the LLM `fidelity-auditor` role; this
 *   oracle is the part that must NEVER rely on a subagent's judgment.
 *
 * DESIGN CONSTRAINTS (mirror coverage-oracle.cjs / adapters/handoff-to-ccsdd.js):
 *   - Node stdlib only; cross-platform LF-normalized I/O.
 *   - Reuses coverage-oracle's id-extraction primitives (single source of truth for
 *     the `<PREFIX>-<digits>` grammar); does NOT re-implement them.
 *   - Ground truth = the UNION of ids found across all --source files (handoff +
 *     whatever .product artifacts the caller passes). The caller decides what
 *     constitutes ground truth; the oracle only does set membership.
 *
 * EXIT CODES:
 *   0   ran; every spec trace-ref resolves to a ground-truth id (or extract mode)
 *   1   one or more spec trace-refs are DANGLING (not in ground truth) → drift/fabrication
 *   2   usage / read error
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeLF, stripFrontmatter, extractIds } = require('./coverage-oracle.cjs');

const ORACLE_SCHEMA_VERSION = 1;

// Product identifier families a spec legitimately traces back to. A spec referencing
// any `<PREFIX>-<n>` of these families must resolve to an id that exists in .product.
const TRACE_FAMILIES = ['FM', 'SC', 'BR', 'IC', 'NFR'];

/** All ids of every trace family found anywhere in `text` (frontmatter stripped). */
function extractAllIds(rawText) {
  const text = stripFrontmatter(rawText);
  const out = {};
  for (const prefix of TRACE_FAMILIES) out[prefix] = extractIds(text, prefix);
  return out;
}

/** Union of two {PREFIX:[ids]} maps (first-seen order preserved, de-duplicated). */
function unionIds(a, b) {
  const out = {};
  for (const prefix of TRACE_FAMILIES) {
    const seen = new Set();
    out[prefix] = [].concat(a[prefix] || [], b[prefix] || []).filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  return out;
}

/**
 * Trace-integrity: every id the SPEC references must exist in the SOURCE (ground truth).
 * Returns per-family { source, refs, dangling } + aggregate `passed` + `dangling_count`.
 * `dangling` = spec-referenced ids absent from ground truth (fabrication / drift).
 */
function computeTraceIntegrity(sourceIds, specRefs) {
  const families = {};
  let danglingCount = 0;
  for (const prefix of TRACE_FAMILIES) {
    const source = sourceIds[prefix] || [];
    const refs = specRefs[prefix] || [];
    const sourceSet = new Set(source);
    const dangling = refs.filter((id) => !sourceSet.has(id));
    families[prefix] = { source, refs, dangling };
    danglingCount += dangling.length;
  }
  return { families, passed: danglingCount === 0, dangling_count: danglingCount };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { sources: [], specs: [], output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') args.sources.push(argv[++i]);
    else if (a === '--spec') args.specs.push(argv[++i]);
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`fidelity-oracle.cjs — deterministic trace-integrity oracle (Orchestrator P4)

Usage:
  node fidelity-oracle.cjs --source <handoff.md> [--source <.product/...> ...]
      extract mode: print the ground-truth id set (FM/SC/BR/IC/NFR) from the sources.

  node fidelity-oracle.cjs --source <...> [--source <...>] --spec <requirements.md> [--spec <design.md> ...]
      trace-integrity mode: every id the spec REFERENCES must exist in the source set.
      A dangling ref (e.g. a fictitious IC-013) → fail.

Exit codes:
  0  ran OK (extract mode) OR every spec trace-ref resolves to ground truth
  1  trace-integrity mode: one or more spec trace-refs are DANGLING (drift/fabrication)
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
  if (!args.sources.length) {
    console.error('ERROR: at least one --source <file> is required (the .product ground truth)');
    printHelp();
    process.exit(2);
  }

  let sourceIds = {};
  for (const s of args.sources) sourceIds = unionIds(sourceIds, extractAllIds(readOrDie(s)));

  const mode = args.specs.length > 0 ? 'trace-integrity' : 'extract';
  const output = {
    oracle_schema_version: ORACLE_SCHEMA_VERSION,
    mode,
    source_files: args.sources.map((p) => path.resolve(p)),
    source_ids: sourceIds,
  };

  let exitCode = 0;
  if (mode === 'trace-integrity') {
    let specRefs = {};
    for (const sp of args.specs) specRefs = unionIds(specRefs, extractAllIds(readOrDie(sp)));
    const trace = computeTraceIntegrity(sourceIds, specRefs);
    output.spec_files = args.specs.map((p) => path.resolve(p));
    output.trace_integrity = trace;
    exitCode = trace.passed ? 0 : 1;
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
  TRACE_FAMILIES,
  extractAllIds,
  unionIds,
  computeTraceIntegrity,
};
