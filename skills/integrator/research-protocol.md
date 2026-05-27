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

3. **Identify environment tier(s) the need applies to** (DEC-DEV-0047 / patch 1.3.3):
   - Default: research must cover **all 3 tiers** (`local_dev`, `staging`, `production`) per recommended tool.
   - If user explicitly scopes to a subset (e.g., "production-only monitoring" or "local dev sandbox"), still note remaining tiers как «not in scope для этого research».
   - Anti-pattern: silent PROD-only research. Pilot session 2026-05-27 evidence — Vercel Pro / Trigger.dev / Hetzner CX32 recommended without local-dev alternatives → vendor lock-in risk before validation.

4. **Identify constraints from project context:**
   - Stack (read `package.json`, `pyproject.toml`, `Cargo.toml`, etc.)
   - Existing tools (`active-tools.yaml`)
   - Project tier (`product.yaml.validation_tier` — bias toward simpler if `pilot`)
   - Project language (avoid English-only tools if project is non-English UX)
   - Budget hints (if user mentioned "free tools only" anywhere recent)

5. **Sanity check scope.** If the need is too broad ("tools for development"), narrow it before searching:
   - Ask user to specify, OR
   - Pick the most likely interpretation and state it explicitly

6. **Consilium-pattern check** (DEC-DEV-0047 / patch 1.3.3 / SPEC §7.6):
   - If you intend to fan out into N ≥ 2 parallel research priors (different bias anchors — e.g., DIY/PaaS/managed-cloud) — **scope MUST be declared before fan-out**: subject, prior labels, expected comparison axes.
   - If you find yourself contemplating fan-out without explicit user-declared scope — STOP and surface the consilium block (см. Phase 5). Default to single-stream research.

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
- **`environment_tiers` per SPEC §4.1 + §4.2.1** (DEC-DEV-0047 / patch 1.3.3): local_dev / staging / production × `full | partial | none` + free-form notes. OR `environment_agnostic: true` if tool is genuinely environment-independent (linter, formatter, schema validator). **Both forms are explicit; default-omit is forbidden.**
- Inputs / outputs / contracts the tool implies
- Configuration requirements
- Known issues
- Comparison axes vs other candidates

**Don't fabricate.** If you can't verify a claim, mark confidence as low. Better to say "unknown if X" than invent.

**Environment tier extraction guidance:**
- Read docs sections on «local development», «getting started», «self-host», «runtime requirements» for `local_dev` evidence.
- Read «deployment», «production», «scaling», «pricing» sections for `production` evidence.
- For `staging` — usually inferred from production setup minus monitoring/scaling; mark `partial` if tool has no explicit staging story but supports lower-tier deployment.
- If tool is cloud-only PaaS without local emulator (e.g., Vercel Production, AWS Lambda runtime) → `local_dev.suitability: none`, `notes` explains «requires cloud account», suggest local alternatives in comparison Phase 5.
- If tool is CLI / library without runtime networking (e.g., eslint, prettier, ajv) → `environment_agnostic: true` with one-line rationale.

### Phase 5: Comparison & recommendation (10 min)

**Goal:** Synthesize findings into actionable recommendation.

#### 5.0. Pre-presentation guards (DEC-DEV-0047 / patch 1.3.3)

Before rendering comparison + recommendation, run two guards. If either fails — DO NOT proceed to Phase 6 caching or write to journal:

**Guard A — environment_tiers completeness.** For each shortlisted candidate, verify profile contains `environment_tiers` block (3 tiers × suitability) OR `environment_agnostic: true`. Missing both = profile is incomplete. STOP, return to Phase 4 to extract; if extraction impossible (docs ambiguous), flag tier as `partial` with `notes: "unverified — needs verification"` rather than skip.

**Guard B — consilium-scope check** (SPEC §7.6). If research used N ≥ 2 parallel research priors (subagent fan-out > 1) — was scope explicitly declared by user before fan-out?
- **Yes** (subject + priors + axes were stated) → proceed to comparison.
- **No** → STOP. Render this block instead of comparison:

```
⚠ Consilium-pattern detected (N=<count> parallel research priors), но scope не объявлен.
SPEC §7.6 violation: fan-out требует declared scope.

Перед продолжением:
  - Объяви scope явно: subject (что именно сравниваем), priors (направления —
    list of labels), expected axes (cost / control / vendor lock-in / etc.)
  - Или сведи к single research stream (выбрать наиболее релевантный prior)
  - Или отмена

Что делаем? [1] объявить scope / [2] single-stream / [3] отмена]
```

Wait for explicit user response — НЕ default to a single prior silently.

#### 5.1. Output (after guards pass)

