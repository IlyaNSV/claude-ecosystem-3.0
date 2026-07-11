# Tier 2 — Documentation Reform Plan

> **Назначение:** план реализации Tier 2 реформы документации (продолжение DEC-DEV-0054 / Tier 1). Tier 2 = standing-механизмы (tooling, индексы, enforcement), отделённые от one-time Tier 1.
> **Статус:** ⏳ gated — НЕ стартует по расписанию, только по триггеру-доказательству (см. GATE ниже).
> **Источник:** multi-agent doc audit + 3 adversarial-линзы (DEC-DEV-0054). Поправки линз вшиты в каждый item.
> **Предшественник:** Tier 1 — PR #18 / DEC-DEV-0054 (status pointer-collapse + docs/MAP.md + HOME.md + archive PHASE_5_READINESS).

---

## Управляющий принцип: gate на adherence, не на календарь

Самый важный вывод overhead-линзы: у проекта ритуалы скипаются ~50% (доказано stale README + un-archived PHASE_5_READINESS + пустые строки Phase 5/6 в refinement-tracker). Tier 2 — это **standing-обязательства**, поэтому он не запускается «потому что пора»:

> **GATE:** прожить 1-2 следующих закрытия (фаза/патч). Если README/CLAUDE остались pointer-only (статус не всплыл обратно прозой) — Tier 1 прижился, tooling оправдан. Если pointer-режим уже сломали — сначала чинить дисциплину (T1 enforcement); индекс/генераторы бессмысленны на эродирующем фундаменте.

Принцип reversibility: каждый item — отдельный коммит, оставляющий дерево link-clean; логировать как **отдельные** DEC-DEV entries (не один squash).

---

## T1 — Enforcement-guard · effort S · **делать первым (defends Tier 1)**

**Триггер:** сразу после merge PR #18.
**Почему не чеклист:** отклонённый governor был 7-м блоком в `phase-closure.md` — скипался бы вместе с остальными (которые уже скипаются). Нужна проверка, которая **орёт**, а не пункт «не забудь».

**Шаги:**
1. `dev/meta-improvement/scripts/check-doc-coherence.{sh,ps1}` (dual — env win32/PowerShell): grep утверждает, что `README.md:5` и `CLAUDE.md` «Где мы сейчас» содержат pointer-строку на `ROADMAP.md#где-мы-сейчас` и **НЕ** содержат статус-прозу (`Phase \d shipped`, `v1\.\d+ —`). Exit≠0 при регрессе.
2. Апгрейд **существующего Step 1** `phase-closure.md` на вызов скрипта (не append нового блока).
3. Запускать **и на patch-закрытиях** — патчи (1.3.3/1.3.4/1.3.5) были более частым источником drift'а, чем фазы.

**Риск:** низкий. **Зависимости:** —. **Лог:** DEC-DEV отдельный.

---

## T2 — dev/deferred/ bucket (отложенная часть item 4) · effort M

**Триггер:** независим от GATE (one-time move, не standing-механизм). Делать как **один атомарный коммит**.

**Шаги:**
1. `mkdir dev/deferred/`; `git mv` трио вместе: `PHASE_D_DOCS_WIKI_READINESS.md`, `PHASE_D_IMPLEMENTATION_PLAN.md`, `wiki-design.md`. Взаимные ссылки трио переживут (двигаются вместе).
2. Патчить live-ссылки **в том же коммите** (карта собрана при Tier 1 discovery):

   | Файл | Что менять |
   |---|---|
   | `CLAUDE.md` | readiness-list: `dev/PHASE_D_DOCS_WIKI_READINESS.md` → `dev/deferred/...` |
   | `ROADMAP.md` (~стр. 103, Phase D блок) | 3 пути → `dev/deferred/...` |
   | `v1_1_backlog.md` | строки 408/410/421/422/423 |
   | `../_archive/plans/LOCAL_DOCS_POLISH_PLAN.md` | relative-links 9/38/39/269/286-288 → `deferred/...` |

   `wiki-design.md:813` уже указывает на `_archive/phase-5/` (пропатчено в Tier 1).
3. Перед коммитом — `grep -rl` по именам файлов (исключая `_archive/`, audit-reports, append-only history), убедиться что не осталось живых битых ссылок.
4. `dev/deferred/INDEX.md` — **тонкий указатель** на `v1_1_backlog.md` (список `<scope> — see v1_1_backlog.md §X — trigger: <одна строка>`), **НЕ** параллельная копия триггеров (иначе 4-е место для рассинхрона — self-ref-линза).
5. Добавить `dev/deferred/` в **CONVENTIONS §5.1** (single owner lifecycle-схемы).

