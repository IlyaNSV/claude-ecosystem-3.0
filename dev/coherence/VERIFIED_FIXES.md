# Верифицированные правки — волны B/C трека когерентности

> **Что это.** Готовые к применению правки, **пере-верифицированы против `main` @ `7ad4888`** восемью субагентами (opus, read-only) 2026-07-17. Каждый `old_string` скопирован **байт-в-байт из файла** и проверен на уникальность (`grep -cF` = 1).
>
> **Зачем файл существует.** Первая редакция шва отправляла продолжателя за этими правками «в транскрипт сессии» — то есть в место, которое ему недоступно (чтение транскрипта переполняет контекст, харнесс предупреждает об этом явно). Верификация стоила ~750k токенов; без этого файла она сгорала бы целиком при каждом продолжении. **Улика в пользу правила: результат работы субагента, не записанный на диск, не существует.**
>
> **Дисциплина применения.** Реестр снят на другой ветке — перед каждой правкой проверь, жива ли она (`grep -cF '<old_string>' <файл>` → должно быть `1`). Координаты строк **не используй** — они дрейфуют; матч по тексту.

---

## ⚠ Читать до первой правки

1. **`docs/guide/03-glossary.md` — ГЕНЕРИРУЕТСЯ.** Правка в него будет затёрта и уронит `verify`. Источник — `docs/guide/ecosystem-map.overlay.json`.
2. **`docs/guide/ecosystem-map.overlay.json` — источник ТРЁХ артефактов:** `gen:map` → `ecosystem-map.html`, `gen:procmap` → `ecosystem-processes.html` (читает тот же overlay, хотя имя не намекает), `gen:glossary` → `03-glossary.md`. После правки overlay — **все три генератора**, иначе `verify` падает STALE.
3. **`check-counts` теперь STRICT** (DEC-DEV-0220-a) и вызывается из блокирующего `process-gate`. Правка, меняющая число команд/хуков/скиллов в доке, обязана сходиться с диском. Тумблер: `COUNTS_EXTENDED_STRICT=0`.
4. **CRLF-файлы** (`verify.md`, `processes.md`, `self-correction.md`, скиллы Product/Design, гейт-планы): `old_string` держать **однострочным** — перенос на соседнюю строку сломает матч.
5. **Правка consumer-zone ⇒ CHANGELOG обязателен** (`process-gate` блокирует `feat:`/`fix:` без него). `dev/` — НЕ consumer-zone (урок 70).

---

## Кластер terminology (4 находки) — все LIVE

### terminology-1 — глоссарий врёт в раскладке D1–D6

**Правка в `docs/guide/ecosystem-map.overlay.json`** (НЕ в `03-glossary.md`!). Сдвиг на единицу: D2 расщеплён на два слота, из-за чего D5 и D6 слиты в «Ops/Meta».

```
old_string: ["D1–D6", "Шесть управленческих доменов PMO: Discovery → Behavioral → Tech → Build → QA → Ops/Meta."],
new_string: ["D1–D6", "Шесть управленческих доменов PMO: D1 Discovery → D2 Requirements&Design (сплит B/T/UI) → D3 Build → D4 QA → D5 Ops → D6 Meta/Governance. Раскладка и владение (owned / delegated) — SSOT docs/pmo/pmo-map.md."],
```
Вокабуляр взят байт-в-байт из сиблинг-строки того же overlay (`D3 Build · D4 QA · D5 Ops · D6 Meta/Governance`) — третий вариант терминов не вводится.

### terminology-2 — D6 и D7 объявлены одним слоем под двумя именами

**Правка в `docs/guide/ecosystem-map.overlay.json`.**

```
old_string: "notWith": "мета-слой = `D6` в PMO-карте, но `D7` в dev-доках (CLAUDE.md)"
new_string: "notWith": "`D6` Meta: Ecosystem Governance (управление PMO проекта — Integrator Module + человек) ≠ `D7` meta-improvement (разработка самой экосистемы — dev-only, НЕ деплоится). Разные слои, не синонимы"
```
**Почему self-contained, а не указатель:** `docs/` едет в `.claude/` пользователя, а `dev/` — никогда. Ссылка на `CONVENTIONS §1.3` была бы для читателя-пользователя висячей.

