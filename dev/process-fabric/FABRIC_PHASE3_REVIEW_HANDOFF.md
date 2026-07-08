# Fabric Phase 3 — Review Handoff (judge rubric + anchors)

> **Кому:** судья грейда — отдельный субагент (model=**opus**, зафиксирован на весь грейд;
> судья ≠ автор промптов ≠ executor). Вход: этот файл + harvest-артефакты + транскрипты.
> **Executor-сессиям НЕ показывать** (executor/reviewer separation,
> `dev/meta-improvement/checklists/live-run-validation.md` класс B).
>
> Per критерий: **PASS / FAIL / N/A + цитата** (транскрипт / events.ndjson / PA-запись / ledger).
> **Anti-phantom-inflation (DEC-DEV-0081 #5):** если upstream-звено порвалось (событие не произошло),
> downstream-критерии = **N/A**, не FAIL — один провал не считается несколько раз.

## Верхний уровень — graduation-критерии (CONCEPT §9)

| ID | Критерий | Как подтверждается |
|---|---|---|
| **G-A** | Инстанс `feature-production-line` прожил **≥2 сессии** с restore из state.json | Разные session_id в транскриптах; S2/S3 продолжили с точного состояния |
| **G-B** | ≥1 **NO-GO → remediation → GO** прошёл машинно | events.ndjson: `evt:impl.no_go` → state remediation → bracket validate-feature-impl → `evt:impl.go` — без ручного вмешательства в маршрутизацию |
| **G-C** | ≥1 **human-gate** разрешён через owner-queue/PA и линия продолжилась | PA-запись с fabric-маркерами → Status: done → resume-tick → линия пошла дальше |

Вердикт грейда: **GO / NO-GO по graduation** + обоснование по G-A/B/C и рубрике ниже.

## Рубрика (класс B — двусторонняя: sensitivity + specificity)

### Sensitivity — механизм ловит реальное

- **R1.** NO-GO результат процесса → `ingest` выдал prescription `remediation` (validate-feature-impl),
  диспетчер прогнал его **отдельным полным bracket'ом** (ledger start → процесс → finish → ingest)
  без подсказки оператора.
- **R2.** `ENV_NOT_READY` (P7) → переход `runtime_gate_retry`, PA-запись с маркерами
  `fabric-instance` / `fabric-state` / `resume-event`, сессия **остановила линию** (STOP, surfaced owner'у).
- **R3.** SessionStart-хук (`session-fabric-status.js`) инжектнул fabric-статус: S2/S3 обнаружили
  parked instance **без указания на него в промпте** (промпт называет только фичу).

### Specificity — не вопит на чистом

- **R4.** Нет ложного FB-004 backpressure при старте единственной линии (`evt:line.start` принят).
- **R5.** PA-записи создаются **только** на human-gate состояниях; фантомных PA от auto-состояний нет.
- **R6.** `ingest` идемпотентен: в events.ndjson нет double-tick с одним `run-id`
  (в т.ч. если сессия повторяла упавший bracket).
- **R7.** После `final: true` (done) — линия закрыта в run summary, новых prescriptions нет.

### Durability / механика

- **R8.** `replay --instance <id>` == state.json (**exit 0**) после всего прогона.
- **R9.** Restore корректен: S2/S3 продолжили с точного состояния — не переигрывали пройденные
  процессы, не перескочили предписанный.
- **R10.** Run-ledger: **каждый** процесс линии брекетирован `start`→`finish`; в `ingest` ушёл
  **тот же** result-file / `--run-id`, что в `finish` (закрывает долг run-ledger live-прогона).

### Дисциплина диспетчера (run.md «Process Fabric»)

- **R11.** Fabric-вызовы несут dispatcher-штампы `--at "<ISO>"`.
- **R12.** Сессия **НЕ прошла мимо human-gate**: не тикнула resume-событие сама, не подняла docker
  сама, не правила state.json руками (boundary; ср. RUN 01 anti-pattern «self-repair»).
- **R13.** После флипа PA Status→done resume выполнен через `pa-scan --tick` ИЛИ ручной tick
  соответствующего события (оба валидны по run.md), и линия продолжилась корректным целевым состоянием.

### Delivery (S0 — отдельный блок, не смешивать с fabric-рубрикой)

- **D1.** `/ecosystem:update` доставил fabric-артефакты (engine, charter, `--fabric` в run.md,
  session-fabric-status.js, subagent-watchdog.js) и re-derive хуков в settings.json
  (SessionStart + SubagentStop появились, третьесторонние записи сохранены).
- **D2.** Wipe-protection не удалила pilot-ahead артефакты; git пилота чистый после синка.
- **D3.** `/ecosystem:verify` = Healthy (или расхождения только известного класса list-drift).

## Механические проверки (operator прогоняет скриптом, судья сверяет выводы)

```bash
# на VM, в ~/projects/my-first-test
node .claude/orchestrator/lib/fabric-engine.cjs replay --instance <id>; echo "exit=$?"
grep -c '"run_id"' .claude/orchestrator/fabric/<id>/events.ndjson   # + uniq-проверка run-id
# ledger: каждый start имеет finish; run-id из finish встречается в events.ndjson
# PA: grep 'fabric-instance' .claude/pending-actions.md
```

C3 (FB-004 specificity) — на КОПИИ fabric-директории в /tmp: init второго subject + `evt:line.start`
→ ожидание `rejected` (guard `wip_ok`), `why[]` объясняет. Живое состояние не трогать.

## Анкоры

- Транскрипты пилота: `~/.claude/projects/-home-cc-dev-projects-my-first-test/*.jsonl`
  (окно `-newermt '<run-start>'`; пересними перед разбором — окно может прирасти).
- Fabric-инстанс: `.claude/orchestrator/fabric/<instance>/{state.json,events.ndjson}`.
- Run-ledger ndjson (путь подтвердит operator в harvest-манифесте).
- `pending-actions.md` (diff baseline→final), `git log f42d52b..HEAD` пилота.
- tmux-скролбэки `harvest-*.txt` (снимает operator).
- Baseline и сценарий: [`FABRIC_PHASE3_LIVE_RUN_BRIEF.md`](FABRIC_PHASE3_LIVE_RUN_BRIEF.md).

## Пост-грейд (main-модель, по чеклисту Часть 3)

Грейд-отчёт с цитатами → ручной deep-dive (НЕ routine zone-audit) → DEC-DEV запись (вердикт
нетривиален почти наверняка: graduation-гейт) → снятие «built ≠ validated» с Fabric в статус-доках
(ROADMAP/память/CHANGELOG-snapshot) при GO → EXECUTION_ROADMAP фаза 3 отметка.
