export const meta = {
  name: 'deploy-to-stage',
  description: 'Orchestrator process E.B — the staging deploy cell of the feature-production line, run AFTER the P7 runtime gate PASSes. Preflight (env-readiness + a DETERMINISTIC manifest read via deploy-manifest.cjs + an equipment-fitness check + clean build/test + a cheap pre-flip runtime-readiness re-probe) → the §3.2 autonomy-policy resolver GATE (the last line before any mutation; STOP unless it returns auto) → Deploy (bootstrap the scene — expand deploy_root, make releases/ + shared/{.env,logs,uploads}, lay out and install releases/<ts>, materialise the systemd units — then run the manifest step-list: codegen (when prisma-equipped), build, migrate, atomically flip `current`, restart the units — VM-gated) → Healthcheck (GET /health, diagnosed against the P7 5-class failure taxonomy). Two-axis result (DEPLOYED | DEPLOY_FAILED | BLOCKED) × readiness (READY | DEGRADED | ENV_NOT_READY), with a uniform audit trail on every arm. Closes the "P7 PASS = done" gap into "P7 PASS → deploy".',
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
 * ⚠ THE THIRD AXIS — CONTRACT TRUST (DEC-DEV-0201; the first live deploy-run's defect). readiness and
 * trust are DIFFERENT questions, and this process used to collapse them:
 *
 *   readiness — CAN we deploy?    substrate up? manifest present, parseable, carrying a step-list?
 *   contract  — WHO decides?      has any live run ever verified this capability contract (CNT status)?
 *
 * E.A MUST ship the CNT `draft` (it may not claim `active` before a live verify). E.B refused to deploy
 * anything not `active`, calling it ENV_NOT_READY. But the live verify can only come FROM a deploy ⇒ the
 * first deploy was IMPOSSIBLE IN PRINCIPLE, and `disposition` in the live run.json was `null`: the
 * preflight short-circuited before the §3.2 resolver was ever called. ENV_NOT_READY was also simply
 * FALSE — the equipment was on disk (254 lines, parsed, full step-list). What was missing was a HUMAN.
 *
 *   present=false (absent / unparseable / no step-list) → ENV_NOT_READY. Still true, still a block.
 *   present=true + status=draft                          → readiness UNTOUCHED. The draft rides to the
 *                                                          resolver as --contract-status (auto → human-gate).
 *
 * A missing capability is a BLOCK; a missing human is a GATE. And note WHY the gate is load-bearing:
 * without it, unblocking the preflight would have handed L3×staging a silent `auto` first deploy on a
 * contract nobody had ever verified. The block was accidentally doing the gate's job — badly.
 *
 * ⚠ THE SECOND LIVE RUN'S THREE DEFECTS (DEC-DEV-0203). All three were invisible repo-side — `verify`
 * was green, the units passed, and the process was structurally perfect. They only exist on substrate.
 *
 * FIND-B (blocker) — E.A WROTE THE RECIPE AND NOBODY BUILT THE KITCHEN. The manifest declared
 *   `deploy_root: ~/deploy/…`, a releases/<ts> + `current` + shared/{.env,logs,uploads} layout, and
 *   three systemd unit templates. This process materialised NONE of it: it contained no `deploy_root`,
 *   no `homedir`, no `expand` — the `~` was never expanded, `~/deploy/` was never created, no release
 *   dir was ever laid out, `shared/.env` (where `migrate` reads DATABASE_URL) never existed, and no
 *   unit was ever installed. THE FIRST DEPLOY WAS IMPOSSIBLE IN PRINCIPLE — structurally the same
 *   defect as the 0201 draft-contract deadlock: two correct halves with a chasm between them. The
 *   Deploy phase now BOOTSTRAPS THE SCENE (idempotently) before executing the step-list.
 *
 *   …and pulling that thread found the SECOND half of the same defect: the unit templates are
 *   parameterized by `{{RELEASE_DIR}}` — a CONCRETE releases/<ts>. A systemd unit pinned to one
 *   release is DEAF TO THE FLIP: `current` moves, the unit does not, `systemctl restart` brings the
 *   OLD release back up — and the healthcheck PASSES, because the old release is still serving on the
 *   same port. The run would report DEPLOYED having shipped nothing, and that false green is exactly
 *   the `contract_evidence` that flips a never-verified draft CNT to `active`. A false DEPLOYED is the
 *   worst thing this process can emit. So a release-pinned unit is a BLOCKING DEFECT (ENV_NOT_READY:
 *   the capability is mis-equipped ⇒ we could not PREPARE a correct deploy). The units must reference
 *   `current` ({{CURRENT_LINK}}) — then flip + restart IS the deploy, and the flip backwards IS the
 *   rollback (E.C). The FIX IS IN THE EQUIPMENT (skills/integrator/deployment-provisioning.md §1), not
 *   here: §8.3 — the Orchestrator executes equipment, it does not silently rewrite an Integrator
 *   template to make a broken deploy look green.
 *
 * FIND-A (high) — THE READINESS GATE STOOD ON A STOCHASTIC PARSE. `present`/`status`/`steps` came from
 *   a sonnet subagent. The SAME unchanged file parsed as a full 4-step list in one run and as
 *   `step-list=MISSING` 18 minutes later (and once as the self-contradictory present:true + steps:[]).
 *   "Does this file carry a step-list" is a deterministic fact about bytes. It is now read by
 *   deploy-manifest.cjs through the same CLI-seam-plus-relay shape the §3.2 resolver already uses —
 *   the agent transports, it does not judge.
 *
 * FIND-D (medium) — A FAILED DEPLOY HAD A THINNER TRAIL THAN A BLOCKED ONE. The DEPLOY_FAILED run.json
 *   carried only `result` + `readiness`; `disposition: auto` had to be dug out of the transcript. That
 *   is backwards — DEPLOY_FAILED is when the trail matters MOST, because a mutation may already have
 *   happened. Every arm now returns the same key set (a wiring test enforces it). The other half of
 *   that fix is in run-ledger.cjs: `summarizeResult` was projecting the return DOWN to those two
 *   scalars, so richer arms alone would have changed nothing that reaches run.json.
 *
 * ⚠ THE THIRD LIVE RUN'S TWO DEFECTS (DEC-DEV-0205, run kxe0ls — the first deploy to get PAST the
 * scene bootstrap, dying inside the fresh release). Both are EQUIPMENT defects, both now
 * blocking_defects in deploy-manifest.cjs, same remedy as FIND-B (/integrator:provision, §8.3):
 *
 * FIND-C1 — NO PRISMA CODEGEN STEP. The release installs a CLEAN per-release node_modules
 *   (`pnpm install --frozen-lockfile` inside releases/<ts> — the rollback-independence decision),
 *   where the Prisma client has never been generated: `pnpm -r build` fails deterministically
 *   (packages/db: TS2305 — '@prisma/client' has no exported member 'PrismaClient'). The dev
 *   checkout hid it for months (its client was generated historically). The manifest must carry a
 *   codegen step BEFORE build — `manifest-missing-prisma-codegen` blocks a prisma manifest without one.
 *
 * FIND-C2 — BARE ExecStart. The web unit shipped `ExecStart=pnpm --filter @app/web start`; systemd
 *   has NO user PATH (nvm / corepack / ~/.local/share/pnpm are invisible) — the unit dies at exec
 *   (203/EXEC) before serving a request. Every ExecStart-family directive (ExecStart / ExecStartPre /
 *   ExecStartPost) must start with an absolute path or a {{…}} placeholder scene-bootstrap
 *   materialises ({{NODE_BIN}} → `command -v node`, {{PNPM_BIN}} → `command -v pnpm`) —
 *   `unit-execstart-bare-command` blocks a bare first token.
 *
 * CAPTURE-DON'T-FIX (D-5): the scene + deploy + healthcheck agents SURFACE a failed bootstrap / a
 * failed flip / a post-flip unhealthy boot (diagnosed against the P7 taxonomy
 * runtime-readiness.cjs::smokePlan.failure_classes: env-not-loaded / missing-migration / port-in-use /
 * missing-runtime-secret / dependency-not-up) — they do NOT remediate. Fixing is a P5/P6 re-drive;
 * recovery is E.C rollback. And nothing is ever FABRICATED to get past a gap: no invented .env, no
 * invented port, no invented step-list.
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
const MANIFEST_LIB = A.manifestLib || '.claude/orchestrator/lib/deploy-manifest.cjs'  // DEC-DEV-0203: DETERMINISTIC manifest read + scene resolve (FIND-A)
// The checkout the release is BUILT FROM. The deploy is a LOCAL op inside the VM (D-1), so this is
// the pilot's own working tree; the scene (deploy_root) is a SEPARATE tree the manifest declares.
const SOURCE_ROOT = A.sourceRoot || '.'
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs'          // DEC-DEV-0092: substrate readiness backbone
const RUNTIME_PROBE = A.runtimeProbe || '.claude/orchestrator/lib/runtime-readiness.cjs'  // DEC-DEV-0120: P7 readiness leg + smokePlan failure taxonomy
const P6_VERDICT = A.p6Verdict || ''                            // optional: the prior P6 GO (informational — a deploy over a non-GO is disclosed)
const P7_VERDICT = A.p7Verdict || ''                            // optional: the prior P7 verdict (fed into the pre-flip re-probe)
const AUTONOMY_OVERRIDE = A.autonomyOverride || null            // the forwarded --autonomy flag (owner approval RAISES the level → resolver reads auto)
const AUTONOMY_POLICY_CFG = A.autonomyPolicy || null            // optional inline policy slice (default_level / process_overrides)
const VALIDATION = A.validationCommands || {}                   // {build, test} if known; else discovered from the manifest / repo
// DEC-DEV-0201 — the owner's EXPLICIT sanction of a first deploy on a `draft` (never-live-verified)
// capability contract. Absent ⇒ a draft contract human-gates the deploy (it does NOT block it). This flag
// is the human-in-the-loop: without a human act, `auto` on an unverified contract never happens.
const ACCEPT_DRAFT = A.acceptDraftContract === true
// The ledger RUN_ID, stamped by the dispatcher's run-ledger bracket and forwarded in (run.md). The harness
// may not read a clock or the FS, so this is passed, never derived. It is the EVIDENCE HANDLE: a DEPLOYED
// run is the live-verify a draft CNT was waiting for, and the Integrator needs a run to point the flip at.
const RUN_ID = A.runId || ''

// ---- schemas ---------------------------------------------------------------
const ENV_READINESS_SCHEMA = {
  type: 'object',
  required: ['readiness'],
  properties: {
    readiness: { type: 'string', enum: ['READY', 'DEGRADED', 'ENV_NOT_READY'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
}

// The parsed deploy-manifest (deployment-provisioning.md §2/§4). CRLF-normalized before parse (this
// process is a CNT consumer — see below).
//
// `present` and `status` answer DIFFERENT questions and must NEVER be collapsed (DEC-DEV-0201):
//   present=false — absent / unparseable / no executable step-list ⇒ the capability is not provisioned
//                   ⇒ readiness=ENV_NOT_READY (could not PREPARE the deploy). Never a fabricated step-list.
//   status        — the capability contract's TRUST state (draft = no live run has verified it). It does
//                   NOT touch readiness; it rides to the §3.2 resolver as --contract-status (auto →
//                   human-gate). A draft manifest with a full step-list is present:true, status:'draft'.
const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['present'],
  properties: {
    present: { type: 'boolean' },                              // FACT: file exists + parseable + carries an executable step-list
    status: { type: ['string', 'null'] },                      // TRUST: draft | active | stub — from the CNT SSOT, manifest copy as fallback (DEC-DEV-0215). NOT an input to `present`
    contract_status_source: { type: ['string', 'null'] },      // provenance of `status`: cnt | manifest | null (DEC-DEV-0215) — the lib names WHERE trust was read
    contract: { type: ['string', 'null'] },                    // the CNT id the manifest names (e.g. "CNT-005"), or null — never invented
    steps: { type: 'array', items: { type: 'object' } },       // ordered build → migrate → flip → (re)start
    healthcheck: { type: ['object', 'null'] },                 // { url, boot_window_sec, expect, failure_taxonomy }
    migrate: { type: ['object', 'null'] },                     // prisma migrate deploy step (conditional_on packages/db)
    release_layout: { type: ['object', 'null'] },              // releases/<ts> + current symlink + shared/
    // ---- DEC-DEV-0203 (additive — no field renamed, DEC-DEV-0012) ----------------------------
    deploy_root: { type: ['object', 'null'] },                 // { declared: "~/deploy/x", expanded: "/home/u/deploy/x" } — the ~ nothing expanded
    scene: { type: ['object', 'null'] },                       // every ABSOLUTE path the Deploy phase materialises (releases/ · current · shared/)
    units: { type: 'array', items: { type: 'object' } },       // [{ name, template, template_found, release_pinned, placeholders }]
    unit_templates: {},                                        // the manifest's own declaration, verbatim (map | list | null)
    blocking_defects: { type: 'array', items: { type: 'string' } },  // equipment present but UNABLE to deploy correctly (FIND-B)
    capability: { type: ['string', 'null'] },
    disclosures: { type: 'array', items: { type: 'string' } },
  },
}

// The SCENE bootstrap (DEC-DEV-0203 / FIND-B). E.A wrote the recipe; NOBODY built the kitchen —
// `~/deploy/…` never existed, `releases/<ts>` was never made, `shared/.env` (where `migrate` reads
// DATABASE_URL) was never created, and the systemd units were never materialised. The first deploy
// was impossible in principle. This is the phase that makes the target REAL — idempotently.
const SCENE_SCHEMA = {
  type: 'object',
  required: ['ready'],
  properties: {
    ready: { type: 'boolean' },                                // the scene exists and the release is laid out — the step-list may now run
    blocker: { type: ['string', 'null'] },                     // what stopped it, in words
    // WHICH AXIS a scene failure lands on. `env-not-ready` = a substrate/provisioning gap we could
    // not fill honestly (no .env anywhere ⇒ we will NOT fabricate secrets; no sudo/systemd) ⇒
    // BLOCKED. Anything else = the deploy machinery genuinely failed ⇒ DEPLOY_FAILED, nothing flipped.
    blocker_class: { type: ['string', 'null'], enum: ['env-not-ready', 'deploy-failed', null] },
    release: { type: ['string', 'null'] },                     // the <ts> id stamped on the TARGET (the harness may not read a clock)
    release_dir: { type: ['string', 'null'] },                 // …and its absolute path
    env_source: { type: ['string', 'null'] },                  // 'shared' (already provisioned) | 'project-root' (seeded, dev-tier) | null
    created: { type: 'array', items: { type: 'string' } },     // what this run had to make…
    reused: { type: 'array', items: { type: 'string' } },      // …and what was already there (the idempotency evidence)
    units_installed: { type: 'array', items: { type: 'string' } },
    diagnosis: { type: 'string' },
    observed: { type: 'string' },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: {
    passed: { type: 'boolean' },                               // clean build AND suite both green (D-6)
    // DEC-DEV-0206 (additive — NO field renamed, DEC-DEV-0012): a POSITIVE affirmation that the gate
    // reached a FINAL exit code for the build AND every workspace of the suite. `false` ⇒ the
    // MEASUREMENT did not finish (a Bash-timeout kill, an abandoned background poll, an "UNKNOWN"): the
    // gate could not establish a verdict. That is a "could not judge" (→ BLOCKED, re-run), NOT a code
    // RED (→ DEPLOY_FAILED, escalate) — collapsing the two is the DEC-DEV-0201 axis error one layer
    // down (measurement-incomplete vs code-failed). ABSENT ⇒ treated as completed (back-compat: a RED
    // from a relay that predates this field routes to DEPLOY_FAILED exactly as before). Only matters
    // when `passed` is false — a green build is a completed measurement by construction.
    suite_completed: { type: 'boolean' },
    build: { type: 'string' },
    suite: { type: 'string' },
    per_workspace: { type: 'array', items: { type: 'object' } },  // [{ workspace, exit, passed, failed, duration_s }] — durable per-ws evidence + growth-headroom signal
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

// The §3.2 disposition envelope relayed from the autonomy-policy CLI seam (shape = resolve()'s return,
// plus whatever guard extensions the lib attached — `contract` comes from applyContractGuard).
const AUTONOMY_SCHEMA = {
  type: 'object',
  required: ['disposition'],
  properties: {
    disposition: { type: 'string' },                           // auto | consilium-gate | human-gate | block
    level_applied: { type: ['string', 'null'] },
    floor_hit: { type: 'boolean' },
    contract: { type: ['object', 'null'] },                    // { status, accepted_by_owner } — the contract-guard's record
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
  `🚫 READ-ONLY — CAPTURE-DON'T-FIX (FIND-E2): you MEASURE the substrate, you never REPAIR it. Do NOT start, restart, create or install ANYTHING (no \`docker start|run|compose up\`, no \`systemctl start\`, no package install, no .env edit) to make a down substrate look up — a substrate that is down is EVIDENCE, and reporting ENV_NOT_READY IS the whole job. Just report whether what the target uses (Postgres/Redis/docker) is up.`,
  { model: 'sonnet', schema: ENV_READINESS_SCHEMA, phase: 'Preflight', label: 'env-readiness' },   // MDP: env-probe JSON relay (mechanical transport)
)
let readiness = (envProbe && envProbe.readiness) || 'DEGRADED'   // unknown/absent → conservatively DEGRADED (never silently READY)
// CARRY the WHY of the readiness axis, don't only log it. THIS is the axis applyReadinessGuard gates the
// deploy on (DEGRADED → human-gate, ENV_NOT_READY → block): a run.json that states `readiness` but not
// its reasons makes the DEPLOY GATE UNAUDITABLE — the live P7 run had to hand-probe the VM to learn the
// DEGRADED was a missing pg_isready/redis-cli, not an outage. Every downgrade below appends its reason.
const readinessReasons = [...((envProbe && envProbe.reasons) || [])]
log(`pre-flight env-readiness: ${readiness}${readinessReasons.length ? ` — ${readinessReasons.join('; ')}` : ''}`)

// (a.1) EARLY SHORT-CIRCUIT (DEC-DEV-0211 / FIND-E1) — an ENV_NOT_READY straight from the env-readiness
// probe is "the substrate is DOWN; we cannot deploy AT ALL". It must BLOCK right HERE, BEFORE manifest-
// parse / build-test / the pre-flip re-probe ever run. Live run lah60w: `mft-redis` was stopped, the probe
// CORRECTLY returned ENV_NOT_READY — but the run did NOT short-circuit, so build-test ran anyway, its agent
// hit the Redis-down suite and "helpfully" SELF-HEALED the substrate (`docker start mft-redis`), then re-ran
// the suite green. That is the readiness gate being erased one layer down — the exact disease as a deploy
// that mutates without asking the §3.2 resolver, now at the STAGE level. A down substrate is not something
// a later stage can judge; asking it to try is precisely what invites the remediation (a stage running a
// suite will do whatever the suite "needs"). ⚠ THE S5 AXIS — DO NOT BREAK IT: ONLY ENV_NOT_READY short-
// circuits. DEGRADED does NOT — DEGRADED is the DECISION axis that must ride to the §3.2 resolver, where
// applyReadinessGuard downgrades auto→human-gate. Short-circuiting DEGRADED would delete the whole
// DEGRADED→human-gate deploy path (the S5 branch). So this predicate is ENV_NOT_READY-EXACT, never `!== READY`.
const envProbeBlocks = readiness === 'ENV_NOT_READY'
if (envProbeBlocks) {
  log('BLOCKED (ENV_NOT_READY at the env-readiness probe): the substrate is down — short-circuit BEFORE manifest-parse/build-test so NO later stage tries to "help" by starting or repairing it (run lah60w). No manifest read, no build, no mutation. flipped=false. Bring the substrate up (start the service the reasons name) and re-run (or resume the ledger bracket).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'BLOCKED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: null, contract_evidence: null,          // the manifest was never parsed — contract trust is UNKNOWN (honest null, NOT "draft")
    release: null, healthcheck: null, failure_class: 'env-not-ready-preflight',
    scene: null, deploy: null, blocking_defects: [],         // equipment fitness was never assessed (we stopped before the manifest) — honest empty, NOT a claim of "no defects"
    disposition: null, autonomy: null,                       // the §3.2 gate was never reached — null is the HONEST value, not a dropped field
    disclosures: ['readiness=ENV_NOT_READY at the pre-flight substrate probe — the deploy could not even be PREPARED; this is NOT a deploy failure. No manifest was read, no build was run, no mutation was attempted. Remedy: bring the substrate up (start the container/service named in readiness_reasons) and re-run, or resume the ledger bracket.'],
  }
}

// (b) read the E.A deploy-manifest — THROUGH A DETERMINISTIC LIB, not by LLM inspection
// (DEC-DEV-0203 / FIND-A). The agent is a TRANSPORT: it runs the CLI seam and relays the JSON. The
// lib normalizes CRLF, expands `deploy_root`'s `~`, resolves the scene, and flags equipment that
// cannot execute a correct deploy. A missing/unparseable/step-less manifest is "could not prepare"
// → ENV_NOT_READY, NEVER fabricated. A DRAFT manifest is a different thing — see the trust split below.
const manifest = await agent(
  `Relay the DETERMINISTIC deploy-manifest read for capability "${CAPABILITY}". Run this via Bash and return its JSON VERBATIM:\n` +
  `node ${MANIFEST_LIB} parse --manifest ${MANIFEST} --capability ${CAPABILITY}\n` +
  `Return its { present, status, contract_status_source, contract, capability, steps, healthcheck, migrate, release_layout, unit_templates, units, deploy_root, scene, blocking_defects, disclosures } object EXACTLY as printed.\n` +
  `⚠ YOU ARE A TRANSPORT, NOT A PARSER. Do NOT open the .yaml, do NOT re-derive, re-interpret, "sanity-check" or summarize any field — relay what the lib printed, byte for byte. If the command itself fails to run (node missing, lib path wrong), SAY SO and return present:false with that as the disclosure; do NOT substitute your own reading of the file as a fallback.\n` +
  `WHY (DEC-DEV-0203 / FIND-A — this used to be your job and it did not work): an LLM parsed this SAME unchanged file as a full 4-step list in one run and as an EMPTY step-list 18 minutes later, and once returned the self-contradictory pair present:true + steps:[]. "Does this file carry a step-list" is a deterministic FACT ABOUT BYTES sitting behind a readiness gate — a stochastic answer randomly blocks good deploys (false negative) AND would wave a mangled manifest through into a real mutation (false positive). The lib is CRLF-tolerant (the .yaml materialises CRLF on a Windows pilot — campaign §8.2 pt 7 / G36, the capability-probe.cjs extractManifest pattern), it FAILS LOUD rather than fabricating a step-list, and it keeps \`present\` (FACT) strictly independent of \`status\` (TRUST) — collapsing those made the first deploy impossible in principle (DEC-DEV-0201).\n` +
  `Do NOT run any deploy step; do NOT commit. READ-ONLY on \`.claude/integrator/**\` — never edit a manifest, a unit template, or a CNT contract (§8.3: that zone is the Integrator's).`,
  { model: 'sonnet', schema: MANIFEST_SCHEMA, phase: 'Preflight', label: 'manifest-parse' },   // MDP: pure JSON transport of a deterministic lib (the PARSE is code now — FIND-A)
)
// READINESS leg — FACT only. `status` is deliberately absent from this expression (DEC-DEV-0201): the
// equipment being on disk and executable is what "could we prepare the deploy" means.
const hasSteps = !!(manifest && Array.isArray(manifest.steps) && manifest.steps.length > 0)
const manifestOk = !!(manifest && manifest.present && hasSteps)
if (!manifestOk) {
  readiness = worstReadiness(readiness, 'ENV_NOT_READY')   // capability not provisioned → could not PREPARE the deploy
  const why = `deploy-manifest for "${CAPABILITY}" not usable (present=${manifest && manifest.present}, step-list=${hasSteps ? 'present' : 'MISSING'}) at ${MANIFEST} → ENV_NOT_READY; provision it via /integrator:provision ${CAPABILITY}`
  readinessReasons.push(why)   // a readiness downgrade that is NOT the env probe's — record it or the gate reads as an unexplained block
  log(`manifest not usable → readiness ENV_NOT_READY — ${why}`)
}

// ---- EQUIPMENT-FITNESS leg (DEC-DEV-0203 / FIND-B) — the THIRD thing that can be wrong, and it is
// neither of the other two. readiness asks CAN we deploy (substrate up? equipment on disk?); the
// contract asks WHO decides (has any live run verified this?). This asks: WOULD EXECUTING THIS
// EQUIPMENT ACTUALLY DEPLOY ANYTHING? The manifest can be present, parseable, fully step-listed —
// and still be unable to ship, because E.A parameterized the systemd units by {{RELEASE_DIR}} (a
// CONCRETE releases/<ts>). Such a unit is DEAF TO THE FLIP: `current` moves, the service does not,
// `systemctl restart` brings the OLD release back up — and the healthcheck then PASSES, because the
// old release is still serving on the same port. The run would return DEPLOYED having shipped
// NOTHING, and that false green is precisely the `contract_evidence` that flips a never-verified
// draft CNT to `active`. A false DEPLOYED is the worst thing this process can emit — worse than any
// block — so mis-equipped ⇒ ENV_NOT_READY (we could not PREPARE a correct deploy) ⇒ BLOCKED, nothing
// flipped. This is NOT a 0201-style deadlock: the remedy is /integrator:provision, which needs no
// deploy to run. And it is not ours to patch — the Orchestrator EXECUTES equipment, it does not
// silently rewrite an Integrator template to make a broken deploy look green (§8.3).
const blockingDefects = (manifest && Array.isArray(manifest.blocking_defects) ? manifest.blocking_defects : [])
if (manifestOk && blockingDefects.length) {
  readiness = worstReadiness(readiness, 'ENV_NOT_READY')
  const pinned = ((manifest && manifest.units) || []).filter((u) => u && u.release_pinned).map((u) => `${u.name} (${u.template})`)
  const bare = ((manifest && manifest.units) || []).filter((u) => u && Array.isArray(u.execstart_bare) && u.execstart_bare.length).map((u) => `${u.name} (${u.execstart_bare.join('; ')})`)
  const why = `deploy-capability "${CAPABILITY}" is MIS-EQUIPPED — blocking defect(s): ${blockingDefects.join(', ')}${pinned.length ? `; release-pinned unit(s): ${pinned.join(', ')}` : ''}${bare.length ? `; bare-ExecStart unit(s): ${bare.join(', ')}` : ''}. `
    + `This equipment cannot execute a correct deploy (deaf-to-flip unit ⇒ a false DEPLOYED that launders the draft contract; missing prisma codegen ⇒ deterministic TS2305 in the clean per-release node_modules; bare ExecStart ⇒ 203/EXEC — systemd has no user PATH). `
    + `→ ENV_NOT_READY. Fix the EQUIPMENT: re-run /integrator:provision ${CAPABILITY} (skills/integrator/deployment-provisioning.md §1/§3). §8.3: the Orchestrator does not rewrite Integrator templates.`
  readinessReasons.push(why)
  log(`equipment NOT fit to deploy → readiness ENV_NOT_READY — ${why}`)
}

// TRUST leg — the capability-contract axis. NOT a readiness downgrade: the equipment is here, the
// substrate is whatever the probe said; the only open question is whether a HUMAN has ever sanctioned
// deploying through this never-live-verified contract. It rides to the §3.2 resolver (--contract-status),
// which turns `auto` into `human-gate` — a gate the owner can pass, not a wall that cannot be passed.
// An absent/unknown status on a present manifest ⇒ conservatively `draft`: an undeclared contract must
// never WIDEN autonomy (same rail as the resolver's own "absent → conservative" inputs).
// The status the lib resolved is CNT-SSOT-first (manifest copy as fallback) — DEC-DEV-0215. We read
// it verbatim and carry its PROVENANCE (contract_status_source: cnt|manifest) into the trail, so the
// gate decision is auditable: the E5-B defect was a live-flipped CNT `active` that a stale manifest
// `draft` masked, and the run.json must show WHERE the trust came from.
const contractStatus = manifestOk
  ? (((manifest && manifest.status) ? String(manifest.status).trim().toLowerCase() : '') || 'draft')
  : null
const contractStatusSource = (manifest && manifest.contract_status_source) || null
const contractDraft = !!(contractStatus && contractStatus !== 'active')
if (contractDraft) {
  readinessReasons.push(
    `capability contract for "${CAPABILITY}" is status=${contractStatus}${contractStatusSource ? ` (source: ${contractStatusSource})` : ''} (no live run has verified it) → readiness UNCHANGED (${readiness}). ` +
    `This is a TRUST axis (who decides: auto or the owner), NOT a readiness axis (can we deploy at all) — the deploy-setup is present, parseable and carries a step-list. ` +
    `It rides to the §3.2 resolver as --contract-status ${contractStatus} (auto → human-gate), it does NOT block the deploy.`)
  log(`capability contract: ${contractStatus}${contractStatusSource ? ` (from ${contractStatusSource})` : ''} → §3.2 contract-guard (auto → human-gate)${ACCEPT_DRAFT ? ' — OVERRIDDEN: the owner passed acceptDraftContract (explicit sanction of a first deploy on an unverified contract)' : ''}. Readiness is untouched.`)
}

// (c) clean build + full suite (D-6 — a deploy ships only green code). A RED build/test over a READY
// substrate is a real DEPLOY_FAILED (code regression), NOT an env artifact → route escalate, nothing flipped.
const build = await agent(
  `Clean-build and run the FULL test suite for the ${ENV_TIER} release (D-6 — the LAST code gate before a mutation). This gate has ONE job: establish a TRUE verdict, and NEVER confuse "the code is RED" with "I could not finish measuring" (DEC-DEV-0206).\n` +
  `\n` +
  `WAIT-STRUCTURE — this is the CONTRACT, not advice. A stochastic wait strategy is exactly what produced a FALSE DEPLOY_FAILED on run l1fi9c: a 5-min Bash timeout KILLED a ~7.5-min suite, the retry was thrown to the background and abandoned mid-poll, and the gate returned passed:false on a suite that finished 100% GREEN six minutes later. A false negative here BURNS THE RUN to escalation over code that was fine.\n` +
  `1) BUILD — ONE BLOCKING Bash call, and set the Bash tool \`timeout\` parameter to 600000 (10 min, the tool ceiling) EXPLICITLY. ${JSON.stringify(VALIDATION) !== '{}' && VALIDATION.build ? `Command: ${JSON.stringify(VALIDATION.build)}.` : 'Command: \`pnpm -r build\` (or the build the manifest step-list declares).'} Wait for its REAL exit code in-line. Do NOT infer green.\n` +
  `2) SUITE — run it PER-WORKSPACE, SEQUENTIALLY: each workspace is a SEPARATE BLOCKING Bash call with the Bash tool \`timeout\` set to 600000 EXPLICITLY. ${JSON.stringify(VALIDATION) !== '{}' && VALIDATION.test ? `Base test command: ${JSON.stringify(VALIDATION.test)} — run it once per workspace.` : 'For each workspace run \`pnpm --filter <workspace> test\`.'} Enumerate the workspaces FIRST from \`pnpm-workspace.yaml\` (its \`packages:\` globs); if it is absent, from the actual package dirs (apps/*, packages/*). Run one workspace, WAIT for its exit code, record it, THEN start the next. Per-workspace calls are the DURABLE fix, not a nicety: the whole suite is already ~7.5 min and the tool ceiling is 10 min, so a single \`pnpm -r test\` call will one day exceed the ceiling and break this gate exactly as l1fi9c broke.\n` +
  `\n` +
  `HARD PROHIBITIONS:\n` +
  `- NEVER launch the build or a test with \`run_in_background: true\`. A backgrounded suite whose completion you then poll-and-abandon IS the l1fi9c failure. Every build/test call is BLOCKING and you wait for its exit code in-line.\n` +
  `- NEVER return a verdict for a workspace before you hold its FINAL exit code. "It was passing when I last looked" is not an exit code.\n` +
  `- NEVER collapse an UNRESOLVED measurement into passed:false as if it were a code RED. If the build or ANY workspace did NOT reach a final exit code (a kill, a genuine 10-min timeout, an abandoned run — anything that leaves the result UNKNOWN), you MUST set suite_completed:false and name the unresolved step in failures[]. passed:false + suite_completed:false means "the gate could not judge" — that routes to a RE-RUN, not an escalation, and getting it wrong burns a good deploy.\n` +
  `\n` +
  `AGGREGATION:\n` +
  `- passed = (build exit 0) AND (EVERY workspace test exit 0). One non-zero exit ⇒ passed:false.\n` +
  `- suite_completed = the build AND every workspace each reached a FINAL exit code (whether 0 or not). true ⇒ this run is a real verdict (a clean green or a genuine RED); false ⇒ the measurement did not finish and the verdict is UNKNOWN.\n` +
  `- per_workspace[] = one { workspace, exit, passed, failed, duration_s } per workspace you ran (take passed/failed from the reporter's summary line). List every failing test verbatim in failures[].\n` +
  `\n` +
  `🚫 SUBSTRATE IS READ-ONLY — CAPTURE-DON'T-FIX (DEC-DEV-0211 / FIND-E2). You MEASURE the code; you have NO mandate to mutate the ENVIRONMENT. These command classes are FORBIDDEN even when they would turn a RED suite green:\n` +
  `- starting/creating/repairing services or containers: \`docker start|restart|run|compose up\`, \`podman …\`, \`systemctl start|restart\` of a backing service, \`service … start\`, \`pg_ctl\` / \`redis-server\` / \`brew services\`;\n` +
  `- installing or changing packages/toolchains: \`apt|apk|yum|brew install\`, \`npm i -g\`, editing a lockfile;\n` +
  `- editing the environment: writing/patching \`.env\`, exporting secrets, opening ports, editing a service config.\n` +
  `AN ENVIRONMENT FAILURE IS EVIDENCE, NOT AN OBSTACLE. A workspace whose tests fail because Postgres/Redis/a dependency is DOWN is a RECORDED failure — name it in failures[] with the honest cause (e.g. "api: 8 failed — Redis 127.0.0.1:6379 connection refused"). That workspace still reached a final exit code, so it does NOT make the measurement incomplete: suite_completed is about whether you got an exit code (DEC-DEV-0206), and a RED caused by a down dependency is a COMPLETED red — never a reason to start the service. WHY THIS IS HARD-CODED: on run lah60w this exact gate hit a Redis-down suite and ran \`docker start mft-redis\` ("Start redis container required by api test suite"), waited for healthy, and re-ran — silently invalidating the env-readiness gate that runs BEFORE you. Whether the substrate is up is the readiness gate's verdict to make, never yours to erase.\n` +
  `Do NOT deploy, flip, migrate, or commit — this is the build gate only.`,
  { model: 'sonnet', schema: BUILD_SCHEMA, phase: 'Preflight', label: 'build-test' },   // MDP: run build+suite + relay exits (standard/mechanical)
)
const buildPassed = !!(build && build.passed)
// DEC-DEV-0206 — the measurement/verdict split. `suite_completed:false` is the gate saying "I could not
// reach a final exit code" (a kill, a genuine ceiling timeout, an abandoned background poll — the l1fi9c
// false negative). That is a "could not JUDGE" (BLOCKED, re-run), NOT a code RED (DEPLOY_FAILED, escalate)
// — collapsing them is the 0201 axis error one layer down. Only an EXPLICIT false diverts; ABSENT ⇒
// completed (back-compat: a RED from a pre-0206 relay routes to DEPLOY_FAILED bit-for-bit). It matters
// only when the build did NOT pass — a green build is a completed measurement by construction.
const suiteIncomplete = !buildPassed && !!(build && build.suite_completed === false)
const perWorkspace = (build && Array.isArray(build.per_workspace)) ? build.per_workspace : []
const perWsDisclosures = perWorkspace.map((w) => `build/test [${(w && w.workspace) || '?'}]: exit ${w && w.exit}${w && (w.passed != null || w.failed != null) ? ` (${w.passed != null ? `${w.passed} passed` : ''}${w.failed ? `, ${w.failed} failed` : ''})` : ''}${w && w.duration_s != null ? ` in ${w.duration_s}s` : ''}`)
log(`clean build+test: ${buildPassed ? 'GREEN' : (suiteIncomplete ? 'INCOMPLETE — measurement did not finish → re-run, NOT a failure' : 'RED')}${build && build.failures && build.failures.length ? ` — ${build.failures.length} failure(s)` : ''}${perWorkspace.length ? ` [${perWorkspace.length} workspace(s)]` : ''}`)

// (d) pre-flip runtime-readiness RE-PROBE (readiness leg only — NOT a live boot, D-7). Keeps a
// standalone deploy off a NOT_STARTABLE / ENV_NOT_READY target; the forwarded p7Verdict is a hint.
const preflight = await agent(
  `Run the runtime-smoke READINESS leg (deterministic — NOT a live boot; the live boot is the P7 runtime_gate, do NOT duplicate it): ` +
  `\`node ${RUNTIME_PROBE}${FEATURE ? ` --feature ${FEATURE}` : ''} --root .${APP ? ` --app ${APP}` : ''} --env ${readiness}${P7_VERDICT ? ` --p6 ${P7_VERDICT}` : (P6_VERDICT ? ` --p6 ${P6_VERDICT}` : '')}\` via Bash and relay its JSON verbatim (verdict + run_target + disclosures). ` +
  `This is the cheap re-check that the target is still startable (run-target present, env up, §6 boot-caps satisfied) before we deploy. Do NOT boot, provision, or mock — just relay.\n` +
  `🚫 READ-ONLY — CAPTURE-DON'T-FIX (FIND-E2): you MEASURE readiness, you never REPAIR it. Do NOT start, restart, create or install anything to improve the verdict (no \`docker start|run|compose up\`, no \`systemctl start\`, no package install, no .env edit) — a NOT_STARTABLE / ENV_NOT_READY verdict is EVIDENCE, and relaying it honestly IS the whole job.`,
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
  ...(contractDraft && !ACCEPT_DRAFT ? [
    `capability contract "${CAPABILITY}" is ${contractStatus} — the FIRST deploy through a contract no live run has verified is the OWNER's call. This is NOT an ENV_NOT_READY block (the deploy-setup is in place): the §3.2 resolver human-gates it. To proceed, re-invoke with acceptDraftContract:true (explicit owner sanction), or flip the CNT to active after a live verify.`,
  ] : []),
  ...(contractDraft && ACCEPT_DRAFT ? [
    `OWNER SANCTION: acceptDraftContract:true — deploying through a ${contractStatus} capability contract on the owner's explicit authority. The floor is untouched by this (it never was crossable).`,
  ] : []),
]
log(`pre-flip runtime-readiness: ${preVerdict}; readiness axis = ${readiness}`)

// ---- THE AUDIT TRAIL IS UNIFORM ACROSS EVERY ARM (DEC-DEV-0203 / FIND-D) --------------------
// The live DEPLOY_FAILED run.json carried only `result` + `readiness`: no disposition, no flipped,
// no release, no healthcheck, no failure_class, no contract_evidence, no disclosures — `disposition:
// auto` had to be dug out of the TRANSCRIPT. Meanwhile a BLOCKED run had a full nested verdict. That
// is exactly backwards: a DEPLOY_FAILED is the case where the trail matters MOST, because a mutation
// may already have happened. So every `return {…}` below carries the SAME key set — a wiring test
// enforces it, so a future arm cannot quietly ship a thinner one. (The other half of this fix is in
// run-ledger.cjs: `summarizeResult` was projecting the return down to those two scalars, so richer
// arms alone would have changed nothing that reaches run.json.)

// ---- INVARIANT (in code): ENV_NOT_READY ⇒ BLOCKED, flipped=false — a down substrate / un-provisioned
// or MIS-EQUIPPED manifest / not-startable target is "could not prepare or judge", NEVER a
// DEPLOY_FAILED. Decided BEFORE the build-fail branch so a real code failure is not masked, and
// before the resolver so we never even ask to mutate a target we cannot deploy to.
if (readiness === 'ENV_NOT_READY') {
  log('BLOCKED (readiness=ENV_NOT_READY): substrate down / manifest not provisioned or mis-equipped / target not startable — no mutation, flipped=false. Bring the target up, or re-provision the capability, and re-run.')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'BLOCKED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: contractStatus, contract_evidence: null,
    release: null, healthcheck: null, failure_class: null,
    scene: null, deploy: null, blocking_defects: blockingDefects,
    disposition: null, autonomy: null,
    disclosures: disclosures.concat(['readiness=ENV_NOT_READY — the deploy could not be prepared/judged; this is NOT a deploy failure']),
  }
}

// A build/test gate that could NOT complete its MEASUREMENT (a kill, a genuine 10-min timeout, an
// abandoned background poll — the l1fi9c false negative) is a "could not JUDGE", NOT "the code is RED".
// It returns result=BLOCKED (readiness untouched — this is not an env fact) → the ingest maps
// BLOCKED×(READY|DEGRADED) to evt:deploy.gated → runtime_gate_retry (RE-RUN the suite), NEVER
// DEPLOY_FAILED (which means "code failed" → escalate for a P5/P6 re-drive). Mixing the two is the
// DEC-DEV-0201 axis error one layer down: measurement-incomplete vs code-failed demand OPPOSITE
// reactions (re-run vs fix the code), exactly as "can we deploy" vs "who decides" did. Evaluated
// BEFORE the real-RED branch so an UNKNOWN can never masquerade as a regression and burn the run.
// failure_class carries the gate-incident class `test-gate-incomplete` — NOT a fabricated P7 boot-class
// (nothing booted; the taxonomy is reused, never reinvented).
if (suiteIncomplete) {
  log('BLOCKED (test-gate-incomplete): the D-6 build/test gate did not reach a final exit code for every workspace (measurement UNKNOWN, not a code RED) — re-run the suite. A false DEPLOY_FAILED here would burn a good deploy to escalation (run l1fi9c).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'BLOCKED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: contractStatus, contract_evidence: null,
    release: null, healthcheck: null, failure_class: 'test-gate-incomplete',   // gate-incident class, NOT a P7 boot-class (nothing booted)
    scene: null, deploy: null, blocking_defects: blockingDefects,
    disposition: null, autonomy: null,                       // the §3.2 gate was never reached — null is the HONEST value here, not a dropped field
    disclosures: disclosures
      .concat(['test-gate-incomplete: the D-6 suite did not finish measuring (UNKNOWN, not a code RED) → re-run the deploy; this is NOT a DEPLOY_FAILED (a false negative here burns the run — run l1fi9c)'])
      .concat(perWsDisclosures),
  }
}

// A RED build/test over a judged (≠ENV_NOT_READY) substrate is a real DEPLOY_FAILED with NOTHING
// flipped → the charter routes it to escalate (evt:deploy.preflight_failed), not auto-rollback.
if (!buildPassed) {
  log('DEPLOY_FAILED at preflight (build/test RED) — nothing flipped; route to escalate for a P5/P6 re-drive (capture-don\'t-fix).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'DEPLOY_FAILED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: contractStatus, contract_evidence: null,
    release: null, healthcheck: null, failure_class: null,   // no boot happened ⇒ no P7 taxonomy class applies (we do NOT invent one)
    scene: null, deploy: null, blocking_defects: blockingDefects,
    disposition: null, autonomy: null,                       // the gate was never reached — null is the HONEST value here, not a dropped field
    disclosures: disclosures.concat(((build && build.failures) || []).map((x) => `build/test: ${x}`)),
  }
}

// ---- Phase 2: Gate — the §3.2 resolver call. THE heart. After readiness+risk are known, BEFORE any
// mutation. CLI seam via an agent+Bash relay (harness cannot require() the lib). --readiness is what
// makes applyReadinessGuard bite here (the ONLY readiness-aware consultation on the deploy path).
phase('Gate')
// The resolver call as ONE auditable string. Two axes ride it beyond the level matrix: --readiness (CAN
// we? — the ONLY place applyReadinessGuard bites) and --contract-status (WHO decides? — applyContractGuard,
// DEC-DEV-0201). BACKWARD-COMPAT: an absent contractStatus leaves this command byte-for-byte the pre-fix one.
const resolveCmd = `node ${AUTONOMY_LIB} resolve --operation-class deploy_staging --risk ${RISK} --env-tier ${ENV_TIER} --readiness ${readiness}${contractStatus ? ` --contract-status ${contractStatus}` : ''}${ACCEPT_DRAFT ? ' --accept-draft-contract' : ''}${AUTONOMY_POLICY_CFG ? ` --policy '${JSON.stringify(AUTONOMY_POLICY_CFG)}'` : ''}${AUTONOMY_OVERRIDE ? ` --override ${AUTONOMY_OVERRIDE}` : ''}`
const disposition = await agent(
  `Resolve the authoritative autonomy disposition for THIS ${ENV_TIER} deploy (§3.2 ACCEPTANCE — the disposition is CODE; relay the JSON verbatim, do NOT judge or override it):\n` +
  `${resolveCmd}\n` +
  `Return its { disposition, level_applied, floor_hit, contract, why } object exactly. (operation_class deploy_staging is NOT on the floor, so this is L-matrix-driven: L0/L1×staging→human-gate, L2→consilium-gate, L3→auto; a DEGRADED substrate downgrades auto→human-gate, ENV_NOT_READY→block; and a DRAFT capability contract downgrades auto→human-gate — the first deploy through a contract no live run has verified is the owner's call, NOT a block.)`,
  { model: 'sonnet', schema: AUTONOMY_SCHEMA, phase: 'Gate', label: 'autonomy-resolve' },   // MDP: deterministic resolver JSON relay (mechanical transport)
)
// OBEDIENCE RULE (§5): the flip below is reached ONLY on a fresh disposition==='auto' from this call.
// human-gate / consilium-gate / block → STOP: result=BLOCKED, flipped=false, envelope carried for the
// owner. A deploy that mutates without this gate is an E.B FAILURE, even if it "works".
if (!disposition || disposition.disposition !== 'auto') {
  const d = disposition ? disposition.disposition : 'null'
  const escape = contractDraft && !ACCEPT_DRAFT
    ? 'Owner must approve: re-invoke with acceptDraftContract:true (sanction the first deploy on the draft contract) and/or --autonomy L2|L3'
    : 'Owner must approve (re-invoke --autonomy L2|L3)'
  log(`§3.2 GATE: disposition=${d} (not auto${disposition && disposition.floor_hit ? ', floor_hit' : ''}) — STOP. No mutation. flipped=false. ${escape}, or the substrate must recover.`)
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'BLOCKED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: contractStatus, contract_evidence: null,   // gated ⇒ nothing deployed ⇒ no live-evidence for the contract
    release: null, healthcheck: null, failure_class: null,
    scene: null, deploy: null, blocking_defects: blockingDefects,
    disposition, autonomy: disposition,   // payloadPath: autonomy — the envelope rides the evt:deploy.gated PA so the owner sees WHY
    disclosures: disclosures.concat([`deploy gated by autonomy-policy → ${d}${disposition && disposition.floor_hit ? ' (floor)' : ''}: ${(disposition && disposition.why && disposition.why.slice(-1)[0]) || 'see why[]'}`]),
  }
}
log(`§3.2 GATE: disposition=auto (level ${disposition.level_applied}) — proceeding to the mutation.`)

// ---- Phase 3: Deploy (VM-GATED) ============================================================
// Two mutating agents, in order: BOOTSTRAP THE SCENE, then execute the manifest's step-list.
//
// 🔒 EVERYTHING BELOW IS A MUTATION, AND IT IS ALL AFTER THE §3.2 GATE. That is not an accident and
// it is not negotiable: scene-bootstrap creates directories, seeds a secrets file and INSTALLS SYSTEMD
// UNITS. Putting it in the preflight "because it's just setup" would move real mutation to the wrong
// side of the resolver and bypass the floor — the exact failure §3.2 exists to prevent.
phase('Deploy')

// ---- (a) SCENE BOOTSTRAP (DEC-DEV-0203 / FIND-B) — "E.A wrote the recipe, but nobody built the
// kitchen." The manifest declared deploy_root / releases/<ts> / current / shared/{.env,logs,uploads}
// and three systemd unit templates. NONE of it was ever materialised: the live process contained no
// `deploy_root`, no `homedir`, no `expand` — `~/deploy/…` was never a directory, `shared/.env` (where
// `migrate` reads DATABASE_URL) never existed, and no unit was ever installed. The first deploy was
// impossible in principle — the same shape as the 0201 draft-contract deadlock: two correct halves
// with a chasm between them.
const scene = await agent(
  `Bootstrap the ${ENV_TIER} deploy SCENE for capability "${CAPABILITY}" on this machine, then lay out the new release (VM-gated; authorized by the §3.2 auto disposition above — this is real mutation).\n` +
  `The scene is ALREADY RESOLVED for you by the deterministic lib — use these ABSOLUTE paths verbatim, do NOT re-derive or re-expand them:\n` +
  `${JSON.stringify((manifest && manifest.scene) || {}, null, 2)}\n` +
  `Source checkout to deploy FROM: \`${SOURCE_ROOT}\` (the deploy is LOCAL inside this machine — D-1; it is NOT a remote push).\n` +
  `Units to install: ${JSON.stringify((manifest && manifest.units) || [])} (templates live beside the manifest at \`${MANIFEST}\`).\n` +
  `\n` +
  `IDEMPOTENT — run it twice, nothing breaks and nothing is duplicated. Note the ONE deliberate exception: the SCENE (root, releases/, shared/, units) must be create-if-absent / reuse-if-present, but the RELEASE is by construction a FRESH releases/<ts>. That is the Capistrano contract, and it is exactly what makes rollback possible — a previous release must still be sitting there, intact, to flip back to.\n` +
  `\n` +
  `1) SCENE DIRS — \`mkdir -p\` deploy_root, releases_dir, shared_dir, and every shared_paths[] entry marked dir:true (logs/, uploads/). Record each path in created[] or reused[].\n` +
  `2) shared/.env — THE SECRETS FILE, and the one place you may NOT improvise. If \`scene.env_file\` already exists, REUSE it (never overwrite: it is the persistent, hand-tuned staging config). If it does not exist, seed it by COPYING \`${SOURCE_ROOT}/.env\` (staging v1 secrets = dev-tier — the owner's decision, dev/gates/EPIC_E_READINESS.md A-1..A-9), then \`chmod 600\`. If there is NO .env in the project root either, STOP: return ready:false, blocker_class:'env-not-ready', blocker naming both paths you looked at. Do NOT fabricate, template, or synthesize a .env — a deploy on invented secrets fails at runtime as \`env-not-loaded\`, which reads like a code bug and costs an hour to disbelieve. Set env_source to 'shared' (reused) or 'project-root' (seeded).\n` +
  `3) RELEASE DIR — stamp the timestamp with \`date -u ${(manifest && manifest.scene && manifest.scene.date_fmt) || '+%Y%m%dT%H%M%SZ'}\` (the format the manifest DECLARED — do not invent a shape; the harness may not read a clock, so YOU stamp it) and \`mkdir -p\` releases_dir/<ts>. Return it as release + release_dir.\n` +
  `4) POPULATE THE RELEASE — copy the source tree into release_dir with a POSIX-portable pipeline (rsync may not be installed; tar always is):\n` +
  `   \`tar -cf - -C ${SOURCE_ROOT} --exclude=./.git --exclude=./.claude --exclude='./.claude-backup*' --exclude=./node_modules --exclude='*/node_modules' --exclude=./.env --exclude='*/dist' --exclude='*/.next' --exclude='*/build' --exclude='*/coverage' --exclude=./.idea . | tar -xf - -C <release_dir>\`\n` +
  `   …and if deploy_root happens to sit INSIDE the source tree, exclude it too or you will copy the scene into itself.\n` +
  `   WHY THIS EXACT SET: (a) the manifest's \`build\` step runs with working_directory {{RELEASE_DIR}}, so the release needs the real sources + workspace manifests (package.json, pnpm-workspace.yaml, pnpm-lock.yaml, .npmrc, tsconfig*, apps/**, packages/**); (b) ROLLBACK IS A SYMLINK FLIP BACK, so each release must be INDEPENDENTLY RUNNABLE — which is why node_modules is NOT shared and NOT symlinked but installed per-release (a shared node_modules would let a newer deploy's install silently re-point an older release's dependencies, and the "known-good" release you roll back to would boot against dependencies it never saw); (c) .git / .claude are not runtime; (d) dist/.next/build are regenerated by the build step; (e) .env must be the SYMLINK from step 5, never a stale copy.\n` +
  `   Then \`pnpm install --frozen-lockfile\` INSIDE release_dir. This is affordable precisely because pnpm hardlinks from its content-addressable store: a per-release node_modules costs almost no disk and is fast on a warm store. Never copy node_modules from the source checkout (it may carry a foreign-arch native build).\n` +
  `5) SHARED SYMLINKS — link each shared path INTO the release: \`ln -sfn <shared>/.env <release_dir>/.env\`, same for logs and uploads. (The systemd units read the env via EnvironmentFile=<shared>/.env; this symlink is what lets the \`migrate\` step, which runs from the release root, see DATABASE_URL.)\n` +
  `6) SYSTEMD UNITS — materialise each unit from its \`.service.template\` beside the manifest: substitute {{CURRENT_LINK}} → scene.current_link, {{ENV_FILE}} → scene.env_file, {{NODE_BIN}} → the ABSOLUTE node path (\`command -v node\`; systemd needs an absolute ExecStart — it has NO user PATH), {{PNPM_BIN}} → the ABSOLUTE pnpm path (\`command -v pnpm\`) if a template carries it, {{PORT}} → the port for that service. Write to /etc/systemd/system/<unit>.service (sudo — a prod stand is exactly where sudo is normal), then \`sudo systemctl daemon-reload\` and \`sudo systemctl enable <unit>\`. Writing the same content twice is a no-op; daemon-reload and enable are both idempotent. Record units_installed[].\n` +
  `   {{PORT}}: resolve from the manifest's healthcheck spec, else from shared/.env (PORT / API_PORT / WEB_PORT / …). If you CANNOT resolve a port for a required unit, do NOT guess — a service on the wrong port fails the healthcheck in a way that looks exactly like a code bug. Return ready:false, blocker_class:'env-not-ready', and name the unit and where you looked.\n` +
  `   The worker is required:false — install its unit, but only \`enable\` it if WORKER_AUTOSTART=1 is set in shared/.env; otherwise leave it installed-and-disabled and say so in diagnosis.\n` +
  `   If sudo/systemd is unavailable (no systemctl, no non-interactive sudo), that is NOT a code failure: return ready:false, blocker_class:'env-not-ready' with the exact error.\n` +
  `\n` +
  `⚠ DO NOT FLIP \`current\` HERE, and do not build, migrate, or restart. That is the manifest's own step-list and it runs in the NEXT step. Your job ends with: the scene exists, the release is laid out and installed, the units are loaded.\n` +
  `CAPTURE-DON'T-FIX: if something fails, STOP and report it — do NOT retry-hack, patch the app, or commit. Classify honestly with blocker_class: 'env-not-ready' (a substrate/provisioning gap we cannot fill without inventing something — no .env anywhere, no sudo, an unresolvable port) vs 'deploy-failed' (the deploy machinery itself broke — a copy failed, pnpm install failed, a disk filled).\n` +
  `🚫 MUTATION BOUNDARY (DEC-DEV-0211 / FIND-E2): your mandate covers the DEPLOY SCENE ONLY — the scene dirs, the shared/.env seed, the release layout + its per-release \`pnpm install\`, the unit files + daemon-reload/enable. The BACKING SUBSTRATE is not yours: do NOT start, restart or repair backing services or containers (no \`docker start|restart|run|compose up\`, no \`systemctl start\` of postgres/redis/anything that is not one of the units you just installed), do NOT install system packages (apt/yum/brew), do NOT edit substrate configs. A down dependency discovered here is EVIDENCE → ready:false, blocker_class:'env-not-ready' — bringing it up yourself would silently erase the env-readiness gate that ran before you (run lah60w).\n` +
  `🔒 §8.3 — READ-ONLY on \`.claude/integrator/**\`: read the manifest and the unit templates, but NEVER edit them. If a template looks wrong, SAY SO — do not "fix" it (that zone is the Integrator's; the Orchestrator executes equipment, it does not author it).\n` +
  `Return ready + blocker + blocker_class + release + release_dir + env_source + created[] + reused[] + units_installed[] + diagnosis + observed.`,
  { model: 'opus', schema: SCENE_SCHEMA, phase: 'Deploy', label: 'scene-bootstrap' },   // MDP: real high-R mutation (dirs, secrets file, systemd units) + honest env/deploy failure classification (impl/depth)
)
const sceneReady = !!(scene && scene.ready)
log(`scene: ${sceneReady ? `READY — release ${(scene && scene.release) || '?'} (.env from ${(scene && scene.env_source) || '?'}; created ${((scene && scene.created) || []).length}, reused ${((scene && scene.reused) || []).length}, units ${((scene && scene.units_installed) || []).length})` : `NOT READY — ${(scene && scene.blocker) || 'see diagnosis'} [${(scene && scene.blocker_class) || 'unclassified'}]`}`)

// A scene we could not build honestly. Two DIFFERENT outcomes, and the difference is not cosmetic:
//   env-not-ready → BLOCKED + readiness=ENV_NOT_READY (no .env anywhere / no sudo / no port). We could
//                   not PREPARE the deploy without inventing something, and we refuse to invent. The
//                   charter routes evt:deploy.env_not_ready → fix the substrate and re-run. Directories
//                   we created on the way are harmless and idempotent; NOTHING was flipped.
//   anything else → DEPLOY_FAILED, flipped=false → escalate (evt:deploy.preflight_failed).
if (!sceneReady) {
  const envGap = scene && scene.blocker_class === 'env-not-ready'
  if (envGap) {
    readiness = worstReadiness(readiness, 'ENV_NOT_READY')
    readinessReasons.push(`scene bootstrap could not complete honestly: ${(scene && scene.blocker) || 'see diagnosis'} → ENV_NOT_READY (nothing was fabricated; nothing was flipped)`)
  }
  log(`${envGap ? 'BLOCKED (scene ENV_NOT_READY)' : 'DEPLOY_FAILED (scene bootstrap failed)'} — nothing flipped. ${(scene && scene.diagnosis) || ''}`)
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: envGap ? 'BLOCKED' : 'DEPLOY_FAILED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: contractStatus, contract_evidence: null,   // never flipped ⇒ the contract earned NO live-evidence
    release: (scene && scene.release) || null, healthcheck: null, failure_class: null,
    scene, deploy: null, blocking_defects: blockingDefects,
    disposition, autonomy: disposition,
    disclosures: disclosures.concat([`scene bootstrap ${envGap ? 'BLOCKED' : 'FAILED'} (${(scene && scene.blocker_class) || 'unclassified'}): ${(scene && scene.blocker) || (scene && scene.diagnosis) || 'see observed'}`]),
  }
}

// ---- (b) EXECUTE THE MANIFEST STEP-LIST. The scene is real, the release is laid out and installed.
// Sets flipped=true iff `current` actually moves. Capture-diagnose a partial deploy; do NOT fix.
const deployed = await agent(
  `Execute the ${ENV_TIER} deploy for capability "${CAPABILITY}" per the parsed manifest step-list (VM-gated; authorized by the §3.2 auto disposition above).\n` +
  `The SCENE IS ALREADY BUILT and the release is laid out, installed, and symlinked to shared/ — do NOT re-create it:\n` +
  `  release      = ${(scene && scene.release) || '(see scene)'}\n` +
  `  {{RELEASE_DIR}} = ${(scene && scene.release_dir) || '(see scene)'}\n` +
  `  {{CURRENT_LINK}} = ${(manifest && manifest.scene && manifest.scene.current_link) || '(see scene)'}\n` +
  `  {{ENV_FILE}}    = ${(manifest && manifest.scene && manifest.scene.env_file) || '(see scene)'}\n` +
  `Manifest steps (ordered — run them IN THIS ORDER, substituting the paths above): ${JSON.stringify((manifest && manifest.steps) || [])}.\n` +
  `1) Acquire a deploy lockfile (A-9 belt — refuse if a parallel deploy holds it). 2) CODEGEN: if the step-list carries a codegen step (prisma generate — the per-release node_modules is CLEAN and has NO generated client, DEC-DEV-0205/FIND-C1), run it exactly as specified, in its working_directory, BEFORE the build; skip cleanly if conditional+unverified — note it. 3) BUILD: run the build step's command with its working_directory ({{RELEASE_DIR}} — the concrete new release; that is correct, a build belongs to ONE release). 4) MIGRATE: run the migrate step IF the manifest marks it verified (skip cleanly if conditional+unverified — note it); it reads DATABASE_URL through the release's .env symlink into shared/.env. 5) FLIP \`current\` to the new release — ATOMICALLY: \`ln -sfn <release_dir> <current>.tmp && mv -T <current>.tmp <current>\` (mv -T on the same filesystem is a single rename(2) — it REPLACES the symlink in one step). Do NOT \`rm current && ln -s …\`: that leaves a window where \`current\` does not exist, and a service restarting in that window dies. Set flipped=true ONLY once \`readlink -f current\` actually resolves to the new release. 6) RESTART the units (\`sudo systemctl restart <unit>\`) — the worker only if it was enabled. The units follow \`current\`, so the restart is what makes the flip take effect.\n` +
  `CAPTURE-DON'T-FIX: if a step fails, STOP, record steps_done + partial + a diagnosis of what broke and whether \`current\` moved — do NOT retry-hack, edit code, or commit. Set flipped precisely: true iff the symlink now points at the new release, false otherwise.\n` +
  `🚫 MUTATION BOUNDARY (DEC-DEV-0211 / FIND-E2): every mutation you may make is a MANIFEST STEP above (codegen/build/migrate/flip/restart of the app units). The BACKING SUBSTRATE is not yours: do NOT start, restart or repair backing services or containers (no \`docker start|restart|run|compose up\`, no \`systemctl start\` of postgres/redis — restarting the APP units in step 6 is the ONLY systemctl you run), do NOT install system packages, do NOT edit shared/.env or substrate configs. A step failing because a dependency is DOWN is EVIDENCE — record it in the diagnosis and stop; do NOT bring the dependency up to make the step pass (run lah60w: that silently erases the env-readiness gate).\n` +
  `🔒 §8.3 BOUNDARY — NEVER WRITE UNDER \`.claude/integrator/**\`: you may READ the manifest and the CNT contract, but you must NOT edit either, and you must NOT flip a contract's status draft→active — not even after a perfect deploy, not "to close the loop". That flip is the INTEGRATOR's prerogative (docs/integrator-module/SPEC.md §8.3: Integrator EQUIPS, Orchestrator EXECUTES). This process REPORTS the live-evidence in its result; the Integrator acts on it.\n` +
  `Return flipped + release + migrated + partial + steps_done + diagnosis + observed.`,
  { model: 'opus', schema: DEPLOY_SCHEMA, phase: 'Deploy', label: 'deploy-flip' },   // MDP: real high-R mutation (build/migrate/flip/restart) + partial-deploy diagnosis (impl/depth)
)
const flipped = !!(deployed && deployed.flipped)
const release = (deployed && deployed.release) || (scene && scene.release) || null
log(`deploy: flipped=${flipped}${release ? ` (release ${release})` : ''}${deployed && deployed.partial ? ' — PARTIAL' : ''}`)

// A flip that never happened (build/migrate/flip failed before moving `current`) is a DEPLOY_FAILED
// with nothing live to roll back → escalate (evt:deploy.preflight_failed). Only a FLIPPED release can
// auto-rollback (there is a prior known-good release + a live bad one).
if (!flipped) {
  log('DEPLOY_FAILED (flip did not complete) — nothing went live; route to escalate (no rollback: there is no flipped release to revert).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'DEPLOY_FAILED', readiness, readiness_reasons: readinessReasons, flipped: false,
    contract_status: contractStatus, contract_evidence: null,   // the flip never happened ⇒ the contract earned NO live-evidence
    release, healthcheck: null, failure_class: null,            // no post-flip boot ⇒ no P7 taxonomy class (we do NOT invent one)
    scene, deploy: deployed, blocking_defects: blockingDefects, // ← the trail the live run.json was missing entirely (FIND-D)
    disposition, autonomy: disposition,
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
  `Do NOT remediate, edit code, or commit — and do NOT start/restart ANY service or container to coax a 2xx (no \`docker start\`, no \`systemctl start|restart\` — FIND-E2): a dependency-not-up diagnosis is EVIDENCE for the rollback decision, not an invitation to repair the substrate. SURFACE the diagnosis (a flipped-but-unhealthy release will be auto-rolled-back by E.C). Return healthy + failure_class (a taxonomy id or null) + diagnosis + observed.`,
  { model: 'opus', schema: HEALTHCHECK_SCHEMA, phase: 'Healthcheck', label: 'healthcheck' },   // MDP: live probe + diagnosis against the failure taxonomy (judgment/depth, like P7 boot-smoke)
)
const healthy = !!(healthcheck && healthcheck.healthy)
log(`healthcheck: ${healthy ? 'HEALTHY → DEPLOYED' : `UNHEALTHY (${(healthcheck && healthcheck.failure_class) || 'unknown'}) → DEPLOY_FAILED, flipped → auto-rollback`}`)

// ---- synthesize the two-axis result. INVARIANT: DEPLOYED ⇒ flipped ∧ healthy (both true by
// construction on this path); an unhealthy flipped release is DEPLOY_FAILED + flipped (→ rollback).
const result = healthy ? 'DEPLOYED' : 'DEPLOY_FAILED'

// ---- CONTRACT LIVE-EVIDENCE (DEC-DEV-0201) — the other half of the deadlock. A draft CNT was waiting
// for exactly one thing: a live run proving the deploy-setup works. A DEPLOYED + healthy run IS that
// evidence, so the contract becomes flippable draft→active and the cycle CLOSES.
//
// 🔒 §8.3 IS THE LINE: we REPORT, we do NOT write. The Orchestrator never writes `.claude/integrator/**`
// and never flips a CNT — that zone belongs to the Integrator (equip vs. execute). Mutating the contract
// here "to close the loop" would buy convenience with the boundary that keeps the two modules honest.
// The flip is a follow-up ACT BY THE INTEGRATOR, pointed at the evidence handle below (the RUN_ID).
const cnt = (manifest && manifest.contract) || null
const contractEvidence = (result === 'DEPLOYED' && contractDraft) ? {
  contract: cnt,                        // the CNT id the manifest names — null if it names none (NEVER invented)
  capability: CAPABILITY,
  status_observed: contractStatus,      // what the contract said BEFORE this run (draft)
  verdict: 'live-verified',             // the deploy the draft was waiting for happened, and came up healthy
  run_id: RUN_ID || null,               // the evidence handle (ledger bracket) — null if the dispatcher did not forward it
  evidence: { result: 'DEPLOYED', release, healthcheck_healthy: true, env_tier: ENV_TIER },
  flip_to: 'active',                    // what the contract MAY now become…
  flip_owner: 'integrator',             // …and who is allowed to write that flip. Not us (§8.3).
} : null
if (contractEvidence) {
  log(`contract live-evidence: ${cnt || `the CNT governing "${CAPABILITY}"`} may now be flipped draft→active (run ${RUN_ID || '<runId not forwarded>'}). REPORTED, not written — the flip is the Integrator's (§8.3).`)
}

return {
  feature: FEATURE || null,
  capability: CAPABILITY,
  env_tier: ENV_TIER,
  result,                              // DEPLOYED | DEPLOY_FAILED (flipped) | BLOCKED (handled above)
  readiness,                           // READY | DEGRADED (ENV_NOT_READY returns above)
  readiness_reasons: readinessReasons, // WHY that readiness (env-probe reasons + any local downgrade) — the §3.2 gate must be auditable from run.json alone
  contract_status: contractStatus,     // the TRUST axis as read from the capability (active | draft) — NOT a readiness input
  contract_evidence: contractEvidence, // set iff a draft contract just earned its live-verify — REPORT ONLY (§8.3: the Integrator flips it)
  flipped,                             // true here — the charter routes DEPLOY_FAILED+flipped to auto-rollback
  release,
  healthcheck,                         // { healthy, failure_class, diagnosis, observed }
  failure_class: (healthcheck && healthcheck.failure_class) || null,   // hoisted to the top level: the ONE field a post-mortem greps for (FIND-D)
  scene,                               // what the deploy had to BUILD before it could deploy (dirs, .env source, units) — FIND-B
  deploy: deployed,                    // steps_done / partial / migrated / diagnosis — the trail a DEPLOY_FAILED needs MOST
  blocking_defects: blockingDefects,   // [] here by construction (a mis-equipped capability blocks in the preflight)
  disposition,                         // the §3.2 resolver envelope
  autonomy: disposition,               // alias (payloadPath: autonomy) — mirrors validate-feature-impl
  disclosures: (healthy ? disclosures : disclosures.concat([`post-flip healthcheck failed (${(healthcheck && healthcheck.failure_class) || 'unknown'}): ${(healthcheck && healthcheck.diagnosis) || 'see observed'} — auto-rollback (E.C)`]))
    .concat(contractEvidence ? [
      `${cnt || `the CNT governing "${CAPABILITY}"`} MAY now be flipped draft→active — evidence: run ${RUN_ID || '<runId was not forwarded; take it from this run\'s ledger bracket>'} deployed release ${release || '(unnamed)'} to ${ENV_TIER} and the healthcheck passed. §8.3: that flip is the INTEGRATOR's write (the deployer / /integrator:provision), never the Orchestrator's — this process only reports the evidence.`,
    ] : []),
}
