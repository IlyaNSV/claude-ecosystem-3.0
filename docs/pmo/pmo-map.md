# PMO Map — Ecosystem 3.0

> **Роль:** Навигационная карта PMO-процессов. Говорит ЧТО должно быть сделано, не КАК.
> **Принцип:** для D1-D2 детально (это мой слой); для D3-D6 — абстрактно (это зона Integrator Module + внешних инструментов).

## Модель жизненного цикла продукта

```
ИДЕЯ → MVP → MMP → GROWTH → MATURE
```

На каждой стадии активируется свой набор процессов (см. Activation Matrix ниже).

## Шесть доменов управления

| Домен | Роль | Владелец в 3.0 | Статус |
|---|---|---|---|
| **D1. Product Discovery & Strategy** | ЧТО строить и ЗАЧЕМ | **Product Module** (детальный контроль) | Проектируется |
| **D2. Requirements & Design** | КАК это должно работать | **D2-Behavioral:** Product Module (детально); **D2-Technical:** внешний инструмент через Integrator | Проектируется |
| **D3. Development & Delivery** | ПОСТРОИТЬ и ДОСТАВИТЬ | Внешние инструменты через Integrator | Tool-agnostic |
| **D4. Quality Assurance** | ПРОВЕРИТЬ что работает | Внешние инструменты через Integrator | Tool-agnostic |
| **D5. Operations & Feedback** | НАБЛЮДАТЬ и УЧИТЬСЯ | Внешние инструменты через Integrator | Отложено (v2+) |
| **D6. Meta: Ecosystem Governance** | УПРАВЛЯТЬ самим PMO | Integrator Module + человек | Проектируется |

## Процессы в доменах

### D1 — Product Discovery & Strategy (детально)

| ID | Процесс | Артефакт | Статус v1 |
|---|---|---|---|
| D1-01 | Problem Discovery | PS | ✅ |
| D1-02 | Market Research | MR | ✅ |
| D1-03 | Competitive Analysis | CA | ✅ |
| D1-04 | Segment & JTBD | SEG-* | ✅ |
| D1-05 | Hypothesis Formulation | HYP-* | ✅ |
| D1-06 | MVP Scope Definition | MVP | ✅ |
| D1-07 | Product Roadmap | RM | ✅ |
| D1-08 | Release Planning | RL-* | ✅ |
| D1-09 | Feature Prioritization | FM-* priority | ✅ (continuous dialog) |
| D1-10 | Pivot/Persevere Decision | — | ❌ Out-of-scope v1 |

**Связанные артефакты D1 (вводятся в Product Module):** PS, MR, CA, SEG, VP, HYP, MVP, RM, RL → 9 типов

### D2 — Requirements & Design

#### D2-Behavioral (детально, в Product Module)

| ID | Процесс | Артефакт | Статус v1 |
|---|---|---|---|
| D2-01 | Project Context Setup | (наследуется из D1) | ✅ |
| D2-02 | Feature Specification | FM, SC, BR, LC, VC, IC, RPM | ✅ |
| D2-05 | UX/UI Design | MK, DS, NM (Design Module) | ✅ если has_ui |
| D2-06 | Data Model Design (поведенческая) | LC (derived) | ✅ |
| D2-08 | Adversarial Review | Product DA findings | ✅ |

**Связанные артефакты D2-Behavioral:** BG, SC, BR, LC, RPM, VC, IC, NFR, MK, DS, NM → 11 типов (BG — сквозной; NFR — opt-in per FM; DS — cross-cutting для дизайна; NM — per flow)

**Cross-cutting (не привязан к домену):** NOTE-* — unstructured catch-all для idea-capture, insights, deferred decisions. Не участвует в dependency graph, не валидируется V-*. Конвертируется в другой тип через `/product:promote-note`.

**Итого: 22 типа артефактов** (9 D1 + 1 мост FM + 11 D2-Behavioral + 1 unstructured NOTE).

#### D2-Technical (tool-agnostic, через Integrator)

| ID | Процесс | Покрывается через |
|---|---|---|
| D2-03 | Architecture Design | cc-sdd / Kiro / другой |
| D2-04 | Task Decomposition | cc-sdd / Kiro / другой |
| D2-07 | API Contract Design | cc-sdd / Kiro / другой |
| D2-09 | Spike / PoC | подключаемый по необходимости |

