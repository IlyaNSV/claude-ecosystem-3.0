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

### RUN-A.3 — 2026-07-17 05:05 — observe + admin (сенсоры, R0 = PR #229)
- mode: autonomous-conductor
- action: (1) сенсор-recon (sonnet): status-collector.cjs и impl-evidence.cjs прогнаны на пилоте
  read-only; run.json деплоев lymzao/lzg7rk разобраны; .kiro-спеки и deploy-capability
  инвентаризованы; (2) единица R0 исполнена на хосте: термин Release DoD + опциональная
  6-категорийная body-секция в спеке RL (DEC-DEV-0221) → PR #229 (merge — владелец).
- target: VM (read-only) + хост-worktree ce3-wt-r0-dod
- expectation → actual: ожидал «6 FM почти готовы» → УТОЧНЕНИЕ: impl-evidence даёт
  ready-to-ship по 6 FM (fabric done + внешние спеки + V-01), но run-ledger показывает, что
  через конвейер P3-P7 реально прошла только FM-006 (33 прогона, P6 GO, DEPLOYED
  20260715T112801Z, rollback ROLLED_BACK 07-14); формальных P6-вердиктов у FM-001..005/007
  НЕТ → DoD cat.2 честно ❌, очередь = P6-батч по 6 FM. DEVIATION (класс для мандата):
  сенсор ready-to-ship без latest_gate — расхождение сенсорной и конвейерной готовности;
  для DoD верить конвейеру.
- evidence: отчёты двух recon-агентов в транскрипте сессии; PR #229; коммит f9e92f8;
  verify exit 0 (NODE_PATH-грабля учтена)
- qa: —
- attention: ~35 мин; субагенты 128k+147k токенов
- Открытое к эскалации (батч, не поштучно): PA-065..068 scope-guard write violations (owner);
  PA-046..049 alert-channel/audit-persistence (PRODUCT+INTEGRATOR решения); CNT-005
  draft→active flip; gh-токен VM (если push упадёт).

### RUN-A.4 — 2026-07-17 05:15 — provision (OPENAI_API_KEY: already-set)
- mode: autonomous-conductor
- action: по директиве владельца ключ извлечён из хостового ~/.claude/.statusline.env
  (закомментированная строка #OPENAI_API_KEY — statusline-резюме выключено 2026-07-01, ключ
  жив) и доставлен scp-файлом (минуя транскрипты/командные строки); НА VM ключ уже стоял
  в обоих контурах: ~/projects/my-first-test/.env и ~/deploy/my-first-test/shared/.env
  (len=164, sk-*) — append не потребовался, дублей не создано; временные файлы удалены.
- target: VM env-файлы (значение нигде не печаталось)
- expectation → actual: ожидал отсутствие ключа (PA-038 REOPENED «absent → BLOCK») →
  ФАКТ: ключ уже provision'ен кем-то после реопена PA-038 → PA-038/061 вероятно устарели;
  валидность ключа подтвердит живой вызов (PA-039 / Task 5.4) в конвейере.
- evidence: вывод проверок в транскрипте сессии (только длины/префиксы)
- qa: — (floor-класс действия; выполнено по явной директиве владельца из вводной)
- attention: ~5 мин

### RUN-A.5 — 2026-07-17 05:25 — dispatch (executor-сессия cond-s1: гигиена + DoD baseline + handoff FM-006)
- mode: autonomous-conductor
- action: первый дизпатч прогона. §0-проба повторена (VM свободна) → промпт-файл сохранён ДО
  send (I-4): хост `vm-harvests/RUN-2026-07-17-A/prompt-s1.txt`, VM `~/cond-s1-prompt.txt`
  (scp+dos2unix, 33 строки) → tmux `cond-s1` в ~/projects/my-first-test, claude bypass-режим
  (мандат владельца 2026-07-10), DISABLE_AUTOUPDATER=1 + PROMPT_SUGGESTION=false →
  ghost-протокол I-3: C-u → вставка из файла → capture-верификация («Pasted text #1 +33
  lines», дублей нет) → Enter → busy подтверждён (ctx 0%→6%).
- target: VM tmux cond-s1; claude session id 4ab462c5-21de-4860-a5f1-94cfd3e3ead5 (Opus 4.8,
  1M ctx; usage окна 3%/13% — запас есть)
- задание (4 единицы): (1) закоммитить оркестраторский осадок lymzao/lzg7rk + ledger.ndjson,
  НЕ трогая active-tools.yaml/.scope-guard-dedup.json/project-journal.md (ждут владельца,
  PA-065..068 — только diff-выжимка в сводку); (2) RL-001 planned→in-progress + секция
  Release DoD по шаблону R0 с baseline-статусами по evidence + «Очередь итерации»;
  (3) /product:handoff FM-006 (stale, дрейф SC-025/BR-080); (4) git push origin main —
  честный результат (gh-токен VM под вопросом), креды не чинить.
- expectation → actual: ожидание — 4 коммита-юнита + сводка «SUMMARY-COND-S1:», DoD baseline
  ~= [1:🟠 (1/7 shipped), 2:❌ (P6 GO только FM-006), 3:🟠/✅ (DEPLOYED+ROLLED_BACK),
  4:❌ (DA RL не прогнан), 5:❌ (draft CNT-005, PA открыты), 6:❌] → actual: сессия работает,
  поллер ждёт маркер сводки/идл (интервалы 45с)
- evidence: транскрипт `~/.claude/projects/-home-cc-dev-projects-my-first-test/4ab462c5-*.jsonl`;
  known non-blocking дрейф на старте: SessionStart-хук `bd: not found` (задокументирован в
  vm-factory-ops §5 — в отчёт, не чинить)
- qa: — (ответов пока не требовалось)
- attention: ~15 мин на подготовку+дизпатч
