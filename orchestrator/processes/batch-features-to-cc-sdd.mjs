export const meta = {
  name: 'batch-features-to-cc-sdd',
  description: 'Orchestrator P3 — route a batch of Product handoffs into cc-sdd specs by feeding kiro-spec-batch (the wave/dispatch/cross-spec engine) from handoffs, wrapped in two deterministic gates cc-sdd lacks: a content-fidelity preflight and an independent coverage oracle.',
  phases: [
    { title: 'Init' },
    { title: 'Steering' },
    { title: 'Bridge' },
    { title: 'Author' },
    { title: 'Coverage' },
    { title: 'Commit' },
  ],
}

/*
 * Orchestrator process P3 `batch-features-to-cc-sdd` — HYBRID design (DEC-DEV-0076,
 * build S5a). Reading: SPEC §3.2; RUN 01 harvest (DEC-DEV-0073); ORCHESTRATOR_BUILD_KICKOFF.
 *
 * WHY HYBRID: cc-sdd's `kiro-spec-batch` skill ALREADY does dependency-wave grouping,
 * parallel per-feature dispatch (kiro-spec-init→requirements→design→tasks), a 10-point
 * cross-spec consistency review (Step 4) and a 3-round fix loop. Re-implementing that
 * was duplication. So this process does NOT rebuild it — it WRAPS it with the two
 * things cc-sdd cannot do from Product handoffs:
 *   1. a programmatic substitute for kiro-discovery (which is disable-model-invocation
 *      + interactive): the handoff→brief.md/roadmap bridge, gated by the adapter's
 *      content-fidelity preflight (C-07);
 *   2. an independent, deterministic coverage oracle (P1-1) — code over ground truth,
 *      complementing cc-sdd's LLM consistency review.
 *
 * DETERMINISM MODEL (SPEC §2): this script is the Layer-1 SKELETON — phase order +
 * the deterministic gates are strict control flow. Layer-2 JUDGMENT (spec authoring,
 * cross-spec review) is delegated to cc-sdd inside the Author phase. Layer-3 GATES are
 * the helpers (adapter C-07 preflight + coverage-oracle): an agent runs the helper via
 * Bash and relays its JSON — the verdict comes from CODE, not the agent's judgment.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): Workflow scripts have NO filesystem / Node
 * API access and no Date.now()/Math.random(). Every file read / adapter run / oracle
 * run / kiro skill invocation / git commit happens INSIDE an agent() call (agents have
 * Bash/Read/Write/Skill). Inputs arrive via `args`; timestamps are stamped outside.
 *
 * SMOKE: this file is validated by tests/orchestrator/workflow-syntax.smoke.cjs (the
 * harness Workflow dialect — top-level await/return + `export const meta` — is not
 * plain ESM, so `node --check` does not apply). A live cc-sdd run needs a pilot
 * (separate session); the nested-subagent caveat below is the live-run open question.
 */

// ---- inputs (args; defaults are the pilot install paths) -------------------
// FB-001 (live-run RUN 01): defend against stringified args — the harness passes `args`
// verbatim and an invoking agent may pass a JSON string (args:"{...}") instead of an
// object, leaving A.handoffs silently undefined. See feature-to-tdd-impl.mjs.
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const HANDOFFS = A.handoffs || []                         // [".product/handoffs/FM-001-handoff.md", ...]
const ADAPTER = A.adapter || '.claude/integrator/adapters/handoff-to-ccsdd.js'
const ORACLE = A.oracle || '.claude/orchestrator/lib/coverage-oracle.cjs'
const STACK_DECIDED = A.stackDecided !== false            // P2/user decided the stack (S5a assumes yes)

// FB-002 (live-run RUN 01): refuse to run with no handoffs rather than spinning up
// Init+Steering only to halt at the Bridge. (--all must be expanded to explicit paths by
// the /orchestrator:run command before invoking this Workflow.)
if (!HANDOFFS.length) {
  log('HALT: no handoffs (empty args.handoffs). Pass args as an OBJECT, e.g. {handoffs:["...FM-001-handoff.md"]}.')
  return { specced: [], blocked: [], reason: 'empty handoffs (FB-002 guard)' }
}

