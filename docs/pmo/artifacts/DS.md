# DS — Design System

> **Тип:** design-system
> **Домен:** D2-B04 — Design Module (cross-cutting для всех MK)
> **Review:** 🟡 Standard
> **Cardinality:** Singleton
> **Владелец:** Design Module — автоматическое пополнение при создании/изменении MK-*

## Purpose

**Сквозной словарь визуального языка** продукта — токены (цвета, типографика, spacing, shadows), компоненты (их варианты), паттерны (комбинации компонентов). Аналог BG, но для дизайна. Обеспечивает **визуальную консистентность** между всеми MK и передаётся как UI-контракт в handoff.

## Frontmatter Schema

```yaml
---
id: DS                                 # Фиксированный
type: design-system
title: "Product Design System"
design_tool: stitch                    # основной инструмент
status: active
token_count: N                         # автоподсчёт
component_count: N
pattern_count: N
last_extraction_at: YYYY-MM-DDThh:mm   # при последнем auto-extract из MK
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1                             # ++ при mass-rename токена
---
```

## Body Structure

Обязательные секции:

1. **Design Tokens.** 5 подсекций: colors, typography, spacing, border & radius, shadows.
2. **Component Library Index.** Реестр компонентов с variants и "first appeared in MK-X".
3. **Pattern Library.** Типовые комбинации компонентов (form-with-validation, list-with-empty-state, confirmation-dialog).
4. **Usage Rules.** Правила использования: когда брать токен из DS vs кастомизировать.

Опциональные:

- **Theme variants** (light/dark если есть)
- **Brand guidelines references** (если есть внешние гайдлайны)
- **Deprecated tokens** (с датой депрекации и миграцией)

## Content Rules

- **Токены имеют ID.** Не просто `#3B82F6`, а `DS.color.primary` со значением.
- **Каждый токен имеет usage description.** «Для чего этот цвет» — body text, primary action, error state.
- **Компоненты ссылаются на "first appeared".** Извлечение из MK отслеживается.
- **Mass-rename требует approve.** Изменение имени токена каскадит на все MK — нужен явный approve.
- **Deprecated tokens не удаляются сразу.** Помечаются, с датой и миграционным путём. Удаляются после всех ссылок.

### Token structure

```markdown
### Colors

| Token                | Value    | Usage                                          | First in |
|----------------------|----------|------------------------------------------------|----------|
| DS.color.primary     | #3B82F6  | Primary actions (buttons, links)              | MK-001   |
| DS.color.primary-hover | #2563EB | Hover state of primary                        | MK-001   |
| DS.color.gray-50     | #F9FAFB  | Subtle backgrounds                            | MK-001   |
| DS.color.gray-900    | #111827  | Body text                                     | MK-001   |
| DS.color.error       | #EF4444  | Error states, destructive actions             | MK-002   |
| DS.color.success     | #10B981  | Success states, confirmations                 | MK-003   |
```

### Component structure

```markdown
### PrimaryButton

- **Variants:** default, hover, focus, disabled, loading, error
- **Tokens used:** DS.color.primary, DS.color.primary-hover, DS.typography.button, DS.spacing.md
- **Where appears:** MK-001 (login), MK-003 (apply revision), MK-005 (settings)
- **First in:** MK-001
- **Accessibility:** min touch target 44x44, contrast ≥4.5:1
```

## Relationships

**Входящие (extraction):**
- ← MK-* (при создании/изменении MK — извлечение токенов, компонентов)

**Исходящие (consumption):**
- → ВСЕ MK-* (используют DS токены, не хардкодят цвета)
- → Handoff (передаётся во внешний implementation как Tailwind config / CSS variables / Material theme)

**Cascade impact:**
- Новый MK → auto-extract новых токенов/компонентов (draft в DS), human approve
- Rename токена → mass update всех MK (process P4-Design)
- Deprecate токен → warning при попытке использования, migration path

## Review Level: 🟡 Standard

Ассистент извлекает и предлагает. Человек подтверждает:
- Действительно ли новый токен отличается от существующих (или можно переиспользовать)
- Корректность именования
- Согласованность с brand direction

Mass-rename — 🟠 Strategic (т.к. каскадит на все MK).

## Lifecycle States

DS всегда `active`. Внутренние элементы имеют состояния:
- Tokens: draft → active → deprecated
- Components: draft → active → deprecated
- Patterns: draft → active → deprecated

## Examples

