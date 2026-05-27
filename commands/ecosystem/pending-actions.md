---
description: List pending user-action entries (PA-NNN) from .claude/pending-actions.md. Read-only with --status and --source filters.
argument-hint: "[--status <pending|done|dismissed|all>] [--source <module>] [--limit <N>]"
---

# /ecosystem:pending-actions

User invoked: `/ecosystem:pending-actions $ARGUMENTS`

Read-only view into `.claude/pending-actions.md`, the ecosystem-wide pending user-actions journal (DEC-DEV-0047 / patch 1.3.3 deliverable B-3).

## Process

### Step 1: Parse arguments

Defaults:
- `--status pending` (most common — what's actionable now)
- `--source` no filter (show entries from any module)
- `--limit` no limit (show all matching)

Recognized values:
- `--status pending | done | dismissed | all`
- `--source integrator | product | design | ecosystem | <custom-tag>`
- `--limit <N>` — integer; show first N matching after sort

If unrecognized flag → surface help block (see Step 6) and exit; do NOT proceed with partial parse.

### Step 2: Locate file

```bash
test -f .claude/pending-actions.md || {
  echo "Pending-actions journal not initialized."
  echo "Run /ecosystem:update to create .claude/pending-actions.md (patch 1.3.3 sub-phase F)."
  exit 0
}
```

If file missing — surface above message; do NOT create the file from this command (init is Bootstrap's job to keep responsibilities clean).

### Step 3: Parse entries

Each entry is a markdown block starting with `## PA-NNN — <title>`. Extract per entry:

- `PA-NNN` (from header)
- title (rest of header line)
- `**Status:**` value
- `**Created:**` ISO timestamp
- `**Source:**` value
- `**Trigger:**` value
- `**Action required:**` one-liner
- `**Blocking:**` (may be empty)

Skip the `PA-000 — Sentinel` entry (administrative placeholder; not user-actionable).

### Step 4: Apply filters

1. **Status filter** — match `**Status:**` field. `--status all` → no filter.
2. **Source filter** — match `**Source:**` field exactly.
3. **Limit** — sort by Created desc; keep first N.

### Step 5: Format output

Default render:

```
═══════════════════════════════════════════════════════════
PENDING USER ACTIONS
═══════════════════════════════════════════════════════════
Filter: status=<value>, source=<value or "any">
Total matching: <N>

───────────────────────────────────────────────────────────

PA-NNN — <title>
  Created: <YYYY-MM-DD>
  Source:  <module>
  Trigger: <slash-command or DEC-XXX or session>
  Action:  <one-liner>
  Blocking: <text or "—">

  Details:
    <first 3 lines of the **Details:** block, indented; "..." if truncated>

───────────────────────────────────────────────────────────

PA-NNN — ...

(... more entries ...)
```

If 0 matching entries:
```
No pending actions matching filter <status=pending, source=any>.

Use --status all to see done/dismissed entries.
```

### Step 6: Help block

If unrecognized flag OR `--help`:

```
Usage:
  /ecosystem:pending-actions
  /ecosystem:pending-actions --status <pending|done|dismissed|all>
  /ecosystem:pending-actions --source <integrator|product|design|ecosystem>
  /ecosystem:pending-actions --limit <N>

Defaults: --status pending, --source (any), --limit (no limit)

File: .claude/pending-actions.md (committed to git; manual edits allowed)
Spec: skills/ecosystem/user-action-tracker.md
```

### Step 7: Suggest next actions

After listing, if pending count > 0:

```
Next:
  - For each pending action, complete the task in the relevant external system,
    then mark the PA entry **Status:** done (manual edit or via the source skill).
  - To dismiss without action: set **Status:** dismissed + add **Resolution:** line.
  - For details on schema / source values: see skills/ecosystem/user-action-tracker.md
```

If pending count == 0 and source filter unset:
```
✅ No pending user actions. Nothing blocked on you right now.
```

## Important constraints

- **READ-ONLY.** This command never modifies `.claude/pending-actions.md`. Mutation is via direct edit or via the source skill that owns the action.
- **No side effects.** No file creation, no journal entry, no MCP calls.
- **Idempotent.** Running multiple times returns same view (subject to source-skill appends between invocations).
- **Output stability.** Default render format is stable for scripting (Tail-parseable). Future flags may add `--format json`.
- **Performance:** must complete in <2s on any reasonable PA file size (<10MB, hundreds of entries).

## Out of scope (patch 1.3.3)

- `--format json` — deferred to whenever needed for tooling integration.
- Cross-project aggregation (`~/.claude/...` global PA file) — file is project-local by design.
- Auto-expiry of old `pending` entries — manual `dismissed` is sufficient (per DEC-DEV-0047 Section 4 «Cuttable scope»).
- Mutation commands (`/ecosystem:pending-actions PA-007 --status done`) — manual edit is fine for v1.

## Cross-reference

- `skills/ecosystem/user-action-tracker.md` — append / mutate protocol + schema.
- `commands/ecosystem/bootstrap.md` Step 6 — initialization of `.claude/pending-actions.md`.
- `commands/ecosystem/update.md` — preservation on ecosystem update.
- DEC-DEV-0047 — design rationale.
