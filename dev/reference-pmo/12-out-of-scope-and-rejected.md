# 12. Out of Scope и Explicitly Rejected

> **Назначение раздела:** **явный список** функций, которые экосистема **сознательно** не покрывает, с rationale per item и **reconsideration triggers** — что должно произойти, чтобы пересмотреть отказ.
>
> **Структура** (адаптированная — без Industry Reference и Function Inventory):
> - **Категория 1: Rejected** — функции, которые в принципе не нужны solo + AI + tool-agnostic экосистеме
> - **Категория 2: Delegated** — функции, которые есть, но реализуются external tool через Integrator (или harness)
> - **Категория 3: Deferred** — функции, которые планируются, но позже (v1.1, v2)
> - **Категория 4: Optional enrichment** — функции, добавление которых не нужно, но не было бы дрейфом
>
> Для каждого item:
> - **Source / school** — откуда индустриальная функция
> - **Function it covers** — что бы покрыло, если б добавили
> - **Why excluded / deferred** — rationale
> - **Reconsideration trigger** — конкретное событие, которое должно подтолкнуть пересмотр

---

## 12.1 Категория 1: Rejected

Функции, **в принципе не нужные** solo + AI экосистеме. Появление в snapshot N+1 — серьёзный сигнал scope creep, требует DEV_JOURNAL entry и rationale.

### R-01. Portfolio / Program Management

- **Source:** PMI PMBOK; PMO как организационная структура; OPM3
- **Function it covers:** Балансировка нескольких параллельных продуктов, ресурсные конфликты, cross-product roadmap
- **Why excluded:** Solo разработчик. Нет нескольких параллельных продуктов с конкурирующим бюджетом ресурсов. Один человек может работать над несколькими проектами, но это не тот же случай (нет shared budget).
- **Reconsideration trigger:** Если когда-то экосистема будет использоваться командой 3+ человек, ведущей 2+ продукта одновременно. Не до этого момента.

### R-02. Resource Allocation & Budgeting

- **Source:** PMI; classic project management
- **Function it covers:** Выделение людей и денег по задачам; tracking burn rate; cost forecasting
- **Why excluded:** Solo. Нет команды для allocation; нет финансового бюджета продукта pre-pilot. Если будет — это на уровне человека, не PMO.
- **Reconsideration trigger:** Появление команды или формального продуктового бюджета с tracking requirements.

### R-03. Stakeholder Communication Plan

- **Source:** PMI; PRINCE2
- **Function it covers:** Identification of stakeholders, communication cadence, escalation paths
- **Why excluded:** Solo. Нет внешних stakeholders pre-pilot. После pilot — pilot users не stakeholders в традиционном смысле; их нужды покрываются HYP validation.
- **Reconsideration trigger:** Multiple investor relationships, board requirements, или formal partnerships requiring tracked communication.

### R-04. Vendor / Contract Management

- **Source:** PMI; SaaS procurement practices
- **Function it covers:** Vendor evaluation, contract negotiation, SLA tracking, renewals
- **Why excluded:** Solo не подписывает enterprise контрактов с vendors. Tools покупаются как individual subscriptions.
- **Reconsideration trigger:** Enterprise SaaS contract requiring tracked terms; multiple vendors with overlapping coverage requiring conflict resolution.

### R-05. PMO Staffing, Hiring, Role Design

- **Source:** PMI organizational design; Cagan team structure
- **Function it covers:** Determining who does what, hiring criteria, role boundaries
- **Why excluded:** N/A для solo.
- **Reconsideration trigger:** Hiring first team member with formal product role.

### R-06. Classical PMI / PRINCE2 / SAFe Ceremony

- **Source:** PMI PMBOK 7; PRINCE2; Scaled Agile Framework
- **Function it covers:** Formal project ceremonies — kickoff meetings, status reports, gate reviews, audit trails
- **Why excluded:** Optimized для organizational coordination, multi-stakeholder reporting, audit compliance — none of which apply to solo. Adding would be ceremony overhead without function.
- **Reconsideration trigger:** Regulatory requirement (например, FDA software regulation, financial audit), которое would require formal documented ceremony; or multi-team coordination at scale.

### R-07. OKRs at Product Level

