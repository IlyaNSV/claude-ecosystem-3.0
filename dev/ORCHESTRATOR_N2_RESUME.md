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

**Ledger findings closed:** FB-LR-02 / 03 / 04 / 05 / 06 / 09 / 13.
**Repo state:** on `main`, synced with `origin/main`. The only uncommitted file is
`dev/meta-improvement/audit-index.md` — **session-audit hook noise; exclude it from every commit**.
**Next free DEC-DEV number = `0096`.**

## What's LEFT — planned work, in priority

1. **P5 — T5 remediation guardrails** (FB-LR-07/08; the queue's broadest/riskiest item — agent
   concurrency, least-validated). Single-writer for remediation (extend FB-004 — this is also the
   **unclosed remainder of T2**: the baseline anchor is robust to churn but does not *prevent* a
   racing committer); forbid unilateral design decisions; escalate upstream cross-spec conflicts to
   CONCERN instead of self-resolving; bounded auto-retry for a *transient* impl-block (FB-022).
   Harder to lock with static wiring-tests than the prior gates — plan an adversarial-repro angle.
2. **P6 — DEC-DEV-0090 phase-2** (receiving side): auto-pickup of the `/ecosystem:meta-feedback`
   outbox + dedupe + a unified finding contract across FEEDBACK-JOURNAL / Session Audit / UF-ledger.
3. **Cheap riders** (do when the file is already open): **DEC-DEV-0089** PA-dedup pre-filter in
   `audit-spec-fidelity` (FB-LR-10); rename the `kind:fabricated-trace` misnomer (FB-LR-12).
4. **Pilot re-validation of the whole N+2 contract** — a **separate LIVE session the owner drives**
   (I cannot run it): `/ecosystem:update` in `my-first-test`, then re-run A (P4 localization) / B
   (P6 billing with Docker **down** → expect `ENV_NOT_READY`, not a false NO-GO) / C
   (`feature-to-tdd-impl --feature admin` → expect the nested P6 to RETURN a real verdict, not the
   advisory fallback). Grade post-hoc. This is the empirical proof the 4 merged increments work end
   to end — none has been live-run yet.
5. **Bookkeeping tail (FB-LR-14):** tag a clean pilot baseline before the next run; rename the
   "S7" name-collision (the admin live-run was journaled as "S7" but canonical S7 = the §6 detect-leg)
   → RUN-C; correct/​delete the pilot-repo `project_orchestrator_p6_delegation_unresolvable` memory
   (it mis-attributed the delegation failure to a nesting wall — disproved in DEC-DEV-0091).
6. **OPEN pilot risk (keep open until T5 lands):** FM-001↔FM-005 `had_trial` silent no-op — auth
   writes `had_trial=true` before emitting `account.confirmed`, so `TrialService.activateIfEligible`
   may silently no-op; billing specs contradict (req 1.1 vs 12.6 vs auth design.md:489). Needs an
   upstream **product** decision (Path A: auth stops flipping `had_trial`; Path B: re-key billing
   idempotency off Subscription existence) — not an orchestrator code fix.

## Next-session kickoff prompt (paste verbatim)

```
Продолжаем доводить очередь Orchestrator N+2 (план: dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md,
находки: dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md, чекпоинт: dev/ORCHESTRATOR_N2_RESUME.md).

Уже слито в main (verify-зелёное): T1 verdict×readiness (0092,#41), T2 order-aware verify
(0093,#42), P3 FB-028 defect-enum (0094,#43), P4/T4 design→tasks coverage (0095,#44).

Следующий = P5 / T5 — remediation guardrails (single-writer для ремедиации = остаток T2 против
гонки committers; запрет односторонних design-решений; escalate-не-self-resolve cross-spec
конфликтов; bounded auto-retry transient impl-block, FB-022). Это самый рискованный пункт
(agent concurrency) — спланируй adversarial-repro, не только статические wiring-тесты.

Сначала верифицируй фактическое состояние (git log на main + что 0096 свободен), заведи ветку,
держи цикл: build → npm run verify зелёный → push → PR → merge (я делегировал мёрж тебе) → sync
main. audit-index.md = шум хука, в коммиты не тащить. Следующий DEC-DEV = 0096.
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
