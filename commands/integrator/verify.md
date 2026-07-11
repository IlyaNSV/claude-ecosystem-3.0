---
description: Health check of the Integrator zone — tools installed, contracts valid, pmo-mapping consistent, adapters drift-free. Read-only; reports, does not repair.
---

# /integrator:verify

Read-only consistency audit of the Integrator zone per `docs/integrator-module/SPEC.md §3.3`. Checks that installed tools are real and reachable, contracts are well-formed, `pmo-mapping.yaml` has no orphans, and adapters have not drifted. **Reports and recommends; never repairs.** The only state it writes is a `last_audit` timestamp per tool.

> **Not `/ecosystem:verify`.** `/ecosystem:verify` checks the *ecosystem installation* (commands/skills/hooks/MCP present and wired). `/integrator:verify` checks the *Integrator zone's runtime health* (tools reachable, contracts valid, adapters not drifted).

## Process

### Step 0: Session-context marker (DEC-DEV-0047 / patch 1.3.3)

Activate `hooks/integrator/scope-guard.js` for this session. Cleanup at Final step.

```bash
mkdir -p .claude/integrator
printf '{"command":"/integrator:verify","started_at":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > .claude/integrator/.session-context.json
```

### Step 1: Load active tools

Read `.claude/integrator/active-tools.yaml`.

If the file is missing or lists no tools:

```
Integrator is not active in this project — nothing to verify.

Read-only overview: /integrator:status
Add a tool:        /integrator:research <need> → /integrator:add <tool>
```

Clean up the marker (Final step) and stop.

Otherwise, load the companion state once (reused across checks):
- `.claude/integrator/pmo-mapping.yaml` — coverage view
- `.claude/integrator/contracts/CNT-*.yaml` (+ companion `.md`) — active contracts
- `.claude/integrator/adapters/*.js` — installed adapter instances

### Step 2: Per-tool checks

For each tool in `active-tools.yaml`, run four checks.

**(a) Tool reachable.** Confirm the tool actually resolves — cheaply, without side effects:
- `source: npm` → the package resolves (`npm ls <pkg>` locally, or the pinned `npx <pkg>@<version>` spec is present in the profile). Only run a `--version`-class smoke call if the tool documents a safe, non-mutating one.
- `source: mcp` → the server is registered in `.mcp.json` and reports reachable (`claude mcp get <name>`).
- `source: git|binary` → the checkout/binary path from the profile exists.

Do **not** run install, init, or any generating command here — reachability only. If a tool cannot be resolved → 🔴 `unreachable`.

**(b) Contracts valid.** For each `CNT-*.yaml` referencing this tool:
- The YAML parses and carries required fields (`contract.id`, `producer`, `consumer`, `status`, `data_flow`, `transformation`).
- If `transformation.type: adapter_script` → the referenced `transformation.script` (e.g. `.claude/integrator/adapters/<adapter>.js`) exists on disk.
- A companion `.md` exists for the contract.

Missing field or dangling adapter reference → 🔴 `broken`.

**(c) pmo-mapping consistent.** Cross-check `pmo-mapping.yaml` against reality:
- Every tool in `coverage[].covered_by[]` exists in `active-tools.yaml` (no orphan mapping entry pointing at an uninstalled tool).
- Every installed tool appears in at least one `coverage` entry (no installed-but-unmapped tool).
- Every `coverage[].contracts[]` id resolves to a `CNT-*` file.

Orphan in either direction → 🟡 `orphan`.

**(d) Adapter drift.** Delegate to the shared drift library via its CLI seam (methodology: `.claude/skills/integrator/drift-detection.md`, D1 semver / D2 schema / D3 body-diff, local-only):

```bash
node .claude/hooks/integrator/lib/drift-checks.cjs --root . --json
```

Contract: exits 0 always; emits
`{ tools: [ { tool, adapter, d1, d2, d3, staleness } ], summary: { driftCount, staleCount, checkedTools } }`.
Map each tool's `d1/d2/d3` verdict onto the report row; any 🔴 axis → `drift`.

### Step 3: Report

Summarise as a per-tool table, then actionable recommendations. Keep it tight — a 2-tool project yields a short report.

```
═══════════════════════════════════════════════════════════
INTEGRATOR VERIFY  ·  <project>  ·  <ISO-date>
═══════════════════════════════════════════════════════════

TOOL          REACHABLE  CONTRACTS  MAPPING  DRIFT     VERDICT
cc-sdd 2.3.0  ✓          2 ok       ok       clean     🟢 healthy
beads 1.2.0   ✓          1 broken   ok       —         🔴 issues

FINDINGS
  🔴 CNT-003 (spec-tasks → beads): adapter script referenced but missing
  🟡 D3-05 mapped to 'superpowers' — not in active-tools (orphan mapping)

RECOMMENDATIONS
  broken contract  → /integrator:debug "CNT-003 broken"
  adapter drift    → /integrator:update <tool> --repair
  orphan mapping   → remove the stale coverage entry, or /integrator:add <tool>
  orphan tool      → add coverage in pmo-mapping.yaml, or /integrator:remove <tool>

Stamped last_audit=<ISO-date> on <N> tools.
```

Recommend, don't act. Every finding maps to a command the user runs deliberately: drift → `/integrator:update <tool> --repair`, broken contract → `/integrator:debug`, orphan → the concrete edit above.

### Step 4: Stamp `last_audit` (the only write)

For each tool, set `active-tools.yaml` `<tool>.last_audit: <ISO-date>` (per SPEC §4.3 `meta.last_audit`). This is the single mutation this command makes; the `journal-hook` auto-logs it. Announce it in the report (last line above). No other file is modified.

### Final: Cleanup session marker

```bash
rm -f .claude/integrator/.session-context.json
```

Also remove it on the early-exit path (Step 1). A stale marker triggers false-positive `scope-guard` warnings until its 1h TTL.

## Error handling

| Step | Failure | Action |
|---|---|---|
| 1 | `active-tools.yaml` unreadable / malformed | Report parse error verbatim; do not stamp anything; exit |
| 2a | Reachability probe errors out | Mark tool `unreachable` 🔴; continue other tools |
| 2b | Contract YAML unparseable | Mark that contract `broken` 🔴; continue |
| 2d | `drift-checks.cjs` missing or throws | Note "drift check unavailable"; report other axes; do not fabricate a verdict |
| 4 | `active-tools.yaml` write fails | Surface error; report is still valid (read-only findings hold) |

## Important constraints

- **READ-ONLY except one write.** The `last_audit` stamp is the only mutation. This command never installs, repairs, edits contracts, or touches adapters.
- **Be honest.** A tool that won't resolve or a contract that won't parse is reported as such — no soft-pedalling.
- **Reachability is cheap.** Resolve/`--version`-class only; never run generating or init commands to "test" a tool.
- **Never touch `.product/`, `.kiro/`, or `docs/pmo/`.** Verification lives entirely in the Integrator zone (`scope-guard` backs this).
- `--light` / periodic scheduled verify — deferred to v1.1 (not available; do not advertise).
