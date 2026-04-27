---
description: Start P2 Feature Definition. Enrichment mode (FM-id) или creation mode ("idea"). Produces SC, BR, LC, VC, IC + RPM update. Triggers adaptive-depth DA via hooks.
argument-hint: "<FM-id> | \"<idea description>\" | --continue [<FM-id>]"
---

# /product:feature

User invoked: `/product:feature $ARGUMENTS`

## Process

This command orchestrates **P2 Feature Definition** per `.claude/docs/pmo/processes.md §3.2`. Load skill `.claude/skills/product/feature-session.md` as primary orchestrator.

### Step 1: Parse arguments + detect mode

Parse `$ARGUMENTS`:

- **`--continue [<FM-id>]`** — resume mode
  - If `<FM-id>` specified: read `.product/.sessions/feature-<FM-id>-progress.yaml`, resume
  - If no FM-id: read `.product/.sessions/current.yaml`, get last_touched feature_id, resume that
  - If multiple in-progress sessions: list options, ask user

- **`<FM-id>` matches `^FM-\d{3}$` pattern** (e.g., `FM-001`, `FM-042`) → **enrichment mode (P2.A)**
  - Verify `.product/features/FM-<NNN>-*.md` exists
  - Verify FM.status = `planned`
  - Pass mode=enrichment + feature_id=FM-NNN к skill

- **Quoted string `"<text>"`** → **creation mode (P2.B)**
  - Pass mode=creation + idea_text=<text> к skill

- **Empty / invalid** → show usage:
  ```
  Usage:
    /product:feature FM-001              # enrich existing skeleton (P2.A)
    /product:feature "идея новой фичи"   # create new feature (P2.B)
    /product:feature --continue          # resume last touched
    /product:feature --continue FM-001   # resume specific FM
  ```

### Step 2: Check prerequisites

**Enrichment mode:**
- `<FM-id>.md` exists в `.product/features/`
- FM.status = `planned`
- All FM skeleton fields filled (per FM.md spec phase 1: Why/What/Priority rationale/Success metric in body; segment/jtbd/hypotheses/value_proposition/release/has_ui/success_metric in frontmatter)

If FM не exists — list available planned FMs:
```
FM-<NNN> not found. Available planned FMs:
  - FM-001 (<title>) — release RL-001
  - FM-002 (<title>) — release RL-001
  - ...
```

If FM.status != planned:
- `in-progress` — surface: «FM-<NNN> already enriched (in-progress). Use /product:cascade if specific changes needed, или /product:status для overview.»
- `shipped` — surface: «FM-<NNN> shipped. Cannot re-enrich after shipped.»
- `deprecated` — surface: «FM-<NNN> deprecated. No enrichment.»

**Creation mode:**
- ≥1 SEG active в `.product/segments/`
- ≥1 VP active в `.product/value-propositions/`
- ≥1 HYP в testing в `.product/hypotheses/`

If missing — surface:
```
Discovery prereq missing для creation mode.
Required active artifacts: ≥1 SEG, ≥1 VP, ≥1 HYP testing.
Run /product:init first для Discovery setup.
```

### Step 3: Mode-specific dialogue

**Enrichment mode:** proceed directly к Step 3b initialize state.

**Creation mode:** orchestrator skill F.0 dialogue starts here (idea parsing). See feature-session.md Flow §F.0.

### Step 3b: Initialize session state files (per DEC-DEV-0009 + DEC-DEV-0013 #1)

**Enrichment mode (FM-id known):**

`.product/.sessions/current.yaml` — pre-set type:
```yaml
session_id: "<ISO-timestamp>-feature-FM-<NNN>"
type: feature-session
feature_id: FM-<NNN>
started_at: "<ISO timestamp>"
```

