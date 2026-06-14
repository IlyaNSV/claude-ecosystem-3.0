# Orchestrator Module — Build Kickoff (P3 + P5, E2+E4)

> **Статус:** `kickoff` (2026-06-14, DEC-DEV-0070 / S5). D7 phase-kickoff для **первого implementation-инкремента** модуля Оркестратора. Scope зафиксирован OD10 = **E2+E4** (P3 `batch-features-to-cc-sdd` + нативный P5 `feature-to-tdd-impl`).
> **Источник дизайна:** `ORCHESTRATOR_DOGFOOD_RUN_01.md` (RUN 01 harvest), `docs/orchestrator-module/SPEC.md` v1.0-draft, `ORCHESTRATOR_GATE_RISK_CLASSIFIER.md`.
> **Чеклист:** `dev/meta-improvement/checklists/phase-kickoff.md` (inline-mode, продолжение рабочей сессии).
> **Главный вывод kickoff'а:** инкремент **большой и содержит ≥6 архитектурных «would-I-be-guessing»** (Section 1 Fail-критерий → split). Рекомендация — **split S5 → S5a (P3) → smoke → S5b (P5)** (incremental-pilot, CLAUDE.md §2). Несколько решений требуют подтверждения человека перед генерацией (§D).

---

## Section 1 — Архитектурная готовность («что я бы угадывал»)

| # | Решение | Резолюция | Уверенность |
|---|---|---|---|
| **A1** | **Где живут и как вызываются процессы** (Workflow-скрипты) | `orchestrator/processes/<name>.mjs` (per OD2) — in-harness Workflow-скрипты. Вызов: команда `commands/orchestrator/run.md` (`/orchestrator:run <process> [--feature FM-NNN]`) инструктирует Claude в сессии пользователя загрузить регламент-skill и запустить Workflow (`Workflow({scriptPath})`). Бутстрапятся в `.claude/` как прочие модули. | средняя — **нужен smoke**: подтвердить, что Workflow-tool доступен и opt-in-триггерится командой в bootstrap-проекте (§D-Q1) |
| **A2** | **Нативный P5 без `disable-model-invocation`** | P5 Workflow читает `tasks.md` DAG и на каждую задачу зовёт `agent(tdd-implementer-prompt)` **напрямую** — НЕ `/kiro-impl` (он `disable-model-invocation`). Методология implementer'а/reviewer'а переносится в orchestrator-skills (грунтовка RUN 01), не reference на cc-sdd skill. Снимает OD9. | высокая (это и есть смысл «нативного P5») |
| **A3** | **Где живут 11 role-агентов** | Промпты ролей — `agents/orchestrator/<role>.md` (консистентно с `agents/product/`, `agents/integrator/`). Workflow-скрипт читает md и передаёт тело в `agent(prompt)`. Структурный-verdict schema (VC-7) — в теле роли. | средняя — альтернатива: inline-промпты в скрипте (меньше файлов, хуже переиспользование). §D-Q2 |
| **A4** | **Per-project state Оркестратора** (Notes-ledger, load-bearing registry, gate-решения) | `.claude/orchestrator/` в проекте: `registries/load-bearing.<FM>.yaml`, `ledger/<FM>-notes.md`, `runs/<ts>.json`. Gitignore — по аналогии с `.claude/integrator/` (часть tracked, secrets — нет). | средняя — нужно свериться с тем, что бутстрап/update копируют и что gitignore.template уже покрывает. §D-Q3 |
| **A5** | **Детерминизм Workflow vs запрет `Date.now()`/`Math.random()`** | Стампы (`derived_at`, `runs/<ts>`) проставляются **вне** скрипта (после возврата Workflow) — per SPEC §2 / Workflow-контракт. Реестр деривируется детерминированно (скан спека). | высокая |
| **A6** | **Verification-контракты (VC-1..VC-9) — что входит в первый build** | VC-1 (content-fidelity) — **уже есть** (C-07, S2). VC-2 coverage-oracle, VC-3 gate-risk-classifier (design есть), VC-5 boundary-oracle, VC-7 structured-verdict — в scope P3/P5. VC-8 adversarial-verify, VC-9 reduced re-gate — в P5. VC-10/11/12 (env-probe/runtime/Product-канал) — **вне** первого build (P7/§6, S6). | высокая |

**Каскад (Section 1 lesson):** A2 (нативный P5) ⇒ cc-sdd `kiro-impl`/`kiro-review` skills **не вызываются** Оркестратором (только их методология лифтится в orchestrator-роли) ⇒ зависимость от `disable-model-invocation` исчезает; но появляется долг — держать orchestrator-implementer-роль в синхроне с эволюцией cc-sdd best-practices (зафиксировать как follow-up).

---

## Section 4 — Scope-дисциплина (что режем в первом build)

Per «cuttable scope». P3+P5 целиком — слишком много на один заход. Режем в **backlog-после-первого-build**:

| Компонент | Решение | Обоснование |
|---|---|---|
| **P2 `decide-architecture-foundation`** (консилиум) | **CUT** (опционален) | Нужен только при нерешённой арх-развилке; в RUN 01 запускался руками. Не на критическом пути P3. |
| **P4 `audit-spec-fidelity`** | **CUT → после P3-smoke** | Штатный гейт, но P3 валиден и без него (cross-spec review внутри P3 ловит основное). Добавить вторым заходом. |
| **P6 `validate-feature-impl`** (GO-gate) | **KEEP минимально** в P5 | Финальный gate поймал реальный дефект (#2050) — нужен. Но 3 валидатора → начать с 1 (coverage) + механический слой. |
| **Notes-ledger** | **KEEP минимально** (append-only md) | P5 без него теряет cross-task контракты. Минимальная форма достаточна. |
| **P7 runtime-smoke / §6 capability** | **CUT** (вне OD10-build) | Принятый риск OD10; S6/прогон №2. |
| **Консилиум-синтез, owner-arbitration авто** | **CUT → P4/позже** | Сложное суждение; в первом P3 owner-arbitration — простое правило consumer-conforms-to-owner. |

**Критический путь первого build:** P3 (init → steering/briefs → wave spec-author → cross-spec review+fix → coverage-oracle → commit) + P5 (tasks-DAG → implementer → gate-risk-classifier → reviewer/inline → commit → loop → минимальный GO-gate).

---

## Section 5 — Sub-phase план (split)

**Split S5 → S5a → S5b** (incremental-pilot; smoke между ними):

### S5a — P3 `batch-features-to-cc-sdd` (E2)
1. Module-каркас: `orchestrator/processes/`, `skills/orchestrator/`, `agents/orchestrator/`, `commands/orchestrator/`, `.claude/orchestrator/` (template).
2. Skills: `orchestrator-init.md`, `build-steering.md`, `build-briefs-from-handoff.md`, `coverage-oracle.md`, `arbitrate-cross-spec.md`.
3. Agents: `spec-author.md`, `cross-spec-reviewer.md`, `spec-fixer.md`.
4. Workflow: `processes/batch-features-to-cc-sdd.mjs` (скелет §3.2 SPEC: init → steering/briefs → preflight-gate[adapter content-verify] → wave-barrier → cross-spec loop → coverage-oracle → commit).
5. Command: `commands/orchestrator/run.md`.
6. **Smoke:** прогнать P3 на fixture-handoff'ах (или `my-first-test`) → специ корректны, content-verify зелёный.

### S5b — P5 `feature-to-tdd-impl` (E4, нативный)
7. Skills: `task-brief-builder.md`, `gate-risk-classifier.md` (из design), `verify-task.md` (профили), `verify-finding.md`.
8. Agents: `tdd-implementer.md` (+remediation), `adversarial-task-reviewer.md`, `feature-validator.md`.
9. Реестр: генератор `load-bearing.<FM>.yaml` (скан спека по M1/M2).
10. Workflow: `processes/feature-to-tdd-impl.mjs` (нативный: tasks-DAG → implementer → classifier → HIGH:reviewer/LOW:inline → Notes-ledger → selective-commit → loop → GO-gate).
11. **Smoke:** прогнать P5 на одной фиче с готовым спеком → задачи закрываются, classifier-tier совпадает с ожиданием, GO-gate.

### Прочее
- **D7:** DEC-DEV per sub-phase closure; smoke перед переходом S5a→S5b.
- **Phase N+1 readiness:** после P5 — P4/P6-расширение + S6 (§6 прогон).

---

## D. Решения (подтверждены человеком 2026-06-14)

- **Q1 (packaging/invocation, A1):** ✅ **`orchestrator/processes/*.mjs` + `/orchestrator:run`** запускает harness-Workflow. (smoke opt-in-триггера — в S5a-smoke.)
- **Q2 (роли, A3):** ✅ **`agents/orchestrator/*.md`** — канонические определения ролей.
- **Q3 (split):** ✅ **Split S5a (P3) → smoke → S5b (P5).**
- **Q4 (build/smoke):** ✅ **Build в репо + smoke на `tests/fixtures/`.** Пилот не трогаем; live-прогон — отдельным осознанным заходом.

### D.1 — Harness-ограничение (уточняет Q1/Q2)

⚠ **Workflow-скрипты харнесса НЕ имеют доступа к файловой системе** (`No filesystem / Node.js API access` из спецификации Workflow-tool; также запрещены `Date.now()`/`Math.random()`). Следствия:

1. **Role-промпты нельзя `readFileSync` из `agents/orchestrator/*.md`** внутри `.mjs`. Резолюция: роли **канонически живут** в `agents/orchestrator/*.md` (источник истины + Agent-tool/manual-путь), а в Workflow-скрипт **инлайнятся как `const`-строки**. Обязательство синхронизации — в шапке скрипта + README (drift-риск как у tri-location адаптеров). Альтернатива `opts.agentType` (резолв роли харнессом) **отложена**: резолюция custom project-agent как subagent_type ненадёжна (тот же «S8 P1 regression», DEC-DEV-0064); инлайн надёжнее для первого build.
2. **Входы (handoff-пути, FM-список, fixture-режим) — через `args`** Workflow, не чтением.
3. **Стампы/недетерминизм — вне скрипта** (после возврата Workflow), per SPEC §2.

---

## E. RESUME POINTER (для продолжения после context-compaction)

> **Где мы:** S1–S4 + S5-kickoff завершены. **S5a (P3) ЗАВЕРШЁН** (DEC-DEV-0071) — но **гибридно**, не по inline-roles плану ниже: read-only инспекция cc-sdd показала, что `kiro-spec-batch` уже делает волны+dispatch+10-точечный cross-spec+fix → роли `spec-author`/`cross-spec-reviewer`/`spec-fixer` НЕ строились (дропнуты), Оркестратор их **вызывает**. Реализовано: мост `handoff→brief.md/roadmap` (замена `kiro-discovery`), preflight C-07, детерминир. `coverage-oracle`(+тест), Workflow-скелет `.mjs`, `commands/orchestrator/run.md`, `orchestrator/README.md`. Smoke зелёный (`npm run verify` exit 0). **Следующее действие — S5b build (P5 `feature-to-tdd-impl`, нативный).** Пилот не трогаем; smoke на `tests/fixtures/`.
>
> ⚠ **План «S5a — порядок генерации» ниже УСТАРЕЛ** (предполагал inline-роли). Канон того, что построено — `orchestrator/README.md` + DEC-DEV-0071/0072 + трекер §9.
>
> **S5b (P5) ЗАВЕРШЁН** (DEC-DEV-0072) — тонкий native-контроллер + лифт kiro-impl: Workflow владеет минимальным dispatch-FSM, агент читает `kiro-impl/templates/*` в прогоне + зовёт kiro-гейты; net-new = `gate-risk-classifier.cjs` (P0-2, §6-регрессия 17/17) + durable скелет. Smoke зелёный. **Следующее действие — S6 (прогон №2, §6 capability-канал на неоснащённой инфре)** ИЛИ другие follow-up'ы (Tier 2 / Phase 6 runtime smoke / Orchestrator live-прогон P3+P5 на пилоте). Пилот в билд-сессии не трогали — live-прогон отдельным осознанным заходом.

**Durable-состояние (всё в git, читать в этом порядке):**
1. `dev/ORCHESTRATOR_DOGFOOD_RUN_01.md` §9 — **трекер прогресса** (S1–S6 статусы + commit'ы).
2. Этот файл (`ORCHESTRATOR_BUILD_KICKOFF.md`) §D/§D.1/§5 — решения + harness-ограничение + sub-phase план.
3. `docs/orchestrator-module/SPEC.md` v1.0-draft §3.2/§3.3 — каталог процессов P1–P7 + роли + скелеты P3/P5.
4. `dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md` — P0-2 (нужен в S5b).
5. `DEV_JOURNAL.md` DEC-DEV-0068/0069/0070 — решения и rationale.

**S5a — порядок генерации (build в репо, роли инлайнятся в .mjs per D.1):**
1. `orchestrator/README.md` — структура модуля + sync-обязательство ролей.
2. `agents/orchestrator/{spec-author,cross-spec-reviewer,spec-fixer}.md` — канонические роли (RA-2/3/4 из SPEC §3.3; structured-verdict VC-7).
3. `skills/orchestrator/{orchestrator-init,build-steering,build-briefs-from-handoff,coverage-oracle,arbitrate-cross-spec}.md` — регламент-методология.
4. `orchestrator/processes/batch-features-to-cc-sdd.mjs` — Workflow-скелет (SPEC §3.2 P3: init → steering/briefs → preflight-gate[adapter content-verify C-07] → wave-barrier → cross-spec loop[критерий выхода] → coverage-oracle → commit); роли инлайн.
5. `commands/orchestrator/run.md` — `/orchestrator:run`.
6. **Smoke:** `node --check` на .mjs; прогон детерминированных хелперов (adapter content-verify, brief-деривация, coverage-oracle) на `tests/fixtures/FM-FIXTURE-*`; зафиксировать, что full cc-sdd-прогон требует пилота (отдельный заход).
7. Closure: DEC-DEV (S5a) + трекер S5a→done + smoke перед S5b.

**Инварианты процесса (не потерять после compaction):**
- Коммитить **только свои файлы**; pre-existing ` D PATCH_1.3.3` + ` M audit-index.md` НЕ трогать (оставлены unstaged намеренно).
- Push требует `dangerouslyDisableSandbox: true`. Локально не запушено: коммиты после `880f97d` (трекер, S3, OD10, kickoff).
- Каждый шаг: harness `/tasks` (#5 in-progress) + трекер §9 + DEC-DEV при значимом решении.

---

## Статус
🟢 **READY — S5a (P3) build.** Q1–Q4 подтверждены, D.1-ограничение учтено. **Это удобная точка для context-compaction** (см. §E).
