---
description: Sync Ecosystem 3.0 to latest upstream version в existing project. Overwrites ecosystem zone (commands/skills/agents/hooks/docs/templates), preserves user zone (settings.local.json, product.yaml, .env, .product/). For greenfield install — use /ecosystem:bootstrap instead.
argument-hint: "[--offline] [--dry-run] [--force] [--no-backup]"
---

# /ecosystem:update

**Precondition:** ecosystem already installed в current project (i.e. `.claude/` has ecosystem signature). Для greenfield → use `/ecosystem:bootstrap`.

**What it does:** syncs existing `.claude/` к latest upstream Ecosystem 3.0:
- **Overwrites** ecosystem zone (commands/, skills/, agents/, hooks/, docs/, templates/, output-styles/, root references)
- **Removes** obsolete files в ecosystem subdirs (commands/skills/etc. that no longer exist upstream)
- **Re-derives** hooks section в settings.json from new manifest
- **Preserves** user zone (settings.local.json, product.yaml, .env, integrator/ state, all Claude Code auto-files)
- **Never copies** dev-only files (root CLAUDE.md, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md)
- **Backs up** `.claude/` → `.claude-backup-<timestamp>/` before any changes

User invoked: `/ecosystem:update $ARGUMENTS`

## Why this exists

Per [DEC-DEV-0019](../../DEV_JOURNAL.md), `/ecosystem:bootstrap` was designed для greenfield install. Re-running it on existing project has 4 architectural issues (Findings A-D):

- **A — dev contamination:** root CLAUDE.md, DEV_JOURNAL.md, dev/ folder copy into `.claude/` (CLAUDE.md misleads future sessions)
- **B — additive only:** `cp -rn` does not update existing files; bug fixes / SPEC updates / refactored hooks don't propagate
- **C — manifest preservation:** new hooks installed but unregistered (silent failure)
- **D — UX gap:** re-install default = (a) abort, не (b) merge

`/ecosystem:update` solves all 4 architecturally:
- **A:** allowlist-only copy; never-copy zone explicit
- **B:** rsync-style sync (delete obsolete + copy fresh)
- **C:** manifest.yaml в ecosystem zone → overwritten; hooks section re-derived from new manifest
- **D:** dedicated command для explicit «I want to update» intent

## Flags

- `--offline` — use local cache `~/.claude/ecosystem/` instead of fresh git clone
- `--dry-run` — preview changes without applying (RECOMMENDED for first run)
- `--force` — skip confirmations
- `--no-backup` — skip `.claude-backup-<timestamp>/` step (faster, riskier)

## Quick install — permission modes

Same as `/ecosystem:bootstrap` Quick install section. Recommended:
- **Mode A (bypass):** exit + `claude --dangerously-skip-permissions` + `/ecosystem:update` + relaunch normally
- **Mode B (interactive):** assumes pre-staged allowlist (already в `.claude/settings.local.json` from initial bootstrap)

## Execution sequence

### Step 1: Verify ecosystem signature

Check **all three** present:
- `.claude/docs/pmo/pmo-map.md`
- `.claude/commands/ecosystem/bootstrap.md`
- `.claude/docs/integrator-module/SPEC.md`

**If ANY missing** — this is NOT existing ecosystem install. Abort с message:

> `/ecosystem:update` is для existing ecosystem installs. Detected missing: <list>. Either:
> - Greenfield install → `/ecosystem:bootstrap`
> - Restore from backup → check `.claude-backup-*` directories
> - Manual recovery → `git clone https://github.com/IlyaNSV/claude-ecosystem-3.0.git`

**If all present** → proceed.

### Step 2: Backup `.claude/` + integrator-managed external paths (unless `--no-backup`)

**Phase 2a — `.claude/` snapshot:**

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=".claude-backup-${TIMESTAMP}"
cp -r .claude "${BACKUP_DIR}"
```

**Phase 2b — Integrator-managed external paths** (DEC-DEV-0051 / patch 1.3.5):

If `.claude/integrator/active-tools.yaml` exists и parseable — read `tools[*].claude_primitives[].path` entries. For each path that **falls outside `.claude/`** (e.g. `.kiro/`, `.beads/`, etc.) — backup separately under `${BACKUP_DIR}/_external/<path>` preserving relative structure:

```bash
if [ -f .claude/integrator/active-tools.yaml ]; then
  EXTERNAL_PATHS=$(parse_yaml_external_primitives .claude/integrator/active-tools.yaml)
  # EXTERNAL_PATHS = unique sorted list of claude_primitives[].path entries
  # NOT starting with '.claude/'. Implementation: yq/grep + dedup + filter.

  if [ -n "$EXTERNAL_PATHS" ]; then
    mkdir -p "${BACKUP_DIR}/_external"
    for P in $EXTERNAL_PATHS; do
      if [ -e "$P" ]; then
        PARENT=$(dirname "${BACKUP_DIR}/_external/$P")
        mkdir -p "$PARENT"
        cp -r "$P" "${BACKUP_DIR}/_external/$P"
      fi
    done

    # Manifest listing what was backed up (для rollback orientation)
    cat > "${BACKUP_DIR}/_external/MANIFEST.yaml" <<EOF
