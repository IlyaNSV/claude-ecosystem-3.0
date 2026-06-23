'use strict';
/**
 * Static guard for the Orchestrator P6 `validate-feature-impl` process wiring (+ the P5→P6
 * delegation point).
 *
 * The .mjs is a harness Workflow script (agent/phase/parallel/workflow globals + top-level
 * return) and cannot run standalone, so this asserts P6's structural invariants at the source
 * level (same approach as audit-fidelity-wiring.test.cjs / concerns-propagation.test.cjs):
 *  - a mechanical layer runs the FULL suite + build (not "tasks all [x]");
 *  - three parallel validators with distinct lenses (RA-8/9/10), inlined per D.1;
 *  - requirements-coverage reuses the coverage-oracle as its anti-self-report backbone;
 *  - verify-finding-before-act: a finding is confirmed against ground truth before remediation;
 *  - remediation is bounded; refuted findings are dropped;
 *  - GO is synthesized deterministically (mechanical green AND no residual AND not degraded);
 *  - forwarded deferred-capability CONCERNS are disclosed (FB-013);
 *  - FB-001/FB-002 arg guards are kept;
 *  - it returns the contract keys the run.md doc + P5 hand-off rely on;
 *  - P5 (feature-to-tdd-impl) delegates its feature gate to P6 via workflow(), with a fallback.
 *
 * Node stdlib only; run with `node tests/orchestrator/validate-feature-impl-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const PROC = path.join(__dirname, '..', '..', 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'validate-feature-impl.mjs'), 'utf8');
const P5 = fs.readFileSync(path.join(PROC, 'feature-to-tdd-impl.mjs'), 'utf8');

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

console.log('orchestrator P6 — validate-feature-impl wiring');

test('mechanical layer runs the FULL suite + build (not "tasks all [x]")', () => {
  assert(/phase\('Mechanical'\)/.test(SRC), 'no Mechanical phase');
  assert(/MECH_SCHEMA/.test(SRC) && /passed/.test(SRC), 'mechanical schema/passed missing');
  assert(/suite|build/i.test(SRC), 'mechanical layer does not mention suite/build');
});

test('defines THREE inline validators with distinct lenses (RA-8/9/10, per D.1)', () => {
  assert(/REQUIREMENTS_COVERAGE\s*=/.test(SRC), 'requirements-coverage (RA-8) role missing');
  assert(/DESIGN_ALIGNMENT\s*=/.test(SRC), 'design-alignment (RA-9) role missing');
  assert(/INTEGRATION_BOUNDARY\s*=/.test(SRC), 'integration-boundary (RA-10) role missing');
  assert(/RA-8/.test(SRC) && /RA-9/.test(SRC) && /RA-10/.test(SRC), 'RA-8/9/10 ids not referenced');
});

test('validators run in parallel()', () => {
  assert(/VALIDATORS\b/.test(SRC), 'no VALIDATORS list');
  assert(/parallel\(VALIDATORS\.map/.test(SRC), 'validators not dispatched via parallel()');
});

test('requirements-coverage reuses the coverage-oracle (anti-self-report backbone)', () => {
  assert(/coverage-oracle\.cjs/.test(SRC), 'process does not reference coverage-oracle.cjs');
  assert(/ORACLE\b/.test(SRC), 'no ORACLE arg for the oracle path');
});

test('verify-finding-before-act: confirms a finding against ground truth before remediating', () => {
  assert(/verifyFinding\b/.test(SRC), 'no verifyFinding helper');
  assert(/confirmed/.test(SRC) && /VERIFY_SCHEMA/.test(SRC), 'verify schema/confirmed flag missing');
  // remediation must be keyed on a CONFIRMED finding, and verifyFinding called before remediate
  assert(/CONFIRMED/.test(SRC), 'remediation not gated on a confirmed finding');
  const verifyIdx = SRC.indexOf('verifyFinding');
  const remediateIdx = SRC.indexOf('remediate:');
  assert(verifyIdx !== -1 && remediateIdx !== -1 && verifyIdx < remediateIdx,
    'verify-finding must be defined/used before remediation');
});

test('refuted findings are dropped (not remediated)', () => {
  assert(/v && v\.confirmed/.test(SRC) || /v\.confirmed \?/.test(SRC), 'confirmed findings not filtered from refuted');
  assert(/refuted/i.test(SRC) || /drop/i.test(SRC), 'no refuted/drop semantics documented');
});

test('remediation is bounded', () => {
  assert(/MAX_REMEDIATION_ROUNDS/.test(SRC), 'no bounded remediation rounds');
  assert(/round < MAX_REMEDIATION_ROUNDS/.test(SRC), 'remediation loop not bounded by the cap');
});

test('integration-boundary lens covers cross-task seams (orphan export FB-010, /reset)', () => {
  assert(/FB-010/.test(SRC), 'FB-010 orphan-export not referenced');
  assert(/orphan|call-site|seam/i.test(SRC), 'no cross-task seam language in RA-10 lens');
});

test('GO synthesized deterministically (mechanical green AND no residual AND not degraded)', () => {
  assert(/DEGRADED/.test(SRC), 'no degraded/advisory handling');
  assert(/mechPassed/.test(SRC), 'GO not gated on mechanical pass');
  assert(/'GO'/.test(SRC) && /'NO-GO'/.test(SRC) && /MANUAL_VERIFY_REQUIRED/.test(SRC),
    'three-way verdict not present');
});

test('two-axis readiness contract: MECH_SCHEMA carries readiness + ENV_PROBE wired (DEC-DEV-0092)', () => {
  assert(/MECH_SCHEMA[\s\S]*readiness/.test(SRC), 'MECH_SCHEMA does not declare a readiness field');
  assert(/ENV_PROBE\b/.test(SRC) && /env-readiness\.cjs/.test(SRC), 'env-readiness probe path not wired');
  assert(/'READY'[\s\S]*'DEGRADED'[\s\S]*'ENV_NOT_READY'/.test(SRC), 'readiness enum not present');
});

test('mechanical layer runs the env-readiness probe BEFORE the suite + classifies failures', () => {
  // the probe must run first (so a down substrate is known up front) and failures get
  // classified against the substrate-error allowlist (the run-B false-NO-GO root cause).
  assert(/PROBE FIRST/i.test(SRC) || /probe[\s\S]{0,80}before/i.test(SRC), 'probe is not run before the suite');
  const probeIdx = SRC.indexOf('node ${ENV_PROBE}');
  const suiteIdx = SRC.indexOf('validation suite');
  assert(probeIdx !== -1 && suiteIdx !== -1 && probeIdx < suiteIdx, 'probe instruction must precede the suite instruction');
  assert(/--failures/.test(SRC) && /all_substrate/.test(SRC), 'suite failures are not classified via the allowlist');
});

test('INVARIANT in code: ENV_NOT_READY ⇒ MANUAL_VERIFY, decided BEFORE the !mechPassed NO-GO branch', () => {
  assert(/readiness === 'ENV_NOT_READY'/.test(SRC), 'no ENV_NOT_READY branch in the synthesis');
  const envIdx = SRC.indexOf("readiness === 'ENV_NOT_READY'");
  const noGoIdx = SRC.indexOf("!mechPassed");
  assert(envIdx !== -1 && noGoIdx !== -1 && envIdx < noGoIdx,
    'ENV_NOT_READY must be handled before !mechPassed, else a down substrate falls through to NO-GO (the run-B false-NO-GO)');
  // and the ENV_NOT_READY arm must resolve to MANUAL_VERIFY, never NO-GO
  const arm = SRC.slice(envIdx, envIdx + 200);
  assert(/MANUAL_VERIFY_REQUIRED/.test(arm) && !/'NO-GO'/.test(arm), 'ENV_NOT_READY must map to MANUAL_VERIFY_REQUIRED, not NO-GO');
});

test('discloses forwarded deferred-capability CONCERNS (FB-013)', () => {
  assert(/CONCERNS\b/.test(SRC), 'no CONCERNS arg');
  assert(/FB-013/.test(SRC), 'FB-013 disclosure not referenced');
});

test('keeps FB-001 (stringified args) + FB-002 (empty target) guards', () => {
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
  assert(/!FEATURE/.test(SRC) && /FB-002/.test(SRC), 'FB-002 empty-feature guard missing');
});

test('returns the P6 contract keys', () => {
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  for (const key of ['feature', 'mechanical', 'readiness', 'validators', 'confirmed_findings', 'remediated', 'residual', 'result', 'findings', 'go_gate']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(m[0]), `return object missing key: ${key}`);
  }
});

test('P5 delegates its feature-level gate to P6 via workflow(), with a fallback', () => {
  assert(/workflow\(\s*\{\s*scriptPath:\s*['"][^'"]*validate-feature-impl\.mjs['"]/.test(P5),
    'P5 must delegate to P6 by scriptPath (orchestrator processes are not registered named-workflows; DEC-DEV-0091 — by-name workflow() silently fell back to advisory every run)');
  assert(/catch\b/.test(P5) && /kiro-validate-impl/.test(P5), 'P5 lacks the inline kiro-validate-impl fallback');
  assert(/concerns/.test(P5), 'P5 does not forward concerns to P6 (FB-013)');
});

test('P5 forwards the readiness axis to P6 + carries it in its return (DEC-DEV-0092)', () => {
  assert(/env-readiness\.cjs/.test(P5), 'P5 does not wire the shared env-readiness probe');
  assert(/envReadiness\b/.test(P5), 'P5 has no pre-flight readiness value');
  assert(/readiness:\s*fwdReadiness/.test(P5), 'P5 does not forward the readiness hint into the P6 workflow() call');
  assert(/go_gate:[^\n]*\n\s*readiness\s*:/.test(P5), 'P5 return object does not carry readiness alongside go_gate');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
