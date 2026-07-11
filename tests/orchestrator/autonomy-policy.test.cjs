'use strict';
/**
 * autonomy-policy.test.cjs — units for the Epic F resolver (F1 + F2, DEC-DEV-0145 / DEC-DEV-0193;
 * contract: dev/AUTONOMY_POLICY_F1_CONTRACT.md).
 *
 * The resolver is pure — every case is a same-inputs→same-disposition table row.
 * The consumed-not-re-derived rail is asserted structurally: risk_tier/readiness
 * values are the OUTPUT enums of gate-risk-classifier.cjs / env-readiness.cjs.
 *
 * F2 (DEC-DEV-0193) adds: L2/L3 no longer degrade (they emit consilium-gate on staging/prod);
 * confidenceFromSynth + applyConsiliumVerdict fold an Epic D jury verdict back to a disposition;
 * parseAutonomyConfig/loadAutonomyPolicy read the product.yaml `autonomy:` block; a CLI seam.
 * The two F1 tests that asserted L2/L3 degradation are flipped here (the only sanctioned change).
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'autonomy-policy.cjs');
const lib = require(LIB_PATH);
const {
  resolve, resolveLevel, applyReadinessGuard, DEFAULT_FLOOR, BUILT_IN_DEFAULT_LEVEL,
  confidenceFromSynth, applyConsiliumVerdict, parseAutonomyConfig, loadAutonomyPolicy, DISPOSITIONS,
} = lib;

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

test('F2 (DEC-DEV-0193): resolveLevel PRESERVES L2/L3 — no degradation to L1', () => {
  // regression flip: F1 degraded L2/L3 → L1; F2 builds them, so resolveLevel returns them verbatim.
  for (const req of ['L2', 'L3']) {
    const lv = resolveLevel({ default_level: req }, undefined, undefined);
    eq(lv.level, req, `${req} is preserved (not degraded)`);
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

test('F2: consilium-gate is emitted ONLY on L2/L3 × staging/prod × non-floor (never L0/L1/dev/floor)', () => {
  for (const tier of ['HIGH', 'LOW']) {
    for (const env of ['dev', 'staging', 'prod']) {
      for (const lvl of ['L0', 'L1', 'L2', 'L3']) {
        // non-floor operation
        const r = resolve('op', tier, env, { default_level: lvl }, undefined);
        const shouldConsilium = (lvl === 'L2' || lvl === 'L3') && env !== 'dev';
        eq(r.disposition === 'consilium-gate', shouldConsilium, `op ${lvl}×${env}×${tier}`);
        // floor operation NEVER consilium-gate, always human-gate + floor_hit
        const f = resolve('prod_deploy', tier, env, { default_level: lvl }, undefined);
        eq(f.disposition, 'human-gate', `floor ${lvl}×${env} human-gate`);
        eq(f.floor_hit, true, `floor ${lvl}×${env} floor_hit`);
      }
    }
  }
});

test('F2: L2 matrix — dev → auto (bit-identical to L1 on dev); staging/prod → consilium-gate', () => {
  for (const tier of ['HIGH', 'LOW']) {
    eq(resolve('op', tier, 'dev', { default_level: 'L2' }, undefined).disposition, 'auto', `L2 dev ${tier}`);
    eq(resolve('op', tier, 'dev', { default_level: 'L1' }, undefined).disposition, 'auto', `L1 dev ${tier} (parity)`);
    for (const env of ['staging', 'prod']) {
      eq(resolve('op', tier, env, { default_level: 'L2' }, undefined).disposition, 'consilium-gate', `L2 ${env} ${tier}`);
    }
  }
});

test('F2: L3 ≡ L2 in the matrix with a loud why-note', () => {
  eq(resolve('op', 'LOW', 'prod', { default_level: 'L3' }, undefined).disposition, 'consilium-gate');
  eq(resolve('op', 'HIGH', 'dev', { default_level: 'L3' }, undefined).disposition, 'auto');
  const r = resolve('op', 'LOW', 'staging', { default_level: 'L3' }, undefined);
  ok(r.why.some((w) => /L3 requested/.test(w) && /F3/.test(w)), 'L3 why names the F3 differentiation');
  eq(r.level_applied, 'L3', 'level_applied preserves the requested L3 for audit');
});

test('F2: DISPOSITIONS enum includes consilium-gate', () => {
  ok(Array.isArray(DISPOSITIONS) && DISPOSITIONS.indexOf('consilium-gate') !== -1, 'consilium-gate in enum');
});

// ---- confidenceFromSynth (F2) -------------------------------------------------------------------

test('confidenceFromSynth: strong→1.0, split→0.5, none→0.0, junk→0.0', () => {
  eq(confidenceFromSynth({ strength: 'strong' }), 1.0);
  eq(confidenceFromSynth({ strength: 'split' }), 0.5);
  eq(confidenceFromSynth({ strength: 'none' }), 0.0);
  eq(confidenceFromSynth({ strength: 'weird' }), 0.0);
  eq(confidenceFromSynth('not-an-object'), 0.0);
  eq(confidenceFromSynth(null), 0.0);
});

// ---- applyConsiliumVerdict (F2) -----------------------------------------------------------------

test('applyConsiliumVerdict: strong ≥ 0.8 default → auto (recommended carried)', () => {
  const r = applyConsiliumVerdict({ disposition: 'consilium-gate', why: [] }, { strength: 'strong', recommended: 'A' }, null);
  eq(r.disposition, 'auto');
  eq(r.consilium.recommended, 'A');
  eq(r.consilium.threshold, 0.8);
});

test('applyConsiliumVerdict: split (0.5) < 0.8 → human-gate (safe-fallback)', () => {
  eq(applyConsiliumVerdict({ disposition: 'consilium-gate', why: [] }, { strength: 'split', recommended: 'A' }, null).disposition, 'human-gate');
});

test('applyConsiliumVerdict: none → human-gate', () => {
  eq(applyConsiliumVerdict({ disposition: 'consilium-gate', why: [] }, { strength: 'none', recommended: null }, null).disposition, 'human-gate');
});

test('applyConsiliumVerdict: τ from gateCfg (0.4) lets split (0.5) clear → auto', () => {
  eq(applyConsiliumVerdict({ disposition: 'consilium-gate', why: [] }, { strength: 'split', recommended: 'A' }, { confidence_threshold: 0.4 }).disposition, 'auto');
});

test('applyConsiliumVerdict: recommended null → human-gate even at strong', () => {
  eq(applyConsiliumVerdict({ disposition: 'consilium-gate', why: [] }, { strength: 'strong', recommended: null }, null).disposition, 'human-gate');
});

test('applyConsiliumVerdict: a non-consilium envelope is returned UNTOUCHED', () => {
  const env = { disposition: 'auto', level_applied: 'L1', floor_hit: false, why: ['x'] };
  assert.deepStrictEqual(applyConsiliumVerdict(env, { strength: 'strong', recommended: 'A' }, null), env); passed += 1;
});

test('applyConsiliumVerdict: determinism (same inputs → deep-equal)', () => {
  const cg = { disposition: 'consilium-gate', why: [] };
  const a = applyConsiliumVerdict(cg, { strength: 'strong', recommended: 'A' }, { confidence_threshold: 0.9 });
  const b = applyConsiliumVerdict(cg, { strength: 'strong', recommended: 'A' }, { confidence_threshold: 0.9 });
  assert.deepStrictEqual(a, b); passed += 1;
});

// ---- parseAutonomyConfig (F2) -------------------------------------------------------------------

test('parseAutonomyConfig: full block (default_level + overrides + consilium_gate + profile)', () => {
  const txt = [
    'product_class: saas',
    'autonomy:',
    '  default_level: L2',
    '  consilium_gate: { confidence_threshold: 0.7, panel: architecture }',
    '  process_overrides: { deploy-to-stage: L0 }',
    'other: 1',
  ].join('\n');
  const p = parseAutonomyConfig(txt);
  eq(p.default_level, 'L2');
  eq(p.process_overrides['deploy-to-stage'], 'L0');
  eq(p.consilium_gate.confidence_threshold, 0.7);
  eq(p.consilium_gate.panel, 'architecture');
});

test('parseAutonomyConfig: block-form consilium_gate + process_overrides parse too', () => {
  const txt = 'autonomy:\n  consilium_gate:\n    confidence_threshold: 0.9\n  process_overrides:\n    deploy-to-stage: L1\n';
  const p = parseAutonomyConfig(txt);
  eq(p.consilium_gate.confidence_threshold, 0.9);
  eq(p.process_overrides['deploy-to-stage'], 'L1');
});

test('parseAutonomyConfig: profile autonomous → L3 base', () => {
  eq(parseAutonomyConfig('autonomy:\n  profile: autonomous\n').default_level, 'L3');
  eq(parseAutonomyConfig('autonomy:\n  profile: default\n').default_level, 'L1');
});

test('parseAutonomyConfig: explicit default_level overrides the profile base (loudly)', () => {
  const p = parseAutonomyConfig('autonomy:\n  profile: autonomous\n  default_level: L1\n');
  eq(p.default_level, 'L1', 'explicit L1 wins over autonomous(L3)');
  ok(p.why.some((w) => /overrides profile/.test(w)), 'the override is noted');
});

test('parseAutonomyConfig: floor is ignored LOUDLY (FLOOR_LOCKED)', () => {
  const p = parseAutonomyConfig('autonomy:\n  floor: [prod_deploy]\n');
  ok(!('floor' in p), 'floor never enters the policy object');
  ok(p.why.some((w) => /FLOOR_LOCKED/.test(w)), 'why names the locked floor');
});

test('parseAutonomyConfig: invalid levels ignored; empty/absent block → {}', () => {
  ok(!('default_level' in parseAutonomyConfig('autonomy:\n  default_level: turbo\n')), 'bad level not set');
  assert.deepStrictEqual(parseAutonomyConfig('product_class: saas\n'), {}); passed += 1;
  assert.deepStrictEqual(parseAutonomyConfig('autonomy:\n'), {}); passed += 1;
  assert.deepStrictEqual(parseAutonomyConfig(null), {}); passed += 1;
});

// ---- loadAutonomyPolicy (F2) --------------------------------------------------------------------

test('loadAutonomyPolicy: missing file → {} (absent == built-in L1, 1:1)', () => {
  assert.deepStrictEqual(loadAutonomyPolicy(path.join(os.tmpdir(), 'no-such-dir-xyz-123')), {}); passed += 1;
});

test('loadAutonomyPolicy: reads .claude/product.yaml when present', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autonomy-policy-'));
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'product.yaml'), 'autonomy:\n  default_level: L2\n');
  const p = loadAutonomyPolicy(dir);
  eq(p.default_level, 'L2');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- CLI seam (F2) ------------------------------------------------------------------------------

test('CLI resolve-consilium: inline JSON round-trips to valid JSON (exit 0)', () => {
  const out = execFileSync('node', [
    LIB_PATH, 'resolve-consilium',
    '--envelope', '{"disposition":"consilium-gate","why":[]}',
    '--synth', '{"strength":"strong","recommended":"A"}',
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(out);
  eq(parsed.disposition, 'auto');
  eq(parsed.consilium.recommended, 'A');
});

test('CLI resolve: resolve + readiness guard round-trip (exit 0)', () => {
  const out = execFileSync('node', [
    LIB_PATH, 'resolve',
    '--operation-class', 'feature-validate', '--risk', 'LOW', '--env-tier', 'dev', '--readiness', 'DEGRADED',
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(out);
  eq(parsed.disposition, 'human-gate', 'auto downgraded to human-gate by DEGRADED readiness');
});

test('CLI resolve-consilium: usage error (no envelope) → exit 2', () => {
  let code = 0;
  try { execFileSync('node', [LIB_PATH, 'resolve-consilium', '--synth', '{"strength":"none"}'], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  eq(code, 2);
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
