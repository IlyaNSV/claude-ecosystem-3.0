# READ P7-mc7 — MC7: деградация следования инструкциям при росте их числа

> **Роль:** агент глубокого чтения (Run 2). Читал первоисточники: arXiv abs+HTML, ACL Anthology,
> **PDF извлечены локально** (`pdf-parse`) и прогреплены — там, где WebFetch-суммаризатор не справлялся
> с бинарём. Все числа ниже — из первичного текста работ, не из пересказов.
> **Дата:** 2026-07-12.
>
> **Взвешивание — по инструкции брифа:** `decision-delta × (1 − indirectness)`, НЕ по тиру S-лестницы.

---

## 0. TL;DR — что меняется в решении

1. **Главный источник MC7 — не IFScale, а AgentIF** (NeurIPS 2025 D&B **Spotlight**). Это S1 **и**
   низкая indirectness одновременно: реальные системные промпты боевых агентов (**включая Cursor и Manus**),
   ~1 723 слова, ~11.9 ограничений. Лучшая модель — **CSR 59.8 %**, ISR **27.2 %**.
   ⇒ Тезис критика «S1 антикоррелирует с решение-релевантностью» **для MC7 неверен** — есть S1 с низкой indirectness.

2. **Разрыв переноса ИЗМЕРЕН авторами на тех же моделях:** GPT-4o `IFEval 87.0 → AgentIF 58.5`
   (**−28.5 п.п.**) — только от перехода «синтетика → реальный агентный промпт».
   ⇒ Обязательный дисклеймер брифа не просто «нужен» — он **количественно подтверждён**, и в
   **пессимистичную** сторону.

3. **«Обвал» в бенчмарках MC7 — на 80–95 % арифметика конъюнкции, а не «модель перестаёт слушаться».**
   ManyIFEval (Findings EMNLP 2025) сам это показывает: оценщик **чистой независимости** предсказывает
   «все N соблюдены» с **MAE 0.02, r = 0.994**. Per-instruction соблюдение падает **мягко** (0.94→0.85 при 1→10).
   ⇒ Наши ~80 правил **не обязаны срабатывать одновременно** → страшные цифры к нам применимы **не напрямую**.
   ⇒ НО любой наш **длинный конъюнктивный ритуал** (patch-cut, 6-шаговый git-цикл, «журнал+CHANGELOG+counts+verify в одном коммите») **обваливается мультипликативно** → это ровно то, что оправдывает 🔒-гейты.

4. **Правила стоят денег, даже когда они соблюдены** (Paradox/SUSTAINSCORE): вставка **само-очевидного**
   ограничения (которое модель и так выполнила) роняет решение задачи. Claude-Sonnet-4.5 удерживает
   **85.0 %** на Multi-Hop QA; на **коде 7 моделей удерживают <60 %**. Контроли убивают объяснения
   «это просто длина» и «это просто порядок».

5. **Но цена выходит на плато после ~5 ограничений** ⇒ **резать 80 → 60 правил, вероятно, не купит почти ничего.**
   Рычаг — не «меньше правил в файле», а **вынести правило из промпта** (гейт / хук / тул / субагент).

6. **Переупорядочить и «объяснить приоритет» — НЕ работает.** IHEval (NAACL 2025): явный
   instruction-priority prompt **ухудшает** (GPT-4o 70.0 → 67.2). Paradox: ни один из 3 альтернативных
   шаблонов (в т.ч. «сначала реши задачу, потом ограничение») не помогает. AgentIF: хуже всего модели
   справляются именно с **мета-ограничениями** (правилами о правилах).
   ⇒ Наши ITP/MDP-мета-правила («при сомнении бери СТАРШИЙ тир», «"просто сделай" подавляет ITP»,
   «🔒 — hard, остальное — дисциплина») — **самый ненадёжный класс правил в CLAUDE.md**.

7. **Народная мудрость сообщества («у тебя бюджет 150–200 инструкций», «CLAUDE.md ≤ 300–350 слов») —
   блог-тир без первоисточника и, судя по всему, прямое ЛОЖНОЕ ПЕРЕНЕСЕНИЕ кривой IFScale
   (keyword-вставки) на процессные правила.** Не тащить в аудит.

---

## 1. Провенанс и тиры (проверено)

