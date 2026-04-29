---
description: Manual cascade navigation. Show pending cascade entries from .pending/cascade-pending.yaml and resolve per-entry. Detection-only (V-11 auto-fix happens automatically via cascade-check.js hook).
argument-hint: "<artifact-id> | --pending | --pending --triggered-by <id> | --pending --revalidate | --pending --reset"
---

# /product:cascade

User invoked: `/product:cascade $ARGUMENTS`

Manual review and resolution of cascade pending entries collected by `cascade-check.js` hook (Phase 3.E). V-11 (bi-directional refs) auto-fix already applied automatically; this command resolves remaining `needs_review` and `needs_manual_fix` entries.

## Process

### Step 1: Parse arguments

- **`<artifact-id>`** (e.g., `BR-010`) — show entries triggered by this artifact:
  - Filter `cascade-pending.yaml.entries` where `triggered_by == <artifact-id>`
  - Group by dependent artifact
  - Per dependent: list applicable entries (rules + actions)

- **`--pending`** — show all pending entries:
  - Group by `triggered_by` source
  - Show summary: «<N> sources с pending cascades, <M> total entries»
  - Per source — option к invoke `/product:cascade <id>` или skip

- **`--pending --triggered-by <id>`** — explicit filter (alias к first form)

- **`--pending --revalidate`** — re-run cascade detection on all currently active artifacts:
  - Wipe `cascade-pending.yaml` entries
  - For each artifact в `.product/{features,scenarios,business-rules,lifecycles,verification,invariants}/*.md` со status: active:
    - Re-trigger cascade-check.js logic via Read+Write на тот же файл (no content change; hook fires on PostToolUse)
  - Result: pending file refreshed с current state. Stale entries from outdated logic / past bugs cleared.
  - Use case: после ecosystem upgrade или when accumulated entries don't match reality (e.g., DEC-DEV-0023 cascade-check fixes).

- **`--pending --reset`** — destructive cleanup (требует explicit confirmation):
  - Surface count: «<N> pending entries в cascade-pending.yaml. Reset will delete all без re-validation.»
  - Confirmation prompt: «Type 'reset' to confirm.»
  - Wipe `cascade-pending.yaml` к empty `entries: []` state.
  - Decision journal: `DEC-CASCADE-NNN — Manual reset cascade-pending (N entries cleared, reason: <user input>)`.
  - Use case: known-bad accumulation (e.g., legacy cascade-check pre-DEC-DEV-0023 false positives) where revalidate too slow OR entries irrelevant.

- **No args** — show usage:
  ```
  Usage:
    /product:cascade BR-010                # entries triggered by BR-010
    /product:cascade --pending             # all pending entries grouped by source
    /product:cascade --pending --revalidate # re-detect; clears stale entries safely
    /product:cascade --pending --reset      # nuke pending file (requires confirmation)
  ```

### Step 2: Read pending file

Path: `.product/.pending/cascade-pending.yaml` (managed by `cascade-check.js` hook).

If file missing or empty → surface: «No pending cascade entries. All up to date.»

### Step 3: Per-entry presentation

For each entry under filter:

```
Cascade entry from BR-010 → LC-002 (file: lifecycles/LC-002-revision.md):
  Rule: V-06
  Action: needs_review
  Detail: BR-010 referenced в LC-002.guards (transition reviewed → processed); 
          re-validate guard logic
  Triggered at: <ISO timestamp>

Options:
  [R] Re-validate inline — orchestrator re-runs validation against dependent
  [A] Re-approve dependent — bump dependent version, re-trigger downstream cascade
  [D] Dismiss — explicit rationale required (added к decision journal as DEC-CASCADE-NNN)
  [S] Skip — leave entry для later review
```

For `auto-fixed` entries — show as informational (already applied):
```
Cascade entry (auto-applied) BR-010 → SC-005:
  Rule: V-11
  Action: auto-fixed (no further action needed)
  Detail: Added BR-010 к SC-005.rules[] (was missing reverse ref)
  
  [continue]
```

### Step 3a: Bulk operations (--revalidate / --reset)

#### `--revalidate`

```
Re-running cascade detection across N active artifacts...
  ✓ Wiped cascade-pending.yaml (was: M entries)
  ✓ Triggered cascade-check on FM-001 (read+write touch — hook fires on PostToolUse)
  ... (per artifact)

Done. New pending state:
  <K> entries (real cascades from current artifact graph)

Compared к pre-revalidate (M):
  - <M-K> stale entries cleared
  - <K> real entries surfaced

Use /product:cascade --pending для resolution.
```

