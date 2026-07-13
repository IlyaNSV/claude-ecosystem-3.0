# Research-Capability Blueprint — «Guided Research» (v2, evidence-hardened)

> **Статус:** proposal / pre-decision (2026-07-01). Стиль — как `dev/ECOSYSTEM_VISION.md`:
> вектор + архитектура + волновой roadmap, **без кода**. Ни один рабочий артефакт
> (`skills/`, `agents/`, `hooks/`, `docs/pmo/`) этим документом **не тронут** — решения
> владельца в §7 гейтят переход к Wave 1 и назначение DEC-DEV.
>
> **v2** = поверх skeleton-v1 вплетены **6 adversarially-verified углов ресёрча**
> (ext-tools · academic-gap · query-methodology · usefulness-metrics · anti-hype ·
> internal-surface), прогнанных через слой скептика/хайп-фильтра многоагентным воркфлоу.
>
> **Фрейм владельца (решён, не переспрашивать):** результат = blueprint+roadmap · формализация
> = **слоями** (лёгкий скилл сейчас → формальный PMO-артефакт-тип позже, только если докажет
> ценность) · тулы = **гибрид** (оставить Brave/Exa/Firecrawl/Context7/Memory +
> WebSearch/WebFetch/deep-research; добавить только 1–2 закрывающих пробел класса) · слой =
> **оба** (проектируем один раз в экосистеме как installable, зеркалим в личный harness).
>
> **Дисциплина доказательств:** каждое заявление о туле/методологии/метрике ниже взято из
> **verified** (hype-filtered) версии ресёрча, не из сырой. Что верификатор **убил** —
> исключено; что **понизил** — несёт явный caveat; каждый `⚠` = факт, требующий **живой
> перепроверки (2026)** прежде чем твердеть в обязательство.

---

## 1. Проблема и вектор

### 1.1. Три частичных покрытия — и почему они не складываются в capability

«Поиск + сбор + обработка информации» уже живёт в репо, но **разрознено, в трёх силосах, без
общего фронт-энда и без контракта качества**:

| Локус | Покрывает | НЕ покрывает |
|---|---|---|
| `skills/integrator/research-protocol.md` (8-фазный tool-research) | Анти-хайп рубрика (recency/star/single-source/premature-recommendation), consilium-scope gate (Guard B), `environment_tiers`, калибровка high/med/low, `~/.claude/integrator/research-cache/` | Со-формирование запроса как отдельный шаг; **decision-usefulness** скоринг (только credibility/authority); переиспользуемо лишь под *tool*-research |
| `skills/product/market-research-protocol-quick.md` (D1.2) + `competitive-analysis-protocol-quick.md` (D1.3) | Триангуляция (≥2 независимых), credibility-рейтинг, теги `[оценочно]`, fallback-таблица MCP→built-in | Привязано к D1 Discovery; credibility ≠ usefulness; **нет upfront-контракта и нет гейтящего вердикта** |
| harness-скилл `deep-research` | Фан-аут поиска → fetch → adversarial verify → cited-отчёт | Не согласует scope; не принимает бриф; нет порога полезности; **не shippable-артефакт экосистемы** (harness-provided; `Glob **/deep-research*` в репо ничего не находит) |

Угол internal-surface сверил все три локуса с исходниками. Структурный вердикт держится:
**retrieve / триангуляция / hype-фильтр / cited-сводка уже решены кусками.** Реально не хватает
двух вещей — и это ядро запроса:

### 1.2. Реально новое ядро

1. **Со-формированный запрос.** Отдельная фаза *до* поиска, превращающая размытую просьбу в точный
   **Research Brief**, работающая и с **человеком**, и с **ИИ-агентом** как заказчиком. Четыре зрелых
   традиции сходятся к одному ходу (все survived): библиотечное **reference interview / Neutral
   Questioning** (открытые не-диагностические вопросы → реконструкция реальной потребности),
   **XY-problem / 5-Whys** (заказчик обычно даёт *решение* X, а не *цель* Y), **BABOK**-элиситация
   (Prepare→Conduct→Confirm; разделять *stated* / *real* / *unstated* нужды) и **структурные рамки
   вопроса** (PICO/PICOC/SPIDER — как **scoping-каркас**, НЕ как доказанный бустер качества поиска;
   прочтение «эмпирически улучшает retrieval» **убито** верификатором).

2. **Upfront-контракт метрик полезности, ГЕЙТЯЩИЙ синтез.** Несущее различение (survived, high
   confidence — **Cooper & Maron 1978**, *Foundations of Probabilistic and Utility-Theoretic
   Indexing*, JACM 25(1):67-80, DOI `10.1145/322047.322053`; **не** Cooper 1971 — та определяет
   релевантность **логически**, через логическое следование): **relevance ≠ usefulness.** Информация
   может быть точной и по теме — и при этом ничего не менять для решения заказчика. InfoQ
   формализует полезность как `U(f(X)|g)` —
   utility анализа к *конкретной цели g*, объявленной заранее — что и есть «метрика, согласованная до
   работы». Ни один локус не скорит decision-usefulness и не выдаёт pass/fail-вердикт синтеза; **весь
   текущий скоринг мерит relevance/credibility.**

