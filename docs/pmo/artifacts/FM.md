# FM-* — Feature Map Entry

> **Тип:** feature-map-entry
> **Домен:** D1↔D2 (мост)
> **Review:** 🟠 Strategic
> **Cardinality:** Per feature (обычно 10–30 active FM в MVP/MMP)
> **Владелец:** Product Module / процесс P1 Planning (создание skeleton) + P2 Feature Definition (обогащение)

## Purpose

**Главный связующий артефакт экосистемы.** FM — это «оглавление системы», где стратегия (SEG, JTBD, HYP, VP) связывается с поведением (SC, BR, LC, VC). FM рождается в D1 как skeleton (почему) и обогащается в D2 до полноценной спецификации (как ведёт себя). **Единственная единица передачи через INT-11 handoff** во внешний конвейер.

## Frontmatter Schema

```yaml
---
id: FM-<NNN>
type: feature-map-entry
title: "Короткое имя фичи"
status: planned | in-progress | shipped | deprecated
priority: must | should | could | wont
segment: SEG-<NNN>                    # первичный сегмент
jtbd: [JTBD-N-from-SEG, ...]          # какие JTBD решает (из SEG body)
hypotheses: [HYP-<NNN>, ...]          # какие гипотезы проверяет
value_proposition: VP-<NNN>
release: RL-<NNN>                      # в каком релизе планируется/выпущена
has_ui: true | false                   # активирует Design Module (D2-05)
scenarios: [SC-<NNN>, ...]             # поведенческая спецификация (D2)
rules: [BR-<NNN>, ...]
lifecycles: [LC-<NNN>, ...]
verification: [VC-<NNN>, ...]
invariants: [IC-<NNN>, ...]
mockups: [MK-<NNN>, ...]               # только если has_ui=true
success_metric: "string"               # метрика успеха именно этой фичи

# NFR Review status (opt-in, per FM)
nfr_status: pending | active | declined   # default pending при создании FM
nfr: [NFR-<NNN>, ...]                     # пусто если status != active
nfr_reviewed_at: YYYY-MM-DD               # дата проведения F.5a
nfr_decline_reason: "string"              # если status=declined, optional
requires_nfr: true | false                # high-risk indicator (defaults false)

confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

### Phase 1: Skeleton (в D1.6, при создании MVP scope)

Обязательные секции skeleton:

1. **Why.** Какую JTBD решает, какую гипотезу проверяет, какая ценность для SEG.
2. **What (brief).** 2–3 предложения про то, что делает фича. Без SC-деталей.
3. **Priority rationale.** Почему этот priority (MUST/SHOULD/COULD/WON'T).
4. **Success metric.** Измеримый результат именно этой фичи (отличается от HYP success threshold).

### Phase 2: Enriched (в D2.2, при /product:feature)

Добавляются секции:

5. **Scenarios overview.** Список SC-* с кратким описанием каждого.
6. **Business rules overview.** Список BR-* с краткими формулировками.
7. **Entity lifecycles touched.** Какие LC затрагиваются.
8. **Verification overview.** Список VC-* и критерий полноты покрытия.
9. **Invariants touched.** Какие IC применяются.
10. **UI overview** (если has_ui=true). Список MK-* (Design Package references).
11. **NFR summary** (когда артефакт NFR будет введён).
12. **Dependencies on other features.** Какие FM должны быть shipped раньше.

Опциональные:

- **Rollout notes** (поэтапное включение, feature flags)
- **Deprecation plan** (для фич, которые мы знаем, что заменим)

## Content Rules

- **Skeleton создаётся в D1.** FM не рождается в D2; её предпосылки лежат в стратегическом слое.
- **Обогащение в D2 через /product:feature.** Команда добавляет SC/BR/LC/VC/MK/RPM и обновляет frontmatter.
- **`has_ui` определяется в skeleton.** Решение «есть UI или нет» — ранее, не в D2.
- **Priority — из MVP или RM.** Не произвольный.
- **Success metric конкретной фичи ≠ HYP target_value.** Фича имеет свою метрику (активация, conversion funnel step).

### Handoff-готовность

FM готова для передачи в handoff (через `/product:handoff`), когда:
- status = `in-progress` (scope зафиксирован)
- Все связанные SC — status = `active`
- Все связанные BR — status = `active`
- Для каждого SC есть хотя бы один VC
- BG содержит все термины из SC/BR
- Если `has_ui=true` — хотя бы один MK в `active`

Детальные блокирующие и предупредительные условия — в `product-module/handoff-spec.md` (в разработке).

## Relationships

**Входящие:**
- ← SEG-* (primary segment)
- ← JTBD (задачи, которые решает)
- ← HYP-* (гипотезы, проверяемые через эту фичу)
- ← VP-* (ценность, которую реализует)
- ← RL-* (в каком релизе; обновляется при перемещении между RL)
- ← MVP (priority из MoSCoW)

**Исходящие (D2-Behavioral):**
- → SC-* (поведенческие сценарии фичи)
- → BR-* (правила, используемые фичей)
- → LC-* (жизненные циклы сущностей фичи)
- → VC-* (критерии верификации)
- → IC-* (инварианты, применимые к фиче)
- → RPM (роли + разрешения — FM обновляет глобальную RPM)
- → MK-* (если has_ui)

**Исходящие (handoff):**
- → `.product/handoffs/FM-<NNN>-handoff.md` — универсальный пакет
- → Внешний implementation-инструмент (через Integrator)

**Cascade impact:**
- FM status = `shipped` → следит Integrator, что реализация соответствует handoff'у
- Изменение связанной SC/BR → FM status = `requires_review`, ассистент инициирует re-verification
- FM `deprecated` → все связанные SC/BR проверяются на использование в других FM

## Review Level: 🟠 Strategic

FM — критичное решение о том, **что строится**. Ассистент предлагает draft через диалог, человек approves по факту бизнес-обоснования. Phase 2 enrichment — approve per-секция (SC approved, BR approved, etc.).

## Lifecycle States

```
planned ──(start D2 enrichment)──▶ in-progress ──(handoff & implementation)──▶ shipped
   │                                    │
   │                                    └──(handoff incomplete)──▶ in-progress (блок)
   │
   └──(cancelled before work)──▶ deprecated
