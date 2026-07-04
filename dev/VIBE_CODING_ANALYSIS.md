# Анализ документа Google «The new Software Development Lifecycle with Vibe Coding» (май 2026) применительно к Ecosystem 3.0

> Источник: канонический реестр из 140 идей (VC-001..VC-140), пофазовые оценки применимости к репозиторию, вердикт критика полноты (coverage_ok=true). Все утверждения «уже есть в экосистеме» подкреплены путями файлов из оценок.
> Дата анализа: 2026-07-04.

---

## 1. Суть документа

Google формулирует центральный тезис: происходит глубочайший со времён появления высокоуровневых языков сдвиг в software engineering — от написания синтаксиса к выражению **намерения (intent)**, где человек становится поставщиком суждения, а машина берёт на себя реализацию. Программирование исторически было «переводом» (проблема → абстракция → машинный синтаксис), и каждый шаг вносил трение; AI это трение схлопывает. Документ вводит **спектр** от casual «vibe coding» (промпт и приём чего угодно без проверки) до дисциплинированного «agentic engineering» (AI как implementation engine внутри спроектированных ограничений, тестов и feedback-loops при человеческом надзоре) — и подчёркивает, что различитель не факт использования AI, а **объём структуры, верификации и суждения** вокруг вывода. Даётся анатомия AI-агента (perceive-plan-act-observe-iterate loop; пять частей: model/tools/memory/orchestration/deployment) и таксономия сред (editor/terminal/background). Ключевой навык эпохи — **context engineering** (шесть типов контекста, static vs dynamic граница как архитектурное решение, Agent Skills + progressive disclosure), сместивший бутылочное горлышко с синтаксиса на контекст. Документ проходит **пофазовую трансформацию SDLC**: требования становятся диалогом, архитектура остаётся человеко-центричной, реализация ускоряется (25-39%, но METR показывает и замедление на 19% из-за верификации), maintenance/tech-debt открываются AI. **Верификация** объявлена главным различителем: тесты (детерминированное) vs эвалы (недетерминированное), output vs trajectory evaluation, тесты/эвалы как контракт намерения, continuous quality flywheel. Вводится **factory model** и **harness engineering**: Agent = Model + Harness, где harness (instructions, tools, sandboxes, orchestration, guardrails, observability) доминирует над поведением, а «большинство сбоев агента — сбои конфигурации, а не модели» (доказано бенчмарками Terminal Bench). Роль разработчика раздваивается на **conductor** (hands-on) и **orchestrator** (async-делегирование), и обостряется **«80% problem»**: AI даёт ~80% фичи, оставшиеся 20% требуют человеческого контекста, а природа ошибок сместилась от синтаксических к концептуальным. Экономический слой: TCO важнее velocity, vibe coding = Low CapEx / High OpEx (скрытый долг), agentic engineering = High CapEx / Low OpEx, multi-model routing против waste. Завершает документ набор durable-принципов («Structure scales, vibes don't»; «Human role is evolving, not diminishing») и афоризм: **«Generation is solved. Verification, judgment, and direction are the new craft.»**

---

## 2. Валидация: что экосистема уже делает правильно

Документ — это независимое peer-описание best practice, и Ecosystem 3.0 совпадает с его дисциплинированным («agentic engineering») концом по большинству несущих осей. Это ценно как **подтверждение курса**: проект интуитивно построил то, что Google формализует.

| Идея документа | Где в репо | Комментарий |
|---|---|---|
| VC-001/004 Сдвиг синтаксис→намерение; «что» vs «как» | `README.md` (Концепция), `docs/guide/00-concepts.md §1`, `docs/pmo/pmo-map.md` | Онтология проекта: D1/D2-Behavioral под детальным контролем, D2-T/D3-D6 делегированы. Не идея к внедрению — фундамент. |
| VC-002 Программирование как перевод, порождающий трение | `docs/product-module/handoff-spec.md §1` | Universal self-contained `handoff.md` снимает friction-шов спецификация→реализация (DEC-A06). |
| VC-006 Автокомплит→автономия | `dev/ECOSYSTEM_VISION.md §2.1/§5`, `CLAUDE.md` (Autoflow), `orchestrator/processes/*.mjs` | Проект уже на автономном конце: clone-plan-verify-PR; автономия формализована как enum L0-L3. |
| VC-010 «Generation is solved. Verification is the craft» | `README.md` принцип 5, `agents/product/devils-advocate.md`, `orchestrator/lib/{coverage,fidelity}-oracle.cjs` | Максимально покрыто: вся инженерия построена вокруг верификации/суждения/направления, а не генерации. |
| VC-023 Agent Loop perceive-plan-act-observe-iterate | `orchestrator/README.md`, `orchestrator/processes/validate-feature-impl.mjs` | Ядро оркестратора: Plan→Implement→Validate→Report→re-run; bounded completeness-loop (Vision Epic B). |
| VC-039 Кейс Anthropic: узкое место → спецификация + верификация | `README.md`, `dev/ECOSYSTEM_VISION.md §0/§4`, оракулы coverage/fidelity | Внешнее свидетельство ровно формулы экосистемы. |
| VC-042/043/045 Шесть типов контекста; static/dynamic; Agent Skills | `CLAUDE.md` (auto-load), `skills/product/*.md`, `docs/product-module/SPEC.md §4.6` | Progressive disclosure трёхслойный; бюджет ~3-5 skills; все шесть типов контекста присутствуют. |
| VC-068/069/070 Верификация как различитель; тесты vs эвалы; output vs trajectory | `orchestrator/README.md` (модель детерминизма L31), `consilium-synth.cjs`, `fidelity-oracle.cjs`, `runtime-readiness.cjs` | Оба механизма явно разделены; fidelity-oracle ловит фабрикованные trace-refs (trajectory), runtime-readiness — «тесты зелёные ≠ стартует» (output глубже сборки). |
| VC-076/077 Factory model; критерии успеха вместо шагов | `docs/pmo/processes.md §1.1`, `skills/orchestrator/tdd-impl-loop.md`, `dev/ECOSYSTEM_VISION.md §0` | Экосистема — meta-tool, чей output = машинерия, производящая код. Все 5 компонентов модели верифицируемы. |
| VC-079/080/081 Antipattern «модель = система»; Agent = Model + Harness | `~/.claude/CLAUDE.md` (MDP), `hooks/product/session-state.js`, `process-gate.js` | MDP: «делегирование ≠ доверие», бриф компенсирует тир, ревью дешёвых тиров. Поведение регулируется harness-слоем. |
| VC-082..088 Harness-компоненты (instructions/tools/sandbox/orchestration/guardrails) | `CLAUDE.md`, `commands/`, `hooks/product/manifest.yaml`, `zone-router.cjs`, `gate-risk-classifier.cjs` | Одна из самых зрелых зон. Хуки дословно = «то, что агент не должен забывать» (🔒 hard-enforced). |
| VC-089..091 Harness по фазам SDLC | `commands/ecosystem/bootstrap.md`, `feature-to-tdd-impl.mjs`, `remediation-guard.cjs` | Фаза 1 (bootstrap конфигурит harness), фаза 2 (P5 impl в worktree), фаза 3 (P6 think→act→observe) совпадают дословно. |
| VC-100..107 Conductor/orchestrator; 80% problem; концептуальные ошибки | `docs/orchestrator-module/SPEC.md §7`, `README.md`, `dev/ECOSYSTEM_VISION.md §4`, `docs/guide/06-gates.md §4` | RUN 01: 23/26 задач без человеческого гейта, суждение сконцентрировано в scope; conflicts[] понижает GO→MANUAL_VERIFY (замятый конфликт под зелёным тестом). |
| VC-072/123 Тесты/эвалы как контракт намерения; писать до кода | `docs/pmo/artifacts/VC.md`, `handoff-spec.md`, `coverage-oracle.cjs` | VC-артефакт: «именно VC попадает в тесты через внешний QA-инструмент». TDD RED→GREEN→REFACTOR в P5. |
| VC-073 Continuous quality flywheel | `dev/meta-improvement/scripts/{classify,check-counts}.js`, `feedback-intake.js`, `live-run-validation.md` | Оценка→кластеризация root-cause→оптимизация→regression-verify→dogfood. Accumulation-контракт CHANGELOG/DEV_JOURNAL. |
| VC-074/124/129 AI как first-pass reviewer; ревью каждой строки; ревью AI-кода | `skills/orchestrator/{tdd-impl-loop,gate-risk-classifier}.md`, `agents/product/*.md`, `CLAUDE.md` (Autoflow §6 «СТОП перед merge») | Adversarial reviewer + персоны; человек-в-конце жёстко (merge = владелец). |
| VC-105/106 Ошибки сместились от синтаксических к концептуальным; «выглядит правильно» | `docs/guide/06-gates.md §1-4`, `docs/pmo/artifacts/{BR,IC}.md`, cascade-check/conflicts[] | Валидационная машинерия спроектирована под концептуальные сбои: readiness-ось, masked:true, оракулы СВЕРХ тестов. |
| VC-111..117/119/138/139 Экономика high-CapEx/low-OpEx; force-multiplier; durable-принципы | `CLAUDE.md`, `settings.json.template` (_model_strategy), `agents/*/*.md` (per-agent model), MDP | Structure-first дизайн явно отвергает vibe coding; многотировая model-стратегия закодирована. |
| VC-135 (MCP-половина) Открытые стандарты | `commands/ecosystem/bootstrap.md` (Step 9), `docs/integrator-module/SPEC.md` | MCP first-class; A2A сознательно не принят после анализа Claude-native примитивов. |

**Честная оценка:** по нескольким осям экосистема **строже** документа. Google в VC-036/040/058 оптимистично утверждает «прототип вчера = прод сегодня без переписывания» и «requirements→prototype near-zero collapse» — экосистема, опираясь на METR/error-compounding (0.9^n), эти утверждения **сознательно отвергает** (см. §6), ставя gated-сегмент до-прода. То есть в вопросе сквозной автономной надёжности практика проекта дисциплинированнее нарратива источника.

---

## 3. Перенять (adopt)

**Чистых adopt-идей в оценках нет.** Это ожидаемо для зрелого meta-tool: каждая ценная идея документа либо уже воплощена (already-covered), либо требует **адаптации под словарь и архитектуру экосистемы** (adapt) — прямой перенос дублировал бы внешний источник или его вендор-стек. Поэтому раздел «adopt» пуст by design; наиболее близкие к «взять и добавить» — medium-priority элементы из §4 (VC-014 позиционный абзац, VC-096 триаж-паттерн, VC-044 бюджет-аудит), которые являются net-new артефактами, но требуют формулировки в терминах проекта.

---

## 4. Адаптировать (adapt)

Сортировка по priority (medium → low). Effort: S = мелкий (абзац/чеклист/пункт), M = средний (код/новый артефакт).

### Medium priority

**VC-014 — Назвать спектр vibe→agentic как якорь «зачем столько структуры»** · effort S
- **Куда:** `docs/guide/00-concepts.md §1` или `README.md` (Концепция в одной строке).
- **Адаптация:** короткий абзац (~4-6 строк): «Экосистема — не про факт использования AI, а про то, СКОЛЬКО структуры/верификации/суждения окружает вывод; она сознательно живёт на дисциплинированном конце (agentic engineering)». Grep по `vibe|agentic engineering` даёт только dev/research-cache — в user-facing доках рамки нет.
- **Зачем:** ценно для clone/fork-читателей (README допускает форк). Без новой машинерии.

**VC-044 — Регулярный аудит static-context бюджета** · effort S
- **Куда:** `dev/meta-improvement/checklists/phase-kickoff.md` (или отдельный micro-чеклист).
- **Адаптация:** пункт «static-context budget audit» — периодически инвентаризовать always-on окно (секции CLAUDE.md 281 стр., SessionStart-inject RAILS.md 76 стр., auto-load process-триггеры, hook-preambles), оценить sanity размера, решить «оставить в static / вынести в lazy skill / в reference-док». Фиксировать как DEC-DEV при резке/добавлении always-on контента.
- **Зачем:** always-on окно реально растёт и платит токенами каждый запрос; дешёвая, но ценная страховка. Компромисс осознаётся точечно, но регулярного ревью границы как версионируемой конфигурации нет.

**VC-087 — Количественная observability: run-ledger** · effort M
- **Куда:** `orchestrator/processes/*.mjs` (эмитить рядом с `dev/meta-improvement/audit-journal.ndjson`).
- **Адаптация:** каждый Workflow-прогон эмитит компактный run-ledger (per-agent: model, длительность, verdict, tokens если harness отдаёт usage). Начать с duration+model+verdict (доступны без API), tokens — opportunistic.
- **Зачем:** поведенческая observability сильна (audit-journal, effect-probe, feedback-intake), но количественной (cost/latency/drift) НЕТ — grep не находит ни token-count, ни latency. Это дренаж «тихого дрейфа» авто-прогонов.

**VC-096 — D7-паттерн «config-failure-first triage»** · effort S
- **Куда:** `dev/meta-improvement/patterns/config-failure-first-triage.md` (каталог из 8 паттернов).
- **Адаптация:** при мисбихейворе агента прогнать чеклист harness-причин (отсутствующий tool? расплывчатое правило? отсутствующий guardrail? зашумлённый контекст?) ПРЕЖДЕ чем списывать на модель. Связать с DEV_JOURNAL root-cause-триггером и `da-subagent-type-contract.md` (прецедент триажа harness-vs-skill).
- **Зачем:** ловит реальный класс мис-диагнозов (ср. пилотный FB-020). Дисциплина root-cause есть де-факто, но явного чеклиста нет.

**VC-118 — Пиновать model per-stage в orchestrator agent()-вызовах** · effort M
- **Куда:** `orchestrator/processes/*.mjs`, начать с `feature-to-tdd-impl.mjs` (10+ agent-вызовов).
- **Адаптация:** проставить `opts.model` по MDP: opus для plan/architecture, sonnet/haiku для механики (генерация тестов, inline-verify, plan-parse).
- **Зачем:** **задокументированный, но не закрытый разрыв** — MDP §3 предписывает пиновать модель, но фактические agent()-вызовы её НЕ передают (grep подтвердил → наследуют дорогую модель сессии). Закрывает waste + конфаунд.

**VC-133/VC-134 — Production-substrate graduation gate + 4-пунктовый чеклист** · effort M
- **Куда:** `dev/gates/` (новый readiness-гейт), ссылается на 4 компонента.
- **Адаптация:** явный порог graduation пилота — 4 компонента должны быть зелёными до объявления процесса production-ready: (1) evals в CI — **GAP** (нет .github/workflows; verify только локально); (2) трейсы каждого прогона — **явный GAP** (`runs/` «NOT auto-created», commands/orchestrator/run.md:239); (3) scoped permissions per agent — покрыто (tools-frontmatter + scope-guard); (4) security review — частично (verify-finding-before-act). Приоритетно закрыть трейс-ногу (авто-создание `runs/<id>/`) — она же питает VC-087. CI-evals: минимальный GitHub Action на `npm run verify` ЛИБО явно задокументировать process-gate+локальный verify как осознанный solo-субститут CI.
- **Зачем:** тайминг-принцип «substrate до первого production-агента» ценен; трейс- и CI-ноги реально отсутствуют.

### Low priority

**VC-019 — Таблица-проекция спектра словарём экосистемы** · effort M · опционально
- **Куда:** `docs/guide/06-gates.md` (врезка) или `00-concepts.md`.
- **Адаптация:** таблица 3 позиции × измерения, заполненная СЛОВАРЁМ экосистемы (validation_tier=pilot/mvp/full, review-levels 🔴🟠🟡🟢, verdict×readiness, product_class), показывающая «экосистема = колонка agentic engineering». Не тащить чужие ярлыки как есть. Ценность инкрементальна (пересекается с 00-concepts §5 + validation.md §2.3), отсюда low.

**VC-078 — Явная рамка Agent = Model + Harness как онбординг** · effort S
- **Куда:** `README.md` или `CLAUDE.md` («Что строим»).
- **Адаптация:** абзац: назвать уравнение и указать, что Ecosystem 3.0 — harness-слой поверх Claude Code, а не «умнее модель». Термин «harness» в репо есть только узко («in-harness Workflow»).

**VC-097 — Линза «два режима оператора»** · effort S
- **Куда:** `docs/guide/00-concepts.md`.
- **Адаптация:** раздел: (a) hands-on/пошаговый контроль (feature-session, per-item approve на D1-D2B) vs (b) async-делегирование (`/product:complete`, `/orchestrator:run` → ревью GO/NO-GO). Экосистема нарезает дуальность по ФАЗЕ, документ — по РЕЖИМУ; дуальность есть даже внутри owned-зоны. Чисто документационное.

**VC-071 — Property/invariant тестирование в qa-advisor** · effort S
- **Куда:** `agents/product/qa-advisor.md` Lens 3 (или Lens 1 testability); опц. `docs/pmo/artifacts/VC.md` поле `suggested_test_type: property`.
- **Адаптация:** для BR-констрейнтов/доменных сущностей называть свойство, держащееся для ВСЕХ входов (не только пример). qa-advisor мыслит example-based; инварианты нигде явно не названы. Исполнение property-тестов downstream → low.

**VC-127 — «Built = smoke прогнан, не написан»** · effort S
- **Куда:** `phase-closure.md` / `live-run-validation.md`; опц. warn-хук.
- **Адаптация:** процесс/агент не built, пока runtime-smoke реально ПРОГНАН зелёным. Живая натяжка: PATCH_1.3.3, PHASE_6, S-LE gate warn→strict месяцами стоят «next pilot session» — помечены built по написанному плану, не прогнанному eval.

**VC-128 — 5-мерный agent-eval scorecard** · effort S
- **Куда:** `dev/meta-improvement/rubrics/orchestrator.md` + persona-агенты.
- **Адаптация:** блок task_success / tool_use_quality / trajectory_compliance / hallucination / response_quality как чек-лист грейдера live-run. Части покрыты (hallucination→verify-finding; trajectory→рубрика), но единого scorecard нет.

**VC-024 — Линзы в конвенции agent-файла + EVAL-измерение** · effort S · при Epic G
- **Куда:** конвенция agent-файла (`dev/ECOSYSTEM_VISION.md §2.4`, Epic G3).
- **Адаптация:** model/tools/orchestration уже во frontmatter; добавить EVAL-измерение («как проверяется польза персоны» — сейчас только ad-hoc live-run + blind-comparison); memory/deployment пометить N/A для advisory-субагентов.

**VC-135 (A2A-половина) — watch-item** · effort S
- **Куда:** `dev/ECOSYSTEM_VISION.md` watch-item.
- **Адаптация:** MCP оставить как есть; A2A не внедрять, но зафиксировать: пересмотреть, когда Epic C/D потребует peer-messaging (текущий Workflow fan-out достаточен). Держит опцию смены вендора открытой.

---

## 5. Отложить (defer) — с триггерами

| Идея | Условие расконсервации |
|---|---|
| VC-029 Background-агенты (облачный sandbox → PR) | Старт сегмента до-прода (Vision Epic E) с реально длинными шагами (CI/deploy). Задел: SPEC §8 Background Agents + ScheduleWakeup. |
| VC-032 Agent-as-product handoff-профиль | Появление пилота, чей deliverable — сам AI-агент (my-first-test строит web-app, не агента). |
| VC-033 Substrate персон (eval-fixtures + observability) | Рост роутинга персон (Epic G) ИЛИ agent-product-пилот. Сейчас 7 субагентов + solo → рано. |
| VC-049 Companion paper Day-3 (Sessions/Skills/Memory) | Старт работы по VC-044 (бюджет-аудит) или боль от раздутого auto-load. |
| VC-065/066 Maintenance legacy-баз, tech-debt рефакторинг | Спрос пилота на brownfield-онбординг ИЛИ активация D5. Задел: spec-traceability. |
| VC-067/092 AI-aware deployment + live-observability | Старт Epic E / Integrator D3-runtime. Уже зароадмаплено (Epic E coordinate-only, floor prod_deploy=human). Проектировать вместе с VC-087. |
| VC-075 Human reviewers при agent-driven объёме PR | Когда параллельные AI-сессии генерят PR быстрее, чем владелец ревьюит (слабый сигнал — коллизии номеров/веток уже есть). Тогда bundled PR-summary + conditional LGTM, финальный LGTM за владельцем. |
| VC-108 Двух-осевой ландшафт autonomy × integration | Kickoff Epic F (autonomy-resolver L0-L3) или Epic G (agent-roster матрица). Резолвер `autonomy-policy.cjs` спроектирован, но в репо отсутствует — вводить таксономию до Epic F/G преждевременно. |
| VC-109/110 TCO + CapEx/OpEx учёт | Появление внешних потребителей/команды/мульти-пилота или бюджет токенов как ограничение. Полезно как ретроспективная линза в DEV_JOURNAL. |

---

## 6. Сознательно не брать (reject) — кратко

- **Риторика/статистика адопции** (VC-003 историческая аналогия, VC-005 85%/51%/41%, VC-062 25-39% рост): нулевая операционная поверхность в solo-dev PMO; проект политикой избегает productivity/hour-оценок (CLAUDE.md принцип 5).
- **Org/HR-обёртки** (VC-012/015 разговор с CTO, VC-125 держать skills острыми, VC-137 найм под суждение): нет получателя — solo dev + AI без команды. Полезное ядро уже покрыто механически (validation_tier, north-star autonomy/obedience).
- **Мета-навигация документа** (VC-008 обзор моделей, VC-011/013 цель/траектория, VC-048 «мост», VC-053 waterfall→agile история, VC-140 указатель Day 5): навигационные рамки эссе, не практика; субстантивные модели оцениваются под своими темами.
- **IDE/editor-слой** (VC-025/026/027/030/031/037 editor-агенты, Copilot/Cursor, маппинг категорий; VC-098/099 conductor real-time code-watching): ортогонально PMO-слою — экосистема terminal-native и tool-agnostic для D2-T/D3-D6, выбор code-ассистента на слой ниже.
- **Вендор-стек Google** (VC-034/035 Agents CLI/ADK, Agent Runtime): экосистема Claude-native; конкретный GCP-стек в ядро не тянем (escape-hatch: Integrator может подключить как внешний D3 по факту нужды).
- **Оптимистичный фрейминг сквозной автономии** (VC-036/040/058 «прототип=прод без переписывания», «requirements→prototype near-zero collapse»): **прямо конфликтует с research-обоснованной позицией проекта** (METR error-compounding, gated-сегмент до-прода). Принять = ослабить anti-over-engineering рельсы (floor/reversibility/phase-gates).
- **Внешние case-study как подтверждение** (VC-016/017/018 история термина, VC-094/095 Terminal Bench/LangChain): проект уже живёт этим уроком (harness-first); максимум — цитата в Vision §4, ценность маргинальна.

---

## 7. Риски и антипаттерны из документа, релевантные проекту

Хотя структурно экосистема защищена, документ подсвечивает failure modes, за которыми стоит следить в пилоте my-first-test:

1. **«80% problem» + концептуальные ошибки, которые "выглядят правильно"** (VC-104/105/106). Главный риск AI-эры: код проходит базовые тесты, маскируя дефект бизнес-логики. Защита есть (readiness-ось, conflicts[]→MANUAL_VERIFY, masked-флаг, оракулы сверх тестов, verify-before-act), но именно здесь концентрируется человеческое суждение — не ослаблять hard-approve на BR/IC (🔴 никогда не auto).
2. **«Большинство сбоев агента — сбои конфигурации»** (VC-096). При мисбихейворе первый инстинкт — винить модель; чаще это missing tool / расплывчатое правило / missing guardrail / зашумлённый контекст. → адрес: VC-096 триаж-паттерн.
3. **Token burn / prompting loops** (VC-112) и **раздутый static-контекст** (VC-044/050/051). Always-on окно (CLAUDE.md 281 стр. + RAILS + hook-preambles) растёт молча. → адрес: VC-044.
4. **Verification tax / METR-замедление** (VC-063). AI может замедлять на определённых задачах из-за верификации — экосистема это уже сделала рычагом №1 (качество входа, Epic B), но следить, чтобы гейты не превратились в чистый tax без сигнала.
5. **Планка = eval, а не демо** (VC-127). Реальная натяжка: несколько runtime-smoke помечены built по написанному плану, а не прогнанному eval. → адрес: VC-127.
6. **Multi-model waste / конфаунд** (VC-117/118). agent()-вызовы наследуют дорогую модель сессии вопреки MDP. → адрес: VC-118.
7. **Тихий дрейф без количественной observability** (VC-087). Без cost/latency/drift-метрик авто-прогоны дрейфуют незаметно. → адрес: VC-087.
8. **Прототип, случайно попавший в прод** (VC-130/133). Для solo без vibe-ветки риск ниже, но substrate-порог graduation (evals-в-CI, трейсы) пока не оформлен. → адрес: VC-133/134.

---

## 8. Рекомендуемый порядок внедрения

Согласовано с текущими треками (Vision epics, orchestrator, D7). Все пункты — небольшие, кроме M-элементов; ни один не требует новой архитектуры.

1. **Быстрые S-документационные якоря (одним doc-PR):** VC-014 (назвать спектр) + VC-078 (рамка Agent=Model+Harness) + VC-097 (два режима оператора) в `docs/guide/00-concepts.md` / `README.md`. Дёшево, повышает ориентацию свежих AI-сессий, ложится в идущий doc-UX трек.
2. **D7-паттерн триажа (S):** VC-096 `config-failure-first-triage.md` в `dev/meta-improvement/patterns/` + связка с DEV_JOURNAL root-cause. Ловит реальный класс мис-диагнозов, независим от Vision.
3. **Закрыть задокументированный MDP-разрыв (M):** VC-118 — проставить `opts.model` в `orchestrator/processes/*.mjs`, начать с `feature-to-tdd-impl.mjs`. Убирает waste + конфаунд, прямо исполняет MDP §3.
4. **Static-context бюджет-аудит (S):** VC-044 — пункт в `phase-kickoff.md`; при желании прочитать companion Day-3 (VC-049) перед этим.
5. **Observability + трейсы (M, парой):** VC-087 (run-ledger) + трейс-нога VC-134 (авто-создание `runs/<id>/`) — общий код, эмит рядом с audit-journal.ndjson. Дренаж тихого дрейфа; фундамент для будущего Epic E.
6. **Substrate-graduation гейт (M):** VC-133/VC-134 (CI-eval решение + 4-пунктовый чеклист) в `dev/gates/`. Оформить порог production-ready пилота; синхронизировать с VC-127 (built = прогнан).
7. **Отложенные линзы — при kickoff соответствующих эпиков:** VC-108 (autonomy×integration) и VC-024 (EVAL-измерение персон) вложить в дизайн Epic F/G, когда они стартуют, а не раньше (риск расхождения с их дизайном). Low-priority доп-рубрики VC-019/071/128/135 — по мере касания соответствующих файлов.
