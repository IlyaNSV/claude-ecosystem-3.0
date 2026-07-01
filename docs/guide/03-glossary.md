<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source of truth: docs/pmo/artifacts/*.md (H1 names) + docs/guide/ecosystem-map.overlay.json (tier/lineage/glossary).
     Regenerate: node dev/meta-improvement/scripts/gen-glossary.cjs -->

# Глоссарий — артефакты и сквозные термины

> **Сгенерирован** из спеков артефактов (`docs/pmo/artifacts/*.md`) и редакторского overlay — не править руками, перегенерировать: `node dev/meta-improvement/scripts/gen-glossary.cjs`. Ревью-уровни: 🔴 Critical · 🟠 Strategic · 🟡 Standard · 🟢 Confirmation (подробно — [00-concepts §5](00-concepts.md)). «Питает» — какие артефакты выводятся из этого (полная родословная — [artifacts/README](../pmo/artifacts/README.md)). Интерактивно — [ecosystem-map.html](ecosystem-map.html).

**Типов артефактов: 24** + сквозные термины, домены и вердикты.

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
| **D1–D6** | Шесть управленческих доменов PMO: Discovery → Behavioral → Tech → Build → QA → Ops/Meta. |
| **handoff.md** | Универсальный 13-секционный snapshot фичи — самодостаточная передача в любой реализатор. |
| **DoR** | Definition of Ready — критерий готовности handoff (draft = 3 блокера, production = 8). |
| **DA** | Devil's Advocate — adversarial-ревью в изолированном контексте перед вложением в имплементацию. |
| **BG** | Business Glossary — сквозной словарь; пополняется из любого артефакта, каскадный rename. |
| **cc-sdd** | Внешний spec-driven инструмент-реализатор; подключается через /integrator:add. |
| **GO / NO-GO** | Вердикт Orchestrator-гейта; третий исход — MANUAL_VERIFY (нужна ручная проверка). |
| **has_ui** | Флаг фичи: есть ли интерфейс. true → включается Design Module. |
| **confidence** | Поле уверенности ассистента в артефакте (high/medium/low) — основа авто-approve и анти-дрифта. |
| **tier / review** | Уровни ревью: 🔴 Critical, 🟠 Strategic, 🟡 Standard, 🟢 Confirmation — определяют, когда нужен approve. |
| **P1–P5** | Процессы Product Module: Discovery, Planning, Feature, Handoff, Maintenance. |
| **P3–P6 (orch.)** | Процессы Orchestrator: batch→specs, audit-fidelity, tdd-impl, validate-impl. |
| **gate / хук** | Детерминированный enforcement: PreToolUse/PostToolUse/commit-msg/Stop хуки, блокирующие (🔒) или warn-only. |
| **tier-based activation** | pilot/mvp/full — какие правила валидации работают inline на каждой стадии продукта. |

