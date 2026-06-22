# Integrator Module — Спецификация

> **Статус:** v1.0 (2026-04-18)
> **Роль:** «Сисадмин» экосистемы — устанавливает, настраивает, соединяет и поддерживает внешние инструменты под PMO-картой. Сам работу не выполняет.
> **Не путать с:** Orchestrator Module (будущий модуль, который запускает инструменты и координирует их работу — проектируется позже).
> **v1 modifications:**
> - C3 (`/product:validation-tune`) — Integrator владеет `validation-config.yaml`. Когда Product Module accept-ит tuning proposal, Integrator updates config + journal entry.
> - D2 (`approve_overrides`) — Integrator validates contracts с учётом overrides (если handoff содержит `dor_overrides[]`, Integrator адаптер отображает их receiver-у).
> - B1 (validation_tier) — Integrator при `/integrator:add <tool>` генерирует V-I-* per current tier (pilot tier = меньше cross-boundary правил).
>
> **Scope note (DEC-DEV-0060, concept-tied):** под двусторонний канал с Оркестратором роль Интегратора расширяется с «внешние инструменты» до полного слоя **capability = «руки» (tool/MCP/доступ) + «голова» (bespoke role-агент + предметный skill)**. Интегратор **оснащает**; инфра-шаг (deploy/provision) исполняет Оркестратор. Forward-looking — направление принято, в shipped v1.0 не реализовано. См. [orchestrator-module/SPEC.md §6](../orchestrator-module/SPEC.md).
>
> **Related:** [docs/README.md](../README.md) (docs index) · [pmo/pmo-map.md](../pmo/pmo-map.md) (functional zones — D2-Tech/D3-D6 delegated) · [product-module/SPEC.md](../product-module/SPEC.md), [design-module/SPEC.md](../design-module/SPEC.md) (peer modules) · [../../adapters/README.md](../../adapters/README.md) (reference adapters — Phase 5)

## 1. Философия модуля

### 1.1. Что Integrator делает

- **Исследует** инструменты под конкретную потребность из PMO
- **Устанавливает и настраивает** инструменты (npm/npx/git/MCP, конфиги, env, smoke-тесты)
- **Оснащает capability-«головой»** *(scope-расширение под Orchestrator-канал — DEC-DEV-0060, concept-tied, не реализовано в shipped v1.0)*: заводит *bespoke* role-агентов + предметные skills под PMO-зону, когда нужной «головы» нет в составе ни одного external tool. «Руки» (tool/MCP/доступ) + «голова» (role-агент/skill) = полный слой capability для Оркестратора. Сам процесс role-агентом **не исполняет** (§1.2, §1.4)
- **Маппит** их возможности на PMO-зоны проекта
- **Создаёт контракты** между инструментами (адаптеры форматов, маршруты данных)
- **Обновляет, заменяет, удаляет** инструменты с переносом контрактов
- **Детектит дрифт** (инструмент обновился → контракт сломался)
- **Ведёт журнал решений** чтобы не повторять ошибки
- **Готовит документацию** для Orchestrator Module (будущий модуль, который будет запускать инструменты)

### 1.2. Что Integrator НЕ делает

- Не редактирует production-код (это зона внешних инструментов)
- Не управляет `.product/` (это Product Module)
- Не запускает рабочие сценарии (это будет Orchestrator Module)
- Не принимает бизнес-решения (это человек через Product Module)
- Не классифицирует задачи и не маршрутизирует запросы (это Orchestrator)
- Не описывает PMO-процессы (это `pmo/pmo-map.md`)

### 1.3. Принцип работы

**Полная автоматизация с явным аппрувом решений человеком.** Integrator делает всё сам, но каждое решение, меняющее инструментарий или контракты, — требует явного approve. В журнале фиксируется: что предлагалось, что принято, какой результат.

### 1.4. Метафора

«Кран в порту». Контейнеры (инструменты) разные — от разных производителей, разного размера, с разными портами. Кран подбирает их под план-схему (PMO-карту), ставит в правильные места, соединяет трубами (контрактами), проверяет, что всё работает. Если контейнер пришёл испорченный — заменяет. Если добавили новый — вписывает в схему. Но грузить/разгружать контейнеры — это уже работа докеров (Orchestrator + внешние инструменты).

---

## 2. Архитектура модуля

### 2.1. Примитивы Claude Code

Integrator — гибрид, как и Product Module:

| Примитив | Назначение | Где |
|---|---|---|
| **Slash-commands** | UX для пользователя (12 команд) | `.claude/commands/integrator/` |
| **Skills** | Методология: research protocol, profiling, contract design | `.claude/skills/integrator/` |
| **Subagents** | Research-heavy задачи (изучение инструмента в свежем контексте) | `.claude/agents/integrator/` |
| **Hooks** | Drift detection, журналирование | `.claude/hooks/integrator/` (per `hooks/<module>/` convention) |
| **Config** | Глобальный каталог, журнал, research-кеш | `~/.claude/integrator/` и `.claude/integrator/` (per-project) |

### 2.2. Global vs Local state (OQ-I5)

**Глобальное** (`~/.claude/integrator/`):
- `tool-catalog.yaml` — накопленные профили всех изученных инструментов (переиспользуются между проектами)
- `decision-journal.md` — глобальный журнал уроков (избегать повторения ошибок)
- `research-cache/` — кешированные результаты research запросов с датой
- `contract-templates/` — типовые шаблоны контрактов между категориями инструментов

**Локальное** (`.claude/integrator/` в конкретном проекте):
- `active-tools.yaml` — текущий набор подключённых инструментов
- `pmo-mapping.yaml` — кто какие PMO-зоны покрывает в этом проекте
- `contracts/` — активные контракты между инструментами (YAML + markdown)
- `project-journal.md` — журнал решений для этого проекта
- `tool-docs/` — сгенерированная для Orchestrator документация по каждому инструменту

### 2.3. Отношения с другими модулями

```
┌────────────────────────────────────────────────────────────┐
│                    ЯДРО ECOSYSTEM 3.0                       │
│                                                             │
│  Product Module         Design Module     Integrator Module │
│  (D1 + D2-Behavioral)   (D2-B04)          (инфраструктура) │
│         │                     │                     │       │
│         ▼                     ▼                     ▼       │
│     .product/            .product/              .claude/    │
│    (артефакты)           (MK/DS/NM)            integrator/  │
│                                                     │       │
│                                                     ▼       │
│                       Будущий Orchestrator Module          │
│                       (запуск инструментов)                │
│                                                     │       │
└─────────────────────────────────────────────────────┼───────┘
                                                      │
                                                      ▼
                          ВНЕШНИЕ ИНСТРУМЕНТЫ (D2-Tech, D3-D6)
                          cc-sdd, Kiro, beads, superpowers,
                          Playwright, Sentry, ...
```

**Стыковка с Product Module:** Integrator настраивает первый D2-Technical инструмент так, чтобы он принимал универсальный handoff.md из Product Module. Это один из контрактов.

**Стыковка с будущим Orchestrator Module:** Integrator после каждого add/update/replace генерирует `.claude/integrator/tool-docs/<tool>.md` — техническую документацию «как управлять этим инструментом». Orchestrator будет это читать и оркестрировать.

---

## 3. Каталог команд

13 slash-команд разделены на три группы (добавлена `/integrator:scan` в итерации 3).

### 3.1. Группа «Read-only» (безопасные, без side effects)

> **Approve discipline (DEC-DEV-0047 / patch 1.3.3):** read-only команды могут содержать *narrative* recommendations, но любая такая рекомендация заканчивается **explicit approve gate** (см. §7.6). Без выраженного «выбираю опцию N» / «defer» / «details» — никакой automatic follow-up actions (caching не считается follow-up; запись в `~/.claude/integrator/research-cache/` идёт всегда). Это правило особенно важно для consilium-pattern research (multiple parallel research priors): без declared scope результаты НЕ принимаются за решение.

**`/integrator:research <need>`** — исследование инструментов под потребность
- Вход: текстовое описание потребности («нужны инструменты для работы с PostgreSQL», «хочу E2E-тестирование для React», «нужен monitoring для prod»)
- Процесс: определяет PMO-зону → изучает рынок → сравнивает варианты → проверяет совместимость с текущим стеком → предлагает 2-5 оптимальных решений с **per-environment-tier разбивкой** (см. §4.1 `environment_tiers`)
- Выход: отчёт с рекомендациями + **hard approve gate** (не устанавливает; без user response — никаких follow-up actions)

**`/integrator:map`** — показать текущее покрытие PMO
- Таблица: домен → покрытие → инструмент → статус контрактов
- Визуализация gaps и конфликтов

**`/integrator:gaps`** — показать непокрытые PMO-зоны
- Список процессов без подключённого инструмента
- С пометкой критичности (нужен для v1? можно отложить?)
- Предлагает `/integrator:research` для каждого gap

**`/integrator:status`** — полная картина
- Сводка: активные инструменты, контракты, последние изменения, ошибки
- Здоровье контрактов (drift detection results)
- Последние 5 решений из журнала

**`/integrator:journal [--filter <tag>]`** — просмотр журнала решений
- История всех принятых решений с контекстом и результатами
- Фильтр по тегу (tool-name, error-type, date-range)

### 3.2. Группа «Modifying» (с side effects, требует approve)

