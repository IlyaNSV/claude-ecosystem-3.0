---
description: Convert NOTE-* unstructured note to structured artifact (FM/SC/BR/IC/NFR/HYP). D3 modification.
argument-hint: "<NOTE-id> to <TYPE>   (e.g., /product:promote-note NOTE-007 to FM)"
---

# /product:promote-note

User invoked: `/product:promote-note $ARGUMENTS`

D3 modification — когда NOTE-* «созрела» из idea-capture в полноценный structured artifact, convert it через this command.

## Supported target types (v1)

- **FM** (Feature Map Entry)
- **SC** (User Scenario)
- **BR** (Business Rule)
- **IC** (Invariant Check)
- **NFR** (Non-Functional Requirement)
- **HYP** (Hypothesis)

Other types (PS, MR, CA, SEG, VP, MVP, RM, RL, LC, VC, RPM, MK, DS, NM, BG) — **not supported** for direct promotion. Use their own commands:
- Product strategy artifacts (PS/MR/CA/SEG/VP/HYP/MVP/RM/RL) — через `/product:init` or `/product:plan`
- Behavioral derivations (LC/VC/RPM) — auto-derived via `/product:feature`
- Design artifacts (MK/DS/NM) — через `/design:start`
- BG — auto-populated via extraction

## Process

Load skill `.claude/skills/product/note-promote.md` for methodology detail.

### Step 1: Parse arguments

Expected: `<NOTE-id> to <TYPE>` where NOTE-id is e.g., `NOTE-007` and TYPE is one of supported list.

Validate:
- NOTE-id exists в `.product/notes/`
- NOTE.status != `promoted` (already converted)
- NOTE.status != `archived` (no reason to promote archived)
- TYPE is supported

If validation fails — show error + suggest correct usage.

### Step 2: Read source NOTE

Parse `.product/notes/<NOTE-id>-*.md`:
- title, content, related, tags, confidence

Extract key information for target type:
- **For FM:** title → FM title; content → Why + What (brief); related → hypothesis/segment hints
- **For SC:** title → SC title; content → Steps (as-is); related → FM link
- **For BR:** title → BR title; content → Statement + Rationale; tags → category hint
- **For IC:** title → IC title; content → Invariant statement + Severity rationale
- **For NFR:** title → NFR title; content → Statement + Rationale + Measurement
- **For HYP:** title → HYP title; content → Statement + Thresholds hints

### Step 3: Draft target artifact

Generate draft с:
- New ID (next in sequence для type)
- Fields populated from NOTE
- Missing fields marked `TBD — filled in dialogue`
- Frontmatter per target type's schema
- `confidence: medium` default (было mostly low в NOTE, но moving to structured is validation step)
- `confidence_notes: "Promoted from NOTE-<id>. Content needs review for target type completeness."`

Example flow — NOTE → FM:

```
NOTE-007:
  title: "Возможность интеграции с Trados Studio"
  content: "...Trados has open API, TM → revisions context, USP..."
  tags: [idea, future-feature]
  related: [SEG-001, FM-003]

Generated draft:
  id: FM-<next>
  title: "Trados Studio integration"
  status: planned
  priority: should  # inferred from 'future-feature' tag
  segment: SEG-001  # from related
  # TBD fields:
  jtbd: [TBD — which JTBD does this solve?]
  hypotheses: [TBD — which HYP this validates?]
  has_ui: TBD
  success_metric: "TBD"

  Body:
  ## Why
  [from NOTE content]

  ## What (brief)
  [from NOTE content]

  ## Priority rationale
  TBD — why SHOULD, not MUST or COULD?

  ## Success metric
  TBD
```

### Step 4: Present draft to user

```
Promoting NOTE-007 → FM-012 (draft).

Draft summary:
  Title: Trados Studio integration
  Priority: should (inferred from tags)
  Segment: SEG-001 (from related)

  Fields needing input:
  - jtbd: which JTBD(s) does this solve?
  - hypotheses: which HYP this validates?
  - has_ui: yes/no?
  - success_metric: how to measure?
  - Priority rationale

Approve draft and continue to fill TBD fields via /product:feature?
  [Y] Create FM-012 draft + mark NOTE-007 as promoted + open /product:feature flow
  [E] Edit draft first (show for review)
  [N] Cancel
```

### Step 5: On approve

1. Write new artifact to appropriate path (e.g., `.product/features/FM-012-trados-integration.md`)
2. Update NOTE-007 frontmatter:
   ```yaml
   status: promoted
   promoted_to: FM-012
   promoted_at: <timestamp>
   ```
3. Journal entry:
   ```
   DEC-PROMOTE-<NNN> — Promoted NOTE-007 → FM-012
   Date: <timestamp>
   Source: NOTE-007 (Trados integration idea, captured 2026-03-15)
   Target: FM-012 (planned status)
   Next: /product:feature FM-012 для enrichment
   ```
4. Return user prompt: «NOTE-007 promoted to FM-012. Open `/product:feature FM-012` to enrich?»

### Step 6: Preserve NOTE for history

NOTE-007 stays in `.product/notes/` с `status: promoted`. Это audit trail — useful для:
- Understanding how ideas evolved
- Rollback if promotion was premature
- Pattern learning (where ideas originated)

## Important constraints

- **Draft only.** Promotion doesn't auto-activate artifact. Target goes to `status: planned` (FM) or `draft` (others). Further work needed through appropriate command.
- **TBD fields explicit.** Don't fabricate jtbd / hypotheses / priority — mark TBD и flag for user enrichment.
- **Journal mandatory.** Promotion is a semantic operation, always recorded.
- **NOTE preservation.** Promoted NOTE не удаляется — history matters.
- **Atomicity.** Either both writes succeed (NOTE update + new artifact) or neither (rollback).

## Related

- NOTE artifact spec: `.claude/docs/pmo/artifacts/NOTE.md`
- Target artifact specs: respective `<TYPE>.md` in `artifacts/`
- Skill: `.claude/skills/product/note-promote.md`
- Companion: `.claude/skills/product/note-capture.md` — quick idea capture flow
