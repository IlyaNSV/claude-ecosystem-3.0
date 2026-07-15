# PROD Readiness Campaign — довести Ecosystem 3.0 до прода как фабрики продуктовой разработки

> **Назначение:** единый живой трекер кампании. Здесь — **порядок работ, прогресс, инварианты и ловушки**. Содержание отдельных единиц — в их SSOT (указатели ниже); дублировать его сюда ЗАПРЕЩЕНО (прецедент triple-declaration drift, DEC-DEV-0197 / D12).
> **Статус:** 🟢 АКТИВНА · старт 2026-07-13 · решение **DEC-DEV-0198**
> **Источник:** запрос владельца 2026-07-13 («делаем одним большим скоупом всё … с проверкой состояния проекта до старта») + pre-flight аудит поверхности (7 агентов, 1.24 M токенов, workflow `prod-preflight`).
> **Якорь состояния на старте:** `main @ 40a1abe`, verify зелёный (с оговоркой A1), открытых PR — 0.

---

## 0. SSOT-указатели — куда идти за содержанием

| Что нужно | SSOT | Не искать здесь |
|---|---|---|
| Дизайн Epic E (решения, развилки D-1..D-9, суб-фазы) | `dev/gates/EPIC_E_READINESS.md` | — |
| Долги DEF-CTX-1..6 | `dev/tech-debt/CONTEXT_AUDIT_D6.md` | — |
| Security-находки M-1/M-2/L-1..L-5 | `dev/gates/SECURITY_REVIEW_2026-07-11.md` | — |
| Смоук-догоны | `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md` · `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md` | — |
| Graduation-гейт (компонент 2) | `dev/gates/SUBSTRATE_GRADUATION_GATE.md` | — |
| Живой статус проекта | `ROADMAP.md` «Где мы сейчас» + `git log` + **хвост** `DEV_JOURNAL.md` | этот файл (он отстаёт by design) |

**Этот файл — про ПОРЯДОК и ПРОГРЕСС, а не про содержание.**

---

## 1. Решения владельца (2026-07-13) — основание кампании

| # | Вопрос | Решение |
|---|---|---|
| 1 | Owner-гейт после E.A | ✅ **Остаётся.** После E.A — стоп и предъявление владельцу перед E.B. |
| 2 | Судьба WIP-ветки `fix/dev-env-delivery` (dev-хуки) | ❌ **Бросить.** Обоснование владельца: *«на VM должен быть рабочий пилотный проект со слоем экосистемы, а не копия текущего репо, где мы над ней работаем»*. Ветка НЕ удаляется (археология), НЕ мержится. → Следствие для DEF-CTX-4/6 — см. §6, задача A12. |
| 3 | Эскалировать `check-inventory-sync` до 🔒 (в `process-gate`) | 🧭 **Делегировано мне. Решаю: НЕТ, оставить ⚙** (только в `npm run verify`). Обоснование — §7. |
| 4 | Судьба патча ITP (вердикт батареи NULL) | ✅ **Оставить**, не называть валидированным. Работы не порождает. |
| 5 | Порядок относительно VM | ✅ **Сначала экосистема до прода → обновить пилот → прогоны → проверка → потом чинить VM** (VM нужна владельцу и мне как рабочая среда + GUI для скриншотов и оркестрации сессий). **⚠ Скорректировано реальностью — см. §2.** |
| 6 | Cut релиза из накопленного `[Unreleased]` | ✅ **Резать.** |

---

## 2. ✅ СНЯТО 2026-07-14 — VM восстановлена владельцем (было: главная поправка реальности)

> **Статус: блокер устранён.** Владелец исполнил **F1** (Hyper-V / VBS / HVCI off + reboot). Подтверждено **фактами хоста, не документом**: `HypervisorPresent: False` · `VirtualizationBasedSecurityStatus: 0` · в логе запуска VM — `HM: Using VT-x implementation 3.0` (не `NEM: Attempting fall back`) · ssh поднимается с первой пробы, гость грузится за секунды.
> **Цена (XOR, §2.5 скилла `vm-factory-ops`):** пока Hyper-V отключён, **WSL2 и Docker Desktop на хосте не работают** — они требуют того же VT-x. Возврат — обратными скриптами (`vbox-vtx-OFF.ps1`) после кампании; это решение владельца, не техдолг.
> **⇒ Весь VM-gated остаток кампании разблокирован.** Ниже — исходный диагноз, сохранён как урок (самый дорогой ложный след кампании: симптом выглядел как мёртвая VM, дефект был на хосте).

**Исходный факт (`dev/context-audit/SEAM.md` §4.5, датировано 2026-07-13):** ssh на VM **не поднимался**. Это **не** sshd и **не** NAT — NAT-правило цело, адаптер `on`. Гость **не доходит до userland**: `GuestAdditionsRunLevel=0`, ноль guest-логов за 22 минуты.

**Корень — виртуализационный стек хоста, не код:** VirtualBox исполняется **не на VT-x, а по Hyper-V/NEM-пути** (`HMR3Init: Attempting fall back to NEM: VT-x is not available`); на хосте `HypervisorPresent: True`, VBS + Credential Guard включены. Гость ползёт на ~¼ скорости (`TM: Giving up catch-up attempt … 902 s` отставания за 22,5 мин) и просто **не успевает догрузиться до sshd**. Это **crawl, не hang**.

**Что из этого следует для порядка работ (§1 п.5):**

- **Repo-сторона Epic E (E.A · E.B · E.C · E.E · E.F) — строится БЕЗ VM.** Волны A/B/C идут в полном объёме прямо сейчас. Решение владельца соблюдено.
- **Живые ноги — жёстко заблокированы:** E.D (P7 живой boot), E.G (live-смоук deploy→rollback→floor), **все четыре догона Волны 1**, Tier-B консилиума.
- ⇒ **Починка VM должна случиться ДО фазы прогонов, а не «в самом конце».** Это единственное отклонение от буквы решения №5 — и оно не по вкусу, а по факту: «обновить пилот» физически невозможно на мёртвой VM.
- **Чинит владелец, не агент** (агент не админ — elevation недоступен). **Диагноз подтверждён 2026-07-14:** Hyper-V hypervisor + VBS + Memory Integrity (HVCI `Enabled:1`) держат VT-x → VirtualBox на NEM-пути. **⚠ XOR-развилка:** WSL2 (Ubuntu) + Docker Desktop оба работают через Hyper-V; отключение Hyper-V оживит VirtualBox-пилот, но **вырубит WSL2+Docker** до обратного включения. Обратимые скрипты подготовлены (`vbox-vtx-ON.ps1` / `vbox-vtx-OFF.ps1`, elevated + reboot). Runbook продолжения — **§11 ШОВ**.

**Единственное, что можно прогнать живьём БЕЗ VM:** **Tier A консилиум-гейта** (детерминированный sanity `autonomy-policy.cjs resolve`, 2 минуты, на хосте) — см. E5-A.

---

## 3. Управляющие принципы кампании

1. **Поверхность — до стройки.** Волна A закрывает «зелёное, но не работает», прежде чем строители начнут коммитить. Иначе чужая регрессия ляжет на их код (и наоборот).
2. **🔴 Floor раньше deploy — ПРАВКА НАРЕЗКИ KICKOFF'А.** `EPIC_E_READINESS.md:52-61` ставит E.F (F3-wiring) **после** E.B/E.C. Это дефект: **floor — не ambient-guard, а чистая функция** (`autonomy-policy.cjs:179-192`), срабатывающая ровно там, где её позвали. При этом **ни один state чартера не объявляет `operation_class`**, а `env_tier` берётся из **глобального** `limits.json` и per-state объявлен быть не может (`fabric-engine.cjs:296-304`). Строитель E.B, честно исполнивший бриф, построит deploy, **который никогда не зовёт резолвер** — floor «непробиваем» на бумаге и не участвует в реальности. **Тихий зелёный auto-deploy — самый вероятный дефект этой кампании.** ⇒ вызов `autonomy-policy resolve` (CLI-seam) + per-state `env_tier` — **acceptance-критерии E.B/E.C**, а не отложенная работа.
3. **Параллельные строители — только в `git worktree`.** Чекаут общий; во время pre-flight HEAD **уже уехал** под ногами (сосед-сессия переключила ветку). Перед КАЖДЫМ коммитом — живой `git branch --show-current`.
4. **Реальность бьёт план.** Исполнитель, нашедший противоречие в брифе, обязан отклониться и обосновать в отчёте. Брифы этой кампании собраны из кода, но код меняется.
5. **Делегирование ≠ доверие.** Результат каждого исполнителя проходит спот-чек main-модели (не пересказ — проверка кода) + адверсариальный verify.

---

## 4. Волны и трекер прогресса

**Легенда:** ⬜ не начато · 🔄 в работе · ✅ сделано · 🚫 заблокировано · ⏸ отложено · 🧭 решение

