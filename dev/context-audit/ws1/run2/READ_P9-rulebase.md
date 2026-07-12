# READ P9 — CLAUDE.md как база продукционных правил: формальная таксономия аномалий и автоматический чек-лист

> **Прогон 2, глубокое чтение первоисточников.** Приоритет: P9-rulebase.
> Дата: 2026-07-12. Все числа — с точной ссылкой и условиями.

---

## 0. Честная граница (читать первой)

**Эта линия НЕ даёт ни одного эффекта на LLM.** Preece/Shinghal верифицируют *базы правил
экспертных систем* (Horn-клаузы, детерминированный inference engine, 105–550 правил). Наш
артефакт — natural-language политика, исполняемая трансформером. Перенос «аномалия в KB →
такое-то поведение LLM» **невыводим** из этой литературы и я его не делаю.

Что эта линия даёт:
1. **Формальную таксономию** дефектов рулбейса (4 типа, 8 подтипов, определения в FOL);
2. **Алгоритмы детекции** с классами сложности (O(n) / O(n²) / экспоненциальный);
3. **Эмпирические приоры «какая проверка чего стоит»** — precision по типам аномалий на 5
   реальных KB и стоимость анализа выхлопа (единственные числа, которые честно переносятся —
   как *приор для дизайна гейта*, не как предсказание поведения);
4. **Понятие conflict-resolution strategy** — и вопрос «а какая она у нашего движка?».

Пункт 4 оказался мостом: на вопрос «есть ли у LLM refraction/recency/specificity» **есть
свежая эмпирика** (Control Illusion AAAI-2026, ConInstruct AAAI-2026, WIRE-препринт 2026-05).
Она принадлежит другой линии (instruction-conflict), но отвечает ровно на тот вопрос, который
поднимает rulebase-фрейм, и в ней **эффекты есть**. Я её вношу отдельно и с честной пометкой.

---

## 1. Что прочитано (и как добыто)

| Источник | Статус | Как добыт |
|---|---|---|
| **Preece A.D., Shinghal R. «Foundation and Application of Knowledge Base Verification», Int. J. of Intelligent Systems 9(8):683–702, 1994** | ✅ полный текст (авторский препринт, 26 стр., включая приложение с примерами) | Wiley платный → авторский PDF `ijis1994.pdf` с личной страницы (Cardiff, мёртвая) через Wayback: `web.archive.org/web/20210928140253if_/https://users.cs.cf.ac.uk/A.D.Preece/publications/download/ijis1994.pdf` |
| **Preece A., Talbot S., Vignollet L. «Evaluation of Verification Tools for KBS», IJHCS 47:629–658, 1997** | ✅ полный текст | тот же Wayback-путь, `ijhcs1997.pdf` |
| **Preece A., Lamb N. «Verifying Multi-Agent KBS using COVERAGE», AAAI-97 WS-97-01** | ✅ полный текст | `cdn.aaai.org/Workshops/1997/WS-97-01/WS97-01-001.pdf` |
| **Preece A. «Building the Right System Right», KAW-98 / AAAI-98 WS-98-11** | ✅ HTML | `ksi.cpsc.ucalgary.ca/KAW/KAW98/preece/` |
| **Forgy C.L. «OPS5 User's Manual», CMU-CS-81-135, 1981** — §6.1 Conflict Resolution | ✅ полный текст | DTIC ADA106558 через Wayback (прямой DTIC отдавал 429) |
| **McDermott J., Forgy C. «Production System Conflict Resolution Strategies», 1976/1978** | ✅ полный текст (скан, OCR посредственный) | DTIC ADA037771 через Wayback |
| Preece, Shinghal, Batarekh, ESWA 5(3/4):421–436, 1992 (**детали алгоритмов COVER**) | ❌ **НЕ добыт** (ScienceDirect, closed; openAccessPdf=CLOSED по Semantic Scholar) | алгоритмы реконструированы по IJIS-1994, которая их резюмирует, + COVERAGE-97 |
| Preece, Shinghal, Batarekh, KER 7(2):115–141, 1992 (обзор) | ❌ НЕ добыт (Cambridge, платный) | — |
| **Geng et al. «Control Illusion: The Failure of Instruction Hierarchies in LLMs», AAAI-2026 (arXiv 2502.15851)** | ✅ abs + HTML v1 (таблицы) | arxiv.org |
| **He et al. «ConInstruct: Evaluating LLMs on Conflict Detection and Resolution in Instructions», AAAI-2026 (arXiv 2511.14342)** | ✅ abs + HTML v2 | arxiv.org |
| **Yan, Chen, Zhang «Diagnosing Live Within-Policy Instruction Conflicts in LLM Agents with Witnessed Resolution Profiles» (arXiv 2605.27784, 2026-05-27)** | ✅ abs | arxiv.org |

Дыра ESWA-1992 **не критична**: формальные определения аномалий и анализ сложности содержатся
именно в IJIS-1994 (она и есть «foundation»-статья); ESWA-1992 — про реализацию COVER.

---

## 2. Формальная таксономия аномалий (Preece & Shinghal 1994, §«Anomalies in the KB»)

### 2.1. Пять принципов, на которых всё стоит (§«Verification Principles»)

Дословно (перевод мой, оригинал в кавычках по ключевым местам):

1. Синтаксис И семантика аномалии определяются **в терминах языка представления** KB.
2. Аномалии определяются через **декларативный** смысл KB, не процедурный. Следствие: иногда
   надо *отделить процедурное (task) знание от декларативного (domain)*, и лучше верифицировать
   **концептуальную модель**, а не имплементацию.
