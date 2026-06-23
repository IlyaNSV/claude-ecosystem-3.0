export const meta = {
  name: 'audit-spec-fidelity',
  description: 'Orchestrator P4 — audit generated cc-sdd specs against the .product source for FIDELITY drift, before impl. Deterministic trace-integrity (fidelity-oracle) + an LLM fidelity-auditor; each drift is triaged to spec-fix (Orchestrator zone) or product-feedback (→Product, OD8); spec-fixes are auto-re-audited.',
  phases: [
    { title: 'Init' },
    { title: 'Audit' },
    { title: 'Triage' },
  ],
}

/*
 * Orchestrator process P4 `audit-spec-fidelity` (build N+1a, DEC-DEV pending; kickoff
 * dev/ORCHESTRATOR_P4_P6_KICKOFF.md). Reading: SPEC §3.2 P4 / §3.3 RA-5; RUN_01 §1 E3 / §5 P1-2.
 *
 * WHY P4: a spec can be fully PRESENT (coverage-oracle green) and internally CONSISTENT
 * (cc-sdd cross-spec review green) yet still DISTORT the .product intent it was generated
 * from (RUN 01: NFR backoff contradicting BR-040, stale event names, a FABRICATED trace
 * IC-013 no product artifact defines). P4 is the spec-vs-.product faithfulness axis,
 * distinct from C-07 (handoff→brief mapping), coverage-oracle (presence), and cross-spec
 * review (specs agree with each other). It runs BETWEEN P3 and P5.
 *
 * TWO LAYERS (determinism model §2):
 *   Layer-3 deterministic — fidelity-oracle.cjs trace-integrity: every id the spec
 *     references must EXIST in the .product ground truth; a dangling ref = fabrication.
 *     Run via an agent+Bash, relay JSON — the verdict is CODE, not judgment.
 *   Layer-2 semantic — the inline fidelity-auditor role: value mismatches, contradicted/
 *     re-scoped rules, stale entities, weakened acceptance — with a route + severity.
 *
 * TRIAGE: spec-defect → VERIFY each semantic drift against ground truth first (verify-finding-
 *   before-act, parity with P6 — DEC-DEV-0087; refuted drifts dropped, never fixed) → fix the
 *   spec (own zone) + AUTO-RE-AUDIT (P1-2); product-defect →
 * record a product-feedback item in pending-actions (route:product — OD8 reverse channel),
 * do NOT edit .product/ or patch the spec around it.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script.
 * Every file read / oracle run / fix / commit happens INSIDE an agent(); inputs via args.
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect) +
 * tests/orchestrator/audit-fidelity-wiring.test.cjs (static invariants). Live needs a pilot.
 */

// FB-001: defend against stringified args — the harness forwards `args` verbatim and an
// invoking agent may pass a JSON string (args:"{...}") instead of an object. (Keep the
// comment ABOVE this line: the args-parsing regression test evals the `const A =` line.)
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURES = A.features || []                                        // [cc-sdd slugs] to audit
const SPEC_BASE = A.specBase || '.kiro/specs'
const ORACLE = A.oracle || '.claude/orchestrator/lib/fidelity-oracle.cjs'
const COVERAGE_ORACLE = A.coverageOracle || '.claude/orchestrator/lib/design-coverage-oracle.cjs' // DEC-DEV-0095: design→tasks structural coverage (FB-LR-05)
const MAX_REAUDIT_ROUNDS = A.maxReauditRounds || 2

// FB-002: refuse to run with no target rather than scanning .kiro/specs/ and picking one.
if (!FEATURES.length) {
  log('HALT: empty features — refusing to run (FB-002). Pass args as an OBJECT, e.g. {features:["localization"]}.')
  return { error: 'audit-spec-fidelity: empty features (FB-002 guard)', audited: [], faithful: [], residual: [] }
}

