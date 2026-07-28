# docs/ — что есть Ecosystem 3.0

> **Роль:** индекс зоны `docs/`. Декларативная база — SPEC модулей и PMO-каталоги.
>
> **Принцип разделения:** `docs/` = **ЧТО** (артефакты, правила, контракты).
> `skills/`, `commands/`, `agents/` = **КАК** (методология, ход диалога).
> При расхождении — **`docs/` побеждает**.
>
> **НЕ путать с:** `dev/` (разработка *самой* экосистемы) · `templates/` (шаблоны end-user проектов).

_Этот файл — тонкий индекс, а не второй роутер. Полный роутер «зачем пришёл → куда смотреть» —_
_[корневой README §«Где начать»](../README.md#где-начать); визуальная карта — [docs/MAP.md](MAP.md)._
_(До 2026-07-28 здесь стояла копия того же роутера с 82% пересечением, и она разошлась — в ней_
_Orchestrator числился как «P3–P6, P2/P7 отложены» через месяц после постройки P1–P8; DEC-DEV-0227.)_

## Module SPEC — по одному на зону ответственности

Каждый SPEC — single source of truth для своей зоны, версионируется независимо.
**Статус модулей здесь не дублируется** — он в [ROADMAP «Где мы сейчас»](../ROADMAP.md#где-мы-сейчас).

- [product-module/SPEC.md](product-module/SPEC.md) — D1 + D2-Behavioral; артефакты; генерация handoff
- [design-module/SPEC.md](design-module/SPEC.md) — условный sub-module D2-B04 UI Design (`FM.has_ui=true`)
- [integrator-module/SPEC.md](integrator-module/SPEC.md) — «сисадмин»: install/configure/connect внешних инструментов
- [orchestrator-module/SPEC.md](orchestrator-module/SPEC.md) — runtime-владелец D2-Tech и D3+; процессы P*
- [product-module/handoff-spec.md](product-module/handoff-spec.md) — формат universal markdown snapshot

## PMO — общая база всех модулей

Изменения здесь каскадятся в SPEC и skills.

- [pmo/pmo-map.md](pmo/pmo-map.md) — карта доменов: кто owns, что delegated
- [pmo/processes.md](pmo/processes.md) — процессы: методология, approve-гейты, BG extraction, cascade, DA review
- [pmo/validation.md](pmo/validation.md) — правила валидации (V-*, V-H-*, V-MK-*, V-LE-*, V-AM-*) + adaptive-depth
- [pmo/artifacts/README.md](pmo/artifacts/README.md) — каталог типов артефактов

> Числа (сколько артефактов / правил / команд) намеренно не пишутся прозой ни здесь, ни в SPEC:
> ground truth вычисляется — `node dev/meta-improvement/scripts/check-counts.js`, и он блокирующий.

## Руководство оператора и карты

- [guide/README.md](guide/README.md) — вход «Начни здесь»: лестница L0→L5, роутер «Я хочу…»
- [MAP.md](MAP.md) — визуальный entry-point: pipeline + C4 container
- `guide/02-commands.md`, `guide/03-glossary.md`, `guide/08-skills.md`, `guide/ecosystem-*.html` —
  **генерируются** (`gen:*:check` в `npm run verify`). Правь источники — frontmatter, `*.template.html`, `*.overlay.json`.

## Что в `docs/` НЕ живёт

| Что | Где |
|---|---|
| Методология AI-диалога (skills) | `skills/<module>/<name>.md` |
| Slash-команды | `commands/<module>/<name>.md` |
| Реализации хуков | `hooks/<module>/*.js` + `manifest.yaml` |
| Промпты субагентов | `agents/<module>/<name>.md` |
| Внутренние документы разработки экосистемы | `dev/` |
| Шаблоны end-user проектов | `templates/project/` |
| Конвенции разработчиков экосистемы | [`../CLAUDE.md`](../CLAUDE.md) |
