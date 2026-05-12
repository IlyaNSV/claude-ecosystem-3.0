---
description: F.3 step — extract Business Rules (BR-*) from active SC steps. Atomic, formalizable, parameterized когда возможно. Critical level — auto-triggers DA review via br-change-trigger.js hook.
---

> **User-facing output language:** Russian (per CLAUDE.md § Language and tone). Keep identifiers, file paths, commands/flags, technical terms, abbreviations, and code blocks verbatim — don't translate or inflect them.

# Business Rule Extraction — F.3 Skill

Extract atomic business rules from active SC steps. Each BR — formal предикат, ссылающийся на BG terms, parameterized для reusability.

**🔴 Critical level** — каждое BR change automatically triggers Product DA review через `br-change-trigger.js` hook (Phase 3.E) с adaptive-depth model.

## Input

- ≥1 SC в active (parent FM enrichment in progress)
- BG (BG terms используются в BR statements)
- RPM (для authorization-category BR — references roles)
- Existing BR in `.product/business-rules/` (для conflict / reuse check)

## Goal

Produce `.product/business-rules/BR-NNN-<slug>.md` artifacts в active. Per BR — atomic, falsifiable, with parameters extracted (если applicable).

## Process

### Step 1: Scan active SC steps for implicit rules

Read all active SC related to current FM. Per step, identify implicit rules:

**Hints:**
- Conditional language: «if», «когда», «при условии» → BR candidate
- Validation language: «должен быть», «не более», «within range» → validation BR
- Routing/linking logic: «attached to», «matched to», «assigned» → workflow BR
- Authorization: «only X can», «permitted for», «restricted to» → authorization BR
- Calculation: «computed as», «sum of», «percentage of» → calculation BR

### Step 2: Per-BR formalization dialogue

For each candidate, surface к user:

```
Implicit rule detected в SC-005 step 3:
  «Email is matched to project by sender email»

Formalize as BR?
  Suggested category: workflow
  Suggested statement: «ЕСЛИ incoming revision sender email ∈ Client.emails of one active Project, ТО revision.project_id := Project.id»
  Suggested parameters:
    - linking_strategy: "first_match_only" | "best_match"
    - fallback_on_multiple: "manual_review" | "auto_assign_first"

[Y] Accept as BR-NNN
[E] Edit statement / parameters
[N] Reject — это just navigation, not BR
[S] Split — это два rules (matching + fallback)
```

### Step 3: Per-BR frontmatter

**Canonical fields per [BR.md artifact spec](../../docs/pmo/artifacts/BR.md):**

```yaml
---
id: BR-<NNN>                             # 3-digit padded; sequential
type: business-rule
title: "<short rule formulation>"
category: validation | calculation | authorization | workflow | constraint | state-transition
status: draft                            # → active after DA review + approve
scenarios: [SC-<NNN>, ...]               # SCs где applied; bi-dir с SC.rules; populated as approve
invariants: [IC-<NNN>, ...]              # ICs supported; populated в F.5
lifecycles: [LC-<NNN>, ...]              # LCs где BR в guards; populated в F.4
parameters:                              # parameterized values; named per business meaning
  <param_name>: <value>
  # ...
owner_feature: FM-<NNN>                  # primary FM; BR может reuse в other FMs
confidence: high | medium | low
confidence_notes: |
  <what's solid: rule explicit в SC, parameters extracted, category clear>
  <what's assumed: parameter values might need tuning post-pilot>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names:**
- ❌ `confidence_rationale`, `rationale` → `confidence_notes`
- ❌ `cat`, `rule_type` → `category`
- ❌ `scenario_refs`, `scs` → `scenarios`
- ❌ `params`, `parameter_list` → `parameters`
- ❌ `owner`, `parent_feature`, `fm` → `owner_feature`

### Step 4: Per-BR body structure

Per [BR.md spec §Body Structure](../../docs/pmo/artifacts/BR.md):

```markdown
# Business Rule: <title>

## Statement
<Formal predicate format>

