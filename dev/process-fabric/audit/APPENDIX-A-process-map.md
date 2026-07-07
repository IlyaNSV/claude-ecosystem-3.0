# Ecosystem 3.0 — Единая карта процессов + матрица связности

> Агрегат №1: свод 9 зонных ридеров в единый реестр процессов, матрицу межпроцессных связей,
> сквозной трейс «идея → прод» и разметку статус/детерминизм. Дедупликация пересечений зон
> выполнена (cascade/DA/handoff/validation фигурировали в 3-4 зонах каждый — сведены к одному
> процессу с указанием всех имплементирующих зон).

Легенда детерминизма: `DS`=deterministic-scripted · `PL`=procedural-llm · `JL`=judgment-llm ·
`CL`=creative-llm · `HD`=human-decision.
Легенда статуса: `impl`=implemented · `part`=partial · `stub`=skeleton/stub · `spec`=spec-only · `defer`=deferred.

---

## 1. ЕДИНЫЙ РЕЕСТР ПРОЦЕССОВ (сквозная нумерация, домен → процесс → субэтап)

### ДОМЕН A — Product Discovery & Definition (owned, детальный контроль: PMO D1 + D2-Behavioral)

| # | Процесс | Субэтапы (ключевые) | Детерм. | Статус | Триггер |
|---|---|---|---|---|---|
| A1 | **Discovery Session** (`/product:init`) = PMO D1-01..05 | D1.0 class → D1.1 PS → D1.2 MR → D1.3 CA → DRC bundle → D1.4 SEG → D1.4a VP → D1.5 HYP → BG-pass | PL | impl | `/product:init <idea>` |
| A2 | **Planning Session** (`/product:plan`) = D1-06..08 | MVP scope (MoSCoW) → Roadmap → RL-001 → per-FM skeletons | PL | impl | `/product:plan` |
| A3 | **Feature Definition** (`/product:feature`) = D2-B B01-B05 | F.2 SC → F.3 BR(+DA) → F.4 LC → F.5 IC(+DA) → F.5a NFR → F.6 VC → F.7 RPM → F.10 planned→in-progress | PL | impl | `/product:feature <FM\|idea>` |
| A4 | **NFR Review** (F.5a, two-phase) | Ask (mandatory) → Define (conditional) + sanity-range guard | JL | impl | inline F.5a / `/product:nfr-review` |
| A5 | **NOTE capture & promotion** | ≤30s capture → promote to FM/SC/BR/IC/NFR/HYP (atomic dual-write) | PL | impl | NL-intent / `/product:promote-note` |
| A6 | **Deep Discovery mode** (MR/CA subagents) | 8-фазный research pipeline через market-researcher/competitor-analyst | CL | **spec** | `/product:init --deep` |

### ДОМЕН B — Cross-cutting Validation & Consistency (safety-net поверх A)

| # | Процесс | Субэтапы | Детерм. | Статус | Enforcement-суть |
|---|---|---|---|---|---|
| B1 | **Validation engine** (44+2 правила, 5 точек) | inline hook → approve gate → handoff DoR → on-demand `/product:validate` → periodic(нереализ.) | DS | part | реальные hooks; periodic отсутствует |
| B2 | **Cascade Consistency** (V-11 auto-fix + BFS) | detect dependents → V-11 auto-rewrite → queue остального → `/product:cascade` | PL/DS | part | v1: только V-11 auto-fix; full BFS→v1.1 |
| B3 | **DA Review** (P-RULE-01/02, adaptive-depth) | hook сигнал → spawn `product-devils-advocate` → classify cosmetic/significant → 6-lens → act/defer/dismiss | JL | part | **spawn = prompted (известный regression)** |
| B4 | **Business Glossary extraction** | hook scan bold → candidates.yaml → classify → per-term approve → commit | PL/DS | part | atomic mass-rename→v1.1 (ручной sed) |
| B5 | **Design System mechanism** (для MK) | auto-extract tokens → normalize DS → V-MK-08 coverage check | PL | impl | blocking V-MK-08 |
| B6 | **Validation overrides** (project/artifact/approve) | severity override / disable (rationale+approved_by) / gate-bypass (expires_at) | HD | part | expires_at sweep НЕ реализован |
| B7 | **validation-tune** (C3, project-local + escalation) | detect FP pattern → proposal → Y/N/E/D → config edit ИЛИ escalate systemic | JL | impl | целиком prompted (нет автодетектора) |
| B8 | **Handoff generation** (13 секций, SHA-256) | load FM → drift-hash → DoR (8/3 blockers) → overrides → hash → write | PL | impl | blocking на 🔴 DoR |
| B9 | **Cleanup / orphan** (V-15) | orphan detect → pending-hygiene sweep → archive/delete | PL | impl | — |
| B10 | **Drift-check** (C1) | anchor (PS/HYP/MVP) → per-artifact alignment → 🟢🟡🔴 | JL | impl | non-blocking self-audit |
| B11 | **Pattern lint** (C4, 11 anti-patterns) | per-pattern heuristic → severity aggregate | JL | impl | non-blocking |
| B12 | **Lesson capture** (find→fix→verify→record) | write-ahead open → fix → verify → draft → re-verify(Y/E/N) → commit open→active | PL/DS | impl | **Stop-hook blocks (единств. blocking по умолч.)** |
| B13 | **Artifact catalog** (24 типа + граф зависимостей) | PS→MR/CA/SEG→VP→HYP→MVP→RM/RL/FM→SC↔BR→LC/VC/IC + BG/RPM/NFR/AM | PL | impl | review-level per тип 🔴🟠🟡🟢 |

