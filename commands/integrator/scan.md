---
description: Scan project environment to detect existing customizations and conflicts before any modifying action.
---

# /integrator:scan

Build / refresh the **environment baseline** — what existing customizations are in `.claude/`, `.mcp.json`, settings.json, etc., **before** any `/integrator:add/update/replace` modifies things.

This protects user-created hooks, commands, agents from being silently overwritten when adding new tools.

## When to run

- **Manually** before `/integrator:add` if you suspect existing customizations
- **Automatically** invoked before `/integrator:add`, `/integrator:update`, `/integrator:replace` (Integrator itself runs this)
- **Periodically** to refresh baseline (recommended monthly)

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js`. Cleanup in Step 8 (Final).

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:scan","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Initialize integrator state if needed

If `.claude/integrator/` doesn't exist (lazy-init per DEC-INT-O08):
```bash
mkdir -p .claude/integrator/{contracts,adapters,tool-docs,backups,secrets}
```

Create `.claude/integrator/secrets/.gitkeep` and add a note that secrets/ is gitignored.

### Step 2: Scan zones

For each zone listed in `.claude/docs/integrator-module/SPEC.md §12.2`, scan and catalog:

| Zone | What to find |
|------|--------------|
| `.claude/hooks/*` | All hook files (JS, TS, sh, py); read first 20 lines for purpose hint |
| `.claude/commands/*` | All slash commands; note namespaces in use |
| `.claude/agents/*` | All subagent files |
| `.claude/skills/*` | All skill files |
| `.claude/settings.json` | Hook registrations, permission rules |
| `.mcp.json` (or settings.json mcpServers) | Installed MCP servers + versions |
| `package.json` (if exists) | npm dependencies |
| `.gitignore` | Confirm `.claude/integrator/secrets/` is ignored |
| `~/.claude/memory/` | (read-only — global user memory) |

### Step 3: Classify findings

For each found item, classify into:

- **`integrator_owned`** — added by Integrator (file path matches a known tool's `claude_primitives` from active-tools.yaml)
- **`user_customizations_to_preserve`** — added by user (not in any tool's primitives)
- **`unknown`** — can't determine; flag for user clarification

For unknown items, attempt "guess purpose" per SPEC §12.5:
- Read first 20 lines of file
- Look for `// Purpose:` or JSDoc comments
- Check git log for last commit message
- Check settings.json matcher (for hooks) for event type

### Step 4: Detect potential conflicts

For each known tool's `claude_primitives` (in `~/.claude/integrator/tool-catalog/`), check if any user customizations exist at the path that tool would want to claim.

Report per potential conflict:
```
Potential conflict if installing <tool>:
  Tool wants: .claude/hooks/git-precommit.js
  Currently exists: .claude/hooks/custom-git-precommit.js (user, purpose: "TS typecheck")
  Resolution required at /integrator:add <tool> time.
```

### Step 5: Write baseline

Save to `.claude/integrator/baseline.yaml`:

```yaml
scanned_at: 2026-04-18T15:30:00Z
scan_trigger: manual | pre-install-<tool>

existing:
  hooks:
    - path: .claude/hooks/custom-git-precommit.js
      author: user
      purpose: "guess: TS typecheck"
      modified: 2026-04-15
    # ...
  commands:
    namespaces_in_use: [product, design, integrator, custom]
  agents:
    - path: .claude/agents/product/devils-advocate.md
      author: integrator (ecosystem 3.0 core)
  skills:
    - # ...
  mcps_installed:
    - name: sequential-thinking
      version: latest
    # ...

integrator_owned:
  - .claude/agents/product/devils-advocate.md
  - .claude/hooks/product-artifact-validate.js
  # (populated based on active-tools.yaml's claude_primitives)

user_customizations_to_preserve:
  - .claude/hooks/custom-git-precommit.js

conflicts_detected: []
unknown_files:
  - path: .claude/hooks/typecheck.sh
    reason: "no comments, no git log, no settings.json matcher"
    needs_user_clarification: true
```

### Step 6: Report to user

```
═══════════════════════════════════════════════════════════
ENVIRONMENT SCAN RESULT
═══════════════════════════════════════════════════════════
Scanned: <timestamp>
Trigger: <manual | pre-install>

EXISTING (<count>)
  Hooks: <count>
  Commands: <count>
  Agents: <count>
  Skills: <count>
  MCPs: <count>

INTEGRATOR-OWNED: <count>
USER CUSTOMIZATIONS: <count>
UNKNOWN (need clarification): <count>

CONFLICTS:
  None detected (or list)

UNKNOWN FILES requiring clarification:
  .claude/hooks/typecheck.sh — what does this do? Should we keep it?

Baseline saved to: .claude/integrator/baseline.yaml

Next:
  - Resolve unknown files (ask user, then re-tag in baseline)
  - Or proceed with /integrator:add — Integrator will reference this baseline
```

### Step 7: Backup before any future change

This scan establishes baseline. Future `/integrator:add/update/replace` will:
1. Create timestamped backup in `.claude/integrator/backups/<timestamp>/` of any file it's about to modify
2. Reference baseline.yaml to ensure user customizations aren't touched

### Step 8: Final — cleanup session marker

```bash
rm -f .claude/integrator/.session-context.json
```

## Important constraints

- **NON-DESTRUCTIVE.** Scan only reads; doesn't modify any user files.
- **Lazy creation OK.** If `.claude/integrator/` doesn't exist, create it (per DEC-INT-O08).
- **No assumptions about unknowns.** If purpose can't be guessed, ask user — don't guess wrong.
- **Confidence (C2):** state confidence about each classification. Unknown files = low confidence.
