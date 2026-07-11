---
description: "Ingest implementation results back into .product/ — reconcile FM status against orchestrator run verdicts / completed fabric lines / external spec dirs, then (owner-approve-gated) flip verified features to shipped and stamp an impl_sync block. Reverse-flow of handoff (external tool → .product/). --dry-run reports only."
argument-hint: "[FM-NNN] [--all] [--dry-run]"
allowed-tools: Read, Glob, Grep, Edit, Bash(node:*)
---

# /product:impl-sync

User invoked: `/product:impl-sync $ARGUMENTS`

Closes the reverse-flow gap (G02): the Product → handoff → adapter → external-tool chain is one-directional, so a feature's implementation RESULT never returns to `.product/` and `FM.status` stays `planned`/`in-progress` forever. This command reconciles each FM against **deterministic on-disk evidence** of implementation and — only after an explicit owner **Y** — flips verified features to `shipped` and records an `impl_sync` block.

**Product is the single writer of `.product/`** (Integrator SPEC §8.3): the Orchestrator/fabric only leaves a `project_fm_shipped_hint` note-prescription; this command is where that hint (and all other evidence) is turned into an actual status change, under human approval.

**Guarantee:** Without an explicit `Y`, nothing in `.product/` is modified. This command is a read-first sensor + an approve-gated writer — never an auto-sync.

## Args

- `FM-NNN` — scope to one feature (e.g. `FM-003`).
- `--all` — scan every FM under `.product/features/` (this is also the default when no `FM-NNN` is given).
- `--dry-run` — report the reconciliation and stop before the approve gate; mutate nothing.

Invalid args → show usage:
```
Usage:
  /product:impl-sync                 # scan all FM (== --all)
  /product:impl-sync FM-003          # one feature
  /product:impl-sync --all           # explicit all
  /product:impl-sync FM-003 --dry-run   # report only, no approve gate
```

## Process

### Step 1: Parse args + verify prerequisites

- Parse `$ARGUMENTS`. No positional `FM-NNN` == `--all`.
- Verify `.product/` exists. If not → refuse honestly: "No `.product/` here — run `/ecosystem:bootstrap` first." (This is not an ingest target.)

### Step 2: Collect evidence (deterministic sensor)

Run the collector — it reads only, writes nothing, and reads no secret/env values:

```bash
node .claude/hooks/product/lib/impl-evidence.cjs --root . --json          # all FM
node .claude/hooks/product/lib/impl-evidence.cjs --root . --fm FM-003 --json   # scoped
```

It re-derives evidence from ground truth (reusing the Orchestrator coverage-oracle id extractors, per the reconcile pattern parse→unify→dedupe→disposition):
- **runs** — `.claude/orchestrator/runs/*/run.json` mentioning the FM → latest gate verdict (GO / NO-GO / MANUAL_VERIFY_REQUIRED).
- **fabric** — `.claude/orchestrator/fabric/*/state.json` (FM mention or subject-in-handoff) → `fabric_done`.
- **external** — `.kiro/specs/*/…` dirs that mention the FM or match its title slug.
- **handoff** — `.product/handoffs/<FM>-handoff.md` source SC/BR/IC ids + advisory coverage against external spec text.

Per-FM `disposition` (first match top-down): `already-shipped` · `deprecated` · `no-evidence` · `gate-not-passed` · `validation-blocked` (V-01 fails) · `ready-to-ship`.

### Step 3: Report table

Present a per-FM table: current status → disposition → evidence (latest run + gate, fabric state, external files, coverage missing-count) → proposed action.

```
FM        status        disposition        evidence
FM-003    in-progress   ready-to-ship      run GO (2026-…-abc) · fabric done · 4 external files · coverage_missing 0
FM-004    in-progress   gate-not-passed    run NO-GO (2026-…-def) · —          · 0 external files
FM-005    in-progress   validation-blocked run GO · external present · V-01 FAIL (no active SC)
FM-006    planned       no-evidence        —
```

- `ready-to-ship` rows are **candidates**. Every other disposition gets a one-line explanation of why it is not proposed (never silently dropped).
- If a candidate would jump `planned → shipped` (skipping `in-progress`) — flag it with a note: the FM lifecycle diagram assumes an intermediate `in-progress`; the jump is legal but worth the owner's eye.

**`--dry-run` stops here.** Mutate nothing.

