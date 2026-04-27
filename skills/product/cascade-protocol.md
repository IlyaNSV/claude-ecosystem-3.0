---
description: Cascade Consistency methodology — detection + V-11 auto-fix per DEC-DEV-0012 C.4. Reference for orchestrators + cascade-check.js hook + /product:cascade command. Full BFS auto-fix beyond V-11 deferred к v1.1.
---

# Cascade Protocol — Cross-cutting Skill

Methodology for cascade consistency — when one artifact changes, downstream dependents must be re-validated. **v1 scope (per DEC-DEV-0012 C.4):** detection + V-11 (bi-dir refs) auto-fix. Full BFS auto-fix beyond V-11 + bundle approve UX → v1.1.

## Overview

**Cascade triggers** на every active artifact change (per [processes.md §3.5](../../docs/pmo/processes.md) + [validation.md §6](../../docs/pmo/validation.md)).

**Cascade flow в Phase 3:**
1. Active artifact saved (Write/Edit на `.product/**/*.md`)
2. `cascade-check.js` hook (Phase 3.E) automatically runs:
   - Identifies dependents via bi-dir refs (V-11)
   - **For V-11 specifically:** auto-fixes missing reverse refs inline (only if target в active; skip on draft per DEC-DEV-0013 #3)
   - **For all other affected:** writes pending entry к `.product/.pending/cascade-pending.yaml`
3. Orchestrator (feature-session.md, planning-session.md) reads pending after each gate
4. Surfaces к user: «Cascade detected <N> dependents requires_review. Review now? [Y/N]»
5. If [Y]: invoke `/product:cascade <artifact-id>` flow inline (Phase 3.G command)
6. If [N]: pending entries persist для manual review later via `/product:cascade --pending`

## Trigger matrix (when cascade kicks in)

Per [processes.md §4.1](../../docs/pmo/processes.md):

| Изменение upstream | Cascade scope (downstream affected) |
|---|---|
| PS active changed | ALL artifacts (pivot scenario; not handled in v1 — manual rebuild) |
| MR / CA changed | SEG, VP, HYP, possibly MVP — flagged для review |
| SEG changed | VP (1:1), FM с этим SEG, HYP, RPM |
| VP changed | FM ссылающиеся, HYP проверяющие |
| HYP changed | FM проверяющие, MVP primary_hypothesis |
| MVP changed | RM, RL, FM priorities |
| FM changed | SC, BR, LC, VC, IC, MK (все embedded), handoff (→ stale) |
| SC changed | BR (bi-dir), LC (transitions), VC (coverage), MK (screens) |
| BR changed | SC (bi-dir), LC (guards), IC (support), VC (rules verified), DA review (P-RULE-02 — separate hook) |
| LC changed | SC (transitions), VC (transitions), IC (entity) |
| IC changed | BR (support), LC (respect), DA review (P-RULE-01 — separate hook) |
| MK changed | DS (tokens extraction — Phase 6), NM (screens), handoff (→ stale) |
| DS changed | ALL MK using token (Phase 6) |
| BG term renamed | ALL artifacts using term (mass-rename flow — separate /product:bg:rename) |

## V-11 auto-fix (the only auto-fix in v1)

V-11 (bi-directional references consistent) per [validation.md §5.1](../../docs/pmo/validation.md):
- If A.relates_to[] contains B → B should contain A в соответствующем reverse field
- Example: SC-005.rules[] contains BR-010 → BR-010.scenarios[] should contain SC-005

**Auto-fix logic в cascade-check.js (Phase 3.E):**

```
fn cascade_check(saved_artifact):
    dependents = identify_dependents(saved_artifact)
    
    for dependent in dependents:
        # V-11 check
        if v11_broken(saved_artifact, dependent):
            if dependent.status == "active":
                # Auto-fix: add reverse ref to dependent
                add_reverse_ref(dependent, saved_artifact)
                log_to_pending(dependent.id, rule="V-11", action="auto-fixed", at=now)
            elif dependent.status == "draft":
                # Skip auto-fix on draft (B2 quiet-draft mode per DEC-DEV-0013 #3)
                queue_pending(dependent.id, rule="V-11", action="needs_manual_fix", at=now)
        
        # All other validations — queue, не auto-fix
        for rule in applicable_rules(dependent):
            if rule != "V-11" and not rule_passes(saved_artifact, dependent, rule):
                queue_pending(dependent.id, rule=rule, action="needs_review", at=now)
```

**Auto-fix output format в `cascade-pending.yaml`:**

```yaml
# Cascade detection results (managed by cascade-check.js)
# Auto-applied + pending entries

entries:
  - artifact: BR-010
    file: .product/business-rules/BR-010-email-linking.md
    triggered_by: SC-005 (active write)
    rule: V-11
    action: auto-fixed
    detail: "Added SC-005 to BR-010.scenarios[] (was missing reverse ref)"
    at: <ISO timestamp>

  - artifact: LC-002
    file: .product/lifecycles/LC-002-revision.md
    triggered_by: BR-010 (active write)
    rule: V-06
    action: needs_review
    detail: "BR-010 в LC-002.guards; recheck transition guards still consistent"
    at: <ISO>

  - artifact: IC-003
    file: .product/invariants/IC-003-revision-integrity.md
    triggered_by: BR-010 (active write)
    rule: P-RULE-01
    action: needs_da_review
    detail: "BR-010 в IC-003.rules[]; supporting BR changed, re-verify IC support"
    at: <ISO>
  # ...
```

## Bundle approve UX (deferred v1.1)

Per DEC-DEV-0012 C.4 — bundle approve UX откладывается v1.1 (с full BFS auto-fix expansion).

**v1 fallback:** orchestrator surfaces summary, user reviews per-entry via `/product:cascade <artifact-id>` (Phase 3.G command) или `/product:cascade --pending` для batch review.

**Example surface к user:**

```
Cascade detected from BR-010 (active write):
  ✓ V-11 auto-fixed: SC-005.rules[] reverse ref added
  ⚠ V-06 review: LC-002 transitions affected (3 transitions reference BR-010)
  ⚠ P-RULE-01: IC-003 supporting BR changed → DA review pending (separate flow)
  ⚠ Status update: FM-003 → requires_review

Pending: 3 entries в .product/.pending/cascade-pending.yaml
Review now? [Y] (invoke /product:cascade BR-010) [N] (continue, review later)
```

## Quiet draft mode (B2 + DEC-DEV-0013 #3)

If saved artifact или target dependent has `status: draft`:
- Skip auto-fix (V-11 included)
- Queue pending entries только
- Surfacing happens на: draft → active transition (approve gate), `/product:status`, explicit `/product:validate`

**Rationale:** drafts may be в-progress; auto-fixing inline disrupts authoring workflow. Per [validation.md §3.1.1](../../docs/pmo/validation.md).

**Configuration:** `.claude/product.yaml.draft_mode_quiet_hooks: true` (default).

## Manual cascade navigation (Phase 3.G command)

`/product:cascade <artifact-id>` flow:

1. Read `.product/.pending/cascade-pending.yaml` filtered by `triggered_by == <artifact-id>`
2. Group entries by dependent artifact
3. Per dependent:
   - Show what changed
   - Show what rule needs review
   - Action options: re-validate / re-approve / dismiss с rationale
4. After all entries resolved для that artifact-id → remove entries from pending file

`/product:cascade --pending` flow:

1. Read all pending entries
2. Group by triggered_by source
3. Show summary: «<N> sources с pending cascades, <M> total entries»
4. Per source — option to invoke `/product:cascade <id>` or skip

## Cascade priority (per validation.md §6.2)

When cascade involves multiple dependents — process in priority order:

1. **Critical (🔴):** BR, IC — first
2. **Strategic (🟠):** PS, SEG, VP, HYP, MVP, FM, SC, MK
3. **Standard (🟡):** MR, CA, RL, RM, BG, DS
4. **Confirmation (🟢):** LC, RPM, VC, NM (derived)

Rationale: critical first — там consequences дороже.

## Cascade vs DA orchestration distinction

**Cascade (this skill):**
- Structural/consistency check (refs, references, status alignment)
- V-11 auto-fix in v1
- Other rules → pending entries, manual review
- Hook: `cascade-check.js` (Phase 3.E)

**DA orchestration (separate flow per DEC-DEV-0013 #8):**
- Semantic adversarial review (6 lenses or quick consistency check)
- Triggered by BR/IC active write specifically
- Hooks: `br-change-trigger.js`, `ic-change-trigger.js` (Phase 3.E)
- Subagent: `product-devils-advocate` (Mode: adaptive)

These can co-occur — BR active write triggers BOTH cascade-check.js (structural) AND br-change-trigger.js (semantic DA). Each writes к separate pending file (`cascade-pending.yaml` vs `da-pending.yaml`).

## Anti-patterns

1. **V-11 auto-fix on draft target.** Violates B2 quiet-draft mode per DEC-DEV-0013 #3. Skip auto-fix; queue only.
2. **Bundle approve UX в Phase 3.** Deferred v1.1. Phase 3 — manual per-artifact resolution via /product:cascade.
3. **Full BFS auto-fix beyond V-11.** Deferred v1.1 (per DEC-DEV-0012 C.4 + dev/v1_1_backlog.md). Phase 3 detection-only для non-V-11 rules.
4. **Pivot cascade при PS change.** Out-of-scope v1 — manual rebuild required (per processes.md §3.6 Q-11).
5. **Skipping cascade trigger.** Hook должен auto-run на every Write/Edit; if не runs (e.g., manifest gap) → cascade silently broken. Verify via /product:status + integration tests (Phase 4 validation runner).
6. **Manual edit cascade-pending.yaml.** Owned by cascade-check.js hook + cascade command. Manual edits cause drift. Use commands for all changes.
7. **Mixing cascade с DA findings file.** `.product/.pending/cascade-pending.yaml` ≠ `.product/.pending/da-pending.yaml`. Different concerns, different consumers.

## Implementation notes для Phase 3.E hook

`cascade-check.js` PostToolUse hook должен:

1. **Filter:** only `.product/**/*.md`, exclude `.sessions/`, `.pending/`, `.decisions/`, `.da-findings/`, `.bg-rejected.yaml`
2. **Parse frontmatter** (basic YAML reading — same pattern as artifact-validate.js)
3. **Skip if status != active** (per quiet-draft mode unless explicit override)
4. **Identify dependents** through known relationships (FM ↔ SC/BR/LC/VC/IC/MK; SC ↔ BR/VC; etc. — per [processes.md §4.1 trigger matrix](../../docs/pmo/processes.md))
5. **For each dependent:**
   - V-11 check + auto-fix if applicable
   - Other rule checks (V-08 terminology, V-04 SC→FM ref, etc.) — queue only
6. **Append entries к cascade-pending.yaml** (atomic — read-modify-write per DEC-DEV-0010 lesson)
7. **Stderr signal** if entries added: «Cascade: <N> entries pending; review via /product:cascade --pending»
8. **Exit 0 always** (non-blocking per Phase 2 hook design)

**Performance target:** <200ms per invocation (typical 5-10 dependents).

**File path filtering** (per DEC-DEV-0013 #6 — internal, not Claude Code matcher):

```javascript
// Skip non-relevant artifact paths
if (!normalized.match(/\.product\/(features|scenarios|business-rules|lifecycles|verification|invariants|segments|value-propositions|hypotheses|releases|nfr|mockups|notes|rpm\.md|mvp-scope\.md|roadmap\.md|problem\.md|market-research\.md|competitive-analysis\.md|glossary\.md|design-system\.md)/)) {
    process.exit(0);
}
```

## Confidence calibration

This is methodology document, не artifact creating skill — confidence не applies к skill output directly. Confidence для individual cascade entries reflected в pending file's `confidence` field (если added).

## Examples

**Cascade triggered by BR-010 active write:**

```yaml
# .product/.pending/cascade-pending.yaml после BR-010 saved (active)

entries:
  - artifact: SC-005
    triggered_by: BR-010
    rule: V-11
    action: auto-fixed
    detail: "Added BR-010 к SC-005.rules[] (reverse ref)"
    at: 2026-04-26T15:30:12Z

  - artifact: LC-002
    triggered_by: BR-010
    rule: V-06
    action: needs_review
    detail: "BR-010 referenced в LC-002.guards (transition reviewed → processed); re-validate guard logic"
    at: 2026-04-26T15:30:12Z

  - artifact: VC-005
    triggered_by: BR-010
    rule: V-07
    action: needs_review
    detail: "VC-005.rules[] includes BR-010; verify Then assertions still match BR statement"
    at: 2026-04-26T15:30:12Z

  - artifact: FM-003
    triggered_by: BR-010
    rule: status_alignment
    action: needs_status_update
    detail: "FM-003.rules[] includes BR-010; FM should transition к requires_review"
    at: 2026-04-26T15:30:12Z
```

**Orchestrator surface к user:**

```
BR-010 activated. Cascade detected:
  ✓ V-11 auto-fixed: SC-005.rules[] reverse ref added
  ⚠ 3 entries needs_review (LC-002, VC-005, FM-003) — see /product:cascade --pending
```

## Related

- Hook: [`hooks/product/cascade-check.js`](../../hooks/product/cascade-check.js) (Phase 3.E — implements detection + V-11 auto-fix)
- DA-related hooks: [`br-change-trigger.js`](../../hooks/product/br-change-trigger.js), [`ic-change-trigger.js`](../../hooks/product/ic-change-trigger.js) (Phase 3.E — separate concern, semantic review)
- Command: [`commands/product/cascade.md`](../../commands/product/cascade.md) (Phase 3.G — manual nav)
- Orchestrators: planning-session.md, feature-session.md (Phase 3.A + 3.B — read pending после approve gates)
- Process: [docs/pmo/processes.md §3.5 P4 Cascade Consistency](../../docs/pmo/processes.md), §4
- Validation: [docs/pmo/validation.md §6 Cascade Protocol](../../docs/pmo/validation.md), V-11 §5.1
- Future v1.1: full BFS auto-fix per [dev/v1_1_backlog.md «Full BFS cascade»](../../dev/v1_1_backlog.md)
