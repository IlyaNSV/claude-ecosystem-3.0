---
description: Remove a tool from Integrator management. Impact analysis + backup + uninstall + cleanup contracts + update pmo-mapping. Destructive; requires explicit user confirmation.
argument-hint: "<tool-name> [--confirm]"
---

# /integrator:remove

User invoked: `/integrator:remove $ARGUMENTS`

You are running the **reverse of installation** per `docs/integrator-module/SPEC.md §3.2`. This is **destructive** — removes tool primitives, contracts, and adapter instances, then updates state files.

**No auto-removal of `.product/` artifacts** — Product Module's data is sacred. If `.product/handoffs/*-handoff.md` references this tool via `target_tool` — surface as a warning, do not modify handoffs.

## Process

Methodology shared with add-flow: `.claude/skills/integrator/installation-protocol.md` (load this skill — Section 4 Backup, Section 8 Rollback, **Section 10 session-context marker**).

### Pre-flight: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js` for this session. Cleanup in Final stage.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:remove","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Stage 1/5 — Locate tool

Read `.claude/integrator/active-tools.yaml`:
- If tool absent → idempotent no-op; ask user if they meant a different tool (per skill Section 6). Exit.
- If present → load entry; read full profile from `~/.claude/integrator/tool-catalog/<tool>.yaml`.

If `.claude/integrator/` missing entirely → tool can't have been installed under Integrator management; suggest user check what they meant. Exit.

### Stage 2/5 — Impact analysis

Build a removal impact report — surface BEFORE any destructive op:

**Affected contracts** (read `.claude/integrator/contracts/CNT-*.yaml`):
- Contracts where `producer == <tool>` or `consumer == <tool>` → list each with status
- For each affected contract, name the downstream tools it serves

**Affected PMO zones** (read `.claude/integrator/pmo-mapping.yaml`):
- Zones where `<tool>` in `covered_by[]` — after removal, will the zone become uncovered? Have a secondary?
- Zones where `<tool> == primary` AND no secondary → zone will become uncovered → list as 🟡 warning

**Affected `.claude/` primitives** (from profile `claude_primitives[]`):
- Commands, hooks, agents, skills, MCPs the tool installed
- Cross-check against current baseline — has user manually customized any? If yes → those edits will be lost (unless preserved via backup)

**Affected handoffs** (read `.product/handoffs/*-handoff.md` frontmatter):
- Handoffs where `target_tool == <tool>` or `target_adapter == <adapter-for-tool>` — these will become orphaned references. **DO NOT modify the handoffs.** Just list them as 🟡 warning.

Present the report to user as:

```
═══════════════════════════════════════════════════════════
REMOVAL IMPACT: <tool>@<version>
═══════════════════════════════════════════════════════════

CONTRACTS AFFECTED (N)
  CNT-001: <producer> → <consumer> (status: active)
    - Downstream impact: <description>

PMO ZONES AFFECTED (N)
  D2-T01 — Architecture Design
    Status: covered_by=[<tool>] → will become UNCOVERED (no secondary)
  D2-T06 — Task Decomposition
    Status: covered_by=[<tool>, other-tool] → other-tool becomes primary

.CLAUDE/ PRIMITIVES TO REMOVE (N)
  - .claude/commands/kiro/* (12 files)
  - .claude/agents/kiro-*
  ⚠ 1 file has user customization (since profile installed_at):
    .claude/hooks/git-flow.js — user-edited 2026-05-20

ORPHANED HANDOFF REFERENCES (N — informational, not modified)
  - .product/handoffs/FM-003-handoff.md (target_tool: cc-sdd)
  - .product/handoffs/FM-007-handoff.md (target_tool: cc-sdd)

GLOBAL CATALOG
  ~/.claude/integrator/tool-catalog/<tool>.yaml will be marked deprecated,
  not deleted (preserves cross-project research cache).

═══════════════════════════════════════════════════════════
```

### Stage 3/5 — Confirmation gate

```
Confirm removal? This is destructive. [y/n]
```

Or if user passed `--confirm` flag — skip prompt but still print impact report for journal record.

- `n` → exit cleanly; journal entry tag `#remove-cancelled` with impact snapshot for future reference
- `y` → proceed to Stage 4

**Hard boundary** — same as add-flow Stage 2 approve gate. No mutation outside skip-init backups before `y`.

### Stage 4/5 — Backup + uninstall

Per skill Section 4 (backup protocol):

1. **Create backup directory**: `.claude/integrator/backups/<ISO-timestamp>/`
2. **Backup state files**:
   - `cp .claude/integrator/active-tools.yaml backups/<ts>/`
   - `cp .claude/integrator/pmo-mapping.yaml backups/<ts>/`
3. **Backup affected contracts**: `cp .claude/integrator/contracts/CNT-NNN.* backups/<ts>/contracts/`
4. **Backup adapter instance**: `cp .claude/integrator/adapters/<adapter>.js backups/<ts>/adapters/`
5. **Backup user-customized primitive files** (if any flagged in Stage 2):
   ```bash
   cp --parents <user-customized-file> backups/<ts>/
   ```
6. **Backup tool-doc**: `cp .claude/integrator/tool-docs/<tool>.md backups/<ts>/tool-docs/`

