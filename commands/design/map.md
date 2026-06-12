---
description: Compose/refresh the App Map (AM) — L0 карта всего приложения (модули × кейсы × пути + CJM-слой) поверх per-flow NM. Mechanical layer derived from FM/NM; editorial layer из app-map.md frontmatter.
argument-hint: "[--write] [--html] [--facet module|case|role|path] [--role R-xxx]"
---

# /design:map

User invoked: `/design:map $ARGUMENTS`

Собирает **L0 App Map** (tier-3): модули (FM) как subgraph'ы, межмодульные пути, primary journeys и CJM-слой — с drill-down в NM (L1) и MK/Open Design (L2). Надстройка над NM, **не** дублирует переходы экранов.

## Step 1 — Parse arguments

- **`--html`** — сгенерировать визуальный USER FLOW `.product/app-map.html` (self-contained: обзор-граф экранов + проигрыватель). Запускает `node .claude/hooks/design/app-map-html.js --root <root>`. Перед этим, если нужны свежие PNG-тхумбнейлы — `node .claude/hooks/design/app-map-thumbs.js --feature FM-NNN --screens SI-1,...` (требует запущенного Open Design: `docker start open-design od-proxy`).
- **`--write`** — пересобрать и записать тело `app-map.md` между маркерами `<!-- AM:GEN:START -->` / `<!-- AM:GEN:END -->` (editorial frontmatter сохраняется). Без флага — read-only display.
- **`--facet module|case|role|path`** — акцент отображения (фасет — флаг рендера, не отдельный файл): `module` (subgraph'ы, default) · `case` (подсветить primary journeys) · `path` (выделить cross-module рёбра) · `role` (фильтр по роли, требует `--role`).
- **`--role R-xxx`** — с `--facet role`: оставить модули/рёбра, доступные роли (по NM Entry Points + RPM).

## Step 2 — Prerequisites

- `.product/` существует (через `.claude/product.yaml`). Иначе refuse → `/ecosystem:bootstrap`.
- `.product/app-map.md` существует?
  - **Да** → читать его editorial frontmatter.
  - **Нет** → read-only: показать mechanical-only скелет + подсказку «нет editorial-слоя — создай app-map.md (см. AM.md) или запусти черновик через /design:map --write после авторинга frontmatter». С `--write` без файла — отказать (нечего плести); editorial авторит человек/ассистент отдельно.

## Step 3 — Generate

Загрузить skill **`.claude/skills/design/app-map-generate.md`** и выполнить его Process:
1. `node .claude/hooks/design/app-map-scan.js --mermaid --root <projectRoot>` → mechanical layer.
2. Прочитать editorial frontmatter `app-map.md`.
3. Скомпоновать тело (секции 1–5): вплести `cross_module_edges` в скелет, отрендерить таблицы Module Inventory / Primary Journeys / Cross-Module Handoffs / CJM & Pain, наложить CJM-swimlane.
4. Применить фасет/роль-фильтр (Step 1).

## Step 4 — Output

- **Read-only:** вывести собранную карту (Mermaid + 5 секций) + coverage из scan (`N/M UI-модулей с NM, K planned-stub`).
- **`--write`:** заменить регион между маркерами; `updated`=сегодня; `version`++; статус по `confidence` (🟢 Confirmation: high+чисто → active; medium/low → draft, нужно подтверждение человека). Editorial frontmatter и маркеры — не трогать.

## Important constraints

- **NM не дублировать.** Внутри модулей — только `click → NM`, без переписывания переходов экранов.
- **Editorial только из frontmatter.** Группировку/роли/CJM не дублировать в FM.
- **planned-stub'ы** для has_ui-FM без NM — пунктиром, без drill-down.
- **`internal`-модули** (role: internal) — вне CJM-спайна; рёбра к ним `kind: system` (пунктир).
- **Read-only по умолчанию.** Запись — только `--write`.

## Error handling

| Error | Action |
|---|---|
| `.product/` missing | Refuse; `/ecosystem:bootstrap` |
| `app-map.md` missing + `--write` | Refuse: editorial-слой не задан |
| `app-map-scan.js` exit 2 | Показать stderr; abort |
| FM с has_ui без NM | Норма → planned-stub (не ошибка) |
| `cross_module_edges` ссылается на несуществующий FM/guard | Surface warning; рендерить остальное |
| `primary_journeys` SC не active/нет | Surface висячую ссылку; не abort |

## Related

- Артефакт: `.claude/docs/pmo/artifacts/AM.md` (схема + 5 секций)
- Skill: `.claude/skills/design/app-map-generate.md`
- Сканер: `.claude/hooks/design/app-map-scan.js`
- Companion: `/design:status` (Design dashboard) · `/design:start FM-NNN` (per-FM NM via design session) · `/product:handoff FM-NNN` (§10 может встроить site-map обзор)
- Слои: L0 (этот) → L1 NM-* → L2 MK / Open Design (`http://localhost:7457/…`)
