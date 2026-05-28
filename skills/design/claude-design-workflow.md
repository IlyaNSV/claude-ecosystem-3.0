---
description: Claude Design (claude.ai/design) manual export workflow stub. v1.0 minimal per DEC-DEV-0052 C1 — full skill deferred к v1.1 после first pilot OR Anthropic MCP/API release.
---

> **User-facing output language:** Russian. Identifiers / URLs — verbatim.

# Claude Design Workflow — Skill (v1.0 stub)

> **Status:** v1.0 stub (~30 lines effective) per DEC-DEV-0052 Q5/C1. Full skill — v1.1+ candidate; см. `dev/v1_1_backlog.md` «Design Module — claude-design-workflow.md full skill (C1 cut)».
>
> **Defer rationale (DEC-DEV-0052 Lesson 4 — OQ-DM-08 exemplar phantom-audience risk):** Claude Design (claude.ai/design) — research preview без MCP/API на 2026-05-27. Skill spec без actual pilot experimentation = vapor. v1.0 ships manual workflow pointer; refactor after first real session.

## Activation context

Loaded when `design-session.md` dispatches D.2/D.3 с `design_tool: claude-design` — typically через fallback chain после Stitch unavailable OR explicit user preference в `.claude/design.yaml`.

## v1.0 workflow — manual

**No MCP / API integration.** User executes steps manually; skill provides scaffolding text + capture protocol.

```
1. Surface к user:

   «Claude Design (claude.ai/design) workflow — manual в v1.0.

   Steps:
     (a) Open https://claude.ai/design в browser (requires Pro / Max / Team / Enterprise subscription)
     (b) Create new project OR open existing
     (c) Paste design brief из .product/.design-sessions/<FM-id>-brief.md
     (d) Iterate в claude.ai/design UI (chat + inline edits) до satisfaction
     (e) Export via UI: HTML / ZIP / PDF / PPTX
     (f) Save export к .product/.design-sessions/<MK-id>-export/
     (g) Update <FM-id>-progress.yaml.tool_project_url = <claude.ai/design project URL>

   После manual export return to /design:start FM-NNN --continue для continue session flow.»

2. Append PA entry IF user reports «no subscription» (Q9 PA trigger #2):
     Source: design
     Trigger: /design:start FM-NNN
     Action required: «Subscribe to Claude Pro/Max/Team for Claude Design access OR switch design_tool to stitch/html in .claude/design.yaml»
     Details: «Claude Design (claude.ai/design) requires subscription. v1.0 ships manual workflow stub per C1; without subscription session cannot proceed на этом tool.»
     Blocking: «D.2 generation on этом tool»

3. Return к orchestrator: «claude-design-manual-handoff» — orchestrator continues session expecting manual capture.
```

## v1.0 limitations

Per SPEC §4.4a и DEC-DEV-0052 OQ-DM-08:
- No automated prompt patterns (deferred к pilot evidence)
- No DS-inheritance automation (manual brand-package export via text — user copies DS subset to claude.ai/design as project context)
- No native «Handoff to Claude Code» integration (manual — user can paste link к claude.ai/design bundle в Ecosystem handoff §10 reference)
- No subscription tier auto-detection (Q9 PA trigger fires on user report only)
- Known limitations workarounds undocumented (comment persistence, compact view save errors, large codebase lag — per DEC-DEV-0048 research baseline) — refactor after pilot

## Bring-forward trigger для v1.1+ refactor

Per `dev/v1_1_backlog.md`:
- First FM в pilot где user выбирает Claude Design over Stitch (real evidence)
- Anthropic releases public Claude Design MCP/API (announced «coming weeks» на 2026-05-27)
- ≥2 Claude Design sessions completed manually

## Related

- SPEC reference: `.claude/docs/design-module/SPEC.md §4.4a` (full skill spec sketch — v1.1 deliverable)
- SPEC §9.1 Claude Design tool block
- Parent skill: `design-session.md` (D.2/D.3 dispatch)
- Sibling tools: `stitch-workflow.md` (primary), `html-fallback.md` (emergency)
- v1.1+ backlog: «Design Module — `claude-design-workflow.md` full skill (C1 cut)»
- OQ-DM-08: Claude Design prompt engineering patterns (open — gated by pilot)
