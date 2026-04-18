---
description: C3 modification — pattern analysis for AI-initiated ecosystem improvements. Proposes rule overrides, config tweaks based on observed usage.
---

# Meta-Feedback — C3 Skill

Methodology for `/product:meta-feedback` command and AI-initiated surfacing (Mode A).

## Core idea

Ассистент видит patterns в usage that would inform ecosystem improvement, но самостоятельно не меняет config. Скill surfaces proposal, human approves.

**Trust asymmetry:** AI surface issues but не decide. Human retains decision authority с rationale в journal.

## When AI should initiate (Mode A triggers)

Assistant should proactively surface meta-feedback **когда observed pattern crosses threshold**:

### Trigger 1: High false-positive rate rule

- V-* rule triggered >= 4 times over last 10 invocations
- User accepted (didn't override) < 30% of those triggers
- → Propose severity downgrade

### Trigger 2: Repeated override same rule

- Same rule appears in `approve_overrides[]` in 3+ artifacts
- → Propose config-level override (instead of repeated per-artifact)

### Trigger 3: Repeated user downgrades

- User manually ran `/product:config --edit` downgrading rule 2+ times
- → Propose codifying as default или further refinement

### Trigger 4: Workflow friction signal

- Same step of process iterated >5 times consistently across sessions
- → Propose simplification or gate change

### Trigger 5: Artifact revision after approve

- Artifact moved draft → active, then back to draft within 24h (revision pattern)
- Happens 3+ times for same artifact type (say, SC)
- → Propose that approval gate is missing something systematic

## Analysis process

### Step 1: Gather signals

Read:
- `.claude/integrator/validation-config.yaml` — current overrides
- Journal entries tagged `#rule-override`, `#drift-fix`, `#error-fix`, `#meta-feedback` (last 30 days)
- Artifact frontmatter — scan for `approve_overrides[]` usage
- `.product/.pending/validation-pending.yaml` — queued findings showing rule behavior
- Session logs (если available) — iteration counts per step

### Step 2: Analyze patterns

Per trigger category above, check thresholds.

Also look for:
- **Rule-level:** which rules generate most noise?
- **Process-level:** which gates cause most friction?
- **Artifact-level:** which types revise most after approve?
- **Config-level:** which settings user touches repeatedly?

### Step 3: Formulate proposal

Each proposal needs:

```
Proposal: <one-line summary>

Observation: <what I saw, with numbers>
Impact: <affects what going forward>
Rationale: <why this change makes sense>

Current behavior: <what happens now>
Proposed change: <what would happen>
Risk of change: <what could go wrong если approved>

Evidence:
- <specific instance 1>: <date>, <journal ref>, <outcome>
- <specific instance 2>: ...
- ...

Confidence: <high | medium | low>
Confidence notes: <evidence strength, sample size>
```

### Step 4: Avoid noise

**Don't surface если:**
- Same proposal rejected within last 30 days (respect prior decision)
- Sample size <5 (too early — let pattern develop)
- Confidence: low (your own assessment) + low potential impact
- Similar proposal already pending — batch them into one review session instead

### Step 5: Queue or present

- **Mode A (auto-initiated):** Queue в `.product/.pending/meta-feedback.yaml`, surface brief note в next interaction:
  ```
  [Side note] Meta-feedback proposal queued: "<one-line summary>". Review now (/product:meta-feedback) или later?
  ```
- **Mode B (human-initiated via /product:meta-feedback):** Process queue + run fresh analysis, present each proposal для decision

### Step 6: Handle decision

Per proposal decision:

**`[Y]` Approve:**
1. Update relevant config file с proposed change
2. Journal entry:
   ```
   DEC-META-<NNN> — <change applied>
   Date: <timestamp>
   Observation: <brief>
   Rationale: <user-provided или ИИ's reasoning>
   Proposal details: <reference to proposal>
   Reversible: via /product:config --reset <key>
   ```
3. Confirm to user

**`[N]` Reject:**
1. Journal entry:
   ```
   DEC-META-<NNN> — <proposal> rejected
   Date: <timestamp>
   Reason: <user-provided>
   Suppression: 30 days (won't re-surface identical proposal)
   ```
2. Add to suppressed list

**`[E]` Edit:**
1. Ask user: "What would you change в proposal?"
2. Revise
3. Re-present

**`[D]` Defer:**
1. Journal entry:
   ```
   DEC-META-<NNN> — <proposal> deferred
   Date: <timestamp>
   Revisit: <user-specified date или +14 days>
   ```

## Proposal quality standards

**Good proposal (example):**

```
Proposal: Downgrade V-07 (VC coverage alt-flows) от Warning → Info

Observation: V-07 triggered 4 times over last 10 invocations this week.
  - FM-003 VC: main flow only, no alt (user confirmed intentional) — override
  - FM-005 VC: same pattern — override
  - FM-007 VC: same — override
  - FM-008 VC: same — override
  
Impact: Would affect all future VC validation in this project.
Rationale: Current severity создаёт noise at VC approve gates. Real alt-flow
  gaps caught through V-MK-01 для UI (more reliable) and manual review.
  This project's FMs typically have simple main flows without alt branches
  (by design — SEG-001 workflows are linear).

Current behavior: 🟡 Warning at approve gate, user overrides each time.
Proposed change: Downgrade to 🔵 Info (surfaces in /product:validate but not approve gate).
Risk of change: If future FM truly has complex alt flows, issue won't be caught
  at gate. Mitigation: V-07 still runs; findings visible in on-demand validate.

Evidence: see journal entries DEC-OVERRIDE-0034, 0037, 0039, 0042.

Confidence: medium-high
Confidence notes: 4 consistent instances, clear pattern. Sample might не generalize
  if project expands to multi-flow features.

Actions:
  [Y] Apply (update validation-config.yaml, journal entry)
  [N] Reject (keep current, journal reason)
  [E] Edit proposal
  [D] Defer (14 days)
```

**Bad proposal:**

```
Proposal: V-07 is annoying, remove it.  ❌ no observation, no rationale, no evidence
```

## Anti-patterns

1. **Proposal inflation.** Don't surface every minor friction — only когда threshold actually crossed.
2. **Self-interest bias.** ИИ might propose removing rules that block it. Human review catches this.
3. **Unilateral change.** Never modify config без approve. Journal entries without human signature = no.
4. **Scope creep.** Meta-feedback is about product module config. For cross-module changes (e.g., Integrator confidence), cross-reference appropriately; don't try to fix everything in one proposal.
5. **Deaf to rejection.** If same proposal rejected 2x, don't keep surfacing. Respect decision.

## Integration

- Invoked by `/product:meta-feedback` (primarily)
- Can be surfaced by any skill detecting trigger conditions (Mode A auto-initiation)
- Produces entries in `.product/.pending/meta-feedback.yaml` (queue) и `.product/.decisions/journal.md` (record)
- Writes to `.claude/integrator/validation-config.yaml` (tier + rule overrides) или `.claude/product.yaml` (product-module config) per accepted proposals

## Related

- Command: `/product:meta-feedback`
- Journal: decisions recorded here for auditability
- Schema: `.claude/integrator/validation-config.yaml` per `docs/integrator-module/SPEC.md`
- Complementary: `/product:patterns` (C4 — artifact patterns) vs this (rule/config patterns)
