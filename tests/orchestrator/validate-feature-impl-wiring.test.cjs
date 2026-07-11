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

test('refuted findings dropped; present/already-resolved/refuted bucketed (DEC-DEV-0093)', () => {
  assert(/disposition === 'present'/.test(SRC), 'findings not bucketed by the present disposition');
  assert(/disposition === 'already-resolved'/.test(SRC), 'already-resolved bucket missing');
  assert(/refuted/i.test(SRC) && /drop/i.test(SRC), 'no refuted/drop semantics documented');
});

test('order-aware verify: pre-gate baseline sha + 3-way disposition (FB-LR-03/13, DEC-DEV-0093)', () => {
  assert(/git rev-parse HEAD/.test(SRC), 'no baseline sha capture (git rev-parse HEAD)');
  assert(/BASELINE\b/.test(SRC), 'BASELINE not threaded into verifyFinding');
  assert(/already-resolved/.test(SRC), 'already-resolved disposition missing — a fixed REAL finding would be mislabelled a hallucination');
  assert(/let remaining = present/.test(SRC), 'remediation not seeded from PRESENT findings');
  // baseline must be captured BEFORE verify is defined/used
  const baseIdx = SRC.indexOf('git rev-parse HEAD');
  const verifyIdx = SRC.indexOf('const verifyFinding');
  assert(baseIdx !== -1 && verifyIdx !== -1 && baseIdx < verifyIdx, 'baseline must be captured before verify');
  // the post-fix recheck must key on disposition, not the old confirmed flag
  assert(/recheck\.disposition === 'present'/.test(SRC), 'post-fix recheck not order-aware (still keyed on confirmed)');
});

test('FB-028: validator `kind` constrained to a DEFECT enum + polarity-gated verify (DEC-DEV-0094)', () => {
  // a positive confirmation must be UNREPRESENTABLE as a finding (kind is a defect enum)
  assert(/DEFECT_KINDS\s*=/.test(SRC), 'no DEFECT_KINDS enum');
  assert(/kind:\s*\{\s*type:\s*'string',\s*enum:\s*DEFECT_KINDS\s*\}/.test(SRC), 'VALIDATOR_SCHEMA.kind not constrained to the defect enum');
  assert(/'uncovered-requirement'/.test(SRC) && /'other-defect'/.test(SRC), 'defect-kind enum incomplete');
  // verify must refuse a positive (non-defect) assertion before classifying disposition
  assert(/POLARITY GATE/.test(SRC), 'verifyFinding lacks the FB-028 polarity gate');
  assert(/FB-028/.test(SRC), 'FB-028 rationale not referenced');
});

test('remediation is bounded', () => {
  assert(/MAX_REMEDIATION_ROUNDS/.test(SRC), 'no bounded remediation rounds');
  assert(/round < MAX_REMEDIATION_ROUNDS/.test(SRC), 'remediation loop not bounded by the cap');
});

test('T5: remediation discretion — block_class + conflict_detail + unilateral self-check (DEC-DEV-0096)', () => {
  assert(/REMEDIATE_SCHEMA[\s\S]*block_class/.test(SRC), 'REMEDIATE_SCHEMA does not carry block_class');
  assert(/conflict_detail/.test(SRC), 'no conflict_detail field for an escalated contradiction');
  assert(/unilateral/.test(SRC), 'no unilateral self-check field (FB-LR-07 anti-mask)');
  assert(/REMEDIATION_GUARD\b/.test(SRC) && /remediation-guard\.cjs/.test(SRC), 'remediation-guard backbone not wired');
  // the remediation prompt must run the guard for the block-classify + the fix-note self-check
  assert(/--reason/.test(SRC) && /--fix-note/.test(SRC), 'remediation does not invoke the guard (--reason / --fix-note)');
});

test('T5: a cross-spec/design conflict ESCALATES, never self-resolved (FB-LR-07)', () => {
  assert(/const escalateConflict\b/.test(SRC), 'no escalateConflict helper');
  assert(/'cross-spec-conflict'/.test(SRC) && /'design-contradiction'/.test(SRC), 'escalation classes not present');
  assert(/const conflicts = \[\]/.test(SRC), 'no conflicts accumulator');
  assert(/conflicts\.push/.test(SRC), 'escalated conflicts are not tracked');
  assert(/FB-LR-07/.test(SRC), 'FB-LR-07 (no unilateral resolution) not referenced');
  // an escalated conflict must NOT be pushed back into the remediation set (no retry)
  assert(/escalateConflict\(f, fix\)\s*continue/.test(SRC), 'an escalated conflict must skip remediation (continue after escalateConflict), not retry');
});

