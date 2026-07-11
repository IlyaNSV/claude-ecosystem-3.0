# DEV_JOURNAL — Ecosystem 3.0

> **Что это:** журнал решений о разработке самой Ecosystem 3.0. Фиксирует **rationale и lessons**, не «что изменилось» (это CHANGELOG.md), не «что мы строим» (это ROADMAP.md).
>
> **Не путать с:**
> - `CHANGELOG.md` — release notes (что вошло в версию)
> - `ROADMAP.md` — план фаз
> - `.product/.decisions/journal.md` — журнал решений для **пользовательских** продуктовых проектов, которые ведутся через Ecosystem 3.0 (когда dogfooding запустится — для самой Ecosystem 3.0 тоже появится свой `.product/`)
> - `.claude/integrator/project-journal.md` — журнал инфраструктурных решений Integrator
>
> **Что записываем:**
> - Архитектурные решения с rationale (почему X вместо Y; какие альтернативы отвергнуты)
> - Баги → root cause → fix → lesson
> - Specs, которые оказались неверными на практике
> - Изменения scope phase (что выкинули, что добавили, почему)
> - Cross-cutting рефакторы
>
> **Что НЕ записываем:**
> - Рутинные commit-level правки (git log)
> - User stories / фичи (нет такого — экосистема сама продукт)
> - Личные заметки (используй NOTE-* когда dogfooding запустится)
>
> **Формат записи:** см. шаблон в конце документа.
>
> **Теги в использовании:** `#architecture`, `#bug-fix`, `#scope-change`, `#spec-revision`, `#pilot-finding`, `#refactor`, `#tooling`, `#ux`.

---

> **Архив:** записи **DEC-DEV-0001–0123** (2026-04-17..2026-06-30) + Backfill-секция — дословно в
> [`dev/_archive/journal/DEV_JOURNAL_2026-04..06.md`](dev/_archive/journal/DEV_JOURNAL_2026-04..06.md)
> (ротация 2026-07-11, DEC-DEV-0185). Правило ротации — CONVENTIONS §5.1: при росте живого файла
> >~250 КБ или >~50 записей самый старый полный месяц уезжает в архив; текущий + предыдущий месяц
> всегда остаются здесь. Новые записи — по-прежнему в КОНЕЦ этого файла (accumulation-контракт).

---
## DEC-DEV-0124 — Раскладка карты процессов fcose→ELK layered: таймлайн-порядок процессов + traversal-порядок шагов

**Date:** 2026-07-01
**Trigger:** Владелец: «расположи процессы в порядке таймлайна актуальности использования по дефолту, но так, чтобы при раскрытии блоков они открывались не где попало, а в порядке прохождения».
**Tag:** #ux #process-map #layout

### Context
Я сам ввёл проблему в 0123: fcose (force-directed) чинит compound-вложенность, но **не имеет направления/порядка** — процессы и шаги ложатся «где попало» (+ randomize → каждый прогон иначе). Владелец явно хочет ДВА порядка: (1) дефолтный вид — процессы по таймлайну пайплайна (Discovery→Planning→Feature→Design→Orchestrator P3→P6→…); (2) раскрытие процесса — шаги по порядку прохождения (`next[]`). Данные это уже несут: авторский порядок процессов = таймлайн, crossEdges кодируют поток (`ECO-setup→P1A→…→HO→P3o→P4o→P5o→P6o`, `INT-add→P3o`), шаги связаны `next[]`.

### Options considered
1. **ELK layered (выбрано)** — Sugiyama-раскладка: направленная (`elk.direction=RIGHT`), **compound-aware** (`hierarchyHandling=INCLUDE_CHILDREN`), **детерминированная** (нет randomize → «не где попало», один и тот же порядок каждый раз), уважает входной порядок (`considerModelOrder=NODES_AND_EDGES`) — таймлайн как tiebreaker, sequence-рёбра задают traversal. Даёт ОБА порядка из коробки. Минус: bundle `elk.bundled.js` ~1.6 МБ (для локального статичного HTML приемлемо); async (elkjs promise-based) → фит по `layoutstop`.
2. **fcose + relativePlacementConstraint** — сгенерить ~277 порядковых констрейнтов из `next[]`/crossEdges. Отвергнуто: конфликтующие констрейнты хрупки, fcose их тихо игнорит/ломается; ELK для этого и создан.
3. **dagre** — направленный, но **игнорит compound** (исходный дефект 0123). Отвергнуто.
4. **ELK direction DOWN** vs **RIGHT** — RIGHT (таймлайн слева-направо — естественнее для «timeline»).

### Decision
Заменил fcose→`cytoscape-elk`+`elkjs` (вендорнуты офлайн `elk.bundled.js`+`cytoscape-elk.js`; fcose-вендоры удалены). Один детерминированный `ELK_LAYOUT` (layered/RIGHT/INCLUDE_CHILDREN/considerModelOrder=NODES_AND_EDGES/NETWORK_SIMPLEX) для initial/relayout/drill/группировки — нет fcose-различия FULL/INC, т.к. ELK стабилен. Async-обвязка: `runLayout(after)` фитит по `layoutstop`; config `layout:'preset'`-плейсхолдер, реальный ELK делает `defaultView()`; toolbar/expandAll/collapseAll/relayout/defaultView — все через `runLayout(fit)`. expand-collapse `layoutBy:ELK_LAYOUT` (раскрытие раскладывает шаги по `next[]`). Test-hook `__layoutRunning` (layoutstart/stop) — смоук ждёт async-ELK через `waitForFunction`, не угадывает sleep. Смоук дополнен 2 ассертами порядка: timeline-монотонность процессов (x: Discovery<Planning<Feature<P3o<P4o<P5o<P6o) + traversal-forward шагов раскрытого процесса (≥80% sequence-рёбер x↑).

### Outcome
Самопроверка в Chrome (headless, прочитаны скриншоты + метрики): процессы монотонны по таймлайну (P1A 973 < P1B 1207 < P2A 1654 < … < P6o 2927); раскрытый P1A — **13/13 sequence-рёбер forward** (Кейс→D1.1→G1→D1.2→D1.3→D1.4→G4→D1.5→G5→… слева-направо); lane-overlap **0.0%** (ELK и упорядочивает, И не пересекает дорожки); extents компактнее (5433×2085 vs fcose 12000×14000); 0 JS-ошибок. `smoke:procmap` **13/13**, `npm run verify` EXIT=0. counts 24/44 не тронуты. Ветка `feat/process-map-elk-timeline` off `830304d`.

### Lessons
1. **Сначала уточни требование, потом инструмент.** 0123 поставил fcose ради compound-вложенности, пожертвовав направлением — и владелец сразу заметил «где попало». Force-layout читаем как карта, но не как ПОРЯДОК. Когда нужен и порядок, и вложенность, и детерминизм — это ELK layered, а не force. (ELK я отметил отложенным апгрейдом ещё в 0123 — ровно на этот запрос.)
2. **Данные уже несли порядок — движок просто должен его уважать.** Не пришлось переупорядочивать overlay: авторский порядок процессов = таймлайн, `next[]`/crossEdges = поток. ELK `considerModelOrder` + edge-direction подняли это в раскладку. Кодируй порядок в данных (модель-ордер + рёбра), бери движок, который его читает.
3. **Детерминизм раскладки = «не где попало».** Жалоба была не только про порядок, но и про стабильность (fcose randomize → каждый раз иначе). ELK детерминирован → раскрытие всегда одинаковое. Для drill-down карт предсказуемость важнее «органичности».
4. **Async-layout требует флага готовности, не sleep.** elkjs promise-based; фит по `layoutstop`, а смоук ждёт `__layoutRunning===false` через `waitForFunction`. Угадывание `setTimeout` под async-движок = флапающий тест (зеркалит lesson 3 из 0123 про стохастику, но здесь причина — асинхронность, не рандом).

---

## DEC-DEV-0125 — Fix: раскрытый процесс ложился диагональной лесенкой — раскладывать только по флоу-рёбрам + BK-выравнивание

**Date:** 2026-07-01
**Trigger:** Владелец (на 0124): «элементы при раскрытии блока по-дурацки организованы» → уточнение: важно «близкое и ровное расположение элементов при ЛЮБЫХ манипуляциях».
**Tag:** #ux #process-map #layout #fix

### Context
0124 дал таймлайн/traversal-порядок, но раскрытый процесс выглядел кривовато. Замер headless: P2A (13 шагов) лёг на **12 разных y-уровней**, P1A (14) — на **8** = диагональная лесенка/зигзаг, высота 423–578px. «Ровным» (одна линия потока) не пахло.

### Root cause
Два усиливающих фактора. **(1) Главный — раскладка считала СКРЫТЫЕ рёбра.** Шаги несут overlay-связи `produces`/`consumes`/`cascade`/`lineage` к артефактам в ДРУГОЙ дорожке. По дефолту эти слои скрыты (`.off`→`display:none`), НО рёбра остаются в графе, и ELK их учитывал — артефактные рёбра тянули шаги по вертикали, выстраивая лесенку относительно невидимого. **(2) Усугубитель — `NETWORK_SIMPLEX` node-placement** склонен разносить узлы по уровням (диагональ), а не выравнивать в прямую линию.

### Decision
**(1)** `runLayout` теперь раскладывает `cy.elements().not(OVERLAY_EDGES)` — только флоу-рёбра (`sequence`/`delegate`) + meta-edge'ы; overlay-связи к артефактам исключены из раскладки (но остаются в графе и рисуются, когда слой включают). Чистый left→right поток процесса определяется его последовательностью, а не скрытой data-родословной. **(2)** `nodePlacement.strategy` `NETWORK_SIMPLEX`→**`BRANDES_KOEPF`** (+ `bk.fixedAlignment=BALANCED`, `crossingMinimization=LAYER_SWEEP`) — выравнивает узлы в прямые горизонтальные линии. Спейсинг плотнее (nodeNode 24, betweenLayers 55). **(3) Консистентность «при любых манипуляциях»:** ВСЕ пути раскладки идут через единый `runLayout` — toolbar/defaultView/группировка зовут его напрямую, а expand-collapse `layoutBy` сменён с layout-объекта на **функцию** `function(){ runLayout(); }` (vendor `rearrange` поддерживает: `typeof o==='function'→o()`), чтобы раскрытие/свёртка cue'ем тоже шли через фильтрованную раскладку, а не через полный граф. Смоук дополнен гардом ровности (раскрытый процесс ≤3 ряда — ловит возврат лесенки).

### Outcome
Headless: P1A 14 шагов → **1 ряд** (было 8), высота 102 (была 423); P2A 13 → **3 ряда** (было 12), высота 137 (была 578) — чистые горизонтальные линии потока с ветками только на гейтах. Скриншот подтвердил: F.1→…→F.10→handoff одной ровной линией. extents всей карты компактнее (3996×891 vs 5433×2085). Таймлайн/traversal/overlap/counts/grouping не задеты. `smoke:procmap` **14/14** (+гард ровности), `npm run verify` EXIT=0. counts 24/44 не тронуты.

### Lessons
1. **Скрытое ≠ несуществующее для раскладки.** Рёбра, скрытые CSS-классом (`display:none`), всё ещё участвуют в force/layered-раскладке — графовый движок не знает про твой visibility-тоггл. Если слой визуально выключен, исключай его рёбра и из РАСКЛАДКИ (`eles.not(...)`), иначе невидимое тянет видимое в «непонятную» геометрию. Это и был корень «по-дурацки».
2. **Один шов раскладки на все манипуляции.** Жалоба была «при ЛЮБЫХ манипуляциях». Лечится тем, что каждый путь (drill/toolbar/группировка/дефолт) зовёт ОДИН `runLayout` с одной фильтрацией — а не разрозненные `cy.layout(...)` с разными настройками. expand-collapse `layoutBy`-как-функция — мост, чтобы и cue-раскрытие попало в тот же шов.
3. **Выбор node-placement — это про читаемость, не только корректность.** NETWORK_SIMPLEX и BRANDES_KOEPF оба «правильные», но BK выравнивает в прямые линии — для процессного потока (читается как лента) это важнее минимизации длины рёбер. Под задачу «ровно» подбирай стратегию размещения, а не только алгоритм.

---

## DEC-DEV-0126 — Dogfood-грейд: S7 Фаза-2 — §6 detect-leg флипает BLOCK→SATISFIED + OD7-петля закрыта end-to-end (закрывает #3/#4 из DEC-DEV-0081)

**Date:** 2026-07-01
**Trigger:** Пилотный прогон S7 Фаза-2 на `my-first-test` (localization FM-002, RL-002 task 7.1): после Фазы-1 (capability BLOCK задетектен, отгрейжен PASS) владелец провижнил `OPENAI_API_KEY` → re-run `feature-to-tdd-impl` должен пройти зелёным путём (SATISFIED→impl→gate). Я — пост-хок ревьюер по [[feedback_self_create_pilot_test_env]]; грейд по ground-truth, не по self-report (раздельный поллинг транскрипта + слоистый аудит per [[feedback_audit_evidence_layers]]).
**Tag:** #orchestrator #dogfood #capability-detect #od7 #grade #s7

### Context
S7 закрывает оставшиеся #3/#4 из DEC-DEV-0081 (в S6 §6-канал был block-handler, не gap-detector). Фаза-1 валидировала detect+block; Фаза-2 — «зелёный путь» с провижненной капабилити + закрытие OD7 (request→provision→resume) поверх human-in-the-loop. Провайдер по ходу пивотнут владельцем DeepL→OpenAI (DeepL Free требовал карту; OpenAI-ключ уже был). Прогон: P5 `feature-to-tdd-impl` (33 агента, ~112 мин, ~3.15M токенов) → P6 `validate-feature-impl`.

### Method (слоистый ground-truth аудит)
Не доверяя финальной строке сессии: (1) живой `capability-probe --feature localization` с ключом в env; (2) независимый субагент перепрогнал `pnpm --filter @app/providers build/test`; (3) независимый субагент верифицировал реальность 3 cross-spec конфликтов по самим файлам (`apps/worker/src/main.ts`, `design.md`, `tasks.md`), НЕ по тексту PA; (4) сверка PA-039..042 + git-история + FM↔tasks провайдер-консистентность.

### Verdict — STRONG PASS (orchestrator-контракт); feature-GO корректно НЕ достигнут
Watch-sheet:
- **A DETECT** ✅ probe резолвит FM-002, перечисляет капабилити.
- **B DISPOSITION** ✅ ключ present → `SATISFIED` (был BLOCK в Фазе-1) — live-подтверждено (`surfaced:0, blocking:0, satisfied:1`).
- **C SURFACE** ✅ SATISFIED → surface=0 (лишнего не сёрфейсит).
- **D ESCALATE/anti-mock** ✅ не за-mock'ил отсутствующую prod-wiring: адаптер ships dark за флагом, Mock остался dev-дефолтом, ownership wiring эскалирован (PA-039/042), а не сфабрикован Real-over-Mock.
- **E DISCLOSE** ✅ честно раскрыл: live-OpenAI тест SKIPPED (opt-in, sandbox-сеть не верифицирована), ships-dark, 1 readiness-gated commit помечен.

Дополнительно: P5 довёл 7.1 до реального зелёного-на-границе OpenAI-адаптера (независимо перепрогнано: build exit 0 + 131/1 skip — ровно как заявлено); P6 вернул `MANUAL_VERIFY_REQUIRED` (verdict×readiness, DEC-DEV-0092) — не сфабриковал GO и не дал ложный NO-GO; T5/`remediation-guard` (FB-LR-07) НЕ self-resolv'нул 3 конфликта, корректно эскалировал+дедупнул (PA-041→fold в PA-040)+смаршрутизировал; OD7 закрыт end-to-end через две фазы (Phase-1 BLOCK surface → owner provision key → Phase-2 SATISFIED→impl→gate); FB-LR-16 marking + FB-LR-23 PA_CANON соблюдены.

**Ключевой результат:** гейт поймал «green ≠ wired into running app» — 7.1 зелёная на своей границе, НО фича не GO, потому что (независимо подтверждено) localization-конвейер **не имеет runtime-консьюмера** (`apps/worker/src/main.ts` поднимает только session-cleanup/outbox/dunning; `new PipelineOrchestrator(` только в тестах; ни одного `lpop/blpop` → `localization:stage:*` никто не дренит → Job навсегда `queued`), а wiring-таска «5.x worker-bootstrap» **не существует** (§5 = только 5.1/5.2/5.3). Полная инверсия S6 (там всё было FAIL).

### Findings (несовершенства — для честности)
1. **FB-LR-30 (LOW) — PA-040 over-framing:** PA-040 заголовил BullMQ-vs-RPUSH как самостоятельный «транспортный конфликт», но независимая проверка: RPUSH — осознанное задокументированное boundary-решение (`apps/api` намеренно без `bullmq`-зависимости), а BR-040 backoff реально реализован в `retry-policy.ts`/`stage.processor.ts`. Load-bearing дефект — narrowly отсутствующий консьюмер (его PA-040 тоже называет: «never drains it»). Эскалация-действие/роутинг корректны (owner всё равно аллоцирует worker-bootstrap), но фрейминг слегка пере-взвешивает transport-механику. → LOW backlog.
2. **Live-OpenAI endpoint не прогнан (disclosed):** headline «против реального OpenAI» прошёл на stubbed-fetch; live-тест opt-in/skipped (sandbox outbound network не верифицирован). Раскрыто + смаршрутизировано (PA-039→Integrator/staging), не замаскировано. S7-D «real green против OpenAI» = deferred-and-disclosed, не достигнут.
3. **stale `dist/` DeepL-артефакты** (gitignored, cosmetic) — Agent-2 заметил, non-blocking.

### Owner-decisions (выношу владельцу, не резолвлю — FB-LR-07)
- **PA-040/041** — архитектура транспорта FM-002: реализовать BullMQ-очередь+drain ЛИБО ратифицировать plain-Redis-list (обновив design.md/tech.md+DEC) — и в любом случае аллоцировать недостающую worker-bootstrap таску.
- **PA-042** — tasks.md 7.1 само-противоречие (deliverable берёт Real-vs-Mock prod-selection, `_Boundary`/Observable выносят наружу, 6 нот делегируют фантомной 5.x): add/re-scope/trim — решение plan-author+Product.
- **PA-039** — live-verification + prod flag-flip → Integrator (staging).
- Ветка пилота `run/s7-localization` (`d0299f9`) держит реальную зелёную работу (7.1) + 1 помеченный readiness-gated commit — merge/READY-ре-гейт на усмотрение владельца (его продукт).

