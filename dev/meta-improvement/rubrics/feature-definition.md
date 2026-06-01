---
id: feature-definition
title: Feature Definition session (P2)
triggers:
  - "slash_command|/product:feature|3"
  - "slash_command|/product:handoff|2"
  - "written_path|features/|2"
  - "written_path|business-rules/|1"
  - "written_path|invariants/|1"
  - "subagent_type|devils-advocate|1"
criteria: [A, B, C, D, F]
baseline:
  - docs/pmo/processes.md
  - docs/product-module/SPEC.md
effect_focus: "FM-граф консистентен (bi-dir refs целы); handoff не stale; P-RULE-01/02 соблюдены при BR/IC изменениях"
---

# Feature Definition (P2)

**Когда применима:** сессия создаёт/обогащает FM и его behavioral-артефакты (SC/BR/IC/LC/NFR), вызывает `/product:feature` или `/product:handoff`, спавнит `product-devils-advocate`.

**С чем сравнивать:** поток F.0–F.10 (`docs/product-module/SPEC.md`), процесс-каталог P-RULE-01 (IC→DA), P-RULE-02 (BR→DA), V-11 (bi-dir), handoff DoR-blockers (`docs/pmo/processes.md`).

**Приоритетные критерии:** A (frontmatter B.1), B (P-RULE-01), C (P-RULE-02), D (V-11), F (skill discipline).

**Anti-patterns:** считать сессию feature-definition только из-за касания `.product/` — если доминируют `fix(...)`-коммиты, это `bug-fix` (там commit_type перевешивает).
