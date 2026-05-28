---
description: D.5 DS extraction algorithm. Token / component / pattern detection from new MK; synonym checking; deprecation tracking; mass-rename workflow (v1.0 manual; atomic — v1.1+).
---

> **User-facing output language:** Russian. Identifiers / file paths / commands / tokens — verbatim.

# Design System Rules — Skill

Used by `design-session.md` D.5 step (after MK draft written). Extracts new DS entries from MK content + maintains DS coherence.

## Activation context

Skill loaded after MK draft persisted к `.product/mockups/MK-<NNN>-*.md` (status: draft per A6). Input from orchestrator:
- `<MK-id>`
- Existing DS state (`.product/design-system.md` если exists, иначе bootstrap minimal)

## DS structure invariants

Per `docs/pmo/artifacts/DS.md`:
- Singleton (`.product/design-system.md`)
- 4 mandatory sections: Design Tokens, Component Library Index, Pattern Library, Usage Rules
- Optional: Theme variants, Brand guidelines references, Deprecated tokens
- Token format: `DS.<category>.<name>` (e.g., `DS.color.primary`, `DS.spacing.md`)

## Algorithm

### Step 1 — Bootstrap DS if absent

Если `.product/design-system.md` не exists — create skeleton:

```yaml
---
id: DS
type: design-system
title: "Product Design System"
design_tool: <from .claude/design.yaml.default_design_tool>
status: active
token_count: 0
component_count: 0
pattern_count: 0
last_extraction_at: <ISO>
confidence: high
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
version: 1
---

# Product Design System

> Cross-cutting visual language. Auto-populated by Design Module from MK artifacts.

## 1. Design Tokens

### Colors
<empty — populated по extraction>

### Typography
<empty>

### Spacing
<empty>

### Border & Radius
<empty>

### Shadows
<empty>

## 2. Component Library Index

<empty — populated по extraction>

## 3. Pattern Library

<empty>

## 4. Usage Rules

- Always use DS tokens. Hardcoded colors/sizes → hook warning.
- New token proposals go through DS review (`/design:system --review`).
- Deprecated tokens show warnings; provide migration path.
- Components должны use только DS tokens.
- Patterns — recommendations, not strict; breaking pattern → log в MK Design Decisions.
```

### Step 2 — Extract tokens from new MK

Read MK body. For each Component State Matrix row, extract:

- **Colors:** all `DS.color.*` references (already-DS tokens) + bare hex values `#[0-9a-fA-F]{3,8}` (potential new tokens)
- **Typography:** `DS.font.*` / `DS.typography.*` references + bare font-family / size patterns
- **Spacing:** `DS.spacing.*` references + bare px/rem values
- **Border:** `DS.border.*` / `DS.radius.*` references + bare values
- **Shadows:** `DS.shadow.*` references + bare CSS shadow values

**For each bare value (potential new token):**

1. Compute proposed token name based on usage context:
   - Color usage = «primary action» → `DS.color.primary-action` (или existing `DS.color.primary` если synonym detected)
   - Spacing usage = «card padding inner» → `DS.spacing.card-inner-md` (или existing `DS.spacing.md` если match)
2. Check synonyms:
   - Compute similarity к existing tokens (exact match → reuse; similar hex like `#3B82F6` vs `#3B83F8` → propose merge)
3. Determine action:
   - **Exact match existing:** silently reuse; bump usage count
   - **Synonym detected (high confidence):** propose merge to user
   - **New unique value:** propose new token entry

### Step 3 — Propose DS additions to user (batch)

After full MK scan:

```
DS proposals from MK-NNN:

NEW TOKENS:
  DS.color.<proposed-name>      value: <hex>     usage: «<context excerpt>»
  DS.spacing.<proposed-name>    value: <px>      usage: «<context>»
  ...

SYNONYMS DETECTED (existing tokens look close):
  Proposed «DS.color.brand-blue» (#3B83F8) ~~ existing «DS.color.primary» (#3B82F6) [Δ=2 hex digits]
    Options: [1] use existing primary | [2] add as new brand-blue | [3] propose mass-rename primary → brand-blue (🟠 Strategic; см. Step 5)

NEW COMPONENTS:
  ButtonPrimary (variants: default, hover, focus, disabled, loading)
    First in: MK-NNN
    Tokens used: DS.color.primary, DS.color.primary-hover, DS.typography.button, DS.spacing.md, DS.radius.md
  RevisionCard (variants: default, hover, selected, archived)
    ...

NEW PATTERNS:
  «Form with inline validation»
    Components: TextInput (with error), FormLabel, HelperText, SubmitButton
    Used in: MK-NNN

Options:
  [1] Accept all — write к DS + .product/.pending/ds-pending.yaml zero
  [2] Per-item review — walk through, individual accept/reject (interactive)
  [3] Queue к pending — drop all proposals into .product/.pending/ds-pending.yaml; process later через /design:system --review

Silence ≠ continue.
```

### Step 4 — Write DS updates

Per accepted proposals (Step 3):

1. Update DS frontmatter counters (`token_count`, `component_count`, `pattern_count`, `last_extraction_at`)
2. Append к respective section tables / lists
3. For accepted synonym-merge proposals via [3] option — pivot к Step 5 mass-rename workflow

**Bumps to `version` field of DS frontmatter:**
- Patch add (new token/component/pattern non-conflicting) — no version bump
- Mass-rename (changes existing token name) — version bump

### Step 5 — Mass-rename workflow (manual в v1.0)

