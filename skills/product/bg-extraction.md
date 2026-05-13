---
description: BG (Business Glossary) extraction methodology — 5 phases per processes.md §5. Continuous auto-extraction (Phase 1 hook) + classification (Phase 2 logic) + batched presentation (Phase 3) + human approval (Phase 4). Cross-cutting skill, references Phase 3.E hook + Phase 3.G commands.
---

# BG Extraction — Cross-cutting Skill

Methodology для continuous BG (Business Glossary) population — automatic candidate extraction from artifacts + classification + batched presentation к user + per-term approval.

## Overview

BG = `.product/glossary.md` (singleton artifact, fixed id `BG`). Cross-cutting — pulled from ВСЕ artifacts, питает terminology of ВСЕХ artifacts. Per [BG.md spec](../../docs/pmo/artifacts/BG.md).

**5 phases** per [processes.md §5](../../docs/pmo/processes.md):

| Phase | Owner | Trigger | Output |
|---|---|---|---|
| 1 — Candidate Extraction | `bg-extractor.js` hook (Phase 3.E) | Auto: PostToolUse Write/Edit на `.product/**/*.md` | `.product/.pending/bg-candidates.yaml` queue |
| 2 — Classification | This skill (or hook inline) | Per candidate appears | Categorized: new-term / existing-term / possible-synonym / abandoned-candidate |
| 3 — Assistant Presentation | This skill (orchestrator integration) | At convenient moment (post-approve, /product:status, session start) | Batch presentation к user |
| 4 — Human Approval | User dialogue | Per-term action | Decisions: accept / edit / reject / merge / keep |
| 5 — BG Commit | This skill | Post-approval | BG entry written к glossary.md, version++ if mass-rename |

**Relevant commands** (Phase 3.G):
- `/product:bg:review` — explicit batch review trigger
- `/product:bg:rename <old> <new>` — mass-rename workflow (v1: manual preview + sed-suggest; atomic implementation deferred v1.1 per DEC-DEV-0012 D.2)

## Phase 1: Candidate Extraction (hook-side)

**Owned by:** `bg-extractor.js` hook (Phase 3.E implementation).

**Trigger:** PostToolUse Write/Edit на `.product/**/*.md` (excluding `.product/glossary.md` itself, `.sessions/`, `.pending/`).

**Hook scans:**

1. **Body markdown:**
   - Bold terms: `**term**` или `__term__`
   - Multi-word capitalized phrases (heuristic: ≥2 consecutive capitalized words)
   - Frontmatter-referenced names (entity:, roles: values)

2. **Filtering:**
   - Stoplist общих слов (RU + EN): `мы, они, будет, должен, we, should, will, have, ...`
   - Технические термины (list): `database, API, endpoint, component, function, ...` — NOT в BG
   - Слова уже в BG → не re-add as new (Phase 2 classification handles)
   - Length ≥3 chars; not only digits

**Output:** Queue file `.product/.pending/bg-candidates.yaml`:

```yaml
# Pending BG candidates (auto-extracted by bg-extractor.js)
# Reviewed via /product:bg:review or при следующем /product:status

candidates:
  - term: "Revision"
    source_artifact: SC-005
    source_file: .product/scenarios/SC-005-email-revision.md
    extraction_at: <ISO timestamp>
    context: "**Revision** linked to project P automatically"
  - term: "Revision batch"
    source_artifact: BR-012
    source_file: .product/business-rules/BR-012-batch-grouping.md
    extraction_at: <ISO>
    context: "**Revision batch** = group within 2h window"
  # ...
```

Hook does NOT classify (Phase 2 logic) или present (Phase 3) — это skill responsibility. Hook just queues raw.

## Phase 2: Classification

**Owned by:** This skill (invoked by orchestrator или /product:bg:review command).

For each candidate в queue:

1. **Read existing BG** (`.product/glossary.md`)
2. **Classify:**

   - **new-term** — not в BG, not similar to existing
   - **existing-term** — exact match в BG (case-insensitive) → add `used_in` reference (auto-applied), не nominate как new
   - **possible-synonym** — similar to existing (Levenshtein distance < 3, OR shared root/stem) → suggest merge
   - **abandoned-candidate** — previously rejected (kept в local-ignore list `.product/.bg-rejected.yaml`) → skip silently

**Edge cases:**
- Term «правка» vs «Revision» (different languages, same meaning) — possible-synonym
- Term «User» vs existing «Freelancer» — possible-synonym (semantic overlap)
- Term «edit» vs «Revision» (existing alt-term marked ❌) — abandoned (stays rejected)

## Phase 3: Assistant Presentation (batched, не interrupting workflow)

**Owned by:** This skill, integrated в orchestrators (discovery-session, planning-session, feature-session) или called explicitly via `/product:bg:review`.

