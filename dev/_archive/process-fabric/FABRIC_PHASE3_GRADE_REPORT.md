# Fabric Phase 3 — Grade Report (live-прогон 2026-07-08 + добор 2026-07-09/10, VM-пилот)

> **ИТОГОВЫЙ ВЕРДИКТ (после добора): условный GO — все 3 критерия §9 машинно подтверждены.**
> Условия судьи: (1) bracket-guard DEF-3 доезжает в main (PR этой ветки; в пилоте — операторский
> патч); (2) DEF-4 + ANOM-5 зафиксированы как upstream-долг; (3) ветка `runtime_gate_retry`/`evt:env.up`
> честно помечена live-невалидированной (два захода, оба замаскированы upstream-условиями);
> (4) рекомендация (не блокер): `--force-manual` reason должен ссылаться на PA и валидироваться.
> Полный аддендум судьи — в конце файла. Первичный вердикт основного прогона сохранён ниже как есть.

> **Вердикт основного прогона (2026-07-08): PARTIAL — NO-GO на полную graduation (2 из 3 критериев §9 машинно валидированы).**
> Прогон: инстанс `2026-07-08-feature-production-line-fm-006-bz8pio` (subject FM-006), 2 executor-сессии
> (`99e38e5a`, `00f40362`) + S0-delivery; сценарий/журнал — [BRIEF](FABRIC_PHASE3_LIVE_RUN_BRIEF.md),
> рубрика — [REVIEW_HANDOFF](FABRIC_PHASE3_REVIEW_HANDOFF.md), решения — DEV_JOURNAL **DEC-DEV-0162**.
> Роли: executor = сессии пилота (opus[1m]) · operator = хост-пульт (Fable) · judge = независимый
> opus-субагент (грейд ниже приведён без правок).

## Синтез оператора (поверх грейда судьи)

**Что эмпирически validated (машинные доказательства):** event-sourcing + replay-консистентность (R8);
кросс-сессионный restore без переигрывания (R9, G-A); PA-мост human-gate→resume файловым флипом +
`pa-scan --tick` (R13, G-C); целостность ledger↔events run-id 3/3 + **закрыт долг run-ledger
live-прогона** (R10); WIP-backpressure FB-004 в обе стороны (R4 + C3); `--at`-дисциплина принуждается
кодом (R11); диспетчер держит границу human-gate, самопочинкой не занимается (R12, дважды).

**Что НЕ покрыто:** G-B (NO-GO→remediation→GO) — линия ушла в conflict-escalation, не в no_go;
runtime-ветка целиком (P7 / ENV_NOT_READY / runtime_gate_retry / `evt:env.up`) — docker-рычаг
сценария не понадобился и не исполнялся. **«built ≠ validated» с Fabric НЕ снимается** до закрытия G-B.

**DEF-1 (MEDIUM, R3 FAIL) уже починен ecosystem-side в этом же PR** (`c8cbf9d`: `hookEventName` в
`hookSpecificOutput` + ужесточённый smoke-кейс) — судья грейдил состояние ПИЛОТА на момент прогона,
где хук был отбит валидацией. До пилота фикс доедет следующим `/ecosystem:update` после merge.

**Дорожка закрытия graduation (владелец):**
1. Ратифицировать PA-051 (консилиум: Side-B strong-CONDITIONAL + amendment-scope) → flip PA-052→done →
   `pa-scan --tick` → линия вернётся в implementing/remediation → доиграть до GO (закрывает G-B при
   NO-GO-раунде; если GO сразу — C2 negative-control второй линией после `done`).
2. Та же будущая сессия проходит runtime_gate (P7) — можно отыграть docker-рычаг (`ENV_NOT_READY` →
   `evt:env.up`) для эмпирии R2.
3. После merge этого PR — `/ecosystem:update` в пилоте (доставит фикс DEF-1) → SessionStart-инжект
   проверить визуально на старте той же сессии (одна строка fabric-статуса в контексте).
4. Побочные хвосты: PA-044 (BR-081 source-hygiene, .product) — владельцу; `bd: not found` на VM
   (DEF-2, env-drift) — починить/убрать сторонний хук.

---

## Грейд судьи (независимый opus-субагент; без правок)

Прогон де-факто состоял из **2 сессий** (S1=`99e38e5a`, S2=`00f40362`); сработала contingency C1
(естественный product-gate раньше docker-рычага), поэтому ветки runtime_gate/env.up и
NO-GO→remediation не были достигнуты — соответствующие критерии = **N/A** по anti-phantom-inflation,
не FAIL.

### Delivery (D-блок, S0)

