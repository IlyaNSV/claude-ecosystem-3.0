# Patch Cut Checklist

> **Назначение:** ≤15-мин ритуал нарезки версии из накопленного `CHANGELOG.md [Unreleased]`.
> Превращает «корзину» накопленных изменений в именованный патч/minor + тег, готовый к
> поставке в пилот через `/ecosystem:update`. Codified DEC-DEV-0079 (follow-up).
>
> **Когда запускать (каденс — по событию):** перед тем как накопленное должно доехать в
> пилот — т.е. **до запуска `/ecosystem:update` в продуктовом проекте** / перед live-прогоном.
> НЕ по расписанию и не «N фич». Нет события доставки — нет нужды резать (пустых cut'ов не
> делаем).
>
> **Owner:** developer (you). Manual checklist (D7 §3 mechanism hierarchy — checklist = default).
>
> **Связанное:** `phase-closure.md` (фазовая гигиена; CHANGELOG-чекпоинт там же),
> `reference_pmo_canonical_counts` memory (count-drift sweep), `commands/ecosystem/update.md`
> (механизм доставки).

---

## Модель доставки (прочитай один раз — снимает главное недопонимание)

`/ecosystem:update` синкает ecosystem-зоны из **upstream HEAD ветки `main`**, а НЕ из тега
версии. Практический вывод:

- Всё, что **смёржено в `main`**, доезжает в пилот при следующем `update` — независимо от
  того, нарезана версия или нет.
- **Cut версии — это bundling + gates + ярлык** (CHANGELOG-секция, count-sweep, тег,
  `ecosystem_version`-штамп), **не gate доставки.** Он нужен, чтобы поставка была
  *описанной и консистентной*, а не чтобы «разрешить» доставку.
- Поэтому порядок: **сначала cut смёржен в `main`**, потом `update` в пилоте. Резать на
  ветке, которая ещё не в `main`, и ждать доставки — бессмысленно.

---

## Контракт накопления (предусловие cut'а)

Каждое смёрженное изменение уже должно нести запись в `CHANGELOG.md [Unreleased]`
(consumer-facing, под `### Added | Fixed | Modified`) + при наличии rationale — запись
`DEC-DEV-NNNN` в `DEV_JOURNAL.md`. Cut НЕ занимается восстановлением пропущенных записей —
если `[Unreleased]` неполон, сначала допиши его (это разработческая дисциплина, не работа
cut-ритуала). См. CONVENTIONS §11.

---

## Pre-flight

- [ ] `CHANGELOG.md [Unreleased]` непуст и отражает все изменения с прошлого cut'а
- [ ] Все изменения, которые входят в патч, **смёржены в `main`** (не висят на ветке)
- [ ] `git status` clean на `main`
- [ ] (если в патче были hook-правки) `phase-closure.md` Step 3 hook-smoke зелёный

Если что-то не выполнено — сначала доведи, потом режь.

---

## Step 1 — Выбор bump (patch vs minor) (≤2 мин)

Semver-ish правило проекта (solo, pre-pilot — backwards-compat не критична, DEC-DEV §6):

| Bump | Когда | Пример |
|---|---|---|
| **patch** `x.y.Z` | багфиксы + аддитивные opt-in фичи, не меняющие существующее поведение | `1.5.0 → 1.5.1` |
| **minor** `x.Y.0` | заметный новый модуль/способность или связка фич («accumulated since x.(Y-1).0») | `1.4.0 → 1.5.0` |

Сомневаешься — `patch`. Накопленное обычно само подсказывает (один новый модуль → minor;
горсть аддитивных фич/фиксов → patch).

---

## Step 2 — Нарезка CHANGELOG (≤5 мин)

1. Переименуй `## [Unreleased]` → `## [X.Y.Z] — YYYY-MM-DD`.
2. Добавь **одну строку-сводку** патча сверху секции (как у `[1.5.0]`: «accumulated since
   X.(Y-1).0: …» с перечнем DEC-DEV). Это release-нота для consumer'а.
3. Над ней создай **свежий пустой** скелет:
   ```markdown
   ## [Unreleased]

   ### Added

   ### Fixed

   ---
   ```
4. **Сохрани deferred-пометки** внутри записей (например «runtime smoke deferred per Phase 5
   precedent») — они переносятся в release-ноту, не теряются.

### Pass / Fail

- Pass: первая `## [версия]` в CHANGELOG = только что нарезанная; `[Unreleased]` пуст и
  готов копить дальше.