| Работа | ID | Venue | Тир | Indirectness к CLAUDE.md |
|---|---|---|---|---|
| **AgentIF** | `2505.16944` | **NeurIPS 2025 D&B — Spotlight** (репо THU-KEG: `[NIPS 2025 DB Spotlight]`) | **S1** | **small** |
| **IHEval** | `2502.08745` | **NAACL 2025** (`aclanthology.org/2025.naacl-long.425`), Amazon | **S1** | medium |
| **ManyIFEval / When Instructions Multiply** | `2509.21051` | **Findings of EMNLP 2025** (`2025.findings-emnlp.896`) | **S1–S2** | medium |
| **RealGuardrails / SystemCheck** | `2502.12197` | arXiv only (dblp: CoRR). Berkeley (Mu, Lu, Lavery, **Wagner**) | **S2** | **small–medium** |
| **IFScale** | `2507.11538` | arXiv only (Distyl AI) | **S2** | **large** |
| **Paradoxical Interference / SUSTAINSCORE** | `2601.22047` | arXiv only (Tsinghua) | **S2–S3** | medium |
| **SEQUOR** | `2605.06353` | arXiv only | **S3** | medium |

⚠ **Провенанс-предупреждение о независимости:** **AgentIF и Paradox — одна группа**
(Yunjia Qi, Hao Peng, Tsinghua). Это **не** два независимых источника; при подсчёте «≥2 независимых»
их надо считать за один голос.

⚠ **RealGuardrails переименован**: репо/датасет теперь **SystemCheck** («A Closer Look at System Prompt
*Reliability*»), arXiv-заголовок прежний. Сплит `precedence` в HF-карточке **отсутствует** — есть
`handwritten` (239) и `distractors` (504).

---

## 2. AgentIF — единственная работа про НАШ класс артефакта (S1, indirectness = small)

**Что это.** 707 размеченных человеком инструкций из **50 реальных агентных приложений**: 40 агентов
с GitHub (авторы прямо называют **Cursor** и **Manus**) + 10 из промышленных workflow
(~200 DAU, ~300 запросов/день, 120 000 обслуженных сервисов). Собирали **только системные промпты**
(«task specifications, goals, and tool descriptions»).

**Статистика (из Table 1 и §3):**
- средняя длина инструкции — **1 723 слова**, максимум **15 630 слов**;
- **11.9 ограничений** на инструкцию;
- для сравнения, **IFEval: средняя длина инструкции — 45 слов** ← вот масштаб пропасти
  «мейнстрим-литература про instruction-following» ↔ «реальный агентный промпт».

**Метрики.** `CSR` = доля корректно соблюдённых **отдельных** ограничений. `ISR` = доля инструкций,
где соблюдены **ВСЕ** ограничения (⚠ конъюнктивная метрика — см. §4).
Важно: **несработавшие условные ограничения из проверки исключаются** («Condition constraints that are
not triggered are excluded from verification») — то есть CSR честно меряет «соблюдено, КОГДА применимо».
Это ровно наша операционная величина.

**Результаты (Table 2, из PDF):**

| Модель | CSR | ISR |
|---|---|---|
| o1-mini `[T]` | **59.8** | 26.9 |
| GPT-4o `[N]` | 58.5 | 26.4 |
| Qwen3-32B `[N]` | 58.4 | 41.1* |
| Mistral-7B-Instruct-v0.3 | 46.8 | — |
| Conifer-DPO-7B `[S]` | 44.3 | — |

\* колонки ISR/CSR в PDF-экстракции частично перемешаны; **текстово достоверно**:
> «Even the best-performing model, o1-mini, achieves only a **CSR of 59.8**. ISR results are even lower,
> with the **highest reaching just 27.2**.»

**★ РАЗРЫВ ПЕРЕНОСА, ИЗМЕРЕННЫЙ АВТОРАМИ НА ТЕХ ЖЕ МОДЕЛЯХ:**
> «Compared to their performance on the commonly used benchmark IFEval, all models exhibit a dramatic
> drop, for example, **GPT-4o drops from 87.0 to 58.5**.»

**−28.5 п.п. только от смены синтетика→реальность**, при том что число ограничений (11.9) **меньше**,
чем в типичном multi-constraint бенчмарке. Это и есть ответ на обязательный вопрос брифа.

**Что именно ломается (по типам ограничений)** — приблизительно (две независимые экстракции сходятся):
- **vanilla** (правило в лоб, plain text) — **~81 %**
- **example** (следуй структуре примера) — ~59 %
- **condition** (сработает при условии: «если X — сделай Y») — **~43 %**
- **tool** (спецификация вызова инструмента) — **~27 %**

Текстовое подтверждение: *«the most challenging **condition and tool** constraints introduce new challenges»*.

> **⚠ Прямое попадание в нас.** Вся таблица «Process triggers» в CLAUDE.md — это **condition-constraints**
> («Когда я делаю это… → обязан…»). Плюс наши tool-правила (`dangerouslyDisableSandbox: true` для git/gh,
> `npm run next-dec-dev -- --claim`). Это **два худших класса** по AgentIF.

**★ МЕТА-ОГРАНИЧЕНИЯ (§4.5) — новый, ранее не учтённый нами класс.**
~**25 %** реальных агентных инструкций содержат «meta constraints» — **ограничения, управляющие другими
ограничениями**. Три типа (распределение): **constraint selection — 91.4 %**, constraint detailing — 7.5 %,
constraint prioritization — 1.0 %.
> «models generally perform the **worst on constraint selection**»

