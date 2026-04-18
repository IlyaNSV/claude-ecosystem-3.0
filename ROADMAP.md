# Ecosystem 3.0 — Implementation Roadmap

> **Назначение:** единый source of truth для implementation plan. Каждая фаза имеет deliverables, acceptance criteria, dependencies, risks.
> **Статус:** активный документ. Обновляется после каждой завершённой phase + при изменении приоритетов.
> **Последнее обновление:** 2026-04-18.

## Где мы сейчас

```
✅ Phase 0 — Scaffolding + SPECs + v1 modifications
✅ Phase 1 — Integrator read-only + new business DA
✅ Pre-pilot fix — pmo-mapping.yaml formal schema (simplified)

[We are here ─────────────────────────────────────]

⏳ Phase 2 — Product Module core (Discovery Quick + drift mechanisms)
⏳ Phase 3 — Planning + Feature Enrichment (P1.B + P2.A)
⏳ Phase 4 — Handoff + NFR + Product DA + Validation full
⏳ Phase 5 — Integrator Phase 2 (Installation + first adapter)
⏳ 🎯 PILOT POINT — first greenfield end-to-end test
⏳ Phase 6 — Design Module (conditional, activate on first UI feature)
⏳ Phase 7 — Integrator maintenance (verify/debug/docs/update)

📦 Post-MVP (v1.1+): Orchestrator Module concept
📦 v2: P3 Feedback, P5 Actuality Refresh, multi-tool zones, etc.
```

---

## Completed phases

### ✅ Phase 0 — Scaffolding + SPECs + v1 modifications

**Коммиты:** `a9c50da`, `18b0dd9`

**Что сделано:**
- Repo scaffolding (README, BOOTSTRAP, INSTALL-HUMAN, CHANGELOG, config templates)
- Миграция 4 SPECs из design archive в `docs/`
- Применены 12 v1 модификаций (A1-A3, B1-B2, C1-C4, D1-D3)
- 22 артефакта (включая новый NOTE-*)

### ✅ Phase 1 — Integrator read-only + new business DA

**Коммиты:** `72d2adc`, `80e55d6`

**Что сделано:**
- 6 read-only команд (`/integrator:research`, `:map`, `:gaps`, `:status`, `:journal`, `:scan`)
- 2 skills (`research-protocol`, `tool-profiling`)
- Subagent `tool-researcher` (isolated context)
- Новый `agents/product/devils-advocate.md` — business-focused с 6 линзами + best practices (pre-mortem, inversion, steelmanning, anti-sycophancy)

### ✅ Pre-pilot fix — pmo-mapping.yaml schema

**Коммит:** `023def6` (refactored from `023c3f7`)

**Что сделано:**
- Формализована схема `pmo-mapping.yaml` (SPEC §4.3) — project-local aggregated view «кто что покрывает»
- Single-layer declared confidence (отказались от smoke-verified и empirical layers как переусложнения для v1)
- Confidence lifecycle — human-driven (add/update/remove/debug/verify), без автоматического tracking

---

## Phase 2 — Product Module core

**Цель:** `/product:init` работает end-to-end для greenfield проекта в Quick mode. Discovery артефакты (PS → HYP) создаются.

### Deliverables (~15 файлов)

**commands/product/:**
- `init.md` — P1.A Discovery Session entry point
- `status.md` — dashboard `.product/` state
- `config.md` — read/edit product.yaml
- `drift-check.md` — C1 modification: structural self-audit
- `meta-feedback.md` — C3 modification: AI proposes ecosystem improvements
- `patterns.md` — C4 modification: meta-linter for anti-patterns
- `promote-note.md` — D3 modification: convert NOTE-* to structured artifact

**skills/product/ (7 Discovery skills):**
- `discovery-session.md` — P1.A orchestrator
- `problem-discovery.md` — D1.1 (PS authoring)
- `market-research-protocol-quick.md` — D1.2 Quick mode
- `competitive-analysis-protocol-quick.md` — D1.3 Quick mode
- `segment-discovery.md` — D1.4 (SEG + JTBD)
- `vp-design.md` — D1.4a (VP per SEG)
- `hypothesis-formulation.md` — D1.5 (HYP с H.A.R.M.E.D. framework)

