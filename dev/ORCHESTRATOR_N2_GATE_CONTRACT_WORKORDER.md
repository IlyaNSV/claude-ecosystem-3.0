# Orchestrator N+2 — "Trustworthy gate outcomes" (work-order)

> **Status:** ✅ INCREMENT BODY (T1) BUILT — **[DEC-DEV-0092](../DEV_JOURNAL.md)**; queue items P2–P6 below
> remain. Decision + rationale: **[DEC-DEV-0091](../DEV_JOURNAL.md)**.
> Findings: **[ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md](ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md)**. Validated by the
> A+B+C live-run audit + a 4-lens council (architect / pragmatist / risk / maintainer → synthesis).
>
> **Done (DEC-DEV-0091):** T3 — P5→P6 delegation by `{scriptPath}` (the spine the whole contract rides on),
> wiring-test pins the scriptPath form, degradation surfaced in findings. `npm run verify` green.
>
> **Done (DEC-DEV-0092):** T1 — the `verdict × readiness` contract + shared `env-readiness.cjs` probe
> (probe + substrate-error-allowlist classifier), P6 `readiness` axis with the `ENV_NOT_READY ⇒ MANUAL_VERIFY`
> code-invariant (decided before the `!mechPassed` NO-GO branch), P5 pre-flight probe + forwarding,
> run.md downstream readers, tests (env-readiness 8/8, P6 wiring 13→17). `npm run verify` green; counts
> unchanged (additive field). **Remaining for full closure:** step 8 pilot re-validation (re-run C nested +
> re-run B with Docker down) — a separate live session.

## The increment body — T1 gate-outcome contract (env half)

**Decision (≥2 alternatives weighed):** model gate outcomes as **two orthogonal machine-readable axes**,
NOT a bigger overloaded enum.

- `verdict` ∈ {GO, NO-GO, MANUAL_VERIFY} — "is the code good?"
- `readiness` ∈ {READY, DEGRADED, ENV_NOT_READY} — "did the gate actually get to judge?"

`DEGRADED` (upstream blocked tasks) and `ENV_NOT_READY` (substrate down) both mean *"the gate could not
fully judge"* → they belong on the **readiness** axis, leaving `verdict` to mean only what the gate could
verify. This makes scriptPath-delegation, GATE_DEGRADED and ENV_NOT_READY **one additive model** instead
of three patches.

### Build steps

1. **Shared env-readiness probe** — one helper callable by BOTH `feature-to-tdd-impl` (P5 pre-flight) and
   `validate-feature-impl` (P6 Phase-1): `docker info` (daemon alive) → `docker compose ps` health →
   `pg_isready` on the DB port + Redis `PING` → **migration-history** check (`prisma migrate status`,
   closes FB-LR-09 / FB-023). Reuses what the C P6#2 mechanical agent already did ad-hoc — codify it as a
   gate, not LLM initiative.
2. **P6 (`validate-feature-impl.mjs`):** add `readiness` to `MECH_SCHEMA` + the result return (line ~268).
   In the mechanical layer, when **build is GREEN but all suite failures match an explicit substrate-error
   allowlist** (`PrismaClientInitializationError` / `ECONNREFUSED localhost:5432|6379` / `Cannot connect to
   the Docker daemon` / `npipe`), set `readiness=ENV_NOT_READY` and do **NOT** synthesise NO-GO (the
   B-headline false-negative). Conservative: never upgrade toward GO; only block the false NO-GO.
3. **P5 (`feature-to-tdd-impl.mjs`):** forward `readiness` up in the return (line ~369); the existing
   `degraded` (line 331) maps to `readiness=DEGRADED`.
4. **Synthesis invariant (in code, not prose):** `ENV_NOT_READY ⇒ verdict=MANUAL_VERIFY`; only
   `READY|DEGRADED` may pair with `GO`. Prevents the two-axis split leaking into a contradictory third
   state (`GO + ENV_NOT_READY`).
5. **Downstream readers — SAME increment** (else the new field is silently ignored, re-creating the
   blindness): `commands/orchestrator/run.md` "After the run" guidance; any `/ecosystem:meta-feedback`
   consumer; the report/summary surface.
6. **Soft-migration (backwards-compat-narrow):** both axes are **additive optional** fields — absent
   `readiness` == `READY` == today's exact behavior; existing `result`/`go_gate` tokens stay valid → pilot
   state and any `result`-keyed caller untouched.
7. **Tests:** a wiring/contract test pinning (a) the env-readiness probe is called before the suite, (b)
   the `ENV_NOT_READY⇒MANUAL_VERIFY` invariant, (c) the substrate-error allowlist downgrade. `npm run
   verify` green.
8. **Pilot validation:** re-run C (`feature-to-tdd-impl --feature admin`) to confirm the nested P6 call now
   **RETURNS** a real verdict (not fallback); re-run B (`validate-feature-impl --feature billing`) with
   Docker **down** to confirm `ENV_NOT_READY` (not false NO-GO).

### Count / process gate
- The `readiness` enum is an **additive return field**, not a new artifact type or validation rule → **no
  count-sweep** expected (state this explicitly in the journal). If a reviewer judges otherwise, run
  `node dev/meta-improvement/scripts/check-counts.js` green before commit (blocking `process-gate.js`).
- CHANGELOG `[Unreleased] ### Added/Modified` (consumer-zone: orchestrator) + the soft-migration note.

## Queue (after the increment body, in priority)

