---
session_id: c4546225-9d22-4325-8a0a-13a57e4eafd6
kind: manual-deep-dive
supersedes_routine: c4546225-9d22-4325-8a0a-13a57e4eafd6.md
target_project: my-first-test
session_window: 2026-06-15T18:05 → 2026-06-16T11:04 (~17h wall, multi-checkpoint)
auditor: manual (deep dive, requested — routine zone-audit under-served this session)
status: findings-verified
verified_findings: 11 (FB-001…FB-011)
critical_still_live_in_ecosystem: FB-001
---

# Deep-dive — c4546225 (Orchestrator live-run «RUN 01»)

> **Почему отдельный отчёт:** routine zone-audit классифицировал эту сессию как
> `D6-integrator · maintenance · shakedown` и рубрично проверил только срез ремонта
> адаптера. Это самая ценная сессия батча (первый live-прогон Orchestrator P3+P5),
> и её ключевой результат — критический баг FB-001, до сих пор живой в исходниках
> экосистемы — в actionable-канал аудита (`audit-journal.ndjson`) не попал.
> Этот файл — ручной верифицированный разбор + план апстрима. Источник самой
> сессии: пилотный `.claude/orchestrator/runs/FEEDBACK-JOURNAL.md` (FB-001…011,
> RUN 1-4, scorecard) — здесь его claims **перепроверены против исходников/транскрипта**.

## 1. Что это была за сессия

Осознанная live-валидация Orchestrator P3+P5 на пилоте `my-first-test` против живого
cc-sdd + Docker-стека (postgres/redis). Дуга:

| Run | Process | Намерение | Факт | Исход |
|---|---|---|---|---|
| `wf_14616e63-152` | P5 feature-to-tdd-impl | auth | **billing** (FB-001) | 7 задач billing закоммичены под видом auth; остановлен оператором через 2.5ч |
| `wf_f9b6f21c-e7c` | args-probe | диагностика | — | `argsType:"string"` |
| `wf_dc503d44-729` | args-fix-verify | проверка фикса | — | `ok:true` |
| `wf_e89940be-8b4` | P5 (billing) | billing | billing ✓ | 3.2–3.5; чекпоинт |
| `wf_29d196af-50d` | P5 (billing) | billing | billing ✓ | 3.6/4.x/5.1/5.3; **5.2 BLOCKED**; 18/19 |
| `wf_8339b8ca-bbe` | P3 batch-features | FM-007 | blocked | preflight C-07 fail → **зароутил в Integrator** (FB-009) |
| `wf_f3f1809e-077` | P3 (reference-адаптер) | FM-007 | **admin спек** ✓ | Author/kiro-spec-batch + coverage-oracle SUCCESS |
| `wf_dde9f70d-f8f` | remediation | unblock 5.2 | ✓ | webhook-wiring (FB-010), e2e 5/5, sha `11972d0` |
| `wf_e55de512-00b` | remediation | NFR-015 secrets | ✓ | husky-free secret-gate, GO-gate=GO |

**Итог сессии:** billing 19/19 + GO, admin-спек создан, ~100+ субагентов суммарно,
27 коммитов смержены в `pre-cc-sdd-pilot` и запушены; PA-003 (ремонт адаптера) закрыт.
Все 4 caveat'а модуля подтверждены на реальных данных (см. scorecard в FEEDBACK-JOURNAL).

## 2. Провал захвата аудитом (root cause)

Четыре наложившихся фактора:

1. **Нет зоны Orchestrator** в `rubrics/` (есть только D1/D2B/D2B04/D6/mixed). Доминирующая
   работа (P5/P3) неоценима → классификатор взял единственную задетую распознанную зону
   (D6, из финального ремонта адаптера).
2. `mode=maintenance` (`classify.js:318` — коммиты сессии chore/fix) → слабейшая строгость.
3. `shakedown` сработал верно (`module_recently_shipped`, Orchestrator поставлен 06-14) и
   его hint буквально гласит «проверь, что модуль работает» — но это лишь advisory-модулятор,
   он не маршрутизирует и не эскалирует.
4. `effect-probe 0 attributed` — probe меряет только `.product/`; эффекты сессии легли в
   код (`apps/`, `.kiro/specs/`) и git-ветки.

**Нюанс (честно):** LLM-аудитор оказался умнее классификатора — в прозе распознал
«~17h Orchestrator live-run dogfood», построил таймлайн, упомянул FB-001…011 и вынес FB-011
в follow-up. Но, будучи zone-bound, рубрично проверил только D6-срез; 11 FB прошли как
«уже зажурналено сессией» без re-verify; в `audit-journal` осел `+1 info`-finding (про
integrator-журнал), **не FB-001**. Структурная дыра: чем ценнее/сложнее сессия (оркестрация),
тем хуже её ловит actionable-канал аудита.

