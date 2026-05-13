# Phase 4 — Решения для обсуждения (черновик)

> **Назначение:** временный файл. Содержит открытые вопросы из [PHASE_4_READINESS.md](PHASE_4_READINESS.md) с краткой теорией и рекомендациями. Заполни поле **«Решение»** под каждым пунктом.
>
> **После заполнения:** перенести каждое решение в DEV_JOURNAL как `DEC-DEV-NNNN` (короткие entries), отметить пункты в PHASE_4_READINESS.md как ✅, **удалить этот файл**.
>
> **Статус:** 13 вопросов (1 унаследованный + 5 архитектурных C.1-C.5 + 5 scope D.1-D.5 + 2 расширения scope D.6-D.7).

---

## Как читать

Под каждым вопросом:
1. **Контекст** — что это вообще такое, откуда взялось
2. **Варианты** — 2-3 опции с pros/cons
3. **Моя рекомендация** — что выбрал бы и почему
4. **Решение:** _(пусто — заполни ты)_

---

# A.3 — Drift во frontmatter HYP (унаследованное от DEC-DEV-0013 B.1)

### Контекст
Skill `skills/product/hypothesis-formulation.md` создаёт артефакты HYP с полями, которые расходятся с каноническим spec в `docs/pmo/artifacts/HYP.md`:
- `success_threshold` вместо канонического `target_value`
- В шаблоне отсутствуют `segment` и `value_proposition`

Это типичный case того самого drift, против которого создана конвенция «explicit frontmatter template + anti-pattern warnings» (DEC-DEV-0012). Образцы корректной реализации: `problem-discovery.md` Step 3 и `note-promote.md` Step 3.

### Варианты
- **A. Исправить сейчас.** Обновить skill: добавить explicit YAML template + список запрещённых имён полей (`success_threshold` явно warn). 15-30 минут работы. Закрывает drift до того, как он распространится при следующем `/product:init`.
- **B. Явно отложить.** Пометить в `dev/v1_1_backlog.md`, фиксировать defer note в DEV_JOURNAL. Риск: следующий пилот создаст ещё одну HYP с неканоническими полями, потом cleanup батчем.

### Моя рекомендация: A
Skill уже используется. Стоимость fix мала; стоимость отсрочки — будущий cleanup + риск, что pattern-linter (C4 drift mechanism) может пропустить т.к. сам skill «легализует» неправильные имена.

**Решение:** ✅ **A — fix сейчас.** Зафиксировано в DEC-DEV-0024.

---

# C.1 — Хеш handoff на CRLF

### Контекст
Правило валидации **V-H-04** детектит drift между `.product/` и `.handoff/` через сравнение SHA-256 хешей. На Windows git по умолчанию автоматически конвертирует line endings: LF в репозитории ↔ CRLF в working copy (`core.autocrlf=true`). Если хеш считается прямо от файла, тот же логический контент даст разный хеш на Windows и на Unix → ложные срабатывания drift detection при чекауте проекта на другой машине.

### Варианты
- **A. Нормализация перед хешированием.** Перед `crypto.createHash('sha256')` — `content.replace(/\r\n/g, '\n')`. Кросс-платформенно, hash инвариантен относительно line endings. Минимальный код. **Минус:** если когда-нибудь reall-binary файл попадёт в handoff (картинка, бинарь) — нормализация повредит, но handoff §10 — markdown only.
- **B. Хешировать как есть, требовать `.gitattributes` с `* text=auto eol=lf`.** Правильно «по гитовски», но требует от каждого consumer-проекта правильно настроенного `.gitattributes`. Хрупко.
- **C. Построчное хеширование.** `split('\n').map(trim_cr).join('\n')` — фактически тот же результат что A, но более явно выражает intent.

### Моя рекомендация: A
Простейший вариант, который решает проблему без зависимости от внешней конфигурации. Зафиксировать конкретный helper (`normalizeForHash(content)`) в `skills/product/handoff-generator.md` + переиспользовать в `product-handoff-gate.js`.

**Решение:** ✅ **A — нормализация перед хешем.** Зафиксировано в DEC-DEV-0025.

---

