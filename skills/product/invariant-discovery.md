---
description: F.5 step — discover Invariant Checks (IC-*) from BR + LC. Formal predicates always true. Critical level — auto-triggers DA review via ic-change-trigger.js hook (adaptive-depth).
---

# Invariant Discovery — F.5 Skill

Identify domain invariants — assertions ВСЕГДА true, independently of any scenario. Each IC = formal predicate, supports integrity of the system.

**🔴 Critical level** — каждое IC change automatically triggers Product DA review через `ic-change-trigger.js` hook (Phase 3.E) с adaptive-depth model.

## Input

- ≥1 BR в active (sources for IC support)
- ≥1 LC в active (entity state machine constraints)
- BG (entity terminology)
- Existing IC в `.product/invariants/` (для conflict / duplication check)

## Goal

Produce `.product/invariants/IC-NNN-<slug>.md` artifacts в active. Per IC — formal predicate, severity classified, supporting BR/LC referenced.

## Process

### Step 1: Identify candidate invariants

Scan active BR + LC для IC candidates:

**Hints:**
- **From BR:** rules с «никогда не», «always», «every X must» — likely IC, не BR (re-classify)
- **From LC:** terminal state guarantees («once archived, never modified»), state graph properties («every entity reaches terminal»)
- **From entity attributes:** uniqueness («every Project has unique id»), referential integrity («every Revision links to existing Project»)
- **From business statements:** core promises («no revision can be lost»)

**IC vs BR distinction (per IC.md spec §IC vs BR):**
- **BR:** «при определённых условиях happens X» — process/conditional
- **IC:** «независимо от conditions, всегда верно X» — global property

If candidate has «if/when» language → likely BR. If «always/never» — likely IC.

### Step 2: Per-IC formalization dialogue

For each candidate, surface к user:

```
Implicit invariant detected:
  «Revisions не теряются от incoming до final state» (mentioned в FM-003 Why)

Formalize as IC?
  Suggested statement: «∀ Revision R : R существует ⇒ R.status ∈ LC-002.states 
                       AND ∃ traceable history of transitions от creation до current»
  Suggested severity: critical (data loss → core VP violation)
  Suggested entity: Revision
  Supporting BRs: BR-010, BR-011, BR-013, BR-020 (verify support)
  Related LC: LC-002 (Revision lifecycle)

[Y] Accept as IC-NNN
[E] Edit statement / severity
[N] Reject — это is BR, not IC
[D] Downgrade — if too strict, flag known violations с rationale
```

### Step 3: Severity classification

Per IC.md spec — severity = `critical | high | medium`:

- **critical** — violation = data corruption / core VP violation / regulatory issue. System should abort or alert.
- **high** — violation = significant business impact, but recoverable. Alert + manual review.
- **medium** — violation = degraded behavior, not catastrophic. Log + monitor.

If severity «medium» — это likely BR (process), not IC. Reconsider classification.

### Step 4: Supporting BR / LC analysis

Per IC, identify:
- **Supporting BRs:** which BR rules ensure IC holds
- **Related LCs:** which LC must respect IC (no transition violates)

If candidate IC has no supporting BR — surface: «How is this enforced? Without BR support, IC is just hope.» Either find/create supporting BR, or downgrade IC.

### Step 5: Detection method

Per IC.md spec — `testable_as`:
- **unit** — checked by code-level assertion
- **integration** — checked by integration test (multi-component)
- **runtime-monitor** — checked в production via monitoring (D5 future)
- **design-time** — checked by static analysis / spec validation (e.g., schema)

Each IC must have detectable mechanism. «Unprovable IC» = wishful thinking.

### Step 6: Recovery strategy

При detected violation:
- **Critical:** abort transaction + alert + manual review + audit log
- **High:** alert + manual review
- **Medium:** log + monitor

Per IC.md spec — recovery_strategy must be explicit. «No plan» = panic при incident.

### Step 7: Per-IC frontmatter

**Canonical fields per [IC.md artifact spec](../../docs/pmo/artifacts/IC.md):**

```yaml
---
id: IC-<NNN>                             # 3-digit padded; sequential
type: invariant-check
title: "<short invariant statement>"
severity: critical | high | medium
entity: "<EntityName>"                   # exact BG term; required
rules: [BR-<NNN>, ...]                   # supporting BRs; ≥1 typical
lifecycles: [LC-<NNN>, ...]              # related LCs (must respect IC)
status: draft                            # → active after DA review + approve
testable_as: unit | integration | runtime-monitor | design-time
confidence: high | medium | low
confidence_notes: |
  <what's solid: predicate formal, supporting BRs identified, severity rationale clear>
  <what's assumed: severity «critical» based on VP-001 promise — verify with user>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names:**
- ❌ `confidence_rationale`, `rationale` → `confidence_notes`
- ❌ `severity_level`, `criticality` → `severity`
- ❌ `entity_name`, `e` → `entity`
- ❌ `supporting_rules`, `brs` → `rules`
- ❌ `related_lifecycles`, `lcs` → `lifecycles`
- ❌ `testability`, `test_method`, `detection` → `testable_as`

### Step 8: Per-IC body structure

Per [IC.md spec §Body Structure](../../docs/pmo/artifacts/IC.md):

```markdown
# Invariant: <title>

## Invariant statement
<Formal predicate>

«∀ <Entity> X : <predicate involving X.attributes, X.state, relationships>»

(Words: <plain-language explanation of predicate>)

## Severity rationale
**<critical | high | medium>** because:
1. <consequence 1 — what breaks if violated>
2. <consequence 2>
3. <connection to VP / customer trust>

## Supporting rules
- **BR-<NNN>:** <one-line — how this BR ensures IC holds>
- **BR-<NNN>:** ...

