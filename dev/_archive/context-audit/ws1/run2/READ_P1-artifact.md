# P1-artifact — глубокое чтение литературы о НАШЕМ артефакте (Agent Context Files)

> Прогон 2, WS1. Агент глубокого чтения. Дата: 2026-07-12.
> Приоритет отбора: **decision-delta × (1 − indirectness)**, НЕ тир.

---

## 0. Главный результат разведки: премиса брифа неверна

Бриф утверждал: три названные работы (2602.14690 / 2606.25257 / 2605.20049) — «**ЕДИНСТВЕННЫЕ работы
в природе про класс файлов, который мы перестраиваем**».

**Это неверно.** Раздел Related Work в 2602.14690 ведёт к целому корпусу работ про ACF, и они
**решение-релевантнее**, чем сами три работы из брифа. Найдено по цитатной цепочке:

| arXiv | Работа | Что делает | Ценность для нас |
|---|---|---|---|
| **2605.10039** | Instruction Adherence in Coding Agent Configuration Files: **A Factorial Study of Four File-Structure Variables** (McMillan) | Факторный экспе­римент: размер / позиция / архитектура / конфликты → adherence. 1 650 сессий **Claude Code CLI** | **★★★ ГЛАВНАЯ.** Ровно наши четыре ручки |
| **2602.11988** | **Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?** (Gloaguen, Mündler, Müller, Raychev, Vechev) | SWE-bench + AGENTbench, 4 связки агент×модель, с/без context file | **★★★ ОПРОВЕРГАЕТ.** Успех не растёт, цена +20% |
| **2601.20404** | On the Impact of AGENTS.md Files on the **Efficiency** of AI Coding Agents (Lulla, Mohsenimofidi, Galster, Zhang, Baltes, Treude) | A/B: 10 репо, 124 PR, с/без AGENTS.md | **★★☆** Источник хайпа «−29% времени» |
| **2511.12884** | **Agent READMEs**: An Empirical Study of Context Files for Agentic Coding (Chatlatanagulchai, …, Adams, Hassan, Iida) | 2 303 файла / 1 925 репо: структура, контент, эволюция | **★★☆** Единственные данные про РАЗМЕР и АККРЕЦИЮ |
| **2509.14744** | On the Use of Agentic Coding Manifests: Empirical Study of **Claude Code** (та же группа) | 253 CLAUDE.md / 242 репо | **★☆☆** Ранняя версия предыдущей |
| **2603.00822** | **ContextCov**: Deriving and Enforcing Executable Constraints from Agent Instruction Files (Sharma) | Превращает пассивный текст в исполняемые guardrails | **★★☆** Прямое обоснование наших ГЕЙТОВ |
| 2605.08435 | A Dataset of Agentic AI Coding Tool Configurations | датасет | — |
| 2602.20478 | Codified Context: Infrastructure for AI Agents in a Complex Codebase | индустриальный кейс | не читал (бюджет) |

**Почему прогон 1 их не нашёл:** ровно тот дефект, который вскрыл критик полноты — разведка искала
**словами деградации** («context rot», «distraction», «overload»). Эти работы называются словами
**артефакта и выигрыша**: «AGENTS.md», «context files», «instruction adherence», «efficiency»,
«helpful». Ни один из этих запросов в прогоне 1 не звучал.

---

## 1. ЦЕНТРАЛЬНАЯ ПРОВЕРКА БРИФА: цитата из 2602.14690 — **найдена, но УСТАРЕЛА**

Бриф: «авторы 2602.14690 якобы пишут, что "мало эмпирических свидетельств, какие конфигурационные
стратегии эффективны" — проверь эту цитату дословно, **она калибрует амбиции всего нашего аудита**».

### Провенанс: у статьи 5 версий, и она СМЕНИЛА НАЗВАНИЕ И ЦИФРЫ

| Версия | Дата | Название | Репозиториев |
|---|---|---|---|
| v1 | 16 фев 2026 | *Configuring Agentic AI Coding Tools: An Exploratory Study* | **2 926** |
| v2 | 20 мар 2026 | — | — |
| v3 | 9 апр 2026 | — | — |
| v4 | 8 мая 2026 | — | — |
| **v5** | **30 июн 2026** | ***Harness Engineering** for Agentic AI Coding Tools* | **2 853** |

Бриф ссылается на **v5** (название «Harness Engineering», число 2 853). Но цитата, которую он просит
проверить, — **из v1**.

### Цитата ДОСЛОВНО (v1, §7 Discussion, подраздел «Shallow adoption despite available depth»):

> «At present, there is little empirical evidence on which configuration strategies are most effective
> or under which conditions they yield measurable improvements.»

Контекст (v1, дословно):

