# Design Module — Спецификация

> **Статус:** v1.0 (2026-04-18)
> **Роль:** условный sub-module Product Module — отвечает за D2-B04 (UX/UI Design) только когда FM.has_ui=true. Итеративный процесс создания UI-макетов через AI + внешний design tool.
> **Закрывает:** DEC-A10, DEC-A12, DEC-I03 (Stitch primary), DEC-ART09 (MK как Design Package), DEC-ART10 (DS, NM), DEC-P11, DEC-P12, DEC-I06 (subagent screen-generator).
> **v1 modifications:**
> - C2 (`confidence:` field) — все MK, DS, NM имеют confidence + confidence_notes (см. pmo/artifacts/README.md cross-cutting).
> - A1 (auto-approve 🟢) — NM (как 🟢 Confirmation) auto-approves при confidence: high + V-MK passed.
> - B1 (validation_tier) — V-MK-* активируются per tier; в `pilot` режиме только V-MK-08 (token coverage) inline.
> - B2 (quiet draft hooks) — `design-artifact-validate.js` queues findings при `status: draft`.
> - D2 (`approve_overrides`) — MK может временно overrideить V-MK блокеры (например, для PoC экранов).

## 1. Philosophy & Role

### 1.1 Что Design Module делает

- **Превращает бизнес-поведение в визуальные артефакты** для UI-фич (FM с has_ui=true)
- **Ведёт итеративный дизайн** через диалог AI ↔ Human с внешним design tool (Stitch default, Figma future, HTML fallback)
- **Производит 3 типа артефактов D2-B04:** MK (Mockup Package), DS (Design System — cross-cutting), NM (Navigation Map — per flow)
- **Интегрирует AI-ассистируемое проектирование** как нормальную часть Product Module workflow

### 1.2 Что Design Module НЕ делает

- Не проектирует без контекста: работает только с готовыми SC, BR, LC, BG, RPM
- Не производит production UI-код (это зона внешних реализаторов через handoff)
- Не занимается бизнес-логикой (это Product Module P2)
- Не запускается сам по себе: активируется только Product Module при has_ui=true
- Не управляет design assets в design tool (Stitch/Figma — свой assets management)

### 1.3 Условная активация

```
Product Module P2 Feature Definition
    │
    F.1 Load FM context
    F.2 Scenario Authoring
    F.3 Business Rule Extraction
    F.4 Entity Lifecycle Derivation
    F.5 Invariant Check Identification
    F.5a NFR Review (opt-in)
    F.6 Verification Criteria Derivation
    F.7 RPM Update
    │
    F.8 Design Module activation — IF FM.has_ui == true
    │   │
    │   └──▶ /design:start <FM-id>
    │        │
    │        D.1 Design Brief Generation (🟡 Review)
    │        D.2 Screen Generation (🟠 Strategic, first iteration)
    │        D.3 Iterative Refinement (🟠 Strategic, final)
    │        D.4 Component State Matrix (🟢 Confirmation)
    │        D.5 Artifact Generation (🟠 Strategic)
    │        D.6 Export for handoff
    │        │
    │        └──▶ возврат в Product Module P2 на F.10
    │
    F.9 Product DA Review (optional)
    F.10 FM status transition → in-progress
```

Если FM.has_ui=false — Design Module **не запускается**, P2 идёт прямо F.7 → F.9 → F.10.

### 1.4 Двухканальный вывод (DEC-A12)

Design Module — **единственный модуль Ecosystem 3.0** с двойным выводом:

1. **Внешний design tool** (Stitch / Figma / Penpot / HTML):
   - Визуальные макеты
   - Живёт в зоне инструмента (Stitch project URL, Figma file, etc.)
   - Редактируется через tool's UI

2. **Файловая система `.product/`**:
   - Структурированные метаданные (MK Design Package, DS, NM)
   - Ссылки на внешний tool (tool_project_url в MK frontmatter)
   - Человекочитаемая + machine-readable спецификация

Оба канала синхронизированы через sync protocols (см. §10.3).

---

## 2. Архитектура

### 2.1 Примитивы Claude Code

