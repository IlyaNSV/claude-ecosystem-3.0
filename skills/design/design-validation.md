---
description: V-MK-* runner partial (V-MK-01..V-MK-08). V-MK-02 mechanical partial per Q3/C5; V-MK-03 manual; V-MK-08 (token coverage) regex-based. Runs at D.5 finalization + /design:export.
---

> **User-facing output language:** Russian. Validation rule IDs / token regexes — verbatim.

# Design Validation — Skill

Used by `design-session.md` D.5 step (after MK draft + DS update) и `/design:export` для consume-readiness check. Runs V-MK-* rules subset per Q3/C5 cuts.

## Validation rule matrix (v1.0)

| Rule | Coverage | Mode |
|---|---|---|
| V-MK-01 | Screen coverage vs SC steps | Hook-supported (partial — Phase 6.G heuristic); skill enforces stricter check here |
| V-MK-02 | Component State Matrix completeness | Partial mechanical (per Q3/C5): default + error для interactive components |
| V-MK-03 | BR constraints reflected в error states | Manual via `component-states.md` checklist |
| V-MK-04 | LC states reflected в disabled / hidden | Mechanical: scan MK для disabled/hidden states; cross-ref LC.transitions |
| V-MK-05 | Accessibility baseline | Mechanical: presence checks (tab order documented, aria-labels mentioned, contrast note); auto contrast — v1.1 (нужен Playwright MCP) |
| V-MK-06 | RPM role-based visibility | Mechanical: cross-ref RPM excerpt vs MK Screen Inventory roles |
| V-MK-07 | Responsive breakpoints documented | Mechanical: presence check Responsive Notes section если `platform: responsive` или `mobile` |
| V-MK-08 | DS token coverage (всё references via tokens) | Mechanical: regex `DS\.\w+\.\w+` scan MK vs DS body resolved tokens |

## Activation context

Two invocation modes:

1. **D.5 final approve gate prep** — orchestrator calls после MK draft + DS update; surface findings inline; blocking findings prevent MK active transition.
2. **`/design:export FM-NNN` verify** — pre-handoff sanity; surface findings; не gates handoff but informs user о drift potential.

Input from orchestrator:
- `<MK-id>` (status: draft при D.5; status: active при export)
- DS active state
- Linked artifacts (SC, BR, LC, RPM via FM.* frontmatter)

## Algorithm

### V-MK-01: Screen coverage vs SC steps

```
LOAD MK Screen Inventory rows → list of (SI_id, SC_steps_covered)
LOAD all SC linked в MK.frontmatter.scenarios[] → list of (SC_id, steps_count)

FOR EACH SC:
  IF any SC.step has UI verb (per stitch-workflow Pattern A regex) AND not referenced в MK.scenario_steps[SC_id]:
    FLAG 🔴 V-MK-01: «SC-NNN/step N has UI verb but no SI references step»

FOR EACH SI in Screen Inventory:
  IF SI.sc_step references step that не exists в SC:
    FLAG 🔴 V-MK-01: «SI-N references SC-NNN/step <X> которого нет в SC body»
```

### V-MK-02 mechanical (partial per Q3/C5)

```
PARSE MK Component State Matrix sections
FOR EACH component с is_interactive=true (per component-states.md detection):
  IF default state missing AND not N/A:
    FLAG 🔴 V-MK-02: «Component <name> missing required default state»
  IF error state missing AND component linked к any BR-* (via row's «Related» column matching BR pattern) AND not N/A:
    FLAG 🟡 V-MK-02: «Component <name> linked к BR-NNN but no error state defined»
```

### V-MK-03 manual

```
SURFACE checklist (not automated):
  «V-MK-03 manual review checklist:
    BR-XXX (statement summary) — error state present в MK? [yes/no]
    ...
  Run via component-states.md if not already done.

Options:
  [1] Confirmed all (or no BR with UI applicability)
  [2] Defer — log warning к pending validation queue
  [3] Found gaps — list, return к D.3 для fixes»
```

Tracks completion в session state (`<FM-id>-progress.yaml.v_mk_03_status: confirmed | deferred | gaps`).

### V-MK-04: LC states mechanical

```
LOAD all LC linked в FM.lifecycles[]
FOR EACH LC.transitions matching disabled / archived / hidden / locked / frozen:
  CHECK MK Component State Matrix мentions corresponding state (e.g., LC «archived» → component `archived` или `hidden` variant)
  IF missing:
    FLAG 🟡 V-MK-04: «LC-NNN transition к <state> not reflected в MK Component State Matrix»
```

### V-MK-05: Accessibility baseline mechanical

```
PARSE MK.body Accessibility Notes section
REQUIRED markers (case-insensitive substring):
  - «tab order» OR «keyboard»
  - «aria-» OR «screen reader» OR «assistive»
  - «contrast» (may be auto-checked v1.1)
  - «touch target» (mobile/responsive only)

FOR EACH missing marker:
  FLAG 🟡 V-MK-05: «Accessibility Notes section missing «<marker>» — likely incomplete»
```

### V-MK-06: RPM role visibility

```
LOAD RPM excerpt — roles + their entry points
FOR EACH SI in Screen Inventory:
  PARSE «Purpose» column для role references
  CROSS-REF RPM.role.<role>.entry_points
  IF SI references role не в RPM:
    FLAG 🟡 V-MK-06: «SI-N references role <role> not в RPM»

FOR EACH RPM role с UI entry points:
  IF no SI references role:
    FLAG 🔵 V-MK-06 (info): «RPM role <role> has UI entry point but no SI explicitly references»
```