## Related lifecycles
- **LC-<NNN>:** <one-line — which transitions must respect IC>

## Detection method
- **<unit|integration|runtime-monitor|design-time>:** <how IC verified>
- <Specific check description>

## Recovery strategy
При detected violation:
1. <Action 1 — alert / abort / log>
2. <Action 2 — manual review trigger>
3. <Audit / journal entry>
4. <Post-incident: update BR / tests>

## Known violations (accepted)
<If accepted edge cases exist, document с reason + expiry date>
<Default: «Нет — IC strict.»>

## Related invariants
- **IC-<NNN>:** <one-line relationship>
```

### Step 9: Filename

ASCII slug: `.product/invariants/IC-<NNN>-<slug>.md`. Slug = first 3-5 значимых words.

### Step 10: IC write triggers DA review (P-RULE-01)

After write (status=draft), `ic-change-trigger.js` hook (Phase 3.E) automatically:
1. Detects IC file change
2. Writes pending DA entry to `.product/.pending/da-pending.yaml`
3. Stderr signal: «DA review pending для IC-<NNN> (mode: adaptive)»

**Orchestrator (feature-session.md)** spawns `product-devils-advocate` subagent с `Mode: adaptive` (per DEC-DEV-0013 #8). Subagent does Step 1 classify + Step 2 adapt depth (cosmetic → quick consistency / significant → full 6-lens).

Subagent writes findings к `.product/.da-findings/IC-<NNN>-<YYYY-MM-DD>-<HHMM>.md`.

### Step 11: Resolve DA findings

Same flow as F.3 BR — orchestrator presents findings, user acts/defers/dismisses, dismissed findings need rationale в decision journal.

### Step 12: Per-IC approve gate (🔴 Critical, post-DA)

After DA findings resolved:

```
IC-<NNN> ready для approve (DA findings resolved).

Confidence: <level>
Rationale: <predicate formal, supporting BRs cited, recovery clear>
DA: <N> findings resolved (acted: <A>, deferred: <D>, dismissed: <Di> с rationale)

Approve IC-<NNN>? [Y/N/edit]
```

### Step 13: Post-approve

1. **Status → active, version: 1**
2. **Bi-dir update (V-11):**
   - Update each BR.invariants[] += IC-NNN (для supporting BRs)
   - Update each LC.invariants[] (если LC.md spec включает) — verify spec; LC.md в текущей spec не имеет invariants[] field, но related_lifecycles в IC body link sufficient
   - Update FM.invariants[] += IC-NNN (orchestrator handles)
3. **Cascade-check.js** auto-runs
4. **BG extraction** queued
5. **Decision journal entry (Critical):**
   ```markdown
   ## DEC-PLAN-NNN — IC-<NNN> approved (post-DA review)
   Date: <ISO>
   Feature: FM-<NNN>
   Severity: <severity>
   Entity: <entity>
   DA magnitude: <cosmetic|significant>
   Findings resolved: <count and breakdown>
   Statement: <one-line>
   ```

## Confidence calibration (C2)

| Уровень | Когда применять |
|---|---|
| **high** | Predicate formal с ∀ quantifier; supporting BR(s) cited and verified; severity rationale evidence-based; detection method realistic; recovery explicit |
| **medium** | Predicate clear but 1-2 ambiguities (severity guess; detection «runtime-monitor» pre-D5 = aspiration) |
| **low** | Speculative — «think this should always hold но not proven from BR»; should defer if not high-priority |

## Anti-patterns

1. **IC = BR.** Confusion of levels. BR про process; IC про global state. If «if/when» — BR. If «always/never» — IC.
2. **IC с исключениями.** «Always X except в case Y» — это два IC + BR for case Y. Or downgrade IC к BR.
3. **IC не testable.** Without `testable_as` mechanism + concrete check — IC is wish, not invariant.
4. **Слишком много IC.** 30+ IC per product — обычно BR misclassified. 5-10 truly absolute rules typical.
5. **IC без recovery strategy.** «Если IC violated — что делать?» Without plan, violation = panic.
6. **Severity «medium» для IC.** Если только medium — это BR, не IC.
7. **Skipping DA findings dismissal rationale.** Critical-level decisions require explicit reasoning (anti-sycophancy).
8. **Approving в active без DA findings resolved.** Refuse — Critical level workflow.
9. **Variant field names** — use canonical exactly.

## Examples

**Good IC fragment:** см. [IC.md §Examples](../../docs/pmo/artifacts/IC.md) — full IC-003 Revision integrity.

**Anti-example:**
```yaml
---
id: IC-XXX
title: "Revisions обычно сохраняются"     # ❌ «обычно» — not IC
severity: medium                          # ❌ if medium — это BR, не IC
supporting_rules: []                      # ❌ wrong field name + empty
testable_as: TBD                          # ❌ no mechanism
status: active                            # ❌ skipped DA review
---

## Statement
Правки важны и их нужно беречь            # ❌ not formal predicate
```

## Related

- [`feature-session.md`](feature-session.md) — orchestrator (delegates F.5)
- [`business-rule-extraction.md`](business-rule-extraction.md) — F.3 (BR support IC)
- [`lifecycle-derivation.md`](lifecycle-derivation.md) — F.4 (LC must respect IC)
- [`agents/product/devils-advocate.md`](../../agents/product/devils-advocate.md) (subagent — adaptive-depth Mode)
- [`hooks/product/ic-change-trigger.js`](../../hooks/product/ic-change-trigger.js) (Phase 3.E — DA trigger)
- Artifact spec: [docs/pmo/artifacts/IC.md](../../docs/pmo/artifacts/IC.md)
- Process: [docs/pmo/processes.md §3.2 P2.A F.5](../../docs/pmo/processes.md), [validation.md §7 P-RULE-01](../../docs/pmo/validation.md)
