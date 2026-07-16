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

### Step 2: Deterministic collect — SSOT for every count (DEC-DEV-0217)

Run the collector:

```bash
node .claude/hooks/product/lib/status-collector.cjs --root . --json
```

One JSON payload carries everything countable:
- artifact census per type + per-status breakdown (+ NFR per-feature/global split);
- singletons with their metric fields (RPM `roles_count`, DS `token_count`/`component_count`, BG `term_sections` — approximate, glossary terms carry no per-term status);
- handoffs (status, version, generated_at) **+ staleness verdicts** — the collector reuses the Integrator G22 lib (`handoff-staleness.cjs`, hash recompute), always **without** `--write`;
- pending queues with entry counts **+ ghost-check**: each queue entry whose referenced artifact does not exist on disk is flagged `ghost: true` (hooks can leave queue entries behind when artifacts were created on an isolated ref / worktree and never landed);
- session snapshot (`.sessions/current.yaml` fields verbatim + `last_artifact_exists`);
- DA findings inventory (`total`, `latest5` filenames);
- stale drafts (>14 days);
- integrations: Integrator `tools_count` (`.claude/integrator/active-tools.yaml`), Pending-Actions totals (`.claude/pending-actions.md`).

**Every number in the dashboard MUST come from this output.** Do not re-count files or queue entries manually — LLM re-counting is exactly the drift source this collector removes.

**Fallback (collector missing or throws):** print `⚠ collector unavailable — degraded manual mode`, gather what you can by reading `.product/` directly, and mark every count as approximate. Do not fabricate collector-only fields (staleness, ghost-check) — absence of evidence ≠ evidence of absence.

### Step 2b: Targeted context reads (judgment, not counts)

- The 1-2 most recent DA findings files named in `da_findings.latest5` — for their verdict lines.
- If `session.present` and `session.last_artifact_exists` — the artifact itself, for a useful resume hint.
- `~/.claude/memory/product/` — cross-project context (if any).
- Optional, if Orchestrator is installed: `node .claude/orchestrator/lib/fabric-engine.cjs status --root .` (read-only) for a Fabric line.

### Step 3: Format output

```
═══════════════════════════════════════════════════════════
PRODUCT MODULE STATUS
═══════════════════════════════════════════════════════════

Project: <config.project_name> (<config.project_language>)
Validation tier: <config.validation_tier> · Discovery default: <config.default_discovery_mode>
Ecosystem: <config.ecosystem_version> · Domain fit: <config.domain_fit.subcategory> <verdict> (<score>/<threshold>)
Release focus: <RL-id> — <status>, target <target_date>
  (RM carries no `stage` field; if you infer a stage from RM/RL content, mark it as inference)

═══════════════════════════════════════════════════════════
ARTIFACTS (<artifacts.total_typed>)
═══════════════════════════════════════════════════════════

D1 Discovery:
  PS / MR / CA          ✓ active (v<N> each, from singletons)
  SEG-* <N>   VP-* <N>
  HYP-* <N> (<validated>/<testing>/<invalidated>/<deferred>)

D1↔D2:
  FM-*  <N> total (<planned>/<in-progress>/<shipped>/<deprecated>)
  Handoffs <N> — ready: <list> / partial: <list>
  Stale handoffs: <N from handoffs.staleness>   ← /product:handoff <FM> --regenerate
    (staleness.available=false → print "staleness check unavailable", never guess)
  RL-*  <N>

D2-Behavioral:
  SC-*  <N>    BR-*  <N>    LC-* <N>
  VC-*  <N>    IC-*  <N>
  NFR-* <N> (per-feature: <N>, global: <N>)
  BG    ✓ active (v<N>, ~<term_sections> term sections)
  RPM   <roles_count> roles

D2-B04 Design (if has_ui FMs exist):
  MK-*  <N> (<by status>)    NM-* <N>
  DS    <token_count> tokens, <component_count> components

Cross-cutting:
  NOTE-* <N> (<active>/<draft>/<promoted>/<archived>)

═══════════════════════════════════════════════════════════
PENDING (<pending.total_entries> queue entries, <pending.total_ghosts> ghost)
═══════════════════════════════════════════════════════════

  ⏳ <queue>: <entries> (<ghosts> ghost)   → <next command>
  ... one line per non-empty queue ...
  ⏳ Pending Actions (PA): <total> total, statuses: <status_counts>  → /ecosystem:pending-actions
     (status_counts is line-based over `**Status:**` lines — approximate signal)

  The PENDING header total = queue entries only. PA is its own line and is
  NOT summed into the header (different lifecycle, ecosystem-wide journal).

  If total_ghosts > 0 — mandatory warning block:
  ⚠ <N> queue entries reference artifacts absent on disk: <refs>.
    Likely debris from an isolated ref / worktree run. Read them with that
    discount; suggest a cleanup pass (backup queue files, then drop ghost
    entries) as a next action.

═══════════════════════════════════════════════════════════
ACTIVE SESSION
═══════════════════════════════════════════════════════════

  Render the actual current.yaml fields: type, started_at, last_checkpoint,
  last_artifact_path, edits_since_start. The session file has NO process/step
  fields — do not invent them.
  If last_artifact_exists=false → flag the session snapshot as stale/phantom
  and advise against `--continue`.
  No session file → "none".

═══════════════════════════════════════════════════════════
RECENT DA FINDINGS (last 5)
═══════════════════════════════════════════════════════════

  One line per file in da_findings.latest5: <name> — <date> — <its own verdict
  line / counters as recorded in the file>.
  Severity vocabularies vary across findings files (🔴/🟡/🔵 batches,
  important/minor advisor reports, plain-markdown notes) — report what each
  file actually records; do not force-normalize into one scale.
  This section is mandatory whenever da_findings.total > 0.

═══════════════════════════════════════════════════════════
INTEGRATIONS
═══════════════════════════════════════════════════════════

  Integrator:   <tools_count> active tools    → /integrator:status
  Design Module: <active | conditional> (<N>/<N> FM has_ui)
  Fabric (if checked in Step 2b): <instances summary>
```

### Step 4: Suggest next actions

Based on state, surface 2-3 most actionable next steps, e.g.:

```
Suggested next:
  → Resume current session (only if session is not flagged stale)
  → Review pending BG candidates: /product:bg-review
  → Regenerate stale handoffs: /product:handoff <FM-id> --regenerate
  → Clean <N> ghost queue entries (backup first)
```

If nothing meaningful pending:
```
Ecosystem healthy. Options:
  → /product:feature <FM-id>    — enrich next FM skeleton
  → /product:drift-check         — structural self-audit
  → /product:patterns            — scan for anti-patterns
```

## Important constraints

- **READ-ONLY.** Never modify `.product/`. The collector is read-only too; the staleness check runs **without** `--write`.
- **Counts come from the collector, prose comes from you.** Interpretation, warnings and next-step judgment are yours; numbers are not.
- **Be concise.** Collapse zero rows. But never omit: RECENT DA FINDINGS when findings exist, the ghost warning when `total_ghosts > 0`, the staleness line (even as "unavailable").
- **Confidence honest.** If state is unclear (corrupted session file, unparseable queue — see collector `notes[]`), say so.
- **Performance:** the collector runs in well under 2 seconds; the full command (collector + targeted reads + rendering) typically takes ~1-2 minutes.
