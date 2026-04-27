---
description: F.7 step — update Role & Permission Model (RPM singleton) с new actors из SC.actors + actions из SC steps + conditional permissions из authorization BR. 🟢 Confirmation level — A1 auto-approve eligible per DEC-DEV-0013.
---

# RPM Derivation — F.7 Skill

Update the Role & Permission Model (singleton RPM) — incremental updates per FM, не rebuild from scratch. **🟢 Confirmation** level — derived; **A1 auto-approve eligible** per DEC-DEV-0013 #2 + #7.

## Input

- ≥1 SC в active (parent FM enrichment) — source for actors + actions
- ≥1 BR в active — source для conditional permissions (authorization category)
- Existing RPM в `.product/rpm.md` (если есть; иначе create)
- SEG (роль <-> segment mapping context)

## Goal

Update `.product/rpm.md` (singleton, fixed id `RPM`) с:
- New actors discovered в SC.actors (если еще не в RPM.roles)
- New actions discovered в SC steps (для existing + new actors)
- Conditional permissions referenced from authorization BR

**A1 auto-approve eligible** if confidence high + V-11 passes (см. Step 6).

## Process

### Step 1: Inventory new actors from SC.actors

For each active SC related to current FM:
1. Read SC.actors[]
2. Compare с existing RPM.roles[] (если RPM exists)
3. Identify new actors (not in RPM.roles)

**New actor detection:**
- Actor с R- prefix новый (e.g., R-system-scheduler, R-client-admin)
- Actor mentioned в new SC.actors[] but not previously в RPM

### Step 2: Inventory new actions from SC steps

For each active SC, parse steps:
1. Identify verbs от SC.actors (e.g., «Freelancer **applies** revision», «Client **submits** email»)
2. Convert to verb_object format: `apply_revision`, `submit_revision`, `view_dashboard`
3. Compare с existing RPM permission matrix
4. Identify new actions

**Format:**
- `verb_noun` (snake_case)
- Singular noun typically: `create_project` not `create_projects`
- For aggregate views: `view_dashboard`, `view_revisions`

### Step 3: Identify conditional permissions

Scan active BR-* with `category: authorization`:
- These BRs typically gate actions per role
- Each authorization BR → conditional permission entry в RPM matrix

Format в matrix: `conditional (BR-NNN)` instead of ✓/✗.

### Step 4: Update RPM matrix

For each (role × action) cell:
- **`✓`** — allowed unconditionally
- **`✗`** — denied
- **`✓ (own)`** — allowed only on own resources (implicit ownership BR)
- **`conditional (BR-NNN)`** — allowed only when BR-NNN holds

If multiple actions added to existing actors:
- Update matrix in body
- action_count++ in frontmatter

### Step 5: RPM frontmatter update

**Canonical fields per [RPM.md artifact spec](../../docs/pmo/artifacts/RPM.md):**

```yaml
---
id: RPM                                  # singleton, fixed
type: role-permission-model
title: "Role & Permission Model"
status: draft                            # → active after approve (A1 eligible); typically returns к active per cycle
roles: [R-<role-1>, R-<role-2>, ...]     # all roles, including new
action_count: <N>                        # auto-counted actions in matrix
derived_from: [SC-<NNN>, SEG-<NNN>, BR-<NNN>, ...]  # all sources
confidence: high | medium | low
confidence_notes: |
  <what's solid: actors mapped к SC.actors, actions verb_noun, conditional perms reference BR>
  <what's assumed: anti-matrix entries inferred from privacy interviews>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: <N+1>                           # increment on every approve cycle
---
```

**Anti-pattern field names:**
- ❌ `confidence_rationale`, `rationale` → `confidence_notes`
- ❌ `role_list`, `all_roles` → `roles`
- ❌ `actions_count`, `total_actions` → `action_count`
- ❌ `derived` → `derived_from`

### Step 6: V-11 bi-dir check (per DEC-DEV-0013 #2 — A1 condition)

