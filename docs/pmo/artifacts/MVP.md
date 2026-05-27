# MVP — MVP Scope

> **Тип:** mvp-scope
> **Домен:** D1 — Product Discovery & Planning
> **Review:** 🟠 Strategic
> **Cardinality:** Singleton
> **Владелец:** Product Module / процесс P1 Planning, шаг D1.6

## Purpose

**Минимальный набор фич** для проверки главной гипотезы продукта. Определяет, что входит в первую версию, что откладывается и что сознательно **не делается**. Основание для RM, RL, FM priorities.

## Frontmatter Schema

```yaml
---
id: MVP                             # Фиксированный
type: mvp-scope
title: "MVP v1 — <короткое описание>"
status: draft | active | achieved | evolved
primary_hypothesis: HYP-<NNN>       # главная HYP, которую валидирует MVP
target_launch: YYYY-MM-DD           # целевая дата релиза MVP
achieved_on: YYYY-MM-DD              # заполняется при переходе в achieved
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Primary hypothesis.** HYP, которую валидирует MVP. Одна основная.
2. **Success definition.** Что значит «MVP достиг цели». Привязано к target_value primary HYP.
3. **Scope — MUST have.** Фичи обязательные для валидации primary HYP.
4. **Scope — SHOULD have.** Важные, но не блокирующие валидацию.
5. **Scope — COULD have.** Если останется время.
6. **Scope — WON'T have (для MVP).** Явно отложенные фичи с причиной.
7. **Non-goals.** Что MVP сознательно не делает (важно для избежания scope creep).
8. **Risks.** Топ-3 риска не достичь цели MVP.

Опциональные:

- **Assumptions** (на чём строится scope)
- **Rollout plan** (как запускаем — invite only, public beta и т.д.)

## Content Rules

- **Одна primary HYP.** Не пять. Если валидируем пять гипотез одновременно — размытие, никакую не валидируем надёжно.
- **MoSCoW с дисциплиной.** MUST — <10 фич. Иначе это не MVP.
- **WON'T HAVE обязателен.** Без явного списка отложенного scope всегда раздувается.
- **Нет implementation-деталей.** «Реализовать на React» — не часть MVP scope.
- **Связь с HYP явная.** Для каждой MUST фичи — объяснение, как она помогает валидировать primary HYP.

## Relationships

**Входящие:**
- ← HYP-* (primary HYP определяет, зачем MVP)
- ← VP-* (VP primary segment'а — что обещаем в MVP)
- ← FM-* (фичи, которые есть в scope)

**Исходящие:**
- → RM (MVP — первая фаза роадмапа)
- → RL-001 (обычно MVP = RL-001)
- → FM-* (установка priority на MUST/SHOULD/COULD/WON'T)

**Cascade impact:**
- Добавление новой фичи в MUST → пересчёт target_launch
- Смена primary HYP → пересмотр всего scope
- `invalidated` primary HYP → MVP → `evolved` (эволюция к pivot или к новой версии)

## Review Level: 🟠 Strategic

Финальное решение о scope — всегда человек. Ассистент предлагает, но приоритеты MUST/SHOULD/COULD — стратегический выбор.

## Lifecycle States

```
draft ──(approve)──▶ active ──(primary HYP validated)──▶ achieved
                       │                                    │
                       │                                    └──▶ evolved (к MMP)
                       │
                       └──(primary HYP invalidated)──▶ evolved (pivot)
```

- **draft** — формируется
- **active** — единственный MVP в работе
- **achieved** — primary HYP validated, MVP цель достигнута
- **evolved** — MVP эволюционировал в следующую фазу (MMP), либо был pivoted

**Важно:** в каждый момент времени может быть только один активный MVP. После `achieved` создаётся следующая версия (MVP v2) для следующей фазы продукта.

## Examples

**Good (фрагмент):**
```yaml
---
id: MVP
title: "MVP v1 — проверка готовности фрилансеров платить"
status: active
primary_hypothesis: HYP-001
target_launch: 2026-07-15
---

## Primary hypothesis
HYP-001: Фрилансеры-переводчики (SEG-001) готовы платить $15-25/мес
за централизацию правок от клиентов.

## Success definition
>= 10% конверсия freelance → paid за 3 месяца после запуска paywall.

## MUST have
1. **FM-001: Dashboard проектов** — видимость всех активных проектов
   Необходимо: без этого переводчик не видит value централизации
2. **FM-003: Revisions inbox** — сбор правок от клиентов в одном месте
   Необходимо: core value proposition
3. **FM-004: Client export** — отдать клиенту финальный документ
   Необходимо: закрывает workflow, иначе продукт не решает JTBD-1
4. **FM-005: Authentication** — регистрация, логин
   Необходимо: базовая инфраструктура

## SHOULD have
5. **FM-002: Project templates** — быстрый старт типового перевода
   Важно, но можно без него

## COULD have
6. **FM-006: Glossary sync** — единый glossary между проектами
   Нравится, но не блокирует валидацию HYP-001

## WON'T have (для MVP)
- Team features (JTBD не про команды)
- Advanced analytics (не помогают валидации HYP-001)
- AI-переводчик встроенный (substitute, отвлекает от differentiation)
- Mobile app (web-first достаточно)

## Non-goals
- Не целимся в agency-рынок (SEG-002, exploratory)
- Не строим marketplace переводчиков (другая бизнес-модель)

## Risks
1. Конверсия <3% (invalidation) — тогда pivot на другую бизнес-модель
2. FM-003 UX сложный для ручных правок — mitigation: usability тесты на 5 пользователях до запуска
3. Платёжный провайдер (Stripe) может отказать по geo — backup: ЮKassa
```

**Anti-example:**
```
## MUST have
1. Feature A, 2. B, 3. C, ... (всё 30 фич)     ❌ не MVP, а v2
## WON'T have — отсутствует                       ❌ scope creep неизбежен
## Primary hypothesis: "Успех"                   ❌ размыто, нет связи с HYP-*
```

## Common Mistakes

1. **Всё MUST have.** Нет приоритизации — нет MVP.
2. **MVP без HYP.** Если неясно, что валидируем — строим «по ощущениям».
3. **Scope creep через SHOULD → MUST.** Дисциплина: SHOULD остаётся SHOULD.
4. **Нет WON'T have.** Все отложенные фичи «возможно потом» = всегда в работе.
5. **MVP = v1.0.** MVP — не первая версия продукта, а минимальный эксперимент.

## Related Skills

- [`mvp-scoping.md`](../../../skills/product/mvp-scoping.md)
- `moscow-prioritization.md` (planned)