3. Аномалии **детектируются синтаксически**, хотя понимаются семантически.
4. Проверяется **только KB**; свойства инференс-движка *предполагаются, но не верифицируются*.
   «…необходимо специфицировать те свойства движка, от которых зависит корректность результатов
   anomaly detection (примеры: правила вывода, обработка неопределённости, **conflict resolution**)».
5. **«Anomalies are not errors: they are symptoms of probable errors in a KB.»**
   Некоторые аномалии вообще не ошибки — напр. циклическая цепочка в KB, если движок гасит петли.

> **Принцип 5 — главный для нас.** Любой чек-лист по CLAUDE.md выдаёт *симптомы*, а не дефекты.
> Гейт должен это уважать: блокировать только там, где precision высокий (см. §4).
> **Принцип 4 — второй по важности:** он явно называет conflict resolution как *свойство движка,
> которое надо задекларировать*. У нас движок — LLM, и его conflict resolution — эмпирически
> ненадёжен (§6).

### 2.2. Форма KB

`K = R ∪ D`, где `R` — рулбейс (Horn-клаузы `L1 ∧ … ∧ Lm → M`), `D = G ∪ L ∪ C`:
- **G** — goal literals (всё, что KB может выдать наружу);
- **L** — input literals (всё, что может прийти на вход);
- **C** — **semantic constraints**: множество `{L1 … Ln}` означает, что `L1 ∧ … ∧ Ln` —
  несовместимость (пример из статьи: `{male(x), pregnant(x)}`).
- **Environment E** — подмножество входных литералов, **не** нарушающее ни одного ограничения из C.
- **Inferrable hypothesis**: `infer(H, R, E) ⟺ (R ∪ E) ⊢ H`.
- **Firable rule**: `firable(R, R, E) ⟺ ∃σ (R ∪ E) ⊢ antec(R)σ`.

> **C — самая дорогая часть.** IJHCS-1997 прямо: главная статья затрат consistency-checking —
> «**acquisition of the consistency validation knowledge**» (и в их эксперименте эксперты уже не
> помнили деталей, пришлось брать эталонную версию как оракул).

### 2.3. Четыре типа и их подтипы (дерево из Figure 1)

```
Anomaly
├── Redundancy
│   ├── Unfirable rule ── Unsatisfiable condition
│   ├── Subsumed rule  ── Duplicate rules
│   └── Unusable consequent
├── Ambivalence ── Contradictory (ambivalent) rules
├── Circularity
└── Deficiency ── Unused input   (+ Missing rule = самый общий случай)
```

**Определения (FOL, дословно из §Anomaly Definitions):**

| Подтип | Определение | Формально |
|---|---|---|
| **Redundancy: unsatisfiable condition** | литерал в антецеденте не унифицируется **ни** с входным литералом, **ни** с консеквентом другого правила | `∃L∈antec(R) ¬((∃I∈L)(Lσ=Iσ) ∨ (∃R'∈R\{R})(Lσ ∈ conseq(R')σ))` |
| **Redundancy: unusable consequent** | консеквент правила не унифицируется **ни** с goal-литералом, **ни** с антецедентом другого правила | `∀G∈G ¬((conseq(R)σ=Gσ) ∨ (∃R'∈R\{R})(conseq(R)σ ∈ antec(R')σ))` |
| **Redundancy: subsumed rule / duplicate** | `R` избыточно, если другое `R'` его субсюмирует: `R → R'σ`; дубликаты — если субсюмция в обе стороны | — |
| **Redundancy: redundant rule** (общий случай) | для **любого** окружения множество выводимых гипотез одинаково с `R` и без `R` | `∀E∈E: {H \| infer(H,R,E)} = {H \| infer(H, R\{R}, E)}` |
| ↳ unfirable rule | частный случай: `¬∃E∈E firable(R,R,E)` | — |
| **Ambivalence: ambivalent rule pair** | антецедент `R'` субсюмирует антецедент `R`, а их консеквенты **вместе образуют semantic constraint** | `∃σ ((antec(R)→antec(R')σ) ∧ ({conseq(R), conseq(R')σ} ∈ C))` |
| **Ambivalence: ambivalent rules** (общий) | существует окружение, из которого выводимы **все** литералы какого-то semantic constraint | `∃C∈C, E∈E: ∀L∈Cσ infer(L,R,E)` |
| **Circularity: circular dependency** | гипотеза `H` унифицируется с консеквентом правила `R`, которое firable **только** если `H` подан на вход | `∃R,E,H: H=conseq(R)σ ∧ ¬firable(R,R,E) ∧ firable(R,R,E∪{H})` |
| **Deficiency: unused input** | литерал объявлен входом, но не является goal и не встречается ни в одном антецеденте | `∃I∈L ¬((I∈G) ∨ (∃R∈R)(Iσ ∈ antec(R)σ))` |
| **Deficiency: missing rule** (общий) | существует валидное окружение, из которого KB **не выдаёт ничего** | `∃E∈E: {G \| infer(G,R,E)} = ∅` |

**Ключевое, что часто путают:** «ambivalence» ≠ «два правила противоречат по тексту».
Ambivalence **определена только относительно C** — множества объявленных семантических
несовместимостей. Без C противоречий формально не существует. Это ровно то, почему §7
(операционализация) начинается с написания C, а не с «попроси LLM найти противоречия».

---

## 3. Как это детектируется автоматически (§Anomaly Detection Procedures)

Preece группирует аномалии **по классу сложности алгоритма** — это второе (ортогональное)
измерение таксономии, и именно оно даёт дизайн чек-листа.

