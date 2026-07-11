---
description: Generate the Orchestrator-facing operating manual for installed tools at .claude/integrator/tool-docs/<tool>.md. Wraps the tool-docs-generator skill; preserves manual blocks on regeneration.
argument-hint: "[--tool <name> | --tool=all]"
---

# /integrator:docs

User invoked: `/integrator:docs $ARGUMENTS`

Export/refresh the **operating manual** for installed tools at `.claude/integrator/tool-docs/<tool>.md`, per `docs/integrator-module/SPEC.md §3.3` + §14. The consumer is the Orchestrator Module (and any developer arriving without project context) — so the output is **universal technical English, project-independent** (no FM-IDs, no this-product terminology). This command is a thin wrapper: it loads the generator skill and follows it.

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js`. Cleanup at Final step.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:docs","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Resolve target set

Read `.claude/integrator/active-tools.yaml`.

- **No active tools** → honest refusal (do **not** write an empty file):
  ```
  No active tools — nothing to document.
  Add a tool first: /integrator:research <need> → /integrator:add <tool>
  ```
  Clean up the marker and stop.
- `--tool <name>` → that single tool (error if not in `active-tools.yaml`).
- `--tool=all` → every active tool.
- **No argument** → with ≤3 active tools, propose `all` (list them, confirm); with more, ask which tool.

### Step 2: Load the generator skill

Load `.claude/skills/integrator/tool-docs-generator.md` and follow it — this command does **not** duplicate the generation logic. The skill owns the §14.2 structure, the §14.1 style invariants, and the source-gathering steps. Read `docs/integrator-module/SPEC.md §14` (as the skill instructs) before generating.

### Step 3: Gather sources (per tool)

Per the skill's Step 1, for each target tool assemble:
- **Profile** — from `active-tools.yaml` (+ `~/.claude/integrator/tool-catalog/<tool>.yaml` if present) → Identity, Capabilities, Category.
- **Contracts** — `.claude/integrator/contracts/CNT-*.yaml` referencing the tool → Data Flow (consumes/produces), ownership.
- **Journal** — `.claude/integrator/project-journal.md` `#<tool>` entries (especially `/integrator:debug` records) → Known Issues + Error Catalog.
- **Adapter** — `.claude/integrator/adapters/<adapter>.js` → command signatures, exit behavior actually observed.

Where exit codes / runtime are neither documented nor empirically known, write `unknown — needs probe`. Never fabricate (skill anti-pattern §4).

### Step 4: Preserve manual blocks (SPEC §14.4)

Regeneration is **not** a blind overwrite. Before writing `<tool>.md`, if it already exists:
1. Read the current file.
2. Extract every span wrapped in `<!-- manual: do not regenerate -->` … `<!-- /manual -->`.
3. Generate the fresh doc from Step 3.
4. Re-insert the preserved manual spans into their corresponding sections.

Hand-written Operating-Protocols overrides and troubleshooting the generator can't infer survive verbatim.

### Step 5: Write

Write each `.claude/integrator/tool-docs/<tool>.md` with the mandatory §14.2 structure: Identity · Capabilities · Commands (signatures/inputs/outputs/exit codes) · Data Flow · Integration Points · Operating Protocols · Known Issues · Error Catalog · Telemetry. The `journal-hook` auto-logs the write.

Summary:

```
Generated tool-docs:
  ✓ .claude/integrator/tool-docs/cc-sdd.md   (manual blocks preserved: 1)
  ✓ .claude/integrator/tool-docs/beads.md
```

### Final: Cleanup session marker

```bash
rm -f .claude/integrator/.session-context.json
```

Also clean up on the early-exit path (Step 1). A stale marker trips `scope-guard` warnings until its 1h TTL.

## Important constraints

- **Universal English, project-independent.** Documents the *tool*, not our use of it. No FM-IDs, no business rationale, no marketing claims (SPEC §14.1 / §14.3).
- **Never clobber manual blocks.** `<!-- manual: ... -->` spans are preserved across every regeneration.
- **No fabrication.** Unknown exit codes / runtime → `unknown — needs probe`.
- **No active tools → refuse, don't emit an empty file.**
- **Read-only outside `tool-docs/`.** Sources are read; the only writes are the `tool-docs/<tool>.md` files. Never touch `.product/`, `.kiro/`, or `docs/pmo/`.

## Error handling

| Step | Failure | Action |
|---|---|---|
| 1 | No active tools | Refuse honestly; no file written; exit |
| 1 | `--tool <name>` not installed | List active tools; suggest `/integrator:add`; exit |
| 2 | Generator skill missing | Surface error; do not improvise the structure ad hoc |
| 3 | A source (profile/contract/adapter) missing | Fill what's available; mark gaps `unknown — needs probe`; note in summary |
| 4 | Existing file unreadable | Warn that manual blocks can't be preserved; ask before overwriting |
