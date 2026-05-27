# MR — Market Research

> **Тип:** market-research
> **Домен:** D1 — Product Discovery & Strategy
> **Review:** 🟡 Standard
> **Cardinality:** Singleton (1 на продукт)
> **Владелец:** Product Module / процесс P1 Discovery, шаг D1.2

## Purpose

Аналитический отчёт о рынке: **размер** (TAM/SAM/SOM), **тренды**, **барьеры входа**, **регуляция**, **сегменты роста**. Даёт контекст для стратегических решений (MVP scope, positioning, release planning). Не определяет, **что** строить — это PS + VP. Определяет **почему рынок жизнеспособен**.

## Frontmatter Schema

```yaml
---
id: MR                              # Фиксированный
type: market-research
title: "Market research: <область>"
status: draft | active
research_date: YYYY-MM-DD           # когда проведено
refresh_by: YYYY-MM-DD              # когда рекомендуется обновить (по умолчанию +6 мес)
mode: quick | deep                  # режим research
sources_count: N                    # количество источников
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Executive summary.** 3–5 предложений: главное о рынке.
2. **Market size.** TAM (total addressable) / SAM (serviceable addressable) / SOM (serviceable obtainable). С оценками в цифрах и источниками. Допускается пометка `[оценочно]` когда данных мало.
3. **Trends.** 3–7 ключевых тенденций, которые меняют рынок.
4. **Barriers to entry.** Капитальные, регуляторные, технологические, поведенческие.
5. **Growth segments.** Где рынок растёт быстрее всего (по аудитории, географии, use case).
6. **Regulation.** Юридические и compliance-ограничения релевантные продукту.
7. **Sources.** Список источников с URL, датой, credibility score (0–100) в Deep mode.

Опциональные:

- **Economic indicators** (для B2B), **cultural factors** (для consumer).

## Content Rules

- **Каждое числовое утверждение имеет источник** либо помечено `[оценочно]`.
- **Не менее 3 независимых источников** на ключевые утверждения (Deep mode).
- **Даты свежести источников** — источники старше 18 мес помечаются `[устаревшее]`.
- **Противоречия явно обозначены.** Если два источника дают разные цифры — обе приведены с указанием расхождения.
- **Без рекламы.** Не публицистический тон, не содержит выводов вида «огромный потенциал».

### Quick mode vs Deep mode

**Quick (30–60 мин):**
- 5–8 поисковых запросов
- 3–5 скрейпов главных источников
- Без credibility scores
- Допустимо больше `[оценочно]` пометок

**Deep (2–4 часа):**
- 15–30 поисковых запросов через Brave + Exa
- 8-фазный pipeline (scope → plan → retrieve → triangulate → synthesize → critique → refine → package)
- Credibility scores для каждого утверждения
- Cross-validation между источниками

## Relationships

**Входящие:**
- ← PS (определяет область исследования)

**Исходящие:**
- → CA (понимание конкурентного ландшафта)
- → SEG-* (размеры и характеристики сегментов)
- → HYP-* (обоснование гипотез рыночными данными)
- → MVP (границы минимального продукта под SOM)
- → RM (horizon и scale дорожной карты)

**Cascade impact при изменении:** если данные противоречат существующим SEG/VP/HYP — эти артефакты помечаются `requires_review`, запускается обсуждение через процесс P3 (v2, пока manual).

## Review Level: 🟡 Standard

Ассистент ведёт исследование (research-heavy, инструмент-зависимо). Человек валидирует выводы и соответствие реальности. Ошибки в MR не ломают downstream автоматически — они искажают решения, которые принимаются на их основе.

## Lifecycle States

```
draft ──(G2 approve)──▶ active ──(refresh_by passed)──▶ active (с warning)
                                                ──(manual refresh)──▶ draft ──▶ active v2
```

- **active** остаётся до `refresh_by`. После — появляется warning в /product:status.
- При ручном refresh — создаётся **новая версия** (version++), старая помечается `archived: previous_version`.

## Examples

**Good (фрагмент):**
```yaml
---
id: MR
title: "Market research: русскоязычный рынок переводческих услуг для фрилансеров"
status: active
research_date: 2026-05-02
refresh_by: 2026-11-02
mode: deep
sources_count: 14
---

## Executive summary
Русскоязычный сегмент фриланс-перевода — TAM ~$180M/год, SAM ~$45M,
SOM реально достижимый для нишевого SaaS ~$3-5M за 3 года.
Ключевой тренд: конкуренция с ИИ-переводом вытесняет фрилансеров
в нишу «human touch».

## Market size
- TAM: $180M/год [Common Sense Advisory 2025, credibility 85]
- SAM: $45M (фрилансеры vs агентства, русскоязычные)
  [оценочно на основе данных Upwork/Fl.ru, credibility 60]
- SOM: $3-5M [расчёт: 2% проникновения за 3 года]
...
```

**Anti-example:**
```
## Market size
TAM огромен, рынок растёт.                                ❌ без цифр
TAM: $180M (из статьи в Forbes)                            ❌ без даты и ссылки
TAM: $500B (global translation industry)                    ❌ нерелевантный scope
```

## Common Mistakes

1. **Смешение TAM/SAM/SOM.** TAM — теоретический максимум рынка, SAM — что мы технически можем обслужить, SOM — что мы реально захватим.
2. **Глобальные данные в локальном контексте.** $500B мировой рынок не значит, что нам доступен.
3. **Старые источники.** Данные 2022 года в быстро меняющемся рынке — почти бесполезны.
4. **Нет триангуляции.** Один источник = одна цифра не проверяется.
5. **Forecasting вместо research.** «Рынок будет расти на 30%» — это предположение, не факт.

## Related Skills

- [`market-research-protocol-quick.md`](../../../skills/product/market-research-protocol-quick.md) — Quick mode
- `deep-research-8-phase.md` (deferred to v1.1+ — Deep mode subagents, см. [`dev/v1_1_backlog.md`](../../../dev/v1_1_backlog.md))