| Класс проверки | Ловит | Сложность | Примечание автора |
|---|---|---|---|
| **Integrity check** | unsatisfiable condition, unusable consequent, unused input | **O(n)** по числу правил — обход KB как ориентированного графа + кэш-таблицы (inputs / goals / hypotheses) | COVER заодно ловит **circularity** в это же время: «the circularity check has little effect on performance» (цепочки короткие) |
| **Rule check** | redundant rule pair, ambivalent rule pair | **O(n²)** — попарное сравнение правил | На практике **дешевле** теории: основная цена — сравнение антецедентов только у пар с эквивалентными/противоречивыми консеквентами |
| **Rule extension check** | redundant rule (общий), ambivalent rules (общий), circular dependency, **missing rule** | **b^d** (b = средняя ширина антецедента, d = средняя глубина цепочки) — нужно построить *extension* KB = прогнать все возможные цепочки | Худший случай интрактабелен, **но**: «in no instance did the complexity approach the worst case… inference chains in the sample KBs are short» |

**Missing rule детектируется generate-and-test** (Appendix): COVER генерирует комбинации
data items × values и проверяет, покрыты ли они правилами; непокрытые репортит как
`IF <условия> THEN ???`. Чтобы не взорваться комбинаторно, COVER использует эвристику
**relevant data items** — генерирует комбинации только тех айтемов, которые уже встречаются
вместе в правилах/цепочках.

**Замеры времени (Sun 4/300, 1994; Table 2):** integrity < 1–35 сек; rule check 14–111 сек;
extension check 328 сек – 3.5 часа (DMS1, 550 правил, breadth/depth 5/2). Т.е. **линейные
проверки — бесплатны, экстеншн — единственная дорогая.**

---

## 4. Эмпирика: precision по типам аномалий (Table 3) — САМОЕ ЦЕННОЕ ЧИСЛО

Условия: **5 реальных KBS**, все «completed» — протестированы другими методами и **уже сданы
пользователям**; 3 из 5 в промышленной эксплуатации. Размер 105–550 правил + 55–510 деклараций.
Домены: диагностика отказов (NASA MMU-FDIR, Bell Canada DMS1), подбор продукта (3M TAPES),
неврологическая диагностика (NEURON), планирование в здравоохранении (UK NHS DISPLAN).

Формат ячейки: `аномалий / из них выявивших ≥1 реальную ошибку`.

| Тип | MMU-FDIR (105) | TAPES (150) | NEURON (190) | DISPLAN (350) | DMS1 (550) | **ИТОГО** | **precision** |
|---|---|---|---|---|---|---|---|
| unsatisfiable condition | 0 | 0 | 15/15 | 14/14 | 2/2 | 31/31 | **100%** |
| unusable consequent | 5/5 | 0 | 0 | 4/4 | 0 | 9/9 | **100%** |
| redundant rule pair | 0 | 5/5 | 0 | 9/4 | 59/5 | 73/14 | 19% |
| **Redundancy (общий)** | 10/10 | 5/5 | 21/21 | 45/40 | 61/7 | **142/83** | **58%** |
| ambivalent rule pair | 0 | 4/4 | 0 | 1/1 | 0 | 5/5 | 100% |
| **Ambivalence (общий)** | 0 | 4/4 | 0 | 4/4 | 10/10 | **18/18** | **100%** |
| **Circularity** | 0 | 0 | 0 | 24/20 | 0 | **24/20** | **83%** |
| unused input | 0 | 0 | 0 | 28/8 | 0 | 28/8 | 29% |
| **Deficiency (общий, missing rule)** | 0 | 16/16 | 0 | 59/17 | 17/0 | **92/33** | **36%** |
| **ВСЕГО (4 верхних типа)** | | | | | | **276/154** | **56%** |

(Общие типы **включают** свои частные случаи — так сказано в статье; поэтому сумма четырёх
верхних строк не двойным счётом.)

**Три типа с худшим signal-to-noise (авторская формулировка, дословно «lowest signal-to-noise ratio»):**
1. **Subsumed rule pairs**, когда conflict-resolution движка (специфичность) и так выберет более
   специфичное правило → субсюмция **не ошибка**. (DMS1: 59 пар → 5 ошибок = 8%.)
2. **Circularity**, намеренно смоделированная разработчиком (looped reasoning).
3. **Deficiency**, где «missing» кейсы = ситуации «ничего не делать», намеренно не внесённые.
   (DMS1: 17 missing-rule → **0** ошибок.)

**Вывод авторов:** «the most useful types of anomaly are those detected by the **integrity check**»
— по совокупности (много находок × высокая вероятность реальной ошибки × дёшево детектировать).

> ⚠️ Ограничение, которое пишут сами авторы: 5 систем — **не статистически значимая и даже не
> «truly representative» выборка**. Переносить абсолютные проценты нельзя; переносится
> **порядок**: ambivalence ≫ circularity > redundancy ≫ deficiency по доле реальных ошибок.

---

## 5. Стоимость и комплементарность (Preece, Talbot, Vignollet, IJHCS 1997)

Контролируемый эксперимент с **посеянными дефектами**: KBS GIBUS (диагностика батарей спутника,
ESA; 47 anomaly-detection + 35 aberration + 64 diagnostic rules), 3 независимо созданные
«битые» версии, **≈25 посеянных дефектов каждая**, 8 классов дефектов (editing, object,
attribute reference, attribute value, numerical, premise, conclusion, rule deletion).
Три инструмента прогонялись **независимо** друг от друга: SACCO (consistency/anomaly checker),
completeness checker, SYCOJET (генерация тест-кейсов + прогон = динамическое тестирование).

