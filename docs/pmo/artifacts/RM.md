# RM — Product Roadmap

> **Тип:** roadmap
> **Домен:** D1 — Product Discovery & Planning
> **Review:** 🟡 Standard
> **Cardinality:** Singleton
> **Владелец:** Product Module / процесс P1 Planning, шаг D1.7

## Purpose

**Высокоуровневый план развития** продукта на 3–6 месяцев вперёд. Не детальный timeline, а направления и цели по релизам. Переопределяется по результатам валидации HYP и обратной связи из D5.

## Frontmatter Schema

```yaml
---
id: RM                              # Фиксированный
type: roadmap
title: "Product roadmap"
status: draft | active
horizon: "Q3-Q4 2026"               # горизонт планирования
last_reviewed: YYYY-MM-DD
next_review: YYYY-MM-DD             # по умолчанию +1 мес
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1                           # инкрементируется при каждом major review
---
```

## Body Structure

Обязательные секции:

1. **Current phase.** Идея | MVP | MMP | Growth | Mature. Определяет, какие процессы активны.
2. **Horizon goals.** 3–5 целей на весь горизонт (3-6 мес).
3. **Release sequence.** Упорядоченный список RL-* с назначением каждого.
4. **Validation cadence.** Какие HYP валидируются в какой период.
5. **Recent changes.** Что изменилось в roadmap с last_reviewed (для прозрачности).

Опциональные:

- **Dependencies & risks** (внешние)
- **Long-term vision** (за horizon — для контекста, без обязательств)

## Content Rules

- **Без дат внутри horizon.** Рамки RL-* — да, dates — нет. Даты живут в RL-*.
- **Каждый RL решает HYP или закрывает gap.** Нет «релиза ради релиза».
- **Направления, не фичи.** «Поддержка team-workflow» — направление. «Feature X, Y, Z» — выписка из FM, не roadmap.
- **3–5 горизонтальных целей.** Больше — размывание.
- **Явный phase.** Current phase определяет доступные процессы (Activation Matrix).

## Relationships

**Входящие:**
- ← MVP (первая фаза)
- ← HYP-* (roadmap валидирует гипотезы последовательно)
- ← VP-* (направления покрывают VP для primary/secondary сегментов)

**Исходящие:**
- → RL-* (конкретные релизы)
- → FM-* priorities (roadmap определяет, что приоритизируется)
- → MVP evolution (когда MVP achieved → создаём MMP scope через RM)

**Cascade impact:**
- Валидация HYP → следующий RL фокусируется на новой зоне
- Инвалидация HYP → обсуждение pivot, перезапись roadmap
- Изменение current phase → пересмотр Activation Matrix

## Review Level: 🟡 Standard

Ассистент собирает roadmap на основе HYP + FM + current phase. Человек валидирует приоритеты и горизонт. Регулярный review (по умолчанию ежемесячный) — `/product:plan --review` или manual запуск.

## Lifecycle States

Roadmap всегда active. Версионируется через поле `version`. При каждом major review (обычно ежемесячно) создаётся новая версия.

```
active v1 ──(monthly review)──▶ active v2 ──▶ active v3 ──▶ ...
```

Старые версии хранятся в git (никакого _archive/ — git достаточно).

## Examples

**Good:**
```yaml
---
id: RM
title: "Product roadmap"
status: active
horizon: "Q3-Q4 2026"
last_reviewed: 2026-05-01
next_review: 2026-06-01
version: 3
---

## Current phase
**MVP** — валидируем primary HYP-001 (готовность платить).
Достижение phase MMP ожидается при validated HYP-001.

## Horizon goals
1. **Validated HYP-001** (primary) через MVP release
2. **MMP scope** сформулирован к концу Q3, если HYP-001 validated
3. **SEG-002 exploration** — добавлен secondary segment (agencies)
4. **Revenue positivity** — ≥$5k MRR к концу Q4

## Release sequence

### RL-001: MVP v1
- **Target:** 2026-07-15
- **Validates:** HYP-001
- **Contains:** FM-001, FM-003, FM-004, FM-005 (все MUST from MVP)
- **Status:** in-progress

### RL-002: MVP+ (onboarding & templates)
- **Target:** 2026-08-15
- **Validates:** HYP-002 (templates увеличивают retention)
- **Contains:** FM-002 (SHOULD from MVP) + FM-007 (onboarding)

### RL-003: SEG-002 exploration
- **Target:** 2026-10-01
- **Validates:** HYP-005 (agency segment fit)
- **Contains:** FM-010 (team features — minimal)

### RL-004 (pending HYP-001 validation):
- Либо MMP — расширение для validated сегмента
- Либо pivot — переориентация на SEG-002 или новый VP

## Validation cadence
- Май-июль: HYP-001 testing (через MVP v1)
- Август-сентябрь: HYP-002 testing (templates / retention)
- Октябрь-ноябрь: HYP-005 testing (agency segment)

## Recent changes (since v2, 2026-04-01)
- Added RL-003 exploration trigger
- Moved FM-006 (glossary sync) from RL-002 to RL-004 — слишком complex для second release
- Отложена feature "mobile app" в WON'T have (не помогает HYP)
```

**Anti-example:**
```
## Roadmap
Q3: Feature A, B, C, D, E, F                     ❌ список фич без целей
Q4: Feature G, H, I, J, K                         ❌ без связи с HYP

## Goals
- Make product awesome                            ❌ не измеримо
- Add many features                               ❌ антипаттерн
- Launch marketing campaign                       ❌ не в scope product roadmap
```

## Common Mistakes

1. **Roadmap = выписка FM.** FM — фичи, roadmap — направления с целями.
2. **Слишком детальные даты.** Квартал/месяц — окей, точная дата — живёт в RL.
3. **Слишком много горизонтов.** 12+ месяцев — мечты, не roadmap.
4. **Отсутствие connection с HYP.** Roadmap без «зачем» — to-do list.
5. **Фиксированный roadmap.** Roadmap — живой документ; изменения нормальны, в `recent changes` прозрачно.

## Related Skills

- [`roadmap-planning.md`](../../../skills/product/roadmap-planning.md)
- `roadmap-monthly-review.md` (planned)
