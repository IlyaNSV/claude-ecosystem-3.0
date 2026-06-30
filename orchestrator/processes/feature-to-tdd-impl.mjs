export const meta = {
  name: 'feature-to-tdd-impl',
  description: 'Orchestrator P5 — drive a feature spec to implemented code via a native TDD loop that LIFTS cc-sdd kiro-impl prompts/gates and adds the gate-risk-classifier (per-task HIGH→independent reviewer / LOW→inline-verify). kiro-impl itself is disable-model-invocation, so the Workflow owns the minimal dispatch FSM.',
  phases: [
    { title: 'Plan' },
    { title: 'Implement' },
    { title: 'Validate' },
  ],
}

/*
 * Orchestrator process P5 `feature-to-tdd-impl` — THIN NATIVE design (DEC-DEV-0077,
 * build S5b). Reading: SPEC §3.2 P5; gate-risk-classifier design
 * (dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md); RUN 01 harvest (DEC-DEV-0073).
 *
 * WHY NATIVE (OD9): cc-sdd's kiro-impl is a mature autonomous TDD controller, but it is
 * `disable-model-invocation: true` — neither a Workflow nor the model can invoke it.
 * So the Workflow must own the per-task dispatch FSM itself. BUT (lesson DEC-DEV-0076)
 * we do NOT rebuild kiro's methodology: every subagent prompt is LIFTED by reading
 * kiro's own self-contained templates at runtime
 * (.claude/skills/kiro-impl/templates/{implementer,reviewer,debugger}-prompt.md), and
 * the gates are kiro skills (kiro-review / kiro-verify-completion / kiro-validate-impl /
 * kiro-debug — all model-invocable). Net-new vs kiro-impl: (1) the gate-risk-classifier
 * (P0-2) routing HIGH→independent reviewer / LOW→inline-verify — kiro-impl always runs
 * the full reviewer; (2) the durable Workflow skeleton.
 *
 * DETERMINISM MODEL (SPEC §2): Layer-1 SKELETON = the per-task FSM + bounded rounds +
 * sequential ordering (strict). Layer-2 JUDGMENT = implementer/reviewer/debugger agents
 * (lifted kiro prompts). Layer-3 GATES = gate-risk-classifier (deterministic .cjs, run
 * via an agent) + kiro-verify-completion + kiro-validate-impl.
 *
 * BLOCK DISCRETION (DEC-DEV-0096, T5): a BLOCK is classified before a debug round is spent
 * (remediation-guard.cjs is the deterministic backbone, run by an agent). A TRANSIENT block
 * (locked index / flaky install / momentarily-down substrate, FB-LR-08) gets a bounded
 * auto-retry — re-probe env, retry, NO debug round consumed. A cross-spec/requirement
 * contradiction or a design self-contradiction (FB-LR-07) is ESCALATED, never self-resolved:
 * the implementer must not pick a side, the task records the block with the upstream route
 * and is tracked in `conflicts`. Tasks still run SEQUENTIALLY (single-writer git safety).
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script.
 * Every file read / classifier run / kiro template read / kiro skill invocation / git
 * commit happens INSIDE an agent(). Tasks run SEQUENTIALLY (one at a time) even for (P)
 * tasks — git-conflict safety, mirroring kiro-impl.
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect). A live run
 * needs a pilot with cc-sdd + an implemented spec (separate session).
 */

// FB-001 (live-run RUN 01): the harness passes `args` verbatim, and an invoking agent
// may stringify it (args:"{...}") instead of passing an object — run.md shows the object
// form, but defend in depth: parse a JSON string so A.feature is never silently undefined
// (which let the Plan agent improvise a wrong target — FB-002).
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURE = A.feature || ''                                  // cc-sdd feature slug (e.g. "auth")
const SPEC_DIR = A.specDir || `.kiro/specs/${FEATURE}`
const CLASSIFIER = A.classifier || '.claude/orchestrator/lib/gate-risk-classifier.cjs'
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs'   // DEC-DEV-0092: shared readiness probe (pre-flight)
const CAP_PROBE = A.capabilityProbe || '.claude/orchestrator/lib/capability-probe.cjs'  // DEC-DEV-0117: §6 detect-leg — enumerate the feature's declared external_capabilities
const REMEDIATION_GUARD = A.remediationGuard || '.claude/orchestrator/lib/remediation-guard.cjs'  // DEC-DEV-0096: block-discretion backbone (T5)
const KIRO_TPL = A.kiroTemplates || '.claude/skills/kiro-impl/templates'
const REGISTRY = A.registry || ''                                // optional load-bearing.<FM>.yaml/json
const MAX_REVIEW_ROUNDS = A.maxReviewRounds || 2
const MAX_DEBUG_ROUNDS = A.maxDebugRounds || 2
const MAX_TRANSIENT_RETRIES = A.maxTransientRetries || 2          // DEC-DEV-0096 (T5, FB-LR-08): bounded auto-retry for a TRANSIENT impl-block (no debug round consumed)

