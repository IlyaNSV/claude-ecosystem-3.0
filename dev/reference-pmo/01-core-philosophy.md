# 01. Базовая философия и операционные принципы

> **Назначение раздела:** определить функциональные требования к **операционной философии** AI-based PMO для solo-разработчика. Не «как делать конкретно», а «какие принципы поведения должны быть, чтобы система выдавала качественный output на длинной дистанции».

---

## 01.1 Индустриальный референс

### 01.1.1 Откуда берётся «правильная философия» PMO для solo+AI?

Классический PMO-канон (PMI, PRINCE2, P3M3) **не отвечает** на этот вопрос — он оптимизирован под организационную координацию команд, портфели проектов, бюджеты, stakeholder communication. Ничего из этого не применимо к solo-разработчику с AI-ассистентом.

Релевантная философия собирается из четырёх источников:

1. **Empowered Product Team operating principles** (Marty Cagan, SVPG) — даже при отсутствии команды, принципы «problems not features», «outcome over output», «discovery and delivery as parallel tracks» остаются применимыми.
2. **Continuous discovery cadence** (Teresa Torres) — еженедельные customer touchpoints как привычка; в solo это превращается в «не пропадай в делах больше чем на неделю без проверки реальности».
3. **Lean Startup discipline** (Eric Ries) — MVP = validated learning, не «v1 с урезанным scope»; pivot-or-persevere как cadence-driven решение.
4. **Anthropic «Building effective agents» principles** — предпочитай простую цепочку workflow'ов, тянись к сложным агентам только когда задача оправдывает; разделяй builder и critic; не запутывай контекст.

К ним добавляется специфическая для AI-driven PMO зона:

5. **Anti-sycophancy controls** (Sharma et al. 2023; OpenAI GPT-4o rollback April 2025) — RLHF систематически тренирует AI соглашаться с пользователем; это надо явно компенсировать структурно, не надеяться на «модель сама не захочет sycophancy».

### 01.1.2 Ключевые источники

- Cagan, *Inspired* (2017), *Empowered* (2020), *Transformed* (2024); SVPG.com — модель four risks, distinction между PM и project owner.
- Torres, *Continuous Discovery Habits* (2021); producttalk.org — cadence over project, story-based interviews.
- Ries, *The Lean Startup* (2011) — validated learning, vanity vs actionable metrics.
- Anthropic, «Building effective agents» (2024) — workflows-vs-agents distinction, evaluator-optimizer pattern, orchestrator-workers pattern.
- Sharma et al., «Towards Understanding Sycophancy in Language Models» (Anthropic, 2023, arxiv 2310.13548).
- OpenAI, «Sycophancy in GPT-4o» (April 2025) — отчёт об инциденте, rollback, обсуждение structural mitigation.
- Anthropic, «Constitutional AI» (2022, arxiv 2212.08073) — паттерн self-critique, основа для self-meta-feedback.

URL detail → `99-bibliography.md`.

---

## 01.2 Перечень функций

| Функция | Industry-canonical anchor | Authoritative source | Maturity |
|---|---|---|---|
| Problems-not-features orientation | Cagan «Empowered teams»; opportunity-not-output (Torres) | Cagan *Empowered* ch. 1-3; Torres ch. 2 | MATURE-ISH |
| Outcome over output | Torres OST; Cagan product strategy | Torres ch. 4-6; Doerr OKRs | MATURE-ISH |
| Validated learning > shipping | Ries Build-Measure-Learn | Ries ch. 5-9; Bland & Osterwalder *Testing Business Ideas* | MATURE-ISH |
| Discovery-and-delivery parallel tracks | Cagan dual-track agile | Cagan *Inspired* part 3 | MATURE-ISH |
| Iterative draft → critique → approve loop | Three Amigos (BDD); evaluator-optimizer (Anthropic) | North «Introducing BDD»; Anthropic «Building effective agents» | MATURE (BDD) / EMERGING (LLM evaluator-optimizer) |
| Builder/critic separation | Devil's advocate prompting; Constitutional AI; multi-agent adversarial review | Anthropic «Building effective agents»; Sharma 2023; Anthropic Constitutional AI 2022 | EMERGING |
| Anti-sycophancy structural controls | Forced disagreement, structured confidence fields, isolated-context critic | Sharma 2023; Anthropic «Building effective agents»; Tian 2023 (verbalized confidence) | EMERGING |
| Honest uncertainty articulation | Verbalized confidence; «I don't know» как valid state | Tian et al. 2023; Lin et al. 2022; Kadavath 2022 | EMERGING |
| Ceremony minimization | Cagan critique of stage-gate processes; Lean «no waste» | Cagan *Empowered* (глава о operating model); Ries on innovation accounting overhead | MATURE-ISH |
| Workflow before agent | «Use simpler workflow when sufficient» | Anthropic «Building effective agents» | EMERGING |
| Persona consistency (single voice) | UX-принцип; внутренняя консистентность в dialogue systems | (нет единого канонического источника — UX best practice) | MATURE для UX, EMERGING для AI agents |

