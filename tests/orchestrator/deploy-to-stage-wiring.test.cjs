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

// ---- FIND-B: the scene. "E.A wrote the recipe, and nobody built the kitchen." ------------------
//
// The manifest declared deploy_root / releases/<ts> / current / shared/{.env,logs,uploads} and three
// systemd unit templates. The process materialised NONE of it — it contained no `deploy_root`, no
// `homedir`, no `expand`, so `~/deploy/…` was never a directory, `shared/.env` (where `migrate` reads
// DATABASE_URL) never existed, and no unit was ever installed. The first deploy was impossible in
// principle. These pins keep the kitchen built — and, critically, keep it on the RIGHT SIDE of §3.2.

test('§3.2 ACCEPTANCE (the sharpest edge): scene-bootstrap IS a mutation, so it MUST be AFTER the gate', () => {
  const gateIdx = SRC.indexOf("disposition.disposition !== 'auto'");
  const sceneIdx = SRC.indexOf("label: 'scene-bootstrap'");
  const deployIdx = SRC.indexOf("label: 'deploy-flip'");
  assert(sceneIdx !== -1, 'no scene-bootstrap agent — the deploy scene is never built (FIND-B)');
  assert(gateIdx !== -1 && gateIdx < sceneIdx,
    'THE TRAP: scene-bootstrap creates directories, seeds a secrets file and INSTALLS SYSTEMD UNITS. '
    + 'Moving it into the preflight "because it is just setup" would put real mutation on the wrong side of the '
    + 'resolver and bypass the floor — the exact failure §3.2 exists to prevent.');
  assert(sceneIdx < deployIdx, 'the scene must be built before the step-list runs on it');
  // and it must live in the Deploy phase, not Preflight
  const sceneOpts = SRC.split('\n').find((l) => l.includes("label: 'scene-bootstrap'")) || '';
  assert(/phase: 'Deploy'/.test(sceneOpts), `scene-bootstrap must be in the Deploy phase (post-gate); got: ${sceneOpts.trim()}`);
});

test('FIND-B: the scene is bootstrapped from the LIB-RESOLVED absolute paths (the `~` nothing expanded)', () => {
  const seg = SRC.slice(SRC.indexOf('const scene = await agent'), SRC.indexOf("label: 'scene-bootstrap'"));
  assert(/manifest\.scene/.test(seg), 'the scene agent must be handed the lib-resolved scene (not left to re-expand ~ itself)');
  assert(/do NOT re-derive or re-expand/i.test(seg), 'and told not to re-derive it');
  assert(/IDEMPOTENT/i.test(seg), 'the bootstrap must be idempotent — a second deploy must not break the first');
  for (const must of ['releases', 'shared', 'mkdir -p', 'systemd', 'daemon-reload', 'enable']) {
    assert(seg.includes(must), `the scene bootstrap does not cover: ${must}`);
  }
  assert(/env_source/.test(seg) && /project-root/.test(seg),
    'shared/.env must be seeded from the project root when absent (staging v1 = dev-tier secrets, EPIC_E_READINESS A-1..A-9)');
  assert(/pnpm install --frozen-lockfile/.test(seg), 'the release must install its OWN deps (a rollback target must be independently runnable)');
  assert(/--exclude=\.\/\.git/.test(seg) && /--exclude=\.\/\.claude/.test(seg), '.git and .claude must not be copied into a release');
  assert(/DO NOT FLIP/i.test(seg) && /do not build, migrate, or restart/i.test(seg),
    'the flip (and build/migrate/restart) belong to the manifest step-list, NOT to the bootstrap — the bootstrap only makes the scene real');
});

