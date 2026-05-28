---
description: D.4 Component State Matrix checklist. Mechanical state coverage verification per interactive component (default / hover / focus / error / disabled / loading / empty / overflow / skeleton). V-MK-02 partial mechanical mode per DEC-DEV-0052 Q3/C5.
---

> **User-facing output language:** Russian. Identifiers / file paths / commands / tokens — verbatim.

# Component State Matrix — Skill

Used by `design-session.md` D.4 step. Walks через each interactive component identified в MK Screen Inventory и verifies state coverage.

## Activation context

Skill loaded после D.3 final approve. Input from orchestrator:
- `<MK-id>` (draft state, в process of being finalized)
- Screen Inventory items list (SI-N → components mentioned per SI)
- Linked BR list (constraints за validation states)
- Linked LC list (entity states за disabled / hidden mappings)

## Checklist invariants

**Default state matrix per interactive component:**

| State | Required for | Skip rationale (если N/A) |
|---|---|---|
| **default** | ALL interactive (button, input, link, card-with-action, modal, menu) | Never N/A — defines baseline |
| **hover** | Pointer-device-applicable (web, desktop) | Touch-only platform (mobile) — может быть N/A с rationale |
| **focus** | ALL interactive (keyboard navigation) | Never N/A — a11y mandatory |
| **error** | Inputs / forms / actions with BR validation | Non-validation components (link, nav) — N/A |
| **disabled** | Components linked to LC states (per LC.transitions) или BR guards | Always-available components — N/A |
| **loading** | Async actions (submit, fetch, save) | Synchronous — N/A |
| **empty** | Lists / collections / data views | Single-item components — N/A |
| **overflow** | Text / data containers с potential long content | Fixed-content — N/A |
| **skeleton** | Slow-network-affected views (fetch-on-mount) | Static content — N/A |

## Algorithm

### Step 1 — Identify interactive components

Parse MK Screen Inventory + Component State Matrix draft. Pattern-match each row для interactive verbs (used by V-MK-02 partial per Q3/C5):

```
INTERACTIVE_VERBS = /\b(click|submit|select|toggle|focus|hover|open|close|expand|collapse|drag|drop|scroll|swipe)\b/i
```

For each component:
- If any row's behavior column matches INTERACTIVE_VERBS → mark `is_interactive: true`
- If component name matches `button`, `input`, `link`, `card`, `modal`, `menu`, `dropdown`, `checkbox`, `radio`, `switch`, `select`, `combobox` → `is_interactive: true`
- Else → `is_interactive: false` (e.g., static label, icon-only-decoration)

Skill only processes `is_interactive: true` components. Static components не require state matrix.

### Step 2 — Per-component state coverage walk

For each interactive component:

```
FOR EACH state IN [default, hover, focus, error, disabled, loading, empty, overflow, skeleton]:
  IF state already в Component State Matrix:
    LOG: «<component>.<state>: present»
    Skip
  ELSE:
    Determine applicability per table above:
      - default: mandatory; flag if missing
      - focus: mandatory; flag if missing
      - others: applicable IF criteria met (see table «Required for»)
    IF applicable AND missing:
      → propose state с reasoning (см. Step 3)
    IF not applicable:
      → propose «N/A» с rationale (см. Step 4)
```

### Step 3 — Propose missing state

Per missing applicable state, propose к user:

```
<component>: missing «<state>» state

Proposed addition:
| <state>  | <visual description: DS.tokens reference + texture> | <behavior> | <BR/LC ref> |

Rationale: <why это applicable — link к BR validation message OR LC transition OR a11y mandate>

Options:
  [1] Accept proposal — append to Component State Matrix
  [2] Refine — adjust visual / behavior / token choice
  [3] Mark N/A — skip с rationale (per Step 4)
  [4] Defer — log в pending checklist, proceed to next component

Silence ≠ continue.
```

If tool active (Stitch/Claude Design) — может trigger single tool call per accepted proposal чтобы generate visual rendering.
If HTML fallback — inline CSS pseudo-class или separate component variant.

### Step 4 — N/A with rationale

If state не applicable (per table или user explicit choice [3] в Step 3):

