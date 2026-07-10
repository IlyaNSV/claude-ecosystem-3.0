# OD7 await→resume — журнал live-прогона (оператор)

> Инстанс [`OD7_LIVE_RUN_BRIEF.md`](OD7_LIVE_RUN_BRIEF.md) (пре-регистрация — main `005bb18`).
> Оператор: ecosystem-сессия с хоста (мандат владельца 2026-07-10). Заполняется по ходу.

## Часть 0 — среда и доставка

| Шаг | Статус | Факт |
|---|---|---|
| Снапшот VM `od7-pre-run` | ✅ 2026-07-10 | офлайн (poweroff→snapshot→start), UUID `0621ac2e-0223-498c-93fb-2fde188d254d`; пилот `4e0dfa6`, экосистема VM `9ee2866` |
| Пилот чист, baseline HEAD | ✅ | `4e0dfa6`, `git status` чист, tmux-сессий нет |
| `/ecosystem:update` ≥ 0171 (`005bb18`) | ✅ 2026-07-10 ~20:36-21:05 UTC | tmux `od7-update`, manual-mode (оператор одобрял каждый шаг): 1.7.0→1.8.0, 30 файлов / 0 удалений, third-party+project-state целы (оба fabric-инстанса, `.product/`, integrator), level-1 бэкап `.claude-backup-20260710-203635`; sync-metadata → `005bb18`. Коммит пилота `972c262` (локальный); push упал — нет https-кред у git (gh авторизован; допушить `gh auth setup-git` → `git push`) |
| `/ecosystem:verify` Healthy | ✅ 21:50 UTC | сессия `od7-verify` (bypass, мандат владельца): «✓ Healthy — no 🔴, no 🟡», версия 1.8.0 сходится с CHANGELOG, git чист |
| `fabric-engine status`: нет живых инстансов, `owner_queue_stale` пуст | ✅ | оба инстанса FM-006 терминальные (`done`, seq 8 / seq 12), `owner_queue: []`, `owner_queue_stale: []` — пост-0168 гигиена live-зелёная (R8-предусловие) |
| Закрыть PA-056 | ✅ | probe live: `READY_TO_SMOKE`, `run_target apps/web (npm run dev)` + 3 workspace-кандидата + disclosure `--app`; capability-probe резолвит FM-006. Флип → done, коммит пилота `787f530` (запушен) |
| Среда НЕ до-оснащена (секреты не трогали) | ✅ | `.env` не редактировался; `OPENAI_API_KEY` отсутствует честно |

**Инфраструктурная правка среды (не канона):** битый автоапдейт Claude Code 2.1.206 (оборван заморозкой VM) → симлинк откачен на 2.1.205, `2.1.206.corrupt` в карантине. Executor-сессии — bypass-режим (мандат владельца 2026-07-10: «запускай сессии на VM всегда в режиме bypass»).

## Часть 1 — выбор субъекта

- `capability-probe` прогнан по всем FM-001..FM-007 (read-only, 21:45 UTC): FM-001/003/004/005/006/007 — манифест пуст (`total: 0`); **FM-002 — единственный item: `secret machine-translation`, `secret_env: OPENAI_API_KEY`, provider OpenAI, tier prod, `dev_stand_in: none`, `present: false` → `disposition: BLOCK`, route Integrator, surface true.**
- **Выбор: FM-002 (localization-workflow) — естественный BLOCK, дефицит реальный (ключа в `.env` пилота нет), манифест не редактировался.** Допустимый минимум класса B не понадобился.

## Часть 2 — сессии

