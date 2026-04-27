# Validation Rules Catalog — Ecosystem 3.0

> **Версия:** 1.0 (2026-04-18)
> **Объём:** 33 активных правила (V-*: 15, V-H-*: 10, V-MK-*: 8) + 2 process rules (adaptive-depth — refactored DEC-DEV-0012) + tier-based activation system
> **Назначение:** единый каталог валидационных правил для артефактов D1-D2, handoff и Design Module.
> **v1 modifications:** A3 (P-RULE-01/02 adaptive-depth — refactored DEC-DEV-0012 from magnitude-gated), B1 (validation_tier per project), B2 (quiet draft hooks), C3 (`/product:meta-feedback` workflow), D2 (`approve_overrides` per artifact).

## 0. Critical Review Summary

Документ заменяет и консолидирует валидации из:
- ART §7 (V-01..V-13 оригинальный набор)
- Audit секция 4.4 (предложения V-14..V-17)
- handoff-spec §8 (V-H-01..V-H-10)
- MK.md § Content Rules (V-MK-01..V-MK-08)
- ART §7 (V-20..V-23 для экосистемы)

Каждое правило прошло проверку:
1. **Полезно ли?** Ловит ли реальную проблему?
2. **Автоматизируемо ли?** Можем ли реально проверять?
3. **В нужном namespace?** Product Layer или cross-boundary?

Принцип: **если правило нельзя автоматизировать, заменяем на process rule** (обязательный шаг процесса, например DA review). Это честнее — пользователь знает, что правило работает через процесс.

### Что изменилось

**Выпилено (не validation rules):**
- **V-13** (IC не конфликтуют) → process rule: DA review обязателен при любом IC change

**Разделено:**
- V-14 (conflicting BR) → **V-14a** (параметрический, auto) + process rule (семантический DA review)

**Добавлено:**
- **V-15** (orphan artifacts detection) — полезный cleanup-check

**Отложено:**
- **V-16** (NFR coverage) — ждёт закрытия OQ-03 (NFR артефакт)

**Перемещено в Integrator namespace (V-I-*):**
- V-17/V-20 (FM shipped → .kiro/ existence) → это cross-boundary с внешним инструментом
- V-21 (BG → design.md) → adapter contract
- V-22 (VC → VERIFICATION.md) → adapter contract
- V-23 (FM → tasks.json) → adapter contract

**Downgraded severity:**
- V-02 (SC→BR) с 🔴→🟡 (некоторые SC — чистая навигация)
- V-MK-04 (tab order) с 🟡→🔵 Info
- V-MK-06 (touch targets) с 🟡→🔵 Info

### Итоговая структура namespaces

| Namespace | Префикс | Покрытие | Кол-во |
|---|---|---|---|
| Artifact validation | V-01..V-16 | Интегральная проверка артефактов `.product/` | 15 |
| Handoff validation | V-H-01..V-H-10 | Структурная целостность handoff.md | 10 |
| Design validation | V-MK-01..V-MK-08 | UI spec completeness (conditional has_ui) | 8 |
| Integrator validation | V-I-* | Cross-boundary (контракты с внешними инструментами) | future |
| Process rules | P-RULE-* | Обязательные ручные проверки (не автоматизация) | 2 |

---

## 1. Philosophy

### 1.1 Зачем validation

Validation — это **safety net**, а не bureaucracy. Каждое правило отвечает на конкретный вопрос:
- **Упадёт ли реализация, если мы пропустим?** (critical)
- **Выглядит ли артефакт странно / недоработанным?** (warning)
- **Можем ли дать полезную подсказку?** (info)

### 1.2 Принципы

**P1: Автоматизация или явный процесс.** Если правило нельзя автоматизировать — не маскируем, а превращаем в явный process rule.

**P2: Блокируем ровно то, что надо.** Слишком строго → пользователь раздражается и отключает. Слишком мягко → ошибки просачиваются. Severity tuned per rule.

**P3: Inline validation > batch.** Лучше проверять при каждом сохранении, чем раз в месяц через /product:validate.

**P4: Fast feedback.** Ошибки/предупреждения показываются **немедленно** после действия, не в конце сессии.

**P5: Fixable by assistant когда возможно.** V-11 (bi-dir refs) — ассистент сам исправляет. Human видит: «исправлено автоматически» и может откатить.

**P6: Цена ошибки определяет severity.** V-01 (FM без SC) — фича пустая, 🔴. V-12 (stale draft) — забытое, 🟡. V-MK-04 (tab order) — рекомендация, 🔵.

---

## 2. Tiers & Severity

### 2.1 Три уровня

| Tier | Значок | Поведение | Пример |
|---|---|---|---|
| **Blocking** | 🔴 | Блокирует переход draft→active или handoff generation | V-01 FM без SC |
| **Warning** | 🟡 | Не блокирует, но явный flag в отчёте; проходит с подтверждением | V-12 stale draft |
| **Info** | 🔵 | Информационное сообщение, suggestion; никогда не блок | V-MK-04 tab order |

### 2.2 Где применяются tiers

- **🔴 Blocking** — только на critical integrity issues
- **🟡 Warning** — на partial completeness, consistency issues
- **🔵 Info** — на стилистику, рекомендации, нереализуемые полностью

### 2.3 Validation tier per project (B1 modification)

`.claude/product.yaml` field `validation_tier` определяет, какие правила работают **inline** (на каждом save):

