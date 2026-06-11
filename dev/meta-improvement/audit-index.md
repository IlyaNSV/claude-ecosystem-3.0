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
| `9fac10c2-240c-42af-a84c-68cf97ed008e` | 2026-06-11T15:00:26Z | my-first-test | — | zones:D6-integrator|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`9fac10c2-240c-42af-a84c-68cf97ed008e.md`](audit-reports/9fac10c2-240c-42af-a84c-68cf97ed008e.md) |
| `e6ac6f02-c594-4f46-b9f6-d9505a24145a` | 2026-06-11T14:54:05Z | my-first-test | — | zones:D2B-behavioral+D2B04-design|unknown | findings | 0/0/0/0/0 | 0/0/1 | [`e6ac6f02-c594-4f46-b9f6-d9505a24145a.md`](audit-reports/e6ac6f02-c594-4f46-b9f6-d9505a24145a.md) |
| `b87c7903-b0bb-4190-ab60-429f8534e141` | 2026-06-11T14:49:15Z | my-first-test | — | zones:D6-integrator|unknown | findings | 0/0/0/0/0 | 0/2/2 | [`b87c7903-b0bb-4190-ab60-429f8534e141.md`](audit-reports/b87c7903-b0bb-4190-ab60-429f8534e141.md) |
| `48cb5bfe-6ed5-40a4-960c-1ccc97b29e8f` | 2026-06-11T14:42:38Z | my-first-test | — | zones:D2B04-design+D6-integrator+D2B-behavioral|unknown | findings | 0/0/0/0/0 | 0/0/2 | [`48cb5bfe-6ed5-40a4-960c-1ccc97b29e8f.md`](audit-reports/48cb5bfe-6ed5-40a4-960c-1ccc97b29e8f.md) |
| `e3fedd85-2839-4b4a-a6c3-5602cddf77f4` | 2026-06-11T14:34:51Z | my-first-test | — | zones:D2B04-design+D6-integrator+D2B-behavioral|unknown | findings | 0/0/0/0/0 | 0/1/0 | [`e3fedd85-2839-4b4a-a6c3-5602cddf77f4.md`](audit-reports/e3fedd85-2839-4b4a-a6c3-5602cddf77f4.md) |
| `65bfd146-619f-4396-9f96-efcc0d8a2801` | 2026-06-11T14:24:49Z | my-first-test | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`65bfd146-619f-4396-9f96-efcc0d8a2801.md`](audit-reports/65bfd146-619f-4396-9f96-efcc0d8a2801.md) |
| `5135a30d-8c71-4475-80d6-5a69aa1dc3d3` | 2026-06-11T14:21:39Z | my-first-test | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`5135a30d-8c71-4475-80d6-5a69aa1dc3d3.md`](audit-reports/5135a30d-8c71-4475-80d6-5a69aa1dc3d3.md) |
| `7b8004f2-a703-4860-9fe7-63ab597e7fae` | 2026-06-11T14:19:28Z | logical-noodling-sparrow | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`7b8004f2-a703-4860-9fe7-63ab597e7fae.md`](audit-reports/7b8004f2-a703-4860-9fe7-63ab597e7fae.md) |
| `256c3749-d126-4599-ba16-f48da0092bf8` | 2026-06-11T14:15:19Z | my-first-test | — | zones:D2B04-design|feature | findings | 0/0/0/0/0 | 0/3/3 | [`256c3749-d126-4599-ba16-f48da0092bf8.md`](audit-reports/256c3749-d126-4599-ba16-f48da0092bf8.md) |
| `b93269d3-675d-47e9-9458-ab7666d530bf` | 2026-06-11T14:08:12Z | my-first-test | — | zones:D2B04-design+D6-integrator+D2B-behavioral|feature | findings | 0/0/0/0/0 | 0/0/1 | [`b93269d3-675d-47e9-9458-ab7666d530bf.md`](audit-reports/b93269d3-675d-47e9-9458-ab7666d530bf.md) |
| `01f5af73-76ba-439f-8050-c13e34a071ef` | 2026-06-11T13:59:56Z | robust-herding-gosling | — | zones:D2B04-design|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`01f5af73-76ba-439f-8050-c13e34a071ef.md`](audit-reports/01f5af73-76ba-439f-8050-c13e34a071ef.md) |
| `918c01be-acc8-4308-bc1d-f0664b922af8` | 2026-06-02T15:21:02Z | my-first-test | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`918c01be-acc8-4308-bc1d-f0664b922af8.md`](audit-reports/918c01be-acc8-4308-bc1d-f0664b922af8.md) |
| `1cdfa987-2c7f-40c1-9ee1-957b14951f11` | 2026-06-02T15:17:45Z | my-first-test | — | zones:D2B04-design+D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 0/0/0 | [`1cdfa987-2c7f-40c1-9ee1-957b14951f11.md`](audit-reports/1cdfa987-2c7f-40c1-9ee1-957b14951f11.md) |
| `3f8a137b-32b4-46e2-a4ee-56b90b57a3b2` | 2026-06-02T15:12:00Z | my-first-test | — | zones:D2B-behavioral|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`3f8a137b-32b4-46e2-a4ee-56b90b57a3b2.md`](audit-reports/3f8a137b-32b4-46e2-a4ee-56b90b57a3b2.md) |
| `24ebc347-4bed-4dd5-8f9e-5159bfd7ce2d` | 2026-06-02T15:08:23Z | my-first-test | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`24ebc347-4bed-4dd5-8f9e-5159bfd7ce2d.md`](audit-reports/24ebc347-4bed-4dd5-8f9e-5159bfd7ce2d.md) |
| `43542e98-ec02-4ce5-a3c3-ab8dafb10a55` | 2026-06-02T15:06:39Z | my-first-test | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`43542e98-ec02-4ce5-a3c3-ab8dafb10a55.md`](audit-reports/43542e98-ec02-4ce5-a3c3-ab8dafb10a55.md) |
| `4661365d-aa7a-4fe9-b81d-5b86a1d7a7d3` | 2026-06-02T15:04:21Z | zippy-popping-gem | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`4661365d-aa7a-4fe9-b81d-5b86a1d7a7d3.md`](audit-reports/4661365d-aa7a-4fe9-b81d-5b86a1d7a7d3.md) |
| `10ff79bd-5953-4aaa-b786-ca385c86028a` | 2026-06-02T15:02:31Z | my-first-test | — | zones:mixed|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`10ff79bd-5953-4aaa-b786-ca385c86028a.md`](audit-reports/10ff79bd-5953-4aaa-b786-ca385c86028a.md) |
| `abb35d42-8702-4438-b6ec-e2e18d85f575` | 2026-06-02T14:53:29Z | my-first-test | — | zones:D2B-behavioral+D6-integrator|unknown | findings | 0/0/0/0/0 | 1/0/0 | [`abb35d42-8702-4438-b6ec-e2e18d85f575.md`](audit-reports/abb35d42-8702-4438-b6ec-e2e18d85f575.md) |
| `0ba814b3-fd3d-49d1-a8ac-ce867399c933` | 2026-06-02T14:46:06Z | my-first-test | — | zones:D2B-behavioral|unknown | clean | 0/0/0/0/0 | 0/0/0 | [`0ba814b3-fd3d-49d1-a8ac-ce867399c933.md`](audit-reports/0ba814b3-fd3d-49d1-a8ac-ce867399c933.md) |
| `4c0cd8f6-223e-4ee3-b36c-6a4db3dd31f1` | 2026-06-02T14:42:41Z | my-first-test | — | zones:D2B-behavioral+D6-integrator|feature | clean | 0/0/0/0/0 | 0/0/0 | [`4c0cd8f6-223e-4ee3-b36c-6a4db3dd31f1.md`](audit-reports/4c0cd8f6-223e-4ee3-b36c-6a4db3dd31f1.md) |
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
| `72befb64-e3f6-4834-ba8b-83cd08ff1e0e` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-30; pre-today backlog, not audited per user request) |
| `606a5f47-38dc-469a-a7db-01c4a43fc14f` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-30; pre-today backlog, not audited per user request) |
| `d86a1c53-efaa-4e8d-b21c-d9a4a8432de6` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-30; pre-today backlog, not audited per user request) |
| `5d71f25f-bb2f-471d-91b5-cdaba906d5ab` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-30; pre-today backlog, not audited per user request) |
| `e371591b-ad46-4e08-8812-4e47f4006f9b` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-30; pre-today backlog, not audited per user request) |
| `2ee4d743-4c2e-458e-98f7-dfc98ce9464d` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-28; pre-today backlog, not audited per user request) |
| `9deee8d1-6765-461c-a0d3-38912c58f12e` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-28; pre-today backlog, not audited per user request) |
| `1434f290-0b82-4b38-b621-8673696dfba4` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-28; pre-today backlog, not audited per user request) |
| `25104561-e0ba-4fb4-9cf3-e9d273b92d21` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `62576c6b-895b-4e8e-837c-6a980a75f4c4` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `4832efeb-d722-4b44-afb0-6db487c29c46` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `c83ae5a1-151f-4f35-82a7-16ec3161efb0` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `da8f4a70-78c5-4b1c-b13c-869a8727a9d6` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `c3e39529-649b-4831-8f8d-5797bfd82db1` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `dbb5c035-4393-4afc-b335-7315bcc65dac` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `636f2cd3-80e7-4c3c-8626-8a2f1e02d11a` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-27; pre-today backlog, not audited per user request) |
| `7ce383ce-f55a-4840-b1ee-156d48db9a4d` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
| `792142dd-63bb-4a0f-946d-c3f14ce3b043` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
| `5ad451e1-de4e-48f1-9720-34f24ef41492` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
| `7c375647-6f64-4e9e-8d10-d5c60ff55bd0` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
| `26c2c8a4-19d1-4ec1-99a2-c8298e7c9b38` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
| `e6ae0749-c97d-4d76-aaf9-c18c1124804e` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
| `be9d5934-9ec7-4c17-b4c1-69fd31f83564` | 2026-05-31T00:00:00Z | my-first-test | — | skip | dismissed | — | — | manually dismissed (orig ended 2026-05-26; pre-today backlog, not audited per user request) |
<!-- PROCESSED_ROWS_END -->