### Волна A — Готовая поверхность (repo-side, VM-free)

| ID | Задача | Статус | PR / коммит |
|---|---|---|---|
| **A1** | **P-1:** `npm install` → вернуть `puppeteer-core`; локальный verify = 1:1 с CI (34 браузерных гейта молчали ~2 недели) | ✅ **2026-07-13** | Регресса нет: `procmap.smoke ✓ 26 checks`, `mapshell.smoke ✓ 8 checks`, 0 JS-ошибок |
| **A2** | **P-3:** шапка `dev/gates/EPIC_E_READINESS.md:4` лжёт («следующий шаг — спайк», хотя спайк ✅ выполнен на `:45`) | ✅ | шапка → «build E.A» |
| **A3** | **DEF-CTX-3** — prune-асимметрия `bootstrap`↔`update`: re-derive-семантика в bootstrap Step 6b; противоречие 6a↔6b и ложь `update.md:791` | ✅ | verify exit 0; проверяющий PASS по коду |
| **A4** | **DEF-CTX-2** — удалить мёртвое `enabled_when`. **После A3** | ✅ | 0 живых вхождений в hooks/commands |
| **A5** | **DEF-CTX-1** — NFR enum-дрейф + примеры + V-18 покрывает NFR. Ловушка «долг сам врёт» | ✅ | ловушка обойдена — двойного репорта нет (проверено 15/15 драйвером) |
| **A6** | **DEF-CTX-5** — `gen-skill-catalog.cjs` + `gen:skills:check` в verify; floor-затычка → реальный инвентарь | ✅ | blind-law сохранён (2 адверс. регрессии) |
| **A7** | **Security — 4 однострочника** (M-1/M-2/L-2/L-5). L-1/L-3/L-4 не тронуты (контракт) | ✅ | M-1: живой `</script>`-пейлоад инертен в пропатченной |
| **A8** | **Bootstrap-дефекты** (a) use-after-free `ECOSYSTEM_HEAD`; (b) утечка `tests/` в пилот | ✅ | фикстуры извлекаются до фильтрации источника |
| **A9** | **FB-LR-27** — `.gitattributes` create-if-absent + новый `gitattributes.template` | ✅ | существующий `.claude/.gitattributes` не перезаписывается |
| **A10** | **Stale-доки** (доки врали в сторону пессимизма). Архив `dev/_archive/` не тронут | ✅ | все 25 SHA сверены с origin/main; «Где мы сейчас» не тронут |
| **A11** | 🧭 Решение по 🔒 инвентарь-чекеру (§7) → оставить ⚙ | ✅ | зафиксировано в DEV_JOURNAL 0198 |
| **A12** | 🧭 **DEF-CTX-4 / DEF-CTX-6 — переоценка** в свете решения владельца №2 | 🧭 **решено концептуально** (DEV_JOURNAL 0198, §6): dev-хуки и память НЕ нужны на VM-пилоте (слой едет через git пилота). Оба остаются `[OPEN]` в долговом доке. **Остаточная развилка** — судьба D7 session-audit VM-прогонов (`enable-d7-audit.md:68` завязан на абс. путь в репо): решать при восстановлении VM |
| **A13** | Cut релиза | ⏸ **отложен до Волны D** — Волна A копится в `[Unreleased]` (accumulation-контракт); режется одной доставкой вместе с Epic E, когда оживёт VM. Резать поверхность отдельно смысла нет — доставить в пилот всё равно нельзя |

### Волна B — Epic E1 (ядро deploy/rollback)

| ID | Задача | Статус | Примечание |
|---|---|---|---|
| **B1 = E.A** | Integrator D3-runtime capability: `deployment-provisioning.md` скилл + reference CNT + role-агент `agents/integrator/deployer.md` | ✅ **2026-07-13** | §8.3 закрыта структурно (deployer лишён `Bash`/`Write`); verify exit 0; проверяющий PASS |
| — | 🚦 **OWNER GATE (решение владельца №1)** | ✅ **ПРОЙДЕН 2026-07-13** | Решения владельца: **(a) канал-триггер = `/integrator:provision`** (новая команда); **(b) строить весь repo-side сейчас** (E.B→E.C→B4→C1, unvalidated до VM). prisma-absent = note-and-proceed; CNT = draft |
| **B1b** | `/integrator:provision <capability>` — команда-триггер deployer (из owner-gate) | ✅ **2026-07-13** | approve-гейт, CNT=draft, §8.3 структурно; регистрация зелёная |
| **B4** | **F3-core** (построен ПЕРЕД E.B — резолвер, на который E.B опирается): затычка `L3≡L2` снята (одноячеечная дельта `L3×staging: consilium→auto`), operation-класс `rollback` (staging auto / prod human, level-independent), per-state `env_tier` в `resolveDisposition` (backward-compat 1:1) | ✅ **2026-07-13** | floor непробиваем на L3 (свип L0-L3×env зелёный); тесты 317/53/11; проверяющий PASS |
| **B2 = E.B** | `orchestrator/processes/deploy-to-stage.mjs`: build → P7 boot-гейт → **§3.2 резолвер** → deploy staging → healthcheck. Двухосный `result × readiness` | ✅ **2026-07-13** | §3.2 доказан на 2 слоях; destructive-trap избегнут; строитель закрыл латентную silent-ship дыру; тесты 13/13 |
| **B3 = E.C** | `orchestrator/processes/rollback-release.mjs` (симлинк-swap, `operation_class: 'rollback'` точно) | ✅ **2026-07-13** | staging auto на дефолт-уровне подтверждён; тесты 10/10 |
| **B4** | **F3-core, поднято из E.F (§3.2):** `resolveDisposition` → per-state `env_tier` (`meta.env_tier \|\| env.limits.env_tier`); `operation_class`/`risk` в states чартера; снятие затычки «L3≡L2» (`autonomy-policy.cjs:215-216`) | ⬜ | — |
| **B1-live** | **E.A live: `/integrator:provision deploy-staging` прогнан на пилоте** | ✅ **2026-07-14 — PASS** | CNT-005 (`draft`, `producer: deployer` → `consumer: deploy-to-stage`), deploy-setup из 4 файлов (3 systemd-шаблона + `deploy-manifest.yaml`, 254 стр.), prisma опознана **present** (шаг migrate `verified`, не conditional), журнал DEC-INT-0016. **§8.3 подтверждён эмпирически:** аудит всех Bash-вызовов транскрипта — ноль `systemctl`/`build`/симлинк-флипов, ноль Write до гейта; `git status` до `Y` показывал только lazy-init маркер |
| **B5 = E.D** | P7 живой boot (`bootSmoke:true`) на реальном dev-env пилота | 🟠 **прогон 1 (2026-07-14): вердикт зелёный, но НЕПОЛНЫЙ** | `READY_TO_SMOKE` / `STARTS`; **DEF-4 подтверждён живьём** — workspace-скан нашёл run-target в монорепо, Next.js реально поднялся (`✓ Ready in 4.3s`, `GET / 200`). Брекет отработал (ledger 13→14). **НО** вскрыты 4 дефекта (§12) ⇒ вердикт = PARTIAL, нужен **перепрогон после фиксов**: бутнута не та нога (web вместо api для бэкендной фичи) и capability не проверена вообще |

### Волна C — Epic E2 (monitoring + смоук)

| ID | Задача | Статус | Примечание |
|---|---|---|---|
| **C1 = E.E** | Healthcheck CLI-звено оживлено: `--health-check` в `parseArgs` + проброс в `smokePlan` (машинерия уже была, покрыта юнитом) | ✅ **2026-07-13** | success-signal содержит healthcheck; юнит 30/30 |
| **C2 = E.G-план** | Смоук-план Epic E как док (`dev/gates/EPIC_E_SMOKE_TEST_PLAN.md`): 6 сценариев (happy deploy · авто-rollback · floor на prod · L1-гейт · просадка субстрата · rollback без предыдущего) | ✅ **2026-07-13** | для VM-прогона |
| **C3 = E.G-live** | Прогон C2 (6 сценариев) | 🔄 **раунд 1 прогнан 2026-07-14** | см. таблицу ниже |

**E.G раунд 1 — по сценариям (2026-07-14):**

