---
description: Non-deferrable self-correction mandate — the instant a task/artifact/decision is found to be done INCORRECTLY (and is fixable now), run /product:lesson BEFORE any other work. Synced surface so existing installs receive the trigger via /ecosystem:update. Companion to skills/product/lesson-capture.md.
---

# Self-Correction Mandate — Skill for Ecosystem

Per DEC-DEV-0062 (LESSON-* atomic self-correction mechanism).

This skill is the **synced** home of the self-correction mandate. The same rule is authored once into a product project's root `CLAUDE.md` at bootstrap — but `/ecosystem:update` syncs `.claude/` and **never** touches project-root `CLAUDE.md`. So this `.claude/skills/ecosystem/` surface guarantees existing installs receive the **trigger**, not only the hook **teeth** (`lesson-gate.js` / `lesson-presence-gate.js`).

## The mandate

**В момент, когда ассистент или человек понимает, что задача / артефакт / решение сделаны НЕКОРРЕКТНО и это исправимо сейчас — запусти `/product:lesson` ДО любой другой работы.**

- НЕ дописывай текущую задачу первой. НЕ клади в очередь `.product/.pending/`. НЕ «потом».
- Операция атомарна: **find → примени фикс сейчас → запиши `LESSON-*`** (`status: active`, `fix_ref` заполнен, переиспользуемый `guard`) → готово к использованию.
- Это **инверс** `.product/.pending/`: pending — отложенная работа; LESSON — фикс уже применён к моменту записи.

## When /product:lesson vs NOTE-* vs .pending/

| Ситуация | Куда |
|---|---|
| Ошибка найдена И исправима **сейчас** | **`/product:lesson`** (LESSON-*) |
| Идея/наблюдение/«надо бы потом», фикс сейчас невозможен | `NOTE-*` (`/product:note`) |
| Finding правила/каскада, обрабатывается на gate (отложенная работа) | `.product/.pending/*` (хуки пишут сами) |

Ключевой тест: **фикс можно применить в этой сессии?** Да → LESSON. Нет → NOTE.

## Detection is the soft point (honesty)

Все слои механизма активируются **после** того, как ошибка замечена. Mandate уменьшает «забыл зафиксировать», но не «не заметил». Event-driven кандидаты снижают зависимость от in-the-moment awareness: dismissed/deferred DA finding, validation-fail, cascade-событие — могут поднять candidate LESSON (см. `processes.md §6.5`). Гарантия честно формулируется как «**не теряется ОДНАЖДЫ обнаруженное**».

## Enforcement (что произойдёт, если оставить open)

- `lesson-gate.js` (Stop, **strict** по умолчанию) не даст чисто закрыть сессию, пока есть `status: open` урок.
- `lesson-presence-gate.js` (PreToolUse + UserPromptSubmit, **strict** по умолчанию с 2026-07-11) напоминает каждый ход (UserPromptSubmit) и **отказывает** мутирующим вызовам (Write/Edit/Bash/NotebookEdit), пока урок открыт. Не блокируются: правки самих `.product/lessons/**` и активный протокол `/product:lesson` (свежий маркер `lesson-in-progress`).
- Опт-аут: env `LESSON_GATE_MODE` = `warn` | `off` (см. DEC-DEV-0062). `/ecosystem:verify` предупреждает, если gate тихо отключён.

## Related

- `.claude/skills/product/lesson-capture.md` — the transactional protocol (7 phases)
- `.claude/commands/product/lesson.md` — invoking command
- `.claude/docs/pmo/artifacts/LESSON.md` — LESSON artifact spec
- `.claude/docs/pmo/validation.md` — V-LE-01..05
