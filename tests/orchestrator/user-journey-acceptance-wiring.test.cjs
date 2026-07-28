'use strict';
/**
 * Static guard for the Orchestrator P8 `user-journey-acceptance` process wiring (DEC-DEV-0225).
 *
 * The .mjs is a harness Workflow script (agent/phase globals + top-level return) and cannot run
 * standalone, so this asserts structural invariants at the source level (same approach as
 * runtime-smoke-readiness-wiring.test.cjs / deploy-to-stage-wiring.test.cjs). The invariants pin the
 * preflight→(gate|run)→report FSM a live run would exercise, AND the charter contract that slots P8
 * between the staging deploy and `done`:
 *  - uja-report.cjs is the DETERMINISTIC backbone (the verdict is relayed, not eyeballed — the whole
 *    point of the lib: a green gate on a broken first-user-touch is the "false DEPLOYED" class);
 *  - preflight is a Definition-of-Readiness gate (Playwright equipped? journeys present? staging 2xx?)
 *    and a missing piece is an honest ENV_NOT_READY with a DoR hint, NEVER a fabricated pass;
 *  - the run agent is capture-don't-fix and carries the real-vendor BUDGET GUARD (minimal fixtures);
 *  - the zero-evidence rule is respected (a 0-journey report is ENV_NOT_READY, never a PASS);
 *  - PA-writes target the canonical worktree-shared file (PA_CANON / FB-LR-23);
 *  - MDP: every stage is a mechanical transport ⇒ sonnet (there is NO LLM-graded step in v0);
 *  - CHARTER v6: `journey_acceptance` sits BETWEEN deploying_staging and done; a P8 PASS → done,
 *    FAIL → awaiting_journey_fix (owner-queued), ENV_NOT_READY → runtime_gate_retry; and the deploy
 *    cell's success now routes to journey_acceptance, not straight to done.
 *  - DEPLOY-GATE-SAFETY analogue: journey_acceptance's derived resume-event is a SAFE owner.close,
 *    never a journey-result event (a stray pa-scan of the gate must never mark a feature done without
 *    an actual journey run).
 *
 * Node stdlib only; run with `node tests/orchestrator/user-journey-acceptance-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PROC = path.join(ROOT, 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'user-journey-acceptance.mjs'), 'utf8');
const CHARTER = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'orchestrator', 'charters', 'feature-production-line.json'), 'utf8'));
const engine = require(path.join(ROOT, 'orchestrator', 'lib', 'fabric-engine.cjs'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('orchestrator P8 — user-journey-acceptance wiring (DEC-DEV-0225)');

test('declares the meta header (name + Preflight/Run/Report phases) and FB-001 args guard', () => {
  assert(/export const meta\s*=/.test(SRC), 'missing export const meta');
  assert(/name:\s*'user-journey-acceptance'/.test(SRC), 'process name drifted');
  for (const ph of ['Preflight', 'Run', 'Report']) {
    assert(new RegExp(`title:\\s*'${ph}'`).test(SRC), `meta.phases missing ${ph}`);
    assert(new RegExp(`phase\\('${ph}'\\)`).test(SRC), `phase('${ph}') call missing`);
  }
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
});

test('uja-report.cjs is the DETERMINISTIC backbone (verdict + preflight relayed, not eyeballed)', () => {
  assert(/const UJA_LIB\b/.test(SRC) && /uja-report\.cjs/.test(SRC), 'uja-report lib not wired');
  assert(/DEC-DEV-0225/.test(SRC), 'DEC-DEV-0225 not referenced');
  // preflight relay + parse relay both go through the lib
  assert(/node \$\{UJA_LIB\} preflight/.test(SRC), 'the preflight is not read through the deterministic lib');
  assert(/node \$\{UJA_LIB\} parse --report/.test(SRC), 'the verdict is not read through the deterministic lib parse');
  const runSeg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/TRANSPORT/i.test(runSeg) && /do NOT judge/i.test(runSeg),
    'the run agent must be a TRANSPORT — it must NOT judge PASS/FAIL itself (the lib decides)');
});

test('preflight is a DoR gate: Playwright equipped? journeys present? staging 2xx? — probed before the run', () => {
  const preIdx = SRC.indexOf("label: 'uja-preflight'");
  const hcIdx = SRC.indexOf("label: 'staging-healthcheck'");
  const runIdx = SRC.indexOf("label: 'run-journeys'");
  assert(preIdx !== -1, 'no uja-preflight probe');
  assert(hcIdx !== -1, 'no staging healthcheck probe');
  assert(runIdx !== -1, 'no run-journeys agent');
  assert(preIdx < runIdx && hcIdx < runIdx, 'the DoR probes must run BEFORE the journey run');
  // the deterministic gate reads all three signals
  assert(/const playwrightPresent\b/.test(SRC) && /const journeysPresent\b/.test(SRC) && /const stagingTwoxx\b/.test(SRC),
    'the gate must read playwright_present + journeys_present + the staging 2xx signals');
  assert(/if \(!playwrightPresent \|\| !journeysPresent \|\| !STAGING_URL \|\| !stagingTwoxx\)/.test(SRC),
    'any missing DoR piece must short-circuit to ENV_NOT_READY');
});

test('an ENV_NOT_READY DoR gap is DISCLOSED with hints (integrator:add playwright / author journeys / staging up), never a fake pass', () => {
  assert(/const recordDoRGap\b/.test(SRC), 'no recordDoRGap helper');
  const seg = SRC.slice(SRC.indexOf('const recordDoRGap'), SRC.indexOf('const recordDoRGap') + 1400);
  assert(/integrator:add playwright/i.test(seg), 'the DoR hint must name /integrator:add playwright');
  assert(/author journeys/i.test(seg), 'the DoR hint must name authoring journeys (from NM)');
  assert(/do NOT invent journeys or fake a pass/i.test(seg), 'a DoR gap must never be faked into a pass');
  assert(/PA_CANON/.test(seg), 'the DoR-gap PA write must resolve the canonical pending-actions (PA_CANON)');
});

test('the healthcheck + preflight probes are READ-ONLY (a down staging / missing tool is EVIDENCE, not fixed here)', () => {
  const preSeg = SRC.slice(SRC.indexOf('const preflight = await agent'), SRC.indexOf("label: 'uja-preflight'"));
  assert(/READ-ONLY/.test(preSeg) && /never REPAIR/i.test(preSeg) && /do NOT install Playwright/i.test(preSeg),
    'the preflight relay must MEASURE, never install/scaffold to improve the verdict');
  const hcSeg = SRC.slice(SRC.indexOf('const stagingUp = STAGING_URL'), SRC.indexOf("label: 'staging-healthcheck'"));
  assert(/READ-ONLY/.test(hcSeg) && /docker start/.test(hcSeg) && /EVIDENCE/.test(hcSeg),
    'the staging healthcheck must not start/repair services to coax a 2xx (a down staging is EVIDENCE for ENV_NOT_READY)');
});

test('the run agent is capture-don\'t-fix, uses the JSON reporter, and carries the real-vendor BUDGET GUARD', () => {
  const seg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/CAPTURE-DON'T-FIX/i.test(seg), 'the run agent must be capture-don\'t-fix');
  assert(/do NOT patch the app, retry until green/i.test(seg), 'the run agent must not remediate/retry-to-green');
  assert(/playwright test/.test(seg) && /--reporter=json/.test(seg), 'the run must use `npx playwright test --reporter=json`');
  assert(/even when tests fail/i.test(seg), 'the report must be captured even on a non-zero playwright exit (a FAIL still writes a report)');
  assert(/BUDGET GUARD/.test(seg) && /MINIMAL fixtures/i.test(seg),
    'the run must carry the real-vendor budget guard — journeys MUST use minimal fixtures (real jobs = real spend)');
  assert(/HEADLESS/i.test(seg), 'the journeys must run headless');
});

test('the zero-evidence rule + FAIL disclosure ride in the report phase (a 0-journey run is recorded, not silently passed)', () => {
  assert(/if \(ujaResult === 'ENV_NOT_READY'\)/.test(SRC), 'a lib-returned ENV_NOT_READY (empty report) must be recorded as a DoR gap too');
  // the FAIL disclosure names the P7-green-but-404 class this gate exists to catch
  assert(/first-user-touch|404/i.test(SRC), 'a FAIL disclosure must name the first-user-touch / P7-green-but-404 class');
});

test('PA-writes target the canonical worktree-shared file (FB-LR-23)', () => {
  assert(/FB-LR-23/.test(SRC), 'FB-LR-23 parallel-worktree guard not referenced');
  assert(/const PA_CANON\b/.test(SRC), 'no PA_CANON canonical-pending-actions instruction');
  assert(/git worktree list --porcelain/.test(SRC), 'PA_CANON does not resolve the canonical file via git worktree list');
});

test('the return envelope carries the two-leg contract (uja_result + counts + failed[] + artifacts_dir + disclosures)', () => {
  const returns = (SRC.match(/return \{[\s\S]*?\n\}/g) || []).filter((r) => /uja_result/.test(r));
  assert(returns.length >= 2, `expected the ENV_NOT_READY early return + the final return; found ${returns.length}`);
  for (const r of returns) {
    for (const key of ['feature', 'staging_url', 'uja_result', 'journeys_total', 'journeys_passed', 'journeys_failed', 'artifacts_dir', 'readiness_reasons', 'disclosures']) {
      assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(r), `a uja_result return arm drops key: ${key}`);
    }
  }
  // all three verdict values are represented in the source
  for (const v of ['PASS', 'FAIL', 'ENV_NOT_READY']) assert(SRC.includes(v), `uja_result value ${v} missing`);
});

test('MDP: every stage is a mechanical transport ⇒ sonnet (no LLM-graded step in v0)', () => {
  for (const label of ['uja-preflight', 'staging-healthcheck', 'run-journeys', 'dor-gap']) {
    const line = SRC.split('\n').find((l) => l.includes(`label: '${label}'`)) || '';
    assert(/model: 'sonnet'/.test(line), `stage ${label} must be sonnet (mechanical transport — the verdict is a deterministic lib reduction, not judgment); got: ${line.trim()}`);
  }
});

// ---- CHARTER v6 contract: P8 slots between the deploy and done ----------------------------------

test('charter v6: journey_acceptance invokes user-journey-acceptance, is auto, sits after the deploy cell', () => {
  assert(CHARTER.version === 6, `charter must be v6 (P8), got ${CHARTER.version}`);
  const ja = CHARTER.states.journey_acceptance;
  assert(ja && ja.invoke && ja.invoke.process === 'user-journey-acceptance', 'journey_acceptance must invoke user-journey-acceptance');
  assert(ja.meta.autonomy === 'auto', 'journey_acceptance is a read-mostly staging gate ⇒ auto (mirrors runtime_gate)');
  // the deploy cell now routes its success into journey_acceptance, not straight to done
  assert(CHARTER.states.deploying_staging.on['evt:deploy.succeeded'].target === 'journey_acceptance',
    'a DEPLOYED staging deploy must route to journey_acceptance (the new leg), NOT straight to done');
});

test('charter v6: journey outcomes route PASS→done, FAIL→awaiting_journey_fix (owner-queued), ENV_NOT_READY→retry', () => {
  const ja = CHARTER.states.journey_acceptance;
  assert(ja.on['evt:journey.passed'].target === 'done', 'a PASS ships → done');
  assert(ja.on['evt:journey.failed'].target === 'awaiting_journey_fix', 'a FAIL parks at awaiting_journey_fix');
  assert(Array.isArray(ja.on['evt:journey.failed'].actions) && ja.on['evt:journey.failed'].actions.includes('queue_owner'),
    'a FAIL must queue the owner');
  assert(ja.on['evt:journey.env_not_ready'].target === 'runtime_gate_retry', 'an ENV_NOT_READY routes to the env-up retry gate');
  // the ingest maps the process return to those events (order-significant, keyed on uja_result)
  const eq = (result, expected) => {
    const got = engine.applyIngest(CHARTER, 'user-journey-acceptance', result);
    assert(JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(result)} → expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  };
  eq({ uja_result: 'PASS' }, ['evt:journey.passed']);
  eq({ uja_result: 'FAIL' }, ['evt:journey.failed']);
  eq({ uja_result: 'ENV_NOT_READY' }, ['evt:journey.env_not_ready']);
});

test('charter v6: awaiting_journey_fix is a human gate with an owner.resume→implementing re-drive + owner.close exit', () => {
  const g = CHARTER.states.awaiting_journey_fix;
  assert(g && g.meta.autonomy === 'human-gate', 'awaiting_journey_fix must be a human gate');
  assert(g.on['evt:owner.resume'].target === 'implementing', 'the owner resume re-drives the fix through implementing');
  assert(g.on['evt:owner.close'].target === 'closed_without_runtime', 'a parked line must always have an owner.close exit');
  assert(engine.deriveResumeEvent(CHARTER, 'awaiting_journey_fix') === 'evt:owner.resume', 'the gate resume-event is owner.resume');
});

test('DEPLOY-GATE-SAFETY analogue: journey_acceptance resume-event is a SAFE owner.close, never a journey-result event', () => {
  // journey_acceptance is auto at L1, but an L0 override could human-gate it; the engine would then
  // auto-append a PA whose resume-event is deriveResumeEvent()'s keys[0] fallback. If that were
  // evt:journey.passed, an owner flipping the PA + `pa-scan --tick` would mark the feature DONE
  // WITHOUT a journey run (pa-scan bypasses the DEF-3 guard). The charter orders owner.close first so
  // the fallback is a safe close — the same fix as deploying_staging (DEC-DEV-0198).
  const resume = engine.deriveResumeEvent(CHARTER, 'journey_acceptance');
  assert(!/^evt:journey\./.test(resume),
    `journey_acceptance resume-event must NOT be a journey-result event (a stray pa-scan would false-ship); got ${resume}`);
  assert(resume === 'evt:owner.close', `journey_acceptance resume-event must be the safe owner.close fallback; got ${resume}`);
  assert(CHARTER.states.journey_acceptance.on['evt:owner.close'].target === 'closed_without_runtime',
    'evt:owner.close on journey_acceptance must target closed_without_runtime');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
