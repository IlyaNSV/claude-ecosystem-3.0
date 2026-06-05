# LESSON-* — Corrective Lesson

> **Тип:** lesson
> **Домен:** Cross-cutting (вне D1-D2 структуры)
> **Review:** 🟡 Standard
> **Cardinality:** Per lesson (без верхней границы)
> **Владелец:** любой процесс / ассистент при self-detected error
> **Введён:** v1.5.0 (atomic find→fix→record; инверс `.pending/` deferred queue, DEC-DEV-0062)

## Purpose

**Захват момента, когда задача / артефакт / решение были сделаны НЕКОРРЕКТНО — с уже применённым и проверенным фиксом и переиспользуемым guard'ом против повтора.**

LESSON-* — это НЕ заметка «надо бы поправить». Это запись об ошибке, которая **уже исправлена прямо сейчас**, плюс урок, который можно применить немедленно:

- **What went wrong** — что конкретно сломали/сделали не так
- **Root cause** — почему (корневая причина, не симптом)
- **Fix applied** — что и где исправлено + evidence (команда проверки и её результат)
- **Guard** — переиспользуемый барьер (правило/чек/конвенция/тест), чтобы не повторить

**Ключевое отличие от `.product/.pending/*` очередей:** pending-файлы — это **отложенная работа** (finding записан, фикс позже, surfacing на gate). LESSON — **инверс**: операция find → fix → record атомарна и неоткладываема. `status: active` структурно невозможен без применённого фикса (см. V-LE-02/03). Если исправить **сейчас нельзя** — это [`NOTE-*`](NOTE.md), а не LESSON.

**НЕ дублирует** [DEV_JOURNAL / decision journal]: journal отвечает «почему выбрали вариант X из ≥2»; LESSON отвечает «что сломалось + как уже починено + guard».

## Frontmatter Schema

```yaml
---
id: LESSON-<NNN>
type: lesson
title: "Короткое имя урока"
status: open                       # open → active → deprecated (enum в Lifecycle States; в файле — ОДНО значение)
severity: medium                   # low | medium | high | critical — required если status=active
fix_ref:                           # required если status=active — куда лёг фикс (пути/artifact-id), каждый должен резолвиться
  - "<path-or-artifact-ref>"
guard: "Переиспользуемый барьер против повтора"   # required если status=active — actionable, не «быть внимательнее»
guard_kind: convention             # validation-rule | checklist-item | skill-note | convention | test — required если status=active
applies_to:                        # optional, informational (НЕ dependency, не каскадит)
  - "<artifact-id-or-path>"
trigger_source: self-detected      # optional: self-detected | da-dismissed | validation-fail | cascade | human
confidence: high                   # high | medium | low
confidence_notes: "string"         # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Минимальный required frontmatter:** `id`, `type`, `title`, `status`, `confidence`, `created`, `updated`, `version`.
**Дополнительно required если `status: active`:** `severity`, `fix_ref` (непустой, каждый резолвится), `guard`, `guard_kind`.

> ⚠️ В реальном артефакте каждое поле — **одно конкретное значение** (`status: open`, не `status: open | active`). Пайпы выше — документация enum'а, не литерал для копирования. Hook `lesson-gate.js` парсит `status:` буквально.

## Body Structure

**Обязательные секции (для `status: active`):**

- **## What went wrong** — что именно сделали некорректно (наблюдаемый симптом)
- **## Root cause** — корневая причина (почему это произошло, не «опечатка», а класс ошибки)
- **## Fix applied** — что и где исправлено; **обязательно** включает recorded verification evidence: конкретную команду/проверку и её результат (exit status / наблюдение)
- **## Guard (reusable)** — переиспользуемый барьер: правило валидации, пункт чеклиста, заметка в skill, конвенция или тест

**Опциональные:**

- **## Context** — где/когда возникло, какая сессия/процесс
- **## Related** — ссылки на затронутые артефакты (informational)

## Content Rules

- **Fix-first.** `status: active` запрещён без секции `## Fix applied` с recorded verification evidence. LESSON без применённого фикса — это `.pending` finding или `NOTE-*`, не LESSON.
- **Guard должен быть actionable.** «Быть внимательнее» — не guard. Guard — это конкретный барьер: «добавить V-XX», «пункт в phase-closure checklist», «anti-pattern warning в skill Y».
- **Не дублирует decision journal.** Journal = rationale выбора; LESSON = ошибка + applied fix + guard.
- **Атомарность важнее полноты.** Лучше записать сжато и `active`, чем подробно и оставить `open`. `open` — только tripwire для gate, не parking.

## Relationships

**Входящие:** none (LESSON-* не выводится из других артефактов).

**Исходящие:** через `applies_to[]` — informational links, **НЕ dependency**. Изменение artefacta в `applies_to` **не каскадит** на LESSON.

