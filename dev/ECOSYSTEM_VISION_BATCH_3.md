# Ecosystem Vision — Wave (C ∥ D) + G-ревью + F1-координация · Execution Batch (work-order)

> **Назначение:** самодостаточный execution-brief волны E5 принятого [ECOSYSTEM_VISION.md](ECOSYSTEM_VISION.md): генерализация консилиум-примитива (Epic D) на completeness-эскалации + крупные автономные шаги (Epic C) + минимальный Epic G + контракт-координация F1.
> **Статус:** `ready-to-run` (2026-07-04). Kickoff = **DEC-DEV-0145** (recon свежим opus-агентом по D7 `phase-kickoff.md` Sections 1/2/4 + drift-фиксы vision §2.2/§5).
> **Ключевой ре-скоуп kickoff'а:** консилиум-примитив D1 **уже построен** как оркестраторный P2 (`orchestrator/lib/consilium-synth.cjs` + жюри ×3, DEC-DEV-0129/0135, live-validated) → волна НЕ строит примитив с нуля, а **генерализует** его.
> **Граница:** `orchestrator/` не редактировать, КРОМЕ согласованной one-line параметризации `consilium-synth.cjs` (см. D1a; backward-compat обязателен, P2-тесты зелёные). Epic E/F2/F3 — не здесь.
> **Принцип коммитов:** каждый пункт = отдельный коммит на чистом шве; блокирующий `commit-msg` gate активен.

---

## 0. Goal & scope

**Цель волны:** completeness-loop (Wave B) научился эскалировать decision-гэпы в PA — теперь дать этим эскалациям **подготовку решения жюри** (D), обернуть обогащение feature set в **крупный автономный шаг** (C-i), и заложить конфиг-слои (G-минимум, F1-контракт) без дублей.

**Что УЖЕ готово (НЕ строить заново):**
- ✅ **P2-консилиум** — `consilium-synth.cjs` (matrix + rank + hard/soft-veto worst-of + panel-honesty + integration-pass) + skill `architecture-consilium.md` + процесс `decide-architecture-foundation.mjs` (0129/0135). Математика агрегации юнит-покрыта и обкатана.
- ✅ **B-b wave-runner** — `product/processes/complete-feature.mjs` + `gap-classifier.cjs` (decision-категории = SSOT «что эскалируется», 0142).
- ✅ **Epic A** — 7 субагентов (architect/qa/ux live-validated 0115) + `zone-router.cjs`/`zone-routing.yaml`.

**Порядок (degrade-gracefully):** **D-ядро (D1a→D1b→D2)** committed → **C-i** (после/с D) → **G1+G2-минимум** + **F1 контракт+skeleton** stretch → cuts с bring-forward триггерами.

**Жёсткие контракт-констрейнты (вскрыты kickoff-recon, verify перед стройкой):**
1. `consilium-synth.isPriorVerdict()` фильтрует всё вне хардкода `PRIOR_LIST=[velocity,fidelity,integrity]` (`orchestrator/lib/consilium-synth.cjs:79`) — persona-панель молча выпадет без параметризации.
2. Synth ранжирует **форк**: требует ≥2 перечисленных опций — консилиум-eligible только форк-образные decision.
3. F1-резолвер обязан **потреблять** risk-tier из `gate-risk-classifier`/`env-readiness`, не пере-выводить (иначе два расходящихся gate-policy механизма).

---

## Kickoff-решения (DEC-DEV-0145) — зафиксированы

