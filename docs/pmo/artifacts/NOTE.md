# NOTE-* — Unstructured Note

> **Тип:** note
> **Домен:** Cross-cutting (вне D1-D2 структуры)
> **Review:** 🟡 Standard
> **Cardinality:** Per note (без верхней границы)
> **Владелец:** Product Module / любой процесс может создать
> **Введён:** v1.0 (D3 modification — catch-all для idea-capture)

## Purpose

**Свободная forma для всего, что не укладывается в 21 структурированный тип артефактов.** NOTE-* — это:

- Idea-capture (мелькнула мысль во время Discovery — куда записать?)
- Insights (наблюдение из user interview, которое стоит сохранить)
- Deferred decisions (то, что решить позже)
- Open questions (вопросы, не привязанные к конкретному артефакту)
- Cross-references (заметка «при работе над FM-005 проверить взаимодействие с FM-002»)
- Outside-scope discoveries (узнал что-то про market, не в скоуп текущего MR)

**НЕ замена** другим артефактам. Если идея уже сформирована — пиши в нужный тип. NOTE — для того, что **ещё не созрело** или **никогда не созреет**.

## Frontmatter Schema

```yaml
---
id: NOTE-<NNN>
type: note
title: "Короткое имя заметки"
status: draft | active | promoted | archived
related: [<artifact-id>, ...]                # optional, к чему относится
tags: [<tag>, ...]                            # optional, для фильтрации (idea, question, deferred, insight)
confidence: high | medium | low               # обычно low (на то и note)
confidence_notes: "string"                    # required если != high
promoted_to: <ARTIFACT-ID>                    # required если status=promoted
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Минимальный required frontmatter:** `id`, `type`, `title`, `status`, `created`, `updated`, `version`. Остальное опционально.

## Body Structure

**Полностью свободная форма.** Markdown как угодно. Один параграф или развёрнутый разбор — твой выбор.

Рекомендованные (но не обязательные) секции:
- **Контекст** — где и когда возникло
- **Содержание** — собственно мысль/наблюдение/вопрос
- **Возможные действия** — что можно сделать, если решим заняться

## Content Rules

- **Минимум структуры — максимум velocity.** Цель — поймать мысль за 30 секунд, не за 30 минут.
- **Не дублирует существующие артефакты.** Если есть подходящий FM/SC/BR — пиши туда.
- **Promote когда созрело.** NOTE — временное состояние. Когда созреет — конвертируй в полноценный артефакт через `/product:promote-note`.
- **Archive когда не нужно.** Не висит вечно — устаревшее archive-ит, удаляет, или explicitly сохраняет как «historical context».

## Relationships

**Входящие:** none (NOTE-* не выводится из других артефактов).

**Исходящие:** через `related[]` поле — informational links, НЕ dependency. Изменение related артефакта **не каскадит** на NOTE.

**Не участвует в графе зависимостей.** V-* правила (orphan detection, bi-dir refs) на NOTE не применяются.

## Review Level: 🟡 Standard

Approve лёгкий — это draft мысли, не стратегия. Human может сразу сделать active без diligence. Но если NOTE становится тяжёлой (>200 строк, complex content) — это сигнал, что её время promote в structured тип.

## Lifecycle States

```
draft ──(approve)──▶ active ─┬──▶ promoted (через /product:promote-note)
                              ├──▶ archived (deferred indefinitely)
                              └──▶ deleted (manual cleanup)
