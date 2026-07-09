# Fabric Phase 3 — Grade Report (live-прогон 2026-07-08, VM-пилот)

> **Вердикт: PARTIAL — NO-GO на полную graduation (2 из 3 критериев §9 машинно валидированы).**
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