Наши мета-правила ровно этого класса:
- ITP: *«явное "просто сделай" / "не спрашивай" — **подавляет ITP** до конца сессии»*
- Autoflow: *«**Подавляется фразами** "локально только" / "не пушь пока" / "без PR"»*
- MDP: *«**при сомнении** между двумя тирами — бери **СТАРШИЙ**»*, *«тир = **worst-of** по осям»*
- Триггеры: *«🔒 = hard-enforced. **Остальное — дисциплина**»*
- *«Отсутствие маркера = задача тривиальна (ITP неприменим)»* — мета-правило об отсутствии правила

**Длина (§4.4):**
> «models with more constraints are inherently more difficult… Notably, **when instruction length exceeds
> 6 000 words, the ISR scores of all models are nearly 0**. This indicates that overly long instructions are
> rarely followed perfectly and **should be avoided in practice**. Instead, one can explore **decomposing tasks
> into several sub-tasks with several shorter instructions**.»

⚠ **Честная поправка:** ISR — конъюнктивная метрика (все ~12 ограничений сразу). При CSR≈0.58
`0.58^12 ≈ 0.1 %` — то есть «ISR≈0» **арифметически ожидаемо** и **не** является отдельным доказательством
«обрыва на 6 000 словах». Осмысленная нога — падение **CSR** с длиной (Figure 5, есть, но численно из
графика не извлекается). **Не тащить «6 000 слов = обрыв» как жёсткий порог.**

**Наши размеры (замерено сейчас):**
| Артефакт | Слов |
|---|---|
| `CLAUDE.md` проектный | **2 279** |
| `CLAUDE.md` глобальный | **1 172** |
| `MEMORY.md` (индекс) | **1 889** |
| **ИТОГО always-on** | **≈ 5 340 слов** |
| memory-каталог целиком (49 файлов, lazy) | 36 541 |

⇒ Наш **постоянно инжектируемый** контекст = **3.1× средней инструкции AgentIF** (1 723) и в том же
порядке, что верхний хвост их распределения. Мы **вне** диапазона, на котором кто-либо мерил.

**Ограничения (Appendix A, слова авторов):** полуавтоматическая сборка; только EN/ZH; **только zero-shot,
prompt-engineering не исследовался**.

---

## 3. ManyIFEval — «обвал» это в основном КОНЪЮНКЦИЯ (Findings EMNLP 2025)

**Что это.** ManyIFEval — до **10** верифицируемых IFEval-style ограничений на текст
(«answer must contain exactly 2 bullet points», «the letter m should appear at least 6 times»);
StyleMBPP — до 6 на код. 10 моделей (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, o3-mini, DeepSeek-V3/R1,
Qwen2.5-72B, Llama3.1-8B, Gemma2-9B/2B).

**Две метрики:**
- `Instruction-level` = средняя доля соблюдённых **отдельных** инструкций;
- `Prompt-level` = доля промптов, где соблюдены **ВСЕ** (= Hard Satisfaction Rate).

**Числа (Figure 3; две независимые выборки WebFetch сошлись):**

| Модель | метрика | n=1 | n=5 | n=10 |
|---|---|---|---|---|
| GPT-4o | Prompt-level (все) | 0.94 | 0.57 | **0.21** |
| GPT-4o | Instruction-level (каждое) | 0.94 | 0.89 | **0.85** |
| Claude 3.5 | Prompt-level | 0.95 | 0.72 | **0.48** |
| Claude 3.5 | Instruction-level | 0.95 | 0.94 | **0.93** |
| Gemini 1.5 Pro | Prompt-level | 0.96 | 0.71 | 0.39 |
| Gemini 1.5 Pro | Instruction-level | 0.96 | 0.94 | 0.92 |

**Подпись к Figure 3 (дословно, из PDF):**
> «**Prompt-level Accuracy consistently shows a degrading trend as the number of instructions increases,
> while Instruction-level Accuracy remains relatively [stable].**»

**★ Table 3 — авторы САМИ проверили гипотезу независимости:**

| Оценщик | ManyIFEval n=5 | n=10 | Corr (r) |
|---|---|---|---|
| `Product (Each, n=1)` — независимость по **изолированным** p_i | 0.21 ± 0.07 | 0.34 ± 0.13 | 0.904 |
| **`Product (Each, n=n)`** — независимость по **in-context** p_i | **0.04 ± 0.03** | **0.02 ± 0.02** | **0.994** |
| Logistic (w/ n) | 0.04 | 0.02 | 0.993 |