| Примитив | Роль | Локация |
|---|---|---|
| **Slash-commands** | 5 команд (`/design:*`) | `.claude/commands/design/` |
| **Skills** | 5 methodology files | `.claude/skills/design/` |
| **Subagent** | 1 — screen-generator | `.claude/agents/design/screen-generator.md` |
| **Hook** | 1 — design-artifact-validate | `.claude/hooks/design-artifact-validate.js` |
| **MCP** | Stitch primary, Figma future, Playwright optional | via Integrator |

### 2.2 Слоевая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│ Слой 4: UX — Slash commands (/design:*)                     │
│   start, iterate, system, export, status                    │
├─────────────────────────────────────────────────────────────┤
│ Слой 3: Process (P2.5 из pmo/processes.md §3.3)             │
│   D.1-D.6, 3 approve gate types                             │
├─────────────────────────────────────────────────────────────┤
│ Слой 2: Skills (methodology)                                │
│   design-session, component-states, design-system-rules,    │
│   stitch-workflow, design-validation                        │
├─────────────────────────────────────────────────────────────┤
│ Слой 1: Artifacts (3 типа из pmo/artifacts/)                │
│   MK (Design Package), DS (Design System), NM (Navigation)  │
├─────────────────────────────────────────────────────────────┤
│ Слой 0: Automation                                          │
│   design-artifact-validate hook                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 State ownership

**Design Module владеет:**

| Директория / файл | Назначение | Git |
|---|---|---|
| `.product/mockups/MK-*.md` | Design Packages per screen/flow | ✓ tracked |
| `.product/mockups/NM-*.md` | Navigation Maps per flow | ✓ tracked |
| `.product/design-system.md` | Cross-cutting Design System | ✓ tracked |
| `.product/.design-sessions/` | Design iteration state | ✗ gitignored |
| `.claude/design.yaml` | Per-project design tool config | ✓ tracked |

**Design Module НЕ владеет:**

- Остальные артефакты в `.product/` (это Product Module)
- Сам внешний design tool (Stitch project и т.д. — external)

### 2.4 Отношения с другими модулями

```
Product Module P2 F.8 triggers
    │
    ▼
┌───────────────────────────────────┐
│ Design Module (P2.5)              │
│                                   │
│  /design:start <FM-id>            │
│   │                               │
│   ├─▶ читает SC/BR/LC/BG/RPM     │
│   │   из .product/ (read-only)    │
│   │                               │
│   ├─▶ Stitch MCP (или fallback)   │
│   │   для генерации визуала       │
│   │                               │
│   └─▶ пишет MK/DS/NM в .product/  │
│                                   │
│  /design:export <FM-id>           │
│   └─▶ MK/DS/NM готовы для handoff │
└───────────────────────────────────┘
    │
    ▼
Возврат в Product Module P2 (F.10)
    │
    ▼
/product:handoff может использовать MK/DS/NM embed
(handoff-spec §6 UI Specification section)
```

---

## 3. Commands Catalog

5 slash-команд в namespace `/design:*`.

### 3.1 `/design:start <FM-id>`

- **Процесс:** P2.5 D.1-D.5 полный workflow
- **Триггер:** автоматически из Product Module F.8 при has_ui=true, или manually
- **Входы:** FM-id с has_ui=true + связанные SC, BR, LC, BG, RPM в active
- **Выходы:** MK-*, DS обновлён, NM-* в active
- **Состав:**
  - D.1 Design Brief Generation
  - D.2 Screen Generation (first iteration)
  - D.3 Iterative Refinement (может быть много циклов)
  - D.4 Component State Matrix validation
  - D.5 Artifact Generation (MK/DS/NM finalized)

### 3.2 `/design:iterate <MK-id>`

- **Процесс:** D.3 continuation
- **Входы:** MK-id в status=review (или active для patch changes)
- **Выходы:** updated MK, iteration counter ++
- **Use case:** когда human хочет исправить существующий активный MK без полного rerun

### 3.3 `/design:system [--review | --update-from <MK-id>]`

- **Процесс:** DS management
- **Опции:**
  - `--review` — ручной просмотр pending token/component predложений
  - `--update-from <MK-id>` — принудительное обновление DS из конкретного MK
- **Выходы:** обновлённая `.product/design-system.md`
- **Use case:** DS drift, mass-rename tokens, cleanup

### 3.4 `/design:export <FM-id>`

