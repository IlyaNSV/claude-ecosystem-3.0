# Zone-Reference Registry — Session Audit v2

> **Что это:** data-driven реестр **zone-references** для универсального аудита **продуктовых** сессий (`audit-smoke.js --classify`).
> Каждый файл = одна **owned PMO-зона** (или `mixed-uncertain` fallback): с чем сравнивать (`baseline`), по каким критериям (`criteria`), что проверять в продукте (`effect_focus`).
> **Принадлежность:** D7 meta-improvement, dev-only (CONVENTIONS §2/§9). НЕ деплоится.
> Дизайн: [`../../SESSION_AUDIT_V2_DESIGN.md`](../../SESSION_AUDIT_V2_DESIGN.md) §6.0 · решения: DEC-DEV-0056 (Инкр.1) → **DEC-DEV-0059 (Инкр.3a re-anchor)**.

## Модель: две оси (DEC-DEV-0059)

Инкр.3a заменил «один task-class через argmax» на **two-axis zone-anchored multi-label**:

1. **Зона (первичная ось, MULTI-LABEL).** `classifyZones()` детектит ВСЕ зоны, чей скоринг ≥ порога активации — не одного победителя. Одна продуктовая сессия легитимно охватывает несколько зон (D1 → D2-B → handoff), и это нормально. Аудитор сверяет против ОБЪЕДИНЕНИЯ baseline всех активных зон.
2. **Mode (вторичная ось, модификатор строгости).** `detectMode()` из commit-типов → `feature | fix | refactor | maintenance | unknown` (берётся строжайший присутствующий). Плюс occasion-флаг `module-shakedown` (из `module_recently_shipped`). Модулирует строгость (semantic vs cosmetic), НЕ выбирает baseline.

**Scope:** только **продуктовые** сессии. Аудит self-dev сессий самой экосистемы (Level B / D7) из механизма удалён.

## Как это работает

1. `scripts/classify.js` `extractSignals()` строит профиль сессии из транскрипта (slash-команды вкл. user-typed, тронутые пути, типы/scope коммитов, subagent-типы) + маркера (`target_project`, `session_end_reason`) + флагов (`touched_product`, `has_*_artifact`, `module_recently_shipped`).
2. `classifyZones()` скорит профиль против `triggers` каждой зоны; активирует все зоны со скором ≥ `ZONE_ACTIVATION_SCORE` (=2). Параллельно `detectMode()` даёт mode. Нет активных зон → `fallback` (mixed-uncertain).
3. Драйвер рендерит `renderZonesBlock()` (объединённый baseline+criteria активных зон + mode) в `{{RUBRIC_BLOCK}}` и передаёт `claude -p`-аудитору (`prompts/session-audit.md`).
4. Детерминированные зоны выбирают baseline; LLM-аудитор может пометить подозрение на mismatch (advisory `check_id: zone-mismatch`, без авто-переклассификации).

## Формат zone-reference (frontmatter)

```yaml
---
id: <zone id, == имя файла без .md>      # напр. D2B-behavioral
title: <человекочитаемое название>
module: <Product | Design | Integrator>  # владеющий модуль
triggers:                                 # список "signal|match|weight"; пусто = только fallback
  - "slash_command|/product:feature|3"
  - "written_path|/business-rules/|2"
  - "subagent_type|devils-advocate|1"
criteria: [A, B, C, D, F]                 # подмножество check_id A–F аудитора (приоритет)
baseline:                                 # с чем сравнивать (пути читаются аудитором как ground truth)
  - docs/product-module/SPEC.md
effect_focus: <текст — что проверять в .product/ (Step 3.5)>
---

<тело: PMO-зона, когда активна, anti-patterns>
```

### Поддерживаемые `signal` в triggers

| signal | match семантика | источник |
|---|---|---|
| `slash_command` | prefix по `slash_commands[]` | SlashCommand tool_use + user-typed `<command-name>` |
| `written_path` | substring по `written_paths[]` | Write/Edit/NotebookEdit `file_path` (forward-slash) |
| `commit_type` | exact по `commit_types[]` | Bash `git commit` → `type(scope):` |
| `commit_scope` | exact по `commit_scopes[]` | то же |
| `subagent_type` | substring по `subagent_types[]` | Agent/Task tool `subagent_type` |
| `flag` | boolean-флаг истинен | derived в `extractSignals` |

### Derived флаги
`touched_product` (есть запись в `.product/`), `has_feature_artifact` / `has_design_artifact` / `has_discovery_artifact` (по путям), `module_recently_shipped` (best-effort: `ended_at` в пределах 21 дня после последней версии CHANGELOG → occasion `module-shakedown`).

## Текущий набор (Инкр.3a) — owned-зоны only

| zone id | модуль | покрывает |
|---|---|---|
| `D1-discovery` | Product | D1: PS/MR/CA/SEG/VP/HYP/MVP/RM/RL |
| `D2B-behavioral` | Product | D2-B: FM/SC/BR/IC/LC/NFR/VC/RPM/BG |
| `D2B04-design` | Design | D2-B04: MK/DS/NM |
| `D6-integrator` | Integrator | handoff + tool governance (граница к делегированным D2-T/D3/D4) |
| `mixed-uncertain` | — | fallback (нет triggers) |

**Делегированные D2-T/D3/D4/D5 НЕ заводятся** — их работы в Claude-сессии нет, виден только handoff в них (= D6). См. DEC-DEV-0059.

## Добавить новую зону

Создать `rubrics/<zone-id>.md` по формату выше. Кода трогать не нужно — `classify.js` грузит все `*.md` из этой директории (кроме README). После добавления — прогнать smoke (`--classify --force --session-id=<репрезентативный uuid>`) и сверить активированные зоны.
