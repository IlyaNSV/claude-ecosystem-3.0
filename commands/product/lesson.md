---
description: Atomic find→fix→record corrective LESSON-* (fix applied + verified before commit). Use the instant an error is self-detected — the inverse of the deferred .pending queue.
argument-hint: "\"<what went wrong>\"  |  --resume <LESSON-id>  |  --withdraw <LESSON-id> \"<reason>\""
---

# /product:lesson

User invoked: `/product:lesson $ARGUMENTS`

Когда стало понятно, что задача / артефакт / решение сделаны **некорректно** и это **исправимо сейчас** — поймать ошибку, **применить фикс**, проверить и записать переиспользуемый урок. Одна неоткладываемая операция. Inverse of `.product/.pending/` (там — отложенная работа; здесь фикс уже применён к моменту `status: active`).

> Если исправить сейчас **нельзя** — это `NOTE-*`, не LESSON. Запускай `/product:note` (capture), а не эту команду.

Load skill `.claude/skills/product/lesson-capture.md` as the transactional protocol (7 phases + sub-commands).

## Process

### Step 1: Parse arguments

Три режима:
- **new:** `"<что пошло не так>"` — новый урок (Phases 1→7).
- **`--resume <LESSON-id>`** — добить `open`-урок до `active` (применить/проверить фикс, Phase 3→6).
- **`--withdraw <LESSON-id> "<reason>"`** — genuine false alarm: пометить `deprecated` + записать `NOTE-*` с обоснованием. **Запрещено**, если фикс уже лёг (есть маркер `lesson-in-progress` / fix-контекст) — тогда только `--resume`.

При входе: если уже существует `open`-урок (от этой или прошлой сессии) — сначала сообщи о нём (с его origin timestamp) и предложи `--resume` его, прежде чем заводить новый.

### Step 2–7: follow the skill protocol

Маппинг на фазы skill:
1. **FIND** — what went wrong + root cause + цели фикса + severity.
2. **FIX (write-ahead)** — mkdir `.product/lessons/`; allocate `LESSON-<NNN>`; записать файл `status: open` (с What-went-wrong + Root-cause) **до** фикса; поставить маркер `.product/.sessions/lesson-in-progress.<NNN>`; затем применить фикс.
3. **VERIFY-FIX** — проверить, записать verification evidence (команда + результат) в `## Fix applied`.
4. **DRAFT** — собрать Fix applied + Guard (actionable, выбрать `guard_kind`).
5. **RE-VERIFY** — `[Y]` зафиксировать / `[E]` поправить / `[N]` оставить open.
6. **COMMIT** — один Write: `open → active`, заполнить `severity`/`fix_ref`/`guard`/`guard_kind`, `version++`; удалить маркер.
7. **CONFIRM** — однострочный ready-to-use отчёт.

## Important constraints

- **Атомарность / write-ahead.** `open`-файл и маркер пишутся **до** того, как фикс коснётся диска. Любой краш оставляет громкий `open`-tripwire, не теряет факт.
- **Single-run, non-deferrable.** Не ставить в очередь `.pending/`. Не «доделаю текущее, потом урок» — урок first.
- **`active` ⇒ фикс применён и проверен.** V-LE-02/03 не дадут `active` без `fix_ref` (резолвится) + `## Fix applied` + `guard`.
- **`open` блокирует чистое закрытие сессии** (`lesson-gate.js`, Stop). Это by design — доведи через `--resume` или `--withdraw`.
- **`--withdraw` ≠ escape valve.** Применённый фикс — не false alarm; запрещено отзывать. `--withdraw` чужого урока — сначала прочитай его тело.

## Error handling

| Ситуация | Действие |
|---|---|
| Фикс не применился (Edit упал) | Откатить/остановиться; `open`-WAL-маркер уже есть; сказать «доведи через `--resume`». |
| Verify (Phase 3/5) не прошёл | Оставить `status: open` (под gate); инструктировать `--resume`. |
| User отменил до фикса | Файл остаётся `open` WAL-маркером; предложить `--resume` или `--withdraw`. |
| Уже есть `open`-урок из другой сессии | Resumable-with-context (показать origin timestamp), не withdraw-bait. |

## Related

- Skill: `.claude/skills/product/lesson-capture.md`
- LESSON artifact spec: `.claude/docs/pmo/artifacts/LESSON.md`
- Validation: `.claude/docs/pmo/validation.md` (V-LE-01..05)
- Mandate (synced): `.claude/skills/ecosystem/self-correction.md`
- Куда писать «потом»: `.claude/docs/pmo/artifacts/NOTE.md` (НЕ LESSON)