test('FIND-B: the flip is ATOMIC (ln -sfn + mv -T), never rm && ln', () => {
  const seg = SRC.slice(SRC.indexOf('const deployed = await agent'), SRC.indexOf("label: 'deploy-flip'"));
  assert(/ln -sfn/.test(seg) && /mv -T/.test(seg),
    'the flip must be a single rename(2): `ln -sfn <release> current.tmp && mv -T current.tmp current`');
  assert(/rm current && ln/i.test(seg),
    'the prompt must explicitly FORBID `rm current && ln -s` — it leaves a window where `current` does not exist, and a service restarting in it dies');
  assert(/readlink -f current/.test(seg), 'flipped=true must be proven by resolving the symlink, not assumed');
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

// ---- FIND-A: the manifest parse is CODE, not an LLM reading a file -------------------------------
//
// It used to be a sonnet subagent, and the SAME unchanged file parsed as a full 4-step list in one
// run and as `step-list=MISSING` 18 minutes later (once returning present:true + steps:[] — a pair
// that cannot both be true). A deterministic fact about bytes, sitting behind a readiness gate, was
// being answered by a coin flip. These pins keep it in the lib.

test('FIND-A: the manifest is read through the DETERMINISTIC lib CLI seam — the agent only transports', () => {
  const segStart = SRC.indexOf("label: 'manifest-parse'");
  assert(segStart !== -1, 'no manifest-parse agent');
  const seg = SRC.slice(SRC.indexOf('const manifest = await agent'), segStart);
  assert(/MANIFEST_LIB\b/.test(SRC) && /deploy-manifest\.cjs/.test(SRC),
    'the deterministic deploy-manifest.cjs CLI seam is not wired (FIND-A: the parse must not be an LLM reading a .yaml)');
  assert(/node \$\{MANIFEST_LIB\} parse --manifest \$\{MANIFEST\}/.test(seg),
    'the manifest-parse agent must RUN the lib, not read the file itself');
  assert(/TRANSPORT, NOT A PARSER/i.test(seg), 'the agent must be told, in words, that it is a transport');
  assert(/do NOT (open|re-derive)|byte for byte/i.test(seg),
    'the agent must be forbidden from re-deriving the fields it relays');
  // and it must NOT fall back to its own reading when the lib fails — that resurrects the defect
  assert(/do NOT substitute your own reading/i.test(seg),
    'a lib failure must FAIL LOUD, never silently degrade back to an LLM parse');
  // the CRLF tolerance + the fail-loud contract now live in the LIB (tested in deploy-manifest.test.cjs)
  assert(/CRLF-tolerant/.test(seg), 'the CRLF contract must still be stated (it moved into the lib, it did not vanish)');
  assert(/FAILS LOUD rather than fabricating/i.test(seg), 'a step-list must never be fabricated');
});

test('FIND-B: a MIS-EQUIPPED capability (release-pinned units) is ENV_NOT_READY — never a silent DEPLOYED', () => {
  // The killer: a unit bolted to a concrete releases/<ts> is deaf to the flip. `current` moves, the
  // unit does not, restart revives the OLD release — and the healthcheck PASSES (old code, same port).
  // The run would report DEPLOYED having shipped nothing, and that false green is the contract_evidence
  // that flips an unverified draft CNT to `active`. A false DEPLOYED is the worst thing this can emit.
  assert(/blocking_defects/.test(SRC), 'the process does not read blocking_defects from the manifest lib');
  const idx = SRC.indexOf('if (manifestOk && blockingDefects.length)');
  assert(idx !== -1, 'no equipment-fitness branch (a present-but-unusable capability must not proceed)');
  const arm = SRC.slice(idx, idx + 1400);
  assert(/worstReadiness\(readiness, 'ENV_NOT_READY'\)/.test(arm),
    'a mis-equipped capability must downgrade readiness to ENV_NOT_READY (we could not PREPARE a correct deploy)');
  assert(/readinessReasons\.push/.test(arm), 'and it must record WHY (an unexplained block is an unauditable gate)');
  assert(/integrator:provision/.test(arm), 'and name the remedy (re-equip)');
  // the fitness branch must be evaluated BEFORE the ENV_NOT_READY return arm, or it can never bite
  const envReturnIdx = SRC.indexOf("if (readiness === 'ENV_NOT_READY')");
  assert(idx < envReturnIdx, 'the equipment-fitness check must run BEFORE the ENV_NOT_READY block arm');
  // §8.3: we refuse the equipment, we do not rewrite it
  assert(/does not (silently )?rewrite an Integrator template|Orchestrator does not rewrite Integrator templates/i.test(SRC),
    'the process must state that it refuses broken equipment rather than patching it (§8.3)');
});

test('scene + deploy + healthcheck agents are capture-don\'t-fix (surface a failure, do not remediate)', () => {
  const sceneSeg = SRC.slice(SRC.indexOf('const scene = await agent'), SRC.indexOf("label: 'scene-bootstrap'"));
  assert(/CAPTURE-DON'T-FIX/i.test(sceneSeg), 'the scene agent must be capture-don\'t-fix');
  assert(/Do NOT fabricate, template, or synthesize a \.env/i.test(sceneSeg),
    'a missing .env must be an honest ENV_NOT_READY — NEVER fabricated secrets (they fail at runtime as env-not-loaded and read like a code bug)');
  assert(/do NOT guess/i.test(sceneSeg), 'an unresolvable port must not be guessed either');
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
  assert(returns.length >= 6, `expected every result-bearing return (BLOCKED×3, DEPLOY_FAILED×3, final); found ${returns.length}`);
  for (const r of returns) {
    const label = (r.match(/result:?\s*'?([A-Z_]*)'?/) || [])[1] || '(final)';
    assert(/readiness_reasons:\s*readinessReasons/.test(r), `return arm ${label} drops readiness_reasons`);
  }
});

// ---- FIND-D: a FAILED deploy must not have a THINNER trail than a BLOCKED one -------------------
//
// The live DEPLOY_FAILED run.json carried only `result` + `readiness`. `disposition: auto` — the fact
// that the §3.2 gate had AUTHORIZED a mutation — had to be dug out of the transcript. A BLOCKED run,
// meanwhile, looked rich (the charter parks a PA carrying the resolver envelope). Exactly backwards:
// DEPLOY_FAILED is when the trail matters MOST, because a mutation may already have happened.
//
// NOTE the other half of this fix lives in run-ledger.cjs (`summarizeResult` was projecting the whole
// return down to those two scalars, so richer arms ALONE would have changed nothing that reaches
// run.json). This test guards the process side; run-ledger.test.cjs guards the ledger side.

test('FIND-D: EVERY result-bearing arm carries the SAME audit trail — a thin arm cannot ship again', () => {
  const TRAIL = [
    'flipped', 'release', 'healthcheck', 'failure_class',
    'contract_status', 'contract_evidence', 'blocking_defects',
    'scene', 'deploy', 'disposition', 'autonomy', 'disclosures',
  ];
  const returns = (SRC.match(/return \{[\s\S]*?\n\s*\}/g) || []).filter((r) => /result/.test(r));
  assert(returns.length >= 6, `expected every result-bearing return; found ${returns.length}`);
  for (const r of returns) {
    const label = (r.match(/result:\s*'?([A-Za-z_?:' ]*)/) || [])[1] || '(final)';
    for (const key of TRAIL) {
      assert(new RegExp(`(^|[\\s{,])${key}\\s*[:,]`).test(r),
        `return arm "${label.trim()}" drops \`${key}\` — a DEPLOY_FAILED with a thinner trail than a BLOCKED run is the FIND-D defect`);
    }
  }
});

