---
description: Start P2.5 Design Session для FM-NNN с has_ui=true. Workflow D.1 Brief → D.2 Screens → D.3 Iterate → D.4 States → D.5 Artifacts → D.6 Export. Produces MK/DS/NM. Conditional sub-module — Phase 6.
argument-hint: "<FM-id> [--continue] [--abandon]"
---

# /design:start

User invoked: `/design:start $ARGUMENTS`

## Process

Этот command orchestrates **P2.5 Design Session** per `.claude/docs/design-module/SPEC.md §7`. Load skill `.claude/skills/design/design-session.md` as primary orchestrator.

### Step 1: Parse arguments

- **`<FM-id>` matches `^FM-\d{3}$`** (e.g., `FM-001`) — primary mode (P2.5 D.1-D.6 fresh start или resume если progress file exists)
- **`--continue`** — explicit resume mode: requires also `<FM-id>` (или reads `current.yaml` если FM-id omitted)
- **`--abandon`** — A4 cleanup: archive current session для FM-id к `.product/.design-sessions/archived/<FM-id>-<timestamp>/`; не запускает new session
- **Empty / invalid** → show usage:
  ```
  Usage:
    /design:start FM-001                # start P2.5 session
    /design:start FM-001 --continue     # resume from progress file
    /design:start FM-001 --abandon      # archive session, no new run
  ```

### Step 2: Check prerequisites

**For all modes:**
- `.product/features/<FM-id>-*.md` exists (glob)
- FM frontmatter has `has_ui: true` — иначе refuse:
  > FM-NNN.has_ui=false. Design Module activates только when has_ui=true. Если хочешь UI — `/product:feature FM-NNN` чтобы edit + set has_ui=true (с rationale).
- Project bootstrapped (`.claude/product.yaml` + `.product/` exist)

**For `--abandon` mode:** skip remaining checks; jump к Step 4 archive logic.

**For primary + `--continue` modes:**
- FM has ≥1 active SC (через grep `feature: FM-<NNN>` в `.product/scenarios/*.md` с `status: active`). Если SC[] пустые — **A7 3-choice menu** (per DEC-DEV-0052):
  > FM-NNN has has_ui=true but no active SC. Design Module needs SC steps для derivation (Screen Inventory, BR↔state mapping). Options:
  >
  > [1] **Abort design** — set FM.has_ui=false (с rationale в FM body) и run `/product:feature FM-NNN` если behavioral SC needed first
  > [2] **Edit SC inline** — exit `/design:start`, run `/product:feature FM-NNN` чтобы add SC, then re-invoke `/design:start FM-NNN`
  > [3] **Proceed minimal UI** — continue с current FM body context only; log rationale в Design Decisions Log; expect lower quality D.1 brief

  Silence ≠ continue.

### Step 3: Ensure `.claude/design.yaml` exists (idempotent template deploy)

`.claude/design.yaml` — per-project Design Module config (per SPEC §8.2). Создаётся при первом `/design:start`, **НЕ** synced by `/ecosystem:update` Step 5 (singleton root-level file like `settings.local.json` — not в Step 5 root-file allowlist; preserved by inheritance).

**Algorithm:**
```
IF .claude/design.yaml does NOT exist:
  Write template (см. ниже) с project_name из .claude/product.yaml + sensible defaults
  Log: "Initialized .claude/design.yaml (per-project Design Module config)"
ELSE:
  Preserve verbatim. No prompt — user manages this file directly.
```

**Template content:**

```yaml
# .claude/design.yaml — per-project Design Module config.
# Created by /design:start на первой invocation; preserved by /ecosystem:update.
# Edit freely — этот файл не overwrite'ится upstream sync'ом.
# Schema reference: docs/design-module/SPEC.md §8.2.
version: 1
project_name: <copy from .claude/product.yaml>

# Primary design tool — Stitch MCP, Claude Design (claude.ai/design), или html-fallback.
# Может быть overridden per-MK через MK frontmatter design_tool.
default_design_tool: stitch

default_platform: responsive       # web | mobile | responsive | desktop
default_accessibility_standard: wcag-aa
default_language: <copy from .claude/product.yaml.project_language, default ru>

# Migration-readiness (v1.1 hook — full IR в v2 per SPEC §16)
ir_export:
  enabled: false
  schema_version: 0

mcp_preferences:
  primary: stitch
  fallback_chain:
    - claude-design       # web manual workflow (Q5 stub — v1.0)
    - html-artifact       # minimal single-page (C4 — v1.0)
    - figma               # если подключён в future
    - penpot              # если подключён в future

# External viewers (NOT screen generators) — import + preview self-contained HTML.
# Uncomment + wire via `/integrator:add open-design` once the shared daemon is up
# (see BOOTSTRAP.md «open-design shared daemon»). Visual-only — canon stays in MK/NM.
# external_viewers:
#   open-design:
#     kind: viewer                 # imports + previews self-contained HTML; NOT a screen generator
#     transport: http              # Dockerized daemon at http://127.0.0.1:7456 (token-gated)
#     contract: CNT-003            # stitch/MK HTML ZIP -> POST /api/import/claude-design
#     adapter: .claude/integrator/adapters/stitch-to-opendesign.js
#     secret_token: .claude/integrator/secrets/open-design.token   # OD_API_TOKEN (gitignored; ~/.claude/... machine-global takes precedence)
#     exports: [html, pdf, pptx, mp4, zip]
#     notes: |
#       Alternative to local Chrome-render for visualizing Stitch/MK HTML mockups —
#       interactive iframe preview + multi-format export. Use as a /design:migrate
#       --to open-design target. Carries visual HTML only (no MK metadata).

# Brand hints (опциональные — задаются вручную user'ом после первого review)
brand_hints:
  colors: {}
  style: ""
  tone: ""
  references: []

# Per-FM overrides (опциональные)
platform_overrides: {}             # {FM-NNN: mobile-first | desktop-first | ...}
```

