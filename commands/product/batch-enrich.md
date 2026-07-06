---
description: Batch-enrich a SET of FMs (a release's worth) — drive each through enrichment (F.2→F.7 of P2.A) + the bounded completeness-loop, with the human approve-gate moved from per-item to PHASE BOUNDARIES realized as L1 PA-escalations (the owner ratifies from the ledger). THIN ORCHESTRATION over the existing /product:feature + /product:complete machinery — no F.2-F.10 authoring is re-implemented. CHECKPOINT-FIRST + resume (a mid-run session limit resumes cleanly). PREPARE-ONLY — the runner never transitions FM status; F.10/handoff stays the owner's. Epic C-i macro step (DEC-DEV-0145 decisions г/д).
argument-hint: "<FM-NNN> [<FM-NNN> ...] | --all-planned"
allowed-tools: Read, Glob, Grep, Agent, Edit, Write, Bash(node:*), Bash(git:*)
---

# /product:batch-enrich

User invoked: `/product:batch-enrich $ARGUMENTS`

Run the **macro batch-enrichment step** (Epic C-i) over a **SET** of FMs. The completeness-loop
(`/product:complete`, Wave B) hardens ONE feature's spec; this command is the release-level driver:
it takes a set of FMs and drives each through **enrichment** (F.2→F.7 of P2.A) + the **bounded
completeness-loop**, moving the human approve-gate from per-item to **phase boundaries** realized as
**L1 PA-escalations** (the owner ratifies from the pending-actions ledger).

> **THIN ORCHESTRATION (vision cut #4).** This command re-implements **nothing**: the ENRICH stage
> EXECUTES the procedure of the existing `commands/product/feature.md` (enrichment mode F.2→F.7); the
> COMPLETE stage DELEGATES to the existing `complete-feature.mjs` via `workflow()`. The durable executor
> is the Workflow `product/processes/batch-enrich-feature-set.mjs` (deployed
> `.claude/product/processes/`); this command dispatches it.
>
> **PREPARE-ONLY (DEC-DEV-0145, decision в):** the runner **never** transitions FM status — F.10
> (planned → in-progress) is the **owner's** ratification. Boundary gates are PA-escalations; the owner
> ratifies before F.10/handoff.

## Process

### Step 1: Parse + validate

- `$ARGUMENTS` is either one-or-more `FM-NNN` ids (the explicit target list) **or** `--all-planned`
  (discover every FM with frontmatter `status: planned` under `.product/features/`).
- **Neither** target present → refuse (the runner returns a refusal envelope; fail fast here with a
  friendly usage message). An explicit target is mandatory (**B1** — no silent expansion).
- Optional pass-throughs to the child completeness-loop: `--max-waves N` (default 3), `--epsilon E`
  (default 0.01), `--dry-run` (SCORE + SURFACE only in each child loop).

### Step 2: Dispatch the durable runner

```
Workflow({
  scriptPath: '.claude/product/processes/batch-enrich-feature-set.mjs',
  args: {
    features: ["<FM-NNN>", "<FM-NNN>"],   // the explicit target list (omit when using all_planned)
    all_planned: false,                   // true → discover status:planned FMs (log the list before any work)
    max_waves: 3,                         // pass-through to each child complete-feature (its hard cap)
    epsilon: 0.01,                        // pass-through: Δscore convergence floor
    dry_run: false                        // pass-through: SCORE + SURFACE only, no auto-fix / no escalation writes
  }
})
```

> **Pass `args` as an OBJECT, not a JSON string.** Write `args: { features: ["FM-001","FM-003"] }`, NOT
> `args: "{\"features\":[...]}"` — the harness forwards `args` verbatim, so a stringified value reaches
> the script as a string and `features` comes back undefined. (The runner defensively parses a string,
> but pass an object so the guard is belt-and-suspenders.)

The runner owns the whole flow: **Plan** (anchor the run root; resolve `feature.md` + the child
`complete-feature.mjs`; if `all_planned`, discover the planned set and LOG it; **checkpoint-first**
write) → per FM, sequentially: **STATUS** (resolve the FM file + read frontmatter/checkpoint) →
**ENRICH** (execute `feature.md` F.2→F.7 with decisions→PA) → **COMPLETE** (delegate to
`complete-feature.mjs`) → **GATE** (write the phase-boundary PA) → **Report**.

### The B1–B7 rails (what the runner guarantees)

- **B1 EXPLICIT TARGET.** A target-less run is refused; `--all-planned` discovery is **logged before
  any work** — it never silently expands the batch.
- **B2 CHECKPOINT-FIRST + RESUME (урок E1: batches can hit a session limit).** A resumable manifest is
  written to `.product/.batch-enrich/<batch-slug>/` **before** the first enrichment touch (the slug is
  deterministic from the sorted feature list; no timestamps, one writer per FM, no shared-file race).
  On resume: an FM with all stages done is **SKIPPED** (logged + reported, never silent); a partially
  done FM resumes at its first unfinished stage (verify-before-act, DEC-DEV-0093).
- **B3 ORCHESTRATE, DON'T DUPLICATE.** ENRICH executes `feature.md`; COMPLETE delegates via
  `workflow()`. The runner contains **zero** SC/BR templates or field lists.
- **B4 PHASE-BOUNDARY GATES, NOT PER-ITEM.** The per-item human approves in `feature.md` are **replaced**
  by L1 PA-escalation: any real DECISION (threshold / moscow / *-semantic / screen-decision / the NFR
  F.5a.0 `[Y/D/L]` call / anything the enrich agent is genuinely unsure of) escalates to the canonical
  pending-actions ledger; derivable, convention-bound authoring proceeds. **F.8** (design) and **F.9**
  (DA review) are **skipped + logged** (out of C-i scope). The GATE stage writes/updates ONE per-FM
  boundary PA listing that FM's escalated decisions.
- **B5 NO STATUS ROUND-UP (prepare-only).** The runner never transitions FM status; the child loop's
  `honest_unmet` is carried **verbatim**; a below-τ FM is never rounded to done.
- **B6 NO SILENT TRUNCATION.** Every skipped FM/stage is logged AND in the report; a failed stage marks
  the FM `failed_at` and the batch **continues** to the next FM.
- **B7 BOUNDED + SINGLE-WRITER.** FMs run **sequentially** (a plain loop, not `pipeline()`) — concurrent
  FM chains would race the single `.product/` tree, the product hooks, and the PA ledger's next-id
  allocation. Boundedness = finite feature list × bounded stages; the child loop is itself hard-capped.

### Step 3: Surface the report

The runner returns a batch report (no silent truncation). Surface, **verbatim**:
- `processed` — per FM: `enrich` (authored / escalated / skipped_steps), `complete`
  (`final_score` vs `tau`, `met`, `stop`, **`honest_unmet`**), `gate_pa`, `failed_at`;
- `skipped` — `[{feature, stage, reason}]` (resume-done or unresolvable FM file);
- `escalated_total` — decisions escalated across ENRICH + the child loops (the owner ratifies these);
- `caveats` — relay verbatim, especially the **PREPARE-ONLY** line and each FM's **`honest_unmet`**.
  **Never round a below-τ FM up to "done"**, and never present the boundary PAs as decided.

### Fallback — runner unresolvable (pre-wave install)

If `Workflow({scriptPath: '.claude/product/processes/batch-enrich-feature-set.mjs'})` is
**unresolvable** (an install predating this wave), fall back to running the same flow **inline** and
**SAY SO** in the summary:

1. **Resolve targets** — the explicit `FM-NNN` list, or (for `--all-planned`) Glob
   `.product/features/FM-*.md` and keep the `status: planned` ids; **LOG the list before any work** (B1).
2. **Checkpoint-first** — mkdir `.product/.batch-enrich/<batch-slug>/`, write `manifest.json` if absent,
   read any existing per-FM `<FM>.json` state (B2). Skip an all-done FM; resume a partial one.
3. **Per FM (sequentially, B7):** execute `commands/product/feature.md` **F.2→F.7** — with every real
   decision **escalated to a PA** instead of an inline approve (B4), skipping F.8/F.9; then run
   `/product:complete <FM>` for the bounded completeness-loop; then write the **phase-boundary PA**
   ("batch-enrich prepared `<FM>` — owner ratifies before F.10/handoff") listing the escalated decisions.
   Never transition FM status (B5). Update the checkpoint after each stage.
4. **Report** — processed / skipped / escalated_total / each `honest_unmet` — verbatim, no round-up.

Recommend `/ecosystem:update` to land the runner.

## Notes
- **Sequential, NOT `pipeline()` (B7).** The single-writer choice is deliberate: parallel FM chains
  would race the `.product/` tree, the product hooks, and the canonical PA ledger's next-id allocation
  (two chains minting the same `PA-NNN`) — the same rationale as `complete-feature.mjs`'s sequential
  RESOLVE.
- **Checkpoint layout is timestamp-free** (the harness has no `Date.now()`): the batch-slug is derived
  purely from the sorted feature list, so a resume reuses the exact same checkpoint dir.
- Related: `dev/ECOSYSTEM_VISION.md` (Epic C-i); `product/processes/batch-enrich-feature-set.mjs` (this
  runner); `commands/product/feature.md` (the enrichment procedure orchestrated); `commands/product/complete.md`
  + `product/processes/complete-feature.mjs` (the bounded completeness-loop delegated to);
  `docs/pmo/processes.md §3.2 P2.A` (the F.1→F.10 stage semantics).
