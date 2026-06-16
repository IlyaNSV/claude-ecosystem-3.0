# Handoff Specification — Product Module → External Tool

> **Версия:** 1.0 (2026-04-18)
> **Закрывает:** Q-06 из аудита
> **Роль в экосистеме:** разблокирует tool-agnostic принцип (DEC-A06) — определяет универсальный формат передачи от Product Module в любой внешний implementation-инструмент.
> **v1 modifications:** D1 (handoff modes — draft/production с разным DoR); D2 (approve_overrides интегрированы в DoR processing).

## 1. Purpose

Handoff — **универсальный self-contained snapshot** фичи, передаваемый из Product Module во внешний реализатор. Отвечает на запрос: «Я не знаю, кто ты, но вот тебе всё, что нужно знать о продукте, чтобы выполнить свою зону работы».

### Что handoff НЕ делает

- Не заменяет артефакты в `.product/` — это snapshot, не source of truth
- Не специфицирует реализацию (стек, библиотеки, архитектуру)
- Не передаёт между внешними инструментами (эти handoff'ы проектирует Integrator)
- Не включает бизнес-стратегию верхнего уровня (PS, SEG полные) — только контекст, релевантный фиче

### Зоны ответственности в handoff-цепочке

```
┌────────────────────┐      ┌────────────────┐      ┌──────────────┐
│  Product Module    │ ───▶ │  Handoff.md    │ ───▶ │  Adapter     │
│  (генерирует)      │      │  (universal)   │      │  (Integrator)│
└────────────────────┘      └────────────────┘      └──────┬───────┘
                                                           │
                                                           ▼
                                                   ┌──────────────┐
                                                   │ External tool│
                                                   │ (cc-sdd/Kiro)│
                                                   └──────────────┘
```

- **Product Module** генерирует handoff через `/product:handoff <FM-ID>`
- **Handoff** — единый markdown-файл с embedded excerpts всех relevant артефактов
- **Adapter** (разрабатывается Integrator при `/integrator:add <tool>`) трансформирует universal handoff в формат, понятный конкретному инструменту
- **External tool** консумирует adapter output и делает свою работу

## 2. Принципы

**P1: Self-contained.** Handoff содержит embedded excerpts (полные копии) всех relevant артефактов. Внешний инструмент НЕ обязан иметь доступ к `.product/` для минимального понимания.

**P2: Immutable snapshot.** Handoff фиксирует состояние на момент генерации через SHA-хеши артефактов. При изменении `.product/` handoff НЕ обновляется автоматически — нужна явная регенерация.

**P3: Human + machine readable.** Markdown с структурированным YAML frontmatter. Человек может прочитать; адаптер может программно извлечь.

**P4: Receiver-agnostic.** Формат не подразумевает конкретный инструмент. Трансформация под инструмент — работа adapter.

**P5: DoR-gated.** Handoff не генерируется, пока не пройдены блокирующие условия Definition of Ready.

**P6: Versioned.** Каждая регенерация handoff инкрементирует version. Старые versions остаются в git.

**P7: Drift-aware.** Handoff знает, актуален ли он относительно `.product/` через hash-сравнение. При drift — warning при попытке использования.

## 3. Handoff Lifecycle

```
FM skeleton (planned)
    │
    │ (enrichment через /product:feature)
    ▼
FM in-progress + SC/BR/LC/VC/IC/MK созданы
    │
    │ /product:handoff <FM-ID>
    │   1. DoR check
    │   2. Embed excerpts
    │   3. Compute hashes
    │   4. Generate handoff.md
    ▼
Handoff status=ready (snapshot зафиксирован)
    │
    │ External tool consumes (via adapter)
    ▼
Implementation work proceeds
    │
    │ (later) FM changes → /product:handoff --regenerate
    ▼
Handoff v2 (prev archived in git)
```

### События при /product:handoff

1. **Pre-check:** Environment Scanner от Integrator (OQ-I12) проверяет, что все необходимые артефакты существуют
2. **DoR validation:** все блокирующие условия выполнены (см. §7)
3. **Excerpt extraction:** из `.product/` собираются relevant секции
4. **Hash computation:** SHA каждого включённого артефакта фиксируется в frontmatter
5. **Generation:** файл `.product/handoffs/FM-<NNN>-handoff.md` создаётся или обновляется
6. **Journal entry:** запись в decision journal Integrator (если adapter уже существует)

### Регенерация

Триггеры:
- Ручной запрос: `/product:handoff <FM-ID> --regenerate`
- Auto-prompt при drift detection (handoff устарел относительно артефактов)
- FM status change (планируется → in-progress → shipped)

Регенерация всегда **полная** (не patch). Versioning через git + frontmatter.

## 4. Файловый формат

### Расположение

`.product/handoffs/FM-<NNN>-handoff.md`

Один handoff на фичу. Старые версии — в git history (никакого manual archiving).

### Именование

- **Feature handoff:** `FM-<NNN>-handoff.md`
- **Bundle handoff** (для release с несколькими фичами): `RL-<NNN>-handoff.md` — содержит ссылки на FM-handoff'ы + release-level context

### Наследование

Release handoff включает FM handoff'ы как sub-sections (embedded), не references:

```
RL-001-handoff.md
├── Release metadata
├── Release goals / HYP validation plan
├── Features included:
│   ├── FM-001 (full FM-001-handoff.md content embedded)
│   ├── FM-003 (full embedded)
│   └── FM-005 (full embedded)
├── Cross-feature dependencies
└── Release-level NFR
```

## 5. Frontmatter Schema

```yaml
---
# Identity
id: HANDOFF-FM-<NNN>                   # HANDOFF-FM-003
type: feature-handoff                   # или release-handoff для RL-*
feature: FM-<NNN>                       # или release: RL-<NNN>
title: "Человеко-читаемое имя"

# Status
status: ready | blocked | partial | stale
mode: production | draft                # D1 modification — handoff mode
version: 1                              # инкрементируется per регенерация
generated_at: 2026-06-15T14:30:00Z
generator: product-module-v1.0          # какая версия Product Module создала
dor_overrides:                          # D2 modification — список применённых approve_overrides
  - artifact: FM-007
    rule: V-H-08
    reason: "PoC stage — UI добавим в v0.2"
    approved_by: human
    approved_at: 2026-04-18T15:30

# Validation
dor_validation_passed: true | false
blocking_issues: []
warnings: []
validation_rules_passed: [V-H-01, V-H-02, ...]
validation_rules_failed: []

# References (what's embedded)
embedded_artifacts:
  feature: FM-003
  scenarios: [SC-005, SC-006, SC-007, SC-008]
  business_rules: [BR-010, BR-011, BR-012, BR-013]
  lifecycles: [LC-002]
  verifications: [VC-005, VC-005a, VC-006, VC-007]
  invariants: [IC-003]
  rpm_roles_excerpted: [R-freelancer, R-client, R-system-scheduler]
  bg_terms_excerpted: [Project, Revision, Revision batch, Client, Freelancer]
  mockup_packages: [MK-003]            # только если has_ui=true
  navigation_maps: [NM-003]
  design_system_tokens_snapshot: DS@v2 # ссылка на DS version

# Snapshot integrity (SHA for drift detection)
artifact_hashes:
  FM-003: "sha256:abc123..."
  SC-005: "sha256:def456..."
  SC-006: "sha256:..."
  BR-010: "sha256:..."
  # ... все embedded артефакты

# Product context (DEC-DEV-0079 — derived from product.yaml; advisory hint, NOT a stack directive)
# Omitted entirely if product.yaml.product_class.archetype == unset (pre-0079 / not set).
product_class:
  archetype: web-service
  runtime_locus: server
  interface: api
  distribution: saas
  data_sensitivity: pii                 # optional

# Target information
target_adapter: "universal"             # или конкретный: "cc-sdd", "kiro", "custom-langraph"
target_tool: null                       # null пока не передан в конкретный инструмент
target_tool_version: null

# Lineage
previous_version: null                  # или HANDOFF-FM-003-v1 если regeneration
regenerated_from: "artifact_changes" | "manual" | "drift_detection"

# Metadata
created: 2026-06-15
updated: 2026-06-15
---
```

## 6. Body Structure

Handoff имеет **13 обязательных секций** в фиксированном порядке. Необязательные секции помечены `(optional)`. Секции с `(conditional)` зависят от флагов FM (has_ui, etc.).

### Раздел 1: Executive Summary (MUST)

Краткое описание фичи для реализатора, который приходит без контекста. 3–5 предложений.

**Шаблон:**
```markdown
## Executive Summary

**Feature:** <FM title>
**Delivers value to:** <SEG primary> solving <JTBD primary>
**Validates hypothesis:** <HYP primary> (success = <metric>)
**Release:** <RL-NNN>, target <target_date>
**Has UI:** yes/no
**Product class:** <archetype> (<runtime_locus> / <interface> / <distribution>) — *advisory; форма продукта, не стек* (DEC-DEV-0079)
**Critical dependencies:** <list of other FMs>

Brief 2-3 sentence explanation of what the feature does and why it matters.

> Строка `Product class` опускается, если `product.yaml.product_class.archetype` = `unset`
> (проект до DEC-DEV-0079 или класс не задан) — receiver тогда выводит форму сам, как раньше.
```

### Раздел 2: Business Context (MUST)

Embedded excerpt из FM, плюс relevant excerpts из SEG, VP, HYP.

**Содержит:**
- FM full content (why, what brief, success metric)
- SEG excerpt: только имя сегмента + релевантные JTBD (не вся SEG)
- VP statement (одно предложение)
- HYP statement + success/invalidation thresholds

**НЕ содержит:**
- Полный MR, CA, PS (overkill для реализатора; он не принимает бизнес-решений)
- Другие FM (только ссылки если есть dependency)

### Раздел 3: Terminology (MUST)

**Выжимка из BG** — только термины, используемые в embedded SC, BR, LC, IC.

**Формат:** таблица (Term → Definition), в алфавитном порядке, с пометкой «Alternative terms to avoid».

**Зачем:** реализатор должен именовать переменные, API поля, UI labels **ровно** так, как записано в BG. Консистентность между бизнесом и кодом.

### Раздел 4: Role & Permission Model (MUST)

**Выжимка из RPM** — только роли, участвующие в этой фиче + их actions.

**Содержит:**
- Список релевантных ролей с описаниями
- Permission matrix, отфильтрованная до actions фичи
- Conditional permissions со ссылками на embedded BR

### Раздел 5: Scenarios (MUST)

**Embedded full content всех SC фичи.**

Each SC:
- Frontmatter метаданные
- Actors, Preconditions, Trigger
- Steps (полностью, с BR references inline)
- Postconditions
- Related alternative/error flows (также embedded, если они — part of feature)

### Раздел 6: Business Rules (MUST)

**Embedded full content всех BR фичи.**

Each BR:
- Statement (формальная формулировка)
- Context
- Parameters (с текущими значениями)
- Rationale
- Edge cases

### Раздел 7: Entity Lifecycles (MUST)

**Embedded full content всех LC, затронутых фичей.**

Each LC:
- Entity definition
- States list with business-level descriptions
- State diagram (mermaid)
- Transitions table
- Guards (BR references)

### Раздел 8: Verification Criteria (MUST)

**Embedded full content всех VC фичи.**

Each VC:
- Given/When/Then
- Expected outcomes
- Rules verified
- Lifecycle transitions verified
- Negative assertions

**Важно:** VC — это то, что реализатор должен обеспечить. Тесты, которые будут написаны внешним инструментом (или через INT-12 в будущем), выводятся из VC.

### Раздел 9: Invariants (MUST)

**Embedded full content всех IC, релевантных фиче.**

Each IC:
- Invariant statement
- Severity
- Supporting rules
- Detection method
- Recovery strategy

**IC важнее BR для implementation:** IC показывает, что сломается при любой ошибке; реализатор должен знать границы данных.

### Раздел 10: UI Specification (CONDITIONAL — только если FM.has_ui=true)

**Embedded:**
- Все MK-* фичи (полный Design Package)
- Relevant Design System tokens snapshot (только те, что используются в MK)
- NM-* фичи (Navigation Map)

**Reference (не embedded):**
- Full DS (слишком большой; реализатор может получить через Integrator, если нужно)
- Tool-specific макеты (stitch URL, figma URL — есть в MK frontmatter)

### Раздел 11: Non-Functional Requirements (MUST — три состояния)

**Состояние (OQ-03 закрыт, opt-in philosophy per DEC-NFR-F08):** NFR-* введён как 21-й тип артефактов. Определение NFR — **опциональная** часть P2 (F.5a); FM может осознанно отказаться.

**Формат секции зависит от `FM.nfr_status`:**

#### Case A: `nfr_status=active` (NFR явно определены)

**Embedded содержимое:**
- Все NFR-*, на которые ссылается FM.frontmatter.nfr[] (per-feature scope)
- Global NFR-*, применимые к продукту в целом (scope=global) — выжимка

**Для каждого embedded NFR:**
- Full body: Statement, Target value (с tier), Rationale, Measurement method, Anti-target, Test strategy, Known tradeoffs, Tier upgrade plan

**Receiver guidance:**
- «NFR target'ы — acceptance baselines для tier=<tier>, не enterprise SLA.»
- «При невозможности достичь target — verify через `/product:nfr-review` с автором, а не overpromise.»

#### Case B: `nfr_status=declined` (осознанно использовать defaults)

**Содержимое секции:**

```markdown
## 11. Non-Functional Requirements

**Status:** NFR Review explicitly declined for this feature (2026-06-15).

**Rationale (from FM):** «MVP pilot, small audience (~20 freelancers), 
applying Ecosystem 3.0 MVP default NFR ranges.»

**Applicable defaults (MVP tier):**
- Performance: p50 <3s, p95 <8s
- Reliability: 95% monthly uptime; recovery <24h ok
- Scalability: 10-50 concurrent users
- Security: TLS 1.2+, bcrypt passwords, standard OAuth
- Privacy: minimise PII collection, manual data deletion within weeks

**Full sanity ranges:** see Ecosystem 3.0 NFR.md §5 (published with handoff).

**Receiver guidance:**
- Implement with MVP defaults as baseline
- Flag any performance/reliability gaps to author through /product:clarify
- Do NOT silently over-engineer beyond defaults (e.g., do not add caching 
  "just in case" without discussion)
```

#### Case C: `nfr_status=pending` (не рассматривалось; warning)

**Содержимое секции:**

```markdown
## 11. Non-Functional Requirements

⚠ **Status:** NFR Review was NOT conducted for this feature.

This is a known gap. Handoff proceeds with warning.

**Receiver guidance:**
- Apply most conservative MVP defaults from NFR.md §5
- Escalate back via /product:clarify если увидите critical concerns
- Author should run /product:nfr-review FM-xxx at next opportunity
```

При `nfr_status=pending`:
- V-H-08 DoR check поднимает Warning (не блокирует)
- В handoff frontmatter `warnings[]` добавляется запись
- Handoff.status = `partial` (не `ready`)

#### Frontmatter extension в handoff

```yaml
embedded_artifacts:
  # ... existing
  nfr: [NFR-001, NFR-004]              # per-feature + global relevant (Case A)
  # OR
  # nfr: []                            # Case B/C — пусто
nfr_status: active | declined | pending   # из FM
nfr_decline_reason: "..."                 # Case B
current_product_tier: mvp                 # для context
```

#### Общий принцип для receiver

Secция 11 **всегда присутствует**. Receiver не должен предполагать, что её отсутствие = «NFR не нужны». 

Встретив handoff:
- **Case A:** использовать embedded NFR как test criteria
- **Case B:** использовать MVP defaults; не over-engineer
- **Case C:** эскалировать обратно автору до начала работы (это warning)

### Раздел 12: Dependencies & Context (MUST)

Что реализатор должен знать о внешнем контексте:

- **Feature dependencies:** другие FM, которые должны быть shipped раньше
- **External integrations:** с какими системами интегрируется (payment, email, storage)
- **Data assumptions:** на каких данных работает (uploads? migrations?)
- **Environment prerequisites:** какие services/DB/queues должны быть доступны
- **Product class (advisory, DEC-DEV-0079):** форма продукта из `product_class` (см. §1 +
  frontmatter). Ожидаемые типы тестов и инфра-shape для этого класса — в
  `docs/pmo/product-class-taxonomy.md §6`. Это **подсказка, не директива**: выбор стека,
  библиотек и реализации остаётся за D2-T (см. AP-9). Опускается, если класс = `unset`.

### Раздел 13: Out of Scope (MUST)

**Явный список** того, что НЕ должно быть реализовано в этой фиче:
- Чтобы избежать scope creep
- Чтобы внешний инструмент не занимался "на всякий случай"
- С причиной для каждого (отложено / другая фича / никогда)

### (optional) Раздел 14: Rollout Notes

Если фича feature-flag-protected, beta-only, gradual rollout — детали здесь. Обычно живёт в RL handoff, а не в FM handoff.

### (optional) Раздел 15: Open Questions for Receiver

Если у реализатора возникнут вопросы — как их задавать. Обычно: «вернуть в Product Module через `/product:clarify <FM-NNN>`».

## 7. Definition of Ready (DoR)

Handoff генерируется при выполнении DoR. **DoR mode-aware** (D1 modification): `production` mode требует все 8 blockers; `draft` mode — минимальные 3.

### 7.1 Production mode (default — `--mode production`)

Все блокирующие условия должны быть выполнены. Нарушение → `status=blocked`, файл не создаётся.

| # | Условие | Source | Production | Draft |
|---|---|---|---|---|
| B1 | FM.status == `in-progress` | FM frontmatter | 🔴 required | 🔴 required |
| B2 | Минимум один SC в status=`active` | scenarios list | 🔴 required | 🔴 required |
| B3 | Все BR, упомянутые в embedded SC, существуют и status=`active` | cross-check | 🔴 required | 🟡 warning |
| B4 | Для каждого SC существует минимум один VC в status=`active` | VC coverage | 🔴 required | 🟡 warning |
| B5 | BG содержит все термины, жирно выделенные в embedded артефактах | extraction check | 🔴 required | 🔴 required |
| B6 | Валидации V-01..V-11 passed | validation run | 🔴 required | 🟡 warning |
| B7 | Если has_ui=true — минимум один MK в `active` + NM для основных flows | UI check | 🔴 required | 🟡 warning |
| B8 | RPM содержит все роли из SC.actors | RPM check | 🔴 required | 🟡 warning |

### 7.2 Draft mode (`--mode draft`)

Используется для **PoC / early experiments** — когда фича недоопределена, но нужно передать в external tool для feedback.

**Required (только 3):** B1, B2, B5 (FM in-progress, ≥1 SC active, BG covers terms).

**Все остальные** становятся warnings (не блокируют). Сгенерированный handoff:
- `status: partial`
- `mode: draft` в frontmatter
- В body — secция «⚠ Draft Mode Warnings» с явным списком missing blockers
- Receiver видит explicit warning и понимает, что это experimental snapshot

**Use case:** «Хочу передать FM-007 в cc-sdd для эксперимента с архитектурой, понимая что VC ещё не написаны и DoR не полный.»

### 7.3 D2 modification: approve_overrides в DoR

Если артефакт имеет `approve_overrides[]` для blocking rule — DoR check учитывает override:
- Override valid (не expired) → blocker считается passed
- Override expired → blocker fails (как обычно)
- Override присутствует → в handoff frontmatter `dor_overrides[]` логируется список применённых overrides с rationale

Receiver видит, что blocker был «overridden by author with rationale X» — может откатить handoff обсуждение если не согласен.

### Предупредительные условия (WARN, не блокируют)

| # | Условие | Последствие |
|---|---|---|
| W1 | LC определён для всех сущностей из SC | warning, handoff создаётся |
| W2 | IC определён хотя бы для ключевых инвариантов | warning |
| W3 | Если has_ui=true — DS актуален (все токены из MK present) | warning |
| W4 | NFR секция заполнена (после OQ-03) | warning until filled |
| W5 | Все BR имеют rationale | warning per BR |
| W6 | VC покрывают все flow types (main + alt + error) — V-07 | warning |

### 7.4 Специальные статусы

- **status=ready** — все production-mode B1-B8 passed, W1-W6 тоже passed или acceptable
- **status=partial** — production mode: все B1-B8 passed, но есть active W1-W6 / draft mode: required blockers passed, но не все production-level
- **status=blocked** — хотя бы одно required-per-mode blocker не выполнено; файл не генерируется
- **status=stale** — handoff существует, но artifact hashes не совпадают с текущими `.product/` (drift detected)

### 7.5 Mode comparison summary

| Сценарий | Mode | Required blockers | Status |
|---|---|---|---|
| Production handoff (default) | production | 8 | ready / partial (warn) / blocked |
| Early PoC handoff | draft | 3 | partial (always — explicit experiment) |
| Draft mode но больше прошло | draft | 3 | partial (with detail) |
| Draft mode даже базовое не прошло | draft | <3 | blocked |

## 8. Handoff Validation Rules (V-H-*)

Специфичные для handoff правила валидации (в дополнение к артефактным V-01..V-17).

| # | Правило | Уровень |
|---|---|---|
| **V-H-01** | Все секции 1-9, 11-13 присутствуют; секция 10 — conditional on has_ui | 🔴 Blocking |
| **V-H-02** | Каждый embedded артефакт имеет hash в frontmatter | 🔴 Blocking |
| **V-H-03** | Все артефакты, которые должны быть embedded (по embedded_artifacts), действительно embedded | 🔴 Blocking |
| **V-H-04** | artifact_hashes совпадают с текущими в `.product/` (drift detection) | 🟡 Warn (→ stale) |
| **V-H-05** | Все cross-references внутри handoff валидны (ссылки в SC на BR реально есть в handoff) | 🔴 Blocking |
| **V-H-06** | Frontmatter valid YAML с обязательными полями | 🔴 Blocking |
| **V-H-07** | BG excerpt содержит все жирно выделенные термины в embedded артефактах | 🟡 Warn |
| **V-H-08** | Если has_ui=true, UI Specification секция заполнена | 🔴 Blocking |
| **V-H-09** | Dependencies секция перечисляет все FM, упомянутые как prerequisites | 🟡 Warn |
| **V-H-10** | Out of Scope секция не пуста (даже если «ничего явно не excluded — это тоже info») | 🟡 Warn |
| **V-H-11** | NFR section 11 conformity: содержимое соответствует `FM.nfr_status` per три case-а в §6 Раздел 11 (active → embedded NFR; declined → rationale + tier defaults; pending → warning + receiver guidance) | 🔴 Blocking при inconsistent active/embedded или high-risk declined без rationale; 🟡 Warn при pending |

## 9. Adapter Pattern

Universal handoff — всегда один формат. Адаптация под конкретный инструмент — работа **adapter-скрипта**, который разрабатывается Integrator Module при `/integrator:add <tool>`.

### Структура adapter

Каждый adapter — это JS/Python-скрипт в `.claude/integrator/adapters/handoff-to-<tool>.js`.

**Контракт adapter'а:**

```javascript
// Pseudo-interface
interface HandoffAdapter {
  // Парсит universal handoff
  parse(handoffPath: string): Handoff;
  
  // Валидирует для target tool
  validateForTarget(handoff: Handoff): ValidationResult;
  
  // Трансформирует в формат tool'а
  transform(handoff: Handoff): ToolInput;
  
  // Пишет результат в файловую систему tool'а
  apply(toolInput: ToolInput): ApplicationResult;
}
```

### Примеры трансформаций

**Adapter: handoff → cc-sdd (/kiro:spec-init):**
- FM + Executive Summary → описание фичи для `/kiro:spec-init`
- SC + BR → `requirements.md` в EARS формате (WHEN/THEN)
- LC → `design.md` state machines section
- VC → acceptance criteria в requirements
- IC → constraints section
- RPM → roles section
- MK + DS + NM → `design.md` UI section

**Adapter: handoff → custom LangGraph pipeline:**
- Parse frontmatter + artifact_hashes → state снapshot
- Convert SC steps → node sequence
- BR → conditional edges (guards)
- LC → state variables
- VC → assertion checks в workflow

**Adapter: handoff → Cursor rules:**
- FM + BG → `.cursorrules` header with terminology
- BR → inline rules для генерации кода
- VC → test cases в comment
- MK → reference на файл с UI spec

### Fallback: no adapter

Если adapter не существует (новый инструмент ещё не интегрирован), handoff всё равно **читаем человеком/LLM-агентом** без преобразования. Это минимальный уровень поддержки — markdown с embedded информацией.

### Adapter validation

Integrator при `/integrator:verify`:
- Парсит handoff через adapter
- Сравнивает результат с эталонным (smoke test)
- При расхождении — флаг `contract broken`

## 10. Versioning & Drift Detection

### Versioning

- **version в frontmatter** инкрементируется при каждой регенерации
- **git** хранит всю историю (никаких manual archive файлов)
- **previous_version** в frontmatter указывает на предыдущую (git SHA или version number)

### Drift Detection

**Как работает:**
1. При генерации handoff — вычисляется SHA-256 каждого embedded артефакта (из текущего содержимого `.product/`)
2. Хеши хранятся в frontmatter `artifact_hashes`
3. При использовании handoff (например, Integrator'ом при add/update или при manual reference):
   - Пересчитываются актуальные хеши из `.product/`
   - Сравниваются с embedded `artifact_hashes`
4. Если есть расхождение:
   - status переходит в `stale`
   - Warning пользователю
   - Предложение регенерации

**Granularity:** per-артефакт. Можно увидеть, какие именно артефакты изменились.

**Toleration threshold:** нет. Любое расхождение — warning. (В будущем можно ввести «trivial changes» detection, но в v1 — strict.)

### Регенерация

```bash
/product:handoff FM-003 --regenerate

# Output:
# Drift detected:
#   SC-005: hash changed (added step 4a)
#   BR-010: hash changed (parameter linking_strategy changed)
# 
# Approve regeneration? (y/n)
# > y
# 
# Handoff HANDOFF-FM-003 regenerated to v2.
# Previous v1 preserved in git.
```

## 11. Complete Example

Приведён пример для FM-003 (Revisions inbox) — фичи из examples каталога.

**Сокращённо** (полный handoff был бы ~800 строк; тут выжимка структуры):

```markdown
---
id: HANDOFF-FM-003
type: feature-handoff
feature: FM-003
title: "Revisions inbox — handoff"
status: ready
version: 1
generated_at: 2026-06-15T14:30:00Z
generator: product-module-v1.0

dor_validation_passed: true
blocking_issues: []
warnings: []
validation_rules_passed: [V-H-01, V-H-02, V-H-03, V-H-05, V-H-06, V-H-08, V-H-10]

embedded_artifacts:
  feature: FM-003
  scenarios: [SC-005, SC-005a, SC-005e1, SC-006, SC-007, SC-008]
  business_rules: [BR-010, BR-011, BR-012, BR-013]
  lifecycles: [LC-002]
  verifications: [VC-005, VC-005a, VC-006, VC-007, VC-008]
  invariants: [IC-003]
  rpm_roles_excerpted: [R-freelancer, R-client, R-system-scheduler]
  bg_terms_excerpted: [Project, Revision, Revision batch, Client, Freelancer, Revision status]
  mockup_packages: [MK-003]
  navigation_maps: [NM-003]
  design_system_tokens_snapshot: DS@v2

artifact_hashes:
  FM-003: "sha256:a1b2c3..."
  SC-005: "sha256:d4e5f6..."
  # ...

target_adapter: "universal"
previous_version: null

created: 2026-06-15
updated: 2026-06-15
---

# Feature Handoff: Revisions inbox (FM-003)

## 1. Executive Summary

**Feature:** Revisions inbox — unified collection of edits from clients 
across multiple projects.

**Delivers value to:** Freelance translators (SEG-001) solving JTBD-1 
(collecting revisions from multiple clients without context loss).

**Validates hypothesis:** HYP-001 (freelancers willing to pay for 
revision centralization; success threshold: ≥10% conversion freelance → paid).

**Release:** RL-001 (MVP v1), target 2026-07-15.

**Has UI:** yes.

**Critical dependencies:** FM-001 (Dashboard), FM-005 (Authentication).

Brief description: Multi-channel inbox (email, manual, web widget) that 
automatically groups incoming revisions by project and batch, notifies 
the freelancer in-app, and provides workflow to apply or dismiss each.

## 2. Business Context

### Feature Map Entry (FM-003)
[full FM-003 content embedded: Why, What brief, Priority rationale, 
Success metric, Scenarios overview, BR overview, LC touched, VC overview,
Invariants touched, UI overview, Dependencies, Rollout notes]

### Segment excerpt (SEG-001)
[only relevant JTBD + profile summary; not full SEG content]
- **JTBD-1:** Сбор правок от нескольких клиентов (ситуация, желание, результат)
- **Profile:** Freelance translators working 3-8 clients parallel, 3-5 years experience

### Value Proposition (VP-001)
[statement only]
"Для **фрилансеров-переводчиков (SEG-001)**, которые **теряют время на сбор 
и согласование правок от 3+ клиентов параллельно**, наш продукт — 
**workflow-инструмент, встроенный в процесс перевода**, который **централизует
правки с сохранением контекста документа**..."

### Hypothesis (HYP-001)
[statement + thresholds]
- Statement: "Freelancers willing to pay for revision centralization"
- Success threshold: ≥10% conversion freelance → paid
- Invalidation threshold: <3%
- Testing period: 3 months from release

## 3. Terminology (BG excerpt)

Only terms used in this feature. Use these exact names in code/UI/API.

| Term              | Definition                                                 | Alt. terms to AVOID          |
|-------------------|------------------------------------------------------------|------------------------------|
| Project           | Translation project from one client with source, ...       | job, task, order             |
| Revision          | Edit from client on part of translated document with pos.  | edit, comment, feedback      |
| Revision batch    | Group of revisions in same 2h window from same client      | —                            |
| Revision status   | State of revision in LC-002 (incoming/reviewed/...)        | —                            |
| Client            | Translation customer, NOT a user of our product            | customer                     |
| Freelancer        | Self-employed translator, user of our product              | translator                   |

## 4. Role & Permission Model (RPM excerpt)

Only roles involved in this feature.

### R-freelancer
Freelance translator, owner of active projects. User of the product.

### R-client  
Translation customer. NOT a user, interacts via email or web widget.

### R-system-scheduler
Automatic actor for scheduled operations (auto-reject, auto-archive).

### Permissions matrix (filtered to FM-003 actions)

| Action            | R-freelancer      | R-client            | R-system  |
|-------------------|-------------------|---------------------|-----------|
| submit_revision   | ✗                 | ✓ (linked project)  | ✗         |
| view_revisions    | ✓ (own projects)  | ✓ (own)             | ✓         |
| apply_revision    | conditional BR-013| ✗                   | ✗         |
| dismiss_revision  | ✓ (own)           | ✗                   | ✗         |
| reopen_revision   | ✗                 | ✓ (own, <30 days)   | ✗         |

## 5. Scenarios

### SC-005: Получение revision через email (main flow)
[Full SC-005 content embedded: Actors, Preconditions, Trigger, Steps 1-6 
with BR references inline, Postconditions, Business rules applied, 
Related scenarios, Example data]

### SC-005a: Multiple project match — manual linking (alternative)
[Full content]

### SC-005e1: No project match — review pool (error)
[Full content]

### SC-006: Manual ввод revision
[Full content]

### SC-007: Batch обработка revisions
[Full content]

### SC-008: Dismiss revision
[Full content]

## 6. Business Rules

### BR-010: Привязка revision к проекту по email sender
[Full BR-010 content: Statement, Context, Parameters, Rationale, 
Applied in scenarios, Edge cases, Examples]

### BR-011: Fallback на review-pool при no match
[Full content]

### BR-012: Batch grouping by 2h window
[Full content]

### BR-013: Apply только с valid state check
[Full content]

## 7. Entity Lifecycles

### LC-002: Revision lifecycle
[Full LC-002 content: Entity definition, States list, State diagram (mermaid), 
Transitions table, Guards, Initial & final states, Derivation trace, 
Example trace]

## 8. Verification Criteria

### VC-005: Revision из email корректно linked
[Full VC-005 Given/When/Then + Expected outcomes + Rules verified + 
Lifecycle transitions verified + Negative assertions + Edge cases + 
Test data]

### VC-005a, VC-006, VC-007, VC-008
[Full content for each]

## 9. Invariants

### IC-003: Revision не может быть потеряна от incoming до final
[Full IC-003: Statement, Severity rationale, Supporting rules, Related 
lifecycles, Detection method, Recovery strategy]

## 10. UI Specification

### MK-003: Revisions inbox & processing (Design Package)
[Full MK-003 content: 7 sections — Screen Inventory, Component State Matrix, 
Interaction Spec, Responsive Notes, Accessibility Notes, Edge Cases, 
Design Decisions Log]

### DS tokens snapshot (relevant subset)
[Only tokens used in MK-003: DS.color.primary, DS.color.gray-*, 
DS.typography.body, DS.spacing.md/lg, DS.radius.md, DS.shadow.md — 
with values for receiver to replicate]

### NM-003: Revisions workflow navigation
[Full NM-003: Flow Diagram, Entry Points, Screen Transitions, 
Dead Ends & Error Flows]

## 11. Non-Functional Requirements

(NFR artifact not yet introduced in v1; receiver should clarify 
specific NFR via /product:clarify if needed.)

Known implicit NFR for this feature:
- **Performance:** Inbox list load <500ms for up to 100 revisions
- **Security:** Email ingestion: sender verification, no executable 
  attachments, XSS-safe rendering of revision body
- **A11y:** Covered in MK-003 § Accessibility Notes
- **Data retention:** Rejected revisions archived after 30 days (BR-020)

## 12. Dependencies & Context

### Feature dependencies
- **FM-001 (Dashboard)** — required, must be shipped; inbox integrated 
  into dashboard view
- **FM-005 (Authentication)** — required, user_id needed for attribution

### External integrations
- **Email ingestion:** IMAP or forwarding-based (implementation choice, 
  not specified here). Incoming email to `project@inbox.product`.
- **In-app notifications:** whatever notification system the product uses
  (not yet specified — another FM)

### Data assumptions
- Project table exists with client_emails field
- User table exists with freelancer record
- Notification table or real-time push mechanism available

### Environment prerequisites
- Inbound email service (SMTP receiver, MX DNS)
- Database supports JSON/jsonb for revision.metadata
- File storage for email attachments

## 13. Out of Scope

Explicitly NOT part of this feature:
- **AI-assisted revision summarization** — future (MMP phase)
- **Automatic apply of revisions** — never (decision in IC-003 § Known 
  violations; always freelancer-in-loop)
- **Team features** — not in MVP (team is SEG-002, different feature)
- **Mobile native app** — web-first sufficient for MVP
- **Integration with Trados/Smartcat** — future consideration, not MVP
- **Multi-language revision translation** — out of feature scope; 
  revisions are just edit requests, not translated content
```

## 12. Anti-patterns (Common Mistakes)

**AP-1: Handoff как FM-копия.** Handoff — это FM + context + behavior + terms. Не просто выписка FM frontmatter.

**AP-2: References вместо embedded.** «See SC-005 in `.product/scenarios/`» — нарушает self-contained принцип. Receiver может не иметь доступа.

**AP-3: Нет BG excerpt.** Без глоссария receiver именует сущности по-своему → рассинхрон с бизнесом.

**AP-4: Нет Out of Scope.** Без явного исключения — receiver добавит «на всякий случай», scope creep.

**AP-5: UI Specification забыт при has_ui=true.** Receiver строит UI без MK → дизайн не совпадает с бизнесовыми MK.

**AP-6: Нет artifact hashes.** Drift не детектится, stale handoff используется как current.

**AP-7: Handoff генерируется без DoR.** `status=blocked` игнорируется, receiver получает неполный пакет.

**AP-8: Секции в произвольном порядке.** Structure гарантирует, что adapter может искать по позиции; произвольный порядок ломает automation.

**AP-9: Inline configuration.** Handoff не специфицирует стек/библиотеки/фреймворки. Это зона реализации и Integrator'а.

## 13. Integration с другими модулями

### С Product Module

- **Создание:** через `/product:handoff <FM-ID>` команду Product Module
- **DoR проверки:** перед генерацией используются те же валидации, что во всём Product Module (V-01..V-17)
- **Hash computation:** Product Module вычисляет SHA текущих артефактов при генерации

### С Integrator Module

- **Adapter generation:** при `/integrator:add <tool>` Integrator создаёт adapter для этого инструмента, используя handoff spec как reference
- **Drift check:** Integrator при `/integrator:verify` проверяет, что handoff'ы актуальны
- **Environment scanner:** Integrator перед передачей handoff во внешний tool проверяет совместимость через Environment Scanner

### С будущим Orchestrator Module

- Orchestrator будет читать handoff напрямую (без adapter) при маршрутизации задач
- Использует frontmatter для понимания состава фичи
- `target_adapter=universal` говорит Orchestrator: «handoff в универсальном формате, выбирай adapter для доступного D2-Tech инструмента»

### С `.product/` файловой системой

- Handoff генерируется из `.product/` (read-only операция)
- Handoff НЕ обновляет `.product/` автоматически
- При regeneration: old version переходит в git history

## 14. Open Extensions

### NFR integration (после закрытия OQ-03)

Когда NFR-* артефакт будет определён:
- Секция 11 заполняется embedded NFR-* содержимым
- В embedded_artifacts добавляется `nfr: [NFR-<NNN>, ...]`
- DoR добавляется блок для NFR присутствия (возможно, W4 → B9)

### Release handoff bundle

Для RL-NNN-handoff:
- Объединяет несколько FM handoffs
- Добавляет release-level context (goals, HYP validation plan, rollout plan)
- Cross-feature dependencies секция

### Partial handoff

Для ранних этапов, где fully-defined FM ещё нет:
- `status=partial` (блокирует production использование)
- Явное указание, какие секции placeholder
- Используется для design review или PoC, не для production implementation

### Handoff history and decisions

Journal integration:
- Каждая регенерация записывается в project-journal (Integrator) с причиной
- Cross-reference handoff version → decision log entries
- Полная трассируемость изменений

## 15. Checklist для Product Assistant при генерации handoff

Implemented в skill [`skills/product/handoff-generator.md`](../../skills/product/handoff-generator.md) (Phase 4.E). Skill executes этот checklist mode-aware (production = full; draft = relaxed B1/B2/B5 only).

- [x] FM.status == in-progress (или shipped) проверено — B1
- [x] Все SC, BR, LC, VC, IC фичи в active — B2, B3, B4
- [x] Если has_ui=true — MK, NM существуют и в active — B7
- [x] DS snapshot готов (если has_ui) — embedded в section 10
- [x] BG extraction запущена, все релевантные термины в BG — B5 + V-H-07
- [x] RPM содержит все роли из SC — B8
- [x] Все 13 секций body заполнены — V-H-01 + V-H-03
- [x] Frontmatter валиден, все обязательные поля заполнены — V-H-06
- [x] `artifact_hashes` computed для всех embedded через `hooks/product/lib/hash.js` (body markdown без frontmatter, LF-normalized, SHA-256, `sha256:<hex64>`) — V-H-02
- [x] DoR validation run, все blocking passed (mode-aware: production 8, draft 3) — overall DoR
- [x] V-H-01..V-H-11 passed (или явно known-warn) — full V-H-* coverage
- [x] Запись в decision journal Integrator (если adapter уже существует) — Phase 5+ когда adapter installed

## 16. Implementation status

- [x] **OQ-03 (NFR) closed** — Phase 3 (NFR artifact введён); Phase 4.D F.5a workflow shipped; section 11 three cases (active / declined / pending) implemented per `handoff-generator.md`
- [x] **`/product:handoff` command** — Phase 4.E shipped; `commands/product/handoff.md`
- [x] **Skill `handoff-generator.md`** — Phase 4.E shipped с full §15 checklist + mode-aware DoR (DEC-DEV-0028 D.1) + hash utility integration (DEC-DEV-0025 C.1)
- [x] **Cross-platform hash invariant** — `hooks/product/lib/hash.js` shipped (Phase 4.E); body markdown без frontmatter, LF-normalized; same module used by Phase 4.F gate hook
- [x] **`product-handoff-gate.js` PostToolUse non-blocking hook** — Phase 4.F shipped; V-H-04 drift detection: после save артефакта в `.product/` сканирует handoffs, recomputes hashes через `lib/hash.js`, warns в stderr при mismatch (suggests `/product:handoff <FM-id> --regenerate`)
- [x] **`--with-da-review` flag actual DA invocation** — Phase 4.H shipped per DEC-DEV-0026: SlashCommand → `/product:da-review FM-NNN` (skill `product-da-review.md`) → consumes findings file with `source: auto-pre-handoff` → critical pending findings refuse handoff continue. B3 safe-guard pre-flight check preserved для defense против incomplete bootstrap
- [ ] **RL-NNN bundle handoff** — v1.1+ (deferred per scope discipline); Phase 4 ships FM-NNN scope only
- [ ] **Первый adapter (handoff → cc-sdd) через Integrator** — Phase 5 deliverable
- [ ] **Smoke test handoff → adapter → external tool** — Phase 5 closure (после adapter shipped)

---

**Конец спецификации.**

Статус: **Phase 4.E shipped.** Universal handoff generation работает в обоих режимах; receiver-side adapter — Phase 5.
