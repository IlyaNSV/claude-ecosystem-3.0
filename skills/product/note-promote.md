---
description: D3 modification — convert NOTE-* unstructured note to structured artifact (FM/SC/BR/IC/NFR/HYP). Used by /product:promote-note command.
---

# Note Promote — D3 Skill

Convert NOTE-* в полноценный structured артефакт когда idea созрела.

**Companion to** [note-capture.md](note-capture.md) (capture flow). This skill — promotion flow.

## When invoked

Through `/product:promote-note <NOTE-id> to <TYPE>` command, OR explicitly от user во время session: «давай продвинем NOTE-007 в FM».

## Supported target types (v1)

- **FM** (Feature Map Entry)
- **SC** (User Scenario)
- **BR** (Business Rule)
- **IC** (Invariant Check)
- **NFR** (Non-Functional Requirement)
- **HYP** (Hypothesis)

Other types (PS, MR, CA, SEG, VP, MVP, RM, RL, LC, VC, RPM, MK, DS, NM, BG) — НЕ supported для direct promotion (см. command file для rationale).

## Process

### Step 1: Validate input

- NOTE-id exists в `.product/notes/`
- NOTE.status ∈ {draft, active} (not promoted/archived)
- Target TYPE supported

If validation fails — show clear error, suggest correct usage.

### Step 2: Read source NOTE

Parse `.product/notes/NOTE-<NNN>-*.md`:
- title, content, related, tags, confidence

Map to target type fields per Step 3.

### Step 3: Generate target artifact draft

Use **explicit frontmatter template** per target type. **Canonical field names обязательны** — не варьировать (lesson DEC-DEV-0011: AI tendency rename fields для естественности приводит к drift).

#### Target = FM

```yaml
---
id: FM-<next>
type: feature-map-entry
title: "<derived from NOTE.title>"
status: planned                           # FM lifecycle: draft не используется; planned = skeleton
priority: should                          # default; user adjusts
segment: <SEG-XXX from NOTE.related если есть, иначе TBD>
jtbd: []                                  # TBD — какие JTBD из SEG
hypotheses: []                            # TBD — какие HYP проверяет
value_proposition: <VP-XXX from NOTE.related или TBD>
release: TBD                              # которая RL
has_ui: false                             # default; user adjusts
scenarios: []                             # пустой для skeleton
rules: []
lifecycles: []
verification: []
invariants: []
mockups: []
success_metric: "TBD — measurable outcome of feature"

nfr_status: pending                       # F.5a deferred Phase 4
nfr: []
requires_nfr: false

confidence: medium                        # promoted from NOTE — структуризация = step toward validation
confidence_notes: "Promoted from <NOTE-id> on <date>. TBD fields require enrichment via /product:feature."
created: <today>
updated: <today>
version: 1
---
```

**Anti-pattern warnings (НЕ использовать):**
- ❌ `confidence_rationale` — caused PS drift (DEC-DEV-0011); canonical = `confidence_notes`
- ❌ `rationale`, `reasoning` — same
- ❌ skip frontmatter assuming spec covers — explicit template обязателен

Body skeleton:
```markdown
# Feature Map: <title>

## Why
<NOTE.content excerpt — what problem this addresses>

[TBD: which JTBD does this solve? which HYP validates?]

## What (brief)
<NOTE.content excerpt — high-level description>

[TBD: 2-3 sentences про что фича делает, без implementation details]

## Priority rationale
[TBD: why this priority? Linked to MVP scope?]

## Success metric
[TBD: measurable outcome — e.g., "75% activation rate within 30 days"]

## Promoted from
- **Source:** [NOTE-<id>](../notes/NOTE-<id>-<slug>.md)
- **Promoted at:** <date>
- **Original confidence:** <NOTE.confidence>
```

#### Target = SC

```yaml
---
id: SC-<next>
type: scenario
title: "<derived>"
feature: TBD                              # required — must link to FM
flow_type: main                           # default; user adjusts
actors: []                                # TBD — must populate from RPM
preconditions: "TBD"
rules: []
lifecycle: TBD
mockup: null                              # if has_ui
verification: []
status: draft
confidence: medium
confidence_notes: "Promoted from <NOTE-id>. Steps require validation против actor model."
created: <today>
updated: <today>
version: 1
---
```

#### Target = BR

```yaml
---
id: BR-<next>
type: business-rule
title: "<derived>"
category: workflow                        # default; user picks: validation | calculation | authorization | workflow | constraint | state-transition
status: draft
scenarios: []                             # TBD — bi-dir с SC
invariants: []
lifecycles: []
parameters: {}
owner_feature: TBD
confidence: medium
confidence_notes: "Promoted from <NOTE-id>. Statement formalization may need refinement."
created: <today>
updated: <today>
version: 1
---
```

#### Target = IC

```yaml
---
id: IC-<next>
type: invariant-check
title: "<derived>"
severity: medium                          # default; user picks: critical | high | medium
entity: TBD                               # required — entity from BG
rules: []                                 # TBD — supporting BRs
lifecycles: []
status: draft
testable_as: integration                  # default; user picks
confidence: medium
confidence_notes: "Promoted from <NOTE-id>. Severity classification requires DA review (P-RULE-01)."
created: <today>
updated: <today>
version: 1
---
```

#### Target = NFR

