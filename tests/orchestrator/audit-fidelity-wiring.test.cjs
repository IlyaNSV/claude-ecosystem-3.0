'use strict';
/**
 * Static guard for the Orchestrator P4 `audit-spec-fidelity` process wiring.
 *
 * The .mjs is a harness Workflow script (agent/phase/parallel globals + top-level return)
 * and cannot run standalone, so this asserts the structural invariants of P4 at the source
 * level (same approach as concerns-propagation.test.cjs / workflow-syntax.smoke.cjs):
 *  - it drives the deterministic fidelity-oracle (trace-integrity), not eyeballing;
 *  - it triages drift to BOTH routes (spec-fix vs product-feedback / OD8);
 *  - it auto-re-audits after a spec-fix (P1-2);
 *  - it keeps the FB-001/FB-002 arg guards;
 *  - it returns the contract keys the run.md doc + P5 hand-off rely on.
 *
 * Node stdlib only; run with `node tests/orchestrator/audit-fidelity-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'orchestrator', 'processes', 'audit-spec-fidelity.mjs');
const src = fs.readFileSync(SRC, 'utf8');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('orchestrator P4 — audit-spec-fidelity wiring');

test('drives the deterministic fidelity-oracle (trace-integrity), relays its JSON', () => {
  assert(/fidelity-oracle\.cjs/.test(src), 'process does not reference fidelity-oracle.cjs');
  assert(/--source\b/.test(src) && /--spec\b/.test(src), 'oracle not invoked with --source/--spec');
});

test('keeps FB-001 (stringified args) + FB-002 (empty target) guards', () => {
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(src), 'FB-001 args guard missing');
  assert(/FEATURES\.length/.test(src) && /FB-002/.test(src), 'FB-002 empty-features guard missing');
});

test('defines the inline fidelity-auditor role (RA-5, per D.1)', () => {
  assert(/FIDELITY_AUDITOR\s*=/.test(src), 'inline fidelity-auditor role missing');
});

test('triages drift to BOTH routes: spec-fix and product (OD8)', () => {
  assert(/route === 'product'/.test(src), 'product-route triage missing');
  assert(/route === 'spec'/.test(src), 'spec-route triage missing');
  assert(/pending-actions\.md/.test(src) && /route: ?product/i.test(src), 'product-feedback not written to pending-actions (OD8)');
});

test('PA emission is dedup-aware on repeated runs (FB-LR-10, DEC-DEV-0089)', () => {
  // a repeated P4 run over the same un-reconciled feature must UPDATE the existing open PA,
  // not append a near-duplicate (PA-013/014/015 in live-run A). Both PA-writing prompts carry it.
  assert(/FB-LR-10/.test(src), 'PA-dedup (FB-LR-10) not referenced');
  assert(/UPDATE it in place/.test(src), 'PA-writing prompts lack the update-in-place dedup instruction');
  const dedups = (src.match(/DEDUP \(FB-LR-10/g) || []).length;
  assert(dedups >= 2, `both PA-emitting prompts (product-route + coverage-route) must carry the dedup pre-filter (found ${dedups})`);
});

test('auto-re-audits after a spec-fix (P1-2), bounded', () => {
  assert(/MAX_REAUDIT_ROUNDS/.test(src), 'no bounded re-audit rounds');
  // auditOne must be called more than once (initial audit + re-audit after fix)
  const calls = (src.match(/auditOne\(/g) || []).length;
  assert(calls >= 2, `auditOne should be called for initial audit AND re-audit (found ${calls})`);
  assert(/RE-AUDIT/i.test(src), 're-audit step not present after spec-fix');
});

test('does NOT edit .product/ on a product-route drift', () => {
  assert(/do NOT edit \.product\//i.test(src) || /not edit \.product/i.test(src),
    'process must explicitly refuse to edit .product/ for product-route drift');
});

test('verify-finding-before-act: confirms a semantic drift before fixing the spec (parity with P6)', () => {
  assert(/verifyDrift\b/.test(src), 'no verifyDrift helper');
  assert(/VERIFY_SCHEMA/.test(src) && /confirmed/.test(src), 'verify schema / confirmed flag missing');
  assert(/presentDrifts/.test(src), 'spec-fix not gated on confirmed-present drifts');
  // the deterministic oracle's missing-trace-source finding is exempt — only LLM semantic drifts are re-verified
  assert(/missing-trace-source/.test(src), 'oracle-confirmed missing-trace-source not exempted from re-verify');
  // verify must run BEFORE the spec-fix
  const verifyIdx = src.indexOf('verifyDrift(current.feature');
  const fixIdx = src.indexOf('spec-fix:');
  assert(verifyIdx !== -1 && fixIdx !== -1 && verifyIdx < fixIdx, 'verify-drift must run before the spec-fix');
  assert(/refuted/i.test(src), 'refuted drifts not dropped');
});

test('order-aware verifyDrift: pre-gate baseline sha + 3-way disposition (FB-LR-03/13, DEC-DEV-0093)', () => {
  assert(/git rev-parse HEAD/.test(src), 'no baseline sha capture (git rev-parse HEAD)');
  assert(/BASELINE\b/.test(src), 'BASELINE not threaded into verifyDrift');
  assert(/disposition === 'present'/.test(src), 'spec-fix not bucketed by the present disposition');
  assert(/already-resolved/.test(src), 'already-resolved disposition missing — a fixed real drift would be mislabelled a hallucination + re-fixed');
  // baseline captured at Init, before the Triage spec-fix
  const baseIdx = src.indexOf('git rev-parse HEAD');
  const fixIdx = src.indexOf('spec-fix:');
  assert(baseIdx !== -1 && fixIdx !== -1 && baseIdx < fixIdx, 'baseline must be captured before the spec-fix');
});

test('design→tasks structural coverage (T4 / FB-LR-05, DEC-DEV-0095)', () => {
  assert(/design-coverage-oracle\.cjs/.test(src), 'process does not drive the design-coverage-oracle');
  assert(/coverageAudit\b/.test(src), 'no coverageAudit helper');
  assert(/COVERAGE_SCHEMA/.test(src) && /uncovered-design-file/.test(src), 'coverage schema / uncovered-design-file kind missing');
  // hybrid: deterministic oracle candidates + a semantic confirm (naming/path variance)
  assert(/oracle_uncovered/.test(src) && /naming\/path variance/i.test(src), 'coverage layer is not hybrid (oracle + semantic confirm)');
  // a confirmed coverage gap routes spec-completion and must NOT auto-edit tasks.md
  assert(/coverage-route:/.test(src), 'coverage gap not routed (pending-action)');
  assert(/do NOT (edit|auto-add|commit)/i.test(src) || /NOT auto-add the task/i.test(src), 'coverage layer must not auto-add tasks');
  // a feature with a confirmed gap is excluded from impl_ready
  assert(/gapFeatures/.test(src) && /!gapFeatures\.has\(f\)/.test(src), 'impl_ready does not exclude features with coverage gaps');
});

test('returns the P4 contract keys', () => {
  const m = src.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  for (const key of ['audited', 'faithful', 'spec_fixed', 'product_routed', 'residual', 'coverage_gaps', 'impl_ready']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(m[0]), `return object missing key: ${key}`);
  }
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