**When presented (per [processes.md §5.1 Phase 3](../../docs/pmo/processes.md)):**
- After approve gate completes (current artifact в active, user в context)
- При `/product:status` (показывает «BG pending: <N>» summary, suggest review)
- При начале новой session (`/product:feature ...` с warning о pending BG)
- Explicit `/product:bg:review` command (Phase 3.G)

**Presentation format:**

```
BG pending review (from last <N> saves):

NEW TERM candidates (<N>):
  1. "Revision" (from SC-005)
     Suggested definition: «Правка от клиента на часть переведённого документа
     с указанием позиции и желаемого изменения.»
     Used in: SC-005, SC-006, BR-010
     → Add to BG? [Y/edit/reject]

  2. "Revision batch" (from BR-012)
     Suggested definition: «Группа revisions, приходящих в одно временное
     окно (≤2ч) от одного клиента для одного проекта.»
     Used in: BR-012, SC-007
     → Add to BG? [Y/edit/reject]
  ...

USAGE UPDATES (auto-applied):
  - "Project" now referenced by SC-005, SC-006, SC-007 (added к used_in automatically)
  - "Client" referenced by SC-005 (added)
  ...

SYNONYM WARNINGS (<N>):
  - "правка" (used in old SC-001) vs "Revision" (used in SC-005, SC-006)
    These appear to describe the same concept.
    → Consolidate to "Revision" (preferred)? This will update SC-001.
       [Y/N — if Y, see /product:bg:rename for mass-rename workflow]
```

## Phase 4: Human Approval

Per term, user actions:

- **`[Y]` accept** — accept suggested definition; BG entry created (status=active)
- **`[edit]`** — open definition в editing dialogue
- **`[reject]`** — not domain term; add к local ignore list (`.product/.bg-rejected.yaml`); won't re-suggest
- **`[M] merge`** — merge с existing entry; usage_refs transfer; rejected term kept as alt-term ❌
- **`[keep]`** — keep separate (ignore synonym suggestion); both terms remain в BG

**For synonym warnings — additional option:**
- **`[R] mass-rename`** — invoke `/product:bg:rename <old> <new>` (Phase 3.G command) для cascading update across artifacts

### Suggested definition generation

For new terms, AI generates definition from context (artifact body where term first appears):

```
Term: "Revision"
Source context: "Client sends **Revision** к project P via email forwarding..."

Suggested definition:
  «Правка от клиента на часть переведённого документа с указанием позиции 
  и желаемого изменения. Источник: email или manual entry. Lifecycle 
  managed by LC-002.»

Confidence: medium
  - Definition derived from SC-005 body (high confidence on usage)
  - Lifecycle reference inferred (LC-002 mentioned в same FM-003 context)
  - May need refinement if term used differently elsewhere
```

User can `[edit]` to refine definition before accept.

## Phase 5: BG Commit

Per accepted term:

1. **Append к `.product/glossary.md`** under appropriate section (Core entities / Actions / Roles / States / Artifacts / Metrics — per [BG.md spec body structure](../../docs/pmo/artifacts/BG.md)):

   ```markdown
   ### Revision
   - **Определение:** Правка от клиента на часть переведённого документа
     с указанием позиции и желаемого изменения.
   - **Альтернативные термины:** ❌ edit, comment, feedback (НЕ используем)
   - **Используется в:** SC-005, SC-006, SC-007, BR-010, BR-012, LC-002, FM-003
   - **Связанные термины:** Revision batch, Revision status
   - **Добавлен:** 2026-04-26 (из SC-005 draft)
   - **Status:** active
   ```

