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
| **`scripts/`** | Вспомогательные dev-утилиты | живые |
| **`_archive/`** | Завершённое прошлое (по фазам + session-audit-v2) | read-only история |

## plans/

- `LOCAL_DOCS_POLISH_PLAN.md` — light-touch docs polish (замена deferred Phase D)
- `ORCHESTRATOR_DOGFOOD_PLAN.md` — эмпирический dogfood-регламент Orchestrator Module (concept v0)
- `PILOT_RECONCILIATION_PLAN.md` — реконсиляция пилот↔экосистема (DEC-DEV-0065)
- `TIER_2_DOC_REFORM_PLAN.md` — gated план Tier-2 doc reform (ждёт 1-2 closure)
- `UBUNTU_PILOT_DEPLOYMENT_PLAN.md` — перенос пилота `my-first-test` на Ubuntu 24.04 (research 2026-06-15)

## gates/ — **[HARD-PREREQ]** перед стартом следующей фазы

> Эти проверки перечислены в [CLAUDE.md «Перед стартом следующей phase»](../CLAUDE.md). Прогоняются на next pilot session; часть — hard-prereq.

- `PATCH_1.3.3_SMOKE_TEST_PLAN.md` — runtime smoke S1-S5
- `PHASE_6_SMOKE_TEST_PLAN.md` — runtime smoke S1-S7 (Design Module)
- `PHASE_7_READINESS.md` — skeleton kickoff Phase 7
- `S_LE_LESSON_GATE_SMOKE.md` — **[HARD-PREREQ]** LESSON-* gate runtime contracts (DEC-DEV-0062) перед переводом `lesson-presence-gate.js` warn→strict

## deferred/

- `PHASE_D_IMPLEMENTATION_PLAN.md` · `PHASE_D_DOCS_WIKI_READINESS.md` · `wiki-design.md` — Phase D Wiki initiative (DEFERRED to v1.1+, DEC-DEV-0046)

---

> **Reorg 2026-06-14:** планы/гейты/deferred-доки переехали из корня `dev/` в подпапки `plans/`/`gates/`/`deferred/`; `SESSION_AUDIT_V2_DESIGN.md` → `_archive/session-audit-v2/`. Ссылки в `DEV_JOURNAL.md` и `CHANGELOG.md` **до этой даты** намеренно сохраняют старые корневые пути (point-in-time история, не переписывается).