**Вектор.** Построить сквозную capability **«Guided Research»** из 4 столпов (A–D), которая (a)
ставит **интейк-контракт впереди любого поиска**, (b) **переиспользует** существующий loop /
триангуляцию / анти-хайп, а не строит заново (`orchestrate, don't duplicate`), (c) добавляет явный
**скор полезности, гейтящий сводку**, (d) поставляется как **installable-модуль экосистемы** *и*
**зеркалится в личный harness**. Net-new ограничен интейком (A) и контрактом метрик (B); скептичный
loop (C) и анти-хайп фильтр (D) — тонкие обёртки над существующим.

---

## 2. Архитектура capability (столпы A–D)

### 2.1. Поток данных

```
        ЗАКАЗЧИК  (человек  |  ИИ-агент)
             │  сырая просьба
             ▼
 ┌────────────────────────────────────┐
 │ A. INTAKE / CO-FORM PROTOCOL        │  reference-interview + XY-drill + PICO-style
 │   один batch-раунд, ≤3 (макс ~6) Q  │  slot-filling; пустой слот ⇒ уточняющий вопрос
 │   гейт по information-gain           │  ── если ИИ-заказчик: тот же бриф как
 │   → редактируемый ПЛАН, затем confirm│     machine-readable объект (4 поля)
 └───────────────┬────────────────────┘
                 │  RESEARCH BRIEF  (objective · decision_it_feeds · audience ·
                 │  scope_in / scope_out · constraints{deadline,recency} ·
                 │  deliverable · effort quick↔deep · must_cover checklist)
                 ▼
 ┌────────────────────────────────────┐
 │ B. USEFULNESS-METRICS CONTRACT      │  заказчик co-set goal g, веса, пороги
 │   Tier-1 HARD GATES (pass/fail)     │  Tier-2 WEIGHTED 1–5 (мин. агрегат)
 │   + 2 оси: Relevance ⟂ Utility      │  → КОНТРАКТ заморожен до любого retrieval
 └───────────────┬────────────────────┘
                 │  metrics contract (DoR + пороги гейта)
                 ▼
 ┌────────────────────────────────────┐        ┌──────────────────────────────┐
 │ C. SKEPTICAL RESEARCH-LOOP          │◀──────▶│ ИНСТРУМЕНТЫ (гибрид-стек)    │
 │   retrieve → verify →               │  reuse │ Brave · Exa · Firecrawl ·    │
 │   score-vs-metrics → gap-check →    │ deep-  │ Context7 · Memory ·          │
 │   (фан-аут ещё | СТОП на DoR брифа) │ research│ WebSearch/WebFetch + github  │
 │   bounded; фан-аут только при        │  +фан- │ + [Wave-2] 1 answer-engine   │
 │   declared scope (consilium-gate)    │  аут   │ + [Wave-2, опц] 1 academic ⚠ │
 └───────────────┬────────────────────┘        └──────────────────────────────┘
                 │  находки, каждая со score-вектором метрик
                 ▼
 ┌────────────────────────────────────┐
 │ D. ANTI-HYPE QUALITY FILTER         │  atomize → SIFT/lateral-read → provenance-tier →
 │   keep / DEMOTE / drop              │  hype-scan (H1–H8) → триангуляция-по-независимости
 │   down-weight + audit-trail         │  → faithfulness (LLM-judge = 1 сигнал, не арбитр)
 └───────────────┬────────────────────┘
                 │  только survived + scored (demoted → как caveats)
                 ▼
        ФИНАЛЬНЫЙ СИНТЕЗ  (cited; per-dimension subscores; caveats)
        + ВЕРДИКТ:  годно / частично / недобор  ← называет, КАКОЙ метрики не хватило
```

### 2.2. Столп A — Requester co-form protocol (человек ИЛИ ИИ)

Превращает размытую просьбу в замороженный **Research Brief**. Механика (всё survived):

- **Открывать «вопросом за вопросом»:** какое *решение* питает ресёрч и что заказчик *сделает* с
  ответом (страховка XY-проблемы). Нейтральные открытые не-диагностические вопросы; без ранней
  диагностики.
- **Batch, не допрос:** один раунд **≈3 (до ~6) целевых вопросов**, упорядоченных по information-gain
  (ось, что делит интерпретации ровнее всего). *Числа — настраиваемые дефолты, не откалиброванный
  оптимум* (верификатор пометил false precision на «3–6/3–5»). Гейт каждого вопроса: *«изменит ли
  ответ структуру/глубину/направление вывода?»* — если нет, взять конвенциональный дефолт и **зафиксировать
  допущение**, а не спрашивать. Зеркалит собственный **ITP T0/T1/T2** репо.
- **Показать редактируемый ПЛАН, затем confirm** до того как поиск сожжёт бюджет (паттерн
  clarify-before-search у ChatGPT/Gemini/Perplexity — survived, но vendor-primary → перепроверять, не
  хардкодить поведение продукта).
