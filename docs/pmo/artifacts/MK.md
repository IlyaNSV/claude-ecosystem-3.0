# MK-* — Mockup Package

> **Тип:** mockup-package
> **Домен:** D2-B04 — Design Module
> **Review:** 🟠 Strategic
> **Cardinality:** Per screen/flow (обычно 1–4 MK на UI-фичу)
> **Владелец:** Design Module внутри Product Module / процесс P2.5

## Purpose

**Полный дизайн-пакет** для экрана или связанной группы экранов одной фичи. **НЕ тонкая ссылка на Figma** (как было в ранних версиях) — структурированный документ с Screen Inventory, Component State Matrix, Interaction Spec, Accessibility, Edge Cases, Design Decisions. Внешний design-tool (Stitch/Figma/HTML) содержит визуальные макеты, MK-* содержит их метаданные + полную спецификацию UI-поведения.

## Frontmatter Schema

```yaml
---
id: MK-<NNN>
type: mockup-package
title: "Короткое имя экрана/flow"
feature: FM-<NNN>
scenarios: [SC-<NNN>, ...]                      # какие SC визуализирует
scenario_steps: {SC-<NNN>: [1, 2, 3]}            # какие шаги конкретно
roles: [R-<role>, ...]                           # какие роли видят UI
platform: web | mobile | responsive | desktop
design_tool: stitch | open-design | claude-design | figma | penpot | html   # v1.1: claude-design; DEC-DEV-0067: open-design (generator, CNT-004-class)
tool_project_url: "https://..."                  # ссылка на внешний макет (current tool)
status: draft | review | active | deprecated
iteration: 3                                      # счётчик итераций
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high

# v1.1 — Migration trail (DEC-DEV-0048, 2026-05-27; Design Module SPEC §16)
previous_tools: []                                # OR list of {tool, url, switched_at, reason}; см. ниже
tool_switched_at: null                            # ISO timestamp последнего switch; null если ни разу не мигрировал
ir_snapshot_path: null                            # optional, populated только если design.yaml ir_export.enabled=true (v2 hook)

created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

### Migration trail поля (v1.1)

**`previous_tools[]`** — audit trail смены `design_tool` для этого MK. Каждая запись:

```yaml
previous_tools:
  - tool: stitch
    url: "https://stitch.withgoogle.com/projects/revisions-inbox-v2"
    switched_at: 2026-06-20T14:30:00Z
    reason: "Stitch quota exhausted, switched to Claude Design for completion"
    iterations_at_switch: 3                       # сколько итераций было сделано в этом tool
```

Заполняется автоматически `/design:migrate <MK-id> --to <target-tool>` (см. SPEC §3.6). Никогда не редактируется вручную (нарушает audit).

**`tool_switched_at`** — timestamp последнего switch для quick lookup без парсинга `previous_tools[]`. Если `previous_tools` пуст → `null`.

**`ir_snapshot_path`** — путь к IR snapshot YAML (см. SPEC §16). v1.1 default `null`; v2 — populated при IR export.

### Anti-patterns в frontmatter

1. **Editing `previous_tools[]` manually.** Audit trail — read-only после записи `/design:migrate`. Корректировка через NEW migrate-entry с `reason: "correction of <previous-entry-date>"`.
2. **Удаление `previous_tools[]` при tool switch.** Старые записи всегда сохраняются. История нужна для understanding decisions (см. Design Decisions Log аналогично).
3. **`design_tool` ≠ current entry в `previous_tools[]`.** Хук `design-artifact-validate.js` проверяет: `design_tool` должен быть AKTUЛЬНЫЙ tool; predecessor — в `previous_tools[]`.
4. **Использование любых не-canonical полей в frontmatter** (`design_history`, `migration_notes`, `prev_tool`) — все эти variants forbidden, используй ровно `previous_tools[]` + `tool_switched_at`.

## Body Structure

Обязательные секции (7 штук):

1. **Screen Inventory.** Таблица всех экранов/состояний в пакете. Каждый экран: ID, название, тип (screen/modal/toast), привязка к SC-шагу, краткое описание.
2. **Component State Matrix.** Для каждого интерактивного компонента: таблица состояний (default, hover, focus, error, disabled, loading, empty, overflow, skeleton). Визуальное описание + поведение + ссылки на BR/LC.
3. **Interaction Spec.** Триггеры → результаты → анимации (submit, validation, field focus, success redirect, error display, etc.).
4. **Responsive Notes.** Breakpoints и изменения layout (только если platform=responsive/mobile).
5. **Accessibility Notes.** Tab order, aria-labels, contrast ratio (≥4.5:1), touch targets (≥44x44px), screen reader support.
6. **Edge Cases.** Длинные тексты, пустые списки, overflow, slow network, session expired, RTL.
7. **Design Decisions Log.** История решений (2-column vs 1-column, кнопка vs link, redirect vs toast) с обоснованием и датой.

## Content Rules

- **Каждый экран привязан к SC-шагу.** `scenario_steps` — не формальность, критично для verify покрытия.
- **Все interactive component'ы покрыты Component State Matrix.** Default + error минимум для кнопок/инпутов.
- **Токены из DS.** MK не хардкодит цвета/spacing — использует токены DS.
- **Accessibility обязательна.** Не опциональная секция — базовые правила всегда заполнены.
- **Edge cases конкретны.** «Работает при плохой связи» — плохо. «При network latency >3s — skeleton на 2 секунды, потом toast "Проверьте соединение"» — хорошо.
- **Design Decisions Log не переписывается.** Старые решения остаются, новые добавляются. История сохраняется.

### Screen Inventory формат

```markdown
| Screen ID | Title              | Type    | SC step   | Purpose                            |
|-----------|--------------------|---------|-----------|------------------------------------|
| SI-1      | Revisions inbox    | screen  | SC-005/6  | Список incoming revisions         |
| SI-2      | Revision details   | modal   | SC-007/1  | Раскрытие с body + context        |
| SI-3      | Apply success      | toast   | SC-007/3  | Подтверждение apply               |
| SI-4      | Empty inbox        | screen  | SC-005/-  | Когда revisions нет               |
```

### Component State Matrix формат

```markdown
### Component: PrimaryButton