# Backed up by /ecosystem:update Step 2b (DEC-DEV-0051).
# These paths are integrator-managed primitives outside .claude/.
# Restored via: cp -r "${BACKUP_DIR}/_external/<path>" "<path>"
backup_timestamp: ${TIMESTAMP}
source_file: .claude/integrator/active-tools.yaml
external_paths:
$(echo "$EXTERNAL_PATHS" | sed 's/^/  - /')
EOF
  fi
fi

echo "Backup: ${BACKUP_DIR}"
echo "  - .claude/ snapshot"
echo "  - _external/ (N integrator-managed paths outside .claude/, per active-tools.yaml)"
```

**PowerShell equivalent (Windows):**

```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = ".claude-backup-$timestamp"
Copy-Item -Path .claude -Destination $backupDir -Recurse

if (Test-Path ".claude\integrator\active-tools.yaml") {
  # Parse active-tools.yaml, extract claude_primitives[].path values not starting with '.claude/'
  # Implementation depends on available YAML tooling; ConvertFrom-Yaml (if module loaded) or regex fallback
  $externalPaths = Get-IntegratorExternalPrimitives ".claude\integrator\active-tools.yaml"
  if ($externalPaths.Count -gt 0) {
    $extDir = Join-Path $backupDir "_external"
    New-Item -ItemType Directory -Path $extDir -Force | Out-Null
    foreach ($p in $externalPaths) {
      if (Test-Path $p) {
        $dest = Join-Path $extDir $p
        $parent = Split-Path $dest -Parent
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Copy-Item -Path $p -Destination $dest -Recurse
      }
    }
    # Write MANIFEST.yaml (same content as bash variant)
  }
}
Write-Host "Backup: $backupDir"
```

**Why Phase 2b** (DEC-DEV-0051): pre-1.3.5 backup захватывал только `.claude/`. Integrator-installed tools часто размещают artifacts outside `.claude/` (cc-sdd → `.kiro/specs/`, `.kiro/steering/`, `.kiro/templates/`; beads → `.beads/`). При rollback после неудачного update эти paths не восстанавливались. Pattern aligns с Step 5 namespace-selective sync (DEC-DEV-0051 same patch): full Integrator-managed footprint должна выживать update'ы.

If `--no-backup` → skip both phases с warning «User responsible для recovery if update fails». Default = backup (cautious).

**`.product/` is never touched** regardless of backup choice — артефакты outside `.claude/`. Backup'ить `.product/` НЕ нужно (update в принципе не пишет туда; integrator install paths не пересекаются).

### Step 3: Clone upstream к temp

#### 3a. Online (default)

```bash
git clone --depth 1 https://github.com/IlyaNSV/claude-ecosystem-3.0.git .claude-ecosystem-tmp

# Capture HEAD before stripping .git (used in Step 5 to stamp .claude/adapters/.sync-metadata.yaml per DEC-DEV-0044)
ECOSYSTEM_HEAD=$(git -C .claude-ecosystem-tmp rev-parse HEAD)

rm -rf .claude-ecosystem-tmp/.git
```

#### 3b. Offline (`--offline`)

```bash
# Capture HEAD from global cache before staging
ECOSYSTEM_HEAD=$(git -C ~/.claude/ecosystem rev-parse HEAD 2>/dev/null || echo "unknown")