### ДОМЕН C — Autonomous Product Layer (Epic B/C/D — надстройка над A/B)

| # | Процесс | Субэтапы | Детерм. | Статус | Ключевой рельс |
|---|---|---|---|---|---|
| C1 | **Completeness-loop** (`/product:complete`) | SCORE(oracle.cjs)→SURFACE(персоны)→CLASSIFY(gap-classifier.cjs)→RESOLVE→ESCALATE→RE-SCORE | PL+DS | part | внешний DS stop-signal enforced; auto-fix консервативен |
| C2 | **Consilium** (`/product:consilium`) | LOAD PA + fork-guard → SCOPE → JURY (parallel персоны) → SYNTHESIZE(consilium-synth.cjs) → RECOMMEND (prepare-only) | JL+DS | impl | PA никогда не закрывается кодом |
| C3 | **Batch-enrich** (`/product:batch-enrich`) | plan → per-FM STATUS→ENRICH→COMPLETE→GATE(boundary PA) → report | PL | impl | never transitions FM (prepare-only) |
| C4 | **A1 auto-approve** (LC/VC/RPM 🟢) | self-check confidence:high + V-05/06/07/11 → status=active + DEC-AUTO | PL | impl | revert-option |
| C5 | **Manual Product DA Review** (FM/RL) | ID-route → brief → DA Mode=full → per-finding resolution | JL | impl | recursive drill-down→v1.1 |

### ДОМЕН D — Design Module (P2.5, conditional has_ui)

| # | Процесс | Субэтапы | Детерм. | Статус |
|---|---|---|---|---|
| D1 | **Design session** (`/design:start`, D.1-D.6) | Brief🟡→ScreenGen🟠→Refine🟠→StateMatrix🟢→Artifact🟠→Export | PL | part |
| D2 | **screen-generator subagent** | spawn brief+SC+DS → N экранов → JSON+DS-suggestions | CL | **spec** (файла нет; inline через skill) |
| D3 | **Design artifact validation + App-Map cascade** | MK/DS/NM/AM frontmatter+refs+token-coverage; AM staleness drift | DS | impl/part |

### ДОМЕН E — Delegation Boundary: Integrator Module (методология D2-Tech/D3-D6 делегирована)

