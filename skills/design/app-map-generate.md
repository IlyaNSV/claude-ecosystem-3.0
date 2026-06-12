---
name: app-map-generate
description: D2-B04 — compose/refresh the App Map (AM) L0 view. Mechanical layer from app-map-scan.js (FM/NM glob); editorial layer (cross_module_edges, primary_journeys, cjm_stages) woven from app-map.md frontmatter. Loaded by /design:map.
---

# App Map generation (AM, tier-3)

Собирает **L0 — карту всего приложения** поверх per-flow NM. Источник правды разделён:

| Слой | Источник | Кто правит |
|------|----------|------------|
| **Mechanical** | `app-map-scan.js` (glob FM-*/NM-*) | генератор (детерминированно) |
| **Editorial** | frontmatter `app-map.md` | человек (черновик — ассистент) |

**Принцип:** frontmatter `app-map.md` = единственный источник editorial-данных; тело (секции 1–5) = **проекция** (frontmatter + scan). Человек правит только frontmatter, затем `/design:map --write` пересобирает тело между маркерами `<!-- AM:GEN:START -->` / `<!-- AM:GEN:END -->`.

## Process

### Step 1 — Mechanical scan (детерминированно)

```
node .claude/hooks/design/app-map-scan.js --mermaid --root <projectRoot>
```
Возвращает JSON: `modules[]` (id, title, short, has_ui, status, nm[], nm_present), `counts`, `mermaid_skeleton` (subgraph на каждый has_ui-FM с NM + `click`-drill-down; пунктирные `planned`-узлы для has_ui-FM без NM). Скелет **не содержит** межмодульных рёбер — их добавляет Step 3.

### Step 2 — Read editorial layer

Прочитать frontmatter `.product/app-map.md` (нативно, вложенный YAML):
- `module_roles: { FM-NNN: "primary|secondary|edge|internal …" }`
- `cross_module_edges: [{from, to, trigger, guard, kind?}]` — `kind: nav` (по умолчанию, сплошное ребро) | `system` (событие/данные, пунктир).
- `primary_journeys: [{sc, label, modules:[...], why}]`
- `cjm_stages: [{id, label, modules:[...], emotion, pain}]`

Если `app-map.md` ещё нет — Step 3 рендерит mechanical-only скелет (без рёбер/CJM) и помечает `confidence: low` (editorial не задан).

### Step 3 — Compose body (секции 1–5)

1. **App Map Diagram.** Взять `mermaid_skeleton`, **вплести** `cross_module_edges` перед строкой-маркером `%% --- EDITORIAL EDGES …`:
   - `kind: nav` → сплошное: `nFROM -- "trigger (guard)" --> nTO` (узлы: для live-FM это `n<FMkey>`, для planned-stub — `<FMkey>`).
   - `kind: system` → пунктир: `nFROM -. "trigger (guard)" .-> nTO`.
   - Имя узла-цели planned-stub'а = `<FMkey>` (например `FM005`), live — `n<FMkey>` (например `nFM002`).
   - Секция 1 остаётся **структурной** (модули + межмодульные рёбра) — для читаемости CJM сюда НЕ накладывать. CJM-ряд рендерится отдельной LR-диаграммой в §5 (см. ниже).
2. **Module Inventory** (таблица, *по модулям*): FM · title · has_ui · NM (или «—») · journey-role (`module_roles`) · CJM-стадия (из `cjm_stages[].modules`). Mechanical из scan + role/стадия из editorial.
3. **Primary Journeys (Cases)** (*по кейсам*): из `primary_journeys` — SC · label · модули по порядку · почему primary.
4. **Cross-Module Handoffs (Paths)** (*по путям*): из `cross_module_edges` — from · to · trigger · guard · kind.
5. **CJM & Pain Points**: из `cjm_stages` — (a) отдельная LR-мермейд `flowchart LR` со стадиями `s_<id>["<label> <emoji>"]:::stage` связанными `-->` по порядку (emoji по `emotion`: neutral 😐 · positive 😀 · delighted 🤩 · anxious 😟 · frustrated 😣); (b) таблица: стадия · модули · эмоция · боль. `internal`-модули в CJM-ряд НЕ входят.

### Step 4 — Output

- **default (read-only):** показать собранное тело + coverage-сводку из scan. Никаких записей.
- **`--write`:** заменить регион между `<!-- AM:GEN:START -->` / `<!-- AM:GEN:END -->` в `app-map.md`; **сохранить** frontmatter и маркеры; `updated` = сегодня; `version`++ при изменении тела. Статус по `confidence` (Step 5).

### Step 5 — Confidence / approve gate (🟢 Confirmation)

- `confidence: high` + scan без аномалий (нет orphan-ссылок) → авто-approve `active` (как NM, processes.md §2.5.2).
- `confidence: medium|low` → `draft`, требуется подтверждение человека (особенно editorial: CJM-стадии/эмоции/боли, primary journeys).
- CJM-слой **всегда** редакторский: эмоции/боли проставляет/подтверждает человек; ассистент только предлагает черновик из PS/HYP/SC.

## Discipline (что НЕЛЬЗЯ)

1. **Не дублировать NM.** В диаграмме AM нет внутримодульных переходов — только `click → NM`. Переходы между экранами живут в NM (L1). Если рисуешь экраны внутри модуля — это баг.
2. **Каждое cross-module ребро — с guard.** Ссылка на BR/LC/SC из `cross_module_edges[].guard`; нет inline-условий.
3. **NM-less = planned-stub.** has_ui-FM без NM → пунктирный узел без `click`. Не выдумывать его экраны.
4. **`internal`-модули вне CJM-спайна.** Модуль с `role: internal` (напр. админ-дашборд) — узел на карте, но НЕ на эмоциональном CJM-ряду (клиент его не проходит); ребро к нему — `kind: system`.
5. **Editorial — только в frontmatter.** Не дублировать группировку/primary-метки и в `app-map.md`, и в FM frontmatter.

## Cascade (питает bd uig)

При изменении FM/NM: повторный `app-map-scan.js` → diff `modules`/`nm_present`/`counts` против сохранённого тела (mechanical-регион). Дельта (новый/удалённый FM, появился/исчез NM) → `app-map.md` статус `requires_review`; editorial-frontmatter сохраняется. SC из `primary_journeys` сменил статус/удалён → флаг висячей ссылки.

## Related

- Артефакт: `.claude/docs/pmo/artifacts/AM.md`
- Команда: `.claude/commands/design/map.md` (`/design:map`)
- Сканер: `.claude/hooks/design/app-map-scan.js`
- L1: `.claude/docs/pmo/artifacts/NM.md` (per-flow карты, drill-down цель)
- L2: MK-* / Open Design (`http://localhost:7457/…`) — пиксельный экран
