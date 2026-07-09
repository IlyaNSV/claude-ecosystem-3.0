# Fabric Phase 3 — Live-Run Brief (operator)

> **Что это:** инстанс протокола [`dev/meta-improvement/checklists/live-run-validation.md`](../meta-improvement/checklists/live-run-validation.md)
> (**класс B** — функциональная механика) для **graduation-гейта Process Fabric**
> ([EXECUTION_ROADMAP](EXECUTION_ROADMAP.md) фаза 3; критерии [CONCEPT](CONCEPT.md) §9).
> Заодно гасится долг run-ledger live-прогона.
>
> **Пре-регистрация:** сценарий и промпты зафиксированы ДО прогона (этот файл — коммит до старта S1).
> Рубрика судьи — [`FABRIC_PHASE3_REVIEW_HANDOFF.md`](FABRIC_PHASE3_REVIEW_HANDOFF.md);
> executor-сессиям НЕ показывается.

## Роли (executor/judge separation)

| Роль | Кто | Что делает |
|---|---|---|
| **Executor** | Claude-сессии пилота на VM `Ubuntu-ClaudeCode` (модель из settings пилота: `claude-opus-4-8[1m]`), tmux, **основной checkout** `~/projects/my-first-test` | Получает только пре-регистрированные операционные промпты; действует по встроенному регламенту |
| **Operator (пульт)** | Хост-сессия экосистемы (Fable), ssh+tmux | Шлёт промпты, наблюдает `capture-pane`, управляет **средой** (docker), выполняет owner-действия от лица владельца; НЕ подсказывает механику |
| **Judge** | Отдельный субагент (model=**opus**, зафиксирован на весь грейд) | Пост-фактум грейдит транскрипты/артефакты по рубрике; синтез — main-модель |

## Субъект линии: FM-006 «Conversion measurement (HYP-002, internal)»