// ---- verification-gate schemas (Layer-3) -----------------------------------
const BRIDGE_SCHEMA = {
  type: 'object',
  required: ['feature', 'slug', 'passed'],
  properties: {
    feature: { type: 'string' },          // FM-NNN
    slug: { type: 'string' },             // cc-sdd feature slug
    passed: { type: 'boolean' },          // adapter exit 0 + C-07 pass → brief written
    experimental: { type: 'boolean' },    // C-06 (status: partial)
    brief_path: { type: 'string' },       // .kiro/specs/<slug>/brief.md
    roadmap_line: { type: 'string' },     // the "## Specs (dependency order)" line written
    source_ids: {
      type: 'object',
      properties: {
        scenarios: { type: 'array', items: { type: 'string' } },
        rules: { type: 'array', items: { type: 'string' } },
        invariants: { type: 'array', items: { type: 'string' } },
      },
    },
    reason: { type: 'string' },           // when blocked: route (product|integrator) + cause
  },
}

const BATCH_SCHEMA = {
  type: 'object',
  required: ['specced'],
  properties: {
    specced: { type: 'array', items: { type: 'string' } },   // features that got a full spec
    failed: { type: 'array', items: { type: 'string' } },
    cross_spec: { type: 'string' },                          // PASSED | N issues (M fixed)
    note: { type: 'string' },
  },
}

const COVERAGE_SCHEMA = {
  type: 'object',
  required: ['feature', 'passed'],
  properties: {
    feature: { type: 'string' },
    passed: { type: 'boolean' },          // coverage-oracle exit 0
    missing: {
      type: 'object',
      properties: {
        scenarios: { type: 'array', items: { type: 'string' } },
        rules: { type: 'array', items: { type: 'string' } },
        invariants: { type: 'array', items: { type: 'string' } },
      },
    },
    self_report_flags: { type: 'array', items: { type: 'string' } },  // omissions/fabrications
  },
}

