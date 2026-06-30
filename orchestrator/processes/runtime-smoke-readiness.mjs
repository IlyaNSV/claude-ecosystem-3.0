export const meta = {
  name: 'runtime-smoke-readiness',
  description: 'Orchestrator P7 — the runtime-smoke gate AFTER a feature\'s P6 GO: "do the tests pass AND does the app actually start?" A deterministic readiness assessment (run-target present? §6 boot capabilities satisfied? env up?) decides whether a boot smoke is ATTEMPTABLE; if a boot-required capability is BLOCK it emits a §6 capability-request (route Integrator, OD7 await) instead of mocking; if attemptable it boots the dev server and diagnoses a failed start (capture-don\'t-fix). Closes the RUN 01 gap: 223 tests green ≠ application starts.',
  phases: [
    { title: 'Assess' },
    { title: 'Smoke' },
    { title: 'Report' },
  ],
}

/*
 * Orchestrator process P7 `runtime-smoke-readiness` — build DEC-DEV-0120 (Ф5B of the
 * "module complete" plan). Reading: SPEC §3.2 P7 / §8 (deploy/P7 parked until D3-runtime);
 * RUN 01 harvest §1 E6 (#2129–2158) + P2-1; Vision Epic E (the "до прода" segment).
 *
 * WHY P7: P6 answers "tests green + builds?" — necessary, not sufficient. RUN 01's runtime
 * leg booted the dev server with 223 GREEN tests and got a 500: the process never loaded
 * `.env`, plus 5 infra gaps. The lesson (P2-1): "223 tests green ≠ application starts." P7
 * is the gate that closes that gap — the last check before the "до прода" segment (Epic E).
 *
 * TWO LEGS (mirrors the 5A §6 split — a deterministic detect/readiness leg now, a
 * substrate-gated execution leg deferred):
 *   READINESS (deterministic, this build) — runtime-readiness.cjs synthesises a verdict from
 *     three DECLARED/observable signals: (1) is a run target declared (package.json
 *     scripts.dev|start, or a runtime command)? (2) are the feature's §6 external_capabilities
 *     that the boot needs SATISFIED — reusing the 5A capability-probe disposition, NOT a new
 *     heuristic? (3) is the env substrate up (env-readiness.cjs)? verdict ∈ {READY_TO_SMOKE,
 *     BLOCKED_ON_CAPABILITY, ENV_NOT_READY, NOT_STARTABLE}. A BLOCK boot-capability emits a §6
 *     request (route Integrator / Product, OD7 await) — it is DISCLOSED + tracked, never mocked.
 *   EXECUTION (substrate-gated) — the live boot+diagnose. Wired here as an agent step; its LIVE
 *     grade needs a real GO'd feature + a working dev env (the pilot) and the full Epic E
 *     deploy/provisioning round-trip needs Integrator D3-runtime tooling that does not exist
 *     yet. `A.bootSmoke=false` runs the readiness leg only (assess + disclose, no boot) — the
 *     explicit knob for the still-substrate-gated execution.
 *
 * CAPTURE-DON'T-FIX: a boot smoke SURFACES a failed start (diagnosed against the RUN 01
 * failure-class taxonomy: env-not-loaded 500, missing migration, port-in-use, missing runtime
 * secret, dependency-down) — it does NOT remediate. Fixing belongs to P5/P6 on a re-run.
 *
 * DETERMINISM MODEL (SPEC §2): Layer-1 SKELETON = the assess→(emit|smoke)→report FSM. Layer-2
 * JUDGMENT = the boot-diagnose agent. Layer-3 GATE = runtime-readiness.cjs (deterministic .cjs,
 * run by an agent) reusing env-readiness + capability-probe.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script. Every
 * lib run / probe / boot / PA write happens INSIDE an agent(); inputs via args.
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect) +
 * tests/orchestrator/runtime-smoke-readiness-wiring.test.cjs (static invariants). A live boot
 * needs a pilot with a GO'd feature + a dev env (separate, substrate-gated session).
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent may stringify it.
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURE = A.feature || ''                                  // optional lens: which feature's §6 boot caps to check (whole-app boot otherwise)
const SPEC_DIR = A.specDir || (FEATURE ? `.kiro/specs/${FEATURE}` : '')
const RUNTIME_PROBE = A.runtimeProbe || '.claude/orchestrator/lib/runtime-readiness.cjs'   // DEC-DEV-0120: P7 deterministic core
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs'               // DEC-DEV-0092: shared readiness probe
const P6_VERDICT = A.p6Verdict || A.go_gate || ''               // optional: the prior P6 GO/NO-GO/MANUAL_VERIFY (a non-GO smoke is informational, disclosed)
const BOOT_SMOKE = A.bootSmoke !== false                         // default true; false = readiness leg only (the substrate-gated execution knob)

// ---- schemas ---------------------------------------------------------------
const ENV_READINESS_SCHEMA = {
  type: 'object',
  required: ['readiness'],
  properties: {
    readiness: { type: 'string', enum: ['READY', 'DEGRADED', 'ENV_NOT_READY'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
}

const ASSESS_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['READY_TO_SMOKE', 'BLOCKED_ON_CAPABILITY', 'ENV_NOT_READY', 'NOT_STARTABLE'] },
    smoke_attemptable: { type: 'boolean' },
    capabilities_unknown: { type: 'boolean' },                  // §6 probe could not resolve the feature/manifest → disclosed, never a silent clean READY
    run_target: { type: ['object', 'null'] },                   // {command, source} | null
    requests: { type: 'array', items: { type: 'object' } },     // §6 capability-requests on a BLOCK
    disclosures: { type: 'array', items: { type: 'string' } },
    plan: { type: ['object', 'null'] },                         // smoke plan (command + success/failure taxonomy)
  },
}

const SMOKE_SCHEMA = {
  type: 'object',
  required: ['result'],
  properties: {
    result: { type: 'string', enum: ['STARTS', 'FAILS_TO_START', 'INCONCLUSIVE'] },
    started: { type: 'boolean' },
    failure_class: { type: ['string', 'null'] },                // one of the plan's failure_classes ids, or null
    diagnosis: { type: 'string' },
    observed: { type: 'string' },
  },
}

// FB-LR-23 (parallel-worktree PA-id safety): shared instruction so every PA-write below targets the
// SINGLE canonical pending-actions file (the main checkout) + allocates ids from it — a worktree-local
// copy lets parallel runs collide PA-ids. Duplicated verbatim across the PA-emitting processes.
const PA_CANON = 'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '
  + 'one .git but have SEPARATE working trees, so a worktree-local `.claude/pending-actions.md` lets PA-ids collide '
  + 'across concurrent runs (two trees each mint the same PA-NNN). Resolve the SINGLE canonical file ONCE: run '
  + '`git worktree list --porcelain` and take the FIRST `worktree <path>` line (the main checkout, shared by every '
  + 'worktree) → `<that-path>/.claude/pending-actions.md`; if not inside a git worktree, fall back to '
  + '`.claude/pending-actions.md`. READ / SCAN / allocate the next PA-NNN (highest existing id + 1) / APPEND against '
  + 'THAT canonical file — never a worktree-local copy. Do NOT `git add` or commit the pending-actions file (it may '
  + 'live in another checkout; committing it from this worktree would write into a foreign tree) — leave it as '
  + 'working-tree state. '

// On BLOCKED_ON_CAPABILITY: emit the §6 capability-request(s) the boot needs. Mirrors P5's
// surfaceCapability (DEC-DEV-0117) — tracking/disclosure into the canonical PA, routed
// (Integrator for access; Product for an undecided provider), flagged for the OD7 escalate→await
// whose live execution is the substrate-gated remainder. NEVER auto-provisions or mocks.
const emitRuntimeRequest = (requests) =>
  agent(
    `Pre-boot §6 detection found external capabilities this app needs TO START that the environment does not satisfy (a runtime BLOCK — boot would fail).\n` +
    `Record them as ONE tracking section in the canonical pending-actions file. Scan for an existing "§6 runtime-capability — ${FEATURE || 'app'}" block first and UPDATE IT IN PLACE (idempotent re-runs). For each item record: capability, secret_env, provider (or "TBD → Product / OD8"), tier, route (Integrator for access; Product for provider CHOICE), and the rationale "runtime boot requires this".\n` +
    `Requests: ${JSON.stringify(requests)}\n` +
    `These are escalate→await (OD7): a real run is BLOCKED until access exists — note "escalate→await when a runtime smoke needs real access". Do NOT provision, mock, or fake any capability to make the boot pass. ` +
    PA_CANON +
    `Do NOT commit code. Return a one-line confirmation.`,
    { phase: 'Smoke', label: 'runtime-capability-request' },
  )

// On NOT_STARTABLE: no run target is declared — the app has no boot command. That is a
// scaffold/spec gap (route Product), not a capability gap. Track it, don't fabricate a command.
const recordNotStartable = () =>
  agent(
    `The runtime-smoke readiness assessment is NOT_STARTABLE: no run target (no package.json scripts.dev|start|serve, no declared runtime command) was found for ${FEATURE || 'this app'}.\n` +
    `Append a NON-BLOCKING tracking entry to the canonical pending-actions file: "P7 runtime-smoke could not run — no dev/start command declared", route Product (scaffold/spec gap — the run target must be defined before a runtime smoke is meaningful). Do NOT invent or guess a boot command. ` +
    PA_CANON +
    `Do NOT commit code. Return a one-line confirmation.`,
    { phase: 'Report', label: 'not-startable' },
  )

// ===========================================================================

// ---- Phase 1: assess — deterministic runtime-smoke readiness ---------------
phase('Assess')

// pre-flight env-readiness (CODE, not LLM initiative) — feed the readiness axis into the
// runtime probe so a down substrate is ENV_NOT_READY (transient), never a false NOT_STARTABLE.
const envProbe = await agent(
  `Run the env-readiness probe: \`node ${ENV_PROBE}\` via Bash and relay its JSON verbatim (readiness + reasons). ` +
  `Do NOT start any substrate yourself — just report whether what the project uses is up.`,
  { schema: ENV_READINESS_SCHEMA, phase: 'Assess', label: 'env-readiness' },
)
const envReadiness = (envProbe && envProbe.readiness) || 'unknown'
log(`pre-flight env-readiness: ${envReadiness}${envProbe && envProbe.reasons && envProbe.reasons.length ? ` — ${envProbe.reasons.join('; ')}` : ''}`)

// runtime-readiness lib: run-target detection + §6 boot-capability disposition (reuses
// capability-probe) + verdict synthesis. The agent only RELAYS the lib JSON (like the env probe).
const assess = await agent(
  `Run the runtime-smoke readiness probe: \`node ${RUNTIME_PROBE}${FEATURE ? ` --feature ${FEATURE}` : ''} --root . --env ${envReadiness}${P6_VERDICT ? ` --p6 ${P6_VERDICT}` : ''}\` via Bash and relay its JSON verbatim ` +
  `(verdict + smoke_attemptable + run_target + requests + disclosures + plan). Do NOT provision, boot, or mock anything — just relay the lib output.`,
  { schema: ASSESS_SCHEMA, phase: 'Assess', label: 'runtime-readiness' },
)
const verdict = (assess && assess.verdict) || 'NOT_STARTABLE'
const requests = (assess && assess.requests) || []
const disclosures = (assess && assess.disclosures) || []
const runTarget = (assess && assess.run_target) || null
const plan = (assess && assess.plan) || null
const capsUnknown = !!(assess && assess.capabilities_unknown)   // §6 probe could not resolve → readiness assessed WITHOUT capability disposition (disclosed, never silent)
log(`runtime-readiness: ${verdict}${runTarget ? ` (run target: ${runTarget.command})` : ''}; ${requests.length} §6 request(s); ${disclosures.length} disclosure(s)${capsUnknown ? '; ⚠ capability disposition UNAVAILABLE' : ''}`)

// ---- Phase 2: smoke — branch on the verdict --------------------------------
phase('Smoke')
let smoke = null
let p7Result

if (verdict === 'BLOCKED_ON_CAPABILITY') {
  // a boot-required capability is BLOCK → emit the §6 request, do NOT boot (real access needed).
  await emitRuntimeRequest(requests)
  p7Result = 'BLOCKED'
  log(`P7 BLOCKED: ${requests.length} runtime capability(ies) need real access — §6 request emitted (OD7 await). Not booting.`)
} else if (verdict === 'NOT_STARTABLE') {
  await recordNotStartable()
  p7Result = 'NOT_STARTABLE'
  log('P7 NOT_STARTABLE: no run target — recorded (route Product). Not booting.')
} else if (verdict === 'ENV_NOT_READY') {
  // a used substrate is down — transient. Don't boot; the operator brings the env up and re-runs.
  p7Result = 'ENV_NOT_READY'
  log('P7 ENV_NOT_READY: env substrate down (transient) — bring the env up and re-run. Not booting.')
} else if (!BOOT_SMOKE) {
  // READY_TO_SMOKE but the execution leg is deferred (the substrate-gated knob).
  p7Result = 'READY_NOT_RUN'
  log('P7 READY_TO_SMOKE — bootSmoke disabled (readiness leg only; the live boot is the substrate-gated execution leg). Not booting.')
} else {
  // READY_TO_SMOKE + execution enabled → live boot smoke (capture-don't-fix). SUBSTRATE-GATED:
  // a real grade needs a pilot dev env; the smoke runner only PARSES this, never executes it.
  smoke = await agent(
    `Execute the runtime smoke per this plan (capture-don't-fix — SURFACE a failed start, do NOT remediate; fixing belongs to a P5/P6 re-run).\n` +
    `Plan: ${JSON.stringify(plan || { command: runTarget && runTarget.command })}\n` +
    `1) Boot the app with its run command in the background. 2) Wait up to the boot window. 3) Observe the success signals (process stays up, no fatal on startup, the server reports listening / a first request is not a 500). ` +
    `4) If it FAILS to start, diagnose against the failure_classes — especially env-not-loaded (a 500 because runtime config / .env never loaded: the RUN 01 root cause that 223 green tests missed). 5) Stop the booted process.\n` +
    `Return result (STARTS | FAILS_TO_START | INCONCLUSIVE) + started + failure_class (a plan id or null) + diagnosis + observed. Do NOT edit code, do NOT commit.`,
    { schema: SMOKE_SCHEMA, phase: 'Smoke', label: 'boot-smoke' },
  )
  p7Result = (smoke && smoke.result) || 'INCONCLUSIVE'
  log(`P7 boot smoke: ${p7Result}${smoke && smoke.failure_class ? ` (${smoke.failure_class})` : ''}`)
}

// ---- Phase 3: report — disclose ready/blocked/started + caveats ------------
phase('Report')
// A green boot over a deferred stand-in or a non-GO impl is NOT a clean prod-ready signal —
// the disclosures (mock-only boot, non-GO P6, DEGRADED env) ride with the result, never dropped.
if (disclosures.length) log(`P7 disclosures (green boot ≠ proof): ${disclosures.join(' | ')}`)

return {
  feature: FEATURE || null,
  verdict,                          // the readiness verdict (READY_TO_SMOKE | BLOCKED_ON_CAPABILITY | ENV_NOT_READY | NOT_STARTABLE)
  p7_result: p7Result,              // STARTS | FAILS_TO_START | INCONCLUSIVE | BLOCKED | NOT_STARTABLE | ENV_NOT_READY | READY_NOT_RUN
  smoke_attemptable: verdict === 'READY_TO_SMOKE',
  capabilities_unknown: capsUnknown, // §6 probe could not resolve the feature/manifest — readiness assessed without capability disposition (disclosed in `disclosures`)
  run_target: runTarget,
  smoke,                            // the boot result (null unless a live smoke ran)
  requests,                         // §6 capability-requests emitted on a BLOCK (routes + OD7 await)
  disclosures,                      // mock-only boot / non-GO / DEGRADED caveats — carried, never dropped
  readiness: envReadiness,          // READY | DEGRADED | ENV_NOT_READY | unknown (orthogonal to the verdict)
}