**Детекция:**
- объединение трёх методов: **> 61%** посеянных дефектов найдено (и предложена коррекция);
- **SACCO (статический anomaly checker): всегда > 35%**;
- SYCOJET (тестирование): **≥ 31%** (при rule coverage до 46%);
- completeness checker: **> 27%**; **уникально хорош на rule deletion** (в 2 версиях из 3 — 100%);
- 31–32% дефектов найдены ≥2 методами → **методы комплементарны**;
- «not using SACCO would have left **12%** of faults not discovered»; тестирование в одиночку
  дало 16%;
- **никто не поймал**: numerical faults; premise duplication/adjustment.

**Стоимость анализа выхлопа (человеко-время, на одну версию):**

| Метод | Анализ результата | Прочее |
|---|---|---|
| **Consistency (SACCO)** | **≈ 2 часа** — «the analysis … is very easy to do: the tool indicates clearly where the anomalies are … and what their nature is» | главная скрытая цена — **однократная** acquisition of consistency knowledge (= множество C) |
| Completeness | ≈ 4 часа (пол-дня) | «anomalies … are far away from the faults which explain them» |
| **Testing (SYCOJET)** | **≈ 2 дня** (1 день найти failures + 1 день найти primary failures и причины) | + генерация: 19.5 ч на labels + до 17.5 ч на набор тестов (железо 1990-х) |

> **Прямой ответ на наш вопрос «мы же и так гоняем смоук-тесты, зачем ещё статический линт»:**
> статическая проверка на аномалии — **самый дешёвый слой** (в ~8 раз дешевле по анализу, чем
> тестирование), находит **сопоставимую долю** дефектов (>35% против ≥31%) и **12% дефектов
> находит только она**. Это ортогональный слой, а не дублирующий.

---

## 6. Conflict resolution: чем движок «разруливает» одновременно применимые правила

### 6.1. Каноника (Forgy, OPS5 User's Manual, CMU-CS-81-135, §6.1)

Конфликтное множество = все инстанциации правил, чьи LHS удовлетворены. Стратегия = набор
правил упорядочивания. OPS5 даёт **LEX** и **MEA**; обе достигают трёх вещей (дословно):

- «Both strategies **prevent instantiations from executing more than once**» — это **refraction**
  (у McDermott & Forgy 1976 класс называется *distinctiveness*: «whether an instantiation is
  distinct from previously executed instantiations»). Мотив: ранние продукционные системы
  «were subject to **trivial loops**».
- «They make production systems **attend to the most recent data** in working memory» —
  **recency**. Мотив: «once the system begins a subtask it is unlikely to be **distracted** by
  anything left over from earlier tasks».
- «They give **preference to productions with more specific LHSs**… more likely to be appropriate
  for those cases in which they are satisfied» — **specificity** (счёт числа тестов в LHS:
  «The LHSs that require more tests dominate»).

Порядок применения (LEX): (1) отбросить уже сработавшие; (2) recency; (3) specificity;
(4) **arbitrary** (произвольный выбор). MEA = LEX + отдельный приоритет на recency первого
condition element (чтобы система «cannot be distracted from its current task»).

**Критерии оценки стратегий (McDermott & Forgy 1976, §II):** **sensitivity** (система должна
реагировать на изменения среды) vs **stability** (сохранять непрерывность/фокус поведения).
«The function of conflict resolution is to provide a mechanism that can preserve sensitivity and
stability without sacrificing [each other]». Дизайнер обязан **распределить ответственность за
stability между движком и самой системой** — «he cannot put all of it in the [system] without
losing the potential for sensitivity».

### 6.2. Урок Preece, который бьёт прямо в наш CLAUDE.md (Appendix, «Subsumed Rule»)

Bell Canada DMS1: два правила (321 и 322), 322 субсюмируется 321. COVER репортит субсюмцию.
**Ошибки нет**, потому что оболочка Level 5 выбирает правила **в порядке появления**, а автор
записал правила в порядке убывания специфичности. Дословно:

> «COVER, however, **had no access to this assumption (it was not stated anywhere in the rule base)**…
> Although no error results from these subsumed rules, it can be argued that such implied
> dependencies between rules make understanding and maintaining the system unnecessarily difficult.
> The problem is that **knowledge which could have been explicitly stated in the rule antecedents
> has instead been 'hidden' in the ordering of the rules**.»

**Перенос на нас (это ДИЗАЙН-правило, не эффект):** любое место в CLAUDE.md, где приоритет
правила держится на *порядке следования* / *месте в файле* / «ну это же более специфичное» —
это знание, **спрятанное в порядке**. Верификатор его не видит; человек-мейнтейнер не видит;
и — в отличие от Level 5 — **у нашего движка нет гарантии, что он его реализует** (§6.3).
Лечится ровно как советует Preece: **вписать условие в антецедент правила** (в DMS1 —
добавить `AND NOT <4-е условие>`), т.е. сделать правила взаимно-исключающими по построению,
либо объявить precedence **текстом**.

### 6.3. А есть ли conflict resolution у нашего «движка»? (эмпирика, другая линия)

**Control Illusion** (Geng et al., AAAI-2026; arXiv 2502.15851). Сетап: 6 моделей
(qwen2.5-7b-instruct, Llama-3.1-8B, Llama-3.1-70B, claude-3-5-sonnet-20241022, gpt-4o-mini,
gpt-4o-2024-11-20), 6 пар **взаимоисключающих, программно-проверяемых** ограничений
(язык EN/FR, регистр, длина <50 vs ≥300 слов, число предложений, включить/исключить ключевые
слова, частота слова), 100 задач × 12 конфигураций = **1200 тест-точек**. Метрика: доля
случаев, когда модель подчинилась **инструкции, назначенной приоритетной**.