test('FIND-D: failure_class is HOISTED to the top level (the one key a post-mortem greps)', () => {
  assert(/failure_class: \(healthcheck && healthcheck\.failure_class\) \|\| null/.test(SRC),
    'the final arm must hoist the P7 taxonomy class out of the nested healthcheck object');
  // …but never INVENTED where no boot happened — "reuse the taxonomy, do not reinvent it"
  const preflightArm = SRC.slice(SRC.indexOf('if (!buildPassed)'), SRC.indexOf('if (!buildPassed)') + 900);
  assert(/failure_class: null/.test(preflightArm),
    'a build failure never booted anything ⇒ no P7 class applies ⇒ null, NOT a fabricated class id');
});

// ---- DEC-DEV-0206: the test-gate MEASUREMENT/VERDICT split (run l1fi9c false negative) -----------
//
// The D-6 build/test gate returned a FALSE DEPLOY_FAILED: a 5-min Bash timeout KILLED a ~7.5-min suite,
// the retry was thrown to the background and abandoned mid-poll, and the gate reported passed:false on a
// suite that finished 100% GREEN six minutes later. A DEPLOY_FAILED burns the run to escalation — but the
// code was fine; the MEASUREMENT did not finish. "could not judge" (BLOCKED, re-run) and "code RED"
// (DEPLOY_FAILED, escalate) are as different as the 0201 axes, one layer down. These pins EVALUATE the
// real branch expression (not a string match): a regression that re-collapses UNKNOWN into DEPLOY_FAILED,
// or softens a real RED into a BLOCKED, fails here exactly as it would live.

// Pull the `buildPassed` + `suiteIncomplete` expressions out of the source and run them as the code they are.
function evalSuiteIncomplete(build) {
  const m = SRC.match(/const buildPassed = ([^\n]+)\n[\s\S]*?const suiteIncomplete = ([^\n]+)/);
  assert(m, 'could not locate the buildPassed/suiteIncomplete expressions (has the build gate been restructured?)');
  // eslint-disable-next-line no-new-func
  return new Function('build', `const buildPassed = ${m[1]}; return ${m[2]};`)(build);
}

test('0206: an INCOMPLETE measurement (suite_completed:false) is the incomplete arm — a re-run, not a RED', () => {
  assert(evalSuiteIncomplete({ passed: false, suite_completed: false }) === true,
    'passed:false + suite_completed:false IS the l1fi9c case: the gate could not JUDGE ⇒ BLOCKED (re-run), NEVER DEPLOY_FAILED');
});