cp -r ~/.claude/ecosystem .claude-ecosystem-tmp
rm -rf .claude-ecosystem-tmp/.git
```

### Step 4: Compute changeset (preview если `--dry-run`)

**Ecosystem-zone allowlist:**

| Type | Items |
|---|---|
| **Subdirs** (sync с delete) | `commands/`, `skills/`, `agents/`, `hooks/`, `docs/`, `templates/`, `adapters/`, `output-styles/` (если exists) |
| **Root files** (overwrite) | `README.md`, `BOOTSTRAP.md`, `CHANGELOG.md`, `ROADMAP.md`, `install.sh`, `install.ps1`, `.env.template`, `gitignore.template` |

**Never-copy zone (explicitly skip — never enter `.claude/`):**

| Item | Why |
|---|---|
| `CLAUDE.md` (root) | Ecosystem developer's; would mislead future Claude sessions |
| `DEV_JOURNAL.md` | Ecosystem dev's decision log |
| `dev/` (entire dir) | Internal phase docs, meta-improvement, archives |
| `INSTALL-HUMAN.md` | Pre-install guide для humans (not для running ecosystem) |
| `package.json`, `package-lock.json`, `eslint.config.js`, `node_modules/` | Hook lint pipeline (ecosystem-dev only — DEC-DEV-0023; user projects не нуждаются в npm) |
| `.git/` | Already removed from temp в Step 3 |
| `.gitignore`, `.gitattributes` (root) | Project's own |
| Any other root files (e.g., LICENSE) | Not ecosystem-managed |

**User zone (preserved verbatim):**

- `.claude/settings.local.json` — user's permission approvals
- `.claude/settings.json` (hooks section re-derived; permissions + other fields preserved — see Step 6)
- `.claude/product.yaml` — project config
- `.claude/design.yaml` (if exists) — per-project Design Module config (DEC-DEV-0052 / Phase 6 1.4.0); preserved verbatim per «not в Step 5 root-file allowlist» semantics — same treatment как `settings.local.json` (auto-init via `/design:start` на первой UI FM; user edits never wiped by upgrade)
- `.claude/pending-actions.md` (if exists) — ecosystem-wide PA journal (DEC-DEV-0047 / patch 1.3.3); user entries preserved verbatim; init backfilled in Step 5b if missing
- `.claude/integrator/` (если exists) — Integrator project state
- `.claude/.env` (если exists; usually .env at project root) — secrets
- `.claude/projects/`, `todos/`, `statsig/`, `shell-snapshots/`, `ide/`, `plugins/` — Claude Code auto-files
- `.product/` — entire (outside `.claude/`)
- Any other user-added files в `.claude/` outside ecosystem-zone subdirs

**Diff computation per allowlisted subdir** (namespace-aware — DEC-DEV-0051 / patch 1.3.5):

Subdirs split into two classes:

| Subdir class | Subdirs | Semantics |
|---|---|---|
| **Namespace-aware** (third-party namespaces possible) | `commands/`, `skills/`, `agents/`, `hooks/` | Manage только ecosystem-owned namespaces (`{product, integrator, ecosystem, design}` — discovered dynamically from `.claude-ecosystem-tmp/<subdir>/` immediate children). Non-managed namespaces (e.g. `.claude/skills/kiro-*/` от cc-sdd) preserved untouched. |
| **Flat** (no third-party expected) | `docs/`, `templates/`, `adapters/`, `output-styles/` | Full subdir sync (delete obsolete + copy fresh). Если third-party tool пишет сюда — он breaks ecosystem convention; not supported. |

**Per namespace-aware subdir:**
- **Managed namespaces:** immediate children of `.claude-ecosystem-tmp/<subdir>/` (e.g. для `skills/`: `ecosystem/`, `integrator/`, `product/` + `design/` post-Phase-6).
- **To re-sync:** for each managed namespace N, compute diff `.claude/<subdir>/N` vs `.claude-ecosystem-tmp/<subdir>/N` (add/remove/update files inside N).
- **Preserved (untouched):** any other children of `.claude/<subdir>/` (third-party namespaces или flat files). Не trim'ятся, не overwrite'ятся.

**Per flat subdir:**
- **To remove:** files в `.claude/<subdir>/` but NOT в `.claude-ecosystem-tmp/<subdir>/`
- **To add:** files в `.claude-ecosystem-tmp/<subdir>/` but NOT в `.claude/<subdir>/`
- **To update:** files в both, content differs

For root files в allowlist:
- **To add:** file в upstream но NOT в `.claude/`
- **To update:** file в both, content differs

**Integrator-managed audit (optional)** — если `.claude/integrator/active-tools.yaml` available и parseable, label preserved non-managed namespaces in print preview by owning tool. Read-only consultation, не блокирует diff computation.

**Obsolete contamination detection (post-DEC-DEV-0019 cleanup, per DEC-DEV-0042):**

Older bootstrap implementations (before Path Y was codified) used `cp -rn` from a full clone and accidentally placed never-copy-zone items inside `.claude/`. The rsync-with-delete loop above operates **only inside allowlisted subdirs**, so such items survive forever otherwise. This pass surfaces and removes them.

**Closed list — these are removed from `.claude/` if present** (never invented; never extended at runtime):

| Path | Reason it shouldn't be in `.claude/` |
|---|---|
| `.claude/CLAUDE.md` | Ecosystem developer's root CLAUDE.md; project's own CLAUDE.md lives at project root, not inside `.claude/` |
| `.claude/DEV_JOURNAL.md` | Ecosystem dev's decision log; never relevant to consumer projects |
| `.claude/dev/` | Internal phase docs / meta-improvement / archives — ecosystem-dev-only |
| `.claude/INSTALL-HUMAN.md` | Pre-install guide for humans; not for running ecosystem |
| `.claude/package.json`, `.claude/package-lock.json`, `.claude/eslint.config.js`, `.claude/node_modules/` | Hook lint pipeline — ecosystem-dev-only (DEC-DEV-0023) |

**Out of scope** (NEVER auto-removed — may be the project's own):
- `.claude/.gitignore`, `.claude/.gitattributes` — project may have customised these
- `.claude/LICENSE` and any other non-listed root file — not ecosystem-managed
- Anything outside the closed list above

If a path is present и matches the closed list → mark for removal in the changeset.

**Print preview:**

```
Changeset preview:
  Namespace-aware subdirs (managed ecosystem namespaces only):
    commands/  — managed: {ecosystem, integrator, product} → N added, M removed, K updated
               — preserved namespaces (third-party): none
    skills/    — managed: {ecosystem, integrator, product} → N added, M removed, K updated
               — preserved namespaces (third-party): kiro-discovery, kiro-spec-init, ... (17 dirs)
                  [owned by: cc-sdd (per active-tools.yaml)]
    agents/    — managed: {integrator, product} → N added, M removed, K updated
               — preserved: none
    hooks/     — managed: {integrator, product} → N added, M removed, K updated (incl. manifest.yaml)
               — preserved: none

  Flat subdirs (full sync):
    docs/      — N added, M removed, K updated
    adapters/  — N added, M removed, K updated (reference adapters for /integrator:add Stage 5)
    templates/, output-styles/ — counts

  Root files (overwrite):
    CHANGELOG.md — updated (or unchanged)
    ROADMAP.md   — updated
    README.md, BOOTSTRAP.md, install.sh, install.ps1, .env.template, gitignore.template — counts

  Obsolete contamination to remove (if any present; closed list per DEC-DEV-0042):
    .claude/CLAUDE.md, .claude/DEV_JOURNAL.md, .claude/INSTALL-HUMAN.md
    .claude/dev/ (entire dir)
    .claude/package.json, .claude/package-lock.json, .claude/eslint.config.js, .claude/node_modules/

  Settings.json hooks: K entries to be re-derived from new manifest;
                       L third-party entries preserved (per Step 6 DEC-DEV-0049)

