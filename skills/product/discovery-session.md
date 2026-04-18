---
description: P1.A Discovery Session orchestrator. Manages D1.1-D1.5z steps, gates G1/G4/G4a/G5, and Discovery Review Checkpoint (A2 modification).
---

# Discovery Session — Orchestrator Skill

Used by `/product:init`. Orchestrates P1.A per `.claude/docs/pmo/processes.md §3.1` with v1 modifications applied.

## Mode selection

Before starting, confirm mode:
- **Quick** (30-60 мин): direct MCP calls (Brave + Firecrawl для research), single-session
- **Deep** (2-4 часа): spawn `market-researcher` и `competitor-analyst` subagents (8-phase pipeline each), higher credibility outputs

User chooses. Cannot downgrade Deep → Quick mid-session (subagents already running).

## Flow

### D1.1 Problem Discovery → G1

Load `.claude/skills/product/problem-discovery.md`. Output: `.product/problem.md` in active after G1.

**Gate G1 (🟠 Strategic, per-item approve):**
- Present final PS draft
- Assistant states confidence (C2): «Confidence: high/medium/low — [rationale]»
- Human approves → PS status=active
- Post-approve: BG extraction (Phase 1 candidates queued), session state saved, version++

### D1.2 Market Research (Quick) OR Deep subagent

Load `.claude/skills/product/market-research-protocol-quick.md` в Quick mode, OR spawn `market-researcher` subagent в Deep.

**A2 modification:** MR draft **queued для Discovery Review Checkpoint**, не отдельный G2 gate. Session continues to D1.3.

Output: `.product/market-research.md` в draft с `[оценочно]` tags на findings без hard evidence.

### D1.3 Competitive Analysis (Quick) OR Deep subagent

Load `.claude/skills/product/competitive-analysis-protocol-quick.md` или spawn `competitor-analyst`.

**A2 modification:** CA draft **queued для DRC**. Session continues.

Output: `.product/competitive-analysis.md` в draft.

### D1.4 Segment & JTBD → G4 per-SEG

Load `.claude/skills/product/segment-discovery.md`.

Ассистент synthesizes из PS + MR draft + CA draft: proposes 2-4 segments, each с 2-4 JTBDs. Human adjusts priorities (primary/secondary/exploratory).

**Gate G4 (🟠 Strategic, per-SEG approve):**
- Per proposed SEG: review + approve/edit/reject
- Approved SEG → `.product/segments/SEG-00N-*.md` в active
- Post-approve: BG extraction, session save, cascade check triggered

### 🔁 Discovery Review Checkpoint (A2 — replaces G2/G3)

**После G4 (все SEG approved), BEFORE D1.4a:**

Ассистент presents bundle:
```
Discovery Review Checkpoint.

Research baseline зафиксируется сейчас:
  ✓ MR (draft, <N> sources, credibility <med-high|medium>)
  ✓ CA (draft, <N> competitors, feature matrix)

Now that SEG-001..00<N> approved, context for MR/CA is clearer.

  [1] Review MR content → approve/edit/reject
  [2] Review CA content → approve/edit/reject
  [3] Approve both → proceed to VP design
  [4] Reject — back to D1.2/D1.3 для revision
```

Human chooses. Default path: `[3]` approve both.

On approve:
- MR → active, CA → active
- BG extraction batch (all queued candidates from D1.2, D1.3, D1.4)
- Journal entry: DRC passed with bundle approve

**Rationale for DRC (A2):** MR и CA — research outputs. Standalone approve теряет смысл — они inform subsequent steps. Review после SEG creation gives context. Saves 2 separate approve rounds.

### D1.4a Value Proposition → G4a per-VP

Load `.claude/skills/product/vp-design.md`.

Per active SEG — создай VP (1:1 relationship per DEC-ART03). Strategyzer-style simplified: pain points + gains + value.

**Gate G4a (🟠 Strategic, per-VP approve):**
- Per VP — review + approve
- Approved VP → `.product/value-propositions/VP-00N-*.md` в active

### D1.5 Hypothesis Formulation → G5 per-HYP

Load `.claude/skills/product/hypothesis-formulation.md`.

Из SEG + VP + MR ассистент предлагает 3-5 HYP с H.A.R.M.E.D. structure. Human утверждает метрики и пороги.

**Gate G5 (🟠 Strategic, per-HYP):**
- Per HYP — approve с explicit thresholds (success_threshold, invalidation_threshold, deferred_zone)
- Approved HYP → `.product/hypotheses/HYP-00N-*.md` status=`testing` (per HYP lifecycle)
- One HYP tagged `priority: primary` (by human or suggested by assistant based on VP alignment)

### D1.5z Final BG Extraction Pass

After all gates passed:
1. Run BG extraction across **all** created artifacts (PS, MR, CA, SEGs, VPs, HYPs)
2. Accumulate candidates
3. Present batch:
   ```
   BG extraction final pass.

   Found <N> term candidates from Discovery:

   NEW TERMS (<N>):
     1. "Project" (used in SC-none-yet, PS, SEG-001) — suggest definition: «...»
     2. "Freelancer" (used in PS, SEG-001, RPM-future) — suggest: «...»
     ...

   SYNONYM WARNINGS (<N>):
     - "переводчик" (PS) vs "Freelancer" (SEG-001) → консолидировать?

   Per term: [Y]es add | [edit] | [reject] | [M]erge synonym
   ```
4. Process user decisions
5. Write `.product/glossary.md` (BG) с approved terms

### Completion

Session state archived. Summary report (per `/product:init` Step 6).

## Session state management

Throughout, `product-session-state.js` hook snapshots to `.product/.sessions/current.yaml`:

```yaml
session_id: "<timestamp>-discovery-<project>"
type: discovery-session
mode: quick | deep
started_at: <timestamp>
current_step: D1.1 | D1.2 | ... | D1.5z | complete
last_approved_gates: [G1, G4, G4a-VP001, G4a-VP002, G5-HYP001]
pending_drafts:
  - MR (draft, queued for DRC)
  - CA (draft, queued for DRC)
progress_percent: ~30%
```

On interrupt: `/product:init --continue` reads этот state and resumes.

## Error handling

| Error | Recovery |
|---|---|
| MCP unavailable mid-D1.2 Deep | Fall back to Quick; warn user |
| Session file corrupted | Offer start-fresh or recover from last approved artifact |
| User iterates >5 times without approve (deadlock protection) | Flag «may need radical rethink» |
| Git conflict on write | Stop, ask user to resolve |

## Confidence articulation (C2 modification)

At each gate, ассистент explicitly states confidence:

```
PS ready for G1 approve.

Confidence: medium
Rationale: Problem statement based on user input (high), but
market context assumptions («фрилансеры страдают от X») не validated
via research yet. MR will validate. Accept PS as hypothesis-level PS,
refine после G2/DRC.
```

This gives human **point of leverage**: decide whether to dig deeper or proceed.

## Anti-patterns

1. **Rushing gates.** Если user says «approve» quickly — ассистент confirms: «approve PS as-is? Confidence medium because X — sure?»
2. **Skipping DRC.** Some users may want traditional per-item approve. Honor it if explicitly requested.
3. **Deep mode без готовности.** If MCP stack incomplete, don't fake Deep — downgrade to Quick explicitly.
4. **Fabricating research.** Quick mode findings should be explicitly `[оценочно]` when not backed by real sources.
