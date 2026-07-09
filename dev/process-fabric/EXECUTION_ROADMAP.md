# Process Fabric — execution roadmap (resume-якорь для продолжения после компактации)

> **Назначение:** самодостаточный план доведения волны DEC-DEV-0153 до validated-состояния.
> Новая сессия начинает здесь: статус фаз ниже + [`README.md`](README.md) (состав пакета) +
> [`CONCEPT.md`](CONCEPT.md) §4 (дизайн) / §9 (фазы) + память `project_process_fabric_track`.
> Порядок и зависимости — без оценок часов (конвенция vision §5).

## Статус фаз

| Фаза | Что | Статус |
|---|---|---|
| 0 | Merge PR #128 (владелец) | ✅ 2026-07-07 |
| 1 | Ядро: fabric-engine + charter + 16 юнитов | ✅ built (≠ validated) |
| 2 | Wiring в живую машинерию | ✅ built 2026-07-07 (2a+2d PR #129, 2b+2c PR #130; 2e срезан → фаза 4) |
| 3 | Live-валидация = graduation gate | ✅ **условный GO** 2026-07-10 (добор G-B, DEC-DEV-0162/0163): G-A ✓, G-B ✓ (с оговорками), G-C ✓×4 — [GRADE_REPORT](FABRIC_PHASE3_GRADE_REPORT.md); условия: merge bracket-guard PR + upstream-долг DEF-4/ANOM-5 + ветка `runtime_gate_retry`/`evt:env.up` live-невалидирована; **формальное объявление graduation — владелец** |
| 4 | Расширение | ⬜ после объявления graduation владельцем, по триггерам |

## Фаза 2 — wiring (1-2 PR, порядок внутри фазы)

1. ✅ **2a. Диспетчер-wiring** (DEC-DEV-0154) — секция «Process Fabric» в `run.md` после
   `run-ledger finish`: opt-in `--fabric` (init+`evt:line.start`, rejected = FB-004 backpressure),
   `ingest` тем же result-file/`$RUN_ID`, маршрутизация prescriptions (auto→bracket-цикл,
   human-gate→owner-queue+STOP, final→закрытие), resume-события; wiring-тест 11 asserts.
2. ✅ **2b. PA-мост** (DEC-DEV-0155) — engine-shell зеркалит human-gate канонической PA-записью
   (маркеры fabric-instance/state/resume-event, дедуп) + `pa-scan [--tick]` резолюция (done→tick,
   dismissed→surfaced). Первый обратный контур (G03/G04) замкнут end-to-end машинно.
3. ✅ **2c. SessionStart-инжект** (DEC-DEV-0155) — `hooks/orchestrator/session-fabric-status.js`
   + manifest (первый shipped SessionStart); warn-only, read-only, тумблер FABRIC_STATUS_INJECT=0.
4. ✅ **2d. F2-сверка** (DEC-DEV-0154) — чек-лист F1 §6 закрыт по всем 6 пунктам (см. контракт):
   дом либы = `orchestrator/lib/` (деплой-фикс), `--autonomy` end-to-end, `why[]`→events.ndjson,
   risk из charter-meta, readiness событиями, env_tier из limits.json.
5. ✂ **2e — СРЕЗАН** (DEC-DEV-0155): расширение до graduation противоречит substrate-дисциплине
   0148 (built ≠ validated); charter №2 product-front → фаза 4, по live-триггеру federation-нужды.

MDP: 2a/2d — main-модель; 2b/2c — opus-исполнитель + main-ревью. Гейты: process-gate потребует
CHANGELOG (consumer-zone) + DEV_JOURNAL.

## Фаза 3 — live-валидация (graduation gate, отдельная пилот-сессия на `my-first-test`)

По `dev/meta-improvement/checklists/live-run-validation.md` (класс B). Критерии (CONCEPT §9):
- [x] инстанс `feature-production-line` прожил ≥2 сессии с restore из state.json — ✅ 2026-07-08 (G-A);
- [x] минимум один NO-GO→remediation→GO прошёл машинно — ✅ 2026-07-10 добор (G-B): инстанс №2,
      seq5 `impl.no_go`→remediation (P6-брекет NO-GO) → conflict-гейт PA-054/055 (реальная находка)
      → owner Resolution 2 → P6 re-gate GO → seq8 `impl.go`; все переходы ingest/run_id-backed;
- [x] один human-gate через owner-queue разрешён и продолжил инстанс — ✅ PA-045 → `pa-scan --tick` (G-C).
Долг run-ledger live-прогона закрыт (R10). Артефакты прогона: BRIEF / REVIEW_HANDOFF / GRADE_REPORT
рядом; DEC-DEV-0162 (вкл. live-дефект DEF-1 SessionStart-инжектора — починен `c8cbf9d`).
До прохождения G-B Fabric не расширять.

## Фаза 4 — расширение (по эмпирическим триггерам)

Temporal-актуатор (cron: staleness/deferred, класс G28/G29) · интеграция catalog/charters в
`gen-process-map` · новые charter'ы по live-нужде. **Cuts до запроса:** parallel-регионы,
history, XState-миграция, D7-charter.

## Параллельная дорожка — быстрые победы вне Fabric (AUDIT §6; независимые мелкие PR)

- [ ] Фикс шаблона счётчиков 23/33→24/44 (G20 — тиражируется в каждый пилот; самый дешёвый/срочный)
- [ ] SubagentStop-watchdog (G05/G06 — подмена канонического DA-агента)
- [ ] Линтер catalog↔runner (G19) · expires_at-sweeper (G28) · install-pre-commit в bootstrap (G23)

## Пост-завершение (обязательства, зафиксированы в памяти)

1. **Документация по сделанному** — после graduation: consumer-док Fabric (docs/orchestrator-module
   или guide-слой: что такое charter, как читать owner-queue/status, как добавить процесс),
   обновление `docs/MAP.md`/BPMN-карты из catalog/charters.
2. **Gaps аудита** — вернуться к реестру G01–G36 ([`audit/APPENDIX-B`](audit/APPENDIX-B-gap-analysis.md)):
   что Fabric закрыл фактически, что осталось; Tier-0 (Epic E, E15/G02 external→`.product/`
   result-ingest) — отдельные треки, substrate-gated.
3. **Незавершённые параллельные инициативы, попутно выявленные аудитом** (не Fabric-зона, не потерять):
   OD7 await→resume не построен целиком · Integrator Phase-7 команды spec-only при живых ссылках
   на них (G14–G16) · Deep Discovery / screen-generator субагенты spec-only (G36) · P3p-путаница
   SSOT-оверлея · doc-дрейфы G17–G21/G33/G35 · ≥3 deferred-smoke плана (порог substrate-graduation
   уже превышен) · session-audit opt-in хрупкость (G24) · DEC-DEV аллокатор не атомарен (G32).
