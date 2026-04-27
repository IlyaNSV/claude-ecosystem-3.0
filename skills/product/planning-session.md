---
description: P1.B Planning Session orchestrator. Manages D1.6-D1.8 steps + per-artifact approve gates. Used by /product:plan after Discovery complete.
---

# Planning Session — Orchestrator Skill

Used by `/product:plan`. Orchestrates **P1.B Planning Session** per `.claude/docs/pmo/processes.md §3.2` (D1.6 MVP → D1.7 RM → D1.8 RL-001 + FM skeletons).

## Prerequisites

Discovery Session must be complete:
- `.product/problem.md` (PS) в active
- `.product/market-research.md` (MR) в active
- `.product/competitive-analysis.md` (CA) в active
- ≥1 SEG-* в active (primary identified)
- ≥1 VP-* в active
- ≥1 HYP-* в `testing` (or validated/invalidated; primary candidate identifiable)

If prerequisites missing — refuse early с suggestion `/product:init` first. List missing artifacts explicitly.

## Flow

### D1.6 MVP Scope Definition → MVP approve

Load `.claude/skills/product/mvp-scoping.md`. Skill produces draft → human iterates → approve.

**Approve gate (🟠 Strategic, per-item):**
- Present final MVP draft с MoSCoW prioritization
- Assistant states confidence (C2): «Confidence: <level> — <rationale>»
- Human approves → MVP status=active, version: 1
- **Post-approve actions** (orchestrator handles):
  - BG extraction queued (bold terms из MVP body → bg-candidates queue)
  - Decision journal entry в `.product/.decisions/journal.md` (Strategic level — see DEC-DEV-0013 #9 для format)
  - Update planning-progress.yaml (см. Session state management)

### D1.7 Product Roadmap → RM approve

Load `.claude/skills/product/roadmap-planning.md`.

**Approve gate (🟡 Standard, per-item — RM is singleton):**
- Present RM draft с horizon goals + release sequence + validation cadence
- Confidence statement
- Human approves → RM status=active
- Post-approve: BG extraction, journal entry, version++

### D1.8 Release Planning → RL-001 + FM skeletons approve

Load `.claude/skills/product/release-planning.md`.

**Two-phase output** (per skill structure):
1. **RL-001 plan** approved as one item (🟡 Standard)
2. **Per-FM skeleton** approved per-item (🟠 Strategic)

**Approve gate sequence:**
- RL-001: Standard approve
- Per FM in RL-001.features: Strategic approve (per-FM)

**After all FM skeletons approved:**
- Verify bi-dir consistency (RL.features[] ↔ FM.release for each FM)
- Update planning-progress.yaml.current_step → complete

### Completion

Summary report:
```
Planning Session complete.
Artifacts created:
  ✓ MVP (mvp-scope.md, primary HYP-<NNN>)
  ✓ RM (roadmap.md, horizon <X>)
  ✓ RL-001 (releases/RL-001-<slug>.md, target <date>)
  ✓ FM-001..00N (features/FM-*-*.md, planned status)

Next steps:
  /product:feature FM-001 — D2 enrichment первой фичи
  /product:status — view current dashboard
```

## Session state management

Planning Session использует **два файла session state** (per DEC-DEV-0009 pattern + DEC-DEV-0013 ambiguity #1):

### 1. `current.yaml` — managed by `session-state.js` hook

Pre-initialized by `/product:plan` command (Step 3b) с `type: planning-session` и `started_at`. Hook subsequently updates last_artifact_*, edits_since_start, recent_artifacts на каждый Write/Edit.

Не editable by skill. Skill reads если нужен last_touched id для `--continue` defaults.

### 2. `planning-progress.yaml` — managed by этим skill

**Path:** `.product/.sessions/planning-progress.yaml`.

**Singleton — только одна Planning session в момент времени** (per DEC-DEV-0013 ambiguity #1). MVP/RM — singletons как артефакты, нельзя two parallel planning sessions.

**Schema:**

```yaml
session_id: "<same as current.yaml>"
type: planning-session
started_at: <ISO timestamp>
project: <project_name>
language: <from product.yaml>

current_step: D1.6 | D1.7 | D1.8 | complete
last_completed_step: <prior step or null>

last_approved_gates:
  - id: D1.6/MVP
    artifact: MVP
    confidence: high | medium | low
    approved_at: YYYY-MM-DD
  - id: D1.7/RM
    artifact: RM
    confidence: high | medium | low
    approved_at: YYYY-MM-DD
  - id: D1.8/RL-001
    artifact: RL-001
    confidence: high | medium | low
    approved_at: YYYY-MM-DD
  - id: D1.8/FM-001
    artifact: FM-001
    confidence: high | medium | low
    approved_at: YYYY-MM-DD
  # ... per FM

artifacts_active:
  - MVP
  - RM
  - RL-001
  - FM-001
  - FM-002
  # ...

bg_candidates_queued: <count>
fm_skeletons_pending_approve: <count>

next_steps:
  - <description of immediate next action>

progress_percent: <0-100>
```

**Update protocol** (atomicity per DEC-DEV-0009 lesson):
1. Read existing planning-progress.yaml
2. Modify только need-to-update fields (don't lose prior `last_approved_gates`)
3. Write back

**Update points:**

| Момент | current_step → | last_approved_gates += | artifacts_active += |
|---|---|---|---|
| approve MVP (G_D1.6) | D1.7 | D1.6/MVP | MVP |
| approve RM (G_D1.7) | D1.8 | D1.7/RM | RM |
| approve RL-001 (G_D1.8a) | D1.8 (still — FM phase) | D1.8/RL-001 | RL-001 |
| approve каждого FM skeleton | D1.8 (until last) | D1.8/FM-NNN | FM-NNN |
| All FM approved | complete | — | — |

**Recovery:** на `--continue` orchestrator reads `planning-progress.yaml` → resumes c `current_step`. Если есть pending FM skeletons — resume их approve loop.

## Confidence articulation (C2)

At each gate, ассистент explicitly states:

```
<Artifact> draft ready для approve.

Confidence: <high | medium | low>
Rationale: <one paragraph — what's solid vs what's assumed>

Approve? [Y/N/edit]
```

Per artifact type — calibration in respective skills (mvp-scoping, roadmap-planning, release-planning).

## Error handling

| Error | Recovery |
|---|---|
| Discovery prereq missing | Refuse, surface missing list, suggest `/product:init` |
| MVP exists в active (re-plan scenario) | Ask: continue existing planning session (если incomplete), или re-plan (creates MVP v2) |
| User iterates >5 times без approve (deadlock) | Flag «may need re-examine primary HYP first» — escalate к user |
| Git conflict on write | Stop, ask user to resolve (don't force write) |
| planning-progress.yaml corrupted на --continue | Recovery options: start fresh / from last approved gate / manual edit |
| Single FM skeleton approve fails (e.g., user rejects all) | Allow partial: что approved → planned; rejected — back to RL-001 scope discussion |

## Anti-patterns

1. **Skip MVP approve для «эфемерного» plan.** MVP must be approved before RM (RM references MVP fields). Sequential, not parallel.
2. **Padding MUST list.** Если MUST > 7-8 items — push back, скорее это v2 scope. Defer mvp-scoping.md if user insists.
3. **FM skeletons с empty Why.** Per FM.md spec phase 1 sections (Why / What / Priority rationale / Success metric) обязательны. Без этого — не skeleton, а пустышка. Refuse approve.
4. **RL без HYP.** Each RL должен validate ≥1 HYP. «Just to ship» — антипаттерн. Surface к user если не указано.
5. **Skip BG extraction trigger after each approve.** BG extracts continuously per Phase 2 + 3 design. Orchestrator должен queue после каждого approve gate.
6. **Bundle approve для Strategic decisions.** MVP/FM skeletons — per-item approve, не bundle. RL-001 = one-item Standard approve OK.
7. **Drift в planning-progress.yaml updates.** Atomicity per DEC-DEV-0010 lesson — read-modify-write, не блайнд overwrite (потеряется prior gates).

## Related

- [`mvp-scoping.md`](mvp-scoping.md) — D1.6 step (delegated)
- [`roadmap-planning.md`](roadmap-planning.md) — D1.7 step (delegated)
- [`release-planning.md`](release-planning.md) — D1.8 step (delegated)
- [`discovery-session.md`](discovery-session.md) — P1.A predecessor (must be complete)
- Companion command: [`commands/product/plan.md`](../../commands/product/plan.md)
- Process: [docs/pmo/processes.md §3.2 P1.B Planning](../../docs/pmo/processes.md)
- Next phase: P2 Feature Definition via `/product:feature <FM-id>` (Phase 3.B implementation)
