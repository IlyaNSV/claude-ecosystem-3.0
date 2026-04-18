# Product Module — Спецификация

> **Статус:** v1.0 (2026-04-18)
> **Роль:** ядро Ecosystem 3.0 — управление D1 (Discovery + Planning) и D2-Behavioral артефактами через унифицированный паттерн «Продуктовый ассистент draft → iterate → approve».
> **Закрывает:** DEC-A08 (Product Assistant как отдельный agent), DEC-P13 (универсальный паттерн), DEC-ART01..11 (каталог), все итерации 1-9.
> **v1 modifications:** A1 (auto-approve 🟢), A2 (Discovery Review Checkpoint), A3 (magnitude-gated DA), B1 (validation_tier), B2 (quiet draft hooks), C1-C4 (drift mitigation: drift-check, confidence, meta-feedback, patterns), D1 (handoff modes), D2 (approve_overrides), D3 (NOTE-* type).

## 1. Philosophy & Role

### 1.1 Что Product Module делает

- **Владеет D1 процессами** (Discovery + Planning): от идеи до MVP scope + FM skeletons
- **Владеет D2-Behavioral процессами**: обогащение FM до полноценной поведенческой спецификации (SC, BR, LC, VC, IC, RPM, BG, NFR)
- **Генерирует универсальный handoff**: передача из Product Layer в любой tool-agnostic реализатор
- **Поддерживает целостность `.product/`**: BG extraction, cascade consistency, validation, orphan detection
- **Ведёт диалог с человеком** в роли «Продуктового ассистента» (DEC-A08)

### 1.2 Что Product Module НЕ делает

- Не редактирует production-код (это внешние инструменты через handoff)
- Не занимается инфраструктурой (это Integrator Module)
- Не запускает внешние инструменты (будущий Orchestrator)
- Не проектирует UI визуально сам (это Design Module D2-05, условный подмодуль)
- Не принимает бизнес-решения (все approve — за человеком)
- Не управляет D3-D6 (tool-agnostic зона)

### 1.3 Отношения с другими модулями

```
┌────────────────────────────────────────────────────────────────┐
│                     PRODUCT MODULE (этот модуль)                │
│                                                                 │
│  Владеет .product/, ведёт D1 + D2-Behavioral процессы          │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────┐   │
│  │ P1 Discovery/Planning│      │ P2 Feature Definition    │   │
│  │ /product:init        │      │ /product:feature         │   │
│  │ /product:plan        │      │ /product:handoff         │   │
│  └──────────────────────┘      └──────────────────────────┘   │
│            │                              │                    │
│            └──────────┬───────────────────┘                    │
│                       │                                         │
│                       ▼ (если FM.has_ui=true, F.8)             │
│              ┌────────────────────────┐                        │
│              │  DESIGN MODULE (P2.5)  │                        │
│              │  /design:*             │                        │
│              │  Отдельный модуль,     │                        │
│              │  работает с .product/  │                        │
│              └────────────────────────┘                        │
│                                                                 │
│                       │                                         │
│                       ▼ (handoff.md готов)                     │
└───────────────────────┼─────────────────────────────────────────┘
                        │
                        ▼
              ┌────────────────────────┐
              │   INTEGRATOR MODULE    │
              │   Создаёт adapter для  │
              │   target tool          │
              └────────────┬───────────┘
                           │
                           ▼
            Внешний реализатор (cc-sdd / Kiro / custom)
                           │
                           ▼
               (будущий Orchestrator Module оркестрирует)
```

### 1.4 Персона «Продуктовый ассистент»

**Единая персона** ведёт диалог с человеком во всех процессах Product Module. Не разные агенты для разных задач — один голос, один стиль, одна roadmap decisions в контексте проекта. Это отличается от Integrator (там возможны разные subagent-ы для разных операций).

**Персона характеризуется:**
- Знанием всех 22 типов артефактов и их взаимосвязей
- Умением вести structured dialogue: предлагать варианты, обосновывать, не навязывать
- Памятью о решениях в проекте (через Memory MCP + decision journal)
- Adversarial consciousness: magnitude-gated DA review (см. processes.md §6.2) — для significant changes, не cosmetic touches
- Итеративностью: готов к 3-4 раундам обсуждения перед approve, без frustration
- **Confidence articulation (C2 modification):** перед каждым approve явно сообщает свою уверенность («Confidence: high — derived из 4 SC, transitions clear; единственная неопределённость — recovery path при concurrent edits») — даёт human point of leverage
- **Self-meta-feedback (C3 modification):** замечает повторяющиеся false positives правил и предлагает downgrade через `/product:meta-feedback`

**Что персона избегает:**
- Sycophancy («отличная идея!» на каждое предложение)
- Over-engineering (предлагать enterprise-level для MVP)
- Premature closure (принимать первое решение без обсуждения альтернатив)
- Scope creep (втягивать в фичу то, что не относится)
- **Ceremony escalation:** если 5+ approves подряд idle (human говорит «yes, yes, yes»), персона предлагает meta-обсуждение «возможно, мы перегнули с гранулярностью approve, обсудим?»

---

## 2. Архитектура

### 2.1 Примитивы Claude Code

Аналогично Integrator Module — гибрид, использующий все примитивы:

| Примитив | Роль | Локация |
|---|---|---|
| **Slash-commands** | 15 команд UX для пользователя | `.claude/commands/product/` |
| **Skills** | ~20 methodology files, lazy-loaded per процесс | `.claude/skills/product/` |
| **Subagents** | 3 research-heavy / isolated агента | `.claude/agents/product/` |
| **Hooks** | 6 hooks для automation и enforcement | `.claude/hooks/product-*.js` |
| **Memory directory** | Долгоживущие уроки, shared между сессиями | `~/.claude/memory/product/` |
| **Config** | Global + per-project settings | `~/.claude/product-config.yaml` + `.claude/product.yaml` |

