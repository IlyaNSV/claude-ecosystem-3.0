# Unified Pilot Validation Plan — one delivery, one run (owner-driven)

> **Why this exists:** instead of two separate pilot sessions (one for the Orchestrator N+2
> re-validation, one for the new Autonomous-Pipeline-Vision Epic A+B dogfood), do **one
> `/ecosystem:update`** that ships *all* merged ecosystem changes to `my-first-test`, then run
> **both validation tracks in a single session** and grade post-hoc. Single delivery, single run.
>
> **Owner-driven:** the harness cannot run this — it needs a live `/ecosystem:update` + live
> Orchestrator/Product runs in the pilot, then a post-hoc grade. **Executor/reviewer separation**
> ([[feedback_separate_task_from_test]]): run the executor tasks CLEAN (no hints about what is
> being checked); grade afterwards by transcript.
>
> **Supersedes/wraps** `dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md` (Track O references it for
> the detailed per-run criteria — not duplicated here) and folds in the Epic A+B dogfood + the
> pilot-side bookkeeping. Status: `ready-to-run` (2026-06-24). Next free `DEC-DEV` = **0100**.

---

## 0. What the single delivery carries + what we validate

Pilot is on **`ecosystem_version: 1.6.0`** (verified). One `/ecosystem:update` brings the entire
`[Unreleased]` accumulation since 1.6.0. The two validation tracks cover the parts that are
**verify-green but never live-run**:

| Track | Increments under test | Status before this run |
|---|---|---|
| **O — Orchestrator N+2** | T1 verdict×readiness (0092) · T2 order-aware verify (0093) · P3 defect-enum (0094) · T4 design→tasks coverage (0095) · T5 remediation guardrails (0096) · P6 feedback phase-2 (0097) · riders (0089 PA-dedup + `missing-trace-source`) | verify-green, **0 live runs** |
| **V — Vision Epic A+B** | personas architect/qa/ux-advisor + zone-router + completeness-loop (0098) · oracle VC-link fix (0099) | libs dogfood-validated solo (0099); **live hook/loop/persona path 0 runs** |
| (also delivered) | feedback contour split (0090), all other `[Unreleased]` since 1.6.0 | — |

> **V already partly validated:** the deterministic libs (`completeness-oracle`, `zone-router`)
> were dogfooded **solo** against the pilot's real `.product/` (DEC-DEV-0099 — found + fixed 2
> VC-link shape bugs; router clean). Track V below is only the parts that need a **live session**:
> the hook firing on a real edit, persona spawning, and the `/product:complete` loop.

---

## 1. Pre-conditions (once, before any run)

1. **Single delivery:** `/ecosystem:update` in `my-first-test`. Carries the N+2 orchestrator libs
   (`env-readiness.cjs`, `design-coverage-oracle.cjs`, `remediation-guard.cjs`) + updated processes,
   the vision pieces (3 advisor agents, `zone-routing.yaml` + `zone-router.cjs` + `zone-change-trigger.js`,
   `completeness-oracle.cjs`, `completeness-loop.md`, `/product:complete`), and the feedback split.
2. **Wipe-protection is a HARD gate (principle 6):** the update must NOT vaporize pilot state —
   `.product/`, the Orchestrator project-state (`.claude/orchestrator/runs/`), and
   `.product/.upstream/feedback-outbox.md` must survive. Confirm the level-1/level-2 wipe-protection
   + safety-commit ran (DEC-DEV-0061/0088). **If anything pilot-local would be deleted — STOP.**
3. **Data migration (soft):** `.product/.pending/meta-feedback.yaml` → `validation-tune.yaml`
   (absent == prior behavior 1:1; backfill prompt in the CHANGELOG 0090 entry if needed).
4. **Verify the delivery landed** — run `/ecosystem:verify`, and confirm specifically:
   - 3 advisor agents present: `agents/product/architect-advisor.md`, `qa-advisor.md`, `agents/design/ux-advisor.md`;
   - `zone-change-trigger` registered (PostToolUse) + `zone-routing.yaml` + `zone-router.cjs` present;
   - `/product:complete` present (product command count → 20);
   - `ecosystem_version` re-stamped off the latest CHANGELOG (DEC-DEV-0083 Step 5c).
5. **Tag a clean baseline** in the pilot git BEFORE any run (FB-LR-14) — fixed grade reference.
6. **Fold in the pilot-side bookkeeping** (was deferred to this session, FB-LR-14): rename
   `.claude/orchestrator/runs/S7-FEEDBACK-JOURNAL.md` → `RUN-C-FEEDBACK-JOURNAL.md` and reconcile the
   journal-path note in `ORCHESTRATOR_S7_BRIEF.md:118`.

---

## 2. Track O — Orchestrator N+2 re-validation

Run as clean tasks; capture transcript + Workflow return. **Full per-run PASS criteria:
`dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md` §1** (do not re-tell the executor what is checked).
Summary:

