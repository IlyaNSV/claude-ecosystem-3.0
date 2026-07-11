# Orchestrator N+2 gate-followups — batch live-run plan + grading rubric (owner-driven)

> **Why this exists:** the N+2 gate-contract work left a tail of increments that are
> **verify-green but never live-run**, plus three brand-new fixes (DEC-DEV-0101/0102/0106). Instead
> of a session per item, do the **maximal code scope now** (done — all landed on
> `feat/orchestrator-n2-gate-followups`), ship it in **one `/ecosystem:update`**, run the tracks
> across **as many pilot sessions as it takes**, then grade **all of them in one post-hoc sweep**.
> Single delivery → batched runs → one grading pass.
>
> **Owner-driven:** the harness cannot run this — it needs a live `/ecosystem:update` + live
> Orchestrator/Product runs in the pilot, graded afterwards. **Executor/reviewer separation**
> ([[feedback_separate_task_from_test]]): run the executor tasks CLEAN — **do NOT tell the executor
> what is being checked** (the rubric in §6 stays with the reviewer); grade by transcript + the
> structured `result` envelope afterwards.
>
> **Relationship to siblings:** this **continues** `dev/_archive/orchestrator/UNIFIED_PILOT_VALIDATION_PLAN.md` (which
> covered the first N+2 wave + Vision A/B) and `dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md`
> (detailed per-run criteria — referenced, not duplicated). Findings land in the shared ledger
> `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`. Status: `ready-to-run` (2026-06-26; delivery already landed in the
> pilot — see runbook STATE SNAPSHOT). Next free `DEC-DEV` = **0111** (0107-0110 consumed since; the journal tail is the source of truth).

---

## 0. What the single delivery carries + what we validate

One `/ecosystem:update` brings the whole `[Unreleased]` accumulation since the pilot's current
version (incl. the new gate-followups). The batch validates two classes: the **new fixes** (Track G)
and the **carried-over backlog** that was built but never exercised live (Track R).

| Track | Item | DEC-DEV | Status before this run |
|---|---|---|---|
| **G — new gate-followups** | FB-LR-15 validator-drop loud degrade | 0101 | verify-green, **0 live runs** |
| | FB-LR-16 non-READY commit disclosure | 0102 | verify-green, **0 live runs** |
| | FB-LR-21 RA-10 surfaces a spec-sanctioned orphan | 0106 | verify-green, **0 live runs** |
| **R — carried-over re-validation backlog** | T5 transient-retry sub-path | 0096 | **0 live runs** (Run C glossary self-healed inside the impl agent → FSM branch never entered) |
| | V-2 persona spawn (after the 0103 frontmatter fix) | 0103 | FAIL pre-fix; **re-run owed after delivery** |
| | FB-LR-19 P5 envelope surfaces nested P6 conflicts/findings | 0104 | verify-green; **re-validate on the next real P5 run** |
| **P — product decision (NOT a run)** | `had_trial` FM-001↔FM-005 ownership | — | OPEN — owner Path A/B |

> **Honesty about forceability:** FB-LR-15 (a validator dying on a terminal API error) and the T5
> transient branch (a transient impl-block surfacing as `BLOCKED`) **cannot be reliably forced** — they
> depend on a live API/infra hiccup. Grade them **opportunistically**: assert the **negative** on every
> clean run (the disclosed fields are empty/absent), and capture the **positive** if a run happens to
> trip them. Do NOT manufacture a failure to "prove" them. The rest are deterministically runnable.

---

## 1. Pre-conditions (once, before any run)

1. **Single delivery:** `/ecosystem:update` in `my-first-test`. Carries the gate-followups
   (`validate-feature-impl.mjs` 0101/0102/0106, `remediation-guard.cjs` boundary doc) + everything
   merged since the pilot's last update.
2. **Wipe-protection is a HARD gate (principle 6):** the update must NOT vaporize pilot state —
   `.product/`, `.claude/orchestrator/runs/`, `.product/.upstream/feedback-outbox.md` must survive
   (DEC-DEV-0061/0088 level-1/level-2 + safety-commit). **If anything pilot-local would be deleted — STOP.**