2. **Update BG.frontmatter:**
   - `term_count` ++
   - `last_extraction_at` = now
   - `version`: same (term add doesn't bump version; mass-rename does — per [BG.md §5.4](../../docs/pmo/artifacts/BG.md))

3. **Remove processed candidates** from `.product/.pending/bg-candidates.yaml`

4. **Decision journal entry** (Standard level — usually batch entry, not per-term):
   ```markdown
   ## DEC-PLAN-NNN — BG batch update (<N> terms added)
   Date: <ISO>
   Triggered by: <orchestrator step / /product:bg:review>
   Terms added: <list>
   Terms rejected: <count>
   Synonym merges: <count>
   ```

## BG entry frontmatter (singleton)

**Canonical fields per [BG.md artifact spec](../../docs/pmo/artifacts/BG.md):**

```yaml
---
id: BG                                   # singleton, fixed
type: glossary
title: "Business Glossary"
status: active                           # always active
term_count: <N>                          # auto-counted; updated by skill
last_extraction_at: YYYY-MM-DDThh:mm     # ISO timestamp
confidence: high | medium | low
confidence_notes: |
  <what's solid: most terms validated through multiple artifact references>
  <what's assumed: definitions of new terms from single artifact context>
created: YYYY-MM-DD
updated: YYYY-MM-DD                      # auto-updated on commit
version: 1                               # increments on mass-rename only
---
```

**Anti-pattern field names:**
- ❌ `confidence_rationale`, `rationale` → `confidence_notes`
- ❌ `term_total`, `total_terms` → `term_count`
- ❌ `last_extracted`, `extraction_time` → `last_extraction_at`

## Mass-rename workflow (v1: manual preview)

Per [processes.md §5.3](../../docs/pmo/processes.md) + DEC-DEV-0012 D.2 — атомарный workflow deferred к v1.1.

**v1 Phase 3 implementation:** `/product:bg:rename <old> <new>` (Phase 3.G command) shows:
1. List affected artifacts via `used_in` field в BG entry
2. Generate diff preview per file (sed-style: `s/\*\*Revision\*\*/\*\*Edit\*\*/g`)
3. Present к user с counts: «Will update: SC-005 (3 occurrences), SC-006 (2), BR-010 (5), LC-002 (7), FM-003 (4)»
4. User applies manually via IDE find-replace или sed; OR uses suggested commands
5. After manual apply — re-run `/product:bg:rename --commit` to:
   - Update BG entry (rename primary, добавить old name to alt-terms списке как ❌)
   - BG version++
   - Cascade-check.js auto-runs (V-08 terminology consistency, V-11 bi-dir)
   - Decision journal entry

**v1.1 future:** atomic apply via git stash workflow (per [v1_1_backlog.md «Atomic mass-rename»](../../dev/v1_1_backlog.md)).

## Orphan term detection

Per [processes.md §5.5](../../docs/pmo/processes.md):
- Terms с empty `used_in` field → orphans
- Surfaced via `/product:cleanup` (V-15 orphan detection; `--dry-run` для preview без apply) — Phase 4.G shipped per DEC-DEV-0027
- Action options: deprecate (status=deprecated; alternative link required) или delete (only after no usage в active artifacts)

## Anti-patterns

1. **Skipping BG extraction post-approve.** Each artifact approve должен trigger BG extraction (Phase 1). If hook не runs (e.g., manifest gap) — surface as bug.
2. **Auto-accepting candidates без human review.** BG entry quality matters (definitions used by external tools through handoff). Always Phase 4 dialogue.
3. **Synonym duplication.** «правка», «комментарий», «замечание» as separate BG entries → terminology drift. Phase 2 classification + Phase 3 synonym warnings prevent.
4. **Marketing terms в BG.** «Magic inbox» — not domain term. Reject in Phase 4.
5. **Tech terms в BG.** «database», «API endpoint» — implementation zone. Hook stoplist filters; if leaks through, reject in Phase 4.
6. **BG бесконечный grow.** 100+ terms = пере-регулирование. 10-30 ключевых для MVP. Periodic cleanup via `/product:cleanup` (Phase 4.G; default = V-15 orphan-only, `--pending-hygiene` для full sweep).
7. **Mass-rename без preview.** v1 — preview обязателен (atomic apply v1.1). User должен видеть scope before apply.
8. **Variant field names в BG entry** (terms внутри глоссария) — use canonical structure per BG.md spec.

## Confidence calibration (C2)

For BG itself:

| Уровень | Когда применять |
|---|---|
| **high** | term_count stable; definitions multi-source verified; synonym merges done; orphans cleaned |
| **medium** | New terms accumulating без review backlog; some definitions single-source (need 2+ usage validation) |
| **low** | Heavy backlog of pending candidates; many synonyms unresolved; orphans accumulating |

## Examples

**Good BG fragment:** см. [BG.md §Examples](../../docs/pmo/artifacts/BG.md) — full glossary с Core entities / Roles / States sections.

**Anti-example:**
```markdown
### правка
- Это когда клиент пишет что исправить.   # ❌ lowercase, неформально

### edit / comment / revision / feedback
- Одно и то же.                            # ❌ no canonical chosen
```

## Related

- Hook: [`hooks/product/bg-extractor.js`](../../hooks/product/bg-extractor.js) (Phase 3.E — Phase 1 implementation)
- Commands (Phase 3.G):
  - [`commands/product/bg-review.md`](../../commands/product/bg-review.md) — explicit batch review trigger
  - [`commands/product/bg-rename.md`](../../commands/product/bg-rename.md) — mass-rename workflow (v1 manual preview)
- Orchestrators (Phase 3.A + 3.B): Phase 3 trigger BG extraction post each artifact approve via this skill
- Artifact spec: [docs/pmo/artifacts/BG.md](../../docs/pmo/artifacts/BG.md)
- Process: [docs/pmo/processes.md §5 BG Extraction Algorithm](../../docs/pmo/processes.md)
- Validation: V-08 (terms in BG), V-11 (bi-dir refs) в [docs/pmo/validation.md](../../docs/pmo/validation.md)
- Future v1.1: atomic mass-rename per [dev/v1_1_backlog.md](../../dev/v1_1_backlog.md)
