# Orchestrator P4/P6 live-run — FB-ledger (A+B+C, discrete findings)

> **What:** the ecosystem-side ledger of findings from the first live-run of the P4/P6 increment
> (pilot `my-first-test`), harvested by a multi-agent post-hoc audit (3 audit workflows + 2 empirical
> nesting tests + a 4-lens council). Closes the pilot→ecosystem feedback loop: until this file the ~14
> findings lived only in pilot git (`grep FB-028` over the ecosystem repo = 0 matches). Authoritative
> decision + rationale: **[DEV_JOURNAL DEC-DEV-0091](../DEV_JOURNAL.md)**. Next-increment spec:
> **[ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md](ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md)**.
>
> **Discrete, not blurred** (DEC-DEV-0057 Lesson #1): each row is one finding with its own corrected
> root-cause + route. Where the live (C-)session mis-diagnosed a finding, the **corrected** root-cause is
> recorded here and the pilot's claim is flagged.
>
> **Runs:** A = `/orchestrator:run audit-spec-fidelity --feature localization` (P4, ×2). B =
> `validate-feature-impl --feature billing` (P6 standalone). C = `feature-to-tdd-impl --feature admin`
> (P5→P6 nesting). Pilot sessions: A `14b2e918`/`6c9e49d6`; B `ccc40e1d`; C `395404ba`.

## Verdict per run

| run | what it validated | verdict |
|---|---|---|
| **A** (P4) | spec-vs-`.product` fidelity gate | **PASS** — oracle ran via Bash, drift caught, triage spec/product correct, verify-finding-before-act held. |
| **B** (P6 standalone, billing) | feature-level GO/NO-GO | **PASS on rubric (6/7, 1 N/A)** — but headline NO-GO was an **env false-negative** (DB down at run time). |
| **C** (P5→P6, admin) | nesting + the whole P5 loop | P6-standalone **strong** (caught a real cross-feature regression); **P5→P6 delegation FAILED every run** (by-name). |

## Ledger

| id | sev | run | finding | corrected root-cause | route / status |
|---|---|---|---|---|---|
| FB-LR-01 | 🟠→🟢 | C | P5→P6 delegation never ran the real P6 — fell back to advisory inline every run | `workflow('validate-feature-impl')` called **by name**; orchestrator `.mjs` are not registered named-workflows → throws. **NOT** a nesting-limit (one-level nesting from a tool-launched P5 is permitted — proven: docs + 2 empirical tests). The pilot's FB-020 + `project_orchestrator_p6_delegation_unresolvable` memory mis-attributed it and proposed fixes that were partly moot. | **FIXED (T3, DEC-DEV-0091):** call by `{scriptPath}`; fallback kept; wiring-test pins scriptPath form; degradation now surfaced in findings. Re-confirm on pilot C re-run. |
| FB-LR-02 | 🔴 | B,C | Gates conflate "substrate not ready / gate didn't run" with "code failed" | B: Docker/DB down → build GREEN but 181 `PrismaClientInitializationError` → `!mechPassed → NO-GO` (validate-feature-impl.mjs:246) — false NO-GO. C: nested-throw → advisory `MANUAL_VERIFY_REQUIRED`, indistinguishable from honest-unsure. `degraded` is **computed** (feature-to-tdd-impl.mjs:331) but never put in the **return** (P5:369 / P6:268) — lives only in `log()`. | **QUEUED P1 (increment body):** two-axis contract `verdict × readiness` + shared env-readiness probe. See work-order. |
| FB-LR-03 | 🔴 | B,C | `verify-finding-before-act` is order-sensitive (TOCTOU) — a confirmer reading the already-remediated tree mislabels a **real** finding "hallucination"; a racing committer can mask an unresolved defect | `verifyFinding` greps the **current** tree with no pre-fix snapshot; parallel/sequential confirmers flap confirm↔refute by commit timing. In B this masked a genuine cross-spec defect (FM-001↔FM-005 `had_trial`: auth sets `had_trial=true` before `account.confirmed` → trial activation may silently no-op) — it never reached `residual`/`concerns`. Observed in **both** B and C. | **FIXED (T2, DEC-DEV-0093):** order-aware verify — pre-gate baseline sha + 3-way `disposition` (present / already-resolved / refuted) in BOTH P4 + P6; an already-fixed real finding is `already-resolved` (surfaced, not "hallucination"), a masked defect is surfaced not dropped. Full single-writer serialization of concurrent committers = T5 (still QUEUED P5). |
| FB-LR-04 | 🟠 | C | `MANUAL_VERIFY_REQUIRED` is 3-way overloaded (FB-021): honest-unsure / advisory-degraded / gate-didn't-run | No machine-readable degraded state; the three collapse into one token. | **QUEUED P1** (resolved by the `readiness` axis of the contract). |
| FB-LR-05 | 🟠 | C | design §File Structure → tasks.md coverage is a blind spot of **all** oracles (FB-019) | coverage-oracle = requirement-id→presence; fidelity-oracle = spec-ref→`.product`; RA-10 = cross-task seams **post-impl by code**. None checks `design.FileStructure ⊆ ⋃tasks.boundary` **pre-impl** → the missing `admin.module.ts` assembly task shipped a fully-unmounted API. Partial cover "from below" by RA-10 only if another task references the orphan. | **FIXED (DEC-DEV-0095):** new `design-coverage-oracle.cjs` (extract design files + basename-scan tasks.md → `uncovered_design_files`) + T4-lite forward-ref linter; P4 runs it as a hybrid layer (oracle candidates → semantic-confirm) — a confirmed gap excludes the feature from `impl_ready` + routes spec-completion (surface, not auto-add-task). run.md enforces "P4 between P3 and P5". |
| FB-LR-06 | 🟡 | C | FB-028 was **mis-diagnosed** by the pilot — there is no `kind:coverage_confirmation` constant in the code | Real cause: `kind: {type:string}` is a **free string**, so RA-8 emitted a *positive* "finding" against its role; `verifyFinding` then **false-confirmed** it (confirming "coverage is real" → `confirmed:true`) → it survived to `residual` → forced `MANUAL_VERIFY` over GO. The pilot's proposed fix ("exclude the kind") is a no-op against a phantom constant. | **FIXED (DEC-DEV-0094):** `VALIDATOR_SCHEMA.kind` → defect enum (positive-confirmation kind unrepresentable; a covered requirement is `clean:true`, never a finding) + `verifyFinding` polarity-gate (a positive assertion → `refuted` before the disposition check). P6 wiring 18→19. |
| FB-LR-07 | 🟠 | B | Racing remediation agents reach contradictory outcomes on one finding; one commits unilaterally, masking an upstream cross-spec conflict | FB-010 trial seam: 2 agents BLOCKED (found the `had_trial` conflict, asked for an FM-001↔FM-005 decision), 1 committed `54dc40f` and won → the conflict never escalated to `concerns`. Also `card_last4`: one agent BLOCKED citing a design self-contradiction, another unilaterally chose a design path. | **QUEUED P5** (remediation discretion guardrails: single-writer, escalate-don't-self-resolve, no unilateral design decisions). |
| FB-LR-08 | 🟠 | C | Transient impl-block has no in-workflow auto-retry (FB-022) | `feature-to-tdd-impl.mjs:259-267`: impl BLOCKED → one debug round → recordBlock + skip. Distinct from harness stall-retry (which IS auto). Task 2.2 needed a manual RUN02 re-drive. | **QUEUED P5** (classify transient vs content/upstream block; bounded auto-retry for transient). |
| FB-LR-09 | 🟡 | C | env-probe doesn't check migration-history integrity (FB-023) | An implementer did a substrate-fixup (`prisma migrate resolve --applied`) inside an impl task because the probe checks "datastore up" but not "migration history consistent". | **QUEUED** (fold into the shared env-readiness probe, FB-LR-02). |
| FB-LR-10 | 🟡 | A | No PA dedup — repeated audits append near-duplicate pending-actions (the **DEC-DEV-0089** earmark) | 3 successive P4 runs over the same un-reconciled `localization` produced 3 near-duplicate PAs (013/014/015); the process appends + commits a new PA instead of "already-routed → update existing". Drift-count was also non-deterministic (5→4→3) from LLM grouping. | **QUEUED:** dedup pre-filter in audit-spec-fidelity (DEC-DEV-0089). |
| FB-LR-11 | 🟢 | A,C | `args` passed as a JSON **string** instead of an object (FB-001/002 class) | Both A sessions + C did it; the `.mjs` defensive-parse held (guard confirmed under load). | Cosmetic — guard works; note in run.md. |
| FB-LR-12 | 🟢 | A | `kind:fabricated-trace` is a misnomer for real cross-feature owned contracts (BR-074/IC-028) | Routing + detail were correct; only the label misleads. | Cosmetic rename in audit-spec-fidelity. |
| FB-LR-13 | 🟢 | C | post-remediation verifier evidence text says "FINDING IS A HALLUCINATION / fabricated quotes" when the truth is "already fixed" | Same TOCTOU surface as FB-LR-03; the original finding **was** real pre-fix. | **FIXED with FB-LR-03 (T2, DEC-DEV-0093):** the `already-resolved` disposition now distinguishes "was real, fixed since baseline" from "hallucination". |
| FB-LR-14 | ℹ️ | C | process/bookkeeping: pilot baseline branch `pre-cc-sdd-pilot` fast-forwarded to `== main` (`ee7cd0e`); the "S7" name collision (admin live-run was journaled as "S7" but canonical S7 = §6 detect-leg); merge of a MANUAL_VERIFY feature into main left only **PA-019** genuinely open (PA-017/018 resolved by code). | Bookkeeping: tag a clean baseline before future runs; rename admin live-run records to RUN-C; keep the FM-001↔FM-005 `had_trial` risk OPEN in the pilot until FB-LR-03 lands. |

## Positive confirmations (live-validated, no action)

- **Real P6 catches what advisory misses (the core value):** C P6#1 (NO-GO) caught a real cross-feature regression — admin 4.1 made the shared `AuthGuard.canActivate` async, breaking a localization prerequisite test — that the advisory inline fallback had GO'd over the same tree (commit `e02200a` msg: *"Surfaced by P6 mechanical gate wf_8f31bc8a (NO-GO)"*).
- **3 validators RA-8/9/10 run in parallel** (B + C P6 runs — journal-confirmed).
- **verify-finding-before-act drops real false-positives** pre-remediation (B dropped 2/8: a grep-scope artifact + 5 cross-FM adjacency ids; C dropped an over-broad oracle_note).
- **Deterministic GO-synthesis** is a pure function of (DEGRADED, mechPassed, unresolved, severity).
- **FB-013 concerns plumbing** (DEC-DEV-0081 #1) works live — 15 concerns reached the controller in C RUN01.
- **Durable skeleton** held: 88 agents / ~7h17m / ~7.6M tokens single C RUN01, no lost work.
- **Spec-amend (+task 7.1)** in C was a **legitimate** design-backed unblock (every line traces to `design.md`), not scope-creep.