test('0206: a real RED (suite_completed:true) is NOT the incomplete arm — it stays DEPLOY_FAILED', () => {
  assert(evalSuiteIncomplete({ passed: false, suite_completed: true }) === false,
    'a suite that RAN and failed is a real code RED ⇒ it must fall through to DEPLOY_FAILED, never be softened to BLOCKED');
  // BACK-COMPAT: a relay that predates the field ⇒ treated as completed ⇒ RED routes to DEPLOY_FAILED bit-for-bit
  assert(evalSuiteIncomplete({ passed: false }) === false,
    'an ABSENT suite_completed must NOT divert a RED to BLOCKED (back-compat: the pre-0206 DEPLOY_FAILED path is unchanged)');
  // a green build is a completed measurement by construction — it never enters the incomplete arm
  assert(evalSuiteIncomplete({ passed: true, suite_completed: false }) === false,
    'a green build never blocks on suite_completed (passed ⇒ the measurement finished)');
});

test('0206: the incomplete arm returns BLOCKED (re-run) BEFORE the DEPLOY_FAILED build-fail branch', () => {
  const incIdx = SRC.indexOf('if (suiteIncomplete)');
  const buildFailIdx = SRC.indexOf('if (!buildPassed)');
  const envIdx = SRC.indexOf("if (readiness === 'ENV_NOT_READY')");
  assert(incIdx !== -1, 'no suiteIncomplete branch — an UNKNOWN measurement would collapse into DEPLOY_FAILED (the l1fi9c defect)');
  assert(envIdx !== -1 && envIdx < incIdx, 'ENV_NOT_READY (a down substrate) must still be decided before the incomplete-measurement arm');
  assert(incIdx < buildFailIdx, 'the incomplete arm must be evaluated BEFORE the real-RED DEPLOY_FAILED branch, or an UNKNOWN never diverts');
  const arm = SRC.slice(incIdx, incIdx + 900);
  assert(/result: 'BLOCKED'/.test(arm) && /flipped: false/.test(arm) && !/result: 'DEPLOY_FAILED'/.test(arm),
    'the incomplete arm must RETURN result:BLOCKED + flipped:false, NEVER result:DEPLOY_FAILED (measurement-incomplete is not code-failed)');
  assert(/failure_class: 'test-gate-incomplete'/.test(arm), 'the incomplete arm must carry the gate-incident class test-gate-incomplete');
  assert(/re-run/i.test(arm), 'the incomplete arm must say, in words, that the remedy is a re-run');
  // ROUTING: a BLOCKED × READY routes to evt:deploy.gated → runtime_gate_retry (a RE-RUN), never escalate
  const got = engine.applyIngest(CHARTER, 'deploy-to-stage', { result: 'BLOCKED', readiness: 'READY', flipped: false });
  assert(JSON.stringify(got) === JSON.stringify(['evt:deploy.gated']),
    `an incomplete-measurement BLOCKED must route to evt:deploy.gated (→ runtime_gate_retry, a re-run), got ${JSON.stringify(got)}`);
  // and it must NOT route to the escalate/rollback events a real DEPLOY_FAILED does
  const redRoute = engine.applyIngest(CHARTER, 'deploy-to-stage', { result: 'DEPLOY_FAILED', readiness: 'READY', flipped: false });
  assert(JSON.stringify(redRoute) === JSON.stringify(['evt:deploy.preflight_failed']),
    `a real RED must still route to evt:deploy.preflight_failed (escalate), got ${JSON.stringify(redRoute)}`);
});

test('0206: the build-test prompt STRUCTURES the wait (per-workspace blocking calls, explicit timeouts, no background)', () => {
  const seg = SRC.slice(SRC.indexOf('const build = await agent'), SRC.indexOf("label: 'build-test'"));
  assert(seg, 'no build-test agent');
  assert(/600000/.test(seg) && /timeout/i.test(seg),
    'the build/suite calls must set an explicit Bash timeout of 600000 (the l1fi9c kill was a ~5-min default-ish timeout)');
  assert(/PER-WORKSPACE/i.test(seg) && /--filter <workspace>|per workspace/i.test(seg),
    'the suite must run per-workspace (durable against the suite outgrowing the 10-min single-call ceiling)');
  assert(/BLOCKING/i.test(seg), 'the calls must be BLOCKING (a backgrounded-then-abandoned poll is the l1fi9c failure)');
  assert(/run_in_background/i.test(seg) && /NEVER/i.test(seg),
    'the prompt must FORBID run_in_background for the build/suite');
  assert(/suite_completed:false/i.test(seg) && /UNKNOWN/i.test(seg),
    'the prompt must instruct that an unresolved measurement is suite_completed:false (an UNKNOWN, not a passed:false RED)');
  assert(/final exit code/i.test(seg),
    'the prompt must forbid a verdict before the final exit code of each workspace');
});