- **Процесс:** D.6
- **Входы:** FM со всеми MK, NM в active + DS snapshot
- **Выходы:** UI-contract block, готовый для embed в `/product:handoff` (через handoff-spec §10)
- **Когда используется:** перед `/product:handoff` (automatically invoked) или manual валидация

### 3.5 `/design:status [--fm <FM-id>]`

- **Процесс:** status dashboard для дизайна
- **Выходы:** counts per MK × status, iteration progress, DS pending items, design tool connectivity

### 3.6 Отношения с `/product:*`

- Design Module **не вызывает** `/product:*` команды из body
- Product Module **не вызывает** `/design:*` напрямую в F-шагах, кроме **F.8 triggers `/design:start`**
- `.product/` файлы — общее пространство для обмена данными

---

## 4. Skills Library

5 skills, lazy-loaded per задаче:

### 4.1 `design-session.md` (core)

- Orchestrates D.1-D.6 последовательно
- Управляет approve gates (🟡/🟠/🟢)
- Координирует iteration flow D.3
- Trigger-ит screen-generator subagent для D.2 / крупных D.3 правок
- Session state recovery (аналогично Product Module)

### 4.2 `component-states.md`

- Checklist для D.4 Component State Matrix
- Покрытие states: default, hover, focus, error, disabled, loading, empty, overflow, skeleton
- Validation V-MK-02 (BR constraints в states)
- Interactive: ассистент предлагает недостающие states, human confirms

### 4.3 `design-system-rules.md`

- Алгоритм DS extraction из MK (при D.5)
- Detection новых tokens / components / patterns
- Synonym detection (похожие tokens — merge?)
- Mass-rename workflow (аналог BG mass-rename)
- Deprecation tracking

### 4.4 `stitch-workflow.md`

- Tool-specific: как общаться со Stitch MCP
- Prompt engineering для Stitch (эффективная генерация экранов)
- Handling rate limits (350 generations/month Free tier)
- Fallback на HTML artifact при limit exhausted / MCP unavailable
- Project URL management

### 4.5 `design-validation.md`

- V-MK-01..V-MK-08 (из pmo/validation.md)
- Runs при D.5 finalization + `/design:export`
- Integrates с design-artifact-validate hook
- Reporting формат

### 4.6 Future skills (если нужно)

- `figma-workflow.md` (когда Figma MCP интегрируем)
- `penpot-workflow.md` (open-source alternative)
- `html-fallback.md` (когда все MCP недоступны — HTML/React artifact generation)

---

## 5. Subagents

### 5.1 `screen-generator` (единственный subagent)

- **Контекст:** Design Brief + SC steps + BR constraints + LC states + DS snapshot + RPM
- **Инструменты:** Stitch MCP (primary), Figma MCP (future), WebFetch (HTML fallback), Sequential Thinking
- **Триггер:** D.2 (first iteration for multiple screens), D.3 крупные правки (2+ экрана одновременно), D.5 при missing states
- **Вход:** структурированный prompt с:
  - Фиче-контекст (FM title + description)
  - Список экранов для генерации (Screen Inventory draft)
  - DS tokens snapshot
  - Accessibility requirements
- **Выход:** JSON с:
  - Сгенерированные экраны (Stitch URLs или HTML)
  - Новые component предложения для DS
  - Новые tokens предложения для DS
  - Issues найденные при генерации
- **Почему isolated:** генерация множества экранов может потреблять много контекста; subagent работает в fresh context
- **Fallback behavior:** если Stitch unavailable → HTML/React artifact generation через Claude Code primitives

---

## 6. Hooks

### 6.1 `design-artifact-validate.js` (PostToolUse)

- **Триггер:** Write/Edit на `.product/mockups/**/*.md` или `.product/design-system.md`
- **Действия:**
  - Validate YAML frontmatter (required fields)
  - Check references на SC, BR, LC (существуют, в active)
  - V-MK-08 check (tokens в DS)
  - Screen Inventory vs SC steps coverage heuristic (V-MK-01 partial)
- **Выход:** stderr warnings для problems
- **Performance:** <100ms
- **Does NOT block** — предупреждения для human action

---

## 7. Process P2.5 — Detailed Flow

### 7.1 D.1 Design Brief Generation (🟡 Review)

**Цель:** создать design brief — внутренний документ (не артефакт), который будет использоваться для screen generation.

