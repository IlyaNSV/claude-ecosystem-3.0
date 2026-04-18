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

### Step 2: Build coverage table (new schema per SPEC §4.3 / §4.5)

Read `.claude/integrator/pmo-mapping.yaml` per canonical schema. For each PMO process entry in `coverage:`, extract:
- Tool(s) covering it
- `declared_confidence` (from tool profile §4.2)
- `empirical_confidence` (from usage_stats §4.4, computed per §4.5)
- `effective_confidence` = min(declared, empirical) when hybrid
- `last_smoke_test` + `last_smoke_result`
- Contract status

Display columns:

```
| Process | Tool          | Declared | Empirical | Effective | Last Smoke | Flags |
|---------|---------------|----------|-----------|-----------|------------|-------|
| D1      | Product Module (core) | high | —        | high      | n/a (core) | ✓     |
| D2-Behavioral | Product Module (core) | high | — | high  | n/a (core) | ✓     |
| D2-05   | Design Module (core)  | high | —        | high      | n/a (core) | ⚡ if has_ui |
| D2-Tech-02 | cc-sdd v2.3 | high     | high      | high      | 2026-04-18 pass | ✓ |
| D3-01   | beads v1.2    | medium   | low       | low       | 2026-04-10 pass | ⚠ drift (empirical < declared) |
| D4-01   | vitest v1.5   | high     | —         | high      | 2026-04-18 pass | ℹ️ new (<5 invoc) |
| D4-02   | — (uncovered)  | —        | —        | —         | —          | 🟡 needed @ mvp tier |
| D6      | Integrator (core) | high | —        | high      | n/a        | ✓     |
```

**Symbols для Effective column (primary visual):**
- ✓ high — full confidence, smoke passed, stable
- ◐ medium — partial confidence
- ⚠ low — low confidence, needs attention
- ❌ none — uncovered
- ⏸️ deferred — explicitly out of scope (from `deferred_by_design` list)

**Flags колонка (secondary signals):**
- ✓ — healthy
- ⚠ drift — declared/empirical differ by 1+ level (investigate)
- ℹ️ new — <5 invocations, empirical not yet trustworthy
- 🔴 broken — last_smoke_result: fail OR recent failures > 20%
- 🟡 stale — last_smoke_test > 30 days
- ⚡ conditional — active only if FM.has_ui=true (Design Module)

### Step 3: Visualize gaps and conflicts

After the table, summarize from `pmo-mapping.yaml`:

```
Coverage summary:
  Covered processes: X / Y (Z%)
    - high effective confidence: A
    - medium: B
    - low: C  ← investigate
  Uncovered (needed): <from uncovered[] with severity filter>
  Deferred by design: <from deferred_by_design[]>
  Multi-tool zones: <list from coverage[].covered_by.length > 1>
  Contract health: N total, M valid, K broken

Confidence source breakdown:
  declared-only: D tools (need more invocations for empirical)
  hybrid (both declared + empirical): E tools
  empirical-downgraded: F tools (declared was optimistic)

Smoke test status:
  Recent passes: <count>
  Recent failures: <count>
  Skipped (e.g., deploy tools): <count>
  Stale (>30 days): <count — warn these>
  Never tested: <count — add to /integrator:verify queue>
```

**Confidence drift section (NEW per §4.5):**

List zones where `declared_confidence != empirical_confidence`:

```
⚠ Confidence drift detected (declared ≠ empirical):

  D3-01 (beads):
    Declared: medium → Empirical: low
    Reason: 22% failure rate over last 50 invocations
    Suggested action: /product:meta-feedback (propose downgrade)
                   OR /integrator:debug beads (address root cause)

  D2-Tech-02 (cc-sdd):
    Declared: medium → Empirical: high
    Reason: 2% failure over 100+ invocations — tool more reliable than docs claim
    Suggested action: /product:meta-feedback (propose upgrade)
```

This is the **main empirical insight** команды — drift signals are actionable.

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