### terminology-3 — зона делегирования D3-D6 вместо D3-D5

SSOT (`pmo-map.md:4`) относит **D6 к owned**-зоне; `docs/MAP.md` рисует D6 **вне** subgraph делегированных. Три сайта в `README.md` — править все, иначе README останется сам себе противоречив:

```
old_string: а внешние инструменты (D2-Technical, D3-D6) подключаются через
new_string: а внешние инструменты (D2-Technical, D3-D5) подключаются через
```
```
old_string: tool-agnostic делегирование D2-Tech и D3-D6 внешним инструментам через универсальный handoff.
new_string: tool-agnostic делегирование D2-Tech и D3-D5 внешним инструментам через универсальный handoff.
```
```
old_string: 2. **Tool-agnostic для D2-Tech и D3-D6** (DEC-A06). Внешние инструменты заменяемы через Integrator.
new_string: 2. **Tool-agnostic для D2-Tech и D3-D5** (DEC-A06). Внешние инструменты заменяемы через Integrator.
```
**D5 остаётся в диапазоне намеренно** — его отложенность в v2 (DEC-P08) про *активацию*, не про владение. **DEC-A06 — про принцип tool-agnostic, а не про числовой диапазон**, поэтому сужение ссылку не искажает.

⚠ **`docs/MAP.md:50`** (`ORC["…запуск D3-D6"]`) — **НЕ трогать**: там ось Orchestrator «запускает», рядом уже погибла находка скептика. Требует отдельного суждения.

Сиблинг-сайты того же дрейфа (проверить и решить отдельно): `CLAUDE.md`, `dev/meta-improvement/SPEC.md`, `docs/integrator-module/SPEC.md` (×3), `docs/product-module/SPEC.md`, `docs/README.md`.

### terminology-5 — pmo-map шлёт за декомпозицией D6 в дом D7

```
old_string: **D6 Meta: Ecosystem Governance** — owned: Integrator Module + человек (D7 meta-improvement subsystem). Detailed decomposition — в `dev/meta-improvement/`.
new_string: **D6 Meta: Ecosystem Governance** — owned: Integrator Module + человек. Governance над PMO **пользователя** (deployed в проект). Функциональная декомпозиция D6-NN пока не детализирована (статус «Проектируется»; на практике — Integrator manual). **Не путать с D7 (meta-improvement)** — управление разработкой самой экосистемы: другой слой, живёт в `dev/` этого репо и в пользовательские проекты НЕ деплоится.
```
**Два факта, усиливающие находку:** (1) адресат **сам себя дезавуирует** — `dev/meta-improvement/SPEC.md` трижды говорит «D6 = integrator-module», то есть pmo-map шлёт читателя в док, который отказывается быть домом D6; (2) для развёрнутого пользователя путь физически не существует. Декомпозиции `D6-NN` **не существует нигде** (grep пуст) — поэтому новый указатель не ставим, честно пишем «не детализирована».

---

## Кластер spec-vs-impl (5 находок) — все LIVE

### 🔗 #1 и #5 применять ТОЛЬКО ВМЕСТЕ

**Почему это связка, а не два пункта.** `check-counts` парсит **литерал «13 slash-команд» против числа файлов на диске** — состав каталога он не читает. Сейчас число сходится случайно: фантомный `replace` компенсирован неучтённым `provision`. Применишь одну правку из двух — каталог станет 14 пунктов при заголовке «13», и **ни один чекер этого не поймает**. Гейт защищает от неверного числа, но не от полуприменённого фикса.

### spec-vs-impl-1 — SPEC обещает `/integrator:replace`, которой нет

Факт: `commands/integrator/replace.md` **не существует** (ни на диске, ни в `git ls-files`). §9 и §13.1 того же SPEC уже говорят «не реализована (G14)».

