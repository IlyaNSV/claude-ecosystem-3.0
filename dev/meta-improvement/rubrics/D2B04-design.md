---
id: D2B04-design
title: D2-B04 — UX/UI Design (Design Module)
module: Design
triggers:
  - "slash_command|/design:|3"
  - "written_path|/mockups/|2"
  - "written_path|/design-system|2"
  - "written_path|/MK-|1"
  - "written_path|/DS-|1"
  - "written_path|/NM-|1"
criteria: [A, D, F]
baseline:
  - docs/design-module/SPEC.md
  - docs/pmo/artifacts/README.md
effect_focus: "mockups↔FM/SC связаны (bi-dir); design-system токены покрыты; NM согласованы per flow"
---

# D2-B04 — UX/UI Design (owned, Design Module)

**PMO-зона:** D2-B04 (`pmo-map.md` §D2-Behavioral, `has_ui`). Артефакты: MK (mockups), DS (design-system), NM (navigation map).

**Когда активна:** сессия создаёт/правит дизайн-артефакты (`mockups/`, `design-system/`, файлы `MK-`/`DS-`/`NM-`) или вызывает `/design:*`.

**С чем сравнивать (ground truth):** `docs/design-module/SPEC.md` (поток дизайн-сессии, design-validate правила, token coverage), slug/frontmatter-конвенции (`docs/pmo/artifacts/README.md`).

**Приоритетные критерии:** A (frontmatter B.1 для MK/DS/NM), D (bi-dir refs mockups↔FM/SC), F (skill discipline — загружен ли design-skill).

**Заметка:** зона введена в Инкр.3a (DEC-DEV-0059); ранее дизайн-сессии падали в `mixed-uncertain` (Design-рубрика была отложена). Зона **multi-label** — дизайн часто идёт вместе с D2B-behavioral (FM/SC), активируются обе.
