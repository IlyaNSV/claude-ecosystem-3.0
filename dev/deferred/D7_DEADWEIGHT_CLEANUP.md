# D7 Deadweight Cleanup — оставить только работающее и используемое

> ✅ **STATUS: EXECUTED 2026-07-11** — исполнен как полоса A repo-wide deadweight-sweep
> (DEC-DEV-0185): use-audit всех ~75 D7-механизмов многоагентной инспекцией
> (inventory → classify → adversarial verify). **Вердикт: все механизмы живые (KEEP)** —
> scripts вызываются verify-цепью/командами, hooks зарегистрированы, checklists/patterns
> цитируются живыми доками; ни одного мёртвого скрипта не найдено. Отработано по гипотезам
> таблицы ниже: audit-reports ротированы (41 → `_archive/audit-reports/`, clean>30d удалены
> по retention), audit-index ротация §Notes впервые исполнена; frozen-секции SPEC.md →
> компактация в PR-3 sweep'а; refinement-трекеры §10 — признаны COMPACT-таргетами там же.
> Файл сохранён как исполненный work-order (историческая ценность метода use-audit).
>
> Изначально: 🅀 QUEUED (зарегистрировано 2026-06-19), запуск **после** D7 process-hardening
> (spine + блокирующий gate + полная уборка дрейфа, DEC-DEV-0083) в `main`. Это **не**
> bring-forward по внешнему триггеру — чистая sequencing-зависимость.
>
> **Owner:** developer + Claude (D7 self-maintenance).
>
> **Почему ПОСЛЕ, а не сейчас:** текущий хардненинг реорганизует и де-дрейфит D7, а новый
> process-spine сам становится списком того, что реально референсится. Прунить надо по уже
> прибранному состоянию — иначе либо (а) выкинем механизм, на который spine только что сослался,
> либо (б) зря де-дрейфим документ, который тут же удаляем.
>
> **Связанное:** аудит D7 от 2026-06-19 (3-agent, в этой сессии); `dev/meta-improvement/SPEC.md`
> §5 anti-pattern #3 «Documentation rot of D7 itself» — северная звезда этой уборки.

---

## Цель

Привести D7 (`dev/meta-improvement/`) к множеству механизмов, которые **(1) работают** и **(2)
реально используются**. Лишнее — заархивировать (если есть историческая ценность) или удалить
(если это дубль/мёртвый/никогда-не-вызывавшийся артефакт). НЕ рефакторинг ради красоты — удаление
балласта, который повышает стоимость поддержки и риск doc-rot.

---

## Метод — use-audit на каждый механизм

D7-аудит 2026-06-19 инвентаризировал ~21 механизм (checklists, patterns, skills, scripts, hooks,
Session Audit v2 subsystem). Для **каждого** собрать evidence-of-use и классифицировать
**keep / merge / archive / delete**:

**Критерии «реально используется»** (нужно ≥1 сильный сигнал, иначе кандидат на cut):
- [ ] Референсится из `CLAUDE.md` / нового process-spine / другого живого checklist'а?
- [ ] Вызывался в истории (`git log -p` упоминания, commit-trailers, прогоны в audit-reports)?
- [ ] Хук — реально срабатывал (а не структурный no-op без `.product/`)?
- [ ] Поддерживается (а не frozen-snapshot / stale-tracker)?
- [ ] Если дублирует другой механизм — есть ли причина держать обе копии?

---

## Кандидаты в балласт (гипотезы из аудита — верифицировать перед резом, НЕ пред-решено)

| Кандидат | Сигнал из аудита | Вероятная диспозиция |
|---|---|---|
| Frozen-секции `SPEC.md` (§6 open-questions, §2.2 «DEC-DEV 0001-0014», §7) | self-declared snapshot 2026-04-27; разрешено в CONVENTIONS | archive/trim → указатель на CONVENTIONS+CHANGELOG |
| Refinement-трекеры §10 (`phase-closure.md:363`, `phase-kickoff.md:241`) | обрываются на Phase 4, репо на 1.6.0 — не ведутся | delete-or-pointer (заменить на «ведётся в DEV_JOURNAL») |
| `audit-watch` (checklist + `audit-watch.js`) | Task Scheduler «не подключён»; полу-ручной `/loop` | keep-if-used / иначе archive |
| Session Audit v2 sub-части | тяжёлый subsystem; проверить, что прогоняется живьём, а не один раз | keep core / archive неиспользуемое |
| Patterns, которые никто не цитирует | 6 patterns; часть может быть write-once | keep cited / archive uncited |
| Scripts, которые никогда не вызывались | `scripts/` инвентарь | delete dead |
| Дублирующие секции checklist'ов | CHANGELOG/hook-smoke/count/memory/drift в 2-3 ритуалах | dedupe (после §9 текущей уборки — свериться, не осталось ли остатка) |

> ⚠️ Это **гипотезы**. Прежде чем удалять что-либо — подтвердить отсутствие использования
> эмпирически. «Выглядит мёртвым» ≠ «мёртв»: cuttable-scope-discipline применять и к самой уборке.

---

## Правила диспозиции

- **Archive-not-delete по умолчанию** для всего с историч. ценностью → `dev/_archive/` (сохранить
  audit trail; precedent — `dev/_archive/phase-<N>/`, `_archive/session-audit-v2/`).
- **Hard-delete только** для истинных дублей / мёртвых / никогда-не-вызывавшихся файлов без
  историч. ценности.
- **Не трогать** то, на что ссылается новый process-spine или активный gate (по определению «used»).
- Сверять каждое удаление с тем, что новый `process-gate.js` / `check-counts.js` не зависят от него.

---

## Process-обязательства самой уборки

- **DEC-DEV-запись** (assigned at execution; ≥0083) — это scope/architecture-решение (что выкинули
  и почему): trigger «решили cut/skip часть» из CLAUDE.md §1.
- **Dev-only** — `dev/` не доезжает в пользовательские проекты → CHANGELOG-запись **не нужна**
  (кроме случая, если уборка заденет consumer-facing артефакт).
- После — verify пройти по `phase-closure.md` Step 1 (spec-drift-sweep: убедиться, что удаление не
  оставило висячих ссылок) + новый `check-counts.js`.

---

## Sequencing-триггер (когда снять с QUEUED)

✅ Текущий D7 process-hardening (DEC-DEV-0083: spine + gate + drift-fix) **смёржен в `main`**.

## Output

Таблица **keep / cut / merge / archive** по каждому из ~21 механизма + исполнение + DEC-DEV-запись
с lessons.