```
old_string: **`/integrator:replace <old> <new>`** — заменить один инструмент другим
- Комбинация remove + add, но с миграцией данных и переносом контрактов

new_string: **`/integrator:replace <old> <new>`** ⏳ — заменить один инструмент другим
- Комбинация remove + add, но с миграцией данных и переносом контрактов
- ⏳ **Спроектирована, НЕ поставлена** (cut v1.1+, DEC-DEV-0176; trigger — 2-й D2-Tech инструмент). `commands/integrator/replace.md` отсутствует; в число поставленных команд не входит. См. §9 и §13.1
```
```
old_string: 13 slash-команд разделены на три группы (добавлена `/integrator:scan` в итерации 3).
new_string: 13 slash-команд разделены на три группы (добавлена `/integrator:scan` в итерации 3). Число = поставка на диске (`commands/integrator/`); пункты с пометкой ⏳ спроектированы, но не поставлены и в это число НЕ входят.
```
Доп. сайт того же дрейфа: дерево файлов §10 содержит `replace.md` и не содержит `provision.md`/`scan.md`.

### spec-vs-impl-5 — поставленная `/integrator:provision` отсутствует в каталоге SPEC

Обратный дрейф: код впереди SPEC. Вставка в конец §3.2 (после записи `update`):

```
old_string: **`/integrator:update <tool>`** — обновить версию инструмента (OQ-I6)
- Вход: имя + опционально целевая версия
- Этапы: backup config → install new → verify contracts → detect drift → update contracts → verify → approve
- Если drift нерешаемый — rollback

new_string: **`/integrator:update <tool>`** — обновить версию инструмента (OQ-I6)
- Вход: имя + опционально целевая версия
- Этапы: backup config → install new → verify contracts → detect drift → update contracts → verify → approve
- Если drift нерешаемый — rollback

**`/integrator:provision <capability>`** — оснастить deploy-capability (D3-05 / D3-06) для пилота фабрики
- Вход: `deploy-staging` | `deploy-prod-stub`
- Спавнит субагента `deployer`: авторит systemd-шаблоны + `releases/<ts>`+`current` layout + prisma-migrate шаг + healthcheck-спеку + DRAFT CNT-контракт; персистит под approve-гейтом
- **Только оснащает, НЕ исполняет деплой** (граница §8.3): исполнение — процесс Оркестратора `deploy-to-stage`
- Internal capability provider — санкционированный fallback, см. §8.4 (DEC-DEV-0218)
```

### spec-vs-impl-2 — Deep-субагенты построены, но числятся отложенными

Факт: `agents/product/market-researcher.md` и `agents/product/competitor-analyst.md` **существуют**, прошиты в `discovery-session.md` + `init.md --deep`, покрыты смоуком в цепи `verify`.

```
old_string: - [ ] Subagents: `market-researcher.md`, `competitor-analyst.md` — Deep mode (v1.1)
new_string: - [x] Subagents: `market-researcher.md`, `competitor-analyst.md` — Deep mode **построен** (bring-forward DEC-DEV-0186; 8-фазный MR + 6-стадийный CA пайплайн внутри промптов агентов; смоук `tests/product/deep-discovery-agents-wiring.test.cjs`)
```
⚠ Заголовок §14.3 «Deep deferred к v1.1» **не трогать** — он остаётся частично правдивым (MCP Firecrawl/Exa и acceptance не закрыты). Флип заголовка = суждение владельца.

### spec-vs-impl-3 — построенный `html-fallback.md` числится «будущим»

Факт: `skills/design/html-fallback.md` существует, диспатчится из `design-session.md`, входит в объявленные «10 methodology files».

```
old_string: - `html-fallback.md` (когда все MCP недоступны — HTML/React artifact generation)
- `ir-export.md` / `ir-import.md` (v2 — IR neutral representation, §16)

new_string: - `ir-export.md` / `ir-import.md` (v2 — IR neutral representation, §16)
```
```
old_string: - [ ] Skill `html-fallback.md` (resilience путь)
new_string: - [x] Skill `html-fallback.md` (resilience путь) — построен (v1.0 minimal per DEC-DEV-0052 C4)
```
Строка про «отключить Stitch MCP» остаётся `[ ]` — она про валидацию, а не про существование файла.

### spec-vs-impl-4 — SPEC числит два фантомных скилла членами библиотеки

