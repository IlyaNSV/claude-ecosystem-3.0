# Reference adapters

Канонические source-of-truth адаптеры `handoff.md` → external D2-Technical инструмент. Шипятся внутри репозитория ecosystem **и** деплоятся в pilot's `.claude/adapters/` через `/ecosystem:bootstrap` (greenfield) и `/ecosystem:update` (sync) — это reference layer для contract-designer subagent при `/integrator:add`.

## Tri-location pattern (DEC-DEV-0040 Q1, refined post-Phase 5 smoke)

| Слой | Путь | Назначение | Жизненный цикл |
|---|---|---|---|
| **Repo (canonical)** | `<ecosystem-repo>/adapters/<adapter>.js` | Source of truth; обновляется maintainer'ом ecosystem | Перерабатывается между релизами 1.x |
| **Reference (project)** | `<project>/.claude/adapters/<adapter>.js` | Pilot-local copy of repo canonical; subagent finds reference здесь, не в global cache | Деплоится при `/ecosystem:bootstrap`; синхронизируется при `/ecosystem:update` |
| **Instance (project)** | `<project>/.claude/integrator/adapters/<adapter>.js` | Установленная копия для конкретного инструмента, с metadata header | Создаётся при `/integrator:add <tool>`; обновляется через `/integrator:update <tool>` (drift repair) |

`/integrator:add` Stage 5 (`contract-designer` subagent) копирует **Reference → Instance** + инжектирует metadata header:

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
| `mk-to-stitch.js` | stitch (MCP) | D2-B04 supports | Phase 6 / Design | ✅ active (CNT-002) |
| `stitch-to-opendesign.js` | open-design (viewer/import) | D2-B04 supports | Phase 6 / Design | ✅ active (CNT-003) |
| `od-mcp-call.cjs` | open-design (`od mcp` stdio — generator path) | D2-B04 supports | DEC-DEV-0067 | ✅ active в пилоте (CNT-004-class) |
| `od-fidelity-check.js` | open-design (round-trip QA миграции) | D2-B04 supports | DEC-DEV-0067 | ✅ active в пилоте |
| `od-consolidate.cjs` | open-design (maintenance: per-screen → per-FM) | D2-B04 supports | DEC-DEV-0067 | ✅ active в пилоте (per-project FEATURES config) |

> **Dockerized external-daemon adapter** (`stitch-to-opendesign.js`): целит общий Docker-daemon open-design по HTTP (`POST /api/import/claude-design`, token-gated), но всё равно держит обязательный daemon-free `--verify-only --fixture` (§ «Принципы реализации»). Token precedence: `--token` → `$OD_API_TOKEN` → `~/.claude/integrator/secrets/open-design.token` (машинно-глобальный, один daemon на машину) → `./.claude/integrator/secrets/open-design.token`. Setup daemon'а: см. [`BOOTSTRAP.md`](../BOOTSTRAP.md) раздел «open-design shared daemon».
>
> **`od mcp` stdio drivers** (`od-mcp-call.cjs`, `od-consolidate.cjs`, `od-fidelity-check.js` — DEC-DEV-0067, generator-путь): осознанное исключение из правила «verify-mode обязателен» — это daemon-coupled драйверы (`docker exec -i … od mcp` / `docker cp`), без daemon'а им нечего dry-run'ить. Подняты в канон as-is из работающего пилота (lift gold pattern DEC-DEV-0063); роль verify-пути для миграций несёт `od-fidelity-check.js` (детерминированный sha256 round-trip). `od-consolidate.cjs` требует per-project конфиг `FEATURES` в instance-копии (в reference — закомментированный шаблон).

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