| Tier | Inline rules | Queued (показываются в /product:status, на approve gate, /product:validate) |
|---|---|---|
| **`pilot`** (default для bootstrap) | Только 🔴 Blocking | 🟡 Warning, 🔵 Info |
| **`mvp`** | 🔴 Blocking + 🟡 Warning | 🔵 Info |
| **`full`** | Все 33 правила | (none) |

**Обоснование:** на ранних стадиях продукта (pilot, ≤5 active FM) бóльшая часть правил не имеет реального application. Tier-based activation снижает ноткс-шум, не отключая правила полностью. Upgrade tier — осознанное решение когда продукт растёт.

**Изменение tier:**
```bash
/product:config validation_tier mvp   # требует rationale, фиксируется в journal
```

### 2.4 Project overrides per rule

В дополнение к tier — `.claude/integrator/validation-config.yaml` позволяет per-rule override:
- Downgrade 🔴 до 🟡 или 🔵 per правилу (с обоснованием в decision journal)
- Upgrade 🟡 до 🔴 если проект строгий
- Отключить rule полностью (редко; только по явному решению)

**Per-artifact override** — см. §9.3 (D2 modification — `approve_overrides`).

**По умолчанию — severity, указанная в каталоге.** Overrides — осознанное отклонение.

---

## 3. When Validations Run

Валидации выполняются в **5 точках** экосистемы:

### 3.1 Inline (при каждом сохранении артефакта)

- Hook `product-artifact-validate.js` на PostToolUse при Write/Edit в `.product/`
- Проверяет только правила, применимые к сохраняемому артефакту И активные per `validation_tier` (см. §2.3)
- Быстрые checks (ms)
- Результат: immediate feedback в stderr/output

**Применимые правила:** V-01..V-11 (structural integrity), V-H-06 (YAML valid), filtered by tier.

#### 3.1.1 Quiet draft mode (B2 modification)

При сохранении артефакта в `status: draft` — hook работает в **quiet mode**:
- Проверки выполняются как обычно
- Результаты НЕ surfacing inline (в stderr/output)
- Findings queued в `.product/.pending/validation-pending.yaml`
- Surfacing происходит на:
  - draft → active transition (на approve gate)
  - `/product:status` (общий счётчик «12 pending findings»)
  - Явный `/product:validate`

**Цель:** не отвлекать AI/human на промежуточные draft-состояния. Финальная проверка — на approve.

**Конфигурация:**
```yaml
# .claude/product.yaml
draft_mode_quiet_hooks: true      # default true; false = классический поведение
```

### 3.2 At approve gate (при draft → active переходе)

- Проверяет, что артефакт готов к active
- Более строгие checks (применяет все blocking rules)
- Ассистент докладывает человеку состояние перед approve

**Применимые правила:** V-01..V-15 (все артефактные), V-MK-01..08 (если has_ui и это MK).

### 3.3 At handoff generation

- Выполняется в `/product:handoff` перед созданием файла
- DoR checks + все V-H-* rules
- При 🔴 failure — файл не создаётся (`status=blocked`)

**Применимые правила:** V-H-01..V-H-10 (все handoff) + V-01..V-15 (артефактные embedded).

### 3.4 On-demand (/product:validate)

- Ручной запуск для полной проверки `.product/`
- Все правила, все артефакты
- Используется перед ключевыми событиями (release, major review)
- Отчёт с summary + per-rule breakdown

**Применимые правила:** все V-*, V-H-*, V-MK-*.

### 3.5 Periodic (future, в v2)

- Scheduled runs раз в неделю через ScheduleWakeup
- Основная цель: drift detection, stale drafts (V-12)
- Пока не реализуется — manual /product:status + /product:validate

---

## 4. Namespaces и распределение