| # | Процесс | Роль | Детерм. | Статус |
|---|---|---|---|---|
| E1 | `/integrator:research <need>` | read-only tool discovery + hard approve gate | JL | impl |
| E2 | `/integrator:map` | coverage table | PL | impl |
| E3 | `/integrator:gaps` | uncovered zones + criticality | JL | impl |
| E4 | `/integrator:status` | full state overview (<2s) | PL | impl |
| E5 | `/integrator:journal` | decision journal view | PL | impl |
| E6 | `/integrator:scan` | environment baseline (protect user customizations) | PL | impl |
| E7 | `/integrator:add <tool>` | 6-stage install → fixture contract verify | PL | impl |
| E8 | `/integrator:update <tool>` | version bump + drift detect (D1/D2/D3) + repair | PL | part |
| E9 | `/integrator:remove <tool>` | destructive removal + impact + backup | PL | impl |
| E10 | **Adapter tri-location lifecycle** | repo canonical → reference copy → instance (+metadata) | DS | impl |
| E11 | **Handoff → adapter → external tool** | parse/validate/transform/apply pipeline | PL | part |
| E12 | **Contract registry + journal** (CNT/DEC-INT) | contracts + manual journal + autolog hook | DS | impl |
| E13 | **Scope-guard** (session-context marker) | warn на forbidden-path writes | DS | impl (warn-only) |
| E14 | `/integrator:replace/verify/debug/docs` | Phase 7 команды | PL/JL/DS | **spec** (implemented команды ссылаются на них) |
| E15 | **Feedback loop external→.product/** | вернуть результат внешнего инструмента | HD | **spec (НЕ ПОСТРОЕН)** |

### ДОМЕН F — Orchestrator Runtime (PMO-runtime над D2-Tech + D3+)

| # | Процесс | Субэтапы | Детерм. | Статус |
|---|---|---|---|---|
| F1 | **P2 decide-architecture-foundation** | brief-lift → жюри×3 parallel → synth(consilium-synth.cjs) → integration → DRAFT DEC → recommend PA | JL | impl |
| F2 | **P3 batch-features-to-cc-sdd** | init→steering(gate)→bridge(C-07 preflight)→author(kiro-spec-batch)→coverage-oracle→commit | PL | impl |
| F3 | **P4 audit-spec-fidelity** | fidelity-oracle + LLM auditor + design-coverage-oracle → triage spec-fix/product-feedback | JL | impl |
| F4 | **P5 feature-to-tdd-impl** | plan(gate-risk-classifier)→§6 detect→implement(TDD, remediation-guard)→validate(→P6) | JL | impl |
| F5 | **P6 validate-feature-impl** (GO/NO-GO) | mechanical(env+suite+build)→3 validators parallel→verify-finding→remediation→synth verdict(код) | JL | impl |
| F6 | **P7 runtime-smoke-readiness** | assess(runtime-readiness.cjs)→branch по verdict→живой boot(capture-don't-fix)→report | JL | **part** (boot substrate-gated) |
| F7 | **run-ledger** (VC-087/134) | start→launch Workflow→finish (duration/model-mix/verdict) | DS | **part** (wiring=prompted, не live-validated) |
| F8 | **Epic E deploy/provision/rollback** | CI/build→provisioning→deploy→monitoring | HD | **spec (НЕ НАЧАТ)** |

### ДОМЕН G — Делегированные PMO-домены (методология вовне)

| # | Процесс | Детерм. | Статус |
|---|---|---|---|
| G1 | **D3 Development & Delivery** (impl/review/integrate/build/deploy/docs) | HD | spec (delegated) |
| G2 | **D4 Quality Assurance** (test strategy → acceptance verification замыкает петлю к D2-B) | HD | spec (delegated) |
| G3 | **D5 Operations & Feedback** | HD | **defer (v2, DEC-P08)** |

### ДОМЕН H — Event Fabric (hooks — инфраструктура под A-F)

| # | Процесс | Детерм. | Статус |
|---|---|---|---|
| H1 | **Hook registration** (bootstrap manifest→settings.json) | DS | impl (prompted-запуск) |
| H2 | **~19 хуков** (11 на PostToolUse Write/Edit) | DS | impl — **только lesson-gate.js (Stop) блокирует по умолчанию**; остальные warn-only |
| H3 | **completeness-oracle.cjs / gap-classifier.cjs / zone-router** (lib) | DS | impl |
| H4 | **worktree-preflight advisory** | DS | impl (warn-only) |

### ДОМЕН I — Installation & Operator Lifecycle

| # | Процесс | Детерм. | Статус |
|---|---|---|---|
| I1 | `/ecosystem:bootstrap` (12 шагов greenfield) | PL | impl |
| I2 | `/ecosystem:update` (2-level wipe protection, namespace-aware) | PL | impl |
| I3 | `/ecosystem:verify` (10-step health check, self-limiting) | PL | impl |
| I4 | `/ecosystem:enable-d7-audit` (opt-in SessionEnd hook) | PL | impl (fragile hardcoded path) |
| I5 | `/ecosystem:meta-feedback` (systemic outbox UF-NNN) | JL | impl |
| I6 | `/ecosystem:pending-actions` (read-only PA viewer) | PL | impl |
| I7 | `/ecosystem:research` (Guided Research, 4 Pillars) | JL | part (Pillar C citation-engine spec-only) |
| I8 | **INFORMATION-MAP resolver** (15 классов информации) | PL | part (P3 verifiable-catalog guard не реализован) |
| I9 | **docs/guide navigation** (L0-L5 ladder + HTML-карты) | PL | impl |
| I10 | **npm run verify** (агрегат DS-тестов) | DS | impl — **enforced (CI/pre-commit)** |
| I11 | **BOOTSTRAP.md two-phase design** (global→per-project) | DS | impl |

### ДОМЕН J — D7 Meta-Improvement (governance над РАЗРАБОТКОЙ экосистемы, Level B)

| # | Процесс | Детерм. | Статус |
|---|---|---|---|
| J1 | **phase-kickoff** checklist (readiness gate) | PL | impl |
| J2 | **phase-closure** checklist (hygiene + built≠validated) | PL | impl |
| J3 | **patch-cut** checklist (version slice) | PL | impl |
| J4 | **live-run-validation** (dogfood, class A/B) | JL | impl (прогоны накапливаются pending) |
| J5 | **session-audit v2** (capture→classify→audit→journal→synth→gate) | JL+DS | impl (opt-in) |
| J6 | **process-gate.js** (commit-msg) | DS | impl — **blocking (единств. настоящий enforcement D7)** |
| J7 | **check-counts.js** (canonical-count reconciler 24/44) | DS | impl |
| J8 | **rails** (git→work-unit digest) | DS | impl |
| J9 | **memory-sync** skill | PL | impl (manual) |
| J10 | **next-dec-dev.js** (номер-аллокатор) | DS | impl (не атомарен — race×7) |
| J11 | **feedback-intake.js** (3 источника → unified, capture-don't-fix) | DS | impl |
| J12 | **pattern-library** (8 паттернов, 7 provisional/1 validated) | JL | impl |

### ДОМЕН K — Evolution / Governance planning (D6-level)

| # | Процесс | Детерм. | Статус |
|---|---|---|---|
| K1 | **STATUS SSOT pointer** («Где мы сейчас» ROADMAP) | PL | impl (behavioral, не enforced) |
| K2 | **Epic lifecycle A-G** (vision→kickoff→batch→build→live-validate) | PL | part |
| K3 | **DEC-DEV journaling** | PL | impl |
| K4 | **MDP delegation** (5-осей model-select + review) | HD | impl |
| K5 | **Autonomy Policy F1 resolver** (auto/gate/block, floor precedence) | DS | **stub (построен+70 юнитов, НЕ подключён никуда)** |

**Итого: 79 процессов** в 11 доменах. Из них полностью implemented ~52, partial ~11, stub/spec/deferred ~16.

---

## 2. МАТРИЦА МЕЖПРОЦЕССНЫХ СВЯЗЕЙ

Тип связи × надёжность. Надёжность: `ENF`=enforced (харнесс/код) · `PRM`=prompted (LLM-дисциплина) · `HM`=human-memory · `BRK`=broken/missing.

### 2.1. Внутри продуктового ядра (A↔B↔C)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| A1→A2→A3→B8 («Next: /product:X») | sequential | **PRM** | текстовая подсказка в конце команды, никакого state-machine |
| A3 F.3/F.5 (BR/IC write) → B3 (DA subagent) | event-triggered | **PRM** | hook пишет da-pending.yaml + stderr; spawn зависит от памяти оркестратора (**известный regression**) |
| A3 → B2 (cascade) на каждый active write | event-triggered | ENF(V-11)/PRM(rest) | cascade-check.js авто-фиксит V-11, остальное в очередь |
| A3/любой save → B1 (inline validate) | event-triggered | ENF | artifact-validate.js hook (warn-only surface) |
| A3/любой save → B4 (BG extract) | event-triggered | PRM | bg-extractor.js queue; per-term approve вне хука |
| A4 (NFR) inline из A3 F.5a | sequential | ENF | прямой вызов в skill |
| B12 (lesson) open → session | blocking-gate | **ENF** | lesson-gate.js Stop exit 2 (единственный default-blocking hook) |
| C1/C3 → architect/qa/ux-advisor персоны | parallel-spawn | ENF | Workflow runner .mjs спавнит canonical subagent_type (loud-fail, no fallback) |
| C1/C2/C3 → pending-actions.md ledger | data-feed | ENF(write)/HM(react) | runner .mjs резолвит canonical PA через git worktree list |
| C2 → consilium-synth.cjs | data-feed | ENF | verdicts-file → детерминированный CLI, JSON relay verbatim |
| B7 (systemic) → I5 meta-feedback | manual-handoff | PRM | oracle-question classify → invoke sibling command |

### 2.2. Продукт → Дизайн (A/B ↔ D)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| A3 F.8 (has_ui=true) → D1 `/design:start` | conditional | PRM | file-detect commands/design/ + skill-инструкция; graceful skip |
| D1 D.6 Export → B8 handoff §10 UI Spec | data-feed | PRM | MK/DS/NM читаются из .product/ handoff-generator'ом |
| D3 (design-artifact-validate/app-map-cascade) → `/design:map --write` | data-feed | HM | pending-queue + stderr |

### 2.3. Продукт → Delegation boundary (B8 ↔ E ↔ F)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| B8 `/product:handoff` → E7/E11 (Integrator add + adapter) | manual-handoff | **HM** | handoff.md self-contained; user отдельно вызывает `/integrator:add`; только текстовая подсказка |
| B8 handoff → E11 adapter parse | data-feed | ENF | детерминированный парс frontmatter+body per handoff-spec §9 (на explicit invoke) |
| Ecosystem `.claude/adapters/` → E7 Stage5 contract-designer | blocking-gate | ENF | hard stop «if adapters/ missing → bootstrap regression» |
| I2 `/ecosystem:update` (sync adapters) → E8 `--repair` | data-feed | ENF(diff)/PRM(trigger) | update --repair диффит instance vs reference; **но триггер вызвать --repair = human-memory** |
| E9 remove → B8 orphaned handoff | conditional | **HM** | текст-warning «regenerate if needed», без PA-записи/reminder |

### 2.4. Delegation → Orchestrator → External tool (E/B8 ↔ F ↔ cc-sdd)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| B8 handoff-batch → F2 (P3 bridge) | data-feed | ENF | adapter handoff-to-ccsdd + C-07 preflight |
| F2/F4/F5 → cc-sdd (kiro-* skills) | manual-handoff | **PRM/BRK** | agent() читает kiro-* через Read/Skill; **live-прогон НЕ выполнен, README признаёт неподтверждённым** вызов kiro из nested Workflow; fallback-путь существует именно из-за неопределённости |
| F4 (P5) → F5 (P6) via workflow() | sequential | ENF | nested Workflow one-level + try/catch fallback на inline lift |
| F5 (P6 GO) → F6 (P7 smoke) | sequential | ENF/part | цепочка кодом; P7 boot substrate-gated |
| F6 (P7 READY) → F8 (Epic E deploy) | blocking-gate | **BRK** | Epic E не существует; upstream (§6-канал, Integrator D3-runtime) отсутствует |
| **External tool → .product/ (обратная петля)** | manual-handoff | **BRK** | **E15: НИЧЕГО не читает вывод внешнего инструмента обратно; делегировано несуществующему Orchestrator-модулю** |

### 2.5. Orchestrator ↔ Product/Integrator обратные каналы (F ↔ A/E)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| F3 (P4 product-routed drift, OD8) → Product | manual-handoff | **HM** | PA-запись route:product; нет авто-уведомления/триггера |
| F4/F5 (escalated conflict, FB-LR-07) → spec author | manual-handoff | **HM** | PA route:owning-spec-author; нет resume-хука |
| F4/F6 (§6 capability BLOCK) → Integrator OD7 escalate→await | conditional | **BRK** | OD7 async request→await→resume **НЕ построен целиком** (substrate-gated) |
| F7 run-ledger → J (Substrate Graduation Gate) | data-feed | ENF(built)/BRK(validated) | gate-док ссылается на run-ledger.cjs; сам гейт признаёт «live-прогон НЕ подтверждён» |

### 2.6. Хуки → subagents/команды (H → всё)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| br/ic-change-trigger → B3 DA subagent | event-triggered | **PRM** | stderr+pending; асимметрия с lesson (нет Stop-блока/watchdog) |
| zone-change-trigger → architect/qa/ux персоны | event-triggered | **PRM** | advisor-pending.yaml + stderr; требует явного Agent spawn |
| cascade-check/app-map-cascade → команды resolution | data-feed | **HM** | pending-queue + stderr |
| product-handoff-gate → `/product:handoff --regenerate` | data-feed | **HM** | stderr suggestion, staleness не персистится в handoff-файле |
| hooks/*/manifest.yaml → .claude/settings.json | manual-handoff | PRM | bootstrap Step6b merge; drift manifest↔settings не самопроверяется |
| gap-classifier/completeness-oracle (lib) → C1 wave-runner | data-feed | ENF(CLI)/PRM(вызов) | subagent вызывает node CLI, relay JSON |

