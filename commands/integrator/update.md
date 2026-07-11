---
description: Update an installed tool to a new version. Backup → install new → drift detection → contract repair → verify. Per SPEC §7.4 + DEC-DEV-0040 Q2 (kept in Phase 5, not Maintenance).
argument-hint: "<tool-name> [<target-version>] [--check-only] [--repair]"
---

# /integrator:update

User invoked: `/integrator:update $ARGUMENTS`

You are running the **version-bump + drift-repair flow** per `docs/integrator-module/SPEC.md §7.4`. Modifying command — has side effects.

**Scope (DEC-DEV-0040 Q2):** Phase 5 ships update flow. Drift detection algorithm is **minimum viable** in v1 (compare metadata + adapter body diff against repo HEAD); full schema-aware drift detection deferred to v1.1+ (Phase-7 kickoff cut, DEC-DEV-0176; the shared D1/D2/D3 lib now lives at `hooks/integrator/lib/drift-checks.cjs` — this Stage 3 stays inline for now).

## Process

Methodology: `.claude/skills/integrator/installation-protocol.md` (backup, rollback) + `.claude/skills/integrator/drift-detection.md` (drift heuristics).

### Pre-flight

**Session-context marker (DEC-DEV-0047 / patch 1.3.3):** activate `hooks/integrator/scope-guard.js` for this session. Cleanup in Final stage. Boilerplate spec: `skills/integrator/installation-protocol.md §10`.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:update","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

If tool not in `.claude/integrator/active-tools.yaml` → not installed, suggest `/integrator:add`. Exit.

**Refresh environment baseline (SPEC §13.1 — scan is Always-before any modifying action, G18):**
invoke `/integrator:scan` to refresh `.claude/integrator/baseline.yaml` before mutating anything.
Scan is read-only and cheap; a stale baseline hides user-zone changes made since the last scan,
so conflict/namespace checks below would run against fiction. Skip only in `--check-only` mode
if the baseline is fresher than the current session.

Determine **target version**:
- `<target-version>` in `$ARGUMENTS` → that exact version
- Else → query upstream registry for latest (npm: `npm view <pkg> version`; MCP: registry; git: `git ls-remote --tags`)

If target == installed version:
- **Default** → no-op, just refresh `last_verified` timestamps; exit with note. **But** if you suspect adapter drift (e.g. a recent `/ecosystem:update` advanced the pilot reference adapter while the installed instance lagged), tell the user to re-run with `--repair`.
- **`--repair` / `--drift-only`** → do NOT no-op. Same-version drift-repair mode: **skip Stage 2 (no new version to install)** and run Stage 1 (backup) → Stage 3 (drift detection) → Stage 4 (contract repair) → Stage 5 (verify) against the currently-installed version on both axes. This is the dual-location DEC-DEV-0040 case (FB-011, live-run RUN 01): the documented repair machinery must be reachable without a version bump. (`--check-only` still applies — `--repair --check-only` = detect + report, no mutation.)

### Stage 1/5 — Backup

Per skill Section 4:

1. Create `.claude/integrator/backups/<ISO-timestamp>/`
2. Backup `active-tools.yaml`, `pmo-mapping.yaml`, all `contracts/CNT-*.yaml|md` referencing this tool, `adapters/<adapter>.js` instances, `tool-docs/<tool>.md`
3. **Snapshot installed adapter metadata** — extract `@target_tool_version`, `@contract_schema_version`, `@source_ref`, `@installed_at` from each adapter header → save to `backups/<ts>/adapter-metadata.json`

### Stage 2/5 — Install new version

**If `--repair` (same-version drift mode): SKIP this stage entirely** — there is no new version to install. Leave `active-tools.yaml` `version_installed` unchanged and go straight to Stage 3, comparing the pilot reference adapter against the installed instance (D2/D3) at the current version.

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

**Check D2 — contract_schema_version mismatch (local-only post DEC-DEV-0044)**

Compare `CONTRACT_SCHEMA_VERSION` constant between **pilot-local reference** (`.claude/adapters/<adapter>.js`) and **installed instance** (`.claude/integrator/adapters/<adapter>.js`):

```bash
node -e "const m = require('fs').readFileSync(process.argv[1],'utf8').match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/); console.log(m ? m[1] : 'unknown')" .claude/adapters/<adapter>.js
node -e "const m = require('fs').readFileSync(process.argv[1],'utf8').match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/); console.log(m ? m[1] : 'unknown')" .claude/integrator/adapters/<adapter>.js
```

If installed schema < reference schema → 🔴 pilot reference evolved (e.g., last `/ecosystem:update` brought new schema); queue for repair.

If installed schema > reference schema → 🟡 installed is ahead (manual hack?); investigate before continuing.

**Check D3 — adapter body diff (header-stripped local comparison)**

Compare body of pilot reference vs installed instance — strip JSDoc metadata header (which legitimately differs between layers per dual-location semantics):