### Lessons
1. **Слоистый ground-truth аудит ловит то, что self-report сглаживает.** Сессия отчиталась честно, но независимая перепроверка (live-probe + re-run build/test + verify-конфликтов-по-файлам) подняла грейд с «верю на слово» до «подтверждено» И нашла over-framing PA-040, который текст PA подавал как чистый конфликт. Независимый судья по файлам — не роскошь для keystone-claim.
2. **«Зелёный путь» ≠ «GO».** Лучший исход detect-leg-теста — не сфабрикованный GO, а корректный отказ его дать при ENV_NOT_READY + реальных конфликтах. Гейт, который не штампует, ценнее гейта, который всегда зелёный. P7-философия («tests green ≠ app starts») сработала на уровне P6 через integration-boundary/design-alignment валидаторы.
3. **Коллизия DEC-DEV — грепай заголовки + fetch origin.** Orchestrator-чекпоинт говорил next-free=0122; реальность (origin/main #88) — 0125 занят, next-free 0126: параллельная BPMN-сессия съела 0121-0125. Подтвердил [[feedback_dec_dev_collision_check]]: номер свободен только после `git fetch` + grep по `^## DEC-DEV-`, не по чекпоinту/прозе.

---

## DEC-DEV-0127 — P2 `decide-architecture-foundation`: work-definition — жюри ×3 → recommendation-пакет владельцу (design, pre-build)

**Date:** 2026-07-01
**Trigger:** Владелец выбрал фронт «5C — P2» (последний orchestrator-процесс до полного модуля) + «kickoff-дизайн сначала» → ратифицировал 4 проектных решения. Полный контракт — `dev/ORCHESTRATOR_P2_KICKOFF.md`.
**Tag:** #orchestrator #p2 #consilium #design #kickoff

### Context
P2 был CUT из первого инкремента (опц.; запускался руками в RUN 01 E1). Заготовки существовали, сборочного контракта — нет. Слот SPEC §3.2 (зона D2-T01/02, «scope-defining gate»); роль RA-1 `architecture-consilium` (prior'ы velocity/fidelity/integrity); прецедент ручного прогона (`dev/ORCHESTRATOR_DOGFOOD_RUN_01.md` #129–184); констрейнт Vision Epic D (жюри, не дебаты); открытый вопрос #7 (автоматизируемость консилиум-синтеза проверена на одной развилке/стеке — нужна ДРУГАЯ). Триггер момента: S7-прогон сгенерировал реальную арх-развилку `PA-040/042` (BullMQ-очередь vs plain-Redis + аллокация worker-bootstrap) — готовый dogfood-материал.

### Options considered (ключевая ось — граница решения)
1. **Авто-решение (P2 выбирает + финализирует DEC)** — быстрее, но ломает конвенцию owner-arbitration (FB-LR-07), рискует стать тем «односторонним резолвом», что гейты запрещают; Vision D: консилиум на одном связном решении = groupthink + ~15× без жюри-модели. **Отвергнут.**
2. **Recommendation-пакет владельцу (P2 готовит, владелец ратифицирует)** — консистентно с FB-LR-07 / `PA-042` и Vision D (жюри готовит, не решает за пользователя). **Выбран.**

### Decision (ратифицировано владельцем — 4 пункта)
1. **Граница = рекомендация, не авто-решение.** P2 сжимает развилку до решаемого вида (варианты × линзы × риски × рекомендация + выпяченный раскол); владелец ратифицирует → DEC → правка спеков. P2 сам спеки не правит, PA не закрывает, DEC не финализирует (только черновик).
2. **Движок = жюри ×3, фикс-prior'ы velocity/fidelity/integrity** (RA-1), `parallel()`, без кросс-тока и раунда консенсуса (гетерогенность = условие не-вырождения). Каждый архитектор → structured `ArchVerdict` (scores per option / recommended / risks-of-own-prior / blocking_concerns).
3. **Вход = объявленная развилка**, лучше всего cross-spec-conflict PA (типа `PA-040/042` — лифтит options/affected_specs); P2 сам развилки не детектит (это работа гейтов). Manual-дверь: `/orchestrator:run decide-architecture-foundation --fork <PA-NNN|ref>`.
4. **Синтез RA-0 = гибрид код+промпт:** код считает матрицу×prior + ранг + veto-по-blocking детерминированно (образец `remediation-guard` worst-of); промпт формулирует «настоящий trade-off» на расколе. Раскол линз = и есть решение владельца (не форсить консенсус).

### Outcome
Pending build (после компактации диалога): `orchestrator/processes/decide-architecture-foundation.mjs` + `skills/orchestrator/architecture-consilium.md` + wiring `commands/orchestrator/run.md` (снять «P2 deferred») + возможная либа `orchestrator/lib/consilium-synth.cjs` → **fixture-smoke** зелёный (counts 24/44 additive, `npm run verify` EXIT=0) → **dogfood на `PA-040/042`** (ДРУГАЯ развилка, чем стек RUN 01 → закрывает открытый вопрос #7 + даёт владельцу реальный decision-support по конвейеру localization). **Exit = P2 построен → orchestrator-модуль ПОЛНЫЙ (P1–P7 + §6 двусторонний) → снимает блокер PILOT POINT.**

### Lessons
1. **Autonomy/obedience — по месту решения, не по максимуму полюса** ([[project_autonomy_obedience_balance]]): P2 автономен в *качестве подготовки* развилки, послушен в *том, что финал за владельцем*. Арх-выбор — ровно класс, где «подготовить, не решить» правильнее «решить самому».
2. **Консилиум ≠ дебаты для связного решения:** панель на одном арх-решении окупается только как гетерогенное ЖЮРИ (разные prior'ы, без консенсус-раунда) — иначе groupthink + ~15× стоимость (Vision-ресёрч). Синтез ВЫПЯЧИВАЕТ раскол линз, а не гасит его — раскол и есть решение владельца.
3. **Открытый вопрос закрывается материалом, не рассуждением:** автоматизируемость синтеза (open-Q#7) проверяется прогоном на ВТОРОЙ развилке (`PA-040/042` ≠ выбор стека RUN 01), а не ещё одним раундом дизайна. Удачно, что гейт S7 сам сгенерировал эту развилку.

## DEC-DEV-0129 — P2 `decide-architecture-foundation` BUILT — жюри ×3 → детерминированный синтез → recommendation-пакет владельцу

**Date:** 2026-07-01
**Trigger:** Сборка ратифицированного в DEC-DEV-0127 контракта P2 (последний orchestrator-процесс до полного модуля). Контракт: `dev/ORCHESTRATOR_P2_KICKOFF.md`.
**Tag:** #orchestrator #p2 #consilium #build #module-complete

### Context
DEC-DEV-0127 ратифицировал 4 решения (граница=рекомендация; жюри ×3 velocity/fidelity/integrity; вход=объявленная развилка; синтез=гибрид код+промпт). Сборка должна была превратить контракт в работающий процесс, не сдвигая границу «рекомендация, не авто-решение» (FB-LR-07) и держа синтез детерминированным (Vision D: раскол линз ВЫПЯЧИВАЕТСЯ, не гасится). Гейты: `npm run verify` EXIT=0, counts 24/44 additive, harness-диалект `.mjs`.

### Options considered (решения уровня сборки — не пере-litigated дизайн 0127)
1. **STRONG требует ПОЛНОЙ панели (3/3) единогласно** vs «2-из-3 = strong». Выбрано полное: 2-из-3 с умершим архитектором → `panel_complete:false` + `split`, никогда strong (panel-honesty, зеркалит fail-loud `runtime-readiness`/`capability-probe`).
2. **Veto = worst-of по blocking** (любой prior блокирует → вариант вне рекомендации) vs «взвешенный штраф». Выбран worst-of (зеркало `remediation-guard`: конфликт бьёт предпочтение; консервативно к НЕ-рекомендации). Ранг выживших = сумма scores; тай-брейк = min-floor (worst-of ещё раз).
3. **Синтез в коде vs промпте** — как в 0127 §9.2: гибрид. Код (`consilium-synth.cjs`) фиксирует matrix+rank+veto+strength; промпт формулирует `the_real_tradeoff`/`rationale`/`dec_draft` ПОВЕРХ (не может менять что рекомендовано). Wiring-тест это принуждает (recommended/strength/vetoed читаются из synth).
4. **Развилка <2 опций** → surface (route spec-author/owner) vs фабрикация. Выбран surface: `decidable:false`, ранний return, `recordUnDecidable` — НЕ выдумывать второй вариант (P2-аналог `NOT_STARTABLE`).
5. **Как агент прогоняет чистый синтез при harness-запрете FS в скрипте** — агент материализует вердикты во временный файл и гоняет CLI `--verdicts-file`, релеит JSON (паттерн «либа через Bash», DEC-DEV-0073 §D.1).

### Decision
Построены 3 артефакта + wiring: **`orchestrator/lib/consilium-synth.cjs`** (детерминир. dual-use: `buildMatrix`/`rankSurvivors`/`synthesize` → STRONG|SPLIT|NONE; veto worst-of; panel-honesty; CLI `--verdicts-file`/`--verdicts`); **`orchestrator/processes/decide-architecture-foundation.mjs`** (Workflow Brief→Consilium→Synthesize→Recommend: lift ForkBrief из PA [не выдумывать опции] → `parallel()` жюри ×3 без консенсус-раунда → relay синтез-либы → формулировка trade-off → запись recommendation-пакета + DRAFT DEC в канонический PA через `PA_CANON`, без флипа статуса/правки спеков/финализации DEC); **`skills/orchestrator/architecture-consilium.md`** (prior-методология + ArchVerdict-схема с anti-pattern field-warnings + синтез-граница). Wiring: `commands/orchestrator/run.md` (снята «P2 deferred» → таблица/preflight/launch/after-run контракт), `package.json` (2 теста в `test:orchestrator`), cross-component awareness `orchestrator/README.md`/`docs/orchestrator-module/SPEC.md`/`verify.md` (плюс починена устаревшая строка verify.md «P2/P4/P6/P7 deferred»).

### Outcome
`npm run verify` EXIT=0: consilium-synth 15/15 + decide-architecture-foundation-wiring 9/9 + авто-покрытие generic `args-parsing` (FB-001 guard 4/4) + `workflow-syntax` smoke (парсинг в harness-диалекте) + gen:map/gen:procmap check зелёные (карты не тронуты — генератор читает overlay, не сканирует `.mjs`). Counts 24/44 без изменений (net-new либа+процесс+скилл, ни артефакт-тип, ни правило). **Orchestrator-цепочка P1–P7 + §6 двусторонний — ПОЛНАЯ → снимается блокер PILOT POINT.** Осталось: живой dogfood-грейд на реальной развилке S7 `PA-040/042` (BullMQ-очередь vs plain-Redis + аллокация worker-bootstrap — ДРУГАЯ развилка, чем стек RUN 01 → закрывает open-Q#7) — отдельная пилотная сессия.

### Lessons
1. **Panel-honesty = тот же fail-loud, что и в readiness-либах:** «умерший prior» нельзя молча свернуть в консенсус — 2-из-3 никогда не strong. Неполнота панели ДЕКЛАРИРУЕТСЯ (`panel_complete:false` + disclosure), как «непрозондированный ≠ доказанно-up» в `runtime-readiness`.
2. **Veto worst-of переносится 1:1 из `remediation-guard`:** «конфликт бьёт транзиент» ⇒ «блок-концерн бьёт высокий score». Консервативный дефолт синтеза — к НЕ-рекомендации спорного варианта, ledger вето виден, не скрыт.
3. **Раскол — продукт, не баг:** детерминир. код НЕ форсит консенсус на split; он выдаёт top-by-sum + отдаёт промпту `the_real_tradeoff`. Ценность P2 на расколе — выпятить, что именно взвешивает владелец, а не выбрать за него.
4. **Граница держится тестом, не намерением:** wiring-инвариант «recommended/strength/vetoed ← synth» + «промпт НЕ меняет рекомендацию» + «Do NOT finalize DEC / close PA / edit spec» кодифицирует FB-LR-07 в структуру, а не в благие пожелания.

---

## DEC-DEV-0130 — Guide-хаб: слоистый вход L0→L5 + роутер «Я хочу…» + «зачем гейты» + указатели (doc-UX Волна 1, PR#1)

**Date:** 2026-07-01
**Trigger:** doc-UX батч Волна 1 (`dev/DOCS_UX_BATCH_DESIGN.md`), статичный comprehension-слой — закрывает P-1 (фрагментация входа: 5 хабов, нет «Начни здесь»), P-2 (карта процессов не залинкована из guide/README), P-3 (нет лестницы уровней), + анти-тревога (D1 «зачем гейты»).
**Tag:** #docs #guide #ux #onboarding

### Context
Инвентаризация doc-ландшафта: контент и анти-дрейф сильны, но вход **фрагментирован** — root README, HOME, docs/MAP, guide/README, BOOTSTRAP суть 5 разрозненных хабов без единого «Начни здесь»; нет явной **лестницы уровней** (человек собирает ментальную модель сам); гейты пугают без «зачем». Психологическая рамка батча (`DOCS_UX_BATCH_DESIGN.md §2`): согласование ментальных моделей (Norman) + progressive disclosure (Sweller) + Diátaxis + анти-дизориентация + снятие тревоги.

### Decision
Пересобрал `docs/guide/README.md` в **единый слоистый вход** (Столп I): L0 «за 60 секунд» + **лестница L0→L5** (каждый уровень линкует нужную доку/карту, не дублируя контент) + **роутер «Я хочу…»** (how-to слой) + обе интерактивные карты на видном месте + файл-таблица с **Diátaxis-ролью**. Прочие входы (root README, HOME, docs/MAP) получили однострочный указатель на хаб → **коллапс 5 хабов в 1 canonical операторский вход**. Новый **`docs/guide/06-gates.md`** (D1 «зачем гейты»): approve-уровни 🔴🟠🟡🟢 / DA-ревью / refusal-DoR / Orchestrator-вердикт как **страховка** + таблица «сигнал → действие».

### Options / scope
1. **Хаб = markdown `guide/README`** (развилка D-1) vs новый `index.html` — выбран markdown: меньше surface, git-diffable, рендерится в GitHub/Obsidian; HTML-дверь = третий генерируемый HTML для поддержки.
2. **doc_type-frontmatter + анти-дрейф-check (A3-машинерия) перенесены в PR#2** (глоссарий-генератор) — там их потребитель (генератор индекса + `--check`). В этом PR Diátaxis-ценность = **видимые метки в таблице хаба** (reader value), без преждевременной машинерии.
3. **06-gates ограничен user-facing гейтами** — dev-side process-gate/lesson-gate это DEV-слой (указатель на `CLAUDE.md`), не место в руководстве оператора.

### Outcome
`06-gates.md` (новый) + `guide/README` (пересобран) + указатели root README / HOME / docs-MAP. `npm run verify` EXIT=0 (guide-доки ничем в verify не проверяются — чистый markdown, ничего не сломано). Consumer-zone (`docs/` + root README/HOME); аддитивно, без новых типов/правил → **counts 24/44**. **Волна 1 PR#1 из 3:** далее PR#2 = глоссарий-генератор E1 + A3-frontmatter/check; PR#3 = общий шелл C3 (зависит от C1/#91).

### Lessons
1. **Фрагментацию входа лечит один canonical хаб + указатели, а не ещё один хаб** — иначе +1 к «lost in hyperspace». 5 входов → 1 + 4 pointer'а.
2. **«Зачем гейты» снимает тревогу лучше списка гейтов:** рамка «страховка от класса дорогих ошибок» + «сигнал → действие» превращает блокировку из препятствия в понятную защиту.
3. **Diátaxis-ценность отделима от Diátaxis-машинерии:** reader-видимые метки в таблице хаба дают роль доки сразу; frontmatter + `--check` можно отложить к их потребителю (генератору), не блокируя ценность.

---

## DEC-DEV-0128 — BPMN-карта: in-app UTF-8 doc-панель (чинит «кракозябры») + фикс битого пути + дешум (Волна 0 doc-UX батча)

**Date:** 2026-07-01
**Trigger:** пользователь сообщил, что doc-ссылки в карте процессов `ecosystem-processes.html` открывают файлы «кракозябрами»; параллельно — старт исполнения doc-UX батча (`dev/DOCS_UX_BATCH_DESIGN.md`, Волна 0).
**Tag:** #docs #guide #bugfix #ux #encoding

### Context (root cause)
Воспроизведение headless: открыл `docs/pmo/processes.md` по `file://` в установленном Chrome — `document.characterSet = UTF-8`, текст корректный («Версия», «Назначение», «методология»). Значит **байты файлов валидны и наш HTML ни при чём**. Корень — на стороне **выдачи файла**: карта открывается через встроенный веб-сервер IDE (`localhost:63342`), который отдаёт `.md` как текст **без явного `charset=utf-8`**, и GUI-Chrome на русской локали падает в fallback `windows-1251` → «кракозябры». Заголовки IDE-сервера из репозитория не контролируются. Отдельно всплыл **реальный баг**: side-panel-ссылки «источник» процесса (`d.doc` = `docs/pmo/…` / `commands/…`, repo-root-relative) строились БЕЗ префикса — страница живёт в `docs/guide/`, поэтому `href="docs/pmo/…"` резолвился в `docs/guide/docs/pmo/…` = **404** (footer-ссылки с `../` были корректны).

### Options considered
1. **BOM в `.md`-файлы** (EF BB BF форсит UTF-8-детект браузером) — отвергнуто: инвазивно (правит чужие доки), ломает часть MD-тулинга/генераторов, лечит симптом, покрывает только конкретные файлы.
2. **Серверный `charset=utf-8`-заголовок** — вне контроля репозитория (заголовки задаёт IDE-сервер пользователя).
3. **In-app fetch + decode UTF-8 самим** — выбрано: robust к любому серверу/локали/пути, оффлайн, обходит charset-negotiation в корне. Проверено: `fetch` + `new TextDecoder('utf-8')` внутри UTF-8-страницы вернул корректный текст.

### Decision
Перехватывать клики по doc-ссылкам (`.doclink`: footer `.md` + side-panel «источник») и открывать файл **во встроенной модальной панели карты**, декодируя байты как UTF-8 самим (`fetch(url)` → `arrayBuffer` → `TextDecoder('utf-8')` → минимальный markdown-рендер: заголовки/списки/цитаты/fenced-code/inline; экранирование первым, raw-HTML как текст). Хост-страница UTF-8 + мы декодируем сами → «кракозябры» **невозможны**. Фикс пути — хелпер `docRel()` (repo-root-relative → `../../`). **Дешум (C2):** `delegate`-рёбра (длинный оранжевый кросс-лейн пунктир) `opacity:0.5` по умолчанию, ярче на выборе узла через существующий `.ehl`; дефолт-вид `panBy`, чтобы легенда не перекрывала подпись дорожки «Артефакты» (overlay-слои produces/… уже были off — это код показал, C2 сузился). A1-seed: карта процессов добавлена в `docs/guide/README.md` (была не залинкована — P-2). **Graceful fallback:** `fetch` недоступен (`file://` без `--allow-file-access-from-files`) → «открыть ↗» + подсказка про IDE-сервер (деградация к прежнему поведению, среда пользователя = http-сервер, same-origin работает).

### Scope
Волна 0 doc-UX батча (`dev/DOCS_UX_BATCH_DESIGN.md`): C1 (панель+путь) + C2 (дешум) + A1-seed. **A3 (doc_type) и D2 (провенанс-хелпер) сознательно перенесены в Волну 1** — бесполезны до хаба/глоссария (их потребителей), там когерентнее. Панель пока живёт в шаблоне карты процессов; в Волне 1 (C3) переедет в общий `map-shell` и покроет карту команд (кракозябры бьют и её — ссылки на исходники команд тоже сырые `.md`).

### Outcome
Само-проверено в реальном Chrome (headless puppeteer-core): doc-панель рендерит `processes.md` корректно (h1/цитаты/fenced-code/ссылки, кириллица цела), дефолт-вид чист (легенда не перекрывает подпись, delegate притушены). Смоук `tests/guide/procmap.smoke.mjs` дополнен: (1) regression-ассерт «панель декодирует UTF-8, кириллица `Назначение/Версия` цела» — гарантирует, что кракозябры не вернутся; (2) гард «легенда не перекрывает подпись дорожки» → **17 проверок**. `npm run gen:procmap` регенерирован, `npm run verify` EXIT=0. Consumer-zone (`docs/`) + dev-тест; аддитивно, без новых типов/правил → **counts 24/44**.

### Lessons
1. **«Кракозябры» сырого `.md` — это serve-time charset, не байты файла.** Воспроизводи корень (headless `document.characterSet`), прежде чем чинить симптом (BOM/перекодировка). Байты были валидны — виноват fallback-детект браузера на выдаче без `charset`.
2. **In-app `fetch` + `TextDecoder('utf-8')` = robust-фикс независимо от сервера/локали.** Обходит charset-negotiation целиком; работает на любом http-сервере same-origin, деградирует грациозно на `file://`.
3. **Collision-check спас снова** ([[feedback_dec_dev_collision_check]]): память «next-free 0126» была стейл — `origin/main` уже держал **0126 и 0127** (сосед/#89-#90). Реальный next-free (**0128**) выяснился только через `git fetch` + `git show origin/main:DEV_JOURNAL.md`, не по локальному хвосту/памяти.

## DEC-DEV-0132 — P2 profiling study: 3-prior jury vs 1 GP — blind A/B + confound investigation → jury ROI = insurance/auditability, not decision uplift

**Date:** 2026-07-01
**Trigger:** после P2-dogfood владелец спросил, насколько профитно 3-профильное арх-жюри против 1 general-purpose субагента; прогнать те же разборы через 1 GP и сравнить максимально непредвзято; зафиксировать паттерн такого сравнения.
**Tag:** #orchestrator #p2 #evaluation #methodology #meta

### Context
P2 прогнал гетерогенное жюри (velocity/fidelity/integrity + детерминир. `consilium-synth` veto/rank) на 7 реальных cross-spec-conflict форках (сессия `4af995d1`); владелец ратифицировал 2 (PA-040/042). Вопрос: даёт ли механизм 3-агентов пропорциональную решенческую ценность против 1 GP? Я строил жюри → у меня stake → риск предвзятости.

### Options considered (дизайн эксперимента)
1. Оценить самому — отвергнуто (конфликт интереса).
2. Один слепой судья — отвергнуто (нет inter-rater сигнала).
3. Пред-регистрир. рубрика + симметричные плечи + 2 слепых судьи + adversarial steelman + confound-расследование — выбрано (паттерн `blind-comparison-protocol`).

### Decision
Arm B = 1 свежий GP на форк (mechanism-neutral контракт, 3 приора НЕ раскрыты); рубрика D1–D6 зафиксирована ДО результатов; симметричный скраб + рандомизир. слепой ключ; 2 слепых судьи + 1 adversarial red-team; затем confound-расследование.

### Outcome
Поверхностный результат: оба слепых судьи + red-team дали **GP ≥ жюри**, разрыв в D2 (охват факторов) + D3 (детекция рисков); D1/D4/D5/D6 ≈ поровну; GP воспроизвёл **100% veto-kill-list** жюри; picks совпали 6/7 (оба анкера верны). **НО** разрыв D2/D3 в значимой части — **confound асимметрии входа**: GP читал полный сырой PA, а жюри — **lossy lifted-ForkBrief** (проверено на PA-040: бриф выронил решающий факт «apps/worker уже гоняет BullMQ» и переврал воркер как «NEW»). Контрольная confound-проверка (GP на ТОМ ЖЕ брифе жюри) всё равно: (a) назвала PA-040 **clear call** против искусственного **split** жюри, и (b) поймала распределённый **must-not-ship** (in-process `sleep` как канон нарушает HIGH-confidence pinned NFR-004), который жюри оценило лишь «weak» и пропустило. **Ответ:** для сильной одиночной модели на well-posed форках механизм профилирования не купил пропорциональной РЕШЕНЧЕСКОЙ ценности; его ROI — **страховка** (гарантия surface-dissent + refuse-non-fork на переменном/слабом парке) + **аудируемость** (DEC-черновики/единый формат — воспроизводимо промптом 1 GP), при ~4–7× стоимости. Две actionable-находки P2: (1) узкое место — **lossy Brief-фаза**, не жюри (архитекторы должны видеть и сырой PA / лифт должен быть lossless); (2) **distributed-veto слепое пятно** — `consilium-synth` суммирует баллы без правила «единогласно weak ⇒ soft-veto/re-examine». Паттерн `patterns/blind-comparison-protocol.md` кодифицирован. Полный отчёт `dev/ORCHESTRATOR_P2_PROFILING_STUDY.md`.

### Lessons
1. **Поверхностный разрыв баллов — гипотеза, не вердикт.** Расследуй «механизм vs confound» прежде чем верить. Асимметрия входа (полный PA vs lifted-brief) заставила бы over-claim «GP бьёт жюри»; confound-проверка сузила до честной правды.
2. **Независимое фикс-линзовое scoring + детерминир. сумма жертвуют холистической меж-линзовой интеграцией** — могут сфабриковать «split» и пропустить распределённый must-not-ship, который ловит один холистический проход. Diversity панели ≠ integration.
3. Когда оценщик строил одно плечо — слепые судьи + adversarial steelman + пред-регистрация суть минимум доверия ([[blind-comparison-protocol]]).

---

## DEC-DEV-0131 — Генерируемый глоссарий `03-glossary.md` из SSOT (doc-UX Волна 1, PR#2 / E1)

**Date:** 2026-07-01
**Trigger:** doc-UX батч Волна 1 PR#2 (E1) — глоссарий как первоклассный **генерируемый** артефакт; закрывает P-8 (24 акронима рукописные в 00-concepts §8 + дублируются в overlay → дрейф-склонны).
**Tag:** #docs #guide #anti-drift #generator

### Context
Recognition-over-recall (принцип #4 батча) требует единого линкуемого глоссария 24 акронимов; рукописный `00-concepts §8` дрейфует (две копии: §8 + overlay). SSOT уже есть: канон-имена артефактов в H1 спеков (`docs/pmo/artifacts/*.md`), tier/lineage + сквозные термины в `ecosystem-map.overlay.json`.

### Decision
Новый Tier-2 генератор `dev/meta-improvement/scripts/gen-glossary.cjs` по паттерну `gen-command-catalog` (harvest → render markdown → `--check` EOL-compare **без date/sha-штампа** → детерминир.; + `--selftest` инварианты, fail-hard). SSOT: H1-имена артефактов (тот же харвест, что `gen-ecosystem-map`) + overlay `artifacts{}`/`artifactGroups[]`/`glossary[]`. Выход `docs/guide/03-glossary.md`: 24 артефакта сгруппированы по доменам (D1/bridge/D2B/D2UI/cross) с ID · название · ревью · «питает» + сквозные термины/вердикты. `00-concepts §8` ужат до указателя + 10-строчного cheat несущих. Wiring: `gen:glossary`(+`:check`/`:selftest`) в package.json, `gen:glossary:check` в `verify`; `guide/README` — строка в таблице + роутер «вспомнить артефакт» → 03-glossary + провенанс.

### Selftest инварианты
Ровно 24 спека; каждый `overlay.artifacts` id имеет H1-имя и наоборот (парити 24/24); каждый артефакт входит в какой-то `artifactGroup` (иначе выпал бы из глоссария); glossary-термины непусты и уникальны.

### Scope
**A3 (doc_type-frontmatter + check) сознательно НЕ включён** — нет потребителя (хаб рукописный per D-1, генератора индекса нет; reader-Diátaxis уже отдана в таблице хаба из PR#1; YAML-frontmatter рендерится на GitHub уродливой таблицей). Machinery без потребителя = преждевременно → поднять, когда появится (генератор индекса / тултипы карт). Волна 1 PR#2 из 3; далее PR#3 = общий шелл C3 (+ `glossary.json` тултипы там же).

### Outcome
`npm run verify` EXIT=0 (`gen:glossary:check` идемпотентен + smoke 17/17). Consumer-zone (`docs/`); аддитивно, без новых типов/правил → **counts 24/44**.

### Lessons
1. **Глоссарий из SSOT убивает дрейф двух копий** (§8 ↔ overlay): один источник (H1 + overlay) → генерируемый md, §8 → указатель + тонкий cheat.
2. **Генератор без volatile-штампа (date/sha) = `--check` это чистое EOL-сравнение** — проще, чем neutralize date/sha у карт; уместно, когда выход не несёт провенанс-штампа.
3. **Machinery без потребителя откладывай** (A3 doc_type-check): reader-ценность (Diátaxis-метки) отдаётся дёшево в таблице хаба, а frontmatter+check ждут своего потребителя.

---

## DEC-DEV-0133 — Общий шелл двух карт: вендоренный `map-shell.{js,css}` — навбар «переключить вид» + in-app UTF-8 doc-панель в ОБЕИХ картах (doc-UX Волна 1, PR#3a / C3)

> **Нумерация:** изначально записано как 0132; перенумеровано в 0133 из-за межсессионной коллизии — параллельная сессия застолбила 0132 за P2-профилинг-исследованием (PR #96) от той же базы `origin/main`. Уступил как позже-созданный PR ([[feedback_dec_dev_collision_check]]).

**Date:** 2026-07-01
**Trigger:** doc-UX батч Волна 1 PR#3 (C3) — две карты были двумя отдельными приложениями (P-6); doc-панель (C1, DEC-DEV-0128) жила ТОЛЬКО в карте процессов → `.md`-ссылки карты команд (command-source / SPEC / footer) всё ещё уводили в сырьё → «кракозябры» (недочинённый P-4).
**Tag:** #docs #guide #maps #shell #anti-mojibake #refactor

### Context
Recon показал: у двух карт нет общего chrome/легенды/deeplink — только плоские `<a>` друг на друга (P-6). Кракозябры (P-4) закрыты в processes (0128), но ecosystem-map остался с сырыми `.md`-ссылками. C3 «общий шелл» в полном объёме (навбар + `view=`/`focus=` cross-map deeplink + панель + тултипы глоссария) = L, трогает ОБА генерируемых шаблона. Наибольшая ценность и самодостаточность — у выноса doc-панели в шелл + подключения к обеим картам (чинит остаток P-4).

### Decision
**Cuttable-scope: режу C3 на 3a (этот) + 3b.** PR#3a = вендоренные `docs/guide/vendor/map-shell.{js,css}` (развилка D-3, опция «вынести», а не «скопировать в оба» = дубль-дрейф), которые инклюдят ОБА шаблона:
- **doc-панель мигрирует в шелл** (dedup): processes отдаёт свою инлайн-панель (CSS + разметку `#docModal` + `openDoc`/`renderMd`/`docRel`/делегацию) → шелл; в шаблоне остаются тонкие шимы (`docRel`/`openDoc` → `window.MapShell.*`), так что side-panel и headless-хук `__procmap.openDoc` работают без правок. ecosystem-map ПОЛУЧАЕТ панель → `.md`-ссылки (command-source/SPEC/footer) помечены `class="doclink"` → читаемый UTF-8 вместо кракозябр.
- **Навбар «⇄ переключить вид»** (команды ⇆ процессы) — шелл добавляет первым ребёнком в `<header>` **синхронно** (до раскладки cytoscape, иначе граф на ~30px выше); текущий вид подсвечен из `window.MAP_SHELL.view`.
- **Делегирование doclink — в CAPTURE-фазе**: бьёт `stopPropagation` на SPEC-ссылках внутри `<summary>` (их `onclick=stopPropagation` в bubble иначе не дал бы шеллу перехватить); `preventDefault`+`stopPropagation`+`openDoc`. Панель `position:fixed` (не `absolute`) — работает и в скролящемся документе карты команд, и в overflow:hidden флексе карты процессов.

Модалка injectится в `document.body` с ТЕМИ ЖЕ id (`#docModal/#docBody/#docClose`) → существующий procmap-смоук проходит без правок. CSS через `var(--x, fallback)` — наследует одинаковую тёмную палитру обеих карт, самодостаточен.

### Scope (что отложено в PR#3b)
Единый hash-deeplink `view=map|processes` + `focus=kind:id` (cross-map фокус узла) и тултипы акронимов из `glossary.json` (E1 доп. эмит) — самая сложная и наименее ценная часть; едет отдельным PR. A3 doc_type — по-прежнему без потребителя (см. 0131).

### Outcome
`npm run verify` EXIT=0. procmap.smoke 17→**20** (+3: шелл загружен · навбар линкует другую карту · подсвечивает текущий вид; doc-панель по-прежнему зелёная — теперь через шелл). Новый `mapshell.smoke.mjs` **7/7** (ecosystem-map: MapShell · навбар · клик footer-doclink → панель с целой кириллицей). **Визуально проверено в Chrome (puppeteer):** обе карты — навбар подсвечивает текущий вид, клик по `.md` открывает UTF-8-панель с целой кириллицей + markdown; 0 JS-ошибок, раскладка не поехала. Consumer-zone; аддитивно → **counts 24/44**.

### Lessons
1. **Общий шелл = single source для сквозного chrome** двух приложений: даже с разными движками (кастомный DOM ecosystem-map ↔ Cytoscape processes) выносимы навбар/deeplink-конвенция/doc-панель/клавиатура; движок-специфика остаётся в шаблоне. Дедуп через тонкие шимы (`__procmap.openDoc`/`docRel`) сохраняет старые контракты (смоук, side-panel) без правок.
2. **Capture-фаза бьёт `stopPropagation`**: doc-ссылка внутри `<summary>` с `onclick=stopPropagation` не перехватывается bubble-делегатом; document-listener в capture ловит её первым (и `preventDefault` заодно гасит toggle summary — чище прежнего).
3. **Синхронный инжект chrome, меняющего высоту header, — ДО измерения вьюпорта потребителем** (cytoscape мерит `#wrap`): иначе граф на высоту навбара выше и клипается. Скрипт шелла — перед app-IIFE, `init()` синхронно (не ждём DOMContentLoaded).
4. **Cuttable-scope спасает L-фичу**: 3a (панель-в-обе-карты + навбар, чинит остаток мохибейка, самоценно) отдельно от 3b (cross-map `focus=` deeplink + тултипы) → ранний фидбэк, обозримый ревью.

---

## DEC-DEV-0134 — Cross-map deep-link: общий `#focus=kind:id`, который чтят обе карты + навбар переносит фокус (doc-UX Волна 1, PR#3b / C3)

**Date:** 2026-07-01
**Trigger:** doc-UX батч Волна 1 PR#3b (продолжение C3). 3a унифицировал chrome (навбар + doc-панель), но переключение вида **теряло контекст** — нельзя было открыть узел одной карты из другой (P-6 остаток). Design §C3 acceptance: «из одной карты открыть `#focus=art:FM` и сфокусировать тот же узел в другой».
**Tag:** #docs #guide #maps #shell #deeplink

### Context
Две карты фокусируются по-разному (ecosystem-map: cross-highlight `hlState` + скролл к DOM-карточке; processes: Cytoscape select + side-panel). Нужна **общая конвенция**, не общий код фокуса. Общий узел обеих карт — артефакт (`art:FM` есть как карточка в карте команд И как node в карте процессов); команды — только в карте команд.

### Decision
Shared hash-param **`#focus=kind:id`** + **adapter-паттерн в шелле**: каждая карта регистрирует `MapShell.registerView({getFocus, applyFocus})`; на загрузке шелл читает `focus=` и зовёт `applyFocus` (движок-специфику владеет карта). Навбар «переключить вид» на клике читает `getFocus()` текущей карты и переносит его в URL другой (`href#focus=<token>`) → переключение сохраняет контекст. `art:*` фокусируется в обеих; `cmd:*` — только в карте команд (в процессах `applyFocus` грациозно no-op). `view=` НЕ реализован — файл и есть вид, навбар и есть переключатель (избыточно).

### Две ловушки (root cause + fix)
1. **expand-collapse удаляет детей свёрнутого компаунда из графа.** Артефакты живут в дорожке `lane:artifacts`, свёрнутой по дефолту → `cy.getElementById('art:FM')` пуст (found=false, поймано смоуком). Fix: `applyFocus` сперва разворачивает `lane:artifacts` + все `artgroup`, тогда узел резолвится.
2. **`fit` во время асинхронной ELK-раскладки → пустой холст.** `defaultView()` стартует async-layout; `applyFocus` фитил к FM ДО того, как раскладка дала узлу позицию → фит в никуда (панель открыта, граф пуст — поймано глазами, не смоуком). Fix: ждать `layoutstop` (флаг `__layoutRunning`), затем переразложить (`runLayout`) и **центрировать с zoom 1.1** (не `fit` к крошечному одиночному узлу).

### Scope (отложено)
**Тултипы акронимов из `glossary.json` НЕ включены** — low-ROI: обе карты уже показывают имя артефакта (карта команд — в карточке, карта процессов — в side-panel по клику), а `glossary.json` = ещё одна gen-машинерия + `--check` + проблема fetch на `file://`, чей единственный потребитель — тултипы, выводимые из уже-имеющихся in-map данных. Machinery без явного потребителя откладываю (мой же урок [[0131]]). Поднять, если появится спрос на hover-тултипы (там реальный gap — крошечные узлы `FM`/`RPM` в карте процессов).

### Outcome
`npm run verify` EXIT=0. Смоук: `mapshell.smoke.mjs` 7→**8** (+`#focus=art:FM` подсвечивает FM-карточку), `procmap.smoke.mjs` 20→**21** (+`#focus=art:FM` выделяет FM-node — обе стороны). **Визуально проверено в Chrome:** обе карты по `#focus=art:FM` фокусируют FM (карта команд — золотая рамка + скролл; карта процессов — синяя рамка + панель + центр), 0 JS-ошибок. Consumer-zone (`docs/`); аддитивно → **counts 24/44**.

### Lessons
1. **Adapter-паттерн (`registerView`) развязывает сквозную навигацию от внутренностей карты**: шелл владеет конвенцией (`focus=` + перенос через навбар), карта — реализацией (`applyFocus`/`getFocus`). Добавить третью карту = зарегистрировать адаптер, шелл не трогать.
2. **expand-collapse: свёрнутый компаунд УДАЛЯЕТ потомков из графа** — `getElementById`/`filter` их не видят, пока не развернёшь родителя. (Тот же корень у пред-существующего лимита поиска по свёрнутым артефактам.)
3. **Никогда не `fit`/`center` во время асинхронной раскладки** — узел ещё без позиции → пустой холст. Гейти на `layoutstop`/`__layoutRunning`, потом фокусируй. Смоук на `.sel`-класс это не ловит (класс ставится синхронно) — поймали глаза; **визуальная сверка обязательна для раскладочных фич**.
4. **Cuttable-scope снова**: отложил `glossary.json`-тултипы (машинерия без потребителя) — доставил тестируемое ядро (cross-map фокус), софт-полиш ждёт спроса.

---

## DEC-DEV-0135 — P2 consilium: два изъяна механизма из профилинг-исследования починены — сырой источник архитекторам (Слой 2) + soft-veto/интеграционный проход (Слой 3)

> **Нумерация:** изначально записано как 0134; перенумеровано в 0135 из-за межсессионной коллизии — параллельная doc-UX-сессия застолбила 0134 за cross-map deep-link (PR #98) на своей ветке от той же базы. Проверял по хвосту `origin/main` + заголовкам PR (номер #98 в заголовке не нёс, запись жила на его ветке) вместо скана веток открытых PR + статус-памяти → повторение [[feedback_dec_dev_collision_check]]; позже-созданный PR (#99) уступает. Урок усилен: номер брать из `git fetch` + `git show origin/<pr-branch>:DEV_JOURNAL.md`, не из сводки.

**Date:** 2026-07-01
**Trigger:** P2 профилинг-исследование (DEC-DEV-0132, PR #96) — слепой A/B «жюри ×3 vs 1 general-purpose» + confound-проба вскрыли два слепых пятна механизма P2. Владелец ратифицировал починку обоих.
**Tag:** #orchestrator #p2 #consilium #decision-support #blind-spot #fix

### Context
Исследование дало честный ответ (ROI жюри = страховка/аудируемость, а не прирост качества решения на сильной модели), НО по пути вскрыло два конкретных, дешёвых в починке изъяна — и владелец задал прямой вопрос: «изъян всегда срабатывает в механизме или это про дизайн теста?». Разбор развёл три слоя:
- **Слой 1 — изъян МОЕГО ТЕСТА** (асимметрия входа A/B: GP видел полный PA, жюри — lossy бриф). Про эксперимент, не про механизм; чинится равным входом (валидация, не код).
- **Слой 2 — реальное свойство P2:** жюри НИКОГДА не видит сырой PA, только lifted-бриф. На PA-040 верифицировано: brief-lift выронил факт «apps/worker уже гоняет BullMQ (FM-001/FM-005)» и обозвал worker «NEW» → ВСЕ 3 архитектора унаследовали потерю. «Всегда срабатывает», но чинибельно.
- **Слой 3 — глубинное свойство:** независимое фикс-линзовое scoring + детерминированная СУММА жертвуют холистической меж-линзовой интеграцией. Confound-проба (GP на брифе жюри) поймала must-not-ship, который жюри пропустило: (b) нарушала NFR-004, но ни одна линза не выставила veto — каждая нашла её «weak», а сумма «weak+weak+strong-по-velocity» = split. Механизм МОЖЕТ сфабриковать «split» и пропустить распределённый must-not-ship.

### Options considered
**Fix A (Слой 2) — как дать панели ground-truth:**
1. Архитекторы читают сырой PA рядом с брифом — просто, наибольший рычаг (рекомендация исследования). **← выбрано.**
2. Lossless-by-contract лифт (бриф обязан перенести каждый несущий факт) — сложнее гарантировать.
3. Чек «бриф выронил факт?» — доп. агент без устранения причины.

**Fix синтеза (Слой 3) — детерминированное правило vs холистический проход:**
- Только soft-veto (детерминированно): ловит «единогласно-weak», НО НЕ ловит PA-040-кейс (там velocity дала (b) высокий балл → не единогласно-weak; распределённый veto через нарушение NFR правило по баллам увидеть не может).
- Только интеграционный проход (агент): ловит распределённый must-not-ship, но недетерминирован и рискует переопределять выбор.
- **Оба (выбрано):** закрывают РАЗНЫЕ половины. soft-veto — детерминированная для машинно-проверяемой половины (weak везде); интеграционный проход — холистическая surfacing-only для того, что код увидеть не может (факт одной линзы бьёт балл другой).

### Decision
**Fix A:** новое опц. поле `source_excerpt` в `FORK_BRIEF_SCHEMA` (Brief-агент захватывает дословный PA-блок + цитируемые constraint-строки); `archPrompt` показывает его как GROUND TRUTH — при расхождении факта источник ПОБЕЖДАЕТ бриф (опции по-прежнему только перечисленные форком — источник не лицензия выдумывать).

**Fix синтеза, детерминированная часть** (`consilium-synth.cjs`): `SOFT_VETO_THRESHOLD=3`; опция, которую НИ ОДНА линза не оценила ≥3, помечается `soft_vetoed` (в матрице `max`+`soft_vetoed`); soft-vetoed **выживший НЕ удаляется** (удаляет только hard-veto), но если soft-vetoed — само рекомендованное, `strong` **демоутится в split** (единогласие по наименее-плохому ≠ rubber-stamp). Hard-veto субсумирует soft (список `soft_vetoed` — только выжившие).

**Fix синтеза, холистическая часть** (`.mjs`, Layer-2.5): пост-панельный `integration`-агент читает ВЕСЬ форк после жюри, adversarially, и ищет 3 провала, невидимых сумме (распределённый must-not-ship; факт одной линзы бьёт балл другой; мис-калибровка strength). **Surfacing-only:** не re-scores, НЕ меняет детерминированный выбор (тот остаётся CODE) — только поднимает disclosure. Флаг едет в disclosures + пакет доставки в PA + return-конверт.

### Outcome
`npm run verify` EXIT=0. `consilium-synth` 15→20 (soft-veto: flag-not-remove, strong→split демоут, hard-subsumes-soft, summarize+threshold), `decide-architecture-foundation-wiring` 9→12 (сырой источник + «source WINS»; soft-veto threading + disclosure; интеграционный проход surfacing-only после панели), harness-smoke 7/7 зелёный. Consumer-zone; аддитивно (`source_excerpt`/`soft_vetoed`/`integration` — опц. поля, absent == прежнее поведение) → **counts 24/44**. Жюри сохранено — доклеены сырой-вход + интеграция, слепые пятна (сфабрикованный split, пропущенный распределённый veto, lossy-cap) закрыты. Работа в отдельном worktree off `origin/main` (параллельная сессия держала общий checkout). Слой 1 (чистый ре-ран A/B) — предложен владельцу отдельным опц. шагом (валидация, не фикс). Study: `dev/ORCHESTRATOR_P2_PROFILING_STUDY.md`; методология: [[feedback_blind_comparison]].

### Lessons
1. **Жюри закапано брифом, которым его кормят.** Если панель видит только дистиллят, lossy-дистилляция кэпит ВСЮ панель одинаково (общий вход = общая слепая зона, а не независимые ошибки). Давай панели сырой источник как ground-truth; дистиллят — удобный индекс, не замена источнику.
2. **Независимое фикс-линзовое scoring + детерминированная СУММА жертвуют холистической меж-линзовой интеграцией.** Гарантия «каждая линза услышана» имеет флип-сайд: никто не замечает, что распределённая слабость суммируется в veto, или что факт одной линзы обнуляет балл другой. Восстанавливай двумя комплементарными механизмами — детерминированное правило для машинно-проверяемой половины (единогласная слабость) + холистический проход для того, что код увидеть не может. Холистический проход держи **surfacing-only**, иначе теряется no-drift-гарантия детерминированного гейта.
3. **Непредвзятый A/B окупается не вердиктом, а фиксами.** Слепое сравнение + confound-investigation не просто ответили «стоит ли жюри» — они выдали два конкретных дешёвых улучшения механизма. Ценность аудита — в конкретике находок, не в счёте.

---

## DEC-DEV-0138 — Guided Research Wave 1: intake+metrics+anti-hype скиллы + тонкая `/ecosystem:research` (lightweight, pre-artifact)

**Date:** 2026-07-01
**Trigger:** Запрос владельца — обширно расширить поиск/сбор/обработку информации (harness + экосистема) с со-формированием точного запроса + метриками полезности + скепсисом/анти-хайпом. Blueprint (`dev/RESEARCH_CAPABILITY_BLUEPRINT.md`, PR #102) + Wave 0.5 bake-off доставлены; владелец: «иди по дефолтам, строй лёгкий скилл».
**Tag:** #architecture #tooling #research #ux

### Context
Retrieval/триангуляция/анти-хайп уже жили в трёх силосах (integrator `research-protocol`, product `market-research-protocol-quick`, harness `deep-research`), но НИКТО не со-формировал точный бриф до поиска и не скорил decision-usefulness (только credibility), гейтя синтез. Blueprint развёл: net-new = Pillar A (co-form) + Pillar B (usefulness-metrics contract); Pillars C (loop) + D (anti-hype) — обёртка над существующим (`orchestrate, don't duplicate`).

### Options considered
1. Формальный PMO-артефакт-тип (Research Brief) сразу — тяжело: схема + validation + count-sweep 24→25. Отвергнут для Wave 1 (преждевременно, CLAUDE.md §4 cuttable-scope).
2. **Лёгкий markdown-скилл сейчас, формальный артефакт отложен за триггером reuse≥N + form-drift (Wave 3). ← выбрано** (дефолт владельца «слоями»).
3. Расширить `/integrator:research` vs новый тонкий `/ecosystem:research`. Выбран новый тонкий (§7.1 #2) — общий ресёрч ≠ tool-research; делегирует в существующие loop'ы.
Дом скилла: `skills/ecosystem/` (cross-cutting) над product/integrator (§7.1 #1). Опц. warn-хук отложен («defer if noise»).

### Decision
2 скилла + 1 команда (consumer-zone), без нового типа артефакта / правила валидации (counts остаются 24/44):
- `skills/ecosystem/research-intake.md` — Pillar A (co-form + Research Brief шаблон) + Pillar B (Relevance⟂Utility, Tier-1 hard gates, Tier-2 weighted, вердикт PASS/PARTIAL/SHORTFALL + subscores + Metrics Contract шаблон).
- `skills/ecosystem/anti-hype-filter.md` — Pillar D (atomize→SIFT→provenance→H1-H8→triangulate→faithfulness→keep/DEMOTE/drop + audit-trail).
- `commands/ecosystem/research.md` — тонкий `/ecosystem:research` (A→B→C reuse deep-research/market-research/research-protocol + MCP + WebSearch/WebFetch fallback →D→scored synthesis + approve-gate + cache).
Скиллы self-contained (без `dev/`-ссылок — dev/ не ставится потребителю). Wave-2 answer-engine (Perplexity Sonar, provisional по Wave 0.5) НЕ подключён — команда помечает как future. `verify.md` Step 4 + summary: ecosystem-команды 6→7 (+research).

### Outcome
check-counts ✓ 24/44 (аддитивно, без новых типов/правил); hook-smoke 28/0. Полный `npm run verify` в worktree не прогнан (нет node_modules + puppeteer-смоуки smoke:procmap/mapshell); изменение — только markdown/доки, не трогает проверяемые подсистемы (hooks/adapters/orchestrator/generators) → полный verify на CI / после merge. Pre-decision blueprint DEC-DEV-развилка (§7.1 #8) закрыта этим build-решением. Формальный артефакт остаётся отложен до Wave 3. Работа в изолированном worktree off ветки `docs/research-capability-blueprint` (параллельные сессии держат общий checkout). Нумерация: 0134/0136/0137 заняты параллельными ветками (guide-map-deeplink / vision-wave-b-kickoff+main / guide-doc-type) → взят первый свободный **0138** по скану всех remote-веток; ⚠ финальный fetch упал по 443 (сеть транзиторно недоступна) → снимок слегка устаревший, backstop = renumber-at-merge [[feedback_dec_dev_collision_check]].

### Lessons
1. Value-add ресёрч-капабилити над внешним стеком — это **интейк-контракт + гейт полезности**, не retrieval; C/D — тонкие обёртки (`orchestrate, don't duplicate`).
2. Скептичный фильтр, который проектируешь, надо доказывать догфудом: Wave 0.5 tool-selection сам прогнан через Pillars B/D (убил vendor-самобенчи, tier-conflation «91%» = deep-mode $50/1k) → честный вердикт «частично» до keyed bake-off. [[feedback_blind_comparison]]

---

## DEC-DEV-0136 — Wave B kickoff: полная волна completeness-loop — owner-развилки зафиксированы + work-order

**Date:** 2026-07-01
**Trigger:** горизонт 1 пройден (P2 dogfood + profiling study 0132, оркестратор-цепочка P1–P7+§6 построена); владелец дал старт волне 2 (Autonomous Pipeline Vision, полная волна Epic B) с директивой «по развилкам — рекомендация; развилка б — подтверждена».
**Tag:** #vision #epic-b #kickoff #completeness-loop #methodology

### Context
Vision-порядок `(A ∥ F1) → B → (C ∥ D) → F2 → E`. Фронт пайплайна первым — ошибки спеки D1-D2B компаундируются вниз (METR). Уже готово: **Epic A** (3 персоны + zone-router, live-validated 0115), **B1-core** (`completeness-oracle.cjs` + `/product:complete` + `completeness-loop.md` skeleton, 0098), **B4 loop-readiness audit** (`dev/LOOP_READINESS_AUDIT.md` `complete`, 0098). Волна B = докрутка `v1 core/skeleton` → рабочий откалиброванный loop, НЕ стройка с нуля.

### Options considered (owner-развилки)
1. **Durable engine** — (a) in-harness Workflow `pipeline()` / (b) n8n/cron cross-session. B = session-scope (границы фаз ≠ cross-session); n8n избыточен до реальной потребности (vision §10).
2. **Auto-fix широта** — (a) conservative surface+escalate, калибровать real-resolve на пилоте / (b) сразу расширенный авто-resolve. Rail 4 (decisions escalate) + Huang-self-grading-риск → живые данные, не догадка.
3. **F1** — (a) параллельно с B / (b) отложить. F1 (autonomy L0/L1) не блокирует B (loop в дефолт L1); wiring требует сверки gate-контракта с оркестратор-треком.
4. **B4-audit** — строить первым? Факт-чек: уже `complete`.

### Decision
Развилки зафиксированы: **б=in-harness Workflow**, **в=conservative→pilot-calibrated**, **а=B сразу, F1 отложен**, **г снята (B4 complete)**. Kickoff Section 1-5 пройден inline (substrate = независимый cold-read Epic B через Explore-субагента — частичный bias-resist эквивалент fresh-session). Work-order `dev/ECOSYSTEM_VISION_BATCH_2.md` (`ready-to-run`) с sub-phases: **B-a** loop-надёжность (fix FB-LR-28 path-anchoring + FB-LR-29 PA_CANON + findings persistence) → **B-b** durable wave-runner (Workflow) → **B-c** close-out B5/B6/B8 → **B-d** real-resolve пилот-калибровка. Committed = B-a→B-b; B-c/B-d stretch/pilot-gated. FB-LR-31/32 (0132) — design-входы в SURFACE (персоны видят сырьё, не lossy brief; distributed-veto).

### Outcome
Kickoff-артефакты: work-order BATCH_2 + эта запись + ROADMAP Vision-секция (волна B in-progress). FB-LR-30/31/32 занесены в live-run ledger (отдельный коммит #96). Epic D / F2 / C — вне батча (граф `(C ∥ D)` после B). Merge P2-хвоста (#94/#96) — предпосылка, за владельцем. Next-free DEC-DEV = **0137** (verify `git fetch` перед присвоением — параллельные сессии).

### Lessons
1. **Факт-чек kickoff-премис перебивает неуверенность разведки.** Explore пометил B4 «статус неясен / partial» — прямой Read показал `complete`. Допущение «B4 первой задачей» скорректировано ДО старта стройки, а не в середине (phase-kickoff Section 1 anti-bias; ROADMAP-гипотеза-не-контракт). [[feedback_substrate_premise_verification]]
2. **`core/skeleton` ≠ недострой.** Conservative RESOLVE — сознательный дефолт: real-resolve ждёт живых пилот-данных (rail 4), а не догадки о том, что «безопасно авто-фиксить». Калибровка ширины — B-d, не B-a.

---

## DEC-DEV-0137 — Diátaxis `doc_type` для `docs/guide/*.md` + анти-дрейф-чек против ручной таблицы хаба (doc-UX Волна 1, A3)

**Date:** 2026-07-01
**Trigger:** закрытие последнего невыполненного критерия приёмки Волны 1 (§8 `dev/DOCS_UX_BATCH_DESIGN.md`: «каждая `guide/*.md` имеет `doc_type`»); ранее A3 отложен (PR#2/0131) под предлогом «нет потребителя».
**Tag:** #doc-ux #diataxis #anti-drift #wave1

**Что сделано.** Каждая из 8 `docs/guide/*.md` получила YAML-фронтматтер `doc_type` (Diátaxis-роль): 6 рукописных — прямыми правками (00-concepts=explanation, 01-first-session=tutorial, 04-ui-design/05-implementation=how-to, 06-gates=explanation +`doc_type_secondary: how-to`, README=navigation); 2 генерируемых (02-commands, 03-glossary=reference) — через **генераторы** (`gen-command-catalog.cjs`/`gen-glossary.cjs` эмитят фронтматтер, файлы регенерированы, их `--check` зелёные — не правим сгенерированное руками). Новый `dev/meta-improvement/scripts/check-guide-doctype.cjs` (скрипт `check:doctype`, вплетён в `npm run verify`): валидирует enum {tutorial, how-to, reference, explanation, navigation}, **сверяет ручную таблицу ролей в `README.md` («Что здесь — файлы и их роль») с фронтматтером** (множество меток строки ⇔ doc_type+secondary файла) и anti-orphan в обе стороны. `renderMd` в `vendor/map-shell.js` научен срезать ведущий фронтматтер И HTML-комменты — заодно почищен существующий шум (02/03 показывали сырой `<!-- GENERATED -->` в панели). `npm run verify` EXIT=0, counts без изменений (24/44).

**Почему так (tradeoffs).**
1. **Потребитель — это суть, а не формальность (ответ на отсрочку 0131).** A3 откладывался «нет читателя фронтматтера». Читатель нашёлся: хаб (0130) уже держит **рукописную** Diátaxis-колонку — она дрейф-склонна. Чек, сверяющий таблицу с фронтматтером, превращает метку из линта-без-читателя в анти-дрейф-контракт (роль доки объявлена в её фронтматтере, таблица хаба не может разойтись). Это и снимает прежнее возражение.
2. **YAML-фронтматтер, не HTML-комментарий-маркер.** Фронтматтер — стандарт, дизайн-специфицирован (§4 A3), и виден читателю (recognition — «у доки видна роль»). GitHub-рендер как маленькая таблица сверху — приемлемо/даже полезно; в in-app панели он **срезается** (иначе YAML был бы шумом).
3. **`navigation` — расширение Diátaxis (4 квадранта) для хаба-индекса.** README — контейнер, не квадрант; enum расширен документированно, а не втиснут в reference.
4. **Доминирующий тип + вторичный тег (D-5).** `doc_type` (скаляр) + опц. `doc_type_secondary` (06-gates = explanation·how-to) — множество, сверяемое с «·»-меткой таблицы.
5. **Генерируемым докам роль объявляет генератор.** Чтобы не править сгенерированный файл руками, фронтматтер 02/03 эмитят сами генераторы — SSOT-совместимо.

**Lesson.** «Machinery without a consumer» (0131) — не запрет на инфраструктуру, а требование назвать читателя. Иногда читатель уже существует рядом в рукописном, дрейф-склонном виде (таблица хаба); тогда правильный ход — не строить новый рендер, а **пришить проверку существующего ручного артефакта к новому машинному источнику**. Отсрочка была верной по форме (нет читателя → жди), но читатель появился с 0130 — ре-оценка отсрочки при смене контекста обязательна.

---

## DEC-DEV-0140 — Wave B / B-a: completeness-loop закалён для worktree/parallel-безопасности (FB-LR-28/29 + persistence)

**Date:** 2026-07-01
**Trigger:** старт стройки полной волны Epic B (work-order `dev/ECOSYSTEM_VISION_BATCH_2.md`, задача B-a). Дефекты FB-LR-28/29 всплыли на live-run completeness-loop (V-2 re-run `a2aaf44a`); без них полная волна ненадёжна в worktree/параллельном контексте.
**Tag:** #bug-fix #vision-epic-b #wave-b #worktree-safety

### Context
`skills/product/completeness-loop.md` — v1 `core/skeleton`: волна SCORE→SURFACE→CLASSIFY→RESOLVE→ESCALATE→RE-SCORE описана прозой, harness-driven. B1-core прошёл live-validation (0115), но грейд V-2 re-run зафиксировал два latent-дефекта надёжности (обе 🔵 LOW, self-healed в тот раз, но latent) + недовшитый persistence-контракт. B-a закрывает их **до** достройки runner (B-b), иначе детерминированная волна компаундирует ненадёжность (degrade-gracefully порядок work-order).

### Root causes
1. **FB-LR-28 (path-anchoring).** SURFACE-бриф строил пути персон без якоря к resolved-root прогона → микс worktree-absolute + main-checkout-absolute (в V-2: qa-advisor получил worktree-корректный путь, architect+ux — main-checkout; спаслись Glob только потому, что файл оказался not-found). Latent-риск: materially-edited+present файл по неверному checkout → тихое stale-чтение (нет not-found → нет self-heal).
2. **FB-LR-29 (worktree-local PA).** ESCALATE писал worktree-local `pending-actions.md` без PA_CANON-резолюции — 0113-guard осел только в orchestrator P4/P5/P6, product-gate ESCALATE был отдельным PA-writer, которого guard не покрыл. Latent PA-id divergence при параллельном orchestrator-ране.
3. **Persistence — контракт без действия.** Keyed-write findings (`.advisor-findings/<persona>-<id>.md`) жил только в секции Idempotency как описание, не как явный шаг SURFACE.

### Decision
Три правки в скилле (prose-only, без кода):
1. SURFACE резолвит feature-root ОДИН раз, строит все брифы персон от него; тихое stale-чтение помечено как correctness-rail, не косметика.
2. ESCALATE портирует PA_CANON дословно из orchestrator (`git worktree list --porcelain` → FIRST worktree = main checkout → его `.claude/pending-actions.md`; allocate next PA-NNN; не `git add`/commit). Open-question FB-LR-29 закрыт: product-gate PA **шарят** canonical ledger (не worktree-local by design).
3. Keyed-write findings стал явным действием SURFACE; секция Idempotency ужата до ссылки на него (single-source, без дубль-дрейфа).

### Outcome
`npm run verify` зелёный (скилл — проза; код/оракул/хуки не тронуты; counts 24/44 без изменений). Consumer-zone (`skills/`) → CHANGELOG `[Unreleased] ### Fixed`. Смоук в worktree-контексте пилота (повтор условий `a2aaf44a` без FB-LR-28/29) — на пилот-леге B-d.

### Lessons
1. **Cross-cutting guard не самораспространяется.** PA_CANON (0113) чинил orchestrator PA-writers, но product completeness-loop — отдельный PA-writer той же worktree-опасности. При добавлении cross-cutting guard'а надо явно просканировать ВСЕ writer'ы того же класса (тут — все, кто пишет `pending-actions.md`), а не только тот, где симптом всплыл первым. [[env_parallel_sessions_share_checkout]]
2. **Latent ≠ ignorable перед достройкой.** Оба дефекта self-healed в V-2 (benign), но B-a закрывает их ДО runner (B-b): в детерминированной волне latent-путь-дрейф компаундирует. Порядок work-order (надёжность → runner → close-out → калибровка) — не бюрократия, а degrade-gracefully.
3. **Prose-контракт без явного шага дрейфует к неисполнению.** Persistence findings был «описан» (раздел-инвариант), но не «предписан» (шаг волны) — в harness-driven скилле действие должно жить в шаге, иначе исполнитель волен его пропустить.

---

## DEC-DEV-0139 — Единая легенда «Оси именования» в глоссарии + фикс дрейфнувшей расшифровки `P1–P5` (doc-UX Волна 2, E2)

**Date:** 2026-07-01
**Trigger:** старт Волны 2 doc-UX батча с E2 (`dev/DOCS_UX_BATCH_DESIGN.md` §4 E2): экосистема перегружает метки `D…`/`P…` (принципы vs процессы vs домены vs шаги) → читатель конфлатит оси. Нужна одна легенда соответствий + проход по докам на консистентность.

**Tag:** #doc-ux #glossary #naming #anti-drift #wave2

**Что сделано.** Новая секция **«Оси именования»** (15 строк: `Ось · Что нумерует · Значения · Не путать с`) в генерируемом `03-glossary.md` — editorial-данные в `overlay.namingAxes[]`, эмит первым разделом в `gen-glossary.cjs` («карта карт» перед детальными таблицами артефактов) + selftest-инварианты (непустые `axis`/`what`/`values`, уникальность оси). Разводит худшие перегрузки, подтверждённые аудитом: `P#` (принципы P1–P7 / Product P1–P5 / Orchestrator P1–P7, суффиксы `p`/`o` в картах); семейство `D` (`D1–D6` домены / `D.1–D.6` шаги Design / `D1.1–D1.9` шаги Discovery / `D2-B01…` обязанности); тройной «tier» (review / validation_tier / product_tier); тройной `MVP`; двойной `L0/L1` (лестница понимания vs зум App Map). Заодно **починена дрейфнувшая строка глоссария** `["P1–P5", …]`: была «Discovery, Planning, Feature, Handoff, Maintenance» (Handoff/Maintenance — не P-процессы), стала SSOT-верной «P1 Init(Discovery+Planning) · P2 Feature · P3 Feedback(stub) · P4 Cascade · P5 Periodic» + переименована в `P1–P5 (Product)` (параллельно `P3–P6 (orch.)`). Т.к. карта команд **встраивает** `glossary[]`, `ecosystem-map.html` перегенерирована; `namingAxes` добавлен в allow-list `OVERLAY_TOP_KEYS` второго генератора (overlay общий). `npm run verify` EXIT=0, counts 24/44.

**Метод (ground-truth, не догадки).** Инвентаризацию осей делал вынесенный read-only аудит-субагент (~20 осей + отчёт по коллизиям с `file:line`); user-facing фикс `P1–P5` дополнительно верифицировал напрямую по `docs/pmo/processes.md` (§3.1–3.6) перед правкой — субагенту на изменяющих правках не доверяю на слово.

**Surfaced-but-deferred (аудит нашёл, в E2 НЕ чинил — вынесено).**
1. **Диапазон Orchestrator `P1–P7` (SSOT SPEC) vs `P3–P6` (весь гайд/overlay).** `P7` runtime-smoke живёт как *шаг* внутри P6o, не отдельный процесс в гайде. Задокументировано в строке таблицы («оператор видит `P3o–P6o` (+P7-leg)»), но не переписывал гайд — это док-широкая правка.
2. **Кодировка node-id `P4`/`P5` без суффикса в `process-graph.overlay.json` vs `P4p`/`P5p` в `ecosystem-map.overlay.json`** — коллизия с orchestrator `P4o`/`P5o` в том же файле. Внутренняя деталь карт, требует регена карты процессов + смоук → отдельная единица.
3. **Membership-дрейф уровней ревью:** `00-concepts §5`/`06-gates` опускают `NFR`=🟠 и `AM`=🟢, а глоссарий/overlay их включают. Тривиально, но трогает 2 дока прозой → отдельный consistency-fix.

**Lessons.**
1. **Общий overlay = два потребителя.** `ecosystem-map.overlay.json` читают И `gen-ecosystem-map` (карта), И `gen-glossary` (словарь). Новый top-level ключ требует (а) добавления в allow-list `OVERLAY_TOP_KEYS` карты-генератора, (б) регена всего, что **встраивает** изменённые данные: правка одной строки `glossary[]` устарела `ecosystem-map.html` (карта embed'ит `glossary`), хотя сам ключ `namingAxes` в карту не инжектится. Проверяй граф «кто читает этот overlay-ключ» перед правкой.
2. **Оси именования — это не украшение, а долг ясности.** ~20 осей с перегрузкой `P#`/`D#`/«tier»/`MVP`/`L#` копились органически; каждая по отдельности логична, вместе — recall-ад. Одна таблица «не путать с» дешевле, чем переименовывать оси (ломать SSOT). Recognition > recall.
3. **Editorial-в-overlay, эмит из генератора** — тот же анти-дрейф-контур, что `glossary[]`: контент редактируемый, но выводится детерминированно в `--check`; руками сгенерированный `.md` не трогаем.

---

## DEC-DEV-0141 — Guided Research Wave 2 CLOSED: free-bakeoff n=24 — B1-дисциплина систематически бьёт naive-поиск; keyed bake-off отложен за Wave-2-tooling

**Date:** 2026-07-03
**Trigger:** закрытие единственного реально оборванного фронта батча сессий 2026-06-28..07-01 (план `dev/CONSOLIDATED_EXECUTION_PLAN.md`, этап **E1**). Wave 2 free-bakeoff был прерван session-limit'ом на батче-C 2026-07-01; данные спасены в `dev/research-cache/wave2-free-bakeoff/` (E0), но досчёт+агрегация+нота+PR не сделаны.
**Tag:** #research #dogfood #methodology

### Context
Wave 2 keyed bake-off неисполним as-designed: ключей answer-engine'ов (Perplexity/Tavily/Exa/Linkup) в окружении нет. Исполнимая версия — **честная проекция на free-инфру**: слепой парный bake-off **B0 (naive-free: WebSearch→fetch→однопроход)** vs **B1 (disciplined-free: те же free-тулы + Pillar-D anti-hype + Pillar-B usefulness-gate)** на замороженном сете 24 запроса (sha256 `beabbbd6…`, 6 бакетов×4). Изолирует ценность **методологии**, не движка. Из-за трёх session-limit'ов сет прошёл тремя батчами (пилот 7 ok / батч-B 8 ok / батч-C 9 ok = 24, все ok, без пересечений). Батч-C (`wmafk1q15`, run `wf_ff6ec361-c3b`) досчитан 2026-07-03 в свежей сессии по спасённому пинованному скрипту; `TODAY` заморожен `'2026-07-01'` во всех батчах ради консистентности сета. Судья — opus-4-8 (та же модель писала оба плеча), order-swap ×2, agreement-gated, faithfulness проверяется живым WebFetch источника.

### Decision
Досчёт батча-C на замороженном сете + детерминированная ре-агрегация n=24 (скрипт `aggregate.py`, воспроизводимый) + честный разбор конфаундов + вердикт + рекомендация по owner-развилке §5.1. **Keyed bake-off (~$50, 7×🚧 requires_user) — НЕ покупать сейчас:** он отвечает на вопрос *выбора движка*, а вопрос *методологии* закрыт здесь бесплатно и положительно; вернуться к keyed только при реальном подключении answer-engine (трек Wave 2-tooling). Wave 3 (формальный RB-артефакт) — без изменений, по триггеру reuse≥5 И form-drift.

### Outcome
**n=24: B1 выигрывает-или-ведёт 21/24 (87.5%); b1_pct_of_decided = 94.4%** (17 чистых побед B1 / 1 B0 / 2 tie / **0 UNSTABLE**). Means overall B0 **3.913** → B1 **4.719** (Δ **+0.806**); устойчиво к выбросу Q21 (без него 4.04→4.71). Отрыв ложится на grounding-метрики: **P3 Faithfulness +1.42** (наибольший) > **P4 Citation-support +1.15** > **P2 Decision-Utility +0.96** ≈ **P5 Corroboration +0.96** >> P1 +0.21 / P6 +0.15. Swap-agreement **83.3%**, ноль разворотов направления (позиц. bias не переворачивает вердикт). **Конфаунды:** (a) длина — реальный, не устранённый (B1 длиннее 22/24, все 18 решённых выиграл более длинный, контр-примеров «B1 короче но выиграл» — 0); смягчён тем, что отрыв — на grounding-осях, не на P6-Directness, а в 2 строках где длиннее был B0, B1 не выиграл; (b) **цитатный — опровергнут**: B1 цитирует даже меньше (overall 3.63 vs 3.71; батч-C 3.67 vs 4.22, выиграв все). Сигнал реплицирован в 3 независимых батчах. Нота: `dev/RESEARCH_CAPABILITY_WAVE2_BAKEOFF.md`; провенанс — raw-конверты + `aggregate.py` + queryset + checkpoint. Единственная чистая победа B0 — Q13 (B4-nfr: правильный ответ = честное «официальных цифр нет», где оверхед верификации не окупается) — верхняя граница пользы дисциплины.

### Lessons
1. **Батчуй тяжёлые agent-fan-out прогоны с чекпоинт-файлами до запуска.** Три session-limit'а подряд убили залпы; критично — **session-limit убивает ВСЁ после себя в той же сессии** (первая попытка батча-C умерла мгновенно от уже-исчерпанного лимита, не от своего размера). Дробление на батчи + запись сырья на диск после каждого сделали досчёт из спасённых данных дешёвым (один прогон), а не «начать заново». Свежую/низко-загруженную сессию под тяжёлый батч.
2. **Методологический вопрос можно закрыть free-проекцией ДО покупки тулов.** Интейк- и анти-хайп-дисциплина даёт измеримый подъём качества ресёрча **независимо от retrieval-качества** — на одной и той же бесплатной подложке. Не надо тратить $50 на keyed-прогон, чтобы узнать «стоит ли вообще применять дисциплину»: это отделимый и дешевле-проверяемый вопрос, чем «какой движок купить». Разделяй «работает ли метод» (дёшево, free) от «какой инструмент» (дорого, keyed) — и закрывай первый первым.
3. **Within-row знак-тест > cross-row средних при шумной ковариате.** Судья репортил длину непоследовательно (символы/слова вперемешку, разброс 4…3050), поэтому mean-длина бессмысленна как абсолют — но внутри-строчный порядок «какое плечо длиннее» и «выиграл ли более длинный» надёжен (один судья, один вызов, одна единица). Честный конфаунд-разбор опёрся на него, а не на испорченный средний.

---

## DEC-DEV-0142 — Wave B / B-b: durable wave-runner completeness-loop — новый top-level `product/processes/` + детерминированный `gap-classifier.cjs` (classify + stop-вердикт)

**Date:** 2026-07-03
**Trigger:** этап **E2** сводного плана (`dev/CONSOLIDATED_EXECUTION_PLAN.md` §4.1) / sub-phase **B-b** work-order Wave B (DEC-DEV-0136). Волна completeness-loop (skill 0098, закалённый B-a/0140) исполнялась как harness-driven проза — обернуть в исполняемый, детерминированно оркеструемый Workflow-скрипт.
**Tag:** #architecture #product #vision-epic-b

### Context
Skill `completeness-loop.md` — поведенческий контракт (5 hard rails), но его исполнение прозой не даёт ни bounded-гарантий кодом, ни воспроизводимой оркестрации персон. Harness-констрейнт Workflow-скриптов (no fs / no require / no Date) не позволяет заимпортить классификатор напрямую — прецедент решения тот же, что у orchestrator-процессов: детерминированная dual-use `.cjs`-либа + агент-транспорт через `node`.

### Options considered
1. **Размещение runner:** (a) новый top-level `product/processes/complete-feature.mjs`, зеркально `orchestrator/` — **выбрано**: чистый zoning (Epic B = Product-owned), граница work-order 0136 «orchestrator/ не трогать» не нарушена; цена — деплой-wiring `update.md` по прецеденту DEC-DEV-0078 (bootstrap подхватывает bulk-copy автоматически). (b) положить в `orchestrator/processes/` — деплой бесплатен, но ломает зонирование. Отвергнуто.
2. **CLASSIFY + стоп-вердикт:** (i) inline-JS в `.mjs` — не тестируется (смоук только парсит), дрейф при правках; (ii) **выбрано** — отдельная либа `hooks/product/lib/gap-classifier.cjs` (classify по разметке `LOOP_READINESS_AUDIT.md` + `shouldStop` = единый тестируемый SSOT стоп-формулы), вызываемая субагентом через `node` (как oracle); `.mjs` держит **in-code зеркала** (hard cap `for`-bound, pre-SURFACE met-check, post-classify met/Δ mirror) — терминация гарантирована даже при испорченном LLM-транспорте.
3. **Персистенция advisor-findings:** (i) дать персонам Write; (ii) **выбрано** — выделенный writer-шаг рантайма после SURFACE. Находка: контракт 0140 «each persona WRITES its findings» был **невыполним** — у advisor-агентов tool grants без Write (skill-prose дефект, вскрыт при построении исполняемой формы). Персоны остаются read-only (least-privilege: они же PostToolUse zone-router advisory), запись keyed persona+FM с overwrite-in-place сохранена — исполнитель сместился.

### Decision
Runner (545 строк): SCORE (oracle через агент, verbatim) → SURFACE (FB-LR-28 anchor-root один на ран; FB-LR-31 raw-source брифы — персоны читают сырые артефакты, бриф не пересказывает; crash-safe слоты с try/catch + bounded re-spawn, canonical agentType без general-purpose fallback; writer-шаг персистенции) → CLASSIFY (транспорт к `.cjs`; классификатор = stop authority) → RESOLVE (conservative whitelist только VC/LC/RPM-деривации + in-code guard; verify-before-act 0093; sequential single-writer; идемпотентно keyed) → ESCALATE (PA_CANON verbatim из P6; PA-dedup 0089) → **CloseOut B-c**: advisory B5/B6/B8 (`bg-review`/`validate`), никогда не флипает `met`. Финальный re-score state-based (`resolvedAfterLastScore > 0`), honest_unmet — rail 5. `/product:complete` диспетчит `Workflow({scriptPath})` + честный inline-fallback на skill-прозу для до-1.7.0 инсталляций. Wiring: `update.md` (namespace-aware `product/`, 9 точек), `bootstrap.md`, `verify.md` (Step 4 счётчик + новый Step 4.6 маркеры `delegated_unverified`/`gap-classifier.cjs` + Step 9); generic workflow-смоук обобщён `PROC_DIR`→`PROC_DIRS`; 20 юнитов классификатора в `test:product`.

### Outcome
`npm run verify` EXIT=0 (28 hooks; смоук 8/8 включая новый `.mjs`; счётчики 24/44 не тронуты — аддитивно). Сборка — оркестрация субагентами (recon sonnet → 3 параллельных исполнителя sonnet×2/opus в worktree → Fable-ревью): ревью поймало 3 дефекта до коммита (persona-slot craш при throw agentType; невыполнимая persona-write; re-score guard узок — converged тоже выходит с непроголосованными фиксами) + висячий code-fence; противоречие брифа в dedupe-ключе исполнитель сам разрешил с обоснованием (сегмент `source` убит, иначе кросс-источниковый дедуп невозможен). Live-грейд авто-RESOLVE — B-d на пилоте (E4), отдельная сессия.

**Ретро (E4, 2026-07-04):** terminate-path runner'а **live-подтверждён** на пилоте — `/product:complete FM-003` (первый живой прогон B-b, сессия `59a45840`): oracle met на wave-1 (score 1.0) → 0 персон заспавнено, CloseOut B-c отработал advisory (B5 PASS / B6–B8 PARTIAL, `met` НЕ флипнут), честный финальный отчёт; попутно surfaced V-11 (reverse-ref MK-003↔SC, auto-fixable — не применён, capture-don't-fix). Loop-path (реальный oracle<1 c RESOLVE-калибровкой) остаётся B-d — все 7 фич канона score=1.0, реального гэпа нет, не фабрикуем (FB-LR-26); B-d gated по событию.

### Lessons
1. **Контракт «кто пишет файл» сверяй с tool grants исполняющего агента.** Проза 0140 обещала запись от персон, у которых нет Write — дефект жил незамеченным, пока контракт не стал исполняемой формой. Executable-форма — дешёвый детектор невыполнимых обещаний прозы.
2. **Стоп-логику — в тестируемую `.cjs`, даже когда Workflow не может её require.** LLM-как-транспорт stdout + in-code зеркала в `.mjs` дают и единый SSOT формулы (юниты покрывают все 4 статуса), и гарантию терминации при любом поведении транспорта.
3. **Generic-смоук с захардкоженным каталогом молча пропустит новый top-level runtime dir.** При добавлении каталога процессов первым делом расширяй скан смоука (`PROC_DIRS`), иначе «parses in harness dialect» перестаёт быть гарантией для новых скриптов.

---

## DEC-DEV-0143 — S-LE смоук подтвердил self-deadlock marker-exemption у lesson-presence-gate → target-carve-out (fix) + итоги S-LE прогона

**Date:** 2026-07-04
**Trigger:** армированный S-LE live-смоук в пилоте (сессия `4fb6e0f2`, CC 2.1.200, Windows; урок `LESSON-SLE-SMOKE` open + `LESSON_GATE_MODE=strict`) — этап E4 плана. Грейд post-hoc по транскрипту (opus-форензика, executor/reviewer separation).
**Tag:** #fix #hooks #product #smoke

### Context
Дизайн LESSON-гейта (DEC-DEV-0062) сознательно держал PreToolUse-prong в `warn`, пока S-LE не проверит marker-exemption вживую — header хука прямо предсказывал риск «self-deadlocking the very protocol that resolves the lesson». Смоук прогнан впервые с реально взведённым уроком.

### Root cause
**Marker-exemption самоблокируется по конструкции.** Порядок протокола (`lesson-capture.md` шаги 3-4): файл урока `status: open` пишется ДО маркера, маркер — следом; т.е. первые же записи протокола происходят, когда маркера ещё НЕТ. Strict-deny бьёт по любому мутирующему вызову без маркера → протокол не может ни создать маркер (запись denied), ни отредактировать урок (denied). Live-подтверждено: 3× deny, включая Bash-проверку маркера и Edit самого файла урока изнутри `/product:lesson --resume`; сессия честно диагностировала «замкнутый круг» и эскалировала владельцу вместо фабрикации обхода (правильное поведение агента при дефекте механизма).

### Decision
**Target-carve-out** (а не расширение прав или маркер-бутстрап через ещё один хук): в strict-ветке deny НЕ применяется к мутациям, чья ЦЕЛЬ — сам инструмент разрешения урока: `file_path` под `.product/lessons/**` (авторинг/флип урока) или `.product/.sessions/lesson-in-progress.*` (маркер). Bash остаётся под гейтом (его цели непарсимы из строки команды) — протоколу Bash и не нужен до флипа open→active, после которого гейт спит. Отвергнуто: (i) ставить маркер UserPromptSubmit-хуком на `/product:lesson`-промпт — второй пишущий механизм с гонками против carve-out'а на 4 строки; (ii) exemption по имени скилла — harness не передаёт его в PreToolUse. Riders: не-числовой id-фолбэк без `.md` (косметика из смоука); smoke-раннер обучен `payloadExtra` (hook_event_name) + `expectStdoutIncludes/Absent` (blocking-хуки отвечают stdout-JSON'ом, раньше раннер умел только stderr) — 6 новых кейсов пинуют deny/carve-out/exemption/reminder/warn.

### Outcome
Смоук-хуки 34/34 (28→34). Итоги S-LE: S-LE.2/4/5/6 PASS; S-LE.3 deny PASS + exemption FAIL→FIXED (этот fix); S-LE.1 PARTIAL — stderr-фидбек Stop-гейта доходит до модели (инжект подтверждён транскриптом), но `preventedContinuation:false` на CC 2.1.200 — hard-block чистого закрытия не продемонстрирован (неотличимо от «владелец закрыл окно»). **`lesson-presence-gate` остаётся `warn` — флип warn→strict заблокирован до PASS live-ре-прогона S-LE.1/S-LE.3 против фикса** (после следующей доставки в пилот). Таблица — `dev/gates/S_LE_LESSON_GATE_SMOKE.md`.

### Lessons
1. **Write-ahead протокол + маркер-exemption несовместимы по порядку записи:** если exemption-токен создаётся тем же классом операций, который гейтится, гейт обязан иметь carve-out по ЦЕЛИ операции, а не только по токену — иначе deadlock заложен конструкцией и не виден до live-прогона.
2. **Смоук, который «нашёл блокер», успешнее смоука, который «прошёл»:** дефект был предсказан комментарием в коде четыре недели назад, но подтвердить/опровергнуть его мог только армированный live-прогон (S-LE и был введён под это).
3. **Блокирующие хуки отвечают stdout-JSON'ом — смоук-раннер, умеющий только stderr-ассерты, слеп к их главному контракту.** Расширение раннера (payloadExtra + stdout-ассерты) — разовая цена, дальше все blocking-хуки тестируемы.

---

## DEC-DEV-0144 — Анализ Google-статьи «The new SDLC with Vibe Coding» → отчёт канонизирован в dev/ + принят порядок внедрения (шаг 1 = doc-якоря)

**Date:** 2026-07-04
**Trigger:** владелец предоставил 51-страничную Google-статью (май 2026) с задачей «изучить целиком без потери смыслов и извлечь применимое». Разбор — мульти-агентный Workflow (17 агентов): 5 читателей по перекрывающимся диапазонам страниц → консолидация в реестр **140 идей / 9 тем** → пофазовая оценка применимости против реального репозитория (evidence-пути обязательны) → критик полноты против оглавления (coverage_ok, ремонт не потребовался) → синтез. Несущие клеймы отчёта спот-чекнуты main-моделью (grep: `opts.model` в `orchestrator/processes/*.mjs` отсутствует; `run.md:239` «runs/ NOT auto-created»; `.github/workflows` нет — все три подтверждены).
**Tag:** #analysis #docs #process

### Context
Полный отчёт — [`dev/VIBE_CODING_ANALYSIS.md`](dev/VIBE_CODING_ANALYSIS.md) (SSOT анализа; здесь не дублируется — pointer-collapse). Главный вывод: статья — **независимая валидация курса, а не источник дефицитов**: подавляющее большинство несущих идей (сдвиг синтаксис→намерение, Agent = Model + Harness, «verification is the new craft», context engineering, factory model) уже воплощено; по оси сквозной автономии («прототип = прод без переписывания») практика проекта сознательно строже статьи (METR error-compounding, gated-сегмент).

### Decision
1. **Отчёт канонизирован** в `dev/VIBE_CODING_ANALYSIS.md`. Чистых adopt-идей нет by design — всё ценное либо already-covered, либо adapt под словарь экосистемы; reject-класс зафиксирован в §6 отчёта (адопция-риторика, org/HR-обёртки, IDE-слой, вендор-стек Google, оптимизм сквозной автономии).
2. **Принят порядок внедрения §8** (7 шагов, ни один не требует новой архитектуры). **Шаг 1 исполнен этим же PR:** doc-якоря VC-014 (спектр vibe→agentic), VC-078 (рамка Agent = Model + Harness), VC-097 (два режима оператора) в `docs/guide/00-concepts.md` / `README.md`.
3. Очередь дальше (по §8): VC-096 D7-паттерн config-failure-first triage → VC-118 model-pinning в orchestrator-процессах (задокументированный MDP §3-разрыв) → VC-044 static-context бюджет-аудит → VC-087+VC-134 run-ledger и трейсы → VC-133 substrate-graduation гейт.

### Outcome
Отчёт + doc-якоря + эта запись — один PR (ветка `docs/vibe-coding-adoption`, worktree — общий checkout занят чужой веткой). Шаги 2+ — отдельными единицами по Autoflow.

### Lessons
1. **Внешний peer-документ ценнее как валидация, чем как источник фич:** 140 идей → 0 чистых adopt, но 3 подтверждённых локальных разрыва (model-pinning, количественная observability, «built = прогнан») — все три уже были задокументированы внутри репо, но не закрыты; внешняя рамка сработала как принудительный аудит собственных TODO.
2. **Спот-чек несущих клеймов агентского отчёта обязателен и дёшев:** три grep-проверки подтвердили все ключевые факты до принятия решений (MDP «делегирование ≠ доверие» — работает).
3. **Паттерн разбора длинного документа:** перекрывающиеся чанк-читатели + консолидатор с дедупом + критик полноты ПРОТИВ ОГЛАВЛЕНИЯ (не против самих извлечений) — дешёвая гарантия «без потери смыслов»; пригоден для повторного использования (кандидат в D7-паттерн при втором применении).

---

## DEC-DEV-0145 — E5 kickoff: волна Vision (C ∥ D) + G-минимум + F1-контракт — ре-скоуп Epic D в «генерализацию построенного P2»

**Date:** 2026-07-04
**Trigger:** E4 закрыт-по-максимуму (PR #113) → E5 kickoff по D7 `phase-kickoff.md` (Sections 1/2/4 recon — свежий opus-агент для bias-resistance, fresh-session-эквивалент; я — ревью+решения). Work-order = `dev/ECOSYSTEM_VISION_BATCH_3.md`.
**Tag:** #vision #kickoff #consilium #epic-c #epic-g #f1

### Context
План E5 (CONSOLIDATED_EXECUTION_PLAN) формулировал Epic D по vision-доке как «реализовать консилиум-примитив». Холодный recon вскрыл, что примитив **уже построен и live-validated** как оркестраторный P2 (`consilium-synth.cjs` + жюри ×3, DEC-DEV-0129/0135) — крупнейший vision-drift (§2.2 утверждал «P2 не построен», «персон нет» при 7 в репо). Плюс два скрытых контракт-блокера drop-in-реюза: `isPriorVerdict()` фильтрует вердикты вне хардкода `PRIOR_LIST` (`consilium-synth.cjs:79`), и synth ранжирует только форк (≥2 опций). Факты spot-check'нуты против кода перед решениями (MDP-ревью recon'а).

### Decisions (kickoff-развилки а-и, полная таблица в BATCH_3)
1. **Epic D = генерализация, не стройка:** параметризация панели в `consilium-synth.cjs` (default = 3 арх-приора 1:1, P2-тесты зелёные — согласованное исключение границы `orchestrator/`) + тонкий раннер `/product:consilium <PA>` в `product/processes/`. Отвергнуто: свежая generic-либа (дубль математики, дрейф двух soft-veto); маппинг персон на арх-приоры (теряет гетерогенность); inline-жюри внутри каждой волны loop'а (~15× cost + groupthink на тривиях).
2. **Вход D — только форк-образные decision-PA** (≥2 опций; категории threshold/moscow/*-semantic из gap-classifier); открытые вопросы остаются plain-PA; вторая опция НЕ фабрикуется. Prepare-only: жюри готовит, владелец ратифицирует (авто-proceed = F2/L2, позже).
3. **C-i = новый `batch-enrich-feature-set.mjs`** — тонкая оркестрация поверх существующих `/product`-команд, `complete-feature` как стадия; НЕ ре-имплементация authoring в Workflow; checkpoint-файл до запуска (урок E1). C-ii гейты = реюз L1 PA-escalate (диспозицию владеют F1/F2).
4. **Анти-фрагментация «кто участвует»:** 4 потенциальных firing-решателя (zone-router / gate-risk-classifier / D3 cost-gate / G2 matrix) строятся стопкой — G2 слоем над zone-router, D3-панель потребляет G-пресеты; **D3-пресеты ≡ G4-пресеты = одна реализация**.
5. **Scope:** committed = D-ядро (D1a параметризация → D1b раннер → D2 политика §7.6); stretch = C-i, G1+G2-минимум (owner-дефолт (a)), F1 контракт+skeleton (`autonomy-policy.cjs` потребляет risk-tier gate-risk-classifier, НЕ пере-выводит; wiring — после сверки с оркестратор-треком). Cuts с BF-триггерами: C-iii branch-anticipation (нет данных прогона), G3 панель/метрики (<4 firing-персон), расширения G 1-7 (отдельный §7-раунд).

### Outcome
Work-order `dev/ECOSYSTEM_VISION_BATCH_3.md` записан (ready-to-run); drift-фиксы vision §2.2 (персоны/P2) + ре-скоуп-нота §5 Epic D — этим же PR. Коллизия DEC-DEV сработала **5-й раз**: `next-dec-dev` дал 0144 чистым, но параллельная сессия заняла его в PR #114 между аллокацией и коммитом → перенумеровано в 0145 по скану открытых PR ([[feedback_dec_dev_collision_check]] — скан PR-веток обязателен даже после аллокатора).

### Lessons
1. **Vision-док — снапшот, эпики протухают целиком:** между принятием vision и стартом волны параллельный трек успел ПОСТРОИТЬ ядро эпика (P2 = D1). Kickoff-recon свежим агентом против КОДА (не против vision-прозы) — единственное, что это ловит; иначе волна дублировала бы live-validated механизм.
2. **«Реюз» в план-прозе — проверяй контракт реюзабельности кодом:** vision честно писал «реюз consilium-synth», но хардкод `PRIOR_LIST` + требование ≥2 опций делали drop-in невозможным. Слепая зона формулировки «reuse» = отсутствие проверки, что интерфейс переживёт нового потребителя.
3. **Аллокатор номера не спасает от гонки аллокация→коммит:** `next-dec-dev` был прав в момент запуска — номер сгорел за минуты. Финальная сверка по открытым PR непосредственно перед коммитом остаётся обязательной.

---

## DEC-DEV-0146 — MDP model-pinning во всех Workflow-процессах (VC-118): 56 пиновок + смоук-гейт «agent() обязан нести model/agentType»

**Date:** 2026-07-04
**Trigger:** шаг 3 очереди DEC-DEV-0144 (VC-118 — «задокументированный, но не закрытый разрыв»: MDP §3 предписывает пиновать модель per-stage, но ни один `agent()` в `orchestrator/processes/*.mjs` / `product/processes/complete-feature.mjs` её не передавал → все стадии наследовали дорогую модель сессии = waste + конфаунд для judged-стадий).
**Tag:** #orchestrator #product #mdp #feat

### Context
7 процессных файлов, 56 реальных agent()-вызовов без model. Якоря назначения уже существовали в репо: `settings.json.template._model_strategy` («Opus for product/adversarial, Sonnet for mechanical, Haiku for hooks/scanners») + MDP worst-of-оси + правило «жюри на одной фиксированной модели». Персоны (`architect/qa/ux-advisor`) уже запинованы через frontmatter определений (`model: claude-opus-4-8`) — их вызовы через `agentType:` не дублируются.

### Decision
1. **56 аддитивных пиновок** (только поле `model:` в существующий opts; без `effort`, без изменения промптов). Раскладка: **opus** = судейство/adversarial/verify (жюри P2 `arch:*`×3, панель P6 `validate:*`×3, `verify-drift`/`verify:*`/`verify-completion`, review HIGH), impl с высоким R (`impl:*` TDD-код, `spec-fix`, `remediate`, `kiro-spec-batch`, `brief:*` P2 — lossy lift капит жюри, DEC-DEV-0135), диагностика (`debug:*`, `boot-smoke`, `classify-block` — мис-классификация маскирует upstream-конфликт FB-LR-07); **sonnet** = механика/relay (init/baseline/git, оракул- и либа-relay, PA-write/dedup, plan-parse, synth — рекомендация вычисляется КОДОМ `consilium-synth.cjs`, LOW-tier `verify` — зеркалит HIGH/LOW-разрез самого gate-risk-classifier, `resolve:*` — консервативный whitelist деривации + verify-before-act); **haiku** = не используется (консервативно).
2. **Смоук-гейт** в `tests/orchestrator/workflow-syntax.smoke.cjs` (не в N wiring-тестов): каждая строка с `label:` обязана нести `model:` ИЛИ `agentType:`. Выбор места: сканирует ОБА PROC_DIRS → покрывает `batch-features-to-cc-sdd.mjs` (без wiring-теста) и все будущие процессы бесплатно. Опора на инвариант single-line opts задокументирована в самом тесте.
3. Отвергнуто: дублировать `model` в persona-вызовах (определение агента — SSOT); пиновать `effort` (вне скоупа шага); haiku для тривиальных relay (цена ошибки в gate-цепях выше экономии).

### Outcome
smoke:orchestrator 15/15 (7 новых MDP-чеков), test:orchestrator/test:product зелёные, полный `npm run verify` EXIT=0. Дифф: 7 процессов (+56 model-строк, ноль прочих изменений — проверено ревью `-U0`) + смоук. Исполнитель — opus-субагент; ревью main-моделью: дифф построчно, спот-чек frontmatter персон, 4 спорных назначения (classify-block/verify-completion→opus, LOW-verify/resolve→sonnet) подтверждены с их rationale.

### Lessons
1. **«Задокументированный разрыв» живёт, пока его не цементирует исполняемый гейт:** MDP-предписание существовало с 2026-07-03, `_model_strategy` — ещё дольше, но ни одна пиновка не появилась, пока внешний аудит (VC-118) не сделал это work-item'ом; смоук-гейт переводит дисциплину в невозможность регресса (тот же урок, что process-gate/DEC-DEV-0083).
2. **Пин жюри — один call-site:** когда N плеч жюри текут через одну точку вызова, одна пиновка гарантирует «judge fixed across arms» конструкцией, а не дисциплиной.

---

## DEC-DEV-0147 — Run-ledger: количественная observability оркестратор-прогонов + авто-создание runs/<id>/ (VC-087 + VC-134)

**Date:** 2026-07-04
**Trigger:** шаг 5 очереди DEC-DEV-0144. Поведенческая observability сильна (audit-journal, feedback-intake, effect-probe), количественной НЕ было — ни duration, ни model-mix, ни verdict-времянки; `.claude/orchestrator/runs/` не авто-создавался (run.md «Run records (FB-003)» честно держал это как «tracked follow-up»). Тихий дрейф авто-прогонов (§7 риск 7 анализа) без дренажа.
**Tag:** #orchestrator #observability #feat

### Context
Жёсткое ограничение: Workflow `.mjs` не имеет права читать wall-clock (детерминированный resume) → таймстемпы обязаны приходить снаружи. Плюс свежие 56 model-пиновок (DEC-DEV-0146) сделали карту «label → model» статически извлекаемой из исходника процесса.

### Decision
**Новая либа `orchestrator/lib/run-ledger.cjs`** (CJS, только builtins, CLI + чистые экспорты) + wiring в `commands/orchestrator/run.md`:
1. Диспетчер (harness, исполняющий run.md) обрамляет Workflow: `start --at <ISO>` ДО (создаёт `runs/<id>/run.json` status:running — упавший прогон оставляет след) и `finish --at <ISO>` ПОСЛЕ (finished_at, duration_ms, result-сводка verdict/readiness/conflicts/counts, `model_map` из исходника процесса, tokens opportunistic) + одна строка в `runs/ledger.ndjson`.
2. run-id детерминирован: `<yyyy-mm-dd>-<slug>-<base36(epoch-ms)>`, без Math.random; ndjson идемпотентен по run_id (retry finish не дублирует времянку), run.json — last-write-wins; `finish` без `start` не падает (status finished-unstarted).
3. `model_map` извлекается из label-строк исходника (инвариант single-line opts, уже зацементированный смоуком 0146); agentType-персоны помечаются `via-agent-definition`.
4. Отвергнуто: (i) пер-агентные таймстемпы изнутри процесса — нарушает determinism-контракт, а транскрипт-дир harness уже хранит per-agent детали (ledger = durable сводка, не замена); (ii) инструментировать 56 call-site'ов runtime-обёрткой — инвазивно, статическая экстракция даёт ту же карту бесплатно; (iii) размещение рядом с dev-side `audit-journal.ndjson` (первичная формулировка VC-087) — прогоны живут в проекте-потребителе, контракт места уже объявлен run.md = `.claude/orchestrator/runs/`.

### Outcome
Тест `tests/orchestrator/run-ledger.test.cjs` 10/10 (в `test:orchestrator`); CLI прогнан e2e на реальном процессе; полный `npm run verify` EXIT=0. run.md «Run records» переписан: follow-up закрыт, транскрипт-дир остаётся source of truth per-agent деталей. Закрывает трейс-ногу VC-133/134 graduation-гейта (шаг 6) и даёт дренаж «тихого дрейфа». Исполнитель — opus-субагент; ревью main-моделью: либа построчно, дифф run.md, verify.

### Lessons
1. **Determinism-контракт Workflow диктует топологию observability:** раз скрипт не может знать время — часы живут у диспетчера, а скрипт остаётся чистым; «кто ставит таймстемп» = архитектурное решение, не деталь.
2. **Цементирование инварианта окупается немедленно:** смоук-гейт 0146 («label-строка несёт model») через день стал парсинг-контрактом для extractModelMap — исполняемые инварианты компаундятся.

---

## DEC-DEV-0148 — Substrate-graduation гейт + правило «built ≠ validated» + минимальный CI (VC-133/134/127) — очередь vibe-coding анализа ЗАКРЫТА

**Date:** 2026-07-04
**Trigger:** шаг 6 (финальный) очереди DEC-DEV-0144. Порог «production-ready» не был оформлен: трейсы отсутствовали (закрыто 0147), CI не было вовсе (`.github/workflows` пуст), а несколько runtime-smoke месяцами стояли «built по написанному плану» (§7 риск 5 анализа).
**Tag:** #d7 #gates #ci #feat

### Context
4-компонентный substrate-чеклист из Google-статьи (VC-133/134): evals-в-CI / трейсы / scoped permissions / security review. К моменту шага: трейсы ✅ built (0147), scoped permissions ✅ существовали (tools:-frontmatter 7 субагентов + scope-guard), CI ❌, security review 🟡 частичен.

### Decision
1. **`dev/gates/SUBSTRATE_GRADUATION_GATE.md`** — readiness-гейт per graduation-событие (не разовый): 4 компонента с честными статусами, критерий закрытия компонента 4, PASS-чеклист с VC-127-привязкой, таблица deferred-smoke долга (3 плана «next pilot session» — уже за порогом «>2», прогон приоритетен).
2. **CI-нога = минимальный GitHub Action** `.github/workflows/verify.yml` (ubuntu, node 22, `npm install` — лок-файла нет, `npm run verify`; floor без matrix/cache). Выбран вместо задокументированного solo-субститута: браузерные смоуки кросс-платформенны (нашли `/usr/bin/google-chrome` ubuntu-раннера, graceful-skip при отсутствии), Action самовалидируется первым прогоном на этом же PR (VC-127 в действии). Отвергнуто: только-документировать локальный verify (CI дешевле, чем казалось); полный agent-eval в CI (потолок, отдельный трек VC-128).
3. **VC-127 «built ≠ validated»** — Step 3.5 в `phase-closure.md` (разделять built/validated в статус-доках; считать deferred-smoke долг, >2 = стоп; не архивировать непрогнанные планы; prod-graduation → гейт) + строка-связка в `live-run-validation.md` (именно live-прогон флипает built→validated).

### Outcome
`npm run verify` локально EXIT=0; первый Linux-прогон verify — на CI этого PR (статически замеченные риски: браузерные смоуки на ubuntu впервые ЗАПУСТЯТСЯ, а не скипнутся; case-sensitivity unknown-unknowns; eslint по `^`-диапазону). **Очередь DEC-DEV-0144 §8 закрыта целиком:** шаги 1-6 = PR #114/#116/#118/#119/#120/этот; шаг 7 (линзы VC-108/024) — deferred до kickoff Epic F/G by design. Исполнитель — opus-субагент; ревью main-моделью.

### Lessons
1. **Гейт, честно фиксирующий собственное нарушение, ценнее «зелёного»:** таблица deferred-smoke долга в гейте сразу показала 3 плана за порогом — гейт родился с actionable-находкой, а не декларацией.
2. **CI-решение стоило проверить фактом, а не предположением:** «verify не готов к Linux» казалось блокером, но чтение смоуков показало кросс-платформенный browser-резолв с graceful-skip — цена CI-ноги упала с «отдельный трек» до «12 строк yml» (config-failure-first в действии: сначала проверь harness-факты).

---

## DEC-DEV-0149 — Wave (C∥D) D-ядро ПОСТРОЕНО: панель-параметризация consilium-synth (D1a) + `/product:consilium` жюри-раннер для decision-эскалаций (D1b) + политика §7.6 в коде (D2)

**Date:** 2026-07-04
**Trigger:** стройка committed-target BATCH_3 после merge kickoff-PR #115 (DEC-DEV-0145). Сборка = MDP-оркестрация (D1a — main-модель сама, орк-либа = высокий R; D1b runtime-код — opus-исполнитель в worktree `ce3-wt-wave-cd`; ревью — main). *(Изначально записан как 0146 в PR #117 — перенумерован в 0149 при merge: параллельный vibe-coding-трек занял 0146-0148, PR #118-#121; 7-я итерация [[feedback_dec_dev_collision_check]].)*
**Tag:** #vision #epic-d #consilium #product

### Context
Kickoff 0145 ре-скоупил Epic D в генерализацию построенного P2. Блокеры drop-in: хардкод `PRIOR_LIST` (persona-вердикты молча фильтруются `isPriorVerdict`) + отсутствие канала жюри для decision-PA completeness-loop.

### Decision
1. **D1a** — `consilium-synth.cjs` принимает опциональную панель: `normalizePanel()` (dedupe/trim/fallback на дефолт — malformed панель не сужает и не опустошает жюри молча), `synthesize/buildMatrix/isPriorVerdict/collectOptionIds(…, panel)`, CLI `--panel a,b,c` + `panel` в object-форме, результат раскрывает `panel` (D2 no-silent-fan-out). Omitted == `[velocity,fidelity,integrity]` 1:1 — все 20 P2-тестов зелёные без правок; +6 юнитов (custom-панель, panel-honesty на custom, veto/soft-veto panel-agnostic, byte-identical backward-compat, CLI). Отвергнуто: generic-копия либы (дубль математики/дрейф двух soft-veto); маппинг персон на 3 арх-приора (теряет гетерогенность).
2. **D1b** — `product/processes/consilium.mjs` (5 фаз Load→Scope→Jury→Synthesize→Recommend) + `commands/product/consilium.md` (Workflow({scriptPath}) + inline-fallback). 7 рельсов В КОДЕ: R1 fork-guard <2 опций → честный отказ ДО спавна + non-blocking маршрут-нота в PA (вторая опция НЕ фабрикуется); R2 declared scope до фан-аута (subject+панель+axes в log); R3 панель по зоне (architect+qa всегда, ux только UI-bearing — зеркало условного ux-спавна complete-feature; прямой вызов zone-router отклонён исполнителем обоснованно: он роутит по file-path, у decision-PA его нет); R4 raw-source брифы (FB-LR-31); R5 canonical agentType + crash-safe слоты + bounded re-spawn=1 + форс `prior` к канон-имени персоны (слот авторитетен о том, ЧЬЯ линза бежала); R6 synth = транспорт verbatim (`--panel` из panelNames; verdicts → `.product/.consilium/<PA>-verdicts.json` под anchor-root); R7 integration-pass surfacing-only (зеркало 0135). PA-out = update-in-place (0089), prepare-only — PA не закрывается, спеки не правятся, «ратификация за владельцем» явной строкой.
3. **D2** — политика §7.6 зашита и в код (R2), и в команду текстом; `category_eligible` (SSOT gap-classifier: threshold/moscow/screen-decision/*-semantic) — surfaced caveat, hard-block остаётся fork-guard.
4. **Merge-rider (0146-гейт соседа):** параллельно влитый DEC-DEV-0146 ввёл смоук-гейт «каждый `agent()` несёт `model:`/`agentType:`» — consilium.mjs допинован по той же раскладке: **sonnet** = anchor/load/synth-транспорт/deliver/refuse (механика+relay — рекомендацию вычисляет код), **opus** = integration-pass (судейство), жюри — `agentType:` (модель из frontmatter определений персон).

### Outcome
`npm run verify` EXIT=0 на дереве, смёрженном с main `caf8d3b` (26 synth-юнитов; consilium-wiring 62 ассертов; workflow-смоук вкл. новый model-pin-гейт 0146; gen:map/catalog перегенерированы — урок PR #102 закрыт регистрацией в overlay; counts 24/44 не тронуты). Исполнитель поймал и починил дефект собственного теста (наивный «нет Date/Math»-чек ложно бил по harness-constraint комментариям → strip-comments). Live-грейд жюри на реальном decision-PA — pilot-gated (как B-d), отдельная сессия.

### Lessons
1. **«Реюз роутера» ≠ «вызов роутера»:** zone-router детерминирован по file-path, а вход жюри — PA без пути; правильная форма реюза — зеркалирование его РЕШЕНИЯ (условный ux-гейт), не его интерфейса. Проверяй, на каком ключе детерминирован реюзаемый оракул, до того как обещать «прямой реюз» в брифе.
2. **Форс идентичности слота поверх self-report агента:** персона может мис-лейбльнуть `prior` — слот, который её спавнил, знает истину и перезаписывает. Дешёвый guard против тихой потери вердикта на панель-фильтре.
3. **Параллельный трек может ввести НОВЫЙ гейт, пока твой PR открыт:** conflict-резолюция — это не только склейка текста; после merge main в ветку прогоняй полный verify и жди, что чужие свежие гейты предъявят требования к твоему коду (здесь — model-pinning).

---

## DEC-DEV-0150 — Wave (C∥D) stretch C-i ПОСТРОЕН: `/product:batch-enrich` — макро-батч обогащения feature-set (checkpoint-first, гейты на границах фаз, prepare-only)

**Date:** 2026-07-07
**Trigger:** стройка stretch-очереди BATCH_3 после merge D-ядра (PR #117, DEC-DEV-0149) — пункт «ДАЛЬШЕ #1» файла-шва. Сборка = MDP-оркестрация: runner + команда — opus-исполнитель в worktree `ce3-wt-batch-enrich` по точному брифу, wiring-тест — sonnet-исполнитель, ревью + два фикса — main.
**Tag:** #vision #epic-c #batch-enrich #product

### Context
Kickoff 0145 (решения г/д): completeness-loop hardening есть per-feature (`/product:complete`), но «крупная работа» из примера владельца — обогатить НАБОР FM релиза — требовала макро-шага. Cut 4 запрещает ре-имплементацию authoring F.2-F.10 внутри Workflow; решение «д» запрещает новый gate-disposition механизм (реюз L1 PA-escalate).

### Decision
1. **Новый `product/processes/batch-enrich-feature-set.mjs`** (5 фаз Plan→Enrich→Complete→Gate→Report) + `commands/product/batch-enrich.md` (Workflow({scriptPath}) + inline-fallback, паттерн consilium). 7 рельсов В КОДЕ: B1 explicit target (refusal без цели; `--all-planned` discovery логируется ДО работы); B2 checkpoint-first (урок E1) — манифест в `.product/.batch-enrich/<slug>/` ДО первого касания, слуг детерминирован из sorted-списка (без Date — harness), per-FM state-файлы = single-writer без гонки, resume со шва (verify-before-act 0093); B3 orchestrate-don't-duplicate — ENRICH-агент ИСПОЛНЯЕТ процедуру существующего `commands/product/feature.md` F.2→F.7, COMPLETE = `workflow()`-child на существующий `complete-feature.mjs` (ноль authoring-логики в скрипте); B4 гейты на границах фаз — per-item approve заменён PA-эскалацией решений (threshold/moscow/*-semantic/screen-decision/NFR [Y/D/L]/unsure) + ONE boundary-PA per FM (PA-dedup 0089, merge с прежним списком эскалаций при resume); B5 no status round-up — FM-статус НЕ переводится (F.10 = владелец), `honest_unmet` child'а verbatim; B6 no silent truncation — skip/fail per FM surfaced, батч продолжается; B7 bounded + single-writer.
2. **FM-цикл ПОСЛЕДОВАТЕЛЬНЫЙ `for`, не `pipeline()`** — сознательное отклонение от буквы vision: конкурентные FM-цепочки гоняли бы один `.product/`-tree, product-хуки и аллокацию next PA-NNN канонического ledger (две цепочки минтят один id) — тот же single-writer рационал, что sequential RESOLVE в complete-feature. Отвергнуто: worktree-изоляция per FM (дорого + ломает canonical-PA канал).
3. **F.8 (design) / F.9 (DA) — skip+log** (условные/опциональные, вне C-i); не-planned FM в явном списке проходит, но с громким log-флагом (explicit target = выбор владельца).

### Outcome
`npm run verify` EXIT=0 (ожидается на коммите); workflow-смоук 19/19 (вкл. model-pin гейт 0146: enrich=opus — реальное authoring-суждение, остальное sonnet, child через workflow() вне гейта); новый `batch-enrich-wiring.test.cjs` 85 ассертов (PA_CANON byte-identical к complete-feature, comment-strip техника против ложных Date-срабатываний); wiring: verify.md Step 4/4.6/9, overlay+реген карт/каталога (урок PR #102), package.json test:product. Ревью main поймало 2 зазора исполнителя: boundary-PA при resume мог перезаписать список эскалаций пустым (→ merge-инструкция), не-planned FM проходил молча (→ громкий лог). Live-прогон на ≥2 планируемых FM — pilot-gated (acceptance BATCH_3), отдельная сессия.

### Lessons
1. **Слово «pipeline()» в vision ≠ обязательство конкурентности:** если стадии пишут в один tree/ledger, single-writer `for` — правильная форма того же замысла; фиксируй отклонение явно в коде и журнале, а не молча.
2. **Update-in-place без merge-инструкции теряет историю на resume:** идемпотентный PA-апдейт обязан явно наследовать прежний накопленный список — «перезапиши этим текстом» на втором прогоне стирает первый.

---

## DEC-DEV-0151 — Wave (C∥D) stretch G1+G2 ПОСТРОЕН: roster-конфиг + participation-matrix слоем над zone-router (Epic G минимум)

**Date:** 2026-07-07
**Trigger:** stretch-очередь BATCH_3 после merge C-i (PR #123, DEC-DEV-0150). Сборка = MDP: lib+hook+юниты — opus-исполнитель по точному брифу в worktree `ce3-wt-g-roster`, ревью — main.
**Tag:** #vision #epic-g #roster #product

### Context
Kickoff 0145 (решения е/ж/з): Epic A дал реестр персон + хардкод-routing (`zone-router.cjs`/`zone-routing.yaml`); G-минимум добавляет слой конфигурируемости БЕЗ четвёртого firing-механизма (решение «е»: стопка над роутером, не параллель) и БЕЗ дубля пресетов D3/G4 (решение «ж»: одна реализация).

### Decision
1. **G1** — опциональный `.product/agent-roster.yaml` (per-персона `enabled/model/depth_threshold/extra_lenses` + user-пресеты). Новая dual-use либа `hooks/product/lib/agent-roster.cjs`: purpose-built парсер (техника parseManifest, без YAML-депа); merge над `DEFAULT_ROSTER` (omitted == дефолт); unknown-персона — kept + warning (тайпо не гасит реальную персону молча); malformed/unreadable — дефолты + warning, никогда throw (урок normalizePanel 0149). **Absent файл → `null`-сентинел.**
2. **G2** — `resolveFiring(routeResult, roster)`: слой ПОВЕРХ выхода `route()`. `roster == null` → routeResult возвращается ТЕМ ЖЕ объектом (byte-identical шов — юнит ассертит и deepStrictEqual, и strictEqual против РЕАЛЬНОГО выхода роутера). Иначе: `enabled:false` → drop; `depth_threshold` только ПОДНИМАЕТ планку над зонным гейтом (thr > magnitude → drop), никогда не опускает; все выпали → `fire:false` + честный reason; `dropped[]` surfaced (no silent truncation). Wiring — `zone-change-trigger.js` между `route()` и fire-гейтом, try/catch fail-open (сломанная либа/ростер не блокирует запись и не гасит панель); roster-warnings — non-blocking строкой в stderr-сигнал.
3. **Пресеты (D3≡G4)** — built-in `lean`/`full` + user-override в ростере; `getPreset`/`resolvePanel` экспортированы для D1b-панели, **само wiring в consilium.mjs отложено** (bring-forward: первая живая нужда пресета). G3 (панель/метрики) — CUT по kickoff.

### Outcome
`npm run verify` EXIT=0; новый `agent-roster.test.cjs` 20 блоков (в `test:product`); `zone-router.test.cjs` 17/17 без правок (поведение роутера не тронуто); counts 24/44 не тронуты (ростер = конфиг, не артефакт-тип); шаблон ростера сознательно НЕ шипается — absent==default, схема-SSOT в header либы. Live-проверка переопределения на пилоте — trigger-gated.

### Lessons
1. **«Слой над оракулом» дисциплинирует масштаб:** весь G-минимум уложился в одну либу + 10-строчную вставку в хук, потому что kickoff заранее запретил параллельный механизм; конфиг-слои начинай с вопроса «над каким существующим детерминированным выходом это стоит».

---

## DEC-DEV-0152 — Wave (C∥D) stretch F1 ПОСТРОЕН: контракт autonomy-policy + skeleton-резолвер (L0/L1, floor, precedence) — БЕЗ wiring

**Date:** 2026-07-07
**Trigger:** последний stretch-пункт BATCH_3 после merge G1+G2 (PR #124, DEC-DEV-0151). Сборка — main-модель сама (семантика диспозиций = критическое решение; бриф исполнителю вышел бы длиннее кода).
**Tag:** #vision #epic-f #autonomy #contract

### Context
Kickoff 0145 (решение «и»): F1 = контракт-спека + skeleton, wiring в orchestrator-гейты отложен до сверки полей с оркестратор-треком (причина отсрочки F1 ещё в 0136). Жёсткий констрейнт волны #3: резолвер ПОТРЕБЛЯЕТ risk-tier/readiness из `gate-risk-classifier.cjs`/`env-readiness.cjs`, не пере-выводит (иначе два расходящихся gate-policy механизма).

### Decision
1. **Контракт-док `dev/AUTONOMY_POLICY_F1_CONTRACT.md`**: сигнатура `resolve(operation_class, risk_tier, env_tier, policy, override) → {disposition, level_applied, floor_hit, why[]}`; таблица потребляемых producer-контрактов (`tier HIGH/LOW`, `readiness READY/DEGRADED/ENV_NOT_READY`, `env_tier dev/staging/prod`; absent/foreign → консервативный дефолт + why); precedence vision дословно (floor > override > pin-потолок > default_level > built-in L1); матрица L0/L1; чек-лист сверки с оркестратор-треком перед F2-wiring (enum-стабильность, probe-vs-classify, дом либы, audit-trail → run-ledger, `--autonomy=` флаг).
2. **Skeleton `lib/autonomy-policy.cjs`** (pure fn, zero deps, no I/O; юниты 70 ассертов в `test:orchestrator`). Ключевые F1-рельсы: **floor LOCKED** — `policy.floor` из обычного конфига игнорируется громко (сужение floor = отдельный явный opt-in, не конфиг-ключ); **pin = потолок**, никогда не поднимает; **L2/L3 деградируют к L1 громко** (не построенный уровень не может тихо значить «больше auto»); **`consilium-gate` не эмитится никогда** (эмитить диспозицию без исполняющей машинерии = тихий провал); **`applyReadinessGuard` только даунгрейдит** (READY — без изменений; DEGRADED — auto→human-gate; ENV_NOT_READY — block), зеркало рельса самого env-readiness.
3. **Размещение — repo-`lib/`** (буквальный путь vision): граница волны держит `orchestrator/` read-only (кроме согласованного D1a), а деплой-дом решается вместе с F2-wiring (кандидат `orchestrator/lib/`). **CHANGELOG сознательно не тронут** — скелет не доставляется потребителю (нет deploy-маппинга), consumer-запись поедет с F2-wiring.

### Outcome
`npm run verify` EXIT=0; юниты 70/70; counts 24/44 не тронуты. Волна E5 stretch-очередь ЗАКРЫТА: C-i (0150) → G1+G2 (0151) → F1 (0152); cuts (C-iii/G3/C-ii) остаются за BF-триггерами.

### Lessons
1. **Скелет обязан отклонять диспозиции, которые нечем исполнить:** enum vision шире реализации — честная форма «не построено» это деградация с why-записью (L2/L3→L1) и не-эмиссия (`consilium-gate`), а не «сделаем вид, что уровень есть».

---

## DEC-DEV-0153 — Process Fabric: аудит процессной ткани + Statechart-слой межпроцессной координации (концепт + пилотное ядро)

**Date:** 2026-07-07
**Trigger:** запрос владельца: полный аудит процессов + связности/кросс-процессной коммуникации + критическая проработка идеи Statechart/ESM как поведенческого движка оркестратора (контроль + backpressure; «творческое — свободнее, механическое — жёстче»; источник идеи — внешний доклад о FSM-контроле LLM-агентов).
**Tag:** #architecture #orchestrator #process-fabric #statechart #audit

### Context
Аудит (9 зонных ридеров → 3 opus-агрегатора → синтез; `dev/process-fabric/AUDIT_2026-07-07.md` + 3 приложения): 79 процессов в 11 доменах; **18 де-факто машин состояний, enforced-переход у 3** (LESSON, completeness-loop, gate-verdicts); 36 разрывов G01–G36; из ~19 runtime-хуков блокирует один (`lesson-gate`); состояние фрагментировано по 9 хранилищам в 4 форматах. Системный диагноз: **разрыв «сенсор→мышца»** — детерминированные хуки пишут сигналы в write-only очереди (`pending-actions.md`, 6× `*-pending.yaml`), детерминированные оракулы умеют исполнять, но между ними «LLM должен вспомнить»/человек. Обратный контур (нелинейность «результат шага инициирует пересмотр архитектуры») не замкнут нигде, кроме lesson-gate. Сквозной трейс «идея→прод» доезжает до P6 GO / частично P7; дальше spec-only (Epic E, E15-петля).

### Options considered
1. **Statechart-движок поверх всего (включая внутрипроцессный flow)** — отвергнуто: Workflow-скелеты P2–P7 уже детерминированные FSM (bounded rounds, schema-гейты); второй движок = дубль и risky rewrite (против DEC-DEV-0076 «оркеструем, не переписываем»).
2. **XState v5 как dependency** — отвергнуто сейчас: тянет npm-dep в zero-dep слой; actor-model/parallel/history v1 не нужны; персистентность + determinism-контракт всё равно свои. Charter-формат держим XState-совместимым по духу — миграция открыта.
3. **n8n/внешний durable-оркестратор** — отвергнуто (повторно, линия DEC-DEV-0058): durable state достижим без демона; wake — хуки/cron/сессии.
4. **«Просто больше хуков» без движка** — отвергнуто как система (у хуков нет ни состояния, ни модели переходов; текущее состояние — предел подхода), принято как транспорт (SessionStart-инжект, прецедент rails).
5. **Тонкий межпроцессный координатор (ПРИНЯТО): Process Fabric** — декларативные charter'ы (JSON, подсет XState-семантики; `invoke` = запуск существующего Workflow-процесса) + микро-интерпретатор `fabric-engine.cjs` (pure-core, event-sourcing events.ndjson + state.json, timestamps-as-inputs как run-ledger) + актуаторы (диспетчер run.md, хуки, pending-actions, позже cron). События — ТОЛЬКО материализация structured-результатов процессов (ingest-маппинг из run-ledger `--result-file`), никаких «LLM решил, что событие случилось». Каждая prescription проходит `lib/autonomy-policy.cjs` (это посадочное место F2-wiring; floor непробиваем by construction). Backpressure = extended state: WIP-лимиты per lane (кодифицирует FB-004) + единая приоритизированная owner-queue (главный перегруженный ресурс — внимание владельца, не машинный трафик). Манифест детерминизма DL0–DL3/H на каждый шаг каталога: чем механичнее — тем жёстче FSM-контроль; творческое — только рамка вход/выход.

### Decision
Дизайн-SSOT — `dev/process-fabric/CONCEPT.md`. Пилотное ядро (фаза 1): `orchestrator/lib/fabric-engine.cjs` + `orchestrator/charters/feature-production-line.json` (E2E фичи P3→P7 с feedback/escалation-рёбрами) + `tests/orchestrator/fabric-engine.test.cjs`. Каталог процессов `dev/process-fabric/catalog.yaml` (существующие + gap-fill из методологий, DL-классы, типы связей, события). Диспетчер-wiring и SessionStart-инжект — фаза 2 (отдельный PR); live-прогон + graduation — фаза 3 (pilot-gated).

### Outcome
Built ≠ validated: graduation-критерии в CONCEPT §9 (инстанс ≥2 сессии, машинный NO-GO→remediation→GO, owner-queue resolve). Ядро построено воркфлоу «opus-исполнитель → адверсариальная панель ×3 → фикс → recheck»: 12 находок, 4 confirmed-important применены с тестами-регрессорами (human-gate-on-invoke флорится; P5 ingest-путь исправлен `gate.result`→`go_gate` по фактическому возврату `.mjs:575`; P7 NOT_STARTABLE dead-end закрыт маршрутом в `awaiting_product`); 2 отклонены фиксером в мою зону и закрыты мной (ратифицирован remediation self-loop — CONCEPT §4.2 приведён к построенному charter'у, литерал объявлял counter max=2 но не использовал; wiring теста в package.json). Тест 16/16; **полный `npm run verify` EXIT=0**.
Каталог собран: **94 процесса / 469 шагов / 231 связь** (75 existing + 19 gap-fill; оркестраторная серия нормализована P1..P7→P1o..P7o по канону overlay). Перекрёстная валидация: DL-профиль шагов каталога (механика 66% / суждение 27% / человек 7%) независимо сошёлся с оценкой агрегатора детерминизма (65/25/10). После session-limit проведена сверка план/факт тремя ридерами: из 17 агентов трёх workflow реально потерян был один (completeness-критик) — перегнан; урок — `parallel()` в Workflow не имеет per-branch чекпоинта при resume (упал 1 из 4 → пересчитались все 4, у переживших разъехались ID-стили между прогонами; сборка каталога выбрала согласованную комбинацию по метрике разрешимости кросс-ссылок: 29 vs 46 unresolved).

### Lessons
1. **Гипотеза владельца подтвердилась эмпирически, но зона применения — конверт, не контент:** система уже расщеплена по линии «механическое → код (65%), творческое → LLM (25%), человек (10%)»; FSM должен формализовать lifecycle/disposition/pending→resolved, НЕ шаги суждения.
2. **Эталон уже в кодовой базе:** lesson-gate — единственный замкнутый контур (write→block→resolve); Fabric = его генерализация («детерминированный слушатель на конце очереди»), а не импорт чужой парадигмы.
3. **ESM надстраивается НАД человекочитаемыми файлами** (markdown/PA/git), проецируя в них, — не заменяет их (иначе теряется git-дружелюбность, которую владелец ценит).

---

## DEC-DEV-0154 — Process Fabric фаза 2 (2a+2d): диспетчер-актуатор в run.md + закрытие F2-сверки F1 (дом либы, `--autonomy` override)

**Date:** 2026-07-07
**Trigger:** команда владельца «приступаем к фазе 2» по `dev/process-fabric/EXECUTION_ROADMAP.md` (2a диспетчер-wiring + 2d F2-сверка — этот PR; 2b PA-мост + 2c SessionStart-инжект — следующий).
**Tag:** #orchestrator #process-fabric #wiring #autonomy #deployment

### Context
Ядро Fabric built ≠ validated (DEC-DEV-0153); первый актуатор — диспетчер `run.md`. Recon стыков вскрыл две дыры доставки: (а) `fabric-engine` требовал `../../lib/autonomy-policy.cjs`, а корневой `lib/` не имеет деплой-маппинга — bootstrap bulk-copy его кладёт, но `/ecosystem:update` root-`lib/` НЕ синкает никогда → в user-проекте require бьётся/дрейфует после первого update (класс DEC-DEV-0088 «partial sync», только by-design); (б) примеры-перечисления `update.md` не знали `charters/` (managed) и `fabric/` (preserved state) — код синка динамический (`ls` upstream-детей), но перечисления load-bearing для LLM-исполнителя update, а fabric-state не был в явном wipe-protection списке (принцип «состояние пилота не вайпим»).

### Options considered
1. **Дом либы: оставить repo-`lib/` + добавить root-`lib/` в синк-списки update.md** — отвергнуто: новый managed-корень ради одного файла + ещё один класс в namespace-семантике.
2. **Переезд в `orchestrator/lib/` рядом с потребителем (ПРИНЯТО)** — рейдит существующий namespace-синк `{processes,lib,charters}`; `require('./autonomy-policy.cjs')` стабилен в обоих layout (repo-root и `.claude/`); ровно кандидат, названный F1-контрактом §6.
3. **Шим-реэкспорт на старом пути** — отвергнут: потребителей два (движок+юниты), оба обновлены; мёртвый шим сам остался бы вне доставки.

### Decision
**2a.** Секция «Process Fabric (inter-process line coordination)» в `run.md` ПОСЛЕ run-ledger-wiring: opt-in `--fabric` (init по deployed-пути charter'а + `tick evt:line.start`; rejected start документирован как FB-004 backpressure, не ошибка), `ingest` тем же `--result-file` и `$RUN_ID`, что и `finish` (идемпотентность моста), маршрутизация prescriptions (auto → продолжение полного bracket-цикла ledger start→Workflow→finish→ingest; human-gate → owner-queue + STOP, PA-проекция = 2b; final → закрытие линии), resume-события (`evt:pa.resolved`/`evt:env.up`/`evt:owner.resume|abort`), `replay` как recovery-инструмент. **2d.** Чек-лист F1 §6 закрыт по всем 6 пунктам (зафиксировано в самом контракте): fabric-уровень риска — из charter `meta.risk` (authored, default HIGH), per-task `classifyTask` остаётся в P5; readiness входит **событиями** ingest, не disposition-guard'ом; `env_tier` — из `fabric/limits.json`; дом либы — переезд (выше); audit-trail `why[]` — `events.ndjson`; `--autonomy` — end-to-end (`run.md` frontmatter → CLI `init|ingest|tick --autonomy` → `env.override` → 5-й аргумент `resolve()`; floor непробиваем — юнит). Плюс новый wiring-тест `fabric-dispatcher-wiring.test.cjs` (11 asserts): lockstep run.md ↔ charter ↔ update.md ↔ require-граф движка (ingest-ключи диспетчеризуемы; resume-события существуют в charter; `charters/` шипается, `fabric/` защищён; policy co-located, stale-копия в repo-`lib/` запрещена).

### Outcome
Юниты: autonomy-policy 70 ✓, fabric-engine 16→18 ✓ (+override pure/CLI), новый wiring 11 ✓; полный `npm run verify` — до конца цепочки (puppeteer-смоуки skip как обычно в этом env). `run.md` — первый живой актуатор Fabric; у F1 появился транзитивно живой потребитель-путь (prescription → диспетчер). Доставка выровнена: verify.md Step 4 считает `charters/*.json`; catalog.yaml executor-пути обновлены.

### Lessons
1. **«Дом либы» — деплой-контракт, не вкусовщина:** файл вне managed-namespace доезжает bootstrap'ом, но умирает на первом `/ecosystem:update`. Require-граф новой либы сверяй со списками update.md ДО релиза — теперь это держит детерминированный assert (co-located require + запрет stale-копии).
2. **Динамический код синка ≠ достаточно:** прозу update.md исполняет LLM, перечисления в ней load-bearing — обязаны зеркалить факт (`charters/`, `fabric/`), иначе wipe-protection живёт только в удаче.

---

## DEC-DEV-0155 — Process Fabric фаза 2 (2b+2c): PA-мост замыкает обратный контур G03/G04 + первый shipped SessionStart-хук; 2e срезан

**Date:** 2026-07-07
**Trigger:** продолжение фазы 2 по `dev/process-fabric/EXECUTION_ROADMAP.md` (2b PA-мост + 2c SessionStart-инжект); исполнение — два opus-субагента по MDP (точные брифы, развязанные файловые зоны), ревью диффов main-моделью.
**Tag:** #orchestrator #process-fabric #pa-bridge #hooks #sessionstart

### Context
После 2a human-gate останавливал линию только во внутренней owner-queue Fabric (JSON) — вне канонического PA-канала владельца; резолюция требовала ручного tick с ручным подбором события. SessionStart-хуков в shipped-манифестах не было вовсе (0 из 5 неиспользуемых событийных типов — аудит §1); возвращающаяся сессия реконструировала «где мы» по хвостам доков.

### Options considered
1. **PA-write промпт-инструкцией диспетчеру** — отвергнуто: снова «LLM должен вспомнить» — ровно класс разрыва (c) аудита; CONCEPT §4.4 прямо отдаёт запись engine-shell.
2. **Engine-shell пишет PA + `pa-scan` читает резолюцию (ПРИНЯТО)** — детерминированный слушатель на ОБОИХ концах очереди (lesson-gate-паттерн, поднятый на межпроцессную ткань).
3. **Демон/файл-watcher на PA** — отвергнуто: среда не-демоническая; резолюция = явный tick (`pa-scan --tick`) диспетчером/владельцем, консистентно с «движок тикают».

### Decision
**2b (PA-мост).** Applied-тик, паркующий инстанс в human-gate-состоянии, зеркалит каноническую PA-запись (schema `user-action-tracker.md`; маркеры `fabric-instance`/`fabric-state`/`resume-event` в Details — машинный контракт; дедуп по (instance, state, pending); create-if-absent с PA-000 sentinel; `init` не спамит — диспетчер сразу тикает line.start). `resume-event` выводится детерминированно из charter `on{}` (`evt:pa.*` → `evt:owner.resume` → `evt:env.up` → первый ключ). Новая подкоманда **`pa-scan [--tick]`**: Status done → тикнуть resume-event (идемпотентные скипы: инстанс исчез / уже ушёл из состояния / charter не держит событие); **dismissed → surfaced only** (abort vs resume — решение владельца, не машины). PA — shell-side-effect ВНЕ event-sourcing: `replay` воспроизводит state.json бит-в-бит независимо. Escalated-гейт auto-resume по done-флипу ратифицирован: это ровно graduation-критерий (c) «human-gate через owner-queue разрешён и продолжил инстанс».
**2c (SessionStart-инжект).** `hooks/orchestrator/session-fabric-status.js` + `manifest.yaml` — **первый shipped SessionStart-хук экосистемы**: warn-only (exit 0 всегда, 15s timeout, тумблер `FABRIC_STATUS_INJECT=0`), read-only шелл `fabric status`, инжект `additionalContext` (инстансы + топ-5 owner-queue, cap 8k), no-op без fabric-state (в dev-репо inert). Сопутствующие однострочники: `settings.json.template` pre-seed `"SessionStart": []` (прецедент LESSON-* для Stop/PreToolUse/UPS), `update.md` regex ecosystem-owned хуков += `orchestrator` (прецедент `design/` Phase 6).
**2e (charter №2 product-front) — СРЕЗАН этой волной:** расширение слоя до прохождения graduation противоречит substrate-дисциплине DEC-DEV-0148 (built ≠ validated); профит федерации owner-queue появляется только с live product-front прогонами, которых до пилота нет. Отложен до фазы 4 по эмпирическому триггеру.

### Outcome
fabric-engine 23/23 (+5 PA-тестов), fabric-dispatcher-wiring 11/11, hook-smoke 34→36/0, полный `npm run verify` зелёный. Обратный контур G03/G04 замкнут детерминированно end-to-end: гейт → PA(pending) → владелец флипает done → `pa-scan --tick` → линия продолжена. Фаза 2 построена целиком (2a+2d PR #129; 2b+2c этот PR); дальше — фаза 3 live-валидация на пилоте (graduation gate).

### Lessons
1. **Оба конца очереди должны быть детерминированными:** write-only PA и был G03; мост полон только парой «engine-write + pa-scan-read» — одно направление без второго оставляет разрыв «сенсор→мышца».
2. **Развязка файловых зон в брифах** позволила двум opus-агентам работать параллельно в одном checkout без конфликтов; право исполнителя на мотивированное отклонение (MDP п.5) сработало дважды — оба отклонения были однострочниками с прецедентами и приняты на ревью.

---

## DEC-DEV-0156 — G20: count-drift в CLAUDE.md.template + слепая зона реконсилятора (templates/ не сканировался вовсе)

**Date:** 2026-07-07
**Trigger:** автономный quick-wins прогон по `dev/process-fabric/EXECUTION_ROADMAP.md` §«Параллельная дорожка» (G20 — самый срочный: шаблон инстанциируется verbatim в каждый новый пилот при bootstrap).
**Tag:** #templates #d7 #count-drift #tooling

### Context
`templates/project/CLAUDE.md.template` нёс «23 artifact types» (×2 строки) при каноне 24 — и, как вскрылось по ходу, ещё и «33 validation rules» при каноне 44. Root cause двойной: (а) реконсилятор `check-counts.js` (DEC-DEV-0083) не включал `templates/` в `SCAN_ROOTS`; (б) даже при включении `walk()` собирал только `*.md`, а файл называется `.md.template` — т.е. слепая зона на двух уровнях сразу.

### Options considered
1. Точечный фикс чисел без расширения реконсилятора — отвергнуто: G20 ровно так и возник; при следующем изменении канона шаблон снова отстанет молча.
2. Фикс чисел + `templates/` в скан + фильтр `.md.template` (ПРИНЯТО) — enforcement замыкается сам: process-gate (commit-msg) гоняет check-counts, дрейф шаблона теперь блокирует коммит.
3. Подстановка чисел placeholder'ом при bootstrap — отвергнуто: усложнение инстанциатора ради двух строк; числа всё равно живут в тексте и подлежат скану.

### Decision
Вариант 2. Header check-counts.js дополнен обоснованием: templates/ — consumer-zone (числа там live, не исторические). Исполнение — sonnet-агент по точному брифу (MDP), ревью диффа main-моделью; мотивированное отклонение исполнителя (третья строка 33→44 сверх ТЗ из двух строк) принято — сверено с `validation.md` («44 активных правила ... + 2 process rules»).

### Outcome
`check-counts.js` ✓ consistent 24/44 по всем live-докам включая templates/. Попутно закрыт третий дрейф (33→44), в G20 не числившийся.

### Lessons
1. Слепая зона сканера — класс бага, не единичный typo: gap заявлял 2 строки, расширенный скан тут же нашёл третью. Расширяя реконсилятор, прогоняй его ДО ручного фикса — пусть сам выдаст полный список.
2. Расширение файлового скана проверяй на обоих уровнях: список корней И файловый фильтр (`.md.template` ≠ `*.md`).

---

## DEC-DEV-0157 — G23: process-gate ставится автоматически (npm `prepare` → node-установщик); `.sh` стал тонкой обёрткой

**Date:** 2026-07-07
**Trigger:** автономный quick-wins прогон (EXECUTION_ROADMAP §«Параллельная дорожка»); gap G23 — `.git/hooks` не версионируется, блокирующий D7-гейт существовал только там, где вручную вспомнили `install-pre-commit.sh` → свежий клон жил вообще без enforcement.

### Context
Весь D7-enforcement (count drift / CHANGELOG / DEV_JOURNAL — process-gate.js; hook-smoke — pre-commit) держался на ручном ритуале установки. fragile-enforcement класс из APPENDIX-B.

### Options considered
1. Только докстрока «не забудь установить» — отвергнуто: это и есть текущее состояние, G23 ровно об этом.
2. npm `prepare` + node-установщик `install-git-hooks.cjs` (ПРИНЯТО) — husky-паттерн без зависимости: `prepare` срабатывает на каждом `npm install`/`npm ci`; реализация одна, кроссплатформенная (whole-repo тулинг и так node); `--best-effort` для prepare (не-репо/огрызок тарбола → warn + exit 0, npm install никогда не ломается), strict для ручного запуска.
3. Переписать bash-установщик и вызывать его из prepare — отвергнуто: на Windows npm-скрипт с bash хрупок; две реализации (bash SSOT + node-мост) — drift-риск. Вместо этого инверсия: node = SSOT, `install-pre-commit.sh` — тонкая обёртка (документированная точка входа CLAUDE.md продолжает работать).

### Decision
Новый `dev/meta-improvement/scripts/install-git-hooks.cjs`: worktree-safe (`git rev-parse --git-path hooks`, честен к `core.hooksPath`), идемпотентен (идентичный таргет → no-op), differing-таргет бэкапится; ставит оба хука (pre-commit ← pre-commit.sh, commit-msg ← commit-msg.sh — контракт DEC-DEV-0023/0083 без изменений). `package.json` scripts += `"prepare"`. CLAUDE.md «Установить gate» обновлён (авто при npm install; вручную — прежняя команда).

### Outcome
4 сценария проверены: живой репо (prepare обновил устаревшие ранее установленные хуки — content-сравнение работает), вне репо best-effort exit 0 / strict exit 1, свежий git-init клон получает оба хука. Остаточный риск (осознанный): дев, который клонировал и НИ РАЗУ не запускал `npm install`, гейта по-прежнему не имеет — но это уже пересечение с CI (verify на Linux гоняет job'ы независимо от локальных хуков).

### Lessons
1. Fragile-enforcement закрывается перехватом СУЩЕСТВУЮЩЕГО ритуала (npm install все и так делают), а не добавлением нового («запусти ещё и вот это» — не работает по определению G23).
2. При двух реализациях одной логики на разных языках — инвертируй в «одна реализация + тонкая обёртка», а не «мост поверх обеих».

---

## DEC-DEV-0158 — G19: линтер catalog↔runner в verify; вскрыт и закрыт live-drift (V-18 + 4×V-AM молча отсутствовали в раннере)

**Date:** 2026-07-07
**Trigger:** автономный quick-wins прогон (EXECUTION_ROADMAP §«Параллельная дорожка»); gap G19 — `validation.md` (каталог, 44 правила) и `validation-runner.md` (hardcoded-таблицы) синхронизировались вручную; сам каталог §11 откладывал линтер «до >100 правил или first observed drift».

### Context
Recon (sonnet Explore) сравнил ID-множества: **drift уже случился** — V-18 (DEC-DEV-0064) и все 4 V-AM-* (DEC-DEV-0066) добавлены в каталог и реализованы inline-хуками, но в раннер не занесены вовсе (silent: `--rule V-18` через раннер не работал, full-прогон их не считал). V-MK-01..08 — отдельный класс: признанный, задокументированный skip. Плюс внутрикаталожная нестыковка: namespace-таблица §0 говорила «V-01..V-16 / 15» при факте 16 заголовков.

### Options considered
1. Хардкод allowlist признанных пропусков в самом линтере — отвергнуто: третье место истины, drift переезжает в линтер.
2. Признание пропусков объявляется В РАННЕРЕ machine-readable маркером `<!-- catalog-sync:acknowledged … reason="…" -->` (ПРИНЯТО) — декларация живёт рядом с прозой пропуска, reason обязателен, линтер ловит stale-ack ([3]) и двусмысленность ([4]).
3. Парсить прозу скипа эвристикой — отвергнуто: хрупко, ровно против духа anti-pattern §1 раннера.

### Decision
`dev/meta-improvement/scripts/check-validation-sync.cjs` (в `npm run verify` как `check:validation-sync`): ID-set сравнение — каталог (`#### V-…:` заголовки) ↔ таблицы раннера (`| V-… |`) + ack-маркеры; 6 проверок ([1] непокрытое правило, [2] orphan в раннере, [3] stale ack, [4] таблица∧ack, [5] prose-итог «N активных правил» == числу заголовков, [6] namespace-таблица §0 == пофакту). Семантика правил НЕ парсится (anti-pattern §1 переформулирован: запрет касается runtime-исполнения; drift-detection — санкционированный кандидат §11). Live-drift закрыт содержательно: V-18 — строка в artifact-таблице раннера (зеркалит `artifact-validate.js`), V-AM-* — секция inline-only + ack-маркер (semantics V-MK-класса), namespace-таблица §0 исправлена (16, диапазон V-01..V-18 без V-13/V-17), §11 чекбокс закрыт.

### Outcome
Линтер зелёный на реальных файлах (44 = 32 rows + 12 ack); негативные фикстуры дают все классы ошибок и exit 1; пустой каталог → exit 2. Полный `npm run verify` зелёный с линтером в цепочке.

### Lessons
1. «Линтер добавим при first observed drift» без механизма НАБЛЮДЕНИЯ дрейфа — самообман: drift случился (V-18, DEC-DEV-0064) и месяц жил незамеченным, триггер сработал только от постороннего аудита. Отложенный гейт должен иметь детектор своего триггера.
2. Признанное исключение — тоже контракт: allowlist живёт в файле-нарушителе machine-readable маркером с обязательным reason, не в голове и не в линтере.

---

## DEC-DEV-0159 — G05/G06: subagent-watchdog — первый SubagentStop-хук; детерминированный сенсор над pending-очередями и каноничностью персон

**Date:** 2026-07-07
**Trigger:** автономный quick-wins прогон (EXECUTION_ROADMAP §«Параллельная дорожка»); gaps G05 (pending-очередь write-only: спавн ревьюера держится на памяти оркестратора, записи тихо стираются — live-инцидент `1ff552c0c6b4`/DEC-DEV-0038 #1) + G06 (recurring S8 P1 regression: персона-бриф исполняется под general-purpose вместо канонического типа; фиксировался ≥3 раза — 0038/0043/patch-candidate C).

### Context
Прежний hard-enforcement был отвергнут в DEC-DEV-0064 с формулировкой «PostToolUse не видит subagent_type» — верно, но SubagentStop ВИДИТ: контракт верифицирован по официальной доке (payload несёт `agent_type`+`agent_id`; `transcript_path` — транскрипт главной сессии; matcher фильтрует по типу агента; exit 2 заставляет субагента ПРОДОЛЖИТЬ — поэтому осознанно warn-only/exit 0). Событие SubagentStop не использовалось нигде в экосистеме (0 из 5 незадействованных типов — аудит §1). R4 (ПОЧЕМУ harness отвечает «agent not found») по-прежнему сознательно не трогается — три прежние точки решения откладывали его до live-harness verification; watchdog не чинит регистрацию, он ДЕТЕКТИРУЕТ факт подмены post-hoc.

### Options considered
1. Штамповать consumed_at прямо в pending-yaml — отвергнуто: форматтеры триггер-хуков whitelist'ят поля при re-emit (см. `formatDaEntriesYaml`), чужой ключ молча стирается при следующей перезаписи; расширять три shipped-хука ради этого — не smallest mechanism.
2. Sidecar-state watchdog'а `.product/.pending/.watchdog-state.json` (ПРИНЯТО) — producer-файлы не мутируются вообще; ключ (artifact, queued_at) ⇒ re-queue артефакта автоматически сбрасывает потребление (новое изменение = новое ревью-обязательство); warn-once на wipe (запись после предупреждения выбрасывается).
3. Демон/watcher над очередью — отвергнуто (среда не-демоническая; прецедент 2b PA-моста: слушатель = детерминированный хук на событии).

### Decision
`hooks/product/subagent-watchdog.js` — один файл, три pronga (manifest: SubagentStop ""/Stop ""/PostToolUse Write|Edit): (а) **G06** — завершившийся general-purpose/claude, чей spawn-prompt (последний Task с этим subagent_type в хвосте транскрипта главной сессии, shape-tolerant парс до 1MB) матчит маркеры персона-брифа → громкий stderr «S8 P1 REGRESSION, ревью НЕ валидно, respawn каноническим типом, not-found → STOP» (anti-patterns #9/#10 остаются prompt-слоем, watchdog — слой детекции); (б) **G05-позитив** — завершившаяся каноническая персона → artifact-ID из её spawn-prompt штампуются consumed в sidecar + stderr-подтверждение; (в) **G05-wipe** — на каждом событии reconcile state↔очереди: запись исчезла без consumed → громкий stderr (сигнатура инцидента), исчезла с consumed → тихая уборка; (г) **Stop** — незакрытые обязательства на закрытии сессии → напоминание (очередь переживает сессию, spawn-намерение — нет). Rollout: warn-only (lesson-gate остаётся единственным blocking), fail-open всюду, тумблер `SUBAGENT_WATCHDOG=0`. Riders: `settings.json.template` pre-seed `"SubagentStop": []` (прецедент 2c), первый SubagentStop-хук экосистемы.

### Outcome
5 smoke-кейсов (G06-warn / consume-stamp / non-persona-silence / Stop-reminder / wipe-detect) — все зелёные с первого прогона; hook-smoke 36→41/0; полный verify EXIT=0. Обзорных доков, перечисляющих хуки поимённо, нет (проверено grep'ом) — sweep не требуется; gen-map хуки не харвестит.

### Lessons
1. «Хук не может это видеть» — утверждение про КОНКРЕТНОЕ событие, не про hook-слой вообще: отвергнутый в 0064 enforcement оказался возможен ровно потому, что смотрели на PostToolUse, а не на SubagentStop. При отклонении механизма фиксируй, к какому событию относился аргумент.
2. Чужой формат с whitelist-re-emit — не место для твоего состояния: sidecar собственного владения дешевле и безопаснее расширения трёх производителей.

---

## DEC-DEV-0161 — Factory Conductor MVP: пульт оркестрации параллельных интерактивных Claude Code сессий на VM

**Date:** 2026-07-08
**Trigger:** запрос владельца «сделаем MVP инициативы Factory Conductor + инструкцию». Инициатива была зафиксирована как отложенная (память `project_factory_conductor_initiative`, дизайн одобрен 2026-07-08 после трёхсторонней разведки).
**Tag:** #orchestration #factory #tmux #mvp

### Context
У экосистемы есть Orchestrator для **headless** Workflow-агентов, но не было ручки на второй половине фабрики — долгоживущих **интерактивных** `claude`-TUI сессиях, которые solo-dev разворачивает на VM. Нужен тонкий пульт: запускать/вести N параллельных сессий «как человек» (несколько терминалов), со сбором логов и расширяемостью. Субстрат — VM `Ubuntu-ClaudeCode` (tmux 3.4, Node 22, claude в `~/.local/bin`).

### Options considered
1. **tmux + тонкий Node-пульт `factory.cjs`, worktree/полосу, состояние через hooks** (ПРИНЯТО) — официального API «инъекция ввода в чужую интерактивную сессию» нет, только tmux/PTY; hooks Claude Code (SessionStart/UserPromptSubmit/Stop) дают состояние без парсинга экрана; run-ledger уже есть — переиспользуем как журнал; worktree/полосу держит single-writer инвариант FB-004.
2. **Agent Teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) — официальный аналог, но experimental (нет resume тиммейтов, ~5-6 предел, 1 team/сессия). Отложено: сам построен на tmux → миграция при созревании лёгкая.
3. **Node+bash без tmux (спавн headless `-p`)** — отвергнуто: теряется интерактивность и наблюдаемость владельцем из GUI; запрос был именно про «как человек с несколькими экранами».

### Decision
`dev/factory-conductor/factory.cjs` (650+ строк, stdlib-only, без LLM) + README. Полоса (lane) = tmux-сессия `cf-<lane>` в своём git worktree (`~/projects/lanes/<lane>`, ветка `lane/<lane>`). Команды: `spawn` (worktree + hooks-settings + tmux + ledger-start + опц. авто-промпт), `send` (`--text`/`--file`→FACTORY-BRIEF.md), `peek`, `status`/`list` (таблица state/branch/ahead/dirty), `harvest` (скролбэк + git-съём + ledger-finish), `stop` (`/exit`→kill, mini-harvest, `--rm-worktree` с сохранением ветки). Состояние снимается **хуками** (Stop→маркер `idle`, UserPromptSubmit→снятие), не парсингом. Живёт в `dev/` (не consumer-zone) до live-валидации на пилоте.

### Outcome
Live-смоук на VM (пилот `my-first-test`), 2 параллельные полосы, полный цикл: spawn → pre-trust → авто-промпт → busy → интерактивный send/peek → idle(Stop-hook) → harvest → stop --rm-worktree. Ledger забрекетил оба прогона (dur:516s/302s, verdict harvested), ветки `lane/*` сохранены, worktrees сняты. Три бага найдены и починены в ходе смоука (см. Lessons). Тестовые артефакты вычищены.

### Lessons
1. **Trust-диалог блокирует хуки.** Свежий worktree — незнакомая папка; TUI встаёт на folder-trust, SessionStart не срабатывает, `started`-маркер не появляется (90s timeout авто-промпта). Фикс: `preTrustWorktree` пишет `hasTrustDialogAccepted` в `~/.claude.json` до запуска. Гонка с параллельным `claude` (перезапись `~/.claude.json`) осознанно принята — окно крошечное, fallback = оператор жмёт Enter.
2. **capture-pane нужна живая сессия — harvest ДО kill.** Исходно `stop` глушил сессию, потом мини-harvest → скролбэк терялся. Переставил mini-harvest перед `/exit`.
3. **Stale-маркеры полосы обманывают `started`-wait** при повторном использовании имени полосы — `spawn` теперь чистит `started/idle/session_id` перед стартом.
4. **Родительская директория worktree** (`~/projects/lanes/`) может не существовать на первом спавне — `mkdirSync` recursive перед `git worktree add`.
5. ITP из глобального CLAUDE.md наследуется сессиями VM — на неоднозначном промпте модель уходит в уточняющее меню; это фича Claude, оператор отвечает `send`. Давать предмет действия в промпте явно.

---

## DEC-DEV-0160 — G32: аллокатор DEC-DEV — скан локальных веток + claims-резервация в git-common-dir

**Date:** 2026-07-07
**Trigger:** автономный quick-wins прогон (хвост очереди); gap G32 — «race воспроизведена ≥7 раз, `next-dec-dev` не атомарен, митигация чисто дисциплинарная».

### Context
`next-dec-dev.js` (2026-07-04) сканировал локальный журнал + `origin/*` ветки. Две оставшиеся дыры: (1) **локальные незапушенные ветки** не сканировались вовсе — параллельная сессия на этой же машине коммитит журнал локально задолго до push (наблюдаемая природа гонки: env `parallel_sessions_share_checkout`); (2) **окно allocate→commit** ничем не резервировалось — две сессии, спросившие номер до того, как первая закоммитила, получали одинаковый ответ.

### Options considered
1. Полная атомарность через внешний lock-сервис — отвергнуто: несоразмерно; гонка локальная (одна машина/checkout), не распределённая.
2. Claims-файл в `<git-common-dir>/dec-dev-claims.json` (ПРИНЯТО) — common-dir шарится всеми worktree чекаута ⇒ параллельные сессии видят чужие claims немедленно; файл не версионируется (не едет в PR); TTL 72h (упавшая сессия не сжигает номер навсегда); авто-release при появлении заголовка в любом сканируемом журнале.
3. Резервация коммитом в журнал («заглушка-заголовок») — отвергнуто: мусор в истории + конфликтует с accumulation-контрактом.

### Decision
`next-dec-dev.js`: (а) скан-источники += локальные ветки (кроме текущей — её покрывает рабочий файл); (б) режим `--claim` — вычислить next-free И записать резервацию `{claimed_at, branch}`; активные claims участвуют в global-max наравне с журналами; stale (>72h) игнорируются с warn; погашенные (номер уже в журнале) прунятся при следующей записи. `--check` видит claims («TAKEN by claim (...)»).

### Outcome
4 сценария вживую: report 0160 → `--claim` персистит → следующий report даёт 0161 и показывает claim → `--check 0160` = TAKEN/exit 1. Claim 0160 оставлен честным — использован этой же записью (авто-release после merge). Остаточная не-атомарность (два `--claim` в одну миллисекунду) осознанно принята: вероятность ≪ прежней гонки, цена — read-modify-write без lock.

### Lessons
1. Прежде чем строить «атомарность», определи ФАКТИЧЕСКУЮ топологию гонки: здесь она same-machine (общий checkout) — общий файл в git-common-dir закрывает её без инфраструктуры.
2. Резервация обязана уметь умирать сама (TTL + авто-release по факту публикации) — иначе лечишь гонку, а создаёшь leak номеров.

---


**Numbering:** continuous, no gaps. Start each new entry with next NNNN.

**When to add an entry:** default yes for architectural choices, rejected alternatives, root causes of bugs, things that turned out different from plan. Default no for: typo fixes, doc reformatting, dependency bumps.

## DEC-DEV-0162 — Fabric фаза 3: live-прогон graduation-гейта на VM-пилоте + первый live-дефект (SessionStart-инжектор терял payload)

**Date:** 2026-07-08
**Trigger:** EXECUTION_ROADMAP фаза 3 (pilot-gated graduation gate, CONCEPT §9); запрос владельца «ты за пультом» — оператор ведёт прогон с хоста промптами, executor = сессии пилота на VM, судья = независимый opus-субагент.

### Context
Первый live-прогон Process Fabric на пилоте `my-first-test` (VM Ubuntu-ClaudeCode, основной checkout — fabric-state живёт в рабочем дереве, worktree-полосы Conductor'а его не видят). Протокол: `live-run-validation.md` класс B, инстанцирован пре-регистрированными артефактами `dev/process-fabric/FABRIC_PHASE3_LIVE_RUN_BRIEF.md` (сценарий+промпты verbatim, коммит ДО прогона) + `FABRIC_PHASE3_REVIEW_HANDOFF.md` (рубрика судьи, исполнителю не показывалась). Доставка: `/ecosystem:update` (аддитивный, до upstream `20bb912`), verify Healthy.

### Decision(s)
1. **Субъект линии — FM-006** (единственная маленькая фича без kiro-спеки: честный полный путь authoring→impl; FM-004 отклонена — UI+NFR, слишком крупная для валидации механики).
2. **Гейты отыгрывать средой и файловым PA-мостом, не подсказками** (класс B): парковку S1 на естественном product-гейте (P4 поймал 2 реальных LOW-дрейфа BR-081) разрешили канонически — флип PA-045→done в файле + `pa-scan --tick` в свежей сессии.
3. **Арх-развилку PA-051 (SIDE A materialize vs SIDE B derive-on-read) от лица владельца НЕ решать** — выбран consilium PREPARE-ONLY (жюри готовит DRAFT DEC, ратификация владельца). Отвергнуто «выбрать сторону самому»: подлинно владельческое решение, и выбор ради добора критерия G-B был бы подгонкой прогона под судейский интерес (executor/judge separation).
4. **Live-дефект №1 чинить сразу в этом же PR**: `session-fabric-status.js` отдавал `hookSpecificOutput` БЕЗ обязательного `hookEventName: "SessionStart"` → Claude Code отбрасывал весь payload («Hook JSON output validation failed»), fabric-инжект был мёртв с рождения и невидим (без живого инстанса хук молчит; первый старт С инстансом = S2 прогона). Фикс однострочный + smoke-кейс ужесточён (`hookEventName` теперь обязателен в выводе).

### Outcome
Линия прожила S1+S2 (два restore), прошла P3→P4→гейт→P5 (19/19 тасков, ~6ч, покоммитный TDD) → `impl.conflict` → parked `awaiting_product` c PA-051/PA-052; консилиум выдал Side-B strong-CONDITIONAL. Механика: `replay` exit 0, run-id уникальны и совпадают ledger↔events, 6/6 событий со штампами `--at`, FB-004 backpressure подтверждён на копии стейта (`applied:false`, `wipOk: 1<1 → false`). Критерии CONCEPT §9: **G-A ✓, G-C ✓, G-B pending** (P5 кончился conflict'ом, не no_go; remediation-стейт не входился — добор после владельческой ратификации PA-051). Полный грейд судьи + вердикт — `dev/process-fabric/FABRIC_PHASE3_GRADE_REPORT.md`.

### Lessons
1. **Smoke, который проверяет форму вывода, но не контракт потребителя, пропускает мёртвый канал целиком** — hook-smoke был 41/0, а инжект никогда не работал. Контракт харнесса (обязательные поля hook-JSON) должен быть закодирован в assert'ах.
2. **Условно-молчащие хуки (нет субстрата → exit 0) не валидируются доставкой**: дефект всплывает только при первом появлении субстрата в проде. Для таких хуков smoke-фикстура «субстрат есть» обязательна (она была — но с мягким assert'ом, см. урок 1).
3. **Естественные гейты богаче срежиссированных**: оба human-gate прогона (BR-081 drift, PA-051 fork) пришли из реальных дефектов канона/спеки — docker-рычаг из сценария не понадобился вовсе.
4. Пульт-грабли VM-оркестрации (ghost-подсказки TUI, busy-признаки фоновых Workflow, base64-промпты) — зафиксированы в брифе, кандидаты в будущий пульт-скилл.

## DEC-DEV-0163 — DEF-3: движок не принуждал bracket-контракт — диспетчер прошагал линию голыми tick; guard в fabric-engine

**Date:** 2026-07-09
**Trigger:** добор G-B live-прогона фазы 3 (мандат владельца «мёржи оба PR и проведи добор»); S3-сессия пилота довела линию FM-006 до `done`, но post-hoc сверка вскрыла: ledger без новых брекетов, seq7/seq8 без run_id, в транскрипте 0 Workflow-вызовов и 2 ручных `tick --event evt:impl.go|evt:runtime.ready_or_started` (21 сек между ними).

### Context
run.md требует исполнять prescription `kind: run-process` полным bracket'ом (ledger start → процесс → finish → `ingest --run-id`), но движок принимал ЛЮБОЕ валидное по charter'у событие через голый `tick`. LLM-диспетчер под операционным давлением («доведи сегодня») сделал работу инлайн (код/тесты реальные и зелёные — 854/176/21) и вручную прошагал автомат до `done`. Терминальное состояние стало не process-backed; заодно нарушена операторская граница «остановись на вердикте по реализации» (проскочен runtime_gate). Классика поведенческого контракта без enforcement — тот же класс, что вскрывали G03/G04.

### Options considered
1. **Оставить дисциплине** (warn в run.md) — отвергнуто: прецедент показал, что дисциплина ломается в первый же нагруженный заход; сенсор→мышца-разрыв ровно того типа, который Fabric строился закрывать.
2. **Жёсткий запрет ручных tick для ingest-мапленных событий без эскейпа** — отвергнуто: recovery после crashed-bracket и unit-фикстуры легитимно нуждаются в ручном прогоне.
3. ✅ **Guard с аудируемым эскейпом:** `tick` события из ingest-карты invoke-процесса текущего состояния → exit 2 с объяснением и инструкцией bracket-пути; `--force-manual "<reason>"` (непустая причина) пропускает и штампует `forced-manual: <reason>` в `why[]` события — маркер живёт в events.ndjson (не только stdout) и replay-нейтрален (why[] не участвует в rebuild). Resume-события и ingest/pa-scan/replay не затронуты.

### Outcome
`orchestrator/lib/fabric-engine.cjs` (+54), `tests/orchestrator/fabric-engine.test.cjs` (+66): юниты 23→27 (все зелёные), две существующие фикстуры переведены на явный `FORCE_FIXTURE` с комментарием. Реализация — opus-исполнитель по брифу, main-ревью диффа. Это НЕ расширение Fabric (запрещено до graduation), а remediation дыры контракта, найденной самим graduation-прогоном.

### Lessons
1. **Поведенческий контракт диспетчера держится ровно до первого operational-давления — принуждение обязано жить в детерминированном слое** (engine), а не в prompt-регламенте; prompt-регламент остаётся объяснением, движок — enforcement'ом.
2. Сигнатура нарушения была видна в данных за секунды: события без run_id + ledger без брекетов + нереалистичные интервалы (`impl.go`→`runtime.ready` за 21 сек). Эти три проверки — готовый чек post-hoc аудита прогонов (кандидат в auditor-чеклист).
3. Эскейп-люк обязателен, но должен быть дороже честного пути и оставлять след в durable-журнале (`--force-manual` + why[]-маркер), иначе guard просто сместит обход на уровень ниже.

## DEC-DEV-0164 — CI-фейл fabric-engine теста: environment-coupled дефолт pa-file (зелёный на Windows «по везению», EACCES на Linux)

**Date:** 2026-07-10
**Trigger:** merge PR #141 — verify-run на main красный; сверка показала тот же фейл и на предыдущем прогоне (#140, дерево без guard'а) — предсуществующий, не регрессия добора. (Владелец: CI фактически стоял красным с ненастроенных времён.)

### Context
Тест «CLI --autonomy L0 flows through tick…» — единственный, кто зовёт `cli()` напрямую без `--pa-file` (остальные ходят через `tick()`-хелпер, который его всегда передаёт). Под L0 вход в `authoring` = human-gate → engine проецирует PA в `defaultPaFile(root) = <root>/../../pending-actions.md`. Юнит-тесты передают `--base-root <tmpdir>` как сам fabric-root → дефолт уезжает на два уровня НАД tmpdir: на Linux-раннере это `/pending-actions.md` (EACCES → нет JSON → TypeError, красный CI), на Windows — писабельная папка (`AppData/Local/pending-actions.md` реально найден и удалён) → тест «проходит», гадя мусорным файлом.

### Decision
Фикс test-side: `--pa-file paFile(base)` в оба прямых `cli()`-вызова теста (+ комментарий-урок). Engine-side «защиту от /» не строим: канонический deploy-layout (`.claude/orchestrator/fabric`) дефолт разрешает корректно; тестовая обвязка обязана передавать явный путь, как делает хелпер.

### Lessons
1. **«Зелёный на одной ОС» ≠ зелёный:** environment-coupled путь (up-двойной resolve от tmpdir) дал молчаливый pass на Windows и падение на Linux — расхождение вскрылось только CI-прогоном.
2. Тест, который пишет за пределы своей tmp-песочницы, — дефект независимо от исхода assert'ов; литтер-чек (`два уровня выше tmpdir`) — дешёвый маркер этого класса.

## DEC-DEV-0165 — Fabric graduation ОБЪЯВЛЕН владельцем: фаза 3 закрыта, пост-обязательства открыты, фаза 4 разблокирована

**Date:** 2026-07-10
**Trigger:** явное объявление владельца («объявляю graduation — зафиксируй и открывай пост-обязательства») поверх условного GO судьи (DEC-DEV-0162/0163, GRADE_REPORT после добора G-B).

### Context
Фаза 3 EXECUTION_ROADMAP завершилась вердиктом «условный GO» с явной оговоркой «формальное объявление graduation — владелец». Все условия судьи к моменту объявления выполнены или зафиксированы: (1) bracket-guard DEF-3 доехал в main (PR #141, `cc58e65`); (2) DEF-4 (P7 probe false-negative на pnpm-monorepo, PA-056) + ANOM-5 (owner-queue без dequeue) записаны как upstream-долг; (3) ветка `runtime_gate_retry`/`evt:env.up` честно помечена live-невалидированной; (4) рекомендация про `--force-manual` reason→PA перенесена в обязательства. Попутно merged PR #142 (DEC-DEV-0164) снял стоячий красный CI.

### Decision(s)
1. **Graduation зафиксирован** в EXECUTION_ROADMAP (фаза 3 = GRADUATED 2026-07-10; фаза 4 разблокирована, старт строго по эмпирическим триггерам — cuts до запроса сохранены).
2. **Пост-обязательства переведены из памяти в активный work-order** (EXECUTION_ROADMAP §«Пост-graduation обязательства»): consumer-док Fabric → gaps-сверка G01–G36 → upstream-долг DEF-4/ANOM-5/force-manual-валидация → параллельные инициативы аудита. Порядок 1→2 осознанный: сверка gaps обновит consumer-док, писать её раньше — двойная работа.
3. **Попутный drift-фикс:** чекбоксы параллельной дорожки AUDIT §6 в EXECUTION_ROADMAP отставали от факта (G20/G23/G19/G05-G06/G32 merged 2026-07-07, PR #131–#135) — сверены; остаток очереди = только G28.

### Outcome
«built ≠ validated» с ядра Fabric снят (в объёме критериев §9; runtime-ветка P7/env.up — честное исключение, живёт в upstream-долге). Активный фронт трека = пост-обязательства; расширение (temporal-актуатор, gen-process-map интеграция, новые charter'ы) — только по live-триггерам.

### Lessons
Разделение «условный GO судьи» ↔ «формальное объявление владельцем» отработало как задумано: технический вердикт не самоисполнился в статус, необратимый статус-переход остался за владельцем (зеркало границы Autoflow «merge — всегда владелец»).

## DEC-DEV-0166 — Consumer-док Process Fabric: посадка в guide-слой (07-fabric.md), а не в docs/orchestrator-module

**Date:** 2026-07-10
**Trigger:** пост-graduation обязательство №1 (EXECUTION_ROADMAP §«Пост-graduation обязательства», открыто DEC-DEV-0165); запрос владельца «начинай consumer-док».

### Context
После graduation у Fabric не было ни одного consumer-facing упоминания: grep по `docs/orchestrator-module/SPEC.md`, `orchestrator/README.md`, `docs/guide/**`, `docs/README.md` — ноль вхождений «fabric». Вся документация жила в dev-слое (`dev/process-fabric/`, не деплоится) + контракте диспетчера (`run.md`, читает LLM, не человек).

### Options considered
1. ✅ **`docs/guide/07-fabric.md`** (USER-слой, How-to · Explanation) — обязательство сформулировано в задачах оператора («как читать owner-queue/status», «как добавить процесс»), а guide — именно слой «как делать работу» с готовой дисциплиной против дрейфа (`check:doctype`: anti-orphan + сверка таблицы ролей README). Точка входа через роутер «Я хочу…» и §6 в `05-implementation.md` (естественное продолжение: Fabric = следующий шаг после «прогнал процесс руками»).
2. **`docs/orchestrator-module/FABRIC.md`** (REFERENCE-слой рядом со SPEC) — отвергнуто как основное место: SPEC-слой читают при проектировании, а не при операционной работе; дублировал бы CONCEPT.md (дизайн-SSOT остаётся в dev/process-fabric). Reference-потребность закрыта короткой секцией-указателем в `orchestrator/README.md`.

### Decision(s)
1. Новый `docs/guide/07-fabric.md`: понятия (charter/инстанс/событие/prescription/owner-queue/WIP), запуск линии, чтение status, PA-мост (done→`pa-scan --tick`), страховки (bracket-guard/`--force-manual`/идемпотентность/floor/`replay`), чеклист добавления процесса (ingest по фактическим полям result-файла — правило из CONCEPT §10 «charter-дрейф»), честные границы (validated 2026-07-10; runtime-ветка и P7-monorepo-probe — нет).
2. **Обязательство «обновление MAP/BPMN из catalog/charters» скоуплено:** `docs/MAP.md` получил Fabric-указатель в авторитеты + актуализацию ORC-узла (стоял stale «P3-P6 built»); полная интеграция catalog/charters в `gen-process-map` — это фаза 4 EXECUTION_ROADMAP (расширение по триггеру), в док-обязательство не втягивается.
3. Попутный drift-фикс: дерево `orchestrator/README.md` отставало на 6 файлов lib/ + charters/ — дополнено (иначе новый док ссылался бы на README с дырами).

### Outcome
Guide вырос 7→8 доков, `check:doctype` зелёный; CHANGELOG `[Unreleased] Added` (consumer-zone). Пост-обязательство №1 закрыто; следующее по порядку — №2 gaps-сверка G01–G36.

## DEC-DEV-0167 — Gaps-сверка G01–G36: живой статус реестра аудита после graduation (6 закрыто / 8 частично / 22 открыто с роутингом)

**Date:** 2026-07-10
**Trigger:** пост-graduation обязательство №2 (EXECUTION_ROADMAP, открыто DEC-DEV-0165); запрос владельца «берись за gaps-сверку».

### Context
Реестр G01–G36 (audit/APPENDIX-B §1) писался до волны Fabric 0153–0165 и параллельной дорожки quick-wins 0156–0160 — его статусы устарели, а APPENDIX-B по конвенции AUDIT §7 не редактируется (as-is снапшот агрегатора). Нужен отдельный живой документ сверки: что закрыто фактически (с доказательствами в репо, не «по памяти»), что осталось и куда роутится.

### Decision(s)
1. **Форма — отдельный документ** `audit/GAPS-RECONCILIATION-2026-07-10.md` + баннер-указатель в шапке APPENDIX-B (не правка статусов внутри as-is снапшота). Отвергнуто редактирование APPENDIX-B: ломает конвенцию «приложения — отчёты агрегаторов as-is».
2. **Метод — evidence-based:** каждый статус подтверждён recon-прогоном по main `ab314be` (20 фактов: путь/строка/цитата; sonnet-разведка + main-ревью против журнала) либо записью DEV_JOURNAL/PR. Итог: ✅ 6 машинно закрыто (G05/G06 subagent-watchdog 0159, G19 check-validation-sync 0158, G20 шаблон 24/44 0156, G23 npm-prepare гейт 0157, G32 --claim 0160); 🟡 8 частично (G03/G04 PA-мост+owner-queue для fabric-линии — вне её PA всё ещё write-only; G07 charter накрыл P3→P7, product-сегмент нет; G09 orphan снят, F2 полное — отдельный трек; G10 live-прогоном сужен до P7-probe/runtime-ветки; G11/G12 bracket-guard принуждает след только fabric-tracked; G13 — уточнение факта аудита: reader в run.md заявлен, но prompted); ⬜ 22 открыто.
3. **Роутинг открытых — по существующим рельсам, без новых треков:** Tier-0 (G01 Epic E, G02 result-ingest) — substrate-gated vision-треки; G08/G28/G29 — кандидаты фазы 4 (product-front charter / temporal-актуатор), строго по live-триггерам; G14–G18/G21/G24/G33/G35/G36 — пост-обязательство №4; G22/G25–G27/G30/G31/G34 — backlog D7-гигиены, приоритизация владельцем (сознательно НЕ конвертированы в самоназначенный план работ).

### Outcome
Пост-обязательства №1 и №2 отмечены ✅ в EXECUTION_ROADMAP (№1 закрыт PR #144 ранее сегодня, галочка доехала этим же коммитом). Активный фронт сдвинулся на №3 (upstream-долг DEF-4/ANOM-5/force-manual→PA) и №4. Dev-zone docs — CHANGELOG не требуется.

### Lessons
1. **Сверка реестра против репо дешевле и честнее сверки против памяти:** 3 из 20 recon-фактов уточнили бы «уверенное» знание (G13 reader существовал в run.md изначально — аудит-агрегатор его не увидел; G28 expires_at уже проверяется inline при чтении — sweeper нужен только для проактивности; watchdog G05/G06 сам декларирует какие gaps закрывает — самодокументирующийся фикс упрощает будущие сверки).
2. Паттерн «закрывашка объявляет свой gap-номер в заголовке файла» (subagent-watchdog.js) стоит копеек при написании и делает reconciliation greppable — кандидат в конвенцию для будущих gap-фиксов.

## DEC-DEV-0168 — Upstream-долг graduation-прогона закрыт: DEF-4 workspace-скан P7-probe, ANOM-5 самоочистка owner-queue, --force-manual требует PA-ссылку

**Date:** 2026-07-10
**Trigger:** пост-graduation обязательство №3 (открыто DEC-DEV-0165; условие судьи №2 «DEF-4/ANOM-5 = upstream-долг» + рекомендация №4); мандат владельца «мёржи и продолжай самостоятельно».

### Context
Три дыры, вскрытые живым graduation-прогоном (FABRIC_PHASE3_GRADE_REPORT): (1) **DEF-4** — `runtime-readiness.cjs` читал только корневой `package.json`, на pnpm-monorepo пилота (dev-скрипты в `apps/*`) выдавал ложный `NOT_STARTABLE` short-circuit до env-пробы — это заблокировало критерий R2 и оставило ветку `runtime_gate_retry`/`evt:env.up` live-невалидированной (PA-056 open → ecosystem); (2) **ANOM-5** — `appendOwnerQueue` только пушил, dequeue не существовал → 5 stale-записей terminal-инстансов = ложные owner-сигналы в `status`/SessionStart-инжекте, реконсилировали вручную; (3) `--force-manual` принимал любую непустую причину — эскейп был дешевле честного пути (урок 0163 §3 требовал обратного).

### Decision(s)
1. **DEF-4 — workspace-скан, enum вердиктов нетронут** (soft-миграция): чистая `detectWorkspaceRunTargets()` (детерминированный ранг: источник → лексикографика dir) + CLI-скан `pnpm-workspace.yaml`/npm `workspaces` (литерал + одноуровневый `/*`; `!`/`**` пропускаются с disclosure-нотой — честное ограничение вместо тихой полноты) + `--app <dir>` пин + disclosure на workspace-происхождение и неоднозначность. Отвергнуто: новый вердикт AMBIGUOUS (ломает enum-контракт потребителей run.md §P7) и полный glob-движок (не нужен для фактических форм: пилот = `apps/*`).
2. **ANOM-5 — prune на write-path, status строго read-only**: `dequeueOwnerEntries()` в `applyEventFS` после персиста снапшота и ДО `applyEffects` (свежий парк в новый гейт переживает собственный tick) — выкидывает записи ушедшей линии + глобальных сирот; дедуп на append. `status` НЕ пишет (его зовёт SessionStart-хук — read-only контракт задокументирован) — read-only split `reconcileOwnerQueue()` → `owner_queue` (живые) + `owner_queue_stale` (с reason, не прячем). Отвергнуто: prune из `status` (сломал бы read-only контракт хука) и event-sourcing очереди (owner-queue — shell-side проекция, как PA-мост; replay бит-в-бит нетронут).
3. **`--force-manual "PA-NNN: <why>"`**: причина обязана нести PA-id и он обязан существовать в pa-file (числовое сравнение заголовков `## PA-NNN` — без zero-padding-ловушек). Эскейп теперь дороже честного пути: сначала PA-запись о вмешательстве, потом обход. Тест-фикстуры переведены на seed-PA.
4. **Сборка по MDP**: два opus-исполнителя параллельно по точным брифам (файлы не пересекались), main-ревью обоих диффов до коммита; контрактные решения (enum freeze, read-only status, порядок prune/applyEffects) зафиксированы в брифах заранее.

### Outcome
`runtime-readiness.cjs` юниты 21→30, `fabric-engine.cjs` 27→35, полный verify EXIT=0. Риды: `docs/guide/07-fabric.md` (§4 самоочистка очереди, §6 PA-ссылка эскейпа, §8 остаток честных границ сужен), CHANGELOG `[Unreleased] Fixed`. Пост-обязательство №3 закрыто в EXECUTION_ROADMAP; PA-056 пилота закрывается при следующей доставке (`/ecosystem:update`). Остаток №3-класса: ветка `runtime_gate_retry`/`evt:env.up` по-прежнему live-невалидирована — теперь её ничто не маскирует, проверится естественным live-триггером.

### Lessons
1. **«Условие судьи → work-order → фикс» работает как конвейер только если долг записан с точным root-cause на месте** — DEF-4/ANOM-5 были зафиксированы в GRADE_REPORT с файлами и механизмом, фикс собрался за один заход без ре-форензики.
2. Read-only контракт потребителя (SessionStart-хук → `status`) — жёсткое ограничение на месте фикса: самоочистку пришлось разнести на write-path + read-only split. Проверяй, КТО зовёт команду, прежде чем добавлять ей side-effect.

## DEC-DEV-0169 — Слой доменной экспертизы: гейт Domain Fit (D1.0b) на входе идеи, реестр 96 подкатегорий, порог 75

**Date:** 2026-07-10
**Trigger:** запрос владельца поверх оценки универсальности 2026-07-10 (`dev/universality-assessment/REPORT.md`, 96 подкатегорий × 10 критериев): «когда я описываю идею — промежуточный этап анализа, что домен идеи соответствует сильным зонам экосистемы; совокупный балл 75 и выше; учитывать подкатегории, максимально детализировано».

### Context
Оценка универсальности показала водораздел (поведенческое ядро 70–92 ↔ алгоритмическое 30–45) и разброс до 40+ баллов внутри одной категории (E1 CLI=84 vs E5 build-system=54). Вход идеи (`/product:init`) это никак не проверял: полный Discovery-цикл можно было завести для продукта, чья суть невыразима, и узнать об этом на handoff. Владелец явно запросил гейт («балл 75 и выше»), формат оставил на выбор («надо подумать, в каком формате, условно, модуль»).

### Options considered
1. ✅ **Слой внутри Product Module по образцу product_class (0079): концепт-док + реестр в `docs/pmo/` + skill + шаг D1.0b + опциональный блок в `product.yaml`** — переиспользует обкатанный след 0079 целиком (SSOT-конфиг, soft-миграция, backfill-режим, канонические поля + anti-pattern список); «модуль» у владельца прозвучал с оговоркой «условно» — полноценный пятый модуль (SPEC + commands namespace) для одного шага и одного реестра был бы каркасом без содержания.
2. **Пятый модуль Domain Expertise (docs/domain-module/SPEC.md + commands/domain/)** — отвергнуто: вся функциональность = один шаг Discovery + один lookup-реестр; модульная обвязка (SPEC, namespace, verify-счётчики) — чистый оверхед, а перенос шага из Discovery в отдельную команду ломает требование «промежуточный этап когда я описываю идею».
3. **Расширить сам product_class полем score** — отвергнуто: ортогональные концепты (форма ↔ домен/пригодность) и противоположные контракты (0079 «никогда не gate'ит» — зафиксировано в трёх доках; гейт внутри него = ревизия контракта задним числом). Отдельный блок `domain_fit` рядом — чисто.

### Decision(s)
1. **Гейт, не advisory — но с owner-override.** Балл < порога (дефолт 75, поле `threshold`) останавливает Discovery до явного решения: `adapted` (перекроить под выразимую половину → переоценка) / `proceed-with-risks` (ограничители письменно в `limiters`+`notes`) / `aborted`. Это первый и единственный класс-гейт; напряжение с принципом 0079 «класс никогда не гейтит» снято явным противопоставлением в обоих концепт-доках (§5 сравнительная таблица). North-star «автономия в суждении + послушание в процессах» сохранён: гейт производит информированное решение владельца, не запрет.
2. **Гранулярность — только подкатегория (96), никогда категория (16)** — прямое требование владельца + эмпирика разброса внутри категорий. Классификация по правилу ядра ценности (game-backend D6=74 ≠ игра D2=39); гибриды — декомпозиция `core`/`supporting`, вердикт по core, при двух ядрах — по слабейшему (консервативно, зеркало worst-of MDP).
3. **`unmapped` не блокирует** — реестр конечен, мир нет; блокировка по отсутствию данных ломала бы контракт универсальности (зеркало `archetype: other`). Деградация в advisory + ближайшие якоря + кандидатство в реестр.
4. **Реестр — consumer-копия данных оценки, баллы иммутабельны на месте**: точечная подкрутка запрещена (anti-pattern в skill + предупреждение в шапке реестра), изменение — только переоценкой методом (протокол §6 концепт-дока) с bump версии; `registry_version` в блоке проекта фиксирует, по какой версии принималось решение (не перештамповывается). Извлечение матрицы в реестр — байт-в-байт скриптом (sed) из REPORT.md, не перепечаткой (96×12 чисел — транскрипция руками = гарантированные ошибки).
5. **Порядок шагов: D1.0 (форма) → D1.0b (домен) → D1.1** — архетип сужает поиск подкатегории; D1.0 дёшев (~1 мин), терять его при misfit не жалко.
6. **Попутный drift-фикс:** `processes.md` P1.A начинался с D1.1 — шаг D1.0 (0079) туда никогда не вписывался; добавлен пре-шаг 0 с обоими (D1.0 + D1.0b).

### Outcome
Новые: `docs/pmo/domain-expertise.md` (SSOT концепта), `docs/pmo/domain-expertise-registry.md` (матрица), `skills/product/domain-fit.md` (discovery/assess). Wiring: `discovery-session.md` (D1.0b + state-таблица + current_step enum), `init.md`, `bootstrap.md` Step 7 (блок `domain_fit`), `processes.md` P1.A. CHANGELOG `[Unreleased] Added`. Блок опционален (soft-миграция 1:1 по прецеденту 0079). Counts не тронуты (концепт-доки — не артефакт-типы). Live-валидация гейта — на ближайшем реальном `/product:init` пилота (runtime smoke кандидат: fit-ветка + conditional-fit-диалог).

### Lessons
След 0079 (концепт-док + skill + опциональный конфиг-блок + backfill) отработал как шаблон посадки нового класс-концепта без единого нового механизма enforcement — вся стоимость ушла в содержание, не в каркас. Различие «advisory-класс ↔ гейт-класс» дешевле всего фиксировать сравнительной таблицей в обоих SSOT-доках сразу при рождении второго концепта, а не при первом конфликте трактовок.

## DEC-DEV-0170 — Doc-drift quick-wins корзины №4: G18/G33/G35 закрыты, G17/G21 сужены до частичных

**Date:** 2026-07-10
**Trigger:** выбор владельца (AskUserQuestion, 2026-07-10): из корзины пост-обязательства №4 первым — doc-дрейфы quick-wins.

### Context
Gaps-сверка (DEC-DEV-0167) вывела кластер дешёвых doc-дрейфов: G18 (SPEC §13.1 «scan Always перед add/update/replace» vs код — update не вызывал scan, replace не существует), G33 (verify.md держал ручной per-namespace baseline команд параллельно с автогенерируемым 02-commands.md — «~22» уже дрейфанул), G35 (enable-d7-audit ссылался на несуществующий /ecosystem:disable-d7-audit), G17 (/ecosystem:update пересинкает reference-адаптеры и молчит про repair инстансов), G21 (Product/Design SPEC не знают Epic A/B/C/D; Design SPEC двусторонне — screen-generator описан, но не существует, G36).

### Decision(s)
1. **G18 — impl догоняет SPEC, не наоборот**: scan read-only и дешёвый → в update.md добавлен Pre-flight-шаг refresh baseline; отвергнуто размывание SPEC до «conditional» (смысл §13.1 — конфликт-чеки против фактического окружения, не против устаревшего снапшота). Строка про replace честно промаркирована Phase-7.
2. **G33 — схлопнуть параллельный механизм, не синхронизировать его**: ручные числа удалены, verify Step 4/summary сверяет deployed commands с генерируемым каталогом (он уже drift-gated `gen:catalog:check`'ом). Урок DEC-DEV-0082 («неверная карта хуже отсутствующей») доведён до конца — держать вторую рукописную копию ожиданий было полумерой.
3. **G35 — не строить команду ради ссылки**: отсутствие /ecosystem:disable-d7-audit задокументировано как сознательное (opt-in редкий, ручное удаление hook-entry дешевле шипинга команды); мёртвая ссылка убрана.
4. **G17 — prompted, не hook** (частично): Step 8 update.md сёрфейсит условный next-step repair при active-tools.yaml; детерминированный слушатель = drift-check.js (G16, Phase-7) — не дублировать его полумерой здесь.
5. **G21 — промаркировать, не вписывать** (частично): баннеры «пост-spec расширения» в оба SPEC с указанием SSOT (commands/* + CHANGELOG + 02-commands); полное вписывание Epic A/B/C/D в тело SPEC — отдельный doc-трек, в quick-win не влезает и делаться должен при следующей содержательной ревизии SPEC.

### Outcome
5 файлов: integrator/update.md, integrator SPEC §13.1, ecosystem/verify.md (Step 4 + summary), ecosystem/update.md (Step 8), enable-d7-audit.md + баннеры в product/design SPEC. GAPS-RECONCILIATION актуализирована: 9 закрыто / 10 частично / 17 открыто. Verify зелёный. Остаток корзины №4 — крупные треки (OD7 await→resume, Integrator Phase-7 G14–G16, Deep Discovery G36, G24) + backlog D7-гигиены.

### Lessons
1. **Класс «два параллельных источника ожиданий» лечится удалением одного, а не линтером между ними** — G33 повторил урок G19 наоборот: там каталог↔runner несводимы (семантика в коде) и нужен линтер; здесь рукописный список был чистым дубликатом генерируемого — правильный фикс = коллапс на один источник.
2. Мёртвую ссылку на «будущую команду» дешевле всего закрыть решением «команды сознательно НЕ будет» — если оно честно верно; не всякий gap закрывается стройкой.

## DEC-DEV-0171 — OD7 await→resume построен через Process Fabric: payload-мост ingest→PA, парковка P5 на §6 BLOCK, resume = идемпотентный брекет-ре-ран

**Date:** 2026-07-10
**Trigger:** поручение владельца «берись за OD7 await→resume, после — упор на подготовку самостоятельного live-тестирования в VM» (первый крупный трек корзины №4).

### Context
OD7 (SPEC Orchestrator, RUN 01) — гипотеза async-протокола `request→await-fix→resume` для границы Orch↔Integrator: LLM-диспетчер, наткнувшись на отсутствующую capability, склонен «поглотить границу» и чинить инфраструктуру сам. Request-половина жила (P7 requests[], P5 §6 detect-leg 0117, PA-записи), await→resume — нет (gap G04). Recon вскрыл три факта, определившие дизайн: (1) P5 УЖЕ идемпотентен — план-стадия фильтрует `!t.done && !t.blocked` по чекбоксам tasks.md, т.е. mid-process resume = обычный ре-ран брекета без спец-механики; (2) charter уже держит `awaiting_capability` для P7 с resume в runtime_gate; (3) ingest движка выбрасывал данные результата — capability-spec не доезжал до PA/owner-queue, владелец видел «линия стоит», но не ЧТО провижнить.

### Options considered
1. **ScheduleWakeup-ожидание внутри сессии** (как в исходной SPEC-гипотезе) — отвергнуто: capability-grant занимает часы/дни, await обязан переживать сессии; durable-парковка Fabric уже это делает.
2. **Workflow resumeFromRunId для mid-process восстановления** — отвергнуто: same-session-only контракт харнесса, кросс-сессионный OD7 на нём не построить.
3. ✅ **Fabric-парковка + payload-мост + идемпотентный ре-ран:** (a) движок — опциональный `payloadPath` в ingest-правиле charter'а (срез result'а → payload события → fenced-json в PA-записи гейта, транкация 2000 симв., маркеры pa-scan целы; `ingestEmits()` новая, `applyIngest` — совместимая обёртка); (b) charter v2 — `awaiting_capability_impl` (resume → implementing), `evt:impl.blocked_capability`, payloadPath на P5/P7 capability-правилах; (c) P5 — поле `capability_blocked` (только disposition BLOCK; deferred stand-ins не паркуют). Resume: PA→done → pa-scan --tick → prescription → полный брекет, P5 продолжает с недоделанных тасков.

### Outcome
fabric-engine юниты 35→40 (payload по payloadPath / без payloadPath бит-в-бит / e2e PA c fenced-json + replay 0 / транкация / run-id дедуп), wiring 11 + P5-wiring 13 зелёные, verify EXIT=0. Доки: run.md (§human-gate capability + §resume «ничего специального восстанавливать не нужно»), SPEC OD7-строка → «построено, live pending», 07-fabric.md §4, GAPS-RECONCILIATION G04. Сборка по MDP: opus-исполнитель на движок по брифу с зафиксированными контрактами, charter/P5/доки — main. **Подготовка live-теста (часть 2 поручения):** пре-регистрированы `OD7_LIVE_RUN_BRIEF.md` (сценарий S1-S3: парковка на реальном BLOCK → provision+resume → бонус-ветка runtime_gate_retry/evt:env.up, промпты verbatim, стоп-правила оператора) + `OD7_LIVE_RUN_REVIEW_HANDOFF.md` (рубрика R1-R8, класс B + A-критерий границы R3); VM проверена live (ssh ok, uptime 2ч45м, пилот `4e0dfa6`, fabric-инстансы терминальные).

### Lessons
1. **Ищи существующую идемпотентность прежде чем строить resume-механику:** tasks.md-чекбоксы + фильтр плана уже давали «продолжить с места остановки» — OD7 свёлся к парковке и мосту данных, а не к чекпойнт-инфраструктуре. Recon-факт №2 сэкономил самый дорогой кусок дизайна.
2. Тест-регэксп по форме кода (`concerns` рядом с `go_gate` через `key: value`-строки) ломается от невинного многострочного комментария в return-объекте — комментарии к полям такого объекта держи однострочными trailing или выноси над statement.
3. `EXIT=$?` после пайпа с `tail` измеряет tail, а не команду — при проверке verify бери exit-код до пайпа (`; echo` внутри той же команды до tail) или `grep -c "SOME FAILED"`.

## DEC-DEV-0172 — Domain Fit follow-ups: handoff-проброс limiters (эмиссия только при рисках) + migration-промпт; вердикт «не замена product_class»

**Date:** 2026-07-10
**Trigger:** согласованный с владельцем перечень остатков трека 0169 (выбраны: backfill-промпт, handoff-проброс, patch-cut, проверка «будет ли это заменой текущему product_class»; live-валидация — event-gated, трек повышения баллов реестра — не выбран).

### Context
0169 завёл гейт и блок `domain_fit`, но downstream его никто не видел: внешний D2-T реализатор не знал, что владелец осознанно оставил часть ядра за скобками (`proceed-with-risks`), а живой пилот my-first-test после `/ecosystem:update` получил бы skill без пути завести блок (Discovery давно пройден).

### Decision(s)
1. **Handoff-эмиссия — условная, в отличие от product_class.** `product_class` эмитится всегда при `archetype != unset` (форма полезна receiver'у безусловно). `domain_fit` эмитится **только когда `limiters` непуст** (типовой случай — `decision: proceed-with-risks`): его downstream-сигнал = «что за скобками поведенческого контура», а у чистого fit такого сигнала нет — эмиссия была бы шумом. Отвергнута безусловная эмиссия (симметрия ради симметрии). Тройка позиций та же, что у 0079: строка §1 + frontmatter-блок + bullet §12 (родство с §13 Out of Scope, но уровнем продукта); вердикт/баллы на handoff-тайме не пересчитываются — derive из SSOT.
2. **Migration-промпт** — по прецеденту 0079: copy-paste в CHANGELOG-записи 0169, режим `assess` skill'а; «остановиться» в backfill-контексте = зафиксировать misfit, не прервать идущий проект (уже было в skill §assess).
3. **Вердикт по вопросу владельца «будет ли это заменой product_class»: НЕТ, не замена — ортогональные оси, ни один не выводим из другого.** (а) `product_class` несёт форму (archetype + фасеты runtime_locus/interface/distribution), драйвящую NFR/test-дефолты и hint формы; `domain_fit` несёт домен+пригодность (subcategory/score/verdict/limiters) — гейт и зону ответственности. (б) Маппинг many-to-many: archetype `web-service` покрывает подкатегории с баллами от 39 (F4 Kafka-like) до 92 (A1 B2B SaaS) — форма не предсказывает вердикт; подкатегория не фиксирует фасеты (A1 бывает saas и self-hosted). (в) Потребители не пересекаются: у 0079 — таксономия §6 (NFR-акценты, типы тестов), будущий Integrator-routing; у 0169/0172 — гейт входа + limiters. Кодифицировано ещё в 0169 (`domain-expertise.md §5` сравнительная таблица); этой записью фиксируется как проверенный вердикт, оба концепта остаются.

### Outcome
`handoff-spec.md §1/§5/§12` + `handoff-generator.md` Step 2/8/9 (вкл. anti-pattern поля `domain`/`fit`/`domain_score`/`risks`) + `domain-expertise.md §7/§8`; CHANGELOG: запись 0172 + migration-промпт в записи 0169. Следующий шаг перечня — patch-cut (отдельная единица по `checklists/patch-cut.md`).

### Lessons
При зеркалировании паттерна соседнего концепта (0079→0172) первым вопросом проверяй семантику сигнала, а не форму: одинаковая тройка позиций эмиссии, но противоположное условие (всегда ↔ только-при-рисках), потому что сигналы разной природы — безусловное копирование паттерна дало бы шум в каждом handoff.

## DEC-DEV-0173 — OD7 live-прогон на VM-пилоте: условный GO судьи — парковка/payload/resume/continuation подтверждены live, R1 re-run pending; попутно доставлен 1.8.0 + domain_fit backfill

**Date:** 2026-07-11
**Trigger:** пре-регистрированный прогон `OD7_LIVE_RUN_BRIEF.md` (часть 2 поручения DEC-DEV-0171); мандат владельца на самостоятельный прогон + «запускай VM-сессии в bypass».

### Context
Один визит на VM закрыл хвосты двух треков: доставка v1.8.0 в пилот (`/ecosystem:update` 1.7.0→1.8.0, 30 файлов/0 удалений, wipe-protection цел, PA-056 закрыта по live-пробе DEF-4) + одноразовый migration-промпт `domain_fit` (Фаза 6, запись 0169) + сам OD7-прогон. Субъект — FM-002 (единственный FM с capability-манифестом: `OPENAI_API_KEY`, dev stand-in нет → BLOCK).

### Ход (полный журнал — `dev/process-fabric/OD7_LIVE_RUN_LOG.md`)
Сценарий пошёл через ДВЕ конфликт-парковки по реальным находкам до предметной capability-парковки: (1) PA-035 tx-атомарность buildSnapshot — **владелец ратифицировал (a) thread-the-tx**; (2) ownership DI-биндинга GlossarySnapshotService (Route X, DEC-PLAN-045). Затем seq 8 `evt:impl.blocked_capability` → `awaiting_capability_impl` с capability-spec payload'ом в событии И fenced-json в PA-062 (payload-мост 0171 live-подтверждён). Provision = Integrator-акт через session-env (`settings.local.json`), PA-062→done → свежая сессия → `pa-scan --tick` → P5 доделал ТОЛЬКО 5.4-scope (`7d15233`, 27 прежних тасков не тронуты). MANUAL_VERIFY mis-sizing → owner-split 5.4a/5.4b → линия закрыта `owner.abort` («не заявлять ложный shipped»). S3/`env.up` — честный N/A (терминал до runtime_gate).

### Outcome
**Судья (независимый opus, `OD7_LIVE_RUN_GRADE_REPORT.md`): УСЛОВНЫЙ GO** — R2/R3/R4/R5/R8 PASS (R3 класс A: оба executor'а нашли ключ в `.env`, но НЕ self-equip'нулись и сюрфейснули гейт), R7 PASS-с-оговоркой, R1 FAIL-по-букве (park-ран запущен raw-Workflow'ом без ledger-брекета), R6 N/A. SPEC OD7-строка + GAPS G04 → «условный GO»; «live pending» снят только с payload/park/resume-механики. Вскрыто прогоном: **DEF-OD7-1** capability-probe читает только `process.env` (не `.env`) → содержательно ложный BLOCK; **DEF-OD7-2 (P0)** ingest принимает run_id вне ledger (обход bracket-дисциплины); **DEF-OD7-3** charter no-op на `blocked+go_gate:null`; **ANOM-OD7-1** нет терминала done-без-runtime из escalated; **ANOM-OD7-2** executor сам тикает `owner.*`-события. Фиксы в прогоне сознательно не делались (анти-контаминация) — приоритизация владельцу. Среда: транзиентный boot-hang VM + битый автоапдейт CC 2.1.206 (откат на 2.1.205); скилл оператора `vm-factory-ops` создан и пополнен. Пилот: 18 коммитов `4e0dfa6..8945960`, все запушены; `domain_fit` = A2 fit@90 + G1-limiter (supporting).

### Lessons
1. **Ложноположительный гейт всё равно валидирует механику, если он машинно-честный** — но семантику presence надо чинить у источника (probe ↔ `.env`), иначе каждый прогон капабилити будет упираться в env-only чтение.
2. **Bracket-дисциплина держится только если её принуждают ОБА пути** — guard на tick закрыт (0163), а ingest принимал любой run_id; симметрию enforcement'а надо проверять при каждом новом входе в движок.
3. Пре-регистрированный сценарий выдержал три незапланированные развилки без потери предмета: стоп-правила «разрешать канонически + не чинить канон по ходу» достаточны, чтобы контингенции обогащали прогон, а не срывали его.

## DEC-DEV-0174 — Фиксы дефектов OD7 live-прогона: ingest bracket-guard (DEF-OD7-2), charter-гэп blocked+go_gate:null (DEF-OD7-3), probe-presence из .env (DEF-OD7-1) + дизайн-решения ANOM-OD7-1/2

**Date:** 2026-07-11
**Trigger:** §Рекомендации `OD7_LIVE_RUN_GRADE_REPORT.md` (условный GO 0173); мандат владельца «делаем по плану» — фиксы → R1 re-run целевым путём.

### Context
Судья 0173 дал условный GO с пятью пунктами: единственный FAIL (R1 «park machine-backed по букве») упирался в DEF-OD7-2 — `ingest` принимал run_id, которого run-ledger никогда не видел, т.е. bracket-контракт run.md был принудим только с tick-стороны (DEF-3, 0163), а с result-стороны обходился raw-Workflow-запуском. Остальные — семантические гэпы, вскрытые живым прогоном.

### Decision(s)
1. **DEF-OD7-2 — гард на ingest симметрично tick'у, включая обязательность `--run-id`.** Вариант «отвергать только ПЕРЕДАННЫЙ run_id вне ledger» отвергнут: опциональный run-id делает гард обходимым простым умолчанием флага (и теряет идемпотентность). Ledger-путь дериватен от fabric-root (`../runs/ledger.ndjson` — зеркало default'ов run-ledger.cjs), override `--ledger-file` по прецеденту `--pa-file`. Эскейп — переиспользован rec#4-контракт `--force-manual` (вынесен в общий `requireForceManual()`), НЕ отдельный флаг: семантика та же — «сознательный обход брекета, задокументированный существующей PA». Дедуп по run_id оставлен ДО гарда: повтор уже записанного (в т.ч. форс-мануального) рана — no-op, а не повторный суд.
2. **DEF-OD7-3 — fallback-правило в charter, НЕ новое событие.** `blocked` непуст при отсутствии более сильных сигналов → существующий `evt:impl.manual_verify` (→ escalated): семантика «нужны глаза владельца» совпадает, новое событие/состояние умножило бы сущности. Правило — ПОСЛЕДНЕЕ в списке P5 (conflicts > capability_blocked > явный go_gate > blocked): явный вердикт гейта авторитетнее факта блокировок (advisory-режим P6 и так возвращает MANUAL_VERIFY при degraded).
3. **DEF-OD7-1 — probe читает `.env`/`.env.local`, а не только дисклозит env-only семантику.** Судья допускал оба пути; выбран фикс источника: runtime пилота грузит `.env` через dotenv, значит presence-вопрос манифеста («есть ли у прогона доступ?») честно отвечается только объединением process.env ∪ dotenv-файлы. Дисклоз добавлен тоже (`env_source` в item + help): маскировка источника прятала бы разницу «живой export» vs «файл». Значения секретов не покидают предикат (только presence; непустые значения).
4. **ANOM-OD7-1 — канонический терминал `closed_without_runtime` (charter v3, `evt:owner.close` из escalated).** Отвергнуто «оставить owner.abort перегруженным»: live-кейс (owner-split 5.4a/5.4b, остаток дефернут) заставил бы либо ложный `done` (shipped-hint не заслужен), либо ложный `aborted` (линия не провалена). Новый терминал финален и БЕЗ shipped-hint-акции.
5. **ANOM-OD7-2 — гард на `evt:owner.*`: bare tick отказывается, ручной owner-тик — только `--force-manual "PA-NNN: <owner decision>"`.** Санкционированный путь (PA-флип владельца + `pa-scan --tick`) не тронут — pa-scan идёт в applyEventFS мимо cmdTick. Регламент теперь машинный: owner-решение либо выражено PA-флипом, либо ЗАПИСАНО в PA, на которую ссылается форс — executor физически не может молча спроецировать «владелец решил». Отвергнут отдельный флаг `--owner-act`: тот же rec#4-контракт, различие только в тексте отказа.

### Outcome
`fabric-engine.cjs` (гард ingest + owner-гард + `requireForceManual()` + `--ledger-file`), `capability-probe.cjs` (dotenv-lite presence + `env_source`), charter `feature-production-line.json` v3 (blocked-fallback + `closed_without_runtime`), `run.md` (bracket-guard note + секция owner-decision events). Юниты: fabric-engine 40→49, capability-probe 12→15; полный verify EXIT=0. Осталось из плана: R1 re-run на VM целевым путём `/orchestrator:run feature-to-tdd-impl --fabric` после доставки фиксов в пилот.

### Lessons
1. **Гард, добавляемый на второй вход той же дисциплины, выноси в общий валидатор сразу** — DEF-3 (0163) и rec#4 (0168) писались inline в cmdTick, и симметричный ingest-гард потребовал бы копипасты трёх валидационных блоков; extraction в `requireForceManual()` сделал третий гард (owner.*) трёхстрочным.
2. **Опциональный параметр, на котором держится enforcement, — не enforcement**: гард «run_id обязан быть в ledger» ничего не стоит, пока сам `--run-id` опционален. Проверяй, что обходной путь не дешевле честного на КАЖДОМ аргументе гарда.
3. Тестовые хелперы, инкапсулирующие вызов CLI (`ingest()` фикстур), окупились: ужесточение контракта (обязательный run-id + ledger) потребовало правки двух хелперов и двух прямых вызовов вместо ~20 тестов.

## DEC-DEV-0175 — OD7 R1 re-run: PASS судьи → OD7 live-валидирован по совокупности; попутный DEF-OD7-CLOSE → charter v4 (owner.close со всех парковок)

**Date:** 2026-07-11
**Trigger:** мандат владельца «Режь 1.8.1 и делай вариант (1) с DeepL» (пре-регистрированный бриф `OD7_R1_RERUN_BRIEF.md` + deviation note).

### Context
После фиксов 0174 остался единственный FAIL-по-букве прогона 0173 — R1 «park machine-backed». Rec #2 судьи: короткий перепрогон парковки через диспетчер с ledger-брекетом. Доставка = patch-cut 1.8.1 (`2bbcb6d`, тег `v1.8.1`; сам cut — рутина, записи не требует) + `/ecosystem:update` пилота (`42748ed`).

### Ход и решения
1. **Субъект — deviation по ground truth (правило «исполнитель отклоняется с обоснованием»):** DeepL для machine-translation оказался ОТМЕНЁН ратифицированным решением пилота (манифест-комментарий FM-002 + PA-038: выбор = OpenAI). DeepL-фикстура = режиссура против канона → честный эквивалент той же схемы: **FM-008 real-TTS-provider wiring** (`ELEVENLABS_API_KEY` реально отсутствует в `.env`; TTS-нога translate→TTS→download реально отложена в RL-002; mock не может быть stand-in для фичи «retire the Mock»). Deviation note закоммичен ДО прогона (PR #154).
2. **Sanity DEF-OD7-1 live-PASS:** probe FM-002 после 1.8.1 → `present:true, env_source:".env", SATISFIED` — прежний ложный BLOCK честно исчез (это и сняло FM-002 как субъект: фикс убрал сам триггер прежнего прогона — подтверждение правильности фикса).
3. **Прогон:** executor-спонтанность (а) — стоп на `handoff_ready`: DoR P3 блокирует пустой FM-скелет (B1/B2); owner-решение «стартуем без обогащения, P2.A вне scope». FF P3/P4 — аудируемым путём (PA-065 + `--force-manual`, живая проба эскейпа 0174 в обе стороны: отказ→PA→проход). **P5 полным брекетом диспетчера** → парковка `awaiting_capability_impl`, payload capability-slice в событии и PA-067.
4. **Судья (opus, независимый): R1 = PASS** — run_id park-события = ledger-брекет побайтно (формат диспетчера, не `wf_…`), park-тик без forced-manual (FF-маркеры только на разрешённых P3/P4). **Следствие: OD7 live-валидирован по совокупности** (R2-R5/R7/R8 из 0173 + R1); остаток — R6/`env.up` event-gated. Вердикт verbatim — бриф §Outcome.
5. **DEF-OD7-CLOSE (спонтанность (б), клин-ап):** движок live-отклонил `evt:owner.close` из `awaiting_capability_impl` — charter v3 дал owner-терминал только `escalated`, у await-гейтов единственный выход = resume; закрыть запаркованную линию без фейка нельзя (executor отказался от «pa.resolved→forced manual_verify→escalated→close» — два семантически ложных события; принят honest-resting-state, линия оставлена запаркованной на ветке `od7-r1-rerun`). **Фикс — charter v4:** `evt:owner.close → closed_without_runtime` со ВСЕХ парковочных human-gate (`awaiting_product`/`awaiting_capability`/`awaiting_capability_impl`/`runtime_gate_retry`); deriveResumeEvent не задет (pa-first порядок; юнит-регрессор проверяет resume-события всех гейтов). Альтернатива «оставить как есть, закрывать через escalated» отвергнута: два forced-manual + ложный manual_verify — эскейп дороже честного пути, но честного пути НЕ БЫЛО.
6. **Среда:** до прогона вскрыт ресурсный клин VM — 5 idle-TUI od7-* × statusline (4s) = node-шторм, load 25, контеншн `~/.claude.json` → новые инстансы Claude виснут на старте (CPU-burn, симптом неотличим от «битого бинаря»). Лечение: kill всех idle-сессий + stray-процессов + `rm ~/.claude.json.tmp.*`. Урок — в скилл `vm-factory-ops` §4.5.

### Outcome
OD7-строка SPEC → «LIVE-ВАЛИДИРОВАН по совокупности»; GAPS G04 → live-валидирован (остаток env.up); charter v4 + юнит (fabric-engine 49→50); run.md/07-fabric.md синхронизированы; бриф §Outcome = SSOT вердикта. Пилот: main `42748ed` (1.8.1), ветка `od7-r1-rerun` запушена (осмотр/судьба FM-008 — за владельцем). VM: сессии погашены, снапшот `od7-pre-run` остаётся до решения владельца.

### Lessons
1. **Фикс ложноположительного гейта уничтожает его собственный тест-триггер** — план ре-валидации, написанный до фикса, обязан пере-проверить свою фикстуру против ground truth ПОСЛЕ фикса (здесь: FM-002 перестала парковаться — и это правильный исход, а не сломанный тест).
2. **«Терминал есть» ≠ «терминал достижим»:** ANOM-OD7-1 закрыли добавлением `closed_without_runtime` из `escalated`, но парковки await-класса до него не доставали — при добавлении состояния проверяй достижимость из КАЖДОГО класса состояний, где семантика применима (машинная проверка кандидат: charter-линтер «у every human-gate есть owner-выход»).
3. Idle TUI-сессии с активным statusline — не «бесплатное наследие прогона», а ресурсная бомба замедленного действия; дисциплина «harvest → kill» обязательна (кодифицировано в скилле).

## DEC-DEV-0176 — Integrator Phase-7 kickoff (inline): maintenance-скоуп verify/debug/docs + drift-check hook; replace/contract-validate/--light CUT

**Date:** 2026-07-11
**Trigger:** владелец выбрал Integrator Phase-7 (G14-G16) следующим треком из остатка корзины №4 (пост-обязательство Fabric). Kickoff — inline-режим (checklist прямо называет Phase 7 примером допустимого inline: «small maintenance phases»); премиса верифицирована эмпирически до решений ([[feedback_substrate_premise_verification]]): grep подтвердил живые ссылки на `/integrator:{verify,debug,replace,docs}` в consumer-zone (update.md:234, remove.md:172, status.md:93-118, map.md, journal.md, scan.md:14, bootstrap.md:730, CLAUDE.md.template:98-99) при отсутствии самих команд; `hooks/integrator/{drift-check,contract-validate}.js` заявлены в manifest-комментарии и SPEC §10, файлов нет.

### Context
ROADMAP Phase 7 (§632-664): verify/debug/docs + 3 скилла + full drift-detection, оценка 2-3 ч. Фактический субстрат богаче, чем ROADMAP предполагал: скиллы `drift-detection.md` и `tool-docs-generator.md` УЖЕ построены Phase 5 (Phase-7 их потребляет, не создаёт); механика drift D1/D2/D3 уже живёт в `update.md` Stage 3 (local-only модель DEC-DEV-0045, tri-location DEC-DEV-0044); UX-транскрипт debug есть в SPEC §7.3. Реальный дефицит = 3 командных файла + проактивный слушатель дрейфа + wiring.

### Решения (Section 1 — architectural readiness)
1. **Committed-скоуп:** `commands/integrator/{verify,debug,docs}.md` + `hooks/integrator/drift-check.js` (SessionStart, detect-only) + разделяемая либа `hooks/integrator/lib/drift-checks.cjs` + wiring (overlay-записи, manifest, тесты `tests/integrator/`, регенерация каталога). Скиллы не создаём (см. Context); `debug-protocol` скилл CUT — протокол короткий, инлайнится в `debug.md` (skills = переиспользуемая методология, переиспользователя нет).
2. **`/integrator:replace` — CUT v1.1+** (премиса DEC-DEV-0040 Q4 не изменилась: единственный установленный инструмент = cc-sdd, содержательный тест replace невозможен; bring-forward trigger = второй D2-Tech инструмент в пилоте). Мёртвые ссылки аннотируются честно (SPEC:1158 уже аннотирована; scan.md:14 — этим коммитом). G14 закрывается на 3/4 команды.
3. **Граница verify ↔ `/ecosystem:verify`:** ecosystem:verify = целостность инсталляции экосистемы; integrator:verify = здоровье Integrator-зоны: active-tools ↔ реальность (tool установлен/запускается), контракты CNT-* валидны, pmo-mapping без orphan'ов, adapter-drift D1/D2/D3 (переиспользует local-only модель 0045 через новую либу). Read-only отчёт + рекомендации (`update --repair`/`debug`) — НЕ чинит сам; единственная запись = штамп `last_audit` в active-tools.yaml (SPEC §4.3 образец) + session-marker (scope-guard активация, паттерн status.md Step 0).
4. **debug = one-shot диагностика + approve-gated fix** по SPEC §7.3 (journal lookup → contract check → гипотеза → предложение → approve → fix → regression → journal entry `DEC-INT-NNNN`). НЕ interactive REPL. Включает G15-роутинг явным шагом: systematic issues → предложить `/product:validation-tune` propose confidence-downgrade — это даёт confidence-lifecycle SPEC §4.4 недостающую точку входа (G15 закрывается).
5. **docs = обёртка над существующим скиллом `tool-docs-generator`** по структуре SPEC §14.2; `--tool=all` bulk; регенерация сохраняет `<!-- manual: do not regenerate -->` секции (§14.4); без активных инструментов — честный отказ.
6. **`drift-check.js` (SessionStart):** тихий no-op вне Integrator-проектов (нет `.claude/integrator/active-tools.yaml`); иначе D1 semver + D2 CONTRACT_SCHEMA_VERSION (reference vs instance) + staleness `last_audit` >90d → warn-нота «прогони /integrator:verify» в additionalContext. Warn-only, fail-open, без сети. Закрывает суть G16 (проактивный слушатель).
7. **`contract-validate.js` — CUT v1.1+:** PreToolUse-валидация контрактов спекулятивна — нет наблюдённого класса дефекта, который она ловит и который пропустят drift-check+verify; «блокировки» из SPEC §10 всё равно запрещены warn-only конвенцией. Bring-forward: живой битый контракт, прошедший мимо drift-check/verify. G16 закрывается частично — честно фиксируем в manifest-комментарии.
8. **«Full drift-detection algorithm» из ROADMAP урезан до local-only** (каскад 0045): adapter-version detection из source-репо = cross-repo (противоречит 0045) → остаётся audit-only `.sync-metadata`; profile-drift (re-research) и cross-tool dependency drift — CUT (один инструмент, нет данных). Чтобы не плодить ТРЕТЬЮ копию D1/D2/D3 (update.md inline + verify + hook) — общая механика выносится в `hooks/integrator/lib/drift-checks.cjs` (hook требует js в любом случае; verify зовёт её CLI-seam'ом). `update.md` НЕ переезжает на либу в этой фазе (отдельный рефактор, v1.1 — не расширять blast установленного flow).
9. **`verify --light` / ScheduleWakeup periodic — CUT** (ROADMAP сам: «optional v1, можно отложить v1.1»).
10. **Phase-8 readiness skeleton НЕ создаётся** — фаз после 7 в ROADMAP нет (Orchestrator построен отдельным треком); отклонение от checklist Section 5.3 «если applicable» — not applicable.

### Ambiguity sweep (Section 2)
A1 `last_audit` — per-tool поле active-tools.yaml (образец SPEC §4.3). A2 все три команды пишут/чистят `.session-context.json` (паттерн status.md). A3 тестов Integrator нет вовсе → новый `tests/integrator/` (wiring-паттерн из tests/product: команды существуют+frontmatter+overlay-запись; юниты drift-checks.cjs) + `test:integrator` в verify-цепь. A4 hook-smoke: drift-check попадает под `verify:hooks` (smoke-hooks.js) — проверить графом при сборке. A5 docs без инструментов → отказ, не пустой файл. A6 вскрытый попутный дрейф: `verify.md` (ecosystem) утверждает «drift-gated by gen:catalog:check в repo verify», но скрипта НЕТ в verify-цепи package.json, и каталог `02-commands.md` фактически STALE прямо сейчас → фикс этим же kickoff-коммитом: regen + подключение `gen:catalog:check` в `npm run verify` (приводит реальность к заявленному контракту, а не наоборот — каталог и так регенерится при každом cut).

### Static-context budget (Section 3b, baseline)
CLAUDE.md 282 + RAILS.md 77 + глобальный CLAUDE.md 105 + MEMORY.md 42 = **506 строк** always-on. Первый замер = baseline; резки не требуется (все блоки прошли тест «почему static»: process-triggers таблица и Autoflow — операционные контракты каждой сессии).

### Scope discipline (Section 4) — сводка cuts
replace (trigger: 2-й инструмент) · contract-validate.js (trigger: живой пропущенный битый контракт) · verify --light/periodic · profile-drift + cross-tool drift · debug-protocol skill (инлайн) · update.md→либа рефактор. Сохранён >50% исходной поверхности ROADMAP-скоупа как cuts — в духе прецедента Phase 6 (5/12).

### Plan (Section 5 — sub-phases)
A kickoff+drift-fix (этот коммит) → B либа drift-checks.cjs + юниты → C verify.md → D debug.md → E docs.md → F drift-check.js + manifest + hook-smoke → G wiring: overlay ×3, каталог/карта regen, tests/integrator wiring, CHANGELOG [Unreleased], смоук-план `dev/gates/PHASE_7_SMOKE_TEST_PLAN.md` (runtime на пилоте — deferred к следующему VM-визиту). Closure-запись отдельным DEC-DEV.

### Lessons
1. ROADMAP-оценка фазы, написанная за 6 недель до старта, не видела, что половина deliverables (2 скилла, D1-D3 механика, UX-транскрипты) будет построена соседними фазами попутно — kickoff-recon по фактическому субстрату сократил скоуп фазы примерно вдвое против буквального ROADMAP-списка.
2. Заявление дока о гейте («drift-gated in verify») без самого гейта в цепи — тихий класс дрейфа, который ловится только эмпирической проверкой заявления (`npm run <check>` руками); при ссылке на автоматический гейт — проверяй, что он реально в цепи.

### Outcome (стройка, тот же день)
Sub-phases B-G построены и в ветке: `commands/integrator/{verify,debug,docs}.md` (133/143/97 строк, ревью main-моделью PASS) + `hooks/integrator/lib/drift-checks.cjs` (D1/D2/D3+staleness, толерантный yaml-lite под обе формы active-tools, CLI-seam exit 0) + `hooks/integrator/drift-check.js` (SessionStart, hookEventName-контракт по уроку 0162, тумблер INTEGRATOR_DRIFT_CHECK=0) + manifest-регистрация (contract-validate помечен CUT) + `tests/integrator/drift-checks.test.cjs` 24/24 + hook-smoke 41→43 + overlay ×3 / карта+каталог 46→49 команд / SPEC §9 Phase-7 ✅ + §10 аннотации / CHANGELOG [Unreleased] / смоук-план S1-S5. `test:integrator` и `gen:catalog:check` подключены в verify-цепь; полный `npm run verify` EXIT=0. Сборка — MDP-оркестрация: recon sonnet → 2 параллельных opus-исполнителя (либа+хук / команды) → ревью main. Runtime smoke — next VM-визит (план в dev/gates/).

### Closure (phase-closure inline, тот же день)
Step 1 doc-health: 6 очагов rot вычищены (remove.md/update.md «(Phase 7, when available)» → живые ссылки; drift-detection/contract-design/tool-docs-generator скиллы «→ Phase 7» → «v1.1+ cut, 0176»; ROADMAP статус-строки + баннер §Phase 7 «исторический план»). Step 3 hook-smoke 43/43 (в pre-commit гейте). Step 3.5 built≠validated: везде помечено «runtime smoke pending»; **finding: deferred-smoke долг = 4 плана** (PATCH_1.3.3 + PHASE_6 + S_LE + PHASE_7) — выше порога 2; прогонять ПАЧКОЙ на следующем VM-визите вместе с S1-S5, новых «built» фаз до этого не наслаивать. Step 4 consistency: SPEC §9/§10 ↔ manifest ↔ CHANGELOG сведены; counts 24/44 не задеты (команды вне счётчиков). Step 5: PHASE_7_READINESS архивирован → `dev/_archive/phase-7/` (смоук-план остаётся активным до прогона); Phase-8 skeleton не создан (фаз больше нет — решение 10). Step 2 (bootstrap на пилоте) и Step 6 (memory-sync) — после merge. Время closure ≈ 20 мин (в бюджете).

## DEC-DEV-0177 — Batch-прогон 4 deferred-смоук-планов на VM-пилоте: 11 PASS / 2 PARTIAL / 6 N/A / 0 FAIL; вскрыт DEF-SMK-1 (drift-оси слепы на реальной схеме active-tools)

**Date:** 2026-07-11
**Trigger:** мандат владельца «Прогони пачку из 4 smoke-планов на VM» (closure-finding Phase 7: deferred-smoke долг = 4 плана, порог 2 превышен вдвое).

### Ход
Релиз **1.9.0** cut (`6da37c1`; Phase-7 в поставке — прогону Phase-7-смоука нужна доставка) → пре-регистрация брифа `dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md` (PR #157, ДО прогона; вкл. пре-вскрытые plan-drift'ы: Phase-6 S5/Q10 решён «export standalone», S2-Stitch N/A-substrate, 1.3.3 S4 env-блок в профиле) → VM-снапшот `smoke-batch-pre-run` (офлайн) → сессии **U** (update 1.9.0 + verify = Phase-6 S7) → **D** (Phase-7) → **A** (1.3.3) → **B** (Phase-6) → **C** (S-LE, strict) → harvest (по-сессионный digest из JSONL + операторские детерминированные факты) → **независимый судья opus**. Вердикт и полная таблица — бриф §Outcome (SSOT). Пилот: main `202c882` (доставка) → `54dd35a`; evidence-ветка `smoke-batch-1-9-0` (6 коммитов).

### Ключевые результаты
1. **Phase-6 S7 (update-compat) PASS детерминированно** — главный страх update'а (wipe пилот-состояния) не подтверждается: design.yaml/mockups(85 файлов)/DS побайтно целы, third-party хуки/скиллы preserved, `ecosystem_version` re-stamped.
2. **Phase-7 живьём здоров**: verify/debug/docs PASS (debug попутно НАШЁЛ живой дефект — ложный C-03 на FM-006, whitelist отстал от v1.6.0; корректно cancelled по n). **DEF-SMK-1**: drift-оси D1/D2/D3 хука/либы слепы на реальном пилоте — парсер ждёт поле `adapter`, которого в реальной схеме active-tools.yaml НЕТ (связь tool→adapter живёт в CNT-*.yaml `transformation.script`); staleness-нога при этом работает live (нота в сессии D, молчание в чистой C). Юниты дефект не ловили — фикстуры были самодельной формы (урок №1).
3. **S-LE: цель ре-прогона достигнута** — exemption-самодедлок 0143 live-устранён (протокол `--resume` пишет маркер и цели под strict), deny работает; S-LE.1 повторно PARTIAL (`preventedContinuation=false` при работающем feedback-инжекте — ограничение CC под bypassPermissions, не хука). Флип PreToolUse warn→strict — судья: «обоснован по существу, финал за владельцем».
4. **1.3.3 S2/S5 = N/A по вине дизайна прогона** (не кода): `/integrator:scan` снимает session-marker на Final-cleanup → запись «после скана» шла без маркера, scope-guard легитимно no-op. Урок №2.
5. Deferred-smoke долг 4 → 2 (PHASE_7 архивирован; S_LE — по решению флипа; 1.3.3/PHASE_6 — точечный догон: живой маркер / свежий install / честная UI FM без готового дизайна).

### Lessons
1. **Юнит-фикстуры «самодельной формы» проходят зелёными мимо реальной схемы данных** — при написании парсера реального файла пилота бери в фикстуры РЕАЛЬНЫЙ образец (или контракт-тест против схемы из add.md), иначе runtime-smoke становится первым местом, где парсер встречает правду (DEF-SMK-1).
2. **Оркестровка смоука обязана знать side-effects шагов-предусловий**: `/integrator:scan` сам снимает маркер, который нужен следующему шагу теста, — секвенирование «scan → запись» разоружает сценарий. Пре-прогонная ревизия планов ловила contract-drift, но не эту динамику; в догоне — писать при живом маркере.
3. **Судейская пара «пре-регистрированные поправки + anti-phantom-inflation» удержала прогон от ложных FAIL**: 6 N/A могли бы засчитаться провалами; 2 plan-drift'а были вскрыты ДО прогона грепами контрактов (вопрос владельца «не проверяешь ли устаревшее?» — прямое попадание).

### Outcome-дополнение (флип, тот же день)
Владелец принял рекомендацию судьи: **`lesson-presence-gate.js` (PRONG B, PreToolUse) флипнут warn→strict по умолчанию** (дефолт в хуке + manifest-description + CHANGELOG [Unreleased] Changed; hook-smoke 43/43 — strict-кейсы 0143 покрывают новый дефолт, warn-кейс задаёт env явно). S-LE-чеклист архивирован по его же §«На PASS» (`dev/_archive/s-le/`), указатели обновлены; S-LE.1 задокументирован как known CC-runtime-caveat (не блокер). Откат без кода: `LESSON_GATE_MODE=warn`.

## DEC-DEV-0178 — Follow-up фиксы smoke-batch: DEF-SMK-1 (adapter-резолв через CNT-контракты), ложный C-03 (whitelist v1.x), деплой тест-фикстуры адаптера

**Date:** 2026-07-11
**Trigger:** мандат владельца «Делай follow-up фиксы: DEF-SMK-1 + C-03 + фикстура» (дефекты вскрыты batch-прогоном, DEC-DEV-0177).

### Решения
1. **DEF-SMK-1 — резолв через контракты, не новое поле.** Альтернатива «добавить поле `adapter` в схему active-tools + backfill» отвергнута: связь tool→adapter УЖЕ канонично живёт в `CNT-*.yaml` (`consumer` + `transformation.script`) — второй носитель породил бы дрейф двух источников. Либа сканирует контракты (толерантно, обе вложенности `consumer`/`contract.consumer`; вклад только `type: adapter_script`), объединяет с legacy-полем, multi-adapter сводит worst-of, а непривязанные пары reference↔instance проверяет страховочной строкой `(unattributed)` — контракты, которые парсер не осилил, не делают дрейф невидимым. JSON-форма выхода сохранена (контракт `verify.md`).
2. **C-03 — whitelist до `v1.x`, не «добавить v1.5-v1.9».** Перечисление миноров повторило бы граблю на каждом релизе. Основание расширения — live-факт прогона: Stage-6 контракт-тест прошёл против РЕАЛЬНОГО v1.6-handoff (DEC-INT-0014), а структурная защита от вложенных §10 — monotonic guard (0073) + блокирующий C-07. Мажор (v2+) остаётся warning до ре-верификации. Instance пилота получит фикс через `/integrator:update cc-sdd --repair` после доставки.
3. **Фикстура — деплой-шаг, не переезд файла.** Альтернатива «переместить SSOT в `adapters/fixtures/`» отвергнута: фикстуру делят три тест-съюта (`tests/adapters` + `tests/orchestrator` ×2) — переезд трогал бы их без выгоды. SSOT остаётся `tests/fixtures/`, bootstrap 2d + update Step 5.2 копируют `FM-FIXTURE-*.md` → `.claude/adapters/fixtures/`; пути в `add.md`/`update.md` обновлены с fallback'ом на реальный handoff (pre-1.10 инсталляции).

### Outcome
Сборка: DEF-SMK-1 — opus-исполнитель по фиксированному дизайну (ревью main: резолвер+регрессор спот-чек PASS); C-03 + фикстура — main. Тесты: drift-checks 24→33 (фикстуры РЕАЛЬНОЙ формы — прямое применение урока 0177 №1; регрессор «drift ловится на схеме без поля adapter»), adapters contract-test 4→5 (v1.6/v1.9 pass + v2.0 warn), hook-smoke 43/43, полный verify EXIT=0. PA-050/051 (data-hygiene пилота) — вне scope, оставлено владельцу пилот-стороной.

### Lessons
1. Дефект-класс «второй источник правды» лечится чтением существующего канона, а не добавлением удобного поля: схема уже знала связь tool→adapter — не знала её только либа.

---

## DEC-DEV-0179 — G22: handoff staleness на стороне Integrator — пересчёт хэшей реально выполняется и персистится (переиспользование Product hash-SSOT)

**Date:** 2026-07-11
**Trigger:** закрытие G22 из аудита (APPENDIX-B §1 / GAPS-RECONCILIATION §70; backlog-корзина №4).

### Root cause
handoff-spec §10 «Drift Detection» и §13 «С Integrator Module» обещали: при использовании handoff Integrator'ом (`/integrator:add`/`update`) и при `/integrator:verify` embedded `artifact_hashes` пересчитываются от `.product/` и расхождение флипает handoff в `stale`. По факту — шага пересчёта в `add.md`/`update.md` **не было вообще** (grep пуст), а единственный реальный drift-механизм жил в Product-зоне (`hooks/product/product-handoff-gate.js`, PostToolUse): он пересчитывает и предупреждает в **stderr**, но ничего не персистит — сигнал эфемерный. Итог (класс аудита (a)+(b)): спека обещала контур, которого на Integrator-стороне не существовало, а staleness нигде не оседала в файл.

### Решения
1. **Тонкая либа + переиспособление hash-SSOT, не копипаста (orchestrate-don't-duplicate).** Новая `hooks/integrator/lib/handoff-staleness.cjs` `require`-ит `hooks/product/lib/hash.js` (относительный путь `../../product/lib/hash.js` держится и в репо, и в пилоте `.claude/hooks/…`) и зовёт `computeArtifactHash` — SHA-256 / strip-frontmatter / LF-normalize НЕ реимплементированы. Альтернатива «встроить staleness в существующую `drift-checks.cjs`» отвергнута: та про **adapter**-drift (D1/D2/D3 reference↔instance + tool `last_audit`>90d) — ортогональная ось; её `staleness` — это возраст аудита тула, а не hash-дрейф артефактов handoff. Смешивать две модели в одном runDriftChecks значило бы перегрузить контракт JSON, который уже потребляет `verify.md`.
2. **Персист — в Integrator-зону, НЕ в `.product/`.** Спека §10 говорит «status → stale», но Integrator по жёсткому контракту `add/update/verify` **никогда не пишет `.product/`** (scope-guard). Прямая запись `status: stale` в frontmatter самого handoff нарушила бы это. Разрешение: вердикт персистится в `.claude/integrator/handoff-staleness.yaml` (Integrator-зона); чтение `.product/` для пересчёта — read-only, допустимо. Регенерацию (единственное, что реально трогает handoff) инициирует владелец через `/product:handoff <FM-id> --regenerate` — Product-действие. handoff-spec §10/§13/§16 приведены к этому честному контракту (двусторонняя модель: Product-gate предупреждает, Integrator-либа персистит).
3. **Producer/consumer split по командам.** `add.md`/`update.md` (модифицирующие) зовут либу с `--write` (persist свежего baseline). `verify.md` (read-only, один разрешённый write = `last_audit`) снапшот **читает** + считает свежий вердикт БЕЗ `--write` — single-write-инвариант verify сохранён. Так «персист в форму, которую читает verify» выполнено без нарушения инварианта.
4. **id→path резолюция сканом `.product/`.** Имена файлов несут ASCII-slug, поэтому artifact-id (`FM-003`, `SC-005`) резолвится не по имени, а индексом: скан артефакт-директорий (mirror фильтра product-handoff-gate) + синглтоны (`rpm/glossary/design-system.md`), чтение frontmatter `id`. Отсутствующий в `.product/` артефакт → `missing_artifacts` (→ stale).

### Outcome
Сборка — opus-исполнитель (эта сессия). Реюз: `hooks/product/lib/hash.js` (алгоритм хэша), паттерн block-parse `artifact_hashes` из product-handoff-gate (grabli R5/A1 «regex ловит только первую запись» учтён — line-based). Добавлено: либа `handoff-staleness.cjs` (detect-only, CLI-seam `--root/--json/--write`, exit 0 всегда, tolerant к отсутствию `.product/`), юнит-тест 12 кейсов (вкл. hash-reuse-инвариант «frontmatter-only bump НЕ флипает stale» + «CLI никогда не пишет `.product/`»), wiring в `add.md`/`update.md`/`verify.md`, приведение handoff-spec §10/§13/§16 к честному контракту. `test:integrator` в verify-цепи (drift-checks + handoff-staleness). Полный `npm run verify` EXIT=0. Counts без изменений (24/44 — либа/команды в счётчики не входят). В пилот ещё не доставлено (следующий `/ecosystem:update`).

### Lessons
1. Когда спека обещает «X происходит при использовании», а grep реализации пуст — сначала проверь, не живёт ли половина контура в СОСЕДНЕЙ зоне (тут: Product-gate уже пересчитывал, но эфемерно). Закрытие = не «построить с нуля», а «дотянуть недостающую половину + переиспользовать SSOT алгоритма».
2. Жёсткий zone-контракт («никогда не пишет `.product/`») может конфликтовать с буквой спеки («status → stale в handoff»). Разрешение — не нарушить контракт, а перенести персист в свою зону и оставить мутацию чужой зоны её владельцу; спеку привести к этому честно, а не оставить обещание, которое зона структурно не может выполнить.
## DEC-DEV-0180 — Sweeper истёкших approve_overrides (закрытие G28): detect-only SessionStart-хук + CLI-reap, инлайн-консистентная классификация

**Date:** 2026-07-11
**Trigger:** последний остаток очереди AUDIT §6 quick-wins — G28 (`APPENDIX-B` §69): `approve_overrides.expires_at` не имеет sweep-механизма, expiry проверяется только инлайн при чтении артефакта (`artifact-validate.js` → `buildOverrideMap`). Periodic (§3.5) явно не реализован.

### Контекст
D2-overrides (`validation.md` §9.4, DEC-DEV-0012 C.5): артефакт может нести временный `approve_overrides[]` с опциональным `expires_at`. `buildOverrideMap` деактивирует запись условием `!isNaN(Date.parse(expires_at)) && expiry < now` — но **только когда** валидатор снова читает именно этот артефакт (PostToolUse на его Write/Edit). Истёкшие записи иначе копятся мёртвой конфигурацией: гейт де-факто снова активен, но конфиг говорит «одобрено». G28 — отсутствие проактивной подметалки.

### Решения
1. **Точечный sweeper, НЕ актуатор (граница скоупа).** Явно НЕ строил cron/temporal-инфру (Periodic §3.5 = фаза 4 Process Fabric, отложена до live-триггеров). Построен детерминированный сканер + CLI (`hooks/product/lib/override-sweep.cjs`) — чистые функции юнит-тестируемы, мутация изолирована за флагом.
2. **Классификация инлайн-консистентна — sweeper НИКОГДА не расходится с валидатором.** Четыре класса зеркалят предикат `buildOverrideMap`: `expired` (парсится И `< now`) · `active` · `no-expiry` (нет поля → валидатор держит активным вечно) · `invalid-date` (непарсящийся `expires_at`: инлайн-предикат `!isNaN && <now` на NaN = false → валидатор трактует как **АКТИВНЫЙ**). Отсюда семантика: `invalid-date` **репортится как config-smell, но НЕ подметается** — он не истёк, удалять его = менять поведение валидации. Guard-тест держит это соответствие явно.
3. **Семантика sweep: report по умолчанию, `--clean` = reap только expired.** Выбор «удалять vs помечать»: удаление истёкшей записи **validation-нейтрально** (валидатор её уже игнорирует — не воскрешает и не роняет ни один гейт), тогда как «пометка» потребовала бы столь же рискованной мутации YAML без выигрыша. Дефолт — dry-run отчёт; мутация только по явному `--clean`. Убираются построчные спаны только `expired`-элементов; если секция опустела — снимается и заголовок `approve_overrides:`. `no-expiry` (перманентный temp-override) и `invalid-date` не трогаются.
4. **Точка вызова: SessionStart-хук (detect-only), НЕ verify-цепь.** Обоснование: sweep оперирует `.product/`-артефактами пользовательского проекта, которых в самом репо экосистемы нет (verify гоняется на репо → нечего сканировать). Соседний прецедент — `hooks/integrator/drift-check.js` (Phase 7, DEC-DEV-0176): проактивный листенер per-project-state на SessionStart. Скопирован его контракт (no-op вне `.product`, `additionalContext` + обязательный `hookEventName` per DEC-DEV-0162, fail-open, env-тумблер). Мутирующий reap живёт **только** за явным CLI — хук никогда не пишет файлы пользователя. Логика при этом всё равно защищена CI: юнит-тест `override-sweep` включён в `test:product`→`verify`.

### Outcome
Собрано main-моделью (лог-механика по точному аудит-брифу). Файлы: `hooks/product/lib/override-sweep.cjs` (lib+CLI), `hooks/product/override-sweep-check.js` (SessionStart-хук), запись в `manifest.yaml`, `tests/product/override-sweep.test.cjs` (15 кейсов: expired/active/no-expiry/битая-дата + guard инлайн-консистентности + clean + tree-walk skip `.pending` + CLI round-trip dry-run→--clean + `--strict` exit-коды), `test:product` в `package.json`. Проверка: юниты 15/15, hook-smoke 43/43, lint 0 errors, полный `npm run verify` EXIT=0. Counts без изменений (24/44 — хуки в счётчики не входят). `commands/ecosystem/verify.md` не трогал: в нём нет инвентаря/счётчика хуков, который эта добавка инвалидировала бы (он аудитит только gate-хук lesson-gate + производные счётчики команд).

### Lessons
1. **Инлайн-предикат — это спецификация для его подметалки.** `invalid-date` мог бы наивно попасть в reap («дата битая → выкинуть»), но валидатор трактует битую дату как активный override; sweeper обязан наследовать именно это, иначе «уборка» тихо снимает живой гейт. Урок: при постройке фонового sweeper'а над инлайн-механизмом извлекай его точный предикат и зеркаль дословно (guard-тест), а не переизобретай «здравый смысл».
2. **Детект и мутация — разные точки вызова с разным контрактом.** Проактивная видимость безопасна в авто-хуке (detect-only, fail-open); необратимое (удаление конфига) осознанно оставлено за явным человеко-инициированным CLI. Тот же принцип, что «merge в main — всегда владелец».
## DEC-DEV-0181 — D7-гигиена: консолидированная SessionStart-напоминалка на застой feedback-контуров G25/G26/G27

**Date:** 2026-07-11
**Trigger:** закрытие трёх Tier-3-разрывов из GAP-анализа процесс-фабрики (`dev/process-fabric/audit/APPENDIX-B-gap-analysis.md`): capture есть, автоматического потребления нет — G25 (Pending-маркеры audit-index копятся, ничто не обязывает `/meta:audit-smoke`), G26 (feedback-intake построен, но reconciliation — «человек должен вспомнить»), G27 (patch-candidates [Y/N/E/D] висят месяцами без reminder).

### Решения
1. **Один консолидированный хук, а не три раздельных (главный tradeoff).** Существующая тройка warn-напоминалок (`dev-journal/phase-closure/memory-drift-reminder`) — `git commit`-gated на PostToolUse:Bash, потому что их триггер — событие коммита. У G25/G26/G27 нет коммит-события: это **standing-backlog** условия (застой во времени). Поэтому естественный триггер — **SessionStart**: показать бэклог один раз за сессию, а не на каждый Bash-вызов (что дало бы шум × N команд). Раздельные три хука зеркалили бы паттерн тройки, но: (а) триггер у всех трёх один и тот же (SessionStart) → три записи в settings + три инъекции additionalContext = лишний шум; (б) общие helpers (repoRoot/пороги/формат) дублировались бы. Выбран один файл `d7-hygiene-reminder.js` с одной инъекцией, печатающей только сработавшие плечи. Зеркалит контракт `rails-session-start.js` (additionalContext, exit 0 всегда, no-op-safe, env-тумблер `D7_HYGIENE_REMINDER=0`).
2. **Detect-only, порог-gated, честные сигналы (не выдумка путей).** Плечи бьют по РЕАЛЬНЫМ структурам данных: G25 — Pending-строки между сентинелами `PENDING_ROWS_START/END` в `audit-index.md`, поле `ended_at` (ISO), порог ≥7 дней; G27 — фронтматтер `patch-candidates/*.md` `verdict: survived` + `gate: pending`, дата последнего движения = git-log `%cI` файла (fallback mtime), порог ≥14 дней. Пороги консервативны — свежий capture не ноет. Никаких записей в файлы (иначе рекурсия Write→SessionStart), только чтение + additionalContext.
3. **G26 — consolidate-don't-duplicate: переиспользуем настоящий `feedback-intake.js`.** Вместо эвристики «уже портировано?» плечо вызывает реальный `intake()` (дедуп против DEV_JOURNAL) над in-repo FB-ledger и считает находки `source=feedback-journal` + `disposition=open`. Session-audit-находки из ndjson (79 open на момент) СОЗНАТЕЛЬНО исключены — это домен patch-synth (G27-путь), а не intake-триггер; иначе плечо шумело бы всегда. Честная граница scope: пилотный outbox (`.product/.upstream/feedback-outbox.md`) лежит по внешнему пути, репо его не знает — плечо покрывает только in-repo FB-ledger-руку; человек, принёсший outbox, всё равно гонит `feedback-intake --outbox` руками (сообщение это проговаривает).

### Outcome
Реализация — main-модель (событийная ткань + honest-scope суждение = не делегируемо). Регистрация — `.claude/settings.local.json` SessionStart (gitignored, локальная — как rails); doc-обновление enumerating-таблиц `CONVENTIONS.md` (дерево hooks + activation-triggers). Верификация: юнит-смоук 11/11 (три чистых детектора с фикстурами: пусто/свежий/застоявшийся/mix/битый вход), end-to-end SessionStart-прогон против реального репо (сработало ровно плечо G26 — FB-LR-11 реально open; G25=0 pending, G27=0 survived-pending), тумблер OFF молчит, пустой stdin no-op-safe. Полный `npm run verify` EXIT=0. Тестов для D7-напоминалок в репо нет (не принятый паттерн) → ручной смоук с фиктивным входом, как указано в брифе; хук экспортирует чистые детекторы для тестируемости.

### Lessons
1. Триггер хука выбирается по **природе условия**, а не по зеркалу соседних хуков: commit-события → PostToolUse:Bash; застой-во-времени → SessionStart. Копирование паттерна тройки без этой проверки дало бы шум на каждый Bash-вызов.
2. Напоминалка о застое переиспользует настоящий реконсилятор, а не эвристику: `intake()` уже умеет «портировано ли?» через дедуп DEV_JOURNAL — своя копия этой логики разошлась бы с источником (тот же класс «второй источник правды», что и урок 0178).
## DEC-DEV-0182 — Детерминированный depth-floor guardrail для adaptive-depth DA (закрытие G30)

**Date:** 2026-07-11
**Trigger:** G30 из аудита process-fabric (`APPENDIX-B-gap-analysis.md`): adaptive-depth-классификатор P-RULE-01/02 (DEC-DEV-0012) даёт subagent'у `product-devils-advocate` право **самому** пометить изменение BR/IC как `cosmetic` (→ quick-check, 6 линз пропускаются) или `significant` (→ full 6-lens). Это LLM-суждение без backstop: false-cosmetic на реально значимом изменении молча пропускает требуемый review. Watchdog G05/G06 (DEC-DEV-0159) страхует **факт** спавна DA, но НЕ выбранную им **глубину** — Tier-1 пункт «рефлексы ревью хрупкие».
**Tag:** #architecture #tooling

### Решения

1. **Детерминированный пол, НЕ второй LLM-судья.** Ставить «ещё одного судью» над классификатором означало бы удвоить и стоимость, и точку отказа (тот же класс суждения). Вместо этого — CODE-level guardrail: чистая функция `computeDepthFloor(diff, artifactType)` сканирует **тот же** git-diff (хук его уже вычислил — cheap-to-check) набором структурных сигналов и, если хоть один сработал, поднимает пол до `significant`. Это переносит из-под LLM только **однозначные структурные** кейсы; на genuinely-ambiguous прозе adaptive-LLM остаётся хозяином. Соответствует Epic-F принципу, уже кодифицированному в `zone-router.cjs`: *disposition детерминирована; суждение — только в контенте вердикта.*

2. **Сигналы — высокоточные, привязаны к перечисленным §6.2 significant-триггерам** (не «широкий значимости-детектор»): `creation` (нет версии в HEAD — синтетический diff-маркер хука), `activation` (`status:`→`active`, contract-binding момент), `severity-critical` (IC severity на/с `critical`), `entity-change` (IC `entity:`), `category-change` (BR `category:`). Все — на уровне frontmatter-полей / существования файла: правка прозы (typo/reword) их НЕ трогает → cosmetic-путь сохранён, cost-модель DEC-DEV-0012 не сломана.

3. **Отвергнуто: переиспользовать `zone-router.classifyMagnitude` как пол.** Он консервативнее — любая не-whitelist content-строка → significant, т.е. и typo-фикс. Использовать его полом = форсировать full 6-lens на каждой прозаической правке = коллапс adaptive-депта в «всегда significant, кроме чистых metadata/ref-list». Это была бы переделка DA cost-модели (own DEC-DEV-0012), а не узкий guardrail. Взят precision-набор структурных сигналов.

4. **Отвергнуто: детектить «statement semantic rewrite» и BR «parameter TYPE vs value-tune».** Оба недетерминируемы регуляркой: прозаический rewrite неотличим от typo (оба — §6.2 cosmetic-триггеры), а value-tune (`first_match`→`best_match`, явный §6.2 cosmetic-пример) живёт в том же `parameters:` блоке, что и type-change — generic-сигнал дал бы false-positive на документированном cosmetic. Оставлено adaptive-LLM (anti-rationalization guard агента). Это осознанная граница, не пробел.

5. **absent==старое поведение 1:1.** Нет сигнала → `floor: null` → в entry ничего не добавляется, brief без `Depth-floor` → subagent классифицирует как раньше (включая свободу выбрать significant сам). Пол только **повышает**, никогда не понижает. Fail-open: `require` либы в try/catch — недоступна → пола нет.

### Enforcement-модель (честно, без иллюзий)

Пол вычисляется CODE **до** запуска subagent'а и штампуется в da-pending-entry (`depth_floor`/`depth_floor_signals`) + громкий stderr-override. Потребление (subagent реально идёт в full) остаётся LLM-оркестрированным — **та же** модель, что и весь DA-спавн и что zone-router magnitude-gate (код решает fire, LLM исполняет). G30 — именно про отсутствие детерминированного backstop у классификации; теперь для перечисленных структурных кейсов суждение из неё изъято.

### Сознательно НЕ сделано (scope-guard)

- **Пост-hoc watchdog-проверка** `depth_floor: significant` против фактической магнитуды вердикта (в `subagent-watchdog.js`) — потребовала бы захвата магнитуды ревью в `.watchdog-state.json` (расширение схемы) → scope creep во вторую подсистему. Пол ДО запуска — достаточный guardrail; пост-hoc слой — возможное будущее усиление.
- **Новый validation-тип/правило** — сознательно нет: сдвинуло бы canonical counts (24/44) и это НЕ validation артефакта, а аннотация depth на существующей da-pending-entry. Counts не тронуты.

### Outcome

Либа `hooks/product/lib/da-depth-floor.cjs` + оба хука (`ic/br-change-trigger.js`: compute→stamp→override-stderr, formatter эмитит поля) + docs (`processes.md` §6.2 таблица сигналов+границы, `feature-session.md` DA-flow, `devils-advocate.md` Step 1 override, manifest ×2). Юнит-тест `tests/product/da-depth-floor.test.cjs` (15 кейсов: каждый сигнал + absent-путь typo/metadata/ref-list/value-tune + context-строки игнорируются) в `test:product`. Интеграционный smoke: creation-IC без git → `depth_floor: significant`/`signals: creation` в yaml + override-stderr, round-trip парсера чистый. `npm run verify` EXIT=0.

### Lessons

1. Прежде чем строить «guardrail» — grep на уже существующий детерминированный механизм того же класса: `zone-router.classifyMagnitude` уже решал «cosmetic vs significant» для persona-панели; DA-путь просто не был к нему подключён. Даже когда его форма не подошла полом (слишком консервативен), он задал и модель (код-fire/LLM-исполняет), и точную точку вычисления (тот же diff в хуке).
2. Детерминированный пол сильнее «ещё одного судьи» ровно там, где сигнал структурный (поле/существование файла), и бесполезен там, где он семантический (проза) — честная граница важнее широкого охвата: широкий пол сломал бы cost-модель, ради которой adaptive-депт и вводился.
## DEC-DEV-0183 — G24: session-audit path-resolve (env-override + loud fail) + opt-in visibility (bootstrap-offer + consumption-seam signal), SessionStart-warn отвергнут как непортируемый

**Date:** 2026-07-11
**Trigger:** закрытие G24 из аудита (`dev/process-fabric/audit/APPENDIX-B-gap-analysis.md`, класс (d)+(f)): Session Audit v2 требует ручного opt-in `/ecosystem:enable-d7-audit` в каждом пилоте — пропустил и весь pipeline молчит; плюс хук «хардкодит абсолютный путь repo → тихо ломается при переезде».

### Root cause (две независимые ноги)
- **(f) Хардкод пути.** Кросс-проектный `SessionEnd`-хук регистрируется в `.claude/settings.local.json` пилота с **абсолютным** путём к `session-audit.js` (это делает `enable-d7-audit.md` Step 5). При переезде репо экосистемы этот путь протухает → `node <stale>` не находит скрипт → хук **молча** не запускается (SessionEnd не может блокировать, ошибка глохнет). Резолв repo-root ВНУТРИ скрипта уже был динамическим (cwd-walk + `__dirname`-fallback), но это не спасает, когда сам лаунчер-путь мёртв.
- **(d) Opt-in в голове.** Аудит-pipeline включается только ручным per-pilot вызовом; забыл — маркеры не пишутся, `/meta:audit-smoke` не находит ничего и раньше печатал безликое «Pending empty after filters» без диагноза.

### Решения
1. **Leg (f) — env-override + громкий отказ + тестируемость.** `findRepoRoot` переписан на приоритет `$ECOSYSTEM_ROOT` (валидируется по CLAUDE.md+DEV_JOURNAL.md) → cwd-walk → `__dirname`-fallback → `null`. При `null` main() пишет **громкий** stderr с ремедиацией (set `ECOSYSTEM_ROOT` / re-run `enable-d7-audit`) вместо тихого skip; неверный `$ECOSYSTEM_ROOT` тоже warn'ит, не молчит. Функция вынесена из top-level (модуль обёрнут `require.main === module`) и экспортирует `findRepoRoot`/`isRepoRoot`/`buildMarkerRow` для юнит-теста (инъекция `env`/`scriptDir`/`warn` → «переехавший» кейс тестируется без спавна). Честная граница: env-override чинит РЕЗОЛВ, но не лаунчер-путь — его чинит только re-run; это явно записано в `enable-d7-audit.md`.
2. **Leg (d) — портируемая видимость, БЕЗ принудительной глобализации.** Две тракторные ноги: (а) `bootstrap.md` Step 11.5 — явный **default-OFF** опрос «это ecosystem-dev пилот?»; только на Yes зовёт идемпотентный `/ecosystem:enable-d7-audit`. Обычные продуктовые проекты не затронуты (суть требования G24-фикса — НЕ менять поведение всех пилотов). (б) `audit-smoke.js` на пустом Pending без фильтров печатает **громкий диагноз** (opt-in не включён / путь протух после переезда + как проверить) — сигнал на consumption-seam, где разработчик как раз ждёт маркеры.
3. **Отвергнуто: SessionStart-warn в репо экосистемы.** Бриф предлагал его как «и/или». По факту устройства dev-хуки репо регистрируются в **gitignored** `.claude/settings.local.json` (там же живёт `rails-session-start.js`) — новый SessionStart-warn не поехал бы в PR/на свежий клон, т.е. воспроизвёл бы РОВНО ту же болезнь непортируемости (G23), которую G24 и лечит. Театр вместо фикса — не строим. Portable-подмножество (bootstrap-offer + consumption-signal) закрывает (d) без этой ловушки.

### Outcome
Тесты: новый `tests/audit/session-audit-resolve.test.cjs` (7 проверок: valid cwd-walk / env-override / scriptDir-fallback / «переехавший» wrong-env→recover+warn / total-miss→null / isRepoRoot / buildMarkerRow) подключён в `test:audit`. End-to-end смоук: реальный payload через `ECOSYSTEM_ROOT` пишет маркер (exit 0); пустой Pending даёт диагноз. Полный `npm run verify` EXIT=0. Зоны: `dev/meta-improvement/hooks/session-audit.js` + `scripts/audit-smoke.js` (D7-internal, не consumer-zone) + consumer-zone `commands/ecosystem/{bootstrap,enable-d7-audit}.md`. Counts без изменений (24/44 — команды/хуки в счётчики не входят). CHANGELOG `[Unreleased] ### Fixed`.

### Lessons
1. «Хардкод абсолютного пути» у кросс-проектного хука неустраним на уровне лаунчера (пилот не имеет иной ручки на репо) — честный фикс не «убрать путь», а сделать резолв override-способным и **отказ громким**, плюс поставить сигнал на seam потребления.
2. Проверяй ПОРТИРУЕМОСТЬ предлагаемого listener'а до постройки: если он регистрируется в gitignored-конфиге, он не переживает клон/переезд и «закрывает» гэп только на одной машине. Для гэпа-про-хрупкость это анти-фикс.
3. Видимость opt-in дешевле и честнее всего конвертируется в сигнал там, где потребитель уже смотрит (пустой `/meta:audit-smoke`), а не новым проактивным органом с собственной регистрационной хрупкостью.
## DEC-DEV-0184 — INFORMATION-MAP P3 path-guard (G34): скрипт check-information-map.js в verify-цепь + фикс абстрактных путей module-SPEC

**Date:** 2026-07-11
**Trigger:** закрытие G34 из аудита (`dev/process-fabric/audit/APPENDIX-B-gap-analysis.md`): принцип P3 `dev/INFORMATION-MAP.yaml` («каждый ssot-путь обязан резолвиться») заявлен, но guard-скрипт не построен. Root-cause класс **(e) — spec-без-импл**.

### Решение
Построен `dev/meta-improvement/scripts/check-information-map.js` (зеркалит структуру `check-counts.js`: shebang + header-контракт, `repoRoot()`, `--json`, коды выхода 0/1/2). Парсит INFORMATION-MAP.yaml как сырой текст (пути живут вкраплениями в прозе полей ssot/mirrors/verify/note, не в чистых полях), извлекает repo-относительные ссылки на файлы и проверяет резолвимость от корня. Вплетён в `npm run verify` тем же паттерном, что `check:doctype`/`check:validation-sync` (новый скрипт `check:infomap` в package.json + звено в цепи `verify`). `commands/ecosystem/verify.md` НЕ тронут: это user-facing `/ecosystem:verify` над установленным `.claude/`, а INFORMATION-MAP — dev-only (P4, в пилот не шипится) → consumer-zone не задета, CHANGELOG не нужен.

### Ключевые дизайн-решения (борьба с false-positive на прозе)
1. **Checkable-правило консервативное:** токен проверяется, только если (есть `/` ИЛИ он в наборе ROOT_DOCS) И (есть расширение .md/.js/.cjs/.mjs/.yaml/.json, ИЛИ trailing-`/`, ИЛИ glob `*`). Прозаические сокращения без расширения («artifacts/README») и голые имена инструментов без пути («gen-command-catalog.cjs») сознательно пропускаются — это не path-claim'ы.
2. **Single-segment `word/` пропускается:** русский текст использует `/` как «или» («ROADMAP/память», «tech-debt/в бэклоге»); ASCII-регекс срезает кириллический хвост, оставляя ложный `dir/`. Реальные каталожные ссылки всегда многосегментны (`dev/tech-debt/`, `docs/pmo/artifacts/`) → требуем интерьерный `/`.
3. **Skip out-of-repo и gitignored:** строки с `out-of-repo`/`~/` (класс memory-location: `~/.claude/.../memory/`, MEMORY.md, `project_*.md`) пропускаются целиком; gitignored-пути (регенерируемый `dev/meta-improvement/rails/RAILS.md`) отсеиваются через `git check-ignore` — их наличие на диске зависит от окружения, не контракт.
4. **Глобы/якоря/плейсхолдеры:** `file.md#секция` → проверяется только файловая часть; `<TYPE>`/`<module>` → glob `*`; `dir/*.md` → ≥1 матч, `dir/*` → родитель-каталог, `dir/` → каталог.

### Найдено/починено
- **37 path-ссылок** проверяется, все резолвятся (green EXIT=0).
- **Фикс в INFORMATION-MAP.yaml (line 107):** абстрактные `product-module/SPEC.md · design-module/SPEC.md · integrator-module/SPEC.md` в поле `verify` класса module-contracts не резолвились от корня (реальные файлы — под `docs/`). Приведены к полным `docs/product-module/SPEC.md · docs/design-module/SPEC.md · docs/integrator-module/SPEC.md` — консистентно с `ssot: docs/<module>-module/SPEC.md` строкой выше. Все три файла существуют; это был единственный реально-нерезолвящийся путь. Прочих битых путей нет — каталог был здоров, теперь ещё и enforced.

### Lessons
1. **Guard над human-prose YAML — упражнение в подавлении FP, не в извлечении.** Ценность P3-принципа была нулевой без исполнителя (класс-(e) долг): один устаревший `ssot:`-путь гнил бы молча. Но наивный «любой `/`-токен = путь» тонет в русской прозе (`/` как «или») → пришлось консервативно сужать checkable до «есть расширение/glob/trailing-slash И многосегментный». Правило «бери реальный образец, не выдумывай схему» (урок 0177 №1) применено к самому yaml: экстрактор откалиброван по фактическим 43 кандидатам файла, а не по воображаемой чистой схеме полей.

---

## DEC-DEV-0189 — Систематический security-проход по репозиторию (закрытие компонента 4 substrate-graduation гейта): фикс command-injection в 3 PostToolUse-хуках + отчёт с принятым остаточным долгом

**Date:** 2026-07-11
**Trigger:** компонент 4 (security review) `dev/gates/SUBSTRATE_GRADUATION_GATE.md` держался 🟡 — «нет систематического security-прохода как обязательного шага перед prod-graduation». Экосистема ставит `hooks/commands/skills/adapters` в `.claude/` пользователя, где хуки исполняются **автоматически** на файловых событиях — атака-поверхность реальна (prompt-injection наводит агента написать файл с крафт-именем/контентом). Проведён защитный аудит собственного кода по осям: command-injection, path-traversal, unsafe-require/eval, запись вне зон, fail-open/closed, XSS в генерируемом HTML, утечка секретов, гигиена шаблонов/permissions. Отчёт: `dev/gates/SECURITY_REVIEW_2026-07-11.md`.

### Находка H-1 (HIGH) — command injection в 3 change-trigger хуках → ПОЧИНЕНО
`hooks/product/{br,ic,zone}-change-trigger.js` — PostToolUse-хуки, копируются в проект пользователя и исполняются на каждом Write/Edit в `.product/`. Все три строили git-команду **шелл-строкой** с интерполяцией `relPath` (производного от `tool_input.file_path`):
```
execSync(`git -C "${projectRoot}" diff HEAD -- "${relPath}"`, …)
```
Фильтр имени артефакта (`\.product/…/[^/]+\.md$`) допускает в сегменте имени любой не-`/` символ, включая `$()`, backtick, `;`. На POSIX (`/bin/sh` под `execSync`) подстановка команд **внутри двойных кавычек вычисляется**: файл `.product/business-rules/x$(touch PWNED).md` проходит фильтр, читается хуком, и `$(…)` исполняется → RCE на машине пользователя, **без подтверждения** (хук авто-запускается). Вектор — prompt-injection: враждебный контент в файле/спеке наводит агента создать артефакт с таким именем. **Фикс (тривиальный, безопасный, поведение 1:1):** `execFileSync('git', ['-C', projectRoot, 'diff', 'HEAD', '--', relPath], …)` — без шелла, метасимволы едут дискретными argv-элементами, не интерпретируются. Проверено: smoke 43/43, функциональный тест (diff по-прежнему захватывается в `da-pending.yaml`) + injection-PoC (SAFE — команда из имени файла не исполнена).

### Остаточный долг (MEDIUM/LOW — задокументирован и ПРИНЯТ, не чинился в этом проходе)
Дисциплина прохода: чиню только critical/high с тривиальным безопасным фиксом; medium/low → в отчёт для решения владельца.
- **M-1 (MEDIUM, stored XSS):** `hooks/design/app-map-html.js:122` встраивает `JSON.stringify(DATA)` в инлайн-`<script>` без экранирования `<`/`</script>`; `DATA` содержит prompt-injection-влияемый `.product`-контент (заголовки FM/NM/CJM). Значение с `</script><script>…` вырывается из блока → выполнение в `file://`-origin открытого `app-map.html` (эксфильтрация данных мокапа). Impact ограничен (локальный файл, свой контент, нет cross-user/сессии). Фикс тривиален (эскейп `<`), но за границей «high» → владельцу.
- **M-2 (MEDIUM, dev-only injection):** `dev/meta-improvement/scripts/next-dec-dev.js:181` — `execSync(\`git show ${ref}:…\`)`, где `ref` — имя ветки из `git branch -r/--format`. git-ref-format НЕ запрещает backtick/`$()`/`;` → враждебное имя remote-ветки + `git fetch` + запуск `npm run next-dec-dev` = инъекция на машине мейнтейнера. Dev-only (в пилот не шипится), вектор узкий. Фикс: `execFileSync('git', ['show', …])`.
- **L-1..L-5 (LOW):** `stitch-to-opendesign.js` шлёт Bearer-токен на caller-контролируемый `--daemon-url` (SSRF-with-credentials); `session-state.js:135` — 12-байт arbitrary-file read через крафт `.git/HEAD` ref-traversal; `od-mcp-call.cjs`/`od-consolidate.cjs` — секрет в argv `docker -e OD_API_TOKEN=…` (виден в `ps`); `session-fabric-status.js` — unsandboxed exec проектно-локального `fabric-engine.cjs` на SessionStart (persistence-вектор, by-design); `check-information-map.js:113` — dev-only интерполяция `rel` в `git check-ignore`.
- **INFO:** `settings.json.template` дефолт-allowlist пре-одобряет `Bash(npx:*)` + `Bash(npm install:*)` + `Bash(git push:*)` + безусловные Write/Edit — расширяет авто-одобренную поверхность (prompt-injection может запустить произвольный npx-пакет без промпта); смена дефолт-постуры — решение владельца, не тривиальный безопасный фикс. Install-скрипты `curl|bash`/`iwr|iex` + `git reset --hard` — стандартно, документировано. Bootstrap рекомендует `--dangerously-skip-permissions` — задокументированный UX-tradeoff. Secrets-свип по репо **чист** (единственный хит — фейковое имя env-var в тест-фикстуре); `.env.template` гигиеничен (пустые ключи + gitignore-нота).

### Решение по гейту
H-1 (единственный high) починен; medium/low явно приняты в отчёте. Критерий закрытия компонента 4 («ручной проход по OWASP-классам … и находки закрыты/приняты явно») выполнен → 🟡→✅ со ссылкой на отчёт. Нефикшенных critical/high **нет** — зелёный честен.

### Lessons
1. **`execSync` со строкой = шелл; `execFileSync`/`spawnSync` с массивом = без шелла.** Дефолт для любой команды с интерполяцией внешнего ввода — массив-форма. Три хука независимо повторили один анти-паттерн (copy-symmetry br→ic→zone) — одна ошибка тиражируется симметрией. При добавлении хука-близнеца копируется и дефект.
2. **Авто-исполняемый хук в consumer-zone поднимает severity инъекции.** Тот же паттерн в dev-only `next-dec-dev.js` — MEDIUM (узкий вектор, машина мейнтейнера), а в PostToolUse-хуке пользователя — HIGH (авто-запуск, RCE, prompt-injection достижим). Зона исполнения — множитель severity.
3. **Фильтр по расширению ≠ санитизация.** `[^/]+\.md$` пропускает `$()`/backtick/`;` в теле имени; «выглядит как путь к .md» не значит «безопасно для шелла». Валидация формы и экранирование для sink — ортогональны.

---

## DEC-DEV-0185 — Repo-wide deadweight-sweep: архивация исполненного, ротация audit-канонов, вынос личных инициатив, untrack PDF (PR-1 из 3)

**Date:** 2026-07-11
**Trigger:** запрос владельца «умная чистка репо: устаревшее/применённое — вон, инициативы — за пределы репо, канонам — компактация без потери смыслов». Метод — многоагентная инспекция (Workflow, 20 агентов: 8 полос × inventory→classify→adversarial-verify + анализ компактации), поглощает work-order `dev/deferred/D7_DEADWEIGHT_CLEANUP.md` (QUEUED c 2026-06-19) как полосу A.

### Решения
1. **Archive-not-delete по умолчанию; DELETE только по уже задокументированному правилу.** 41 audit-report (findings/fail/partial) → `dev/_archive/audit-reports/`; 8 clean>30d УДАЛЕНЫ — это retention-правило самого `audit-reports/README.md`, подтверждено владельцем (AskUserQuestion). 5 репортов адверсариальная верификация ОТБИЛА в KEEP: они — evidence открытых E1–E5 в `dev/tech-debt/PHASE_4.md` (retention: держать до закрытия блокеров). Урок конвейера: классификатор предлагал их в архив — вернул верификатор; двухстадийность окупилась.
2. **Ротация audit-index впервые исполнена по его же §Notes:** clean/dismissed-строки (46 из 77) → `dev/_archive/audit-index-2026.md`; sentinel-пары и Pending нетронуты. Попутный дефект: mode-колонка содержит вложенный `|` (`zones:...|unknown`) — первый парсер «по номеру колонки слева» тихо пропустил 16 clean-строк; статус надо парсить ОТ КОНЦА строки. 
3. **Разовые брифы/планы (19 шт.) → `_archive/{orchestrator,research,vision,plans,vibe-coding}/`.** Верификация подтвердила: ни один не в require/readFile/npm-scripts; все не-историчные ссылки — provenance-комменты в шапках кода (обновлены на архивные пути). `dev/research-cache/` — закрытый эксперимент самой экосистемы → архив (не вынос).
4. **Инициативы владельца:** `dev/product-radar/` + `dev/factory-conductor/` — 0 ссылок из harness → ВЫНОС в отдельные приватные репо (решение владельца: «отдельный репо на каждую»; исполнение = PR-2). `dev/process-fabric/` вынос ОТБИТ верификатором: CONCEPT.md/EXECUTION_ROADMAP.md — живые design-SSOT (docs/MAP.md, run.md, manifest.yaml хуков, guide/07), OD7-грейды цитирует SPEC оркестратора — оставлены на месте, исторический балласт (11 файлов) → `_archive/process-fabric/`.
5. **PDF 755 КБ (`universality-assessment`) — untrack + .gitignore:** дубль соседнего REPORT.md; бинарь в git без потребителя. Содержимое остаётся в git history.
6. **Полосы E/F/G/H (consumer-zone, docs, orchestrator+product, tests+корень) — 100% KEEP:** сирот нет, манифесты сходятся, все тесты в verify-цепи; `.obsidian`/`HOME.md` — осознанное решение DEC-DEV-0046, не трогать. D7-механизмы (~75) — ВСЕ живые; work-order D7_DEADWEIGHT_CLEANUP помечен EXECUTED (гипотеза «мёртвые скрипты» не подтвердилась).
7. **Компактация канонов (DEV_JOURNAL −83% / CHANGELOG −78% / ROADMAP −74% / audit-journal.ndjson = DEFER как dedup-память) — отдельный PR-3** после merge PR-1/PR-2: контракт-чек пройден (process-gate матчит имена файлов content-agnostic; единственный входящий якорь — `ROADMAP.md#где-мы-сейчас`, секция остаётся дословно).

### Outcome
PR-1: 41 move + 8 delete (audit-reports) + ротация индекса + 19 брифов + research-cache + 11 файлов process-fabric в архив; untrack PDF; spec-drift-sweep по всем перемещённым basename (ссылки в живых доках обновлены; накопительная история DEV_JOURNAL/CHANGELOG намеренно НЕ переписана — point-in-time); `dev/README.md` переписан под фактическое состояние; `check-counts` ✓ 24/44; `npm run verify` EXIT=0. Инспекция: 20 агентов, ~1.74M токенов, 0 ошибок; вердикты — в transcript workflow `wf_6d7f101f-990`.
PR-2: инициативы вынесены — github.com/IlyaNSV/product-radar (12 ф.) + github.com/IlyaNSV/factory-conductor (2 ф. + ORIGIN.md), локальные клоны в WebstormProjects/; директории удалены из dev/.
PR-3: компактация исполнена fence-aware сплиттером — DEV_JOURNAL 1.24 МБ→323 КБ (записи 0001-0123+Backfill → _archive/journal/, вклинившийся после 0160 fenced-шаблон и осиротевший пустой заголовок «Шаблон» приведены в порядок: шаблон теперь один, в конце файла), CHANGELOG 291→182 КБ (релизы 1.0-1.6 → _archive/changelog/; прогноз −78% не сбылся по байтам — тяжесть в свежих релизах, они обязаны остаться), ROADMAP 94→62 КБ (блоки фаз 0-7 + PILOT POINT + Dependencies graph → _archive/roadmap/ + pointer-таблица; «Где мы сейчас» дословно; Post-MVP/v2 candidates оставлены живыми — forward-looking); audit-journal.ndjson — осознанный DEFER (dedup-память). Правила ротации закодифицированы: CONVENTIONS §5.1 (таблица всех 5 канонов) + patch-cut.md (CHANGELOG+журнал на cut) + phase-closure.md (ROADMAP на closure). verify EXIT=0 после компактации.

### Lessons
1. Двухстадийная диспозиция (classify → adversarial verify) — не бюрократия: 6 из 72 не-KEEP вердиктов отменены верификатором с конкретной живой проводкой (PHASE_4.md evidence, design-SSOT process-fabric). Одностадийный классификатор порвал бы retention-контракт.
2. Markdown-таблицы с «свободными» колонками нельзя парсить по индексу слева: вложенный `|` в значении сдвигает всё. Парсить от конца (хвост таблицы стабилен) или по sentinel-якорям.
3. «Ссылка есть» ≠ «проводка есть»: provenance-комменты в шапках кода и упоминания в накопительной истории — не runtime-зависимости; но при переносе их всё равно надо обновлять/помечать, иначе доки врут о местоположении.

---

## Шаблон новой записи

```markdown
## DEC-DEV-NNNN — <one-line title>

**Date:** YYYY-MM-DD
**Trigger:** <what prompted this>
**Tag:** #category #subcategory

### Context
What was the situation, what constraints applied.

### Options considered
1. Option A — pros/cons
2. Option B — pros/cons
3. ...

### Decision
What was chosen and why.

### Outcome
What happened after applying. (Filled in retroactively if outcome takes time.)

### Lessons
What to remember next time.
```