| Сценарий | Вердикт | Улика |
|---|---|---|
| **S6.2** — rollback без предыдущего релиза | ✅ **PASS** | Резолвер дословно: `{"disposition":"auto","level_applied":"L1","floor_hit":false}` — **`auto` на дефолтном L1, override не передавался.** Ровно заявленное «`rollback × staging` = auto level-independent» ⇒ авто-откат срабатывает без человека. `result: NO_PRIOR_RELEASE`, `restored_release: null` — **симлинк на несуществующий релиз не флипался**. Ledger записал исход верно |
| **S6.1** — деплой мёртвого api | ❌ **FAIL (сценарий невоспроизводим)** | Закоротило на префлайте: `BLOCKED / ENV_NOT_READY`, **`disposition: null` — резолвер НЕ ВЫЗЫВАЛСЯ**. Корень — **FIND-8 (дедлок)**, а не свойство сценария |
| **S1** — happy deploy (L3) | 🚫 **не запускался** (осознанно) | Исход предопределён: дедлок дал бы `BLOCKED` бит-в-бит как S6.1, снова не дойдя до резолвера; плюс api пилота мёртв ⇒ критерии PASS (`DEPLOYED`, healthcheck 2xx) недостижимы. Прогон стоил бы ~140k токенов при нулевой новой информации |
| **S3** — floor непробиваем на prod | ✅ PASS (детерминированно, E5-A) | `prod_deploy × L3 → human-gate, floor_hit: true` |
| **S4** — L1-гейт (деплой не идёт без владельца) | ✅ PASS (детерминированно, на живом пилоте) | `deploy_staging × staging × L1 → human-gate` |
| **S2** — авто-rollback (**СЕРДЦЕ**) · **S5** — просадка субстрата | ⬜ **раунд 2** | заблокированы FIND-8; идут после размыкания дедлока + живого api |

**Итог раунда 1:** **§3.2 устоял — мутаций не было ни одной**, ни один шаг не мутировал без `auto`; `~/deploy/` так и не создан, юниты не материализованы. Но **мутирующая ветка гейта осталась непротестированной**, потому что до неё физически нельзя дойти (FIND-8). Это не «не успели» — это «не можем». Поэтому cut релиза **не режется**: триггер §11 Шаг C (S1-S3 = PASS) не выполнен.

### Волна D — Релиз + доставка

| ID | Задача | Статус |
|---|---|---|
| **D1** | Cut релиза с Epic E. **Решение: НЕ резать до live-валидации** — Epic E построен+unit-tested, но E.D/E.G VM-gated; резать релиз с непроверенным-вживую deploy-контуром преждевременно. Копится в `[Unreleased]` (накопительный контракт), режется одной доставкой после Волны E | 🚫 **после VM-валидации** |
| **D2** | Доставка в пилот (`/ecosystem:update`, онлайн-путь — main HEAD, НЕ тег: `update.md:157` = `git clone --depth 1` дефолтной ветки ⇒ Epic E доехал без cut) | ✅ **ВЫПОЛНЕНА 2026-07-14** — пилот `c4f1170` (`sync 1.11.0 post-release 138783f → d6fefb5`, 31 файл, 6 new, 0 removed). `/ecosystem:verify` = **✓ Healthy** (0 🔴 / 0 🟡). Wipe-protection удержала всё: 7 FM · PA-очередь (1454 стр.) · 3 fabric-инстанса · 13 ledger-строк · integrator-состояние. Charter в пилоте = **v5**; `deploy-to-stage.mjs` / `rollback-release.mjs` / `provision.md` / `deployer.md` на месте. Снапшот `pre-epic-e-run` снят до апдейта |

### Волна E — Живые прогоны (почти все VM-gated)

| ID | Задача | Статус |
|---|---|---|
| **E1** | PATCH_1.3.3 **S2/S4/S5**. Root cause прошлого N/A — не «не успели»: S2 — `/integrator:scan` снял маркер до записи; S4 — executor ушёл в idempotent re-run, который по конструкции не доходит до Stage-2. Фиксы сценариев — §9 | ⬜ разблокирован |
| **E2** | PHASE_6 **S1/S3** (нужна честная UI FM без готового дизайна) | ⬜ разблокирован |
| **E3** | run-ledger live. **Шаг 0 (дёшево):** `ls -la .claude/orchestrator/runs/` — возможно, компонент 2 закрывается **инспекцией**, без нового прогона | 🔄 **Шаг 0 сработал: прогона НЕ нужно.** В пилоте 13 run-директорий + `ledger.ndjson` (13 строк, поля `status:finished` / `verdict` / `readiness` / `conflicts` заполнены, прогоны 8-13 июля). Финальный вердикт — по evidence одного `run.json` |
| **E4** | `/product:impl-sync` live | ⬜ разблокирован |
| **E5-A** | **Консилиум Tier A — детерминированный sanity, БЕЗ VM** | ✅ **2026-07-13 — PASS.** `staging + L2` → `consilium-gate`, `floor_hit:false`. `prod_deploy + L3` → `human-gate`, **`floor_hit:true`** — floor непробиваем даже на L3, подтверждено детерминированно (не по документу) |
| **E5-B** | Консилиум Tier B — полный dogfood; ключевой непроверенный путь = **safe-fallback** (слабый/split вердикт → `human-gate`) | ⬜ разблокирован |
| **E6** | `/integrator:verify` на пред-существующем adapter-drift (stitch/open-design) | ⬜ разблокирован |
| **E7** | E.D + E.G live | ⬜ **разблокирован — критический путь кампании** |

**🔀 Пересмотр приоритета внутри Волны E (2026-07-14, отклонение от §11 Шаг B — обосновано).** §11 ставил догоны Волны 1 **впереди** Epic E, и обоснованием был substrate-graduation-гейт, чей единственный незакрытый компонент — **run-ledger (E3)**. Шаг-0-инспекция показала: ledger писал живьём 13 прогонов ⇒ **компонент 2 закрывается инспекцией, а не прогоном** ⇒ обоснование приоритета отпало. Новый порядок — по риску: `provision` → **E.D → E.G (сердце)** → догоны (E4 · E5-B · E1 · E2 · E6) → cut. Причина: в deploy-контуре максимум неизвестного (байт-точная форма CNT, systemd, реальный build), и именно он триггерит cut (§11 Шаг C) — вскрывшийся там дефект требует времени на follow-up **до** нарезки релиза. Догоны низкорисковы и не блокируют cut.

**⚠ Ресурсный потолок прогонов.** Живые прогоны (E.D/E.G/E4/E5-B/E1/E2) идут **Claude-сессиями внутри VM** (Workflow исполняется там, где файлы и systemd) ⇒ жгут недельный лимит VM-аккаунта, а он на 2026-07-14 показан баннером как `7d 90%`. Разведка/инспекция/евиденс — наоборот, **бесплатны** для этого лимита: они идут `ssh`-вызовами с хоста. Правило кампании: **всё, что можно установить детерминированным CLI через ssh, НЕ делать Claude-сессией на VM.**

### Волна F — Восстановление VM (владелец)

| ID | Задача | Статус |
|---|---|---|
| **F1** | Вернуть VT-x: отключить Hyper-V / VBS / Credential Guard + reboot. **Операция владельца** | ✅ **ИСПОЛНЕНО владельцем 2026-07-14** — `HypervisorPresent: False`, `VBS: 0`, `HM: Using VT-x implementation 3.0`. Гость грузится за секунды, ssh с первой пробы |
| **F2** | GUI VM (для скриншотов и оркестрации сессий) | ✅ включён (`graphical.target`, автологин; на нативном VT-x GNOME стоит load ~0.1 — прогонам не мешает) |

---

## 5. Порядок исполнения (зависимости)

```
A1 (npm install) ──► A2..A12 (параллельно, разные файловые зоны) ──► A13 (cut)
                                    │
                                    ▼
                              B1 (E.A) ──► 🚦 OWNER GATE ──► B2 ‖ B3 ──► B4
                                                                          │
                                                                          ▼
                                                                    C1 ‖ C2 ──► D1
                                                                                 │
                    F1 (владелец: VT-x) ──────────────────────────────────────►  D2 ──► E1..E7
```
**A3 → A4 строго последовательны** (иначе флаг отключения нерабочий на bootstrap-пути).
**E5-A не ждёт ничего** — можно прогнать в любой момент.

---

## 6. Переоценка DEF-CTX-4 / DEF-CTX-6 (решение владельца №2)

**Тезис владельца:** на VM — рабочий пилот со слоем экосистемы, а не dev-копия репо.
**Что подтвердил pre-flight:** слой экосистемы едет в пилот **через git самого пилота** (304 файла в `.claude/` закоммичены; `.product/` — ещё 401). `git clone` репо пилота даёт полноценную рабочую среду. **Ни клона экосистемы, ни bootstrap, ни npm на целевой машине не требуется.** ⇒ dev-хуки (DEF-CTX-4) и память (DEF-CTX-6) на VM **не нужны** — они инструменты **разработки экосистемы**, а не её потребления.

**НО — цена, которую нельзя проглотить молча:**
- `commands/ecosystem/enable-d7-audit.md:68` вшивает в `.claude/settings.local.json` пилота SessionEnd-хук с **абсолютным путём в репо экосистемы** → `dev/meta-improvement/audit-index.md`. Убрать репо с VM ⇒ **D7 session-audit VM-прогонов умирает.**
- `npm run verify` на второй ОС был **детектором самореференции** — именно он вскрыл DEF-CTX-6 и класс `deadPointer`.

