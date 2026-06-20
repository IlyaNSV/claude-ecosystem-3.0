# Orchestrator — Build Kickoff: P4 `audit-spec-fidelity` + full P6 `validate-feature-impl`

> **Статус:** `kickoff` (2026-06-20). D7 phase-kickoff для **второго implementation-инкремента** модуля
> (Phase N+1 per `ORCHESTRATOR_BUILD_KICKOFF.md` §5: «после P5 — P4/P6-расширение»). S6 закрыт (DEC-DEV-0081).
> **Источник дизайна:** SPEC §3.2 (P4/P6) + §3.3 (RA-5, RA-8/9/10); RUN_01 §1 (E3/E5), §4 (роли), §5 (P0-1/P1-2/P1-5).
> **Архитектура установлена** (S5a/S5b): Workflow `.mjs` + lifted-kiro + детерминир. helper через `agent()+Bash`;
> harness-ограничение D.1 (нет FS/Date.now; роли inline-const; входы через `args`; стампы вне скрипта).

---

## Что строим

### P4 `audit-spec-fidelity` — pre-impl фиделити-гейт (RUN_01 E3 / RA-5 / P1-2)
Между P3 (специ сгенерированы) и P5 (impl): аудит `.kiro/specs/<slug>/{requirements,design,tasks}.md`
против **источника `.product`** (handoff + FM/SC/BR/IC/NFR). Это **семантическая фиделити** — отлична от:
- **C-07** (adapter content-fidelity: handoff→brief маппинг полей; pre-generation, узко) — уже есть;
- **coverage-oracle** (все source-ids ПРИСУТСТВУЮТ; presence) — уже есть;
- **cross-spec review** (специ согласованы между собой) — работа cc-sdd.

