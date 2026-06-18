---
description: Capture or backfill the product_class block in product.yaml — archetype + auto-derived facets (runtime_locus, interface, distribution, optional data_sensitivity). Two modes — discovery (D1.0, called by discovery-session) and backfill (one-time, for projects installed before DEC-DEV-0079). Open vocabulary, advisory-only, never gates.
---

# Product Class — capture & backfill skill

Заводит/дозаполняет блок `product_class` в `.claude/product.yaml`. Концепт, словари и
таблицы дефолтов — в [`docs/pmo/product-class-taxonomy.md`](../../docs/pmo/product-class-taxonomy.md)
(SSOT). Этот skill — методология диалога + запись.

**Принцип (DEC-DEV-0079):** descriptive, не prescriptive. Класс сеет дефолты/хинты, не
gate'ит. Открытый словарь — любое значение легально, `archetype: other` + `notes` всегда
валиден. Блок опционален; его отсутствие = поведение экосистемы 1:1 как до 0079.

## Когда загружается

- **Режим `discovery`** — из `discovery-session.md` шаг D1.0 (новый продукт через `/product:init`).
- **Режим `backfill`** — одноразово для проектов, установленных до 0079 (после
  `/ecosystem:update` блок `product_class` ещё пуст/отсутствует). Запускается копипастом
  одноразового промпта (см. `CHANGELOG.md` migration-нота) или прямой просьбой пользователя.

## Канонический блок (НЕ варьировать имена полей)

```yaml
product_class:
  archetype: web-service     # открытый словарь §4 taxonomy + `other`
  runtime_locus: server      # где исполняется
  interface: api             # основная поверхность взаимодействия
  distribution: saas         # как доставляется
  data_sensitivity: pii      # (опц.) сеет security/privacy NFR
  confidence: high           # high | medium | low (C2-конвенция)
  source: discovery          # discovery | manual | inferred
  notes: ""                  # ОБЯЗАТЕЛЕН если archetype=other
```

**Anti-pattern field names — НЕ переименовывать «для естественности»** (B.1 convention,
DEC-DEV-0012 дух):

- ❌ `type`, `category`, `product_type`, `kind` → canonical = `archetype`
- ❌ `runtime`, `platform`, `locus`, `environment` → canonical = `runtime_locus`
- ❌ `surface`, `modality`, `ui`, `interface_type` → canonical = `interface`
- ❌ `delivery`, `channel`, `distribution_channel` → canonical = `distribution`
- ❌ `sensitivity`, `data_class`, `pii` (bare) → canonical = `data_sensitivity`
- ❌ `confidence_rationale`, `reasoning`, `rationale` → для пояснения используй `notes`

## Режим A: discovery (D1.0)

Вызывается в начале Discovery, ДО D1.1 Problem Discovery. Не контаминирует PS — пишет в
`product.yaml`, не в артефакты.

1. **Один вопрос пользователю** — что строим по форме:

   ```
   D1.0 Product Classification (один шаг, влияет на дефолты ниже по пайплайну).

   Что мы строим по форме? (можно своими словами — словарь открытый)
     [1] web-service     — бэкенд-API / серверный сервис
     [2] web-app         — пользовательское веб-приложение (клиент+сервер)
     [3] cli-tool        — инструмент командной строки
     [4] browser-extension — расширение браузера
     [5] desktop-app     — десктоп-приложение
     [6] mobile-app      — мобильное приложение
     [7] library-sdk     — библиотека / SDK
     [8] data-pipeline   — пайплайн обработки данных
     [9] bot-integration — бот / webhook-интеграция
    [10] infra-tooling   — инфраструктурный/devtool
     [other] — опиши своими словами
   ```

2. **Авто-вывод фасетов** из таблицы §5 taxonomy по выбранному архетипу. Покажи
   предзаполненные `runtime_locus / interface / distribution / data_sensitivity` и спроси
   подтверждение:

   ```
   Архетип: web-service → предлагаю:
     runtime_locus: server | interface: api | distribution: saas | data_sensitivity: pii
   Подтвердить или поправить? [Y / правки]
   ```

