# Audit Index — D7 Session Audit Journal

> **Source of truth** для идемпотентности `/meta:audit-smoke` и `scripts/audit-smoke.js`.
> **Pending** markers пишутся хуком [`session-audit.js`](hooks/session-audit.js) на SessionEnd; **Processed** entries — командой `/meta:audit-smoke` или CLI после успешного per-session audit'а.
> Per DEC-DEV-0034 (Phase 4.1).

## Pending

Markers waiting to be processed. Hook appends rows between the sentinel comments; command consumes batch and moves them to **Processed**.

| session_id | ended_at | target_project | transcript_path |
|---|---|---|---|
<!-- PENDING_ROWS_START -->
| `636f2cd3-80e7-4c3c-8626-8a2f1e02d11a` | 2026-05-27T11:58:39.386Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\636f2cd3-80e7-4c3c-8626-8a2f1e02d11a.jsonl` (reason: prompt_input_exit) |
| `7ce383ce-f55a-4840-b1ee-156d48db9a4d` | 2026-05-26T20:12:48.704Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\7ce383ce-f55a-4840-b1ee-156d48db9a4d.jsonl` (reason: other) |
| `792142dd-63bb-4a0f-946d-c3f14ce3b043` | 2026-05-26T20:07:35.599Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\792142dd-63bb-4a0f-946d-c3f14ce3b043.jsonl` (reason: other) |
| `5ad451e1-de4e-48f1-9720-34f24ef41492` | 2026-05-26T20:07:24.879Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\5ad451e1-de4e-48f1-9720-34f24ef41492.jsonl` (reason: prompt_input_exit) |
| `7c375647-6f64-4e9e-8d10-d5c60ff55bd0` | 2026-05-26T14:59:37.885Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\7c375647-6f64-4e9e-8d10-d5c60ff55bd0.jsonl` (reason: other) |
| `26c2c8a4-19d1-4ec1-99a2-c8298e7c9b38` | 2026-05-26T12:09:34.589Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\26c2c8a4-19d1-4ec1-99a2-c8298e7c9b38.jsonl` (reason: prompt_input_exit) |
| `e6ae0749-c97d-4d76-aaf9-c18c1124804e` | 2026-05-26T11:14:10.907Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\e6ae0749-c97d-4d76-aaf9-c18c1124804e.jsonl` (reason: prompt_input_exit) |
| `be9d5934-9ec7-4c17-b4c1-69fd31f83564` | 2026-05-26T09:49:15.674Z | my-first-test | `C:\Users\pw201\.claude\projects\C--Users-pw201-WebstormProjects-my-first-test\be9d5934-9ec7-4c17-b4c1-69fd31f83564.jsonl` (reason: prompt_input_exit) |
<!-- PENDING_ROWS_END -->

## Processed

Sessions already audited. Re-audit requires `--force` (will overwrite per-session report and update row).

| session_id | audited_at | target | phase | mode | status | coverage (cov/part/fail/nc/unc) | findings (b/w/i) | report |
|---|---|---|---|---|---|---|---|---|
<!-- PROCESSED_ROWS_START -->
| `945809f4-bb16-4fe0-97e5-8cdd91155392` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | clean | 0/0/0/13/0 | 0/0/0 | [`945809f4-bb16-4fe0-97e5-8cdd91155392.md`](audit-reports/945809f4-bb16-4fe0-97e5-8cdd91155392.md) |
| `e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | findings | 0/0/0/13/0 | 1/2/2 | [`e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md`](audit-reports/e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) |
| `fd5cc61e-66c9-4d78-893c-eae967efd1c2` | 2026-05-26T09:55:04Z | my-first-test | 4 | full | clean | 0/0/0/13/0 | 0/0/0 | [`fd5cc61e-66c9-4d78-893c-eae967efd1c2.md`](audit-reports/fd5cc61e-66c9-4d78-893c-eae967efd1c2.md) |
| `31394d98-ea1a-4b77-bdc3-c243cc819bed` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | findings | 2/0/0/11/0 | 0/1/1 | [`31394d98-ea1a-4b77-bdc3-c243cc819bed.md`](audit-reports/31394d98-ea1a-4b77-bdc3-c243cc819bed.md) |
| `0c10a7c0-da21-4676-ada9-08d1ef0468c0` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | fail | 0/1/1/11/0 | 1/0/1 | [`0c10a7c0-da21-4676-ada9-08d1ef0468c0.md`](audit-reports/0c10a7c0-da21-4676-ada9-08d1ef0468c0.md) |
| `cc1cb16a-fbe2-4735-a1c2-c68ee8b9f689` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | clean | 0/0/0/13/0 | 0/0/0 | [`cc1cb16a-fbe2-4735-a1c2-c68ee8b9f689.md`](audit-reports/cc1cb16a-fbe2-4735-a1c2-c68ee8b9f689.md) |
| `0781ad12-b57e-4cad-808f-429c4fee2b81` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | findings | 0/0/0/13/0 | 2/4/0 | [`0781ad12-b57e-4cad-808f-429c4fee2b81.md`](audit-reports/0781ad12-b57e-4cad-808f-429c4fee2b81.md) |
| `a2aa99d4-7d0d-46d1-8295-b7ae768249e1` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | partial | 0/1/0/11/1 | 0/1/1 | [`a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md`](audit-reports/a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md) |
| `bbb68ac9-0d05-43c4-9566-87891e44a6cf` | 2026-05-20T11:31:17Z | my-first-test | 4 | full | clean | 0/0/0/13/0 | 0/0/0 | [`bbb68ac9-0d05-43c4-9566-87891e44a6cf.md`](audit-reports/bbb68ac9-0d05-43c4-9566-87891e44a6cf.md) |
| `e1615a0c-149d-446f-9111-7ca8d49d46ab` | 2026-05-20T13:00:00Z | my-first-test | 4 | full | fail | 2/1/1/9/0 | 0/4/1 | [`e1615a0c-149d-446f-9111-7ca8d49d46ab.md`](audit-reports/e1615a0c-149d-446f-9111-7ca8d49d46ab.md) |
| `bf7eaea4-d53f-4b0d-b736-fd78a6193f8b` | 2026-05-20T11:00:23Z | my-first-test | 4 | full | fail | 1/0/1/11/0 | 0/0/2 | [`bf7eaea4-d53f-4b0d-b736-fd78a6193f8b.md`](audit-reports/bf7eaea4-d53f-4b0d-b736-fd78a6193f8b.md) |
| `98cb1b97-d338-435b-b152-182d4aec90d3` | 2026-05-15T15:30:00Z | my-first-test | 4 | full | fail | 0/0/1/14/0 | 1/2/1 | [`98cb1b97-d338-435b-b152-182d4aec90d3.md`](audit-reports/98cb1b97-d338-435b-b152-182d4aec90d3.md) |
| `5345f116-93ff-455f-92f4-77410fd3a37d` | 2026-05-15T12:00:00Z | my-first-test | 4 | full | fail | 0/1/1/13/0 | 0/0/1 | [`5345f116-93ff-455f-92f4-77410fd3a37d.md`](audit-reports/5345f116-93ff-455f-92f4-77410fd3a37d.md) |
| `5ba3ee30-592c-4e45-9ef6-08aa22e0ef55` | 2026-05-15T00:00:00Z | my-first-test | 4 | full | clean | 0/0/0/15/0 | 0/0/0 | [`5ba3ee30-592c-4e45-9ef6-08aa22e0ef55.md`](audit-reports/5ba3ee30-592c-4e45-9ef6-08aa22e0ef55.md) |
| `fbb32599-4066-435b-a92d-54374b683596` | 2026-05-15T08:00:00Z | my-first-test | 4 | full | partial | 2/2/0/11/0 | 0/3/2 | [`fbb32599-4066-435b-a92d-54374b683596.md`](audit-reports/fbb32599-4066-435b-a92d-54374b683596.md) |
| `9da2652a-7d70-452a-9e74-fe6cbfcc4b3d` | 2026-05-15T09:30:00Z | my-first-test | 4 | full | partial | 0/2/0/12/1 | 0/2/0 | [`9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md`](audit-reports/9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md) |
| `8f10e02f-816c-4b56-a364-cdc925d00f6f` | 2026-05-15T11:30:00Z | my-first-test | 4 | full | partial | 0/1/0/14/0 | 0/0/1 | [`8f10e02f-816c-4b56-a364-cdc925d00f6f.md`](audit-reports/8f10e02f-816c-4b56-a364-cdc925d00f6f.md) |
| `306c196c-89e7-442f-810e-d25c8cb903b6` | 2026-05-26T12:34:50Z | my-first-test | 5 | manual | partial | 0/1/0/5/0 | 1/0/0 | manual: DEC-DEV-0044 (S6 — journal-hook bug 3 found+fixed) |
| `74d1d4b8-df7e-468b-a0f3-52aebc81a089` | 2026-05-26T12:52:23Z | my-first-test | 5 | manual | clean | 1/0/0/5/0 | 0/0/0 | manual: DEC-DEV-0044 (S4 — /integrator:remove PASS clean) |
| `a3dd65f9-a130-4319-a168-2e867121bf0c` | 2026-05-26T13:28:31Z | my-first-test | 5 | manual | clean | 3/0/0/3/0 | 0/2/0 | manual: DEC-DEV-0044 (re-install — bug 1+2 fix verified; covers S1/S2/S3; bug 4 + C-03 warning-level deferred) |
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