**`/integrator:add <tool>`** — добавить инструмент
- Вход: имя инструмента (npm-пакет, git-репо, MCP URL)
- 6 этапов: profile → propose → install → configure → contract → verify
- Approve — gate (перед install), не отдельный этап; детали — §7.2

**`/integrator:remove <tool>`** — удалить инструмент
- Вход: имя активного инструмента
- Этапы: impact analysis → approve → migrate data (если возможно) → uninstall → cleanup contracts → update mapping

**`/integrator:replace <old> <new>`** — заменить один инструмент другим
- Комбинация remove + add, но с миграцией данных и переносом контрактов

**`/integrator:update <tool>`** — обновить версию инструмента (OQ-I6)
- Вход: имя + опционально целевая версия
- Этапы: backup config → install new → verify contracts → detect drift → update contracts → verify → approve
- Если drift нерешаемый — rollback

### 3.3. Группа «Maintenance» (поддержка инфраструктуры)

**`/integrator:verify`** — проверка консистентности
- Все активные инструменты работоспособны (smoke test)
- Все контракты валидны
- PMO-mapping актуален
- Нет orphan tools или orphan contracts

**`/integrator:debug <error-description> [--tool <name>]`** — диагностика ошибки (OQ-I4)
- Вход: описание ошибки от человека
- Процесс: анализ журнала → сопоставление с симптомами → предложение исправления → approve → fix
- Всегда обновляет журнал: что пошло не так, как починили

**`/integrator:scan`** — сканирование окружения (OQ-I12)
- Запускается вручную или автоматически перед modifying commands
- Детектит: существующие пользовательские хуки, команды, агенты, MCP, кастомные конфиги
- Результат: `.claude/integrator/baseline.yaml` + report в консоли
- Детальнее: §13 Environment Scanner

**`/integrator:docs [--tool <name>]`** — экспорт документации для Orchestrator (OQ-I7)
- Генерирует `.claude/integrator/tool-docs/<tool>.md`
- Содержит: как запускать, какие команды, ожидаемые входы/выходы, интеграционные точки, known issues
- Для `--tool=all` — bulk экспорт всех активных инструментов

---

## 4. Формат профиля инструмента (OQ-I1)

Профиль — YAML, хранится в глобальном каталоге (переиспользуется) + снапшот в локальном active-tools.yaml.

### 4.1. Структура профиля

```yaml
# ~/.claude/integrator/tool-catalog/<tool>.yaml

tool:
  name: beads
  version_installed: 1.2.0
  source: npm                      # npm | pip | git | mcp | binary | docker (см. §4.1.1)
  source_spec: beads@1.2.0
  installed_at: 2026-05-01
  last_verified: 2026-05-15
  home_url: https://github.com/example/beads
  docs_url: https://example.com/beads/docs

metadata:
  category: implementation         # implementation | spec-gen | testing | monitoring | deploy | other
  claude_primitives:               # ВСЁ что инструмент создаёт или модифицирует — внутри .claude/ И снаружи
    - type: command
      path: .claude/commands/beads/
    - type: agent
      path: .claude/agents/beads-executor.md
    - type: hook
      path: .claude/hooks/beads-enforcer.js
    - type: other
      path: .kiro/                   # external workspace (outside .claude/) — REQUIRED for backup coverage
    - type: other
      path: CLAUDE.md                # external project-root append — REQUIRED for backup coverage

# Multi-tier environment applicability (per patch 1.3.3 / DEC-DEV-0047).
# Required: tool profile должен явно деклaрировать suitability для каждой из 3 tiers
# ИЛИ выставить блок `environment_agnostic: true` (если tool работает одинаково везде).
# Без этого блока — research output невалиден (см. §7.1 hard approve gate).
environment_tiers:
  local_dev:
    suitability: full              # full | partial | none
    notes: "Runs locally via docker compose; no external API needed for basic flow."
  staging:
    suitability: full
    notes: "Staging cluster supports same config; requires test API key."
  production:
    suitability: partial
    notes: "Production-ready, but cold-start latency requires warmup; consider managed alternative for high-traffic prod."

pmo_coverage:
  D3-01:                           # Implementation — ссылка на pmo-map.md процесс
    confidence: high               # high | medium | low
    evidence: "Implements task execution via executor agent"
    how: "/beads:execute-phase"
  D3-03:                           # Source Integration (git flow)
    confidence: high
    evidence: "Includes git flow hooks"
    how: "Automatic via hooks"
  D3-04:                           # Build & Dependency Management
    confidence: none
    evidence: "Documentation says CI is out of scope"

inputs:
  - type: tasks.md
    from: cc-sdd.spec-tasks        # откуда ожидает получать
    format: markdown
    schema_ref: contracts/spec-tasks-to-beads.yaml
  - type: product-handoff.md
    from: product-module
    format: markdown
    schema_ref: contracts/product-handoff-universal.yaml
    adapter: beads-handoff-parser   # если нужна адаптация

outputs:
  - type: implementation-log
    to: human
    format: markdown
  - type: task-status-updates
    to: any                        # потребляет любой — task tracker
    format: json
    schema_ref: contracts/task-status.yaml

configuration:
  config_files:
    - path: .beads/config.yaml
      purpose: "Local beads settings"
      owned_by: integrator
      editable: true
  env_required:
    - BEADS_API_KEY:
        required: false
        stored_in: 1password
  global_settings:
    - key: model_provider
      inherits_from: ~/.claude/global-settings.yaml

conflicts:
  - with: custom-git-hooks
    resolution: "User chose to replace custom-git-hooks with beads git-flow"
    decided_at: 2026-05-01

notes:
  - "Supports parallel execution but we use sequential in this project"
  - "Known issue #123: timeouts on Windows, use WSL"
```

### 4.1.1. Dockerized external-daemon tool pattern (`source: docker`)

Generic-паттерн для инструментов, которые **не устанавливаются в проект как пакет/примитив**, а живут как **общий Docker-daemon на машину** и говорят по HTTP. Вводится в Phase 6 на примере **open-design** (D2-B04 / CNT-003), но обобщён для будущих tools.

**Когда применять:** host-окружение несовместимо с native-установкой (напр. open-design требует Node 24, host на Node 18 + pnpm/corepack broken) → tool гоняется в контейнере; ОДИН daemon обслуживает ВСЕ проекты; per-project остаётся только контракт/адаптер.

**Свойства паттерна:**

| Аспект | Native tool (npm/pip/git/binary) | Dockerized daemon (`source: docker`) |
|---|---|---|
| Install (Stage 3) | package install в проект | provision/validate connectivity к общему daemon (НЕ авто-`docker run` — lifecycle daemon operator-owned) |
| `.claude/`-примитивы | command/agent/hook/skill/mcp | **ZERO** (`claude_primitives: []`) — external daemon |
| State в проекте | tool-specific files | только `active-tools.yaml` entry + контракт + адаптер-инстанс |
| Transport контракта | CLI/file (adapter `--verify-only`) | HTTP (multipart/JSON) + обязательный daemon-free `--verify-only` |
| Auth | env / config | **token-gated**: Bearer на ВСЕХ `/api/*` (Docker bridge → host-запросы non-loopback) |
| Адрес | — | `http://127.0.0.1:<port>` (НЕ `localhost` — Windows IPv6 ::1 EACCES) |
| Token storage | — | precedence: `--token` → env → `~/.claude/integrator/secrets/<tool>.token` (машинно-глобальный) → `./.claude/integrator/secrets/<tool>.token` |
| Version pin | semver | image digest (`@sha256:...`) — supply-chain; non-pilot = pinned digest ИЛИ build-from-source |

**Профиль (`source: docker`) пишет:** `source_spec: "docker run <image>@sha256:<digest>"`, ports, volume, required env, token location, `claude_primitives: []`. Verify в Stage 6 — daemon-free `--verify-only --fixture` (детерминированно без Docker); опциональный live-import только если daemon поднят.

**Границы (D2-B04 split):** Integrator владеет инфраструктурой — daemon-mgmt + контракт + адаптер. Design-facing wiring (viewer, `/design:migrate --to <tool>` target, `external_viewers` дефолт в `design.yaml`) принадлежит **Design Module** (см. `docs/design-module/SPEC.md`). Setup общего daemon: [`BOOTSTRAP.md`](../../BOOTSTRAP.md) раздел «open-design shared daemon».

**Generate-путь поверх daemon-паттерна (DEC-DEV-0067):** помимо HTTP viewer-import (CNT-003), daemon-инструмент может экспонировать **MCP-stdio управляющий канал** (`docker exec -i <container> … mcp`) — для open-design это generator-путь CNT-004-class: агент авторит артефакты прямо в проектах daemon'а (`create_project` / `create_artifact` / `write_file`). Канонический драйвер: `adapters/od-mcp-call.cjs` (держит stdin открытым до прихода всех async-ответов — EOF-truncation guard); QA миграций: `adapters/od-fidelity-check.js` (sha256 round-trip). Эти драйверы daemon-coupled — осознанное исключение из daemon-free `--verify-only` правила (см. `adapters/README.md`). Design-facing исполнение generator-роли — `skills/design/open-design-workflow.md` (Design Module SPEC §4.4c).

### 4.2. Confidence levels для PMO coverage

Single-layer declared confidence. Integrator не делает continuous tracking или smoke tests в v1 — его роль «сисадмин», не «observer». Empirical feedback приходит через human discovery (debug session после fail, `/product:validation-tune` при наблюдаемых проблемах).