test('0206: BUILD_SCHEMA carries suite_completed (additive — no field renamed, DEC-DEV-0012)', () => {
  const m = SRC.match(/const BUILD_SCHEMA = \{[\s\S]*?\n\}/);
  assert(m, 'no BUILD_SCHEMA');
  assert(/suite_completed:\s*\{\s*type:\s*'boolean'\s*\}/.test(m[0]), 'BUILD_SCHEMA must declare suite_completed:boolean');
  assert(/passed:\s*\{\s*type:\s*'boolean'\s*\}/.test(m[0]), 'passed must remain unrenamed');
});

// ---- DEC-DEV-0211: the preflight SHORT-CIRCUIT + the substrate-mutation ban (run lah60w) ---------
//
// The env-readiness probe CORRECTLY returned ENV_NOT_READY (mft-redis stopped by the operator) — and
// the run did NOT stop: manifest-parse and build-test ran as if nothing happened, and the build-test
// agent, hitting the Redis-down suite (8 red api tests), SELF-HEALED the substrate ("Start redis
// container required by api test suite" → `docker start mft-redis`), waited for healthy, and prepared
// to re-run the suite green. Two defects, one disease:
//   FIND-E1 — the ENV_NOT_READY invariant arm sat AFTER manifest-parse/build-test, so a substrate the
//             gate had already judged DOWN was handed to later stages "to try anyway";
//   FIND-E2 — no stage prompt named substrate mutation as forbidden, so a stage whose success criterion
//             depends on the substrate repaired it — erasing the readiness gate one layer down (the
//             "dispatcher self-heals the substrate" precedent, now at STAGE level).
// The fix is STRUCTURE, not hope (lessons 39/47): an ENV_NOT_READY-exact early return straight after
// the probe, plus ENUMERATED forbidden command classes in every substrate-adjacent prompt.
// ⚠ THE S5 AXIS: DEGRADED must NOT short-circuit — it is the DECISION axis that rides to the §3.2
// resolver, where applyReadinessGuard downgrades auto→human-gate. These pins EVALUATE the real
// predicate (new Function), so a mutation that removes the short-circuit OR widens it to DEGRADED
// fails here exactly as it would live.

// Pull `const envProbeBlocks = <expr>` out of the source and run it as the code it is.
function evalEnvProbeBlocks(readiness) {
  const m = SRC.match(/const envProbeBlocks = ([^\n]+)/);
  assert(m, 'could not locate the envProbeBlocks expression (has the preflight short-circuit been removed?)');
  // eslint-disable-next-line no-new-func
  return new Function('readiness', `return ${m[1]};`)(readiness);
}

test('E1: an ENV_NOT_READY probe SHORT-CIRCUITS the preflight — the early return sits BEFORE manifest-parse and build-test', () => {
  const probeIdx = SRC.indexOf("label: 'env-readiness'");
  const scIdx = SRC.indexOf('if (envProbeBlocks)');
  const manifestIdx = SRC.indexOf("label: 'manifest-parse'");
  const buildIdx = SRC.indexOf("label: 'build-test'");
  assert(scIdx !== -1, 'no early short-circuit — a substrate the probe judged DOWN would be handed to build-test "to try anyway" (run lah60w)');
  assert(probeIdx !== -1 && probeIdx < scIdx, 'the short-circuit must come AFTER the env-readiness probe (it needs the verdict)');
  assert(manifestIdx !== -1 && scIdx < manifestIdx, 'the short-circuit must come BEFORE manifest-parse — no later stage runs on a dead substrate');
  assert(buildIdx !== -1 && scIdx < buildIdx, 'the short-circuit must come BEFORE build-test — the stage that self-healed the substrate on lah60w');
  const arm = SRC.slice(scIdx, scIdx + 1600);
  assert(/result: 'BLOCKED'/.test(arm) && /flipped: false/.test(arm) && !/DEPLOY_FAILED/.test(arm),
    'the early arm must be BLOCKED + flipped:false, never DEPLOY_FAILED (a down substrate is "could not prepare", not a deploy failure)');
  assert(/failure_class: 'env-not-ready-preflight'/.test(arm),
    'the early arm must carry the gate-incident class env-not-ready-preflight (NOT a fabricated P7 boot-class — nothing booted)');
  assert(/readiness_reasons: readinessReasons/.test(arm), 'the early arm must carry the probe\'s named reasons (an unexplained block is unauditable)');
  assert(/disposition: null, autonomy: null/.test(arm),
    'the §3.2 gate was never reached — disposition/autonomy must be an HONEST null, not a fabricated envelope');
  assert(/re-run|resume/i.test(arm), 'the early arm must name the remedy in words (bring the substrate up → re-run/resume)');
  // ROUTING: the same event as any ENV_NOT_READY block — substrate up → re-run, never escalate
  const got = engine.applyIngest(CHARTER, 'deploy-to-stage', { result: 'BLOCKED', readiness: 'ENV_NOT_READY', flipped: false });
  assert(JSON.stringify(got) === JSON.stringify(['evt:deploy.env_not_ready']),
    `an early-blocked run must route to evt:deploy.env_not_ready, got ${JSON.stringify(got)}`);
});