## 3. Верифицированные находки (против исходников/транскрипта)

Severity: 🔴 critical · 🟠 high · 🟡 medium.

| FB | Sev | Верификация | Вердикт | Апстрим-цель |
|---|---|---|---|---|
| **FB-001** args доезжают строкой | 🔴 | `feature-to-tdd-impl.mjs:41` + `batch-features-to-cc-sdd.mjs:47` = `const A = args \|\| {}`; пилотные копии пофикшены; **все** Workflow-вызовы в транскрипте `typeof args === string` | ✅ **ПОДТВЕРЖДЁН, живой в исходниках** | оба `.mjs` + smoke args-as-string + run.md note |
| **FB-002** нет guard пустого FEATURE | 🟠 | `:42 FEATURE=A.feature\|\|''`; Plan-агент (`:135`) диспатчится без preflight-halt; промпт не запрещает выбирать фичу | ✅ ПОДТВЕРЖДЁН | оба `.mjs`: детерм. preflight + запрет в промпте |
| **FB-003** `runs/` не создаётся | 🟡 | `run.md` без mkdir runs/; каталог создавался вручную | ✅ ПОДТВЕРЖДЁН | run.md/process: создать runs/ + ledger, либо doc-fix |
| **FB-004** параллельные воркфлоу гонятся за git-индекс | 🟠 | reasoned (нет lockfile в скриптах); **эмпирически не воспроизведён** (обойдено последовательным запуском) | ⚠️ PLAUSIBLE (не триггерился) | doc «один воркфлоу на репо» или repo-lock |
| **FB-005** selective commit пропускает cross-cutting | 🟠 | commit-фаза `:244-248` стейджит только `files_changed`+tasks.md, без `git status --porcelain` | ✅ ПОДТВЕРЖДЁН | commit-фаза: boundary-сверка остатка |
| **FB-006** husky перебил beads `core.hooksPath` | 🔴 | транскрипт `:355-356` `core.hooksPath=.husky/_`; откат `:375` восстановил `.beads/hooks/` | ✅ ПОДТВЕРЖДЁН (инцидент реален, восстановлен) | boundary-дисциплина: запрет project-global side-effects |
| **FB-007** blocked-аннотация uncommitted + нет route | 🟡 | `:210` «Do not commit»; нет записи в pending-actions | ✅ ПОДТВЕРЖДЁН | BLOCK: commit аннотации + pending-actions entry |
| **FB-008** shell-шум → integrator-журнал + beads churn | 🟡 | пилотный project-journal оброс `#auto`; root cause — хук авто-лога | ⚠️ pilot-hook-side (нужно найти хук) | изолировать/фильтровать orchestrator-субагентов |
| **FB-009** integrator-адаптер дрейфанул (нет C-07) | 🟠 | RUN 3 блок; reference имеет C-07, installed — нет; ремонт `:687` C-01..07 pass | ✅ ПОДТВЕРЖДЁН + решён в пилоте (PA-003) | покрывается FB-011; + не хардкодить дрейф-путь |
| **FB-010** cross-task seam + GO-gate skip-on-block | 🟠 | `:256 if(implemented.length && !blockedTasks.length)` — 1 blocked глушит GO-gate; webhook-gap реален, закрыт `11972d0` | ✅ ПОДТВЕРЖДЁН | `:256` advisory-режим GO-gate + orphan-export чек |
| **FB-011** `/integrator:update` гейтит repair за version-change | 🟠 | `commands/integrator/update.md:33` no-op до Stage 1; нет `--repair` | ✅ ПОДТВЕРЖДЁН | `--repair`/`--drift-only` или `/integrator:repair` |

**Итог верификации:** 9/11 подтверждены на уровне исходника/транскрипта; FB-004 —
обоснованный, но эмпирически не триггернутый риск (честный caveat); FB-008 — pilot-hook-side
(churn реален, корень — хук авто-лога, требует идентификации).

## 4. Уточнение корневой причины FB-001 (ценность adversarial-verify)

Журнал атрибутировал: «harness доставляет args строкой». Перепроверка транскрипта показала
точнее: **вызывающий агент сам стрингифицировал args** (`args:"{...json...}"` вместо
`args:{...}`) во **всех** вызовах Workflow — вопреки канону `run.md:75` (`args: { feature: … }`)
и контракту Workflow-tool («pass objects as JSON values, NOT a JSON-encoded string»). Harness
передал строку **verbatim — то есть корректно**.

**Следствия:**
- Фикс defensive-parse остаётся правильным и необходимым (LLM-агент будет иногда стрингифицировать → нужна защита в скрипте).
- **Harness чинить не надо** (вёл себя по контракту) — это меняет вывод журнала.
- Дополнительный слой: явный warning в `run.md` рядом с примерами «передавай объект, не строку».

## 5. Решено-в-пилоте vs нужен апстрим