- **Source:** Doerr *Measure What Matters*; Andy Grove; Google OKRs adaptation
- **Function it covers:** Quarterly outcome alignment; team-level KR tracking
- **Why excluded:** Heavy machinery для solo с single primary HYP chain. HYP с success/invalidation thresholds covers the «what's our outcome and how do we measure» function. OKRs add quarterly cadence + multi-objective tracking, который overkill.
- **Reconsideration trigger:** Multi-objective product strategy (3+ concurrent strategic bets) OR team coordination at small org scale (5+ people) OR investor reporting cadence.

### R-08. Event Storming (Brandolini)

- **Source:** Alberto Brandolini, *Introducing EventStorming* (Leanpub)
- **Function it covers:** Group workshop technique для discovering domain через event-first modeling; identifies aggregates, bounded contexts, hot spots
- **Why excluded:** **Group practice.** Solo + AI не может perform Event Storming meaningfully (the value is in cross-functional discussion). LC (entity lifecycles) + IC (invariants) cover the analytical output для solo.
- **Reconsideration trigger:** Adding team members to product work; or meeting domain expert for time-boxed discovery session that benefits from event-first framing.

### R-09. Wardley Mapping

- **Source:** Simon Wardley *Wardley Maps* (CC-licensed book)
- **Function it covers:** Strategic positioning of components on evolution axis (genesis → custom-built → product → commodity); strategy decisions about build vs buy vs adopt
- **Why excluded:** Strategic tool, **premature для pre-pilot solo**. Useful когда product has multiple components с different evolution states; pre-pilot solo product typically dominating components are «custom-built or genesis», so map is degenerate.
- **Reconsideration trigger:** Product reaches state where build-vs-buy-vs-adopt decisions become frequent (typically post-PMF); или Integrator catalog grows to 10+ tools requiring strategic positioning.

### R-10. Disciplined Agile / SAFe / LeSS

- **Source:** Disciplined Agile (Ambler); SAFe (Leffingwell); LeSS (Larman & Vodde)
- **Function it covers:** Enterprise agile scaling frameworks; multi-team coordination; release train management
- **Why excluded:** Enterprise scaling. Solo doesn't scale.
- **Reconsideration trigger:** Adopting team of 50+ people с multiple product trains.

### R-11. Theory of Constraints (Goldratt)

- **Source:** Eliyahu Goldratt, *The Goal* (1984); ToC for IT (DeMarco)
- **Function it covers:** Identifying and managing bottlenecks в production systems
- **Why excluded:** Manufacturing optimization origins; applied to IT operations, but operational optimization is не PMO function. Solo+AI не имеет flow that benefits from ToC analysis pre-pilot.
- **Reconsideration trigger:** Production system с throughput problems, которые PMO needs to model (unlikely at solo scale).

### R-12. Business Model Canvas (Osterwalder)

- **Source:** Osterwalder *Business Model Generation* (2010)
- **Function it covers:** Whole-business modeling — 9 blocks describing how org creates/delivers/captures value
- **Why excluded:** Whole-business scope. Ecosystem 3.0 manages **product** lifecycle; business model is broader. Could be useful but adding it expands scope significantly.
- **Reconsideration trigger:** Need to model business model (financing, channels, customer segments at business level) — likely при investor pitch preparation or business pivot consideration.

### R-13. Domain Events as First-Class Artifact

- **Source:** DDD (Vernon 2013) — domain events для event-sourced architectures
- **Function it covers:** First-class artifact для domain events; event-sourced architecture support
- **Why excluded:** Most products are CRUD-style; domain events are implicit в SC steps. Adding event artifact would be over-engineering для typical product.
- **Reconsideration trigger:** Building an event-sourced or CQRS architecture где events are persistent infrastructure; or messaging-heavy system где event taxonomy is critical.

### R-14. Cryptographic Signatures на Handoff

- **Source:** SLSA framework; sigstore; supply-chain security
- **Function it covers:** Cryptographic proof of artifact provenance; tamper detection beyond hash
- **Why excluded:** Overkill для solo. Hash-pinning (V-H-02) covers integrity check; signing adds complexity без proportional benefit.
- **Reconsideration trigger:** Multi-author signed handoffs (team scale); regulatory audit requiring provenance proof.

---

## 12.2 Категория 2: Delegated to External Tool / Harness

