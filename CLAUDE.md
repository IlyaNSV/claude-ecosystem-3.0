# CLAUDE.md — Ecosystem 3.0 Repository

> **Что это:** контекст для Claude (или любого AI-ассистента), работающего над **самой Ecosystem 3.0** — meta-tooling для управления продуктовыми проектами через Claude Code.
>
> **НЕ путать с** `templates/project/CLAUDE.md.template` — тот шаблон для пользовательских проектов, которые поведутся **через** Ecosystem 3.0.
>
> **Этот файл — для разработчиков самой экосистемы.**

---

## Что строим

Ecosystem 3.0 — PMO-слой над Claude Code:
- **Детальный контроль** D1 (Discovery) и D2-Behavioral (поведенческая спецификация)
- **Tool-agnostic делегирование** D2-Technical и D3-D6 во внешние инструменты через универсальный `handoff.md`
- **4 модуля:** Product, Design (conditional), Integrator, Orchestrator (планируется)

Подробнее: [README.md](README.md), [ROADMAP.md](ROADMAP.md).

## Где мы сейчас

**Единственный источник статуса** — [ROADMAP.md «Где мы сейчас»](ROADMAP.md#где-мы-сейчас) (verify против `git log`). Снапшот здесь намеренно **не дублируется**: pointer-collapse против triple-declaration drift (Tier-1 doc reform; ранее README/CLAUDE/ROADMAP держали три расходящиеся копии).

`last memory-sync: 2026-07-12` — дата последней синхронизации этого файла со снапшотом ROADMAP; зеркалит строку «Последнее обновление» в [ROADMAP.md](ROADMAP.md). Если расходится с `git log` — снапшот устарел, доверяй ROADMAP + git, затем обнови эту дату.

**Реестр открытых readiness / smoke-гейтов** (само обязательство «перед фазой — [`phase-kickoff.md`](dev/meta-improvement/checklists/phase-kickoff.md) + readiness» живёт в SSOT-таблице «Process triggers» ниже и здесь намеренно НЕ повторяется — DEC-DEV-0197 / D12; ниже — только состояние):
- `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md` — ✅ ЗАКРЫТ 2026-07-15 (догон E1 кампании: S2/S5 PASS, S4 PARTIAL — §4.2.1 env-блок структурно не подключён в add.md, решение владельца; S1 PARTIAL/S3 PASS с 0177/0204)
- `dev/deferred/PHASE_D_DOCS_WIKI_READINESS.md` — DEFERRED; resumption при bring-forward trigger
- `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md` — ✅ ЗАКРЫТ 2026-07-15 (догон E2 кампании: S1/S3 PASS на свежей UI FM-008, fallback-цепочка честно деградировала до html; S5/S7 PASS, S2/S4 PARTIAL с 0177/0204)
- Phase 7 — ✅ built + **validated** 2026-07-11 (смоук прогнан, S4 PARTIAL/DEF-SMK-1; план и readiness archived → `dev/_archive/phase-7/`; DEC-DEV-0176/0177)
- S-LE — ✅ ЗАКРЫТ 2026-07-11: ре-прогон PASS (самодедлок 0143 устранён) → **флип `lesson-presence-gate.js` warn→strict выполнен** (решение владельца; чеклист архивирован → `dev/_archive/s-le/`; S-LE.1 = known CC-caveat; DEC-DEV-0177)
- `dev/deferred/D7_DEADWEIGHT_CLEANUP.md` — ✅ EXECUTED 2026-07-11 как полоса A repo-wide deadweight-sweep (DEC-DEV-0185): все D7-механизмы KEEP; audit-reports ротированы в `_archive/`

## Process triggers — harness contract (D7)

> **Auto-loaded операционный индекс: ситуация → что я (harness) обязан сделать.** Это
> SSOT-указатель; детали ритуалов — в `dev/meta-improvement/checklists/*`. Строки 🔒
> **принуждаются** блокирующим `commit-msg` gate (`process-gate.js`, DEC-DEV-0083) — обойти
> можно только осознанно через `[skip-process-gate]` в сообщении коммита. Gate ставится
> автоматически при `npm install` (npm `prepare` → `install-git-hooks.cjs`, DEC-DEV-0157);
> вручную: `bash dev/meta-improvement/scripts/install-pre-commit.sh`.

**Precedence — объявлена ТЕКСТОМ, а не порядком строк** (DEC-DEV-0197 / D12; на порядок правил в файле полагаться ЗАПРЕЩЕНО — знание, «спрятанное» в порядке, не читается):
1. **Код гейта > эта таблица.** Что принуждается на самом деле — в `dev/meta-improvement/scripts/process-gate.js`. Разошлись — **прав код**, таблица = баг, чинить таблицу.
2. **Эта таблица > любое другое место этого файла.** Обязательства «что я обязан сделать в коммите» живут ЗДЕСЬ и только здесь. Прецедент: §«Обновление CHANGELOG vs DEV_JOURNAL» держал вторую, расходящуюся копию тех же правил (для `fix:` обещала CHANGELOG **без** квалификатора consumer-zone — то есть строже кода) → свёрнута в указатель, уникальные строки (`refactor:` / `docs:` / имена секций CHANGELOG) подняты сюда.
3. **🔒 = принуждается кодом, а не тоном.** Тон (IMPORTANT/MUST/ВСЕГДА) и позиция в файле на исполнение почти не влияют. Работает ровно две вещи: детерминированный гейт — либо явный **триггер + scope** в тексте самого правила.

| Когда я делаю это… | …обязан (в том же / связанном коммите) | Деталь |
|---|---|---|
| `fix:` (багфикс) | 🔒 DEV_JOURNAL (root cause + lesson) + 🔒 CHANGELOG `[Unreleased] ### Fixed` **если тронут consumer-zone** | §1; CONVENTIONS §11.1 |
| `feat:` в consumer-zone (`commands/skills/agents/hooks/docs/templates/adapters/orchestrator` + root README/ROADMAP/install) | 🔒 CHANGELOG `[Unreleased] ### Added` + DEV_JOURNAL если был tradeoff ≥2 вариантов | accumulation contract |
| сообщение коммита упоминает `DEC-DEV-N` (**любой** тип коммита, не только `fix:`) | 🔒 DEV_JOURNAL (rationale решения) | `process-gate.js` — условие `isFix \|\| mentionsDecDev` |
| spec / scope-change | DEV_JOURNAL (rationale + impact) + CHANGELOG `### Modified` если влияет на consumers | §1 триггеры |
| `refactor:` | CHANGELOG — **только если меняет behavior**; DEV_JOURNAL — если non-trivial | дисциплина (гейт не ловит: он смотрит только `feat:`/`fix:`) |
| `docs:` / typo / dependency bump | **ничего** — это НЕ триггеры | §1 «НЕ триггеры» |
| добавил/убрал артефакт-тип или validation-правило | 🔒 count-sweep всех ~10 count-доков (`node dev/meta-improvement/scripts/check-counts.js` зелёный) | [[reference_pmo_canonical_counts]] |
| добавил/убрал команду / **namespace** команд / **скилл** / хук | обновить `commands/ecosystem/verify.md` (Step 4 + Step 9 summary) + проверить обзорные шаблоны (`status.md`, `docs/MAP.md`) | ⚙ strict-чекер `check-inventory-sync.cjs` в `npm run verify` (D11) — см. сноску под таблицей |
| архитектурный выбор из ≥2 вариантов | DEV_JOURNAL: что выбрал + почему отверг остальные | §1 |
| собрался резать версию / доставлять в пилот | `checklists/patch-cut.md` | каденс — по событию |
| собрался прогнать live-доработку в пилоте (dogfood-валидация) | `checklists/live-run-validation.md` | executor/reviewer separation; класс A (спонтанность) / B (механика) |
| перед фазой / после фазы | `checklists/phase-kickoff.md` / `phase-closure.md` | **это SSOT ритуалов фазы** — §«Что делать в этой сессии» на них лишь ссылается |
| рефактор с риском stale-ссылок | `patterns/spec-drift-sweep.md` (grep после) | — |
| продолжаю трек, у которого есть живой шов — `dev/<track>/SEAM.md` со `status: ACTIVE` | прочитать шов целиком + вернуть владельцу **SEAM-ACK** (ответы на контрольные вопросы шва) **ДО первой правки** | протокол швов (DEC-DEV-0202, AWAKENED); подстраховка — SessionStart-хук `seam-reinject-compact` (matcher `compact`) |
| сессия длинная (~45%+ окна) ИЛИ симптомы потери контекста (переспрашиваю решённое; «помню» файл иначе, чем он есть) | довести текущую единицу до safepoint → записать/обновить `dev/<track>/SEAM.md` по шаблону v2; новую крупную единицу, которая не влезет в остаток окна, не начинать | `dev/deferred/CONTEXT_SEAM_PROTOCOL.md` §4 (R1-R3, R7); warn — `seam-freshness-warn` (Stop) |
| пишу в дизайн/журнал/отчёт утверждение о внешнем мире, которое могло измениться после cutoff (версии/цены/API/модели/поведение харнесса), ИЛИ несу в фундамент решения «классику» из своих приоров | прогнать `dev/meta-improvement/skills/informed-fetch.md` (Столп 1 — свежесть; стоп-правило satisficing). 🛑 Веб-происхождение НЕ пишется в CLAUDE.md/память без гейта (скилл §Шаг 3) | Informed Fetch (DEC-DEV-0207; решение D7 аудита 0197 — патология НЕДОБОРА: WebSearch 7/7675) |

🔒 = hard-enforced **кодом** (`process-gate.js`, блокирующий `commit-msg`). ⚙ = принуждается **другой** блокирующей цепью — `npm run verify` (коммит пройдёт, verify упадёт). Остальное — дисциплина (+ warn-only PostToolUse напоминалки `dev-journal-reminder.js` / `phase-closure-reminder.js` / `memory-drift-reminder.js`).

**Сноска к строке «добавил/убрал команду / namespace / скилл / хук»** (DEC-DEV-0197 / D11 — единственное правило таблицы, у которого не было НИ гейта, НИ warn-хука):
- `node dev/meta-improvement/scripts/check-inventory-sync.cjs` — детерминированно сверяет `verify.md` с репо: набор namespace'ов (Step 4 **и** Step 9 summary), floor'ы runtime-дир **и скиллов**, маркеры Step 4.5/4.6 (реально ли строка есть в `.mjs`), хуки Step 8.5 (есть ли в `hooks/*/manifest.yaml` с заявленным событием).
- **⚙ STRICT** (флип владельца 2026-07-13): в цепи `npm run verify` как `check:inventory:strict`. **НЕ** в `process-gate` — коммит пройдёт, упадёт `verify`. Аварийный тумблер: `INVENTORY_SYNC_STRICT=0 npm run verify` (гейт на общем ресурсе без выключателя однажды склинит чужой цикл — и виноват будет не тот, кто падает).
- **«Чекер ослеп» ≠ «нашёл дрейф».** Непарсящийся якорь (`verify.md` реструктурировали) или недоступный ground truth (частичный / sparse checkout — файл в индексе git, но не на диске) → громкий warn «обнови парсер», **exit 0, никогда не гейтит**. Тот же закон, что у сторожа координат: *отсутствие доказательства ≠ доказательство отсутствия*; гейт не имеет права падать на том, чего не может знать.
- **Скиллы — пронг наполнен, но проверка слабая (осознанно).** `verify.md` Step 4 держит floor `` `.claude/skills/**/*.md` `` (машинно равен живому `skills/**/*.md`, тихо дрейфовать не может: добавил/убрал скилл ⇒ красный `verify`). Но **swap/переименование с сохранением числа проходит молча**. Сильная форма — генератор каталога скиллов, как `gen-command-catalog.cjs` у команд — отложена: `dev/tech-debt/CONTEXT_AUDIT_D6.md` **DEF-CTX-5**.
- **Чего чекер НЕ покрывает (честно):** хуки помимо пары LESSON-*; `status.md`-шаблоны (нужно суждение). Поштучные команды уже гейтит `gen:catalog:check`, `docs/MAP.md` — `gen:map:check`.

## Autoflow — git / память / sync без отдельных команд (DEC-DEV-0100)

> **Дефолт операционного потока: я гоню git-цикл и memory-sync сам, не дожидаясь
> отдельных команд «закоммить / запушь / создай PR / синхронизируй память».**
> Граница: **merge в `main` — всегда владелец.** Я довожу до готового PR и
> останавливаюсь. Это **поведенческий контракт** (исполняю я), НЕ детерминированная
> гарантия — enforcement держат `process-gate` / `pre-commit`, подстраховка —
> warn-хуки. Подавляется фразами «локально только» / «не пушь пока» / «без PR».

**Триггер единицы синхронизации** — завершённая *логическая единица* (фича/фикс
доведён, `npm run verify` / релевантный smoke зелёный), НЕ каждый файл и НЕ конец
сессии. Гранулярность = то, что я и так оформил бы одним PR.

**Git-цикл (на завершении единицы):**
1. На `main` (не на feature-ветке) → завожу `<type>/<scope>-<slug>` ПЕРЕД правками.
2. Обновляю DEV_JOURNAL / CHANGELOG по таблице «Process triggers» **ДО** коммита
   (иначе `process-gate` отобьёт коммит — гейт это подстраховка, не препятствие).
3. `git fetch` + merge `origin/main` в ветку. Конфликт на `DEV_JOURNAL` /
   `CHANGELOG [Unreleased]` (ожидаем — accumulation-контракт) → склейка обеих
   сторон; нетривиальный конфликт → стоп + спрашиваю.
4. Scoped conventional commit — **только свои файлы** (чужой WIP / `audit-index.md`
   не стейджу).
5. `git push` + `gh pr create` — **с `dangerouslyDisableSandbox: true`** (git/gh
   network иначе таймаутит на порту 443, [[env_git_network_needs_sandbox_off]]).
6. **СТОП перед merge.** Сообщаю «PR #N готов к merge» — merge выполняет владелец.

**Реалистичность (без иллюзий):** шаги 1-6 — поведенческие; если я их пропущу,
ничто их не выполнит за меня (кроме warn-напоминаний). Это сдвиг дефолта «молчу
пока не попросят» → «делаю пока не остановишь», а не автономный демон. Необратимое
(merge в `main`) сознательно оставлено вне автоматизации.

**Контекстные швы (DEC-DEV-0202, дополняет цикл выше):** запланированный разрыв длинной
работы — через шов `dev/<track>/SEAM.md` (шаблон v2 — `dev/deferred/CONTEXT_SEAM_PROTOCOL.md`
§4), а не через доверие авто-компактации. Три правила поверх autoflow: **(N3)** не начинай
кусок, который заведомо не доедет до safepoint в остатке окна — декомпозируй или сначала шов;
**(N4)** перед необратимым/важным решением re-anchoring: перечитай инвариант из шва/журнала,
а не «помню»; **(firewall)** делегируй всё «читает много — возвращает мало» субагентам даже
когда «быстрее самому» — цена платится не в этой задаче, а в деградации следующих. Триггеры
записи шва и SEAM-ACK — в таблице «Process triggers».

## Принципы работы над экосистемой

### 1. DEV_JOURNAL обязателен для значимых решений

Все архитектурные решения, root causes багов, изменения scope phase — записываются в [DEV_JOURNAL.md](DEV_JOURNAL.md) с rationale и lessons. **Это не CHANGELOG** (тот для consumers). Это память будущего разработчика.

**Триггеры для записи:**
- Выбрали один из ≥2 вариантов архитектуры — запиши почему отвергли остальные
- Что-то сломалось → нашли root cause → запиши, чтобы не повторить
- Решили cut/skip часть фазы — запиши, что и почему отложено
- Spec оказался неверным на практике — запиши adjustment с обоснованием

**НЕ триггеры:** typo fixes, dependency bumps, рутинные правки документации.

### 2. Incremental pilot, не waterfall

ROADMAP помещает PILOT POINT после Phase 5 (~13-20 часов работы). **Это слишком поздно.** Smoke-test после каждой Phase, не только после полной цепочки.

После Phase N:
1. Запустить минимальный end-to-end test того, что Phase N добавила (например, после Phase 2 — `/product:init "test idea"` в test-папке)
2. Записать findings в DEV_JOURNAL
3. Решить: продолжать с Phase N+1 как запланировано, или пересмотреть приоритеты на основе pilot

### 3. Meta-проект — высокий risk самореферентного коллапса

Ecosystem 3.0 — система для управления продуктовыми проектами, **которая сама строится без использования собственной машинерии**. Это создаёт два класса проблем:
- Spec-first design без validation pилот → Phase N+1 building на ошибочных Phase N assumptions
- Отсутствие dogfood обратной связи от собственного UX

**Mitigation:** после Phase 2 smoke-test обсудить создание `.product/` для самой Ecosystem 3.0 (PS, базовые HYP, MVP scope). Не делать раньше — premature.

### 4. Cuttable scope — default

Перед началом каждой Phase задать вопрос: **«Что можно скип/упростить, чтобы получить feedback быстрее?»** Каждое spec-указание проходит этот фильтр.

Пример: Phase 3 ROADMAP включает Deep mode subagents (`market-researcher.md`, `competitor-analyst.md`). Если Quick mode из Phase 2 ещё не валидирован — Deep mode преждевременный. Откладывается.

### 5. ROADMAP — гипотеза, не contract

Оценки в часах оптимистичны. Реальность будет иной.

**Триггер:** закрыл крупную единицу работы. (Нумерованные фазы исчерпаны — единица теперь любая: волна / трек / эпик. Правило привязано к *закрытию единицы*, а не к слову «Phase».)
**Scope ревью — ровно два места, а не «приоритеты вообще»:**
- `ROADMAP.md` «Где мы сейчас» — привести в соответствие с `git log`;
- очередь остатка там же — что ещё valid, что отложить, что добавить.

### 6. Backwards compatibility — узко, не «не важна» (ревизия DEC-DEV-0083)

До 1.0 **ломать API / формы артефактов можно свободно** — внешних потребителей контракта нет. НО премиса «пользователей нет, ломай всё» больше **не** держится буквально: есть живой пилот (`my-first-test`), чьё локальное состояние обязано переживать `/ecosystem:update`. Поэтому:

- **Состояние пилота не вайпим.** Wipe-protection (`update.md` level-1/level-2), namespace-preserve третьих сторон и Orchestrator project-state — контракт, не опция.
- **Предпочитать soft-миграции:** новое поле опционально (absent == старое поведение 1:1), backfill — отдельным migration-промптом в CHANGELOG-записи (прецедент: `product_class`, DEC-DEV-0079).
- **Hard-required-field миграции** без enforcement-механизма — всё ещё post-pilot (migration runner не построен; `bootstrap.md` обещает будущий `/ecosystem:upgrade`).

Т.е. ломаем **формы** свободно, бережём **доставку и состояние пилота**. (Дрейф «не важна» ↔ практика вскрыт D7-аудитом 2026-06-19.)

## Repository structure (для AI)

```
claude-ecosystem-3.0/
├── README.md, BOOTSTRAP.md, INSTALL-HUMAN.md, CHANGELOG.md, ROADMAP.md
├── DEV_JOURNAL.md           # этот журнал (создан 2026-04-19)
├── CLAUDE.md                # этот файл — context для AI
├── dev/                                  # docs про разработку самой экосистемы
│   ├── meta-improvement/                 # D7 module (SPEC + checklists + CONVENTIONS)
│   ├── PHASE_<N>_READINESS.md            # readiness gate per phase
│   ├── PHASE_<N>_SMOKE_TEST_PLAN.md      # smoke test plan (active until run)
│   ├── v1_1_backlog.md                   # preserved deferred context
│   └── _archive/                         # archived past-phase docs
├── install.sh, install.ps1  # global installers
├── .env.template, settings.json.template, gitignore.template
├── docs/
│   ├── product-module/SPEC.md, handoff-spec.md
│   ├── design-module/SPEC.md
│   ├── integrator-module/SPEC.md
│   └── pmo/
│       ├── pmo-map.md, processes.md, validation.md
│       └── artifacts/        # 24 типа артефактов
├── commands/                 # → пользовательский .claude/commands/
│   ├── ecosystem/, integrator/, product/  # design/ — Phase 6
├── skills/                   # → .claude/skills/ (lazy-loaded methodology)
├── agents/                   # → .claude/agents/ (subagents с isolated context)
├── hooks/                    # → .claude/hooks/ (с manifest.yaml для auto-registration)
├── adapters/                 # reference-адаптеры handoff → external tool (Phase 5+)
│   └── handoff-to-ccsdd.js   # source-of-truth; instance копируется в .claude/integrator/adapters/ при /integrator:add
└── templates/
    └── project/CLAUDE.md.template  # для END-USER projects, НЕ путать с этим файлом
```

## Конвенции репозитория

### Коммиты

- Conventional commits: `feat(scope):`, `fix(scope):`, `docs(scope):`, `refactor(scope):`
- Scope обычно: `bootstrap`, `product`, `integrator`, `design`, `gitignore`, `roadmap`
- В commit message — что изменилось. **Rationale — в DEV_JOURNAL**, не в commit.

### Обновление CHANGELOG vs DEV_JOURNAL

**SSOT — таблица «Process triggers — harness contract (D7)» выше. Здесь правил НЕТ, только указатель.**

Раньше здесь стояла вторая таблица тех же обязательств — и она **разошлась** с первой: обещала CHANGELOG на любой `fix:` **без** квалификатора consumer-zone, т.е. строже, чем принуждает `process-gate.js` (условие в коде — `(isFeat || isFix) && touchesConsumer`). Классический дефект «одно правило записано дважды». Свёрнута в указатель (DEC-DEV-0197 / D12); её уникальные строки — `refactor:`, `docs:`, имена секций `### Added | Fixed | Modified` — **подняты в SSOT-таблицу, не потеряны**.

**Разделение по адресату** (единственное, что нужно держать в голове сверх таблицы):
- **CHANGELOG** — для **consumers**: что изменилось в поставке. Триггер — тронут consumer-zone.
- **DEV_JOURNAL** — для **будущего разработчика**: почему так решили. Триггер — есть rationale / root cause / отвергнутая альтернатива.

### Файловая иерархия

- **commands/, skills/, agents/, hooks/** — артефакты, которые **попадают в `.claude/` пользователя** при bootstrap. Должны быть production-ready (никаких WIP).
- **docs/** — SPEC и каталоги. Source of truth для archteture.
- **templates/** — шаблоны, инстанциируемые при bootstrap (substitute placeholders).
- **dev/** — внутренние документы про разработку **самой экосистемы**. Не попадают в пользовательские проекты.

### Hook конвенции

Hooks живут в `hooks/<module>/<file>.js` + `hooks/<module>/manifest.yaml`. Manifest schema задокументирована в [hooks/product/manifest.yaml](hooks/product/manifest.yaml).

При добавлении нового hook:
1. Drop `.js` файл в `hooks/<module>/`
2. Добавить entry в `manifest.yaml`
3. `/ecosystem:bootstrap` (идемпотентно) подхватит автоматически

### Skill конвенции

Skills — это `.md` файлы в `skills/<module>/<name>.md` с frontmatter:
```yaml
---
description: <one-line, для discovery>
---
```

Lazy-loaded — Product Module load'ит per задаче (~3-5 одновременно).

**Convention для skills, создающих артефакты** (codified DEC-DEV-0012, 2026-04-20):

Каждый skill, создающий артефакт типа из каталога `docs/pmo/artifacts/`, **обязан содержать explicit frontmatter template** в теле skill (не только reference на artifact spec). Template должен:

1. **Перечислить все canonical fields** с правильными именами (per artifact spec)
2. **Включить anti-pattern warnings** — список запрещённых рядом-стоящих field names, которые AI склонен использовать «для естественности»
3. **Использовать ASCII slug** в naming convention для filename (per `docs/pmo/artifacts/README.md` slug rule)

**Reference implementation:**
- [`skills/product/problem-discovery.md`](skills/product/problem-discovery.md) Step 3 (после DEC-DEV-0011 fix) — explicit PS frontmatter template + anti-pattern list (`confidence_rationale`, `rationale`, `confidence_reasoning` явно запрещены)
- [`skills/product/note-promote.md`](skills/product/note-promote.md) Step 3 — explicit templates per target type (FM, SC, BR, IC, NFR, HYP) с anti-pattern warnings

**Rationale:** Phase 2 PS drift (DEC-DEV-0011) показал: skills без explicit template подвержены AI-склонности «переименовать field для естественности». Inline templates + warnings — лучшая defensive programming в skill prompts.

**Чеклист — при написании или правке ЛЮБОГО skill, создающего артефакт** из каталога `docs/pmo/artifacts/`:

> Scope правила прибит к **свойству скилла** («создаёт артефакт»), а НЕ к номеру фазы. Раньше здесь стояло «при написании *Phase 3* skill checklist» — фаза давно прошла, и правило вместе с ней стало мёртвым, хотя чеклист полезен для любого такого скилла (DEC-DEV-0197 / D12).

- [ ] Frontmatter template присутствует
- [ ] Все canonical fields перечислены
- [ ] Anti-pattern warnings explicit
- [ ] Filename slug rule referenced
- [ ] DEV_JOURNAL entry если non-trivial design choice

## Что делать в этой сессии (Claude)

При запуске сессии в этом репо:
0. **Карта и топология источников — уже у тебя, открывать ничего не нужно.** Дайджест «класс информации → SSOT → кому верить при конфликте» + тезис pipeline авто-инжектится на старте сессии (SessionStart-хук [`context-map-session-start.js`](dev/meta-improvement/hooks/context-map-session-start.js) — генерит его **из живых файлов**, не из копии). Канон, который дайджест несёт: «при конфликте верь `git log` + хвосту журнала, ROADMAP/память отстают». Полные файлы — **для добора по требованию**, когда дайджеста мало: [docs/MAP.md](docs/MAP.md) (визуальный entry-point: pipeline D1-D6 + C4 container) · [`dev/INFORMATION-MAP.yaml`](dev/INFORMATION-MAP.yaml) (information-topology resolver: поля `verify:` / `note:`, подводные камни классов). Тумблер: env `CONTEXT_MAP_DIGEST=0`. (DEC-DEV-0197 / D1: правило «сориентируйся по карте» не исполнялось, но входило в конъюнкцию always-on правил и тянуло вниз соблюдение остальных ⇒ смена канала на push, БЕЗ удаления информации)
0.5. **Что мы уже делали (work-rails)** — сводка истории работ авто-инжектится на старте сессии (SessionStart-хук [`rails-session-start.js`](dev/meta-improvement/hooks/rails-session-start.js) регенерирует [`rails/RAILS.md`](dev/meta-improvement/rails/RAILS.md)). Сверься перед правкой области: «сколько раз / с каким исходом трогали X / кандидат в скилл». Вручную: `node dev/meta-improvement/scripts/rails-build.js`. Тумблер: env `RAILS_AUTOGEN=0`. Класс `work-history` в INFORMATION-MAP. (DEC-DEV-0108/0110)
1. **Прочитай этот файл** (CLAUDE.md — auto-loaded)
2. **Загляни в [DEV_JOURNAL.md](DEV_JOURNAL.md)** — последние 3-5 entries, чтобы знать недавний контекст decisions
3. **Проверь [ROADMAP.md](ROADMAP.md) секцию "Где мы сейчас"** — может быть устарела относительно git log
4. **D7 ritual** (см. [`dev/meta-improvement/`](dev/meta-improvement/)):
   - **Фаза (kickoff / closure) и patch-cut здесь НЕ дублируются** — их триггеры и обязательства живут в SSOT-таблице «Process triggers» выше (строки «перед фазой / после фазы» и «собрался резать версию / доставлять в пилот»). Сами чеклисты: [`checklists/phase-kickoff.md`](dev/meta-improvement/checklists/phase-kickoff.md) (+ соответствующий readiness) · [`checklists/phase-closure.md`](dev/meta-improvement/checklists/phase-closure.md) · [`checklists/patch-cut.md`](dev/meta-improvement/checklists/patch-cut.md) (нарезка версии из CHANGELOG `[Unreleased]`; контракт накопления + cut — CONVENTIONS §11). *(Раньше эти три строки стояли и здесь, и в таблице — расходящимися формулировками; DEC-DEV-0197 / D12.)*
   - **Паттерны — какой под какой триггер** (9 шт.; колонка «When applicable» в [`patterns/README.md`](dev/meta-improvement/patterns/README.md) — она же SSOT, если разойдётся с этим списком):

     | Триггер | Паттерн |
     |---|---|
     | после архитектурного рефактора / перед kickoff'ом следующей единицы | `spec-drift-sweep.md` |
     | перед содержательной реализацией фазы/единицы | `readiness-gate.md` |
     | скилл создаёт артефакт со своей frontmatter-схемой | `b1-frontmatter-convention.md` |
     | планирование единицы; meta-дизайн; подозрение на scope creep | `cuttable-scope-discipline.md` |
     | после реализации, до того как поверить в интеграцию | `smoke-test-plan.md` |
     | качественное/семантическое сравнение, где вердикт — суждение (особенно когда у судьи есть stake) | `blind-comparison-protocol.md` |
     | пишу/аудирую путь, спавнящий DA-субагента | `da-subagent-type-contract.md` |
     | агент/субагент/хук/процесс повёл себя не так — ДО того как винить модель | `config-failure-first-triage.md` |
     | многосессионная единица; ~45%+ окна / симптомы потери контекста; живой `dev/<track>/SEAM.md` | `context-seam.md` (SSOT механизма — `dev/deferred/CONTEXT_SEAM_PROTOCOL.md`) |

   - При memory drift: [`skills/memory-sync.md`](dev/meta-improvement/skills/memory-sync.md)
   - Verify update outcome: [`scripts/verify-update.sh`](dev/meta-improvement/scripts/verify-update.sh)
   - Hook reminder зарегистрирован (`.claude/settings.local.json` PostToolUse Bash) — fires на phase-completion commits
5. **DEV_JOURNAL перед коммитом — не спрашиваю, а знаю: это 🔒-обязательство, принуждаемое кодом.** `process-gate.js` блокирует коммит, если `fix:` или упоминание `DEC-DEV-N` идут без записи в `DEV_JOURNAL.md`. Триггеры — в SSOT-таблице «Process triggers». *(Прежняя формулировка «перед commit-ом значимых изменений — спроси, нужна ли запись» была прозой с неопределённым «значимых» поверх уже существующего гейта; DEC-DEV-0197 / D12.)*

## Memory

У меня (Claude) есть persistent memory для этого проекта в `~/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/`. Содержит:
- User profile (solo dev, methodology-conscious, RU)
- Project status snapshot
- Architecture summary
- Methodology agreements (DEV journal, dogfooding, incremental pilot)
- DEV journal reference

**Память отстаёт by design.** Но «всегда верифицируй перед любым действием» — правило без scope, неисполнимое буквально и потому не исполняемое вообще. Явный триггер и scope (DEC-DEV-0197 / D12):

- **Триггер:** действие опирается на **статус или историю** — что уже построено / что смёржено / где мы в roadmap / свободен ли номер DEC-DEV / трогали ли мы эту область раньше.
- **Тогда:** источник правды — `git log` + **хвост** `DEV_JOURNAL.md` (+ `CHANGELOG` по consumer-поставке). Память и `ROADMAP` — **отстающие снапшоты**; при конфликте прав git + журнал (класс `status` в [`dev/INFORMATION-MAP.yaml`](dev/INFORMATION-MAP.yaml)).
- **НЕ триггер:** всё остальное (правка кода, ответ по содержимому открытого файла, разговорная реплика). Здесь верификация статуса — лишний шаг.

### Auto memory-sync (DEC-DEV-0100)

**Не жду команды «прогони memory-sync».** В конце сессии / на «готово» —
**если за сессию коммичены статус-несущие файлы** (`DEV_JOURNAL` / `ROADMAP` /
`CHANGELOG`) — сам обновляю затронутые записи памяти + индекс `MEMORY.md` +
выравниваю `last memory-sync` (CLAUDE.md) с ROADMAP «Последнее обновление». Если
статус за сессию не сдвинулся — пропускаю (sync вхолостую не нужен).

Подсказку «пора» даёт warn-хук `memory-drift-reminder.js` (PostToolUse:Bash,
event-gated на status-файлы; **detect-only** — сам память не пишет, чтобы не
рекурсировать Write→hook→Write). Полная процедура —
[`dev/meta-improvement/skills/memory-sync.md`](dev/meta-improvement/skills/memory-sync.md).
Держи записи tight (~5-10 предложений; раздутую запись разгружай в архивную, не
храни историю в активной — прецедент `project_ecosystem_status`).
