---
description: F.5a NFR Review для FM. Two phases — Ask (mandatory) + Define (conditional on [Y]). Sanity range warnings (per NFR.md §5). Consumes NOTE-NNN с promote_target=NFR queue. Updates FM.nfr_status atomically с FM version++.
argument-hint: "<FM-id> | --continue [<FM-id>]"
allowed-tools: Read, Glob, Grep, Edit, Write
---

# /product:nfr-review

User invoked: `/product:nfr-review $ARGUMENTS`

Запускает F.5a NFR Review для FM. Loads skill `nfr-review.md`.

## Args

- `<FM-id>` — FM для review (e.g., `FM-001`); FM.status может быть `planned | in-progress`
- `--continue [<FM-id>]` — resume interrupted session; без arg uses last touched (read `.product/.sessions/current.yaml`)
- Invalid args → show usage:
  ```
  Usage:
    /product:nfr-review FM-001              # start F.5a for FM-001
    /product:nfr-review --continue          # resume last interrupted
    /product:nfr-review --continue FM-001   # resume specific FM session
  ```

## Steps

### Step 1: Parse args

Parse `$ARGUMENTS`. Detect mode (new session | continue).

### Step 2: Verify prerequisites

- `.claude/product.yaml` exists (project bootstrapped)
- `.product/features/<FM-id>.md` exists
- FM.status ∈ {planned, in-progress, shipped}

Если FM не exists — list available FMs:
```
FM-<id> not found. Available FMs:
  - FM-001 (<title>) — status: in-progress, nfr_status: pending
  - FM-002 (<title>) — status: planned, nfr_status: pending
  ...
```

### Step 3: Detect mode

- `--continue` → read `.product/.sessions/nfr-review-FM-<NNN>-progress.yaml`; if missing surface options («No active NFR session для FM-<NNN>. Start fresh? [Y/N]»)
- `<FM-id>` matches `^FM-\d{3}$` → start new session

### Step 4: Load skill

Load `.claude/skills/product/nfr-review.md` для methodology.

### Step 5: Execute per skill

1. **F.5a.0 Ask (mandatory):**
   - Consume NOTE queue с `promote_target: NFR` (skill Step 1)
   - High-risk auto-detect (skill Step 2)
   - User answers Y / N / D (skill Step 3)
   - Process answer (skill Step 4)

2. **F.5a.1 Define (conditional on [Y]):**
   - Tier auto-detection с user-facing fallback prompt (skill Step 1, Ambiguity 10)
   - Process NOTE queue → per-NFR drafts (skill Step 2)
   - Per-NFR creation flow (skill Step 3) — canonical frontmatter + body sections
   - Sanity range warning + override rationale capture (skill Step 4, DEC-DEV-0025 C.2)
   - Per-NFR approve gate (skill Step 5)
   - F.5a.1 completion update (skill Step 6)

### Step 6: Update artifacts atomically

Per skill output spec:
- `FM.frontmatter`:
  - `nfr_status: active | declined`
  - `nfr_reviewed_at: <today>`
  - If declined: `nfr_decline_reason: "<rationale>"`
  - If active: `nfr[] = [NFR-NNN, ...]`
  - `version++` atomic с status change
- Create NFR-NNN files если Define executed
- Update NOTE-NNN status если promoted (`promote_target: NFR` → `status: promoted` + `promoted_to: NFR-NNN`)

### Step 7: Decision journal entry

Append к `.product/.decisions/journal.md` entry `DEC-NFR-NNN` per skill template.

### Step 8: Surface к user

```
F.5a complete для FM-001:
  Status: active | declined
  NFRs created: [NFR-001, NFR-002]    # if active
  NFRs from NOTE queue: [NOTE-003 → NFR-001]
  Rationale: "..."                     # if declined
  Tier applied: mvp (source: RM.current_phase)
  High-risk indicators: false | true
  Sanity overrides: 1 (NFR-002 — see DEC-NFR-008 rationale)
  Decision journal: DEC-NFR-007

Next:
  /product:feature FM-001 --continue   # resume P2 enrichment к F.6
  /product:handoff FM-001              # if all F.* steps complete
```

## Anti-patterns

1. **Не пропускать Ask.** Mandatory per DEC-DEV-0028 D.2; направляется через skill методологию.

2. **Не вызывать без существующего FM.** Verify FM-id первым — иначе wasted setup work.

3. **При `--continue` без session file** — surface options («No session для FM-NNN. Start fresh? [Y/N]»), не silent fall к new session.

4. **Не emit FM frontmatter changes частями.** Atomic: status + decline_reason + nfr[] + version++ — единое write (per Ambiguity 25). Иначе intermediate states видны hooks как inconsistent.

## Related

- Skill: `.claude/skills/product/nfr-review.md`
- Catalog: `.claude/docs/pmo/artifacts/NFR.md` (canonical schema + sanity ranges §5)
- Related commands:
  - `/product:nfr-upgrade-tier` — batch при product tier change
  - `/product:feature` — orchestrator that triggers F.5a inline (Phase 4 actual call vs Phase 3 placeholder)
  - `/product:validate --rule V-16` — focused check NFR status tracking
- Hooks: `artifact-validate.js` (Phase 2) checks V-16 on FM save