test('T5: single-writer — sequential remediation + resolved-by-concurrent-commit guard (extends FB-004)', () => {
  // remediation must be a sequential for…of, never fanned out via parallel() (which would race the index)
  assert(/for \(const f of remaining\)/.test(SRC), 'remediation not iterated sequentially');
  assert(!/parallel\(\s*remaining\.map/.test(SRC) && !/parallel\(\s*present\.map/.test(SRC),
    'remediation must not be dispatched via parallel() — single-writer (FB-004/T5)');
  assert(/SINGLE-WRITER/.test(SRC), 'single-writer invariant not documented in code');
  assert(/resolved-by-concurrent-commit/.test(SRC), 'no concurrent-commit guard (a sibling fix must not be double-committed)');
});

test('T5: an escalated conflict degrades a would-be GO to MANUAL_VERIFY (never a clean GO)', () => {
  assert(/conflicts\.length && result === 'GO'/.test(SRC), 'a non-empty conflicts set does not degrade GO');
  const degradeIdx = SRC.indexOf("conflicts.length && result === 'GO'");
  const returnIdx = SRC.indexOf('go_gate:');
  assert(degradeIdx !== -1 && returnIdx !== -1 && degradeIdx < returnIdx, 'the GO-degrade must run before the return');
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

test('the escalation PA-write targets the canonical worktree-shared file (FB-LR-23)', () => {
  // G-1: parallel worktrees minted the same PA-027 because each scanned its own worktree-local file.
  assert(/FB-LR-23/.test(SRC), 'FB-LR-23 parallel-worktree guard not referenced');
  assert(/const PA_CANON\b/.test(SRC), 'no PA_CANON canonical-pending-actions instruction');
  assert(/git worktree list --porcelain/.test(SRC), 'PA_CANON does not resolve the canonical file via git worktree list');
  // 1 declaration + 1 use (escalateConflict) = 2 occurrences
  const uses = (SRC.match(/\bPA_CANON\b/g) || []).length;
  assert(uses >= 2, `the escalate-conflict PA-write must include PA_CANON (decl + 1 use; found ${uses})`);
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

test('FB-LR-15: a dropped validator slot is bounded re-spawned, then recorded incomplete (DEC-DEV-0101)', () => {
  assert(/MAX_VALIDATOR_RESPAWN\b/.test(SRC), 'no MAX_VALIDATOR_RESPAWN bound for the re-spawn');
  assert(/runValidatorSlot\b/.test(SRC), 'no runValidatorSlot re-spawn helper');
  assert(/incompleteValidators\b/.test(SRC), 'dropped lenses are not tracked as incompleteValidators');
  assert(/FB-LR-15/.test(SRC), 'FB-LR-15 rationale not referenced');
  // a never-run lens must degrade a would-be GO to MANUAL_VERIFY (never a silent reduced-lens GO)
  assert(/incompleteValidators\.length && result === 'GO'/.test(SRC),
    'an incomplete validator set does not degrade a clean GO');
  // re-spawn loop must be bounded by the cap
  assert(/attempt <= MAX_VALIDATOR_RESPAWN/.test(SRC), 're-spawn not bounded by MAX_VALIDATOR_RESPAWN');
});

test('FB-LR-16: a non-READY remediation discloses + marks its commits (DEC-DEV-0102)', () => {
  assert(/nonReadyRemediation\b/.test(SRC), 'no nonReadyRemediation flag computed before remediation');
  assert(/remediationReadiness\b/.test(SRC), 'no remediationReadiness pre-compute');
  assert(/READINESS DISCLOSURE/.test(SRC), 'remediation prompt lacks the FB-LR-16 readiness-disclosure clause');
  assert(/re-verify on a READY re-run/.test(SRC), 'commit-message disclosure marker missing');
  assert(/FB-LR-16/.test(SRC), 'FB-LR-16 rationale not referenced');
  // RANK/worstReadiness must be declared ONCE (pre-remediation), not redeclared in synthesis
  assert((SRC.match(/const RANK = \{ READY: 0/g) || []).length === 1,
    'RANK must be declared exactly once (pre-remediation), not duplicated in synthesis');
});

test('FB-LR-21: RA-10 surfaces a deferred/spec-sanctioned orphan, not a silent clear', () => {
  assert(/FB-LR-21/.test(SRC), 'FB-LR-21 not referenced in the RA-10 lens');
  assert(/deferred-by-design or spec-sanctioned orphan/.test(SRC),
    'RA-10 does not instruct surfacing a spec-sanctioned/deferred orphan as a finding');
});

test('returns the P6 contract keys', () => {
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  for (const key of ['feature', 'mechanical', 'readiness', 'validators', 'validators_incomplete', 'confirmed_findings', 'remediated', 'committed_under_non_ready', 'residual', 'conflicts', 'result', 'findings', 'go_gate', 'autonomy']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(m[0]), `return object missing key: ${key}`);
  }
});

test('F2 autonomy disposition wired: resolve seam relayed + carried in the return (DEC-DEV-0193)', () => {
  assert(/AUTONOMY_LIB\b/.test(SRC) && /autonomy-policy\.cjs/.test(SRC), 'autonomy-policy CLI seam path not wired');
  assert(/resolve --operation-class feature-validate/.test(SRC), 'P6 does not resolve the feature-validate disposition via the CLI seam');
  assert(/applyReadinessGuard/.test(SRC), 'the readiness-guard step is not referenced (resolve∘readiness)');
  assert(/--readiness \$\{readiness\}/.test(SRC), 'the resolved disposition is not readiness-guarded');
  // riskTier is the conservative honest rule (GO ∧ no conflict = LOW)
  assert(/RISK_TIER\s*=\s*\(result === 'GO' && conflicts\.length === 0\)/.test(SRC), 'riskTier rule not the conservative GO∧no-conflict rule');
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m && /autonomy:\s*autonomy\s*\|\|\s*null/.test(m[0]), 'return envelope does not carry the autonomy disposition');
  assert(/DEC-DEV-0193/.test(SRC), 'DEC-DEV-0193 not referenced');
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