**Передача:** Product Module → handoff.md → Integrator → конкретный инструмент D2-Technical.

### D3 / D4 / D5 / D6 — абстрактные определения

Детальные процессы этих доменов НЕ описываются в Ecosystem 3.0. Мы описываем только:
- **Границу ответственности** (что должен делать инструмент на этой позиции)
- **Ожидаемые артефакты** (что должен производить)
- **Контракты с соседями** (что потребляет, что выдаёт)

Конкретные процессы определяются **профилем инструмента**, который составляет Integrator Module.

| Домен | Ожидаемые общие артефакты | Конкретный инструмент |
|---|---|---|
| D3 | Код, коммиты, PRs, deploy logs | определяется Integrator |
| D4 | Тесты, verification reports, QA findings | определяется Integrator |
| D5 | Monitoring data, analytics, feedback | определяется Integrator |
| D6 | Health dashboard, tool registry, evolution plan | **Integrator Module сам** |

## Activation Matrix (когда включать что)

Упрощённая версия (детальная будет per-project):

| Процесс | Идея | MVP | MMP | Growth | Mature |
|---|---|---|---|---|---|
| D1-01..06 (Discovery) | ★ | ○ | | | |
| D1-07 (Roadmap) | | ★ | ★ | ★ | ★ |
| D1-08 (Release Plan) | | ★ | ★ | ★ | ★ |
| D1-09 (Prioritization) | | ★ | ★ | ★ | ★ |
| D2-Behavioral (SC/BR/LC/VC/IC/RPM/BG) | | ★ | ★ | ★ | ★ |
| D2 NFR Review (F.5a, opt-in) | | ○ | ★ | ★ | ★ |
| D2-05 (Design, если has_ui) | | ★ | ★ | ★ | ★ |
| D2-08 (Adversarial Review, magnitude-gated) | | ★ | ★ | ★ | ★ |
| D2-Technical (через Integrator) | | ★ | ★ | ★ | ★ |
| D3 (Development, через Integrator) | | ★ | ★ | ★ | ★ |
| D4 (QA, через Integrator) | | ○ | ★ | ★ | ★ |
| D5 (Operations, через Integrator) | | ○ | ★ | ★ | ★ |
| D6 (Meta, Integrator Module) | | ★ | ★ | ★ | ★ |

★ = обязательно | ○ = желательно

## Ритмы и церемонии

### Для D1-D2 (детальный контроль)

| Частота | Активность |
|---|---|
| Per feature | /product:feature (enrichment или creation) |
| Per session | /product:status |
| По изменению BR | Cascade Consistency (автомат) |
| По триггеру | Adversarial Review (F.9 при high-risk фичах) |

### Для D3-D6 (абстрактный контроль)

| Частота | Активность |
|---|---|
| Per release | Готовый handoff → Integrator → конвейер инструментов |
| По потребности | /integrator:map, /integrator:gaps, /integrator:verify |
| По изменению tool landscape | /integrator:add/remove/replace |

## Связь с артефактами

Подробная спецификация 21 типа артефактов → см. `artifacts/` (каталог готов).

Процессы создания и обновления артефактов → см. `processes.md` (в разработке).

Валидационные правила → см. `validation.md` (в разработке).

## Что отличает эту карту от PMO в v2 документации

1. **Меньше детализации вне D1-D2.** Для D3-D6 мы НЕ описываем конкретные процессы (M-*.*.*), а делегируем через Integrator.
2. **Нет «текущего покрытия в %».** В 3.0 покрытие = это то, что подключил Integrator. Нет «GAP-ов» в смысле v2.
3. **Activation Matrix упрощена.** Фокус на стадиях продукта, не на конкретных инструментах.
4. **Ритмы разделены.** Детальные для моего слоя, абстрактные для внешнего.

## Validation tier и активация правил

Activation Matrix говорит, какие **процессы** включены per стадия. Какие **validation правила** активны inline — определяет [`validation_tier`](validation.md#21-три-уровня) в `.claude/product.yaml`:

| Tier | Inline validation |
|---|---|
| `pilot` (default для bootstrap) | Только 🔴 Blocking. Остальное queued в `/product:status` |
| `mvp` | + 🟡 Warning |
| `full` | Все 33 V-* правила |

Это разделение защищает ранние стадии от validation-шума, не отключая правила полностью.