- **Run A — `/orchestrator:run audit-spec-fidelity --feature localization` (×2):** T4 coverage-gap
  surfaced in `coverage_gaps` (or `[]` if none — don't manufacture); any trace finding is
  `kind: missing-trace-source` (not `fabricated-trace`); **2nd run UPDATES the open PA, not a
  near-duplicate** (PA-dedup headline); an already-fixed drift is `already-resolved`, not a hallucination.
- **Run B — `/orchestrator:run validate-feature-impl --feature billing` with Docker/DB DOWN:** build
  GREEN + suite RED on substrate errors ⇒ **`readiness=ENV_NOT_READY` → `MANUAL_VERIFY_REQUIRED`,
  NOT NO-GO** (T1 headline) + a "bring substrate up" finding; no positive "coverage confirmed"
  finding survives to force MANUAL_VERIFY over a clean GO (P3).
- **Run C — `/orchestrator:run feature-to-tdd-impl --feature admin` (P5→P6 nesting):** nested P6 by
  `{scriptPath}` **RETURNS a real verdict** (not the "GATE DEGRADED" advisory fallback) (T3 headline);
  a cross-spec/design contradiction **ESCALATES** (`conflicts[]` + pending-action + gate ≥ MANUAL_VERIFY),
  not unilaterally resolved (T5); a transient block auto-retries bounded (T5).
- **Feedback phase-2 (after the runs, from the ecosystem repo):** if any run captured a systemic
  finding into the pilot `.product/.upstream/feedback-outbox.md`, run
  `node dev/meta-improvement/scripts/feedback-intake.js --outbox <pilot>/.product/.upstream/feedback-outbox.md`
  and confirm pickup + unified contract + dedupe disposition (open / likely-ported / ported).

---

## 3. Track V — Vision Epic A+B dogfood (live-session parts only)

The libs are already validated (0099). These three need a live session:

- **V-1 — zone-router hook fires correctly (A2).** In a live session, make a **significant** edit to
  a real `.product/` artifact (e.g. a BR or an IC body change). Confirm `zone-change-trigger`
  appended/updated `.product/.pending/advisor-pending.yaml` with the **right personas for that zone**
  + emitted the stderr signal. Then make a **cosmetic** edit (a frontmatter `updated:`/`version:` bump
  on the same file) → confirm it does **NOT** fire (magnitude gate; no token burn). PASS = significant
  fires with correct personas, cosmetic is silent; a 2nd significant edit UPDATES the same entry
  (dedup by id), not a near-duplicate.
- **V-2 — personas spawn canonically (A1+A3).** From an `advisor-pending` entry, spawn each persona
  as its **canonical `subagent_type`** (`architect-advisor` / `qa-advisor` / `ux-advisor`). PASS = it
  resolves to the registered agent; an "Agent type not found" reply is a **loud STOP**, never a silent
  `general-purpose` fallback (subagent-type contract). Findings are **gaps only** — a satisfied lens is
  reported `clean:true`, never a positive "finding".
- **V-3 — completeness-loop + oracle (B1).** Run `/product:complete <FM>` on a **less-complete**
  feature (pick one a deliberate small gap is introduced into, e.g. an SC with its VC set to draft).
  PASS = the oracle's score+gaps match the real state; the loop is **bounded** (≤ max-waves, default 3);
  **decisions escalate** (not auto-resolved); the stop report lists the oracle's `delegated_unverified`
  (B5/B6/B8) — **no silent truncation**. Then run it on a **complete** feature (e.g. `FM-001`) →
  confirm fast-stop `met:true` (matches the solo 0099 result, now via the live command path).

---

## 4. Grading (post-hoc, both tracks)

One **FB-ledger pass** covering both tracks (discrete rows; one finding = one corrected root-cause +
route — DEC-DEV-0057 Lesson #1; if a run mis-diagnoses, record the corrected cause). A green run →
mark that increment **live-validated** (lift it out of "verify-green-only"). A genuine new defect →
a `DEC-DEV-*` in this repo (**next free = 0100**). Do not coach the executor mid-run.

---

## 5. Pilot-side cleanup + OPEN risks

- **VC `scenario`/`scenarios` field inconsistency (from DEC-DEV-0099 dogfood):** the pilot's own VCs
  are inconsistent (VC-001..023 use `scenario:`, VC-024+ use `scenarios:`). The oracle now tolerates
  both, but the pilot data should be normalized — a `/product:validate` (B6 zone) / `/product:lesson`
  candidate **in the pilot** (not an ecosystem fix).
- **S7→RUN-C rename:** folded into pre-condition §1.6.
- **OPEN product decision (not a code fix) — `had_trial` FM-001↔FM-005:** auth writes `had_trial=true`
  before emitting `account.confirmed`, so `TrialService.activateIfEligible` may silently no-op; billing
  specs contradict. T5 (0096) now makes a remediation hitting this **escalate** (GO→MANUAL_VERIFY) —
  Run C should demonstrate the escalation fires — but the contradiction itself needs an upstream
  **product** decision (Path A: auth stops flipping `had_trial`; Path B: re-key billing idempotency off
  Subscription existence). Keep OPEN.

---

## 6. Sequencing within the one session

```
/ecosystem:update  (§1.1)
  → wipe-protection HARD gate + verify delivery (§1.2, §1.4)   ── STOP if pilot state at risk
  → data migration + baseline tag + S7→RUN-C rename (§1.3, §1.5, §1.6)
  → Track O: Run A (×2) → Run B (Docker down) → Run C → feedback-intake (§2)
  → Track V: V-1 (hook) → V-2 (personas) → V-3 (/product:complete) (§3)
  → grade both, one FB-ledger pass (§4)
  → record pilot-side cleanup + confirm OPEN had_trial escalation fired (§5)
```

## Related
- Orchestrator run criteria (detail): `dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md`
- Findings ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`
- Vision: `dev/ECOSYSTEM_VISION.md` (Epic A/B) · loop disposition: `dev/LOOP_READINESS_AUDIT.md`
- Kickoff/lessons: `DEV_JOURNAL.md` DEC-DEV-0098 (Increment 1) + 0099 (oracle dogfood fix)
