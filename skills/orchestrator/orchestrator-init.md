---
description: Orchestrator P1 — startup/resume context gathering before any process runs. Reads active-tools/pmo-mapping/.product, runs the env-readiness-probe, confirms the target tool is wired, and identifies the handoff batch. Also the re-orientation protocol after /compact. Load at the start of /orchestrator:run.
---

# orchestrator-init — startup & resume (P1)

The Orchestrator gathers a **multi-layer context** before building a process plan.
Cheapest self-useful layer first. This skill is the methodology behind the `init`
phase of every process Workflow and the standalone re-orientation after a `/compact`.

> RUN 01 grounding (DEC-DEV-0073): the init layer is read-only and is what made the
> session survivable across `/compact` — the durable skeleton (git + tasks + ledger)
> re-hydrated the loop byte-for-byte. P1 is the contract for that re-hydration.

## Context layers (gather in order)

1. **Tools & commands** — `.claude/integrator/active-tools.yaml` + `tool-docs/*`.
   Confirm the process's required tool is present and `active` (P3 needs **cc-sdd**;
   without it, stop and surface a capability gap, do not improvise a substitute).
2. **Zone coverage** — `.claude/integrator/pmo-mapping.yaml` (who covers what) + `gaps`.
   Confirm the zones this process touches (P3 → D2-T01/T06) are covered.
3. **Product state** — `.product/` map: handoffs (`.product/handoffs/FM-*-handoff.md`),
   their `status` (`ready` / `partial` / `blocked`), the FM artifacts they reference.
4. **Environment** — git branch/status, env-tier, active contracts, **plus the
   `env-readiness-probe`** (below).

## env-readiness-probe (RUN 01 P1-4)

Catch version/wiring mismatches **before** a process spends a code phase, not
reactively inside a subagent. Probe and record (no values for secrets):

- **Runtime versions** — `node -v`, `pnpm -v` / `npm -v`, `docker --version` (if the
  process needs a stack). Compare against the steering `tech.md` compatibility matrix.
- **Build capability** — anything `tech.md` requires that the toolchain must support
  (e.g. decorator metadata emit) — note as a constraint to verify, not assume.
- **Secrets presence** — which named secrets exist (presence only, never values).
- **Build graph** — workspace/package layout if monorepo.

Mismatch → record as a capability item (`type: env-constraint`, see §6 of the module
SPEC) for the §6 channel; do NOT silently absorb the fix (that is the boundary the
Orchestrator systematically violates — RUN 01 anti-pattern #2).

## Identify the work unit

- For P3: the **batch of handoffs** to route — by explicit `--feature FM-NNN` args, or
  all `status: ready|partial` handoffs in `.product/handoffs/` when batching.
- Classify each: `ready` → route now; `partial` → route but mark output experimental
  (mirrors adapter C-06); `blocked` → skip with a note.

## Resume after /compact (re-orientation)

Context is gone; the durable skeleton is not. Re-hydrate from, in order:

1. **git** — branch, last commits, working-tree status (what landed already).
2. **process run state** — `.claude/orchestrator/runs/<ts>.json` if present (which
   phase/feature was in flight).
3. **task DAG / ledger** — `.kiro/specs/*/tasks.md` checkboxes, the Notes-ledger
   (P5), beads if wired.
4. Re-run the env-readiness-probe (cheap; versions can change between sessions).

Then resume the Workflow at the first incomplete phase. The Workflow's own resume
(unchanged-prefix cache) handles the agent-call replay; this skill handles the
human-readable "where was I".

## Output

A structured init summary: tools-confirmed, zones-covered, handoff batch (with
per-feature status), env-probe results (+ any capability items), and the resume point
if re-entering. This summary is the input for the process plan and for the per-step
capability self-check (module SPEC §6).
