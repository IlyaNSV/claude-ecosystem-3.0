# Pilot Session Runbook — Блок 2 (Track V: Vision Epic A+B, live-части)

> **Открой этот файл в сессии пилота** (`C:\Users\pw201\WebstormProjects\my-first-test`) и
> выполняй по шагам. Здесь **только действия и что захватить** — pass-критерии держит ревьюер
> (оцениваю транскрипты post-hoc, executor/reviewer separation). Конкретные файлы/правки ниже
> сверены с ground-truth пилота (оракул + magnitude-роутер прогнаны вживую перед написанием).
>
> **Главное правило на всю сессию:** не подсказывай сабагентам по ходу прогона. Гони как есть,
> захватывай факты, отдавай мне.

- **Пилот:** `C:\Users\pw201\WebstormProjects\my-first-test`, ветка `pre-cc-sdd-pilot`, baseline-тег `pilot-revalidation-baseline`.
- **Что валидируем:** живой путь хук → персоны → команда (детерминированные либы уже dogfood-валидированы соло, DEC-DEV-0099 — здесь только то, что требует живой сессии).

---

## Пред-флайт (уже проверено мной — подтверди глазами, если хочешь)

Всё на месте в пилоте:
- 3 агента-советника: `.claude/agents/product/architect-advisor.md`, `qa-advisor.md`, `.claude/agents/design/ux-advisor.md`;
- zone-стек: `.claude/hooks/product/zone-change-trigger.js` (зарегистрирован PostToolUse в `settings.json`) + `zone-router.cjs` + `zone-routing.yaml`;
- `/product:complete` + `completeness-loop.md` + `completeness-oracle.cjs` (в `lib/`);
- `.product/.pending/advisor-pending.yaml` отсутствует — **ожидаемо** (хук создаст его на первой значимой правке).

> ⚠️ **Ключевой нюанс magnitude-гейта (важно для V-1):** хук считает «значимость» через
> `git diff HEAD` — то есть **против последнего коммита, а не против предыдущего сохранения**.
> Поэтому косметический тест делается на **отдельном чистом файле** (BR-006), а не на том же,
> что уже значимо правили (иначе diff утянет значимую правку и гейт даст «significant»). Все
> целевые файлы ниже сейчас чистые относительно HEAD.

---

## V-1 — zone-хук срабатывает корректно

Цель: значимая правка → хук срабатывает с правильными персонами; косметическая → молчит;
повторная значимая → запись обновляется по id (не двоится). Плюс задеть ux-зону, чтобы для
V-2 в pending были все 3 персоны.

**Перед каждым шагом и после — захвати `.product/.pending/advisor-pending.yaml`** (до/после) и
**что хук вывел в stderr** (сигнал появится в сессии сразу после правки).

### Шаг 1 — значимая правка (зона business-rules → architect + qa)
Файл: **`.product/business-rules/BR-005-confirmation-not-required-for-product-use.md`**
В разделе `## Условия применения` измени тело — например, в конец предложения добавь уточнение:
> Применяется при проверках авторизации на эндпоинтах доступа к функциональности (серверные route guards / гейтинг в интерфейсе)**, включая API-вызовы из мобильного клиента.**

Сохрани. → Захвати: появилась ли запись `BR-005` в `advisor-pending.yaml` (с какими персонами и magnitude) + stderr-сигнал.

### Шаг 2 — косметическая правка (должна НЕ сработать)
Файл: **`.product/business-rules/BR-006-oauth-implies-confirmed.md`** (другой, чистый файл — см. нюанс выше).
Меняй **только** frontmatter-метаданные:
- `updated: 2026-06-02` → `updated: 2026-06-24`
- `version: 2` → `version: 3`

Сохрани. → Захвати: тронулся ли `advisor-pending.yaml` (записи `BR-006` появиться **не должно**) + был ли stderr-сигнал.

### Шаг 3 — повторная значимая правка того же файла (дедуп по id)
Снова **`BR-005`**: измени **другую** строку тела (например, в `## Решения и действия` переформулируй любой буллет). Сохрани.
→ Захвати: запись `BR-005` в `advisor-pending.yaml` должна **обновиться на месте** (одна запись, не две).

### Шаг 4 — задеть ux-зону (для V-2)
Файл: **`.product/mockups/MK-001-authentication-accounts.md`** (зона mockups → ux-advisor).
Измени любую строку **тела** (ниже frontmatter) — например, поправь описание любого экрана/аннотацию. Сохрани.
→ Захвати: появилась ли запись `MK-001` с персоной `ux-advisor`.

> После V-1 в `advisor-pending.yaml` ожидается **2 записи**: `BR-005` (architect-advisor, qa-advisor) и `MK-001` (ux-advisor).

