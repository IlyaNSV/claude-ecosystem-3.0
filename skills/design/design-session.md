---
description: P2.5 Design Session orchestrator (D.1-D.6). Manages design brief generation, screen iteration, component state matrix, MK/DS/NM artifact creation. Per-FM session state, hard approve gates, 7-iteration deadlock protection, Stitch quota tracking, fallback chain dispatch.
---

> **User-facing output language:** Russian (per CLAUDE.md § Language and tone). Keep identifiers, file paths, commands/flags, technical terms, abbreviations, и code blocks verbatim — не translate / не inflect them.

# Design Session — Orchestrator Skill

Used by `/design:start`. Orchestrates **P2.5 Design Session** per `.claude/docs/design-module/SPEC.md §7` (D.1-D.6).

## Prerequisites (re-verified at skill load)

- FM-id valid и `has_ui: true` (command Step 2 уже проверил; skill defensive-checks)
- ≥1 active SC для FM (или A7 3-choice menu fired в command — skill assumes context propagated)
- `.claude/design.yaml` exists (command Step 3 ensured)
- `.product/.design-sessions/` directory exists

## Session state file

`.product/.design-sessions/<FM-id>-progress.yaml` — skill-managed (analog `feature-FM-NNN-progress.yaml` pattern per DEC-DEV-0013 #1). Schema:

```yaml
session_id: "<ISO>-design-FM-<NNN>"
type: design-session
fm_id: FM-<NNN>
started_at: "<ISO>"
last_touched_at: "<ISO>"
current_step: D.1 | D.2 | D.3 | D.4 | D.5 | D.6 | complete
current_iteration: 0
design_tool: stitch | open-design | claude-design | html
tool_project_url: "<url или null>"
fallback_active: false                # true если switched к non-primary
brief_path: ".product/.design-sessions/<FM-id>-brief.md"

progress:
  completed_steps: [...]              # массив объектов {step, approved_at, notes}
  next_step: D.X

iterations_log:                       # per D.3 iteration
  - iter: 1
    classification: small | medium | large | fundamental
    changes: "<text summary>"
    tool_calls: <count>
    timestamp: <ISO>

mk_ids_drafted: [MK-NNN, ...]         # tracking drafts before final approve

deadlock_state:                       # populated only if iter ≥7
  fired_at: <ISO>
  choice: pause | radical-rethink | accept-current-as-final | drop-and-archive | <null>

pending_feedback: "<one-line или null>"

stitch_usage:
  month_count: 0
  month_count_at_date: "YYYY-MM"
  month_limit: 350
```

## Skill startup checks

**1. A4 — opportunistic >30d archived/ purge.**

```
LIST .product/.design-sessions/archived/*/
FOR EACH dir:
  PARSE timestamp from dir name
  IF (now - timestamp) > 30 days:
    DELETE dir
LOG: "Archived sessions purged: N directories >30d"
```

Run silently (single line if any). Never blocks session start.

**2. A9 — concurrent session detection.**

```
READ .product/.design-sessions/current.yaml (если exists)
IF current.fm_id == this fm_id AND current.current_step != complete:
  Surface к user:
    «Existing design session для FM-NNN detected.
     Last touched: <relative>. Current step: <step>, iteration: <iter>.
     Options:
       [1] Resume (use --continue) — load existing progress, continue работу
       [2] Force-new-overwrite — backup existing к archived/, fresh start
       [3] Abort — exit без changes»
  Silence ≠ continue.
ELSE IF current.fm_id != this fm_id AND current.current_step != complete:
  Note: «Another active design session для FM-XXX exists (different FM).
        Multiple FM design sessions can co-exist — proceeding с FM-NNN.»
  Continue.
```

**3. A5 — Stitch monthly counter rollover.**

```
READ <FM-id>-progress.yaml.stitch_usage
CURRENT_MONTH = format(now, "YYYY-MM")
IF stitch_usage.month_count_at_date != CURRENT_MONTH:
  stitch_usage.month_count = 0
  stitch_usage.month_count_at_date = CURRENT_MONTH
  LOG: "Stitch monthly counter reset (new month: ${CURRENT_MONTH})"
```

Cosmetic at session start; enforced inside D.2/D.3 dispatch (см. ниже).

**4. Tool URL liveness check (Q9 PA trigger #3) — resume path only.**

```
IF --continue AND tool_project_url != null:
  CHECK URL reachable (HEAD request если possible; skip если no WebFetch tool)
  IF 404:
    Surface:
      «tool_project_url для FM-NNN returns 404 — likely deleted в source tool.»
    Append PA entry (source=design, trigger=/design:start --continue,
      action=«Reconcile MK design state: либо restore tool project URL,
              либо run /design:migrate <MK-id> --to <chain-fallback>»,
      details=«resume blocked until URL valid or migrated»,
      blocking=«D.3 iteration cannot continue with stale URL»)
    OFFER 3-choice menu:
      [1] Run /design:migrate <MK-id> --to <fallback> (interactive — exit here, return after migrate)
      [2] Manually fix URL — exit skill; edit MK frontmatter; re-run /design:start --continue
      [3] Abort
    Silence ≠ continue.
```

## Flow

### D.1 Design Brief Generation (🟡 Review)

**Goal:** create internal design brief (not an artifact — temporary `.md` file для screen-generator input).

**Algorithm:**

1. Read FM frontmatter + body
2. Read all active SC linked to FM (frontmatter `feature: FM-NNN`)
3. Read all active BR linked (via SC.business_rules + FM.rules)
4. Read all LC linked (via FM.lifecycles + entities mentioned в SC)
5. Read BG (terminology — labels, copy)
6. Read RPM (role-based visibility)
7. Read DS если exists (existing tokens — для brand hint section)
8. Compose brief sections:
   - **Feature context** (FM title + description; success metric)
   - **Screens list** (extracted from SC steps containing UI verbs: «click», «submit», «select», «view», «toggle», «open», «close», «enter»)
   - **Roles + permissions** (RPM excerpt — кто видит что)
   - **Business rules applicable to UI** (subset of BR — те с validation/format/constraint patterns; для error states)
   - **Lifecycle states with UI representation** (LC states → component disabled/hidden/badge mappings)
   - **Brand hints** (from `.claude/design.yaml.brand_hints` + DS existing tokens snapshot если present)
9. Write к `.product/.design-sessions/<FM-id>-brief.md`
10. Save progress: `current_step: D.1`, `next_step: D.2`

**🟡 Review approve gate** — explicit, silence ≠ continue:

```
🟡 D.1 Design Brief готов для FM-NNN.

Brief saved: .product/.design-sessions/FM-NNN-brief.md
Sections:
  - Feature context: <one-liner>
  - Screens identified: N (SI-1..SI-N draft)
  - Roles: <count + names>
  - BR applicable to UI: <count>
  - LC states with UI rep: <count>
  - Brand hints: <inherited | absent>

Options:
  [1] Approve as-is — proceed to D.2 Screen Generation
  [2] Edit brief inline — opens editor (or interactive dialog), iterate D.1 после edit
  [3] Refine target — list specific section to revise (e.g., «expand BR section»), AI regenerates affected sections
  [4] Abort design — exit, return to /product:feature если SC need rework

Silence treated as «specify choice» — не proceed.
```

### D.2 Screen Generation — First Iteration (🟠 Strategic)

**v1.0 inline** per DEC-DEV-0052 Q2/C2 — не spawning subagent. Bring-forward trigger: real D.2 >5 экранов hits >50% main context (v1_1_backlog entry).

**Algorithm:**

1. Read approved brief
2. Determine `design_tool` для this session:
   - Primary: `<FM-id>-progress.yaml.design_tool` (либо `.claude/design.yaml.default_design_tool` если null)
   - Skip immediately если quota exceeded (Stitch): jump to fallback per `mcp_preferences.fallback_chain`
3. **Dispatch к tool-specific skill:**
   - `stitch` → load `stitch-workflow.md` skill (sub-phase E)
   - `open-design` → load `open-design-workflow.md` skill (CNT-004-class generator, agent-authoring Mode A — DEC-DEV-0067)
   - `claude-design` → load `claude-design-workflow.md` skill (sub-phase E — v1.0 stub per C1)
   - `html` (fallback) → load `html-fallback.md` skill (sub-phase E — v1.0 minimal per C4)
4. Tool-specific skill generates N screens; returns list of `{si_id, tool_url_or_path, description}` плюс potential issues
5. Update `<FM-id>-progress.yaml.tool_project_url` если first-time set
6. Update `stitch_usage.month_count += <calls>` (if Stitch)
7. Save progress: `current_step: D.2`, `current_iteration: 1`, `iterations_log[0] = {iter:1, classification:initial, ...}`

**🟠 Strategic approve gate** — first iteration sets direction:

```
🟠 D.2 Screen Generation — iteration 1 готов для FM-NNN.

Tool: <stitch | claude-design | html>
Screens generated: N
  SI-1: <title> — <url или path>
  SI-2: <title> — <url или path>
  ...
Issues from generator:
  • <issue if any>
  • <issue if any>

Direction check: правильно ли направление?

Options:
  [1] Approve direction — proceed to D.3 Iterative Refinement (для polish)
  [2] Request regeneration — refine brief или uplift specific screen; iterates D.2 (still iter 1, regen counter ++)
  [3] Fundamental rethink — switch back to D.1 (Brief revisions нужны)
  [4] Pivot back to Product Module — SC need rework first (exit /design:start; suggest /product:feature FM-NNN)

Silence treated as «specify choice» — не proceed.
```

### D.3 Iterative Refinement (🟠 Strategic at final)

**Goal:** iteration loop until human approves final version.

**Per-iteration algorithm:**

1. Prompt human для feedback:
   ```
   D.3 iteration <N> для FM-NNN. Tool: <tool>.
   Что хотите изменить?  (Опиши текстом или укажи аннотированные screenshots.
                          Если всё ok — «approve as final» — переход к D.4.)
   ```
2. Если user input matches «approve as final» / «final» / «ok как есть» → exit loop, jump to D.4
3. **Classify change:**
   - **small** — single tweak (color, spacing, copy on 1 screen). Tool: 1 Stitch MCP call OR 1 in-file edit (HTML).
   - **medium** — rework single screen (layout, interactions). Tool: 1-2 calls OR larger HTML edit.
   - **large** — 2+ screens rework. Tool: 2-N calls.
   - **fundamental** — design paradigm change (e.g., «list → grid», «modal → page»). Tool: trigger full D.2 rerun.
4. **Apply change:**
   - Dispatch к tool skill с classification context
   - Stitch quota check (см. ниже)
5. Increment `current_iteration += 1`
6. Append `iterations_log[]` entry: `{iter, classification, changes, tool_calls, timestamp}`
7. Show updated screens к user
8. Loop back to step 1

**Stitch quota guard:**

```
BEFORE Stitch MCP call:
  IF stitch_usage.month_count >= stitch_usage.month_limit:
    Surface к user:
      «Stitch quota exhausted: <count>/<limit> для <YYYY-MM>.»
    Append PA entry (action=«Wait next month / Switch to fallback / Upgrade Stitch plan»)
    Offer 3-choice menu:
      [1] Continue в html-fallback (single-iteration emergency unblock per Q4/C4)
      [2] Switch session permanently to fallback (update progress + .design.yaml)
      [3] Pause session (save state, exit)
    Silence ≠ continue.
```

**Q7 Deadlock protection (mandatory at iter ≥7):**

```
IF current_iteration >= 7 AND deadlock_state.choice == null:
  Surface к user:
    «🛑 D.3 deadlock guard fired для FM-NNN.
     iteration ${current_iteration} — design cycle прокрутился долго.
     Continuing без resolution может signal design ambiguity или brief gap.

     Options:
       [1] **pause + save** — exit session, save progress to .design-sessions/.
            Re-engage с свежим взглядом через /design:start FM-NNN --continue.
       [2] **radical rethink D.1** — return to brief, identify what missed;
            current screens archived в iterations_log; D.1 rebuilds.
       [3] **accept current as final** — close iteration loop at current state;
            proceed to D.4 Component State Matrix. Document «accepted at iter <N>
            after deadlock» в Design Decisions Log of resulting MK.
       [4] **drop and archive** — abandon session entirely; archive к .design-sessions/archived/.

     Silence ≠ continue — выбери [1-4].»

  WAIT for choice; save в deadlock_state.choice
  Execute chosen path:
    [1] pause: exit skill cleanly; progress saved; session resumable
    [2] radical: clear current_iteration counter; jump back to D.1
    [3] accept: set current_step = D.4; proceed
    [4] drop: move .design-sessions/<FM-id>-* → archived/<FM-id>-<timestamp>/; exit
```

Re-fires every iter after 7 если deadlock_state.choice не set (default safer для AI which would smooth-over).

**Exit condition:** user explicitly says «approve as final» (или any of `final` / `ok как есть` / accept synonyms). Then 🟠 Strategic approve gate fires:

```
🟠 D.3 Iterative Refinement final approve для FM-NNN.

Final state:
  Tool: <tool>
  Iterations: <total count>
  Screens count: <N>
  Tool calls used: <sum>

Options:
  [1] Approve final — proceed to D.4 Component State Matrix
  [2] Last-minute tweak — return to D.3 loop iter <N+1>
  [3] Pivot — D.1 brief needs revisions

Silence ≠ continue.
```

### D.4 Component State Matrix (🟢 Confirmation)

**Delegate:** load `.claude/skills/design/component-states.md` (sub-phase D).

Skill walks через each interactive component identified в Screen Inventory:
- Proposes states per checklist (default / hover / focus / error / disabled / loading / empty / overflow / skeleton)
- Mechanical patterns (V-MK-02 partial per Q3/C5): warn если interactive component (pattern matched по «click», «submit», «select», «toggle») missing `default` или `error` state
- Human confirms (per-component или batch). N/A allowed with rationale.
- Adds missing states через tool calls (per-state increment to current_iteration)

**🟢 Confirmation gate** — derived; auto-approve если all checklist items resolved (per `.claude/product.yaml.auto_approve_confirmation_artifacts.enabled`). Иначе explicit yes/no.

### D.5 Artifact Generation (🟠 Strategic — final per feature)

**Goal:** create finalized structured artifacts MK / DS / NM.

**A6 atomic write order** per DEC-DEV-0052:

1. **MK first (draft status):**
   - Construct MK frontmatter — **explicit inline template** (ВСЕ canonical поля per [MK.md artifact spec](../../docs/pmo/artifacts/MK.md); имена байт-в-байт, НЕ варьировать):

     ```yaml
     ---
     id: MK-<NNN>
     type: mockup-package
     title: "Короткое имя экрана/flow"
     feature: FM-<NNN>
     scenarios: [SC-<NNN>, ...]                      # какие SC визуализирует
     scenario_steps: {SC-<NNN>: [1, 2, 3]}           # какие шаги конкретно
     roles: [R-<role>, ...]                          # какие роли видят UI
     platform: web | mobile | responsive | desktop
     design_tool: stitch | open-design | claude-design | figma | penpot | html
     tool_project_url: "https://..."                 # ссылка на внешний макет (current tool)
     status: draft                                   # D.5 создаёт draft; →active только через 🟠 approve gate
     iteration: <total>                              # счётчик итераций из progress.yaml
     confidence: high | medium | low                 # C2 — ОБЯЗАТЕЛЬНО: артефакт в active без confidence детерминированно упрётся в hooks/product/artifact-validate.js
     confidence_notes: "string"                      # REQUIRED если confidence != high
     previous_tools: []                              # migration trail — INIT пустым; пишется ТОЛЬКО /design:migrate (Anti-pattern #3), design-session НЕ трогает
     tool_switched_at: null                          # ISO timestamp последнего switch; null пока не мигрировал
     ir_snapshot_path: null                          # populated только если design.yaml ir_export.enabled=true (v2 hook)
     created: YYYY-MM-DD
     updated: YYYY-MM-DD
     version: 1
     ---
     ```

     **Anti-pattern warnings — запрещённые соседние имена полей** (AI склонен переименовать «для естественности» — НЕ переименовывать; схема в MK.md зафиксирована, drift на уровне field names ломает tier-aware validation): `confidence` — **не** `confidence_level` / `conf`; `confidence_notes` — **не** `confidence_rationale` / `rationale` / `confidence_reasoning`; `title` — **не** `name` / `screen_name`; `tool_project_url` — **не** `url` / `project_url` / `figma_url`; migration trail — ровно `previous_tools[]` + `tool_switched_at` + `ir_snapshot_path`, **запрещены** `design_history` / `migration_notes` / `prev_tool` (MK.md Anti-patterns #4/#7). Filename slug — ASCII, per [artifacts/README.md § Slug derivation rule](../../docs/pmo/artifacts/README.md); Cyrillic в имени файла запрещён.
   - Construct body 7 sections (Screen Inventory, Component State Matrix, Interaction Spec, Responsive Notes, Accessibility Notes, Edge Cases, Design Decisions Log)
   - Write `.product/mockups/MK-NNN-<ascii-slug>.md` (per A1 — ASCII slug per Phase 2 PS drift precedent DEC-DEV-0011)
   - Hook `design-artifact-validate.js` fires PostToolUse — за `status: draft` queues findings к `.product/.pending/validation-pending.yaml` (per SPEC §B2 quiet-draft mode)

2. **DS update second** — delegate к `.claude/skills/design/design-system-rules.md`:
   - Extract tokens, components, patterns proposed from new MK
   - Existing DS entries — add usage reference (e.g., «Used in: MK-NNN»)
   - New tokens/components — propose к user (analog BG extraction); approve-batch UX
   - DS frontmatter version bump if mass-rename involved
   - Write `.product/design-system.md`

3. **NM derivation third** — auto-derived from MK Screen Inventory + LC guards + RPM entry points:
   - Construct NM frontmatter — **explicit inline template** (ВСЕ canonical поля per [NM.md artifact spec](../../docs/pmo/artifacts/NM.md); имена байт-в-байт):

     ```yaml
     ---
     id: NM-<NNN>
     type: navigation-map
     title: "Navigation: <flow name>"
     feature: FM-<NNN>
     mockups: [MK-<NNN>, MK-<NNN>, ...]              # все MK задействованные в flow
     roles: [R-<role>, ...]                          # роли, для которых flow
     status: draft                                   # D.5 создаёт draft; →active авто по 🟢 если matches A1
     confidence: high | medium | low                 # C2 — ОБЯЗАТЕЛЬНО: артефакт в active без confidence детерминированно упрётся в hooks/product/artifact-validate.js
     confidence_notes: "string"                      # REQUIRED если confidence != high
     created: YYYY-MM-DD
     updated: YYYY-MM-DD
     version: 1
     ---
     ```

     **Anti-pattern warnings — запрещённые соседние имена полей** (НЕ переименовывать «для естественности»; drift на уровне field names ломает tier-aware validation): `confidence` — **не** `confidence_level` / `conf`; `confidence_notes` — **не** `confidence_rationale` / `rationale` / `confidence_reasoning`; `title` — **не** `name` / `flow_name`; `mockups` — **не** `mk` / `screens` / `mockup_ids`. Filename slug — ASCII, per [artifacts/README.md § Slug derivation rule](../../docs/pmo/artifacts/README.md); Cyrillic в имени файла запрещён.
   - Body 4 sections (Flow Diagram via mermaid, Entry Points, Screen Transitions, Dead Ends & Error Flows)
   - Write `.product/mockups/NM-NNN-<ascii-slug>.md`
   - 🟢 Confirmation — auto-approve если matches A1 criteria

4. **Cross-validation pass:**
   - Invoke `.claude/skills/design/design-validation.md` (V-MK-01..V-MK-08 partial — V-MK-02 mechanical per C5)
   - Surface any 🔴 blocking findings; iterate fixes inline
   - V-MK-03 manual checklist в `design-validation.md` — human walks через BR↔state cross-ref

5. **🟠 Strategic approve gate** — final MK to active:

```
🟠 D.5 Artifact Generation готов для FM-NNN.

Artifacts drafted:
  MK-NNN — <title>, status: draft → about to transition active
  DS — <token_count> tokens / <component_count> components updated
       Pending DS proposals: <count> (run /design:system --review для batch approve)
  NM-NNN — <title>, status: draft → about to transition active

Validation:
  V-MK-01 (screen coverage): pass | <N findings>
  V-MK-02 (state matrix mechanical): pass | <N warnings>
  V-MK-03 (BR↔state coverage manual): <skipped — manual checklist via design-validation.md>
  ...

Options:
  [1] Approve MK active — transitions MK status draft→active; NM auto-active (🟢);
       DS proposals остаются pending до /design:system --review
  [2] Refine specific section — list MK section name, iterate D.5 fixes
  [3] Reject — rollback all drafts, return to D.3 для more iteration

Silence ≠ continue.
```

After approve:
- MK status → active
- NM status → active (auto per 🟢)
- DS pending entries сохраняются (separate approve through `/design:system --review`)
- FM frontmatter: append MK-NNN to `mockups[]` array

### D.6 Export for handoff (Q10 carry-forward — to be finalized в sub-phase G)

**Goal:** prepare UI-contract block для embed в handoff §10.

**v1.0 behavior (per Q10 carry-forward, resolved sub-phase G):**

После D.5 approve, skill:
1. Constructs export block:
   - Full MK content (per FM — все active MK)
   - DS snapshot (subset — только tokens/components referenced в MK Screen Inventory tokens column)
   - Full NM content
2. Saves в session state (для potential `/design:export` verify):
   ```yaml
   d6_export_path: ".product/.design-sessions/<FM-id>-export-preview.md"
   d6_export_generated_at: <ISO>
   ```
3. Does NOT modify handoff file directly — `/product:handoff` assembles §10 inline reading MK/DS/NM artifacts через handoff-generator.md skill (Q10 resolution: «handoff §10 ассистент заполняет из MK/DS/NM без separate command call»).

**Surface к user:**
```
✅ D.6 Export ready для FM-NNN.

What's next:
  • /design:export FM-NNN — verify standalone UI-contract block (optional sanity check)
  • /product:handoff FM-NNN — §10 will be auto-populated from MK/DS/NM
                              (no manual invocation of /design:export needed)

Session complete. Archiving к .product/.design-sessions/archived/FM-NNN-<timestamp>/.
```

### Session completion (after D.6)

```
mkdir -p .product/.design-sessions/archived
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mv .product/.design-sessions/FM-NNN-* archived/FM-NNN-${TIMESTAMP}/
```

Update `<FM-id>-progress.yaml.current_step = complete` (preserved в archive для audit).

Surface к user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Design Session завершена: FM-NNN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Artifacts:
  • MK-NNN — active, iteration <N>, tool: <tool>
  • DS — token_count <N>, component_count <M>, pending proposals: <P>
  • NM-NNN — active

Next steps:
  [1] /design:system --review — process pending DS proposals
  [2] /product:handoff FM-NNN — generate handoff с §10 UI Specification
  [3] /product:status — overview
```

## Cross-cutting concerns

### Hard approve gate UX (mirror DEC-DEV-0047 §7.6 pattern)

All approve gates в этом skill — silence ≠ continue. Pattern:

- Explicit STOP marker (🟡/🟠/🟢 emoji + section name)
- Enumerated choices [1] [2] [3] [4]
- «Silence treated as» disclaimer
- WAIT for user response before proceeding

Mirrors `/integrator:research` Step 7 hard gate template (DEC-DEV-0047 B-4) и `/design:migrate` Q1 per-MK hard gate (sub-phase F).

### Tool dispatch chain (per `.claude/design.yaml.mcp_preferences.fallback_chain`)

If primary tool fails (Stitch unavailable / quota / network):

```
WARN user: «<primary> unavailable: <reason>. Switching to <next>.»
UPDATE <FM-id>-progress.yaml.design_tool = <next>
UPDATE <FM-id>-progress.yaml.fallback_active = true
LOAD next tool skill per fallback chain
APPEND PA entry если subscription-gated (e.g., Claude Design Pro/Max/Team — Q9 trigger #2)
```

Switch fully transparent — D.2/D.3 continue без user intervention beyond initial confirmation if needed.

### Q9 PA trigger #2 (Claude Design subscription gating)

If `design_tool: claude-design` activated AND user has no Pro/Max/Team subscription (detected при first attempt — manual workflow за webfetch будет fail):

```
Append PA entry (source=design, trigger=/design:start FM-NNN OR fallback chain),
  action="Subscribe to Claude Pro/Max/Team for Claude Design access OR switch design_tool to stitch/html",
  details="Claude Design (claude.ai/design) requires subscription. v1.0 ships stub workflow per C1 (DEC-DEV-0052) — manual export only. Without subscription session cannot proceed на этом tool.",
  blocking="D.2 generation на этом tool"
)
```

### Iteration log discipline

Every D.3 iteration adds entry. Critical для audit + bring-forward triggers (e.g., subagent C2 unlock requires «D.3 крупные правки» evidence accumulated).

## State persistence

Hook `session-state.js` (product module — existing) captures `.product/` writes но не `.product/.design-sessions/` (gitignored zone). Skill explicitly writes progress.yaml после each step transition + each iteration. Per-FM file per DEC-DEV-0013 #1 invariant.

## Anti-patterns

1. **Loading subagent screen-generator в v1.0.** v1.0 D.2 inline per Q2/C2. Bring-forward trigger logged в v1_1_backlog. Не invent ad-hoc subagent invocation.

2. **Auto-progress through approve gates.** Silence ≠ consent. Pattern verified Phase 5 (DEC-DEV-0047 Lesson 5). Skill always WAITs.

3. **Editing MK frontmatter migration trail manually.** `previous_tools[]` writes только через `/design:migrate` (sub-phase F). Skill `design-session.md` never touches `previous_tools[]`.

4. **MK→DS write order reversed.** A6 mandates MK first (draft) → DS update second. Reverse order risks orphan DS entries если MK write fails.

5. **Hardcoded color / spacing в MK Component State Matrix.** Always reference DS tokens (`DS.color.primary`, `DS.spacing.md`). `design-system-rules.md` skill enforces.

6. **Ignoring deadlock guard.** Q7 4-choice menu MUST surface at iter ≥7. Drift toward AI smooth-over («давайте ещё одну итерацию») = anti-pattern.

7. **Cleanup logic skipping archived/ purge.** A4 mandates opportunistic >30d purge at session start. Skipping inflates disk + audit clutter.

## Failure modes

| Failure | Recovery |
|---|---|
| Brief generation produces empty Screens list | Surface к user: «No UI verbs detected в SC steps. Verify SC.steps contain «click / submit / select / view / toggle». Options: [edit SC inline / proceed minimal /Abort]» |
| Stitch MCP timeout mid-iteration | Mark iteration as failed; offer retry OR switch к fallback chain |
| Tool URL becomes stale mid-session | Q9 PA trigger #3 fires (см. startup checks) |
| MK write fails mid-D.5 | A6 atomic order saves — DS не touched yet; MK draft can retry |
| DS write fails after MK draft | MK remains draft; surface error; suggest manual DS edit OR retry |
| Hook `design-artifact-validate.js` not yet implemented (Phase 6.G pending) | Skill writes без validation; warn user «validation hook missing — install via /ecosystem:bootstrap or wait Phase 6.G» |
| User interrupts mid-step | Progress saved per step transition; --continue resumes |
| Concurrent edit к MK file from другого session | A9 already enforced при start; mid-session conflict surface'aет manual conflict resolution |

## Related

- Process: `.claude/docs/design-module/SPEC.md §7` (P2.5 D.1-D.6 full)
- Sibling skills (sub-phases D-E):
  - `component-states.md` — D.4 mechanical state matrix
  - `design-system-rules.md` — D.5 DS extraction
  - `stitch-workflow.md` — Stitch primary tool dispatch
  - `claude-design-workflow.md` — Claude Design stub (C1 — v1.0 minimal)
  - `html-fallback.md` — HTML emergency fallback (C4 — v1.0 single-page)
  - `design-validation.md` — V-MK-* runner (partial per C5)
- Cross-skill (PA journal):
  - `skills/ecosystem/user-action-tracker.md` — Q9 PA trigger append protocol
- Commands:
  - `/design:start FM-NNN` — entry (этот skill orchestrated через него)
  - `/design:iterate <MK-id>` — D.3 continuation on existing MK
  - `/design:system --review | --update-from <MK-id>` — DS management
  - `/design:export FM-NNN` — D.6 verify standalone
  - `/design:migrate <MK-id> --to <target>` — tool switching (Q1 hard approve gate)
- Hooks:
  - `hooks/design/design-artifact-validate.js` — PostToolUse (sub-phase G); Q8 quiet-draft mode per SPEC §B2
- Configs:
  - `.claude/design.yaml` (per-project, auto-init by `/design:start`)
  - `.claude/product.yaml.auto_approve_confirmation_artifacts.enabled` (A1 modification для 🟢 gates)
