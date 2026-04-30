# 03. Карта покрытия доменов (D1-D6 с подзонами)

> **Назначение раздела:** **функциональная карта** доменов разработки с **подзонами**. Это инструмент, против которого Integrator проверяет обещания инструментов («покрывает ли этот инструмент integration testing? performance testing?») и который при diff'е снапшотов показывает, какие подзоны мигрировали locus / изменили покрытие.
>
> **Ключевой принцип** (overview §3.0): этот раздел перечисляет **функциональные ожидания**, не **implementation methodologies**. «Должно ли быть integration testing» — IN. «Как именно настроить pytest» — OUT.

---

## 03.1 Индустриальный референс

### 03.1.1 Откуда берутся 6 доменов

Структура D1-D6 — внутренняя карта Ecosystem 3.0 (`pmo-map.md`), но её корни — широко известные модели:

- **D1 Product Discovery & Strategy** ↔ classical product management discovery phase (Cagan, Torres)
- **D2 Requirements & Design** ↔ Wiegers requirements engineering + DDD strategic + tactical design
- **D3 Development & Delivery** ↔ classic SDLC implementation phase
- **D4 Quality Assurance** ↔ ISO 25010 + ISTQB testing taxonomy + SRE reliability discipline
- **D5 Operations & Feedback** ↔ DevOps + SRE + Product Operations
- **D6 Meta: Ecosystem Governance** ↔ ADRs + retrospectives + governance frameworks

### 03.1.2 Декомпозиция на подзоны

Внутри каждого домена индустрия имеет **established подзоны**, которые мы используем как канонический список. Не «мы придумали что должно быть»; «мы взяли то, что устоялось в индустрии за 20-40 лет».

- **D4 testing taxonomy** канонически разбивается на: unit / integration / e2e / performance / security / regression / smoke / acceptance / exploratory. ISTQB Foundation Level Syllabus формализует. ISO 25010 quality characteristics дают параллельную декомпозицию (functional suitability, performance efficiency, etc.).
- **D5 operations subzones** канонически: monitoring / alerting / logging / incident response / SLO tracking / capacity planning / deployment strategies / rollback / disaster recovery / security ops. Google SRE Book — каноническое разделение.
- **D3 development subzones** менее формализованы, но широко используемая декомпозиция: code review / version control discipline / dependency management / build automation / code generation. От «State of DevOps Report» (Forsgren et al., *Accelerate*).
- **D6 meta-governance** менее канонизирован, но устоявшиеся items: ADRs (Architecture Decision Records — Nygard 2011) / retrospectives / decision logs / change management / risk register.

### 03.1.3 Implementation methodologies vs функциональные ожидания

**Этот раздел** перечисляет: «должна ли быть в системе **функция** monitoring? **функция** code review? **функция** integration testing?» — yes/partial/no/N/A на каждое.

**Этот раздел НЕ описывает:** «как именно настроить Prometheus», «как писать pytest fixtures», «какой инструмент code review». Это уже зона tool-docs (Integrator §13).

### 03.1.4 Ключевые источники

- ISTQB Foundation Level Syllabus — testing taxonomy. istqb.org.
- ISO/IEC 25010:2011 (revised 2023) — Software Quality Model. iso25000.com.
- Google SRE Book (Beyer et al., 2016) — SLO/SLI, error budgets, incident response. sre.google/sre-book.
- Forsgren, Humble, Kim, *Accelerate* (2018) — DevOps capabilities; D3 + D4 decomposition.
- Nygard, «Documenting Architecture Decisions» (2011) — ADR pattern, D6.
- Wiegers & Beatty, *Software Requirements*, 3rd ed. (2013) — D2 requirements engineering.
- Microsoft STRIDE; Shostack, *Threat Modeling* (2014) — D2-Tech security review subzone.

---

## 03.2 Перечень функций (per domain, with subzones)

### D1 — Product Discovery & Strategy (9 подзон)