- **high** — явно задокументировано в tool docs + есть рабочие примеры на подобном стеке
- **medium** — задокументировано, но неясна проверенность на нашем контексте
- **low** — выведено по косвенным признакам (issue tracker, community posts)
- **none** — явно не покрывает или не заявляет

**Confidence refinement после опыта:** если при использовании tool обнаруживаются регулярные failures, human через `/integrator:debug` fix-ит причину, и в journal фиксируются уроки. Systematic issues → через `/product:validation-tune` пользователь может propose downgrade declared confidence. Нет автоматической downgrade без явного human action.

### 4.2.1. Environment tiers (DEC-DEV-0047 / patch 1.3.3)

`environment_tiers` блок в профиле tool'а — **обязательное** поле, заявляющее применимость инструмента в 3 environments: `local_dev`, `staging`, `production`. Каждый tier имеет `suitability` (`full` / `partial` / `none`) + free-form `notes`.

**Зачем:** до patch 1.3.3 research output выдавал PROD-only рекомендации (e.g., «Vercel Pro $20/мес» без local-dev альтернативы). Pilot session 2026-05-27 показала: юзер строит prod-стэк раньше, чем local-dev/staging — risk vendor lock-in + cost commitment до validation.

**Semantics:**

| `suitability` | Значит |
|---|---|
| `full` | Tool работает в этом tier без compromise (docs/community confirm; для new-install — без runtime caveat) |
| `partial` | Работает, но с caveats (cost, latency, manual setup, single-machine limits — в `notes`) |
| `none` | Не предназначен / не работает в этом tier (e.g., Vercel Pro в local_dev — `none`, требует cloud) |

**Special-case `environment_agnostic`:** если tool работает одинаково independent of environment (e.g., code linter, type checker, npm package без runtime networking) — вместо `environment_tiers` блока выставляется `environment_agnostic: true` с одной строкой rationale. Это explicit, не fallback default.

**Research integration:** `/integrator:research` Phase 5 output **обязан** содержать per-tier разбивку для каждого рекомендованного tool'а (или explicit `environment_agnostic` disclaimer). Skip = output невалиден; перед approve gate research-protocol Phase 5 должен возразить.

**Install integration:** `/integrator:add` Stage 2 propose, если tool заявляет `local_dev.suitability: none` → MUST включать warning «Этот tool не подходит для local dev — обсудить parallel/separate dev решение (mock service, lighter tool, staging-shared)?».

**Backward compatibility:** профили из tool-catalog без `environment_tiers` блока — lazy-regenerable при следующем профайлинге. Нет migration script (DEC-DEV-0047 Section 1 B-1 alternatives rejected).

### 4.2.2. `claude_primitives` completeness invariant (DEC-DEV-0051 / patch 1.3.5)

`metadata.claude_primitives[]` блок в профиле tool'а — **обязан перечислять ВСЕ paths**, которые tool создаёт или модифицирует во время install, **независимо от location**:

- **Inside `.claude/`** — `.claude/commands/<tool>/`, `.claude/skills/<namespace>/`, `.claude/agents/<file>`, `.claude/hooks/<file>`, `.claude/settings.json#hooks.<event>`, etc.
- **Outside `.claude/`** — workspace dirs (`.kiro/`, `.beads/`, ...), project-root file appends (`CLAUDE.md`, `.gitignore`), config locations (`~/.config/<tool>/` for system-level tools), etc.

**Зачем:** `/ecosystem:update` использует этот список как source of truth для:
- **Step 2b backup scope** — external paths copy'ятся в `${BACKUP_DIR}/_external/` для rollback safety
- **Step 5.1 namespace-aware sync** — inside-paths (третьей-party namespaces в ecosystem zone subdirs) preserve'ятся untouched

Если `claude_primitives` не полный — те paths, которые отсутствуют, **не будут backed up** (rollback risk) и **могут быть уничтожены** при ecosystem updates (если попадают в ecosystem zone subdirs).

**Schema поля для каждой entry:**

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `command` / `skill` / `agent` / `hook` / `other` |
| `path` | yes | Relative path (POSIX-style forward slashes) — absolute paths forbidden |
| `purpose` | optional | Short description; помогает audit/forensics |

`type: other` зарезервирован для **non-canonical** locations: workspace dirs (`.kiro/specs/`), project-root file appends (`CLAUDE.md`), git config overrides (`.beads/` containing git hooks override). Для inside-`.claude/` paths используй specific type.

**Path conventions:**
- Forward slashes (`/`), даже на Windows downstream (Claude normalizes для cross-platform).
- Trailing slash для directories OK, не required — backup/preserve tolerate variants.
- Paths NOT starting with `.claude/` → treated as external by Step 2b.

**Backward compatibility:** существующие профили с incomplete `claude_primitives` — lazy-regenerable при следующем `/integrator:update <tool> --regenerate-primitives` (planned, deferred к v1.1). Pilot tools (cc-sdd, beads): manual audit в active-tools.yaml уже отражает полный footprint.

**Tool-profiler responsibility:** subagent `tool-profiler` (`agents/integrator/tool-profiler.md`) при research-protocol Phase 4-6 ОБЯЗАН enumerate complete install footprint, не только canonical `.claude/` entries. Source of truth — tool documentation + install script inspection + dry-run filesystem diff.

### 4.3. Aggregated PMO mapping (`pmo-mapping.yaml`)

Profile каждого tool'а — **его собственное декларирование**. Но проекту нужен **агрегированный view**: «кто что покрывает в этом проекте». Это `.claude/integrator/pmo-mapping.yaml`.

**Когда обновляется:**
- `/integrator:add <tool>` — добавляет coverage entries от нового tool'а
- `/integrator:remove <tool>` — удаляет coverage entries
- `/integrator:update <tool>` — re-verify coverage при version change
- `/integrator:verify` — manual re-audit (проверка что tools установлены, контракты валидны)

**Схема:**

```yaml
# .claude/integrator/pmo-mapping.yaml
version: 1
last_updated: 2026-04-18T15:30:00Z
project_tier: pilot | mvp | mmp | growth | mature
integrator_version: 1.0

coverage:
  # Ключ — PMO process ID из pmo-map.md (D1-01 .. D6-NN)

  D2-T01:                                # Architecture Design (D2-Technical)
    covered_by: [cc-sdd]                 # список инструментов, покрывающих
    primary: cc-sdd                      # preferred для этой зоны
    secondary: []                        # fallback tools (OQ-I9 multi-tool)
    confidence: high                     # declared (§4.2)
    evidence: "Documented in cc-sdd README §2; confirmed via example project"
    since: 2026-04-18                    # когда добавлена coverage
    contracts: [CNT-001]                 # активные контракты
    notes: ""                            # optional

  D3-01:                                 # Implementation process
    covered_by: [beads, superpowers]     # multi-tool scenario (OQ-I9)
    primary: beads
    secondary: [superpowers]
    confidence: medium
    evidence: "beads docs mention general code-gen; not verified на нашем стеке"
    since: 2026-04-15
    contracts: [CNT-003, CNT-005]

uncovered:                               # процессы без активного tool'а
  - process: D4-01
    reason: "no testing tool installed"
    severity: important                  # critical | important | nice | deferred
    planned: "address when entering mvp tier"
    since: 2026-04-01
  - process: D5
    reason: "deferred per DEC-P08 (v1 out of scope)"
    severity: deferred
    planned: "v1.1+ when monitoring infrastructure ready"

deferred_by_design:                      # явно отложенные
  - D1-10   # Pivot/Persevere — out of scope v1 (Q-11)
  - D5-*    # Operations feedback — out of scope v1 (DEC-P08)
  - D6-*    # Meta processes, пока только Integrator manual

meta:
  last_audit: 2026-04-18                 # последний /integrator:verify
  multi_tool_zones: 1                    # OQ-I9 — сколько зон с 2+ tools
```

**Invariants:**
- Каждый key в `coverage:` ↔ существует в pmo-map.md
- `covered_by[]` не пустой (если процесс в `coverage`, он covered)
- Если `covered_by` содержит 2+ tools — `primary` обязателен (OQ-I9 scaffolding)
- `evidence` обязателен при `confidence: high` (без доказательства → максимум medium)

**Кто читает:**
- `/integrator:map` — отображает таблицу
- `/integrator:gaps` — derives uncovered + severity-assessed needed
- `/integrator:status` — summary health
- Future: Orchestrator Module — routing decisions per coverage

### 4.4. Confidence lifecycle

Когда confidence меняется:

| Trigger | Action | Responsible |
|---|---|---|
| `/integrator:add <tool>` | Profile создан, confidence выставлен per evidence из docs + profile review | Integrator + human approve |
| `/integrator:update <tool>` | Re-verify что docs не изменились кардинально; confidence update если applicable | Integrator + human approve |
| Observed failures / issues | Human runs `/integrator:debug` → journal entry; если systematic → `/product:validation-tune` propose downgrade | Human-initiated |
| Tool deprecated / replaced | `/integrator:remove` или `/integrator:replace` → coverage entry removed | Human-initiated |
| `/integrator:verify` (manual) | Проверка: tool ещё установлен? контракты валидны? confidence adequate? | Human review |

**Key принцип:** confidence changes всегда проходят через **явное human решение**. Нет автоматического downgrade без journal entry.

