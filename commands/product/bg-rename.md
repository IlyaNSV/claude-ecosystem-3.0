---
description: Mass-rename BG term across all artifacts. v1 manual preview workflow (sed-suggest + IDE find-replace). Atomic apply deferred к v1.1 per DEC-DEV-0012 D.2.
argument-hint: "<old> <new> | --commit <old> <new>"
---

# /product:bg-rename

User invoked: `/product:bg-rename $ARGUMENTS`

Rename BG term across all `.product/` artifacts. **v1 implementation: manual preview workflow.** User reviews diff preview, applies via IDE find-replace или sed, then runs `--commit` для BG entry update + cascade-check.

**Atomic implementation** (single git commit с rollback) deferred к **v1.1** per [DEC-DEV-0012 D.2](../../DEV_JOURNAL.md) + [dev/v1_1_backlog.md](../../dev/v1_1_backlog.md).

## Process

### Step 1: Parse arguments

- **`<old> <new>`** — preview mode (default; safe — no changes applied)
- **`--commit <old> <new>`** — commit mode (after manual apply, finalize BG entry update)

If args missing → show usage:
```
Usage:
  /product:bg-rename "<old>" "<new>"             # preview mode (recommended first)
  /product:bg-rename --commit "<old>" "<new>"    # finalize after manual apply
```

### Step 2 (preview mode): Validate

- **`<old>` exists в BG** (`.product/glossary.md` heading `### <old>`):
  - If not — surface: «Term <old> not found в BG. Verify spelling or run /product:bg-review first.»
- **`<new>` doesn't conflict** в BG:
  - If `<new>` already exists в BG — surface: «Term <new> already exists. This would be a merge, not rename. Use /product:bg-review с merge action instead.»
- **`<new>` valid term** (length ≥3, no special chars beyond hyphen):
  - If invalid — surface error.

### Step 3 (preview mode): Identify affected artifacts

From BG entry для `<old>` term:
- Read `Используется в:` field — list of artifacts
- For each artifact в list, read file
- Find bold occurrences: `**<old>**` или `__<old>__`
- Count occurrences per file

If `Используется в:` field empty — surface: «Term <old> has no usage references; rename trivial (only BG entry update). Skip к Step 5 --commit.»

### Step 4 (preview mode): Generate preview

```
BG mass-rename preview: «<old>» → «<new>»

BG entry will be updated:
  - Heading: ### <old>  →  ### <new>
  - Альтернативные термины: ❌ <old> added к alt-terms (history preservation)
  - All usage_in references preserved (artifacts не renamed yet)

Affected artifacts (<N> files, <M> total occurrences):

  📄 .product/scenarios/SC-005-email-revision.md (3 occurrences)
     Lines: 12, 24, 56
  📄 .product/scenarios/SC-006-manual-revision.md (2 occurrences)
     Lines: 18, 32
  📄 .product/business-rules/BR-010-email-linking.md (5 occurrences)
     Lines: 8, 14, 22, 31, 47
  📄 .product/lifecycles/LC-002-revision.md (7 occurrences)
     ...
  📄 .product/features/FM-003-revisions-inbox.md (4 occurrences)
     ...

Total: <M> bold-wrapped occurrences across <N> files.

Suggested manual apply (sed-style):

  # Single file:
  sed -i 's/\*\*<old>\*\*/\*\*<new>\*\*/g; s/__<old>__/__<new>__/g' <file>

  # Batch (от project root):
  find .product -name "*.md" -exec sed -i 's/\*\*<old>\*\*/\*\*<new>\*\*/g; s/__<old>__/__<new>__/g' {} \;

Or use IDE find-replace:
  Find:    \*\*<old>\*\*
  Replace: **<new>**
  Scope:   .product/**/*.md
  
  (Then repeat для __<old>__ → __<new>__ if applicable)

⚠ MANUAL STEP: review changes carefully (BG entry usage_refs is hint, не authoritative).

After manual apply complete, run:
  /product:bg-rename --commit "<old>" "<new>"

This will:
  1. Update BG entry (heading + alt-terms + version++)
  2. Trigger cascade-check.js auto-run (V-08 terminology, V-11 bi-dir)
  3. Decision journal entry
```

### Step 2 (commit mode): Validate manual apply

After user runs `--commit`:

1. **Re-scan affected artifacts:** confirm `<old>` no longer appears (modulo BG entry's alt-terms history) и `<new>` is present
2. **If `<old>` still present anywhere except BG itself:**
   - Surface warning с list of files where `<old>` still appears
   - Options: [F] force commit (mark partial); [A] abort + finish manual apply; [C] cancel
3. **If `<new>` not present in any affected file:** abort, suggest «Manual apply was not done. Re-run preview, do find-replace, then --commit.»

### Step 3 (commit mode): Update BG entry

In `.product/glossary.md`:
1. Rename heading: `### <old>` → `### <new>`
2. Add к Альтернативные термины: `❌ <old>` (preserve history per BG.md spec)
3. Update Used in: refs (re-scan affected artifacts; same list expected)
4. Add Связанные термины update if applicable

Update BG.frontmatter:
- `version` ++ (mass-rename triggers version bump per [BG.md §5.4](../../docs/pmo/artifacts/BG.md))
- `updated` = today
- `term_count` same (rename, not add)
- `last_extraction_at` same (no Phase 1 extraction triggered)

### Step 4 (commit mode): Trigger cascade

Cascade-check.js hook will run automatically на BG.md write — но for mass-rename we want explicit cascade scope:
- V-08 (terms in BG) — verify all artifacts still consistent (no orphan `**<old>**` references)
- V-11 (bi-dir refs) — verify no broken refs из rename

If cascade-check finds issues — surface к user, suggest manual fix.

### Step 5 (commit mode): Decision journal entry (Standard level)

```markdown
## DEC-PLAN-NNN — BG mass-rename: <old> → <new>

Date: <ISO>
Triggered by: /product:bg-rename --commit
Affected artifacts: <count> files, <count> occurrences
BG version bump: <prev> → <new>
Cascade-check status: <clean | issues found and resolved>
Manual apply method: <user-reported: sed | IDE find-replace | other>

Rationale: <if user provides — synonym consolidation, terminology refinement, etc.>
```

### Step 6 (commit mode): Summary

```
BG mass-rename committed:
  ✓ BG entry renamed: <old> → <new> (BG version <prev> → <new>)
  ✓ <count> artifacts updated (manual apply by user)
  ✓ <count> alt-term reference preserved («❌ <old>» в BG entry)
  ✓ Cascade-check: <clean | <N> entries в pending — see /product:cascade --pending>
  ✓ Decision journal entry: DEC-PLAN-NNN

Recommended next:
  - Verify with /product:status (BG overview)
  - Consider git commit: «BG rename: <old> → <new> (<count> refs across <files> files)»
```

## Important constraints

- **Manual workflow в v1.** Atomic apply (single transaction) deferred v1.1. User responsible для applying find-replace correctly.
- **Two-step process.** Preview first (safe — no writes); then `--commit` after manual apply. Don't skip preview.
- **Bold wrapping convention.** Only `**<term>**` или `__<term>__` (markdown bold) is renamed; plain text occurrences ignored. This is by design — only «term marker» occurrences should rename.
- **Old term preserved в alt-terms.** History matters; future readers can trace evolution.
- **Cascade auto-runs on BG.md write.** No explicit cascade trigger needed — hook handles.
- **No rollback в v1.** If mistake — manual fix или git revert. Atomic v1.1 will provide proper rollback.

## Error handling

| Error | Action |
|---|---|
| `<old>` not in BG | Surface error, suggest /product:bg-review для term verification |
| `<new>` already в BG | Surface error, suggest merge instead via /product:bg-review |
| Affected file unreadable | Skip file, log warning, continue preview |
| Manual apply incomplete (--commit fails verification) | Show partial state, options: [F] force, [A] abort, [C] cancel |
| BG entry update fails | Roll back changes к BG.md (read backup if available); surface error |
| Cascade-check fails post-commit | Surface, suggest /product:cascade --pending для review |

## Related

- Skill: [`skills/product/bg-extraction.md`](../../skills/product/bg-extraction.md) — methodology + mass-rename workflow §5.3
- Companion commands:
  - [`/product:bg-review`](bg-review.md) — pending candidate review
  - [`/product:cascade`](cascade.md) — cascade entries from BG version bump
- Hook: [`hooks/product/bg-extractor.js`](../../hooks/product/bg-extractor.js) — extracts new terms after rename (existing-term auto-add usage refs)
- Hook: [`hooks/product/cascade-check.js`](../../hooks/product/cascade-check.js) — auto-runs on BG.md write
- Artifact spec: [docs/pmo/artifacts/BG.md](../../docs/pmo/artifacts/BG.md)
- Process: [docs/pmo/processes.md §5.3 Mass-Rename Workflow](../../docs/pmo/processes.md)
- Validation: V-08 (terms in BG), V-11 (bi-dir refs)
- Future v1.1: atomic apply with git stash workflow per [dev/v1_1_backlog.md «Atomic mass-rename»](../../dev/v1_1_backlog.md)