| State     | Visual                          | Behavior                      | Related         |
|-----------|---------------------------------|-------------------------------|-----------------|
| default   | DS.tokens.primary, text white   | Clickable                     | —               |
| hover     | DS.tokens.primary-hover         | cursor:pointer                | —               |
| focus     | DS.tokens.primary + outline     | Tab-accessible                | a11y            |
| disabled  | DS.tokens.gray-50, no shadow    | Not clickable                 | BR-013 (guard)  |
| loading   | Spinner replaces text           | Not clickable, aria-busy     | —               |
| error     | DS.tokens.error border 1px      | Shows error message below    | BR-010 fail     |
```

## Relationships

**Входящие:**
- ← FM-{NNN} (принадлежит фиче; has_ui=true)
- ← SC-* (визуализирует конкретные сценарии)
- ← BR-* (правила отражаются в UI — error states, validation messages)
- ← LC-* (состояния сущностей — доступность кнопок, disabled states)
- ← BG (labels, placeholders, copy)
- ← RPM (role-based visibility)

**Исходящие:**
- → DS (новые токены/компоненты extractятся в DS)
- → NM-* (экраны из Screen Inventory попадают в Navigation Map)
- → Handoff (передаётся через INT-15 внешнему implementation — UI-контракт)
- → VC-* (визуальные критерии верификации)

**Cascade impact:**
- Изменение SC → проверить Screen Inventory (все шаги покрыты?)
- Изменение BR → проверить Component States (error/disabled актуальны?)
- Изменение LC → проверить component availability в разных states
- Добавление нового компонента в MK → авто-extract в DS

## Review Level: 🟠 Strategic

Design решения имеют бизнес-последствия (ease of use, accessibility, conversion). Человек approves каждое значимое iteration (не каждое мелкое изменение токена). Approve gates:
- 🟡 Review для Design Brief (может корректировать)
- 🟠 Strategic для финальной итерации + значимых changes
- 🟢 Confirmation для Component State Matrix (derived checklist)

## Lifecycle States

```
draft ──(first iteration approved)──▶ review ──(final approved)──▶ active
   │                                      │
   │                                      └──(more iterations)──▶ review (iteration++)
   │
   └──(feature cancelled)──▶ deprecated
```

- **draft** — в работе, визуальные макеты не готовы
- **review** — макеты готовы, ожидается approve
- **active** — утверждён; iteration число фиксирует текущую итерацию
- **deprecated** — если фича или дизайн-парадигма изменились

## Examples

**Good (фрагмент):**
```yaml
---
id: MK-003
type: mockup-package
title: "Revisions inbox & processing"
feature: FM-003
scenarios: [SC-005, SC-006, SC-007, SC-008]
scenario_steps:
  SC-005: [6]
  SC-006: [1, 2, 3]
  SC-007: [1, 2, 3]
  SC-008: [1, 2]
roles: [R-freelancer]
platform: responsive
design_tool: stitch
tool_project_url: "https://stitch.withgoogle.com/project/revisions-inbox-v3"
status: active
iteration: 3
---

## 1. Screen Inventory

| Screen ID | Title              | Type    | SC step      | Purpose                            |
|-----------|--------------------|---------|--------------|------------------------------------|
| SI-1      | Inbox (list)       | screen  | SC-005/6     | Список incoming revisions         |
| SI-2      | Revision details   | modal   | SC-006/2     | Просмотр с context/position       |
| SI-3      | Apply form         | modal   | SC-007/2     | Применение правки, preview        |
| SI-4      | Apply success      | toast   | SC-007/3     | Confirmation                       |
| SI-5      | Dismiss dialog     | modal   | SC-008/1     | Reason для dismiss                 |
| SI-6      | Empty state        | screen  | SC-005/-     | No revisions                       |

## 2. Component State Matrix

### Component: RevisionCard (в inbox list)