**Не участвует в графе зависимостей.** Правила `V-01..V-16`, `V-MK-*`, `V-H-*`, cascade (V-11) и orphan detection (V-15) на LESSON **не применяются** — только `V-LE-01..05` (см. [`validation.md` §5.1b](../validation.md)). LESSON может быть «orphan» by design, как NOTE.

## Review Level: 🟡 Standard

Фикс уже применён и проверен — human подтверждает **корректность guard'а** (что барьер действительно предотвращает повтор и не overkill), не сам фикс. Approve лёгкий, но обязателен переход `open → active`.

## Lifecycle States

```
open ──(fix applied + verified, guard recorded)──▶ active ──(superseded / path gone)──▶ deprecated
  │                                                              ▲
  └──(genuine false alarm, НИ ОДИН фикс не лёг)──────────────────┘  (+ пишется NOTE-*)
```

- **open** — единственное незавершённое состояние. Пишется **write-ahead** (ДО того как фикс коснётся диска) с заполненными What-went-wrong + Root-cause. Non-parkable, git-tracked tripwire; блокирует чистое закрытие сессии (`lesson-gate.js`).
- **active** — терминальный успех: ошибка найдена, фикс **применён И проверен** (с recorded evidence), root cause + reusable guard записаны. `severity`/`fix_ref`/`guard`/`guard_kind` обязательны. Готов к использованию сразу.
- **deprecated** — вытеснен более поздним уроком (`supersedes`/`superseded`) или защищаемый путь больше не существует; также терминальное состояние для genuine false-alarm `--withdraw` (когда ни один фикс не лёг — дополнительно пишется `NOTE-*` с обоснованием).

> **Намеренное отклонение от конвенции:** LESSON **подменяет** generic `draft` на `open` (а не добавляет `open` рядом с `draft`). Rationale: `draft` везде parkable-навсегда (quiet-draft mode существует чтобы драфты лежали); LESSON нужно **non-parkable** незавершённое состояние. Зафиксировано в DEC-DEV-0062.

## Examples

**Good (active — найдено, исправлено, guard записан):**
```yaml
---
id: LESSON-003
type: lesson
title: "BR-012 ссылался на удалённый SC-008"
status: active
severity: high
fix_ref:
  - ".product/business-rules/BR-012-refund-window.md"
guard: "V-11 bi-dir ref check должен покрывать BR→SC при удалении SC; добавлен пункт в feature-enrichment checklist"
guard_kind: checklist-item
applies_to:
  - "BR-012"
  - "SC-008"
trigger_source: self-detected
confidence: high
created: 2026-06-05
updated: 2026-06-05
version: 1
---

## What went wrong
При удалении SC-008 не обновил обратную ссылку в BR-012 — BR указывал
на несуществующий сценарий, V-11 не сработал на стороне BR.

## Root cause
Удаление шло вручную через Edit, в обход cascade-check (он триггерится
на approve активного артефакта, а удаление draft SC его не запустило).

## Fix applied
Убрал `SC-008` из `related_scenarios` в BR-012; перечитал — ссылка ушла.
Verification: `grep -n "SC-008" .product/business-rules/BR-012-*.md` → no matches (exit 1).

## Guard (reusable)
Добавлен пункт в feature-enrichment checklist: «при удалении SC — grep
обратных ссылок в BR/IC перед commit». Кандидат на расширение V-11.
```

**Anti-example (это НЕ LESSON):**
```yaml
---
id: LESSON-099
type: lesson
title: "Надо бы потом причесать naming в SC"
status: open
---
❌ Фикс не применён, «потом» — это deferred work. Это NOTE-* (или .pending),
   не LESSON. LESSON фиксирует УЖЕ исправленное.
```

## Common Mistakes

1. **LESSON без applied fix.** «Записал, поправлю позже» — это инверс назначения. Нет фикса → это `NOTE-*`/`.pending`, не LESSON.
2. **Guard = «быть внимательнее».** Не actionable → бесполезен. Guard — конкретный барьер (rule/checklist/convention/test).
3. **Дублирование decision journal.** Rationale выбора → в DEV_JOURNAL; ошибка+фикс+guard → в LESSON.
4. **Оставить `status: open`.** `open` — tripwire, не финальное состояние. Незакрытый LESSON блокирует чистое закрытие сессии (by design).
5. **`--withdraw` уже применённого фикса.** Если фикс лёг в Phase 2 — это не false alarm; завершай через `--resume`, а не отзывай (см. lesson-capture.md).

## Cleanup mechanism

`/product:cleanup` (V-15 orphan detection) **не трогает** LESSON-* — они вне dependency graph, как NOTE-* (cleanup-detector skip'ает LESSON среди root artifacts). Hygiene по возрасту `open`-уроков — через V-LE-05 (`/product:validate` + session-start surfacing).

## Related Skills

- [`lesson-capture.md`](../../../skills/product/lesson-capture.md) — атомарный протокол find → fix → record (7 фаз), вызывается `/product:lesson`
