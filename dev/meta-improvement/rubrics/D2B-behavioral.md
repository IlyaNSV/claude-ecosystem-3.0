---
id: D2B-behavioral
title: D2-Behavioral — Feature & behavioral specification
module: Product
triggers:
  - "slash_command|/product:feature|3"
  - "slash_command|/product:handoff|2"
  - "written_path|/features/|2"
  - "written_path|/business-rules/|2"
  - "written_path|/invariants/|2"
  - "written_path|/scenarios/|1"
  - "written_path|/lifecycle/|1"
  - "subagent_type|devils-advocate|1"
criteria: [A, B, C, D, F]
baseline:
  - docs/pmo/processes.md
  - docs/product-module/SPEC.md
  - docs/pmo/validation.md
effect_focus: "FM-граф консистентен (bi-dir refs целы); handoff не stale; P-RULE-01/02 соблюдены при BR/IC изменениях"
---

# D2-Behavioral — Feature & behavioral specification (owned, Product Module)

**PMO-зона:** D2-B (`pmo-map.md` §D2-Behavioral, D2-B01..B05). Артефакты: FM, SC, BR, LC, RPM, VC, IC, NFR, BG.

**Когда активна:** сессия создаёт/обогащает FM и его поведенческие артефакты (SC/BR/IC/LC/NFR), вызывает `/product:feature` или `/product:handoff`, спавнит `product-devils-advocate`.

**С чем сравнивать (ground truth):** поток F.0–F.10 (`docs/product-module/SPEC.md`), процесс-каталог P-RULE-01 (IC→DA), P-RULE-02 (BR→DA), V-11 (bi-dir), handoff DoR-blockers (`docs/pmo/processes.md`, `docs/pmo/validation.md`).

**Приоритетные критерии:** A (frontmatter B.1), B (P-RULE-01), C (P-RULE-02), D (V-11), F (skill discipline).

**Взаимодействие с mode (вторичная ось):** при `mode=fix`/`maintenance` косметические правки BR/IC (опечатка, doc-only) НЕ требуют Devil's Advocate (P-RULE применяется к семантическим изменениям). При `mode=feature`/`unknown` — полная строгость.