### 2.7. Layer-3 гейты Orchestrator (все .cjs)

| Механизм | Надёжн. | Нюанс |
|---|---|---|
| coverage/fidelity/design-coverage/gate-risk/capability/env/runtime/remediation/consilium — .cjs гейты | **PRM** | вердикт из кода, НО «relay verbatim» — нет runtime-проверки что агент реально запустил CLI, а не подделал вывод под schema |
| run-ledger start/finish bracket | **PRM** | поведенческий контракт диспетчера; забудет обернуть — трейс молча не появится |
| PA_CANON write (pending-actions.md) | **PRM** | инструкция в промпте; ничто не проверяет выполнение |

### 2.8. D7/Evolution ↔ всё (J/K)

| From → To | Тип | Надёжн. | Механизм |
|---|---|---|---|
| J6 process-gate → все consumer-zone коммиты | blocking-gate | **ENF*** | *только в checkout где install-pre-commit.sh запущен (.git/hooks не версионируется) |
| J7 check-counts → docs/pmo canon | data-feed | ENF | standalone + patch-cut + process-gate |
| J5 session-audit (пилот SessionEnd) → audit-index.md | event-triggered | ENF(write)/opt-in | требует ручной `/ecosystem:enable-d7-audit` в КАЖДОМ пилоте |
| J11 feedback-intake → пилот outbox + Orch FB-ledger + audit-journal | data-feed | ENF(read)/HM(apply) | capture-don't-fix; принятие находки = human-decision |
| J8 rails-session-start → любая работа сессии | event-triggered | ENF(inject)/PRM(use) | additionalContext; агент должен сам свериться |
| J warn-хуки (dev-journal/memory-drift/phase-closure-reminder) → коммиты | event-triggered | **PRM** | stderr reminder, detect-only |
| K1 STATUS pointer → все зоны | sequential | **PRM** | ручное обновление (Autoflow DEC-DEV-0100), явно не enforced |
| K2 wave kickoff → J1 phase-kickoff | manual-handoff | PRM | fresh-agent-recon против кода (усилено после 0145) |
| K5 autonomy-policy → любой orchestrator/product гейт | conditional | **BRK** | файл существует изолированно, wiring=F2 не построен |
| I5 meta-feedback → J11 feedback-intake (receiving side) | data-feed | **HM** | «co-located, reads directly»; нет авто-триггера прогнать intake |

