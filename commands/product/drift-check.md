---
description: Structural self-audit — check that recent artifacts still align with PS, primary HYP, MVP scope. C1 modification.
argument-hint: "[--scope <last-N-artifacts> | --since <date>]"
---

# /product:drift-check

User invoked: `/product:drift-check $ARGUMENTS`

C1 drift detection modification. Non-blocking structural self-audit. Answers: "ИИ ещё делает тот же продукт, или начал дрифтовать?"

## When to run

- **On-demand** — anytime human wants direction check
- **Auto before /product:handoff** (non-blocking info) — catches drift before freezing FM state into external tool input
- **Auto after every N=10 new/changed artifacts** (configurable)
- **Before major decisions** (tier upgrade, MVP evolution, pivot consideration)

## Process

Load skill `.claude/skills/product/drift-detector.md` for methodology.

### Step 1: Parse arguments

- No args — default scope (last 10 changed artifacts)
- `--scope last-<N>` — custom scope (artifact change count)
- `--since <YYYY-MM-DD>` — artifacts changed after date
- `--full` — all active artifacts (expensive, use sparingly)

### Step 2: Anchor artifacts (the "direction")

Read as ground truth:
- `.product/problem.md` (PS) — what problem we're solving
- Active `HYP-*` with `priority: primary` (or first HYP if none tagged primary) — what we're validating
- `.product/mvp-scope.md` (MVP) if exists — what's in current scope

These are **the direction**. All drift is measured against these.

### Step 3: Recent artifacts (the "motion")

Read:
- Last N changed artifacts (from git log or `updated` timestamps)
- Their scope: which SEG are they addressing, which HYP validating, what category of feature

### Step 4: Alignment analysis

For each recent artifact, check:
- **Segment alignment:** does it serve active SEG (especially primary)?
- **JTBD alignment:** does it solve one of the JTBDs in SEG?
- **HYP alignment:** does it validate primary HYP (or another active HYP)?
- **Scope alignment:** is it within MVP scope (for things in MVP phase)?
- **Value alignment:** does it reinforce VP, or contradict?

### Step 5: Produce alignment report

```
═══════════════════════════════════════════════════════════
DRIFT CHECK — <timestamp>
═══════════════════════════════════════════════════════════

Scope: last 10 changed artifacts (since 2026-04-10)
Anchor: PS + HYP-001 (primary) + MVP scope

── Direction (what we're doing) ───────────────────────────
  Problem: <one-line summary from PS>
  Primary HYP: <HYP-001 statement>
  MVP scope: <brief>
  Primary SEG: SEG-001 (<name>)

── Recent motion (last 10 changes) ────────────────────────
  FM-005, SC-012, SC-013, BR-020, VC-015, ...

── Alignment analysis ─────────────────────────────────────

  🟢 Aligned (<N>):
    FM-005 validates HYP-001, serves SEG-001 JTBD-2 ✓
    SC-012 implements FM-005 main flow ✓
    ...

  🟡 Drift signal (<N>):
    FM-007 marked priority=must but validates HYP-003
           (HYP-003 is tagged exploratory, not primary).
      Question: is MVP scope expanding? Or is FM-007 mis-priced?

    BR-025 parameters assume 1000+ concurrent users.
           Current tier = pilot (target: 10-50 users).
           Question: premature scalability concern?

  🔴 Significant divergence (<N>):
    [only if strong evidence of direction change]

── Confidence statement (C2) ──────────────────────────────
  Review confidence: medium
  Reasons: recent FMs well-documented; but primary HYP не изменена since
           Discovery 3 weeks ago — assumption that it's still valid
           may be stale. Consider re-running discovery validation.

── Suggested actions ──────────────────────────────────────

  For 🟡 signals:
    1. Clarify FM-007 priority with explicit HYP link update
    2. Re-check BR-025 parameters against pilot tier reality

  Optional:
    → /product:patterns — complementary meta-linter scan
    → /product:meta-feedback if signals reveal rule-level issues
```

### Step 6: Journal entry (only if significant)

If report contains 🔴 или 2+ 🟡 signals — append to `.product/.decisions/journal.md`:

```
DEC-DRIFT-<NNN> — Drift check surfaced <N> signals
Date: <timestamp>
Scope: last 10 artifacts since <date>
Findings:
  - FM-007 priority vs HYP-003 alignment question
  - BR-025 parameters vs pilot tier mismatch
Next: awaiting human review per suggested actions
```

If no significant signals — don't journal (avoid noise). Just return report.

## Important constraints

- **Non-blocking.** Never prevents other operations. Info-only.
- **Honest uncertainty.** Drift detection based on heuristic text analysis of artifacts — не всегда accurate. State confidence (C2).
- **Anchor immutability during check.** Don't modify PS/HYP/MVP while analyzing — those are the reference point.
- **Scope discipline.** Default is last 10 — не всё `.product/`. `--full` expensive, reserve for major checkpoints.
- **Avoid false alarms.** Better to report "no significant drift detected" than fabricate signals to look thorough.

## Related

- Skill: `.claude/skills/product/drift-detector.md` — methodology
- Complementary: `/product:patterns` (C4 meta-linter) — pattern-level drift
- Processes: `.claude/docs/pmo/processes.md §14.3` — drift mitigation mechanisms