---

## Notes

- **Idempotency:** the hook skips a `session_id` if it already appears anywhere in this file (either section). The command skips entries in **Processed** unless `--force` is passed.
- **`dismissed` status (manual):** rows with `status: dismissed` (`mode: skip`, coverage/findings `—`, no report) were **never audited** — they were marked handled by hand so `/meta:audit-smoke` skips them via the idempotency rule above. No per-session report exists for these; the report column carries a free-text dismissal note instead. Introduced 2026-05-31 to clear the pre-2026-05-31 Pending backlog (23 sessions) per user request. `parseProcessed` only reads `session_id`, so the `—` placeholders are inert for tooling.
- **Multi-session smoke:** one phase may produce N Processed rows; the phase-summary aggregator unifies them into `audit-reports/phase-<N>-summary.md`.
- **Editing sentinels:** do NOT remove `<!-- PENDING_ROWS_START -->`, `<!-- PENDING_ROWS_END -->`, `<!-- PROCESSED_ROWS_START -->`, `<!-- PROCESSED_ROWS_END -->`. The hook and CLI rely on them as insertion anchors.
- **Cleanup:** entries older than 6 months OR with `status: clean` may be archived to `_archive/audit-index-<YYYY>.md` manually (see CONVENTIONS §5).
- **Schema references:**
  - Per-session report frontmatter — [`prompts/session-audit.md`](prompts/session-audit.md) Step 4
  - Phase-summary report frontmatter — [`prompts/phase-audit-summary.md`](prompts/phase-audit-summary.md) (added in Commit 2 of Phase 4.1)
- **Workflow:** see [`checklists/audit-smoke-workflow.md`](checklists/audit-smoke-workflow.md) for the smoke-then-audit ritual.
