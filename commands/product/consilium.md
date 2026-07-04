---
description: Prepare a decision on an already-escalated, FORK-SHAPED decision pending-action (>=2 mutually-exclusive options) by running a heterogeneous jury of Epic-A profile personas (architect/qa + ux when the decision touches UI). Each juror scores the options INDEPENDENTLY from the raw artifacts; their verdicts aggregate DETERMINISTICALLY through the shared consilium-synth (matrix + rank + hard/soft-veto); a recommendation package is written back into the SAME PA in place. PREPARE-ONLY — the jury recommends, the owner ratifies. Epic D generalization of the Orchestrator P2 primitive (DEC-DEV-0145).
argument-hint: "<PA-NNN> [--feature FM-NNN]"
allowed-tools: Read, Glob, Grep, Agent, Edit, Write, Bash(node:*), Bash(git:*)
---

# /product:consilium

User invoked: `/product:consilium $ARGUMENTS`

Run a **decision-preparation jury** on an already-escalated, **fork-shaped** decision pending-action.
The completeness-loop (`/product:complete`) escalates strategic / connected decisions to the
canonical pending-actions ledger as plain PAs; this command takes ONE such PA that enumerates **≥2
mutually-exclusive options** and prepares an owner decision — a heterogeneous jury of Epic-A profile
personas scores the options independently, the shared `consilium-synth.cjs` aggregates their verdicts
deterministically, and a recommendation package is written back into the same PA.

> **The consilium PRIMITIVE is the Orchestrator P2** (`decide-architecture-foundation`,
> DEC-DEV-0129/0135). This command **generalizes** it to completeness-loop decisions via the
> DEC-DEV-0145 `--panel` parameterization of `consilium-synth.cjs` — it does **not** re-implement the
> aggregator.
>
> **PREPARE-ONLY (DEC-DEV-0145, decision в):** the jury recommends, the **owner ratifies**. This never
> closes the PA, edits a spec, or finalizes the decision. Auto-proceed on confidence is F2/L2, not here.

## Process

### Step 1: Parse + validate

- `$ARGUMENTS` first token MUST be a `PA-NNN` id (an already-escalated decision pending-action).
- `--feature FM-NNN` (optional) narrows the PA search to that feature.
- The runner refuses an empty `pa_id`; fail fast here with a friendly message if the token is missing.

### Step 2: Dispatch the durable runner

```
Workflow({
  scriptPath: '.claude/product/processes/consilium.mjs',
  args: {
    pa_id: "<PA-NNN>",        // required — the escalated, fork-shaped decision-PA
    feature: "<FM-NNN>"       // optional — narrows the PA search
  }
})
```

> **Pass `args` as an OBJECT, not a JSON string.** Write `args: { pa_id: "PA-042" }`, NOT
> `args: "{\"pa_id\":\"PA-042\"}"` — the harness forwards `args` verbatim, so a stringified value
> reaches the script as a string. (The runner defensively parses a string, but pass an object so the
> guard is belt-and-suspenders.)

The runner owns the whole flow: **LOAD** (lift the fork's options from the canonical PA — options are
lifted, never invented) → **fork guard** (≥2 mutually-exclusive options; fewer → honest refusal, no
fabrication) → **SCOPE** (declare subject + panel + comparison axes before any spawn — *no silent
fan-out*) → **JURY** (heterogeneous personas fan out in parallel, canonical `subagent_type`, no
general-purpose fallback, raw-source briefs) → **SYNTHESIZE** (deterministic `consilium-synth.cjs
--panel <personas>`, relayed verbatim) → **integration pass** (surfacing-only cross-lens note) →
**RECOMMEND** (update the PA in place with the recommendation package — prepare-only).

**Panel by zone (heterogeneity).** Default panel is `architect-advisor` + `qa-advisor`; `ux-advisor`
is added **only when the decision touches UI** (`has_ui`, or a `screen-decision` category) — mirroring
the zone-router's UI-lens gate. The whole panel is never fired by default.