### 2.2 Слоевая архитектура Product Module

```
┌─────────────────────────────────────────────────────────────┐
│ Слой 4: UX — Slash commands                                 │
│   /product:init, /product:plan, /product:feature, ...       │
├─────────────────────────────────────────────────────────────┤
│ Слой 3: Processes (из pmo/processes.md)                     │
│   P1.A Discovery, P1.B Planning, P2 Feature, P4 Cascade    │
├─────────────────────────────────────────────────────────────┤
│ Слой 2: Skills (methodology)                                │
│   discovery-session, feature-enrichment, bg-extraction, ... │
├─────────────────────────────────────────────────────────────┤
│ Слой 1: Artifacts (из pmo/artifacts/)                       │
│   21 тип со schema, rules, relationships, lifecycle         │
├─────────────────────────────────────────────────────────────┤
│ Слой 0: Automation (hooks)                                  │
│   bg-extractor, validate, session-state, DA triggers        │
└─────────────────────────────────────────────────────────────┘
```

Каждый слой использует нижние, не прыгает через них. Hooks (слой 0) активируются автоматически.

### 2.3 State ownership

**Product Module владеет:**

| Директория / файл | Назначение | Git |
|---|---|---|
| `.product/**/*.md` | Все артефакты (21 тип) | ✓ tracked |
| `.product/handoffs/` | Сгенерированные handoff snapshots | ✓ tracked |
| `.product/.sessions/` | Session state для recovery | ✗ gitignored |
| `.product/.pending/` | Pending BG terms, DA findings | ✗ gitignored |
| `.product/.da-findings/` | DA review outputs | ✓ tracked (historical value) |
| `.claude/product.yaml` | Per-project config (Quick/Deep mode default, overrides) | ✓ tracked |

**Product Module НЕ владеет:**

- `.kiro/`, `.planning/`, `.claude/hooks/*` не своих hooks, `.beads/`, `.stitch/` — зоны Integrator / внешних tools
- `.claude/integrator/` — Integrator's zone

---

## 3. Commands Catalog

19 команд, сгруппированных по функциональным блокам (15 baseline + 4 v1 drift-mitigation).

### 3.1 Главные процессы (5)

**`/product:init [--deep] [--continue] [--pivot]`**
- **Процесс:** P1.A Discovery Session (pmo/processes.md §3.1)
- **Входы:** текстовое описание идеи продукта (опционально — через continue)
- **Выходы:** `.product/problem.md`, market-research.md, competitive-analysis.md, segments/, value-propositions/, hypotheses/, glossary.md
- **Длительность:** 3-5 часов (Deep), 1-1.5 часа (Quick)
- **Опции:**
  - `--deep` — Deep Mode с spawn-subagents для MR/CA
  - `--continue` — resume из session state
  - `--pivot` — запустить P6 Pivot Cascade (future, пока out-of-scope per Q-11)

**`/product:plan`**
- **Процесс:** P1.B Planning Session
- **Входы:** все артефакты Discovery в active
- **Выходы:** mvp-scope.md, roadmap.md, releases/RL-001-*.md, features/FM-NNN-*.md (skeletons)
- **Длительность:** 2-3 часа

**`/product:feature <FM-id | "description">`**
- **Процесс:** P2 Feature Definition
- **Входы:** либо FM skeleton (enrichment mode), либо текстовое описание (creation mode)
- **Выходы:** SC, BR, LC, VC, IC, RPM обновление, MK (если has_ui, триггерит /design:start)
- **Длительность:** 1-3 часа per фича
- **Опции:**
  - `--continue` — resume из session state
  - `--skip-design` — для has_ui фичи пропустить P2.5 (not recommended)

**`/product:handoff <FM-id> [--mode draft|production] [--regenerate]`** (D1 modification)
- **Процесс:** Handoff generation (handoff-spec.md)
- **Входы:** FM в in-progress, embedded артефакты per mode requirements
- **Выходы:** `.product/handoffs/FM-NNN-handoff.md` (universal self-contained)
- **Modes (D1):**
  - `--mode production` (default) — full DoR (8 blockers per handoff-spec §7); генерирует `status: ready`
  - `--mode draft` — relaxed DoR (3 blockers: FM in-progress, ≥1 SC active, BG covers terms); генерирует `status: partial` с warnings; для PoC / early experiments
- **Опции:**
  - `--regenerate` — force regenerate даже если no drift detected
  - `--target <tool>` — скрыть за adapter через Integrator (обычно — implicit)

**`/product:validate [--deep] [--rule X] [--scope S]`**
- **Процесс:** On-demand validation (validation.md §3.4)
- **Входы:** `.product/` состояние
- **Выходы:** validation report
- **Опции:**
  - `--deep` — включает V-12 stale check, refresh_by, все V-MK-*
  - `--rule V-07` — проверить только одно правило
  - `--scope FM-003` — проверить только один артефакт и его dependencies
  - `--fix` — auto-fix где возможно (V-11 bi-dir)

### 3.2 Поддерживающие операции (5)

**`/product:status`**
- Dashboard текущего `.product/` состояния
- Counts per артефакт type × status
- Stale drafts (V-12)
- Pending BG terms
- Pending DA reviews
- Handoff status per FM
- Last Discovery / Planning / Feature sessions

**`/product:cleanup --dry-run`**
- V-15 orphan detection
- Предлагает per orphan: archive / delete / re-link
- Без `--dry-run` — применяет approved действия