### 2.9. Свод по надёжности связей

- **ENF (enforced кодом/харнессом):** реальные JS-хуки (регистрация, V-11 auto-fix, lesson Stop-блок), детерминированные .cjs/.mjs (consilium-synth, completeness-oracle, coverage-oracle, hash), Workflow persona-spawn (loud-fail), CI verify.yml, npm run verify, process-gate (условно), adapter parse, check-counts.
- **PRM (prompted):** DA-subagent spawn, zone-persona spawn, Layer-3 CLI relay, run-ledger wiring, PA_CANON write, «Next:» цепочки, validation-tune detect, has_ui→design, kiro-* invocation, STATUS/memory-sync обновления.
- **HM (human-memory):** handoff→integrator, update→--repair trigger, orphan-handoff regenerate, F→Product/Integrator обратные PA, meta-feedback→intake, patch-candidate [Y/N/E/D].
- **BRK (broken/missing):** обратная петля external→.product/ (E15), OD7 escalate→await, Epic E deploy, autonomy-policy wiring (K5), tool-docs→Orchestrator consumer, V-I-* cross-boundary rules, F1→run-ledger audit-trail.

---

## 3. СКВОЗНОЙ ТРЕЙС: «бизнес-овнер даёт идею → прод-релиз»

Полная цепочка процессов с точками разрыва (🟢 работает / 🟡 prompted-хрупко / 🔴 разрыв):