## 01.2-plain Перечень функций — простыми словами

> **Назначение подраздела:** те же 11 функций, что и в §01.2, объяснённые без отсылок к индустриальным школам и AI-research терминологии. Полезно для (а) передачи смысла философии раздела человеку, не знакомому с PM / SE / AI literature, (б) sanity-check для самого автора: если своими словами объяснить не получается — значит функция плохо понята и операционализация может дрейфовать незаметно.

**1. Problems-not-features orientation — *Сначала проблема, потом решение***
Любая фича начинается с формулировки реальной боли конкретного сегмента пользователей, а не из «придумалось — давай сделаем». Цель: не строить то, что никому не нужно.

**2. Outcome over output — *Результат важнее количества***
Успех меряется не «сколько отгрузили», а тем, что реально изменилось в поведении или метрике пользователя. Цель: не путать продуктивность с пользой.

**3. Validated learning > shipping — *Сначала научиться, потом отгрузить***
MVP — это эксперимент для проверки гипотезы о реальности, а не «v1 с обрезанным scope». Цель: каждая итерация даёт знание о пользователе, а не просто новый артефакт.

**4. Discovery-and-delivery parallel tracks — *Исследование и разработка идут параллельно***
Пока одна часть строит фичу, другая продолжает проверять «а то ли мы вообще строим». Цель: не вложиться в неверное направление до момента, когда поворачивать уже поздно и дорого.

**5. Iterative draft → critique → approve loop — *Несколько раундов критики до утверждения***
Артефакт проходит цикл «черновик → ревью → правки → утверждение», а не «написал — и в продакшн». Цель: ловить незаметные изъяны до того, как они стали дорогими в исправлении.

**6. Builder/critic separation — *Автор и критик — разные роли***
Тот, кто пишет, не критикует свою работу сам — это делает «свежий взгляд» с независимым контекстом. Цель: автор уже эмоционально вложился, его самокритика будет защитной, а не честной.

**7. Anti-sycophancy structural controls — *Защита от подхалимства AI***
Встроенные механизмы (обязательные поля, форсированная аргументация при отклонении замечаний), которые не дают AI соглашаться «лишь бы угодить». Цель: компенсировать врождённое свойство современных LLM приукрашивать и редко возражать.

**8. Honest uncertainty articulation — *Уверенность фиксируется явно***
В каждом артефакте указано, насколько автор уверен (high/medium/low) и почему, вместо молчаливого «всё ок». Цель: невидимая неуверенность становится видимым сигналом — читатель знает, где можно опереться, а где перепроверить.

**9. Ceremony minimization — *Не запускать тяжёлые процессы там, где не нужно***
Полный ревью-цикл активируется только для значимых изменений; косметика и мелкие правки проходят упрощённо. Цель: не превратить контроль качества в формальность, в которой человек жмёт «ОК» из усталости.

**10. Workflow before agent — *Сначала простой скрипт, потом «умный» агент***
Если задачу решает детерминированная цепочка шагов — не вызывать LLM-агента с собственным принятием решений. Цель: держать систему предсказуемой, дешёвой и отлаживаемой; «магия» только там, где она действительно нужна.

**11. Persona consistency (single voice) — *Система говорит «одним голосом»***
Поведение последовательно во всех сессиях: те же принципы, тон, подход к работе. Цель: пользователь опирается на предсказуемые реакции, а не угадывает «настроение» этой конкретной сессии.

---

## 01.3 Чеклист покрытия

**Шкала покрытия** (определена в `00-overview.md` §2.2): **✗ 0** Not covered / **◔ 1** Acknowledged / **◐ 2** Partially operationalized / **● 3** Fully operationalized / **N/A** Out of scope.

**Маркеры:** **`[C]`** Conformance / **`[F]`** Fitness / **`[F/C]`** гибрид.

