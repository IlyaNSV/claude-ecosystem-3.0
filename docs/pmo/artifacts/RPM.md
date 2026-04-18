# RPM — Role & Permission Model

> **Тип:** role-permission-model
> **Домен:** D2 — Behavioral
> **Review:** 🟢 Confirmation
> **Cardinality:** Singleton
> **Владелец:** Product Module / процесс P2 (derived)

## Purpose

**Бизнес-модель ролей** и их разрешений. Концептуальная матрица «кто может что делать», не техническая RBAC-таблица. Выводится из SC (кто что делает в сценариях) + SEG (кто наши пользователи). Передаётся в handoff как основа для технической авторизации во внешнем implementation-инструменте.

## Frontmatter Schema

```yaml
---
id: RPM                             # Фиксированный
type: role-permission-model
title: "Role & Permission Model"
status: active
roles: [R-<role-1>, R-<role-2>, ...]   # список всех ролей
action_count: N                      # автоподсчёт разрешений
derived_from: [SC-<NNN>, SEG-<NNN>]   # источники деривации
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Roles.** Список всех ролей (актёров) с описанием каждой.
2. **Actions.** Список действий в системе (обычно verb + object: `create_project`, `submit_revision`).
3. **Permission matrix.** Таблица: роль × действие → allowed/denied/conditional (+ ссылка на BR для conditional).
4. **Role relationships.** Иерархия или наложение (если есть) — например «Admin inherits all Freelancer permissions».
5. **Derivation trace.** Откуда выведены roles (SEG-*) и actions (SC-*).

Опциональные:

- **Anti-matrix** — явно отмеченные «никогда не разрешено» (чтобы не изменить случайно)
- **Future roles** (отмеченные как «не в MVP, но планируется»)

## Content Rules

- **Роли с префиксом R-.** `R-freelancer`, `R-client`, `R-admin`. Не просто `Freelancer` — чтобы отличать от термина из BG.
- **Actions в verb_object формате.** `create_project`, `view_dashboard`, `delete_revision`. Не `work_with_projects`.
- **Conditional permissions со ссылкой на BR.** «Freelancer может delete_project ЕСЛИ project_owner = user» → `conditional: BR-025`.
- **Матрица exhaustive.** Каждая пара (роль × action) имеет явное значение: allowed, denied, or conditional.
- **Не привязываемся к framework.** Никаких «Django User.is_staff» — это зона implementation.

### Роли: не только пользователи

Роли включают:
- **Human roles** — пользователи продукта (R-freelancer, R-admin)
- **External roles** — те, кто взаимодействует извне (R-client, R-reviewer)
- **System roles** — автоматические актёры в SC (R-system-scheduler, R-system-notifier)

## Relationships

**Входящие:**
- ← SEG-* (роли часто соответствуют сегментам)
- ← SC-* (actions извлекаются из шагов сценариев)
- ← BR-* (authorization-категория BR определяет conditional permissions)
- ← BG (термины для ролей и действий)

**Исходящие:**
- → VC-* (VC проверяют корректность авторизации в шагах SC)
- → handoff (передаётся во внешний implementation — основа для AuthZ системы)
- → SC-* (actors field в SC — это роли из RPM)

**Cascade impact:**
- Новая роль появилась в SC → добавить в RPM, определить permissions
- Новый action в SC → добавить в матрицу для всех ролей
- Изменение authorization BR → пересмотр conditional permissions

## Review Level: 🟢 Confirmation

RPM — derived artifact. Ассистент строит из SC + SEG. Человек подтверждает, что:
- Роли корректно извлечены
- Permissions соответствуют интуиции (ничего opasnogo случайно не разрешено)
- Conditional permissions ссылаются на правильные BR

## Lifecycle States

```
active ──(SC/SEG change)──▶ draft ──(reconfirm)──▶ active v2
```

RPM почти всегда в `active`. Изменения — инкрементальные (новая роль, новое действие).

## Examples

**Good (фрагмент):**
```yaml
---
id: RPM
type: role-permission-model
title: "Role & Permission Model"
status: active
roles: [R-freelancer, R-client, R-admin, R-system-scheduler]
action_count: 23
derived_from: [SEG-001, SEG-002, SC-001, SC-005, SC-007, SC-008, SC-015]
version: 2
---

## Roles

