# Каталог артефактов D1-D2 — Ecosystem 3.0

> **Версия:** 1.1 draft (2026-04-17)
> **Назначение:** единый справочник формата всех 21 типов артефактов Product Layer.
> **Принцип:** декларативные правила здесь, процессуальные — в skills Product Module.
> **Обновления v1.1:** добавлен NFR-* (закрытие OQ-03)

## Назначение каталога

Каталог описывает **ЧТО** такое каждый артефакт: его структура, правила содержимого, связи, жизненный цикл. Он НЕ описывает **КАК** его создать — это зона Product Assistant (skills).

### Кто читает каталог

| Читатель | Как использует |
|---|---|
| **Человек (владелец продукта)** | Справочник при работе с артефактами |
| **Product Assistant** | Загружает соответствующий файл при создании/изменении артефакта |
| **Integrator Module** | Использует схемы при создании контрактов с внешними инструментами |
| **Внешний реализатор** (через handoff) | Понимает формат передаваемых данных |
| **Будущий Orchestrator** | Валидирует состояние `.product/` при маршрутизации |

## 22 типа артефактов

### D1 — Product Discovery & Strategy (9 типов)

| ID | Имя | Review | Cardinality | Файл |
|---|---|---|---|---|
| PS | Problem Statement | 🟠 Strategic | Singleton | [PS.md](PS.md) |
| MR | Market Research | 🟡 Standard | Singleton | [MR.md](MR.md) |
| CA | Competitive Analysis | 🟡 Standard | Singleton | [CA.md](CA.md) |
| SEG-* | Segment & JTBD | 🟠 Strategic | 2–4 per product | [SEG.md](SEG.md) |
| VP-* | Value Proposition | 🟠 Strategic | 1 per SEG | [VP.md](VP.md) |
| HYP-* | Hypothesis | 🟠 Strategic | 3–5 per product | [HYP.md](HYP.md) |
| MVP | MVP Scope | 🟠 Strategic | Singleton | [MVP.md](MVP.md) |
| RM | Product Roadmap | 🟡 Standard | Singleton | [RM.md](RM.md) |
| RL-* | Release Plan | 🟡 Standard | Per release | [RL.md](RL.md) |

### D1↔D2 — Мост

| ID | Имя | Review | Cardinality | Файл |
|---|---|---|---|---|
| FM-* | Feature Map Entry | 🟠 Strategic | Per feature | [FM.md](FM.md) |

### Cross-cutting

| ID | Имя | Review | Cardinality | Файл |
|---|---|---|---|---|
| BG | Business Glossary | 🟡 Standard | Singleton | [BG.md](BG.md) |
| NOTE-* | Unstructured Note | 🟡 Standard | Per note (D3 modification) | [NOTE.md](NOTE.md) |

### D2-Behavioral (7 типов)

| ID | Имя | Review | Cardinality | Файл |
|---|---|---|---|---|
| SC-* | User Scenario | 🟠 Strategic | Per scenario | [SC.md](SC.md) |
| BR-* | Business Rule | 🔴 Critical | Per rule | [BR.md](BR.md) |
| LC-* | Entity Lifecycle | 🟢 Confirmation | Per entity | [LC.md](LC.md) |
| RPM | Role & Permission Model | 🟢 Confirmation | Singleton | [RPM.md](RPM.md) |
| VC-* | Verification Criteria | 🟢 Confirmation | Per scenario | [VC.md](VC.md) |
| IC-* | Invariant Check | 🔴 Critical | Per invariant | [IC.md](IC.md) |
| NFR-* | Non-Functional Requirement | 🟠 Strategic | Per NFR | [NFR.md](NFR.md) |

### D2-05 — Design (3 типа)

| ID | Имя | Review | Cardinality | Файл |
|---|---|---|---|---|
| MK-* | Mockup Package | 🟠 Strategic | Per screen/flow | [MK.md](MK.md) |
| DS | Design System | 🟡 Standard | Singleton | [DS.md](DS.md) |
| NM-* | Navigation Map | 🟢 Confirmation | Per flow | [NM.md](NM.md) |

## Граф зависимостей