> «This gap between available depth and actual usage likely reflects both the novelty of these
> mechanisms and the effort required to configure them. Claude Code was released only in February 2025,
> with Skills and Subagents introduced even more recently. Beyond recency, developers may gravitate
> toward the lowest-friction mechanism (i.e., Context Files) without exploring more advanced options.
> Defining executable Skills with scripts and structured resources requires additional design and
> maintenance effort compared to authoring Markdown instructions, which may deter adoption in the
> absence of clear guidance on best practices. **At present, there is little empirical evidence on which
> configuration strategies are most effective or under which conditions they yield measurable
> improvements.**»

### ⚠️ НО: в v3 и v5 этой фразы БОЛЬШЕ НЕТ. Авторы её убрали.

v3/v5, §7, на её месте:

> «Future work should assess whether deeper configuration leads to measurable performance gains,
> **extending early evidence on the impact of Context Files (Lulla et al., 2026).**»

**Это самая важная калибровка всего чтения, и она ОБРАТНА ожиданию брифа.**
Авторы **сняли** заявление «свидетельств нет» — потому что между февралём и июнем 2026 свидетельства
**появились**: Lulla (2601.20404, янв), Gloaguen (2602.11988, фев), McMillan (2605.10039, май).

Цитировать «мало эмпирических свидетельств» в июле 2026 = цитировать **отозванную авторами версию**.

**Правильная калибровка амбиций аудита — не «никто ничего не знает, значит нам всё можно», а:
«свидетельства есть, и они в основном НУЛЕВЫЕ или ОТРИЦАТЕЛЬНЫЕ для крафта самого файла».**

---

## 2. ★★★ McMillan 2605.10039 — факторный эксперимент. **НУЛЬ ПО ВСЕМ ЧЕТЫРЁМ НАШИМ РУЧКАМ**

**Тир:** S3 (одиночный автор, препринт, без venue; автор — Deloitte Digital по LinkedIn).
**Indirectness: SMALL** — но по *харнессу* и *артефакту* это **none**: буквально Claude Code CLI + CLAUDE.md.
**Методологически — сильнейшая работа во всём наборе** (mixed-effects + байесовский компаньон +
поправка на множественные сравнения). Ровно иллюстрация тезиса критика: **тир антикоррелирует с
решение-релевантностью.**

### Дизайн (дословно из абстракта arXiv)

> «We report a systematic factorial study of these choices using four manipulated variables, measuring
> compliance with a trivial target annotation across **1,650 Claude Code CLI sessions (16,050
> function-level observations)** on two TypeScript codebases, three frontier models (**primarily
> Sonnet 4.6**, with Opus 4.6 as a CLI-matched cross-model check and Opus 4.7 reported descriptively
> under a CLI-version confound), and five coding tasks. We use mixed-effects models with a Bayesian
> companion.»

**Четыре манипулируемые переменные** и их уровни *(уровни — из вторичной сводки, см. §8 «Честность»)*:

1. **Размер файла** — 4 уровня: **25 / 100 / 250 / 500 строк**
2. **Позиция инструкции** — 5 порядковых уровней: **верх / ≈25% / центр / ≈75% / низ**
3. **Архитектура файлов** — 3 уровня: **один CLAUDE.md** / **CLAUDE.md + AGENTS.md** / **+ два вложенных
   per-directory CLAUDE.md**
4. **Наличие противоречащих инструкций** в соседнем файле

### Результат (дословно)

> «**None of the four structural variables or three two-way interactions produces a detectable contrast
> after multiple-testing correction.** Size and conflict nulls are supported by **affirmative-null Bayes
> factors (BF10 between 0.05 and 0.10)**; position and architecture nulls are failures to reject without
> Bayes-factor support. The largest effect we measured is **within-session**: each additional function
> the agent generates is associated with approximately **5.6% lower odds of compliance per step
> (OR = 0.944)** within the session-length range we tested, though the relationship is non-monotonic
> rather than a constant per-step effect.»

### Что это значит для нас — по каждой ручке

| Ручка, которую мы собирались крутить | Вердикт |
|---|---|
| «Сократить CLAUDE.md» | **Аффирмативный нуль** (BF10 0.05–0.10) на 25→500 строк. Размер **не влияет на adherence** |
| «Положить важные правила выше» | **Нуль** (без BF-поддержки — недомощно, но эффекта нет) |
| «Разнести/склеить глобальный + проектный + вложенные» | **Нуль** (без BF-поддержки). Это **буквально наша топология** (global + project) |
| «Вычистить противоречия между файлами» | **Аффирмативный нуль** (BF10 0.05–0.10) |
| **Ничего из этого** | **Единственное, что двигало adherence — ДЛИНА СЕССИИ** |