Все из `pmo-map.md` D1-01..D1-09. Indрастри mapping:

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D1-01 | Problem Discovery | Cagan opportunity assessment; PS canvas | Cagan *Inspired* part 2 |
| D1-02 | Market Research | Lean discovery; Strategyzer customer profile | Strategyzer VPC |
| D1-03 | Competitive Analysis | Cagan competitive positioning; Porter 5 forces | Cagan *Inspired* |
| D1-04 | Segment & JTBD | JTBD (Christensen, Ulwick, Klement) | Christensen *Competing Against Luck* |
| D1-05 | Hypothesis Formulation | Strategyzer Test Card; Lean UX hypothesis | Bland & Osterwalder *Testing Business Ideas* |
| D1-06 | MVP Scope Definition | Ries MVP; Cagan opportunity assessment | Ries *Lean Startup* ch. 6 |
| D1-07 | Product Roadmap | Cagan strategy → directions | Cagan *Empowered* ch. 4 |
| D1-08 | Release Planning | Continuous Delivery; release train | Humble & Farley 2010 |
| D1-09 | Feature Prioritization | RICE / MoSCoW / Cagan opportunity scoring | (community practice) |

### D2-Behavioral (5 подзон)

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D2-B-01 | Project Context Setup | Wiegers requirements baseline | Wiegers ch. 4 |
| D2-B-02 | Feature Specification (behavior) | BDD scenarios; SbE key examples | North; Adzic 2011 |
| D2-B-03 | UX/UI Design (если has_ui) | Atomic Design (Frost); Material Design tokens | Frost 2013 |
| D2-B-04 | Data Model Design (поведенческий) | DDD aggregates; entity-relationship | Evans 2003 |
| D2-B-05 | Adversarial Review | Pre-mortem; red team | Klein HBR 2007; Shostack |

### D2-Technical (4 подзоны — функциональные ожидания, **не** implementation methodology)

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D2-T-01 | Architecture Design | DDD strategic design; C4 model | Evans 2003; Brown c4model.com |
| D2-T-02 | Architectural Review (multi-lens / эквивалент 6 призм) | ATAM (Architecture Tradeoff Analysis Method, SEI) | Bass, Clements, Kazman *Software Architecture in Practice* 4th ed. |
| D2-T-03 | API Contract Design | OpenAPI / gRPC schema discipline | OpenAPI Initiative |
| D2-T-04 | Spike / PoC management | Agile spike; Lean experiment | Cohn *Agile Estimating and Planning* |

### D3 — Development & Delivery (6 подзон)

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D3-01 | Code-level review | code review discipline; pull request workflow | Forsgren *Accelerate* |
| D3-02 | Change management & branching/merging | Git Flow / trunk-based dev | Forsgren *Accelerate*; Beck *Test-Driven Dev* |
| D3-03 | Dependency management | SCA tools; lockfile discipline | (industry — npm/pip/cargo norms) |
| D3-04 | Build automation / CI | Continuous Integration | Humble & Farley 2010 |
| D3-05 | Code generation (LLM-assisted) | (emerging) Anthropic, OpenAI codegen practices | (emerging — нет канонического) |
| D3-06 | Implementation traceability to spec | RTM forward trace | Wiegers ch. 30 |

### D4 — Quality Assurance (8 подзон)

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D4-01 | Unit testing | TDD; xUnit family | Beck *Test-Driven Dev* |
| D4-02 | Integration testing | ISTQB testing pyramid | ISTQB FL Syllabus |
| D4-03 | End-to-end (e2e) testing | Playwright / Cypress class | (industry tools) |
| D4-04 | Performance testing | Load / stress / spike | k6, Locust class tools; Bass on perf |
| D4-05 | Security testing | DAST / SAST / pen-testing | OWASP Top 10; STRIDE-driven |
| D4-06 | Regression testing | Automated regression suites | ISTQB FL |
| D4-07 | Manual / exploratory QA | Whittaker exploratory testing | Whittaker *Exploratory Software Testing* 2009 |
| D4-08 | Test data management | Test data discipline; PII-safe seeds | (industry practice) |