V-11 (bi-directional references consistent) — для RPM specifically:

**Skill self-check pseudocode:**

```
fn v11_rpm_check(rpm, fm_context):
    # Check 1: every role in RPM.roles is referenced by ≥1 SC.actors
    for role in rpm.roles:
        if role not in any sc.actors for sc in fm.scenarios:
            # Allowed if role is system-role (R-system-*) or future-role placeholder
            if not (role.startswith("R-system-") or role in rpm.future_roles):
                return false  # orphan role
    
    # Check 2: every SC.actors is in RPM.roles
    for sc in fm.scenarios:
        for actor in sc.actors:
            if actor not in rpm.roles:
                return false  # actor not declared
    
    # Check 3: conditional permissions reference active BRs
    for cell in rpm.matrix where cell.startswith("conditional"):
        br_id = extract_br_id(cell)
        if br_id not in active_brs:
            return false  # broken reference
    
    return true
```

If V-11 fails — surface к user: «<role X> in RPM.roles но not used в any SC; either remove role or add SC actor.»

### Step 7: RPM body update

Per [RPM.md spec §Body Structure](../../docs/pmo/artifacts/RPM.md), incremental updates:

```markdown
# Role & Permission Model

## Roles

### R-<role>
- **Описание:** <one-paragraph: who, when, why participating>
- **Источник:** SEG-<NNN> (или SC-<NNN> for derived roles)
- **Related:** BG entry "<role human name>"

(Add new role sections incrementally; preserve existing.)

## Actions

Группированы по категории:

### <Category>
- `verb_noun_1`, `verb_noun_2`, ...

(Add new actions to existing categories or create new categories.)

## Permission matrix

| Action              | R-role-1            | R-role-2          | R-system | ...
|---------------------|---------------------|-------------------|----------|----
| <action_1>          | ✓ (own)             | ✗                 | ✗        | ...
| <action_2>          | conditional (BR-NNN)| ✗                 | ✗        | ...
| <action_NEW>        | ✓                   | conditional (BR-MMM)| ✓ (auto)| ... (NEW row)
| ...

(Add new rows для new actions; add new columns для new roles. Preserve existing cells.)

## Role relationships

- <Existing relationships preserved>
- <New: e.g., R-admin inherits R-freelancer permissions>

## Derivation trace

- R-<role-1>: SEG-<NNN> primary
- R-<role-NEW>: extracted from SC-<NNN> (added в FM-<NNN>)
- Actions extracted from SC-<NNN> steps (action_NEW)

## Anti-matrix (явно запрещено)

- <Existing entries preserved>
- <NEW: R-X NEVER can do Y because <reason from SEG interview / BR.rationale>>
```

### Step 8: A1 auto-approve self-check

**A1 conditions для RPM:**
1. **`confidence: high`**
2. **`confidence_notes` non-empty**
3. **V-11 passed** (per Step 6)

**Skill self-check pseudocode:**

```
fn a1_eligible(rpm, fm_context):
    if rpm.confidence != "high": return false
    if not rpm.confidence_notes: return false
    if not v11_rpm_check(rpm, fm_context): return false
    return true
```

### Step 9a: A1 path (auto-approve)

If A1 eligible:

1. **Skill writes RPM status=active, version: <N+1>** directly
2. **Append journal entry** к `.product/.decisions/journal.md`:
   ```markdown
   ## DEC-AUTO-NNN — Auto-approve RPM (version <N+1>)

   Date: <ISO timestamp>
   Triggered by: rpm-derivation.md A1 logic (FM-<NNN> enrichment)
   Confidence: high
   Conditions met:
     - V-11 passed (RPM.roles bi-dir с SC.actors; conditional perms reference active BRs)
     - confidence_notes non-empty
   Changes: +<N> roles, +<M> actions, +<K> conditional permissions
   Rationale: <skill-provided>
   Revert: type 'revert RPM' (will rollback to version <N>)
   ```
