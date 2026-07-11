---
description: Add an external tool (npm package, MCP server, git repo, or Dockerized shared daemon) under Integrator management. 6-stage flow with approve gate before install. Idempotent re-run after partial failure.
argument-hint: "<tool-name>[@version] [--source npm|mcp|git|binary|docker]"
---

# /integrator:add

User invoked: `/integrator:add $ARGUMENTS`

You are running the **6-stage installation flow** per `docs/integrator-module/SPEC.md §3.2 + §7.2`. This is a **modifying** command — has side effects on `.claude/integrator/`, possibly `package.json`, `.mcp.json`, `.claude/commands|hooks|agents|skills/`.

**Scope (DEC-DEV-0040 Q3 — Integrator-only):** flow ends at Stage 6 "verify" — adapter contract test against fixture. Production runtime routing (real `handoff.md` → external tool invocation) is Orchestrator Module territory, not in this command.

## Process

Methodology: `.claude/skills/integrator/installation-protocol.md` (load this skill).

### Pre-flight: Lazy-init integrator state + session marker

If `.claude/integrator/` doesn't exist (lazy-init per DEC-INT-O08):
```bash
mkdir -p .claude/integrator/{contracts,adapters,tool-docs,backups,secrets}
touch .claude/integrator/secrets/.gitkeep
```

Ensure `.gitignore` excludes `.claude/integrator/secrets/` (per DEC-INT-O10). If missing — append the line and inform user.

Ensure global `~/.claude/integrator/{tool-catalog,research-cache,contract-templates}/` exist; create if missing.

**Session-context marker (DEC-DEV-0047 / patch 1.3.3):** activate `hooks/integrator/scope-guard.js`. Cleanup in Final stage. Boilerplate spec: `skills/integrator/installation-protocol.md §10`.

