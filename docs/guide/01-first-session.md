# Первая продуктовая сессия — от идеи до handoff

> **Для кого:** ты установил экосистему и хочешь впервые провести продукт через неё — но не знаешь, что нажимать и чего ждать. Этот документ ведёт за руку от чистого проекта до готового handoff одной фичи на сквозном примере.
>
> **Что у тебя будет в конце:** заполненный `.product/` (проблема, сегменты, гипотезы, MVP, дорожная карта), одна фича со спецификацией поведения (сценарии, правила, инварианты) и сгенерированный `handoff.md`, готовый уйти в реализацию.
>
> **Параллельно открой** [`ecosystem-map.html`](ecosystem-map.html) — там та же картина визуально и кликабельно.

---

## 0. Перед стартом

Нужна установленная экосистема в проекте. Если ещё нет:

```
> /ecosystem:bootstrap
> /ecosystem:verify        # health-check, должен быть зелёным
```

Детали установки — [BOOTSTRAP.md](../../BOOTSTRAP.md) + [INSTALL-HUMAN.md](../../INSTALL-HUMAN.md). Дальше считаем, что bootstrap прошёл: есть `.claude/` (машинерия) и пустой `.product/` (сюда лягут артефакты).

---

## 1. Одна мысленная модель, которой достаточно

Вся работа идёт по одному паттерну — **draft → iterate → approve**:

```
1. Ассистент готовит черновик (research, derivation — не ты с чистого листа)
2. Показывает тебе с явными точками выбора
3. Ты правишь / спрашиваешь альтернативы / уточняешь
4. Ассистент обновляет черновик   →  (2-4 круга до согласия)
5. Ты говоришь approve → артефакт становится active
6. Ассистент автоматически: извлекает термины, проверяет валидацию, каскадит связи
```

Три следствия, которые снимают почти все вопросы новичка:

- **Ассистент делает, ты решаешь.** Ты не пишешь артефакты руками — ты направляешь и одобряешь.
- **Approve — не формальность.** Он означает «это соответствует реальности», а не «красиво выглядит».
- **Это сессии, а не бесконечный чат.** У каждой команды есть чёткий вход и выход. Можно прервать и вернуться (`--continue`).

> Полнее — [`00-concepts.md`](00-concepts.md) и первоисточник [`docs/pmo/processes.md §1`](../pmo/processes.md).

---

## 2. Весь маршрут одним взглядом

```
/product:init  →  /product:plan  →  /product:feature  → [/design:start]  →  /product:handoff
   Discovery        Planning          Feature-спека      (если has_ui)        передача
      │                │                   │                                      │
  PS·MR·CA          MVP·RM·RL          SC·BR·LC·VC·IC        MK·DS·NM           handoff.md
  SEG·VP·HYP        FM-скелеты         (+ RPM, NFR)                                 │
                                                                                    ▼
                                              /integrator:add cc-sdd  →  /orchestrator:run
                                                  (подключить                 (имплементация:
                                                   реализатор)              P3→P4→P5→P6 → GO/NO-GO)
```

**Порядок мягко принуждается prereq-гейтами** (см. §8): `plan` не пойдёт без Discovery, `feature` — без запланированной FM, `handoff` — без готовой фичи. Это не ошибки, а перила.