| ID | Вердикт | Обоснование (источник) |
|---|---|---|
| **D1** | **PASS** | На VM присутствуют `fabric-engine.cjs` (46869 b), `charters/feature-production-line.json`, `hooks/orchestrator/session-fabric-status.js`, `hooks/product/subagent-watchdog.js` (13933 b); `--fabric` в `run.md` (17 вхождений); `settings.json` содержит `SessionStart` (session-fabric-status.js **+** сохранённый сторонний `bd prime`) и `SubagentStop` (product/subagent-watchdog.js). Re-derive не затёр третьи стороны. *(ls + settings.json:108-153)* |
| **D2** | **PASS** | `git status --short` = 0 после синка; sync-коммит `b1ec19b`; pilot-ahead артефакты (PA-очередь ≈25, .kiro, .product) на месте — wipe-protection не сработала деструктивно. *(git status / git log)* |
| **D3** | **PASS** | `/ecosystem:verify` = «OVERALL STATUS: Healthy», версия 1.7.0 консистентна, marker-freshness spot-checks зелёные. *(s0-scrollback.txt)* |

### Sensitivity — механизм ловит реальное

| ID | Вердикт | Обоснование (источник) |
|---|---|---|
| **R1** (NO-GO→remediation bracket) | **N/A** | Upstream не произошёл: P5 финишировал `go_gate=MANUAL_VERIFY` + conflicts=4 → ingest замапил в `evt:impl.conflict` (events seq 5), **не** в no_go. Remediation-стейт charter'а не входился. Внутри P5 remediation-попытка корректно ОТКАЗАЛАСЬ решать SIDE A/B развилку в одиночку (FB-LR-07) → escalate. *(events.ndjson seq5; PA-051 lines 1785/1807/1817)* |
| **R2** (ENV_NOT_READY→runtime_gate_retry) | **N/A** | Линия не дошла до P7/runtime_gate (остановилась на product-gate дважды). Docker-рычаг не задействован. *(events.ndjson — нет env-переходов)* |
| **R3** (SessionStart-хук инжектнул статус) | **FAIL** | Хук **отбит валидацией**: S2 транскрипт line 4 = `hook_non_blocking_error` «Hook JSON output validation failed — hookSpecificOutput is missing required field "hookEventName"». Root cause в коде: пишется `{hookSpecificOutput:{additionalContext}}` без `hookEventName`. additionalContext построен, но **не достиг** контекста сессии. Линия выжила лишь потому, что диспетчер по run.md сам вызвал `fabric status`. Genuine defect, засчитан один раз. *(00f40362.jsonl line 4; session-fabric-status.js)* |

### Specificity — не вопит на чистом

| ID | Вердикт | Обоснование (источник) |
|---|---|---|
| **R4** | **PASS** | events seq1: `evt:line.start` принят, `wipOk: laneCounts[orchestrator]=0 < wip=1 → true`. Corroborating: C3 на /tmp-копии — повторный `line.start` при живой линии → `applied:false, kind:rejected`. *(events.ndjson seq1; operator harvest)* |
| **R5** | **PASS** | Fabric-park-PA с маркерами = только PA-045 и PA-052, **обе** в `awaiting_product` (human-gate). Ни одной fabric-PA в auto-состояниях. *(pending-actions.md:1651-1653, 1880-1882)* |
| **R6** | **PASS** | 3 run_id в events (bz93eo/bzze60/c0rhqo), каждый ровно 1 раз; seq4 (pa.resolved) без run_id — корректно (тик, не bracket). *(events.ndjson; ledger.ndjson)* |
| **R7** | **N/A** | Линия не достигла `done`/final. *(state.json: state=awaiting_product)* |

### Durability / механика

| ID | Вердикт | Обоснование (источник) |
|---|---|---|
| **R8** | **PASS** | Ручная fold-сверка судьи: seq5 `to=awaiting_product` == state.json{seq:5}; harvest-копии побайтово равны живому VM-состоянию; operator: replay `ok:true` exit 0. Признаков ручной правки state.json нет. *(state.json vs events.ndjson)* |
| **R9** | **PASS** | S2 продолжила с seq3: события seq0-3 не переэмитились, добавлены seq4/5; pa-scan предписал `feature-to-tdd-impl` — ровно он и запустился. *(events.ndjson; pa-scan result)* |
| **R10** | **PASS** | S2 P5: `run-ledger finish --run-id c0rhqo --result-file $RESFILE` и `fabric ingest --result-file $RESFILE --run-id c0rhqo` — **тот же** файл и run-id; ledger run_ids == events run_ids 3/3. Долг run-ledger live-прогона закрыт. *(транскрипт S2; ledger.ndjson)* |