- **Слоты брифа** (объединение market-research брифа + PICO + Anthropic delegation-spec): `objective ·
  decision_it_feeds · audience · scope_in · scope_out (явное must-NOT-cover) · constraints{deadline,
  recency_window} · deliverable_form · effort_budget (quick↔deep) · must_cover_checklist ·
  prior_knowledge`. **Пустой слот — триггер уточняющего вопроса.**
- **Режим ИИ-заказчика:** тот же бриф как **machine-readable объект** — четырёхполевая дисциплина
  делегирования Anthropic (`objective + output_format + tools/sources + boundaries`) + явное состояние
  **`input-required` / needs-clarification**, чтобы callee спрашивал до того как гадать. **Caveat:**
  A2A-протокол и «+90.2% vs single-agent» Anthropic — только *directional influence* (оба понижены/убиты
  верификатором): взять *концепт* структурного task-объекта с input-required, но **не** хардкодить A2A
  как «стандарт». Полный AI-requester контракт — Wave 4; минимальная версия — опция Wave 1.
- **Разделять элиситацию и декомпозицию:** A замораживает *что* отвечать; loop (C) затем декомпозирует
  замороженный бриф в упорядоченные single-hop под-вопросы. Ошибка в A множит потери ниже по потоку.

### 2.3. Столп B — Usefulness-metrics contract (ЯДРО)

Заказчик co-set `goal g`, веса и пороги **до** retrieval; синтезатор затем promote / demote / flag /
drop каждой находки против них. Структура (уточнена по двухуровневой рекомендации верификатора; отдельная
метрика «Insight/Depth» **убита** и свёрнута в Decision-Utility):

**Две ортогональные оси на каждой находке** (никогда не схлопывать):

| Ось | Смысл | Роль |
|---|---|---|
| **Topical Relevance** (1–5) | aboutness / совпадение с запросом | **префильтр** — отсечь off-topic шум |
| **Decision Utility** (1–5) | двигает/дерискует решение заказчика? | **ranker + gate** — понизить relevant-но-инертное; VoI-триаж: *«если правда — меняет ли рекомендацию/ранжирование/уверенность?»* (High/Med/Low) |

**Tier-1 — HARD GATES** (pass/fail; проваленная находка карантинится и не может быть заголовком):

| Gate | Тест | Дефолт-порог (настраиваемый) |
|---|---|---|
| **Faithfulness / grounding** | каждый атомарный claim следует из своего цит. источника | 1.0 для high-stakes, ≥0.8 exploratory |
| **Citation support** | каждый несущий claim несёт ≥1 верифицируемую dereferenced-цитату | pass/fail на класс claim |
| **Freshness** | волатильные факты (цены / maturity тула / доступность модели) в окне свежести | ≤6–12 мес; N/A для стабильной теории |
| **Corroboration** | ≥2 **независимых** (не общего происхождения) источника на значимый claim | ≥2 (Admiralty credibility ≤2) |

**Tier-2 — WEIGHTED 1–5** (заказчик ставит веса + минимальный агрегат):

| Метрика | Что мерит |
|---|---|
| **Decision-Utility** (обычно макс. вес; поглощает insight/depth) | двигает решение; синтезирует/приоритизирует, а не перечисляет |
| **Coverage / Comprehensiveness** | пункты must-cover присутствуют; непокрытое — как **явные названные пробелы**, не тихо дропнуто |
| **Independence / source-reliability** | грейд **источника** (Admiralty A–F) *отдельно* от **claim** (1–6); bias-тег {independent-primary, independent-secondary, vendor/self-interested, echo}; echo-источники схлопнуть в один |
| **Directness / answer-relevancy** | синтез отвечает на заданный вопрос без воды |

Плюс **Uncertainty-honesty** (pass/fail): заявленная уверенность должна быть evidence-backed
(corroboration + faithfulness), а не тон генератора — LLM систематически overconfident (survived).

**Как гейтит сводку:** агрегат = `Σ(weightᵢ × scoreᵢ)` по Tier-2 при *всех* прошедших Tier-1 gates.
**Публиковать per-dimension subscores, не только тотал** — чтобы недобор был диагностируем (retrieval-gap
vs grounding-gap vs utility-gap). Промах метрики → явный вердикт *«частично / недобор: corroboration
короток на claim X»*, никогда тихое «готово».

**Несомые caveats:** (i) почти каждый скор **вычислен LLM-as-judge** и *не откалиброван под домен
этого репо* — любое 0–1 число трактовать как directional, не ground-truth; для high-stakes — ≥2 судей
или нейтральный третий. (ii) Полный Value-of-Information (EVPI/EVSI) требует decision-модели, которой у
брифа обычно нет — использовать **High/Med/Low Decision-Impact прокси**, не квантованный VoI. (iii)
RAG-eval словарь (RAGAS/TruLens/DeepEval faithfulness, context precision/recall, citation accuracy)
реален, но его «стандартность» частично держится на одном переиспользуемом бенчмарке — цитировать
*конструкты*, а конкретный фреймворк `⚠` verify перед wiring.

