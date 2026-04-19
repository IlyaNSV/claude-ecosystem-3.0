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

#### 1c. Tooling prerequisites

Before heavy operations, verify the full tool chain. Step 9 (MCP install) depends on `npx` which is a common failure point on Windows with `nvm4w`.

```bash
git --version               # ≥ 2.20 (required for Step 2)
node --version              # ≥ 18 (required for Step 9 MCPs)
npm --version               # required for Step 9
npx --version               # required for Step 9 — MCPs launch via `npx -y <pkg>`
claude --version            # ≥ 2.0 (sanity — we ARE running inside Claude Code)
```

**Failure handling:**

| Missing tool | Impact | Action |
|---|---|---|
| `git` | Cannot clone ecosystem | **Abort.** Install Git first: https://git-scm.com/ |
| `node` (< 18 or missing) | Step 9 MCP stack unusable | Warn; offer skip MCP (proceed to Step 2) OR abort |
| `npm`/`npx` missing but node present | Step 9 unusable | Warn; common on Windows nvm4w with incomplete install. Offer skip MCP OR abort. Suggest `nvm list` → `nvm use <working-version>` → fresh shell |
| `claude` | You can't read this message (we're inside it) | N/A |

**If `npm`/`npx` missing:** present exactly this to user:

> `npm`/`npx` не в PATH (node v<version> found, но npm/npx отсутствуют — частая проблема Windows nvm4w).
>
> Опции:
> - `(skip-mcp)` — продолжить bootstrap без Step 9 (можно установить MCPs потом через `claude mcp add` после fix node env)
> - `(abort)` — остановиться. Фикс:
>   ```
>   nvm list                    # список установленных
>   nvm use <version>           # переключиться на рабочую
>   # перезапусти shell, проверь node/npm/npx --version
>   ```
> - `(force)` — продолжить и попытаться в Step 9 (упадёт, но остальные шаги завершатся — эквивалентно skip-mcp по факту)

Don't block bootstrap just because `npm`/`npx` are missing. Other steps (1-8, 10-12) don't need node.

#### 1d. Pre-stage permissions (reduces prompts for rest of bootstrap)

Bootstrap involves ~15 tool invocations with different `Bash(...)` patterns, each triggering a separate Claude Code permission prompt. Pre-staging an allowlist in `.claude/settings.local.json` (gitignored — machine-specific) reduces prompts to **one** (the Write itself).

**Ask user** (unless `--force`):

> Pre-stage permissions to reduce ~15 prompts during rest of bootstrap? The list scopes narrowly — no blanket `rm -rf` or `Bash(*)`. List written to `.claude/settings.local.json` (gitignored). [Y/n]

If user confirms (or `--force`):

**Step 1: Read existing `.claude/settings.local.json` if present** (Claude Code auto-creates it with approved permissions). Parse JSON.

**Step 2: Merge ecosystem allowlist with existing** — union of `permissions.allow` arrays, deduplicated. **Never overwrite user's existing permissions.**

**Step 3: Write merged JSON back to `.claude/settings.local.json`.**