**Locus:** **CC** Claude Code primitive / **EXT** External tool / **HYB** Hybrid / **N/A**.

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Problems-not-features orientation | ● 3 | `[C]` | CC | DEC-P13 «Assistant-led human-approved», явный anti-feature-factory принцип в Product Module SPEC §1.4 «Что персона избегает: scope creep». Операционализирован через FM creation D1-alignment check (P2.B F.0a) — block path для фичи без SEG/JTBD/HYP. |
| 2 | Outcome over output | ◐ 2 | `[C]` | CC | HYP с success/invalidation thresholds — bookkeeping функцию покрывает. **Частично:** outcome не отслеживается **continuously** — только при D1.5 formulation и HYP transitions. Полное покрытие потребует D5 monitoring → locus станет HYB. Для solo до pilot — 2 приемлемо. |
| 3 | Validated learning > shipping | ◐ 2 | `[C]` | CC | MVP scope с primary HYP — bookkeeping. **Частично:** Build-Measure-Learn loop НЕ замкнут (P3 Feedback Integration «out-of-scope v1»; DEC-P08). Сознательный cut. Полное замыкание потребует D5 tooling → locus HYB. **Риск:** до закрытия P3 экосистема не учится из реальности. |
| 4 | Discovery-and-delivery parallel tracks | ● 3 | `[C]` | CC | P1 Discovery + P2 Feature могут идти параллельно (ROADMAP подтверждает). Tool-agnostic D3-D6 через Integrator явно отделяет delivery в собственный track. На уровне дизайна — fully operationalized. |
| 5 | Iterative draft → critique → approve | ● 3 | `[F/C]` | CC | DEC-P13 универсальный паттерн; 4 уровня review; Discovery Review Checkpoint для batch-обработки research. **Fitness-добавка:** auto-approve для 🟢 при `confidence: high` + clean validation. |
| 6 | Builder/critic separation | ● 3 | `[F/C]` | CC | Subagent `product-devils-advocate` с isolated context (Product Module SPEC §5.3). Соответствует Anthropic evaluator-optimizer pattern. **Fitness adaptation:** adaptive-depth (single subagent classifies cosmetic vs significant) — сжатие двух паттернов в один. |
| 7 | Anti-sycophancy structural controls | ● 3 | `[F]` | CC | Confidence articulation как mandatory frontmatter поле (C2); ceremony escalation после ≥5 idle approves; явный список «что персона избегает» (sycophancy первым пунктом). **Глубже** чем у большинства AI-driven продуктовых систем. |
| 8 | Honest uncertainty articulation | ● 3 | `[F]` | CC | `confidence: high|medium|low` обязательно в каждом артефакте; `confidence_notes` required при non-high. Соответствует рекомендациям Tian/Lin о verbalized confidence. **Caveat (не снижает покрытие):** miscalibration risk на open-ended generation (Kadavath et al.) — стоит запланировать calibration check на golden set после pilot. |
| 9 | Ceremony minimization | ● 3 | `[F/C]` | CC | Magnitude classification (cosmetic vs significant) для DA; quiet-draft hooks (B2); validation_tier (pilot/mvp/full). Сильное fitness-расширение классической Lean «no waste» дисциплины под AI-driven контекст. |
| 10 | Workflow before agent | ● 3 | `[C]` | CC | Большинство процессов P1-P2 — детерминированные skill-driven workflows. Subagents — только там, где нужен изолированный контекст. Соответствует guidance Anthropic. |
| 11 | Persona consistency | ● 3 | `[F]` | CC | Product Module SPEC §1.4 «Единая персона» — explicit design choice. Индустрия таких артикуляций не имеет (для AI agents — emerging best practice). |

**Итог по разделу 01:** 9 × ● 3 (fully), 2 × ◐ 2 (partially), 0 × ◔ 1, 0 × ✗ 0, 0 × N/A. По функциональному покрытию — близко к полному. **Все** функции — locus CC, что **корректно для философии** (operating principles реализуются как Claude Code-level invariants — frontmatter required fields, hooks, subagent invocations).