### Step 4: Approve gate (per candidate, or batch)

For each `ready-to-ship` candidate (offer batch approval if there are several):

```
Ship FM-003 → shipped?  [Y] apply / [E] show full evidence + frontmatter diff / [N] skip
```

- `E` → show the full evidence JSON for this FM and the exact frontmatter diff that `Y` would apply, then re-ask.
- `N` → skip this FM (record nothing).
- `Y` → apply Step 5 for this FM.

**Without an explicit `Y`, nothing in `.product/` is modified.**

### Step 5: Apply (only on Y)

Edit **only** the FM's frontmatter — nothing else in the file, no other artifact:

- `status: shipped`
- `updated: <today>`
- add the canonical `impl_sync` block:

```yaml
impl_sync:
  synced_at: YYYY-MM-DD
  gate: GO
  run_id: "<latest GO run id | null>"     # from the runs evidence; null if shipped via fabric+external
  evidence: [runs, fabric, external]        # which sources actually produced evidence
  coverage_missing: 0                        # from advisory coverage; OMIT this line entirely if coverage was null
```

**Canonical field name is `impl_sync` ONLY.** Do NOT invent look-alike keys — these are forbidden (DEC-DEV-0012 anti-pattern discipline):

- ❌ `implementation_status`
- ❌ `impl_status`
- ❌ `sync_date`
- ❌ `synced_on`
- ❌ `implementation_sync`

Nested field names inside `impl_sync` are exactly `synced_at`, `gate`, `run_id`, `evidence`, `coverage_missing` — no synonyms. Touch no other FM field. The block is **optional by contract**: an FM without it behaves 1:1 as before (soft migration, precedent `product_class` DEC-DEV-0079 / `domain_fit` DEC-DEV-0169).

### Step 6: Journal + final summary

Append one entry per applied sync to `.product/.decisions/journal.md` (mirror of `DEC-PROMOTE` in `/product:promote-note`; create the file with Write if missing):

```markdown
## DEC-SYNC-NNN — impl-sync: FM-003 → shipped

**Date:** YYYY-MM-DD
**Trigger:** /product:impl-sync FM-003
**Tag:** #impl-sync #FM-003

### Evidence
GO gate (run 2026-…-abc) · fabric line done · 4 external spec files · coverage_missing 0 · V-01 pass (SC-005 active).

### Result
FM-003 status in-progress → shipped; impl_sync block stamped (gate GO, run 2026-…-abc, evidence [runs, fabric, external]).
```

Then print a final summary: applied / skipped / and the non-candidates with their disposition. Skipped candidates and blocked FMs are journaled as a line only if the owner explicitly declined a candidate (mirror promote-note's cancelled-entry discipline); pure `no-evidence` FMs need no entry.

## Anti-patterns

1. **No mutation without `Y`.** This is a read-first sensor. Do not "just apply" because evidence looks strong — the owner ratifies every status change.
2. **Do not "fix" V-01 yourself.** A `validation-blocked` FM (no active SC) is routed back to `/product:feature FM-NNN` to add/activate a scenario — never silently mark an SC active to unblock shipping.
3. **Never fabricate evidence.** If runs/fabric/external are absent, the disposition is `no-evidence` — report it, do not infer a GO.
4. **Never touch `.kiro/`** (or any external tool zone). It is the external tool's zone; this command only READS it. Writes are confined to the FM's frontmatter in `.product/`.
5. **Never resurrect a `deprecated` FM.** Deprecated features are never proposed for shipping, whatever the evidence.
6. **Only `impl_sync` — no look-alike keys** (see Step 5 forbidden list). No other FM field is modified besides `status`, `updated`, and the `impl_sync` block.

## Related

- Evidence collector: `.claude/hooks/product/lib/impl-evidence.cjs` (deterministic, read-only; CLI `--json`/`--fm`/`--at`)
- Coverage oracle (reused id extractors): `.claude/orchestrator/lib/coverage-oracle.cjs`
- FM artifact spec + `impl_sync` block: `.claude/docs/pmo/artifacts/FM.md`
- V-01 (shipped needs ≥1 active SC): `.claude/docs/pmo/validation.md §5.1`
- Writer-boundary (Product is the only `.product/` writer): `.claude/docs/integrator-module/SPEC.md §8.3`
- Sibling approve-gated command: `.claude/commands/product/promote-note.md`