**Ecosystem allowlist to merge in:**

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep",
      "WebSearch",
      "Bash(pwd)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(echo:*)",
      "Bash(test:*)",
      "Bash(git --version)",
      "Bash(git config:*)",
      "Bash(git status:*)",
      "Bash(git init)",
      "Bash(git branch:*)",
      "Bash(git add:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git check-ignore:*)",
      "Bash(git clone --depth 1 https://github.com/IlyaNSV/claude-ecosystem-3.0.git:*)",
      "Bash(mkdir:*)",
      "Bash(cp:*)",
      "Bash(rm -rf .claude-ecosystem-tmp:*)",
      "Bash(rm -rf .claude-ecosystem-tmp/.git)",
      "Bash(find .claude:*)",
      "Bash(find .product:*)",
      "Bash(node --version)",
      "Bash(npm --version)",
      "Bash(npx --version)",
      "Bash(claude --version)",
      "Bash(claude mcp list:*)",
      "Bash(claude mcp add:*)",
      "WebFetch(domain:api.search.brave.com)",
      "WebFetch(domain:www.firecrawl.dev)",
      "WebFetch(domain:firecrawl.dev)",
      "WebFetch(domain:exa.ai)",
      "WebFetch(domain:dashboard.exa.ai)",
      "WebFetch(domain:api.github.com)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:registry.npmjs.org)",
      "WebFetch(domain:www.npmjs.com)"
    ]
  }
}
```

**Safety principles in this list:**
- `Bash(rm -rf .claude-ecosystem-tmp:*)` — **scoped to bootstrap temp dir**, NOT general `rm -rf`. Cannot match `rm -rf .claude` or `rm -rf /`.
- `Bash(git clone --depth 1 https://github.com/IlyaNSV/...:*)` — **specific repo URL**, not general git clone.
- `WebFetch(domain:...)` — explicit allowlist of known service domains only.
- Broad `Read`/`Write`/`Edit` — bootstrap legitimately needs to create ~8 files; approving once at session start is less risky than 8 individual approvals.

**After bootstrap completes:** user can review `.claude/settings.local.json`, remove/tighten anything not needed for ongoing ecosystem use. The file is gitignored so changes are local-only.

If user declines → skip. They'll get individual Claude Code permission prompts as bootstrap progresses. Still safe, just more friction.

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

#### 6a. Copy base template

```bash
cp .claude/settings.json.template .claude/settings.json
```

The template sets:
- Default model: `claude-opus-4-7`
- Minimum safe permissions allowlist
- Empty hooks array (populated in 6b below)

#### 6b. Auto-register hooks from module manifests

Ecosystem phases add JS hooks under `.claude/hooks/<module>/`. Each module directory has a `manifest.yaml` describing which events + matchers each hook should register for. Bootstrap scans all manifests and merges registrations into `.claude/settings.json`.

**Process:**

1. **Scan** `.claude/hooks/*/manifest.yaml` files. If none exist → skip (no hooks to register).

2. **Parse each manifest** per schema documented in the manifest file header (fields: `version`, `module`, `hooks[]` with `id`, `file`, `events[]`, `description`).

3. **Build hook entries** per event type. For each `(event, matcher)` pair, collect all hook commands:
   ```
   "node .claude/hooks/<module>/<file>"
   ```

4. **Read existing** `.claude/settings.json` — preserve user-added hooks (merge, don't overwrite).

5. **Merge logic:**
   - For each event type (PostToolUse, PreToolUse, Stop, etc.):
     - For each unique matcher: collect all command entries (existing + new), deduplicate by command string
   - If user has custom hooks for same matcher — preserve them, add ecosystem hooks alongside
   - Order: ecosystem hooks first, user customizations after (so user can react to ecosystem findings)

6. **Write merged settings.json** back.

7. **Log summary** to user:
   ```
   Hooks registered:
     PostToolUse (matcher: Write|Edit):
       - node .claude/hooks/product/artifact-validate.js (inline validation)
       - node .claude/hooks/product/session-state.js (session snapshot)
     PostToolUse (matcher: ...): ...

   Total: N hooks across M event types
   ```

**Example result in `.claude/settings.json`** (after Phase 2 manifest processed):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/product/artifact-validate.js"
          },
          {
            "type": "command",
            "command": "node .claude/hooks/product/session-state.js"
          }
        ]
      }
    ]
  }
}
```

**Convention for future phases:** when adding new hook files, drop them alongside existing in `hooks/<module>/` AND add entry to `hooks/<module>/manifest.yaml`. Re-running `/ecosystem:bootstrap` (or future `/ecosystem:upgrade`) will re-scan manifests and update `settings.json`. Manifest is the single source of truth for hook registration.

**Idempotency:** running Step 6b on already-registered settings.json is safe — merge dedupes by command string. No double-registration.

**If manifest is missing for a module but hook files exist** → warn user, skip registration for that module. Suggest: create manifest.yaml per the convention in existing `hooks/product/manifest.yaml`.

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

**Pre-check:** verify `npx` availability from Step 1c. If missing → skip Step 9 with clear warning. User can install MCPs manually after fixing node env.

**Note on `/integrator:add`:** Ecosystem v1.0 ships Integrator Phase 1 only (read-only commands: `research`, `map`, `gaps`, `status`, `journal`, `scan`). The full `/integrator:add` command arrives in Phase 5 (Installation) per [ROADMAP.md](../../ROADMAP.md). **Until then, use `claude mcp add` CLI directly** — same end result.

Present the user with the Core MCP stack and proposed installs:

| # | MCP | Package | Keys needed | Purpose |
|---|---|---|---|---|
| 1 | Sequential Thinking | `@modelcontextprotocol/server-sequential-thinking` | — | Multi-step reasoning (required for F.5 IC, F.9 DA, research synthesis) |
| 2 | Memory | `@modelcontextprotocol/server-memory` | — | Cross-session knowledge graph, decision journal lookup |
| 3 | Firecrawl | `firecrawl-mcp` | `FIRECRAWL_API_KEY` | Deep mode research web scraping |
| 4 | Brave Search | `@modelcontextprotocol/server-brave-search` | `BRAVE_API_KEY` | Quick mode keyword lookups |
| 5 | Exa AI | `exa-mcp-server` | `EXA_API_KEY` | Semantic search ("tools that solve X for Y") |
| 6 | Context7 | `@upstash/context7-mcp` | — | Realtime package docs |
| 7 | GitHub | `@modelcontextprotocol/server-github` | `GITHUB_TOKEN` (optional) | CA Deep dev-tools research, NFR benchmarks |

#### Scope selection (important for security)

MCP installs can be scoped at three levels — this matters because **API keys MUST NOT end up in committed files**.

| Scope | Writes to | Committed? | Use when |
|---|---|---|---|
| `--scope local` | `.claude/settings.local.json` | ❌ gitignored | **Default.** Keys stay safe. Per-machine per-project. |
| `--scope project` | `.mcp.json` at project root | ✅ tracked | Team-shared no-key MCPs. **Never for keys.** |
| `--scope user` | `~/.claude/settings.json` | ❌ user-global only | MCPs you want across ALL projects. |

**Ecosystem 3.0 default for bootstrap: `--scope local` for ALL MCPs.**

Rationale:
- Keys never risk leaking into git (pilot-safe).
- Simpler mental model: «всё что установил bootstrap — local to this project».
- User can promote specific MCPs to `--scope project` later when team collaboration starts (move them manually to `.mcp.json`, but ONLY no-key ones).

#### Install commands

For each MCP user approves (verify `.env` has the key first for key-required MCPs):

```bash
# No-key MCPs
claude mcp add --scope local sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
claude mcp add --scope local memory -- npx -y @modelcontextprotocol/server-memory
claude mcp add --scope local context7 -- npx -y @upstash/context7-mcp