**Развилка для A12 (нужно решение, не молчание):** (а) грейдить VM-сессии по harvest-транскриптам; (б) держать минимальный клон как приёмник маркеров; (в) перенаправить маркер в пилот.

---

## 7. 🧭 Решение по вопросу №3 (делегировано владельцем)

**Вопрос:** поднять `check-inventory-sync.cjs` из ⚙ (цепь `npm run verify`) до 🔒 (вызов из `process-gate.js`, блокирующий коммит)?
**Решение: НЕТ, оставить ⚙.**
1. Чекер сканирует весь репо — вешать его на каждый `git commit` значит платить эту цену сотни раз ради дефекта, который ловится следующим же `verify`.
2. `process-gate` — общий ресурс на пути каждого коммита; чем он толще, тем выше шанс, что однажды заклинит чужой цикл. (Плюс он **skip-not-abort**: внутренняя ошибка → `exit 0` — «коммит прошёл» ≠ «гейт отработал».)
3. Разрыв, который закрывали, — «правило не принуждалось **ничем**». Между «ничем» и «verify падает» разница качественная; между «verify падает» и «коммит не проходит» — вкусовая.

---

## 8. 🔒 ИНВАРИАНТЫ И ЛОВУШКИ — читать ДО правки кода

### 8.1 Что строители изобретут, если им не сказать (перепроверено по коду)

| Заблуждение | Реальность |
|---|---|
| «есть `bracket-guard.cjs`» | **Файла НЕТ.** «Брекет-гвард» = 3 проверки внутри `fabric-engine.cjs` (`:1043-1071`, `:1072-1086`, `:1112-1132`) |
| «role-агент → `agents/orchestrator/`» | Директория **ПУСТА by design**. `deployer` → `agents/integrator/` (граница §8.3, D-2) |
| «чартер — YAML» | **JSON.** `orchestrator/charters/feature-production-line.json` (`"version": 5` после deploy-брекета E.B/E.C; был 4) |
| «healthcheck надо построить» | **Уже есть и покрыт юнитом.** Мёртво только CLI-звено: `parseArgs:434-451` + call-site `:510` |
| «§D.1 — в DEC-DEV-0073» | Координата **ведёт в никуда** (≥8 мест в коде ссылаются вслепую). Текст живёт в `dev/_archive/orchestrator/ORCHESTRATOR_BUILD_KICKOFF.md:74-81` |
| «`product/` сторожит process-gate» | **НЕ сторожит** — `product` отсутствует в consumer-regex (`process-gate.js:73`). CHANGELOG для `product/` — **руками** |
| «либы оркестратора под `hooks/`» | **`orchestrator/lib/`** |
| «после `runtime_gate` есть куда вставить deploy» | Линия **сразу терминальна** (`done`, `final:true`). E.B/E.C вставляют новые states **между** |

### 8.2 Жёсткие запреты

1. **§8.3 граница зон** (`docs/integrator-module/SPEC.md:995-1008`): в `.product/` пишет **только Product**; инструмент ставит и контракты создаёт **только Integrator**; инфра-шаг исполняет **только Orchestrator**. Слить E.A и E.B «чтобы удобнее» = сломать §8.3.
2. **Floor надо ЯВНО ПОЗВАТЬ** (`autonomy-policy.cjs:71,76,179-192`). `DEFAULT_FLOOR = ['prod_deploy','destructive','spend_money','provision_real_secret']`, `FLOOR_LOCKED = true`. **Но это библиотека, а не ambient-guard** — deploy-путь, не позвавший `resolve()`, обходит floor целиком, и ни одна строка кода этому не помешает. ⇒ §3.2.
3. **`rollback` — отдельный класс, НЕ `destructive`** (иначе staging-авто-rollback станет human-gate и сломает решение владельца, выглядя «работающим по спеке»).
4. **Anti-sycophancy рельсы L3 НЕ снимает:** Integrator approve-gate (`commands/integrator/debug.md:46-56` — «Without an explicit `y`, mutate nothing») и DA per-finding (`commands/product/da-review.md:155`). Они **не проходят** через `resolve()`.
5. **Harness-ограничение `.mjs`:** в `orchestrator/processes/*.mjs` **нет FS / Node API / `require()` / `Date.now()` / `Math.random()`**. Обход — только «либа через Bash + relay JSON» (эталон: `autonomy-policy.cjs:480-487`, живые вызовы `validate-feature-impl.mjs:70,521-528`).
6. **MDP-гейт смоука (VC-118):** каждый `agent()` обязан нести `model:` **либо** `agentType:` **на той же строке**, что `label:` — иначе красный `tests/orchestrator/workflow-syntax.smoke.cjs` и сломанный `run-ledger.extractModelMap`.
7. **EOL:** `.gitattributes` пинит к LF **только скрипты**; `.md`/`.yaml`/`.json` при `core.autocrlf=true` материализуются CRLF. Любой парсер `.md`/`.yaml` обязан быть EOL-толерантным: нормализовать вход (`.replace(/\r\n/g,'\n')`) **или** `/^---\r?\n/` + `split(/\r?\n/)`. Голый `\n` = зелено на Linux, красный verify на Windows (прецедент G36).
8. **LESSON-гейт STRICT** (флип владельца 2026-07-11): PreToolUse **denies** мутирующие вызовы при неразрешённом маркере. Аварийно: `LESSON_GATE_MODE=warn`.
9. **`dev/_archive/` — read-only история** (`dev/README.md:18`). Правка архивного снапшота = фальсификация point-in-time записи.

### 8.3 Регистрация нового процесса — 4 обязательных места

1. `orchestrator/processes/<name>.mjs`
2. **`commands/orchestrator/run.md`** — строка в таблице «Available processes» + Pre-flight + блок `Workflow({scriptPath: '.claude/orchestrator/processes/<name>.mjs', args:{…}})` + пункт в «After the run»
3. `tests/orchestrator/<name>-wiring.test.cjs` + строка в `package.json` → `test:orchestrator`
4. Правило в `charter.ingest` (если процесс в fabric-линии)

**Жёстко:** `fabric-dispatcher-wiring.test.cjs:97-104` требует, чтобы каждый ключ `charter.ingest` присутствовал в `run.md` и как `` `<name>` ``, и как `processes/<name>.mjs`. Добавил в чартер, не обновил `run.md` ⇒ **красный `npm run verify`**.

**Плюс:** добавил команду / скилл / хук ⇒ обнови `commands/ecosystem/verify.md` (Step 4 floors + Step 9), иначе `check:inventory:strict` валит verify.

### 8.4 Полный брекет (что исполняет диспетчер)

```
RUN_ID=$(node .claude/orchestrator/lib/run-ledger.cjs start --process <p> --at "<ISO>" --args "<raw>")
Workflow({ scriptPath: '.claude/orchestrator/processes/<p>.mjs', args: {…} })
node .claude/orchestrator/lib/run-ledger.cjs finish --run-id "$RUN_ID" --at "<ISO>" \
     --process-path .claude/orchestrator/processes/<p>.mjs --result-file <result.json>
node .claude/orchestrator/lib/fabric-engine.cjs ingest --instance <id> --process <p> \
     --result-file <ТОТ ЖЕ файл> --at "<ISO>" --run-id "$RUN_ID"
```
**Часы — всегда вход** (`--at <ISO>`), штампует диспетчер.

### 8.5 Ловушка DEF-CTX-1 (A5) — сам долг врёт

`CONTEXT_AUDIT_D6.md:31` утверждает, что NFR проходит валидацию без обязательного `confidence`. **Неверно:** правило **C2** (`hooks/product/artifact-validate.js:180`) не type-scoped и ловит любой `status: active` без `confidence` — оно просто прячется на дефолтном тире `pilot`, но стреляет на `mvp`/`full`. ⇒ в NFR-ветку V-18 класть **только** `sanity_check`-специфику, иначе будет **двойной репорт**.

---

## 9. Чек-листы живых прогонов (Волна E) — для оператора на VM

> Все, кроме **E5-A**, требуют живой VM (§2). Держатся здесь, чтобы прогон не пришлось перепридумывать.

**E1 · PATCH_1.3.3 S2** — root cause прошлого N/A: `/integrator:scan` снял session-маркер **до** записи. **Фикс сценария:** запустить **многошаговую** команду (`/integrator:add <tool>` или `/integrator:research`), и **пока она в полёте** (стоит на approve-гейте, маркер жив) — Write в `.product/features/FM-SG-TEST.md`. Ждать: stderr `INTEGRATOR SCOPE GUARD` + новая `## PA-NNN`. Затем `n`, дать команде завершиться, проверить cleanup маркера.
**E1 · S4** — прошлый прогон ушёл в idempotent re-run, который **по конструкции** не доходит до Stage-2. **Фикс:** взять инструмент, которого **нет** в `.claude/integrator/active-tools.yaml` (идеально `local_dev.suitability: none`). Ждать env-блок + prod-only warning **до** approve-гейта. Отклонить.
**E1 · S5** — сразу после S2: тот же forbidden-write 3+ раза за минуту (ждать **1** PA), затем >60 с, повторить (ждать **+1** PA).

