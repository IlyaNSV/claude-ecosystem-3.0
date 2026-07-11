---
description: Diagnose an Integrator-zone failure — journal lookup → contract check → root-cause hypothesis → approve-gated fix → regression → journal. One-shot, not a REPL.
argument-hint: "<error-description> [--tool <name>]"
---

# /integrator:debug

User invoked: `/integrator:debug $ARGUMENTS`

One-shot diagnosis + **approve-gated** fix for an Integrator-zone failure, per `docs/integrator-module/SPEC.md §7.3`. Not an interactive REPL — one pass: investigate → propose → (approve) → fix → verify → journal.

**Input:** `<error-description>` (free text from the user) plus optional `--tool <name>` to scope the search. If `--tool` is absent, infer the likely tool from the description and the journal; if still ambiguous, ask which tool before mutating anything.

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js`. Cleanup at Final step.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:debug","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Journal lookup + symptom decomposition

- Read `.claude/integrator/project-journal.md` — recent entries for the affected tool (and `~/.claude/integrator/decision-journal.md` for global `#<tool>` history). Have we seen this before? Was there a recent `update`/`add`/`replace` that could have introduced it?
- Decompose the symptom: which command failed, on which artifact/feature, at which stage (produce vs consume vs transform).

### Step 2: Contract check

Read the contracts touching the affected tool (`.claude/integrator/contracts/CNT-*.yaml` + companion `.md`). For each candidate:
- Is `status: active`? Do pre/post `validation` checks still hold against the failing input?
- If drift is suspected (recent version bump, adapter mismatch), run the drift heuristics — methodology in `.claude/skills/integrator/drift-detection.md` (D1/D2/D3), or the shared seam `node .claude/hooks/integrator/lib/drift-checks.cjs --root . --json` for a fast read.

### Step 3: Root-cause hypothesis

State a concrete hypothesis tying symptom → cause (e.g. "adapter passes MK-* as a thin `figma_url` reference, but this handoff carries a full Design Package with none → consumer gets an empty link and crashes").

**If the evidence is thin, say so — do not fabricate a cause.** Instead, name exactly what to collect (verbatim error output, the failing artifact, adapter `--verify-only` against the fixture) and stop for the user to supply it.

### Step 4: Proposed fix + risks

Present the fix as a concrete diff or step plan, plus risks (e.g. "adapter change may affect FM-001..006 — I'll regression-check them"). Fixes are confined to the **Integrator zone** (contracts, adapters, `active-tools.yaml`, `pmo-mapping.yaml`) or the **tool's own config**. Nothing else.

### Step 5: Approve gate (y / n / details)

```
Approve this fix? (y / n / details)
```

- `details` → show the full plan (affected files, adapter diff, regression scope), then re-ask.
- `n` → change nothing. Record the diagnosis as a cancelled entry (Step 8, `entered/cancelled` — precedent SPEC §7.5).
- `y` → proceed to Step 6.

**Without an explicit `y`, mutate nothing.**

### Step 6: Apply

Apply the approved fix (edit the adapter / contract / config). Stay inside the Integrator zone.

### Step 7: Regression

Re-run what failed:
- Re-execute the originally-failing command/flow.
- Where a contract adapter is involved, run `node .claude/integrator/adapters/<adapter>.js --verify-only --fixture <project-fixture>`.
- Spot-check adjacent features the fix could have disturbed (the risks named in Step 4).

If regression fails → do not claim success; report the adapter output verbatim and offer to revert the just-applied change.

### Step 8: G15 — systematic-issue routing (SPEC §4.4)

If this failure is **systematic** — a repeat class already in the journal (same tool/contract failing recurrently, or 2+ debug entries in a short window) — explicitly surface the confidence-lifecycle entry point:

```
This looks systematic (Nth occurrence for <tool>/<contract>). Beyond this fix,
consider lowering the tool's confidence for the affected PMO zone:
  /product:validation-tune  → propose confidence-downgrade for <tool> @ <zone>
Confidence never downgrades automatically — that runs through an explicit human
decision with its own journal entry (SPEC §4.4).
```

This is a recommendation, not an automatic action. It is the designed hand-off from Integrator debugging into the confidence lifecycle.

### Final: Journal entry + cleanup

Append a curated entry to `.claude/integrator/project-journal.md` (the `journal-hook` also auto-logs the raw mutations; this is the human-readable decision record, template mirrors `/integrator:update`). **Journal both outcomes** — an applied fix *and* a cancelled diagnosis (`entered/cancelled`, precedent SPEC §7.5):

```markdown
## DEC-INT-NNNN — Debug: <short symptom> (<tool>)

**Date:** YYYY-MM-DD
**Trigger:** /integrator:debug <args>
**Tag:** #debug #<tool> #<drift-fix|contract-fix|config-fix|cancelled>

### Symptom
<what failed, on which artifact, at which stage>

### Investigation
<journal history + contract/drift findings>

### Root cause
<hypothesis, or "insufficient evidence — awaiting <what>"> 

### Resolution
<fix applied + files touched>  |  <cancelled: user declined; kept for memory>

### Regression
<what was re-run and the outcome>

### Systematic?
<no | yes → routed to /product:validation-tune for <tool>@<zone>>

### Lessons
<pattern to watch; e.g. "on artifact-model change, re-check ALL contracts, not just the obviously-affected one">
```

Then remove the marker:

```bash
rm -f .claude/integrator/.session-context.json
```

Clean up on every exit path (thin-evidence stop, `n`, regression failure) too — a stale marker trips `scope-guard` warnings until its 1h TTL.

## Important constraints

- **One-shot, not a REPL.** A single investigate→propose→fix→verify pass. Deeper iteration is a fresh `/integrator:debug`.
- **Approve-gated.** No file changes before an explicit `y`. `details` explains; `n` cancels (and is journalled).
- **Scope-guarded zone.** Never touch `.product/`, `.kiro/`, or `docs/pmo/`. Fixes live only in the Integrator zone or the failing tool's own config.
- **Honesty over a guess.** Thin evidence → say what's missing and stop, rather than invent a root cause.
- **Always journal** — applied or cancelled — so the next session inherits the memory.

## Error handling

| Step | Failure | Action |
|---|---|---|
| 0/input | No `--tool` and tool not inferable | Ask which tool before any mutation |
| 1 | No journal / no matching history | Proceed on the symptom + contract state; note the empty history |
| 2 | Contract file unparseable | Report it as a candidate root cause; do not auto-repair without approval |
| 3 | Evidence insufficient | Name what to collect; stop (no fix, no mutation) |
| 5 | User answers `n` | Mutate nothing; journal `entered/cancelled`; cleanup marker |
| 7 | Regression fails | Report adapter output verbatim; offer revert; journal the failure |
