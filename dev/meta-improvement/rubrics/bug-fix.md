---
id: bug-fix
title: Bug-fix session
triggers:
  - "commit_type|fix|3"
  - "written_path|hooks/|1"
  - "flag|touched_product|1"
criteria: [A, B, C, D]
baseline:
  - docs/pmo/processes.md
  - docs/pmo/validation.md
effect_focus: "regression — ранее-валидные артефакты/hooks не покраснели; fix не ввёл новых V-нарушений; если правка BR/IC — соблюдён P-RULE; решение зажурналировано"
---

# Bug-fix session

**Когда применима:** доминируют `fix(...)`-коммиты; правки существующих файлов (hooks, артефакты, код) без создания новой feature-цепочки.

**С чем сравнивать:** прежнее валидное состояние (regression baseline) + процесс/валидация-каталоги. Ключевой вопрос аудита: **не сломал ли fix то, что работало**, и соблюдена ли процедура (журналирование, DA при семантических BR/IC-правках).

**Приоритетные критерии:** A (frontmatter не разъехался при правке), B/C (P-RULE при касании IC/BR), D (bi-dir refs).

**Anti-patterns:** не классифицировать как feature-definition из-за касания `business-rules/` — `commit_type=fix` (вес 3) перевешивает path-сигналы (вес 1).
