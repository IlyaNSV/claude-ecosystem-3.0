# Каталог процессов Ecosystem 3.0 — человекочитаемая сводка

> Машиночитаемый реестр — [`catalog.yaml`](catalog.yaml) (94 процесса, 469 шагов, 231 связь;
> js-yaml-валиден). Это НЕ SSOT шагов — SSOT остаются `docs/pmo/processes.md`, orchestrator
> SPEC, командные файлы и `docs/guide/process-graph.overlay.json`; каталог — координационный
> реестр под Process Fabric (charters) и карты. Как собран и какое курирование применено —
> шапка catalog.yaml. Решение: DEC-DEV-0153.

## Объём и структура

| Домен | Процессов | Ядро |
|---|---|---|
| d1-discovery | 5 | P1A, P1B + gap-fill (pivot-протокол, HYP-validation loop, feedback-intake) |
| d2b-spec | 15 | P2A/P2B, DA, APPROVE, BG, P4 cascade, B1 completeness, EpicD-consilium, EpicCi-batch-enrich, NOTE/LESSON/VALIDATE, HO |
| d2d-design | 3 | P2.5, AM + gap-fill usability-audit |
| d2t-arch | 4 | P1o init, P2o консилиум, P3o spec-batch, EXT-cc-sdd-spec-batch |
| d3-delivery | 11 | P5o TDD-impl, run-ledger, OD7, EXT-cc-sdd-impl-loop + Epic E gap-fill (provisioning, CI, deploy, release-cut, rollback…) |
| d4-qa | 7 | P4o fidelity, P6o GO-gate, P7o runtime-smoke + gap-fill (perf/security/post-deploy-smoke/SLO) |
| x-capability | 14 | INT-* (research/scan/add/update/remove/…), adapter-lifecycle + gap-fill (dependency-cadence, stale-refresh, result-ingest) |
| d5-ops | 10 | ECO-* (bootstrap/update/verify), PA-protocol, meta-feedback capture + gap-fill (monitoring-intake, incident-lite, feedback-triage, backup-lite) |
| x-release | 1 | AUTOFLOW-git |
| d7-meta | 11 | phase-kickoff/closure, patch-cut, live-run-validation, session-audit, rails, memory-sync… |
| d6-governance | 10 | process-gate, count-sweep, dec-dev-journal, F1-autonomy-resolve, lesson-gate, validation-tune, meta-feedback… |
| x-research | 3 | guided-research, research-intake, anti-hype-filter |

Итого: **75 existing** (канонические ID сохранены) + **19 gap-fill** из методологий
(Continuous Delivery, DORA, SRE, DevSecOps, Lean Startup, Kanban, PMBOK-lite) — каждый
gap-fill закрывает конкретный названный разрыв пути «идея → прод», не enterprise-копипаста.

## Детерминизм-профиль (469 шагов)

| Класс | Шагов | Доля | Комментарий |
|---|---|---|---|
| DL0 (скрипт) | 163 | 35% | оракулы, хуки, реконсиляторы — готовые guard-функции для FSM |
| DL1 (процедурный LLM) | 146 | 31% | сессии-оркестраторы, install-стадии, ритуалы |
| DL2 (judgment LLM) | 108 | 23% | ревью, аудиты, классификации, валидаторы |
| DL3 (творческий LLM) | 18 | 4% | discovery, авторинг, дизайн (заметная часть — spec-only) |
| H (человек) | 34 | 7% | approve, merge, floor-операции |

Механический полюс (DL0+DL1) = **66%** — прямая зона FSM-контроля; творческий (DL2+DL3) = 27% —
FSM-рамка без микроменеджмента; H = 7% — floor. Профиль независимо сошёлся с оценкой
агрегатора детерминизма (65/25/10, Приложение C) — перекрёстная валидация двух разных методик.

## Связность (231 связь)

| Надёжность | Связей | Читать как |
|---|---|---|
| enforced | 63 | код/харнесс держит переход |
| prompted | 68 | LLM должен вспомнить (главная зона риска — и главная зона профита Fabric) |
| human-memory | 24 | только человек помнит |
| missing | 13 | разрыв: связь должна быть, механизма нет |
| proposed | 63 | связи gap-fill процессов (появятся с ними) |

По типам: data-feed 60 · invoke 50 · feedback 34 · escalation 24 · blocking-gate 17 ·
sequence 15 · cascade 13 · conditional 9 · compensation 4 · parallel 2 · backpressure 2 ·
temporal 1. Обратите внимание: **feedback+escalation = 58 связей, и почти все —
prompted/missing/proposed** — это количественное выражение главного диагноза аудита
(обратный контур не замкнут).

## Известные шероховатости снапшота (честно)

1. Оценки DL/status у гибридных процессов — по доминирующему характеру (внутри есть шаги
   других классов; см. steps).
2. `ECO-meta-feedback` (d5-ops, capture-сторона) и `meta-feedback` (d6-governance, контур
   целиком) намеренно оба в каталоге — стороны одного контура из разных пакетов.
3. P3p-путаница SSOT-оверлея (Feedback-stub vs validation-tune) зафиксирована генератором
   как находка исходника — в каталоге разведены (P3p в d2b-spec, validation-tune в d6).
4. 13 external-целей ссылок (модули/роли/скрипты/артефакты — `meta.external_link_targets`)
   — легитимные не-процессные адресаты, помечены `external: true`.
5. Статусная разметка перепроверена генераторами против кода (напр., P2.5 → partial:
   screen-generator spec-only; P1o — только skill, .mjs нет; OD7 — detect built, await/resume
   гипотеза) — местами честнее, чем самоописания в доках.
