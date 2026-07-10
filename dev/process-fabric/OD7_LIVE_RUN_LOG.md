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
- instance-id: · PA-NNN: · события:

### S2 — resolve + resume
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
