---
description: How to append, mutate, and list pending user-action entries (PA-NNN) in .claude/pending-actions.md. Ecosystem-wide; any module can write.
---

# User-Action Tracker — Skill for Ecosystem

Per DEC-DEV-0047 / patch 1.3.3 deliverable B-3.

`.claude/pending-actions.md` is the ecosystem-wide markdown journal of pending user actions — things only the user can do (signups, API key obtain, legal entity registration, manual UI config in third-party admin). It's project-local, committed to git, and any Ecosystem module (Product / Design / Integrator / future modules) can append entries.

Hook `hooks/integrator/scope-guard.js` also writes to this file (one specific entry type) — that's intentional, single source-of-truth for «things the user must look at».

## When to use this skill

- Inside another skill / command that surfaces an action only the user can take → append PA entry.
- `/ecosystem:pending-actions` command reads + filters this file (read-only).
- `scope-guard.js` hook writes violation entries.

## File schema

```markdown
# Pending User Actions

> Auto-managed; entries appended by ecosystem skills + scope-guard hook.
> Status workflow: pending → done | dismissed. Manual mutation is fine; keep schema intact.

<!-- PA-000 sentinel ensures counter starts at 1 — do not delete -->

## PA-000 — Sentinel (do not delete)

**Status:** dismissed
**Created:** <bootstrap timestamp>
**Source:** ecosystem
**Trigger:** /ecosystem:bootstrap
**Action required:** none (placeholder so PA-NNN counter starts at 1)

---

## PA-NNN — <short title>

**Status:** pending | done | dismissed
**Created:** <ISO timestamp>
**Source:** integrator | product | design | ecosystem | <other module>
**Trigger:** /<module>:<command> "<args>"  or  DEC-<MODULE>-NNNN  or  <session id>
**Action required:** <one-line — what the user must do>

**Details:**

<free-form context — why action is needed, what unblocks>

**Blocking:** <what's blocked until done; empty if non-blocking>
```

## Protocol — appending a new entry

1. **Read current file** to find max existing `PA-NNN` ID via regex `^## PA-(\d+)\b`. If file missing — surface to user, suggest `/ecosystem:update` (file initialized by `/ecosystem:bootstrap` Step 6 — patch 1.3.3 sub-phase F).
2. **Compute next ID:** `max + 1`, padded to 3 digits (PA-001, PA-002, ..., PA-999, then 4 digits — no special handling needed; lexical sort breaks anyway after 999, that's fine for v1).
3. **Construct entry** using schema above. Use `date -u +%Y-%m-%dT%H:%M:%SZ` for timestamp. Source = invoking module; trigger = invoking command/decision/session reference.
4. **Append to file** with leading + trailing blank line for readability.
5. **No mid-file insertion** — always tail-append. Status changes mutate the entry's `Status:` field in-place.

**Atomic concerns:** solo-dev context (no concurrent writers); no locking. If patches accumulate concurrent writers, revisit (likely never in v1).

## Protocol — mutating status

Find entry by PA-NNN header; update `Status:` field. Optionally append a `**Resolution:** <date> — <one-line>` line below `**Blocking:**`. Do NOT delete entries — `dismissed` keeps history; deletion breaks PA-NNN counter audit trail.

## Protocol — listing / filtering

`/ecosystem:pending-actions` consumes this file. Default filter: `--status pending`. See `commands/ecosystem/pending-actions.md` for query semantics.

## Source values (canonical)

| Source | Module | When |
|---|---|---|
| `integrator` | Integrator | research → user must signup/etc; scope-guard violation |
| `product` | Product Module | discovery surface user need (e.g., user provides domain glossary terms) |
| `design` | Design Module | mockup approval; design-system asset upload |
| `ecosystem` | Ecosystem core | bootstrap/update; cross-module |
| `<custom>` | Per project | OK to extend if a third-party tool needs surface — document in `.claude/pending-actions.md` header |

## Trigger values (canonical formats)

- Slash-command: `/integrator:research "deploy stack"` — verbatim what user typed
- DEC-record: `DEC-INT-0073` — for decisions surfaced from journal entries
- Session: `<UUID>` — for hook-fired entries без slash-command source
- Decision-record (ecosystem): `DEC-DEV-NNNN` — for ecosystem-level concerns

## Anti-patterns

1. **In-line user actions in narrative output.** «After you install X, sign up for Y» is invisible 2 weeks later. Surface as PA entry; user can list via `/ecosystem:pending-actions`.
2. **Missing source field.** Always set; helps user understand which module is asking for the action.
3. **PA-NNN renumbering.** Never. IDs are permanent — even dismissed entries retain their ID.
4. **Direct deletion.** Status → `dismissed`, not delete; preserves audit trail.
5. **Action descriptions as paragraphs.** `Action required:` MUST be one-line summary. Free-form context goes in `**Details:**` block.
6. **Skip the sentinel.** PA-000 sentinel exists so first real entry is PA-001 (more memorable than PA-000-as-real-entry). Keep it.

## Integration touchpoints

- `skills/integrator/research-protocol.md` Phase 8 — appends PA per «🚧 Требует USER» action.
- `skills/integrator/installation-protocol.md` Anti-pattern #8 — same convention for install-time surface.
- `hooks/integrator/scope-guard.js` — appends PA on scope violation (dedup'd).
- `commands/ecosystem/bootstrap.md` Step 6 — initializes file with sentinel.
- `commands/ecosystem/update.md` — preserves user entries (idempotent merge).
- `commands/ecosystem/pending-actions.md` — read + filter UX.

## Example skill invocation (pseudocode)

```text
# Inside another skill that surfaces a user action:

1. Read .claude/pending-actions.md
2. Compute next PA-NNN
3. Construct entry per schema (source: integrator, trigger: /integrator:research "...",
   action: "Sign up for Hetzner; provision CX32 instance",
   details: "Recommended deploy stack ... uses Hetzner VPS;
            user must create account + add billing method before install")
4. Append to file (single tail-append, blank line before + after)
5. Report PA-NNN reference back to user inline:
   "Pending action logged: PA-007 — see /ecosystem:pending-actions to track"
```

## Failure modes

- File missing: surface to user, do NOT auto-create with side-effects beyond emitting hint. Bootstrap handles init.
- File present but unreadable (permissions): surface error, do NOT proceed; abort write.
- Concurrent append (rare; e.g., hook + skill simultaneously) — possible to drop one entry; not addressed v1.

## Versioning

Schema v1 (patch 1.3.3). Forward compat plan: if v2 adds fields (e.g., `**Severity:** low|med|high`), preserve unknown fields on mutation; readers fall back to known fields. No migration script — append-only.