| Модель | IF baseline (без конфликта) | Pure (system vs user) | Task | Emphasized |
|---|---|---|---|---|
| Qwen-7B | 86.4% | **10.1%** | 9.1% | 11.8% |
| Llama-8B | 80.3% | **6.8%** | 6.6% | 10.8% |
| Llama-70B | 89.9% | 14.2% | 4.9% | 31.7% |
| Claude-3.5-Sonnet | 84.2% | 20.3% | 14.5% | 32.6% |
| GPT-4o-mini | 85.4% | 42.7% | 54.2% | 49.4% |
| GPT-4o | 90.8% | 47.0% | 31.3% | **63.8%** |

Плюс: «**Guidance placement (system or user message) has minimal impact** compared to the effect
of constraint **marking**» (Llama-8B: 6.8% pure → **52.4%** при user+marked). И:
«Models **rarely acknowledge** instruction conflicts, with **ECAR** (explicit conflict
acknowledgement rate) **from 0% (Qwen) to 20.3% (Llama-70B)**». Файн-тюн на конфликтах помогает
непоследовательно.

**ConInstruct** (He et al., AAAI-2026; arXiv 2511.14342). 9 типов конфликтов внутри инструкции
(intra-constraint: content/keyword/phrase/length/format/style; inter: keyword-phrase,
phrase-content, phrase-style), 864 инструкции с одиночным конфликтом + подмножества с 2–6.
**Детекция конфликта (F1): DeepSeek-R1 91.5%, Claude-4.5-Sonnet 87.3%, Claude-3.5-Sonnet 86.6%,
GPT-4o 84.9%.** Но **поведение**: доля ответов, где модель *уведомила пользователя* о конфликте —
Claude-4.5-Sonnet ≈45% (36% просит уточнение + 9% решает сама и говорит об этом),
Claude-3.5-Sonnet ≈32%, **GPT-4o ≈3%, DeepSeek-R1 ≈0%**. Вывод авторов: «despite strong detection
abilities, LLMs **rarely explicitly notify users** about conflicts».

**WIRE** (Yan, Chen, Zhang; arXiv 2605.27784, 2026-05-27) — **прямой прецедент того самого
инструмента, который просит наш бриф**: из natural-language prompt-политик извлекаются
source-grounded правила → кодируются в PyRule-клаузы → **SAT-проверка** оставляет
«same-surface hard-collision candidates» (пары правил, способные одновременно управлять одним
состоянием — это буквально *ambivalent rule pair* Preece) → строятся конкретные
**co-governance witnesses** → выход модели судится против исходного текста правил.
На **6 публичных prompt-политиках**: 276 правил, 560 атомарных клауз, **1402 witness-сценария,
13 335 испытаний, joint compliance = 35.4%** (64.6% нарушают ≥1 из управляющих правил).
Авторы сами оговаривают: это **условная диагностика** (при условии, что оба правила применимы),
**не** оценка частоты в проде.

> **Синтез §6:** у LLM-«движка» **нет надёжной conflict-resolution strategy**. Нет refraction
> (правило может «сработать» дважды или ноль раз), recency работает как позиционный байас, а не
> как гарантия, specificity не гарантирована вовсе, и **system-vs-user разделение не создаёт
> приоритета** (Control Illusion). Значит: **любая ambivalence в CLAUDE.md разрешается тихо и
> моделезависимо.** Это не «эффект из линии Preece» — это эффект из линии instruction-conflict,
> но он ровно про наш артефакт (indirectness = small/none).

---

## 7. ОПЕРАЦИОНАЛИЗАЦИЯ: как прогнать наш CLAUDE.md на 4 аномалии

### Шаг 0. Собрать «KB» из трёх файлов + инжекций

Область (то, что реально в контексте агента каждой сессии):
- `C:/Users/pw201/.claude/CLAUDE.md` (глобальный, 112 строк) — ITP, Recovery, MDP, формат ответа;
- `<repo>/CLAUDE.md` (проектный, 282 строки) — Process triggers, Autoflow, 6 принципов, конвенции;
- `<repo>/templates/project/CLAUDE.md.template` (251 строка) — потребительский шаблон;
- **инжекции**: `MEMORY.md`-индекс (48 файлов памяти), SessionStart-хук `rails-session-start.js`
  → `RAILS.md`, PostToolUse warn-хуки.

### Шаг 1. Написать декларации `D = G ∪ L ∪ C` (это и есть вся работа; ~полдня, однократно)

Без `C` **ambivalence формально не существует** — детектор нечего искать. Предлагаемый вид
(`dev/context-audit/rulebase/declarations.yaml`):

```yaml
inputs:            # L — что харнесс может наблюдать (наблюдаемые предикаты)
  task.trivial:        [true, false]
  task.p:              [lt_0.6, 0.6_0.85, gte_0.85]   # дискретизация ITP
  task.B:              [le_2, ge_3]
  task.R:              [cheap_reversible, expensive_irreversible]
  commit.type:         [feat, fix, docs, refactor, chore, test, perf, build, ci, revert]
  commit.zone:         [consumer, dev, none]
  session.phase_edge:  [pre_phase, post_phase, none]
  delegation.axes:     [S, D, R, C, J]                # MDP
  user.suppression:    ["просто сделай", "локально только", "не пушь", none]
goals:             # G — что правила могут ПОТРЕБОВАТЬ (действия/обязательства)
  - ask_user_first
  - proceed_silently
  - emit_itp_marker
  - write_dev_journal
  - write_changelog
  - run_checklist(<name>)
  - delegate(tier)
  - git_commit / git_push / open_pr
  - merge_to_main
  - memory_sync
constraints:       # C — семантические несовместимости (ЯДРО. Без него детектора нет)
  - [ask_user_first, proceed_silently]                # нельзя одновременно
  - [merge_to_main.by_agent, merge_to_main.owner_only]
  - [delegate(sonnet), delegate(opus)]                # для одной и той же задачи
  - [gate.strict, gate.warn]                          # для одного и того же гейта
  - [git_push, user.suppression == "локально только"]
```

