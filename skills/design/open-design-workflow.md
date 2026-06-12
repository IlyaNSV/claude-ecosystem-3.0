---
description: open-design primary generator for D.2/D.3 — Claude authors DS-token-bound SI-*.html and drives the Dockerized open-design daemon via its `od mcp` stdio server (CNT-004) to create a per-FM OD project + one artifact per screen, with live iframe preview (od-proxy) + multi-format export. Multi-screen, agent-authoring (Mode A). Autonomous start_run (Mode B) deferred per CNT-004.
---

> **User-facing output language:** Russian. Token identifiers / file paths / tool names / flags — verbatim.

# open-design Workflow — Skill (generator, CNT-004)

> **Role:** D2-B04 screen GENERATOR (канонизирован DEC-DEV-0067; пилотное решение DEC-INT-0012). open-design is an agent-driven design platform;
> here Claude is the authoring agent driving it via `od mcp`. This is distinct from CNT-003, which
> only VIEWS externally-produced HTML. Canonical spec stays in MK/NM — OD carries rendered HTML only.

## Activation context

Loaded when `design-session.md` dispatches D.2/D.3 with `design_tool: open-design` — the
`.claude/design.yaml.default_design_tool` or a per-MK override.

## Prerequisites (verified at skill load)

- open-design + od-proxy containers running: `docker start open-design od-proxy` (idempotent).
- `OD_API_TOKEN` available (`.claude/integrator/secrets/open-design.token`).
- Adapter present: `.claude/integrator/adapters/od-mcp-call.cjs`.
- DS readable (`.product/design-system.md`) — screens are bound to DS tokens.

If a container is down → start it; if the token is missing → surface PA + fall back per
`.claude/design.yaml.mcp_preferences.fallback_chain` (html).

## Generation mode

- **Mode A — agent-authoring (primary, active).** Claude authors each `SI-*.html` and writes it into
  an OD project via `create_project` → `create_artifact` / `write_file`. No external LLM key (Claude
  is the agent). This is the default path.
- **Mode B — commissioned run (deferred/blocked).** `start_run` makes OD spawn its own agent. Blocked
  on this host (no agent CLI inside the OD container). Do NOT attempt unless
  `list_agents` reports an `available:true` agent.

## Algorithm

### Step 1 — Project (one OD project per FM)

```
calls = [{ name: "list_projects", arguments: {} }]
IF no project named "FM-NNN <Title> — <project-name>" exists:
  create_project { name: "FM-NNN <Title> — <project-name>" }
RECORD project.id  → write to <FM-id>-progress.yaml.tool_project_url
                     AND .claude/design.yaml.feature_projects.FM-NNN
```

Drive via the adapter (keeps stdin open; unwraps results):
```bash
OD_API_TOKEN=$(tr -d '\r\n' < .claude/integrator/secrets/open-design.token) \
node .claude/integrator/adapters/od-mcp-call.cjs --calls <calls.json>
```

### Step 2 — Author each SI-*.html (DS-token-bound)

For every Screen Inventory item:
1. Author a self-contained `SI-N.html` to **`.product/mockups/assets/<fmNNN>/`** (git-TRACKED canonical
   source — same convention as Stitch assets; survives container/worktree loss; NOT the
   gitignored `.design-sessions/` zone). Add a README.md mapping SI-N → screen. Convention:
   - Inline `<style>` with a `:root` block mapping the DS tokens the screen uses (colors /
     typography / spacing / radius from `.product/design-system.md` — e.g. `--primary`, `--surface`,
     `--on-surface`, `--error`, font family, grid step). **No hardcoded off-DS hex/spacing**
     (DS §4 Usage Rules).
   - Semantic HTML5 + `aria-*`; focus-outline `primary`; touch targets ≥44px.
   - Self-contained (no external asset refs — must render inside the OD sandboxed iframe).
2. Write it into the OD project as one artifact:
   ```
   create_artifact { project: <id>, name: "SI-N/index.html" (or "index.html" for the entry), content: <html> }
   # iterate later with write_file { project, path, content }
   ```
