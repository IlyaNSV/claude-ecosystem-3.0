# Orchestrator Module — SPEC

> **Статус:** первые процессы **P3–P6 построены и live-validated** (DEC-DEV-0073…0104) — `batch-features-to-cc-sdd`, `audit-spec-fidelity`, `feature-to-tdd-impl`, `validate-feature-impl`. Этот документ — исходный **дизайн-харвест** `v1.0-draft (dogfood RUN 01)` (2026-06-14, DEC-DEV-0073; сессия `6dc62bc8`, см. `dev/ORCHESTRATOR_DOGFOOD_RUN_01.md`, прожившая цепочку D2-T → D3-impl → validation → runtime); разделы **[RUN 01]** эмпирически обоснованы прогоном. **Открыты:** §6-канал на D3, P2/P7, scope первого инкремента (OD10). Живой статус — [ROADMAP «Где мы сейчас»](../../ROADMAP.md#где-мы-сейчас).
> **Роль:** «Тимлид PMO» — runtime-владелец зон D2-Technical + D3 и выше. Берёт PMO-процесс и проводит его **end-to-end** силами role-агентов, действующих по регламентам.
> **Не путать с:** Integrator Module (он *ставит и настраивает* инструменты; Оркестратор их *запускает*) и Product Module (он владеет `.product/` и бизнес-решениями).
> **Читать вместе с:** [../integrator-module/SPEC.md](../integrator-module/SPEC.md) (§8 граница, §14 tool-docs), [../pmo/pmo-map.md](../pmo/pmo-map.md) (D2-T/D3/D4 декомпозиция), [DEC-DEV-0040 Q3](../../DEV_JOURNAL.md) (production routing вырезан Phase 5 → Оркестратор), [DEC-DEV-0058](../../DEV_JOURNAL.md) (направление), [DEC-DEV-0073](../../DEV_JOURNAL.md) + [`dev/ORCHESTRATOR_DOGFOOD_RUN_01.md`](../../dev/ORCHESTRATOR_DOGFOOD_RUN_01.md) (этот harvest).

---

## 1. Роль и граница ответственности

### 1.1. Что делает Оркестратор

- **Проводит PMO-процессы от начала до конца** в зонах D2-Technical + D3+ (исполнители): взять фичу/релиз в разработку, тестирование или полный цикл; выкатить из dev на stage; откатить релиз.
- **Классифицирует задачу и маршрутизирует** её на нужный инструмент(ы) — читает `tool-docs/`, `active-tools.yaml`, `pmo-mapping.yaml`, `contracts/` (всё — выход Интегратора).
- **Руководит role-агентами** («сотрудники-ИИ»), которые исполняют шаги по регламентам.
- **Запрашивает у Интегратора недостающую capability** — «руки» (tool/MCP/доступ) и/или «голову» (role-агент + предметный skill), когда их не хватает для шага. Интегратор **оснащает**; инфра-шаг **исполняет сам Оркестратор** оснащённой capability (например: не «Интегратор, подними pgsql», а «Интегратор, обеспечь docker MCP + role-агента `db-admin`+skill» → дальше Оркестратор сам разворачивает БД). См. §6.
- **Сводит результат через verification-гейты** — путь динамичен, выход обязан соответствовать контракту (§2).

### 1.2. Что Оркестратор НЕ делает

- Не ставит и не настраивает инструменты и **не оснащает себя сам недостающей capability** (tool/MCP/role-агент/skill) — это Интегратор; запрашивает через §6.
- Не редактирует `.product/` и не принимает бизнес-решения — это Product Module / человек.
- Не пишет SPEC PMO-процессов — это `docs/pmo/`.
- Не обходит approve-гейты на необратимых/prod/затратных операциях (§7).

### 1.3. Граница с Интегратором (двусторонняя)

Текущие доки описывают связь **односторонне** (`Integrator → tool-docs → Orchestrator`, read-only). Этот концепт добавляет **обратный командный канал** (§6). Итоговая граница:

| Действие | Integrator | Orchestrator |
|---|---|---|
| Обеспечить capability: tool / MCP / role-агент / skill | ✅ | ❌ (но *запрашивает*, §6) |
| Исполнить инфра-шаг (deploy / provision БД) оснащённой capability | ❌ | ✅ |
| Запустить инструмент / процесс | ❌ | ✅ |
| Классифицировать задачу, маршрутизировать | ❌ | ✅ |
| Готовить tool-docs / контракты | ✅ | ❌ (потребитель) |
| Принять бизнес-решение | ❌ | ❌ (человек / Product) |

---

## 2. Модель детерминизма (R10 + R4)

Требование: путь и план строятся **динамически** по покрытию инструментов, но **одинаковые операции над одним контекстом → идентичный результат** (целостность и поддерживаемость проекта).

Честная рамка: LLM-генерация **не** бывает побитово идентичной. «Идентичность» гарантируется для двух слоёв из трёх:

| Слой | Что | Детерминизм | Носитель |
|---|---|---|---|
| **Скелет (регламент)** | какие шаги, порядок, гейты | **строгий** | Workflow-скрипт |
| **Суждение агента** | «как» внутри шага (предложить архитектуру, тест-кейсы) | ограниченный, в рамках | `agent()` вызов |
| **Verification-гейт** | сверка выхода с контрактом | **строгий** | `agent(schema)` + правила |

Гарантируется идентичность **управляющего потока** и **идемпотентных side-эффектов** (deploy commit X на stage → один stage), а также соответствие **контракту** на каждом гейте. Не гарантируется идентичность свободного текста генерации — она и не нужна, если гейт пройден.

In-harness Workflow-механизм (Opus 4.8) поддерживает это нативно: control-flow в скрипте детерминирован; `Date.now()`/`Math.random()` в скриптах запрещены ради воспроизводимости/resume; resume отдаёт кэш неизменённого префикса `agent()`-вызовов (тот же скрипт + те же входы → 100% cache hit).

### 2-bis. Эмпирика движка из RUN 01 **[RUN 01]**

Прогон использовал связку `/loop /kiro-impl auth` + `ScheduleWakeup` как автономный движок — де-факто это **уже был** «in-harness Workflow (dynamic)», но **без durable-носителя скелета**. Человек вынужден был руками материализовать «continuation contract» в `tasks.md`. Сильнейший факт: после `/compact` (полная потеря контекста) цикл восстановился **побайтово** из git + tasks.md + beads — доказательство, что скелет был экстернализованной структурой, а не контекстом. Workflow-скрипт даёт это by-design (его state переживает /compact). Это — **сильнейший структурный аргумент ЗА модуль**.

**Три провала durability при настоящей автономии**, которые прогон НЕ закрыл (их маскировал человек за терминалом):

1. **Cross-session.** `ScheduleWakeup` = «this session only». Закрыл сессию → движок мёртв. Нужен **внешний durable-планировщик** (n8n / cron / cloud routine), дёргающий `orchestrator resume`. → §10.
2. **Idempotency-дыра.** Крэш между impl-шагом и commit-шагом → resume перезапустит implementer поверх изменённых файлов. Нужен idempotency-токен шага.
3. **`disable-model-invocation`.** `/kiro-impl` помечен так → Workflow **не сможет** вызвать process-skill программно. → P5 реализуется **нативно** (Workflow читает `tasks.md` и диспатчит implementer'ов напрямую), не как обёртка `/kiro-impl`. См. §3.2 P5.

Вывод: Workflow-скрипт заменяет **слой-1** (скелет) и router выбора гейта; НЕ заменяет **слой-2** (implementer/reviewer остаются `agent()`). Длинные шаги (implementer ~10-11 мин) → **Background Agent**, не inline (риск /compact посреди шага).

---

## 3. Регламенты и каталог процессов (R1)

### 3.1. Что такое регламент

**Процесс = Workflow-скрипт (детерминированный хребет)**, который:
1. подгружает **регламент-skill** (`skills/orchestrator/<name>.md`) — методология «как» (lazy-loaded, существующая конвенция репо);
2. спавнит **role-агентов** (`agent()` / `parallel()` / `pipeline()`) — «кто» исполняет шаг;
3. закрывает шаги **verification-гейтами**.

«Офис» = каталог именованных процессов. Регламент = детерминированный скелет + ссылка на skill + определения role-агентов + точки гейтов и Integrator-команд.

### 3.2. Каталог процессов (process catalog) **[RUN 01]**

Концепт v0.1 знал 1 целевой процесс (`route-handoff-to-cc-sdd`). RUN 01 раскрыл **7 процессов**, образующих связную цепочку D2-T → D3 → validation → runtime (полная карта прогона — `dev/ORCHESTRATOR_DOGFOOD_RUN_01.md` §1):

| # | Процесс (playbook) | Зона | Триггер | Role-агенты | Готовность |
|---|---|---|---|---|---|
| **P1** | `orchestrator-init` (+resume после /compact) | все | старт / re-entry | — | ✅ (только чтение `.product/` + tool-docs) |
| **P2** | `decide-architecture-foundation` (опц.) | D2-T01/T02 | scope-defining gate | architecture-consilium ×3 | ✅ |
| **P3** | `batch-features-to-cc-sdd` ⟸ это и есть §8 первый инкремент | D2-T01/T06 | батч готовых handoff'ов | spec-author, cross-spec-reviewer, spec-fixer | ✅ cc-sdd заведён |
| **P4** | `audit-spec-fidelity` | D2-T verify | перед route-to-impl | fidelity-auditor ×N | ✅ |
| **P5** | `feature-to-tdd-impl` | D3 | spec готов, depth=до-кода | tdd-implementer, adversarial-reviewer | ⚠ нужен env-стек (Docker/PG/Redis); реализуется нативно (§2-bis) |
| **P6** | `validate-feature-impl` (GO-gate) | D3 verify | последняя задача `[x]` | 3 валидатора | ✅ |
| **P7** | `runtime-smoke-readiness` | D3+ runtime | «стартует ли dev?» | — (+capability→Integrator) | ❌ нужны D3-runtime инструменты |
| — | `deploy-to-stage` / `rollback-release` | D3-05/06 | выкатка/откат | — | ❌ нужны D3-инструменты (не достигнуты в RUN 01) |

`P2` опционален (нужен при нерешённой архитектурной развилке); `P7` раскрыт, но **не оснащён**. Детерминированные shape-скелеты P3 и P5 (с разметкой `[S]`/`agent()`/`[GATE]`/`[AUTONOMY]`) — в harvest-логе §3 / `out-dim-1`.

**Что прогон добавил к каждому процессу (vs концепт v0.1):**
- **P3:** волновой барьер (`[GATE]` между волнами зависимостей), **content-level adapter-verify** (P0-1: семантика маппинга, не наличие секций — урок silent fidelity-loss), петля cross-spec с критерием выхода (`all RESOLVED`), `coverage-oracle` (не доверяя self-report).
- **P5:** `gate-risk-classifier` (router тяжести гейта inline-vs-independent — детерминированный предикат, **design: [`dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md`](../../dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md)**, DEC-DEV-0073 P0-2; валидирован 16/17 против RUN 01), persistent inter-task **Notes-ledger** (forward-deps), per-step mini-orient + idempotent selective-commit, **нативная реализация** (не обёртка `/kiro-impl`).
- **P6:** механический слой + 3 параллельных валидатора + `verify-finding-before-act` (находка валидатора → grep ground-truth → только тогда remediation).

> **[S5a build — DEC-DEV-0076] P3 реализован ГИБРИДНО (оркеструем, не переписываем).**
> Чтение реального cc-sdd показало: `kiro-spec-batch` **уже** делает волновой барьер +
> параллельный per-feature dispatch + **10-точечный cross-spec consistency review +
> 3-раундовый fix-loop**. Поэтому role-агенты `spec-author`/`cross-spec-reviewer`/`spec-fixer`
> из таксономии §3.3 в первом инкременте **не строятся** — они покрыты инструментом.
> Оркестратор **вызывает** `kiro-spec-batch` и добавляет лишь то, чего у cc-sdd нет:
> (1) **мост** `handoff → brief.md + roadmap.md` — программная замена `kiro-discovery`
> (тот `disable-model-invocation` + интерактивный); (2) **preflight C-07** (адаптерный
> content-fidelity гейт); (3) **`coverage-oracle`** — детерминированное дополнение к
> LLM-ревью kiro (код по ground-truth, не self-report); (4) **durable Workflow-скелет**
> (границы фаз переживают /compact). Файлы: `orchestrator/processes/batch-features-to-cc-sdd.mjs`,
> `orchestrator/lib/coverage-oracle.cjs`, `skills/orchestrator/*`, `commands/orchestrator/run.md`,
> `orchestrator/README.md`. Cross-spec owner-arbitration **не** добавлен — kiro Step 4 строже;
> вернёмся, только если live-прогон вскроет пробел, который oracle не ловит.

> **[S5b build — DEC-DEV-0077] P5 реализован ТОНКИМ native-контроллером + лифт kiro-impl.**
> `kiro-impl` — зрелый автономный TDD-контроллер (per-task implementer→independent review→
> debug→verify-completion→selective commit→Implementation Notes→`kiro-validate-impl` GO-гейт,
> bounded rounds, strict structured-handoff parse, Feature-Flag, upstream-routing), но он
> **`disable-model-invocation`** → Workflow его не вызовет (это и есть OD9). Поэтому P5 владеет
> **минимальным dispatch-FSM**, но **лифтит** всю методологию: агент в прогоне читает
> самодостаточные шаблоны `.claude/skills/kiro-impl/templates/{implementer,reviewer,debugger}-prompt.md`
> и зовёт invocable-гейты `kiro-review`/`kiro-verify-completion`/`kiro-validate-impl`/`kiro-debug`.
> **Net-new = только** `gate-risk-classifier` (P0-2, детерминир. предикат HIGH→independent /
> LOW→inline-verify — kiro-impl всегда гоняет полный reviewer; рубрика валидирована 17/17
> против таблицы RUN 01 §6 с M5) **+** durable Workflow-скелет. Роли `tdd-implementer`/
> `adversarial-reviewer` из §3.3 заново **не пишутся** (лифт). Tasks выполняются
> **последовательно** (git-safety). Файлы: `orchestrator/processes/feature-to-tdd-impl.mjs`,
> `orchestrator/lib/gate-risk-classifier.cjs`(+тест §6), `skills/orchestrator/{gate-risk-classifier,tdd-impl-loop}.md`.

### 3.3. Role-агенты (таксономия RUN 01) **[RUN 01]**

Роли = «сотрудники» с job description (system prompt) = регламент роли. Параллелизм через `parallel()`; длинные шаги — Background Agents. В RUN 01 **все 11 ролей собирались вручную из general-purpose субагентов** (хотя `kiro-*` шаблоны существовали) — отсюда требование **реестра role-агентов под PMO-зону** (источник-истины для «голова»-self-check §6). Каждая роль обязана возвращать **structured-verdict schema** (делает синтез вердиктов детерминированным, а не ручным thinking).

| ID | Роль | Фаза | Parallel/Seq | Выход |
|---|---|---|---|---|
| RA-1 | `architecture-consilium` (multi-prior: velocity/fidelity/integrity) | P2 | parallel ×3 | вердикт по развилке + риски своего prior |
| RA-2 | `spec-author` (cc-sdd pipeline 1 фичи) | P3 | волна1 seq, волна2 par | `.kiro/specs/<f>/*` + coverage |
| RA-3/3' | `cross-spec-reviewer` (+re-reviewer) | P3 | sequential | issues + canonical owner / RESOLVED-карта |
| RA-4 | `spec-fixer` (consumer-conform) | P3 | parallel (scope-изоляция) | правленый спек |
| RA-5 | `fidelity-auditor` (spec vs `.product`) | P4 | parallel ×N | FAITHFUL/DRIFT + класс находки |
| RA-6/6' | `tdd-implementer` (+remediation-режим) | P5 | sequential | Status Report (STATUS/FILES/REQ/TESTS/CONCERNS) |
| RA-7 | `adversarial-task-reviewer` (kiro-review) | P5 | sequential (выборочно по risk-tier) | VERDICT APPROVED/REJECTED + FINDINGS |
| RA-8/9/10 | `requirements-coverage` / `design-alignment` / `integration-boundary` валидаторы | P6 | parallel ×3 | COVERED/ALIGNED/CLEAN + находки |
| **RA-0** | `orchestrator-controller` (мета, **главный агент**) | все | — | владеет sequencing/risk-классификацией/синтезом/arbitration/commit/self-pace |

**RA-0 — ровно та роль, которую Оркестратор должен нести Workflow-скелетом, а не суждением.** Большинство gap'ов прогона = «решения RA-0, которые надо кодифицировать в скелет». Полные job-description'ы — harvest-лог §4 / `out-dim-1` §A.

---

## 4. Ядро исполнения: in-harness Workflow (R6, R10)

Решение (DEC-DEV-0058): ядро на старте — **in-harness Opus 4.8 Workflow**, без внешней durable-инфраструктуры. n8n подключается позже, когда конкретный процесс потребует cross-session durability / событийности (§10).

Иллюстративная форма (shape, не финальный код):

```
phase('init');   const ctx  = await agent('orchestrator-init: собрать контекст', {schema: CTX})
phase('D2-T');   const arch = await agent('cc-sdd: spec → design → tasks', {schema: ARCH})
if (arch.needsInfra)
  await agent('КОМАНДА Интегратору: обеспечь ' + arch.infra, {schema: PROVISION})   // §6
phase('verify'); const gate = await agent('сверить выход с контрактом handoff', {schema: VERDICT})
```

---

## 5. orchestrator-init: стартовый сбор контекста (R9)

При запуске Оркестратор собирает **многоуровневый** контекст (самый дешёвый самостоятельно-полезный кусок — делается первым):

1. **Инструменты и команды** — `active-tools.yaml` + `tool-docs/*` (от Интегратора).
2. **Покрытие зон** — `pmo-mapping.yaml` (кто что покрывает) + `gaps`.
3. **Статусы задач** — выход `/product:status`, карта `.product/` и её содержимое.
4. **Состояние среды** — git-ветка/статус, env-tier, активные контракты + **[RUN 01] `env-readiness-probe`**: версии (node/pnpm/docker) + матрица совместимости из steering `tech.md` + наличие секретов (без значений) + build-graph. Превентивно ловит version-mismatch (#1/#2/#4 прогона) **до** код-фазы, а не реактивно внутри субагента.

Выход — структурированная сводка, на которой строится динамический план процесса. Она же — вход для per-step **capability self-check** (§6): по `pmo-mapping`/`gaps`/`active-tools` Оркестратор видит, каких «рук»/«головы» не хватает под шаг, и решает — исполнять самому или запросить оснащение у Интегратора.

---

## 6. Командный канал Orchestrator → Integrator (R8) — новое

Внутренний **обратный handoff** — это запрос **capability, а не исполнения** (role A, DEC-DEV-0060). Перед шагом, требующим инфраструктуры (например, cc-sdd выбрал pgsql), Оркестратор делает **capability self-check**:

- **«Руки»** — есть ли физический доступ: нужный tool/MCP установлен (docker MCP), бинарь доступен (docker), env/secret на месте?
- **«Голова»** — есть ли ответственный role-агент с предметным skill (`db-admin`), кому поручить шаг?

Если чего-то не хватает → запрос Интегратору **«обеспечь недостающую capability X»**. Интегратор оснащает (ставит docker MCP, заводит role-агента `db-admin`+skill, прописывает контракт) и заканчивает на «capability готова и verified». **Сам deploy БД исполняет Оркестратор** уже оснащёнными руками и головой — Интегратор инфра-шаг не выполняет (Integrator SPEC §1.2/§1.4/§8.3). Так «развернуть БД» остаётся PMO-процессом D3-05/D3-06 в runtime-владении Оркестратора, а Интегратор лишь оснащает зону.

**Семантика гейта (OD1, дефолт):** Оркестратор **предлагает**; hard-approve gate Интегратора (DEC-DEV-0047) **остаётся**. Auto-approve только для whitelisted низкорисковых **dev-tier** операций. Запросы проходят через `pending-actions.md`. *Не душит автономию, но prod/затраты под человеческим контролем.*

Формат запроса (OD5) — **capability-spec**, не deploy-request: `type` (tool | mcp | role-agent | skill), идентификатор/версия, целевая зона PMO, tier, обоснование. Точная схема снимается на dogfood (вероятно, мини-аналог `handoff.md`).

### 6-bis. Эмпирика канала из RUN 01 — **канал v0.1 не активировался ни разу** **[RUN 01]**

Главный и неожиданный вывод прогона: **за 13ч ни один из ~24 capability-дефицитов не прошёл через канал §6**, потому что инфра была оснащена заранее (вне сессии); env-дефициты Оркестратор **поглотил сам** (нарушив границу); внешние API/секреты **замокал**; prod-инфру **вынес в follow-up**. Полный реестр — harvest-лог §2.3 / `out-dim-3`. Следствия для дизайна:

1. **§6 нельзя валидировать на `route-handoff-to-cc-sdd` (P3).** P3 требует только cc-sdd skill + чтение `.product/` — инфра-каналу нечего делать. §6 по-настоящему нагрузится только на **P5 (D3-impl) с неоснащённой инфрой** — а именно эта зона помечена «нет инструментов». **§6 надо проектировать сразу под D3-кейсы**, не под первый инкремент. (открытый вопрос RUN 01 №1)

2. **Граница Orchestrator↔Integrator НЕ enforced — Оркестратор её систематически поглощает.** Анти-эталон: фикс адаптера CNT-001 (#195–262) — Оркестратор обнаружил дефект (✓ его зона: verification-gate), но **сам починил адаптер** обеих копий + контракт (✗ зона Интегратора). Должен был `capability-request(type:tool, id:CNT-001)`. Эталон корректного поведения: Docker-стек (#10) — оснащено заранее → Оркестратор только исполняет `docker compose up`. **Без enforced async-протокола `request→await-fix→resume` Оркестратор всегда чинит сам** (быстрее, чем эскалировать в вакуум). Механизм: capability-spec → `pending-actions.md` → блок шага через ScheduleWakeup-проверку «capability готова?», **не чинить сам**.

3. **OD5-типология `tool|mcp|role-agent|skill` неполна.** Прогон вскрыл 2 непокрытых класса:
   - `+ env-constraint` — несовместимость версии env с контрактом steering (кейс #2: Node18-рантайм vs Node20/22 в tech.md, `EBADENGINE`; #5 esbuild не эмитит decorator-metadata; #6 prisma не читает .env). Не «нет инструмента», а «инструмент не той версии / не сконфигурирован». Поле `constraint` (version-range / build-capability / wiring).
   - `+ secret` — провижининг секрета внешнего аккаунта (#16–21: Google OAuth, SendGrid, ЮKassa). Execution в dev = mock; provisioning real-ключа = staging/prod.

4. **Добавить поля capability-spec:**
   - `route ∈ {integrator, product}` — **обратный канал к Product** (новое): дефекты канона `.product` (#486–500: NFR-004/005 vs BR-040), under-spec («design молчит → дефолт 30д», #1715), и **выбор провайдера** (DeepL vs Yandex — бизнес-решение) идут к Product, не к Интегратору.
   - **Раздельные `provisioning-tier` и `execution-tier`** — оснащение и исполнение оснащённым имеют разную обратимость. Поднять Docker-стек: provisioning dev/auto, execution dev/auto. Завести Hetzner VPS: provisioning **prod/human-gate** (деньги/внешний аккаунт), хотя последующий deploy-шаг автономен. Секрет: execution dev (mock), provisioning real-ключа staging.

5. **Реестр role-агентов под PMO-зону** — без него «голова»-self-check («есть ли role-агент `architecture-consilium`?») неисполним машинно. В RUN 01 все роли собирались вручную (см. §3.3).

6. **`env-readiness-probe` в orchestrator-init (§5 п.4)** — версии (node/pnpm/docker) + матрица совместимости из steering `tech.md` + наличие секретов (без значений). Превентивно ловит #1/#2/#4 **до** код-фазы; в прогоне они всплыли реактивно внутри субагента (#449).

---

## 7. Autonomy tiers (R4, R5)

Не «душить ↔ отпустить», а **tiered autonomy по обратимости и среде**, переиспользуя уже built-предохранители Интегратора:

| Класс операции | Автономия | Предохранитель |
|---|---|---|
| Обратимые / dev-scoped | **автономно** | — |
| Необратимые / staging | предложение + быстрый approve | `pending-actions.md` |
| prod / затратные / разрушающие | **человеческий гейт** | hard-approve gate, `scope-guard` |

Маппится на существующие `env_tiers` (dev/staging/prod suitability, DEC-DEV-0047). Работа Интегратора уже заложила ровно эти примитивы.

### 7-bis. Реальная раскладка из RUN 01 **[RUN 01]**

Все 4 человеческих гейта прогона пришлись на E0/E1 (scope/архитектура, первая треть); весь E4 (23 из 26 задач) прошёл **без единого человеческого гейта**. Человеческое суждение концентрируется в **scope-defining фазе**, не в исполнении. Три уточнения к модели:

1. **Подлинно неустранимы только 2 суждения:** выбор tech-стека (цементируется в 4 design.md) и «что считаем deliverable». Остальные 2.5 из 4 гейтов — **артефакт отсутствия авто-вывода зависимостей и tier-механики с дефолтами** (напр. развилка pnpm-vs-npm авто-разрешима — есть fallback). Их надо превращать из open-choice в **tier-предложение с дефолтом** (approve), а не выносить как вопрос.

2. **Re-formulation-петля.** 2 из 4 AskUserQuestion были **ОТКЛОНЕНЫ** пользователем с «хочу уточнить» (#118 стек, #461 глубина). §7 моделирует `pending-actions` как бинарный approve/reject — реальность дала `rejected → clarify-loop → переформулированный гейт`. Оркестратор должен уметь вести многоходовый clarification-диалог при отклонённом гейте, а не продавливать или падать.

3. **provisioning vs execution** (см. §6-bis п.4) — autonomy-tier берётся **раздельно** для оснащения и для исполнения оснащённым.

---

## 8. Scope первого инкремента

Реальность контура: реально заведён **только cc-sdd** (D2-T01/T06). Инструментов D3/D4/D5 нет. Поэтому первый инкремент:

1. **`orchestrator-init`** (§5) — сбор контекста.
2. **`route-handoff-to-cc-sdd`** — оркестрация одного процесса D2-Technical (та работа, что Phase 5 вырезала, DEC-DEV-0040 Q3).
3. **Командный канал в Интегратор** (§6) — минимальная форма.

`deploy-to-stage` / `rollback-release` — **после** того как Интегратор заведёт D3/D5-инструменты.

> **[RUN 01] Решение по scope — РЕШЕНО E2+E4 (DEC-DEV-0075).** Harvest рекомендовал **E2-only** (`batch-features-to-cc-sdd` = P3 — самодостаточен и не нагружает §6, который нельзя на нём провалидировать). Человек **выбрал расширение до E4** (build P3 + P5 `feature-to-tdd-impl`): прогон доказал, что E4 работает, и полный pipeline до кода ценнее минимального. **Принятые риски:** (1) §6/capability-канал остаётся непровалидированным — выносится в прогон №2 с неоснащённой инфрой (S6); (2) `disable-model-invocation` снимается **нативной** реализацией P5 (Workflow читает tasks.md и диспатчит implementer'ов сам, OD9), а не обёрткой `/kiro-impl`; (3) durable-слой (n8n) под вопросом до появления cross-session-потребности (§10). P4/P6 канонизируются вместе с P3/P5.

---

## 9. Открытые решения

| ID | Вопрос | Дефолт (этот концепт) | Статус |
|---|---|---|---|
| **OD1** | Гейт на команды Orchestrator→Integrator | предложение + сохранённый hard-approve gate; auto-approve whitelisted dev-tier | принят дефолт |
| **OD2** | Где живут регламенты | процессы — `orchestrator/processes/`; skills — `skills/orchestrator/` | принят дефолт |
| **OD3** | Первый кодифицируемый процесс | `route-handoff-to-cc-sdd` (= dogfood-цель) | принят дефолт |
| **OD4** | Мульти-инструмент на одну зону (OQ-I9) | правила выбора в контрактах | отложено до 2-го инструмента |
| **OD5** | Формат Integrator-запроса (§6) | **capability-spec**: type (tool\|mcp\|role-agent\|skill\|**env-constraint**\|**secret**) + id/версия + `constraint` + зона PMO + `route`(integrator\|product) + раздельные provisioning/execution-tier + обоснование | **уточнён RUN 01** (§6-bis); полная схема — прогон №2 на D3 |
| **OD6** | Кто заводит *bespoke* role-агента + предметный skill под зону (не из external package) | **Интегратор** — role A: capability = «руки» (tool/MCP/доступ) + «голова» (role-агент/skill); Оркестратор только потребляет и исполняет | **принято** (DEC-DEV-0060) |
| **OD7** | Как enforce'ить границу Orch↔Integrator (Оркестратор по умолчанию её поглощает) | **async-протокол** `request→await-fix→resume`: capability-spec в `pending-actions.md`, блок шага через ScheduleWakeup-проверку, **не чинить сам** | **новое (RUN 01)**; гипотеза, не проверена — анти-эталон #29, эталон #10 |
| **OD8** | Куда идут дефекты канона `.product` / under-spec / выбор провайдера | **второй обратный канал →Product** (поле `route`); не Integrator-capability | **новое (RUN 01)** §6-bis п.4 |
| **OD9** | Как Оркестратор исполняет P5 при `disable-model-invocation` на `/kiro-impl` | **нативный Workflow-скелет**: читает `tasks.md`, диспатчит implementer'ов напрямую (не обёртка) | **новое (RUN 01)** §2-bis; рекомендовано, не прототипировано |
| **OD10** | Scope первого инкремента (E2-only vs extend до E4-E6) | **E2+E4** — build P3 `batch-features-to-cc-sdd` + P5 `feature-to-tdd-impl` (нативный, не обёртка `/kiro-impl`). Решение человека (DEC-DEV-0075), override рекомендации harvest'а (E2-only); риски приняты: §6 не валиден (S6/прогон №2), `disable-model-invocation` снимается нативным P5 (OD9), durable-слой n8n под вопрос | **РЕШЕНО (DEC-DEV-0075)** |

---

## 10. Технологии: оценка (R6, R7)

| Технология | Вердикт | Когда |
|---|---|---|
| **Opus 4.8 Workflow (dynamic)** | **ядро** — детерминированный хребет | сейчас |
| **Agent Teams / параллельные агенты** | role-агенты, fan-out | сейчас (`parallel()`/`pipeline()`) |
| **Background Agents** | длинные шаги (deploy, тесты) + `ScheduleWakeup` | по потребности процесса |
| **Computer Use** | отложить — ниша GUI без API; PMO-операции лучше через CLI/MCP (детерминируемее) | при появлении GUI-only зависимости |
| **n8n (durable)** | отложить — подключить, когда процесс потребует cross-session/событийности | post-первого-инкремента |
| **MCP / tooling прокачка** | потребитель того, что заводит Интегратор | непрерывно |

---

## 11. Связь с другими модулями

- **Product Module** → `handoff.md` — вход Оркестратора (точка старта `route-handoff-to-cc-sdd`).
- **Integrator Module** — двусторонне: отдаёт tool-docs/контракты (§1.3), принимает команды (§6).
- **pmo-map** — функциональная декомпозиция зон, которые Оркестратор исполняет в runtime.
- **D7 meta-improvement** — этот модуль сам пройдёт kickoff/closure-ритуал при переходе concept → implementation.

---

## Changelog

- `v0` (2026-06-02) — concept draft. Направление и scope зафиксированы DEC-DEV-0058. Эмпирические регламенты — pending dogfood (`dev/plans/ORCHESTRATOR_DOGFOOD_PLAN.md`).
- `v0.1` (2026-06-02) — коррекция границы (DEC-DEV-0060): командный канал §6 = запрос **capability** (руки/голова), не инфра-исполнения; добавлен capability self-check; OD5 уточнён до capability-spec; OD6 принят (Интегратор оснащает «голову» = role-агент/skill, role A).
- `v1.0-draft` (2026-06-14, DEC-DEV-0073) — **dogfood RUN 01 harvest** (сессия `6dc62bc8`, `dev/ORCHESTRATOR_DOGFOOD_RUN_01.md`). §2-bis (эмпирика движка + 3 провала durability); §3.2 каталог 1→7 процессов; §3.3 таксономия 11 role-агентов; §6-bis (канал §6 не активировался ни разу — типология +env-constraint/secret, поле `route`, раздельные tier'ы, async-протокол); §7-bis (реальная раскладка автономии + re-formulation-петля); §8 пометка E2-only; OD5 уточнён, OD7–OD10 добавлены. **Не** implementation-ready: scope (OD10) и §6 на D3 — открыты.
