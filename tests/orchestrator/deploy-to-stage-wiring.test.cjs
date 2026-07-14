'use strict';
/**
 * Static guard for the Orchestrator E.B `deploy-to-stage` process wiring (PROD readiness campaign
 * DEC-DEV-0198; design SSOTs dev/plans/PROD_READINESS_CAMPAIGN.md §3.2 + dev/gates/EPIC_E_READINESS.md
 * D-1/D-6/D-7/D-9).
 *
 * The .mjs is a harness Workflow script (agent/phase globals + top-level return) and cannot run
 * standalone, so this asserts structural invariants at the source level (same approach as
 * runtime-smoke-readiness-wiring.test.cjs). The invariants pin the load-bearing deploy contract:
 *  - the §3.2 autonomy-policy resolver is called BEFORE any mutation (source-order: the resolve
 *    agent precedes the deploy-flip agent) and the process STOPs unless it returns `auto` — the
 *    campaign §3.2 acceptance (a deploy that skips the resolver bypasses the floor entirely);
 *  - the two-axis contract result × readiness, with ENV_NOT_READY ⇒ BLOCKED (never DEPLOY_FAILED),
 *    decided before the build-fail branch; `flipped` gates the rollback route;
 *  - the manifest parse is EOL-tolerant (CRLF) — this process is a CNT consumer;
 *  - the deploy + healthcheck agents are capture-don't-fix;
 *  - the pre-flip re-probe reuses the P7 readiness leg (runtime-readiness.cjs) — NOT a second live
 *    boot (D-7) — and the healthcheck reuses the P7 failure taxonomy (no reinvented healthcheck);
 *  - MDP: the real mutation + diagnosis stages are opus, the relays are sonnet.
 *  - CHARTER (B4 contract, DEC-DEV-0193/0194): the `deploying_staging` cell carries
 *    operation_class/env_tier and OMITS meta.autonomy (a stray human-gate kills L2/L3 auto AND the
 *    auto-rollback); and its PA resume-event is a SAFE owner.close, never a deploy-result event
 *    (a stray pa-scan of the deploy gate must never mark a feature shipped without a deploy).
 *
 * Node stdlib only; run with `node tests/orchestrator/deploy-to-stage-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PROC = path.join(ROOT, 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'deploy-to-stage.mjs'), 'utf8');
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

console.log('orchestrator E.B — deploy-to-stage wiring (DEC-DEV-0198)');

test('declares the meta header (name + Preflight/Gate/Deploy/Healthcheck phases) and FB-001 args guard', () => {
  assert(/export const meta\s*=/.test(SRC), 'missing export const meta');
  assert(/name:\s*'deploy-to-stage'/.test(SRC), 'process name drifted');
  for (const ph of ['Preflight', 'Gate', 'Deploy', 'Healthcheck']) {
    assert(new RegExp(`title:\\s*'${ph}'`).test(SRC), `meta.phases missing ${ph}`);
    assert(new RegExp(`phase\\('${ph}'\\)`).test(SRC), `phase('${ph}') call missing`);
  }
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
});

test('§3.2: the autonomy-policy resolver is called with deploy_staging + live --readiness (the floor/ladder seam)', () => {
  assert(/AUTONOMY_LIB\b/.test(SRC) && /autonomy-policy\.cjs/.test(SRC), 'autonomy-policy CLI seam path not wired');
  assert(/resolve --operation-class deploy_staging/.test(SRC), 'the resolver is not called with operation-class deploy_staging');
  assert(/--env-tier \$\{ENV_TIER\}/.test(SRC), 'env-tier not passed per-state to the resolver');
  assert(/--readiness \$\{readiness\}/.test(SRC),
    'the deploy disposition is not readiness-guarded — --readiness is the ONLY place applyReadinessGuard bites on the deploy path');
});

test('§3.2 ACCEPTANCE: the resolver call precedes the mutation, and STOPs on a non-auto disposition', () => {
  const resolveIdx = SRC.indexOf("label: 'autonomy-resolve'");
  const deployIdx = SRC.indexOf("label: 'deploy-flip'");
  assert(resolveIdx !== -1, 'no autonomy-resolve agent');
  assert(deployIdx !== -1, 'no deploy-flip (mutation) agent');
  assert(resolveIdx < deployIdx, 'the resolver MUST be called BEFORE the deploy/flip agent (gate precedes mutation)');
  // STOP on non-auto: a non-auto disposition returns BLOCKED with flipped:false, before the deploy agent
  assert(/disposition\.disposition !== 'auto'/.test(SRC), 'no explicit "disposition !== auto → STOP" gate');
  const gateIdx = SRC.indexOf("disposition.disposition !== 'auto'");
  assert(gateIdx !== -1 && gateIdx < deployIdx, 'the non-auto STOP must be evaluated before the deploy agent');
  const gateArm = SRC.slice(gateIdx, gateIdx + 700);
  assert(/'BLOCKED'/.test(gateArm) && /flipped: false/.test(gateArm),
    'a gated deploy must return result=BLOCKED, flipped=false (no mutation)');
});

test('two-axis contract: result × readiness + flipped/release/healthcheck/disposition/autonomy in the return', () => {
  for (const key of ['result', 'readiness', 'flipped', 'release', 'healthcheck', 'disposition', 'autonomy']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(SRC), `return contract missing key: ${key}`);
  }
  // the three result values and three readiness values are all represented
  for (const v of ['DEPLOYED', 'DEPLOY_FAILED', 'BLOCKED']) assert(SRC.includes(v), `result value ${v} missing`);
  for (const v of ['READY', 'DEGRADED', 'ENV_NOT_READY']) assert(SRC.includes(v), `readiness value ${v} missing`);
  // the payload bridge: autonomy aliases the resolver envelope (charter ingest carries payloadPath: autonomy)
  assert(/autonomy:\s*disposition/.test(SRC), 'autonomy must alias the resolver envelope (payloadPath: autonomy)');
});

test('INVARIANT in code: ENV_NOT_READY ⇒ BLOCKED (never DEPLOY_FAILED), decided BEFORE the build-fail branch', () => {
  assert(/readiness === 'ENV_NOT_READY'/.test(SRC), 'no ENV_NOT_READY invariant branch');
  const envIdx = SRC.indexOf("if (readiness === 'ENV_NOT_READY')");
  const buildFailIdx = SRC.indexOf('if (!buildPassed)');
  assert(envIdx !== -1 && buildFailIdx !== -1 && envIdx < buildFailIdx,
    'ENV_NOT_READY must be handled before the !buildPassed DEPLOY_FAILED branch (a down substrate is not a code failure)');
  const arm = SRC.slice(envIdx, envIdx + 500);
  assert(/result: 'BLOCKED'/.test(arm) && /flipped: false/.test(arm) && !/DEPLOY_FAILED/.test(arm),
    'the ENV_NOT_READY arm must be BLOCKED + flipped:false, never DEPLOY_FAILED');
  // flipped drives the rollback route: DEPLOY_FAILED+flipped=true → the charter routes auto-rollback
  assert(/const flipped = !!\(deployed && deployed\.flipped\)/.test(SRC), 'flipped is not read from the deploy agent');
});

test('manifest parse is EOL-tolerant (CRLF) — deploy-to-stage is a CNT consumer', () => {
  const segStart = SRC.indexOf("label: 'manifest-parse'");
  assert(segStart !== -1, 'no manifest-parse agent');
  const seg = SRC.slice(SRC.indexOf("const manifest = await agent"), segStart);
  assert(/normalize line endings/i.test(seg) && /CRLF/.test(seg), 'the manifest parse must instruct CRLF normalization');
  assert(/extractManifest/.test(seg), 'the established EOL-tolerant pattern (capability-probe.cjs extractManifest) is not referenced');
  assert(seg.includes('replace(/\\\\r\\\\n/g'), 'the manifest parse must carry the \\r\\n → \\n replace instruction');
  // fail-loud, do not fabricate a step-list
  assert(/do NOT fabricate/i.test(seg) || /FAIL LOUD/i.test(seg), 'a missing/draft manifest must fail loud, not fabricate a step-list');
});

test('deploy + healthcheck agents are capture-don\'t-fix (surface a failure, do not remediate)', () => {
  const deploySeg = SRC.slice(SRC.indexOf('const deployed = await agent'), SRC.indexOf("label: 'deploy-flip'"));
  assert(/CAPTURE-DON'T-FIX/i.test(deploySeg), 'the deploy agent must be capture-don\'t-fix');
  assert(/do NOT retry-hack, edit code, or commit/i.test(deploySeg), 'the deploy agent must not remediate/commit');
  const hcSeg = SRC.slice(SRC.indexOf('const healthcheck = await agent'), SRC.indexOf("label: 'healthcheck'"));
  assert(/capture-don't-fix/i.test(hcSeg), 'the healthcheck agent must be capture-don\'t-fix');
  assert(/Do NOT remediate/i.test(hcSeg), 'the healthcheck agent must not remediate');
});

test('reuses the P7 readiness leg (no duplicate live boot, D-7) + the P7 failure taxonomy (no reinvented healthcheck)', () => {
  assert(/runtime-readiness\.cjs/.test(SRC) && /RUNTIME_PROBE\b/.test(SRC), 'the P7 runtime-readiness lib is not wired');
  const preSeg = SRC.slice(SRC.indexOf('const preflight = await agent'), SRC.indexOf("label: 'runtime-readiness'"));
  assert(/NOT a live boot/i.test(preSeg), 'the pre-flip re-probe must be the readiness leg, NOT a second live boot (D-7)');
  // the healthcheck maps failures onto the P7 5-class taxonomy — reuse, do not reinvent
  assert(/smokePlan\.failure_classes/.test(SRC), 'the healthcheck does not reuse runtime-readiness.cjs smokePlan.failure_classes');
  for (const cls of ['env-not-loaded', 'missing-migration', 'port-in-use', 'missing-runtime-secret', 'dependency-not-up']) {
    assert(SRC.includes(cls), `P7 failure class ${cls} not referenced in the healthcheck diagnosis`);
  }
});

// ---- LIVE-RUN DEFECTS (first live P7 run on the pilot, FM-006 / 2026-07-14) ----------------------

// Compose the REAL pre-flip re-probe command from the source template (not a string-presence check:
// a dropped flag or a broken interpolation fails here exactly as it would live), and pin the
// backward-compat invariant: no app ⇒ byte-for-byte the pre-fix command.
function composeProbeCmd(vars) {
  const m = SRC.match(/\\`node \$\{RUNTIME_PROBE\}([\s\S]*?)\\` via Bash/);
  assert(m, 'could not locate the runtime-readiness re-probe command template');
  const names = Object.keys(vars);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, 'return `node ${RUNTIME_PROBE}' + m[1] + '`');
  return fn(...names.map((n) => vars[n]));
}

test('D1: the --app monorepo pin reaches the pre-flip re-probe; absent ⇒ the command is byte-for-byte the old one', () => {
  assert(/const APP = A\.app \|\| ''/.test(SRC), 'the process does not read the app arg (A.app)');
  const base = { RUNTIME_PROBE: 'L.cjs', FEATURE: 'FM-006', APP: '', readiness: 'DEGRADED', P7_VERDICT: 'READY_TO_SMOKE', P6_VERDICT: 'GO' };
  const unpinned = composeProbeCmd(base);
  assert(unpinned === 'node L.cjs --feature FM-006 --root . --env DEGRADED --p6 READY_TO_SMOKE',
    `BACKWARD-COMPAT: an absent app must leave the re-probe command unchanged — got: ${unpinned}`);
  const pinned = composeProbeCmd({ ...base, APP: 'apps/api' });
  assert(pinned === 'node L.cjs --feature FM-006 --root . --app apps/api --env DEGRADED --p6 READY_TO_SMOKE',
    `--app must reach the re-probe (else sourceRank auto-picks a frontend leg over the backend) — got: ${pinned}`);
});

test('D2: EVERY return arm carries readiness_reasons — the §3.2 deploy gate must be auditable from run.json alone', () => {
  assert(/const readinessReasons = \[\.\.\.\(\(envProbe && envProbe\.reasons\) \|\| \[\]\)\]/.test(SRC),
    'the env-probe reasons are not captured (a readiness axis without its WHY makes the gate unauditable)');
  // the two LOCAL downgrades (manifest not deployable / pre-flip verdict) are not the env probe's —
  // they must record their own reason, or an ENV_NOT_READY BLOCK reads as an unexplained refusal.
  const manifestArm = SRC.slice(SRC.indexOf('if (!manifestOk)'), SRC.indexOf('if (!manifestOk)') + 500);
  assert(/readinessReasons\.push/.test(manifestArm), 'a manifest-driven ENV_NOT_READY must record its reason');
  const preArm = SRC.slice(SRC.indexOf("const preVerdict"), SRC.indexOf('const disclosures'));
  assert(/readinessReasons\.push/.test(preArm), 'a pre-flip-verdict-driven ENV_NOT_READY must record its reason');
  // and every result-bearing return exposes it (a future arm that forgets is caught here)
  const returns = (SRC.match(/return \{[\s\S]*?\n\s*\}/g) || []).filter((r) => /result/.test(r));
  assert(returns.length >= 5, `expected all 5 result-bearing returns (BLOCKED×2, DEPLOY_FAILED×2, final); found ${returns.length}`);
  for (const r of returns) {
    const label = (r.match(/result:?\s*'?([A-Z_]*)'?/) || [])[1] || '(final)';
    assert(/readiness_reasons:\s*readinessReasons/.test(r), `return arm ${label} drops readiness_reasons`);
  }
});

test('MDP: the real mutation + diagnosis stages are opus; the relays are sonnet', () => {
  const line = (label) => SRC.split('\n').find((l) => l.includes(`label: '${label}'`)) || '';
  assert(/model: 'opus'/.test(line('deploy-flip')), 'the deploy/flip mutation must be opus (high-R)');
  assert(/model: 'opus'/.test(line('healthcheck')), 'the healthcheck diagnosis must be opus');
  assert(/model: 'sonnet'/.test(line('autonomy-resolve')), 'the resolver JSON relay should be sonnet (mechanical transport)');
  assert(/model: 'sonnet'/.test(line('env-readiness')), 'the env-readiness relay should be sonnet');
});

// ---- CHARTER B4 contract + the resume-event-safety deviation ------------------------------------

test('charter B4: deploying_staging carries operation_class + env_tier:"staging" and OMITS meta.autonomy', () => {
  const ds = CHARTER.states.deploying_staging;
  assert(ds && ds.invoke && ds.invoke.process === 'deploy-to-stage', 'deploying_staging must invoke deploy-to-stage');
  assert(ds.meta.operation_class === 'deploy_staging', 'deploying_staging.meta.operation_class must be deploy_staging');
  assert(ds.meta.env_tier === 'staging', 'deploying_staging.meta.env_tier must be staging (per-state, not global)');
  assert(ds.meta.risk === 'HIGH', 'deploying_staging.meta.risk must be HIGH');
  assert(!Object.prototype.hasOwnProperty.call(ds.meta, 'autonomy'),
    'B4 TRAP: meta.autonomy MUST be OMITTED on deploying_staging — a stray human-gate floors L2/L3 auto AND the auto-rollback');
});

test('charter B4: rolling_back is operation_class "rollback" (NOT destructive), staging, autonomy omitted', () => {
  const rb = CHARTER.states.rolling_back;
  assert(rb && rb.invoke && rb.invoke.process === 'rollback-release', 'rolling_back must invoke rollback-release');
  assert(rb.meta.operation_class === 'rollback',
    'rolling_back.meta.operation_class MUST be "rollback" (NOT "destructive" — that is on the floor and would kill staging auto-rollback)');
  assert(rb.meta.env_tier === 'staging', 'rolling_back.meta.env_tier must be staging');
  assert(!Object.prototype.hasOwnProperty.call(rb.meta, 'autonomy'), 'meta.autonomy MUST be omitted on rolling_back');
});

test('DEPLOY GATE SAFETY (deviation): a stray pa-scan of the deploy gate fires a SAFE close, never a deploy-result event', () => {
  // deploying_staging is the FIRST invoke-state that resolves to human-gate at the L1 default, so the
  // engine auto-appends a PA whose resume-event is deriveResumeEvent()'s keys[0] fallback. If that were
  // evt:deploy.succeeded, an owner flipping the PA + `pa-scan --tick` would mark the feature shipped
  // WITHOUT a deploy (pa-scan bypasses the DEF-3 guard). The charter orders owner.close first so the
  // fallback is a safe close. The owner APPROVES a deploy by re-invoking with --autonomy, not a PA flip.
  const resume = engine.deriveResumeEvent(CHARTER, 'deploying_staging');
  assert(!/^evt:deploy\./.test(resume),
    `deploying_staging resume-event must NOT be a deploy-result event (a stray pa-scan would false-ship); got ${resume}`);
  assert(resume === 'evt:owner.close',
    `deploying_staging resume-event must be the safe owner.close fallback; got ${resume}`);
  // and owner.close on the deploy gate exits to a terminal without-runtime (feature can close w/o deploy)
  assert(CHARTER.states.deploying_staging.on['evt:owner.close'].target === 'closed_without_runtime',
    'evt:owner.close on deploying_staging must target closed_without_runtime');
});

test('charter ingest: deploy-to-stage maps result×readiness×flipped to the right events (order-significant)', () => {
  const eq = (result, expected) => {
    const got = engine.applyIngest(CHARTER, 'deploy-to-stage', result);
    assert(JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(result)} → expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  };
  // ENV_NOT_READY is checked before BLOCKED (env-down routes to retry, not the gate)
  eq({ readiness: 'ENV_NOT_READY', result: 'BLOCKED' }, ['evt:deploy.env_not_ready']);
  eq({ result: 'BLOCKED', readiness: 'READY' }, ['evt:deploy.gated']);
  // DEPLOYED is checked before the flipped rule (a success is also flipped:true)
  eq({ result: 'DEPLOYED', flipped: true, readiness: 'READY' }, ['evt:deploy.succeeded']);
  eq({ result: 'DEPLOY_FAILED', flipped: true, readiness: 'READY' }, ['evt:deploy.failed']);
  eq({ result: 'DEPLOY_FAILED', flipped: false, readiness: 'READY' }, ['evt:deploy.preflight_failed']);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
