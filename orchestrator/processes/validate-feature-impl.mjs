export const meta = {
  name: 'validate-feature-impl',
  description: 'Orchestrator P6 — feature-level GO/NO-GO gate AFTER a feature\'s tasks are implemented. A mechanical layer (full suite + build) + 4 parallel validators (requirements-coverage RA-8 / design-alignment RA-9 / integration-boundary RA-10 / constants-fidelity RA-11) + verify-finding-before-act (a validator finding is remediated ONLY after it is confirmed against ground truth, bounded) + root-cause-first triage of a wide finding set + a prepare-only deviation-triage when the bounded forward-fix is exhausted (DEC-DEV-0231). Replaces the thin kiro-validate-impl lift P5 used inline; P5 delegates here via workflow().',
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
 * FOUR VALIDATORS (RA-8/9/10/11, determinism model §2 — Layer-2 judgment):
 *   requirements-coverage (RA-8) — every requirement has BOTH an implementation and a test;
 *     reuses coverage-oracle (P1-1) as the deterministic anti-self-report backbone.
 *   design-alignment (RA-9) — the impl honours the design.md decisions (no silent re-design).
 *   integration-boundary (RA-10) — cross-task seams are wired: no orphan export, no event
 *     emitted-but-unhandled, no caller referencing a name the producer never exposes.
 *   constants-fidelity (RA-11, DEC-DEV-0231) — every numeric constant the Business Rules fix
 *     (thresholds, caps, schedules) is enforced by the code with the exact source value;
 *     br-constants-oracle.cjs is the deterministic backbone (the M16 defect class: a truncated
 *     retry schedule and a cap taken "on the client's word" — the CODE↔BR layer; the SPEC↔BR
 *     layer is P4 audit-spec-fidelity's value-mismatch, NOT duplicated here).
 *
 * ROOT-CAUSE-FIRST + DEVIATION-TRIAGE (DEC-DEV-0231, ENFORCEMENT_PLAN 2.3/2.4): a wide
 * confirmed-present set (≥ rootCauseThreshold) is first triaged for ONE common mechanical root
 * before per-finding remediation (the RUN-A gate loop re-diagnosed one root five times, 24.6%
 * of run tokens). When the bounded forward-fix is exhausted and the verdict is still NO-GO wide,
 * a PREPARE-ONLY deviation-triage (single judge + premise verification + reverse pass — the
 * 2026-07-30 adjudication policy, NOT a consilium) prepares the "fix-forward vs re-derive"
 * fork for the OWNER to ratify; the gate never takes that fork itself.
 *
 * VERIFY-FINDING-BEFORE-ACT (P6's core value, RUN_01 E5): a validator can hallucinate a
 * defect. So NO finding is remediated on the validator's word — each is first CONFIRMED by
 * grepping ground truth (the actual code/tests/spec). Only confirmed findings are remediated;
 * refuted ones are dropped. Remediation is bounded (≤ maxRemediationRounds, default 3 — the
 * same cap kiro-validate-impl used) and re-validates the affected lens.
 *
 * GO is SYNTHESIZED deterministically here (not a kiro-validate-impl verdict): GO iff the
 * mechanical layer is green AND no confirmed finding remains unremediated AND no escalated
 * cross-spec/design conflict (T5) AND the run is not degraded (blocked tasks upstream).
 * Deferred-capability CONCERNS forwarded from P5 (FB-013) are DISCLOSED in the verdict — a GO
 * over a mock-only seam is GO-with-caveats, not clean.
 *
 * REMEDIATION DISCRETION (DEC-DEV-0096, T5 — FB-LR-07): remediation is SINGLE-WRITER (strictly
 * sequential, one commit at a time; cross-run single-writer is FB-004's "one workflow per
 * repo"). A remediation MAY NOT resolve a cross-spec/requirement contradiction or a design
 * self-contradiction by picking a side and committing — that masks an upstream conflict (the
 * run-B trial-seam: one committer "won" over two that correctly blocked). Such a finding
 * ESCALATES to a CONCERN/product decision (never self-resolved), and a fix that admits a
 * unilateral resolution is surfaced. The remediation-guard.cjs lib is the deterministic
 * discretion backbone (classify a block / self-check a fix note), run by the agent via Bash.
 *
 * ACCEPT-RATIFIED CHANNEL (DEC-DEV-0242, PA-139 пилота): escalation above is one-way — the gate
 * could SPEAK a conflict to the owner but had no ear for the answer. So once the owner RATIFIED a
 * conflict ("leave it as is", the pending-action closed as done/ratified), the next run escalated
 * the very same contradiction as a BRAND-NEW pending action and degraded GO → MANUAL_VERIFY again,
 * forever (live run 2026-08-07-validate-feature-impl-izrbls re-minted already-ratified PA-071/073/074).
 * `args.acceptRatified: ["PA-NNN", …]` names the owner's ratified decisions. It does NOT weaken the
 * check: the conflict is still DETECTED by the same lens, still escalated by the same rule, and
 * ALWAYS disclosed in findings — ratification changes only the VERDICT MATH (an accepted conflict
 * stops degrading a would-be GO), never the visibility. Nothing is ever silenced. FAIL-SAFE at every
 * step: the arg absent == the old behaviour byte-for-byte; the ratification is VERIFIED against the
 * canonical pending-actions Status line (by an agent — the script may not touch the FS, §D.1) rather
 * than taken on the caller's word; the conflict↔decision match is a judgment where ANY doubt = not
 * accepted; a dropped verifier / dropped matcher accepts NOTHING; and every requested-but-not-accepted
 * PA is surfaced LOUDLY in findings, so a mis-typed or wishful id can never pass unnoticed.
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
const CONSTANTS_ORACLE = A.constantsOracle || '.claude/orchestrator/lib/br-constants-oracle.cjs' // DEC-DEV-0231: CODE↔BR numeric-constants backbone (M16)
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs' // DEC-DEV-0092: readiness-axis backbone
const REMEDIATION_GUARD = A.remediationGuard || '.claude/orchestrator/lib/remediation-guard.cjs' // DEC-DEV-0096: remediation-discretion backbone (T5)
const AUTONOMY_LIB = A.autonomyLib || '.claude/orchestrator/lib/autonomy-policy.cjs' // DEC-DEV-0193 (F2): disposition-resolver CLI seam (the harness cannot require() a lib — DEC-DEV-0073 §D.1)
const VALIDATION = A.validationCommands || {}                    // {test, build, smoke} discovered by P5/preflight
const SOURCE = A.source || ''                                    // optional .product handoff for the coverage-oracle backbone
const CONCERNS = A.concerns || []                                // FB-013: deferred-capability flags forwarded from P5
// DEC-DEV-0242 (PA-139): pending-action ids the OWNER has already ratified ("leave it as is").
// Shape-filtered here (PA-NNN only) so a typo/garbage entry can never reach the verifier; ABSENT
// or non-array == the old behaviour byte-for-byte (soft migration, DEC-DEV-0079). Naming an id
// does NOT accept anything by itself — it only opens the verification below.
const ACCEPT_RATIFIED = Array.isArray(A.acceptRatified) ? A.acceptRatified.filter((x) => /^PA-\d+$/.test(String(x))) : []
const DEGRADED = !!A.degraded                                    // P5 had blocked tasks → feature NOT complete → advisory
const FWD_READINESS = A.readiness || ''                          // DEC-DEV-0092: optional readiness hint forwarded from P5 pre-flight
// meta-feedback #1 / defect D022 (DEC-DEV-0234): `0` is a LEGAL value here — "capture the
// findings, remediate nothing" — and the old falsy `|| 3` silently turned that explicit 0 into
// three live remediation rounds (the live executor had to smuggle it through as `-1`). Integer
// check, not truthiness; Math.max keeps that historical `-1` meaning "0 rounds" instead of
// breaking. A non-integer (absent / null / 'two') still falls back to the documented default 3.
const MAX_REMEDIATION_ROUNDS = Number.isInteger(A.maxRemediationRounds) ? Math.max(0, A.maxRemediationRounds) : 3
const MAX_VALIDATOR_RESPAWN = A.maxValidatorRespawn || 2          // FB-LR-15 (DEC-DEV-0101): bounded re-spawn of a validator slot dropped on a terminal API error
const ROOT_CAUSE_THRESHOLD = A.rootCauseThreshold || 3            // DEC-DEV-0231 (2.3): ≥ this many confirmed-present findings → diagnose the COMMON root once before per-finding remediation
const DEVIATION_TRIAGE_THRESHOLD = A.deviationTriageThreshold || 3 // DEC-DEV-0231 (2.4): NO-GO with ≥ this many unresolved findings → prepare-only fix-forward-vs-re-derive triage for the owner

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
  'is NOT covered. Report ONLY a GAP as a finding (kind: uncovered-requirement | missing-test | no-call-site;',
  'ref = requirement id; where_to_verify = the file/symbol to grep). A requirement that IS covered is NOT a finding —',
  'it contributes to clean:true; never emit a "coverage confirmed" / positive finding (FB-028). Do NOT trust tasks.md [x] marks — re-derive from code+tests.',
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
  'where_to_verify = both ends to grep.',
  'FB-LR-21: a deferred-by-design or spec-sanctioned orphan (an exported symbol intentionally not yet',
  'wired — e.g. design.md says it is consumed by a later feature) is STILL a finding — report it as',
  'kind: orphan-export, severity: low, and note in detail that it looks spec-sanctioned/deferred. Do NOT',
  'silently clear it as clean: whether the deferral is acceptable is the owner\'s call, not this lens\'s —',
  'surface it so another lens or the owner can adjudicate; clean:true means you found NO orphan at all.',
  'This lens is where cross-task integration gaps surface.',
].join(' ')

const CONSTANTS_FIDELITY = [
  'Act as the constants-fidelity validator (RA-11, DEC-DEV-0231). Verify every NUMERIC constant the',
  'product Business Rules fix (thresholds, caps, schedules, limits) is ENFORCED by the implemented code',
  'with the EXACT source value — the M16 defect class: a truncated retry schedule (15/30 instead of',
  '15/30/60) and a cap taken "on the client\'s word" instead of enforced. Use the br-constants-oracle as',
  `the deterministic anti-self-report backbone: run \`node ${CONSTANTS_ORACLE} --handoff <source>\` (when a`,
  '.product handoff source is available) to extract the canonical constants inventory from ground truth,',
  'then for EACH constant grep the codebase for its enforcement site, build the claims JSON',
  '([{rule, name, values, where}] — values expressed in the SPEC\'S units, converting code units yourself),',
  `write it to a temp file and run \`node ${CONSTANTS_ORACLE} --handoff <source> --claims <that-file>\` and`,
  'relay its JSON — the missing/mismatched verdict comes from code, never from your own summary.',
  'Report ONLY defects as findings: kind constant-mismatch (the code enforces a DIFFERENT value than the',
  'BR fixes — severity high); kind constant-unenforced (NO enforcement site exists, or the value is',
  'accepted from user/client input without validation against the BR threshold — severity high).',
  'ref = the BR id; where_to_verify = the code site (or the oracle JSON). A correctly enforced constant',
  'is NOT a finding — it contributes to clean:true (FB-028). When no .product handoff source is',
  `available, degrade honestly: derive the numeric-constant inventory from ${SPEC_DIR}/requirements.md`,
  'yourself and check each enforcement site the same way, noting in every finding detail that the oracle',
  'backbone was unavailable.',
].join(' ')

const VALIDATORS = [
  { key: 'requirements-coverage', ra: 'RA-8', role: REQUIREMENTS_COVERAGE },
  { key: 'design-alignment', ra: 'RA-9', role: DESIGN_ALIGNMENT },
  { key: 'integration-boundary', ra: 'RA-10', role: INTEGRATION_BOUNDARY },
  { key: 'constants-fidelity', ra: 'RA-11', role: CONSTANTS_FIDELITY },   // DEC-DEV-0231: CODE↔BR constants (M16)
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

// DEC-DEV-0094 (FB-028 / FB-LR-06): a validator FINDING is, by definition, a DEFECT — a gap /
// violation / missing wiring the lens detected. `kind` was a FREE STRING, so a validator could
// emit a POSITIVE assertion (e.g. "coverage_confirmation: requirement X IS covered") as a
// "finding"; verifyFinding then confirmed the positive ("yes, coverage is real" → confirmed) and
// it survived to residual, forcing MANUAL_VERIFY over a clean GO (the pilot mis-diagnosed this as
// a phantom `kind:coverage_confirmation` constant — the real cause is the free-string kind).
// Constraining `kind` to a defect enum makes a positive-confirmation kind UNREPRESENTABLE — a
// covered requirement is reported via `clean:true`, never as a finding. `other-defect` is the
// escape hatch for a genuine novel defect (still a DEFECT — verify-finding-before-act confirms it).
const DEFECT_KINDS = [
  'uncovered-requirement', 'missing-test', 'no-call-site',          // RA-8 requirements-coverage — GAPS only
  'design-divergence',                                             // RA-9 design-alignment
  'orphan-export', 'dead-seam', 'unhandled-event', 'dangling-import', // RA-10 integration-boundary
  'constant-mismatch', 'constant-unenforced',                      // RA-11 constants-fidelity (DEC-DEV-0231, M16 CODE↔BR)
  'other-defect',                                                 // genuine novel defect (NOT a positive)
]

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
          kind: { type: 'string', enum: DEFECT_KINDS }, // DEC-DEV-0094: a DEFECT kind only — a positive confirmation is not representable
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

// DEC-DEV-0096 (T5, FB-LR-07): a remediation must declare its DISCRETION outcome, not just
// fixed/not. block_class (when remediated:false) routes the FSM — a cross-spec/design
// contradiction is NOT a code defect to fix here, it ESCALATES (never self-resolved); a
// transient hiccup is distinct from a content gap; `resolved-by-concurrent-commit` is the
// single-writer safety (a sibling commit already fixed it → do NOT double-commit). When
// remediated:true, `unilateral` is the agent's self-check (it ran remediation-guard
// --fix-note): did the fix require picking a side of a contradiction? (the anti-mask flag).
const REMEDIATE_SCHEMA = {
  type: 'object',
  required: ['remediated'],
  properties: {
    remediated: { type: 'boolean' },                   // the confirmed defect was fixed + committed
    block_class: { type: 'string', enum: ['fixed', 'content', 'capability', 'cross-spec-conflict', 'design-contradiction', 'transient', 'resolved-by-concurrent-commit'] },
    conflict_detail: { type: 'string' },               // for a cross-spec/design conflict: which specs/requirements/design decisions disagree + the route
    unilateral: { type: 'boolean' },                   // remediated:true self-check — did the fix resolve a contradiction by picking a side? (FB-LR-07 anti-mask)
    note: { type: 'string' },
  },
}

// DEC-DEV-0193 (F2): the autonomy disposition envelope relayed from the autonomy-policy CLI seam
// (applyReadinessGuard ∘ resolve). Shape mirrors autonomy-policy.resolve()'s return.
const AUTONOMY_SCHEMA = {
  type: 'object',
  required: ['disposition'],
  properties: {
    disposition: { type: 'string' },                   // auto | consilium-gate | human-gate | block
    level_applied: { type: ['string', 'null'] },
    floor_hit: { type: 'boolean' },
    why: { type: 'array', items: { type: 'string' } },
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
  { model: 'sonnet', schema: MECH_SCHEMA, phase: 'Mechanical', label: 'mechanical' },   // MDP: run suite/build + relay + deterministic allowlist classify (standard/mechanical)
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
  { model: 'sonnet', schema: BASELINE_SCHEMA, phase: 'Mechanical', label: 'baseline' },   // MDP: git-sha relay (mechanical)
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
    `clean = true ONLY if you find NO finding for your lens. ` +
    `FB-028: every finding MUST be a DEFECT (a gap / violation / missing wiring) with a \`kind\` from the allowed defect set ` +
    `(${DEFECT_KINDS.join(', ')}) — NEVER a positive confirmation that something IS present/covered/correct. A satisfied ` +
    `requirement or a clean seam is reported via clean:true, it is NOT a finding (do not emit a "coverage confirmed" finding). ` +
    `For every finding include where_to_verify so it can be ` +
    `independently confirmed against ground truth before anyone acts on it. Return your verdict (validator: ${v.key}).`,
    { model: 'opus', schema: VALIDATOR_SCHEMA, phase: 'Validate', label: `validate:${v.key}` },   // MDP judging: the RA-8/9/10 validator panel — pinned + FIXED across all 3 lenses (single call site)
  )

// FB-LR-15 (DEC-DEV-0101): a validator that dies on a TERMINAL API error ("Connection closed
// mid-response") yields null from agent() — the prior `.filter(Boolean)` silently DROPPED that
// lens and synthesised a verdict on a reduced validator set with NO disclosure (the harness
// auto-retries STALLS, but a hard API error gets 0 retries → terminal null). A dropped RA-10
// could let a real integration defect through under a clean GO. So a dropped slot is bounded
// RE-SPAWNed; if it STILL never returns it is recorded as an INCOMPLETE lens (the gate did not
// fully judge that axis) — which degrades a clean GO below, never a silent reduced-lens GO.
const runValidatorSlot = async (v) => {
  let r = await validateOne(v)
  for (let attempt = 1; !r && attempt <= MAX_VALIDATOR_RESPAWN; attempt += 1) {
    log(`validator ${v.key} dropped (terminal error / empty) — re-spawn ${attempt}/${MAX_VALIDATOR_RESPAWN}`)
    r = await validateOne(v)
  }
  return r ? { ...r, key: v.key } : null
}
const slots = await parallel(VALIDATORS.map((v) => () => runValidatorSlot(v)))
const results = slots.filter(Boolean)
const incompleteValidators = VALIDATORS.filter((_, i) => !slots[i]).map((v) => v.key)   // FB-LR-15: lenses that never ran (terminal error after re-spawn)
const rawFindings = results.flatMap((r) => (r.findings || []).map((f) => ({ ...f, validator: r.key })))
log(`validators: ${results.filter((r) => r.clean).map((r) => r.key).join(',') || '∅'} clean; ${rawFindings.length} raw finding(s)${incompleteValidators.length ? `; INCOMPLETE (did not run): ${incompleteValidators.join(',')}` : ''}`)

// ---- Phase 3: verify-finding-before-act → bounded remediation → synthesize -
phase('Synthesize')

// ORDER-AWARE verify-finding-before-act (DEC-DEV-0093, FB-LR-03/13): confirm each finding
// against BOTH the current worktree AND the pre-gate BASELINE — never remediate on the
// validator's word, and never mislabel an already-fixed real finding a "hallucination".
const verifyFinding = (f) =>
  agent(
    `Verify-finding-before-act (ORDER-AWARE): a ${f.validator} validator reported a possible defect in feature ${FEATURE} — ` +
    `kind: ${f.kind}; ref: ${f.ref || 'n/a'}; detail: ${f.detail}. Where to look: ${f.where_to_verify || 'derive from the detail'}.\n` +
    `POLARITY GATE FIRST (FB-028): a finding must describe a DEFECT — something missing / broken / violated. If the "finding" instead ` +
    `asserts that something IS present / covered / correct (a positive confirmation, NOT a defect), it is malformed → disposition:refuted ` +
    `(a positive is not a defect; clean coverage is the validator's clean:true, never a confirmed finding). Do NOT confirm a positive.\n` +
    `Otherwise classify the DEFECT against TWO trees: (1) the CURRENT worktree (code, tests, ${SPEC_DIR}/{requirements,design}.md), and (2) the pre-gate BASELINE ` +
    `${BASELINE ? `commit ${BASELINE} — use \`git show ${BASELINE}:<file>\` / \`git grep <pattern> ${BASELINE}\` to read it` : '(baseline sha unavailable → inspect the current worktree only)'}.\n` +
    `Classify the disposition:\n` +
    `  • present          — the defect EXISTS in the current worktree (concrete evidence) → real & unresolved.\n` +
    `  • already-resolved — NOT in the worktree but present at the baseline → it WAS real and has been fixed since the gate started ` +
    `(possibly by a racing commit). Do NOT call this a hallucination; it must be surfaced (the resolution might be a mask).\n` +
    `  • refuted          — absent in BOTH worktree and baseline → the validator misread; a true hallucination → drop.\n` +
    `${BASELINE ? '' : 'With no baseline, use present (defect in worktree) or refuted (absent) only.\n'}` +
    `confirmed = (disposition !== 'refuted'). Return disposition + confirmed + evidence (cite what you found in EACH tree).`,
    { model: 'opus', schema: VERIFY_SCHEMA, phase: 'Synthesize', label: `verify:${f.validator}:${f.ref || f.kind}` },   // MDP: verify-finding-before-act (judgment, high R — gates remediate vs drop)
  )

// verify all raw findings in parallel (read-only); bucket by disposition (DEC-DEV-0093).
const checked = (await parallel(rawFindings.map((f) => () => verifyFinding(f).then((v) => (v ? { ...f, disposition: v.disposition, evidence: v.evidence } : null))))).filter(Boolean)
const present = checked.filter((f) => f.disposition === 'present')                       // real & unresolved → remediate
const alreadyResolved = checked.filter((f) => f.disposition === 'already-resolved')       // real, fixed since baseline → surface (don't re-fix, don't drop)
const refuted = checked.filter((f) => f.disposition === 'refuted')                        // hallucination → drop
log(`verify-finding-before-act (order-aware): ${present.length} present, ${alreadyResolved.length} already-resolved (real, fixed since baseline), ${refuted.length} refuted/dropped`)

// ROOT-CAUSE-FIRST (DEC-DEV-0231, ENFORCEMENT_PLAN 2.3): the RUN-A gate loop paid 24.6% of its
// tokens re-diagnosing ONE mechanical root five times — each verdict derived the same broken-
// substrate cause from scratch. So a WIDE confirmed-present set (≥ rootCauseThreshold) is first
// triaged for a COMMON root, and the root — if one exists — is remediated ONCE before the
// per-finding loop. The loop needs no special re-verify pass: its single-writer re-check already
// returns resolved-by-concurrent-commit for findings the root fix cleared (no double-commit).
// The TRIGGER and the routing are deterministic (code); the diagnosis itself is causal judgment
// no script can make — the П-2 justification lives in DEC-DEV-0231.
const ROOT_CAUSE_SCHEMA = {
  type: 'object',
  required: ['common_root'],
  properties: {
    common_root: { type: 'boolean' },                  // one concrete cause explains ≥2 of the findings
    root_detail: { type: 'string' },                   // the single cause, stated concretely (file/config/seam)
    affected: { type: 'array', items: { type: 'string' } },   // refs/kinds of the findings it explains
    fix_hint: { type: 'string' },                      // where/how the ONE fix lands
  },
}
let rootCause = null
let rootRemediated = false
if (present.length >= ROOT_CAUSE_THRESHOLD) {
  rootCause = await agent(
    `Root-cause-first triage (DEC-DEV-0231): feature ${FEATURE} has ${present.length} confirmed-present findings — ` +
    `BEFORE they are fixed one by one, determine whether they share ONE common mechanical/structural root ` +
    `(e.g. a broken tool/config/substrate seam failing many lenses at once — the RUN-A precedent: five NO-GO verdicts, one husky→beads root, diagnosed five times).\n` +
    `Findings:\n${present.map((f) => `- [${f.validator}/${f.kind}] ${f.ref || ''}: ${f.detail}`).join('\n')}\n` +
    `Inspect ground truth (code/config/tests) — do NOT infer from the finding texts alone. common_root=true ONLY if ` +
    `one concrete cause explains ≥2 of them; name it in root_detail + list the affected refs + a fix_hint. Do NOT fix anything yourself.`,
    { model: 'opus', schema: ROOT_CAUSE_SCHEMA, phase: 'Synthesize', label: 'root-cause-first' },   // MDP: cross-finding causal judgment (high R — shapes the whole remediation)
  )
  if (rootCause && rootCause.common_root) {
    log(`root-cause-first: COMMON ROOT found (explains ${(rootCause.affected || []).length} finding(s)) — remediating the root ONCE before per-finding rounds`)
    const rootFix = await agent(
      `Remediate the COMMON ROOT of ${present.length} confirmed findings in feature ${FEATURE} (root-cause-first, DEC-DEV-0231): ${rootCause.root_detail}\n` +
      `Fix hint: ${rootCause.fix_hint || 'derive from the root detail'}.\n` +
      `Fix ONLY the root cause (no scope creep, no per-finding fixes), then selective-commit (NEVER git add -A — explicit paths) ` +
      `with message: fix(${FEATURE}): common root — root-cause-first (DEC-DEV-0231); return remediated:true, block_class:'fixed'. ` +
      `The same discretion rules apply (T5, FB-LR-07): a cross-spec/design contradiction is NOT yours to resolve — ` +
      `return remediated:false with the matching block_class instead; do NOT pick a side, do NOT commit.`,
      { model: 'opus', schema: REMEDIATE_SCHEMA, phase: 'Synthesize', label: 'remediate:common-root' },   // MDP: fixes + commits the shared root (impl, high R)
    )
    rootRemediated = !!(rootFix && rootFix.remediated)
    log(`root-cause-first: root ${rootRemediated ? 'REMEDIATED — per-finding loop will re-confirm each finding against the fixed tree' : `NOT remediated (${(rootFix && rootFix.block_class) || 'no result'}) — falling through to per-finding remediation`}`)
  }
}

// FB-LR-23 (parallel-worktree PA-id safety): shared instruction so the escalation PA-write below
// targets the SINGLE canonical pending-actions file (the main checkout) + allocates its id from it —
// a worktree-local copy let two parallel runs mint the same `PA-027` (G-1). Duplicated verbatim across
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

// DEC-DEV-0096 (T5, FB-LR-07): escalate a cross-spec / design contradiction surfaced during
// remediation — do NOT let a remediation pick a side and commit a unilateral resolution
// (which masks an upstream conflict, as a racing committer did in live-run B). This records
// a NON-BLOCKING escalation to pending-actions and never commits code — the conflict is an
// upstream PRODUCT / spec-author decision, surfaced (never self-resolved).
const escalateConflict = (f, fix) =>
  agent(
    `A remediation for a ${f.validator} finding in feature ${FEATURE} hit a ${(fix && fix.block_class) || 'cross-spec'} that MUST NOT be resolved unilaterally (FB-LR-07): ` +
    `${(fix && fix.conflict_detail) || f.detail}.\n` +
    `Do NOT pick a side and do NOT commit a resolution. Append a NON-BLOCKING escalation entry to .claude/pending-actions.md (create if absent): ` +
    `the contradiction (which specs/requirements/design decisions disagree), the feature, and the route — Product for a cross-spec/requirement contradiction or a provider/design CHOICE, ` +
    PA_CANON +
    `the owning spec's author for a design self-contradiction. Mark it a cross-spec-conflict escalation requiring an upstream decision. Never commit code.`,
    { model: 'sonnet', phase: 'Synthesize', label: `escalate-conflict:${f.validator}:${f.ref || f.kind}` },   // MDP: escalation PA write (standard/mechanical)
  )

// FB-LR-16 (DEC-DEV-0102): the gate may remediate + COMMIT here, BEFORE the verdict is
// synthesised. If the gate is already known non-READY (substrate down / upstream degraded), a
// fix committed now is made WITHOUT a full green suite as a safety net. Policy (a)+disclosure:
// we STILL commit a substrate-INDEPENDENT confirmed fix (verify-finding-before-act already
// proved it real vs ground truth, independent of the DB — forbidding it would discard real
// work), but the commit is MARKED and the run DISCLOSES it so a READY re-run re-checks it; we do
// NOT silently mutate the tree under ENV_NOT_READY. (RANK/worstReadiness defined here, reused in
// the synthesis below.)
const RANK = { READY: 0, DEGRADED: 1, ENV_NOT_READY: 2 }
const worstReadiness = (a, b) => (RANK[a] >= RANK[b] ? a : b)
const remediationReadiness = worstReadiness((mech && mech.readiness) || 'READY', FWD_READINESS || 'READY')
const nonReadyRemediation = remediationReadiness !== 'READY'

// bounded remediation of PRESENT findings only; re-verify after each fix (a fix can be partial).
// SINGLE-WRITER (T5, extends FB-004): remediation is STRICTLY SEQUENTIAL — one finding fixed +
// committed at a time, never in parallel(), so two writers never race the git index within a
// run (cross-run single-writer is FB-004's "one orchestrator workflow per repo"). Each fix is
// re-verified against the worktree after committing; a fix that reports it was already resolved
// by a concurrent commit does NOT double-commit.
let remaining = present
let round = 0
const remediated = []
const conflicts = []   // DEC-DEV-0096 (T5, FB-LR-07): escalated cross-spec/design contradictions — surfaced, never self-resolved
while (remaining.length && round < MAX_REMEDIATION_ROUNDS) {
  round += 1
  log(`remediation round ${round}/${MAX_REMEDIATION_ROUNDS} — ${remaining.length} present finding(s)`)
  const next = []
  for (const f of remaining) {
    const fix = await agent(
      `Remediate a CONFIRMED-PRESENT ${f.validator} defect in feature ${FEATURE} (verified evidence: ${f.evidence || f.detail}). ` +
      `kind: ${f.kind}; ref: ${f.ref || 'n/a'}.\n` +
      `DISCRETION (T5, FB-LR-07) — FORBIDDEN to resolve unilaterally:\n` +
      `  • If fixing this requires resolving a contradiction BETWEEN specs/requirements (e.g. requirement A says X, requirement B says Y), ` +
      `return remediated:false, block_class:'cross-spec-conflict', and conflict_detail (which two disagree + the route). Do NOT pick a side, do NOT commit.\n` +
      `  • If it requires choosing between contradictory decisions in design.md (the design self-contradicts), ` +
      `return remediated:false, block_class:'design-contradiction' + conflict_detail. Do NOT pick a path, do NOT commit.\n` +
      `  • If it needs a capability you lack (tool/secret/access/upstream decision), return remediated:false, block_class:'capability' + what is needed — do NOT fake it.\n` +
      `  • To classify the block, run \`node ${REMEDIATION_GUARD} --reason "<your one-line blocker>"\` via Bash and use its class as the deterministic backbone (escalate if EITHER it or your judgment says a conflict — conservative toward escalation).\n` +
      `SINGLE-WRITER SAFETY (T5): before committing, re-confirm the defect is STILL present in the CURRENT tree — a concurrent commit may have resolved it since you started. If already resolved, return remediated:false, block_class:'resolved-by-concurrent-commit' (do NOT double-commit).\n` +
      (nonReadyRemediation
        ? `READINESS DISCLOSURE (FB-LR-16, DEC-DEV-0102): the gate is currently readiness=${remediationReadiness} — the full suite is NOT a green safety net right now. You MAY fix a defect confirmed against ground truth INDEPENDENT of the substrate, but (1) APPEND " [readiness=${remediationReadiness}: re-verify on a READY re-run]" to the commit message, and (2) do NOT fix anything whose correctness can only be confirmed by a green suite — return remediated:false, block_class:'transient' for that (it waits for a READY re-run).\n`
        : '') +
      `Otherwise fix the concrete defect ONLY (no scope creep), add/repair the covering test if the lens is requirements-coverage, then selective-commit (NEVER git add -A — explicit paths) with message: fix(${FEATURE}): ${f.kind} ${f.ref || ''}; return remediated:true, block_class:'fixed'. ` +
      `THEN self-check your fix: run \`node ${REMEDIATION_GUARD} --fix-note "<your one-line note of what you did>"\` and set unilateral to its result — if your fix actually resolved a contradiction by picking a side, set unilateral:true so it is surfaced (it should normally be false).`,
      { model: 'opus', schema: REMEDIATE_SCHEMA, phase: 'Synthesize', label: `remediate:${f.validator}:${f.ref || f.kind}` },   // MDP: fixes + commits a confirmed code defect (impl, high R + discretion)
    )
    const cls = (fix && fix.block_class) || ''
    const isEscalate = cls === 'cross-spec-conflict' || cls === 'design-contradiction'
    if (isEscalate || (fix && fix.remediated && fix.unilateral)) {
      // ESCALATE, don't self-resolve (FB-LR-07): a contradiction is an upstream decision, not a
      // code defect to fix here. A fix that admitted a unilateral resolution is ALSO surfaced —
      // it may have masked the conflict. Remove from the remediation set (no retry); it lives in
      // conflicts[] and forces the verdict away from a clean GO in synthesis below.
      conflicts.push({ ...f, conflict_class: cls || 'unilateral-resolution', conflict_detail: (fix && fix.conflict_detail) || f.detail, masked: !!(fix && fix.remediated && fix.unilateral) })
      log(`finding ${f.validator}/${f.ref || f.kind} → ESCALATED (${cls || 'unilateral-resolution'}) — upstream decision, not self-resolved`)
      await escalateConflict(f, fix)
      continue
    }
    if (fix && fix.remediated) {
      const recheck = await verifyFinding(f)
      if (recheck && recheck.disposition === 'present') next.push({ ...f, evidence: recheck.evidence })   // still present → another round
      else remediated.push(f)                                                                            // gone vs worktree → fixed
    } else if (cls === 'resolved-by-concurrent-commit') {
      remediated.push(f)                            // single-writer safety: a sibling commit fixed it → not a residual, not a double-commit
    } else {
      next.push(f)                                  // could not remediate (capability/content gap) → carries to residual
    }
  }
  remaining = next
}

// ---- ACCEPT-RATIFIED: hear the owner's answer to an escalation (DEC-DEV-0242, PA-139) -----
// The owner ratifies an escalated conflict through the pending-actions route ("leave it as is").
// The gate had no input for that answer, so every re-run re-escalated the SAME contradiction as a
// new PA and re-degraded GO → MANUAL_VERIFY (live run izrbls, already-ratified PA-071/073/074).
// A conflict covered by a ratified decision moves conflicts[] → accepted[]: it is STILL reported in
// findings below (disclosed, NOT silenced) — it merely stops counting against the verdict. Two
// steps, both agent-side because the script may not read the FS (DEC-DEV-0073 §D.1): (1) a
// MECHANICAL status check of each named PA against the canonical pending-actions file — the caller's
// word is never enough; (2) a JUDGMENT of whether a ratified decision covers THIS conflict. Every
// failure mode (arg absent / id not found / status not terminal / no match / agent dropped) falls
// back to the OLD behaviour: the conflict stays a conflict.
const RATIFIED_STATUS_SCHEMA = {
  type: 'object',
  required: ['checked'],
  properties: {
    checked: {
      type: 'array',
      items: {
        type: 'object',
        required: ['pa', 'exists', 'ratified'],
        properties: {
          pa: { type: 'string' },                        // the PA-NNN id as requested
          exists: { type: 'boolean' },                   // an entry with that exact id is present in the canonical file
          ratified: { type: 'boolean' },                 // its Status line carries a TERMINAL owner ratification (done/ratified) — never inferred from the body
          status_line: { type: 'string' },               // the Status line VERBATIM (evidence, not a paraphrase)
          summary: { type: 'string' },                   // what the entry decided — the matcher below judges coverage from this
        },
      },
    },
  },
}
const ACCEPT_MATCH_SCHEMA = {
  type: 'object',
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        required: ['conflict_ref', 'accepted_by', 'reason'],
        properties: {
          conflict_ref: { type: 'string' },              // the C<n> id handed to the judge (conflicts have no stable ref of their own)
          accepted_by: { type: ['string', 'null'] },     // the ratified PA-NNN that covers it, or null — ANY doubt is null
          reason: { type: 'string' },                    // the concrete evidence for the call (both directions)
        },
      },
    },
  },
}
const accepted = []            // conflicts the owner already ratified — out of the verdict math, still in the findings
const acceptRatifiedNotes = [] // requested-but-NOT-accepted ids — surfaced loudly, never swallowed
if (ACCEPT_RATIFIED.length && !conflicts.length) {
  for (const pa of ACCEPT_RATIFIED) {
    acceptRatifiedNotes.push(`acceptRatified requested for ${pa} but NOT accepted: no matching conflict — this run escalated no cross-spec/design conflict at all`)
  }
} else if (ACCEPT_RATIFIED.length) {
  log(`accept-ratified (DEC-DEV-0242): ${ACCEPT_RATIFIED.length} ratified PA(s) offered against ${conflicts.length} escalated conflict(s) — verifying status first`)
  const paStatus = await agent(
    `Ratification STATUS CHECK (DEC-DEV-0242) — mechanical, READ-ONLY, no judgment. This gate was handed these pending-action ids ` +
    `as OWNER-RATIFIED decisions: ${ACCEPT_RATIFIED.join(', ')}. Resolve the canonical pending-actions file and read each entry.\n` +
    PA_CANON +
    `READ-ONLY OVERRIDE of the instruction above: do NOT allocate an id, do NOT append, do NOT edit, do NOT commit — this step only READS.\n` +
    `For EACH requested id return {pa, exists, ratified, status_line, summary}:\n` +
    `  • exists   — an entry with EXACTLY that id is present in the canonical file.\n` +
    `  • ratified — TRUE ONLY IF that entry's Status line carries a TERMINAL ratification by the owner (done / ratified / accepted-by-owner / closed-as-ratified ` +
    `or an unambiguous equivalent). pending / open / escalated / in-progress / needs-decision / awaiting → FALSE. Missing or unreadable Status line → FALSE. ` +
    `Any doubt → FALSE (a false TRUE would let a live conflict stop counting against the verdict).\n` +
    `  • status_line — the Status line VERBATIM, not a paraphrase (it is the evidence).\n` +
    `  • summary — what that entry actually decided, in one or two sentences: enough for another judge to tell WHICH contradiction it settles.\n` +
    `Do NOT infer ratification from the entry's body text, from its age, or from your own opinion — only the Status line ratifies.`,
    { model: 'sonnet', schema: RATIFIED_STATUS_SCHEMA, phase: 'Synthesize', label: 'accept-ratified:status' },   // MDP: mechanical read + verbatim relay of a status line (no critical analysis)
  )
  const paChecked = ((paStatus && paStatus.checked) || []).filter((c) => c && /^PA-\d+$/.test(String(c.pa)))
  const paRatified = paChecked.filter((c) => c.exists === true && c.ratified === true)
  const ratifiedIds = new Set(paRatified.map((c) => String(c.pa)))
  if (!paStatus) log('accept-ratified: status check returned nothing — FAIL-SAFE: accepting nothing, every conflict stays a conflict')
  const acceptedBy = new Map()   // PA-NNN → how many conflicts it accepted (drives the not-accepted disclosure below)
  if (paRatified.length) {
    const indexed = conflicts.map((c, i) => ({ id: `C${i + 1}`, i, c }))
    const paMatch = await agent(
      `Accept-ratified MATCHING (DEC-DEV-0242) — judgment. Feature ${FEATURE}. This gate escalated the cross-spec/design conflicts below, ` +
      `and the OWNER has already ratified the decisions below. Decide, for EACH conflict, whether it is covered by EXACTLY ONE of those ratified decisions.\n` +
      `CONFLICTS:\n${indexed.map(({ id, c }) => `- ${id} [${c.validator}/${c.kind}] ref: ${c.ref || 'n/a'} — ${c.conflict_detail || c.detail}`).join('\n')}\n` +
      `RATIFIED DECISIONS (owner-closed pending actions):\n${paRatified.map((c) => `- ${c.pa} (Status: ${c.status_line || 'n/a'}) — ${c.summary || '(no summary relayed)'}`).join('\n')}\n` +
      `A conflict is COVERED only if the ratified decision is about THE SAME contradiction: the same specs/requirements/design decisions disagreeing over the same ` +
      `seam. The same feature, the same file, the same subsystem or a similar-sounding topic is NOT coverage. Read the ground truth (the spec/design/code the ` +
      `conflict names, and the pending-actions entry) before deciding — do not judge from the summaries alone.\n` +
      `ANY doubt = NOT covered (accepted_by: null). An over-broad match would let a LIVE contradiction stop counting against the verdict under a decision the owner ` +
      `never made about it — that is the one failure this step must never produce; a missed match merely costs a MANUAL_VERIFY the owner can re-ratify.\n` +
      `Return one entry per conflict id: accepted_by = the PA id exactly as given, or null; reason = the concrete evidence for your call (which part of the ` +
      `decision covers which part of the conflict — or why it does not).`,
      { model: 'opus', schema: ACCEPT_MATCH_SCHEMA, phase: 'Synthesize', label: 'accept-ratified:match' },   // MDP judging: does THIS ratification cover THIS conflict (high R — it changes the verdict math)
    )
    if (!paMatch) log('accept-ratified: matcher returned nothing — FAIL-SAFE: accepting nothing')
    const drop = new Set()
    for (const m of (paMatch && paMatch.matches) || []) {
      const hit = indexed.find((x) => x.id === String((m && m.conflict_ref) || ''))
      const by = String((m && m.accepted_by) || '')
      // DETERMINISTIC gate over the judgment: only a CONFIRMED-ratified id may accept, and a
      // conflict is accepted at most once. A judge naming an unverified/unknown PA accepts nothing.
      if (!hit || drop.has(hit.i) || !ratifiedIds.has(by)) continue
      drop.add(hit.i)
      accepted.push({ ...hit.c, accepted_by: by, reason: (m && m.reason) || '' })
      acceptedBy.set(by, (acceptedBy.get(by) || 0) + 1)
    }
    // move (never copy): conflicts[] is what the verdict synthesis reads below, and it must now
    // carry ONLY the conflicts that are still open. Reverse order so the splices keep the indices valid.
    for (let i = conflicts.length - 1; i >= 0; i -= 1) if (drop.has(i)) conflicts.splice(i, 1)
  }
  for (const pa of ACCEPT_RATIFIED) {
    if (acceptedBy.get(pa)) continue
    const rec = paChecked.find((c) => String(c.pa) === pa)
    const why = !paStatus ? 'the ratification status check failed (agent returned nothing) — fail-safe: this run accepted nothing'
      : !rec || rec.exists !== true ? 'no entry with that id in the canonical pending-actions file'
      : rec.ratified !== true ? `its Status line is not a terminal owner ratification (Status: ${rec.status_line || 'n/a'})`
        : 'no escalated conflict in this run is covered by that decision'
    acceptRatifiedNotes.push(`acceptRatified requested for ${pa} but NOT accepted: ${why}`)
  }
  log(`accept-ratified: ${accepted.length} conflict(s) accepted as owner-ratified; ${conflicts.length} conflict(s) still open; ${acceptRatifiedNotes.length} requested PA(s) not honoured`)
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
// DEC-DEV-0096 (T5, FB-LR-07): an escalated cross-spec / design conflict is an UPSTREAM
// decision, not a code defect — the feature's correctness is undecided until it is resolved,
// so it must NEVER read as a clean GO. Degrade a would-be GO to MANUAL_VERIFY (not NO-GO — the
// code may be fine pending the decision); surfaced for the owner. Conservative toward surfacing.
if (conflicts.length && result === 'GO') result = 'MANUAL_VERIFY_REQUIRED'
// FB-LR-15 (DEC-DEV-0101): a validator lens that never ran (terminal error after bounded
// re-spawn) means the gate did NOT judge that axis — a clean GO would hide an unjudged lens
// (a dropped RA-10 could let a real integration defect through under a GO). Degrade a would-be
// GO to MANUAL_VERIFY (never NO-GO — the lens is UNKNOWN, not failed). Conservative toward surfacing.
if (incompleteValidators.length && result === 'GO') result = 'MANUAL_VERIFY_REQUIRED'

// DEVIATION-TRIAGE (DEC-DEV-0231, ENFORCEMENT_PLAN 2.4 — feedback B1): when the gate's bounded
// forward-fix machinery is exhausted and the feature still fails WIDE (NO-GO with a threshold-wide
// unresolved set, or unresolved findings left after all remediation rounds), "keep fixing forward"
// stops being the only honest option — the alternative is re-deriving the slice from spec. This
// step PREPARES that fork; it never takes it: ONE judge (NOT a consilium — the owner's 2026-07-30
// adjudication policy: single judge + mandatory premise verification + a reverse pass), prepare-only,
// the OWNER ratifies via the pending-actions route. The TRIGGER is deterministic (code); the fork
// judgment is not scriptable — П-2 justification in DEC-DEV-0231.
const TRIAGE_SCHEMA = {
  type: 'object',
  required: ['recommendation', 'premises_verified'],
  properties: {
    recommendation: { type: 'string', enum: ['fix-forward', 're-derive'] },
    premises_verified: { type: 'boolean' },            // the judge re-checked each unresolved finding against ground truth before judging
    premise_notes: { type: 'array', items: { type: 'string' } },
    criteria: {
      type: 'object',
      properties: {
        cost: { type: 'string' },                      // estimated cost of each fork
        blast_radius: { type: 'string' },              // how much of the tree each fork touches
        spec_completeness: { type: 'string' },         // are the specs complete enough to re-derive from?
        validated_state_value: { type: 'string' },     // what already-validated state a re-derive would discard
        git_strategy: { type: 'string' },              // how each fork lands in git (branch / revert / rebuild)
      },
    },
    counter_case: { type: 'string' },                  // the reverse pass: the strongest case FOR the option NOT recommended
    rationale: { type: 'string' },
  },
}
let deviationTriage = null
const roundsExhausted = round >= MAX_REMEDIATION_ROUNDS && unresolved.length > 0
if (result === 'NO-GO' && (unresolved.length >= DEVIATION_TRIAGE_THRESHOLD || roundsExhausted)) {
  deviationTriage = await agent(
    `Deviation-triage (PREPARE-ONLY, DEC-DEV-0231): feature ${FEATURE} is NO-GO with ${unresolved.length} unresolved confirmed finding(s) ` +
    `after ${round} bounded remediation round(s). Prepare — do NOT take — the fork decision "fix-forward vs re-derive the slice from spec".\n` +
    `PREMISE VERIFICATION FIRST (the 2026-07-30 adjudication policy): re-check each unresolved finding against ground truth (code/tests/spec) — ` +
    `a triage built on an unverified premise is void; set premises_verified + premise_notes.\n` +
    `Findings:\n${unresolved.map((f) => `- [${f.validator}/${f.kind}] ${f.ref || ''}: ${f.detail}`).join('\n')}\n` +
    `Judge the fork on the criteria: cost · blast radius · spec completeness · value of the already-validated state · git strategy.\n` +
    `REVERSE PASS: before finalising, write the strongest case for the option you are NOT recommending (counter_case) — only then commit to recommendation + rationale.\n` +
    `PREPARE-ONLY: do NOT fix, do NOT revert, do NOT commit — the owner ratifies the fork. ` +
    `Append the prepared triage as a NON-BLOCKING entry to the canonical pending-actions file (route: owner ratification of the fork). ` + PA_CANON,
    { model: 'opus', schema: TRIAGE_SCHEMA, phase: 'Synthesize', label: 'deviation-triage' },   // MDP judging: single pinned judge + premise verification + reverse pass (DEC-DEV-0230 policy — консилиум демоутнут)
  )
  log(`deviation-triage prepared: ${deviationTriage ? `${deviationTriage.recommendation} (premises_verified=${!!deviationTriage.premises_verified})` : 'n/a (judge dropped)'} — prepare-only, owner ratifies`)
}

// findings to surface: unresolved confirmed defects + mechanical failures + forwarded implementer CONCERNS/deviations (FB-013 / DEC-DEV-0231 disclosure)
const readinessReasons = (mech && mech.readiness_reasons) || []
const findings = [
  ...(readiness !== 'READY'
    ? [`readiness=${readiness} (DEC-DEV-0092): the gate could NOT fully judge — ` +
       (readiness === 'ENV_NOT_READY'
         ? `substrate not ready, so this is MANUAL_VERIFY_REQUIRED, NOT a NO-GO; bring the substrate up and re-run \`/orchestrator:run validate-feature-impl --feature ${FEATURE}\`.`
         : `upstream tasks were blocked (feature incomplete); advisory.`) +
       (readinessReasons.length ? ` Reasons: ${readinessReasons.join('; ')}.` : '')]
    : []),
  ...(incompleteValidators.length
    ? [`validators_incomplete (FB-LR-15/DEC-DEV-0101): ${incompleteValidators.join(', ')} did NOT run (terminal error after ${MAX_VALIDATOR_RESPAWN} re-spawn(s)) — that lens did not judge; a clean GO is degraded to MANUAL_VERIFY. Re-run \`/orchestrator:run validate-feature-impl --feature ${FEATURE}\` for a full-lens gate.`]
    : []),
  ...(nonReadyRemediation && remediated.length
    ? [`readiness-gated commits (FB-LR-16/DEC-DEV-0102): ${remediated.length} fix(es) were committed during a readiness=${remediationReadiness} run (the full suite was not a green safety net) — each is marked in its commit message; re-verify them on a READY re-run before treating this gate as ground truth.`]
    : []),
  ...((mech && mech.failures) || []).map((x) => `mechanical: ${x}`),
  ...unresolved.map((f) => `${f.validator}/${f.kind} ${f.ref || ''}: ${f.detail} (confirmed-present; unresolved after ${MAX_REMEDIATION_ROUNDS} round(s))`),
  ...alreadyResolved.map((f) => `${f.validator}/${f.kind} ${f.ref || ''}: ${f.detail} (already-resolved since baseline, DEC-DEV-0093 — was REAL, fixed by a commit during/before the gate; NOT a hallucination. VERIFY the resolution is genuine, not a mask — single-writer remediation is now DEC-DEV-0096/T5.)`),
  ...conflicts.map((c) => `cross-spec/design conflict (FB-LR-07, T5/DEC-DEV-0096): ${c.validator}/${c.kind} ${c.ref || ''}: ${c.conflict_detail} — ESCALATED, not self-resolved; needs an upstream decision (Product for a cross-spec/requirement contradiction or a provider/design choice; the owning spec's author for a design self-contradiction).${c.masked ? ' A remediation reported a UNILATERAL resolution — VERIFY it did not mask the conflict.' : ''}`),
  // DEC-DEV-0242: an owner-ratified conflict is DISCLOSED, not silenced — it left the verdict math,
  // it did not leave the report. And a requested-but-unverified ratification is surfaced LOUDLY.
  ...accepted.map((a) => `ratified-conflict ACCEPTED (DEC-DEV-0242): ${a.validator}/${a.kind} ${a.ref || ''}: ${a.conflict_detail || a.detail} — accepted per ${a.accepted_by} (owner-ratified; disclosed, not silenced). Why it matches: ${a.reason || 'n/a'}. The contradiction itself is UNCHANGED — it no longer degrades this verdict, and it returns the moment the ratification is withdrawn or the id is dropped from acceptRatified.`),
  ...acceptRatifiedNotes.map((n) => `${n} — the gate accepts nothing on the caller's word (DEC-DEV-0242, fail-safe): this conflict, if any, still counts against the verdict. If the ratification is real, record it in the canonical pending-actions entry with a terminal Status line and re-run.`),
  ...CONCERNS.map((c) => `implementer concern/deviation (FB-013, DEC-DEV-0231): ${typeof c === 'string' ? c : `${c.task || ''}: ${c.concern || ''}`} — disclose at GO; a GO over an undeclared deviation or a mock-only/unwired real seam is GO-with-caveats, not clean`),
  ...(rootCause && rootCause.common_root
    ? [`root-cause-first (DEC-DEV-0231): ${present.length} findings shared ONE root — ${rootCause.root_detail} — ${rootRemediated ? 'remediated once before per-finding rounds' : 'diagnosed but NOT remediated (see block class in log)'}; diagnosed ONCE, not per-verdict (the RUN-A anti-pattern).`]
    : []),
  ...(deviationTriage
    ? [`deviation-triage (DEC-DEV-0231, prepare-only): recommendation=${deviationTriage.recommendation}; premises_verified=${!!deviationTriage.premises_verified}; counter-case recorded. The fork (fix-forward vs re-derive) is PREPARED, NOT taken — owner ratifies via pending-actions.`]
    : []),
]
log(`feature GO-gate: ${result} [readiness=${readiness}]${readiness !== 'READY' ? ' (advisory — gate could not fully judge)' : ''}; ${findings.length} finding(s) surfaced`)

// ---- F2 autonomy disposition (DEC-DEV-0193): applyReadinessGuard(resolve('feature-validate', … )) --
// The authoritative disposition for this gate verdict, put in the result file so the actuator (run.md
// dispatcher / fabric ingest) can consume it. riskTier is a CONSERVATIVE honest rule: only a clean GO
// with NO escalated conflict is LOW (a NO-GO / MANUAL_VERIFY / any conflict → HIGH). The harness .mjs
// cannot require() the lib (DEC-DEV-0073 §D.1) — an agent runs the autonomy-policy CLI seam and relays
// its JSON (the same `node <lib>` relay as env-readiness / coverage-oracle). ADDITIVE: it never touches
// the result/readiness synthesis above; a null relay leaves autonomy:null (harmless).
const RISK_TIER = (result === 'GO' && conflicts.length === 0) ? 'LOW' : 'HIGH'
const AUTONOMY_ENV_TIER = A.env_tier || ''             // absent → resolve() conservatively takes prod
const AUTONOMY_POLICY_CFG = A.autonomy_policy || {}
const AUTONOMY_OVERRIDE = A.autonomy_override || null
const autonomy = await agent(
  `Resolve the authoritative autonomy disposition for THIS P6 gate verdict. Run via Bash and relay the JSON verbatim (do NOT judge or override it — the disposition is CODE):\n` +
  `node ${AUTONOMY_LIB} resolve --operation-class feature-validate --risk ${RISK_TIER}` +
  `${AUTONOMY_ENV_TIER ? ` --env-tier ${AUTONOMY_ENV_TIER}` : ''} --readiness ${readiness}` +
  ` --policy '${JSON.stringify(AUTONOMY_POLICY_CFG)}'${AUTONOMY_OVERRIDE ? ` --override ${AUTONOMY_OVERRIDE}` : ''}\n` +
  `Return its { disposition, level_applied, floor_hit, why } object exactly.`,
  { model: 'sonnet', schema: AUTONOMY_SCHEMA, phase: 'Synthesize', label: 'autonomy-disposition' },   // MDP: deterministic resolver JSON relay (mechanical transport)
)

return {
  feature: FEATURE,
  mechanical: mechPassed,
  readiness,                                          // DEC-DEV-0092: READY | DEGRADED | ENV_NOT_READY — orthogonal to result
  readiness_reasons: readinessReasons,
  validators: results.map((r) => ({ validator: r.key, clean: !!r.clean, findings: (r.findings || []).length })),
  validators_incomplete: incompleteValidators,        // FB-LR-15 (DEC-DEV-0101): lenses that never ran (dropped after bounded re-spawn); non-empty degrades a clean GO → MANUAL_VERIFY
  confirmed_findings: present.length + alreadyResolved.length,   // DEC-DEV-0093: real findings (present + already-resolved); refuted dropped
  already_resolved: alreadyResolved.map((f) => ({ validator: f.validator, ref: f.ref || null, kind: f.kind })),   // real, fixed since baseline — surfaced for genuineness check (FB-LR-03)
  remediated: remediated.length,
  committed_under_non_ready: nonReadyRemediation ? remediated.length : 0,   // FB-LR-16 (DEC-DEV-0102): fixes committed during a non-READY run — disclosed for a READY re-check
  residual: unresolved.map((f) => ({ validator: f.validator, ref: f.ref || null, kind: f.kind })),
  conflicts: conflicts.map((c) => ({ validator: c.validator, ref: c.ref || null, kind: c.kind, conflict_class: c.conflict_class, masked: !!c.masked })),   // DEC-DEV-0096 (T5, FB-LR-07): escalated cross-spec/design contradictions — surfaced, never self-resolved; forces ≥ MANUAL_VERIFY
  accepted: accepted.map((a) => ({ validator: a.validator, ref: a.ref || null, kind: a.kind, accepted_by: a.accepted_by, reason: a.reason || null })),   // DEC-DEV-0242 (PA-139): conflicts the OWNER ratified — verified against the pending-actions Status line, moved OUT of conflicts[] so they stop degrading the verdict, still disclosed in findings
  concerns: CONCERNS,                                 // FB-013 / DEC-DEV-0231: implementer concerns/deviations, disclosed not dropped
  root_cause: rootCause ? { common_root: !!rootCause.common_root, root_detail: rootCause.root_detail || null, affected: rootCause.affected || [], remediated: rootRemediated } : null,   // DEC-DEV-0231 (2.3): the shared-root diagnosis, made ONCE
  deviation_triage: deviationTriage || null,          // DEC-DEV-0231 (2.4): prepare-only fix-forward-vs-re-derive packet — owner ratifies, the gate never executes it
  result,                                             // GO | NO-GO | MANUAL_VERIFY_REQUIRED
  findings,
  go_gate: result,                                    // alias P5 reads (mirrors feature-to-tdd-impl's go_gate key)
  autonomy: autonomy || null,                         // DEC-DEV-0193 (F2): applyReadinessGuard∘resolve disposition envelope — authoritative for the run.md dispatcher / fabric ingest
}