# C.2 — Жёсткость NFR sanity ranges

### Контекст
В spec `NFR.md §5` для каждой категории NFR (latency, availability, throughput и т.д.) прописаны **sanity-check диапазоны** — типичные значения, ожидаемые для текущего tier (PoC/MVP/Production). Workflow F.5a при создании NFR предлагает дефолты из этих диапазонов; пользователь может **переопределить** значение с rationale (например, требование latency=10s где typical=1s — допустимо для batch операций). При override в frontmatter NFR появляется поле `sanity_check: overridden` + rationale в теле.

Вопрос: насколько жёстко система реагирует на override?

### Варианты
- **A. Strict.** Каждый NFR с `sanity_check: overridden` обязан пройти Product DA review (Mode: full с фокусом на этой NFR) до того как `/product:handoff` пропустит. Высокая дисциплина, но много friction для legitimate cases (90% override — обоснованные).
- **B. Informational.** Warning при создании, override фиксируется в frontmatter с rationale, и всё. DA review **не обязателен**. Trust the user. Меньше ceremony, override — уже сознательное действие.
- **C. Hybrid по magnitude.** До 3× от typical — warning (как B); >3× — требует DA review (как A). Adaptive, но добавляет сложность magnitude-классификации в NFR (аналог DA adaptive-depth, но в другой плоскости).

### Моя рекомендация: B
Override уже требует rationale — это уже barrier. Strict (A) добавит ceremony к каждому реалистичному use case (batch jobs, cold-start operations, planned degradation). Hybrid (C) переиспользует механику adaptive-depth, но усложняет workflow без явного value (магнитуду «насколько большой override» легко undermine ad-hoc выбором typical-значения).

**Решение:** ✅ **B — informational warning.** Зафиксировано в DEC-DEV-0025.

---

# C.3 — Формат brief для ручного `/product:da-review`

### Контекст
В Phase 3 рефакторинг `agents/product/devils-advocate.md` ввёл **adaptive depth**: subagent сам классифицирует магнитуду изменения (cosmetic vs structural vs semantic) и адаптирует output. Hook-driven invocations (BR/IC change) дают subagent узкий brief — конкретное изменение + spec rule.

Phase 4 добавляет **ручной триггер** `/product:da-review FM-<NNN>` — это **Mode: full**, FM-level scope, не per-rule. Subagent должен получить значительно более широкий brief (вся FM с её SC/BR/IC/LC/VC + decision journal entries + связанные FMs).

### Варианты
- **A. Symmetric brief.** Использовать тот же шаблон что hook-driven (single-change focus), но с расширенным контекстом FM. **Минус:** brief structure заточен под per-rule, не FM-level — DA не получит explicit prompt про cross-rule consistency, JTBD alignment, scope creep.
- **B. Separate template for Mode: full.** Отдельный шаблон в `skills/product/product-da-review.md` со своими секциями: «FM scope summary», «Cross-artifact consistency», «JTBD alignment», «Scope creep detection», «Pre-handoff readiness». DA получает explicit lenses для FM-level review.

**Output location:**
- Все findings писать в единый `.product/.da-findings/` с дополнительным полем `source: manual | hook-driven | auto-pre-handoff` в frontmatter; **либо**
- Раздельные подпапки `.product/.da-findings/manual/` vs `.../hook-driven/`.

### Моя рекомендация: B + единый каталог с полем source
**Brief format B** — FM-level review требует своих lenses (cross-rule, scope), symmetric brief недодаст структуры. **Output единый** — раздельные папки усложняют поиск ("где DA findings для FM-001?" — приходится смотреть в две папки), а structured DA findings YAML schema (DEC-DEV-0023 F8) уже включает frontmatter, добавить поле `source` тривиально.

**Решение:** ✅ **B + единый каталог с полем `source`.** Зафиксировано в DEC-DEV-0026 (вместе с D.3 и D.7 как DA architecture expansion).

---

# C.4 — Validation runner: программно из каталога или хардкод?

