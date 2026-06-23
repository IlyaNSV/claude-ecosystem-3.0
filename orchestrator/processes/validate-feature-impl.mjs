export const meta = {
  name: 'validate-feature-impl',
  description: 'Orchestrator P6 — feature-level GO/NO-GO gate AFTER a feature\'s tasks are implemented. A mechanical layer (full suite + build) + 3 parallel validators (requirements-coverage RA-8 / design-alignment RA-9 / integration-boundary RA-10) + verify-finding-before-act (a validator finding is remediated ONLY after it is confirmed against ground truth, bounded). Replaces the thin kiro-validate-impl lift P5 used inline; P5 delegates here via workflow().',
  phases: [
    { title: 'Mechanical' },
    { title: 'Validate' },
    { title: 'Synthesize' },
  ],
}

/*
 * Orchestrator process P6 `validate-feature-impl` — full feature GO-gate (build N+1b,
 * DEC-DEV-0085; kickoff dev/ORCHESTRATOR_P4_P6_KICKOFF.md). Reading: SPEC §3.2 P6 / §3.3
 * RA-8/9/10; RUN_01 §1 E5 / §5 P1-5.
 *
 * WHY P6: per-task review (P5) is too narrow to catch CROSS-TASK seams — a method built by
 * task A but never wired by task B passes both per-task reviews (RUN 01 P1-5: the `/reset`
 * vs `/reset-password` defect lived on the boundary of two GREEN tasks; FB-010 orphan
 * export). The feature-level gate is the only check wide enough to see the whole feature.
 * P5 previously LIFTED the thin `kiro-validate-impl` (one advisory agent). Full P6 makes it
 * a real gate: a deterministic mechanical layer (the whole suite + build must be green) +
 * THREE parallel validators, each with a distinct lens.
 *
 * THREE VALIDATORS (RA-8/9/10, determinism model §2 — Layer-2 judgment):
 *   requirements-coverage (RA-8) — every requirement has BOTH an implementation and a test;
 *     reuses coverage-oracle (P1-1) as the deterministic anti-self-report backbone.
 *   design-alignment (RA-9) — the impl honours the design.md decisions (no silent re-design).
 *   integration-boundary (RA-10) — cross-task seams are wired: no orphan export, no event
 *     emitted-but-unhandled, no caller referencing a name the producer never exposes.
 *
 * VERIFY-FINDING-BEFORE-ACT (P6's core value, RUN_01 E5): a validator can hallucinate a
 * defect. So NO finding is remediated on the validator's word — each is first CONFIRMED by
 * grepping ground truth (the actual code/tests/spec). Only confirmed findings are remediated;
 * refuted ones are dropped. Remediation is bounded (≤ maxRemediationRounds, default 3 — the
 * same cap kiro-validate-impl used) and re-validates the affected lens.
 *
 * GO is SYNTHESIZED deterministically here (not a kiro-validate-impl verdict): GO iff the
 * mechanical layer is green AND no confirmed finding remains unremediated AND the run is not
 * degraded (blocked tasks upstream). Deferred-capability CONCERNS forwarded from P5 (FB-013)
 * are DISCLOSED in the verdict — a GO over a mock-only seam is GO-with-caveats, not clean.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script. Every
 * suite run / oracle run / grep / file read / fix / commit happens INSIDE an agent(); inputs
 * via args. Validators run in parallel(); remediation is sequential (git-safety).
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect) +
 * tests/orchestrator/validate-feature-impl-wiring.test.cjs (static invariants). Live needs a
 * pilot with an implemented feature (separate session); P5 delegates here via workflow().
 */

