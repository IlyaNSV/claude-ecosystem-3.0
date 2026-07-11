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

### D1.0 Product Classification

Load `.claude/skills/product/product-class.md` (mode `discovery`). Один вопрос — что строим
по форме (archetype); фасеты (`runtime_locus / interface / distribution` + опц.
`data_sensitivity`) авто-выводятся из таксономии; записывается блок `product_class` в
`.claude/product.yaml`.

- **Advisory only** — сеет дефолты NFR/тестов + handoff-hint ниже по пайплайну; **никогда
  не gate'ит**. Открытый словарь; `archetype: other` + `notes` всегда валиден.
- **НЕ пишет в PS** (PS обязан быть tech-free) — только в `product.yaml`.
- Быстрый шаг (~1-2 мин). Если форма ещё не ясна — `confidence: low` + best-guess; уточнить
  позже через `/product:init --continue` или backfill-промпт.

Не gate. После записи — переход к D1.0b.

### D1.0b Domain Fit Assessment (гейт)

Load `.claude/skills/product/domain-fit.md` (mode `discovery`). Классификация идеи до
подкатегории реестра доменной экспертизы (96 позиций, по ядру ценности; `archetype` из
D1.0 — подсказка) → подтверждение пользователем (один вопрос) → lookup совокупного балла
→ вердикт по порогу (дефолт 75) → запись блока `domain_fit` в `.claude/product.yaml`.

- **Единственный класс-гейт** (DEC-DEV-0169, в отличие от advisory D1.0): балл ниже
  порога останавливает Discovery до явного решения владельца — `adapted` (перекроить
  идею → переоценка) / `proceed-with-risks` (ограничители фиксируются письменно) /
  `aborted`. Override всегда легален; `unmapped` (домен вне реестра) не блокирует —
  деградирует в advisory.
- **НЕ пишет в PS** — только в `product.yaml`.
- Fit-случай — одна строка подтверждения, без паузы (~1 мин).

При `decision: aborted` — session state сохранить, Discovery завершить (не продолжать
к D1.1). Иначе — переход к D1.1.

### D1.1 Problem Discovery → G1

Load `.claude/skills/product/problem-discovery.md`. Output: `.product/problem.md` in active after G1.

**Gate G1 (🟠 Strategic, per-item approve):**
- Present final PS draft
- Assistant states confidence (C2): «Confidence: high/medium/low — [rationale]»
- Human approves → PS status=active
- Post-approve: BG extraction (Phase 1 candidates queued), session state saved, version++

### D1.2 Market Research (Quick) OR Deep subagent

**Quick mode (default):** Load `.claude/skills/product/market-research-protocol-quick.md` and run the research inline. (Unchanged — this is the 1:1 behavior when no `--deep`.)

**Deep mode (`--deep`):** spawn the `market-researcher` subagent (`subagent_type: "market-researcher"`) with an isolated-context brief, instead of running the Quick protocol inline:

```
PS summary: <the approved PS — problem, target users, context>
Industry / domain: <from PS / product.yaml>
Geography / market: <primary market>
Language of primary market: <EN | RU | ...>
Product class (advisory): <product_class.archetype from D1.0, if set>
Available MCP servers: <which of Firecrawl / Brave / Exa / Sequential Thinking responded (Step 3 check)>
Specific gaps to close (optional): <if the user flagged a dimension>
```

The subagent is **read-only** and returns (a) the MR draft body and (b) a research-meta summary — it does NOT write files. **The main session writes** the returned body to `.product/market-research.md` with `status: draft` (so `product-artifact-validate.js` + `bg-extractor.js` PostToolUse hooks fire here and BG candidates get queued). Surface the research-meta (`sources_count`, `credibility_distribution`, `gaps_acknowledged`) when framing the DRC.

If the MCP research stack is incomplete (Firecrawl/Exa missing), don't fake Deep — downgrade to Quick explicitly with a one-line warning (per Anti-patterns §3). If the harness reports «Agent type 'market-researcher' not found», that is a loud setup error — surface it, do not silently role-adopt via `general-purpose`.

**A2 modification (both modes):** MR draft **queued для Discovery Review Checkpoint**, не отдельный G2 gate. Session continues to D1.3.

Output (both modes): `.product/market-research.md` в draft с `[оценочно]` tags на findings без hard evidence.

### D1.3 Competitive Analysis (Quick) OR Deep subagent

**Quick mode (default):** Load `.claude/skills/product/competitive-analysis-protocol-quick.md` and run inline. (Unchanged — 1:1 when no `--deep`.)

