---
description: Install Ecosystem 3.0 into the current project. Clones ecosystem to .claude/, initializes .product/, generates CLAUDE.md, configures env + settings, sets up MCP stack.
argument-hint: "[--offline] [--no-mcp] [--force]"
---

# /ecosystem:bootstrap

**Precondition:** this command requires Ecosystem 3.0 to be globally installed (via `install.sh` or `install.ps1` — see `~/.claude/ecosystem/README.md`). If globally installed, this command is autocompletable from any directory.

**What it does:** installs Ecosystem 3.0 into the **current project directory**, populating `.claude/` with commands/skills/agents/hooks/docs, initializing `.product/` skeleton, and generating a project-level `CLAUDE.md`.

User invoked: `/ecosystem:bootstrap $ARGUMENTS`

## Flags

- `--offline` — use local cache (`~/.claude/ecosystem/`) instead of fresh `git clone`
- `--no-mcp` — skip Step 9 (MCP installation)
- `--force` — skip directory-not-empty check

## Execution sequence

### Step 1: Environment verification

Check prerequisites:
- `git` available (`git --version`)
- Current directory exists and writable
- Verify we are **NOT** in:
  - `$HOME` itself (user's home directory)
  - `~/.claude/` or any subdirectory (global config zone)
  - `~/.claude/ecosystem/` (the global cache itself — protect against self-install)

#### 1a. Check project root (files OUTSIDE `.claude/`)

List contents of current directory **excluding `.claude/`** (it's analyzed separately in 1b).

Common non-blocking files/dirs allowed:
- `.git/`, `.gitignore`, `.gitattributes`
- `README.md`, `LICENSE`, `LICENCE`

Anything else (e.g., `src/`, `package.json`, existing code) → **user content present**.

**If user content present:** unless `--force` passed, ASK USER:
> "В проекте уже есть файлы: <list>. Установить ecosystem рядом с существующим кодом? (это нормально — `.claude/` и `.product/` просто добавятся рядом)"

Proceed only with explicit approval.

#### 1b. Check existing `.claude/` directory

This is the critical check. Claude Code **automatically creates** files in `.claude/` when it runs (permission prompts → `settings.local.json`, session history → `projects/`, etc.). These are NOT a reason to block bootstrap.

**Known Claude Code auto-generated files/directories** (safe to preserve, do NOT treat as blocker):
- `settings.local.json` — user's permission approvals
- `projects/` — session history
- `todos/` — todo lists
- `statsig/` — telemetry config
- `shell-snapshots/` — shell state
- `ide/` — IDE integration state
- `plugins/` — plugin configurations

**Ecosystem signature** (indicates prior ecosystem install — re-install scenario):
- `docs/pmo/pmo-map.md` present
- `commands/ecosystem/bootstrap.md` present
- `docs/integrator-module/SPEC.md` present

Decision tree for `.claude/`:

| State | Action |
|---|---|
| `.claude/` doesn't exist | → proceed to Step 2 (fresh install) |
| `.claude/` exists, empty | → proceed to Step 2 |
| `.claude/` exists, only Claude Code auto-files | → proceed to Step 2 (will merge; auto-files preserved) |
| `.claude/` has ecosystem signature | → re-install scenario: inform user, offer options below |
| `.claude/` has other unknown files | → ask user (list them), offer options below |

**For re-install or unknown-content cases, offer:**
- `(a)` **Backup + fresh:** move current `.claude/` to `.claude-backup-<timestamp>/`, install fresh
- `(b)` **Merge:** attempt to add ecosystem files alongside existing (safer for re-install than unknown content)
- `(c)` **Abort**

With `--force`, skip confirmation and default to `(b) Merge`.

### Step 2: Clone ecosystem and merge into `.claude/`

**Cannot use `git clone <url> .claude` directly** — git refuses to clone into non-empty directory (and `.claude/settings.local.json` is almost always present after Claude Code launch).

**Strategy: clone to temp → merge into `.claude/` (no-clobber) → cleanup.**

#### 2a. Determine source

- **Default (online):** git clone from GitHub → latest main
- **With `--offline`:** copy from global cache `~/.claude/ecosystem/` (fast, version snapshot)

#### 2b. Online path (default)

```bash
# Clone ecosystem to a TEMP directory inside current project (not .claude/)
git clone --depth 1 https://github.com/IlyaNSV/claude-ecosystem-3.0.git .claude-ecosystem-tmp

# Remove .git from temp to avoid creating a nested git repo inside .claude/
rm -rf .claude-ecosystem-tmp/.git

# Ensure .claude/ exists
mkdir -p .claude

# Merge temp → .claude/ with no-clobber (preserves existing files like settings.local.json)
cp -rn .claude-ecosystem-tmp/. .claude/

# Cleanup temp
rm -rf .claude-ecosystem-tmp
```

#### 2c. Offline path (with `--offline` flag)

```bash
# Ensure .claude/ exists
mkdir -p .claude

# Copy from global cache (rsync-like semantics via cp -n)
cp -rn ~/.claude/ecosystem/. .claude/

# Remove any stray .git that may have been copied
rm -rf .claude/.git
```

#### 2d. Verify integrity

Check presence of:
- `.claude/README.md`
- `.claude/BOOTSTRAP.md`
- `.claude/commands/integrator/` contains 6 `.md` files (`research`, `map`, `gaps`, `status`, `journal`, `scan`)
- `.claude/commands/ecosystem/bootstrap.md` (must be there — you just ran it, but verify propagation)
- `.claude/docs/pmo/artifacts/` contains at least 22 artifact files + README
- `.claude/docs/integrator-module/SPEC.md`
- `.claude/docs/product-module/SPEC.md`
- `.claude/templates/project/CLAUDE.md.template`

If any missing → abort with clear error listing missing items. Suggest re-running with `--force` or checking network.

#### 2e. Note on preserved files

After Step 2, the `.claude/` directory contains:
- Ecosystem content (commands, skills, agents, hooks, docs, templates, config templates)
- **Preserved:** any Claude Code auto-generated files (`settings.local.json` etc.) that were there before — `cp -n` skips overwriting them.

If a `settings.json` or `.env.template` already existed (rare, ecosystem re-install) — they were NOT overwritten. Check and let user decide manually if re-install needs those files refreshed.

### Step 3: Initialize `.product/` structure

Create directory skeleton (but NO artifacts — those come from `/product:init`):

```bash
mkdir -p .product/{segments,value-propositions,hypotheses,releases,features,scenarios,business-rules,lifecycles,verification,invariants,nfr,mockups,notes,handoffs,.sessions,.pending,.da-findings,.decisions}
```

Create `.product/.sessions/.gitkeep` and `.product/.pending/.gitkeep` so empty directories are trackable if user ever needs to.

### Step 4: Set up `.env`

1. Copy template:
   ```bash
   cp .claude/.env.template .env
   ```

2. **Ask user for API keys interactively**, one at a time:
   - Brave Search API key (required for research quick lookups)
   - Firecrawl API key (required for web scraping in research)
   - Exa AI key (optional, for semantic search)
   - GitHub token (optional, for GitHub MCP)
   - Stitch project URL (optional, only if first feature is UI)

3. For each key the user provides:
   - Write to `.env` replacing the placeholder
   - Confirm receipt with **only the last 4 chars shown** (never the full key)
   - If user says "skip" — leave placeholder, note in summary

4. Never print back full key values. Never commit `.env`.

### Step 5: Set up `.gitignore`

```bash
cp .claude/gitignore.template .gitignore
```

If `.gitignore` already exists at project root — merge strategically:
- Ask user: "Existing .gitignore found. Append ecosystem entries or replace?"
- Default to append (safer).

### Step 6: Configure Claude Code settings

```bash
cp .claude/settings.json.template .claude/settings.json
```

The template sets:
- Default model: `claude-opus-4-7`
- Minimum safe permissions allowlist
- Empty hooks registration (hooks get wired per-phase as modules activate)

### Step 7: Create `.claude/product.yaml`

Prompt user for:
- Project name (derive from folder name as default)
- Project language (`ru` / `en` / other — default to language of user's current interaction)
- Validation tier (default `pilot` — recommend)

Write `.claude/product.yaml`:

```yaml
version: 1
project_name: <user-provided>
project_language: <user-provided>

# Validation
validation_tier: pilot                     # B1 modification — start minimal

# Discovery
default_discovery_mode: quick
nfr_default_tier: mvp

# Confidence (C2 modification)
confidence_required_at_approve: true

# Auto-approve (A1 modification)
auto_approve_confirmation_artifacts:
  enabled: true
  requires_high_confidence: true

# Hooks behavior (B2 modification)
draft_mode_quiet_hooks: true

# Ecosystem metadata
ecosystem_version: <read from .claude/CHANGELOG.md first entry>
ecosystem_source: "https://github.com/IlyaNSV/claude-ecosystem-3.0"
installed_at: <ISO timestamp of bootstrap>
```

### Step 8: Generate project-level `CLAUDE.md`

Read template: `.claude/templates/project/CLAUDE.md.template`

Substitute placeholders:
- `{{project_name}}` — from Step 7
- `{{ecosystem_version}}` — from Step 7
- `{{installed_at}}` — from Step 7
- `{{validation_tier}}` — from Step 7

Write to: `./CLAUDE.md` (project root, not inside `.claude/`).

This file is what Claude Code reads on every session start — it gives Claude immediate context about the project's structure, conventions, and ecosystem integration.

If `CLAUDE.md` already exists at project root:
- ASK USER: "Existing CLAUDE.md found. Merge ecosystem section or leave untouched?"
- Default: offer to append an "## Ecosystem 3.0 integration" section without overwriting existing content.

### Step 9: Install Core MCP stack (unless `--no-mcp`)

Invoke (as a subprocess or follow-up step):
```
/integrator:research "Core MCP stack for Ecosystem 3.0"
```

Present the user with the recommended Core MCP stack:
- **Sequential Thinking** — required for multi-step reasoning
- **Memory MCP** — required for cross-session knowledge graph
- **Firecrawl** — recommended (Deep mode research)
- **Brave Search** — recommended (Quick mode research)
- **Exa AI** — recommended (semantic search)
- **Context7** — recommended (realtime package docs)
- **GitHub Official MCP** — optional (CA Deep mode, NFR benchmarks)

For each, user approves installation per-MCP via `/integrator:add <mcp>`. Skip ones user declines (e.g., GitHub if no token in Step 4).

If user passed `--no-mcp`, skip entirely and note in summary: "MCP stack skipped. Install later via /integrator:research + /integrator:add."

### Step 10: Initialize git in project (if greenfield)

Check for `.git` directory:
- **If not present AND directory is greenfield** — offer:
  > "Инициализировать git репозиторий? (рекомендуется для version control)"
  On yes:
  ```bash
  git init
  git branch -m main
  ```
  **DO NOT** auto-stage or commit. Let user review state and commit themselves.

- **If `.git` exists** — skip, user has own git workflow.

### Step 11: Final verification

Run:
```
/integrator:status
```

Expected output:
- Active tools: N MCPs (depending on user Step 9 choices)
- Contracts: 0 (no D2-Tech tool yet — that comes in Phase 5 of roadmap)
- PMO mapping:
  - D1, D2-Behavioral: covered by Product Module (core)
  - D2-05: Design Module (conditional on has_ui)
  - D6: Integrator (core)
  - D2-Tech, D3, D4, D5: uncovered (expected for fresh project)

### Step 12: Ready prompt

Tell user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ecosystem 3.0 готова к работе
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Installed:
  ✓ .claude/         ecosystem (commands, skills, docs)
  ✓ .product/        empty skeleton (artifacts will come from /product:init)
  ✓ CLAUDE.md        project context for Claude Code
  ✓ .env             API keys (gitignored)
  ✓ .gitignore       ecosystem-compatible
  ✓ product.yaml     project config (tier: pilot)
  ✓ MCP stack        N of 7 installed

What's next?

  [1] /product:init          — начать Discovery (рекомендую, если продукт greenfield)
  [2] /integrator:gaps       — посмотреть какие PMO зоны не покрыты
  [3] /product:status        — dashboard .product/ (пока пусто)
  [4] Почитать .claude/ROADMAP.md для плана имплементации

Если выбираешь /product:init — Quick mode занимает 30-90 мин, Deep — 2-4 часа.
Можно прервать и продолжить через --continue.
```

## Error handling

| Error | Action |
|---|---|
| `git` not found | Die with install instructions |
| `git clone` failed | Suggest `--offline` if cache exists, else check network |
| Directory not empty (no `--force`) | Ask user explicitly |
| `.claude/` already exists | Ask: backup + replace OR abort |
| API key missing | Skip relevant MCP; warn user about fallback |
| MCP install failed | Continue with rest; surface at end as "MCP X failed, here's why" |
| `product.yaml` exists | Read existing, ask before overwriting |

## What NOT to do

- DO NOT auto-commit anything to git without explicit user approve.
- DO NOT push API keys, secrets, or any `.env` content to any remote.
- DO NOT install MCPs without per-MCP user approve (DEC-INT-P01).
- DO NOT bypass any approve gate "because it looks safe".
- DO NOT skip Step 4 (env setup) — Deep Discovery mode will be crippled without keys.
- DO NOT create artifacts in `.product/` — that's `/product:init`'s job.
- DO NOT overwrite existing CLAUDE.md without asking.
- DO NOT modify existing `.gitignore` without asking.

## Resumability

If bootstrap is interrupted (browser closed, Claude Code exit, etc.) and user re-runs:

1. Detect existing `.claude/` → ask: "Detected partial bootstrap. Resume from step N or restart?"
2. Detect existing `.product/` → confirm skeleton is correct
3. Detect existing `.env` → preserve, only ask for keys missing
4. Detect existing `CLAUDE.md` → preserve, offer merge
5. Detect partial MCP installs → resume where left off

Track progress via presence of artifacts, not a "resume state file" (self-documenting filesystem).

## After bootstrap — update mechanism

To update the ecosystem **in this project** later:

```
/ecosystem:verify       — check state
/ecosystem:upgrade      — [future v1.1] pull latest + migrate breaking changes
```

For now (v1.0), updates are manual: `git clone` latest repo over `.claude/` with care.

## Related

- `commands/ecosystem/verify.md` — post-bootstrap health check
- `templates/project/CLAUDE.md.template` — CLAUDE.md template
- Root `BOOTSTRAP.md` — human-readable overview of what this command does
- Root `INSTALL-HUMAN.md` — pre-install checklist for humans