**Good (фрагмент):**
```yaml
---
id: DS
type: design-system
design_tool: stitch
status: active
token_count: 28
component_count: 12
pattern_count: 5
last_extraction_at: 2026-06-15T14:30
version: 2
---

## 1. Design Tokens

### Colors

| Token                  | Value    | Usage                                    | First in |
|------------------------|----------|------------------------------------------|----------|
| DS.color.primary       | #3B82F6  | Primary actions                          | MK-001   |
| DS.color.primary-hover | #2563EB  | Hover state of primary                   | MK-001   |
| DS.color.primary-focus | #1D4ED8  | Focus ring                               | MK-001   |
| DS.color.gray-50       | #F9FAFB  | Subtle backgrounds                       | MK-001   |
| DS.color.gray-100      | #F3F4F6  | Disabled states                          | MK-001   |
| DS.color.gray-500      | #6B7280  | Secondary text                           | MK-001   |
| DS.color.gray-900      | #111827  | Body text                                | MK-001   |
| DS.color.error         | #EF4444  | Error states                             | MK-002   |
| DS.color.error-bg      | #FEE2E2  | Error backgrounds                        | MK-002   |
| DS.color.success       | #10B981  | Success states                           | MK-003   |
| DS.color.warning       | #F59E0B  | Warning states                           | MK-004   |

### Typography

| Token                  | Value                          | Usage           |
|------------------------|--------------------------------|-----------------|
| DS.font.sans           | Inter, system-ui, sans-serif   | Body, UI        |
| DS.font.mono           | Menlo, Consolas, monospace     | Code, data      |
| DS.typography.heading1 | 24px/32px, 700 weight          | Page titles     |
| DS.typography.heading2 | 20px/28px, 600 weight          | Section titles  |
| DS.typography.body     | 14px/20px, 400 weight          | Main content    |
| DS.typography.small    | 12px/16px, 400 weight          | Helper text     |
| DS.typography.button   | 14px/20px, 500 weight          | Button labels   |

### Spacing

| Token           | Value  | Usage                              |
|-----------------|--------|-------------------------------------|
| DS.spacing.xs   | 4px    | Inline gaps                        |
| DS.spacing.sm   | 8px    | Small padding, icon-text gap       |
| DS.spacing.md   | 16px   | Standard padding                   |
| DS.spacing.lg   | 24px   | Card padding                       |
| DS.spacing.xl   | 32px   | Section separation                 |
| DS.spacing.2xl  | 48px   | Page-level padding                 |

### Border & Radius

| Token                 | Value  | Usage                     |
|-----------------------|--------|---------------------------|
| DS.radius.sm          | 4px    | Small elements (tags)     |
| DS.radius.md          | 8px    | Standard (cards, buttons) |
| DS.radius.lg          | 12px   | Large (modals)            |
| DS.radius.full        | 9999px | Pills, avatars            |
| DS.border.default     | 1px    | Standard borders          |

### Shadows

| Token                 | Value                                  | Usage                  |
|-----------------------|----------------------------------------|------------------------|
| DS.shadow.sm          | 0 1px 2px rgba(0,0,0,0.05)             | Subtle depth           |
| DS.shadow.md          | 0 4px 6px rgba(0,0,0,0.1)              | Cards                  |
| DS.shadow.lg          | 0 10px 15px rgba(0,0,0,0.1)            | Modals, dropdowns      |

## 2. Component Library Index

### PrimaryButton
- Variants: default, hover, focus, disabled, loading, error
- Tokens: DS.color.primary, DS.color.primary-hover, DS.typography.button, DS.spacing.md, DS.radius.md
- First in: MK-001
- Used in: MK-001, MK-003, MK-005

### TextInput
- Variants: default, focus, error, disabled, with-prefix, with-suffix
- Tokens: DS.color.gray-500, DS.color.error, DS.typography.body, DS.spacing.md, DS.radius.md, DS.border.default
- First in: MK-001
- Used in: MK-001, MK-002, MK-005

### Card (RevisionCard, ProjectCard...)
- Variants: default, hover, selected, muted, archived
- Tokens: DS.color.gray-50, DS.shadow.md, DS.radius.md, DS.spacing.lg
- First in: MK-003

### Toast
- Variants: success, error, info, warning
- First in: MK-003

### Modal
- Variants: small, medium, large, full-screen (mobile)
- First in: MK-003

## 3. Pattern Library

### Form with inline validation
- Components: TextInput (with error state), FormLabel, HelperText, SubmitButton
- Used in: MK-001 (login), MK-005 (project create)
- Pattern: validation on blur, error inline below field

### List with empty state
- Components: Card × N OR EmptyState
- Used in: MK-003 (revisions inbox), MK-006 (projects list)
- Pattern: show cards if data, EmptyState illustration + CTA if empty

### Confirmation dialog
- Components: Modal, heading, body, primary+secondary buttons
- Used in: MK-003 (dismiss revision), MK-008 (delete project)
- Pattern: destructive actions require confirmation modal

## 4. Usage Rules

- **Always use DS tokens.** Hardcoded colors/sizes → hook warning.
- **New token proposals go through DS review.** Добавлен ли токен в DS прежде, чем использовать в MK? Если нет — ассистент предлагает добавить.
- **Deprecated tokens show warnings.** При использовании DS.color.old-primary — warning + suggestion migrate to primary.
- **Components should use only DS tokens.** Custom styling inside component = red flag.
- **Patterns are recommendations.** Не jesus строгие, но breaking pattern должно быть обосновано в Design Decisions Log.

## Deprecated tokens (history)

| Token (deprecated)   | Replacement         | Deprecated on | Migration |
|----------------------|---------------------|---------------|-----------|
| DS.color.old-primary | DS.color.primary    | 2026-06-01    | Direct replace, same hex |
```

**Anti-example:**
```markdown
## Tokens
blue: #3B82F6                                  ❌ без ID, без usage
red: #FF0000                                   ❌ без ID, просто значение

## Components
Button                                          ❌ без variants, без token refs
```

## Common Mistakes

1. **Хардкод в MK.** MK использует `#3B82F6` напрямую вместо `DS.color.primary` → рассинхрон.
2. **Token proliferation.** 10 оттенков синего без явной нужды — визуальная каша.
3. **Component без variants.** Кнопка только "default" состояния — неполная спецификация.
4. **DS отстаёт от MK.** MK ввёл новый компонент, DS не обновлена — extraction сломан.
5. **Deprecation без migration path.** Удаление токена без «мигрируйте на X» ломает все существующие MK.

## Related Skills

- `ds-extraction.md` (planned, автоизвлечение из MK — Design Module Phase 6 conditional)
- `ds-mass-rename.md` (deferred to v1.1+ — atomic mass-rename, см. [`dev/v1_1_backlog.md`](../../../dev/v1_1_backlog.md))
- `ds-token-review.md` (planned)