**skills/product/ (4 drift mechanisms):**
- `drift-detector.md` — C1 logic
- `pattern-linter.md` — C4 logic
- `meta-feedback.md` — C3 logic
- `note-capture.md` — D3 quick capture flow

**hooks/product/:**
- `artifact-validate.js` — tier-aware (B1) + quiet-draft-mode (B2)
- `session-state.js` — progress snapshot for recovery

**commands/ecosystem/:**
- `bootstrap.md` — one-command setup (per BOOTSTRAP.md)
- `verify.md` — post-bootstrap health check

### Acceptance criteria

- [ ] `/product:init "простое описание идеи"` в пустой папке → за 30-60 мин создаёт PS + MR + CA + SEG + VP + HYP, все в active
- [ ] `/product:status` показывает актуальный dashboard
- [ ] `/product:drift-check` работает на минимальном state
- [ ] Artifact-validate hook тихо queues findings при `status: draft`, surfaces на approve
- [ ] Session recovery работает через `/product:init --continue` после interrupt

### Estimated effort

**3-5 часов focused work.**

### Dependencies

- Phase 0 ✅ (SPECs доступны)
- Phase 1 ✅ (Integrator read-only для установки core MCP stack)

### Risks

- Skills для D1.2 MR и D1.3 CA Quick mode без Deep subagents могут быть слабоваты. Acceptable для pilot, flag для будущей доработки.
- Hook interaction с Claude Code — первый реальный тест trigger semantics. Могут потребоваться корректировки.

---

## Phase 3 — Planning + Feature Enrichment (P1.B + P2.A)

**Цель:** `/product:plan` + `/product:feature` создают MVP scope, roadmap, releases, FM skeletons, обогащают FM до handoff-ready behavioral spec (SC/BR/LC/VC/IC).

### Deliverables (~18 файлов)

**commands/product/:**
- `plan.md` — P1.B Planning Session
- `feature.md` — P2.A Feature Enrichment (или P2.B Creation)
- `cascade.md` — manual cascade check
- `bg:review.md` — pending BG candidates batch review
- `bg:rename.md` — mass-rename workflow

**skills/product/ (9 feature skills):**
- `planning-session.md` — P1.B orchestrator
- `feature-session.md` — P2.A/B orchestrator
- `mvp-scoping.md` — MoSCoW discipline
- `roadmap-planning.md` — 3-6 мес horizon
- `release-planning.md` — RL-* с rollout plans
- `scenario-authoring.md` — SC actor-verb format
- `business-rule-extraction.md` — из SC steps
- `invariant-discovery.md` — IC formalism, severity
- `bg-extraction.md` — 5 phases algorithm

**skills/product/ (3 derivation skills):**
- `lifecycle-derivation.md` — LC из SC + BR
- `vc-derivation.md` — VC (Gherkin) из SC + BR + LC + NFR
- `rpm-derivation.md` — RPM из SC.actors + BR authorization

**subagents/product/:**
- `market-researcher.md` — D1.2 Deep mode (8-phase pipeline)
- `competitor-analyst.md` — D1.3 Deep mode

**hooks/product/:**
- `bg-extractor.js` — PostToolUse, Phase 1 Candidate Extraction
- `cascade-check.js` — BFS on approve
- `ic-change-da-trigger.js` — P-RULE-01, magnitude-gated (A3)
- `br-change-review-trigger.js` — P-RULE-02, magnitude-gated (A3)

### Acceptance criteria

- [ ] `/product:plan` после Discovery → MVP scope, RM, RL-001, FM skeletons
- [ ] `/product:feature FM-001` → полный P2.A: F.1 load context → F.10 FM in-progress
- [ ] Cascade работает на реальном BR change (bundle approve)
- [ ] BG extraction ловит bold terms, batched presentation работает
- [ ] A1 auto-approve срабатывает для 🟢 артефактов с `confidence: high` + V-* passed
- [ ] A3 magnitude-gating: minor BR tweak не триггерит DA review; semantic change — триггерит
- [ ] Mass-rename через `/product:bg:rename` обновляет все 22 ссылки атомарно в single git commit

### Estimated effort

**4-6 часов.**

### Dependencies

- Phase 2 (Discovery artifacts нужны как input для Planning и Feature)

### Risks

- Cascade protocol implementation на JS — самый хитрый hook. Если bi-dir refs auto-fix даёт false positives — пиши как warning, не блокировку.
- Deep mode subagents требуют MCP (Firecrawl, Exa, GitHub). Quick mode fallback должен быть solid.

