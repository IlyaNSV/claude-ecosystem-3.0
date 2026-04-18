# BG — Business Glossary

> **Тип:** glossary
> **Домен:** Cross-cutting (сквозной)
> **Review:** 🟡 Standard
> **Cardinality:** Singleton
> **Владелец:** Product Module — автоматическое пополнение при всех процессах создания/обновления артефактов

## Purpose

**Единый словарь терминов предметной области.** Сквозной артефакт, обеспечивающий **терминологическую консистентность** между всеми артефактами Product Layer, D2-Technical (передаётся в handoff) и кодом. Переименование термина в BG = mass-rename через все `.product/`.

## Frontmatter Schema

```yaml
---
id: BG                              # Фиксированный
type: glossary
title: "Business Glossary"
status: active
term_count: N                        # автоподсчёт
last_extraction_at: YYYY-MM-DDThh:mm  # время последнего auto-extract
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1                           # инкрементируется при mass-rename
---
```

## Body Structure

Обязательная структура: **таблица терминов** с секциями.

### Секции (группировка)

- **Core entities** — ключевые сущности домена (Project, Revision, Client)
- **Actions & processes** — глаголы домена (Submit, Review, Archive)
- **Roles** — роли пользователей (Freelancer, Client, Reviewer)
- **States & statuses** — состояния сущностей (Pending, In-progress, Completed)
- **Artifacts & documents** — типы документов (Translation, Revision batch)
- **Metrics & measurements** — метрики (Conversion rate, Batch size)

### Формат записи термина

```markdown
### Revision
- **Определение:** Правка от клиента на часть переведённого документа с указанием
  позиции и желаемого изменения.
- **Альтернативные термины:** ❌ edit, comment, feedback (НЕ используем)
- **Используется в:** SC-005, SC-006, SC-007, BR-010..012, LC-002, FM-003
- **Связанные термины:** Revision batch, Revision status, Revision author
- **Добавлен:** 2026-05-10 (из SC-005 draft)
- **Status:** active
```

## Content Rules

- **Один концепт — один термин.** «Правка», «комментарий», «замечание» → один термин (например, `Revision`), остальные явно отвергнуты.
- **Термин не может быть переопределён без mass-rename.** Изменение определения = пересмотр всех ссылок.
- **Capitalization consistent.** `Revision` (PascalCase для сущностей) vs `revision batch` (lower для process terms) — один стиль по секции.
- **Нет маркетинговых терминов.** «Magic inbox» — не в BG. BG — про domain.
- **Каждый термин имеет ссылки на использование.** Если термин не используется ни в одном артефакте — удаляем.

### Когда добавляется термин (extraction algorithm)

BG пополняется автоматически при создании/изменении ЛЮБОГО артефакта. Алгоритм:

1. При сохранении артефакта (PostToolUse hook):
   - Сканировать текст на **жирное выделение** (`**term**`)
   - Сканировать YAML frontmatter на значения с domain-specific именами
   - Для каждого кандидата:
     - Уже в BG? → добавить ссылку на артефакт в `used in`
     - Новый? → создать draft запись, уведомить ассистента

2. Ассистент при следующем взаимодействии:
   - Предложить определение для draft-терминов
   - Human approves → draft → active
   - Или human удаляет (не-domain термин)

3. При mass-rename (смена существующего термина):
   - Ассистент предлагает список всех ссылок
   - Human approves каскад
   - Все артефакты обновляются в одном коммите
   - BG version++

### Что НЕ попадает в BG

- Технические термины реализации (`database`, `API endpoint`, `React component`) — зона implementation
- Общеупотребительные слова (`user`, `project` без специфичного значения)
- Временные термины (черновики, которые не закрепились)

## Relationships

**Входящие (extraction):**
- ← ВСЕ артефакты при сохранении

**Исходящие (consumption):**
- → ВСЕ артефакты при создании (ассистент использует термины из BG для консистентности)
- → handoff (передаётся в разделе «Terminology» как выжимка для фичи)
- → Внешний implementation-инструмент (через handoff — для именования переменных, API полей, UI labels)

