# Design Module — Спецификация

> ⚠ **SPEC-ahead-of-code дрейф (G36), не устранён — промаркирован:** субагент `screen-generator`
> (DEC-I06, §5.1) описан в теле SPEC, но файл агента `agents/design/screen-generator.md` **НЕ
> существует** — режимы D.2/D.3/D.5, спавнящие его, нефункциональны до отдельного трека сборки (G36).
> (Обратный дрейф — «код впереди SPEC» для Epic-A персоны `ux-advisor` — **устранён**: персона вписана
> в §2.1/§5.2/§6, DEC-DEV-0187; фактический файл — `agents/design/ux-advisor.md`.)

> **Статус:** v1.1 (2026-05-27) — pre-Phase-6 architectural addendum (Claude Design + IR groundwork; DEC-DEV-0048). Базовая v1.0 — 2026-04-18.
> **Роль:** условный sub-module Product Module — отвечает за D2-B04 (UX/UI Design) только когда FM.has_ui=true. Итеративный процесс создания UI-макетов через AI + внешний design tool.
> **Закрывает:** DEC-A10, DEC-A12, DEC-I03 (Stitch primary), DEC-ART09 (MK как Design Package), DEC-ART10 (DS, NM), DEC-P11, DEC-P12, DEC-I06 (subagent screen-generator).
> **v1.1 addendum (DEC-DEV-0048, 2026-05-27):** Claude Design добавлен как **co-primary** tool рядом со Stitch; tool-switching и migration-readiness формализованы (см. §16); OQ-DM-02 переоткрыт и частично закрыт (variant A path); OQ-DM-07 (IR neutral representation) добавлен как v2 candidate.
> **v1 modifications:**
> - C2 (`confidence:` field) — все MK, DS, NM имеют confidence + confidence_notes (см. pmo/artifacts/README.md cross-cutting).
> - A1 (auto-approve 🟢) — NM (как 🟢 Confirmation) auto-approves при confidence: high + V-MK passed.
> - B1 (validation_tier) — V-MK-* активируются per tier; в `pilot` режиме только V-MK-08 (token coverage) inline.
> - B2 (quiet draft hooks) — `design-artifact-validate.js` queues findings при `status: draft`.
> - D2 (`approve_overrides`) — MK может временно overrideить V-MK блокеры (например, для PoC экранов).
>
> **Related:** [docs/README.md](../README.md) (docs index) · [product-module/SPEC.md](../product-module/SPEC.md) (parent module — Design conditional sub-module) · [pmo/artifacts/MK.md](../pmo/artifacts/MK.md), [pmo/artifacts/DS.md](../pmo/artifacts/DS.md), [pmo/artifacts/NM.md](../pmo/artifacts/NM.md) (Design artifacts catalog) · [integrator-module/SPEC.md](../integrator-module/SPEC.md) (peer — tool install delegation)

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

1. **Внешний design tool** (Stitch / open-design / Claude Design / Figma / Penpot / HTML):
   - Визуальные макеты
   - Живёт в зоне инструмента (Stitch project URL, claude.ai/design project, Figma file, etc.)
   - Редактируется через tool's UI

2. **Файловая система `.product/`**:
   - Структурированные метаданные (MK Design Package, DS, NM)
   - Ссылки на внешний tool (`tool_project_url` в MK frontmatter)
   - Tool identity per MK (`design_tool` в frontmatter — enum, см. `docs/pmo/artifacts/MK.md`)
   - Migration trail (`previous_tools[]`, `tool_switched_at`, optional `ir_snapshot_path` — v2 hook, см. §16)
   - Человекочитаемая + machine-readable спецификация

Оба канала синхронизированы через sync protocols (см. §10.3).

**Принципиальное ограничение v1:** при смене tool (Stitch → Claude Design, etc.) визуальное представление в источнике **не мигрирует автоматически** — оно re-создаётся в новом tool (через regeneration по сохранённому MK metadata + brief). Это сознательный compromise; полноценная migration механика — v2 через IR-слой (см. §16).

---

## 2. Архитектура

### 2.1 Примитивы Claude Code

