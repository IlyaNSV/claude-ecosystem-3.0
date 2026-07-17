# RL-* — Release Plan

> **Тип:** release-plan
> **Домен:** D1 — Product Discovery & Planning
> **Review:** 🟡 Standard
> **Cardinality:** Per release (обычно 2–4 активных)
> **Владелец:** Product Module / процесс P1 Planning, шаг D1.8

## Purpose

**Конкретный релиз:** какие фичи, в каком порядке, к какой дате, какие HYP валидирует. Мост между стратегическим roadmap и тактическим handoff в разработку. Основа для создания `tasks.json` у внешнего implementation-инструмента.

## Frontmatter Schema

```yaml
---
id: RL-<NNN>                        # RL-001, RL-002, ...
type: release-plan
title: "Короткое имя релиза"        # "MVP v1", "Templates & onboarding"
status: planned | in-progress | released | cancelled
target_date: YYYY-MM-DD             # плановая дата выпуска
released_on: YYYY-MM-DD             # фактическая (при released)
features: [FM-<NNN>, ...]           # все включённые фичи
hypotheses: [HYP-<NNN>, ...]        # какие гипотезы валидирует
release_number: "v1.0" | "v1.1-beta"
confidence: high | medium | low                  # C2 modification — обязательно
confidence_notes: "string"                       # required если confidence != high
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

## Body Structure

Обязательные секции:

1. **Release purpose.** Зачем этот релиз. На какие HYP направлен.
2. **Success criteria.** Что считаем «релиз удался» — и технически (фичи released), и продуктово (метрики движутся).
3. **Scope — included features.** Таблица FM с priority (MUST/SHOULD) и зависимостями.
4. **Scope — excluded with reason.** Что рассматривали, но отложили (и почему).
5. **Dependencies.** Внешние факторы (платежи, домены, юр. документы).
6. **Risks & mitigations.** Топ-2-3 риска, которые могут сорвать release или исказить валидацию.
7. **Rollout plan.** Как именно выпускаем — internal beta, public launch, invite-only.

Опциональные:

- **Communication plan** (что говорим пользователям)
- **Rollback plan** (как откатим если что-то пойдёт не так)
- **Release DoD** (терминальный предикат релизного цикла — шаблон и правила ниже)

## Release DoD — опциональная body-секция (терминальный предикат релизного цикла)

**Термин.** *Release DoD* (Definition of Done релиза) — полный чеклист подтверждения того,
что релиз выполнен как ожидалось: требования соблюдены, протестированы, stage-контур готов
к миграции на prod. Пока DoD не зелёный — экосистема итеративно работает над релизом по
канонам, а незакрытые пункты образуют очередь следующей итерации. Единственный легитимный
выход из цикла — **зелёный DoD + явная санкция владельца** → `status: released`.
(Решения: DEC-DEV-0216; исполнение R0 — DEC-DEV-0221.)

**Soft-миграция.** Секция опциональна: её отсутствие == прежнее поведение RL 1:1
(канон опциональных полей DEC-DEV-0079). Существующие RL не мигрируются принудительно.

**Ссылочность — жёсткое правило формы.** DoD не пересуживает и не дублирует вердикты:
каждый пункт ссылается на машинный SSOT-источник вердикта. Прямыми (не ссылочными) могут
быть только пункты без машинного источника (санкция владельца, prod-миграционный план).

**Шаблон (6 категорий v0; состав ратифицирован DEC-DEV-0216):**

```markdown
## Release DoD

| # | Категория | Критерий | Источник вердикта (SSOT) | Статус |
|---|---|---|---|---|
| 1 | Требования | Все `features[]` shipped через `/product:impl-sync` (disposition `ready-to-ship` → applied; ни одного `no-evidence` / `gate-not-passed` / `validation-blocked`) | FM frontmatter `impl_sync{}` | ❌ |
| 2 | Тесты | По каждой FM: P6 `result: GO` × `readiness: READY`, `conflicts[] = ∅`; NFR-статусы зелёные | `.claude/orchestrator/runs/<RUN_ID>/run.json` + `runs/ledger.ndjson` | ❌ |
| 3 | Stage | `DEPLOYED × READY` (healthcheck 2xx) на текущем составе релиза; rollback этого контура проверен (`ROLLED_BACK` хотя бы раз) | deploy/rollback `run.json` | ❌ |
| 4 | Целостность | DA release-scope (`/product:da-review RL-NNN`) прогнан; findings разрешены (Act/Defer с решением, не молча); HYP coverage подтверждён; rollout deps закрыты | `.product/.da-findings/RL-NNN-*` | ❌ |
| 5 | Prod-готовность | Гейт production-готовности субстрата пройден; Mock-оговорки (`concerns[]` из P6) отсутствуют или явно приняты владельцем; Rollout/Rollback plan заполнены содержательно (не «просто задеплоить») | гейт-док субстрата + это тело RL | ❌ |
| 6 | Санкция | Owner ratify → `status: released` + `released_on` | владелец (прямой пункт) | ❌ |
```

Статусы пунктов: ✅ выполнен · 🟠 частично / принято с оговоркой · ❌ не выполнен ·
`N/A` — только с письменным обоснованием в той же строке.

**Loop-контракт (ручной на R0).** При каждой проверке каждый ❌/🟠 пункт явно превращается
в элемент очереди следующей итерации (PA-запись или список работ в теле RL). Детерминированный
агрегатор, который красит пункты по SSOT и генерирует отчёт, — этап R1; до его появления
проверка ручная.

**Закон вне чеклиста.** Сам prod-деплой остаётся за autonomy-floor (`prod_deploy` — всегда
человек). Зелёный DoD разрешает миграцию на prod, но не выполняет её.

## Content Rules

- **Фичи из FM, без inline-описаний.** RL ссылается на FM, не переписывает их.
- **Target date реалистичен.** RL — это commitment; задержки переносятся явно, а не молча.
- **Каждая HYP проверяется минимум через 1 фичу.** Если в scope есть HYP без реализующей её фичи — проблема.
- **Rollout plan — часть релиза.** «Просто задеплоили» — не план. Должно быть hoвые пользователи видят изменения.

## Relationships

**Входящие:**
- ← RM (RL — часть sequence в roadmap)
- ← FM-* (features в scope)
- ← HYP-* (что валидируется этим релизом)
- ← MVP (обычно первый RL = MVP)

**Исходящие:**
- → External implementation tool через handoff (каждая FM-* в scope передаётся отдельно)
- → Task tracker (`.planning/tasks.json` через Integrator) — задачи группируются по RL
- → Feedback collection после released (пока manual, в v2 — D5)

**Cascade impact:**
- Смена target_date → уведомление человеку, проверка RM sequence
- Фича выпала из release (became deferred) → проверить, не ломает ли валидацию HYP
- Release → validated HYP → RM update, возможно новая RL

## Review Level: 🟡 Standard

Ассистент составляет план на основе FM и HYP. Человек валидирует scope и даты. Изменения target_date требуют явного approve (а не молчаливого сдвига).

## Lifecycle States

```
planned ──(start work)──▶ in-progress ──(all FM shipped)──▶ released
   │                           │
   └──(scope too big)──┐       └──(scope reduced)──▶ in-progress
                       │
                       └──────────────▶ cancelled (pivot / rethink)
