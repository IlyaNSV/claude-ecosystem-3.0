# Ecosystem 3.0 — Implementation Roadmap

> **Назначение:** единый source of truth для implementation plan. Каждая фаза имеет deliverables, acceptance criteria, dependencies, risks.
> **Статус:** активный документ. Обновляется после каждой завершённой phase + при изменении приоритетов.
> **Последнее обновление:** 2026-05-14.

## Где мы сейчас

```
✅ Phase 0 — Scaffolding + SPECs + v1 modifications
✅ Phase 1 — Integrator read-only + new business DA
✅ Pre-pilot fix — pmo-mapping.yaml formal schema (simplified)
✅ Bootstrap infrastructure — global installer + /ecosystem:bootstrap + /ecosystem:verify
✅ Phase 2 — Product Module core (Discovery Quick + drift mechanisms)
✅ Phase 2 pilot validated (2026-04-20) — 14 artifacts на my-first-test/, all gates passed
✅ Phase 3 readiness gate (2026-04-20) — DEC-DEV-0012 architectural decisions consolidated
✅ Phase 3 — Planning + Feature Enrichment + adaptive-depth DA + cascade detection (2026-04-27)
   — 23 files; smoke-tested on my-first-test (DEC-DEV-0023, 2026-04-29) + 1.1.1 patch shipped
✅ Phase 4 readiness gate (2026-05-10) — DEC-DEV-0024..0029 (13 architectural decisions)
✅ Phase 4 pre-implementation kickoff (2026-05-12) — DEC-DEV-0030 (26 ambiguities + 2 scope cuts)
✅ Phase 4 — Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline (2026-05-13)
   — 6 commands + 6 skills + 1 hook + 1 hook utility + 1 agent refactor + Language section в template
   — 8 sub-phase commits (A-H) + J static smoke + b8f16bc review fix-up (DEC-DEV-0031) + K1 closure docs
   — Static smoke 8/8 PASS; runtime smoke S1-S13+S15 deferred к user execution
   — DEC-DEV-0032 closure entry; 1.2.0 release
✅ Phase 4 closure ritual (Unit 2) — DEC-DEV-0033, 9 findings (5 inline fixed; 3 queued Phase 5; 1 user F4)
✅ Phase 4.1 — D7 Log Conformance Auditor (2026-05-14)
   — Hook marker writer + CLI orchestrator + AI aggregator + slash command + pilot opt-in command
   — `/meta:audit-smoke --phase=<N>` сверяет smoke-сессии с `PHASE_<N>_SMOKE_TEST_PLAN.md`; журнал идемпотентности
   — DEC-DEV-0034 entry; 1.2.1 patch release; runtime dogfood pending

[We are here ─────────────────────────────────────]

⏳ Phase 4 runtime smoke test (S1-S13+S15 — user-driven Claude Code session с .product/ data; первый usecase для Phase 4.1 auditor)
⏳ Phase 5 readiness gate — kickoff session per dev/PHASE_5_READINESS.md
⏳ Phase 5 — Integrator Phase 2 (Installation + first cc-sdd adapter)
⏳ 🎯 PILOT POINT — full end-to-end (handoff generation + external tool)
⏳ Phase 6 — Design Module (conditional, activate on first UI feature)
⏳ Phase 7 — Integrator maintenance (verify/debug/docs/update)

📦 Post-MVP (v1.1+): Deep mode subagents (D1.2/D1.3), atomic mass-rename, full BFS cascade auto-fix, bundle approve UX, D.7 aspirational layer (recursive auto drill-down + FM.depends_on graph), /product:clarify receiver channel, Orchestrator Module concept, /ecosystem:upgrade. Context: dev/v1_1_backlog.md
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

### ✅ Bootstrap infrastructure — global installer + setup commands

**Коммит:** будет следующим

**Проблема которую решили:** до клонирования ecosystem Claude Code физически не может автокомплит `/ecosystem:bootstrap`, потому что commands живут только в `.claude/commands/` (local) или `~/.claude/commands/` (user-global). Естественно-языковой trigger «Установи Ecosystem 3.0...» работал, но discoverability была нулевая.

**Что сделано:**
- `install.sh` (Unix/macOS/WSL) + `install.ps1` (Windows) — one-liner global installer:
  - Клонирует ecosystem в `~/.claude/ecosystem/` (глобальный кэш)
  - Копирует `commands/ecosystem/*.md` в `~/.claude/commands/ecosystem/`
  - Идемпотентен — повторный запуск pulls latest
- `commands/ecosystem/bootstrap.md` — полная slash-команда для per-project setup (12 steps с flags `--offline`, `--no-mcp`, `--force`)
- `commands/ecosystem/verify.md` — non-destructive health check (post-install и periodic)
- `templates/project/CLAUDE.md.template` — генерируется в корне нового проекта, даёт Claude Code immediate context
- Упрощён root `BOOTSTRAP.md` (human-readable overview), детали выведены в slash-команду
- Обновлены `README.md` (two-phase Quick Start) и `INSTALL-HUMAN.md` (Блок A — один раз на машину, Блок B — per project)

**Результат пользовательского флоу:**

```
# Phase 1 (один раз на машину)
curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash

# Phase 2 (per new project)
mkdir my-product && cd my-product
claude
> /ecosystem:bootstrap     # ← автокомплит работает
```

Детали: [BOOTSTRAP.md](BOOTSTRAP.md), [commands/ecosystem/bootstrap.md](commands/ecosystem/bootstrap.md), [INSTALL-HUMAN.md](INSTALL-HUMAN.md).

---

## ✅ Phase 2 — Product Module core (COMPLETED)

**Коммит:** будет следующим

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

**commands/ecosystem/:** ✅ **Выполнено** в Bootstrap infrastructure (до Phase 2).
- ✅ `bootstrap.md` — 12-step per-project setup
- ✅ `verify.md` — non-destructive health check

### Acceptance criteria (validated in first pilot — DEC-DEV-0008, 2026-04-20)

- [x] `/product:init "простое описание идеи"` в пустой папке → за 30-60 мин создаёт PS + MR + CA + SEG + VP + HYP, все в active
- [x] `/product:status` показывает актуальный dashboard
- [x] `/product:drift-check` работает на минимальном state
- [x] Artifact-validate hook тихо queues findings при `status: draft`, surfaces на approve
- [x] Session recovery работает через `/product:init --continue` после interrupt

### Delivered (20 файлов)

**commands/product/ (7):** init, status, config, drift-check, meta-feedback, patterns, promote-note
**skills/product/ Discovery (7):** discovery-session, problem-discovery, market-research-protocol-quick, competitive-analysis-protocol-quick, segment-discovery, vp-design, hypothesis-formulation
**skills/product/ drift mechanisms (4):** drift-detector, pattern-linter, meta-feedback, note-capture
**hooks/product/ (2):** artifact-validate.js (tier-aware B1 + quiet-draft-mode B2), session-state.js

### Known limitations / notes для pilot

- Skills для D1.2 MR и D1.3 CA Quick mode без Deep subagents — acceptable, flag для будущей доработки (subagents в Phase 3).
- Hook interaction с Claude Code — первый реальный тест trigger semantics. Могут потребоваться корректировки.
- `artifact-validate.js` в v1 покрывает basic rules (V-04, V-09, V-10, C2 confidence) — полный V-* catalog в validation-runner skill (Phase 4).

---

## ✅ Phase 3 — Planning + Feature Enrichment (P1.B + P2.A) — COMPLETED 2026-04-27

**Цель:** `/product:plan` + `/product:feature` создают MVP scope, roadmap, releases, FM skeletons, обогащают FM до handoff-ready behavioral spec (SC/BR/LC/VC/IC).

> **Scope refined 2026-04-20** per DEC-DEV-0012. Deep mode subagents и atomic mass-rename перенесены в v1.1 (см. [`dev/v1_1_backlog.md`](dev/v1_1_backlog.md)). DA debt mechanism dropped — заменён adaptive-depth DA на каждое изменение (см. [`docs/pmo/processes.md §6.2`](docs/pmo/processes.md)). NFR Review F.5a deferred Phase 4.
>
> **Implementation completed 2026-04-27** — 23 files (originally estimated 21, +2 for: devils-advocate.md adaptive-depth refactor per A.1 spec drift fix, dev/PHASE_3_SMOKE_TEST_PLAN.md). 9 commits across 10 sub-phases (A→J + prerequisite). Final lessons: DEC-DEV-0014 в DEV_JOURNAL.md. Real run smoke test pending — see [dev/PHASE_3_SMOKE_TEST_PLAN.md](dev/PHASE_3_SMOKE_TEST_PLAN.md).

### Deliverables (~21 файл)

**commands/product/ (5):**
- `plan.md` — P1.B Planning Session
- `feature.md` — P2.A Feature Enrichment + P2.B Creation
- `cascade.md` — manual cascade navigation (`<artifact-id>` или `--pending`)
- `bg:review.md` — pending BG candidates batch review
- `bg:rename.md` — **manual preview workflow** (sed/IDE find-replace; atomic implementation → v1.1)

**skills/product/ (12):**

P1.B Planning:
- `planning-session.md` — P1.B orchestrator (D1.6-D1.8)
- `mvp-scoping.md` — MoSCoW discipline
- `roadmap-planning.md` — 3-6 мес horizon
- `release-planning.md` — RL-* с rollout plans

P2 Feature Definition:
- `feature-session.md` — P2.A/B orchestrator (F.1-F.10) с placeholder'ами для F.5a NFR (Phase 4), F.8 Design (Phase 6), F.9 Product DA (Phase 4)
- `scenario-authoring.md` — SC actor-verb format (F.2)
- `business-rule-extraction.md` — из SC steps (F.3)
- `lifecycle-derivation.md` — LC из SC + BR (F.4, с C.3 auto-approve logic)
- `invariant-discovery.md` — IC formalism, severity (F.5)
- `vc-derivation.md` — VC (Gherkin) из SC + BR + LC (F.6, с C.3 auto-approve logic)
- `rpm-derivation.md` — RPM из SC.actors + BR authorization (F.7, с C.3 auto-approve logic)

Cross-cutting:
- `bg-extraction.md` — 5 phases algorithm
- `cascade-protocol.md` — methodology document для navigation

**hooks/product/ (3 new + 1 extension):**
- `bg-extractor.js` — PostToolUse, Phase 1 Candidate Extraction → `.product/.pending/bg-candidates.yaml`
- `cascade-check.js` — PostToolUse, **detection only + V-11 auto-fix**; full BFS auto-fix → v1.1
- `br-change-trigger.js` — PostToolUse `.product/business-rules/*.md`, invokes DA-with-adaptive-depth subagent (P-RULE-02 refactored)
- `ic-change-trigger.js` — PostToolUse `.product/invariants/*.md`, invokes DA-with-adaptive-depth subagent (P-RULE-01 refactored)
- **Extension to `artifact-validate.js`** (Phase 2): parse `validation_overrides[]` + `approve_overrides[]` + inline `expires_at` check; log skipped rules в `validation-pending.yaml` со статусом `overridden` (per C.5)

**Deferred to v1.1+:** Deep mode subagents (`market-researcher.md`, `competitor-analyst.md`), atomic mass-rename, full BFS cascade auto-fix beyond V-11, bundle approve UX. Full context preserved в [`dev/v1_1_backlog.md`](dev/v1_1_backlog.md).

**Deferred to Phase 4:** F.5a NFR Review, F.9 Product DA Review (formal step), full V-* validation runner, `/product:handoff`.

**Dropped (not deferred):** DA debt mechanism (per C.2 — adaptive-depth removes need).

### Acceptance criteria (validated by smoke test — DEC-DEV-0023, 2026-04-29)

- [x] `/product:plan` после Discovery → MVP scope, RM, RL-001, FM skeletons (canonical frontmatter с ASCII slugs)
- [x] `/product:feature FM-001` → F.1-F.10 minus deferred Phase 4/6 steps; FM transitions planned → in-progress
- [x] `/product:feature "<идея>"` creation mode → F.0 D1-alignment + skeleton + enrichment
- [x] BG extraction ловит bold terms; `/product:bg-review` batched presentation работает
- [x] Cascade detection работает: edit BR → `.pending/cascade-pending.yaml` populated; V-11 bi-dir auto-fix работает; navigation через `/product:cascade`
- [x] Adaptive-depth DA: edit BR (semantic) → subagent invoked с full 6-lens; edit BR (cosmetic) → subagent invoked с lightweight consistency check; output содержит `magnitude` + `classification_rationale`
- [x] A1 auto-approve срабатывает для 🟢 артефактов (LC, VC, RPM) с `confidence: high` + applicable V-* tier rules passed; decision journal entry; conversational notification
- [x] D2 overrides: `validation_overrides`/`approve_overrides` parsed; expired overrides treat as inactive; skipped rules logged со статусом `overridden`
- [x] Manual mass-rename `/product:bg-rename` показывает preview + sed-suggest

### Estimated effort

**6-10 часов** (revised from 4-6 после DEC-DEV-0012 scope analysis):
- 12 skills × 20-40 мин = 4-9 часов
- 3 new hooks + 1 extension = 1-2 часа
- 5 commands = 1-2 часа
- Smoke test pilot = 1-2 часа
- DEV_JOURNAL maintenance + spec sync = 30-60 мин

Реалистично 2-3 рабочих сессии. После Phase 3 — pilot smoke test обязателен (CLAUDE.md «pilot after every phase» policy).

### Dependencies

- Phase 2 (Discovery artifacts нужны как input для Planning и Feature)
- Phase 2 pilot validated (DEC-DEV-0008) ✓

### Risks

- **Cascade protocol implementation на JS** — графовая операция; mitigation: detection-only scope для v1, V-11 auto-fix только.
- **Adaptive-depth DA subagent prompt design** — single subagent invocation должен правильно классифицировать magnitude и адаптировать output; risk over/under-triggering. Mitigation: pilot test после Phase 3, refine через `/product:meta-feedback`.
- **Skill frontmatter drift** — Phase 2 PS skill drift (DEC-DEV-0011) показал что AI rename fields. Mitigation: B.1 convention — explicit frontmatter template обязателен в каждом skill, создающем артефакт.

---

## ✅ Phase 4 — Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline — COMPLETED 2026-05-13

**Цель:** `/product:handoff` работает в обоих режимах (draft/production). Validation catalog полностью реализован. F.9 DA review three-tier (artifact / feature / release). NFR F.5a Ask + Define workflow. Language discipline (Russian default). HYP frontmatter drift fixed.

> **Scope refined 2026-05-10** per DEC-DEV-0024..0029 — 13 architectural decisions (C.1-C.5, D.1-D.5, A.3, +D.6 language, +D.7 release DA).
>
> **Pre-implementation kickoff 2026-05-12** per DEC-DEV-0030 — 26 ambiguity resolutions + 2 scope cuts (`/product:clarify` channel deferred к v1.1; D.7 aspirational layer split — core shipped, recursive auto drill-down + FM.depends_on graph deferred).
>
> **Implementation completed 2026-05-13** — 8 sub-phase commits (A-H) + J static smoke + b8f16bc review fix-up (DEC-DEV-0031) + K1 closure docs. Closure entry: DEC-DEV-0032. Closure ritual (Unit 2) pending fresh-session run.

### Deliverables shipped

**commands/product/ (6):**
- `validate.md` — on-demand `/product:validate` V-01..V-16 + V-H-01..V-H-11; `--rule`, `--scope`, `--tier`, `--deep` filters
- `nfr-review.md` — `/product:nfr-review FM-NNN`: F.5a.0 Ask + F.5a.1 Define
- `nfr-upgrade-tier.md` — batch re-review при product_tier upgrade (MVP → MMP)
- `handoff.md` — `/product:handoff FM-NNN [--mode draft|production] [--regenerate] [--with-da-review]`
- `cleanup.md` — `/product:cleanup [--dry-run] [--pending-hygiene]`: V-15 orphan detection + opt-in 3-pending-file sweep
- `da-review.md` — `/product:da-review FM-NNN | RL-NNN`: ID-prefix routing; interactive [Act/Defer/Dismiss/Skip]

**skills/product/ (6 new/refactored):**
- `validation-runner.md` — hardcode rule catalog + V-16 NFR severity matrix; auto-purge stale pending
- `nfr-review.md` — sanity ranges integration; informational warning override pattern
- `handoff-generator.md` — 13 sections, mode-aware DoR, hash utility integration, `--with-da-review` real invocation
- `cleanup-detector.md` — V-15 algorithm + 3-pending orchestration + Design module conditional
- `product-da-review.md` — FM-level + RL-level branches; brief construction; canonical schema verify
- `hypothesis-formulation.md` — drift fix (Phase 4.A): canonical `target_value`, `segment`, `value_proposition`

**agents/product/:**
- `devils-advocate.md` (refactor) — three sub-modes (adaptive / full+feature / full+release); 6 release-level lenses; canonical frontmatter schema (DEC-DEV-0030 A.1)

**hooks/product/:**
- `product-handoff-gate.js` — PostToolUse non-blocking drift warning (b8f16bc fix: line-based parser robust к multi-entry hashes)
- `lib/hash.js` — shared SHA-256 utility (body-only, LF-normalized, cross-platform)

**templates/:**
- `templates/project/CLAUDE.md.template` — «Language and tone» section (Russian default + identifiers/paths/commands verbatim)

**Language reminders в 5 user-facing skills:** planning-session, feature-session, scenario-authoring, business-rule-extraction, release-planning.

**Schema introductions:**
- Canonical DA findings frontmatter (9 fields + 6 anti-pattern variants) — DEC-DEV-0030 A.1
- Three-tier DA hierarchy (artifact / feature / release)
- V-H-11 NFR section conformity rule (b8f16bc)

**Deferred to v1.1+ (per DEC-DEV-0030 cuts + v1_1_backlog.md):**
- `/product:clarify` receiver channel (Phase 5 dependency)
- D.7 aspirational layer: recursive auto drill-down + `FM.depends_on` structural graph

**Removed (Ambiguity 22):** `--scope` flag from `/product:da-review` signature (collision с `scope:` schema field).

### Acceptance criteria

- [x] `/product:handoff FM-001 --mode draft` → `status: partial` handoff для PoC (3 blockers B1/B2/B5; warnings для missed B3-B4/B6-B8)
- [x] `/product:handoff FM-001 --mode production` → все 8 blockers enforced; refuses без auto-downgrade к draft
- [x] SHA-hash drift detection работает между `.product/` и handoff — `hooks/product/lib/hash.js` shared utility (body-only, LF-normalized); cross-platform invariant
- [x] `/product:validate --deep` покрывает V-01..V-16 + V-H-01..V-H-11; V-MK-01..V-MK-08 skipped с graceful note (Phase 6 conditional per DEC-DEV-0028 D.4)
- [x] `/product:da-review FM-001` spawn'ит business DA в Mode: full + scope: feature; receives 3-tier findings
- [x] `/product:da-review RL-001` spawn'ит business DA в Mode: full + scope: release; cross-FM findings с affected_artifacts + suggested_drill_down
- [x] DA findings записываются в `.product/.da-findings/<id>-<YYYY-MM-DD>-<HHMM>.md` per canonical schema (DEC-DEV-0030 A.1)
- [x] NFR F.5a.0 Ask + F.5a.1 Define split работает, sanity ranges informational warning (DEC-DEV-0025 C.2)
- [x] `approve_overrides` (D2) работают — временное прохождение blocker с rationale; expires_at check
- [x] `/product:cleanup [--pending-hygiene]` — V-15 orphan + 3-pending sweep (cascade revalidate + validation purge + da-pending stale flag)
- [x] Language discipline — Russian default в user-facing skills + template section
- [x] HYP frontmatter canonical (target_value, segment, value_proposition)
- [ ] **Runtime smoke test S1-S13 + S15** — user-driven Claude Code session с `.product/` data (deferred per AI session capability boundary; findings → retroactive DEC-DEV-NNNN entry)
- [ ] **Phase 4 closure ritual (Unit 2)** — D7 phase-closure.md 6 steps в next session (fresh-session preferred); produces own DEC-DEV-NNNN refinement entry

### Estimated effort actual

**12-15 часов** (vs ROADMAP base 3-4h; 3-4x multiplier consistent с Phase 2/3 pattern):
- Architectural kickoff (DEC-DEV-0024..0029): ~3h
- Pre-implementation kickoff (DEC-DEV-0030): ~2h
- Sub-phase A-J implementation: ~10h
- Post-rebase resolution + closure docs: ~1h

### Risks (observed + resolution)

- ✅ **V-H-04 SHA drift cross-platform** (Risk #1) — resolved via `lib/hash.js` LF normalization; same utility shared between skill + hook (DEC-DEV-0025 C.1)
- ✅ **`extractArtifactHashFromHandoff` regex bug** (b8f16bc DEC-DEV-0031 A1) — silently failed для non-FM artifacts; line-based parser fix shipped; smoke runner functional test guards regression
- ✅ **DA findings field-name drift** (anti-pattern risk) — B.1 convention applied; 6 forbidden variants explicit в `devils-advocate.md`; static check verified 9/9 canonical preserved post-rebase

### Lessons (DEC-DEV-0032)

1. D7 discipline phase-closure ≠ Phase implementation closure — K split into Unit 1 (close) + Unit 2 (ritual)
2. Mid-phase rebase на shipped review-fix — ~30 min overhead; budget accordingly
3. Three-tier DA hierarchy ID-prefix routing — clean extension pattern
4. Canonical frontmatter schema centralization + B.1 anti-pattern enforcement works
5. Static smoke ≠ runtime smoke — split done-gates explicitly
6. Effort multiplier 2-3x ROADMAP estimate stable after 3 phases — refinement candidate

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

**Deferred from Phase 3 (per DEC-DEV-0012, 2026-04-20):**
- **Deep mode subagents** для D1.2/D1.3 Discovery — `market-researcher.md` + `competitor-analyst.md` (8-phase pipeline). Полный context для реализации в [`dev/v1_1_backlog.md`](dev/v1_1_backlog.md). Bring-forward trigger: 2-3 real Discoveries показывают конкретные limits Quick mode.
- **Atomic mass-rename** `/product:bg:rename` — git-stash workflow, conflict handling, rollback. v1 ships manual preview placeholder. Bring-forward trigger: 5+ mass-renames в течение месяца на active projects.
- **Full BFS cascade auto-fix beyond V-11** — graph traversal с priority ordering, V-08 auto-fix, dependency status updates. v1 ships detection-only + V-11. Bring-forward trigger: pattern emerges из `cascade-pending.yaml` resolutions.
- **Bundle approve UX для cascade** — consolidated diff + approve all/per-item. Tied to full BFS expansion.

**Other v1.1+:**
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
