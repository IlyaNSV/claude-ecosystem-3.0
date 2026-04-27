---
description: F.6 step — derive Verification Criteria (VC-*) from active SC + BR + LC. Gherkin-like Given/When/Then format. 🟢 Confirmation level — A1 auto-approve eligible per DEC-DEV-0013.
---

# VC Derivation — F.6 Skill

Derive Verification Criteria for each active SC. VC = falsifiable assertions in Gherkin-like format. Contract между Product Layer и tests/QA. **🟢 Confirmation** level — derived; **A1 auto-approve eligible** per DEC-DEV-0013 #2 + #7.

## Input

- ≥1 SC в active (parent FM enrichment)
- BR в active (referenced from SC)
- LC в active (transitions for entity state assertions)
- (NFR — Phase 4; skip NFR-derived VC contributions в Phase 3)

## Goal

Per active SC, produce ≥1 VC. Total: 2-5 VC per FM (one per SC main + alt + error). Each VC `.product/verification/VC-NNN-<slug>.md` в active. **A1 auto-approve eligible** if confidence high + V-07 passes (см. Step 7).

## Process

### Step 1: For each active SC, identify VC scope

Per SC:
- **Main flow VC** (always): assert success path
- **Alt flow VC** (if SC-NNNa exists): assert alt branch
- **Error flow VC** (if SC-NNNeN exists): assert error handling
- **Negative assertions**: что НЕ должно happen (side effects, idempotency, scope boundaries)

### Step 2: Per-VC drafting

For each VC:

**Identify Given/When/Then:**

- **Given:** preconditions от SC + test setup
- **When:** action от SC trigger или specific step
- **Then:** expected outcomes:
  - Entity state changes (X.status == Y)
  - Side effects (notifications sent, timestamps set)
  - Lifecycle transitions (X from state A to state B)
  - Negative assertions (NOT created duplicate; NOT processed twice)

**Use formal predicates:**
- ❌ «Система работает» — не falsifiable
- ✅ «Revision R created with R.project_id == P.id AND R.status == 'incoming'»

### Step 3: Identify rules verified

Per VC, list which BR's actions are verified:
- BR-NNN (шаг N of SC-MMM) — what specific clause checked
- BR-NNN (шаг K) — ...

### Step 4: Identify lifecycle transitions verified

Per VC, list which LC transitions verified:
- LC-NNN: <from_state> → <to_state> (per transition table)

### Step 5: Negative assertions

For each VC, ≥1 negative assertion:
- NOT duplicate (idempotency)
- NOT side effect (privacy: notifications не sent к other users)
- NOT scope creep (X не происходит, even though might seem related)

Per VC.md content rules: negative assertions важны, без них tests miss side effects.

### Step 6: Per-VC frontmatter

**Canonical fields per [VC.md artifact spec](../../docs/pmo/artifacts/VC.md):**

```yaml
---
id: VC-<NNN>                             # 3-digit padded; sequential
type: verification-criteria
title: "<short verification statement>"
scenario: SC-<NNN>                       # primary SC, required
rules: [BR-<NNN>, ...]                   # which BRs verified
lifecycle: LC-<NNN>                      # main LC verified; null если не applicable
flow_type: main | alternative | error    # matches SC.flow_type
status: draft                            # → active after approve (A1 eligible)
derived_from: [SC-<NNN>, BR-<NNN>, LC-<NNN>, ...]
testable: true | false                   # can VC be auto-tested?
suggested_test_type: unit | integration | e2e | manual
confidence: high | medium | low
confidence_notes: |
  <what's solid: SC steps clear, BRs assert points explicit, LC transitions identified>
  <what's assumed: edge cases speculative pre-pilot data>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names:**
- ❌ `confidence_rationale`, `rationale` → `confidence_notes`
- ❌ `scenario_id`, `sc` → `scenario`
- ❌ `business_rules`, `brs` → `rules`
- ❌ `lc`, `lifecycle_id` → `lifecycle`
- ❌ `flow`, `type` → `flow_type`
- ❌ `derived` → `derived_from`
- ❌ `is_testable`, `automatable` → `testable`
- ❌ `test_type` → `suggested_test_type`

### Step 7: Per-VC body structure

Per [VC.md spec §Body Structure](../../docs/pmo/artifacts/VC.md):

```markdown
# Verification: <title>

## Criteria statement
<One-paragraph: при каком context, какое action должно lead к каким outcome>

## Given / When / Then

\`\`\`gherkin
Given <precondition 1>
  And <precondition 2>
  And <precondition N>

When <action — соответствует SC trigger или specific step>:
  <details if action complex>

Then <expected outcome 1>
  And <expected outcome 2>
  And <lifecycle transition: Entity X from <from_state> to <to_state> (LC-NNN)>
  And NOT <negative assertion 1>
  And NOT <negative assertion 2>
\`\`\`

## Expected outcomes
- **Entity created/updated:** <details — fields, values>
- **Entity link:** <relationships established>
- **Notification sent:** <to whom, type, content>
- **LC transition:** <state change>
- **Side effect:** <other observable changes>

## Rules verified
- **BR-<NNN>** (шаг N of SC-<MMM>): <specific clause: «email-to-project linking by sender match»>
- **BR-<NNN>** (шаг M): <...>

## Lifecycle transitions verified
- **LC-<NNN>:** <from_state> → <to_state> (при <action>)

## Negative assertions
- NOT <duplicate detection>
- NOT <side effect 1>
- NOT <scope creep — что not change>

## Edge cases
- <Edge case 1>: <how VC handles>
- <Edge case 2>: <how VC handles>

## Test data suggestions
\`\`\`
Input:
  <field>: <value>
  ...

Pre-state:
  <entity setup>

Post-state (assertions):
  <expected entity state>
\`\`\`
```