**НЕ делать:** `dev/active/` — каждую фазу гонять next-phase readiness in/out = recurring overhead, против binding constraint. Корень `dev/` = «active by default».

**Риск:** средний (relative-link web — это был blocker migration-линзы). **Зависимости:** —. **Лог:** DEC-DEV отдельный.

---

## T3 — DEV_JOURNAL навигабельность · effort M · **gated**

**Триггер:** GATE пройден И/ИЛИ журнал ощутимо болит. Сейчас 4520 строк — навигабельно с индексом; пагинацию/split НЕ делать до ~15-30k (premature, cross-file friction).

**Шаги (с поправками всех трёх линз):**
1. Индекс в **отдельном файле** `dev/meta-improvement/DEV_JOURNAL_INDEX.md` (НЕ инлайн наверху журнала — инлайн ToC ложно матчит `phase-closure-reminder.js`, который сканирует DEV_JOURNAL на closure-записи → подавит будущий reminder).
2. Генератор переиспользует **существующий идиом** `scripts/audit-index.js` (sentinel-region `<!-- ... -->` + node regen), а не новый one-off скрипт. Ship **dual** `journal-index.js` + `.ps1` (конвенция репо: `capture-pilot-state.{sh,ps1}`, `verify-update.{sh,ps1}`).
3. Якоря: **GitHub auto-slug** из существующих `## DEC-DEV-NNNN` заголовков. **Не** вводить `{#id}` — GitHub его игнорирует (404 для downstream-пилотов), плюс half-anchored state — сам по себе drift.
4. Numbering-collision (корень — параллельные same-day сессии, DEC-DEV-0050): либо одна строка политики «inline-renumber on conflict» в `CONVENTIONS.md`, либо **pre-commit grep** на дубль `## DEC-DEV-NNNN`. Чеклист-строка от race не спасает (не защищает concurrent-сессию, которая её не читает).

**Риск:** средний (hook false-match — отсюда отдельный файл индекса). **Зависимости:** GATE. **Лог:** DEC-DEV отдельный.

---

## T4 — Worktree reconciliation · effort S · **hygiene, до следующего merge**

**Триггер:** перед слиянием любой из ~10 stale-веток в `.claude/worktrees/`.
**Проблема:** они несут старые status-блоки (`v1.3.x` / «Next: Phase 5») — при merge/rebase воскресят triple-declaration, убитую в Tier 1.
**Шаги:** инвентаризировать 10 worktrees (живые/мёртвые); prune отмершие; живые — rebase на post-reform `main`, затем re-collapse статуса при конфликте.
**Риск:** низкий. **Зависимости:** PR #18 смержен.

---

## T5 — CHANGELOG↔DEC-DEV backfill · effort S · minor

**Что:** backfill DEC-DEV-цитат в заголовки патч-серии 1.3.3/1.3.4/1.3.5 — downstream-пилот (`my-first-test` / DEC-INT-0005) ходит именно по этим release notes. Кодифицировать существующую де-факто конвенцию одной строкой в таблице CLAUDE.md (CHANGELOG-vs-JOURNAL).
**Замечание:** это документирование текущей практики, не новая ценность — не раздувать восприятие объёма.
**Риск:** низкий. **Зависимости:** —.

---

## (НЕ Tier 2) Canonical-sweep — monitored, не scheduled

Item 3 (severity vocab / NFR-when-required / adaptive-depth DA / environment_tiers) остаётся **условным**: discovery показал principled separation без наблюдаемого дрейфа. Конвертировать в pointers **только** при появлении реального дрейфа между копиями. Карта канонических домов — в DEC-DEV-0054. **Не планировать как работу.**

---

## Рекомендованный порядок

```
merge PR #18
   ├─▶ T1 (enforcement-guard)   защищает сделанное
   ├─▶ T2 (dev/deferred bucket)  one-time, независимо
   └─▶ T4 (worktrees)            до следующего merge
        │
   [GATE: 1-2 закрытия — pointer-режим держится?]
        │
        ▼
   T3 (journal index)  ·  T5 (changelog backfill)
```

**Суммарно:** T1(S) + T2(M) + T3(M) + T4(S) + T5(S). T3 сознательно за GATE.
