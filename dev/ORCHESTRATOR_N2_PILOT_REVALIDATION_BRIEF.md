# Orchestrator N+2 — pilot re-validation brief (owner-driven)

> **What:** the empirical proof that the six merged N+2 increments work end-to-end in the
> pilot. The code is verify-green but **none of it has been live-run yet** — this brief is the
> hand-off for the **owner-driven** session that runs it. I (the harness) cannot run it: it
> needs `/ecosystem:update` + live Orchestrator runs in the pilot `my-first-test`, then a
> post-hoc grade. **Executor/reviewer separation** ([[feedback_separate_task_from_test]]): run
> the executor tasks CLEAN (no hints about what's being checked); grade afterwards by transcript.
>
> Increments under test (all on `main`): T1 `verdict × readiness` (0092) · T2 order-aware verify
> (0093) · P3 FB-028 defect-enum (0094) · T4 design→tasks coverage (0095) · T5 remediation
> guardrails (0096) · P6 feedback phase-2 receiving side (0097). Plus the two riders (0089:
> PA-dedup + `missing-trace-source` rename).

## 0. Pre-conditions (before any run)

1. **Deliver to the pilot:** `/ecosystem:update` in `my-first-test`. This carries the new
   orchestrator processes (`audit-spec-fidelity` / `validate-feature-impl` / `feature-to-tdd-impl`),
   the new libs (`env-readiness.cjs`, `design-coverage-oracle.cjs`, `remediation-guard.cjs`), and
   the feedback-contour split (`/product:validation-tune` + `/ecosystem:meta-feedback`).
2. **Wipe-protection (principle 6):** the update must NOT vaporize pilot state — `.product/`,
   the Orchestrator project-state, and any `.product/.upstream/feedback-outbox.md` survive. The
   `update.md` level-1/level-2 wipe-protection + namespace-preserve is the contract; confirm the
   safety-commit ran. If anything pilot-local would be deleted, STOP.
3. **Data migration (soft):** `.product/.pending/meta-feedback.yaml` → `validation-tune.yaml`
   (absent == prior behavior 1:1). Run the backfill prompt in the CHANGELOG 0090 entry if needed.
4. **Tag a clean baseline** in the pilot git BEFORE the runs (FB-LR-14) so the grade has a fixed
   reference and the next run starts from a known sha.

## 1. The three runs + what each must now produce

Run each as a clean task; capture the transcript / Workflow return. Pass criteria are the
**behaviors the increments added** — they are what the grade checks (do NOT tell the executor).

### Run A — P4 `audit-spec-fidelity --feature localization` (run it **twice**)
- **T4 (0095):** a confirmed design→tasks coverage gap (a design file no task builds) is surfaced
  in `coverage_gaps` and the feature is excluded from `impl_ready` — or, if `localization` has no
  gap, `coverage_gaps: []` (don't manufacture one).
- **Rider rename (FB-LR-12):** any trace-integrity finding is `kind: missing-trace-source`
  (NOT `fabricated-trace`).
- **Rider PA-dedup (FB-LR-10) — the headline idempotency check:** on the **second** A run over the
  same un-reconciled `localization`, the gate must **UPDATE the existing open pending-action**, not
  append a near-duplicate (no PA-013/014/015 pattern). PASS = one PA, refreshed; FAIL = a 2nd
  near-duplicate PA appended.
- **T2 (0093):** an already-fixed-since-baseline drift is `already-resolved` (surfaced), not
  mislabeled a hallucination.

### Run B — P6 `validate-feature-impl --feature billing` **with Docker/DB DOWN**
- **T1 (0092) — the headline false-NO-GO fix:** build GREEN but the suite RED on substrate errors
  (`PrismaClientInitializationError` / `ECONNREFUSED :5432`) must yield **`readiness=ENV_NOT_READY`
  → `result=MANUAL_VERIFY_REQUIRED`**, NOT a `NO-GO`. PASS = MANUAL_VERIFY + `readiness=ENV_NOT_READY`
  in the return + a "bring the substrate up and re-run" finding. FAIL = NO-GO.
- **P3 (0094):** no positive "coverage confirmed" finding survives to `residual` to force MANUAL_VERIFY
  over a clean GO (only real defects are findings).

### Run C — P5 `feature-to-tdd-impl --feature admin` (P5→P6 nesting)
- **T3 (0091) — the headline delegation fix:** the nested P6 call by `{scriptPath}` must **RETURN a
  real verdict** (mechanical + RA-8/9/10 + verify-finding), NOT the advisory inline
  `kiro-validate-impl` fallback. PASS = the run log/return shows the real P6 ran (a `go_gate` from
  the full gate, not the "GATE DEGRADED: P6 delegation failed" fallback finding).
- **T5 (0096) — the conflict-escalation check:** if a task hits the `had_trial` cross-spec
  contradiction (FM-001↔FM-005) or a design self-contradiction, it must **ESCALATE** (recorded in
  `conflicts`, routed to a pending-action, the feature gate ≥ `MANUAL_VERIFY`) — NOT be resolved
  unilaterally by a committer. PASS = a `conflicts[]` entry + no unilateral commit masking it.
- **T5 transient retry:** a transient impl-block (locked index / flaky install / momentarily-down
  substrate) auto-retries (bounded) without a manual re-drive.

### Feedback phase-2 (0097) — receiving-side check (after the runs, in the ecosystem repo)
- If any run captured a systemic finding via `/ecosystem:meta-feedback` into the pilot's
  `.product/.upstream/feedback-outbox.md`, run from the ecosystem repo:
  `node dev/meta-improvement/scripts/feedback-intake.js --outbox <pilot>/.product/.upstream/feedback-outbox.md`
  and confirm it picks the `UF-*` up, unifies them, and dispositions each (open / likely-ported /
  ported) against `DEV_JOURNAL`.

## 2. Grading (post-hoc, by transcript)

For each run, grade by the transcript + the Workflow return against the per-run PASS criteria
above — do not coach the executor mid-run. Record findings as a new FB-ledger pass (discrete rows,
[[feedback_separate_task_from_test]] / DEC-DEV-0057 Lesson #1: one finding = one corrected
root-cause + route; if a run mis-diagnoses something, record the corrected cause). A genuine new
defect → a `DEC-DEV-*` in this repo (next free = **0098**). A green run → note the increment is
live-validated.

## 3. OPEN pilot risk to confirm (not fix)

**FM-001↔FM-005 `had_trial` silent no-op:** T5 now makes a remediation hitting this **escalate**
(GO→MANUAL_VERIFY) instead of masking it — Run C should demonstrate the escalation fires. The
contradiction itself still needs an upstream **product** decision (Path A: auth stops flipping
`had_trial`; Path B: re-key billing idempotency off Subscription existence) — out of scope for the
re-validation, keep OPEN.

## Related
- Plan / queue: `dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md`
- Findings ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`
- Resume checkpoint: `dev/ORCHESTRATOR_N2_RESUME.md`
- N+1 precedent brief (structure): `dev/ORCHESTRATOR_P4_P6_LIVE_BRIEF.md`
