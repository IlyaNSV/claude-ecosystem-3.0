# Product Class Taxonomy — Ecosystem 3.0

> **Версия:** 1.0 (2026-06-16)
> **Назначение:** единый справочник концепта «класс продукта» — что это, где живёт, как
> моделируется и что из него выводит экосистема.
> **Введён:** DEC-DEV-0079 (S1 increment).
> **Принцип:** данные descriptive, не prescriptive. Класс **сеет дефолты и hint'ы**, но
> никогда не gate'ит и не диктует реализацию. Открытый словарь — универсальность важнее
> полноты перечня.

---

## 1. Зачем

До DEC-DEV-0079 экосистема нигде структурно не фиксировала **что за тип продукта**
строится (веб-сервис / CLI / расширение / библиотека / …). Класс выводился неявно
внешним инструментом D2-Technical из поведенческой спеки — он был вынужден *угадывать*
форму продукта, а у Product Layer не было явного рычага это направить.

`product_class` закрывает этот зазор, **не нарушая tool-agnostic контракт**: мы передаём
вниз *какого рода продукт* (форму), а D2-T по-прежнему сам выбирает стек/инфру/реализацию.

## 2. Где живёт (SSOT)

Единственный источник истины — блок `product_class` в **`.claude/product.yaml`**
(проектный конфиг). Класс — стабильный проектный факт (один продукт = один класс),
поэтому конфиг, а не версионируемый артефакт и не поле PS (PS обязан быть tech-free,
`docs/pmo/artifacts/PS.md` Content Rules).

- **Захват:** шаг **D1.0 Product Classification** в Discovery (`/product:init`).
- **Backfill** для проектов, установленных до 0079: режим `backfill` skill'а
  `skills/product/product-class.md`.
- **Вывод (derive, не переписывать):** handoff (§1 + frontmatter), будущий
  Integrator/Orchestrator routing. Анти-дрейф: значение нигде не дублируется —
  только читается из `product.yaml`.

### Схема блока

```yaml
product_class:
  archetype: web-service     # первичный ярлык; открытый словарь + `other`
  runtime_locus: server      # где исполняется
  interface: api             # основная поверхность взаимодействия
  distribution: saas         # как доставляется пользователю
  data_sensitivity: pii      # (опц.) сеет security/privacy NFR-акценты
  confidence: high           # high | medium | low — зеркалит C2-конвенцию артефактов
  source: discovery          # discovery | manual | inferred
  notes: ""                  # свободный текст; ОБЯЗАТЕЛЕН если archetype=other
```

Блок целиком **опционален**: отсутствие = поведение экосистемы 1:1 как до 0079
(D2-T угадывает форму сам). Обратная совместимость гарантирована.

## 3. Модель: архетип + ортогональные фасеты

Намеренно НЕ плоский enum `product_type`. «Веб-сервис», «CLI» и «Chrome-расширение»
лежат на разных осях — плоский enum заставляет лгать о гибридах (CLI с веб-дашбордом,
расширение с бэкенд-компаньоном). Поэтому:

- **`archetype`** — один человекочитаемый ярлык. Для удобства, отображения и routing-скоринга.
- **Фасеты** — ортогональные оси, каждая *драйвит конкретный дефолт*. Авто-выводятся из
  архетипа (см. §5), пользователь подтверждает/переопределяет. Это держит трение Discovery
  near-zero при богатых данных.

| Фасет | Что отвечает | Главный потребитель дефолта |
|---|---|---|
| `runtime_locus` | где исполняется код | типы тестов, инфра-shape, применимость uptime-NFR |
| `interface` | основная поверхность взаимодействия | типы тестов (e2e/golden/contract), product-level UI-ожидание |
| `distribution` | как доставляется пользователю | класс концернов (store-policy / semver / multi-tenant) |
| `data_sensitivity` | чувствительность данных (опц.) | tier security/privacy NFR |

## 4. Словари фасетов (ОТКРЫТЫЕ)

Seed-значения ниже — рекомендованные, не исчерпывающие. **Любое значение легально.**
Незнакомое значение → экосистема деградирует до «дефолты авто не применяю, уточни
вручную», но НИКОГДА не отказывает. `archetype: other` + `notes` — всегда валидный выход.

- **`archetype`** (seed): `web-service` · `web-app` · `cli-tool` · `browser-extension` ·
  `desktop-app` · `mobile-app` · `library-sdk` · `data-pipeline` · `bot-integration` ·
  `infra-tooling` · `other`
- **`runtime_locus`** (seed): `user-machine` · `server` · `browser` · `mobile-os` ·
  `edge` · `hybrid`
- **`interface`** (seed): `cli` · `tui` · `gui-web` · `gui-native` · `api` · `headless` ·
  `chat`
- **`distribution`** (seed): `saas` · `self-hosted` · `package-registry` ·
  `marketplace-extension` · `app-store` · `binary-download` · `embedded-lib`
- **`data_sensitivity`** (seed): `none` · `pii` · `regulated`

## 5. Архетип → дефолтные фасеты

При подтверждении архетипа фасеты авто-заполняются по этой таблице (всё overridable).