### Шаг 2. Извлечь правила (NL → клаузы) с якорями на источник

Формат: `{id, file, line, IF: [conditions], THEN: goal, strength: hard|soft, source_text}`.
Извлекать **LLM-ом** (по ConInstruct, детекция/разбор конфликтов у топ-моделей F1 ≈ 87–91%),
**но обязательно с якорем `file:line`** и ручной приёмкой — принцип 5 Preece: инструмент даёт
симптомы, вердикт за человеком. Прецедент пайплайна — WIRE (rules → PyRule → SAT).

### Шаг 3. Четыре проверки (в порядке возрастания цены)

| # | Проверка | Класс (Preece) | Как считать | Стоимость | Ожидаемый precision (приор из Table 3) | Режим гейта |
|---|---|---|---|---|---|---|
| **I1** | **Integrity: все ссылки резолвятся** — каждый путь/команда/скилл/хук, упомянутый в правиле, существует | unsatisfiable condition | grep ссылок + `test -e`; O(n) | секунды, **уже написано** (см. §8) | 100% (31/31) | 🔒 **блокирующий** |
| **I2** | **Unusable consequent**: обязательство, которое никто не потребляет (напр. «сохраняй как feedback-память» — есть ли потребитель?) | unusable consequent | обход графа goal→consumer | секунды | 100% (9/9) | 🔒 блокирующий |
| **I3** | **Unused input**: объявленный вход, который не встречается ни в одном антецеденте. **Прямое применение к памяти: файл памяти, который не читает ни одно правило = кандидат в мёртвый груз** | unused input (deficiency) | обход | секунды | **29% (8/28)** — много ложных | ⚠️ **только warn, НЕ удалять автоматически** |
| **C1** | **Circularity**: граф «консеквент правила A ∈ антецедент правила B», поиск циклов (Тарьян) | circular dependency | O(V+E) | секунды | 83% (20/24) | 🔒 блокирующий (с whitelist намеренных петель) |
| **R1** | **Redundancy: subsumption/duplicate** — пара правил, где антецедент одного субсюмирует другой при совместимых консеквентах | rule check | O(n²) над ~50–80 правилами = тривиально | минуты | 58% общий; **19% на парах** | ⚠️ warn |
| **A1** | **Ambivalence**: пара правил, чьи антецеденты **совместно выполнимы** (SAT) и чьи консеквенты попадают в `C` | rule check + extension | SAT/переборный чек по дискретизованному `L` | минуты | **100% (18/18)** | 🔒 **блокирующий — приоритет №1** |
| **D1** | **Deficiency: missing rule** — перебор окружений `E` (декартово произведение `L`, отсечённое `C`), поиск ячеек, где не сработает **ни одно** правило | extension check (generate-and-test) | ограничить эвристикой «relevant data items» (Preece); у нас |L| мал → полный перебор реален | минуты | **36% (33/92)**; в одной системе **0/17** | 📋 **report-only** |

### Шаг 4. Witness-тест (превращает аномалию в ошибку)

Для каждой выжившей ambivalence — сгенерировать **конкретную задачу**, где оба правила
управляют (WIRE-«witness»), прогнать агента, судить выход против текста обоих правил.
Это единственный способ выполнить принцип 5 Preece (анomaly → error) для LLM-движка,
и это же — наш существующий формат live-run-validation.

### Шаг 5. Политика гейта (прямо из §4 + §5)

- **Блокировать**: ambivalence (precision 100%), integrity (100%), circularity (83%).
- **Warn**: redundancy (58%) — «симптом вероятной ошибки», но половина ложных.
- **Report-only**: deficiency (36%, а в одном KB 0/17) — **никогда не блокировать и не чинить
  автоматически**; «missing» часто = намеренное «ничего не делать».
- **Никогда не удалять автоматически** «unused input» (29%) — это прямо бьёт по соблазну
  «выкинуть память, на которую нет ссылок».

---

## 8. Пилотный ручной прогон (я прогнал прямо сейчас)

### 8.1. I1 — integrity check: **ЧИСТО**

Скрипт (bash, 20 строк) извлёк все markdown-ссылки из проектного `CLAUDE.md` и проверил
существование: **17/17 резолвятся** (`DEV_JOURNAL.md`, `ROADMAP.md`, `docs/MAP.md`,
`dev/INFORMATION-MAP.yaml`, `dev/meta-improvement/checklists/*`, `rails/RAILS.md`,
`skills/product/*` …). Ноль битых ссылок.

Единственная находка — **устаревшая декларация структуры**: блок «Repository structure» обещает
`dev/PHASE_<N>_READINESS.md` и `dev/PHASE_<N>_SMOKE_TEST_PLAN.md` в корне `dev/`, тогда как
фактически они живут в `dev/gates/` и `dev/_archive/`. Это не блокирующее правило, а
описательный блок → severity low, но это в точности класс «declaration ≠ reality».

> Честный вывод: **самый дешёвый и самый точный слой у нас уже чист.** Значит вся ценность
> чек-листа — в трёх остальных классах, которые сейчас **никто не проверяет**.

### 8.2. A1 — ambivalence: **2 находки в ITP (глобальный CLAUDE.md)**