### 🔑 Единственный живой рычаг: **внутрисессионный распад комплаенса**

OR = 0.944 на каждую сгенерированную функцию (≈ −5.6% шансов соблюдения на шаг).
**Правило не «перепиши файл», а «переинжектируй в момент действия».**
→ Это **прямая эмпирическая поддержка нашей хуковой архитектуры**
(`SessionStart` инжекция RAILS, `PostToolUse` напоминалки, `commit-msg` гейты), и **против** веры в то,
что фронт-лоуд текста в CLAUDE.md держит поведение на протяжении длинной сессии. Наши сессии —
многочасовые, десятки правок. Именно там комплаенс и утекает.

### ⚠️ Границы этого нуля — читать строго

1. **Размер тестировали до 500 строк.** Наш стек (глобальный CLAUDE.md + проектный CLAUDE.md +
   MEMORY.md-индекс + 48 файлов памяти + RAILS-инжекция) — **сильно за пределами 500 строк**.
   Аффирмативный нуль **НЕ распространяется** на наш режим. Он говорит: «в диапазоне 25–500 строк
   размер не важен», а не «размер не важен никогда».
2. **Зависимая переменная — «trivial target annotation».** Одна простая, механически проверяемая
   инструкция. Нуль на тривиальной аннотации **НЕ лицензирует** вывод «содержание CLAUDE.md не важно»
   для наших сложных процессных протоколов (ITP, MDP, autoflow, patch-cut). Разрыв конструкта —
   реальный и его нельзя замазывать.
3. Модели: Sonnet 4.6 (основная), Opus 4.6 (кросс-чек). Мы работаем на Opus 4.8 — вне выборки.

**rule_or_hypothesis: RULE** (для «не тратить силы на переупорядочивание/сокращение ради adherence
в диапазоне ≤500 строк») + **HYPOTHESIS** (для нашего >>500-строчного режима и для сложных процессных
правил — нужен собственный тест, см. §7).

---

## 3. ★★★ Gloaguen et al. 2602.11988 — **context-файлы НЕ улучшают успех и стоят +20%**

**Тир: S2** (ETH Zürich / линия Vechev–Raychev; сильная группа). v1 12 фев 2026, v2 23 июн 2026.
**Indirectness: SMALL** (одна из четырёх связок — буквально **Claude Code + Sonnet-4.5**; артефакт —
буквально AGENTS.md/context file; задачи — SWE-bench-класс, не наш многочасовой процесс).

### Абстракт, дословно

> «Although this practice is strongly encouraged by agent developers, **there is currently no rigorous
> investigation into whether such context files are actually effective for real-world tasks.** […]
> **Surprisingly, we find that providing context files does not generally improve task success rates,
> while increasing inference cost by over 20% on average.** This observation **holds across different
> LLMs, coding agents, and for both LLM-generated and developer-committed context files.** Specifically,
> we find that **while instructions in the context files are well followed by coding agents, repository
> overviews, although popular and recommended by model providers, are not helpful.** We conclude that
> while context files are useful for specifying non-standard coding practices, **any attempts to improve
> performance should be rigorously evaluated before deployment.**»

### Установка

- **Бенчмарки:** SWE-bench Lite (300 задач, 11 популярных Python-репо, context-файлов нет → генерировали
  LLM) + **AGENTbench** (138 инстансов, 12 нишевых Python-репо, где есть **живые, написанные
  разработчиками** context-файлы).
- **Связки:** Claude Code + **Sonnet-4.5** · Codex + GPT-5.2 · Codex + GPT-5.1-mini · Qwen Code + Qwen3-30b-coder.
- Один сэмпл на агента, temperature=0 у большинства.

### Числа

| Условие | Успех | Стоимость | Шаги |
|---|---|---|---|
| **SWE-bench Lite**, LLM-generated context | **−0.5%** | **+20%** | **+2.45** |
| **AGENTbench**, LLM-generated context | **−2%** | **+23%** | **+3.92** |
| **AGENTbench, human-written (живые!) context** | **+4%** | **+19%** | **+3.34** |

Reasoning-токены у GPT-моделей: **+14…22%**.

### Механизм (почему хуже) — дословно

> «Both LLM-generated and developer-provided context files **encourage broader exploration** (e.g., more
> thorough testing and file traversal)»

> «**unnecessary requirements from context files make tasks harder**»

Агенты **исправно следуют** инструкциям — и именно поэтому исследуют **шире, но менее сфокусированно**.
Это важно: провал не в том, что файл игнорируют, а в том, что его **слушаются слишком буквально**.

### 🔑 Что внутри файла работает, а что — балласт (единственные прямые данные в природе)

- **Repository overviews = БАЛЛАСТ.** 95–100% сгенерированных файлов их содержат; они **не сокращают
  число шагов до нахождения нужного файла**. Рекомендуются вендорами — и не работают.