**Содержит:**
- Feature context (from FM)
- Screens list (из SC steps with UI interactions)
- Roles + permissions (из RPM excerpt)
- Business rules applicable to UI (constraints, validation messages)
- Lifecycle states with UI representation (disabled, hidden, badge states)
- Brand hints (если есть DS, показать direction)

**Approve gate 🟡 Review:**
- Human может **корректировать** brief перед отправкой в screen-generator
- Редактируемый документ, не финальный артефакт
- Цель: catch misunderstandings early, до дорогой генерации экранов

**Output storage:** `.product/.design-sessions/<FM-id>-brief.md` (gitignored, временный)

### 7.2 D.2 Screen Generation — First Iteration (🟠 Strategic)

**Цель:** первая visualised итерация экранов для просмотра human.

**Шаги:**
1. Spawn screen-generator subagent с brief + DS + SC
2. Subagent генерирует N экранов в Stitch (или HTML fallback)
3. Возвращает JSON с URLs + предложенными DS additions
4. Main session: human смотрит в Stitch/HTML, даёт feedback

**Approve gate 🟠 Strategic (per first iteration):**
- Human проверяет: «направление правильное?»
- Options:
  - Approve → переход к D.3 iterative refinement для мелких правок
  - Request regeneration → D.2 снова с уточнённым brief
  - Fundamental rethink → вернуться в D.1 или даже в Product Module (SC нуждаются в правках)

### 7.3 D.3 Iterative Refinement (🟠 Strategic at final)

**Цель:** циклические правки до human approval финальной версии.

**Loop:**
```
Human describes change (text / screenshot annotation)
    │
    ▼
Assistant classifies:
  - Small change (layout, color, spacing) → single Stitch MCP call
  - Medium change (rework one screen) → spawn screen-generator для этого screen
  - Large change (2+ screens rework) → spawn screen-generator с batch request
  - Fundamental (design parasdigm change) → full D.2 rerun
    │
    ▼
Apply change → show human
    │
    ▼
Human feedback → repeat OR approve final
```

**Iteration counter** в MK.frontmatter инкрементируется per significant iteration.

**Deadlock protection:** после 7 iterations ассистент флагит: «Крутимся долго. Предлагаю либо pause для fresh look, либо radical rethink (новый brief).»

**Approve gate 🟠 Strategic** — только на final version, не на каждую iteration.

### 7.4 D.4 Component State Matrix (🟢 Confirmation)

**Цель:** полноценное покрытие states всех interactive компонентов.

**Skill `component-states.md` проходит checklist:**

Для каждого interactive component в screens:
- default ✓
- hover (if applicable) ✓ или N/A
- focus (keyboard) ✓
- error (если BR validation применима) ✓ или N/A
- disabled (если LC state определяет unavailability) ✓ или N/A
- loading (если async) ✓ или N/A
- empty state (для lists/collections) ✓ или N/A
- overflow (длинный текст / max items) ✓
- skeleton (при slow network) ✓ или N/A

**Ассистент дорисовывает missing states:**
- Single Stitch call per missing state
- Показывает human

**Approve gate 🟢 Confirmation:**
- Human просто подтверждает корректность derivation
- Не блокирует если некоторые states помечены N/A with rationale

### 7.5 D.5 Artifact Generation (🟠 Strategic — final per feature)

**Цель:** создать финальные структурированные артефакты MK / DS / NM.

**Порядок:**

1. **MK generation:** запись Design Package (7 секций из MK.md template) per screen group
2. **DS extraction:** автоматическое извлечение tokens/components из MK
   - Существующие DS entries — добавить usage reference
   - Новые — propose к human (в формате аналогичном BG extraction)
3. **NM generation:** derive из MK screens + LC guards
4. **Cross-validation:**
   - V-MK-01..V-MK-08
   - V-H-08 preview (handoff будет работать)

**Approve gate 🟠 Strategic:**
- Human approves финальный MK в active
- DS pending items — separate approve через `/design:system --review`
- NM derived — 🟢 Confirmation (автоматически)

### 7.6 D.6 Export for handoff

**Цель:** подготовить UI-contract для embed в handoff.

**Шаги:**
1. Assemble MK full content per feature
2. Assemble DS snapshot (только tokens/components используемые в MK)
3. Assemble NM full content
4. Output в блок, готовый для handoff §10 UI Specification