Факт: `deep-research-8-phase.md` / `competitive-intel.md` **не существуют и не будут** — пайплайн встроен в промпты субагентов (DEC-DEV-0186). `dev/v1_1_backlog.md` прямо называет это «spec-дрейф».

```
old_string: ### 4.5 Deep Research skills (2, используются в Deep mode)

- **`deep-research-8-phase.md`** — адаптация 199-biotechnologies для MR Deep
- **`competitive-intel.md`** — pipeline для CA Deep (semantic search + scraping + synthesis)

new_string: ### 4.5 Deep Research skills — CUT (DEC-DEV-0186)

Отдельные скиллы `deep-research-8-phase.md` / `competitive-intel.md` **не строились и не будут**:
8-фазный пайплайн MR и 6-стадийный пайплайн CA легли **внутрь** промптов субагентов
`agents/product/market-researcher.md` / `agents/product/competitor-analyst.md` — отдельный
lazy-load skill-слой не нужен. См. `dev/v1_1_backlog.md` и DEV_JOURNAL DEC-DEV-0186.
```
```
old_string: - [ ] Skills: deep-research-8-phase, competitive-intel — Deep mode (v1.1)
new_string: - ~~Skills: deep-research-8-phase, competitive-intel~~ — **CUT (DEC-DEV-0186)**: пайплайн встроен в промпты субагентов; отдельный skill-слой не нужен
```
Третий сайт того же фантома: `docs/pmo/artifacts/MR.md` числит `deep-research-8-phase.md` как «deferred to v1.1+».

---

## Кластер stale-refs (6 находок) — 5 LIVE, 1 CHANGED

### stale-refs-1 — дизайн-док уехал в `_archive` (две половины)

```
old_string: > Инженерный дизайн: [`../SESSION_AUDIT_V2_DESIGN.md`](../SESSION_AUDIT_V2_DESIGN.md). Решения: DEC-DEV-0056 / 0057 / 0059.
new_string: > Инженерный дизайн: [`../_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md`](../_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md) (архивирован — механизм живой, дизайн-док исторический). Решения: DEC-DEV-0056 / 0057 / 0059.
```
(файл `dev/meta-improvement/SESSION_AUDIT_GUIDE.md`)

```
old_string: > Дизайн: [`../../SESSION_AUDIT_V2_DESIGN.md`](../../SESSION_AUDIT_V2_DESIGN.md) §6.0 · решения: DEC-DEV-0056 (Инкр.1) → **DEC-DEV-0059 (Инкр.3a re-anchor)**.
new_string: > Дизайн: [`../../_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md`](../../_archive/session-audit-v2/SESSION_AUDIT_V2_DESIGN.md) §6.0 · решения: DEC-DEV-0056 (Инкр.1) → **DEC-DEV-0059 (Инкр.3a re-anchor)**.
```
(файл `dev/meta-improvement/rubrics/README.md`)

Квалификатор «архивирован» добавлен намеренно: линк из живого дока в `_archive` без него читается как «механизм мёртв».

### stale-refs-2 — паттерн ссылается на уехавший reference-инстанс

```
old_string: - [`dev/PHASE_3_SMOKE_TEST_PLAN.md`](../../PHASE_3_SMOKE_TEST_PLAN.md) — instance 1 reference document
new_string: - [`dev/_archive/phase-3/PHASE_3_SMOKE_TEST_PLAN.md`](../../_archive/phase-3/PHASE_3_SMOKE_TEST_PLAN.md) — instance 1 reference document
```
(файл `dev/meta-improvement/patterns/smoke-test-plan.md`)
⚠ Второй сайт — заголовок `### Instance 1: Phase 3 (DEC-DEV-0014 + dev/PHASE_3_SMOKE_TEST_PLAN.md)` — **не трогать**: правка ломает якорь, а это описание исторического инстанса, не навигация.

### stale-refs-4 — ссылка родилась битой

Директории `dev/meta-improvement/commands/` **не существует и не существовало** (конвенция DEC-DEV-0034 отменена в момент реализации). Цель живёт в `.claude/commands/meta/audit-smoke.md` и **tracked в git** — законная цель.