### V-MK-07: Responsive breakpoints

```
IF MK.frontmatter.platform IN {responsive, mobile}:
  IF MK.body не contains «Responsive Notes» section:
    FLAG 🔴 V-MK-07: «platform=<responsive|mobile> but Responsive Notes section missing»
  IF section exists но не mentions breakpoints (no px / em / rem patterns):
    FLAG 🟡 V-MK-07: «Responsive Notes present but no breakpoint values documented»
```

### V-MK-08: DS token coverage (regex-based)

```
REGEX TOKEN_PATTERN = /DS\.(\w+)\.(\w+(?:-\w+)*)/g
LOAD DS body → resolved tokens map (key: DS.color.primary; value: source line)

SCAN MK body:
  FOR EACH match TOKEN_PATTERN:
    IF не в resolved tokens map:
      FLAG 🔴 V-MK-08: «MK references unknown token <DS.x.y> — add к DS or rename»

ADDITIONALLY scan MK body для bare hex colors / pixel values:
  REGEX BARE_HEX = /#[0-9a-fA-F]{3,8}\b/
  REGEX BARE_PX = /\b\d+px\b/
  IF match outside code blocks:
    FLAG 🟡 V-MK-08: «MK uses hardcoded <hex|px> value — consider using DS token»
```

## Findings surface

After full run:

```
Design validation findings for MK-NNN:
  🔴 Blocking (must address):
    • V-MK-01: SC-001/step 4 has UI verb «click» but no SI references step
    • V-MK-08: MK uses unknown token DS.color.brand-blue — add к DS or rename
  🟡 Warning (recommend address):
    • V-MK-02: Component «PrimaryButton» linked к BR-013 but no error state defined
    • V-MK-05: Accessibility Notes missing «touch target» (mobile platform)
    • V-MK-08: MK uses hardcoded «16px» — consider using DS.spacing.md
  🔵 Info:
    • V-MK-06: RPM role «R-freelancer» has UI entry but no SI explicit ref

V-MK-03 manual: <confirmed | deferred | gaps>

Options:
  [1] Address blocking inline (iterate D.5 fixes)
  [2] Acknowledge warnings, proceed к D.5 approve (warnings logged to MK Design Decisions)
  [3] Defer all к pending validation queue, proceed (НЕ recommended если blocking)

Silence ≠ continue.
```

## D2 overrides (per validation.md §9 — D2 modification)

If MK frontmatter contains `validation_overrides:` или `approve_overrides:` — entries skip surface (logged как `overridden` в `.product/.pending/validation-pending.yaml`). Same protocol as `hooks/product/artifact-validate.js` (sub-phase G design-artifact-validate.js inherits pattern).

## Integration с hook design-artifact-validate.js

Hook (sub-phase G, Q8 closure):
- Runs PostToolUse on `.product/mockups/**/*.md` + `.product/design-system.md`
- Subset of V-MK-* (light checks: YAML parse, 5 required fields, ref existence, V-MK-08 regex)
- Quiet-draft mode (B2 / SPEC §B2): status=draft → queue findings, no surface; status=non-draft → exit 1 (block)

This skill = full V-MK-* runner для D.5 + export. Hook = continuous lightweight check on save. Together: hook catches drift mid-session; skill enforces final invariants at approve gates.

## Anti-patterns

1. **Bypassing V-MK-08 — hardcoded colors / sizes.** Always use DS tokens. Bare hex / px — flag as Warning; user must justify в Design Decisions Log if accepted.

2. **Skipping V-MK-03 manual без logging deferred.** Manual check is allowed defer (with pending warning), but silently skipping = anti-pattern.

3. **D2 overrides without rationale.** Validation_overrides / approve_overrides MUST include `reason` field — audit requirement.

4. **Treating all warnings as «can ignore».** 🟡 findings inform; if accepted without action → log в MK Design Decisions Log с rationale.

5. **Re-running validation many times in single session.** Costly if MK large. Skill caches read'ы; orchestrator should invoke только at D.5 approve OR export verify.

## Failure modes

| Failure | Recovery |
|---|---|
| DS empty (first MK) | V-MK-08 yields все tokens unknown — handled специально: skip V-MK-08 если token_count=0; surface info note вместо findings flood |
| MK frontmatter malformed | Fail to parse → return immediate 🔴 «Cannot parse MK frontmatter; manual fix required» |
| Linked SC/BR/LC missing (deleted post-MK) | Surface 🔴 cross-ref errors; suggest re-link or remove from MK.scenarios[] |
| Regex false positive (`DS.color.primary` in code block code comment) | v1.0: surfaces flag; user can dismiss via approve_override |
| All findings overridden | Surface confirmation: «All findings overridden — proceeding». Не block; D2 modification semantics. |

## Related

- Validation catalog: `.claude/docs/pmo/validation.md` V-MK-01..V-MK-08
- Sibling skills: `component-states.md` (D.4 — V-MK-02/03 partial), `design-system-rules.md` (D.5 — DS extraction)
- Hook companion: `hooks/design/design-artifact-validate.js` (sub-phase G — lightweight continuous check)
- Parent skill: `design-session.md` D.5 step
- Related D2 override pattern: `hooks/product/artifact-validate.js` (existing — same override semantics)