**Не создаёт отдельный файл** — данные потребляются `/product:handoff`. Но `/design:export` можно вызывать manually для проверки что UI-contract cobh сформируется корректно.

---

## 8. Configuration

### 8.1 Global config (`~/.claude/design-config.yaml`)

```yaml
version: 1
default_design_tool: stitch               # stitch | figma | html
default_platform: responsive              # web | mobile | responsive | desktop
default_accessibility_standard: wcag-aa   # wcag-a | wcag-aa | wcag-aaa
default_language: ru                       # для UI labels в MK

mcp_preferences:
  primary: stitch
  fallback_chain:
    - html-artifact
    - figma                                # если подключён
    - penpot                                # если подключён
```

### 8.2 Per-project config (`.claude/design.yaml`)

```yaml
version: 1
project_name: translateit

design_tool: stitch
design_tool_project_url: "https://stitch.withgoogle.com/projects/translateit"

brand_hints:
  colors:
    primary: "blue-family"
    accent: "green"
  style: "clean, minimal, professional"
  tone: "approachable, not corporate"
  references:
    - "linear.app"       # similar clean aesthetic
    - "notion.so"        # similar density

accessibility_override:
  standard: wcag-aa       # inherited
  additional:
    - "rtl-support: required" # проект multilingual

platform_overrides:
  FM-003: mobile-first    # специфический override для фичи
```

### 8.3 MK defaults

Если не указано в MK frontmatter — берутся из project config → global config. Явное указание в MK всегда приоритетнее.

---

## 9. MCP Stack

### 9.1 Primary

**Stitch MCP** (Google Stitch)
- Генерация экранов по prompt
- DESIGN.md file support для брендинга
- Free tier: 350 generations/month
- Используется: D.2 (first iteration), D.3 (small-medium changes), D.4 (missing states)

### 9.2 Future

**Figma MCP plugin**
- Для handoff to developers с существующим Figma workflow
- Перспектива, не в v1
- Используется: альтернатива Stitch для teams предпочитающих Figma

**Penpot MCP** (self-hosted)
- Open-source alternative
- Для случаев self-hosted requirement

### 9.3 Fallback — HTML/React artifact

- Когда Stitch unavailable (rate limit / no internet / skipping MCP)
- Claude Code генерирует HTML/React code напрямую
- Quality lower, но процесс не блокируется
- Особо полезно во время разработки Ecosystem 3.0 (pilot без реального Stitch)

### 9.4 Optional support

**Playwright MCP** (через Integrator если подключён)
- Для automated screenshot comparison (version diffs)
- Для accessibility audit automated
- Не критично, но полезно для D.4 и V-MK-05 (contrast check auto)

**Sequential Thinking**
- Для design brief analysis (D.1)
- Для component state matrix reasoning (D.4)
- Для DS merge decisions

### 9.5 Rejected

- **Database / API MCPs** — не design zone
- **GitHub MCP** — не нужен Design Module (нужен Product Module для CA, но не design)

### 9.6 Graceful degradation

Если Stitch недоступен:
1. Warn human «Stitch unavailable, switching to HTML fallback»
2. Используем Claude Code HTML/React generation
3. В MK frontmatter — `design_tool: html-fallback`, tool_project_url: null
4. При восстановлении Stitch — manual migration через `/design:migrate <MK-id> stitch`

---

## 10. Integration

### 10.1 С Product Module

**Activation trigger:** Product Module P2 F.8 автоматически вызывает `/design:start <FM-id>` когда FM.has_ui=true.

**Read-only inputs** (Product Module → Design Module):
- FM (feature context)
- SC (scenarios + UI steps)
- BR (constraints для validation states)
- LC (states для component disabled/enabled)
- BG (terminology для labels, copy)
- RPM (role-based visibility)

**Writes** (Design Module → `.product/`):
- `.product/mockups/MK-*.md`
- `.product/mockups/NM-*.md`
- `.product/design-system.md`

**Return to Product Module:** после D.6, Product Module продолжает P2 с F.9 (DA) → F.10 (FM transitions).

### 10.2 С Handoff (через handoff-spec.md §10)

**UI Specification section** (handoff-spec Section 10) embed'ит:
- Full MK content (все MK фичи)
- DS tokens snapshot (только relevant subset)
- NM full content

