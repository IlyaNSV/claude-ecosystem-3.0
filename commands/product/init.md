---
description: Start P1.A Discovery Session for a new product. Creates PS, MR, CA, SEG, VP, HYP artifacts.
argument-hint: "<idea description> OR --continue OR --deep OR --pivot"
---

# /product:init

User invoked: `/product:init $ARGUMENTS`

## Process

This command orchestrates **P1.A Discovery Session** per `.claude/docs/pmo/processes.md §3.1`. Load skill `.claude/skills/product/discovery-session.md` as primary orchestrator.

### Step 1: Parse arguments

- `--continue` — resume from `.product/.sessions/current.yaml` (Session Recovery per SPEC §11)
- `--deep` — activate Deep mode: spawn `market-researcher` and `competitor-analyst` subagents for D1.2 / D1.3 (8-phase pipeline)
- `--pivot` — out-of-scope in v1 (per DEC-P08 / Q-11); respond with "Pivot cascade is v2 feature. Use manual /product:init to restart" and stop
- `"<idea description>"` — raw text describing the product idea; entry into Quick mode by default

### Step 2: Mode selection

If no mode flag:
1. Read `.claude/product.yaml.default_discovery_mode` (default: `quick`)
2. Ask user: `Discovery Session started. Mode: [Q]uick | [D]eep | [C]onfig?` with explanation:
   - **Quick** (~30-60 min): lightweight research via Brave + Firecrawl; PS→HYP in one session
   - **Deep** (~2-4 hours): spawns research subagents; credibility-scored MR/CA; thorough synthesis
   - **Config**: show current defaults, offer to change

### Step 3: Check prerequisites

- `.product/` directory exists (bootstrap should have created skeleton)
- MCP Core stack available (check which MCPs respond); if Deep mode requested but Firecrawl/Exa missing — warn + offer Quick fallback
- No existing active PS (if PS active → ask: continue existing Discovery or restart?)

### Step 3b: Initialize session state files

Before loading `discovery-session` skill, initialize two session state files в `.product/.sessions/` (создать директорию если её нет).

**`current.yaml`** — pre-set `type` и `started_at` чтобы `session-state.js` hook не defaulted к `'unknown'` на первом write:

```yaml
# Session state — initialized by /product:init command.
# Subsequently managed by session-state.js hook on each .product/ write.

session_id: "<ISO-timestamp>-discovery-<project_name>"
type: discovery-session
started_at: "<ISO timestamp>"
```

Hook (Step 4+) на первой Write/Edit в `.product/` прочитает existing `type`/`started_at` и сохранит их — не перезапишет defaults.

**`discovery-progress.yaml`** — initial orchestration state для skill:

```yaml
session_id: "<same as current.yaml>"
type: discovery-session
mode: <quick|deep per Step 2>
started_at: "<ISO timestamp>"
project: "<from product.yaml.project_name>"
language: "<from product.yaml.project_language>"

current_step: D1.0
last_completed_step: null
last_approved_gates: []

pending_drafts: []
artifacts_active: []
bg_candidates_queued: 0
bg_synonym_warnings: 0

next_steps:
  - D1.0 Product Classification (product.yaml; advisory, not a gate)
  - D1.1 Problem Discovery → G1

progress_percent: 0
```

Этот файл обновляется skill'ом `discovery-session.md` на каждом approve gate (см. секцию "Session state management" в skill).

**Если `--continue` flag:** читать существующие файлы вместо создания новых; resume с `current_step` в `discovery-progress.yaml`.

### Step 4: Delegate to discovery-session skill

Load `discovery-session.md`. It handles:
- D1.0 Product Classification (writes `product_class` to `product.yaml`; advisory, not a gate — DEC-DEV-0079)
- D1.1 Problem Discovery (G1 approve)
- D1.2 Market Research (queued for Discovery Review Checkpoint — A2 modification)
- D1.3 Competitive Analysis (queued for DRC)
- D1.4 Segment & JTBD (G4 per-SEG)
- Discovery Review Checkpoint (batch approve MR + CA — A2)
- D1.4a Value Proposition (G4a per-VP)
- D1.5 Hypothesis Formulation (G5 per-HYP)
- D1.5z Final BG extraction pass

### Step 5: Session state

Throughout, `product-session-state.js` hook snapshots progress to `.product/.sessions/current.yaml`. If interrupted → `/product:init --continue` resumes from last completed step.

### Step 6: Completion

When all gates passed + BG extraction done:
- Session state archived to `.product/.sessions/<timestamp>-complete.yaml`
- Summary report:
  ```
  Discovery Session complete.
  Artifacts created:
    ✓ product_class (product.yaml: <archetype>)
    ✓ PS (problem.md)
    ✓ MR (market-research.md, <N> sources, credibility med-high)
    ✓ CA (competitive-analysis.md, <N> competitors)
    ✓ SEG-001..00N (<N> segments)
    ✓ VP-001..00N (per segment)
    ✓ HYP-001..00N (status=testing)
    ✓ BG (<N> terms)

  Next: /product:plan (MVP scope + roadmap + FM skeletons)
  ```

## Important constraints

- **Human-approved approach** (DEC-P13) — ассистент делает drafts, human approves per gate
- **Quick mode first** — если MCP core stack неполный, work in Quick mode с WebFetch fallback
- **Iteration normal** — 2-4 рунда обсуждения per artifact is expected (P2)
- **Confidence articulation** (C2) — при каждом approve gate assistant explicitly states `confidence: high | medium | low` with rationale
- **A2 modification** — G2 (MR) и G3 (CA) **не отдельные gates**; идут через Discovery Review Checkpoint после G4

## Error handling

| Error | Action |
|---|---|
| `.product/` не существует | Suggest `/ecosystem:bootstrap` first |
| MCP Firecrawl/Exa missing in Deep mode | Offer Quick fallback with warning |
| Session corrupted на `--continue` | Show recovery options: start fresh / recover from last approved / manual edit session file |
| User interrupts mid-gate | Save partial progress; `--continue` resumes from last approved artifact |

## Related

- Process: `.claude/docs/pmo/processes.md §3.1` (P1.A Discovery)
- Skill: `.claude/skills/product/discovery-session.md`
- Next command: `/product:plan` (P1.B Planning, after Discovery complete)
