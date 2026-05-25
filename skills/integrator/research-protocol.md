---
description: Multi-step methodology for researching tools to fill PMO needs. Used by /integrator:research and tool-researcher subagent.
---

# Research Protocol — Skill for Integrator

This skill describes **how** to research tools systematically. Used by `/integrator:research` command and `tool-researcher` subagent.

## Phases

### Phase 1: Need analysis (5 min)

**Goal:** Understand the actual need before searching.

1. **Restate the need in your own words.** "User wants X — that means tool must do Y because Z." If the restatement diverges from user's words significantly — clarify before researching.

2. **Identify PMO zone(s).** Reference `.claude/docs/pmo/pmo-map.md`. Be specific:
   - Not "testing" — but "D4-03 Test Implementation & Execution (unit/integration/e2e)" or "D4-07 NFR/Perf/Security Testing"
   - Not "deployment" — but "D3-04 Build & Dependency Management" or "D3-06 Deployment & Release Execution (incl. rollback)"

3. **Identify constraints from project context:**
   - Stack (read `package.json`, `pyproject.toml`, `Cargo.toml`, etc.)
   - Existing tools (`active-tools.yaml`)
   - Project tier (`product.yaml.validation_tier` — bias toward simpler if `pilot`)
   - Project language (avoid English-only tools if project is non-English UX)
   - Budget hints (if user mentioned "free tools only" anywhere recent)

4. **Sanity check scope.** If the need is too broad ("tools for development"), narrow it before searching:
   - Ask user to specify, OR
   - Pick the most likely interpretation and state it explicitly

### Phase 2: Discovery (10-20 min)

**Goal:** Find candidate tools.

Use parallel MCP calls when possible. Strategy depends on need type:

**For known-name tools** (user mentioned specific tool):
1. Context7 — get official docs
2. GitHub MCP — repo health (stars, last commit, contributors)
3. Skip discovery, go straight to profiling

**For category exploration** (user described need, no specific tool):
1. Brave Search — keyword lookup ("react testing tool 2026", "postgres migration tool node")
2. Exa AI — semantic search ("tools that solve <restated need>")
3. Firecrawl — scrape top comparison articles ("best X tool", "X vs Y")
4. GitHub MCP — search topics and repos

**For specialized domains** (e.g., compliance, ML ops):
1. Add academic / industry-specific sources
2. Check community-curated lists (awesome-* repos via GitHub MCP)

**Always check** Memory MCP for prior research on this category — don't redo work.

**Limit candidates to ~10** before next phase. Don't try to evaluate 50 tools.

### Phase 3: Filtering (5-10 min)

**Goal:** Narrow to 2-5 strong candidates.

Filters (apply in order):

1. **Compatibility** — does tool's runtime/language match project? (Drop incompatible.)
2. **Maturity** — last commit date < 6 months for serious recommendation. Mark unmature with explicit warning.
3. **License** — drop if license incompatible with project intent.
4. **Active maintenance** — issues being addressed, PRs being merged.
5. **Community signal** — stars, downloads, blog mentions (proxy for "people actually use it").
6. **Documentation quality** — quick check via Firecrawl on docs URL. Drop tools with poor/missing docs.

After filtering, you should have 2-5 candidates. If only 1 — present that one clearly. If 0 — report "no good candidates" with reasons rather than recommending weak options.

### Phase 4: Profiling (15-30 min — can parallelize per candidate)

**Goal:** Extract structured data per candidate.

For each candidate, follow `.claude/skills/integrator/tool-profiling.md`. Result: a draft profile YAML per tool.

**Key things to extract:**
- PMO coverage with **honest confidence levels** (high/medium/low/none) and evidence
- Inputs / outputs / contracts the tool implies
- Configuration requirements
- Known issues
- Comparison axes vs other candidates

**Don't fabricate.** If you can't verify a claim, mark confidence as low. Better to say "unknown if X" than invent.

### Phase 5: Comparison & recommendation (10 min)

**Goal:** Synthesize findings into actionable recommendation.

1. **Comparison table** — common axes across candidates (PMO coverage, pros, cons, fit, maturity)
2. **Narrative recommendation** — your top pick(s) with reasoning
3. **Alternative scenarios** — "if you also need X, consider Y instead"
4. **Open questions** — things you couldn't resolve, list explicitly
5. **Confidence statement** (C2 modification) — your overall confidence in this recommendation

Format per `/integrator:research` Step 5-6 output template.

### Phase 6: Caching (2 min)

Save research to `~/.claude/integrator/research-cache/<YYYY-MM-DD>-<slug>.md`:
- Full research output
- Sources cited (with URLs)
- Date for staleness (research expires after 7 days for re-validation)

This cache is **global** — reusable across projects. Next time someone researches similar need, can leverage.

### Phase 7: Journal entry (1 min)

Append to journal per `/integrator:research` Step 8.

## Anti-patterns to avoid

1. **Recency bias** — newest tool isn't always best. Mature tools with stable APIs often win for production.
2. **Star bias** — high GitHub stars ≠ right for this project. Stars correlate with hype, not fit.
3. **Feature comparison fatigue** — don't list 30 features per tool. Focus on what matters for the **restated need**.
4. **Unstated assumptions** — if you assume project will scale to 1M users when current tier is `pilot`, state the assumption explicitly.
5. **Premature recommendation** — if you only researched for 5 minutes, say so. Don't fake confidence.
6. **Single source** — every significant claim should be cross-referenced from 2+ sources OR explicitly marked as single-source.

## When to escalate to subagent

Use `tool-researcher` subagent (isolated context) when:
- Researching 4+ candidates in depth (preserves main session context)
- Tool has extensive ecosystem (e.g., comparing whole frameworks)
- User asked for "deep research" mode

Don't use subagent for:
- Quick lookups ("what version of X is current")
- Already-cached research (just read cache)
- Profiling a single tool the user explicitly named (do it inline)

## Confidence calibration

State your overall research confidence per these criteria:

- **High** — 5+ sources cross-referenced, official docs read, recent (last 30 days), known production deployments observed
- **Medium** — 2-4 sources, official docs read, mostly recent, some unverified claims
- **Low** — 1-2 sources, primary docs only, recent claims unverified, or significant unknown territory

**State confidence honestly.** Pilot project deserves a "medium" confidence research over a fake "high" — user can decide whether to dig deeper.
