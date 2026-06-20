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
          kind: { type: 'string' },                      // value-mismatch | contradiction | stale-entity | weakened-acceptance | fabricated-trace
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

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['confirmed'],
  properties: {
    confirmed: { type: 'boolean' },                      // grep of ground truth confirms the drift is REAL (not an auditor hallucination)
    evidence: { type: 'string' },                        // what the inspection actually found (cite spec + .product)
  },
}

// ---- audit one feature (deterministic oracle + semantic auditor) -----------
const auditOne = (feature, extra = '') =>
  agent(
    `Fidelity-audit the cc-sdd spec for feature "${feature}" against its .product source.\n` +
    `1) Resolve the .product ground-truth files for ${feature}: its handoff (.product/handoffs/) + the FM/SC/BR/IC/NFR artifacts it traces.\n` +
    `2) DETERMINISTIC trace-integrity (do NOT eyeball): node ${ORACLE} --source <each resolved source> --spec ${SPEC_BASE}/${feature}/requirements.md --spec ${SPEC_BASE}/${feature}/design.md --spec ${SPEC_BASE}/${feature}/tasks.md. ` +
    `Relay trace_integrity.passed + every dangling ref (a dangling ref is a fabricated/drifted trace — kind:fabricated-trace, route:spec unless the id SHOULD exist in product, then route:product).\n` +
    `3) SEMANTIC pass: ${FIDELITY_AUDITOR}\n` +
    `faithful = (trace_integrity_passed AND no semantic drifts). Return the audit verdict.${extra}`,
    { schema: AUDIT_SCHEMA, phase: 'Audit', label: `audit:${feature}` },
  )

// ---- verify-finding-before-act (parity with P6, DEC-DEV-0087) --------------
// The deterministic oracle's trace-integrity (kind:fabricated-trace = a dangling ref) is already
// confirmed BY CODE — never re-verified. But a SEMANTIC drift from the LLM fidelity-auditor is
// judgment, and P4 EDITS + COMMITS the spec on it. So before any spec-fix each semantic drift is
// CONFIRMED against ground truth (grep the spec + the .product source it cites); a refuted drift is
// DROPPED, not fixed — P4 must not rewrite a spec around a hallucinated drift (the gap vs P6, closed).
const verifyDrift = (feature, d) =>
  agent(
    `Verify-finding-before-act: the fidelity-auditor flagged a possible SPEC drift in feature "${feature}" — ` +
    `kind: ${d.kind}; ref: ${d.ref || 'n/a'}; detail: ${d.detail || ''}.\n` +
    `GREP/INSPECT the actual ground truth — the spec ${SPEC_BASE}/${feature}/{requirements,design,tasks}.md AND the ` +
    `.product source it cites (handoff + the FM/SC/BR/IC/NFR artifact) — and decide if the drift is REAL: the spec ` +
    `genuinely misrepresents / contradicts / weakens the product. confirmed = true ONLY with concrete evidence from ` +
    `both sides; if the spec actually matches or the auditor misread, confirmed = false (drop it — do NOT edit the ` +
    `spec on a hallucinated drift). Return confirmed + evidence.`,
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

// ---- Phase 2: audit (parallel per feature) ---------------------------------
phase('Audit')
const audits = (await parallel(FEATURES.map((f) => () => auditOne(f)))).filter(Boolean)
const faithful = audits.filter((a) => a.faithful).map((a) => a.feature)
const drifting = audits.filter((a) => a && !a.faithful)
log(`audit: ${faithful.length}/${audits.length} faithful; drifting: ${drifting.map((a) => a.feature).join(', ') || '∅'}`)

// ---- Phase 3: triage + fix (spec) / route (product) + auto-re-audit --------
phase('Triage')
const productRouted = []
const specFixed = []
const residual = []

for (const a of drifting) {
  const productDrifts = (a.drifts || []).filter((d) => d.route === 'product')
  const specDrifts = (a.drifts || []).filter((d) => d.route === 'spec')

  // product-defects → reverse channel to Product (OD8); never edit .product/ or patch the spec around it
  if (productDrifts.length) {
    await agent(
      `Feature ${a.feature}: ${productDrifts.length} fidelity drift(s) routed to PRODUCT (the .product canon ` +
      `itself is wrong / under-specified / needs a business decision): ${productDrifts.map((d) => `${d.ref || d.kind}: ${d.detail || ''}`).join(' | ')}.\n` +
      `Append a product-feedback entry to .claude/pending-actions.md (create if absent) with route: product, ` +
      `the affected ids, and the rationale. Do NOT edit .product/ and do NOT patch the spec around it (OD8 reverse channel). Do NOT commit code.`,
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
      // verify-finding-before-act (DEC-DEV-0087): fabricated-trace is oracle-confirmed by code;
      // each SEMANTIC drift is confirmed against ground truth before we edit the spec. Refuted → dropped.
      const confirmedDrifts = []
      for (const d of curSpecDrifts) {
        if (d.kind === 'fabricated-trace') { confirmedDrifts.push(d); continue }   // deterministic oracle — already real
        const v = await verifyDrift(current.feature, d)
        if (v && v.confirmed) confirmedDrifts.push({ ...d, evidence: v.evidence })
        else log(`drift ${d.ref || d.kind} (${current.feature}) refuted by ground-truth check — dropped, NOT fixed`)
      }
      if (!confirmedDrifts.length) { fixedOk = true; break }   // all refuted → no real spec drift to fix
      const fix = await agent(
        `Feature ${current.feature}: fix the SPEC so it faithfully matches the .product source (consumer-conforms-to-owner). ` +
        `Fix ONLY these CONFIRMED spec drifts (each verified against ground truth — touch nothing else): ` +
        `${confirmedDrifts.map((d) => `${d.ref || d.kind}: ${d.detail || ''}${d.evidence ? ` [evidence: ${d.evidence}]` : ''}`).join(' | ')}. ` +
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

log(`triage: spec_fixed=${specFixed.join(',') || '∅'}; product_routed=${productRouted.map((p) => p.feature).join(',') || '∅'}; residual=${residual.map((r) => r.feature).join(',') || '∅'}`)

return {
  audited: audits.map((a) => a.feature),
  faithful,
  spec_fixed: specFixed,
  product_routed: productRouted,
  residual,
  // a feature is impl-ready iff it is faithful or its spec-route drift was fixed and re-audited clean,
  // and it has no unresolved (residual) spec drift. product-routed drifts do not by themselves block,
  // but high-severity ones should be surfaced to the user before route-to-impl.
  impl_ready: [...faithful, ...specFixed].filter((f) => !residual.some((r) => r.feature === f)),
}
