# SEAM — product-browse/ask (DEC-DEV-0226)

status: ACTIVE
created: 2026-07-23
track: /product:browse + /product:ask — встроенный «solo Confluence» + Q&A по .product/

## 🛑 СТОП-БЛОК
<!-- v3: при противоречии с секцией «Состояние» прав СТОП-БЛОК (precedence объявлена текстом) -->

### Интенция владельца — ДОСЛОВНО

> «Я хочу спроектировать, чтобы в продуктовой экосистеме был интерфейс для просмотра
> продуктовых артефактов, задач и прочей аналитической документации по продукту, по сути
> как встроенный упрощенный для solo confluence с RAG и возможностью отвечать на вопросы.»

> «Го делать одним треком обе доработки, мне нравится твой подход к задаче. Старайся сам
> только думать и оркестрировать субагентов исполнителей (т.к. ты - дорогая модель Fable).»

### Инварианты И ЗАПРЕТЫ

1. **Merge в main — только владелец.** Довести до PR и остановиться.
2. **Один трек = один PR** (решение владельца; ранее предлагалось два — отброшено).
3. **Без векторов.** RAG-слой = `dev/deferred/RAG_LAYER.md` с bring-forward-триггерами;
   не строить, пока триггер не сработал.
4. **Все числа — из `status-collector.cjs`** (DEC-DEV-0217); LLM-пересчёт запрещён —
   это правило встроено в тексты browse.md/ask.md/corpus-qa.md, при правках не ослаблять.
5. **XSS-меры обязательны** (перенос урока M-1, security-review 2026-07-11): эскейп
   raw-HTML-токенов marked-renderer'ом, `</script`-эскейп DATA-блоба, href только http(s)/#.
6. **M-1 в самом `app-map-html.js` — НЕ этот трек** (companion-кандидат, отдельный коммит).
7. **`dev/meta-improvement/audit-index.md` — чужой WIP**, НЕ стейджить.
8. **PR #232 (feat/product-vl-import-mode, другой трек) не трогать** — ждёт merge владельца.
9. DEC-DEV-0226 **заклеймлен** (`.git/dec-dev-claims.json`, expires 72h от 2026-07-23T17:08Z) —
   заголовок обязан появиться в DEV_JOURNAL.md до истечения, иначе номер уйдёт.

### Режим работы

- Main = Fable: **только думать, брифовать, ревьюить, интегрировать** (директива владельца).
- MDP-пиновки: исполнители-разработка = **opus**; механика/recon = **sonnet**; ревью КАЖДОГО
  делегированного результата — main (спот-чек кода/фактов, не пересказ).
- Autoflow: git-цикл до PR сам; push/gh — `dangerouslyDisableSandbox: true`.

<!-- SEAM-REINJECT-END -->

## Состояние (на момент записи шва; ПРОВЕРЬ фактическое — Recovery-протокол)

- Ветка: `feat/product-browse-ask` (от origin/main, upstream настроен). Проверка:
  `git branch --show-current` → ожидаемо `feat/product-browse-ask`.
- **Ничего не закоммичено** — вся работа uncommitted. `git status` должен показать:
  - `dev/product-browse/DESIGN.md` (дизайн, approved владельцем) + этот SEAM.md
  - `dev/deferred/RAG_LAYER.md` (решение «без векторов» + триггеры)
  - `commands/product/browse.md`, `commands/product/ask.md`,
    `skills/product/corpus-qa.md` (W2 сдал, **ревью пройдено**, дефект `/product:note` исправлен)
  - `hooks/product/lib/vendor/{marked.umd.js, minisearch.umd.js, LICENSE-*.txt}`
    (18.0.7 / 7.2.0, require-проверены)
  - `gitignore.template` (+ `.product/browser.html`)
  - `docs/guide/02-commands.md`, `docs/guide/08-skills.md` (регенерированы),
    `docs/product-module/SPEC.md` (§3 «25 команд», §3.2 → (9) + 2 записи)
  - чужое: `dev/meta-improvement/audit-index.md` — НЕ стейджить (инвариант 7)