Функции, которые **присутствуют как функциональные ожидания** (в Section 03), но реализация — за пределами Product Module (через Integrator + tool, или через harness). **Это НЕ rejected**; coverage может быть высокой через external locus.

### D-01. C4 Architectural Diagramming

- **Source:** Simon Brown, c4model.com; *Software Architecture for Developers* (Leanpub)
- **Function it covers:** Hierarchical architecture documentation (Context → Container → Component → Code)
- **Why delegated:** D2-Technical зона; реализуется implementation tool (cc-sdd `/kiro:spec-design` потенциально включает architecture sections).
- **Reconsideration trigger:** Need to formalize C4-like architecture artifact в `.product/` directly (rather than rely on external tool output) — likely if external tool output proves inadequate.

### D-02. Implementation Methodologies для D2-Tech

- **Source:** Martin Fowler refactoring; specific framework practices
- **Function it covers:** **Как** проектировать APIs, **как** моделировать данные, **как** управлять spike outputs
- **Why delegated:** Tool-specific knowledge. cc-sdd / Kiro / etc. encode methodology в их docs.
- **Reconsideration trigger:** Cross-tool methodology preferences emerging that warrant ecosystem-level convention.

### D-03. Implementation Methodologies для D3 (Code Generation, CI, Branching)

- **Source:** *Accelerate* (Forsgren); modern DevOps practices
- **Function it covers:** **Как** писать код, **как** управлять branches, **как** настроить CI
- **Why delegated:** Tool-specific (beads, GSD, Cursor, Claude Code agents). Codified in tool docs.
- **Reconsideration trigger:** То же.

### D-04. Implementation Methodologies для D4 (Testing Frameworks)

- **Source:** ISTQB; framework-specific docs (pytest, Playwright, k6)
- **Function it covers:** **Как** структурировать unit tests, **как** писать e2e flows, **как** load test
- **Why delegated:** Tool-specific. Function (subzones D4-01..D4-08) acknowledged в Section 03.
- **Reconsideration trigger:** То же.

### D-05. Implementation Methodologies для D5 (Monitoring, SRE)

- **Source:** Google SRE Book; Prometheus / Grafana / Sentry docs
- **Function it covers:** **Как** настроить monitoring, **как** писать alert rules, **как** обрабатывать incidents
- **Why delegated:** Tool-specific. D5 zone deferred to v2 anyway.
- **Reconsideration trigger:** То же; or v2 D5 activation.

### D-06. Bounded Contexts Beyond `.product/`

- **Source:** DDD (Evans 2003) — multi-context architecture
- **Function it covers:** Multi-product workspace с separate ubiquitous languages
- **Why delegated:** Solo + single product = single bounded context. If multi-product workspace becomes need, this becomes architecture-level decision.
- **Reconsideration trigger:** Managing 2+ products с significantly different domain language; appearance of «workspace» level над `.product/` per-project.

---

## 12.3 Категория 3: Deferred (planned later)

Функции, которые **планируются**, но позже. Появление в снапшоте до соответствующего trigger'а — это **good progress**, не drift.

### F-01. Deep Mode Subagents (Discovery)

- **Source:** Adapted from 199-biotechnologies 8-phase research
- **Function it covers:** Deep mode market researcher / competitor analyst с full subagent pipeline
- **Why deferred:** Quick mode не валидирован pilot'ом (DEC-DEV-0012). Deep mode — premature без pilot evidence.
- **Reconsideration trigger:** 2-3 real Discoveries показывают конкретные limits Quick mode (per ROADMAP v1.1 trigger).

### F-02. Atomic Mass-Rename `/product:bg:rename`

- **Source:** IDE refactoring + DDD evolution principle
- **Function it covers:** Atomic mass-rename of BG terms across all artifacts с single git commit, conflict handling, rollback
- **Why deferred:** Manual preview workflow в v1 covers 80%; atomic в v1.1 (DEC-DEV-0012).
- **Reconsideration trigger:** 5+ mass-renames в течение месяца на active projects (per ROADMAP v1.1 trigger).

### F-03. Full BFS Cascade Auto-Fix Beyond V-11

