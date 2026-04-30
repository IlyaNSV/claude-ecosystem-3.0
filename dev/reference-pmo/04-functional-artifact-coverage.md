# 04. Функциональное покрытие артефактов

> **Назначение раздела:** **functional mapping** твоих 22 артефактов на индустриальные канонические функции. Не «есть ли у тебя артефакт типа X с полем Y», а «**покрывается ли функция, для которой индустрия имеет канонический артефакт**».
>
> **Принцип сравнения** (per user feedback): не «в лоб», а **по покрытию функции**. Если у тебя ни PS-канонический Cagan-style opportunity assessment, ни Strategyzer Problem Statement, но твой PS покрывает ту же function (problem framing с traceability к dependents) — это match.

---

## 04.1 Индустриальный референс

### 04.1.1 Логика mapping артефактов на функции

Когда индустриальная школа называет артефакт «Opportunity Assessment» (Cagan), а ты называешь свой «Problem Statement» — это **наименование, не функция**. Функция — «зафиксировать зачем мы существуем, дать всем downstream-артефактам anchor».

Индустриальные школы дают **разные артефакты для одной функции**. Например, problem framing у:
- Cagan — Opportunity Assessment (10-question template)
- Lean Startup — Problem Statement (часть BMC)
- Strategyzer — Customer Profile + Job Section (часть VPC)
- JTBD-Christensen — Job Statement + Forces of Progress
- JTBD-Ulwick — Job Map + Outcome Statements
- Cohn / agile — User Persona + Problem Backlog

Все они покрывают одну функциональную потребность. Твой PS — другая инкарнация той же функции.

### 04.1.2 Что считается «coverage of function»

Артефакт покрывает функцию если он:
1. **Содержит ту информацию**, которую функция требует (например, problem framing требует «who suffers what unmet need»)
2. **Используется** в downstream-процессах (не лежит мёртвым)
3. **Поддерживает evolution** через заявленный жизненный цикл (status transitions, rework, deprecation)
4. **Имеет известное место в граф зависимостей** (другие артефакты на него ссылаются)

Если три из четырёх есть — partly covered. Все четыре — fully covered.

### 04.1.3 Канонические функции в продуктовой/инженерной разработке

Сводный список из всех школ, на который мы будем мапировать:

**Strategy & Discovery (D1):**
1. Problem framing
2. Market understanding
3. Competitive positioning
4. Demand-side segmentation (по job, не персона)
5. Value articulation per segment
6. Hypothesis formulation with testable thresholds
7. MVP scope discipline (validated learning, не v1-with-cut-scope)
8. Roadmap directions (3-6 month horizon, outcomes-not-features)
9. Release planning with dependencies
10. Feature prioritization with shared scoring

**Specification (D2-Behavioral):**
11. Feature framing (per-feature unit of work)
12. Behavior specification (scenarios)
13. Business rule formalization
14. Entity lifecycle modeling (state machines)
15. Verification criteria (Given/When/Then)
16. Invariant identification
17. Roles & permissions matrix
18. Non-functional requirements

**UI Design (D2-05, conditional):**
19. UI specification (mockups + states)
20. Design system tokens
21. Navigation map

**Cross-cutting:**
22. Business glossary (ubiquitous language)
23. Unstructured idea capture (working memory)

23 функции, твоих 22 артефакта (+1 emergent function — RPM как separate artifact). Posner mapping ниже.

---

## 04.2 Перечень функций и mapping на твои артефакты

### Strategy & Discovery (D1)

