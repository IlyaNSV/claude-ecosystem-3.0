'use strict';
/**
 * autonomy-policy.test.cjs — units for the F1 skeleton resolver (Epic F / F1,
 * DEC-DEV-0145 decision «и»; contract: dev/AUTONOMY_POLICY_F1_CONTRACT.md).
 *
 * The resolver is pure — every case is a same-inputs→same-disposition table row.
 * The consumed-not-re-derived rail is asserted structurally: risk_tier/readiness
 * values are the OUTPUT enums of gate-risk-classifier.cjs / env-readiness.cjs.
 */

const assert = require('assert');
const path = require('path');

const lib = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'autonomy-policy.cjs'));
const { resolve, resolveLevel, applyReadinessGuard, DEFAULT_FLOOR, BUILT_IN_DEFAULT_LEVEL } = lib;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}
function ok(cond, msg) { assert.ok(cond, msg); passed += 1; }
function eq(a, b, msg) { assert.strictEqual(a, b, msg); passed += 1; }

console.log('autonomy-policy (F1 skeleton) — Epic F resolver units');

// ---- floor: non-crossable ----------------------------------------------------------------------

test('every default floor class → human-gate regardless of level/override', () => {
  for (const cls of DEFAULT_FLOOR) {
    for (const override of [undefined, 'L0', 'L1', 'L3']) {
      const r = resolve(cls, 'LOW', 'dev', { default_level: 'L1' }, override);
      eq(r.disposition, 'human-gate', `${cls} @ override=${override}`);
      eq(r.floor_hit, true, `${cls} floor_hit`);
    }
  }
});

test('floor is LOCKED: a policy.floor shrinking the default is ignored, loudly', () => {
  const r = resolve('prod_deploy', 'LOW', 'dev', { floor: [] }, 'L3');
  eq(r.disposition, 'human-gate', 'shrunken floor must not unlock prod_deploy');
  eq(r.floor_hit, true);
  ok(r.why.some((w) => /LOCKED/.test(w)), 'why[] names the locked floor');
});

test('non-floor operation class is ordinary', () => {
  const r = resolve('write_spec_artifact', 'LOW', 'dev', {}, undefined);
  eq(r.floor_hit, false);
  eq(r.disposition, 'auto');
});

// ---- precedence chain --------------------------------------------------------------------------

test('built-in default is L1', () => {
  eq(BUILT_IN_DEFAULT_LEVEL, 'L1');
  const lv = resolveLevel({}, undefined, undefined);
  eq(lv.level, 'L1');
});

test('policy.default_level overrides the built-in; override overrides the policy', () => {
  eq(resolveLevel({ default_level: 'L0' }, undefined, undefined).level, 'L0');
  eq(resolveLevel({ default_level: 'L0' }, 'L1', undefined).level, 'L1');
});

test('process pin is a CEILING: caps a higher level, never raises a lower one', () => {
  const pins = { process_overrides: { 'deploy-to-stage': 'L0' } };
  const capped = resolveLevel(Object.assign({ default_level: 'L1' }, pins), 'L1', 'deploy-to-stage');
  eq(capped.level, 'L0', 'pin caps L1 → L0');
  const notRaised = resolveLevel(Object.assign({ default_level: 'L0' }, pins), undefined, 'deploy-to-stage');
  eq(notRaised.level, 'L0', 'a pin never promotes');
  const otherProcess = resolveLevel(Object.assign({ default_level: 'L1' }, pins), undefined, 'another');
  eq(otherProcess.level, 'L1', 'pin applies only to its process');
});

test('L2/L3 degrade to L1 semantics with a loud why (F2 not built — never blind auto)', () => {
  for (const req of ['L2', 'L3']) {
    const lv = resolveLevel({ default_level: req }, undefined, undefined);
    eq(lv.level, 'L1', `${req} degrades to L1`);
    ok(lv.why.some((w) => /F2/.test(w)), `${req} why names F2`);
  }
});

test('invalid level inputs are ignored loudly, never throw', () => {
  const lv = resolveLevel({ default_level: 'turbo' }, 'max', undefined);
  eq(lv.level, 'L1');
  ok(lv.why.filter((w) => /ignored/.test(w)).length >= 2, 'both invalids noted');
});

