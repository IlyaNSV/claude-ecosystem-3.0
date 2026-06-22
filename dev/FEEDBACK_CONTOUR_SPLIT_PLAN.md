# Feedback Contour Split — Plan (DEC-DEV-0090)

> **Статус:** proposal зафиксирован 2026-06-22; патч v1 в работе. 0089 зарезервирован
> за PA-дедупом (находка live-run, ещё не записана) → эта работа берёт **0090**.
>
> **Триггер:** имя `/product:meta-feedback` обещает upstream-фидбэк (в репозиторий
> экосистемы), а делает локальную подстройку валидации. Owner: «название неудачное,
> и мне нужен настоящий upstream». Разговор-исследование 2026-06-22.

## Проблема

Одна команда (`/product:meta-feedback`) семантически склеивает **две разные задачи**,
а имя обещает **третью**:
- *делает* — локальную подстройку правил валидации под проект (пишет в локальный `validation-config.yaml`);
- *имя обещает* — фидбэк наверх, в дизайн самой экосистемы;
- *путается* — с Orchestrator `FEEDBACK-JOURNAL.md` (тоже «feedback», но это outbox находок dogfood-прогонов).

Upstream-канал частично уже существует, но фрагментирован и не называется feedback:
`FEEDBACK-JOURNAL.md` (ручной перенос в DEC-DEV), Session Audit v2 (локально читает
транскрипты+git пилота → patch-candidates), ручная реконсиляция (DEC-DEV-0065).

## Решения (3 развилки — owner одобрил рекомендации 2026-06-22)

1. **Имя локального контура** → `/product:validation-tune`.
2. **Вариант интеграции upstream** → **гибрид**: захват = git-артефакт в пилоте; перенос
   читает либо локальные файлы (co-located, как Session Audit), либо git (удалённый/Ubuntu-пилот).
3. **Объём v1** → канал + переименование. Консолидация `FEEDBACK-JOURNAL` + Session Audit
   под единый контракт находки = **фаза 2** (меньше риска, быстрее доставка).

## Модель: два контура + мост

| | **Локальный тюнинг** (downstream) | **Upstream-эскалация** |
|---|---|---|
| Вопрос | «правило шумит **для этого проекта**» | «правило/процесс дефектны **в дизайне экосистемы**» |
| Команда | `/product:validation-tune` | `/ecosystem:meta-feedback` |
| Скоуп эффекта | один проект | все потребители экосистемы |
| Пишет в | `.claude/integrator/validation-config.yaml` | `.product/.upstream/feedback-outbox.md` (git-committed) |
| Очередь | `.product/.pending/validation-tune.yaml` | (часть outbox) |
| Журнал решений | `DEC-TUNE-*` | `UF-NNN` items → `DEC-DEV-*` в экосистеме |

**Контуры не взаимоисключающие, а двухуровневые.** Находка классифицируется оракул-вопросом:

> «Если бы этот же артефакт лежал в **другом** проекте — правило сработало бы так же ложно?»
> **Да → системное** (эскалировать наверх). **Нет → проектное** (локальный override).

`validation-tune` делает первое; когда классифицирует находку как системную — **мост**
предлагает/вызывает `/ecosystem:meta-feedback`, чтобы записать её в upstream-outbox
(+ опционально временный локальный override до фикса в экосистеме).

## Upstream — гибрид-доставка (v1)

`/ecosystem:meta-feedback` доставляется в `.claude/` пилота и работает как **формирователь outbox**:
- собирает upstream-достойные находки (эскалации от `validation-tune` + помеченные FB-items);
- пишет их в **коммитируемый** `.product/.upstream/feedback-outbox.md` (форма: симптом →
  корневая причина → доказательство → предлагаемый фикс → статус — наследует стиль FEEDBACK-JOURNAL);
- **режим доставки (гибрид):**
  - **local / co-located** (дефолт): outbox лежит в дереве; приёмная сторона (Session Audit /
    reconciliation в репо экосистемы на той же машине) читает его напрямую — прецедент
    `audit-watch.js` (локальная модель, cloud-routines дисквалифицированы);
  - **remote** (`--push` / `--issue`): коммит+пуш outbox в git пилота и/или GitHub issue в репо
    экосистемы — для удалённого/Ubuntu-пилота. Требует `dangerouslyDisableSandbox` (port-443).

Приёмная **автоматизация** (единый контракт находки, авто-pickup, дедуп против DEC-DEV) — **фаза 2**.

## Патч-чеклист (репо экосистемы)

- [x] Proposal-док (этот файл) + DEC-DEV-0090 reserved
- [x] `commands/product/validation-tune.md` — создан (downstream, upstream-язык вычищен) + старый `meta-feedback.md` удалён
- [x] `skills/product/validation-tune.md` — создан (классификатор + мост) + старый удалён
- [x] `commands/ecosystem/meta-feedback.md` — создан (upstream outbox-формирователь, гибрид)
- [x] `skills/ecosystem/meta-feedback.md` — создан (upstream-методология)
- [x] `commands/ecosystem/verify.md` Step 4 + summary — ecosystem count `5 → 6` (+ meta-feedback)
- [x] Sweep ~16 живых ссылок (README/ROADMAP/product+integrator SPEC/pmo validation+processes/templates/integrator journal+map/product skills); обзорные `docs/MAP.md`/`status.md` — проверено, ссылок нет (N/A)
- [x] CHANGELOG `[Unreleased] ### Added` + DEV_JOURNAL DEC-DEV-0090
- [x] Count-sweep **не требуется** (артефакт-типы / validation-правила не меняются — меняются команды)
- [ ] **Доставка в пилот + миграция данных** — после live-run B/C (не загрязнять грейд)

## План миграции пилота (после live-run B/C — не загрязнять грейд)

1. **Доставка:** `/ecosystem:update`. Self-deletion баг исправлен (`38e560a`, mirror-namespace) →
   переименование доедет: `commands/product/meta-feedback.md` запурджится, появятся
   `validation-tune.md` + `commands/ecosystem/meta-feedback.md`.
2. **Миграция данных (soft, принцип 6):** `.product/.pending/meta-feedback.yaml` →
   `validation-tune.yaml` (absent == старое поведение 1:1; backfill — migration-промптом в CHANGELOG).
   `validation-config.yaml` не трогаем.
3. **Подключить пилотные FEEDBACK-JOURNAL** как источник upstream + проставить «ported»-статусы
   FB-001…018 (уже в DEC-DEV) — заодно закрывает фрагментацию FB-счётчика (прошлая находка).
4. **Тайминг:** строго после live-run прогонов B (P6) / C (nesting).

## Открытые на фазу 2

- Единый контракт находки (UF / FB / patch-candidate под одну схему).
- Авто-pickup outbox приёмной стороной + дедуп против существующих DEC-DEV.
- Консолидация Session Audit v2 ↔ этот канал (не дублировать механику чтения пилота).