**`/product:da-review <FM-id | --scope>`**
- Ручной запуск Product DA Review
- Spawn subagent `product-devils-advocate`
- Output: `.product/.da-findings/FM-NNN-<timestamp>.md`
- 6 линз × 3 tier findings

**`/product:cascade <artifact-id>`**
- Ручной запуск cascade check (обычно cascades в background через approve)
- Showing: все dependents, validation status, required updates
- Полезно после ручного editor артефакта вне processes

**`/product:clarify <FM-id>`**
- Для receiver: «у меня есть вопрос по handoff»
- Ассистент предлагает варианты: update artifact, add to Dependencies section, out-of-scope override

### 3.2a Drift mitigation (4 — v1 modifications C1-C4)

**`/product:drift-check`** (C1)
- **Процесс:** Structural self-audit
- **Входы:** PS + active HYP primary + MVP scope + последние 10 изменённых артефактов
- **Выходы:** Direction alignment report:
  - 🟢 Aligned — всё в направлении исходной цели
  - 🟡 Drift signal — конкретные артефакты, которые отклоняются (с pointers)
  - 🔴 Significant divergence — рекомендация stop-and-discuss
- **Использование:** on-demand, OR auto перед `/product:handoff` (non-blocking info), OR auto после каждых 10 новых артефактов
- **Skill:** `drift-detector.md`

**`/product:meta-feedback`** (C3)
- **Процесс:** AI инициирует ecosystem-level proposal (override rule, refine threshold, suggest skill update)
- **Триггеры (auto-suggested):**
  - V-* rule с false-positive rate >50% за последние 10 invocations
  - Approve gate с rationale «override» более 3 раз для одного rule
  - User repeated downgrade одного и того же rule
- **Выходы:** Proposal с rationale → human approves → `validation-config.yaml` updated + journal entry
- **Skill:** `meta-feedback.md`

**`/product:patterns`** (C4)
- **Процесс:** Meta-linter on `.product/`
- **Входы:** все active артефакты в `.product/`
- **Выходы:** Anti-pattern report:
  - Hard-coded values в нескольких BR (suggest extract)
  - Missing actors в SC steps (consistency)
  - Asymmetric FM dependencies (FM-A→FM-B без обратной ссылки)
  - Stale draft accumulation (>14 days)
  - Over-parameterized BR (8+ params — split candidate)
  - Synonyms candidates в BG (терминологический drift)
- **Использование:** weekly OR on-demand перед major reviews
- **Skill:** `pattern-linter.md`
- **Не блокирует** — informational

**`/product:promote-note <NOTE-id> to <TYPE>`** (D3)
- **Процесс:** Конвертация unstructured NOTE в structured артефакт
- **Входы:** NOTE-id + target type (FM | SC | BR | IC | NFR | HYP)
- **Выходы:**
  - Draft нового артефакта target type с derived содержимым
  - NOTE.status = promoted, NOTE.promoted_to = <new artifact id>
- **Skill:** `note-promote.md`

### 3.3 BG / NFR Management (4)

**`/product:bg:review`**
- Ручной просмотр pending BG candidates
- Accept / edit / reject per term
- Также показывает synonym warnings

**`/product:bg:rename <old> <new>`**
- Mass-rename workflow (processes.md §5.3)
- Bundle approve across all affected artifacts
- Single git commit

**`/product:nfr:review <FM-id>`**
- F.5a NFR Review запуск (если pending) или re-review (если active)
- Presents MVP defaults + options [Y/D/L]

**`/product:nfr:upgrade-tier`**
- Batch re-review при tier change (MVP → MMP)
- Все declined/pending FM попадают в review queue

### 3.4 Config & Maintenance (1)

**`/product:config [--show | --edit <key> <value>]`**
- Чтение и изменение `.claude/product.yaml` + `~/.claude/product-config.yaml`
- Ключевые настройки:
  - `validation_tier: pilot | mvp | full` (B1 modification — какие правила работают inline)
  - `auto_approve_confirmation_artifacts.enabled: true | false` (A1 modification)
  - `auto_approve_confirmation_artifacts.requires_high_confidence: true | false`
  - `draft_mode_quiet_hooks: true | false` (B2 modification)
  - `default_discovery_mode: quick | deep`
  - `stale_draft_days: 14 | 30 | 90 | never` (V-12 threshold)
  - `language: ru | en | ...`

---

## 4. Skills Library

~20 skills, организованных по процессам. Lazy-loaded per задаче.

### 4.1 Core session skills (3)

- **`discovery-session.md`** (P1.A) — управляет Discovery: шаги D1.1-D1.5, gates G1-G5, mode selection, iteration pattern
- **`planning-session.md`** (P1.B) — управляет Planning: D1.6-D1.8, MVP/RM/RL/FM skeleton creation
- **`feature-session.md`** (P2) — управляет Feature Definition: F.1-F.10, enrichment vs creation, cascade на каждом approve

### 4.2 Per-artifact authoring skills (12)

Для каждого артефакта, где требуется диалог с человеком при создании:

- **`problem-discovery.md`** (PS) — 5-8 уточняющих вопросов, структурирование
- **`market-research-protocol.md`** (MR) — Quick/Deep pipeline, triangulation rules
- **`competitive-analysis-protocol.md`** (CA) — discovery конкурентов, feature matrix, positioning
- **`segment-discovery.md`** (SEG) — функциональная сегментация, JTBD extraction
- **`vp-design.md`** (VP) — Strategyzer-style VP Canvas (simplified)
- **`hypothesis-formulation.md`** (HYP) — H.A.R.M.E.D. framework, thresholds
- **`mvp-scoping.md`** (MVP) — MoSCoW discipline, out-of-scope explicit
- **`roadmap-planning.md`** (RM) — directions не фичи, 3-6 мес horizon
- **`release-planning.md`** (RL) — rollout plans, dependencies, risk mitigations
- **`scenario-authoring.md`** (SC) — actor-verb steps, main/alt/error разделение, BR extraction triggers
- **`business-rule-extraction.md`** (BR) — categorization, parameterization, Critical review
- **`invariant-discovery.md`** (IC) — formalism, severity, recovery strategy

