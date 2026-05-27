---
description: Show current PMO coverage by active tools. Read-only.
---

# /integrator:map

Display the current PMO coverage of the project.

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js`. Cleanup at Final step.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:map","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

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
  - Design Module: D2-B04 (when has_ui=true)
  - Integrator: infrastructure (this is me)
```

### Step 2: Build coverage table (schema per SPEC §4.3)

Read `.claude/integrator/pmo-mapping.yaml`. For each PMO process entry in `coverage:`, extract:
- Tool(s) covering it
- `confidence` (declared, per tool profile §4.2)
- `evidence` (brief rationale)
- Contract status
- Since date

Display columns:

```
| Process       | Tool                  | Confidence | Evidence         | Contracts |
|---------------|-----------------------|------------|------------------|-----------|
| D1            | Product Module (core) | high       | built-in         | —         |
| D2-Behavioral | Product Module (core) | high       | built-in         | —         |
| D2-B04        | Design Module (core)  | high ⚡    | conditional has_ui | MK-sync |
| D2-T01        | cc-sdd v2.3           | high       | docs + example   | CNT-001   |
| D2-T06        | cc-sdd v2.3           | high       | spec-tasks output | CNT-001  |
| D3-01         | beads v1.2            | medium     | inferred from docs | CNT-003 |
| D4-03         | — (uncovered)         | —          | —                | —         |
| D6            | Integrator (core)     | high       | built-in         | —         |
```

**Symbols для Confidence:**
- `high` — явно документировано + evidence convincing
- `medium` — documented, но неясна проверенность
- `low` — inferred indirectly
- `—` / `none` — uncovered
- `deferred` — explicitly out of scope (из `deferred_by_design`)

**Flags (если applicable):**
- ⚡ conditional — Design Module active только при FM.has_ui=true
- 🟡 needs re-audit — `last_audit` > 60 days
- ⚠ contract broken — contract verify failed last check

### Step 3: Visualize gaps and conflicts

After the table, summarize from `pmo-mapping.yaml`:

```
Coverage summary:
  Covered processes: X / Y (Z%)
    - high confidence: A
    - medium confidence: B
    - low confidence: C  ← investigate
  Uncovered (needed): <from uncovered[] with severity filter>
  Deferred by design: <from deferred_by_design[]>
  Multi-tool zones: <list from coverage[].covered_by.length > 1>
  Contract health: N total, M valid, K broken
  Last audit: <date from meta.last_audit>
```

**Если observed issues (из journal entries с тегом #drift-fix или #error-fix):**

```
Recent issues (from journal):
  D3-01 (beads): 3 debug sessions в last 14 days — rule of thumb, confidence may be too high
    → Consider /product:meta-feedback propose downgrade, OR /integrator:debug <tool> если issue systematic
```

Это **human-discovered** feedback loop (не автоматический tracking). Journal — source of truth.

### Step 4: Recommendations

Based on coverage state, suggest next actions:

- If there are critical gaps before shipping → suggest `/integrator:research <gap-area>`
- If contracts are broken → suggest `/integrator:debug "<contract-name> broken"`
- If everything's covered → "PMO coverage complete for current scope. Ready to ship."

## Format

Use clear visual hierarchy. Tables should be readable in terminal. Include emojis for status (✓ ❌ ⏸️ ⚠️) but sparingly.

### Final: Cleanup session marker

```bash
rm -f .claude/integrator/.session-context.json
```

## Important constraints

- **READ-ONLY.** Never modify files.
- **No assumptions about gaps' criticality.** Mark as "critical" only based on FM in `.product/features/` (what user is actually building) — not based on PMO theory.
- **Express your own confidence on coverage assessment** (C2 modification): if `pmo-mapping.yaml` is stale or incomplete, say so explicitly.
