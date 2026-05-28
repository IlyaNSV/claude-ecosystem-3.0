---
description: Stitch MCP dispatch для D.2/D.3 screen generation. Prompt patterns v0 best-effort (OQ-DM-01 open); quota tracking integration; fallback chain trigger при unavailability.
---

> **User-facing output language:** Russian. Stitch / MCP / token identifiers — verbatim.

# Stitch Workflow — Skill

Used by `design-session.md` D.2 + D.3 when `design_tool: stitch`. Wraps Stitch MCP interactions с prompt scaffolding + quota awareness.

> **Status v1.0 (Phase 6):** v0 best-effort per DEC-DEV-0052 OQ-DM-01 (Stitch prompt engineering patterns — требует pilot evidence). После первого real pilot session — refactor prompt patterns based on actual quality observed (DEC-DEV-0023 Phase 3 PS drift precedent).

## Activation context

Loaded when:
- D.2 first iteration с `<FM-id>-progress.yaml.design_tool == stitch`
- D.3 iteration с classification ∈ {small, medium, large} (не fundamental — fundamental → D.2 rerun)
- D.4 missing-state addition (per `component-states.md` accepted proposal)

Input from orchestrator:
- Operation type: `initial-generation | single-screen-update | multi-screen-rework | state-addition`
- Brief content (D.1 approved) OR target screens (D.3 update) OR target component+state (D.4)
- DS snapshot (active tokens — для consistency)
- Iteration counter (for context window awareness)

## MCP availability check

```
IF Stitch MCP not registered (check claude mcp list):
  Return к orchestrator: «stitch-unavailable»
  Orchestrator dispatches к fallback chain
```