---

## Phase 4 — Handoff + NFR + Product DA + Validation full

**Цель:** `/product:handoff` работает в обоих режимах (draft/production). Validation catalog полностью реализован. F.9 DA review интегрируется.

### Deliverables (~10 файлов)

**commands/product/:**
- `handoff.md` — D1 modes, D2 overrides
- `validate.md` — on-demand full validation
- `cleanup.md` — V-15 orphan detection (`--dry-run`)
- `da-review.md` — manual F.9 trigger
- `clarify.md` — receiver questions channel
- `nfr:review.md` — F.5a Ask/Define
- `nfr:upgrade-tier.md` — batch review при tier change

**skills/product/:**
- `handoff-generator.md` — 13 sections, mode-aware DoR (D1), hash computation
- `nfr-review.md` — sanity ranges integration, guardrails
- `product-da-review.md` — invokes business DA agent, handles findings
- `validation-runner.md` — tier-aware (B1), quiet-mode-aware (B2), 5 execution points
- `cascade-protocol.md` — full BFS с priority ordering
- `mass-rename.md` — BG workflow (если не в Phase 3)
- `pattern-linter.md` — full (если не в Phase 2)

**hooks/product/:**
- `product-handoff-gate.js` — PreToolUse блокировка без valid handoff

### Acceptance criteria

- [ ] `/product:handoff FM-001 --mode draft` → `status: partial` handoff для PoC (3 blockers)
- [ ] `/product:handoff FM-001 --mode production` → все 8 blockers enforced
- [ ] SHA-hash drift detection работает между `.product/` и handoff
- [ ] `/product:validate --deep` покрывает V-01..V-16 + V-H-01..V-H-10 + V-MK-01..V-MK-08 (tier-aware)
- [ ] `/product:da-review FM-001` spawn'ит business DA (из Phase 1), получает 3-tier findings
- [ ] DA findings записываются в `.product/.da-findings/`
- [ ] NFR F.5a.0 Ask + F.5a.1 Define split работает, sanity ranges enforced
- [ ] `approve_overrides` (D2) работают — временное прохождение blocker с rationale

### Estimated effort

**3-4 часа.**

### Dependencies

- Phase 3 (FMs с behavioral spec нужны для handoff)

### Risks

- V-H-04 SHA drift detection требует consistent hash computation — легко напортачить с whitespace/line endings на Windows (CRLF auto-conversion).
- Pattern dictionary для `/product:patterns` пока минимальный — будет расширяться с реальным использованием.

---

## Phase 5 — Integrator Phase 2 (Installation + first adapter)

**Цель:** `/integrator:add` устанавливает первый D2-Tech инструмент (cc-sdd). Первый adapter `handoff-to-ccsdd.js` написан как reference.

### Deliverables (~8 файлов)

**commands/integrator/:**
- `add.md` — 6-stage flow: profile → propose → approve → install → configure → contract → verify
- `remove.md` — impact analysis + backup + cleanup
- `replace.md` — combined remove + add с migration
- `update.md` — backup + install + drift check + contract repair

**skills/integrator/:**
- `installation-protocol.md` — add flow methodology
- `contract-design.md` — how adapters are designed (manual in v1)

**hooks/integrator/:**
- `journal-hook.js` — autolog every modifying action

**adapters/:**
- `handoff-to-ccsdd.js` — **reference implementation** как контракт Product Module handoff → cc-sdd `/kiro:spec-init`

### Acceptance criteria

- [ ] `/integrator:add cc-sdd` проходит 6 stages без manual intervention (кроме approve gates)
- [ ] `pmo-mapping.yaml` обновляется с D2-Tech-02 coverage
- [ ] Adapter берёт `.product/handoffs/FM-001-handoff.md` и успешно invokes `/kiro:spec-init`
- [ ] `.kiro/specs/FM-001/spec.json` создаётся с корректным content
- [ ] `/integrator:remove cc-sdd` безопасно откатывает с backup
- [ ] `/integrator:update cc-sdd` detects drift при version upgrade, предлагает contract repair
- [ ] Decision journal logs каждое modifying action с контекстом

### Estimated effort

**3-5 часов.**

### Dependencies