```
                            ┌─────┐
                            │ PS  │ (корень, изменение = pivot)
                            └──┬──┘
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
                ┌─────┐    ┌─────┐    ┌─────┐
                │ MR  │    │ CA  │    │SEG-*│
                └──┬──┘    └──┬──┘    └──┬──┘
                   │          │          │
                   └──────────┼──────────┘
                              ▼
                          ┌───────┐
                          │ VP-*  │ (per SEG)
                          └───┬───┘
                              │
                          ┌───▼───┐
                          │ HYP-* │
                          └───┬───┘
                              │
                          ┌───▼───┐
                          │ MVP   │
                          └───┬───┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                ┌─────┐   ┌──────┐  ┌──────┐
                │ RM  │──▶│ RL-* │  │ FM-* │◀───── D1↔D2 мост
                └─────┘   └──────┘  └──┬───┘
                                       │
                         ┌─────────────┼──────────────────────┐
                         ▼             ▼                      ▼
                     ┌──────┐      ┌──────┐            ┌──────────┐
                     │ SC-* │◀────▶│ BR-* │            │  MK-*    │ (если has_ui)
                     └──┬───┘      └──┬───┘            └────┬─────┘
                        │             │                     │
                        ├─────────────┤              ┌──────┼──────┐
                        ▼             ▼              ▼      ▼      ▼
                    ┌──────┐      ┌──────┐       ┌────┐ ┌────┐ ┌─────┐
                    │ LC-* │      │ VC-* │       │ DS │ │NM-*│ │(ref)│
                    └──┬───┘      └──────┘       └────┘ └────┘ └─────┘
                       │
                       ▼
                    ┌──────┐
                    │ IC-* │ (критические инварианты)
                    └──────┘

              ┌────────┐
              │  BG    │ ◀────── извлекается из всех артефактов (continuous)
              └────────┘ ──────▶ питает терминологию всех

              ┌────────┐
              │  RPM   │ ◀────── выводится из SC + SEG
              └────────┘

              ┌────────┐
              │ NFR-*  │ ◀────── derived from FM + IC + MR (stage-aware);
              │        │         scope=global или per_feature
              └────────┘ ──────▶ питает VC extensions, D4 тесты
                                  (embedded в handoff §11)
```

## Cross-cutting правила

### Общие поля frontmatter (обязательны для всех артефактов)

```yaml
---
# Identity
id: "<PREFIX>-<NNN>" | "<FIXED>"   # SEG-001, FM-042, PS, BG, MVP, RM, RPM, DS
type: "<kebab-case-type>"          # problem-statement, segment, feature-map-entry
title: "Человеко-читаемое название"
status: draft | active | deprecated | <special-per-type>

# Confidence (C2 modification — обязательно во всех артефактах)
confidence: high | medium | low                       # уверенность ассистента в артефакте
confidence_notes: "string"                            # required если confidence != high; рекомендован всегда

# Override fields (D2 modification — optional, по необходимости)
validation_overrides:                                 # see validation.md §9.3 — постоянное снятие правила
  - rule: V-XX
    reason: "..."
    approved: true
approve_overrides:                                    # see validation.md §9.4 — временное прохождение gate
  - rule: V-XX
    reason: "..."
    approved_by: human
    approved_at: YYYY-MM-DDThh:mm
    expires_at: YYYY-MM-DD                            # optional

# Audit
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1                                            # инкрементируется при каждом draft→active переходе
---
```

**Confidence semantics:**
- `high` — ассистент уверен; для 🟢 Confirmation-уровня артефактов с чистой валидацией → авто-approve (см. processes.md §2.5.2)
- `medium` — есть нюансы; требует human review даже для 🟢
- `low` — значительная неопределённость; human approve обязателен с дополнительным rationale

`confidence_notes` объясняет **почему именно** такая уверенность («derived из 4 SC, transitions clear; единственная неопределённость — terminal state at archived»).

Специфичные поля — в соответствующих файлах артефактов.

### Review levels

| Уровень | Значок | Кто проверяет | Когда требуется approve |
|---|---|---|---|
| **Critical** | 🔴 | Человек + Product DA обязательно | Любое изменение; impact analysis перед approve |
| **Strategic** | 🟠 | Человек явно | При draft→active и при изменениях контента |
| **Standard** | 🟡 | Человек валидирует выводы | При draft→active; автообновления — OK с уведомлением |
| **Confirmation** | 🟢 | Человек подтверждает корректность деривации | При draft→active (derived автоматически) |

Детальное обоснование уровня — в файле каждого артефакта в разделе "Review Level".

### Lifecycle states (общие)

```
draft ──────▶ active ──────▶ deprecated
  ▲              │
  └──(rework)────┘
```

**Специальные состояния per тип:**
- **HYP-\*:** testing, validated, invalidated, deferred
- **FM-\*:** planned, in-progress, shipped, deprecated
- **RL-\*:** planned, in-progress, released, cancelled
- **MVP:** draft, active, achieved, evolved
- **MK-\*:** iteration счётчик в frontmatter

### Naming conventions

**ID-формат:**
- Singleton: `PS`, `MVP`, `RM`, `BG`, `RPM`, `DS` — без номера
- Enumerable: `<PREFIX>-<NNN>` — SEG-001, FM-042 (трёхзначное с ведущими нулями)

**Файлы в `.product/`:**
- Singleton: `.product/<name>.md` — `.product/problem.md`, `.product/mvp-scope.md`
- Enumerable: `.product/<group>/<PREFIX>-<NNN>-<slug>.md` — `.product/segments/SEG-001-freelancers.md`
- Cross-cutting: `.product/glossary.md`, `.product/design-system.md`