```

- **draft** — только что записано, ещё не подтверждено
- **active** — подтверждено как актуальная заметка
- **promoted** — конвертировано в structured артефакт; NOTE остаётся как audit trail
- **archived** — деактивировано, но сохранено для истории

**Promote workflow:**

```bash
/product:promote-note NOTE-007 to FM
```

Ассистент:
1. Читает NOTE-007 содержимое
2. Создаёт draft FM-XXX skeleton с derived содержимым
3. Помечает NOTE-007: status=promoted, promoted_to: FM-XXX
4. Запускает P2 Feature Definition flow для нового FM

Поддерживаемые target типы: FM, SC, BR, IC, NFR, HYP. Для остальных — manual conversion.

## Examples

**Good (idea-capture):**
```yaml
---
id: NOTE-007
type: note
title: "Возможность интеграции с Trados Studio"
status: active
related: [SEG-001, FM-003]
tags: [idea, future-feature]
confidence: low
confidence_notes: "Спекуляция; пользовательского запроса пока нет"
created: 2026-04-18
updated: 2026-04-18
version: 1
---

## Контекст
Во время Discovery (D1.3 CA) узнал, что 60% профессиональных переводчиков
SEG-001 используют Trados Studio. Возможно стоит интегрироваться вместо
конкурировать.

## Содержание
- Trados имеет open API
- Translation memory из Trados → revisions context в нашем продукте
- Это могло бы быть USP «work alongside, not replace»

## Возможные действия
- Включить в roadmap как post-MVP экспериментальную фичу
- Поговорить с 2-3 freelancers про их Trados workflow
- Не делать пока не валидирован HYP-001
```

**Good (deferred decision):**
```yaml
---
id: NOTE-012
type: note
title: "Pricing model: subscription vs per-use"
status: active
related: [HYP-001, MVP]
tags: [decision-deferred, business-model]
confidence: low
created: 2026-04-18
updated: 2026-04-18
version: 1
---

## Контекст
В обсуждении HYP-001 поднялся вопрос pricing. Решили отложить до
post-MVP, чтобы не отвлекать от core value validation.

## Содержание
Варианты:
- Subscription: $19/mo flat
- Per-revision: $0.10 per revision processed
- Hybrid: free up to N/mo + $9/mo for unlimited

## Возможные действия
- Решить ПОСЛЕ HYP-001 validated (есть ли willingness to pay вообще?)
- Survey 5 paid pilots про их preference
- Posit для конкретного решения через `/product:promote-note NOTE-012 to BR` 
  (или новый артефакт типа BUSINESS-MODEL — пока такого нет)
```

**Anti-example:**
```yaml
---
id: NOTE-099
type: note
title: "FM-005 will be Authentication"
status: active
created: 2026-04-18
---

Создадим FM-005 для auth.        ❌ это уже structured FM, пиши через /product:feature
```

**Anti-example 2:**
```yaml
---
id: NOTE-100
type: note
title: "Random thoughts"
status: active
---

uihewfjknbsdfk dsfn jksd nfksdj    ❌ NOTE — не sandbox, минимум структуры (хотя бы title и контекст)
```

## Common Mistakes

1. **NOTE как escape от structured artifact.** «Не хочу писать BR — запишу как NOTE». NOTE — для **незрелых** мыслей, не для уклонения.
2. **NOTE накапливаются и не promote.** 30 active NOTE через месяц — сигнал, что либо нужно их prune, либо они должны быть structured уже.
3. **NOTE без context.** «Подумать про X» без указания где, когда, почему — бесполезна через неделю.
4. **NOTE как TODO list.** Если нужен таск-трекер — это вне Ecosystem 3.0 scope. Используй внешний tool (Linear, GitHub Issues, Notion).
5. **NOTE с дублированием artifact data.** «Копия FM-003 на всякий случай» — git history уже есть, не нужно.

## Cleanup mechanism

`/product:cleanup` (V-15 orphan detection — default mode; `--dry-run` для preview; `--pending-hygiene` для full sweep) **не трогает** NOTE-*. Они вне dependency graph и могут быть «orphan» по design (cleanup-detector skill skip'ает NOTE среди root artifacts).

Отдельная команда (future): `/product:notes:cleanup` — предлагает archive/promote/delete для NOTE старше N дней без изменений.

## Related Skills

- `note-capture.md` (в разработке) — quick capture flow
- `note-promote.md` (в разработке) — конверсия в structured artifact