| # | Развилка | Решение | Rationale |
|---|---|---|---|
| **а** | D1: где живёт / как реюзить synth | **Параметризация панели** в `consilium-synth.cjs` (опц. параметр, default = 3 арх-приора 1:1) + тонкий D1-раннер в `product/processes/` (агент-транспорт к либе, как gap-classifier) | Математика уже построена+обкатана; переписать = дубль и дрейф двух soft-veto. Отвергнуто: свежая generic-либа (дубль); маппинг персон на 3 арх-приора (теряет гетерогенность) |
| **б** | D1: контракт входа | **Отдельная команда `/product:consilium <PA>`** на уже-эскалированный форк-образный decision-PA (≥2 опций); открытые вопросы остаются plain-PA | Loop остаётся bounded+дёшев; inline-жюри каждую волну = ~15× трап + groupthink на тривиях. Зеркалит доказанный P2-паттерн PA-in → рекомендация-out |
| **в** | D: prepare vs decide | **Prepare-only** — жюри готовит рекомендацию, владелец ратифицирует; авто-proceed по confidence≥τ = F2/L2, НЕ в этой волне | Анти-автономное зерно + [[project_autonomy_obedience_balance]] |
| **г** | C-i vs `complete-feature.mjs` | **Новый** `product/processes/batch-enrich-feature-set.mjs`: `pipeline()` по FM, тонкая оркестрация поверх СУЩЕСТВУЮЩИХ `/product`-команд; completeness-loop = одна стадия | Слить = разбухание + слом bounded-stop контракта. Ре-имплементация authoring F.2-F.10 в Workflow — отвергнута (cut 4) |
| **д** | C-ii: диспозиция гейтов границ | **Реюз L1-паттерна** (PA-escalate + owner-ratify), нового механизма НЕ строить | Диспозицию владеют F1/F2 — не строить дважды |
| **е** | 4 firing-решателя (zone-router / gate-risk-classifier / D3 / G2) | **Стопка, не параллель:** G2-матрица = слой над zone-router; D3-панель = потребитель G-пресетов | Иначе фрагментация «кто участвует» на 4 несвязных механизма |
| **ж** | D3-пресеты ≡ G4-пресеты | **Одна реализация** (именованные пресеты состава — в G-слое, D3 их потребляет) | Дубль вскрыт recon'ом; строить дважды нельзя |
| **з** | Epic G объём | **G1+G2 минимум** (owner-дефолт (a), решено ранее): per-agent config + participation-matrix, дефолт = zone-routing 1:1; расширения 1-7 из §5 Epic G → deferred | Rail §6(5): персон 7, но firing только 3 — порог «реальной нужды» на границе |
| **и** | F1 объём | **Контракт-спека + skeleton `lib/autonomy-policy.cjs`**, БЕЗ wiring в orchestrator-гейты | Wiring требует сверки с оркестратор-треком (причина отложки 0136); loop уже де-факто L1 — F1 формализует, не вводит новое |

---

## D-ядро *(committed)* — **✅ ПОСТРОЕНО 2026-07-04 (DEC-DEV-0149 (изнач. 0146, перенумерован при merge), PR #117): D1a+D1b+D2, verify EXIT=0; live-грейд жюри = pilot-gated**

### D1a — Параметризация synth *(первый коммит; трогает `orchestrator/lib/` — согласованная точка)*
- [x] `consilium-synth.cjs`: `PRIOR_LIST` → инъекция панели (напр. `synthesize(verdicts, opts, {panel})`); default = `[velocity,fidelity,integrity]` — **P2 behavior 1:1**, все существующие тесты зелёные без правок.
- [x] `panelComplete`/`isPriorVerdict` считают от переданной панели; юниты на custom-панель (persona-набор) + на default-путь.

**Acceptance:** P2-тесты без изменений зелёные; новый юнит: панель `[architect,qa,ux]` агрегируется, чужой prior отфильтрован, panel-honesty работает.
**Process:** `refactor(orchestrator-lib)` + DEV_JOURNAL (согласованное исключение границы); CHANGELOG не нужен (behavior-neutral).

### D1b — Product-раннер `/product:consilium`
- [x] `product/processes/consilium.mjs` (Workflow): вход = decision-PA id; guard «форк-образный, ≥2 опций» (не форк → честный отказ с маршрутом «доформулируй опции / оставь владельцу»); fan-out гетерогенных персон Epic A (по зоне решения, реюз zone-router; has_ui=false → без ux) с **raw-source** брифами (FB-LR-31); агрегация через `consilium-synth.cjs` (агент-транспорт `node`, как gap-classifier); рекомендация-пакет → PA update-in-place (PA-dedup 0089).
- [x] Команда `commands/product/consilium.md` + inline-fallback для до-волновых инсталляций (паттерн `/product:complete`).
- [x] Консилиум-eligible категории `gap-classifier`: `threshold/moscow/screen-decision/ic-semantic/br-semantic/sc-semantic`; `broken-ref/fm-status` — plain-PA (не жюри).

**Acceptance:** фикстурный decision-PA с 2 опциями → жюри ×N персон → детерминированная рекомендация в PA; не-форк → отказ без фабрикации второй опции; smoke в `npm run verify` (wiring Step 4 + счётчики).
**Process:** `feat(product)` consumer-zone → 🔒 CHANGELOG + DEV_JOURNAL (runner-топология); verify.md Step 4 + summary.

### D2 — Политика консилиума *(реюз §7.6)*
- [x] В skill/команду D1b зашита политика: объявленный scope (subject + prior-labels + comparison-axes) обязателен; **no silent fan-out** (спавн жюри виден в отчёте с составом); на связанном/необратимом — информирует, не решает; approve-gate сохранён.

**Acceptance:** отчёт раннера всегда содержит панель+scope; при отсутствии scope — стоп, не «додумать».

---