### Контекст
В `docs/pmo/validation.md` каталог из ~50 правил валидации: V-01..V-16 (общие), V-H-01..V-H-10 (handoff), V-MK-01..V-MK-08 (mockups, Phase 6). Каждое правило в каталоге имеет id, scope, severity, описание, пример violation. Команда `/product:validate --deep` (Phase 4) должна запускать набор правил и собирать violations.

Вопрос: skill `validation-runner.md` парсит каталог программно (читает `validation.md`, извлекает правила, вызывает их по id) или хардкодит список правил с inline implementation?

### Варианты
- **A. Программно из каталога.** Читать `validation.md`, парсить markdown, для каждого правила — отдельный JS-модуль с реализацией. Преимущество: новое правило = добавить запись в каталог + новый модуль; runner не трогается. **Минус:** парсер markdown хрупкий (любое изменение формата правила в каталоге может сломать парсер); добавление правила всё равно требует JS-модуля → две точки изменения, не одна.
- **B. Хардкод list в skill.** Skill `validation-runner.md` содержит explicit таблицу/список правил с pointer на implementation. Каталог `validation.md` — human-readable справочник, runner — отдельный source of truth. **Минус:** дублирование (любое правило документировано в двух местах), есть риск drift между каталогом и runner.
- **C. Гибрид: каталог-как-spec, runner-как-impl, статический проверщик соответствия.** Hardcode runner, но в phase-closure ритуале (или отдельном linter) сверять что: каждое правило в каталоге имеет implementation; каждая implementation имеет запись в каталоге.

### Моя рекомендация: B сейчас, C потом
**B** — на текущем количестве правил (~50) хардкод проще + надёжнее. Markdown-парсер каталога — overengineering для статической data structure. **C** — добавить когда правил станет 100+ или когда drift между каталогом и runner будет реально наблюдаться (D7 catch). Сейчас YAGNI.

**Решение:** ✅ **B — hardcode list в skill.** Зафиксировано в DEC-DEV-0025. Hybrid (C) — кандидат в v1.1 при росте количества правил или при первом drift'е.

---

# C.5 — Cleanup orphan + чистка pending файлов

### Контекст
Команда `/product:cleanup` (Phase 4) изначально планировалась как детекция orphan'ов по правилу V-15 (артефакты, на которые никто не ссылается). После DEC-DEV-0023 в `.product/.pending/` накапливаются три файла со stale entries:
- `cascade-pending.yaml` — после ручной/cascade resolution
- `validation-pending.yaml` — после auto-purge (F5) могут оставаться edge cases
- `da-pending.yaml` — после DA processed артефакта

Вопрос: должен ли cleanup также чистить эти файлы?

### Варианты
- **A. Single sweep.** `/product:cleanup` делает всё: orphan + cascade revalidate (под капотом вызывает `/product:cascade --pending --revalidate`) + verify pending purge + flag stale entries. Один периодический запуск чистит всё.
- **B. Separate concerns.** `/product:cleanup` = только orphan detection. Cascade hygiene — отдельная команда `/product:cascade --pending --revalidate`. Pending purges — автоматические (F5 паттерн в hooks). Пользователь по дисциплине знает какую команду когда запускать.
- **C. Hybrid.** Default `/product:cleanup` = orphan only (быстро, безопасно). Флаг `--pending-hygiene` или `--full` = добавить cascade revalidate + pending checks.