| Примитив | Роль | Локация |
|---|---|---|
| **Slash-commands** | 7 команд (`/design:*`, вкл. `/design:map` — DEC-DEV-0066) | `.claude/commands/design/` |
| **Skills** | 10 methodology files (`stitch-workflow`, `open-design-workflow`, `claude-design-workflow`, `open-design-viewer`, `app-map-generate`, ...) | `.claude/skills/design/` |
| **Subagent** | 1 profile-persona reviewer — `ux-advisor` (Epic A, построен, §5.2); `screen-generator` — запланирован, **НЕ построен** (G36, §5.1) | `.claude/agents/design/` |
| **Hook** | 2 — design-artifact-validate, app-map-cascade (+ helper-скрипты `app-map-{scan,flow,html,thumbs,viewer}.js`, не hook-события) | `.claude/hooks/design/` |
| **MCP / external tool** | Stitch (MCP), Claude Design (web — `claude.ai/design`, MCP TBD per Anthropic roadmap), Figma future, Playwright optional | via Integrator + manual workflow |

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

### 3.6 `/design:migrate <MK-id|--all> --to <target-tool>` (v1.1 — расширенный)

- **Процесс:** смена `design_tool` для одного MK или batch
- **Поддерживаемые переходы (v1):** Stitch ↔ HTML fallback ↔ Claude Design (любая пара)
- **v1.5 — `--to open-design` (VIEWER-IMPORT target, не regeneration):** импорт существующего визуального HTML MK в open-design Dockerized viewer через CNT-003 adapter (`POST /api/import/claude-design`). Отличается от regeneration-целей: **нет brief, нет генерации экранов, нет миграции метаданных, НЕ инкрементит `iteration`**. Канон остаётся в MK/NM; в migrate-контексте open-design — supporting viewer, не источник истины (generator-роль — ОТДЕЛЬНЫЙ путь: design-session D.2/D.3 dispatch + CNT-004-class adapter, см. §4.4c / DEC-DEV-0067 — не через /design:migrate). Wiring декларируется в `design.yaml.external_viewers.open-design`; один общий daemon на машину (см. `docs/integrator-module/SPEC.md §4.1.1` + `BOOTSTRAP.md`). Per-MK hard gate (Q1) фигачит, но с viewer-import framing. Исполнение — `skills/design/open-design-viewer.md` (Step 5-OD команды).
- **Шаги:**
  1. Snapshot текущего состояния — записать `previous_tools[]` entry в MK frontmatter + `tool_switched_at`
  2. (v2 hook) Если включён IR-режим — экспортировать IR snapshot в `.product/.design-sessions/ir/<MK-id>-<timestamp>.yaml` и записать `ir_snapshot_path` в MK
  3. В новом tool — regenerate визуал по brief + MK metadata + DS snapshot (через screen-generator subagent)
  4. Обновить `design_tool` + `tool_project_url` в MK frontmatter
  5. Старый `tool_project_url` сохраняется в `previous_tools[].url` (audit trail; visual в source-tool может стать orphan — это known limitation v1)
- **Approve gate 🟠 Strategic** — миграция считается significant iteration
- **Не покрывает в v1:** lossless cross-tool visual transfer (требует IR-слой, §16)

### 3.6b `/design:map [--write] [--html] [--facet module|case|role|path]` (DEC-DEV-0066 — App Map)

- **Процесс:** сборка/обновление **AM** (App Map, 24-й тип артефакта — L0 «приложение сверху»: модули × кейсы × пути + CJM-слой) поверх per-flow NM. Канонизирован из пилота my-first-test (reconciliation шаг 2).
- **Слои:** mechanical (FM/NM glob → `hooks/design/app-map-scan.js`, детерминированный) + editorial (`cross_module_edges`, `primary_journeys`, `cjm_stages` — frontmatter `.product/app-map.md`, правит человек). Тело = проекция между маркерами `<!-- AM:GEN:START/END -->`.
- **`--write`** — пересборка тела (editorial frontmatter сохраняется); **`--html`** — self-contained USER FLOW walker `.product/app-map.html` (PNG-тхумбнейлы + SVG-стрелки + проигрыватель; pipeline `app-map-{flow,html,thumbs,viewer}.js`); read-only по умолчанию.
- **Зумы:** L0 = AM → L1 = NM-* (drill-down) → L2 = MK-*/Open Design. AM **не дублирует** переходы экранов NM (anti-duplication firewall).
- **Cascade:** hook `app-map-cascade.js` (PostToolUse на FM/NM/SC) диффит механический слой против персистированного AM → `.product/.pending/app-map-pending.yaml` + сигнал `re-run /design:map --write`.
- **Validation:** V-AM-* (light, см. `validation.md §5.3b`); approve 🟢 Confirmation (авто при `confidence: high`, иначе human — editorial CJM обязателен).
- **Спека артефакта:** `docs/pmo/artifacts/AM.md`. Skill: `skills/design/app-map-generate.md`.