- **Упоминания инструментов = РАБОТАЮТ.** Агент использует инструмент **в 1.6× чаще**, если он упомянут.
  Репо-специфичный инструмент (напр. `uv`): **2.5×** при упоминании против **0.05×** без.
- **Context-файлы КОНКУРИРУЮТ с существующей докой:** если удалить из репо документацию,
  LLM-generated context-файлы начинают **помогать (+2.7%)**. То есть их ценность — не в новизне
  информации, а в замещении того, что и так есть.

### Приложение к НАШЕМУ CLAUDE.md — конкретные резы и киперы

| Наш раздел | Вердикт по Gloaguen |
|---|---|
| «Что строим», «Repository structure (для AI)» (дерево) | **repository overview → эмпирический балласт. КАНДИДАТ В РЕЗ.** |
| Дублирование статуса из ROADMAP/README | **конкурирует с доками → отрицательная ценность.** Наш pointer-collapse (не дублировать статус) — **эмпирически подтверждён**, и не только анти-дрейфом |
| `npm run verify`, `npm run next-dec-dev`, `node …/rails-build.js`, `bash …/install-pre-commit.sh` | **упоминания инструментов → 1.6–2.5× употребления. САМЫЙ ЦЕННЫЙ КОНТЕНТ. ДЕРЖАТЬ.** |
| Каждое необязательное правило | «unnecessary requirements make tasks harder» — **цена не нулевая** |

### Оговорки (не переоценивать)

Ни одного стат-теста, p-value, CI. Эффекты (−0.5%, −2%, +4%) **малы и при одном сэмпле могут быть
шумом**. Читать надо не знак ±2%, а **устойчивое отсутствие выигрыша при устойчивом росте цены на 20%**.
Только Python. Только issue-resolution.

**contradicts_our_prior = TRUE. rule_or_hypothesis: RULE** (для «вырезать overview-контент» и «держать
упоминания инструментов» — ≥2 источника + прямое свидетельство).

---

## 4. ★★☆ Lulla et al. 2601.20404 — источник хайпа «−29%», и у него **дыра в дне**

**Тир: S2** (принята на ICSE 2026 JAWs workshop). **Indirectness: SMALL→LARGE** (агент — **Codex,
не Claude Code**; модель — gpt-5.2-codex).

### Числа (дословно)

> «Median completion time shows a similar reduction, decreasing from **98.57s to 70.34s** (28.23s,
> **≈28.64%**)» — Wilcoxon signed-rank, **p < 0.05**

> «Median output tokens decrease more modestly, from **2,925.00 to 2,440.00** (485 tokens, **≈16.58%**)»
> — Wilcoxon, **p < 0.05**

Input-токены (среднее): 353 010 → 318 652 (**−9.73%**). Т.е. входные токены **не выросли**, несмотря
на добавление файла в контекст.

**Дизайн:** парный within-task (тот же снапшот репо, та же задача, с AGENTS.md и без), **10 репо,
124 PR**, **один прогон на условие**. Файлы — **настоящие**, из pre-merge коммитов, с контент-фильтром
(оставляли только те, что содержат conventions / architecture / project description).

### ⚠️ КРИТИЧЕСКАЯ ДЫРА: корректность НЕ измерялась

Дословно:

> «A comprehensive evaluation of the output quality, e.g., **the semantic correctness or the functional
> equivalence to the merged PR, is beyond the scope of this paper.**»

Единственная проверка — санити-чек на 50 случайных PR: «to confirm that they resulted in **non-empty,
non-trivial code changes**».

**Альтернативное объяснение, которое авторы не исключили: агент с AGENTS.md просто СДЕЛАЛ МЕНЬШЕ.**
«Быстрее и меньше выходных токенов» — ровно та сигнатура, которую даёт срезание работы. Без метрики
корректности −28.64% времени **не интерпретируемо как выигрыш**.

### 🚩 Анти-хайп флаг

В выдаче поиска сразу всплыл блог **«AGENTS.md: The Research-Backed Guide to Making AI Agents 29%
Faster»**. Это хайп-надстройка над работой, которая **никогда не проверяла корректность результата** и
**опровергается по знаку** более поздней работой с проверкой успеха (Gloaguen: цена **+20%**, а не −17%).

### 🔥 ПРЯМОЕ ПРОТИВОРЕЧИЕ В ЛИТЕРАТУРЕ — не замазывать

