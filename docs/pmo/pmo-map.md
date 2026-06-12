# PMO Map — Ecosystem 3.0

> **Роль:** Навигационная карта PMO-процессов. Говорит ЧТО должно быть сделано, не КАК.
> **Принцип:** функциональная карта = job descriptions ролей. Для **owned**-зон (D1, D2-Behavioral, D6) — детальные обязанности и артефакты. Для **delegated**-зон (D2-Technical, D3, D4, D5) — те же функциональные обязанности (стабильны, tool-agnostic), но реализация делегирована внешним инструментам через Integrator. Mетодика конкретного инструмента (implementation methodology) — НЕ зашита в карту, она в tool-docs.
> **Читать вместе с:** [processes.md](processes.md) (методология P1-P5), [validation.md](validation.md) (44 правила), [artifacts/](artifacts/) (24 типа), [../product-module/SPEC.md](../product-module/SPEC.md), [../integrator-module/SPEC.md](../integrator-module/SPEC.md), [../design-module/SPEC.md](../design-module/SPEC.md), [../README.md](../README.md) (docs index).

## Модель жизненного цикла продукта

```
ИДЕЯ → MVP → MMP → GROWTH → MATURE
```

На каждой стадии активируется свой набор процессов (см. Activation Matrix ниже).

## Шесть доменов управления

| Домен | Роль | Владелец в 3.0 | Статус |
|---|---|---|---|
| **D1. Product Discovery & Strategy** | ЧТО строить и ЗАЧЕМ | **Product Module** (детальный контроль) | Проектируется |
| **D2. Requirements & Design** | КАК это должно работать | **D2-Behavioral:** Product/Design Module (детально); **D2-Technical:** внешний инструмент через Integrator | Проектируется |
| **D3. Development & Delivery** | ПОСТРОИТЬ и ДОСТАВИТЬ | Внешние инструменты через Integrator | Tool-agnostic |
| **D4. Quality Assurance** | ПРОВЕРИТЬ что работает | Внешние инструменты через Integrator | Tool-agnostic |
| **D5. Operations & Feedback** | НАБЛЮДАТЬ и УЧИТЬСЯ | Внешние инструменты через Integrator | Отложено (v2+) |
| **D6. Meta: Ecosystem Governance** | УПРАВЛЯТЬ самим PMO | Integrator Module + человек | Проектируется |

## Процессы в доменах

### D1 — Product Discovery & Strategy — Роль: **Продакт-менеджер**

> Принимает: ничего (стартовая зона). Выдаёт: PS, MR, CA, SEG, VP, HYP, MVP, RM, RL.

| ID | Обязанность | Артефакт | Статус v1 |
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

#### D2-Behavioral — Роль: **Бизнес-аналитик** (owned, не делегируется)

> Исполняется Product Module (D2-B01-03, B05) и Design Module (D2-B04).
> Принимает: D1-стратегию. Выдаёт: `handoff.md` для D2-Technical.

| ID | Обязанность | Scope | Артефакт(ы) | Статус v1 |
|---|---|---|---|---|
| D2-B01 | Project Context Setup | Перенос D1-стратегии в рабочий контекст фичеделия | наследуется из D1 | ✅ |
| D2-B02 | Feature Specification | Поведенческая спецификация фичи | FM, SC, BR, VC, IC, RPM | ✅ |
| D2-B03 | Behavioral Data Modeling | Жизненный цикл сущностей / поведенческая модель данных | LC | ✅ |
| D2-B04 | UX/UI Design *(если has_ui)* | Дизайн интерфейса (Design Module) | MK, DS, NM, AM | ✅ SPEC v1.1 + Phase 6 v1.0 (1.4.0) |
| D2-B05 | Adversarial Review | Состязательная проверка спецификации | Product DA findings | ✅ |

**Связанные артефакты D2-Behavioral:** BG, SC, BR, LC, RPM, VC, IC, NFR, MK, DS, NM → 11 типов (BG — сквозной; NFR — opt-in per FM, идёт как F.5a; DS — cross-cutting для дизайна; NM — per flow)

