# DESIGN — /product:browse + /product:ask (DEC-DEV-0226)

> **Статус:** approved владельцем 2026-07-23 («го делать одним треком обе доработки»).
> **Интенция владельца:** «интерфейс для просмотра продуктовых артефактов, задач и прочей
> аналитической документации по продукту — встроенный упрощённый для solo Confluence с RAG
> и возможностью отвечать на вопросы».
> **Coverage-check AS IS (DEC-DEV-0222)** выполнен: готового вьюера нет; кирпичи есть —
> `status-collector.cjs` (детерминированный JSON-census, DEC-DEV-0217), паттерн self-contained
> HTML (`app-map-html.js`, `ecosystem-map.html`), замороженный Phase D wiki (про доки самой
> экосистемы, НЕ реанимируется — MkDocs Material в maintenance mode с 2026-07-17).

## Общие принципы

- Оба механизма **read-only** к артефактам (browse пишет только генерённый HTML).
- Каждое число — из `status-collector.cjs`; LLM-пересчёт запрещён (DEC-DEV-0217).
- Consumer-zone: `commands/product/` + `skills/product/` + `hooks/product/lib/`.
- **Без векторов.** Корпус мал и структурен (ID, типы, frontmatter) — структурный retrieval
  точнее embeddings на этом размере. RAG-слой = deferred (`dev/deferred/RAG_LAYER.md`),
  bring-forward триггер: «≥2 подтверждённых промаха лестницы добора на реальных вопросах
  ИЛИ мультипроектный корпус».

## 1. /product:browse

Тонкая команда + **детерминированный генератор** (вся сборка в скрипте, без LLM-суждения;
воспроизводимо, можно запускать руками: `node .claude/hooks/product/lib/product-browser-html.cjs`).

| Файл | Роль |
|---|---|
| `commands/product/browse.md` | команда `/product:browse [--open] [--out <path>]` |
| `hooks/product/lib/product-browser-html.cjs` | генератор → `.product/browser.html` (self-contained, exit 0/2) |
| `hooks/product/lib/vendor/marked.umd.js` (18.0.7, MIT) | markdown→HTML на этапе генерации |
| `hooks/product/lib/vendor/minisearch.umd.js` (7.2.0, MIT) | поисковый индекс: строится при генерации, UMD инлайнится в HTML |

**Поток данных:** collector JSON (census/pending+ghosts/handoffs+staleness/session/DA) →
скан `.product/**/*.md` (frontmatter + тело; dot-папки не сканируются) → marked-рендер →
ID-кросслинки + backlinks → minisearch-индекс → один HTML-файл.

**UI:** шапка (проект, census, timestamp) · левая панель (дерево типов по группам
D1 / D1↔D2 / D2-Behavioral / Design / Cross-cutting + фильтры status/confidence/type) ·
центр (таблица id/title/status/confidence/updated → детальный вид: frontmatter-панель +
тело + backlinks) · панель «Работа» (task-proxy: handoffs+staleness, pending+ghosts,
статусборд FM/RL, stale drafts) · полнотекстовый поиск.

**ID-кросслинковка:** канонические префиксы `PS|MR|CA|MVP|RM|BG|RPM|DS|AM` (singleton, без
номера) и `SEG|VP|HYP|RL|FM|NOTE|LESSON|SC|BR|LC|VC|IC|NFR|MK|NM`-`\d{3}` (enumerable).
Линкуются только существующие артефакты (по индексу id→anchor); несуществующие — плейн-текст.

**Безопасность (перенос урока M-1, security-review 2026-07-11 — stored-XSS в app-map.html):**
1. `DATA`-блоб: `JSON.stringify` + эскейп `</script` → `<\/script` (и `<!--`).
2. Raw-HTML-токены markdown эскейпятся (custom renderer), сырой HTML в тело страницы не попадает.
3. href-ссылки: только `http(s):`/`#`-якоря; `javascript:` и прочие схемы отбрасываются.
4. M-1 в самом `app-map-html.js` — companion-кандидат на фикс тем же приёмом, отдельным коммитом
   (в этот трек НЕ входит).

**Graceful degradation:** пустой/частичный `.product/` — пустые секции с подсказками;
collector упал — HTML генерится с warning в шапке, панель «Работа» отсутствует
(absence of evidence ≠ evidence of absence — не выдумывать поля).

**gitignore:** `.product/browser.html` добавляется в `gitignore.template` (генерённый снапшот).

## 2. /product:ask

| Файл | Роль |
|---|---|
| `commands/product/ask.md` | команда `/product:ask "<вопрос>" [--scope <TYPE\|ID>] [--deep]` |
| `skills/product/corpus-qa.md` | методология «лестницы добора» (артефактов НЕ создаёт) |

**Лестница добора (K0-принцип: утверждение без указателя не выдаётся):**
1. Маршрутизация: счётный/статусный вопрос → ответ строго из collector JSON; содержательный →
   шаги 2-5; вне корпуса → честное «в `.product/` этого нет».
2. Тип-роутер (таблица в скилле): проблема/рынок → PS/MR/CA · сегменты/ценность → SEG/VP ·
   гипотезы → HYP · scope/планы → MVP/RM/RL · поведение фичи → FM+SC/BR/LC/IC · термины → BG ·
   история решений → NOTE/LESSON/DA-findings.
3. Сужение по frontmatter (active > draft; deprecated только по явному запросу).
4. Grep по ключевым словам вопроса по `.product/`.
5. Чтение top-N (≤5) артефактов целиком.
6. Формат ответа: прямой ответ → основания → указатели (ID + путь) на каждое несущее
   утверждение; разделять «из артефактов» / «инференс» / «не найдено».
7. `--deep`: fan-out recon-субагентов (model=sonnet — сбор; синтез в main-сессии).

## 3. Смоук-план (перед PR)

- S1: генерация на пустом `.product/` — graceful, exit 0.
- S2: генерация на реалистичном тест-корпусе (self-created, ≥8 артефактов разных типов) —
  секции наполнены, кросслинки/backlinks работают, поиск находит.
- S3: XSS-проба — артефакт с `<script>alert(1)</script>` и `</script><script>` в теле →
  в HTML эскейпнуто, скрипт не исполняется.
- S4: ask-лестница на тест-корпусе — счётный вопрос (совпадение с collector), содержательный
  (ответ с указателями), вне-корпусный (честный отказ).

## 4. Cuttable / Deferred

**v1:** всё из §1-§2.
**Deferred (с триггерами):** граф зависимостей (Cytoscape) · live-reload · векторный RAG
(`dev/deferred/RAG_LAYER.md`) · ingest задач из `tasks.md` через Integrator (меняет артефактную
модель — отдельное owner-решение) · мультипроектный корпус · экспорт. «Задачи» в v1 — только
task-proxy панель «Работа» (задач в артефактной модели нет by design, D2-T06 delegated).
