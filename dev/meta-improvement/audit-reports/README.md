# Session audit reports

Output directory for [`hooks/session-audit.js`](../hooks/session-audit.js).

Each session that touched `.product/**` produces one report file here, named by Claude Code session ID:

```
<session-uuid>.md
```

## Schema

Reports use the frontmatter + structured-Markdown format defined in [`../prompts/session-audit.md`](../prompts/session-audit.md) Step 4.

Frontmatter fields:
- `session_id` — Claude Code session UUID
- `audited_at` — ISO 8601 UTC timestamp of audit completion
- `transcript_path` — absolute path to the JSONL transcript
- `session_end_reason` — `clear | resume | logout | prompt_input_exit | other`
- `status` — `clean | findings | error`
- `findings_count` — by severity bucket

## Retention

- **Keep:** reports with `status: findings` and unresolved Blocking/Warning items
- **Archive (after acting):** `git mv <id>.md ../../_archive/audit-reports/`
- **Delete:** reports with `status: clean` older than 30 days (no signal value)

Reports are **not auto-committed** — review before staging.

## See also

- [`../hooks/session-audit.js`](../hooks/session-audit.js) — hook implementation
- [`../prompts/session-audit.md`](../prompts/session-audit.md) — auditor prompt template
- [`../CONVENTIONS.md`](../CONVENTIONS.md) §8 — failure mode handling (surface, never auto-fix)