**Cross-cutting (не привязан к домену):** NOTE-* — unstructured catch-all для idea-capture, insights, deferred decisions. Не участвует в dependency graph, не валидируется V-*. Конвертируется в другой тип через `/product:promote-note`. **LESSON-*** — corrective lesson (atomic find→fix→record, DEC-DEV-0062): не участвует в dependency graph, валидируется только V-LE-01..05; cardinality per lesson.

**Итого: 24 типа артефактов** (9 D1 + 1 мост FM + 12 D2-Behavioral вкл. AM + 1 unstructured NOTE + 1 cross-cutting LESSON).

#### D2-Technical — Роль: **Технический архитектор** (delegated, через Integrator)

> Принимает: `handoff.md` (D2-Behavioral). Выдаёт: технический спек для D3.

| ID | Обязанность | Scope | Основной выход |
|---|---|---|---|
| D2-T01 | Architecture Design | Декомпозиция системы на компоненты/слои, границы и ответственность | Architecture doc |
| D2-T02 | Technology Selection | Выбор стека, фреймворков, библиотек, инфра-компонентов | Tech stack decision |
| D2-T03 | Data Model Design (technical) | Трансляция behavioral LC → физическая схема, индексы, миграции | Physical data model |
| D2-T04 | API / Interface Contract Design | Контракты между компонентами и внешние API | Interface/API contracts |
| D2-T05 | NFR Technical Translation | Перевод NFR-таргетов в технические решения (caching, scaling, etc.) | NFR technical plan |
| D2-T06 | Task Decomposition | Разбивка дизайна на исполняемые задачи с зависимостями | Task breakdown / `tasks.md` |
| D2-T07 | Feasibility & Technical Risk | Оценка реализуемости behavioral-спеки, технические риски | Feasibility/risk assessment |
| D2-T08 | Spike / PoC *(по необходимости)* | Экспериментальная проверка нерешённых технических вопросов | Spike report |

**Передача:** Product Module → handoff.md → Integrator (matches tools против D2-T01-08) → конкретный инструмент D2-Technical.

### D3 — Development & Delivery — Роль: **Разработчик / Delivery-инженер** (delegated, через Integrator)

> Принимает: технический спек + `tasks.md` (D2-Technical). Выдаёт: рабочее, развёрнутое ПО.

| ID | Обязанность | Scope | Основной выход |
|---|---|---|---|
| D3-01 | Implementation | Написание кода по задачам | Source code / commits |
| D3-02 | Code Review | Рецензирование на корректность, стиль, поддерживаемость | Review-апрувы / комментарии |
| D3-03 | Source Integration | VCS, ветвление, PR/MR, разрешение конфликтов слияния | Merged branches / PRs |
| D3-04 | Build & Dependency Management | Сборка артефактов, управление зависимостями | Build artifacts |
| D3-05 | Environment Provisioning | Подготовка сред (dev/staging/prod), инфраструктура | Provisioned environments |
| D3-06 | Deployment & Release Execution | Выкладка, миграции, rollback-механика | Deployed release / deploy log |
| D3-07 | Technical Documentation | Код-доки, README, runbooks | Tech docs / runbooks |

### D4 — Quality Assurance — Роль: **QA-инженер / Тестировщик** (delegated, через Integrator)

> Принимает: behavioral acceptance (SC/BR из handoff) + технический спек + собранное ПО. Выдаёт: verification-отчёты, QA findings.

| ID | Обязанность | Scope | Основной выход |
|---|---|---|---|
| D4-01 | Test Strategy & Planning | Подход, уровни, scope тестирования; regression-стратегия | Test plan |
| D4-02 | Test Case Design | Выведение тест-кейсов из SC / BR / acceptance | Test cases / матрица |
| D4-03 | Test Implementation & Execution | Авто-тесты (unit/integration/e2e) + прогоны, incl. regression | Test suite + run results |
| D4-04 | Defect Management | Обнаружение, регистрация, трекинг дефектов | Defect reports |
| D4-05 | Acceptance Verification | Проверка соответствия handoff acceptance-критериям (замыкает петлю к D2-Behavioral) | Verification report |
| D4-06 | Static Analysis & Quality Gates | Линтинг, статический анализ, code quality metrics | Quality gate status |
| D4-07 | NFR / Performance / Security Testing | Проверка нефункциональных требований (нагрузка, безопасность) | Perf/security test report |

