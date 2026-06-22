---
description: AI proposes PROJECT-LOCAL validation tuning (rule severity / config tweaks) based on observed patterns in THIS project. Systemic defects escalate upstream via /ecosystem:meta-feedback. C3 modification.
argument-hint: "[--review-suggestions]"
---

# /product:validation-tune

User invoked: `/product:validation-tune $ARGUMENTS`

C3 modification — **project-local** tuning of validation behavior. Lets ассистент surface
"rule X keeps generating false positives **in this project**, propose downgrade" — human
approves, **local** config updates, journal records rationale.

> **Scope is local by design.** This command tunes the validation layer **for this project
> only** (writes to the project's `.claude/integrator/validation-config.yaml`). It does **not**
> send anything back to the ecosystem repository. When a finding looks like a **systemic**
> defect (the rule/process would misfire in *any* project, not just here), it is escalated
> upstream via **`/ecosystem:meta-feedback`** — see Step 3.5. Renamed from `/product:meta-feedback`
> (DEC-DEV-0090): old name falsely implied upstream delivery.

## Two invocation modes

### Mode A: AI-initiated (automatic surfacing)

During regular work, когда ассистент замечает pattern:
- V-* rule with false-positive rate >50% over last 10 invocations
- `approve_override` used 3+ times for same rule
- User repeated downgrade of same rule

Assistant проактивно surfaces proposal в следующем interaction (not blocking current work).

### Mode B: Human-initiated (this command)

User runs `/product:validation-tune` to explicitly request:
- Review all queued proposals (pending from Mode A)
- Scan for new tuning opportunities
- Explicit ask: "what should we change about validation behavior **in this project**?"

## Process (Mode B — human-initiated)

Load skill `.claude/skills/product/validation-tune.md` for detail.

### Step 1: Gather observation data

Read:
- `.claude/integrator/validation-config.yaml` — current overrides
- Journal entries tagged `#drift-fix`, `#error-fix`, `#rule-override` (last 30 days)
- Artifact frontmatter for `approve_overrides[]` (D2 usage patterns)
- `.product/.pending/validation-pending.yaml` — queued findings
- `.product/.pending/validation-tune.yaml` — queued proposals from Mode A

### Step 2: Analyze patterns

Look for:
- **Rules с high false-positive rate** — surfaced often, accepted rarely
- **Rules user keeps overriding** — signal that default severity is wrong for this project
- **Processes with excessive iteration** — signal that workflow has friction
- **Artifacts repeatedly revised after approve** — signal that gate isn't catching right things

### Step 3: Build proposals

For each observed issue, формулируй proposal:

```
Proposal #1: Downgrade V-07 severity (this project)

Observation: V-07 (VC coverage alt-flows) triggered 4 times over last
             10 invocations. All 4 — for FMs с flow_type=main scenarios
             without alt branches (simple CRUD operations). False-positive
             rate: 100% в этом проекте.

Current behavior: 🟡 Warning at approve gate for VC
Proposed change: Downgrade to 🔵 Info для scope где alt-flows отсутствуют
                 по design (project-local override).

Rationale: Current severity creates noise at VC approve gates IN THIS PROJECT.
           SEG-001 workflows are linear by design.

Classification: PROJECT-LOCAL (noise stems from this project's design, not a
                rule defect) → tune locally, do NOT escalate.

Impact:
  - Affects all future VC validations IN THIS PROJECT
  - Existing VC with V-07 failures: 3 (will recompute severity)

Suggested actions:
  [Y] Apply — update validation-config.yaml, journal entry
  [N] Reject — keep current, but flag rationale (don't re-surface same proposal)
  [E] Edit — refine the proposal
  [D] Defer — check again after more data
```

### Step 3.5: Classify project-local vs systemic (the bridge)

Before presenting, apply the **oracle question** to each proposal:

> «Если бы этот же артефакт лежал в **другом** проекте — правило сработало бы так же ложно?»

- **No → PROJECT-LOCAL.** Noise stems from this project's design/specifics. Tune locally
  (Step 4). Stays in this project.
- **Yes → SYSTEMIC.** The rule/process is defective regardless of project (e.g. rule
  references a non-existent field, logic bug, always-redundant step). This is **upstream**
  material — surface to the user and **escalate via `/ecosystem:meta-feedback`** (records it
  in the upstream outbox for the ecosystem repo). Optionally apply a temporary local override
  until the upstream fix lands.

Don't silently localize a systemic defect — that hides a real ecosystem bug behind a per-project patch.

### Step 4: Present proposals one-by-one

User reviews each. Per proposal:
- `[Y]` → update `.claude/integrator/validation-config.yaml` (or `.claude/product.yaml` for product-level settings)
- `[N]` → journal entry "considered and rejected, reason: <user input>"; suppress same proposal for 30 days
- `[E]` → ассистент revises based on user feedback, re-present
- `[D]` → journal entry "deferred, revisit in 2 weeks"

### Step 5: Summary

After processing all proposals:
```
Validation-tune session complete.

Applied: <N> proposals (project-local)
Escalated upstream: <N> (via /ecosystem:meta-feedback)
Rejected: <N>
Deferred: <N>

Config changes summary:
  - V-07: warning → info (см. journal DEC-TUNE-0042)
  - Stale draft threshold: 14 → 30 days (см. DEC-TUNE-0043)

Next auto-scan: after 10 more artifacts OR manual /product:validation-tune
```

## Mode A flow (AI-initiated surfacing)

When assistant observes trigger condition mid-work, it surfaces proposal briefly:

```
[Assistant, mid-work]
... continuing FM-005 enrichment ...

Side note: V-07 has been false-positive 4 times this week. Validation-tune
proposal queued. Want to review now (/product:validation-tune) or later?

[Continues current work without waiting]
```

Queued proposals live in `.product/.pending/validation-tune.yaml` until reviewed.

## Important constraints

- **Human always approves.** Никогда не silent config change.
- **Journal entry mandatory** for accepted changes с rationale (`DEC-TUNE-*`).
- **Don't spam proposals.** Don't surface same proposal more than once per 30 days unless user explicitly asks.
- **Confidence required** (C2) — если ассистент uncertain about the pattern, mark confidence: low. Better to defer than push flawed proposal.
- **Scope is local.** This command changes **only** this project's config. Systemic defects go
  upstream via `/ecosystem:meta-feedback` — never patch a real ecosystem bug as a per-project override.

## Related

- Skill: `.claude/skills/product/validation-tune.md` — pattern analysis methodology
- Upstream sibling: `/ecosystem:meta-feedback` — escalate systemic defects to the ecosystem repo
- Schema: `.claude/integrator/validation-config.yaml` (managed by Integrator)
- Journal: `.product/.decisions/journal.md` or `~/.claude/memory/product/decisions.md`
- Complementary: `/product:patterns` (C4) — artifact-level patterns vs rule-level patterns
