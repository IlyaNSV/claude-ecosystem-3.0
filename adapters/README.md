# Reference adapters

Канонические source-of-truth адаптеры `handoff.md` → external D2-Technical инструмент. Шипятся внутри репозитория ecosystem; **не** копируются автоматически в пользовательский проект.

## Dual-location pattern (DEC-DEV-0040 Q1)

| Слой | Путь | Назначение | Жизненный цикл |
|---|---|---|---|
| **Reference (repo)** | `adapters/<adapter>.js` | Canonical source; обновляется maintainer'ом ecosystem | Перерабатывается между релизами 1.x |
| **Instance (project)** | `<project>/.claude/integrator/adapters/<adapter>.js` | Установленная копия, привязана к версии инструмента в этом проекте | Создаётся при `/integrator:add <tool>`; обновляется через `/integrator:update <tool>` |

`/integrator:add` копирует reference → instance + инжектирует metadata header:

```js
// @target_tool: cc-sdd
// @target_tool_version: ^2.1.0
// @contract_schema_version: 1
// @source_ref: <git-commit-hash-of-reference>
// @installed_at: 2026-MM-DDTHH:MM:SSZ
```

`/integrator:update` использует эти поля для drift detection: сравнивает installed `target_tool_version` с целевой версией инструмента **и** diff'ит installed body против актуального reference (по `source_ref`). При расхождении — invokes `contract-designer` для contract repair.

## Текущие адаптеры

| Адаптер | Целевой инструмент | PMO coverage | Phase | Status |
|---|---|---|---|---|
| `handoff-to-ccsdd.js` | cc-sdd | D2-T01 primary, D2-T06 primary, D2-T04 partial, D2-B02 boundary | Phase 5 | ⏳ TBA (sub-phase C) |

## Что НЕ кладём в этот каталог

- Адаптеры с инлайн-state (`.product/` paths, FM-ID hardcode) — это работа Orchestrator, не Integrator.
- Адаптеры между внешними инструментами (D2-Tech → D3) — это контракты Integrator, живут в `<project>/.claude/integrator/contracts/`.
- Tool-docs (`<tool>.md` для будущего Orchestrator) — в `<project>/.claude/integrator/tool-docs/` per SPEC §14.

## Принципы реализации

- **Verify-mode обязателен.** Каждый адаптер должен принимать `--verify-only --fixture <path>` и возвращать структурированный JSON без вызова внешнего инструмента — это база contract-test'а в Stage 6 `/integrator:add`.
- **Line-based parsing handoff frontmatter.** Не regex (lesson DEC-DEV-0031 A1).
- **Самодостаточный.** Зависимости — только Node.js stdlib; никаких npm packages в reference (project-instance может добавить опциональные через `package.json` если нужно).
- **Cross-platform.** LF-normalized I/O; пути через `path.join`.

См. также: [`docs/integrator-module/SPEC.md`](../docs/integrator-module/SPEC.md) §5 (контракты), §7.2 (add flow), §10 (файловая структура).
