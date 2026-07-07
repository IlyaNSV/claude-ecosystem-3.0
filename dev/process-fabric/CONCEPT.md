# Process Fabric — Statechart-слой координации процессов (концепт)

> **Статус:** концепт + пилотное ядро (built ≠ validated — см. §9 graduation).
> **Дата:** 2026-07-07. **Решение:** DEC-DEV-0153 (см. DEV_JOURNAL).
> **Входы:** аудит процессной ткани [`AUDIT_2026-07-07.md`](AUDIT_2026-07-07.md), каталог процессов
> [`catalog.yaml`](catalog.yaml), `docs/orchestrator-module/SPEC.md` §2 (модель детерминизма),
> `dev/AUTONOMY_POLICY_F1_CONTRACT.md`, `dev/ECOSYSTEM_VISION.md` §5 (граф эпиков, развилка «б»).
> **Интенция владельца:** применить иерархические автоматы (Statechart) / автоматы с расширенным
> состоянием (Extended State Machine) для контроля и backpressure харнесса экосистемы; творческие
> процессы — менее детерминированы, механические — более. (Источник идеи — доклад о FSM-контроле
> LLM-агентов; здесь идея проверена критически против фактического устройства экосистемы.)

---

## 0. TL;DR

**Идея владельца верна в диагнозе, но требует сужения в рецепте.** Внутри процессов statechart
уже существует и работает (Workflow-скелеты P2–P7 = детерминированные FSM с bounded rounds,
schema-гейтами и block-классификацией) — строить там второй движок значит дублировать. Реальный
разрыв — **между** процессами и **между** сессиями: маршрутизация исходов (`NO-GO`, `conflicts`,
`product_routed`, `capability-request`) живёт в прозе `run.md` и исполняется «если LLM вспомнит»;
долгоживущий инстанс «фича в производстве» не имеет ни единого носителя состояния, ни машинных
переходов; backpressure отсутствует, а главный перегруженный ресурс — **внимание владельца**
(человеческие гейты размазаны по ≥5 несвязанным очередям).

Поэтому строим **Process Fabric** — тонкий межпроцессный координационный слой:
декларативные charter'ы (JSON, подсет XState-семантики + расширения) + микро-интерпретатор
`fabric-engine.cjs` (Node stdlib, pure-core, event-sourced) + актуаторы (диспетчер `run.md`,
хуки, pending-actions, cron). Engine **не вызывает LLM и не заменяет Workflow** — он полицейский
и штурман: принимает материализованные события (из structured-результатов процессов через
run-ledger), детерминированно вычисляет переход, персистит состояние инстанса и **предписывает**
следующий шаг с диспозицией из `autonomy-policy.cjs` (это и есть посадочное место F2-wiring).
Backpressure — extended state (WIP-лимиты per lane + единая приоритизированная очередь
owner-гейтов). Детерминизм-манифест DL0–DL3/H задаёт, насколько жёстко FSM держит каждый шаг:
механика — исполняется/проверяется кодом, творчество — только рамка вход/выход-контрактов.

---

## 1. Критический разбор интенции (где профит реальный, где мнимый)

Интенция раскладывается на 4 утверждения; проверяем каждое против кода.

| # | Утверждение интенции | Вердикт | Обоснование |
|---|---|---|---|
| 1 | «Нужен FSM-контроль поверх LLM-процессов» | ✅ уже есть **внутри** процессов; строить второй раз не надо | Workflow P2–P7 = детерминированный скелет + bounded rounds + schema-гейты + деterministic-оракулы (SPEC §2: слой-1/слой-3 строгие). P5 буквально самоописывается как «minimal dispatch-FSM» |
| 2 | «Процессы нелинейны, исход шага должен уметь триггерить другой процесс» | ✅ **главный реальный разрыв** | Вся пост-процессная маршрутизация — страница прозы `run.md` «After the run» (prompted); cross-session инстанс не имеет носителя; см. AUDIT §2 — большинство межпроцессных связей prompted/human-memory |
| 3 | «Backpressure харнесса» | ✅ но объект давления другой | Машинного трафика (solo dev) мало; перегружен **владелец**: approve/merge/PA-очереди копятся без приоритизации (deferred-smoke долги, pending-файлы, LESSON — эмпирика в AUDIT §4). Backpressure = WIP-лимиты + единая owner-очередь, а не токен-бакеты на агентов |
| 4 | «Уровень детерминизма на процесс; творческое — свободнее, механическое — жёстче» | ✅ формализуем; половина уже есть | SPEC §2 (3 слоя), MDP (5 осей → тир модели), F1 (disposition), gate-risk-classifier (HIGH/LOW) — четыре частных механизма без общего манифеста. Вводим шкалу DL0–DL3/H и маппинг на все четыре (§7) |

