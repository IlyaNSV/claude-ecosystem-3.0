'use strict';
/**
 * Unit test for orchestrator/lib/fidelity-oracle.cjs (Orchestrator P4 trace-integrity).
 *
 * The deterministic half of P4 `audit-spec-fidelity`: every id a generated spec
 * REFERENCES must exist in the .product ground truth. The canonical regression is the
 * RUN-01 fictitious trace (a spec citing IC-013 that no product artifact defines).
 *
 * Node stdlib only; run with `node tests/orchestrator/fidelity-oracle.test.cjs`.
 */

const assert = require('node:assert');
const {
  extractAllIds,
  unionIds,
  computeTraceIntegrity,
} = require('../../orchestrator/lib/fidelity-oracle.cjs');

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

console.log('orchestrator P4 — fidelity-oracle (trace-integrity)');

test('extractAllIds picks up every trace family', () => {
  const ids = extractAllIds('traces FM-002, SC-010, BR-040, IC-008 and NFR-004 here');
  assert.deepStrictEqual(ids.FM, ['FM-002']);
  assert.deepStrictEqual(ids.SC, ['SC-010']);
  assert.deepStrictEqual(ids.BR, ['BR-040']);
  assert.deepStrictEqual(ids.IC, ['IC-008']);
  assert.deepStrictEqual(ids.NFR, ['NFR-004']);
});

test('extractAllIds strips frontmatter (body ids only)', () => {
  const ids = extractAllIds('---\nrefs: SC-999\n---\nbody references SC-001');
  assert.deepStrictEqual(ids.SC, ['SC-001'], 'frontmatter SC-999 must not count as ground truth');
});

test('clean spec: every ref resolves → passed', () => {
  const source = extractAllIds('§5 SC-010 §6 BR-040 §9 IC-008');
  const spec = extractAllIds('implements SC-010 per BR-040, invariant IC-008');
  const r = computeTraceIntegrity(source, spec);
  assert.strictEqual(r.passed, true);
  assert.strictEqual(r.dangling_count, 0);
});

test('fictitious trace: spec cites IC-013 absent from product → fail (RUN-01 regression)', () => {
  const source = extractAllIds('§9 IC-008 IC-009');
  const spec = extractAllIds('satisfies IC-008 and IC-013');
  const r = computeTraceIntegrity(source, spec);
  assert.strictEqual(r.passed, false);
  assert.deepStrictEqual(r.families.IC.dangling, ['IC-013']);
  assert.strictEqual(r.dangling_count, 1);
});

test('dangling NFR across families is counted', () => {
  const source = extractAllIds('SC-010 BR-040');
  const spec = extractAllIds('SC-010 BR-040 NFR-099');
  const r = computeTraceIntegrity(source, spec);
  assert.strictEqual(r.passed, false);
  assert.deepStrictEqual(r.families.NFR.dangling, ['NFR-099']);
});

test('unionIds merges + de-dups across multiple sources', () => {
  const a = extractAllIds('SC-001 SC-002');
  const b = extractAllIds('SC-002 SC-003');
  const u = unionIds(a, b);
  assert.deepStrictEqual(u.SC, ['SC-001', 'SC-002', 'SC-003']);
});

test('multi-source ground truth resolves a ref present only in the second source', () => {
  // handoff lacks NFR-004; the .product NFR artifact (2nd source) supplies it → not dangling
  const source = unionIds(extractAllIds('SC-010 BR-040'), extractAllIds('NFR-004 NFR-005'));
  const spec = extractAllIds('SC-010 honors NFR-004');
  const r = computeTraceIntegrity(source, spec);
  assert.strictEqual(r.passed, true);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
