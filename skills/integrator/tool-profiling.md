---
description: How to extract structured tool metadata into YAML profile per docs/integrator-module/SPEC.md §4. Used during /integrator:research and /integrator:add.
---

# Tool Profiling — Skill for Integrator

Extract structured tool metadata into YAML profile per `docs/integrator-module/SPEC.md §4.1`.

## When invoked

- During `/integrator:research` — generate **draft profile** per candidate (lighter version)
- During `/integrator:add` — generate **full profile** before installation
- During `/integrator:update` — refresh existing profile after version change
- During `/integrator:debug` — re-verify profile when troubleshooting

## Profile schema (full)

Polный profile имеет **4 sections:** identity + metadata + declared coverage + empirical tracking. Смотри также:
- `.claude/docs/integrator-module/SPEC.md §4.1` — authoritative schema
- `.claude/docs/integrator-module/SPEC.md §4.4` — usage_stats details
- `.claude/skills/integrator/usage-tracking.md` — как empirical data collected
- `.claude/skills/integrator/smoke-test-protocols.md` — per-category verification

```yaml
# ~/.claude/integrator/tool-catalog/<tool>.yaml

tool:
  name: <tool-name>
  version_installed: <version>           # null if research only
  source: npm | pip | git | mcp | binary
  source_spec: <full install spec>       # e.g., "beads@1.2.0", "github:org/repo#tag"
  installed_at: YYYY-MM-DD                # null if research only
  last_verified: YYYY-MM-DD
  last_smoke_test: YYYY-MM-DDThh:mm       # per smoke-test-protocols skill
  last_smoke_result: pass | fail | skipped | partial
  home_url: <homepage URL>
  docs_url: <documentation URL>

metadata:
  category: implementation | spec-gen | testing | monitoring | deploy | infrastructure | other
  claude_primitives:
    - type: command | agent | hook | skill | mcp
      path: <file path the tool brings>
      purpose: <one-line>
  language: js | ts | py | rust | go | other
  license: MIT | Apache-2.0 | GPL | proprietary | other

pmo_coverage:
  D<N>-<NN>:                              # process ID from pmo-map.md
    confidence: high | medium | low | none
    evidence: "<why you believe this>"
    how: "<command or mechanism>"

inputs:
  - type: <input type>
    from: <upstream tool/source>
    format: markdown | yaml | json | text | other
    schema_ref: <contract file path>
    adapter: <adapter script if needed>

outputs:
  - type: <output type>
    to: <downstream consumer or 'human' or 'any'>
    format: <format>
    schema_ref: <contract>

configuration:
  config_files:
    - path: <relative path>
      purpose: <one-line>
      owned_by: integrator | user | tool
      editable: true | false
  env_required:
    - <ENV_VAR>:
        required: true | false
        stored_in: file | vault | 1password
        purpose: <one-line>
  global_settings:
    - key: <setting key>
      inherits_from: <source>

conflicts:
  - with: <other-tool-name>
    nature: <description of conflict>
    resolution: <how it was/will be handled>
    decided_at: YYYY-MM-DD

notes:
  - <free-form observations>
  - <known issues>
  - <usage tips>

# v1 modification: profile meta-confidence (how sure YOU are about the profile)
confidence:
  profiling: high | medium | low           # confidence in this profile's accuracy
  profiling_notes: "<what's verified vs assumed>"
  last_audit: YYYY-MM-DD                   # last time profile was verified against actual tool

# v1 modification (gap 3 fix): empirical usage tracking (§4.4)
# Collected per usage-tracking.md skill — не filled в при profile creation,
# populated continuously by adapter autoinstrumentation
usage_stats:
  invocations: 0                           # incremented per invocation
  successes: 0
  failures: 0
  failure_rate_percent: 0.0
  last_success: null
  last_failure: null
  first_tracked: <will be set on first use>
  stats_reset_at: <creation timestamp>
  recent_failures: []                      # last 5
  empirical_confidence: null               # computed when >=5 invocations
  stats_window: "rolling-20"
  confidence_last_computed: null
```

## Process

### Step 1: Identify source

Determine where the tool comes from:
- **npm**: check npmjs.com via Context7 MCP or WebFetch
- **PyPI**: check pypi.org
- **Git**: check repository (GitHub/GitLab/etc.) via GitHub MCP if applicable
- **MCP**: check Claude/MCP registry
- **Binary**: check vendor docs

### Step 2: Read official documentation

Use Context7 (preferred) or Firecrawl on docs URL. Extract:
- Installation method
- Configuration files needed
- Commands/API exposed
- Default integrations / outputs

Don't skim — read the README + getting-started + API reference.

### Step 3: Inspect the source code (if open-source)

For tools that bring `claude_primitives` (commands, hooks, agents, skills):
- Locate the actual files in the package
- Read entry points
- Check installation script (what files it copies, where)