- Чекеры на момент шва: `check-counts` ✓, `check-inventory-sync` ✓.
- **W1 сдан: `hooks/product/lib/product-browser-html.cjs`** (918 строк). Ревью main
  ПРОЙДЕНО (спот-чек: DATA-блоб `<` → `\u003c` + U+2028/29; renderer эскейпит raw-HTML;
  href только http(s)/#; crosslink вне тегов/code/pre). Независимый смоук S1-S4 ПРОЙДЕН
  (S1 пустой корпус exit 0; S2/S3 своя XSS-проба — 0 сырых вхождений, ссылки/xref живы;
  S4 collector total_typed=7 сходится с браузером). Принятые отклонения W1 от брифа:
  блокирующий эскейп всех `<` (строже узкой пары); hand-rolled frontmatter (зеркалит
  фактический подход collector — тот БЕЗ js-yaml, вопреки брифу); collector через require.
- DEC-DEV-0226: `npm run next-dec-dev` покажет claim; связанные механизмы см. `DESIGN.md`.

## Критерий достаточности (SEAM-ACK)

Обязательные чтения (файл → зачем):
1. `dev/product-browse/DESIGN.md` — целиком; это утверждённый контракт трека.
2. `skills/product/corpus-qa.md` — что уже обещано consumer'ам (лестница, K0).
3. `hooks/product/lib/product-browser-html.cjs` — ЕСЛИ существует: прочитать перед любым
   действием с ним (ревью не проводилось).

Контрольные вопросы (ответить владельцу ДО первой правки; декларировать каждый
инструментальный доступ сверх названных файлов, включая grep-сниппеты):
1. Откуда обязаны браться ВСЕ числа в browse/ask и какой DEC-DEV это фиксирует?
2. Почему трек сознательно без векторного RAG и где записаны триггеры пересмотра?
3. Что из XSS-мер обязательно в генераторе и какой урок переносится (номер находки)?
4. Что НЕ входит в трек (назови ≥2: M-1 фикс, RAG, задачи-ingest…)?
5. Какие смоук-сценарии обязательны до PR и какой из них security-пробный?

## Следующий шаг (императив, по порядку)

1. **Проверь диск:** `git status` + `ls hooks/product/lib/` — существует ли
   `product-browser-html.cjs` и в каком состоянии (W1 мог дописать после записи шва).
2. Если генератора нет/неполон — перезапусти исполнителя W1 (opus) с брифом из
   `DESIGN.md` §1 (бриф-требования продублированы в DESIGN; самопроверка обязательна).
3. Ревью генератора (main, спот-чек): XSS-меры (инвариант 5), graceful degradation
   (пустой корпус, упавший коллектор), ID-кросслинки, exit-коды.
4. Независимый смоук S1-S4 по `DESIGN.md` §3 (не доверять самопроверке W1; S3 = XSS).
5. DEV_JOURNAL: заголовок `DEC-DEV-0226` (rationale: детерминированный генератор vs
   LLM-рендер; структурный retrieval vs вектора; отказ от MkDocs/готовых AI-wiki) +
   CHANGELOG `[Unreleased] ### Added` (consumer-zone feat — 🔒 process-gate).
6. `npm run verify` (в т.ч. `gen:catalog:check`/`gen:skills:check` — должны быть зелёные).
7. Коммит **только файлов трека** (инвариант 7), push + PR (`dangerouslyDisableSandbox:
   true`), стоп перед merge — сообщить владельцу «PR #N готов».
8. Memory-sync (статус-несущие файлы коммичены) + при закрытии трека — этот шов → CLOSED.

## Отброшено (невосстановимо из git — не переоткрывать)

- **Реанимация Phase D wiki как базы** — другая аудитория (доки экосистемы, не .product/);
  стек MkDocs Material в maintenance mode с 9.7.7 (2026-07-17, подтверждено веб-добором).
- **Готовые self-hosted AI-wiki (AnythingLLM / Open WebUI)** — второй чат-UI дублирует
  Claude Code; демон + синхронизация корпуса не окупаются на solo.
- **Векторный RAG сейчас** — корпус мал и структурен; см. RAG_LAYER.md.
- **Два отдельных PR (browse / ask)** — владелец явно выбрал один трек.
- **Obsidian-first как решение** — не «встроенный», не наследуется проектами экосистемы.

## Грабли среды

- git push / gh / npm pack — только с `dangerouslyDisableSandbox: true` (port-443 timeout).
- Параллельные сессии делят checkout: `git branch --show-current` ПЕРЕД каждым коммитом.
- Vendored добывались через `npm pack` в scratchpad (сессионный, НЕ переживёт exit) —
  готовые копии уже в `hooks/product/lib/vendor/`, повторная добыча не нужна.
- W1/W2 работали в общем checkout без worktree (файлы не пересекались) — новых исполнителей
  на пересекающиеся файлы без worktree не спавнить.

## Вопросы владельцу

Нет открытых. (Задачи-ingest из `tasks.md` через Integrator — отдельное будущее
owner-решение, зафиксировано в DESIGN.md §4, не блокирует трек.)