```

- **planned** — skeleton создан в D1.6, обогащение не начато
- **in-progress** — хотя бы одна SC/BR создана; активно работаем с фичей
- **shipped** — реализация завершена внешним инструментом, в production
- **deprecated** — выпиливается; сохраняется для истории

## Examples

**Good (фрагмент, in-progress):**
```yaml
---
id: FM-003
type: feature-map-entry
title: "Revisions inbox"
status: in-progress
priority: must
segment: SEG-001
jtbd: [JTBD-1]
hypotheses: [HYP-001]
value_proposition: VP-001
release: RL-001
has_ui: true
scenarios: [SC-005, SC-006, SC-007]
rules: [BR-010, BR-011, BR-012]
lifecycles: [LC-002]                       # Revision lifecycle
verification: [VC-005, VC-006, VC-007]
invariants: [IC-003]
mockups: [MK-003]
success_metric: "90% пользователей обрабатывают revision-batch за <15 мин"
---

## Why
Решает primary JTBD-1 сегмента SEG-001 (сбор правок от нескольких клиентов).
Проверяет ключевую HYP-001 (готовность платить за централизацию).
Без этой фичи VP-001 не выполняется — это core value.

## What (brief)
Единый inbox для всех правок от всех клиентов с привязкой к
конкретному месту в документе. Мульти-канальный ввод (email,
Telegram bot, manual paste) с auto-grouping по проектам.

## Priority rationale
MUST: HYP-001 не валидируется без этой фичи. Это differentiation.

## Success metric
90% пользователей обрабатывают batch правок за <15 минут (сейчас 2-3 часа).

## Scenarios overview
- SC-005: Получение правки через email → automatic linking к проекту
- SC-006: Manual ввод правки с контекстом
- SC-007: Обработка batch из 5+ правок последовательно

## Business rules overview
- BR-010: Revision привязывается к project по sender email
- BR-011: Невалидные правки (без контекста) идут в review-pool
- BR-012: Batch-группировка по времени прихода (окно 2 часа)

## Entity lifecycles touched
- LC-002: Revision (incoming → reviewed → processed → archived)

## Verification overview
Покрыты happy path (SC-005), manual alt (SC-006), batch edge (SC-007).

## Invariants touched
- IC-003: Ни одна revision не может быть потеряна (от incoming до processed/rejected)

## UI overview
- MK-003: Revisions inbox screen (см. Design Package)

## Dependencies on other features
- Требует FM-001 (Dashboard) — inbox интегрирован в dashboard view
- Требует FM-005 (Authentication) — для привязки email к user account

## Rollout notes
Фича включается для всех пользователей сразу (part of MVP v1).
Email интеграция — opt-in (настройка в user settings).
```

**Anti-example (skeleton без связей):**
```yaml
id: FM-003
title: "Revisions inbox"
priority: must
# ничего более                                    ❌ skeleton без JTBD/HYP — бесполезен
```

## Common Mistakes

1. **FM как task description.** FM — это «что за фича», не «как её кодить». Детали реализации — зона handoff и внешнего инструмента.
2. **FM без связи с HYP.** «Просто нужна» — не обоснование MUST priority.
3. **Слишком много SC в одной FM.** Если >10 SC — фича слишком большая, разделить.
4. **Handoff до обогащения.** Нельзя отправить в разработку planned FM без SC/BR/VC.
5. **Изменение has_ui после enrichment.** has_ui определяется в skeleton и меняется только при существенном pivot.

## Related Skills

- `feature-skeleton-creation.md` (в разработке, D1.6)
- `feature-enrichment-session.md` (в разработке, D2)
- `feature-handoff-validation.md` (в разработке)