Total: X added + Y updated + Z removed (incl. C contamination items);
       T third-party namespaces preserved (DEC-DEV-0051).

Preserved (user zone, untouched):
  .claude/settings.local.json
  .claude/product.yaml
  .claude/integrator/ (Y files)
  .claude/projects/ (Z files, Claude Code auto)
  .product/ (entire — outside .claude/)

Preserved (integrator-managed external paths — DEC-DEV-0051):
  .kiro/ (cc-sdd workspace dirs + templates)
  .beads/ (committed via git anyway, but backed up by Step 2b for safety)

Skipped (never-copy zone, NOT entering .claude/):
  CLAUDE.md (root, dev's), DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md
```

**If `--dry-run`** → print preview, cleanup temp, exit. NO changes applied. **STRONGLY recommended for first run on any project.**

**Else** → ask user to confirm (unless `--force`):
> Apply changeset? [Y/n]

### Step 5: Apply changes (if confirmed)

**Two sync modes per subdir class** (per Step 4 classification — DEC-DEV-0051):

#### 5.1 Namespace-aware subdirs (`commands/`, `skills/`, `agents/`, `hooks/`)

Managed namespaces — re-derived from upstream. Non-managed namespaces (third-party integrator-installed tools) — preserved untouched. Managed namespace set discovered dynamically: immediate children of `.claude-ecosystem-tmp/<subdir>/`.

```bash
for SUBDIR in commands skills agents hooks; do
  if [ ! -d ".claude-ecosystem-tmp/$SUBDIR" ]; then
    continue
  fi

  # Discover ecosystem-managed namespaces from upstream
  MANAGED_NS=$(ls -1 ".claude-ecosystem-tmp/$SUBDIR" 2>/dev/null | grep -v '^manifest\.yaml$')

  # Ensure target subdir exists
  mkdir -p ".claude/$SUBDIR"

  # Re-sync each managed namespace
  for NS in $MANAGED_NS; do
    if [ -d ".claude-ecosystem-tmp/$SUBDIR/$NS" ]; then
      rm -rf ".claude/$SUBDIR/$NS"
      cp -r ".claude-ecosystem-tmp/$SUBDIR/$NS" ".claude/$SUBDIR/$NS"
    elif [ -f ".claude-ecosystem-tmp/$SUBDIR/$NS" ]; then
      # Flat file inside subdir (e.g. hooks/<subdir>/manifest.yaml at module level — нет в текущей структуре, оставлено для безопасности)
      cp ".claude-ecosystem-tmp/$SUBDIR/$NS" ".claude/$SUBDIR/$NS"
    fi
  done

  # Non-managed namespaces (.claude/$SUBDIR/<X>/ where X not in $MANAGED_NS) — untouched.
done
```

**PowerShell equivalent (Windows):**

```powershell
$namespaceAwareSubdirs = @('commands', 'skills', 'agents', 'hooks')
foreach ($subdir in $namespaceAwareSubdirs) {
  $upstreamPath = ".claude-ecosystem-tmp\$subdir"
  if (-not (Test-Path $upstreamPath)) { continue }

  # Discover managed namespaces (immediate children of upstream subdir, excluding root manifest.yaml)
  $managedNs = Get-ChildItem -Path $upstreamPath -Name | Where-Object { $_ -ne 'manifest.yaml' }

  $targetPath = ".claude\$subdir"
  if (-not (Test-Path $targetPath)) {
    New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
  }

  foreach ($ns in $managedNs) {
    $src = Join-Path $upstreamPath $ns
    $dst = Join-Path $targetPath $ns
    if (Test-Path $src -PathType Container) {
      if (Test-Path $dst) { Remove-Item -Path $dst -Recurse -Force }
      Copy-Item -Path $src -Destination $dst -Recurse
    } elseif (Test-Path $src -PathType Leaf) {
      Copy-Item -Path $src -Destination $dst -Force
    }
  }
  # Non-managed entries inside $targetPath untouched.
}
```

**Examples in current downstream:**
- `.claude/skills/{ecosystem,integrator,product}/` — re-derived from upstream
- `.claude/skills/kiro-*/` (17 cc-sdd dirs, если переустановлены) — **preserved untouched** ✓ (regression of pre-1.3.5 behavior где `rm -rf .claude/skills` уничтожал их)

#### 5.2 Flat subdirs (`docs/`, `templates/`, `adapters/`, `output-styles/`)

Full sync — delete + copy. Third-party tools писать сюда не должны (out of ecosystem convention).

```bash
for SUBDIR in docs templates adapters output-styles; do
  if [ -d ".claude-ecosystem-tmp/$SUBDIR" ]; then
    rm -rf ".claude/$SUBDIR"
    cp -r ".claude-ecosystem-tmp/$SUBDIR" ".claude/$SUBDIR"
  fi
done
```

PowerShell:

```powershell
$flatSubdirs = @('docs', 'templates', 'adapters', 'output-styles')
foreach ($subdir in $flatSubdirs) {
  $src = ".claude-ecosystem-tmp\$subdir"
  $dst = ".claude\$subdir"
  if (Test-Path $src) {
    if (Test-Path $dst) { Remove-Item -Path $dst -Recurse -Force }
    Copy-Item -Path $src -Destination $dst -Recurse
  }
}
```

**Why namespace-aware split** (DEC-DEV-0051, patch 1.3.5):

Pre-1.3.5 spec делал `rm -rf .claude/<subdir>` для всех subdirs. Integrator-installed tools (cc-sdd) placing primitives внутри ecosystem zone subdirs (`.claude/skills/kiro-*/`) уничтожались каждым `/ecosystem:update`. Same architectural family as Step 6 hooks REPLACE (fixed 1.3.4 / DEC-DEV-0049). Pattern: ecosystem zone is shared resource — needs namespace-level granularity, не subdir-level nuclear sync. Flat subdirs unchanged (нет real third-party use case для `.claude/docs/<tool>/` etc.).

#### 5.3 Ecosystem-zone root files

For each ecosystem-zone root file:

```bash
cp .claude-ecosystem-tmp/README.md .claude/README.md
cp .claude-ecosystem-tmp/CHANGELOG.md .claude/CHANGELOG.md
cp .claude-ecosystem-tmp/ROADMAP.md .claude/ROADMAP.md
cp .claude-ecosystem-tmp/BOOTSTRAP.md .claude/BOOTSTRAP.md
cp .claude-ecosystem-tmp/install.sh .claude/install.sh
cp .claude-ecosystem-tmp/install.ps1 .claude/install.ps1
cp .claude-ecosystem-tmp/.env.template .claude/.env.template
cp .claude-ecosystem-tmp/gitignore.template .claude/gitignore.template
```

**Stamp `.claude/adapters/.sync-metadata.yaml`** (per DEC-DEV-0044 — tri-location audit trail; needed by `contract-designer` subagent для populating `@source_ref` в adapter instances):

```bash
NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > .claude/adapters/.sync-metadata.yaml <<EOF
# Stamped by /ecosystem:bootstrap and /ecosystem:update.
# Used by contract-designer subagent (Step 7) to populate @source_ref in adapter instances.
# Drift detection itself uses local file comparison; this file is audit-only.

last_synced_commit: ${ECOSYSTEM_HEAD}
last_synced_at: ${NOW_ISO}
last_synced_from: https://github.com/IlyaNSV/claude-ecosystem-3.0
EOF
```

(`ECOSYSTEM_HEAD` captured in Step 3a/3b above.)

**NEVER touch** anything в never-copy zone or user zone.

### Step 5a: Remove obsolete contamination (per DEC-DEV-0042)

Apply the closed-list removals identified in Step 4. **Only paths in the closed list** — never extend at runtime.

```bash
# Files (use -f so absent paths don't error; idempotent)
rm -f .claude/CLAUDE.md
rm -f .claude/DEV_JOURNAL.md
rm -f .claude/INSTALL-HUMAN.md
rm -f .claude/package.json
rm -f .claude/package-lock.json
rm -f .claude/eslint.config.js

# Directories (only if exists; do NOT confuse with .claude/docs/ which is allowlisted)
rm -rf .claude/dev
rm -rf .claude/node_modules
```

PowerShell equivalent (Windows):

```powershell
foreach ($p in @(".claude\CLAUDE.md", ".claude\DEV_JOURNAL.md", ".claude\INSTALL-HUMAN.md",
                 ".claude\package.json", ".claude\package-lock.json", ".claude\eslint.config.js")) {
  if (Test-Path $p) { Remove-Item $p -Force }
}
foreach ($d in @(".claude\dev", ".claude\node_modules")) {
  if (Test-Path $d) { Remove-Item $d -Recurse -Force }
}
```

**Print:**
```
Obsolete contamination removed:
  .claude/CLAUDE.md (file)
  .claude/dev/ (directory, N files)
  ...
Total: K items removed (or "none — clean install" if all absent).
```

**Invariants:**
- Backup (Step 2) already captured these — rollback restores them if user objects.
- `.claude/.gitignore`, `.claude/.gitattributes`, and any non-listed file are **NEVER** touched here — even if they look ecosystem-related.
- `.claude/docs/` is an allowlisted subdir, NOT contamination — never confuse with `.claude/dev/`.

### Step 5b: Backfill `.claude/pending-actions.md` if missing (DEC-DEV-0047 / patch 1.3.3 B-3)

Pre-1.3.3 installs don't have this file. Update detects absence and backfills idempotently. **Existing user entries preserved verbatim** — never overwrite.

```bash
if [ ! -f .claude/pending-actions.md ]; then
  NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > .claude/pending-actions.md <<EOF
# Pending User Actions

> Ecosystem-wide journal of actions that only the user can do — signups,
> API keys, legal entity registration, manual UI configuration in third-party
> admins. Auto-managed by ecosystem skills + scope-guard hook.
>
> Schema + protocol: \`skills/ecosystem/user-action-tracker.md\`
> List + filter: \`/ecosystem:pending-actions [--status <pending|done|dismissed|all>]\`
> Status workflow: pending → done | dismissed. Manual edits are fine; keep schema intact.

<!-- PA-000 sentinel ensures counter starts at 1 — do not delete -->

## PA-000 — Sentinel (do not delete)

**Status:** dismissed
**Created:** ${NOW_ISO}
**Source:** ecosystem
**Trigger:** /ecosystem:update (backfill from patch 1.3.3)
**Action required:** none (placeholder so PA-NNN counter starts at 1)

**Details:**

Initial sentinel entry backfilled during /ecosystem:update. Future entries
appended by integrator research-protocol Phase 8, installation-protocol surface,
scope-guard hook, and any other ecosystem skill that surfaces a user-only action.

**Blocking:** none.

EOF
  echo "Backfilled .claude/pending-actions.md (PA-000 sentinel; pre-1.3.3 install)"
else
  echo "Preserved existing .claude/pending-actions.md (user entries intact)"
fi
```

PowerShell equivalent (Windows):

```powershell
if (-not (Test-Path ".claude\pending-actions.md")) {
  $nowIso = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $content = @"
# Pending User Actions

> Ecosystem-wide journal of actions that only the user can do — signups,
> API keys, legal entity registration, manual UI configuration in third-party
> admins. Auto-managed by ecosystem skills + scope-guard hook.
>
> Schema + protocol: ``skills/ecosystem/user-action-tracker.md``
> List + filter: ``/ecosystem:pending-actions [--status <pending|done|dismissed|all>]``
> Status workflow: pending → done | dismissed. Manual edits are fine; keep schema intact.

<!-- PA-000 sentinel ensures counter starts at 1 — do not delete -->

## PA-000 — Sentinel (do not delete)

**Status:** dismissed
**Created:** $nowIso
**Source:** ecosystem
**Trigger:** /ecosystem:update (backfill from patch 1.3.3)
**Action required:** none (placeholder so PA-NNN counter starts at 1)

**Details:**

Initial sentinel entry backfilled during /ecosystem:update. Future entries
appended by integrator research-protocol Phase 8, installation-protocol surface,
scope-guard hook, and any other ecosystem skill that surfaces a user-only action.

**Blocking:** none.

"@
  Set-Content -Path ".claude\pending-actions.md" -Value $content -Encoding utf8
  Write-Host "Backfilled .claude/pending-actions.md (PA-000 sentinel; pre-1.3.3 install)"
} else {
  Write-Host "Preserved existing .claude/pending-actions.md (user entries intact)"
}
```

Confirm `.claude/pending-actions.md` is **not** added к `.gitignore` (it's committed).

### Step 6: Re-derive `.claude/settings.json` hooks section (pattern-preserving merge)

Mirror Bootstrap Step 6b logic, но против NEW manifest (just synced in Step 5). **Semantics: merge-preserve, не REPLACE** (revised в patch 1.3.4 / DEC-DEV-0049 — см. «Why merge, not replace» ниже).

1. **Read existing** `.claude/settings.json`
2. **Preserve verbatim:** `permissions` section (user's allowlist) + ALL other top-level fields (model, env, etc.)
3. **Re-derive ecosystem-owned hook entries** from `.claude/hooks/*/manifest.yaml` (new manifests after Step 5):
   - Group by `(event, matcher)` pair
   - Build command entries: `node .claude/hooks/<module>/<file>`
4. **Identify and preserve non-ecosystem hook entries** (third-party tool injections):
   - **Pattern (primary):** entry `command` matching regex `^node \.claude/hooks/(product|integrator|ecosystem|design)/` → ecosystem-owned → re-derived from manifests. Everything else → preserved verbatim.
   - **Audit-only (optional):** if `.claude/integrator/active-tools.yaml` exists и parseable, cross-reference preserved entries against `tools[*].claude_primitives[]` где `type: hook` — label preserved entries owning-tool в print confirmation. Does NOT gate merge — pattern (primary) — единственный решающий критерий.
5. **Merge logic** (per `(event, matcher)` pair):
   - Union: ecosystem-derived entries + preserved non-ecosystem entries
   - Dedupe by `command` string (идемпотентные re-runs)
   - Ordering: ecosystem entries first, preserved entries after
6. **Write merged settings.json** back

**Why merge, not replace** (revised — DEC-DEV-0049, patch 1.3.4):

Previous version specified «REPLACE not merge» с rationale «manifest = single source of truth; user adds custom hooks manually post-update». Pilot evidence (downstream `my-first-test` DEC-INT-0005, 2026-05-27): Integrator-registered tools (e.g. `bd` via `bd setup claude` injecting `SessionStart` / `PreCompact` hooks for `bd prime`) wiped on every `/ecosystem:update`. Pattern-preserving merge restores ecosystem hooks from manifests while keeping third-party injections intact, **matching Bootstrap Step 6b semantics** (`commands/ecosystem/bootstrap.md:441-446` — symmetry restored).

**Print confirmation** (extended):

```
Hooks re-derived from new manifest:
  PostToolUse (matcher: Write|Edit):
    - node .claude/hooks/product/artifact-validate.js
    - node .claude/hooks/product/session-state.js
    - node .claude/hooks/product/bg-extractor.js
    - node .claude/hooks/product/cascade-check.js
    - node .claude/hooks/product/br-change-trigger.js
    - node .claude/hooks/product/ic-change-trigger.js
    - node .claude/hooks/product/product-handoff-gate.js
  PostToolUse (matcher: Bash|Write|Edit|NotebookEdit):
    - node .claude/hooks/integrator/journal-hook.js
  PreToolUse (matcher: Bash|Write|Edit|NotebookEdit):
    - node .claude/hooks/integrator/scope-guard.js
  Total ecosystem: 9 hooks across 3 event types

Preserved (non-ecosystem):
  SessionStart (matcher: ""):
    - bd prime  [owned by: beads (per active-tools.yaml)]
  PreCompact (matcher: ""):
    - bd prime  [owned by: beads (per active-tools.yaml)]
  Total preserved: 2 hooks across 2 event types
```

Если `active-tools.yaml` отсутствует или unparseable — preserved entries показываются без `[owned by: ...]` annotation:

```
Preserved (non-ecosystem, unattributed):
  SessionStart (matcher: ""):
    - bd prime
```

**Edge cases:**
- Empty hooks section в existing settings.json: no preserved entries; ecosystem hooks added cleanly (behavior identical to old REPLACE).
- All entries match ecosystem pattern: behavior identical to old REPLACE — clean re-derivation, preserved=empty.
- Malformed existing settings.json: skip hook re-derivation per existing error-handling table; warn user; preserve old settings.

**Idempotency:** dedupe by command string гарантирует, что повторный `/ecosystem:update` не создаёт дубликатов.

### Step 7: Cleanup + verify

```bash
rm -rf .claude-ecosystem-tmp
```

Verify post-update integrity (mirror bootstrap Step 2d):
- `.claude/README.md`, `.claude/BOOTSTRAP.md`
- `.claude/commands/ecosystem/{bootstrap,verify,update}.md` (this command should be present after sync — incidentally validating self-update worked)
- `.claude/docs/pmo/artifacts/` ≥ 22 files
- `.claude/docs/integrator-module/SPEC.md`, `.claude/docs/product-module/SPEC.md`

If any missing → flag, suggest restore from backup.

### Step 8: Summary report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ecosystem 3.0 — Update complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backup: .claude-backup-<timestamp>/
  - .claude/ snapshot
  - _external/ (J integrator-managed paths outside .claude/, per active-tools.yaml; .kiro/, .beads/, ...)

Synced from upstream (namespace-aware sync — DEC-DEV-0051):
  commands/ — managed namespaces re-derived; T1 third-party namespaces preserved
  skills/   — managed namespaces re-derived; T2 third-party namespaces preserved
  agents/   — managed namespaces re-derived; T3 third-party namespaces preserved
  hooks/    — managed namespaces re-derived (incl. manifest.yaml); T4 third-party namespaces preserved
  docs/     — full sync (no third-party expected)
  templates/, adapters/, output-styles/ — full sync
  Root files: README, CHANGELOG, ROADMAP, BOOTSTRAP, install.sh/ps1, .env.template, gitignore.template

Settings.json hooks: ecosystem hooks re-derived (M active); L third-party entries preserved (per DEC-DEV-0049)

Obsolete contamination cleaned (DEC-DEV-0042):
  K items removed from .claude/ (CLAUDE.md, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md, package.json, ...)
  — or "none — clean install" if pilot was bootstrapped post-DEC-DEV-0019.

Preserved (untouched):
  .claude/settings.local.json (your permissions)
  .claude/product.yaml (your config)
  .claude/design.yaml (per-project Design Module config — preserved if exists; auto-init by /design:start)
  .claude/pending-actions.md (your pending-actions journal — backfilled if pre-1.3.3 install; existing entries intact)
  .claude/integrator/ (Integrator state)
  .claude/projects/ (Claude Code session history)
  .product/ (your artifacts — entire)
  .claude/.gitignore, .claude/.gitattributes (if present — project's own)

Preserved (integrator-managed third-party — DEC-DEV-0051):
  Inside ecosystem zone: .claude/skills/kiro-*/ (cc-sdd), .claude/hooks/<tool>/ (if any), ...
  Outside ecosystem zone (backed up by Step 2b for rollback safety):
    .kiro/ (cc-sdd workspace + templates)
    .beads/ (beads dolt store + git hooks)

Never copied (correctly skipped from upstream):
  CLAUDE.md (root, ecosystem dev's), DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md, package.json/node_modules

What's next?
  [1] /ecosystem:verify — confirm health post-update
  [2] cat .claude/CHANGELOG.md — see what's new в this update
  [3] If issues: rollback (см. ниже)
```

## Error handling

| Error | Action |
|---|---|
| Ecosystem signature missing | Abort; suggest `/ecosystem:bootstrap` |
| `git clone` failed | Suggest `--offline` if cache exists; check network |
| Backup failed (disk space) | Abort; do NOT proceed без backup unless `--no-backup` |
| Sync interrupted (network/Ctrl-C) | Restore from backup: `rm -rf .claude && mv .claude-backup-* .claude` |
| Settings.json malformed | Skip hook re-derivation; warn user; preserve old settings; suggest manual fix |
| Verify failed post-update | Suggest restore from backup |

## What NOT to do

- DO NOT touch `.product/` (artifacts are user data — entirely outside `.claude/`)
- DO NOT modify `.env` at project root (secrets)
- DO NOT overwrite `.claude/settings.local.json` (user permissions)
- DO NOT overwrite `.claude/product.yaml` (project config)
- DO NOT touch `.claude/integrator/` contents (Integrator state)
- DO NOT copy CLAUDE.md (root), DEV_JOURNAL.md, dev/, или INSTALL-HUMAN.md from upstream — these are ecosystem developer artifacts (causes contamination per DEC-DEV-0019 Finding A)
- DO NOT auto-commit anything to git (user reviews + commits manually)
- DO NOT skip backup unless `--no-backup` explicitly passed
- DO NOT install MCPs (separate concern; user manages MCPs post-bootstrap independently)
- DO NOT extend the obsolete-contamination closed list at runtime (Step 4 / 5a) — if a new contamination class emerges, patch this spec + bump CHANGELOG instead

## Rollback

If update broke something, rollback now restores **both** `.claude/` AND integrator-managed external paths (DEC-DEV-0051):

```bash
# Identify backup
ls -d .claude-backup-*

# Pick latest, e.g. .claude-backup-20260527-220000
BACKUP=.claude-backup-<timestamp>

# Phase 1: restore .claude/
rm -rf .claude
cp -r "$BACKUP" .claude
# (or `mv` if no other backups depend on this dir)

# Phase 2: restore integrator-managed external paths (if any)
if [ -d "$BACKUP/_external" ]; then
  # MANIFEST.yaml lists paths; iterate and restore each.
  # Simple variant — cp each top-level entry under _external/ back to its original location.
  for P in "$BACKUP/_external"/*; do
    NAME=$(basename "$P")
    if [ "$NAME" = "MANIFEST.yaml" ]; then continue; fi
    rm -rf "./$NAME"
    cp -r "$P" "./$NAME"
  done
fi

# Note: .claude/ is restored from snapshot, not original — if rollback copied vs moved,
# you can keep the backup dir for additional rollbacks. Use `mv` for one-shot restore.
```

**PowerShell equivalent:**

```powershell
$backup = ".claude-backup-<timestamp>"

# Phase 1
if (Test-Path .claude) { Remove-Item -Path .claude -Recurse -Force }
Copy-Item -Path $backup -Destination .claude -Recurse

# Phase 2
$extDir = Join-Path $backup "_external"
if (Test-Path $extDir) {
  Get-ChildItem -Path $extDir | Where-Object { $_.Name -ne 'MANIFEST.yaml' } | ForEach-Object {
    if (Test-Path "./$($_.Name)") { Remove-Item -Path "./$($_.Name)" -Recurse -Force }
    Copy-Item -Path $_.FullName -Destination "./$($_.Name)" -Recurse
  }
}
```

`.product/` was never touched, so artifacts intact regardless of rollback.

If multiple backups present (subsequent updates) → keep latest backup, delete older periodically. Check `$BACKUP/_external/MANIFEST.yaml` to see what external paths the backup contains.

## Comparison: bootstrap vs update

| Aspect | `/ecosystem:bootstrap` | `/ecosystem:update` |
|---|---|---|
| Use case | Greenfield project | Existing ecosystem install |
| Pre-check | Directory empty / Claude Code auto-files OK | Ecosystem signature required |
| `.product/` | Creates skeleton | Untouched |
| `.env` | Creates from template + asks keys | Untouched |
| `product.yaml` | Creates с user choices | Untouched |
| MCP install | Step 9 (asks per-MCP) | Skipped (user manages MCPs separately) |
| Hook registration | Step 6b — first-time merge | Step 6 — re-derive from latest manifest (replace, not merge) |
| Ecosystem files | First copy (cp -rn additive) | Overwrite (rsync-style sync с delete) |
| Backup | N/A (greenfield) | `.claude-backup-<timestamp>/` (default) |
| Settings.json | Created from template | Permissions preserved, hooks re-derived |
| Dev contamination risk | High (cp -rn от full clone) | None (allowlist explicit) |
| Existing contamination (from old bootstraps) | N/A | Step 5a removes closed-list items (DEC-DEV-0042) |

**TL;DR:** bootstrap = «set everything up first time»; update = «sync ecosystem zone к latest, preserve user state».

## Related

- [`commands/ecosystem/bootstrap.md`](bootstrap.md) — initial install
- [`commands/ecosystem/verify.md`](verify.md) — post-update health check
- [`DEV_JOURNAL.md DEC-DEV-0019`](../../DEV_JOURNAL.md) — bootstrap findings + Path Y rationale that motivated this command
- [`dev/meta-improvement/checklists/phase-closure.md`](../../dev/meta-improvement/checklists/phase-closure.md) Step 2 — bootstrap regression test (re-run with `/ecosystem:update` post-Phase 4)
