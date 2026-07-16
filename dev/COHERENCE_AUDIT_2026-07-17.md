# Аудит когерентности репозитория Ecosystem 3.0

> **Дата:** 2026-07-17 · **Ветка:** `docs/seam-handoff-final` · **Статус:** отчёт, правок не вносилось (мандат владельца: «пока мы ищем, не правим»).
> **Что это:** массовый поиск мест, где репозиторий противоречит сам себе, с независимой adversarial-верификацией каждой находки.

---

## 1. Метод

Трёхуровневый прогон, 64 агента (opus на всех стадиях), ~18 минут, read-only.

| Уровень | Что делал |
|---|---|
| **Скауты** (13) | По одному на класс противоречий. Каждая находка обязана нести **две стороны** с дословными цитатами и координатами |
| **Скептики** (51) | По одному независимому на находку. Задача — **опровергнуть**, а не подтвердить. Первым делом — дословная сверка цитат. Правило: **при сомнении → REFUTED** |
| **Синтез** | Главная сессия: дедуп, кластеризация, классификация, системные корни |

**Три класса намеренно исключены из охоты** — репо объявляет их своим штатным контрактом, и без исключения отчёт был бы завален ложными срабатываниями:
- отставание `ROADMAP`/памяти (объявлено by design в `CLAUDE.md` и `dev/INFORMATION-MAP.yaml`);
- историчность `DEV_JOURNAL` (append-only фиксирует прошлое решение, а не спорит с настоящим);
- конфликты, которые объявленная precedence разрешает сама (`код гейта > таблица > текст`).

## 2. Что получилось

| Метрика | Значение |
|---|---|
| Классов просканировано | 13 |
| Сырых находок | 58 |
| После дедупа по координатам | 51 |
| **CONFIRMED** | **34** |
| **PARTIAL** (реально, но слабее заявленного) | **14** |
| REFUTED (скептик опроверг) | 3 |
| **Выдуманных цитат** | **0** |
| Потеряно агентов | 0 |

**Тяжесть:** `critical` — **0** · `high` — 9 · `medium` — 35 · `low` — 4.

**Ноль `critical` — это содержательный результат, а не отсутствие результата.** Ни одно противоречие не ломает поведение прямо сейчас и не обходит принуждение. Репо в существенно лучшей форме, чем пилот, где деплой-чеклисты обещали husky-хук и CI-проверки, которых не существует.

**Ноль выдуманных цитат заслуживает отдельной строки.** Владелец ранее фиксировал: «5 инструментов из 5 соврали на первом проходе». Здесь 51 скептик сверил каждую цитату дословно — подлогов не нашлось ни одного. Скауты, которым явно разрешили вернуть пустой список, врать не стали.

**Типы:** `doc-vs-code` 17 · `stale-reference` 8 · `status-drift` 7 · `count-mismatch` 6 · `enforcement-gap` 3 · `terminology` 3 · `false-claim` 2 · `duplicate-rule` 2.

## 3. Главный вывод: 48 находок — это ~6 фактов

Находки не независимы. Почти все сводятся к **одному системному дефекту**:

> **Волатильный факт скопирован прозой в N мест, и ни один механизм не связывает копии с источником.**

Одно изменение (флип, ретайр, пересуд) обновляет источник и те копии, что автор держал в поле зрения, — остальные тихо остаются лгать. Копии не «устаревают со временем»: они устаревают **в момент коммита**, который их не тронул.

### Кластеры

| Кластер | Что произошло | Находок |
|---|---|---|
| **Флип `lesson-presence-gate` warn→strict** (2026-07-11) | Код и manifest обновлены; ship-default описан прозой ещё в ≥6 местах (`verify.md`, `processes.md`, `self-correction.md`, overlay гида + 2 HTML-зеркала, комментарий внутри самого хука) — все остались на «warn» | 5 |
| **Ретайр skills-floor / DEF-CTX-5** | Долг **закрыт**, `gen-skill-catalog.cjs` построен, класс `[6]` из чекера убран — а `CLAUDE.md` (auto-loaded!) в двух местах описывает и floor как живой, и генератор как «отложенный» | 6 |
| **Пересуд DEC-DEV-0204** (S1/S4 PASS→PARTIAL) | Sweep обновил SSOT-бриф, реестр, журнал, ROADMAP — и не тронул сами планы гейтов, которые держат inline-копию вердикта | 4 |
| **Счётчики команд/хуков** | `check-counts.js` знает только `artifact` и `rule`; счётчики команд и хуков живут непроверяемой прозой | 6 |
| **Конвенция B.1** (inline frontmatter-шаблон) | Нет ни гейта, ни чекера → 2 скилла Product и весь Design-модуль тихо не соответствуют | 5 |
| **Извлечение версии из CHANGELOG** | Правило написано вручную в 4 местах; фикс DEC-DEV-0083 доехал до одного | 2 |

### Ирония, которую стоит прочитать дословно

Формулировка одного из скептиков (`inventory-sync-4`):

> «a gate can verify the inventory but nothing verifies the documentation of the gate's own coverage»
> *(гейт может проверить инвентарь, но ничто не проверяет документацию о покрытии самого гейта)*

И вторая, про `CLAUDE.md` (`deferred-lifecycle-1`):

> «nothing binds CLAUDE.md's prose about enforcement to the enforcement code it narrates, so the one document guaranteed to be read is the one with no gate keeping it true»
> *(единственный документ, который гарантированно прочитают, — единственный, чью правдивость ничто не стережёт)*

Это не риторика: `CLAUDE.md` авто-загружается в каждую сессию, и именно он несёт 6 из 48 находок.

## 4. Диагноз: лекарство уже изобретено, но применено узко

Ключевое — репо **знает** про этот класс дефекта и уже строил от него защиту:

- **DEC-DEV-0197 / D12** — «одно правило записано дважды» → pointer-collapse. Прецедент: §«CHANGELOG vs DEV_JOURNAL» разошёлся с таблицей Process triggers → свёрнут в указатель.
- **Precedence объявлена текстом**, а не порядком строк.
- **Инфраструктура реконсиляции существует** — 5 генераторов с `--check` (`gen-command-catalog`, `gen-skill-catalog`, `gen-ecosystem-map`, `gen-process-map`, `gen-glossary`) + 5 чекеров в цепи `verify` (`check:counts`, `check:inventory`, `check:infomap`, `check:context`, `check:validation-sync`).

**Значит проблема не в отсутствии механизма, а в его покрытии.** Лечение применялось точечно — к тем местам, где боль уже случилась.

Самое показательное — **правило D12 самоограничено**. Его формулировка: precedence действует на «любое другое место **этого файла**». Поэтому копии тех же обязательств в `CONVENTIONS.md` и `checklists/` остались **вне решётки SSOT** — без указателя, без гейта, без кросс-файловой precedence. Скептик (`precedence-dup-1`) зафиксировал это дословно: *«The D12 collapse-to-pointer remedy was applied only within CLAUDE.md (its precedence rule 2 is self-scoped)»*.

Репо сформулировало верный закон и объявило его в одном файле.

## 5. Системные пути решения

Ранжировано по (находок закрыто) / (стоимость). Ни одно не сводится к «починить N мест руками» — точечная правка воспроизведёт дефект через месяц.

| # | Решение | Закрывает | Суть |
|---|---|---|---|
| **S1** | **Расширить `check-counts.js` на все счётчики** | ~6 | Скрипт реализует только kinds `artifact` и `rule`. Добавить `command`, `hook`, `skill`, `agent`, `pattern` — ground truth уже на диске. Инфраструктура готова, нужен охват |
| **S2** | **Link-checker в `npm run verify`** | ~8 | Резолвимость относительных markdown-ссылок **и путей в code-span'ах** (сейчас невидимы для sweep'ов). Exemption для append-only (`DEV_JOURNAL`/`CHANGELOG`/`_archive`) |
| **S3** | **Pointer-collapse вердиктов гейтов** | ~7 | Планы в `dev/gates/*` не должны держать inline-копию вердикта рядом с указателем на его источник. Баннер = указатель. Тот же приём, что уже применён к статус-снапшоту в `CLAUDE.md` |
| **S4** | **Генератор «карты принуждения»** | ~5 | Единственный SSOT режима каждого хука (`strict`/`warn`/`off`) — **извлекать из кода**, как `gen-command-catalog` извлекает из frontmatter. Всё остальное — указатели. Волатильный факт нельзя доверять прозе |
| **S5** | **Снять самоограничение D12** | ~5 | Объявить precedence **кросс-файловой** (не «этого файла»), затем прогнать sweep дублирующихся обязательств в `CONVENTIONS.md` / `checklists/` / module-SPEC'ах |
| **S6** | **Чекер конвенции B.1** | ~5 | Скилл, создающий артефакт из каталога, обязан нести inline-шаблон + anti-pattern-список. Проверяемо машинно: сверка полей шаблона с `docs/pmo/artifacts/<TYPE>.md` |
| **S7** | **Общий хелпер версии CHANGELOG + тест** | 2 | Правило «пропусти `[Unreleased]`» написано вручную в 4 местах. Один хелпер + тест, утверждающий печатаемую версию |

**Мета-правило, которое стоит поднять в канон:** репо уже формулирует его для процессов — *«🔒 = принуждается кодом, а не тоном. Тон (IMPORTANT/MUST/ВСЕГДА) и позиция в файле на исполнение почти не влияют»*. Находки показывают, что к **докам** тот же закон не применён. Правило без гейта — это пожелание, **и для документации тоже**.

Практическая форма: **не описывай код прозой — генерируй описание из кода.** Там, где генератор невозможен, ставь указатель, а не копию. Копия без гейта — обещание соврать при первом же изменении.

## 6. Что скептики отбили (доверие к отчёту)

3 находки опровергнуты — приведены как свидетельство, что верификация работала, а не штамповала:

- **`terminology-4`** — скаут решил, что `docs/MAP.md` отдаёт D6 и Оркестратору, и Интегратору. Опровергнуто: находка держалась на шаге «владение и запуск взаимоисключающи», а репо **явно и намеренно** определяет ось `Integrator/Orchestrator` как «оснащает vs запускает» (SPEC §8.3).
- **`inventory-sync-2`** — скаут смешал два значения перегруженного слова «warn»: 🟡-правило Step 8.5 про **env-даунгрейд** (`LESSON_GATE_MODE=warn`) и пример вывода Step 9. Разные вещи.
- **`status-drift-3`** — цитаты верны, файлы реальны, но находка не пережила столкновения с объявленной топологией репо.

## 7. Оговорки

- **Охват — репо экосистемы**, пилот `my-first-test` в scope не входил.
- **PARTIAL ≠ ложь.** 14 находок реальны, но слабее заявленного скаутом (уже задевают, чем сказано, или верна одна сторона). В реестре ниже они помечены.
- **Cap не сработал** — верифицированы все 51 после дедупа, ничего не отброшено молча.
- **7 дублей отброшено дедупом** по совпадению координат — они перечислены в логах прогона; это пересечения классов, а не потери.
- Отчёт фиксирует состояние на **2026-07-17**, ветка `docs/seam-handoff-final`. Часть находок может быть закрыта параллельной работой.

---

## 8. Реестр находок

Ниже — все 48 подтверждённых (CONFIRMED + PARTIAL), отсортированы по тяжести. Для каждой: обе стороны противоречия с координатами, вердикт скептика и **системный корень** — то, что породило дефект.

### 8.1. Сводная таблица