Implementation: read product config, list `.product/<dir>/*.md` со status: active in frontmatter. For each, perform `Read` followed by `Write` of same content (no semantic change; PostToolUse Write hook fires cascade-check.js logic against current file state). After loop, surface diff summary.

Note: `--revalidate` correctly handles DEC-DEV-0023 forward-driven logic (only real forward refs queued).

#### `--reset`

```
Found <N> pending cascade entries в .product/.pending/cascade-pending.yaml.

⚠ Reset is destructive — clears all entries без re-validation.
  Use --revalidate instead если want to refresh с current detection logic.

Continue? Type 'reset' to confirm:
> _

Reason for reset (logged к journal):
> _

Reset complete. cascade-pending.yaml — entries: [] empty.
Journal: DEC-CASCADE-NNN — Manual reset (N cleared, reason: ...)
```

Implementation: write `entries: []` to cascade-pending.yaml; append decision journal entry.

### Step 4: Action handlers

#### [R] Re-validate inline

For dependent artifact:
- Re-read frontmatter + body
- Apply applicable V-* rules per current `validation_tier`
- If passes → resolve entry (remove from pending)
- If fails → surface findings, prompt user: act / defer / dismiss

#### [A] Re-approve dependent

- Bump dependent.version++
- Update dependent.updated = today
- Trigger cascade-check.js for dependent (downstream effects propagate)
- Decision journal entry: «DEC-CASCADE-NNN — Re-approved <ID> after <triggered_by> change»

#### [D] Dismiss с rationale

```
Dismissing entry requires rationale (anti-sycophancy mechanism per devils-advocate.md).

Reason для dismissing this cascade finding?
> <user input>

Will create journal entry:
  DEC-CASCADE-NNN — Dismissed cascade finding for <ID>
  Triggered by: <source>
  Rule: <rule>
  Reason: <user rationale>
```

After confirmation → remove entry from pending; append journal entry.

#### [S] Skip

Entry remains в pending file. Surfaces again на next `/product:cascade` или `/product:status`.

### Step 5: After all filtered entries resolved

- Remove resolved entries from `.product/.pending/cascade-pending.yaml`
- If file empty → option to delete (or keep с empty `entries:` list для consistency)
- Decision journal entry batch: «DEC-CASCADE-NNN — Resolved <N> cascade entries (triggered by <source>)»

### Step 6: Summary

```
Cascade resolution complete для <source artifact-id>:
  ✓ <N> entries re-validated and passed
  ✓ <M> entries dismissed с rationale
  ⚠ <K> entries deferred (still в pending)

Pending в queue: <total remaining>
Use /product:cascade --pending для full overview.
```

## Important constraints

- **Detection-only scope в v1.** V-11 auto-fix already applied automatically via hook. Other rules (V-06, V-07, V-08, etc.) require manual review per entry. Full BFS auto-fix beyond V-11 deferred к v1.1 (per DEC-DEV-0012 C.4 + dev/v1_1_backlog.md).

- **No bundle approve UX в v1.** Per-entry resolution. Bundle approve UX deferred к v1.1 with full BFS expansion.

- **Dismissal требует rationale.** Anti-sycophancy mechanism — cannot silently dismiss findings; journal entry mandatory.

- **Pending file owned by cascade-check.js hook + this command.** Manual edits cause drift. Use this command для all changes.

- **Quiet draft mode preserved.** Если dependent в draft — V-11 was queued (not auto-fixed); this command shows entries для manual fix when user resolves drafts.

## Error handling

| Error | Action |
|---|---|
| `cascade-pending.yaml` not found | Surface «No pending cascade entries» — exit cleanly |
| `<artifact-id>` not present в any entries | Surface «No cascade entries triggered by <id>» |
| User dismisses без rationale | Refuse, prompt again |
| Re-validate fails (dependent file unreadable) | Skip entry, log warning, continue к next |
| Atomic write to pending file fails | Surface error, advise manual edit / retry |

## Related

- Hook: [`hooks/product/cascade-check.js`](../../hooks/product/cascade-check.js) (Phase 3.E — produces pending entries)
- Skill: [`skills/product/cascade-protocol.md`](../../skills/product/cascade-protocol.md) (Phase 3.D — methodology)
- Process: [docs/pmo/processes.md §3.5 P4 Cascade Consistency](../../docs/pmo/processes.md), §4
- Validation: [docs/pmo/validation.md §6 Cascade Protocol](../../docs/pmo/validation.md)
- Companion commands:
  - `/product:status` — overview включая «Cascade pending: <N>» summary
  - `/product:bg-review` — analogous batch review для BG candidates
- Future v1.1: full BFS auto-fix + bundle approve UX per [dev/v1_1_backlog.md](../../dev/v1_1_backlog.md)