// FB-001: defend against stringified args — the harness forwards `args` verbatim and an
// invoking agent (or P5's workflow() call) may pass a JSON string. (Keep the comment ABOVE
// this line: the args-parsing regression test evals the `const A =` line.)
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURE = A.feature || ''                                  // cc-sdd feature slug (e.g. "auth")
const SPEC_DIR = A.specDir || `.kiro/specs/${FEATURE}`
const ORACLE = A.oracle || '.claude/orchestrator/lib/coverage-oracle.cjs'
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs' // DEC-DEV-0092: readiness-axis backbone
const VALIDATION = A.validationCommands || {}                    // {test, build, smoke} discovered by P5/preflight
const SOURCE = A.source || ''                                    // optional .product handoff for the coverage-oracle backbone
const CONCERNS = A.concerns || []                                // FB-013: deferred-capability flags forwarded from P5
const DEGRADED = !!A.degraded                                    // P5 had blocked tasks → feature NOT complete → advisory
const FWD_READINESS = A.readiness || ''                          // DEC-DEV-0092: optional readiness hint forwarded from P5 pre-flight
const MAX_REMEDIATION_ROUNDS = A.maxRemediationRounds || 3

// FB-002: refuse to run with no target rather than scanning .kiro/specs/ and picking one.
if (!FEATURE) {
  log('HALT: empty feature — refusing to run (FB-002). Pass args as an OBJECT, e.g. {feature:"auth"}.')
  return { error: 'validate-feature-impl: empty feature (FB-002 guard)', result: 'NO-GO', findings: ['empty feature'] }
}

// ---- inline validator roles (RA-8/9/10) — per D.1 inlined here, not readFileSync'd -------
const REQUIREMENTS_COVERAGE = [
  'Act as the requirements-coverage validator (RA-8). Verify every requirement in',
  `${SPEC_DIR}/requirements.md is satisfied by BOTH an implementation AND a test — not just`,
  'present in the spec. Use the coverage-oracle as the deterministic anti-self-report backbone:',
  `run \`node ${ORACLE} --handoff <source> --spec ${SPEC_DIR}/requirements.md --spec ${SPEC_DIR}/design.md\``,
  '(when a .product source is available) and relay its JSON, then for each requirement id grep',
  'the codebase + test files to confirm a real implementation and a covering test exist. A',
  'requirement with a passing-by-absence test (asserts nothing) or with no production call-site',
  'is NOT covered. Report each gap as a finding (ref = requirement id; where_to_verify = the',
  'file/symbol to grep). Do NOT trust tasks.md [x] marks — re-derive from code+tests.',
].join(' ')

const DESIGN_ALIGNMENT = [
  'Act as the design-alignment validator (RA-9). Read', `${SPEC_DIR}/design.md`, 'and verify the',
  'implementation HONOURS its decisions: the chosen data model, interfaces/signatures, error',
  'handling, sequencing, and named components match what was built. Flag silent re-design — the',
  'impl quietly diverging from design without the design being updated (a divergence is a',
  'finding whether the impl or the design is "right"; consumer-conforms-to-owner — surface it,',
  'do not pick a winner). For each: ref = the design decision; where_to_verify = the symbol/file',
  'that should embody it. Ignore cosmetic/naming-only differences that do not change behaviour.',
].join(' ')

const INTEGRATION_BOUNDARY = [
  'Act as the integration-boundary validator (RA-10). This is the CROSS-TASK lens per-task review',
  'cannot see. Verify the seams BETWEEN tasks are wired: (a) every new exported/public symbol has',
  'a production call-site (orphan export = a task built a method another task was meant to wire but',
  'did not — FB-010); (b) every emitted event/message/route has a handler, and every handler/caller',
  'references a name the producer actually exposes (RUN 01: `/reset` vs `/reset-password` — a caller',
  'using a route the producer never registered; both tasks green, the seam dead); (c) no dangling',
  'import / dead feature-flag / half-wired adapter. For each: ref = the seam (producer↔consumer);',
  'where_to_verify = both ends to grep. This lens is where cross-task integration gaps surface.',
].join(' ')

const VALIDATORS = [
  { key: 'requirements-coverage', ra: 'RA-8', role: REQUIREMENTS_COVERAGE },
  { key: 'design-alignment', ra: 'RA-9', role: DESIGN_ALIGNMENT },
  { key: 'integration-boundary', ra: 'RA-10', role: INTEGRATION_BOUNDARY },
]