test('E1: the short-circuit predicate is ENV_NOT_READY-EXACT — DEGRADED does NOT short-circuit (the S5 axis lives)', () => {
  assert(evalEnvProbeBlocks('ENV_NOT_READY') === true,
    'an ENV_NOT_READY probe verdict must trip the short-circuit (FIND-E1: "cannot deploy AT ALL" blocks before any later stage runs)');
  assert(evalEnvProbeBlocks('DEGRADED') === false,
    'THE S5 TRAP: DEGRADED must NOT short-circuit — it is the DECISION axis that must ride to the §3.2 resolver '
    + '(applyReadinessGuard: auto→human-gate). Widening the predicate to `!== READY` deletes the whole DEGRADED deploy path');
  assert(evalEnvProbeBlocks('READY') === false, 'READY must never block');
  // …and a DEGRADED run still reaches the resolver carrying its readiness (the applyReadinessGuard seam)
  const cmd = composeResolveCmd({
    AUTONOMY_LIB: 'A.cjs', RISK: 'HIGH', ENV_TIER: 'staging', readiness: 'DEGRADED',
    contractStatus: null, ACCEPT_DRAFT: false, AUTONOMY_POLICY_CFG: null, AUTONOMY_OVERRIDE: null,
  });
  assert(/--readiness DEGRADED/.test(cmd), `a DEGRADED readiness must ride to the resolver, got: ${cmd}`);
});

test('E2: the build-test prompt BANS substrate mutation as ENUMERATED command classes — env failures are EVIDENCE', () => {
  const seg = SRC.slice(SRC.indexOf('const build = await agent'), SRC.indexOf("label: 'build-test'"));
  assert(/SUBSTRATE IS READ-ONLY/.test(seg),
    'the build-test agent has NO mandate to mutate the environment — on lah60w it ran `docker start mft-redis` to green a suite');
  assert(/docker start/.test(seg) && /systemctl start/.test(seg) && /install/i.test(seg),
    'the ban must ENUMERATE the forbidden command classes (docker start/restart, systemctl start, package installs) — text does not compel, structure does (lesson 47)');
  assert(/EVIDENCE, NOT AN OBSTACLE/.test(seg),
    'the prompt must state that environment-caused failures are EVIDENCE to record, not an obstacle to clear');
  assert(/does NOT make the measurement incomplete/.test(seg),
    'a dependency-down RED reached an exit code ⇒ it is a COMPLETED red — suite_completed (0206) must not be abused to soften it into a re-run');
});

test('E2: the read-only probes (env-readiness + runtime-readiness) carry the read-only mandate in words', () => {
  const envSeg = SRC.slice(SRC.indexOf('const envProbe = await agent'), SRC.indexOf("label: 'env-readiness'"));
  assert(/READ-ONLY/.test(envSeg) && /never REPAIR/.test(envSeg) && /docker start/.test(envSeg),
    'the env-readiness relay must be told it MEASURES the substrate and never repairs it (enumerated classes, not tone)');
  const preSeg = SRC.slice(SRC.indexOf('const preflight = await agent'), SRC.indexOf("label: 'runtime-readiness'"));
  assert(/READ-ONLY/.test(preSeg) && /docker start/.test(preSeg),
    'the runtime-readiness relay must carry the same read-only mandate (an honest NOT_STARTABLE is the job, not a defect to fix)');
});

