---
description: Installation flow methodology — 6-stage add-flow shared logic (lazy-init, backup, conflict resolution, rollback). Used by /integrator:add, /integrator:remove (backup paths), /integrator:update (drift repair flow).
---

# Installation Protocol — Skill for Integrator

Shared methodology for installation lifecycle commands (`/integrator:add`, `/integrator:remove`, `/integrator:update`). Lives in this skill so command files stay focused on flow control + UX, and shared mechanics evolve in one place.

## When invoked

- `/integrator:add` — full 6-stage flow (profile → propose → install → configure → contract → verify)
- `/integrator:remove` — backup + impact analysis + uninstall (subset of stages, reverse direction)
- `/integrator:update` — backup + install new + drift detection + contract repair + verify

## Core mechanics

### 1. Lazy-init state (DEC-INT-O08)

`.claude/integrator/` is NOT created at `/ecosystem:bootstrap`. First modifying command in the project creates the skeleton:

```bash
mkdir -p .claude/integrator/{contracts,adapters,tool-docs,backups,secrets}
touch .claude/integrator/secrets/.gitkeep
```

Ensure `.gitignore` excludes `.claude/integrator/secrets/`. If not — append `\n.claude/integrator/secrets/\n` and inform user.

Read-only commands (`/integrator:research`, `:map`, `:gaps`, `:status`, `:journal`, `:scan`) do NOT create this — they reference global catalog only.

### 2. Global vs local state

| Layer | Path | Lifecycle |
|---|---|---|
| Global | `~/.claude/integrator/tool-catalog/<tool>.yaml` | Profile cache, reused across projects |
| Global | `~/.claude/integrator/decision-journal.md` | Cross-project lessons |
| Global | `~/.claude/integrator/research-cache/<date>-<slug>.md` | Research results, 7-day TTL |
| Global | `~/.claude/integrator/contract-templates/` | Generic templates per category |
| Local | `.claude/integrator/active-tools.yaml` | This project's installed set |
| Local | `.claude/integrator/pmo-mapping.yaml` | Per SPEC §4.3 schema |
| Local | `.claude/integrator/contracts/CNT-*.yaml + .md` | Active contracts |
| Local | `.claude/integrator/adapters/<adapter>.js` | Adapter instances (copied from repo `adapters/`) |
| Local | `.claude/integrator/tool-docs/<tool>.md` | Generated for future Orchestrator |
| Local | `.claude/integrator/baseline.yaml` | Environment scanner output |
| Local | `.claude/integrator/project-journal.md` | This project's decisions |
| Local | `.claude/integrator/backups/<ISO-timestamp>/` | Pre-modification backups |

Profile lookup order: local active-tools → global tool-catalog. Refresh global if local has more recent `last_verified`.

### 3. Environment Scanner integration (SPEC §13)

**Before** any destructive operation (Stage 3 of add-flow, install of update-flow, all of remove-flow):

1. If `.claude/integrator/baseline.yaml` missing OR older than 7 days → invoke `/integrator:scan` (or call its logic inline)
2. Read `baseline.user_customizations_to_preserve[]`
3. Cross-check against tool's `claude_primitives[]`:
   - Path matches `integrator_owned` → compatible upgrade (will overwrite, no user data loss)
   - Path matches `user_customizations_to_preserve` → 🔴 CONFLICT, present resolution options at approve gate
   - Path not present → safe, tool will create

**Heuristic for `integrator_owned` classification:** file resides in `.claude/{hooks,commands,agents,skills}/<module>/` AND a `hooks/<module>/manifest.yaml` (or analogous) declares it. Files in those dirs WITHOUT a module manifest declaration → `user_customizations_to_preserve`.

This prevents false-positives where `hooks/product/*.js` (ecosystem-owned per Product Module manifest) gets misclassified as user customization.

### 4. Backup protocol

Before any modification of files outside `.claude/integrator/`:

```bash
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=".claude/integrator/backups/$TS"
mkdir -p "$BACKUP_DIR"

# For each file about to be modified or replaced
cp --parents <file> "$BACKUP_DIR/"
```

Backup paths preserve original directory structure (`--parents`). Journal entry records `backup_dir: $BACKUP_DIR` so `/integrator:debug` can restore.

Backup retention: not auto-pruned in v1. Manual cleanup OK; document in user-facing skill output.

### 5. Conflict resolution at approve gate

Each conflict presented to user as a numbered choice:

```
🔴 Conflict 1/2: .claude/hooks/git-precommit.js
  Tool <tool> wants this path for its <purpose>.
  Currently: user-owned (per baseline, purpose: "<guess>")

  Options:
    [1] Replace user file with tool file (no backup of user file)
    [2] Skip tool file (if tool supports modular install)
    [3] Backup user file (→ backups/<ts>/) + use tool file [RECOMMENDED]
    [4] Abort installation
```