// ---- schemas ---------------------------------------------------------------
const MECH_SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: {
    passed: { type: 'boolean' },                       // suite AND build both green
    suite: { type: 'string' },                         // command run + pass/fail summary
    build: { type: 'string' },
    failures: { type: 'array', items: { type: 'string' } },
    // DEC-DEV-0092 (FB-LR-02): the readiness axis — relayed verbatim from the
    // env-readiness probe + the substrate-error allowlist classification. ABSENT
    // == READY (soft-migration). ENV_NOT_READY means the gate could not judge the
    // code (substrate down / suite RED was an env artifact), NOT that the code failed.
    readiness: { type: 'string', enum: ['READY', 'DEGRADED', 'ENV_NOT_READY'] },
    readiness_reasons: { type: 'array', items: { type: 'string' } },
  },
}

const VALIDATOR_SCHEMA = {
  type: 'object',
  required: ['clean', 'findings'],
  properties: {
    validator: { type: 'string' },                     // requirements-coverage | design-alignment | integration-boundary
    clean: { type: 'boolean' },                        // COVERED / ALIGNED / CLEAN — no findings
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'detail', 'severity'],
        properties: {
          ref: { type: 'string' },                     // requirement id / design decision / seam
          kind: { type: 'string' },                    // uncovered-requirement | design-divergence | orphan-export | dead-seam | ...
          detail: { type: 'string' },
          where_to_verify: { type: 'string' },         // file/symbol to grep when confirming (verify-finding-before-act)
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
    // worktree AND the pre-gate baseline sha, so a confirmer reading an already-remediated
    // tree does not mislabel a REAL finding a "hallucination", and a defect masked by a
    // racing commit is surfaced rather than silently dropped.
    disposition: { type: 'string', enum: ['present', 'already-resolved', 'refuted'] },
    confirmed: { type: 'boolean' },                    // present || already-resolved (the defect WAS/IS real, not a hallucination)
    evidence: { type: 'string' },                      // what the inspection found in worktree vs baseline
  },
}

const REMEDIATE_SCHEMA = {
  type: 'object',
  required: ['remediated'],
  properties: {
    remediated: { type: 'boolean' },                   // the confirmed defect was fixed + committed
    note: { type: 'string' },
  },
}

// ===========================================================================

// ---- Phase 1: mechanical layer — readiness probe FIRST, then suite + build -
// DEC-DEV-0092 (FB-LR-02): the readiness axis is decided by CODE, not LLM
// initiative. The agent (a) runs the env-readiness probe BEFORE the suite so a
// down substrate is known up front, (b) runs the suite/build, then (c) if the
// build is GREEN but the suite is RED, classifies the failures through the
// substrate-error allowlist. A suite that is RED only because the substrate was
// down is ENV_NOT_READY (the gate could not judge the code) — NOT a NO-GO.
phase('Mechanical')
const mech = await agent(
  `Feature-level mechanical gate for "${FEATURE}", in THIS order:\n` +
  `1) READINESS PROBE FIRST — run \`node ${ENV_PROBE}\` via Bash and relay its JSON (readiness + checks). ` +
  `This tells you whether the substrate the project uses (Docker/Postgres/Redis/migrations) is actually up BEFORE you run anything.\n` +
  `2) Run the FULL validation suite and build for the whole feature (not one task): ` +
  `${JSON.stringify(VALIDATION) !== '{}' ? `validation commands: ${JSON.stringify(VALIDATION)}` : 'discover TEST/BUILD/SMOKE commands from the repo manifests/CI'}. ` +
  `Run them via Bash and report the real exit results — do NOT infer green from "tasks all [x]".\n` +
  `3) If the build is GREEN but the suite has failures, write the failure lines to a temp file and run ` +
  `\`node ${ENV_PROBE} --failures <that-file>\` to classify them against the substrate-error allowlist ` +
  `(PrismaClientInitializationError / ECONNREFUSED :5432|:6379 / "Cannot connect to the Docker daemon" / npipe / "Can't reach database").\n` +
  `SET readiness:\n` +
  `  • ENV_NOT_READY  — if the probe reports ENV_NOT_READY, OR build GREEN + suite RED + classify says all_substrate:true ` +
  `(the suite RED is an env artifact, the gate could NOT judge the code).\n` +
  `  • READY          — substrate up and any suite failures are REAL test failures (code).\n` +
  `passed = (suite green AND build green). List every failure verbatim in failures[]; put the probe/allowlist reasons in readiness_reasons[].`,
  { schema: MECH_SCHEMA, phase: 'Mechanical', label: 'mechanical' },
)
log(`mechanical: ${mech && mech.passed ? 'GREEN' : 'RED'}${mech && mech.failures && mech.failures.length ? ` — ${mech.failures.length} failure(s)` : ''}; readiness=${(mech && mech.readiness) || 'READY'}`)

