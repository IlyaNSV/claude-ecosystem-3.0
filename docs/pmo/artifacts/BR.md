# BR-* — Business Rule

> **Тип:** business-rule
> **Домен:** D2 — Behavioral
> **Review:** 🔴 Critical
> **Cardinality:** Per rule (обычно 3–8 BR на FM)
> **Владелец:** Product Module / процесс P2 Feature Definition; каскадные изменения через P4

## Purpose

**Атомарное бизнес-правило** — ограничение, условие, формула, определяющая поведение системы независимо от UI. Одно BR может использоваться в нескольких SC. BR — **самый критичный артефакт** по каскадному влиянию: изменение BR проверяет все связанные SC, VC, LC, IC.

## Frontmatter Schema

```yaml
---
id: BR-<NNN>
type: business-rule
title: "Короткая формулировка правила"
category: validation | calculation | authorization | workflow | constraint | state-transition
status: draft | active | deprecated
scenarios: [SC-<NNN>, ...]            # где используется (bi-dir с SC)
invariants: [IC-<NNN>, ...]            # какие инварианты этим правилом поддерживаются
lifecycles: [LC-<NNN>, ...]            # какие LC transitions зависят
parameters:                            # параметризация (если есть)
  <param_name>: <value>
owner_feature: FM-<NNN>                # первичная фича; BR может использоваться в других
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Statement.** Формальная формулировка правила одним предложением. Формат: «ЕСЛИ [condition] ТО [action/constraint]» или «ВСЕГДА [invariant]».
2. **Context.** Когда правило применяется (какие процессы, какие сущности).
3. **Parameters.** Значения параметров с пояснением каждого (если параметризовано).
4. **Rationale.** Почему это правило существует — бизнес-обоснование (откуда взялось из MR, HYP, customer needs).
5. **Applied in scenarios.** Список SC с указанием шагов (SC-005 шаг 3, SC-007 шаг 2).
6. **Edge cases.** Граничные случаи и как правило их обрабатывает.

Опциональные:

- **Examples** (конкретные входные → выходные данные)
- **Historical changes** (если параметры менялись)

## Content Rules

- **Формализм.** Statement должно быть выразимо как предикат. «Правильное значение бюджета» — нет. «budget >= 50 AND budget <= 100000 AND currency IN (USD, EUR, RUB)» — да.
- **Атомарность.** Одно правило = одна проверка. Сложная логика — цепочка BR, а не один «большой» BR.
- **Параметризация когда возможно.** «min_budget = 50» в parameters, не в statement. Тогда изменение параметра ≠ изменение правила.
- **Использует BG-термины.** Имена сущностей, полей, статусов — из BG.
- **Category обязательна.** Разные категории — разный жизненный цикл (validation vs calculation vs authorization).

### Категории BR

| Категория | Примеры |
|---|---|
| **validation** | Формат email, длина строки, range числа |
| **calculation** | Формула скидки, расчёт totals, пропорции |
| **authorization** | Кто может что делать (работает с RPM) |
| **workflow** | Последовательность шагов, зависимости действий |
| **constraint** | Структурные ограничения (не более N items в batch) |
| **state-transition** | Условия перехода между states в LC |

## Relationships

**Входящие:**
- ← FM-{NNN} (owner feature)
- ← BG (термины в statement)

**Исходящие:**
- → SC-* (bi-dir: SC ссылается на BR, BR хранит список SC в scenarios)
- → LC-* (BR описывает guard-условия переходов)
- → IC-* (BR поддерживает инварианты — показываем какие)
- → VC-* (VC верифицируют, что BR применено корректно)

**Cascade impact при изменении (процесс P4 — Critical):**
1. Все SC из `scenarios` → status `requires_review`
2. Все VC связанные с этими SC → переген (через skill cascade-consistency)
3. Все LC, где BR в guard-условиях → проверка state-машины
4. IC в списке `invariants` → перепроверка (не нарушен ли инвариант изменением)
5. Связанные FM → status notification

## Review Level: 🔴 Critical

**Любое изменение BR** требует:
1. Impact analysis — полный список затронутых артефактов
2. Approve per каждый каскадный апдейт (не bundle-approve)
3. Запись в decision journal с обоснованием
4. Product DA review обязательно перед active

Почему Critical: BR каскадит на весь Behavioral слой; ошибка в BR может сломать десяток сценариев и пропасть в production.

## Lifecycle States

```
draft ──(DA review + approve)──▶ active ──(change request)──▶ draft (с impact) ──▶ active v2
                                    │
                                    └──(FM deprecated / rule obsolete)──▶ deprecated
