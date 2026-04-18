---
description: C1 modification — structural self-audit methodology. Used by /product:drift-check to compare recent artifacts vs anchor (PS + primary HYP + MVP).
---

# Drift Detector — C1 Skill

Methodology for `/product:drift-check` command. Detects direction drift при long sessions / multi-week projects.

## Core premise

ИИ может плавно смещать фокус артефактов away from original PS / HYP / MVP scope без явного pivot decision. Это не всегда плохо (эволюция продукта normal), но **должно быть осознанным**.

Drift-detector surfaces signals; human decides whether to intervene.

## Process

### Step 1: Identify anchor

Anchor = the "direction":

1. **PS** — `.product/problem.md`. If not active → cannot drift-check (no direction to compare).
2. **Primary HYP** — `.product/hypotheses/` с `priority: primary`. If multiple primaries — flag data issue.
3. **MVP scope** — `.product/mvp-scope.md` if exists, otherwise skip (pre-Planning stage).
4. **Active primary SEG** — `.product/segments/` с `priority: primary`.
5. **Active VP** for primary SEG.

### Step 2: Determine scope of analysis

Default: last 10 changed artifacts (by `updated:` field in frontmatter).

Alternatives:
- `--scope last-N` — custom count
- `--since YYYY-MM-DD` — by date
- `--full` — all active artifacts (use sparingly, expensive)

Read artifacts in scope:
- Extract key fields (`id`, `status`, `segment`, `hypotheses`, `value_proposition`, etc.)
- Read body highlights (первый ~500 tokens)

### Step 3: Run alignment checks per artifact

For each recent artifact, check:

#### Check A: Segment alignment

- Does artifact reference primary SEG (in frontmatter `segment:` or body mentions)?
- If references secondary/exploratory SEG — fine if intentional, flag if unexpected
- Flag если references **no SEG** (for D2 artifacts that should tie back)

#### Check B: JTBD alignment

- Does artifact solve a JTBD from primary SEG?
- Check FM.frontmatter.jtbd[] — each JTBD ID должен быть в primary SEG's JTBD list
- Flag JTBDs from secondary/exploratory SEGs для attention

#### Check C: HYP alignment

- Does artifact validate primary HYP (or named HYP in frontmatter)?
- Check FM.frontmatter.hypotheses[] — each HYP active (not invalidated или deferred)
- Flag FMs validating ONLY invalidated HYPs (zombie scope)

#### Check D: Scope alignment

- Is artifact within MVP scope (if applicable)?
- Read MVP.body for inclusion/exclusion list
- Flag artifacts explicitly out of MVP scope but in active FM (scope creep)

#### Check E: Value alignment

- Does artifact reinforce active VP, or contradict?
- Heuristic: does artifact body mention VP's differentiators and pain relievers?
- Contradiction hard to auto-detect — use as soft signal only

### Step 4: Categorize findings

🟢 **Aligned** — artifact clearly fits anchor.
🟡 **Drift signal** — ambiguity or small deviation. Not necessarily bad, но worth surfacing.
🔴 **Significant divergence** — strong evidence of direction change.

**🔴 typical criteria:**
- 3+ FMs validating same secondary HYP (possible shadow primary)
- BRs with parameters vastly inconsistent с PS scope (e.g., «1000+ concurrent users» when pilot tier)
- Primary HYP invalidated но new FMs still being added в its lineage

**🟡 typical:**
- FM priority mismatched с HYP priority (e.g., MUST FM validating exploratory HYP)
- BR hardcoded values imply different scale than current tier
- Feature depths increase без corresponding PS/JTBD changes

### Step 5: Confidence assessment

State overall review confidence (C2):
- **high** — anchor is fresh (<2 weeks old), scope artifacts well-structured, signals unambiguous
- **medium** — anchor maybe stale, some artifacts missing context, signals partly interpretive
- **low** — anchor very old (>1 month), recent discovery not re-validated, many soft signals

