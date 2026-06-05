---
description: D7-in-project modification — atomic find→fix→record corrective LESSON-* (fix applied + verified before commit). Called by /product:lesson. The inverse of the deferred .pending queues — a self-detected error is fixed and recorded NOW, never queued or deferred.
---

# Lesson Capture — Atomic Self-Correction Skill

Когда стало понятно, что задача / артефакт / решение сделаны **некорректно** и это **исправимо сейчас** — поймать ошибку, **применить фикс**, проверить его и записать переиспользуемый урок. Всё это — **одна неоткладываемая операция**.

**Inverse of** `.product/.pending/*` queues: pending — отложенная работа; LESSON — фикс уже применён к моменту записи `status: active`.

## When invoked

- Через команду `/product:lesson "<что пошло не так>"` (новый урок), `/product:lesson --resume <LESSON-id>`, `/product:lesson --withdraw <LESSON-id> "<reason>"`.
- Через **self-correction mandate** ([`skills/ecosystem/self-correction.md`](../ecosystem/self-correction.md) + project `CLAUDE.md`): в момент осознания ошибки запустить `/product:lesson` **ДО любой другой работы** — не дописывать текущую задачу, не ставить в очередь `.pending/`.

## Goal & out-of-scope

- **In scope:** ошибка, которую можно **исправить сейчас**, в этой сессии.
- **Out of scope:** «надо бы потом» → это [`NOTE-*`](../../docs/pmo/artifacts/NOTE.md), не LESSON. LESSON — **не** TODO и **не** deferred queue. Если фикс невозможен сейчас — пиши NOTE.

## Atomicity contract (как именно «не теряется и не откладывается»)

1. **Write-ahead ordering.** Файл урока пишется со `status: open` (с заполненными *What went wrong* + *Root cause*) **ДО** того, как фикс коснётся диска. Плюс ставится маркер `.product/.sessions/lesson-in-progress.<id>`. Любой краш после старта **всегда** оставляет громкий git-tracked `open`-tripwire; краш до первой записи — нетронутый код.
2. **Полный валидный файл за один Write.** Каждая запись файла урока (open, затем active) — это **один** вызов Write с целостным содержимым. Полу-записанный `.md` возможен только при убийстве процесса посреди записи — и его ловит `lesson-gate.js` (open-фенс без закрывающего = tripwire).
3. **Gate против откладывания.** Пока есть `status: open` — `lesson-gate.js` (Stop) не даёт чисто закрыть сессию; `lesson-presence-gate.js` напоминает каждый ход. `active` структурно требует применённый+проверенный фикс (V-LE-02/03).

## Process

### Phase 1 — FIND
- Охарактеризуй **what went wrong** (наблюдаемый симптом) и **root cause** (класс ошибки, не «опечатка»).
- Локализуй цели фикса (файлы/артефакты). Определи `severity` (low/medium/high/critical) и `trigger_source`.
- Если выясняется, что исправить сейчас нельзя → **останов**: предложи `NOTE-*` вместо LESSON.

### Phase 2 — FIX (write-ahead, ТОЛЬКО в этом порядке)
1. `fs.mkdirSync('.product/lessons', {recursive: true})` (через Bash/Write — директория должна существовать; не падать на частичном bootstrap).
2. **Allocate id:** скан `.product/lessons/LESSON-*.md`, взять `max(NNN)+1`, формат `LESSON-<NNN>` (трёхзначный, ведущие нули).
3. **Write-ahead:** записать `.product/lessons/LESSON-<NNN>-<slug>.md` со `status: open`, заполненными секциями `## What went wrong` и `## Root cause` (один Write, целостный файл). Slug — см. ниже.
4. Поставить маркер: записать `.product/.sessions/lesson-in-progress.<NNN>` (любое короткое содержимое: id + timestamp).
5. **Только теперь** применить фикс — Edit/Write по целевым файлам.

> Порядок критичен: open-файл и маркер пишутся **до** фикса. Это и есть write-ahead-log tripwire.

### Phase 3 — VERIFY-FIX (gate)
- Проверь, что фикс реально применился: перечитай целевой файл и/или запусти конкретную проверку (grep, тест, валидатор).
- **Запиши evidence в тело** секции `## Fix applied`: точную команду проверки и её результат (exit status / наблюдение). Это «model-attested with recorded evidence», не доказательство корректности — но инспектируемо.
- Если проверка не прошла → **не** переходить в active; оставить `open`, см. Abort.

### Phase 4 — DRAFT
- Собери в памяти финальные `## Fix applied` (с evidence) и `## Guard (reusable)`.
- Guard обязан быть **actionable** (rule / checklist-item / skill-note / convention / test), не «быть внимательнее». Выбери `guard_kind`.

### Phase 5 — RE-VERIFY (human gate)
Покажи итог и спроси:
```
LESSON-<NNN> готов к фиксации (open → active):
  severity: <...>   fix_ref: <...>   guard_kind: <...>
  [show Fix applied + Guard]

  [Y] Зафиксировать active (фикс применён и проверен)
  [E] Поправить draft
  [N] Оставить open (вернёшься через --resume)
```

### Phase 6 — COMMIT (atomic flip)
На `[Y]`:
1. Перезаписать файл урока **одним Write**: `status: open → active`, заполнить `severity`, `fix_ref` (непустой, каждый резолвится), `guard`, `guard_kind`, `updated`, увеличить `version`.
2. Удалить маркер `.product/.sessions/lesson-in-progress.<NNN>`.
3. (Опц.) Если фикс затронул активные артефакты — обычный flow (cascade-check сработает на их approve независимо).