const COMMIT_SCHEMA = {
  type: 'object',
  required: ['committed'],
  properties: {
    committed: { type: 'boolean' },
    sha: { type: 'string' },
    paths: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
}

// ===========================================================================

// ---- Phase 1: init --------------------------------------------------------
phase('Init')
const init = await agent(
  `Run the orchestrator-init regimen (skills/orchestrator/orchestrator-init.md). ` +
  `Confirm cc-sdd is wired + active in .claude/integrator/active-tools.yaml and that the kiro-spec-batch skill is installed; confirm zones D2-T01/T06 covered in pmo-mapping.yaml; ` +
  `map the .product/ handoff batch (${HANDOFFS.length ? HANDOFFS.join(', ') : 'all status: ready|partial in .product/handoffs/'}); ` +
  `run the env-readiness-probe. Return a one-paragraph init summary + whether the batch is routable. If cc-sdd / kiro-spec-batch is NOT present, say so plainly — do NOT improvise a substitute.`,
  { phase: 'Init', label: 'init' },
)
log(`init: ${init ? 'context gathered' : 'init returned nothing'}`)

// ---- Phase 2: steering (delegate to kiro-steering) ------------------------
phase('Steering')
await agent(
  `Run the build-steering regimen (skills/orchestrator/build-steering.md). DELEGATE to cc-sdd's kiro-steering skill to bootstrap/sync .kiro/steering/{product,tech,structure}.md. ` +
  `The tech stack is ${STACK_DECIDED ? 'DECIDED — ensure tech.md pins it with explicit versions + a compatibility matrix' : 'NOT decided — STOP and request it; do not let a stack be inferred silently'}. ` +
  `Supplement product.md with .product/ framing. Do NOT build roadmap.md "## Specs" here (that is the bridge's job). Return the stack + pinned versions in one line.`,
  { phase: 'Steering', label: 'steering' },
)

// ---- Phase 3: bridge — handoff → brief.md + roadmap line (+ preflight C-07) -
// One agent per handoff (programmatic substitute for kiro-discovery). BARRIER: we need
// the full set of briefs + roadmap lines before kiro-spec-batch can wave-group.
phase('Bridge')
const bridged = (await parallel(
  HANDOFFS.map((h) => () =>
    agent(
      `Run the build-briefs-from-handoff bridge (skills/orchestrator/build-briefs-from-handoff.md) for one handoff: ${h}\n` +
      `1) PREFLIGHT (blocking): node ${ADAPTER} --verify-only --fixture ${h} — require exit 0 AND contract_validation.passed:true AND C-07 status:pass. ` +
      `On any C-07 fail / parse error set passed=false with reason routing to product|integrator; do NOT write a brief from a clobbered handoff.\n` +
      `2) Capture ground-truth ids: node ${ORACLE} --handoff ${h}\n` +
      `3) Write .kiro/specs/<slug>/brief.md from the adapter's cc_sdd_input (embed the must-cover source ids).\n` +
      `4) Write/append the .kiro/steering/roadmap.md "## Specs (dependency order)" line (FM-NNN + Dependencies from §12) in kiro-spec-batch's exact format.\n` +
      `Set experimental=true if handoff status is partial. Return the Bridge verdict.`,
      { schema: BRIDGE_SCHEMA, phase: 'Bridge', label: `bridge:${h}` },
    ),
  ),
)).filter(Boolean)

const ready = bridged.filter((b) => b.passed)
const blocked = bridged.filter((b) => !b.passed)
if (blocked.length) log(`bridge blocked ${blocked.length}: ${blocked.map((b) => `${b.feature}(${b.reason || 'C-07'})`).join(', ')}`)

let result
if (!ready.length) {
  log('no handoffs passed preflight — nothing to route. Halting before kiro-spec-batch.')
  result = { specced: [], blocked: blocked.map((b) => ({ feature: b.feature, reason: b.reason })), reason: 'all handoffs failed preflight' }
} else {
  // ---- Phase 4: author — invoke cc-sdd's kiro-spec-batch engine ------------
  // cc-sdd owns wave-grouping, parallel dispatch, and the 10-point cross-spec review +
  // fix loop. We invoke it; we do NOT reimplement it.
  phase('Author')
  const batch = await agent(
    `Invoke cc-sdd's kiro-spec-batch skill to generate specs for the batch we just bridged: ${ready.map((b) => b.slug).join(', ')}. ` +
    `It reads .kiro/steering/roadmap.md "## Specs (dependency order)" + each .kiro/specs/<slug>/brief.md, builds dependency waves, dispatches per-feature spec subagents, runs its cross-spec consistency review + fix loop, and finalizes. ` +
    `If nested subagent dispatch is unavailable in this context, fall back to running the kiro-spec-* pipeline (init→requirements→design→tasks) per feature yourself, in dependency-wave order, then run kiro-spec-batch's Step 4 cross-spec review prompt once. ` +
    `Return which features got a complete spec (spec.json + requirements.md + design.md + tasks.md), which failed, and the cross-spec review outcome.`,
    { schema: BATCH_SCHEMA, phase: 'Author', label: 'kiro-spec-batch' },
  )
  const specced = (batch && batch.specced) || []
  log(`kiro-spec-batch: specced ${specced.length} — ${specced.join(', ')}; cross-spec: ${(batch && batch.cross_spec) || 'n/a'}`)

  // ---- Phase 5: coverage gate (deterministic, independent of self-report) --
  phase('Coverage')
  const coverage = (await parallel(
    ready.filter((b) => specced.includes(b.slug) || specced.includes(b.feature)).map((b) => () =>
      agent(
        `Run the coverage-oracle gate (skills/orchestrator/coverage-oracle.md) for ${b.feature} (slug ${b.slug}).\n` +
        `node ${ORACLE} --handoff <its handoff> --spec .kiro/specs/${b.slug}/requirements.md --spec .kiro/specs/${b.slug}/design.md ` +
        `--self-report '${JSON.stringify([].concat((b.source_ids || {}).scenarios || [], (b.source_ids || {}).rules || [], (b.source_ids || {}).invariants || []))}'.\n` +
        `passed = exit 0. Report coverage.families.*.missing + any self_report_cross_check flags. Do NOT eyeball coverage — relay the helper's JSON.`,
        { schema: COVERAGE_SCHEMA, phase: 'Coverage', label: `coverage:${b.feature}` },
      ),
    ),
  )).filter(Boolean)
  const incomplete = coverage.filter((c) => !c.passed)
  if (incomplete.length) log(`coverage incomplete for ${incomplete.length}: ${incomplete.map((c) => c.feature).join(', ')} — re-run kiro-spec-* for the missing ids before commit.`)

  // ---- Phase 6: selective commit ------------------------------------------
  phase('Commit')
  const commit = await agent(
    `Commit ONLY the authored cc-sdd specs + steering + briefs for this batch: ` +
    `git add .kiro/specs/ .kiro/steering/ and commit (feat(specs): batch ${specced.join('+')} → cc-sdd specs). ` +
    `Do NOT add unrelated files (ambient .beads/ churn, project-journal). Return the sha.`,
    { schema: COMMIT_SCHEMA, phase: 'Commit', label: 'commit' },
  )

  result = {
    specced,
    blocked: blocked.map((b) => ({ feature: b.feature, reason: b.reason })),
    cross_spec: (batch && batch.cross_spec) || null,
    coverage_incomplete: incomplete.map((c) => c.feature),
    commit,
  }
}

return result