Per v1_1_backlog «Atomic mass-rename /product:bg-rename» — atomic implementation deferred. v1.0 uses manual workflow с preview + Find-Replace + cascade check.

**Algorithm v1.0:**

```
1. Surface preview:
   «Mass-rename DS.color.primary → DS.color.brand-blue
   Affected files:
     - .product/mockups/MK-001-login.md (3 occurrences)
     - .product/mockups/MK-003-revisions.md (1 occurrence)
     - .product/design-system.md (5 occurrences: rename + alt_terms section)
   Total: 9 changes across 3 files.»

2. Confirm: [Y/N]

3. If Y:
   - Inform user: «v1.0 ships manual mass-rename. Suggested workflow:
       (a) Use IDE find-replace for «DS.color.primary» → «DS.color.brand-blue» across .product/
       (b) After replace, run /product:cascade (V-11 verifies bi-dir refs)
       (c) Run /product:validate (V-08 terminology check, V-MK-08 token coverage)
       (d) Manual review old token alt_terms section в DS body
     Atomic /product:ds-rename — deferred к v1.1+ (см. v1_1_backlog.md).»

4. Skill bumps DS version field; appends Deprecated tokens entry с migration path
```

**Decision journal entry** (manual via `/product:status` workflow или auto через cascade-check.js).

### Step 6 — Synonym detection details

For each new color token proposal, compute proximity к existing tokens:

```
PROXIMITY_THRESHOLD = 3   // hex digit Hamming distance (rough)
SIMILARITY = compute_hex_distance(proposed_value, existing_token.value)
IF SIMILARITY < PROXIMITY_THRESHOLD:
  PROPOSE merge OR add (user choice)
```

For typography / spacing / shadows — exact match check only (less ambiguity).

For component names: substring + Levenshtein distance (simple). E.g., «PrimaryButton» vs «ButtonPrimary» → proposes alias / merge.

### Step 7 — Deprecation tracking

При rename / replace:

```
APPEND к DS Deprecated tokens section:
  | DS.color.primary | DS.color.brand-blue | <date> | Direct replace, same hex family |

Old token entry kept в DS history секция (audit). Hook design-artifact-validate.js (sub-phase G)
warns если MK uses deprecated token.
```

### Step 8 — Pending queue (если user [3] queue all)

Write к `.product/.pending/ds-pending.yaml`:

```yaml
# Pending DS proposals from MK extraction
# Process via /design:system --review

- proposal_id: DSP-001
  type: token | component | pattern
  category: color | typography | spacing | ...
  proposed_name: DS.color.brand-blue
  proposed_value: "#3B83F8"
  source_mk: MK-NNN
  usage_context: "Primary action button background"
  similar_existing: DS.color.primary
  similarity_score: 2
  queued_at: <ISO>
```

`/design:system --review` consumes этот file (sub-phase F).

## Anti-patterns

1. **Hardcoding colors / spacing в MK body.** Skill catches; either reuse token OR propose new entry. Never silent accept.

2. **Auto-creating tokens без user review.** «Option [1] Accept all» exists but always after preview. Default for solo dev может be auto, но в pilot — explicit per-item review recommended.

3. **Renaming token без cascade.** v1.0 manual workflow surfaces affected files; rename без cascade-check breaks downstream MK references.

4. **Deleting deprecated token immediately.** Audit history requires deprecated entry kept в DS body. Only purge after all references migrated AND grace period (e.g., 30 days observed без warnings).

5. **Token name proliferation.** 10 синих оттенков без явной нужды = caca. Synonym detection forces user decision; skill не silently adds.

6. **Pattern library как rigid contract.** Patterns are recommendations per DS §4 Usage Rules. Breaking pattern должно иметь rationale в MK Design Decisions Log.

7. **Skipping DS update во время D.5.** A6 mandates DS update second (after MK draft). Skipping = orphan MK tokens; downstream MK extraction sees only partial state.

## Failure modes

| Failure | Recovery |
|---|---|
| DS write fails (disk full, permissions) | Surface error; MK remains draft; suggest retry |
| User declines all proposals (Option 3 queue all) | Pending queue файл populated; D.5 continues с MK active transition без DS finalize |
| Synonym detection false positive | User can reject merge proposal; new unique token added |
| Mass-rename mid-flow interrupted | v1.0: surface incomplete state; user uses IDE find-replace remainder |
| Hook design-artifact-validate.js (sub-phase G pending) warns on deprecated token use | Warning surfaces в stderr; non-blocking |
| Existing DS unparseable (malformed YAML / markdown) | Surface error; suggest manual fix; do NOT auto-rebuild |

## Related

- Process: `.claude/docs/design-module/SPEC.md §7.5` (D.5 Artifact Generation — DS extraction step)
- Validation: `.claude/docs/pmo/validation.md` V-MK-08 (token coverage), V-DS-* (DS internal consistency, partial в v1.0)
- Parent skill: `design-session.md` D.5 step
- Artifact: `.claude/docs/pmo/artifacts/DS.md` (full schema + token structure examples)
- Companion commands:
  - `/design:system --review` — processes `.product/.pending/ds-pending.yaml` proposals (sub-phase F)
  - `/design:system --update-from <MK-id>` — force re-extract from specific MK (sub-phase F)
- v1.1+ backlog: atomic mass-rename `/product:ds-rename` (или `/design:ds-rename`) — см. v1_1_backlog «Atomic mass-rename» pattern