### D5 — Operations & Feedback (8 подзон)

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D5-01 | Monitoring (metrics/SLI) | Google SRE | SRE Book ch. 4 |
| D5-02 | Alerting (SLO-driven) | Google SRE error budgets | SRE Book ch. 4-5 |
| D5-03 | Logging | structured logs; logfmt / json | (industry practice) |
| D5-04 | Incident response | postmortems; incident command | SRE Book ch. 14 |
| D5-05 | SLO tracking | Google SRE | SRE Book ch. 4 |
| D5-06 | Capacity planning | Google SRE; load forecasting | SRE Book ch. 18 |
| D5-07 | Deployment strategies (canary, blue-green, feature flag) | Continuous Delivery | Humble & Farley 2010 |
| D5-08 | Rollback / disaster recovery | DR planning; chaos engineering | Netflix Chaos Monkey practice |

### D6 — Meta: Ecosystem Governance (6 подзон)

| ID | Функция | Industry anchor | Source |
|---|---|---|---|
| D6-01 | Decision Records (ADRs / DEC-*) | Nygard ADR | Nygard 2011 |
| D6-02 | Retrospectives / phase closure | Scrum retro; Lean retrospective | Schwaber *Scrum Guide* |
| D6-03 | Phase kickoff readiness gates | Stage-Gate (Cooper); modified for Lean | Cooper 2008; критика Cagan |
| D6-04 | Pattern library / anti-pattern catalog | (composite) | Fowler *Patterns of Enterprise App Architecture* |
| D6-05 | Self-improvement / meta-feedback | (emerging) Constitutional AI; evaluator-optimizer | Anthropic CAI 2022 |
| D6-06 | Drift detection at meta-level | (emerging in AI agents); IaC drift в soft eng | Anthropic introspection; HashiCorp |

**Всего подзон по D1-D6:** 46.

---

## 03.3 Чеклист покрытия

**Шкала** (см. overview §2.2): ✗ 0 / ◔ 1 / ◐ 2 / ● 3 / N/A. **Locus:** CC / EXT / HYB / N/A.

### D1 — Product Discovery & Strategy

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D1-01 | Problem Discovery | ● 3 | `[C]` | CC | PS singleton + skill `problem-discovery.md` + 5-8 уточняющих вопросов |
| D1-02 | Market Research | ● 3 | `[C]` | CC | MR singleton; Quick mode skill + Deep mode subagent (отложен v1.1, но Quick — operational) |
| D1-03 | Competitive Analysis | ● 3 | `[C]` | CC | CA singleton; Quick mode operational; Deep — v1.1 |
| D1-04 | Segment & JTBD | ● 3 | `[C]` | CC | SEG-* artifacts; JTBD внутри SEG; skill `segment-discovery.md` |
| D1-05 | Hypothesis Formulation | ● 3 | `[C]` | CC | HYP-* artifacts с testing/validated/invalidated/deferred phases; skill `hypothesis-formulation.md` |
| D1-06 | MVP Scope Definition | ● 3 | `[C]` | CC | MVP singleton + skill `mvp-scoping.md` (MoSCoW discipline) |
| D1-07 | Product Roadmap | ● 3 | `[C]` | CC | RM singleton + skill `roadmap-planning.md` (3-6 месяцев horizon, directions не features) |
| D1-08 | Release Planning | ● 3 | `[C]` | CC | RL-* artifacts + skill `release-planning.md` |
| D1-09 | Feature Prioritization | ◐ 2 | `[C]` | CC | Continuous dialog через `/product:status` + обсуждение, не периодический ритуал (DEC-P07). Индустрия: Cagan, RICE, MoSCoW formal scoring; ты используешь priority field в FM frontmatter, без formal scoring framework. |

### D2-Behavioral

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D2-B-01 | Project Context Setup | ● 3 | `[C]` | CC | Inherits from D1 + bootstrap; никакого отдельного «context spec» — это правильно |
| D2-B-02 | Feature Specification (behavior) | ● 3 | `[C]` | CC | SC + BR + LC + VC + IC + RPM full behavior spec через P2 process |
| D2-B-03 | UX/UI Design | ● 3 | `[C]` | HYB | conditional has_ui; MK + DS + NM в `.product/`; визуальные mockups в Stitch (EXT) или HTML fallback. Hybrid locus честно отражает dual-channel architecture. |
| D2-B-04 | Data Model Design (поведенческий) | ● 3 | `[C]` | CC | LC + IC покрывают entity behavioral model; tactical schema design делегирован D2-T |
| D2-B-05 | Adversarial Review | ● 3 | `[F/C]` | CC | Product DA с adaptive-depth; magnitude-driven trigger; см. Section 08 |

