# BOOTSTRAP — Installation Overview

> **For humans reading the repo.** This document explains **what** and **how** of installing Ecosystem 3.0. The executable instructions live in the `/ecosystem:bootstrap` slash command; this file describes the design.

## Two-phase install

Ecosystem 3.0 uses a two-phase installation model:

```
  Phase 1: Global install                Phase 2: Per-project bootstrap
  (once per machine)                      (per new product project)

  ┌────────────────────┐                 ┌───────────────────────┐
  │ install.sh / .ps1  │                 │ /ecosystem:bootstrap  │
  │                    │                 │                       │
  │ Clones repo to     │                 │ Clones ecosystem into │
  │ ~/.claude/         │  ─────────►     │ <project>/.claude/    │
  │   ecosystem/       │                 │ Initializes .product/ │
  │                    │                 │ Generates CLAUDE.md   │
  │ Registers global   │                 │ Sets up .env, config  │
  │ /ecosystem:*       │                 │ Prompts MCP installs  │
  │ commands           │                 │                       │
  └────────────────────┘                 └───────────────────────┘
```

This separation solves a chicken-and-egg problem: Claude Code can only autocomplete slash commands it finds in `~/.claude/commands/` or `<project>/.claude/commands/`. Until something installs them, `/ecosystem:bootstrap` is unknown. The global installer (Phase 1) registers the command globally; `/ecosystem:bootstrap` (Phase 2) then sets up each project.

## Phase 1 — Global install

**One-time per machine.**

### Unix / macOS / WSL

```bash
curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
iwr -useb https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.ps1 | iex
```

### What it does

1. Clones this repo to `~/.claude/ecosystem/` (global cache).
   - If already present, pulls latest `main`.
2. Copies `commands/ecosystem/*.md` to `~/.claude/commands/ecosystem/`.
   - Makes `/ecosystem:bootstrap` and `/ecosystem:verify` available in any Claude Code session.
3. Prints next-steps instructions.

### Idempotent

Re-running the installer updates the global cache to latest `main`. Safe to run anytime to refresh.

### Uninstall

```bash
rm -rf ~/.claude/ecosystem ~/.claude/commands/ecosystem
```

No other system changes are made.

## Phase 2 — Per-project bootstrap

**Once per new product project.**

After Phase 1 is done:

```bash
mkdir my-new-product && cd my-new-product
claude
```

Then in Claude Code:

```
> /ecosystem:bootstrap
```

(Autocomplete works — no need to remember the full command.)

### What it does

The command is executed by Claude Code from the content of `.claude/commands/ecosystem/bootstrap.md` (or this repo's `commands/ecosystem/bootstrap.md` for reference).

High-level steps:

1. **Environment check** — verify working directory is writable and not a protected location.
2. **Clone or copy ecosystem** into `<project>/.claude/`.
3. **Initialize `.product/`** skeleton (empty directories, no artifacts yet).
4. **Set up `.env`** from template, asking for API keys interactively (Brave, Firecrawl, Exa, etc.).
5. **Set up `.gitignore`** — ecosystem-compatible entries.
6. **Configure `.claude/settings.json`** — default model, permissions.
7. **Create `.claude/product.yaml`** — project-specific config (name, language, validation tier).
8. **Generate `CLAUDE.md`** at project root from `templates/project/CLAUDE.md.template` — gives Claude Code immediate context about the project's structure, conventions, and ecosystem integration.
9. **Install Core MCP stack** (per approval) — Sequential Thinking, Memory, Firecrawl, Brave, Exa, Context7, GitHub.
10. **Initialize git** (if greenfield) — creates repo but does NOT auto-commit.
11. **Verify** via `/integrator:status`.
12. **Ready prompt** — suggests next actions.

See [`commands/ecosystem/bootstrap.md`](commands/ecosystem/bootstrap.md) for full details, error handling, flags (`--offline`, `--no-mcp`, `--force`), and resumability behavior.

### Prerequisites for bootstrap

See [INSTALL-HUMAN.md](./INSTALL-HUMAN.md) for the pre-install human checklist:
- Claude Code installed and current
- git configured
- API keys obtained (Brave, Firecrawl, Exa minimum)
- (Optional) Stitch project, GitHub token

## Result structure after Phase 2

```
my-new-product/
├── .claude/              ← ecosystem (commands, skills, agents, hooks, docs)
│   ├── commands/
│   ├── skills/
│   ├── agents/
│   ├── hooks/
│   ├── docs/
│   ├── product.yaml      ← project config
│   ├── settings.json     ← Claude Code settings
│   └── integrator/       ← lazy-created on first /integrator:add
├── .product/             ← artifact workspace (empty skeleton)
├── CLAUDE.md             ← project context for Claude Code
├── .env                  ← API keys (gitignored)
└── .gitignore            ← ecosystem-compatible
```

Your actual project code (`src/`, `app/`, `backend/`, etc.) lives alongside this, untouched by the ecosystem.

## Verification

To confirm everything's healthy at any point:

```
> /ecosystem:verify
```

Non-destructive health check. Reports state of `.claude/`, `.product/`, critical files, installed MCPs, git status. See [`commands/ecosystem/verify.md`](commands/ecosystem/verify.md).

## Update later

To update an installed project to the latest ecosystem version, run `/ecosystem:update` inside that project. It syncs the ecosystem zone (commands/skills/agents/hooks/docs/templates), re-derives hooks from the latest manifests, and preserves your user zone (`.product/`, config, secrets) with a timestamped backup by default. Run it with `--dry-run` first to preview the changeset.

A future `/ecosystem:upgrade` (v1.1) will layer automatic breaking-change migration on top of `/ecosystem:update`.

## Troubleshooting

| Issue | Fix |
|---|---|
| `/ecosystem:bootstrap` not found in Claude Code | Phase 1 not done. Run the installer one-liner. |
| "Directory not empty" error | Use `/ecosystem:bootstrap --force` only if you understand you're installing over existing files |
| No network during bootstrap | Use `/ecosystem:bootstrap --offline` (copies from `~/.claude/ecosystem/` cache instead of git clone) |
| API keys forgotten / skipped | Edit `.env` manually later; Deep mode research will use fallback until filled |
| MCP install failed | Check `/integrator:journal` for error details; retry with `/integrator:add <mcp>` |

## For ecosystem developers

If you're working **on** Ecosystem 3.0 (not just using it), you likely have this repo checked out directly:

```bash
git clone https://github.com/IlyaNSV/claude-ecosystem-3.0.git
cd claude-ecosystem-3.0
```

To test changes locally without pushing to GitHub:
1. Edit files in this repo.
2. Run `install.sh` / `install.ps1` with `ECOSYSTEM_REPO_URL` pointing to local path, OR
3. Manually copy edited commands into `~/.claude/commands/ecosystem/`.

For development, `.idea/` is in `.gitignore`.
