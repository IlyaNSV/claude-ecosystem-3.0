---
description: Update an installed tool to a new version. Backup → install new → drift detection → contract repair → verify. Per SPEC §7.4 + DEC-DEV-0040 Q2 (kept in Phase 5, not Maintenance).
argument-hint: "<tool-name> [<target-version>] [--check-only]"
---

# /integrator:update

User invoked: `/integrator:update $ARGUMENTS`

You are running the **version-bump + drift-repair flow** per `docs/integrator-module/SPEC.md §7.4`. Modifying command — has side effects.

**Scope (DEC-DEV-0040 Q2):** Phase 5 ships update flow. Drift detection algorithm is **minimum viable** in v1 (compare metadata + adapter body diff against repo HEAD); full schema-aware drift detection deferred to Phase 7.

## Process

Methodology: `.claude/skills/integrator/installation-protocol.md` (backup, rollback) + `.claude/skills/integrator/drift-detection.md` (drift heuristics).

### Pre-flight

If tool not in `.claude/integrator/active-tools.yaml` → not installed, suggest `/integrator:add`. Exit.

Determine **target version**:
- `<target-version>` in `$ARGUMENTS` → that exact version
- Else → query upstream registry for latest (npm: `npm view <pkg> version`; MCP: registry; git: `git ls-remote --tags`)

If target == installed version → no-op, just refresh `last_verified` timestamps; exit with note.

### Stage 1/5 — Backup

Per skill Section 4:

1. Create `.claude/integrator/backups/<ISO-timestamp>/`
2. Backup `active-tools.yaml`, `pmo-mapping.yaml`, all `contracts/CNT-*.yaml|md` referencing this tool, `adapters/<adapter>.js` instances, `tool-docs/<tool>.md`
3. **Snapshot installed adapter metadata** — extract `@target_tool_version`, `@contract_schema_version`, `@source_ref`, `@installed_at` from each adapter header → save to `backups/<ts>/adapter-metadata.json`

### Stage 2/5 — Install new version

Same install command as add-flow Stage 3, but with new version spec:
- npm: `npx <tool>@<target-version> <init-flags-from-profile>` (or `npm install <pkg>@<target>` if globally tracked)
- MCP: update `.mcp.json` version pin + restart MCP server
- git: `git fetch && git checkout <target-tag>`

Verify install: same smoke as add-flow (`/kiro:steering` present, command count matches, etc.). If smoke FAIL → rollback (skill Section 8), exit.

Update `active-tools.yaml`: `version_installed: <target-version>`, `installed_at: <new-iso>` (preserve original `installed_at` as `first_installed_at`).

### Stage 3/5 — Drift detection

Per `drift-detection.md` skill. Three checks per affected contract:

**Check D1 — semver range compatibility**

Compare adapter's `@target_tool_version` (e.g., `^2.1.0`) against new tool version (e.g., `2.3.0`):
- In-range → ✅ no drift on version axis
- Out-of-range (e.g., `^2.1.0` adapter vs `3.0.0` tool) → 🔴 likely breaking; queue for repair

**Check D2 — contract_schema_version diff against repo HEAD**

```bash
node -e "const m = require('fs').readFileSync('adapters/handoff-to-ccsdd.js','utf8').match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/); console.log(m[1])"
node -e "const m = require('fs').readFileSync('.claude/integrator/adapters/handoff-to-ccsdd.js','utf8').match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/); console.log(m[1])"
```

If installed schema < repo schema → 🔴 reference adapter has evolved; contract output shape may differ. Queue for repair.

If installed schema > repo schema → 🟡 installed is ahead (manual edit?); investigate before continuing.

**Check D3 — adapter body diff against repo reference at source_ref**

```bash
git --no-pager diff <source_ref> HEAD -- adapters/<adapter>.js
```

(`source_ref` from installed adapter metadata is the repo commit at install time.)

Categorize diff:
- Empty diff → ✅ no body drift
- Diff in transformation logic (parseFrontmatter / extractSections / transformTo*Input) → 🔴 functional drift; queue for repair
- Diff only in comments / metadata → 🟡 cosmetic; bump source_ref but skip repair

Aggregate drift report:

```
DRIFT DETECTION RESULTS for <tool> <old-version> → <new-version>

CNT-001 (product-handoff → cc-sdd /kiro:spec-init)
  D1 semver: ^2.1.0 vs 2.3.0 → IN-RANGE ✅
  D2 schema: installed=1 repo=1 → MATCH ✅
  D3 body diff: 12 lines changed in transformation logic → 🔴 BREAKING

Summary: 1 contract needs repair (CNT-001)
```

If `--check-only` flag → present report and exit; no repair attempted.

### Stage 4/5 — Contract repair (if drift detected)

For each contract flagged as breaking in Stage 3:

1. **Spawn `contract-designer` subagent** (`.claude/agents/integrator/contract-designer.md`) with brief:
   ```
   Producer: <from CNT.producer>
   Consumer: <from CNT.consumer>
   Producer artifact: <CNT.data_flow.from.artifact + fixture path>
   Consumer input: <from updated tool profile inputs[]>
   Existing contracts (dedup): [<this CNT itself; subagent updates in place>]
   PMO zone(s) tying these tools: <from updated pmo-mapping>
   Available MCPs: <enumerate>
   Project fixture path: tests/fixtures/FM-FIXTURE-001-handoff.md
   REPAIR MODE: yes; existing CNT-NNN at .claude/integrator/contracts/CNT-NNN.yaml; reference adapter has evolved at <new-source-ref>; user-confirmed contract repair.
   ```

2. Subagent re-checks `adapters/` for matching reference adapter:
   - Reference still matches → re-instantiate (copy new reference body + inject new metadata: `target_tool_version: <new>`, `source_ref: <repo HEAD>`, `installed_at: <now>`)
   - Reference no longer matches new tool API → custom adapter (rare; subagent surfaces as open question)

3. Update CNT-NNN.yaml + companion .md:
   - `last_verified: null` (until Stage 5 passes)
   - `transformation.contract_schema_version: <new>`
   - Append to companion .md "Drift repair YYYY-MM-DD: <summary of changes>"

If subagent fails → mark contract status `broken`, surface to user, do NOT proceed to Stage 5 for that contract.

### Stage 5/5 — Verify

Run adapter `--verify-only` against fixture for each repaired contract:

```bash
node .claude/integrator/adapters/<adapter>.js --verify-only --fixture tests/fixtures/FM-FIXTURE-001-handoff.md
```

If exit 0:
- Update CNT.last_verified to now
- Update CNT.status to `active`
- Regenerate `tool-docs/<tool>.md` via `.claude/skills/integrator/tool-docs-generator.md` skill (preserves manual blocks per SPEC §14.4)

If exit ≠ 0:
- Mark contract `broken`
- Surface adapter output verbatim
- Offer rollback to pre-update state from `backups/<ts>/`
- Exit with diagnostics

### Final: Journal entry + summary

Append to `.claude/integrator/project-journal.md`:

```markdown
## DEC-INT-NNNN — Updated: <tool> <old-version> → <new-version>

**Date:** YYYY-MM-DD
**Trigger:** /integrator:update <args>
**Tag:** #tool-update #drift-<detected|none>

### Context
<why updated — security, new feature, scheduled refresh>

### Pre-update state
<adapter metadata snapshot from backups/<ts>/adapter-metadata.json>

### Drift detected
| Contract | D1 semver | D2 schema | D3 body diff | Action |
|---|---|---|---|---|
| CNT-001 | in-range | match | 12-line transform diff | repaired |

### Repair summary
<from contract-designer subagent output>

### Verify outcome
- CNT-001: PASS (verify-only smoke exit 0)
- ...

### Backup
.claude/integrator/backups/<ISO-timestamp>/

### Rollback procedure (within 30 days)
1. Uninstall new version: `npm uninstall <pkg>` (or analogous)
2. Restore active-tools.yaml + pmo-mapping.yaml from backups/<ts>/
3. Restore contracts + adapters from backups/<ts>/
4. Re-install old version: `/integrator:add <tool>@<old-version>`

### Lessons
<what schema/API changes broke; pattern to watch in future updates>
```

Summary to user:

```
✅ <tool> updated <old> → <new>.
🔍 Drift: <N contracts repaired> | <N unchanged>
📝 Journal: DEC-INT-NNNN
📁 Backup: .claude/integrator/backups/<ISO-timestamp>/
🔄 Re-verify other features (manual): /integrator:verify (Phase 7, when available)
```

## Important constraints

- **`--check-only` mode never mutates state.** Useful for "what would change if I updated?"
- **Backup before every modification** — adapter metadata snapshot in Stage 1 enables reliable rollback.
- **Contract repair is per-contract** — partial success allowed (some contracts repair OK, others marked broken).
- **Never silently downgrade.** If target < installed, refuse and require explicit `--allow-downgrade` flag (deferred to v1.1; for now: refuse).
- **NEVER touch `.product/`.** Updated tool may produce different artifacts; that's downstream concern, not update-flow scope.

## Error handling

| Stage | Failure | Action |
|---|---|---|
| Pre-flight | tool not installed | Suggest /integrator:add; exit |
| 1 | Backup fails | Refuse to proceed (no fallback safety net); surface error |
| 2 | Install fails | Rollback via backup; exit |
| 3 | Drift detection internal error | Surface; recommend manual diff; do NOT proceed to repair blindly |
| 4 | Subagent / repair fails | Mark affected contracts broken; surface; offer rollback |
| 5 | Verify fails | Mark broken; offer rollback; exit with adapter output |