### Step 8: V-07 coverage check (per DEC-DEV-0013 #2 — A1 condition)

V-07 (per validation.md §5.1): для SC с alternative/error flows — каждый flow должен быть покрыт VC.

**Skill self-check pseudocode:**

```
fn v07_coverage_check(fm):
    for sc in fm.scenarios:
        related_sc = [sc] + sc.alt_flows + sc.error_flows  # SC-NNN + SC-NNNa + SC-NNNe1, ...
        for related in related_sc:
            if not exists VC where VC.scenario == related.id:
                return false  # missing coverage
    return true
```

**Effectively:** every active SC (main + alt + error) must have ≥1 VC.

If V-07 fails — surface к user: «SC-005a (alt flow) не covered VC. Need additional VC before V-07 passes.»

### Step 9: Filename

ASCII slug: `.product/verification/VC-<NNN>-<slug>.md`. Slug = first 3-5 значимых words.

### Step 10: A1 auto-approve self-check

**A1 conditions для VC:**
1. **`confidence: high`**
2. **`confidence_notes` non-empty**
3. **V-07 passed** — coverage check (Step 8)

**Skill self-check pseudocode:**

```
fn a1_eligible(vc, fm_context):
    if vc.confidence != "high": return false
    if not vc.confidence_notes: return false
    if not v07_coverage_check(fm_context): return false
    return true
```

### Step 11a: A1 path (auto-approve)

If A1 eligible:

1. **Skill writes VC status=active, version: 1** directly
2. **Append journal entry** к `.product/.decisions/journal.md` (DEC-AUTO-NNN format per DEC-DEV-0013 #9):
   ```markdown
   ## DEC-AUTO-NNN — Auto-approve VC-<NNN>

   Date: <ISO timestamp>
   Triggered by: vc-derivation.md A1 logic
   Confidence: high
   Conditions met:
     - V-07 passed (all SC flows covered for FM-<NNN>)
     - confidence_notes non-empty
   Rationale: <skill-provided one-paragraph>
   Revert: type 'revert VC-<NNN>' в conversation
   ```
3. **Return «auto-approved» signal** к orchestrator → conversational notification surfaced to user

### Step 11b: Standard path (🟢 Confirmation gate)

If A1 conditions fail:

1. **Surface к user:**
   ```
   VC-<NNN> draft ready для approve.

   Confidence: <level>
   Rationale: <brief>

   A1 auto-approve NOT eligible because:
     - <reason: V-07 fails — SC-005a (alt) не covered, требует дополнительный VC>

   Manual confirmation needed.

   Approve VC-<NNN>? [Y/N/edit]
   ```

2. **On user approve:** standard post-approve.

### Step 12: Post-approve actions (both paths)

- **Update SC.verification[]** += VC-NNN (V-11 bi-dir)
- **Update FM.verification[]** += VC-NNN
- **Cascade-check.js** auto-runs
- **BG extraction** queued

## Confidence calibration (C2)

| Уровень | Когда применять | A1 eligible? |
|---|---|---|
| **high** | SC steps explicit; BR clauses cited specifically; LC transitions verified; negative assertions ≥1; expected outcomes concrete | Yes (если V-07 passes) |
| **medium** | Most clear но 1-2 ambiguities (edge case speculative; negative assertions generic) | No — manual gate |
| **low** | Speculative VC; SC steps vague; should defer | No |

## Anti-patterns

1. **VC = дубликат SC.** VC formalizes proofable assertions, не paraphrases SC. Use Gherkin format strictly.
2. **No negative assertions.** Без NOT clauses tests miss side effects. ≥1 negative per VC required.
3. **«Система работает» VC.** Not falsifiable. Concrete predicates always.
4. **VC только для main.** Alt and error flows тоже need VC (V-07 enforces). Less detail OK для error flows but presence required.
5. **VC без BR/LC refs.** «Что-то должно случиться» не grounded. Always cite BR (rules verified) and LC (transitions verified).
6. **A1 false positive.** If A1 self-check passes но coverage actually missing — skill bug. Surface via /product:meta-feedback.
7. **Skip Gherkin format.** Required по spec — uniform format enables auto-test generation в future.
8. **Variant field names** — use canonical exactly.

## Examples

**Good VC fragment:** см. [VC.md §Examples](../../docs/pmo/artifacts/VC.md) — full VC-005 with email-to-project verification.

**Anti-example:**
```yaml
---
id: VC-005
title: "Revision processing works"        # ❌ vague
scenario: SC-005
business_rules: []                        # ❌ wrong field name
flow_type: TBD                            # ❌ should match SC.flow_type
testable: yes                             # ❌ should be true (not yes)
---

## Criteria
Система обрабатывает revision корректно   # ❌ not falsifiable

## Given / When / Then
(missing)                                 # ❌ Gherkin required
```

## Related

- [`feature-session.md`](feature-session.md) — orchestrator (delegates F.6; surfaces A1 notification)
- [`scenario-authoring.md`](scenario-authoring.md) — F.2 (VC.scenario source)
- [`business-rule-extraction.md`](business-rule-extraction.md) — F.3 (VC.rules verifies)
- [`lifecycle-derivation.md`](lifecycle-derivation.md) — F.4 (VC.lifecycle transitions verified)
- Artifact spec: [docs/pmo/artifacts/VC.md](../../docs/pmo/artifacts/VC.md)
- Validation: V-07 в [docs/pmo/validation.md](../../docs/pmo/validation.md)
- Process: [docs/pmo/processes.md §3.2 P2.A F.6](../../docs/pmo/processes.md), §2.5.2 (auto-approve A1)
