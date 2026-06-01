# Rubric Registry — Session Audit v2 (Инкремент 1)

> **Что это:** data-driven реестр рубрик для универсального аудита сессий (`audit-smoke.js --classify`).
> Каждая рубрика описывает **session-class**: с чем сравнивать (`baseline`), по каким критериям (`criteria`), и что проверять в продукте (`effect_focus`, задел под Инкр.2).
> **Принадлежность:** D7 meta-improvement, dev-only (CONVENTIONS §2/§9). НЕ деплоится.
> Дизайн: [`../../SESSION_AUDIT_V2_DESIGN.md`](../../SESSION_AUDIT_V2_DESIGN.md) · решение: DEC-DEV-0056.

## Как это работает

1. `scripts/classify.js` `extractSignals()` строит профиль сессии из транскрипта (slash-команды, тронутые пути, типы/scope коммитов, subagent-типы) + маркера (`target_project`, `session_end_reason`) + флагов (`is_ecosystem_repo`, `touched_product`, `module_recently_shipped`, …).
2. `classifySession()` скорит профиль против `triggers` каждой рубрики, берёт max. Маржа top1–top2 → `confidence` (high/medium/low). Нет победителя → `mixed-uncertain`.
3. Драйвер резолвит рубрику по `id`, рендерит её в `{{RUBRIC_BLOCK}}` и передаёт `claude -p`-аудитору (`prompts/session-audit.md`).
4. Детерминированный класс выбирает рубрику; LLM-аудитор может пометить подозрение на мисклассификацию (advisory, без авто-переклассификации — Инкр.1).

## Формат рубрики (frontmatter)

```yaml
---
id: <kebab-case class id, == имя файла без .md>
title: <человекочитаемое название>
triggers:                       # список "signal|match|weight"; пусто = только fallback
  - "slash_command|/product:feature|3"
  - "written_path|business-rules/|1"
  - "commit_type|fix|3"
  - "flag|is_ecosystem_repo|2"
criteria: [A, B, C, D, F]       # подмножество check_id A–G аудитора (фокус); [] = общая сверка
baseline:                       # с чем сравнивать (пути файлов читаются аудитором как ground truth)
  - docs/pmo/processes.md
effect_focus: <текст; задел под Инкр.2 — что проверять в .product/>
---

<тело: rationale, когда применима, anti-patterns>
```

### Поддерживаемые `signal` в triggers

| signal | match семантика | источник |
|---|---|---|
| `slash_command` | prefix по `slash_commands[]` | SlashCommand tool_use |
| `written_path` | substring по `written_paths[]` | Write/Edit/NotebookEdit `file_path` |
| `commit_type` | exact по `commit_types[]` | Bash `git commit` → `type(scope):` |
| `commit_scope` | exact по `commit_scopes[]` | то же |
| `subagent_type` | substring по `subagent_types[]` | Agent tool `subagent_type` |
| `flag` | boolean-флаг истинен | derived в `extractSignals` |

### Derived флаги
`is_ecosystem_repo` (cwd содержит `claude-ecosystem`), `touched_product` (есть запись в `.product/`), `has_feature_artifact` / `has_design_artifact` / `has_discovery_artifact` (по путям), `module_recently_shipped` (best-effort: `ended_at` в пределах 21 дня после последней версии CHANGELOG).

## Текущий набор (Инкр.1)

Шипим 6 рубрик, покрывающих тест-данные + headline-кейс: `feature-definition`, `integration`, `bug-fix`, `ecosystem-dev`, `module-delivery-shakedown`, `mixed-uncertain` (fallback).

**Отложено как чисто-data follow-up** (framework уже поддержит, добавить = создать `.md`): `discovery`, `design`, `refactor`, `maintenance-docs`.

## Добавить новую рубрику

Создать `rubrics/<id>.md` по формату выше. Кода трогать не нужно — `classify.js` грузит все `*.md` из этой директории. После добавления — прогнать smoke (`--classify --force --session-id=<репрезентативный uuid>`) и сверить присвоенный класс.
