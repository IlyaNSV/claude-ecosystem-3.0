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
| `feature-to-tdd-impl` | Drive one feature's `tasks.md` to implemented code via native TDD loop (P5) | D3 |

Other processes (P2/P4/P6/P7) are deferred.

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
3. **Env ready?** `feature-to-tdd-impl` implements real code — the env-readiness-probe must
   pass (runtime versions, datastore up if the stack needs it). A missing tool/secret is a
   capability gap → request from Integrator (§6), do not self-equip.

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
    kiroTemplates: '.claude/skills/kiro-impl/templates',
    registry: ''   // optional .claude/orchestrator/registries/load-bearing.<FM>.yaml
  }
})
```

The Workflow runs in the background; watch progress with `/workflows`. P3 returns
features-specced / blocked / cross-spec / coverage-incomplete / commit sha; P5 returns
implemented task ids / blocked / GO-gate result.

## Autonomy & gates (SPEC §6/§7)

- **Reversible / dev-scoped** steps run autonomously.
- **The stack choice** is a human gate (above) — do not pick a stack silently.
- **Preflight C-07 fail** is not yours to fix: a clobbered handoff routes to Product
  (content) or Integrator (adapter), not a self-repair (RUN 01 boundary anti-pattern).
- **Capability gaps** (a tool/MCP/secret the process needs and lacks) → a capability
  request to the Integrator via `pending-actions.md`, not a self-equip (§6).

## After the run

- Surface the summary + the commit sha(s) to the user.
- **P3:** if `coverage_incomplete` is non-empty → those features miss source ids in their
  specs; recommend re-running the relevant `kiro-spec-*`. If blocked features exist →
  surface the route (Product / Integrator) per item. Live caveat: can a Workflow `agent()`
  invoke `kiro-spec-batch` (which self-dispatches)? If not, the Author phase falls back to
  running the kiro-spec-* pipeline per feature itself.
- **P5:** per-task commits land as the loop runs (selective staging). If `blocked` is
  non-empty → those tasks hit `_Blocked_`; an upstream-ownership block routes back to the
  owning spec (do not patch around it). If the GO-gate is `NO-GO` after 3 remediation
  rounds, or `MANUAL_VERIFY_REQUIRED` → surface the findings; the feature is not done. Live
  caveat: the lift reads kiro templates + invokes kiro gates (`kiro-review` /
  `kiro-verify-completion` / `kiro-validate-impl`) from Workflow agents — confirm nested
  skill invocation works in the pilot; the templates embed the protocol as a fallback.
