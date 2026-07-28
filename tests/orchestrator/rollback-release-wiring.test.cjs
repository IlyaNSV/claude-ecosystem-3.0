'use strict';
/**
 * Static guard for the Orchestrator E.C `rollback-release` process wiring (PROD readiness campaign
 * DEC-DEV-0198; design SSOTs dev/_archive/campaign-prod/PROD_READINESS_CAMPAIGN.md §3.2 + §8.2 pt 3 +
 * dev/gates/EPIC_E_READINESS.md D-4).
 *
 * The .mjs is a harness Workflow script; this asserts structural invariants at the source level:
 *  - the §3.2 autonomy-policy resolver is called with operation_class `rollback` (NOT `destructive`
 *    — that is on the floor and would silently disable staging auto-rollback) BEFORE the swap;
 *  - the process STOPs unless the resolver returns `auto`;
 *  - the two-axis contract result × readiness, with NO_PRIOR_RELEASE a DISTINCT edge (not a failure);
 *  - the swap reads the manifest EOL-tolerantly (CRLF); swap + verify are capture-don't-fix;
 *  - the verify healthcheck reuses the P7 failure taxonomy;
 *  - MDP: the swap + verify are opus, the relays are sonnet;
 *  - CHARTER: rolling_back is the auto-rollback invoke cell; rolled_back is the post-rollback owner
 *    gate (owner.resume → implementing | owner.close), resume-event unchanged (evt:owner.resume).
 *
 * Node stdlib only; run with `node tests/orchestrator/rollback-release-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PROC = path.join(ROOT, 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'rollback-release.mjs'), 'utf8');
const CHARTER = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'orchestrator', 'charters', 'feature-production-line.json'), 'utf8'));
const engine = require(path.join(ROOT, 'orchestrator', 'lib', 'fabric-engine.cjs'));

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

console.log('orchestrator E.C — rollback-release wiring (DEC-DEV-0198)');

test('declares the meta header (name + Gate/Rollback/Verify phases) and FB-001 args guard', () => {
  assert(/export const meta\s*=/.test(SRC), 'missing export const meta');
  assert(/name:\s*'rollback-release'/.test(SRC), 'process name drifted');
  for (const ph of ['Gate', 'Rollback', 'Verify']) {
    assert(new RegExp(`title:\\s*'${ph}'`).test(SRC), `meta.phases missing ${ph}`);
    assert(new RegExp(`phase\\('${ph}'\\)`).test(SRC), `phase('${ph}') call missing`);
  }
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
});

test('§3.2: resolver called with operation_class "rollback" (NOT "destructive") + live --readiness', () => {
  assert(/AUTONOMY_LIB\b/.test(SRC) && /autonomy-policy\.cjs/.test(SRC), 'autonomy-policy CLI seam not wired');
  assert(/resolve --operation-class rollback\b/.test(SRC), 'the resolver is not called with operation-class rollback');
  assert(!/--operation-class destructive/.test(SRC),
    'rollback MUST NOT use operation_class "destructive" (floor class → would human-gate + silently disable staging auto-rollback)');
  assert(/NOT 'destructive'/.test(SRC) || /NOT .destructive/.test(SRC), 'the rollback≠destructive rationale must be documented in code');
  assert(/--readiness \$\{readiness\}/.test(SRC), 'the rollback disposition is not readiness-guarded');
});

test('§3.2 ACCEPTANCE: the resolver precedes the swap, and STOPs on a non-auto disposition', () => {
  const resolveIdx = SRC.indexOf("label: 'autonomy-resolve'");
  const swapIdx = SRC.indexOf("label: 'rollback-swap'");
  assert(resolveIdx !== -1, 'no autonomy-resolve agent');
  assert(swapIdx !== -1, 'no rollback-swap (mutation) agent');
  assert(resolveIdx < swapIdx, 'the resolver MUST be called BEFORE the swap agent (gate precedes mutation)');
  assert(/disposition\.disposition !== 'auto'/.test(SRC), 'no explicit "disposition !== auto → STOP" gate');
  const gateIdx = SRC.indexOf("disposition.disposition !== 'auto'");
  assert(gateIdx < swapIdx, 'the non-auto STOP must be evaluated before the swap agent');
});

test('two-axis contract: result × readiness + restored_release/healthcheck/disposition/autonomy', () => {
  for (const key of ['result', 'readiness', 'restored_release', 'healthcheck', 'disposition', 'autonomy']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(SRC), `return contract missing key: ${key}`);
  }
  for (const v of ['ROLLED_BACK', 'ROLLBACK_FAILED', 'NO_PRIOR_RELEASE', 'BLOCKED']) assert(SRC.includes(v), `result value ${v} missing`);
  for (const v of ['READY', 'DEGRADED', 'ENV_NOT_READY']) assert(SRC.includes(v), `readiness value ${v} missing`);
  assert(/autonomy:\s*disposition/.test(SRC), 'autonomy must alias the resolver envelope');
});

test('NO_PRIOR_RELEASE is a DISTINCT edge (the bad release stays, owner decides — not a swap failure)', () => {
  assert(/no_prior/.test(SRC), 'the no_prior edge is not read from the swap agent');
  const idx = SRC.indexOf('swap.no_prior');
  assert(idx !== -1, 'no swap.no_prior branch');
  const arm = SRC.slice(idx, idx + 400);
  assert(/'NO_PRIOR_RELEASE'/.test(arm), 'the no_prior branch must return result=NO_PRIOR_RELEASE');
  // the swap agent must be told NOT to fabricate or delete a release on the no-prior edge
  assert(/do NOT delete it, do NOT fabricate a release/i.test(SRC), 'the no-prior edge must not delete/fabricate');
});

test('swap reads the manifest EOL-tolerantly (CRLF); swap + verify are capture-don\'t-fix', () => {
  const swapSeg = SRC.slice(SRC.indexOf('const swap = await agent'), SRC.indexOf("label: 'rollback-swap'"));
  assert(/normalize line endings/i.test(swapSeg) && /CRLF/.test(swapSeg), 'the swap must CRLF-normalize the manifest read');
  assert(swapSeg.includes('replace(/\\\\r\\\\n/g'), 'the swap must carry the \\r\\n → \\n replace instruction');
  assert(/CAPTURE-DON'T-FIX/i.test(swapSeg), 'the swap agent must be capture-don\'t-fix');
  const verifySeg = SRC.slice(SRC.indexOf('const healthcheck = await agent'), SRC.indexOf("label: 'verify-health'"));
  assert(/capture-don't-fix/i.test(verifySeg), 'the verify agent must be capture-don\'t-fix');
  assert(/Do NOT remediate/i.test(verifySeg), 'the verify agent must not remediate');
});

test('verify healthcheck reuses the P7 failure taxonomy (no reinvented healthcheck)', () => {
  assert(/smokePlan\.failure_classes/.test(SRC), 'the verify does not reuse runtime-readiness.cjs smokePlan.failure_classes');
  for (const cls of ['env-not-loaded', 'missing-migration', 'port-in-use', 'missing-runtime-secret', 'dependency-not-up']) {
    assert(SRC.includes(cls), `P7 failure class ${cls} not referenced in the verify diagnosis`);
  }
});

test('MDP: the swap + verify mutation/diagnosis are opus; the relays are sonnet', () => {
  const line = (label) => SRC.split('\n').find((l) => l.includes(`label: '${label}'`)) || '';
  assert(/model: 'opus'/.test(line('rollback-swap')), 'the swap mutation must be opus (high-R)');
  assert(/model: 'opus'/.test(line('verify-health')), 'the verify diagnosis must be opus');
  assert(/model: 'sonnet'/.test(line('autonomy-resolve')), 'the resolver relay should be sonnet');
  assert(/model: 'sonnet'/.test(line('env-readiness')), 'the env-readiness relay should be sonnet');
});

// ---- CHARTER: the rollback cells --------------------------------------------------------------

test('charter: rolling_back is the auto-rollback invoke cell; rolled_back is the post-rollback owner gate', () => {
  const rb = CHARTER.states.rolling_back;
  assert(rb && rb.invoke && rb.invoke.process === 'rollback-release', 'rolling_back must invoke rollback-release');
  const done = CHARTER.states.rolled_back;
  assert(done && done.meta && done.meta.autonomy === 'human-gate', 'rolled_back must be a human-gate owner surface');
  assert(done.on['evt:owner.resume'] && done.on['evt:owner.resume'].target === 'implementing',
    'rolled_back must let the owner re-drive (owner.resume → implementing)');
  assert(done.on['evt:owner.close'] && done.on['evt:owner.close'].target === 'closed_without_runtime',
    'rolled_back must let the owner close without runtime');
  // the resume-event (pa-scan) is the standard owner.resume — safe (re-drive), unchanged pattern
  assert(engine.deriveResumeEvent(CHARTER, 'rolled_back') === 'evt:owner.resume',
    'rolled_back resume-event must be evt:owner.resume');
});

test('charter ingest: rollback-release maps ROLLED_BACK/NO_PRIOR/failed correctly', () => {
  const eq = (result, expected) => {
    const got = engine.applyIngest(CHARTER, 'rollback-release', result);
    assert(JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(result)} → expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  };
  eq({ result: 'ROLLED_BACK', readiness: 'READY' }, ['evt:rollback.done']);
  eq({ result: 'NO_PRIOR_RELEASE', readiness: 'READY' }, ['evt:rollback.no_prior']);
  eq({ result: 'ROLLBACK_FAILED', readiness: 'READY' }, ['evt:rollback.failed']);
  eq({ result: 'BLOCKED', readiness: 'DEGRADED' }, ['evt:rollback.failed']);   // owner-rail block → escalate via default
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