- **Source:** RTM cascade analysis с auto-resolution
- **Function it covers:** Auto-fix downstream artifacts on upstream change beyond V-11 bi-dir refs (например, V-08 terminology auto-update, dependency status)
- **Why deferred:** Detection-only scope в v1 (DEC-DEV-0012); full в v1.1.
- **Reconsideration trigger:** Pattern emerges из `cascade-pending.yaml` resolutions — same fix done 5+ times manually.

### F-04. Bundle Approve UX для Cascade

- **Source:** Git interactive staging analog
- **Function it covers:** Consolidated diff + approve all/per-item UI для cascade-detected impact
- **Why deferred:** Tied to F-03 atomic cascade.
- **Reconsideration trigger:** То же что F-03.

### F-05. P3 Feedback Integration

- **Source:** Lean Startup Build-Measure-Learn closure
- **Function it covers:** Feedback ingestion, HYP invalidation triggers, pivot prompt
- **Why deferred:** D5 monitoring tooling absent (DEC-P08). Function depends on D5.
- **Reconsideration trigger:** D5 tooling activated через Integrator.

### F-06. P5.B Actuality Refresh Automation

- **Source:** Stale detection scheduled
- **Function it covers:** Automated periodic check для refresh_by deadlines, stale drafts beyond V-12 threshold
- **Why deferred:** Нет triggering мechanism formalized (DEC-P03; OQ-10).
- **Reconsideration trigger:** 3-6 months real usage providing data о staleness patterns.

### F-07. Pivot/Persevere Protocol

- **Source:** Ries pivot taxonomy
- **Function it covers:** `/product:init --pivot` команда с cascade re-derivation, pivot type taxonomy, decision journal entry
- **Why deferred:** Q-11 «out-of-scope v1». Pre-pilot pivot is academic.
- **Reconsideration trigger:** First real pivot needed.

### F-08. Orchestrator Module

- **Source:** Tool orchestration; multi-agent coordination
- **Function it covers:** Run external tools в sequence per scenario; route between tools на основе PMO state
- **Why deferred:** «после MVP Integrator» (ROADMAP).
- **Reconsideration trigger:** Integrator MVP shipped + pilot demonstrating need for routing logic.

### F-09. NFR Tier Upgrade Automation

- **Source:** SRE tier discipline
- **Function it covers:** `/product:nfr:upgrade-tier` batch review; auto-detection of upgrade triggers
- **Why deferred:** Phase 4 deliverable.
- **Reconsideration trigger:** Phase 4 implementation.

### F-10. NFR Error Budgets

- **Source:** Google SRE error budget discipline
- **Function it covers:** Per-NFR error budget tracking (acceptable miss window)
- **Why deferred:** Requires real measurement infrastructure (D5).
- **Reconsideration trigger:** D5 monitoring active + multiple deployments providing budget consumption data.

### F-11. Visual OST (Opportunity Solution Tree)

- **Source:** Torres *Continuous Discovery Habits*
- **Function it covers:** Visual OST artifact rendering (graph from PS → SEG → VP → HYP → MVP)
- **Why deferred:** Graph implicit through cascade refs; visual rendering nice-to-have не core.
- **Reconsideration trigger:** User confusion about traceability through graph relationships.

### F-12. Weekly Discovery Refresh Cadence

- **Source:** Torres weekly customer touchpoints
- **Function it covers:** Cadence-driven Discovery refresh (PS/MR/CA review at fixed interval)
- **Why deferred:** Нет real customer base pre-pilot.
- **Reconsideration trigger:** Post-pilot, когда real users provide signal that justifies cadence.

### F-13. Critic Confidence Articulation

- **Source:** Tian/Lin verbalized confidence applied to critic outputs
- **Function it covers:** DA findings include critic's own confidence per finding
- **Why deferred:** Acknowledged Section 08 #7 partial; не critical.
- **Reconsideration trigger:** Pattern of DA findings dismissal that suggests critic might have flagged uncertain findings.

### F-14. Golden Set / Calibration Suite

- **Source:** Husain «Your AI product needs evals»; Anthropic/OpenAI evals
- **Function it covers:** Regression test fixtures для validation rules; calibration anchor для confidence:high
- **Why deferred:** Phase 4+ likely.
- **Reconsideration trigger:** First case of auto-approve mistake (artifact passed at confidence:high but turned out wrong); or validation rule refactor breaking detection silently.

---

## 12.4 Категория 4: Optional Enrichment

