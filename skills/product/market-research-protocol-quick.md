---
description: D1.2 Quick mode — lightweight market research via Brave + Firecrawl. 30-45 min. Deep mode spawns market-researcher subagent instead.
---

# Market Research (Quick Mode) — D1.2 Skill

## When to use

Quick mode (default). For Deep mode — spawn `.claude/agents/product/market-researcher.md` subagent instead.

## Goal

Produce `.product/market-research.md` draft с:
- Market size estimates (TAM / SAM / SOM with `[оценочно]` tags where weak)
- Key trends (3-5)
- Barriers / challenges
- User demographic patterns
- Source list with credibility rating

Credibility target: medium-high (2-3 independent sources per major claim).

## Process

### Step 1: Query formulation

Based on PS, formulate 5-8 search queries. Mix:
- Market size: «<domain> market size 2026», «<domain> industry report», «<domain> TAM»
- User behavior: «how do <target users> currently do X», «<target users> pain points X»
- Trends: «<domain> trends 2026», «emerging <domain> tools»
- Barriers: «why <domain> underserved», «<domain> challenges adoption»

Write queries in language of primary market (EN для global/western markets, RU для post-Soviet, etc.).

### Step 2: Search execution (Brave)

Run 5-8 queries via Brave Search MCP (or WebSearch fallback). For each:
- Capture top 3-5 results (titles + snippets + URLs)
- Keep URLs for potential Firecrawl deep-dive

Time budget: 10-15 minutes.

### Step 3: Selective deep-read (Firecrawl)

From search results, pick 3-5 URLs for full scrape via Firecrawl:
- Industry reports (Gartner, Statista, custom research firms)
- Academic articles (если rigor нужен)
- Quality blog posts от established players
- Government / NGO statistics (if applicable)

**Skip:**
- Marketing landing pages selling stuff
- Forum posts (useful signal, но не authority для market size)
- LinkedIn posts без sources
- ChatGPT-generated articles (low signal)

Time budget: 15-20 min for 3-5 scrapes.

### Step 4: Triangulation

For each major claim, cross-reference 2+ sources:
- «Market size ~$5B» — from Statista (2023) + Gartner report (2024) → `credibility: high`
- «Market size ~$5B» — from ChatGPT-generated article only → `credibility: low [оценочно]`

If only one source for a claim, tag it `[оценочно]` explicitly в the body.

### Step 5: Synthesis

Draft MR с structure:

```markdown
# Market Research

## Market Size

### TAM (Total Addressable Market)
<claim> — sources: X, Y (credibility: high | medium | low)

### SAM (Serviceable Available Market)
<claim> — sources

### SOM (Serviceable Obtainable Market)
<claim> — likely starting point, 1-3 year horizon

## Trends (2-5 key)

### Trend 1: <name>
Description...
Evidence: source X, source Y
Implication: <for our product>

## User demographics

Primary: <profile> — age, occupation, geography, digital maturity
Secondary: ...

## Current behavior

How do target users currently address the problem?
- Workaround A: description, prevalence
- Workaround B: ...

## Barriers / Challenges

Why is this space underserved?
- Technical barriers
- Adoption barriers
- Economic barriers

## Sources

| # | Source | Type | Credibility | URL |
|---|--------|------|-------------|-----|
| 1 | Statista «X Market 2024» | industry report | high | <url> |
| 2 | Hacker News thread | community signal | low-medium | <url> |
...

## Confidence note

Research conducted in Quick mode (~30 min). Next steps if Deep needed:
- Verify TAM via primary industry report (not Wikipedia-style summary)
- Interview 3-5 users to validate Current behavior
- [specific gaps you identified]
```

### Step 6: Tag weak claims

Before presenting draft, audit:
- Any claim without 2+ sources — tag `[оценочно]` inline
- Any big number (TAM, user count) — verify or tag
- Any trend claim — ensure evidence, or tag

This prevents MR from looking more authoritative than it is.

### Step 7: Present и queue for DRC

MR draft → status=`draft`, queued для Discovery Review Checkpoint (per A2 modification).

**Не отдельный G2 gate.** Assistant brief note:

```
MR draft ready (<N> sources, credibility medium-high).
Queued for Discovery Review Checkpoint (after SEG creation).

Continuing to D1.3 Competitive Analysis...
```

User can peek at draft on request, but full approve happens at DRC.

## Time budget

Target: 30-45 минут total для Quick.
- Queries: 10 min
- Deep reads: 15-20 min
- Synthesis + tagging: 10-15 min

If exceeding 60 min — you're overresearching for Quick mode. Wrap up.

## Fallback when MCPs unavailable

| Missing | Fallback |
|---|---|
| Brave Search MCP | WebSearch tool |
| Firecrawl MCP | WebFetch tool (less structured) |
| Exa AI | Skip semantic queries, rely on keyword |

Explicitly mark draft as «Fallback sources used» if core MCPs unavailable.

## Confidence calibration

At the end, assess overall research confidence (C2):

- **high** — 5+ sources, 2+ independent for major claims, recent (last 2 years), industry reports
- **medium** — 3-4 sources, mix of industry and community, some recent
- **low** — 1-2 sources, mostly community signal, or dated

State honestly в draft footer.

## Anti-patterns

1. **Wikipedia-only research.** Wikipedia is summary of others — не source.
2. **Over-citing.** 20 sources worse than 5 strong ones.
3. **Numbers without sources.** «Market is $10B» without source is fiction.
4. **Projecting personal experience.** «Users hate X» — needs evidence, не intuition.
5. **Ignoring contradictions.** If 2 sources disagree, note it — не smooth over.

## Handoff to D1.3

Don't end MR by summarizing CA findings — that's next step's job. MR ends with user demographics + barriers; CA starts with «given this market, who's competing?»