### 4.3 Derivation skills (4)

Для 🟢 Confirmation артефактов, которые выводятся автоматически:

- **`lifecycle-derivation.md`** (LC) — из SC steps + BR guards, state machine
- **`vc-derivation.md`** (VC) — из SC+BR+LC, Gherkin-подобный формат
- **`rpm-derivation.md`** (RPM) — роли из SC.actors, permissions из SC steps + authorization BR
- **`nm-derivation.md`** (NM) — из MK screens + LC guards

### 4.4 Cross-cutting skills (6)

- **`bg-extraction.md`** — алгоритм (processes.md §5), 5 phases, mass-rename
- **`cascade-protocol.md`** — BFS обход, priority ordering, bundle approve (validation.md §6)
- **`product-da-review.md`** — 6 линз, 3 tier findings, anti-sycophancy, magnitude-gated trigger logic (A3)
- **`nfr-review.md`** — F.5a.0 Ask + F.5a.1 Define, sanity ranges integration
- **`handoff-generator.md`** — 13 секций, DoR (mode-aware: draft/production per D1), hash computation, status determination
- **`validation-runner.md`** — runs rules per context (inline, gate, on-demand), tier-aware (B1), quiet-mode-aware (B2), aggregates report

### 4.4a Drift mitigation skills (5 — v1 modifications)

- **`drift-detector.md`** (C1) — reads PS + active HYP primary + MVP scope + recent артефакты; produces direction alignment report; non-blocking
- **`meta-feedback.md`** (C3) — auto-suggests rule overrides based on usage patterns; presents с rationale; updates validation-config + journal
- **`pattern-linter.md`** (C4) — analyzes `.product/` for anti-patterns; pattern dictionary expandable
- **`note-capture.md`** (D3) — quick capture flow для NOTE-* (≤30 sec from idea to saved file)
- **`note-promote.md`** (D3) — converts NOTE-* to structured artifact, copies content, updates references

### 4.5 Deep Research skills (2, используются в Deep mode)

- **`deep-research-8-phase.md`** — адаптация 199-biotechnologies для MR Deep
- **`competitive-intel.md`** — pipeline для CA Deep (semantic search + scraping + synthesis)

### 4.6 Skill loading strategy

**Не всё загружается сразу.** Skills загружаются lazy:

- `/product:init` → главный skill `discovery-session.md` + те, что нужны для текущего шага
- `/product:feature` → `feature-session.md` + per-artifact skills по мере прохождения F.1-F.10
- Background (hooks) — не используют skills, работают на logic

**Контекстный бюджет:** в памяти одновременно ~3-5 skills. Остальные в cold storage, загружаются по enter в новый шаг.

---

## 5. Subagents

3 subagent с isolated context:

### 5.1 `market-researcher` (D1.2 Deep mode)

- **Контекст:** PS + отрасль + география
- **Инструменты:** Firecrawl, Brave Search, Exa AI, Sequential Thinking
- **Pipeline:** 8-фазный (scope → plan → retrieve → triangulate → synthesize → critique → refine → package)
- **Выход:** Draft MR с credibility scores + source list
- **Почему isolated:** Deep research может занять 100+k токенов; не загрязняет основной диалог

### 5.2 `competitor-analyst` (D1.3 Deep mode)

