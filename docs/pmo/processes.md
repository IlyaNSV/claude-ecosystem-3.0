# Processes P1-P5 — Ecosystem 3.0

> **Версия:** 1.0 draft (2026-04-17)
> **Назначение:** методология создания, обновления и поддержки артефактов D1-D2. Как ведётся диалог, как работают approve gates, BG extraction, cascade consistency, Product DA review.
> **Читать вместе с:** [artifacts catalog](artifacts/README.md), [validation.md](validation.md), [handoff-spec.md](../product-module/handoff-spec.md).

## 1. Philosophy & Principles

### 1.1 Фундаментальный паттерн: «Продуктовый ассистент draft → iterate → approve» (DEC-P13)

**Ни один артефакт не создаётся человеком с чистого листа.** Все 24 типа артефактов создаётся через унифицированный паттерн:

```
1. Ассистент готовит draft на основе доступных входов
     ↓
2. Представляет human'у с явными точками выбора
     ↓
3. Human корректирует / спрашивает альтернативы / доуточняет
     ↓
4. Ассистент обновляет draft
     ↓
5. (итерации 3-4 до согласия)
     ↓
6. Human approves → status: draft → active
     ↓
7. Ассистент post-approve: BG extraction, cascade check, validation run
```

### 1.2 Принципы

**P1: Assistant-led, human-approved.** Ассистент делает работу (research, drafts, derivation); человек принимает решения.

**P2: Iterative > waterfall.** Итерации — норма. Не «один большой прогон» а 2-4 мелких кругов.

**P3: Явные точки выбора.** Ассистент не прячет решения в тексте; выносит как вопросы с опциями.

**P4: Approve — не формальность.** Approve означает, что артефакт реально соответствует реальности, не «красиво выглядит».

**P5: Post-approve automation.** После approve — автоматически: BG extraction, validation, cascade check, version++.

**P6: Сессионная модель.** Процессы организованы как сессии с чётким входом/выходом, не бесконечный chat.

**P7: Прозрачная эскалация.** Когда ассистент не уверен — явно сигнализирует; не «угадывает».

### 1.3 4 уровня review (напоминание из каталога)

| Level | Где применяется | Что значит approve |
|---|---|---|
| 🔴 Critical | BR, IC | Обязательный DA review + impact analysis per каскад |
| 🟠 Strategic | PS, SEG, VP, HYP, MVP, FM, SC, MK | Явный human approve по соответствию реальности |
| 🟡 Standard | MR, CA, RL, RM, BG, DS | Human валидирует выводы; автоапдейты ок с уведомлением |
| 🟢 Confirmation | LC, RPM, VC, NM | Human подтверждает корректность деривации |

---

## 2. Approve Gates Methodology

### 2.1 Что такое gate

**Gate** — именованная точка решения в процессе, где:
1. Результаты предыдущих шагов собраны
2. Ассистент просит явного approve
3. Проходят inline-validations (из `validation.md`)
4. При approve — cascade check на downstream
5. Документируется в decision journal (если strategic-level)

### 2.2 Gates в P1 Discovery Session

Принцип: 🟠 Strategic gates — explicit per-item (важные стратегические решения). 🟡 Standard артефакты — собираются в **Discovery Review Checkpoint** для batch-обработки (research outputs не теряют смысл при групповом review).

| Gate | После шага | Артефакт | Review | Что разблокирует |
|---|---|---|---|---|
| **G1** | D1.1 Problem Discovery | PS → active | 🟠 Strategic (per-item) | MR + CA могут начаться (parallel) |
| ⚙️ | D1.2 Market Research | MR draft готов | (queued для Checkpoint) | следующий шаг продолжается; MR пойдёт на batch approve |
| ⚙️ | D1.3 Competitive Analysis | CA draft готов | (queued для Checkpoint) | следующий шаг продолжается |
| **G4** | D1.4 Segment & JTBD | SEG-* → active | 🟠 Strategic (per-item) | VP-* готов к драфту |
| 🔁 **DRC** | После G4 (Discovery Review Checkpoint) | MR + CA bundle approve | 🟡 Standard (batch) | research зафиксирован как baseline для VP/HYP |
| **G4a** | После DRC | VP-* → active | 🟠 Strategic (per-VP) | HYP имеют VP для проверки |
| **G5** | D1.5 Hypothesis Formulation | HYP-* → testing | 🟠 Strategic (per-HYP) | MVP scope определяется; Discovery завершена |

**Discovery Review Checkpoint (DRC) UX:**

```
After G4 SEG approve, before VP drafting:

[Assistant]
Discovery Review Checkpoint.

Research собран:
  ✓ MR (draft, 8 sources, credibility med-high)
  ✓ CA (draft, 5 competitors, feature matrix готова)

Перед VP design давай зафиксируем research baseline.

Просмотри:
  [1] MR — посмотреть/correct
  [2] CA — посмотреть/correct
  [3] Approve обе → перейти к VP design
  [4] Reject (вернуться к research)

> 3

[Assistant]
✓ MR → active, CA → active
✓ BG extraction batch (12 new term candidates pending)
Continuing to D1.4a Value Proposition for SEG-001...
```

**Обоснование batch-подхода:** MR и CA — research outputs. Их approve по отдельности теряет ценность, если они не повлияли на промежуточные решения. Snapshot после SEG (когда понятно, для кого делаем) — естественная точка ratchet.

### 2.3 Gates в P1 Planning Session

Planning Session не использует нумерованные gates — вместо них per-artifact approve:
- MVP approve → RM draft разблокирован
- RM approve → RL-* могут создаваться
- Каждый RL approve → FM skeletons для этого релиза могут создаваться
- Каждый FM skeleton approve → P2 для этой фичи разблокирован

### 2.4 Gates в P2 Feature Definition

Не нумерованные; per-artifact approve:
- SC approve → BR extraction
- BR approve → LC derivation возможен
- LC approve → VC derivation возможен
- VC approve → IC identification
- IC approve → FM может перейти в in-progress
- Если has_ui=true → P2.5 Design параллельно с approve MK
- Все approve → /product:handoff разблокирована (pending DoR)

### 2.5 Что происходит на approve

#### 2.5.1 Стандартный путь (🔴 Critical, 🟠 Strategic, 🟡 Standard)

```
Human: "Approve"
    ↓
Assistant runs:
  1. Inline validation (applicable V-* rules per active validation_tier)
      ├── All blocking passed? → continue
      └── Blocking failed? → stop, show errors, status stays draft
  2. Status transition: draft → active (или specific)
  3. version++ в frontmatter
  4. BG extraction запущена (§5)
  5. Cascade check (§4) — identifies dependents, предлагает bundle
  6. updated timestamp обновлён
  7. Decision journal entry (для Strategic/Critical)
  8. Git commit (обычно human делает, но ассистент может suggest)
```

#### 2.5.2 Auto-approve путь для 🟢 Confirmation артефактов

Артефакты уровня 🟢 Confirmation (LC, VC, RPM, NM) — деривации из upstream артефактов. Если ассистент уверен в деривации и валидация чистая — auto-transition в active без явного human approve.

