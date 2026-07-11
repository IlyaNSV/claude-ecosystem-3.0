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
| `a8afb3b1-2291-4f74-9335-f11abebe145d` | 2026-06-16T13:31:19Z | design-fm004 | — | zones:D2B04-design+D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 0/1/2 | [`a8afb3b1-2291-4f74-9335-f11abebe145d.md`](../_archive/audit-reports/a8afb3b1-2291-4f74-9335-f11abebe145d.md) |
| `0f2827ea-a7a1-4f9f-8f8e-fb9839df526e` | 2026-06-16T13:21:46Z | my-first-test | — | zones:D2B04-design+D2B-behavioral|unknown | findings | 0/0/0/0/0 | 0/0/2 | [`0f2827ea-a7a1-4f9f-8f8e-fb9839df526e.md`](../_archive/audit-reports/0f2827ea-a7a1-4f9f-8f8e-fb9839df526e.md) |
| `4e5d7666-9d9e-4618-a6d0-42719a4f2775` | 2026-06-16T13:08:15Z | my-first-test | — | zones:D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 0/1/2 | [`4e5d7666-9d9e-4618-a6d0-42719a4f2775.md`](../_archive/audit-reports/4e5d7666-9d9e-4618-a6d0-42719a4f2775.md) |
| `a64afb94-6081-40ef-8d6e-f69aa47ee136` | 2026-06-16T13:00:57Z | my-first-test | — | zones:D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 0/1/3 | [`a64afb94-6081-40ef-8d6e-f69aa47ee136.md`](../_archive/audit-reports/a64afb94-6081-40ef-8d6e-f69aa47ee136.md) |
| `ebf3cc2c-af71-46d5-bc3e-3db2722798a9` | 2026-06-16T12:52:05Z | my-first-test | — | zones:D2B-behavioral+D6-integrator|feature | findings | 0/0/0/0/0 | 2/1/2 | [`ebf3cc2c-af71-46d5-bc3e-3db2722798a9.md`](../_archive/audit-reports/ebf3cc2c-af71-46d5-bc3e-3db2722798a9.md) |
| `4b141121-d0b0-4128-a8bf-eb72f77bdd43` | 2026-06-16T12:14:19Z | my-first-test | — | zones:D2B04-design+D2B-behavioral|unknown | findings | 0/0/0/0/0 | 0/2/2 | [`4b141121-d0b0-4128-a8bf-eb72f77bdd43.md`](../_archive/audit-reports/4b141121-d0b0-4128-a8bf-eb72f77bdd43.md) |
| `483517bb-f1cf-46b9-a57a-9b7275bb3ac6` | 2026-06-16T12:06:59Z | my-first-test | — | zones:D6-integrator|unknown | findings | 0/0/0/0/0 | 0/0/2 | [`483517bb-f1cf-46b9-a57a-9b7275bb3ac6.md`](../_archive/audit-reports/483517bb-f1cf-46b9-a57a-9b7275bb3ac6.md) |
| `52fff494-0bce-4393-af73-ee374148081d` | 2026-06-16T11:57:42Z | my-first-test | — | zones:mixed|unknown | findings | 0/0/0/0/0 | 0/1/1 | [`52fff494-0bce-4393-af73-ee374148081d.md`](../_archive/audit-reports/52fff494-0bce-4393-af73-ee374148081d.md) |
| `6dc62bc8-457d-4911-a412-99a46488aa46` | 2026-06-16T11:51:30Z | my-first-test | — | zones:D6-integrator|unknown | findings | 0/0/0/0/0 | 0/0/2 | [`6dc62bc8-457d-4911-a412-99a46488aa46.md`](../_archive/audit-reports/6dc62bc8-457d-4911-a412-99a46488aa46.md) |
| `c4546225-9d22-4325-8a0a-13a57e4eafd6` | 2026-06-16T11:39:16Z | my-first-test | — | zones:D6-integrator|maintenance | findings | 0/0/0/0/0 | 0/0/1 | [`c4546225-9d22-4325-8a0a-13a57e4eafd6.md`](../_archive/audit-reports/c4546225-9d22-4325-8a0a-13a57e4eafd6.md) |
| `e6ac6f02-c594-4f46-b9f6-d9505a24145a` | 2026-06-11T14:54:05Z | my-first-test | — | zones:D2B-behavioral+D2B04-design|unknown | findings | 0/0/0/0/0 | 0/0/1 | [`e6ac6f02-c594-4f46-b9f6-d9505a24145a.md`](../_archive/audit-reports/e6ac6f02-c594-4f46-b9f6-d9505a24145a.md) |
| `b87c7903-b0bb-4190-ab60-429f8534e141` | 2026-06-11T14:49:15Z | my-first-test | — | zones:D6-integrator|unknown | findings | 0/0/0/0/0 | 0/2/2 | [`b87c7903-b0bb-4190-ab60-429f8534e141.md`](../_archive/audit-reports/b87c7903-b0bb-4190-ab60-429f8534e141.md) |
| `48cb5bfe-6ed5-40a4-960c-1ccc97b29e8f` | 2026-06-11T14:42:38Z | my-first-test | — | zones:D2B04-design+D6-integrator+D2B-behavioral|unknown | findings | 0/0/0/0/0 | 0/0/2 | [`48cb5bfe-6ed5-40a4-960c-1ccc97b29e8f.md`](../_archive/audit-reports/48cb5bfe-6ed5-40a4-960c-1ccc97b29e8f.md) |
| `e3fedd85-2839-4b4a-a6c3-5602cddf77f4` | 2026-06-11T14:34:51Z | my-first-test | — | zones:D2B04-design+D6-integrator+D2B-behavioral|unknown | findings | 0/0/0/0/0 | 0/1/0 | [`e3fedd85-2839-4b4a-a6c3-5602cddf77f4.md`](../_archive/audit-reports/e3fedd85-2839-4b4a-a6c3-5602cddf77f4.md) |
| `256c3749-d126-4599-ba16-f48da0092bf8` | 2026-06-11T14:15:19Z | my-first-test | — | zones:D2B04-design|feature | findings | 0/0/0/0/0 | 0/3/3 | [`256c3749-d126-4599-ba16-f48da0092bf8.md`](../_archive/audit-reports/256c3749-d126-4599-ba16-f48da0092bf8.md) |
| `b93269d3-675d-47e9-9458-ab7666d530bf` | 2026-06-11T14:08:12Z | my-first-test | — | zones:D2B04-design+D6-integrator+D2B-behavioral|feature | findings | 0/0/0/0/0 | 0/0/1 | [`b93269d3-675d-47e9-9458-ab7666d530bf.md`](../_archive/audit-reports/b93269d3-675d-47e9-9458-ab7666d530bf.md) |
| `1cdfa987-2c7f-40c1-9ee1-957b14951f11` | 2026-06-02T15:17:45Z | my-first-test | — | zones:D2B04-design+D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 0/0/0 | [`1cdfa987-2c7f-40c1-9ee1-957b14951f11.md`](../_archive/audit-reports/1cdfa987-2c7f-40c1-9ee1-957b14951f11.md) |
| `abb35d42-8702-4438-b6ec-e2e18d85f575` | 2026-06-02T14:53:29Z | my-first-test | — | zones:D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 1/0/0 | [`abb35d42-8702-4438-b6ec-e2e18d85f575.md`](../_archive/audit-reports/abb35d42-8702-4438-b6ec-e2e18d85f575.md) |
| `e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | findings | 0/0/0/13/0 | 1/2/2 | [`e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md`](audit-reports/e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) |
| `31394d98-ea1a-4b77-bdc3-c243cc819bed` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | findings | 2/0/0/11/0 | 0/1/1 | [`31394d98-ea1a-4b77-bdc3-c243cc819bed.md`](audit-reports/31394d98-ea1a-4b77-bdc3-c243cc819bed.md) |
| `0c10a7c0-da21-4676-ada9-08d1ef0468c0` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | fail | 0/1/1/11/0 | 1/0/1 | [`0c10a7c0-da21-4676-ada9-08d1ef0468c0.md`](audit-reports/0c10a7c0-da21-4676-ada9-08d1ef0468c0.md) |
| `0781ad12-b57e-4cad-808f-429c4fee2b81` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | findings | 0/0/0/13/0 | 2/4/0 | [`0781ad12-b57e-4cad-808f-429c4fee2b81.md`](audit-reports/0781ad12-b57e-4cad-808f-429c4fee2b81.md) |
| `a2aa99d4-7d0d-46d1-8295-b7ae768249e1` | 2026-05-26T00:00:00Z | my-first-test | 4 | full | partial | 0/1/0/11/1 | 0/1/1 | [`a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md`](audit-reports/a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md) |
| `e1615a0c-149d-446f-9111-7ca8d49d46ab` | 2026-05-20T13:00:00Z | my-first-test | 4 | full | fail | 2/1/1/9/0 | 0/4/1 | [`e1615a0c-149d-446f-9111-7ca8d49d46ab.md`](../_archive/audit-reports/e1615a0c-149d-446f-9111-7ca8d49d46ab.md) |
| `bf7eaea4-d53f-4b0d-b736-fd78a6193f8b` | 2026-05-20T11:00:23Z | my-first-test | 4 | full | fail | 1/0/1/11/0 | 0/0/2 | [`bf7eaea4-d53f-4b0d-b736-fd78a6193f8b.md`](../_archive/audit-reports/bf7eaea4-d53f-4b0d-b736-fd78a6193f8b.md) |
| `98cb1b97-d338-435b-b152-182d4aec90d3` | 2026-05-15T15:30:00Z | my-first-test | 4 | full | fail | 0/0/1/14/0 | 1/2/1 | [`98cb1b97-d338-435b-b152-182d4aec90d3.md`](../_archive/audit-reports/98cb1b97-d338-435b-b152-182d4aec90d3.md) |
| `5345f116-93ff-455f-92f4-77410fd3a37d` | 2026-05-15T12:00:00Z | my-first-test | 4 | full | fail | 0/1/1/13/0 | 0/0/1 | [`5345f116-93ff-455f-92f4-77410fd3a37d.md`](../_archive/audit-reports/5345f116-93ff-455f-92f4-77410fd3a37d.md) |
| `fbb32599-4066-435b-a92d-54374b683596` | 2026-05-15T08:00:00Z | my-first-test | 4 | full | partial | 2/2/0/11/0 | 0/3/2 | [`fbb32599-4066-435b-a92d-54374b683596.md`](../_archive/audit-reports/fbb32599-4066-435b-a92d-54374b683596.md) |
| `9da2652a-7d70-452a-9e74-fe6cbfcc4b3d` | 2026-05-15T09:30:00Z | my-first-test | 4 | full | partial | 0/2/0/12/1 | 0/2/0 | [`9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md`](../_archive/audit-reports/9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md) |
| `8f10e02f-816c-4b56-a364-cdc925d00f6f` | 2026-05-15T11:30:00Z | my-first-test | 4 | full | partial | 0/1/0/14/0 | 0/0/1 | [`8f10e02f-816c-4b56-a364-cdc925d00f6f.md`](../_archive/audit-reports/8f10e02f-816c-4b56-a364-cdc925d00f6f.md) |
| `306c196c-89e7-442f-810e-d25c8cb903b6` | 2026-05-26T12:34:50Z | my-first-test | 5 | manual | partial | 0/1/0/5/0 | 1/0/0 | manual: DEC-DEV-0044 (S6 — journal-hook bug 3 found+fixed) |
<!-- PROCESSED_ROWS_END -->

---

## Notes

- **Idempotency:** the hook skips a `session_id` if it already appears anywhere in this file (either section). The command skips entries in **Processed** unless `--force` is passed.
- **`dismissed` status (manual):** rows with `status: dismissed` (`mode: skip`, coverage/findings `—`, no report) were **never audited** — they were marked handled by hand so `/meta:audit-smoke` skips them via the idempotency rule above. No per-session report exists for these; the report column carries a free-text dismissal note instead. Introduced 2026-05-31 to clear the pre-2026-05-31 Pending backlog (23 sessions) per user request. `parseProcessed` only reads `session_id`, so the `—` placeholders are inert for tooling.
- **Multi-session smoke:** one phase may produce N Processed rows; the phase-summary aggregator unifies them into `audit-reports/phase-<N>-summary.md`.
- **Editing sentinels:** do NOT remove `<!-- PENDING_ROWS_START -->`, `<!-- PENDING_ROWS_END -->`, `<!-- PROCESSED_ROWS_START -->`, `<!-- PROCESSED_ROWS_END -->`. The hook and CLI rely on them as insertion anchors.
- **Cleanup:** entries older than 6 months OR with `status: clean` may be archived to `_archive/audit-index-<YYYY>.md` manually (see CONVENTIONS §5).
  - Ротация исполнена 2026-07-11: clean/dismissed-строки → [`../_archive/audit-index-2026.md`](../_archive/audit-index-2026.md); архив репортов → `../_archive/audit-reports/`.
- **Schema references:**
  - Per-session report frontmatter — [`prompts/session-audit.md`](prompts/session-audit.md) Step 4
  - Phase-summary report frontmatter — [`prompts/phase-audit-summary.md`](prompts/phase-audit-summary.md) (added in Commit 2 of Phase 4.1)
- **Workflow:** see [`checklists/audit-smoke-workflow.md`](checklists/audit-smoke-workflow.md) for the smoke-then-audit ritual.