3. Verify round-trip: `get_artifact { project, entry }` (or fetch
   `http://localhost:7457/api/projects/<id>/raw/<path>` via od-proxy) and byte-compare to source.

> Multi-screen IS supported (unlike `html-fallback.md`). Either one artifact per SI, or a single entry
> that links sibling SI files in the same project.

### Step 3 — Collect outputs for the orchestrator

Return one entry per screen:
- `si_id`
- `tool_url_or_path`: `http://localhost:7457/api/projects/<id>/raw/<path>` (tokenless via od-proxy);
  browse hub `http://localhost:7457/`.
- `description`
- `issues`: contrast/token/round-trip warnings.

Update `<FM-id>-progress.yaml`: `design_tool: open-design`, `tool_project_url`, `iterations_log[]`.
(open-design has no Stitch-style monthly quota — `stitch_usage` is N/A for this tool.)

### Step 4 — Iteration handling (D.3)

- **small / medium** → re-author the affected SI and `write_file` (in-place overwrite — no version proliferation).
- **large** (2+ screens) → re-author each and `write_file` per file.
- **fundamental** → full Step 2 re-author of the project's screens.
Each iteration: append `iterations_log[]`; re-verify round-trip; show updated preview URLs.

### Step 5 — Export (feeds D.6 / handoff §10)

OD exports html/pdf/pptx/zip per artifact. For the handoff, the canonical UI contract is the MK/DS/NM
text + the OD previewUrl(s). OD export files are auxiliary (visual), not the canonical spec.

## Anti-patterns

1. **Using the REST agent CLIs (`od tools` / `od artifacts create`).** They reject `OD_API_TOKEN`
   (`TOOL_TOKEN_INVALID`). Drive the **`od mcp`** path (this skill / `od-mcp-call.cjs`).
2. **Piping a fixed request set and closing stdin immediately.** Daemon-backed results vanish on EOF.
   The adapter holds stdin open — never bypass it with a raw one-shot pipe.
3. **Hardcoded off-DS hex/spacing.** Bind to DS tokens (DS §4). Bare values only as a flagged TODO.
4. **Attempting Mode B `start_run` while no agent is available.** Check `list_agents` first; else Mode A.
5. **Treating OD project files as canonical.** MK/NM are canonical; OD holds rendered HTML only.
6. **Forgetting `git`-untracked-ness.** OD projects live in the container volume (not versioned).
   Persist the authored `SI-*.html` canonical sources under the git-TRACKED `.product/mockups/assets/<fmNNN>/`
   (committed canonical screens) so they survive container/worktree loss — NOT the gitignored `.design-sessions/`.

## Failure modes

| Failure | Recovery |
|---|---|
| Container down | `docker start open-design od-proxy`; retry |
| Adapter `no response (timeout)` | raise `--timeout`; confirm `OD_API_TOKEN`; confirm container Up |
| `TOOL_TOKEN_INVALID` | wrong path — use od mcp (`create_artifact`), not `od tools`/`od artifacts` |
| `start_run` no agent | Mode B blocked (no agent CLI in container); use Mode A agent-authoring |
| Round-trip byte mismatch | re-`write_file`; check for daemon HTML normalization (design-canvas.jsx rewrite) |
| DS empty (first MK) | author with baseline tokens inline; warn to populate DS post-session |
| Git Bash mangles `/app/...` path | adapter uses `spawn()` (no MSYS); manual docker exec → `export MSYS_NO_PATHCONV=1` |

## Related

- Contract: `CNT-004` (generate path) · sibling `CNT-003` (viewer/import).
- Adapter: `.claude/integrator/adapters/od-mcp-call.cjs` (od mcp stdio driver).
- Parent skill: `design-session.md` (D.2/D.3 dispatch when `design_tool: open-design`).
- Sibling tools: `stitch-workflow.md`, `claude-design-workflow.md`, `html-fallback.md`.
- Tool docs: `.claude/integrator/tool-docs/open-design.md`.
- Decision: DEC-DEV-0067 (канонизация generator-роли; в пилоте — DEC-INT-0012 integrator project-journal).
- Config: `.claude/design.yaml` (`default_design_tool: open-design`, `external_viewers.open-design`).
