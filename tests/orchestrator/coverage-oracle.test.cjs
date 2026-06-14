'use strict';
/**
 * Contract test for orchestrator/lib/coverage-oracle.cjs.
 *
 * Canonizes P1-1 (coverage-oracle — "don't trust self-report") from Orchestrator
 * dogfood RUN 01 (DEC-DEV-0068). Locks in:
 *   1. Source IDs are re-derived from GROUND TRUTH §5/§6/§9 — independent of any
 *      subagent claim.
 *   2. The §10-clobber shape (restarted `## N.` UI sub-docs) cannot leak IDs into
 *      the canonical families (monotonic guard mirrors the adapter).
 *   3. Coverage mode flags a missing source ID (the silent-drop the self-report
 *      would have hidden).
 *   4. Self-report cross-check catches both omission and fabrication.
 *
 * Node stdlib only; run with `node tests/orchestrator/coverage-oracle.test.cjs`
 * or `npm run test:orchestrator`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  extractSourceIds,
  computeCoverage,
  crossCheckSelfReport,
  extractSections,
} = require('../../orchestrator/lib/coverage-oracle.cjs');

const FIX = path.join(__dirname, '..', 'fixtures');
const readFix = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');

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

console.log('coverage-oracle contract test (DEC-DEV-0068 P1-1)');

// 1 — ground-truth extraction from a clean handoff
test('FM-FIXTURE-001 (clean v1.2): source IDs from §5/§6/§9', () => {
  const ids = extractSourceIds(readFix('FM-FIXTURE-001-handoff.md'));
  assert.deepStrictEqual(ids.scenarios, ['SC-001', 'SC-002'], 'scenarios SC-001/SC-002');
  assert.deepStrictEqual(ids.rules, ['BR-001'], 'rule BR-001');
  assert.deepStrictEqual(ids.invariants, ['IC-001'], 'invariant IC-001');
});

// 2 — §10-clobber fixture: no leakage into canonical families
test('FM-FIXTURE-002 (§10 UI sub-docs, v1.4): no §10 leakage into SC/BR/IC', () => {
  const ids = extractSourceIds(readFix('FM-FIXTURE-002-handoff.md'));
  assert.deepStrictEqual(ids.scenarios, ['SC-001'], 'only the real §5 SC-001');
  assert.deepStrictEqual(ids.rules, ['BR-001'], 'only the real §6 BR-001');
  assert.deepStrictEqual(ids.invariants, ['IC-001'], 'only the real §9 IC-001');
});

// 3 — monotonic guard isolated (a restarted ## 5. must not re-open §5)
test('extractSections monotonic guard: restarted ## N. stays in parent body', () => {
  const body = [
    '## 5. Scenarios', 'SC-100 real', '',
    '## 10. UI Specification', 'ui intro', '',
    '## 5. Accessibility Notes', 'SC-999 leaked?', '',
    '## 11. NFR', 'nfr',
  ].join('\n');
  const s = extractSections(body);
  assert.match(s.get(5), /SC-100 real/, 'real §5 intact');
  assert.doesNotMatch(s.get(5), /SC-999/, '§5 not re-opened by restart');
  assert.match(s.get(10), /SC-999/, 'restarted ## 5. absorbed into §10 body');
});

// 4 — coverage mode flags a silently dropped scenario
test('coverage mode: missing SC-002 is flagged (passed=false)', () => {
  const sourceIds = { scenarios: ['SC-001', 'SC-002'], rules: ['BR-001'], invariants: ['IC-001'] };
  // generated spec text covers SC-001/BR-001/IC-001 but silently omits the second scenario
  const targetSpec = 'requirements.md: REQ-1 maps SC-001; REQ-2 maps BR-001; invariant IC-001 enforced.';
  const cov = computeCoverage(sourceIds, targetSpec);
  assert.strictEqual(cov.passed, false, 'missing one scenario → not passed');
  assert.deepStrictEqual(cov.families.scenarios.missing, ['SC-002'], 'SC-002 reported missing');
  assert.deepStrictEqual(cov.families.rules.missing, [], 'BR-001 covered');
  assert.strictEqual(cov.missing_count, 1, 'exactly one missing');
});

// 5 — full coverage passes
test('coverage mode: all source IDs present → passed=true', () => {
  const sourceIds = { scenarios: ['SC-001'], rules: ['BR-001'], invariants: ['IC-001'] };
  const cov = computeCoverage(sourceIds, 'spec mentions SC-001 and BR-001 and IC-001 fully');
  assert.strictEqual(cov.passed, true, 'all covered');
  assert.strictEqual(cov.missing_count, 0, 'nothing missing');
});

// 6 — self-report cross-check catches omission AND fabrication
test('self-report cross-check: omission + fabrication both surfaced', () => {
  const sourceIds = { scenarios: ['SC-001', 'SC-002'], rules: ['BR-001'], invariants: [] };
  // subagent claims SC-001 + BR-001 + a fabricated SC-099, omits SC-002
  const x = crossCheckSelfReport(sourceIds, ['SC-001', 'BR-001', 'SC-099']);
  assert.deepStrictEqual(x.unclaimed_ground_truth, ['SC-002'], 'SC-002 omitted by subagent');
  assert.deepStrictEqual(x.fabricated_claims, ['SC-099'], 'SC-099 fabricated by subagent');
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
