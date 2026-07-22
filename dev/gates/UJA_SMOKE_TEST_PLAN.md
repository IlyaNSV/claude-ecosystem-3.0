# P8 `user-journey-acceptance` (UJA) — Smoke Test Plan

> **Status:** static verification DONE (in the build commit); real run PENDING (VM-pilot, user-driven).
> **Pattern:** [`dev/meta-improvement/patterns/smoke-test-plan.md`](../meta-improvement/patterns/smoke-test-plan.md).
> **What is validated:** the P8 leg (DEC-DEV-0225) — a browser user-journey gate between the staging
> deploy (E.B `DEPLOYED`) and `done`. This plan is the **plan**, not the execution.

---

## 0. Why this gate exists (the ground-truth defect it must catch)

The live precedent on the pilot `my-first-test` (RUN-2026-07-17-A, the first pilot release RL-001): P6
`GO`, P7 `READY_TO_SMOKE`, deploy `DEPLOYED` and a `/health` 2xx — **and the first user touch was
broken** (post-login landed on a 404, no home page). P7 only pings HTTP-liveness
(`orchestrator/lib/runtime-readiness.cjs:293-304`), the DoD had no journey leg, and the Design Module
never promised a reality↔MK check. P8 is the gate that would have turned that green line **red at the
journey**. The smoke test's north star: **on a repo with a known-broken first-user-touch, UJA must
return `FAIL` (not PASS, not ENV_NOT_READY-masked-as-fine).**

---

## 1. What the AI session CAN verify (static — DONE in the build commit)

- **Unit — the verdict parser** (`tests/orchestrator/uja-report.test.cjs`, 19 checks): pass/fail/empty
  fixtures reduce to `PASS`/`FAIL`/`ENV_NOT_READY`; the **zero-evidence rule** (0 journeys ⇒
  `ENV_NOT_READY`, never PASS); an unparseable/missing report ⇒ `ENV_NOT_READY`, never FAIL;
  determinism (N parses byte-identical); preflight DoR (Playwright dep/config + journeys present).
- **Wiring** (`tests/orchestrator/user-journey-acceptance-wiring.test.cjs`, 14 checks): the FSM
  (preflight→run→report), the deterministic-lib backbone, capture-don't-fix, the real-vendor budget
  guard, PA_CANON, the return envelope, MDP model pins, and the **charter v6 contract** (deploy →
  `journey_acceptance` → done; FAIL → `awaiting_journey_fix`; the safe `owner.close` resume-event).
- **Charter fabric** (`tests/orchestrator/fabric-engine.test.cjs`): the happy path now runs
  deploy → journey → done; a FAIL parks the owner-queued `awaiting_journey_fix`; ingest maps
  `uja_result` to the three journey events.
- **Ledger** (`tests/orchestrator/run-ledger.test.cjs`): `uja_result` is in `OUTCOME_KEYS` (the
  summary reads the verdict, not `null`) — the p7_result-mis-key class cannot recur.
- **Smoke** (`workflow-syntax.smoke.cjs`): the `.mjs` parses in the harness dialect + every `agent()`
  pins a model.

`NODE_PATH=<root>/node_modules npm run verify` → EXIT 0.

## 2. What the AI session CANNOT verify (real run — VM-pilot, user-driven)

- Playwright actually installed + journeys actually authored in a real product repo.
- `npx playwright test --reporter=json` actually driving a real browser against a **live** staging deploy.
- The verdict actually gating the fabric line (deploy → journey → done vs → awaiting_journey_fix).
- Screenshots/trace actually landing in `artifacts_dir` for owner MK-review.
- The budget guard actually holding (journeys on minimal fixtures, no real-vendor blow-up).

These need a real DEPLOYED staging target + authored journeys on the VM pilot.

---

## 3. Real-run scenarios (VM-pilot `my-first-test`)

**Setup (common):** re-bootstrap/update the pilot to this build; `/integrator:add playwright` (DoR);
author ≥2 journeys at `tests/uja/*.spec.ts` (e.g. `login.spec.ts` — reach the home page after login;
`core-flow.spec.ts` — the release's primary user flow from the FM/NM), on **minimal fixtures** (a seed
account). Have a staging deploy (`deploy-to-stage` → `DEPLOYED`) live at a known URL.