### 2.4. Столп C — Skeptical research-loop

`retrieve → verify → score-against-metrics → gap-check → (фан-аут ещё | СТОП)`. **Переиспользует**
`deep-research` (фан-аут + adversarial verify) как движок и триангуляцию market-research; добавляет
недостающий шаг — **скоринг каждой находки против контракта B** и **ограничение loop по
Definition-of-Ready брифа** (пороги достигнуты), а не «пока не устанет». Прямой перенос Vision Epic B /
[[project_autonomy_obedience_balance]]: loop **эскалирует недобор, а не фабрикует закрытие**. Фан-аут
только при **declared scope** (наследует consilium-gate). **Cost-дисциплина — first-class ограничение:**
исходный многоагентный фан-аут, породивший этот ресёрч, *упал на session-limit* → bounded fan-out,
дешёвые модели на механических стадиях, budget-aware циклы.

### 2.5. Столп D — Anti-hype quality filter (механический keep / DEMOTE / drop)

Механически исполнимый проход, консолидирующий существующие анти-паттерны и добавляющий одно
недостающее поведение: **down-weight с audit-trail, а не тихий drop.** Пайплайн на каждый claim (все
шаги survived):

0. **Atomize** (RAGAS-style) — разбить на атомарные claim; каждое число/цитату держать привязанным к источнику.
1. **SIFT-gate** — Stop · **Investigate the source laterally** (что *другие* источники говорят про
   *этот* источник — ход, отличающий фактчекеров от студентов) · Find better coverage · **Trace каждый
   несущий claim/число к первичному происхождению.**
2. **Provenance-tier** — primary / secondary / tertiary / **marketing** (vendor-о-себе = marketing).
3. **Hype-signal scan** (бинарные флаги): H1 суперлативы/гипербола · H2 неопровергаемое/размытое · H3
   vendor-funded / conflict-of-interest · H4 число-без-цитаты · H5 novelty/recency-как-доказательство ·
   H6 bandwagon / **star-bias** · H7 spin (null→эффект, causal-на-observational) · H8 self-benchmark
   cherry-pick. *Caveat:* лексикон суперлативов валидирован на **биомедицине** — нужно **tech/AI
   расширение** («game-changer, 10x, next-gen, industry-leading») + few-shot тюнинг против false-positive
   на легитимных техн. суперлативах; биомед-числа распространённости **не** переносятся как факты.
4. **Триангуляция по независимости** — считать *независимые* сходящиеся источники; схлопнуть
   shared-origin (три блога, эхом одного пресс-релиза = один источник).
5. **Faithfulness** — LLM-judge (или лёгкий NLI/HHEM классификатор) claim-vs-context, с bias-гардами:
   **swap-order-and-require-agreement**, явная рубрика + reference, **не единственный арбитр**.
6. **Решение** (философия GRADE — двигать уверенность дискретными уровнями, понижать с записанной
   причиной):
   - **KEEP** (полный вес): provenance ≥ secondary И ≥2 независимых И faithfulness pass И 0 severe-флагов (H3/H4/H7/H8).
   - **DEMOTE** (down-weight + caveat + audit-строка): single-source, marketing-origin, 1–2 флага, или несогласие judge/human — записать *почему*, понизить уверенность на 1–2 уровня, **вынести как caveat в синтез**.
   - **DROP** (исключить, но **всё равно залогировать**): faithfulness fail / fabricated-or-dead цитата / (неопровергаемое И без-цитаты И vendor-only) / опровергнуто источником выше tier.
   - **Никогда не дропать тихо** — каждый demote/drop пишет однострочный rationale.
7. **Композиция в B:** H1/H2/H5/H6 + spin → понижают *independence*; H3/H8 + слабый tier → понижают
   *provenance*; счётчик триангуляции → *corroboration*; faithfulness + calibrated-confidence →
   *uncertainty-honesty*; H4/dead-citation → капнуть *provenance* на marketing-tier. **Ключевое
   свойство:** находка может быть high-relevance И high-usefulness — и всё равно **demoted до caveat**,
   если провалены independence/provenance (usefulness и credibility ортогональны).

*Note (убитый «цвет» исключён):* конкретные количественные заявления, которые всплыли в ресёрче —
deep-research «~65% citation quality», industry-bias «5.4×/8.4×», «50%+ судей проваливают bias-тесты»,
benchmark «10–20 пунктов swing» — **убиты как неверифицированный vendor/preprint-цвет** и **не** якорят
ни один порог. Их *направления* (цитаты часто фабрикуются; спонсорство благоволит спонсору; судьи
предвзяты) — survive и обосновывают *механизм*, не числа.

---

## 3. Reuse-карта (явно не дублировать)

