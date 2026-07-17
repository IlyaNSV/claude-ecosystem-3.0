# ASSIST_LOG — опыт-ledger Волны 0 (Global Loop)

> Append-only ledger операционного опыта Волны 0 (`dev/global-loop/PLAN.md` §2): классы
> вопросов, эскалации, расход внимания, узкие места, отклонения от ожиданий. Назначение —
> сырьё для мандата v0 Кондуктора, H0-брифа и приоритетов H-фаз
> (`factory-conductor/CONDUCTOR.md` §roadmap).
>
> Режим фиксируется per-run: `assist` (владелец рулит из терминала, ассистент помогает) или
> `autonomous-conductor` (кондуктор-сессия рулит сама — директива владельца 2026-07-17;
> форма Волны 0 изменена владельцем, данные для ledger те же).

## Формат записи

```
### <RUN-ID>.<N> — <ts, UTC+3> — <class>
- mode: assist | autonomous-conductor
- action: что сделано (команда/промпт/ответ; длинные промпты — ссылкой на сохранённый файл)
- target: сессия/полоса/файл (tmux-имя, путь на VM или хосте)
- expectation → actual: что ожидал → что вышло; расхождение помечать `DEVIATION:`
- evidence: транскрипт / commit sha / PR# / файл (транскрипты VM —
  `~/.claude/projects/-home-cc-dev-projects-my-first-test/*.jsonl`; harvest на хост —
  `C:\Users\pw201\WebstormProjects\vm-harvests\<RUN-ID>\`)
- qa: вопросы, заданные экосистемой/сессией, и данные ответы + класс
  (mechanical-ack | gate-approve(dev) | fork-decision | owner-class→эскалация)
- attention: ~мин оператора на запись / заметный токен-расход
```

Классы записей: `dispatch` (запуск процесса/сессии) · `qa-answer` (ответ на вопрос сессии) ·
`escalation` (вынесено владельцу) · `observe` (снятие состояния) · `deviation` (расхождение
ожидание/факт) · `provision` (ключи/ресурсы) · `admin` (setup/гигиена).

Правила ведения: I-4 — промпт-файл сохраняется ДО send; I-3 — ghost-протокол при любом
tmux-вводе; floor `{prod_deploy, destructive, spend_money, provision_real_secret}` не
пробивается — provision ключей идёт по явной директиве владельца 2026-07-17 и каждый случай
логируется классом `provision` (сам секрет в ledger НЕ пишется — только факт и источник);
§0-проба занятости VM перед каждым разрушающим действием (vm-factory-ops).

---

## RUN-2026-07-17-A — автономный прогон кондуктора: первый релиз пилота (dev-контур)

**Директива владельца (2026-07-17, вводная):** довести до конца первый релиз тестового
пилотного проекта (dev-контур, локальный запуск); роль кондуктора исполняет Claude-сессия
ecosystem (эта); предварительно изучить инструменты экосистемы и собрать стартовый контекст;
вести журнал с ссылками на логи; фиксировать промежуточные результаты (продуктовые коммиты,
PR), где сработало как ожидалось и где нет; ключи искать в старых проектах (OpenAI — в
доработке статуслайна).

**Границы прогона:** merge в `main` ecosystem / factory-conductor — только владелец;
финальный флип `RL.status: released` — только owner ratify (DoD-терминатор, DEC-DEV-0216);
внутри пилота на VM (dev-контур) — полный цикл делегирован кондуктору. Критерий остановки
прогона = DoD-скелет 6 категорий (`dev/release-dod/TRACK.md` §5) зелёный + пакет на
ратификацию владельцу.

### RUN-A.1 — 2026-07-17 04:20–04:35 — admin (вход в трек + setup)
- mode: autonomous-conductor
- action: SEAM-ACK по `dev/global-loop/SEAM.md` (6 обязательных чтений выполнены main-моделью;
  ответы на 5 контрольных вопросов доставлены владельцу в сессии); верификация состояния по
  git (R0 не сделан: DoD-секции в `docs/pmo/artifacts/RL.md` нет; чекаут main `c35ec61`,
  1.12.2 доставлен); загружен скилл `vm-factory-ops`; §0-проба VM; созданы worktree
  `ce3-wt-global-loop` + этот ledger. Recon делегирован по MDP (2× sonnet): шпаргалка
  инструментов экосистемы (каталоги/контракты команд) и слепок состояния пилота на VM.
- target: хост-репо ecosystem; VM (read-only проба)
- expectation → actual: VM свободна → ПОЧТИ: tmux/claude-процессов нет, но транскрипт пилота
  трогали в 04:25 (за 8 мин до пробы) при live-сессий = 0 — чья-то сессия только что
  завершилась. Разрушающих действий не планировалось; отмечено как сигнал «сосед недавно
  работал», перед первым dispatch проба повторяется.
- evidence: проба §0 (вывод в транскрипте этой сессии); `git log origin/main -1` = `c35ec61`
- qa: —
- attention: ~15 мин сессии кондуктора
- ПРОТОКОЛЬНАЯ ОГОВОРКА: ledger создан в том же ходу, которым доставляется SEAM-ACK (правка
  до прочтения ACK владельцем) — сознательное отклонение от буквы «ACK до первой правки»:
  файл предписан самим швом (шаг 3), дёшево-обратим, канон не тронут; правки канона (R0) —
  только после доставки ACK.

### RUN-A.2 — 2026-07-17 04:45 — observe (слепок пилота, recon-интеграция)
- mode: autonomous-conductor
- action: recon-субагент (sonnet, read-only ssh) снял состояние пилота; результат отревьюирован main
- target: VM my-first-test (read-only)
- expectation → actual: ожидал живой RL-002 (по памяти трека) → ФАКТ: первый релиз = RL-001
  (v1.0 MVP, status planned, 7 MUST FM-001..007, target 2026-07-29); RL-002 не существует
  (8 NOTE-упоминаний). Прогон ведёт RL-001. FM-статусы: shipped только FM-006; FM-001..005,007
  in-progress; handoffs ready: FM-003/005/007, partial: FM-001/002/004, stale: FM-006.
  Fabric/owner-queue пусты; PA 68 (26 pending, топ — integrator scope-guard write violations);
  run-ledger 33 прогона, последний lzg7rk DEPLOYED 07-15 (до того BLOCKED-серия из-за
  PORT=70000 в shared/.env), rollback l9zt0w ROLLED_BACK 07-14; docker mft-postgres/mft-redis
  healthy; пилот на 1.12.2 (sync 6965aa2) = хостовому канону, skew минимален.
- DEVIATION-заметки (в прогоне НЕ чинить канон; пилотные — в очередь работ): README пилота
  врёт версию (1.6.0/2026-06-18); .claude/ecosystem-version пуст; FM-006 handoff старее
  shipped-флипа; git пилота не чист (modified ledger.ndjson/active-tools.yaml/project-journal.md
  + untracked run-каталоги lymzao/lzg7rk — похоже на незакоммиченный осадок deploy-сессий);
  env-readiness READY при единственном skip-check (docker-daemon: no compose file) — вердикт
  «по умолчанию», тонкая проба.
- evidence: отчёт recon в транскрипте этой сессии; транскрипты пилота 3 шт 17-jul (04:25 / 02:31 / 01:44)
- qa: —
- attention: ~10 мин (recon ~4 мин фоном, 139k токенов субагента)