| Шаг | Процесс | Переход к следующему | Состояние |
|---|---|---|---|
| 0 | Овнер формулирует идею | → `/product:init` | 🟢 |
| 1 | **A1 Discovery** → PS/MR/CA/SEG/VP/HYP/BG | «Next: /product:plan» (текст) | 🟡 sequencing=prompted |
| 2 | **A2 Planning** → MVP/Roadmap/RL-001/FM-skeletons | «Next: /product:feature» | 🟡 prompted |
| 3 | **A3 Feature Definition** → SC/BR/LC/IC/NFR/VC/RPM | внутри: B3 DA review (BR/IC) | 🟡 DA-spawn = известный regression |
| 3a | **B3 DA Review** (adaptive 6-lens) | act/defer/dismiss → F.10 planned→in-progress | 🟡 spawn prompted |
| 4 | **D1 Design** (если has_ui) → MK/DS/NM | F.8 auto-trigger | 🟡 conditional prompted |
| 5 | **C1 Completeness-loop** (опц.) → DoR-достаточность | внешний oracle stop | 🟢 oracle enforced / 🟡 auto-fix консервативен |
| 6 | **B8 Handoff** → handoff.md (DoR-gated, SHA-256) | «suggest /integrator:add» | 🔴→🟡 **human-memory, нет авто-триггера** |
| 7 | **E7 Integrator add** (once) → adapter instance | fixture contract verify | 🟢 (на explicit invoke) |
| 8 | **F2 P3** batch→cc-sdd specs | coverage-oracle gate | 🟡 **cc-sdd invocation live-НЕподтверждён** |
| 9 | **F3 P4** audit-spec-fidelity | triage → P5 | 🟢 (built) / 🟡 product-drift→HM |
| 10 | **F4 P5** feature-to-tdd-impl (build) | workflow()→P6 | 🟢 built / 🟡 kiro-* invocation неподтверждён |
| 11 | **F5 P6** validate-feature-impl (GO/NO-GO) | GO → P7 | 🟢 built (unit-tested) |
| 12 | **F6 P7** runtime-smoke-readiness | READY→boot; else PA | 🔴 **boot substrate-gated, live НЕ прогнан** |
| 13 | **F8 Epic E** deploy/provision/rollback | → prod | 🔴🔴 **НЕ СУЩЕСТВУЕТ (spec-only, нет кода/процесса)** |
| 14 | **G3 D5** Operations & Feedback | наблюдение | 🔴 **deferred v2** |
| 15 | **E15** external output → .product/ (обратная петля) | статус фичи назад | 🔴🔴 **НЕ ПОСТРОЕН (Orchestrator reverse channel отсутствует)** |

