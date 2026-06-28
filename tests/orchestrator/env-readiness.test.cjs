'use strict';
/**
 * Unit test for the Orchestrator env-readiness lib (DEC-DEV-0092, N+2 increment).
 *
 * env-readiness.cjs owns the READINESS axis of the two-axis gate-outcome contract
 * (verdict × readiness). The live `probe` mode shells out (child_process) and is
 * environment-dependent, so it is NOT unit-tested here; the PURE classifiers are —
 * they are deterministic and are the part the gate's correctness rides on:
 *   - classifyFailures(): the substrate-error allowlist — does a RED suite mean the
 *     code failed, or just that the substrate was down? (the run-B false-NO-GO).
 *   - classifyReadiness(): down / inconsistent substrate ⇒ ENV_NOT_READY; a used-but-
 *     unprobed substrate (unknown) ⇒ DEGRADED (FB-LR-24, never a silent READY).
 *
 * Node stdlib only; run with `node tests/orchestrator/env-readiness.test.cjs`.
 */

const assert = require('node:assert');
const path = require('node:path');

const lib = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'env-readiness.cjs'));
const { classifyFailures, classifyReadiness, SUBSTRATE_ALLOWLIST, READINESS } = lib;

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

console.log('orchestrator env-readiness — readiness-axis classifiers (DEC-DEV-0092)');

test('exports the contract surface', () => {
  assert.ok(typeof classifyFailures === 'function', 'classifyFailures missing');
  assert.ok(typeof classifyReadiness === 'function', 'classifyReadiness missing');
  assert.ok(Array.isArray(SUBSTRATE_ALLOWLIST) && SUBSTRATE_ALLOWLIST.length, 'SUBSTRATE_ALLOWLIST missing');
  assert.deepStrictEqual(
    { ...READINESS },
    { READY: 'READY', DEGRADED: 'DEGRADED', ENV_NOT_READY: 'ENV_NOT_READY' },
    'readiness enum drifted',
  );
});

test('allowlist matches the four work-order substrate signatures', () => {
  // PrismaClientInitializationError / ECONNREFUSED :5432|:6379 / Docker daemon / npipe
  const cases = [
    'PrismaClientInitializationError: Cannot reach DB',
    'Error: connect ECONNREFUSED 127.0.0.1:5432',
    'Error: connect ECONNREFUSED 127.0.0.1:6379',
    'Cannot connect to the Docker daemon at unix:///var/run/docker.sock',
    'error during connect: ... npipe://./pipe/docker_engine: ...',
  ];
  for (const line of cases) {
    const r = classifyFailures([line]);
    assert.strictEqual(r.all_substrate, true, `not classified as substrate: ${line}`);
    assert.strictEqual(r.real_failures.length, 0, `leaked a real failure for: ${line}`);
  }
});

test('a SINGLE real failure flips all_substrate to false (never mask a code defect)', () => {
  const r = classifyFailures([
    'PrismaClientInitializationError: db down',
    'AssertionError: expected 200 to equal 404',   // a real test failure
  ]);
  assert.strictEqual(r.all_substrate, false, 'a real failure must defeat all_substrate');
  assert.strictEqual(r.real_failures.length, 1, 'the real failure must be retained');
  assert.strictEqual(r.substrate_failures.length, 1, 'the substrate failure must still be tallied');
});

test('empty failures → all_substrate false (no failures is not "all substrate")', () => {
  const r = classifyFailures([]);
  assert.strictEqual(r.all_substrate, false);
  assert.strictEqual(r.total, 0);
});

test('real-only failures → all_substrate false', () => {
  const r = classifyFailures(['Expected true to be false', 'TypeError: x is not a function']);
  assert.strictEqual(r.all_substrate, false);
  assert.strictEqual(r.real_failures.length, 2);
});

test('classifyReadiness: a down check ⇒ ENV_NOT_READY', () => {
  const r = classifyReadiness([
    { name: 'docker-daemon', status: 'down', detail: 'cannot connect' },
    { name: 'postgres', status: 'skipped' },
  ]);
  assert.strictEqual(r.readiness, 'ENV_NOT_READY');
  assert.ok(r.reasons.length >= 1, 'down reason not surfaced');
});

test('classifyReadiness: an inconsistent migration history ⇒ ENV_NOT_READY (FB-LR-09)', () => {
  const r = classifyReadiness([{ name: 'migrations', status: 'inconsistent', detail: 'not in sync' }]);
  assert.strictEqual(r.readiness, 'ENV_NOT_READY');
});

test('classifyReadiness: up/skipped only ⇒ READY', () => {
  assert.strictEqual(classifyReadiness([]).readiness, 'READY');
  assert.strictEqual(classifyReadiness([
    { name: 'docker-daemon', status: 'up' },
    { name: 'postgres', status: 'skipped' },
  ]).readiness, 'READY');
});

test('classifyReadiness: a USED-but-unprobed substrate (unknown) ⇒ DEGRADED, not silent READY (FB-LR-24)', () => {
  const r = classifyReadiness([
    { name: 'docker-daemon', status: 'up' },
    { name: 'postgres', status: 'unknown', detail: 'pg_isready not installed' },
  ]);
  assert.strictEqual(r.readiness, 'DEGRADED', 'an unprobed used substrate must degrade readiness');
  assert.ok(r.reasons.some((s) => /postgres/i.test(s)), 'the unprobed substrate must be surfaced in reasons');
});

test('classifyReadiness: DOWN dominates unknown (worst-axis) ⇒ ENV_NOT_READY (FB-LR-24)', () => {
  const r = classifyReadiness([
    { name: 'postgres', status: 'down', detail: 'refused' },
    { name: 'redis', status: 'unknown', detail: 'redis-cli not installed' },
  ]);
  assert.strictEqual(r.readiness, 'ENV_NOT_READY', 'a down substrate must dominate an unknown one');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
