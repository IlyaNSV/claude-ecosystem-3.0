---
description: V-15 orphan detection (default) с opt-in pending hygiene sweep (--pending-hygiene). Default = fast graph analysis listing orphan artifacts. Hygiene mode = cascade revalidate + validation-pending purge + da-pending stale flag. Use --dry-run для preview без apply.
argument-hint: "[--dry-run] [--pending-hygiene | --full]"
allowed-tools: Read, Glob, Grep, Edit, Write, SlashCommand, Bash(node:*), Bash(date:*)
---

# /product:cleanup

User invoked: `/product:cleanup $ARGUMENTS`

Запускает skill `cleanup-detector.md` для V-15 orphan detection и (опционально) pending hygiene sweep. Surface report + per-orphan recommendations.

## Process

### Step 1: Parse arguments

Recognised flags:

- `--dry-run` — preview mode; surface что **бы** было сделано, не apply destructive actions.
- `--pending-hygiene` (alias `--full`) — opt-in deep sweep: V-15 + 3 pending files.
- Без флагов → V-15 orphan-only mode + apply (interactive per-orphan).

Combinations:
- `--dry-run --pending-hygiene` — preview обоих частей (orphans + hygiene).
- `--pending-hygiene --dry-run` — same (order-independent).
- `--full` — equivalent `--pending-hygiene`.

Invalid args → show usage:

```
Usage:
  /product:cleanup                          # V-15 orphan detection (apply)
  /product:cleanup --dry-run                # preview orphans, не apply
  /product:cleanup --pending-hygiene        # V-15 + 3 pending files sweep
  /product:cleanup --full                   # alias --pending-hygiene
  /product:cleanup --dry-run --pending-hygiene  # preview full sweep
```

### Step 2: Check prerequisites

- `.claude/product.yaml` exists (project bootstrapped)
- `.product/` directory exists

Если нет — refuse с suggestion `/ecosystem:bootstrap`.

### Step 3: Load skill

Load `.claude/skills/product/cleanup-detector.md` per methodology.

### Step 4: Execute per skill instructions

1. Detect Design module: file-based check (`commands/design/` directory) + `product.yaml.modules.design.enabled` fallback.
2. Run V-15 orphan detection (build artifact index + reverse-ref graph + per-orphan recommendation).
3. Если `--pending-hygiene`:
   - 3a. Cascade pending: invoke `/product:cascade --pending --revalidate` (или preview в `--dry-run`).
   - 3b. Validation pending: re-evaluate entries, purge passing ones.
   - 3c. DA pending: flag stale entries (artifact.status == active).
4. Compose report.

### Step 5: Surface report

Per skill `Output format` section — orphan list + (если flag) hygiene actions summary.

### Step 6: Apply (если не `--dry-run`)

- **V-15 orphans:** present per orphan для action. Prompt user:
  ```
  > Archive SC-012? [Y]es | [N]o | [R]e-link | [D]elete | [S]kip
  ```
  - `[Y]es` → Edit frontmatter set `status: deprecated` + add `deprecation_reason` (prompt for reason).
  - `[N]o` → skip; entry stays active.
  - `[R]e-link` → prompt for parent artifact id; Edit parent.frontmatter добавить reverse-ref.
  - `[D]elete` → destructive; require explicit confirmation «Type 'delete' to confirm»; rm file. Journal entry mandatory.
  - `[S]kip` → leave для next session.

- **Pending hygiene:** applied per skill logic; no further per-entry prompts (3a и 3b — bulk operations; 3c — flag-only surface).

### Step 7: Decision journal entry

After applied actions — append к `.product/.decisions/journal.md`:

```
## DEC-CLEANUP-NNN — Cleanup pass (V-15 orphan + pending hygiene)

**Date:** <ISO>
**Mode:** orphan-only | pending-hygiene
**Dry-run:** true | false

### Actions

- Archived 2 orphans: SC-012, BR-018
- Re-linked 1 orphan: LC-007 → FM-002
- Cascade pending refreshed: 47 → 12 entries
- Validation pending purged: 3 entries (V-08 now passing)
- DA pending flagged stale: 2 entries (BR-001, IC-003 manual review)

### Rationale per orphan

- SC-012: deprecated — feature cancelled (FM-003 declined 2026-05-01)
- BR-018: deprecated — replaced by BR-019 после refactor
- LC-007: re-linked к FM-002 (was missing reverse-ref в FM)
```

### Step 8: Surface inline summary

```
Cleanup complete (mode: <orphan-only|pending-hygiene>, dry-run: <yes|no>):
  Orphans handled: <N>  (archived: <N>, re-linked: <N>, deleted: <N>, skipped: <N>)
  Cascade pending: <before> → <after> entries
  Validation pending: <purged> purged, <retained> retained
  DA pending: <flagged> flagged stale

Journal: .product/.decisions/journal.md (DEC-CLEANUP-NNN)

Next actions:
  /product:validate --rule V-15            # re-check orphan state
  /product:status                          # overall .product/ dashboard
  /product:cascade --pending               # review remaining cascade entries
```

При **0 findings** (no orphans + clean pending): «✅ Cleanup clean. No orphans, no stale pending entries.»

## Anti-patterns

1. **Не запускать `--pending-hygiene` без preview сначала.** Sweep refreshes cascade-pending (touches every active artifact through Read+Write no-op) + re-runs validation rules. Если queue large + slow validation → может занять минуты. `--dry-run --pending-hygiene` показывает scope.

2. **Не подтверждать `[D]elete` без journal rationale.** Destructive action requires explicit «Type 'delete' to confirm». Rationale в decision journal — must-have (lesson DEC-DEV-0023 anti-sycophancy pattern).

3. **Не auto-confirm orphan archive в batch.** Per-orphan prompt — protects against accidental deprecation цепочки artifacts с unintended consequences. Если user wants bulk — explicit `[Y]es to all` extension (future v1.1).

4. **Не путать с `/product:validate --rule V-15`.** `validate --rule V-15` — read-only report как часть validation run; `/product:cleanup` — action-oriented (per-orphan resolution + hygiene). Validate для assessment, cleanup для resolution.

5. **Не запускать на uncommitted `.product/`.** Cleanup может modify multiple artifacts (frontmatter edits, pending file updates). Если working tree dirty — surface warning «Uncommitted `.product/` changes detected. Commit или stash before cleanup для safe rollback path.»

## Output writing protocol

- Frontmatter edits (orphan archive) — `Edit` tool, single line `status: active` → `status: deprecated`.
- Pending file updates (validation purge) — re-use logic из `artifact-validate.js purgeValidationPendingFor()` semantics.
- Cascade revalidate — delegated к `/product:cascade --pending --revalidate` command.
- Journal entry — append к `.product/.decisions/journal.md` через Edit (or Write if file missing).

## Related

- Skill: `.claude/skills/product/cleanup-detector.md` (implementation methodology)
- Catalog rule: `.claude/docs/pmo/validation.md §V-15`
- Validation companion: `.claude/commands/product/validate.md` (`--rule V-15` для assessment-only)
- Cascade companion: `.claude/commands/product/cascade.md` (`--pending --revalidate` delegated)
- Pending state files (owned by hooks):
  - `.product/.pending/cascade-pending.yaml`
  - `.product/.pending/validation-pending.yaml`
  - `.product/.pending/da-pending.yaml`
- Phase 4 decisions:
  - DEC-DEV-0027 — hybrid flag design
  - DEC-DEV-0030 Ambiguities 15-17 — per-file hygiene actions, Design module detection, `--dry-run` scope