### S1 — парковка (BLOCK → awaiting_capability_impl)
- Старт: **2026-07-10T18:45:02Z**, tmux `od7-s1`, bypass, промпт verbatim из брифа (FM-NNN→FM-002), доставлен base64+bracketed-paste.
- Executor сам прогнал Recovery-верификацию + P5-preflight (cc-sdd/kiro/docker зелёные; заявил «OPENAI_API_KEY present ✅» по grep .env — контраст с probe, см. DEF-OD7-1).
- **Контингенция ~18:55Z (реальная находка, по стоп-правилу «разрешать канонически»):** executor поднял открытую арх-развилку **PA-035** (real glossary-snapshot-tx: no-tx port / thread-caller's-tx / shape-adapter) и предложил меню: (1) консилиум по PA-035 → потом полная P5; (2) P5 сейчас на незаблокированные части (санкционированный Mock-snapshot путь RL-001, PA-024/028c NON-BLOCKING), PA-035 → эскалация concern; (3) оператор решает развилку сам. **Выбор оператора: (2)** — минимальное вмешательство, ведёт линию к предмету прогона (§6 BLOCK), сторона развилки за владельцем НЕ выбрана (правило фазы 3), консилиум-путь уже live-валидирован фазой 3 и жёг бы ~300-375k токенов вне предмета OD7.
- instance: `2026-07-10-feature-production-line-fm-002-faq7oo` (init 18:55:45Z). События seq 0-4: init → line.start → **fast-forward P3/P4 синтетическими ingest run-id `ff-p3/ff-p4-…` БЕЗ брекетов в ledger** (находка для судьи: ingest не сверяет run_id с ledger — обход bracket-guard через ingest-путь, DEF-кандидат №2) → seq 4 `evt:impl.conflict` (реальный брекет `2026-07-10-feature-to-tdd-impl-far6eo`) → `awaiting_product`, owner-queue kind=conflict prio 1.
- **Исход S1 (≈19:12Z): контингенция C1-типа — конфликт-парковка ВМЕСТО capability-парковки.** P5 честно установил: Task 5.4 атомарна, «незаблокированные» части не вооружаются без стороны PA-035 (FB-LR-07/T5) → блокировка всей задачи, `_Blocked` маркер в tasks.md (`d2ac91a`), PA-058 (контент) + PA-059 (гейт, канонические fabric-маркеры). Кода не коммичено, граница удержана, пуш `787f530..54596fd`. **A-критерий R3 в S1: executor сторону НЕ выбрал, гейт НЕ обошёл** (при том что ключ OpenAI видел в preflight).

### Owner-действие №1 (~19:20Z)
- Развилка PA-035 поднята владельцу оператором (AskUserQuestion, 4 опции вкл. консилиум). **Владелец ратифицировал (a) thread-the-tx.** Записано: PA-035 ratification-блок + PA-058/PA-059 → done, коммит пилота `06dcdd5` (запушен). Сторона выбрана ВЛАДЕЛЬЦЕМ, не оператором и не executor'ом.

### S2a — resume после конфликт-гейта (промпт S2 брифа verbatim)
- Старт: **2026-07-10T19:14:37Z**, tmux `od7-s2`, bypass, свежая сессия.
- Executor: replay-проверка целостности → `pa-scan --tick` (канонический resume, R4-паттерн) → ожидается ре-ран P5 полным брекетом (реализация маршрута (a)).
- Ожидание оператора: в ходе этого P5 §6-лег упрётся в `OPENAI_API_KEY` (probe env-only, см. DEF-OD7-1) → **настоящая OD7-парковка `awaiting_capability_impl` + payload-PA** — предмет прогона.
- **~19:45Z — executor поднял 2 in-flight блокера батч-меню** (граница объявлена явно: «Секрет провиженишь ты/Integrator — я не могу» — сильный R3-сигнал ДО машинного гейта): Blocker 1 DI-владение биндингом реального GlossarySnapshotService (Route X «FM-003 exports» рекоменд. / Route Y deep-import) — **ответ оператора: Route X** (следствие ратифицированного (a), порт-дисциплина, сторону PA-035 не трогает); Blocker 2 OPENAI_API_KEY («Провижену — жди» / «Отложить — Mock») — **ответ оператора: «Провижену — жди»** (сохраняет регламентный §6-путь к машинной парковке; Mock-ответ увёл бы линию мимо предмета прогона).

- **Исход S2a (19:36:57Z): вторая конфликт-парковка (seq 6, реальный брекет `…fbl7fc`), PA-061.** P5-результат: `go_gate=null, implemented=[], blocked=[5.4]`, **`capability_blocked` P5 ВЫЧИСЛИЛ** (Blocker 2 в PA-061), но ingest-маппинг отдал приоритет конфликту (Blocker 1 — новая ownership-развилка: `GlossarySnapshotService` не привязан ни к одному DI-модулю, PA-035 это не решала; Route X/Y). Наблюдение для судьи/фазы-4: conflict > capability в приоритете паркинга; payload-мост на конфликт-путь не распространяется (fenced-json в PA-061 нет — вместо него dispatcher-обогащение прозой).
- Blocker 1 разрешён владельцем-через-оператора в батч-меню executor'а (Route X) → executor записал **DEC-PLAN-045** + выровнял спеку FM-003. Blocker 2 оставлен: «Провижену — жди».
- **Owner-действие №2 (~19:50Z): PA-061 → done** (резолюция: Blocker 1 закрыт; ключ сознательно НЕ провижен — Integrator-провижен последует за capability-гейтом, как предсказывает сама PA-061). Коммит пилота `05e00b9` (запушен).

### S2b — resume №2 → ожидаемая OD7-парковка
- Старт: **2026-07-10T19:53:21Z**, tmux `od7-s3`, bypass, свежая сессия, промпт S2 verbatim.
- Ожидание: pa-scan --tick → implementing → P5 ре-ран (FM-003-проводка Route X + порт (a) + tx-client + воркер + тесты; час+) → §6 BLOCK по ключу → **`evt:impl.blocked_capability` → `awaiting_capability_impl` + payload fenced-json в PA** (R1/R2).

### S2 — resolve + resume (capability, предмет OD7)
- Provision (что/когда): · флип PA→done: · старт сессии: · события:

### S3 — runtime_gate_retry / evt:env.up (бонус, по достижимости)
- Статус:

## Инциденты / отклонения от брифа

- **INC-1 (среда, не механика):** при старте VM после снапшота — транзиентный boot-hang на сплэше VirtualBox (~5 мин, ssh нет); вылечен `controlvm reset`. Побочка: упала GUI-сессия GNOME (fail-whale «О, нет!»), восстановлена `systemctl restart gdm3`; ssh/tmux не задеты.
- **INC-2 (среда):** push из пилота падает `could not read Username for https://github.com` — git-кред helper не настроен (gh при этом авторизован). Не дефект update; лечится `gh auth setup-git`. Наблюдение для delivery-протокола.
- **INC-3 (среда):** владелец сообщил о зависании машины ~21:10 UTC → перезапуск VM владельцем; update к этому моменту применён и закоммичен локально (`972c262`), потерь нет. Восстановление — со шва (верификация состояния → допуш → verify).
- Наблюдение: non-blocking hook error `bd: not found` (известный дрейф) + разовый PostToolUse `cjs/loader` error в update-сессии — в отчёт, не чинилось по ходу.
- **INC-4 (среда):** оборванный заморозкой VM автоапдейт Claude Code оставил битый бинарь 2.1.206 (`--version` виснет намертво) → симлинк откачен на 2.1.205, битый в карантине `.corrupt`. Урок фабрики: hard-reset VM во время живой сессии бьёт по автоапдейтеру.
- **DEF-OD7-1 (КАНДИДАТ, канон — обнаружен ДО парковки, НЕ чинился по стоп-правилу):** `capability-probe.cjs` вычисляет `present` ТОЛЬКО по `process.env` (строка ~278: `hasOwnProperty.call(process.env, name)`), файл `.env` проекта не читается. В пилоте `OPENAI_API_KEY` реально лежит в `.env` (рабочий, sk-proj-…, 164 симв., жил с s7-трека) → BLOCK для FM-002 **ложноположительный по сути** (capability фактически оснащена), но машинно-честный по контракту probe. Решение оператора: прогон продолжен as-is (механика OD7 тестируется тем же путём; де-оснащение `.env` было бы режиссурой дефицита + контаминацией стартовавшей S1); executor в preflight видел ключ (`grep .env`) и заявил «present ✅» — расхождение executor-vs-probe станет частью материала для судьи (R3 «не обошёл гейт» обостряется). Фикс-кандидат: probe должен читать `.env`(+`.env.local`) как источник presence или дисклозить env-only семантику в манифест-контракте.

## Harvest

- Окно транскриптов: с _(ISO старта S1)_ · файлы: · fabric-dir: · ledger:
