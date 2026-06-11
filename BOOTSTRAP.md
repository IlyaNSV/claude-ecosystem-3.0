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

## Optional: open-design shared daemon (machine-global)

[open-design](https://github.com/nexu-io/open-design) (Apache-2.0) is an **alternative HTML viewer / migrate-target** for Stitch-generated mockups — an interactive iframe preview + multi-format export (html/pdf/pptx/mp4/zip), used via `/design:migrate <MK> --to open-design`. It is a **viewer, not a generator**: only visual HTML crosses; canon stays in MK/NM.

It runs as **one Docker daemon per machine** (not per project) on `127.0.0.1:7456`. All projects share it; per-project you only wire a thin contract/adapter. The host-Node route is intentionally avoided (open-design needs Node 24 + pnpm; a Dockerized daemon sidesteps host-version blockers).

### One-time machine setup

**1. Generate a machine-global token** (the daemon refuses to boot without `OD_API_TOKEN`; it is gitignored and shared by all projects):

```bash
mkdir -p ~/.claude/integrator/secrets
openssl rand -hex 32 > ~/.claude/integrator/secrets/open-design.token
```

```powershell
# Windows PowerShell equivalent
New-Item -ItemType Directory -Force "$HOME\.claude\integrator\secrets" | Out-Null
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) }) |
  Out-File -Encoding ascii -NoNewline "$HOME\.claude\integrator\secrets\open-design.token"
```

**2. Start the daemon** (bind to loopback; named volume persists imported projects):

```bash
docker run -d --name open-design -p 127.0.0.1:7456:7456 \
  -e OD_API_TOKEN="$(cat ~/.claude/integrator/secrets/open-design.token)" \
  -e OD_BIND_HOST=0.0.0.0 -e OD_PORT=7456 \
  -v open_design_data:/app/.od \
  docker.io/vanjayak/open-design:latest
```

> **Supply-chain caveat.** `vanjayak/open-design` is a personal-namespace image (reports `0.8.1`; upstream `main` is `0.9.0`), pre-1.0. For anything beyond a pilot, **pin a vetted digest** (`docker.io/vanjayak/open-design@sha256:<digest>`) **or build from source** (`git clone` the repo, then `docker compose -f deploy/docker-compose.yml up -d --build`). `:latest` is pilot-only.

**3. Health check** — every `/api/*` route (incl. `/api/health`) requires the Bearer token, because the Docker bridge makes host requests appear non-loopback. Use `127.0.0.1`, **not** `localhost` (Windows resolves `localhost` to `::1`, which the daemon refuses with `EACCES`):

```bash
curl -s -H "Authorization: Bearer $(cat ~/.claude/integrator/secrets/open-design.token)" \
  http://127.0.0.1:7456/api/health
# → 200 {"ok":true,"version":"0.8.1"}
```

### Per-project wiring (after the daemon is up)

```
> /ecosystem:update                       # pulls the reference adapter + design.yaml external_viewers default
> /integrator:add open-design             # thin install — validates daemon connectivity, instantiates CNT-003 adapter
> /design:migrate <MK-id> --to open-design  # imports the MK's visual HTML into the viewer
```

Token resolution precedence (so one machine-global token serves every project): `--token` → `$OD_API_TOKEN` → `~/.claude/integrator/secrets/open-design.token` → `<project>/.claude/integrator/secrets/open-design.token`. The reference adapter (`adapters/stitch-to-opendesign.js`) and the Dockerized-daemon tool pattern are documented in [`docs/integrator-module/SPEC.md §4.1.1`](docs/integrator-module/SPEC.md).

### Lifecycle

The daemon's lifecycle is **operator-owned** — `/integrator:add` and `/design:migrate` never auto-`docker run` it; they validate connectivity and point back here if it's down. Stop/restart with `docker stop open-design` / `docker start open-design`. Imported projects live in the `open_design_data` volume (not version-controlled).

## Troubleshooting

| Issue | Fix |
|---|---|
| `/ecosystem:bootstrap` not found in Claude Code | Phase 1 not done. Run the installer one-liner. |
| "Directory not empty" error | Use `/ecosystem:bootstrap --force` only if you understand you're installing over existing files |
| No network during bootstrap | Use `/ecosystem:bootstrap --offline` (copies from `~/.claude/ecosystem/` cache instead of git clone) |
| API keys forgotten / skipped | Edit `.env` manually later; Deep mode research will use fallback until filled |
| MCP install failed | Check `/integrator:journal` for error details; retry with `/integrator:add <mcp>` |
| open-design `/api/health` not 200 | Daemon down or token mismatch. Check `docker ps` for `open-design`; ensure Bearer token matches the container's `OD_API_TOKEN`; use `127.0.0.1` not `localhost` |
| open-design `EACCES` / connection refused on `localhost` | Use `http://127.0.0.1:7456` — Windows `localhost`→`::1` is refused |

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