**E2 · PHASE_6 S1/S3** — нужна UI-фича (`has_ui: true`) **без** `<FM-id>-brief.md` и MK-записей. Если честной нет — обогатить на изолированной ветке и **зафиксировать deviation, не подделывать**. Ждать: brief → 🟡-гейт (**явный STOP**, silence ≠ continue) → approve → `current_step: D.2` → HTML-fallback с PA-записью.

**E3 · run-ledger** — **Шаг 0:** `ls -la .claude/orchestrator/runs/`. Если уже есть `<RUN_ID>/run.json` со `status: finished` + строка в `ledger.ndjson` — **компонент 2 закрывается инспекцией**, прогон не нужен. Каталог **гитигнорен** ⇒ через `git status` не виден.

**E4 · `/product:impl-sync`** — сначала read-only (`impl-evidence.cjs --json`), затем `--dry-run` (суммы бакетов обязаны сойтись с числом FM — `deprecated` тоже входит), затем скоуп-ограниченно `FM-NNN` (не `--all`). На `N` — файл FM **не изменился** (это и есть тест гейта).

**E5-A · Консилиум Tier A (БЕЗ VM, можно сейчас):**
```
node orchestrator/lib/autonomy-policy.cjs resolve --operation-class process-step --risk HIGH --env-tier staging --override L2
# ждать: {"disposition":"consilium-gate","level_applied":"L2","floor_hit":false}
node orchestrator/lib/autonomy-policy.cjs resolve --operation-class prod_deploy --risk HIGH --env-tier prod --override L3
# ждать: {"disposition":"human-gate","floor_hit":true}   ← floor непробиваем даже на L3
```
**E5-B · Tier B** — ключевой **никогда не проверявшийся** путь: **safe-fallback** (слабый/split/none вердикт → `human-gate`, парковка в owner-queue). `env_tier` ставится только через `.claude/orchestrator/fabric/limits.json` (CLI-флага нет!); после — вернуть `dev`.

---

## 10. Известные пробелы (честно: чего мы НЕ знаем)

- Байт-точный образец живого `CNT-*.yaml` — инстансы лежат **только в пилоте**; E.A строится по схеме (`docs/integrator-module/SPEC.md:471-519`), финальную форму придётся сверить после восстановления VM.
- Есть ли `packages/db` с Prisma-схемой в пилоте (`EPIC_E_READINESS.md:50` сам ставит это как «проверить при сборке E.A»).
- Работает ли `workflow()` (вложенный вызов процесса из процесса) в живом харнессе — `run.md:514-515` помечает это «Live caveat».
- Есть ли блок `autonomy:` в `.claude/product.yaml` пилота (вероятно нет — soft-миграция без backfill).
- Природа adapter-drift (stitch/open-design) на пилоте — в репо ровно одна строка.
- **Ambient-защиты от прямого `bash`-деплоя мимо резолвера НЕТ** (полного аудита манифестов не делали — исходить из того, что её нет).

---

## 11. ⏭ ШОВ — ЖИВОЙ ШОВ ПЕРЕЕХАЛ В `dev/plans/SEAM.md`

> **🔴 SSOT точки продолжения — [`dev/plans/SEAM.md`](SEAM.md) (`status: ACTIVE`), написан 2026-07-14 по шаблону v2 протокола контекстных швов (DEC-DEV-0202).** Там: дословная интенция владельца, инварианты и запреты, режим работы, проверяемое состояние, **SEAM-ACK** (обязательные чтения + 5 контрольных вопросов), следующий шаг в императиве, отброшенное и грабли среды.
>
> **Дублировать его сюда ЗАПРЕЩЕНО** (прецедент triple-declaration drift, DEC-DEV-0197 / D12). Ниже — **исторический** шов от 2026-07-13; он свою работу сделал (по нему вошли в сессию 2026-07-14: VM оказалась восстановлена, Шаг A исполнен). Оставлен как археология.