---

## 5. Контракты между инструментами (OQ-I2)

### 5.1. Формат контракта

Каждый контракт — YAML + markdown-описание. Генерируется Integrator'ом при `add/update/replace`.

```yaml
# .claude/integrator/contracts/product-handoff-to-cc-sdd.yaml

contract:
  id: CNT-001
  name: "Product Handoff → cc-sdd spec-init"
  producer: product-module
  consumer: cc-sdd
  created: 2026-05-01
  last_verified: 2026-05-15
  status: active              # active | broken | draft | deprecated

data_flow:
  from:
    artifact: product-handoff.md
    location: .product/handoffs/FM-{NNN}-handoff.md
    format: markdown+yaml_frontmatter
  to:
    artifact: spec-init input
    location: cc-sdd internal
    format: plain text description + metadata

transformation:
  type: adapter_script           # direct | adapter_script | manual
  script: .claude/integrator/adapters/handoff-to-ccsdd.js
  adapter_description: |
    Reads YAML frontmatter (feature, jtbd, hypothesis, priority, release).
    Extracts FM description.
    Injects business context as steering prefix.
    Calls /kiro:spec-init.

validation:
  pre:
    - check: "handoff.md exists"
    - check: "handoff.md status=ready"
    - check: "FM referenced exists in .product/features/"
  post:
    - check: "spec-init completed without errors"
    - check: ".kiro/specs/{feature}/spec.json created"

failure_modes:
  - symptom: "cc-sdd refuses handoff content"
    likely_cause: "Handoff schema changed or cc-sdd version mismatch"
    action: "Run /integrator:verify; if broken — /integrator:update both"
```

### 5.2. Реестр контрактов

Глобальный (`~/.claude/integrator/contract-templates/`):
- `spec-gen-to-implementation.yaml` — шаблон для любого spec-инструмента → implementation-инструмент
- `product-handoff-universal.yaml` — шаблон для Product Module → любой D2-Tech
- `implementation-to-testing.yaml` — код → тесты
- `any-to-monitoring.yaml` — любой код-генератор → D5

Локальный (`.claude/integrator/contracts/`):
- Конкретные активные контракты, инстанциированные из шаблонов

---

## 6. Журнал решений (OQ-I4)

### 6.1. Зачем

- Не повторять ошибки (человек спрашивает: «мы пробовали beads раньше?»)
- Накапливать знания о инструментах (что в какой среде работает плохо)
- Показывать прозрачную историю изменений инфраструктуры
- Источник для Orchestrator Module при разработке

### 6.2. Формат записи

```markdown
## DEC-INT-0042 — Replace custom-git-hooks with beads git-flow

**Дата:** 2026-05-01
**Триггер:** /integrator:add beads
**Тег:** #tool-add #conflict-resolution #git-flow
**Инструменты затронуты:** beads (added), custom-git-hooks (removed)

### Контекст
Beads v1.2.0 приносит свои git-hooks для atomic commits, checkpoint, self-review.
Это конфликтует с custom-git-hooks, которые были написаны вручную для .claude/hooks/.

### Рассмотренные варианты
1. Оставить оба (beads + custom) — риск: двойные хуки на commit
2. Выпилить beads git-flow, оставить custom — требует конфигурации beads, чтобы не устанавливал hooks
3. Заменить custom на beads — рекомендуется beads maintainer'ами

### Принятое решение
Вариант 3 — заменить. Причина: beads активно развивается, custom-git-hooks — legacy.

### Реализация
- Бэкап .claude/hooks/git-*.js → .claude/hooks/_archive/
- Установлен beads@1.2.0
- Verified: pre-commit и post-commit работают через beads

### Итог
✅ Работает с 2026-05-01. Регрессий не обнаружено.

### Уроки
- При добавлении инструмента с hooks — всегда проверять .claude/hooks/ на конфликты
- Git-flow hooks это типовая зона конфликта; добавить проверку в /integrator:add pre-check
```

### 6.3. Типы записей

- `#tool-add` / `#tool-remove` / `#tool-replace` / `#tool-update`
- `#conflict-resolution` — два инструмента претендуют на одну PMO-зону
- `#contract-design` — создание нового контракта
- `#drift-fix` — починка сломанного контракта после обновления
- `#error-fix` — решение runtime-ошибки инструмента
- `#rollback` — откат неудачного изменения

### 6.4. Использование журнала

- При новых `/integrator:*` командах Integrator **читает релевантные записи журнала** и учитывает уроки
- Пример: «Пользователь хочет добавить beads повторно — смотрим DEC-INT-0042, знаем про git-hooks конфликт, предупреждаем заранее»

---

## 7. Детальные UX-сценарии

### 7.1. Research flow (NEW — по запросу пользователя)

```
> /integrator:research "нужны инструменты для работы с PostgreSQL"

[Integrator]
Определяю PMO-зону твоей потребности...
  → Похоже, речь о D3 (Development) + D5 (Operations):
    D3-06 Database Migrations (часть Deployment & Release Execution)
    D3 — прямой доступ к БД из кода
    D5 — monitoring БД в production (опционально)

Исследую рынок (~3 мин)...

Найдено 12 инструментов. Отфильтровал по совместимости с твоим стеком 
(Node.js, cc-sdd, git workflow) и популярности. Топ-5:

┌────────────────────────────────────────────────────────────────────┐
│ ИНСТРУМЕНТ      │ PMO ЗОНА        │ ПЛЮСЫ              │ МИНУСЫ    │
├────────────────────────────────────────────────────────────────────┤
│ Postgres MCP    │ D3 (query),     │ MCP-нативен,       │ Только    │
│                 │ D5 (inspect)    │ low overhead       │ read      │
├────────────────────────────────────────────────────────────────────┤
│ Prisma          │ D3-06           │ TypeScript-native, │ Требует   │
│                 │ (migrations)    │ type-safe queries  │ schema    │
│                 │                 │                    │ файла     │
├────────────────────────────────────────────────────────────────────┤
│ Drizzle         │ D3-06           │ Легковесный,       │ Меньше    │
│                 │                 │ schema-first       │ community │
├────────────────────────────────────────────────────────────────────┤
│ Knex            │ D3-06           │ Query-builder      │ Устарев.  │
│                 │                 │ универсал          │ паттерны  │
├────────────────────────────────────────────────────────────────────┤
│ pg-prom (prod)  │ D5              │ Metrics exporter,  │ Требует   │
│                 │                 │ Prometheus-compat  │ infra     │
└────────────────────────────────────────────────────────────────────┘

Мои рекомендации:
  1. **Для разработки:** Postgres MCP + Prisma (или Drizzle)
     - Postgres MCP для интерактивных query
     - Prisma для type-safe migrations и queries в коде
     - Совместимы: MCP работает на чтение, Prisma — основной ORM
  
  2. **Для prod мониторинга:** отложи до MVP — рано.
  
Мои сомнения:
  - Prisma vs Drizzle — оба хороши. Prisma mature, Drizzle быстрее.
    Хочешь сравнение подробнее? /integrator:research "Prisma vs Drizzle"
  - Postgres MCP ещё в раннем состоянии, API может меняться.

Что делаем?
  [1] Установить Postgres MCP + Prisma       (рекомендация)
  [2] Установить Postgres MCP + Drizzle
  [3] Установить только Postgres MCP
  [4] Ничего, я подумаю
  [5] Углубиться в конкретный инструмент: /integrator:research <tool>

Твой выбор?
```

Research не устанавливает ничего. Пользователь может принять решение, запустить `/integrator:add`, или ещё обсудить.

### 7.2. Add flow (подробный)

```
> /integrator:add cc-sdd@latest

[Integrator]
Этап 1/6: Профилирование
─────────────────────────────
Читаю документацию cc-sdd...
  → npm-пакет, версия 2.1.0
  → Категория: spec-gen (D2-Technical)
  → Commands: /kiro:steering, /kiro:spec-init, /kiro:spec-requirements, 
    /kiro:spec-design, /kiro:spec-tasks, /kiro:validate-*
  → Agents: kiro-spec-*, kiro-validate-*, kiro-steering
  → Coverage: D2-T01 Architecture Design, D2-T04 API Contract Design (embedded), D2-T06 Task Decomposition
  → Boundary (consumed via handoff, not owned): D2-B02 Feature Specification (Product Module владеет)
  → Doesn't cover: D2-B04 UI Design (наш Design Module делает), 
                   D3 Implementation (нужен отдельный tool)

Проверяю текущий стек... 
  → Product Module установлен (.product/)
  → Integrator пока не подключал D2-Tech инструмент — место свободно.
  → Gap в D3 Implementation остаётся — нужен отдельный инструмент потом.

✓ Профиль готов. См. ~/.claude/integrator/tool-catalog/cc-sdd.yaml

Этап 2/6: Анализ контрактов (нужно создать)
─────────────────────────────
Будут созданы 2 контракта:
  1. Product Module handoff.md → cc-sdd spec-init
     (критично: cc-sdd будет читать .product/handoffs/*)
  2. cc-sdd spec-tasks.md → task tracker (пока не подключён, отложено)

Approve подключение и создание контрактов? (y/n)
> y

Этап 3/6: Установка
─────────────────────────────
  - npx cc-sdd@latest --claude-agent --lang ru ✓
  - Verify: /kiro:steering доступна ✓
  - Verify: все 12 команд зарегистрированы ✓

Этап 4/6: Конфигурация
─────────────────────────────
  - Добавил cc-sdd в .claude/integrator/active-tools.yaml
  - Создал pmo-mapping.yaml entry: cc-sdd → D2-Technical
  - Наследовал глобальные настройки модели (Haiku 4.5)

Этап 5/6: Контракты
─────────────────────────────
  - Создан контракт CNT-001: product-handoff → cc-sdd spec-init
    (адаптер: .claude/integrator/adapters/handoff-to-ccsdd.js — basic)
  - Документация для Orchestrator: .claude/integrator/tool-docs/cc-sdd.md

Этап 6/6: Smoke test
─────────────────────────────
  - Создал тестовую фичу FM-TEST
  - Запустил handoff → cc-sdd spec-init
  - cc-sdd принял ✓
  - .kiro/specs/test-feature/spec.json создан ✓

Итог
─────────────────────────────
✅ cc-sdd@2.1.0 успешно подключён к D2-Technical.
📝 Решение записано в журнал: DEC-INT-0055
📄 Документация для Orchestrator: .claude/integrator/tool-docs/cc-sdd.md
⏳ Gaps остались: D3 (Implementation) — запусти /integrator:research "implementation tool"

Test-фича удалена. Готово!
```

