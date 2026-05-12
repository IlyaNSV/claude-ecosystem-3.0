---
description: F.2 step — author User Scenarios (SC-*) from FM context. Per-FM 2-4 main SC + alternative + error flows. Actor-verb format. Strategic per-SC approve. Called by feature-session.
---

> **User-facing output language:** Russian (per CLAUDE.md § Language and tone). Keep identifiers, file paths, commands/flags, technical terms, abbreviations, and code blocks verbatim — don't translate or inflect them.

# Scenario Authoring — F.2 Skill

Create User Scenarios (SC-*) for a feature. Each SC = one flow (main / alternative / error). Step format = actor-verb с явными data references.

## Input

- FM в `planned` status (или enrichment in progress) с filled skeleton frontmatter
- Active SEG (для actors context)
- Active BG terms (для terminology consistency)
- RPM (existing roles из other features)

## Goal

Produce 2-6 `.product/scenarios/SC-NNN-<slug>.md` artifacts в active. SC numbering convention:
- `SC-NNN` — main flow
- `SC-NNNa, SC-NNNb` — alternative flows
- `SC-NNNe1, SC-NNNe2` — error flows

(Per [SC.md spec §Numbering](../../docs/pmo/artifacts/SC.md))

## Process

### Step 1: Identify scenario candidates

From FM context, identify distinct flows:

**Main flows:**
- Per FM.jtbd[]: usually 1-2 main SC per JTBD (one per primary success path)
- Trigger types: user-initiated, system-event, scheduled, external (email/webhook)

**Alternative flows:**
- Same trigger as main, but different conditions (e.g., multi-match instead of single)
- Different user choices at decision points

**Error flows:**
- Validation failures
- External dependencies down
- Permission denied
- Resource limits hit

Target: 2-4 main + 1-2 alt + 1-3 error. Don't exhaustively cover edge cases — those go в VC negative assertions.

### Step 2: Per-SC dialogue

For each candidate:
1. Identify trigger (what starts this SC)
2. List actors (roles from RPM + SEG; system-roles for auto-actions)
3. Identify preconditions (state needed before SC can run)
4. Walk through steps (actor + action + system response)
5. Identify postconditions (state after success)
6. Mark BR usage points

**Step format (per SC.md content rules):**
```
N. **Actor** does action [with data].
   System response: <observable outcome>.
   Applied: BR-XXX (рядом с шагом, где правило срабатывает)
```

**Concrete data > generic phrases:**
- ❌ «Пользователь вводит текст» — vague
- ✅ «**Freelancer** вводит project_name (string, 3-100 символов; БГ term: Project)»

### Step 3: BG terminology consistency

For terms used:
- Bold first occurrence: `**Project**`, `**Revision**`
- If term not в `.product/glossary.md` — add to BG candidates queue (orchestrator handles via bg-extractor.js Phase 3.E)
- Use canonical terms; reject synonyms («edit» if BG term «Revision»)

### Step 4: Per-SC frontmatter

**Canonical fields per [SC.md artifact spec](../../docs/pmo/artifacts/SC.md):**

```yaml
---
id: SC-<NNN>                             # main; or SC-<NNN><a|b> alt; or SC-<NNN>e<N> error
type: scenario
title: "<short scenario name>"
feature: FM-<NNN>                        # parent FM, required
flow_type: main | alternative | error    # exactly one
actors: [R-role-1, R-role-2, ...]        # roles из RPM (R- prefix); ≥1 required
preconditions: "<state needed before SC>"
rules: [BR-<NNN>, ...]                   # BRs applied; populated as F.3 extracts; can be empty initially
lifecycle: LC-<NNN>                      # main lifecycle touched; null if pure navigation
mockup: MK-<NNN>                         # if has_ui; null otherwise; populated в Phase 6
verification: [VC-<NNN>, ...]            # populated as F.6 derives
status: draft                            # → active after approve
confidence: high | medium | low
confidence_notes: |
  <what's solid: trigger clear, actors mapped to RPM, steps explicit с data>
  <what's assumed: error paths conjectured if no real production data yet>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names — НЕ варьировать:**
- ❌ `confidence_rationale`, `rationale` → canonical = `confidence_notes`
- ❌ `feature_id`, `parent`, `fm` → canonical = `feature`
- ❌ `flow`, `type_flow`, `scenario_type` → canonical = `flow_type`
- ❌ `actor`, `roles`, `participants` → canonical = `actors`
- ❌ `precondition`, `pre`, `setup` → canonical = `preconditions`
- ❌ `business_rules`, `rule_refs`, `brs` → canonical = `rules`
- ❌ `lifecycle_id`, `lc` → canonical = `lifecycle`

### Step 5: Per-SC body structure

Per [SC.md spec §Body Structure](../../docs/pmo/artifacts/SC.md):

```markdown
# Scenario: <title>

## Actors
- **<R-role-1>** (<role-id>) — <description: who, why participating>
- **<R-role-2>** (<role-id>) — <description>
(System roles also listed if applicable)

## Preconditions
- <State of entity X — e.g., "Project P exists, status=in-progress">
- <State of relationships — e.g., "Client C linked to P через email">
- <Setup actions taken — e.g., "Freelancer configured email forwarding">