## C-i — `batch-enrich-feature-set` *(stretch; после/с D — консилиум = decision-prep внутри стадии)*
- [x] `product/processes/batch-enrich-feature-set.mjs`: `pipeline()` по FM релиза; стадии = тонкий агент-транспорт существующих `/product`-команд обогащения (F.2→F.10) + `complete-feature` как completeness-стадия; гейт на границе фаз (L1 PA-escalate, решение «д»); checkpoint-файл прогресса ДО запуска (урок E1: session-limit на батчах).
- [x] `log()` покрытие: что пропущено/отброшено — явно (no silent truncation).

**Acceptance:** прогон по ≥2 FM фикстуры доводит стадии, эскалирует decision, переживает обрыв (checkpoint + resume со шва).
**Process:** `feat(product)` → 🔒 CHANGELOG + DEV_JOURNAL; verify.md.

## G1+G2 минимум *(stretch; owner-дефолт (a))*
- [x] **G1:** `agent-roster.yaml` (или секция product.yaml): per-персона `enabled/model/depth_threshold/extra_lenses`; absent == встроенный дефолт 1:1.
- [x] **G2:** participation-matrix как **слой над `zone-router`** (решение «е»): `resolve(zone, magnitude, roster) → firing_set`; дефолт = текущий zone-routing 1:1; юниты.
- [x] Именованные пресеты состава (бывш. D3/G4, решение «ж») — если влезет: `lean/full/…`, потребляются D1b-панелью.

**Acceptance:** без конфига поведение экосистемы байт-в-байт прежнее; с конфигом — панель/firing переопределяются детерминированно.
**Process:** `feat(product)` → 🔒 CHANGELOG + DEV_JOURNAL; при новых артефакт-типах — 🔒 count-sweep.

## F1 — контракт + skeleton *(stretch; coordination-gated)*
- [x] Контракт-док: как `resolve(operation_class, risk_tier, env_tier, policy, override) → disposition` **потребляет** `gate-risk-classifier.cjs`/`env-readiness.cjs` (не пере-выводит); сверка полей с оркестратор-треком.
- [x] Skeleton `lib/autonomy-policy.cjs` (pure function, L0/L1, floor-константы, юниты) — БЕЗ wiring в процессы.

**Acceptance:** резолвер тестируем изолированно; wiring — следующая волна после сверки.

---

## Cuts (bring-forward триггеры)

| Cut | Почему | BF-триггер |
|---|---|---|
| **C-iii** branch-anticipation | Нельзя предвосхитить >10%-ветки без данных прогона (§6 спекулятивный зоопарк) | ≥1 реальный прогон C-i с наблюдёнными ветками |
| **G3** панель приборов + метрики/ROI | §6 rail 3: read-model раньше нужды = прежде-временная сложность | Персон firing >3-4 ИЛИ реальный тюнинг состава по факту пользы |
| **C-ii** новый gate-disposition механизм | Диспозицию владеют F1/F2 | F2 (L2 consilium-gate) |
| Authoring F.2-F.10 как Workflow-ноги | Ре-имплементация против «orchestrate, don't duplicate» | Authoring-шаги станут callable сами по себе |
| Расширения G 1-7 (custom personas, лид→команда, veto-seniority, model-tiering, cost-budget, product_class-дефолт, shared roster) | §7-развилки не пред-решены; спекулятивно до живой нужды | Спрос от D-панелей/пилота; отдельный §7-раунд владельцу |

---

## Process-обязательства волны

| Триггер | Обязательство (🔒 = enforced) |
|---|---|
| `feat:` consumer-zone (D1b, C-i, G) | 🔒 CHANGELOG `[Unreleased] ### Added` + DEV_JOURNAL при tradeoff |
| правка `orchestrator/lib/` (D1a) | DEV_JOURNAL (согласованное исключение границы) + P2-тесты зелёные |
| новая команда (`/product:consilium`) | verify.md Step 4 + summary + обзорные шаблоны (DEC-DEV-0082) |
| новый артефакт-тип/правило | 🔒 count-sweep `check-counts.js` |
| DEC-DEV номер | `npm run next-dec-dev` + `git fetch` + скан открытых PR — коллизия сработала 5-й раз (0144 → PR #114) |

## Boundary & risks

- **`orchestrator/`** — только D1a (согласованная параметризация, backward-compat, P2-тесты зелёные); остальное read-only.
- **Worktree** для стройки при параллельных сессиях ([[env_parallel_sessions_share_checkout]] — эскалация: чужой reset сносит чужие коммиты).
- **D остаётся prepare-only** — не подменять owner-ratify (авто-proceed = F2, позже).
- **MDP:** механика/тесты = sonnet-исполнители, runtime-код и жюри-судьи = opus, брифы+ревью = main (обкатано на E2).

## Resume / recovery

После прерывания: `git status` + `git log` на ветке → последний завершённый пункт по коммитам (чек-боксы = карта) → продолжай со следующего. Верифицируй фактическое состояние, не память.