(PA trigger #1 surfaced в `/design:start` Step 3a — здесь не повторяем.)

## Quota guard (А5 integration)

Before issuing MCP call:

```
READ <FM-id>-progress.yaml.stitch_usage
IF month_count_at_date != current YYYY-MM:
  month_count = 0
  month_count_at_date = current YYYY-MM

IF month_count >= month_limit:
  Return к orchestrator: «stitch-quota-exhausted»
  Orchestrator surfaces 3-choice menu (continue html-fallback / switch permanent / pause)
```

After successful MCP call:

```
month_count += <number of generations issued by this call>
Update <FM-id>-progress.yaml
```

## Prompt patterns v0 (best-effort — refactor after pilot)

### Pattern A — Initial screen generation (D.2)

Brief structure:

```
[FEATURE CONTEXT]
Product: <project_name> — <one-liner>
Feature: FM-NNN <title>
Success metric: <FM.success_metric>
Roles: <RPM excerpt>

[SCREENS TO GENERATE]
For each SI item:
  SI-N — <title>
    Type: screen | modal | toast
    Linked SC step: SC-XXX/Y
    Purpose: <one-line>
    Components expected: <list>

[DESIGN SYSTEM (active tokens)]
Colors: <DS.color.* excerpt — active only>
Typography: <DS.typography.* excerpt>
Spacing: <DS.spacing.* excerpt>

[BRAND HINTS]
Style: <from .claude/design.yaml.brand_hints.style>
Tone: <from .claude/design.yaml.brand_hints.tone>
References: <urls if any>

[ACCESSIBILITY]
Standard: <from .claude/design.yaml.default_accessibility_standard>
Notes:
  - All interactive components keyboard-navigable
  - Contrast ratio ≥4.5:1 (WCAG AA)
  - Touch targets ≥44x44px на mobile

[PLATFORM]
Target: <from MK.frontmatter.platform>

[OUTPUT REQUEST]
Generate <N> screens. Use DS tokens (do not hardcode hex/spacing).
Return: JSON с {si_id: stitch_url} mapping + screen descriptions.
```

### Pattern B — Single-screen update (D.3 small/medium)

```
[CONTEXT]
Existing project: <stitch_project_url>
Update target: SI-N <title>
Reason: <user's feedback text>

[CONSTRAINTS]
Preserve other screens unchanged.
Maintain DS token usage; flag any deviation.

[OUTPUT REQUEST]
Updated SI-N in-place. Return: updated URL + change summary.
```

### Pattern C — Multi-screen rework (D.3 large)

```
[CONTEXT]
Project: <stitch_project_url>
Screens to rework: SI-1, SI-3, SI-5 (3 screens)
Reason: <user's feedback — typically architectural like layout shift>

[STRATEGY]
Coordinate changes across all listed screens; maintain visual consistency.

[OUTPUT REQUEST]
JSON per-screen с updated URLs + per-screen change summary + any DS impacts.
```

### Pattern D — Component state addition (D.4)

```
[CONTEXT]
MK-NNN, component: <name>
Missing state: <state name>
Visual proposal: <from component-states.md Step 3>

[OUTPUT REQUEST]
Add <state> variant to component in <stitch_project_url>.
```

## DESIGN.md file (Stitch branding file)

Stitch supports project-level brand file (`DESIGN.md`). Skill maintains semantically:

```
IF .product/.design-sessions/stitch-DESIGN.md not exists OR DS frontmatter.last_extraction_at > stitch-DESIGN.md mtime:
  Regenerate stitch-DESIGN.md from current DS state
  Upload to Stitch project (via MCP if supported)
```

Stitch-DESIGN.md format follows Stitch convention (markdown с structured sections per Stitch docs). Skill makes best-effort sync.

## Tool URL management

После initial generation:

```
ASSERT stitch project URL returned by MCP
WRITE к <FM-id>-progress.yaml.tool_project_url
PROPAGATE к MK frontmatter.tool_project_url при D.5 MK write
```

URL liveness checking — at resume (per Q9 PA trigger #3 в `design-session.md`).

## Issues handling

MCP may return `issues[]` field в response (warnings about generation quality, edge cases hit). Orchestrator surfaces these к user inline:

```
Stitch generation issues:
  • SI-2 modal: «overflow detected — long text may not fit», suggested: «add scrollbar».
  • SI-3 form: «too many fields на single screen, suggest split».

Options:
  [1] Continue, log issues в MK Design Decisions Log
  [2] Iterate D.3 to address specific issue
```

## Fallback handoff

При MCP timeout / network error / quota exhausted:

```
Surface к orchestrator: «stitch-failed: <reason>»
Provide cleaned-up brief к orchestrator (для fallback skill — claude-design OR html-fallback)
```

Orchestrator handles dispatch chain.

## Anti-patterns

1. **Hardcoding hex colors / pixel sizes в prompt без DS tokens.** Always reference tokens. Prompt scaffolding должна explicitly list active DS tokens.

2. **Skipping quota check.** Stitch silently fails при exhaustion; better proactive guard than mid-iteration surprise.

3. **Ignoring Stitch issues[] field.** Surface к user; log в MK Design Decisions Log если accepted.

4. **Re-generating entire project on small change.** D.3 classification (small/medium/large) determines scope. Pattern B (single-screen) for small/medium; Pattern C для large.

5. **Force-staying on Stitch despite fallback chain.** Если MCP failed — propagate к fallback per `mcp_preferences.fallback_chain`. Don't silently retry indefinitely.

6. **Skipping stitch-DESIGN.md sync.** When DS changes (mass-rename, new tokens) — re-sync brand file. Else Stitch generates outdated styles.

## Failure modes

| Failure | Recovery |
|---|---|
| MCP not registered | Return «stitch-unavailable»; orchestrator fallback |
| MCP timeout (>30s) | Return «stitch-timeout»; offer retry OR fallback |
| Quota exhausted (HTTP 429 OR `month_count >= limit`) | Return «stitch-quota-exhausted»; orchestrator 3-choice menu |
| Authentication error | Return «stitch-auth-failed»; surface re-config suggestion via PA entry |
| Generation returned empty / malformed | Surface к user; offer retry с refined prompt |
| DESIGN.md sync fails | Non-blocking; log warning; continue generation с in-prompt DS embed only |

## Related

- Tool: Stitch MCP (Google Stitch — `https://stitch.withgoogle.com`)
- Free tier: 350 generations/month (per design-module SPEC §9.1)
- Parent skill: `design-session.md` (D.2/D.3/D.4 dispatch)
- Sibling fallbacks: `claude-design-workflow.md` (stub C1 — v1.0), `html-fallback.md` (minimal C4 — v1.0)
- Related v1.1+ backlog: `screen-generator` subagent (C2 cut) — context isolation если main session pollution
- Integration: `/integrator:add stitch-mcp` для setup
- OQ-DM-01 (open question): Stitch prompt engineering patterns — first pilot session generates evidence для skill refactor
