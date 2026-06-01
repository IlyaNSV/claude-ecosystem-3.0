---
id: integration
title: Integration session (Integrator module)
triggers:
  - "slash_command|/integrator:|3"
  - "written_path|.claude/integrator/|2"
  - "commit_scope|integrator|2"
criteria: [G]
baseline:
  - docs/integrator-module/SPEC.md
  - docs/pmo/processes.md
effect_focus: "active-tools.yaml / contracts / pmo-mapping целостны; scope-guard границы не нарушены; journal autolog отработал"
---

# Integration (Integrator module)

**Когда применима:** сессия работает с внешними инструментами через Integrator — `/integrator:add|remove|update|verify|debug|journal`, правки `.claude/integrator/**` (active-tools, contracts, adapters, pmo-mapping), коммиты scope `integrator`.

**С чем сравнивать:** `docs/integrator-module/SPEC.md` (контракты, baseline, scope-границы), процесс-каталог.

**Приоритетные критерии:** product-каталог A–F здесь в основном неприменим (нет `.product/`-артефактов); фокус на целостности integrator-состояния и соблюдении scope-guard (G — phase hygiene, если коммиты фазовые).

**Anti-patterns:** не путать с `ecosystem-dev` — integration работает в пользовательском проекте через `.claude/integrator/`, а не в `dev/meta-improvement/` репозитория экосистемы.