### Точки разрыва трейса (критические):

1. **Шаг 6→7 (handoff→integrator):** нет авто-триггера — чистая human-memory подсказка. Первый настоящий шов между «спека готова» и «доставка в инструмент».
2. **Шаг 8/10 (Orchestrator→cc-sdd):** live-прогон nested Workflow → kiro-* skills объективно не подтверждён; вся P3/P5 архитектура держится на fallback-пути из-за этой неопределённости.
3. **Шаг 12 (P7 boot):** readiness-нога построена, но живой boot substrate-gated (ждёт Integrator D3-runtime) — «223 теста зелёные ≠ приложение стартует» пока не закрыто на живых данных.
4. **Шаг 13 (Epic E → prod):** ЖЁСТКИЙ РАЗРЫВ. От «GO-gate пройден» до реального прод-деплоя нет ни процесса, ни инструмента. Зависит от двух неготовых upstream: Orchestrator §6-канал (провалил S6-dogfood) + Integrator D3/D4/D5-инструменты (не установлены).
5. **Шаг 15 (обратная петля):** ЖЁСТКИЙ РАЗРЫВ. Конвейер строго однонаправлен; результат внешнего инструмента никогда не возвращается в `.product/`. Замкнуть петлю делегировано несуществующему Orchestrator-модулю.

**Вывод по трейсу:** сквозной путь физически «доезжает» до **P6 GO-gate / частично P7** (шаги 0-11 работают, хотя многие швы prompted). Всё после GO-gate — **spec-only / deferred**. Экосистема сегодня — это надёжный конвейер **«идея → validated behavioral+technical spec → GO-gate на impl»**, но НЕ «идея → прод»: последняя треть (deploy + operations + feedback-loop) отсутствует как код.

---

## 4. ДОМИНИРУЮЩИЙ ДЕТЕРМИНИЗМ И СТАТУС — сводка

### 4.1. Распределение детерминизма

| Детерминизм | Кол-во проц. | Характер |
|---|---|---|
| **DS** (deterministic-scripted) | ~22 | хуки, .cjs гейты, check-counts, run-ledger, adapter, autonomy-resolver, verify-агрегаты |
| **PL** (procedural-llm) | ~30 | оркестраторы сессий, integrator-команды, ecosystem-команды, D7-чеклисты, cascade/BG |
| **JL** (judgment-llm) | ~18 | DA review, consilium, P2-P7, drift/pattern-lint, validation-tune, research, session-audit |
| **CL** (creative-llm) | 2 | deep-discovery MR/CA, screen-generator (оба spec-only) |
| **HD** (human-decision) | ~7 | D3/D4/D5 delegated, MDP, Epic E, overrides |