**Разбор (мой вывод из их таблицы — помечаю как вывод, не как их формулировку):**
- Есть **реальная интерференция**: p_i падает с 0.94 (в одиночку) до 0.85 (в компании 9 других).
  Именно поэтому `Product(n=1)` промахивается на 0.21–0.34.
- Но **при условии** уже-просевшего in-context p_i совместный провал описывается **чистой независимостью**
  почти идеально (MAE 0.02, r=0.994).
- ⇒ Драматическое `0.94 → 0.21` — это **в основном `p^n`**, а не «модель сломалась от количества».

> **Decision-delta для нас.** Пугающие кривые MC7 меряют `P(все N правил соблюдены разом)`.
> **CLAUDE.md так не работает** — правила условные, за ход срабатывают единицы. Наша величина —
> `p(правило | сработал триггер)`, а она деградирует **мягко**.
> **Зеркальное следствие (важнее):** там, где у нас **правда конъюнкция** — `patch-cut` чеклист,
> 6-шаговый git-цикл, «журнал + CHANGELOG + count-sweep + verify в одном коммите» — работает `p^N`,
> и при p≈0.9 и N=6 это уже **~53 %**. **Это математическое обоснование 🔒-гейтов**
> (`process-gate.js`, `pre-commit`): детерминированный гейт превращает конъюнкцию вероятностей
> в проверяемый инвариант. Наша архитектура здесь **подтверждается литературой**, а не опровергается.

**★ Гетерогенность интерференции (§4.3, StyleMBPP):**
> «while both models can follow the "Characters per line" instruction with high success rates
> (**99 % for Gemini 1.5 Pro and 97 % for Claude 3.5**) when presented **in isolation**, their performance
> **drops dramatically to 20 % and 2 %** respectively when combined with **five other instructions**.»

Среднее per-instruction держится, потому что большинство правил «локальные». А **правила, задающие
ГЛОБАЛЬНУЮ ФОРМУ каждого вывода, раздавливаются конкуренцией.** Наши такие: `ITP: T0` первой строкой,
блок «Короткий ответ» в конце, «без эмодзи», «без двоеточия перед tool-call».

**★ Судья-инфлятор (Table 2) — методологическое предупреждение НАМ:**

| # инструкций | Rule-based (ground truth) | LLM-as-a-Judge (GPT-4o) |
|---|---|---|
| 5 | 0.574 | 0.815 |
| 10 | **0.213** | **0.657** |

> «LLM-as-a-Judge tends to **inflate** accuracy scores and makes it difficult to accurately measure
> performance degradation.»

**3.1× завышение при n=10.** Мы судим свои смоуки **opus-судьёй**. Наши «11 PASS / 2 PARTIAL» могли быть
завышены. Это прямая угроза валидности нашего же аудита.

---

## 4. RealGuardrails — «к нулю при 20» это конъюнктивный стресс-тест if-then правил (S2)

**Что реально измерено (из PDF, §1.1):**
- Реальные системные промпты из **GPT Store + HuggingChat** (3 082 после фильтрации);
  **«we found an average of 5.1 guardrails per prompt»**.
- **Monkey Island stress test**: берут реальный промпт текстовой adventure-игры и добавляют
  **переменное число if-then guardrail'ов** («выдай такой-то текст при таком-то условии»), каждый
  триггерится своим user-сообщением.
- **Метрика (Appendix B, дословно):** «Success is defined as **correctly responding to all G guardrails**
  within a conversation trajectory» — **конъюнкция по G**, n=100 прогонов на точку, G ∈ [1..20].

**Находка (дословно):**
> «even though models can follow a few guardrails reasonably well, the performance of recent LLMs
> **uniformly approaches zero** as the number of guardrails increases.»
> «**Adding too many guardrails to a system prompt seems to overwhelm the model's "working memory"**.»

**Что тут важно и чего run 1 не зафиксировал:**
1. Guardrail'ы — **if-then, условные**. Это структурно **ближе к нашей таблице триггеров**, чем keyword-вставки IFScale. Хорошая новость для релевантности.
2. Но «к нулю» — снова **конъюнктивная** метрика. При per-guardrail p≈0.85: `0.85^20 ≈ 3.9 %`. То есть
   «approaches zero» **арифметически ожидаемо** и **не доказывает** отдельного «коллапса от количества».
3. **Стресс-тест НАМЕРЕННО лёгкий:**
   > «This stress test does **not** involve conflicting instructions, adversarial inputs, tool-calling, or
   > long context windows, **all factors that further increase the difficulty**… Context windows, especially
   > in "agentic" settings where models are making many tool calls, can grow to dozens or even hundreds of
   > turns, which further increases the complexity.»
   ⇒ У нас **есть** и tool-calling, и длинный контекст, и конфликты (ITP vs «просто сделай»). Наша
   реальная сложность **выше** Monkey Island.