3. **Verify the delivery landed** — `/ecosystem:verify`, and confirm specifically:
   - `.claude/orchestrator/processes/validate-feature-impl.mjs` carries `validators_incomplete` +
     `committed_under_non_ready` (grep the installed copy);
   - the 3 advisor agents register (the 0103 frontmatter fix — pre-req for Track V-2);
   - `ecosystem_version` re-stamped (DEC-DEV-0083 Step 5c).
4. **Tag a clean baseline** in the pilot git BEFORE any run (FB-LR-14) — fixed grade reference.

---

## 2. Track G — new gate-followups (run clean; grade by §6)

> Pick a feature with an **un-done** task set for the P5/P6 runs (a no-op `[x]`-complete feature does
> not exercise the gate — the Run-C-admin lesson). The pilot's `glossary` feature is a known carrier
> of a spec-sanctioned orphan (FM-003 `buildSnapshot`) → good for FB-LR-21.

- **G-1 — `/orchestrator:run validate-feature-impl --feature <un-done feature>` (P6 standalone, substrate UP).**
  Baseline-clean run. (Exercises FB-LR-21 if the feature carries a deferred orphan; the FB-LR-15/16
  negatives.)
- **G-2 — same, with Docker/DB DOWN** (the FB-LR-16 carrier). Substrate down + at least one
  confirmed-present non-substrate defect to remediate (a design-divergence is ideal — substrate-independent).
- **G-3 — `/orchestrator:run feature-to-tdd-impl --feature <un-done feature>` (P5→P6 nesting).** Carries
  FB-LR-19 (the P5 envelope) + any T5-transient opportunistically.

---

## 3. Track R — carried-over re-validation backlog

- **R-1 — V-2 personas (after delivery).** From a `.product/.pending/advisor-pending.yaml` entry (make a
  significant `.product/` edit to populate it), spawn each persona as its canonical `subagent_type`
  (`architect-advisor` / `qa-advisor` / `ux-advisor`). This is the re-run owed since DEC-DEV-0103.
- **R-2 — FB-LR-19** is observed inside G-3 (no separate run): read the P5 `result`.
- **R-3 — T5 transient-retry** is opportunistic inside G-3 / any P5 run (§0 caveat).

---

## 4. Product decision — `had_trial` (NOT a run)

Owner Path A (auth stops flipping `had_trial` before `account.confirmed`) **or** Path B (re-key billing
idempotency off `Subscription` existence). T5 (0096) makes a remediation that hits this **escalate**
(GO→MANUAL_VERIFY) rather than mask it — so a P5/P6 run over the billing/auth seam should DEMONSTRATE the
escalation fires; the contradiction itself stays OPEN until the owner decides. Record the decision in the
pilot, then close the conflict.

---

## 5. Sequencing (across however many sessions)

```
/ecosystem:update  (§1.1) → wipe-protection HARD gate + verify delivery (§1.2-1.3) ── STOP if pilot state at risk
  → baseline tag (§1.4)
  → [session(s)] Track G: G-1 (P6 up) → G-2 (P6 Docker down) → [G-3 (P5→P6 nesting) ⏸ DEFERRED — Fork C, 2026-06-26]
  → [session(s)] Track R: R-1 (V-2 personas); R-2/R-3 deferred with G-3 (delivery already landed — see runbook snapshot)
  → collect transcripts + every run's `result` envelope
  → ONE grading sweep (§6) → ledger rows → green ⇒ live-validated; new defect ⇒ DEC-DEV (next free 0111)
```

Sessions can be split any way; the only ordering constraint is `/ecosystem:update` first and the grading
sweep last. Do **not** coach the executor mid-run.

---

## 6. Grading rubric (reviewer-only — post-hoc, one sweep over all runs)