| # | Sev | ID | Тип | Кратко | Где |
|---|---|---|---|---|---|
| 1 | 🟠 high | `artifact-schema-1` | enforcement-gap | vp-design.md создаёт VP-* вообще без inline frontmatter-шаблона — прямое нар… | `CLAUDE.md` |
| 2 | 🟠 high | `artifact-schema-3` | false-claim | Тело PS: канон требует 5 секций (включая «Why now»), inline-шаблон скилла да… | `docs/pmo/artifacts/PS.md` |
| 3 | 🟠 high | `changelog-vs-delivery-1` | doc-vs-code | install.sh / install.ps1 всегда рапортуют «version Unreleased» — читают перв… | `install.sh` |
| 4 | 🟠 high | `deferred-lifecycle-1` | doc-vs-code | CLAUDE.md объявляет DEF-CTX-5 «отложенной» — файл, на который она же ссылает… | `CLAUDE.md` |
| 5 | 🟠 high | `deferred-lifecycle-2` | status-drift | Смоук-план PATCH 1.3.3 держит S1 = PASS, хотя цитируемый им же SSOT вердикто… | `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md` |
| 6 | 🟠 high | `enforcement-claims-2` | doc-vs-code | skills/ecosystem/self-correction.md обещает «warn по умолчанию — напоминает»… | `hooks/product/lesson-presence-gate.js` |
| 7 | 🟠 high | `gate-code-vs-doc-1` | doc-vs-code | CLAUDE.md объявляет DEF-CTX-5 отложенным и описывает skills-floor как живой … | `CLAUDE.md` |
| 8 | 🟠 high | `inventory-sync-1` | doc-vs-code | verify.md Step 8.5 declares warn-mode PreToolUse «expected, not a defect» — … | `commands/ecosystem/verify.md` |
| 9 | 🟠 high | `status-drift-2` | status-drift | Гейт PATCH_1.3.3 объявляет S1 PASS, а его же цитируемый источник вердиктов —… | `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md` |
| 10 | 🟡 medium | `artifact-schema-2` | doc-vs-code | design-session.md конструирует NM-frontmatter без обязательного `confidence`… | `docs/pmo/artifacts/NM.md` |
| 11 | 🟡 medium | `artifact-schema-4` | enforcement-gap | segment-discovery.md: шаблон SEG обрывается многоточием и не несёт ни одного… | `CLAUDE.md` |
| 12 | 🟡 medium | `artifact-schema-5` | enforcement-gap | design-session.md: MK-frontmatter сконструирован без `title` — и ни один ски… | `docs/pmo/artifacts/MK.md` |
| 13 | 🟡 medium | `changelog-vs-delivery-4` | duplicate-rule | bootstrap и update штампуют одно и то же поле `ecosystem_version` по расходя… | `commands/ecosystem/bootstrap.md` |
| 14 | 🟡 medium | `counts-1` | count-mismatch | docs/product-module/SPEC.md противоречит само себе: 23 команды vs 22 команды | `docs/product-module/SPEC.md` |
| 15 | 🟡 medium | `counts-2` | count-mismatch | docs/product-module/SPEC.md: «12 hooks» против 13 хуков в manifest.yaml, кот… | `docs/product-module/SPEC.md` |
| 16 | 🟡 medium | `counts-3` | count-mismatch | Гид противоречит собственному сгенерированному каталогу команд: 43 vs 51 | `docs/guide/01-first-session.md` |
| 17 | 🟡 medium | `counts-4` | count-mismatch | README.md занижает число integrator-команд: 9 против фактических 13 | `README.md` |
| 18 | 🟡 medium | `counts-5` | count-mismatch | docs/integrator-module/SPEC.md: «12 команд» против фактических 13 — включая … | `docs/integrator-module/SPEC.md` |
| 19 | 🟡 medium | `deferred-lifecycle-3` | doc-vs-code | CLAUDE.md приписывает `check-inventory-sync.cjs` проверку floor'ов скиллов —… | `CLAUDE.md` |
| 20 | 🟡 medium | `deferred-lifecycle-4` | status-drift | Смоук-план Phase 6 держит S4 = PASS, хотя пересуд DEC-DEV-0204 понизил его д… | `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md` |
| 21 | 🟡 medium | `deferred-lifecycle-5` | status-drift | Долговой реестр Phase 4 требует создать D7-паттерн, который создан 5 недель … | `dev/tech-debt/PHASE_4.md` |
| 22 | 🟡 medium | `enforcement-claims-3` | doc-vs-code | docs/pmo/processes.md держит presence-gate как «Ships warn (pending S-LE liv… | `hooks/product/manifest.yaml` |
| 23 | 🟡 medium | `enforcement-claims-4` | doc-vs-code | Оверлей гида объявляет warn дефолтом и предлагает «обойти» гейт установкой з… | `hooks/product/lesson-presence-gate.js` |
| 24 | 🟡 medium | `gate-code-vs-doc-2` | doc-vs-code | Сноска CLAUDE.md приписывает check-inventory-sync.cjs проверку floor'ов скил… | `CLAUDE.md` |
| 25 | 🟡 medium | `inventory-sync-4` | doc-vs-code | CLAUDE.md claims check-inventory-sync.cjs verifies skills floors — that clas… | `CLAUDE.md` |
| 26 | 🟡 medium | `inventory-sync-5` | status-drift | Live ACTIVE seam queues DEF-CTX-5 as remaining work — it was fixed the day b… | `dev/semantic-continuity/SEAM.md` |
| 27 | 🟡 medium | `precedence-dup-1` | duplicate-rule | Accumulation contract: CONVENTIONS §11.1 requires CHANGELOG for EVERY merged… | `dev/meta-improvement/CONVENTIONS.md` |
| 28 | 🟡 medium | `precedence-dup-2` | stale-reference | memory-sync activation: CONVENTIONS §4 says «Manual (user types invocation)»… | `dev/meta-improvement/CONVENTIONS.md` |
| 29 | 🟡 medium | `precedence-dup-3` | doc-vs-code | Consumer-zone definition in the CLAUDE.md table is narrower than the definit… | `CLAUDE.md` |
| 30 | 🟡 medium | `precedence-dup-4` | count-mismatch | Pattern library inventory recorded twice inside CONVENTIONS.md and diverges:… | `dev/meta-improvement/CONVENTIONS.md` |
| 31 | 🟡 medium | `spec-vs-impl-1` | doc-vs-code | Integrator SPEC каталог обещает команду /integrator:replace, которой в поста… | `docs/integrator-module/SPEC.md` |
| 32 | 🟡 medium | `spec-vs-impl-2` | status-drift | Product SPEC объявляет Deep mode отложенным до v1.1, хотя он построен и полн… | `docs/product-module/SPEC.md` |
| 33 | 🟡 medium | `spec-vs-impl-3` | doc-vs-code | Design SPEC числит html-fallback.md в «Future skills», хотя скилл построен и… | `docs/design-module/SPEC.md` |
| 34 | 🟡 medium | `spec-vs-impl-4` | doc-vs-code | Product SPEC §4.5 числит в Skills Library два Deep-research скилла, которых … | `docs/product-module/SPEC.md` |
| 35 | 🟡 medium | `spec-vs-impl-5` | doc-vs-code | Команда /integrator:provision поставлена и ссылается на группу каталога SPEC… | `commands/integrator/provision.md` |
| 36 | 🟡 medium | `stale-refs-1` | stale-reference | Живой D7-гайд Session Audit ссылается на инженерный дизайн, уехавший в _arch… | `dev/meta-improvement/SESSION_AUDIT_GUIDE.md` |
| 37 | 🟡 medium | `stale-refs-3` | stale-reference | SPEC интегратора разрешает открытый вопрос ссылкой на readiness-файл, которо… | `docs/integrator-module/SPEC.md` |
| 38 | 🟡 medium | `stale-refs-4` | stale-reference | README каталога audit-reports ссылается на команду через несуществующую дире… | `dev/meta-improvement/audit-reports/README.md` |
| 39 | 🟡 medium | `stale-refs-5` | stale-reference | В consumer-zone команде ссылка «See also» указывает не на тот файл (label ≠ … | `commands/ecosystem/enable-d7-audit.md` |
| 40 | 🟡 medium | `status-drift-1` | status-drift | Гейт PHASE_6 объявляет S4 PASS, а его же цитируемый источник вердиктов — S4 … | `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md` |
| 41 | 🟡 medium | `terminology-1` | terminology | Глоссарий сам себе противоречит в раскладке доменов D1–D6 (сдвиг на единицу … | `docs/guide/03-glossary.md` |
| 42 | 🟡 medium | `terminology-2` | terminology | Глоссарий объявляет D6 и D7 одним слоем под двумя именами — ровно то отождес… | `docs/guide/03-glossary.md` |
| 43 | 🟡 medium | `terminology-3` | false-claim | Зона делегирования во внешние инструменты объявлена как D3-D6, но SSOT переч… | `README.md` |
| 44 | 🟡 medium | `terminology-5` | stale-reference | pmo-map отправляет детальную декомпозицию D6 в dev/meta-improvement/ — дом D… | `docs/pmo/pmo-map.md` |
| 45 | ⚪ low | `changelog-vs-delivery-5` | terminology | CONVENTIONS §11.1 объявляет словарь секций `Added \| Fixed \| Modified`, а CHA… | `dev/meta-improvement/CONVENTIONS.md` |
| 46 | ⚪ low | `gate-code-vs-doc-5` | doc-vs-code | Комментарий в lesson-presence-gate.js называет warn дефолтом — код дефолтит … | `hooks/product/lesson-presence-gate.js` |
| 47 | ⚪ low | `precedence-dup-5` | stale-reference | INFORMATION-MAP routes «Когда CHANGELOG vs DEV_JOURNAL?» to a section that e… | `dev/INFORMATION-MAP.yaml` |
| 48 | ⚪ low | `stale-refs-2` | stale-reference | D7-паттерн smoke-test-plan ссылается на reference-инстанс, уехавший в _archi… | `dev/meta-improvement/patterns/smoke-test-plan.md` |

### 8.2. Детали

---

#### 1. 🟠 `artifact-schema-1` — vp-design.md создаёт VP-* вообще без inline frontmatter-шаблона — прямое нарушение собственной конвенции B.1 / DEC-DEV-0012

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** enforcement-gap · **Класс:** artifact-schema

**Противоречие:** CLAUDE.md обязывает КАЖДЫЙ скилл, создающий артефакт из каталога docs/pmo/artifacts/, нести explicit frontmatter template «не только reference на artifact spec». VP.md — канонический тип каталога (docs/pmo/artifacts/README.md:32 «VP-* | Value Proposition | 🟠 Strategic | 1 per SEG»), а vp-design.md явно объявляет себя его создателем (строка 2: «Produces VP-* artifacts»; строка 15: «Per active SEG create `.product/value-propositions/VP-00N-*.md`»). При этом весь скилл не содержит НИ ОДНОГО YAML-блока с полями VP — на месте шаблона стоит одна строка прозы «Frontmatter populated». Репо-широкий grep `type: value-proposition` даёт только копии самого канона в docs/ и .claude/worktrees/  […]

**Сторона A** — `CLAUDE.md:251`
> Каждый skill, создающий артефакт типа из каталога `docs/pmo/artifacts/`, **обязан содержать explicit frontmatter template** в теле skill (не только reference на artifact spec). Template должен:

**Сторона B** — `skills/product/vp-design.md:134`
> - Frontmatter populated

**Почему важно:** Это буквальное воспроизведение дефекта, ради которого конвенция и заводилась: PS-drift DEC-DEV-0011 случился именно потому, что скилл только ссылался на спеку. VP несёт поле `segment: SEG-<NNN>` («обязательная 1:1 связь», VP.md:20) — ровно тот класс поля, который AI переименовывает в `seg`/`linked_segment`/`segment_id` «для естественности». Дрейф в VP каскадит: HYP.value_proposition и FM.value_proposition ссылаются на VP, а validation-правила V-* резолвят ссылки по каноническим именам. […]

**Вывод скептика:** Противоречие реально и ровно такое, как заявлено. CLAUDE.md:251 — не декоративная, а действующая конвенция: применена в 15 скиллах, активно цитируется паттерном B.1, имеет чеклист (267-271) и явно переприбитый scope (265). vp-design.md попадает в scope без натяжек: каталожный тип (README.md:32), самообъявленное авторство (строка 2 «Produces VP-* artifacts»), явная запись файла (строка 15). И вместо шаблона весь скилл несёт одну строку прозы «Frontmatter populated» — буквально ту формулировку, которую паттерн b1:116 называет доказанно недостаточной («Just reference artifact spec — DEC-DEV-0011 proved this insufficient»). […]

**Что пробовали для опровержения:** Прогнал семь гипотез опровержения, все провалились. (1) Разный scope — снята: CLAUDE.md:265 специально переприбил scope к свойству «создаёт артефакт», а vp-design.md сам объявляет себя создателем (строка 2 + строка 15), VP-* — канонический тип каталога (README.md:32); исключения нет и в паттерне — «NOT applicable» (17-18) покрывает только НЕ-создающие скиллы и freeform-контент. (2) Контракт отставания  […]

**🔧 Системный корень:** У конвенции B.1 нет ни гейта, ни warn-хука, ни машинного сверщика (генератор-каталог есть у команд — `gen-command-catalog.cjs`, у скиллов его нет: известный долг DEF-CTX-5), поэтому скилл, написанный ДО её кодификации, никогда не был ретрофитнут, а ручной «cross-check» соблюдения записал в журнал ложное «все имели explicit frontmatter examples».

---

#### 2. 🟠 `artifact-schema-3` — Тело PS: канон требует 5 секций (включая «Why now»), inline-шаблон скилла даёт 6 других — и при этом объявляет себя «per PS.md artifact spec»

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** false-claim · **Класс:** artifact-schema

**Противоречие:** PS.md §Body Structure объявляет обязательными ровно пять секций: «1. **Problem.** ... 2. **Context.** ... 3. **Current alternatives.** ... 4. **Consequences.** ... 5. **Why now.**» (строки 33-37), и собственный «Good»-пример канона следует им же («## Problem» строка 96, «## Context» строка 100). problem-discovery.md заявляет соответствие — «**Body structure** (per PS.md artifact spec):» — но выдаёт шесть ДРУГИХ заголовков: «## Кто страдает», «## В чём боль», «## Масштаб и частота», «## Как справляются сейчас», «## Почему это важно», «## Что мы хотим изменить» (строки 86-102). Пересечение неполное и не 1:1: канонический «Why now» (тренды/технологии/изменения в аудитории  […]

**Сторона A** — `docs/pmo/artifacts/PS.md:37`
> 5. **Why now.** Почему решать именно сейчас — тренды, технологии, изменения в аудитории.

**Сторона B** — `skills/product/problem-discovery.md:81`
> **Body structure** (per PS.md artifact spec):

**Почему важно:** PS — корневой артефакт («изменение PS означает потенциальный pivot», PS.md:11), а problem-discovery.md — объявленная reference implementation конвенции B.1 (b1-frontmatter-convention.md:91, CLAUDE.md:259). Эталон, расходящийся с каноном в теле артефакта, тиражирует расхождение: пилот уже собран по версии скилла, значит «обязательная» секция канона Why now не производится никогда — правило мёртвое. Ложная атрибуция «(per PS.md artifact spec)»  […]

**Вывод скептика:** Противоречие реально, верифицировано лично на обеих сторонах и не опровергается ни одной из семи гипотез. Ядро находки — ровно то, что заявил скаут, и заявлено точно: канон объявляет пять обязательных секций тела PS, скилл под вывеской «per PS.md artifact spec» выдаёт шесть других, канонический «Why now» не производится нигде, а «Что мы хотим изменить» канону неизвестен. Решающим оказался README каталога: попытка развести стороны по «ЧТО vs КАК» — единственный реальный шанс на REFUTED — разбилась о строку 10, где «его структура» прямо названа зоной каталога. Скилл не дополняет канон в своей зоне, он переопределяет канон в чужой, утверждая при этом соответствие. […]

**Что пробовали для опровержения:** Прогнал все гипотезы опровержения; ни одна не сработала, две дали обратный эффект. 1) РАЗНЫЙ SCOPE (канон = «ЧТО», скилл = «КАК») — самая сильная гипотеза, проверил первой и она ПРОВАЛИЛАСЬ, причём в минус находке. docs/pmo/artifacts/README.md:5 — «**Принцип:** декларативные правила здесь, процессуальные — в skills»; README:10 — «Каталог описывает **ЧТО** такое каждый артефакт: **его структура**, правила содержимого, связи, жизненный цикл. […]

**🔧 Системный корень:** Структура тела артефакта описана в двух местах (канон-каталог и inline-шаблон скилла) без SSOT-указателя и без валидатора секций тела PS — при том что для frontmatter защита была построена (конвенция B.1 после DEC-DEV-0011), а для handoff/LESSON body-section checks существуют,  […]

---

#### 3. 🟠 `changelog-vs-delivery-1` — install.sh / install.ps1 всегда рапортуют «version Unreleased» — читают первый `## [` заголовок, не пропуская [Unreleased]

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** doc-vs-code · **Класс:** changelog-vs-delivery

**Противоречие:** update.md явно предписывает читать версию из CHANGELOG, ПРОПУСКАЯ `## [Unreleased]` («the first `## [X.Y.Z]` heading, skipping `## [Unreleased]`»). Оба install-скрипта делают ровно обратное: берут ПЕРВЫЙ `## [` заголовок (`grep -m1 '^## \['` / `Select-Object -First 1`), а первый заголовок в CHANGELOG.md — это всегда `## [Unreleased]`. Проверено эмпирически: прогон извлечения install.sh против CHANGELOG на origin/main возвращает строку `Unreleased`. […]

**Сторона A** — `install.sh:76`
> VERSION=$(grep -m1 '^## \[' "$ECOSYSTEM_DIR/CHANGELOG.md" 2>/dev/null | sed -E 's/^## \[([^]]+)\].*/\1/' || echo "unknown")

**Сторона B** — `commands/ecosystem/update.md:732`
> Read the first released version from the just-synced `.claude/CHANGELOG.md` (the first `## [X.Y.Z]` heading, skipping `## [Unreleased]`) and surgically replace the `ecosystem_version:` value.

**Почему важно:** Version reporting — единственный сигнал пользователю о том, что он поставил. Сейчас он мёртв: всегда «Unreleased» вместо 1.12.0. Тот же дефект в install.ps1:96 (`Select-Object -First 1` по тому же паттерну) — т.е. сломаны обе платформы. Правило в update.md доказывает, что «пропускать [Unreleased]» — осознанный контракт репо, а не вкусовщина: там же указана его цель (version-drift check). Install-скрипты — root consumer-zone, первое, что видит новый пользователь.

**Вывод скептика:** Every leg of the scout's claim verified by direct observation. Both quotes are exact at the stated coordinates. The behaviour is reproduced, not argued: install.sh's `grep -m1 '^## \['` matches CHANGELOG.md:9 (`## [Unreleased]`) and yields the literal string `Unreleased` on both the working tree and origin/main, where the actual delivered version is 1.12.0. install.ps1:96 has the identical defect via `Select-Object -First 1` on the same unanchored pattern, so both platforms print `Ecosystem 3.0 installed globally (version Unreleased).` on every install. The `[Unreleased]` heading is structurally guaranteed to be first  […]

**Что пробовали для опровержения:** Ran six refutation hypotheses. (1) DIFFERENT SCOPE — this bites partially and was my most promising line: update.md §5c legislates the `ecosystem_version:` stamp in a project's product.yaml, not install.sh's console output, so update.md does not literally *govern* install.sh and the two are not two conflicting *rules*. But the scout never claimed it did  […]

**🔧 Системный корень:** CHANGELOG version extraction is hand-rolled independently at four sites (install.sh:76, install.ps1:96, bootstrap.md:785 prose, update.md:736) with no shared helper and no test asserting the printed version, so the correct `[0-9]+\.[0-9]+\.[0-9]+` anchoring produced by the DEC-DEV-0083 audit landed only in the one file that audit touched and never propagated to the other three.

---

#### 4. 🟠 `deferred-lifecycle-1` — CLAUDE.md объявляет DEF-CTX-5 «отложенной» — файл, на который она же ссылается, держит его `[FIXED]`

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** doc-vs-code · **Класс:** deferred-lifecycle

**Противоречие:** Сноска harness-контракта в auto-loaded CLAUDE.md утверждает, что сильная форма проверки скиллов (генератор каталога) ОТЛОЖЕНА, и даёт координату долга. Ровно по этой координате долг помечен `[FIXED]` (закрыт 2026-07-13, DEC-DEV-0198): генератор `gen-skill-catalog.cjs` построен, `gen:skills:check` в цепи verify, floor-затычка заменена на derived-by-name проверку. Указатель ведёт на собственное опровержение.

**Сторона A** — `CLAUDE.md:72`
> Сильная форма — генератор каталога скиллов, как `gen-command-catalog.cjs` у команд — отложена: `dev/tech-debt/CONTEXT_AUDIT_D6.md` **DEF-CTX-5**.

**Сторона B** — `dev/tech-debt/CONTEXT_AUDIT_D6.md:122`
> ### DEF-CTX-5 — `[FIXED]` нет генератора каталога скиллов: пронг Row 5 «скилл» держится на floor'е, а не на инвентаре

**Почему важно:** CLAUDE.md — единственный always-on операционный индекс. Он описывает несуществующий уже механизм («floor держится, swap проходит молча») как действующий и числит закрытый долг открытым: планирование пойдёт от ложной картины принуждения, а долг — кандидат на повторное исполнение. Подтверждается третьей стороной: `commands/ecosystem/verify.md:81` «**Note (skills — DEF-CTX-5, closed):** … The floor and its `check-inventory-sync` class are gone».

**Вывод скептика:** The always-on operational index makes three claims at lines 69/72 that the code refutes: (a) "verify.md Step 4 держит floor `.claude/skills/**/*.md`" — the floor and its Step 9 echo were deleted; (b) "swap/переименование с сохранением числа проходит молча" — swap/rename is now caught at item granularity by gen:skills:check, blocking in npm run verify; (c) "Сильная форма … отложена: DEF-CTX-5" — the generator was built 2026-07-13 and the debt marked FIXED. The pointer literally leads to its own refutation. Notably the fix author was aware of exactly this hazard: check-inventory-sync.cjs:28-29 says "Two mechanisms for one obligation is how the divergence in CLAUDE.md's own tables started; […]

**Что пробовали для опровержения:** Ran five hypotheses, all fail. (1) DIFFERENT SCOPE — no: both sides name the identical object (DEF-CTX-5, the skills prong of Row 5, the verify.md Step 4 floor, a gen-command-catalog.cjs-shaped generator). Zero scope daylight. (2) DECLARED LAG CONTRACT — no: the repo's lag contract covers ROADMAP and memory as by-design lagging snapshots; CLAUDE.md is the always-on harness contract, explicitly not in that class. (3) HISTORICAL/ARCHIVAL SIDE  […]

**🔧 Системный корень:** The DEF-CTX-5 fix swept every file that *implements* the mechanism (verify.md, check-inventory-sync.cjs, package.json, docs/guide, and the debt register itself) but not the auto-loaded CLAUDE.md footnote that *describes* it — because nothing binds CLAUDE.md's prose about enforcement to the enforcement code it narrates, so the one document guaranteed to be read is the one with no gate keeping it true.

---

#### 5. 🟠 `deferred-lifecycle-2` — Смоук-план PATCH 1.3.3 держит S1 = PASS, хотя цитируемый им же SSOT вердиктов понизил S1 до PARTIAL (DEC-DEV-0204)

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** status-drift · **Класс:** deferred-lifecycle

**Противоречие:** Пер-сценарная таблица плана (его собственный вердикт-реестр) объявляет S1 «✅ PASS 2026-07-11»; баннер выше — «S1/S3 PASS». Но брифа §Outcome, на который план ссылается как на источник вердиктов судьи, после независимого пересуда DEC-DEV-0204 держит S1 = PARTIAL («было PASS»). Коммит 3f477c2 обновил CLAUDE.md/ROADMAP/CHANGELOG/DEV_JOURNAL/бриф — и не тронул сами планы гейтов.

**Сторона A** — `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md:15`
> | S1 — research per-tier + approve gate | ✅ PASS 2026-07-11 | silent-ignore 3.5 мин — ждала; defer — кэш DEFERRED, без chain; «1» — decision без авто-add |

**Сторона B** — `dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md:191`
> - **PATCH_1.3.3: S1 PARTIAL** *(было PASS; понижен пересудом 0204 — per-tier-таблица research не подтверждена evidence)*

**Почему важно:** План гейта — объявленный SSOT смоук-догонов (см. таблицу указателей кампании). Читатель плана видит «S1 валиден» и не заводит догон по неподтверждённому критерию per-tier-таблицы research. CLAUDE.md:27 при этом уже говорит «S1 PARTIAL — понижен независимым пересудом DEC-DEV-0204». На origin/main дефект жив и обострён: шапка плана переписана в «S1 PARTIAL», а баннер и таблица ниже по-прежнему говорят PASS — файл противоречит сам себе.

**Вывод скептика:** The contradiction is real, live, and I opened both sides myself. The 0204 re-judgment propagated to every consumer of the verdicts (CLAUDE.md, ROADMAP, CHANGELOG, DEV_JOURNAL, the brief itself, SEAM.md) but not to the two gate plans that hold their own inline copies of those same verdicts — grep proves neither plan mentions 0204 at all, and git proves 3f477c2 never touched them. The plans are active documents (registered as open gates), not archive, so no historical-record exemption applies; and no declared lag contract covers them. […]

**Что пробовали для опровержения:** I ran five refutation hypotheses and all failed. (1) DIFFERENT SCOPE — refuted: both sides address the identical object, S1 of PATCH_1.3.3, not adjacent rules or differing conditions. (2) DECLARED LAG CONTRACT — refuted: CLAUDE.md and dev/INFORMATION-MAP.yaml declare only ROADMAP and memory as lagging-by-design snapshots; a gate plan in dev/gates/ is nowhere declared a laggard. […]

**🔧 Системный корень:** The judge's verdicts are duplicated inline into each gate plan's status banner and table instead of being pointer-collapsed to the brief §Outcome that the plans themselves cite as the source, and nothing binds the copies to the source  […]

---

#### 6. 🟠 `enforcement-claims-2` — skills/ecosystem/self-correction.md обещает «warn по умолчанию — напоминает», хотя хук по умолчанию отказывает в вызове инструмента

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** doc-vs-code · **Класс:** enforcement-claims

**Противоречие:** Скилл — заявленный «synced home of the self-correction mandate», который гарантирует существующим инсталляциям доставку триггера. В секции «Enforcement (что произойдёт, если оставить open)» он утверждает, что presence-gate «**warn** по умолчанию» и лишь «напоминает каждый ход». Фактически при непрослеенном `LESSON_GATE_MODE` код берёт ветку `mode === 'strict'` (строка 231) и пишет `denyJSON` (строка 236) — Write/Edit/Bash/NotebookEdit получают `permissionDecision: "deny"`. Разница не косметическая: «напоминает» и «отказывает в вызове» — противоположные контракты, и именно эта строка отвечает на вопрос «что произойдёт».

**Сторона A** — `hooks/product/lesson-presence-gate.js:236`
> process.stdout.write(denyJSON(ids));

**Сторона B** — `skills/ecosystem/self-correction.md:36`
> - `lesson-presence-gate.js` (PreToolUse + UserPromptSubmit, **warn** по умолчанию) напоминает каждый ход.

**Почему важно:** Consumer-zone скилл, лениво подгружаемый как источник правды о механизме. Читатель (человек или ИИ) заключит, что открытый LESSON-* работу не остановит, и не поймёт внезапный отказ Write/Edit как штатное поведение гейта — классическая диагностика «сломался харнесс» вместо «сработал гейт» (ровно тот сценарий, против которого заведён паттерн config-failure-first-triage).

**Вывод скептика:** The claim is factually inverted about a live blocking gate. With LESSON_GATE_MODE unset, line 201 resolves mode to 'strict', line 231 takes the strict branch, and line 236 emits permissionDecision:"deny" for Write/Edit/Bash/NotebookEdit (subject only to two carve-outs: a fresh lesson-in-progress marker, or a mutation targeting lesson-resolution instruments). In the ordinary case the scout describes — open LESSON, no fresh marker, ordinary target — the tool call is DENIED, not "reminded". "Напоминает каждый ход" and "отказывает в вызове" are opposite contracts, and line 36 sits under the header that promises to answer precisely "what will happen if you leave it open". […]

**Что пробовали для опровержения:** Ran six refutation hypotheses; all failed. (1) DIFFERENT SCOPE — refuted-the-refutation: line 35 covers lesson-gate.js (Stop, strict) and is CORRECT; line 36 covers lesson-presence-gate.js (PreToolUse+UserPromptSubmit), which is exactly the file in Side A. Same hook, same default, direct collision. (2) DECLARED LAG CONTRACT (ROADMAP/memory lag by design)  […]

**🔧 Системный корень:** The hook's default mode is asserted in prose in at least four independent places (hook header, hook inline comment, manifest description, skill, processes.md) with no generator or checker binding any assertion to the code's actual default, so the owner's warn→strict flip updated only the carriers he happened to hold in view — including the status docs that are explicitly allowed to lag  […]

---

#### 7. 🟠 `gate-code-vs-doc-1` — CLAUDE.md объявляет DEF-CTX-5 отложенным и описывает skills-floor как живой механизм — код класс [6] ретайрнул, генератор построен, долг FIXED

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** doc-vs-code · **Класс:** gate-code-vs-doc

**Противоречие:** Сноска CLAUDE.md (auto-loaded harness-контракт) утверждает: (а) `verify.md` Step 4 держит floor `.claude/skills/**/*.md`, (б) swap/переименование скилла «проходит молча», (в) сильная форма — генератор каталога скиллов — «отложена» под DEF-CTX-5. Код говорит обратное по всем трём пунктам: класс [6] SKILL-FLOOR RETIRED, DEF-CTX-5 closed, `gen-skill-catalog.cjs` существует и гейтится `gen:skills:check` (blocking, в `npm run verify`) на ITEM-гранулярности — т.е. rename ловится по ИМЕНИ. verify.md:81-86 подтверждает: «The floor and its `check-inventory-sync` class are gone». dev/tech-debt/CONTEXT_AUDIT_D6.md:122 помечает DEF-CTX-5 `[FIXED]`; dev/plans/PROD_READINESS_CAMPAIGN.md:82 — A6 ✅. […]

**Сторона A** — `CLAUDE.md:72`
> - **Скиллы — пронг наполнен, но проверка слабая (осознанно).** `verify.md` Step 4 держит floor `` `.claude/skills/**/*.md` `` (машинно равен живому `skills/**/*.md`, тихо дрейфовать не может: добавил/убрал скилл ⇒ красный `verify`). Но **swap/переименование с сохранением числа проходит молча**. […]

**Сторона B** — `dev/meta-improvement/scripts/check-inventory-sync.cjs:22`
> * ── RETIRED: [6] SKILL-FLOOR (DEF-CTX-5 closed) ──

**Почему важно:** Объявленная precedence репо гласит «прав КОД, таблица = баг». Сноска — часть always-on контекста: разработчик читает её и делает ЛОЖНЫЕ выводы о принуждении. (1) Верит, что rename скилла проходит молча ⇒ не проверит — хотя `gen:skills:check` его поймает и уронит verify (лишний шок либо, наоборот, недоверие к зелёному). (2) Верит, что DEF-CTX-5 открыт ⇒ может заново строить уже построенный генератор (дубль-механизм  […]

**Вывод скептика:** The finding stands on all three sub-claims, each independently falsified by code I executed: (а) "verify.md Step 4 держит floor `.claude/skills/**/*.md`" — FALSE. verify.md:81-86 says the floor and its check-inventory-sync class "are gone"; the checker reports 2 floors, both runtime dirs. (б) "swap/переименование с сохранением числа проходит молча" — FALSE, and inverted. `gen:skills:check` gates docs/guide/08-skills.md at ITEM granularity, carrying skill *names*. A rename (delete+add) now fails verify. The footnote tells the reader a caught case passes silently. (в) "генератор… — отложена: DEF-CTX-5" — FALSE. […]

**Что пробовали для опровержения:** I ran six refutation hypotheses and every one failed: (1) DIFFERENT SCOPE — could the footnote describe some other floor/prong? No. Both sides name the identical object: the «скилл» prong of Row 5, the same floor glob, the same DEF-CTX-5 ID. The code comment at :22-31 explicitly narrates the deletion of the very floor the footnote describes as live. (2) DECLARED LAG CONTRACT — CLAUDE.md is not ROADMAP/memory. […]

**🔧 Системный корень:** The retirement commit (db6d23d) updated every artifact that *implements* the mechanism — the checker, verify.md, and the DEF-CTX-5 tech-debt entry — but nothing binds the auto-loaded CLAUDE.md footnote that *describes* that mechanism to the code it describes, so the description of a deleted floor survives with no gate, no warn-hook, and no spec-drift-sweep to catch it.

---

#### 8. 🟠 `inventory-sync-1` — verify.md Step 8.5 declares warn-mode PreToolUse «expected, not a defect» — the code ships that gate STRICT by default

**Вердикт:** PARTIAL · **Тяжесть:** high · **Тип:** doc-vs-code · **Класс:** inventory-sync · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** verify.md's Step 8.5 caveat instructs the verifier to treat the LESSON presence-gate running in warn mode as the expected ship default and to «Flag only the Stop prong being non-strict». The gate's own code defaults to strict (env unset ⇒ 'strict'), and warn is now an explicit DOWNGRADE of the deny contract. The caveat's premise («until the S-LE live smoke confirms the deny contract») is also dead: S-LE closed 2026-07-11 and the warn→strict flip was executed. Result: /ecosystem:verify is instructed to green-light exactly the degraded state that Step 8.5 exists to catch — its stated purpose is «So an unenforced-but-believed-enforced gate cannot pass silently.»

**Сторона A** — `commands/ecosystem/verify.md:189`
> (Per "Strict Stop, warn PreToolUse" ship default: PreToolUse in warn mode is **expected**, not a defect — it nags rather than denies until the S-LE live smoke confirms the deny contract. Flag only the Stop prong being non-strict, or hooks missing entirely.)

**Сторона B** — `hooks/product/lesson-presence-gate.js:201`
> const mode = (process.env.LESSON_GATE_MODE || 'strict').toLowerCase();

**Почему важно:** Per repo canon the code is the authority and the prose is the bug. A real install with LESSON_GATE_MODE=warn — a genuine downgrade of the non-deferrability guarantee — is reported by verify as expected/healthy. This is the «unenforced-but-believed-enforced gate passing silently» class inverted into the checker itself, and check-inventory-sync.cjs cannot catch it: class [5] HOOK-CLAIM only verifies that the hook is declared for the event in manifest.yaml, never the mode semantics.

**Вывод скептика:** The contradiction is real and I could not refute it: verify.md:189 asserts, as live instruction to every /ecosystem:verify run, a ship default ("Strict Stop, warn PreToolUse" — PreToolUse "nags rather than denies") that the shipped code contradicts at line 201 and explicitly declares superseded in its own docblock. Its premise is provably dead: S-LE closed 2026-07-11, the re-run PASSed, the warn→strict flip executed (4cfffae), and the checklist was archived — so "until the S-LE live smoke confirms the deny contract" waits on an event that already happened. […]

**Что пробовали для опровержения:** Six hypotheses, all failed on the core claim: (1) EFFECTIVE-DEFAULT-IS-WARN — my strongest hypothesis: if the shipped template set LESSON_GATE_MODE=warn, the caveat would be right and the code default irrelevant. Checked .env.template (no LESSON entry at all) and settings.json.template (env block empty, hooks auto-registered by bootstrap Step 6b). Env unset ⇒ 'strict'. REFUTED. (2) DIFFERENT SCOPE / separate vars per prong  […]

**🔧 Системный корень:** The hook's ship-default was hand-copied as prose into ≥6 non-generated places (verify.md, processes.md, three guide artifacts, an in-file comment) with no generator or gate binding them to the one line of code that decides it, so the 2026-07-11 flip updated only the code, its manifest and the status docs while every other copy silently kept asserting the superseded default.

---

#### 9. 🟠 `status-drift-2` — Гейт PATCH_1.3.3 объявляет S1 PASS, а его же цитируемый источник вердиктов — S1 PARTIAL (пересуд 0204)

**Вердикт:** CONFIRMED · **Тяжесть:** high · **Тип:** status-drift · **Класс:** status-drift

**Противоречие:** Тот же класс, второй файл. Баннер плана PATCH_1.3.3 ссылается на «вердикты судьи — `SMOKE_BATCH_2026-07-11_BRIEF.md` §Outcome» и объявляет «S1/S3 PASS». Бриф в этом §Outcome (стр. 191) говорит «S1 PARTIAL (было PASS; понижен пересудом 0204 — per-tier-таблица research не подтверждена evidence)». Внутренняя таблица плана усугубляет: стр. 15 — «| S1 — research per-tier + approve gate | ✅ PASS 2026-07-11 |». CLAUDE.md стр. 27 несёт актуальное «S1 PARTIAL — понижен независимым пересудом DEC-DEV-0204, было PASS». Обе стороны — действующие утверждения о состоянии одного и того же сценария СЕЙЧАС.

**Сторона A** — `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md:11`
> 🟠 **Прогнан частично 2026-07-11 (smoke-batch, DEC-DEV-0177; вердикты судьи — `SMOKE_BATCH_2026-07-11_BRIEF.md` §Outcome).** S1/S3 PASS; S2/S4/S5 = N/A (не упражнены по вине оркестровки прогона, НЕ FAIL кода). Догон-требования — в Run notes.

**Сторона B** — `dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md:191`
> - **PATCH_1.3.3: S1 PARTIAL** *(было PASS; понижен пересудом 0204 — per-tier-таблица research не подтверждена evidence)*, **S3 PASS, S2/S4/S5 N/A**

**Почему важно:** Вводит в заблуждение о результате гейта: S1 — hard approve gate `/integrator:research`, т.е. ветка, где завышенный вердикт прячет неподтверждённую evidence. Общий корень с находкой 1: 3f477c2 обновил реестр и бриф, но не сами планы — механизм пересуда меняет вердикт в трёх местах и забывает четвёртое. ТА ЖЕ ОГОВОРКА: реально в этом checkout, на origin/main (2026-07-15) баннер переписан и гейт закрыт.

**Вывод скептика:** The contradiction is real, live, and load-bearing. `git show --stat 3f477c2` ("per-сценарные вердикты смоука 0177 пересужены независимо — 2 понижены, K9 закрыта (DEC-DEV-0204)") touched exactly six files — CHANGELOG.md, CLAUDE.md, DEV_JOURNAL.md, ROADMAP.md, dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md, dev/semantic-continuity/SEAM.md — and NOT dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md. The verdict flip PASS→PARTIAL propagated to five surfaces and missed the gate plan, in two places within it (banner :11 and table :15). […]

**Что пробовали для опровержения:** Ran six refutation hypotheses; all failed. (1) Different scope — no: both are present-tense assertions about the same scenario, PATCH_1.3.3 S1. (2) Declared lag contract — INVERTED, so it aggravates rather than excuses: dev/INFORMATION-MAP.yaml class `phase-gates` declares ssot="dev/gates/*.md (readiness + smoke-планы)" and lists CLAUDE.md «Где мы сейчас» as the MIRROR; […]

**🔧 Системный корень:** The rejudgement verdict lives copied in five-plus places with no generator or checker binding them, so a flip propagated by hand (3f477c2) updated the registry, brief, journal and ROADMAP but silently missed the gate plans — the very files INFORMATION-MAP declares SSOT for this class.

---

#### 10. 🟡 `artifact-schema-2` — design-session.md конструирует NM-frontmatter без обязательного `confidence` — артефакт уйдёт в active и упрётся в правило C2

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** artifact-schema · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** NM.md:24 помечает `confidence` как «C2 modification — обязательно»; README.md:157 каталога повторяет это для ВСЕХ артефактов («Confidence (C2 modification — обязательно во всех артефактах)»). Но design-session.md, единственный создатель NM-*, перечисляет поля NM прозой и `confidence` в список НЕ включает: «(id, type, feature, mockups[], roles[], status: draft)»  […]

**Сторона A** — `docs/pmo/artifacts/NM.md:24`
> confidence: high | medium | low # C2 modification — обязательно

**Сторона B** — `skills/design/design-session.md:343`
> - Construct NM frontmatter (id, type, feature, mockups[], roles[], status: draft)

**Почему важно:** Здесь скилл инструктирует произвести артефакт, который детерминированно нарушит правило, принуждаемое кодом. Ассистент, следующий design-session.md буквально, пишет NM → auto-approve в active → C2 бьёт по каждому NM. Симптом при этом выглядит как «баг валидатора / шумное правило», хотя корень — инструкция скилла; […]

**Вывод скептика:** The core contradiction is real and survived every refutation I could mount. NM.md:24 declares `confidence` "обязательно" (C2 modification), docs/pmo/artifacts/README.md:156 extends that mandate to all artifacts, and hooks/product/artifact-validate.js:181 implements a non-type-scoped presence check that fires on any `status: active` artifact lacking it  […]

**🔧 Системный корень:** design-session.md enumerates artifact frontmatter as ad-hoc prose lists instead of the explicit inline template the repo's own B1 convention mandates for every artifact-creating skill, so the mandatory-field contract in NM.md/README has no mechanical link to its sole producer and silently dropped out of the NM list while surviving in the MK one.

---

#### 11. 🟡 `artifact-schema-4` — segment-discovery.md: шаблон SEG обрывается многоточием и не несёт ни одного anti-pattern warning — 2 из 5 пунктов собственного чеклиста не выполнены

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** enforcement-gap · **Класс:** artifact-schema

**Противоречие:** Чеклист CLAUDE.md для ЛЮБОГО скилла, создающего артефакт каталога, требует пять пунктов, включая «- [ ] Все canonical fields перечислены» (строка 268) и «- [ ] Anti-pattern warnings explicit» (строка 269). segment-discovery.md создаёт SEG-* («Create `.product/segments/SEG-00N-<slug>.md`», строка 121), но его inline-шаблон перечисляет только 7 полей (id, type, title, status, priority, confidence, confidence_notes) и б […]

**Сторона A** — `CLAUDE.md:268`
> - [ ] Все canonical fields перечислены

**Сторона B** — `skills/product/segment-discovery.md:131`
> ...

**Почему важно:** «...» — это ровно тот implicit «follow the spec», который DEC-DEV-0011 признал недостаточным. SEG держит `priority: primary | secondary | exploratory` — enum, легко сползающий в `primary/secondary`, и `value_proposition`, который AI переименует в `vp`/`vp_ref`. […]

**Вывод скептика:** The finding survives every refutation. segment-discovery.md is in scope of a standing, live convention (CLAUDE.md:251 + checklist 267-271) and fails three of its five items: canonical fields are truncated by "..." after 7 of 12 (jtbd_count, created, updated, version omitted with no justification; […]

**🔧 Системный корень:** The B.1 frontmatter-template convention has neither a gate nor a linter (unlike counts and inventory, which do), so compliance rests purely on discipline — and the adjacent D1.4/D1.4a pair (segment-discovery, vp-design) silently stayed non-compliant while 18 sibling skills were swept into conformance.

---

#### 12. 🟡 `artifact-schema-5` — design-session.md: MK-frontmatter сконструирован без `title` — и ни один скилл Design-модуля не несёт anti-pattern-списка имён полей

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** enforcement-gap · **Класс:** artifact-schema

**Противоречие:** MK.md:19 держит `title` в схеме frontmatter наравне с id/type/feature. design-session.md — создатель MK-* — перечисляет поля прозой и `title` пропускает: «(id, type, feature, scenarios, scenario_steps, roles, platform, design_tool, tool_project_url, status: draft, iteration: <total>, confidence)»; […]

**Сторона A** — `docs/pmo/artifacts/MK.md:19`
> title: "Короткое имя экрана/flow"

**Сторона B** — `skills/design/design-session.md:330`
> - Construct MK frontmatter (id, type, feature, scenarios, scenario_steps, roles, platform, design_tool, tool_project_url, status: draft, iteration: <total>, confidence)

**Почему важно:** MK — самый поле-нагруженный тип дизайна (scenario_steps, design_tool, tool_project_url, previous_tools, tool_switched_at, ir_snapshot_path) и именно тот класс, про который b1-frontmatter-convention.md:98-99 говорит «anti-pattern lists especially important для» многополевых артефактов. […]

**Вывод скептика:** Обе стороны увидел своими глазами, ни одна гипотеза опровержения не сработала. Факты: (а) MK.md:19 держит `title` в схеме безусловно; design-session.md:330 — единственная инструкция конструирования MK-frontmatter — его не перечисляет, равно как `confidence_notes` (:30), `created`/`updated`/`version` (:37-39); […]

**🔧 Системный корень:** Конвенция B.1 (inline-шаблон + anti-pattern-список для любого скилла, создающего артефакт) не имеет ни гейта, ни warn-хука, ни чекера — соблюдение держится исключительно на памяти автора, поэтому Product-модуль, писавшийся под свежим впечатлением от PS-дрейфа DEC-DEV-0011, её выполнил (17 скиллов), а Design-модуль, строившийся позже и отдельной фазой, тихо разошёлся, унаследовав из конвенции только легко запоминающийся ASCII-slug-пункт.

---

#### 13. 🟡 `changelog-vs-delivery-4` — bootstrap и update штампуют одно и то же поле `ecosystem_version` по расходящимся правилам чтения CHANGELOG

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** duplicate-rule · **Класс:** changelog-vs-delivery

**Противоречие:** `/ecosystem:bootstrap` Step 7 предписывает взять `ecosystem_version` как «first entry» CHANGELOG — без оговорки про `[Unreleased]`; буквальное исполнение даёт `ecosystem_version: Unreleased`, т.к. первый entry в CHANGELOG.md — это `## [Unreleased]`. `/ecosystem:update` Step 5c для ТОГО ЖЕ поля предписывает противоположное: брать первую ВЫПУЩЕННУЮ версию, «skipping `## [Unreleased]`». Что правило update  […]

**Сторона A** — `commands/ecosystem/bootstrap.md:785`
> ecosystem_version: <read from .claude/CHANGELOG.md first entry>

**Сторона B** — `commands/ecosystem/update.md:732`
> Read the first released version from the just-synced `.claude/CHANGELOG.md` (the first `## [X.Y.Z]` heading, skipping `## [Unreleased]`) and surgically replace the `ecosystem_version:` value.

**Почему важно:** Значение поля в `product.yaml` пилота зависит от того, какая команда его писала последней: свежий bootstrap ставит `Unreleased`, update — `1.12.0`. Это ровно тот стейт, который `/ecosystem:verify` Step 5 обязан ловить как version drift ⇒ свежеустановленный пилот может стартовать сразу «дрейфующим» и советовать себе `/e […]

**Вывод скептика:** Противоречие реально и подтверждается тремя независимыми проверками, которые я провёл сам. Факт: первый entry в CHANGELOG.md — это `## [Unreleased]` (проверено grep'ом, не по памяти). Следовательно буквальное исполнение bootstrap Step 7 даёт `ecosystem_version: Unreleased`  […]

**🔧 Системный корень:** Одно правило вывода `ecosystem_version` из CHANGELOG написано вручную в ТРЁХ местах (install.sh:76 `grep -m1 '^## \['`, bootstrap.md:785 «first entry», update.md:732 с явным «skipping [Unreleased]») без общего SSOT-хелпера или указателя, поэтому уточнение DEC-DEV-0083 «пропусти [Unreleased]» доехало только до одной копии из трёх.

---

#### 14. 🟡 `counts-1` — docs/product-module/SPEC.md противоречит само себе: 23 команды vs 22 команды

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** count-mismatch · **Класс:** counts

**Противоречие:** Один и тот же SPEC (SSOT класса module-specs по dev/INFORMATION-MAP.yaml) в §3 объявляет 23 slash-команды, а в §3.2 — 22 команды, «сгруппированных по функциональным блокам». Речь об одном и том же наборе /product:*. Ground truth: `ls commands/product/*.md` = 23; […]

**Сторона A** — `docs/product-module/SPEC.md:109`
> | **Slash-commands** | 23 команды UX для пользователя (вкл. Epic B/C-i/D + impl-sync reverse-flow — §3.2/§3.2b) | `.claude/commands/product/` |

**Сторона B** — `docs/product-module/SPEC.md:205`
> 22 команды, сгруппированных по функциональным блокам.

**Почему важно:** SPEC объявлен SSOT архитектуры модуля (CLAUDE.md: «docs/ — SPEC и каталоги. Source of truth для archteture»; INFORMATION-MAP класс module-specs, ssot: docs/<module>-module/SPEC.md). Читатель не может определить, какое число верно, не выходя в git. check-counts.js покрывает ТОЛЬКО типы артефактов и правила валидации  […]

**Вывод скептика:** The contradiction is real and I could not break it. One file, declared SSOT for the module contract, states the size of one and the same set of /product:* commands twice with two different numbers. […]

**🔧 Системный корень:** The same command count is asserted in three places inside one file with no generator or gate owning it — `check-counts.js` computes ground truth only for artifact types and validation rules, and `gen-command-catalog.cjs` owns only the generated catalog — so a feature commit (3c80537) that bumped two of the three assertions left the third to rot silently.

---

#### 15. 🟡 `counts-2` — docs/product-module/SPEC.md: «12 hooks» против 13 хуков в manifest.yaml, который SPEC сам объявляет SSOT

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** count-mismatch · **Класс:** counts

**Противоречие:** SPEC дважды (строки 112 и 534) заявляет «12 hooks» в hooks/product/. Фактически hooks/product/manifest.yaml регистрирует 13 хуков (`grep -cE '^\s*-\s*id:' hooks/product/manifest.yaml` = 13: artifact-validate, session-state, bg-extractor, cascade-check, br-change-trigger, ic-change-trigger, product-handoff-gate, lesson-gate, lesson-presence-gate, zone-change-trigger, subagent-watchdog, override-sweep-check, worktree-e […]

**Сторона A** — `docs/product-module/SPEC.md:112`
> | **Hooks** | 12 hooks automation / enforcement / completeness-loop-routing (ключевые — §6; router — §6.8) | `.claude/hooks/product/` |

**Сторона B** — `hooks/product/manifest.yaml:129`
> - id: worktree-enter-guard

**Почему важно:** Хуки — это то, что реально доставляется и регистрируется в проекте пользователя при /ecosystem:bootstrap, т.е. счётчик описывает поставляемое поведение, а не косметику. Строка 534 повторяет «12 hooks» и тут же называет манифест SSOT — правило указывает на собственное опровержение. […]

**Вывод скептика:** The contradiction is real and I could not break it. docs/product-module/SPEC.md asserts "12 hooks" twice (lines 112, 534) for a directory that hooks/product/manifest.yaml registers with 13 entries, and the manifest is both the machine-read source for bootstrap and the SSOT that SPEC line 534 itself points to. […]

**🔧 Системный корень:** Hook counts have no reconciler at all — check-counts.js knows nothing about hooks and check-inventory-sync.cjs explicitly excludes hooks beyond the LESSON-* pair — so the total lives only in unverified SPEC prose, and the commit that adds a hook is never forced to sweep it (proven by "12" being written 39 minutes after the manifest hit 13).

---

#### 16. 🟡 `counts-3` — Гид противоречит собственному сгенерированному каталогу команд: 43 vs 51

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** count-mismatch · **Класс:** counts

**Противоречие:** docs/guide/01-first-session.md:266 отсылает читателя к карте за «полным каталогом всех 43 команд». Тут же в том же гиде docs/guide/02-commands.md:12 объявляет «Всего: 51 команд». 51 — истина: `find commands -name '*.md'` = 51, а сам ecosystem-map.html, на который ссылается строка 266, содержит ровно 51 уникальную команду (`grep -oE '/(product|design|integrator|ecosystem|orchestrator):[a-z-]+' docs/guide/ecosystem-map […]

**Сторона A** — `docs/guide/01-first-session.md:266`
> Полный каталог всех 43 команд («когда что») — на [карте](ecosystem-map.html).

**Сторона B** — `docs/guide/02-commands.md:12`
> **Всего: 51 команд** в 5 модулях.

**Почему важно:** 02-commands.md — не просто ещё один док, а объявленный SSOT класса command-catalog (dev/INFORMATION-MAP.yaml:133: «ГЕНЕРИРУЕТСЯ: gen-command-catalog.cjs → docs/guide/02-commands.md»), и он машинно верифицирован (`gen-command-catalog.cjs --check` = ✓ up to date). Значит сторона A однозначно неверна. […]

**Вывод скептика:** The contradiction is real and the scout characterized it accurately. Line 266 makes a total claim ("полный каталог ВСЕХ 43 команд") and links to a map that contains 51 — so the sentence is false twice over: the number is wrong, and the word "полный" promises completeness the number denies. […]

**🔧 Системный корень:** The command total has a generator for the catalog file but no reconciler for prose copies of the number — check-counts.js implements only `artifact` and `rule` kinds and no `command` kind, so hand-written totals in the live guide rot ungated, as proven by docs/guide/README.md:85 where "24 артефакта" (gated, correct) and "~43 команды" (ungated, stale) sit in the same sentence.

---

#### 17. 🟡 `counts-4` — README.md занижает число integrator-команд: 9 против фактических 13

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** count-mismatch · **Класс:** counts

**Противоречие:** Корневой README.md в дереве репозитория подписывает каталог integrator как «(9 команд)». Фактически `ls commands/integrator/` = 13 файлов (add, debug, docs, gaps, journal, map, provision, remove, research, scan, status, update, verify), и сгенерированный SSOT-каталог docs/guide/02-commands.md:72 фиксирует «## /integrator:* (13)».

**Сторона A** — `README.md:58`
> │ └── integrator/ # /integrator:* (9 команд)

**Сторона B** — `docs/guide/02-commands.md:72`
> ## /integrator:* (13)

**Почему важно:** README — самый читаемый consumer-facing документ и входная точка репозитория; он отстаёт от реальности на 4 команды (≈30% модуля). Заявленное отставание by design покрывает только ROADMAP и память (CLAUDE.md / INFORMATION-MAP), README в этот контракт НЕ входит — значит это дрейф вне контракта, а не разрешённый лаг. […]

**Вывод скептика:** Противоречие реально и датируемо с точностью до коммита. На da8c550 (2026-06-25) `git ls-tree` даёт ровно 9 файлов в commands/integrator/ — «(9 команд)» было ВЕРНО в момент написания. Дальше: 81501ac (2026-07-11) добавил debug.md + docs.md + verify.md → 12; 17b1bde (2026-07-13) добавил provision.md → 13. 9+4=13 — арифметика скаута сходится точно. […]

**🔧 Системный корень:** Обязательство «добавил/убрал команду» в SSOT-таблице CLAUDE.md перечисляет зеркала для обновления поимённо (verify.md Step 4/9, status.md, docs/MAP.md), но root README в этот перечень не включён, а strict-чекер check-inventory-sync.cjs сверяет только verify.md — поэтому рукописный per-namespace счётчик в README остался зеркалом без строки в обязательстве и без гейта, и молча протух при первом же добавлении команд.

---

#### 18. 🟡 `counts-5` — docs/integrator-module/SPEC.md: «12 команд» против фактических 13 — включая шаг верификации

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** count-mismatch · **Класс:** counts · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** Integrator SPEC объявляет «UX для пользователя (12 команд)» (строка 56) и повторяет число как критерий приёмки на строке 698: « - Verify: все 12 команд зарегистрированы ✓». Фактически команд 13 (`ls commands/integrator/` = 13), что подтверждает машинно-верифицированный каталог docs/guide/02-commands.md:72 «## /integrator:* (13)». Итого по одному предмету три разных числа в репо: README.md:58 — 9, этот SPEC  […]

**Сторона A** — `docs/integrator-module/SPEC.md:56`
> | **Slash-commands** | UX для пользователя (12 команд) | `.claude/commands/integrator/` |

**Сторона B** — `docs/guide/02-commands.md:72`
> ## /integrator:* (13)

**Почему важно:** Здесь счётчик не просто описателен — строка 698 делает его КРИТЕРИЕМ ПРИЁМКИ («Verify: все 12 команд зарегистрированы ✓»), то есть проверка, пройденная на 12 из 13, объявит успех, пропустив незарегистрированную команду. Это мёртвое рабочее правило, а не косметика. SPEC при этом  […]

**Вывод скептика:** Находка верна наполовину, и неверна ровно в той половине, на которой скаут строил важность. ПОДТВЕРЖДЕНО: docs/integrator-module/SPEC.md:56 объявляет «12 команд» про `.claude/commands/integrator/`, тогда как фактических команд 13 (ls = 13; машинно-генерируемый каталог docs/guide/02-commands.md:72 «## /integrator:* (13)»). […]

**🔧 Системный корень:** Счётчики команд руками вписаны прозой в README и module-SPEC, тогда как единственный генератор с гейтом (gen-command-catalog.cjs / gen:catalog:check) покрывает только docs/guide/02-commands.md — поэтому каждый прозаический счётчик молча застывает на дате своей последней ручной правки, а добавление команды (17b1bde, /integrator:provision) не оставляет красного следа ни в одной цепи.

---

#### 19. 🟡 `deferred-lifecycle-3` — CLAUDE.md приписывает `check-inventory-sync.cjs` проверку floor'ов скиллов — код объявляет этот класс RETIRED

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** deferred-lifecycle

**Противоречие:** Сноска CLAUDE.md перечисляет, что детерминированно сверяет чекер, включая «floor'ы runtime-дир **и скиллов**». Сам чекер в шапке и в теле объявляет класс SKILL-FLOOR снятым: проверки скиллов в нём нет вообще. По объявленной в этом же файле precedence («Код гейта > эта таблица … Разошлись — прав код, таблица = баг») это ровно тот случай, который таблица обязана считать своим багом.

**Сторона A** — `CLAUDE.md:69`
> детерминированно сверяет `verify.md` с репо: набор namespace'ов (Step 4 **и** Step 9 summary), floor'ы runtime-дир **и скиллов**, маркеры Step 4.5/4.6

**Сторона B** — `dev/meta-improvement/scripts/check-inventory-sync.cjs:22`
> * ── RETIRED: [6] SKILL-FLOOR (DEF-CTX-5 closed) ──

**Почему важно:** Утверждение о том, ЧТО принуждается, ложно: строка «добавил/убрал скилл» помечена ⚙ и опирается на описание проверок, одна из которых удалена. Реальное покрытие скиллов теперь держит `gen:skills:check` (сильнее floor'а), но CLAUDE.md об этом не знает — читающий верит в проверку, которой нет, и не видит ту, что есть.

**Вывод скептика:** The claim in CLAUDE.md:69 about what check-inventory-sync.cjs verifies is factually false on the «и скиллов» clause: class [6] SKILL-FLOOR was retired, verify.md's skills floor line was deleted with it, and the script's surviving [3] FLOOR parses only runtime-dir floors (`product/processes/*.mjs`, `orchestrator/charters/*.json` — verify.md:59-61). […]

**🔧 Системный корень:** The script's coverage description is hand-copied into CLAUDE.md as prose with no mechanism binding the copy to the code, so retiring class [6] updated the script, verify.md and CONTEXT_AUDIT_D6 but left the CLAUDE.md copy stale — the declared «код > таблица» precedence names the winner on divergence but nothing ever detects that divergence.

---

#### 20. 🟡 `deferred-lifecycle-4` — Смоук-план Phase 6 держит S4 = PASS, хотя пересуд DEC-DEV-0204 понизил его до PARTIAL

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** status-drift · **Класс:** deferred-lifecycle

**Противоречие:** Статус-строка плана Phase 6 объявляет «S4/S5/S7 PASS · S2 PARTIAL». Бриф прогона (§Outcome — источник вердиктов, на который план ссылается прямо в этой же строке) после независимого пересуда держит «S4 PARTIAL (было PASS)»: из 4 pass-критериев подтверждён 1, write-путь не упражнён.

**Сторона A** — `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md:5`
> вердикты — `SMOKE_BATCH_2026-07-11_BRIEF.md` §Outcome): **S4/S5/S7 PASS · S2 PARTIAL** (артефакт+гейт-механика валидны; fresh-генерация N/A-substrate)

**Сторона B** — `dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md:190`
> - **PHASE_6: S5/S7 PASS, S2 PARTIAL, S4 PARTIAL** *(было PASS; понижен пересудом 0204 — 1 из 4 критериев подтверждён, write-путь не упражнён)*

**Почему важно:** Тот же несмёрженный sweep, что и у PATCH 1.3.3: понижение вердикта разнесли по CLAUDE.md/ROADMAP/брифу, но не по планам гейтов. CLAUDE.md:29 говорит «S4 понижен … было PASS» — план говорит PASS. […]

**Вывод скептика:** The contradiction is real on the authoritative branch, not just the local checkout. Three-way state on origin/main: brief §Outcome = "S4 PARTIAL (было PASS; понижен пересудом 0204)"; CLAUDE.md:29 = "S5/S7 PASS, S2/S4 PARTIAL с 0177/0204"; PHASE_6 plan = S4 PASS, with zero mention of 0204 anywhere in the file. […]

**🔧 Системный корень:** The same verdict is written in two places — the brief §Outcome (cited as the source) and the plan's own status line restating it inline — and the 0204 correction had no gate, hook, or checklist tying a verdict change to the gate plans that duplicate it, so the sweep reached the mirrors (CLAUDE.md/ROADMAP/brief) but not the declared SSOT.

---

#### 21. 🟡 `deferred-lifecycle-5` — Долговой реестр Phase 4 требует создать D7-паттерн, который создан 5 недель назад (DEC-DEV-0064)

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** status-drift · **Класс:** deferred-lifecycle · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** `dev/tech-debt/PHASE_4.md` держит R1 как невыполненную рекомендацию («Добавить pattern …» + «⚠ Перепроверить на альтернативы при взятии в работу», среди альтернатив — «vs новый D7 pattern»), а E1 — как `[OPEN]`. Паттерн существует и в своей же шапке ссылается ровно на те кластеры Phase-4-аудита, из которых R1 и родилась. «Журнал статусов» файла содержит единственную строку — создание 2026-05-26,  […]

**Сторона A** — `dev/tech-debt/PHASE_4.md:77`
> Добавить pattern в [`dev/meta-improvement/patterns/`](../meta-improvement/patterns/) фиксирующий правило «DA-обзоры обязаны спавниться через `subagent_type: product-devils-advocate`, не `general-purpose`»

**Сторона B** — `dev/meta-improvement/patterns/da-subagent-type-contract.md:3`
> > **Status:** provisional (codified DEC-DEV-0064, 2026-06-12, from Session Audit v2 clusters `D2B-behavioral::C` + `::B`).

**Почему важно:** Один долг в двух местах с разными статусами: реестр зовёт делать работу, чей deliverable живёт в библиотеке паттернов (и в `patterns/README.md` числится как активный, provisional, 2 инстанса), а корневой фикс — в `skills/product/feature-session.md:352` (канонический сниппет + anti-patterns #9/#10). […]

**Вывод скептика:** Противоречие реально, но у́же и иначе устроено, чем заявил скаут — отсюда PARTIAL. ЧТО ВЫЖИЛО: R1 не просто «сделана» — она ПОЛНОСТЬЮ диспозирована двумя разными исходами, и реестр не записал ни одного. […]

**🔧 Системный корень:** Обязательство «при взятии в работу обновить статус» записано прозой внутри самого долгового файла — без гейта, без warn-хука и без обратной ссылки со стороны закрывающего DEC-DEV, поэтому закрытие долга в журнале/библиотеке паттернов по построению не касается реестра, который INFORMATION-MAP объявляет SSOT.

---

#### 22. 🟡 `enforcement-claims-3` — docs/pmo/processes.md держит presence-gate как «Ships warn (pending S-LE live smoke)» — условие давно закрыто, флип выполнен

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** enforcement-claims

**Противоречие:** Каталог хуков в processes.md — спецификационный SSOT поведения хуков — заявляет, что presence-gate «Ships **warn**», а `LESSON_GATE_MODE=strict` лишь ВКЛЮЧАЕТ deny, и подвешивает это на «(pending S-LE live smoke)». Обе половины ложны сейчас: (1) код шипится strict (строка 201), а `LESSON_GATE_MODE` в роли включателя deny инвертирован — на деле это ВЫКЛЮЧАТЕЛЬ (`=warn` понижает); […]

**Сторона A** — `hooks/product/manifest.yaml:102`
> SHIPS DEFAULTED TO STRICT (flipped 2026-07-11, owner decision after S-LE re-run PASS of the DEC-DEV-0143 carve-out — smoke-batch DEC-DEV-0177; downgrade escape: LESSON_GATE_MODE=warn)

**Сторона B** — `docs/pmo/processes.md:1223`
> - `lesson-presence-gate.js` — **PreToolUse** + **UserPromptSubmit** backstop (PRONG B). Ships **warn** (re-surfaces open lessons each turn; PreToolUse nag); […]

**Почему важно:** Это не отставание by design: processes.md — спека поставки (класс spec, не status), контракт отставания на неё не распространяется. Строка описывает семантику тумблера ЗЕРКАЛЬНО коду (включатель вместо выключателя) и держит живой ссылку на закрытый гейт  […]

**Вывод скептика:** The finding survives on both halves, verified against code rather than against the scout's narrative. HALF 1 (shipped default): code line 201 defaults to 'strict'; processes.md says "Ships **warn**". False. […]

**🔧 Системный корень:** The warn→strict flip commit (4cfffae) hand-swept only the status-class docs it happened to remember (CLAUDE.md/ROADMAP/CHANGELOG/DEV_JOURNAL/manifest) while the hook's shipped default is re-described verbatim in at least three other un-gated places (processes.md §14.2, ecosystem-map.overlay.json and its two generated HTML mirrors) — i.e. […]

---

#### 23. 🟡 `enforcement-claims-4` — Оверлей гида объявляет warn дефолтом и предлагает «обойти» гейт установкой значения, которое уже названо дефолтом

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** enforcement-claims

**Противоречие:** `ecosystem-map.overlay.json` — исходник генерируемого гида (цепь `gen:map:check` в `npm run verify`, package.json:41). Он дважды называет warn дефолтом presence-gate, тогда как код шипится strict (строка 201). Плюс запись противоречит сама себе: поле `bypass` предлагает обойти гейт через `LESSON_GATE_MODE=warn`, тут же помечая warn как «(дефолт)» — обход, равный дефолту, обходом не является. […]

**Сторона A** — `hooks/product/lesson-presence-gate.js:13`
> * SHIPS DEFAULTED TO STRICT (flipped 2026-07-11, owner decision after the S-LE

**Сторона B** — `docs/guide/ecosystem-map.overlay.json:234`
> "what": "В strict-режиме отказывает мутирующим инструментам (Write|Edit|Bash|NotebookEdit) при открытых LESSON-*.md; в warn (дефолт) — только предупреждает.",

**Почему важно:** Оверлей — источник для docs/guide/ecosystem-map.html (строки 2125-2131 несут ту же ошибку), т.е. неверное описание принуждения фактически ПОСТАВЛЯЕТСЯ в визуальный гид. `gen:map:check` сверяет HTML с оверлеем, а не оверлей с кодом, — регенерация ошибку не поймает, она лишь тиражирует её в артефакт.

**Вывод скептика:** Every claim the scout made checks out, and the finding is if anything understated. Code ships strict (line 201, not just the header comment); the overlay twice calls warn the default (234 "в warn (дефолт)", 235 bypass "LESSON_GATE_MODE=warn (дефолт)"). […]

**🔧 Системный корень:** The gate's semantics are declared EDITORIAL (hand-copied) in the overlay's own _doc.split while only "gate source-file existence" is harvested from code, so no checker anywhere compares a gate's described mode against that gate's actual default — leaving the 2026-07-11 flip's doc-sweep to human memory, which updated the artifacts touching the code (header, manifest.yaml) and missed every descriptive copy further out.

---

#### 24. 🟡 `gate-code-vs-doc-2` — Сноска CLAUDE.md приписывает check-inventory-sync.cjs проверку floor'ов скиллов — код проверяет только runtime-диры

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** gate-code-vs-doc

**Противоречие:** CLAUDE.md:69 перечисляет, что именно детерминированно сверяет чекер, и включает в список «floor'ы runtime-дир **и скиллов**». Код в claimedFloors() прямо оговаривает обратное: floor'ы — только структурные минимумы runtime-дир, а команды и скиллы floor'ами НЕ являются (они выведены из генерируемых каталогов). […]

**Сторона A** — `CLAUDE.md:69`
> - `node dev/meta-improvement/scripts/check-inventory-sync.cjs` — детерминированно сверяет `verify.md` с репо: набор namespace'ов (Step 4 **и** Step 9 summary), floor'ы runtime-дир **и скиллов**, маркеры Step 4.5/4.6 (реально ли строка есть в `.mjs`), хуки Step 8.5 (есть ли в `hooks/*/manifest.yaml`  […]

**Сторона B** — `dev/meta-improvement/scripts/check-inventory-sync.cjs:249`
> // Structural minimums only (runtime dirs). Commands and skills are NOT floors — they are

**Почему важно:** Это описание ПОКРЫТИЯ гейта — то есть заявление о безопасности. Читатель полагает, что ⚙-чекер стережёт инвентарь скиллов, и не ищет второй механизм; на деле скиллы стережёт совсем другая цепь (`gen:skills:check`), а этот чекер про них не знает ничего. […]

**Вывод скептика:** Противоречие реально и датируемо. Сноска CLAUDE.md:68-73 написана коммитом 20bf16c (DEC-DEV-0197/D11, «пустой пронг „скилл“ наполнен») — тогда floor скиллов `expect 63+` РЕАЛЬНО существовал и классы [3]+[6] чекера его держали. […]

**🔧 Системный корень:** Карта покрытия чекера существует в трёх рукописных копиях (шапка скрипта, verify.md, сноска CLAUDE.md), и у прозаической копии в CLAUDE.md нет ни SSOT-указателя, ни гейта, ни warn-хука, который заставил бы её поехать вместе с кодом при ретайре класса [6] — ровно тот же дефект «одно правило записано дважды», который DEC-DEV-0197/D12 уже лечил в соседних таблицах этого же файла.

---

#### 25. 🟡 `inventory-sync-4` — CLAUDE.md claims check-inventory-sync.cjs verifies skills floors — that class was deliberately retired from the script

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** inventory-sync

**Противоречие:** The CLAUDE.md footnote enumerates what check-inventory-sync.cjs deterministically checks and includes «floor'ы runtime-дир **и скиллов**». The script's own header enumerates its live classes as [1] NAMESPACE-SET, [2] NAMESPACE-ECHO, [3] FLOOR (runtime dirs only — «Commands and skills are NOT floors»), [4] MARKER-LIVE, [5] HOOK-CLAIM, and explicitly retires the skills prong. […]

**Сторона A** — `CLAUDE.md:69`
> - `node dev/meta-improvement/scripts/check-inventory-sync.cjs` — детерминированно сверяет `verify.md` с репо: набор namespace'ов (Step 4 **и** Step 9 summary), floor'ы runtime-дир **и скиллов**, маркеры Step 4.5/4.6 (реально ли строка есть в `.mjs`), хуки Step 8.5 (есть ли в `hooks/*/manifest.yaml`  […]

**Сторона B** — `dev/meta-improvement/scripts/check-inventory-sync.cjs:373`
> // [6] SKILL-FLOOR — RETIRED (DEF-CTX-5 closed). The «скилл» prong of Row 5 is now held at item

**Почему важно:** This is the SSOT footnote describing what is actually enforced for the ⚙ row of the Process triggers table. It over-claims the checker's coverage: a reader trusting it believes skills are gated by this linter, when they are gated by a different mechanism (gen:skills:check). […]

**Вывод скептика:** The scout is right, and if anything under-reported the scope. Established by my own reading: the script retired [6] SKILL-FLOOR, its live class list omits skills, verify.md no longer publishes a skills floor, and a live run parses exactly 2 floors — both runtime dirs. CLAUDE.md:69 nonetheless asserts the checker verifies "floor'ы runtime-дир **и скиллов**". […]

**🔧 Системный корень:** The footnote describing what a checker checks is prose with no checker of its own, so when db6d23d retired the skills prong in both the script and verify.md, CLAUDE.md's description of them drifted silently while the checker itself stayed green — a gate can verify the inventory but nothing verifies the documentation of the gate's own coverage.

---

#### 26. 🟡 `inventory-sync-5` — Live ACTIVE seam queues DEF-CTX-5 as remaining work — it was fixed the day before the seam was updated

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** status-drift · **Класс:** inventory-sync

**Противоречие:** dev/semantic-continuity/SEAM.md carries `status: ACTIVE` and is a protocol document the continuator must read whole and ACK before the first edit (per the Process triggers row on live seams). Its «Очередь после» section — annotated «актуализирована на закрытии сессии», with DEF-CTX-1..3 struck through as closed — leaves DEF-CTX-5 in the remaining queue with an event trigger. […]

**Сторона A** — `dev/semantic-continuity/SEAM.md:67`
> **Остаток: Informed Fetch (п.2 «Следующего шага») → DEF-CTX-5 (генератор каталога скиллов; триггер — первое переименование скилла) · DEF-CTX-6 (синхронизация памяти VM) → D9 ротация WS-1.**

**Сторона B** — `dev/tech-debt/CONTEXT_AUDIT_D6.md:122`
> ### DEF-CTX-5 — `[FIXED]` нет генератора каталога скиллов: пронг Row 5 «скилл» держится на floor'е, а не на инвентаре

**Почему важно:** A seam is the designed hand-off contract and is not a declared-lagging source — the continuator is required to work from it and to ACK it before touching files. It directs the next session to build gen-skill-catalog.cjs, which already exists and is already wired into npm run verify. […]

**Вывод скептика:** The contradiction is real and I could not break it. A document that is (a) status: ACTIVE, (b) not listed as lagging in any topology file, and (c) required by the Process triggers table to be read whole and ACKed before the continuator's first edit, dispatches DEF-CTX-5 — "build a skill-catalog generator, trigger: first skill rename" — as remaining track work. […]

**🔧 Системный корень:** Seam queues and the CLAUDE.md footnote each hold their own copy of a debt item's status instead of pointing at CONTEXT_AUDIT_D6 as SSOT, and nothing reconciles them — the seam hooks only check freshness by age, never queue content — so flipping a DEF-CTX item to `[FIXED]` in the register silently leaves every downstream copy dispatching work that is already done.

---

#### 27. 🟡 `precedence-dup-1` — Accumulation contract: CONVENTIONS §11.1 requires CHANGELOG for EVERY merged change — CLAUDE.md SSOT table and the gate require it only for consumer-zone feat/fix

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** duplicate-rule · **Класс:** precedence-dup · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** CONVENTIONS §11.1 states the per-change contract without any consumer-zone qualifier: «каждое смёрженное изменение несёт запись в CHANGELOG.md [Unreleased]». The SSOT table in CLAUDE.md says the exact opposite for a whole class of merged changes: `docs:` / typo / dependency bump require «ничего — это НЕ триггеры», and `fix:` requires CHANGELOG only «если тронут consumer-zone». […]

**Сторона A** — `dev/meta-improvement/CONVENTIONS.md:301`
> **Convention:** каждое смёрженное изменение несёт запись в `CHANGELOG.md [Unreleased]`

**Сторона B** — `CLAUDE.md:55`
> | `docs:` / typo / dependency bump | **ничего** — это НЕ триггеры | §1 «НЕ триггеры» |

**Почему важно:** The declared precedence (code > table > everything else) makes §11.1 a bug by construction, but it is the copy the SSOT table points at as its authoritative detail. […]

**Вывод скептика:** The contradiction is REAL but NARROWER and LESS SEVERE than filed, hence PARTIAL. What holds: three live copies of the accumulation contract exist (CONVENTIONS.md:301, patch-cut.md:37, plus the SSOT table row CLAUDE.md:51), the two non-SSOT copies use a universal quantifier ("каждое смёрженное изменение"), and CLAUDE.md:55 states that docs:/typo/dependency-bump commits owe noth […]

**🔧 Системный корень:** The D12 collapse-to-pointer remedy was applied only within CLAUDE.md (its precedence rule 2 is self-scoped to "любое другое место этого файла"), so sibling copies of the same obligation in CONVENTIONS.md and checklists/ were left outside the SSOT lattice with no gate, no checker, and no cross-file precedence declaration to catch them drifting.

---

#### 28. 🟡 `precedence-dup-2` — memory-sync activation: CONVENTIONS §4 says «Manual (user types invocation)» — CLAUDE.md (DEC-DEV-0100) says «Не жду команды»

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** stale-reference · **Класс:** precedence-dup

**Противоречие:** The D7 mechanism catalog records memory-sync's activation type as Manual, meaning the user initiates it. CLAUDE.md's Auto memory-sync section (DEC-DEV-0100) inverts exactly that: the harness runs it unprompted at session end when status-bearing files were committed. The «Activation type» column is load-bearing in this very table — sibling rows say «**Auto** (registered в .claude/settings.local.json)»  […]

**Сторона A** — `dev/meta-improvement/CONVENTIONS.md:144`
> | `skills/memory-sync.md` | Phase closure Step 5 OR standalone (long break, AI cites stale) | Per phase + ad-hoc | Manual (user types invocation) |

**Сторона B** — `CLAUDE.md:318`
> **Не жду команды «прогони memory-sync».** В конце сессии / на «готово» —

**Почему важно:** Both are living docs (CONVENTIONS is on §5.2's NEVER-archive list), so this is a present-tense divergence, not history. The two copies give opposite answers to «do I sync memory without being asked?» — the behavior DEC-DEV-0100 deliberately flipped. […]

**Вывод скептика:** The core divergence is real, present-tense, and between two living co-SSOT docs. CONVENTIONS §4:144 states memory-sync's activation as "Manual (user types invocation)"; CLAUDE.md:318 (DEC-DEV-0100, 2026-06-24) states the harness runs it unprompted at session end when status-bearing files were committed. These give opposite answers to "do I sync memory without being asked?"  […]

**🔧 Системный корень:** The D7 mechanism catalog duplicates activation/default facts that CLAUDE.md operationally owns, but those specific rows carry no SSOT pointer (the file's header pointer names only the «Process triggers» table, which has no memory-sync row) and no gate or warn-hook ties a behavioral default-flip like DEC-DEV-0100 to a sweep of the catalog  […]

---

#### 29. 🟡 `precedence-dup-3` — Consumer-zone definition in the CLAUDE.md table is narrower than the definition the gate actually enforces

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** precedence-dup

**Противоречие:** The SSOT table defines the consumer zone as the eight directories plus «root README/ROADMAP/install». The gate's regex adds two root files the table never mentions — `.env.template` and `gitignore.template`. Per the declared precedence (CLAUDE.md:44 «Разошлись — **прав код**, таблица = баг»), the code wins and the table is a bug. […]

**Сторона A** — `CLAUDE.md:51`
> | `feat:` в consumer-zone (`commands/skills/agents/hooks/docs/templates/adapters/orchestrator` + root README/ROADMAP/install) | 🔒 CHANGELOG `[Unreleased] ### Added` + DEV_JOURNAL если был tradeoff ≥2 вариантов | accumulation contract |

**Сторона B** — `dev/meta-improvement/scripts/process-gate.js:74`
> const CONSUMER_ROOT = /^(README\.md|ROADMAP\.md|install\.(sh|ps1)|\.env\.template|gitignore\.template)$/;

**Почему важно:** A `feat:` or `fix:` touching `.env.template` or `gitignore.template` is blocked by the commit-msg gate while the table — the harness's own contract for «what I am obliged to do» — says that file is outside the consumer zone and needs no CHANGELOG entry. […]

**Вывод скептика:** The contradiction is real and both sides are live. `CONSUMER_ROOT` (line 74) is consumed at line 75 by `touchesConsumer`, which at line 80 gates the exact obligation the table's row 51 describes — same rule, same scope, same commit types (`isFeat || isFix`). No scope split: these are two descriptions of one enforced set. […]

**🔧 Системный корень:** The consumer zone has no single SSOT — its membership is re-enumerated by hand in at least four independent places (CLAUDE.md table row, the `CONSUMER_ROOT` regex, that gate's own stderr string, and `update.md`'s delivery footprint) with no generator or checker binding the prose copies to the regex, so any one of them can be written or edited without the others.

---

#### 30. 🟡 `precedence-dup-4` — Pattern library inventory recorded twice inside CONVENTIONS.md and diverges: §7 says 5 patterns, §2 layout and the declared SSOT say 8

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** count-mismatch · **Класс:** precedence-dup

**Противоречие:** CONVENTIONS §7 declares the pattern library as «5 patterns в `patterns/` directory» and enumerates exactly five (spec-drift-sweep, readiness-gate, b1-frontmatter-convention, cuttable-scope-discipline, smoke-test-plan). The same file's §2 layout block says «patterns/ # 8 patterns + index», CLAUDE.md:283 says «8 шт.» and names patterns/README.md as the SSOT, and README.md's table lists 8. […]

**Сторона A** — `dev/meta-improvement/CONVENTIONS.md:233`
> **Convention:** Stage 3 shipped (2026-04-28). 5 patterns в `patterns/` directory.

**Сторона B** — `CLAUDE.md:283`
> - **Паттерны — какой под какой триггер** (8 шт.; колонка «When applicable» в [`patterns/README.md`](dev/meta-improvement/patterns/README.md) — она же SSOT, если разойдётся с этим списком):

**Почему важно:** §7 is a «Convention» in a NEVER-archive living doc that owns the provisional→validated promotion rule, so the roster it enumerates is what an auditor promotes against — and three patterns are invisible to it, including config-failure-first-triage, which CLAUDE.md mandates before blaming a model for misbehavior. […]

**Вывод скептика:** The contradiction is real, internal to one living document, and I could not break it. CONVENTIONS.md states its pattern-library size three times and disagrees with itself: §2:68 = 8 (and lists all eight), §3:118 = 5, §7:233 = 5 (and enumerates only five). Ground truth is 8 files; the declared SSOT (patterns/README.md) is 8; […]

**🔧 Системный корень:** The pattern-library roster is written in four places (CONVENTIONS §2, §3, §7, patterns/README.md) with an SSOT declared only in CLAUDE.md and scoped only to CLAUDE.md's own copy, so the three CONVENTIONS copies have neither a precedence marker nor a checker — check-counts.js reconciles artifacts and validation rules but never scans dev/ — leaving the count to survive on the memory of whoever adds the next pattern.

---

#### 31. 🟡 `spec-vs-impl-1` — Integrator SPEC каталог обещает команду /integrator:replace, которой в поставке нет (и сам же SPEC 1000 строк спустя говорит, что её нет)

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** spec-vs-impl · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** §3.2 «Группа Modifying» перечисляет `/integrator:replace <old> <new>` как одну из «13 slash-команд» каталога — без единой пометки о нереализованности. §13.1 того же файла прямо говорит, что команда не реализована. Файл `commands/integrator/replace.md` отсутствует: в `commands/integrator/` лежат 13 команд, но набор ДРУГОЙ — replace нет, зато есть provision, которого нет в каталоге. […]

**Сторона A** — `docs/integrator-module/SPEC.md:150`
> **`/integrator:replace <old> <new>`** — заменить один инструмент другим

**Сторона B** — `docs/integrator-module/SPEC.md:1159`
> - **Всегда** перед `/integrator:replace` — *Phase-7: команда replace ещё не реализована (G14)*

**Почему важно:** Каталог команд §3 — то место, куда идут за ответом «что я могу вызвать». Он объявляет replace доступной; пользователь вызовет `/integrator:replace cc-sdd kiro` (ровно такой пример стоит в §7 на строке 840) и не получит ничего. Честная аннотация существует, но спрятана в §13.1 — там, где её никто не ищет. […]

**Вывод скептика:** The scout's quotes are honest and the coordinates are exact — this is not a fabrication case. But the headline framing ("SPEC promises replace, and contradicts itself 1000 lines later") does not survive scrutiny. §3.2 never asserts "replace is available now"; […]

**🔧 Системный корень:** Module SPEC command inventories (catalog §3 + file tree §10) are hand-maintained with nothing binding them to `commands/<module>/` — the generator and its `gen:catalog:check` gate cover only the user-facing `docs/guide/02-commands.md`, so the design-side SPECs drift silently in both directions (phantom replace.md persists, shipped provision never lands).

---

#### 32. 🟡 `spec-vs-impl-2` — Product SPEC объявляет Deep mode отложенным до v1.1, хотя он построен и полностью прошит

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** status-drift · **Класс:** spec-vs-impl

**Противоречие:** Чеклист §14.3 в заголовке заявляет «Deep deferred к v1.1» и держит субагентов Deep mode невыполненными пунктами. Фактически оба субагента существуют как полноценные файлы (`agents/product/market-researcher.md`, `agents/product/competitor-analyst.md`) и прошиты в исполняемый путь: `commands/product/init.md:17` объявляет флаг `--deep`, а `skills/product/discovery-session.md` спавнит их каноническим `subagent_type`. […]

**Сторона A** — `docs/product-module/SPEC.md:1055`
> - [ ] Subagents: `market-researcher.md`, `competitor-analyst.md` — Deep mode (v1.1)

**Сторона B** — `skills/product/discovery-session.md:66`
> **Deep mode (`--deep`):** spawn the `market-researcher` subagent (`subagent_type: "market-researcher"`) with an isolated-context brief, instead of running the Quick protocol inline:

**Почему важно:** Расхождение ведёт к недоиспользованию поставленной способности: читающий §14.3 (это «Checklist для активации» — то есть SSOT «что готово к запуску») заключает, что `/product:init --deep` недоступен, и не предложит его пользователю. Это не объявленное отставание ROADMAP/памяти  […]

**Вывод скептика:** The contradiction is real and lands exactly where the scout placed it. `docs/product-module/SPEC.md:1055` states as unbuilt two files that exist, are spawned by name from `skills/product/discovery-session.md:66` / `:90`, are advertised by `commands/product/init.md:17`, and are covered by a smoke test in the `verify` chain. […]

**🔧 Системный корень:** The same v1.1 deferral status was recorded in two places — SPEC §14.3's activation checklist and `dev/v1_1_backlog.md` — and the bring-forward commit (DEC-DEV-0186) updated only the backlog, because no gate or checker ties the SPEC checklist's `[ ]` boxes to the on-disk existence of the very files they name (the same class of gap the repo already fixed for commands via `check-inventory-sync.cjs`, but never extended to SPEC checklists).

---

#### 33. 🟡 `spec-vs-impl-3` — Design SPEC числит html-fallback.md в «Future skills», хотя скилл построен и лежит в поставке

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** spec-vs-impl · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** §4.6 «Future skills (если нужно)» перечисляет `html-fallback.md` как ненаписанный будущий скилл, а §14.3 держит его невыполненным пунктом чеклиста («- [ ] Skill `html-fallback.md` (resilience путь)», строка 893). Файл `skills/design/html-fallback.md` существует, версионирован (v1.0 minimal per DEC-DEV-0052 C4) и является частью тех самых «10 methodology files», которые §2.1 (строка 101) объявляет поставленными.

**Сторона A** — `docs/design-module/SPEC.md:341`
> - `html-fallback.md` (когда все MCP недоступны — HTML/React artifact generation)

**Сторона B** — `skills/design/html-fallback.md:2`
> description: HTML emergency fallback за D.2/D.3 generation когда Stitch unavailable AND Claude Design subscription отсутствует. v1.0 minimal — single HTML page, DS tokens via CSS vars, no React, no multi-screen per DEC-DEV-0052 C4.

**Почему важно:** html-fallback — последнее звено graceful-degradation цепи §9.6 (`stitch → claude-design → html-artifact`). Если SPEC говорит, что скилла ещё нет, ассистент при недоступном Stitch решит, что путь деградации не построен, и заблокирует design-сессию вместо того, чтобы её продолжить  […]

**Вывод скептика:** Core contradiction is real and I saw both sides myself. §4.6 "Future skills (если нужно)" lists html-fallback.md as an unwritten future skill; the file exists, ships (dev/_archive/changelog/CHANGELOG_1.0-1.6.md:92), is user-facing documented (docs/guide/08-skills.md:79), runtime-dispatched (skills/design/design-session.md:189), and referenced as a built path by commands/design/ […]

**🔧 Системный корень:** Skills have no catalog generator or inventory checker the way commands do (gen-command-catalog.cjs / check-inventory-sync.cjs), so a skill's promotion from "Future" to built never forces the SPEC inventory to update — precisely the weakness CLAUDE.md already admits ("Скиллы — пронг наполнен, но проверка слабая (осознанно)... генератор каталога скиллов... […]

---

#### 34. 🟡 `spec-vs-impl-4` — Product SPEC §4.5 числит в Skills Library два Deep-research скилла, которых в репозитории не существует

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** spec-vs-impl

**Противоречие:** §4.5 объявляет два скилла частью библиотеки («2, используются в Deep mode») с описаниями их пайплайнов. Ни `skills/product/deep-research-8-phase.md`, ни `skills/product/competitive-intel.md` в репозитории не существуют (find по всему дереву, исключая worktrees/node_modules, — пусто). […]

**Сторона A** — `docs/product-module/SPEC.md:456`
> - **`deep-research-8-phase.md`** — адаптация 199-biotechnologies для MR Deep

**Сторона B** — `skills/product/deep-research-8-phase.md` — **НЕ СУЩЕСТВУЕТ**

**Почему важно:** Это не отложенный дефолт, а мёртвая ссылка: способность реализована другой архитектурой (пайплайн внутри агента), поэтому эти скиллы не «ещё не написаны» — они не появятся никогда. §4.5 не несёт маркера deferred, в отличие от §14.3:1056. […]

**Вывод скептика:** Both sides verified first-hand. SPEC §4.5 (lines 454-457) enumerates two skills as present members of the Skills Library ("2, используются в Deep mode") with pipeline descriptions and no deferral marker; neither file exists on disk, in the git index, or in any worktree. […]

**🔧 Системный корень:** Cutting a planned artifact has no sweep obligation or deterministic checker binding design catalogs to the filesystem — commands get `gen:catalog:check` and skills get only a count floor (swap/rename passes silently, per the consciously-deferred DEF-CTX-5 skills-catalog generator), so DEC-DEV-0186's supersession landed in the journal and v1_1_backlog while the SSOT SPEC that names the phantom skills silently kept promising them.

---

#### 35. 🟡 `spec-vs-impl-5` — Команда /integrator:provision поставлена и ссылается на группу каталога SPEC, в которой её нет

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** doc-vs-code · **Класс:** spec-vs-impl · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** `commands/integrator/provision.md` существует, прошита (спавнит субагента `agents/integrator/deployer.md`) и явно заявляет своё членство в «SPEC §3.2 group». Каталог §3 SPEC'а (строки 108-181) перечисляет три группы и 13 команд — provision среди них нет ни в одной группе. В §3.2 «Modifying» стоят ровно add / remove / replace / update. Единственные упоминания provision в SPEC (строки 11, 299, 1004)  […]

**Сторона A** — `commands/integrator/provision.md:10`
> This is a **modifying** command (SPEC §3.2 group): it spawns the `deployer` subagent to *author* the deploy-setup + a CNT contract, then — behind an **approve gate** — persists them into the Integrator zone.

**Сторона B** — `docs/integrator-module/SPEC.md:110`
> 13 slash-команд разделены на три группы (добавлена `/integrator:scan` в итерации 3).

**Почему важно:** Обратный дрейф «код впереди SPEC» на команде с записью в Integrator-зону: SPEC — объявленный source of truth архитектуры, и его каталог не знает о поставленной модифицирующей команде. Ссылка provision.md на «§3.2 group» ведёт в группу, которая её не содержит,  […]

**Вывод скептика:** Фактическое ядро находки верифицировано полностью и своими глазами: provision.md поставлен, спавнит deployer, ссылается на «SPEC §3.2 group»; каталог §3 SPEC'а перечисляет 13 команд без provision, зато с replace, которого на диске НЕТ. git подтверждает механизм дрейфа: последний коммит SPEC.md  […]

**🔧 Системный корень:** Каталог команд ведётся вручную в SPEC §3 параллельно сгенерированному docs/guide/02-commands.md, но чекер (gen:catalog:check) есть только у генерируемой копии — поэтому ручной список тихо дрейфует, а его рукописный итог «13» замаскировал расхождение, совпав по числу при разъехавшемся в обе стороны составе.

---

#### 36. 🟡 `stale-refs-1` — Живой D7-гайд Session Audit ссылается на инженерный дизайн, уехавший в _archive

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** stale-reference · **Класс:** stale-refs

**Противоречие:** SESSION_AUDIT_GUIDE.md — живой гайд действующего механизма (не в _archive, не помечен как исторический) — даёт ссылку на инженерный дизайн по пути `dev/SESSION_AUDIT_V2_DESIGN.md`. Файла по этому пути нет: он лежит в `dev/_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md`. Ссылка битая. Тот же дизайн-документ вторым битым путём зовёт `dev/meta-improvement/rubrics/README.md:6`  […]

**Сторона A** — `dev/meta-improvement/SESSION_AUDIT_GUIDE.md:7`
> > Инженерный дизайн: [`../SESSION_AUDIT_V2_DESIGN.md`](../SESSION_AUDIT_V2_DESIGN.md). Решения: DEC-DEV-0056 / 0057 / 0059.

**Сторона B** — `dev/SESSION_AUDIT_V2_DESIGN.md` — **НЕ СУЩЕСТВУЕТ**

**Почему важно:** Гайд объявляет себя точкой входа в действующий механизм и делегирует «как это устроено внутри» дизайн-доку. Дизайн-док недостижим по объявленному пути, причём в ДВУХ живых файлах сразу (гайд + реестр rubrics). […]

**Вывод скептика:** The finding holds as stated. Two live, unmarked D7 docs point at dev/SESSION_AUDIT_V2_DESIGN.md, which does not exist at that path and is tracked only at dev/_archive/session-audit-v2/. The mechanism they document is live, so a reader following the link to fix or extend the classify contour hits a 404. […]

**🔧 Системный корень:** The 2026-06-14 reorg relied on a manual path-patch sweep with an exemption declared only for append-only history (DEV_JOURNAL/CHANGELOG), and no link-checker enforces doc pointers — so live docs outside that exemption silently kept dead paths, which is why four siblings got patched and these two did not.

---

#### 37. 🟡 `stale-refs-3` — SPEC интегратора разрешает открытый вопрос ссылкой на readiness-файл, которого нет

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** stale-reference · **Класс:** stale-refs

**Противоречие:** docs/integrator-module/SPEC.md — SSOT архитектуры (по CLAUDE.md: «docs/ — SPEC и каталоги. Source of truth для archteture») — фиксирует ОТКРЫТЫЙ вопрос о размещении `/integrator:update` и адресует его разрешение в `dev/PHASE_5_READINESS.md` §C.6. Файла по этому пути нет: он в `dev/_archive/phase-5/PHASE_5_READINESS.md`.

**Сторона A** — `docs/integrator-module/SPEC.md:1025`
> **Открытый вопрос (Phase 5 kickoff):** `/integrator:update` — ROADMAP относит его к Phase 5 (вместе с Installation, acceptance «detects drift»), историческая группировка модуля — к Maintenance. Финальное размещение подтверждается на kickoff (см. `dev/PHASE_5_READINESS.md` §C.6).

**Сторона B** — `dev/PHASE_5_READINESS.md` — **НЕ СУЩЕСТВУЕТ**

**Почему важно:** Открытый вопрос в SSOT-спеке — это долг, который кто-то однажды придёт закрывать; единственная координата ответа битая. Хуже: вопрос сформулирован в будущем времени («подтверждается на kickoff»), хотя Phase 5 и Phase 7 давно закрыты и Maintenance-группа в этой же таблице уже помечена «Phase 7 ✅»  […]

**Вывод скептика:** Дефект реален и полностью верифицирован мной лично: живой SSOT-спек архитектуры (a) формулирует в будущем времени вопрос, который де-факто разрешён DEC-DEV-0040 ещё 2026-05-25, и (b) адресует его разрешение по несуществующему пути. Обе половины проверены открытием обоих мест. […]

**🔧 Системный корень:** Архивирующий коммит и последующий link-sweep чинили только markdown-ссылки (href), оставив пути в голых code-span'ах невидимыми для правки, и ни один механизм не связывает разрешающее решение (DEC-DEV-0040) обратно с документом, который задал вопрос — поэтому закрытый вопрос остался стоять открытым с битой координатой.

---

#### 38. 🟡 `stale-refs-4` — README каталога audit-reports ссылается на команду через несуществующую директорию

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** stale-reference · **Класс:** stale-refs

**Противоречие:** `dev/meta-improvement/audit-reports/README.md` описывает себя как output-директорию для `/meta:audit-smoke` и линкует команду как `../commands/audit-smoke.md`, что резолвится в `dev/meta-improvement/commands/audit-smoke.md`. Директории `dev/meta-improvement/commands/` в репо не существует вовсе. Реальный файл команды — `.claude/commands/meta/audit-smoke.md`. […]

**Сторона A** — `dev/meta-improvement/audit-reports/README.md:3`
> Output directory for [`/meta:audit-smoke`](../commands/audit-smoke.md) and [`scripts/audit-smoke.js`](../scripts/audit-smoke.js).

**Сторона B** — `dev/meta-improvement/commands/audit-smoke.md` — **НЕ СУЩЕСТВУЕТ**

**Почему важно:** README каталога — первое, что читают, разбираясь, откуда берутся отчёты аудита. Ссылка обещает определение команды и ведёт в несуществующую директорию, создавая ложную модель топологии («команды D7 лежат в dev/meta-improvement/commands/»), которой в репо нет. Это же место — типовой источник копипасты пути в новые доки.

**Вывод скептика:** Находка подтверждена: я сам открыл оба места, цитата A дословна и на своей координате, отсутствие B верифицировано тремя способами. Ни одна гипотеза опровержения не прошла. Расследование дало более точную картину, чем у скаута. Это НЕ дрейф со временем — ссылка родилась битой. […]

**🔧 Системный корень:** Объявленная при планировании конвенция (DEC-DEV-0034: «D7-internal команды — в `dev/meta-improvement/commands/`») была молча отменена в момент реализации (файл уехал в `.claude/commands/meta/`) в том же коммите, что написал ссылку,  […]

---

#### 39. 🟡 `stale-refs-5` — В consumer-zone команде ссылка «See also» указывает не на тот файл (label ≠ href)

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** stale-reference · **Класс:** stale-refs

**Противоречие:** `commands/ecosystem/enable-d7-audit.md` — consumer-zone (по CLAUDE.md `commands/` попадает в `.claude/` пользователя). В разделе «See also» label ссылки заявляет `commands/meta/audit-smoke.md`, а href ведёт на `../../dev/meta-improvement/audit-reports/README.md` — то есть на README каталога отчётов, а не на команду. […]

**Сторона A** — `commands/ecosystem/enable-d7-audit.md:145`
> - [`commands/meta/audit-smoke.md`](../../dev/meta-improvement/audit-reports/README.md) (in ecosystem repo `.claude/commands/meta/audit-smoke.md`) — consumer side

**Сторона B** — `commands/meta/audit-smoke.md` — **НЕ СУЩЕСТВУЕТ**

**Почему важно:** Ссылка врёт дважды: label и href показывают на разные сущности, и ни одна не является определением команды. Отягчающее — зона доставки: файл копируется в проект пользователя, а href уходит в `dev/meta-improvement/**`, который по конвенции (CONVENTIONS §2/§9, «D7 dev-only, НЕ деплоится») в пользовательский проект не поп […]

**Вывод скептика:** Ядро находки — label ≠ href — подтверждено полностью и без оговорок: label обещает определение команды, href ведёт на README каталога отчётов, и ни одна из двух целей определением команды не является. Отягчающий аргумент скаута я проверил отдельно и он ФАКТИЧЕСКИ ВЕРЕН, но НЕ специфичен для этой строки. […]

**🔧 Системный корень:** Конвенция «путь в dev/ упоминается текстом с квалификатором (ecosystem repo), а не гиперссылкой» существует де-факто (строка 146 её соблюдает), но не имеет ни link-чекера в `npm run verify`, ни гейта — поэтому соседняя строка 145 нарушила её при первом же написании (ebb1902) и молча пережила два прицельных doc-drift-прохода.

---

#### 40. 🟡 `status-drift-1` — Гейт PHASE_6 объявляет S4 PASS, а его же цитируемый источник вердиктов — S4 PARTIAL (пересуд 0204)

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** status-drift · **Класс:** status-drift · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** Статус-баннер плана PHASE_6 сам делегирует авторитет вердиктов в `SMOKE_BATCH_2026-07-11_BRIEF.md` §Outcome («вердикты — ... §Outcome») и тут же объявляет «S4/S5/S7 PASS». Ровно этот §Outcome в брифе (стр. 190) говорит «S4 PARTIAL (было PASS; понижен пересудом 0204)». Коммит 3f477c2 (DEC-DEV-0204) провёл понижение и синхронизировал CLAUDE.md (стр. 29: «S2/S4 PARTIAL  […]

**Сторона A** — `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md:5`
> > **Статус:** 🟠 **прогнан частично 2026-07-11** (smoke-batch, DEC-DEV-0177; вердикты — `SMOKE_BATCH_2026-07-11_BRIEF.md` §Outcome): **S4/S5/S7 PASS · S2 PARTIAL**

**Сторона B** — `dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md:190`
> - **PHASE_6: S5/S7 PASS, S2 PARTIAL, S4 PARTIAL** *(было PASS; понижен пересудом 0204 — 1 из 4 критериев подтверждён, write-путь не упражнён)*

**Почему важно:** Меняет поведение: S4 — критерий закрытия гейта. Читающий план видит «PASS» и считает сценарий закрытым; на деле write-путь не упражнён и требуется догон. Файл гейта — та самая инстанция, куда идут за состоянием при решении «закрывать/догонять». […]

**Вывод скептика:** Противоречие реально и верифицировано своими глазами: в текущем дереве (HEAD cd298a3) баннер гейта в одной фразе делегирует вердикты в §Outcome брифа и тут же объявляет S4 PASS, тогда как ровно этот §Outcome говорит S4 PARTIAL. Коммит 0204 действительно синхронизировал пять зеркал и пропустил гейт-файл — это подтверждено `--stat`, а не пересказом. […]

**🔧 Системный корень:** Баннер гейта держит инлайн-копию вердиктов рядом с указателем на их источник вместо чистого pointer-collapse, поэтому sweep пересуда 0204 обновил цель указателя и все пять учтённых зеркал, но не имел ни списка, ни гейта, ни warn-хука, который заставил бы догнать несвёрнутую копию в `dev/gates/*`.

---

#### 41. 🟡 `terminology-1` — Глоссарий сам себе противоречит в раскладке доменов D1–D6 (сдвиг на единицу от D3)

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** terminology · **Класс:** terminology

**Противоречие:** В ОДНОМ И ТОМ ЖЕ файле-справочнике две строки задают разное соответствие «номер → домен». Строка 20 (таблица осей именования): D3=Build, D4=QA, D5=Ops, D6=Meta/Governance — совпадает с SSOT docs/pmo/pmo-map.md (D3 Development & Delivery, D4 Quality Assurance, D5 Operations & Feedback, D6 Meta: Ecosystem Governance). […]

**Сторона A** — `docs/guide/03-glossary.md:89`
> | **D1–D6** | Шесть управленческих доменов PMO: Discovery → Behavioral → Tech → Build → QA → Ops/Meta. |

**Сторона B** — `docs/guide/03-glossary.md:20`
> | **D1–D6** | Шесть управленческих доменов PMO (Discovery → Governance) | D1 Discovery · D2 Requirements&Design (сплит B/T/UI) · D3 Build · D4 QA · D5 Ops · D6 Meta/Governance | `D.1–D.6` (шаги Design) · `D1.1–D1.9` (шаги Discovery) · `D2-B01…` (обязанности PMO) |

**Почему важно:** 03-glossary.md — единственный справочник терминов, и его таблица осей существует ИМЕННО чтобы разводить похожие метки («Экосистема нумерует РАЗНЫЕ вещи похожими метками… Эта таблица разводит оси»). […]

**Вывод скептика:** Противоречие реально и воспроизводимо. Один и тот же файл-справочник даёт две несовместимые раскладки одной оси: :20 — канон (совпадает с pmo-map), :89 — сдвиг от D3 на единицу (D2 расщеплён на два слота Behavioral/Tech, D5 Ops и D6 Meta слиты в один D6). […]

**🔧 Системный корень:** Одна и та же сущность (раскладка D1–D6) записана дважды в двух независимых массивах одного overlay.json (`glossary` и `namingAxes`) без SSOT-указателя между ними и без чекера, сверяющего обе с каноном pmo-map.md, — тот же класс дефекта «правило записано дважды», что уже ловили в CLAUDE.md (DEC-DEV-0197 / D12), но в генерируемом слое доков.

---

#### 42. 🟡 `terminology-2` — Глоссарий объявляет D6 и D7 одним слоем под двумя именами — ровно то отождествление, которое канон запрещает как CRITICAL

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** terminology · **Класс:** terminology · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** Глоссарий (строка 29, колонка «Не путать с» для оси «Модули») утверждает, что мета-слой — ОДНА сущность, называемая D6 в PMO-карте и D7 в dev-доках, то есть D6 и D7 — синонимы с разной пропиской. CONVENTIONS §1.3 — канонический disambiguation, помеченный «CRITICAL — terminological collision risk»  […]

**Сторона A** — `docs/guide/03-glossary.md:29`
> | **Модули** | Top-level модули / namespace команд | Product · Design · Integrator · Orchestrator · Ecosystem | мета-слой = `D6` в PMO-карте, но `D7` в dev-доках (CLAUDE.md) |

**Сторона B** — `dev/meta-improvement/CONVENTIONS.md:38`
> | Concern | governance over **user's** PMO | governance over **Ecosystem 3.0 development** itself |

**Почему важно:** Это не косметика: D6 деплоится в пользовательские проекты, D7 — НИКОГДА (CONVENTIONS §2: «ALL D7 artifacts live в dev/meta-improvement/. NEVER deployed to user projects via bootstrap. NEVER в commands/, skills/, agents/, hooks/»). Отождествление их в справочнике  […]

**Вывод скептика:** The defect is real: a disambiguation table mis-disambiguates the one collision its canon flags CRITICAL, and it does so in a deployed doc whose corrective (CONVENTIONS §1.3) is dev-only and therefore invisible to that reader. But it is weaker than the scout framed, on two counts. First, the wording is ambiguous/lossy rather than an assertion of identity  […]

**🔧 Системный корень:** The D6/D7 disambiguation canon lives only in dev-only CONVENTIONS §1.3 with no pointer or generator link into the deployed glossary's overlay source, so the user-facing naming table restates the distinction from memory, loses its load-bearing half, and no check couples the two.

---

#### 43. 🟡 `terminology-3` — Зона делегирования во внешние инструменты объявлена как D3-D6, но SSOT перечисляет делегированными только D2-T/D3/D4/D5 — D6 внутренний

**Вердикт:** CONFIRMED · **Тяжесть:** medium · **Тип:** false-claim · **Класс:** terminology

**Противоречие:** README, CLAUDE.md и dev/meta-improvement/SPEC.md согласованно включают D6 в диапазон, отдаваемый ВНЕШНИМ инструментам через handoff/Integrator («внешние инструменты (D2-Technical, D3-D6)», «Tool-agnostic делегирование D2-Technical и D3-D6 во внешние инструменты», «handoff → D3-D6 через внешние инструменты»). SSOT docs/pmo/pmo-map.md перечисляет делегированные зоны иначе  […]

**Сторона A** — `README.md:27`
> Я детально контролирую процессы D1-D2 (продуктовая стратегия + поведенческая спецификация) через **Product Module** и **Design Module**, а внешние инструменты (D2-Technical, D3-D6) подключаются через **Integrator Module** и работают по принципу «я дал тебе всё о продукте через handoff  […]

**Сторона B** — `docs/pmo/pmo-map.md:152`
> ### Для D2-Technical / D3 / D4 / D5 (delegated, абстрактный контроль)

**Почему важно:** «D3-D6» — витринная формула проекта: она стоит в первой строке README (:3), в описании «Что строим» в CLAUDE.md (:15), в SPEC Интегратора (:13, :97 «ВНЕШНИЕ ИНСТРУМЕНТЫ (D2-Tech, D3-D6)»), в product-module/SPEC.md:35 и в meta-improvement/SPEC.md:26  […]

**Вывод скептика:** Противоречие реально и шире заявленного. SSOT (pmo-map.md, назначенный таковым в INFORMATION-MAP.yaml:101) устойчиво, в четырёх независимых местах, держит границу: owned = D1 + D2-Behavioral + D6; delegated наружу = D2-T + D3 + D4 + D5. Визуальная карта docs/MAP.md рисует ровно эту же границу. […]

**🔧 Системный корень:** Граница делегирования пересказана прозой в семи consumer-facing доках вместо указателя на объявленный SSOT (pmo-map.md), поэтому диапазонное сокращение «D3-D6» размножилось копированием, а реальный owned/delegated-раскол остался только в SSOT — и ни гейта, ни warn-хука, который ловил бы расхождение витрины с картой, нет.

---

#### 44. 🟡 `terminology-5` — pmo-map отправляет детальную декомпозицию D6 в dev/meta-improvement/ — дом D7, другого уровня

**Вердикт:** PARTIAL · **Тяжесть:** medium · **Тип:** stale-reference · **Класс:** terminology · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** pmo-map.md:117 объявляет, что детальная декомпозиция D6 живёт в `dev/meta-improvement/`, и в скобках отождествляет владение D6 с «D7 meta-improvement subsystem». CONVENTIONS §1.3 разводит прописки прямо противоположно: D6 живёт в пользовательских проектах (deployed via bootstrap), D7 — только в этом репо, в dev/, и НЕ деплоится. […]

**Сторона A** — `docs/pmo/pmo-map.md:117`
> **D6 Meta: Ecosystem Governance** — owned: Integrator Module + человек (D7 meta-improvement subsystem). Detailed decomposition — в `dev/meta-improvement/`.

**Сторона B** — `dev/meta-improvement/CONVENTIONS.md:39`
> | Lives | user projects (deployed via bootstrap) | этот repo, `dev/` only (NOT deployed) |

**Почему важно:** pmo-map.md — SSOT карты доменов (CLAUDE.md: «docs/ — SPEC и каталоги. Source of truth for archteture»), и именно он отсылает читателя за декомпозицией D6 по адресу, где по канону нет ни одного D6-артефакта: читатель уходит в dev/meta-improvement/, находит там Level B (ритуалы разработки экосистемы: phase-kickoff, proce […]

**Вывод скептика:** Ядро находки — реальное, но заякорено скаутом не туда, поэтому PARTIAL, а не CONFIRMED. Что устояло: строка 117 (а) глоссирует владение D6 как «(D7 meta-improvement subsystem)», хотя §1.3 разводит владельцев явно (D6 = «Integrator Module + user», Level A; […]

**🔧 Системный корень:** Дизамбигуация D6/D7 принуждается ТОЛЬКО прозой (§1.3 с меткой CRITICAL) — ни гейта, ни warn-хука, ни проверки кросс-док-указателей на существование адресата, поэтому написанная месяцем позже строка в SSOT-доке смогла отправить D6 в дом D7 по несуществующему адресу, и ничто этого не заметило.

---

#### 45. ⚪ `changelog-vs-delivery-5` — CONVENTIONS §11.1 объявляет словарь секций `Added | Fixed | Modified`, а CHANGELOG использует `### Changed`

**Вердикт:** PARTIAL · **Тяжесть:** low · **Тип:** terminology · **Класс:** changelog-vs-delivery · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** CONVENTIONS §11.1 (и зеркалящая её SSOT-таблица CLAUDE.md, где перечислены «имена секций `### Added | Fixed | Modified`») объявляет закрытый набор из трёх секций. Фактический CHANGELOG.md использует `### Changed` — секцию ВНЕ объявленного набора — как минимум трижды (в `[Unreleased]`, `[1.9.1]`, `[1.7.0]`; на origin/main — строки 37, 111, 234). […]

**Сторона A** — `dev/meta-improvement/CONVENTIONS.md:302`
> (consumer-facing, `### Added | Fixed | Modified`) + при наличии rationale — `DEC-DEV-NNNN`

**Сторона B** — `CHANGELOG.md:22`
> ### Changed

**Почему важно:** `[Unreleased]` — единственная корзина, из которой `patch-cut.md` режет релиз, поэтому словарь секций — часть cut-ритуала, а не украшение. Незакреплённый третий вариант (`Changed`) означает, что запись может уехать в секцию, которую чеклист не ожидает. […]

**Вывод скептика:** Ядро находки verifiable и устояло: доки перечисляют три секции, живой `[Unreleased]` использует четвёртую, и сами перечисления между собой не согласованы (CONVENTIONS §11.1 = 3 секции · patch-cut.md:38 = дословный дубль тех же 3 · скелет patch-cut.md:79-81 = только 2, без `Modified`). Читатель, взявший §11.1 буквально, будет введён в заблуждение о допустимом наборе. […]

**🔧 Системный корень:** Список секций скопирован дословно в три места (CONVENTIONS §11.1, patch-cut.md:38 и третий, суженный вариант в скелете patch-cut.md:79-81) без SSOT-указателя, и ни один чекер не парсит заголовки CHANGELOG — поэтому перечисление свободно разъехалось и с живым файлом, и само с собой.

---

#### 46. ⚪ `gate-code-vs-doc-5` — Комментарий в lesson-presence-gate.js называет warn дефолтом — код дефолтит в strict с 2026-07-11

**Вердикт:** CONFIRMED · **Тяжесть:** low · **Тип:** doc-vs-code · **Класс:** gate-code-vs-doc

**Противоречие:** Инлайн-комментарий на ветке PreToolUse помечает warn как «(default)». Фактический дефолт — strict: `const mode = (process.env.LESSON_GATE_MODE || 'strict').toLowerCase()` (строка 201), и заголовок того же файла это подтверждает — «SHIPS DEFAULTED TO STRICT (flipped 2026-07-11 ...)» (строки 13-14) и «unset | "strict" → PreToolUse denies mutating calls ... DEFAULT since 2026-07-11» (строка 38). […]

**Сторона A** — `hooks/product/lesson-presence-gate.js:240`
> // warn (default): non-blocking stderr nag.

**Сторона B** — `hooks/product/lesson-presence-gate.js:201`
> const mode = (process.env.LESSON_GATE_MODE || 'strict').toLowerCase();

**Почему важно:** Заявленная строгость не та: читатель кода на этой ветке заключает, что при незакрытом уроке мутирующие вызовы лишь получают stderr-нытьё, тогда как по умолчанию они DENY-ятся (строка 236, `denyJSON`). Поведение кода верное — врёт только комментарий, поэтому low; […]

**Вывод скептика:** The contradiction is real, and the scout characterized it precisely rather than overstating it — hence CONFIRMED, not PARTIAL. One file states its default mode in four places: line 13 ("SHIPS DEFAULTED TO STRICT"), line 23 ("Downgrade escape: env LESSON_GATE_MODE=warn"), line 38 ("DEFAULT since 2026-07-11"), and line 201 (the executable fallback). […]

**🔧 Системный корень:** One fact — the gate's default mode — is asserted in four places within a single file with no single source of truth and nothing that mechanically checks a comment against the code it annotates, so the 2026-07-11 flip updated the three prominent statements (header, MODE list, executable fallback) and silently left the fourth inline annotation contradicting them.

---

#### 47. ⚪ `precedence-dup-5` — INFORMATION-MAP routes «Когда CHANGELOG vs DEV_JOURNAL?» to a section that explicitly disclaims holding the rules, and to the diverging CONVENTIONS copy

**Вердикт:** PARTIAL · **Тяжесть:** low · **Тип:** stale-reference · **Класс:** precedence-dup · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** The information-topology resolver — the file whose whole job is «где ПРАВДА про X и кому верить, если копии разошлись» — names the SSOT for the CHANGELOG-vs-journal question as «CLAUDE.md §«Конвенции репозитория» + dev/meta-improvement/CONVENTIONS.md». But that CLAUDE.md section states the opposite about itself: it holds no rules and the SSOT is the Process triggers table. […]

**Сторона A** — `dev/INFORMATION-MAP.yaml:150`
> ssot: "CLAUDE.md §«Конвенции репозитория» + dev/meta-improvement/CONVENTIONS.md"

**Сторона B** — `CLAUDE.md:214`
> **SSOT — таблица «Process triggers — harness contract (D7)» выше. Здесь правил НЕТ, только указатель.**

**Почему важно:** This is the resolver of last resort — CLAUDE.md sends you here when the session digest is not enough and you are unsure where truth lives. For this one question it routes past the real SSOT and into the stale, stricter §11.1 copy, actively propagating the D12 defect instead of resolving it. […]

**Вывод скептика:** The contradiction is real but materially narrower than the scout claims, so PARTIAL, not CONFIRMED. What survives: the map's `dev-conventions` class lists, under `ssot:`, a location that by its own text is a pointer rather than a source — for one of its two `asks` questions  […]

**🔧 Системный корень:** The D12 pointer-collapse rewrote the rule's home but nothing re-validated the separate authority catalog that indexes it — no checker enforces the map's own ssot/mirrors distinction (P3 only promises a future guard that each `ssot:` path *exists*, never that the target actually holds rules rather than forwarding to another SSOT).

---

#### 48. ⚪ `stale-refs-2` — D7-паттерн smoke-test-plan ссылается на reference-инстанс, уехавший в _archive/phase-3

**Вердикт:** PARTIAL · **Тяжесть:** low · **Тип:** stale-reference · **Класс:** stale-refs · ⚠ *реально, но слабее заявленного скаутом*

**Противоречие:** Паттерн `smoke-test-plan.md` — живой (перечислен в SSOT-таблице паттернов CLAUDE.md с триггером «после реализации, до того как поверить в интеграцию») — в разделе «Related» подаёт `dev/PHASE_3_SMOKE_TEST_PLAN.md` как «instance 1 reference document». Файла по этому пути нет: он в `dev/_archive/phase-3/PHASE_3_SMOKE_TEST_PLAN.md`. […]

**Сторона A** — `dev/meta-improvement/patterns/smoke-test-plan.md:154`
> - [`dev/PHASE_3_SMOKE_TEST_PLAN.md`](../../PHASE_3_SMOKE_TEST_PLAN.md) — instance 1 reference document

**Сторона B** — `dev/PHASE_3_SMOKE_TEST_PLAN.md` — **НЕ СУЩЕСТВУЕТ**

**Почему важно:** Это единственный образец-эталон, который паттерн предлагает как «вот так выглядит правильный smoke-план». Паттерн обязателен к применению по триггеру из CLAUDE.md, то есть его читают именно в момент написания нового плана — и ровно тогда эталон недостижим. […]

**Вывод скептика:** Факт-ядро находки подтверждено полностью и своими глазами: живой, обязательный по триггеру CLAUDE.md паттерн держит в разделе «Related» ссылку на путь, по которому файла нет с коммита `ee9bbca` (Phase 4 K1 closure). Это настоящая stale-reference, опровергнуть её не вышло ни одной гипотезой. PARTIAL  […]

**🔧 Системный корень:** Переезд файла в `_archive` чинил обратные ссылки точечно — вручную и по памяти (SPEC.md и ROADMAP обновили, patterns/ пропустили), потому что у репо нет детерминированного чекера резолвимости относительных markdown-ссылок в цепи `npm run verify`, а паттерн `spec-drift-sweep.md` остаётся дисциплиной без гейта.

---

## 9. Опровергнутые находки (не чинить)

Скептик их отбил. Приведены для полноты: если они всплывут снова, вот почему они не находки.

#### `status-drift-3` (status-drift) — «Реестр открытых гейтов» в CLAUDE.md не содержит двух открытых гейтов из dev/gates/

- **Цитаты существуют:** да (дело не в подлоге)
- **Почему опровергнуто:** The evidence layer is clean — both quotes verbatim, both gate files real and open at this HEAD — but the finding does not survive contact with the repo's declared topology, and it dies three separate times over. Side B is the load-bearing half of the finding, and it is refuted outright by date arithmetic the scout never ran. CLAUDE.md's registry lives inside a section that opens by declaring ROADMAP the sole status source and stamps itself `last memory-sync: 2026-07-12`, a marker I confirmed agrees with ROADMAP's own «Последнее обновление: 2026-07-12». The EPIC_E gate was born 2026-07-13. A snapshot honestly stamped "as of the 12th" not containing a file created on the 13th is the staleness contract working — the marker is there precisely so the reader knows to go to git. The scout quoted the contract line's neighbour (line 26) while stepping over the contract itself (line 24), two lines up. Structurally, the repo already resolves this conflict by name. INFORMATION-MAP.yaml class `phase-gates` sets `ssot: dev/gates/*.md`, `verify: ls dev/gates/`, and files CLAUDE.md under `mirrors` — a field the document's own format spec defines as «НЕ источники» and principle P2 marks as lagging by design. That is the declared-precedence refutation class verbatim: the repo says who's right, names the verifier, and flags the second as the echo. Then the checkout itself. `48 0` and a successful `--is-ancestor` prove HEAD is a strict ancestor of origin/main with zero local commits — not a working branch, a moment in the past. On origin/main the registry is visibly maintained (both 🟠 entries flipped to ✅ ЗАКРЫТ 2026-07-15). This is the "historical record" refutation class in its purest form: the audited tree IS history. Confirming would dispatch the owner to repair a state that no longer exists and was superseded by the very maintenance the finding says is missing. Finally, the scout's central image — "a registry 2/3 closed that has inverted its purpose" — is factually wrong. Three of six are closed, not four; two entries (PATCH_1.3.3 🟠, PHASE_6 🟠) are genuinely open gates being tracked with live per-scenario verdicts. The registry is discharging its stated function, and the ✅ rows carry closure dates and DEC-DEV refs, so they inform rather than mislead. The scout's own hedge ("уверенность ниже, чем у находок 1-2 ... на origin/main оба гейта закрыты") was the correct instinct. What remains is thin and real but not the claim: SUBSTRATE_GRADUATION_GATE predates the sync marker, so lag-by-date doesn't excuse it, and INFORMATION-MAP's «перечисляет активные gates» overstates a mirror that lists two of four. But the status SSOT carries it — I confirmed «run-ledger live (компонент 2 graduation-гейта)» literally present in ROADMAP's remainder queue — so a reader following declared topology loses nothing. A lagging mirror failing to echo an item its SSOT holds is the documented cost of the pointer-collapse design, consciously accepted. That is a design tradeoff, not a defect, and it is nowhere near the bar for PARTIAL on a finding whose quoted evidence, arithmetic, and target tree all fail independently. Rule 4 applies with room to spare: threshold high, false confirmation costlier than a miss.

#### `inventory-sync-2` (inventory-sync) — verify.md contradicts itself on warn mode: Step 8.5 says 🟡 loud, Step 9's «Healthy» summary prints ✓ for the same state

- **Цитаты существуют:** да (дело не в подлоге)
- **Почему опровергнуто:** The scout conflated two distinct meanings of the overloaded word "warn" and never read the sentence that separates them. Step 8.5's 🟡 rule governs an ENV DOWNGRADE (`LESSON_GATE_MODE=warn|off` set); Step 9's example labels a PRONG SHIP-DEFAULT under the "Strict Stop, warn PreToolUse" decision with env unset. Line 189 states in so many words that the latter is "expected, not a defect" and instructs "Flag only the Stop prong being non-strict, or hooks missing entirely." The single-env-var finding makes this airtight: Stop=strict on line 220 is only possible when the var is unset, so lines 220-221 depict a state Step 8.5 rules ✓ — not one it rules 🟡. Same file, same command, but NOT the same state, and therefore not opposite verdicts. No self-contradiction exists. Threshold for CONFIRMED not remotely met. SEPARATE REAL DEFECT FOUND — worth its own finding, different sides, different class, do NOT fold into this one: verify.md:189 and :221 are STALE relative to shipped code. The owner flipped lesson-presence-gate warn→strict on 2026-07-11 (commit 4cfffae, DEC-DEV-0177 Outcome, after the S-LE re-run PASS); `git merge-base --is-ancestor` confirms it is live in HEAD. The hook header now reads "unset | \"strict\" → PreToolUse denies mutating calls ... DEFAULT since 2026-07-11" and manifest.yaml says "SHIPS DEFAULTED TO STRICT". But 4cfffae did NOT touch verify.md (verified via git show --stat), so: (a) line 221's "(PreToolUse+UPS, warn)" now misreports the shipped default, and (b) line 189's carve-out is stale RATIONALE — its own precondition "until the S-LE live smoke confirms the deny contract" was satisfied 2026-07-11, dissolving the carve-out it justifies. Sides are verify.md vs hook code/manifest — a third party the scout never cited, not Step 8.5 vs Step 9. Class: doc-vs-code / stale-rationale, severity ~medium (doc drift; verify is model-rendered narration, no enforcement changes). Systemic root of THAT defect: the warn→strict flip updated the hook and its manifest but had no sweep for downstream doc consumers naming the prong's mode.

#### `terminology-4` (terminology) — docs/MAP.md в одной диаграмме отдаёт D6 и Оркестратору, и Интегратору с человеком

- **Цитаты существуют:** да (дело не в подлоге)
- **Почему опровергнуто:** Находка держится на одном логическом шаге — «владение и запуск взаимоисключающи» — и именно этот шаг репо опровергает явно и намеренно. Ось Integrator/Orchestrator в экосистеме определена как «оснащает vs запускает»; скаут сам её цитирует (§8.3, §1.3), но применяет как раз наоборот. Под этой оптикой «D6 владеют Интегратор+человек» и «Оркестратор запускает» сосуществуют так же, как для D3-D5, где владелец = «внешние инструменты через Integrator», а запускает Оркестратор — и это никто противоречием не считает. Добивает топология: D6 вынесен ЗА пределы subgraph EXT «🔵 Delegated via Integrator», ребро ORC ведёт только в EXT, ребра ORC→D6 в блоке нет — т.е. диаграмма уже кодирует «D6 не делегирован и не оркеструется» правильно. Плюс SPEC:4 говорит «runtime-владелец» — квалификатор, которым репо специально наслаивает runtime-исполнение поверх функционального владения pmo-map. Остаточная неточность есть: pmo-map:4 явно перечисляет delegated = D2-T, D3, D4, D5 и метит D6 как owned, так что шорткат «D3-D6» широковат. Но он одинаково стоит в README:3/:125, CLAUDE:15, docs/README:20 (дословно та же формулировка про Оркестратор), product-module SPEC:35 и integrator SPEC:13 — это общерепозиторный идиом, а не противоречие внутри одной картинки, и скаут сам относит его к соседней находке («тот же корень, что у находки про D3-D6»). Как самостоятельная находка эта — переформулировка соседней на оси владения, которая не держится. Порог CONFIRMED не пройден с большим запасом; по правилу «при сомнении — REFUTED» тем более.

---

## 10. Приложение: журнал прогона

```
Запускаю 13 скаутов по классам противоречий (opus, read-only)
Скауты вернули 58 сырых находок
дубль отброшен: gate-code-vs-doc-3 — CONVENTIONS §11.1 требует CHANGELOG на КАЖДОЕ смёрженное изменение — SSOT-таблица CLAUDE.md объявляет `docs:` НЕ триггером
дубль отброшен: gate-code-vs-doc-4 — Определение consumer-zone в таблице CLAUDE.md уже, чем зона в коде гейта: `.env.template` и `gitignore.template` блокируют, но не перечислены
дубль отброшен: inventory-sync-3 — CLAUDE.md footnote describes a skills floor in verify.md that does not exist, and calls DEF-CTX-5 deferred when it is closed
дубль отброшен: changelog-vs-delivery-2 — Integrator SPEC говорит «12 команд», фактически 13 — `/integrator:provision` доставлен, но счётчик не обновлён
дубль отброшен: changelog-vs-delivery-3 — Product SPEC противоречит сам себе: «23 команды» в §3.2 и «22 команды» в теле того же файла
дубль отброшен: enforcement-claims-1 — /ecosystem:verify инструктирует НЕ флагать warn-режим presence-gate как дефект — ссылаясь на ship-default, которого в коде больше нет
дубль отброшен: enforcement-claims-5 — Внутри самого хука комментарий помечает fall-through ветку как «warn (default)», хотя дефолт в 39 строках выше — strict
После дедупа по координатам: 51
Верификация: 51 независимых скептиков (opus), правило «при сомнении = REFUTED»
Вердикты: CONFIRMED 34 · PARTIAL 14 · REFUTED 3 (из них с несуществующими цитатами: 0)
```

**Ресурсы прогона:** 64 агентов · 4 679 515 токенов субагентов · 894 вызовов инструментов.

**Сырые данные:** транскрипты и per-agent результаты — `journal.jsonl` в директории прогона `wf_fbbf9169-9a4` (вне репо, живут до очистки сессии).