| # | Функция | Industry-canonical artifact | Source | Твой артефакт | Maturity |
|---|---|---|---|---|---|
| F1 | Problem framing | Opportunity Assessment (Cagan); Problem Statement (Lean); Job Statement (JTBD) | Cagan *Inspired*; Ries; Christensen 2016 | **PS** singleton | MATURE-ISH |
| F2 | Market understanding | Market Research report; Strategyzer Customer Profile | Strategyzer; Lean discovery | **MR** singleton | MATURE |
| F3 | Competitive positioning | Competitive matrix (Cagan); Porter 5 forces; positioning map | Cagan; Porter | **CA** singleton | MATURE |
| F4 | Demand-side segmentation | JTBD Segment; Outcome-based segments (Ulwick); Persona (только если jtbd-anchored) | Christensen 2016; Ulwick *Jobs to be Done* 2016 | **SEG-*** | MATURE-ISH |
| F5 | Value articulation per segment | Value Proposition Canvas (Strategyzer); Empowered VP (Cagan) | Osterwalder *Value Proposition Design* | **VP-*** (1:1 SEG↔VP) | MATURE-ISH |
| F6 | Hypothesis formulation w/ testable thresholds | Test Card (Strategyzer); Lean UX hypothesis; H.A.R.M.E.D. (community, low confidence) | Bland & Osterwalder 2019; Gothelf *Lean UX* | **HYP-*** with success/invalidation | MATURE-ISH |
| F7 | MVP scope discipline (validated learning) | MVP (Ries); validated learning loop | Ries *Lean Startup* | **MVP** singleton with primary HYP | MATURE-ISH |
| F8 | Roadmap directions (outcomes not features) | Cagan strategy → directions; Now/Next/Later board | Cagan *Empowered* ch. 4 | **RM** singleton (3-6 мес horizon) | MATURE-ISH |
| F9 | Release planning with dependencies | Release plan; deployment train | Humble & Farley *Continuous Delivery* | **RL-*** | MATURE |
| F10 | Feature prioritization with shared scoring | RICE; MoSCoW; Cagan opportunity | (industry practice) | **FM-*.priority** field (no formal RICE) | MATURE-ISH |

### Specification (D2-Behavioral)

| # | Функция | Industry-canonical | Source | Твой артефакт | Maturity |
|---|---|---|---|---|---|
| F11 | Feature framing | User Story (Connextra); Feature canvas; Cagan opportunity-tied | Cohn *User Stories Applied* | **FM-*** | MATURE |
| F12 | Behavior specification (scenarios) | BDD Gherkin Scenario; SbE Key Example | North «Introducing BDD»; Adzic 2011 | **SC-*** with actor-verb steps | MATURE |
| F13 | Business rule formalization | Decision tables; Business rules engines (DROOLS class); BR canvas | Ross *Principles of the Business Rule Approach* 2003 | **BR-*** with parameters + categorization | MATURE |
| F14 | Entity lifecycle modeling | State machine (UML); DDD Aggregate state; Statechart (Harel) | Evans 2003; Harel 1987 | **LC-*** with state diagram | MATURE |
| F15 | Verification criteria (Given/When/Then) | BDD scenarios; AC; SbE | North; Cohn; Adzic | **VC-*** Gherkin-derived | MATURE |
| F16 | Invariant identification | DDD Aggregate invariants; database CHECK constraints; DBC (Design by Contract, Meyer) | Evans 2003; Meyer 1992 | **IC-*** with severity + recovery | MATURE |
| F17 | Roles & permissions matrix | RBAC (Sandhu et al. 1996); ABAC | Sandhu *Role-Based Access Control Models* 1996 | **RPM** singleton | MATURE |
| F18 | Non-functional requirements | ISO 25010; FURPS+; SRE SLO | iso25000.com; Google SRE | **NFR-*** with sanity ranges | MATURE |

### UI Design (D2-05, conditional has_ui)

| # | Функция | Industry-canonical | Source | Твой артефакт | Maturity |
|---|---|---|---|---|---|
| F19 | UI specification (mockups + states) | Atomic Design (Frost); design package; Component spec | Frost *Atomic Design* 2013 | **MK-*** Design Package с 7 секциями | MATURE-ISH |
| F20 | Design system tokens | Design tokens (Salesforce, Adobe); design system package | Salesforce Design Tokens; Adobe Spectrum | **DS** singleton | MATURE-ISH |
| F21 | Navigation map | Site map; user flow; navigation diagram | Garrett *Elements of User Experience* 2010 | **NM-*** | MATURE |

### Cross-cutting

