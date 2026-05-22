---
description: Dashboard of .product/ state — artifact counts, pending items, handoff status, recent sessions.
---

# /product:status

Display comprehensive dashboard of the Product Module's current state. Read-only.

## Process

### Step 1: Check initialization

If `.product/` doesn't exist:
```
Product Module not initialized.

Use /ecosystem:bootstrap to set up the project, or /product:init to start Discovery.
```

### Step 2: Gather state

Read:
- All `.product/**/*.md` — count per type + status
- `.product/.sessions/current.yaml` — active session (if any)
- `.product/.pending/` — pending queues (BG candidates, DA reviews, stale drafts, cascade, validation-pending)
- `.product/handoffs/*.md` — handoff files + their status
- `.product/.da-findings/*.md` — recent DA reviews (last 5)
- `.claude/product.yaml` — config (tier, mode defaults)
- `~/.claude/memory/product/` — cross-project context (if any)

### Step 3: Format output

```
═══════════════════════════════════════════════════════════
PRODUCT MODULE STATUS
═══════════════════════════════════════════════════════════

Project: <name from product.yaml>
Stage (from RM): <idea | mvp | mmp | growth | mature>
Validation tier: <pilot | mvp | full>
Default discovery mode: <quick | deep>

═══════════════════════════════════════════════════════════
ARTIFACTS (<total count>)
═══════════════════════════════════════════════════════════

D1 Discovery:
  PS    ✓ active (v<N>, updated <date>)
  MR    ✓ active (v<N>, credibility <tag>)
  CA    ✓ active (v<N>, <N> competitors)
  SEG-* <N> active (primary: SEG-001)
  VP-*  <N> active
  HYP-* <N> (<validated>/<testing>/<invalidated>/<deferred>)

D1↔D2:
  FM-*  <N> total (<planned>/<in-progress>/<shipped>/<deprecated>)
  Handoff-ready: <N>
  Stale handoffs: <N>  ← run /product:handoff --regenerate если нужно

D2-Behavioral:
  SC-*  <N> (<active>/<draft>)
  BR-*  <N> (<active>/<draft>)
  LC-*  <N>
  VC-*  <N>
  IC-*  <N>
  NFR-* <N> (per-feature: <N>, global: <N>)
  BG    <N> terms (active: <N>, draft: <N>, deprecated: <N>)
  RPM   <N> roles

D2-05 Design (if has_ui FMs exist):
  MK-*  <N> (<active>/<review>/<draft>)
  DS    <N> tokens, <N> components
  NM-*  <N>

Cross-cutting:
  NOTE-* <N> (<active>/<draft>/<promoted>/<archived>)

═══════════════════════════════════════════════════════════
PENDING (<total count>)
═══════════════════════════════════════════════════════════

  ⏳ BG candidates awaiting review: <N>     → /product:bg-review
  ⏳ DA reviews pending: <N>                → /product:da-review или wait for next approve gate
  ⏳ Cascade bundles pending approve: <N>   → /product:cascade <id>
  ⏳ Stale drafts (>14 days): <N>           → review or archive
  ⏳ Validation findings queued (B2): <N>   → surface on approve

═══════════════════════════════════════════════════════════
ACTIVE SESSION
═══════════════════════════════════════════════════════════

  Type: <discovery | planning | feature | design | da | none>
  Process: <P1.A | P1.B | P2.A | P2.5>
  Current step: <F.3 | D1.4 | ...>
  Started: <timestamp>
  Duration so far: <h:m>
  FM/artifact: <FM-003 | — >

  Resume: /product:<command> --continue

═══════════════════════════════════════════════════════════
RECENT DA FINDINGS (last 5)
═══════════════════════════════════════════════════════════

  <artifact-id> — <date>
    🔴 Critical: <N> | 🟡 Important: <N> | 🔵 Discussion: <N>
    Actioned: <N> | Deferred: <N> | Dismissed: <N>

═══════════════════════════════════════════════════════════
INTEGRATIONS
═══════════════════════════════════════════════════════════

  Integrator:   <N> active tools    → /integrator:status
  Design Module: <active | conditional>
```

### Step 4: Suggest next actions

Based on state, surface 2-3 most actionable next steps:

```
Suggested next:
  → Resume current session: /product:feature --continue (P2.A F.3 on FM-003)
  → Review 3 pending BG candidates: /product:bg-review
  → Regenerate 2 stale handoffs: /product:handoff <FM-id> --regenerate
```

If nothing meaningful pending:
```
Ecosystem healthy. Options:
  → /product:feature <FM-id>    — enrich next FM skeleton
  → /product:drift-check         — structural self-audit
  → /product:patterns            — scan for anti-patterns
```

## Important constraints

- **READ-ONLY.** Never modify `.product/`.
- **Be concise.** Don't pad with low-signal detail. If there's only 1 FM, don't show 20 zero-counts.
- **Confidence honest.** If state is unclear (e.g., corrupted session file), say so.
- **Performance:** this command runs frequently — keep under 2 seconds.