Then execute uninstall:

1. **Package uninstall** per source type:
   - npm: `npm uninstall <pkg>` (or for npx-only tools: nothing to uninstall, just remove primitives)
   - MCP: remove entry from `.mcp.json` (or `.claude/settings.json` mcpServers)
   - git: `rm -rf <clone-target>` (per profile `claude_primitives[]` paths)
   - binary: per profile uninstall instructions
2. **Remove tool's `claude_primitives[]` files** that are NOT user-customized:
   - For each file in profile `claude_primitives[]`:
     - If user-customized → already backed up; ask user inline: replace with backup or delete?
     - Else → `rm <file>`

If any step fails → invoke rollback (skill Section 8): restore from `backups/<ts>/`, surface error, exit with diagnostics.

### Stage 5/5 — State cleanup

1. **Update `active-tools.yaml`** — remove tool entry
2. **Update `pmo-mapping.yaml`**:
   - For each affected zone: remove `<tool>` from `covered_by[]`
   - If `<tool>` was `primary` and `secondary[]` non-empty → promote `secondary[0]` to `primary`
   - If `<tool>` was sole `covered_by` → move zone to `uncovered:` block with `reason: "tool removed YYYY-MM-DD via /integrator:remove"`, severity per project tier defaults
3. **Remove affected contracts** — `rm .claude/integrator/contracts/CNT-NNN.*`. Append note to `.claude/integrator/project-journal.md` listing removed contract IDs (also covered by hook autolog).
4. **Remove adapter instance** — `rm .claude/integrator/adapters/<adapter>.js`. If repo reference at `adapters/<adapter>.js` is the only consumer of this tool — leave repo reference untouched (it's a library asset).
5. **Remove tool-doc** — `rm .claude/integrator/tool-docs/<tool>.md`
6. **Mark global profile deprecated** — append to `~/.claude/integrator/tool-catalog/<tool>.yaml` a `deprecated_in_projects:` list entry with project path + date (don't delete; profile may be reused in another project).

### Final: Journal entry + summary

Append to `.claude/integrator/project-journal.md`:

```markdown
## DEC-INT-NNNN — Removed: <tool>@<version>

**Date:** YYYY-MM-DD
**Trigger:** /integrator:remove <args>
**Tag:** #tool-remove #pmo-<zones-affected>

### Context
<why removed — gap closed, replaced by, scope cut, ...>

### Impact at removal time
- Contracts removed: <list>
- PMO zones now uncovered: <list>
- PMO zones promoted secondary→primary: <list>
- User-customized files preserved via backup: <list>
- Orphaned handoff references (not modified): <list>

### Backup location
.claude/integrator/backups/<ISO-timestamp>/

### Rollback procedure (if needed within 30 days)
1. Restore state files: `cp backups/<ts>/active-tools.yaml .claude/integrator/`
2. Restore state files: `cp backups/<ts>/pmo-mapping.yaml .claude/integrator/`
3. Restore contracts + adapters + tool-docs from backups/<ts>/
4. Re-install tool: `/integrator:add <tool>@<exact-version>`
5. Verify: `/integrator:verify` or `/integrator:status`

### Lessons
<if any — e.g., "removed because replaced by X" / "removed because pivot in scope" / "Removed prematurely; restore needed">
```

Summary to user:

```
✅ <tool>@<version> removed from Integrator management.
📁 Backup: .claude/integrator/backups/<ISO-timestamp>/
📝 Journal entry: DEC-INT-NNNN
⚠ Now uncovered PMO zones: <list> — consider /integrator:research for replacement
⚠ Orphaned handoff references (informational): <list> — re-run /product:handoff <FM-NNN> --regenerate if needed
```

### Final: Cleanup session-context marker

```bash
rm -f .claude/integrator/.session-context.json
```

Cleanup on rollback / cancellation paths too — stale marker = false-positive `scope-guard` warns until 1h TTL.

## Important constraints

- **NEVER modify `.product/`.** Including handoffs that reference the removed tool. Surface as warnings only.
- **Confirmation gate is HARD.** No `--yes-i-mean-it` superseding it without explicit `--confirm` flag from user.
- **Backup before destruction.** All affected files preserved in `.claude/integrator/backups/<ts>/` with directory structure preserved.
- **Global profile preservation.** Mark deprecated in catalog, never delete. Cross-project reuse is the catalog's value.
- **Idempotency** (per skill Section 6) — re-running on already-removed tool prompts user to confirm intent; no auto no-op without acknowledgement.

## Error handling

| Stage | Failure | Action |
|---|---|---|
| 1 | Tool not in active-tools | Ask user — typo? meant different tool? Exit. |
| 2 | Read error on contracts/pmo-mapping | Surface; fix-and-retry; do NOT proceed with partial impact analysis |
| 3 | User says `n` | Clean cancellation + journal #remove-cancelled with impact snapshot |
| 4 | Package uninstall fails | Restore from backup, surface diagnostics, exit |
| 4 | File rm fails (permissions?) | Restore, surface, exit |
| 5 | YAML write fails | Restore from backup, exit; do NOT leave half-modified state |
