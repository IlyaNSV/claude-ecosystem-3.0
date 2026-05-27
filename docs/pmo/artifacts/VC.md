# VC-* — Verification Criteria

> **Тип:** verification-criteria
> **Домен:** D2 — Behavioral (мост в D4 Quality)
> **Review:** 🟢 Confirmation
> **Cardinality:** Per scenario (обычно 2–5 VC на SC)
> **Владелец:** Product Module / процесс P2 (derived from SC + BR + LC)

## Purpose

**Проверяемые бизнес-утверждения** для конкретного сценария. Контракт между Product Layer (что должно выполняться) и implementation + тестами (что именно проверяется). Именно VC попадает в тесты через внешний QA-инструмент (в будущем через INT-12).

## Frontmatter Schema

```yaml
---
id: VC-<NNN>
type: verification-criteria
title: "Что проверяем"
scenario: SC-<NNN>                     # основной сценарий
rules: [BR-<NNN>, ...]                 # какие BR должны выполниться
lifecycle: LC-<NNN>                    # какие LC transitions должны произойти
flow_type: main | alternative | error
status: draft | active | deprecated
derived_from: [SC-<NNN>, BR-<NNN>, LC-<NNN>]
testable: true | false                 # можно ли автоматизировать
suggested_test_type: unit | integration | e2e | manual
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Criteria statement.** Проверяемое утверждение в формате «При [context], [action] должно привести к [outcome]». Формализм максимальный.
2. **Given / When / Then** (Gherkin-подобный формат).
3. **Expected outcomes.** Список всех наблюдаемых результатов (entity states, sent notifications, stored data).
4. **Rules verified.** Ссылки на BR, чью работу проверяем + точечное описание «что именно из BR» (например: «BR-010: linking by sender email»).
5. **Lifecycle transitions verified.** Какие transitions в LC должны произойти.
6. **Negative assertions.** Что НЕ должно произойти (чтобы исключить side effects).

Опциональные:

- **Test data suggestions** (примеры входных данных)
- **Edge cases** (экстремальные варианты, которые тоже должны проходить)

## Content Rules

- **Given/When/Then обязателен.** Unified формат позволяет автогенерацию тестов.
- **Каждое Then — falsifiable.** «Система работает» — нет. «Revision.status == 'incoming' AND Revision.project_id == Project.id» — да.
- **Ссылки на BR/LC явные.** В каждом VC — какое конкретно BR проверяется.
- **One scenario → multiple VC.** Один SC обычно имеет 2-5 VC, каждый проверяет отдельный аспект.
- **Negative assertions важны.** Без них тесты не поймают side effects.

### Gherkin-подобный формат

```gherkin
Given <precondition (SC preconditions + test setup)>
When <action (соответствует trigger SC или отдельному шагу)>
Then <expected outcome 1>
  And <expected outcome 2>
  And <lifecycle transition: Entity X from state A to state B>
  And NOT <negative assertion>
```

## Relationships

**Входящие (derived_from):**
- ← SC-{NNN} (контекст и шаги)
- ← BR-* (правила, которые должны сработать)
- ← LC-* (transitions, которые должны произойти)

**Исходящие:**
- → External QA tool (через INT-12 future — автогенерация tests)
- → unified-verifier (если используется)
- → Handoff (передаётся как acceptance criteria)

**Cascade impact:**
- Изменение SC → все VC в `requires_review`
- Изменение BR → VC ссылающиеся на BR — regen
- Изменение LC → VC с transitions — regen

## Review Level: 🟢 Confirmation

Derived artifact. Ассистент генерирует из SC + BR + LC. Человек подтверждает:
- Покрыты все ветки SC (main/alt/error)
- Нет missed transitions
- Negative assertions адекватны
- Testable=true где реально можно автоматизировать

**Покрытие = критерий V-07:** VC должен покрывать все шаги SC + все branches + все применяемые BR + все transitions LC.

## Lifecycle States

```
draft ──(confirm coverage)──▶ active ──(SC/BR/LC change)──▶ draft
                                 │
                                 └──(SC deprecated)──▶ deprecated