### D2-Technical (delegated, but functional expectations apply)

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D2-T-01 | Architecture Design | ◔ 1 | `[C]` | EXT (planned) | Acknowledged через handoff Section 12 (Dependencies & Context); делегировано в external tool через Integrator. **Нет integrated tool yet** в v1. Покрытие = 1 (acknowledged, не operationalized in any tool). |
| D2-T-02 | Architectural Review (multi-lens / эквивалент 6 призм) | ◔ 1 | `[F/C]` | EXT (planned) | **Пользователь явно спрашивал об этом.** Индустрия: ATAM имеет multi-lens architectural review. Product DA 6 lenses (scalability, reliability, edge cases, security, alternatives, user assumptions) — это **product-side adversarial review**, applies to specifications but не to architecture per se. Architecture review остаётся EXT-delegated; покрытие = 1 потому что нет интегрированного инструмента currently. **При `/integrator:add` потенциального инструмента — Integrator должен явно проверить, обещает ли инструмент architectural review subzone.** |
| D2-T-03 | API Contract Design | ◔ 1 | `[C]` | EXT (planned) | Через handoff RPM excerpt + future cc-sdd `/kiro:spec-design`. Acknowledged, не operational pre-Phase 5. |
| D2-T-04 | Spike / PoC management | ◔ 1 | `[C]` | EXT (planned) | Acknowledged; handoff `--mode draft` поддерживает PoC ranges (relaxed DoR). Spike-as-discrete-artifact не codified в `.product/` schema. |

### D3 — Development & Delivery

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D3-01 | Code-level review | ◔ 1 | `[C]` | EXT (planned) | Acknowledged через handoff `embedded_artifacts` + future implementation tool. Нет integrated tool yet. |
| D3-02 | Change management / branching | ◔ 1 | `[C]` | EXT (planned) | Acknowledged. Принципы git workflow можно делегировать (git itself + tool). Не codified в Product Module. |
| D3-03 | Dependency management | ◔ 1 | `[C]` | EXT (planned) | Acknowledged. Зона implementation tool. |
| D3-04 | Build automation / CI | ◔ 1 | `[C]` | EXT (planned) | Acknowledged. Зона implementation tool. |
| D3-05 | Code generation (LLM-assisted) | ◔ 1 | `[F]` | EXT (planned) | Emerging area; cc-sdd / Kiro / beads — потенциальные инструменты. Acknowledged через handoff design. |
| D3-06 | Implementation traceability to spec | ◐ 2 | `[C]` | HYB | Forward trace частично через handoff hash-locking + V-I-* (Integrator namespace) для cross-boundary check (FM shipped → .kiro/specs exists). Backward trace — manual (нет «code → which spec» автоматического lookup). |

### D4 — Quality Assurance

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D4-01 | Unit testing | ◔ 1 | `[C]` | EXT (planned) | Acknowledged via VC (verification criteria) → tests. Нет integrated tool yet for actual unit test execution. |
| D4-02 | Integration testing | ◔ 1 | `[C]` | EXT (planned) | **Пользователь явно спрашивал об этом.** Acknowledged: integration testing должно быть подзоной D4 функциональных ожиданий. Реализация — через future testing tool через Integrator. Покрытие = 1 (заявлено, не operational). |
| D4-03 | End-to-end testing | ◔ 1 | `[C]` | EXT (planned) | Acknowledged. Playwright MCP упомянут в Integrator MCP stack (situational). Не активирован v1. |
| D4-04 | Performance testing | ◔ 1 | `[C]` | EXT (planned) | Acknowledged через NFR performance category + sanity ranges. NFR-* предписывают targets; verification — EXT zone. |
| D4-05 | Security testing | ◔ 1 | `[C]` | EXT (planned) | Acknowledged через NFR security + Product DA security lens (Section 08). Реальный security testing (DAST/SAST/pen-test) — EXT. |
| D4-06 | Regression testing | ◔ 1 | `[C]` | EXT (planned) | Acknowledged. VC Set per FM как regression spec source. EXT execution. |
| D4-07 | Manual / exploratory QA | ◔ 1 | `[C]` | EXT (planned) | Acknowledged. Cadence не codified. |
| D4-08 | Test data management | ◔ 1 | `[C]` | EXT (planned) | Acknowledged через VC «Example data» поля. EXT zone for actual test fixtures. |

