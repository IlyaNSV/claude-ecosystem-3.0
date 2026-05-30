# Phase 4 — Tech Debt

> **Источник:** [`dev/meta-improvement/audit-reports/phase-4-summary.md`](../meta-improvement/audit-reports/phase-4-summary.md) (агрегация 8 сессий, 2026-05-26; `--phase=4` audit).
>
> **Контекст:** Phase 4 формально закрыта в DEC-DEV-0038. Долг ниже — это **post-closure findings**, выявленные при ретроспективном аудите 8 сессий `my-first-test` (2026-05-21..26). Сами сессии относятся к interim между Phase 4 closure и Phase 5 implementation; формально Phase 4 деливрables они не ломают, но затрагивают артефакты и поведение, заявленное Phase 4.
>
> **Статус позиций:** каждая запись имеет `[OPEN]`, `[FIXED]` или `[DEFERRED]`. При взятии в работу — обновить статус, ссылку на коммит/PR/DEC-DEV.

---

## Как читать

- **Errors for fix** — наблюдаемые регрессии и нарушения P-RULE / canonical spec. Требуют решения (fix / откат / явный defer).
- **Recommendations** — предложенные митигации с пометкой ⚠ **«перепроверить на альтернативы при взятии в работу»**: формулировка из audit summary взята как-есть; перед имплементацией пересмотреть на свежую голову (контекст мог сдвинуться, могут быть более дешёвые/правильные пути).
- **Out-of-scope reminders** — что аудит подсветил, но к Phase 4 долгу не относится.

---

## Errors for fix

### E1 — `[OPEN]` DA subagent_type drift (recurring, 3 сессии)

**Что наблюдается.** В сессиях [`0781ad12`](../meta-improvement/audit-reports/0781ad12-b57e-4cad-808f-429c4fee2b81.md), [`31394d98`](../meta-improvement/audit-reports/31394d98-ea1a-4b77-bdc3-c243cc819bed.md), [`e3bfd3a3`](../meta-improvement/audit-reports/e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) Devil's Advocate review спавнится через `subagent_type=general-purpose` вместо канонического `product-devils-advocate`. Воспроизводится **за пределами явного `/product:da-review`** — в batch DA вызовах для BR/IC сценариев.

**Связь с прошлым.** Та же P1-регрессия, что фиксировалась DEC-DEV-0038 для S8; считалось локальным фиксом, но возвращается в новых контекстах → root cause не закрыт.

**Гипотезы причины.** Skill-reinforcement gap; либо undocumented contract в [`agents/product/devils-advocate.md`](../../agents/product/devils-advocate.md); либо отсутствие hook-side guard на DA findings file naming.

**Severity.** 🔴 Blocking — нарушает P-RULE-01 (DA артефакты должны исходить от canonical sub-agent для трассируемости).

---

### E2 — `[OPEN]` P-RULE-01 violation: 7 IC активированы без DA

**Что наблюдается.** В сессии [`0781ad12`](../meta-improvement/audit-reports/0781ad12-b57e-4cad-808f-429c4fee2b81.md) созданы `IC-022..IC-028` со `status: active` без обязательного `product-devils-advocate` review (P-RULE-01).

**Suggested action (из summary).** Откатить статус активных IC → `draft`, провести batch DA, обновить frontmatter.

**Severity.** 🔴 Blocking — артефакты прошли через trust boundary без quality gate.

---

### E3 — `[OPEN]` S12 FAIL — DEC-DEV-0036 cleanup regression

**Что наблюдается.** В сессии [`0c10a7c0`](../meta-improvement/audit-reports/0c10a7c0-da21-4676-ada9-08d1ef0468c0.md) сценарий S12 (`cleanup --pending-hygiene`, **CRITICAL**, верифицирует фиксы DEC-DEV-0036) получил вердикт **FAIL**. В соседней сессии `a2aa99d4` тот же сценарий — PARTIAL. Aggregate показал `best_verdict=PARTIAL` через best-of правило, но summary настаивает: по правилу пропагации FAIL для critical сценариев — resolution должна быть **FAIL до подтверждённого фикса**.

**Импликация.** Phase 4 формально «closed», но критичный сценарий DEC-DEV-0036 не подтверждён в свежем прогоне → нельзя считать Phase 4 verified runtime до targeted re-smoke S12 с seed-фикстурами.

**Severity.** 🔴 Critical (S12 помечен ⚠ CRITICAL в smoke plan).

---

### E4 — `[OPEN]` IC frontmatter drift (`type=invariant` вместо `type=invariant-check`)

**Что наблюдается.** В сессиях [`0781ad12`](../meta-improvement/audit-reports/0781ad12-b57e-4cad-808f-429c4fee2b81.md) (IC-022..IC-028) и [`e3bfd3a3`](../meta-improvement/audit-reports/e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) (IC-019..IC-021) IC создаются с `type=invariant` (non-canonical) вместо `type=invariant-check`, без обязательных полей `severity` / `entity` / `testable_as`.

**Класс drift.** Тот же, что DEC-DEV-0011 для PS frontmatter; первопричина — отсутствие explicit template в IC-skill (per convention DEC-DEV-0012 — должен быть inline template + anti-pattern warnings).

**Severity.** 🟡 Warning (× 2 сессий, рост → обещает превратиться в системный, если не задавить).

---

### E5 — `[OPEN]` Post-DA edits без follow-up DA (recurring, 2 сессии)

**Что наблюдается.** В [`0781ad12`](../meta-improvement/audit-reports/0781ad12-b57e-4cad-808f-429c4fee2b81.md) (BR-064/065/070/073/074/076) и [`e3bfd3a3`](../meta-improvement/audit-reports/e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) (BR-063 post-DA) активные BR редактируются после initial DA без повторного review — нарушение P-RULE-02.