> **Что работает сегодня:** Discovery (Quick), Planning, Feature, Handoff, Design (при `has_ui`), Integrator, Orchestrator P3→P6 — рабочие. `--deep` Discovery и часть maintenance — частично/в плане; актуальный статус всегда в [ROADMAP](../../ROADMAP.md#где-мы-сейчас) и на карте (фильтр «работает сегодня»).

---

## 3. Шаг 1 — Discovery: `/product:init`

Запускаешь с идеей в одну фразу:

```
> /product:init "Инструмент для фрилансеров-переводчиков"

[Ассистент]
Discovery Session started. Mode: [Q]uick | [D]eep | [C]onfig?
> Q

[Ассистент]
D1.1 Problem Discovery. Несколько вопросов...
Q1: Кто основной страдающий? (фрилансеры, клиенты, агентства?)
Q2: В чём главная боль — коммуникация, организация, оплата, качество?
Q3: Сколько клиентов ведёт типичный переводчик параллельно?
...
> [отвечаешь на 5-8 вопросов]

[Ассистент]
Draft Problem Statement готов:
[показывает черновик PS]
Iteration 1 — что поправить?
> [правки]
...
> approve

[Ассистент]
✓ G1 passed. PS → active (version 1).
✓ BG extraction: 3 кандидата-термина в очереди.
Continuing to D1.2 Market Research (Quick, ~15 мин)...
```

**Что происходит дальше по сессии** (ассистент ведёт сам, ты одобряешь на гейтах):

| Гейт | Шаг | Что одобряешь | Уровень |
|---|---|---|---|
| **G1** | Problem Discovery | `PS` (проблема) → active | 🟠 явный approve |
| ⚙️ | Market Research, Competitive Analysis | копятся в черновиках | — |
| **G4** | Segments & JTBD | `SEG-*` (для кого) → active | 🟠 по каждому |
| **DRC** | Discovery Review Checkpoint | `MR` + `CA` пакетом (`[3] Approve обе`) | 🟡 batch |
| **G4a** | Value Proposition | `VP-*` (ценность) → active | 🟠 по каждому |
| **G5** | Hypothesis | `HYP-*` (гипотезы) → testing | 🟠 по каждому |

**После шага в `.product/`:** `problem.md`, `market-research.md`, `competitive-analysis.md`, `segments/SEG-*`, `value-propositions/VP-*`, `hypotheses/HYP-*`.

> Прервался? `/product:init --continue` продолжит с последнего гейта.

---

## 4. Шаг 2 — Planning: `/product:plan`

Когда Discovery закрыта:

```
> /product:plan
```

Здесь нет нумерованных гейтов — **approve по каждому артефакту**, и каждый разблокирует следующий:

- `MVP` (что в первой версии) → approve → разблокирует `RM`
- `RM` (дорожная карта) → approve → можно создавать `RL-*`
- `RL-001` (первый релиз) → approve → создаются **скелеты FM** (записи фич)
- approve каждого скелета `FM-*` → по этой фиче открывается Шаг 3

**После шага:** `mvp-scope.md`, `roadmap.md`, `releases/RL-001-*`, `features/FM-001-*…` (пока скелеты — без поведенческой спеки).

---

## 5. Шаг 3 — Feature Definition: `/product:feature FM-NNN`

Берём конкретную фичу (по её FM-id) и насыщаем поведением:

```
> /product:feature FM-003

[Ассистент]
Loading FM-003 context...
- SEG-001 (freelancers), HYP-001 (conversion), Priority MUST
- has_ui=true → Design Module можно запустить параллельно

Let's start with Scenario Authoring.
F.2.1: Main flow — получение правки по email?
[предлагает draft SC-005, 6 шагов]
> [правишь шаг 4, добавляешь alt-flow]

[Ассистент]
Updated. Добавил alt-flow SC-005a.
Approve SC-005? > Y
✓ SC-005 → active.
✓ BG: термины "Revision", "Client email", "Project" в очередь.
✓ Cascade: FM-003.scenarios[] обновлён (двусторонняя ссылка).

Extracting Business Rules from SC-005...
[BR-010, BR-012 кандидаты]
```

Порядок насыщения (каждый approve открывает следующий):

```
SC (сценарии) → BR (бизнес-правила) → LC (жизненные циклы) → VC (критерии проверки) → IC (инварианты)
                                                                              ↓
                                                       все approve → разблокируется /product:handoff
```

**Важное про критический уровень:** `BR` и `IC` — 🔴 Critical. На них автоматически запускается **DA-ревью** (Devil's Advocate, в изолированном контексте — ищет слабости до того, как ты вложишься в имплементацию). Это нормальная часть потока, не ошибка:

```
[Ассистент]
BR-010 active. Cascade check:
  - SC-005: двусторонняя ссылка ✓
  - IC-003: P-RULE-01 — DA review требуется до active
Pending: IC-003 DA review (triggered by BR-010).
Continue to F.5 IC identification? [Y/N]
```

**После шага:** `scenarios/SC-*`, `business-rules/BR-*`, `lifecycles/LC-*`, `verification/VC-*`, `invariants/IC-*`, обновлённый `rpm.md`. (NFR — отдельной командой `/product:nfr-review FM-003`, когда нужны нефункциональные требования.)

---

## 6. Шаг 3.5 (если есть UI) — Design: `/design:start FM-NNN`

Если у фичи `has_ui=true`, параллельно идёт Design-сессия:

```
> /design:start FM-003
```

Поток `Brief → Screens → Iterate → States → Artifacts → Export` даёт макеты (`MK`), Design System (`DS`) и навигацию (`NM`). Эти артефакты потом сами встроятся в handoff (секция §10). Если UI нет — пропусти шаг целиком.

> Деталь — [`04-ui-design.md`](04-ui-design.md) и [`docs/design-module/SPEC.md`](../design-module/SPEC.md).

---

## 7. Шаг 4 — Handoff: `/product:handoff FM-NNN`

Когда поведение фичи описано и одобрено — собираем универсальный снимок для передачи в реализацию:

```
> /product:handoff FM-003 --mode draft        # черновой: 3-блокерный DoR, status: partial
> /product:handoff FM-003 --mode production   # полный: 8-блокерный DoR, status: ready
```

`handoff.md` — это **boundary object**: самодостаточный 13-секционный markdown со встроенными выдержками артефактов и хэшами для детекции дрейфа. С ним фичу можно отдать в любой инструмент-реализатор, ничего не зная о `.product/`.

- **`--mode draft`** — пока часть готова, хочешь раннюю передачу (DoR смягчён, помечается `partial`).
- **`--mode production`** — фича готова целиком (полный Definition of Ready, `status: ready`).
- `--with-da-review` — прогнать DA перед генерацией; `--regenerate` — пересобрать версию.

**После шага:** `.product/handoffs/FM-003-handoff.md`.

---

## 8. Шаг 5 — Имплементация: `/integrator:add cc-sdd` → `/orchestrator:run`

Чтобы фича превратилась в код, нужен подключённый внешний реализатор и прогон оркестратора:

```
> /integrator:add cc-sdd        # один раз: подключить инструмент-реализатор
> /orchestrator:run batch-features-to-cc-sdd --all   # P3: handoffs → спеки cc-sdd
> /orchestrator:run audit-spec-fidelity --feature FM-003   # P4: спека ≡ .product?
> /orchestrator:run feature-to-tdd-impl --feature FM-003   # P5: имплементация через TDD
   # P5 сам делегирует P6 (validate-feature-impl) и возвращает вердикт
```

На выходе — вердикт гейта: **GO** / **NO-GO** / **MANUAL_VERIFY** (+ оси `readiness` и `conflicts`). Как их читать и что делать — [`05-implementation.md`](05-implementation.md).

> ⚠️ **Предусловие:** `/orchestrator:run` требует **активного cc-sdd** — сначала `/integrator:add cc-sdd`, иначе процесс остановится на pre-flight.

---

## 9. Когда ассистент просит approve — что это значит для тебя

Уровень ревью артефакта определяет, насколько внимательно смотреть:

| Значок | Уровень | Что от тебя |
|---|---|---|
| 🔴 | Critical (`BR`, `IC`) | Обязательное DA-ревью + impact-анализ. Смотри внимательно — это правила и инварианты, цена ошибки высокая. |
| 🟠 | Strategic (`PS`, `SEG`, `VP`, `HYP`, `MVP`, `FM`, `SC`, `MK`) | Явный approve по соответствию реальности. Главные решения. |
| 🟡 | Standard (`MR`, `CA`, `RL`, `RM`, `BG`, `DS`) | Валидируешь выводы; автоапдейты — ок с уведомлением. |
| 🟢 | Confirmation (`LC`, `RPM`, `VC`, `NM`) | Подтверждаешь корректность деривации (ассистент вывел сам). |

Правило одно: **approve = «соответствует реальности», не «выглядит хорошо».**

---

## 10. Полезное в процессе работы

| Хочу… | Команда |
|---|---|
| Понять, где я и что делать дальше | `/product:status` — дашборд + подсказки следующих действий (де-факто навигатор) |
| Проверить целостность `.product/` | `/product:validate` (добавь `--deep` для глубже) |
| Убедиться, что не уехал от PS/HYP/MVP | `/product:drift-check` |
| Разрулить накопившийся каскад | `/product:cascade --pending` |
| Зафиксировать ошибку, которую только что нашёл и починил | `/product:lesson "<что пошло не так>"` |

Полный каталог всех 43 команд («когда что») — на [карте](ecosystem-map.html).

---

## 11. Если упёрся в отказ

Команда может **отказаться выполняться** — это prereq-гейт, не баг:

- `/product:plan` отказывает → не закрыта Discovery (нет нужных артефактов).
- `/product:feature FM-NNN` отказывает → FM не в статусе `planned`, или нет SEG/VP/HYP.
- `/product:handoff FM-NNN` отказывает → нет готового FM-файла / не пройден DoR.
- `/orchestrator:run` останавливается на pre-flight → не подключён cc-sdd.

Отказ говорит, чего не хватает — сделай предыдущий шаг и вернись. Прерванную сессию почти везде продолжает `--continue`.

---

## Куда дальше

- 🗺️ **[Интерактивная карта](ecosystem-map.html)** — все команды, артефакты, пайплайн, поиск.
- 📖 Первоисточник процессов и гейтов — [`docs/pmo/processes.md`](../pmo/processes.md) (§8 command→process, §9 транскрипты).
- 🧩 Что такое каждый артефакт — [`docs/pmo/artifacts/README.md`](../pmo/artifacts/README.md).
- 📍 Что реально работает сейчас — [ROADMAP «Где мы сейчас»](../../ROADMAP.md#где-мы-сейчас).