| Существующее | Вердикт | Как используем |
|---|---|---|
| harness `deep-research` skill | **reuse-as-is** | Движок столпа C (retrieve + adversarial-verify + фан-аут). ⚠ подтвердить, что он реально присутствует в consumer-harness, прежде чем зависеть как от shippable-зависимости |
| `skills/integrator/research-protocol.md` | **extend** | Донор анти-хайп рубрики (D) + consilium-scope gate (C); его «restate the need» интейк выносим наружу как общий фронт A |
| `skills/integrator/tool-profiling.md` | **reuse pattern** | Его *evidence-required-to-claim-high* + forbidden-field-name дисциплина (DEC-DEV-0012) — шаблон для схемы метрик B |
| `agents/integrator/tool-researcher.md` | **reuse pattern / extend** | Ближайший существующий isolated-context research-субагент (WebFetch/WebSearch → работает без MCP-стека); переориентировать с tool-candidates на общие findings |
| `commands/integrator/research.md` | **reuse pattern** | Его **hard approve gate + «silence is NOT consent»** + 7-дневный кэш — шаблон для гейтящего синтеза; переиспользовать `~/.claude/integrator/research-cache/` для cross-project reuse находок |
| `skills/product/market-research-protocol-quick.md` (D1.2) | **extend** | Триангуляция + credibility + `[оценочно]` + fallback-таблица → доноры столпа D |
| `skills/product/competitive-analysis-protocol-quick.md` (D1.3) | **reuse** | Downstream-потребитель нового общего фронта + донор той же дисциплины |
| `skills/product/problem-discovery.md` (D1.1) | **reuse pattern** | Его batch-question reference-interview (restate + 5–8 Q в 2–3 батча + итерация) — проверенный seed для A. **Поправка:** верификатор нашёл, что паттерн живёт **только** в `problem-discovery.md` — у `segment-discovery.md` **нет** уточняющего интервью (это synthesis-from-drafts скилл) |
| `agents/product/{qa-advisor,architect-advisor,devils-advocate}.md` + `agents/design/ux-advisor.md` + `skills/orchestrator/architecture-consilium.md` | **reuse pattern** | Гетерогенное builder/critic-разделение, isolated-context, gaps-only персоны = готовый **multi-judge/jury** шаблон для adversarial-верификации D (усилено DEC-DEV-0132 blind-comparison-protocol). Caveat: сегодня они ревьюят *product-артефакты*, не research-findings — брать *паттерн*, не wiring |
| Отложенные **Deep-mode** субагенты — `market-researcher.md`, `competitor-analyst.md`, скиллы `deep-research-8-phase.md`, `competitive-intel.md` (SPEC §5.1/§5.2, §14.3 unchecked, **не построены**) | **решить: adopt-spec / cut / keep-deferred** | Их 8-фазный пайплайн (scope→plan→retrieve→triangulate→synthesize→critique→refine→package) *и есть идеальный loop столпа C, уже на бумаге.* Не дать новой capability тихо его продублировать — либо принять этот spec как дизайн C, либо формально cut (решение владельца, §7 #9) |
| **Intake / co-form (A)** | **NET-NEW** | Нигде не существует как переиспользуемая brief-producing фаза |
| **Usefulness-metrics contract + gating score (B)** | **NET-NEW** | Нигде не существует — ядро запроса |

**Принцип анти-дублирования:** A и B — единственный по-настоящему net-new код; C и D — тонкая
оркестрация/обобщение существующего. Это `orchestrate, don't duplicate` — value-add слой сужается по
мере зрелости базовых инструментов.

---

## 4. Инвентарь инструментов + гибрид-рекомендация

**Оставляем** (рабочий стек, ставится в consumer-проекты `/ecosystem:bootstrap`; полностью присутствует
в пилоте `my-first-test`): Brave (keyword) · Exa (neural/semantic + `/answer`) · Firecrawl (scrape/crawl)
· Context7 (package docs) · Memory (cross-session) · built-in WebSearch/WebFetch · `deep-research`
(оркестрация). **Поправка (verified):** bootstrap MCP-список также ставит **github** (строка 7,
назначение «CA Deep dev-tools research / NFR benchmarks») → consumer research-surface = **7** строк, не 6.
Сам dev-репо `claude-ecosystem-3.0` подключает только `github` + `sequential-thinking` (ожидаемо — это
*разработчик* экосистемы, не потребитель), из-за чего **этот репо не может напрямую догфудить полный
стек** (self-referential validation-gap).

### 4.1. Структурный вывод (survived сильно)

Только класс **«single-call grounded answer с inline-цитатами»** — кандидат в НОВУЮ способность. Второй
neural-search не даёт ничего (Exa покрывает, вкл. `/answer`); второй scraper — ничего (Firecrawl).
**Добавить МАКСИМУМ ОДИН answer-engine.** Академ/citation-grade класс — *селективно высокий,
второприоритетный* add.

### 4.2. ADD — answer-engine (выбрать РОВНО ОДИН, решается Wave-0.5 bake-off)

- **Perplexity Sonar — SAFE DEFAULT.** Официальный поддерживаемый MCP (`perplexityai/modelcontextprotocol`;
  tools search/ask/research/reason). Готовая cited-проза + research/reason-tier дешевле/быстрее, чем
  поднимать полный deep-research harness на средне-глубокий вопрос. *Цена:* per-token **плюс**
  per-request fee, растущий с search-context ($5–$14 / 1k requests). **Confidence: medium** (верификатор
  понизил с high — «#1» = 8-запросный self-caveated тест; «actively maintained» инференс из звёзд).
  Заявление **«~50 req/min ceiling → держать вне hot-path» УБИТО** как single-source — трактовать как
  *bench-during-pilot* caveat, не хардкод-правило роутинга.
- **Linkup — PRECISION PILOT ALTERNATIVE.** Единственный кандидат, чей уникальный add — *верифицируемая
  фактическая точность*, с **открытым воспроизводимым SimpleQA eval-harness** (редкость, анти-хайп),
  официальный MCP (`LinkupPlatform/linkup-mcp-server` + npm + `.mcpb` Claude-Desktop bundle), низкая цена
  (~€5 / 1k searches), нативный parallel search. **Confidence: low** — SOTA-фрейминг vendor-self-published,
  вендор моложе/меньше, SimpleQA (short-fact) может не переноситься на техн/multi-hop. **Только как
  пилот**, не blind commit.
- **Правило решения:** добавлять ОБА только если явно роутить по типу задачи (Linkup для точных
  фактов, Perplexity для recency-weighted синтеза). Иначе второй answer-engine — избыточная
  surface-area, **выбрать один.** Что добавите — вешать **позади `deep-research` как ещё один
  retrieval-источник** (index-diversity для триангуляции), не как новый hot-path.

### 4.3. ADD (опц., Wave-2, ранжирован НИЖЕ answer-engine) — академ / citation-grade

Селективно высок для **tech/AI due-diligence + анти-хайп миссии** (arXiv — первичная AI/ML площадка;
peer-review + графы цитирований питают provenance/authority столпа B), **низок для product discovery**
(market/competitor/user-сигналы живут в news/filings/forums). Если добавлять — **ОДНА консолидированная
запись**, не 3–4 single-source сервера:

- **Предпочтительный low-dependency маршрут:** звать **OpenAlex** (~250M works, богатейший
  DOI/citation/institution-граф, поглощает Crossref/arXiv/PMC) или **Semantic Scholar** REST
  **напрямую из `deep-research`** — ноль third-party MCP-обслуживания. **⚠ Verified-поправка:** OpenAlex
  перешёл на **free-key-gated, usage-metered freemium с 2026-02-13** (polite pool deprecated) —
  дифференциатор «без ключа» исчез; **Semantic Scholar теперь сильнейший по-настоящему no-key free-источник.**
- **Если нужен breadth-via-MCP:** `openags/paper-search-mcp` (MIT, фронтит arXiv+OpenAlex+S2+Europe
  PMC+CORE+PubMed с dedup+DOI). **Confidence: tentative direction, не validated pick** — unbenchmarked,
  single-org/hobby-scale (суперлатив «single best» убит). Пинить версию; sandbox-ить контент статей как
  untrusted input (prompt-injection).
- **arXiv** конкретно под AI/ML due-diligence (`blazickjp/arxiv-mcp-server`, 2.9k★, Apache-2.0) — но
  **всегда паровать препринт с peer-review/citation-overlay** (OpenAlex/S2), чтобы препринты не считались
  устоявшимся доказательством (это ровно поведение столпа D).

### 4.4. REJECT поимённо (избыточно или не-wireable)

- **Tavily** — search+extract+map+crawl перекрывается Exa+Firecrawl; ранжирован ниже всех как
  answer-engine в независимом тесте. **Maturity ≠ capability:** покупка Nebius за $275M + 3M downloads +
  логотипы IBM/Cohere **не** покупают add. (Рассмотреть *только позже* как cost-offload для
  high-volume agent-search через free-tier — не под пробел.)
- **Kagi FastGPT** — инструмент FastGPT/summarizer **убран** из официального Kagi MCP («планируют
  вернуть»); answer-способность **не wireable сегодня**; остальной search/extract перекрывает стек.
- **Consensus & Elicit** — платные answer-engine / systematic-review продукты, **дублирующие
  `deep-research`** (`orchestrate, don't duplicate`), heavily vendor-marketed.
- **Любой второй neural-search или второй scraper** — покрыто Exa / Firecrawl.

**Правило:** без зоопарка. Каждый новый MCP оправдывает новый ключ + surface-area *уникальной*
способностью, которой нет в стеке, и переживает fallback-таблицу. **Перед коммитом — подтвердить, что
реальный пробел = answer-synthesis** (тогда answer-engine), а не domain-coverage (тогда — бесплатный
scholarly-источник). Этот выбор и Perplexity-vs-Linkup — всё содержание Wave-0.5 bake-off.

---

## 5. Волновой roadmap (слоями)

| Волна | Scope | Артефакты | harness / eco | Decision-gate |
|---|---|---|---|---|
| **0** (этот док) | Blueprint + owner-решения | `dev/RESEARCH_CAPABILITY_BLUEPRINT.md` | — | §7 отвечен → DEC-DEV (⚠ `git fetch origin` первым — collision-паттерн) |
| **0.5** | **Живой tool bake-off (первый догфуд capability).** Verify-live 2026 цены/free-tier/MCP-maintenance для answer-engine класса; **30–50 реальных запросов Perplexity vs Linkup**; решить какой ОДИН (или ноль); нужен ли академ-класс для *этой* нагрузки | `research-cache` verify-live заметка (НЕ код) | eco + harness | какие 1–2 тула (или ноль); пробел = answer-synthesis или domain-coverage? |
| **1** (MVP, лёгкий) | Столпы **A + B + D над C** как **скилл**; Brief + metrics-контракт как **markdown** (НЕ формальный артефакт) | net-new `skills/ecosystem/research-intake.md` (co-form + brief-шаблон) · `skills/ecosystem/anti-hype-filter.md` (консолидация research-protocol §Anti-patterns + market-research триангуляция/`[оценочно]` + keep/DEMOTE/drop + audit-trail) · каждый с `description:` frontmatter · **опц.** warn-хук «co-form a brief before searching» (отложить, если шумит) | eco → **зеркало в `~/.claude/skills/`** | догфуд: бриф реально ко-формируется до поиска? синтез выдаёт вердикт годно/частично/недобор с per-dimension subscores? |
| **2** (тулинг) | Вписать выбранные 1–2 gap-тула в bootstrap MCP-стек (позади `deep-research`, в fallback-таблицу + provenance-tiers); научить loop **скорить находки против контракта метрик** | `commands/ecosystem/bootstrap.md` MCP-таблица · C-скоринг в intake-скилле | eco | тул даёт уникальную ценность сверх стека (переживает fallback-таблицу)? |
| **3** (формализация — **TRIGGER-gated**) | Промоут brief+metrics из markdown в **формальный PMO-артефакт-тип** (напр. **RB = Research Brief**, ASCII-slug `rb-<slug>`; опц. **RF = Research Finding** scored-запись) | `docs/pmo/artifacts/RB.md` (+1 тип → **25**) · artifact-creating скилл **ОБЯЗАН** нести explicit frontmatter-template + anti-pattern warnings (DEC-DEV-0012) + ASCII-slug rule · **count-sweep всех ~10 count-доков** (`check-counts.js` зелёный, принуждается `process-gate`) · обновить `commands/ecosystem/verify.md` + обзорные шаблоны | eco | **BRING-FORWARD ТРИГГЕР:** бриф reused ≥ **N** раз (владелец ставит N; дефолт ~5) **И** markdown-форма дрейфует (field-name drift, прецедент D1 PS-drift). Пока оба не сработали — **остаёмся markdown.** |
| **4** (горизонт) | Минимальный **AI-requester machine-readable brief** (4-полевой объект + `input-required`; A2A как *directional*, не хардкод) · **consilium/jury** для спорных находок (reuse `architecture-consilium` + blind-comparison-protocol) · cross-project cache-агрегация | схема брифа · consilium-хук | eco | по спросу |

**Слоистость (решённый фрейм владельца):** Wave 1 = лёгкий скилл; **формальный артефакт-тип отложен до
Wave 3 за явным bring-forward триггером** (reuse ≥N И form-drift). Без преждевременной формализации
(CLAUDE.md §4 cuttable-scope). **Harness-зеркало:** после Wave 1 в eco — скопировать скилл в
`~/.claude/skills/` (тот же контракт, личный MCP-стек).

---

## 6. Метрики успеха самой capability (dogfood-сигналы)

- **Brief-before-search adoption** — доля ресёрч-сессий, начатых с ко-формированного брифа (должна расти).
- **Rework-rate from mis-scope** — как часто ресёрч переделан из-за мис-скоупа (должна падать — прямейший прокси ценности A).
- **Metric-gated synthesis rate** — доля находок со score-вектором; доля low-usefulness, честно **demoted/dropped с audit-trail**, а не протащенных в заголовок.
- **Hype-catch** — hype_flags за сессию; снижение «ложной уверенности» (confident-но-uncorroborated заголовки).
- **Verdict honesty** — доля синтезов с явным *частично/недобор* вердиктом, называющим метрику недобора, vs голое «готово».
- **Cache reuse** — hit-rate `research-cache` cross-project.
- **Cost discipline** — токены/сессию под контролем (урок session-limit: bounded fan-out + дешёвые модели). Плюс сигнал **judge-config cost/accuracy** — single-judge+swap-order-agree достаточно, или ensemble оправдан только для спорных?

---

## 7. Открытые решения для владельца + риски

### 7.1. Открытые решения (гейтят Wave 1)

1. **Дом скилла** — cross-cutting `skills/ecosystem/` (*рекоменд.* — служит product + integrator +
   ad-hoc) ↔ `skills/product/` (discovery-scoped) ↔ `skills/integrator/` (research-scoped).
2. **Командный surface** — новый тонкий `/ecosystem:research`, делегирующий в существующее (*рекоменд.*)
   ↔ расширить `/integrator:research` + D1 discovery.
3. **Форма набора метрик** — принять уточнённое **двухуровневое ядро** (Tier-1 hard gates + ~4 Tier-2
   weighted, Insight свёрнут в Decision-Utility) *[рекоменд., урезает исходные 8]* ↔ держать полную
   8-метричную рубрику.
4. **Gap-тул(ы)** — после Wave-0.5 bake-off: ровно один из **{Perplexity Sonar (safe) | Linkup
   (precision pilot)}**; академ-класс **да/нет** (если да: OpenAlex/S2 REST-direct vs `paper-search-mcp`
   vs arXiv-с-overlay) ↔ **ноль добавлений** (только текущий стек), если провальные запросы —
   domain-coverage, не answer-synthesis.
5. **AI-requester контракт** — минимальный machine-readable brief в **Wave 1** ↔ отложить в **Wave 4**.
   Под-решение: **не** принимать A2A как жёсткий стандарт сейчас (directional only).
6. **Триггер формального артефакта** — задать **N** (reuse count) для Wave-3 bring-forward, и один тип
   (**RB**) или два (**RB + RF** scored finding).
7. **LLM-judge бюджет** — дефолт single-judge + swap-order-agree везде ↔ ensemble/нейтральный-третий
   только для спорных/high-stakes (cost/accuracy A-B на реальных ранах).
8. **DEC-DEV сейчас vs держать proposal** — назначить номер (⚠ `git fetch origin` первым; 0132 занят
   P2-study; collision-паттерн [[feedback_dec_dev_collision_check]]) ↔ оставить pre-decision до ответа по §7.1.
9. **Судьба отложенных Deep-mode субагентов** (`market-researcher.md` / `competitor-analyst.md` /
   `deep-research-8-phase` / `competitive-intel`) — принять их 8-фазный spec как дизайн столпа C, формально
   cut, или keep-deferred — но **не** дать новой capability тихо их продублировать.
10. **Первый догфуд** — прогнать Wave-0.5 bake-off *как первую реальную задачу самой capability*?

### 7.2. Риски (с митигациями)

1. **Self-referential collapse** (CLAUDE.md §3) — строим research-capability, не догфудя её; усугублено
   тем, что dev-репо подключает лишь 2 MCP. *Митигация:* Wave-0.5 верификацию прогнать *самой
   capability* (первый догфуд); валидировать в пилоте, где полный стек.
2. **Over-engineered метрики → трение, заказчик пропускает.** *Митигация:* слоями, lightweight-first,
   пороги опциональны (absent == разумный дефолт); церемония масштабируется по reversibility/stakes (R).
3. **Tool-зоопарк / vendor lock-in.** *Митигация:* гибрид, макс 1–2 add, fallback-таблица уже паттерн,
   `⚠ verify-live` перед adopt, reject-by-name список.
4. **Стоимость фан-аута** (*реализовавшийся* риск — фан-аут упал на session-limit). *Митигация:* bounded
   fan-out, дешёвые модели на механических стадиях, budget-aware циклы, resume-from-runId.
5. **LLM-as-judge / model-confidence как единственный арбитр.** *Митигация:* judge — один сигнал в D,
   не вердикт; триангуляция + provenance выше него; ≥2 судей для high-stakes; не доверять verbalized
   confidence (требовать evidence-backed калибровку).
6. **Evidence-decay & false precision** — ряд source-claims vendor-self-published, single-benchmark, или
   future-dated препринты. *Митигация:* все числовые пороги (счётчики вопросов, faithfulness-полы, окна
   свежести) — **настраиваемые дефолты, калибруемые догфудом**, не валидированные константы; класс фактов
   уровня OpenAlex-key-change держать под постоянным `⚠ verify-live`.

---

## Короткий ответ

Ядро запроса — **со-формированный запрос** + **upfront-контракт метрик полезности, гейтящий синтез** —
в экосистеме реально не покрыто; retrieval / триангуляция / анти-хайп уже есть в трёх силосах. Blueprint
предлагает 4-столповую capability **«Guided Research»** (Intake → Metrics-contract → Skeptical loop →
Anti-hype filter), где **net-new только A + B**, а **C + D — обёртка над существующим** (`deep-research`,
research-protocol, market-research). Roadmap слоями: **Wave 1 = лёгкий скилл** (бриф + метрики как
markdown), формальный PMO-артефакт отложен до **Wave 3** за явным триггером reuse≥N + form-drift. Тулы —
**гибрид**: добавить **максимум один answer-engine** (Perplexity Sonar = safe default, Linkup = precision
pilot — решает Wave-0.5 bake-off), опц. академ-источник ниже него; **reject Tavily, Kagi FastGPT,
Consensus, Elicit** и любой второй neural-search/scraper поимённо. Дальше — ваш ответ по §7.1 (10 развилок).