## Trigger
<What starts this SC: user action / event / condition>

## Steps
1. **<Actor>** <action> [with concrete data].
   System: <observable response>.
2. **<Actor>** <action>.
   System applies **BR-<NNN>** (<one-line rule reference>):
   - <decision branches if any>
   - <fallback to other SC if applicable: "see SC-NNNa for multi-match">
3. ...

## Postconditions
- <Entity state changes>
- <Relationships updated>
- <Notifications sent>
- <Lifecycle transitions: "Revision R from [*] to incoming (LC-002)">

## Business rules applied
- BR-<NNN> (шаг N) — <one-line rule purpose>
- BR-<NNN> (шаг M) — ...

## Related scenarios
- SC-<NNN>a (alternative): <when this branch taken>
- SC-<NNN>e<N> (error): <when this error path>

## Example data
<Concrete inputs and expected outputs — helps reviewers визуализировать>
```

### Step 6: Filename

ASCII slug (per [docs/pmo/artifacts/README.md](../../docs/pmo/artifacts/README.md)):
- `.product/scenarios/SC-<NNN>-<slug>.md` (main)
- `.product/scenarios/SC-<NNN><suffix>-<slug>.md` (alt: `SC-005a`; error: `SC-005e1`)

Slug = first 3-5 значимых words из title.

### Step 7: Per-SC approve gate (🟠 Strategic)

```
SC-<NNN> draft ready для approve.

Confidence: <level>
Rationale: <what's solid: trigger explicit, actors mapped, steps actor-verb с data>
           <what's assumed: alt flow SC-<NNN>a covers multi-match — need real data validation>

Approve? [Y/N/edit]
```

### Step 8: Post-approve

1. **Status → active, version: 1**
2. **Update FM.scenarios[] += SC-NNN** (V-11 bi-dir)
3. **BG extraction** queued (bold terms из SC body)
4. **Cascade-check.js** auto-runs (Phase 3.E hook)
5. **Decision journal entry** (Strategic):
   ```markdown
   ## DEC-PLAN-NNN — SC-<NNN> approved
   Date: <ISO>
   Feature: FM-<NNN>
   Flow type: <main|alt|error>
   Actors: [...]
   BRs referenced: [...] (will be extracted в F.3)
   ```

## Confidence calibration (C2)

| Уровень | Когда применять |
|---|---|
| **high** | Trigger explicit; all actors in RPM (or system); steps actor-verb с concrete data; postconditions link to LC; BR references explicit |
| **medium** | Most clear но 1-2 ambiguities (e.g., error paths conjectured без real production data; actor «Freelancer» обозначен но specific permissions unclear) |
| **low** | Speculative scenario (e.g., «what if X happens» without evidence); steps vague; should defer to NOTE-NNN если not high-priority |

## Anti-patterns

1. **Mixing flows in one SC.** One SC = one flow. Если main + alt + error в одном файле — split (per SC.md numbering).
2. **Steps без actor.** «Создаётся revision» — кто создаёт? Always actor (System если auto).
3. **Generic data.** «User enters text» — bad. «Freelancer enters project_name (string, 3-100 chars)» — good.
4. **UI-specific verbs в non-UI SC.** «Нажимает кнопку X» — если фича не UI (FM.has_ui=false) — describe abstractly.
5. **Skip BR markers.** «Email matched project» — should be «**BR-010** matches by sender email». BR refs are reusability anchors.
6. **Postconditions = «всё работает».** Должны быть concrete state changes, not vague satisfaction.
7. **Forgetting alt/error flows.** If main has decision points, alt or error SC needed для each branch.
8. **Variant field names** (per DEC-DEV-0011 lesson) — use canonical exactly.

## Examples

**Good SC fragment:** см. [SC.md §Examples](../../docs/pmo/artifacts/SC.md) — full SC-005 with email-to-project linking.

**Anti-example:**
```yaml
---
id: SC-005
title: "Получение правки"
feature: FM-003
flow_type: main
actors: [Freelancer]                     # ❌ no R- prefix
preconditions:                           # ❌ empty
business_rules: []                       # ❌ wrong field name (rules not business_rules)
confidence_rationale: "..."              # ❌ wrong field name
---

## Steps
1. Получаем письмо.                       # ❌ no actor, no data
2. Делаем что-то.                         # ❌ vague
3. Готово.                                # ❌ no postcondition
```

## Related

- [`feature-session.md`](feature-session.md) — orchestrator (delegates to this skill at F.2)
- [`business-rule-extraction.md`](business-rule-extraction.md) — F.3 (extracts BR из active SC steps)
- [`lifecycle-derivation.md`](lifecycle-derivation.md) — F.4 (LC derived from SC transitions)
- [`vc-derivation.md`](vc-derivation.md) — F.6 (VC derived from SC + BR + LC)
- Artifact spec: [docs/pmo/artifacts/SC.md](../../docs/pmo/artifacts/SC.md)
- Process: [docs/pmo/processes.md §3.2 P2.A F.2](../../docs/pmo/processes.md)