**Cascade impact:**
- Переименование термина → все ссылки в `.product/` обновляются
- Удаление термина → warning на используемых артефактах (orphan reference)
- Добавление термина → новые артефакты могут использовать без переизобретения

## Review Level: 🟡 Standard

Ассистент извлекает кандидатов и предлагает определения. Человек подтверждает корректность (особенно при первом появлении термина). При mass-rename — обязательный approve, т.к. каскадит на весь Product Layer.

## Lifecycle States

BG всегда в `active`. Термины внутри имеют свои статусы:

- **draft** — предложен ассистентом, ждёт human approve
- **active** — утверждён, используется
- **deprecated** — помечен как устаревший; ассистент предупреждает при попытке использовать; удаляется после деприкации всех ссылок

## Examples

**Good (фрагмент):**
```markdown
---
id: BG
type: glossary
status: active
term_count: 23
last_extraction_at: 2026-06-15T14:30
version: 3
---

## Core entities

### Project
- **Определение:** Переводческий проект от одного клиента, включающий исходный
  документ, целевые языки, дедлайн и набор правок.
- **Альтернативные термины:** ❌ job, task, order (НЕ используем)
- **Используется в:** PS, SEG-001, FM-001, FM-003, SC-001, LC-001
- **Связанные:** Project status, Project deadline, Client (см. Roles)
- **Добавлен:** 2026-05-02
- **Status:** active

### Revision
- **Определение:** Правка от клиента на часть переведённого документа
  с указанием позиции и желаемого изменения.
- **Альтернативные термины:** ❌ edit, comment, feedback (НЕ используем)
- **Используется в:** SC-005, SC-006, SC-007, BR-010..012, LC-002, FM-003
- **Связанные:** Revision batch, Revision status, Revision author
- **Добавлен:** 2026-05-10
- **Status:** active

### Revision batch
- **Определение:** Группа revision'ов, приходящих в одно временное окно
  (≤2ч) от одного клиента для одного проекта.
- **Используется в:** BR-012, SC-007, VC-007
- **Связанные:** Revision, Batch window
- **Добавлен:** 2026-05-12
- **Status:** active

## Roles

### Freelancer
- **Определение:** Самозанятый переводчик — пользователь нашего продукта
  из SEG-001.
- **Используется в:** SEG-001, RPM, SC-001..010
- **Добавлен:** 2026-05-02
- **Status:** active

### Client
- **Определение:** Заказчик перевода — НЕ пользователь нашего продукта,
  но взаимодействует через email/web-widget.
- **Используется в:** RPM, SC-005, SC-006
- **Добавлен:** 2026-05-02
- **Status:** active

## States & statuses

### Revision status
- **Определение:** Состояние отдельного revision в lifecycle LC-002.
- **Возможные значения:** incoming, reviewed, processed, rejected, archived
- **Используется в:** LC-002, SC-005..007, BR-011
- **Status:** active
```

**Anti-example:**
```markdown
### правка
- Это когда клиент пишет что исправить.          ❌ lowercase, неформально

### edit / comment / revision / feedback
- Одно и то же по смыслу.                         ❌ не выбран единый термин

### User
- Пользователь.                                   ❌ слишком общее
```

## Common Mistakes

1. **Синонимы.** Если в разных SC используется «правка», «комментарий», «замечание» — это bug, должно быть одно слово (+ alternatives списком «не использовать»).
2. **BG как FAQ.** BG — не про продукт для пользователей, а для внутренней консистентности.
3. **Переусложнение.** 100+ терминов — пахнет перерегулированием; 10–30 ключевых достаточно для MVP.
4. **Термины без `used in`.** Orphan-термины накапливаются; нужен regular cleanup.
5. **Игнор extraction.** Если ассистент предлагает термин, а человек всё время пропускает — BG разъезжается с реальностью.

## Related Skills

- `bg-extraction-protocol.md` (в разработке, core алгоритм)
- `bg-mass-rename.md` (в разработке)