Be honest — if signals based on heuristic regex matching, confidence рельно low.

### Step 6: Build report

Output format per `/product:drift-check` Step 5.

Include:
- Anchor summary (one-line each)
- Motion list (just IDs, brief)
- Alignment per category with specific examples
- Confidence statement
- Suggested actions

### Step 7: Journal entry (conditional)

Journal only if meaningful signal detected:
- Any 🔴 — always journal
- 2+ 🟡 on same anchor dimension — journal
- Mixed 🟡 across dimensions — optional (use judgment)

Don't journal «all aligned» checks — noise.

## Heuristics and false-positive management

**False positive patterns to avoid:**

1. «FM-005 doesn't mention HYP-001 в body» — HYP-001 might be in frontmatter only (which is fine). Check both.
2. «BR-012 mentions 1000 users» — might be testing а hypothesis, не real scope. Check if BR is в testing-scope marked.
3. «New SEG-002 created but primary SEG-001 exists» — multiple SEGs normal. Drift only if focus shifted (check recent FM segment distribution).

**When in doubt** — mark as 🟡 with question framing («could this indicate…?»), не 🔴 (asserting divergence).

## Limitations

- Cannot detect **intentional pivot** vs drift — same signal could be either. Surface signal, let human decide.
- Heuristic-based — 10-20% false positive rate typical. State в confidence note.
- Works best на stable anchor. If PS/HYP recently changed, use time window post-change only.
- Not a replacement for periodic human strategy review.

## Example: full drift-check output

```
═══════════════════════════════════════════════════════════
DRIFT CHECK — 2026-04-18T15:30
═══════════════════════════════════════════════════════════

Anchor:
  PS: "Freelance translators lose 2-3h/week to scattered revisions"
  Primary HYP: HYP-001 (willingness to pay centralization — ≥10% conversion)
  Primary SEG: SEG-001 (freelance translators, 3-8 clients)
  Primary VP: VP-001 (centralized revisions inbox)
  MVP scope: centralize email-based revisions only для v1

Scope: last 10 changed artifacts (since 2026-04-10)
  FM-003, SC-005..008, BR-010..014, VC-005, MK-003

── 🟢 Aligned (8) ────────────────────────────────────────
  All FM-003 children serve SEG-001 JTBD-1 (revisions centralization)
  BRs within pilot tier scope (2h batch, 10-50 concurrent implied)
  VC-005 measures HYP-001 metrics (conversion indicators)

── 🟡 Drift signal (2) ────────────────────────────────────
  BR-013 mentions «conflict resolution for 100+ parallel batches»
    → current tier is pilot (10-50 users); BR-013 scope reads like MMP+
    → Q: intentional future-proofing, or scope creep?
  
  MK-003 has 3 screens dedicated to «team management»
    → SEG-001 is solo freelancers; team features не в their JTBDs
    → Q: is SEG expanding to small agencies (SEG-002 scope)?

── 🔴 Significant divergence ──────────────────────────────
  None detected.

── Confidence (C2) ────────────────────────────────────────
  Review confidence: medium
  Reasons:
    - Anchor fresh (PS updated 12 days ago)
    - BR-013 signal strong (numeric contradicts tier — high confidence)
    - MK-003 team-management interpretation — medium (could be team-of-client,
      not team-of-user; worth clarification)

── Suggested actions ──────────────────────────────────────
  For 🟡 signals:
    1. Clarify BR-013 scope — is 100+ parallel aspirational? Scope-cap?
    2. Clarify MK-003 team screens — for whom?

  Optional:
    → /product:patterns complementary scan
    → If drift intentional, consider updating MVP.md scope

Journal entry: DEC-DRIFT-0003 added.
```

## Related

- Command: `/product:drift-check` (calls this skill)
- Complementary: `/product:patterns` (C4 — pattern-level, not direction-level)
- Processes: `.claude/docs/pmo/processes.md §14.3` — drift mitigation overview
