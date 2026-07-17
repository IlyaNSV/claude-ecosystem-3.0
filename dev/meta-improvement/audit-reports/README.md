# Audit reports

Output directory for [`/meta:audit-smoke`](../../../.claude/commands/meta/audit-smoke.md) and [`scripts/audit-smoke.js`](../scripts/audit-smoke.js).

Two kinds of files live here:

| Filename | Generator | Schema |
|---|---|---|
| `<session-uuid>.md` | per-session auditor (`prompts/session-audit.md`) | per-session report — [Step 4 schema](../prompts/session-audit.md) |
| `phase-<N>-summary.md` | aggregator (`prompts/phase-audit-summary.md`) | aggregate — script-computed `phase-<N>-aggregate.json` + AI narrative |
| `phase-<N>-aggregate.json` | `scripts/audit-smoke.js` (deterministic) | mechanical aggregate — input for the aggregator |

## Workflow (summary)

1. Hook [`session-audit.js`](../hooks/session-audit.js) writes Pending markers in [`audit-index.md`](../audit-index.md) on SessionEnd.
2. Developer runs `/meta:audit-smoke --phase=<N>` (or `node scripts/audit-smoke.js --phase=<N>`) from the ecosystem repo root.
3. CLI spawns per-session `claude -p` auditors → writes `<session-uuid>.md` here, moves markers from Pending to Processed.
4. CLI computes `phase-<N>-aggregate.json` (deterministic counts, dedupped findings, coverage matrix).
5. CLI spawns aggregator `claude -p` → writes `phase-<N>-summary.md` (recommendations + conflict resolution narrative).

See [`checklists/audit-smoke-workflow.md`](../checklists/audit-smoke-workflow.md) for the full ritual.

## Retention

- **Keep:** `phase-<N>-summary.md` indefinitely — it is the canonical record per phase
- **Keep:** per-session reports with `status: findings | partial | fail` until the related blockers are resolved
- **Archive (after acting):** `git mv <id>.md ../../_archive/audit-reports/`
- **Archive with phase closure:** `phase-<N>-aggregate.json` may be archived together with `dev/PHASE_<N>_SMOKE_TEST_PLAN.md` under `dev/_archive/phase-<N>/audit/` per CONVENTIONS §5.1
- **Delete:** per-session reports with `status: clean` older than 30 days (no signal value)

Reports are **not auto-committed** — review before staging.

## See also

- [`../audit-index.md`](../audit-index.md) — Pending + Processed journal (idempotency contract)
- [`../hooks/session-audit.js`](../hooks/session-audit.js) — SessionEnd marker writer
- [`../scripts/audit-smoke.js`](../scripts/audit-smoke.js) — CLI orchestrator
- [`../prompts/session-audit.md`](../prompts/session-audit.md) — per-session auditor prompt
- [`../prompts/phase-audit-summary.md`](../prompts/phase-audit-summary.md) — aggregator prompt
- [`../CONVENTIONS.md`](../CONVENTIONS.md) §8 — failure mode handling (surface, never auto-fix)
- DEC-DEV-0034 in [`../../../DEV_JOURNAL.md`](../../../DEV_JOURNAL.md) — Phase 4.1 design rationale
