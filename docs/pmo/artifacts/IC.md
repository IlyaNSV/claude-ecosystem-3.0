# IC-* — Invariant Check

> **Тип:** invariant-check
> **Домен:** D2 — Behavioral (мост в D4 Quality)
> **Review:** 🔴 Critical
> **Cardinality:** Per invariant (обычно 3–10 IC на продукт)
> **Владелец:** Product Module / процесс P2 (derived from BR + LC, но requires human approve as Critical)

## Purpose

**Утверждения, ВСЕГДА истинные** в системе — независимо от сценария, потока или состояния. Инварианты домена: абсолютные ограничения, нарушение которых означает **серьёзный баг** (data corruption, business logic violation). Критичны для integrity системы.

## Frontmatter Schema

```yaml
---
id: IC-<NNN>
type: invariant-check
title: "Короткая формулировка инварианта"
severity: critical | high | medium
entity: "EntityName"                   # на какую сущность (из BG)
rules: [BR-<NNN>, ...]                  # какие BR его поддерживают
lifecycles: [LC-<NNN>, ...]            # какие LC связаны
status: draft | active | deprecated
testable_as: unit | integration | runtime-monitor | design-time
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Invariant statement.** Формальная формулировка. Формат: «∀ [entity] : [predicate]».
2. **Severity rationale.** Почему такая severity: что ломается при нарушении.
3. **Supporting rules.** Какие BR должны соблюдаться для поддержания этого IC.
4. **Related lifecycles.** Какие LC должны уважать этот IC (transitions не должны нарушать).
5. **Detection method.** Как обнаружить нарушение (compile-time, runtime, periodic check).
6. **Recovery strategy.** Что делать если обнаружено нарушение (abort + alert, rollback, manual review).

Опциональные:

- **Known violations** (если есть известные edge cases, которые пока терпим — с expiry)
- **Related invariants** (если связаны)

## Content Rules

- **Формализм максимальный.** IC должен быть выразим как проверяемое утверждение. `∀ revision R : R.status ∈ LC-002.states`.
- **«Всегда» — не «часто».** IC описывает абсолютные ограничения. Если есть даже редкий случай нарушения — это не IC, а BR.
- **Не дублирует BR.** BR описывает процесс/правило (в рамках action). IC описывает глобальное свойство системы.
- **Независим от flow.** IC должен быть истинным после ЛЮБОГО SC (main, alt, error).
- **Entity scope явный.** Каждый IC привязан к одной сущности (или явно cross-entity).

### IC vs BR — различие

- **BR** — «при определённых условиях происходит X»
- **IC** — «независимо от условий, всегда верно что X»

Пример:
- BR-010: «ЕСЛИ email matches project THEN revision.project_id := project.id» (процесс)
- IC-003: «∀ revision R : R.status=='archived' ⇒ R был в ['processed', 'rejected'] до archive» (инвариант)

## Relationships

**Входящие:**
- ← BR-* (правила, поддерживающие инвариант)
- ← LC-* (state machine должна уважать инвариант)
- ← BG (сущность)

**Исходящие:**
- → Runtime monitoring (в будущем D5)
- → Unit-тесты инвариантов (через INT-12)
- → Handoff (передаётся как absolute constraint для external implementation)

**Cascade impact:**
- Добавление IC → проверить все LC (transitions не нарушают IC?), все BR (поддерживают?)
- Удаление IC → предупреждение (может быть критично, не удалять легко)
- Изменение BR → проверить, не нарушает ли поддержку связанных IC

## Review Level: 🔴 Critical

**Любое добавление/изменение/удаление IC** требует:
1. Человек определяет критерий — это реально абсолютное правило или просто «обычно»?
2. Product DA review обязателен
3. Impact analysis: как связанные BR/LC/SC обеспечивают соблюдение?
4. Decision journal запись с примерами нарушений, которые IC предотвращает

Почему Critical: IC — это то, на что полагается integrity системы. Неверно определённый IC → data corruption или false alarms.

## Lifecycle States

```
draft ──(DA review + approve)──▶ active ──(severe change)──▶ draft (с impact) ──▶ active v2
                                    │
                                    └──(rarely: entity deprecated)──▶ deprecated
```

IC редко deprecated — обычно только при удалении сущности целиком.

## Examples

**Good:**
```yaml
---
id: IC-003
type: invariant-check
title: "Revision не может быть потеряна от incoming до final state"
severity: critical
entity: Revision
rules: [BR-010, BR-011, BR-013, BR-020]
lifecycles: [LC-002]
status: active
testable_as: integration
---

## Invariant statement
∀ Revision R : R существует ⇒ R.status ∈ LC-002.states AND 
  ∃ traceable history of transitions от creation до current state.

Словами: каждая Revision должна иметь валидное состояние из LC-002 и 
audit trail всех переходов. Не может «пропасть» или оказаться в 
недокументированном состоянии.

## Severity rationale
**Critical**, потому что:
1. Потеря revision = потеря правки от клиента = потеря доверия freelancer'а к продукту
2. Это core value proposition (VP-001) — «не теряются правки». 
   Нарушение = дискредитация VP
3. Audit trail критичен для расследования disputes с клиентами

## Supporting rules

- **BR-010:** Ensures всегда создаётся project link (не orphan revision)
- **BR-011:** Auto-reject fallback вместо потери incoming без project
- **BR-013:** Apply только с valid state check (не теряется при apply)
- **BR-020:** Archive только после валидного pre-archive state

## Related lifecycles

- **LC-002:** All transitions должны уважать IC-003. Нет transition, 
  которое бы удаляло revision; только status updates + archive.

## Detection method

- **Compile-time:** Schema validation: revision.status NOT NULL, 
  status ∈ ENUM(states) от LC-002
- **Integration test:** После каждого SC тест проверяет 
  revision exists && status valid
- **Runtime monitor (future D5):** Periodic scan: any revisions without 
  valid history? Alert if found.

## Recovery strategy

При обнаружении нарушения:
1. **Alert freelancer immediately** (возможна потеря данных клиента)
2. **Abort current transaction** (не делать хуже)
3. **Log incident** с full context в audit log
4. **Manual review** — admin проверяет все recent revisions, 
   восстанавливает по email audit если возможно
5. **Post-incident:** обновить BR и тесты для предотвращения repeat

## Known violations (accepted)

(Таких нет. IC-003 — strict.)

## Related invariants

- **IC-004:** Revision.project_id always references existing project 
  (supporting invariant)
- **IC-005:** Revision timestamps monotonically increasing 
  (audit trail integrity)
```

**Anti-example:**
```yaml
---
id: IC-XXX
title: "Revisions обычно сохраняются"                 ❌ «обычно» — не IC
severity: medium                                       ❌ если medium — это BR или warning
---

## Statement
Правки важны и их нужно беречь                        ❌ не формально
```

## Common Mistakes

1. **IC = BR.** Путаница уровней. BR про процесс, IC про состояние всей системы.
2. **IC с исключениями.** Если «всегда кроме...» — не IC. Может быть два IC + BR для разных случаев.
3. **IC не testable.** IC должен быть проверяем, иначе это декларация, не инвариант.
4. **Слишком много IC.** 30+ IC на продукт — обычно путаница с BR. 5-10 действительно абсолютных правил достаточно.
5. **IC без recovery strategy.** Если IC нарушен — что делать? Без плана нарушение = паника.

## Related Skills

- `invariant-discovery.md` (в разработке)
- `ic-violation-handling.md` (в разработке)
