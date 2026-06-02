---
id: D6-integrator
title: D6 — Integrator (handoff & tool governance)
module: Integrator
triggers:
  - "slash_command|/integrator:|3"
  - "written_path|.claude/integrator/|2"
  - "written_path|handoff.md|2"
  - "commit_scope|integrator|2"
  - "written_path|/adapters/|1"
criteria: [D, F]
baseline:
  - docs/integrator-module/SPEC.md
  - docs/product-module/handoff-spec.md
  - docs/pmo/processes.md
effect_focus: "active-tools.yaml / contracts / pmo-mapping целостны; handoff DoR соблюдён; scope-guard границы не нарушены; journal autolog отработал"
---

# D6 — Integrator: handoff & tool governance (owned-граница в пользовательском проекте)

**PMO-зона:** граница D6 / делегирование D2-T·D3·D4 через Integrator (`pmo-map.md` §D2-Technical–D4, §ритмы). В Claude-сессии продукта видна только **передача** в делегированные зоны (handoff) и управление tool-landscape — сами D2-T/D3/D4 происходят во внешних инструментах и аудитору не видны.

**Когда активна:** сессия работает с Integrator — `/integrator:add|remove|update|verify|debug|journal`, правки `.claude/integrator/**` (active-tools, contracts, adapters, pmo-mapping), генерация `handoff.md`, коммиты scope `integrator`.

**С чем сравнивать (ground truth):** `docs/integrator-module/SPEC.md` (контракты, baseline, scope-границы), `docs/product-module/handoff-spec.md` (handoff DoR), процесс-каталог.

**Приоритетные критерии:** D (ref-целостность handoff↔FM/SC), F (skill discipline). Product-каталог A/B/C/E здесь в основном неприменим — фокус на целостности integrator-состояния и handoff DoR (читается из baseline, не из A–F).

**Anti-patterns:** integration работает в пользовательском проекте через `.claude/integrator/` — это **продуктовая** сессия, в scope аудита. (Аудит self-dev сессий самой экосистемы из механизма удалён, DEC-DEV-0059.)