### Phase 7 — CONFIRM
Однострочный отчёт: `✓ LESSON-<NNN> active — <title>. Fix applied: <fix_ref>. Guard: <guard_kind>. Ready to use.`

### Abort handling
- **Фикс лёг, но Phase 3/5 не прошли** → оставить `status: open` (громко, под gate), сказать пользователю «доведи через `/product:lesson --resume <NNN>`». **НЕ** `--withdraw` (фикс уже на диске — это не false alarm).
- **Ничего не лёг (отмена до фикса)** → файл остаётся `open` как WAL-маркер; предложить `--resume` или `--withdraw <NNN> "<reason>"` (genuine false alarm).

## Sub-commands

- **`--resume <LESSON-id>`** — перечитать `open`-урок, доприменить/проверить фикс, пройти Phase 3→6 до `active`.
- **`--withdraw <LESSON-id> "<reason>"`** — пометить `deprecated` как genuine false alarm **И** записать `NOTE-*` с обоснованием. **ЗАПРЕЩЕНО**, если фикс уже лёг в Phase 2 (наличие маркера / непустой fix-контекст) — тогда только `--resume`. Это защита от тихого dismissal-клапана, который воссоздал бы deferral, против которого LESSON и придуман.

## Frontmatter template (canonical — НЕ варьировать имена полей)

**Canonical field names обязательны.** AI склонен переименовывать поля «для естественности» — это приводит к drift (lesson DEC-DEV-0011, PS drift). Если тянет переименовать — **не переименовывай**.

```yaml
---
id: LESSON-<NNN>
type: lesson
title: "<короткое имя урока>"
status: open                       # open при write-ahead; active при commit; в файле — ОДНО значение
severity: medium                   # low | medium | high | critical (required если active)
fix_ref:                           # required если active — куда лёг фикс; каждый резолвится
  - "<path-or-artifact-ref>"
guard: "<actionable барьер против повтора>"   # required если active
guard_kind: convention             # validation-rule | checklist-item | skill-note | convention | test (required если active)
applies_to:                        # optional, informational (НЕ dependency)
  - "<artifact-id-or-path>"
trigger_source: self-detected      # optional: self-detected | da-dismissed | validation-fail | cascade | human
confidence: high
confidence_notes: "<required если confidence != high>"
created: <today>
updated: <today>
version: 1
---
```

**Anti-pattern warnings (НЕ использовать эти имена полей):**
- ❌ `confidence_rationale`, `rationale`, `reasoning` → canonical: `confidence_notes` (caused PS drift, DEC-DEV-0011)
- ❌ `fix`, `fix_applied`, `fixed`, `resolution`, `is_fixed` → canonical: `fix_ref`
- ❌ `prevention`, `mitigation`, `takeaway`, `guardrail`, `lesson` → canonical: `guard`
- ❌ `cause`, `why`, `root_cause` как ключ frontmatter → root cause живёт в **теле** (`## Root cause`), не во frontmatter
- ❌ `related`, `links` → canonical: `applies_to`
- ❌ `state`, `lifecycle` → canonical: `status`
- ❌ пропустить frontmatter «потому что spec и так описывает» → explicit template **обязателен**

**Filename / slug rule:** `.product/lessons/LESSON-<NNN>-<slug>.md`. Slug — первые 3-5 значимых слов `title`, lowercased, hyphenated, **ASCII-only** (кириллица — транслит ГОСТ 7.79-2000 System B), max 50 chars (per [`docs/pmo/artifacts/README.md`](../../docs/pmo/artifacts/README.md) Slug rule).

## Anti-patterns

1. **Record without fix.** `open` без применённого фикса как «запишу, починю позже» — это инверс назначения. Нет фикса → `NOTE-*`/`.pending`.
2. **Active before verify.** Не флипать в `active` без recorded verification evidence в `## Fix applied`.
3. **Queue to `.pending/`.** LESSON не кладётся в отложенную очередь — это её прямая противоположность.
4. **Defer «later».** Mandate: `/product:lesson` до другой работы, не после «доделаю текущее».
5. **Rename canonical fields.** Use explicit template, не «по spec'у».
6. **Leave `status: open`.** Незакрытый урок блокирует чистое закрытие сессии by design.
7. **`--withdraw` a landed fix.** Применённый фикс — не false alarm; завершай через `--resume`.

## Examples

См. [`docs/pmo/artifacts/LESSON.md`](../../docs/pmo/artifacts/LESSON.md) § Examples — good `active` урок (open→active через применённый фикс) и anti-example (open без фикса = NOTE).

## Related

- [`commands/product/lesson.md`](../../commands/product/lesson.md) — invoking command
- [`docs/pmo/artifacts/LESSON.md`](../../docs/pmo/artifacts/LESSON.md) — LESSON artifact spec
- [`docs/pmo/validation.md`](../../docs/pmo/validation.md) — V-LE-01..05
- [`skills/ecosystem/self-correction.md`](../ecosystem/self-correction.md) — non-deferrable mandate (synced surface)
- [`docs/pmo/artifacts/NOTE.md`](../../docs/pmo/artifacts/NOTE.md) — куда писать «потом» (НЕ LESSON)