**Мнимые профиты (отвергнуто):**
- *Перенос внутрипроцессного flow в statechart* — Workflow уже детерминирован, переезд = risky
  rewrite без выигрыша (нарушает «orchestrate, don't duplicate», DEC-DEV-0076).
- *Полная событийная реактивность* — Claude Code не демон. Между сессиями события доставляют
  только хуки (в сессии), cron/routines (вне) и человек. Честная модель: engine пассивен,
  актуаторы будят его на известных точках (§6). Обещать «живой» event-loop — самообман.
- *Fine-grained машинная карта всех процессов как документация* — репо уже осознанно отказался
  от такой таблицы (docs/MAP.md: «неверная карта хуже отсутствующей», высокий sync-cost).
  Ответ: charter — **исполняемый** артефакт (как Workflow-скрипты), а не описательный;
  дрейфует только то, что дублирует. Каталог (catalog.yaml) — входной реестр для charter'ов
  и для людей, с CI-реконсиляцией против SSOT-источников (как check-counts).

---

## 2. Инвентарь state-машинерии де-факто (что уже построено)

| Машина | Состояния | Хранилище | Кто исполняет переходы | Enforcement |
|---|---|---|---|---|
| Артефактные lifecycle (24 типа) | draft→active→deprecated; HYP testing→validated/invalidated/deferred; FM planned→in-progress→shipped; RL, MVP, MK | frontmatter `status` | LLM по промпту + human approve | hooks валидируют (V-*), переход не enforced |
| Workflow-процессы P2–P7 | фазы + per-task FSM (bounded rounds, block-классы) | run-объект (переживает /compact), результат → run-ledger | скрипт (control-flow) + agent() (суждение) | **строгий** внутри run |
| run-ledger | running→finished | `.claude/orchestrator/runs/` (run.json + ledger.ndjson) | диспетчер (bracket start/finish) | prompted (диспетчер обязан обернуть) |
| pending-файлы продукта | queued→surfaced→resolved | `.product/.pending/*.yaml` | hooks пишут, LLM surfaced на approve/status | частично enforced (hooks), разбор prompted |
| pending-actions (§6, OD7) | requested→await→resolved | `pending-actions.md` | LLM пишет; резолвит Integrator/Product/человек | **гипотеза, не live-validated** (S6) |
| session-state продукта | процесс/шаг P1/P2 | `.product/.sessions/*.yaml` | hook пишет, `--continue` читает | enforced запись, prompted resume |
| autonomy F1 | — (resolver, не машина) | `lib/autonomy-policy.cjs` | чистая функция | построен, **не wired** (F2) |
| D7 process-gate | — | commit-msg hook | git hook | **blocking** |

Вывод: состояний много, хранилищ ≥6, переходы между **процессами** не держит никто, единой
модели «инстанс потока» нет. Это не «нет FSM», это «FSM-архипелаг без федерации».

---

## 3. Ключевой разрыв (эмпирика аудита, 2026-07-07)

Полный аудит — [`AUDIT_2026-07-07.md`](AUDIT_2026-07-07.md) (+3 приложения). Сухой остаток:
**79 процессов; 18 де-факто машин состояний, enforced-переход у 3; 36 разрывов G01–G36;
из ~19 runtime-хуков блокирует один; состояние фрагментировано по 9 хранилищам в 4 форматах.**
Классы разрывов, на которые отвечает Fabric:

- **(a) Исход есть — триггер следующего процесса ручной** (G07/G08): P3o→…→P7o задуманы
  цепочкой, но каждый стык = человек/LLM вспоминает `run.md`-прозу «After the run».
- **(b) Fire-and-forget обратные связи** (G02/G03/G04): все обратные сигналы уходят в
  `pending-actions.md` / шесть `*-pending.yaml` — write-only очереди без слушателя; OD7
  await→resume не реализован; внешний инструмент ничего не возвращает в `.product/`.
- **(c) Prompted-связи** (G05/G06/G10–G12): «сенсор→мышца» разрыв — хук записал сигнал,
  детерминированный оракул умеет исполнить, между ними «LLM должен вспомнить» (с задокументированной
  recurring-регрессией подмены канонического DA-агента).
- **(d) Human-memory-связи** (G17/G24–G27): deferred-smoke, feedback-intake, audit-smoke — по памяти.
- **(e) Очереди без backpressure:** ≥5 мест ждут владельца без общего вида и приоритета; у PA
  status-поле в схеме есть, но детерминированного консьюмера/реакции нет (поправка критика,
  AUDIT §7).

**Эталон, который Fabric генерализует:** `lesson-gate` — единственный полностью замкнутый контур
системы (write `status:open` → Stop-хук блокирует → форсированный resolve). Fabric = тот же паттерн
«детерминированный слушатель на конце очереди», поднятый с одного артефакт-типа на межпроцессную
ткань. Вне Fabric аудит дал список быстрых побед (SubagentStop-watchdog, PA status-поле,
линтеры/сviперы) — AUDIT §6.

---

## 4. Решение: Process Fabric — границы и не-цели

**Fabric — это:** (1) декларативные charter'ы верхнеуровневых потоков; (2) детерминированный
интерпретатор переходов с event-sourced состоянием инстансов; (3) предписания актуаторам
(диспетчер/хуки/человек/cron); (4) backpressure на extended state; (5) манифест детерминизма.

**Fabric — это НЕ:**
- НЕ замена Workflow (внутрипроцессные скелеты остаются единственным носителем внутри-run flow);
- НЕ демон/шедулер (не имеет собственного цикла; его «тикают»);
- НЕ LLM-компонент (engine не вызывает модель; суждение остаётся в agent()-слое процессов);
- НЕ auto-approve машина (все human-gate/floor-семантики F1 сохраняются; Fabric их *исполняет*,
  а не ослабляет — north-star «автономия в суждении + послушание в процессах» не трогаем);
- НЕ обязательный слой (процесс можно гонять руками как сейчас; Fabric добавляет память и
  маршрутизацию, degradation без него = сегодняшнее поведение).

### 4.1 Архитектура (три уровня)

```
L0  CHARTERS (декларации)         orchestrator/charters/*.json
    states / on-events / invoke(process) / guards / ingest-маппинг / meta(DL, autonomy)
                 │ читает
L1  ENGINE (детерминизм)          orchestrator/lib/fabric-engine.cjs   [Node stdlib, pure-core]
    transition() чистая · tick/ingest/status CLI · event-sourcing (events.ndjson + state.json)
    guards → существующие .cjs-оракулы · disposition → lib/autonomy-policy.cjs (F1)
    extended state: .claude/orchestrator/fabric/{<instance>/, limits.json, owner-queue.json}
                 │ предписывает (prescriptions JSON)
L2  ACTUATORS (исполнение)
    диспетчер /orchestrator:run (уже bracket'ит run-ledger — добавляется ingest+tick)
    hooks: SessionStart-инжект «pending prescriptions» (прецедент rails-session-start.js)
    pending-actions.md: human-gate предписания (существующий канал OD7)
    cron/routines: temporal-события (staleness, deferred re-check) — опционально, позже
```

### 4.2 Charter-формат (подсет XState-семантики + расширения)

JSON (zero-dep; совместим по духу с XState-нотацией → визуализируется конвертацией при нужде;
Mermaid-рендер стейтчарта генерится скриптом из charter'а — SSOT один).

```jsonc
{
  "id": "feature-production-line",
  "version": 1,
  "context": { "feature": null, "fm": null },          // extended state инстанса
  "initial": "handoff_ready",
  "limits": { "lane": "orchestrator", "wip": 1 },       // backpressure-декларация
  "states": {
    "handoff_ready": {
      "meta": { "determinism": "H", "autonomy": "human-gate" },
      "on": { "evt:line.start": { "target": "authoring", "guard": "wip_ok" } }
    },
    "authoring": {                                        // SCXML <invoke> ≈ Workflow-run
      "invoke": { "process": "batch-features-to-cc-sdd" },
      "meta": { "determinism": "DL3", "autonomy": "auto" },
      "on": {
        "evt:spec.authored":  { "target": "fidelity_audit" },
        "evt:spec.blocked":   { "target": "escalated", "actions": ["queue_owner"] }
      }
    },
    "fidelity_audit": {
      "invoke": { "process": "audit-spec-fidelity" },
      "meta": { "determinism": "DL2", "autonomy": "auto" },
      "on": {
        "evt:fidelity.impl_ready":    { "target": "implementing" },
        "evt:fidelity.product_routed":{ "target": "awaiting_product", "actions": ["queue_owner"] },
        "evt:fidelity.residual":      { "target": "escalated", "actions": ["queue_owner"] }
      }
    },
    "implementing": {
      "invoke": { "process": "feature-to-tdd-impl" },
      "meta": { "determinism": "DL2", "autonomy": "auto" },
      "on": {
        "evt:impl.go":        { "target": "runtime_gate" },
        "evt:impl.no_go":     [ { "target": "remediation", "guard": "rounds_left" },
                                { "target": "escalated", "actions": ["queue_owner"] } ],
        "evt:impl.conflict":  { "target": "awaiting_product", "actions": ["queue_owner"] },
        "evt:impl.manual_verify": { "target": "escalated", "actions": ["queue_owner"] }
      }
    },
    "remediation": {
      "invoke": { "process": "validate-feature-impl" },
      "meta": { "determinism": "DL2", "autonomy": "auto", "counter": "remediation_rounds", "max": 2 },
      "on": { "evt:impl.go": { "target": "runtime_gate" },
              "evt:impl.no_go": [ { "target": "remediation", "guard": "rounds_left" },
                                  { "target": "escalated", "actions": ["queue_owner"] } ] }
    },
    "runtime_gate": {
      "invoke": { "process": "runtime-smoke-readiness" },
      "meta": { "determinism": "DL0", "autonomy": "auto" },
      "on": {
        "evt:runtime.ready_or_started": { "target": "done" },
        "evt:runtime.blocked_capability": { "target": "awaiting_capability", "actions": ["queue_owner"] },
        "evt:runtime.env_not_ready": { "target": "runtime_gate_retry" }
      }
    },
    "runtime_gate_retry": { "meta": { "determinism": "H", "autonomy": "human-gate" },
      "on": { "evt:env.up": { "target": "runtime_gate" } } },
    "awaiting_product":   { "meta": { "autonomy": "human-gate" },
      "on": { "evt:pa.resolved": { "target": "implementing" } } },
    "awaiting_capability":{ "meta": { "autonomy": "human-gate" },
      "on": { "evt:pa.resolved": { "target": "runtime_gate" } } },
    "escalated": { "meta": { "autonomy": "human-gate" },
      "on": { "evt:owner.resume": { "target": "implementing" },
              "evt:owner.abort":  { "target": "aborted" } } },
    "done":    { "final": true, "actions": ["project_fm_shipped_hint"] },
    "aborted": { "final": true }
  },
  "guards": {
    "wip_ok":      { "kind": "builtin", "ref": "wipOk" },
    "rounds_left": { "kind": "builtin", "ref": "counterBelowMax" }
  },
  "ingest": {                                            // материализация событий из run-результатов
    "batch-features-to-cc-sdd": [
      { "when": { "path": "blocked", "nonEmpty": true }, "emit": "evt:spec.blocked" },
      { "default": true, "emit": "evt:spec.authored" }
    ],
    "audit-spec-fidelity": [
      { "when": { "path": "product_routed", "nonEmpty": true }, "emit": "evt:fidelity.product_routed" },
      { "when": { "path": "residual", "nonEmpty": true },       "emit": "evt:fidelity.residual" },
      { "when": { "path": "impl_ready", "nonEmpty": true },     "emit": "evt:fidelity.impl_ready" }
    ],
    "feature-to-tdd-impl": [
      { "when": { "path": "conflicts", "nonEmpty": true },      "emit": "evt:impl.conflict" },
      { "when": { "path": "gate.result", "eq": "GO" },          "emit": "evt:impl.go" },
      { "when": { "path": "gate.result", "eq": "NO-GO" },       "emit": "evt:impl.no_go" },
      { "when": { "path": "gate.result", "eq": "MANUAL_VERIFY_REQUIRED" }, "emit": "evt:impl.manual_verify" }
    ],
    "validate-feature-impl": [
      { "when": { "path": "conflicts", "nonEmpty": true }, "emit": "evt:impl.conflict" },
      { "when": { "path": "result", "eq": "GO" },     "emit": "evt:impl.go" },
      { "when": { "path": "result", "eq": "NO-GO" },  "emit": "evt:impl.no_go" },
      { "when": { "path": "result", "eq": "MANUAL_VERIFY_REQUIRED" }, "emit": "evt:impl.manual_verify" }
    ],
    "runtime-smoke-readiness": [
      { "when": { "path": "verdict", "eq": "BLOCKED_ON_CAPABILITY" }, "emit": "evt:runtime.blocked_capability" },
      { "when": { "path": "verdict", "eq": "ENV_NOT_READY" },         "emit": "evt:runtime.env_not_ready" },
      { "when": { "path": "verdict", "in": ["READY_TO_SMOKE"] },      "emit": "evt:runtime.ready_or_started" },
      { "when": { "path": "verdict", "eq": "NOT_STARTABLE" },         "emit": "evt:fidelity.product_routed" }
    ]
  }
}
```

Семантические решения:
- **`invoke` = запуск существующего Workflow-процесса** (SCXML-аналогия `<invoke>`/`done.invoke`).
  Fabric не знает, что внутри — только контракт результата (ingest-маппинг). Иерархичность
  statechart'а достигается композицией: charter (верх) ↔ Workflow (низ), без вложенных
  charter-регионов в v1 (parallel-регионы — отложены до реальной нужды, YAGNI).
- **События — только материализация structured-результатов** (пути в JSON результата процесса,
  который диспетчер уже пишет в run-ledger `--result-file`). Ни одного «LLM решил, что событие
  случилось» — «первое правило» из доклада (FSM снаружи NDSM) соблюдено буквально.
- **Массив кандидатов на событие** (XState-семантика): переходы проверяются по порядку, первый
  прошедший guard выигрывает; последний без guard — fallback. Так выражаются bounded loops на
  уровне charter'а (счётчик входов в состояние + guard `rounds_left`), зеркаля bounded rounds
  внутри P5/P6.
- **`actions`** — только детерминированные встроенные эффекты engine'а (queue_owner → запись в
  owner-queue + pending-actions-строка; project_fm_shipped_hint → prescription продуктовой
  сессии, НЕ прямая правка `.product/` — граница «Оркестратор не редактирует .product» цела).

### 4.3 Engine: API и контракт детерминизма

`orchestrator/lib/fabric-engine.cjs` — конвенции репо: Node stdlib only, pure-core + CLI shell,
dual-use (require для юнитов), timestamps — только входами (`--at ISO`, дисциплина run-ledger),
instance-id детерминирован из (charter, subject, at) — base36, без Math.random (рифма deriveRunId).

Pure-core (юнит-тестируемое сердце):
```
transition(charter, snapshot, event, payload) → { next, effects[], why[] }
applyIngest(charter, processName, resultJson) → events[]          // маппинг результата в события
resolveDisposition(stateMeta, riskCtx, policy) → F1 resolve(...)   // потребляет autonomy-policy
guards: wipOk(limits, laneCounts), counterBelowMax(snapshot, meta) // builtin, чистые
```

CLI shell (тонкий, FS только здесь):
```
init   --charter <f> --subject FM-003 --at ISO         → создаёт инстанс (state.json, events.ndjson)
ingest --instance <id> --process <name> --result-file r.json --at ISO
                                                        → events[] → серия tick'ов
tick   --instance <id> --event evt:… [--payload json] --at ISO
                                                        → переход + persist + prescriptions (stdout JSON)
status [--all]                                          → инстансы, состояния, owner-queue (приоритизированная)
replay --instance <id>                                  → пересборка state из events.ndjson (аудит/восстановление)
```

- **Event-sourcing:** events.ndjson — единственный источник истины; state.json — материализованный
  снапшот (replay обязан его воспроизводить бит-в-бит; юнит-тест). `why[]`-цепочка на каждом
  переходе — replayable-аудит (тот же контракт, что F1 `why[]` и ledger).
- **Prescriptions** — выход tick'а, JSON: `{ kind: run-process|human-gate|wait|none, process?,
  argsHint?, paEntry?, dueHint? }`. Engine ничего не исполняет сам; предписание подхватывают
  актуаторы (§4.4). Диспозиция каждого предписания прогнана через F1 → floor/human-gate не
  обходимы кодом Fabric by construction.
- **Идемпотентность:** повторный `ingest` того же run-id — no-op (dedup по run-id в events).
  Закрывает idempotency-дыру §2-bis SPEC на межпроцессном уровне.

### 4.4 Актуаторы (как предписания исполняются в не-демонической среде)

| Канал | Когда срабатывает | Что делает |
|---|---|---|
| Диспетчер `/orchestrator:run` | сразу после `run-ledger finish` | +2 строки контракта: `fabric ingest` → полученные prescriptions либо исполняет (run-process при disposition=auto), либо озвучивает владельцу |
| SessionStart-hook | старт любой сессии в проекте | инжект сводки `fabric status`: активные инстансы + top owner-queue (прецедент rails-инжекта; warn-only, не блокирует) |
| pending-actions.md | human-gate prescription | engine-shell дописывает PA-строку (существующий канал OD7); резолюция PA → `tick evt:pa.resolved` руками/диспетчером |
| cron/routine (опционально, фаза 3) | temporal (staleness refresh_by, deferred re-check) | `fabric status --due` → уведомление; НЕ автозапуск процессов |

Честная граница: между сессиями Fabric «спит» — но состояние durable, и любая следующая сессия
начинает с машинного «где мы» вместо реконструкции по хвостам доков. Это ровно урок RUN 01
(«скелет должен быть экстернализованной структурой, не контекстом»), поднятый на уровень выше.

### 4.5 Backpressure (extended state)

- `limits.json`: `{ lanes: { orchestrator: { wip: 1 }, product: { wip: 2 } }, owner_queue_soft_cap: 7 }`.
  WIP=1 на orchestrator-lane кодифицирует уже действующее правило FB-004 (один
  orchestrator-workflow на repo) — сегодня оно держится на прозе.
- Guard `wip_ok` отклоняет `evt:line.start` → инстанс остаётся в `queued`-семантике (why[]
  фиксирует причину). Освобождение lane (final-состояние другого инстанса) → prescription
  «можно стартовать очередника».
- **Owner-queue** — федерация человеческих гейтов: каждая human-gate prescription попадает в
  `owner-queue.json` с приоритетом (floor > conflict-escalation > gate-approve > review-batch)
  и источником. `fabric status` показывает ЕДИНУЮ очередь. Soft-cap: при переполнении engine
  предписывает «стоп новым line.start» (давление вверх по конвейеру — классический backpressure,
  применённый к вниманию владельца).

---

## 5. Варианты технической реализации (рассмотрено и отвергнуто/принято)

| Вариант | Вердикт | Почему |
|---|---|---|
| **Собственный микро-интерпретатор .cjs (выбран)** | ✅ | Конвенция репо (Node stdlib, pure-core, юниты — как coverage-oracle/F1); ~300-500 строк; полный контроль контракта детерминизма (timestamps-as-inputs, event-sourcing); ноль новых зависимостей |
| XState v5 как dependency | ❌ сейчас | Даёт actor-model/parallel/history из коробки — но 90% этого не нужно v1; тянет npm-dep в zero-dep слой; персистентность+determinism-контракт всё равно писать самим; формат charter'а держим XState-совместимым по духу — миграция открыта, если v2 упрётся в parallel-регионы |
| n8n / внешний durable-оркестратор | ❌ (как и решено DEC-DEV-0058) | Развилка уже пройдена: подключать, когда конкретный процесс потребует cross-session событийности, которую не закрывают хуки+cron. Fabric снижает эту потребность (durable state есть, wake — по факту сессий) |
| LangGraph/Temporal-стиль граф-раннер | ❌ | Дублирует in-harness Workflow (он и есть граф-раннер run-уровня с resume-кэшем); межпроцессный слой не требует их durability-машинерии |
| «Просто больше хуков» (без движка) | ❌ как система, ✅ как транспорт | Хуки — сенсоры/инжекторы, у них нет ни состояния, ни модели переходов; N хуков с ad-hoc логикой = размазанный недо-FSM (текущее состояние и есть его предел) |

---

## 6. Двухуровневая вложенность исполнения (как строим и как работает)

- **Build-time (эта волна):** main-сессия (оркестрация+ревью) → уровень 1: opus-исполнители
  (engine, charter, тесты) и opus-верификаторы (адверсариальная панель) → уровень 2:
  суб-агенты исполнителей на точечную разведку (Read-фан-аут по конвенциям repo). Мёрж и
  прогон `npm run verify` — main.
- **Run-time (целевое):** charter (уровень 0, межпроцессный) → invoke Workflow-процесса
  (уровень 1, внутрипроцессный FSM) → role-агенты/оракулы (уровень 2). Каждый уровень
  детерминирован в своей зоне; суждение — только в листьях (agent()-вызовы).

---

## 7. Манифест детерминизма DL0–DL3/H (стратегия «жёсткость по механичности»)

Шкала (применена в [`catalog.yaml`](catalog.yaml) к каждому шагу каждого процесса):

| Класс | Природа шага | FSM-контроль | Исполнитель | MDP-модель |
|---|---|---|---|---|
| **DL0** | детерминированный скрипт | engine/скрипт исполняет и судит | .cjs оракул | — |
| **DL1** | процедурный LLM (точный бриф, механика) | вход/выход schema + строгий бриф; ретрай по схеме | agent(sonnet/haiku) | sonnet↓ |
| **DL2** | judgment LLM (ревью, классификация, аудит) | schema-вердикт + verify-before-act + bounded rounds | agent(opus) / персона | opus |
| **DL3** | творческий LLM (авторинг, discovery, дизайн) | ТОЛЬКО рамка: вход-контракт, выход-контракт, итерации не микроменеджатся | agent(opus) / main | opus/main |
| **H** | человеческое решение | wait-состояние + owner-queue + floor | человек | — |

Манифестация детерминизма = **какой слой контролирует переход**: DL0 — код целиком; DL1 —
код держит контракт, LLM исполняет; DL2 — LLM судит, код держит границы (rounds/schema/эскалация);
DL3 — код держит только вход/выход и WIP; H — машина замирает. Это обобщение того, что P5 уже
делает per-task (gate-risk HIGH/LOW), на все процессы каталога. Связка: determinism-класс шага →
(MDP-тир модели, F1 risk-вход, глубина FSM-контроля) — три ранее независимых механизма получают
один источник.

---

## 8. Согласование с принятым Vision (не поперёк, а внутрь)

- **Развилка «б» (cross-session durable engine, BATCH_2 — отложена)** — Fabric и есть ответ:
  durable state без демона; n8n остаётся отложенным.
- **F2-wiring** — «wiring в orchestrator-гейты требует сверки с оркестратор-треком»
  (DEC-DEV-0145): Fabric = место этой сверки; disposition каждой prescription идёт через
  `autonomy-policy.cjs`; audit-trail `why[]` персистится в events.ndjson (кандидат из
  F1-контракта §6 подтверждён).
- **Epic E (coordinate-only)** — charter `feature-production-line` = формализация «сегмента
  конвейера до прода» с контрактом E (floor через F1, prod=human-gate) без строительства
  D3-инструментов (они substrate-gated как были).
- **Epic C/G** — макро-шаги продукта и матрица участия персон становятся charter'ами/meta
  без новой механики.
- **MAP/BPMN-карта** — catalog.yaml + charters становятся источником для генератора карт
  (следующая итерация gen-process-map; в этой волне НЕ трогаем — cuttable).

---

## 9. План имплементации

**Фаза 1 (эта волна, built):**
1. `orchestrator/lib/fabric-engine.cjs` — pure-core + CLI (init/ingest/tick/status/replay).
2. `orchestrator/charters/feature-production-line.json` — первый charter (E2E фичи).
3. `tests/orchestrator/fabric-engine.test.cjs` — детерминизм transition, replay==snapshot,
   bounded #max, wip-guard, ingest-маппинг P3–P7 результатов, идемпотентность ingest, F1-floor
   непробиваемость. Вход в `npm run verify` через `test:orchestrator`.
4. Каталог + аудит + этот концепт (dev/process-fabric/).

**Фаза 2 (следующая волна, по итогам ревью владельца):**
5. Диспетчер-wiring: +ingest/tick в `run.md` (2 строки контракта) — отдельным PR, т.к. трогает
   поведение живого диспетчера.
6. SessionStart-инжект `fabric status` (warn-only hook).
7. Charter №2: product-front поток (P1→P2→handoff) — прежде всего для owner-queue федерации.

**Фаза 3 (pilot-gated):**
8. Live-прогон на пилоте `my-first-test` (live-run-validation чеклист, класс B).
9. **Graduation gate (substrate-дисциплина DEC-DEV-0148):** Fabric считается validated только
   после: (a) один полный инстанс feature-production-line прожил ≥2 сессии с restore из
   state.json; (b) минимум один NO-GO→remediation→GO переход прошёл машинно; (c) один
   human-gate через owner-queue разрешён и продолжил инстанс. До этого — built ≠ validated.
10. Temporal-актуатор (cron staleness) + gen-process-map интеграция — по live-нужде.

**Cuttable по умолчанию:** parallel-регионы, history-состояния, charter для D7-мета-процессов,
XState-миграция, единый UI. Не строим до эмпирического запроса.

---

## 10. Риски и рельсы

| Риск | Рельс |
|---|---|
| Charter-дрейф от реальных процессов | ingest-маппинг привязан к фактическим полям результатов (тесты фиксируют контракт); catalog CI-реконсиляция; charter'ов мало (1-2), не 50 |
| Двойная правда с Workflow | жёсткая граница: Fabric не знает шагов внутри процесса, только контракт результата |
| «Тихая автономия» через prescriptions | каждая prescription через F1; floor built-in; run-process исполняет только диспетчер (человек видит) |
| Оверинжиниринг (болезнь meta-проекта) | v1 = 1 движок + 1 charter + тесты; graduation gate до расширения; каталог — реестр, не 100 charter'ов |
| Состояние врёт (двойной источник) | event-sourcing: events.ndjson первичен, state.json — материализация, replay-тест |
| Windows/кроссплатформенность | path.join, никаких shell-измов (конвенция run-ledger) |
