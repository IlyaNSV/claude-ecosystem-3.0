'use strict';
/**
 * Unit test for the Orchestrator remediation-guard lib (DEC-DEV-0096, N+2 queue P5 / T5).
 *
 * remediation-guard.cjs owns the remediation-DISCRETION axis: given a free-text blocker or
 * a remediation/fix note, is this a transient hiccup to auto-retry, a capability gap to
 * route, or a cross-spec / design contradiction that must ESCALATE (never be resolved
 * unilaterally)? T5's risk is agent CONCURRENCY (FB-LR-07: a committer that picked a side
 * masked an upstream conflict), so the value rides on the classifier being adversarially
 * correct — hence this test leans on ADVERSARIAL cases, not just happy-path strings:
 *   - a transient-looking reason that is ACTUALLY a cross-spec conflict ⇒ must escalate,
 *     never retry (a "retry" must never paper over a real contradiction);
 *   - a "fix" note that SOUNDS clean but admits a unilateral resolution ⇒ must be flagged;
 *   - a routine fix note with a resolution verb but NO contradiction ⇒ must NOT be flagged
 *     (false-positive guard — a flagged fix becomes a MANUAL_VERIFY).
 *
 * Node stdlib only; run with `node tests/orchestrator/remediation-guard.test.cjs`.
 */

const assert = require('node:assert');
const path = require('node:path');

const lib = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'remediation-guard.cjs'));
const { classifyBlock, detectsUnilateralResolution, worstClass, BLOCK_CLASSES, ROUTE } = lib;

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

console.log('orchestrator remediation-guard — discretion classifier (DEC-DEV-0096, T5)');

test('exports the contract surface', () => {
  assert.ok(typeof classifyBlock === 'function', 'classifyBlock missing');
  assert.ok(typeof detectsUnilateralResolution === 'function', 'detectsUnilateralResolution missing');
  assert.ok(typeof worstClass === 'function', 'worstClass missing');
  assert.deepStrictEqual(
    { ...BLOCK_CLASSES },
    {
      TRANSIENT: 'transient',
      CONTENT: 'content',
      CAPABILITY: 'capability',
      CROSS_SPEC_CONFLICT: 'cross-spec-conflict',
      DESIGN_CONTRADICTION: 'design-contradiction',
    },
    'block-class enum drifted',
  );
});

// ---- classifyBlock: the four signature classes -----------------------------

test('a genuine transient hiccup ⇒ transient + retryable + route:retry', () => {
  for (const reason of [
    'fatal: Unable to create .git/index.lock: File exists (another git process)',
    'npm ERR! network ETIMEDOUT while fetching from registry',
    'request failed with HTTP 503, temporarily unavailable — please try again',
    'EAGAIN: resource temporarily unavailable',
  ]) {
    const r = classifyBlock(reason);
    assert.strictEqual(r.class, BLOCK_CLASSES.TRANSIENT, `not transient: ${reason}`);
    assert.strictEqual(r.retryable, true, `transient must be retryable: ${reason}`);
    assert.strictEqual(r.route, 'retry', `transient route must be retry: ${reason}`);
  }
});

test('a cross-spec contradiction ⇒ cross-spec-conflict + NOT retryable + route:escalate-concern', () => {
  for (const reason of [
    'cannot fix: requirements 1.1 and 12.6 contradict on had_trial ownership',
    'the billing spec contradicts requirement FM-005 — two specs disagree',
    'conflicting requirements: req 1.1 vs req 12.6',
    'this is a cross-feature conflict over ownership of the trial flag',
  ]) {
    const r = classifyBlock(reason);
    assert.strictEqual(r.class, BLOCK_CLASSES.CROSS_SPEC_CONFLICT, `not cross-spec-conflict: ${reason}`);
    assert.strictEqual(r.retryable, false, `a conflict must NOT be retryable: ${reason}`);
    assert.strictEqual(r.route, 'escalate-concern', `a conflict must escalate: ${reason}`);
  }
});

test('a design self-contradiction ⇒ design-contradiction + escalate (no unilateral path pick)', () => {
  for (const reason of [
    'the design self-contradicts on card_last4 storage',
    'design.md says both encrypt and store plaintext — contradictory design',
    'design states both 4-digit and full PAN — internally inconsistent',
  ]) {
    const r = classifyBlock(reason);
    assert.strictEqual(r.class, BLOCK_CLASSES.DESIGN_CONTRADICTION, `not design-contradiction: ${reason}`);
    assert.strictEqual(r.route, 'escalate-concern', `design contradiction must escalate: ${reason}`);
    assert.strictEqual(r.retryable, false);
  }
});

test('a capability gap ⇒ capability + route:capability-request (Integrator/Product, not self-equip, not retry)', () => {
  for (const reason of [
    'blocked: missing STRIPE_SECRET_KEY — no credential available',
    'the prisma CLI tool is not installed on PATH',
    'needs an upstream product decision on the provider choice',
    'requires access to the staging database — provisioning needed',
  ]) {
    const r = classifyBlock(reason);
    assert.strictEqual(r.class, BLOCK_CLASSES.CAPABILITY, `not capability: ${reason}`);
    assert.strictEqual(r.route, 'capability-request', `capability must route to a request: ${reason}`);
    assert.strictEqual(r.retryable, false, 'a capability gap is not retryable');
  }
});