```
<component>.<state>: N/A
Rationale: <one-line — e.g., «touch-only mobile platform; hover irrelevant»>
```

Append to Component State Matrix как `| <state> | N/A | — | rationale: <text> |`.

**N/A is acceptable** — does не block 🟢 Confirmation gate. Each N/A requires rationale (audit).

### Step 5 — V-MK-02 partial mechanical flag (per Q3/C5)

After full walk, run mechanical check:

```
FOR EACH is_interactive component:
  IF default missing AND not N/A:
    FLAG 🔴: «V-MK-02: <component> missing required default state»
  IF error missing AND component has BR validation links AND not N/A:
    FLAG 🟡: «V-MK-02: <component> linked to BR-NNN but no error state»
```

Findings surfaced inline после walk. Blocking → must address inline; Warning → can defer to pending.

### Step 6 — Cross-reference verification (manual — V-MK-03 partial)

**Note:** V-MK-03 full automation deferred к v1.1 per Q3/C5. v1.0 ships manual checklist:

```
🔍 V-MK-03 Manual Cross-Reference Check (per DEC-DEV-0052 C5 — manual в v1.0):

Verify человеком:
  1. Все BR с validation/format/constraint patterns reflected в error states?
     - BR-XXX: "<statement>" → MK.<component>.error state? [yes / no — needs fix]
     - ...
  2. Все LC states с UI consequences reflected в disabled/hidden states?
     - LC-YYY: "<transition>" → MK.<component>.disabled / hidden? [yes / no]
     - ...
  3. Все RPM role-based visibility rules reflected в screen access?
     - RPM section "<role>" → MK.SI-N accessible per role? [yes / no]

  Options:
    [1] All confirmed — mark V-MK-03 manual checked
    [2] Some gaps — list gaps; iterate fixes
    [3] Defer manual review — log к session pending; warning surfaces в D.5 approve
```

### Step 7 — Confirmation summary

After all components walked:

```
✅ D.4 Component State Matrix Complete для MK-NNN

Components processed: <N>
  default coverage: <N>/<N>
  error coverage: <N applicable, M present, K N/A>
  ...

V-MK-02 mechanical: pass | <N findings>
V-MK-03 manual: confirmed | deferred

🟢 Confirmation gate:
  IF .claude/product.yaml.auto_approve_confirmation_artifacts.enabled = true
     AND all mechanical findings resolved:
    → auto-approve; return to orchestrator for D.5
  ELSE:
    → explicit «approve as derived?» yes/no
```

## Anti-patterns

1. **Treating всё components as interactive.** Static labels, decorative icons, illustrations — не need state matrix. Skill skips `is_interactive: false` items.

2. **Default state missing.** Mechanical V-MK-02 catches; never N/A.

3. **Focus state missing for keyboard a11y.** WCAG 2.1.1 mandate. Pattern-match если skill misses → manual review.

4. **N/A без rationale.** Audit trail mandate. Skill rejects bare N/A; demands one-line reason.

5. **Skipping mechanical V-MK-02 flag.** Q3/C5 specifies partial automation — skill MUST run после walk; surface blocking findings.

6. **Skipping V-MK-03 manual checklist.** Defer is allowed (с pending warning) but skip без notice не allowed — silently undermines validation.

7. **Hardcoding hover state для mobile-only platform.** Check `MK.frontmatter.platform`; если `mobile` only → hover N/A automatic.

## Failure modes

| Failure | Recovery |
|---|---|
| Component name ambiguous (e.g., «item» — interactive или static?) | Surface к user explicit choice |
| Tool call для state generation fails | Fall к textual description в matrix; mark с TODO marker |
| BR не linked в MK но скилл expects | Warn; suggest cross-link через FM body update |
| All checks N/A (component never has any state) | Re-classify as `is_interactive: false`; remove from matrix |

## Related

- Process: `.claude/docs/design-module/SPEC.md §7.4` (D.4 Component State Matrix)
- Validation: `.claude/docs/pmo/validation.md` V-MK-02, V-MK-03 (см. design-validation.md skill для full V-MK-* runner — sub-phase E)
- Parent skill: `design-session.md` D.4 step
- Artifact: `.claude/docs/pmo/artifacts/MK.md` (Component State Matrix section schema)