3. **Return «auto-approved» signal** к orchestrator → conversational notification

### Step 9b: Standard path (🟢 Confirmation gate)

If A1 conditions fail:

1. **Surface к user:**
   ```
   RPM update ready для approve.

   Confidence: <level>
   Rationale: <brief>
   Changes: +<N> roles, +<M> actions, +<K> conditional permissions

   A1 auto-approve NOT eligible because:
     - <reason: V-11 fails — role R-X in RPM not referenced by any SC.actors>

   Manual confirmation needed.

   Approve RPM update? [Y/N/edit]
   ```

2. **On user approve:** standard post-approve.

### Step 10: Post-approve actions (both paths)

- **Update FM** (no specific RPM ref в FM frontmatter, но RPM linked through SC.actors)
- **Cascade-check.js** auto-runs (downstream — VC actor assertions)
- **BG extraction** queued (new role names, new action verbs)

## Confidence calibration (C2)

| Уровень | Когда применять | A1 eligible? |
|---|---|---|
| **high** | All new actors directly from SC.actors; all new actions from SC steps; conditional perms reference active BRs; existing matrix preserved correctly | Yes (если V-11 passes) |
| **medium** | Most clear но 1-2 ambiguities (anti-matrix entry inferred; system-role permissions guessed) | No — manual gate |
| **low** | Speculative role addition (no SC.actors yet); should defer | No |

## Anti-patterns

1. **RPM = RBAC implementation table.** RPM is business-level «who can what»; не Django Groups / IAM policies. No framework-specific syntax.
2. **Incomplete matrix.** Empty cells = undefined behavior. Each (role, action) pair must have explicit value (✓/✗/conditional/✓ (own)).
3. **Conditional без BR ref.** «Сan if owner» without BR-NNN — rule invisible. Always reference active BR.
4. **Forgetting system roles.** Auto-actions (scheduled archive, auto-reject) need actor — typically R-system-<purpose>.
5. **Role = SEG.** Не always 1:1. SEG = business segment (who they are); Role = system role (what they do). One SEG может have two roles.
6. **A1 false positive.** If skill self-check passes но V-11 actually fails — skill bug. Surface via /product:meta-feedback.
7. **Anti-matrix forgotten.** Explicitly «никогда» entries critical для preventing accidental permission drift. Add при новом role / privacy-sensitive action.
8. **Variant field names** — use canonical exactly.
9. **Rebuild RPM from scratch.** RPM is incremental — preserve existing roles/actions/cells; ADD new ones. Не overwrite.

## Examples

**Good RPM update fragment:** см. [RPM.md §Examples](../../docs/pmo/artifacts/RPM.md) — full RPM with freelancer/client/admin/system roles.

**Anti-example:**
```yaml
---
id: RPM
roles: [Freelancer, Admin]               # ❌ no R- prefix
action_count: 0                          # ❌ should reflect actual count
role_list: [...]                         # ❌ wrong field name
status: draft                            # ❌ ok if just drafting
---

## Permission matrix
| Freelancer | Admin |                  # ❌ no actions column
| ✓ | ✓ |
Admin can do everything                  # ❌ vague + dangerous
```

## Related

- [`feature-session.md`](feature-session.md) — orchestrator (delegates F.7; surfaces A1 notification)
- [`scenario-authoring.md`](scenario-authoring.md) — F.2 (RPM.roles ↔ SC.actors)
- [`business-rule-extraction.md`](business-rule-extraction.md) — F.3 (authorization BR → conditional perms)
- Artifact spec: [docs/pmo/artifacts/RPM.md](../../docs/pmo/artifacts/RPM.md)
- Validation: V-11 (bi-dir refs) в [docs/pmo/validation.md](../../docs/pmo/validation.md)
- Process: [docs/pmo/processes.md §3.2 P2.A F.7](../../docs/pmo/processes.md), §2.5.2 (auto-approve A1)
