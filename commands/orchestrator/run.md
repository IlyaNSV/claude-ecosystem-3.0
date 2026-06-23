---
description: Run an Orchestrator PMO process end-to-end as an in-harness Workflow. First increment ships P3 batch-features-to-cc-sdd (route Product handoffs into cc-sdd specs). Reads handoffs + tool-docs; delegates spec generation to cc-sdd's kiro-spec-batch; gates with a content-fidelity preflight and an independent coverage oracle.
argument-hint: "<process> [--feature FM-NNN ...] [--all] [--no-stack-gate]"
---

# /orchestrator:run

User invoked: `/orchestrator:run $ARGUMENTS`

You are the **orchestrator-controller (RA-0)**. You load the process regimen and launch
its Workflow skeleton. The Workflow owns sequencing + deterministic gates; cc-sdd's kiro
skills own the spec-generation judgment (see `orchestrator/README.md` — hybrid design,
DEC-DEV-0076).

## Available processes (first increment)

| `<process>` | What it does | Zone |
|---|---|---|
| `batch-features-to-cc-sdd` | Route a batch of `status: ready\|partial` handoffs into cc-sdd specs (P3) | D2-T01/T06 |
| `audit-spec-fidelity` | Audit generated specs against `.product` for fidelity drift, before impl (P4) | D2-T verify |
| `feature-to-tdd-impl` | Drive one feature's `tasks.md` to implemented code via native TDD loop (P5) | D3 |
| `validate-feature-impl` | Feature-level GO/NO-GO gate after impl: full suite+build + 3 validators (RA-8/9/10) + verify-finding (P6) | D3 verify |

P5 delegates its feature-level gate to P6 (`validate-feature-impl`) via `workflow()`; you can
also run P6 standalone to re-gate an already-implemented feature. Other processes (P2/P7) are deferred.

## Pre-flight (read-only, before launching)

**Always:** confirm cc-sdd is `active` in `.claude/integrator/active-tools.yaml`. If not →
stop: these processes need cc-sdd; run `/integrator:add cc-sdd` first. Do NOT improvise a
substitute.

**For `batch-features-to-cc-sdd` (P3):**
1. `kiro-spec-batch` skill installed.
2. **Handoffs?** `--feature FM-NNN` (repeatable) → those handoffs; `--all`/none → all
   `status: ready|partial` in `.product/handoffs/`; none found → stop.
3. **Stack decided?** P3 pins `tech.md`. If `.kiro/steering/tech.md` already pins a stack,
   proceed. If not, this is the one irreducible human gate (RUN 01) — ask the user (or run
   P2 when it ships). `--no-stack-gate` passes `stackDecided:false` to halt cleanly at
   Steering (dry inspection).

**For `feature-to-tdd-impl` (P5):**
1. `kiro-impl` templates present (`.claude/skills/kiro-impl/templates/{implementer,reviewer,debugger}-prompt.md`)
   and the `kiro-review` / `kiro-verify-completion` / `kiro-validate-impl` skills installed
   (P5 LIFTS these). If absent → stop; cc-sdd install is incomplete.
2. **Spec authored?** `.kiro/specs/<feature>/{spec.json,requirements.md,design.md,tasks.md}`
   must exist and tasks be approved (run P3 / `kiro-spec-*` first). Resolve `<feature>` from
   `--feature` (cc-sdd slug, e.g. `auth`).
3. **Env ready?** `feature-to-tdd-impl` implements real code — it runs the shared
   env-readiness probe (`.claude/orchestrator/lib/env-readiness.cjs`) as a pre-flight and
   forwards the verdict to P6 (DEC-DEV-0092). A down substrate does NOT abort impl (a task may
   bring it up) but is carried on the `readiness` axis so the gate is never a false NO-GO. A
   missing tool/secret is a capability gap → request from Integrator (§6), do not self-equip.

**For `audit-spec-fidelity` (P4)** — run BETWEEN P3 and P5 (the pre-impl gate):
1. The features' specs exist (`.kiro/specs/<feature>/{requirements,design,tasks}.md`) — run P3 first.
2. `fidelity-oracle` present (`.claude/orchestrator/lib/fidelity-oracle.cjs`).
3. `design-coverage-oracle` present (`.claude/orchestrator/lib/design-coverage-oracle.cjs`) — the
   design→tasks structural-coverage layer (T4, DEC-DEV-0095) catches a design module no task builds
   (the unmounted-API gap), pre-impl.
4. Resolve `--feature` slug(s) to audit; each needs its `.product` source (handoff + traced
   FM/SC/BR/IC/NFR artifacts) readable for the deterministic trace-integrity gate.

**For `validate-feature-impl` (P6)** — usually reached via P5's delegation, but runnable standalone:
1. The feature is implemented (`.kiro/specs/<feature>/tasks.md` tasks mostly `[x]`) — P6 gates
   the result, it does not implement. Resolve `<feature>` from `--feature` (cc-sdd slug).