**Условия auto-approve (все три должны быть истинны):**
1. `confidence: high` в frontmatter
2. `confidence_notes:` не пусто (явное обоснование)
3. Все applicable V-* (per validation_tier) — passed без warnings

**Если хотя бы одно false → стандартный путь (2.5.1).**

**Notification flow:**

```
Assistant derives LC-002 with confidence: high.
Validation: V-05, V-06 passed, no warnings.

Auto-transitioning LC-002 → active.

  ✓ LC-002 (Revision lifecycle) auto-approved
    Confidence: high
    Rationale: derived from SC-005 transitions + BR-010,011 guards;
               no missing states detected; bidirectional refs consistent.

  Скажи "revert LC-002" чтобы откатить в draft (cascade откатится тоже).
```

**Когда НЕ применяется auto-approve:**
- 🔴 Critical (BR, IC) — никогда
- 🟠 Strategic (PS, SEG, VP, HYP, MVP, FM, SC, MK, NFR) — никогда
- 🟡 Standard (MR, CA, RL, RM, BG, DS) — не auto, но через Discovery Review Checkpoint (§3.1)

**Конфигурация** (`.claude/product.yaml`):
```yaml
auto_approve_confirmation_artifacts:
  enabled: true                      # default true
  requires_high_confidence: true     # если false — medium тоже auto
```

### 2.6 Что происходит если approve отозван (rework)

Если человек говорит «нет, переделаем»:
- Status остаётся draft (если был) или возвращается draft из active (редко, требует rationale)
- Причина фиксируется как комментарий в журнале диалога
- Ассистент готовит revised draft с учётом feedback

---

## 3. Processes

### 3.1 P1: Initialization (Discovery + Planning)

**Цель:** от идеи продукта до готового MVP scope с FM skeletons.

**Разбит на 2 сессии** (DEC-P01, CONFLICT-03 resolved):

#### P1.A Discovery Session (3-5 часов)

**Вход:**
- Текстовое описание идеи продукта от человека
- Опционально: контекст (отрасль, примерная аудитория)

**Mode:** Quick (30-60 мин total) или Deep (2-4 часа) — выбирается в начале.

**Последовательность:**

1. **D1.1 Problem Discovery**
   - Ассистент задаёт 5-8 уточняющих вопросов (контекст, масштаб, alternatives)
   - Формирует draft PS
   - Iterate до approve → **G1**
   - Выход: `.product/problem.md` в active

2. **D1.2 Market Research**
   - Quick mode: 5-8 web searches + 3-5 scrapes → MR draft с `[оценочно]` пометками
   - Deep mode: spawn subagent `market-researcher.md` с 8-фазным pipeline
   - **MR draft queued для Discovery Review Checkpoint** (не отдельный gate)
   - Выход: `.product/market-research.md` в draft

3. **D1.3 Competitive Analysis**
   - Discovery конкурентов (Exa + Brave + Firecrawl)
   - Presentation списка human'у для корректировки
   - Quick: базовая feature matrix / Deep: spawn `competitor-analyst.md` subagent
   - **CA draft queued для DRC**
   - Выход: `.product/competitive-analysis.md` в draft

4. **D1.4 Segment & JTBD Definition**
   - Синтез из PS + MR draft + CA draft
   - Ассистент предлагает 2-4 сегмента с 2-4 JTBD каждый
   - Human корректирует, уточняет приоритеты (primary/secondary/exploratory)
   - Iterate → **G4** (per-SEG approve)
   - Выход: `.product/segments/SEG-00N-*.md` (2-4 файла) в active

4.5. **🔁 Discovery Review Checkpoint** (после G4, перед D1.4a)
   - Ассистент presents bundle: MR + CA готовы для approve
   - Human видит снэпшот research после того, как сегментация уже сделана (контекст clearer)
   - Bundle approve / per-item / reject
   - Выход: MR, CA → active

5. **D1.4a Value Proposition** (auto-follows DRC)
   - Для каждого active SEG — ассистент формирует VP-* (1:1)
   - Использует CA для differentiation
   - Iterate per VP → **G4a** per VP
   - Выход: `.product/value-propositions/VP-00N-*.md` в active

6. **D1.5 Hypothesis Formulation**
   - На основе SEG + VP + MR ассистент предлагает 3-5 HYP
   - Human утверждает метрики и пороги (success/invalidation/deferred zone)
   - Iterate → **G5**
   - Выход: `.product/hypotheses/HYP-00N-*.md` в status=testing

7. **D1.5z BG extraction финальный проход**
   - После всех G1-G5 — ассистент делает полный BG extraction по всем созданным артефактам
   - Presents accumulated terms human'у батчем
   - Human approves BG → Discovery Session завершена

**Выходы Discovery Session:**
- `.product/problem.md`
- `.product/market-research.md`
- `.product/competitive-analysis.md`
- 2-4 `.product/segments/SEG-*.md`
- 2-4 `.product/value-propositions/VP-*.md`
- 3-5 `.product/hypotheses/HYP-*.md`
- `.product/glossary.md` с ~15-30 терминами

**Команда запуска:** `/product:init [--deep] [--continue]`

#### P1.B Planning Session (2-3 часа)

**Вход:** все артефакты Discovery в active + status=testing для HYP.

**Последовательность:**

1. **D1.6 MVP Scope Definition**
   - Ассистент предлагает primary HYP (из списка) + набор фич для валидации
   - Human определяет MoSCoW priorities
   - MVP approve
   - Выход: `.product/mvp-scope.md` в active

2. **D1.7 Product Roadmap**
   - Из MVP + HYP ассистент строит draft RM (3-6 мес горизонт, направления)
   - Human уточняет phase (MVP), horizon goals
   - RM approve
   - Выход: `.product/roadmap.md` в active

3. **D1.8 Release Planning**
   - RL-001 (обычно = MVP) детальнее: target_date, features, rollout plan
   - Для каждого FM в RL-001 — skeleton FM-* (из обсуждения)
   - Per-FM approve skeleton (has_ui? priority? связь с HYP?)
   - RL-001 approve
   - Выход: `.product/releases/RL-001-*.md` + `.product/features/FM-00N-*.md` (planned status, skeletons)

**D1.9 Feature Prioritization** — не отдельный процесс, continuous dialog (DEC-P07). Через `/product:status` + обсуждение, не периодический ритм.

**Команда запуска:** `/product:plan`

---

### 3.2 P2: Feature Definition

**Цель:** обогатить FM skeleton до полноценной поведенческой спецификации, готовой к handoff.

**Триггер:** `/product:feature <FM-id>` (enrichment) или `/product:feature "<описание новой фичи>"` (creation).

#### P2.A Enrichment mode (FM skeleton существует)

**Вход:** FM-* в status=planned (skeleton создан в P1.B).

**Последовательность:**

1. **F.1 Load FM context**
   - Ассистент читает FM skeleton + связанные SEG/VP/HYP
   - Показывает human'у контекст: «Обогащаем FM-003 Revisions inbox. Связано с SEG-001 JTBD-1, проверяет HYP-001. Priority MUST. Has_ui=true.»

