# cc-sdd — Operating Manual

## Identity

- Tool: cc-sdd
- Version: 3.0.2
- Source: npm (`npx cc-sdd@latest`)
- Installed: 2026-05-26
- Last verified: 2026-05-26
- Profile: ~/.claude/integrator/tool-catalog/cc-sdd.yaml
- Category: spec-gen
- License: MIT
- Repository: https://github.com/gotalab/cc-sdd
- Docs: https://github.com/gotalab/cc-sdd/blob/main/tools/cc-sdd/README.md

## Capabilities

| PMO zone | Skill | Confidence | Evidence |
|---|---|---|---|
| D2-T01 (Architecture Design) | /kiro-spec-design | medium | README §"Skills"; output: design.md with Mermaid + File Structure Plan |
| D2-T04 (API Contract Design) | /kiro-spec-design (embedded) | medium-partial | Interface contracts implicit in design.md; no standalone artifact |
| D2-T06 (Task Decomposition) | /kiro-spec-tasks | high | README + project pmo-map.md line 191; output: tasks.md with `_Boundary:_` + `_Depends:_` annotations |
| D2-B02 (Feature Specification — boundary) | /kiro-spec-init (consumes) | n/a | Consumed via handoff; Product Module owns |

## Commands (skills)

cc-sdd installs as Claude Code skills under `.claude/skills/kiro-*/`. Invoked via slash commands `/kiro-*`.

### /kiro-discovery

- **Signature:** `/kiro-discovery <idea-or-problem-description>`
- **Inputs required:** free-text problem description; optional existing codebase context
- **Outputs produced:** `.kiro/specs/<feature>/brief.md`; for multi-spec problems also `roadmap.md`
- **Exit codes:** N/A (Claude Code skill, not standalone CLI)
- **Runtime estimate:** unknown — needs probe
- **Idempotent:** no (re-invocation re-classifies based on current input)
- **Parallelizable:** no (single discovery per session)
- **Example invocation:** `/kiro-discovery "Build authentication for solo creators"`

### /kiro-spec-init

- **Signature:** `/kiro-spec-init <feature-name>`
- **Inputs required:** `.kiro/specs/<feature-name>/brief.md` (optional but recommended — pre-fills project description, skips clarification)
- **Outputs produced:** `.kiro/specs/<feature-name>/spec.json`, `.kiro/specs/<feature-name>/requirements.md` (initial)
- **Exit codes:** N/A (skill)
- **Idempotent:** no (overwrites existing files in spec dir)
- **Parallelizable:** with different feature-names, yes
- **Example:** `/kiro-spec-init fm-001-authentication-accounts`

### /kiro-spec-requirements

- **Signature:** `/kiro-spec-requirements <feature-name>`
- **Inputs required:** `.kiro/specs/<feature-name>/spec.json` (from spec-init); optional `.kiro/steering/` files
- **Outputs produced:** `.kiro/specs/<feature-name>/requirements.md` (EARS-format functional requirements with acceptance criteria)
- **Idempotent:** no
- **Followed by:** `/kiro-validate-gap` (optional), `/kiro-spec-design`

### /kiro-spec-design

- **Signature:** `/kiro-spec-design <feature-name> [-y]`
- **Inputs required:** `.kiro/specs/<feature-name>/requirements.md`
- **Outputs produced:** `.kiro/specs/<feature-name>/design.md` (architecture with Mermaid diagrams, File Structure Plan, interface contracts embedded)
- **Idempotent:** no
- **`-y` flag:** skips interactive design review

### /kiro-spec-tasks

- **Signature:** `/kiro-spec-tasks <feature-name> [-y]`
- **Inputs required:** `.kiro/specs/<feature-name>/design.md`
- **Outputs produced:** `.kiro/specs/<feature-name>/tasks.md` (task list with `_Boundary:_` + `_Depends:_` annotations)
- **Idempotent:** no
- **`-y` flag:** skips review

### /kiro-spec-quick

- **Signature:** `/kiro-spec-quick <feature-name> [--auto]`
- **Inputs required:** free-text or brief.md
- **Outputs produced:** full pipeline output (requirements + design + tasks) in one shot
- **Idempotent:** no
- **Use when:** simple feature with no need for staged review

### /kiro-spec-batch

- **Signature:** `/kiro-spec-batch`
- **Inputs required:** `.kiro/specs/<feature>/roadmap.md` (multi-spec plan from discovery)
- **Outputs produced:** parallel-generated specs across multiple features, dependency-wave ordered
- **Parallelizable:** yes (the skill itself parallelizes subagent dispatch)

### /kiro-spec-status

- **Signature:** `/kiro-spec-status [feature-name]`
- **Inputs required:** none
- **Outputs produced:** status table to stdout; no files written
- **Idempotent:** yes (read-only)
- **Parallelizable:** yes

### /kiro-steering / /kiro-steering-custom

- **Signature:** `/kiro-steering` | `/kiro-steering-custom <document-name>`
- **Inputs required:** existing codebase (for steering) or domain context (for custom)
- **Outputs produced:** `.kiro/steering/*.md` (default: product.md, tech.md, structure.md) or `.kiro/steering-custom/<name>.md`
- **Idempotent:** updates in place
- **Recommended:** first invocation in fresh project before any spec generation

### Validation / verification skills

