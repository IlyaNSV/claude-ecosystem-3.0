---
id: D1-discovery
title: D1 — Product Discovery & Strategy
module: Product
triggers:
  - "slash_command|/product:init|3"
  - "slash_command|/product:plan|3"
  - "written_path|/problems/|2"
  - "written_path|/hypotheses/|2"
  - "written_path|/segments/|2"
  - "written_path|/value-prop|1"
  - "written_path|/market|1"
  - "written_path|/competitive|1"
  - "subagent_type|market-researcher|1"
  - "subagent_type|competitor-analyst|1"
criteria: [A, E, D]
baseline:
  - docs/pmo/processes.md
  - docs/product-module/SPEC.md
  - docs/pmo/artifacts/README.md
effect_focus: "PS→HYP/SEG цепочка связна; discovery-артефакты валидны (frontmatter B.1); lineage не нарушен; BG extraction корректен"
---

# D1 — Product Discovery & Strategy (owned, Product Module)

**PMO-зона:** D1 (`pmo-map.md` §D1). Артефакты: PS, MR, CA, SEG, VP, HYP, MVP, RM, RL.

**Когда активна:** сессия трогает discovery-артефакты (`problems/`, `hypotheses/`, `segments/`, `value-prop/`, `market/`, `competitive/`) или вызывает `/product:init` / `/product:plan`; спавнит discovery-субагентов.

**С чем сравнивать (ground truth):** D1-последовательность и гейты (`docs/product-module/SPEC.md`), процесс-каталог P1 + slug/frontmatter-конвенции (`docs/pmo/processes.md`, `docs/pmo/artifacts/README.md`).

**Приоритетные критерии:** A (frontmatter B.1), E (discovery lineage — PS→HYP/FM/SC), D (bi-dir refs).

**Anti-patterns:** не путать создание HYP/SEG в рамках уже идущего фичеделия (это D2-B) с чистым discovery — смотри на доминирующие сигналы. Зона **multi-label**: если в одной сессии есть и discovery, и behavioral-спека — активируются ОБЕ зоны, это нормально.
