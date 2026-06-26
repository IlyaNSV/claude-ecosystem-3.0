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
| FB-LR-07 | 🟠→🟢 | B | Racing remediation agents reach contradictory outcomes on one finding; one commits unilaterally, masking an upstream cross-spec conflict | FB-010 trial seam: 2 agents BLOCKED (found the `had_trial` conflict, asked for an FM-001↔FM-005 decision), 1 committed `54dc40f` and won → the conflict never escalated to `concerns`. Also `card_last4`: one agent BLOCKED citing a design self-contradiction, another unilaterally chose a design path. | **FIXED (T5, DEC-DEV-0096):** new `remediation-guard.cjs` (classifyBlock + detectsUnilateralResolution); P6 remediation single-writer + escalate cross-spec/design conflict to a `pending-actions` CONCERN (`escalateConflict`) + `conflicts` return field that degrades GO→MANUAL_VERIFY; P5 implementer forbidden to resolve a contradiction unilaterally → escalates with the upstream route. A "fix" admitting a unilateral resolution is flagged (`masked:true`). |
| FB-LR-08 | 🟠→🟢 | C | Transient impl-block has no in-workflow auto-retry (FB-022) | `feature-to-tdd-impl.mjs:259-267`: impl BLOCKED → one debug round → recordBlock + skip. Distinct from harness stall-retry (which IS auto). Task 2.2 needed a manual RUN02 re-drive. | **FIXED (T5, DEC-DEV-0096):** P5 classifies a BLOCK (remediation-guard backbone) before a debug round — a `transient` block gets a bounded auto-retry (`maxTransientRetries` default 2; re-probe env, no debug round consumed); content/capability/conflict take their own routes. |
| FB-LR-09 | 🟡 | C | env-probe doesn't check migration-history integrity (FB-023) | An implementer did a substrate-fixup (`prisma migrate resolve --applied`) inside an impl task because the probe checks "datastore up" but not "migration history consistent". | **QUEUED** (fold into the shared env-readiness probe, FB-LR-02). |
| FB-LR-10 | 🟡→🟢 | A | No PA dedup — repeated audits append near-duplicate pending-actions (the **DEC-DEV-0089** earmark) | 3 successive P4 runs over the same un-reconciled `localization` produced 3 near-duplicate PAs (013/014/015); the process appends + commits a new PA instead of "already-routed → update existing". Drift-count was also non-deterministic (5→4→3) from LLM grouping. | **FIXED (DEC-DEV-0089, PR #50):** both PA-emitting prompts in `audit-spec-fidelity.mjs` now scan open PAs + UPDATE in place on a matching `(feature, route, ids/paths)` signature instead of appending (prompt pre-filter, not a lib — PA writes live inside agents). Idempotency confirm = Run A ×2 in the re-validation brief. Drift-count jitter left as-is (accepted artifact). |
| FB-LR-11 | 🟢 | A,C | `args` passed as a JSON **string** instead of an object (FB-001/002 class) | Both A sessions + C did it; the `.mjs` defensive-parse held (guard confirmed under load). | Cosmetic — guard works; note in run.md. |
| FB-LR-12 | 🟢 | A | `kind:fabricated-trace` is a misnomer for real cross-feature owned contracts (BR-074/IC-028) | Routing + detail were correct; only the label misleads. | **FIXED (DEC-DEV-0089 rider, PR #50):** renamed `fabricated-trace` → `missing-trace-source` (emit ↔ exempt-guard ↔ wiring-test changed together; the name now points at the missing `.product` *source*, not an accusation of fabrication). |
| FB-LR-13 | 🟢 | C | post-remediation verifier evidence text says "FINDING IS A HALLUCINATION / fabricated quotes" when the truth is "already fixed" | Same TOCTOU surface as FB-LR-03; the original finding **was** real pre-fix. | **FIXED with FB-LR-03 (T2, DEC-DEV-0093):** the `already-resolved` disposition now distinguishes "was real, fixed since baseline" from "hallucination". |
| FB-LR-14 | ℹ️ | C | process/bookkeeping: pilot baseline branch `pre-cc-sdd-pilot` fast-forwarded to `== main` (`ee7cd0e`); the "S7" name collision (admin live-run was journaled as "S7" but canonical S7 = §6 detect-leg); merge of a MANUAL_VERIFY feature into main left only **PA-019** genuinely open (PA-017/018 resolved by code). | **Scoped (2026-06-23, multi-agent sweep):** the S7 mislabel is **pilot-side, NOT in the ecosystem repo** — every in-repo `S7` is a legitimate other meaning (Phase-4 hash smoke / Phase-6 update-compat smoke / the canonical §6 detect-leg brief `dev/ORCHESTRATOR_S7_BRIEF.md`, all STAY). The only RUN-C-to-be artifact is the pilot file `my-first-test/.claude/orchestrator/runs/S7-FEEDBACK-JOURNAL.md` (admin run `395404ba`) → rename to `RUN-C-FEEDBACK-JOURNAL.md` + reconcile `ORCHESTRATOR_S7_BRIEF.md:118`'s journal-path so the detect-leg S7 reclaims that filename. **These are pilot-repo edits → folded into the pilot re-validation session** (`dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md` §0.4 clean-baseline tag). The pilot memory `project_orchestrator_p6_delegation_unresolvable` (mis-attributed the delegation failure, disproved by DEC-DEV-0091/T3) is **corrected** (superseded note added). `had_trial` risk: masking mechanism now closed by T5 (DEC-DEV-0096); keep OPEN for the upstream **product** decision. |

## N+2 re-validation findings (2026-06-25)

> From the **owner-driven N+2 re-validation** runs ([UNIFIED_PILOT_VALIDATION_PLAN.md](_archive/orchestrator/UNIFIED_PILOT_VALIDATION_PLAN.md)),
> graded post-hoc against the layered evidence model ([[feedback_audit_evidence_layers]]) + an independent
> **blind subagent audit** + a neutral **3rd-agent adjudication** (V1 ≈ V2, agreed on every rubric item).
> Re-val sessions: A `1d4c7e81`/`7c894805` (P4 localization ×2); B `bcf29996` (P6 billing, Docker down→up);
> C `336a2973` (P5→P6 admin, no-op — admin already 17/17 `[x]`, so T3 nesting **not exercised**, re-run on an
> un-done feature needed). Both rows below are **observability/robustness edges — NOT incorrect verdicts**
> (the gate's decisions were sound); flagged as **DEC-DEV candidates** pending owner decision. Next-free
> DEC-DEV at write time = **0101** (assign live on decision — guard the 0082-style collision).

| id | sev | run | finding | corrected root-cause | route / status |
|---|---|---|---|---|---|
| FB-LR-15 | 🟠 | B (re-val, `bcf29996`) | A validator that dies on a **terminal API error** ("Connection closed mid-response") is **not retried in-run and silently dropped** — the verdict runs on a reduced validator set with no "axis not judged" disclosure | RA-10 integration-boundary died on attempt 1 in run#1 (Docker-down); `result.validators[]` simply **omits** it (2 of 3 ran), and the missing lens is inferable only from the per-agent ledger `state:error`, never surfaced in the verdict envelope. Asymmetry: **stalls** auto-retry bounded (≤5; all recovered — attempts 2/3/4), **hard API errors** get 0 retries (terminal `null` per Workflow semantics; the process proceeds with whatever validators succeeded). Did not flip the headline here (run#1 was MANUAL_VERIFY anyway), but in another run a dropped validator could let a real integration defect through under a clean GO. Confirmed by the 3-agent cross-check. | **FIXED — DEC-DEV-0101.** P6 bounded RE-SPAWNs a dropped slot (`MAX_VALIDATOR_RESPAWN`, default 2); a still-empty slot → `incompleteValidators` → degrades a clean GO to MANUAL_VERIFY (never NO-GO — the lens is UNKNOWN, not failed) + `validators_incomplete` return field + a disclosure finding. P6 wiring 26/26. Re-validate on a P6 run where a validator genuinely dies. |
| FB-LR-16 | 🟡 | B (re-val, `bcf29996`) | The gate **commits autonomously during an `ENV_NOT_READY` run** — writes to the repo while declaring it "could not fully judge" | run#1 returned `MANUAL_VERIFY_REQUIRED [readiness=ENV_NOT_READY]` yet still remediated + committed a confirmed-present design-divergence (`b67798c`, checkout_abandoned). Defensible (the divergence was confirmed vs ground truth independent of the DB; verify-before-act held; `unilateral:false`) — but a **policy** question: should a gate that returned ENV_NOT_READY mutate the tree at all, or hold all commits until a READY re-run? Surfaced by the adjudicator as the single decision-relevant asymmetry between the two audits (V1 raised it; V2 recorded the commit but did not escalate). | **FIXED (policy a + disclosure) — DEC-DEV-0102.** Chose (a) keep — substrate-independent confirmed fixes (verify-finding-before-act proved them real) stay committable — but the run now MARKS the commit (` [readiness=…: re-verify on a READY re-run]`) and DISCLOSES it (`committed_under_non_ready` + a finding). Forbidding (b) would discard real verified work; the risk was *silent* mutation, which the mark+disclosure closes. |

## Positive confirmations (live-validated, no action)

- **Real P6 catches what advisory misses (the core value):** C P6#1 (NO-GO) caught a real cross-feature regression — admin 4.1 made the shared `AuthGuard.canActivate` async, breaking a localization prerequisite test — that the advisory inline fallback had GO'd over the same tree (commit `e02200a` msg: *"Surfaced by P6 mechanical gate wf_8f31bc8a (NO-GO)"*).
- **3 validators RA-8/9/10 run in parallel** (B + C P6 runs — journal-confirmed).
- **verify-finding-before-act drops real false-positives** pre-remediation (B dropped 2/8: a grep-scope artifact + 5 cross-FM adjacency ids; C dropped an over-broad oracle_note).
- **Deterministic GO-synthesis** is a pure function of (DEGRADED, mechPassed, unresolved, severity).
- **FB-013 concerns plumbing** (DEC-DEV-0081 #1) works live — 15 concerns reached the controller in C RUN01.
- **Durable skeleton** held: 88 agents / ~7h17m / ~7.6M tokens single C RUN01, no lost work.
- **Spec-amend (+task 7.1)** in C was a **legitimate** design-backed unblock (every line traces to `design.md`), not scope-creep.

---

## Track V (Block 2 — Vision Epic A+B) re-validation findings (2026-06-25)

> From the **Block-2 / Track-V** live-run ([UNIFIED_PILOT_VALIDATION_PLAN.md](_archive/orchestrator/UNIFIED_PILOT_VALIDATION_PLAN.md) §3,
> runbook [PILOT_SESSION_RUNBOOK_BLOCK2.md](_archive/orchestrator/PILOT_SESSION_RUNBOOK_BLOCK2.md)), pilot session `6ada7ef9`,
> graded post-hoc on ground-truth (transcript + oracle re-run + pilot git-diff + a real `js-yaml` parse of
> the agent frontmatter). Both rows are **real defects** (not observability edges) — **fixed in DEC-DEV-0103**.

| id | sev | check | finding | corrected root-cause | route / status |
|---|---|---|---|---|---|
| FB-LR-17 | 🔴 | V-2 (persona spawn) | All 3 canonical advisor `subagent_type`s (`architect-advisor`/`qa-advisor`/`ux-advisor`) + `product-devils-advocate` return «Agent type not found» — the whole `agents/{product,design}/` layer is unspawnable in the pilot, blocking Epic A live. | NOT nesting (CC scans `.claude/agents/` **recursively** — integrator agents register; docs + claude-code-guide confirm) and NOT staleness (all agents delivered 2026-06-24, a day before the session). **Invalid YAML frontmatter:** the 4 broken agents have an unquoted `description:` plain scalar containing `": "` (`"…handoff: can…"`, `"…0012): self-…"`) → `js-yaml` errors `bad indentation of a mapping entry`; the 3 integrator agents (no colon-space) parse clean — **perfect 4/4 vs 3/3 correlation**. The CC frontmatter parser drops the whole file. Safety-rail held: the failure was **loud** (no silent `general-purpose` fallback). | **FIXED — DEC-DEV-0103.** Double-quoted `description:` in all 4 agents; `js-yaml` now parses all. Re-validate V-2 after `/ecosystem:update` re-delivers to the pilot. |
| FB-LR-18 | 🟡 | V-3 (completeness-loop) | `/product:complete` first SCORE call threw `MODULE_NOT_FOUND` on the oracle; the loop self-corrected to the `.claude/` path and completed. | `commands/product/complete.md` + `skills/product/completeness-loop.md` hard-coded the **repo-relative** `node hooks/product/lib/completeness-oracle.cjs`, absent in an installed project (lib is at `.claude/hooks/product/lib/…`). Sibling commands all use `.claude/hooks/…`; completeness-loop fell out of the convention. | **FIXED — DEC-DEV-0103.** Both files use the installed `.claude/hooks/…` path. |

### Housekeeping (not a Block-2 defect)
- **Mockup edit cascades into scenario files:** the V-1.4 edit to MK-001 fired `cascade-check.js` (PostToolUse, by-design DEC-DEV-0080), which backfilled `mockup: MK-001` into the 6 SCs in MK-001's `scenario_steps`. The runbook cleanup reverted only the 4 named files → the pilot tree was left with 6 dirty SCs. **Restored** (`git checkout`); runbook cleanup step augmented to cover the cascade.

### Positive confirmations (Track V — live-validated, no action)
- **V-1 zone-hook — PASS:** a significant `.product/` edit fires with the correct zone+personas (BR-005→`architect-advisor, qa-advisor`; MK-001→`ux-advisor`); a cosmetic edit (BR-006 `updated`/`version` only) stays **silent** (magnitude gate); a 2nd significant edit **updates the entry in place** (dedup by id), no duplicate.
- **V-3 oracle + bounded loop — PASS:** FM-001 `met:true` fast-stop (no waves, no edits); an injected gap (VC-018→draft) → `met:false`, `B4 fail (SC-013 uncovered)`, `delegated_unverified` (B5/B6/B8) intact (no silent truncation); the loop is **bounded** (1 wave) and **fail-loud** (stopped at SURFACE on the unresolved persona, applied no edits, escalated nothing) — the stop contract held even through the FB-LR-17 failure.

---

## Track O — Run C re-run on the un-done feature (glossary) — 2026-06-25

> The Block-1 / Track-O **Run C** the N+2 section above flagged as still-needed: the admin re-val
> (`336a2973`) was a **no-op** (admin already 17/17 `[x]`), so the **P5→P6 nesting (T3) was never
> exercised**. This run finally exercises it — `/orchestrator:run feature-to-tdd-impl --feature glossary`
> on an **un-done** feature. Pilot session `1ff7e2d8` (worktree `tdd-impl-glossary`, HEAD `5a7412d`),
> workflow `wf_777d4af2-08f` (`status=completed`, 99 agents, ~5.47 h, ~8.28M tokens, 2305 tool calls;
> `result`: `go_gate:NO-GO`, `readiness:READY`, `conflicts:[]`, `blocked:[]`, 13 tasks implemented,
> 12 concerns). Graded post-hoc by the layered evidence model ([[feedback_audit_evidence_layers]]) +
> **executor/reviewer separation** ([[feedback_separate_task_from_test]]): the pilot ran clean, then **2
> blind subagent auditors (V1 ≈ V2)** graded independently and a **neutral 3rd-agent adjudication**
> verified the decision-bearing claim line-by-line against the real `.mjs`.
>
> **Headline: T3 + T5 are LIVE-VALIDATED** — one MEDIUM observability edge (FB-LR-19, now **FIXED — DEC-DEV-0104**).
> Findings continue from FB-LR-18; next-free DEC-DEV = **0105** (0101/0102 reserved for FB-LR-15/16; 0103 = Track V; 0104 = FB-LR-19 fix).

### Verdict per criterion (rubric 1–9; V1 ≈ V2, adjudicator-confirmed)

| # | criterion | verdict | evidence (ground-truth) |
|---|---|---|---|
| 1 | **T3 — P5→P6 delegation (headline)** | ✅ **PASS** | `logs`: `▸ running dynamic workflow validate-feature-impl` → real P6 via `{scriptPath}`; mechanical agent ran real `pnpm -r build` (exit 0) + `pnpm -r test` (exit 1) + docker up; `verify-finding` + 2 remediation rounds + verdict. **No `GATE DEGRADED`/advisory fallback anywhere.** Conclusively refutes the pilot memory `p6_delegation_unresolvable` (that was by-name, fixed by T3). |
| 2 | **T5 — conflict escalation** | ⚠️ **PARTIAL** (MEDIUM) | Mechanism faithful: 2 cross-spec conflicts ESCALATED (`Requirement 7 / BR-028 reproducibility`; FM-003 sync in-process build), `unilateral:false`, routed to PA-024, gate held NO-GO; **no run-B `had_trial`-style masking**. BUT `result.conflicts:[]` → escalations invisible in the machine-readable envelope → **FB-LR-19**. |
| 3 | **T5 — transient retry** | **N-A (not exercised)** | The lone transient (`localhost:5432` pool-exhaustion during a 500-term seed) self-healed inside the impl agent (sequential reseed); never surfaced as `BLOCKED` → `blocked:[]`, FSM transient branch never entered. Sub-path still 0 live runs. |
| 4 | **T1 — verdict×readiness** | ✅ PASS | `readiness:READY` orthogonal to `go_gate:NO-GO`; substrate independently re-probed up; false-NO-GO guard correctly NOT triggered. |
| 5 | **T2 — order-aware verify** | ✅ PASS | baseline sha `2ccf2a9` captured; `5 present, 0 already-resolved, 0 refuted`; real baseline diffing; no finding mislabeled a hallucination. |
| 6 | **FB-LR-15 — validator drop** | ✅ PASS (no recurrence) | All 3 validators RA-8/9/10 ran to completion; **0/99 agent files contain `state:error`**. The B-run silent-drop defect did not recur. |
| 7 | **NO-GO soundness / fidelity** | ✅ verdict sound / ⚠️ fidelity PARTIAL | NO-GO correct over READY substrate (RED = an out-of-glossary bcrypt host-speed flake + 2 genuine unresolved conflicts; glossary code clean). Fidelity loss = same root as #2: P6's 16 findings → 0 in the P5 envelope. |
| 8 | **PA-dedup (FB-LR-10) + args-string (FB-LR-11)** | ✅ PASS | In-run dedup held (escalate agent deduped onto existing PA-024); post-run `5a7412d` folded 8→5 (IDs retained). args passed as a JSON **string** — defensive parse held. **Caveat:** the PA *commits* (`da791c2`/`5a7412d`) are **operator-driven post-run**, not workflow-internal — FB-LR-10's "consolidate-don't-append" holds as behavior but autonomy is only half-demonstrated here. |

### Ledger (new findings — continue from FB-LR-18)

| id | sev | finding | corrected root-cause | route / status |
|---|---|---|---|---|
| FB-LR-19 | 🟠 | C (glossary) — P5 **drops the nested P6 gate's `conflicts[]` and `findings[]` from its own return envelope**: `result.conflicts:[]` and no `findings` key, despite the gate escalating 2 cross-spec conflicts and surfacing 16 findings. A tool reading the structured result sees zero escalations / zero findings. | P5 reads only 3 P6 keys (`feature-to-tdd-impl.mjs:450-454`: `result`/`readiness`/`findings`) — **never `p6.conflicts`** — and its return object (`:488-496`) omits `findings` (captured at `:453`, discarded at the boundary) and emits only its own impl-phase `conflicts` (declared `[]` at `:309`). P6 *does* surface both richly (`validate-feature-impl.mjs:442`/`:445`). Trace survives only in `pending-actions.md` + transient `log()`. | **FIXED — DEC-DEV-0104.** P5 captures `p6.conflicts` (`:454`) + the return merges impl-time ⊕ gate `conflicts` and surfaces `findings` (`:494-495`). Additive (absent/empty == prior); `feature-to-tdd-impl-wiring` 8→9; `npm run verify` green. Re-validate on the next real P5 run. |
| FB-LR-20 | 🟡 | C (glossary) — one cross-FM seam was **split**: a consumer-side remediation (`345336e`) reshaped FM-002-owned files (`glossary-snapshot.port.ts`, `job-status.service.ts`) as "conform-to-owner", while the SAME seam's wiring/ownership was escalated as forbidden-to-resolve (PA-024). | `git show 345336e` confirms a **faithful** conform-to-owner edit (design.md genuinely names FM-003 authoritative — not a mask), but `remediation-guard`'s owner-vs-conflict test does not flag a consumer edit to **another FM's owned file** while that seam is under an active escalation. Under-specified, not a defect here. | **ACCEPTED PATTERN — DEC-DEV-0106.** Codified "shape=conform / wiring=escalate" as a legitimate seam-split (a design-backed conform edit is not a mask; the ownership question escalates on its own channel). `remediation-guard`'s owner-vs-conflict heuristic intentionally NOT tightened (false-positives cost more than the rare over-step). Documented in the work-order. |
| FB-LR-21 | 🟢 | C (glossary) — RA-10 (integration-boundary / orphan-export lens) returned `clean:true`, classifying the FM-003 `GlossarySnapshotService.buildSnapshot` no-call-site as "deferred-by-design", while RA-8 + RA-9 + the escalation chain treated the **same** seam as a cross-spec conflict (PA-024). | Verified in RA-10 transcript (`agent-a0b94edb03b6eb437`): the lens whose job is orphan exports waved through an orphan two other lenses flagged. No defect leaked (caught by RA-8/9 redundancy), but the lens is too lenient on spec-sanctioned orphans. | **FIXED — DEC-DEV-0106.** RA-10 prompt now requires a deferred/spec-sanctioned orphan to **surface** as `kind:orphan-export` (severity low, noted spec-sanctioned), never silently `clean:true`. P6 wiring asserts it. |
| FB-LR-22 | 🟢 | C (glossary) — `remediation-guard.cjs` keys only on transient/infra signal-words; it returned `class:content` for **all 3** cross-spec escalations (agents 89/95/98). Escalation worked entirely on **LLM judgment**; the deterministic backbone carried 0 load on the T5-critical semantic-conflict path. | The guard is effectively a transient/infra classifier; the "EITHER lib OR own reading" contract meant the lib never contributed to the cross-spec decisions. A less-careful agent could miss the escalation. | **DOCUMENTED (boundary) — DEC-DEV-0106.** `remediation-guard.cjs` header now carries a `SCOPE / KNOWN BOUNDARY` note: it is a transient/infra/capability classifier; cross-spec/design detection is best-effort (rides the agent's reading BY CONTRACT). Tightening the cross-spec heuristic so the deterministic layer shares the load = OPEN follow-up. |

### Positive confirmations (Run C glossary — live-validated, no action)
- **T3 delegation works end-to-end** — first genuine P5→P6 `workflow({scriptPath})` nesting on an un-done feature; the full real gate executed (mechanical full-suite + build + RA-8/9/10 + order-aware verify-finding + remediation) and the advisory/`GATE DEGRADED` fallback **never fired**. This is the increment the whole glossary re-run existed to prove.
- **T5 escalation fires live without masking** — 2 real contradictions escalated, no unilateral commit overrode them, gate stayed off a clean GO. The run-B masking pattern did not recur.
- **Order-aware verify (T2) + readiness axis (T1) both intact** under a READY substrate; the false-NO-GO guard correctly did not engage.
- **Durable skeleton held** — 99 agents / ~5.47 h / ~8.28M tokens with **clean cross-session recovery** across 2 interruptions (an earlier `wf_c76e052c` resumed into `wf_777d4af2`), zero duplicate task commits (`!t.done` filter).
- **FB-006 boundary guard held live** — task 4.4 was REJECTED for an out-of-boundary `.claude/pending-actions.md` edit and the implementer reverted it.

---

## N+2 gate-followups batch live-run (Fork C: G-1 / R-1 / G-2) — 2026-06-27

> The owner-driven live-sweep of the N+2 **gate-followups** (DEC-DEV-0101/0102/0106) + the carried-over
> backlog, per executor-runbook [PILOT_RUNBOOK_N2_GATE_FOLLOWUPS.md](PILOT_RUNBOOK_N2_GATE_FOLLOWUPS.md) +
> reviewer-rubric [ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md](ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md) §6.
> **Fork C** = G-1 + R-1 + G-2 (G-3 / P5→P6 deferred to a real un-done feature). Graded post-hoc by the
> layered evidence model ([[feedback_audit_evidence_layers]]) + **executor/reviewer separation**
> ([[feedback_separate_task_from_test]]): 3 independent forensic auditors (one per run) + the reviewer's own
> corroboration of each outcome-flipping claim. Pilot sessions: **G-1** `188e4bfa` (wf `b0857359`, worktree
> work-4); **R-1** `3769169b` (worktree work-5); **G-2** `f52a73f6` (wf `29425d82`, main checkout).
> Next-free DEC-DEV at write time = **0111** (assign live; guard the 0082-style collision).

### Verdict per ref (the sweep)

| ref | run | verdict | one-line |
|---|---|---|---|
| **FB-LR-21 / 0106** (RA-10 orphan) | G-1 | ✅ **LIVE-VALIDATED** | RA-10 (integration-boundary) surfaced the spec-sanctioned `buildSnapshot` orphan as `kind:orphan-export` (sev low), **not** `clean:true` — closes the FB-LR-21 re-val owed since 0106. |
| **FB-LR-15 / 0101** (negative) | G-1, G-2 | ✅ **LIVE-VALIDATED (neg)** | `validators_incomplete:[]` + all 3 RA lenses ran on both runs; no silent drop. Positive side (a validator actually dying) still opportunistic / not-exercised. |
| **T5 / 0096** (escalate-don't-mask) | G-2 | ✅ **LIVE-VALIDATED** | 2 real cross-spec conflicts (dunning EmailPort FM-005↔FM-001; Stripe orphan/prod-boot) **ESCALATED, not self-resolved** (`conflicts[]` + PA-029/030, gate held MANUAL_VERIFY); guard classified the adjacent doc-sync `content`/`unilateral:false` — no run-B mask. |
| **FB-LR-16 / 0102** (non-ready disclosure) | G-2 | ⛔ **OWED (not exercised)** | The executor brought the substrate **UP before launching the gate** (#92→#135: "Подниму субстрат заранее"), so the gate ran under `readiness:READY`. `committed_under_non_ready:0` is *trivially* correct — the disclosure path never engaged. |
| **T1** (lying-substrate × verdict) | G-2 | ⛔ **OWED (not exercised)** | Same neutralization — suite GREEN, zero substrate failures to classify; the lying-substrate→MANUAL_VERIFY path was not triggered. |
| **V-2 / 0103** (persona resolution) | R-1 | ⛔ **OWED (not exercised)** | Personas never spawned: `/product:complete FM-001` stopped at Wave-1 on a perfect oracle score (`met:true, gaps:[]`); persona spawn is **gap-gated**, and `advisor-pending.yaml` is a **routing table**, not a spawn queue. **No** `Agent type not found` and **no** silent general-purpose fallback occurred (the feared FB-LR-17 regression did *not* recur) — but resolution was never put to the test. |
| **FB-LR-19 / 0104**, **T5-transient / 0096** | (G-3) | ⏸ **DEFERRED** | Fork C deferred the P5→P6 run; both stay verify-green + code-confirmed, awaiting a real un-done P5 feature. |
| **had_trial** (§4) | G-2 | ⏳ **OPEN (product)** | The idempotency contradiction was **not touched** by the run (the edited trial-seam line was the adjacent `account.confirmed` arity, guard-classified `unilateral:false`); stays OPEN for the owner Path A/B decision. |

### Ledger (new findings — continue from FB-LR-22)

| id | sev | run | finding | corrected root-cause | route / status |
|---|---|---|---|---|---|
| FB-LR-23 | 🟠 | G-1, G-2 | **Parallel git-worktrees share one checkout/index → the gate's escalation + remediation write-path races/collides.** G-1: PA-numbering collision (escalate-agents counted pending-actions across **two** files, main vs work-4, so `PA-027` denoted two different escalations). G-2: a remediation agent's Edit briefly **hit the MAIN checkout path** (reverted via `git checkout --`), and the session explicitly noted the `git commit` race on the shared git index even when file zones don't overlap. | Exactly [[env_parallel_sessions_share_checkout]] manifesting inside the orchestrator: PA-id allocation + commit/index writes assume a private working tree, but parallel pilot sessions/worktrees share `.git`. Single-writer held in the end (no content lost; main code untouched), but the hazard is real in the write path. | **DOCUMENTED — DEC-DEV-0111.** Guard proposed (PA-id allocation keyed to a single canonical pending-actions file regardless of checkout; commit-zone advisory re-check) = **OPEN follow-up**; not fixed in this unit. |
| FB-LR-24 | 🟡 | G-2 | **Readiness probe is partly inferential** — 2 of 3 substrate checks were SKIPPED (`postgres: skipped (pg_isready not installed)`, `redis: skipped (redis-cli not installed)`), so `readiness:READY` rested on docker-daemon-up + suite-GREEN, not a direct DB/Redis probe. | `env-readiness.cjs` degrades a missing probe binary to "skipped" rather than "unknown"; benign when the suite is GREEN, but a host lacking pg_isready/redis-cli could be declared READY without ever directly confirming Postgres/Redis. | **QUEUED** — fold into the env-readiness probe hardening (with FB-LR-09 migration-history check); ledger-only until then. |
| FB-LR-25 | 🟡 | G-2, R-1 | **Envelope observability — escalations/queues live in a field a scanning reader won't check.** G-2: `concerns:[]` is empty while `conflicts[]` carries 2 escalations (T5 contract met via `conflicts`+PA+`findings`, but a reader scanning only `concerns[]` sees zero). R-1: `advisor-pending.yaml` carries 5 `status:active` entries that no `/product:complete` path drains and nothing flags at loop completion. | Disclosure is split across multiple fields with no single "anything-needs-attention" surface; a populated-but-unconsumed queue has no completion flag. | **DEC-DEV candidate (pending owner decision)** — fold escalations + un-drained queues into one surfaced disclosure field. |
| FB-LR-26 | ℹ️ | R-1, G-2 | **Test-design / methodology (process, not ecosystem code).** R-1's runbook premise ("significant `.product/` edit → advisor-pending → `/product:complete` fires personas") is mechanically wrong — spawn is gap-gated, advisor-pending is routing-only. G-2's intent **self-neutralized** — the uncoached executor rationally brought the substrate UP first to "get a real verdict", vacating the substrate-DOWN contract under test. | A deep tension: **executor/reviewer separation collides with contracts whose whole point is observed behaviour under adverse conditions** — an uncoached executor will fix the adversity before the gate. | **FIXED in runbook (this unit):** R-1 premise corrected (use a feature the oracle scores <1, or `--dry-run`); G-2 substrate-DOWN protocol now forbids restoring the substrate before the gate. Lesson recorded in DEC-DEV-0111. |

### Positive confirmations (Fork C — live-validated, no action)
- **RA-10 orphan-disclosure (0106) works live** — the exact Run-C-glossary FB-LR-21 bug (orphan waved through as `clean:true`) does **not** recur; the orphan now escalates as a finding.
- **T5 escalate-don't-mask (0096) fires live on real cross-spec conflicts** — second independent confirmation after Run-C glossary; the run-B unilateral-resolution mask did not recur.
- **No persona→general-purpose fallback** — R-1 confirms the FB-LR-17 safety-rail: the only `general-purpose` spawn was the by-design `/product:validate` runner; persona resolution fails loud (0 `Agent type not found`), never silently downgrades.
- **Single-writer / boundary isolation held under parallel worktrees** — despite FB-LR-23, main code (`08a946c` on `pre-cc-sdd-pilot`) was never mutated by the worktree runs; an out-of-worktree Edit was caught and reverted.