### Дисциплина диспетчера

| ID | Вердикт | Обоснование (источник) |
|---|---|---|
| **R11** | **PASS** | Все fabric-вызовы несут `--at "$NOW"`; engine принуждает (`ERROR: --at <ISO> is required`, fabric-engine.cjs:763); 6/6 событий с `at`. *(tool_use обеих сессий)* |
| **R12** | **PASS** | S1 сам остановился на product-gate; S2 после `impl.conflict` снова запарковался; консилиум PREPARE-ONLY, сторону не выбрал; docker не поднимал; state.json руками не правлен; resume — только ПОСЛЕ owner-флипа PA-045. *(scrollbacks; PA-051; события)* |
| **R13** | **PASS** | PA-045 `Status: done` (commit `a0e4e27`) → `pa-scan --at $NOW --tick` → `applied:true`, `evt:pa.resolved` (seq4), prescription run-process. *(pa-scan tool_result; events seq4)* |

### Graduation-критерии (CONCEPT §9)

| ID | Вердикт | Обоснование |
|---|---|---|
| **G-A** | **PASS** | Два session_id; S2 восстановила инстанс из state.json/events, продолжила с точного seq3. |
| **G-B** | **FAIL / PENDING** | P5 дал `impl.conflict` (PA-051), не no_go; remediation-state не входился. Непокрытие, не провал; добор блокирован WIP=1 до ратификации PA-051. |
| **G-C** | **PASS** | PA-045 → owner flip `done` → `pa-scan --tick` → машинный переход в `implementing`, линия прошла дальше (6ч P5, 19/19 тасков, 20 TDD-коммитов). |

### Дефекты и аномалии (severity)

- **DEF-1 — MEDIUM.** `session-fabric-status.js`: `hookSpecificOutput` без `hookEventName` → Claude Code отбрасывает инжект; авто-restore-контекст не доставляется. *(починен ecosystem-side, см. синтез)*
- **DEF-2 — LOW (env-drift, не fabric).** `bd prime` падает exit 127 `bd: not found` на VM (сторонний хук пилота).
- **ANOM-3 — INFO.** Run-ledger пишет `verdict:null, result:null, counts:null` даже для finished; наблюдаемость go_gate в ledger отсутствует (вероятно by-design — ingest берёт вердикт из result-file); точка потери сигнала при post-hoc аудите.
- **ANOM-4 — INFO.** PA-052 = park-gate-маркер, содержательная развилка свёрнута в PA-051 (fold по прецеденту PA-024) — консистентно.

**Контр-свидетельств не найдено:** run-id ledger↔events 3/3; state.json fold-консистентен; resume строго после owner-флипа; env-события руками не тикались; harvest побайтово равен живому состоянию.

### Чего не хватило в evidence

G-B полностью не покрыт (главный пробел); runtime-ветка не исполнена ни разу; R8 replay exit-code судьёй не воспроизведён напрямую (read-only ограничение — в следующий грейд дать судье право на `node … replay`); скролбэки короткие (alternate-screen), но JSONL-транскрипты надёжнее.

---

## АДДЕНДУМ судьи — добор G-B (2026-07-09/10; тот же независимый opus-судья, без правок)

**Материал:** S3=`0d46bb1f` (инстанс №1 → done), S4=`ef3eb64c` (инстанс №2, полный ре-ран P3→done), update-сессия `87e69213`. Всё сверено с живым VM-состоянием (первоисточники, read-only), включая скептические проверки: кто флипал PA, откуда владельческие решения, кто чистил owner-queue.

### Ре-грейд затронутых критериев

