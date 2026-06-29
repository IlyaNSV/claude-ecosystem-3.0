# Ecosystem 3.0 — Implementation Roadmap

> **Назначение:** единый source of truth для implementation plan. Каждая фаза имеет deliverables, acceptance criteria, dependencies, risks.
> **Статус:** активный документ. Обновляется после каждой завершённой phase + при изменении приоритетов.
> **Последнее обновление:** 2026-06-29 — **N+2 OWED-batch live-run грейд'нут (Run 1/2/3, DEC-DEV-0114):** 6/7 инкрементов LIVE-VALIDATED — **FB-LR-16/0102** (non-ready commit disclosure, Run 3 glossary под `readiness=DEGRADED`) + **FB-LR-19/0104** (P5-конверт несёт nested-P6 `conflicts:[3]`/`findings:[7]`), re-confirm FB-LR-21/T5-escalation/FB-LR-15-нег. **Бонусом live-validated мои Ф1-фиксы:** **0112** (probe DEGRADED-не-ложный-DOWN ×3) + **0113** (два ОДНОВРЕМЕННЫХ worktree чеканили PA-031..033 vs PA-034..037 без коллизий → закрывает 0111-OPEN FB-LR-23 и QUEUED FB-LR-24). ДОЛЖОК: **V-2/0103** (персоны не спавнились — Run 1 повторил плохой FB-LR-26-дизайн; re-prep на изолированной ветке пилота с реальным oracle-<1 gap). Новый дефект **FB-LR-27** (CRLF в `.mjs` ломает `scriptPath`-Workflow на Windows) — заведён, source-side починен (root `.gitattributes` eol=lf → fresh checkout ship'ит LF); пилот-side delivery-`.gitattributes` — QUEUED. Next-free DEC-DEV = **0115**. Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`. **Ранее (2026-06-27):** **N+2 gate-followups live-сверка батча (Fork C: G-1/R-1/G-2) ВЫПОЛНЕНА (DEC-DEV-0111):** LIVE-VALIDATED — FB-LR-21/0106 (RA-10 surface'ит orphan), FB-LR-15/0101-негатив, T5/0096 escalate-don't-mask; ДОЛЖОК (дизайн прогонов, не код) — V-2/0103 (персоны gap-gated), FB-LR-16/0102-disclosure + T1 (субстрат подняли до гейта → READY); новый дефект FB-LR-23 (параллельные worktree делят git-checkout/index, → 0111). Next-free DEC-DEV = **0112** (0107-0111 заняты). Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`. **Ранее (2026-06-26):** **N+2 gate-followups слиты (PR #67 `cc19398` / runbook #68 `37ec14e`), 0 открытых PR.** Дочистка P6-гейта по находкам ре-валидации: **FB-LR-15** loud validator-drop (`validators_incomplete` → чистый GO ↓ MANUAL_VERIFY, **0101**), **FB-LR-16** non-READY commit disclosure (`committed_under_non_ready`, **0102**), **FB-LR-21** RA-10 surface-orphan + **FB-LR-20/22** doc-boundary (**0106**) — всё additive (24/44), P6 wiring 24→26, verify зелёный. Live-сверка батча — по `dev/PILOT_RUNBOOK_N2_GATE_FOLLOWUPS.md`. Ранее (2026-06-25, `cd2d19f`): весь Orchestrator-инкремент **N+2 «Trustworthy gate outcomes»** слит и **live-validated** на пилоте: T1 verdict×readiness (0092), T2 order-aware verify (0093), P3 defect-enum (0094), T4 design→tasks coverage (0095), T5 remediation guardrails (0096), P6 feedback-фаза-2 (0097), riders (0089). **Pilot-ре-валидация Track O A+B+C завершена** — Run A (P4) PASS, Run B (P6) PASS, **Run C на свежей фиче `glossary` подтвердил T3 (реальный вложенный P6 по `{scriptPath}`, без advisory-fallback) + T5-эскалацию**; наблюдаемость-фикс P5-конверта **DEC-DEV-0104** (FB-LR-19; findings FB-LR-19..22). **Vision Increment 1** слит — Epic A (3 персоны architect/qa/ux-advisor + zone→agent роутер) + B1-core completeness-loop (DEC-DEV-0098/0099) + **Track V live-run** (V-1 zone-хук / V-3 оракул PASS; V-2 frontmatter-фикс — DEC-DEV-0103). Счётчики **24/44** без изменений (всё additive). Последний DEC-DEV = **0106** (0101/0102 = FB-LR-15/16 fix; 0106 = riders FB-LR-20/21/22; next free = 0107). Предыдущее обновление 2026-06-24 — Autonomous Pipeline Vision (эпики A-F) принят как направление (DEC-DEV-0098; концепт `dev/ECOSYSTEM_VISION.md`, PR #52). Ещё ранее 2026-06-18 (Релиз **1.6.0** cut — minor, бандл с 1.5.0; тег `v1.6.0`. Главное: **Orchestrator Module — первый инкремент P3+P5 ПОСТРОЕН** (DEC-DEV-0073/0076/0077, PR #33) + deployment-wiring (0078, PR #34) + **первый живой прогон RUN 01** (FB-001…011, PR #37, billing 19/19 GO; критический FB-001 args-string→billing-under-auth починен). Также: **App Map** 24-й артефакт (DEC-DEV-0066, PR #30); **`product_class`** D1-классификация (DEC-DEV-0079, PR #35); **open-design generator** dual-role (DEC-DEV-0067, PR #31); **worktree pre-flight** (DEC-DEV-0065, PR #29); реконсиляция пилот→экосистема — handoff §10 fidelity (0074), V-18 + DA-контракт (0064, PR #28), cascade SC↔MK (0080, PR #37). Session Audit v2 — два полных цикла find→synth→verify→accept→patch (0064/0080). Счётчики: артефактов 23→24, правил валидации 40→44. **Deferred к next pilot** (без изменений): §6 capability-канал + процессы Orchestrator P2/P4/P6/P7; runtime smoke S-LE (LESSON-gate) + Phase 6 S1-S7. Предыдущий релиз: **1.5.0** (2026-06-11, DEC-DEV-0055/0061/0062/0063, тег `v1.5.0`). Граница Integrator↔Orchestrator — role A (DEC-DEV-0060).

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

✅ Phase 4 runtime smoke — audited 2026-05-20 → status=fail (9 pilot sessions; DEC-DEV-0038)
   — Phase 4 ЗАКРЫТА: smoke дал fail, known issues приняты и задокументированы (audit-reports/phase-4-summary.md)
   — re-verification gate снят (DEC-DEV-0038 follow-up); smoke-план + fixtures удалены

✅ Phase 5 readiness gate (2026-05-25) — DEC-DEV-0040 (Q1-Q6 + functional PMO refactor)
✅ Phase 5 — Integrator Phase 2 (Installation + first cc-sdd adapter) — IMPLEMENTED 2026-05-25
   — 3 commands (add/remove/update) + 4 skills (installation-protocol/contract-design/drift-detection/tool-docs-generator)
     + 2 subagents (tool-profiler/contract-designer) + 1 hook (journal-hook) + 1 reference adapter (handoff-to-ccsdd.js)
     + 1 fixture (FM-FIXTURE-001-handoff.md) + scaffolding (hooks/integrator/manifest.yaml, adapters/README.md)
   — 10 sub-phase commits A-J; Stage 6 fixture contract-test verified (exit 0; 6 checks pass)
   — Per DEC-DEV-0040 Q3 boundary: Integrator-only scope (Stage 6 ends at fixture verify);
     production routing (handoff → live /kiro:spec-init) → Orchestrator (out of Phase 5)
   — DEC-DEV-0041 closure entry

✅ Phase 5 runtime smoke + closure (2026-05-26) — DEC-DEV-0044
   — 4 PASS clean (S1/S2/S4 + S3 post-fix); S6 PARTIAL→FIXED; S5 deferred
   — 3 bugs fixed end-to-end: bug 1 (skill+agent narrow heuristic), bug 2 (bootstrap/update не deploy adapters/),
     bug 3 (journal-hook Windows path regex separator)
   — Architectural refinement: Q1 dual-location → tri-location pattern (repo canonical → pilot reference layer
     `.claude/adapters/` → pilot instance `.claude/integrator/adapters/`)
   — Plan archived dev/_archive/phase-5/PHASE_5_SMOKE_TEST_PLAN.md; forensics dev/_archive/phase-5/smoke-evidence/

✅ Phase 5.1 patch (2026-05-26) — DEC-DEV-0045; 1.3.2 release
   — Bug 4 fix (3 facets): D2/D3 drift checks refactored к local-only (pilot reference vs instance, no cross-repo);
     @source_ref now audit-only (read from .claude/adapters/.sync-metadata.yaml stamped by /ecosystem:{bootstrap,update})
   — C-03 cosmetic: SUPPORTED_HANDOFF_GENERATORS array → regex (accepts patch-suffix versions)
   — S5 runtime smoke verification deferred (code landed; pilot session for /integrator:update --check-only at user's discretion)

✅ Patch 1.3.3 (2026-05-27) — DEC-DEV-0047; 1.3.3 release
   — Integrator scope discipline + environment tiers + pending-actions journal + research hard approve gate
   — 4 deliverables: B-1 env_tiers (SPEC §4.2.1 + tool-profiling + research-protocol);
     B-2 hooks/integrator/scope-guard.js PreToolUse warn-only (marker-gated, 1h stale TTL, forbidden paths
     .product/ .kiro/ docs/pmo/ .claude/docs/pmo/ + whitelist exceptions, regex sniffer for Bash);
     B-3 .claude/pending-actions.md ecosystem-wide journal + /ecosystem:pending-actions + skills/ecosystem/user-action-tracker.md;
     B-4 /integrator:research Step 7 hard gate + research-protocol Phase 5 guards + SPEC §7.6 consilium-pattern
   — 9 sub-phase commits (kickoff + A-H + I=tag) + static smoke 13/13 PASS
   — Hard-block scope-guard mode deferred к v1.4.0+ (см. dev/v1_1_backlog.md)
   — Runtime smoke S1-S5 (dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md) deferred к next pilot session

✅ Local docs polish track (closed 2026-05-27, DEC-DEV-0046) — bundled in 1.3.3 release
   — Obsidian vault baseline + README cross-link polish shipped
   — Plan archive candidate (after next phase opens)

✅ Patch 1.3.4 (2026-05-27) — DEC-DEV-0049; 1.3.4 release
   — `/ecosystem:update` Step 6 REPLACE → pattern-preserving merge
   — Third-party hook injections (bd prime, etc.) больше не wipe'ятся при ecosystem upgrade
   — Driven by downstream `my-first-test` pilot evidence (DEC-INT-0005, 2026-05-27)
   — Spec-only change (commands/ecosystem/update.md); bootstrap Step 6b already correct
   — Smoke verification deferred к next pilot `/ecosystem:update` run

✅ Patch 1.3.5 (2026-05-27) — DEC-DEV-0051; 1.3.5 release
   — `/ecosystem:update` Step 5 nuclear sync → namespace-aware sync
     + Step 2 backup extended до integrator-managed external paths
   — Closes same class of bug as 1.3.4 (ecosystem zone shared with third-party tools):
     cc-sdd `kiro-*` skills больше не уничтожаются при update; `.kiro/`, `.beads/` etc.
     попадают в `_external/` backup для rollback safety
   — Surfaced during static dry-run of 1.3.4 spec on real downstream state
   — Spec-only change (Step 2/4/5/8 + Rollback section); bootstrap unchanged (already correct)
   — Smoke verification deferred к next pilot `/ecosystem:update` run

✅ Pre-Phase-6 architectural addendum (DEC-DEV-0048, 2026-05-27) — SPEC v1.1 (Claude Design co-primary + IR groundwork)
✅ Phase 6 kickoff (DEC-DEV-0052, 2026-05-27) — 12 Qs / 13 ambiguities resolved + 5 cuts approved; sub-phase A→I готов
✅ **Phase 6 — Design Module v1.0 (DEC-DEV-0053, 2026-05-28) — 1.4.0 release** — 8 sub-phase commits A→I; 6 commands + 6 skills + 1 hook + manifest + handoff-generator.md Step 8c. All 12 Qs implemented; 5 cuts respected; 13 ambiguities resolved at locations. Static smoke 19/19 PASS. Runtime smoke S1-S7 (`dev/gates/PHASE_6_SMOKE_TEST_PLAN.md`) deferred к next pilot session per Phase 5 precedent.
   ▲ последняя отгруженная ФАЗА = ТЕКУЩИЙ phase-статус (следующая фаза = Phase 7); D7 meta-tooling трекается отдельной строкой ниже. Маркер «[We are here]» удалён — был drift-bait (Tier-1 doc reform)

✅ **Session Audit v2 — D7 universal session auditor (2026-06-01..02)** — эволюция Phase 4.1 аудитора из phase-валидатора в замкнутый авто-механизм аудита ПРОДУКТОВЫХ сессий. D7 dev-only (`dev/meta-improvement/`, НЕ деплоится); phase-прогрессия не затронута. Гайд: `dev/meta-improvement/SESSION_AUDIT_GUIDE.md`
   — Инкр.1+2 merged 2026-06-01 (PR #20, DEC-DEV-0056/0057): классификатор сессий + реестр рубрик + полу-авто watcher (`audit-watch.js` + /loop) + effect-probe G4 (эффект на `.product/`)
   — Инкр.3 merged 2026-06-02 (PR #21, DEC-DEV-0059): re-anchor оракула на PMO-зоны (two-axis multi-label, owned-only; `ecosystem-dev` убран — только продуктовый аудит) + findings-журнал G5 (`audit-journal.ndjson`) + синтезатор патчей G6 с adversarial-verify (`patch-synth.js`)
   — Два полных цикла find→synth→verify→accept→patch отработаны: **DEC-DEV-0064** (DA subagent-type контракт + V-18 schema, PR #28) + **DEC-DEV-0080** (cascade SC↔MK, PR #37). Pending-очередь пилота обработана; genuine re-routes из refuted-кластеров сохранены в `dev/meta-improvement/audit-reroutes.md` (incl. blocking `309cc2cf` handoff path-bug → own item)

✅ **Orchestrator Module — первый инкремент P3+P5 ПОСТРОЕН + первый живой прогон (1.6.0)** — концепт (DEC-DEV-0058, SPEC v0.1; роль «тимлид PMO», 3-слойная детерминизм-модель, двусторонний канал Orchestrator↔Integrator) реализован в первый инкремент через dogfood-harvest реальной cc-sdd сессии RUN 01. **P3 `batch-features-to-cc-sdd`** + **P5 `feature-to-tdd-impl`** (DEC-DEV-0073/0076/0077, PR #33) — гибрид над cc-sdd «оркеструем, не переписываем»: вызов `kiro-spec-batch`/лифт `kiro-impl` + net-new `coverage-oracle` + `gate-risk-classifier` (17/17). `/orchestrator:run <process>`; deployment-wiring в `/ecosystem:update` namespace-aware (DEC-DEV-0078, PR #34)
   — **Первый живой прогон RUN 01** на пилоте (DEC-DEV-0073 follow-up, FB-001…011, PR #37): billing 19/19 GO; критический **FB-001** (Workflow args строкой → billing под видом auth) починен + test-locked (`tests/orchestrator/args-parsing.test.cjs`); deep-dive `dev/meta-improvement/audit-reports/c4546225-orchestrator-deep-dive.md`. Smoke fixtures: `npm run verify` зелёный
   — Граница Integrator↔Orchestrator — role A (DEC-DEV-0060): §6 = запрос **capability** («руки» tool/MCP + «голова» role-агент/skill), Интегратор оснащает, deploy исполняет Оркестратор
   — **S6 dogfood проведён (2026-06-18→19, DEC-DEV-0081):** uncontaminated §6 re-test (FM-002 localization P5/D3, GO 26/26) → **§6-A…E + Q#2 = FAIL** — канал не сработал по реальному provider-пробелу. Root-cause: §6 = **обработчик блокировок, не детектор пробелов**; spec-mandated Mock (DEC-A06) сделал отложенность не-блокирующей → instruction-silent (контраст billing-блок→сработал vs providers-mock→молчок). Конкретный баг: субагент пишет отложенность в CONCERNS, но `feature-to-tdd-impl.mjs` его роняет. **DEC-DEV-0078 update-smoke = PASS.** Фикс = 5 ранжированных (#1 CONCERNS-propagation / #2 GO-disclosure / #5 §6-E рубрика — валидируемы сейчас; #3/#4 detect-leg — нужен S7-ретест). **Deferred:** реализация фиксов §6 + S7; процессы P2/P4/P6/P7 (нужны D3/D5-инструменты); admin-спека FM-007 coverage re-run

🛡 **`/ecosystem:update` level-2 wipe protection (DEC-DEV-0061, 2026-06-05, 1.5.0)** — git safety-commit footprint'а установленных инструментов (`.claude/integrator/` + все `active-tools.yaml` `claude_primitives` internal+external + `settings.json`) перед apply. Новый Step 5.0 (default on, `--no-safety-commit`; scoped commit, никогда `-f`, skip-not-abort). Дополняет хрупкий level-1 файловый backup (untracked / частично gitignored). Spec-only; pending runtime smoke. Политика «no-auto-commit» сужена (не отменена)

✅ **LESSON-* — atomic self-correction для продуктовых проектов (DEC-DEV-0062, 2026-06-06, 1.5.0, merged PR #25)** — закрыт пробел: смысловой класс ошибки «задача / артефакт / решение сделаны некорректно» (раньше ловились только структурные нарушения через `.product/.pending/`). 23-й тип артефакта `.product/lessons/LESSON-NNN-*.md`; операция find→fix→record **атомарна и неоткладываема** (инверс `.pending/`). 3 слоя: mandate (`templates/project/CLAUDE.md.template` + синкаемый `skills/ecosystem/self-correction.md`) + write-ahead command `/product:lesson` (open-tripwire до фикса → verify с recorded evidence → флип open→active) + двупронговый gate (`lesson-gate.js` Stop **strict** / `lesson-presence-gate.js` PreToolUse+UserPromptSubmit **warn**). Инвариант V-LE-02/03: `active ⇒ фикс применён+проверен+guard present`. **Первый блокирующий хук экосистемы** (scoped, fail-open, `LESSON_GATE_MODE` opt-out, 8-block auto-override). 18 файлов; gate-mode выбран после web-search верификации hook-контракта (поправлена Stop/SessionEnd конфляция синтеза — Lesson #1). **Pending: S-LE live-smoke** (`dev/gates/S_LE_LESSON_GATE_SMOKE.md`) — hard-prereq перед переводом PreToolUse в strict; механизм деплоится в продуктовые проекты, в dev-сессии экосистемы no-op (сознательно, self-collapse guard)

✅ **open-design — переиспользуемый Dockerized viewer/migrate-target экосистемы (DEC-DEV-0063, 2026-06-06, 1.5.0, merged PR #26)** — open-design (nexu-io, Apache-2.0) вынесен из одноразового per-project `/integrator:add` в переиспользуемые куски репо + один машинно-глобальный Docker-daemon (127.0.0.1:7456). **Integrator (инфра):** reference-адаптеры `stitch-to-opendesign.js` + `mk-to-stitch.js` (CNT-002 backfill — закрыт tri-location gap); новый `source: docker` tool-type + SPEC §4.1.1 «Dockerized external-daemon pattern» (shared-daemon-per-machine, Bearer на всех `/api/*`, `127.0.0.1` не `localhost`, image-digest pin, ZERO `.claude` primitives); `/integrator:add` docker-path (connectivity-validate вместо install, никогда auto-`docker run`). **Design Module (D2-B04):** `/design:migrate --to open-design` viewer-import (без regeneration/metadata/iteration bump — канон в MK/NM); skill `open-design-viewer.md`; `external_viewers` дефолт в `design.yaml`; daemon-check в `/design:status`. **Ops:** BOOTSTRAP machine-global daemon-setup (token-gen, `docker run` recipe, supply-chain pin). Live E2E: import HTTP 200, `token_source: home-secret` доказал машинно-глобальную модель

✅ **App Map (AM) — 24-й тип артефакта (DEC-DEV-0066, 1.6.0, PR #30)** — L0 «вид всего приложения» (модули FM × кейсы SC × cross-module пути + редакторский CJM-слой) поверх per-flow NM с anti-duplication firewall (AM ссылается на NM по id, не переписывает переходы). `/design:map [--write] [--html]`, детерминированный scanner + cascade-хук + USER FLOW HTML walker. Канонизирован из пилота (реконсиляция шаг 2). Счётчики 23→24 / 40→44 (+ закрыт deferred 0064 sweep 39→40)

✅ **`product_class` — D1-классификация типа продукта (DEC-DEV-0079, 1.6.0, PR #35)** — opt-in dimensional блок в `product.yaml` (archetype + ортогональные фасеты runtime_locus/interface/distribution), advisory-проброс в handoff (помечено «shape, not stack»), открытый словарь (degrade-not-reject). Без gate; `unset` = поведение до 0079 (full backward-compat). Backfill-промпт для существующих проектов в CHANGELOG-записи

✅ **Реконсиляция пилот→экосистема (DEC-DEV-0065 класс дрейфа, 1.6.0)** — пилотные фичи и найденные пилотом баги доведены в канон: worktree pre-flight advisory (PR #29), open-design generator dual-role (DEC-DEV-0067, PR #31), App Map (выше); upstream-фиксы: handoff §10 fidelity (DEC-DEV-0074), V-18 per-type schema + DA subagent-type контракт (DEC-DEV-0064, PR #28), cascade SC↔MK reverse-ref (DEC-DEV-0080, PR #37)

✅ **Orchestrator N+2 «Trustworthy gate outcomes» — ПОСТРОЕН + LIVE-VALIDATED (2026-06-23..25, consolidated main `cd2d19f`)** — после аудита N+1 live-run (DEC-DEV-0091) весь content-queue слит в `main`: **T1** verdict×readiness + либа `env-readiness.cjs` (0092, PR #41), **T2** order-aware verify — baseline-sha + 3-way disposition в P4+P6 (0093, #42), **P3** defect-enum + polarity-gate (0094, #43), **T4** design→tasks coverage-оракул (0095, #44), **T5** remediation-guardrails — `remediation-guard.cjs`: escalate cross-spec/design конфликт, transient bounded-retry (0096, #46), **P6 feedback-фаза-2** dev-консолидатор `feedback-intake.js` (0097, #48), riders PA-dedup + `missing-trace-source` (0089, #50)
   — **Pilot-ре-валидация Track O A+B+C (2026-06-24..25)** по слоёному evidence-модели + слепые аудиторы V1≈V2 + нейтральный судья: A (P4 localization ×2) PASS; B (P6 billing, Docker down→up) PASS (FB-LR-15/16 → **FIXED**, DEC-DEV-0101/0102); **C на свежей фиче `glossary` (session `1ff7e2d8`, 1 wf / 99 агентов) — T3+T5 LIVE-VALIDATED**: реальный вложенный P6 по `{scriptPath}` (mechanical + RA-8/9/10 + verify-finding + remediation + verdict, без `GATE DEGRADED`-fallback — окончательно опровергает память `p6_delegation_unresolvable`); T5-эскалация без маскировки (NO-GO held). Находки FB-LR-19..22; **FB-LR-19 (P5-конверт ронял `conflicts`+`findings` гейта) FIXED — DEC-DEV-0104**. Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`
   — **N+2 gate-followups ПОСТРОЕНЫ + СЛИТЫ (2026-06-26, PR #67 `cc19398` / runbook #68 `37ec14e`):** дочистка P6-гейта по открытым находкам ре-валидации — **FB-LR-15** bounded re-spawn упавшей на terminal-API-error линзы → `validators_incomplete` понижает чистый GO до MANUAL_VERIFY (**DEC-DEV-0101**); **FB-LR-16** ремедиация под non-READY помечает+дисклозит коммит, не запрещая его (`committed_under_non_ready`, политика a, **0102**); **FB-LR-21** RA-10 surface'ит spec-санкционированный orphan + **FB-LR-20/22** doc (seam-split паттерн / граница `remediation-guard`, **0106**). Всё additive → counts 24/44; P6 wiring 24→26; `npm run verify` зелёный. **Live-сверка батча** (G-1/2/3 + V-2 ре-ран + FB-LR-19 + T5-transient, последние два opportunistic) — executor-runbook `dev/PILOT_RUNBOOK_N2_GATE_FOLLOWUPS.md` + reviewer-рубрика `dev/ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md` §6
   — **Live-сверка батча ВЫПОЛНЕНА (Fork C: G-1/R-1/G-2, 2026-06-27, DEC-DEV-0111):** LIVE-VALIDATED — **FB-LR-21/0106** (RA-10 surface'ит spec-санкционированный orphan, не `clean:true`), **FB-LR-15/0101-негатив** (нет тихого дропа линз), **T5/0096 escalate-don't-mask** (G-2: 2 cross-spec конфликта эскалированы без маскировки). **ДОЛЖОК** (дизайн прогонов, не код): **V-2/0103** (персоны gap-gated, на полной FM-001 не спавнились), **FB-LR-16/0102-disclosure + T1** (исполнитель поднял субстрат ДО гейта → `readiness:READY`, вхолостую). Новый дефект **FB-LR-23**: параллельные worktree делят git-checkout/index (→ 0111). G-3/FB-LR-19/T5-transient отложены (Fork C); `had_trial` OPEN (product). Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`

✅ **Autonomous Pipeline Vision — Increment 1 ПОСТРОЕН + Track V live-run (2026-06-24..25)** — Epic A целиком: 3 гетерогенные персоны (`architect-advisor`/`qa-advisor`/`ux-advisor`) + детерминированный zone→agent роутер (хук `zone-change-trigger` + `zone-router.cjs` + `zone-routing.yaml`) + B1-core bounded completeness-loop (`completeness-oracle.cjs` + `/product:complete`, 20-я product-команда) — DEC-DEV-0098; оракул dogfood-фикс VC↔SC link-shapes (0099)
   — **Track V live-run grade'нут (session `6ada7ef9`):** V-1 zone-хук PASS (правильные персоны / косметика молчит / dedup по id) + V-3 оракул+bounded-loop PASS (FM-001 `met:true` fast-stop; injected gap → B4 fail, loop bounded+fail-loud, no silent truncation); **V-2 (спавн персон) FAIL→FIXED** — невалидный YAML frontmatter (`description:` с `": "`) у 4 советников + repo-relative oracle path — **DEC-DEV-0103**. **V-2 ре-ран ВЫПОЛНЕН (R-1, 2026-06-27), но НЕ упражнил резолв:** персоны спавнятся только по гэпам оракула, а FM-001 был полон (`gaps:[]`) → персоны не спавнились; fallback'а в general-purpose НЕТ (safety-rail держит, 0 «Agent type not found»). Должок: ре-ран на под-специфицированной фиче / `--dry-run` (DEC-DEV-0111)

──────────── Не отгружено (next → deferred → future) ────────────

🌅 Autonomous Pipeline Vision (epics A-F) — cross-module, принят (DEC-DEV-0098). **Increment 1 СЛИТ + Track V live-validated** (Epic A персоны+zone-routing + B1-core completeness, 0098/0099/0103 — см. ✅ выше). Не Phase-N. Следующее: полная B-волна → (C ∥ D). См. секцию «Autonomous Pipeline Vision» ниже + `dev/ECOSYSTEM_VISION.md`
⏳ Phase 7 — Integrator maintenance (verify/debug/docs; full drift-detection algorithm) — СЛЕДУЮЩАЯ фаза
⏳ 🎯 PILOT POINT — requires Orchestrator Module (out of Phase 5; reframed per DEC-DEV-0040 Q3). P3+P5 (RUN 01, 1.6.0) + **P4 `audit-spec-fidelity` + P6 `validate-feature-impl` ПОСТРОЕНЫ и live-validated** (N+1/N+2, DEC-DEV-0085/0091..0104); остаётся **P2/P7** + §6 capability-канал
⏸ Phase D — Wiki initiative — DEFERRED to v1.1+ (DEC-DEV-0046, 2026-05-27, phantom-audience guard)
   — Pivot to local docs polish (4-9h) вместо full wiki (32-50h) — shipped в 1.3.3
   — Design+plan+readiness preserved: dev/deferred/wiki-design.md, dev/deferred/PHASE_D_IMPLEMENTATION_PLAN.md, dev/deferred/PHASE_D_DOCS_WIKI_READINESS.md (DEFERRED banners)
   — Bring-forward triggers: real end-user/stakeholder ask, OR Obsidian insufficient, OR public release prep (см. dev/v1_1_backlog.md)
📦 Post-MVP (v1.1+): Phase D Wiki initiative (deferred), Deep mode subagents (D1.2/D1.3), atomic mass-rename, full BFS cascade auto-fix, bundle approve UX, D.7 aspirational layer (recursive auto drill-down + FM.depends_on graph), /product:clarify receiver channel, /ecosystem:upgrade. Context: dev/v1_1_backlog.md
📦 v2: P3 Feedback, P5 Actuality Refresh, multi-tool zones, etc.
```

---

## Autonomous Pipeline Vision (epics A-F)

> **Cross-module инициатива, не Phase-N.** Превращает три «вектор-идеи» владельца (охват до прода / качество входа / автономия) в эпики A-F. Принята как направление 2026-06-24 (DEC-DEV-0098). Концепт-SSOT: [`dev/ECOSYSTEM_VISION.md`](dev/ECOSYSTEM_VISION.md) (`accepted`, §7 10/10); work-order первого инкремента: [`dev/_archive/orchestrator/ECOSYSTEM_VISION_BATCH_1.md`](dev/_archive/orchestrator/ECOSYSTEM_VISION_BATCH_1.md) (archived — Increment 1 done).
>
> **Цель (переформулирована из «100% результата»):** «**100% покрытия пути + gated-автономия**», не «человек ни разу не нужен». Три research-«тормоза» зашиты в дизайн: completeness-loop только bounded+anchored; консилиум = жюри/гетерогенность, не консенсус-дебаты; полностью автономный идея→прод нереалистичен (METR 0.9⁷≈48%).

**Эпики:**

| Эпик | Что | Зона | Статус |
|---|---|---|---|
| **A** | Реестр гетерогенных профильных персон (architect/qa/ux-advisor) + детерминированный zone→agent роутер | Product/Design (owned) | ✅ Increment 1 слит + Track V live-validated (0098/0103) |
| **B** | Bounded completeness-loop для D1-D2B; граница «достаточности» = handoff DoR; стоп = cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0) | Product (owned) | ✅ B1-core + B4 слиты (0098/0099); полная волна позже |
| **C** | Крупные автономные шаги (макро `batch-enrich-feature-set`, 5-8 шагов = границы фаз с гейтами) + branch-anticipation | Product macro (Workflow) | 📋 после B |
| **D** | Консилиум-примитив как жюри (`parallel()` фан-аут гетерогенных персон → synthesis → в гейт, не вместо) | cross-cutting | 📋 с/после A |
| **E** | Сегмент до прода (CI/build, provisioning, deploy/rollback, QA-инфра, monitoring) | Orchestrator+Integrator | 🔗 **coordinate-only** (зона оркестратор-трека; предусловие = §6-канал + D3/D4/D5-инструменты) |
| **F** | Autonomy configuration layer: enum L0/L1/L2/L3, детерминированный resolver (`lib/autonomy-policy.cjs`), floor необратимости non-crossable, hard-config дефолт + override | cross-cutting | 📋 F1 рядом с A (контракт гейтов — сверить с оркестратор-сессией); F2 после D; F3 с E |

**Порядок:** (A ∥ F1) → B → (C ∥ D) → F2 → E(+F3). Фронт пайплайна (качество входа) — первым: ошибки спеки компаундируются вниз по конвейеру, чинить дешевле всего у источника.

**Increment 1 (СЛИТ 2026-06-25):** Epic A целиком (3 персоны + zone-routing) + B4 (loop-readiness аудит) + B1-core (completeness-oracle + bounded-loop + `/product:complete`). **Track V live-run grade'нут** (V-1 zone-хук / V-3 оракул PASS; V-2 frontmatter-фикс — DEC-DEV-0103); V-2 ре-ран после `/ecosystem:update`. Граница соблюдена: ни один файл `orchestrator/` не тронут.

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
- `validation-tune.md` — C3 modification: project-local validation tuning (systemic defects → /ecosystem:meta-feedback)
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
- `validation-tune.md` — C3 logic
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

**commands/product/ (7):** init, status, config, drift-check, validation-tune, patterns, promote-note
**skills/product/ Discovery (7):** discovery-session, problem-discovery, market-research-protocol-quick, competitive-analysis-protocol-quick, segment-discovery, vp-design, hypothesis-formulation
**skills/product/ drift mechanisms (4):** drift-detector, pattern-linter, validation-tune, note-capture
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
> **Implementation completed 2026-04-27** — 23 files (originally estimated 21, +2 for: devils-advocate.md adaptive-depth refactor per A.1 spec drift fix, dev/PHASE_3_SMOKE_TEST_PLAN.md). 9 commits across 10 sub-phases (A→J + prerequisite). Final lessons: DEC-DEV-0014 в DEV_JOURNAL.md. Real run smoke test executed 2026-04-29 (DEC-DEV-0023) → 1.1.1 patch; plan archived to [dev/_archive/phase-3/PHASE_3_SMOKE_TEST_PLAN.md](dev/_archive/phase-3/PHASE_3_SMOKE_TEST_PLAN.md).

### Deliverables (~21 файл)

**commands/product/ (5):**
- `plan.md` — P1.B Planning Session
- `feature.md` — P2.A Feature Enrichment + P2.B Creation
- `cascade.md` — manual cascade navigation (`<artifact-id>` или `--pending`)
- `bg-review.md` — pending BG candidates batch review
- `bg-rename.md` — **manual preview workflow** (sed/IDE find-replace; atomic implementation → v1.1)

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
- **Adaptive-depth DA subagent prompt design** — single subagent invocation должен правильно классифицировать magnitude и адаптировать output; risk over/under-triggering. Mitigation: pilot test после Phase 3, refine через `/product:validation-tune`.
- **Skill frontmatter drift** — Phase 2 PS skill drift (DEC-DEV-0011) показал что AI rename fields. Mitigation: B.1 convention — explicit frontmatter template обязателен в каждом skill, создающем артефакт.

---

## ✅ Phase 4 — Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline — COMPLETED 2026-05-13

**Цель:** `/product:handoff` работает в обоих режимах (draft/production). Validation catalog полностью реализован. F.9 DA review three-tier (artifact / feature / release). NFR F.5a Ask + Define workflow. Language discipline (Russian default). HYP frontmatter drift fixed.

> **Scope refined 2026-05-10** per DEC-DEV-0024..0029 — 13 architectural decisions (C.1-C.5, D.1-D.5, A.3, +D.6 language, +D.7 release DA).
>
> **Pre-implementation kickoff 2026-05-12** per DEC-DEV-0030 — 26 ambiguity resolutions + 2 scope cuts (`/product:clarify` channel deferred к v1.1; D.7 aspirational layer split — core shipped, recursive auto drill-down + FM.depends_on graph deferred).
>
> **Implementation completed 2026-05-13** — 8 sub-phase commits (A-H) + J static smoke + b8f16bc review fix-up (DEC-DEV-0031) + K1 closure docs. Closure entry: DEC-DEV-0032; closure ritual Unit 2 executed 2026-05-13 (DEC-DEV-0033).
>
> **✅ Closed 2026-05-20** — runtime smoke audited (9 pilot sessions) → status=fail; 2 FAIL (S1, S12) + 1 blocking finding + `product-devils-advocate` registration gap. Re-verification gate снят (DEC-DEV-0038 + follow-up): known issues приняты и задокументированы в `audit-reports/phase-4-summary.md`, smoke-план + fixtures удалены.

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
- [x] **Runtime smoke test S1-S13** — audited 2026-05-20 → **status=fail** (DEC-DEV-0038); known issues приняты, re-verification gate снят (follow-up) → Phase 4 закрыта
- [x] **Phase 4 closure ritual (Unit 2)** — D7 phase-closure.md 6 steps executed 2026-05-13 fresh-session (DEC-DEV-0033)

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

### Deliverables (~10 файлов)

**commands/integrator/:**
- `add.md` — 6-stage flow: profile → propose → install → configure → contract → verify (approve — gate перед install, не этап)
- `remove.md` — impact analysis + backup + cleanup
- `update.md` — backup + install + drift check + contract repair (per DEC-DEV-0040 Q2 — закреплено в Phase 5, не Maintenance)

**skills/integrator/:**
- `installation-protocol.md` — add flow methodology
- `contract-design.md` — how adapters are designed (manual in v1)

**agents/integrator/:** (per DEC-DEV-0040 Q3)
- `tool-profiler.md` — subagent для add/update profiling (stage 1)
- `contract-designer.md` — subagent для contract design (stage 5)

**hooks/integrator/:**
- `journal-hook.js` — autolog every modifying action (per DEC-DEV-0040 Q6)

**adapters/:** (repo reference source, per DEC-DEV-0040 Q1)
- `handoff-to-ccsdd.js` — **reference implementation**, копируется в `.claude/integrator/adapters/` при `/integrator:add`; несёт `target_tool_version` / `contract_schema_version` metadata для drift-detection при `/integrator:update`

**Deferred к v1.1 (per DEC-DEV-0040 Q4):** `replace.md` — нет 2-го D2-Tech инструмента для содержательного теста; вернёмся при появлении alternate adapter.

### Acceptance criteria

> Scope — **Integrator-only** (per DEC-DEV-0040 Q3): «installed + contract-verified на fixture». Production-маршрутизация реальных handoff'ов через адаптер в `/kiro:spec-init` — это runtime-оркестрация (Orchestrator Module, вне Phase 5).

- [ ] `/integrator:add cc-sdd` проходит 6 stages без manual intervention (кроме approve gates)
- [ ] `pmo-mapping.yaml` получает coverage для **D2-T01 + D2-T06** (cc-sdd primary, per DEC-DEV-0040 Q5); D2-T04 — partial по результату profile-stage; D2-B02 — boundary (Product Module владеет, cc-sdd consumes via handoff)
- [ ] Stage-6 «verify» прогоняет адаптер с fixture-handoff'ом и подтверждает корректность контракта (smoke/contract-test, не продакшен)
- [ ] `/integrator:remove cc-sdd` безопасно откатывает с backup
- [ ] `/integrator:update cc-sdd` detects drift при version upgrade (через `target_tool_version` metadata в инстанцированном адаптере), предлагает contract repair
- [ ] Decision journal logs каждое modifying action с контекстом (per DEC-DEV-0040 Q6)

### Estimated effort

**Базовая оценка: 3-5 часов.** ⚠️ Эмпирический множитель Phase 2-4 — ×2-4 после kickoff-уточнения scope (см. «How this roadmap evolves»). Реалистично ~10-20 часов.

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

**Trigger:** первая FM с `has_ui=true` в pilot проекте. Архитектурные решения зафиксированы pre-kickoff (DEC-DEV-0048 SPEC v1.1 — Claude Design co-primary + IR groundwork; DEC-DEV-0052 — 12 Qs / 13 ambiguities / 5 cuts).

### Deliverables (~10 файлов; пост-DEC-DEV-0052 narrower)

**commands/design/:**
- `start.md` — P2.5 entry (D.1-D.6)
- `iterate.md` — D.3 continuation for existing MK
- `system.md` — DS management
- `export.md` — D.6 для handoff §10
- `status.md` — design session dashboard
- `migrate.md` — **v1.0: Stitch ↔ HTML only** (Claude Design path → v1.1 per DEC-DEV-0052 C3)

**skills/design/:**
- `design-session.md` — P2.5 orchestrator
- `component-states.md` — D.4 checklist
- `design-system-rules.md` — DS extraction + merge
- `stitch-workflow.md` — Stitch MCP prompt patterns (OQ-DM-01 open; v0 best-effort, refactor after pilot)
- `claude-design-workflow.md` — **v1.0: stub (~30 lines)** per DEC-DEV-0052 C1 (full implementation → v1.1 after Claude Design pilot OR MCP/API release)
- `design-validation.md` — V-MK-01..V-MK-08 (**V-MK-02 partial automation** per DEC-DEV-0052 C5)
- `html-fallback.md` — **v1.0: minimal HTML page generation** (single screen, DS via CSS vars, no React) per DEC-DEV-0052 C4

**subagents/design/:** *(DEFERRED к v1.1 per DEC-DEV-0052 C2 — D.2 inline в design-session.md в v1.0)*
- ~~`screen-generator.md`~~ — bring-forward trigger: real D.2 >5 экранов hits >50% main context

**hooks/design/:**
- `design-artifact-validate.js` — PostToolUse на `.product/mockups/`

**Integrator setup:**
- `/integrator:add stitch-mcp` (если Stitch выбран; profile carries `environment_agnostic: true`)

### Acceptance criteria

- [ ] `/design:start FM-001` → P2.5 D.1-D.6 end-to-end
- [ ] MK/DS/NM создаются в active, passed V-MK-* validation
- [ ] HTML fallback работает без Stitch (minimal single-page путь в v1.0)
- [ ] `/design:export FM-001` заполняет §10 UI Specification в handoff
- [ ] Handoff §10 consumable внешним implementation tool через adapter
- [ ] Stitch rate limit (350 gen/month) graceful handled
- [ ] `/design:migrate MK-NNN --to html` writes `previous_tools[]` entry, regen succeeds OR rollback on failure
- [ ] Hard approve gate в `/design:migrate` (per-MK granularity; silence ≠ consent per DEC-DEV-0047 §7.6 pattern)

### Estimated effort

**10-20ч realistic pre-cuts; 8-12ч focused work post-DEC-DEV-0052 cuts.** ROADMAP старая оценка 3-4ч устарела post-DEC-DEV-0048 (Claude Design + IR groundwork) и post-Phase-5 calibration (×2-3 multiplier для mixed methodology + code phase per DEC-DEV-0041 lesson).

### Dependencies

- Phase 4 (handoff §10 integration)
- Phase 5 (Integrator add для Stitch MCP)
- Patches 1.3.3-1.3.5 (env_tiers, PA journal, scope-guard pattern, hard approve gate template, pattern-preserving merge для design hooks)

### Risks

- OQ-DM-01 (prompt patterns для Stitch) пока open — первый реальный use case даст данные, но может потребовать переработки `stitch-workflow.md` после pilot.
- **OQ-DM-08** (Claude Design prompt patterns) — Claude Design = research preview без MCP/API в 2026; v1.0 ships stub, full skill только после first pilot OR Anthropic releases.
- Component State Matrix автоматизация (V-MK-02..V-MK-03) — v1.0 ships V-MK-02 partial (mechanical states only); V-MK-03 manual via skill checklist.
- `/design:migrate` matrix narrow в v1.0 (Stitch ↔ HTML); Claude Design migration → v1.1.
- `screen-generator` subagent deferred — D.2 inline может hit context pollution на >5 экранов (bring-forward trigger).

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
- **Atomic mass-rename** `/product:bg-rename` — git-stash workflow, conflict handling, rollback. v1 ships manual preview placeholder. Bring-forward trigger: 5+ mass-renames в течение месяца на active projects.
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

**Эмпирический множитель оценок (Phase 2-4, DEC-DEV-0032 lesson 6):** базовые ROADMAP-оценки систематически ×2-4 после pre-implementation kickoff:
- Phase 2: 4-6ч → ~10ч
- Phase 3: 4-6ч → ~12ч
- Phase 4: 3-4ч → ~12-15ч

Применяй ×2-4 к базовым оценкам непройденных фаз при планировании.

**Decision journal entries** фиксируют значимые изменения roadmap с rationale.

---

## Связанные документы

- [CHANGELOG.md](CHANGELOG.md) — что сделано per release
- [BOOTSTRAP.md](BOOTSTRAP.md) — setup flow для новых проектов
- [docs/pmo/pmo-map.md](docs/pmo/pmo-map.md) — карта PMO (D1-D6)
- [docs/product-module/SPEC.md](docs/product-module/SPEC.md) — Product Module детали
- [docs/integrator-module/SPEC.md](docs/integrator-module/SPEC.md) — Integrator Module детали
- [docs/design-module/SPEC.md](docs/design-module/SPEC.md) — Design Module детали