2. `coverage-oracle` present (`.claude/orchestrator/lib/coverage-oracle.cjs`) — the
   requirements-coverage validator (RA-8) reuses it as the anti-self-report backbone.
3. `env-readiness` present (`.claude/orchestrator/lib/env-readiness.cjs`) — the mechanical
   layer probes it BEFORE the suite so a down substrate is `readiness=ENV_NOT_READY`
   (MANUAL_VERIFY), not a false NO-GO (DEC-DEV-0092).
4. `remediation-guard` present (`.claude/orchestrator/lib/remediation-guard.cjs`) — the
   remediation loop's discretion backbone (DEC-DEV-0096 / T5): classifies a block and
   self-checks a fix note so a cross-spec/design contradiction escalates, never self-resolves.
5. The full TEST/BUILD commands are discoverable (manifests/CI) — the mechanical layer runs them.

## Launch

Load the regimen skills for context, then launch the matching Workflow.

> **Pass `args` as an OBJECT, not a JSON string.** Write `args: { feature: "auth" }`,
> NOT `args: "{\"feature\":\"auth\"}"`. The harness forwards `args` verbatim — a
> stringified value reaches the script as a string, so `feature`/`handoffs` come back
> undefined and the process runs target-less (live-run RUN 01 FB-001/FB-002: an empty
> feature let the Plan agent pick the wrong spec). The scripts now defensively parse a
> string, but pass an object so the guard is belt-and-suspenders.

**P3 — `batch-features-to-cc-sdd`** (skills: `orchestrator-init`, `build-steering`,
`build-briefs-from-handoff`, `coverage-oracle`):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/batch-features-to-cc-sdd.mjs',
  args: {
    handoffs: [ ".product/handoffs/FM-NNN-handoff.md", ... ],   // resolved above
    adapter: '.claude/integrator/adapters/handoff-to-ccsdd.js',
    oracle: '.claude/orchestrator/lib/coverage-oracle.cjs',
    stackDecided: true | false
  }
})
```

**P5 — `feature-to-tdd-impl`** (skills: `orchestrator-init`, `gate-risk-classifier`,
`tdd-impl-loop`):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/feature-to-tdd-impl.mjs',
  args: {
    feature: "<cc-sdd slug, e.g. auth>",
    specDir: ".kiro/specs/<feature>",
    classifier: '.claude/orchestrator/lib/gate-risk-classifier.cjs',
    envProbe: '.claude/orchestrator/lib/env-readiness.cjs',   // DEC-DEV-0092: pre-flight readiness probe (forwarded to P6)
    remediationGuard: '.claude/orchestrator/lib/remediation-guard.cjs',   // DEC-DEV-0096 / T5: block-discretion backbone (transient-retry vs escalate)
    kiroTemplates: '.claude/skills/kiro-impl/templates',
    registry: ''   // optional .claude/orchestrator/registries/load-bearing.<FM>.yaml
  }
})
```

**P4 — `audit-spec-fidelity`** (skills: `orchestrator-init`, `audit-spec-fidelity`) — run
between P3 and P5 (pre-impl fidelity gate):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/audit-spec-fidelity.mjs',
  args: {
    features: [ "<cc-sdd slug>", ... ],   // resolved above
    specBase: '.kiro/specs',
    oracle: '.claude/orchestrator/lib/fidelity-oracle.cjs',
    coverageOracle: '.claude/orchestrator/lib/design-coverage-oracle.cjs'   // DEC-DEV-0095: design→tasks structural coverage (T4)
  }
})
```

**P6 — `validate-feature-impl`** (skills: `orchestrator-init`) — feature-level GO-gate AFTER
impl; usually invoked by P5 via `workflow()`, runnable standalone to re-gate a feature:

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/validate-feature-impl.mjs',
  args: {
    feature: "<cc-sdd slug, e.g. auth>",
    specDir: ".kiro/specs/<feature>",
    oracle: '.claude/orchestrator/lib/coverage-oracle.cjs',
    envProbe: '.claude/orchestrator/lib/env-readiness.cjs',   // DEC-DEV-0092: readiness probe (run before the suite)
    remediationGuard: '.claude/orchestrator/lib/remediation-guard.cjs',   // DEC-DEV-0096 / T5: remediation-discretion backbone (escalate cross-spec/design conflicts)
    source: '.product/handoffs/FM-NNN-handoff.md',   // optional — RA-8 coverage-oracle backbone
    validationCommands: {},                          // {test, build, smoke} if known; else discovered
    concerns: [],                                    // forwarded from P5 (deferred-capability flags)
    degraded: false,                                 // true if upstream tasks were blocked → advisory
    readiness: 'READY'                               // optional pre-flight hint; P6 takes worst-of with its own probe
  }
})
```