**Slug derivation rule (codified DEC-DEV-0012, 2026-04-20):**
- Slug = first 3-5 значимых words of `title`, lowercased, hyphenated, max 50 chars
- **ASCII-only.** Cyrillic transliterate per ГОСТ 7.79-2000 System B (или эквивалент). Rationale: filesystem safety на Windows-cmd, git portability, search-replace tooling reliability, URL-safe export.
- Stop-words exclude (the, a, an, и, для, с, на, etc.) — implementation hint, не strict rule
- Examples:
  - `title: "Freelance translators (rus-eng)"` → `freelance-translators` или `freelance-translators-rus-eng`
  - `title: "Glossary retention drives conversion"` → `glossary-retention` (3 words sufficient)
  - `title: "Фрилансеры-переводчики"` → `frilansery-perevodchiki` (transliterated)
- Pilot reference: `my-first-test/.product/segments/SEG-001-solo-creators.md` (canonical pattern)

### Директория `.product/` — референсная структура

```
.product/
├── problem.md                          # PS
├── market-research.md                  # MR
├── competitive-analysis.md             # CA
├── mvp-scope.md                        # MVP
├── roadmap.md                          # RM
├── glossary.md                         # BG (cross-cutting)
├── design-system.md                    # DS (cross-cutting)
├── rpm.md                              # RPM
├── segments/
│   ├── SEG-001-<slug>.md
│   └── ...
├── value-propositions/
│   ├── VP-001-<slug>.md
│   └── ...
├── hypotheses/
│   ├── HYP-001-<slug>.md
│   └── ...
├── releases/
│   ├── RL-001-<slug>.md
│   └── ...
├── features/
│   ├── FM-001-<slug>.md
│   └── ...
├── scenarios/
│   ├── SC-001-<slug>.md
│   └── ...
├── business-rules/
│   ├── BR-001-<slug>.md
│   └── ...
├── lifecycles/
│   ├── LC-001-<slug>.md
│   └── ...
├── verification/
│   ├── VC-001-<slug>.md
│   └── ...
├── invariants/
│   ├── IC-001-<slug>.md
│   └── ...
├── nfr/
│   ├── NFR-001-<slug>.md
│   └── ...
├── mockups/
│   ├── MK-001-<slug>.md
│   ├── NM-001-<slug>.md
│   └── ...
├── notes/                              # NOTE-* (D3 modification)
│   ├── NOTE-001-<slug>.md
│   └── ...
└── handoffs/
    └── FM-<NNN>-handoff.md            # генерируется Product Module
```

### Валидация (общая)

Каждый артефакт в `.product/` должен:
1. Иметь валидный YAML frontmatter с обязательными общими полями + специфичные per тип
2. Все ссылки в связях (frontmatter поле `related_artifacts` и производные) должны указывать на **существующие** артефакты
3. Статусы ссылаемых артефактов должны быть совместимы (например, active FM не может ссылаться на draft SC)
4. Граф зависимостей не должен содержать циклов (кроме bi-directional ссылок SC↔BR)

Детальные правила V-01..V-17 — в `pmo/validation.md` (в разработке).

### BG (Business Glossary) как сквозной механизм

BG пополняется автоматически при создании/изменении **любого** артефакта с жирным выделением терминов. Каждый термин:
- Добавляется ассистентом в BG как draft
- Human подтверждает определение
- При mass-rename — каскадное обновление всех ссылок

Алгоритм детализируется в `pmo/processes.md` + skill `bg-extraction.md` (в разработке).

### DS (Design System) как сквозной механизм для дизайна

DS пополняется при создании/изменении **любого** MK-*. Токены, компоненты, паттерны извлекаются и нормализуются. При изменении токена — каскадная проверка всех MK-* (V-MK-08).

## Навигация по файлам

| Хочу узнать... | Смотри в |
|---|---|
| Какие есть артефакты | README.md (этот файл) |
| Схема конкретного артефакта | `<TYPE>.md` в этой же папке |
| Граф зависимостей | README.md § «Граф зависимостей» |
| Review levels | README.md § «Review levels» |
| Правила валидации | `pmo/validation.md` (в разработке) |
| Процессы создания | `pmo/processes.md` (в разработке) |
| Как создать артефакт (методология) | `product-module/skills/` (в разработке) |
| Handoff-формат | `product-module/handoff-spec.md` (в разработке) |

## Что каталог НЕ описывает

- Методологию диалога с пользователем при создании артефактов (это skills)
- Конкретные процессы P1-P5 (это `pmo/processes.md`)
- Команды Product Assistant (это `product-module/`)
- Детали валидации (это `pmo/validation.md`)
- Примеры из конкретных проектов (артефакты `.product/` живут в проектах)

## Версионирование каталога

При изменении правил артефактов:
1. Обновить соответствующий файл `<TYPE>.md`
2. Обновить дату в frontmatter файла
3. Если BREAKING CHANGE (ломает существующие артефакты) — добавить миграционную заметку в `_migrations/` (создаётся при необходимости)
