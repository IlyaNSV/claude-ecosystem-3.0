---
description: Generate .claude/integrator/tool-docs/<tool>.md per SPEC §14 style guide (API reference, universal English, project-agnostic). Used at /integrator:add Stage 6 (initial) and /integrator:update Stage 5 (refresh after version bump).
---

# Tool-Docs Generator — Skill for Integrator

Generate the **operating manual** for an installed tool at `.claude/integrator/tool-docs/<tool>.md`. Target reader: future Orchestrator Module + any human developer arriving without project context.

Authoritative style: `docs/integrator-module/SPEC.md §14` (read this section before generating; §14.2 has the mandatory structure, §14.5 has a minimal cc-sdd example).

## When invoked

- `/integrator:add <tool>` **Stage 6** — initial generation after verify smoke passes
- `/integrator:update <tool>` **Stage 5** — refresh sections affected by version diff
- `/integrator:docs --tool <name>` — regenerate on demand (shipped Phase 7, DEC-DEV-0176)

## Style invariants (SPEC §14.1)

1. **Language: universal technical English.** Not Russian, not conversational.
2. **Style: API reference.** Short definitions, tables, signatures, exit codes, examples. No introductions, no "why this tool exists" — that's journal territory.
3. **Project-independent.** No `TranslateIT`, FM-IDs, this product's terminology. The doc describes the **tool**, not the use.
4. **Contract-oriented.** Inputs / outputs / side effects / exit codes. What Orchestrator needs to call the tool and process the result.
5. **Versioned.** Tool version + last-verified date in `Identity` section.

## Mandatory structure (SPEC §14.2)

```markdown
# <tool-name> — Operating Manual

## Identity
- Tool: <name>
- Version: <semver>
- Source: <npm|pip|git|mcp|binary> (<install spec>)
- Installed: <YYYY-MM-DD>
- Last verified: <YYYY-MM-DD>
- Profile: ~/.claude/integrator/tool-catalog/<tool>.yaml
- Category: <category from profile>

## Capabilities
Table: PMO zone × command × confidence × evidence

## Commands
For each command:
- Signature: `/<cmd> [options]`
- Inputs required: files, env vars, preceding state
- Outputs produced: files created, state changes
- Exit codes: 0 | 1 | 2 | ... with meaning
- Runtime estimate: typical and max
- Idempotent: yes/no
- Parallelizable: yes/no (and with what)
- Example invocation: minimal working example
- Example output: excerpt

## Data Flow
- Consumes from: list of contracts (CNT-*)
- Produces for: list of contracts (CNT-*)
- Ownership: which directories it writes

## Integration Points
- Preceded by: tools/commands that must run before
- Followed by: typical next steps
- Parallel-safe with: tools that can run concurrently

## Operating Protocols
- Order-of-operations rules
- Session guarantees (fresh context? preserved state?)
- Resource constraints (max file size, token limits)

## Known Issues
- Issue: description
  - Workaround: steps
  - Status: open/fixed in vX.Y

## Error Catalog
| Error | Meaning | Orchestrator action |
|---|---|---|
| ERR001 | Config missing | Re-run /integrator:verify |

## Telemetry
- Log location
- Metrics exposed
- Health check command
```

## Generation process

### Step 1 — Gather sources

- Tool profile: `~/.claude/integrator/tool-catalog/<tool>.yaml`
- Active contracts: `.claude/integrator/contracts/CNT-*.yaml` (filter to ones referencing this tool)
- Smoke observations: `--verify-only` output from Stage 6
- Upstream docs: README / CLI help / API reference (use Context7 MCP if available; else WebFetch)
- Decision journal: scan for `#<tool>` entries — known issues, workarounds

### Step 2 — Fill Identity section

Direct from profile + install metadata. No prose.

### Step 3 — Build Capabilities table

For each `pmo_coverage` entry in profile:

```markdown
| PMO zone | Command | Confidence | Evidence |
|---|---|---|---|
| D2-T01 (Architecture Design) | /kiro:spec-design | high | README §3 + example projects |
| D2-T06 (Task Decomposition) | /kiro:spec-tasks | high | docs/spec-tasks.md + smoke pass |
| D2-T04 (API Contract — embedded) | /kiro:spec-design | partial | spec-design body covers but no dedicated command |
| D2-B02 (Feature Specification — boundary) | /kiro:spec-init (consumes) | n/a | consumed via handoff; Product Module owns |
```