**Severity.** 🟡 Warning (degrades DA quality signal со временем).

---

## Recommendations

> ⚠ **Перепроверить на альтернативы при взятии в работу.** Формулировки взяты из audit summary; перед имплементацией пересмотреть свежим взглядом — контекст мог сдвинуться, могут быть более дешёвые или более правильные митигации.

### R1 — Codify D7 pattern «DA subagent_type contract»

Добавить pattern в [`dev/meta-improvement/patterns/`](../meta-improvement/patterns/) фиксирующий правило «DA-обзоры обязаны спавниться через `subagent_type: product-devils-advocate`, не `general-purpose`», с rationale (3 recurring instances в Phase 4 sessions) и enforcement: hook-side validation на DA findings naming convention.

**Закрывает.** E1 + E2 (частично; снимает 2 из 3 blocking-сценариев одним движением).

⚠ **Альтернативы для перепроверки:**
- Pre-prompt инъекция в Product Module (skill metadata + reminder vs hook-only).
- Запрет на `general-purpose` для определённых имён артефактов через PreToolUse guard вместо pattern doc.
- Документация в `agents/product/devils-advocate.md` + skill front-loading vs новый D7 pattern.

---

### R2 — Targeted re-smoke S12 (DEC-DEV-0036 verification)

Re-run только S12 с seed-фикстурами, без полного S1–S13 цикла. До подтверждения фикса S12 должен считаться открытым в [`dev/PHASE_5_READINESS.md`](../_archive/phase-5/PHASE_5_READINESS.md) Section B.

**Закрывает.** E3.

⚠ **Альтернативы для перепроверки:**
- Прежде чем re-smoke — diff между фикстурами на момент DEC-DEV-0036 и текущим состоянием (возможно, упала тест-фикстура, а не код).
- Минимальный repro в unit-test форме внутри `hooks/` или skill self-check — может быть дешевле, чем full session re-smoke.
- Принять FAIL как known issue и явно задокументировать в DEC-DEV-NNNN (если фикс дорогой и cleanup редко вызывается).

---

### R3 — Patch IC-skill template (apply DEC-DEV-0012 convention)

Добавить explicit IC frontmatter template + anti-pattern list (`type=invariant` запрещён; `type=invariant-check` каноничен; `severity` / `entity` / `testable_as` обязательны) в skill, ответственный за создание IC. Использовать [`skills/product/problem-discovery.md`](../../skills/product/problem-discovery.md) Step 3 и [`skills/product/note-promote.md`](../../skills/product/note-promote.md) Step 3 как reference impl.

**Закрывает.** E4.

⚠ **Альтернативы для перепроверки:**
- Найти все skills, создающие артефакты типов из `docs/pmo/artifacts/`, и проверить их одним проходом (batch fix всех drift-prone skills, не только IC).
- Schema-validation hook на artifact write вместо template-injection (контролируется на boundary, не в каждом skill).
- Уточнить, что вообще считается IC «canonical» — может быть spec неверно зафиксировал и фактически `type=invariant` — приемлемое сокращение (проверить в `docs/pmo/artifacts/IC.md`).

---

### R4 — P-RULE-01 / P-RULE-02 enforcement hook

Для blocking E2 (7 ICs без DA) и recurring E5 (post-DA edits without re-DA) — рассмотреть pre-commit / PreToolUse hook, flag-ящий активацию (`status: active`) IC/BR артефактов без соответствующего DA-findings record.

**Закрывает.** E2 + E5 (полностью), E1 (частично — если hook валидирует DA findings provenance).

⚠ **Альтернативы для перепроверки:**
- Status-machine на artifact level вместо free-form `status:` поля (frontmatter constraint: `active` requires `da_review_ref`).
- Hook только на cleanup/promote команды, не глобально на write (меньше шумa).
- Linter-only режим (warn at session end, не блокирует) → meta-improvement скилл `memory-sync` отлавливает.

---

### R5 — No further action для clean sessions

Сессии `cc1cb16a`, `fd5cc61e`, `945809f4` — `status: clean`, ad-hoc без smoke-плана; не блокируют closure. Не требуют follow-up.

⚠ **Альтернативы для перепроверки:**
- Стоит ли вообще аудитить сессии, где `preprocessed: ≤2 relevant records` (типичный noise) — может быть hook-side фильтр на минимум records.

---

## Out-of-scope reminders

- **10 NOT-COVERED сценариев** (S1, S3, S5–S11, S13) — не покрыты ни одной из 8 audited сессий. Согласно DEC-DEV-0038, полный re-run S1–S13 не требуется; обязательны только S1/S7/S8/S9/S12 (см. [`dev/PHASE_5_READINESS.md`](../_archive/phase-5/PHASE_5_READINESS.md) Section B).
- **Uncertain findings** (`a2aa99d4`: cleanup AskUserQuestion framing; `e3bfd3a3`: IC schema local convention, SC↔BR bi-dir refs) оставлены без follow-up — блокировка `pre-processed transcript` / `sandbox read access` к `my-first-test`. Это ограничения environment audit-смока, не код экосистемы.
- **Conflict resolution policy** — S2 (Language discipline) и S12 показали расходящиеся verdicts между сессиями. Aggregate сейчас использует best-of; для critical сценариев это маскирует FAIL. Возможно стоит вынести rule-set в отдельную дискуссию (но не в этот tech debt — это D7 механика, не Phase 4 продукт).

---

## Журнал статусов

| Дата | Изменение | Кто |
|---|---|---|
| 2026-05-26 | Файл создан по результатам `/meta:audit-smoke --phase=4` | автоматически (audit + ручная фиксация) |