> Grade against ground truth: transcript + the structured `result` envelope + pilot git-diff. Layered
> evidence model [[feedback_audit_evidence_layers]]; for the headline runs use a **blind second auditor +
> a neutral adjudicator** (the V1≈V2 protocol that graded Run C glossary). One finding = one corrected
> root-cause + route (DEC-DEV-0057 Lesson #1). A green run lifts that increment out of "verify-green-only".

| ref | run | PASS criteria (what the reviewer checks) | FAIL signal |
|---|---|---|---|
| **FB-LR-15 / 0101** | G-1, G-3 | On a clean run `result.validators_incomplete == []` and all 3 lenses (RA-8/9/10) ran. **IF** a validator died: the log shows `re-spawn N/2`, and if still empty the lens is in `validators_incomplete` AND a clean GO was degraded to `MANUAL_VERIFY` with a `validators_incomplete` finding. | A run with `< 3` lenses in `validators[]` and `validators_incomplete == []` (silent drop) — the exact pre-fix bug. |
| **FB-LR-16 / 0102** | G-2 | The run returns `readiness=ENV_NOT_READY` (or DEGRADED) **and** any remediation commit it made carries the ` [readiness=…: re-verify on a READY re-run]` marker; `result.committed_under_non_ready > 0`; a disclosure finding lists them. A speculative (suite-dependent) fix was deferred, not committed. | A commit made under ENV_NOT_READY with **no** marker and `committed_under_non_ready == 0` (silent mutation). |
| **FB-LR-21 / 0106** | G-1/G-3 (orphan-carrier feature) | RA-10 reports the deferred/spec-sanctioned orphan as a finding (`kind:orphan-export`, severity low, noted spec-sanctioned) — **not** `clean:true`. | RA-10 returns `clean:true` over a known deferred orphan (the Run-C-glossary FM-003 bug). |
| **T5 transient / 0096** | G-3 (opportunistic) | IF a transient block surfaces as `BLOCKED`: bounded auto-retry fires (`env-recheck:` in the log), no debug round consumed, ≤ `maxTransientRetries`. | A transient block burns a debug round / needs a manual re-drive. (N-A if no transient occurred — record as not-exercised.) |
| **V-2 / 0103** | R-1 | Each persona resolves to its registered agent (no «Agent type not found»); a satisfied lens reports `clean:true`, never a positive finding. | Any «Agent type not found» (the frontmatter fix did not land) — STOP, never a silent `general-purpose` fallback. |
| **FB-LR-19 / 0104** | G-3 | When the nested P6 escalates a conflict or surfaces findings, P5's `result.conflicts` is **non-empty** and `result.findings` carries the gate's findings (merged impl-time ⊕ gate). | P5 returns `conflicts:[]` / no `findings` while the P6 log shows escalations (the pre-0104 envelope-drop). |
| **`had_trial`** (§4) | billing/auth run | The remediation hitting the `had_trial` contradiction **escalates** (`conflicts[]` + a `pending-actions` CONCERN, gate ≥ MANUAL_VERIFY), not a unilateral commit. | A committer resolves it unilaterally (the run-B mask) — should be impossible post-T5; flag if seen. |

**Disposition of the sweep:** every green ref → mark the increment **live-validated** in the ledger +
ROADMAP. Any genuine new defect → a `DEC-DEV-*` (next free **0111**) + a new ledger row. Opportunistic
refs that did not trip (FB-LR-15 positive, T5 transient) stay **"not-exercised"** — not a pass, not a fail;
note them so they are not mistaken for validated.

## Related
- Increment + rationale: `DEV_JOURNAL.md` DEC-DEV-0101 / 0102 / 0106; work-order
  `dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md` §"N+2 re-validation follow-ups".
- Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`. Prior wave: `dev/_archive/orchestrator/UNIFIED_PILOT_VALIDATION_PLAN.md`;
  per-run detail: `dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md`.
- Checklist: `dev/meta-improvement/checklists/live-run-validation.md` (executor/reviewer separation).
