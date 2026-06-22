---
description: C3 modification — pattern analysis for project-local validation tuning. Proposes rule overrides / config tweaks based on observed usage IN THIS PROJECT. Systemic defects escalate via /ecosystem:meta-feedback.
---

# Validation-Tune — C3 Skill

Methodology for `/product:validation-tune` command and AI-initiated surfacing (Mode A).

> Renamed from `meta-feedback` (DEC-DEV-0090). Scope is **project-local**: this tunes the
> validation layer for THIS project only. Findings that are **systemic** (rule/process
> defective regardless of project) escalate upstream via `/ecosystem:meta-feedback`.

## Core idea

Ассистент видит patterns в usage that would inform a **project-local** config change, но
самостоятельно не меняет config. Скill surfaces proposal, human approves.

**Trust asymmetry:** AI surface issues but не decide. Human retains decision authority с rationale в journal.

## When AI should initiate (Mode A triggers)

Assistant should proactively surface a tuning proposal **когда observed pattern crosses threshold**:

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
- Journal entries tagged `#rule-override`, `#drift-fix`, `#error-fix`, `#validation-tune` (last 30 days)
- Artifact frontmatter — scan for `approve_overrides[]` usage
- `.product/.pending/validation-pending.yaml` — queued findings showing rule behavior
- `.product/.pending/validation-tune.yaml` — queued proposals from Mode A
- Session logs (если available) — iteration counts per step

### Step 2: Analyze patterns

Per trigger category above, check thresholds.

Also look for:
- **Rule-level:** which rules generate most noise?
- **Process-level:** which gates cause most friction?
- **Artifact-level:** which types revise most after approve?
- **Config-level:** which settings user touches repeatedly?

### Step 3: Classify — project-local vs systemic (the bridge to upstream)

For each candidate, apply the **oracle question**:

> «Если бы этот же артефакт лежал в **другом** проекте — правило сработало бы так же ложно?»

| Answer | Class | Action |
|---|---|---|
| **No** — noise from this project's design/specifics | PROJECT-LOCAL | tune locally (this skill, Step 4+) |
| **Yes** — rule/process defective regardless of project | SYSTEMIC | escalate via `/ecosystem:meta-feedback` (upstream outbox) + optional temporary local override |

Examples:
- V-07 noisy because **this** project's flows are linear by design → PROJECT-LOCAL.
- A rule that references a non-existent artifact field, a logic bug producing false positives
  on valid input, an always-redundant gate step → SYSTEMIC (the ecosystem rule is wrong).

**Never silently localize a systemic defect** — that hides a real ecosystem bug behind a
per-project patch. Surface it as systemic and route to the upstream contour.

### Step 4: Formulate proposal

Each proposal needs:

```
Proposal: <one-line summary>

Observation: <what I saw, with numbers>
Classification: <PROJECT-LOCAL | SYSTEMIC + why>
Impact: <affects what going forward>
Rationale: <why this change makes sense>

Current behavior: <what happens now>
Proposed change: <what would happen>
Risk of change: <what could go wrong если approved>

Evidence:
- <specific instance 1>: <date>, <journal ref>, <outcome>
- <specific instance 2>: ...

Confidence: <high | medium | low>
Confidence notes: <evidence strength, sample size>
```

### Step 5: Avoid noise

**Don't surface если:**
- Same proposal rejected within last 30 days (respect prior decision)
- Sample size <5 (too early — let pattern develop)
- Confidence: low (your own assessment) + low potential impact
- Similar proposal already pending — batch them into one review session instead

### Step 6: Queue or present

- **Mode A (auto-initiated):** Queue в `.product/.pending/validation-tune.yaml`, surface brief note в next interaction:
  ```
  [Side note] Validation-tune proposal queued: "<one-line summary>". Review now (/product:validation-tune) или later?
  ```
- **Mode B (human-initiated via /product:validation-tune):** Process queue + run fresh analysis, present each proposal для decision

### Step 7: Handle decision

Per proposal decision:

**`[Y]` Approve (project-local):**
1. Update relevant config file с proposed change
2. Journal entry:
   ```
   DEC-TUNE-<NNN> — <change applied>
   Date: <timestamp>
   Observation: <brief>
   Classification: PROJECT-LOCAL
   Rationale: <user-provided или ИИ's reasoning>
   Reversible: via /product:config --reset <key>
   ```
3. Confirm to user

**`[Y]` Approve (systemic → escalate):**
1. Optionally apply a temporary local override (note it as temporary)
2. Invoke `/ecosystem:meta-feedback` to record the finding in the upstream outbox
3. Journal entry `DEC-TUNE-<NNN>` with `Classification: SYSTEMIC → escalated (UF-<NNN>)`

**`[N]` Reject:**
1. Journal entry `DEC-TUNE-<NNN> — <proposal> rejected`, reason, suppression 30 days
2. Add to suppressed list

**`[E]` Edit:** ask what to change, revise, re-present.

**`[D]` Defer:** journal entry with revisit date (+14 days).

## Anti-patterns

1. **Proposal inflation.** Don't surface every minor friction — only когда threshold actually crossed.
2. **Self-interest bias.** ИИ might propose removing rules that block it. Human review catches this.
3. **Unilateral change.** Never modify config без approve. Journal entries without human signature = no.
4. **Localizing a systemic bug.** If the rule is defective regardless of project — escalate upstream, don't bury it as a per-project override.
5. **Deaf to rejection.** If same proposal rejected 2x, don't keep surfacing. Respect decision.

## Integration

- Invoked by `/product:validation-tune` (primarily)
- Can be surfaced by any skill detecting trigger conditions (Mode A auto-initiation)
- Produces entries in `.product/.pending/validation-tune.yaml` (queue) и `.product/.decisions/journal.md` (record)
- Writes to `.claude/integrator/validation-config.yaml` (tier + rule overrides) или `.claude/product.yaml` (product-module config) per accepted PROJECT-LOCAL proposals
- Routes SYSTEMIC findings to `/ecosystem:meta-feedback` (upstream outbox)

## Related

- Command: `/product:validation-tune`
- Upstream sibling: `/ecosystem:meta-feedback` + `skills/ecosystem/meta-feedback.md`
- Schema: `.claude/integrator/validation-config.yaml` per `docs/integrator-module/SPEC.md`
- Complementary: `/product:patterns` (C4 — artifact patterns) vs this (rule/config patterns)