«ЕСЛИ <condition (with BG terms in bold)> ТО <action/constraint (with BG terms)>»
or
«ВСЕГДА <invariant statement>»

## Context
<Когда rule applied — какие processes / which entities>
<Когда rule НЕ applied — exclusions>

## Parameters
- `<param_name>: <value>` — <one-line meaning>
- ...

## Rationale
<Бизнес-обоснование — откуда rule взялось из MR / HYP / interviews>
<Reference к specific evidence: «From MR section X», «Per intervju 5 freelancers»>

## Telemetry plan
<MANDATORY если BR has numeric parameter AND confidence ∈ {medium, low} — DEC-DEV-0023>

<For confidence: high — section optional / "N/A — parameter standard / authoritative source.">

- **Metric:** <event/funnel/counter to track post-launch>
- **Threshold for revisit:** <signal that triggers re-tuning, e.g., ">1% legitimate users blocked">
- **Window:** <period for collection, e.g., "first 4 weeks of launch / first 30 cohorts">
- **Action on signal:** <relax / tighten / add exception — fold into RL-NN+1 backlog>

## Applied in scenarios
- SC-<NNN> шаг N: <brief — primary use, success case>
- SC-<NNN> шаг M: <alt branch — multi-match handling>
- SC-<NNN>e1 шаг K: <error branch — no match fallback>

## Edge cases
- <Edge case 1>: <how rule handles>
- <Edge case 2>: <how rule handles>

## Examples
<Concrete input → output examples; helps reviewers verify rule>

Input: <data>
Output: <expected>

Input (alt): <data>
Output: <expected — illustrates parameter behavior>
```

### Step 4a: Telemetry plan trigger (DEC-DEV-0023)

**Required for any BR matching all of:**
- `confidence: medium | low`
- Body contains numeric / categorical parameter chosen as judgment call (e.g., session TTL=30d, max_devices=5, captcha_threshold=5, rate_limit=3/hour)

**Skill MUST surface:**
```
BR-NNN parameter <name>=<value> chosen с confidence=medium и rationale "<industry varies / no internal data>".
Per telemetry plan convention (DEC-DEV-0023):
  - Metric: <propose what to track>
  - Threshold for revisit: <propose>
  - Window: <propose>
  - Action: <propose>

Edit или approve as-is.
```

**Pain origin:** my-first-test pilot's BR-013 (30-day session TTL), BR-014 (5-device limit), BR-018 (CAPTCHA threshold=5) — все judgment calls, все medium confidence, none had explicit revisit plan. Without telemetry plan, "we'll tune later" silently becomes "we never tune". DEC-DEV-0023 codifies discipline: parameter choice now formalizes its own validation pathway.

### Step 5: Filename

ASCII slug: `.product/business-rules/BR-<NNN>-<slug>.md`. Slug = first 3-5 значимых words из title.

### Step 6: Per-BR write triggers DA review

After write (status=draft), `br-change-trigger.js` hook (Phase 3.E) automatically:
1. Detects BR file change
2. Writes pending DA entry to `.product/.pending/da-pending.yaml`
3. Stderr signal: «DA review pending для BR-<NNN> (mode: adaptive)»

**Orchestrator (feature-session.md) handles** stderr → spawns `product-devils-advocate` subagent с `Mode: adaptive` brief (per DEC-DEV-0013 #8).

Subagent writes findings to `.product/.da-findings/BR-<NNN>-<YYYY-MM-DD>-<HHMM>.md`.

### Step 7: Resolve DA findings

Orchestrator presents к user:

```
DA review complete для BR-<NNN> (magnitude: <cosmetic|significant>):
  Classification rationale: <one-line>
  Findings:
    🔴 Critical: <N>
    🟡 Important: <N>
    🔵 Discussion: <N>

Per-finding action: act / defer / dismiss (with rationale).
```

User decides per finding. Critical findings must be acted on, deferred (с journal entry), or dismissed (с rationale в decision journal — anti-sycophancy mechanism).

### Step 8: Per-BR approve gate (🔴 Critical, post-DA)

After all critical/important DA findings resolved:

```
BR-<NNN> ready для approve (DA findings resolved).