P4 ловит: значение-mismatch (RUN_01: NFR-004/005 backoff vs BR-040), устаревшие event-имена, **фабрикованные
trace-ссылки** (D-1 #501: fictitious IC-013). **Триаж дрейфа → маршрут:**
- `spec-defect` → fix спеки (зона Оркестратора);
- `product-defect` → **route к Product** (канон `.product` сам неверен — это OD8 reverse-канал, P2-2). ⟸ P4 доставляет частичный OD8.

**Два слоя (детерминизм-модель §2):**
- **Детерминир. (Layer-3):** новый `orchestrator/lib/fidelity-oracle.cjs` — **trace-integrity**: все ссылки
  спеки (`IC-\d+`/`BR-\d+`/`SC-\d+`/`NFR-\d+`/`FM-\d+`) ⊆ ground-truth id-набор `.product`. Dangling ref =
  фабрикация/drift (ловит fictitious-trace детерминированно). Переиспользует id-extraction из coverage-oracle.
- **Семантика (Layer-2):** inline-роль `fidelity-auditor` (RA-5) ×N parallel — читает спеку + `.product`-источник,
  репортит drifts + класс (spec/product) + severity.

**P1-2 — auto-re-audit:** после spec-fix → re-audit этой спеки (ремедиация сама вносит drift). Bounded (≤2).

### Full P6 `validate-feature-impl` — feature GO-gate (RUN_01 E5 / RA-8/9/10 / P1-5)
Сейчас P5 Validate-фаза лифтит `kiro-validate-impl` (один агент, advisory). **Full P6:** механический слой
(полный suite + build) + **3 параллельных валидатора** (inline-роли):
- `requirements-coverage` (RA-8) — каждое требование имеет тест/impl;
- `design-alignment` (RA-9) — impl соответствует design-решениям;
- `integration-boundary` (RA-10) — cross-task seams подключены (дефект `/reset` vs `/reset-password` #2050; orphan-export FB-010).

**verify-finding-before-act (P6-ценность):** находка валидатора → grep ground-truth → ремедиация ТОЛЬКО при
подтверждении (не чинить по ложной находке). Bounded ≤3 (как kiro-validate-impl).

---

## Решения (дефолты T1 — veto'абельны; уточняют D.1)

| # | Решение | Дефолт | Уверенность |
|---|---|---|---|
| **D1** | P4 — отдельный процесс или фаза? | **отдельный** `processes/audit-spec-fidelity.mjs` + `/orchestrator:run audit-spec-fidelity [--feature]`; слотится как P5-preflight (wiring позже) | высокая (process-catalog модель) |
| **D2** | P4 детерминир. слой | **новый** `lib/fidelity-oracle.cjs` (trace-integrity), переиспользует id-extraction coverage-oracle | высокая |
| **D3** | Full P6 — где | **отдельный** `processes/validate-feature-impl.mjs`; P5 Validate-фаза **делегирует** через `workflow('validate-feature-impl')` (fallback — текущий inline-лифт, если nesting недоступен live) | средняя — `workflow()`-nesting one-level; fallback страхует |
| **D4** | Роли (fidelity-auditor, 3 валидатора) | **inline-const** в `.mjs` (как S5, per D.1); канон `agents/orchestrator/` — отдельный backlog (реестр ролей) | высокая |

## Scope-дисциплина (что режем)
- **CUT:** P2 консилиум, deploy/rollback (нужны D3/D5), owner-arbitration авто (простое правило consumer-conforms).
- **KEEP:** verify-finding-before-act (P6-ценность), auto-re-audit (P1-2), 3 валидатора (P6 — суть расширения).
- **Реестр ролей `agents/orchestrator/`** — НЕ в этом инкременте (отдельный backlog-item); роли inline.

## Split (incremental-pilot, smoke между)
- **N+1a — P4:** `fidelity-oracle.cjs` (+unit-test) → skill `audit-spec-fidelity.md` → `processes/audit-spec-fidelity.mjs` (inline fidelity-auditor) → `run.md` wiring → smoke (`npm run verify`).
- **N+1b — P6:** `processes/validate-feature-impl.mjs` (mechanical + 3 валидатора + verify-finding) → P5 Validate-фаза делегирует → `run.md` wiring → smoke.
- **D7:** DEC-DEV per sub-phase closure; smoke перед N+1a→N+1b; live-прогон (пилот) — отдельный осознанный заход (не в build-сессии).

## Smoke-план (fixtures, без пилота)
- `fidelity-oracle.cjs` — unit-тест на fixtures: чистая спека (trace-integrity pass) + спека с fictitious-trace (fail) + dangling NFR (fail).
- Оба `.mjs` — `workflow-syntax.smoke.cjs` (harness-диалект парсится) + static-invariant тест (как `concerns-propagation`).
- `npm run verify` exit 0 — гейт перехода.

## Связь с backlog
P4 доставляет **частичный OD8** (product-defect route). После P4/P6 остаётся: S7 detect-leg (#3/#4, гейт субстрата),
durability/multi-feature, полный OD8 reverse-канал, реестр ролей, P7 (нужны D3-runtime), P2.

---

## Статус / RESUME (для следующей сессии)

- ✅ **N+1a — P4 `audit-spec-fidelity` ПОСТРОЕН** (DEC-DEV-0084, 2026-06-20). Файлы: `orchestrator/lib/fidelity-oracle.cjs`
  (+тест 7/7), `orchestrator/processes/audit-spec-fidelity.mjs` (+wiring-тест 7/7), `skills/orchestrator/audit-spec-fidelity.md`,
  `commands/orchestrator/run.md` (P4 вписан), `package.json` (+2). `npm run verify` exit 0. Smoke-гейт N+1a→N+1b пройден.
- ✅ **N+1b — full P6 `validate-feature-impl` ПОСТРОЕН** (DEC-DEV-0085, 2026-06-20). Файлы: `orchestrator/processes/validate-feature-impl.mjs`
  (механический слой suite+build + 3 параллельных inline-валидатора RA-8/9/10 + verify-finding-before-act + bounded ≤3 + детерминир. синтез
  GO/NO-GO/MANUAL_VERIFY_REQUIRED; concerns FB-013 дисклоузятся), `orchestrator/processes/feature-to-tdd-impl.mjs` (Phase 3 Validate перепроведена
  на `workflow('validate-feature-impl')` + fallback на inline `kiro-validate-impl`), `commands/orchestrator/run.md` (P6 wiring), `package.json` (+тест),
  `tests/orchestrator/validate-feature-impl-wiring.test.cjs` (13/13, вкл. P5→P6 делегацию). **`npm run verify` exit 0.** Инкремент N+1 (P4+P6) закрыт.
- ⬜ **СЛЕДУЮЩЕЕ — live-прогон P4+P6 на пилоте** (отдельный осознанный заход; smoke зелёный только на fixtures, НЕ live). Подтвердить:
  (1) `workflow()`-nesting P5→P6 работает live (иначе срабатывает fallback); (2) валидаторы RA-8/9/10 ловят реальные cross-task seams;
  (3) verify-finding-before-act отбрасывает ложные находки. Остальной backlog: S7 detect-leg (#3/#4 DEC-DEV-0081, гейт субстрата),
  полный OD8 reverse-канал, реестр ролей `agents/orchestrator/`, P7 (нужны D3-runtime), P2 (консилиум), durability/multi-feature.
  ⚠ **Перед push:** ветка `worktree-whimsical-exploring-pie` behind `main` — смержить main (journal-коллизия 0082/0083 снята переномеровкой
  P4→0084; при merge вставятся main-записи 0082/0083, далее P4=0084 и P6=0085).