### 7.3. Debug flow (OQ-I4)

```
> /integrator:debug "cc-sdd spec-design крашится на фиче FM-007" --tool cc-sdd

[Integrator]
Изучаю ошибку...

Читаю журнал по cc-sdd (5 записей)...
  - DEC-INT-0055: первая установка, без проблем
  - DEC-INT-0061: обновление до 2.2.0 — с тех пор жалоб нет

Читаю контракты cc-sdd...
  - CNT-001 (handoff → spec-init): active
  - CNT-003 (spec-tasks → beads): active
  - CNT-004 (handoff → spec-design): active ← сюда смотрим

Проверяю FM-007 handoff...
  → handoff.md status=ready ✓
  → Но: handoff содержит MK-002 references
  → MK-002 использует новый формат (Design Package) — Чат 5 изменения
  → CNT-004 создан до Чата 5, не знает про MK Design Package

Гипотеза:
  Адаптер в CNT-004 передаёт MK-* как тонкий reference (figma_url),
  но FM-007 MK-002 — это полноценный Design Package без figma_url.
  cc-sdd получает пустую ссылку и крашится.

Предлагаемое решение:
  - Обновить CNT-004 адаптер (handoff-to-ccsdd-design.js)
  - Научить его парсить Design Package
  - Fallback: если figma_url отсутствует — передавать Screen Inventory как markdown

Risks:
  - Изменение адаптера может сломать старые фичи (FM-001..006). 
    Проверю совместимость.

Approve исправление? (y/n)
> y

Применяю...
  - Обновил адаптер ✓
  - Запустил regression test на FM-001..006 ✓
  - Запустил FM-007 заново ✓ — прошло

Записано в журнал: DEC-INT-0073
Уроки:
  - При обновлении артефактной модели (MK redefinition) проверять ВСЕ 
    существующие контракты, а не только те, что явно затронуты
  - Добавить в /integrator:verify проверку на schema drift артефактов

Готово!
```

### 7.4. Update flow (OQ-I6)

```
> /integrator:update cc-sdd

[Integrator]
Текущая версия cc-sdd: 2.1.0
Проверяю доступные обновления...
  → Последняя: 2.3.0
  → Changelog: 
    - 2.2.0: BREAKING: spec-requirements format изменён (2-column → 3-column)
    - 2.3.0: Добавлен /kiro:spec-review

Анализ влияния на контракты:
  - CNT-001 (handoff → spec-init): НЕ затронут ✓
  - CNT-003 (spec-tasks → beads): возможно затронут (schema может измениться)
  - CNT-004 (handoff → spec-design): возможно затронут

Approve обновление до 2.3.0 с возможной переделкой контрактов? (y/n)
> y

Этап 1/5: Backup
  - .claude/hooks/cc-sdd-* → _backup/
  - .claude/commands/kiro/ → _backup/
  - active-tools.yaml — snapshot сохранён

Этап 2/5: Установка
  - npx cc-sdd@2.3.0 --claude-agent --lang ru ✓

Этап 3/5: Drift detection
  - CNT-001: valid ✓
  - CNT-003: BROKEN ✗ (spec-requirements 3-column не парсится)
  - CNT-004: valid ✓

Этап 4/5: Contract repair
  Обновляю CNT-003:
  - Адаптер: spec-requirements-to-beads.js
  - Добавлена поддержка 3-column формата
  - Сохранена обратная совместимость для старых файлов

Этап 5/5: Verify
  - Regression test на FM-001..010 ✓
  - /kiro:spec-review доступна (новая команда) ✓

Итог
─────────────────────────────
✅ cc-sdd обновлён 2.1.0 → 2.3.0
✅ CNT-003 обновлён
✅ Новая команда /kiro:spec-review зарегистрирована
📝 DEC-INT-0089

Документация для Orchestrator обновлена.
```

### 7.5. Replace flow

```
> /integrator:replace cc-sdd kiro

[Integrator]
Планирую замену cc-sdd → kiro.

Текущее покрытие cc-sdd: D2-T01, D2-T04, D2-T06
Предварительный профиль kiro...
  → Покрытие: D2-T01, D2-T04, D2-T06 ✓ (всё, что cc-sdd покрывал)
  → Дополнительно: D2-T03 Data Model Design ✓ (cc-sdd не делал)
  → НО: не покрывает D2-B05 Adversarial Review
        (это зона Product Module, не tool-side; cc-sdd её тоже не покрывал)

Контракты после замены:
  - CNT-001 (handoff → spec-init) → нужно переделать под kiro формат
  - CNT-003 (spec-tasks → beads) → нужно переделать
  - CNT-004 (handoff → spec-design) → нужно переделать

Data migration:
  - .kiro/ папка (продукты cc-sdd) не читаема для kiro-tool
  - Kiro использует .product-design/ (своё)
  - Стратегия: существующие фичи оставить в .kiro/ до release,
    новые фичи писать в .product-design/
  (alternatively: конверсионный скрипт, но это большая работа)

Risks:
  - Adversarial Review потеряется — нужен ручной fallback или отдельный инструмент
  - Миграция данных не автоматическая

Approve замену? (y/n/details)
> details

[Integrator показывает подробности: список всех активных fich, 
их текущее состояние, как будут обрабатываться после миграции...]

> n, давай пока оставим cc-sdd, но посмотрим D2-B05 покрытие отдельно

Отмена replace. Но предложение записано в журнал как DEC-INT-0094 (entered/cancelled)
для будущей памяти. Хочешь /integrator:research "adversarial review tool"? (y/n)
```

### 7.6. Consilium-pattern research (DEC-DEV-0047 / patch 1.3.3)

**Что это:** «Consilium» — паттерн, когда research разветвляется на N parallel research priors с разными bias anchors (например: «DIY стэк / PaaS / RU-friendly стэк»). Каждая prior — отдельный sub-research, потом результаты сравниваются.

**Когда легитимен:** consilium-pattern полезен, когда decision involves trade-offs across mutually-exclusive directions (cost vs control vs jurisdiction vs vendor lock-in), и user заранее объявил scope priors. Каждый prior дает structured framing того же question.

**Жёсткое требование — declared scope:**

Consilium разрешён **только** при scope, явно объявленном до start. «Scope» включает:
- **Предмет** — что именно сравнивается (e.g., «deploy stacks для small-traffic SaaS»)
- **Priors** — список direction labels (e.g., `[DIY-VPS, PaaS-managed, RU-jurisdiction-friendly]`)
- **Expected output structure** — common comparison axes (cost, control, complexity, vendor risk, etc.)

**Без declared scope:** если research-protocol Phase 5 detects subagent fan-out > 1 без declared scope — обязан **STOP + возразить + спросить user**:

```
⚠ Consilium-pattern detected (N=3 parallel research priors), но scope не объявлен.
Это violation /integrator:research дисциплины (SPEC §7.6 / DEC-DEV-0047).

Перед продолжением:
  - Объяви scope явно: subject, priors (направления сравнения), expected axes
  - Или сведи к single research stream

Что делаем? [1] объявить scope / [2] single research / [3] отмена]
```

**Anti-pattern (pilot session 2026-05-27 evidence):** «Сравнить deploy стэки» → AI самостоятельно генерирует 3 priors (DIY/PaaS/RU-friendly) + автономно выбирает «Пакет 1 (DIY)» без approve gate. Это нарушение: ни scope, ни approve gate явных не было; AI architectural decision принят silent.

**Reference enforcement:** `skills/integrator/research-protocol.md` Phase 5 (post-comparison, pre-cache) — must check «is this single-stream OR consilium-with-declared-scope?»; если ни то, ни то — block с outline above.

**Approve gate identical:** обычный или consilium — после presentation MUST be explicit user choice (numbered option / defer / details) перед записью в journal (см. §3.1 amendment). Consilium НЕ освобождает от approve gate; наоборот, **усиливает**, потому что выбор между priors — это явное architectural decision.

---

## 8. Interaction с Product Module и Orchestrator

### 8.1. С Product Module

