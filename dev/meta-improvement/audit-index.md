# Audit Index — D7 Session Audit Journal

> **Source of truth** для идемпотентности `/meta:audit-smoke` и `scripts/audit-smoke.js`.
> **Pending** markers пишутся хуком [`session-audit.js`](hooks/session-audit.js) на SessionEnd; **Processed** entries — командой `/meta:audit-smoke` или CLI после успешного per-session audit'а.
> Per DEC-DEV-0034 (Phase 4.1).

## Pending

Markers waiting to be processed. Hook appends rows between the sentinel comments; command consumes batch and moves them to **Processed**.

| session_id | ended_at | target_project | transcript_path |
|---|---|---|---|
<!-- PENDING_ROWS_START -->
<!-- PENDING_ROWS_END -->

## Processed

Sessions already audited. Re-audit requires `--force` (will overwrite per-session report and update row).

| session_id | audited_at | target | phase | mode | status | coverage (cov/part/fail/nc/unc) | findings (b/w/i) | report |
|---|---|---|---|---|---|---|---|---|
<!-- PROCESSED_ROWS_START -->
| `98cb1b97-d338-435b-b152-182d4aec90d3` | 2026-05-15T15:30:00Z | my-first-test | 4 | full | fail | 0/0/1/14/0 | 1/2/1 | [`98cb1b97-d338-435b-b152-182d4aec90d3.md`](audit-reports/98cb1b97-d338-435b-b152-182d4aec90d3.md) |
| `5345f116-93ff-455f-92f4-77410fd3a37d` | 2026-05-15T12:00:00Z | my-first-test | 4 | full | fail | 0/1/1/13/0 | 0/0/1 | [`5345f116-93ff-455f-92f4-77410fd3a37d.md`](audit-reports/5345f116-93ff-455f-92f4-77410fd3a37d.md) |
| `5ba3ee30-592c-4e45-9ef6-08aa22e0ef55` | 2026-05-15T00:00:00Z | my-first-test | 4 | full | clean | 0/0/0/15/0 | 0/0/0 | [`5ba3ee30-592c-4e45-9ef6-08aa22e0ef55.md`](audit-reports/5ba3ee30-592c-4e45-9ef6-08aa22e0ef55.md) |
| `fbb32599-4066-435b-a92d-54374b683596` | 2026-05-15T08:00:00Z | my-first-test | 4 | full | partial | 2/2/0/11/0 | 0/3/2 | [`fbb32599-4066-435b-a92d-54374b683596.md`](audit-reports/fbb32599-4066-435b-a92d-54374b683596.md) |
| `9da2652a-7d70-452a-9e74-fe6cbfcc4b3d` | 2026-05-15T09:30:00Z | my-first-test | 4 | full | partial | 0/2/0/12/1 | 0/2/0 | [`9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md`](audit-reports/9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md) |
| `8f10e02f-816c-4b56-a364-cdc925d00f6f` | 2026-05-15T11:30:00Z | my-first-test | 4 | full | partial | 0/1/0/14/0 | 0/0/1 | [`8f10e02f-816c-4b56-a364-cdc925d00f6f.md`](audit-reports/8f10e02f-816c-4b56-a364-cdc925d00f6f.md) |
<!-- PROCESSED_ROWS_END -->

---

## Notes

- **Idempotency:** the hook skips a `session_id` if it already appears anywhere in this file (either section). The command skips entries in **Processed** unless `--force` is passed.
- **Multi-session smoke:** one phase may produce N Processed rows; the phase-summary aggregator unifies them into `audit-reports/phase-<N>-summary.md`.
- **Editing sentinels:** do NOT remove `<!-- PENDING_ROWS_START -->`, `<!-- PENDING_ROWS_END -->`, `<!-- PROCESSED_ROWS_START -->`, `<!-- PROCESSED_ROWS_END -->`. The hook and CLI rely on them as insertion anchors.
- **Cleanup:** entries older than 6 months OR with `status: clean` may be archived to `_archive/audit-index-<YYYY>.md` manually (see CONVENTIONS §5).
- **Schema references:**
  - Per-session report frontmatter — [`prompts/session-audit.md`](prompts/session-audit.md) Step 4
  - Phase-summary report frontmatter — [`prompts/phase-audit-summary.md`](prompts/phase-audit-summary.md) (added in Commit 2 of Phase 4.1)
- **Workflow:** see [`checklists/audit-smoke-workflow.md`](checklists/audit-smoke-workflow.md) for the smoke-then-audit ritual.
