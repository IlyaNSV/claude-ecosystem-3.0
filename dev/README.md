# dev/ — внутренние документы разработки Ecosystem 3.0

> Не попадают в пользовательские проекты при bootstrap (фильтруются denylist'ом).
> Контекст про разработку **самой экосистемы**.
>
> **Статус проекта** — [ROADMAP.md «Где мы сейчас»](../ROADMAP.md#где-мы-сейчас).
> **Кому верить при конфликте источников** — [`INFORMATION-MAP.yaml`](INFORMATION-MAP.yaml).

## Правило этого файла

Здесь — **назначение и жизненный цикл** директорий, и НИЧЕГО про состояние конкретных треков.
Состояние живёт в самих файлах (`status:` в шапке трека/шва) и в `git log`.

_Почему так: прежняя версия карты перечисляла статусы файлов поимённо и к 2026-07-28 описывала
9 директорий из 16, объявляла закрытые гейты «частично прогнанными» и не знала весь текущий фокус
работ. Ручной реестр состояния обречён отставать — DEC-DEV-0227._

## Директории

| Папка | Что | Жизненный цикл |
|---|---|---|
| **`meta-improvement/`** | Модуль D7: SPEC, CONVENTIONS, чеклисты, паттерны, рубрики, скрипты, audit-pipeline, work-rails | живой код, **не архивируется** (CONVENTIONS §2) |
| **`gates/`** | Readiness-гейты и smoke-планы | после прогона/closure → `_archive/<фаза>/` (CONVENTIONS §5.1) |
| **`plans/`** | Активные планы работ | завершение → архив или удаление |
| **`deferred/`** | Отложенные инициативы с полным контекстом для bring-forward | пробуждаются по триггеру из [`v1_1_backlog.md`](v1_1_backlog.md) |
| **`tech-debt/`** | Post-closure findings по фазам и аудитам | закрываются фиксом или явным defer |
| **`scripts/`** | Вспомогательные dev-утилиты (не D7-механизмы) | живые |
| **`_archive/`** | Завершённое прошлое: фазы, треки, ротированные каноны, audit-reports | read-only история; правится только связность путей |

### Треки

Каждый трек — папка со своим `TRACK.md` (хартия) и/или `SEAM.md` (контекстный шов между сессиями,
протокол — [`deferred/CONTEXT_SEAM_PROTOCOL.md`](deferred/CONTEXT_SEAM_PROTOCOL.md)).

| Папка | Тема |
|---|---|
| `global-loop/` | Единый план Глобальной петли (ассист-пульт, релизный цикл пилота) |
| `host-console/` | Кондуктор — мультипликатор сессий и слой автономного управления ими |
| `release-dod/` | Release DoD — критерий остановки релизного цикла |
| `process-fabric/` | Process Fabric: межпроцессная линия фичи (design-SSOT + OD7-вердикты) |
| `product-browse/` | `/product:browse` + `/product:ask` — вьюер и Q&A над `.product/` |
| `coherence/` | Трек когерентности репо (реестры находок и применённых правок) |
| `context-audit/` | Аудит контекстной нагрузки: зонды, батареи, вердикты |
| `semantic-continuity/` | Смысловая непрерывность между сессиями (протокол швов) |
| `tech-uplift/` | Курс на расширенный стек: заимствования ландшафта и структурный переход (`PLAN.md` + `VISION.md`) |
| `universality-assessment/` | Оценка универсальности экосистемы |
| `vm-observability/` | Наблюдаемость VM: сделать работу сессий видимой глазами, не только в терминале |

> **Статус трека — в его `TRACK.md` / `SEAM.md`, не здесь.** Шов со `status: ACTIVE`
> **впрыскивается хуком** в каждую компактованную сессию — поэтому закрытый трек обязан нести
> `CLOSED`/`SUPERSEDED`, иначе он приказывает переделать сделанное.

## Файлы в корне `dev/`

- [`INFORMATION-MAP.yaml`](INFORMATION-MAP.yaml) — information-topology resolver: класс информации → SSOT → кто прав при конфликте (**живой канон**)
- [`v1_1_backlog.md`](v1_1_backlog.md) — living-список отложенного (post-MVP v1.1+)
- `ECOSYSTEM_VISION.md`, `RESEARCH_CAPABILITY_BLUEPRINT.md`, `AUTONOMY_POLICY_F1_CONTRACT.md` — дизайн-документы направлений
- `COHERENCE_AUDIT_*.md`, `LOOP_READINESS_AUDIT.md`, `VIBE_CODING_ANALYSIS.md`, `DOCS_UX_BATCH_DESIGN.md`, `FEEDBACK_CONTOUR_SPLIT_PLAN.md` — аудиты и батч-дизайны (исторические, но с живыми решениями внутри)
- `ORCHESTRATOR_DOGFOOD_RUN_01.md`, `ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md` — леджеры live-прогонов

## Гигиена

Пороги ротации, протухшие статусы, ссылки в архиве и always-on объём меряет
`node dev/meta-improvement/scripts/doc-health.cjs` (warn-only, в цепи `npm run verify`).
Процедура разбора находок — [`meta-improvement/skills/repo-hygiene.md`](meta-improvement/skills/repo-hygiene.md).

---

> **Reorg 2026-06-14:** планы/гейты/deferred переехали из корня `dev/` в подпапки.
> **Deadweight-sweep 2026-07-11** (DEC-DEV-0185): разовые брифы, research-бейкоффы и VISION-батчи →
> `_archive/`; инициативы `product-radar`/`factory-conductor` вынесены в отдельные репо.
> **Hygiene-sweep 2026-07-28** (DEC-DEV-0227): закрытые гейты → `_archive/`, статусы треков приведены
> к факту, эта карта перестала дублировать состояние.
> Ссылки в накопительной истории (`DEV_JOURNAL`/`CHANGELOG`) при переездах **не переписываются** —
> это point-in-time история.
