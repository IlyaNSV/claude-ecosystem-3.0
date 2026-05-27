# docs/ — Source of truth for Ecosystem 3.0 architecture

> **Назначение:** декларативные SPEC-документы и PMO-каталоги. Source of truth для «что есть Ecosystem 3.0».
>
> **Принцип разделения:** `docs/` = **ЧТО** (артефакты, правила, контракты). `skills/`, `commands/`, `agents/` = **КАК** (методология, conversation flow). При расхождении — `docs/` побеждает.
>
> **НЕ путать с:** `dev/` (внутренние документы про разработку *самой* экосистемы — phase readiness, design docs, meta-improvement); `templates/` (шаблоны для end-user проектов).

---

## Модули (SPEC documents)

Каждый module SPEC — single source of truth для своей зоны. Версионируются independently.

| Модуль | SPEC | Зона ответственности |
|---|---|---|
| **Product Module** | [product-module/SPEC.md](product-module/SPEC.md) | D1 (Discovery + Planning) + D2-Behavioral; 22 артефакта; handoff generation |
| **Integrator Module** | [integrator-module/SPEC.md](integrator-module/SPEC.md) | «Сисадмин» экосистемы — install/configure/connect внешние инструменты под PMO-карту |
| **Design Module** | [design-module/SPEC.md](design-module/SPEC.md) | Условный sub-module: D2-B04 UI Design когда `FM.has_ui=true` |
| **Orchestrator Module** | _(planned, post-pilot)_ | Запуск инструментов и оркестрация сценариев D3-D6 |

---

## PMO (cross-cutting catalogs)

Эти файлы — общая база для всех модулей. Изменения здесь каскадятся в SPEC-документы и skills.

| Что | Файл | Описание |
|---|---|---|
| 🗺️ **Карта 6 доменов** | [pmo/pmo-map.md](pmo/pmo-map.md) | D1-D6 функциональные обязанности; кто owns, что delegated |
| ⚙️ **Процессы P1-P5** | [pmo/processes.md](pmo/processes.md) | Методология создания/обновления артефактов; approve gates; BG extraction; cascade; DA review |
| ✅ **Validation rules** | [pmo/validation.md](pmo/validation.md) | 33 активных правила (V-*, V-H-*, V-MK-*) + adaptive-depth + tier activation |
| 📚 **22 типа артефактов** | [pmo/artifacts/README.md](pmo/artifacts/README.md) | Каталог: PS, MR, CA, SEG, VP, HYP, MVP, RM, RL, FM, SC, BR, LC, VC, IC, RPM, NFR, BG, MK, DS, NM, NOTE |
| 📦 **Handoff формат** | [product-module/handoff-spec.md](product-module/handoff-spec.md) | Universal markdown snapshot для D2-Tech delegation |

---

## Куда смотреть для типичных задач

| Хочу узнать... | Смотри |
|---|---|
| Что такое конкретный артефакт (PS, FM, BR, ...) | [pmo/artifacts/](pmo/artifacts/) → `<TYPE>.md` |
| Какой процесс создаёт артефакт X | [pmo/processes.md](pmo/processes.md) → P1-P5 sections |
| Какие validation rules применяются | [pmo/validation.md](pmo/validation.md) |
| Какие модули trigger'ятся для UI-фичи | [design-module/SPEC.md](design-module/SPEC.md) § «Условная активация» |
| Что попадает в handoff к external tool | [product-module/handoff-spec.md](product-module/handoff-spec.md) |
| Как Integrator подключает новый инструмент | [integrator-module/SPEC.md](integrator-module/SPEC.md) § installation flow |

---

## Что в `docs/` НЕ живёт

- **Skills (методология AI-диалога)** — в `skills/<module>/<name>.md` (репо root)
- **Slash commands** — в `commands/<module>/<name>.md`
- **Hook implementations** — в `hooks/<module>/*.js` + `manifest.yaml`
- **Subagent prompts** — в `agents/<module>/<name>.md`
- **Внутренние phase docs** — в `dev/` (readiness gates, design docs для самой экосистемы)
- **End-user templates** — в `templates/project/`
- **Conventions для разработчиков ecosystem** — в [`CLAUDE.md`](../CLAUDE.md) (repo root)

---

## Связанные документы вне `docs/`

- [`../README.md`](../README.md) — entry point репо; quick start + four-modules overview
- [`../CLAUDE.md`](../CLAUDE.md) — conventions для разработчиков экосистемы (hooks/skills/commits/DEV_JOURNAL)
- [`../ROADMAP.md`](../ROADMAP.md) — план фаз + «Где мы сейчас» (single source of truth)
- [`../DEV_JOURNAL.md`](../DEV_JOURNAL.md) — журнал архитектурных решений (DEC-DEV-XXXX entries)
- [`../CHANGELOG.md`](../CHANGELOG.md) — release notes
- [`../BOOTSTRAP.md`](../BOOTSTRAP.md) — installation overview
- [`../INSTALL-HUMAN.md`](../INSTALL-HUMAN.md) — human-side pre-install checklist