### Моя рекомендация: C
Уже зафиксирована в [PHASE_4_READINESS.md D.5](PHASE_4_READINESS.md#d5). Гибкость без принудительного бандла. Default — fast и predictable. Флаг — для periodic maintenance ("раз в месяц прогнать full sweep"). Также проще тестировать: orphan detection и pending hygiene — независимые модули.

**Решение:** ✅ **C — hybrid с флагом `--pending-hygiene`.** Зафиксировано в DEC-DEV-0027 (вместе с D.5 как одна тема).

---

# D.1 — Handoff modes: оба сразу или production первым?

### Контекст
По модификации **D1** (DEC-DEV-0006), команда `/product:handoff` поддерживает два режима:
- `--mode draft` — handoff с 3 обязательными секциями (для PoC/exploration); статус: `partial`
- `--mode production` — handoff с 8 обязательными секциями (для full handoff к D2-Tech); статус: `complete`

Оба режима используют один skill `handoff-generator.md`, отличаются списком required sections + DoR проверками.

### Варианты
- **A. Оба сразу в Phase 4.** Структурно близки (один template, разница в required-set). Развести = искусственное разделение.
- **B. Production first, draft в minor follow-up.** Сократить scope Phase 4. **Минус:** draft нужен для PoC pилота — без него `/product:handoff` бесполезен на early-stage features.

### Моя рекомендация: A
Стоимость второго режима ≈ 30 минут (другой required-set). Разнос на два релиза создаст версионную сложность (1.2.0 без draft, 1.2.1 с draft) и дополнительный CHANGELOG entry. Для пилота нужен именно draft — без него нечего тестировать на FM, которые ещё не production-ready.

**Решение:** ✅ **A — оба режима в Phase 4.** Зафиксировано в DEC-DEV-0028 (вместе с D.2 и D.4 как scope confirmation).

---

# D.2 — NFR Review: разделение F.5a.0 Ask + F.5a.1 Define

### Контекст
По `processes.md §3.2`, F.5a в feature workflow состоит из двух фаз:
- **F.5a.0 Ask (mandatory):** «Есть ли у этой FM measurable non-functional requirements? [Y/N]» — фиксируется решение в decision journal.
- **F.5a.1 Define (conditional):** Если Ask=[Y], то определить конкретные NFR (latency, availability, etc.) с values + sanity_check.

### Варианты
- **A. Оба сразу.** Полный workflow: Ask определяет, нужен ли Define; Define выполняется conditionally в той же сессии.
- **B. Только Ask, Define через отдельную команду.** Ask делает feature-session; Define запускается через `/product:nfr:define FM-NNN`. **Минус:** разрыв между Ask=Y и Define создаёт queue (NFR queue для каждой FM) — нужна дополнительная state.

### Моя рекомендация: A
Без Define у Ask нет места куда писать ответ — Ask=Y станет orphan record, который потом нужно where-to-act resolve. Полный F.5a в одной сессии — естественнее. Если NFR много или сложные — пользователь может всегда сам прерваться и продолжить позже через `/product:nfr:review --continue`.

**Решение:** ✅ **A — обе фазы в Phase 4.** Зафиксировано в DEC-DEV-0028.

---

# D.3 — F.9 Product DA Review: ручной или авто-trigger?

### Контекст
**F.9** — explicit FM-level Product DA review перед `/product:handoff`. Это **отдельный** механизм от per-BR/per-IC DA, который уже работает автоматически через хуки (Phase 3). F.9 — review **всей** FM (consistency, JTBD alignment, scope creep, pre-handoff readiness).

### Варианты
- **A. Manual trigger через `/product:da-review FM-<NNN>`.** Пользователь явно решает когда review нужен. F.9 → запись в decision journal → `/product:handoff` смотрит «была ли F.9 для этой FM в последние N дней» в DoR.
- **B. Auto-trigger перед `/product:handoff`.** `/product:handoff FM-NNN` сам вызывает F.9 если её не было / если FM изменилась с прошлой F.9.
- **C. Гибрид.** Manual + флаг `--with-da-review` для handoff (one-shot review-then-ship workflow).

### Моя рекомендация: A с возможностью добавить C позже
**Manual** даёт user control + intentional review. Auto (B) может surprise — длинная DA сессия посреди handoff workflow. **Гибрид (C)** — добавить позже если паттерн «сразу после review hand off» окажется частым.

В DoR `/product:handoff --mode production` можно добавить мягкое требование: «если F.9 не было / была >7 дней назад — warning + продолжить или предложить запуск F.9».

**Решение:** ✅ **C — гибрид.** Manual `/product:da-review FM-NNN` + флаг `--with-da-review` для `/product:handoff` (one-shot review-then-ship workflow). Soft warning в DoR остаётся как safety net.

---

# D.4 — Validation full: какие V-* в Phase 4?

### Контекст
Полный каталог validation rules: V-01..V-16 (общие, ~16 правил), V-H-01..V-H-10 (handoff-специфичные, 10 правил), V-MK-01..V-MK-08 (Design module, 8 правил).

Phase 4 должен поставить `/product:validate --deep` с покрытием V-* категорий. V-MK-* зависят от Design module (Phase 6 conditional).

### Варианты
- **A. Phase 4 = V-* + V-H-*; V-MK-* skip с graceful note** ("Design rules will be available after `/design:start`"). Когда Phase 6 активируется, runner расширяется.
- **B. Включить V-MK-* как stub (always-pass с note "not implemented").** Структура runner полная с момента Phase 4. **Минус:** false positive «всё ок» по V-MK правилам.
- **C. Включить V-MK-* как фактически-блокирующие если в FM `has_ui=true`.** Заставит Phase 6 сразу. **Минус:** нарушает «Phase 6 conditional» принцип.

### Моя рекомендация: A
Соответствует уже декларированному «conditional Phase 6». Stub (B) хуже чем skip — даёт ложную уверенность. C ломает roadmap.

**Решение:** ✅ **A — V-* + V-H-*; V-MK-* skip с graceful note.** Зафиксировано в DEC-DEV-0028.

---

# D.5 — Cleanup ↔ cascade --revalidate overlap

### Контекст
См. C.5 выше — это та же проблема под другим углом. Если C.5 закрыто (Hybrid с флагом `--pending-hygiene`), то D.5 фактически уже решён.

### Решение по D.5 = решение по C.5

**Решение:** ✅ **См. C.5.** Зафиксировано в DEC-DEV-0027 (C.5+D.5 как одна тема).

---

# D.6 — Дисциплина языка общения экосистемы (новое)

### Контекст
**Проблема пользователя:** экосистема общается с пользователем на смешанном русско-английском, где английские слова получают русские окончания. Примеры из реальной сессии:
- «Note: не surfaced в DEC-DEV-0023 smoke test (existing HYPs from prior session — frontmatter не re-validated)»
- «CRLF auto-conversion на Windows может cause false drift detection»

Это неудобно для чтения и нарушает естественный поток.

**Где это рождается (проверено):**
- `templates/project/CLAUDE.md.template` — **полностью на английском**, не задаёт language policy для пользовательского проекта вообще.
- Skills в `skills/product/*` (planning-session, feature-session и т. д.) написаны на смешанном русско-английском — Claude генерирует output в том же стиле, что видит в prompts (mirroring).
- Hooks и commands — то же самое.

**Дубликат?** Нет. В существующих планах (ROADMAP, SPEC, backlog v1.1) не находится никаких упоминаний language guidance / локализации. Это пробел.

**Целевое поведение:** Claude общается с пользователем по-русски, без перевода:
- идентификаторов (FM-001, BR-023, V-11, DEC-DEV-NNNN)
- имён файлов / путей / команд / флагов (`/product:feature`, `--dry-run`)
- технических терминов проекта (hook, skill, command, frontmatter, slug, cascade, handoff, smoke test, lint, manifest)
- аббревиатур (NFR, DA, JTBD, PMO, MVP, BG, RPM)
- кодовых фрагментов и YAML-схем
- цитат из английских spec / источников

### Варианты
- **A. Минимум — language secton в CLAUDE.md.template.** Добавить блок «Language style» с явной инструкцией. Малый объём, work for new bootstrap'нутых проектов. **Минус:** существующие skills всё равно содержат смешанный стиль prompts, и Claude может его частично копировать; CLAUDE.md.template одной инструкции может быть недостаточно для override этого mirroring effect.
- **B. A + переписать skills на нормальный русский.** Скиллы (5 из 12 generating user-facing output: planning-session, feature-session, scenario-authoring, business-rule-extraction, release-planning + connector commands plan/feature/da-review). Большой объём (4-8 часов), но root cause. **Минус:** часть spec-references в skills естественно на английском (пути, имена правил) — нужно аккуратно сохранить.
- **C. A + inline language reminder в каждый skill, генерирующий user output.** Короткий блок «User-facing language: Russian per CLAUDE.md» в начале каждого skill. Меньше объёма чем B, но эффективно — Claude видит explicit reminder при загрузке skill.

### Моя рекомендация: A + C
**A** ставит baseline в template (попадает в каждый новый bootstrap). **C** даёт reminder в point-of-use (когда skill активно работает с пользователем). Полный rewrite skills (B) — хороший cleanup, но v1.1 кандидат — ROI лучше после первого реального пилота с уже-fixed CLAUDE.md.template.

**Конкретная реализация:**
1. Секция «Language and tone» в `templates/project/CLAUDE.md.template` (~15 строк) с правилами + примером good/bad.
2. Inline блок «User-facing output: Russian (CLAUDE.md Language section)» в начало 5 user-facing skills.
3. (Опционально) D7 pattern «Language discipline» в `dev/meta-improvement/patterns/` — конвенция для будущих skills.

**Объём:** 1-2 часа всего.

**Решение:** ✅ **A + C — language section в template + inline reminders в 5 user-facing skills.** Полный rewrite skills (B) — кандидат в v1.1. Зафиксировано в DEC-DEV-0029.

---

# D.7 — Release-level DA review (новое)

### Контекст
**Запрос пользователя:** возможность запустить DA на уровне всего release — проверить content по всем FM, входящим в RL-NNN, на корректность и качество. При нахождении конфликта — углубляться в связанные файлы. Полезно для продуктового flow и передачи в разработку.

**Текущая иерархия DA (проверено):**
- **Single-artifact** — hook-driven (BR/IC change → adaptive depth subagent). Phase 3 ✅
- **FM-level** — manual `/product:da-review FM-NNN` (Mode: full). Phase 4 (только что обсуждали в C.3/D.3).
- **Release-level** — **отсутствует.** Ни в `agents/product/devils-advocate.md`, ни в `RL.md`, ни в `release-planning.md`, ни в Phase 4-7 roadmap.

**Дубликат?** Нет. В `handoff-spec.md:110` упоминается «bundle handoff для release» — это release-level **snapshot**, но не review. Cross-FM consistency check сейчас выполняется неявно через `/product:cascade` (V-11 forward references), но это структурная связь, не семантический DA.

**Что должен находить release-level DA (типы конфликтов):**
- Семантические противоречия между FM (например, FM-001 определяет lifecycle X, FM-002 нарушает invariant из FM-001)
- Дублирование functionality между FM (две FM решают тот же JTBD по-разному)
- Покрытие release scope: все ли HYP success metrics покрыты feature'ами в RL-NNN?
- Scope creep на уровне release (FM добавлены в RL без HYP support)
- Зависимости / порядок rollout (FM-002 depends on FM-001, но обе в одном release без явной seq)

### Варианты
- **A. Расширить `/product:da-review` принимать RL-NNN.** Команда детектит prefix (FM-* vs RL-*) → adapter скиллу `product-da-review.md` для release-mode. Subagent получает release-level brief: список FM + связи + decision journal entries по релизу. При нахождении конфликта — выдаёт finding с pointer на конкретные FM/BR/IC + предлагает «углубиться» (открыть FM-level review). Brief shape: добавить в `devils-advocate.md` третий sub-mode «Mode: full + scope: release».
- **B. Отдельная команда `/product:release-review RL-NNN`.** Изолированный workflow. **Минус:** разрастание команд; concept «DA review» дробится на N команд.
- **C. Не делать в Phase 4, отложить в v1.1.** **Минус:** release-level DA нужен именно для тех use cases, что просит пользователь — продуктовый flow и handoff в разработку. Без него bundle handoff (`RL-NNN-handoff.md`) уходит без consistency check.

### Моя рекомендация: A
**Единая команда** для всех уровней DA — proximate principle (ID-prefix routing уже паттерн в экосистеме: `/product:cascade <id>` принимает любой artifact). Brief расширяется на третий tier:

| Mode | Scope | Trigger | Output |
|---|---|---|---|
| `adaptive` | single artifact | hook | per-finding в `.product/.da-findings/`, `source: hook-driven` |
| `full` + `scope: feature` | FM + linked SC/BR/IC/LC/VC | `/product:da-review FM-NNN` | FM-level findings, `source: manual` |
| **`full` + `scope: release`** (новое) | RL + all FM in RL | `/product:da-review RL-NNN` | release-level + drill-down hints, `source: manual`, `scope: release` |

**Декомпозиция при конфликте:** finding содержит `affected_artifacts: [FM-001, FM-002]` + `severity: high` + `suggested_drill_down: /product:da-review FM-001`. User или AI решают, идти ли вглубь.

**Brief design (новое в Phase 4):**
- Заголовок: RL summary + список FM + cross-FM dependency graph
- Секции 6-lens DA адаптируются: «Cross-FM consistency», «Release scope vs HYP coverage», «Rollout dependencies», «Bundle handoff readiness», «Scope creep на уровне release», «Steelmanning release scope»
- Decision journal entries за период от создания RL до текущего момента — feed в context

**Cost:** добавляет ~30-40% к Phase 4 effort (новый scope в `devils-advocate.md`, расширение `product-da-review.md`, secondary command logic). Но это закрывает реальный gap для pilot (без него release-handoff = «прыжок веры»).

### Связь с D.3 / C.3
Если D.7=A, то C.3 уточняется: structured DA findings YAML schema (DEC-DEV-0023 F8) получает поле `scope: artifact|feature|release`. C.3 рекомендация (B + единый каталог) сохраняется, поле `source` дополняется полем `scope`.

### Связь с handoff modes (D.1)
Логично связать: `/product:handoff RL-NNN --mode production` (bundle handoff) в DoR требует release-level DA. Аналог soft-warning из D.3, но на уровне выше.

**Решение:** ✅ **A — расширить `/product:da-review` принимать RL-NNN.** Третий sub-mode `Mode: full + scope: release`. Зафиксировано в DEC-DEV-0026.

---

## Сводная таблица — финал (2026-05-10)

| # | Вопрос | Решение | DEC-DEV |
|---|---|---|---|
| A.3 | HYP frontmatter drift | ✅ A — fix сейчас | DEC-DEV-0024 |
| C.1 | Hash handoff на CRLF | ✅ A — нормализация перед хешем | DEC-DEV-0025 |
| C.2 | NFR sanity strictness | ✅ B — informational warning | DEC-DEV-0025 |
| C.3 | DA brief для manual | ✅ B — separate template + единый каталог с `source` | DEC-DEV-0026 |
| C.4 | Validation runner | ✅ B — hardcode list | DEC-DEV-0025 |
| C.5 | Cleanup + pending | ✅ C — hybrid с флагом `--pending-hygiene` | DEC-DEV-0027 |
| D.1 | Handoff modes | ✅ A — оба режима в Phase 4 | DEC-DEV-0028 |
| D.2 | NFR Ask/Define | ✅ A — обе фазы в Phase 4 | DEC-DEV-0028 |
| D.3 | F.9 trigger | ✅ C — гибрид (manual + `--with-da-review` флаг) | DEC-DEV-0026 |
| D.4 | V-* scope | ✅ A — V-* + V-H-*, V-MK-* skip | DEC-DEV-0028 |
| D.5 | Cleanup vs cascade | ✅ См. C.5 | DEC-DEV-0027 |
| **D.6** | **Язык общения экосистемы** | ✅ **A + C — template + inline reminders в 5 skills** | **DEC-DEV-0029** |
| **D.7** | **Release-level DA review** | ✅ **A — расширить `/product:da-review` принимать RL-NNN** | **DEC-DEV-0026** |

---

## Статус: финализирован 2026-05-10

✅ Все 13 решений приняты пользователем 2026-05-10.
✅ Перенесены в DEV_JOURNAL как DEC-DEV-0024..0029 (6 entries).
✅ [PHASE_4_READINESS.md](PHASE_4_READINESS.md) обновлён — пункты помечены как ✅ с reference на DEC-DEV.
⏳ Файл переименован в `PHASE_4_DECISIONS.md` (без `_DRAFT`) и оставлен в `dev/` как live record до закрытия Phase 4. После closure — архивируется в `dev/_archive/phase-4/`.

**Готовность Phase 4:** все архитектурные и scope-вопросы закрыты. Можно стартовать implementation.