| archetype | runtime_locus | interface | distribution | data_sensitivity |
|---|---|---|---|---|
| web-service | server | api | saas | pii |
| web-app | hybrid | gui-web | saas | pii |
| cli-tool | user-machine | cli | package-registry | none |
| browser-extension | browser | gui-web | marketplace-extension | pii |
| desktop-app | user-machine | gui-native | binary-download | none |
| mobile-app | mobile-os | gui-native | app-store | pii |
| library-sdk | hybrid | api | package-registry | none |
| data-pipeline | server | headless | self-hosted | regulated |
| bot-integration | server | chat | saas | pii |
| infra-tooling | server | cli | self-hosted | none |
| other | (unset — задать вручную) | (unset) | (unset) | (unset) |

## 6. Класс → производные дефолты

Окупаемость концепта. Всё ниже — **seed, advisory, overridable**. Это *кандидаты в
дефолты* и *подсказки receiver'у*, не требования.

| archetype | NFR-акценты (seed) | Типичные типы тестов | Advisory hint для D2-T (форма, не стек) |
|---|---|---|---|
| web-service | availability, latency, scalability, authZ | unit, integration, API-contract, load | stateless-сервис + хранилище; ожидаемы контрактные/интеграционные тесты |
| web-app | perceived latency, a11y, browser-compat | unit, component, e2e (browser), visual | клиент+сервер; ожидаемы e2e/визуальные тесты |
| cli-tool | portability, exit-code correctness, startup time | unit, golden-output/snapshot, cross-platform | нет сервера; кросс-платформа; тест через stdin/stdout golden; uptime-NFR неприменим |
| browser-extension | permission-minimality, store-policy compliance, content-script isolation | unit, DOM-integration, manifest/permission audit | ограничения стора + manifest; uptime SLA неприменим без бэкенд-компаньона |
| desktop-app | startup/perf, offline, auto-update integrity | unit, UI-automation, packaging/install smoke | дистрибутив/инсталлятор; offline-поведение значимо |
| mobile-app | battery/perf, offline, store-review compliance | unit, UI-instrumentation, device-matrix | ограничения стора; offline и матрица устройств значимы |
| library-sdk | API stability, semver discipline, backward-compat | unit, API-surface/contract, example-compile | нет runtime-инфры; публичный API = контракт; semver-гейты |
| data-pipeline | throughput, idempotency, data-quality | unit, data-fixture integration, idempotency-replay | batch/stream; тест на фикстурах данных; инварианты идемпотентности |
| bot-integration | webhook latency, idempotency, rate-limit handling | unit, integration (mocked platform), replay | событийная модель; идемпотентность доставки; лимиты внешней платформы |
| infra-tooling | reproducibility, dry-run safety, idempotency | unit, integration (sandboxed env), idempotency | side-effects на окружение; dry-run и идемпотентность критичны |

> `data_sensitivity` модифицирует security/privacy-акценты поверх строки архетипа:
> `pii` → добавить privacy/retention/authZ; `regulated` → плюс audit-trail/compliance.

## 7. Гарантии адаптивности (контракт универсальности)

1. **Открытый словарь + `other`.** Незнакомый класс всегда легален; экосистема
   деградирует, не отказывает.
2. **Всё производное — дефолты/хинты с override.** Класс никогда не меняет *что
   обязательно*, только *что предлагается*. Ни одного нового hard-gate.
3. **Таксономия — данные в одном файле.** Новый класс = правка таблиц §4–§6, ноль кода.
4. **Handoff остаётся behavior + shape, не stack.** Класс передаётся как advisory hint;
   D2-T по-прежнему владеет выбором стека/инфры. AP-9 (`handoff-spec.md §12`) сохранён.
5. **Опциональность.** Отсутствие блока = доэкосистемное поведение 1:1.

## 8. Как потребляется

- **D1.0 Discovery** (`skills/product/product-class.md`, режим `discovery`) — один вопрос
  архетипа, авто-вывод фасетов, запись в `product.yaml`.
- **Handoff** — `skills/product/handoff-generator.md` читает `product.yaml.product_class` и
  эмитит строку `Product class:` в §1 + блок `product_class` во frontmatter (машиночитаемо
  для адаптеров) + advisory-абзац. См. `handoff-spec.md §1/§5/§12`.
- **Будущее (S2+):** Integrator-профиль `supported_archetypes` → routing-скоринг
  пригодности инструмента (warning, не блок); авто-сев NFR-акцентов; D4 test-type чеклист.

## 9. Протокол расширения

Чтобы добавить новый класс продукта:

1. Добавь значение в нужный seed-словарь §4 (обычно `archetype` + при необходимости новое
   значение фасета).
2. Добавь строку в §5 (дефолтные фасеты для архетипа).
3. Добавь строку в §6 (NFR-акценты / типы тестов / advisory hint).
4. Готово — ноль правок кода. Skill и handoff-generator читают эти таблицы декларативно.

При значимом расширении (новая ось-фасет, а не значение) — DEV_JOURNAL запись, т.к. это
меняет схему блока в `product.yaml`.

## 10. Связанное

- SSOT-локация: `commands/ecosystem/bootstrap.md` Step 7 (`product.yaml`)
- Capture/backfill: `skills/product/product-class.md`
- Discovery-интеграция: `skills/product/discovery-session.md` (D1.0)
- Handoff-проброс: `docs/product-module/handoff-spec.md` §1/§5/§12 + `skills/product/handoff-generator.md`
- Решение: `DEV_JOURNAL.md` DEC-DEV-0079