**A1-1. T0 × T2 (строки 17 и 19).**
- T0 firable ⟺ `p ≥ 0.85` ∨ (`B ≤ 2` ∧ R=cheap) → **«делать молча»**
- T2 firable ⟺ `p < 0.6` ∨ (`B ≥ 3` ∧ R=expensive) → **«сначала спросить»**
- Окружение `E = {p=0.9, B=3, R=необратимо}`: **срабатывают ОБА** (T0 по первому дизъюнкту,
  T2 по второму). Консеквенты `{proceed_silently, ask_user_first}` ∈ `C`.
  ⇒ **ambivalent rule pair по определению Preece.** Precedence нигде не объявлен.
- Реалистичный кейс: «почисти старые ветки» — уверенность в топ-интерпретации высокая (p≈0.9),
  но ≥3 расходящихся вариантов *по действиям* и **необратимое** удаление.

**A1-2. Шаг 2 (T2) × Шаг 5 (строка 30).**
- Шаг 2: `p < 0.6` → **T2 = спросить**.
- Шаг 5 («НЕ спрашивать, когда»): «действие **дёшево-обратимо** (→ T1, не T2)».
- Окружение `E = {p=0.5, R=дёшево-обратимо}`: Шаг 2 требует спросить, Шаг 5 **запрещает** спрашивать.
  ⇒ **прямое противоречие.** (Это ровно тот случай, где движок-LLM выберет молча и
  моделезависимо: ECAR 0–20% по Control Illusion; уведомит о конфликте ≈45% случаев у
  Claude-4.5-Sonnet по ConInstruct.)

### 8.3. D1 — deficiency: **1 находка в ITP + дыры в таблице триггеров**

**D1-1. Непокрытая ячейка гейта ITP.** `E = {p=0.7, B=2, R=дорого/необратимо}`:
- T0? `p≥0.85` — нет; `(B≤2 ∧ R=cheap)` — нет (R дорогое). **Не срабатывает.**
- T1? требует `R=дёшево-обратимо`. **Не срабатывает.**
- T2? `p<0.6` — нет; `(B≥3 ∧ R=expensive)` — нет (B=2). **Не срабатывает.**
- ⇒ **`{G | infer(G, R, E)} = ∅` — missing rule по определению Preece.**
  И это **самая опасная ячейка**: необратимое действие при неполной уверенности. Правило
  просто молчит; поведение агента здесь не определено рулбейсом.

**D1-2. Дыры в Process-triggers (проектный CLAUDE.md).** Вход `commit.type` × `commit.zone`:
строк нет для `test:`, `perf:`, `build:`, `ci:`, `revert:` (severity low), и — важнее —
для `refactor:` в consumer-zone таблица «Process triggers» молчит, а таблица «Конвенции»
говорит «только если меняет behavior». Не противоречие, но **разные таблицы покрывают разные
куски одного входного пространства** — классический источник дрейфа.

### 8.4. R1 — redundancy: **1 subsumption через границу секций**

- «Конвенции» (таблица CHANGELOG vs DEV_JOURNAL): «Новая фича (`feat:`) → ✓ под `### Added`» —
  **безусловно**.
- «Process triggers»: «`feat:` **в consumer-zone** → 🔒 CHANGELOG `[Unreleased] ### Added`».
- Второе правило **субсюмируется** первым (его антецедент строго уже). По Preece это
  **subsumed rule** → «симптом вероятной ошибки»; вероятная ошибка здесь — **слишком общее
  первое правило** (dev-zone `feat:` фактически не требует CHANGELOG, что и enforce-ит гейт).
- Это ровно паттерн DMS1 из Appendix: знание («приоритет у более специфичного») **спрятано**,
  на этот раз — в том, какая из двух таблиц «главнее». Нигде не объявлено.

### 8.5. C1 — circularity: **0 находок**

Циклов «консеквент→антецедент» не нашёл. Единственная потенциальная петля
(`memory-sync` → Write → PostToolUse-хук → Write) **уже разорвана дизайном**: хук
`memory-drift-reminder.js` объявлен **detect-only** «чтобы не рекурсировать Write→hook→Write».
То есть один цикл в истории уже был найден и срезан вручную — это подтверждает, что класс
проверок релевантен, но сейчас он чист.

### 8.6. Свод пилота

| Проверка | Найдено | Класс по Preece | Что делать |
|---|---|---|---|
| I1 integrity | 0 битых ссылок (17/17 ok) + 1 stale structure-блок | unsatisfiable condition | автоматизировать (скрипт готов), поставить в `npm run verify` |
| A1 ambivalence | **2** (T0×T2; Шаг2×Шаг5) — обе в глобальном ITP | ambivalent rule pair | 🔒 чинить: объявить precedence или переписать антецеденты взаимоисключающими |
| D1 deficiency | **1 дыра в гейте ITP** (p∈[0.6,0.85) ∧ B≤2 ∧ R=необратимо) + мелкие дыры в таблице триггеров | missing rule | дописать правило (по смыслу — это T2 или T1-с-подтверждением) |
| R1 redundancy | **1** subsumption (feat: → CHANGELOG) | subsumed rule | warn: сузить общее правило |
| C1 circularity | 0 | — | — |

**≈30 строк ITP дали 3 аномалии.** Это не доказательство поведенческого дефекта (принцип 5!) —
это ровно то, что Preece называет «symptoms of probable errors». Проверяется witness-тестом.

---

## 9. Что из этого — ПРАВИЛО, а что — ГИПОТЕЗА

**RULE (можно класть в наш процесс прямо сейчас):**
1. **Каждое правило CLAUDE.md обязано быть либо взаимоисключающим с остальными по антецеденту,
   либо иметь ЯВНО объявленный precedence в тексте.** Полагаться на порядок/место в файле/«оно
   же специфичнее» — запрещено (Preece Appendix «hidden in the ordering»; подтверждено тем, что
   у LLM-движка specificity/priority не гарантированы — Control Illusion).