- Fail: запись «висит» без даты / `[Unreleased]` не пересоздан → исправь (иначе следующий
  cut слипнется с этим).

### Ротация (CONVENTIONS §5.1, DEC-DEV-0185)

- [ ] Если `CHANGELOG.md` >~150 КБ — релизы старше текущего квартала ДОСЛОВНО →
  `dev/_archive/changelog/CHANGELOG_<диапазон>.md` + pointer-строка на месте среза.
  `[Unreleased]`, релизы текущего квартала и footer-секции остаются живыми.
- [ ] Заодно глянь `DEV_JOURNAL.md`: >~250 КБ или >~50 записей → самый старый полный месяц
  → `dev/_archive/journal/` (текущий + предыдущий месяц всегда остаются).

---

## Step 3 — ROADMAP + статус-маркеры (≤3 мин)

1. В `ROADMAP.md` маркеры `(Unreleased)` → `(X.Y.Z)` у вошедших пунктов.
2. `ROADMAP.md § «Где мы сейчас»` строка «Последнее обновление» / статус — обнови, если cut
   двигает снапшот (ROADMAP — SSOT статуса; README/CLAUDE — указатели, см. `CLAUDE.md`).

---

## Step 4 — Count-drift sweep (≤3 мин)

Если патч менял число **артефактов / правил валидации / команд / хуков / скиллов / агентов** —
запусти **детерминированный реконсилятор** (DEC-DEV-0083; расширен до 6 видов — DEC-DEV-0220):

```bash
node dev/meta-improvement/scripts/check-counts.js
```

Он берёт ground-truth **с диска** (артефакты — из `docs/pmo/artifacts/`, правила — из SSOT
`validation.md`, остальные — счётом живых файлов и `manifest.yaml`) и флагует все live-доки, где
число разъехалось. **Зелёный = consistent.** Какие именно виды блокируют и какие тумблеры есть —
**не переписывай сюда, спроси у скрипта**: шапка `check-counts.js` + `--json` (поле
`extended_mode`) — единственный SSOT режима. Этот же скрипт запускается блокирующим `commit-msg`
gate'ом — красный `check-counts` блокирует cut-коммит. Если что-то нашлось — синхронизируй
(memory `reference_pmo_canonical_counts` — список носителей). Самый частый источник дрейфа при cut'е.

- Если патч счётчики **не** трогал (как DEC-DEV-0079 — config-блок, не артефакт) — отметь
  «N/A» и иди дальше.

---

## Step 5 — Tag + push (≤2 мин)

```bash
git commit -am "chore(release): cut vX.Y.Z"        # CHANGELOG + ROADMAP cut
git tag vX.Y.Z
git push origin main --tags
```

- Тег — на коммите cut'а в `main`.
- `ecosystem_version` в пилотах **перештампуется** из первой `[X.Y.Z]` CHANGELOG при
  ближайшем `bootstrap` (Step 7) или `update` (Step 5c re-stamp — DEC-DEV-0083; до 0082
  `update` его НЕ трогал → был stale-by-default). Re-stamp surgical: только эта строка
  `product.yaml`, остальные поля нетронуты.

### Pass / Fail

- Pass: `git tag` показывает `vX.Y.Z`; `main` запушен.
- Fail: тег на ветке вместо `main` → перетегируй после мёржа (доставка идёт с `main`).

---

## Step 6 — Доставка в пилот (по событию, ради которого резали)

В продуктовом проекте:

```
/ecosystem:update          # тянет HEAD main (с нарезанным патчем); preserve user zone
```

Затем (опц.) verify:

```bash
bash dev/meta-improvement/scripts/verify-update.sh    # или .ps1 на Windows
```

- Проверь, что новые файлы патча появились в `.claude/` пилота (allowlist-зоны:
  `commands/skills/agents/hooks/orchestrator/docs/templates/adapters` + корневые ссылки).
- Если в патче была **миграция** (новые поля/одноразовый backfill — как `product_class`
  DEC-DEV-0079) — выполни migration-промпт из CHANGELOG-записи патча.

---

## Closing

- Cut — это `chore(release):`, не `feat`/`fix` (он ничего не реализует, только нарезает).
- Если cut вскрыл, что `[Unreleased]` был неполон/дрейфил — допиши запись + (если значимо)
  DEC-DEV; cut не «прячет» пропущенное.
- DEV_JOURNAL-запись на сам cut **не нужна** (рутинный ритуал), кроме случая, когда cut
  сопровождался нетривиальным решением (напр. смена version-политики).
