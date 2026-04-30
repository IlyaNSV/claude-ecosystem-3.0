# Референсная модель PMO — Обзор и методология

> **Что это.** Референсная модель кастомного AI-based PMO (Ecosystem 3.0). Используется как «эталон», против которого сравниваются снапшоты реальной экосистемы в разные моменты времени.
>
> **Что это НЕ.** Не roadmap, не SPEC, не план разработки. Это критерий, **относительно которого** ты понимаешь, на верном ли ты пути.
>
> **Версия:** 0.2 draft (2026-04-30). Полный каркас 13 разделов + bibliography, готов к практическому использованию.

---

## 1. Зачем нужна референсная модель

Ты строишь экосистему **сам**, без коллективной обратной связи и без метрик от пользователей до PILOT POINT. Это создаёт два класса рисков (явно зафиксированных в твоём `CLAUDE.md` принципе #3 «Meta-проект — высокий риск самореферентного коллапса»):

1. **Дрейф между сессиями развития** — то, что строится в Phase N+2, может незаметно отойти от исходного замысла, заложенного в Phase 0-1, без явного сигнала.
2. **Концептуальная слепота** — отдельные хорошие идеи могут существовать **внутри** экосистемы, при этом существенный класс функций, которые индустрия научилась решать за 20-40 лет, может остаться непокрытым, и об этом не у кого узнать.

Внутренние drift-mitigation механизмы (`/product:drift-check`, `confidence:` поля, `/product:meta-feedback`, `/product:patterns`) проверяют **внутреннюю согласованность** экосистемы относительно её собственного состояния. Они не отвечают на вопрос **«а правильную ли вообще игру я играю»**.

Этот референс — внешняя точка отсчёта. Он не идеал. Это собранная вместе **функциональная карта PMO-практик**, которая (a) известна индустрии и (b) применима к твоему контексту (solo + AI + Claude Code + tool-agnostic делегирование).

### 1.1 Фундаментальное правило: экосистема ≠ только Claude Code

Ecosystem 3.0 **по умолчанию** реализуется через Claude Code primitives (commands, skills, agents, hooks). Но это **не закон** — это default. Любая функция референса может быть реализована **за пределами Claude Code** через:

- внешние инструменты, подключённые через Integrator (как сейчас планируется для D2-Tech / D3-D6)
- параллельные harness-системы (Cowork и подобные классы) для зон, где Claude Code не оптимален
- standalone сервисы / scripts / dashboards, интегрируемые через handoff-pattern или прямую ссылку из артефактов

**Когда выходить за пределы Claude Code оправдано:**
- функция требует **non-conversational UI** (визуальный dashboard, drag-and-drop, графический builder)
- функция требует **persistent runtime** между сессиями (мониторинг, scheduled jobs за пределами `ScheduleWakeup`)
- функция требует **multi-user collaboration** (когда команда появится post-pilot)
- функция уже имеет **зрелое внешнее решение**, дублировать которое в Claude Code primitives — over-investment
- функция требует **доступа к данным**, которые не должны жить в `.product/` (например, sensitive analytics)

В каждом разделе референса функции получают маркер **Implementation locus** (см. §2.4):
- **CC** — реализовано через Claude Code primitive
- **EXT** — реализовано во внешнем инструменте через Integrator/adapter
- **HYB** — гибрид
- **N/A** — не имеет реализации (intent-only или out-of-scope)

Diff между снапшотами по locus — **самостоятельный сигнал**: «функция мигрировала CC → EXT» (или наоборот) — это значимое архитектурное событие, требующее DEV_JOURNAL entry с rationale, независимо от того, изменилось ли coverage.

## 2. Как этим пользоваться

### 2.1 Snapshot-comparison protocol (предполагаемый)

Сам механизм снапшотов и diff'ов — отдельная задача (ты сказал «механизм создания снапшотов и сопоставления будем делать после этого; тут уже попахивает мета-доменом»). Этот документ описывает только **референс**.

Но чтобы референс был сконструирован под будущее сравнение, фиксируем минимальные предположения:

- Снапшот — git-tag или ветка состояния `claude-ecosystem-3.0` в момент времени T.
- Сравнение проходит **по разделам референса**, не «по всему сразу».
- Каждая функция в каждом разделе оценивается **по двум независимым осям** (детали ниже):
  - **Уровень покрытия** (0/1/2/3 + N/A) — насколько глубоко функция операционализирована
  - **Implementation locus** (CC / EXT / HYB / N/A) — где живёт реализация

### 2.2 Шкала покрытия — четырёхуровневая

Каждый пункт в `Чеклист покрытия` каждого раздела получает один из значков:

| Уровень | Значок | Определение | Пример |
|---|---|---|---|
| **0** | ✗ | **Not covered.** Функция не адресована экосистемой никаким образом — нет реализации, нет doc, нет плана. | (snapshot N+1: упоминание о visualization добавили, но ничего не реализовано — 1, не 0; чтобы быть 0, функция должна вообще не появляться) |
| **1** | ◔ | **Acknowledged.** Функция упомянута в SPEC / ROADMAP / комментариях / DEV_JOURNAL, но **не операционализирована**. Существует как намерение, не как runnable mechanism. | NFR upgrade-tier batch review упомянут в processes.md §11.3 как future command, но `/product:nfr:upgrade-tier` ещё не реализован → **1** |
| **2** | ◐ | **Partially operationalized.** Есть рабочая реализация, покрывающая основной кейс; ключевые подзадачи отложены (с явной roadmap-записью) или требуют ручного workaround'а. | Mass-rename — `/product:bg:rename` работает в режиме manual preview; atomic propagation отложен до v1.1 → **2** |
| **3** | ● | **Fully operationalized.** End-to-end реализация с автоматизацией где применимо, явной обработкой ошибок, и видимостью самого поведения функции (logs, status, observability). | BG continuous extraction (Phase 1 candidate detection через `bg-extractor.js` хук + Phase 2-4 review pipeline + `used_in[]` tracking) → **3** |
| **N/A** | — | **Out of scope.** Функция явно объявлена out-of-scope с rationale (cross-reference в Section 12). | Portfolio management, OKR cadence, group event storming — N/A для solo |

**Правило записи в DEV_JOURNAL при diff:**

| Маркер пункта | Изменение покрытия | Триггер DEV_JOURNAL |
|---|---|---|
| `[C]` | На 1+ уровень в любом направлении | ✓ обязательно |
| `[F/C]` | На 1+ уровень вниз ИЛИ на 2+ уровня вверх | ✓ обязательно |
| `[F]` | На 2+ уровня в любом направлении | ✓ обязательно |
| любой | ↔ Из/в N/A | ✓ обязательно (требует rationale в обновлении Section 12) |

Меньшие изменения (1 уровень для `[F/C]` или `[F]`) — фиксируются в snapshot diff отчёте, но не требуют отдельной записи в DEV_JOURNAL.

### 2.3 Conformance vs Fitness

Ты выбрал политику **Fitness > Conformance** (с долей Conformance там, где полезно).

В каждом разделе пункты помечены:

- **`[C]` Conformance** — устоявшаяся индустриальная практика, отклонение требует обоснования
- **`[F]` Fitness** — адаптация под твой контекст (solo, AI-driven, multi-harness, tool-agnostic), индустриальный аналог либо отсутствует, либо не подходит
- **`[F/C]`** — гибрид; имеет индустриальный корень, но твоя реализация сознательно отходит

Когда сравниваешь снапшоты, **дивергенция по `[C]`-пунктам — повод задуматься; дивергенция по `[F]`-пунктам — норма, если объяснима**.

### 2.4 Implementation locus

Вторая ось измерения. Где живёт реализация функции:

| Locus | Значение | Пример |
|---|---|---|
| **CC** | Реализовано как Claude Code primitive (command, skill, agent, hook) | BG extraction hook, /product:feature command — CC |
| **EXT** | Реализовано во внешнем инструменте через Integrator + adapter (или другой harness, например Cowork) | cc-sdd для генерации D2-Tech спецификаций — EXT |
| **HYB** | Гибридная реализация: часть в CC, часть во внешнем | Design Module: MK frontmatter в CC, визуальные mockups в Stitch — HYB |
| **N/A** | Нет реализации (intent-only) или функция out-of-scope | Continuous outcome tracking — пока N/A |

**Diff по locus — отдельный значимый сигнал:**

- **CC → EXT** — функция вынесена за пределы Claude Code. Причины: внешний инструмент оказался лучше; нужен persistent runtime; non-conversational UI; cross-session collaboration. **Требует записи в DEV_JOURNAL.**
- **EXT → CC** — функция возвращена в Claude Code. Причины: harness inadequate; адаптер слишком хрупкий; стоимость поддержки выше выгоды. **Требует записи в DEV_JOURNAL.**
- **CC → HYB** или **EXT → HYB** — частичная миграция. Часто следствие осознания «эту часть лучше там, остальное здесь». **Требует записи в DEV_JOURNAL.**
- **N/A → любое значение** — функция получила реализацию, обычно вместе с покрытием 0→1+ или больше. Уже triggered DEV_JOURNAL по дифф'у покрытия.

### 2.5 Чтение сигналов дивергенции

«На верном пути» = **сохранение замысла + закрытие функциональных пробелов, которые ты не видел в момент Phase 0**. Не «соответствие индустрии».

Конкретные эвристики:

- Если в snapshot N+1 ты видишь **новую функциональность**, которой нет в N, и она **не отражена в референсе** — сначала проверь: это (a) фундаментально новая фитнес-фича, заслуживающая дополнения референса, (b) дрейф в сторону усложнения без причины, (c) re-implementation чего-то, что и так уже было? Все три — допустимы, но рассматриваются разными способами.
- Если в snapshot N+1 ты видишь **исчезнувшую функциональность** относительно N (deprecated, deleted, simplified), и она была помечена `[C]` в референсе — это требует записи в DEV_JOURNAL с rationale (это уже зафиксировано в твоей конвенции репозитория).
- Если **референс эволюционирует** между снапшотами — это нормально, но фиксируется отдельно (changelog в `99-changelog.md`). Сравнение делается **по той версии референса, которая была актуальна в момент снапшота**, иначе мы сравниваем с мишенью, которая сама движется.

## 3. Scope: что в референсе, что нет

### 3.0 Ключевое разграничение: функциональные ожидания vs implementation methodologies

Отдельные зоны индустрии (testing, deployment, observability, architectural review, etc.) включают **два разных слоя**:

1. **Функциональные ожидания** — что должно быть **покрыто** в комплексной системе разработки продукта. Например: «должно ли быть integration testing? performance testing? security testing? архитектурное ревью перед major change? capacity planning?» — это **не методология**, это ответ на вопрос «полноценна ли наша система».
2. **Implementation methodologies** — **как** конкретно реализовывать каждое из этих ожиданий. Например: «как именно писать unit tests на JS», «какой framework для load testing», «как настроить Prometheus alerting».

**Этот референс описывает (1), не (2).** Implementation methodologies — это зона инструмента, подключённого через Integrator (или harness вне Claude Code), и она не должна быть зашита в референс.

**Практический эффект:**

- В каждом разделе функциональные ожидания **присутствуют как пункты** со шкалой покрытия. Например, в Section 3 (Domain Coverage Map) D4 Quality Assurance декомпозируется на подзоны: integration testing, e2e testing, performance testing, security testing, regression testing — и для каждой есть значение покрытия + locus.
- Когда `/integrator:add <tool>` — Integrator обращается к референсу как к чек-листу: «этот инструмент обещает покрыть какие подзоны D4? полностью или частично? с какой confidence?». Это уже работает в твоём `pmo-mapping.yaml`, но референс задаёт **полный список ожидаемых подзон**, против которого проверяются обещания инструмента.
- При diff снапшотов — изменение покрытия любой подзоны (не «D4 в целом», а конкретно «integration testing») — отдельный сигнал.

### 3.1 IN scope (функциональные ожидания)

| Зона | Почему |
|---|---|
| Product Discovery & Strategy practices (Cagan, Torres, Lean Startup, JTBD, Strategyzer) | Это твоя D1, и ты детально её контролируешь |
| Engineering specification practices (BDD, DDD, SbE, EARS, AC, NFR/ISO 25010, traceability, hash-pinned snapshots, threat models) | Это твоя D2-Behavioral + handoff |
| **Функциональные ожидания от D2-Technical** (architectural review, API contract design, data model design, spike/PoC management) | Не «как делать архитектуру», а «должно ли быть architectural review для major change, и для каких» |
| **Функциональные ожидания от D3 Implementation** (code-level review, change management, branching/merging discipline, dependency management) | Не «как программировать», а «какие гарантии должна давать implementation phase» |
| **Функциональные ожидания от D4 Quality Assurance** (unit/integration/e2e/performance/security/regression testing; manual QA cadence; test data management) | Не «как писать тесты», а «какие виды verification ожидаются от системы» |
| **Функциональные ожидания от D5 Operations** (monitoring, alerting, logging, incident response, SLO tracking, capacity planning, deployment strategies) | Не «настройка Prometheus», а «должна ли быть SLO дисциплина и какие уровни она охватывает» |
| AI-native operating practices (context engineering, agentic patterns, evals, anti-sycophancy, memory, skills, hooks, confidence calibration, drift mitigation) | Это твоя AI-driven база работы |
| Meta-governance practices (decision logs, ADRs, retrospectives, evaluator-optimizer pattern) | Это твой meta-домен (D6) и dev-журнал |
| Cross-harness integration (когда Claude Code не оптимален) | Отражает §1.1 правило «экосистема ≠ только Claude Code» |

### 3.2 OUT of scope

Только зоны, в которых **сама функциональная зона** неприменима для solo+AI или конфликтует с tool-agnostic philosophy.

| Зона | Почему |
|---|---|
| Portfolio / program management | Solo разработчик; нет нескольких параллельных продуктов, требующих балансировки бюджетов |
| Resource allocation & budgeting | Solo, нет команды для allocation, нет финансового бюджета продукта |
| Stakeholder communication plan | Solo, нет внешних stakeholders до PILOT POINT |
| Vendor / contract management | Не покупаешь сервисы как project asset |
| PMO staffing, hiring, role design | N/A для solo |
| Classical PMI / PRINCE2 / SAFe ceremony | Оптимизированы под организационную координацию, не под индивидуальную работу с AI; overhead без выгоды |
| **Implementation methodologies для D2-Tech, D3, D4, D5** (например, «как делать архитектуру в C4», «как настроить Sentry», «методология unit testing на pytest») | Tool-specific knowledge; делегировано через Integrator + tool-docs; обновляется per-tool, не per-PMO |

Эти зоны помечены в каждом разделе как `N/A — solo` или `N/A — delegated`, чтобы их **отсутствие** в снапшоте не давало ложного 🔴.

### 3.3 Кратко: что есть в индустрии, но мы намеренно отказываемся

См. отдельный **Section 12 — Out of Scope & Explicitly Rejected** для полного списка с rationale per item. Здесь — только заголовки:

- **OKRs at product level** (Doerr) — слишком тяжело для solo с одной HYP-цепочкой; HYP thresholds покрывают функцию
- **Event Storming** (Brandolini) — групповая практика; LC + IC покрывают функцию инвариантов для solo
- **Wardley mapping** — стратегический инструмент, преждевременно для pre-pilot
- **Disciplined Agile / SAFe** — enterprise scaling; не подходят
- **Theory of Constraints (Goldratt)** — производственная оптимизация; не PMO

Если в снапшоте появится одна из этих зон — это сигнал «зачем», **не automatic ●**. Section 12 содержит явные критерии «когда стоит пересмотреть отказ».

## 4. Структура одного раздела

Каждый раздел (01-13) следует одной структуре:

```
# <N>. <Название раздела>

## <N>.1 Индустриальный референс
   <2-4 параграфа: что говорит индустрия, какие школы/источники>
   <ссылки на 99-bibliography.md>

## <N>.2 Перечень функций
   Таблица: Function → Industry-canonical anchor → Authoritative source → Maturity

## <N>.3 Чеклист покрытия
   Таблица с колонками:
     # | Function | Coverage (0/1/2/3/N/A) | Marker [C]/[F]/[F/C] | Locus (CC/EXT/HYB/N/A) | Note
   Locus и coverage — независимые оси.

## <N>.4 Нарративный анализ соответствия
   Свободный текст: «Что должно быть → Как у тебя сейчас → Gap / Match / Conscious divergence / Frontier»
   Каждый блок с явным rationale.

## <N>.5 Анти-паттерны для отслеживания
   Список «красных флагов», за которыми следить в снапшоте
   Источники из индустриальной литературы

## <N>.6 Сигналы для сравнения снапшотов
   Конкретные вопросы для сравнения: «При сравнении снапшотов проверить: ...»
   Группированы по подзонам если раздел большой.
```

**Section 12 (Out of Scope & Rejected)** имеет адаптированную структуру — Industry Reference отсутствует; вместо Function Inventory — Rejected Items List с rationale + reconsideration triggers. Section 13 (Anti-patterns Compendium) тоже адаптирована — это сводный список из всех разделов с источниками, без Coverage Checklist.

## 5. Индекс разделов

| # | Раздел | Размер | Ключевые источники |
|---|---|---|---|
| 00 | Обзор и методология | этот файл | — |
| 01 | Базовая философия и операционные принципы | small | Cagan, Anthropic agents, anti-sycophancy |
| 02 | Жизненный цикл продукта и stage-aware activation | medium | Lean Startup, ProductPlan stages |
| 03 | Карта покрытия доменов (D1-D6 с подзонами; locus per подзона) | **large** | SDLC, Product Operations, ISO 25010 testing taxonomy |
| 04 | **Функциональное покрытие артефактов** (mapping 22 артефактов на функции) | **large** | Cagan, Torres, JTBD, Strategyzer, BDD, DDD, NFR, design |
| 05 | Process Gates и механика одобрения | medium | Three Amigos, DoR/DoD, stage-gate critique |
| 06 | Validation и quality safeguards | medium | severity tiers, override discipline, ISO testing |
| 07 | **Механизмы согласованности** (BG, cascade, drift, hashes) | **large** | DDD ubiquitous language, RTM, hash-pinned snapshots |
| 08 | Adversarial review и anti-sycophancy | medium | pre-mortem, Constitutional AI, sycophancy papers |
| 09 | Handoff и tool-agnostic делегирование (incl. multi-harness) | medium | hex architecture, ports-and-adapters, ACL (DDD) |
| 10 | AI-native операционные аспекты | medium-large | context engineering, agents, skills, evals, drift |
| 11 | Meta-governance и self-improvement | small-medium | ADRs, decision journals, evaluator-optimizer |
| **12** | **Out of Scope и Explicitly Rejected** (rationale + reconsideration triggers) | medium | разные источники per item |
| **13** | **Сводный реестр анти-паттернов** (red flags, сводный) | medium | сводный из всех школ |
| 99 | Библиография источников | reference | все источники с URL, маркером confidence |

**Замечание:** Section 03 расширен относительно первого draft'а до **large** размера — содержит детальную таблицу подзон D1-D6 с per-подзона покрытием и locus. Это прямое следствие правила §3.0 (функциональные ожидания vs implementation methodologies) — каждое функциональное ожидание получает свою строку.

## 6. Maturity caveats

Источники, на которые опирается этот референс, **не одинаково устоявшиеся**:

| Класс | Возраст | Уверенность | Примеры |
|---|---|---|---|
| **MATURE** | 20-40 лет | Высокая | DDD, BDD, RTM, ISO 25010, FMEA, RBAC, AC patterns |
| **MATURE-ISH** | 10-20 лет | Высокая | Lean Startup, JTBD, Strategyzer canvases, OKRs, NSM, Continuous Discovery (Torres) |
| **EMERGING** | 2-5 лет | Средняя | Context engineering как named discipline, Anthropic Skills, agentic patterns, hook ecosystems, structured confidence fields |
| **SPECULATIVE** | < 2 лет, мало evidence | Низкая | Self-meta-feedback (модель предлагает constitutional revisions), полностью автономные multi-agent системы, calibrated verbalized confidence на open-ended generation |

Каждый раздел маркирует пункты по этим классам. Когда твоя реализация — `[F]` в зоне `SPECULATIVE`, это нормально (ты на frontier'е), но **не повод для уверенности** — ровно наоборот, повод к более частому review.

## 7. Что этот референс НЕ делает

- Не предписывает «правильный» способ. Все рекомендации — функциональные, не реализационные.
- Не оценивает качество. Покрытие ≠ качество. Артефакт может покрывать функцию формально, но плохо.
- Не предсказывает успех продукта. Хороший PMO ≠ успешный продукт. Плохой PMO ≠ провальный.
- Не заменяет dogfooding. Реальный pilot на TranslateIT даст feedback, который этот референс не даст.

## 8. Эволюция референса

Сам референс — тоже **гипотеза** (твой принцип #5 «ROADMAP — гипотеза, не contract» применяется и к нему).

Триггеры для обновления:

1. После каждых 2-3 снапшотов — review всего референса: что осталось не использовано? что чрезмерно срабатывает?
2. После реального pilot'а — проверить: какие пункты оказались полезными для понимания «что есть», какие — нет?
3. При появлении новых индустриальных школ (раз в 2-3 года) — добавление AI-native пунктов будет особенно частым.
4. При сознательном cut/skip части экосистемы — соответствующие пункты переводятся в `out_of_scope` с rationale (не удаляются молча).

Все правки референса фиксируются в `99-changelog.md` (создаётся при первом изменении).

## 9. Открытые вопросы (на момент 0.2 draft)

**Закрыты в 0.2 (после фидбэка пользователя 2026-04-29):**

- ~~**OQ-REF-01:** Safety/alignment concerns как отдельный раздел~~ → **Закрыто: не нужно.** Если всплывёт при реальном pilot'е — добавим отдельным разделом тогда.
- ~~**OQ-REF-02:** Квантитативная шкала~~ → **Закрыто: включено.** Введена шкала 0/1/2/3/N/A в §2.2; применяется ко всем чеклистам покрытия. Не уровни зрелости — степени операционализации.
- ~~**OQ-REF-04:** Отдельный раздел rejected items с rationale~~ → **Закрыто: создан Section 12.** «Out of Scope & Explicitly Rejected» с rationale + reconsideration triggers. Краткий список в overview §3.3 ссылается туда.

**Отложены (для пересмотра после первых снапшотов):**

- **OQ-REF-03:** Как часто пересчитывать **maturity caveats**? AI-native область быстро меняется. Решение отложено до накопления опыта реальных diff'ов.

**Новые открытые вопросы (всплывшие по ходу):**

- **OQ-REF-05:** Как **формализовать** «Implementation locus» в snapshot diff отчёте? CC vs EXT vs HYB — clear; но для функций, реализованных через Cowork или другие harness-системы — это тоже EXT, или нужна отдельная градация (например, EXT-CC-adjacent для harness против EXT-tool для standalone)? Решим при первом реальном случае миграции.
- **OQ-REF-06:** Нужна ли **версия coverage scale per maturity класс**? Например, для функции в SPECULATIVE классе coverage:3 значит «полностью реализовано относительно того, что вообще известно делать» — это меньше уверенности, чем coverage:3 в MATURE классе. Сейчас не дифференцируется; если выявится false sense of completeness — пересмотрим.

---

**Конец обзора. Дальше — собственно разделы 01-13.**
