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
  detectRunTarget, detectWorkspaceRunTargets, bootBlockingCaps, deferredCaps, buildRequests,
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

// === DEF-4: workspace / monorepo run targets (DEC-DEV-0168) ===================

// (a) pure detectWorkspaceRunTargets — sort / priority / skip packages with no target
test('detectWorkspaceRunTargets: sorts by source priority then dir; skips packages with no bootable target', () => {
  const wss = [
    { dir: 'apps/zeta', manifest: { scripts: { dev: 'vite' } } },
    { dir: 'apps/alpha', manifest: { scripts: { dev: 'vite' } } },
    { dir: 'apps/lib', manifest: { scripts: { build: 'tsc' } } },   // no boot target ⇒ skipped
    { dir: 'apps/api', manifest: { dev_command: 'make run' } },      // higher-priority source
  ];
  const cands = detectWorkspaceRunTargets(wss);
  assert.strictEqual(cands.length, 3, 'the no-target package is dropped');
  // dev_command outranks scripts.dev regardless of dir order
  assert.deepStrictEqual(cands[0], { command: 'make run', source: 'workspace:apps/api#dev_command', cwd: 'apps/api' });
  // equal source rank (scripts.dev) ⇒ lexicographic by dir
  assert.strictEqual(cands[1].cwd, 'apps/alpha');
  assert.strictEqual(cands[2].cwd, 'apps/zeta');
  assert.strictEqual(cands[1].source, 'workspace:apps/alpha#scripts.dev');
  assert.strictEqual(cands[1].command, 'npm run dev');
});

// (b) assessReadiness origin='workspace' ⇒ disclosure
test('assessReadiness: runTargetOrigin=workspace discloses the monorepo-sourced target', () => {
  const a = assessReadiness({
    runTarget: { command: 'npm run dev', source: 'workspace:apps/web#scripts.dev', cwd: 'apps/web' },
    runTargetOrigin: 'workspace',
    capabilities: [],
    envReadiness: READINESS.READY,
  });
  assert.strictEqual(a.verdict, VERDICT.READY_TO_SMOKE);
  assert.ok(a.disclosures.some((d) => /workspace "apps\/web"/.test(d)), 'the workspace origin must be disclosed');
});

// (c) >1 candidate ⇒ disclosure listing all + --app hint
test('assessReadiness: >1 run-target candidate discloses all candidates + suggests --app', () => {
  const cands = [
    { command: 'npm run dev', source: 'workspace:apps/api#scripts.dev', cwd: 'apps/api' },
    { command: 'npm run dev', source: 'workspace:apps/web#scripts.dev', cwd: 'apps/web' },
  ];
  const a = assessReadiness({
    runTarget: cands[0],
    runTargetOrigin: 'workspace',
    runTargetCandidates: cands,
    capabilities: [],
    envReadiness: READINESS.READY,
  });
  assert.deepStrictEqual(a.run_target_candidates, cands);
  assert.ok(
    a.disclosures.some((d) => /--app/.test(d) && /apps\/api/.test(d) && /apps\/web/.test(d)),
    'all candidates + the --app pin hint must be disclosed',
  );
});

// (d) no workspace inputs ⇒ no new disclosures, run_target_candidates=[] (bit-for-bit regression)
test('assessReadiness: no workspace inputs ⇒ run_target_candidates=[] and no new disclosures (regression)', () => {
  const a = assessReadiness({ runTarget: { command: 'npm run dev' }, capabilities: [], envReadiness: READINESS.READY, p6Verdict: 'GO' });
  assert.deepStrictEqual(a.run_target_candidates, [], 'defaults to an empty candidate list');
  assert.strictEqual(a.disclosures.length, 0, 'a root-origin single-target clean run adds no workspace disclosures');
});