Use canonical pmo-map.md IDs (DEC-DEV-0040). For boundary zones — explicit "consumes" annotation per SPEC §8 boundary model.

### Step 4 — Build Commands section

For each command the tool registers (`claude_primitives[]` type=command, plus any non-Claude CLI exposed):

- **Signature**: `/<cmd> [args] [options]`
- **Inputs required**: list of preceding state, env vars, files
- **Outputs produced**: files written, state mutated
- **Exit codes**: from upstream docs or empirical from smoke
- **Runtime estimate**: from smoke timing or docs
- **Idempotent**: yes/no (does re-running yield same state?)
- **Parallelizable**: yes/no + what it conflicts with
- **Example invocation**: shortest working example
- **Example output**: excerpt (3-5 lines)

If exit codes / runtime not documented and not empirically obtained → write `unknown — needs probe`. Don't fabricate.

### Step 5 — Data Flow

- **Consumes**: list contract IDs where tool is `consumer`. For each, reference upstream artifact location.
- **Produces**: list contract IDs where tool is `producer`. For each, downstream consumer + artifact location.
- **Ownership**: directories the tool writes to (e.g., `.kiro/specs/`). Critical for Environment Scanner conflict detection.

### Step 6 — Integration Points

- **Preceded by**: e.g., "always /kiro:steering before first spec-*"
- **Followed by**: typical pipeline successor (e.g., spec-init → spec-requirements → spec-design)
- **Parallel-safe with**: tools that can run concurrently without race conditions

### Step 7 — Operating Protocols

Rules Orchestrator needs to invoke the tool correctly:
- Order constraints
- Session/context guarantees
- Resource limits (max file size, token budgets)

### Step 8 — Known Issues + Error Catalog

- Pull from upstream GitHub issues (high-reaction open issues)
- Cross-reference decision journal `#<tool>` entries for workarounds we've discovered
- Error catalog: explicit error codes mapped to Orchestrator's response action

### Step 9 — Telemetry

- Log file locations
- Metrics exposed (Prometheus endpoint? log statements?)
- Health check command (if any)

If tool has no telemetry → say so explicitly: "No telemetry exposed; observability via stdout logs only."

## Manual edit preservation (SPEC §14.4)

Sections wrapped in `<!-- manual: do not regenerate -->` / `<!-- /manual -->` markers are preserved verbatim across regenerations. Use for project-specific Operating Protocols overrides or hand-written troubleshooting that Integrator can't infer.

Example:
```markdown
## Operating Protocols

<!-- manual: do not regenerate -->
- Always pin cc-sdd to ^2.1.0 in this project (per DEC-INT-NNN);
  newer versions break our custom .kiro/steering/product.md overlay.
<!-- /manual -->

- ALWAYS /kiro:steering before first spec-* in fresh project
- spec-requirements MUST precede spec-design
```

Regenerator skips edits inside `manual` blocks.

## Anti-patterns

1. **Russian or conversational tone.** Tool-docs is API reference for machines + cold-context humans. English only.
2. **Project-specific content.** No FM-IDs, no this-product terminology, no business rationale. That's `.product/`'s job.
3. **Marketing claims.** "Best-in-class spec generation" → out. "Generates `.kiro/specs/<feature>/spec.json`" → in.
4. **Fabricating exit codes / runtime.** If unknown → write `unknown — needs probe`. Lying degrades Orchestrator decisions.
5. **Missing "boundary" annotation** on zones the tool consumes-but-doesn't-own. Orchestrator must know who really owns the zone (per DEC-DEV-0040 Q3 boundary reframe).
6. **Regenerating over manual blocks.** Always preserve `<!-- manual: ... -->` content.
7. **Skipping the smoke observations.** Empirical runtime + exit codes from Stage 6 verify smoke are higher-value than docs claims; use them.

## Cross-reference

- `docs/integrator-module/SPEC.md` §14 — authoritative style guide
- `commands/integrator/add.md` — Stage 6 consumer
- `commands/integrator/update.md` — Stage 5 consumer (refresh)
- `~/.claude/integrator/tool-catalog/<tool>.yaml` — primary input data
- `.claude/integrator/contracts/CNT-*.yaml` — Data Flow source