---

## V-2 — персоны спавнятся канонично

Из записей в `advisor-pending.yaml` запусти каждую персону её **canonical `subagent_type`**:
- `architect-advisor`
- `qa-advisor`
- `ux-advisor`

(Спавнить через Agent/Task с соответствующим `subagent_type`.) → Захвати, во что резолвится
каждый тип и что персона вернула.

> Если видишь **«Agent type not found»** — не чини, это громкий **СТОП**: зафиксируй и отдай мне.
> Молчаливого фоллбэка в `general-purpose` быть не должно.

---

## V-3 — completeness-loop + оракул

### Обязательная часть — зрелая фича (быстрый стоп)
```
/product:complete FM-001
```
→ Захвати JSON оракула + completion-report. (FM-001 — зрелая фича.)

### Опциональная часть — loop на намеренном gap-е
> Все 7 фич пилота сейчас полны (оракул `met:true`), поэтому, чтобы увидеть поведение loop на
> неполноте, нужно внести один маленький детектируемый gap. Сверено: эта правка роняет B4.

1. Файл: **`.product/verification/VC-018-glossary-list-search-verification.md`** — поменяй frontmatter `status: active` → `status: draft`. Сохрани.
   *(VC-018 — единственный активный VC, покрывающий SC-013 фичи FM-003, поэтому SC-013 станет непокрытым.)*
2. Запусти:
   ```
   /product:complete FM-003
   ```
   → Захвати JSON оракула (ожидается `met:false`, блокер `B4=fail`, gap `«SC-013 has no active VC»`) + как loop себя ведёт (волны bounded? эскалирует решение или пытается авто-чинить?) + completion-report.
3. **Откати gap:** верни `VC-018` `status: draft → active` (или `git checkout -- .product/verification/VC-018-glossary-list-search-verification.md`).

> Опционально — без этой части V-3 тоже валиден.

---

## После прогона — что отдать мне

Скинь сюда (файлами/путями):
1. **Транскрипты** сессии(й), где гнал V-1/V-2/V-3.
2. **Снимки `advisor-pending.yaml`** до/после каждого шага V-1 + **stderr-сигналы** хука.
3. **Оракул-JSON + completion-report** из V-3 (и обязательной, и опциональной части, если делал).

Я прогоню один проход FB-ledger против критериев брифа
(`ORCHESTRATOR_N2_PILOT_REVALIDATION_BRIEF.md` + `UNIFIED_PILOT_VALIDATION_PLAN.md §3`):
зелёный инкремент → снимаю с «verify-green-only» (live-validated); реальный дефект → DEC-DEV.

## Уборка после прогона
Тестовые правки `.product/` (BR-005, BR-006, MK-001) делались только чтобы дёрнуть хук — можешь
откатить их: `git checkout -- .product/business-rules/BR-005-*.md .product/business-rules/BR-006-*.md .product/mockups/MK-001-*.md` (и VC-018, если ещё не откатил).

> ⚠️ **Каскад MK→SC (live-run находка, FB-LR-17 housekeeping):** правка `MK-001` дёргает хук
> `cascade-check.js` (by-design, DEC-DEV-0080), который дописывает `mockup: MK-001` во **все SC** из
> `scenario_steps` мокапа. Поэтому после V-1.4 в рабочем дереве окажутся ещё и эти SC-файлы — откати и их:
> `git checkout -- .product/scenarios/` (или проверь `git status --short .product/` → должно быть чисто).

---

### Карта целевых файлов (всё сверено на ground-truth)

| Шаг | Файл | Зона → персоны | Тип правки | Ожидание (для self-check) |
|---|---|---|---|---|
| V-1.1 | `business-rules/BR-005-…` | business-rules → architect, qa | значимая (тело) | хук срабатывает, запись BR-005 |
| V-1.2 | `business-rules/BR-006-…` | business-rules | косметическая (`updated`/`version`) | хук **молчит**, записи нет |
| V-1.3 | `business-rules/BR-005-…` | business-rules | значимая (тело) | запись BR-005 обновляется по id |
| V-1.4 | `mockups/MK-001-…` | mockups → ux | значимая (тело) | запись MK-001, персона ux-advisor |
| V-2 | — | architect/qa/ux-advisor | спавн по subagent_type | резолвятся в зарегистрированных агентов |
| V-3 (обяз.) | `/product:complete FM-001` | — | — | оракул `met:true`, быстрый стоп |
| V-3 (опц.) | `verification/VC-018-…` → draft, затем `/product:complete FM-003` | — | gap | оракул `met:false`, B4 fail (SC-013) |