**Deep mode (`--deep`):** spawn the `competitor-analyst` subagent (`subagent_type: "competitor-analyst"`) after (or in parallel with) `market-researcher`, with an isolated-context brief:

```
PS summary: <the approved PS>
MR draft: <the D1.2 MR draft body, so the landscape is grounded in current behavior + barriers>
Known competitors (optional): <any names the user gave; the subagent may extend>
Domain / category: <for search phrasing>
Dev-focused: <yes/no — enables GitHub repo signal>
Available MCP servers: <which of Exa / Firecrawl / GitHub / Brave / Sequential Thinking responded>
```

Same contract as D1.2: the subagent is **read-only** and returns the CA draft body + research-meta; **the main session writes** it to `.product/competitive-analysis.md` with `status: draft`. Same MCP-fallback and agent-not-found handling as D1.2.

**A2 modification (both modes):** CA draft **queued для DRC**. Session continues.

Output (both modes): `.product/competitive-analysis.md` в draft.

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
- Per HYP — approve с explicit thresholds (canonical: `target_value`, `invalidation_threshold` в frontmatter + deferred zone в body section, per [HYP.md](../../docs/pmo/artifacts/HYP.md))
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

Discovery Session использует **два файла session state** (в `.product/.sessions/`):

**1. `current.yaml` — managed by `session-state.js` hook (не редактировать вручную).**

Обновляется автоматически на каждый Write/Edit в `.product/**/*.md`. Содержит:
- `session_id`, `type`, `started_at` (инициализируется `/product:init` command-ом до первого write)
- `last_checkpoint`, `last_tool`, `last_artifact_id` / `_type` / `_status`, `last_artifact_path`
- `edits_since_start`, `recent_artifacts` (last 10), `git_head_sha`

Поля `last_artifact_id/type/status` атомарны — всегда описывают один и тот же файл (последний write). Для singletons без `id:` в frontmatter (problem.md, glossary.md) — `last_artifact_id` отсутствует в output.

**2. `discovery-progress.yaml` — managed by этим skill (обновляется на каждом approve gate).**

Структура:

```yaml
session_id: "<same as current.yaml>"
type: discovery-session
mode: quick | deep
started_at: <timestamp>
project: <project_name>
language: <from product.yaml>

current_step: D1.0 | D1.0b | D1.1 | D1.2 | D1.3 | D1.4 | D1.4a | D1.5 | D1.5z | complete
last_completed_step: <prior step or null>

last_approved_gates:
  - id: G1
    artifact: PS
    confidence: high | medium | low
    approved_at: YYYY-MM-DD
  # ...

pending_drafts:
  - MR (draft, queued for DRC)
  - CA (draft, queued for DRC)

artifacts_active:
  - PS (problem.md)
  # ...

bg_candidates_queued: <count>
bg_synonym_warnings: <count>

next_steps:
  - <description of immediate next action>

progress_percent: <0-100>
```

**Когда обновлять `discovery-progress.yaml`** (после каждого approve gate — skill ответственен, не hook):

| Момент | current_step → | last_approved_gates += | pending_drafts |
|---|---|---|---|
| product_class set (D1.0) | D1.0b | — (не gate) | — |
| domain_fit set (D1.0b) | D1.1 (или complete при `decision: aborted`) | — (гейт, но решение в `product.yaml.domain_fit`, не в списке gates) | — |
| approve PS (G1) | D1.2 | G1/PS | — |
| MR draft готов | D1.3 | — | += MR |
| CA draft готов | D1.4 | — | += CA |
| approve каждого SEG (G4) | D1.4 (→ DRC после всех SEG) | G4/SEG-NNN | — |
| DRC approve (MR+CA bundle) | D1.4a | DRC | cleared |
| approve каждого VP (G4a) | D1.4a (→ D1.5 после всех VP) | G4a/VP-NNN | — |
| approve каждого HYP (G5) | D1.5 (→ D1.5z после всех HYP) | G5/HYP-NNN | — |
| BG extraction pass готов | complete | D1.5z | — |

**Atomicity:** прочитать существующий файл, обновить поля, записать назад. Не терять прежние `last_approved_gates` при добавлении нового.

**Recovery:** на interrupt `/product:init --continue` читает `discovery-progress.yaml` и возобновляет с `current_step`. Если `.product/` содержит артефакты, которых нет в `last_approved_gates` — эвристически reconcile (либо resume approve gate для них, либо попросить human подтвердить).

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
