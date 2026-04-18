# BOOTSTRAP.md — Instructions for Claude Code

> **For Claude Code:** This file contains step-by-step instructions for setting up Ecosystem 3.0 in a new product project. Follow these steps when the user invokes you with intent to install/bootstrap the ecosystem.

## Recognition triggers

User says one of:
- "Установи Ecosystem 3.0"
- "Bootstrap ecosystem in this project"
- "Подготовь проект к работе с экосистемой"
- "Set up Claude ecosystem"

## Execution sequence

### Step 1: Verify environment

```
- Check current directory is empty or has only README/initial files
- Check git is available
- Check claude command itself is up-to-date (warn if old)
```

If directory is NOT empty (has src/, package.json, etc.):
- ASK USER: "В этой папке уже есть файлы. Установить ecosystem рядом (`.claude/` поверх существующего)? Или в чистую папку?"
- DO NOT proceed without explicit approval.

### Step 2: Clone ecosystem into .claude/

```bash
git clone https://github.com/IlyaNSV/claude-ecosystem-3.0.git .claude
```

Verify clone succeeded by checking `.claude/README.md` exists.

### Step 3: Initialize project structure

Create directories (do not create files yet):
```bash
mkdir -p .product/{segments,value-propositions,hypotheses,releases,features,scenarios,business-rules,lifecycles,verification,invariants,nfr,mockups,handoffs,notes,.sessions,.pending,.da-findings,.decisions}
```

### Step 4: Set up environment variables

1. Copy template: `cp .claude/.env.template .env`
2. ASK USER for API keys (read from [INSTALL-HUMAN.md](./INSTALL-HUMAN.md) what's required):
   - Brave Search API key
   - Firecrawl API key
   - Exa AI key
   - GitHub token (optional)
   - Stitch project URL (only if first feature has UI)
3. Save to `.env` (NEVER print full keys back to user — confirm receipt only)
4. Add `.env` to `.gitignore` (use template):
   ```bash
   cp .claude/gitignore.template .gitignore
   ```

### Step 5: Configure Claude Code settings

1. Copy template: `cp .claude/settings.json.template .claude/settings.json`
2. The default model is `claude-opus-4-7` for product/strategic work.
3. Hooks are EMPTY at this stage — they get registered in subsequent phases when modules activate.

### Step 6: Verify Integrator module is read-only ready

Integrator Phase 1 commands (`research`, `map`, `gaps`, `status`, `journal`, `scan`) should be present at:
```
.claude/commands/integrator/
```

Verify by listing: `ls .claude/commands/integrator/`

### Step 7: Install Core MCP stack

Run:
```
/integrator:research "Core MCP stack for Ecosystem 3.0"
```

This presents the user with the recommended MCP stack:
- Sequential Thinking
- Memory MCP
- Firecrawl
- Brave Search
- Exa AI
- Context7
- GitHub Official MCP

Then for each MCP:
```
/integrator:add <mcp-name>
```

Get user approve per MCP. Skip ones user declines (e.g., GitHub MCP if no token).

### Step 8: Create initial product config

Create `.claude/product.yaml`:
```yaml
version: 1
project_name: <ask user for project name>
project_language: ru                     # or detected from user dialogue
validation_tier: pilot                   # B1 modification — start minimal
default_discovery_mode: quick
nfr_default_tier: mvp

# Confidence field handling (C2 modification)
confidence_required_at_approve: true
auto_approve_confirmation_artifacts:     # A1 modification
  enabled: true
  requires_high_confidence: true

# Hooks behavior (B2 modification)
draft_mode_quiet_hooks: true
```

### Step 9: Initialize git in product project

If project is greenfield:
```bash
git init
git branch -m main
```

DO NOT auto-commit. Let user verify state first.

### Step 10: Final verification

Run:
```
/integrator:status
```

Expected output:
- Active tools: 6-7 MCPs (depending on user choices)
- Contracts: 0 (no D2-Tech tool yet)
- PMO mapping: Product Module covering D1-D2-Behavioral, Design Module conditional, Integrator covering infrastructure

### Step 11: Ready prompt

Tell user:
> "Ecosystem 3.0 готова к работе. Что дальше?
>
> [1] /product:init — начать новый продукт с Discovery (рекомендую начать с этого)
> [2] /integrator:gaps — посмотреть, какие зоны PMO не покрыты
> [3] /product:status — общий обзор `.product/` (пока пусто)
>
> Если выбираешь /product:init — приготовься: 30-90 минут разговора (Quick mode) или 2-4 часа (Deep mode). В Quick mode можно прерваться и продолжить через --continue."

## Error handling

| Error | Action |
|---|---|
| Git clone failed | Check network. Suggest manual clone. Do not proceed. |
| Empty directory check failed | Ask user explicitly before proceeding. |
| API key missing | Skip relevant MCP installation; warn user that some features will use fallback (WebFetch instead of Firecrawl, etc.) |
| MCP installation failed | Log to journal, continue with rest. Surface at end as "MCP X failed, here's why". |
| product.yaml exists | Read existing, ASK user before overwriting. |

## What NOT to do

- DO NOT auto-commit anything to git without explicit user approve.
- DO NOT push API keys, secrets, or any `.env` content to any remote.
- DO NOT install MCPs without per-MCP user approve (DEC-INT-P01).
- DO NOT bypass any approve gate even if "looks safe".
- DO NOT skip Step 4 environment setup — Discovery Deep mode will fail without keys.
- DO NOT pre-create artifacts in `.product/` — that's Product Module's job via `/product:init`.

## Resumability

If bootstrap is interrupted:
- Re-running this flow detects existing `.claude/` and `.product/`
- Asks user: "Detected partial bootstrap. Continue from Step X or restart?"
- Skips already-completed steps (verifies state, doesn't redo)
