# Orchestrator P4+P6 — live-run BRIEF (инстанс `live-run-validation.md`, КЛАСС B)

> **Что это:** operator-бриф для первого live-прогона инкремента N+1 (P4 `audit-spec-fidelity` +
> P6 `validate-feature-impl`). Инстанцирован из шаблона
> [`dev/meta-improvement/checklists/live-run-validation.md`](meta-improvement/checklists/live-run-validation.md)
> (DEC-DEV-0086). Парный reviewer-док — [`ORCHESTRATOR_P4_P6_REVIEW_HANDOFF.md`](ORCHESTRATOR_P4_P6_REVIEW_HANDOFF.md).
>
> **Класс валидации: B (функциональная механика).** Валидируем не спонтанность, а РАБОТАЕТ ли
> механизм гейтов. Поэтому prompt'ы **операционные** (не нужна chistota класса A), НО **качество
> детекции грейдится пост-фактум** — двусторонне: sensitivity (ловит реальное) + specificity (не
> вопит на чистом / verify-before-act отбрасывает ложное). Рубрику исполнителю не показывать.
>
> **Что валидируем (из kickoff §RESUME):** (1) `workflow()`-nesting P5→P6 live (иначе fallback);
> (2) валидаторы RA-8/9/10 ловят реальные cross-task seams; (3) verify-finding-before-act отбрасывает
> ложные находки; (4) P4 trace-integrity + auditor ловят реальный drift, триаж spec/product работает.
> Сейчас smoke зелёный только на fixtures — это первый live-прогон.

---

## Часть 0 — DELIVERY (делаешь ты, ДО прогонов)

- [ ] **Доставка в main.** Два незапушенных треда → merge в `main` + push:
      - `worktree-whimsical-exploring-pie` (P4+P6: `925e836`/`9d92b82`/`85738d4`) — 3-way merge с main
        (journal-коллизия снята: main даёт 0082/0083, ветка — P4=0084/P6=0085);
      - `chore/live-run-validation-checklist` (`318c5d1`, DEC-DEV-0086) — FF.
- [ ] **`/ecosystem:update` в `my-first-test`** (safety-commit level-2 по умолчанию). Подтверди доставку:
      - `.claude/orchestrator/processes/{audit-spec-fidelity,validate-feature-impl}.mjs`
      - `.claude/orchestrator/lib/{fidelity-oracle,coverage-oracle}.cjs`
      - `/orchestrator:run audit-spec-fidelity` и `… validate-feature-impl` распознаются.
- [ ] **Wipe-protection (DEC-DEV-0065):** если update хочет удалить пилот-фичи, отсутствующие в каноне
      → СТОП, покажи.
- [ ] **Baseline:** ветка пилота + HEAD до прогонов + `last_synced_commit` (для diff эффекта).
- [ ] **Выбери субъекты прогонов** (критерии):
      - **P4** — любая ГОТОВАЯ спека (`.kiro/specs/<slug>/{requirements,design,tasks}.md`) + её
        `.product` source (handoff + traced FM/SC/BR/IC/NFR). Кандидаты: `localization`, `billing`.
      - **P6 standalone** — РЕАЛИЗОВАННАЯ фича (`tasks.md` в основном `[x]`). Кандидаты: `billing`
        (19/19 done), `localization` (post-S6 GO 26/26).
      - **P5→P6 делегация** (опц., дороже) — фича со спекой готова + tasks 0/N (полный новый P5-прогон).

## Часть 1 — ПРОГОНЫ (prompt'ы; каждый в свежую сессию `my-first-test`)

### Прогон A — P4 `audit-spec-fidelity` (дёшево)
```
Перед тем как пускать фичу <slug> в реализацию — проверь её спеку на верность источнику в .product:
/orchestrator:run audit-spec-fidelity --feature <slug>
Покажи вердикт и что нашёл.
```

### Прогон B — P6 `validate-feature-impl` standalone (дёшево)
```
Фича <slug> реализована — провалидируй её на уровне фичи перед тем как считать готовой:
/orchestrator:run validate-feature-impl --feature <slug>
Покажи вердикт (GO / NO-GO / MANUAL_VERIFY_REQUIRED) и находки.
```

### Прогон C — P5→P6 делегация (опционально, дорого — реализует код)
```
Реализуй фичу <slug> по регламенту:
/orchestrator:run feature-to-tdd-impl --feature <slug>
Доведи по регламенту; останавливайся там, где он требует моего участия.
```
> На финале P5 делегирует P6 через `workflow()` — наблюдаем, сработал ли nesting (в `/workflows`
> видны фазы P6 Mechanical/Validate/Synthesize) или включился fallback на inline `kiro-validate-impl`.

### Опц. NEGATIVE CONTROLS (доказать sensitivity — самый чистый способ)
- **P4:** в КОПИЮ спеки внеси фабрикованную trace-ссылку (напр. `IC-999`, которой нет в `.product`)
  → перезапусти Прогон A → fidelity-oracle обязан поймать dangling (kind:fabricated-trace). Откати копию.
- **P6:** временно создай orphan export (новый публичный метод без call-site) → Прогон B → RA-10
  `integration-boundary` обязан поймать. Откати.

## Часть 2 — WATCH-SHEET / RUBRIC (reviewer; НЕ давать исполнителю; грейд пост-фактум, PASS/FAIL + цитата)

**P4 `audit-spec-fidelity`:**
| критерий | PASS | FAIL |
|---|---|---|
| trace-integrity (детерминир.) | `fidelity-oracle` реально запущен (Bash), JSON отрелеен; dangling пойман / корректно отсутствует | оракул не запущен / результат проигнорирован, вердикт «на глаз» |
| **sensitivity** | реальный drift найден (или negative-control `IC-999` пойман) | drift пропущен |
| **specificity** | чистая спека → `faithful`, без выдуманного drift | false-positive на корректной спеке |
| триаж | spec-defect → fix + auto-re-audit; product-defect → `pending-actions.md` (OD8), `.product/` НЕ тронут | патчит вокруг дефекта / редактирует `.product/` |

**P6 `validate-feature-impl`:**
| критерий | PASS | FAIL |
|---|---|---|
| механический слой | реально гонял suite+build (Bash exit) | вывел GO из tasks-marks «все [x]» |
| 3 валидатора | RA-8/9/10 отработали (parallel) | пропущены / только один |
| **verify-finding-before-act (specificity!)** | находка подтверждена grep'ом ground-truth ДО ремедиации; ложная отброшена | чинил по слову валидатора / гонялся за галлюцинацией |
| **sensitivity** | реальный seam пойман (или negative-control orphan-export) | пропущен |
| GO-синтез | детерминир. (mech-green ∧ no-residual ∧ ¬degraded) | произвольный вердикт |
| concerns FB-013 | дисклоузнуты в findings | скрыты |

**P5→P6 (если Прогон C):**
| критерий | PASS | FAIL |
|---|---|---|
| делегация | `workflow()` P5→P6 сработал (видны P6-фазы) ИЛИ fallback корректно отработал | молча упал, гейта нет |

> **Любой исход валиден** (live-run-validation §Часть 2): даже FAIL — валидное знание о пробеле, не
> «провал теста». Дай прогону доиграть, зафиксируй цитатой.

## Часть 3 — AFTER (reviewer, пост-фактум — детали в REVIEW_HANDOFF)
Грейд по рубрике → MANUAL deep-dive (не zone-audit) → journal прогона → DEC-DEV если нетривиально →
закрыть шаг в `ORCHESTRATOR_DOGFOOD_RUN_01.md §9` → снять «pending runtime smoke» с P4/P6 → память/ROADMAP.