**Генерируется автоматически** в `/product:handoff` если FM.has_ui=true.

### 10.3 Sync Protocols (via /eco:sync pairs)

Новые sync-пары (от Integrator при MK/DS/NM изменениях):

| Пара | Источник | Целевое | Проверка |
|---|---|---|---|
| MK ↔ SC steps | MK Screen Inventory | SC steps with UI verbs | V-MK-01 |
| MK ↔ DS | MK Component State Matrix tokens | DS entries | V-MK-08 |
| NM ↔ MK | NM Flow Diagram nodes | MK Screen Inventory IDs | consistency |
| MK ↔ design.md (external tool) | `.product/mockups/` | cc-sdd design.md UI section | при handoff + adapter |

### 10.4 С Integrator

**Design Module регистрируется** как integrable tool в каталоге Integrator — аналогично Product Module:

```yaml
# ~/.claude/integrator/tool-catalog/design-module.yaml
tool: design-module
version: 1.0
category: core-pmo-module
depends_on: [product-module]
pmo_coverage:
  D2-B04: {confidence: high, evidence: "full P2.5 process"}
activation: conditional (FM.has_ui=true)
inputs:
  - from: product-module
    type: behavioral-artifacts (SC, BR, LC, BG, RPM)
outputs:
  - type: design-package (MK, DS, NM)
    location: .product/mockups/, .product/design-system.md
external_mcp_required:
  - stitch | figma | penpot | html-fallback
```

Integrator при add — настраивает Stitch MCP config, генерирует adapter если target implementation tool (cc-sdd) ожидает design.md в специфическом формате.

### 10.5 С будущим Orchestrator

Orchestrator читает MK/DS/NM при маршрутизации:
- «Эта фича has_ui=true → routing включает шаг design verification»
- «Change в MK → trigger sync с cc-sdd design.md»

Не в v1 scope.

---

## 11. Session Management & Recovery

### 11.1 Session state

`.product/.design-sessions/current.yaml`:

```yaml
session_id: "20260615-1600-design-FM003"
type: design-session
fm_id: FM-003
started_at: 2026-06-15T16:00:00Z
current_step: D.3
current_iteration: 3
design_tool: stitch
tool_project_url: "https://stitch.withgoogle.com/..."

progress:
  completed_steps:
    - D.1: "Brief approved"
    - D.2: "First iteration approved (4 screens)"
  current_step: D.3 Iterative Refinement (iteration 3)
  next_step: D.4 Component State Matrix

iterations_log:
  - iter: 1, changes: "initial generation", tool_calls: 1 subagent
  - iter: 2, changes: "adjust spacing, add empty state", tool_calls: 2 Stitch calls
  - iter: 3, changes: "rework CTA button placement", tool_calls: 1 Stitch call

pending_feedback: "Waiting for human to review Stitch links"

stitch_usage:
  month_count: 47                   # tracking rate limit
  month_limit: 350
```

### 11.2 Recovery

`/design:start <FM-id> --continue` — восстанавливает из session state.

### 11.3 Session termination

- **Complete:** D.6 успешен, MK/DS/NM в active → session → archived
- **Abandon:** human «отложим» → current marked abandoned
- **Pivot back:** требуется изменить SC или BR — return в Product Module, design session paused

---

## 12. Error Handling

### 12.1 Stitch rate limit exhausted

- Detect: Stitch MCP возвращает rate_limit error
- Action: пользователю показывается warning + options:
  - Wait (до следующего месяца)
  - Switch to HTML fallback (для завершения текущей session)
  - Upgrade Stitch plan
- Session продолжается без падения

### 12.2 Stitch unavailable (network, MCP)

- Detect: MCP call timeout
- Action: автоматическое переключение на HTML fallback + warning
- `.product/design.yaml` temporarily overrides design_tool = html-fallback

### 12.3 Invalid input — SC без UI steps

- Detect: `/design:start` на FM.has_ui=true, но все SC — чистая навигация без UI verbs
- Action: warning «FM-XXX marked has_ui=true, но в SC нет явных UI взаимодействий. Reconsider has_ui?»
- Опции: abort design session / edit SC / proceed with minimal UI

### 12.4 DS drift during session

- Detect: DS обновляется внешне во время активной design session (другим MK)
- Action: notify + rebase — session подбирает свежую DS version
- Session state сохраняет snapshot DS version на начало

