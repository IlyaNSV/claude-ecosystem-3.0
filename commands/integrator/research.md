---
description: Research tools for a PMO need; presents 2-5 options with comparison, doesn't install.
argument-hint: "<need-description>"
---

# /integrator:research

User invoked: `/integrator:research $ARGUMENTS`

You are running **read-only research** for the user's tooling need. **Do not install anything.** Only research, present, and let the user decide.

## Process

Follow the methodology in `.claude/skills/integrator/research-protocol.md` (load this skill).

### Step 1: PMO zone identification

Parse `$ARGUMENTS` and determine which PMO zone(s) the need belongs to. Reference `.claude/docs/pmo/pmo-map.md` for the canonical PMO structure.

Examples:
- "PostgreSQL access" → D3 (development) + possibly D5 (operations monitoring)
- "E2E testing for React" → D4 (quality assurance)
- "Deploy to production" → D3 (delivery sub-zone)

If the need spans multiple zones, list them and proceed to research each.

### Step 2: Tool discovery

For the identified zone(s), discover candidate tools using available MCP stack:

1. **Context7** (if available) — official package docs for known tools
2. **GitHub MCP** (if available) — popular repos in the category, activity, contributors
3. **Firecrawl** — comparative reviews, blog posts, "X vs Y" articles
4. **Brave Search** — keyword lookup as a quick first pass
5. **Exa AI** (if available) — semantic "tools that solve <user-need-restated>"
6. **Memory MCP** — check journal for prior research on this category

If MCPs unavailable, fall back to WebFetch + WebSearch with clear note about reduced quality.

### Step 3: Filter and shortlist

From discovered candidates, filter by:
- **Stack compatibility** — read project context (`.claude/product.yaml`, `package.json` if exists, recent decisions in journal) to know what fits
- **Maturity** — exclude alpha-stage unless user explicitly wants experimentation
- **License compatibility** — check that license is compatible with project intent
- **Active maintenance** — last commit < 6 months for serious recommendation

Shortlist 2-5 candidates.

### Step 4: Profile each candidate

For each shortlisted tool, gather:
- Category (implementation | spec-gen | testing | monitoring | deploy | other)
- Source type (npm | pip | git | MCP | other)
- PMO coverage with confidence levels (high | medium | low | none)
- Inputs (formats expected)
- Outputs (formats produced)
- Configuration requirements (env vars, config files)
- Known issues / gotchas
- Strengths / weaknesses summary

Use `.claude/skills/integrator/tool-profiling.md` skill for structured profiling.

For deep profiling — spawn `tool-researcher` subagent (`.claude/agents/integrator/tool-researcher.md`) with isolated context. Pass:
- The need
- The candidate tool name + source URL
- Project context summary

### Step 5: Comparison table

Present results as a table:

```
| Tool | PMO zone | Pros | Cons | Stack fit | Maturity |
|------|----------|------|------|-----------|----------|
| ...  | ...      | ...  | ...  | ...       | ...      |
```

Plus narrative recommendations:
- "For development: tool A + tool B (complementary)"
- "For production monitoring: defer until MVP"

### Step 6: Express assistant's own confidence

Per C2 modification — explicitly state your confidence:

```
Confidence: medium
Confidence notes: candidates A and B well-documented; C is newer with limited
production reports — ratings based on docs and 2 community blog posts.
```

### Step 7: Present options to user

Format:

```
What do we do?
  [1] Install <recommended-A> — recommended
  [2] Install <alternative-B>
  [3] Just install minimal <X>
  [4] Nothing, I'll think
  [5] Deeper research on a specific tool: /integrator:research "<refined-need>"

Your choice?
```

**DO NOT proceed to install.** Wait for user's decision. If they choose to install, they invoke `/integrator:add <tool-name>` separately.

### Step 8: Cache research

Save the research output to `~/.claude/integrator/research-cache/<YYYY-MM-DD>-<slug>.md` with:
- Original need
- Shortlist + comparison
- Decision (if user made one)
- Date for staleness tracking (research expires after 7 days for re-validation)

If the cache directory doesn't exist, create it: `mkdir -p ~/.claude/integrator/research-cache/`.

## Important constraints

- **READ-ONLY.** No installations, no config changes, no file mutations outside `~/.claude/integrator/research-cache/` and the `journal` entry.
- **No fabrication.** If a tool's claim isn't verified in source, mark as low confidence.
- **Cite sources.** Each significant claim about a tool should reference where you found it (URL, doc page).
- **Respect project tier.** If `validation_tier: pilot` — bias toward simple, mature tools. Avoid bleeding-edge.

## Journal entry

Append a journal entry to `~/.claude/integrator/decision-journal.md` (or `.claude/integrator/project-journal.md` if scope is project-specific):

```markdown
## DEC-INT-RESEARCH-<NNN> — Researched: <need>

**Date:** YYYY-MM-DD
**Trigger:** /integrator:research "<args>"
**Tag:** #research #pmo-<zone>

### Need
<original need>

### Candidates examined
<list with one-line summaries>

### Recommendation
<your top choice + rationale>

### User decision
<install / defer / further research>
```