test('an unmatched/ordinary block ⇒ content + route:debug-block (uncertainty is NOT a retry)', () => {
  for (const reason of [
    'the RED test still fails: expected 200, got 500 in the controller',
    'TypeError: cannot read property id of undefined in the service',
    '',
    null,
  ]) {
    const r = classifyBlock(reason);
    assert.strictEqual(r.class, BLOCK_CLASSES.CONTENT, `unmatched must be content: ${reason}`);
    assert.strictEqual(r.route, 'debug-block', 'content routes to debug-block');
    assert.strictEqual(r.retryable, false, 'content/unknown must NEVER auto-retry (conservative)');
  }
});

// ---- ADVERSARIAL: a conflict must beat a transient signal ------------------

test('ADVERSARIAL: a "retry"-flavoured reason that is ACTUALLY a conflict ⇒ escalate, never retry', () => {
  // both a transient verb ("try again") AND a cross-spec contradiction are present — the
  // conflict MUST win, else a real contradiction gets papered over by an auto-retry.
  const r = classifyBlock('try again later? no — requirements 1.1 and 12.6 contradict; the two specs disagree on had_trial');
  assert.strictEqual(r.class, BLOCK_CLASSES.CROSS_SPEC_CONFLICT, 'a conflict must outrank a transient signal');
  assert.strictEqual(r.retryable, false, 'a reason carrying a conflict must NOT be retryable even if it also looks transient');
  assert.ok(r.signals.some((g) => g.class === BLOCK_CLASSES.TRANSIENT), 'the transient signal should still be recorded');
  assert.ok(r.signals.some((g) => g.class === BLOCK_CLASSES.CROSS_SPEC_CONFLICT), 'the conflict signal should be recorded');
});

test('worstClass picks the higher-severity class; conflict > capability > content > transient', () => {
  assert.strictEqual(worstClass(BLOCK_CLASSES.TRANSIENT, BLOCK_CLASSES.CROSS_SPEC_CONFLICT), BLOCK_CLASSES.CROSS_SPEC_CONFLICT);
  assert.strictEqual(worstClass(BLOCK_CLASSES.CAPABILITY, BLOCK_CLASSES.CONTENT), BLOCK_CLASSES.CAPABILITY);
  assert.strictEqual(worstClass(null, BLOCK_CLASSES.TRANSIENT), BLOCK_CLASSES.TRANSIENT);
  assert.strictEqual(worstClass(BLOCK_CLASSES.CONTENT, null), BLOCK_CLASSES.CONTENT);
});

// ---- detectsUnilateralResolution: the FB-LR-07 anti-mask backstop ----------

test('ADVERSARIAL: a "fix" note that admits a unilateral resolution of a contradiction ⇒ flagged', () => {
  for (const note of [
    'the specs contradicted on had_trial so I chose option A and committed',
    'design said both — I picked the 4-digit path to unblock the test',
    'resolved the conflict by going with requirement 12.6 over 1.1',
    'FM-001 and FM-005 disagreed; I decided to flip had_trial in auth',
  ]) {
    const r = detectsUnilateralResolution(note);
    assert.strictEqual(r.unilateral, true, `should flag a unilateral resolution: ${note}`);
    assert.ok(r.verb_signals.length && r.context_signals.length, 'both a verb and a context signal must be present');
  }
});

test('FALSE-POSITIVE GUARD: a routine fix with a resolution verb but NO contradiction ⇒ NOT flagged', () => {
  for (const note of [
    'I chose the simplest assertion and added the missing unit test',
    'picked a clearer variable name and fixed the off-by-one',
    'decided to memoize the selector for the perf finding',
    'added the production call-site for the orphan export',
  ]) {
    const r = detectsUnilateralResolution(note);
    assert.strictEqual(r.unilateral, false, `must NOT flag a routine fix (no contradiction context): ${note}`);
  }
});

test('FALSE-POSITIVE GUARD: a contradiction mentioned but only ESCALATED (no resolution verb) ⇒ NOT flagged', () => {
  // the safe behaviour we WANT — the agent surfaced the contradiction instead of resolving it.
  const r = detectsUnilateralResolution('the two specs contradict on had_trial; BLOCKED — escalating to a product decision, did not commit a side');
  assert.strictEqual(r.unilateral, false, 'escalating (not deciding) a contradiction must not be flagged as unilateral');
  assert.ok(r.context_signals.length >= 1, 'the contradiction context should still be detected');
});

test('empty / null notes ⇒ not unilateral', () => {
  assert.strictEqual(detectsUnilateralResolution('').unilateral, false);
  assert.strictEqual(detectsUnilateralResolution(null).unilateral, false);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