**Integrator потребляет от Product Module:**
- `handoff.md` (universal) — как инструкцию для настройки D2-Tech инструмента
- Структура `.product/` — как источник истины о PMO-зонах

**Integrator не трогает:**
- Артефакты в `.product/`
- Процессы Product Module (`/product:*`)

**Взаимодействие:**
- При первом `/integrator:add` D2-Tech инструмента — Integrator читает пример handoff.md чтобы понять формат
- При `/integrator:update` — проверяет, не сломалась ли совместимость с handoff

### 8.2. С будущим Orchestrator Module

**Что Integrator отдаёт Orchestrator:**
- `.claude/integrator/tool-docs/<tool>.md` — полный manual на инструмент:
  - Какие команды доступны
  - Какие входы ожидает / выходы производит
  - Как запускать программно
  - Known issues
  - Integration points с другими инструментами
- `active-tools.yaml` + `pmo-mapping.yaml` — состояние инфраструктуры
- `contracts/*` — как инструменты общаются

**Формат tool-docs.md (для Orchestrator):**
```markdown
# cc-sdd — Operating Manual

## Identity
- Version: 2.3.0
- Category: spec-gen (D2-Technical)
- Installed: 2026-05-01, last updated 2026-05-20

## Capabilities (PMO zones covered)
- D2-T01: Architecture Design via /kiro:spec-design
- D2-T04: API / Interface Contract Design (embedded in spec-design)
- D2-T06: Task Decomposition via /kiro:spec-tasks

## Boundary (consumed, not owned)
- D2-B01: Project Context — `/kiro:steering` consumes; behavioral context owned by Product Module
- D2-B02: Feature Specification — consumed via handoff.md → /kiro:spec-init; owned by Product Module

## Commands API
### /kiro:steering [--scope <product|tech|structure>]
- Input: currently empty or existing steering files
- Output: .kiro/steering/*.md
- Exit codes: 0 success, 1 config error, 2 disk error
- Runtime: 30-60s typical

... (таблица для всех команд)

## Integration Points
### Input: Product Handoff
- Expected at: (invoked via CNT-001 adapter)
- Schema: see contracts/product-handoff-universal.yaml
- Adapter: .claude/integrator/adapters/handoff-to-ccsdd.js

### Output: Spec files
- Location: .kiro/specs/{feature}/
- Consumers: (see CNT-003, CNT-004)

## Known Issues
- Windows: требует WSL для корректной работы bash-scripts
- Performance: spec-design может занимать >3 мин на больших фичах

## Operating Protocols (for Orchestrator)
- Always call /kiro:steering before any spec-* on fresh project
- spec-requirements должна предшествовать spec-design
- Parallel spec-tasks не рекомендуется (race condition в spec.json)

## Troubleshooting
- Если /kiro:spec-init не создаёт spec.json — проверить права на .kiro/
- Если timeout — увеличить CLAUDE_CODE_TIMEOUT в config
```

Orchestrator в будущем будет читать этот файл и понимать, как ТОЧНО запустить инструмент в нужной последовательности.

### 8.3. Граница ответственности

| Действие | Integrator | Orchestrator (будущий) | Product Module |
|---|---|---|---|
| Установить инструмент | ✅ | ❌ | ❌ |
| Настроить инструмент | ✅ | ❌ | ❌ |
| Создать контракты | ✅ | ❌ | ❌ |
| Завести role-агента + предметный skill под зону (DEC-DEV-0060) | ✅ (capability) | ❌ (запрашивает) | ❌ |
| Запустить инструмент в сценарии | ❌ | ✅ | ❌ |
| Исполнить инфра-шаг (deploy/provision БД) оснащённой capability | ❌ | ✅ | ❌ |
| Решить какой инструмент использовать | Предлагает | Выбирает | ❌ |
| Записать в `.product/` | ❌ | ❌ | ✅ |
| Починить сломанный инструмент | ✅ | Поднимет флаг | ❌ |
| Классификация задач пользователя | ❌ | ✅ | ❌ |

---

## 9. Фазы реализации

> **Source of truth по phasing — [`ROADMAP.md`](../../ROADMAP.md).** Этот SPEC описывает steady-state архитектуру модуля; порядок и scope реализации трекает ROADMAP. Раздел ниже — логическая группировка возможностей, не план релизов.

Модуль логически разбит на 4 группы. Маппинг на ecosystem-фазы (актуальный — в ROADMAP):

| Группа | Возможности | Ecosystem phase |
|---|---|---|
| **Read-only** | `/integrator:research`, `:map`, `:gaps`, `:status`, `:journal`, `:scan`; skills research-protocol + tool-profiling; subagent tool-researcher | Phase 1 ✅ |
| **Installation** | `/integrator:add`, `:remove`, `:replace`; skills installation-protocol + contract-design; journal hook | Phase 5 |
| **Maintenance** | `/integrator:verify`, `:debug`; drift-detection skill + hook | Phase 7 |
| **Export для Orchestrator** | `/integrator:docs`; tool-docs generator | Phase 7 |

**Открытый вопрос (Phase 5 kickoff):** `/integrator:update` — ROADMAP относит его к Phase 5 (вместе с Installation, acceptance «detects drift»), историческая группировка модуля — к Maintenance. Финальное размещение подтверждается на kickoff (см. `dev/PHASE_5_READINESS.md` §C.6).

**Что даёт каждая группа:**
- *Read-only* — изучать инструменты и видеть gaps, ничего не ломая.
- *Installation* — подключать инструменты под PMO; пилот на cc-sdd.
- *Maintenance* — долгоживущая инфраструктура: обновления, починки.
- *Export* — фундамент для будущего Orchestrator Module.

---

## 10. Файловая структура

### Глобальная (`~/.claude/integrator/`)
```
~/.claude/integrator/
├── tool-catalog/                     # накопленные профили
│   ├── cc-sdd.yaml
│   ├── beads.yaml
│   └── ...
├── decision-journal.md               # глобальные уроки
├── research-cache/                   # кешированные research результаты
│   ├── 2026-05-20-postgresql-tools.md
│   └── ...
└── contract-templates/               # шаблоны контрактов
    ├── spec-gen-to-implementation.yaml
    ├── product-handoff-universal.yaml
    └── ...
```

### Локальная (`.claude/integrator/` в проекте)
```
.claude/integrator/
├── active-tools.yaml                 # что подключено сейчас
├── pmo-mapping.yaml                  # кто что покрывает
├── contracts/                        # активные контракты
│   ├── CNT-001-product-handoff-to-ccsdd.yaml
│   ├── CNT-001-product-handoff-to-ccsdd.md
│   └── ...
├── adapters/                         # скрипты трансформации
│   ├── handoff-to-ccsdd.js
│   └── ...
├── tool-docs/                        # для Orchestrator
│   ├── cc-sdd.md
│   └── ...
└── project-journal.md                # решения по этому проекту
```

### Примитивы в `.claude/`
```
.claude/
├── commands/integrator/
│   ├── research.md
│   ├── add.md
│   ├── map.md
│   ├── gaps.md
│   ├── remove.md
│   ├── replace.md
│   ├── update.md
│   ├── verify.md
│   ├── debug.md
│   ├── journal.md
│   ├── docs.md
│   └── status.md
├── agents/integrator/
│   ├── tool-researcher.md            # research subagent
│   ├── tool-profiler.md              # add/update profiling
│   └── contract-designer.md          # contract creation
├── skills/integrator/
│   ├── research-protocol.md
│   ├── tool-profiling.md
│   ├── contract-design.md
│   └── drift-detection.md
└── hooks/integrator/
    ├── journal-hook.js                # PostToolUse — журналирование решений
    ├── drift-check.js                 # SessionStart — drift detection
    ├── contract-validate.js           # PreToolUse — блокировки контрактов
    └── manifest.yaml                  # auto-registration (см. hooks/product/manifest.yaml)
```

---

## 11. Открытые вопросы (OQ-I8..)

Эти вопросы осталось проработать в процессе реализации:

**OQ-I8:** Процедура "первого запуска" Integrator в новом проекте → **ЗАКРЫТО (2026-04-17):** ленивое создание при первом `/integrator:add`. Скелетная структура `.claude/integrator/` появляется автоматически при первой команде с side effects. Read-only команды (`/integrator:research`, `/integrator:map`, `/integrator:gaps`) не создают локальных файлов — ссылаются на глобальный каталог.

**OQ-I9:** Multi-tool в одной PMO-зоне
- Может ли D3-01 покрываться двумя инструментами одновременно (например, beads + superpowers для разных случаев)?
- Если да — как выбирает Orchestrator? Правила в контрактах?

**OQ-I10:** Security & secrets → **ЗАКРЫТО (2026-04-17):** начинаем с простого файлового хранения. Секреты в `.claude/integrator/secrets/<tool>.env` с gitignore. В v1 не привязываемся к 1Password/Vault, но оставляем структуру расширяемой (поле `storage_backend` в tool profile → пока всегда `file`). Интеграция с менеджерами секретов — итерация позже.

**OQ-I11:** Откат глобального каталога
- Глобальный каталог обновляется между проектами
- Как восстановить старую версию профиля, если новая провалилась?

**OQ-I12:** Отношения с существующими внешними конфигами → **ЗАКРЫТО (2026-04-17):** встроенный механизм анализа (см. §13 Environment Scanner).