| | Lulla 2601.20404 | Gloaguen 2602.11988 |
|---|---|---|
| Токены/цена от context-файла | **−9.7…−16.6%** | **+19…+23%** |
| Корректность | **не мерили** | мерили: **не растёт** |
| Агент | Codex / gpt-5.2-codex | Claude Code/Sonnet-4.5, Codex/GPT-5.2, +2 |
| Задачи | воспроизведение PR (≤100 LoC, ≤5 файлов) | SWE-bench / AGENTbench issue resolution |
| Файлы | живые, отфильтрованные по контенту | в основном LLM-generated (+ живые на AGENTbench) |

**Знак эффекта на цену — противоположный.** Я **не могу это адjudicировать** имеющимися данными.
Правдоподобные развязки: разные агенты; разные задачи; у Lulla файлы прошли контент-фильтр (только
conventions+architecture+description), у Gloaguen — в основном сгенерированный шум; и у Lulla нет
метрики качества, поэтому «дешевле» может значить «хуже».

**Вывод для аудита: вопрос «помогает ли context-файл» в литературе НЕ ЗАКРЫТ.
Любой, кто цитирует −29% как установленный факт, цитирует незавершённое исследование.**

---

## 5. ★★☆ ContextCov 2603.00822 — **пассивный текст = 67% комплаенса; гейты = 88.3%**

**Тир: S3** (одиночный автор, препринт). **Indirectness: SMALL.** Мотивация — буквально наш класс файлов.

Абстракт, дословно:

> «developers rely on natural language instruction files such as [AGENTS.md] to express project-specific
> coding conventions, tooling restrictions, and architectural boundaries. However, **because these
> instructions remain passive text, agents frequently violate documented constraints due to context
> window saturation or conflicting local context.** In autonomous settings without real-time human
> supervision, **such violations rapidly compound into technical debt.**»

Замеренный комплаенс:

| Режим | Соблюдение ограничений |
|---|---|
| **Prompt-only** (правило живёт в инструкционном файле — **наш случай для не-гейтованных правил**) | **67.0%** |
| LLM-reflection baseline | 50.3% |
| **ContextCov** (исполняемые guardrails) | **88.3%** |

### 🔑 Это самое прямое обоснование нашей архитектуры гейтов из всех найденных

**Правило, живущее прозой в CLAUDE.md, нарушается примерно в трети случаев.**
Наши `process-gate.js` / `lesson-presence-gate.js` / `pre-commit` — это ровно переход 67% → ~88%.
И таблица «Process triggers» в CLAUDE.md уже честно помечает 🔒 = hard-enforced против «дисциплины».

**Из этого следует резкий, но обоснованный дизайн-принцип:**

> **Всё, что мы реально не готовы видеть нарушенным в трети случаев, обязано иметь гейт.
> Всё, что не гейтуется, надо либо принять как ~67%-правило, либо удалить из файла — потому что
> оно платит токенами каждую сессию, а исполняется в двух случаях из трёх.**

Это сходится с McMillan: комплаенс **распадается по ходу сессии** (OR=0.944/шаг), а гейт срабатывает
**в момент действия** и к распаду иммунен.

**rule_or_hypothesis: RULE** (два независимых источника: ContextCov даёт число, McMillan даёт механизм
распада; наш собственный `process-gate` — работающий прецедент).

---

## 6. ★★☆ Agent READMEs 2511.12884 (+ 2509.14744) — **размер, структура, аккреция**

**Тир: S2** (11 авторов, среди них Bram Adams, Ahmed E. Hassan — топ-имена SE-эмпирики). 17 ноя 2025.
Корпус: **2 303 context-файла из 1 925 репо** (Claude Code 922 CLAUDE.md, Codex 694 AGENTS.md,
Copilot 687 copilot-instructions.md). Ранняя версия — 2509.14744: 253 CLAUDE.md / 242 репо.

### Размер — единственные числа в природе

| Инструмент | Медиана слов |
|---|---|
| **Claude Code (CLAUDE.md)** | **485.0** |
| OpenAI Codex (AGENTS.md) | 335.5 |
| GitHub Copilot | 535.0 |

Разброс: от «минимального» (**20 строк, 3 секции**) до «всеобъемлющего» (**329 строк, 74 секции**).
Читаемость Flesch: **FRE 16.6** для Claude Code = «**very difficult**».

### 📏 Наше положение относительно популяции

Медианный CLAUDE.md в природе ≈ **485 слов**. Наш инжектируемый стек — глобальный CLAUDE.md +
проектный CLAUDE.md + MEMORY.md-индекс (~30 записей) + 48 файлов памяти + авто-инжект RAILS —
**на порядок с лишним больше**. Мы — **экстремальный аутлаер по объёму**.

**НО (и это дисциплина, а не утешение):** McMillan показал аффирмативный нуль по размеру **на 25–500
строк**. Значит корректная формулировка — не «мы слишком большие, поэтому агент нас плохо слушает»
(это не показано), а:

> **Размер — это проблема ЦЕНЫ (токены каждой сессии), а не проблема КОМПЛАЕНСА.**
> И наш диапазон лежит ЗА границей, где нуль по комплаенсу подтверждён.

### Структура (медианы, Claude Code)

H1 = 1.0 · H2 = 6–7 · H3 = 11.0 · H4 = 5.0 · H5 — 6 файлов на весь корпус · H6 — нет.
«Shallow hierarchy… typically centered on a single H1 heading with content organized primarily under
H2 and H3 sub-sections.»

### Контент — 16 типов (доля файлов, Claude Code)

Testing **75.0%** · Impl. details **69.9%** · Architecture **67.7%** · Development process **63.3%** ·
Build & Run **62.3%** · System overview **59.0%** · Maintenance 43.7% · Config & Env 38.0% ·
Documentation 26.8% · AI integration 24.4% · Debugging 24.4% · DevOps 18.1% · Performance 14.5% ·
Security 14.5% · UI/UX 8.7% · Project management 5.4%.

Вывод авторов: «Instructions are heavily skewed toward **functional operations**… while critical
**non-functional requirements like Security and Performance are rare**.»

### 🔑 АККРЕЦИЯ — эмпирическое подтверждение «context debt»

- **67.4%** CLAUDE.md-файлов правятся более чем в одном коммите (медианный интервал между правками
  ~**24.1 часа**).
- **Медиана добавленного: 57 слов/коммит. Медиана удалённого: <15 слов.**
- Дословно: «Manifest evolution is driven by **small, incremental additions, while deletions are
  minimal**» → «behaving as **living configuration artifacts** rather than static documents».
- Авторы прямо предлагают ввести термин «**context debt** as a new form of technical debt».

**Это ровно наш диагноз, подтверждённый на 2 303 файлах: ACF растут монотонно, из них почти не
удаляют.** Наш файл — не аномалия по *механизму*, он аномалия по *накопленному объёму*
(мы просто дольше и дисциплинированнее аккретировали).

---

## 7. ★★☆ Code Cleanliness 2605.20049 (SonarSource) — метапаттерн + урок про мощность

**Тир: S2/S3** (индустриальный препринт). **Indirectness: LARGE для нашего вопроса** (интервенция —
чистота *кода*, не context-файл), **но харнесс совпадает точно: Claude Code + Sonnet 4.6.**

Дизайн: 6 minimal-pair репо (Python/Java), 33 задачи, **660 трайлов** (33 × 2 стороны × 10 прогонов).

| Метрика | Чистый vs грязный код |
|---|---|
| **Pass rate** | **91.3% vs 92.1% → −0.9 п.п. (нуль; и номинально в пользу ГРЯЗНОГО)** |
| Input-токены | **−7.1%** |
| Output-токены | **−8.5%** |
| Reasoning-символы | −11.1% |
| **File revisitation** | **−33.8%** |
| Conversation turns | −7.0% |

Дословно: «the agents seem to accomplish the given tasks consistently, regardless of whether working on
cleaner or messier code, as the pass rate changes by **less than a percentage point** between sides».

### 🔑 МЕТАПАТТЕРН — три независимых работы говорят одно и то же

| Работа | Интервенция | Успех | Цена/навигация |
|---|---|---|---|
| Cleanliness 2605.20049 | чистота кода | **≈0** | **−7…−34%** |
| Gloaguen 2602.11988 | context-файл | **≈0** | **+20%** |
| Lulla 2601.20404 | AGENTS.md | *не мерили* | **−10…−17%** |

> **Интервенции в СРЕДУ агента двигают СТОИМОСТЬ и НАВИГАЦИЮ, а не СПОСОБНОСТЬ.**

**Прямое следствие для нашего аудита:** если мы продаём переработку CLAUDE.md как «агент будет решать
задачи лучше» — литература говорит **нет**. Честный ожидаемый выигрыш — **токены, шаги, стоимость
сессии**. Это надо зафиксировать в целях аудита *до* того, как мы начнём мерить, иначе получим
разочарование или (хуже) подгонку.

### ⚠️ И урок про МОЩНОСТЬ, который решает, что нам вообще можно измерить

Авторы честно пишут: разброс токенов **на одинаковых задачах — до 2.5×** между самым дешёвым и самым
дорогим трайлом; **у 72% задач разброс >2×**.

**Мой собственный расчёт** (авторы стат-тестов не делали — это моя арифметика, не их результат):
при 330 трайлах на сторону и pass rate ≈92%, SE разницы ≈ √(0.913·0.087/330 + 0.921·0.079/330)
≈ **2.15 п.п.**, т.е. 95% CI ≈ **±4.2 п.п.** — и это **без** учёта кластеризации по 33 задачам
(с ней — шире).

