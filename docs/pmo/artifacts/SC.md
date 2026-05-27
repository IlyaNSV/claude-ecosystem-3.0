# SC-* — User Scenario

> **Тип:** scenario
> **Домен:** D2 — Behavioral
> **Review:** 🟠 Strategic
> **Cardinality:** Per scenario (обычно 2–6 SC на FM)
> **Владелец:** Product Module / процесс P2 Feature Definition

## Purpose

**Конкретный поток взаимодействия** пользователя (роли) с системой. Ключевой D2-артефакт — описывает **реальное поведение** системы в терминах пошаговых действий. Источник для генерации VC (критериев верификации) и для тестов.

## Frontmatter Schema

```yaml
---
id: SC-<NNN>
type: scenario
title: "Короткое имя сценария"
feature: FM-<NNN>
flow_type: main | alternative | error     # тип потока
actors: [R-role-1, R-role-2, ...]          # роли из RPM
preconditions: "string"                   # состояние до сценария
rules: [BR-<NNN>, ...]                    # используемые бизнес-правила
lifecycle: LC-<NNN>                        # основной lifecycle, который затронут
mockup: MK-<NNN>                           # связанный Design Package (если UI)
verification: [VC-<NNN>, ...]             # критерии верификации
status: draft | active | deprecated
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Actors.** Кто участвует (роли из RPM).
2. **Preconditions.** Состояние системы и сущностей до начала сценария.
3. **Trigger.** Что запускает сценарий (action, event, condition).
4. **Steps.** Пронумерованные шаги. Каждый шаг: actor + action + system response.
5. **Postconditions.** Состояние системы после успешного завершения.
6. **Business rules applied.** Список BR, применяемых в шагах (с указанием номера шага).

Опциональные:

- **Related scenarios** (alt потоки, error потоки — ссылки на их SC)
- **Example data** (конкретные значения для большей ясности)

## Content Rules

- **Actor-verb формат шага.** Каждый шаг начинается с actor: «Freelancer submits revision» или «System sends notification».
- **Один actor на шаг.** Если два actor'а — значит, это два шага.
- **Конкретные данные вместо общих фраз.** «Пользователь вводит текст» — плохо. «Freelancer вводит название проекта (string, 3-100 символов)» — хорошо.
- **Ссылки на BR явные.** «(BR-010)» рядом с шагом, где применяется правило.
- **Ссылки на BG-термины.** Используем термины из BG, не синонимы.
- **Flow type строгий.** Один SC — один flow. Alternative и error — отдельные SC (например, SC-005 main, SC-005a alternative, SC-005e error).

### Нумерация SC

- **SC-NNN** — main flow
- **SC-NNNa, SC-NNNb, ...** — alternative flows связанной main
- **SC-NNNe1, SC-NNNe2, ...** — error flows

Так легко связать «SC-005 имеет alt SC-005a и error SC-005e1».

## Relationships

**Входящие:**
- ← FM-{NNN} (SC принадлежит фиче)
- ← BG (использует термины)
- ← RPM (актёры из модели ролей)

**Исходящие:**
- → BR-* (двунаправленная: SC ссылается на BR, BR знает список SC)
- → LC-* (шаги порождают переходы lifecycle)
- → VC-* (каждый шаг имеет критерий верификации)
- → MK-* (для UI-шагов — референс на макет)

**Cascade impact:**
- Изменение SC → проверить VC (покрытие), BR (добавились/убрались правила), LC (новые переходы?), MK (UI изменения?)
- Удаление SC → BR в `requires_review` (возможно orphan), VC удаляются

## Review Level: 🟠 Strategic

Сценарии определяют, **что именно система делает**. Ошибка в SC дорого стоит на этапе реализации. Ассистент генерирует draft через диалог + из FM/SEG/BR, человек ревьюит поведение системы.

## Lifecycle States

```
draft ──(approve)──▶ active ──(changed)──▶ draft ──▶ active v2
                       │
                       └──(FM deprecated)──▶ deprecated
```

## Examples

**Good (фрагмент):**
```yaml
---
id: SC-005
type: scenario
title: "Получение revision через email"
feature: FM-003
flow_type: main
actors: [R-freelancer, R-client]
preconditions: "Project активен, client связан с project через email"
rules: [BR-010, BR-011, BR-012]
lifecycle: LC-002
mockup: MK-003
verification: [VC-005, VC-005a, VC-005b]
status: active
---

## Actors
- **Freelancer** (R-freelancer) — пользователь продукта, владелец проекта
- **Client** (R-client) — заказчик, не пользователь продукта

## Preconditions
- Project **P** существует, status=in-progress
- Freelancer настроил forwarding с email на project@inbox.product
- Client знает email project

## Trigger
Client отправляет email на project@inbox.product с правкой документа.

## Steps
1. **Client** отправляет email с темой «Правка к переводу» и текстом правки.
2. **System** получает email через forwarding, извлекает sender address и body.
3. **System** применяет **BR-010** (привязка revision по sender email к project):
   - Ищет project, где sender email в списке client_emails
   - Если найден один — привязывает к нему
   - Если найдено несколько — idle, ждёт manual привязки (см. SC-005a)
   - Если не найден — **BR-011**: направляет в review-pool (см. SC-005e1)
3. **System** создаёт **Revision** entity (термин из BG):
   - status = `incoming` (начальное состояние в **LC-002**)
   - linked to project P
   - source = email
   - body = текст письма
4. **System** применяет **BR-012** (batch grouping):
   - Если за последние 2 часа были revisions от этого client — добавить в existing batch
   - Иначе — создать новый batch
5. **System** отправляет notification freelancer'у в Revisions inbox (см. MK-003).
6. **Freelancer** видит новый revision в inbox (см. MK-003 Screen Inventory §1).

## Postconditions
- Revision создан со status=incoming, linked to project P
- Revision в batch (существующем или новом)
- Freelancer notified через in-app notification

## Business rules applied
- BR-010 (шаг 3) — email-to-project linking
- BR-011 (шаг 3 error branch) — fallback на review-pool
- BR-012 (шаг 4) — batch grouping

## Related scenarios
- SC-005a (alternative): multiple project match → manual linking
- SC-005e1 (error): no project match → review-pool notification

## Example data
- Client email: client@company.com
- Project: "Annual report translation RU→EN 2026"
- Revision body: "Параграф 3 странной формулировки, переформулируйте"
```

**Anti-example:**
```markdown
## Steps
1. Пользователь делает что-то                    ❌ нет actor, нет данных
2. Хорошо если система реагирует                 ❌ не уточнено что
3. Работает                                      ❌ не описан response
```

## Common Mistakes

1. **Смешение main/alt/error в одном SC.** Один SC = один flow. Альтернативы — отдельные SC.
2. **Шаги без actor.** «Создаётся revision» — кто создаёт? Явно actor.
3. **Игнор BR.** SC без ссылок на BR = правила размыты в тексте, не переиспользуются.
4. **UI-специфичные шаги в не-UI SC.** «Нажимает кнопку X» — если это не единственный способ, описывай действие абстрактно.
5. **Слишком детально / слишком обобщённо.** 50 шагов — слишком; 3 шага «пришло, обработано, ок» — слишком мало.

## Related Skills

- [`scenario-authoring.md`](../../../skills/product/scenario-authoring.md)
- `scenario-decomposition.md` (разделение на main/alt/error)