**OQ-I13:** Язык tool-docs → **ЗАКРЫТО (2026-04-17):** универсальный технический английский, по стилю — API reference документация (см. §14 Tool-Docs Style Guide).

---

## 12. Чек-лист готовности к имплементации

> ⓘ «Фаза N» — группы из §9 (1 = Read-only, 2 = Installation, 3 = Maintenance, 4 = Export). Порядок реализации и маппинг на ecosystem-фазы — в [`ROADMAP.md`](../../ROADMAP.md).

**Перед стартом Фазы 1:**
- [x] Принять этот SPEC в целом (v1.0)
- [x] OQ-I8 (init процедура) → ЗАКРЫТО (DEC-INT-O08, lazy-init)
- [x] OQ-I13 (язык tool-docs) → ЗАКРЫТО (DEC-INT-O13, universal technical English)
- [x] Skeleton `~/.claude/integrator/` создаётся автоматически через `/ecosystem:bootstrap` или лениво при первом `/integrator:add`

**Перед стартом Фазы 2:**
- [x] Product Module MVP готов — Phase 0-4 shipped, handoff доступен
- [x] Пилотный инструмент выбран — cc-sdd

**Перед стартом Фазы 3:**
- [ ] Хотя бы 2 инструмента подключены через Фазу 2 (для осмысленного verify)

**Перед стартом Фазы 4:**
- [ ] Концепт Orchestrator Module продуман (чтобы знать, что именно ему нужно от tool-docs)

---

## 13. Environment Scanner (OQ-I12)

Встроенный механизм, который Integrator запускает ДО любого изменения инфраструктуры — чтобы не сломать то, что уже есть у пользователя.

### 13.1. Когда запускается

- **Всегда** перед `/integrator:add` (pre-install check)
- **Всегда** перед `/integrator:update`, `/integrator:replace`
- **При первом запуске** любой команды в проекте (snapshot baseline)
- **Вручную** через `/integrator:scan` (добавлена 13-я команда)

### 13.2. Что сканируется

| Зона | Что ищет | Зачем |
|---|---|---|
| `.claude/hooks/*` | Все существующие хуки (JS, TS, shell) | Детект конфликтов при установке инструмента с хуками |
| `.claude/commands/*` | Существующие slash-команды | Детект namespace-коллизий (`/kiro:*` уже занят?) |
| `.claude/agents/*` | Субагенты | Детект дубликатов по роли |
| `.claude/skills/*` | Skills | Детект перекрытия методологий |
| `.claude/settings.json` | Конфигурация хуков, permissions | Понять текущую политику |
| `.mcp.json` / MCP registry | Подключённые MCP | Не переустанавливать уже существующий |
| `package.json` | npm-зависимости | Детект версионных конфликтов |
| `.gitignore` | Что игнорируется | Убедиться, что `.claude/integrator/secrets/` добавлен |
| `~/.claude/memory/` | Глобальная память пользователя | Читает для контекста; не пишет сюда |

### 13.3. Output: Environment Baseline

После сканирования Integrator создаёт/обновляет `.claude/integrator/baseline.yaml`:

```yaml
scanned_at: 2026-05-01T14:30:00Z
scan_trigger: pre-install-cc-sdd

existing:
  hooks:
    - path: .claude/hooks/custom-git-precommit.js
      author: user
      purpose: "guess: git workflow"
      modified: 2026-04-15
    - path: .claude/hooks/typecheck.sh
      author: user
      purpose: "guess: TS typecheck"
  commands:
    namespaces_in_use: [custom, git]
  agents:
    - path: .claude/agents/custom-reviewer.md
  mcps_installed:
    - name: sequential-thinking
      version: latest
    - name: firecrawl
      version: 0.5.0

integrator_owned:
  # пусто если Integrator ещё не запускался в этом проекте

conflicts_detected: []         # заполняется по требованию конкретной команды
user_customizations_to_preserve:
  - .claude/hooks/custom-git-precommit.js
  - .claude/hooks/typecheck.sh
  - .claude/agents/custom-reviewer.md
```

### 13.4. Алгоритм детекции конфликтов

При `/integrator:add <tool>`:

1. Получить `tool.claude_primitives[]` из профиля (что инструмент собирается добавить)
2. Для каждого примитива:
   - Если файл/namespace уже существует:
     - Это `integrator_owned`? → просто обновляем
     - Это `user_customizations_to_preserve`? → **КОНФЛИКТ**, требует решения:
       - [1] Заменить пользовательский хук хуком инструмента
       - [2] Оставить пользовательский, инструмент без этого хука (если поддерживается)
       - [3] Переименовать пользовательский (backup) и использовать инструмент
       - [4] Отменить установку
   - Если не существует → ок, инструмент добавит свой

3. Логировать всё в Environment Baseline + decision journal

### 13.5. «Guess purpose» для пользовательских файлов

Integrator не знает точно, зачем пользователь добавил `custom-git-precommit.js`. Но делает догадку:
- Читает первые 20 строк файла (если текстовый)
- Если есть комментарий `// Purpose: ...` или JSDoc — использует его
- Если есть git log — смотрит последний commit message
- Если есть в `settings.json` matcher для этого хука — использует его event type
- Если ничего не помогло — помечает `purpose: "unknown, needs user clarification"`

Для unknown файлов перед действием всегда спрашивает человека: «файл `X` — что он делает? Можно удалить/переместить?»

### 13.6. Бэкап перед изменениями

Любое изменение пользовательского файла → бэкап в `.claude/integrator/backups/<timestamp>/`. Journal фиксирует путь бэкапа. При rollback через `/integrator:debug` можно восстановить.

---

## 14. Tool-Docs Style Guide (OQ-I13)

Документация в `.claude/integrator/tool-docs/<tool>.md` предназначена для Orchestrator Module, который **не знает**, что делает инструмент, и **не знает**, какой проект строится. Но ему нужно **использовать** инструмент корректно.

### 14.1. Принципы

1. **Язык: универсальный технический английский.**
   Не русский, не разговорный. Это спецификация для машины (Orchestrator — AI-агент) и возможного человека-разработчика, приходящего извне проекта.

2. **Стиль: API reference.**
   Короткие определения, таблицы, сигнатуры команд, exit codes, примеры. Никаких введений и «зачем это нужно». Tool уже здесь — Orchestrator'у нужно понять как пользоваться.

3. **Независимость от проекта.**
   Tool-docs не упоминает `TranslateIT`, конкретные FM-ID, особенности этого продукта. Только сам инструмент и его интерфейс.

4. **Контрактно-ориентированность.**
   Фокус на inputs/outputs/side effects/exit codes. Всё, что Orchestrator должен знать, чтобы вызвать инструмент и обработать результат.

5. **Версионированность.**
   Всегда указывается версия инструмента и дата последней проверки.

### 14.2. Обязательная структура

```markdown
# <tool-name> — Operating Manual

## Identity
- **Tool:** cc-sdd
- **Version:** 2.3.0
- **Source:** npm (npx cc-sdd@2.3.0)
- **Installed:** 2026-05-01
- **Last verified:** 2026-05-20
- **Profile:** ~/.claude/integrator/tool-catalog/cc-sdd.yaml
- **Category:** spec-generation (D2-Technical)

## Capabilities
Table: PMO zone × command × confidence × evidence.

## Commands
For each command:
- **Signature:** `/kiro:spec-design [options]`
- **Inputs required:** files, env vars, preceding state
- **Outputs produced:** files created, state changes
- **Exit codes:** 0 | 1 | 2 | ... with meaning
- **Runtime estimate:** typical and max
- **Idempotent:** yes/no
- **Parallelizable:** yes/no (and with what)
- **Example invocation:** minimal working example
- **Example output:** excerpt

## Data Flow
- **Consumes from:** list of contracts (CNT-*)
- **Produces for:** list of contracts (CNT-*)
- **Ownership:** which directories it writes

## Integration Points
- **Preceded by:** tools/commands that must run before
- **Followed by:** typical next steps
- **Parallel-safe with:** tools that can run concurrently

## Operating Protocols
- Order-of-operations rules (e.g., "always steering before spec-*")
- Session guarantees (fresh context? preserved state?)
- Resource constraints (max file size, token limits)

## Known Issues
- Issue: description
  - Workaround: steps
  - Status: open/fixed in vX.Y

## Error Catalog
| Error | Meaning | Orchestrator action |
|---|---|---|
| ERR001 | Config missing | Re-run /integrator:verify |
| ERR002 | Stale lock | Delete .lock file, retry once |

## Telemetry
- Log location
- Metrics exposed
- Health check command
```

### 14.3. Что НЕ пишем в tool-docs

- Истории/обоснования «почему выбрали этот инструмент» → это в decision journal
- Сравнения с альтернативами → это в research cache
- Наш конкретный use case → это в product handoff
- Бизнес-контекст → это в `.product/`

### 14.4. Генерация и актуализация

- При `/integrator:add` — автогенерация первой версии (Integrator пишет по шаблону на основе profile + smoke test observations)
- При `/integrator:update` — diff changelog → обновление соответствующих секций
- Ручное редактирование разрешено; Integrator при регенерации сохраняет секции с маркером `<!-- manual: do not regenerate -->`

### 14.5. Пример: минимальный tool-docs для cc-sdd

(готовится при первом `/integrator:add cc-sdd`, здесь сокращённо)