4. Reasoning-модели заметно устойчивее (o3-mini «substantially more robust», особенно на distractors и Monkey Island).

⚠ **Честно: точные pass-rate по точкам G=1/5/10/20 из текста НЕ извлекаются** (это график, Figure 2).
Я **не** привожу выдуманных чисел. Утверждать можно только качественную форму + дизайн.

---

## 5. Paradoxical Interference / SUSTAINSCORE — правила стоят задачи, даже когда соблюдены (S2–S3)

**Дизайн (чистая каузальная изоляция).** В инструкцию вставляют **само-очевидное** ограничение —
извлечённое из **собственного успешного ответа модели**, то есть уже выполненное. Ограничение **ничего
не запрещает**. Метрика `SUSTAINSCORE` = доля удержанной task-производительности.

**Результаты (Table 1; 26+ моделей; math / multi-hop QA / code):**
- **Claude-Sonnet-4-5**: IF 93.5 · Multi-Hop QA sustain **85.0** · **AVG sustain 91.4**
- модели 30B–70B удерживают **65–85 %**; в диапазоне 32B–72B — **64.9–82.3 %** в среднем
- **код — худший класс: «seven models retaining less than 60 % of their performance»**
  («constraints can **disrupt global logic** rather than just local phrasing»)
- GLM-Z1-32B на коде удерживает **38.2 %**

**★ Два контроля, которые закрывают альтернативные объяснения:**
1. **Длина** — перефразировали задачу до длины «задача+ограничение»:
   > «model performance on x_long shows only a **negligible drop**, suggesting that the significant
   > performance degradation … is attributable to the **interference of instruction following, not merely
   > from the instruction length**.»
   ⇒ **Это не токен-бюджет. Это само наличие правила.**
2. **Структура** — 3 альтернативных шаблона: constraint-first, «сначала реши задачу, ограничение вторым»,
   step-by-step:
   > «the performance degradation **persists across these structural variations. No single template
   > alleviates** the poor performance.»
   ⇒ **Переставить/объяснить приоритет — не лечит.** (Сходится с IHEval IPP, см. §6.)

**★ Кривая по числу ограничений (Figure 3; math, 1→16 keyword-ограничений, 8 моделей):**
> «models consistently demonstrate a near-perfect ability to adhere to the constraints (**averaging over
> 94 % satisfaction**), their SUSTAINSCORE … is significantly lower (**averaging 84 %**). This gap
> demonstrates that existing instruction-following benchmarks … **fail to capture the hidden cost of
> constraints**, treating format adherence as success even when **the core task logic is broken**.»
> «the SUSTAINSCORE curve exhibits a **sharp initial decline** … the **most informative degradation occurs
> within the first 5 constraints, after which the curve flattens**, and the score largely stabilizes.»

> **★ Двусторонний удар по нашему приору.**
> (а) Правила **не бесплатны, даже когда соблюдаются** → «модель же следует правилу» ≠ «правило ничего не стоит».
> (б) Но цена **платится на первых ~5** и дальше **плато** → **«подрезать CLAUDE.md с 80 до 60 правил»
> почти наверняка НЕ купит ничего измеримого.** Рычаг не в числе строк, а в **выносе правила из промпта**
> (гейт / хук / тул / субагент) либо в **отсутствии правил в данной сессии вообще**.

**⚠ ПРОТИВОРЕЧИЕ В ЛИТЕРАТУРЕ (не замазываю).** IFScale провёл свой **Core Task Performance Analysis**
и получил **обратное**: «Almost all models **maintain coherence** or only display a **slight dip**» при
росте плотности до 500; просели только o3/o4-mini (и авторы списывают это на нежелание o-серии
генерировать много токенов).
**Возможное примирение (гипотеза, не факт):** интерференция бьёт по **жёстким reasoning-задачам**
(math / code / multi-hop, объективная проверка), но не по **мягкой генерации** (связность отчёта,
LLM-судья). Если так — **наш профиль (код, архитектура, отладка) = худший класс.**
**Не разрешено. Держать как открытый спор.**

⚠ **Провенанс:** Paradox и AgentIF — **одна группа** (Qi, Peng, Tsinghua) ⇒ **не независимое подтверждение**.

---

## 6. IHEval (NAACL 2025, S1) — объявить приоритет НЕ помогает

- **3 538 примеров, 9 задач**, иерархия: system > user > conversation history > tool output.
- Классы: rule following (single/multi-turn), task execution (extraction/generation/classification),
  safety defense (hijack/extraction), tool use (intrinsic/injected).

**Aligned → Conflict:**

| Модель | Aligned | Conflict | Δ |
|---|---|---|---|
| GPT-4o | 91.0 | 70.0 | **−21.0** |
| Claude-3 Sonnet | 85.1 | 30.7 | **−54.4** |
| Qwen-2 72B (лучшая open-source) | 85.7 | 47.8 | −37.9 |

