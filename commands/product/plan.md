---
description: Start P1.B Planning Session. Creates MVP scope, Roadmap, RL-001, and FM skeletons. Requires Discovery complete.
argument-hint: "[--continue]"
---

# /product:plan

User invoked: `/product:plan $ARGUMENTS`

## Process

This command orchestrates **P1.B Planning Session** per `.claude/docs/pmo/processes.md §3.2`. Load skill `.claude/skills/product/planning-session.md` as primary orchestrator.

### Step 1: Parse arguments

- `--continue` — resume from `.product/.sessions/planning-progress.yaml`
- (no arg) — fresh Planning Session

### Step 2: Check prerequisites

Discovery Session must be complete:
- `.product/problem.md` (PS) в active
- `.product/market-research.md` (MR) в active
- `.product/competitive-analysis.md` (CA) в active
- ≥1 SEG-* в active (primary identified)
- ≥1 VP-* в active
- ≥1 HYP-* в `testing` (or validated/invalidated; primary candidate identifiable)

If missing — surface error: «Discovery incomplete; run /product:init first.» List which artifacts missing.

If MVP уже active — ask:
```
MVP уже active в этом проекте.

Options:
  [C] Continue existing planning session — resume incomplete steps (RM/RL/FMs)
  [R] Re-plan — creates MVP v2 (status пересмотр всего scope)
  [N] Cancel
```

### Step 3: Initialize session state files (Step 3b pattern per DEC-DEV-0009)

Per DEC-DEV-0013 ambiguity #1 (singleton planning session):

**`.product/.sessions/current.yaml`** — pre-set type so `session-state.js` hook не defaults to `'unknown'`:

```yaml
# Session state — initialized by /product:plan command.
# Subsequently managed by session-state.js hook on each .product/ write.

session_id: "<ISO-timestamp>-planning-<project_name>"
type: planning-session
started_at: "<ISO timestamp>"
```

Hook на первой Write/Edit в `.product/` прочитает existing `type`/`started_at` и сохранит их — не перезапишет defaults.

**`.product/.sessions/planning-progress.yaml`** — initial orchestration state:

```yaml
session_id: "<same as current.yaml>"
type: planning-session
started_at: "<ISO timestamp>"
project: "<from product.yaml.project_name>"
language: "<from product.yaml.project_language>"

current_step: D1.6
last_completed_step: null
last_approved_gates: []

artifacts_active: []
bg_candidates_queued: 0
fm_skeletons_pending_approve: 0

next_steps:
  - D1.6 MVP Scope Definition

progress_percent: 0
```

**Если `--continue`:** read existing files вместо create. Resume с `current_step` в planning-progress.yaml.

### Step 4: Delegate to planning-session skill

Load `.claude/skills/product/planning-session.md`. It handles:
- D1.6 MVP Scope Definition (delegates → `mvp-scoping.md`)
- D1.7 Product Roadmap (delegates → `roadmap-planning.md`)
- D1.8 Release Planning + FM skeletons (delegates → `release-planning.md`)
- Per-artifact approve gates с confidence statement
- Update planning-progress.yaml after each gate
- Decision journal entries (Strategic-level)

### Step 5: Session state (auto-managed)

`session-state.js` hook auto-snapshots progress to `.product/.sessions/current.yaml` на каждый Write/Edit. Orchestrator skill maintains `planning-progress.yaml` для resume через `--continue`.

### Step 6: Completion

When D1.8 complete (RL-001 + all FM skeletons approved):
- planning-progress.yaml.current_step = `complete`
- Summary report:
  ```
  Planning Session complete.
  Artifacts created:
    ✓ MVP (mvp-scope.md, primary HYP-<NNN>)
    ✓ RM (roadmap.md, horizon <X>)
    ✓ RL-001 (releases/RL-001-<slug>.md, target <date>)
    ✓ FM-001..00N (features/FM-*-*.md, planned status)

  Decision journal entries: <N> (см. .product/.decisions/journal.md)

  Next:
    /product:feature FM-001 — D2 enrichment первой фичи
    /product:status — view current dashboard
  ```

## Important constraints

- **Discovery prereq strict.** Если нет PS/MR/CA/SEG/VP/HYP active — Planning is meaningless. Refuse early с specific list missing.
- **Singleton planning session.** Per DEC-DEV-0013 ambiguity #1 — в момент времени только одна Planning session (MVP/RM = singleton артефакты, нельзя two parallel).
- **Per-artifact approve.** Не bundle approve для MVP/RM/FM skeletons — каждое отдельно (Strategic level decisions). RL-001 = one Standard approve.
- **FM skeletons mandatory output.** Если RL-001 approved but skeletons not created — Planning incomplete (planning-progress.yaml.current_step ≠ complete).
- **Confidence articulation** (C2) — at every approve gate per CLAUDE.md C2 modification.
- **Canonical frontmatter fields.** Per CLAUDE.md B.1 convention + DEC-DEV-0011 lesson — explicit templates в каждом per-step skill, anti-pattern field names listed.

## Error handling

| Error | Action |
|---|---|
| `.product/` missing or empty | Suggest `/ecosystem:bootstrap` first |
| Discovery artifacts missing (PS/MR/CA/SEG/VP/HYP) | List missing artifacts + suggest `/product:init` |
| MVP exists в active (re-plan scenario) | Ask: continue or re-plan (creates v2) |
| User interrupts mid-step | Save partial progress in planning-progress.yaml; `--continue` resumes |
| Session corrupted on `--continue` | Recovery options: start fresh / from last approved gate |
| Hook write failure (session-state.yaml) | Log to stderr, proceed (non-blocking per Phase 2 hook design) |

## Related

- Process: `.claude/docs/pmo/processes.md §3.2` (P1.B Planning Session)
- Skill: `.claude/skills/product/planning-session.md` (orchestrator) + delegated:
  - `.claude/skills/product/mvp-scoping.md` (D1.6)
  - `.claude/skills/product/roadmap-planning.md` (D1.7)
  - `.claude/skills/product/release-planning.md` (D1.8)
- Prereq command: `/product:init` (Discovery — produces required PS/MR/CA/SEG/VP/HYP)
- Next command: `/product:feature <FM-id>` (D2 enrichment — Phase 3.B)
- Resume command: `/product:plan --continue`