3. **`archetype: other`** → фасеты НЕ авто-выводятся; запроси каждый фасет (предложи
   seed-значения §4) и **обязательный `notes`** с описанием.

4. **Запись** блока в `product.yaml` (см. «Запись» ниже). `source: discovery`,
   `confidence:` по уверенности пользователя (high если уверенно назвал; medium если
   «скорее всего»).

5. **Кратко покажи производные дефолты** из §6 taxonomy (NFR-акценты + типы тестов) как
   контекст — это не gate, просто «вот что отсюда будет предлагаться ниже».

## Режим B: backfill (одноразово)

Для существующего проекта, где Discovery уже пройден до 0079.

1. **Инференс-подсказки** из `.product/` (не перезаписывают выбор пользователя — только
   стартовая гипотеза):
   - есть ли `.product/mockups/MK-*.md` или хоть один `FM.has_ui: true` → вероятно есть GUI
     (`interface: gui-web/gui-native`), иначе → `headless/api/cli`.
   - текст PS / MVP / FM — поищи явные маркеры («CLI», «расширение», «API», «приложение»).
   - existing NFR-акценты, если есть.
2. **Предложи гипотезу** `archetype` + фасеты на основе инференса, помечая
   `source: inferred`, и попроси пользователя подтвердить/исправить. После подтверждения
   пользователем → `source: manual` (или `discovery` если он фактически проходит
   классификацию впервые).
3. **Запись** блока. Если блок уже есть и заполнен — покажи текущее, спроси
   обновлять ли (идемпотентность, не молча overwrite).
4. Если в проекте уже есть handoff'ы — напомни, что `/product:handoff <FM> --regenerate`
   подхватит новый `product_class` в §1/frontmatter (необязательно сразу).

## Запись в product.yaml

1. `Read` `.claude/product.yaml`.
2. Если блок `product_class:` отсутствует — добавь его (рекомендуемое место: сразу после
   `nfr_default_tier`, в секции Discovery-дефолтов). Если присутствует — `Edit` значения.
3. Сохрани канонический порядок полей и комментарии шаблона.
4. **Идемпотентность:** повторный запуск читает существующий блок, не плодит дубликаты.

## Семантика confidence / source

- `confidence`: уверенность в классификации. `high` — пользователь чётко назвал форму;
  `medium` — «скорее всего / ещё думаем»; `low` — неясно, поставили гипотезу.
- `source`: `discovery` (захвачено в D1.0) | `manual` (пользователь задал/правил вне
  Discovery) | `inferred` (предложено инференсом, ещё не подтверждено человеком).

## Anti-patterns

1. **Гейтить по классу.** Класс НИКОГДА не блокирует шаги. Только сеет дефолты/хинты.
   Если возник соблазн «нельзя продолжить, потому что класс X» — это баг дизайна.
2. **Закрытый словарь.** Не отвергай незнакомое значение. Прими, при необходимости
   `archetype: other` + `notes`; деградируй до «дефолты вручную».
3. **Контаминация PS.** Не пиши класс/форму продукта в PS (PS обязан быть tech-free).
   Только `product.yaml`.
4. **Молчаливый overwrite в backfill.** Если блок заполнен — покажи и спроси.
5. **Переименование полей.** Имена полей канонические (см. anti-pattern список выше).
6. **Раздувание вопросов.** В discovery — один вопрос архетипа + одно подтверждение
   фасетов. Фасеты авто-выводятся; не допрашивай по каждому, кроме `other`.

## Related

- Taxonomy (SSOT концепта): `docs/pmo/product-class-taxonomy.md`
- Discovery-интеграция: `skills/product/discovery-session.md` (D1.0)
- SSOT-локация: `commands/ecosystem/bootstrap.md` Step 7 (`product.yaml`)
- Handoff-проброс: `skills/product/handoff-generator.md` + `handoff-spec.md §1/§5/§12`
- Решение: `DEV_JOURNAL.md` DEC-DEV-0079
