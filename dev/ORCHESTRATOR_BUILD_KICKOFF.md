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

## D. Требует подтверждения человека (перед генерацией)

> Не угадываю — это решения, влияющие на структуру модуля.

- **Q1 (packaging/invocation, A1):** ОК ли модель «`orchestrator/processes/*.mjs` + `/orchestrator:run` команда, запускающая harness-Workflow»? Или ты видишь процессы иначе (напр. целиком внутри skill-а, без отдельных .mjs)? Это определяет весь file-layout. *(Рекомендую: .mjs + команда — это прямое следствие SPEC §4 «ядро = in-harness Workflow».)*
- **Q2 (роли, A3):** `agents/orchestrator/*.md` (отдельные файлы, переиспользуемо) vs inline-промпты в Workflow-скрипте? *(Рекомендую: отдельные файлы — консистентно с agents/product|integrator.)*
- **Q3 (split):** Согласен на **split S5a (P3) → smoke → S5b (P5)**, а не оба разом? *(Рекомендую: да — incremental-pilot, и P3 самоценен.)*
- **Q4 (где билдим/смоук):** P3/P5 строим в репо экосистемы (канон), смоук — против fixture или против `my-first-test`? Прогон против пилота меняет его состояние (нужна ветка/осторожность с reconcile DEC-DEV-0065). *(Рекомендую: build в репо + smoke на fixture-handoff'ах; live-прогон на пилоте — отдельным осознанным заходом.)*

---

## Статус
🟡 **KICKOFF — ожидает подтверждения D-Q1..Q4 перед генерацией модуля.** После подтверждения: 🟢 → S5a build.