**Ключевой паттерн:** заявленная «автоматика» ≈ PL/JL внутри одного LLM-контекста. Детерминированный слой (DS) реален, но узок: он либо **advisory** (хуки warn-only), либо **relay-gated** (агент обязан запустить .cjs и передать verdict — но сам запуск prompted). По-настоящему принуждающих точек единицы.

### 4.2. Реестр НАСТОЯЩЕГО enforcement (harness-level blocking)

1. **lesson-gate.js** (Stop, exit 2) — единственный default-blocking hook во всей событийной ткани.
2. **CI .github/workflows/verify.yml** (push/PR) — blocking floor (парсинг .mjs + unit-тесты).
3. **npm run verify** (pre-commit/CI агрегат) — DS-тесты hooks/adapters/orchestrator/product + gen:*:check.
4. **process-gate.js** (commit-msg) — count-drift/CHANGELOG/DEV_JOURNAL — **но только там, где install-pre-commit.sh был запущен** (.git/hooks не версионируется).
5. **pre-commit verify-hooks.js** — синтаксис/рантайм хуков.
6. **model-pin smoke-gate** (workflow-syntax.smoke.cjs) — label несёт model:/agentType:.
7. **cascade-check.js V-11 auto-fix** — детерминированная мутация (не блок save, но enforced-действие).
8. **B8 handoff DoR** / **B5 V-MK-08** — blocking на 🔴.
9. **Workflow persona-spawn** (C1/C2/C3) — loud-fail, no general-purpose fallback (архитектурный рельс).

Всё остальное — prompted / warn-only / human-memory.

### 4.3. Статус-разрывы «built ≠ validated» (самопризнанные)

- ≥3 висящих SMOKE_TEST_PLAN в статусе «next pilot session» одновременно — порог «>2 = сигнал остановиться» (Substrate Graduation Gate) **уже превышен**.
- Live-прогоны отложены волна-за-волной: consilium-жюри на реальном PA, batch-enrich на ≥2 FM, roster-override (G), B-d real-resolve, run-ledger live-run, P7 live boot, cc-sdd end-to-end.
- Autonomy Policy F1 — построен+70 юнитов, **wiring=0** (честный «не построено» вместо тихой имитации).

### 4.4. Doc-drift разрывы (спека отстаёт от кода)

- Product/Design SPEC не знают об Epic A/B/D (complete/consilium/batch-enrich, advisor-персоны).
- `templates/project/CLAUDE.md.template` тиражирует устаревшие счётчики **23/33 вместо 24/44** в каждый новый пилот при bootstrap.
- SPEC §13.1 `/integrator:scan` auto-invoke «Always» ↔ код делает условно/не делает.
- adapters/README статус handoff-to-ccsdd «⏳ TBA» ↔ файл — полный 493-строчный адаптер.
- Catalog↔runner sync linter отсутствует (validation.md ↔ validation-runner.md silent drift).
- verify.md §4 ручной command-count baseline ↔ автогенерируемый docs/guide/02-commands.md (два несинхронных источника).

---

## 5. КЛЮЧЕВОЙ СТРУКТУРНЫЙ ВЫВОД

Ecosystem 3.0 — это **методологически богатый, детерминированно-тонкий** конвейер. Три слоя реальности:

1. **Спека (богатая):** 79 процессов, 24 артефакта, 44+2 правила, 11 доменов — плотно задокументированный PMO поверх Claude Code.
2. **Enforcement (тонкий):** ~9 настоящих harness-level точек; вся остальная «оркестрация» — поведенческий контракт внутри LLM-контекста. Асимметрия: lesson-ветка имеет двухпронговую защиту (Stop+UserPromptSubmit), а DA/zone-persona/cascade-resolution/PA-эскалации держатся на памяти оркестратора без watchdog.
3. **Сквозной путь (обрывается на 2/3):** «идея → GO-gate на impl» работает; «GO-gate → прод → feedback» — spec-only/deferred/broken (Epic E не начат, обратная петля E15 отсутствует, D5 deferred).

Проект честно фиксирует собственные разрывы (built≠validated долг, F1 не подключён, Vision-drift, race×7 в DEC-DEV) — это его сильная сторона как аудируемой системы, но означает, что декларированная «автономность идея→прод» сегодня существует как архитектурное намерение, а не как исполняемая end-to-end цепочка.
