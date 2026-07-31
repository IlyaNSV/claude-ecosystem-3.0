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
- **runs** — `.claude/orchestrator/runs/*/run.json` mentioning the FM — by literal `FM-NNN` id, or by the feature's title-slug in `args_summary` (whole-token, ≥4 chars; slug-addressed runs were invisible before — meta-feedback #4, DEC-DEV-0234) → latest gate verdict (GO / NO-GO / MANUAL_VERIFY_REQUIRED); each match discloses `matched_by: fm-id | feature-slug`.
- **visual** — the same matched run.json records: the freshest P8 (`user-journey-acceptance`) run's `visual_evidence` (`COMPLETE` / `COMPLETE_WITH_SKIPS` / `INCOMPLETE` / `none`) + `visual_artifacts_dir` (step screenshots / trace). A pre-visual-leg `run.json` yields `none`, never an error. This source is **reported, never dispositioned** — the has_ui hard-block lives in Step 4a and in V-23, not in the disposition chain (a blocking `visual-evidence-missing` verdict would make the `owner-manual` escape unreachable).
- **fabric** — `.claude/orchestrator/fabric/*/state.json` (FM mention or subject-in-handoff) → `fabric_done`.
- **external** — `.kiro/specs/*/…` dirs that mention the FM or match its title slug.
- **handoff** — `.product/handoffs/<FM>-handoff.md` source SC/BR/IC ids + advisory coverage against external spec text.

Per-FM `disposition` (first match top-down): `already-shipped` · `deprecated` · `no-evidence` · `gate-not-passed` · `validation-blocked` (V-01 fails) · `ready-to-ship`. Independently of the disposition, a `has_ui` candidate carries `visual_review_required: true`.

### Step 3: Report table

Present a per-FM table: current status → disposition → evidence (latest run + gate, fabric state, external files, **visual**, coverage missing-count) → proposed action. The `visual` column is the collector's `evidence.runs.visual` (+ `visual_run_id`); `V-23` marks a row whose `visual_review_required` is true.

```
FM        status        disposition        evidence
FM-003    in-progress   ready-to-ship      run GO (2026-…-abc) · fabric done · 4 external files · visual COMPLETE_WITH_SKIPS (run 2026-…-p8) · coverage_missing 0 · V-23 review required
FM-004    in-progress   gate-not-passed    run NO-GO (2026-…-def) · —          · 0 external files · visual none
FM-005    in-progress   validation-blocked run GO · external present · visual none · V-01 FAIL (no active SC)
FM-006    planned       no-evidence        —
```

- The `visual` value is the P8 verdict verbatim, and its five values mean five different things: `COMPLETE` / `COMPLETE_WITH_SKIPS` / `INCOMPLETE` — the gate judged the designed screens; **`N/A`** — the gate RAN and found no `has_ui` feature in the judged scope (an explicit nothing-to-judge); `none` — **no P8 run answered at all** (no run, or a pre-visual-leg record). `N/A` and `none` are not the same fact: one is a gate that answered, the other is a gate that was never asked — never report them interchangeably.
- `ready-to-ship` rows are **candidates**. Every other disposition gets a one-line explanation of why it is not proposed (never silently dropped).
- If a candidate would jump `planned → shipped` (skipping `in-progress`) — flag it with a note: the FM lifecycle diagram assumes an intermediate `in-progress`; the jump is legal but worth the owner's eye.
- `visual none` on a `has_ui` candidate is **not** a reason to drop it from the table — it is a reason the owner will be asked for `owner-manual` evidence at Step 4.

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

#### Step 4a: Visual-review gate — `has_ui` candidates only (V-23, DEC-DEV-0237)

A candidate with `visual_review_required: true` gets a SECOND, non-skippable question after `Y`. Show the pairs the owner is being asked to compare, then ask for the verdict:

```
FM-003 has_ui — visual review against MK обязателен (V-23).
Evidence: run 2026-…-p8 · visual COMPLETE_WITH_SKIPS (1 skip: MK-003/SI-4 empty-state)
Пары: .product/mockups/assets/fm003/SI-N.png (макет) ↔ <artifacts_dir>/visual/MK-003/SI-N.png (реальность)
[C] conforms / [D] deviations-accepted (перечисли) / [N] не сейчас — без C/D флип НЕ выполняется
```

- `<artifacts_dir>` — the collector's `visual_artifacts_dir` for this FM; the MK ids come from the FM's `mockups[]`.
- **The two halves of a pair are addressed differently — do not assume one key.** The mockup half lives under a per-feature asset key (`fm<NNN>`, e.g. `fm003/`), the evidence half under the **MK id** (`visual/MK-003/`) — one FM may carry several MKs, so the FM key alone does not identify which inventory a screenshot belongs to. The canonical authored mockup artifact is **`SI-N.html`**; the `SI-N.png` beside it is a *generated* render and may be absent — when it is, open the `.html` (never report the pair as missing because only the PNG is gone).
- `C` → `verdict: conforms`. `D` → `verdict: deviations-accepted` + the owner's list, which is written verbatim into `deviations[]` (an empty list with `deviations-accepted` is not a legal record).
- `N` (or any answer that is not C/D) → **the flip is NOT performed**. Report, verbatim:

  > has_ui FM без записанного visual-вердикта не флипается: сверка UI↔MK — терминатор shipped для has_ui (meta-feedback #5, DEC-DEV-0237).

  The FM stays a candidate; nothing is written (not even a partial `impl_sync`).
- `visual none` (no P8 run, or a pre-visual-leg record) does **not** waive the gate — it changes the evidence the owner supplies: `evidence_source: owner-manual` + `evidence_ref` (path / URL of the screenshots or trace the owner actually looked at) + `manual_reason` (why the feature shipped outside the P8 contour). Never invent any of the three; if the owner has no visual evidence at all, that is an `N`.

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
  visual_review:                             # has_ui ONLY — stamped from the Step 4a answer (V-23)
    reviewed_on: YYYY-MM-DD                  # today (the date the owner gave the verdict)
    mks: [MK-003]                            # the FM's mockups[] that were actually compared
    verdict: conforms                        # conforms | deviations-accepted (verbatim from C/D)
    deviations: ["..."]                      # OMIT when verdict: conforms; NON-EMPTY when deviations-accepted
    evidence_source: uja-run                 # uja-run | owner-manual
    evidence_ref: "2026-…-p8"                # uja-run: the P8 run_id; owner-manual: path / URL of the evidence
    manual_reason: "string"                  # OMIT unless evidence_source: owner-manual
```

**No `verdict`, no flip.** For a `has_ui` FM the sub-block is written **whole** together with `status: shipped` — a stamped `impl_sync` without `visual_review` on a `has_ui` feature is precisely the state V-23 blocks, so never write the block "and add the review later".

**Canonical field name is `impl_sync` ONLY.** Do NOT invent look-alike keys — these are forbidden (DEC-DEV-0012 anti-pattern discipline):

- ❌ `implementation_status`
- ❌ `impl_status`
- ❌ `sync_date`
- ❌ `synced_on`
- ❌ `implementation_sync`

**Canonical sub-block name is `visual_review` ONLY** — equally forbidden:

- ❌ `visual_sync`
- ❌ `ui_review`
- ❌ `mk_review`
- ❌ `design_review`
- ❌ `visual_verification`
- ❌ `impl_review`

Nested field names inside `impl_sync` are exactly `synced_at`, `gate`, `run_id`, `evidence`, `coverage_missing`, `visual_review` — no synonyms; inside `visual_review` exactly `reviewed_on`, `mks`, `verdict`, `deviations`, `evidence_source`, `evidence_ref`, `manual_reason`. Touch no other FM field. The block is **optional by contract**: an FM without it behaves 1:1 as before (soft migration, precedent `product_class` DEC-DEV-0079 / `domain_fit` DEC-DEV-0169); `visual_review` inherits that shape — optional by schema, obligatory by rule V-23 from the 2026-07-31 watermark.

### Step 6: Journal + final summary

Append one entry per applied sync to `.product/.decisions/journal.md` (mirror of `DEC-PROMOTE` in `/product:promote-note`; create the file with Write if missing):

```markdown
## DEC-SYNC-NNN — impl-sync: FM-003 → shipped

**Date:** YYYY-MM-DD
**Trigger:** /product:impl-sync FM-003
**Tag:** #impl-sync #FM-003

### Evidence
GO gate (run 2026-…-abc) · fabric line done · 4 external spec files · coverage_missing 0 · V-01 pass (SC-005 active) · visual COMPLETE_WITH_SKIPS (P8 run 2026-…-p8) · owner visual verdict: conforms (MK-003).

### Result
FM-003 status in-progress → shipped; impl_sync block stamped (gate GO, run 2026-…-abc, evidence [runs, fabric, external]; visual_review conforms, evidence_source uja-run).
```

A candidate declined **at the visual gate** (`N` at Step 4a) is journaled as a declined candidate like any other, naming the reason as the missing visual verdict — the point of the record is that the feature was proposed and NOT shipped.

Then print a final summary: applied / skipped / and the non-candidates with their disposition. Skipped candidates and blocked FMs are journaled as a line only if the owner explicitly declined a candidate (mirror promote-note's cancelled-entry discipline); pure `no-evidence` FMs need no entry.

## Anti-patterns

1. **No mutation without `Y`.** This is a read-first sensor. Do not "just apply" because evidence looks strong — the owner ratifies every status change.
2. **Do not "fix" V-01 yourself.** A `validation-blocked` FM (no active SC) is routed back to `/product:feature FM-NNN` to add/activate a scenario — never silently mark an SC active to unblock shipping.
3. **Never fabricate evidence.** If runs/fabric/external are absent, the disposition is `no-evidence` — report it, do not infer a GO.
4. **Never touch `.kiro/`** (or any external tool zone). It is the external tool's zone; this command only READS it. Writes are confined to the FM's frontmatter in `.product/`.
5. **Never resurrect a `deprecated` FM.** Deprecated features are never proposed for shipping, whatever the evidence.
6. **Only `impl_sync` — no look-alike keys** (see Step 5 forbidden list). No other FM field is modified besides `status`, `updated`, and the `impl_sync` block.
7. **Never route around the visual gate on a `has_ui` FM.** Strong machine evidence (`visual COMPLETE`, GO gate, green coverage) is *input to* the owner's review, not a substitute for it: the whole defect this closes (meta-feedback #5) is a green DoD over a feature nobody ever looked at. Do not fabricate a `verdict`, do not infer `conforms` from `COMPLETE`, do not stamp `owner-manual` without a real `evidence_ref` + `manual_reason`, and do not offer a "skip the review for now" path — `N` means the FM stays a candidate.

## Related

- Evidence collector: `.claude/hooks/product/lib/impl-evidence.cjs` (deterministic, read-only; CLI `--json`/`--fm`/`--at`)
- Coverage oracle (reused id extractors): `.claude/orchestrator/lib/coverage-oracle.cjs`
- FM artifact spec + `impl_sync` block: `.claude/docs/pmo/artifacts/FM.md`
- V-01 (shipped needs ≥1 active SC) + V-23 (has_ui shipped needs `impl_sync.visual_review`): `.claude/docs/pmo/validation.md §5.1`
- P8 visual evidence producer (`visual_evidence` / `artifacts_dir`): `.claude/orchestrator/processes/user-journey-acceptance.mjs`
- Writer-boundary (Product is the only `.product/` writer): `.claude/docs/integrator-module/SPEC.md §8.3`
- Sibling approve-gated command: `.claude/commands/product/promote-note.md`
