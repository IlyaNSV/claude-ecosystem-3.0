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
const REMEDIATION_GUARD = A.remediationGuard || '.claude/orchestrator/lib/remediation-guard.cjs' // DEC-DEV-0096: remediation-discretion backbone (T5)
const VALIDATION = A.validationCommands || {}                    // {test, build, smoke} discovered by P5/preflight
const SOURCE = A.source || ''                                    // optional .product handoff for the coverage-oracle backbone
const CONCERNS = A.concerns || []                                // FB-013: deferred-capability flags forwarded from P5
const DEGRADED = !!A.degraded                                    // P5 had blocked tasks → feature NOT complete → advisory
const FWD_READINESS = A.readiness || ''                          // DEC-DEV-0092: optional readiness hint forwarded from P5 pre-flight
const MAX_REMEDIATION_ROUNDS = A.maxRemediationRounds || 3
const MAX_VALIDATOR_RESPAWN = A.maxValidatorRespawn || 2          // FB-LR-15 (DEC-DEV-0101): bounded re-spawn of a validator slot dropped on a terminal API error

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
  ...CONCERNS.map((c) => `deferred-capability (FB-013): ${typeof c === 'string' ? c : `${c.task || ''}: ${c.concern || ''}`} — disclose at GO; a GO over a mock-only/unwired real seam is GO-with-caveats`),
]
log(`feature GO-gate: ${result} [readiness=${readiness}]${readiness !== 'READY' ? ' (advisory — gate could not fully judge)' : ''}; ${findings.length} finding(s) surfaced`)

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
  concerns: CONCERNS,                                 // FB-013: deferred-capability flags, disclosed not dropped
  result,                                             // GO | NO-GO | MANUAL_VERIFY_REQUIRED
  findings,
  go_gate: result,                                    // alias P5 reads (mirrors feature-to-tdd-impl's go_gate key)
}
