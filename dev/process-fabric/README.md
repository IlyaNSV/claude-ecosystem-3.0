# dev/process-fabric — аудит процессной ткани + Statechart-слой координации

> **Волна (DEC-DEV-0153, 2026-07-07):** полный аудит процессов экосистемы → концепт Process
> Fabric (межпроцессный statechart-координатор) → каталог процессов → пилотное ядро движка.
> dev-only пакет: НЕ деплоится в пользовательские проекты (кроме кода в `orchestrator/`).

## Состав

| Файл | Что это | Читать когда |
|---|---|---|
| [`EXECUTION_ROADMAP.md`](EXECUTION_ROADMAP.md) | Resume-якорь: статус фаз 0-4, шаги wiring, graduation-критерии, пост-обязательства | **продолжение работы — старт здесь** |
| [`AUDIT_2026-07-07.md`](AUDIT_2026-07-07.md) | Сводный синтез аудита: 79 процессов, 18 де-факто FSM, 36 разрывов, диагноз | старт здесь |
| [`audit/APPENDIX-A-process-map.md`](audit/APPENDIX-A-process-map.md) | Единый реестр процессов + матрица связности + сквозной трейс «идея→прод» | нужна карта/трейс |
| [`audit/APPENDIX-B-gap-analysis.md`](audit/APPENDIX-B-gap-analysis.md) | 36 разрывов G01–G36 с классами и ранжированием; работающие «рефлексы» | приоритизация починки |
| [`audit/APPENDIX-C-determinism-profile.md`](audit/APPENDIX-C-determinism-profile.md) | Детерминизм-профиль; 18 машин состояний; 9 хранилищ extended state | база под FSM-решение |
| [`CONCEPT.md`](CONCEPT.md) | Архитектурный концепт Process Fabric: критический разбор, charter-формат, engine, backpressure, DL-манифест, план | дизайн-SSOT слоя |
| [`catalog.yaml`](catalog.yaml) | Машиночитаемый каталог процессов: иерархия, шаги, DL-классы, события, связи | вход для charter'ов и карт |
| [`CATALOG.md`](CATALOG.md) | Человекочитаемая сводка каталога | обзор |

## Код (consumer-zone, вне этой папки)

- `orchestrator/lib/fabric-engine.cjs` — микро-интерпретатор charter'ов (pure-core + CLI).
- `orchestrator/charters/feature-production-line.json` — первый charter (E2E фичи P3→P7).
- `tests/orchestrator/fabric-engine.test.cjs` — юниты (в `npm run test:orchestrator`).

**Статус: built ≠ validated.** Graduation-критерии — CONCEPT §9 фаза 3 (live-инстанс ≥2 сессии,
машинный NO-GO→remediation→GO, owner-queue resolve). До прохождения — не считать слоем «в бою».
