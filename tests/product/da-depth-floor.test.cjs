'use strict';
/**
 * Unit test for the deterministic depth-floor guardrail (G30, DEC-DEV-0182).
 *
 * The lib is pure and dependency-free, so this exercises real escalation behavior:
 * every structural signal that must force `depth_floor: significant`, plus the
 * absent-signal path that MUST stay null (== pre-G30 adaptive behavior 1:1).
 *
 * Node stdlib only; run with `node tests/product/da-depth-floor.test.cjs`.
 */

const path = require('node:path');
const { computeDepthFloor } = require(
  path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'da-depth-floor.cjs')
);

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
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'not equal'} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }
function has(arr, v) { assert(arr.includes(v), `expected signal "${v}" in [${arr.join(', ')}]`); }

console.log('da-depth-floor — G30 guardrail');

// ---------- creation (empty / synthetic marker) → significant [IC + BR] ----------

test('empty diff → creation floor', () => {
  const r = computeDepthFloor('', 'invariant-check');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'creation');
});

test('null diff → creation floor (defensive)', () => {
  const r = computeDepthFloor(null, 'business-rule');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'creation');
});

test('synthetic "No git diff available" creation marker → creation floor', () => {
  const marker = '# (No git diff available — likely IC creation or file not in git)\n# Full file content:\n\nid: IC-007';
  const r = computeDepthFloor(marker, 'invariant-check');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'creation');
});

// ---------- IC structural signals ----------

test('IC severity change TO critical → severity-critical floor', () => {
  const diff = [
    'diff --git a/x b/x',
    '--- a/x',
    '+++ b/x',
    '@@ -1 +1 @@',
    '-severity: high',
    '+severity: critical',
  ].join('\n');
  const r = computeDepthFloor(diff, 'invariant-check');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'severity-critical');
});

test('IC severity change FROM critical → severity-critical floor', () => {
  const diff = '@@\n-severity: critical\n+severity: high';
  const r = computeDepthFloor(diff, 'invariant-check');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'severity-critical');
});

test('IC entity change → entity-change floor', () => {
  const diff = '@@\n-entity: "Freelancer"\n+entity: "Client"';
  const r = computeDepthFloor(diff, 'invariant-check');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'entity-change');
});

// ---------- BR structural signals ----------

test('BR category change → category-change floor', () => {
  const diff = '@@\n-category: validation\n+category: authorization';
  const r = computeDepthFloor(diff, 'business-rule');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'category-change');
});

test('BR category signal does NOT fire for an IC artifactType', () => {
  const diff = '@@\n-category: validation\n+category: authorization';
  const r = computeDepthFloor(diff, 'invariant-check');
  // category is a BR field; on IC no BR-specific signal fires → null (absent==old)
  eq(r.floor, null, 'floor should be null for IC on a category line');
});

// ---------- shared: activation ----------

test('status → active (added) → activation floor', () => {
  const diff = '@@\n-status: draft\n+status: active';
  const r = computeDepthFloor(diff, 'business-rule');
  eq(r.floor, 'significant', 'floor');
  has(r.signals, 'activation');
});

test('status → deprecated (not active) → no activation from that line', () => {
  const diff = '@@\n-status: active\n+status: deprecated';
  const r = computeDepthFloor(diff, 'business-rule');
  // removed "-status: active" is not an ADDED active; no other signal → null
  eq(r.floor, null, 'deprecation should not raise activation floor');
});

// ---------- absent signal → null (== pre-G30 adaptive behavior 1:1) ----------

test('typo fix in prose (no structural field) → null floor', () => {
  const diff = '@@\n-The freelancr must confirm.\n+The freelancer must confirm.';
  const r = computeDepthFloor(diff, 'invariant-check');
  eq(r.floor, null, 'typo fix must stay on the adaptive path');
  eq(r.signals.length, 0, 'no signals');
});

test('frontmatter metadata-only bump (updated/version) → null floor', () => {
  const diff = '@@\n-updated: 2026-05-10\n+updated: 2026-05-12\n-version: 1\n+version: 2';
  const r = computeDepthFloor(diff, 'business-rule');
  eq(r.floor, null, 'metadata bump must stay on the adaptive path');
});

test('reference-list bullet add (rules[]) → null floor', () => {
  const diff = '@@\n rules:\n+  - BR-042';
  const r = computeDepthFloor(diff, 'invariant-check');
  eq(r.floor, null, 'ref-list add must stay on the adaptive path');
});

test('BR parameter value tune (§6.2 cosmetic example) → null floor', () => {
  // value tune within same type lives in parameters:; deliberately NOT floored (would
  // false-positive vs the documented cosmetic case). Left to the adaptive LLM.
  const diff = '@@\n-  strategy: first_match\n+  strategy: best_match';
  const r = computeDepthFloor(diff, 'business-rule');
  eq(r.floor, null, 'value tune must stay on the adaptive path');
});

test('context lines are ignored (only +/- content lines drive signals)', () => {
  // severity: critical present only as an unchanged CONTEXT line (leading space) → no fire
  const diff = '@@ -1,3 +1,3 @@\n severity: critical\n-title: Old\n+title: New';
  const r = computeDepthFloor(diff, 'invariant-check');
  eq(r.floor, null, 'unchanged context severity line must not fire');
});

// ---------- summary ----------

if (process.exitCode) {
  console.error(`\nda-depth-floor: FAILURES (passed ${passed}).`);
} else {
  console.log(`\nda-depth-floor: all ${passed} passed.`);
}
