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

## Инварианты прогона

- Прогон — в **основном checkout** пилота (fabric-state в рабочем дереве; worktree-полосы Conductor'а
  его не видят, и в них нет `.env`); сессии строго последовательно, парallelism не нужен (WIP=1).
- Вторую линию не стартовать при живой первой (FB-004).
- Merge в main экосистемы — владелец; итоги прогона едут PR'ом.
- Чужой WIP в checkout экосистемы (`audit-index.md`, ветка PR #137) не трогать.