// FB-002 (live-run RUN 01): deterministic guard — refuse to run feature-less. With an
// empty FEATURE the Plan agent previously scanned .kiro/specs/ and silently picked a
// different feature (billing implemented under an "auth" run; 7 tasks committed before
// the operator caught it). Spec-existence is checked inside the Plan agent (no FS here,
// per DEC-DEV-0073 §D.1); this catches the empty-target case up front.
if (!FEATURE) {
  log('HALT: empty feature — refusing to run (FB-002). Pass args as an OBJECT, e.g. {feature:"auth"}.')
  return { error: 'feature-to-tdd-impl: empty feature (FB-002 guard)', feature: '', implemented: [], blocked: [] }
}

// ---- schemas (mirror kiro's structured handoff formats) --------------------
const PLAN_SCHEMA = {
  type: 'object',
  required: ['tasks'],
  properties: {
    validation_commands: { type: 'object' },                    // {test, build, smoke}
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'tier'],
        properties: {
          id: { type: 'string' },                               // X.Y
          tier: { type: 'string', enum: ['HIGH', 'LOW'] },
          profile: { type: ['string', 'null'] },                // LOW verify-profile
          why: { type: 'array', items: { type: 'string' } },
          boundary: { type: ['string', 'null'] },
          requirements: { type: 'array', items: { type: 'string' } },
          depends: { type: 'array', items: { type: 'string' } },
          behavioral: { type: 'boolean' },                      // Feature Flag Protocol applies
          done: { type: 'boolean' },
          blocked: { type: ['string', 'null'] },
        },
      },
    },
  },
}

