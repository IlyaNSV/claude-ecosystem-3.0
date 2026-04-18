---
description: D1.3 Quick mode — lightweight competitive landscape via Exa + Brave + selective Firecrawl. 30-45 min. Deep mode spawns competitor-analyst subagent.
---

# Competitive Analysis (Quick Mode) — D1.3 Skill

## Input

- PS (approved in G1)
- MR draft (from D1.2, queued for DRC)

## Goal

Produce `.product/competitive-analysis.md` draft с:
- 4-7 key competitors
- Feature matrix (basic)
- Positioning notes
- Strengths/weaknesses per competitor
- Market gaps / opportunities
- Source list

## Process

### Step 1: Competitor discovery

Use multiple angles:

**Semantic search (Exa if available):**
Query examples:
- «tools that help <target users> do <task>»
- «alternatives to <known big player>»
- «<problem domain> software 2026»

**Keyword search (Brave):**
- «best <category> tool»
- «<category> comparison»
- «top <N> <category>»

**GitHub MCP (if dev-focused):**
- Repo search: topics, stars, contributors
- Useful for finding open-source or developer tools competitors

**Ask user:**
- «Какие tools вы знаете в этой области?»
- «Кого считаете главным конкурентом?»

Shortlist: 4-7 competitors. Don't go >10 — analysis becomes shallow.

### Step 2: Basic profiling per competitor

Для каждого competitor (5-10 min each):

1. Visit their site (Firecrawl if available else WebFetch)
2. Extract:
   - **Positioning** (tagline, primary value prop)
   - **Target user** (who they say they serve)
   - **Core features** (top 5-7)
   - **Pricing** (if public)
   - **Maturity** (years in market, customer count, funding/status)
3. Optionally: browse one or two reviews (G2/Capterra/forums)

Don't spend >10 min per competitor in Quick — breadth over depth.

### Step 3: Feature matrix

Build matrix. Rows = competitors, columns = key features for the problem domain.

Example (для TranslateIT):

| Feature | Trados Studio | memoQ | Smartcat | Matecat | Ourselves? |
|---------|---------------|-------|----------|---------|------------|
| TM storage | ✓ | ✓ | ✓ | ✓ | Maybe |
| Revision collection | ✗ | ✗ | Partial | ✗ | **Core** |
| Multi-client workflow | ✗ | ✗ | ✓ | ✗ | **Core** |
| Inline review | ✓ | ✓ | ✓ | ✓ | ? |
| Integrations с email | ✗ | ✗ | ✗ | ✗ | **Differentiator** |
| Pricing (freelance) | $$$ | $$ | $ (subscription) | free | ? |

Mark:
- ✓ covered
- ✗ not covered
- Partial / Maybe / ?
- **bold** = our differentiator or core feature

### Step 4: Positioning map

Plot competitors on 2 axes (pick axes relevant к problem):
- Axis 1: e.g., Price ↔ Quality
- Axis 2: e.g., Simple ↔ Feature-rich

Text version is fine for draft:
```
Feature-rich
     ↑
Trados ●            ● memoQ
     |
     |  Smartcat ●
     |
     |         ● Matecat
     |                    ● (our likely position)
     +────────────────────→
                         Simple / Focused
Expensive                                   Free / Cheap
```

### Step 5: Strengths/weaknesses summary

Per competitor, 2-3 bullets:

```
### Trados Studio
**Strengths:**
- Industry standard, wide adoption
- Rich TM features, established ecosystem
- Works offline, desktop-grade performance

**Weaknesses:**
- Expensive ($700+)
- Complex learning curve
- No multi-client workflow optimization
- No integrations with client-email-based revision flow
```

### Step 6: Market gaps / opportunities

Synthesize: what are competitors NOT doing that our target users complain about?

- From PS pain points → check feature matrix → find unchecked cells
- Cross-reference MR «current behavior» → are workarounds indicating gaps?

Present 2-4 gaps, each potentially a differentiator.

### Step 7: Draft CA

Structure:

```markdown
# Competitive Analysis

## Competitor Shortlist (<N>)

Based on <discovery methodology>, shortlisted:
- Competitor A (direct, mature, enterprise-focused)
- Competitor B (direct, mid-market)
- Competitor C (adjacent, different angle)
- ...

## Feature Matrix

[table from Step 3]

## Positioning

[map from Step 4]

## Per-competitor profiles

### <Competitor A>
Positioning: <tagline>
Target: <who>
Core features: ...
Pricing: ...
Strengths: ...
Weaknesses: ...
Sources: ...

...

## Market gaps

1. **<Gap>** — <which competitors miss it, why it matters>
2. **<Gap>**
3. **<Gap>**

## Sources

| # | Competitor / Source | Type | Date | URL |
|---|---|---|---|---|
...

## Confidence note

Conducted в Quick mode (~30-45 min). 
Sources: direct site visits + X comparison articles + Y reviews.
Confidence: medium — positioning и features surveyed, но pricing details for enterprise-tier competitors не verified beyond public info.
```

### Step 8: Tag weak claims

Same as MR: any claim without 2+ sources → `[оценочно]`. Especially true for:
- Customer counts (often outdated/inflated)
- Pricing (enterprise pricing often custom)
- Market share percentages

### Step 9: Queue for DRC

CA draft → status=`draft`, queued for Discovery Review Checkpoint (A2 modification).

Brief note:
```
CA draft ready (<N> competitors, <N> gaps identified).
Queued for Discovery Review Checkpoint (after SEG creation).

Continuing to D1.4 Segment & JTBD Definition...
```

## Time budget

Target: 30-45 min.
- Discovery: 10 min
- Per-competitor profiling: 30 min (5-10 min × 4-7 competitors)
- Matrix + synthesis + drafting: 10 min

If >60 min in Quick mode — wrap up.

## Fallback when MCPs unavailable

| Missing | Fallback |
|---|---|
| Exa AI | Brave semantic-ish queries + user's domain knowledge |
| Firecrawl | WebFetch (less structured) |
| GitHub MCP | Brave search site:github.com |

## Anti-patterns

1. **Over-shortlisting.** 15 competitors = shallow. Pick 4-7.
2. **Feature-by-feature exhaustive matrix.** Focus on differentiators + must-haves, не every feature.
3. **Positioning without evidence.** «X is expensive» — cite pricing page.
4. **Ignoring adjacent competitors.** Sometimes biggest threat не direct — it's adjacent (e.g., «users just use Gmail folders and Excel»).
5. **Bias toward established players.** Up-and-coming tools могут be more relevant competitor if moving fast.

## Confidence calibration

- **high** — 5+ competitors profiled, 2+ sources per, independent reviews cross-referenced
- **medium** — 4-6 competitors, mostly self-reported info (site visits only)
- **low** — 2-3 competitors, one-pass scan, significant gaps

State honestly.
