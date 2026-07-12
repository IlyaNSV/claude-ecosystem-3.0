# dev/ — внутренние документы разработки Ecosystem 3.0

> Не попадают в пользовательские проекты при bootstrap. Контекст про разработку **самой экосистемы**.
> Статус проекта — единственный источник в [ROADMAP.md «Где мы сейчас»](../ROADMAP.md#где-мы-сейчас).

## Карта

| Папка / файл | Что | Жизненный цикл |
|---|---|---|
| **`plans/`** | Активные планы работ | живые до завершения → архив или удаление |
| **`gates/`** | Smoke-тесты и readiness-гейты фаз (active) | архивируются в `_archive/phase-<N>/` после прогона/closure (CONVENTIONS §5.1) |
| **`deferred/`** | Отложенные инициативы (полный контекст сохранён для bring-forward) | пробуждаются по trigger из `v1_1_backlog.md` |
| **`tech-debt/`** | Post-closure findings по фазам | закрываются фиксом или явным defer |
| **`v1_1_backlog.md`** | Living-список отложенного (post-MVP v1.1+) | живёт в корне `dev/`, обновляется per phase |
| **`meta-improvement/`** | Модуль D7 (mechanisms + checklists + patterns + rubrics + scripts + audit-pipeline) | живой код, НЕ архивируется (CONVENTIONS §2) |
| **`process-fabric/`** | Design-SSOT Process Fabric (CONCEPT + EXECUTION_ROADMAP + OD7-вердикты); исторический балласт — в `_archive/process-fabric/` | живые указатели |
| **`scripts/`** | Вспомогательные dev-утилиты | живые |
| **`_archive/`** | Завершённое прошлое (по фазам + треки: orchestrator, research, vision, plans, audit-reports…) | read-only история |

## plans/

- `TIER_2_DOC_REFORM_PLAN.md` — gated план Tier-2 doc reform (ждёт 1-2 closure)

Завершённые планы (LOCAL_DOCS_POLISH, ORCHESTRATOR_DOGFOOD, PILOT_RECONCILIATION, UBUNTU_PILOT_DEPLOYMENT, CONSOLIDATED_EXECUTION) — в [`_archive/plans/`](_archive/plans/) и [`_archive/orchestrator/`](_archive/orchestrator/) (deadweight-sweep 2026-07-11).

## gates/ — **[HARD-PREREQ]** перед стартом следующей фазы

> Эти проверки перечислены в [CLAUDE.md «Перед стартом следующей phase»](../CLAUDE.md). Прогоняются на next pilot session; часть — hard-prereq.

- `PATCH_1.3.3_SMOKE_TEST_PLAN.md` — runtime smoke S1-S5 (🟠 частично прогнан 2026-07-11; догон S2/S4/S5)
- `PHASE_6_SMOKE_TEST_PLAN.md` — runtime smoke S1-S7 Design Module (🟠 частично прогнан 2026-07-11; догон S1/S3)
- `SMOKE_BATCH_2026-07-11_BRIEF.md` — вердикты batch-прогона 2026-07-11 (§Outcome — SSOT)
- `SUBSTRATE_GRADUATION_GATE.md` — graduation-гейт субстрата

## deferred/

- `PHASE_D_IMPLEMENTATION_PLAN.md` · `PHASE_D_DOCS_WIKI_READINESS.md` · `wiki-design.md` — Phase D Wiki initiative (DEFERRED to v1.1+, DEC-DEV-0046)
- `D7_DEADWEIGHT_CLEANUP.md` — work-order прунинга D7; исполнен repo-wide deadweight-sweep'ом 2026-07-11 (см. статус в файле)
- `CONTEXT_SEAM_PROTOCOL.md` — кандидат-механизм «протокол контекстных швов» (PROPOSED, не активирован; DEC-DEV-0196). В `CLAUDE.md`/память намеренно НЕ внесён до решения владельца

---

> **Reorg 2026-06-14:** планы/гейты/deferred-доки переехали из корня `dev/` в подпапки `plans/`/`gates/`/`deferred/`; `SESSION_AUDIT_V2_DESIGN.md` → `_archive/session-audit-v2/`. Ссылки в `DEV_JOURNAL.md` и `CHANGELOG.md` **до этой даты** намеренно сохраняют старые корневые пути (point-in-time история, не переписывается).
>
> **Deadweight-sweep 2026-07-11:** разовые брифы/планы оркестраторского трека, research-бейкоффы, VISION-батчи и `research-cache/` уехали в `_archive/` (подпапки `orchestrator/`, `research/`, `vision/`, `plans/`, `vibe-coding/`); 41 audit-report → `_archive/audit-reports/`, clean>30d удалены по retention-правилу; инициативы `product-radar/`+`factory-conductor/` вынесены в отдельные репо. Ссылки в накопительной истории (`DEV_JOURNAL`/`CHANGELOG`) не переписывались.