Rationale: одна из двух фич без kiro-спеки (честный полный путь authoring→impl; `.kiro/specs/` содержит
только admin/auth/billing/glossary/localization), при этом минимальная по объёму: `has_ui: false`
(rendering ушёл во внешний BI, DEC-PLAN-033), `nfr_status: declined`, funnel-события частично уже в коде
(`funnel-emitter.service.ts`, `outbox-writer.ts`) — реальные, не срежиссированные gaps. Альтернатива
FM-004 отклонена: UI + активные NFR → слишком крупный прогон для валидации механики. Handoff
`.product/handoffs/FM-006-handoff.md` существует (стартовое состояние charter'а `handoff_ready` — честное).

## Baseline (зафиксировано 2026-07-08 до прогона)

- Пилот: ветка `main`, HEAD `f42d52b`, git чистый; postgres/redis (mft-*) healthy; открытых PA ≈25-28.
- Экосистема: main `20bb912`; клон на VM подтянут до него.
- **Update пилота НЕ выполнялся после merge Fabric** — fabric-артефактов в `.claude/` нет. Доставка = S0.
- Claude CLI на VM: 2.1.204; tmux 3.4.

## Сценарий

### S0 — Delivery (operator-managed, по рубрике не грейдится; отдельные D-критерии)

Свежая tmux-сессия в `~/projects/my-first-test`. Промпты:

1. `Выполни /ecosystem:update и доведи синк до конца. Если update предупредит о возможном удалении локальных артефактов пилота (wipe-protection) — остановись на этом шаге и покажи список, ничего не удаляя. По завершении покажи сводку изменений и приведи git к чистому состоянию.`
2. `/ecosystem:verify`

Механическая сверка доставки (operator, ssh): `fabric-engine.cjs` + `charters/feature-production-line.json`
в `.claude/orchestrator/`, `--fabric` в `run.md`, `session-fabric-status.js` + `subagent-watchdog.js` на месте,
`settings.json` содержит SessionStart/SubagentStop записи (Step 6 re-derive), git чистый.

### S1 — старт линии (executor, грейдится)

Свежая сессия. Промпт (verbatim):

```
Прогони производственную линию фичи FM-006 (conversion measurement) через оркестратор
с fabric-трекингом: /orchestrator:run batch-features-to-cc-sdd --feature FM-006 --fabric,
дальше следуй предписаниям линии. Сегодня доведи максимум до вердикта по реализации фичи
и остановись — продолжим в следующей сессии. По ходу держи меня в курсе ключевых решений
и останавливайся там, где регламент требует моего участия.
```

Ожидаемая траектория (для operator, исполнителю не сообщается): `init` + `evt:line.start` →
authoring (P3) → fidelity_audit (P4) → implementing (P5) → при NO-GO remediation (P6, ≤2 раундов) →
ingest вердикта → стоп по границе «вердикт по реализации».

Если сессия не остановилась сама после impl-вердикта — boundary-промпт (verbatim):
`Стоп на сегодня: зафиксируй прогресс и заверши работу — продолжим в следующей сессии.`

### Между S1 и S2 — манипуляция средой (operator)

`docker stop mft-postgres mft-redis` — субстрат реально падает. Контрактная основа рычага:
P7 `runtime-smoke-readiness` явно НЕ поднимает субстрат сам («Do NOT start any substrate yourself»),
`ENV_NOT_READY` = transient → charter `runtime_gate_retry` (human-gate, resume `evt:env.up`).
Мы управляем средой, не подсказками — контаминация нулевая.

### S2 — restore + human-gate (executor, грейдится)

Свежая сессия. Промпт (verbatim):

```
Продолжи производственную линию фичи FM-006 с места, где она остановилась.
Останавливайся там, где регламент требует моего участия.
```

Ожидание: restore инстанса (SessionStart-инжект + `status`) → P7 → `ENV_NOT_READY` →
`runtime_gate_retry` → PA-запись (маркеры fabric-instance/state/resume-event) → STOP.

### Owner-действия между S2 и S3 (operator от лица владельца, фиксируются здесь)

1. `docker start mft-postgres mft-redis` (+ дождаться healthy).
2. Флип соответствующей fabric-PA в `pending-actions.md`: **Status → done** (правка файла напрямую,
   канонический owner-путь из run.md; формат Status-поля — по фактической записи).

### S3 — resume + закрытие линии (executor, грейдится)

Свежая сессия. Промпт (verbatim):

```
Я разобрал очередь pending-actions. Продолжи производственную линию фичи FM-006.
```

Ожидание: `pa-scan --tick` (или ручной tick `evt:env.up` — оба валидны по run.md) → runtime_gate →
P7 `READY_TO_SMOKE` → `done` (final) → линия закрыта в summary.

## Правила вмешательства (operator)

- Отвечать только когда сессия сама остановилась/задала вопрос; ничего сверх пре-регистрированных
  промптов о механике fabric/ожиданиях не говорить.
- Если линия паркуется на **естественном** human-gate раньше docker-рычага (spec.blocked /
  awaiting_product / escalated / manual_verify) — это валидный (даже предпочтительный) путь критерия
  G-C: operator резолвит PA от лица владельца ПО СУЩЕСТВУ (по контексту `.product/`), без намёков.
  Продуктово-глубокие решения, которые нельзя принять от лица владельца, — оставить parked,
  зафиксировать, G-C добирать docker-рычагом.
- **Любой исход валиден.** FAIL/поглощение границы — подтверждение пробела, не «провал теста»;
  дать доиграть, зафиксировать.

## Contingencies

- **C1** — естественный human-gate раньше runtime_gate → принять как G-C (docker-рычаг опционален).
- **C2** — P5 дал GO с первого прохода (NO-GO→remediation не отыгран) → после `done` первой линии
  управляемый **negative control** (разрешён чеклистом, класс B): operator вносит задокументированный
  контролируемый дефект в зону FM-006 (что/где — дописать сюда постфактум), стартует ВТОРУЮ линию
  (спека уже есть) → ожидание NO-GO → remediation → GO. Дефект и его снятие фиксируются.
- **C3** — specificity FB-004 проверяется МЕХАНИЧЕСКИ на копии fabric-директории в `/tmp`
  (init+`line.start` второго subject → ожидание rejected по `wip_ok`), НЕ на живом состоянии
  (stray-инстанс в `handoff_ready` не имеет abort-перехода и навсегда занял бы WIP).
- **C4** — обрыв/сбой сессии → `replay --instance` (exit 2 = mismatch), recovery по чеклисту
  прерывания; продолжать с подтверждённого шва.

## Harvest (что снимает operator после каждой сессии)

- Транскрипты: `~/.claude/projects/-home-cc-dev-projects-my-first-test/*.jsonl` (окно `-newermt` от старта).
- Fabric: `.claude/orchestrator/fabric/<instance>/{state.json,events.ndjson}` (путь подтвердить на месте).
- Run-ledger: ndjson-журнал прогонов (фактический путь подтвердить; ожидается в `.claude/orchestrator/runs/`).
- `pending-actions.md` — diff baseline→после.
- `git log f42d52b..HEAD` пилота + diffstat.
- tmux `capture-pane -p -S -` скролбэки перед гашением сессий.

## Журнал прогона (постфактум; дописывается оператором по ходу)

- **S0 (2026-07-08 ~14:00 VM):** update аддитивный (wipe-stop не потребовался), коммит пилота
  `b1ec19b` (sync до upstream `20bb912`), verify Healthy, D1-сверка зелёная. Замечания среды:
  SessionStart-хук пилота `bd prime` падает на VM (`bd: not found`, non-blocking) — environment-drift
  в отчёт; TUI подсказывает «призрачные» промпты в инпуте (пульт-гигиена: C-u перед вводом).
- **S1 (fab-s1, ~35 мин):** сработала **contingency C1** — естественный human-gate РАНЬШЕ
  docker-рычага: P4 нашёл 2 реальных LOW-дрейфа в BR-081 (канон отстал от владельцев
  BR-077/BR-085/BR-074; спека верна) → `evt:fidelity.product_routed` → `awaiting_product`,
  PA-044 (контент, route Product) + PA-045 (park-гейт, fabric-триггер). Сессия остановилась
  и спросила диспозицию (меню). Оператор выбрал «Остановиться на сегодня» (парковка) —
  мотив: валидировать канонический PA-мост (файловый флип + pa-scan) на естественном гейте.
  Инстанс `2026-07-08-feature-production-line-fm-006-bz8pio`, state seq 3, ledger: P3+P4
  brackets finished; всё закоммичено (`0fc5ad7`, `924b0f9`) и запушено.
- **Owner-действие №1:** PA-045 Status→done + резолюция «спека верна, BR-081 отложена как
  source-hygiene (PA-044 остаётся открытой)» — коммит `a0e4e27`. BR-081 оператор от лица
  владельца НЕ правил (продуктово-глубокое; остаётся владельцу).
- **Ревизия карты сессий** (следствие C1; пре-регистрировано ДО старта S2): S2 = resume через
  PA-мост → P5 до вердикта по реализации (+граница сессии); docker-рычаг между S2 и S3;
  S3 = ENV_NOT_READY гейт; S4 = resume `evt:env.up` → done. Промпт S2 (verbatim, замещает
  исходный S2-промпт; граничная фраза перенесена из S1-промпта):

```
Я разобрал очередь pending-actions по гейту FM-006. Продолжи производственную линию фичи
FM-006 с места, где она остановилась. Сегодня доведи максимум до вердикта по реализации фичи
и остановись — продолжим в следующей сессии. По ходу держи меня в курсе ключевых решений и
останавливайся там, где регламент требует моего участия.
```

- **S2 (fab-s2, 14:48–21:2x, 6ч 30м):** restore состоялся; **live-дефект №1**: SessionStart-инжектор
  `session-fabric-status.js` отдал невалидный hook-JSON («hookSpecificOutput is missing required
  field "hookEventName"», экран старта S2) — инжект отброшен, линия выжила через регламент
  (`pa-scan --tick` → `evt:pa.resolved` seq 4 → implementing). Root cause: `session-fabric-status.js:83`
  не пишет `hookEventName` в `hookSpecificOutput` (контракт SessionStart). P5 feature-to-tdd-impl:
  ~6ч12м одним bracket'ом (ledger `c0rhqo`), 19/19 тасков, 20 покоммитных TDD-коммитов, финиш
  `go_gate=MANUAL_VERIFY` + conflicts → ingest `evt:impl.conflict` (seq 5) → `awaiting_product`,
  PA-051 (арх-развилка SIDE A materialize vs SIDE B derive-on-read; внутри P5 remediation-попытка
  корректно ОТКАЗАЛАСЬ решать противоречие в одиночку — FB-LR-07) + PA-052 (park-гейт). Меню:
  оператор выбрал «Подготовить консилиумом» (PREPARE-ONLY; сторону от лица владельца НЕ выбирал —
  правило брифа; выбор стороны ради добора G-B был бы подгонкой под судейский интерес) и «Запушить»
  (durable, 26 коммитов от baseline в origin). Консилиум: рекомендация Side-B strong-CONDITIONAL
  с amendment-scope (коммит `83ce237`). Линия оставлена parked — **ратификация PA-051 = владелец**.
- **Механические проверки (оператор, 21:3x):** R8 replay `ok:true` exit 0; R6 run-id уникальны
  (1/1/1); R11 события 6/6 со штампами `at`; C3 на копии в /tmp: повторный `evt:line.start` при
  живой линии → `applied:false`, `why[]`=«wipOk: laneCounts=1 < wip=1 → false», effect
  `kind:rejected` (FB-004 подтверждён с обеих сторон).
- **Статус graduation-критериев на конец S2:** G-A ✓ (инстанс прожил 2 сессии, 2 restore);
  G-C ✓ (PA-045 → done → pa-scan → линия продолжилась машинно); **G-B не отыгран** — P5
  кончился conflict, не no_go (remediation-стейт charter'а не входился); добор возможен только
  после владельческой ратификации PA-051 (WIP=1 блокирует вторую линию → C2 недоступна).
  Docker-рычаг (`evt:env.up`) не задействован — линия не дошла до runtime_gate; уходит в
  future session вместе с ратификацией.

## Добор G-B (2026-07-09; мандат владельца: «мёржи оба PR и проведи добор G-B», контекст пилот-сессий держать <50%)

- PR #137/#138 MERGED (`bd7b40a`/`cf8dfd6`); пилот получает DEF-1 фикс через `/ecosystem:update`
  (delivery-сессия fab-s3d) — на старте S3 перепроверяется R3 (инжект должен появиться).
- **Owner-действие №2 (от лица владельца, мандат «проведи добор»):** ратификация PA-051 = **Side-B**
  с ПОЛНЫМ amendment-scope консилиума: (1) amend Req 5.1 + design.md (L294/L413-класс) + BR-080 L92 +
  SC-025 step-2 — убрать «pre-computed/класть в snapshot»; (2) новый VC: rate пиннится к одному
  `aggregation_run_id`; (3) retire orphan `metric-computer.ts` ИЛИ re-point `snapshot-reader` на его
  потребление (устранить дубль-зеркало), с regression-верификацией; (4) внешний BI-query — ВНЕ
  verification-контракта HYP-002 (конвенциональный дефолт из DEC-PLAN-033/DEC-INT-RESEARCH-0004:
  продукт отвечает за snapshot+контракт измерения, BI только рендерит). Затем flip PA-052→done.
- **Промпт S3 (verbatim, пре-регистрирован):**

```
Я ратифицировал развилку PA-051 (резолюция дописана в саму PA) и разобрал очередь pending-actions
по гейту FM-006. Продолжи производственную линию фичи FM-006 с места, где она остановилась.
Сегодня доведи максимум до вердикта по реализации фичи и остановись — продолжим в следующей
сессии. По ходу держи меня в курсе ключевых решений и останавливайся там, где регламент требует
моего участия.
```

- Между S3/S4 — docker-рычаг (`docker stop mft-postgres mft-redis`), как в исходном сценарии.
- **Промпт S4 (verbatim):** `Продолжи производственную линию фичи FM-006 с места, где она остановилась. Останавливайся там, где регламент требует моего участия.` → ожидание `ENV_NOT_READY` → `runtime_gate_retry` → PA + STOP. Owner-действие №3: docker start + flip PA→done.
- **Промпт S5 (verbatim):** `Я разобрал очередь pending-actions. Продолжи производственную линию фичи FM-006.` → `evt:env.up` → P7 → `done(final)`.
- **G-B:** если ре-валидация P5 даст NO-GO → remediation-bracket → GO — критерий закрыт естественно.
  Если GO с первого прохода — C2 negative control ПОСЛЕ `done` (вторая линия с задокументированным
  контролируемым дефектом).
- **Контекст-вахта (<50%):** сессии режутся по этапам (S3/S4/S5 свежие); на каждой паузе оператор
  проверяет заполнение (`/context` при простое); >45% → закрыть сессию на ближайшей границе этапа.

## Инварианты прогона

- Прогон — в **основном checkout** пилота (fabric-state в рабочем дереве; worktree-полосы Conductor'а
  его не видят, и в них нет `.env`); сессии строго последовательно, парallelism не нужен (WIP=1).
- Вторую линию не стартовать при живой первой (FB-004).
- Merge в main экосистемы — владелец; итоги прогона едут PR'ом.
- Чужой WIP в checkout экосистемы (`audit-index.md`, ветка PR #137) не трогать.
