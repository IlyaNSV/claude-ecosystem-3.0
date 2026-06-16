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
const KIRO_TPL = A.kiroTemplates || '.claude/skills/kiro-impl/templates'
const REGISTRY = A.registry || ''                                // optional load-bearing.<FM>.yaml/json
const MAX_REVIEW_ROUNDS = A.maxReviewRounds || 2
const MAX_DEBUG_ROUNDS = A.maxDebugRounds || 2

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
    concerns: { type: 'string' },
    blocker: { type: 'string' },
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

// ---- lifted-prompt dispatch helpers ---------------------------------------
const implement = (task, extra = '') =>
  agent(
    `Read ${KIRO_TPL}/implementer-prompt.md and apply it (TDD: RED→GREEN→REFACTOR) to task ${task.id}: "${task.text || ''}".\n` +
    `Spec: ${SPEC_DIR}/{requirements,design,tasks}.md. Requirements §: ${(task.requirements || []).join(', ')}. _Boundary_: ${task.boundary || 'n/a'}. ` +
    `Validation commands: ${JSON.stringify((plan && plan.validation_commands) || {})}. ${task.behavioral ? 'BEHAVIORAL — apply the Feature Flag Protocol.' : 'Non-behavioral.'}\n` +
    `FB-006: do NOT make project-global changes outside your _Boundary_ — never alter git core.hooksPath, root package.json lifecycle scripts (prepare/postinstall), or install hook-managing tooling (e.g. husky) that hijacks git hooks (the pilot's beads owns core.hooksPath). If the task seems to require it, return BLOCKED and surface it rather than silently doing it.\n` +
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

// ---- Phase 2: implement — sequential per-task FSM --------------------------
phase('Implement')
const implemented = []
const blockedTasks = []

for (const task of tasks) {
  log(`task ${task.id} [${task.tier}${task.tier === 'LOW' ? `:${task.profile || '?'}` : ''}] — implementing`)

  // implement (+ one NEEDS_CONTEXT retry)
  let impl = await implement(task)
  if (impl && impl.status === 'NEEDS_CONTEXT') impl = await implement(task, ` Additional context requested: ${impl.missing || ''}.`)

  // BLOCKED → debug escalation
  let debugRounds = 0
  while (impl && impl.status === 'BLOCKED' && debugRounds < MAX_DEBUG_ROUNDS) {
    debugRounds += 1
    const d = await debug(task, impl.blocker || 'implementer BLOCKED')
    if (!d || d.next_action === 'STOP_FOR_HUMAN') { impl = null; break }
    if (d.next_action === 'BLOCK_TASK') { impl = null; break }
    impl = await implement(task, ` Debug FIX_PLAN: ${d.fix_plan || ''}.`)
  }
  if (!impl || impl.status !== 'READY_FOR_REVIEW') {
    log(`task ${task.id} blocked (impl) — appending _Blocked_, skipping`)
    blockedTasks.push(task.id)
    await agent(`Append "_Blocked: ${(impl && impl.blocker) || 'impl did not reach READY_FOR_REVIEW'}_" under task ${task.id} in ${SPEC_DIR}/tasks.md. Do not commit code.`, { phase: 'Implement', label: `block:${task.id}` })
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
    log(`task ${task.id} blocked (review) — appending _Blocked_, skipping`)
    blockedTasks.push(task.id)
    await agent(`Append "_Blocked: review not APPROVED — ${(verdict && (verdict.findings || []).join('; ')) || 'unresolved'}_" under task ${task.id} in ${SPEC_DIR}/tasks.md.`, { phase: 'Implement', label: `block:${task.id}` })
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
  implemented.push({ id: task.id, tier: task.tier, sha: commit && commit.sha })
  log(`task ${task.id} ✓ committed ${(commit && commit.sha) || ''}`)
}

// ---- Phase 3: feature-level GO/NO-GO (lift kiro-validate-impl) -------------
phase('Validate')
// FB-010 (live-run RUN 01): run the feature-level gate whenever ANY task landed — a
// single blocked task must NOT suppress it. The GO-gate (kiro-validate-impl) is the only
// check wide enough to catch cross-task integration seams (a method built by task A but
// never wired by task B passes both per-task reviews). Previously `!blockedTasks.length`
// skipped it on any block, which masked exactly such a gap. With blocked tasks we run it
// in ADVISORY mode: surface cross-task findings, do not remediate, never claim GO.
let go = null
if (implemented.length) {
  const degraded = blockedTasks.length > 0
  go = await agent(
    `Invoke kiro-validate-impl ${FEATURE} as the feature-level GO/NO-GO gate (cross-task consistency, full suite, spec coverage). ` +
    (degraded
      ? `ADVISORY MODE — ${blockedTasks.length} task(s) blocked (${blockedTasks.join(', ')}); the feature is NOT complete. Do NOT remediate. Run the cross-task / integration checks anyway and SURFACE any seams (orphan wiring, unhandled events, missing call-sites) as findings. Return MANUAL_VERIFY_REQUIRED + findings (FB-010: a blocked task must not hide a cross-task gap).`
      : `On NO-GO: fix ONLY the concrete findings, cap at 3 rounds; re-run. Return GO | NO-GO | MANUAL_VERIFY_REQUIRED + findings.`),
    { schema: GATE_SCHEMA, phase: 'Validate', label: degraded ? 'validate-impl:advisory' : 'validate-impl' },
  )
  log(`feature GO-gate${degraded ? ' (advisory — blocked tasks present)' : ''}: ${(go && go.result) || 'n/a'}`)
} else {
  log('skipping GO-gate: no tasks implemented')
}

return {
  feature: FEATURE,
  implemented: implemented.map((t) => t.id),
  blocked: blockedTasks,
  go_gate: go && go.result,
}