// (e) CLI: pnpm-workspace scan finds apps/web ⇒ READY_TO_SMOKE, run_target.cwd === 'apps/web'
test('CLI: pnpm-workspace scan of a root with no dev scripts finds apps/web ⇒ READY_TO_SMOKE with cwd', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-ws-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root', scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    const web = path.join(tmp, 'apps', 'web');
    fs.mkdirSync(web, { recursive: true });
    fs.writeFileSync(path.join(web, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
    const out = JSON.parse(execFileSync('node', [LIB_PATH, '--root', tmp, '--env', 'READY'], { encoding: 'utf8' }));
    assert.strictEqual(out.verdict, VERDICT.READY_TO_SMOKE, 'a workspace-sourced target must clear the false NOT_STARTABLE');
    assert.strictEqual(out.run_target.cwd, 'apps/web');
    assert.strictEqual(out.run_target.command, 'npm run dev');
    assert.ok(out.plan && out.plan.cwd === 'apps/web', 'the boot plan carries the workspace cwd');
    assert.ok(out.disclosures.some((d) => /workspace/.test(d)), 'the workspace origin is disclosed');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// (f) two apps with dev scripts ⇒ deterministic lexicographic pick + 2 candidates
test('CLI: two workspace apps with dev scripts ⇒ deterministic lexicographic pick + run_target_candidates.length===2', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-ws2-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root' }));
    fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    for (const name of ['web', 'api']) {
      const d = path.join(tmp, 'apps', name);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ scripts: { dev: `${name}-dev` } }));
    }
    const out = JSON.parse(execFileSync('node', [LIB_PATH, '--root', tmp, '--env', 'READY'], { encoding: 'utf8' }));
    assert.strictEqual(out.verdict, VERDICT.READY_TO_SMOKE);
    assert.strictEqual(out.run_target.cwd, 'apps/api', 'the lexicographically-first app wins deterministically');
    assert.strictEqual(out.run_target_candidates.length, 2);
    assert.ok(out.disclosures.some((d) => /--app/.test(d)), 'ambiguity across >1 candidate is disclosed with --app');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// (g) --app pins a specific workspace package (overriding the auto-pick)
test('CLI: --app pins a specific workspace package over the auto-selected one', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-app-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root' }));
    fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
    for (const name of ['web', 'api']) {
      const d = path.join(tmp, 'apps', name);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ scripts: { dev: `${name}-dev` } }));
    }
    // auto-pick would be apps/api (lexicographic); --app apps/web must override it
    const out = JSON.parse(execFileSync('node', [LIB_PATH, '--root', tmp, '--app', 'apps/web', '--env', 'READY'], { encoding: 'utf8' }));
    assert.strictEqual(out.verdict, VERDICT.READY_TO_SMOKE);
    assert.strictEqual(out.run_target.cwd, 'apps/web');
    assert.strictEqual(out.run_target.command, 'npm run dev');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// (h) monorepo with no workspace manifests and no root scripts ⇒ NOT_STARTABLE (DEF-4 neighbor unbroken)
test('CLI: a repo with no workspace manifests and no root run target ⇒ NOT_STARTABLE (DEF-4 neighbor case unbroken)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-none-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root', scripts: { test: 'jest' } }));
    const out = JSON.parse(execFileSync('node', [LIB_PATH, '--root', tmp, '--env', 'READY'], { encoding: 'utf8' }));
    assert.strictEqual(out.verdict, VERDICT.NOT_STARTABLE, 'no run target anywhere is still NOT_STARTABLE');
    assert.strictEqual(out.plan, null);
    assert.deepStrictEqual(out.run_target_candidates, []);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// (i) npm-form root package.json workspaces:['packages/*'] is scanned too
test('CLI: npm-form root workspaces:[packages/*] is scanned as well as pnpm', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-npm-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['packages/*'] }));
    const d = path.join(tmp, 'packages', 'server');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ scripts: { start: 'node index.js' } }));
    const out = JSON.parse(execFileSync('node', [LIB_PATH, '--root', tmp, '--env', 'READY'], { encoding: 'utf8' }));
    assert.strictEqual(out.verdict, VERDICT.READY_TO_SMOKE);
    assert.strictEqual(out.run_target.cwd, 'packages/server');
    assert.strictEqual(out.run_target.command, 'npm run start');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