### R-freelancer
- **Описание:** Переводчик, владелец активных проектов. Пользователь продукта.
- **Источник:** SEG-001
- **Related:** BG entry "Freelancer"

### R-client
- **Описание:** Заказчик перевода. НЕ пользователь продукта, взаимодействует 
  через email/веб-виджет.
- **Источник:** SEG-002 + SC-005 (client sends email)
- **Related:** BG entry "Client"

### R-admin
- **Описание:** Администратор платформы (нас). Внутренняя роль, не клиенты.
- **Источник:** future-roles (не в MVP, placeholder)

### R-system-scheduler
- **Описание:** Автоматический actor, выполняющий scheduled операции 
  (архивация, auto-reject, notifications).
- **Источник:** SC-005 step 2 (system auto-processing), BR-011, BR-020.

## Actions

Группированы по категории:

### Project actions
- `create_project`, `edit_project`, `delete_project`, `view_project`, 
  `archive_project`, `invite_client`

### Revision actions
- `submit_revision` (client), `view_revisions`, `apply_revision`, 
  `dismiss_revision`, `reopen_revision`

### Analytics
- `view_dashboard`, `export_metrics`

## Permission matrix

| Action              | R-freelancer        | R-client          | R-admin | R-system |
|---------------------|---------------------|-------------------|---------|----------|
| create_project      | ✓ (own)             | ✗                 | ✓       | ✗        |
| edit_project        | conditional (BR-025)| ✗                 | ✓       | ✗        |
| delete_project      | conditional (BR-026)| ✗                 | ✓       | ✗        |
| view_project        | ✓ (own)             | ✓ (linked only)   | ✓       | ✓        |
| archive_project     | ✓ (own)             | ✗                 | ✓       | ✓ (auto) |
| invite_client       | ✓                   | ✗                 | ✓       | ✗        |
| submit_revision     | ✗                   | ✓ (linked project)| ✗       | ✗        |
| view_revisions      | ✓ (own projects)    | ✓ (own)           | ✓       | ✓        |
| apply_revision      | conditional (BR-013)| ✗                 | ✗       | ✗        |
| dismiss_revision    | ✓ (own projects)    | ✗                 | ✓       | ✗        |
| reopen_revision     | ✗                   | ✓ (own, <30 days) | ✓       | ✗        |
| view_dashboard      | ✓                   | ✗                 | ✓       | ✗        |
| export_metrics      | ✓ (own only)        | ✗                 | ✓       | ✗        |

## Role relationships

- R-admin наследует все R-freelancer permissions + admin-specific.
- R-system-scheduler — неиерархическая; имеет точечный доступ к auto-actions.

## Derivation trace

- R-freelancer: SEG-001 primary
- R-client: extracted from SC-005 (client sends email), SC-005a
- R-admin: placeholder для future, не derived из текущих SC
- R-system-scheduler: SC-005 step 2, BR-011, BR-020 all reference system actor
- Actions извлечены из Steps всех SC где actor присутствует

## Anti-matrix (явно запрещено)

- R-client НИКОГДА не может `delete_project` — даже для собственных проектов 
  (это действие только freelancer или admin)
- R-freelancer НИКОГДА не может видеть projects других freelancers 
  (privacy from SEG interviews)
- R-system-scheduler НИКОГДА не применяет revisions автоматически 
  (решение freelancer'а строго обязательно)
```

**Anti-example:**
```markdown
## Permission matrix
| Freelancer | Admin |
| ✓ | ✓ |                                          ❌ без actions
Admin can do everything                             ❌ опасно и не проверяемо
```

## Common Mistakes

1. **RPM = RBAC таблица.** RPM — бизнес-уровень, RBAC — реализация. RPM не знает о Django Groups.
2. **Incomplete matrix.** Пустые ячейки = неопределённость. Все пары должны иметь значение.
3. **Conditional без BR.** «Может если owner» — где это правило? Должна быть ссылка BR-XXX.
4. **Забыть system roles.** Auto-archive, scheduled tasks — actors; их надо в RPM.
5. **Role ≠ SEG.** Не всегда 1:1. SEG — бизнес-сегмент, Role — роль в системе. Один SEG может иметь две роли (freelancer + project-owner).

## Related Skills

- `rpm-derivation.md` (в разработке, core алгоритм из SC + SEG)
- `permission-matrix-review.md` (в разработке)