- Phase 4 (handoff.md нужен для adapter тестирования)
- Integrator Phase 1 ✅

### Risks

- Contract design алгоритм — один из pending gaps. Первый adapter пишется вручную (не generated). OK для v1 — с опыта формализуем generation позже.
- Environment Scanner может находить unknown user customizations — UX должен быть graceful при clarification requests.

---

## 🎯 PILOT POINT

После Phase 5 — **первый end-to-end pilot возможен:**

```
Greenfield idea
    ↓
/ecosystem:bootstrap     (Phase 2)
    ↓
/product:init           → PS, MR, CA, SEG, VP, HYP
    ↓
/product:plan           → MVP, RM, RL-001, FM skeletons
    ↓
/product:feature FM-001 → обогащение до handoff-ready (Phase 3)
    ↓
/product:handoff FM-001 → handoff.md (Phase 4)
    ↓
/integrator:add cc-sdd  → installed + adapter (Phase 5)
    ↓
adapter invokes cc-sdd  → /kiro:spec-init → spec.json
    ↓
(human reviews generated spec)
```

### Почему pilot pause рекомендуется

**Реальный прогон на твоей идее даст feedback, который перепишет Phase 6/7 приоритеты.**

Примеры что может выйти наружу:
- Pattern dictionary для `/product:patterns` — из реальных anti-patterns
- Skill prompt tuning (discovery-session, feature-session) — что работает плохо в диалоге
- Missing edge cases в magnitude gating (A3)
- Real UX friction в approve gates — возможно A1/A2 нужны доработки
- Validation tier defaults — pilot правильно выставлен?

**Рекомендация:** pilot минимум на 1 week, 2-3 фичи end-to-end, logging friction в journal. Затем Phase 6/7 с informed decisions.

---

## Phase 6 — Design Module (conditional)

**Trigger:** первая FM с `has_ui=true` в pilot проекте.

### Deliverables (~10 файлов)

**commands/design/:**
- `start.md` — P2.5 entry (D.1-D.6)
- `iterate.md` — D.3 continuation for existing MK
- `system.md` — DS management
- `export.md` — D.6 для handoff §10
- `status.md` — design session dashboard
- `migrate.md` — Stitch ↔ HTML fallback conversion

**skills/design/:**
- `design-session.md` — P2.5 orchestrator
- `component-states.md` — D.4 checklist
- `design-system-rules.md` — DS extraction + merge
- `stitch-workflow.md` — Stitch MCP prompt patterns (OQ-DM-01)
- `design-validation.md` — V-MK-01..V-MK-08
- `html-fallback.md` — HTML/React generation path

**subagents/design/:**
- `screen-generator.md` — D.2 isolated context для множественной генерации

**hooks/design/:**
- `design-artifact-validate.js` — PostToolUse на `.product/mockups/`

**Integrator setup:**
- `/integrator:add stitch-mcp` (если Stitch выбран)

### Acceptance criteria

- [ ] `/design:start FM-001` → P2.5 D.1-D.6 end-to-end
- [ ] MK/DS/NM создаются в active, passed V-MK-* validation
- [ ] HTML fallback работает без Stitch (полноценный путь, не заглушка)
- [ ] `/design:export FM-001` заполняет §10 UI Specification в handoff
- [ ] Handoff §10 consumable внешним implementation tool через adapter
- [ ] Stitch rate limit (350 gen/month) graceful handled

### Estimated effort

**3-4 часа + OQ-DM-01 experimentation (prompt patterns для Stitch).**

### Dependencies

- Phase 4 (handoff §10 integration)
- Phase 5 (Integrator add для Stitch MCP)

### Risks

- OQ-DM-01 (prompt patterns для Stitch) пока open — первый реальный use case даст данные, но может потребовать переработки `stitch-workflow.md` после pilot.
- Component State Matrix автоматизация (V-MK-02..V-MK-03) может быть partial — некоторые проверки требуют human judgment.

---

## Phase 7 — Integrator maintenance

**Цель:** долгоживущая инфраструктура: обновления, debug, документация для будущего Orchestrator.

### Deliverables (~5 файлов)

**commands/integrator/:**
- `verify.md` — consistency check всех tools + contracts
- `debug.md` — diagnose error → suggest fix → apply with approve
- `docs.md` — generate tool-docs для Orchestrator (per SPEC §13)

