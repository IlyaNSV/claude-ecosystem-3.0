---
description: Design Module dashboard. MK/DS/NM counts per status, active iterations, DS pending items, design tool connectivity, Stitch quota tracking.
argument-hint: "[--fm <FM-id>] [--verbose]"
---

# /design:status

User invoked: `/design:status $ARGUMENTS`

## Process

Read-only dashboard для Design Module state. Aggregates `.product/mockups/`, `.product/design-system.md`, active design sessions, MCP connectivity, и Stitch quota counters. **Не загружает skill** — direct read-only display.

### Step 1: Parse arguments

- **`--fm <FM-id>`** — narrow scope к single FM (filter MK/NM by `feature: FM-NNN`)
- **`--verbose`** — include full Screen Inventory + DS subset listings per MK
- **No args** — global dashboard

### Step 2: Verify prerequisites

- `.product/` exists (через `.claude/product.yaml`). Иначе refuse:
  > Project не bootstrapped. Run `/ecosystem:bootstrap` first.
- `.claude/design.yaml` exists (через Step 3 of `/design:start`). Иначе note:
  > Design Module не активирован — no design.yaml. Запусти `/design:start FM-NNN` чтобы initialize (auto на первой UI FM).

  Continue dashboard с `default_design_tool: not-configured`.

### Step 3: Aggregate state

Read-only scan:

1. **MK inventory:**
   - Glob `.product/mockups/MK-*.md`
   - Parse frontmatter: `id`, `feature`, `status`, `design_tool`, `tool_project_url`, `iteration`, `previous_tools[]`, `tool_switched_at`, `confidence`
   - Group by status (draft / review / active / deprecated), by feature, by design_tool

2. **NM inventory:**
   - Glob `.product/mockups/NM-*.md`
   - Parse frontmatter: `id`, `feature`, `mockups[]`, `status`, `roles[]`
   - Group by status, by feature

3. **DS state:**
   - Read `.product/design-system.md` если exists
   - Parse frontmatter: `token_count`, `component_count`, `pattern_count`, `last_extraction_at`, `version`
   - Read `.product/.pending/ds-pending.yaml` (если exists — DS proposals waiting review per `design-system-rules.md` skill)

4. **Active design sessions:**
   - Glob `.product/.design-sessions/*-progress.yaml`
   - Filter `current_step != complete` AND not under `archived/`
   - For each: read `fm_id`, `current_step`, `current_iteration`, `started_at`, `design_tool`, `pending_feedback`

5. **Stitch quota tracking** (per A5):
   - Read `current.yaml.stitch_usage` (если active session)
   - Show `month_count / month_limit`, current month, days remaining if approaching limit
   - Если `month_count_at_date` != current YYYY-MM → counter logically reset by next skill access (cosmetic surface here)

6. **MCP connectivity:**
   - Stitch MCP: check via `claude mcp list` parse (look for `stitch` entry; status Connected/Failed)
   - Claude Design: not MCP в v1.0 — show «manual workflow (web UI)» indicator (per C1 stub)
   - HTML fallback: always available (Claude Code primitive)

7. **PA design entries** (filter source=design via `.claude/pending-actions.md`):
   - Count pending entries
   - Surface top 3 (full list available via `/ecosystem:pending-actions --status pending` filtered by source)

### Step 4: Render dashboard

**Without `--verbose`, без `--fm`:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Design Module Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mockups (MK):  N total
  active:     X (across Y features)
  review:     Z
  draft:      W
  deprecated: V

Navigation maps (NM):  N total
  active:    X
  draft:     Y

Design system (DS): present | absent
  tokens:     N
  components: M
  patterns:   K
  pending:    P (run /design:system --review)
  last_extracted: YYYY-MM-DD

Active design sessions: N
  FM-NNN — step D.X, iter Z, tool: <tool>, started <relative>
  FM-MMM — step D.Y, iter W, tool: <tool>, started <relative>
  (или: «No active design sessions»)

