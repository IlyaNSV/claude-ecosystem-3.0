---
description: Show current PMO coverage by active tools. Read-only.
---

# /integrator:map

Display the current PMO coverage of the project.

## Process

### Step 1: Read state

```
1. .claude/integrator/active-tools.yaml         (list of installed tools)
2. .claude/integrator/pmo-mapping.yaml          (which tool covers which PMO zone)
3. .claude/integrator/contracts/                (active contracts)
4. .claude/docs/pmo/pmo-map.md                  (canonical PMO structure)
```

If `.claude/integrator/active-tools.yaml` doesn't exist — Integrator hasn't been used in this project yet. Display:

```
No active tools yet.

Integrator hasn't installed anything in this project. To start:
  - /integrator:research "<need>"  — find tools for a need
  - /integrator:add <tool>          — install a specific tool

For Ecosystem 3.0 modules (Product, Design, Integrator self) — they're
core, not "installed". Their coverage:
  - Product Module: D1, D2-Behavioral
  - Design Module: D2-05 (when has_ui=true)
  - Integrator: infrastructure (this is me)
```

### Step 2: Build coverage table

For each PMO domain (D1-D6), check what's covered:

```
| Domain | Process | Coverage | Tool | Confidence | Contracts |
|--------|---------|----------|------|------------|-----------|
| D1     | All     | ✓ Full   | Product Module | high | — (core) |
| D2-Behavioral | All | ✓ Full | Product Module | high | — (core) |
| D2-05  | UX/UI   | ✓ if has_ui | Design Module | high | MK-* sync |
| D2-Tech | Architecture | ❌ NONE | — | — | — |
| D2-Tech | Tasks | ❌ NONE | — | — | — |
| D3-01  | Implementation | ❌ NONE | — | — | — |
| D4-*   | QA | ❌ NONE | — | — | — |
| D5     | Operations | ❌ NONE (out of scope MVP) | — | — | — |
| D6     | Meta | ✓ Full | Integrator (me) | high | — (core) |
```

Use these symbols:
- ✓ Full — covered by tool with high confidence
- ◐ Partial — covered with medium confidence, or only some processes
- ❌ NONE — not covered
- ⏸️ Out of scope — explicitly deferred (e.g., D5 in MVP)

### Step 3: Visualize gaps and conflicts

After the table, summarize:

```
Coverage summary:
  Covered: X / Y PMO processes (Z%)
  Critical gaps: <list of D2-Tech, D3, D4 zones not covered if planning to ship>
  Multi-tool zones (potential conflicts): <list if any zone has 2+ tools>
  Contract health: N contracts, M valid, K broken (if any)
```

### Step 4: Recommendations

Based on coverage state, suggest next actions:

- If there are critical gaps before shipping → suggest `/integrator:research <gap-area>`
- If contracts are broken → suggest `/integrator:debug "<contract-name> broken"`
- If everything's covered → "PMO coverage complete for current scope. Ready to ship."

## Format

Use clear visual hierarchy. Tables should be readable in terminal. Include emojis for status (✓ ❌ ⏸️ ⚠️) but sparingly.

## Important constraints

- **READ-ONLY.** Never modify files.
- **No assumptions about gaps' criticality.** Mark as "critical" only based on FM in `.product/features/` (what user is actually building) — not based on PMO theory.
- **Express your own confidence on coverage assessment** (C2 modification): if `pmo-mapping.yaml` is stale or incomplete, say so explicitly.