The Workflow runs in the background; watch progress with `/workflows`. P3 returns
features-specced / blocked / cross-spec / coverage-incomplete / commit sha; P4 returns
audited / faithful / spec_fixed / product_routed / residual / **`coverage_gaps`** (design→tasks
structural gaps, DEC-DEV-0095) / impl_ready; P5 returns
implemented task ids / blocked / **`concerns`** (deferred-capability / mock-stand-in flags,
FB-013) / **`conflicts`** (cross-spec/design contradictions escalated at impl, DEC-DEV-0096 / T5) /
GO-gate result / **`readiness`**; P6 returns mechanical / **`readiness`** (READY |
DEGRADED | ENV_NOT_READY) / validators / confirmed_findings / **`already_resolved`**
(real-but-fixed-since-baseline, DEC-DEV-0093) / remediated / residual / **`conflicts`**
(escalated cross-spec/design contradictions, DEC-DEV-0096 / T5) /
**`result`** (GO | NO-GO | MANUAL_VERIFY_REQUIRED) / findings.

> **One orchestrator workflow per repo at a time (FB-004).** Two processes that both
> `git commit` race on the shared git index even when their file zones don't overlap
> (corrupt index / failed commit). Run P3 and P5 sequentially, not concurrently. **In-run
> single-writer (DEC-DEV-0096 / T5):** within a process, remediation and impl are strictly
> sequential — one commit at a time, never fanned out — so committers never race inside a run;
> a fix that finds the defect already resolved by a sibling commit does not double-commit.

> **Run records (FB-003).** The source of truth for a run is the harness transcript-dir
> (`/workflows`, `…/subagents/workflows/wf_*`) plus the Workflow return value above.
> `.claude/orchestrator/runs/` is NOT auto-created by the processes in this increment —
> it exists only when a human/agent writes a feedback journal or checkpoint there. Don't
> expect an auto run-ledger (a durable per-run ledger is a tracked follow-up).

## Autonomy & gates (SPEC §6/§7)

- **Reversible / dev-scoped** steps run autonomously.
- **The stack choice** is a human gate (above) — do not pick a stack silently.
- **Preflight C-07 fail** is not yours to fix: a clobbered handoff routes to Product
  (content) or Integrator (adapter), not a self-repair (RUN 01 boundary anti-pattern).
- **Capability gaps** (a tool/MCP/secret the process needs and lacks) → a capability
  request to the Integrator via `pending-actions.md`, not a self-equip (§6).

## After the run

- Surface the summary + the commit sha(s) to the user.
- **Disclose the test substrate at GO (FB-013, DEC-DEV-0081).** If a deliverable's acceptance
  / E2E ran against Mock or stub stand-ins for a *deferred* real seam (provider / API / secret
  / adapter), the GO summary MUST say so — e.g. "E2E ran on Mock providers; real adapters are
  unwired skeletons; real access deferred." A clean "feature complete / GO" over an unwired
  real seam is an over-claim. Surface every `concerns[]` item the run returned + its route
  (Integrator for access/tool/secret; Product for provider choice) — a green GO must not hide
  them. (S6/DEC-DEV-0081: the implementer flagged exactly this and the FSM used to drop it.)
- **P3:** if `coverage_incomplete` is non-empty → those features miss source ids in their
  specs; recommend re-running the relevant `kiro-spec-*`. If blocked features exist →
  surface the route (Product / Integrator) per item. Live caveat: can a Workflow `agent()`
  invoke `kiro-spec-batch` (which self-dispatches)? If not, the Author phase falls back to
  running the kiro-spec-* pipeline per feature itself.
- **P4:** `impl_ready` lists features safe to route to P5. `spec_fixed` had spec-route drift
  repaired + re-audited clean. `product_routed` drift went to Product via `pending-actions.md`
  (OD8) — it is NOT auto-fixed; surface it. `residual` = spec drift unresolved after the
  re-audit rounds — those features are NOT impl-ready; surface for manual review before P5.
  **`coverage_gaps` (DEC-DEV-0095, T4 / FB-LR-05):** a design File-Structure file/module that NO
  task builds (e.g. a missing assembly module → an API that mounts nothing) — a blind spot of the
  fidelity/coverage/RA-10 oracles. A feature with a confirmed gap is **excluded from `impl_ready`**;
  the gap is routed `spec` (a spec-completion pending-action recommending the missing assembly/wiring
  task) and is **not auto-fixed** here (a missing task is for the spec author / a P3 re-run). Add the
  task, then re-run P4. (The T4-lite forward-ref check is partial — it flags vague "wired later"
  deferrals as candidates; it does not by itself prove the wiring task is absent.)