- **Контекст:** PS + MR + список конкурентов (может быть расширен subagent'ом)
- **Инструменты:** Firecrawl (scraping), Exa (semantic "competitors of X"), GitHub MCP (для dev-focused tools)
- **Pipeline:** Discovery → scraping → structured extraction (features, pricing, positioning) → matrix → positioning map
- **Выход:** Draft CA с feature matrix, positioning map, strengths/weaknesses

### 5.3 `product-devils-advocate` (F.9)

- **Контекст:** конкретная FM + все embedded артефакты + ключевые HYP, IC
- **Инструменты:** Sequential Thinking (критично для structured adversarial thinking), Memory (lookup past similar findings), optionally Exa (research edge cases)
- **Pipeline:** 6 линз по очереди, каждая — mini-session с structured output
- **Выход:** Findings file в 3 tier (🔴/🟡/🔵)
- **Почему isolated:** Builder/Critic separation — DA не должен видеть contextный энтузиазм от создания артефактов; fresh critical lens

**Примечание:** использует existing `.claude/agents/devils-advocate.md` с business prompts (DEC-I05).

---

## 6. Hooks

6 hooks автоматизации и enforcement:

### 6.1 `product-artifact-validate.js` (PostToolUse) — tier-aware + quiet-mode

- **Триггер:** Write/Edit на `.product/**/*.md`
- **Действия:** inline validation (V-01..V-11, V-H-06) **filtered per `validation_tier`** (B1):
  - `pilot` tier → only 🔴 Blocking inline
  - `mvp` tier → 🔴 + 🟡
  - `full` tier → all
- **Quiet draft mode (B2):** при `status: draft` — findings queued в `.product/.pending/validation-pending.yaml`, не surfacing inline. Surfacing на approve gate / `/product:status` / `/product:validate`.
- **Выход:** stderr warnings при non-draft и non-quiet (не блокирует), но show в диалоге
- **Performance:** <100ms

### 6.2 `bg-extractor.js` (PostToolUse)

- **Триггер:** Write/Edit на `.product/**/*.md` (кроме BG.md)
- **Действия:** Phase 1 Candidate Extraction (processes.md §5.1)
- **Выход:** Обновляет `.product/.pending/bg-candidates.yaml`; уведомление в следующем interaction

### 6.3 `product-session-state.js` (PostToolUse, Stop)

- **Триггер:** любые изменения в `.product/` + session end
- **Действия:** snapshot progress в `.product/.sessions/<timestamp>.yaml`
- **Формат snapshot:**
  ```yaml
  session_id: ...
  process: P1.A | P1.B | P2.A | P2.5
  current_step: D1.2 | F.3 | D.4 | ...
  last_approved: [PS, MR, SEG-001, ...]
  pending_drafts: [CA, SEG-002]
  pending_ba: [...]
  next_step: D1.3 CA start
  ```

### 6.4 `ic-change-da-trigger.js` (P-RULE-01, magnitude-gated per A3)

- **Триггер:** Write/Edit на `.product/invariants/*.md`
- **Действия:** Magnitude classification (validation.md §7 P-RULE-01):
  - **Significant** (creation, severity change, semantic statement, entity change) → adds pending DA review в `.product/.pending/da-reviews.yaml`
  - **Skip** (cosmetic, ref-only, metadata) → adds entry в `.product/.pending/da-debt.yaml`
- **Effect:** IC cannot → active без approved DA review (для significant). Skipped — batched on next FM-level approve gate.

### 6.5 `br-change-review-trigger.js` (P-RULE-02, magnitude-gated per A3)

- **Триггер:** Write/Edit на `.product/business-rules/*.md`
- **Действия:** Magnitude classification:
  - **Significant** (creation, parameter type change, category change, statement rewrite) → impact analysis + DA prompt
  - **Skip** (parameter value tune, cosmetic, scenarios refs) → DA debt entry, cascade-only
- **Effect:** BR cannot → active без impact analysis approve (для significant). Cascade protocol автоматически включается всегда.

### 6.6 `product-handoff-gate.js` (PreToolUse)

- **Триггер:** пытается запустить external implementation tool (cc-sdd `/kiro:spec-init`, etc.)
- **Действия:** проверяет наличие valid handoff для FM
- **Effect:** блокирует если нет handoff или handoff=stale/blocked
- **Опция:** Integrator при `/integrator:add <tool>` регистрирует известные команды (cc-sdd spec-init, Kiro spec-new, etc.) в этот hook

---

## 7. State Management

### 7.1 Three levels of state

**Global** (`~/.claude/`):
- `product-config.yaml` — default Quick/Deep mode, language, thresholds
- `memory/product/` — долгоживущие уроки (cross-project), pattern библиотека

**Per-project** (`.claude/`, `.product/`):
- `.claude/product.yaml` — project overrides config
- `.product/**/*.md` — артефакты (source of truth)
- `.product/handoffs/` — handoff snapshots
- `.product/.da-findings/` — DA reviews history (tracked)

**Session** (`.product/.sessions/`):
- `current.yaml` — active session (если есть)
- `<timestamp>.yaml` — historical sessions (cleanup > 30 дней)

### 7.2 Pending state (`.product/.pending/`)

**Background queues:**

- `bg-candidates.yaml` — kandidат из BG extraction, ждут review
- `da-reviews.yaml` — pending DA reviews (от P-RULE-01, P-RULE-02)
- `nfr-reviews.yaml` — FM с nfr_status=pending или tier-upgrade triggered
- `cascade-pending.yaml` — cascade effects, ждут bundle approve
- `stale-drafts.yaml` — found by V-12 scan

Все pending queues — **gitignored** (эфемерные). Решения оттуда переходят в артефакты + decision journal.

### 7.3 Decision journal integration

Каждое strategic/critical решение Product Module пишет в decision journal (общий с Integrator — глобальный + per-project):

- **Global journal** (`~/.claude/memory/product/decisions.md`) — уроки между проектами
- **Project journal** (`.product/.decisions/journal.md`) — решения per проекту

**Формат записи** (как в Integrator SPEC §6):
```
DEC-P-0012 — Replaced initial segment SEG-001
Дата: 2026-06-10
Триггер: /product:cascade with HYP-001 invalidated signal
Контекст: ...
Варианты: ...
Принятое: SEG-001 deprecated, SEG-001b created with different JTBD profile
Итог: MVP scope shrunk from 5 to 3 FM
Уроки: early HYP testing предпочтительнее waterfall planning
```

---

## 8. MCP Stack

Аналогично Integrator, core стэк + recommended.

### 8.1 Core (обязательны)

**Sequential Thinking** — multi-step reasoning
- Research synthesis, hypothesis formulation, DA analysis
- Critical для F.5 (IC identification), F.9 (DA review)

**Memory MCP** — knowledge graph
- Decision journal cross-session
- Pattern library: «видели похожую фичу? как поступили?»
- BG terms graph

**Firecrawl** — веб-скрейпинг для Deep research
- D1.2 MR Deep, D1.3 CA Deep
- Scraping competitor docs, pricing pages

**Brave Search** — keyword search
- Quick research lookups
- D1.2 MR Quick, D1.3 CA Quick

**Exa AI** — semantic search
- «Найди продукты, которые решают X для Y»
- D1.3 CA Deep (competitor discovery)

### 8.2 Recommended

**Context7** — realtime docs
- Полезно при обсуждении NFR target'ов (какие обычно для X библиотеки)
- Не критично для самого Product Module, полезно при D2-Behavioral обсуждениях

**GitHub Official MCP**
- Для CA Deep mode — проверить GitHub-based конкурентов (stars, activity, issues)
- Для NFR research — «какие typical NFR в этой категории продуктов»

### 8.3 Situational

**Stitch MCP** (через Design Module)
- Активируется только при FM.has_ui=true и в P2.5
- Не напрямую Product Module, а через Design Module

### 8.4 Rejected

- **Postgres/DB MCPs** — зона реализации, не Product Layer
- **Slack/Discord/Email MCPs** — не участвуют в D1-D2 processes

### 8.5 Матрица «команда → MCP»

| Команда | Core | Recommended |
|---|---|---|
| `/product:init` Quick | SeqThink, Brave | — |
| `/product:init --deep` | SeqThink, Firecrawl, Brave, Exa, Memory | Context7, GitHub |
| `/product:plan` | SeqThink, Memory | — |
| `/product:feature` enrichment | SeqThink, Memory | Context7 (для NFR benchmarks) |
| `/product:feature` creation | SeqThink, Memory, Brave | — |
| `/product:handoff` | SeqThink | — |
| `/product:validate` | — (logic) | — |
| `/product:cascade` | SeqThink | Memory |
| `/product:da-review` | SeqThink, Memory | Exa (для edge case research) |
| `/product:nfr:review` | SeqThink | Context7, GitHub |
| `/product:bg:*` | — (logic) | Memory |
| `/product:cleanup` | — (logic) | — |
| `/product:status` | Memory (read journal) | — |

### 8.6 Graceful degradation

Если MCP недоступен:
- Core MCP missing → warning + fallback
- Firecrawl missing → WebFetch (медленнее, менее структурно)
- Brave missing → WebSearch
- Exa missing → Brave + дополнительные iterations
- Sequential Thinking missing → встроенное thinking (менее структурно)

Product Module **никогда не падает** из-за missing MCP.

---

## 9. Extended Claude Code Primitives

Помимо commands/skills/subagents/hooks, используются:

### 9.1 Memory directory

`~/.claude/memory/product/`:

- `decisions.md` — strategic decisions cross-projects (human-readable supplement to Memory MCP)
- `patterns.md` — «когда мы так сделали, получилось вот это» (lessons across projects)
- `vocabulary.md` — ключевые термины, накопленные за все проекты
- `templates/` — draft templates для новых артефактов (не жёсткие, но стартовая точка)

### 9.2 Statusline

Отображает в строке статуса:
- Current process, если в session (напр. `📋 P2.A FM-003 F.3`)
- Pending items count (напр. `⏳ 2 DA reviews, 5 BG candidates`)
- Handoff status (напр. `📦 2 handoffs ready, 1 stale`)

Обновляется через statusline hook при `.product/.pending/` изменениях.

### 9.3 Output styles

Единый формат presenting для:
- `/product:status` — dashboard-style output (colored tables)
- `/product:validate` — grouped by tier (🔴/🟡/🔵)
- `/product:da-review` — findings with lens tags
- `/product:cascade` — tree view dependents

Файл: `.claude/output-styles/product-report.md`

### 9.4 ScheduleWakeup

**Pending features (v1 scope tentative):**
- Еженедельный `/product:validate --deep` для stale detection
- Ежемесячный check `refresh_by` для MR/CA

Пока: не реализуется в v1, используется manual `/product:status` + `/product:validate`.

---

## 10. Integration с другими модулями

### 10.1 С Integrator Module

**Product Module — один из регистрируемых модулей** в каталоге Integrator (`~/.claude/integrator/tool-catalog/product-module.yaml`):

```yaml
tool: product-module
version: 1.0
category: core-pmo-module
pmo_coverage:
  D1-01..D1-10: {confidence: high}
  D2-01, D2-02, D2-05 (behavioral part), D2-06 (behavioral): {confidence: high}
inputs:
  - type: idea-description (text)
outputs:
  - type: product-handoff (markdown universal)
    schema_ref: product-module/handoff-spec.md
```

**Взаимодействие:**

1. При первом запуске Ecosystem 3.0 — Integrator видит Product Module, регистрирует профиль
2. При `/integrator:add cc-sdd` — Integrator создаёт adapter `handoff-to-ccsdd.js` (Product Module не участвует в этом)
3. Продуктовый ассистент не вызывает Integrator напрямую; они работают через общие артефакты

**Product Module не знает, какой tool активен за handoff** — это tool-agnostic принцип (DEC-A06).

### 10.2 С Design Module

**Design Module — отдельный модуль**, активирующийся условно.

**Flow:**

1. В P2 Feature Definition, при F.8 — если FM.has_ui=true, Product Module вызывает `/design:start <FM-id>`
2. Design Module работает с `.product/mockups/`, `.product/design-system.md` — общая файловая система
3. Design Module сам управляет iterations, возвращается в Product Module flow на F.10 когда MK в active
4. Design Module не вызывает `/product:*` команды; Product Module не вызывает `/design:*` напрямую в body (только в F.8 триггер)

**Shared state:**
- `.product/mockups/MK-*.md`, `NM-*.md` — записывает Design Module, читает Product Module (при generation handoff)
- `.product/design-system.md` — writes Design Module
- FM.frontmatter.has_ui, mockups[] — writes Product Module

### 10.3 С future Orchestrator Module

**Когда Orchestrator реализуется:**

- Orchestrator читает `.product/` state и tool-docs (от Integrator)
- При задаче «поставить фичу FM-003 на prod» — Orchestrator маршрутизирует:
  - Чтение handoff через adapter → cc-sdd spec-init
  - cc-sdd output → implementation tool (beads/GSD)
  - tests → QA tool
  - deploy → deployment tool
- Product Module в этот момент — источник `.product/` (read-only для Orchestrator)
- Обратный поток feedback (P3) через Orchestrator → Product Module: `/product:clarify`, `/product:feedback-intake` (future)

---

## 11. Session Management & Recovery

### 11.1 Понятие «session»

**Session** — логически единая единица работы в Product Module. Не совпадает с Claude Code chat session.

**Типы sessions:**

| Session | Процесс | Длительность |
|---|---|---|
| Discovery session | P1.A | 3-5 часов (Deep) / 1-1.5 (Quick) |
| Planning session | P1.B | 2-3 часа |
| Feature session | P2 | 1-3 часа per FM |
| DA session | F.9 | 20-40 мин |
| Design session | P2.5 | 1-2 часа per iteration |

### 11.2 Session state format

`.product/.sessions/current.yaml`:

```yaml
session_id: "20260615-1430-P2A-FM003"
type: feature-session
mode: standard                          # или deep
process: P2.A
subprocess: F.3 (BR extraction)
fm_id: FM-003
started_at: 2026-06-15T14:30:00Z
last_checkpoint: 2026-06-15T15:45:00Z
total_duration_so_far: 1h 15m

progress:
  completed_steps:
    - F.1: "Loaded FM-003 context"
    - F.2: "SC-005, SC-005a, SC-005e1, SC-006 — all active"
  current_step: F.3 BR extraction
  next_step: F.4 LC derivation

pending_drafts:
  - artifact: BR-010
    status: draft
    iteration: 2

pending_approvals: []

pending_bg: []                          # в общем .product/.pending/

session_journal:                        # ключевые диалог моменты
  - time: 14:30, type: start, note: "FM-003 enrichment started"
  - time: 14:45, type: approve, artifact: SC-005
  - time: 15:20, type: approve, artifact: SC-006
  - time: 15:30, type: BR_extraction_started

mcp_state:
  - sequential_thinking: session_id=xyz (preserved)
  - memory: session_id=abc (preserved)
```

### 11.3 Recovery flow

```
Человек: /product:feature --continue

Ассистент читает .product/.sessions/current.yaml:
  - Продолжаем FM-003 session
  - Last completed: F.2 (4 scenarios approved)
  - Current step: F.3 BR extraction (BR-010 draft iteration 2)
  
Ассистент:
  «Продолжаем работу над FM-003. Мы на F.3 (Business Rule Extraction).
   Статус SC: SC-005 active, SC-005a active, SC-005e1 active, SC-006 active.
   BR-010 в draft iteration 2. Вот что было в последней итерации:
   
   [shows draft]
   
   Хочешь продолжить с этой точки или пересмотреть что-то?»
```

### 11.4 Session termination

Session заканчивается:
- **Complete:** все шаги процесса пройдены; session → `.product/.sessions/<timestamp>-complete.yaml`
- **Abandon:** human говорит «давай отложим»; session остаётся current, но помечается `abandoned_at`
- **Pivot:** явное `/product:init --pivot` или другой `init` — сохраняет старую как archived
- **Cleanup:** sessions старше 30 дней архивируются в `.product/.sessions/_archive/`

---

## 12. Error Handling & Escalation

### 12.1 Типы ошибок

**T1: Validation blocks** — артефакт не может стать active из-за V-* fail
- Ассистент показывает precise причину
- Предлагает fix или override (с rationale)

**T2: Cascade conflict** — при cascade bundle одно dependent fails
- Rollback всего bundle (atomic)
- Человек решает per item

**T3: MCP failure** — research или research subagent упал
- 3 retries с exponential backoff
- После — ask human, continue with fallback

**T4: Session corruption** — `.product/.sessions/current.yaml` повреждён
- Ассистент детектит при `--continue`
- Предлагает: start fresh / recover from last approved artifact / manual edit session file

**T5: Git conflict** — одновременное редактирование `.product/` в двух местах
- Prevent: session state включает `git.head_sha` при старте; несоответствие → warning перед save
- Recovery: manual resolve, ассистент помогает разобраться

### 12.2 Escalation protocol

Когда ассистент **не знает**, что делать:

1. **Не гадать** — явно сказать «Я не уверен в этой области»
2. **Показать варианты** — если несколько возможных путей
3. **Предложить research** — если нужна внешняя информация («запустить research through MCP?»)
4. **Задать конкретный вопрос** — не общий «что вы хотите?», а «Готовы ли мы принять X или Y?»

### 12.3 Human-in-the-loop

Явная эскалация:

- **Critical artifacts (🔴)** — always human approve
- **Strategic artifacts (🟠)** — human approve with options
- **Standard (🟡)** — human approve, defaults ok
- **Confirmation (🟢)** — human confirm, generated by assistant

Deadlock protection (OQ-P4):
- После 5 iterations без approve на одном артефакте — ассистент флагит: «Мы крутимся 5 раундов; предлагаю radical rethink approach»

---

## 13. Open Questions

**OQ-PM-01:** Кроссплатформенность Product Module
- Сейчас: всё через `.claude/` + `.product/` локально
- Вопрос: как переиспользовать между проектами? Шаблон `.claude/` для copy, или более умная система?
- **Решение предлагается:** `/product:init` проекта может взять `.claude/product.yaml` из `~/.claude/product-template/` как bootstrap

**OQ-PM-02:** Interaction с git branches
- Что если human делает `git checkout` в середине session?
- `.product/.sessions/current.yaml` станет несоответствующим
- **Решение предлагается:** session snapshot включает git.head_sha; при несоответствии — warning + recovery options

**OQ-PM-03:** Concurrent sessions
- Что если одновременно человек открыл 2 Claude Code чата с одним проектом?
- Обе пишут в `.product/`, race conditions
- **Решение:** lock-file `.product/.sessions/lock.yaml`; при detection — warn про conflict

**OQ-PM-04:** Rollback approve
- После approve фичи обнаружили ошибку; как rollback?
- **Решение:** git revert + `/product:cascade` для re-validation downstream; explicit процесс не нужен (git — single source of truth)

**OQ-PM-05:** Language of Product Module
- Ассистент говорит на языке контекста проекта (русский для TranslateIT)
- tool-docs (для Orchestrator) — английский универсальный (DEC-INT-O13)
- Handoff — на языке receiver (adapter translates?)
- **Решение:** Product Module language = project language; handoff generates в project language, adapter переводит если target требует английский

---

## 14. Checklist для активации

Чеклист структурирован **функционально**, не по фазам. Минимально достаточный набор для запуска каждой способности — выполняется тогда, когда способность нужна (работаем до результата, не по срокам).

### 14.1 Prerequisites (однократно, до любой способности)

- [ ] `/ecosystem:bootstrap` успешно выполнен в проекте (создаёт `.claude/`, `.product/`, `.env`, `product.yaml`, `CLAUDE.md`)
- [ ] Core MCP stack установлен через bootstrap (минимум: Sequential Thinking + Brave Search)
- [ ] Pilot project chosen
- `~/.claude/memory/product/` создаётся лениво (Memory MCP при первой записи) — не prereq
- `~/.claude/product-config.yaml` — опционально (global defaults); бутстрап per-project достаточен

### 14.2 Discovery Quick (минимальный путь от идеи до HYP)

- [ ] `.claude/commands/product/init.md`
- [ ] `.claude/commands/product/status.md`
- [ ] `.claude/commands/product/config.md`
- [ ] Skills: discovery-session, problem-discovery, market-research-protocol (Quick), competitive-analysis-protocol (Quick), segment-discovery, vp-design, hypothesis-formulation
- [ ] Hooks: product-artifact-validate, product-session-state
- [ ] Артефакты: PS, MR, CA, SEG, VP, HYP — создаются end-to-end
- [ ] Acceptance: `/product:init` от идеи до HYP на pilot проекте без ручной правки документации

### 14.3 Planning + Discovery Deep mode

- [ ] `.claude/commands/product/plan.md`
- [ ] Skills: planning-session, mvp-scoping, roadmap-planning, release-planning
- [ ] Subagents: `market-researcher.md`, `competitor-analyst.md`
- [ ] Skills: deep-research-8-phase, competitive-intel
- [ ] MCP: Firecrawl, Exa AI активны
- [ ] Артефакты: MVP, RM, RL, FM (skeletons)
- [ ] Acceptance: Deep Discovery + Planning на реальной теме с credibility-scored research

### 14.4 Feature Definition (D2-Behavioral)

- [ ] `.claude/commands/product/feature.md`, `cascade.md`, `bg:review.md`, `bg:rename.md`
- [ ] Skills: feature-session, scenario-authoring, business-rule-extraction, lifecycle-derivation, vc-derivation, rpm-derivation, invariant-discovery, bg-extraction, cascade-protocol
- [ ] Hooks: bg-extractor, ic-change-da-trigger, br-change-review-trigger
- [ ] Артефакты: SC, BR, LC, VC, IC, RPM updates, BG continuous
- [ ] Acceptance: одна FM обогащена end-to-end, cascade работает, BG extraction работает

### 14.5 Handoff + NFR + Product DA

- [ ] Commands: `/product:handoff`, `/product:nfr:review`, `/product:nfr:upgrade-tier`, `/product:da-review`, `/product:validate`, `/product:cleanup`
- [ ] Skills: handoff-generator, nfr-review, product-da-review, validation-runner
- [ ] Subagent: product-devils-advocate
- [ ] Hook: product-handoff-gate
- [ ] Артефакты: NFR, Handoff files
- [ ] Acceptance: handoff.md проходит DoR, handoff читается как минимум одним внешним tool через adapter

### 14.6 Polish & Integration

- [ ] Statusline, output styles
- [ ] Memory MCP integration (journal seeking)
- [ ] Integration тесты с Integrator Module
- [ ] Acceptance: handoff → cc-sdd через adapter работает без manual правок

### 14.7 Design Module (conditional)

Design Module — отдельный SPEC (`design-module/`). Интегрируется сюда в момент первого FM с has_ui=true.

---

## 15. Следующие шаги

- [ ] Утвердить SPEC (или внести корректировки)
- [ ] Подготовить Design Module SPEC (последний missing piece ядра)
- [ ] Kick-off имплементации Discovery Quick на pilot проекте
- [ ] При готовности Handoff: первый `/integrator:add cc-sdd` через Integrator — разблокирует tool-agnostic проверку
- [ ] После MVP Integrator: Orchestrator Module концепт

---

**Конец спецификации Product Module.**

**Статус ядра 3.0 после этой итерации:**

- ✅ Artifacts catalog (21 тип)
- ✅ Handoff spec (universal, tool-agnostic)
- ✅ Validation (33 rules + 2 process rules)
- ✅ Processes (P1-P5 + P2.5 outline)
- ✅ Integrator Module SPEC
- ✅ **Product Module SPEC (этот документ)**
- ✅ Design Module SPEC (детализация P2.5 — интегрируется при первой UI-фиче)
- 🔜 Orchestrator Module концепт (после MVP Integrator)

Всё D1-D2 ядро задокументировано. Готово к функциональной имплементации (см. §14 Checklist).