---

## 13. Open Questions

**OQ-DM-01: Stitch prompt engineering patterns**
- Какие prompt patterns эффективны для получения качественных экранов?
- Требует экспериментации; лучшие паттерны закрепляются в `stitch-workflow.md`

**OQ-DM-02: Tool switching mid-project**
- Что если проект начат на Stitch, а потом команда перешла на Figma?
- Migration scripts? `/design:migrate`?
- В v1 — manual workflow, в v2 — автоматизация

**OQ-DM-03: Multi-language UI**
- RTL, многоязычные labels, локализация strings
- Как это представлено в MK? В Component State Matrix? Отдельный раздел?
- Предложение: расширить Responsive Notes на «Localization Notes» при необходимости

**OQ-DM-04: Animation / motion**
- Сейчас Interaction Spec описывает transitions текстом
- Формализовать как separate Motion spec section? Или inline в Interaction Spec?
- Пока текстом в Interaction Spec достаточно для MVP

**OQ-DM-05: Component reuse across projects**
- DS живёт per project; но общий «library of patterns» между продуктами?
- Возможное решение: `~/.claude/memory/design/patterns.md`
- Не v1; когда будет 2+ проект — решим

**OQ-DM-06: Design reviews от другого человека**
- Solo-контекст сейчас; но дизайн часто полезно review другим (UX-дизайнер, user test)
- Как структурировать external review feedback в MK Design Decisions Log?
- Пока — manual append, процесс не формализуем

---

## 14. Checklist для активации

### 14.1 Prerequisites

- [ ] `/ecosystem:bootstrap` выполнен (Product + Integrator core установлены, Design Module доступен как conditional sub-module)
- [ ] Stitch account зарегистрирован, API доступ получен
- [ ] Stitch MCP установлен через `/integrator:add stitch-mcp`
- `.claude/design.yaml` — генерируется автоматически при активации Design Module (первое `/design:start` с has_ui=true), не отдельный prereq

### 14.2 First UI feature end-to-end

- [ ] `.claude/commands/design/start.md`, `iterate.md`, `system.md`, `export.md`, `status.md`
- [ ] Skills: design-session, component-states, design-system-rules, stitch-workflow, design-validation
- [ ] Subagent: `screen-generator.md`
- [ ] Hook: `design-artifact-validate.js`
- [ ] Stitch MCP работает (smoke test: generation одного экрана)
- [ ] Artifacts MK, DS, NM — создаются end-to-end
- [ ] Handoff §10 UI Specification заполняется корректно
- [ ] Acceptance: одна pilot UI-фича (например, TranslateIT Revisions inbox) проходит P2.5 от /design:start до MK в active

### 14.3 HTML Fallback

- [ ] Skill `html-fallback.md` (resilience путь)
- [ ] Acceptance: отключить Stitch MCP временно, выполнить design session с HTML fallback

### 14.4 Integration with Handoff

- [ ] `/product:handoff` корректно embed'ит MK/DS/NM
- [ ] Handoff §10 readable внешним tool (cc-sdd design.md generation)
- [ ] Acceptance: end-to-end idea → handoff с UI → cc-sdd → design.md без manual правок

---

## 15. Следующие шаги

- [ ] Утвердить SPEC (или внести корректировки)
- [ ] Подготовить Stitch MCP интеграцию (через Integrator research → add)
- [ ] Kick-off имплементации при первой UI-фиче в pilot
- [ ] Параллельно: HTML fallback как backup путь для dogfooding
- [ ] После первого pilot: оценить prompt engineering patterns для Stitch, обновить skill

---

**Конец спецификации Design Module.**

**Статус ядра 3.0 после этой итерации:**

- ✅ Artifacts catalog (21 тип)
- ✅ Handoff spec (universal, tool-agnostic)
- ✅ Validation (33 rules + 2 process rules)
- ✅ Processes (P1-P5 + P2.5 с полной детализацией через Design Module SPEC)
- ✅ Integrator Module SPEC
- ✅ Product Module SPEC
- ✅ **Design Module SPEC (этот документ)**
- 🔜 Orchestrator Module концепт (после MVP Integrator)

**Ядро Ecosystem 3.0 полностью задокументировано.** Готово к имплементации.