```bash
printf '{"command":"/integrator:add","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Stage 1/6 — Profile (subagent)

Spawn `tool-profiler` subagent (`.claude/agents/integrator/tool-profiler.md`) via Agent tool with brief:

```
Tool: <name from $ARGUMENTS>
Source spec: <e.g., cc-sdd@latest, derived from $ARGUMENTS + --source flag>
Project baseline: .claude/integrator/baseline.yaml (run /integrator:scan first if absent)
Project tier: <from .claude/product.yaml validation_tier; default pilot>
Available MCPs: <enumerate via Bash if not known>
PMO zones to evaluate: <derive from initial scan or user hint; for cc-sdd default to [D2-T01, D2-T04, D2-T06, D2-B02]>
Existing active-tools: <read .claude/integrator/active-tools.yaml if exists>
Existing user customizations: <from baseline.yaml user_customizations_to_preserve[]>
Depth: full
```

Subagent returns: full YAML profile + UX report block (conflicts, confidence).

**If baseline missing** — invoke `/integrator:scan` first, then re-spawn profiler with populated baseline. Never profile blind.

**Skip re-profiling when catalog is fresh (thin add).** If a recent machine-global profile `~/.claude/integrator/tool-catalog/<tool>.yaml` AND a dated research-cache `~/.claude/integrator/research-cache/*-<tool>.md` already exist (e.g. open-design, profiled in a prior session), do NOT re-spawn `tool-profiler`. Reuse the cached profile and build the Stage 2 card from it. Greenfield tools with no cache still profile normally. This is what makes a second-project `/integrator:add <docker-tool>` thin. The Stage 2 approve gate still fires unconditionally.

### Stage 2/6 — Propose (UX narrative)

Present to user, in this order:

1. **Tool summary card** — name, version, category, license, PMO coverage table (canonical pmo-map IDs only — per DEC-DEV-0040, no phantom IDs like `D2-Tech-02`)
2. **What tool will install into `.claude/`** — list of `claude_primitives[]`
3. **Conflicts** (if any) — render with severity emoji (🔴 blocking, 🟡 warning), present resolution options per conflict
4. **Contracts to create** — preview (e.g., "CNT-NNN: product-handoff → cc-sdd /kiro:spec-init")
5. **PMO coverage delta** — what gaps this closes, what stays uncovered

End with **approve gate**:

```
Approve installation? [y/n/details]
```

- `n` → record cancellation in journal (`#tool-add-cancelled`), exit cleanly, no state mutation beyond `.claude/integrator/` lazy-init
- `details` → expand any section user asks about, re-prompt
- `y` → proceed to Stage 3

**Approve is a gate, not a separate stage** (per SPEC §3.2). All prior stages were read-only.

### Stage 3/6 — Install

Now begin destructive operations. Wrap each in try/catch with rollback path.

1. **Backup baseline** — `cp .claude/integrator/baseline.yaml .claude/integrator/backups/<ISO-timestamp>/baseline.yaml.pre-add-<tool>`
2. **Backup user_customizations_to_preserve[]** that overlap with tool's `claude_primitives[]` — to `.claude/integrator/backups/<timestamp>/<path>`
3. **Execute install command** per `source`:
   - npm: `npx <source_spec> <init-flags-from-profile>` (e.g., `npx cc-sdd@latest --claude-agent --lang ru`)
   - MCP: write entry to `.mcp.json` (or `.claude/settings.json` mcpServers) per tool profile
   - git: `git clone <url> <target>`
   - binary: per profile install instructions
   - **docker (Dockerized shared daemon — SPEC §4.1.1):** do NOT install a package and do NOT write `.claude/` primitives. Instead **validate connectivity** to the shared machine-global daemon:
     1. Resolve the token by precedence (`$OD_API_TOKEN` → `~/.claude/integrator/secrets/<tool>.token` → `./.claude/integrator/secrets/<tool>.token`). If absent, surface the BOOTSTRAP recipe («open-design shared daemon») so the user can generate it; do not fabricate a token.
     2. Health-check: `curl -s -m 5 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/api/health` → expect `200`.
     3. If unreachable: **do NOT auto-`docker run`** (daemon lifecycle is operator-owned). Surface the BOOTSTRAP recipe + ask the user to start the daemon, then retry. The "install" deliverable here is a validated connection, not a package.
4. **Verify install** — run smoke command from profile (e.g., check that `/kiro:steering` is registered; for `docker` tools the smoke IS the `/api/health` 200 above)

If any step fails: surface error, offer rollback (restore baseline backup, uninstall package if possible). Do NOT proceed silently. For `docker` tools there is nothing to uninstall — rollback is just removing the `active-tools.yaml` entry written in Stage 4.

### Stage 4/6 — Configure

1. **Write/update `.claude/integrator/active-tools.yaml`** — append tool entry with: name, version_installed, source_spec, installed_at, claude_primitives[], contracts: [] (filled in Stage 5)
2. **Write/update `.claude/integrator/pmo-mapping.yaml`** per SPEC §4.3 schema. For cc-sdd this means (per DEC-DEV-0040 Q5):
   - `D2-T01` — covered_by: [cc-sdd], primary: cc-sdd, confidence: high (if profile evidence supports), contracts: []
   - `D2-T06` — covered_by: [cc-sdd], primary: cc-sdd, confidence: high
   - `D2-T04` — covered_by: [cc-sdd], confidence: partial (per profile-stage finding)
   - `D2-B02` — note in `boundary:` field that Product Module owns; cc-sdd consumes via handoff
3. **Inherit global settings** — e.g., model_provider from `~/.claude/global-settings.yaml` if applicable
4. **Re-run `/integrator:scan`** to refresh baseline with newly installed primitives now classified as `integrator_owned`

**For `docker` tools (e.g. open-design — SPEC §4.1.1):** the `active-tools.yaml` entry carries `source: docker`, image ref + digest, ports, volume, token location, `claude_primitives: []` (ZERO — external daemon), `contracts: [CNT-NNN]`, `pmo_zones: [D2-B04]`, and `side_effects` (container + volume + secret token). In `pmo-mapping.yaml`, append the tool to `D2-B04` `covered_by[]` + `supports[]` and add the contract; **`primary` stays `design-module`** (open-design is a supporting viewer, not the zone owner — D2-B04 belongs to Design Module). The Stage-4 `/integrator:scan` re-run is a no-op for primitives (there are none) but still refreshes baseline state.

### Stage 5/6 — Contract design (subagent per pair)

For each (producer, consumer) pair this tool creates, spawn `contract-designer` subagent (`.claude/agents/integrator/contract-designer.md`) with brief:

```
Producer: <e.g., product-module>
Consumer: <tool>
Producer artifact: <e.g., product-handoff.md, sample: .claude/adapters/fixtures/FM-FIXTURE-001-handoff.md>
Consumer input: <from tool profile inputs[]>
Existing contracts (dedup): <list from .claude/integrator/contracts/>
PMO zone(s) tying these tools: <from Stage 4 mapping>
Available MCPs: <enumerate>
Project fixture path: .claude/adapters/fixtures/FM-FIXTURE-001-handoff.md  (deployed by bootstrap/update, DEC-DEV-0178; if missing — pre-1.10 install — fall back to a real handoff from .product/handoffs/)
```

For cc-sdd specifically: one pair `product-module → cc-sdd /kiro:spec-init`. Subagent will check `.claude/adapters/handoff-to-ccsdd.js` (project-local reference layer per DEC-DEV-0040 Q1 refined; deployed by `/ecosystem:bootstrap` and synced by `/ecosystem:update`), inject metadata, run `--verify-only` smoke.

For **open-design** (`source: docker`): the pair is `design-module/stitch → open-design`; reference adapter `.claude/adapters/stitch-to-opendesign.js` → instance `.claude/integrator/adapters/stitch-to-opendesign.js` (same cp + metadata inject — `@target_tool_version` from profile, `@source_ref` from `.claude/adapters/.sync-metadata.yaml`, `@installed_at`, `@status: draft`). The Stage-6 fixture is an HTML/ZIP mockup (e.g. an `SI-*.html`), NOT a handoff fixture. Contract = CNT-003.

If `.claude/adapters/` directory is missing → bootstrap regression. Surface to user: «`.claude/adapters/` отсутствует — run `/ecosystem:update` before retrying». Do NOT proceed to Stage 5.

Receive subagent output (3 blocks: CNT YAML + companion .md + status report). Write CNT files to `.claude/integrator/contracts/`. Adapter instance already at `.claude/integrator/adapters/<adapter>.js` (subagent did the cp + metadata inject).

If smoke FAIL → contract status=draft + companion .md flags reason → do NOT mark Stage 5 complete; ask user before continuing to Stage 6.

Update `active-tools.yaml` + `pmo-mapping.yaml` with CNT-NNN references.

### Stage 6/6 — Verify (fixture contract test)

Run adapter `--verify-only` against the project fixture:

```bash
node .claude/integrator/adapters/<adapter>.js --verify-only --fixture .claude/adapters/fixtures/FM-FIXTURE-001-handoff.md
echo "exit: $?"
```

Expect exit 0 + `contract_validation.passed: true` in JSON output. For **`docker` tools** the fixture is an HTML/ZIP mockup and the daemon-free `--verify-only` exit 0 + `passed:true` IS the pass criterion (deterministic without Docker running); an optional live `--import` smoke runs only if the daemon is up. If pass:

1. Generate **tool-docs** at `.claude/integrator/tool-docs/<tool>.md` via `.claude/skills/integrator/tool-docs-generator.md` skill (per SPEC §14 style guide: universal English, API reference, project-agnostic). This is the deliverable for future Orchestrator Module.
2. Update contract `last_verified` timestamp
3. Mark contract status `active`

If fail: rollback Stage 3-5 (uninstall tool, restore baseline backup, remove CNT files), surface error + suggest `/integrator:debug`.

**Phase 5 scope reminder:** Stage 6 is the END of `/integrator:add`. Production routing (real `.product/handoffs/FM-NNN-handoff.md` → live `/kiro:spec-init`) is Orchestrator — out of this command's responsibility.

### Final: Journal entry + summary

Append entry to `.claude/integrator/project-journal.md` (also propagated to `~/.claude/integrator/decision-journal.md` if global lessons apply):

```markdown
## DEC-INT-NNNN — Added: <tool>@<version>

**Date:** YYYY-MM-DD
**Trigger:** /integrator:add <args>
**Tag:** #tool-add #pmo-<zones>

### Context
<why this tool was added; reference user need or PMO gap>

### Profile summary
<key fields from Stage 1; link to ~/.claude/integrator/tool-catalog/<tool>.yaml>

### Conflicts resolved
<from Stage 2 approve gate decisions>

### Contracts created
- CNT-NNN: <producer> → <consumer> (status: active | draft)

### PMO coverage delta
- <zone-id>: previously uncovered → now covered (primary: <tool>)
- <zone-id>: partial coverage (per profile evidence)

### Stage outcomes
| Stage | Result |
|---|---|
| 1 Profile | OK |
| 2 Propose | Approved |
| 3 Install | OK (or: with N user files backed up) |
| 4 Configure | OK |
| 5 Contract | CNT-NNN active |
| 6 Verify | PASS |

### Files written
- .claude/integrator/active-tools.yaml (modified)
- .claude/integrator/pmo-mapping.yaml (modified)
- .claude/integrator/contracts/CNT-NNN.yaml + .md
- .claude/integrator/adapters/<adapter>.js (copied + metadata injected)
- .claude/integrator/tool-docs/<tool>.md (generated)
- ~/.claude/integrator/tool-catalog/<tool>.yaml (full profile cached globally)

### Lessons
<if any surfaced during install — esp. cross-tool conflicts, hook namespace issues>
```

The `journal-hook` (Phase 5.F, registered in `hooks/integrator/manifest.yaml`) autologs the modifying action with dedup by `(action, tool, timestamp_minute)`.

Then summarize to user:

```
✅ <tool>@<version> installed under Integrator management.
📝 Journal entry: DEC-INT-NNNN
📄 Tool docs for Orchestrator: .claude/integrator/tool-docs/<tool>.md
🔗 Active contracts: CNT-NNN
⏳ Remaining gaps in PMO coverage: <list from /integrator:gaps>
```

### Final: Cleanup session-context marker

```bash
rm -f .claude/integrator/.session-context.json
```

Also cleanup on rollback / cancellation paths. Stale marker triggers `scope-guard` false-positives until 1h TTL.

## Idempotency + re-run after failure

If user re-runs `/integrator:add <tool>` after partial failure:

- **Tool already installed (Stage 3 done)?** Skip Stage 3; verify install with smoke; resume from failed stage
- **Contract already exists (CNT for this pair active)?** Skip Stage 5; resume from Stage 6
- **All stages done?** Treat as re-verify — just re-run Stage 6 + refresh `last_verified` timestamps

Idempotency relies on `active-tools.yaml` as state-of-truth. If it shows tool as installed but actual install is missing → flag inconsistency, do NOT auto-reinstall; ask user.

## Important constraints

- **Approve gate is a HARD boundary.** No file mutation outside `.claude/integrator/` lazy-init before user says `y`.
- **Backup before destructive ops** (Stage 3+). Default to `--no-overwrite` semantics where supported.
- **No `npm install -g`** — only project-local installs unless user explicitly opts in; respect `validation_tier: pilot` (bias to lighter touch).
- **Trust subagent output structure**, but verify subagent did not skip mandatory fields (e.g., `pmo_coverage` must be present in profile; `contract.id` must be set in CNT YAML).
- **Field naming discipline (B.1).** Canonical schemas: SPEC §4.1 (profile), §4.3 (pmo-mapping), §5.1 (contract). Anti-pattern variants in `skills/integrator/tool-profiling.md` Anti-patterns + `skills/integrator/contract-design.md` Anti-patterns.

## Error handling matrix

| Stage | Failure type | Action |
|---|---|---|
| 1 | Subagent timeout / no profile | Surface error, offer retry with reduced depth or manual profile |
| 2 | User says `n` | Clean cancellation; record in journal as `#cancelled` |
| 3 | npm install fails | Restore backup, no state change; ask user to investigate |
| 3 | docker daemon unreachable / `/api/health` ≠ 200 | Surface BOOTSTRAP recipe; do NOT auto-`docker run`; ask user to start daemon, then retry. No state change. |
| 3 | docker token missing | Surface BOOTSTRAP token-gen step; do not fabricate a token; pause until resolved |
| 3 | Smoke verify fails post-install | Rollback (uninstall + restore); journal entry `#install-rollback` |
| 4 | YAML write error | Restore previous active-tools.yaml + pmo-mapping.yaml from backup |
| 5 | Subagent fails / contract smoke fails | Mark contract draft; pause Stage 6; ask user |
| 6 | Adapter contract test fails | Full rollback of Stage 3-5; surface adapter output verbatim |