```
┌────────────────────────────────────────────────────────────────────┐
│  PRODUCT LAYER VALIDATION                                           │
│                                                                     │
│  V-* (14)           : интегральность артефактов .product/          │
│  V-H-* (10)         : структура handoff.md                         │
│  V-MK-* (8)         : UI completeness (conditional has_ui)         │
│  P-RULE-* (2)       : process rules для non-automatable            │
├────────────────────────────────────────────────────────────────────┤
│  INTEGRATOR LAYER VALIDATION (future, не в этом документе)         │
│                                                                     │
│  V-I-* : cross-boundary контракты с внешними инструментами        │
│          (FM shipped → .kiro/, BG → design.md, VC → tests, etc.)  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Full Catalog

### 5.1 Artifact Validation (V-01..V-15)

#### V-01: FM has ≥1 active SC
- **Tier:** 🔴 Blocking
- **Statement:** Каждый FM-* в status=in-progress или shipped должен иметь минимум один SC-* в status=active в frontmatter.scenarios[].
- **Artifacts affected:** FM-*, SC-*
- **Automation:** ✅ Fully (count)
- **When:** Inline (на FM save), Approve gate (FM), Handoff
- **On failure:** FM cannot transition to in-progress/shipped. Handoff generation blocked.
- **Rationale:** FM без поведенческой спецификации — это skeleton, не ready для реализации.

#### V-02: SC references ≥1 BR (suggestion)
- **Tier:** 🟡 Warning (downgraded from 🔴 after review)
- **Statement:** SC-* в status=active должен ссылаться на минимум один BR-* в frontmatter.rules[].
- **Artifacts affected:** SC-*, BR-*
- **Automation:** ✅ Fully (check frontmatter)
- **When:** Inline, Approve gate (SC)
- **On failure:** Warning displayed. Human confirms at approve: «да, этот SC — чистая навигация без BR» или добавляет BR.
- **Rationale:** Многие SC имеют бизнес-правила (validation, authorization). Но некоторые — чистая навигация (logout, открытие dashboard). Блокировка 🔴 была бы ложно-строгой.

#### V-03: BR referenced in SC are all active
- **Tier:** 🔴 Blocking
- **Statement:** Все BR-*, на которые ссылается active SC-*, должны быть в status=active.
- **Artifacts affected:** SC-*, BR-*
- **Automation:** ✅ Fully
- **When:** Inline, Approve gate, Handoff
- **On failure:** SC cannot be active с ссылками на draft/deprecated BR.
- **Rationale:** Draft BR может содержать неутверждённые параметры — нельзя использовать в active сценариях.

#### V-04: SC references active FM
- **Tier:** 🔴 Blocking
- **Statement:** SC-* в status=active должен ссылаться на FM-* в status ∈ {in-progress, shipped}.
- **Artifacts affected:** SC-*, FM-*
- **Automation:** ✅ Fully
- **When:** Inline, Approve gate
- **On failure:** SC без активной родительской FM — orphan.

#### V-05: LC states reachable from initial
- **Tier:** 🔴 Blocking
- **Statement:** В LC-*, каждое state в states[] должно быть достижимо из initial_state через transitions.
- **Artifacts affected:** LC-*
- **Automation:** ✅ Graph BFS/DFS
- **When:** Inline (на LC save), Approve gate (LC)
- **On failure:** State machine broken. Human резолвит: либо добавить transition, либо удалить orphan state.
- **Rationale:** Orphan state = bug в state machine; сущность никогда туда не попадёт.

#### V-06: LC transitions have trigger and/or guard
- **Tier:** 🟡 Warning
- **Statement:** Каждый transition в LC-* должен иметь trigger (ссылка на SC шаг) или guard (ссылка на BR).
- **Artifacts affected:** LC-*, SC-*, BR-*
- **Automation:** ⚠ Partial (parsing markdown table)
- **When:** Approve gate (LC)
- **On failure:** Warning, human confirms.
- **Rationale:** Transition без trigger висит в воздухе. Но иногда transitions чисто system-driven (timers), и явной ссылки на SC может не быть.

#### V-07: VC covers all SC branches
- **Tier:** 🟡 Warning (partial)
- **Statement:** Для SC с alternative/error flows — каждый flow должен быть покрыт соответствующим VC.
- **Artifacts affected:** SC-*, VC-*
- **Automation:** ⚠ Partial (count per flow_type, не семантика)
- **When:** Approve gate (VC), Handoff
- **On failure:** Warning «VC covers только main; alt-flows (SC-005a, SC-005e1) не покрыты». Human решает.
- **Rationale:** Полная семантическая проверка покрытия требует понимания потоков. Count — первое приближение.

#### V-08: Terms in SC/BR/LC defined in BG
- **Tier:** 🟡 Warning
- **Statement:** Все термины, выделенные жирным (**term**) в теле SC/BR/LC, должны быть определены в BG.
- **Artifacts affected:** SC-*, BR-*, LC-*, BG
- **Automation:** ✅ Regex extraction + lookup
- **When:** Inline (при save артефакта), On-demand
- **On failure:** Warning с suggestion «добавить в BG» или «не выделять жирным, если не term». Ассистент предлагает draft entry.
- **Rationale:** Имена сущностей должны быть единообразны. Bold text как marker — простая эвристика, false positives на emphasis — acceptable, human фильтрует при approve BG term.

#### V-09: SEG has exactly 1 VP
- **Tier:** 🔴 Blocking
- **Statement:** Каждый SEG-* в status=active должен иметь exactly one VP-* referenced в frontmatter.value_proposition.
- **Artifacts affected:** SEG-*, VP-*
- **Automation:** ✅ Fully
- **When:** Approve gate (SEG), On-demand
- **On failure:** SEG cannot be active без VP.
- **Rationale:** DEC-ART03 установил 1:1 отношение SEG↔VP. Без VP сегмент без ценностного предложения.

#### V-10: FM has SEG and JTBD
- **Tier:** 🔴 Blocking
- **Statement:** Каждый FM-* должен иметь frontmatter.segment (FM не существует в вакууме) и frontmatter.jtbd[] (≥1 JTBD из SEG.body).
- **Artifacts affected:** FM-*
- **Automation:** ✅ Fully
- **When:** Inline (на FM save), Approve gate
- **On failure:** FM без SEG — это не фича, а абстрактная хотелка. Блок.
- **Rationale:** Каждая фича должна обслуживать конкретный сегмент и решать конкретные JTBD.

#### V-11: Bi-directional references consistent
- **Tier:** 🔴 Blocking (но с auto-fix)
- **Statement:** Если A.relates_to[] содержит B, то B должен содержать A в соответствующем reverse поле.
- Examples: SC-005 references BR-010 → BR-010.scenarios[] contains SC-005.
- **Artifacts affected:** все артефакты с cross-references
- **Automation:** ✅ Fully + auto-fix (ассистент добавляет обратную ссылку с уведомлением)
- **When:** Inline (на любое save)
- **On failure:** Auto-fix; если не может fix (e.g., target артефакт не существует) — blocking error.
- **Rationale:** Data integrity. Без bi-dir невозможен proper cascade analysis.

#### V-12: No stale drafts (>14 days)
- **Tier:** 🟡 Warning
- **Statement:** Артефакты в status=draft, не обновлявшиеся более 14 дней (configurable), помечаются как stale.
- **Artifacts affected:** все
- **Automation:** ✅ Fully (date comparison)
- **When:** Periodic (scheduled в v2), On-demand
- **On failure:** Warning в /product:status с предложением: resume / archive / delete.
- **Rationale:** Забытые drafts накапливают шум. Но иногда draft лежит месяц обоснованно (ожидает внешней информации).
- **Configuration:** Threshold per-project в `.claude/integrator/validation-config.yaml`: `stale_draft_days: 14 | 30 | 90 | never`.

#### V-14a: Parametric BR conflict detection
- **Tier:** 🟡 Warning
- **Statement:** Если два BR-* имеют overlap в scope (same category + same entity) и conflicting parameters (например, min_budget в BR-001 и max_budget в BR-002 не совместимы) — предупреждение.
- **Artifacts affected:** BR-*
- **Automation:** ✅ Parameter comparison (только числовые / enum conflicts)
- **When:** On BR save, Approve gate (BR)
- **On failure:** Warning. Human резолвит через объединение BR или корректировку параметров. Запись в decision journal.
- **Rationale:** Параметрический конфликт — автоматизируемая часть. Семантические конфликты — через P-RULE-02 (DA review).
- **Note:** Замещает изначально предложенный V-14 («semantic conflicting BR») — та часть идёт в P-RULE-02.

#### V-15: Orphan artifacts detection
- **Tier:** 🟡 Warning
- **Statement:** Артефакты не используемые никакой FM-* / не ссылаемые никакими active артефактами — помечаются как orphan.
- Examples: SC без активной FM-родителя; BR без active SC использующего; LC без SC ссылок.
- **Artifacts affected:** SC-*, BR-*, LC-*, MK-*, VC-*, IC-*, RPM (если нет SC с ролями), etc.
- **Automation:** ✅ Graph analysis (все артефакты → обратные ссылки → unused)
- **When:** On-demand через `/product:cleanup --dry-run`, On-demand validate
- **On failure:** Warning list + recommendation (archive / delete / re-link).
- **Rationale:** Накопление orphan = загрязнение `.product/`. Регулярный cleanup.

#### V-16: NFR Review status tracking
- **Tier:** 🔵 Info (pending) / 🔵 Info (declined, normal) / 🟡 Warning (pending at MMP+) / 🔴 Blocking (high-risk + declined без rationale)
- **Statement:** FM должна пройти F.5a NFR Review. Результат — один из трёх `nfr_status`: active, declined, pending. Правило проверяет корректность статуса per контекст фичи.
- **Artifacts affected:** FM-*, NFR-*
- **Automation:** ✅ Status check + tier/risk context analysis
- **When:** Approve gate (FM → in-progress), Handoff generation, On-demand
- **Поведение по статусу:**

| Статус FM | Tier MVP | Tier MMP+ | High-risk FM | High-risk + нет rationale |
|---|---|---|---|---|
| `active` (NFR определены) | ✅ Pass | ✅ Pass | ✅ Pass | — |
| `declined` (с rationale) | ✅ Pass (Info note) | 🟡 Warning | 🟡 Warning | 🔴 Blocking |
| `declined` (без rationale) | 🔵 Info (recommend rationale) | 🟡 Warning | 🔴 Blocking | 🔴 Blocking |
| `pending` (не рассмотрено) | 🔵 Info «рассмотрите через F.5a» | 🟡 Warning | 🟡 Warning | 🟡 Warning |

- **High-risk indicators (auto-detect):** FM frontmatter `requires_nfr: true`, или FM body содержит keywords (payments, PII, billing, real-time, public API, concurrent editing).
- **On tier upgrade (MVP → MMP):** все FM со status=declined или pending автоматически попадают в batch re-review. Ассистент спрашивает: «В MVP вы выбрали defaults для FM-003. При переходе к MMP хотите явно определить NFR?»
- **Interaction with sanity-check:** если NFR имеет `sanity_check: overridden`, V-16 предупреждает «NFR overridden — проверено через DA review?»
- **Rationale:** Opt-in philosophy (DEC-NFR-F08). NFR не обязательны. Правило отслеживает **осознанность решения**, не принуждает к определению. Только высокорисковые фичи без rationale блокируются.

### 5.1a NOTE-* validation (D3 modification — minimal coverage)

NOTE-* — unstructured catch-all артефакт (см. [pmo/artifacts/NOTE.md](artifacts/NOTE.md)). Не участвует в dependency graph, не валидируется V-*.

**Только базовая проверка через V-H-06 семантику:**
- Frontmatter parseable YAML
- Required fields: `id`, `title`, `status`, `created`, `updated`, `version`
- ID формат: `NOTE-<NNN>` (3-значное)
- Status: один из `draft | active | promoted | archived`

При `status: promoted` — frontmatter должен содержать `promoted_to: <ARTIFACT-ID>` (запись о конвертации через `/product:promote-note`).

**НЕ применяются:** V-01..V-15, V-MK-*, V-H-* (NOTE не embed в handoff). Cascade не работает (NOTE-* не имеет dependencies).

### 5.2 Handoff Validation (V-H-01..V-H-10)

#### V-H-01: All mandatory sections present
- **Tier:** 🔴 Blocking
- **Statement:** Handoff body содержит все 13 обязательных секций в правильном порядке (см. handoff-spec §6). Секция 10 — conditional на has_ui=true.
- **Artifacts affected:** Handoff file
- **Automation:** ✅ Fully (parse markdown headings)
- **When:** Handoff generation
- **On failure:** Handoff генерация прервана, status=blocked.

#### V-H-02: Each embedded artifact has hash
- **Tier:** 🔴 Blocking
- **Statement:** Для каждого артефакта в embedded_artifacts[] есть entry в artifact_hashes{} с валидным sha256.
- **Automation:** ✅ Fully
- **When:** Handoff generation, Drift check
- **On failure:** Handoff не может быть создан / признаётся corrupted.

#### V-H-03: All listed embedded artifacts are actually embedded
- **Tier:** 🔴 Blocking
- **Statement:** embedded_artifacts[] ↔ handoff body секции должны совпадать. Если embedded_artifacts.scenarios = [SC-005], то body содержит SC-005 полностью.
- **Automation:** ✅ Fully (cross-check frontmatter vs body)
- **When:** Handoff generation
- **On failure:** Bug в handoff generator; блокирует generation.

#### V-H-04: Artifact hashes match current .product/
- **Tier:** 🟡 Warning (→ status=stale)
- **Statement:** SHA-256 в artifact_hashes должны совпадать с текущим содержимым `.product/`. Любое расхождение → handoff.status=stale.
- **Automation:** ✅ Fully
- **When:** On use of handoff (Integrator verify, external tool ingestion), Periodic
- **On failure:** Warning + предложение `/product:handoff --regenerate`.

#### V-H-05: Cross-references valid within handoff
- **Tier:** 🔴 Blocking
- **Statement:** Ссылки внутри handoff должны резолвиться в embedded артефактах. Если SC-005 body ссылается на BR-010 — BR-010 должен быть embedded в handoff (section 6).
- **Automation:** ✅ Fully
- **When:** Handoff generation
- **On failure:** Self-contained principle нарушен; generation блокируется.

#### V-H-06: Frontmatter valid YAML with required fields
- **Tier:** 🔴 Blocking
- **Statement:** YAML parseable, все required поля (id, type, feature/release, status, version, generated_at, embedded_artifacts, artifact_hashes, validation_rules_passed) присутствуют.
- **Automation:** ✅ Fully
- **When:** Handoff generation, любое reading
- **On failure:** Invalid handoff, не годится для использования.

#### V-H-07: BG excerpt covers all bold terms
- **Tier:** 🟡 Warning
- **Statement:** Все термины, выделенные **bold** в embedded артефактах, присутствуют в BG excerpt (handoff section 3).
- **Automation:** ✅ Regex + lookup
- **When:** Handoff generation
- **On failure:** Warning, suggestion добавить недостающие термины в BG excerpt.

#### V-H-08: UI Specification section filled if has_ui=true
- **Tier:** 🔴 Blocking
- **Statement:** Если FM.has_ui=true, секция 10 handoff должна содержать embedded MK-*, DS snapshot, NM-*.
- **Automation:** ✅ Fully
- **When:** Handoff generation
- **On failure:** Generation блокируется.

#### V-H-09: Dependencies section lists all prerequisite FMs
- **Tier:** 🟡 Warning
- **Statement:** Если FM.frontmatter упоминает dependencies on other FMs (в теле body), секция 12 Dependencies & Context handoff должна их перечислить.
- **Automation:** ⚠ Partial (сложно парсить свободный текст FM)
- **When:** Handoff generation
- **On failure:** Warning; human confirms при approve handoff.

#### V-H-10: Out of Scope section non-empty
- **Tier:** 🟡 Warning
- **Statement:** Секция 13 Out of Scope должна содержать хотя бы явное «ничего явно не исключено для v1» или список исключений.
- **Automation:** ✅ Non-empty check
- **When:** Handoff generation
- **On failure:** Warning. Практика показала (AP-4 в handoff-spec): без явного списка scope creep.

### 5.3 Design Validation (V-MK-01..V-MK-08)

Правила применяются только когда FM.has_ui=true и для MK в этом FM.

#### V-MK-01: All UI-interactive SC steps covered by screens
- **Tier:** 🔴 Blocking
- **Statement:** Каждый шаг SC (в этой FM), который involves UI interaction, должен быть покрыт Screen в MK.Screen Inventory.
- **Automation:** ⚠ Partial (scan SC body for UI verbs: «click», «tap», «see»)
- **When:** Approve gate (MK active), Handoff
- **On failure:** Список непокрытых шагов. Human резолвит: добавить screens или пометить шаги как non-UI.

#### V-MK-02: BR constraints reflected in Component State Matrix
- **Tier:** 🟡 Warning
- **Statement:** Validation/authorization BR должны проявляться в error/disabled states компонентов MK.
- Example: BR-013 «apply только если state valid» → ApplyButton должен иметь disabled state с ссылкой на BR-013.
- **Automation:** ⚠ Partial (scan MK Component State Matrix for BR references)
- **When:** Approve gate (MK)
- **On failure:** Warning, suggestion add states.

#### V-MK-03: LC states have UI representation
- **Tier:** 🟡 Warning
- **Statement:** Каждое LC.state сущности, отображаемой в UI, должно иметь UI-визуализацию (визуальные badge, disabled states, hidden elements).
- **Automation:** ⚠ Partial
- **When:** Approve gate (MK)
- **On failure:** Warning «LC-002 state=rejected не имеет UI representation в MK-003».

#### V-MK-04: Logical tab order (suggestion)
- **Tier:** 🔵 Info (downgraded from 🟡)
- **Statement:** Tab order в Accessibility Notes должен быть указан и логичен (от visual top-left к bottom-right обычно).
- **Automation:** ❌ Нет (требует понимания визуального layout)
- **When:** Approve gate (MK)
- **On failure:** Info reminder «убедитесь в логичности tab order».
- **Rationale:** Logical — понятие semantic. Automation невозможна. Суггестия.

#### V-MK-05: Contrast ratio ≥4.5:1
- **Tier:** 🟡 Warning
- **Statement:** Все комбинации цветов текста-фона, используемые в MK (через DS tokens), должны иметь contrast ≥4.5:1 (WCAG AA).
- **Automation:** ✅ Color analysis на DS tokens (есть библиотеки)
- **When:** Approve gate (MK), DS update
- **On failure:** Warning с list pairs, failing ratio.

#### V-MK-06: Touch targets ≥44x44px (guideline)
- **Tier:** 🔵 Info (downgraded from 🟡)
- **Statement:** Interactive elements на mobile должны иметь минимум 44x44px hit area.
- **Automation:** ❌ Real rendering not available
- **When:** Approve gate (MK) — reminder в checklist
- **Rationale:** Физический рендер требует реального фронтенда. Без этого можно только напомнить guideline.

#### V-MK-07: Responsive breakpoints covered
- **Tier:** 🟡 Warning
- **Statement:** Если MK.platform=responsive или mobile, секция 4 Responsive Notes должна содержать breakpoints и изменения layout.
- **Automation:** ✅ Section presence + keyword check
- **When:** Approve gate (MK)
- **On failure:** Warning «platform=responsive, но Responsive Notes пусто».

#### V-MK-08: All tokens in MK present in DS
- **Tier:** 🔴 Blocking
- **Statement:** Все color/typography/spacing токены, используемые в MK.Component State Matrix, должны существовать в DS.
- **Automation:** ✅ Token extraction + lookup
- **When:** MK save (inline), Approve gate, DS update
- **On failure:** Auto-extraction в DS (создание draft DS entry с предложением human confirm) ИЛИ block с «hardcoded value: #3B82F6, not in DS — add?».

---

## 6. Cascade Protocol

Cascade Consistency (DEC-P03) — автоматическая проверка downstream артефактов при изменении upstream.

### 6.1 Алгоритм

При изменении артефакта A в состоянии active:

1. **Identify dependents.** Через bi-dir refs (V-11) — все артефакты, которые ссылаются на A.
2. **Breadth-first traversal.** Обрабатываем dependents в порядке depth (direct dependents first).
3. **Per-dependent re-validation.** Для каждого dependent B:
   - Применяем все applicable validations
   - Если B становится invalid из-за изменения A — B переходит в status=requires_review
4. **Priority ordering.** Critical (🔴) артефакты — первые в отчёте.
5. **Bundle approve.** Ассистент показывает полный список изменений, human approves bundle или по одному.

### 6.2 Приоритет артефактов

При cascade — порядок проверки:

1. Critical-level (🔴): BR, IC
2. Strategic-level (🟠): PS, SEG, VP, HYP, MVP, FM, SC, MK
3. Standard-level (🟡): MR, CA, RL, RM, BG, DS
4. Confirmation-level (🟢): LC, RPM, VC, NM (derived)

Первыми проверяем Critical и Strategic — там последствия дороже.

### 6.3 Пример cascade

Изменение BR-010 (parameter linking_strategy changed):

```
BR-010 changed
  ↓