1. **Comparison table** — common axes across candidates (PMO coverage, pros, cons, fit, maturity). **Must include per-tier suitability column** OR `environment_agnostic` annotation per tool.
2. **Narrative recommendation** — your top pick(s) with reasoning, scoped per environment tier where applicable (e.g., «for local_dev — tool A; for production — tool B; staging — A or B depending on cost»).
3. **Alternative scenarios** — "if you also need X, consider Y instead"
4. **Open questions** — things you couldn't resolve, list explicitly
5. **Confidence statement** (C2 modification) — your overall confidence in this recommendation
6. **«🚧 Требует USER» actions** — if any recommendation entails user signing up for a service / registering an account / obtaining API keys / registering legal entity / similar — these MUST be enumerated as a structured list (see Phase 7).

Format per `/integrator:research` Step 5-6 output template.

#### 5.2. Hard approve gate (DEC-DEV-0047 / patch 1.3.3)

After rendering Phase 5.1, append the hard approve gate from `commands/integrator/research.md` Step 7:

```
STOP. Approve research outcome?
  [<number>] install <tool> recommendation
  [defer]    save research, no install now
  [details]  expand any candidate / tradeoff
```

**NO action beyond Phase 6 caching is taken without explicit user response.** «No response» ≠ «proceed». If user is silent → wait. If user says «defer» → write to journal with status=deferred, do NOT cache as «active recommendation», do NOT chain into `/integrator:add`.

This is symmetrical с `commands/integrator/add.md` Stage 2 gate (DEC-DEV-0047 / patch 1.3.3 B-4).

### Phase 6: Caching (2 min)

Save research to `~/.claude/integrator/research-cache/<YYYY-MM-DD>-<slug>.md`:
- Full research output
- Sources cited (with URLs)
- Date for staleness (research expires after 7 days for re-validation)

This cache is **global** — reusable across projects. Next time someone researches similar need, can leverage.

### Phase 7: Journal entry (1 min)

Append to journal per `/integrator:research` Step 8.

### Phase 8: Pending-actions append (DEC-DEV-0047 / patch 1.3.3)

If Phase 5 recommendation entails any «🚧 Требует USER» action (account signup, API key obtain, legal entity registration, manual config in 3rd-party UI) — these MUST be appended to `.claude/pending-actions.md` as structured entries (PA-NNN), even if user defers the install.

Use `.claude/skills/ecosystem/user-action-tracker.md` skill для proper PA-NNN counter + schema. Source field: `integrator`. Trigger field: `/integrator:research "<args>"` или DEC-INT-RESEARCH-NNN.

**Why:** pre-1.3.3 pilot session 2026-05-27 evidence: «🚧 Требует USER» blocks растворялись в narrative research output, юзер пропускал обязательные external actions. Structured `.claude/pending-actions.md` обеспечивает visibility через `/ecosystem:pending-actions`.

**Anti-pattern:** burying USER actions in narrative «before installing, you'll need to sign up for X». Surface them as separate PA entries.

## Anti-patterns to avoid

1. **Recency bias** — newest tool isn't always best. Mature tools with stable APIs often win for production.
2. **Star bias** — high GitHub stars ≠ right for this project. Stars correlate with hype, not fit.
3. **Feature comparison fatigue** — don't list 30 features per tool. Focus on what matters for the **restated need**.
4. **Unstated assumptions** — if you assume project will scale to 1M users when current tier is `pilot`, state the assumption explicitly.
5. **Premature recommendation** — if you only researched for 5 minutes, say so. Don't fake confidence.
6. **Single source** — every significant claim should be cross-referenced from 2+ sources OR explicitly marked as single-source.
7. **PROD-only recommendations** (DEC-DEV-0047). Recommending a tool without saying how it applies to local_dev / staging is a research bug. Pilot 2026-05-27 evidence: «Vercel Pro / Trigger.dev / Hetzner CX32» recommended without local-dev alternatives → vendor lock-in commitment before validation. Mandate: every recommendation either has `environment_tiers` block or `environment_agnostic: true`.
8. **Silent consilium fan-out** (SPEC §7.6 / DEC-DEV-0047). Subagent fan-out > 1 priors без declared scope (subject + priors + axes) — выглядит как «exhaustive research», на деле AI самостоятельно выбирает architectural direction без user input. Apply: Guard B in Phase 5.0 blocks this — STOP + ask user перед fan-out.
9. **Silent automatic chaining research → install.** After comparison, NO automatic call к `/integrator:add` без explicit user approve (Phase 5.2 gate). Caching и journal entry — OK; install — нет.
10. **Lost USER actions** (DEC-DEV-0047). Если recommendation entails signup / API keys / account registration / legal-entity work — это MUST be appended as PA entry per Phase 8. Burying в narrative — silent gap для пользователя.

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