| # | Функция | Industry-canonical | Source | Твой артефакт | Maturity |
|---|---|---|---|---|---|
| F22 | Business glossary (ubiquitous language) | DDD Ubiquitous Language; data dictionary | Evans 2003 | **BG** singleton с continuous extraction | MATURE |
| F23 | Unstructured idea capture | Note-taking practice; second brain; Zettelkasten | (general practice; Forte *Building a Second Brain* 2022) | **NOTE-*** with promote-to-structured | EMERGING для AI-driven product context |

---

## 04.3 Чеклист покрытия

**Шкала** (см. overview §2.2): ✗ 0 / ◔ 1 / ◐ 2 / ● 3 / N/A. **Locus:** CC / EXT / HYB / N/A.

### Strategy & Discovery

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| F1 | Problem framing | ● 3 | `[C]` | CC | PS singleton; iterative D1.1 с 5-8 questions; cascade root (changes = pivot scenario). Operationalized to a degree most «opportunity assessment templates» в индустрии не достигают (formal lifecycle, validation rules, downstream cascade). |
| F2 | Market understanding | ● 3 | `[C]` | CC | MR singleton; Quick mode (5-8 web searches + 3-5 scrapes) + Deep mode (subagent, deferred v1.1). Quick-mode credibility marking — fitness extension. |
| F3 | Competitive positioning | ● 3 | `[C]` | CC | CA singleton; feature matrix; positioning map; alternatives discovery. |
| F4 | Demand-side segmentation | ● 3 | `[C]` | CC | SEG-* artifacts (2-4 per product); JTBD внутри SEG.body; 1:1 SEG↔VP relationship. JTBD school choice — implicit closer to Christensen (job statement) than Ulwick (outcome ratings). **Sub-track в снапшоте:** если SEG.frontmatter получит outcome-ratings (Ulwick-style importance/satisfaction scores) — это enrichment от JTBD school. |
| F5 | Value articulation per segment | ● 3 | `[C]` | CC | VP-* per SEG; references CA для differentiation. Strategyzer-style VP канва используется методологически в skill `vp-design.md`. |
| F6 | Hypothesis formulation w/ thresholds | ● 3 | `[C]` | CC | HYP-* с mandatory success/invalidation thresholds; status testing → validated/invalidated/deferred. **Direct match** с Strategyzer Test Card pattern. **Caveat:** «H.A.R.M.E.D.» framework упомянут в processes.md §3.1.A. shape #5; per agent research, H.A.R.M.E.D. имеет low canonical confidence. Recommend swapping mention to «adapted Strategyzer Test Card» or «Lean UX hypothesis canvas». Не критично (не меняет функцию). |
| F7 | MVP scope discipline | ◐ 2 | `[C]` | CC | MVP singleton + primary HYP; MoSCoW discipline в `mvp-scoping.md` skill. **Partially:** Build-Measure-Learn loop unclosed (D5 absent), so MVP technically declared but not validated через cohort data. **Same partial as Section 01 #3.** |
| F8 | Roadmap directions | ● 3 | `[C]` | CC | RM singleton; «directions не features»; 3-6 мес horizon. Cagan-style empowered teams strategy artikulация. |
| F9 | Release planning | ● 3 | `[C]` | CC | RL-* with target_date, features list, rollout plan. Soft hooks для D5 deployment (canary, feature flag) acknowledged via `rollout_plan` field — но execution EXT (delegated). |
| F10 | Feature prioritization | ◐ 2 | `[C]` | CC | FM frontmatter `priority: must \| should \| could \| won't` (MoSCoW). **Partially:** нет формального RICE / ICE scoring. Continuous dialog (DEC-P07). **Отслеживай:** появление структурированного scoring в FM frontmatter — sign of maturation. |