### D5 / D6 — статус

**D5 Operations & Feedback** — отложен v2 (DEC-P08). Функциональная декомпозиция per role (SRE/DevOps/Ops) будет добавлена при активации.

**D6 Meta: Ecosystem Governance** — owned: Integrator Module + человек (D7 meta-improvement subsystem). Detailed decomposition — в `dev/meta-improvement/`.

## Activation Matrix (когда включать что)

Упрощённая версия (детальная будет per-project):

| Процесс | Идея | MVP | MMP | Growth | Mature |
|---|---|---|---|---|---|
| D1-01..06 (Discovery) | ★ | ○ | | | |
| D1-07 (Roadmap) | | ★ | ★ | ★ | ★ |
| D1-08 (Release Plan) | | ★ | ★ | ★ | ★ |
| D1-09 (Prioritization) | | ★ | ★ | ★ | ★ |
| D2-B01..B03 (Context, Feature Spec, Behavioral Data) | | ★ | ★ | ★ | ★ |
| D2-B04 (UX/UI, если has_ui) | | ★ | ★ | ★ | ★ |
| D2-B05 (Adversarial Review, adaptive-depth — refactored DEC-DEV-0012) | | ★ | ★ | ★ | ★ |
| D2 NFR Review (F.5a, opt-in) | | ○ | ★ | ★ | ★ |
| D2-Technical (через Integrator) | | ★ | ★ | ★ | ★ |
| D3 (Development, через Integrator) | | ★ | ★ | ★ | ★ |
| D4 (QA, через Integrator) | | ○ | ★ | ★ | ★ |
| D5 (Operations, через Integrator) | | ○ | ★ | ★ | ★ |
| D6 (Meta, Integrator Module) | | ★ | ★ | ★ | ★ |

★ = обязательно | ○ = желательно

## Ритмы и церемонии

### Для D1 + D2-Behavioral (owned, детальный контроль)

| Частота | Активность |
|---|---|
| Per feature | /product:feature (enrichment или creation) |
| Per session | /product:status |
| По изменению BR | Cascade Consistency (автомат) |
| По триггеру | Adversarial Review (F.9 при high-risk фичах) |

### Для D2-Technical / D3 / D4 / D5 (delegated, абстрактный контроль)

| Частота | Активность |
|---|---|
| Per release | Готовый handoff → Integrator → конвейер инструментов |
| По потребности | /integrator:map, /integrator:gaps, /integrator:verify |
| По изменению tool landscape | /integrator:add/remove/update |

## Связь с артефактами

Подробная спецификация 24 типов артефактов → см. `artifacts/` (каталог готов).

Процессы создания и обновления артефактов → см. `processes.md`.

Валидационные правила → см. `validation.md`.

## Validation tier и активация правил

Activation Matrix говорит, какие **процессы** включены per стадия. Какие **validation правила** активны inline — определяет [`validation_tier`](validation.md#21-три-уровня) в `.claude/product.yaml`:

| Tier | Inline validation |
|---|---|
| `pilot` (default для bootstrap) | Только 🔴 Blocking. Остальное queued в `/product:status` |
| `mvp` | + 🟡 Warning |
| `full` | Все 44 V-* правила |

Это разделение защищает ранние стадии от validation-шума, не отключая правила полностью.

## Миграция ID (после функционального рефактора DEC-DEV-0040)

Старая нумерация D2 имела интерливинг Behavioral/Technical. После рефактора — два чистых блока:

| Старый | Новый | | Старый | Новый |
|---|---|---|---|---|
| D2-01 | D2-B01 | | D2-06 | D2-B03 |
| D2-02 | D2-B02 | | D2-07 | D2-T04 |
| D2-03 | D2-T01 | | D2-08 | D2-B05 |
| D2-04 | D2-T06 | | D2-09 | D2-T08 |
| D2-05 | D2-B04 | | *(new)* | D2-T02/T03/T05/T07 |

`D2-Tech-02` — фантомный ID, никогда не существовал. cc-sdd primary coverage: **D2-T01 + D2-T06**; см. DEC-DEV-0040 §Q5.

D3 / D4 — были абстрактны; теперь функциональная декомпозиция D3-01..07 + D4-01..07.