// ---- disposition matrix (L0/L1) -----------------------------------------------------------------

test('L1 × dev → auto (LOW and HIGH — irreversibility is carried by the floor)', () => {
  eq(resolve('op', 'LOW', 'dev', { default_level: 'L1' }, undefined).disposition, 'auto');
  eq(resolve('op', 'HIGH', 'dev', { default_level: 'L1' }, undefined).disposition, 'auto');
});

test('L0 × dev → auto only on LOW', () => {
  eq(resolve('op', 'LOW', 'dev', { default_level: 'L0' }, undefined).disposition, 'auto');
  eq(resolve('op', 'HIGH', 'dev', { default_level: 'L0' }, undefined).disposition, 'human-gate');
});

test('staging/prod → human-gate at both levels (no consilium below F2)', () => {
  for (const env of ['staging', 'prod']) {
    for (const level of ['L0', 'L1']) {
      eq(resolve('op', 'LOW', env, { default_level: level }, undefined).disposition, 'human-gate', `${level} × ${env}`);
    }
  }
});

test('consumed-not-re-derived: absent/foreign risk_tier → conservatively HIGH', () => {
  const r = resolve('op', 'medium', 'dev', { default_level: 'L0' }, undefined);
  eq(r.disposition, 'human-gate', 'unknown tier treated as HIGH under L0');
  ok(r.why.some((w) => /gate-risk-classifier/.test(w)), 'why names the expected producer');
});

test('absent/foreign env_tier → conservatively prod', () => {
  const r = resolve('op', 'LOW', 'production', { default_level: 'L1' }, undefined);
  eq(r.disposition, 'human-gate');
  ok(r.why.some((w) => /conservatively prod/.test(w)));
});

test('determinism: same inputs → deep-equal envelope', () => {
  const a = resolve('op', 'HIGH', 'dev', { default_level: 'L1', process: 'x' }, 'L0');
  const b = resolve('op', 'HIGH', 'dev', { default_level: 'L1', process: 'x' }, 'L0');
  assert.deepStrictEqual(a, b); passed += 1;
});

test('F1 never emits consilium-gate', () => {
  const combos = [];
  for (const cls of ['op', 'prod_deploy']) for (const tier of ['HIGH', 'LOW']) for (const env of ['dev', 'staging', 'prod']) for (const lvl of ['L0', 'L1', 'L2', 'L3']) combos.push(resolve(cls, tier, env, { default_level: lvl }, undefined));
  ok(combos.every((r) => r.disposition !== 'consilium-gate'), 'no consilium-gate in F1');
});

// ---- readiness guard (consumes env-readiness.cjs verdicts) --------------------------------------

test('READY leaves the disposition unchanged', () => {
  const base = resolve('op', 'LOW', 'dev', {}, undefined);
  eq(applyReadinessGuard(base, 'READY').disposition, 'auto');
});

test('DEGRADED downgrades auto → human-gate, never upgrades', () => {
  const auto = resolve('op', 'LOW', 'dev', {}, undefined);
  eq(applyReadinessGuard(auto, 'DEGRADED').disposition, 'human-gate');
  const human = resolve('op', 'LOW', 'staging', {}, undefined);
  eq(applyReadinessGuard(human, 'DEGRADED').disposition, 'human-gate', 'human-gate unchanged');
});

test('ENV_NOT_READY → block (the gate cannot judge)', () => {
  const auto = resolve('op', 'LOW', 'dev', {}, undefined);
  eq(applyReadinessGuard(auto, 'ENV_NOT_READY').disposition, 'block');
});

test('unknown readiness treated as DEGRADED, loudly', () => {
  const auto = resolve('op', 'LOW', 'dev', {}, undefined);
  const r = applyReadinessGuard(auto, 'MAYBE');
  eq(r.disposition, 'human-gate');
  ok(r.why.some((w) => /env-readiness/.test(w)), 'why names the expected producer');
});

console.log(`\n${passed} assertions passed.`);