**Что изменилось после исторического шва (2026-07-14; детали — §12 и `SEAM.md`):** VM восстановлена владельцем · Epic E доставлен в пилот · E.A live PASS · E.D PASS (после 2 фиксов пилота) · E.G раунды 1-2 прогнаны → **§3.2 устоял (0 мутаций мимо гейта)**, но **деплой ни разу не состоялся**: вскрыты два структурных дедлока подряд (draft-контракт → PR #192; несоздаваемая сцена → PR #194) + стохастический парсер-гейт + run-ledger, терявший исход прогона. **11 находок, 6 фиксов экосистемы смёржено. Cut НЕ режется — S2 (сердце) не проверен.**

---

## 11-bis. Исторический шов (2026-07-13) — археология

> **Кто читает:** я (или следующая сессия) после того, как владелец починил VM. Repo-сторона Epic E ЗАВЕРШЕНА (`git log`: `db6d23d`→`9c03802`, PR #189). Здесь — строгий порядок «оживить пилот → прогнать → нарезать релиз». **Recovery-дисциплина: сначала верифицируй фактическое состояние (git/ssh/verify), не доверяй этому шву как факту — он снимок на 2026-07-13.**

> **🟢 ШОВ ВЗЯТ 2026-07-14.** Предусловие проверено фактами (не документом): VM жива (F1 исполнен владельцем) · PR #189 смёржен (`d6fefb5`, repo-сторона Epic E в main) · локальный `npm run verify` = **exit 0** · пилот был на 1.11.0. **Шаг A ИСПОЛНЕН** (снапшот + доставка + verify Healthy + wipe-protection удержала состояние). Кампания идёт по Шагу B — с пересмотренным порядком (см. врезку под Волной E).

### Предусловие (проверить ПЕРВЫМ, до всего)
```
# 1. VM жива?
ssh -p 2222 cc-dev@127.0.0.1 "uptime && systemctl is-system-running"   # ключ vm-claude-factory
# 2. PR #189 — смёржен владельцем? Если да — repo-сторона в main.
gh pr view 189 --json state,mergedAt
# 3. На VM: пилот на актуальном HEAD? Экосистема какой версии?
ssh ... "cd ~/projects/my-first-test && git log --oneline -1 && cat .claude/.ecosystem-version 2>/dev/null"
```
Скилл операторки VM — `vm-factory-ops` (ssh/снапшоты/tmux-пульт/harvest). Грабли VM — в нём же.

### Шаг A — доставка релиза в пилот (пункт 2, ПЕРЕД прогонами)
**НЕ резать релиз до прогонов (см. пункт 3 ниже) — доставляется рабочая ветка/main, не тег.**
1. Снапшот VM `pre-epic-e-run` (пред-deploy страховка).
2. На VM обновить экосистему до состояния с Epic E: `/ecosystem:update` (**онлайн-путь** — репо публичный; **НЕ `--offline`**: глобальный кэш протух на апрель, §Волна D2).
3. `/ecosystem:verify` = Healthy (версия согласована, 0 🔴). Если verify красный из-за DEF-CTX-6 (память на VM устарела) — это известный не-код-долг, `CONTEXT_HEALTH_STRICT=0` для обхода, не блокер деплоя.
4. Оснастить deploy-capability: `/integrator:provision deploy-staging` → CNT в `.claude/integrator/contracts/` (draft). **Здесь же закрыть пробел B2/§10:** сверить байт-точную форму CNT с реально записанным инстансом (E.A строился по схеме).

### Шаг B — прогоны Волны E (пункт 2), порядок по риску
Приоритет — **догоны Волны 1 приоритетнее новых Epic E** (substrate-graduation-гейт, §Волна E). Детальные чек-листы — **§9**. Порядок:
1. **E5-B консилиум Tier B** (§9 E5-B) — единственный никогда-не-проверенный путь = safe-fallback (слабый вердикт → human-gate). `.claude/product.yaml` вероятно без `autonomy:`-блока (§10) — добавить перед прогоном.
2. **E3 run-ledger live** (§9 E3) — Шаг 0 инспекцией (`ls .claude/orchestrator/runs/`), возможно уже закрыт.
3. **E4 `/product:impl-sync` live** (§9 E4).
4. **E1 (1.3.3 S2/S4/S5)** + **E2 (PHASE_6 S1/S3)** — §9, требуют подготовленного субстрата (живой маркер / свежая UI FM).
5. **E6 `/integrator:verify`** на пред-существующем adapter-drift (stitch/open-design).
6. **🆕 E.D — P7 живой boot** (`bootSmoke:true` на реальном dev-env пилота) — суб-фаза Epic E, `dev/gates/EPIC_E_SMOKE_TEST_PLAN.md` контекст.
7. **🆕 E.G — смоук Epic E deploy-контура** — прогнать `dev/gates/EPIC_E_SMOKE_TEST_PLAN.md` целиком (6 сценариев: happy deploy · **авто-rollback = сердце** · floor на prod · L1-гейт · просадка субстрата · rollback без предыдущего). **Executor/reviewer separation** (как batch-смоук 0177): исполнитель прогоняет, нейтральный судья грейдит по транскрипту.

Каждый прогон: evidence (ledger/run.json/events.ndjson/PA), вердикт, findings → DEV_JOURNAL, дефекты → follow-up фиксы.

### Шаг C — cut релиза (пункт 3, ПОСЛЕ live-валидации)
**Триггер cut — S1-S3 смоука Epic E = PASS** (deploy-контур live-валидирован). Не раньше.
1. `checklists/patch-cut.md` — нарезать из `[Unreleased]` (там накоплено: Волна A + весь Epic E; это **minor** → 1.12.0).
2. Тег + cut-коммит + ROADMAP «Где мы сейчас».
3. Доставить тег в пилот (если прогоны шли на рабочей ветке — переключить пилот на релиз).
4. Epic E graduation: обновить `EPIC_E_READINESS.md` (E.D/E.G done), `SUBSTRATE_GRADUATION_GATE.md` (компонент run-ledger).
5. Memory-sync + закрыть кампанию в этом трекере.

### Если что-то вскрылось на прогоне
Дефект deploy-контура на живом субстрате → follow-up фикс на repo-стороне (executor/reviewer как в этой сессии) ПЕРЕД cut. Cut фиксирует **валидированное** состояние, не «построенное».

---

## 12. 🔬 Находки live-прогона Epic E (2026-07-14) — то, ради чего смоук и гоняют

> Прогон E.D дал **зелёный вердикт и тут же показал, что зелёный слабее, чем выглядит**. Ни одна из находок не была видна repo-side: юнит-тесты проходили, `verify` = exit 0.

| # | Находка | Корень (координата) | Последствие | Статус |
|---|---|---|---|---|
| **FIND-1** | **`env-readiness` без клиентских утилит → вечный `DEGRADED`** | `env-readiness.cjs:116-122`, `:168`, `:176` — нет `pg_isready`/`redis-cli` ⇒ `status: unknown` ⇒ DEGRADED (safe-by-design) | **Любой staging-деплой даже на L3 → `human-gate`** (`applyReadinessGuard` понижает `auto` по DEGRADED). На чистой машине автономный деплой **недостижим**, а причина («не установлен psql-клиент») от симптома («деплой всегда просит человека») отстоит далеко | 🔧 стенд оснащён (`postgresql-client` + `redis-tools` → проба даёт `READY`: `postgres: accepting connections`, `redis: PONG`). Repo-фикс — **F5** (actionable reason) |
| **FIND-2** | **`envProbe.reasons` выбрасываются** ⇒ гейт деплоя неаудируем | `runtime-smoke-readiness.mjs:143-149` получает `{readiness, reasons}`, логирует reasons, а в return `:219` несёт **только** `readiness` | В `run.json` **нет ни строки** о том, ПОЧЕМУ readiness такой. Гейт, решающий `auto` vs `human-gate`, стоит на неаудируемом слове релея. Доказано на практике: чтобы узнать причину DEGRADED, пришлось руками лезть пробой на VM | 🔧 фикс **F2** |
| **FIND-3** | **🔴 Namespace-рассинхрон ключа фичи — P7 месяцами судил БЕЗ проверки capability** | `capabilitiesFor` (`runtime-readiness.cjs:404-432`) ищет в `.product/features/` по FM-id; `run.md:233` предписывает подавать **cc-sdd slug** из `.kiro/specs/`. Промах → `:422` → `capabilities_unknown: true` | P7 выносит вердикт **без §6 capability-проверки** («a hard boot-blocking capability may be hidden»). **Почему не всплывало: подстрочная лотерея** — у 5 из 6 фич пилота kiro-слаг случайно оказался подстрокой имени FM-файла (`auth` → `FM-001-authentication`), и fuzzy-`includes` маскировал контрактный разрыв. FM-006 (`conversion-measurement` ↔ `FM-006-conversion-dashboard`) — первая, где слаги разошлись. Проверено живьём: `--feature FM-006` → `capabilities_unknown:false`, `--feature conversion-measurement` → `true` | 🔧 фиксы **F3** (громкий нерезолв) + **F4** (контракт в доке) |
| **FIND-4** | **`--app` не пробрасывается — совет в disclosure физически невыполним** | Либа умеет (`runtime-readiness.cjs:444`, `:480-486`) и сама же советует «pin explicitly with `--app <dir>`» (`:246`); процесс не передаёт (`runtime-smoke-readiness.mjs:154`), команда ключа не имеет. Тот же разрыв в пред-флип ре-пробе деплоя (`deploy-to-stage.mjs:224`) | `sourceRank` (`:111-120`) ставит `scripts.dev` выше `scripts.start` ⇒ `apps/web` детерминированно обгоняет `apps/api`. **Для бэкендной фичи всегда бутится фронтенд** — живой прогон именно это и сделал (FM-006 `has_ui:false`, а бутнулся Next.js). Бэкендный дефект (env/миграция/секрет) на статичной главной не всплыл бы | 🔧 фикс **F1** |
| **FIND-5** | run-ledger: верхнеуровневое `readiness: null` при вложенном `verdict.readiness: DEGRADED` | писатель `run-ledger.cjs` | несогласованность трейса (в соседней строке от 2026-07-10 поле заполнено) | ✅ закрыт вместе с FIND-7 (PR #191) |
| **FIND-6** | `run_target_candidates` / `success_signals` не эмитируются в результат (живут прозой в `disclosures` / `diagnosis`) | `runtime-smoke-readiness.mjs` return | схема-дрейф: либа поля вычисляет (`runtime-readiness.cjs:266`), процесс их теряет | ⬜ минор, в очередь |
| **FIND-7** | **🔴 run-ledger ТЕРЯЛ исход прогона — упавший бут писался как зелёный** | `run-ledger.cjs::summarizeResult` читал только `r.result`; **P7 отдаёт `p7_result`, P5 — `go_gate`** | Живой бут упал (`FAILS_TO_START`) — в трейсе `result: null`, **неотличимо от зелёного**. Вторая потеря (P5) тянет за собой consumer-zone: `impl-evidence.cjs` ищет «latest gate verdict across **P5**/P6 runs», но гейтит по `rs.result` ⇒ **не видел ни одного P5 никогда** (это сенсор `/product:impl-sync`). **Почему выжил:** юнит-фикстура леджера гоняла поле `counts`, которого нет ни в одном из 8 процессов — тест соглашался с кодом, а не с реальностью; а `null` означал сразу «исхода не было» (норма) и «был, но промахнулись ключом» (авария) — дефект был неотличим от нормы | ✅ **починен (PR #191, DEC-DEV-0200)**: `OUTCOME_KEYS` + провенанс `outcome_key` + самодисклоз `unread_outcome_keys` + GUARD, сверяющий исходники процессов с контрактом леджера |
| **FIND-8** | **🔴🔴 АРХИТЕКТУРНЫЙ ДЕДЛОК E.A→E.B: первый деплой невозможен В ПРИНЦИПЕ** | Категориальная ошибка: `draft` смешан с readiness. `deploy-to-stage.mjs:214` (`manifestOk = present && status !== 'draft'`) + промпт парсера `:211` («status is draft-only → `present:false`») | E.A **обязан** отдать CNT `draft` (не вправе объявить `active` до живой верификации) → E.B отказывался деплоить не-`active` (`ENV_NOT_READY` → `BLOCKED`) → **живая верификация возможна только через деплой**. Замкнутый круг. Живой `deploy_result.json`: `disposition: null` — **резолвер §3.2 даже не вызывался**, префлайт закоротил раньше ⇒ мутирующая ветка гейта была недостижима и непротестирована. **Хуже: блок случайно делал работу гейта** — сними его наивно, и `L3×staging` отдал бы **молчаливый auto-деплой** по контракту, который никто не верифицировал (проверено прогоном до-фиксного резолвера: `deploy_staging × staging × READY × L3 → auto`) | ✅ **фикс DEC-DEV-0201 (PR #192):** оси разведены. `present` = факт (файл есть + парсится + несёт step-list) → `ENV_NOT_READY` как и раньше; `status: draft` = **доверие** → едет в резолвер как `--contract-status` (**`applyContractGuard`**: `auto → human-gate`, **не** block) + `--accept-draft-contract` (явная санкция владельца). **Floor неприкосновенен by construction** (`resolve()` early-returns `floor_hit` до любого guard'а; guard только понижает). Цикл замкнут: `DEPLOYED` возвращает `contract_evidence` (CNT + RUN_ID + вердикт) — **§8.3: сообщает, не флипает** |
| **FIND-9** | **⭐ Улов P7-гейта: 865 зелёных тестов над не-бутящимся продом** | 2 DI-дефекта в пилоте (`EMAIL_PORT` не в `exports[]`; rate-limit-гвард просил стор по class-токену, а тот провидится под строковым). Nest падает на **первой** нерезолвимой зависимости ⇒ дефекты снимаются слоями | **Это не дефект экосистемы — это её УЛОВ, и сильнейший аргумент за P7.** Почему тесты молчали: под vitest/esbuild нет `emitDecoratorMetadata` ⇒ Nest-enhancer видел **ноль** ctor-параметров ⇒ конструировал гвард с `store === undefined` **без DI-ошибки**, а fail-open `catch` в `canActivate` (NFR-007) глотал вытекающий TypeError ⇒ **тихий admit**. Под прод-сборкой (`nest build`, tsc, metadata ON) paramtype эмитится → Nest резолвит class-токен → **краш**. **Дефект существовал ТОЛЬКО в прод-сборке.** Побочно: rate-limit-троттл (NFR-007) в интеграционных тестах был **фактическим no-op** — security-контроль не проверялся вообще, хотя тесты по нему зелёные. **Урок: suite-green ≠ prod-boot; P6 (build+тесты) не заменяет P7 (живой boot) — и именно поэтому D-7 ставит их разными гейтами** | ✅ починено в пилоте (`e602110`, `43361c4`); api бутится, `GET /health` → **200**, сьют 865/865 PASS |

**Урок FIND-8 (почему repo-side не поймал).** Обе стороны стыка по отдельности **корректны и юнит-покрыты**: E.A «не объявляй `active` без верификации» — правильно; E.B «не деплой неоснащённую capability» — тоже правильно. Дефект живёт **в стыке двух правильных правил** и виден только на **первом реальном деплое**. Это тот же класс, что FIND-3: контрактный разрыв между двумя корректными компонентами, который не ловится фикстурами (тесты гоняли `present:false` и `present:true/active` — ячейку `present:true/draft` никто не спросил, потому что обе стороны «очевидно правы»). **Правило:** когда компонент A обязан произвести артефакт в состоянии X, а компонент B отказывается работать с состоянием X — это дедлок, даже если оба правила выглядят разумно. Ищите такие пары **до** живого прогона: «кто может вывести систему из состояния X, если вход в X обязателен?»

**Урок FIND-8b (ловушка починки).** Наивное «просто убрать ложный блок» было бы **регрессией безопасности под видом багфикса**: ложный `ENV_NOT_READY` оказался **единственным**, что стояло между непроверенным контрактом и молчаливым авто-деплоем — он делал работу гейта случайно, не на своей оси и ценой дедлока, но делал. **Правило: снимая блокировку, сначала проверь, что она НЕ несёт побочной защитной функции** — иначе «фикс» откроет дыру, которой до него не было. Проверяется одним прогоном: что вернёт система, если блокировку убрать, а больше ничего не менять?

**Урок кампании (в DEV_JOURNAL):** FIND-3 — эталон того, зачем нужен live-прогон на **реальном** субстрате. Дефект был *контрактным* (два каталога, два ключа), но **маскировался случайным совпадением имён** в 5 случаях из 6. Ни один юнит-тест его не ловил — тесты гоняют фикстуры, где имена совпадают by construction. Вскрыла его единственная фича, где нейминг разошёлся.

**Дисциплинарный урок (мой промах):** запустив аналитика на read-only разбор, я **параллельно доустановил клиенты БД на VM** — и аналитик, увидев мир уже после мутации, ошибочно атрибутировал DEGRADED «искажению LLM-релея, причина не установлена». Правило «не мутируй субстрат, пока по нему идёт чтение» — не бюрократия: оно ровно про это.

---

## Журнал кампании (append-only)

- **2026-07-13** — Кампания заведена (DEC-DEV-0198). Pre-flight выполнен: 7 агентов, вскрыты 2 переворачивающих факта (VM недоступна физически; E.F нельзя откладывать за E.B/E.C) и 2 новых дефекта bootstrap (A8). Решения владельца №1-№6 зафиксированы (§1); №3 делегирован мне и решён (§7).
- **2026-07-13** — **Волна A завершена** (5 зон, каждая строитель+адверс-проверяющий, verify exit 0; PR #189). Owner-gate после E.A пройден: `/integrator:provision` + строить весь repo-side.
- **2026-07-14 (поздний)** — **E.G раунд 1: §3.2 устоял, но дедлок вскрыт.** Прогнаны E.A live (PASS), E.D ×2 (PARTIAL → честный перепрогон), S6.1/S6.2. **Главное:** `rollback × staging → auto` на **дефолтном L1** подтверждён дословным JSON резолвера — авто-откат работает без человека, как проектировалось. **Но deploy-ветка гейта недостижима: FIND-8 (дедлок E.A→E.B)** — `draft`-контракт трактуется как `ENV_NOT_READY`, деплой коротит до вызова резолвера. Живой субстрат вскрыл **9 находок** (§12), из них 3 уже починены и смёржены (PR #190 — контракт ключа фичи / `--app` / аудируемый readiness; PR #191 — run-ledger терял исход P7 и P5). **Cut НЕ режется** — триггер §11 Шаг C (S1-S3 PASS) не выполнен, мутирующая ветка §3.2 непротестирована.
- **2026-07-14** — **🟢 БЛОКЕР СНЯТ, КАМПАНИЯ ПРОДОЛЖЕНА.** Владелец исполнил **F1** (Hyper-V/VBS off) — VM вернулась на нативный VT-x, весь VM-gated остаток разблокирован. Шов §11 взят: **Шаг A исполнен** (снапшот `pre-epic-e-run` → `/ecosystem:update` онлайн → пилот `c4f1170` на `d6fefb5` → `/ecosystem:verify` ✓ Healthy → wipe-protection удержала 7 FM / PA-очередь / 3 fabric-инстанса / ledger / integrator-состояние; charter в пилоте = v5). **E3 закрыт инспекцией** (ledger писал 13 живых прогонов — новый прогон не нужен) ⇒ приоритет Волны E развёрнут на критический путь Epic E (врезка под Волной E). Вскрыт ресурсный потолок: живые прогоны жгут недельный лимит VM-аккаунта (`7d 90%`) — разведка переведена на ssh-CLI (для лимита бесплатна).
- **2026-07-13** — **🎯 REPO-СТОРОНА EPIC E ЗАВЕРШЕНА.** Построено+закоммичено: E.A (deployer capability) · B4 F3-core (floor непробиваем на L3) · `/integrator:provision` · E.B/E.C (deploy-брекет чартера v5, §3.2 на 2 слоях) · E.E (healthcheck-звено) · C2 (смоук-план). Коммиты `db6d23d`·`20f5a05`·`17b1bde`·`ae94e7b`. Каждый крупный кусок — дизайн→сборка→адверс-проверка (opus), все PASS. **Остаток кампании — ВЕСЬ VM-gated и ждёт владельца:** починка VM → доставка → Волна E прогоны (E.D boot, E.G смоук, догоны Волны 1, консилиум Tier B, run-ledger live, impl-sync live) → cut релиза после live-валидации.
- **2026-07-14 (раунд 3, шаги 1-2 шва + S1 попытка 1)** — **Шов `dev/plans/SEAM.md` взят новой сессией (SEAM-ACK возвращён владельцу).** Снапшот VM `round3-pre-run` (офлайн). **Шаг 1 — доставка PASS:** пилот `fca121f → 42827f8` (sync `4fe8748`, 7 файлов, 0 removed, wipe-protection цела), verify ✓ Healthy, sha256 `deploy-to-stage.mjs` = эталон byte-for-byte. **Шаг 2 — пере-провижн PASS:** CNT-005 переавторен под `deploy-manifest.cjs` schema_version 1 (коммит пилота `5375159`), все 3 systemd-шаблона на `{{CURRENT_LINK}}`, `{{RELEASE_DIR}}` в директивах — ноль. **S1 попытка 1 (run `…kvikd4`): `DEPLOY_FAILED × READY`, `flipped: false`** — префлайт build/test корректно закоротил деплой: сьют пилота 1 failed / 91 passed — **реально флаки-тест BR-079** (advisory-lock concurrency, ~25% flake: тест не форсирует overlap джоб; когда джобы не перекрылись — обе легитимно `published`). **Подтверждено живьём: фикс #192/#194 работает** — draft CNT-005 больше НЕ роняет readiness (`READY`, trust-ось в reasons); §8.3 чист; самолечения нет (docker StartedAt = базлайн). §3.2-резолвер/scene-bootstrap не достигнуты (умерло раньше) ⇒ S2 всё ещё не проверен. Фикс флаки-теста пилота (apps/** — субстрат, правка разрешена) → ре-ран S1. **Наблюдения в копилку:** (а) интерактивный гейт `/ecosystem:update` не показался — changeset применён напрямую (исход чист, но поведенческое расхождение с контрактом update.md); (б) ghost-текст в TUI ×3 за день, один раз — с вредным содержанием («fix the flaky test then re-run») — не сабмичен; (в) `node --check` непригоден для workflow-`.mjs` (top-level return легален в async-обёртке) — ложная тревога, подтверждено на 8/8 процессов чистого main; (г) минорные дефекты экосистемы в очередь пост-раундовых фиксов: P7-вердикт попадает в P6-слот дисклоужера runtime-readiness; `readiness_reasons: null` в ledger-строке на `DEPLOY_FAILED`-арме (в wf-json есть — проекция снова роняет, ср. урок 38).
- **2026-07-14 (раунд 3, S1 ре-ран `kxe0ls` + фикс 0205)** — Флаки BR-079 устранён правкой ТЕСТА пилота (`aa7a049`: приложение корректно — лок работает; тест не гарантировал перекрытие из-за ленивого прогрева Prisma-соединений; теперь overlap драйвится инжектируемым швом; 12/12+3/3 зелёных, сьют 92/92 ×4). **Ре-ран S1: `DEPLOY_FAILED × READY`, `flipped: false` — но три «впервые живьём»:** (1) §3.2-резолвер ВЫЗВАН на живом пути — `disposition: auto`, `level_applied: L3`, `floor_hit: false`, draft-контракт с явной санкцией `--accept-draft-contract` (фиксы 0201 работают); (2) **scene-bootstrap 0203 исполнен и корректен** — сцена `~/deploy/my-first-test` из 13 объектов, пер-релизный `node_modules` (686 pkgs, 7.3 с с тёплого стора), `.env`→shared симлинк, юниты на `current`; (3) деплой дошёл до build ВНУТРИ чистого релиза — и упал ровно там: **FIND-C1** (в манифесте нет шага `prisma generate` ⇒ TS2305 в `packages/db` — чистый пер-релизный node_modules не несёт сгенерённого клиента, dev-чекаут маскировал) + **FIND-C2** (bare `pnpm` в ExecStart `mft-web.service` ⇒ упал бы 203/EXEC на рестарте). Flip не было, `current` не создан, rollback корректно не предписан, §8.3 чист, самолечения нет (docker StartedAt = базлайн). **Фикс 0205 построен и verify=0** (builder + адверс-мутации A1-A3): скилл предписывает codegen-шаг первым в step-list + прозрачную форму migrate + запрет bare ExecStart (введён `{{PNPM_BIN}}` с материализатором в scene-bootstrap); гейт `deploy-manifest.cjs` → `manifest-missing-prisma-codegen` + `unit-execstart-bare-command`; негатив-тесты деривируются из реальной формы. Ghost-текст ×4-5 за день, самый опасный — `/integrator:provision deploy-staging --repair` сразу после DEPLOY_FAILED (не сабмичен; вывод: это TUI-подсказки, принимаются только явным Enter). Next: PR → merge (мандат) → доставка → ре-провижн (манифест переавторится с codegen; текущий инстанс с opaque `db:migrate:deploy` начнёт флагаться) → S1 третий заход → S2 → S5.
- **2026-07-14 (раунд 3, заход 3 `l1fi9c` + фикс 0206)** — Фикс 0205 смёржен (PR #198, main `fa38f16`) → доставлен в пилот (sync `f9992a3`, verify Healthy) → пере-провижн: deployer хирургически закрыл FIND-C1/C2 (`1a774a6`; codegen-шаг на месте, все ExecStart через плейсхолдеры, валидатор `blocking_defects: []`; **отклонение deployer'а: migrate остался opaque `db:migrate:deploy`** — документированное слепое пятно гейта, до-фикс при следующем провижне). **S1 заход 3 (`l1fi9c`): `DEPLOY_FAILED` — ЛОЖНО-НЕГАТИВНЫЙ.** Build зелёный (фиксы 0205 живьём работают), но build-test-агент сам выставил 5-мин таймаут на ~7.5-мин сьют → kill → fire-and-forget фон → бросил через ~1 мин → `passed:false` (UNKNOWN); **брошенный фон доработал сам и был 100% зелёным** (865/865 api + 92/92 integration + 14/14 e2e). Диагност сравнил три прогона: успешные выигрывали единственным приёмом — блокирующий вызов с timeout ≥ сьюта; промпт стадии стратегию ожидания не структурировал вовсе (знание ≠ исполнение). Оператор поймал и остановил попытку диспетчер-сессии ре-драйвить после терминального исхода. **Фикс 0206 построен, verify=0:** промпт-структура ожидания (build 1 блокирующий вызов `timeout:600000`; сьют пер-workspace блокирующие вызовы; запрет фона/раннего вердикта) + развод осей измерения/вердикта (`suite_completed`; UNKNOWN → `BLOCKED × READY / test-gate-incomplete` → `runtime_gate_retry` ре-ран, НЕ escalate). Хост-зеркало того же класса: 4/4 оператора-субагента уснули на фоновых мониторах вопреки текстовому запрету — бужу SendMessage'ами, урок вписан в шов. Next: merge 0206 → доставка → **S1 заход 4** → S2 → S5 → cut.
- **2026-07-15 (раунд 3 финал прогонов: S1 ✅ · S2 ✅ · S5 = новый дефект)** — Resume после паузы владельца; VM поднята со снапшота-состояния, попутно устранён битый бинарь claude на VM (ре-даунлоад той же 2.1.209; замечен дрейф конфига VM `cpus=4` при решении владельца 12 — не трогали). Доставка `c91f17e` (sync `efcf2f1`). **S1 заход 4 (`l62yt4`): `DEPLOYED × READY` — ПЕРВЫЙ ЖИВОЙ ДЕПЛОЙ ЛИНИИ** (29м21с): build-test гейт 0206 дождался полной суиты (`suite_completed: true`, 1583 passed / 0 failed, per-workspace тайминги в disclosures), §3.2 auto@L3, scene выложил `20260714T215121Z`, codegen→build→migrate(7/0)→атомарный флип→restart, healthcheck 200 attempt 1/3; `contract_evidence` = CNT-005 live-verified (флип draft→active — прерогатива Integrator, §8.3 чист). **S2 (СЕРДЦЕ) ✅ двумя частями + бонус:** (бонус `l7py9k`) первая инъекция `PORT=70000` поймана scene-гейтом ДО мутации (`BLOCKED × ENV_NOT_READY`, flipped:false — pre-mutation env-санация работает); (часть A `l8m24o`) инъекция `NODE_OPTIONS=--max-old-space-size=1` невидима статически → полный конвейер → **флип релиза `225645Z` → V8 умирает на init → healthcheck fail → `DEPLOY_FAILED × flipped:true`**; диспетчер НЕ дёрнул слепой rollback — верно вычислил «яд в shared отравит и откат» и спросил владельца (в fabric-пути маршрут детерминирован; наблюдение: pre-highlighted «remove and re-deploy (recommended)» = один Enter от ре-драйва); (часть B `l9zt0w`) после починки среды `rollback-release` БЕЗ override: **резолвер дословно `auto / L1 / floor_hit:false`** → атомарный своп `current → 215121Z` (известно-хороший) → healthcheck 200; релизы не удалялись, инфра не тронута. **Триггер cut (S1-S3 PASS) ВЫПОЛНЕН.** **S5 (`lah60w`) — ВСКРЫТ ДЕФЕКТ, прогон contaminated, не засчитан:** env-readiness корректно дал `ENV_NOT_READY` (Redis поимённо), но короткого замыкания префлайта НЕТ — build-test запустился на мёртвой среде, его агент **сам вылечил субстрат** (`docker start mft-redis`, «required by api test suite») — §6-прецедент воспроизведён на уровне стадии; оператор убил сессию до мутаций (флип не случился, релиз жив). **FIND-E1** (нет early-BLOCKED после env-readiness при ENV_NOT_READY) + **FIND-E2** (промпты стадий без запрета мутаций субстрата) → фикс DEC-DEV-0211 (в сборке) → ре-ран S5 → cut 1.12.0. Ghost-текст пополнился опаснейшим: «flip CNT-005 to active if deployed». Rollback-gap disclosed прогоном S1: у ПЕРВОГО флипа нет цели отката (`PRIOR_RELEASE_DIR=<none>`) — кандидат на явную ветку в E.C (S6.2-путь уже PASS).