Record user's choice + timestamp in profile `conflicts[].decided_at` + journal entry.

### 6. Idempotency rules

Lifecycle commands must be re-runnable without side-effects when state already matches intent.

| Command | State to check | Idempotent response |
|---|---|---|
| `/integrator:add <tool>` | tool in active-tools.yaml + smoke OK | Skip Stages 1-5; re-run Stage 6 only (refresh `last_verified`) |
| `/integrator:add <tool>` | tool in active-tools.yaml, smoke FAIL | Resume from earliest failing stage |
| `/integrator:remove <tool>` | tool NOT in active-tools.yaml | Confirm with user (something else expected?); no-op |
| `/integrator:update <tool>` | installed version = target version | Refresh `last_verified`; check contract drift only |

active-tools.yaml is state-of-truth. Discrepancy between it and actual install (e.g., tool listed but binary missing) → flag inconsistency, do NOT auto-reconcile silently.

### 7. pmo-mapping.yaml updates per SPEC §4.3

When adding coverage:

```yaml
coverage:
  D2-T01:                              # canonical IDs only — no phantom IDs (DEC-DEV-0040)
    covered_by: [<tool>]
    primary: <tool>                    # set if first tool for this zone
    secondary: []                      # populate for OQ-I9 multi-tool scenarios
    confidence: high | medium | low
    evidence: "<brief why>"
    since: <YYYY-MM-DD>
    contracts: [CNT-NNN]
    notes: ""
```

When zone has `confidence: high` — `evidence` is mandatory (per SPEC §4.3 invariant). Without doc/test reference → degrade to `medium`.

**For boundary zones** (consumed via handoff, not owned by tool — e.g., D2-B02 for cc-sdd) — add a `boundary:` field:

```yaml
coverage:
  D2-B02:
    covered_by: [product-module]       # owner
    consumed_by: [cc-sdd]              # consumer via handoff
    primary: product-module
    confidence: high
    boundary: "Product Module owns Feature Specification; cc-sdd consumes via product-handoff → spec-init"
```

### 8. Rollback protocol

If any post-approve stage fails:

1. **Locate latest backup**: `.claude/integrator/backups/<latest-ts>/`
2. **Restore touched files** from backup
3. **Uninstall tool** if Stage 3 partially completed (`npm uninstall <pkg>` or equivalent)
4. **Revert active-tools.yaml + pmo-mapping.yaml** to pre-add state (use backups)
5. **Remove created CNT files** if Stage 5 partially completed
6. **Remove copied adapter instance** if Stage 5 partially completed
7. **Journal entry** with tag `#install-rollback` + reason + restored backup path
8. **Surface error to user** with rollback summary

Never leave state half-modified silently. If rollback itself fails → escalate immediately with explicit message: "Manual intervention needed; backup at <path>".

### 9. Journal autolog (Phase 5.F integration)

`hooks/integrator/journal-hook.js` PostToolUse matcher watches modifications to `.claude/integrator/{active-tools,pmo-mapping}.yaml`, `.claude/integrator/contracts/`. On match: appends entry to `.claude/integrator/project-journal.md` with action + tool + timestamp.

Skill-level concerns:
- Skill writes detailed rationale + lessons inline (free-form sections); hook autolog only captures the mechanical "what changed".
- Dedup: same `(action, tool, minute)` collapses to single entry in hook (prevents spam from cascade saves).
- Retention: > 500 entries → archive `_archive/journal-YYYY-MM.md` automatic.

### 10. Session-context marker (DEC-DEV-0047 / patch 1.3.3 / B-2)

Each `/integrator:*` command writes `.claude/integrator/.session-context.json` on entry (pre-flight Stage 0) and removes it on successful final exit. `hooks/integrator/scope-guard.js` reads the marker to know «is an Integrator command currently running?»; absent marker → hook is no-op, present marker + write to forbidden path → warn-only.

**Marker schema:**

```json
{
  "command": "/integrator:add",
  "started_at": "2026-05-27T15:30:00Z",
  "session_id": "<optional uuid>"
}
```

**Boilerplate per command — Stage 0 (pre-flight, before any side effect):**

```bash
mkdir -p .claude/integrator
cat > .claude/integrator/.session-context.json <<'JSON'
{
  "command": "/integrator:<name>",
  "started_at": "<ISO timestamp now>"
}
JSON
```

**Boilerplate per command — Final stage (post-success):**

```bash
rm -f .claude/integrator/.session-context.json
```

**Stale TTL (1 hour):** marker `started_at` older than 1h → hook treats as stale, removes marker, exits no-op (per `hooks/integrator/scope-guard.js`). `/ecosystem:verify` also surfaces stale markers as health-check finding.

**Why not env var:** slash commands are markdown — can't export environment variables per command invocation in Claude Code. Filesystem marker is the only persistent mechanism that survives between tool calls within a session.

**Why not transcript scanning:** brittle (path conventions vary), slow (large transcripts), fragile on Windows (path normalization).

**Failure modes:**
- Crash before Final-stage cleanup → marker stays → next session in <1h sees a stale marker → hook treats as stale per TTL, no false-positive warn on user-context writes.
- Two concurrent Integrator sessions (rare; solo dev typically) → marker is single-writer; later command overwrites; both will be cleaned on first successful exit. Acceptable for v1.
- Write to forbidden path immediately on marker creation (race) → unlikely (marker write itself doesn't trigger PreToolUse against forbidden paths because marker path = `.claude/integrator/.session-context.json` is whitelisted).

## Approve gates summary

| Stage | Gate? | Default if no answer |
|---|---|---|
| 1 Profile | No (read-only) | — |
| 2 Propose | **Yes** (hard boundary) | Abort |
| 3 Install | Inherited from Stage 2 | — |
| 4 Configure | Inherited from Stage 2 | — |
| 5 Contract | **Soft gate** if smoke FAIL (ask user before continuing) | Ask user |
| 6 Verify | No (mechanical pass/fail) | — |

Per-conflict gates (Section 5) nested inside Stage 2 — each conflict needs an explicit choice; no batch-approve in v1.

## Anti-patterns

1. **Auto-reinstall on inconsistency.** active-tools says installed but binary missing → ASK, don't silently `npm install` again.
2. **Skipping baseline refresh on update.** Tool primitives may have moved between versions; baseline >7 days old → re-scan.
3. **Backup-less mutation.** Even "small" config edits get backed up. Cost is negligible vs lost user state.
4. **Implicit approve.** Each conflict needs explicit user choice. "Continue with defaults" is NOT a default in v1.
5. **Cross-tool side effects.** `/integrator:add cc-sdd` must NOT touch `.product/` or `hooks/product/` or `.kiro/` or `.claude/docs/pmo/`. If tool wants those — surface as 🔴 conflict requiring scope clarification.
   - **Backed by runtime hook** (DEC-DEV-0047 / patch 1.3.3): `hooks/integrator/scope-guard.js` fires PreToolUse on Edit|Write|Bash if active Integrator session-context.json marker is present and tool targets a forbidden path. Hook is **warn-only** (stderr + PA entry) per ecosystem hook convention; hard-block deferred to v1.4.0+ (см. `dev/v1_1_backlog.md`). Hook complements skill discipline — both layers required, neither alone sufficient.
6. **Phantom PMO IDs in coverage.** Use canonical pmo-map.md IDs (DEC-DEV-0040). If a capability matches no existing ID — add a note in `pmo-mapping.yaml.coverage.<id>.notes` and surface to user; do NOT invent an ID.
7. **Bypassing journal hook.** If you write to `active-tools.yaml` via fs and the hook doesn't fire (e.g., direct `node fs.writeFile` bypassing Bash/Write/Edit tools) — manually append journal entry. Hook is augmentation, not single source of truth.
8. **Lost USER actions** (DEC-DEV-0047 / patch 1.3.3). Any «🚧 Требует USER» action surfaced during Stage 2 propose or Stage 3-5 install (signup, API key obtain, legal entity registration, manual UI config in 3rd-party admin) MUST be appended to `.claude/pending-actions.md` via `.claude/skills/ecosystem/user-action-tracker.md` skill. Source: `integrator`. Trigger: `/integrator:add "<args>"` or DEC-INT-NNN. Burying in narrative install report = silent gap for user.

## Cross-reference

- `docs/integrator-module/SPEC.md` §3.2 (command groups), §4.3 (pmo-mapping schema), §5.1 (contract schema), §7.2 (add UX narrative), §10 (file structure), §13 (Environment Scanner)
- `commands/integrator/add.md` — 6-stage flow, error matrix
- `commands/integrator/scan.md` — baseline.yaml generation
- `commands/integrator/remove.md` — backup + uninstall reverse flow (Phase 5.G)
- `commands/integrator/update.md` — drift detection + contract repair (Phase 5.H)
- `skills/integrator/tool-profiling.md` — Stage 1 profiling methodology
- `skills/integrator/contract-design.md` — Stage 5 contract design
- `agents/integrator/tool-profiler.md` — Stage 1 subagent
- `agents/integrator/contract-designer.md` — Stage 5 subagent
