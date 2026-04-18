---
description: AI proposes ecosystem-level improvements (rule overrides, config tweaks) based on observed patterns. C3 modification.
argument-hint: "[--review-suggestions]"
---

# /product:meta-feedback

User invoked: `/product:meta-feedback $ARGUMENTS`

C3 modification — the **feedback loop from AI to ecosystem**. Lets ассистент surface "rule X keeps generating false positives, propose downgrade" — human approves, config updates, journal records rationale.

## Two invocation modes

### Mode A: AI-initiated (automatic surfacing)

During regular work, когда ассистент замечает pattern:
- V-* rule with false-positive rate >50% over last 10 invocations
- `approve_override` used 3+ times for same rule
- User repeated downgrade of same rule

Assistant проактивно surfaces proposal в следующем interaction (not blocking current work).

### Mode B: Human-initiated (this command)

User runs `/product:meta-feedback` to explicitly request:
- Review all queued proposals (pending from Mode A)
- Scan for new improvement opportunities
- Explicit ask: "what should we change about validation behavior?"

## Process (Mode B — human-initiated)

Load skill `.claude/skills/product/meta-feedback.md` for detail.

### Step 1: Gather observation data

Read:
- `.claude/integrator/validation-config.yaml` — current overrides
- Journal entries tagged `#drift-fix`, `#error-fix`, `#rule-override` (last 30 days)
- Artifact frontmatter for `approve_overrides[]` (D2 usage patterns)
- `.product/.pending/validation-pending.yaml` — queued findings

### Step 2: Analyze patterns

Look for:
- **Rules с high false-positive rate** — surfaced often, accepted rarely
- **Rules user keeps overriding** — signal that default severity is wrong
- **Processes with excessive iteration** — signal that workflow has friction
- **Artifacts repeatedly revised after approve** — signal that gate isn't catching right things

### Step 3: Build proposals

For each observed issue, формулируй proposal:

```
Proposal #1: Downgrade V-07 severity

Observation: V-07 (VC coverage alt-flows) triggered 4 times over last
             10 invocations. All 4 — for FMs с flow_type=main scenarios
             without alt branches (simple CRUD operations). False-positive
             rate: 100% в этом проекте.

Current behavior: 🟡 Warning at approve gate for VC
Proposed change: Downgrade to 🔵 Info для scope где alt-flows отсутствуют
                 по design, OR per-rule refinement (expand to distinguish).

Rationale: Current severity creates noise at VC approve gates. Real
           alt-flow gaps ловятся через V-MK-01 (for UI) и manual review.

Impact:
  - Affects all future VC validations
  - Existing VC with V-07 failures: 3 (will recompute severity)
  - No backward compat issues

Suggested actions:
  [Y] Apply — update validation-config.yaml, journal entry
  [N] Reject — keep current, but flag rationale (don't re-surface same proposal)
  [E] Edit — refine the proposal
  [D] Defer — check again after more data
```

### Step 4: Present proposals one-by-one

User reviews each. Per proposal:
- `[Y]` → update `.claude/integrator/validation-config.yaml` (or `.claude/product.yaml` for product-level settings)
- `[N]` → journal entry "considered and rejected, reason: <user input>"; suppress same proposal for 30 days
- `[E]` → ассистент revises based on user feedback, re-present
- `[D]` → journal entry "deferred, revisit in 2 weeks"

### Step 5: Summary

After processing all proposals:
```
Meta-feedback session complete.

Applied: <N> proposals
Rejected: <N>
Deferred: <N>

Config changes summary:
  - V-07: warning → info (см. journal DEC-MF-0042)
  - Stale draft threshold: 14 → 30 days (см. DEC-MF-0043)

Next auto-scan: after 10 more artifacts OR manual /product:meta-feedback
```

## Mode A flow (AI-initiated surfacing)

When assistant observes trigger condition mid-work, it surfaces proposal briefly:

```
[Assistant, mid-work]
... continuing FM-005 enrichment ...

Side note: V-07 has been false-positive 4 times this week. Meta-feedback
proposal queued. Want to review now (/product:meta-feedback) or later?

[Continues current work without waiting]
```

Queued proposals live in `.product/.pending/meta-feedback.yaml` until reviewed.

## Important constraints

- **Human always approves.** Никогда не silent config change.
- **Journal entry mandatory** for accepted changes с rationale.
- **Don't spam proposals.** Don't surface same proposal more than once per 30 days unless user explicitly asks.
- **Confidence required** (C2) — если ассистент uncertain about the pattern, mark confidence: low. Better to defer than push flawed proposal.
- **Scope appropriately.** Product Module meta-feedback affects Product Module config. For Integrator-level concerns (tool confidence downgrades), cross-reference to `/integrator:*` commands.

## Related

- Skill: `.claude/skills/product/meta-feedback.md` — pattern analysis methodology
- Schema: `.claude/integrator/validation-config.yaml` (managed by Integrator)
- Journal: `.product/.decisions/journal.md` or `~/.claude/memory/product/decisions.md`
- Complementary: `/product:patterns` (C4) — artifact-level patterns vs rule-level patterns
