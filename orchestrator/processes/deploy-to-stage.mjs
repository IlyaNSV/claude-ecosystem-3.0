export const meta = {
  name: 'deploy-to-stage',
  description: 'Orchestrator process E.B — the staging deploy cell of the feature-production line, run AFTER the P7 runtime gate PASSes. Preflight (env-readiness + CRLF-tolerant manifest parse + clean build/test + a cheap pre-flip runtime-readiness re-probe) → the §3.2 autonomy-policy resolver GATE (the last line before any mutation; STOP unless it returns auto) → Deploy (build a releases/<ts>, migrate, flip the `current` symlink, restart the systemd units — VM-gated) → Healthcheck (GET /health, diagnosed against the P7 5-class failure taxonomy). Two-axis result (DEPLOYED | DEPLOY_FAILED | BLOCKED) × readiness (READY | DEGRADED | ENV_NOT_READY). Closes the "P7 PASS = done" gap into "P7 PASS → deploy".',
  phases: [
    { title: 'Preflight' },
    { title: 'Gate' },
    { title: 'Deploy' },
    { title: 'Healthcheck' },
  ],
}

/*
 * Orchestrator process `deploy-to-stage` — Epic E sub-phase E.B (PROD readiness campaign
 * DEC-DEV-0198 / Волна B, B2). Design SSOTs: dev/plans/PROD_READINESS_CAMPAIGN.md §3.2 (floor
 * BEFORE deploy — the campaign's most-likely defect: a silent green auto-deploy that never calls
 * the resolver) + §8.1/§8.3/§8.4; dev/gates/EPIC_E_READINESS.md D-1/D-6/D-7/D-9 (deploy is a LOCAL
 * op inside the VM: build → releases/<ts> → flip `current` → (re)start systemd; healthcheck is the
 * POST-deploy nog, P7 live boot is the PRE-deploy gate — no duplication).
 *
 * WHY THIS EXISTS: before E.B the feature-production line went `runtime_gate` (P7 PASS) → `done`
 * (charter v4). The deliverable was validated + boot-attemptable but never SHIPPED. E.B inserts the
 * deploy cell between P7 and `done`: the line now deploys the staging instance, healthchecks it, and
 * auto-rolls-back a flipped-but-unhealthy release (E.C).
 *
 * THE §3.2 HEART (campaign §3.2 ACCEPTANCE — NOT deferrable): the floor (prod_deploy / destructive /
 * spend_money / provision_real_secret) and the whole autonomy ladder are a PURE FUNCTION in
 * autonomy-policy.cjs — they bite ONLY where they are called. A deploy path that mutates without
 * asking the resolver bypasses the floor entirely, and no line of code would stop it. So the Gate
 * phase runs `autonomy-policy.cjs resolve` (CLI seam, via an agent+Bash relay — the harness .mjs
 * cannot require() a lib, DEC-DEV-0073 §D.1) with the LIVE readiness, BEFORE any mutation. Only a
 * `disposition: auto` proceeds; human-gate / consilium-gate / block → STOP (result=BLOCKED,
 * flipped=false). Passing --readiness is deliberate: it is the ONE place applyReadinessGuard runs
 * (the fabric prescription is readiness-blind), so DEGRADED→human-gate and ENV_NOT_READY→block bite
 * here — this call is the load-bearing gate that also catches a standalone/bypassed invocation.
 *
 * WHY NOT REDUNDANT WITH THE FABRIC GATE: the fabric prescription decides START-or-not (level × env ×
 * class, readiness-blind); THIS call decides MUTATE-or-not with live readiness, and is the last line
 * for a run that never went through the fabric. At L3×staging both say auto (no deadlock). At the L1
 * default the fabric human-gates the START; the owner approves by re-invoking with --autonomy L2|L3
 * (forwarded here as autonomyOverride → --override), which both gates then read as auto.
 *
 * TWO-AXIS CONTRACT (mirrors validate-feature-impl.mjs): result ∈ {DEPLOYED | DEPLOY_FAILED |
 * BLOCKED} × readiness ∈ {READY | DEGRADED | ENV_NOT_READY}. Invariants IN CODE: ENV_NOT_READY ⇒
 * BLOCKED, flipped=false (a down substrate / un-provisioned manifest is "could not prepare/judge",
 * NEVER a DEPLOY_FAILED); BLOCKED ⇒ flipped=false (never mutated); DEPLOYED ⇒ flipped=true ∧
 * healthcheck.healthy; flipped=true only AFTER the resolver returned auto. `flipped` is what the
 * charter routes rollback on (flipped + unhealthy → auto-rollback; not-flipped failure → escalate).
 *
 * CAPTURE-DON'T-FIX (D-5): the deploy + healthcheck agents SURFACE a failed flip / a post-flip
 * unhealthy boot (diagnosed against the P7 taxonomy runtime-readiness.cjs::smokePlan.failure_classes:
 * env-not-loaded / missing-migration / port-in-use / missing-runtime-secret / dependency-not-up) —
 * they do NOT remediate. Fixing is a P5/P6 re-drive; recovery is E.C rollback.
 *
 * VM-GATED (E.D/E.G): the real `pnpm -r build`, `prisma migrate deploy`, the `current` symlink flip,
 * `systemctl restart`, and the live `/health` call are real only on the VM-fabric prod-stand. They
 * live INSIDE agent() bodies (prompts), never executed repo-side. Repo-side ships fully structured +
 * wiring-tested; the live axis is the VM-restore gate (campaign §2).
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script. Every probe /
 * lib run / build / migrate / flip / restart / healthcheck happens INSIDE an agent(); inputs via args.
 * The clock is not read (the release-dir timestamp is stamped by the deploy agent on the VM).
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect + MDP pin) +
 * tests/orchestrator/deploy-to-stage-wiring.test.cjs (static invariants incl. §3.2 resolver-before-
 * mutation). A live deploy needs a GO'd feature + a working VM staging target (E.D/E.G, VM-gated).
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent (or the dispatcher's Workflow call)
// may pass a JSON string. (Keep the comment ABOVE this line — the args-parsing smoke evals it.)
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
// FEATURE is the `.product/features` KEY (FM-NNN) — it is fed to runtime-readiness.cjs --feature in the
// pre-flip re-probe, which resolves the §6 manifest under .product/features. NOT the cc-sdd/.kiro spec
// slug (a wrong-namespace key ⇒ capabilities_unknown ⇒ a re-probe with NO §6 check). Live P7 run FM-006.
const FEATURE = A.feature || ''                                  // optional lens: the feature this deploy ships
// DEF-4 monorepo pin for the pre-flip re-probe (e.g. `apps/api`) — same knob as P7's. Without it the lib
// auto-picks by sourceRank (dev > start), so a frontend leg can shadow the backend one. Absent ⇒ the
// probe command is byte-for-byte the old one (backward-compat).
const APP = A.app || ''
const CAPABILITY = A.capability || 'cc-sdd-deploy'               // the deploy-capability slug (Integrator-equipped, E.A)
const MANIFEST = A.manifest || (CAPABILITY ? `.claude/integrator/deploy/${CAPABILITY}/deploy-manifest.yaml` : '')  // E.A deploy-setup (deployment-provisioning.md)
const ENV_TIER = A.envTier || 'staging'                          // per-state env tier — staging (prod is a floor-gated stub, NOT this process)
const RISK = A.risk || 'HIGH'                                    // a deploy is HIGH by construction (real mutation)
const AUTONOMY_LIB = A.autonomyLib || '.claude/orchestrator/lib/autonomy-policy.cjs'  // §3.2 resolver CLI seam (F1/F2/F3, DEC-DEV-0193/0194)
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs'          // DEC-DEV-0092: substrate readiness backbone
const RUNTIME_PROBE = A.runtimeProbe || '.claude/orchestrator/lib/runtime-readiness.cjs'  // DEC-DEV-0120: P7 readiness leg + smokePlan failure taxonomy
const P6_VERDICT = A.p6Verdict || ''                            // optional: the prior P6 GO (informational — a deploy over a non-GO is disclosed)
const P7_VERDICT = A.p7Verdict || ''                            // optional: the prior P7 verdict (fed into the pre-flip re-probe)
const AUTONOMY_OVERRIDE = A.autonomyOverride || null            // the forwarded --autonomy flag (owner approval RAISES the level → resolver reads auto)
const AUTONOMY_POLICY_CFG = A.autonomyPolicy || null            // optional inline policy slice (default_level / process_overrides)
const VALIDATION = A.validationCommands || {}                   // {build, test} if known; else discovered from the manifest / repo

// ---- schemas ---------------------------------------------------------------
const ENV_READINESS_SCHEMA = {
  type: 'object',
  required: ['readiness'],
  properties: {
    readiness: { type: 'string', enum: ['READY', 'DEGRADED', 'ENV_NOT_READY'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
}

// The parsed deploy-manifest (deployment-provisioning.md §2/§4). present=false OR status draft-only ⇒
// the capability is not provisioned → readiness=ENV_NOT_READY (could not PREPARE the deploy), never a
// fabricated step-list. CRLF-normalized before parse (this process is a CNT consumer — see below).
const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['present'],
  properties: {
    present: { type: 'boolean' },                              // file exists + parseable + carries an executable step-list
    status: { type: ['string', 'null'] },                      // draft | active — a draft-only manifest is not deployable
    steps: { type: 'array', items: { type: 'object' } },       // ordered build → migrate → flip → (re)start
    healthcheck: { type: ['object', 'null'] },                 // { url, boot_window_sec, expect, failure_taxonomy }
    migrate: { type: ['object', 'null'] },                     // prisma migrate deploy step (conditional_on packages/db)
    release_layout: { type: ['object', 'null'] },              // releases/<ts> + current symlink + shared/
    disclosures: { type: 'array', items: { type: 'string' } },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: {
    passed: { type: 'boolean' },                               // clean build AND suite both green (D-6)
    build: { type: 'string' },
    suite: { type: 'string' },
    failures: { type: 'array', items: { type: 'string' } },
  },
}

// The pre-flip readiness re-probe — the runtime-readiness.cjs READINESS leg only (NOT a second live
// boot: the live P7 boot is the runtime_gate cell, D-7 no-duplication). Keeps a standalone/bypassed
// deploy off a NOT_STARTABLE / ENV_NOT_READY target cheaply + deterministically.
const ASSESS_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['READY_TO_SMOKE', 'BLOCKED_ON_CAPABILITY', 'ENV_NOT_READY', 'NOT_STARTABLE'] },
    run_target: { type: ['object', 'null'] },
    disclosures: { type: 'array', items: { type: 'string' } },
  },
}

// The §3.2 disposition envelope relayed from the autonomy-policy CLI seam (shape = resolve()'s return).
const AUTONOMY_SCHEMA = {
  type: 'object',
  required: ['disposition'],
  properties: {
    disposition: { type: 'string' },                           // auto | consilium-gate | human-gate | block
    level_applied: { type: ['string', 'null'] },
    floor_hit: { type: 'boolean' },
    why: { type: 'array', items: { type: 'string' } },
  },
}

const DEPLOY_SCHEMA = {
  type: 'object',
  required: ['flipped'],
  properties: {
    flipped: { type: 'boolean' },                              // did `current` move to the new release? (the rollback trigger)
    release: { type: ['string', 'null'] },                     // releases/<ts> id
    migrated: { type: 'boolean' },
    partial: { type: 'boolean' },                              // some steps ran then a later step failed
    steps_done: { type: 'array', items: { type: 'string' } },
    diagnosis: { type: 'string' },
    observed: { type: 'string' },
  },
}

const HEALTHCHECK_SCHEMA = {
  type: 'object',
  required: ['healthy'],
  properties: {
    healthy: { type: 'boolean' },                              // 2xx within boot_window_sec
    failure_class: { type: ['string', 'null'] },               // a P7 smokePlan.failure_classes id, or null
    diagnosis: { type: 'string' },
    observed: { type: 'string' },
  },
}

// worst-of readiness (mirror of validate-feature-impl / env-readiness rails: readiness only ever
// downgrades toward "could not judge", never upgrades toward READY).
const RANK = { READY: 0, DEGRADED: 1, ENV_NOT_READY: 2 }
const worstReadiness = (a, b) => (RANK[a] >= RANK[b] ? a : b)

// ===========================================================================

// ---- Phase 1: Preflight — env-readiness · manifest · clean build/test · re-probe ----
phase('Preflight')

// (a) substrate readiness axis (CODE, not LLM initiative) — the deterministic env-readiness probe.
const envProbe = await agent(
  `Run the env-readiness probe for the ${ENV_TIER} deploy target: \`node ${ENV_PROBE}\` via Bash and relay its JSON verbatim (readiness + reasons). ` +
  `Do NOT start any substrate yourself — just report whether what the target uses (Postgres/Redis/docker) is up.`,
  { model: 'sonnet', schema: ENV_READINESS_SCHEMA, phase: 'Preflight', label: 'env-readiness' },   // MDP: env-probe JSON relay (mechanical transport)
)
let readiness = (envProbe && envProbe.readiness) || 'DEGRADED'   // unknown/absent → conservatively DEGRADED (never silently READY)
// CARRY the WHY of the readiness axis, don't only log it. THIS is the axis applyReadinessGuard gates the
// deploy on (DEGRADED → human-gate, ENV_NOT_READY → block): a run.json that states `readiness` but not
// its reasons makes the DEPLOY GATE UNAUDITABLE — the live P7 run had to hand-probe the VM to learn the
// DEGRADED was a missing pg_isready/redis-cli, not an outage. Every downgrade below appends its reason.
const readinessReasons = [...((envProbe && envProbe.reasons) || [])]
log(`pre-flight env-readiness: ${readiness}${readinessReasons.length ? ` — ${readinessReasons.join('; ')}` : ''}`)

// (b) parse the E.A deploy-manifest — EOL-TOLERANT (this process is a CNT consumer; the manifest
// materialises CRLF on a Windows pilot — deployment-provisioning.md "EOL tolerance" hands this as a
// contract). A missing / draft-only manifest is "could not prepare" → ENV_NOT_READY, NEVER fabricated.
const manifest = await agent(
  `Parse the deploy-setup manifest for capability "${CAPABILITY}" at \`${MANIFEST}\` (equipped by the Integrator deployer, E.A — deployment-provisioning.md §2/§4).\n` +
  `FIRST normalize line endings: read the file, then \`.replace(/\\r\\n/g,'\\n')\` (or anchor \`/^---\\r?\\n/\` + \`split(/\\r?\\n/)\`) BEFORE parsing — the .yaml materialises CRLF on a Windows pilot and a bare-\\n parse would mangle it (the capability-probe.cjs extractManifest pattern; campaign §8.2 pt 7 / G36).\n` +
  `Extract the ordered step-list (build → migrate → flip → (re)start), the release layout (releases/<ts> + current symlink + shared/), the conditional prisma migrate-deploy step, and the healthcheck spec (url / boot_window_sec / expect / failure_taxonomy).\n` +
  `FAIL LOUD, do NOT fabricate: if the file is absent, unparseable, or status is draft-only (the consumer does not exist yet / not verified), return present:false with a disclosure saying so — do NOT invent a step-list. Do NOT run any step; do NOT commit.`,
  { model: 'sonnet', schema: MANIFEST_SCHEMA, phase: 'Preflight', label: 'manifest-parse' },   // MDP: read + CRLF-normalize + parse a manifest (standard/mechanical)
)
const manifestOk = !!(manifest && manifest.present && manifest.status !== 'draft')
if (!manifestOk) {
  readiness = worstReadiness(readiness, 'ENV_NOT_READY')   // capability not provisioned → could not PREPARE the deploy
  const why = `deploy-manifest for "${CAPABILITY}" not deployable (present=${manifest && manifest.present}, status=${(manifest && manifest.status) || 'null'}) at ${MANIFEST} → ENV_NOT_READY; provision it via /integrator:provision ${CAPABILITY}`
  readinessReasons.push(why)   // a readiness downgrade that is NOT the env probe's — record it or the gate reads as an unexplained block
  log(`manifest not deployable → readiness ENV_NOT_READY — ${why}`)
}

// (c) clean build + full suite (D-6 — a deploy ships only green code). A RED build/test over a READY
// substrate is a real DEPLOY_FAILED (code regression), NOT an env artifact → route escalate, nothing flipped.
const build = await agent(
  `Clean-build and test the deployable for the ${ENV_TIER} release (D-6 — the last code gate before a mutation).\n` +
  `Run the monorepo build and the suite via Bash and relay the REAL exit results (do NOT infer green): ` +
  `${JSON.stringify(VALIDATION) !== '{}' ? `commands: ${JSON.stringify(VALIDATION)}` : 'discover from the manifest step-list / repo manifests — typically `pnpm -r build` then the test script'}.\n` +
  `passed = (build green AND suite green). List every failure verbatim in failures[]. Do NOT deploy, flip, migrate, or commit — this is the build gate only.`,
  { model: 'sonnet', schema: BUILD_SCHEMA, phase: 'Preflight', label: 'build-test' },   // MDP: run build+suite + relay exits (standard/mechanical)
)
const buildPassed = !!(build && build.passed)
log(`clean build+test: ${buildPassed ? 'GREEN' : 'RED'}${build && build.failures && build.failures.length ? ` — ${build.failures.length} failure(s)` : ''}`)

// (d) pre-flip runtime-readiness RE-PROBE (readiness leg only — NOT a live boot, D-7). Keeps a
// standalone deploy off a NOT_STARTABLE / ENV_NOT_READY target; the forwarded p7Verdict is a hint.
const preflight = await agent(
  `Run the runtime-smoke READINESS leg (deterministic — NOT a live boot; the live boot is the P7 runtime_gate, do NOT duplicate it): ` +
  `\`node ${RUNTIME_PROBE}${FEATURE ? ` --feature ${FEATURE}` : ''} --root .${APP ? ` --app ${APP}` : ''} --env ${readiness}${P7_VERDICT ? ` --p6 ${P7_VERDICT}` : (P6_VERDICT ? ` --p6 ${P6_VERDICT}` : '')}\` via Bash and relay its JSON verbatim (verdict + run_target + disclosures). ` +
  `This is the cheap re-check that the target is still startable (run-target present, env up, §6 boot-caps satisfied) before we deploy. Do NOT boot, provision, or mock — just relay.`,
  { model: 'sonnet', schema: ASSESS_SCHEMA, phase: 'Preflight', label: 'runtime-readiness' },   // MDP: runtime-readiness.cjs JSON relay (mechanical transport)
)
const preVerdict = (preflight && preflight.verdict) || 'ENV_NOT_READY'
if (preVerdict === 'ENV_NOT_READY' || preVerdict === 'NOT_STARTABLE' || preVerdict === 'BLOCKED_ON_CAPABILITY') {
  readiness = worstReadiness(readiness, 'ENV_NOT_READY')   // not startable / substrate down / boot-cap blocked → could not judge/prepare
  readinessReasons.push(`pre-flip runtime-readiness = ${preVerdict}${FEATURE ? ` (feature ${FEATURE}${APP ? `, app ${APP}` : ''})` : ''} → ENV_NOT_READY`)
}
const disclosures = [
  ...((manifest && manifest.disclosures) || []),
  ...((preflight && preflight.disclosures) || []),
  ...(P6_VERDICT && P6_VERDICT !== 'GO' ? [`deploying over a non-GO P6 verdict (${P6_VERDICT}) — indicative, not clean (FB-013)`] : []),
]
log(`pre-flip runtime-readiness: ${preVerdict}; readiness axis = ${readiness}`)

// ---- INVARIANT (in code): ENV_NOT_READY ⇒ BLOCKED, flipped=false — a down substrate / un-provisioned
// manifest / not-startable target is "could not prepare or judge", NEVER a DEPLOY_FAILED. Decided
// BEFORE the build-fail branch so a real code failure is not masked, and before the resolver so we
// never even ask to mutate a target we cannot deploy to.
if (readiness === 'ENV_NOT_READY') {
  log('BLOCKED (readiness=ENV_NOT_READY): substrate down / manifest not provisioned / target not startable — no mutation, flipped=false. Bring the target up / provision the capability and re-run.')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'BLOCKED', readiness, readiness_reasons: readinessReasons, flipped: false,
    release: null, healthcheck: null, disposition: null, autonomy: null,
    disclosures: disclosures.concat(['readiness=ENV_NOT_READY — the deploy could not be prepared/judged; this is NOT a deploy failure']),
  }
}

// A RED build/test over a judged (≠ENV_NOT_READY) substrate is a real DEPLOY_FAILED with NOTHING
// flipped → the charter routes it to escalate (evt:deploy.preflight_failed), not auto-rollback.
if (!buildPassed) {
  log('DEPLOY_FAILED at preflight (build/test RED) — nothing flipped; route to escalate for a P5/P6 re-drive (capture-don\'t-fix).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'DEPLOY_FAILED', readiness, readiness_reasons: readinessReasons, flipped: false,
    release: null, healthcheck: null, disposition: null, autonomy: null,
    disclosures: disclosures.concat(((build && build.failures) || []).map((x) => `build/test: ${x}`)),
  }
}

// ---- Phase 2: Gate — the §3.2 resolver call. THE heart. After readiness+risk are known, BEFORE any
// mutation. CLI seam via an agent+Bash relay (harness cannot require() the lib). --readiness is what
// makes applyReadinessGuard bite here (the ONLY readiness-aware consultation on the deploy path).
phase('Gate')
const disposition = await agent(
  `Resolve the authoritative autonomy disposition for THIS ${ENV_TIER} deploy (§3.2 ACCEPTANCE — the disposition is CODE; relay the JSON verbatim, do NOT judge or override it):\n` +
  `node ${AUTONOMY_LIB} resolve --operation-class deploy_staging --risk ${RISK} --env-tier ${ENV_TIER} --readiness ${readiness}` +
  `${AUTONOMY_POLICY_CFG ? ` --policy '${JSON.stringify(AUTONOMY_POLICY_CFG)}'` : ''}${AUTONOMY_OVERRIDE ? ` --override ${AUTONOMY_OVERRIDE}` : ''}\n` +
  `Return its { disposition, level_applied, floor_hit, why } object exactly. (operation_class deploy_staging is NOT on the floor, so this is L-matrix-driven: L0/L1×staging→human-gate, L2→consilium-gate, L3→auto; a DEGRADED substrate downgrades auto→human-gate, ENV_NOT_READY→block.)`,
  { model: 'sonnet', schema: AUTONOMY_SCHEMA, phase: 'Gate', label: 'autonomy-resolve' },   // MDP: deterministic resolver JSON relay (mechanical transport)
)
// OBEDIENCE RULE (§5): the flip below is reached ONLY on a fresh disposition==='auto' from this call.
// human-gate / consilium-gate / block → STOP: result=BLOCKED, flipped=false, envelope carried for the
// owner. A deploy that mutates without this gate is an E.B FAILURE, even if it "works".
if (!disposition || disposition.disposition !== 'auto') {
  const d = disposition ? disposition.disposition : 'null'
  log(`§3.2 GATE: disposition=${d} (not auto${disposition && disposition.floor_hit ? ', floor_hit' : ''}) — STOP. No mutation. flipped=false. Owner must approve (re-invoke --autonomy L2|L3) or the substrate must recover.`)
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'BLOCKED', readiness, readiness_reasons: readinessReasons, flipped: false,
    release: null, healthcheck: null,
    disposition, autonomy: disposition,   // payloadPath: autonomy — the envelope rides the evt:deploy.gated PA so the owner sees WHY
    disclosures: disclosures.concat([`deploy gated by autonomy-policy → ${d}${disposition && disposition.floor_hit ? ' (floor)' : ''}: ${(disposition && disposition.why && disposition.why.slice(-1)[0]) || 'see why[]'}`]),
  }
}
log(`§3.2 GATE: disposition=auto (level ${disposition.level_applied}) — proceeding to the mutation.`)

// ---- Phase 3: Deploy (VM-GATED) — execute the manifest step-list. Sets flipped=true iff `current`
// moves. Capture-diagnose a partial deploy; do NOT fix. Acquire the process lockfile before the flip
// (A-9 belt; the charter's wip:1 already serializes the lane).
phase('Deploy')
const deployed = await agent(
  `Execute the ${ENV_TIER} deploy for capability "${CAPABILITY}" per the parsed manifest step-list (VM-gated — real only on the VM prod-stand; this is the ONE mutating step, authorized by the §3.2 auto disposition above).\n` +
  `Manifest steps: ${JSON.stringify((manifest && manifest.steps) || [])}. Release layout: ${JSON.stringify((manifest && manifest.release_layout) || {})}.\n` +
  `1) Acquire a deploy lockfile (A-9 belt — refuse if a parallel deploy holds it). 2) Build into a fresh releases/<timestamp> dir + wire the shared/.env symlink. 3) Run the prisma migrate deploy step IF the manifest marks it present/verified (skip cleanly if conditional+unverified — note it). 4) FLIP the \`current\` symlink to the new release (this is the atomic deploy — set flipped=true ONLY once current actually points at the new release). 5) systemctl restart the @app/* units (worker only if WORKER_AUTOSTART=1 is set).\n` +
  `CAPTURE-DON'T-FIX: if a step fails, STOP, record steps_done + partial + a diagnosis of what broke and whether \`current\` moved — do NOT retry-hack, edit code, or commit. Set flipped precisely: true iff the symlink now points at the new release, false otherwise.\n` +
  `Return flipped + release + migrated + partial + steps_done + diagnosis + observed.`,
  { model: 'opus', schema: DEPLOY_SCHEMA, phase: 'Deploy', label: 'deploy-flip' },   // MDP: real high-R mutation (build/migrate/flip/restart) + partial-deploy diagnosis (impl/depth)
)
const flipped = !!(deployed && deployed.flipped)
const release = (deployed && deployed.release) || null
log(`deploy: flipped=${flipped}${release ? ` (release ${release})` : ''}${deployed && deployed.partial ? ' — PARTIAL' : ''}`)

// A flip that never happened (build/migrate/flip failed before moving `current`) is a DEPLOY_FAILED
// with nothing live to roll back → escalate (evt:deploy.preflight_failed). Only a FLIPPED release can
// auto-rollback (there is a prior known-good release + a live bad one).
if (!flipped) {
  log('DEPLOY_FAILED (flip did not complete) — nothing went live; route to escalate (no rollback: there is no flipped release to revert).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'DEPLOY_FAILED', readiness, readiness_reasons: readinessReasons, flipped: false,
    release, healthcheck: null, disposition, autonomy: disposition,
    disclosures: disclosures.concat([`deploy failed before the flip: ${(deployed && deployed.diagnosis) || 'see observed'}`]),
  }
}

// ---- Phase 4: Healthcheck (VM-GATED) — POST-deploy nog (D-5). Hit the manifest healthcheck; diagnose
// a failure against the P7 5-class taxonomy. Healthy → DEPLOYED. Unhealthy → DEPLOY_FAILED + flipped
// (the charter routes this to auto-rollback, E.C).
phase('Healthcheck')
const healthcheck = await agent(
  `Healthcheck the freshly-flipped ${ENV_TIER} release (VM-gated — POST-deploy nog, D-5; capture-don't-fix).\n` +
  `Spec: ${JSON.stringify((manifest && manifest.healthcheck) || { url: 'http://localhost:<port>/health', boot_window_sec: 30, expect: '2xx' })}.\n` +
  `Hit the healthcheck url and wait up to boot_window_sec for a 2xx. If it does NOT come healthy, diagnose the failure against the P7 failure taxonomy (runtime-readiness.cjs::smokePlan.failure_classes — reuse, do NOT reinvent): env-not-loaded (500 / config-secret undefined at runtime — the RUN 01 root cause), missing-migration (DB schema/relation error), port-in-use (EADDRINUSE), missing-runtime-secret (cannot resolve an external client), dependency-not-up (connection refused to DB/cache).\n` +
  `Do NOT remediate, edit code, or commit — SURFACE the diagnosis (a flipped-but-unhealthy release will be auto-rolled-back by E.C). Return healthy + failure_class (a taxonomy id or null) + diagnosis + observed.`,
  { model: 'opus', schema: HEALTHCHECK_SCHEMA, phase: 'Healthcheck', label: 'healthcheck' },   // MDP: live probe + diagnosis against the failure taxonomy (judgment/depth, like P7 boot-smoke)
)
const healthy = !!(healthcheck && healthcheck.healthy)
log(`healthcheck: ${healthy ? 'HEALTHY → DEPLOYED' : `UNHEALTHY (${(healthcheck && healthcheck.failure_class) || 'unknown'}) → DEPLOY_FAILED, flipped → auto-rollback`}`)

// ---- synthesize the two-axis result. INVARIANT: DEPLOYED ⇒ flipped ∧ healthy (both true by
// construction on this path); an unhealthy flipped release is DEPLOY_FAILED + flipped (→ rollback).
const result = healthy ? 'DEPLOYED' : 'DEPLOY_FAILED'
return {
  feature: FEATURE || null,
  capability: CAPABILITY,
  env_tier: ENV_TIER,
  result,                              // DEPLOYED | DEPLOY_FAILED (flipped) | BLOCKED (handled above)
  readiness,                           // READY | DEGRADED (ENV_NOT_READY returns above)
  readiness_reasons: readinessReasons, // WHY that readiness (env-probe reasons + any local downgrade) — the §3.2 gate must be auditable from run.json alone
  flipped,                             // true here — the charter routes DEPLOY_FAILED+flipped to auto-rollback
  release,
  healthcheck,                         // { healthy, failure_class, diagnosis, observed }
  disposition,                         // the §3.2 resolver envelope
  autonomy: disposition,               // alias (payloadPath: autonomy) — mirrors validate-feature-impl
  disclosures: healthy ? disclosures : disclosures.concat([`post-flip healthcheck failed (${(healthcheck && healthcheck.failure_class) || 'unknown'}): ${(healthcheck && healthcheck.diagnosis) || 'see observed'} — auto-rollback (E.C)`]),
}