Confidence: <level>
Rationale: <BR formal, parameters extracted, scenarios cited, edge cases covered>
DA: <N> findings resolved (acted: <A>, deferred: <D>, dismissed: <Di> — see journal)

Approve BR-<NNN>? [Y/N/edit]
```

### Step 9: Post-approve

1. **Status → active, version: 1**
2. **Bi-dir update (V-11):**
   - Update each SC.rules[] += BR-NNN
   - If FM.rules[] не contains BR-NNN — add (orchestrator handles)
3. **Cascade-check.js** auto-runs (downstream LC/IC checked)
4. **BG extraction** queued
5. **Decision journal entry** (Critical level):
   ```markdown
   ## DEC-PLAN-NNN — BR-<NNN> approved (post-DA review)
   Date: <ISO>
   Feature: FM-<NNN>
   Category: <category>
   DA magnitude: <cosmetic|significant>
   Findings resolved: <count and breakdown>
   Statement: <one-line>
   ```

## Confidence calibration (C2)

| Уровень | Когда применять |
|---|---|
| **high** | Rule explicit in SC step; parameters extracted с meaningful names; category clear (not «misc»); examples illustrative; edge cases identified |
| **medium** | Rule formalized but 1-2 ambiguities (parameter values guessed pre-pilot; edge cases speculative) |
| **low** | Rule conjectured, not directly mapped to SC step; should defer if uncertain |

## Anti-patterns

1. **BR = SC.** BR is rule, SC is scenario. «При получении письма happens X» — это SC. BR — condition «email matches project».
2. **Non-atomic BR.** «При создании check email, apply batching, send notification» — три BR. Split.
3. **Hard-coded values в statement.** `min_budget=50` в statement → rule не reusable. Move to `parameters` field.
4. **Skipping impact analysis (DA).** Если user wants quick BR без DA review — refuse. P-RULE-02 enforces (Phase 3.E hook auto-triggers; user can't bypass).
5. **Mixing categories.** validation + calculation в одном BR — split per category.
6. **Statement без BG terms in bold.** Use canonical terms; bold для BG extraction queue.
7. **Skipping DA findings dismissal rationale.** Anti-sycophancy mechanism — dismissed findings всегда recorded с reason.
8. **Approving BR в active без DA findings resolved.** Refuse — Critical level requires explicit per-finding resolution.
9. **Variant field names** (per DEC-DEV-0011) — use canonical exactly.

## Examples

**Good BR fragment:** см. [BR.md §Examples](../../docs/pmo/artifacts/BR.md) — full BR-010 with email-to-project linking.

**Anti-example:**
```yaml
---
id: BR-010
title: "Email matching"
category: misc                            # ❌ not a real category
business_rules: []                        # ❌ wrong field name
parameters:                               # ❌ no params extracted; values hard-coded в statement
status: active                            # ❌ skipped DA review
---

## Statement
"Правильно привязывать правки"            # ❌ not formal predicate

## Rationale
Standard practice                         # ❌ no evidence link
```

## Related

- [`feature-session.md`](feature-session.md) — orchestrator (delegates F.3)
- [`scenario-authoring.md`](scenario-authoring.md) — F.2 (BR extracted from active SC)
- [`lifecycle-derivation.md`](lifecycle-derivation.md) — F.4 (BR в guards of LC)
- [`invariant-discovery.md`](invariant-discovery.md) — F.5 (BR support IC)
- [`agents/product/devils-advocate.md`](../../agents/product/devils-advocate.md) (subagent — adaptive-depth Mode)
- [`hooks/product/br-change-trigger.js`](../../hooks/product/br-change-trigger.js) (Phase 3.E — DA trigger)
- Artifact spec: [docs/pmo/artifacts/BR.md](../../docs/pmo/artifacts/BR.md)
- Process: [docs/pmo/processes.md §3.2 P2.A F.3](../../docs/pmo/processes.md), [validation.md §7 P-RULE-02](../../docs/pmo/validation.md)
