---
description: Batch review of pending BG candidates from .pending/bg-candidates.yaml. Phases 2-4 of BG extraction algorithm — classification, presentation, approval. Orchestrated by bg-extraction skill.
argument-hint: "[--all | --new-terms-only | --synonyms-only]"
---

# /product:bg-review

User invoked: `/product:bg-review $ARGUMENTS`

Manual batch review of BG candidates collected by `bg-extractor.js` hook (Phase 3.E). Implements Phases 2-4 of BG Extraction Algorithm per [processes.md §5](../../docs/pmo/processes.md) — classification, batched presentation, per-term approval.

Load skill `.claude/skills/product/bg-extraction.md` for methodology details.

## Process

### Step 1: Parse arguments

- **No args** или `--all` — review всех pending categories (new terms + synonyms)
- **`--new-terms-only`** — show только NEW TERM candidates (skip synonym warnings)
- **`--synonyms-only`** — show только synonym warnings (skip new candidates)

### Step 2: Read pending file

Path: `.product/.pending/bg-candidates.yaml` (managed by `bg-extractor.js` hook).

If file missing or empty → surface: «No pending BG candidates. Glossary up to date.»

### Step 3: Phase 2 — Classification

For each candidate в queue:

1. Read existing BG (`.product/glossary.md`)
2. Read rejected list (`.product/.bg-rejected.yaml` if exists)
3. Classify per [bg-extraction.md Phase 2](../../skills/product/bg-extraction.md):
   - **new-term** — not в BG, no similar match
   - **existing-term** — exact match в BG → auto-add usage ref (no human action needed)
   - **possible-synonym** — similar to existing (Levenshtein < 3 или shared root) → suggest merge
   - **abandoned-candidate** — previously rejected → skip silently

### Step 4: Phase 3 — Batched presentation

```
BG pending review (from last <N> hook invocations):

NEW TERM candidates (<count>):
  1. "Revision" (from SC-005)
     Suggested definition: «Правка от клиента на часть переведённого 
     документа с указанием позиции и желаемого изменения.»
     Used in: SC-005, SC-006, BR-010
     Context snippet: "...Client sends **Revision** к project P automatically..."
     → Add к BG? [Y / edit / reject]

  2. "Revision batch" (from BR-012)
     Suggested definition: «Группа revisions, приходящих в одно временное 
     окно (≤2ч) от одного клиента для одного проекта.»
     Used in: BR-012, SC-007
     → Add к BG? [Y / edit / reject]
  ...

USAGE UPDATES (auto-applied к existing BG entries):
  - "Project" — added used_in references: SC-005, SC-006, SC-007
  - "Client" — added used_in reference: SC-005

SYNONYM WARNINGS (<count>):
  - "правка" (used в SC-001) vs "Revision" (used в SC-005, SC-006)
     These appear to describe the same concept.
     → Consolidate? [M] merge "правка" into "Revision" (keep as alt-term ❌) 
                    [K] keep separate
                    [R] mass-rename → /product:bg-rename "правка" "Revision"
```

### Step 5: Phase 4 — Per-term human approval

User per term enters action:

- **`[Y]` accept** — accept suggested definition; new BG entry created
- **`[edit]`** — open inline editing dialogue:
  ```
  Editing definition for "<term>":
  Current draft: «<suggested definition>»
  
  Edit (or press [Y] to keep as-is):
  > <user revised definition>
  ```
- **`[reject]`** — not domain term; add к `.product/.bg-rejected.yaml` (won't re-suggest)
- **`[M] merge`** (synonym warnings only) — merge с existing entry; usage_refs transfer; rejected term kept as alt-term ❌
- **`[K] keep`** (synonym warnings only) — both terms remain в BG separately
- **`[R] mass-rename`** (synonym warnings only) — invoke `/product:bg-rename <old> <new>` для cascading update across all artifacts

### Step 6: Phase 5 — BG commit

Per accepted term:

1. **Append к `.product/glossary.md`** under appropriate section (Core entities / Actions / Roles / States / Artifacts / Metrics):
   ```markdown
   ### Revision
   - **Определение:** <approved definition>
   - **Альтернативные термины:** ❌ edit, comment, feedback (НЕ используем)
   - **Используется в:** SC-005, SC-006, SC-007, BR-010, BR-012
   - **Связанные термины:** Revision batch
   - **Добавлен:** <today> (из SC-005 draft)
   - **Status:** active
   ```

2. **Update BG.frontmatter:**
   - `term_count` ++
   - `last_extraction_at` = now (ISO timestamp)
   - `version`: same (term add не bumps; only mass-rename does — per [BG.md §5.4](../../docs/pmo/artifacts/BG.md))

3. **Remove processed candidates** from `.product/.pending/bg-candidates.yaml`

4. **Decision journal entry** (Standard level — batch entry):
   ```markdown
   ## DEC-PLAN-NNN — BG batch update (<N> terms added, <M> rejected, <K> synonym merges)
   Date: <ISO>
   Triggered by: /product:bg-review
   Terms added: <list>
   Terms rejected: <count>
   Synonym merges: <list of pairs>
   ```

### Step 7: Summary report

```
BG review complete:
  ✓ <N> new terms added к glossary
  ✓ <M> usage references auto-applied к existing terms
  ⊘ <K> terms rejected (added к local ignore list)
  ⊕ <L> synonym merges
  ⏭ <P> mass-rename triggered (в progress via /product:bg-rename)
  
Pending: <Q> entries remain (use /product:bg-review again later)
Total BG term_count: <N>
```

## Important constraints

- **Phase 1 (extraction) is hook-side.** This command не extracts — only classifies + presents + commits. Hook (`bg-extractor.js`) responsible для extraction queue population.
- **Suggested definitions need user review.** AI provides initial draft from artifact context; user confirms or edits. Don't accept без review.
- **Synonym merges require explicit confirmation.** Auto-merging risks losing nuance. Always ask user.
- **Mass-rename = separate command.** This command can suggest /product:bg-rename для synonym consolidation, не invoke directly.
- **Rejected terms persist в local ignore.** `.product/.bg-rejected.yaml` prevents re-suggestion of clearly non-domain terms.

## Error handling

| Error | Action |
|---|---|
| `bg-candidates.yaml` not found | «No pending BG candidates» — exit cleanly |
| `glossary.md` corrupted | Surface error, suggest manual fix; don't append к broken file |
| Definition edit dialogue user cancels | Skip term, leave в pending |
| BG section structure unclear | Append к catch-all «Misc» section, suggest user reorganize |

## Related

- Hook: [`hooks/product/bg-extractor.js`](../../hooks/product/bg-extractor.js) (Phase 3.E — Phase 1 extraction)
- Skill: [`skills/product/bg-extraction.md`](../../skills/product/bg-extraction.md) (Phase 3.D — methodology)
- Companion command: [`commands/product/bg-rename.md`](bg-rename.md) (mass-rename workflow)
- Artifact spec: [docs/pmo/artifacts/BG.md](../../docs/pmo/artifacts/BG.md)
- Process: [docs/pmo/processes.md §5 BG Extraction Algorithm](../../docs/pmo/processes.md)
- Validation: V-08 (terms in BG), V-15 (orphan detection — Phase 4) в [docs/pmo/validation.md](../../docs/pmo/validation.md)