> «the most competitive open-source model **only achieves 48 % accuracy** in resolving such conflicts»

**★ Instruction Priority Prompt (IPP) — провал (Table 3):**
> «**surprisingly** … this additional prompt does **not bring noticeable improvements** to model performance.»
- GPT-4o: 70.0 → **67.2** (хуже)
- Mistral-Large: 29.4 → **28.3** (хуже)
- LLaMA-3.1-70B: 14.0 → 17.1 (маргинально)

Вывод авторов: «teaching LMs to follow the instruction hierarchy is **not a trivial task: Dedicated
training efforts are needed**.»

> **Для нас.** Мы **много раз** пытаемся чинить следование правилам **добавлением правила о правилах**:
> «🔒 = hard-enforced, остальное — дисциплина», «при сомнении — СТАРШИЙ тир», «ЗАПРЕЩЕНО опираться на…»,
> «Отсутствие маркера = задача тривиальна». **Три независимых источника** (IHEval S1 · Paradox structure-control ·
> AgentIF meta-constraints) говорят: **этот рычаг не работает.** Дописать мета-правило ≠ повысить соблюдение.

---

## 7. IFScale — самый цитируемый и самый НЕПЕРЕНОСИМЫЙ (S2, indirectness = large)

**Что это буквально.** Одна инструкция = **«Include the exact word {keyword}»**. Задача — написать
бизнес-отчёт. Словарь — 500 бизнес-терминов из SEC 10-K. Проверка — **регулярка** (case/style-insensitive
exact match; ≥80 %-префикс = modification error, отсутствие = omission error). Плотности **10→500 шаг 10**,
5 сидов, 20 моделей / 7 провайдеров.

**Числа:**
- **68 %** — лучшие frontier-модели при **500** инструкциях.
- **Колено:** топ-2 (gemini-2.5-pro, o3) — «maintaining **near-perfect performance through 150 or more
  instructions** before declining». Reasoning-модели держат near-perfect на **100–250**.
- Худшие модели «overwhelmed by even **a few dozen** instructions».
- **Три паттерна:** threshold decay (o3, gemini-2.5-pro) · linear (gpt-4.1, claude-sonnet-4) ·
  exponential (gpt-4o, llama-4-scout; пол ~7–15 %).
- **Ошибки:** под нагрузкой сдвиг к **omission** (llama-4-scout O:M ≈ 34.9:1; reasoning ~6–7:1).

**★ Primacy — контр-интуитивно и важно:**
> «Primacy effects … **start low at minimal instruction densities indicating almost no bias for earlier
> instructions**, **peak around 150–200** instructions, then level off or decrease at extreme densities…
> at extreme densities (300+) … most ratios converging toward **1.0–1.5**.»

⇒ **На нашей плотности (~80 правил) позиционного эффекта практически НЕТ.** Совет «положи важные правила
в начало CLAUDE.md» на этих данных **не обосновывается**. (Согласуется с уже принятым в корпусе запретом
тащить Lost-in-the-Middle на порядок правил.)

**Ограничения — слова авторов (дословно):**
> «We focus **exclusively on professional report generation with simple keyword-inclusion instructions**,
> which **may not generalize to other task types or domains, or more complex instruction types**.»

**★ РАЗМЕР РАЗРЫВА ПЕРЕНОСА (ответ на обязательный вопрос брифа).**

| | IFScale | AgentIF |
|---|---|---|
| что за «инструкция» | «включи слово X» | реальное агентное ограничение (условие/тул/формат) |
| длина промпта | список keyword'ов | **1 723 слова** |
| число ограничений | 10…500 | **11.9** |
| соблюдение (per-constraint) при ~10–50 | **~99–100 %** | — |
| соблюдение (per-constraint) при **11.9** | — | **58–60 %** |
| проверка | регулярка | code + LLM + hybrid |

**При СОПОСТАВИМОМ числе ограничений разрыв ≈ 40 п.п.** И авторская внутренняя сверка на тех же моделях:
`IFEval 87.0 → AgentIF 58.5`. ⇒ **«500 keyword-вставок ≠ 80 процессных правил» — не оговорка,
а фактор ~2 по доле соблюдения.** IFScale-колено «150» **нельзя** переносить на CLAUDE.md.

**⚠ И это уже произошло в дикой природе.** Поиск по сообществу возвращает: *«research on frontier models
suggests they reliably follow somewhere between **150 and 200 instructions** … Claude Code's system prompt
already contains roughly 50 … you have budget for about **100–150 more**»*, *«median well-performing
AGENTS.md ~**300–350 слов**, >1 000 слов — отрицательная корреляция»*, *«compliance **25–40 %** без
enforcement-слоя»*. **Ни у одного нет прослеживаемого первоисточника**; первое — узнаваемое ложное
перенесение кривой IFScale. **В аудит не брать.**