This is critical: the tool's profile should accurately reflect what it adds to the user's `.claude/`.

### Step 4: Determine PMO coverage

For each PMO process ID (D1-01, D2-02, etc.) the tool might cover:

**Confidence levels:**
- **high** — explicitly documented + you've verified through smoke test or example
- **medium** — documented but not verified on this stack
- **low** — inferred from indirect signals (issue tracker discussions, blog posts, naming)
- **none** — explicitly NOT covered or no signal

**Evidence is required.** Don't claim "high" without pointing to docs section or test result. Empty evidence → degrade to "medium" or "low".

### Step 5: Determine inputs and outputs

For each input the tool consumes:
- What format? (markdown, JSON, files in specific dir)
- From where? (Product Module handoff, another tool's output, manual)
- Is adaptation needed? (note adapter requirement)

For each output the tool produces:
- What format?
- To whom? (human, another tool, stored only)
- Schema if structured

### Step 6: Identify configuration requirements

What does the tool need to operate?
- Config files (paths, owner)
- Environment variables (which, where stored)
- Global settings (model, language, etc.)

For env vars containing secrets — note `stored_in: file` (per DEC-INT-O10 v1 default).

### Step 7: Conflict detection (call /integrator:scan)

Before recommending installation, check baseline:
- Does tool want to add files where user files already exist?
- Does tool's namespace collide with existing commands?
- Does tool's MCP duplicate already-installed MCP?

Conflicts go into `conflicts:` section of profile.

### Step 8: Notes and known issues

From research:
- Known bugs (open GitHub issues with high reactions)
- Platform-specific quirks (Windows/macOS/Linux)
- Performance characteristics
- Community advice ("don't use feature X" type warnings)

### Step 9: Confidence statement

Per C2 modification — explicitly state your confidence in the profile:

```yaml
confidence:
  profiling: medium
  profiling_notes: "Based on docs + 2 community reviews; haven't run smoke test on our stack. Most data points verified, but PMO coverage for D2-04 is inferred from issue discussion, not docs."
  last_audit: 2026-04-18
```

### Step 10: Initialize empirical tracking

При создании profile — initialize `usage_stats` section пустым (no invocations yet):

```yaml
usage_stats:
  invocations: 0
  successes: 0
  failures: 0
  failure_rate_percent: 0.0
  first_tracked: null                      # set at first invocation
  stats_reset_at: 2026-04-18T15:30:00Z     # profile creation time
  recent_failures: []
  empirical_confidence: null               # no data yet
  stats_window: "rolling-20"
  confidence_last_computed: null
```

После первых invocations через Integrator adapters — autoinstrumentation (see `usage-tracking.md` skill) обновляет these fields. При `/integrator:add` — run smoke test per `smoke-test-protocols.md` — result фиксируется в `last_smoke_test` / `last_smoke_result`.

### Step 11: Update pmo-mapping.yaml

После создания profile — update project-local `.claude/integrator/pmo-mapping.yaml` per integrator SPEC §4.3 schema:

```yaml
# For each PMO process this tool covers
coverage:
  D2-Tech-02:
    covered_by: [cc-sdd]                   # add this tool
    primary: cc-sdd                        # set if first tool for this process
    declared_confidence: high              # from this profile
    empirical_confidence: null             # will populate after 5+ invocations
    confidence_source: declared            # no empirical data yet
    effective_confidence: high             # = declared when no empirical
    since: 2026-04-18
    last_smoke_test: 2026-04-18
    last_smoke_result: pass
    contracts: [CNT-001]                   # if contracts created together
```

Если несколько tools претендуют на ту же зону (OQ-I9 multi-tool) — добавь в `covered_by[]`, set `secondary[]`.

## Profile reuse

Profiles are **global** (`~/.claude/integrator/tool-catalog/`) — reused across projects.

When using a cached profile in a new project:
1. Check `last_audit` — refresh if >30 days old
2. Re-verify version_installed if installing fresh
3. Re-evaluate `confidence.profiling` for new context

## Light vs full profile

**Light profile** (during /integrator:research, multiple candidates):
- tool: name, source, source_spec, home_url, docs_url
- metadata: category, language, license
- pmo_coverage: top-level mapping with confidence
- Notes: 2-3 key observations

**Full profile** (during /integrator:add, one tool):
- All sections complete
- All claims with evidence
- Conflicts checked
- Confidence stated

Don't waste effort doing full profile for tools you might not install.

## Anti-patterns

1. **Vague evidence.** "Looks good" — no. "README explicitly mentions Y in §3" — yes.
2. **Confidence inflation.** Don't mark `high` to make tool look attractive. Mark honestly.
3. **Skipping conflict check.** Always run mental scan before profiling completes.
4. **Outdated profile reuse.** If `last_audit` is stale, refresh — tools change.
5. **Single source for major claims.** PMO coverage statements should be cross-referenced.