```bash
node -e "
const fs = require('fs');
function stripHeader(s) {
  s = s.replace(/\r\n/g, '\n');
  const idx = s.indexOf('const CONTRACT_SCHEMA_VERSION');
  return idx >= 0 ? s.slice(idx) : s;
}
const ref = stripHeader(fs.readFileSync(process.argv[1], 'utf8'));
const ins = stripHeader(fs.readFileSync(process.argv[2], 'utf8'));
if (ref === ins) { console.log('EMPTY'); process.exit(0); }
const refLines = ref.split('\n'), insLines = ins.split('\n');
let diff = 0, fnDriftHits = 0;
const fnRe = /function\s+(transformTo\w+Input|validateContract|parseFrontmatter|extractSections|slugify)\b/;
for (let i = 0; i < Math.max(refLines.length, insLines.length); i++) {
  if (refLines[i] !== insLines[i]) {
    diff++;
    if ((refLines[i] && fnRe.test(refLines[i])) || (insLines[i] && fnRe.test(insLines[i]))) fnDriftHits++;
  }
}
console.log('DIFF:' + diff + ' lines; fnDriftHits=' + fnDriftHits);
" .claude/adapters/<adapter>.js .claude/integrator/adapters/<adapter>.js
```

Categorize:
- `EMPTY` → ✅ no body drift
- `DIFF:N` with `fnDriftHits>0` → 🔴 functional drift in transform/validate/parse pipeline; queue for repair
- `DIFF:N` small (<10) with `fnDriftHits=0` → 🟡 cosmetic; metadata refresh sufficient
- `DIFF:N` large (≥10) with `fnDriftHits=0` → 🟡→🔴 escalate (structural change in data/strings)

**Note on `@source_ref`:** post DEC-DEV-0044 `@source_ref` is audit-only (tracks ecosystem repo commit at install time via `.claude/adapters/.sync-metadata.yaml`); no longer used as drift primary key. Cross-repo `git diff` removed.

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
   Project fixture path: .claude/adapters/fixtures/FM-FIXTURE-001-handoff.md  (deployed by bootstrap/update, DEC-DEV-0178; if missing, fall back to a real handoff from .product/handoffs/)
   REPAIR MODE: yes; existing CNT-NNN at .claude/integrator/contracts/CNT-NNN.yaml; reference adapter has evolved at <new-source-ref>; user-confirmed contract repair.
   ```

2. Subagent re-checks `.claude/adapters/` for matching reference adapter (per tri-location DEC-DEV-0040 Q1 refined):
   - Reference still matches → re-instantiate (copy new reference body + inject new metadata: `target_tool_version: <new>`, `source_ref: <last_synced_commit from .claude/adapters/.sync-metadata.yaml>`, `installed_at: <now>`)
   - Reference no longer matches new tool API → custom adapter (rare; subagent surfaces as open question)

3. Update CNT-NNN.yaml + companion .md:
   - `last_verified: null` (until Stage 5 passes)
   - `transformation.contract_schema_version: <new>`
   - Append to companion .md "Drift repair YYYY-MM-DD: <summary of changes>"

If subagent fails → mark contract status `broken`, surface to user, do NOT proceed to Stage 5 for that contract.

### Stage 5/5 — Verify

Run adapter `--verify-only` against fixture for each repaired contract:

```bash
node .claude/integrator/adapters/<adapter>.js --verify-only --fixture .claude/adapters/fixtures/FM-FIXTURE-001-handoff.md
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

### Final: Handoff staleness snapshot (G22)

After contract repair + verify, refresh the handoff-staleness baseline. An update can advance `.product/` artifacts (or the tool) such that previously-generated handoffs no longer match their embedded `artifact_hashes`; this records that so `/integrator:verify` and future consumers see current truth. Closes handoff-spec §10/§13 (drift recompute "при использовании handoff Integrator'ом при add/update") — the step that was previously missing here.

```bash
node .claude/hooks/integrator/lib/handoff-staleness.cjs --root . --write
```

Detect-only: recomputes each `.product/handoffs/*-handoff.md` embedded hash from `.product/` via the Product-zone hash SSOT (`.claude/hooks/product/lib/hash.js`) and persists the verdict to `.claude/integrator/handoff-staleness.yaml`. **Read-only w.r.t. `.product/`** (consistent with "NEVER touch `.product/`" — the `stale` flag lives in the Integrator zone). Exit always 0. Any handoff reported `stale` → suggest `/product:handoff <FM-id> --regenerate` (a Product Module action). No handoffs → no-op with a note.

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
🔄 Re-verify other features (manual): /integrator:verify
```

### Final: Cleanup session-context marker

```bash
rm -f .claude/integrator/.session-context.json
```

Also cleanup on rollback / failure paths. Stale marker = false-positive `scope-guard` warns until 1h TTL.

## Important constraints

- **`--check-only` mode never mutates state.** Useful for "what would change if I updated?"
- **`--repair` / `--drift-only` repairs same-version drift.** Runs detection + repair + verify when `target == installed` (skips Stage 2). This is the only path to fix dual-location adapter drift that arose without a tool version bump (e.g. `/ecosystem:update` advanced the reference adapter). Combine with `--check-only` to detect-and-report without mutating.
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