`.product/.sessions/feature-FM-<NNN>-progress.yaml` — initial state (per-FM file per DEC-DEV-0013 #1):
```yaml
session_id: "<same as current.yaml>"
type: feature-session
feature_id: FM-<NNN>
mode: enrichment
started_at: "<ISO>"
project: "<from product.yaml>"
language: "<from product.yaml>"

current_step: F.1
last_completed_step: null
last_approved_artifacts: []
pending_da_findings: []
pending_cascade_entries: 0
bg_candidates_queued: 0

next_steps:
  - F.1 Load FM context

progress_percent: 0
```

**Creation mode (FM-id unknown until F.0b):**

Init `current.yaml` без feature_id (assigned later в F.0b):
```yaml
session_id: "<ISO-timestamp>-feature-creation"
type: feature-session
started_at: "<ISO timestamp>"
```

`feature-progress.yaml` — temp file `feature-creating-progress.yaml`; renamed to `feature-FM-<NNN>-progress.yaml` after F.0b skeleton creation:
```yaml
session_id: "<same>"
type: feature-session
mode: creation
started_at: "<ISO>"
project: "<...>"
language: "<...>"

idea_text: "<user's idea description>"

current_step: F.0
last_completed_step: null
# ... empty arrays

next_steps:
  - F.0 Idea parsing
  - F.0a D1-alignment check
  - F.0b FM skeleton creation
  - then F.1 onwards

progress_percent: 0
```

**`--continue` mode:** read existing files; resume с `current_step`.

### Step 4: Delegate to feature-session skill

Load `.claude/skills/product/feature-session.md`. It handles:
- F.0/F.0a/F.0b (creation mode only)
- F.1 Load FM context
- F.2 Scenario authoring (delegates → scenario-authoring.md)
- F.3 Business rule extraction (delegates → business-rule-extraction.md)
- F.4 Lifecycle derivation (delegates → lifecycle-derivation.md, A1 eligible)
- F.5 Invariant discovery (delegates → invariant-discovery.md)
- F.5a NFR placeholder (Phase 4)
- F.6 VC derivation (delegates → vc-derivation.md, A1 eligible)
- F.7 RPM derivation (delegates → rpm-derivation.md, A1 eligible)
- F.8 Design placeholder (Phase 6)
- F.9 FM-level DA placeholder (Phase 4)
- F.10 FM status transition planned → in-progress

**Cross-cutting orchestration handled by skill:**
- A1 auto-approve flow для 🟢 LC/VC/RPM (per DEC-DEV-0013 #7)
- DA orchestration via stderr signal от br/ic-change-trigger.js hooks → spawns devils-advocate subagent с Mode: adaptive (per DEC-DEV-0013 #8)
- Cascade handling via cascade-check.js hook → cascade-pending.yaml entries → user prompts
- Per-artifact decision journal entries в `.product/.decisions/journal.md`

### Step 5: Session state (auto-managed)

`session-state.js` hook auto-snapshots progress to `.product/.sessions/current.yaml` на каждый Write/Edit. Orchestrator skill maintains `feature-<FM-id>-progress.yaml` для resume через `--continue`.

### Step 6: Completion

When F.10 complete (all blocking conditions met, FM transitioned planned → in-progress):
- feature-<FM-id>-progress.yaml.current_step = `complete`
- Summary report (см. feature-session.md F.10 §Completion summary)

## Important constraints

- **Mode strictly determined by argument shape.** FM-NNN pattern → enrichment; quoted text → creation; --continue → resume. No ambiguity.
- **FM.status check strict.** Enrichment only valid для status=planned. shipped/deprecated/in-progress refuse.
- **Per-FM session state.** Per DEC-DEV-0013 #1 — feature-<FM-id>-progress.yaml per FM, не singleton. Switching между FMs не overwrite.
- **A1 auto-approve trust skill.** Orchestrator surfaces notification but не second-guesses skill self-check. If A1 misfires — meta-feedback issue, не block immediately.
- **DA orchestration: Mode: adaptive only.** Hook-triggered DA always adaptive depth (single subagent invocation per DEC-DEV-0013 + refactored devils-advocate.md). Manual full mode reserved для Phase 4 /product:da-review.
- **F.5a / F.8 / F.9 placeholders.** Phase 4 / Phase 6 work — surface skip notification, не attempt inline implementation. Discipline against scope creep.
- **Confidence articulation** (C2) — at every non-auto approve gate.

## Error handling

| Error | Action |
|---|---|
| `<FM-id>` not found | List available planned FMs |
| FM.status != planned | Refuse, suggest alternative command (cascade/status) |
| Discovery prereq missing (creation) | Refuse, suggest /product:init |
| F.0a no SEG match (creation) | Offer create new SEG (out-of-scope), exploratory FM, or cancel |
| Subagent invocation fails (DA) | Surface error, offer manual continue or retry |
| Hook stderr unparseable | Log + continue без auto-DA; warn user про manual review |
| User rejects DA findings без resolution | Block approve, require explicit per-finding action |
| feature-FM-NNN-progress.yaml corrupted | Recovery options: start fresh / from last approved step |
| Session interrupted mid-step | Save partial state; --continue FM-<NNN> resumes |

## Related

- Process: `.claude/docs/pmo/processes.md §3.2` (P2 Feature Definition)
- Skill: `.claude/skills/product/feature-session.md` (orchestrator) + delegated:
  - F.2-F.7 step skills (Phase 3.C — scenario-authoring, business-rule-extraction, lifecycle-derivation, invariant-discovery, vc-derivation, rpm-derivation)
- Subagent: `.claude/agents/product/devils-advocate.md` (adaptive-depth Mode)
- Hooks (Phase 3.E):
  - `hooks/product/br-change-trigger.js` (P-RULE-02 → DA)
  - `hooks/product/ic-change-trigger.js` (P-RULE-01 → DA)
  - `hooks/product/cascade-check.js` (cascade detection + V-11 auto-fix)
  - `hooks/product/bg-extractor.js` (BG candidates queue)
- Prereq command: `/product:plan` (creates planned FM skeletons in P1.B)
- Companion commands:
  - `/product:cascade <artifact-id>` — manual cascade navigation (Phase 3.G)
  - `/product:status` — overview dashboard
- Future commands: `/product:handoff FM-<NNN>` (Phase 4), `/product:da-review FM-<NNN>` (Phase 4)