```
old_string: Output directory for [`/meta:audit-smoke`](../commands/audit-smoke.md) and [`scripts/audit-smoke.js`](../scripts/audit-smoke.js).
new_string: Output directory for [`/meta:audit-smoke`](../../../.claude/commands/meta/audit-smoke.md) and [`scripts/audit-smoke.js`](../scripts/audit-smoke.js).
```
(файл `dev/meta-improvement/audit-reports/README.md`)

### stale-refs-5 — label ≠ href, и это consumer-zone

**Самая рискованная правка кластера.** Файл копируется в `.claude/` пользователя, поэтому относительный href в `dev/**` там **битый by design** (D7 не деплоится). Чинить **де-линковкой**, а не переуказанием href:

```
old_string: - [`commands/meta/audit-smoke.md`](../../dev/meta-improvement/audit-reports/README.md) (in ecosystem repo `.claude/commands/meta/audit-smoke.md`) — consumer side
new_string: - `.claude/commands/meta/audit-smoke.md` (ecosystem repo) — the audit command itself
```
(файл `commands/ecosystem/enable-d7-audit.md`; соседняя строка уже соблюдает эту конвенцию)

**Важно для S2:** эту находку **не поймает никакой link-checker** — href резолвится прекрасно, врёт label. Системный корень «нет link-чекера» для неё неверен.

### precedence-dup-5 — резолвер маршрутизирует мимо настоящего SSOT

`dev/INFORMATION-MAP.yaml` бандлит два вопроса с разными SSOT; «когда CHANGELOG vs DEV_JOURNAL» отправляется в `CLAUDE.md §«Конвенции репозитория»`, который **сам говорит**: «правил НЕТ, только указатель».

```
old_string:     asks: "Конвенции коммитов/именования/записи? Когда CHANGELOG vs DEV_JOURNAL?"
    ssot: "CLAUDE.md §«Конвенции репозитория» + dev/meta-improvement/CONVENTIONS.md"
    verify: "обе секции; D6/D7 disambiguation — CONVENTIONS.md §1.3"
new_string:     asks: "Конвенции коммитов/именования/записи?"
    ssot: "dev/meta-improvement/CONVENTIONS.md"
    note: "«Когда CHANGELOG vs DEV_JOURNAL» — НЕ здесь: триггеры обязательств живут в классе process-triggers (CLAUDE.md §«Process triggers»). CLAUDE.md §«Конвенции репозитория» — указатель, правил не держит (DEC-DEV-0197 / D12)."
    verify: "CONVENTIONS.md; D6/D7 disambiguation — §1.3"
```
YAML — LF, отступ 4 пробела. **Почему это важнее, чем выглядит:** это резолвер последней инстанции, к которому идут ровно тогда, когда копии разошлись — а он сам распространяет дефект D12, который призван разрешать.

### stale-refs-3 — CHANGED, требует решения владельца

Координата уехала; вопрос, объявленный «открытым», **закрыт DEC-DEV-0040 Q2 ещё 2026-05-25** (три источника: архивный readiness, frontmatter `commands/integrator/update.md`, таблица выше по файлу). Правка **меняет смысл в SSOT-спеке** → см. блок решений владельца в `SEAM.md`. Минимальный вариант — починить только путь на `dev/_archive/phase-5/PHASE_5_READINESS.md`.

---

## Кластер PHASE_4 R1 — долг требует создать созданное

Паттерн `da-subagent-type-contract.md` создан 2026-06-12 (DEC-DEV-0064); корневой фикс — в `skills/product/feature-session.md`.

```
old_string: ### R1 — Codify D7 pattern «DA subagent_type contract»
new_string: ### R1 — `[FIXED]` Codify D7 pattern «DA subagent_type contract»
```
Вторая правка — тело R1 (`dev/tech-debt/PHASE_4.md`): зачеркнуть требование и записать два фактических исхода — (1) паттерн создан, status `provisional`; (2) корневой фикс — канонический сниппет `subagent_type: "product-devils-advocate"` + anti-patterns #9/#10 в `feature-session.md`. **Не построена** enforcement-нога (hook-side validation на naming convention) — паттерн остаётся `provisional`.