test('E2: the LEGITIMATE mutators (scene-bootstrap + deploy-flip + healthcheck) are fenced to DEPLOY mutations only', () => {
  const sceneSeg = SRC.slice(SRC.indexOf('const scene = await agent'), SRC.indexOf("label: 'scene-bootstrap'"));
  assert(/MUTATION BOUNDARY/.test(sceneSeg) && /docker start/.test(sceneSeg),
    'scene-bootstrap mutates LEGITIMATELY (dirs, .env seed, units) — but the ban on NON-deploy mutation (docker/infra/packages) must be in words');
  const deploySeg = SRC.slice(SRC.indexOf('const deployed = await agent'), SRC.indexOf("label: 'deploy-flip'"));
  assert(/MUTATION BOUNDARY/.test(deploySeg) && /docker start/.test(deploySeg),
    'deploy-flip may only run MANIFEST STEPS — starting/repairing backing services is not a manifest step');
  assert(/ONLY systemctl you run/.test(deploySeg),
    'the app-unit restart is the ONE legitimate systemctl — the fence must say so, or the ban reads as contradicting step 6');
  const hcSeg = SRC.slice(SRC.indexOf('const healthcheck = await agent'), SRC.indexOf("label: 'healthcheck'"));
  assert(/do NOT start\/restart ANY service/.test(hcSeg) && /docker start/.test(hcSeg),
    'the healthcheck must not coax a 2xx by starting services — a dependency-not-up diagnosis is EVIDENCE for the rollback decision');
});

// ---- THE FIRST-DEPLOY CONTRACT DEADLOCK (first live E.B run, 2026-07-14 — DEC-DEV-0201) ----------
//
// E.A must ship the CNT `draft` (never claim `active` before a live verify). E.B refused to deploy a
// non-`active` manifest, calling it ENV_NOT_READY. The live verify can only come FROM a deploy ⇒ the
// FIRST DEPLOY WAS IMPOSSIBLE IN PRINCIPLE. The live run.json carried `disposition: null` — the preflight
// short-circuited before the §3.2 resolver was ever reached, so the whole mutating branch of the gate was
// unreachable, untested, and (worse) unnecessary: at L3×staging the resolver would have said `auto`, so
// the bogus block was the ONLY thing standing between an unverified contract and a silent auto-deploy.
//
// These tests EVALUATE the real source expressions (not string-match them): a regression that re-couples
// status to readiness, or drops the contract axis from the resolver call, fails here exactly as it would live.

// Pull `const manifestOk = <expr>` out of the source and run it as the code it is.
function evalManifestOk(manifest) {
  const m = SRC.match(/const hasSteps = ([^\n]+)\nconst manifestOk = ([^\n]+)/);
  assert(m, 'could not locate the manifestOk expression (has the preflight been restructured?)');
  // eslint-disable-next-line no-new-func
  return new Function('manifest', `const hasSteps = ${m[1]}; return ${m[2]};`)(manifest);
}

test('DEADLOCK REGRESSION: present + a step-list + status=draft ⇒ manifestOk (NO ENV_NOT_READY)', () => {
  assert(evalManifestOk({ present: true, status: 'draft', steps: [{ run: 'pnpm -r build' }] }) === true,
    'THE DEADLOCK: a draft manifest that exists, parses and carries a step-list must NOT be ENV_NOT_READY — '
    + 'the equipment is on disk; what is missing is a HUMAN, and a missing human is a gate, not a block');
  assert(evalManifestOk({ present: true, status: 'active', steps: [{ run: 'x' }] }) === true, 'active is deployable too');
  assert(evalManifestOk({ present: true, status: null, steps: [{ run: 'x' }] }) === true,
    'an undeclared status is a TRUST question (→ conservatively draft at the gate), never a readiness block');
});

test('…but present=false STILL gives ENV_NOT_READY (the real "could not prepare" cases survive)', () => {
  assert(evalManifestOk({ present: false, status: 'active', steps: [{ run: 'x' }] }) === false, 'absent/unparseable manifest ⇒ ENV_NOT_READY');
  assert(evalManifestOk({ present: true, status: 'active', steps: [] }) === false, 'a manifest with no executable step-list ⇒ ENV_NOT_READY (nothing to run)');
  assert(evalManifestOk({ present: true, status: 'active' }) === false, 'no steps key at all ⇒ ENV_NOT_READY');
  assert(evalManifestOk(null) === false, 'a null relay ⇒ ENV_NOT_READY (never optimistic)');
});

test('the manifestOk expression does not read `status` at all (the axes are separated IN CODE)', () => {
  const m = SRC.match(/const manifestOk = ([^\n]+)/);
  assert(m, 'no manifestOk');
  assert(!/status/.test(m[1]),
    `manifestOk must NOT depend on status — that coupling IS the deadlock; got: ${m[1]}`);
  // and the draft branch must not downgrade readiness
  const draftIdx = SRC.indexOf('if (contractDraft) {');
  assert(draftIdx !== -1, 'no contractDraft branch');
  const draftArm = SRC.slice(draftIdx, SRC.indexOf('\n}', draftIdx));
  assert(!/worstReadiness/.test(draftArm) && !/readiness = /.test(draftArm),
    'the draft branch must NEVER downgrade readiness — a draft contract is a trust fact, not an env fact');
  assert(/readinessReasons\.push/.test(draftArm),
    'the draft must still be DISCLOSED in readiness_reasons (an explanation, not a block)');
});

