# Pattern: B.1 Frontmatter Convention

> **Status:** validated (codified в CLAUDE.md «Skill конвенции» 2026-04-20). Ongoing usage.

## Name

**B.1 Frontmatter Convention** — explicit frontmatter template + anti-pattern field name list inline в каждом skill, создающем артефакт. Defensive programming против AI «field renaming for naturalness» drift.

## When applicable

✅ **Applicable triggers:**
- Writing new skill that creates artifact с frontmatter schema (Product Module skills creating PS, FM, SC, BR, etc.)
- Refactoring existing skill that previously used implicit «follow artifact spec» reference
- Reviewing skill PR — checklist item

❌ **NOT applicable:**
- Skills that don't create artifacts (orchestrator skills, methodology docs)
- Skills creating freeform content без frontmatter

## Steps

### 1. Identify artifact type from skill purpose

Lookup в `docs/pmo/artifacts/<TYPE>.md` — canonical frontmatter schema.

### 2. Extract canonical fields

Per artifact spec:
- Required fields (`id`, `type`, `confidence`, etc.)
- Optional fields (`confidence_notes`, `priority`, etc.)
- Naming format conventions (slug rules, ASCII per `docs/pmo/artifacts/README.md`)

### 3. Write inline frontmatter template в skill

В body skill (typically Step 3 of skill workflow), include explicit YAML template:

```yaml
---
id: <PS|FM-NNN|...>
type: <artifact-type>
status: draft  # → active при approve
confidence: high | medium | low
confidence_notes: "<required when confidence != high; recommended always>"
# ... остальные canonical fields
---
```

### 4. Include anti-pattern warnings

List specific field names AI tends к use «for naturalness» but are NOT canonical:

```
**Canonical field names — НЕ варьировать:**
- `confidence_notes` (NOT `confidence_rationale`, `rationale`, `confidence_reasoning`)
- `target_value` (NOT `success_threshold`, `target_metric_value`)
- ...
```

Per artifact type, enumerate observed drift candidates.

### 5. Reference filename convention

ASCII slug rule per `docs/pmo/artifacts/README.md`:
- Filename: `<TYPE>-<NNN>-<ascii-slug>.md`
- Slug: transliterate cyrillic per ГОСТ 7.79-2000 System B; lowercase; hyphens
- Example: `SEG-001-solo-creators.md`

## Outputs

- Skill body contains explicit frontmatter template (typically Step 3)
- Skill body contains anti-pattern field name list
- Skill body references slug rule
- AI invoking skill produces canonical field names → no drift downstream

## Examples (DEC-DEV instances + ongoing)

### Origin: DEC-DEV-0011 (PS skill drift fix, 2026-04-20)

**Drift observed:** pilot PS used `confidence_rationale` instead of canonical `confidence_notes`. Skill `problem-discovery.md` only referenced artifact spec без inline template — AI «renamed for naturalness».

**Fix applied:** inline template + anti-pattern list (`confidence_rationale`, `rationale`, `confidence_reasoning` все запрещены). Pattern codified в DEC-DEV-0011 lessons.

### Generalization: DEC-DEV-0012 B.1 (Phase 3 codification, 2026-04-20)

Convention added к CLAUDE.md «Skill конвенции» section. Required для all skills creating artifacts:
1. List all canonical fields с правильными именами
2. Include anti-pattern warnings
3. ASCII slug rule reference

Reference implementations:
- `skills/product/problem-discovery.md` Step 3 (post-DEC-DEV-0011 fix)
- `skills/product/note-promote.md` Step 3 (Phase 2 gap fix; explicit templates per target type FM/SC/BR/IC/NFR/HYP)

### Phase 3 application: DEC-DEV-0014 lesson #11

All Phase 3 skills (planning-session, mvp-scoping, scenario-authoring, business-rule-extraction, lifecycle-derivation, etc.) include explicit frontmatter templates с anti-pattern field name lists. **Result:** 0 PS-style drift expected в Phase 3 outputs (verified statically; real run TBD).

Anti-pattern field name lists especially important для:
- **FM** (many fields — id, type, status, priority, segment, jtbd, hypotheses, value_proposition, release, has_ui, scenarios[], rules[], lifecycles[], verification[], invariants[], mockups[], success_metric, nfr_status, nfr[], requires_nfr, confidence + confidence_notes)
- **BR** (parameters easy to misname — category, severity, parameters, statement)
- **MVP/RL** (target_launch vs target_date confusion)

### Phase 3 closure check: DEC-DEV-0018

Spot check on `lifecycle-derivation.md`: 9 frontmatter pattern matches (description + multiple frontmatter sections). B.1 compliance ✓.

## Anti-patterns

### Over-application

❌ **Inline template для каждого freeform доc** — pattern is для structured artifacts с frontmatter schema. Skills creating freeform content (orchestrators, methodology docs) don't need this.
❌ **Listing every possible AI rename** — anti-pattern list should target observed drift, не speculative. Add к list когда new drift observed (DEC-DEV entry).

### Under-application

❌ **«Just reference artifact spec»** — DEC-DEV-0011 proved this insufficient. AI renames fields «for naturalness» если no inline template.
❌ **Skipping anti-pattern list** — drift specific (e.g., `confidence_rationale` vs `confidence_notes`) prevention requires explicit prohibition. Generic «follow spec» doesn't work.
❌ **Inline template без anti-pattern list** — template shows correct, doesn't prevent rename. Both needed.

### Misapplication

❌ **Anti-pattern list as exhaustive prohibition** — list catches observed drift, not all possible drift. Periodically expand based on real findings (DEC-DEV pattern).

## Refinement triggers

Already validated (codified в CLAUDE.md). Refinement когда:
- New drift observed → add specific anti-pattern field name к relevant skill list
- Multiple skills share same drift class → consider hook-level validation (e.g., `artifact-validate.js` checking field name strict match)
- Field schema changes (artifact spec update) → cascading к skill templates

## Related

- [`CLAUDE.md`](../../../CLAUDE.md) «Skill конвенции» section — official codification
- [`docs/pmo/artifacts/`](../../../docs/pmo/artifacts/) — canonical artifact specs
- [`docs/pmo/artifacts/README.md`](../../../docs/pmo/artifacts/README.md) — slug rule + transliteration spec
- [`skills/product/problem-discovery.md`](../../../skills/product/problem-discovery.md) — reference implementation (post-DEC-DEV-0011)
- [`skills/product/note-promote.md`](../../../skills/product/note-promote.md) — reference implementation (multi-type templates)