2. **F.2 Scenario Authoring**
   - Ассистент предлагает SC-* (обычно 2-4 scenarios на фичу)
   - Per-SC: actors, preconditions, trigger, steps, postconditions
   - Human корректирует шаги, добавляет alternative/error flows (отдельные SC)
   - Per-SC approve
   - Выход: `.product/scenarios/SC-00N-*.md` в active

3. **F.3 Business Rule Extraction**
   - Из шагов active SC ассистент извлекает implicit правила
   - Present human'у: «В SC-005 шаг 3 применяется rule email→project linking. Формализовать как BR?»
   - Per-BR: category, parameters, rationale, scenarios[] (bi-dir auto-updated)
   - Per-BR approve
   - Выход: `.product/business-rules/BR-00N-*.md` в active

4. **F.4 Entity Lifecycle Derivation**
   - Для каждой сущности в SC/BR — ассистент предлагает LC
   - Derivation через extraction states + transitions из SC steps + BR guards
   - Human подтверждает (🟢 Confirmation)
   - Выход: `.product/lifecycles/LC-00N-*.md` в active

5. **F.5 Invariant Check Identification**
   - Ассистент предлагает кандидатов IC на основе BR и LC
   - Триггерит P-RULE-01 (DA review) per IC
   - Human явно подтверждает — это действительно абсолютное правило?
   - Выход: `.product/invariants/IC-00N-*.md` в active

6. **F.5a NFR Review** (условный, opt-in)
   
   Шаг состоит из двух фаз: **F.5a.0 Ask** (обязательна) и **F.5a.1 Define** (условна).
   
   **F.5a.0 Ask**
   - Ассистент анализирует FM (has_ui? обрабатывает PII? интегрируется с платежами? real-time?)
   - Определяет typical NFR categories для этой фичи (performance, privacy, reliability, etc.)
   - Показывает **MVP implied defaults** из sanity-check ranges (что будет, если NFR не определять)
   - Задаёт вопрос человеку:
     - **[Y] Обсудим** — переходим к F.5a.1 Define
     - **[D] Положиться на defaults** — status=declined, skip to F.6
     - **[L] Отложить** — status=pending, skip to F.6 (вернёмся через /product:nfr-review или tier upgrade)
   - Результат записывается в FM.frontmatter:
     ```yaml
     nfr_status: active | declined | pending
     nfr_reviewed_at: YYYY-MM-DD
     nfr_decline_reason: "string (optional, recommended)"
     ```
   
   **F.5a.1 Define** (только если F.5a.0 = [Y])
   - Ассистент предлагает NFR-* с **realistic defaults** согласно sanity-check ranges (см. [NFR.md §5](artifacts/NFR.md))
   - Для каждого NFR — target, measurement method, anti-target
   - **Guardrails:** если human выставляет target вне sanity range для tier → warning + требуется override rationale
   - FM.frontmatter.nfr[] обновляется ссылками; nfr_status=active
   - V-16 check активируется с учётом status
   - Выход: `.product/nfr/NFR-00N-*.md` в active
   
   **Когда ассистент рекомендует [Y]:**
   - FM имеет high-risk indicators (payments, PII, real-time, public-facing)
   - Tier продукта >= MMP (MVP можно чаще declined)
   - FM явно помечена `requires_nfr: true` в frontmatter
   - Прошлые pattern'ы похожих фич включали NFR
   
   **Когда [D] или [L] — нормальный выбор:**
   - MVP pilot с известной аудиторией (можно использовать defaults)
   - Фича очень простая / CRUD
   - NFR уже покрыты global NFR-* (scope=global для всего продукта)
   - Ресурс ограничен, фокусируемся на MUST-have

7. **F.6 Verification Criteria Derivation**
   - Из SC + BR + LC + **NFR** ассистент генерирует VC (Given/When/Then)
   - Автопокрытие main + alt + error flows
   - NFR порождает дополнительные VC (например, performance assertions: «p50 load time <2s»)
   - Human подтверждает покрытие (V-07 check)
   - Выход: `.product/verification/VC-00N-*.md` в active

9. **F.7 Role & Permission Model Update**
   - Если появились новые роли в SC.actors — добавить в RPM
   - Actions из SC steps → в RPM matrix
   - Conditional permissions → ссылки на active BR
   - RPM update → human confirm
   - Выход: `.product/rpm.md` обновлён

10. **F.8 Design Module (if has_ui=true) → P2.5**
    - Параллельно с F.2-F.7 запускается P2.5 (см. §3.3)
    - Создание MK-* (Design Package), обновление DS, создание NM-*, обновление AM (app-map singleton)

11. **F.9 Product DA Review (optional, recommended для complex фич)**
    - Запускается перед handoff
    - 6 линз (§6): scalability, reliability, edge cases, security, alternatives, user assumptions
    - **NFR realism:** дополнительная линза при Product DA — проверка NFR на enterprise-copypasta
    - Findings в 3 tier (🔴/🟡/🔵)
    - Human решает, что доработать перед handoff

12. **F.10 FM status transition**
    - Когда все SC/BR/LC/VC/IC/NFR в active, RPM обновлена, MK (если has_ui) в active
    - FM status: planned → in-progress
    - Ассистент проверяет DoR из handoff-spec §7 (включая V-16 NFR coverage)
    - Если всё ок → `/product:handoff FM-xxx` разблокирована

**Выход P2.A:** FM в in-progress, все embedded артефакты в active, handoff.md может быть создан.

#### P2.B Creation mode (новая фича «снизу»)

**Вход:** текстовое описание идеи фичи.

**Разница от enrichment:**

1. **F.0 Idea parsing**
   - Ассистент парсит описание
   - Выделяет: для какого SEG, какой JTBD, какая гипотеза (если явно)

2. **F.0a D1-alignment check**
   - Проверяет: есть ли подходящий SEG в `.product/`? HYP? VP?
   - Если нет соответствия:
     - 🟡 Warning (не блокировка): «Эта фича не привязывается к existing SEG. Создать новый SEG или переосмыслить фичу?»
     - Options: (a) создать новый SEG + JTBD через mini-D1.4 | (b) присвоить existing SEG как best-fit (human решает) | (c) mark as exploratory в FM

3. **F.0b FM skeleton creation**
   - Ассистент формирует FM skeleton (как в P1.B шаг 3)
   - Human approves skeleton
   - FM → status=planned

4. **F.1-F.10 продолжение как enrichment mode**

**Команда:** `/product:feature "описание идеи фичи"`

---

### 3.3 P2.5: Design Module (conditional: has_ui=true)

**Цель:** создать полноценный Design Package (MK), обновить DS, построить NM, обновить AM (app-map singleton, `/design:map`).

**Триггер:** F.8 в P2, если FM.has_ui=true. Также standalone: `/design:start FM-xxx`.

**6 шагов (краткая версия; детали — в будущем `design-module/SPEC.md`):**

1. **D.1 Design Brief Generation** (🟡 Review gate)
   - Ассистент из SC + BR + LC + BG + RPM формирует design brief
   - Human ревьюит, может корректировать (это редактируемый документ, не финальный артефакт)

