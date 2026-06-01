---
id: ecosystem-dev
title: Ecosystem development session (D7 / meta)
triggers:
  - "written_path|dev/meta-improvement/|3"
  - "written_path|DEV_JOURNAL.md|2"
  - "commit_scope|meta-improvement|2"
  - "flag|is_ecosystem_repo|2"
criteria: [G]
baseline:
  - dev/meta-improvement/CONVENTIONS.md
  - dev/meta-improvement/checklists/phase-kickoff.md
  - dev/meta-improvement/checklists/phase-closure.md
effect_focus: "n/a (нет .product/) — фокус на D7-дисциплине: DEC-DEV запись при значимом решении, phase kickoff/closure hygiene"
---

# Ecosystem development (D7 / meta)

**Когда применима:** работа над самой Ecosystem 3.0 — правки `dev/meta-improvement/**`, `DEV_JOURNAL.md`, коммиты scope `meta-improvement`, сессия в репозитории экосистемы.

**С чем сравнивать:** D7-конвенции (`CONVENTIONS.md`) — mechanism ratio, self-application, no-auto-fix; checklists kickoff/closure.

**Приоритетные критерии:** G (phase-boundary hygiene: при фазовых коммитах — есть ли DEC-DEV запись и проход closure-чеклиста). Product-каталог A–F неприменим.

**Anti-patterns:** `is_ecosystem_repo` — слабый сигнал (вес 2): работа в репо экосистемы обычно и есть ecosystem-dev, но сильнее опираться на конкретные пути (`dev/meta-improvement/`, вес 3).