**Точки внимания при diff'е снапшотов:**
- #2 (Outcome over output) и #3 (Validated learning > shipping) находятся на 2, и их повышение до 3 потребует locus shift CC → HYB (D5 monitoring tooling). Это значимый архитектурный поворот; ожидать его не раньше Phase 5 + первый external tool. Если в snapshot N+1 они показывают 3 без locus shift — это false high (формальное закрытие без реального замыкания BML loop).
- Любое снижение покрытия по `[C]` функциям (#1, #2, #3, #4, #10) — обязательная запись в DEV_JOURNAL (см. overview §2.2).
- Locus shift CC → EXT по любому из этих 11 пунктов — significant signal. Особенно для #6 (Builder/critic separation) — если subagent перестанет быть isolated, это эрозия принципа.

---

## 01.4 Нарративный анализ соответствия

### 01.4.1 Что должно быть → Как у тебя сейчас → Gap / Match / Conscious divergence

**А. Operating principles явно задокументированы (не подразумеваются)**

> *Должно быть:* Эксплицитный список «что система делает» и «что она избегает», читаемый при каждом запуске сессии. Индустрия: характер «Empowered teams» у Cagan, опубликованные guidelines Anthropic «Building effective agents».
>
> *У тебя:* Product Module SPEC §1.4 «Персона» (что персона делает / характеризуется / избегает), CLAUDE.md «Принципы работы над экосистемой» (6 принципов), DEC-P13 как root pattern.
>
> *Match.* Сильный fitness-уровень. **Отдельное наблюдение:** список «избегает» (sycophancy, over-engineering, premature closure, scope creep, ceremony escalation) сильнее, чем у большинства AI-driven продуктовых систем; стоит сохранить даже если кажется дубликатом — он работает как guard против дрейфа в фундаментальных вещах.

**B. Honest uncertainty как first-class field**

> *Должно быть:* Модель **обязана** артикулировать неуверенность; неартикулированный output не должен попасть в active. Индустрия: Tian/Lin/Kadavath — verbalized confidence как поведенческая дисциплина; пока **не** превращена в product-level convention в индустрии.
>
> *У тебя:* `confidence: high|medium|low` mandatory, `confidence_notes` required при non-high; auto-approve gated на confidence high. Это **operationalized** verbalized confidence, не просто guideline.
>
> *Match с лидерским уклоном.* Ты впереди индустрии в operationalization. **Caveat:** sanity-check калибровки (golden set) не запланирован; рекомендую добавить в P5.B Actuality Refresh когда тот будет проектироваться, либо как отдельный hook.

**C. Builder/Critic separation на architectural уровне**

> *Должно быть:* Critic не должен видеть creator-side context. Индустрия: Anthropic «Building effective agents» — evaluator-optimizer; multi-agent research system pattern.
>
> *У тебя:* `product-devils-advocate` subagent с isolated context, явно мотивированный «fresh critical lens». Adaptive-depth — fitness-adaptation, сжимающая classify+execute в один invocation.
>
> *Match с conscious divergence.* DEC-DEV-0012 явно фиксирует переход magnitude-gated → adaptive-depth; rationale в DEV_JOURNAL. Это **сознательный** отход от наивного «всегда полный 6-lens DA», и он оправдан. Альтернативная индустриальная практика — двухзвенный паттерн (classifier → executor) — потребует двух LLM invocations; ты cost-conscious и сжал это в один. Отслеживай в снапшоте: если adaptive-depth начнёт mis-classify (cosmetic, который оказался significant) — это сигнал переосмыслить.

**D. Outcome continuous tracking**

> *Должно быть:* Outcome (HYP success/invalidation criteria) проверяется не только в моменты статус-перехода HYP, но **continuously** или хотя бы по cadence. Индустрия: Torres weekly customer touchpoints; Lean Startup innovation accounting; Cagan empowered teams reviewing их KRs не реже спринта.
>
> *У тебя:* HYP получает phases (testing → validated/invalidated/deferred), но cadence для re-evaluation не задана. P3 Feedback Integration явно «out-of-scope v1» (DEC-P08), потому что нет D5 tooling.
>
> *Conscious gap.* Это сознательное отложение, согласованное с твоим pre-pilot контекстом. **Отслеживай в снапшоте:** при первой реальной фиче, отгруженной во внешний инструмент, должен возникнуть сигнал «теперь outcome проверяется откуда?» Если этого сигнала нет, и P3 продолжает откладываться — это эрозия принципа validated learning.

**E. Workflow vs Agent дисциплина**

> *Должно быть:* Использовать subagent только когда задача требует изолированного контекста или существенной независимой работы; в остальных случаях — детерминированный workflow на skills. Индустрия: Anthropic «Building effective agents» — «use simpler workflow when sufficient».
>
> *У тебя:* Subagents — только для (a) market researcher / competitor analyst (Deep mode, отложен v1.1), (b) product-devils-advocate (изолированный контекст для критики), (c) screen-generator (Design Module). Всё остальное — skills + commands. **Это правильная дисциплина.**
>
> *Match.* Особо отметить: твоё решение отложить Deep mode subagents до v1.1 — это **в духе** этой дисциплины, не наперекор: Deep mode с full subagent цепочкой добавляет сложность, которая не оправдана пока Quick mode не валидирован.

---

## 01.5 Анти-паттерны для отслеживания

Эти красные флаги собраны из всех источников; ищи их в снапшоте:

1. **Sycophancy debt** — артефакты, утверждённые без явного challenge. **Сигнал в снапшоте:** confidence-поле массово =`high` без артикулированных `confidence_notes`; DA findings dismissed без journal-rationale. (Источник: Sharma 2023; Anthropic anti-sycophancy guidance.)

2. **Feature-factory drift** — фичи приходят не из HYP/SEG/JTBD, а «потому что подумали». **Сигнал в снапшоте:** массовые FM с `nfr_status=declined` без rationale; FM creation mode (P2.B) без D1-alignment; растущий счётчик «exploratory» FM без conversion в tested HYP. (Источник: Cagan *Empowered* — критика feature factory.)

3. **MVP-as-v1-with-cut-scope** — MVP scope сокращается «до достижимости», но primary HYP не имеет thresholds или они подгоняются под наблюдаемое. **Сигнал в снапшоте:** HYP без `success_threshold`/`invalidation_threshold`; thresholds, которые менялись после testing-status без journal entry. (Источник: Ries — критика MVP misuse; pre-registered thresholds.)

4. **Ceremony escalation** — approve gates становятся formality, человек жмёт `y` подряд без чтения. **Сигнал в снапшоте:** массовые approve без обновления `confidence_notes` на artifacts; >5 sequential approves в session journal без правок. (Источник: критика stage-gate у Cagan; и явно в Product Module SPEC §1.4 как «ceremony escalation» опасность.)

5. **Discovery-as-one-off** — Discovery провели один раз, дальше только feature work. **Сигнал в снапшоте:** PS/MR/CA не обновлялись > 3 месяцев, при этом active feature work идёт. Activation Matrix говорит D1-01..06 Discovery должно ★ только на стадии ИДЕЯ → MVP, но weekly customer touchpoints (Torres) рекомендует continuity. (Источник: Torres *Continuous Discovery Habits* — discovery-as-habit, not phase.)

6. **Verbalized confidence без calibration** — модель уверенно говорит `confidence: high`, но реальный rate ошибок такой же как при `medium`. **Сигнал в снапшоте:** auto-approve rate высокий, при этом DA findings или validation flags на эти же artifacts тоже высокие. (Источник: Kadavath et al. 2022 «Language Models (Mostly) Know What They Know» — calibration drift.)

7. **Builder-critic merger** — DA subagent runs в том же контексте, что и creating session (например, если invoke без `Mode: adaptive` и subagent видит draft history). **Сигнал в снапшоте:** DA findings подозрительно совпадают по тону с creator-side rationale; нет «push-back» findings уровня 🔴 вообще. (Источник: Sharma 2023; принцип Builder/Critic separation.)

8. **Out-of-scope erosion** — секция Out-of-scope в FM/handoff пустеет, scope creeps. **Сигнал в снапшоте:** FM bodies с пустым `out_of_scope`; handoffs section 13 с placeholder «ничего не excluded». (Источник: Cagan; и явно AP-4 в твоём handoff-spec §12.)

---

## 01.6 Сигналы для сравнения снапшотов

При diff'е snapshot N+1 vs N в зоне философии — конкретные вопросы:

1. **Сохранён ли список «что персона избегает» в Product Module SPEC §1.4?** Если изменился — что добавили / убрали, и почему?
2. **Добавлены ли новые принципы в CLAUDE.md** «Принципы работы над экосистемой» (сейчас 6)? Если да — это extension или дрейф?
3. **Изменились ли значки/семантика 4 уровней review?** 🔴/🟠/🟡/🟢 — стабильны? Их пороги (например, что считать «Critical») двигались?
4. **Frontmatter `confidence:`** — поле всё ещё mandatory? Confidence-notes всё ещё required для non-high? Auto-approve всё ещё gated на confidence:high?
5. **Subagent isolation для DA** — `product-devils-advocate` всё ещё запускается с isolated context (через Agent tool, не inline)? Если стал inline для «упрощения» — это эрозия Builder/Critic separation.
6. **Adaptive-depth в DA** — single invocation сохранён? Если разделили обратно на classifier + executor — что мотивировало?
7. **Ceremony escalation guard** — после ≥5 idle approves persona предлагает meta-обсуждение? Это всё ещё в SPEC? Хуком enforced?
8. **Build-Measure-Learn замыкание** — P3 всё ещё «out-of-scope v1»? Если стал реализуемым — что изменилось в D5 tooling? Если остался отложенным после PILOT POINT — это сигнал на review «учится ли экосистема из реальности».

Эти вопросы — не для бинарного yes/no. Они для прокликивания в снапшоте, чтобы быстро увидеть, где философия evolves vs erodes.

---

**Конец раздела 01.**
