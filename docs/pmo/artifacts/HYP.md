# HYP-* — Hypothesis

> **Тип:** hypothesis
> **Домен:** D1 — Product Discovery & Strategy
> **Review:** 🟠 Strategic
> **Cardinality:** 3–5 на продукт (MVP), до 10+ в зрелом продукте
> **Владелец:** Product Module / процесс P1 Discovery, шаг D1.5

## Purpose

**Проверяемые предположения**, на которых строится стратегия продукта. Каждая HYP связывает предположение о поведении сегмента с **измеримой метрикой** и **порогом успеха**. Главный механизм управления рисками в Lean Startup-подходе.

## Frontmatter Schema

```yaml
---
id: HYP-<NNN>
type: hypothesis
title: "Короткая формулировка гипотезы"
status: draft | testing | validated | invalidated | deferred
segment: SEG-<NNN>                   # кого касается
value_proposition: VP-<NNN>          # какой VP проверяет (опционально)
features: [FM-<NNN>, FM-<NNN>]       # через какие фичи валидируется
validation_metric: "string"          # имя метрики
target_value: "string"               # порог успеха (> X%, < Y min)
invalidation_threshold: "string"     # порог провала (чёткая граница!)
testing_period: "string"             # длительность валидации (1 мес, 3 мес)
testing_started: YYYY-MM-DD          # дата старта testing
priority: critical | important | exploratory
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Hypothesis statement.** Формат: «Мы верим, что **[сегмент]** будет **[действие]**, потому что **[причина из JTBD/VP]**».
2. **Success metric.** Что именно измеряем. Почему эта метрика.
3. **Success threshold.** Числовое значение, при достижении которого HYP `validated`.
4. **Invalidation threshold.** Значение, ниже которого HYP `invalidated`. Должен быть явно отличен от success.
5. **Testing approach.** Как именно проверяем (через какие фичи, с какой аудиторией, какое время).
6. **Expected learnings.** Что узнаем, независимо от исхода.
7. **Dependencies.** Какие другие HYP/FM должны быть готовы для валидации этой.

Опциональные:

- **Alternative explanations** (если метрика дрогнет — что ещё может объяснять)
- **Secondary metrics** (сопутствующие метрики для триангуляции)

## Content Rules

- **Hypothesis, не wish.** «Пользователям понравится» — не гипотеза. «≥40% пользователей завершат 1-й проект в течение 7 дней» — гипотеза.
- **Measurable.** Без конкретной метрики и числа — это wish.
- **Falsifiable.** Должна быть возможность увидеть «провалилась». «Продукт будет успешен» — не фальсифицируемо.
- **Bounded testing period.** Бесконечная проверка = никогда не валидируется.
- **Success ≠ invalidation inverse.** Оставляй middle ground («inconclusive») — между 40% и 25% может быть зона, где нужно продлить тестирование.

### Критерии качественной HYP (H.A.R.M.E.D.)

- **H**ypothesis — формулировка предположения
- **A**udience — какой сегмент
- **R**esult — что ожидаем увидеть
- **M**etric — чем измеряем
- **E**xpiration — когда делаем вывод
- **D**ecision — что делаем при каждом исходе

## Relationships

**Входящие:**
- ← SEG-{NNN} (про кого гипотеза)
- ← VP-{NNN} (какое ценностное предложение проверяет)
- ← MR, CA (обоснование предположения)

**Исходящие:**
- → FM-* (фичи, через которые валидируется)
- → MVP (MVP состоит из фич, закрывающих primary HYP)
- → RL-* (релиз должен закрывать одну или более HYP)

**Cascade impact:**
- `validated` → фичи, реализующие HYP, остаются в roadmap, возможно расширение
- `invalidated` → связанные фичи требуют пересмотра, возможен pivot PS/VP
- `deferred` → фича откладывается, но артефакты остаются

## Review Level: 🟠 Strategic

Метрики и пороги — **бизнес-решение**. Ассистент может предлагать, но числа утверждает человек (они определяют, что мы считаем успехом).

## Lifecycle States

```
draft ──(G5 approve)──▶ testing ──┬──▶ validated
                          │       │
                          │       └──▶ invalidated (→ pivot?)
                          │
                          └──(testing_period ends, inconclusive)──▶ deferred
```

- **draft** — формулируется, не действует на FM
- **testing** — активно проверяется; FM-* могут приоритизироваться выше под эту HYP
- **validated** — подтверждена; FM остаются, возможно расширение фичатабельности
- **invalidated** — опровергнута; требует решения (удалить FM? pivot?)
- **deferred** — непонятно; продолжение проверки требует новых фич или time

## Examples

**Good:**
```yaml
---
id: HYP-001
title: "Фрилансеры готовы платить за централизацию правок"
status: testing
segment: SEG-001
value_proposition: VP-001
features: [FM-001, FM-003, FM-004]
validation_metric: "freelance-to-paid conversion"
target_value: ">= 10%"
invalidation_threshold: "< 3%"
testing_period: "3 months"
testing_started: 2026-05-15
priority: critical
---

## Hypothesis statement
Мы верим, что **фрилансеры-переводчики (SEG-001)** будут **платить $15-25/мес
за подписку на наш инструмент**, потому что **централизация правок
экономит им 2-3 часа в неделю** (подтверждено интервью с 5 фрилансерами).

## Success metric
Конверсия freelance → paid за 3 месяца после запуска платной подписки.

## Success threshold
>= 10% (при 1000 активных free пользователях → >= 100 платных)

## Invalidation threshold
< 3% (означает, что ценность недостаточна; freemium модель нежизнеспособна)

## Between 3% and 10%
`deferred` — потенциал есть, но требует дополнительного research:
что останавливает от оплаты, возможна корректировка цены.

## Testing approach
- Reliance на FM-001 (dashboard), FM-003 (revisions inbox), FM-004 (client export)
- Freemium: первые 10 проектов бесплатно, далее paywall
- Аудитория: 1000 активных пользователей (привлекаем через Telegram-каналы переводчиков)
- Измерение: Plausible analytics + Stripe dashboard

## Expected learnings
- Подтверждение/опровержение freemium → paid мотивации
- Топ-3 причины не платить (через exit survey)
- Оптимальная цена (через A/B)

## Dependencies
- FM-001, FM-003, FM-004 должны быть released
- Платёжный провайдер подключён (FM-NEED: payments)
```

**Anti-example:**
```
"Наш продукт будет успешен"                        ❌ не falsifiable
"Пользователям понравится UX"                      ❌ без метрики
"Конверсия будет высокой"                          ❌ без числа
"Если >5% пользователей зайдут — успех"            ❌ вход, не ценностное действие
"Валидировать когда-нибудь"                         ❌ без expiration
```

## Common Mistakes

1. **Вход = успех.** Зашёл на сайт ≠ получил ценность. Метрика должна быть действием, подтверждающим JTBD.
2. **Слишком мягкий invalidation threshold.** «Если <1% — провал» — при 1000 users это 10 людей, статистически шум.
3. **Куча гипотез одной фичей.** Одна FM может валидировать 1–2 HYP, не 5. Если больше — HYP слишком size.
4. **HYP без reality check.** «Пользователи будут платить $500/мес» — часто гипотеза про wish, не про реальность.
5. **Игнор inconclusive зоны.** Без `deferred` статуса всё превращается в false binary.

## Related Skills

- [`hypothesis-formulation.md`](../../../skills/product/hypothesis-formulation.md)
- `hypothesis-validation-protocol.md` (planned — execution + invalidation handling)