> **660 трайлов не способны детектировать эффект на успех меньше ~4–5 п.п.**
> А McMillan понадобилось **1 650 сессий / 16 050 наблюдений**, чтобы утверждать нули по adherence.

**Мы такой мощности не соберём никогда.** Отсюда — методологическое ПРАВИЛО для нашего аудита (§8).

---

## 8. ⚠️ 2606.25257 — это **REGISTERED REPORT. РЕЗУЛЬТАТОВ НЕТ ВООБЩЕ.**

Бриф просил её как источник знаний про «эволюцию ACF на уровне коммитов». **Она их не содержит.**

Дословно из абстракта: «This paper **plans to investigate** the evolution of ACFs…»
Весь текст — в будущем времени; **Секции Results не существует**; все гипотезы сформулированы как
нулевые, к проверке. Единственные числа — **обоснование выполнимости**:

- AIDev: 116 211 репо / 932 791 PR с агентским кодом;
- ACF-датасет: 2 303 файла / 1 925 репо (= корпус Chatlatanagulchai);
- пилотный пайплайн: **10 763 коммит-снапшота** с context-файлами, 18 213 коммитов с метаданными,
  8 600 с пересечением.

Что там **есть** ценного — это **дизайн, который мы можем скопировать**: таксономия изменений ACF по
SWEBOK v4.0 (corrections / enhancements → corrective, preventive, adaptive, perfective, additive) +
привязка к метрикам качества кода (цикломатика, LoC, coupling, **Corrective Commit Probability**).

ACF у них = только `CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`;
**skills, импортируемые фрагменты и task-specific файлы явно ВНЕ scope** — т.е. наш слой скиллов/памяти
не покрыт даже планируемым исследованием.

---

## 9. ЧТО ЛИТЕРАТУРА **НЕ** ЗНАЕТ (белые пятна = наши возможности)

Бриф спрашивал: «какие паттерны протухания ACF задокументированы».
**ЧЕСТНЫЙ ОТВЕТ: НИ ОДНОГО. Протухание ACF никем эмпирически не измерено.**

- 2511.12884: staleness/противоречия — «**Not analyzed**».
- 2509.14744: прямо выносит в future work — «Examine the **evolution and decay** of Claude.md files».
- 2606.25257: **планирует** мерить, результатов нет.
- Дублирование ACF ↔ README/доки: 2511.12884 — «**Not investigated**». (Косвенно только Gloaguen:
  удаление доки делает context-файл полезнее → они конкурируют.)

**Никем не изучено вообще:**
1. **Файлы памяти / persistent memory** (наши 48 + MEMORY.md). 2602.14690 v1: «**No repositories
   observed using Claude Code's persistent Subagent memory**» — нулевая база, ноль исследований.
2. **Хуковые инжекции в контекст** (наш `rails-session-start.js`).
3. **Длинные многочасовые процессные воркфлоу** (релизный цикл, журнал, PR-каденс). Всё, что измерено, —
   SWE-bench-задачи, PR ≤100 LoC, тривиальные аннотации.
4. Глубокие конфигурации (Skills+Subagents+Hooks вместе): 2602.14690 v5 честно — «Future work should
   assess whether **deeper configuration** leads to measurable performance gains». **Мы находимся в
   верхних ~5% глубины конфигурации (Skills у 5.5% репо, Subagents у 4.6%) и работаем ВСЛЕПУЮ.**

---

## 10. ИТОГОВЫЕ ПРАВИЛА И ГИПОТЕЗЫ ДЛЯ АУДИТА

### RULE (класть в решения)

1. **Не оптимизировать порядок/позицию правил ради adherence** (McMillan: нуль по позиции). Порядок —
   вопрос читаемости для человека, не для агента.
2. **Не ждать выигрыша в успехе задач.** Ожидаемый выигрыш от переработки контекста = **токены и шаги**,
   не качество (3 независимых работы). Цель аудита формулировать в токенах/шагах.
3. **Вырезать repository-overview-контент** («Что строим», дерево структуры репо). Единственные прямые
   данные (Gloaguen) говорят: он есть у 95–100% файлов и **не сокращает поиск нужного файла**.
4. **Не дублировать в CLAUDE.md то, что есть в доках.** Context-файлы конкурируют с докой, а не
   дополняют её. Наш pointer-collapse статуса — **правильное решение, теперь и по этой причине**.
5. **Держать и наращивать упоминания конкретных команд/инструментов** (`npm run verify`,
   `next-dec-dev`, скрипты). Это **самый доказанно-работающий контент** (1.6× / 2.5× vs 0.05×).