Cascade analysis identifies dependents:
  ├── SC-005, SC-005a, SC-005e1 (list from BR-010.scenarios)
  ├── LC-002 (BR-010 в guards)
  ├── IC-003 (BR-010 supports this invariant)
  └── FM-003 (FM containing this BR)
  
Re-validate each:
  - SC-005: re-check V-02, V-03 — OK (BR-010 still active)
  - SC-005a: re-check — OK
  - SC-005e1: re-check — OK
  - LC-002: re-check V-05 (states reachable), V-06 (transitions valid) — OK
  - IC-003: re-check support (P-RULE-01) — triggers DA review
  - FM-003: re-check V-01, V-10 — OK; status → requires_review
  
Report:
  ✓ 4 dependents validated
  ⚠ 1 requires human attention: IC-003 (P-RULE-01 DA review needed)
  ⚠ 1 requires status update: FM-003 (→ requires_review)
  
Approve bundle? (y/n/per-item)
```

---

## 7. Process Rules (non-automatable)

Правила, которые не могут быть автоматизированы, но **обязательны** как явные шаги процесса.

### P-RULE-01: IC change mandates Product DA review (adaptive-depth, refactored DEC-DEV-0012)
- **Replaces:** V-13 (IC non-conflict check — not automatable)
- **Statement:** **Любое** добавление / изменение / удаление IC-* триггерит Product DA review через subagent invocation. Subagent **сам адаптирует depth** в зависимости от характера change.
- **Adaptive-depth model:**
  - Subagent (Шаг 1, ~30 сек): classify change as `cosmetic` или `significant` (анализ git diff против HEAD)
  - Subagent (Шаг 2): если `cosmetic` → quick consistency check (~5 мин output, 1 блок findings); если `significant` → full 6-lens review (~20-30 мин output)
  - Single subagent invocation, no double LLM call
- **Significant triggers (full 6-lens):**
  - Creation (новый IC)
  - Severity change to/from `critical`
  - Statement semantic change
  - Entity change (IC переходит на другую сущность)
- **Cosmetic triggers (quick consistency check):**
  - Typo / formatting / переформулировка без semantic change
  - Reference list additions/removals в `rules[]` / `lifecycles[]`
  - Frontmatter metadata-only updates
- **Output format:** subagent returns `magnitude: cosmetic | significant` + `classification_rationale` + `findings`. См. processes.md §6.2 для детали.
- **Enforcement:** hook `ic-change-trigger.js` invokes subagent on PostToolUse Write/Edit `.product/invariants/*.md`.
- **Blocking:** IC нельзя в active без DA review approval (для both cosmetic + significant — cosmetic check тоже требует resolution найденных issues).

### P-RULE-02: BR semantic conflict review at BR changes (adaptive-depth, refactored DEC-DEV-0012)
- **Replaces:** V-14 semantic part (parameter-level — V-14a auto; semantic — manual через DA)
- **Statement:** **Любое** active BR change триггерит DA subagent invocation. Subagent адаптирует depth (как P-RULE-01).
- **Adaptive-depth model:** see P-RULE-01.
- **Significant triggers (full 6-lens):**
  - Creation (новый BR)
  - Parameter type change (enum→number, nullable flip, cardinality)
  - Category change (validation → calculation)
  - Statement rewrite (semantic diff)
- **Cosmetic triggers (quick consistency check):**
  - Parameter value tune в рамках того же type (`first_match` → `best_match`)
  - Typo / formatting
  - Adding/removing scenarios refs (cascade-handled separately, но DA quick-checks impact)
- **Enforcement:** hook `br-change-trigger.js` invokes subagent on PostToolUse `.product/business-rules/*.md`.
- **Blocking:** BR нельзя в active без impact analysis approve (всех magnitudes).

### Почему adaptive-depth вместо прежней magnitude-gated модели

> **Refactor history (DEC-DEV-0012, 2026-04-20):** ранее P-RULE-01/02 использовали magnitude-gated модель с **skip + DA debt** для cosmetic changes. Накопленный долг проверялся batch'ем на FM-level approve gate.
>
> **Проблемы прежней модели:**
> 1. Классификация magnitude (нужен DA или нет) сама по себе требует analysis — почти столько же effort, сколько quick consistency check
> 2. Decisions принимаются пост-фактум (batch later), а нужны в момент изменения
> 3. DA debt accumulation создавал hidden risk — забытые changes
>
> **Adaptive-depth решает все три:** single subagent invocation, depth adapts to actual significance, decisions in-the-moment, no debt accumulation.

---

## 8. Deferred / Moved Rules

### 8.1 Отложенные

*(нет отложенных на данный момент — V-16 NFR был восстановлен в итерации 8, OQ-03 закрыт)*

### 8.2 Перемещённые в Integrator namespace (V-I-*)

Следующие правила — **cross-boundary** между Product Layer и внешними инструментами. Они не валидация Product Layer, а контракты между ним и tool-конвейером. Переходят под ответственность Integrator Module (создаются автоматически при `/integrator:add <tool>` и живут в `.claude/integrator/validation-rules.yaml`).

| Было | Статус | Integrator namespace | Описание |
|---|---|---|---|
| V-17 / V-20 | → Integrator | V-I-CC-01 (если cc-sdd) или V-I-<tool>-01 | FM shipped → `.kiro/specs/{feature}/spec.json` exists (для cc-sdd) |
| V-21 | → Integrator | V-I-<tool>-02 | BG terms → match entity names в design.md |
| V-22 | → Integrator | V-I-<tool>-03 | VC-* → acceptance criteria covered в VERIFICATION/tests файлах |
| V-23 | → Integrator | V-I-<tool>-04 | FM in RL → tasks generated в `.planning/tasks.json` (или tasks store tool'а) |

**Зачем перенесены:**
- `.kiro/`, `.planning/` — принадлежат конкретным внешним инструментам (cc-sdd, GSD, etc.)
- Если мы заменим cc-sdd на Kiro — правила поменяются, а правила Product Layer не меняются
- Tool-agnostic принцип требует изоляции этих проверок

**Реализация:** Integrator при `/integrator:add cc-sdd` генерирует adapter + соответствующие V-I-CC-* правила в validation-rules.yaml. При `/integrator:verify` эти правила выполняются для проверки целостности всей цепочки.

---

## 9. Configuration & Project Overrides

### 9.1 Файл конфигурации

`.claude/integrator/validation-config.yaml`:

```yaml
version: 1
project: translateit
global_overrides:
  # Severity overrides per rule
  rules:
    V-02:
      severity: warning                # default: warning, explicit
      rationale: "Многие наши SC чисто навигационные"
    V-12:
      threshold_days: 30                # default: 14
      rationale: "У нас большой проект с длинными drafts"
    V-MK-05:
      severity: blocking                # upgrade from warning
      rationale: "WCAG compliance требуется юридически для этого проекта"
  
  # Disabled rules (редко, требует обоснования)
  disabled:
    # V-07:
    #   rationale: "Слишком много false positives на нашей модели SC; 
    #               проверяем VC-покрытие через manual code review"
    #   approved_by: user
    #   approved_at: 2026-06-01
```

### 9.2 Правила использования overrides

- **Upgrade (→ blocking)** — всегда ок, повышает строгость
- **Downgrade (→ warning)** — требует rationale в YAML
- **Disabled** — требует approved_by + approved_at + rationale; запись в decision journal

### 9.2a `/product:meta-feedback` workflow (C3 modification)

Если ассистент видит, что правило систематически создаёт false positives или больше не подходит проекту — он может **инициировать** обсуждение ecosystem-level change через `/product:meta-feedback`:

```
[Assistant]
Meta-feedback proposal:

Наблюдение: V-07 (VC coverage alt-flows) триггерил 4 раза за последнюю
неделю. Все 4 — для FM с flow_type=main scenarios без alt branches
(simple CRUD operations). False positive rate: 100% в этом проекте.

Proposal: downgrade V-07 до 🔵 Info для scope где alt-flows отсутствуют
по design (или per-rule expand для distinguishing).

Rationale: текущая severity 🟡 создаёт noise при approve gate VC.
Реальные alt-flow gaps ловятся через V-MK-01 (для UI) и manual review.

Apply override?
  [Y] Yes — добавить в validation-config.yaml + journal entry
  [N] No — оставить как есть
  [E] Edit proposal — refine
  [D] Defer — посмотрим на ещё кейсы
```

При Y → ассистент сам обновляет `validation-config.yaml` с rationale + добавляет entry в decision journal. Human может revert через git.

**Это feedback loop AI → ecosystem.** Защита от ситуации «правило неудобно, но никто не предлагает изменить — все молча страдают/игнорируют».

### 9.3 Per-artifact override

Для исключительных случаев в frontmatter конкретного артефакта:

```yaml
---
id: SC-042
# ...
validation_overrides:
  - rule: V-02
    reason: "Pure navigation scenario — logout, no business rules apply"
    approved: true
---
```

Используется для **конкретного артефакта**, не меняя глобальное правило. Зафиксирован в git.

### 9.4 Approve overrides (D2 modification)

Для случаев когда нужно перейти draft → active при наличии failing 🔴 Blocking rule (например, временно: «UI spec будет добавлен позже, мы делаем PoC сейчас»):

```yaml
---
id: FM-007
# ...
approve_overrides:
  - rule: V-H-08                       # UI Specification missing
    reason: "PoC stage — реализуем без UI пока, добавим в v0.2"
    approved_by: human
    approved_at: 2026-04-18T15:30
    expires_at: 2026-05-18              # optional — когда override должен быть пересмотрен
---
```

**Поведение:**
- Артефакт переходит в active вопреки blocking rule
- Запись в decision journal с rationale
- В `/product:validate` показывается как «known override» (не как failure)
- Если `expires_at` указан и наступил — переходит в active warnings, требует review

**Отличие от `validation_overrides`:** validation_overrides меняет severity навсегда для этого артефакта; approve_overrides — временное разрешение пройти gate (rule остаётся active).

**Использовать осторожно.** Если переопределяете часто одну и ту же rule — это сигнал для project-level downgrade через `validation-config.yaml`.

---

## 10. Implementation Notes

### 10.1 Инструменты реализации

- **Inline validation** — hook `product-artifact-validate.js` (JS, PostToolUse)
- **On-demand validation** — slash-command `/product:validate` с опциями `--rule V-07`, `--tier blocking`, `--scope SC-*`
- **Cascade validation** — skill `cascade-validator.md` + sub-component для обхода графа
- **Orphan detection (V-15)** — standalone команда `/product:cleanup --dry-run`

### 10.2 Severity определение runtime

```javascript
// Pseudo-code
function getRuleSeverity(ruleId, projectConfig) {
  const defaultSeverity = RULES[ruleId].defaultTier;  // из этого каталога
  const override = projectConfig.rules[ruleId]?.severity;
  return override || defaultSeverity;
}
```

### 10.3 Reporting формат

`/product:validate` output:

```
=== VALIDATION REPORT ===
Project: translateit
Scope: .product/** 
Time: 2026-06-15 14:30

🔴 BLOCKING (3):
  V-01 : FM-007 has no active SC
  V-05 : LC-003 state "abandoned" unreachable from initial
  V-H-02: HANDOFF-FM-009 missing hash for SC-012

🟡 WARNING (12):
  V-02 : SC-015 has no BR references (pure navigation? confirm)
  V-07 : VC coverage missing alt-flow for SC-005a
  V-12 : 3 stale drafts (>14 days):
           - MR (updated 2026-05-20)
           - CA (updated 2026-05-22)
           - HYP-004 (updated 2026-05-10)
  V-H-07: HANDOFF-FM-003 BG excerpt missing term "Revision batch"
  V-MK-02: MK-005 Component State Matrix missing error state for BR-015
  ... (7 more)

🔵 INFO (5):
  V-MK-04 : MK-003 — review tab order для новых пользователей
  V-MK-06 : MK-003 — verify touch targets на mobile
  ... (3 more)

SUMMARY: 3 blocking, 12 warnings, 5 info
Actionable: /product:validate --fix (auto-fixes where possible: V-11 bi-dir refs)
```

### 10.4 Performance targets

- Inline validation (на save): <100ms на артефакт (не блокирует workflow)
- Approve gate validation: <500ms (pauseable UX)
- On-demand full: <10s для проекта до 100 артефактов
- Cascade validation: <2s per изменение в typical кейсе (5-10 dependents)

### 10.5 Test coverage

Собственные тесты валидаторов:
- Fixture-based: заданные `.product/` состояния → ожидаемые validation results
- Regression: на реальных проектах (TranslateIT) — сохранённые snapshots результатов
- Mutation testing: случайные изменения в fixtures → должны ловиться правильными rules

---

## 11. Следующие шаги

- [ ] Реализовать hook `product-artifact-validate.js` (inline check для V-01..V-11)
- [ ] Реализовать skill `on-demand-validator.md` для `/product:validate` (все правила)
- [ ] Реализовать `/product:cleanup --dry-run` для V-15
- [ ] Написать fixture tests для каждого правила
- [ ] При закрытии OQ-03 (NFR) — добавить V-16 обратно
- [ ] При первом `/integrator:add <tool>` — сгенерировать V-I-* через Integrator

---

**Конец каталога.**

Статус: **консолидировано, готово к имплементации.** Критический обзор пройден — 32 активных правила + 2 process rules, все остальные либо автоматизируются, либо явно заменены на process.