// Compose the REAL resolver command from the source template — a dropped flag or a broken interpolation
// fails here exactly as it would live.
function composeResolveCmd(vars) {
  const m = SRC.match(/const resolveCmd = `([\s\S]*?)`\n/);
  assert(m, 'could not locate the resolveCmd template');
  const names = Object.keys(vars);
  // eslint-disable-next-line no-new-func
  return new Function(...names, 'return `' + m[1] + '`')(...names.map((n) => vars[n]));
}

test('§3.2 + contract axis: a draft contract reaches the resolver as --contract-status (auto → human-gate)', () => {
  const base = {
    AUTONOMY_LIB: 'A.cjs', RISK: 'HIGH', ENV_TIER: 'staging', readiness: 'READY',
    contractStatus: 'draft', ACCEPT_DRAFT: false, AUTONOMY_POLICY_CFG: null, AUTONOMY_OVERRIDE: 'L3',
  };
  const cmd = composeResolveCmd(base);
  assert(cmd === 'node A.cjs resolve --operation-class deploy_staging --risk HIGH --env-tier staging --readiness READY --contract-status draft --override L3',
    `the draft must ride to the resolver — got: ${cmd}`);
  // the owner's sanction is a SEPARATE, explicit flag — never implied by the draft itself
  const sanctioned = composeResolveCmd({ ...base, ACCEPT_DRAFT: true });
  assert(/--accept-draft-contract/.test(sanctioned), `the owner sanction must reach the resolver — got: ${sanctioned}`);
  assert(!/--accept-draft-contract/.test(cmd), 'the sanction must NOT be sent unless the owner actually gave it');
});

test('BACKWARD-COMPAT: no contract status ⇒ the resolver command is byte-for-byte the pre-fix one', () => {
  const cmd = composeResolveCmd({
    AUTONOMY_LIB: 'A.cjs', RISK: 'HIGH', ENV_TIER: 'staging', readiness: 'DEGRADED',
    contractStatus: null, ACCEPT_DRAFT: false, AUTONOMY_POLICY_CFG: null, AUTONOMY_OVERRIDE: null,
  });
  assert(cmd === 'node A.cjs resolve --operation-class deploy_staging --risk HIGH --env-tier staging --readiness DEGRADED',
    `an absent contract axis must leave the command unchanged — got: ${cmd}`);
});

test('🔒 §8.3: the process REPORTS the contract evidence and never writes .claude/integrator/**', () => {
  // a DEPLOYED run on a draft contract emits the live-evidence the Integrator needs to flip it…
  assert(/contract_evidence: contractEvidence/.test(SRC), 'the DEPLOYED arm must carry contract_evidence');
  assert(/verdict: 'live-verified'/.test(SRC), 'the evidence must carry a verdict');
  assert(/run_id: RUN_ID \|\| null/.test(SRC), 'the evidence must carry the RUN_ID (the handle the flip points at)');
  assert(/const RUN_ID = A\.runId \|\| ''/.test(SRC), 'RUN_ID must be FORWARDED (the harness may not read a clock/FS)');
  assert(/flip_owner: 'integrator'/.test(SRC), 'the evidence must name WHO may flip the contract — not us');
  // …and NOTHING in this process may write that zone (the §8.3 line; convenience is exactly how it gets crossed)
  assert(/NEVER WRITE UNDER/.test(SRC) && /\.claude\/integrator/.test(SRC),
    'the mutating agent must be explicitly forbidden from writing .claude/integrator/**');
  const deploySeg = SRC.slice(SRC.indexOf('const deployed = await agent'), SRC.indexOf("label: 'deploy-flip'"));
  assert(/§8\.3/.test(deploySeg) && /draft→active/.test(deploySeg),
    'the deploy agent must be told, in words, not to flip the contract itself');
  // no agent prompt may instruct a write/edit into the Integrator zone
  for (const m of SRC.match(/(Write|write|edit|Edit)[^\n]{0,40}\.claude\/integrator[^\n]*/g) || []) {
    assert(/never|NEVER|not|NOT|read-only|READ-ONLY/i.test(m), `a prompt appears to write the Integrator zone: ${m}`);
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
