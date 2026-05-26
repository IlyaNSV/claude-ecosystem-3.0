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

### Step 2: Backup `.claude/` (unless `--no-backup`)

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=".claude-backup-${TIMESTAMP}"
cp -r .claude "${BACKUP_DIR}"
echo "Backup: ${BACKUP_DIR}"
```

If `--no-backup` → skip с warning «User responsible для recovery if update fails». Default = backup (cautious).

**`.product/` is never touched** regardless of backup choice — артефакты outside `.claude/`.

### Step 3: Clone upstream к temp

#### 3a. Online (default)

```bash
git clone --depth 1 https://github.com/IlyaNSV/claude-ecosystem-3.0.git .claude-ecosystem-tmp
rm -rf .claude-ecosystem-tmp/.git
```

#### 3b. Offline (`--offline`)

```bash
cp -r ~/.claude/ecosystem .claude-ecosystem-tmp
rm -rf .claude-ecosystem-tmp/.git
```

### Step 4: Compute changeset (preview если `--dry-run`)

**Ecosystem-zone allowlist:**

| Type | Items |
|---|---|
| **Subdirs** (sync с delete) | `commands/`, `skills/`, `agents/`, `hooks/`, `docs/`, `templates/`, `output-styles/` (если exists) |
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
- `.claude/integrator/` (если exists) — Integrator project state
- `.claude/.env` (если exists; usually .env at project root) — secrets
- `.claude/projects/`, `todos/`, `statsig/`, `shell-snapshots/`, `ide/`, `plugins/` — Claude Code auto-files
- `.product/` — entire (outside `.claude/`)
- Any other user-added files в `.claude/` outside ecosystem-zone subdirs

**Diff computation per allowlisted subdir:**

For `commands/`, `skills/`, `agents/`, `hooks/`, `docs/`, `templates/`, `output-styles/`:
- **To remove:** files в `.claude/<subdir>/` but NOT в `.claude-ecosystem-tmp/<subdir>/`
- **To add:** files в `.claude-ecosystem-tmp/<subdir>/` but NOT в `.claude/<subdir>/`
- **To update:** files в both, content differs

For root files в allowlist:
- **To add:** file в upstream но NOT в `.claude/`
- **To update:** file в both, content differs

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
  Subdirs (rsync-style sync):
    commands/  — N added, M removed, K updated
    skills/    — N added, M removed, K updated
    hooks/     — N added, M removed, K updated (incl. manifest.yaml)
    docs/      — N added, M removed, K updated
    agents/, templates/, output-styles/ — counts

  Root files (overwrite):
    CHANGELOG.md — updated (or unchanged)
    ROADMAP.md   — updated
    README.md, BOOTSTRAP.md, install.sh, install.ps1, .env.template, gitignore.template — counts

  Obsolete contamination to remove (if any present; closed list per DEC-DEV-0042):
    .claude/CLAUDE.md, .claude/DEV_JOURNAL.md, .claude/INSTALL-HUMAN.md
    .claude/dev/ (entire dir)
    .claude/package.json, .claude/package-lock.json, .claude/eslint.config.js, .claude/node_modules/

  Settings.json hooks: K entries to be re-derived from new manifest

Total: X added + Y updated + Z removed (incl. C contamination items).

Preserved (user zone, untouched):
  .claude/settings.local.json
  .claude/product.yaml
  .claude/integrator/ (Y files)
  .claude/projects/ (Z files, Claude Code auto)
  .product/ (entire — outside .claude/)

Skipped (never-copy zone, NOT entering .claude/):
  CLAUDE.md (root, dev's), DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md
```

**If `--dry-run`** → print preview, cleanup temp, exit. NO changes applied. **STRONGLY recommended for first run on any project.**

**Else** → ask user to confirm (unless `--force`):
> Apply changeset? [Y/n]

### Step 5: Apply changes (if confirmed)

For each ecosystem-zone subdir в allowlist:

```bash
# rsync-style: delete obsolete + copy fresh
rm -rf .claude/commands
cp -r .claude-ecosystem-tmp/commands .claude/commands

rm -rf .claude/skills
cp -r .claude-ecosystem-tmp/skills .claude/skills

# ... same for agents/, hooks/, docs/, templates/, output-styles/
```

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

### Step 6: Re-derive `.claude/settings.json` hooks section

Mirror Bootstrap Step 6b logic, но против NEW manifest (just synced in Step 5):

1. Read existing `.claude/settings.json`
2. **Preserve:** `permissions` section (user's allowlist) + ALL other top-level fields verbatim (model, env, etc.)
3. **Re-derive:** `hooks` section from `.claude/hooks/*/manifest.yaml` (new manifests after Step 5):
   - Group by `(event, matcher)` pair
   - Build command entries: `node .claude/hooks/<module>/<file>`
   - **REPLACE** existing `hooks` section entirely (NOT merge)
4. Write back `.claude/settings.json`

**Why replace, not merge:** previous bootstrap merge logic preserved user-added hooks. `/ecosystem:update` assumes hooks section is ecosystem-managed (manifest = single source of truth post-update). If user wants custom hooks alongside ecosystem hooks, they add manually post-update. Document if needed.

**Print confirmation:**
```
Hooks re-derived от new manifest:
  PostToolUse (matcher: Write|Edit):
    - node .claude/hooks/product/artifact-validate.js
    - node .claude/hooks/product/session-state.js
    - node .claude/hooks/product/bg-extractor.js
    - node .claude/hooks/product/cascade-check.js
    - node .claude/hooks/product/br-change-trigger.js
    - node .claude/hooks/product/ic-change-trigger.js
  Total: 6 hooks across 1 event type
```

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

Synced from upstream:
  commands/ — N items
  skills/   — N items
  hooks/    — N items (incl. manifest.yaml)
  docs/     — N items
  agents/, templates/, output-styles/ — N items
  Root files: README, CHANGELOG, ROADMAP, BOOTSTRAP, install.sh/ps1, .env.template, gitignore.template

Settings.json hooks: re-derived (M hooks active, registered под manifest)

Obsolete contamination cleaned (DEC-DEV-0042):
  K items removed from .claude/ (CLAUDE.md, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md, package.json, ...)
  — or "none — clean install" if pilot was bootstrapped post-DEC-DEV-0019.

Preserved (untouched):
  .claude/settings.local.json (your permissions)
  .claude/product.yaml (your config)
  .claude/integrator/ (Integrator state)
  .claude/projects/ (Claude Code session history)
  .product/ (your artifacts — entire)
  .claude/.gitignore, .claude/.gitattributes (if present — project's own)

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

If update broke something:

```bash
# Identify backup
ls -d .claude-backup-*

# Full rollback (assumes только one recent backup)
rm -rf .claude
mv .claude-backup-<timestamp> .claude
```

`.product/` was never touched, so artifacts intact regardless of rollback.

If multiple backups present (subsequent updates) → keep latest backup, delete older periodically.

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
