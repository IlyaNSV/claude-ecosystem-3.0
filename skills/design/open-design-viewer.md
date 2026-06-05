---
description: Import an MK's existing visual HTML into the open-design Dockerized viewer (--to open-design target of /design:migrate, v1.5). Viewer-only — runs the CNT-003 adapter (HTTP import to the shared daemon); NO regeneration, NO metadata migration, NO iteration bump. Canon stays in MK/NM.
---

> **User-facing output language:** Russian. Token identifiers / file paths / project ids — verbatim.

# open-design Viewer — Skill (v1.5)

> **Status:** v1.5. open-design is a **viewer / migrate-target**, not a generator and not a source of truth. It receives only visual HTML; screen metadata (SC/BR/state-matrix/DS tokens) does NOT migrate. Canonical spec stays in MK/NM.
>
> **Use case:** visualize an MK's Stitch/HTML mockup in the open-design interactive iframe preview (+ multi-format export: html/pdf/pptx/mp4/zip), as an alternative to the incumbent local Chrome-render.

## Activation context

Loaded when `/design:migrate <MK-id> --to open-design` reaches its execution branch (Step 5-OD). This is NOT part of the `design-session.md` D.2/D.3 generation loop — open-design has no iteration loop (it imports existing HTML, it does not generate screens).

Prerequisites already checked by the command (Step 2): `external_viewers.open-design` declared in `.claude/design.yaml`, token resolvable, daemon reachable, MK has a visual HTML artifact.

## What this skill does (and does NOT)

Does:
- Resolve the daemon URL + OD_API_TOKEN, preflight `/api/health`.
- Locate the MK's visual HTML artifact (an `SI-*.html` export, or a Stitch `htmlCode` ZIP).
- Invoke the CNT-003 reference adapter `--import` to POST the HTML/ZIP to `/api/import/claude-design`.
- Parse the adapter result (`project_id`, `entry_file`, `files_imported`) and return the viewer URL.

Does NOT:
- ❌ Generate or regenerate screens (open-design is not Stitch/Claude Design — no brief, no generation).
- ❌ Migrate MK metadata (screen IDs, SC/BR, DS tokens, state matrix) — visual HTML only.
- ❌ Increment `MK.iteration` (import is not a regeneration — invariant).
- ❌ Mutate MK frontmatter — the `/design:migrate` A8 sequence owns all MK writes (this skill only imports and returns a result; on failure it touches nothing).

## Algorithm

### Step 1 — Resolve daemon + token, preflight

- Daemon URL from `.claude/design.yaml.external_viewers.open-design.transport`/host (default `http://127.0.0.1:7456` — use `127.0.0.1`, NOT `localhost`, to avoid Windows IPv6 ::1 EACCES).
- Token by precedence (the adapter does this internally too): `$OD_API_TOKEN` → `~/.claude/integrator/secrets/open-design.token` (machine-global) → `./.claude/integrator/secrets/open-design.token`.
- Preflight: `curl -s -m 5 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer <token>" <daemon>/api/health` → expect `200`. If not reachable → abort, point to `BOOTSTRAP.md` «open-design shared daemon» + `/integrator:add open-design`. Do NOT start the daemon yourself (operator-owned lifecycle).

### Step 2 — Locate the MK's visual HTML artifact

Search order:
1. An exported `SI-*.html` from a prior session, e.g. `.product/.design-sessions/<MK-id>-html/SI-*.html` or `index.html`.
2. A Stitch `htmlCode` download ZIP captured for the MK.

If none found → abort with a hint: render/export the MK first (e.g. via `html-fallback.md` or a Stitch export), then re-run the import. (The command's Step 2 should have caught this; this is a defensive recheck.)

### Step 3 — Import via the CNT-003 adapter

Run the adapter instance in `--import` mode (it wraps a single `.html` into a single-entry ZIP `index.html` automatically; a `.zip` is sent as-is):

```bash
node .claude/integrator/adapters/stitch-to-opendesign.js --import "<SI-*.html | htmlCode.zip>"
# token resolved by the adapter via precedence; --token / --daemon-url optional overrides
echo "exit: $?"
```

Parse the JSON report: `http_status`, `project_id`, `entry_file`, `files_imported`, `token_source`, `verify_command`.

Exit codes: `0`=imported (HTTP 200/201), `1`=contract validation fail (C-0x), `2`=IO/parse error, `3`=transport (daemon unreachable / auth).

### Step 4 — Return result to the command (no MK write here)

On success, return to `/design:migrate` Step 5-OD:
- `tool_project_url: http://127.0.0.1:7456/p/<project_id>`
- `project_id`, `entry_file`
- `description: «open-design import: <SI> → project <project_id>»`
- `issues: [<C-06/C-07 warnings/info from the adapter checks, if any>]`

The command performs the MK frontmatter writes (design_tool, tool_project_url, Decisions-Log) — NOT this skill.

On failure (exit ≠ 0): return the adapter output verbatim + the failing exit code so the command runs its A8 rollback (it never mutated the MK past the previous_tools[] entry). For exit 3, include the BOOTSTRAP pointer.

### Step 5 — Optional persistence verify

Non-blocking: `GET <daemon>/api/projects/<project_id>/files` (with Bearer) → expect `entry_file` + the imported files present. Surface as confirmation only (the import already succeeded).

## Anti-patterns

1. **Treating open-design as a generator.** It imports existing HTML; it does not generate screens. No brief, no `generate_*` calls.
2. **Migrating metadata.** Only visual HTML crosses. Screen IDs, SC/BR, DS tokens, state matrix stay in MK/NM. Never claim they were migrated.
3. **Incrementing iteration.** Import is not a regeneration — leave `MK.iteration` untouched.
4. **Mutating the MK from this skill.** The command's A8 sequence owns MK writes. This skill imports and returns; on failure it leaves the filesystem clean.
5. **Using `localhost`.** Always `127.0.0.1:7456` (Windows ::1 EACCES).
6. **Auto-starting the daemon.** Daemon lifecycle is operator-owned — surface the BOOTSTRAP recipe instead of `docker run`.
7. **Logging the token value.** Surface `token_source` (cli/env/home-secret/project-secret) for debugging, never the token itself.

## Failure modes

| Failure | Recovery |
|---|---|
| Daemon unreachable (adapter exit 3) | Abort; point to BOOTSTRAP «open-design shared daemon» + `/integrator:add open-design`. No MK mutation. |
| Token missing (401 from daemon) | Surface BOOTSTRAP token-gen step; do not fabricate a token. |
| Contract validation fail (adapter exit 1, C-0x) | Surface failing check (e.g. ZIP has no .html). MK stays on current tool. |
| No visual HTML artifact for the MK | Abort; hint to render/export the MK first. |
| HTTP 200 but no project_id in response | Treat as soft-fail; surface raw response; do not write tool_project_url. |

## Related

- Command: `commands/design/migrate.md` Step 5-OD (`--to open-design` execution branch)
- Contract: `.claude/integrator/contracts/CNT-003.{yaml,md}` (stitch/MK HTML → open-design import)
- Adapter: `.claude/integrator/adapters/stitch-to-opendesign.js` (reference: repo `adapters/stitch-to-opendesign.js`)
- Sibling regeneration backends: `stitch-workflow.md`, `html-fallback.md`, `claude-design-workflow.md`
- Daemon setup: `BOOTSTRAP.md` «open-design shared daemon (machine-global)»
- Integrator pattern: `docs/integrator-module/SPEC.md §4.1.1` (Dockerized external-daemon tool)
- Cross-platform: `127.0.0.1` not `localhost`; LF I/O; Bearer on all `/api/*`.