### D5 — Operations & Feedback

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D5-01..08 | Все подзоны | ✗ 0 — ◔ 1 | `[C]` | EXT (planned, deferred to v2) | **D5 как целая зона отложена в v2** (DEC-P08; нет D5 monitoring tooling в v1 scope). NFR sanity ranges declare targets per tier (= acknowledgment), но мониторинг не реализован. **Это значимый gap, влияющий на замыкание Build-Measure-Learn loop** (см. Section 01 #3, Section 02 §02.4.4). |

| D5-01 | Monitoring | ◔ 1 | `[C]` | EXT (planned, v2) | NFR performance + reliability targets declared |
| D5-02 | Alerting | ✗ 0 | `[C]` | N/A (deferred) | Не addressed |
| D5-03 | Logging | ✗ 0 | `[C]` | N/A (deferred) | Не addressed |
| D5-04 | Incident response | ✗ 0 | `[C]` | N/A (deferred) | Не addressed |
| D5-05 | SLO tracking | ◔ 1 | `[C]` | EXT (planned, v2) | NFR targets ≈ SLO declarations; tracking infrastructure absent |
| D5-06 | Capacity planning | ✗ 0 | `[C]` | N/A (deferred) | Не addressed |
| D5-07 | Deployment strategies | ◔ 1 | `[C]` | EXT (planned, v2) | RL.frontmatter `rollout_plan` mentions canary/feature-flag opportunities; не enforced |
| D5-08 | Rollback / disaster recovery | ✗ 0 | `[C]` | N/A (deferred) | Не addressed |

### D6 — Meta: Ecosystem Governance

| ID | Подзона | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| D6-01 | Decision Records | ● 3 | `[C]` | CC | DEV_JOURNAL + decision-journal (per-project + global) + конвенция нумерации DEC-*. Direct Nygard ADR practice. |
| D6-02 | Retrospectives / phase closure | ● 3 | `[F/C]` | CC | D7 module: phase-closure.md checklist, phase-kickoff.md checklist, hook reminder. Direct Scrum retro adapted to phase-driven solo development. |
| D6-03 | Phase kickoff readiness | ● 3 | `[F/C]` | CC | `dev/PHASE_<N>_READINESS.md` + checklist; явный gate перед phase start. Modified Stage-Gate (Cooper) под Lean discipline. |
| D6-04 | Pattern library / anti-pattern catalog | ◐ 2 | `[F/C]` | CC | `/product:patterns` skill + meta-improvement patterns; anti-pattern library частичная (некоторые в SPEC §«AP-*», некоторые ad-hoc). Полная сводка — Section 13 этого референса (новая). |
| D6-05 | Self-improvement / meta-feedback | ◐ 2 | `[F]` | CC | `/product:meta-feedback` команда + skill (C3 modification). Класс SPECULATIVE по maturity — frontier work. |
| D6-06 | Drift detection at meta-level | ◐ 2 | `[F]` | CC | `/product:drift-check` (C1) + skill `drift-detector.md`. Класс SPECULATIVE. |

---

## 03.4 Нарративный анализ соответствия

### 03.4.1 D1 — почти полное покрытие, единственная ◐ 2 в D1-09

**Match.** D1 — твой strongest domain by design (assumption: solo + AI = excellent at Discovery). Все 9 подзон operationalized.

Единственный partial — D1-09 Feature Prioritization. Conscious cut с rationale в DEC-P07 («continuous dialog, not ritual»). Но **индустрия** имеет formal scoring (Cagan opportunity, RICE, MoSCoW); чисто continuous dialog рискует **prioritization drift** (никаких anchors). **Отслеживай в снапшоте:** появление формального scoring в FM frontmatter (например, `priority_score: rice(reach=X, impact=Y, confidence=Z, effort=W)`) — sign of maturation.

### 03.4.2 D2-Behavioral — full coverage с одной HYB-функцией

**Match.** D2-B все 5 подзон — покрытие 3. D2-B-03 (UX/UI Design) — locus HYB честно отражает dual-channel architecture: structured metadata в CC (`.product/mockups/`), визуальные mockups в Stitch (EXT). Это **good fitness design** — каждая часть в своей оптимальной locus.

### 03.4.3 D2-Technical — Architectural Review specifically

**Conscious gap with explicit acknowledgment.** Ты конкретно спросил про «6 призмы» применимость к архитектурному ревью. Ответ:

- **Product DA** уже использует 6 lenses (scalability, reliability, edge cases, security, alternatives, user assumptions). Но Product DA проходит **продуктовые артефакты** (FM, SC, BR, LC, IC, NFR). Не archтectural artifacts.
- **Architectural review** в индустрии — отдельная дисциплина (ATAM от SEI; Architecture Decision Records). Применяется к D2-T artifacts (architecture diagrams, ADRs, API contracts).
- В Ecosystem 3.0 **D2-Technical делегирован EXT через Integrator**. Functional expectation — должен ли integrated tool обещать architectural review subzone? **Yes,** если речь идёт о non-trivial system. Например, cc-sdd при `/kiro:spec-design` теоретически может включать architecture review (зависит от tool feature set).

**Отслеживай в снапшоте:** при `/integrator:add <tool>` — Integrator должен заполнять `pmo-mapping.yaml` per subzone D2-T, и явно отмечать D2-T-02 (architectural review) coverage этим инструментом. Если ни один integrated tool не покрывает — это сигнал **gap**, не делегированный по умолчанию.

**Potential improvement to ecosystem (post-pilot):** если оказывается, что architectural review остаётся uncovered после Integrator подключений, появляется фундаментальный вопрос — реализовать как separate Product Module-side capability (similar to Product DA, но adapted to architecture)? Или явно положиться на review-в-исходном-инструменте? Решение должно быть осознанным.

### 03.4.4 D3 — fully delegated, all 1's

**Conscious by design.** Tool-agnostic делегирование D3 — fundamental decision (DEC-A06). Все подзоны acknowledged через handoff schema; реализация — through future tool via Integrator (Phase 5).

**Caveat:** D3-05 (Code generation, LLM-assisted) — emerging area. Индустрия не имеет canonical practices yet. Potential coverage strategy — это interface при `/integrator:add cc-sdd` или похожий tool.

**Отслеживай в снапшоте:** появление D3-* подзон at coverage 2-3 + locus EXT — это сигнал, что Phase 5 implemented and first tool integrated.

### 03.4.5 D4 — все 1's, но critical gap

**Conscious gap with concern.** D4 (Quality Assurance) — fully delegated, but D4 **активно влияет** на validated learning loop. VC artifacts declare verification criteria; without execution platform, VC become **bookkeeping, not living verification**.

Это **самый серьёзный** functional gap в твоей системе на 2026-04-29. Не критично pre-pilot; **становится критичным сразу post-pilot**.

**Отслеживай в снапшоте:** при первом реальном handoff через Integrator → first execution tool — D4 подзоны должны начать получать coverage 2-3.

### 03.4.6 D5 — отложен в v2

**Conscious. Per DEC-P08.** D5 (Operations & Feedback) is the deepest gap, но это также outside reasonable v1 scope (нет реальных пользователей, нет реальных systems running, ergo нет данных для monitoring).

**Risk:** P3 Feedback Integration depends on D5; until D5 functional, learning loop не закрыт (см. Section 01 #3).

**Отслеживай в снапшоте:** появление любых D5 подзон at coverage > 0 — это significant maturation event, требует DEV_JOURNAL.

### 03.4.7 D6 — solid coverage, два SPECULATIVE items

**Match.** D6-01 (Decision Records), D6-02 (Retros), D6-03 (Phase kickoff) — все на 3. Direct conformance + fitness adapted to phase-driven solo dev.

D6-05 (Self-meta-feedback) и D6-06 (Drift detection) — at coverage 2, both SPECULATIVE per maturity. Это **frontier work** — не недоделка.

### 03.4.8 «Что не покрыто этой ecosystem'ой» — sanity check

**По industry-функциональному списку D1-D6:**
- D1: 9/9 covered
- D2-B: 5/5 covered
- D2-T: 0/4 fully covered (4 acknowledged at 1, all EXT)
- D3: 0/6 fully covered (all 1, all EXT)
- D4: 0/8 fully covered (all 1, all EXT)
- D5: 1/8 partially acknowledged, rest deferred v2
- D6: 4/6 fully, 2 partial (frontier)

Ecosystem 3.0 v1 покрывает **D1 + D2-B + D6**. D2-T, D3, D4 acknowledged-but-delegated. D5 deferred.

Это правильное scope для v1 (per ROADMAP). Track in snapshot N+1: какие подзоны из D2-T/D3/D4 переходят 1 → 2-3 (через Integrator+tool integration) — это primary maturation vector.

---

## 03.5 Анти-паттерны для отслеживания

1. **Subzones blurred into single «D4 covered».** Симптомы: pmo-mapping.yaml декларирует «D4 covered by tool X confidence:high», но конкретные подзоны (D4-01..08) не проверяются. **Источник:** ISTQB taxonomy — testing pyramid имеет смысл только если разделять.

2. **Architectural review absent from any tool.** Симптомы: cc-sdd integrated, но D2-T-02 остаётся coverage 1. **Источник:** ATAM — architectural review is foundational; absence = significant risk.

3. **D4 tool обещает «testing» без декомпозиции.** Симптомы: tool profile says «covers D4», но не уточняет которые подзоны. **Источник:** ISTQB FL Syllabus — tester doesn't say «I do testing», says «I do unit + integration» specifically.

4. **D5 covered by tool, but no SLO discipline.** Симптомы: monitoring tool integrated, но NFR-* targets не используются как SLO foundation; alerting не SLO-driven. **Источник:** Google SRE Book — SLI/SLO discipline is the **whole point**; monitoring без SLO = vanity dashboards.

5. **D6 absorbed into D5 metrics.** Симптомы: «meta-governance» reduced to «monitoring of metrics dashboard». ADRs, retros, drift-check stop happening. **Источник:** Nygard ADR practice — governance is about decisions, not numbers.

6. **Subzone coverage drifts to 1's silently.** Симптомы: snapshot N+1 shows coverage 2 → 1 на нескольких подзонах (functions deprecated, tool removed), без DEV_JOURNAL entry. **Источник:** general drift detection; mandated by overview §2.2.

---

## 03.6 Сигналы для сравнения снапшотов

### Per domain

1. **D1 coverage stability.** Если на pre-PILOT POINT любая D1 подзона падает 3 → 2, это **regression**.
2. **D2-Behavioral additions.** Появилась ли D2-B-06 или дальше? Если да, что добавили и почему?
3. **D2-Technical Integrator integration.** Подключён ли первый D2-T tool? Какие подзоны обещает?
4. **D3 first tool integration.** Тот же вопрос для D3.
5. **D4 subzone progression.** Из 8 подзон — какие первыми переходят 1 → 2-3? Обычно integration testing / e2e идут раньше performance / security.
6. **D5 first activation.** Когда первая D5 подзона выходит из 0/1?
7. **D6 stability.** D6-01..03 на 3 — должны оставаться. D6-04..06 — могут двигаться.

### Cross-domain

8. **Locus distribution.** % per CC / EXT / HYB / N/A. Healthy ratio для maturing v1: CC высокий (D1+D2-B+D6); EXT растёт (D2-T+D3+D4 как Integrator продвигается); HYB для D2-B-03 (UI). Если CC растёт за счёт EXT — это «overflow into ecosystem», suspicious. Если EXT растёт за счёт CC — это «migration outward», normal maturation.
9. **Total subzone count.** Если новый snapshot имеет +5-10 подзон — почему? Это (a) industry decomposition extended, (b) ecosystem capability expansion?
10. **Subzones marked N/A → moved out.** Какие? Был ли rationale в Section 12?

---

**Конец раздела 03.**