```markdown
# cc-sdd — Operating Manual

## Identity
- Tool: cc-sdd
- Version: 2.3.0
- Source: npm
- Installed: 2026-05-01
- Category: spec-generation (D2-Technical)

## Commands

### /kiro:spec-init <feature-name>
- Input: feature name (slug); optional product-handoff.md path
- Output: .kiro/specs/<feature>/spec.json (phase=init)
- Exit: 0 ok | 1 config | 2 filesystem
- Runtime: 5-15s
- Idempotent: no (overwrites existing spec.json)

### /kiro:spec-requirements
- Input: .kiro/specs/<feature>/spec.json (phase=init)
- Output: requirements.md (EARS format), spec.json (phase=requirements)
- Exit: 0 | 1 | 2
- Runtime: 30-90s
- Idempotent: yes (re-runnable, replaces output)

## Operating Protocols
- ALWAYS /kiro:steering before first spec-* in fresh project
- spec-requirements MUST precede spec-design
- No parallel spec-* on same feature (race on spec.json)

## Known Issues
- Windows: requires WSL for bash scripts
```

Orchestrator читает это, знает когда и как вызывать команду.

---

## 15. MCP-стэк и расширенные примитивы Claude Code

> Цель: сделать Integrator максимально «прокачанным» с точки зрения доступных возможностей, но с понятным fallback, если MCP недоступны.

### 15.1. Core MCP-стэк (обязателен для полноценной работы)

**MCP-1: Sequential Thinking** (`modelcontextprotocol/sequentialthinking`)
- **Используется в:** research (сравнение инструментов), add (profiling), update (impact analysis), debug (root-cause)
- **Зачем:** структурирует multi-step reasoning, разделяет гипотезы от выводов, позволяет вернуться и уточнить шаг
- **Fallback:** встроенное thinking Claude — хуже структурирует, больше risk смешать contextы

**MCP-2: Context7** (`@upstash/context7`)
- **Используется в:** profiling (первый взгляд на npm/pip/cargo пакет), update (актуальные docs для новой версии)
- **Зачем:** даёт realtime официальную документацию пакета по ID, не устаревая с training cutoff
- **Fallback:** Firecrawl по docs-URL (медленнее, ненадёжнее)

**MCP-3: GitHub Official MCP** (`github/github-mcp-server`)
- **Используется в:** profiling (README, releases, contributors), research (оценка активности), debug (known issues), update (changelog diff)
- **Зачем:** структурированный доступ к репо без скрейпинга
- **Fallback:** Firecrawl по github.com URL (теряет structure, rate limits)

**MCP-4: Firecrawl** (`firecrawl-mcp`)
- **Используется в:** research (сравнительные обзоры, blog posts), profiling (не-Context7 docs), debug (SO posts)
- **Зачем:** рендерит JS, извлекает main content, структурирует таблицы
- **Fallback:** WebFetch — работает, но грубее

**MCP-5: Brave Search** (`brave-search-mcp`)
- **Используется в:** research (первичный keyword lookup), debug (поиск похожих ошибок)
- **Зачем:** быстрее и дешевле Firecrawl для первого прохода
- **Fallback:** WebSearch

**MCP-6: Memory** (`modelcontextprotocol/memory`)
- **Используется в:** journal (как knowledge graph), cross-project learnings, pattern detection
- **Зачем:** Integrator может семантически искать прошлые решения («были ли конфликты с git-hooks раньше?»)
- **Fallback:** только файловый journal + grep по нему
- **Комментарий:** дополняет, не заменяет файловый journal — файловый читаем человеком, MCP поиск — Integrator'ом

### 15.2. Рекомендуемый расширенный стэк

**MCP-7: Exa AI** (`exa-labs/exa-mcp-server`)
- **Используется в:** research (семантический поиск по описанию потребности), debug (похожие паттерны проблем)
- **Зачем:** когда пользователь описывает потребность концептуально, keyword-поиск плох
- **Fallback:** Brave + больше итераций reasoning

**MCP-8: Serena** (`oraios/serena`)
- **Используется в:** contract design (анализ реального API подключаемого инструмента), адаптеры (понимание функций инструмента)
- **Зачем:** symbolic code analysis — понимает сигнатуры, не текст
- **Fallback:** Bash + grep для navigation по исходникам инструмента

### 15.3. Ситуативный стэк (по необходимости)

**MCP-9: Playwright** (`microsoft/playwright-mcp`)
- **Когда включать:** при подключении инструмента с web-UI (Stitch, Figma, dashboards)
- **Используется в:** smoke test, verify (проверить что UI живой)
- **Fallback:** WebFetch для статических проверок; без UI-тестов если нет

**MCP-10: Filesystem** (`modelcontextprotocol/filesystem`)
- **Когда включать:** если нужны тонкие файловые операции без Bash
- **Обычно:** Bash достаточен
- **Fallback:** Bash

### 15.4. Отклонённые (не нужны Integrator'у)

- Postgres/MySQL/MongoDB MCPs — зона конкретного подключённого инструмента, не Integrator
- Sentry / Datadog MCPs — это D5 monitoring, не инфраструктура
- Docker MCP — инструмент-специфично
- Slack/Discord MCPs — вне зоны ответственности
- AWS/GCP MCPs — вне зоны ответственности

### 15.5. Расширенные примитивы Claude Code

**Memory directory** (`~/.claude/memory/integrator/`)
- Файлы с глобальными уроками, которые человек хочет читать глазами (дополнение к Memory MCP)
- Формат — как обычные memory files (frontmatter + content)
- Примеры: `integrator_feedback_git-hooks-conflicts.md`, `integrator_project_cc-sdd-preferred.md`

**Statusline**
- Отображает: количество активных инструментов, health контрактов, pending updates
- Пример: `🔧 5 tools ✓ | 📋 12 contracts ✓ | ⚠ 1 update pending`
- Обновляется через statusline hook при SessionStart и после `/integrator:*` команд

**Output styles**
- Единый формат для отчётов `/integrator:research`, `/integrator:map`, `/integrator:status`
- Консистентные таблицы, цвета для confidence levels, эмоджи для статусов
- Файл: `.claude/output-styles/integrator-report.md`

**ScheduleWakeup / периодические проверки**
- Интегратор сам себе планирует еженедельную `/integrator:verify --light`
- Детектит: новые версии подключённых инструментов, broken links в контрактах, stale profiles (>90 дней без verify)
- Через `mcp__scheduled-tasks__create_scheduled_task` или cron

**Plugins (community)**
- При research Integrator может обнаружить community-плагины, покрывающие нужную зону
- Маркирует их как `source: community-plugin` в профиле
- Дополнительная осторожность при установке: требует ручного approve всегда (не запоминает «yes to all»)

### 15.6. Матрица «команда → MCP»

| Команда | Core MCPs | Recommended | Situational |
|---|---|---|---|
| `/integrator:research` | SeqThink, Context7, Firecrawl, Brave | Exa | — |
| `/integrator:add` | SeqThink, Context7, GitHub, Memory | Serena (при custom integrations) | Playwright (web tools) |
| `/integrator:map` | Memory | — | — |
| `/integrator:gaps` | Memory, SeqThink | — | — |
| `/integrator:remove` | Memory | — | — |
| `/integrator:replace` | SeqThink, Context7, GitHub, Memory | Serena | Playwright |
| `/integrator:update` | Context7, GitHub, SeqThink, Memory | — | — |
| `/integrator:verify` | Memory | — | Playwright (для web tools) |
| `/integrator:debug` | SeqThink, GitHub, Firecrawl, Memory | Exa | — |
| `/integrator:journal` | Memory | — | — |
| `/integrator:docs` | SeqThink | Serena (для code-level) | — |
| `/integrator:status` | Memory | — | — |
| `/integrator:scan` | (только Bash/filesystem) | — | — |

### 15.7. Стратегия MCP-availability

**Graceful degradation:** Integrator детектит доступные MCP при старте и:
- Если Core MCP недоступен — сообщает пользователю, предлагает установку (через собственный `/integrator:add <mcp-name>`)
- Если Recommended/Situational недоступен — работает с fallback без явных жалоб
- Никогда не падает из-за отсутствия MCP; всегда есть fallback-путь через встроенные инструменты Claude

**Самоподдержка:** Integrator умеет устанавливать MCP сам — это просто частный случай `/integrator:add <mcp-tool>`. При первом запуске в проекте может предложить: «Хочешь установить рекомендуемый стэк для Integrator? (Sequential Thinking, Context7, GitHub, Firecrawl, Brave, Memory)».

### 15.8. Безопасность MCP-стэка

- **Rate limits:** Integrator кеширует ответы (research-cache) чтобы не перегружать MCP. Cache TTL: research — 7 дней, Context7 — 24 часа, GitHub releases — 1 час.
- **API keys:** ключи для MCP (Brave API key, Firecrawl token) хранятся в `.claude/integrator/secrets/mcp-*.env` (см. §OQ-I10 решение)
- **Fallback flags:** в конфиге можно отключить отдельные MCP принудительно (если нет доступа / nehотим использовать)

### 15.9. Итоговая рекомендация

Core стэк (6 MCP) — установить при первой активации Integrator'а. Это даёт ~90% возможностей. Остальное — по мере появления задач. Серверы community, публично известные, в большинстве своём бесплатные (Brave Search — freemium, остальные — open source).

---

**Конец спецификации.**

Статус: **готов к утверждению и началу Фазы 1.**