### Specification (D2-Behavioral)

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| F11 | Feature framing | ● 3 | `[C]` | CC | FM с skeleton → planned → in-progress → shipped lifecycle; D1-alignment check (segments, JTBD, HYP) via P2.B F.0a. **Stronger** than typical user story templates because of cascade dependencies and `requires_review` status propagation. |
| F12 | Behavior specification | ● 3 | `[C]` | CC | SC-* с actor-verb steps, main/alt/error flow distinction, BR references inline. **Direct match** с BDD Gherkin scenario. Поле `actors` + `actions` matrix — fitness extension (better RPM linking than vanilla Gherkin). |
| F13 | Business rule formalization | ● 3 | `[C]` | CC | BR-* с statement, parameters, categorization (validation/calculation/authorization/etc.), Critical-level review, DA trigger on change. **Stronger** than typical decision tables — bi-directional refs to scenarios + adversarial review on parameter changes. |
| F14 | Entity lifecycle modeling | ● 3 | `[C]` | CC | LC-* с states list, transitions table, mermaid diagram, guards (BR refs). Direct DDD aggregate state machine pattern + Harel statechart-influenced. |
| F15 | Verification criteria | ● 3 | `[C]` | CC | VC-* Given/When/Then derived from SC + BR + LC + NFR. Auto-coverage check (V-07) для main + alt + error flows. **Note для snapshot tracking:** EARS notation (Ubiquitous, Event-driven, etc.) не используется явно; VC are Gherkin-style. Если в snapshot N+1 EARS gets adopted — это enrichment, not drift. |
| F16 | Invariant identification | ● 3 | `[C]` | CC | IC-* с severity, supporting rules, recovery strategy. Critical-level review + mandatory DA review (P-RULE-01). **Stronger** than typical Design by Contract — bi-directional refs to BR + LC + adversarial review at every significant change. |
| F17 | Roles & permissions matrix | ● 3 | `[C]` | CC | RPM singleton; roles list; permission matrix per FM action; conditional permissions reference active BR. RBAC-style; ABAC-style attribute conditions через BR refs. |
| F18 | Non-functional requirements | ● 3 | `[F/C]` | CC | NFR-* opt-in (DEC-NFR-F08); active/declined/pending status; sanity ranges per tier (MVP/MMP/Growth/Mature); guardrails при override; magnitude-driven DA on change. **Direct match + extension:** ISO 25010 quality characteristics covered; sanity ranges per tier — fitness extension; opt-in philosophy with explicit acknowledgment of decline — best-practice, который most spec-engineering frameworks miss. |

### UI Design (conditional)

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| F19 | UI specification | ● 3 | `[C]` | HYB | MK-* как Design Package (7 sections); Component State Matrix; Interaction Spec; Responsive Notes; Accessibility Notes; Edge Cases; Design Decisions Log. Visual mockups в Stitch (EXT) или HTML fallback. Hybrid is structurally honest. |
| F20 | Design system tokens | ● 3 | `[C]` | CC | DS singleton с continuous token extraction; V-MK-08 token coverage check; mass-rename support. **Direct match** Salesforce/Adobe design tokens practice + DDD-style naming consistency. |
| F21 | Navigation map | ● 3 | `[C]` | CC | NM-* derived from MK + LC guards; Flow Diagram + entry points + transitions + dead-end/error flows. Auto-derivation (🟢 Confirmation review). |

### Cross-cutting

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| F22 | Business glossary (ubiquitous language) | ● 3 | `[C]` | CC | BG с continuous extraction (Phase 1 hook), synonym detection (Phase 2 Levenshtein), used_in tracking, mass-rename workflow, V-08 terminology check. **Strongest match** в этой секции к индустрии — DDD Ubiquitous Language operationalized at level индустрия rarely achieves outside dedicated tools. См. Section 07. |
| F23 | Unstructured idea capture | ● 3 | `[F]` | CC | NOTE-* (D3 modification) с quick-capture flow (≤30 сек idea → file); promote-note workflow для конвертации в structured artifact (FM, SC, BR, IC, NFR, HYP). **Frontier work**; индустрия имеет note-taking practices (Building a Second Brain) но не specifically integrated into living spec system. |

**Итог по разделу 04:**

