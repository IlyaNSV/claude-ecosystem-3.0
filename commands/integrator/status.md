---
description: Full Integrator state overview. Read-only.
---

# /integrator:status

Display comprehensive overview of Integrator's current state.

## Process

### Step 1: Check Integrator initialization

If `.claude/integrator/` doesn't exist:
```
Integrator not initialized in this project.

Read-only commands work from global state (~/.claude/integrator/).
Modifying commands (/integrator:add, etc.) will create local state lazily.

Use /integrator:research <need> to start finding tools.
```

If it exists, proceed.

### Step 2: Gather state

Read:
- `.claude/integrator/active-tools.yaml` — installed tools
- `.claude/integrator/pmo-mapping.yaml` — PMO coverage
- `.claude/integrator/contracts/` — active contracts (count + status)
- `.claude/integrator/project-journal.md` — recent entries (last 5)
- `~/.claude/integrator/decision-journal.md` — recent global entries (last 3)
- `~/.claude/integrator/tool-catalog/` — global catalog size
- `.claude/integrator/baseline.yaml` — last environment scan (if exists)

### Step 3: Format output

```
═══════════════════════════════════════════════════════════
INTEGRATOR STATUS
═══════════════════════════════════════════════════════════

Project: <name>
Last verify: <date>
Health: 🟢 Healthy | 🟡 Degraded | 🔴 Issues

ACTIVE TOOLS (<count>)
  ✓ <tool-1> v<version>   — <PMO zone>   — <last verified>
  ✓ <tool-2> v<version>   — <PMO zone>   — <last verified>
  ⚠ <tool-3> v<version>   — <PMO zone>   — drift detected

CONTRACTS (<count> total, <broken> broken)
  ✓ CNT-001  product-handoff → cc-sdd spec-init
  ✓ CNT-002  spec-tasks → beads
  ⚠ CNT-003  custom contract — drift since 2026-04-15

PMO COVERAGE
  D1, D2-Behavioral: 100% (Product Module — core)
  D2-05: <% if Design Module active>
  D2-Tech: <% based on installed tools>
  D3, D4, D5: <% based on installed tools>
  D6: 100% (Integrator — core)

PENDING ACTIONS (<count>)
  - 2 MCPs available for update (Brave Search 1.5 → 1.6)
  - 1 broken contract: /integrator:debug "CNT-003"
  - Last verify >7 days ago: consider /integrator:verify

GLOBAL CATALOG (~/.claude/integrator/)
  Profiled tools: <count>
  Cached research entries: <count>
  Last global activity: <date>

RECENT JOURNAL (last 5 entries)
  2026-04-18  DEC-INT-0042  Replaced custom-git-hooks with beads
  2026-04-15  DEC-INT-0041  Updated cc-sdd 2.1 → 2.3
  ...

ENVIRONMENT BASELINE
  Last scan: <date or "never">
  User customizations preserved: <count>
  Conflicts pending resolution: <count>
```

### Step 4: Suggest next actions

Based on state:
- If contracts broken → suggest `/integrator:debug`
- If updates pending → suggest `/integrator:update <tool>`
- If verify stale → suggest `/integrator:verify`
- If everything healthy → "All systems healthy. Nothing to do."

## Important constraints

- **READ-ONLY.**
- **Be honest about issues.** If something looks broken, say so directly.
- **Don't pad.** If the project is fresh and only has 2 tools, the status output should be short.
- **Performance:** this command may be invoked frequently — keep it under 2 seconds. Cache nothing; just read fast.