2. **D.2 Screen Generation** (first iteration, 🟠 Strategic gate)
   - Spawn `screen-generator` subagent через Stitch MCP (или HTML fallback)
   - Генерация первого variant экранов для каждого SC-шага с UI
   - Human смотрит в Stitch/HTML, даёт feedback

3. **D.3 Iterative Refinement** (🟠 Strategic gate at final)
   - Циклический диалог: human feedback → правки
   - Мелкие правки — ассистент через Stitch MCP один вызов
   - Крупные — spawn subagent снова
   - Повторяется до approve

4. **D.4 Component State Matrix** (🟢 Confirmation gate)
   - Skill `component-states.md` проходит checklist
   - Для каждого компонента — проверка покрытия (default, hover, focus, error, disabled, loading, empty, overflow)
   - Ассистент дорисовывает missing states
   - Human confirms

5. **D.5 Artifact Generation** (🟠 Strategic gate)
   - Ассистент записывает MK-* как Design Package
   - DS обновляется (auto-extract tokens/components, human confirms new entries)
   - NM-* генерируется (из MK + LC)
   - Human approves MK в active

6. **D.6 Export for handoff**
   - MK-*, DS snapshot, NM-* готовы для embed в handoff (§10 handoff-spec)

---

### 3.4 P3: Feedback Integration (STUB v1)

**Статус:** out-of-scope v1 (DEC-P08, OQ-09).

**Почему:** D5 (Operations & Feedback) на ~5% покрытии; нет pipeline для сбора и обработки feedback.

**Что делается вместо:**
- Feedback из пилотов TranslateIT — manually через дописывание артефактов (human всё равно использует P2 или P1-pivot для обновлений)
- Нет `/product:feedback` команды в v1
- Нет автоматического триггера на HYP invalidation

**Когда возвращаемся:** после появления D5 tooling (через Integrator).

---

### 3.5 P4: Cascade Consistency

**Статус:** continuous, интегрирован во все approve gates (DEC-P03).

