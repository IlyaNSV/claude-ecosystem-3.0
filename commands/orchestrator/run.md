---
description: Run an Orchestrator PMO process end-to-end as an in-harness Workflow. First increment ships P3 batch-features-to-cc-sdd (route Product handoffs into cc-sdd specs). Reads handoffs + tool-docs; delegates spec generation to cc-sdd's kiro-spec-batch; gates with a content-fidelity preflight and an independent coverage oracle.
argument-hint: "<process> [--feature FM-NNN ...] [--all] [--no-stack-gate]"
---

# /orchestrator:run

User invoked: `/orchestrator:run $ARGUMENTS`

You are the **orchestrator-controller (RA-0)**. You load the process regimen and launch
its Workflow skeleton. The Workflow owns sequencing + deterministic gates; cc-sdd's kiro
skills own the spec-generation judgment (see `orchestrator/README.md` — hybrid design,
DEC-DEV-0071).

## Available processes (first increment)

| `<process>` | What it does | Zone |
|---|---|---|
| `batch-features-to-cc-sdd` | Route a batch of `status: ready\|partial` handoffs into cc-sdd specs (P3) | D2-T01/T06 |

`feature-to-tdd-impl` (P5) lands in S5b. Other processes (P2/P4/P6/P7) are deferred.

## Pre-flight (read-only, before launching)

1. **Tool present?** Confirm cc-sdd is `active` in `.claude/integrator/active-tools.yaml`
   and the `kiro-spec-batch` skill is installed. If not → stop: this process needs cc-sdd;
   run `/integrator:add cc-sdd` first. Do NOT improvise a substitute.
2. **Handoffs?** Resolve the batch:
   - `--feature FM-NNN` (repeatable) → those handoffs (`.product/handoffs/FM-NNN-handoff.md`).
   - `--all` or no feature flag → all `status: ready|partial` handoffs in `.product/handoffs/`.
   - none found → stop and say so.
3. **Stack decided?** P3 needs a decided tech stack (it pins `tech.md`). If `.kiro/steering/tech.md`
   already pins a stack, proceed. If not, this is the one irreducible human gate (RUN 01) —
   ask the user for the stack (or run P2 `decide-architecture-foundation` when it ships).
   `--no-stack-gate` passes `stackDecided:false` to let the Workflow halt cleanly at Steering
   instead (for dry inspection).

## Launch

Load the regimen skills (`skills/orchestrator/orchestrator-init.md`,
`build-steering.md`, `build-briefs-from-handoff.md`, `coverage-oracle.md`) for context,
then launch the Workflow:

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

The Workflow runs in the background; watch progress with `/workflows`. It returns a summary:
features specced, blocked (with route), cross-spec outcome, coverage-incomplete, commit sha.

## Autonomy & gates (SPEC §6/§7)

- **Reversible / dev-scoped** steps run autonomously.
- **The stack choice** is a human gate (above) — do not pick a stack silently.
- **Preflight C-07 fail** is not yours to fix: a clobbered handoff routes to Product
  (content) or Integrator (adapter), not a self-repair (RUN 01 boundary anti-pattern).
- **Capability gaps** (a tool/MCP/secret the process needs and lacks) → a capability
  request to the Integrator via `pending-actions.md`, not a self-equip (§6).

## After the run

- Surface the summary + the commit sha to the user.
- If `coverage_incomplete` is non-empty → the listed features are missing source ids in
  their specs; recommend re-running the relevant `kiro-spec-*` before implementation.
- If blocked features exist → surface the route (Product / Integrator) per blocked item.
- A live cc-sdd run validates the nested-subagent caveat (can a Workflow `agent()` invoke
  `kiro-spec-batch`, which self-dispatches?) — if it can't, the Workflow's Author phase
  falls back to running the kiro-spec-* pipeline per feature itself.
