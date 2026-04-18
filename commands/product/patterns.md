---
description: Meta-linter — scan .product/ for recurring anti-patterns across artifacts. C4 modification. Informational only.
argument-hint: "[--scope <artifact-type> | --pattern <pattern-name>]"
---

# /product:patterns

User invoked: `/product:patterns $ARGUMENTS`

C4 modification — meta-linter complementary to `/product:drift-check`. While drift-check looks at **direction** (are we solving same problem?), patterns looks at **consistency** (are we authoring artifacts consistently?).

## When to run

- **On-demand** — anytime user wants pattern audit
- **Weekly** — suggested routine for mature projects
- **Before handoff** — catch issues before freezing state
- **After bulk edits** — after mass-rename или large cascade

## Process

Load skill `.claude/skills/product/pattern-linter.md` for the pattern dictionary.

### Step 1: Parse arguments

- No args — scan all active artifacts
- `--scope SC` — only scenarios
- `--scope BR` — only business rules
- `--pattern <pattern-name>` — check specific pattern only

### Step 2: Load pattern dictionary

Pattern dictionary lives в skill file. v1 includes these patterns:

| Pattern | Scope | Description |
|---|---|---|
| **hardcoded-across-BR** | BR-* | Same value (e.g., `2h` window, email regex) hardcoded в multiple BR → suggest shared-value BR или parameter extraction |
| **missing-actor-in-SC** | SC-* | SC steps без явного actor prefix («System does X» — who?) |
| **asymmetric-FM-deps** | FM-* | FM-A has `dependencies: [FM-B]` but FM-B doesn't list FM-A in prerequisite field |
| **over-parameterized-BR** | BR-* | BR с 8+ parameters — likely split candidate |
| **stale-draft-accumulation** | all | 5+ drafts с updated > 14 дней |
| **synonym-candidates-in-BG** | BG | Terms с similar meaning не flagged as synonyms |
| **orphan-in-active-FM** | any | Artifact not referenced by any active FM (но не в `deferred_by_design`) |
| **BR-without-rationale** | BR-* | BR body missing "Rationale" section |
| **SC-without-verification** | SC-* | Active SC без связанного VC |
| **LC-unreachable-states** | LC-* | State listed but no transitions lead to it (complements V-05 but finds design-level issues) |
| **inconsistent-BR-categories** | BR-* | Similar BR имеют different `category:` (one `validation`, another `calculation` — same actual logic) |

Pattern dictionary expandable per future findings через `/product:meta-feedback` (C3).

### Step 3: Scan artifacts

For each applicable pattern in scope:
- Apply heuristic check к relevant artifacts
- Collect matches с context (which artifacts, what's the issue)

### Step 4: Build report

```
═══════════════════════════════════════════════════════════
PATTERNS SCAN — <timestamp>
═══════════════════════════════════════════════════════════

Scope: <all | specific>
Patterns checked: <N>
Artifacts analyzed: <N>
Findings: <total count>

── Structural issues (<count>) ────────────────────────────

  ⚠ hardcoded-across-BR: 3 BRs hardcode email regex
    BR-010 (sender match): /^[a-z]+@[a-z]+\.[a-z]+$/
    BR-015 (notification): /^[a-z]+@[a-z]+\.[a-z]+$/
    BR-022 (validation): same pattern
    Suggestion: extract as shared `BR-EMAIL-FORMAT` referenced from each,
                OR parameterize into shared config.

  ⚠ asymmetric-FM-deps: 2 pairs
    FM-003 depends on FM-001, but FM-001 не listed FM-003 в 'dependents'
    FM-007 depends on FM-005, similar

── Consistency issues (<count>) ───────────────────────────

  ℹ inconsistent-BR-categories: 2 cases
    BR-010 (email linking) category: workflow
    BR-015 (SMS linking)   category: calculation
    Similar logic, different category — potential mis-categorization.

  ℹ missing-actor-in-SC: 1 case
    SC-009 step 3: "System does validation" — which actor?
    Consider: System vs AutomatedScheduler vs specific subsystem.

── Hygiene (<count>) ──────────────────────────────────────

  🟡 stale-draft-accumulation: 4 drafts >14 days
    MR (updated 2026-03-20)
    CA (updated 2026-03-22)
    HYP-004 (updated 2026-03-15)
    SC-020 (updated 2026-03-10)
    Suggestion: /product:cleanup --dry-run для review

  🟡 BR-without-rationale: 1 case
    BR-030 missing ## Rationale section

── Optional improvements (<count>) ────────────────────────

  🔵 over-parameterized-BR: 1 case
    BR-012 has 11 parameters — may be split candidate.
    Review: are parameters truly parameterized, or split business rules hidden as params?

═══════════════════════════════════════════════════════════
CONFIDENCE STATEMENT (C2)
═══════════════════════════════════════════════════════════

Scan confidence: medium
Reasons:
  - hardcoded-across-BR based on regex match — reliable for exact duplicates,
    misses semantic equivalents
  - asymmetric-FM-deps based on frontmatter parsing — reliable
  - missing-actor-in-SC uses heuristic regex — 10-15% false positive rate
  - inconsistent-BR-categories requires human judgment — flag for review, not auto-action

═══════════════════════════════════════════════════════════
SUGGESTED ACTIONS
═══════════════════════════════════════════════════════════

  High-value:
    1. Extract shared email format BR (3 BRs affected)
    2. Fix asymmetric FM-deps (2 pairs, simple bi-dir update)

  Review per finding:
    3. Clarify BR-010/015 categorization
    4. Cleanup stale drafts: /product:cleanup --dry-run
    5. Add rationale to BR-030

  Optional:
    6. Review BR-012 parameter structure
```

### Step 5: Journal entry (if significant)

If report contains 5+ findings OR any hard asymmetry issues — append summary to journal:

```
DEC-PATTERNS-<NNN> — Pattern scan: <N> findings
Date: <timestamp>
Significant:
  - hardcoded-across-BR (3 BRs)
  - asymmetric-FM-deps (2 pairs)
Next: user review suggested actions
```

Otherwise — return report without journaling.

### Step 6: Optional fix shortcuts

If user says "fix pattern X" — ассистент can apply automatic fixes where safe:
- asymmetric-FM-deps → auto-add missing reverse reference (bi-dir consistency via V-11 engine)
- BR-without-rationale → generate rationale draft from body content, user approves

**Don't auto-fix** для:
- hardcoded-across-BR (architectural decision how to refactor)
- inconsistent-BR-categories (semantic judgment)
- over-parameterized-BR (design split, not automatic)

## Important constraints

- **Non-blocking, informational.** Никогда не blocks workflow.
- **Honest false-positive rates.** Each pattern has accuracy characteristic — state it.
- **Pattern dictionary expandable.** When new antipatterns emerge in pilot, add to `pattern-linter.md` skill (via `/product:meta-feedback` proposal or manual edit).
- **Don't overwhelm.** If >20 findings, truncate to top 10 with "N more..."
- **Confidence per finding** (C2) — не всё equally reliable.

## Related

- Skill: `.claude/skills/product/pattern-linter.md` — full pattern dictionary + heuristics
- Complementary: `/product:drift-check` (C1) — direction vs this (consistency)
- Feedback loop: если pattern generates many false positives → `/product:meta-feedback` propose refining