const IMPL_SCHEMA = {
  type: 'object',
  required: ['status', 'task'],
  properties: {
    status: { type: 'string', enum: ['READY_FOR_REVIEW', 'BLOCKED', 'NEEDS_CONTEXT'] },
    task: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    red_phase_output: { type: 'string' },
    requirements_checked: { type: 'string' },
    concerns: { type: 'string' },                              // FB-013: deferred-capability / mock-stand-in flags — read + propagated, not dropped
    blocker: { type: 'string' },
    block_class: { type: 'string', enum: ['transient', 'content', 'capability', 'cross-spec-conflict', 'design-contradiction'] }, // DEC-DEV-0096 (T5): implementer's self-classification of a BLOCK (the classify-block agent + remediation-guard are the authoritative backbone)
    missing: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['verdict', 'task'],
  properties: {
    verdict: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
    task: { type: 'string' },
    gate: { type: 'string', enum: ['independent', 'inline'] },   // HIGH→independent, LOW→inline
    mechanical: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    remediation: { type: 'string' },
  },
}

const DEBUG_SCHEMA = {
  type: 'object',
  required: ['next_action'],
  properties: {
    next_action: { type: 'string', enum: ['RETRY_TASK', 'BLOCK_TASK', 'STOP_FOR_HUMAN'] },
    root_cause: { type: 'string' },
    fix_plan: { type: 'string' },
  },
}

const COMMIT_SCHEMA = {
  type: 'object',
  required: ['committed'],
  properties: { committed: { type: 'boolean' }, sha: { type: 'string' }, task: { type: 'string' } },
}

const GATE_SCHEMA = {
  type: 'object',
  required: ['result'],
  properties: {
    result: { type: 'string', enum: ['GO', 'NO-GO', 'MANUAL_VERIFY_REQUIRED'] },
    findings: { type: 'array', items: { type: 'string' } },
  },
}

// ===========================================================================

// ---- Phase 1: plan — classify + order the task DAG ------------------------
phase('Plan')
const plan = await agent(
  `Run orchestrator-init (skills/orchestrator/orchestrator-init.md) for feature ${FEATURE}, then build the task plan.\n` +
  `1) Load ${SPEC_DIR}/{spec.json,requirements.md,design.md,tasks.md}; confirm tasks approved. ` +
  `If ${SPEC_DIR}/spec.json does not exist, STOP: return tasks:[] with a note — do NOT scan .kiro/specs/ or pick another feature yourself (FB-002).\n` +
  `2) Discover validation commands (TEST/BUILD/SMOKE) from repo manifests/CI per kiro-impl preflight.\n` +
  `3) Run the gate-risk-classifier (skills/orchestrator/gate-risk-classifier.md): ` +
  `node ${CLASSIFIER} --tasks ${SPEC_DIR}/tasks.md --requirements ${SPEC_DIR}/requirements.md` +
  `${REGISTRY ? ` --registry ${REGISTRY}` : ''}. Relay its per-task tier/profile/why — do NOT eyeball tiers.\n` +
  `4) Read tasks.md for each actionable sub-task's _Boundary_/_Requirements_/_Depends_/(P)/done state and whether it is behavioral.\n` +
  `Return the ordered task plan (dependency order; one entry per actionable sub-task) + validation_commands.`,
  { schema: PLAN_SCHEMA, phase: 'Plan', label: 'plan' },
)
const tasks = ((plan && plan.tasks) || []).filter((t) => !t.done && !t.blocked)
log(`plan: ${tasks.length} actionable task(s); HIGH=${tasks.filter((t) => t.tier === 'HIGH').map((t) => t.id).join(',') || '∅'}; LOW=${tasks.filter((t) => t.tier === 'LOW').map((t) => t.id).join(',') || '∅'}`)

// ---- pre-flight env-readiness probe (DEC-DEV-0092, FB-LR-02) ----------------
// P5 implements REAL code. If the substrate the project uses (Docker/Postgres/
// Redis/migrations) is down, the downstream P6 gate would otherwise read a RED
// suite as a NO-GO instead of "the gate could not judge". Run the SHARED probe up
// front (CODE, not LLM initiative), log it, and forward it to P6 so the readiness
// axis is seeded from the same source on both sides. Advisory here — we do NOT
// abort impl on a down substrate (a task may legitimately bring it up), but the
// signal is carried, never silently dropped (the FB-LR-02 root cause).
const ENV_READINESS_SCHEMA = {
  type: 'object',
  required: ['readiness'],
  properties: {
    readiness: { type: 'string', enum: ['READY', 'DEGRADED', 'ENV_NOT_READY'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
}
let envReadiness = 'READY'
if (tasks.length) {
  const probe = await agent(
    `Run the env-readiness probe: \`node ${ENV_PROBE}\` via Bash and relay its JSON verbatim (readiness + checks + reasons). ` +
    `Do NOT start any substrate yourself — just report whether what the project uses (per the probe's own detection) is up.`,
    { schema: ENV_READINESS_SCHEMA, phase: 'Plan', label: 'env-readiness' },
  )
  envReadiness = (probe && probe.readiness) || 'READY'
  log(`pre-flight env-readiness: ${envReadiness}${probe && probe.reasons && probe.reasons.length ? ` — ${probe.reasons.join('; ')}` : ''}`)
}

// ---- lifted-prompt dispatch helpers ---------------------------------------
const implement = (task, extra = '') =>
  agent(
    `Read ${KIRO_TPL}/implementer-prompt.md and apply it (TDD: RED→GREEN→REFACTOR) to task ${task.id}: "${task.text || ''}".\n` +
    `Spec: ${SPEC_DIR}/{requirements,design,tasks}.md. Requirements §: ${(task.requirements || []).join(', ')}. _Boundary_: ${task.boundary || 'n/a'}. ` +
    `Validation commands: ${JSON.stringify((plan && plan.validation_commands) || {})}. ${task.behavioral ? 'BEHAVIORAL — apply the Feature Flag Protocol.' : 'Non-behavioral.'}\n` +
    `FB-006: do NOT make project-global changes outside your _Boundary_ — never alter git core.hooksPath, root package.json lifecycle scripts (prepare/postinstall), or install hook-managing tooling (e.g. husky) that hijacks git hooks (the pilot's beads owns core.hooksPath). If the task seems to require it, return BLOCKED and surface it rather than silently doing it.\n` +
    `FB-013: if you satisfy a real external/provider/secret/adapter seam with a Mock or unwired skeleton because real access is DEFERRED (not out of scope), state that explicitly in the CONCERNS field of your Status Report — it is propagated downstream, not dropped.\n` +
    `FB-LR-07 (T5): NEVER resolve a cross-spec/requirement contradiction or a design self-contradiction yourself. If this task requires picking a side of such a conflict, return BLOCKED, set block_class:'cross-spec-conflict' or 'design-contradiction', and state the contradiction explicitly in the blocker — do NOT commit a unilateral choice.\n` +
    `Do NOT commit, do NOT edit tasks.md. End with the exact ## Status Report block.${extra}`,
    { schema: IMPL_SCHEMA, phase: 'Implement', label: `impl:${task.id}` },
  )

const debug = (task, reason) =>
  agent(
    `Read ${KIRO_TPL}/debugger-prompt.md (kiro-debug protocol) — fresh-context root-cause for task ${task.id}. ` +
    `Failure: ${reason}. Use git diff of current uncommitted changes + spec ${SPEC_DIR}. ` +
    `Return NEXT_ACTION (RETRY_TASK | BLOCK_TASK | STOP_FOR_HUMAN) + ROOT_CAUSE + FIX_PLAN.`,
    { schema: DEBUG_SCHEMA, phase: 'Implement', label: `debug:${task.id}` },
  )

// DEC-DEV-0096 (T5, FB-LR-08 / FB-LR-07): classify a BLOCK before deciding what to do with it.
// transient → a bounded auto-retry clears it (no debug round burned); cross-spec/design
// contradiction → ESCALATE, never self-resolve or retry; capability/content → the debug path.
// The remediation-guard.cjs lib is the deterministic backbone (run by the agent via Bash);
// the agent escalates if EITHER the lib or its own reading sees a contradiction (conservative).
const BLOCK_CLASS_SCHEMA = {
  type: 'object',
  required: ['class'],
  properties: {
    class: { type: 'string', enum: ['transient', 'content', 'capability', 'cross-spec-conflict', 'design-contradiction'] },
    detail: { type: 'string' },
  },
}
const classifyBlock = (task, reason) =>
  agent(
    `Task ${task.id} is BLOCKED: "${reason}". Classify the blocker for the FSM's discretion (T5).\n` +
    `Run the deterministic backbone: \`node ${REMEDIATION_GUARD} --reason "<the blocker text>"\` via Bash and read its \`class\`. ` +
    `Then return the class, ESCALATING (cross-spec-conflict | design-contradiction) if EITHER the lib OR your own reading sees a contradiction BETWEEN requirements/specs or a design self-contradiction — conservative toward escalation: a contradiction must NOT be auto-retried or self-resolved (FB-LR-07).\n` +
    `class ∈ {transient (a flaky/locked/timed-out hiccup a retry would clear), capability (missing tool/secret/access/upstream decision), cross-spec-conflict, design-contradiction, content (a genuine code/logic gap)}.`,
    { schema: BLOCK_CLASS_SCHEMA, phase: 'Implement', label: `classify-block:${task.id}` },
  ).then((r) => (r && r.class) || 'content')

const gate = (task, impl) => {
  if (task.tier === 'HIGH') {
    return agent(
      `Read ${KIRO_TPL}/reviewer-prompt.md (kiro-review protocol) — INDEPENDENT adversarial review of task ${task.id}. ` +
      `Run git diff yourself; do NOT trust the implementer report. Verify against requirements §${(task.requirements || []).join(', ')} + design + _Boundary_ ${task.boundary || 'n/a'}. ` +
      `Also flag: (a) FB-010 — any new exported/public method this task created that has NO production call-site (orphan export = cross-task integration gap; per-task review is the only place narrow enough to spot it before the seam is forgotten); (b) FB-006 — any change to project-global config outside _Boundary_ (git core.hooksPath, root lifecycle scripts, hook-managing tooling). ` +
      `Return the exact ## Review Verdict block. Set gate:independent.`,
      { schema: REVIEW_SCHEMA, phase: 'Implement', label: `review:${task.id}` },
    )
  }
  return agent(
    `Inline-verify task ${task.id} per the LOW-tier profile "${task.profile || 'infra/mechanical'}" ` +
    `(skills/orchestrator/gate-risk-classifier.md §verify-profiles): RED evidence + the profile's property-check ` +
    `(e.g. declarative-invariant → live DB introspection that the constraint exists; test-only → mutation proof; ` +
    `infra → boundary + git check-ignore + secrets-scan). NO separate reviewer subagent. ` +
    `Return a Review Verdict (APPROVED|REJECTED, gate:inline).`,
    { schema: REVIEW_SCHEMA, phase: 'Implement', label: `verify:${task.id}` },
  )
}

// FB-LR-23 (parallel-worktree PA-id safety): shared instruction so every PA-write below targets the
// SINGLE canonical pending-actions file (the main checkout) + allocates ids from it — a worktree-local
// copy lets parallel runs collide PA-ids (G-1: two trees minted `PA-027`). Duplicated verbatim across
// the three PA-emitting processes (PA-writes live inside agent prompts — no shared lib).
const PA_CANON = 'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '
  + 'one .git but have SEPARATE working trees, so a worktree-local `.claude/pending-actions.md` lets PA-ids collide '
  + 'across concurrent runs (two trees each mint the same PA-NNN). Resolve the SINGLE canonical file ONCE: run '
  + '`git worktree list --porcelain` and take the FIRST `worktree <path>` line (the main checkout, shared by every '
  + 'worktree) → `<that-path>/.claude/pending-actions.md`; if not inside a git worktree, fall back to '
  + '`.claude/pending-actions.md`. READ / SCAN / allocate the next PA-NNN (highest existing id + 1) / APPEND against '
  + 'THAT canonical file — never a worktree-local copy. Do NOT `git add` or commit the pending-actions file (it may '
  + 'live in another checkout; committing it from this worktree would write into a foreign tree) — leave it as '
  + 'working-tree state. '

// FB-007: on BLOCK, don't leave the _Blocked_ annotation uncommitted and route nowhere.
// Commit the annotation (so the tree stays clean for the next task) AND record a
// pending-action with the route, so the operator sees what's blocked and where it goes.
const recordBlock = (taskId, reason) =>
  agent(
    `Task ${taskId} is BLOCKED: ${reason}.\n` +
    `1) Append "_Blocked: ${reason}_" under task ${taskId} in ${SPEC_DIR}/tasks.md.\n` +
    `2) Commit ONLY that tasks.md change — explicit path, NEVER git add -A (FB-LR-23: with a shared-worktree .git, ` +
    `an explicit-path commit of ONLY your feature-zone file is the isolation — a wildcard add could stage a parallel ` +
    `worktree's changes via the shared index) — message: ` +
    `chore(${FEATURE}): block ${taskId} (surface blocker). This keeps the tree clean for the next task (FB-007).\n` +
    `3) Append an entry to the canonical pending-actions file with the blocker text and the route it needs ` +
    `(Product | Integrator | manual-staging | human) so it isn't silently lost. ` +
    PA_CANON +
    `Do NOT commit code.`,
    { phase: 'Implement', label: `block:${taskId}` },
  )

// FB-013 (DEC-DEV-0081 fix #1): a task can reach READY_FOR_REVIEW + APPROVED and STILL
// carry a non-blocking CONCERN — e.g. a real provider/API/secret/adapter seam deliberately
// satisfied in-dev by a Mock or unwired skeleton because real access is DEFERRED (not out
// of product scope). In S6 the implementer correctly emitted exactly this in its CONCERNS
// field, but the FSM never read it — so it was silently dropped and the feature closed at
// GO with the deferred capability hidden (DEC-DEV-0081 root cause: §6 fired only on BLOCKS,
// never on a non-blocking deferral). This routing branch is keyed on a NON-BLOCKING concern
// (not only status=BLOCKED): it PROPAGATES the concern instead of dropping it. It does NOT
// block the task and does NOT commit code — it records a tracking item so the gap is visible.
const surfaceConcern = (taskId, concern) =>
  agent(
    `Task ${taskId} reached APPROVED but its implementer reported a CONCERN: "${concern}".\n` +
    `Decide whether it flags a DEFERRED CAPABILITY or external seam that must outlive this run — ` +
    `a real provider/API/secret/tool satisfied in-dev by a Mock or unwired skeleton because real ` +
    `access is deferred (NOT out of product scope), or any acceptance/E2E that ran on a stand-in.\n` +
    `If so: append a NON-BLOCKING tracking entry to .claude/pending-actions.md (create if absent) — ` +
    `the deferred capability, its route (Integrator for access/tool/secret; Product for provider CHOICE), ` +
    `and provisioning-tier (staging/prod). Mark it tracking/disclosure, NOT a blocking request now ` +
    `(real access is a future deliverable, not something to provision today).\n` +
    `If the concern is a routine note (refactor/cleanup/style), do NOTHING. ` +
    PA_CANON +
    `Never block the task, never commit code.`,
    { phase: 'Implement', label: `concern:${taskId}` },
  )

// DEC-DEV-0117 (§6 detect-leg, fix #4): proactively surface the capability-items the
// PRE-FLIGHT PROBE detected from the feature's external_capabilities manifest — NOT
// waiting for an implementer CONCERN (the S6-silent failure mode). Tracking/disclosure
// format. A BLOCK (no dev stand-in) is DISCLOSED + flagged for the OD7 escalate→await
// leg, whose live execution is the substrate-gated S7 remainder — we never auto-provision
// or mock here. Update-in-place (no duplicate §6 block per feature) for idempotent re-runs.
const surfaceCapability = (capItems) =>
  agent(
    `Pre-flight §6 capability detection found external capabilities this feature DECLARES (its external_capabilities manifest) but the environment does not satisfy.\n` +
    `Record them as ONE tracking section in the canonical pending-actions file. Scan for an existing "§6 capability — ${FEATURE}" block first and UPDATE IT IN PLACE (do not duplicate). For each item record: capability, type (secret/tool), provider (or "TBD → Product / OD8"), provisioning tier, route (Integrator for access; Product for provider CHOICE), disposition, and rationale.\n` +
    `Items: ${JSON.stringify(capItems)}\n` +
    `These are TRACKING / DISCLOSURE, not requests to provision now (real access is a future deliverable per its tier). For a BLOCK disposition (no dev stand-in) note "would block a real run — escalate→await (OD7) when a task needs real access"; do NOT provision or mock anything here. ` +
    PA_CANON +
    `Do NOT block, do NOT commit code. Return a one-line confirmation.`,
    { phase: 'Plan', label: 'capability-surface' },
  )

// ---- Phase 2: implement — sequential per-task FSM --------------------------
phase('Implement')
const implemented = []
const blockedTasks = []
const concerns = []   // FB-013 (DEC-DEV-0081 fix #1): non-blocking implementer CONCERNS, propagated not dropped
const conflicts = []  // DEC-DEV-0096 (T5, FB-LR-07): cross-spec/design contradictions escalated at impl time — surfaced, never self-resolved
const capabilityItems = []  // DEC-DEV-0117 (§6 detect-leg): proactively-detected external-capability gaps, surfaced pre-flight (not awaiting an implementer CONCERN)

// ---- pre-flight §6 capability detect-leg (DEC-DEV-0117; closes #3/#4 of DEC-DEV-0081) ----
// S6 root cause: the §6 channel was a BLOCK-handler, not a gap-DETECTOR — a spec-mandated
// Mock made a deferred provider non-blocking, so the channel stayed silent and a GO shipped
// a real provider seam (DeepL/ElevenLabs/Whisper) hidden behind a stand-in. This DETECT-leg
// makes the orchestrator itself enumerate the feature's DECLARED external_capabilities (FM
// manifest) and disposition the absent ones DETERMINISTICALLY (capability-probe.cjs: block vs
// deferred follows from tier + dev_stand_in, not a heuristic — defusing the dead-/noisy-rule
// risk), BEFORE any task runs — no longer waiting for the implementer to notice. CODE, not LLM
// initiative: the agent only relays the lib's JSON (like the env probe). The ESCALATE→AWAIT
// execution on a BLOCK (OD7 async request→await→resume) is the substrate-gated S7 remainder —
// here a BLOCK is DISCLOSED + tracked, never auto-provisioned/mocked.
const CAP_DETECT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'object' },
    capabilities: { type: 'array', items: { type: 'object' } },
  },
}
{
  const cap = await agent(
    `Run the §6 capability detect-leg probe: \`node ${CAP_PROBE} --feature ${FEATURE} --root .\` via Bash and relay its JSON verbatim ` +
    `(capabilities[] with disposition/routes/surface + summary). Do NOT provision or mock anything — just relay the lib output.`,
    { schema: CAP_DETECT_SCHEMA, phase: 'Plan', label: 'capability-detect' },
  )
  const surfaced = ((cap && cap.capabilities) || []).filter((c) => c && c.surface)
  for (const c of surfaced) capabilityItems.push(c)
  if (surfaced.length) {
    const sum = (cap && cap.summary) || {}
    log(`§6 detect-leg: ${surfaced.length} external-capability item(s) surfaced — ${sum.blocking || 0} BLOCK / ${sum.deferred || 0} deferred / ${sum.provider_choices || 0} provider-choice`)
    await surfaceCapability(surfaced)
  } else {
    log('§6 detect-leg: no surfaced external capability (manifest empty or all satisfied)')
  }
}

for (const task of tasks) {
  log(`task ${task.id} [${task.tier}${task.tier === 'LOW' ? `:${task.profile || '?'}` : ''}] — implementing`)

  // implement (+ one NEEDS_CONTEXT retry)
  let impl = await implement(task)
  if (impl && impl.status === 'NEEDS_CONTEXT') impl = await implement(task, ` Additional context requested: ${impl.missing || ''}.`)

  // DEC-DEV-0096 (T5) — discretion on a BLOCK, BEFORE burning a debug round:
  //  • transient (locked index / flaky install / momentarily-down substrate, FB-LR-08) →
  //    bounded auto-retry, NO debug round consumed (re-probe env first — it may have come up);
  //  • cross-spec-conflict / design-contradiction (FB-LR-07) → ESCALATE, do NOT self-resolve:
  //    record the block with the upstream route + track it; skip the task (no debug, no retry);
  //  • capability / content → fall through to the existing debug→block path.
  let transientRetries = 0
  let escalatedConflict = false
  while (impl && impl.status === 'BLOCKED') {
    const cls = (impl.block_class === 'cross-spec-conflict' || impl.block_class === 'design-contradiction')
      ? impl.block_class                                    // implementer already self-escalated → trust it (conservative)
      : await classifyBlock(task, impl.blocker || 'implementer BLOCKED')
    if (cls === 'cross-spec-conflict' || cls === 'design-contradiction') {
      log(`task ${task.id} → ESCALATED (${cls}) — upstream decision, not self-resolved (FB-LR-07)`)
      conflicts.push({ task: task.id, conflict_class: cls, detail: impl.blocker || '' })
      await recordBlock(task.id, `${cls} — escalate, do NOT self-resolve (FB-LR-07): ${impl.blocker || ''}. Route: Product (cross-spec/requirement contradiction or provider/design choice) or the owning spec's author (design self-contradiction).`)
      escalatedConflict = true
      break
    }
    if (cls === 'transient' && transientRetries < MAX_TRANSIENT_RETRIES) {
      transientRetries += 1
      log(`task ${task.id} transient block (retry ${transientRetries}/${MAX_TRANSIENT_RETRIES}) — re-probing env + retrying, no debug round`)
      await agent(
        `Re-run the env-readiness probe: \`node ${ENV_PROBE}\` via Bash and relay its JSON. Do NOT start any substrate yourself — just report whether it is now up.`,
        { schema: ENV_READINESS_SCHEMA, phase: 'Implement', label: `env-recheck:${task.id}` },
      )
      impl = await implement(task, ` Previous attempt hit a TRANSIENT block (${impl.blocker || ''}); retry ${transientRetries}/${MAX_TRANSIENT_RETRIES}.`)
      continue
    }
    break   // capability / content / transient budget exhausted → existing debug path below
  }
  if (escalatedConflict) {
    blockedTasks.push(task.id)
    continue
  }

  // BLOCKED → debug escalation (capability / content, or transient retries exhausted)
  let debugRounds = 0
  while (impl && impl.status === 'BLOCKED' && debugRounds < MAX_DEBUG_ROUNDS) {
    debugRounds += 1
    const d = await debug(task, impl.blocker || 'implementer BLOCKED')
    if (!d || d.next_action === 'STOP_FOR_HUMAN') { impl = null; break }
    if (d.next_action === 'BLOCK_TASK') { impl = null; break }
    impl = await implement(task, ` Debug FIX_PLAN: ${d.fix_plan || ''}.`)
  }
  if (!impl || impl.status !== 'READY_FOR_REVIEW') {
    log(`task ${task.id} blocked (impl) — recording block + route, skipping`)
    blockedTasks.push(task.id)
    await recordBlock(task.id, (impl && impl.blocker) || 'impl did not reach READY_FOR_REVIEW')
    continue
  }

  // gate by tier (HIGH independent / LOW inline) + bounded remediation
  let verdict = await gate(task, impl)
  let rounds = 0
  while (verdict && verdict.verdict === 'REJECTED' && rounds < MAX_REVIEW_ROUNDS) {
    rounds += 1
    log(`task ${task.id} REJECTED (round ${rounds}) — remediating`)
    impl = await implement(task, ` REMEDIATION for review findings: ${(verdict.findings || []).join('; ')}. ${verdict.remediation || ''}`)
    // reduced re-gate (VC-9): targeted-fix → narrow re-verify, same tier
    verdict = await gate(task, impl)
  }
  // still rejected → one debug round, then block
  if (verdict && verdict.verdict === 'REJECTED') {
    const d = await debug(task, `review still REJECTED after ${MAX_REVIEW_ROUNDS} rounds: ${(verdict.findings || []).join('; ')}`)
    if (d && d.next_action === 'RETRY_TASK') {
      impl = await implement(task, ` Debug FIX_PLAN: ${d.fix_plan || ''}.`)
      verdict = await gate(task, impl)
    }
  }
  if (!verdict || verdict.verdict !== 'APPROVED') {
    log(`task ${task.id} blocked (review) — recording block + route, skipping`)
    blockedTasks.push(task.id)
    await recordBlock(task.id, `review not APPROVED — ${(verdict && (verdict.findings || []).join('; ')) || 'unresolved'}`)
    continue
  }

  // verify-completion (fresh evidence) → selective commit + mark [x]
  await agent(
    `Invoke kiro-verify-completion on the claim that task ${task.id} is complete, using FRESH evidence from current code state (re-run the relevant validation command). If it does not hold, say so — do not rubber-stamp.`,
    { phase: 'Implement', label: `verify-completion:${task.id}` },
  )
  const commit = await agent(
    `Selective commit for task ${task.id}: stage ONLY the changed files (${(impl.files_changed || []).join(', ')}) + ${SPEC_DIR}/tasks.md; mark task ${task.id} [x] in tasks.md; append a one-line ## Implementation Notes entry IF the task revealed a cross-cutting insight. ` +
    `NEVER git add -A / git add . — explicit paths only. ` +
    `FB-005: after staging, run git status --porcelain. If files this task introduced but that fell outside files_changed remain unstaged (lockfile/manifest churn it caused — package.json, pnpm-lock.yaml — or wiring it added, e.g. a worker entrypoint), STAGE THEM into this commit too so the task is committed completely and the tree is clean for the next task. Leave genuinely unrelated/ambient churn (.beads/, integrator project-journal) unstaged. Report any in-boundary file you had to add and any leftover. ` +
    `Commit message: feat(${FEATURE}): ${task.id} ${task.text || ''}. Return the sha.`,
    { schema: COMMIT_SCHEMA, phase: 'Implement', label: `commit:${task.id}` },
  )
  // FB-013 (DEC-DEV-0081 fix #1): propagate a non-blocking CONCERN (deferred-capability /
  // mock-stand-in) rather than dropping it — read it from the final implementer report and
  // route it via surfaceConcern (non-blocking; the task still committed cleanly above).
  if (impl.concerns && impl.concerns.trim()) {
    concerns.push({ task: task.id, concern: impl.concerns.trim() })
    await surfaceConcern(task.id, impl.concerns.trim())
  }
  implemented.push({ id: task.id, tier: task.tier, sha: commit && commit.sha, concern: (impl.concerns && impl.concerns.trim()) || null })
  log(`task ${task.id} ✓ committed ${(commit && commit.sha) || ''}`)
}

// ---- Phase 3: feature-level GO/NO-GO — delegate to full P6 validate-feature-impl ----
// (DEC-DEV-0085, N+1b): the thin inline kiro-validate-impl lift is replaced by the full P6
// process (mechanical layer + 3 parallel validators RA-8/9/10 + verify-finding-before-act).
// P5 DELEGATES via workflow(). FB-010 still holds: the gate runs whenever ANY task landed —
// a single blocked task must NOT suppress it (the feature-level gate is the only check wide
// enough to catch a cross-task seam built by task A but never wired by task B); with blocked
// tasks P6 runs in ADVISORY mode (MANUAL_VERIFY_REQUIRED). FALLBACK: workflow() nesting is
// one level only — if P5 was itself launched nested, the call throws and we fall back to the
// inline kiro-validate-impl lift this phase used before.
phase('Validate')
let go = null
// DEC-DEV-0092: fold the pre-flight readiness + the blocked-tasks DEGRADED state
// into one readiness value (worst-of). P6 returns the AUTHORITATIVE readiness
// (its own mechanical probe ⊕ this hint); the fallback path has no P6 probe, so it
// uses this as the readiness of record.
const RANK = { READY: 0, DEGRADED: 1, ENV_NOT_READY: 2 }
const worstReadiness = (a, b) => (RANK[a] >= RANK[b] ? a : b)
if (implemented.length) {
  const degraded = blockedTasks.length > 0
  const fwdReadiness = degraded ? worstReadiness(envReadiness, 'DEGRADED') : envReadiness
  try {
    const p6 = await workflow({ scriptPath: '.claude/orchestrator/processes/validate-feature-impl.mjs' }, {
      feature: FEATURE,
      specDir: SPEC_DIR,
      oracle: '.claude/orchestrator/lib/coverage-oracle.cjs',
      envProbe: ENV_PROBE,                            // DEC-DEV-0092: shared readiness probe
      readiness: fwdReadiness,                         // DEC-DEV-0092: pre-flight hint (P6 takes worst-of with its own probe)
      validationCommands: (plan && plan.validation_commands) || {},
      concerns,            // FB-013: forward deferred-capability flags so P6 DISCLOSES them at GO
      capabilities: capabilityItems,  // DEC-DEV-0117 (§6 detect-leg): forward proactively-detected external-capability gaps so P6 DISCLOSES them at GO too
      degraded,            // FB-010: blocked tasks → P6 advisory mode
      maxRemediationRounds: 3,
    })
    go = {
      result: (p6 && (p6.result || p6.go_gate)) || 'MANUAL_VERIFY_REQUIRED',
      readiness: (p6 && p6.readiness) || fwdReadiness, // authoritative readiness from P6
      findings: (p6 && p6.findings) || [],
      conflicts: (p6 && p6.conflicts) || [],           // DEC-DEV-0104 (FB-LR-19): carry the gate's escalated conflicts so the P5 envelope can surface them (was dropped — gate escalations were invisible to a machine reading result.conflicts)
    }
    log(`feature GO-gate (P6 validate-feature-impl${degraded ? ', advisory' : ''}): ${go.result} [readiness=${go.readiness}]`)
  } catch (e) {
    // FALLBACK — P6 delegation unavailable: inline kiro-validate-impl lift (advisory, NOT the full P6 gate).
    // NB (DEC-DEV-0091, live-run audit): one-level nesting from this tool-launched P5 IS permitted (validated:
    // docs + 2 empirical nesting tests). The prior by-name call failed ONLY because orchestrator processes are
    // not registered named-workflows; it is now invoked by scriptPath. This catch fires only on a genuinely
    // unresolvable scriptPath — a real degradation, surfaced (not silent) in the returned findings below.
    log(`P6 delegation unavailable (${(e && e.message) || 'scriptPath unresolvable'}) — falling back to inline kiro-validate-impl (advisory)`)
    // FB-013: surface propagated CONCERNS so a deferred real seam (mock-only provider) is DISCLOSED at GO, not hidden.
    const concernNote = concerns.length
      ? ` DEFERRED-CAPABILITY CONCERNS surfaced during impl (FB-013): ${concerns.map((c) => `${c.task}: ${c.concern}`).join(' | ')}. Factor these into the verdict and DISCLOSE them in findings — a GO over a deferred real seam (mock-only provider / unwired skeleton) is GO-with-caveats, not a clean production GO.`
      : ''
    // DEC-DEV-0117 (§6 detect-leg): pre-flight DETECTED external-capability gaps must also be DISCLOSED at GO.
    const capabilityNote = capabilityItems.length
      ? ` §6 DETECTED EXTERNAL-CAPABILITY GAPS (DEC-DEV-0117): ${capabilityItems.map((c) => `${c.capability} [${c.disposition}${c.provider_choice_pending ? ', provider TBD' : ''}]`).join(' | ')}. A GO over a BLOCK or a deferred real provider seam is GO-with-caveats — DISCLOSE these, do not read as a clean production GO.`
      : ''
    go = await agent(
      `Invoke kiro-validate-impl ${FEATURE} as the feature-level GO/NO-GO gate (cross-task consistency, full suite, spec coverage). ` +
      (degraded
        ? `ADVISORY MODE — ${blockedTasks.length} task(s) blocked (${blockedTasks.join(', ')}); the feature is NOT complete. Do NOT remediate. Run the cross-task / integration checks anyway and SURFACE any seams (orphan wiring, unhandled events, missing call-sites) as findings. Return MANUAL_VERIFY_REQUIRED + findings (FB-010: a blocked task must not hide a cross-task gap).`
        : `On NO-GO: fix ONLY the concrete findings, cap at 3 rounds; re-run. Return GO | NO-GO | MANUAL_VERIFY_REQUIRED + findings.`) + concernNote + capabilityNote,
      { schema: GATE_SCHEMA, phase: 'Validate', label: degraded ? 'validate-impl:advisory' : 'validate-impl' },
    )
    // Visibility (DEC-DEV-0091): a degraded gate must never read as a clean GO — surface it in findings.
    if (go) {
      // DEC-DEV-0092: the fallback has no P6 mechanical probe → readiness of record is the pre-flight hint.
      // Enforce the same invariant: ENV_NOT_READY must never be a NO-GO (substrate down ≠ code bad).
      go.readiness = fwdReadiness
      if (fwdReadiness === 'ENV_NOT_READY' && go.result === 'NO-GO') go.result = 'MANUAL_VERIFY_REQUIRED'
      go.findings = [`GATE DEGRADED: P6 delegation failed (${(e && e.message) || 'scriptPath unresolvable'}); used advisory inline kiro-validate-impl, NOT the full P6 gate (mechanical + RA-8/9/10 + verify-finding-before-act). Treat as advisory / GO-with-caveats; re-run \`/orchestrator:run validate-feature-impl --feature ${FEATURE}\` for a ground-truth gate.`].concat(go.findings || [])
    }
    log(`feature GO-gate (fallback kiro-validate-impl${degraded ? ' advisory' : ''}): ${(go && go.result) || 'n/a'} [readiness=${(go && go.readiness) || fwdReadiness}]`)
  }
} else {
  log('skipping GO-gate: no tasks implemented')
}

return {
  feature: FEATURE,
  implemented: implemented.map((t) => t.id),
  blocked: blockedTasks,
  concerns,                       // FB-013 (DEC-DEV-0081 fix #1): deferred-capability flags, propagated not dropped
  capabilities: capabilityItems,  // DEC-DEV-0117 (§6 detect-leg): proactively-detected external-capability gaps (disposition/routes), surfaced pre-flight + disclosed at GO
  conflicts: conflicts.concat((go && go.conflicts) || []),   // DEC-DEV-0096 (T5, FB-LR-07) impl-time escalations ⊕ DEC-DEV-0104 (FB-LR-19) the P6 gate's escalated conflicts. impl-time entries {task, conflict_class, detail}; gate entries {validator, ref, kind, conflict_class, masked}. (Was impl-time only → e.g. Run C glossary returned conflicts:[] despite the gate escalating 2 cross-spec conflicts.)
  findings: (go && go.findings) || [],               // DEC-DEV-0104 (FB-LR-19): surface the gate's findings in the envelope (was captured in `go` but dropped at return → a NO-GO carried no machine-readable reason)
  go_gate: go && go.result,
  readiness: (go && go.readiness) || envReadiness,   // DEC-DEV-0092: READY | DEGRADED | ENV_NOT_READY (orthogonal to go_gate)
}
