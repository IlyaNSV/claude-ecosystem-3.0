# CA — Competitive Analysis

> **Тип:** competitive-analysis
> **Домен:** D1 — Product Discovery & Strategy
> **Review:** 🟡 Standard
> **Cardinality:** Singleton (1 на продукт)
> **Владелец:** Product Module / процесс P1 Discovery, шаг D1.3

## Purpose

Карта конкурентов: **кто**, **что предлагает**, **в чём силён/слаб**, **какое позиционирование** свободно. Основание для дифференциации в VP-* и формулировки уникального value prop. Определяет не «что строить», а «как выделиться».

## Frontmatter Schema

```yaml
---
id: CA                              # Фиксированный
type: competitive-analysis
title: "Competitive analysis: <область>"
status: draft | active
research_date: YYYY-MM-DD
refresh_by: YYYY-MM-DD              # по умолчанию +3 мес (конкуренты меняются быстрее MR)
competitors: [name1, name2, ...]    # список в порядке значимости
mode: quick | deep
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Executive summary.** 3–5 предложений: главное о конкурентной среде.
2. **Competitors list.** Имя, URL, категория (direct / indirect / substitute), год запуска, оценка доли рынка.
3. **Feature matrix.** Таблица: фича × конкурент. Отмечает ✓ / ✗ / partial. 15–30 ключевых фич.
4. **Pricing comparison.** Модель монетизации каждого (subscription / freemium / one-time), ценовые категории.
5. **Positioning map.** 2–4 ключевых атрибута (например: ease-of-use × depth / generalist × specialist). Каждый конкурент размещён.
6. **Strengths & weaknesses.** Для каждого конкурента: 2–3 сильные стороны, 2–3 слабые, ключевой инсайт.
7. **Market gaps.** Что никто не закрывает хорошо — возможности для дифференциации.
8. **Our positioning proposal.** Где мы будем в positioning map и почему.

Опциональные:

- **Recent funding & traction** (для ощущения темпа).
- **Tech stack if public** (для understanding ограничений).

## Content Rules

- **Минимум 5 конкурентов для direct categoried.** Если меньше — либо рынок niche и нужно расширить до substitutes, либо плохо искали.
- **Каждая оценка привязана к наблюдению.** «Хорошая UX» — плохо. «Меньше кликов до результата, проверено на demo» — ок.
- **Конкурент ≠ враг.** Нельзя описывать только слабости. Ищем, что они делают лучше нас.
- **Дата проверки для каждого конкурента.** Фичи устаревают — отмечаем когда смотрели.
- **Отдельно direct / indirect / substitute.** Не сваливать в одну кучу.

## Relationships

**Входящие:**
- ← PS (определяет, кого считать конкурентом)
- ← MR (контекст рынка, в каком сегменте мы боремся)

**Исходящие:**
- → VP-* (дифференциация строится на gaps из CA)
- → HYP-* (гипотезы вида «наш VP будет работать, потому что конкуренты не закрывают X»)
- → FM-* (feature priorities могут проверяться против CA feature matrix)

**Cascade impact при изменении:** появление нового конкурента с сильным VP — флаг на пересмотр наших VP-* и HYP-*.

## Review Level: 🟡 Standard

Ассистент делает research-heavy работу. Человек валидирует: полон ли список, корректен ли positioning, реалистична ли наша позиция.

## Lifecycle States

Аналогично MR: `draft → active → (refresh_by passed) → warning → manual refresh → new version`. Рекомендуемый refresh чаще, чем MR — раз в 3 месяца, т.к. конкуренты активно меняют фичи.

## Examples

**Good (фрагмент feature matrix):**

```markdown
## Feature Matrix

| Feature                       | Smartcat | Trados | Matecat | Our (target) |
|-------------------------------|----------|--------|---------|--------------|
| TM (translation memory)       | ✓        | ✓      | ✓       | ✓            |
| Glossary management           | ✓        | ✓      | partial | ✓            |
| Client feedback workflow      | partial  | ✗      | ✗       | ✓ (дифф)     |
| AI-assisted review            | ✓        | partial| ✓       | ✓            |
| Freelancer-focused pricing    | ✗        | ✗      | ✓       | ✓            |
| Human-in-loop for edits       | ✗        | ✗      | ✗       | ✓ (дифф)     |
```

**Positioning map example:**
```
        Collaboration depth
              ▲
         high │    Smartcat ●
              │
              │          ● OUR PRODUCT
              │
         low  │  Matecat ●       ● Trados
              └─────────────────────────▶
             solo          agency-scale
```

**Anti-example:**
```
Конкуренты: "Google Translate и ChatGPT" — ❌ substitutes, не конкуренты (разные categories)
"Smartcat лучше всех" — ❌ без attribute, бесполезно
"У нас будет всё то же, но лучше" — ❌ нет дифференциации
```

## Common Mistakes

1. **Путаница direct vs substitute.** Google Translate — substitute для перевода, но не direct конкурент для платформы управления переводами.
2. **Отсутствие positioning.** Феатур-матрица сама по себе ничего не говорит о позиционировании.
3. **Игнор дешёвого сегмента.** «Бесплатные альтернативы — не конкуренты» — опасное заблуждение.
4. **Неглубокий анализ.** 3 конкурента и 5 фич — не анализ.
5. **Фича-паритет вместо дифференциации.** Цель не «догнать», а «отличаться».

## Related Skills

- `competitive-analysis-protocol.md` (в разработке)
- `positioning-map-builder.md` (в разработке)