---

## 8. SEQUOR — мульти-тёрн накопление (S3, preprint)

50-тёрновые диалоги, ограничения из реальных lmsys-chat-1m. Пять режимов. **Худший — «Add»
(ограничения накапливаются): ~63 % средняя просадка**; лучшая модель (Gemini 3.1 Flash Lite) теряет **40 %**.
Большинство моделей **ниже 60 %** к 50-му ходу. Сброс/замена ограничений → частичное восстановление
(⇒ признак recency-вытеснения, а не «усталости»).

Наш режим — ровно «Add»: длинная сессия, контекст и правила накапливаются. **Но:** препринт, LLM-судья
(а мы только что видели, что судья **завышает**), только output-form ограничения. ⇒ **HYPOTHESIS.**

---

## 9. Контр-направление (обязательная проверка на self-serving bias)

Критик прав: run 1 искал **только словами деградации**. Я искал **словами выигрыша**
(«detailed system prompt IMPROVE agent success», «more guidance better», «ablation»). Что нашлось:

- **Ablation-исследования агентных фреймворков**: удаление системного промпта → **success rate 0 %**;
  удаление «detailed system instructions» и документов → существенная просадка.
- Но это ablation **task-constitutive** контекста (что делать, какие тулы, какие факты), **а не
  процессных правил**.

**⇒ Честный вывод, а не удобный.** Литература делит инструкции на **два класса** с **противоположным** знаком:

| Класс | Пример у нас | Знак |
|---|---|---|
| **Task-constitutive** (что делать, где что лежит, как устроен репо, какие тулы) | «Repository structure», «Hook конвенции», «git/gh нужен `dangerouslyDisableSandbox`», карта `docs/MAP.md` | **Убирать — ХУЖЕ.** Несущее. |
| **Constraint / process overhead** (как себя вести, ритуалы, формат) | ITP-маркер, «Короткий ответ», MDP-тиры, таблица триггеров, autoflow | **Каждое стоит** compliance-бюджета И task-точности (Paradox) |

Нарратив «меньше контекста → лучше» **над-обобщён**: он верен для второго класса и **неверен** для первого.
Это и есть искомая ошибка словаря запросов run 1.

---

## 10. Что кладём в CLAUDE.md (RULE) и что тестируем сами (HYPOTHESIS)

### RULE

**R1. Длинный конъюнктивный ритуал нельзя держать на промпте — только на гейте.**
При p≈0.9 и 6 обязательных шагах `P(все) ≈ 53 %`. Основание: ManyIFEval Table 3
(независимость предсказывает совместный провал с MAE 0.02, r=0.994) + RealGuardrails (конъюнктивный
Monkey Island → к нулю) + арифметика. **Наши 🔒-гейты — это не бюрократия, а математически необходимый
механизм.** Расширять гейты, а не увещевания. *(2 источника + вывод из их же данных.)*

**R2. Мета-правило «соблюдай правила / приоритезируй правильно» — не работает. Не добавлять.**
IHEval (S1, NAACL): IPP **ухудшает** (70.0→67.2). Paradox: ни один из 3 шаблонов не помогает. AgentIF (S1):
constraint-selection — худший класс мета-ограничений. *(3 источника, 2 независимые группы.)*

**R3. Условные («если X — то Y») и tool-правила — самый слабо соблюдаемый класс: ждать ~43 % и ~27 %.**
AgentIF (S1 Spotlight, бенчмарк + код + реальные промпты Cursor/Manus). Наша таблица «Process triggers»
целиком в этом классе. *(Один сильный S1 с бенчмарком — квалифицируется.)*

**R4. Не переносить IFScale-колено (~150 инструкций) на процессные правила.**
Разрыв измерен: `IFEval 87.0 → AgentIF 58.5` на тех же моделях; при сопоставимом числе ограничений
~40 п.п. Народное «у тебя бюджет 100–150 инструкций» — блог-тир и ложный перенос. *(Методологический RULE.)*

**R5. Не судить соблюдение правил LLM-судьёй без rule-based проверки.**
ManyIFEval Table 2: судья GPT-4o даёт **0.657** там, где rule-based — **0.213** (3.1× инфляция).
Наши смоук-вердикты opus-судьёй подлежат пересмотру. *(Один сильный peer-reviewed источник + прямая угроза
валидности нашего аудита.)*

### HYPOTHESIS (нужен свой тест)

**H1. Сокращение CLAUDE.md с ~80 до ~60 правил не даст измеримого эффекта; эффект даёт только вынос
правил из промпта.** Основание: Paradox — плато после первых ~5 ограничений.
**Тест:** A/B на нашем же пилоте — три плеча (полный CLAUDE.md / урезанный на 25 % / правила вынесены в
гейты+скиллы), одинаковый набор задач, **rule-based** проверка соблюдения (не судья).