2. **Гейт статического линта — по precision:** ambivalence/integrity/circularity блокируют,
   redundancy warn, deficiency report-only (Table 3).
3. **Не удалять «неиспользуемое» автоматически** (unused input precision 29%).
4. **Статический линт добавляется К смоук-тестам, а не вместо** (IJHCS-97: 12% дефектов ловит
   только он; анализ его выхлопа в ~8 раз дешевле анализа тестов).

**HYPOTHESIS (нужен свой тест):**
5. Что найденные 3 аномалии ITP **реально** меняют поведение Claude Code → **witness-тест**:
   собрать 3 задачи-свидетеля (`p=0.9,B=3,R=irreversible`; `p=0.5,R=cheap`;
   `p=0.7,B=2,R=irreversible`), прогнать N=10 на нашей модели, судить: какой tier выбран,
   был ли маркер, был ли вопрос. Ожидание по Control Illusion/WIRE: разрешение будет
   **нестабильным и молчаливым**. Стоимость: ~1 час.
6. Что LLM-извлечение правил из CLAUDE.md даст приемлемое качество (ConInstruct F1 87–91% —
   на *их* бенчмарке, не на нашем тексте) → пилот: извлечь правила, сверить с ручным списком.

---

## 10. Честные ограничения

1. **ESWA-1992 и KER-1992 не добыты** (paywall). Алгоритмические детали COVER взяты из
   IJIS-1994 (которая их резюмирует и даёт сложности) и COVERAGE-97. Формальные определения —
   первоисточник, дыра не критична.
2. **McDermott & Forgy** прочитан как DTIC-скан 1976 (ADA037771) с плохим OCR; **слова
   «refractoriness» в нём нет** — класс называется *distinctiveness*. Термин «refraction»
   закреплён в OPS5-манале Forgy (там: «Discard from the conflict set the instantiations that
   have already fired»). Brownston et al. 1985 не читал.
3. **Из линии P9 нельзя вывести ни одного эффекта на LLM.** Все эффект-числа (§6.3) — из
   *другой* литературы (instruction-conflict), они про **конфликт инструкций**, а не про размер
   контекста, и я не выдаю их за подтверждение Preece.
4. **Table 3 — 5 систем, авторы сами пишут, что выборка не репрезентативна.** Абсолютные
   проценты не переносятся; переносится порядок типов по signal-to-noise.
5. **Мои находки в ITP — аномалии, а не доказанные дефекты** (принцип 5). Witness-тест не прогонял.
6. **Числа ConInstruct по «поведению уведомления» (≈45%/32%/3%/0%)** сняты через
   WebFetch-суммаризатор HTML-таблиц, построчно по PDF не сверял → **перед цитированием в
   решении сверить**. Числа Control Illusion (таблица obedience) и WIRE (276/1402/13335/35.4%)
   взяты из HTML/abs самих статей и выглядят точными.
7. **WIRE — препринт мая 2026**, рецензирование неизвестно; авторы сами называют свои числа
   «conditional diagnostics, not deployment-frequency estimates».
8. Я **не** проверял, есть ли уже готовые опенсорс-линтеры для CLAUDE.md/system-prompt — это
   отдельный разведочный запрос (стоит сделать до того, как писать свой).

---

## Приложение: рабочие файлы

- Скрипт I1 (integrity): `<scratchpad>/integrity2.sh` — 20 строк bash, готов к переносу в
  `dev/meta-improvement/scripts/`.
- Извлечённые тексты первоисточников: `<scratchpad>/{ijis1994,ijhcs1997,ops5,mcdermott77,coverage97}.txt`.

## Источники

- [Preece & Shinghal 1994, IJIS 9(8):683–702 (Wiley)](https://onlinelibrary.wiley.com/doi/abs/10.1002/int.4550090804) · [авторский PDF (Wayback)](https://web.archive.org/web/20210928140253if_/https://users.cs.cf.ac.uk/A.D.Preece/publications/download/ijis1994.pdf)
- [Preece, Talbot, Vignollet 1997, IJHCS 47:629–658 (авторский PDF, Wayback)](https://web.archive.org/web/20210928140253if_/https://users.cs.cf.ac.uk/A.D.Preece/publications/download/ijhcs1997.pdf)
- [Preece, Shinghal, Batarekh 1992, ESWA 5(3/4):421–436 (ScienceDirect, closed)](https://www.sciencedirect.com/science/article/abs/pii/095741749290026O)
- [Preece & Lamb 1997, «Verifying Multi-Agent KBS using COVERAGE», AAAI WS-97-01](https://cdn.aaai.org/Workshops/1997/WS-97-01/WS97-01-001.pdf)
- [Preece 1998, «Building the Right System Right», KAW-98](https://ksi.cpsc.ucalgary.ca/KAW/KAW98/preece/)
- [Forgy 1981, OPS5 User's Manual, CMU-CS-81-135 (DTIC ADA106558)](https://apps.dtic.mil/sti/tr/pdf/ADA106558.pdf)
- [McDermott & Forgy 1976/1978, Production System Conflict Resolution Strategies (DTIC ADA037771)](https://apps.dtic.mil/sti/tr/pdf/ADA037771.pdf)
- [Geng et al. 2025/2026, «Control Illusion», AAAI-2026, arXiv:2502.15851](https://arxiv.org/abs/2502.15851)
- [He et al. 2025/2026, «ConInstruct», AAAI-2026, arXiv:2511.14342](https://arxiv.org/abs/2511.14342)
- [Yan, Chen, Zhang 2026, «Witnessed Resolution Profiles» (WIRE), arXiv:2605.27784](https://arxiv.org/abs/2605.27784)