6. **Любое load-bearing правило обязано иметь гейт.** Проза = **~67% комплаенса** (ContextCov), и он
   ещё и **распадается по ходу сессии** (OR 0.944/шаг). Негейтуемое правило — либо принять как
   «две трети», либо удалить.
7. **Правила о том, «что запрещено делать», надо переинжектировать в момент действия**, а не
   фронт-лоудить (внутрисессионный распад — единственный подтверждённый эффект во всём корпусе).

### HYPOTHESIS (нужен наш собственный тест)

1. **H-SIZE:** «Наш >>500-строчный стек деградирует adherence» — **не показано** и **вне диапазона**
   аффирмативного нуля McMillan. *Тест:* парный A/B на **наших** правилах (не на тривиальной
   аннотации): полный стек vs урезанный, ≥30 парных прогонов, DV = **токены сессии + шаги + доля
   соблюдённых гейтуемых правил ДО срабатывания гейта**. Успех задач **не мерить** — не хватит мощности.
2. **H-PROCESS:** «Нуль McMillan не переносится на сложные процессные протоколы (ITP/MDP/autoflow)».
   *Тест:* взять 5–10 наших правил с машинно-проверяемым следом (завёл ветку? обновил журнал? пинанул
   модель субагенту?) и померить базовый комплаенс. **Ожидание из литературы: ~67%.** Если сильно ниже —
   у нас проблема, которой нет у популяции.
3. **H-MEMORY:** «48 файлов памяти + индекс окупают свою токен-цену». **Нулевая литература.** Полностью
   наш вопрос; самый дорогой и самый неисследованный кусок стека.
4. **H-DEPTH:** «Глубокая конфигурация (Skills+Subagents+Hooks) окупается». Прямо назван открытым
   вопросом в 2602.14690 v5.

### Приоритет резов, отсортированный по доказательности

1. Overview/дерево репо — **рез** (прямые данные против).
2. Дубли статуса и доки — **рез** (прямые данные против).
3. Негейтуемые «дисциплинарные» правила — **либо гейт, либо рез** (67%-правило).
4. Упоминания команд — **держать** (единственный доказанный плюс).
5. Файлы памяти — **мерить, не резать вслепую** (нулевая литература в обе стороны).

---

## 11. ЧЕСТНОСТЬ О НЕНАЙДЕННОМ / СЛАБОМ

1. **Полный текст 2605.10039 недоступен.** HTML v1 и v2 → 404; PDF (1.3 МБ) не извлекается текстом.
   **Абстракт (нули, BF10 0.05–0.10, OR=0.944, 1 650 сессий) — first-party, дословно с arXiv abs.**
   А вот **уровни переменных** (размер 25/100/250/500 строк; позиция 5 уровней; архитектура 3 уровня) —
   из **вторичной сводки** поисковой выдачи, **не сверены с PDF**. Средняя уверенность. Если для решения
   критично точное значение верхней границы диапазона размера — надо достать PDF другим путём.
2. **Не удалось адjudicировать противоречие Lulla ↔ Gloaguen** по знаку эффекта на стоимость
   (−17% против +20%). Гипотезы развязки перечислены, но это гипотезы.
3. **2606.25257 = ноль результатов** (registered report). Бриф её переоценивал; я не дотягиваю.
4. **Протухание ACF — не измерено никем.** Прямой ответ на вопрос брифа: паттернов протухания
   **не задокументировано**.
5. **Gloaguen без стат-тестов**: эффекты ±0.5–4% при одном сэмпле могут быть шумом. Нельзя опираться
   на *знак* маленьких эффектов; опора — на «нет выигрыша при +20% цены».
6. **Cleanliness-работа (2605.20049) — indirectness LARGE** для нашего вопроса. Я использую её только
   как (а) метапаттерн «цена, не способность» и (б) урок про мощность. Как свидетельство о
   context-файлах она **не годится** и я её так не использую.
7. **Ни одна работа не тестирует нашу модель (Opus 4.8) и наш режим** (многочасовые процессные сессии).
   Sonnet 4.5/4.6, Opus 4.6, GPT-5.x, Qwen.
8. Не читал (бюджет): 2602.20478 «Codified Context» (индустриальный кейс), 2605.08435 (датасет).
   2602.20478 может содержать релевантный индустриальный опыт большой кодовой базы — кандидат на добор.
9. **Тир антикоррелирует с полезностью — подтверждено на этом наборе.** Самая решение-релевантная и
   методологически сильнейшая работа (McMillan) — **S3**: одиночный автор, без venue, HTML даже не
   опубликован. Самая «солидная» по составу авторов (2511.12884, 11 авторов, Hassan/Adams) — чисто
   описательная, ничего не говорит об эффективности. Взвешивание по тиру дало бы **противоположный**
   и **неверный** отбор.