- **P5:** per-task commits land as the loop runs (selective staging). If `blocked` is
  non-empty → those tasks hit `_Blocked_`; an upstream-ownership block routes back to the
  owning spec (do not patch around it). **Block discretion (DEC-DEV-0096 / T5):** a BLOCK is
  classified before a debug round is spent — a *transient* hiccup (locked git index / flaky
  install / a momentarily-down substrate, FB-LR-08) gets a **bounded auto-retry** (re-probe env,
  retry, no debug round), so a flake no longer needs a manual re-drive. **`conflicts` (FB-LR-07):**
  a task that requires resolving a contradiction BETWEEN specs/requirements or a design
  self-contradiction is **ESCALATED, not self-resolved** — it is recorded with the upstream route
  (Product for a cross-spec/requirement contradiction or a provider/design choice; the owning
  spec's author for a design self-contradiction) and listed in `conflicts`; it also counts as
  `blocked`, so the feature gate runs advisory (never a clean GO). Surface each `conflicts[]` item
  for the owner — a remediation must never pick a side of a contradiction. If the GO-gate is
  `NO-GO` after 3 remediation
  rounds, or `MANUAL_VERIFY_REQUIRED` → surface the findings; the feature is not done. P5 also
  returns `readiness` (forwarded from its pre-flight probe + P6) — a `MANUAL_VERIFY_REQUIRED`
  with `readiness=ENV_NOT_READY` means the substrate was down, not that the code failed (re-run
  once it is up; DEC-DEV-0092 — see P6 below). If
  `concerns` is non-empty → a task met a real seam with a Mock/unwired skeleton because real
  access is deferred (FB-013); those are tracked in `pending-actions.md` and MUST be disclosed
  at GO (above) — a GO over them is GO-with-caveats. Live
  caveat: the lift reads kiro templates + invokes per-task kiro gates (`kiro-review` /
  `kiro-verify-completion`) from Workflow agents — confirm nested skill invocation works in
  the pilot; the templates embed the protocol as a fallback. The feature-level gate is now P6.
- **P6:** `result` is the feature verdict — `GO` only if the mechanical layer (full suite +
  build) is green AND no confirmed validator finding remains AND no upstream task was blocked.
  `confirmed_findings` are the ones that passed verify-finding-before-act — now **order-aware**
  (DEC-DEV-0093): each finding is classified against BOTH the current worktree AND a pre-gate
  baseline sha into `present` (real & unresolved → remediated), `already-resolved` (real at the
  baseline, fixed since the gate started — surfaced in `already_resolved`/`findings`, NOT
  re-fixed and NOT mislabelled a hallucination), or `refuted` (absent in both → dropped). This
  closes the TOCTOU where a confirmer reading an already-remediated tree called a REAL finding a
  "hallucination", or a racing commit masked an unresolved defect (FB-LR-03/13). An
  `already_resolved` item must still be **verified as a genuine fix, not a mask** (remediation
  is now single-writer — DEC-DEV-0096 / T5 — but a fix landed *before* the gate by another path
  still warrants the check). `residual` = `present` defects still
  unresolved after the remediation cap (3 rounds) → not a clean GO; surface them. A
  high-severity residual forces `NO-GO`, otherwise `MANUAL_VERIFY_REQUIRED`.
  **`conflicts` (DEC-DEV-0096 / T5, FB-LR-07):** if remediation hit a cross-spec/requirement
  contradiction or a design self-contradiction, it is **ESCALATED — surfaced as a CONCERN/upstream
  decision, never self-resolved**; a non-empty `conflicts` **degrades a would-be GO to
  `MANUAL_VERIFY_REQUIRED`** (the feature's correctness is undecided until the owner resolves it).
  A `conflicts` entry flagged `masked:true` means a remediation reported a *unilateral* resolution
  — verify it did not bury the conflict. Route each to Product (cross-spec / provider / design
  choice) or the owning spec's author (design self-contradiction). **Read `readiness` alongside `result`
  (DEC-DEV-0092):** `result` answers "is the code good?", `readiness` answers "did the gate get
  to judge?". `ENV_NOT_READY` (substrate down — Docker/DB/Redis off, or a RED suite whose
  failures are *all* substrate errors per the allowlist) is reported as
  `MANUAL_VERIFY_REQUIRED`, **never** `NO-GO` — bring the substrate up and re-run; do not read
  it as "the code failed" (the run-B false-NO-GO this contract fixes). `DEGRADED` (upstream
  blocked tasks) is likewise advisory; only `READY`/`DEGRADED` can pair with a `GO`.
  `concerns` forwarded from P5 are disclosed in
  `findings` (FB-013) — a GO over a mock-only / unwired real seam is GO-with-caveats. Live
  caveat: P5 reaches P6 via `workflow()` (one-level nesting); if unavailable P5 falls back to
  the inline `kiro-validate-impl` lift.
