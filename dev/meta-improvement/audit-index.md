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