- **Решено локально в пилоте (только там):** FB-001 (фикс в `.claude/orchestrator/processes/*.mjs`),
  FB-006 (откат husky, восстановлен beads hooksPath), FB-009/PA-003 (ре-синк адаптера),
  FB-010 (webhook-wiring), NFR-015. Плюс пилотная memory `reference_workflow_args_string.md`.
- **Не доехало до экосистемы (исходники этого репо):** FB-001 (🔴 живой), FB-002, FB-003,
  FB-004, FB-005, FB-006 (дисциплина), FB-007, FB-008, FB-010 (skip-on-block), FB-011.

## 6. План апстрима (приоритизированный) → Task #9

> **Статус (всё закрыто этой аудит-сессией; FB-009 — в пилоте):**
> - **P0 ✅** `ad53979` — FB-001 (defensive parse ×2) + FB-002 (guard пустого target + запрет Plan-агенту выбирать фичу) + `tests/orchestrator/args-parsing.test.cjs` + run.md note.
> - **P1 ✅** `9e5f509` — FB-010 (GO-gate advisory при blocked + orphan-export чек) + FB-005 (commit boundary-сверка) + FB-006 (guard project-global side-effects) + FB-011 (`/integrator:update --repair`).
> - **Слепое пятно аудита ✅** `94323b2` — зона `orchestrator` в rubrics/ + сигнал `Workflow` в classify.js + `tests/audit/classify-orchestrator.test.cjs` (c4546225 теперь → orchestrator(6,high)+D6(2)).
> - **P2 ✅** `194f46d` — FB-007 (block→commit+pending-actions) + FB-008 (journal-hook исключает dev-tools) + FB-003/FB-004 (run.md doc-notes).
> - **FB-009** — решён в пилоте (PA-003). **Follow-ups:** детерминированный NDJSON-ingestion FB-формата в audit-journal; durable run-ledger в `runs/`; `mode`-детект для оркестраторных сессий (subagent-коммиты не видны → maintenance вместо feature); проверка доставки `/ecosystem:update` (пилотный «Missing script» smoke:orchestrator).
> - **Уточнение:** `smoke:orchestrator`/`test:orchestrator` уже есть в исходном `package.json` — «Missing script» в сессии был пилотным deployment-gap, не дырой в исходнике.

**P0 (🔴, конкретно, низкий риск):**
1. FB-001 — defensive parse в обоих `orchestrator/processes/*.mjs` (`:41`/`:47`):
   `const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}`
   + функциональный тест args-as-string в `tests/orchestrator/`
   + warning в `commands/orchestrator/run.md` (передавать объект).
2. FB-002 — детерминированный preflight внутри обоих процессов: пустой FEATURE/HANDOFFS или
   отсутствие `SPEC_DIR/spec.json` → немедленный halt; в промпте Plan/Author — запрет
   самостоятельного выбора фичи. (Снимает триггер silent-wrong-target.)

**P1 (🟠, реальный риск при следующем live-run):**
3. FB-010 — `feature-to-tdd-impl.mjs:256`: гнать `kiro-validate-impl` в advisory/degraded-режиме
   и при blocked-задачах (чтобы cross-task seam'ы всплывали); + дешёвый orphan-export/call-site чек в HIGH-ревью.
4. FB-005 — commit-фаза: после selective-stage `git status --porcelain`, подхват связанных
   lockfile/manifest в boundary либо fail verify-completion при грязном остатке.
5. FB-006 — boundary-дисциплина: reviewer/verify-completion проверяют, что задача не трогает
   `core.hooksPath`/корневые lifecycle-скрипты вне boundary; steering pin «beads владеет hooksPath».
6. FB-011 — `commands/integrator/update.md`: `--repair`/`--drift-only` (Stage 3+4 на той же версии)
   либо `/integrator:repair <tool>`; рассмотреть re-instantiate installed-инстансов в `/ecosystem:update`.

**P2 (🟡 / doc):**
7. FB-007 — на BLOCK: commit `_Blocked_`-аннотации отдельным chore + запись в pending-actions с route.
8. FB-003 — создавать `runs/` + run-ledger, либо doc-fix (SoT = harness transcript-dir).
9. FB-004 — doc «один orchestrator-воркфлоу на репо за раз» или repo-lock перед commit-фазой.
10. FB-008 — найти хук авто-лога shell-команд в integrator-журнал; изолировать/фильтровать orchestrator-субагентов.

## 7. Связанные задачи аудит-механизма (Task #8)

Чтобы это не повторилось: добавить `rubrics/orchestrator.md` + сигналы классификатора
(Workflow / `orchestrator:run` / `.mjs` / `runs/`) и связать ingestion
`orchestrator/runs/FEEDBACK-JOURNAL.md` — параллельный канал находок, который аудит сейчас
не читает.