**Детальный алгоритм:** см. [validation.md §6](validation.md#6-cascade-protocol).

**Краткая версия:**

1. **Trigger:** любое active артефакт изменяется (approve новой версии, change parameters, etc.)
2. **Identify dependents:** через bi-dir refs (V-11 gwarantuje consistency)
3. **BFS traversal:** в порядке priority (Critical → Strategic → Standard → Confirmation)
4. **Per-dependent re-validation:** applicable rules
5. **Collect changes:** status transitions, re-approve needed, requires_review flags
6. **Present bundle:** ассистент показывает summary
7. **Human approve:** bundle (все) или per-item
8. **Apply:** atomic (все или ничего; rollback при failure)

**Команда для ручного запуска:** `/product:cascade <artifact-id>` — явная проверка cascade без изменения артефакта.

---

### 3.6 P5: Periodic Review (partial)

**Два компонента:**

#### P5.A Cascade Consistency — покрыт P4 (continuous).

#### P5.B Actuality Refresh — **не проектируется в v1** (DEC-P03, OQ-10).

**Почему:** нет триггера определён (scheduled vs event-based vs manual), нет workflow.

**Что делается вместо:**
- Manual review через `/product:status` (показывает stale drafts, old MR/CA per refresh_by, testing HYP без activity)
- `/product:validate --deep` — полная inline-валидация + V-12 stale detection + flags для старых research

**Когда возвращаемся:** 3-6 месяцев реального использования, когда накопится данные о том, что именно стареет и с какой частотой.

---

## 4. Cascade Consistency (integration notes)

Интегрирован в каждый approve gate. Реализация — в validation.md §6.

**Что важно знать в процессах:**

### 4.1 Триггеры cascade

| Изменение | Cascade scope |
|---|---|
| PS изменён | ALL artifacts (pivot scenario) |
| MR/CA изменён | SEG, VP, HYP, possibly MVP |
| SEG изменён | VP (1:1), FM с этим SEG, HYP, RPM |
| VP изменён | FM ссылающиеся, HYP проверяющие |
| HYP изменён | FM проверяющие, MVP primary_hypothesis |
| MVP изменён | RM, RL, FM priorities |
| FM изменён | SC, BR, LC, VC, IC, MK (все embedded), handoff (→ stale) |
| SC изменён | BR (bi-dir), LC (transitions), VC (coverage), MK (screens) |
| BR изменён | SC (bi-dir), LC (guards), IC (support), VC (rules verified), **P-RULE-02 DA review** |
| LC изменён | SC (transitions), VC (transitions), IC (entity) |
| IC изменён | BR (support), LC (respect), **P-RULE-01 DA review** |
| MK изменён | DS (tokens extraction), NM (screens), handoff (→ stale) |
| DS изменён | ALL MK using токен |
| BG изменён | ALL artifacts using term (mass-rename flow) |

**v1.1+ implementation note (DEC-DEV-0023):** `cascade-check.js` использует **forward-driven** map per saved artifact type — iterates только forward refs в saved frontmatter, не all candidate files. См. SPEC.md §6.7.1 для полной топологии. Reverse-driven cases (BR change → LC.rules contains BR → re-validate transition) deferred к v1.2; manual `/product:cascade --pending --revalidate` re-runs detection.

### 4.2 Bundle approve UX

Пример из validation.md §6.3:

```
BR-010 changed (parameter linking_strategy)
  ↓
Cascade analysis (5 dependents):
  - SC-005, SC-005a, SC-005e1 (re-validate) → OK
  - LC-002 (guard references) → OK
  - IC-003 (supporting rule) → requires P-RULE-01 DA review
  - FM-003 (contains this BR) → status requires_review

Report:
  ✓ 4 dependents re-validated
  ⚠ 1 P-RULE-01 DA review needed: IC-003
  ⚠ 1 status update: FM-003 → requires_review

Approve bundle? [Y]es all | [P]er-item | [N]o (rollback BR change)
```

---

## 5. BG Extraction Algorithm (OQ-01 / C-07)

**Закрывает OQ-01.** Continuous extraction (DEC-P06).

### 5.1 Phases

#### Phase 1: Candidate Extraction (auto, при save артефакта)

**Hook:** `bg-extractor.js` на PostToolUse при Write/Edit в `.product/**/*.md`.

**Что сканирует:**

1. **Body markdown:**
   - Bold terms: `**term**` или `__term__`
   - Multi-word Capitalized phrases (heuristic: ≥2 consecutive capitalized words)
   - Frontmatter-referenced names (entity:, roles: values)

2. **Фильтрация:**
   - Stoplist общих слов (RU + EN): `мы, они, будет, должен, we, should, will, have, ...`
   - Технические термины (список): `database, API, endpoint, component, function, ...` — НЕ в BG
   - Слова уже в BG: добавить usage ref, не считать новым
   - Длина ≥3 символа, не только цифры

**Результат:** список кандидатов с source (артефакт + позиция).

#### Phase 2: Classification

Для каждого кандидата определяется категория:

- **new-term** — нет в BG, нет похожего
- **existing-term** — уже в BG → добавить ref в `used_in`
- **possible-synonym** — похож на existing (Levenshtein < 3 или shared root) → suggest merge
- **abandoned-candidate** — уже предлагался и был отклонён → пропустить

#### Phase 3: Assistant Presentation (batched)

Ассистент **НЕ** прерывает текущий workflow моментально. Накапливает кандидатов и presents при удобном моменте:
- После approve текущего артефакта (пока human в контексте)
- При `/product:status` (добавляет секцию «BG pending»)
- При начале следующей сессии (`/product:feature ...` с warning о pending BG)

**Пример presentation:**

```
BG pending review (from last 3 saves):

NEW TERM candidates (3):
  1. "Revision" (from SC-005 body)
     Suggested definition: "Правка от клиента на часть переведённого документа
     с указанием позиции и желаемого изменения."
     Used in: SC-005, SC-006, BR-010
     → Add to BG? [Y/edit/reject]

  2. "Revision batch" (from BR-012)
     Suggested definition: "Группа revision'ов, приходящих в одно временное
     окно (≤2ч) от одного клиента для одного проекта."
     Used in: BR-012, SC-007
     → Add to BG? [Y/edit/reject]

  3. "Batch window" (from BR-012 parameters)
     Suggested definition: "Временное окно 2 часов для группировки revision."
     → This may be a synonym of "Revision batch" parameter. 
       Merge as BG entry or keep separate? [M/keep]

USAGE UPDATES (auto-applied):
  - "Project" now referenced by SC-005, SC-006, SC-007 (added automatically)
  - "Client" referenced by SC-005 (added)

SYNONYM WARNING (1):
  - "Правка" (used in old SC-001) vs "Revision" (used in SC-005, SC-006)
    These appear to describe the same concept.
    → Consolidate to "Revision" (preferred)? This will update SC-001. [Y/N]
```

#### Phase 4: Human Approval

Per-term actions:
- **[Y]** — принять определение как есть → BG entry created (status=active)
- **[edit]** — открыть definition в редактировании
- **[reject]** — не domain term, добавить в local ignore list
- **[M] merge** — объединить с existing entry; usage_refs переходят к target
- **[keep]** — оставить раздельно (игнорировать suggestion)

### 5.2 BG Entry Structure (напоминание)

```markdown
### Revision
- **Определение:** Правка от клиента на часть переведённого документа
  с указанием позиции и желаемого изменения.
- **Альтернативные термины:** ❌ edit, comment, feedback (НЕ используем)
- **Используется в:** SC-005, SC-006, SC-007, BR-010, BR-011, BR-012, 
  LC-002, FM-003
- **Связанные термины:** Revision batch, Revision status, Revision author
- **Добавлен:** 2026-05-10 (из SC-005 draft)
- **Status:** active
```

### 5.3 Mass-Rename Workflow

Когда BG term нужно переименовать (например, решили, что «Revision» → «Edit»):

**Команда:** `/product:bg-rename "Revision" "Edit"`

**Алгоритм:**

1. **Identify affected artifacts** через `used_in` field в BG entry
2. **Generate patch preview:**
   - Для каждого affected артефакта — diff (replace all instances of bold `**Revision**` with `**Edit**`)
   - Показывает counts: «Will update: SC-005 (3 occurrences), SC-006 (2), BR-010 (5), LC-002 (7), FM-003 (4)»
3. **Human approves:**
   - Bundle approve (все сразу)
   - Per-artifact approve (с возможностью skip)
4. **Apply atomically:**
   - Все артефакты обновляются
   - BG entry переименовывается (old name → alt_term; new name → primary)
   - BG version++
   - Создаётся single git commit «BG rename: Revision → Edit»
5. **Cascade check:** после rename запускается cascade (V-11 bi-dir, V-08 terminology, etc.)

### 5.4 BG Versioning

- **BG version** инкрементируется при:
  - Mass-rename (любой)
  - Множественных deprecations (> 5 терминов в одной операции)
- **Per-term history** — через git (каждое изменение BG entry = commit)
- **Deprecated terms:** остаются в BG с status=deprecated + alternative link; удаляются только после полного отсутствия usage в active артефактах

### 5.5 Orphan Term Detection

Периодически (и через `/product:cleanup --dry-run`):
- Термины с пустым `used_in` — orphans
- Предложение: deprecate or delete
- Интегрирует V-15

---

## 6. Product DA Review (F.9)

### 6.1 Роль

**Adversarial review** бизнес-артефактов — противовес confirmation bias ассистента и человека. Использует существующий `.claude/agents/devils-advocate.md` с business-prompts (DEC-I05).

### 6.2 Когда запускается (adaptive-depth, every change)

**Обязательно (P-RULE-01, P-RULE-02 — adaptive-depth):**

> **Refactored (DEC-DEV-0012, 2026-04-20):** ранее применялась magnitude-gated модель с `da-debt.yaml` mechanism (skip+batch для cosmetic changes). Опыт pilot и обсуждение C.1/C.2 показали: классификация magnitude стоит почти столько же, сколько сама проверка, а накопленный долг проверяется пост-фактум вместо момента принятия решения. Заменено на **adaptive-depth DA на каждое изменение**: один subagent invocation, который сам выбирает глубину анализа в зависимости от характера диффа. См. DEC-DEV-0012 в DEV_JOURNAL.

DA триггерится **на каждое** изменение active BR / IC, но subagent **сам адаптирует depth**:

**Шаг 1 (внутри subagent run, ~30 сек reasoning):**
- Subagent анализирует git diff против HEAD
- Классифицирует change как `cosmetic` или `significant`
- Записывает rationale классификации в output

**Шаг 2 (depth depends on Шаг 1):**

**Cosmetic** (~5 мин output):
- Quick consistency check: «не сломал ли change существующие refs / supporting rules / lifecycle guards»
- Один блок findings, без 6 линз
- Triggers cosmetic: typo fixes, переформулировка без semantic change, reference list additions/removals (`rules[]`, `scenarios[]`, `lifecycles[]`), frontmatter metadata updates (created/updated/version)

**Significant** (~20-30 мин output):
- Full 6-lens DA review per `agents/product/devils-advocate.md` template
- Triggers significant:
  - **IC:** creation, severity change to/from `critical`, statement semantic change, entity change
  - **BR:** creation, parameter type change (enum→number, cardinality), category change, statement rewrite

**Output формат:**
```yaml
magnitude: cosmetic | significant
classification_rationale: "Statement section unchanged; only parameter value tune from first_match to best_match"
findings:
  # full 6-lens block для significant; single consistency block для cosmetic
```

**Преимущества vs прежней magnitude-gated модели:**
- Никогда не пропускаем real changes (no skip → no debt накапливается)
- Cost для cosmetic minimal (короткий context, короткий output)
- Решения принимаются **в момент** изменения, не batched пост-фактум
- Single subagent invocation (no double LLM call для classify + analyze)

**Рекомендуется (optional):**
- Перед generation handoff для complex фич (много SC, несколько 🔴 BR, UI-heavy)
- При transition MVP → achieved (валидация что MVP действительно достиг цели)
- При HYP invalidation (проверка reasoning перед pivot)

**Ручной запуск:** `/product:da-review FM-<NNN>` (feature scope) или `/product:da-review RL-<NNN>` (release scope per DEC-DEV-0026 — cross-FM consistency, HYP coverage, rollout dependencies). Иначе — `--with-da-review` флаг для `/product:handoff` (one-shot review-then-ship; DEC-DEV-0026 hybrid trigger). ID-prefix routing per DEC-DEV-0030 Ambiguity 18 — BR/IC/SC/LC/VC/RPM/MK prefixes refused (purposely routed через hooks или approve gates).

### 6.3 6 линз DA

| Линза | Примеры вопросов |
|---|---|
| **Scalability** | Что если нагрузка вырастет 100x? Как выживет при 10k фрилансерах? |
| **Reliability / failure modes** | Что если email-сервер недоступен 30 мин? DB рухнула? |
| **Edge cases** | Empty inputs? Unicode? Concurrent edits? Huge files? |
| **Security** | Injection vectors? Authorization leaks? PII exposure? |
| **Alternatives** | Рассматривали ли X? Проще ли Y? |
| **User assumptions** | Действительно ли фрилансеры готовы платить? Или это assumption? |

### 6.4 Output формат

DA генерирует findings в 3 tiers:

```markdown
## DA Findings: FM-003 Revisions inbox

### 🔴 CRITICAL (2)
1. **Scalability:** BR-012 batch window 2h hard-coded. При 5k revisions/день 
   batch size станет огромным, UI сломается. Parameterize + add batch_size limit?
2. **Security:** SC-005 принимает email body as-is. XSS / malicious attachments?

### 🟡 IMPORTANT (4)
3. **Edge case:** Что если sender email forwards с non-matching адресом? 
   BR-010 сейчас просто reject — user frustration.
4. **Failure mode:** Email delivery latency может быть >2h (batch window). 
   Revisions от same client могут попасть в разные batches случайно.
... (more)

### 🔵 DISCUSSION (3)
7. **Alternative:** Рассматривали ли webhooks вместо email? Быстрее, но требует 
   API от клиента.
... (more)
```

### 6.5 Reception workflow

Human reviews findings:
- **Act on:** modify related artifact, запись «addressed DA finding X by Y»
- **Defer:** flag как known limitation, добавить в FM § Out of Scope или в Roadmap
- **Dismiss:** явное обоснование в decision journal «dismissed DA finding X because Z»

**Важно:** DA findings не блокируют автоматически. Human решает per finding. Но **dismissed** всегда фиксируется в journal с rationale (anti-sycophancy механизм — нельзя просто проигнорировать, всегда обоснование).

**Candidate LESSON-* (event-driven, opt-in, DEC-DEV-0062):** если **dismissed**/deferred finding позже оказался реальной ошибкой — это сигнал для `/product:lesson`. Это один из event-driven входов LESSON (наряду с validation-fail / cascade), снижающий зависимость от in-the-moment self-awareness. NB: LESSON имеет **два непересекающихся триггера** — (1) any-time self-correction mandate (ортогонален §2.5.1 post-approve automation — это **не** step ~9 approve-цепочки) и (2) escalation-кандидаты здесь / на validation-fail / cascade. LESSON — **не** отложенный P3 feedback loop (см. §3.4): фикс применяется атомарно сейчас, а не маршрутизируется обратно в D1.

### 6.6 Builder/Critic separation

**Принцип (из Чата 4):** DA работает в **отдельной сессии**, не в основном диалоге создания артефакта. Это исключает влияние ассистента, который только что придумал этот артефакт. Subagent с isolated context.

---

## 7. Lifecycle Transitions (unified view)

Summary всех status transitions всех типов:

### 7.1 Default (большинство артефактов)

```
draft ──(approve + validations pass)──▶ active ──(explicit deprecate)──▶ deprecated
   ▲                                       │
   └──(rework request)─────────────────────┘
```

Применимо к: PS (с special `pivoted`), MR, CA, SEG, VP, BG, SC, BR, LC, RPM, VC, IC, MK, DS, NM, RL.

### 7.2 HYP (специальный)

```
draft ──(G5)──▶ testing ─┬──▶ validated
                         ├──▶ invalidated
                         └──(deferred zone)──▶ deferred (continue testing)
```

Transitions управляются через `/product:hyp <HYP-id> --status <new-status>` с mandatory supporting data.

### 7.3 FM (workflow)

```
planned ──(P2 enrichment)──▶ in-progress ──(implementation shipped)──▶ shipped
   │                                │
   └──(cancelled before work)──▶ deprecated
```

### 7.4 RL

```
planned ──(work starts)──▶ in-progress ──(all MUST shipped)──▶ released
   │                            │
   └──(scope cancelled)──▶ cancelled
```

### 7.5 MVP

```
draft ──▶ active ──(primary HYP validated)──▶ achieved
            │
            └──(HYP invalidated)──▶ evolved (pivot or next MVP)
```

### 7.6 MK

```
draft ──(iteration 1 approved)──▶ review ──(final approved)──▶ active
   │                                 │
   │                                 └──(more iterations)──▶ review
   │
   └──(feature cancelled)──▶ deprecated
```

---

## 8. Command Orchestration

Mapping команды → процессы → артефакты:

| Команда | Процесс | Результат |
|---|---|---|
| `/product:init` | P1.A Discovery (Quick) | PS, MR, CA, SEG, VP, HYP — все в active |
| `/product:init --deep` | P1.A Discovery (Deep) | То же с Deep research |
| `/product:init --continue` | P1.A resume | Продолжение с последнего gate |
| `/product:init --pivot` | (future, Q-11) | Cascade pivot PS + re-derive downstream |
| `/product:plan` | P1.B Planning | MVP, RM, RL-001, FM skeletons |
| `/product:feature <FM-id>` | P2.A Enrichment | SC, BR, LC, VC, IC, MK (if has_ui), RPM update |
| `/product:feature "description"` | P2.B Creation | D1-alignment → FM skeleton → enrichment |
| `/product:handoff <FM-id>` | (из handoff-spec) | handoff.md в `.product/handoffs/` |
| `/product:validate` | On-demand validation (validation.md) | Validation report |
| `/product:validate --deep` | Full validation + V-12 stale + refresh_by check | Comprehensive report |
| `/product:status` | Dashboard | Счётчики по статусам, stale drafts, pending BG, pending DA |
| `/product:cleanup [--dry-run]` | V-15 orphan detection (default) | List orphans + per-orphan recommendation |
| `/product:cleanup --pending-hygiene` (alias `--full`) | V-15 + 3 pending files sweep | Orphans + cascade revalidate + validation purge + da-pending stale flag |
| `/product:da-review FM-<NNN>` | F.9 Product DA (feature scope) | DA findings file (.product/.da-findings/FM-NNN-<timestamp>.md) |
| `/product:da-review RL-<NNN>` | Release-level Product DA (DEC-DEV-0026) | Cross-FM findings + drill-down hints (.product/.da-findings/RL-NNN-<timestamp>.md) |
| `/product:cascade <artifact-id>` | P4 manual cascade | Cascade report |
| `/product:bg-review` | Manual BG extraction review | Pending BG terms batch |
| `/product:bg-rename <old> <new>` | BG mass-rename | Bundle of artifact updates |
| `/product:drift-check` | Structural self-audit (C1) | Direction alignment report (🟢/🟡/🔴) |
| `/product:validation-tune` | AI proposes project-local validation tuning; systemic defects escalate via /ecosystem:meta-feedback (C3) | Validation overrides / config tweaks с rationale в journal |
| `/product:patterns` | Meta-linter on `.product/` (C4) | Recurring anti-patterns report |
| `/product:promote-note <NOTE-id> to <TYPE>` | Convert NOTE-* to structured artifact (D3) | New artifact draft |
| `/product:lesson "<...>"` | Atomic self-correction find→fix→record (DEC-DEV-0062) | Fixed error + active LESSON-* (ready to use) |
| `/product:lesson --resume <LESSON-id>` | Finish an open lesson → active | LESSON-* open→active |
| `/product:lesson --withdraw <LESSON-id> "<reason>"` | Genuine false alarm (no fix landed) | LESSON-* deprecated + NOTE-* rationale |
| `/product:handoff <FM-id> --mode draft` | Relaxed-DoR handoff (D1) | handoff.md `status: partial` с warnings |
| `/product:handoff <FM-id> --mode production` | Full-DoR handoff (default, D1) | handoff.md `status: ready` |
| `/design:start <FM-id>` | P2.5 Design Module | MK, DS update, NM |
| `/design:iterate <MK-id>` | P2.5 D.3 iteration | Updated MK |
| `/design:export <FM-id>` | P2.5 D.6 | UI-contract embedded в handoff |

---

## 9. Interaction Patterns (examples)

### 9.1 Типичный Discovery Session

```
> /product:init "Инструмент для фрилансеров-переводчиков"

[Assistant]
Discovery Session started. Mode: [Q]uick | [D]eep | [C]onfig? 
> Q

[Assistant]
D1.1 Problem Discovery. Let me ask a few questions...

Q1: Кто основной страдающий? (фрилансеры, клиенты, агентства, все?)
Q2: В чём главная боль — коммуникация, организация, оплата, качество?
Q3: Сколько клиентов ведёт типичный переводчик параллельно?
...

> [human answers 5-8 questions]

[Assistant]
Draft Problem Statement ready:
[shows draft PS]

Iteration 1 — what to adjust?
> [feedback]

[Assistant]
Updated draft PS:
[shows v2]

Iteration 2 — ok?
> approve

[Assistant]
✓ G1 passed. PS → active (version 1).
✓ BG extraction: 3 terms candidates pending.
✓ Cascade: N/A (PS is root).

Continuing to D1.2 Market Research (Quick mode, ~15 min)...
[runs parallel research]

Draft Market Research ready (sources: 7, coverage: TAM/SAM/SOM, trends, barriers):
[shows draft MR]

...
```

### 9.2 Feature Definition с cascade

```
> /product:feature FM-003

[Assistant]
Loading FM-003 Revisions inbox context...
- SEG-001 (freelancers), JTBD-1 (revisions collection)
- HYP-001 (conversion), Priority MUST
- has_ui=true → P2.5 Design Module in parallel

Let's start with Scenario Authoring.

F.2.1: Main flow — receiving revision via email?
[proposes draft SC-005 with 6 steps]

> [human edits step 4, adds alt flow]

[Assistant]
Updated. Adding alt flow SC-005a (multiple project match).

Approve SC-005 (main)?
> Y

[Assistant]
✓ SC-005 → active.
✓ BG extraction: terms "Revision", "Client email", "Project" added pending.
✓ Cascade: FM-003 scenarios[] updated (bi-dir).

Extracting Business Rules from SC-005 steps...
[identifies BR-010, BR-012 candidates]

... (continues through F.2-F.10)

[Later, after BR-010 approved]

[Assistant]
BR-010 active. Running cascade check:
  - SC-005: bi-dir updated ✓
  - LC-002: guards reference OK (derived after BR approve) ✓
  - IC-003: P-RULE-01 DA review required before IC active
  - FM-003: scenarios[] & rules[] updated ✓

Pending: IC-003 DA review (triggered by BR-010 change).
Continue to F.5 IC identification? [Y/N]
```

### 9.3 Mass-rename BG

```
> /product:bg-rename "Revision" "Edit"

[Assistant]
BG mass-rename preview:
  Target BG entry: "Revision" → "Edit"
  
  Affected artifacts (used_in):
    - SC-005 (3 occurrences)
    - SC-006 (2)
    - BR-010 (5)
    - BR-011 (1)
    - LC-002 (7)
    - FM-003 (4)
  
  Total: 22 replacements across 6 files.
  
  Alt terms (won't change): "edit", "comment", "feedback" (still in reject list)

Approve rename? [Y]es bundle | [P]er-artifact | [N]o cancel
> Y

[Assistant]
✓ BG: "Revision" renamed to "Edit" (version 4)
✓ 6 artifacts updated in single commit
✓ Cascade: V-11 bi-dir refs consistent, V-08 terminology consistent
✓ 2 pending handoffs (FM-003) marked stale due to BG changes
  Suggested: /product:handoff FM-003 --regenerate

Commit: "BG rename: Revision → Edit (22 refs updated across 6 artifacts)"
```

---

## 10. Validation Integration

Процессы активно используют правила из [validation.md](validation.md):

| Process step | Validation rules invoked |
|---|---|
| Inline save (any artifact) | V-01, V-02 (if SC), V-03, V-04, V-11 |
| Approve gate (SC) | V-01, V-02, V-03, V-04, V-11, V-H-05 check pending |
| Approve gate (BR) | V-03, V-14a, P-RULE-02 (DA review triggered) |
| Approve gate (IC) | V-11, P-RULE-01 (DA review triggered) |
| Approve gate (LC) | V-05, V-06 |
| Approve gate (VC) | V-07 (coverage check) |
| Approve gate (MK, has_ui) | V-MK-01..V-MK-08 |
| Approve gate (BG entry) | V-08 (terminology usage), V-11 refs |
| Approve gate (LESSON open→active) | V-LE-01..05 (frontmatter + applied-fix + reusable-guard invariants) |
| /product:handoff | DoR (V-H-01..V-H-11) + embedded V-01..V-15 |
| Cascade at any change | V-11 auto-fix + all applicable per dependent type |
| /product:cleanup | V-15 orphan detection (default); `--pending-hygiene` adds 3 pending files sweep |
| /product:validate --deep | Все V-*, V-H-*, V-MK-*, V-12 stale, refresh_by check |

---

## 11. NFR Integration (OQ-03 закрыт)

### 11.1 Статус

NFR-* как артефакт введён в итерации 8 (см. [NFR.md](artifacts/NFR.md)). Интегрирован во все точки:

- **В каталоге** — 21-й тип артефактов (было 20)
- **В processes** — F.5a step (NFR identification) между F.5 (IC) и F.6 (VC)
- **В validation** — V-16 восстановлен с tier-aware severity (🟡 MVP / 🔴 MMP+)
- **В handoff-spec §11** — embedded NFR-* excerpts (больше не placeholder)

### 11.2 Философия (ключевое)

NFR на solo-уровне — **очертания достаточности, не enterprise SLA**. Ассистент:
- Предлагает realistic defaults per tier (sanity-check ranges в NFR.md §5)
- Warning при enterprise-copypasta
- Требует measurement method и anti-target
- Триггерит Product DA при override sanity ranges

### 11.3 Tier upgrades

При переходе продукта MVP → MMP (или далее):
- Все active NFR batch review
- Ассистент предлагает новые target'ы согласно таблицам NFR.md §5
- Human approves per NFR или bundle
- version++ per NFR

Команда: `/product:nfr-upgrade-tier mvp mmp` (в будущей реализации).

---

## 12. Session Recovery

Что если сессия прерывается?

- **Hook `product-session-state.js`** сохраняет progress в `.product/.sessions/<timestamp>.yaml`:
  - Current process (P1.A / P1.B / P2.A / P2.5)
  - Current step (D1.2 / F.3 / D.3)
  - Last approved artifact
  - Pending artifacts (drafts в памяти)
- `/product:init --continue` или `/product:feature --continue` — восстанавливает session

**Session ≠ conversation.** Session — это progress в процессе, сохраняется между чатами.

---

## 13. Open Questions

Оставшиеся (не блокируют имплементацию):

**OQ-P1: Как именно пилот `/product:init --pivot` работает?** — для Q-11 (pivot protocol). Сейчас out-of-scope.

**OQ-P2: Retry policy на MCP failures во время research?**
- Если Firecrawl отвалился в D1.2 Deep mode — fallback на Brave? Pause для human?
- Предложение: 3 retries с exponential backoff; после — ask human.

**OQ-P3: Parallel vs sequential в F.2-F.7?**
- Сейчас F.2 (SC) → F.3 (BR) → F.4 (LC) последовательно
- Возможна параллельность: `F.2 + F.8 Design` параллельно (уже так в процессах)
- Но F.3 (BR из SC) — обязательно последовательно после F.2
- Деталь — в skill.

**OQ-P4: Conflict между ассистентом и human в iterations?**
- Если human повторяет «make it shorter», «no add more detail» в цикле — ассистент признаёт deadlock?
- Предложение: после 5 iterations — флаг «Let me suggest a different approach entirely?»

---

## 14. Implementation Notes

### 14.1 Skills структура

Каждый процесс имеет свой skill в `product-module/skills/`:

- `discovery-session.md` — P1.A methodology
- `planning-session.md` — P1.B
- `feature-enrichment.md` — P2.A
- `feature-creation.md` — P2.B (с D1-alignment)
- `bg-extraction.md` — Phase 1-5 algorithm
- `cascade-protocol.md` — детальный BFS обход (интегрирован из validation §6)
- `product-da-review.md` — F.9 workflow, 6 lenses, findings format
- `mass-rename.md` — BG workflow

### 14.2 Hooks

- `bg-extractor.js` — PostToolUse на `.product/**/*.md` save
- `product-artifact-validate.js` — inline validation (tier-aware per `validation_tier` config)
- `product-session-state.js` — session progress snapshot
- `ic-change-trigger.js` — P-RULE-01 enforcement (adaptive-depth single subagent invocation, см. §6.2; refactored DEC-DEV-0012)
- `br-change-trigger.js` — P-RULE-02 enforcement (adaptive-depth, см. §6.2; refactored DEC-DEV-0012)
- `cascade-check.js` — на approve
- `lesson-gate.js` — **Stop** event; LESSON-* non-deferrability gate (PRONG A). The **first blocking hook** (DEC-DEV-0062 departure from «Hook never blocks», scoped to corrective lessons). Default strict (`exit 2`) blocks clean session close while any LESSON is `status: open` or write-truncated; `LESSON_GATE_MODE=warn` downgrades.
- `lesson-presence-gate.js` — **PreToolUse** + **UserPromptSubmit** backstop (PRONG B). Ships **warn** (re-surfaces open lessons each turn; PreToolUse nag); `LESSON_GATE_MODE=strict` enables `permissionDecision:deny` on mutating calls with `lesson-in-progress` marker-exemption (pending S-LE live smoke).

**B2: Quiet draft hooks behavior.** Все hooks при artifact `status: draft` работают в **quiet mode**:
- Validation/extraction результаты НЕ surfacing inline (не прерывают flow)
- Findings queued в `.product/.pending/{validation,bg-candidates,cascade}.yaml`
- Surfacing происходит на: (a) draft → active transition; (b) `/product:status`; (c) `/product:validate`

Цель: не отвлекать на промежуточные состояния, фиксировать всё при approve.

### 14.3 Drift mitigation mechanisms (C1, C2, C3, C4)

Помимо BG/cascade/bi-dir refs, экосистема имеет **активные** механизмы против дрифта при долгих сессиях:

- **C1 `/product:drift-check`** — on-demand или auto перед `/product:handoff`. Skill `drift-detector.md` читает PS + active HYP primary + MVP scope + последние 10 изменённых артефактов, выдаёт direction alignment report.
- **C2 `confidence:` field в frontmatter** — все 24 типа артефактов имеют `confidence: high | medium | low` + `confidence_notes`. ИИ обязан articulate уверенность при approve. Tied with A1 auto-approve и validation-tune usage stats.
- **C3 `/product:validation-tune`** — ИИ может инициировать project-local tuning proposals (override rule, refine threshold); systemic-дефекты эскалируются через `/ecosystem:meta-feedback`. Skill `validation-tune.md`. Approval — human, запись в `.claude/integrator/decision-journal.md`.
- **C4 `/product:patterns`** — meta-linter on demand. Skill `pattern-linter.md`. Анализ `.product/` на повторяющиеся anti-patterns:
  - Hard-coded values across multiple BR (suggest extract to shared)
  - Missing actors в SC steps
  - Asymmetric FM dependencies
  - Inconsistent BR categories для similar rules
  - Stale draft accumulation
  - Over-parameterization (BR с 8+ parameters — split candidate)

### 14.3 Subagents

- `screen-generator` (для P2.5 D.2)
- `market-researcher` (для P1.A D1.2 Deep)
- `competitor-analyst` (для P1.A D1.3 Deep)
- `product-devils-advocate` (для F.9) — использует `.claude/agents/devils-advocate.md` с business prompts

---

## 15. Статус реализации

Методология консолидирована и **зашиплена** (Discovery / Planning / Feature / Handoff — рабочие):

- [x] `/product:init` (P1.A Discovery)
- [x] `/product:plan` (P1.B Planning)
- [x] `/product:feature` (P2.A/B)
- [x] `/product:handoff`
- [x] Skill `bg-extraction.md` + hook `bg-extractor.js`
- [x] F.5a NFR step (OQ-03 закрыт)
- [ ] P3 Feedback Integration — отложено (активируется при появлении D5 tools)

Живой статус реализации — [ROADMAP «Где мы сейчас»](../../ROADMAP.md#где-мы-сейчас).

---

**Конец processes.md.**

Статус: **методология консолидирована и зашиплена** — Discovery / Planning / Feature / Handoff рабочие (P3 Feedback отложено). Закрывает OQ-01 (BG extraction algorithm). Живой статус — [ROADMAP «Где мы сейчас»](../../ROADMAP.md#где-мы-сейчас).
