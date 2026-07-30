# Ecosystem 3.0 — Implementation Roadmap

> **Назначение:** единый source of truth для implementation plan. Каждая фаза имеет deliverables, acceptance criteria, dependencies, risks.
> **Статус:** активный документ. Обновляется после каждой завершённой phase + при изменении приоритетов.
> **Последнее обновление:** 2026-07-30 — **Волна носителей принуждения: анализ эффективности влит, пакеты 1–2 ПОСТРОЕНЫ и MERGED (`main` = `b7468ff`).** Анализ Global Loop (DEC-DEV-0228 ретроспектива M1–M15 + 0229 каузальная A/B-проба M16; PR #243): «экосистема эффективна ровно настолько, насколько её правила материализованы в машине» — 59.9% дефектов (97/162) в зонах без гейта; опасения «переписывает по 10 раз» / «база деградирует» НЕ подтвердились. План волны ратифицирован владельцем (DEC-DEV-0230: **hard-block** для новых носителей — архитектурное исключение из «warn, don't block»; консилиум демоутнут до одиночного судьи+посылок+реверса; принципы П-1 нулевая сумма текста / П-2 детерминизм / П-3 датчик-сторож). **Пакет 1** (PR #244): RPM **Access Matrix** + правило **V-19** 🔴 (каталог 44→45) + негативные журнеи P8 (`neg-*.spec.ts`, `specs_skipped[]`). **Пакет 2** (DEC-DEV-0231, PR #246): оракул `br-constants-oracle.cjs` + валидатор **RA-11** в P6 (код↔BR) · обязательный deviations-отчёт (`concerns` required) · root-cause-first · deviation-triage prepare-only · realistic-input DoD (P8 `input_profile`; RL DoD кат.3) · дельты шаблонов D2-B; ротация журнала (0202–0209 → архив). Кондуктор-выноски «Вход в H0» — factory-conductor PR #6; шов волны (ревизии + хронология трека) — PR #245/#247 и далее. Срез П-3: acceptance-gap закрыт целиком, doc-stale/infra-failure ждут пакетов 5–7; стоп-правило не срабатывает. **«Го» DEC-DEV-0230 исчерпано — пакеты 3–7 только по новому «го» владельца** (вход: `dev/global-loop/SEAM.md` §⚡). Хвост DEV_JOURNAL = **0231**.
>
> _Предыдущая запись:_ 2026-07-29 — **Repo-hygiene: трек DEC-DEV-0227 ЗАКРЫТ; репозиторий сведён к единому чекпоинту (`main` = `32b2791`, сведение 5 треков).** Hygiene-sweep 2026-07-28: репо лгал, а не «разросся» (38 устаревших утверждений при нуле битых ссылок; always-on ≈ 3-4% окна — объём проблемой не был) → починены статусы, ротированы каноны (`DEV_JOURNAL` 738→208 КБ · `CHANGELOG` 270→102 КБ · `ROADMAP` 73→39 КБ), снят Obsidian-слой и мёртвый `phase-closure-reminder.js` (CONVENTIONS §13), построены `doc-health.cjs` + скилл `repo-hygiene`. Единый чекпоинт по разовому мандату владельца: PR **#237→#232→#231→#204→#238** (+ гигиена чекпоинта #239, шов #240); независимое ревью сессии-исполнителя — ✅ по всем трём осям (PR #241). Закрытие трека 2026-07-29: удалены **46** смёрженных remote-веток (мандат), локальные ветки/worktree сведены к `main`+ledger; **`doc-health` флипнут в strict** в цепи `verify` (гейтят warn+, info — никогда); memory-sync выполнен (`check:context:strict` зелёный); швы `repo-hygiene` и `context-audit` → **CLOSED**. Хвост DEV_JOURNAL = **0227**.
>
> **История обновлений** — предыдущие 26 записей (2026-06-18 .. 2026-07-17) вынесены дословно в архив: [`dev/_archive/roadmap/ROADMAP_status-log_2026-06-18_2026-07-17.md`](dev/_archive/roadmap/ROADMAP_status-log_2026-06-18_2026-07-17.md) (структурный разрез 2026-07-28 по CONVENTIONS §5.1: лог держался одной строкой на 27 720 символов = 49% файла; факты не правились).

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
✅ **Phase 7 — Integrator maintenance (DEC-DEV-0176, 2026-07-11)** — kickoff inline (10 решений, 6 cuts >50% поверхности) + built тем же днём: `/integrator:verify` + `/integrator:debug` (замыкает G15 confidence-lifecycle) + `/integrator:docs` + разделяемая drift-либа `hooks/integrator/lib/drift-checks.cjs` + `drift-check.js` SessionStart-хук (G16 по существу). Скиллы drift-detection/tool-docs-generator уже были (Phase 5) — фаза их потребляет. CUT v1.1+: `:replace` (нужен 2-й инструмент), `contract-validate.js`, `--light`. Тесты: drift-checks 24 юнита + hook-smoke 41→43; полный verify EXIT=0. Runtime smoke S1-S5 (`dev/gates/PHASE_7_SMOKE_TEST_PLAN.md`) — next VM-визит (built ≠ validated)
   ▲ последняя отгруженная ФАЗА = ТЕКУЩИЙ phase-статус (нумерованные фазы ROADMAP исчерпаны — дальше треки: Vision-эпики, Fabric фаза 4, gaps-backlog); D7 meta-tooling трекается отдельной строкой ниже. Маркер «[We are here]» удалён — был drift-bait (Tier-1 doc reform)

✅ **Session Audit v2 — D7 universal session auditor (2026-06-01..02)** — эволюция Phase 4.1 аудитора из phase-валидатора в замкнутый авто-механизм аудита ПРОДУКТОВЫХ сессий. D7 dev-only (`dev/meta-improvement/`, НЕ деплоится); phase-прогрессия не затронута. Гайд: `dev/meta-improvement/SESSION_AUDIT_GUIDE.md`
   — Инкр.1+2 merged 2026-06-01 (PR #20, DEC-DEV-0056/0057): классификатор сессий + реестр рубрик + полу-авто watcher (`audit-watch.js` + /loop) + effect-probe G4 (эффект на `.product/`)
   — Инкр.3 merged 2026-06-02 (PR #21, DEC-DEV-0059): re-anchor оракула на PMO-зоны (two-axis multi-label, owned-only; `ecosystem-dev` убран — только продуктовый аудит) + findings-журнал G5 (`audit-journal.ndjson`) + синтезатор патчей G6 с adversarial-verify (`patch-synth.js`)
   — Два полных цикла find→synth→verify→accept→patch отработаны: **DEC-DEV-0064** (DA subagent-type контракт + V-18 schema, PR #28) + **DEC-DEV-0080** (cascade SC↔MK, PR #37). Pending-очередь пилота обработана; genuine re-routes из refuted-кластеров сохранены в `dev/meta-improvement/audit-reroutes.md` (incl. blocking `309cc2cf` handoff path-bug → own item)

✅ **Orchestrator Module — первый инкремент P3+P5 ПОСТРОЕН + первый живой прогон (1.6.0)** — концепт (DEC-DEV-0058, SPEC v0.1; роль «тимлид PMO», 3-слойная детерминизм-модель, двусторонний канал Orchestrator↔Integrator) реализован в первый инкремент через dogfood-harvest реальной cc-sdd сессии RUN 01. **P3 `batch-features-to-cc-sdd`** + **P5 `feature-to-tdd-impl`** (DEC-DEV-0073/0076/0077, PR #33) — гибрид над cc-sdd «оркеструем, не переписываем»: вызов `kiro-spec-batch`/лифт `kiro-impl` + net-new `coverage-oracle` + `gate-risk-classifier` (17/17). `/orchestrator:run <process>`; deployment-wiring в `/ecosystem:update` namespace-aware (DEC-DEV-0078, PR #34)
   — **Первый живой прогон RUN 01** на пилоте (DEC-DEV-0073 follow-up, FB-001…011, PR #37): billing 19/19 GO; критический **FB-001** (Workflow args строкой → billing под видом auth) починен + test-locked (`tests/orchestrator/args-parsing.test.cjs`); deep-dive `dev/meta-improvement/audit-reports/c4546225-orchestrator-deep-dive.md`. Smoke fixtures: `npm run verify` зелёный
   — Граница Integrator↔Orchestrator — role A (DEC-DEV-0060): §6 = запрос **capability** («руки» tool/MCP + «голова» role-агент/skill), Интегратор оснащает, deploy исполняет Оркестратор
   — **S6 dogfood проведён (2026-06-18→19, DEC-DEV-0081):** uncontaminated §6 re-test (FM-002 localization P5/D3, GO 26/26) → **§6-A…E + Q#2 = FAIL** — канал не сработал по реальному provider-пробелу. Root-cause: §6 = **обработчик блокировок, не детектор пробелов**; spec-mandated Mock (DEC-A06) сделал отложенность не-блокирующей → instruction-silent (контраст billing-блок→сработал vs providers-mock→молчок). Конкретный баг: субагент пишет отложенность в CONCERNS, но `feature-to-tdd-impl.mjs` его роняет. **DEC-DEV-0078 update-smoke = PASS.** Фикс = 5 ранжированных (#1 CONCERNS-propagation / #2 GO-disclosure / #5 §6-E рубрика — валидируемы сейчас; #3/#4 detect-leg — нужен S7-ретест). **Deferred:** реализация фиксов §6 + S7; процессы P2/P4/P6/P7 (нужны D3/D5-инструменты); admin-спека FM-007 coverage re-run

🛡 **`/ecosystem:update` level-2 wipe protection (DEC-DEV-0061, 2026-06-05, 1.5.0)** — git safety-commit footprint'а установленных инструментов (`.claude/integrator/` + все `active-tools.yaml` `claude_primitives` internal+external + `settings.json`) перед apply. Новый Step 5.0 (default on, `--no-safety-commit`; scoped commit, никогда `-f`, skip-not-abort). Дополняет хрупкий level-1 файловый backup (untracked / частично gitignored). Spec-only; pending runtime smoke. Политика «no-auto-commit» сужена (не отменена)

✅ **LESSON-* — atomic self-correction для продуктовых проектов (DEC-DEV-0062, 2026-06-06, 1.5.0, merged PR #25)** — закрыт пробел: смысловой класс ошибки «задача / артефакт / решение сделаны некорректно» (раньше ловились только структурные нарушения через `.product/.pending/`). 23-й тип артефакта `.product/lessons/LESSON-NNN-*.md`; операция find→fix→record **атомарна и неоткладываема** (инверс `.pending/`). 3 слоя: mandate (`templates/project/CLAUDE.md.template` + синкаемый `skills/ecosystem/self-correction.md`) + write-ahead command `/product:lesson` (open-tripwire до фикса → verify с recorded evidence → флип open→active) + двупронговый gate (`lesson-gate.js` Stop **strict** / `lesson-presence-gate.js` PreToolUse+UserPromptSubmit **warn**). Инвариант V-LE-02/03: `active ⇒ фикс применён+проверен+guard present`. **Первый блокирующий хук экосистемы** (scoped, fail-open, `LESSON_GATE_MODE` opt-out, 8-block auto-override). 18 файлов; gate-mode выбран после web-search верификации hook-контракта (поправлена Stop/SessionEnd конфляция синтеза — Lesson #1). **S-LE live-smoke ЗАКРЫТ 2026-07-11** (прогон 2026-07-04 вскрыл самодедлок → фикс 0143 → ре-прогон smoke-batch DEC-DEV-0177: deny+exemption PASS) → **PreToolUse-prong флипнут в strict** (решение владельца; откат `LESSON_GATE_MODE=warn`; чеклист → `dev/_archive/s-le/`); механизм деплоится в продуктовые проекты, в dev-сессии экосистемы no-op (сознательно, self-collapse guard)

✅ **open-design — переиспользуемый Dockerized viewer/migrate-target экосистемы (DEC-DEV-0063, 2026-06-06, 1.5.0, merged PR #26)** — open-design (nexu-io, Apache-2.0) вынесен из одноразового per-project `/integrator:add` в переиспользуемые куски репо + один машинно-глобальный Docker-daemon (127.0.0.1:7456). **Integrator (инфра):** reference-адаптеры `stitch-to-opendesign.js` + `mk-to-stitch.js` (CNT-002 backfill — закрыт tri-location gap); новый `source: docker` tool-type + SPEC §4.1.1 «Dockerized external-daemon pattern» (shared-daemon-per-machine, Bearer на всех `/api/*`, `127.0.0.1` не `localhost`, image-digest pin, ZERO `.claude` primitives); `/integrator:add` docker-path (connectivity-validate вместо install, никогда auto-`docker run`). **Design Module (D2-B04):** `/design:migrate --to open-design` viewer-import (без regeneration/metadata/iteration bump — канон в MK/NM); skill `open-design-viewer.md`; `external_viewers` дефолт в `design.yaml`; daemon-check в `/design:status`. **Ops:** BOOTSTRAP machine-global daemon-setup (token-gen, `docker run` recipe, supply-chain pin). Live E2E: import HTTP 200, `token_source: home-secret` доказал машинно-глобальную модель

✅ **App Map (AM) — 24-й тип артефакта (DEC-DEV-0066, 1.6.0, PR #30)** — L0 «вид всего приложения» (модули FM × кейсы SC × cross-module пути + редакторский CJM-слой) поверх per-flow NM с anti-duplication firewall (AM ссылается на NM по id, не переписывает переходы). `/design:map [--write] [--html]`, детерминированный scanner + cascade-хук + USER FLOW HTML walker. Канонизирован из пилота (реконсиляция шаг 2). Счётчики 23→24 / 40→44 (+ закрыт deferred 0064 sweep 39→40)

✅ **`product_class` — D1-классификация типа продукта (DEC-DEV-0079, 1.6.0, PR #35)** — opt-in dimensional блок в `product.yaml` (archetype + ортогональные фасеты runtime_locus/interface/distribution), advisory-проброс в handoff (помечено «shape, not stack»), открытый словарь (degrade-not-reject). Без gate; `unset` = поведение до 0079 (full backward-compat). Backfill-промпт для существующих проектов в CHANGELOG-записи

✅ **Реконсиляция пилот→экосистема (DEC-DEV-0065 класс дрейфа, 1.6.0)** — пилотные фичи и найденные пилотом баги доведены в канон: worktree pre-flight advisory (PR #29), open-design generator dual-role (DEC-DEV-0067, PR #31), App Map (выше); upstream-фиксы: handoff §10 fidelity (DEC-DEV-0074), V-18 per-type schema + DA subagent-type контракт (DEC-DEV-0064, PR #28), cascade SC↔MK reverse-ref (DEC-DEV-0080, PR #37)

✅ **Orchestrator N+2 «Trustworthy gate outcomes» — ПОСТРОЕН + LIVE-VALIDATED (2026-06-23..25, consolidated main `cd2d19f`)** — после аудита N+1 live-run (DEC-DEV-0091) весь content-queue слит в `main`: **T1** verdict×readiness + либа `env-readiness.cjs` (0092, PR #41), **T2** order-aware verify — baseline-sha + 3-way disposition в P4+P6 (0093, #42), **P3** defect-enum + polarity-gate (0094, #43), **T4** design→tasks coverage-оракул (0095, #44), **T5** remediation-guardrails — `remediation-guard.cjs`: escalate cross-spec/design конфликт, transient bounded-retry (0096, #46), **P6 feedback-фаза-2** dev-консолидатор `feedback-intake.js` (0097, #48), riders PA-dedup + `missing-trace-source` (0089, #50)
   — **Pilot-ре-валидация Track O A+B+C (2026-06-24..25)** по слоёному evidence-модели + слепые аудиторы V1≈V2 + нейтральный судья: A (P4 localization ×2) PASS; B (P6 billing, Docker down→up) PASS (FB-LR-15/16 → **FIXED**, DEC-DEV-0101/0102); **C на свежей фиче `glossary` (session `1ff7e2d8`, 1 wf / 99 агентов) — T3+T5 LIVE-VALIDATED**: реальный вложенный P6 по `{scriptPath}` (mechanical + RA-8/9/10 + verify-finding + remediation + verdict, без `GATE DEGRADED`-fallback — окончательно опровергает память `p6_delegation_unresolvable`); T5-эскалация без маскировки (NO-GO held). Находки FB-LR-19..22; **FB-LR-19 (P5-конверт ронял `conflicts`+`findings` гейта) FIXED — DEC-DEV-0104**. Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`
   — **N+2 gate-followups ПОСТРОЕНЫ + СЛИТЫ (2026-06-26, PR #67 `cc19398` / runbook #68 `37ec14e`):** дочистка P6-гейта по открытым находкам ре-валидации — **FB-LR-15** bounded re-spawn упавшей на terminal-API-error линзы → `validators_incomplete` понижает чистый GO до MANUAL_VERIFY (**DEC-DEV-0101**); **FB-LR-16** ремедиация под non-READY помечает+дисклозит коммит, не запрещая его (`committed_under_non_ready`, политика a, **0102**); **FB-LR-21** RA-10 surface'ит spec-санкционированный orphan + **FB-LR-20/22** doc (seam-split паттерн / граница `remediation-guard`, **0106**). Всё additive → counts 24/44; P6 wiring 24→26; `npm run verify` зелёный. **Live-сверка батча** (G-1/2/3 + V-2 ре-ран + FB-LR-19 + T5-transient, последние два opportunistic) — executor-runbook `dev/_archive/orchestrator/PILOT_RUNBOOK_N2_GATE_FOLLOWUPS.md` + reviewer-рубрика `dev/_archive/orchestrator/ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md` §6
   — **Live-сверка батча ВЫПОЛНЕНА (Fork C: G-1/R-1/G-2, 2026-06-27, DEC-DEV-0111):** LIVE-VALIDATED — **FB-LR-21/0106** (RA-10 surface'ит spec-санкционированный orphan, не `clean:true`), **FB-LR-15/0101-негатив** (нет тихого дропа линз), **T5/0096 escalate-don't-mask** (G-2: 2 cross-spec конфликта эскалированы без маскировки). **ДОЛЖОК** (дизайн прогонов, не код): **V-2/0103** (персоны gap-gated, на полной FM-001 не спавнились), **FB-LR-16/0102-disclosure + T1** (исполнитель поднял субстрат ДО гейта → `readiness:READY`, вхолостую). Новый дефект **FB-LR-23**: параллельные worktree делят git-checkout/index (→ 0111). G-3/FB-LR-19/T5-transient отложены (Fork C); `had_trial` OPEN (product). Ledger: `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`

✅ **Autonomous Pipeline Vision — Increment 1 ПОСТРОЕН + Track V live-run (2026-06-24..25)** — Epic A целиком: 3 гетерогенные персоны (`architect-advisor`/`qa-advisor`/`ux-advisor`) + детерминированный zone→agent роутер (хук `zone-change-trigger` + `zone-router.cjs` + `zone-routing.yaml`) + B1-core bounded completeness-loop (`completeness-oracle.cjs` + `/product:complete`, 20-я product-команда) — DEC-DEV-0098; оракул dogfood-фикс VC↔SC link-shapes (0099)
   — **Track V live-run grade'нут (session `6ada7ef9`):** V-1 zone-хук PASS (правильные персоны / косметика молчит / dedup по id) + V-3 оракул+bounded-loop PASS (FM-001 `met:true` fast-stop; injected gap → B4 fail, loop bounded+fail-loud, no silent truncation); **V-2 (спавн персон) FAIL→FIXED** — невалидный YAML frontmatter (`description:` с `": "`) у 4 советников + repo-relative oracle path — **DEC-DEV-0103**. **V-2 ре-ран ВЫПОЛНЕН (R-1, 2026-06-27), но НЕ упражнил резолв:** персоны спавнятся только по гэпам оракула, а FM-001 был полон (`gaps:[]`) → персоны не спавнились; fallback'а в general-purpose НЕТ (safety-rail держит, 0 «Agent type not found»). Должок: ре-ран на под-специфицированной фиче / `--dry-run` (DEC-DEV-0111)

✅ **Repo-hygiene + единый чекпоинт (DEC-DEV-0227, 2026-07-28/29)** — hygiene-sweep (правдивость > объём: 38 устаревших утверждений починено; ротация канонов; Obsidian-слой и мёртвый хук сняты; построены `doc-health.cjs` — с 2026-07-29 strict в `verify` — и скилл `repo-hygiene`; CONVENTIONS §13 «Удалённые механизмы») + все треки сведены в единый чекпоинт `main` = `32b2791` (5 PR: #237 гигиена → #232 import-mode → #231 Tech-Uplift → #204 Informed Fetch → #238 ledger Global Loop). Независимое ревью сессии-исполнителя — ✅ по трём осям (PR #241, находки F1-F9 закрыты закрытием трека). Трек ЗАКРЫТ 2026-07-29: remote-уборка 46 веток, memory-sync, швы repo-hygiene/context-audit CLOSED

✅ **Анализ эффективности Global Loop + волна носителей, пакеты 1–2 (DEC-DEV-0228..0231, 2026-07-29/30)** — замеры M1–M16 исполнены целиком («работает то, у чего есть носитель принуждения»; 59.9% дефектов без гейта; каузальная проба vs GSD 2:2 — канон проиграл ровно безносительные оси). Волна конвертации уроков в гейты (ENFORCEMENT_PLAN, hard-block): пакет 1 — Access Matrix (RPM + V-19, 45 правил) + негативные журнеи P8; пакет 2 — оракул констант код↔BR (RA-11 в P6) + обязательные «Отступления» + root-cause-first + deviation-triage + realistic-input DoD + дельты D2-B. PR #243/#244/#246 (+шов #245/#247, кондуктор fc#6) merged. **Пакеты 3–7 — по новому «го»** (вход: `dev/global-loop/SEAM.md` §⚡)

──────────── Не отгружено (next → deferred → future) ────────────

🌅 Autonomous Pipeline Vision (epics A-F) — cross-module, принят (DEC-DEV-0098). **Increment 1 СЛИТ + Track V live-validated** (Epic A персоны+zone-routing + B1-core completeness, 0098/0099/0103 — см. ✅ выше). Не Phase-N. Следующее: полная B-волна → (C ∥ D). См. секцию «Autonomous Pipeline Vision» ниже + `dev/ECOSYSTEM_VISION.md`
✅ Phase 7 — Integrator maintenance — BUILT 2026-07-11 (DEC-DEV-0176, см. ✅ выше; runtime smoke S1-S5 pending — next VM-визит)
⏳ 🎯 PILOT POINT — requires Orchestrator Module (out of Phase 5; reframed per DEC-DEV-0040 Q3). **Все процессы модуля ПОСТРОЕНЫ** — P3+P5 (RUN 01, 1.6.0) + P4/P6 live-validated (N+1/N+2, DEC-DEV-0085/0091..0104) + §6 detect-leg (0117) + P7 readiness-нога (0120) + **P2 `decide-architecture-foundation` (0129, PR #92)** = цепочка P1–P7 + двусторонний §6. Остаётся: живой dogfood P2 на `PA-040/042` (после merge #92) + пилотный прогон полной цепочки; живой boot P7 + Epic E deploy — substrate-gated (D3-runtime Интегратора)
⏸ Phase D — Wiki initiative — DEFERRED to v1.1+ (DEC-DEV-0046, 2026-05-27, phantom-audience guard)
   — Pivot to local docs polish (4-9h) вместо full wiki (32-50h) — shipped в 1.3.3
   — Design+plan+readiness preserved: dev/deferred/wiki-design.md, dev/deferred/PHASE_D_IMPLEMENTATION_PLAN.md, dev/deferred/PHASE_D_DOCS_WIKI_READINESS.md (DEFERRED banners)
   — Bring-forward triggers: real end-user/stakeholder ask, OR Obsidian insufficient, OR public release prep (см. dev/v1_1_backlog.md)
📦 Post-MVP (v1.1+): Phase D Wiki initiative (deferred), Deep mode subagents (D1.2/D1.3), atomic mass-rename, full BFS cascade auto-fix, bundle approve UX, D.7 aspirational layer (recursive auto drill-down + FM.depends_on graph), /product:clarify receiver channel, /ecosystem:upgrade. Context: dev/v1_1_backlog.md
📦 v2: P3 Feedback, P5 Actuality Refresh, multi-tool zones, etc.
```

---

## Autonomous Pipeline Vision (epics A-F)

> **Cross-module инициатива, не Phase-N.** Превращает три «вектор-идеи» владельца (охват до прода / качество входа / автономия) в эпики A-F. Принята как направление 2026-06-24 (DEC-DEV-0098). *(Epic **G** — матрица субагентов — добавлен позже отдельным запросом владельца 2026-06-30, поверх ядра A-F; в таблице ниже присутствует.)* Концепт-SSOT: [`dev/ECOSYSTEM_VISION.md`](dev/ECOSYSTEM_VISION.md) (`accepted`, §7 10/10); work-order первого инкремента: [`dev/_archive/orchestrator/ECOSYSTEM_VISION_BATCH_1.md`](dev/_archive/orchestrator/ECOSYSTEM_VISION_BATCH_1.md) (archived — Increment 1 done).
>
> **Цель (переформулирована из «100% результата»):** «**100% покрытия пути + gated-автономия**», не «человек ни разу не нужен». Три research-«тормоза» зашиты в дизайн: completeness-loop только bounded+anchored; консилиум = жюри/гетерогенность, не консенсус-дебаты; полностью автономный идея→прод нереалистичен (METR 0.9⁷≈48%).

**Эпики:**

| Эпик | Что | Зона | Статус |
|---|---|---|---|
| **A** | Реестр гетерогенных профильных персон (architect/qa/ux-advisor) + детерминированный zone→agent роутер | Product/Design (owned) | ✅ Increment 1 слит + Track V live-validated (0098/0103) |
| **B** | Bounded completeness-loop для D1-D2B; граница «достаточности» = handoff DoR; стоп = cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0) | Product (owned) | ✅ B1-core + B4 (0098/0099) + **волна B-a/B-b слиты** (0140 PR #105 / 0142 PR #111); B-c/B-d — stretch/pilot-gated |
| **C** | Крупные автономные шаги (макро `batch-enrich-feature-set`, 5-8 шагов = границы фаз с гейтами) + branch-anticipation | Product macro (Workflow) | ✅ **построен** — `/product:batch-enrich` (DEC-DEV-0150, `83f5b19`, PR #123) |
| **D** | Консилиум-примитив как жюри (`parallel()` фан-аут гетерогенных персон → synthesis → в гейт, не вместо) | cross-cutting | ✅ **построен** — `/product:consilium` + `consilium-synth.cjs` (wave C-D, `aca7c5d`, PR #117) |
| **E** | Сегмент до прода (CI/build, provisioning, deploy/rollback, QA-инфра, monitoring) | Orchestrator+Integrator | 🔄 **в активной сборке** — kickoff (0194, `99609a3`) + спайк VM (0195, `31a935e`) выполнены; следующий шаг = build **E.A** (`dev/gates/EPIC_E_READINESS.md`). *(Ранее «coordinate-only» — предусловия §6-канал + D3/D4/D5 сняты.)* |
| **F** | Autonomy configuration layer: enum L0/L1/L2/L3, детерминированный resolver (`lib/autonomy-policy.cjs`), floor необратимости non-crossable, hard-config дефолт + override | cross-cutting | ✅ **F1 + F2 построены** — F1 resolver (0152, `eea3a9f`, PR #125) + F2 L2/L3 consilium-gate wiring (0193, `76455ba`, PR #181); **F3** (autonomy prod-сегмент) едет с Epic E |
| **G** | Матрица субагентов: control-plane участия (per-агент config + participation-map поверх Epic A, реюз механики F) | cross-cutting | ✅ **построен** — agent-roster + participation-matrix (0151, `72b16b1`, PR #124); intent-SSOT `dev/ECOSYSTEM_VISION.md` §Epic G |

**Порядок (исторический план зависимостей):** (A ∥ F1) → B → (C ∥ D) → F2 → E(+F3). Всё, кроме E(+F3), построено; **E — в активной сборке** (последняя миля до прода). Фронт пайплайна (качество входа) шёл первым: ошибки спеки компаундируются вниз по конвейеру, чинить дешевле всего у источника.

**Increment 1 (СЛИТ 2026-06-25):** Epic A целиком (3 персоны + zone-routing) + B4 (loop-readiness аудит) + B1-core (completeness-oracle + bounded-loop + `/product:complete`). **Track V live-run grade'нут** (V-1 zone-хук / V-3 оракул PASS; V-2 frontmatter-фикс — DEC-DEV-0103); V-2 ре-ран после `/ecosystem:update`. Граница соблюдена: ни один файл `orchestrator/` не тронут.

**Wave B — полная волна (kickoff 2026-07-01, DEC-DEV-0136):** докрутка B1-`skeleton` → рабочий откалиброванный loop. Горизонт 1 (живой dogfood P2 + profiling study 0132) пройден. Owner-развилки зафиксированы: durable engine = **in-harness Workflow**; auto-fix = **conservative → pilot-calibrated**; **F1 отложен** (B в дефолт L1); B4 снят (уже `complete`). Sub-phases: **B-a** loop-надёжность (fix FB-LR-28 path-anchoring + FB-LR-29 PA_CANON + findings persistence) → **B-b** durable wave-runner (Workflow) → **B-c** close-out B5/B6/B8 → **B-d** real-resolve пилот-калибровка (committed = B-a→B-b; B-c/B-d stretch/pilot-gated). Work-order [`dev/_archive/vision/ECOSYSTEM_VISION_BATCH_2.md`](dev/_archive/vision/ECOSYSTEM_VISION_BATCH_2.md) `ready-to-run`. Предпосылка: merge P2-хвоста #94/#96.

---

## Фазы 0–7 — завершены (детали в архиве)

| Фаза | Статус | Итог |
|---|---|---|
| 0 — Scaffolding + SPECs | ✅ | базовая структура репо + v1 modifications |
| 1 — Integrator read-only + business DA | ✅ | + pre-pilot fix pmo-mapping, bootstrap-инфраструктура |
| 2 — Product Module core | ✅ | 20 файлов, первый пилот (DEC-DEV-0008) |
| 3 — Planning + Feature Enrichment | ✅ 2026-04-27 | смоук DEC-DEV-0023 |
| 4 — Handoff + NFR + DA + Validation + Cleanup | ✅ 2026-05-13 | lessons DEC-DEV-0032 |
| 5 — Integrator Phase 2 + первый адаптер | ✅ | PILOT POINT снят (P1–P7 полный, DEC-DEV-0129) |
| 6 — Design Module (conditional) | ✅ | смоук частично, догон S1/S3 (DEC-DEV-0177) |
| 7 — Integrator maintenance | ✅ validated 2026-07-11 | DEC-DEV-0176/0177 |

Развёрнутые блоки фаз (Deliverables / Acceptance criteria / Risks / Lessons), PILOT POINT, оценки и Dependencies graph — дословно в [`dev/_archive/roadmap/ROADMAP_phases-0-7.md`](dev/_archive/roadmap/ROADMAP_phases-0-7.md) (ротация 2026-07-11, DEC-DEV-0185; правило — checklists/phase-closure.md: блок закрытой фазы уезжает в архив на closure).

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