Tool stack:
  Primary:   <from design.yaml>
  Stitch:    Connected | Failed | Not configured
             Usage: <month_count>/<month_limit> (month YYYY-MM)
  Claude Design: manual workflow (v1.0 stub — С1 cut)
  HTML fallback: available
  Fallback chain: <list from design.yaml>

Pending user actions (design source): N pending
  Top items: <PA-NNN labels>
  Full list: /ecosystem:pending-actions --status pending

What's next?
  • /design:start FM-NNN — start session для FM с has_ui=true
  • /design:system --review — process DS pending tokens/components
  • /design:export FM-NNN — verify §10 UI Specification сборки
```

**С `--fm FM-NNN`:**

Narrow scope display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Design status: FM-NNN — <title>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature: FM-NNN
has_ui: true
scenarios: SC-001, SC-002, ...

MK для этой фичи: N
  MK-NNN — status: active, iter: 3, tool: stitch
           previous_tools: stitch (switched 2026-XX-XX) — 1 transition
  MK-MMM — status: review, iter: 1, tool: html-fallback

NM для этой фичи: 1
  NM-NNN — status: active, mockups: [MK-NNN, MK-MMM], roles: [R-user]

Active session: yes
  step: D.3, iter: 4, tool: stitch
  pending_feedback: "Waiting for human to review SI-2 modal"
  started: 2 hours ago

Handoff readiness:
  /design:export FM-NNN → preview UI-contract block
  /product:handoff FM-NNN → §10 будет filled from these MK/DS/NM
```

**С `--verbose`:**

Add per-MK Screen Inventory dump + DS tokens used + accessibility notes excerpt.

### Step 5: Connectivity warnings

Если detected issues — surface inline:
- Stitch MCP Failed → suggest `claude mcp get stitch` for debug
- Design session с iter >7 (per Q7 deadlock) → surface gate UX reminder: «iter Z exceeds deadlock threshold — run `/design:start FM-NNN --continue` чтобы trigger 4-choice menu»
- DS pending items aged >7 days → surface «pending tokens accumulated — recommend `/design:system --review`»
- Active session 30+ days old → surface «stale session — consider `/design:start FM-NNN --abandon` or resume via `--continue`»

## Important constraints

- **Read-only.** Никаких writes. Не загружает skills. Не triggers approve gates.
- **Граceful degradation.** Missing artifacts → counts=0; missing config → не abort, surface notice + show defaults.
- **Filter discipline.** `--fm FM-NNN` strictly narrows к single FM; cross-MK references shown but counts limited.
- **Quota display только.** Не enforces limits; не блокирует sessions при близости лимита Stitch — это responsibility skill'а.

## Error handling

| Error | Action |
|---|---|
| `.product/` missing | Refuse; suggest `/ecosystem:bootstrap` |
| `.claude/design.yaml` missing | Note; show partial dashboard (no tool stack details) |
| `--fm <FM-id>` not found | Show list available FMs; abort |
| Malformed MK/NM frontmatter | Show what parsed; log warning; не abort |
| Stitch MCP query timeout | Display «Not reachable» (не «Failed»); не abort |
| `.product/.design-sessions/` empty | «No active sessions»; не error |

## Related

- Process: `.claude/docs/design-module/SPEC.md` (Design Module overview)
- Companion commands:
  - `/design:start FM-NNN` — start session
  - `/design:system --review` — DS pending review
  - `/design:export FM-NNN` — D.6 export verify
  - `/design:migrate <MK-id> --to <target>` — tool switching (v1.0: Stitch↔HTML only)
  - `/design:iterate <MK-id>` — D.3 continuation
- Cross-module:
  - `/product:status` — overall project dashboard (covers feature-level state); этот команд — design-focused detail
  - `/ecosystem:pending-actions --status pending` — full PA list (этот команд filter'aет source=design top 3)
- Config: `.claude/design.yaml`
- Hook: `.claude/hooks/design/design-artifact-validate.js` (PostToolUse — surface'aет findings into stderr; этот dashboard не reads pending validation queue directly — use `/product:validate` для that)