```

## Examples

**Good:**
```yaml
---
id: VC-005
type: verification-criteria
title: "Revision из email корректно linked к project"
scenario: SC-005
rules: [BR-010, BR-012]
lifecycle: LC-002
flow_type: main
status: active
derived_from: [SC-005, BR-010, BR-012, LC-002]
testable: true
suggested_test_type: integration
---

## Criteria statement
При получении email с правкой от client, чей адрес записан в одном активном 
project, revision должен быть создан с корректной project link, добавлен 
в соответствующий batch, и freelancer должен получить in-app notification.

## Given / When / Then

```gherkin
Given Project P существует, status=in-progress
  And Client C связан с P через email client@example.com
  And Freelancer F — owner of P
  And Нет других активных проектов с этим client email

When System receives email:
  From: client@example.com
  To: project@inbox.product
  Subject: "Правка к переводу"
  Body: "Параграф 3 переформулируйте"

Then Revision R создан с:
  And R.project_id == P.id                      # BR-010 applied
  And R.status == "incoming"                    # LC-002 initial state
  And R.source == "email"
  And R.body == "Параграф 3 переформулируйте"
  And R.sender == "client@example.com"
  And R.received_at is within last 10 seconds

  And R добавлен в batch B (existing или new):  # BR-012 applied
    If предыдущий revision от C к P за last 2h:
      B == existing batch
    Else:
      B is new, B.client_id == C.id, B.project_id == P.id

  And Freelancer F получил in-app notification:
    Type == "new_revision"
    linked_to == R.id

  And Lifecycle transition: Revision R from [*] to "incoming" (LC-002)

  And NOT created duplicate revision
  And NOT email processed twice (idempotency)
  And NOT notification sent to other freelancers
```

## Expected outcomes

- **Entity created:** Revision R со всеми полями выше
- **Entity link:** R.project_id points to P
- **Batch membership:** R in batch B (existing или new per BR-012)
- **Notification sent:** in-app to F, email NOT sent (out of scope MVP)
- **LC transition:** R entered "incoming" state

## Rules verified

- **BR-010:** Email sender → project linking by client email match (шаг 3 SC-005)
- **BR-012:** Batch grouping by 2h window (шаг 4 SC-005)

## Lifecycle transitions verified

- **LC-002:** [*] → incoming (при создании R)

## Negative assertions

- NOT duplicate revision (при повторной доставке того же email)
- NOT notification to других freelancers (privacy)
- NOT email forwarded как response (R stays in incoming, не переходит в reviewed автоматически)
- NOT project status изменён

## Edge cases

- Email с attachment: attachment сохранён в R.attachments, но не блокирует 
  создание R
- Email с длинным body (>10k chars): truncated при хранении, original saved
- Email из geo, где IP blocked: revision всё равно создаётся (privacy > geo filter)

## Test data suggestions

```
Input:
  From: test-client@example.com
  To: project@inbox.product
  Subject: Test
  Body: Test body

Pre-state:
  Project "Test-P" with client_emails=[test-client@example.com], 
  status=in-progress, owner=TestFreelancer

Post-state (assertions):
  Revision exists with project_id=Test-P.id, body="Test body", 
  status="incoming"
```
```

**Anti-example:**
```
## Criteria
Система корректно обрабатывает email                   ❌ не falsifiable
Revision создаётся                                      ❌ без условий и assertions
```

## Common Mistakes

1. **VC = дубликат SC.** VC не повторяет SC; VC формализует проверки.
2. **Отсутствие negative assertions.** Без них тесты упускают side effects.
3. **Non-testable VC.** «Пользователь счастлив» — не VC. VC должен быть measurable.
4. **VC только для main flow.** Alt и error тоже нуждаются в VC (обычно меньше деталей, но есть).
5. **VC без ссылок на BR/LC.** «Что-то должно случиться» — не обосновано.

## Related Skills

- [`vc-derivation.md`](../../../skills/product/vc-derivation.md)
- `vc-coverage-check.md` (planned, V-07 implementation; partial coverage via [`validation-runner.md`](../../../skills/product/validation-runner.md))
