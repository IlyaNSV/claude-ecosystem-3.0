'use strict';
/**
 * Unit test for the Orchestrator runtime-readiness lib (DEC-DEV-0120) — the P7
 * `runtime-smoke-readiness` deterministic core. The CLI's FS/env reads are
 * environment-dependent and NOT unit-tested here; the PURE functions are — the
 * verdict synthesis the gate's correctness rides on:
 *   - detectRunTarget(): find the boot command (dev_command / runtime.command /
 *     scripts.dev|start|serve), else null ⇒ NOT_STARTABLE.
 *   - bootBlockingCaps(): a §6 BLOCK capability is a hard boot blocker; a DEFERRED
 *     one (dev stand-in) is NOT — it is disclosed.
 *   - assessReadiness(): precedence NOT_STARTABLE > BLOCKED_ON_CAPABILITY >
 *     ENV_NOT_READY > READY_TO_SMOKE; disclosures carry the "green boot ≠ proof"
 *     caveats (RUN 01 P7 lesson: 223 tests green ≠ app starts).
 *   - smokePlan(): the success-signal / failure-class taxonomy (env-not-loaded 500 etc).
 *
 * Node stdlib only; run with `node tests/orchestrator/runtime-readiness.test.cjs`.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'runtime-readiness.cjs');
const lib = require(LIB_PATH);
const {
  detectRunTarget, bootBlockingCaps, deferredCaps, buildRequests,
  assessReadiness, smokePlan, summarize, capabilitiesFor, VERDICT, READINESS, ROUTE,
} = lib;

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

// §6 surfaced-item shapes (as capability-probe.surface() would produce them).
const BLOCK_CAP = { capability: 'billing', secret_env: 'STRIPE_SECRET_KEY', provider: 'Stripe', tier: 'prod', dev_stand_in: '', disposition: 'BLOCK', provider_choice_pending: false, routes: [ROUTE.INTEGRATOR] };
const BLOCK_TBD = { capability: 'tts', secret_env: 'TTS_API_KEY', provider: 'TBD', tier: 'prod', dev_stand_in: '', disposition: 'BLOCK', provider_choice_pending: true, routes: [ROUTE.INTEGRATOR, ROUTE.PRODUCT] };
const DEFERRED_CAP = { capability: 'mt', secret_env: 'DEEPL_API_KEY', provider: 'DeepL', tier: 'prod', dev_stand_in: 'Mock', disposition: 'EXPECTED_ABSENT_BUT_DEFERRED', provider_choice_pending: false };

console.log('orchestrator runtime-readiness — P7 pure functions (DEC-DEV-0120)');

test('exports the contract surface + verdict enum is stable', () => {
  assert.ok(typeof detectRunTarget === 'function', 'detectRunTarget missing');
  assert.ok(typeof assessReadiness === 'function', 'assessReadiness missing');
  assert.ok(typeof smokePlan === 'function', 'smokePlan missing');
  assert.deepStrictEqual(
    { ...VERDICT },
    {
      READY_TO_SMOKE: 'READY_TO_SMOKE',
      BLOCKED_ON_CAPABILITY: 'BLOCKED_ON_CAPABILITY',
      ENV_NOT_READY: 'ENV_NOT_READY',
      NOT_STARTABLE: 'NOT_STARTABLE',
    },
    'verdict enum drifted',
  );
});

test('detectRunTarget: scripts.dev preferred → `npm run dev`', () => {
  const t = detectRunTarget({ scripts: { dev: 'next dev', build: 'next build' } });
  assert.deepStrictEqual(t, { command: 'npm run dev', source: 'scripts.dev' });
});

test('detectRunTarget: scripts.start when no dev', () => {
  const t = detectRunTarget({ scripts: { start: 'node server.js', test: 'jest' } });
  assert.deepStrictEqual(t, { command: 'npm run start', source: 'scripts.start' });
});

test('detectRunTarget: explicit dev_command wins over scripts', () => {
  const t = detectRunTarget({ dev_command: 'make dev', scripts: { dev: 'next dev' } });
  assert.deepStrictEqual(t, { command: 'make dev', source: 'dev_command' });
});

test('detectRunTarget: nothing bootable ⇒ null', () => {
  assert.strictEqual(detectRunTarget({ scripts: { test: 'jest', lint: 'eslint .' } }), null);
  assert.strictEqual(detectRunTarget({}), null);
  assert.strictEqual(detectRunTarget(null), null);
});

test('bootBlockingCaps: only BLOCK items; deferredCaps: only DEFERRED', () => {
  const caps = [BLOCK_CAP, DEFERRED_CAP, BLOCK_TBD];
  assert.strictEqual(bootBlockingCaps(caps).length, 2, 'two BLOCK caps');
  assert.strictEqual(deferredCaps(caps).length, 1, 'one deferred cap');
  assert.strictEqual(bootBlockingCaps([]).length, 0);
  assert.strictEqual(bootBlockingCaps(null).length, 0);
});

test('assessReadiness: no run target ⇒ NOT_STARTABLE (route Product), not attemptable', () => {
  const a = assessReadiness({ runTarget: null, capabilities: [], envReadiness: READINESS.READY });
  assert.strictEqual(a.verdict, VERDICT.NOT_STARTABLE);
  assert.strictEqual(a.smoke_attemptable, false);
  assert.deepStrictEqual(a.routes, [ROUTE.PRODUCT]);
});

test('assessReadiness: a BLOCK cap ⇒ BLOCKED_ON_CAPABILITY + a §6 request (precedence over env)', () => {
  const a = assessReadiness({
    runTarget: { command: 'npm run dev', source: 'scripts.dev' },
    capabilities: [BLOCK_CAP],
    envReadiness: READINESS.ENV_NOT_READY,   // worse env, but capability gap takes precedence
  });
  assert.strictEqual(a.verdict, VERDICT.BLOCKED_ON_CAPABILITY);
  assert.strictEqual(a.smoke_attemptable, false);
  assert.strictEqual(a.requests.length, 1);
  assert.strictEqual(a.requests[0].await, 'OD7');
  assert.deepStrictEqual(a.requests[0].routes, [ROUTE.INTEGRATOR]);
});

test('assessReadiness: BLOCK with undecided provider routes Integrator + Product', () => {
  const a = assessReadiness({ runTarget: { command: 'npm run dev' }, capabilities: [BLOCK_TBD] });
  assert.strictEqual(a.requests[0].provider_choice_pending, true);
  assert.deepStrictEqual(a.requests[0].routes, [ROUTE.INTEGRATOR, ROUTE.PRODUCT]);
});

test('assessReadiness: env down (no cap gap) ⇒ ENV_NOT_READY (transient, no §6 request)', () => {
  const a = assessReadiness({
    runTarget: { command: 'npm run dev' },
    capabilities: [DEFERRED_CAP],            // deferred does NOT block the boot
    envReadiness: READINESS.ENV_NOT_READY,
  });
  assert.strictEqual(a.verdict, VERDICT.ENV_NOT_READY);
  assert.strictEqual(a.smoke_attemptable, false);
  assert.strictEqual(a.requests.length, 0, 'env-down is not a capability request');
});

test('assessReadiness: clean ⇒ READY_TO_SMOKE + attemptable', () => {
  const a = assessReadiness({
    runTarget: { command: 'npm run dev' },
    capabilities: [{ disposition: 'SATISFIED' }],
    envReadiness: READINESS.READY,
    p6Verdict: 'GO',
  });
  assert.strictEqual(a.verdict, VERDICT.READY_TO_SMOKE);
  assert.strictEqual(a.smoke_attemptable, true);
  assert.strictEqual(a.disclosures.length, 0, 'a clean GO + READY has no caveats');
});

test('assessReadiness: a deferred stand-in is DISCLOSED even when READY (mock-only boot ≠ prod-ready)', () => {
  const a = assessReadiness({
    runTarget: { command: 'npm run dev' },
    capabilities: [DEFERRED_CAP],
    envReadiness: READINESS.READY,
    p6Verdict: 'GO',
  });
  assert.strictEqual(a.verdict, VERDICT.READY_TO_SMOKE, 'deferred does not block');
  assert.ok(a.disclosures.some((d) => /stand-in/.test(d)), 'the stand-in must be disclosed');
});

test('assessReadiness: a non-GO P6 and DEGRADED env are disclosed (green boot is indicative, not proof)', () => {
  const a = assessReadiness({
    runTarget: { command: 'npm run dev' },
    capabilities: [],
    envReadiness: READINESS.DEGRADED,
    p6Verdict: 'MANUAL_VERIFY',
  });
  assert.strictEqual(a.verdict, VERDICT.READY_TO_SMOKE, 'DEGRADED does not block, only discloses');
  assert.ok(a.disclosures.some((d) => /non-GO/.test(d)), 'non-GO disclosed');
  assert.ok(a.disclosures.some((d) => /DEGRADED/.test(d)), 'DEGRADED disclosed');
});

test('smokePlan: carries the command + the env-not-loaded 500 failure class (RUN 01 root cause)', () => {
  const p = smokePlan({ command: 'npm run dev', healthCheck: 'GET http://localhost:3000/health' });
  assert.strictEqual(p.command, 'npm run dev');
  assert.ok(p.success_signals.length >= 2);
  assert.ok(p.failure_classes.some((f) => f.id === 'env-not-loaded'), 'must codify the RUN 01 env-not-loaded 500');
});

test('summarize: reports verdict, attemptability, request + disclosure counts', () => {
  const a = assessReadiness({ runTarget: { command: 'npm run dev' }, capabilities: [BLOCK_CAP, DEFERRED_CAP], p6Verdict: 'GO' });
  const s = summarize(a);
  assert.strictEqual(s.verdict, VERDICT.BLOCKED_ON_CAPABILITY);
  assert.strictEqual(s.smoke_attemptable, false);
  assert.strictEqual(s.requests, 1);
  assert.ok(s.disclosures >= 1, 'the deferred cap is disclosed');
});

test('buildRequests: defaults routes to Integrator (+Product if provider undecided)', () => {
  const reqs = buildRequests([{ capability: 'x', secret_env: 'X', provider_choice_pending: true }]);
  assert.deepStrictEqual(reqs[0].routes, [ROUTE.INTEGRATOR, ROUTE.PRODUCT]);
  assert.strictEqual(reqs[0].await, 'OD7');
});

// --- fail-loud, not fail-open (reviewer finding #1) -------------------------
test('assessReadiness: capabilitiesUnknown ⇒ a loud disclosure + capabilities_unknown flag (never a silent clean READY)', () => {
  const a = assessReadiness({ runTarget: { command: 'npm run dev' }, capabilities: [], capabilitiesUnknown: true, envReadiness: READINESS.READY });
  assert.strictEqual(a.verdict, VERDICT.READY_TO_SMOKE, 'we disclose, we do NOT false-block (DEC-DEV-0112 doctrine)');
  assert.strictEqual(a.capabilities_unknown, true, 'the unknown-capabilities flag must ride in the result');
  assert.ok(a.disclosures.some((d) => /UNAVAILABLE/.test(d)), 'an unprobeable feature must be disclosed, never silently READY');
});

test('assessReadiness: capabilities_unknown defaults false when the probe resolved', () => {
  const a = assessReadiness({ runTarget: { command: 'npm run dev' }, capabilities: [{ disposition: 'SATISFIED' }], envReadiness: READINESS.READY });
  assert.strictEqual(a.capabilities_unknown, false);
});

// --- trim guard (reviewer finding #2) --------------------------------------
test('assessReadiness: a whitespace-only command is NOT_STARTABLE (trim parity with detectRunTarget)', () => {
  const a = assessReadiness({ runTarget: { command: '   ' }, capabilities: [], envReadiness: READINESS.READY });
  assert.strictEqual(a.verdict, VERDICT.NOT_STARTABLE, 'an effectively-empty command is no run target');
  assert.strictEqual(a.smoke_attemptable, false);
});

// --- capabilitiesFor: a genuine probe failure ≠ "feature has no caps" -------
test('capabilitiesFor: no feature ⇒ unresolved:false (intended whole-app skip); a missing feature ⇒ unresolved:true (error ≠ empty)', () => {
  assert.deepStrictEqual(capabilitiesFor('', '.'), { capabilities: [], unresolved: false, reason: null });
  const missing = capabilitiesFor('FM-999-does-not-exist', os.tmpdir());
  assert.strictEqual(missing.unresolved, true, 'a named-but-unresolvable feature must be unresolved (fail-loud)');
  assert.deepStrictEqual(missing.capabilities, []);
});

// --- CLI composition seam (the reviewer's "most important uncovered behavior") ---
// Drive the real CLI over a temp .product fixture: capability-probe disposition must flow
// end-to-end (a BLOCK manifest ⇒ BLOCKED_ON_CAPABILITY), env-presence flips it to SATISFIED,
// and an unresolvable feature surfaces capabilities_unknown rather than a silent clean READY.
test('CLI seam: a BLOCK external_capabilities manifest flows to BLOCKED_ON_CAPABILITY; env presence ⇒ READY; a missing feature ⇒ capabilities_unknown', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-seam-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
    const featDir = path.join(tmp, '.product', 'features');
    fs.mkdirSync(featDir, { recursive: true });
    const SECRET = 'STRIPE_SECRET_KEY_P7SEAM_777';   // unique → guaranteed absent unless we inject it
    fs.writeFileSync(path.join(featDir, 'FM-777-billing.md'),
      `---\nid: FM-777\nexternal_capabilities:\n  - { capability: billing, secret_env: ${SECRET}, provider: Stripe, tier: prod, dev_stand_in: }\n---\nbody\n`);

    const run = (args, extraEnv) => {
      const env = { ...process.env };
      delete env[SECRET];
      Object.assign(env, extraEnv || {});
      const out = execFileSync('node', [LIB_PATH, ...args], { env, encoding: 'utf8' });
      return JSON.parse(out);
    };

    // secret ABSENT, no dev stand-in ⇒ BLOCK ⇒ BLOCKED_ON_CAPABILITY + a §6 request, no boot plan
    const blocked = run(['--feature', 'FM-777', '--root', tmp, '--env', 'READY']);
    assert.strictEqual(blocked.verdict, VERDICT.BLOCKED_ON_CAPABILITY, 'a BLOCK manifest must flow through the CLI to BLOCKED_ON_CAPABILITY');
    assert.strictEqual(blocked.requests.length, 1, 'a §6 capability-request must be emitted');
    assert.strictEqual(blocked.plan, null, 'no boot plan when not attemptable');
    assert.strictEqual(blocked.capabilities_unknown, false, 'the manifest resolved — not unknown');

    // secret PRESENT ⇒ SATISFIED ⇒ READY_TO_SMOKE (env presence flows through the probe)
    const ready = run(['--feature', 'FM-777', '--root', tmp, '--env', 'READY'], { [SECRET]: 'sk_test_x' });
    assert.strictEqual(ready.verdict, VERDICT.READY_TO_SMOKE, 'env presence must satisfy the capability and clear the block');
    assert.ok(ready.plan && ready.plan.command, 'a satisfied + ready run produces a boot plan');

    // an unresolvable feature must NOT silently read as a clean READY — capabilities_unknown + disclosure
    const unknown = run(['--feature', 'FM-000-nope', '--root', tmp, '--env', 'READY']);
    assert.strictEqual(unknown.capabilities_unknown, true, 'an unresolvable feature must surface capabilities_unknown (fail-loud)');
    assert.ok(unknown.disclosures.some((d) => /UNAVAILABLE/.test(d)), 'the unresolved probe must be disclosed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
