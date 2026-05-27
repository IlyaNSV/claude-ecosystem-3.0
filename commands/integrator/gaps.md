---
description: Show uncovered PMO zones with criticality assessment. Read-only.
---

# /integrator:gaps

Identify PMO zones not currently covered by any active tool.

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js`. Cleanup at Final step.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:gaps","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Determine "needed" zones

Read `.product/features/` and `.product/releases/` to understand what the user is actually building:

- If features are has_ui=true → D2-B04 needed
- If features have backend → D3 needed
- If features have NFR with reliability targets → D4 + D5 needed
- D2-Technical is needed for any feature that ships through external implementation tool

Result: list of PMO zones the project actually needs (vs theoretical full coverage).

If `.product/` is empty (no FMs yet) — user is still in Discovery. Display:
```
No features defined yet. Gaps analysis is most useful after /product:plan
when FM skeletons exist.

Currently providing theoretical gaps based on full PMO map.
```

### Step 2: Compare with active tools

Read `.claude/integrator/active-tools.yaml` and `pmo-mapping.yaml`. Compute set difference:

```
Needed zones - Covered zones = Gaps
```

### Step 3: Assess criticality

For each gap, determine:
- **🔴 Critical** — blocks shipping (no implementation tool when needs implementation)
- **🟠 Important** — needed soon (no QA tool when about to ship beta)
- **🟡 Nice-to-have** — can defer (monitoring before MVP)
- **⏸️ Out of scope** — explicitly deferred (mark with reason)

Criticality based on:
- Project stage (RM phase: pilot/MVP/MMP/growth)
- Current FM count and status (1 FM in-progress vs 5 FM in-progress)
- User's explicit deferral notes (in journal)

### Step 4: Format output

```
PMO Gaps Analysis
═══════════════════

Project: <name>
Stage: <pilot | mvp | mmp | growth>
Active features: <count>
Validation tier: <pilot | mvp | full>

🔴 CRITICAL GAPS (<count>)
  D2-T01 (Architecture Design): no spec-gen tool installed
    → /integrator:research "spec generation tool for this stack"
  D3-01 (Implementation): no implementation tool
    → /integrator:research "implementation tool that consumes spec-* output"

🟠 IMPORTANT (<count>)
  D4 (QA): no testing tool
    → Defer until at least one FM ships? Or set up early?

🟡 NICE-TO-HAVE (<count>)
  D5 (Operations): no monitoring
    → Out of scope for MVP per project tier 'pilot'

⏸️ OUT OF SCOPE (<count>)
  D5 monitoring: deferred until MMP phase (DEC-INT-XXX)
  P3 Feedback Integration: out of scope v1 (DEC-P08)
```

### Step 5: Recommendations

Based on critical gaps:

```
Recommended actions (in order):
  1. Address critical gap D2-T01 first — without spec-gen, you can't ship FM-XXX
  2. Then D3-01 implementation
  3. D4 QA can wait until at least one FM is shipped

Quick start: /integrator:research "spec-gen tool"
```

### Final: Cleanup session marker

```bash
rm -f .claude/integrator/.session-context.json
```

## Important constraints

- **READ-ONLY.** Never modify files.
- **Criticality is project-context-aware.** A "critical gap" for one project is "premature optimization" for another. Read `.product/` before assessing.
- **Don't pad the list.** If there are no critical gaps, say "No critical gaps. Project tooling adequate for current scope." Don't invent gaps to look thorough.
- **Express confidence (C2):** if gap analysis depends on incomplete `.product/` or stale `pmo-mapping.yaml`, say so.