**skills/integrator/:**
- `drift-detection.md` — recognize contract breakage patterns
- `tool-docs-generator.md` — API reference style, universal English
- `debug-protocol.md` — journal lookup + root-cause analysis

### Acceptance criteria

- [ ] `/integrator:verify` проверяет: all tools работоспособны, контракты валидны, PMO mapping актуален
- [ ] `/integrator:debug "error message"` анализирует journal + suggests fix
- [ ] `/integrator:docs --tool cc-sdd` генерирует `.claude/integrator/tool-docs/cc-sdd.md` в API reference стиле (English)
- [ ] Tool-docs readable для future Orchestrator (или human developer, приходящего извне)
- [ ] Periodic `/integrator:verify --light` через ScheduleWakeup (optional v1, можно отложить v1.1)

### Estimated effort

**2-3 часа.**

### Dependencies

- Phase 5 (нужно хотя бы 2 active tools для meaningful verify)

---

## Post-MVP: v1.1 candidates

- **Orchestrator Module concept** — draft SPEC после реального pilot experience
- **Pattern dictionary expansion** в `/product:patterns` — based on actual anti-patterns from pilot
- **Automated periodic `/integrator:verify --light`** через ScheduleWakeup
- **Project-class learnings** через Memory MCP (cross-project patterns)
- **Template variants** при bootstrap (если накопятся 2+ проекта с different stacks)
- **Update mechanism** для ecosystem repo — `/ecosystem:upgrade` с breaking change migration

## v2 candidates

- **P3 Feedback Integration** (при появлении D5 monitoring tooling)
- **P5 Actuality Refresh automation** (с реальными данными о staleness patterns)
- **OQ-I9 Multi-tool zones resolution** — routing logic when one PMO zone has 2+ tools
- **OQ-I11 Rollback global catalog** — когда shared catalog обновление ломается в одном проекте
- **OQ-DM-02 Tool switching mid-project** (Stitch → Figma migration)
- **Multi-product workspace support** — workspace-level артефакты
- **Orchestrator Module MVP implementation**

---

## Estimated total remaining

| Target | Phases | Time |
|---|---|---|
| **Первый pilot (minimum viable)** | 2 + 3 + 4 + 5 | ~13-20 часов |
| **Pilot с UI** | + Phase 6 | +3-4 часа |
| **Full MVP** | + Phase 7 | +2-3 часа |
| **Grand total до v1.0 complete** | All phases | ~18-27 часов |

Это чистое «focused work». Real calendar time зависит от ритма.

---

## Dependencies graph

```
Phase 0 ✅
    │
    ▼
Phase 1 ✅ ──┐
    │        │
    ▼        ▼
Phase 2      (Phase 1 нужен для bootstrap: install MCP stack)
    │
    ▼
Phase 3
    │
    ▼
Phase 4 ─── Phase 5 (parallel-possible после Phase 4; но Phase 5 нужен handoff.md input)
    │        │
    └────┬───┘
         ▼
    🎯 PILOT POINT
         │
    ┌────┴────┐
    ▼         ▼
Phase 6   Phase 7
(conditional) (maintenance)
```

---

## How this roadmap evolves

**Обновляется после:**
- Завершения каждой Phase — зафиксировать выученное, уточнить next Phases
- Изменения приоритетов (reality of pilot може требовать reshuffle)
- Решения об отсрочке / ускорении чего-либо в v1.1 / v2

**Формат изменений:**
- Phase deliverables можно редактировать
- Acceptance criteria можно уточнять
- Time estimates корректируются на основе fact
- Новые phases добавляются, старые — пометкой «skipped» (не удаляются)

**Decision journal entries** фиксируют значимые изменения roadmap с rationale.

---

## Связанные документы

- [CHANGELOG.md](CHANGELOG.md) — что сделано per release
- [BOOTSTRAP.md](BOOTSTRAP.md) — setup flow для новых проектов
- [docs/pmo/pmo-map.md](docs/pmo/pmo-map.md) — карта PMO (D1-D6)
- [docs/product-module/SPEC.md](docs/product-module/SPEC.md) — Product Module детали
- [docs/integrator-module/SPEC.md](docs/integrator-module/SPEC.md) — Integrator Module детали
- [docs/design-module/SPEC.md](docs/design-module/SPEC.md) — Design Module детали