### S1 — Green path (all journeys pass → `done`)
- **Invocation:** `/orchestrator:run user-journey-acceptance --fabric` (fabric-prescribed after deploy),
  args `stagingUrl` = the DEPLOYED URL.
- **Expected:** `uja_result: PASS`, `journeys_total ≥ 2`, `journeys_failed: []`; the fabric line ticks
  `journey_acceptance → done`; screenshots/trace under `test-results/`.
- **Acceptance:** ☐ PASS verdict ☐ line reaches `done` ☐ artifacts present.

### S2 — The known-defect path (a broken first-user-touch → `FAIL`)  **← the load-bearing scenario**
- **Setup:** point at a staging build with the RL-001-class defect (post-login 404), OR temporarily
  break the home route.
- **Expected:** `uja_result: FAIL`; `journeys_failed[]` names the login/home journey; the line parks at
  `awaiting_journey_fix`, owner-queued; the gate does NOT patch the app (capture-don't-fix).
- **Acceptance:** ☐ FAIL (not PASS, not a masked ENV_NOT_READY) ☐ failing journey named ☐ parked +
  owner-queued ☐ nothing auto-remediated/committed. **This is the scenario that proves P8 earns its keep.**

### S3 — DoR gap: Playwright not equipped → `ENV_NOT_READY`
- **Setup:** a project without `@playwright/test` and no `playwright.config.*`.
- **Expected:** `uja_result: ENV_NOT_READY`; reason names `/integrator:add playwright`; a non-blocking
  PA is recorded; the line routes to `runtime_gate_retry` (no false FAIL, no false PASS).
- **Acceptance:** ☐ ENV_NOT_READY ☐ DoR hint present ☐ PA recorded ☐ routed to retry.

### S4 — DoR gap: no journeys authored → `ENV_NOT_READY`
- **Setup:** Playwright equipped, but `tests/uja/` absent or empty.
- **Expected:** `uja_result: ENV_NOT_READY`; reason hints "author journeys from NM"; **NOT** a PASS
  (the zero-evidence rule — a gate over 0 journeys must never go green).
- **Acceptance:** ☐ ENV_NOT_READY ☐ authoring hint ☐ never PASS.

### S5 — DoR gap: staging down → `ENV_NOT_READY`
- **Setup:** equipped + journeys authored, but the staging URL not 2xx (or absent).
- **Expected:** `uja_result: ENV_NOT_READY`; the healthcheck probe does NOT start/repair staging
  (read-only, capture-don't-fix); routed to `runtime_gate_retry`.
- **Acceptance:** ☐ ENV_NOT_READY ☐ staging not started by the gate ☐ routed to retry.

---

## 4. Reporting format (retroactive, after the real run)

```markdown
## DEC-DEV-NNNN — P8 UJA smoke results (real run on my-first-test)
Date: <ISO>   Trigger: dev/gates/UJA_SMOKE_TEST_PLAN.md   Tag: #pilot-finding #validation
### Outcome
- S1 green path: <pass|partial|fail>
- S2 known-defect FAIL: <pass|partial|fail>   ← the load-bearing one
- S3/S4/S5 DoR gaps: <…>
### Findings / Lessons / Next
- …
```

## 5. «Done» criteria

Passes when: **S2 returns FAIL on a genuinely broken first-user-touch** (the non-negotiable), S1 ships
green, and ≥2 of S3–S5 correctly return `ENV_NOT_READY` with the right DoR hint; no regression to the
P3–P7 / deploy legs (`npm run verify` green baseline maintained). Graceful-skip a scenario the pilot
cannot yet stage (record it), but S2 is not skippable — it is the reason the gate exists.

---

## 6. Known limits (honest, v0)

- **Visual conformance is owner-reviewed, not auto-diffed.** P8 attaches screenshots/trace; the
  reality↔MK judgment is the owner's. An automatic MK-diff is v1.1.
- **Playwright MCP is out of scope for v0** (deterministic npm `@playwright/test` is the core; MCP
  later — its download tool is gone, issue #154 closed-not-fixed, weaker assertions).
- **prod journeys are out of scope for v0** — staging only (`env_tier: staging`); prod stays behind the
  autonomy floor.
