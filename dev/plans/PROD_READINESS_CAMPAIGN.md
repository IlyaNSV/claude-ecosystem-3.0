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

## 2. ⚠ ГЛАВНАЯ ПОПРАВКА РЕАЛЬНОСТИ: VM недоступна ПРЯМО СЕЙЧАС

**Факт (`dev/context-audit/SEAM.md` §4.5, датировано 2026-07-13):** ssh на VM **не поднимается**. Это **не** sshd и **не** NAT — NAT-правило цело, адаптер `on`. Гость **не доходит до userland**: `GuestAdditionsRunLevel=0`, ноль guest-логов за 22 минуты.

**Корень — виртуализационный стек хоста, не код:** VirtualBox исполняется **не на VT-x, а по Hyper-V/NEM-пути** (`HMR3Init: Attempting fall back to NEM: VT-x is not available`); на хосте `HypervisorPresent: True`, VBS + Credential Guard включены. Гость ползёт на ~¼ скорости (`TM: Giving up catch-up attempt … 902 s` отставания за 22,5 мин) и просто **не успевает догрузиться до sshd**. Это **crawl, не hang**.

**Что из этого следует для порядка работ (§1 п.5):**

- **Repo-сторона Epic E (E.A · E.B · E.C · E.E · E.F) — строится БЕЗ VM.** Волны A/B/C идут в полном объёме прямо сейчас. Решение владельца соблюдено.
- **Живые ноги — жёстко заблокированы:** E.D (P7 живой boot), E.G (live-смоук deploy→rollback→floor), **все четыре догона Волны 1**, Tier-B консилиума.
- ⇒ **Починка VM должна случиться ДО фазы прогонов, а не «в самом конце».** Это единственное отклонение от буквы решения №5 — и оно не по вкусу, а по факту: «обновить пилот» физически невозможно на мёртвой VM.
- **Чинит владелец, не агент:** отключить Hyper-V / VBS / Credential Guard (Windows features + BIOS + перезагрузка). Ни один исполнитель этого не сделает.

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
| **B2 = E.B** | `orchestrator/processes/deploy-to-stage.mjs`: build+test → P7 boot-гейт → deploy staging (`releases/<ts>` + флип `current`-симлинка, systemd) → healthcheck. **Acceptance (§3.2): зовёт `autonomy-policy resolve` через CLI-seam + двухосный контракт `result × readiness`** (образец — `validate-feature-impl.mjs:530-548`) | ⬜ | 4 места регистрации, см. §8 |
| **B3 = E.C** | `orchestrator/processes/rollback-release.mjs` (симлинк-swap). **`rollback` — ОТДЕЛЬНЫЙ operation-класс, НЕ `destructive`** (тот во floor ⇒ классификация «по смыслу» сломает staging-авто-rollback и решение владельца) | ⬜ | — |
| **B4** | **F3-core, поднято из E.F (§3.2):** `resolveDisposition` → per-state `env_tier` (`meta.env_tier \|\| env.limits.env_tier`); `operation_class`/`risk` в states чартера; снятие затычки «L3≡L2» (`autonomy-policy.cjs:215-216`) | ⬜ | — |
| **B5 = E.D** | P7 живой boot (`bootSmoke:true`) на реальном dev-env пилота | 🚫 | **VM-gated** |

### Волна C — Epic E2 (monitoring + смоук)

| ID | Задача | Статус | Примечание |
|---|---|---|---|
| **C1 = E.E** | Healthcheck → PA/owner-queue. **Ловушка: НЕ строить новую машинерию** — `smokePlan({healthCheck})` уже живой и покрыт юнитом (`runtime-readiness.cjs:283`, тест `:169`). Мёртво **ровно два места**: кейс `--health-check` в `parseArgs` (`:434-451`) + проброс на call-site (`:510`). Failure-таксономия (5 классов, `:296-304`) — переиспользовать | ⬜ | — |
| **C2 = E.G-план** | Смоук-план Epic E как док (deploy → healthcheck PASS → индуцированный провал → auto-rollback → floor-гейт на prod-таргете) | ⬜ | — |
| **C3 = E.G-live** | Прогон C2 | 🚫 | **VM-gated** |

### Волна D — Релиз + доставка

| ID | Задача | Статус |
|---|---|---|
| **D1** | Cut релиза с Epic E | ⬜ |
| **D2** | Доставка в пилот (`/ecosystem:update`). **Внимание:** глобальный кэш `~/.claude/ecosystem` протух на 3 месяца (HEAD `bd42332`, апрель) ⇒ `--offline` поставил бы апрельскую экосистему. Онлайн-путь безопасен (репо публичный) | 🚫 **VM-gated** |

### Волна E — Живые прогоны (почти все VM-gated)

| ID | Задача | Статус |
|---|---|---|
| **E1** | PATCH_1.3.3 **S2/S4/S5**. Root cause прошлого N/A — не «не успели»: S2 — `/integrator:scan` снял маркер до записи; S4 — executor ушёл в idempotent re-run, который по конструкции не доходит до Stage-2. Фиксы сценариев — §9 | 🚫 VM |
| **E2** | PHASE_6 **S1/S3** (нужна честная UI FM без готового дизайна) | 🚫 VM |
| **E3** | run-ledger live. **Шаг 0 (дёшево):** `ls -la .claude/orchestrator/runs/` — возможно, компонент 2 закрывается **инспекцией**, без нового прогона | 🚫 VM |
| **E4** | `/product:impl-sync` live | 🚫 VM |
| **E5-A** | **Консилиум Tier A — детерминированный sanity, БЕЗ VM** | ✅ **2026-07-13 — PASS.** `staging + L2` → `consilium-gate`, `floor_hit:false`. `prod_deploy + L3` → `human-gate`, **`floor_hit:true`** — floor непробиваем даже на L3, подтверждено детерминированно (не по документу) |
| **E5-B** | Консилиум Tier B — полный dogfood; ключевой непроверенный путь = **safe-fallback** (слабый/split вердикт → `human-gate`) | 🚫 VM |
| **E6** | `/integrator:verify` на пред-существующем adapter-drift (stitch/open-design) | 🚫 VM |
| **E7** | E.D + E.G live | 🚫 VM |

### Волна F — Восстановление VM (владелец)

| ID | Задача | Статус |
|---|---|---|
| **F1** | Вернуть VT-x: отключить Hyper-V / VBS / Credential Guard + reboot. **Операция владельца** | 🚫 **ждёт владельца** |
| **F2** | GUI VM (для скриншотов и оркестрации сессий) | ⬜ |

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
| «чартер — YAML» | **JSON.** `orchestrator/charters/feature-production-line.json`, `"version": 4` |
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

## Журнал кампании (append-only)

- **2026-07-13** — Кампания заведена (DEC-DEV-0198). Pre-flight выполнен: 7 агентов, вскрыты 2 переворачивающих факта (VM недоступна физически; E.F нельзя откладывать за E.B/E.C) и 2 новых дефекта bootstrap (A8). Решения владельца №1-№6 зафиксированы (§1); №3 делегирован мне и решён (§7).
</content>
</invoke>