| Skill | Purpose |
|---|---|
| /kiro-validate-gap | Coverage gap analysis between requirements and existing code |
| /kiro-validate-design | Design quality + completeness review |
| /kiro-validate-impl | Feature-level integration check after task completion |
| /kiro-verify-completion | Fresh-evidence verification before claiming success |
| /kiro-review | Task-local adversarial review (used by reviewer subagents) |
| /kiro-debug | Root-cause debug protocol (used by debugger subagents) |
| /kiro-impl | Long-running autonomous implementation with TDD + auto-debug |

## Data Flow

### Consumes from

- **CNT-001** (status: draft) — product-module `.product/handoffs/FM-NNN-handoff.md` → `.kiro/specs/<slug>/brief.md` via `.claude/integrator/adapters/handoff-to-ccsdd.js`

### Produces for

- Currently none (no downstream contract registered). Future Orchestrator may add `/kiro-impl` → implementation-tool contract.

### Ownership (directories cc-sdd writes to)

- `.claude/skills/kiro-*/` — 17 skill directories (installed at `/integrator:add` time, immutable afterwards)
- `.kiro/settings/templates/` — 16 template files (user-customizable)
- `.kiro/specs/<feature>/` — generated per feature: `spec.json`, `brief.md`, `requirements.md`, `design.md`, `tasks.md`
- `.kiro/steering/` — global project memory (product.md, tech.md, structure.md by default)
- `.kiro/steering-custom/` — domain-specific steering documents

### Does NOT touch

- `.claude/settings.json`, `.claude/hooks/`, `.claude/commands/`, `.claude/agents/`
- `.mcp.json`
- `package.json` (no npm dep installation)
- `.product/` (read-only via adapter)

## Integration Points

### Preceded by

- `/kiro-steering` (recommended first run in fresh project — establishes persistent context)
- Product Module handoff via CNT-001 adapter (if input is FM-NNN-handoff.md)

### Followed by

- Typical pipeline: `/kiro-spec-init` → `/kiro-spec-requirements` → `/kiro-spec-design` → `/kiro-spec-tasks` → `/kiro-impl` (or external implementation tool)
- For multi-spec: `/kiro-discovery` → `/kiro-spec-batch` (parallel)

### Parallel-safe with

- Different feature-names can run spec-* skills concurrently
- `/kiro-spec-status` is read-only, parallel-safe with all
- Conflicts: two spec-* invocations on same feature-name will overwrite each other

## Operating Protocols

- 3-phase approval workflow: Requirements → Design → Tasks → Implementation
- Human review gates between phases unless `-y` flag passed
- Steering should be initialized before first spec-init
- Slug convention: `<feature-id-lowercase>-<title-slugified>` (e.g., `fm-001-authentication-accounts`)
- File language: per `spec.json.language` field (default `en`, project default `ru` here)

## Known Issues

### Issue: `--overwrite skip` skips ALL files in non-TTY mode (not just conflicting ones)
- **Workaround:** Use `--overwrite force` and restore protected files (e.g., project root CLAUDE.md) from backup post-install
- **Status:** open as of 3.0.2 (2026-04-13)
- **Discovered:** 2026-05-26 during `/integrator:add cc-sdd` in this project

### Issue: No `engines` field in package.json
- **Workaround:** Tool was developed against Node 25; tested working on Node 18.20.4 (current project)
- **Status:** open; document upstream

### Issue: Default install writes project root CLAUDE.md
- **Workaround:** Use `--overwrite skip` or `--overwrite force` + manual restore for projects with existing CLAUDE.md
- **Status:** by-design — quickstart guide injection

## Error Catalog

| Source | Symptom | Likely cause | Orchestrator action |
|---|---|---|---|
| npx | `npm ERR! 404 Not Found` | Package name typo or network | Verify spelling: `cc-sdd` (hyphen, not underscore) |
| cc-sdd CLI | `0/N files written, N skipped` | `--overwrite skip` policy and non-TTY → all files treated as skip target | Re-run with `--overwrite force`; restore protected files post-install |
| adapter | `Exit 1` C-06 fail | Handoff is draft/partial | Use production handoff or pass `--allow-draft` to adapter |
| adapter | `Exit 1` C-08 fail | blocking_issues in handoff frontmatter | Resolve blockers in source artifacts; regenerate handoff |
| adapter | `Exit 2` parse error | Frontmatter malformed | Validate handoff has proper `---` delimiters |
| cc-sdd skill | spec.json missing | spec-init never ran for this feature | Run `/kiro-spec-init <feature-name>` first |
| cc-sdd skill | requirements.md missing | spec-requirements not run | Run skills in order: init → requirements → design → tasks |

## Telemetry

- No telemetry exposed; observability via stdout logs only
- Health check: `Test-Path .claude/skills/kiro-discovery/SKILL.md` (Windows) or `ls .claude/skills/kiro-discovery/` (Unix)
- Version check: `npx cc-sdd@latest --version` (does not perform install if just `--version`)

## Cross-references

- Contract: `.claude/integrator/contracts/CNT-001.{yaml,md}`
- Adapter: `.claude/integrator/adapters/handoff-to-ccsdd.js`
- Tool profile: `~/.claude/integrator/tool-catalog/cc-sdd.yaml`
- Project active-tools: `.claude/integrator/active-tools.yaml`
- PMO mapping: `.claude/integrator/pmo-mapping.yaml`