⚠ **`E1 [OPEN]` НЕ флипать** — паттерн сам объявляет себя `provisional` до подтверждения пилотной сессией; флип был бы тем же завышением вердикта, против которого заведена находка.

---

## Кластер B.1 (5 находок) — все LIVE

**Четыре правки низкорисковые и аддитивные** — добавляют inline frontmatter-шаблон + anti-pattern-список по канону `docs/pmo/artifacts/<TYPE>.md`:

| Находка | Файл | Чего не хватает |
|---|---|---|
| `artifact-schema-1` | `skills/product/vp-design.md` | **ноль YAML во всём файле** — отсутствуют все 10 полей VP + весь anti-pattern-список |
| `artifact-schema-4` | `skills/product/segment-discovery.md` | 7 из 12 полей, дальше литеральное `...`; нет `value_proposition`, `jtbd_count`, `created`, `updated`, `version`; anti-pattern'ов ноль |
| `artifact-schema-2` | `skills/design/design-session.md` | NM: проза вместо шаблона; нет `title`, **`confidence`** (обязательное — C2), `confidence_notes`, `created`, `updated`, `version`. **NM по этой строке детерминированно упрётся в `artifact-validate.js`** |
| `artifact-schema-5` | `skills/design/design-session.md` | MK: 8 из 20 полей; нет `title`, `confidence_notes`, migration-trail (`previous_tools`/`tool_switched_at`/`ir_snapshot_path`) |

Полные шаблоны — восстанавливаются из канонов `docs/pmo/artifacts/{VP,SEG,NM,MK}.md` секция «Frontmatter Schema». Anti-pattern-список обязателен рядом с шаблоном (`CLAUDE.md` §«Skill конвенции»).

**`artifact-schema-3` (тело PS) — НЕ применять автономно.** См. решения владельца в `SEAM.md`.

**Нарушителей больше, чем 5 в реестре** (тот же класс, не зарегистрированы): `skills/product/market-research-protocol-quick.md` (→ MR, ноль YAML), `skills/product/competitive-analysis-protocol-quick.md` (→ CA, то же), `skills/design/app-map-generate.md` (→ AM, пограничный — генератор). **6 канонических типов не имеют шаблона нигде:** VP, MK, NM, MR, CA, AM.

---

## Кластер precedence-dup — дубли обязательств (для S5)

**12 дублей, три независимых кластера.** Схлопывать в указатели:

| Кластер | Координаты | Расхождение |
|---|---|---|
| accumulation contract + словарь секций | `CONVENTIONS.md` §11.1 (×2), `checklists/patch-cut.md` (×2, +скелет) | универсальный квантор «каждое смёрженное изменение» — **строже кода** |
| memory-sync activation | `CONVENTIONS.md` §3, §4, §6 | «Manual» / «manual run still default» — DEC-DEV-0100 это перевернул |
| ростер паттернов | `CONVENTIONS.md` §2 («8 patterns»), §3 («5»), §7 («5» + перечень) | факт **9**; `CLAUDE.md` уже исправился на 9 |
| membership consumer-zone | `CLAUDE.md` таблица (у́же кода: нет `.env.template`, `gitignore.template`) | **прав код** (`process-gate.js` регекс `CONSUMER_ROOT`) |

**Формулировка кросс-файловой precedence обязана нести границу:** «предметные каноны (структура артефакта, ростер паттернов, реестр долгов) этим правилом НЕ поглощаются — у них свои SSOT». Без границы правило объявит `CLAUDE.md` владельцем всего репо и воспроизведёт лечимую болезнь.

**Факт, меняющий постановку S5:** односторонний кросс-файловый указатель **уже существует** — `CONVENTIONS.md:8` («Operational SSOT для harness = CLAUDE.md «Process triggers»»). Проблема не в отсутствии декларации, а в том, что она **не исполнена**. ⇒ смена формулировки без схлопывания копий не даст ничего.

**Ростер паттернов — чекер НЕ строить:** `check-counts.js` осознанно отказался от вида `pattern` (неустранимый омоним). Лечение — не плодить копию.