// Inline fidelity-auditor role (RA-5) — per D.1 it is inlined here, not readFileSync'd.
const FIDELITY_AUDITOR = [
  'Act as the fidelity-auditor (RA-5). You compare a GENERATED spec to the .product SOURCE it was',
  'generated from and report SEMANTIC drift the deterministic oracle cannot see. Check for:',
  '(a) value mismatch — a spec number/threshold/timeout that contradicts the BR/NFR/IC it cites',
  '    (RUN 01: NFR-004/005 backoff vs BR-040); (b) a product rule the spec contradicts or silently',
  '    re-scopes; (c) stale/renamed entities or event names; (d) an acceptance criterion that drops or',
  '    WEAKENS a product constraint. For each drift give: the cited id (if any), kind, a one-line detail,',
  'a ROUTE — spec (the spec misrepresents a correct product → fixable here) vs product (the .product',
  'canon is itself wrong / under-specified / needs a business decision → goes to Product, not fixed here)',
  '— and severity (high|medium|low). consumer-conforms-to-owner: a downstream spec disagreeing with an',
  'upstream/shared spec or with .product conforms to the owner; it does not redefine the contract.',
].join(' ')

// ---- schemas ---------------------------------------------------------------
const AUDIT_SCHEMA = {
  type: 'object',
  required: ['feature', 'faithful'],
  properties: {
    feature: { type: 'string' },
    trace_integrity_passed: { type: 'boolean' },         // fidelity-oracle exit 0 (no dangling refs)
    dangling: { type: 'array', items: { type: 'string' } },
    faithful: { type: 'boolean' },                       // no dangling AND no semantic drift
    drifts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'route', 'severity'],
        properties: {
          ref: { type: 'string' },                       // cited id, if any
          kind: { type: 'string' },                      // value-mismatch | contradiction | stale-entity | weakened-acceptance | missing-trace-source
          detail: { type: 'string' },
          route: { type: 'string', enum: ['spec', 'product'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const FIX_SCHEMA = {
  type: 'object',
  required: ['feature', 'fixed'],
  properties: {
    feature: { type: 'string' },
    fixed: { type: 'boolean' },                          // the spec-route drifts were fixed in the spec
    note: { type: 'string' },
  },
}

// DEC-DEV-0095 (FB-LR-05): design→tasks structural-coverage result. Deterministic candidates
// from design-coverage-oracle.cjs + a semantic confirm (naming/path variance) → CONFIRMED gaps.
const COVERAGE_SCHEMA = {
  type: 'object',
  required: ['feature', 'gaps'],
  properties: {
    feature: { type: 'string' },
    oracle_uncovered: { type: 'array', items: { type: 'string' } },   // raw deterministic candidates (basename in no task)
    gaps: {                                                            // confirmed after semantic check
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'detail', 'severity'],
        properties: {
          path: { type: 'string' },                                   // design file/module no task builds
          kind: { type: 'string', enum: ['uncovered-design-file', 'dangling-forward-ref'] },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['disposition'],
  properties: {
    // DEC-DEV-0093 (FB-LR-03/13): ORDER-AWARE verify — classify against BOTH the current
    // spec AND the pre-gate baseline sha, so a drift the auditor flagged but that the spec
    // already matches (a prior round / racing committer fixed it) is not mislabelled a
    // "hallucination" and re-fixed, and a genuinely-resolved drift is surfaced not dropped.
    disposition: { type: 'string', enum: ['present', 'already-resolved', 'refuted'] },
    confirmed: { type: 'boolean' },                      // present || already-resolved (the drift WAS/IS real)
    evidence: { type: 'string' },                        // what the inspection found in current spec vs baseline + the .product source
  },
}

// ---- audit one feature (deterministic oracle + semantic auditor) -----------
const auditOne = (feature, extra = '') =>
  agent(
    `Fidelity-audit the cc-sdd spec for feature "${feature}" against its .product source.\n` +
    `1) Resolve the .product ground-truth files for ${feature}: its handoff (.product/handoffs/) + the FM/SC/BR/IC/NFR artifacts it traces.\n` +
    `2) DETERMINISTIC trace-integrity (do NOT eyeball): node ${ORACLE} --source <each resolved source> --spec ${SPEC_BASE}/${feature}/requirements.md --spec ${SPEC_BASE}/${feature}/design.md --spec ${SPEC_BASE}/${feature}/tasks.md. ` +
    `Relay trace_integrity.passed + every dangling ref (the cited id has NO source in .product — kind:missing-trace-source [FB-LR-12: the id may be a real owned contract, the source is what's missing — NOT an accusation it was fabricated], route:spec unless the id SHOULD exist in product, then route:product).\n` +
    `3) SEMANTIC pass: ${FIDELITY_AUDITOR}\n` +
    `faithful = (trace_integrity_passed AND no semantic drifts). Return the audit verdict.${extra}`,
    { schema: AUDIT_SCHEMA, phase: 'Audit', label: `audit:${feature}` },
  )

// ---- design→tasks structural coverage (DEC-DEV-0095, FB-LR-05) — HYBRID: deterministic oracle
// candidate list + semantic confirm (naming/path variance). Surfaces a design file/module the
// design says to build that NO task owns (the unmounted-API gap none of the other oracles see —
// coverage-oracle=requirement→presence, fidelity-oracle=spec→.product, RA-10=cross-task seams
// POST-impl). Conservative: returns only CONFIRMED gaps; this layer SURFACES + routes
// (spec-completion), it does NOT auto-add tasks (a missing task is for the spec author / P3).
const coverageAudit = (feature) =>
  agent(
    `Structural design→tasks coverage check for feature "${feature}" (FB-LR-05).\n` +
    `1) DETERMINISTIC candidates (do NOT eyeball): node ${COVERAGE_ORACLE} --design ${SPEC_BASE}/${feature}/design.md --tasks ${SPEC_BASE}/${feature}/tasks.md. ` +
    `Relay oracle_uncovered (each design File-Structure file whose basename appears in NO task) + forward_refs (T4-lite dangling deferrals).\n` +
    `2) SEMANTIC confirm each candidate against ground truth (read design.md + tasks.md): is the file/module genuinely OWNED BY NO task, ` +
    `allowing for naming/path variance (a task _Boundary_ "src/admin/" owns "src/admin/admin.module.ts"; a renamed/merged/inlined file IS covered)? ` +
    `Keep ONLY real gaps — a file some task plausibly builds is NOT a gap (drop it). For a forward_ref, confirm NO concrete task does the deferred wiring.\n` +
    `Return gaps[] (kind: uncovered-design-file | dangling-forward-ref; path; detail = why it stays unbuilt + the impact, e.g. "assembly module no task creates → routes/providers mount nothing"; ` +
    `severity — an unmounted entrypoint/module/router is high). gaps:[] if every design file is owned by some task.`,
    { schema: COVERAGE_SCHEMA, phase: 'Audit', label: `coverage:${feature}` },
  )

// ---- verify-finding-before-act (parity with P6, DEC-DEV-0087) --------------
// The deterministic oracle's trace-integrity (kind:missing-trace-source = a dangling ref) is already
// confirmed BY CODE — never re-verified. But a SEMANTIC drift from the LLM fidelity-auditor is
// judgment, and P4 EDITS + COMMITS the spec on it. So before any spec-fix each semantic drift is
// CONFIRMED against ground truth (grep the spec + the .product source it cites); a refuted drift is
// DROPPED, not fixed — P4 must not rewrite a spec around a hallucinated drift (the gap vs P6, closed).
const verifyDrift = (feature, d) =>
  agent(
    `Verify-finding-before-act (ORDER-AWARE, DEC-DEV-0093): the fidelity-auditor flagged a possible SPEC drift in feature "${feature}" — ` +
    `kind: ${d.kind}; ref: ${d.ref || 'n/a'}; detail: ${d.detail || ''}.\n` +
    `Inspect the .product source it cites (handoff + the FM/SC/BR/IC/NFR artifact) against TWO spec states: (1) the CURRENT ` +
    `spec ${SPEC_BASE}/${feature}/{requirements,design,tasks}.md, and (2) the pre-gate BASELINE ` +
    `${BASELINE ? `commit ${BASELINE} — use \`git show ${BASELINE}:${SPEC_BASE}/${feature}/<file>\` to read it` : '(baseline sha unavailable → inspect the current spec only)'}.\n` +
    `Classify the disposition:\n` +
    `  • present          — the CURRENT spec genuinely misrepresents / contradicts / weakens the product (concrete evidence both sides) → real & needs a spec-fix.\n` +
    `  • already-resolved — the current spec MATCHES the product, but the baseline spec had the drift → it WAS real and the spec has already been fixed since the gate started; do NOT re-fix, surface it.\n` +
    `  • refuted          — the spec matches the product in BOTH current and baseline → the auditor misread; a hallucination → drop.\n` +
    `${BASELINE ? '' : 'With no baseline, use present (current spec drifts) or refuted (matches) only.\n'}` +
    `confirmed = (disposition !== 'refuted'). Return disposition + confirmed + evidence (cite current spec vs baseline vs product).`,
    { schema: VERIFY_SCHEMA, phase: 'Triage', label: `verify-drift:${feature}:${d.ref || d.kind}` },
  )

// ---- Phase 1: init ---------------------------------------------------------
phase('Init')
await agent(
  `Run orchestrator-init (skills/orchestrator/orchestrator-init.md), then load audit-spec-fidelity ` +
  `(skills/orchestrator/audit-spec-fidelity.md) for context. Confirm each feature has a generated spec ` +
  `(${FEATURES.map((f) => `${SPEC_BASE}/${f}/{requirements,design,tasks}.md`).join('; ')}) and that ${ORACLE} exists. ` +
  `If a spec is missing, note it — do NOT improvise. One-paragraph readiness summary.`,
  { phase: 'Init', label: 'init' },
)

// pre-gate baseline (DEC-DEV-0093, FB-LR-03): the spec snapshot for ORDER-AWARE verifyDrift —
// captured BEFORE any spec-fix so a confirmer can tell "refuted (spec never drifted)" from
// "already-resolved (spec drifted at baseline, fixed since)". No FS in the script (D.1) → agent.
const BASELINE_SCHEMA = { type: 'object', required: ['sha'], properties: { sha: { type: 'string' } } }
const base = await agent(
  `Capture the pre-gate baseline: run \`git rev-parse HEAD\` via Bash and return its sha. ` +
  `This is the spec snapshot before any fidelity spec-fix — do NOT commit or change anything.`,
  { schema: BASELINE_SCHEMA, phase: 'Init', label: 'baseline' },
)
const BASELINE = (base && base.sha) || ''
log(`baseline sha for order-aware verify: ${BASELINE || '(unavailable — verify falls back to current-spec-only)'}`)

// ---- Phase 2: audit (parallel per feature) — fidelity (RA-5) + structural coverage (T4) ----
phase('Audit')
const audits = (await parallel(FEATURES.map((f) => () => auditOne(f)))).filter(Boolean)
const faithful = audits.filter((a) => a.faithful).map((a) => a.feature)
const drifting = audits.filter((a) => a && !a.faithful)
log(`audit: ${faithful.length}/${audits.length} faithful; drifting: ${drifting.map((a) => a.feature).join(', ') || '∅'}`)

// DEC-DEV-0095 (FB-LR-05): design→tasks structural coverage — orthogonal to fidelity (a spec can
// be 100% faithful to .product yet still leave a design module unbuilt). Run per feature in parallel.
const coverage = (await parallel(FEATURES.map((f) => () => coverageAudit(f)))).filter(Boolean)
const coveredFeatures = coverage.filter((c) => c && c.gaps && c.gaps.length)
log(`coverage: ${coveredFeatures.length}/${coverage.length} feature(s) with design→tasks gap(s): ${coveredFeatures.map((c) => c.feature).join(', ') || '∅'}`)

// ---- Phase 3: triage + fix (spec) / route (product) + auto-re-audit --------
phase('Triage')
const productRouted = []
const specFixed = []
const residual = []
const coverageGaps = []

for (const a of drifting) {
  const productDrifts = (a.drifts || []).filter((d) => d.route === 'product')
  const specDrifts = (a.drifts || []).filter((d) => d.route === 'spec')

  // product-defects → reverse channel to Product (OD8); never edit .product/ or patch the spec around it
  if (productDrifts.length) {
    await agent(
      `Feature ${a.feature}: ${productDrifts.length} fidelity drift(s) routed to PRODUCT (the .product canon ` +
      `itself is wrong / under-specified / needs a business decision): ${productDrifts.map((d) => `${d.ref || d.kind}: ${d.detail || ''}`).join(' | ')}.\n` +
      `Write a product-feedback entry to .claude/pending-actions.md (create if absent) with route: product, the affected ids, and the rationale. ` +
      `DEDUP (FB-LR-10, repeated-run idempotency): FIRST scan the file for an OPEN pending-action that already routes feature ${a.feature} + the same affected ids to product. ` +
      `If one exists, UPDATE it in place (refresh detail/severity; do not duplicate) instead of appending — only APPEND when no open PA matches that (feature, route:product, ids) signature. Match on (feature, route, ids), NOT the drift wording (it varies run-to-run). ` +
      `Do NOT edit .product/ and do NOT patch the spec around it (OD8 reverse channel). Do NOT commit code.`,
      { phase: 'Triage', label: `product-route:${a.feature}` },
    )
    productRouted.push({ feature: a.feature, drifts: productDrifts.length })
  }

  // spec-defects → fix the spec, then AUTO-RE-AUDIT (P1-2: remediation can introduce new drift)
  if (specDrifts.length) {
    let round = 0
    let current = a
    let fixedOk = false
    while (round < MAX_REAUDIT_ROUNDS) {
      round += 1
      const curSpecDrifts = (current.drifts || []).filter((d) => d.route === 'spec')
      if (!curSpecDrifts.length) { fixedOk = true; break }
      // ORDER-AWARE verify-finding-before-act (DEC-DEV-0087 + DEC-DEV-0093): missing-trace-source is
      // oracle-confirmed by code (present); each SEMANTIC drift is classified against the current
      // spec AND the pre-gate baseline. present → fix; already-resolved → spec already matches
      // product (don't re-fix, surface); refuted → auditor hallucination → dropped.
      const presentDrifts = []
      for (const d of curSpecDrifts) {
        if (d.kind === 'missing-trace-source') { presentDrifts.push(d); continue }   // deterministic oracle — already real & present
        const v = await verifyDrift(current.feature, d)
        if (!v) continue
        if (v.disposition === 'present') presentDrifts.push({ ...d, evidence: v.evidence })
        else if (v.disposition === 'already-resolved') log(`drift ${d.ref || d.kind} (${current.feature}) already-resolved vs baseline — current spec matches product; NOT re-fixed (DEC-DEV-0093)`)
        else log(`drift ${d.ref || d.kind} (${current.feature}) refuted by ground-truth check — dropped, NOT fixed`)
      }
      if (!presentDrifts.length) { fixedOk = true; break }   // nothing real & present → no spec drift to fix
      const fix = await agent(
        `Feature ${current.feature}: fix the SPEC so it faithfully matches the .product source (consumer-conforms-to-owner). ` +
        `Fix ONLY these CONFIRMED-PRESENT spec drifts (each verified against ground truth — touch nothing else): ` +
        `${presentDrifts.map((d) => `${d.ref || d.kind}: ${d.detail || ''}${d.evidence ? ` [evidence: ${d.evidence}]` : ''}`).join(' | ')}. ` +
        `Edit only ${SPEC_BASE}/${current.feature}/{requirements,design,tasks}.md; do NOT touch .product/. Selective commit ` +
        `(fix(specs): ${current.feature} fidelity). Return whether fixed.`,
        { schema: FIX_SCHEMA, phase: 'Triage', label: `spec-fix:${current.feature}:r${round}` },
      )
      if (!fix || !fix.fixed) break
      current = await auditOne(current.feature, ' (RE-AUDIT after spec-fix — P1-2: confirm the fix did not introduce new drift.)')
      if (current && current.faithful) { fixedOk = true; break }
    }
    if (fixedOk) specFixed.push(a.feature)
    else residual.push({ feature: a.feature, reason: `spec drift unresolved after ${MAX_REAUDIT_ROUNDS} re-audit round(s)` })
  }
}

// design→tasks COVERAGE GAPS (DEC-DEV-0095, FB-LR-05): a confirmed gap (a design module no task
// builds) means the feature is NOT impl-ready — otherwise an unmounted API ships green. Conservative:
// SURFACE + route a spec-completion pending-action (add the missing assembly/wiring task); do NOT
// auto-add the task here (a missing task is for the spec author / a P3 re-run, not this gate).
for (const c of coveredFeatures) {
  coverageGaps.push({ feature: c.feature, gaps: c.gaps })
  await agent(
    `Feature ${c.feature}: ${c.gaps.length} design→tasks COVERAGE GAP(s) (FB-LR-05) — design files/modules that NO task builds: ` +
    `${c.gaps.map((g) => `${g.path || g.kind}: ${g.detail || ''}`).join(' | ')}.\n` +
    `Write a spec-completion entry to .claude/pending-actions.md (create if absent) with route: spec, the feature, the unbuilt ` +
    `file(s), and the recommendation to ADD the missing assembly/wiring task(s) to ${SPEC_BASE}/${c.feature}/tasks.md before impl. ` +
    `DEDUP (FB-LR-10, repeated-run idempotency): if an OPEN pending-action already routes feature ${c.feature} + the same unbuilt file(s) as a spec-completion, UPDATE it in place instead of appending a duplicate (match on (feature, route:spec, paths)). ` +
    `Do NOT edit tasks.md yourself in this gate (a missing task is for the spec author / P3 re-run, not an auto-fix). Do NOT commit code.`,
    { phase: 'Triage', label: `coverage-route:${c.feature}` },
  )
  log(`coverage gap (${c.feature}): ${c.gaps.length} unbuilt design file(s) → routed spec-completion (feature NOT impl-ready)`)
}

log(`triage: spec_fixed=${specFixed.join(',') || '∅'}; product_routed=${productRouted.map((p) => p.feature).join(',') || '∅'}; residual=${residual.map((r) => r.feature).join(',') || '∅'}; coverage_gaps=${coverageGaps.map((c) => c.feature).join(',') || '∅'}`)

const gapFeatures = new Set(coverageGaps.map((c) => c.feature))
return {
  audited: audits.map((a) => a.feature),
  faithful,
  spec_fixed: specFixed,
  product_routed: productRouted,
  residual,
  coverage_gaps: coverageGaps,    // DEC-DEV-0095 (FB-LR-05): design files no task builds — feature not impl-ready until a task owns them
  // a feature is impl-ready iff it is faithful or its spec-route drift was fixed and re-audited clean,
  // it has no unresolved (residual) spec drift, AND no unresolved structural coverage gap (an unbuilt
  // design module). product-routed drifts do not by themselves block, but high-severity ones should
  // be surfaced to the user before route-to-impl.
  impl_ready: [...faithful, ...specFixed].filter((f) => !residual.some((r) => r.feature === f) && !gapFeatures.has(f)),
}
