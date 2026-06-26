# Orchestrator N+2 — session checkpoint & next-session resume

> **Snapshot date:** 2026-06-23. **Purpose:** durable handoff so the next session finishes the
> N+2 queue without re-deriving context. SSOT for the plan = [ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md](ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md);
> discrete findings = [ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md](ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md);
> rationale per increment = `DEV_JOURNAL.md` (DEC-DEV-0091…0095). Verify against `git log` — this
> snapshot can go stale.

## Where we are — DONE + MERGED to `main` (all verify-green, origin synced)

The N+2 "trustworthy gate outcomes" programme (decided in **DEC-DEV-0091** from the A+B+C live-run
audit) is **4 increments deep**, every one built on a branch → `npm run verify` green → pushed →
PR → merged → main re-synced:

| Increment | DEC-DEV | PR | merge | What it shipped |
|---|---|---|---|---|
| T3 (delegation) + T1 (contract body) | 0091, 0092 | #41 | `f8a6183` | P5→P6 delegation by `{scriptPath}`; two-axis `verdict × readiness` + `env-readiness.cjs` probe; `ENV_NOT_READY ⇒ MANUAL_VERIFY` invariant (false-NO-GO guard) |
| T2 (order-aware verify) | 0093 | #42 | `439970c` | pre-gate baseline sha + 3-way `disposition` (present / already-resolved / refuted) in P4 + P6 — fixes the TOCTOU "already-fixed → called a hallucination" + masked-defect |
| P3 (FB-028) | 0094 | #43 | `b077ad5` | P6 `VALIDATOR_SCHEMA.kind` → defect enum + `verifyFinding` polarity-gate — a positive "coverage confirmed" can't masquerade as a finding |
| P4 / T4 (design→tasks coverage) | 0095 | #44 | `19e70b0` | `design-coverage-oracle.cjs` + P4 hybrid layer — catches a design module no task builds; confirmed gap excludes the feature from `impl_ready` |
| P5 / T5 (remediation discretion) | 0096 | #46 | `8c415a5` | `remediation-guard.cjs` (classifyBlock + detectsUnilateralResolution); P6 single-writer + escalate cross-spec/design conflict (`conflicts` degrades GO→MANUAL_VERIFY); P5 transient bounded auto-retry + escalate-don't-self-resolve |
| P6 (feedback phase-2) | 0097 | #48 | `70acf5f` | `feedback-intake.js` (dev-only): pickup of the `/ecosystem:meta-feedback` UF-outbox + FB-ledger + Session Audit journal → unified finding contract + dedupe vs `DEV_JOURNAL` (open / likely-ported / ported). Capture-don't-fix |

**Ledger findings closed:** FB-LR-02 / 03 / 04 / 05 / 06 / 07 / 08 / 09 / 13.
**Repo state:** on `main`, synced with `origin/main`. The only uncommitted file is
`dev/meta-improvement/audit-index.md` — **session-audit hook noise; exclude it from every commit**.
**Next free DEC-DEV number = `0098`.**

## What's LEFT — planned work, in priority

> **The whole N+2 content queue (T1/T2/P3/T4/T5 + P6 feedback phase-2) is MERGED, and the cheap
> riders are DONE.** What remains is the (owner-driven) pilot re-validation + the pilot-side
> bookkeeping (which folds into that session).