**H2. Наши «глобально-формные» правила (ITP-маркер первой строкой, «Короткий ответ», без эмодзи,
без двоеточия перед tool-call) — самый деградирующий класс.** Основание: ManyIFEval — «characters per
line» 99 % → 20 % в компании пяти других.
**Тест:** прогреметь свои транскрипты регуляркой: доля ходов с корректным `ITP:`-маркером vs длина сессии
и число сработавших триггеров. Полностью автоматизируемо, данные у нас уже есть.

**H3. Интерференция правил бьёт по коду сильнее, чем по тексту** (Paradox: 7 моделей <60 % на коде;
IFScale не видит просадки на мягкой генерации). **Тест:** сравнить долю верных решений на код-задачах
с включённым/выключенным процессным блоком CLAUDE.md.

**H4. Мульти-тёрн накопление вредит соблюдению сильнее, чем размер файла.** SEQUOR (S3).
**Тест:** соблюдение правил как функция номера хода в наших длинных сессиях.

---

## 11. Честные пределы этого чтения

1. **Никто не мерил CLAUDE.md-класс напрямую.** Ближайшее — AgentIF, но там системный промпт **задачи**
   агента, а не **кросс-сессионные процессные правила разработчика**. Перенос **small, но не zero**.
2. **Мы вне измеренного диапазона.** RealGuardrails: реальные промпты — **5.1** guardrail'а в среднем.
   AgentIF: **11.9**. У нас — **~80** процессных правил и **5 340 слов** always-on. Ни один бенчмарк
   не мерил такую плотность на реалистичных правилах. **Всё, что мы говорим про 80 правил, —
   экстраполяция.** Честно: **колена для нашей плотности на реалистичных правилах в литературе НЕТ.**
3. **Точные pass-rate Monkey Island (G=1..20) не извлекаемы** — только график. Чисел не выдумывал.
4. **AgentIF и Paradox — одна группа** ⇒ не независимое подтверждение друг друга.
5. **Прямое противоречие не разрешено:** IFScale (core task сохраняется при 500 инструкциях) vs
   Paradox (задача проседает от 1 само-очевидного ограничения). Примирение «жёсткие vs мягкие задачи» —
   **моя гипотеза**, не установленный факт.
6. **Кривая «CSR vs длина» у AgentIF — из графика**, численно не извлечена; жёсткий порог «6 000 слов»
   я **не** подтверждаю (ISR≈0 там арифметически ожидаем).
7. **Направление выигрыша исследовано слабее**, чем направление деградации — и в литературе, и мной:
   качественных ablation-работ именно по **процессным** правилам (а не по task-контексту) я **не нашёл**.
   Это остаётся дырой. Не дотягиваю.
8. ManyIFEval per-model числа взяты из Figure 3 через два независимых WebFetch-прохода (сошлись), но
   **не** из машинно-читаемой таблицы — возможна погрешность ±0.01–0.02.

---

## Источники (первичные)

- **AgentIF** — arXiv [2505.16944](https://arxiv.org/abs/2505.16944) · HTML v1 · PDF (извлечён) ·
  NeurIPS 2025 D&B **Spotlight** · [THU-KEG/AgentIF](https://github.com/THU-KEG/AgentIF)
- **IHEval** — arXiv [2502.08745](https://arxiv.org/abs/2502.08745) ·
  [ACL Anthology 2025.naacl-long.425](https://aclanthology.org/2025.naacl-long.425/) · NAACL 2025
- **ManyIFEval / When Instructions Multiply** — arXiv [2509.21051](https://arxiv.org/abs/2509.21051) ·
  [ACL Anthology 2025.findings-emnlp.896](https://aclanthology.org/2025.findings-emnlp.896/) · Findings EMNLP 2025
- **RealGuardrails / SystemCheck** — arXiv [2502.12197](https://arxiv.org/abs/2502.12197) (PDF извлечён) ·
  [normster/SystemCheck](https://github.com/normster/SystemCheck) · [HF dataset](https://huggingface.co/datasets/normster/RealGuardrails)
- **IFScale** — arXiv [2507.11538](https://arxiv.org/abs/2507.11538) (HTML + PDF) · [distylai.github.io/IFScale](https://distylai.github.io/IFScale/)
- **Paradoxical Interference / SUSTAINSCORE** — arXiv [2601.22047](https://arxiv.org/abs/2601.22047) (PDF извлечён)
- **SEQUOR** — arXiv [2605.06353](https://arxiv.org/html/2605.06353v1)
- **SysBench** — arXiv [2408.10943](https://arxiv.org/abs/2408.10943) (фон: CSR/ISR/SSR, мульти-тёрн просадка)