// ---- pre-gate baseline (DEC-DEV-0093, FB-LR-03): the ground-truth snapshot for
// ORDER-AWARE verify-finding-before-act. Captured BEFORE any remediation so a confirmer
// can tell "refuted (never real)" from "already-resolved (real at baseline, fixed since —
// possibly by a racing committer)". Validators read the same tree this sha points at (P6
// makes no commit before Phase 3), so a detected defect IS in the baseline. No FS in the
// script (DEC-DEV-0073 §D.1) → an agent captures the sha.
const BASELINE_SCHEMA = { type: 'object', required: ['sha'], properties: { sha: { type: 'string' } } }
const base = await agent(
  `Capture the pre-gate baseline: run \`git rev-parse HEAD\` via Bash and return its sha. ` +
  `This is the ground-truth snapshot the feature was handed to the gate at — do NOT commit or change anything.`,
  { schema: BASELINE_SCHEMA, phase: 'Mechanical', label: 'baseline' },
)
const BASELINE = (base && base.sha) || ''
log(`baseline sha for order-aware verify: ${BASELINE || '(unavailable — verify falls back to worktree-only)'}`)

// ---- Phase 2: three validators in parallel (RA-8/9/10) ---------------------
phase('Validate')
const validateOne = (v) =>
  agent(
    `${v.role}\n` +
    `Feature: ${FEATURE}. Spec: ${SPEC_DIR}/{requirements,design,tasks}.md. Inspect the actual implemented code + tests ` +
    `(git log/diff for this feature's commits, the source tree, the test files). ` +
    `clean = true ONLY if you find NO finding for your lens. For every finding include where_to_verify so it can be ` +
    `independently confirmed against ground truth before anyone acts on it. Return your verdict (validator: ${v.key}).`,
    { schema: VALIDATOR_SCHEMA, phase: 'Validate', label: `validate:${v.key}` },
  )

const results = (await parallel(VALIDATORS.map((v) => () => validateOne(v).then((r) => (r ? { ...r, key: v.key } : null))))).filter(Boolean)
const rawFindings = results.flatMap((r) => (r.findings || []).map((f) => ({ ...f, validator: r.key })))
log(`validators: ${results.filter((r) => r.clean).map((r) => r.key).join(',') || '∅'} clean; ${rawFindings.length} raw finding(s)`)

// ---- Phase 3: verify-finding-before-act → bounded remediation → synthesize -
phase('Synthesize')