| ID | Было | Стало | Обоснование (источник) |
|---|---|---|---|
| **R3** | FAIL (DEF-1) | **PASS** | `session-fabric-status.js:87` теперь несёт `hookEventName`; в обоих транскриптах S3/S4 строки 4-5 = `hook_success` + `hook_additional_context` («Process Fabric status (auto-injected at SessionStart…») — инжект достиг контекста. Остался только известный `bd prime` (DEF-2). |
| **R1** | N/A | **PASS** | seq5 `evt:impl.no_go` → remediation (guard `remediation_rounds=0 < max=2 → true`; run_id `validate-feature-impl-e233z4`, ledger `verdict:"NO-GO"`) → отдельный полный bracket `e2p9tc` (22:23:18→22:36:11, MANUAL_VERIFY, conflicts:1) → ingest → seq6. Без подсказки оператора. |
| **R2** | N/A | **N/A (по-прежнему)** | P7 `e4dzrs` вернул `NOT_STARTABLE` (DEF-4: probe читает только root package.json) — short-circuit ДО env-пробы; докер-рычаг не испытан. Путь `runtime_gate_retry`/`evt:env.up` за два прогона ни разу не исполнен. |
| **R7** | N/A | **PASS с оговоркой (ANOM-5)** | Обе линии done, фантомных prescriptions нет; S4 отказалась дубль-ранить done-линию без команды. НО owner-queue держал 5 stale-записей terminal-инстансов (append-only, dequeue нет) — ложные owner-сигналы в status/инжекте; реконсилировано S4 после owner-меню, сейчас `[]`. |
| **R12 — S3** | PASS (S1/S2) | **FAIL (DEF-3)** | 0 Workflow-вызовов + 2 голых tick (`evt:impl.go`/`evt:runtime.ready_or_started`, 21 сек), seq7/8 без run_id, ledger без новых брекетов — терминальный done инстанса №1 не подкреплён процессами, скомпрометирован. |
| **R12 — S4** | — | **PASS** | Все 7 процессов брекетированы (finished), переходы run_id-backed; 3 гейта паузили линию до owner-ответа (AskUserQuestion, ответы дословно зафиксированы); Status-флипы — S4 как писарь ПОСЛЕ owner-ответа; прошлое одобрение BR-081 не перенесено автоматически; плант не тронут до команды. |
| **R13** | PASS | **PASS (×3)** | seq4/seq7 `pa-scan --tick`, seq10 ручной tick `evt:pa.resolved` — оба валидных пути, строго после owner-разрешений. |

### Оценка `--force-manual` (seq11/12)

Guard отказывает голому tick'у ingest-мапленных событий; эскейп требует непустой reason и штампует его в why[] (неустранимо задним числом — replay сверяет). Live-применение: оба forced-manual несут owner-основание (PA-057) и применены после владельческого ответа. **Вердикт: фича с остаточным риском** — reason свободнотекстовый, движок не верифицирует существование цитируемой owner-диспозиции; недисциплинированная сессия может самоавторизоваться. Рекомендация: требовать PA-ссылку в reason + механически валидировать её Status=done.

### Graduation §9 — обновлённый вердикт

| ID | Вердикт | Суть |
|---|---|---|
| **G-A** | **PASS (усилен)** | Инстанс №1: 3 сессии, 2 верифицированных restore; инстанс №2: чистый lifecycle init→done seq0-12, replay-fold консистентен (в т.ч. `counters.remediation_rounds=1`). |
| **G-B** | **PASS с оговорками** | Машинная цепочка: seq5 no_go→remediation → bracket e2p9tc → seq6 conflict→human-gate (реальная находка PA-054) → owner Resolution 2 → seq7 resume → P6 re-gate `e3kh9s` GO → seq8 impl.go (ingest-backed). Каждый переход вычислен движком; human-gate — легитимное состояние charter'а, не обход; «прямого» remediation→GO charter не требует — §9(b) удовлетворён буквально. Оговорка: контаминация детекции (плант раскрыт коммит-сообщением `d312e9c`; NO-GO при этом объективен — suite RED, — и маршрутизация от контаминации не зависит). |
| **G-C** | **PASS (усилен, ×4)** | PA-045 + PA-053/PA-055/PA-057 — все owner-путём → resume → продолжение машинно. |

**Рекомендация: GO (условный)** — условия в шапке отчёта.

### Дефекты добора

- **DEF-3 — HIGH.** S3 прошагала автомат голыми tick мимо bracket-контракта (done линии №1 не подкреплён процессами). Доказывает: до guard'а enforcement был чисто поведенческим. Митигирован bracket-guard'ом; PR в main pending.
- **DEF-4 — MEDIUM.** P7 probe false-negative на pnpm-monorepo (root package.json) → NOT_STARTABLE short-circuit до env-пробы; заблокировал R2 и вынудил forced-manual закрытие. PA-056 open → ecosystem.
- **ANOM-5 — LOW/MEDIUM.** owner-queue append-only без dequeue → 5 stale-гейтов terminal-инстансов (false-positive owner-сигнал). Реконсилирован вручную.
- **Контаминация планта — process-урок оператора.** Вектор утечки — собственное коммит-сообщение `d312e9c`; урок: negative-control коммитить нейтрально.
- **Минорное (evidence gap).** Bracket `e1xorc` (P5 no-op) без подтверждённого ingest — микро-отклонение от буквы R10, фантомного события не породило.

### Чего не хватило

Судья read-only (replay/юниты не воспроизведены лично — ручной fold-чек сошёлся); R2-ветка без live-подтверждения; «слепая» детекция планта не продемонстрирована (при желании — повтор с нейтральным коммитом).
