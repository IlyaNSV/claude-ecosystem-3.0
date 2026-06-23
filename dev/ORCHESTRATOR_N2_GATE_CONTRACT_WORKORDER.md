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
| **P2** | **T2 order-aware `verify-finding-before-act`** (FB-LR-03): snapshot pre-fix ground-truth (captured by an **agent**, per the DEC-DEV-0073 no-FS-in-script rule) so a confirmer reading an already-fixed tree distinguishes *refuted-genuine* vs *already-fixed*; a racing committer can't mask an unresolved defect. Touches `verifyFinding` in **both** P4 and P6 — design once. **Coupled with T5** (serialize remediation, or the snapshot goes stale). | Worst failure **class** (silent wrong verdict) — needs its own adversarial-repro + test cycle; bundling = waterfall. |
| **P3** | **FB-028 real fix** (FB-LR-06): constrain RA-8 `kind` to a defect enum + harden `verifyFinding` so a positive RA-8 finding isn't auto-confirmed. | Same verify-layer surface as T2 — couple. NOT the phantom FSM-kind the pilot mis-diagnosed. |
| **P4** | **T4-full** (FB-LR-05): `design.FileStructure → tasks.boundary` hybrid coverage oracle (deterministic extract + semantic checker) + enforce **P4 between P3 and P5** in run.md. Ships after the cheap **T4-lite** dangling-forward-ref linter proves the win. | Heavier oracle work. |
| **P5** | **T5 remediation discretion** (FB-LR-07/08): single-writer for remediation (extend FB-004), forbid unilateral design decisions, escalate upstream cross-spec conflicts to CONCERN, bounded auto-retry for transient impl-blocks. | Broadest/riskiest (agent concurrency); least validated. |
| **P6** | **DEC-DEV-0090 phase-2** receiving-side: auto-pickup of the `/ecosystem:meta-feedback` outbox + dedupe + unified finding contract across FEEDBACK-JOURNAL / Session Audit / UF-ledger. | The 14-FB load is its first real test. |

## Cheap riders (do when the relevant file is already open)
- **T4-lite** dangling-forward-reference linter (text check for `(a later task)` / forward refs with no
  emitting task) — PARTIAL mitigation of FB-LR-05; label it partial, do NOT mark design→tasks "handled".
- **DEC-DEV-0089** PA-dedup pre-filter in `audit-spec-fidelity` (FB-LR-10).
- Rename `kind:fabricated-trace` misnomer (FB-LR-12).

## Open pilot risk (track until T2/T5 land)
**FM-001↔FM-005 `had_trial` ownership conflict** (FB-LR-07): auth writes `had_trial=true` before emitting
`account.confirmed`, so `TrialService.activateIfEligible` may silently no-op. Specs contradict (billing
req 1.1 vs req 12.6 vs auth design.md:489). Masked by a remediation race in B; **not** in `residual`.
Needs an upstream product decision (Path A: auth stops flipping `had_trial`; Path B: re-key billing
idempotency off Subscription existence). Keep OPEN in the pilot.