**Canonical personas — NO general-purpose fallback (rail).** Each juror spawns as its canonical
`subagent_type` (`architect-advisor` / `qa-advisor` / `ux-advisor`). A dropped juror is bounded
RE-SPAWNed once; still null → the panel is marked incomplete and the recommendation carries
`panel_complete:false` (degrade loud). It NEVER falls back to a `general-purpose` agent — a wrong-lens
verdict is worse than a disclosed missing one.

### Step 3: Surface the recommendation

The runner returns a package (no silent truncation). Surface:
- `recommended` + `strength` (`strong` / `split` / `none`) + the option-by-persona `matrix`;
- `panel` (who sat) + `panel_complete` (false ⇒ a juror did not return — a reduced panel);
- `vetoed` (a lens blocked it) + `soft_vetoed` (weak under every lens — flagged, not removed);
- `integration_note` (the surfacing-only cross-lens disclosure — never changes the pick);
- `caveats` — relay verbatim, especially the **PREPARE-ONLY** line: this is the jury's recommendation;
  the owner ratifies. Never present it as a decided fork.

### D2 policy (declared scope; no silent fan-out; approve-gate preserved)

- **Declared scope is mandatory.** The report always names the subject, the panel composition, and the
  comparison axes **before** any juror spawns. If the scope cannot be assembled (no options, missing
  PA), the runner STOPS — it does not "guess" a decision into being.
- **No silent fan-out.** The jury that sits is disclosed in the report; a persona never silently joins.
- **On a connected / irreversible fork, it informs — it does not decide.** The jury prepares; the owner
  ratifies. The approve-gate (owner ratification) is preserved: the PA is never closed by this command.

### Fallback — runner unresolvable (pre-wave install)

If `Workflow({scriptPath: '.claude/product/processes/consilium.mjs'})` is **unresolvable** (an install
predating this wave), fall back to running the same flow **inline** and **SAY SO** in the summary:

1. **LOAD** the PA from the canonical `.claude/pending-actions.md` (resolve the single canonical file
   per the parallel-worktree rule); **LIFT** its ≥2 mutually-exclusive options — never invent one.
2. **GUARD:** <2 options → honest refusal ("not a fork — reformulate the options or leave it to the
   owner"), append a non-blocking note to the PA, and STOP. Do NOT fabricate a second option.
3. **SCOPE:** state the subject + panel (architect + qa; add ux only if UI-bearing) + comparison axes.
4. **JURY:** spawn each persona as its canonical `subagent_type` (never general-purpose) with a
   raw-source brief (PA text + artifact paths — the juror reads the files itself); collect the
   structured verdicts (`prior` = persona name, `scores`, `recommended_option`, `blocking_concerns`).
5. **SYNTHESIZE:** write the verdicts to a temp file and run
   `node .claude/orchestrator/lib/consilium-synth.cjs --verdicts-file <path> --options <a,b,…> --panel <personas>`
   (fall back to the repo `orchestrator/lib/` path for a dev run); relay its JSON verbatim — do NOT
   hand-compute the matrix.
6. **RECOMMEND:** update the PA in place (PA-dedup) with the recommendation + strength + matrix + veto
   ledger + an explicit "jury recommendation — owner ratifies" line. Do NOT close the PA or edit a spec.

Recommend `/ecosystem:update` to land the runner.

## Notes
- Consilium-eligible categories (`gap-classifier.cjs` SSOT): `threshold` / `moscow` / `screen-decision`
  / `ic-semantic` / `br-semantic` / `sc-semantic`. `broken-ref` / `fm-status` are **not** jury material
  (a dangling ref or a status flip is not a fork) — the runner surfaces a caveat if the category is
  non-eligible but keys the hard block on the ≥2-options fork guard.
- The synthesis is deterministic CODE (`consilium-synth.cjs`); the recommendation does not drift
  run-to-run. The jury's value is heterogeneity + auditability, not decision uplift.
- Related: `dev/ECOSYSTEM_VISION.md` (Epic D); `product/processes/consilium.mjs` (this runner);
  `orchestrator/lib/consilium-synth.cjs` (the shared synthesis core);
  `orchestrator/processes/decide-architecture-foundation.mjs` (the P2 sibling primitive).
