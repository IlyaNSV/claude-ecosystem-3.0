---
doc_type: reference
---
<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source of truth: docs/pmo/artifacts/*.md (H1 names) + docs/guide/ecosystem-map.overlay.json (tier/lineage/glossary).
     Regenerate: node dev/meta-improvement/scripts/gen-glossary.cjs -->

# Глоссарий — артефакты и сквозные термины

> **Сгенерирован** из спеков артефактов (`docs/pmo/artifacts/*.md`) и редакторского overlay — не править руками, перегенерировать: `node dev/meta-improvement/scripts/gen-glossary.cjs`. Ревью-уровни: 🔴 Critical · 🟠 Strategic · 🟡 Standard · 🟢 Confirmation (подробно — [00-concepts §5](00-concepts.md)). «Питает» — какие артефакты выводятся из этого (полная родословная — [artifacts/README](../pmo/artifacts/README.md)). Интерактивно — [ecosystem-map.html](ecosystem-map.html).

**Типов артефактов: 24** + оси именования, домены, сквозные термины и вердикты.

## Оси именования — какой «D…»/«P…» о чём

> Экосистема нумерует РАЗНЫЕ вещи похожими метками (`D…`, `P…`, домены, уровни). Эта таблица разводит оси — чтобы `D2` (домен пайплайна) не путать с `D.2` (шаг Design), а `P4` Product — с `P4` Orchestrator.

| Ось | Что нумерует | Значения | Не путать с |
|---|---|---|---|
| **D1–D6** | Шесть управленческих доменов PMO (Discovery → Governance) | D1 Discovery · D2 Requirements&Design (сплит B/T/UI) · D3 Build · D4 QA · D5 Ops · D6 Meta/Governance | `D.1–D.6` (шаги Design) · `D1.1–D1.9` (шаги Discovery) · `D2-B01…` (обязанности PMO) |
| **D.1–D.6 (с точкой)** | Шаги сессии `/design:start` (Design Module) | D.1 Brief · D.2 Screens · D.3 Iterate · D.4 States · D.5 Artifacts · D.6 Export | `D1–D6` — домены пайплайна (без точки) |
| **D1.1–D1.9** | Упорядоченные шаги Discovery/Planning-сессии | D1.1 Problem · D1.4a VP · D1.5 Hypothesis · D1.6 MVP · D1.9 Prioritization | домен `D1` · шаг `D.1` (Design) |
| **D2-B## / D2-T## / D3-##** | Функциональные обязанности-роли внутри доменов PMO | D2-B01…B05 (B04 = UX/UI) · D2-T01…T08 · D3-01…07 · D4-01…07 | `D2-B`/`D2-UI` как ДОМЕН артефактов — это группа, не роль |
| **Принципы P1–P7** | Семь принципов паттерна draft→approve (философия) | P1 Assistant-led · P2 Iterative>waterfall · P4 Approve≠формальность · P5 Post-approve automation · P7 Transparent escalation | процессы `P1–P5` Product · `P1–P7` Orchestrator — это НЕ философия |
| **Процессы Product P1–P5** | Процессные семейства Product Module | P1 Initialization (Discovery+Planning) · P2 Feature · P3 Feedback (stub) · P4 Cascade · P5 Periodic Review | принципы `P1–P7` · Orchestrator `P1–P7`. В картах — суффикс `p` (`P4p`) |
| **Процессы Orchestrator P1–P7** | Рантайм-процессы Orchestrator | P1 init · P2 decide-architecture · P3 batch→cc-sdd · P4 audit-fidelity · P5 tdd-impl · P6 validate-impl · P7 runtime-smoke | Product `P1–P5`. В картах — суффикс `o` (`P4o`); оператор обычно видит `P3o–P6o` (+P7-leg внутри P6) |
| **Артефакты — 24 типа** | ID-префиксы типов артефактов PMO | PS MR CA SEG VP HYP MVP RM RL · FM · SC BR LC RPM VC IC NFR · MK DS NM AM · BG NOTE LESSON | `MVP`-тип ≠ стадия продукта ≠ `validation_tier=mvp` |
| **Домены артефактов** | Группировка 24 артефактов в карте/глоссарии | D1 · bridge (FM) · D2-B · D2-UI · cross | домены пайплайна `D1–D6` (имена частично пересекаются) |
| **Модули** | Top-level модули / namespace команд | Product · Design · Integrator · Orchestrator · Ecosystem | `D6` Meta: Ecosystem Governance (управление PMO проекта — Integrator Module + человек) ≠ `D7` meta-improvement (разработка самой экосистемы — dev-only, НЕ деплоится). Разные слои, не синонимы |
| **Уровни ревью** | Строгость approve-ревью артефакта | 🔴 Critical · 🟠 Strategic · 🟡 Standard · 🟢 Confirmation | `validation_tier` · `product_tier` — тоже зовутся «tier» |
| **product_tier / validation_tier** | Зрелость продукта / охват inline-валидации | product_tier: ИДЕЯ→MVP→MMP→GROWTH→MATURE · validation_tier: pilot / mvp / full | review-уровни 🔴🟠🟡🟢 (третий смысл слова «tier») |
| **Вердикты Orchestrator** | Исход гейта — две независимые оси + conflicts | result: GO / NO-GO / MANUAL_VERIFY · readiness: READY / DEGRADED / ENV_NOT_READY · conflicts[] понижает GO→MANUAL_VERIFY | — |
| **Гейты Discovery** | Named approve-гейты Discovery-сессии | G1 · G4 · G4a · G5 · DRC (нумерация с пропусками — `G2`/`G3` НЕТ) | — |
| **Лестницы L#** | Два несвязанных «L»-масштаба | L0–L5: уровни понимания в `guide/README` · L0–L2: зум App Map (AM→NM→MK) | друг с другом; «autonomy L0/L1» в доках НЕТ |

## D1 · Discovery & Strategy

| ID | Название | Ревью | Питает |
|---|---|---|---|
| `PS` | Problem Statement | 🟠 | MR, CA, SEG, VP, HYP, MVP |
| `MR` | Market Research | 🟡 | SEG, VP |
| `CA` | Competitive Analysis | 🟡 | VP |
| `SEG` | Segment & JTBD | 🟠 | VP, FM, RPM |
| `VP` | Value Proposition | 🟠 | HYP, FM |
| `HYP` | Hypothesis | 🟠 | MVP, FM |
| `MVP` | MVP Scope | 🟠 | RM, RL, FM |
| `RM` | Product Roadmap | 🟡 | RL |
| `RL` | Release Plan | 🟡 | FM |

## Мост D1↔D2

| ID | Название | Ревью | Питает |
|---|---|---|---|
| `FM` | Feature Map Entry | 🟠 | SC, BR, LC, VC, IC, RPM, MK |

## D2-Behavioral

| ID | Название | Ревью | Питает |
|---|---|---|---|
| `SC` | User Scenario | 🟠 | BR, LC, VC, AM |
| `BR` | Business Rule | 🔴 | LC, VC, IC |
| `LC` | Entity Lifecycle Model | 🟢 | VC, IC |
| `RPM` | Role & Permission Model | 🟢 | — |
| `VC` | Verification Criteria | 🟢 | — |
| `IC` | Invariant Check | 🔴 | — |
| `NFR` | Non-Functional Requirement | 🟠 | — |

## D2-UI · Design (has_ui)

| ID | Название | Ревью | Питает |
|---|---|---|---|
| `MK` | Mockup Package | 🟠 | DS, NM, AM |
| `DS` | Design System | 🟡 | — |
| `NM` | Navigation Map | 🟢 | AM |
| `AM` | App Map (карта приложения + CJM-слой) | 🟢 | — |

## Cross-cutting

| ID | Название | Ревью | Питает |
|---|---|---|---|
| `BG` | Business Glossary | 🟡 | — |
| `NOTE` | Unstructured Note | 🟡 | FM, SC, BR, IC, NFR, HYP |
| `LESSON` | Corrective Lesson | 🟡 | — |

## Сквозные термины и вердикты

| Термин | Значение |
|---|---|
| **D1–D6** | Шесть управленческих доменов PMO: D1 Discovery → D2 Requirements&Design (сплит B/T/UI) → D3 Build → D4 QA → D5 Ops → D6 Meta/Governance. Раскладка и владение (owned / delegated) — SSOT docs/pmo/pmo-map.md. |
| **handoff.md** | Универсальный 13-секционный snapshot фичи — самодостаточная передача в любой реализатор. |
| **DoR** | Definition of Ready — критерий готовности handoff (draft = 3 блокера, production = 8). |
| **Release DoD** | Definition of Done релиза — терминальный предикат релизного цикла: ссылочный 6-категорийный чеклист (опциональная body-секция RL, soft-миграция); зелёный DoD + owner ratify — единственный легитимный выход в released. SSOT шаблона — docs/pmo/artifacts/RL.md. |
| **DA** | Devil's Advocate — adversarial-ревью в изолированном контексте перед вложением в имплементацию. |
| **BG** | Business Glossary — сквозной словарь; пополняется из любого артефакта, каскадный rename. |
| **cc-sdd** | Внешний spec-driven инструмент-реализатор; подключается через /integrator:add. |
| **GO / NO-GO** | Вердикт Orchestrator-гейта; третий исход — MANUAL_VERIFY (нужна ручная проверка). |
| **has_ui** | Флаг фичи: есть ли интерфейс. true → включается Design Module. |
| **confidence** | Поле уверенности ассистента в артефакте (high/medium/low) — основа авто-approve и анти-дрифта. |
| **tier / review** | Уровни ревью: 🔴 Critical, 🟠 Strategic, 🟡 Standard, 🟢 Confirmation — определяют, когда нужен approve. |
| **P1–P5 (Product)** | Процессы Product Module: P1 Initialization (Discovery+Planning), P2 Feature, P3 Feedback (stub), P4 Cascade, P5 Periodic Review. |
| **P3–P6 (orch.)** | Процессы Orchestrator: batch→specs, audit-fidelity, tdd-impl, validate-impl. |
| **gate / хук** | Детерминированный enforcement: PreToolUse/PostToolUse/commit-msg/Stop хуки, блокирующие (🔒) или warn-only. |
| **tier-based activation** | pilot/mvp/full — какие правила валидации работают inline на каждой стадии продукта. |