// ORDER-AWARE verify-finding-before-act (DEC-DEV-0093, FB-LR-03/13): confirm each finding
// against BOTH the current worktree AND the pre-gate BASELINE — never remediate on the
// validator's word, and never mislabel an already-fixed real finding a "hallucination".
const verifyFinding = (f) =>
  agent(
    `Verify-finding-before-act (ORDER-AWARE): a ${f.validator} validator reported a possible defect in feature ${FEATURE} — ` +
    `kind: ${f.kind}; ref: ${f.ref || 'n/a'}; detail: ${f.detail}. Where to look: ${f.where_to_verify || 'derive from the detail'}.\n` +
    `Inspect TWO trees: (1) the CURRENT worktree (code, tests, ${SPEC_DIR}/{requirements,design}.md), and (2) the pre-gate BASELINE ` +
    `${BASELINE ? `commit ${BASELINE} — use \`git show ${BASELINE}:<file>\` / \`git grep <pattern> ${BASELINE}\` to read it` : '(baseline sha unavailable → inspect the current worktree only)'}.\n` +
    `Classify the disposition:\n` +
    `  • present          — the defect EXISTS in the current worktree (concrete evidence) → real & unresolved.\n` +
    `  • already-resolved — NOT in the worktree but present at the baseline → it WAS real and has been fixed since the gate started ` +
    `(possibly by a racing commit). Do NOT call this a hallucination; it must be surfaced (the resolution might be a mask).\n` +
    `  • refuted          — absent in BOTH worktree and baseline → the validator misread; a true hallucination → drop.\n` +
    `${BASELINE ? '' : 'With no baseline, use present (defect in worktree) or refuted (absent) only.\n'}` +
    `confirmed = (disposition !== 'refuted'). Return disposition + confirmed + evidence (cite what you found in EACH tree).`,
    { schema: VERIFY_SCHEMA, phase: 'Synthesize', label: `verify:${f.validator}:${f.ref || f.kind}` },
  )

// verify all raw findings in parallel (read-only); bucket by disposition (DEC-DEV-0093).
const checked = (await parallel(rawFindings.map((f) => () => verifyFinding(f).then((v) => (v ? { ...f, disposition: v.disposition, evidence: v.evidence } : null))))).filter(Boolean)
const present = checked.filter((f) => f.disposition === 'present')                       // real & unresolved → remediate
const alreadyResolved = checked.filter((f) => f.disposition === 'already-resolved')       // real, fixed since baseline → surface (don't re-fix, don't drop)
const refuted = checked.filter((f) => f.disposition === 'refuted')                        // hallucination → drop
log(`verify-finding-before-act (order-aware): ${present.length} present, ${alreadyResolved.length} already-resolved (real, fixed since baseline), ${refuted.length} refuted/dropped`)

// bounded remediation of PRESENT findings only; re-verify after each fix (a fix can be partial)
let remaining = present
let round = 0
const remediated = []
while (remaining.length && round < MAX_REMEDIATION_ROUNDS) {
  round += 1
  log(`remediation round ${round}/${MAX_REMEDIATION_ROUNDS} — ${remaining.length} present finding(s)`)
  const next = []
  for (const f of remaining) {
    const fix = await agent(
      `Remediate a CONFIRMED-PRESENT ${f.validator} defect in feature ${FEATURE} (verified evidence: ${f.evidence || f.detail}). ` +
      `kind: ${f.kind}; ref: ${f.ref || 'n/a'}. Fix the concrete defect ONLY (no scope creep), add/repair the covering test if the lens is requirements-coverage, ` +
      `then selective-commit (NEVER git add -A — explicit paths) with message: fix(${FEATURE}): ${f.kind} ${f.ref || ''}. ` +
      `If the fix needs a capability you lack (tool/secret/upstream decision), do NOT fake it — return remediated:false and say what is needed.`,
      { schema: REMEDIATE_SCHEMA, phase: 'Synthesize', label: `remediate:${f.validator}:${f.ref || f.kind}` },
    )
    if (fix && fix.remediated) {
      const recheck = await verifyFinding(f)
      if (recheck && recheck.disposition === 'present') next.push({ ...f, evidence: recheck.evidence })   // still present → another round
      else remediated.push(f)                                                                            // gone vs worktree → fixed
    } else {
      next.push(f)                                  // could not remediate (e.g. capability gap) → carries to residual
    }
  }
  remaining = next
}

// ---- synthesize the TWO-AXIS gate outcome (DEC-DEV-0092, FB-LR-02/04) ------
// readiness ∈ {READY, DEGRADED, ENV_NOT_READY} — "did the gate get to judge?";
// verdict (result) ∈ {GO, NO-GO, MANUAL_VERIFY_REQUIRED} — "is the code good?".
// They are ORTHOGONAL: ENV_NOT_READY (substrate down) and DEGRADED (upstream
// blocked tasks) both mean the gate could NOT fully judge → never a NO-GO and
// never a clean GO. INVARIANT (in code, not prose): ENV_NOT_READY ⇒
// MANUAL_VERIFY_REQUIRED; only READY|DEGRADED may pair with GO. This is the
// run-B false-NO-GO guard: a down substrate (build GREEN, suite RED on env errors)
// must NOT synthesise NO-GO. Conservative — readiness never upgrades toward GO.
const RANK = { READY: 0, DEGRADED: 1, ENV_NOT_READY: 2 }
const worstReadiness = (a, b) => (RANK[a] >= RANK[b] ? a : b)
const mechPassed = !!(mech && mech.passed)
const unresolved = remaining
let readiness = worstReadiness((mech && mech.readiness) || 'READY', FWD_READINESS || 'READY')
if (DEGRADED) readiness = worstReadiness(readiness, 'DEGRADED')   // P5 upstream blocked tasks fold onto the readiness axis (FB-010)

let result
if (readiness === 'ENV_NOT_READY') {
  result = 'MANUAL_VERIFY_REQUIRED'                  // substrate down ≠ code bad — the gate could not judge (false-NO-GO guard)
} else if (readiness === 'DEGRADED') {
  result = 'MANUAL_VERIFY_REQUIRED'                  // blocked tasks → feature not complete; gate is advisory (FB-010)
} else if (mechPassed && !unresolved.length) {
  result = 'GO'
} else if (!mechPassed) {
  result = 'NO-GO'                                   // a red suite/build over a READY substrate is never a GO
} else {
  result = unresolved.some((f) => f.severity === 'high') ? 'NO-GO' : 'MANUAL_VERIFY_REQUIRED'
}

// findings to surface: unresolved confirmed defects + mechanical failures + forwarded deferred-capability CONCERNS (FB-013 disclosure)
const readinessReasons = (mech && mech.readiness_reasons) || []
const findings = [
  ...(readiness !== 'READY'
    ? [`readiness=${readiness} (DEC-DEV-0092): the gate could NOT fully judge — ` +
       (readiness === 'ENV_NOT_READY'
         ? `substrate not ready, so this is MANUAL_VERIFY_REQUIRED, NOT a NO-GO; bring the substrate up and re-run \`/orchestrator:run validate-feature-impl --feature ${FEATURE}\`.`
         : `upstream tasks were blocked (feature incomplete); advisory.`) +
       (readinessReasons.length ? ` Reasons: ${readinessReasons.join('; ')}.` : '')]
    : []),
  ...((mech && mech.failures) || []).map((x) => `mechanical: ${x}`),
  ...unresolved.map((f) => `${f.validator}/${f.kind} ${f.ref || ''}: ${f.detail} (confirmed-present; unresolved after ${MAX_REMEDIATION_ROUNDS} round(s))`),
  ...alreadyResolved.map((f) => `${f.validator}/${f.kind} ${f.ref || ''}: ${f.detail} (already-resolved since baseline, DEC-DEV-0093 — was REAL, fixed by a commit during/before the gate; NOT a hallucination. VERIFY the resolution is genuine, not a mask — full single-writer serialization is T5.)`),
  ...CONCERNS.map((c) => `deferred-capability (FB-013): ${typeof c === 'string' ? c : `${c.task || ''}: ${c.concern || ''}`} — disclose at GO; a GO over a mock-only/unwired real seam is GO-with-caveats`),
]
log(`feature GO-gate: ${result} [readiness=${readiness}]${readiness !== 'READY' ? ' (advisory — gate could not fully judge)' : ''}; ${findings.length} finding(s) surfaced`)

return {
  feature: FEATURE,
  mechanical: mechPassed,
  readiness,                                          // DEC-DEV-0092: READY | DEGRADED | ENV_NOT_READY — orthogonal to result
  readiness_reasons: readinessReasons,
  validators: results.map((r) => ({ validator: r.key, clean: !!r.clean, findings: (r.findings || []).length })),
  confirmed_findings: present.length + alreadyResolved.length,   // DEC-DEV-0093: real findings (present + already-resolved); refuted dropped
  already_resolved: alreadyResolved.map((f) => ({ validator: f.validator, ref: f.ref || null, kind: f.kind })),   // real, fixed since baseline — surfaced for genuineness check (FB-LR-03)
  remediated: remediated.length,
  residual: unresolved.map((f) => ({ validator: f.validator, ref: f.ref || null, kind: f.kind })),
  concerns: CONCERNS,                                 // FB-013: deferred-capability flags, disclosed not dropped
  result,                                             // GO | NO-GO | MANUAL_VERIFY_REQUIRED
  findings,
  go_gate: result,                                    // alias P5 reads (mirrors feature-to-tdd-impl's go_gate key)
}