```

## Examples

**Good:**
```yaml
---
id: BR-010
type: business-rule
title: "Привязка revision к проекту по email sender"
category: workflow
status: active
scenarios: [SC-005, SC-005a, SC-005e1]
invariants: [IC-003]
lifecycles: [LC-002]
parameters:
  linking_strategy: "first_match_only"
  fallback_on_multiple: "manual_review"
owner_feature: FM-003
created: 2026-05-10
updated: 2026-05-12
version: 2
---

## Statement
ЕСЛИ incoming revision имеет sender email в **Client.emails** одного активного 
Project, ТО revision.project_id := Project.id (automatic linking).
ЕСЛИ email найден в **Client.emails** нескольких Projects, ТО revision 
переходит в manual review (см. **BR-011**).

## Context
Применяется в момент получения revision из email-канала (SC-005).
Не применяется для manual revision (SC-006) и batch-revisions (SC-007 uses linking already made).

## Parameters
- `linking_strategy: "first_match_only"` — при нахождении используем первый
  project, не выбираем наиболее релевантный
- `fallback_on_multiple: "manual_review"` — если несколько matches, 
  не гадаем, отдаём человеку

## Rationale
Из интервью SEG-001: 80% случаев у фрилансера один активный проект с клиентом
→ auto-linking работает. 20% — клиент ведёт параллельно 2+ проекта; 
guess'ить неправильно → хуже, чем попросить вручную.

## Applied in scenarios
- SC-005 шаг 3: primary usage, successful single-match case
- SC-005a шаг 2: alternative при multiple match → manual
- SC-005e1 шаг 2: error при no match → review-pool через **BR-011**

## Edge cases
- Client с несколькими email адресами → каждый проверяется отдельно
- Email с forwarding chain → используем final sender
- Email в deleted project → ignore (project status=active обязателен)

## Examples
Input: `client@example.com`, active projects:
- Project-1 (client emails: [client@example.com])
- No other matches

Output: revision.project_id = Project-1.id ✓

Input: `client@example.com`, matches:
- Project-1 (client@example.com)
- Project-2 (client@example.com, old_alias@example.com)

Output: revision → manual review pool, notification to freelancer
```

**Anti-example:**
```
## Statement
"Правильно привязывать правки"                 ❌ не формально
"Если письмо от клиента — привязать"           ❌ двусмысленно

## Parameters: отсутствуют                      ❌ всё захардкожено в statement
```

## Common Mistakes

1. **BR как SC.** BR — правило, не сценарий. SC «при получении письма происходит X» — это SC, а BR — условие «email matches project».
2. **Не-атомарные BR.** «При создании revision проверить email, применить batching, отправить уведомление» — это три BR.
3. **Hard-coded values вместо параметров.** `min_budget=50` в statement — правило не переиспользуется между проектами с разными валютами.
4. **Игнор impact analysis.** Тихое изменение BR ломает пол-проекта незаметно.
5. **Смешение categories.** validation + calculation в одном BR — сложно тестировать и поддерживать.

## Related Skills

- `business-rule-extraction.md` (в разработке)
- `br-impact-analysis.md` (в разработке, для каскадных изменений)
- `br-parameterization.md` (в разработке)
