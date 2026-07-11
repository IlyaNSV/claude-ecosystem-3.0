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
| 3 | Live-валидация = graduation gate | ✅ **GRADUATED — объявлено владельцем 2026-07-10** (DEC-DEV-0165). Основание: условный GO судьи (G-A ✓, G-B ✓ с оговорками, G-C ✓×4 — [GRADE_REPORT](../_archive/process-fabric/FABRIC_PHASE3_GRADE_REPORT.md), DEC-DEV-0162/0163); условия судьи выполнены/зафиксированы: bracket-guard в main (PR #141 `cc58e65`), DEF-4/ANOM-5 = upstream-долг (см. пост-обязательства), ветка `runtime_gate_retry`/`evt:env.up` честно помечена live-невалидированной |
| 4 | Расширение | ⬜ **разблокирована** graduation'ом 2026-07-10; старт — строго по эмпирическим триггерам ниже |

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
Ограничение «до прохождения G-B Fabric не расширять» снято graduation'ом 2026-07-10 (все три
критерия закрыты); расширение — фаза 4, по триггерам.

## Фаза 4 — расширение (по эмпирическим триггерам)

Temporal-актуатор (cron: staleness/deferred, класс G28/G29) · интеграция catalog/charters в
`gen-process-map` · новые charter'ы по live-нужде. **Cuts до запроса:** parallel-регионы,
history, XState-миграция, D7-charter.

## Параллельная дорожка — быстрые победы вне Fabric (AUDIT §6; независимые мелкие PR)

- [x] Фикс шаблона счётчиков 23/33→24/44 (G20) — ✅ DEC-DEV-0156, PR #131
- [x] SubagentStop-watchdog (G05/G06) — ✅ DEC-DEV-0159, PR #134
- [x] Линтер catalog↔runner (G19) — ✅ DEC-DEV-0158, PR #133 · install-pre-commit → авто-установка
      npm prepare (G23) — ✅ DEC-DEV-0157, PR #132
- [ ] expires_at-sweeper (G28) — единственный остаток очереди AUDIT §6

## Пост-graduation обязательства — 🟢 ОТКРЫТЫ 2026-07-10 (DEC-DEV-0165)

> Graduation объявлен владельцем → обязательства переведены из «зафиксированы в памяти»
> в активный work-order. Порядок 1→2 (док до gaps-сверки: сверка обновит тот же док);
> 3 и 4 — независимые, по мере окон.

1. [x] **Consumer-док Fabric** — ✅ 2026-07-10 (DEC-DEV-0166, PR #144): guide-слой —
   [`docs/guide/07-fabric.md`](../../docs/guide/07-fabric.md) (how-to оператора) + wiring
   (guide/README роутер+роли, 05-implementation §6, `docs/MAP.md` authorities+ORC-нода,
   orchestrator/README). Полная интеграция catalog/charters в `gen-process-map`/BPMN —
   сознательно фаза 4 (см. DEC-DEV-0166).
2. [x] **Gaps аудита — сверка реестра G01–G36** — ✅ 2026-07-10 (DEC-DEV-0167):
   [`audit/GAPS-RECONCILIATION-2026-07-10.md`](../_archive/process-fabric/audit/GAPS-RECONCILIATION-2026-07-10.md) —
   закрыто машинно 6 (G05/G06/G19/G20/G23/G32), частично Fabric'ом 8 (G03/G04/G07/G09/G10/
   G11/G12/G13), открыто 22 с роутингом: Tier-0 (G01/G02) — substrate-gated треки; G08/G28/G29 —
   кандидаты фазы 4; G14–G18/G21/G24/G33/G35/G36 — п.4 ниже; G22/G25–G27/G30/G31/G34 —
   backlog D7-гигиены на приоритизацию владельцем.
3. [x] **Upstream-долг graduation-прогона** — ✅ 2026-07-10 (DEC-DEV-0168): **DEF-4** — P7 probe
   получил workspace-скан (pnpm-workspace.yaml + npm `workspaces`, `--app`-пин, disclosure на
   происхождение/неоднозначность; enum вердиктов нетронут; юниты 21→30) · **ANOM-5** — owner-queue
   самоочищается на write-path (`dequeueOwnerEntries` + дедуп append), `status` read-only показывает
   `owner_queue_stale` отдельно · `--force-manual` требует существующую PA-ссылку в reason
   (юниты fabric-engine 27→35). PA-056 пилота закрывается следующей доставкой; ветка
   `runtime_gate_retry`/`evt:env.up` остаётся live-невалидированной (теперь не маскируется DEF-4) —
   проверится естественным live-триггером.
4. [ ] **Незавершённые параллельные инициативы, попутно выявленные аудитом** (не Fabric-зона,
   не потерять): OD7 await→resume не построен целиком · Integrator Phase-7 команды spec-only
   при живых ссылках на них (G14–G16) · Deep Discovery / screen-generator субагенты spec-only
   (G36) · P3p-путаница SSOT-оверлея · doc-дрейфы G17–G21/G33/G35 · ≥3 deferred-smoke плана
   (порог substrate-graduation уже превышен) · session-audit opt-in хрупкость (G24).
   ~~DEC-DEV аллокатор не атомарен (G32)~~ — закрыт DEC-DEV-0160, PR #135.