| pri | item | why separate |
|---|---|---|
| ~~**P2**~~ ✅ | **T2 order-aware `verify-finding-before-act` — DONE (DEC-DEV-0093):** pre-gate baseline sha (agent-captured) + 3-way `disposition` (present / already-resolved / refuted) in **both** P4 + P6; an already-fixed real finding is `already-resolved` (surfaced, not "hallucination"), a masked defect is surfaced not dropped. Remediation acts only on `present`. P6 wiring 17→18, P4 8→9; verify green. **Still open → T5 (P5):** full single-writer serialization of concurrent committers (the baseline anchor is robust to churn but does not *prevent* a racing writer). | Worst failure **class** (silent wrong verdict) — had its own adversarial-repro + test cycle. |
| ~~**P3**~~ ✅ | **FB-028 real fix — DONE (DEC-DEV-0094):** `VALIDATOR_SCHEMA.kind` → defect enum (positive-confirmation unrepresentable; covered = `clean:true`) + `verifyFinding` polarity-gate (a positive assertion → `refuted`). P6 wiring 18→19; verify green. | Same verify-layer surface as T2 — done right after. NOT the phantom FSM-kind the pilot mis-diagnosed. |
| ~~**P4**~~ ✅ | **T4 — DONE (DEC-DEV-0095):** `design-coverage-oracle.cjs` (deterministic extract + basename-scan) + T4-lite forward-ref linter, run by P4 as a hybrid layer (oracle candidates → semantic-confirm); a confirmed gap excludes the feature from `impl_ready` + routes spec-completion (surface, not auto-add). run.md enforces "P4 between P3 and P5". New oracle 6/6 + wiring 9→10; verify green. **Surface-not-auto-fix** (a missing task is the spec author's). | Heavier oracle work — done. |
| ~~**P5**~~ ✅ | **T5 remediation discretion — DONE (DEC-DEV-0096, PR #46):** new `remediation-guard.cjs` (classifyBlock — conflict outranks transient, worst-of; detectsUnilateralResolution anti-mask). P6: single-writer documented+asserted (extends FB-004 within-run) + escalate cross-spec/design conflict to a `pending-actions` CONCERN (`escalateConflict`) + `conflicts` return field degrades GO→MANUAL_VERIFY + `resolved-by-concurrent-commit` no-double-commit. P5: classify a BLOCK before a debug round → `transient` bounded auto-retry (no debug round) / cross-spec/design → escalate (route + `conflicts`, counts as blocked → advisory) / implementer forbidden to self-resolve. Tests: `remediation-guard` 12/12 (adversarial) + new `feature-to-tdd-impl-wiring` 8/8 + `validate-feature-impl-wiring` 19→24; verify green; counts 24/44. | Broadest/riskiest (agent concurrency); least validated — adversarial-repro lives in the lib unit test (a live concurrency repro is unreachable). |
| ~~**P6**~~ ✅ | **DEC-DEV-0090 phase-2 — DONE (DEC-DEV-0097, PR #48 `70acf5f`):** new dev-only consolidator `dev/meta-improvement/scripts/feedback-intake.js` — auto-pickup of the `/ecosystem:meta-feedback` UF-outbox (+ optionally FB-ledger + Session Audit `audit-journal.ndjson`) → unified finding contract (`uid/source/source_ref/severity/signature/status`, reuses `audit-journal.js` signature space) → dedupe vs `DEV_JOURNAL` (`open` / `likely-ported` / `ported`). Capture-don't-fix (read+report only). skill+command "phase 2" notes point to it; `SESSION_AUDIT_GUIDE` documents it. Tests `feedback-intake` 11/11; live-validated on the real FB-ledger + journal (108 findings; surfaced stale route FB-LR-04). Counts 24/44 (dev-only). | The 14-FB load is its first real test — passed on real data. |

## Cheap riders (do when the relevant file is already open)
- ~~**T4-lite**~~ ✅ dangling-forward-reference linter — DONE (DEC-DEV-0095), folded into `design-coverage-oracle.cjs` as `extractForwardRefs`; still PARTIAL (flags candidates, does not prove the wiring task is absent — the semantic-checker decides).
- ~~**DEC-DEV-0089** PA-dedup pre-filter in `audit-spec-fidelity` (FB-LR-10).~~ ✅ DONE (PR #50): both PA-emitting prompts scan open PAs + update-in-place on a matching `(feature, route, ids/paths)` signature (prompt pre-filter, not a lib).
- ~~Rename `kind:fabricated-trace` misnomer (FB-LR-12).~~ ✅ DONE (PR #50): → `missing-trace-source` (emit ↔ guard ↔ test renamed together).

## Open pilot risk (T2 + T5 have landed — masking mechanism fixed; the PRODUCT decision is still open)
**FM-001↔FM-005 `had_trial` ownership conflict** (FB-LR-07): auth writes `had_trial=true` before emitting
`account.confirmed`, so `TrialService.activateIfEligible` may silently no-op. Specs contradict (billing
req 1.1 vs req 12.6 vs auth design.md:489). It was masked by a remediation race in B; **not** in `residual`.
T5 (DEC-DEV-0096) now makes a remediation that hits this **ESCALATE** it to a `conflicts`/`pending-actions`
CONCERN (GO→MANUAL_VERIFY) instead of letting a committer resolve it unilaterally — so it would no longer be
masked. But the conflict itself still needs an upstream **product** decision (Path A: auth stops flipping
`had_trial`; Path B: re-key billing idempotency off Subscription existence). Keep OPEN in the pilot until that
decision lands; verify the escalation fires on the pilot re-run.