### 3.7 Отношения с `/product:*`

- Design Module **не вызывает** `/product:*` команды из body
- Product Module **не вызывает** `/design:*` напрямую в F-шагах, кроме **F.8 triggers `/design:start`**
- `.product/` файлы — общее пространство для обмена данными

---

## 4. Skills Library

6 skills, lazy-loaded per задаче:

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

### 4.4a `claude-design-workflow.md` (v1.1 — добавлено addendum)

- Tool-specific: как работать с Claude Design (`claude.ai/design`) — **web UI primary в v1, MCP TBD** (Anthropic анонсировала «coming weeks» integrations на момент 2026-05-27, см. DEC-DEV-0048 research)
- Prompt patterns: chat-driven generation, inline comments на UI elements, iterative refinement
- Project context attachment: screenshots, codebases (через UI upload), design files
- DS-inheritance: Claude Design auto-inherits org's design system — Ecosystem 3.0 DS экспортируется как brand-package для импорта (v1: manual export текстом; MCP/API — v1.2+)
- Export workflow: ZIP/HTML/PDF/PPTX → `.product/.design-sessions/<MK-id>-export/` для capture
- **Native «Handoff to Claude Code»** — *не* пересекается с `/product:handoff`:
  - Ecosystem `/product:handoff` = **product-level behavioral spec** (handoff.md universal, см. `docs/product-module/handoff-spec.md`)
  - Claude Design «Handoff to Claude Code» = **design-level visual bundle** (HTML + assets для frontend implementation)
  - Они **комплементарны**: Ecosystem handoff может содержать §10 ссылку на Claude Design handoff bundle
- Subscription tiers (Pro/Max/Team/Enterprise — default off для Enterprise) — handled gracefully при unavailable
- Known limitations (как baseline 2026-05-27): comment persistence issues, compact view save errors, large codebase lag — документировать workarounds

### 4.4b `open-design-viewer.md` (v1.5)

- Tool-specific: импорт визуального HTML MK в open-design viewer (`--to open-design` target команды `/design:migrate`)
- **Viewer-only — НЕ генератор:** запускает CNT-003 adapter `--import` (HTTP в общий Dockerized daemon `http://127.0.0.1:7456`, token-gated Bearer); нет brief, нет генерации, нет миграции метаданных, нет iteration bump
- Token precedence (`$OD_API_TOKEN` → `~/.claude/...` → `./.claude/...`); `127.0.0.1` не `localhost`
- Не мутирует MK — A8-последовательность команды владеет записями frontmatter; skill импортирует и возвращает result, при failure не трогает файлы
- Boundary: «visual-only, no metadata» — канон в MK/NM; модель «один daemon на машину»
- Setup daemon: `BOOTSTRAP.md` «open-design shared daemon»; инфра-паттерн: `docs/integrator-module/SPEC.md §4.1.1`

### 4.4c `open-design-workflow.md` (DEC-DEV-0067 — generator, CNT-004-class)

- Tool-specific **GENERATOR** для D.2/D.3 — отдельная роль от viewer (§4.4b): Claude авторит DS-token-bound
  `SI-*.html` и пишет их в per-FM OD-проект через **`od mcp` stdio** (адаптер `od-mcp-call.cjs` — держит
  stdin открытым до прихода всех ответов; REST agent-CLI пути (`od tools`/`od artifacts`) отвергают
  `OD_API_TOKEN` — анти-паттерн). Канонизирован из пилота my-first-test (DEC-INT-0012, reconciliation шаг 3).