# Keys-required MCPs (read key values from .env, pass via -e)
claude mcp add --scope local firecrawl -e FIRECRAWL_API_KEY=<value-from-env> -- npx -y firecrawl-mcp
claude mcp add --scope local brave -e BRAVE_API_KEY=<value-from-env> -- npx -y @modelcontextprotocol/server-brave-search
claude mcp add --scope local exa -e EXA_API_KEY=<value-from-env> -- npx -y exa-mcp-server

# Optional (only if user provided GITHUB_TOKEN)
claude mcp add --scope local github -e GITHUB_TOKEN=<value-from-env> -- npx -y @modelcontextprotocol/server-github
```

Approve per-MCP. Skip any where user declined to provide key in Step 4.

#### Verification

```bash
claude mcp list
```

Expected: installed MCPs with health indicator (`✓ Connected` or `⚠ Starting...`). If any show `✗ Failed` — note for user to debug via `/integrator:debug` (when Phase 5 lands) or manually via `claude mcp get <name>`.

#### Skip scenarios

If user passed `--no-mcp` OR npx missing from Step 1c:

Skip Step 9 entirely. Note in final summary:
> «MCP stack skipped (<reason>). Install later via `claude mcp add --scope local <name> -- npx -y <pkg>` — see [.claude/docs/integrator-module/SPEC.md §14](../../docs/integrator-module/SPEC.md) for full stack specification.»

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