```yaml
---
id: NFR-<next>
type: non-functional-requirement
title: "<derived>"
category: TBD                             # required — performance | reliability | scalability | security | privacy | accessibility | compatibility | usability | observability
target_value: "TBD — measurable + tier-aware"
target_tier: mvp                          # default; user adjusts
measurement_method: "TBD"
scope: per_feature                        # default; can be global
related_features: []
status: draft
sanity_check: passed                      # auto-validated against §5 ranges
confidence: medium
confidence_notes: "Promoted from <NOTE-id>. Sanity-check pending against tier ranges."
created: <today>
updated: <today>
version: 1
---
```

#### Target = HYP

```yaml
---
id: HYP-<next>
type: hypothesis
title: "<derived>"
status: draft                             # later → testing после G5
segment: TBD                              # required
value_proposition: TBD
features: []
validation_metric: "TBD — what we measure"
target_value: "TBD — success threshold"
invalidation_threshold: "TBD"
testing_period: "TBD"
testing_started: null
priority: exploratory                     # default; user picks: critical | important | exploratory
confidence: medium
confidence_notes: "Promoted from <NOTE-id>. H.A.R.M.E.D. fields require completion."
created: <today>
updated: <today>
version: 1
---
```

### Step 4: Present draft to user

```
Promoting <NOTE-id> → <NEW-ID> (draft).

Generated draft:
  [show frontmatter + body skeleton]

TBD fields requiring input:
  - <field>: <prompt>
  - ...

Approve draft and continue to fill TBD fields?
  [Y] Create <NEW-ID> draft + mark NOTE as promoted + open enrichment flow
  [E] Edit draft first (interactive)
  [N] Cancel
```

### Step 5: On approve

1. **Write new artifact** to appropriate path:
   - `.product/features/FM-<NNN>-<slug>.md` (slug per artifacts/README.md ASCII rule)
   - `.product/scenarios/SC-<NNN>-<slug>.md`
   - etc.
2. **Update NOTE-<id>** frontmatter:
   ```yaml
   status: promoted
   promoted_to: <NEW-ID>
   promoted_at: <ISO timestamp>
   ```
3. **Decision journal entry** (mandatory — D3 promotion is semantic operation):
   ```
   DEC-PROMOTE-<NNN> — Promoted <NOTE-id> → <NEW-ID>
   Date: <timestamp>
   Source: <NOTE-id> (<NOTE.title>, captured <NOTE.created>)
   Target: <NEW-ID> (<status>)
   TBD fields: <count>
   Next: enrichment via <appropriate command>
   ```
4. **Suggest next command:**
   - FM created → `/product:feature <FM-id>` для enrichment
   - SC/BR/IC/NFR/HYP created → typically обогащаются через `/product:feature <FM-id>` (parent FM)
5. **Atomicity:** either both writes succeed (NOTE update + new artifact) OR neither (rollback). Use git stash для recovery если file write fails.

### Step 6: NOTE preservation

**NOTE-<id> остаётся в `.product/notes/`** с status=promoted. История важна для:
- Audit trail (откуда идея пришла)
- Rollback если promotion premature (можно re-promote с corrections)
- Pattern learning across projects (где idea originated)

`/product:cleanup --dry-run` (V-15) **не trims** promoted NOTE-* — это part of audit trail.

## Anti-patterns

1. **Auto-populate TBD fields with guesses.** Если не знаешь jtbd / hypotheses / segment — оставить TBD, не fabricate. User filled через enrichment flow.
2. **Promote without target type validation.** Always Step 1 — NOTE must exist + supported type.
3. **Skip decision journal.** Promotion = semantic operation, всегда recorded.
4. **Lose original confidence.** Map NOTE.confidence → new artifact.confidence (usually medium, not high — promotion is structuring step, not validation).
5. **Bypass canonical frontmatter.** Use explicit template, не «по spec'у». PS drift (DEC-DEV-0011) lesson: AI rename fields если template not enforced.
6. **Touch NOTE.body content.** Promotion copies content into new artifact body, but original NOTE body stays intact (audit trail).

## Examples

### Example: NOTE → FM

**Source NOTE:**
```yaml
---
id: NOTE-007
title: "Возможность интеграции с Trados Studio"
tags: [idea, future-feature]
related: [SEG-001, FM-003]
confidence: low
---

## Содержание
Trados имеет open API. TM → revisions context. Возможный USP «work alongside, not replace».
```

**Generated FM-012 draft:**
```yaml
---
id: FM-012
type: feature-map-entry
title: "Trados Studio integration"
status: planned
priority: should
segment: SEG-001                          # extracted from NOTE.related
jtbd: []                                  # TBD
hypotheses: []                            # TBD
value_proposition: TBD                    # not in NOTE.related
release: TBD
has_ui: false                             # default; Trados integration likely backend
...
confidence: medium
confidence_notes: "Promoted from NOTE-007 on 2026-04-20. TBD fields require enrichment via /product:feature."
---

# Feature Map: Trados Studio integration

## Why
Trados имеет open API. TM → revisions context. Возможный USP «work alongside, not replace».

[TBD: which JTBD does this solve? which HYP validates?]

...

## Promoted from
- Source: NOTE-007
- Promoted at: 2026-04-20T15:30
- Original confidence: low
```

**NOTE update:**
```yaml
---
id: NOTE-007
status: promoted
promoted_to: FM-012
promoted_at: 2026-04-20T15:30
---
```

**Suggest:** `/product:feature FM-012` для enrichment.

## Related

- [`note-capture.md`](note-capture.md) — capture flow (companion)
- [`commands/product/promote-note.md`](../../commands/product/promote-note.md) — invoking command
- [`docs/pmo/artifacts/NOTE.md`](../../docs/pmo/artifacts/NOTE.md) — NOTE artifact spec
- Target type specs in `docs/pmo/artifacts/<TYPE>.md`
