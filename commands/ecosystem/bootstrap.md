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
- `git` available
- Current directory exists and writable
- Verify we are **NOT** in:
  - `$HOME` itself (user's home directory)
  - `~/.claude/` or any subdirectory (global config zone)
  - `~/.claude/ecosystem/` (the global cache itself — protect against self-install)

If current directory is NOT empty (contains files other than common meta like `.git`, `README.md`, `.gitignore`):
- Unless `--force` is passed, ASK USER:
  > "В этой папке уже есть файлы (перечисли). Установить ecosystem рядом (создать `.claude/` поверх существующего) или отмена?"
- DO NOT proceed without explicit user approval.

### Step 2: Clone or copy ecosystem into `.claude/`

**Default path (fresh from GitHub):**
```bash
git clone https://github.com/IlyaNSV/claude-ecosystem-3.0.git .claude
```

**With `--offline`:**
```bash
cp -r ~/.claude/ecosystem/. .claude/
# Then remove .git to avoid nested repo confusion, unless user wants update capability
rm -rf .claude/.git
```

After either path, verify:
- `.claude/README.md` exists
- `.claude/BOOTSTRAP.md` exists
- `.claude/commands/integrator/` has 6 command files
- `.claude/docs/pmo/artifacts/` has 22 artifact files

If verification fails → abort with clear error, suggest re-running.

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