Не gap, не rejected. Если когда-то добавишь — это enrichment, не drift. Сейчас не нужно; **ничего не теряется**.

### O-01. EARS Notation в VC

- **Source:** Mavin (IEEE RE'09) — Easy Approach to Requirements Syntax
- **Function it covers:** Alternative to Gherkin для requirements (Ubiquitous, Event-driven, State-driven, Optional, Unwanted patterns)
- **Why optional:** Gherkin sufficient. EARS is alternative, не replacement.
- **Add when:** Если работаешь с safety-critical или regulatory-heavy domain где EARS more idiomatic.

### O-02. Outcome Statements (Ulwick JTBD)

- **Source:** Ulwick *Jobs to be Done* (2016); ODI methodology
- **Function it covers:** Quantitative outcome ratings (importance × satisfaction) for prioritization
- **Why optional:** Christensen-school JTBD covers most need; Ulwick's ratings add precision when needed.
- **Add when:** Many candidate FMs requiring data-driven prioritization across SEG.

### O-03. Forces of Progress (Klement JTBD)

- **Source:** Klement *When Coffee and Kale Compete*
- **Function it covers:** Switch interview structure (push, pull, anxiety, habit) для understanding customer transitions
- **Why optional:** Specialized technique; не all problems benefit.
- **Add when:** Customer transitions are core to business model (subscription churn, etc.).

### O-04. Impact Mapping (Adzic)

- **Source:** Adzic *Impact Mapping* (2012); impactmapping.org
- **Function it covers:** Visual goal → actor → impact → deliverable hierarchy
- **Why optional:** OST + RM cover similar function для solo.
- **Add when:** Need to visualize multi-stakeholder impact relationships.

### O-05. ATAM Architectural Review

- **Source:** Bass, Clements, Kazman *Software Architecture in Practice* — Architecture Tradeoff Analysis Method
- **Function it covers:** Multi-lens architectural review с formal scenario walkthroughs
- **Why optional:** Product DA 6 lenses adapt the multi-lens idea to product spec; full ATAM для architecture is heavier and tool-side.
- **Add when:** Architecture artifacts complex enough to warrant standalone review (например, distributed system design); usually delegated D2-T tool would handle.

### O-06. STRIDE Threat Modeling

- **Source:** Microsoft STRIDE; Shostack *Threat Modeling*
- **Function it covers:** Systematic security review per element (Spoofing/Tampering/Repudiation/Info-disclosure/DoS/Elevation)
- **Why optional:** Product DA security lens covers most need; STRIDE is more systematic.
- **Add when:** Security-critical product; or external compliance requirement.

### O-07. FMEA (Failure Mode and Effects Analysis)

- **Source:** AIAG-VDA FMEA Handbook; safety-critical engineering
- **Function it covers:** Systematic failure mode catalog с Severity × Occurrence × Detection scoring
- **Why optional:** IC + DA findings cover similar function для typical product.
- **Add when:** Safety-critical domain (medical, automotive); or insurance/regulatory requirement.

### O-08. Multi-product Workspace

- **Source:** DDD bounded contexts at workspace level
- **Function it covers:** Multiple `.product/` directories under shared workspace с cross-product BG, shared DS
- **Why optional:** Single product currently.
- **Add when:** Managing 2+ products simultaneously.

---

## 12.5 Сигналы для сравнения снапшотов для Section 12

При diff между снапшотами, изменения в/из этой секции звучат тревогу:

1. **R-* item appearing** в active functionality — серьёзный scope creep. Mandatory DEV_JOURNAL entry «почему мы теперь делаем X».
2. **D-* item moved to F-* or active** — locus shift; was delegated, теперь в CC. **Triggers DEV_JOURNAL** (overview §2.4).
3. **F-* item appearing** at coverage 2-3 — planned function shipped. **Good progress**, but verify, что bring-forward trigger был met.
4. **F-* item still pending after multiple snapshots without progress** — drift on roadmap commitments. Review priority.
5. **O-* item adopted** — enrichment. Не drift, but should have rationale «what triggered the addition».
6. **New item NOT в этой секции** — could be new function added without classification. Either: (a) добавить в Section 12, (b) добавить в Section 03/04 if functional ожидание.

---

**Конец раздела 12.**
