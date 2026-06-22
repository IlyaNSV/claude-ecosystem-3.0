---
description: View Integrator decision journal with optional filtering.
argument-hint: "[--filter <tag>] [--limit <N>] [--scope global|project]"
---

# /integrator:journal

Display Integrator's decision journal — history of all infrastructure decisions with context, options considered, outcomes, and lessons learned.

User invoked: `/integrator:journal $ARGUMENTS`

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js`. Cleanup at Final step.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:journal","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Parse arguments

Defaults if not specified:
- `--limit 10` — show last 10 entries
- `--scope project` — show project journal first, then global
- `--filter` — no filter, show all

Recognized filter tags (any combination):
- `#tool-add`, `#tool-remove`, `#tool-replace`, `#tool-update`
- `#conflict-resolution`, `#contract-design`, `#drift-fix`, `#error-fix`, `#rollback`
- `#research`, `#validation-tune`
- Tool name as tag (e.g., `--filter cc-sdd`)
- PMO zone (e.g., `--filter D2-Tech`)

### Step 2: Read journals

```
Project journal: .claude/integrator/project-journal.md (if exists)
Global journal:  ~/.claude/integrator/decision-journal.md (if exists)
```

If no journals exist:
```
No journal entries yet.

Integrator writes here after every modifying action (add/remove/update/debug).
Read-only commands (research, map, gaps) write summaries here too if they
result in user decisions.

Run /integrator:research <something> to create your first entry.
```

### Step 3: Apply filter

Parse markdown headings (`## DEC-INT-NNNN — title`) and frontmatter-like fields (Date, Trigger, Tag).

Filter logic:
- If `--filter <tag>`: keep entries whose `Tag:` line contains the tag
- If `--filter <tool>`: keep entries mentioning the tool in title, trigger, or "Tools affected"
- If `--filter <date-range>`: keep entries in date range (e.g., `2026-04` for April)

### Step 4: Format output

```
═══════════════════════════════════════════════════════════
INTEGRATOR JOURNAL
═══════════════════════════════════════════════════════════
Scope: <project|global|both>
Filter: <applied filters or "none">
Showing: <N> entries (most recent first)

───────────────────────────────────────────────────────────

DEC-INT-0042 — Replace custom-git-hooks with beads git-flow
  Date: 2026-04-18
  Trigger: /integrator:add beads
  Tag: #tool-add #conflict-resolution #git-flow
  
  Context: beads brings own git-hooks; conflicts with custom-git-hooks.
  
  Decision: Replace custom with beads (option 3).
  Outcome: ✓ Working since 2026-04-18, no regressions.
  Lessons: When adding tool with hooks, always pre-check .claude/hooks/.

───────────────────────────────────────────────────────────

DEC-INT-0041 — ...

───────────────────────────────────────────────────────────

Tip: /integrator:journal --filter <tag> for narrower view.
     /integrator:journal --limit 50 for more history.
```

### Step 5: Insights

If user asked for a broad view (no filter), at the end show:

```
INSIGHTS (last 30 days):
  Most active category: #tool-add (8 entries)
  Most touched tool: cc-sdd (3 add/update/debug actions)
  Failed actions: 1 (DEC-INT-0040 rolled back)
  
  Suggestion: 1 entry has #drift-fix label — consider running /integrator:verify.
```

Skip insights if `--filter` was used (focused query, not exploration).

### Final: Cleanup session marker

```bash
rm -f .claude/integrator/.session-context.json
```

## Important constraints

- **READ-ONLY.**
- **Don't lose entries.** Even abandoned/cancelled ones are kept (they're history).
- **Reverse chronological order.** Newest first.
- **Show full entry by default** (not just title) — user invoked journal because they want to read.
- **Limit-aware:** if `--limit 100` shows 87 entries, mention that's all there is.