- **F1-F6, F8, F9** (Discovery & Strategy): 8 × ● 3 из 9. F7 (MVP) и F10 (priorization) at ◐ 2.
- **F11-F18** (Specification): 8 × ● 3.
- **F19-F21** (UI): 3 × ● 3.
- **F22-F23** (Cross-cutting): 2 × ● 3.

**Всего: 21 × ● 3 + 2 × ◐ 2 = 23 функции.** Покрытие по functional artifact mapping — **наиболее complete** из всех разделов референса. Это отражает где ты сосредоточил основное проектирование (D1 + D2-B). Слабые точки (F7, F10) — последствия v1 scope decisions, не дизайн-flaws.

---

## 04.4 Нарративный анализ соответствия

### 04.4.1 Functional coverage по школам

**Cagan/SVPG (Empowered teams):**
- ✓ Opportunity Assessment ↔ PS — match
- ✓ Empowered VP ↔ VP — match
- ✓ Strategy → directions ↔ RM — match
- ✓ Outcome assessment в strategy ↔ HYP — match
- ✓ Critique of feature factory ↔ FM creation D1-alignment — match
- 📌 Discovery vs delivery parallel tracks ↔ ROADMAP architecture (P1 + P2 parallel) — match

**Torres / Continuous Discovery:**
- ✓ Opportunity-Solution Tree ↔ implicit через graph PS → SEG → VP → HYP → MVP → RM → RL → FM. **Не explicit как single artifact**. Индустрия would have OST as visual; у тебя это as graph + cascade refs.
- ⚠ Weekly customer touchpoints cadence ↔ **NOT covered**. Activation Matrix говорит D1-01..06 ★ on Идея→MVP, но Torres recommends continuity. **Conscious gap (Section 02 анти-паттерн #5).** Отслеживай: appearance of cadence-driven Discovery refresh (например, scheduled `/product:init --review` или similar).
- ✓ Story-based interviewing ↔ implicit в skill `problem-discovery.md` (5-8 уточняющих вопросов). Could be made explicit.
- ✓ Assumption mapping ↔ HYP с thresholds. Match in essence; Torres distinguishes assumptions from hypotheses (assumptions are upstream of hypotheses), но для solo это distinction less critical.

**Lean Startup (Ries):**
- ✓ MVP с primary HYP ↔ MVP — match
- ✓ Build-Measure-Learn ↔ partial (build & measure parts; learn loop incomplete без D5)
- ✓ Pivot/Persevere ↔ acknowledged (Q-11 deferred)
- ✓ Innovation accounting (per-cohort) ↔ depends on D5 — **gap pre-pilot**
- ✓ Vanity vs actionable metrics ↔ implicit в HYP threshold discipline. Match.

**JTBD (Christensen / Ulwick / Klement):**
- ✓ Job Statement ↔ JTBD inside SEG.body. Match closer to Christensen school («progress in circumstance»).
- ⚠ **Sub-school choice not explicit.** SEG.body содержит JTBD — но какой школы? Christensen-style narratives, Ulwick-style outcome ratings, или Klement-style switch interviews? Currently — Christensen by default. **Отслеживай:** if SEG/JTBD frontmatter gains `outcome_statements: [...]` или `forces_of_progress: {push, pull, anxiety, habit}` — это explicit subschool adoption.

**Strategyzer (Osterwalder):**
- ✓ Value Proposition Canvas ↔ VP — match (skill `vp-design.md` использует «Strategyzer-style VP Canvas (simplified)»).
- ✓ Test Card ↔ HYP — match (test, measure, criterion components present).
- ✗ **Business Model Canvas** ↔ **NOT covered.** BMC describes whole business (не feature). Для solo, это **probably correct N/A** — ты не моделируешь business model, ты моделируешь продукт. Отслеживай: appearance of BMC-like artifact в `.product/` would suggest scope expansion; rationale needed.

**BDD (North) / SbE (Adzic):**
- ✓ Gherkin Scenario ↔ SC + VC. Match.
- ✓ EARS notation? **Not used.** EARS is alternative to Gherkin for requirements (Ubiquitous, Event-driven, State-driven, Optional, Unwanted). Could enrich; not necessary. **Отслеживай:** EARS adoption would be enrichment, not drift.
- ✓ SbE Key Examples ↔ VC «Example data» field + SC «Example data» + concrete data в BR. Match.
- ✓ Three Amigos ↔ Solo + AI-assistant + DA subagent (in spirit, not literal). Match in essence.

**DDD (Evans / Vernon):**
- ✓ Ubiquitous Language ↔ BG. Strong match (Section 07).
- ✓ Aggregate ↔ LC + IC. Match.
- ✓ Bounded Context ↔ entire `.product/` for solo single-product. Match (trivial).
- ✓ Anti-Corruption Layer ↔ Integrator adapters. Match.
- ✗ **Domain Events** as first-class artifact ↔ **NOT covered.** Нет `event:` artifact type. Could be added if needed for event-sourced architecture; not necessary for typical CRUD-style products.

**ISO 25010 / SRE SLO:**
- ✓ NFR functional / performance / reliability / etc. ↔ NFR с sanity ranges per tier. Strong match.
- ✓ SLO/SLI declarations ↔ NFR.target + measurement method. Match.
- ✗ **Error budgets** ↔ **NOT covered.** SRE error budget = how much SLO miss is acceptable in window. Could be NFR field. Отслеживай.

**Frost Atomic Design:**
- ✓ Design Package (MK 7 sections) ↔ atomic design's component spec, layered. Match.
- ✓ Design tokens ↔ DS. Match.

### 04.4.2 Где industry артефакт есть, у тебя НЕ покрыто (intentional или нет)

Сводный список «not covered» functions, выявленных выше:

| Industry artifact | Why not covered | Intentional? | Track signal |
|---|---|---|---|
| OST as visual artifact | Graph implicit through cascade refs | Yes — visual not needed for solo | Если `/product:visualize` or similar появляется в N+1, это pattern-libraryizing OST |
| Weekly Discovery cadence | Нет automation для этого | Conscious gap (Activation Matrix); high-value to add post-pilot | Cadence-driven `/product:init --review` |
| JTBD sub-school explicit | Christensen-style by default | Likely intentional (don't pick fight); track if other school becomes natural | SEG/JTBD frontmatter gains outcome_statements или forces_of_progress |
| BMC | Whole-business modeling | Yes — N/A для solo product-focus | If appears, scope expansion to full business |
| EARS notation | Gherkin sufficient | Yes — choice, not gap | If EARS adopted в VC — enrichment |
| Domain Events | Не нужно для CRUD | Likely intentional | Appears if/when event-sourcing relevant |
| Error budgets в NFR | NFR target without budget | Likely gap — SRE practice valuable | NFR.frontmatter gains `error_budget: ...` |
| Story-based interviewing explicit skill | Subsumed в `problem-discovery.md` | Could be enrichment | Separate skill `customer-interview.md` |

### 04.4.3 Где у тебя артефакт сильнее индустрии (fitness contributions)

1. **BG continuous extraction + synonym detection** — DDD Ubiquitous Language operationalized at level индустриальные tools rarely achieve. Индустрия: glossary exists in spec docs, manual sync. У тебя: hook-driven extraction + Levenshtein synonyms.
2. **Adversarial review at significant artifact change (BR, IC)** — DBC (Design by Contract, Meyer) declares contracts; **doesn't review** them at change time. У тебя: P-RULE-01, P-RULE-02 trigger DA on every significant change.
3. **NFR opt-in with declined+rationale tracking** — ISO 25010 expects NFR coverage. У тебя adds explicit «we considered, declined, here's why» — это **better** than silent absence.
4. **NOTE-* unstructured catch-all с promote-to-structured** — note-taking practices exist (Forte's Building a Second Brain), но integration into spec system at this level is novel.
5. **Cascade with priority ordering on artifact change** — RTM principle; few PMO tools implement priority-aware cascade.
6. **Frontmatter `confidence:` field mandatory** — verbalized confidence (Tian/Lin/Kadavath) operationalized as living spec field.

---

## 04.5 Анти-паттерны для отслеживания

1. **Imperative scenarios** (BDD анти-паттерн). Симптомы: SC steps describe UI clicks, не business behavior («user clicks X», not «user submits Y»). **Source:** Cucumber docs; North «Introducing BDD».
2. **Anemic domain model** (Fowler). Симптомы: LC is just states list without transitions / guards; entity decisions live в BR with no LC reference. **Source:** Fowler bliki; Evans 2003.
3. **NFR as adjectives without metrics.** Симптомы: NFR.target = «fast», «secure» without numeric threshold. **Source:** ISO 25010; SRE SLO discipline.
4. **MVP-as-v1-with-cut-scope.** См. Section 01 #3.
5. **Job statement smuggling solution.** Симптомы: SEG.JTBD reads «hire app to search...». **Source:** Klement *When Coffee and Kale Compete*.
6. **Verification scripts vs key examples.** Симптомы: VC enumerates dozens of step-by-step assertions instead of representative examples. **Source:** Adzic 2011 — key examples principle.
7. **UI design without business context.** Симптомы: MK created without SC/BR/LC reference; visual designed in vacuum. **Source:** Frost — atomic design's «design with content», not in vacuum.
8. **Persona without job-anchor.** Симптомы: SEG.body is demographic profile («25-35 years old, urban, higher income») without JTBD. **Source:** Christensen 2016 — job > persona.
9. **HYP without invalidation threshold.** Симптомы: HYP has success threshold but no invalidation; can't be falsified. **Source:** Ries; Strategyzer Test Card.
10. **Glossary that is not used.** Симптомы: BG has terms; SC/BR/LC use synonyms (V-08 Warning ignored). **Source:** Evans 2003 — model integrity.
11. **Roles defined but not used in scenarios.** Симптомы: RPM lists roles; SC.actors references different role names. **Source:** RBAC discipline.
12. **Design tokens hard-coded в MK.** Симптомы: MK component states use hex colors directly, not DS token references; V-MK-08 ignored. **Source:** Salesforce design tokens practice.

---

## 04.6 Сигналы для сравнения снапшотов

### Coverage stability

1. **D1 functional coverage** — F1-F9 на 3, F7 и F10 на 2. Снижение — sign of regression.
2. **D2-B functional coverage** — F11-F18 на 3 stably. Изменение влияет на handoff completeness.
3. **D2-05 functional coverage** — depends on whether project has has_ui FMs.
4. **Cross-cutting** — F22 (BG) + F23 (NOTE) — стабильно 3. Особенно BG; снижение = terminology drift signal.

### School alignment

5. **JTBD school explicit choice.** SEG/JTBD frontmatter changes (outcome_statements, forces_of_progress) — adoption of specific JTBD school.
6. **Strategyzer alignment.** HYP fields close to Test Card (hypothesis, experiment, metric, criterion) — match. Drift away suggests hypothesis discipline weakening.
7. **DDD alignment.** BG `used_in` field maintained? V-08 active? Mass-rename used? — все sign of ubiquitous language discipline alive.
8. **BDD alignment.** SC actor-verb format maintained? Steps focus on behavior not UI? — sign of BDD discipline alive.
9. **ISO 25010 NFR coverage.** NFR-* across categories (functional / performance / reliability / security / usability / portability / maintainability / compatibility) — distribution.

### Gaps tracked

10. **OST visual?** Появилось ли `/product:visualize` или similar?
11. **Weekly Discovery cadence?** Появился ли scheduled refresh?
12. **EARS notation в VC?** (would be enrichment, not drift)
13. **Error budgets в NFR?** (would close SRE gap)
14. **Domain Events as artifact?** (would be scope expansion)

### Fitness contributions tracking

15. **BG continuous extraction working?** (frequency of bg-candidates.yaml updates)
16. **DA trigger on BR/IC change firing?** (DA findings file dates)
17. **NFR opt-in declined-with-rationale used?** (FM.frontmatter.nfr_status distribution)
18. **NOTE → promoted artifact conversions?** (NOTE.status=promoted count)

---

**Конец раздела 04.**