| State      | Visual                               | Behavior                        | Related       |
|------------|--------------------------------------|---------------------------------|---------------|
| default    | DS.tokens.card, left border=blue     | Click → SI-2                    | —             |
| hover      | DS.tokens.card-hover                 | cursor:pointer                  | —             |
| focus      | DS.tokens.card + outline             | Tab-accessible                  | a11y          |
| selected   | DS.tokens.card-selected              | Active в batch                  | BR-012 batch  |
| read       | DS.tokens.card-muted (50% opacity)   | Уже viewed, visually de-emphas. | LC-002 review |
| archived   | Hidden by default, filter toggle     | Не показан в default view       | LC-002 archived |

### Component: ApplyButton (в revision details)

| State     | Visual                          | Behavior                      | Related         |
|-----------|---------------------------------|-------------------------------|-----------------|
| default   | DS.tokens.primary               | Click → SI-3                  | —               |
| disabled  | DS.tokens.gray-50               | Not clickable, tooltip shown  | BR-013 (guard)  |
| loading   | Spinner                         | Not clickable, aria-busy      | —               |
| error     | Red border, error below         | Shows BR-013 violation msg    | BR-013 fail     |

## 3. Interaction Spec

- **Submit revision (SC-006):** Form validation inline → if ok → POST /revisions → optimistic update in list → toast SI-4
- **Apply revision (SC-007):** Click ApplyButton → SI-3 modal → confirm → PATCH /revisions/:id → update card to "processed" state → toast SI-4
- **Dismiss revision (SC-008):** Click DismissButton → SI-5 modal → reason (optional) → confirm → PATCH /revisions/:id → card to "rejected" state

## 4. Responsive Notes

- **Mobile (<768px):** Single column, cards full-width, modal становится full-screen
- **Tablet (768-1024):** Two-column grid для cards
- **Desktop (>1024):** Sidebar nav + 2-column main (list + detail)

## 5. Accessibility Notes

- Tab order: Inbox nav → Filter → Card-1 → Card-2 → ...
- Card aria-label: "Revision from {sender}, received {time}, status {status}"
- Contrast ratio: все текст — ≥4.5:1 (проверено toolом)
- Touch targets: ≥44x44px на mobile для кнопок и cards
- Screen reader: transitions announced ("Revision processed, 4 remaining")
- Keyboard shortcuts: A = apply focused, D = dismiss focused

## 6. Edge Cases

- **Empty inbox:** SI-6 screen с иллюстрацией + CTA "Your clients will send revisions here"
- **Very long revision body (>5000 chars):** Truncated with "Show more" в SI-2
- **Batch of 20+:** Pagination в SI-1; max 50 shown на page
- **Slow network (>3s):** Skeleton cards в SI-1; toast "Slow connection" после 5s
- **Session expired:** Redirect to login, preserve unsaved state через localStorage
- **RTL языки:** Mirror layout (левая панель → правая); tested на тестовой hebrew версии

## 7. Design Decisions Log

- **2026-06-01 (iteration 1):** Принял cards layout вместо table для inbox 
  — scan-ability лучше, mobile-friendly.
- **2026-06-03 (iteration 1):** Отверг separate "processed" tab — 
  overhead для users с небольшим объёмом; добавил filter вместо.
- **2026-06-05 (iteration 2):** Изменил Apply с inline edit на modal SI-3 — 
  usability тесты показали, что inline edit путает с комментированием.
- **2026-06-10 (iteration 2):** Добавил keyboard shortcuts (A/D) — 
  запрошено 3 из 5 test-freelancers.
- **2026-06-15 (iteration 3):** Добавил batch view (SC-007) — 
  JTBD-1 про батчевую обработку.
```

**Anti-example:**
```yaml
id: MK-003
figma_url: "https://figma.com/..."
# ничего больше                                     ❌ тонкий reference, не Package
```

## Common Mistakes

1. **MK = Figma URL.** Старая модель. Сейчас MK — полный пакет.
2. **Component State Matrix неполная.** Error/disabled/loading states часто забываются.
3. **Accessibility как опция.** Base accessibility всегда обязательна.
4. **Design Decisions переписываются.** История решений должна сохраняться — это контекст для будущих изменений.
5. **Нет привязки к SC-шагам.** Без этого не проверишь V-MK-01 (screen coverage).
6. **Tool switch без migration trail.** Меняешь `design_tool` вручную, забываешь записать `previous_tools[]` entry — теряется audit history. Используй `/design:migrate` (Design Module SPEC §3.6), не редактируй frontmatter напрямую.
7. **Custom migration поля.** `migration_notes`, `prev_tool`, `design_history` и подобные — forbidden. Канонические — только `previous_tools[]` + `tool_switched_at` + `ir_snapshot_path`.

## Related Skills

- `design-brief.md` (planned, D2-B04 step 1 — Design Module Phase 6 conditional)
- `component-states.md` (checklist состояний компонентов)
- `design-iteration.md` (итеративный workflow)
- `design-export.md` (для handoff)
