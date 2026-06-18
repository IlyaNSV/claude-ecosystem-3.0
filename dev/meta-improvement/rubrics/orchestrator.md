---
id: orchestrator
title: Orchestrator — PMO runtime (D2-Technical/D3 via in-harness Workflow)
module: Orchestrator
triggers:
  - "flag|used_orchestrator_workflow|3"
  - "slash_command|/orchestrator:|3"
  - "written_path|.claude/orchestrator/|2"
  - "commit_scope|orchestrator|1"
criteria: [F]
baseline:
  - docs/orchestrator-module/SPEC.md
  - commands/orchestrator/run.md
  - docs/pmo/processes.md
effect_focus: "процесс корректно ТАРГЕТИРОВАН (feature/handoffs непусты, верный spec — не improvise чужой фичи); Layer-3 gates реально ИСПОЛНЯЛИСЬ, а не упоминались (kiro-review/verify-completion/validate-impl — вердикты с git-диффом + remediation-петли); routing-дисциплина (Orchestrator ROUTES в Integrator/Product, НЕ self-fix чужих артефактов); per-task selective commits чисты (дерево не грязное, boundary полна); GO-gate не замаскирован blocked-задачей; **прочитай `<pilot>/.claude/orchestrator/runs/FEEDBACK-JOURNAL.md` если он есть — каждую запись со Status != resolved подними как audit finding (check_id: orchestrator-feedback)**"
---

# orchestrator — PMO runtime через in-harness Workflow (owned-граница)

**PMO-зона:** Orchestrator берёт PMO-процесс (D2-Technical / D3 и выше) и проводит его end-to-end как in-harness Workflow, ЛИФТЯ методологию внешнего инструмента (cc-sdd kiro-*), а не переписывая её. В Claude-сессии видны: вызовы `Workflow({scriptPath: .claude/orchestrator/processes/*.mjs})`, `/orchestrator:run`, правки `.claude/orchestrator/**`, run-логи в `runs/`, и коммиты, которые наделали оркестрированные субагенты.

**Когда активна:** сессия запускает оркестраторный процесс (`flag:used_orchestrator_workflow` — Workflow на `orchestrator/processes/`), либо `/orchestrator:run`, либо пишет в `.claude/orchestrator/**`, либо коммитит scope `orchestrator`.

**С чем сравнивать (ground truth):** `docs/orchestrator-module/SPEC.md` (P3/P5 контракты, determinism-модель Layer-1/2/3, routing-границы Orchestrator↔Integrator), `commands/orchestrator/run.md` (контракт вызова — в т.ч. args-объектом, не строкой), процесс-каталог.

**Приоритетные критерии (orchestrator-специфичные, читаются из baseline + effect_focus, не из A–F):**
- **Таргетинг:** процесс получил непустой `feature`/`handoffs` и верный spec — не «улучшил» и не выбрал цель сам (FB-001/FB-002).
- **Gates исполнялись:** независимый reviewer / verify-completion / GO-gate выдавали реальные вердикты с диффом и remediation-петлями — не «прочитал шаблон» (caveat #2).
- **Routing, не self-fix:** дефект чужого артефакта (адаптер Integrator, brief, roadmap) → роутится владельцу, а не чинится оркестратором (anti-pattern #5).
- **Чистота коммитов:** per-task selective commit полон (boundary без хвостов), нет project-global side-effects вне boundary (git hooksPath, husky — FB-006).
- **GO-gate:** не подавлен наличием blocked-задачи (cross-task seam'ы должны всплывать — FB-010).

**Anti-patterns:** оркестратор работает в пользовательском проекте через `.claude/orchestrator/` — это **продуктовая** сессия (runtime владельца D2-T/D3), в scope аудита. Сессия может ОДНОВРЕМЕННО активировать D6-integrator (если трогала handoff/адаптеры) — это норма (multi-label).

**FEEDBACK-JOURNAL ingestion:** оркестраторный прогон часто ведёт собственный `runs/FEEDBACK-JOURNAL.md` (богаче, чем audit-journal: severity → root cause → proof → fix → status). Аудитор обязан его прочитать (если есть) и поднять открытые FB-находки в actionable-канал аудита — иначе ценнейший выхлоп сессии теряется (ровно случай c4546225, где 11 FB осели только в пилоте). Детерминированный NDJSON-ingestion FB-формата — follow-up.
