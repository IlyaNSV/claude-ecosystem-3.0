---
description: One-time opt-in setup — register the D7 session-audit SessionEnd hook in this project's .claude/settings.local.json (uses absolute path to the ecosystem repo).
argument-hint: [--ecosystem-root=<absolute-path>]
allowed-tools: Read, Edit, Write, Bash(node:*)
---

# /ecosystem:enable-d7-audit

Register the D7 conformance audit SessionEnd hook in the **current project's** `.claude/settings.local.json`. After this one-time setup, every Claude Code session that ends in this project will append a Pending marker to the ecosystem repo's `dev/meta-improvement/audit-index.md`.

This is **opt-in** — not part of `/ecosystem:bootstrap` — because the audit mechanism is D7-internal and only useful when the developer plans to audit smoke-test runs of this project against an ecosystem phase smoke plan.

Per DEC-DEV-0034 (Phase 4.1).

## When to run

- Once per pilot project (e.g., `my-first-test`) where you intend to execute ecosystem-phase smoke tests.
- After `git pull`-ing a new ecosystem version that updated the hook script — re-run to verify path is still valid.

## When NOT to run

- In production user projects — D7 audit is for ecosystem development pilots, not consumer projects.
- In the ecosystem repo itself — the hook is unnecessary there (work on the ecosystem doesn't need to be audited as «pilot smoke»).

## Process

### Step 1 — Confirm context

Verify cwd is **not** the ecosystem repo itself:
- If `dev/meta-improvement/hooks/session-audit.js` exists relative to cwd → this IS the ecosystem repo → stop and explain.
- Otherwise → proceed (cwd is some pilot or test project).

### Step 2 — Resolve ecosystem repo root

Determine the absolute path to the ecosystem repo:

1. If user passed `--ecosystem-root=<path>` → validate that path exists AND contains `dev/meta-improvement/hooks/session-audit.js`. If invalid → ask user for correct path.
2. Otherwise — ask user: «Где находится репозиторий экосистемы (абсолютный путь)?» — accept response, then validate same way.

Normalize to forward-slash style for JSON (Windows paths use `/` in JSON strings to avoid escaping). Example: `C:/Users/pw201/WebstormProjects/claude-ecosystem-3.0`.

### Step 3 — Read or initialize settings.local.json

Path: `.claude/settings.local.json` (relative to cwd).

- If file does not exist → start with empty object `{}`
- If exists → Read it as JSON. If parse fails → stop, ask user to fix JSON manually.

### Step 4 — Idempotency check

Look for an existing SessionEnd hook entry whose `command` ends with `session-audit.js`:

```js
const hasHook = settings.hooks?.SessionEnd?.some(group =>
  group.hooks?.some(h => h.command?.includes('session-audit.js'))
);
```

If present → report «D7 audit hook already registered at <existing path>. No changes.» and stop. If the existing path differs from the resolved ecosystem-root — surface the discrepancy and ask whether to overwrite.

### Step 5 — Inject hook entry

Construct the new entry:

```json
{
  "type": "command",
  "command": "node <ECOSYSTEM_ROOT>/dev/meta-improvement/hooks/session-audit.js"
}
```

Replace `<ECOSYSTEM_ROOT>` with the validated absolute path. Add it under `hooks.SessionEnd[0].hooks[]`, creating intermediate objects as needed.

Resulting shape (minimal example):

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node C:/Users/pw201/WebstormProjects/claude-ecosystem-3.0/dev/meta-improvement/hooks/session-audit.js"
          }
        ]
      }
    ]
  }
}
```

Preserve any existing top-level keys (`permissions`, other hooks, etc.).

### Step 6 — Write back

Write `.claude/settings.local.json` with 2-space indentation. Add to `.gitignore` if not already present (this file holds local state — typically already ignored).

### Step 7 — Sanity verification

Run a smoke check that the hook script is reachable:

```bash
node "<ECOSYSTEM_ROOT>/dev/meta-improvement/hooks/session-audit.js" --selftest 2>&1
```

(The hook itself does not implement `--selftest` — invoking with no stdin will trigger `process.exit(0)` on the JSON.parse catch. Exit 0 = reachable.)

If exit ≠ 0 → surface the error; the absolute path is likely wrong or Node not in PATH.

### Step 8 — Report to user

```
✓ D7 audit hook enabled for <current-project-name>.

  Hook script:       <abs-path>/dev/meta-improvement/hooks/session-audit.js
  Audit index:       <abs-path>/dev/meta-improvement/audit-index.md
  Registered in:     .claude/settings.local.json

Next steps:
  1. Run your smoke-test sessions in this project as usual.
  2. After each SessionEnd, a marker is appended to the audit index.
  3. From the ecosystem repo, run /meta:audit-smoke --phase=<N> to process the markers.

See dev/meta-improvement/checklists/audit-smoke-workflow.md (in the ecosystem repo) for the full ritual.
```

## Disabling

Remove the hook entry manually from `.claude/settings.local.json` — that is the supported disable path. A dedicated `/ecosystem:disable-d7-audit` command deliberately does not exist (opt-in is rare enough that a one-line manual edit beats shipping + maintaining a command; G35).

## Anti-actions

- Do NOT modify ecosystem repo files from this command — it is purely a per-project setup
- Do NOT add the hook to a deployable `settings.json` — local-only, opt-in
- Do NOT silently overwrite an existing hook entry without confirming with the user
- Do NOT run any audit logic here — that lives in `/meta:audit-smoke` (only available from ecosystem repo cwd)

## See also

- [`commands/meta/audit-smoke.md`](../../dev/meta-improvement/audit-reports/README.md) (in ecosystem repo `.claude/commands/meta/audit-smoke.md`) — consumer side
- `dev/meta-improvement/checklists/audit-smoke-workflow.md` (ecosystem repo) — workflow ritual
- DEC-DEV-0034 in `DEV_JOURNAL.md` — design rationale