```

- **planned** — скоуп определён, работа не начата
- **in-progress** — хотя бы одна FM в in-progress
- **released** — все MUST фичи released, релиз выпущен в production. Если в body ведётся
  секция **Release DoD** — переход легитимен только при зелёном DoD + явной санкции
  владельца (owner ratify); флип статуса выполняет владелец
- **cancelled** — отменён по стратегическому решению; фичи могут перейти в другой RL

## Examples

**Good:**
```yaml
---
id: RL-001
title: "MVP v1 — workflow для фрилансеров"
status: in-progress
target_date: 2026-07-15
features: [FM-001, FM-003, FM-004, FM-005]
hypotheses: [HYP-001]
release_number: "v1.0"
created: 2026-05-01
updated: 2026-06-15
---

## Release purpose
Первый публичный релиз. Валидирует primary HYP-001 (готовность платить
за централизацию правок). Запускается как free-tier + pay paywall
после 10 проектов.

## Success criteria
**Technical:**
- Все 4 MUST фичи released, smoke-тесты пройдены
- Uptime >= 99% в первые 4 недели

**Product:**
- 300+ зарегистрированных фрилансеров за 4 недели после launch
- 30+ дошли до первого проекта (активация ≥10%)
- На 3-месячной точке измерим conversion freelance → paid для HYP-001

## Scope — included features
| FM | Title                     | Priority | Depends on |
|----|---------------------------|----------|------------|
| FM-005 | Authentication        | MUST     | —          |
| FM-001 | Dashboard             | MUST     | FM-005     |
| FM-003 | Revisions inbox       | MUST     | FM-001     |
| FM-004 | Client export         | MUST     | FM-003     |

## Scope — excluded with reason
- FM-002 Project templates — отложена в RL-002 (SHOULD, не блокирует HYP-001)
- FM-006 Glossary sync — COULD, перенесена в RL-004 (complex, не в MVP)

## Dependencies
- Stripe integration настроена к 2026-06-15 — в срок
- Юридика (условия использования, privacy) — к 2026-07-01

## Risks & mitigations
1. **FM-003 UX сложный** — mitigation: usability тесты с 5 фрилансерами к 2026-06-30
2. **Stripe отказ по geo** — mitigation: параллельно готовим ЮKassa backup
3. **Низкая активация (<10%)** — mitigation: follow-up email на 2-й день через FM-005

## Rollout plan
1. 2026-07-01: internal alpha для 5 фрилансеров из интервью
2. 2026-07-10: invite-only beta на 50 пользователей из Telegram-чата
3. 2026-07-15: public launch на Habr + Telegram posts
4. 2026-07-29: analytics review (day 14 metrics)
```

**Anti-example:**
```
## Scope
- All features                                 ❌ не план
target_date: "когда-нибудь в Q3"              ❌ не конкретно
hypotheses: []                                 ❌ зачем релиз?
```

## Common Mistakes

1. **RL без HYP.** Релиз ради релиза — антипаттерн. Всегда связан с валидацией.
2. **Слишком много MUST в одном RL.** RL с 15 MUST → не release, а программа.
3. **Нереалистичная target_date.** Не считает зависимости (юридика, третьи стороны).
4. **Rollout plan — «просто задеплоить».** Пользователи не узнают о фичах сами.
5. **Cancelled без decision log.** Отмена RL — стратегическое решение, должно быть фиксировано.
6. **`released` при незелёном Release DoD (если секция ведётся).** DoD — терминальный предикат: флип статуса без зелёного чеклиста и санкции владельца обесценивает механизм. Смежный анти-паттерн — DoD, пересуживающий вердикты (P6/деплой/DA) вместо ссылок на их SSOT-источники.

## Related Skills

- [`release-planning.md`](../../../skills/product/release-planning.md)
- `release-scope-negotiation.md` (planned)