- **Mode A — agent-authoring (активный путь):** Claude = авторящий агент; no external LLM key.
  **Mode B — `start_run` (deferred):** требует agent CLI внутри OD-контейнера; проверять `list_agents`.
- Канонические исходники экранов персистятся в git-tracked `.product/mockups/assets/<fmNNN>/SI-N.{html,png}`
  (OD-проекты живут в container volume — не versioned); live-preview через od-proxy `:7457` (tokenless raw).
- Канон остаётся в MK/NM (anti-pattern #5: OD project files ≠ canonical spec); DS-привязка обязательна
  (no hardcoded off-DS hex/spacing).
- Активация: `design-session.md` D.2/D.3 dispatch при `design_tool: open-design` (project-level default —
  `design.yaml.default_design_tool`; canon-default остаётся `stitch`).
- Сопутствующие канонические адаптеры: `adapters/od-mcp-call.cjs` (драйвер), `adapters/od-fidelity-check.js`
  (round-trip QA миграции), `adapters/od-consolidate.cjs` (maintenance: per-screen → per-FM консолидация).

### 4.5 `design-validation.md`

- V-MK-01..V-MK-08 (из pmo/validation.md)
- Runs при D.5 finalization + `/design:export`
- Integrates с design-artifact-validate hook
- Reporting формат

### 4.6 Future skills (если нужно)

- `figma-workflow.md` (когда Figma MCP интегрируем)
- `penpot-workflow.md` (open-source alternative)
- `html-fallback.md` (когда все MCP недоступны — HTML/React artifact generation)
- `ir-export.md` / `ir-import.md` (v2 — IR neutral representation, §16)

---

## 5. Subagents

Два: profile-persona ревьюер `ux-advisor` (§5.2 — построен, Epic A) и запланированный генератор
`screen-generator` (§5.1 — **НЕ построен**, G36).

### 5.1 `screen-generator` (запланирован, DEC-I06)

> **Статус: НЕ построен (G36).** Файл `agents/design/screen-generator.md` не существует; режимы
> D.2/D.3/D.5 и `/design:migrate`, которые «спавнят screen-generator», нефункциональны до отдельного
> трека сборки. Спецификация ниже — целевой контракт, не построенное поведение.

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

### 5.2 `ux-advisor` (profile-persona reviewer — Epic A, построен)

Файл: `agents/design/ux-advisor.md` (`model: opus`, tools read-only). Гетерогенный profile-ревьюер
bounded completeness-loop'а Product-модуля (см. [product-module/SPEC.md §2.4/§5.4](../product-module/SPEC.md)) —
живёт в namespace Design, потому что его приор — **UX / полнота flow / покрытие состояний UI** — кормит
D2-B04 (в частности D.4 Component State Matrix).

- **Когда срабатывает:** роутится Product-хуком `zone-change-trigger.js` на зоне `mockups`
  (`.product/mockups/*.md` — MK **и** NM), либо вручную, либо волной completeness-loop'а. Применяется
  **только к UI-несущему** scope (`has_ui`, SC с UI-шагами, MK/NM/DS, component states) — на не-UI scope
  возвращает clean.
- **Линзы (gaps-only):** usability / когнитивная нагрузка, flow-completeness (happy/alt/**error+empty**),
  покрытие состояний компонента (default/hover/focus/error/disabled/loading/empty/overflow — D.4 матрица),
  accessibility, content/copy, consistency с существующими MK/NM/DS. Удовлетворённая линза — `clean: true`,
  не «положительный finding» (урок DEC-DEV-0094).
- **Выход:** `.product/.advisor-findings/ux-<ARTIFACT-ID>.md` (keyed на персона+артефакт, ре-ран UPDATE'ит
  in place) + summary в вызвавшую сессию; **surface, don't solve** — называет недостающий flow/state/copy,
  не рисует экран и не пишет финальный copy.
- **Рельс каноничности:** спавнится как `subagent_type: "ux-advisor"` **всегда**; «not found» = лоуд-STOP,
  никогда не откат на `general-purpose` (DEC-DEV-0064). Isolated context (Builder/Critic separation).

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

> **Completeness-loop router (Product-хук, Epic A).** Зона `mockups` (`.product/mockups/*.md`) роутится
> Product-хуком `zone-change-trigger.js` на персону `ux-advisor` (§5.2) — сам хук живёт в Product-модуле
> (`hooks/product/`), здесь отмечен для полноты design-зоны. См. [product-module/SPEC.md §6.8](../product-module/SPEC.md).

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
version: 1.1
default_design_tool: stitch               # stitch | open-design | claude-design | figma | penpot | html
default_platform: responsive              # web | mobile | responsive | desktop
default_accessibility_standard: wcag-aa   # wcag-a | wcag-aa | wcag-aaa
default_language: ru                       # для UI labels в MK

# Migration-readiness (v1.1 — IR groundwork hook; full IR — v2)
ir_export:
  enabled: false                           # v1.1 default off; включается при v2 IR rollout
  schema_version: 0                        # 0 = stub; 1+ = active IR schema (v2)

mcp_preferences:
  primary: stitch                          # OR claude-design — co-primary в v1.1
  fallback_chain:
    - claude-design                        # web fallback при Stitch quota/unavailable
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

### 9.1 Co-primary tools (v1.1)

**Stitch MCP** (Google Stitch)
- Генерация экранов по prompt
- DESIGN.md file support для брендинга
- Free tier: 350 generations/month
- Integration model: **MCP** (via Integrator `/integrator:add stitch-mcp`)
- Используется: D.2 (first iteration), D.3 (small-medium changes), D.4 (missing states)

**Claude Design** (Anthropic Labs, `claude.ai/design`) — added v1.1 (DEC-DEV-0048, 2026-05-27)
- Conversational design tool, powered by Claude Opus 4.7
- Создаёт mockups, interactive prototypes, presentations, dashboards, mobile flows
- DS auto-inheritance из org's design system
- Export: ZIP / PDF / PPTX / Canva / standalone HTML / **native «Handoff to Claude Code»**
- Integration model в v1.1: **web UI + manual export workflow** (MCP API TBD per Anthropic «coming weeks» roadmap на момент 2026-05-27)
- Subscription gating: research preview на Pro / Max / Team / Enterprise (default off Enterprise — handled gracefully)
- Используется: альтернатива Stitch когда user в Claude ecosystem, ценит native Claude Code handoff, или Stitch quota exhausted
- Known limitations baseline (2026-05-27, могут устареть): comment persistence issues, compact view save errors, large codebase lag

### 9.2 Future

**Figma MCP plugin**
- Для handoff to developers с существующим Figma workflow
- Перспектива, не в v1
- Используется: альтернатива Stitch/Claude Design для teams предпочитающих Figma

**Penpot MCP** (self-hosted)
- Open-source alternative
- Для случаев self-hosted requirement

**Claude Design MCP / API** (когда Anthropic выпустит)
- Tracker: см. OQ-DM-02 (Tool switching) — pre-research при появлении public API
- Trigger to bring forward: announcement Anthropic + `/integrator:research claude-design --refresh`

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

Fallback chain — из `design.yaml` `mcp_preferences.fallback_chain`. Default: `stitch → claude-design → html-artifact → figma → penpot`.

Если primary недоступен:
1. Warn human «<primary-tool> unavailable, switching to <next-fallback>»
2. Выполнить switch:
   - Stitch → Claude Design: regenerate в Claude Design (manual workflow в v1; user копирует brief, ассистент инструктирует prompt patterns из `claude-design-workflow.md`)
   - Stitch / Claude Design → HTML: Claude Code HTML/React generation in-session
3. В MK frontmatter — записать `design_tool: <new>`, обновить `tool_project_url`, добавить entry в `previous_tools[]` (см. §16)
4. При восстановлении primary — `/design:migrate <MK-id> --to <primary-tool>` (см. §3.6)

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
  - stitch | open-design | claude-design | figma | penpot | html-fallback
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

**OQ-DM-02: Tool switching mid-project** — partially resolved v1.1 (DEC-DEV-0048, 2026-05-27)
- v1.1 decision: variant A path — `/design:migrate <MK-id> --to <target>` поддерживает Stitch ↔ Claude Design ↔ HTML (см. §3.6); migration trail записан в MK frontmatter (`previous_tools[]`, `tool_switched_at`); regeneration в target tool через brief + MK metadata; **lossy** (визуал re-created, не transferred)
- Резидуальная часть → OQ-DM-07 (IR layer для lossless cross-tool transfer, v2)
- Figma migration — by-product OQ-DM-02 closure: когда Figma MCP интегрируем, migration работает по той же схеме

**OQ-DM-07: Intermediate Representation (IR) для lossless cross-tool migration** — added v1.1, deferred v2
- Нужен ли формальный IR-слой (neutral declarative представление screen — components / layout / tokens / interactions в YAML/JSON), чтобы migration между tools была lossless?
- v1.1 groundwork: frontmatter hook `ir_snapshot_path` в MK, `ir_export.enabled` flag в design.yaml — оба noop в v1.1
- v2 design questions:
  - Schema design: component vocabulary universal или tool-superset?
  - Export adapters per tool: Stitch → IR, Claude Design → IR, etc. (требует tool API access; Stitch MCP — partially, Claude Design — TBD)
  - Import adapters per tool: IR → Stitch prompt, IR → Claude Design prompt, etc.
  - Lossy fields handling: что делать с tool-specific features (Stitch animations, Claude Design interactive prototypes)?
- Bring-forward trigger: 2-й реальный проект на 2-х разных tools OR user request OR adapter ecosystem stabilizes

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
- [ ] Подготовить Claude Design integration profile (через `/integrator:research claude-design` на Phase 6 kickoff) — добавлено v1.1
- [ ] Kick-off имплементации при первой UI-фиче в pilot
- [ ] Параллельно: HTML fallback как backup путь для dogfooding
- [ ] После первого pilot: оценить prompt engineering patterns для Stitch + Claude Design, обновить skills

---

## 16. Migration-readiness & Intermediate Representation (IR) — v2 groundwork

> **Добавлено v1.1** (DEC-DEV-0048, 2026-05-27) — закладывает hooks для v2 IR-слоя без overhead в v1.

### 16.1 Принцип

Дизайн-инструменты эволюционируют быстро (Stitch, Claude Design — оба research-preview-уровня в 2026; Figma меняет API; новые AI-design tools появляются). **Project lifetime > tool lifetime** в этой зоне. Design Module должен пережить переход между tools без потери всей design work.

### 16.2 v1.1 — lossy migration (текущий уровень)

**Что есть:**
- `/design:migrate <MK-id> --to <target-tool>` (§3.6) — regeneration в target tool по сохранённому MK metadata + brief
- MK frontmatter migration trail — `previous_tools[]`, `tool_switched_at` (см. `docs/pmo/artifacts/MK.md`)
- Per-tool workflow skills (`stitch-workflow.md`, `claude-design-workflow.md`, ...) — каждый знает как regenerate из MK metadata

**Что теряется:**
- Точные визуальные tweaks (нelement-level adjustments — color shift, spacing fine-tune)
- Tool-specific features (Stitch animations, Claude Design interactive flows)
- Iteration history в source tool (только Design Decisions Log в MK сохраняется)

**Что сохраняется:**
- Screen Inventory (структура)
- Component State Matrix (поведение)
- Interaction Spec (взаимодействия — текстовое описание)
- DS tokens references
- Accessibility Notes
- Design Decisions Log (история решений — критично для re-generation)

### 16.3 v2 — lossless migration через IR

**Концепция:** neutral declarative представление экрана, которое читают/пишут все tool adapters.

**Кандидатная структура IR snapshot** (YAML, per MK или per screen):

```yaml
# .product/.design-sessions/ir/<MK-id>-<timestamp>.yaml
ir_schema_version: 1
mk_id: MK-003
captured_at: 2026-XX-XX
captured_from_tool: stitch  # OR claude-design / figma / ...
screens:
  - id: SI-1
    title: "Inbox (list)"
    type: screen
    layout:
      kind: grid | flex | absolute
      breakpoints: [...]
    components:
      - kind: card                          # universal vocabulary
        instance_id: RevisionCard
        states: [default, hover, focus, selected, read, archived]
        tokens: [card-bg, card-border-primary]
        text_slots: [sender, body, timestamp]
        interactions: [...]
      - kind: button
        instance_id: ApplyButton
        ...
    accessibility:
      tab_order: [...]
      contrast_min: 4.5
tokens_snapshot:
  - name: primary
    value: "#0066FF"
  ...
tool_specific:                              # lossy fields per source tool
  stitch:
    raw_prompt_history: [...]
    animations: [...]
  claude-design:
    chat_thread_id: "..."
    inline_comments: [...]
```

**Adapter contract (v2):**

| Tool | Export (tool → IR) | Import (IR → tool) | Status |
|---|---|---|---|
| Stitch | via MCP DOM read | prompt template | v2 design |
| Claude Design | via MCP / API (TBD) | chat prompt sequence | v2 design (blocked on Anthropic API) |
| HTML | direct parse | direct emit | v2 design |
| Figma | via Figma API | via Figma API | v2 design |
| Penpot | via Penpot API | via Penpot API | v2 design |

### 16.4 v1.1 hooks (active now, noop в behavior)

**1. MK frontmatter поля (см. `docs/pmo/artifacts/MK.md`):**
   - `previous_tools[]` — audit trail tool changes (active в v1.1)
   - `tool_switched_at` — timestamp (active в v1.1)
   - `ir_snapshot_path?: ".product/.design-sessions/ir/MK-003-2026-XX-XX.yaml"` — optional, populated только когда `ir_export.enabled: true`

**2. `design.yaml` flag (см. §8.1):**
   - `ir_export.enabled: false` — v1.1 default
   - `ir_export.schema_version: 0` — placeholder; 1+ = active в v2

**3. `/design:migrate` step 2 (§3.6):**
   - Условный IR export (если `ir_export.enabled`) — noop в v1.1, hook for v2 implementation

**4. Skill stubs `ir-export.md` / `ir-import.md`** (§4.6 Future) — не создаются в v1.1; помечены как v2 deliverables

### 16.5 Bring-forward triggers для v2 IR

IR-слой имеет нетривиальные costs (8-15ч design + 4-8ч per adapter). Заслуженно начинать когда:

- [ ] **Реальный pain point:** хотя бы 1 проект совершил >1 tool switch и пожаловался на regeneration cost
- [ ] **API maturity:** хотя бы 2 tools имеют stable read/write API (Stitch MCP — ок; Claude Design — TBD; Figma — ок)
- [ ] **Adapter ecosystem:** появилась 3rd-party конвенция (e.g., MDN-style universal component vocabulary)
- [ ] **User explicit request:** «нам нужна lossless migration»

До тех пор — v1.1 lossy regeneration через `/design:migrate` — sufficient.

### 16.6 Risk register для v2 (preliminary)

- **R1 — schema lock-in:** ранний IR schema может не cover'ить будущие tool primitives → versioning strategy + `tool_specific` escape hatch
- **R2 — adapter maintenance burden:** каждый tool adapter — отдельный maintenance commitment; not all tools — равные priorities. Mitigation: формализовать «tier 1 / tier 2 / community» adapter levels
- **R3 — universal component vocabulary impossible:** Stitch button ≠ Claude Design button ≠ Figma button по семантике. Mitigation: minimal common set (button / input / card / list / modal / nav) + `tool_specific` для остального
- **R4 — IR diverges from MK Body:** MK секции Component State Matrix частично дублируют IR structured form → consolidation question (один из двух — source of truth?). Decision: MK остаётся human-readable narrative, IR — machine-readable structured snapshot. Both kept; sync — на адаптерах.

---

**Конец спецификации Design Module.**

**Статус ядра 3.0 после этой итерации:**

- ✅ Artifacts catalog (24 типа, считая NOTE, LESSON и AM)
- ✅ Handoff spec (universal, tool-agnostic)
- ✅ Validation (44 rules + 2 process rules)
- ✅ Processes (P1-P5 + P2.5 с полной детализацией через Design Module SPEC)
- ✅ Integrator Module SPEC
- ✅ Product Module SPEC
- ✅ **Design Module SPEC v1.1 (этот документ; addendum 2026-05-27 — Claude Design + IR groundwork)**
- 🔜 Orchestrator Module концепт (после MVP Integrator)

**Ядро Ecosystem 3.0 полностью задокументировано.** Готово к имплементации (Phase 6 — conditional, активируется на первой FM с has_ui=true).