### Step 3a: Stitch MCP availability check (Q9 PA trigger #1)

Per DEC-DEV-0052 Q9 PA integration: первый `/design:start` без Stitch MCP configured → surface PA entry.

**Algorithm:**
```
IF .claude/design.yaml.default_design_tool == stitch:
  IF Stitch MCP NOT в `claude mcp list` output (or .mcp.json):
    Surface к user: «Stitch MCP не сконфигурирован, fallback chain активен.»
    Append PA entry через skills/ecosystem/user-action-tracker.md:
      Source: design
      Trigger: /design:start FM-NNN
      Action required: "Obtain Stitch account + MCP API key, install via /integrator:add stitch-mcp; ИЛИ switch .claude/design.yaml default_design_tool to html"
      Details: "Stitch primary tool unavailable; session will use fallback chain (claude-design stub → html-artifact). Quality degraded vs full Stitch workflow per SPEC §9.6."
      Blocking: "Quality only; session can proceed на fallback"
    Continue session
```

Other Q9 triggers fire downstream (Claude Design без subscription — в `claude-design-workflow.md`; `tool_project_url` 404 на resume — в `design-session.md`).

### Step 3b: Initialize session state files

Создать `.product/.design-sessions/` если её нет (gitignored per SPEC §2.3).

**`current.yaml`** (или append/update existing — session-state'ом скилла):

```yaml
session_id: "<ISO-timestamp>-design-FM-<NNN>"
type: design-session
fm_id: FM-<NNN>
started_at: "<ISO timestamp>"
current_step: D.1
current_iteration: 0
design_tool: <from .claude/design.yaml.default_design_tool>
tool_project_url: null

progress:
  completed_steps: []
  current_step: D.1 Design Brief Generation
  next_step: D.2 Screen Generation

iterations_log: []
pending_feedback: null
stitch_usage:
  month_count: 0
  month_count_at_date: "<YYYY-MM>"   # per A5: monthly rollover comparison
  month_limit: 350
```

**`--continue` mode:** read existing `<FM-id>-progress.yaml`; resume с `current_step`. Если `tool_project_url` set но returns 404 при subsequent skill access → Q9 PA trigger #3 (in skill).

### Step 4: Abandon mode (если `--abandon`)

```
mkdir -p .product/.design-sessions/archived/
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE_DIR=".product/.design-sessions/archived/FM-${NNN}-${TIMESTAMP}"
mv .product/.design-sessions/FM-<NNN>-* "$ARCHIVE_DIR/"
```

(Per A4 cleanup logic per DEC-DEV-0052; opportunistic >30d purge запускается в `design-session.md` skill при следующем session start.)

Report:
```
Session FM-NNN abandoned. Archived to .product/.design-sessions/archived/FM-NNN-<timestamp>/.
Re-start: /design:start FM-NNN (fresh session).
```

Exit. No skill load.

### Step 5: Delegate to design-session skill

Load `.claude/skills/design/design-session.md`. Skill handles:
- **D.1** Design Brief Generation (🟡 Review approve gate — human can edit brief)
- **D.2** Screen Generation first iteration (🟠 Strategic gate — inline в v1.0 per Q2/C2; subagent → v1.1)
- **D.3** Iterative Refinement (loop; per-iteration small/medium/large/fundamental classification; 7-iteration deadlock protection per Q7)
- **D.4** Component State Matrix (🟢 Confirmation; delegates → `component-states.md`)
- **D.5** Artifact Generation MK/DS/NM (🟠 Strategic; delegates → `design-system-rules.md` для DS extraction)
- **D.6** Export ready for handoff §10

**Cross-cutting orchestration handled by skill:**
- Q9 PA triggers #2 (Claude Design без subscription) и #3 (`tool_project_url` 404 при resume)
- A5 Stitch monthly counter rollover
- A4 opportunistic >30d archived/ purge at session start
- A6 atomic MK→DS write order (MK draft first, DS update second)
- A9 concurrent session detection (existing `current.yaml` с matching FM → resume/force-new/abort menu)
- A11 hook stderr format coordination с `design-artifact-validate.js` (sub-phase G)
- Fallback chain dispatch per `mcp_preferences.fallback_chain`

### Step 6: Session state (auto-managed)

`session-state.js` hook (existing — product module) snapshots progress на каждый `.product/` Write/Edit. Design sessions используют separate `.product/.design-sessions/<FM-id>-progress.yaml` управляемый skill'ом (analog feature-session pattern).

### Step 7: Completion

When D.6 complete:
- MK-NNN, DS, NM-NNN в active в `.product/`
- Session archived (per A4): `.product/.design-sessions/FM-NNN-*` → `archived/FM-NNN-<timestamp>/`
- Summary report (см. `design-session.md` D.6 §Completion summary)
- Suggest next: `/design:export FM-NNN` (verify) → `/product:handoff FM-NNN` (UI Specification §10 populated)

## Important constraints

- **Mode strictly determined by argument shape.** FM-NNN pattern → primary; `--continue` → resume; `--abandon` → archive. Silence ≠ continue at A7 menu.
- **has_ui=true strict check.** Refuse if FM.has_ui=false с explicit redirect к `/product:feature` для toggle.
- **Per-FM session state.** `.product/.design-sessions/FM-NNN-progress.yaml` per FM (analog Phase 3 DEC-DEV-0013 #1). Switching между FMs не overwrite.
- **`.claude/design.yaml` idempotent deploy.** Created on first invocation; preserved on subsequent. User edits never wiped (Step 5 update.md root-file allowlist не lists design.yaml → preserved by inheritance).
- **Trust skill для deeper UX.** Approve gates, iteration classification, deadlock menu (Q7), А7 menu — все в orchestrator. Command provides scaffolding + delegation.
- **Stitch fallback transparent.** Если Stitch unavailable → switch'aется к claude-design (stub) → html-fallback per chain. PA entry surfaces, session не блокируется.

## Error handling

| Error | Action |
|---|---|
| `<FM-id>` not found | List available FMs с has_ui=true |
| FM.has_ui=false | Refuse; suggest `/product:feature FM-NNN` для toggle с rationale |
| No active SC | Surface A7 3-choice menu; silence ≠ continue |
| `.claude/design.yaml` malformed | Surface error; suggest manual fix OR delete + re-init |
| Stitch MCP unavailable, fallback chain also failed | Surface PA #1; offer manual `/integrator:add stitch-mcp` OR force `default_design_tool: html` |
| Existing session for same FM (A9) | Menu: `[resume / force-new-overwrite / abort]` |
| `tool_project_url` returns 404 при resume (Q9 #3) | PA entry + offer `/design:migrate <MK-id> --to <chain-fallback>` |
| Concurrent session different FM | OK — multiple FM design sessions не conflict |
| Subagent invocation fails (когда v1.1 screen-generator активен) | N/A — v1.0 D.2 inline |
| User aborts mid-iteration | Save partial state в progress.yaml; `--continue` resumes |
| `--abandon` без existing session | No-op; report «no session for FM-NNN to archive» |

## Related

- Process: `.claude/docs/design-module/SPEC.md §7` (P2.5 D.1-D.6 detailed flow)
- Skill: `.claude/skills/design/design-session.md` (orchestrator) + delegated:
  - D.4 — `component-states.md` (mechanical state matrix checklist)
  - D.5 — `design-system-rules.md` (DS extraction + token detection)
  - D.2/D.3 — `stitch-workflow.md` (Stitch MCP primary), `claude-design-workflow.md` (stub v1.0), `html-fallback.md` (minimal v1.0)
  - D.5 validation — `design-validation.md` (V-MK-* runner partial)
- Subagent: `screen-generator.md` — **deferred к v1.1** (C2); v1.0 D.2 inline в `design-session.md`
- Hook: `hooks/design/design-artifact-validate.js` (Phase 6.G; PostToolUse on `.product/mockups/**/*.md` + `design-system.md`)
- Companion commands:
  - `/design:iterate <MK-id>` — D.3 continuation на existing MK
  - `/design:system [--review | --update-from <MK-id>]` — DS management
  - `/design:export <FM-id>` — D.6 verify standalone (handoff invokes automatically per Q10)
  - `/design:status [--fm <FM-id>]` — design dashboard
  - `/design:migrate <MK-id|--all> --to <target>` — tool switching (v1.0: Stitch↔HTML only per C3)
- Cross-module:
  - `/product:feature FM-NNN` — F.8 trigger calls `/design:start` automatically when FM enrichment completes with has_ui=true
  - `/product:handoff FM-NNN` — §10 UI Specification consumes MK/DS/NM из `.product/`
- Config: `.claude/design.yaml` (per-project — auto-init by этот command), global `~/.claude/design-config.yaml` (SPEC §8.1; v1.0 leaves global to user discretion)