1. ~~**Cheap riders**~~ ✅ **DONE (PR #50, DEC-DEV-0089):** PA-dedup pre-filter in `audit-spec-fidelity`
   (FB-LR-10 — both PA prompts scan-and-update-in-place) + rename `fabricated-trace` →
   `missing-trace-source` (FB-LR-12). verify + counts green.
2. **Pilot re-validation of the whole N+2 contract** — a **separate LIVE session the owner drives**
   (I cannot run it). Full hand-off: **`dev/ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md`** —
   `/ecosystem:update` in `my-first-test`, then Run A (P4 localization ×2 → T4 gap + PA-dedup
   idempotency + `missing-trace-source`) / Run B (P6 billing, Docker **down** → `ENV_NOT_READY` not a
   false NO-GO) / Run C (`feature-to-tdd-impl --feature admin` → nested P6 RETURNS a real verdict +
   T5 conflict-escalation). Grade post-hoc (executor/reviewer separation). The empirical proof — none
   of the 6 increments is live-run yet.
3. **Bookkeeping tail (FB-LR-14) — pilot-side, folds into the re-validation session:** the S7→RUN-C
   rename target is **in the pilot repo**, not the ecosystem repo (every in-repo `S7` is a legit
   other meaning — confirmed by sweep). Rename `my-first-test/.claude/orchestrator/runs/S7-FEEDBACK-JOURNAL.md`
   → `RUN-C-FEEDBACK-JOURNAL.md` + reconcile `ORCHESTRATOR_S7_BRIEF.md:118`'s journal-path; tag a clean
   pilot baseline (brief §0.4). The pilot memory `project_orchestrator_p6_delegation_unresolvable`
   is **already corrected** (superseded note added — the delegation failure was scriptPath/by-name,
   fixed in T3, NOT a nesting wall; disproved in DEC-DEV-0091).
6. **OPEN pilot risk (T5 landed — masking mechanism fixed; the product decision is still open):**
   FM-001↔FM-005 `had_trial` silent no-op — auth writes `had_trial=true` before emitting
   `account.confirmed`, so `TrialService.activateIfEligible` may silently no-op; billing specs
   contradict (req 1.1 vs 12.6 vs auth design.md:489). T5 (DEC-DEV-0096) now makes a remediation
   hitting this **escalate** it (GO→MANUAL_VERIFY) rather than mask it, but the conflict still needs
   an upstream **product** decision (Path A: auth stops flipping `had_trial`; Path B: re-key billing
   idempotency off Subscription existence) — not an orchestrator code fix. Verify the escalation
   fires on the pilot re-run.

## Next-session kickoff prompt (paste verbatim)

```
Очередь Orchestrator N+2 — ВЕСЬ content слит в main (план/находки/чекпоинт:
dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md / dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md /
dev/ORCHESTRATOR_N2_RESUME.md).

Слито (verify-зелёное): T1 verdict×readiness (0092,#41), T2 order-aware verify (0093,#42),
P3 FB-028 defect-enum (0094,#43), P4/T4 design→tasks coverage (0095,#44), P5/T5
remediation-discretion guardrails (0096,#46), P6 feedback phase-2 receiving side (0097,#48).

Осталось (не content-инкременты): (1) дешёвые riders — 0089 PA-dedup в audit-spec-fidelity
(FB-LR-10, номер зарезервирован), rename kind:fabricated-trace (FB-LR-12); (2) pilot
ре-валидация всего N+2 (отдельная LIVE-сессия владельца — `/ecosystem:update` в my-first-test,
прогоны A/B/C, грейд пост-фактум); (3) bookkeeping-хвост (FB-LR-14: чистый pilot-baseline tag,
S7→RUN-C rename, коррекция пилотной nesting-памяти).

Цикл: build → npm run verify зелёный → push → PR → merge (мёрж делегирован) → sync main.
audit-index.md = шум хука, в коммиты не тащить. Следующий DEC-DEV = 0098.
```

## Key facts / gotchas / cadence for whoever resumes

- **Cadence this session (owner-confirmed):** build an increment on its own branch → `npm run
  verify` green → push (`dangerouslyDisableSandbox: true` — git/gh network 443-timeouts otherwise) →
  open PR → **Claude merges** (`gh pr merge <n> --merge --delete-branch`) → `git pull` main → next.
- **Harness constraint (DEC-DEV-0073 §D.1):** a Workflow `.mjs` script may NOT touch the FS /
  `child_process` / `Date.now()`. All deterministic logic lives in a `.cjs` lib (`orchestrator/lib/*`)
  that an **agent runs via Bash and relays as JSON**; the script orchestrates. Libs are dual-use
  (`require` exports for unit tests + a CLI guarded by `require.main === module`).
- **Established design patterns to reuse:** verify-finding-before-act is **order-aware** (baseline
  sha + 3-way disposition); a finding `kind` is a **defect enum** (positives unrepresentable) with a
  **polarity gate**; an oracle is **hybrid** (deterministic candidates → semantic-confirm); a gate
  **surfaces + routes, does not auto-edit** when the fix is new scope (e.g. adding a task).
- **Wiring tests are SOURCE-level** (the `.mjs` can't run standalone): `tests/orchestrator/*-wiring.test.cjs`
  assert structural invariants by regex over the source + `indexOf` ordering. New deterministic libs
  get a real unit test + registration in `package.json` `test:orchestrator`.
- **Process gate:** `feat:`/`fix:` in the orchestrator consumer-zone needs a CHANGELOG `[Unreleased]`
  entry; a `fix:` or a ≥2-alternative choice needs a DEV_JOURNAL entry. Run `check-counts.js` —
  these increments were all additive (no new artifact-type/validation-rule), counts stayed 24/44.
- **None of the 4 increments is live-run yet** — the merged code is verify-green but the empirical
  proof is the pilot re-validation (item 4 above), which only the owner can drive.
