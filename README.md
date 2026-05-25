# Ecosystem 3.0

> **PMO-слой для управления продуктовыми проектами через Claude Code.** Тонкий контроль D1-D2 (Discovery + Behavioral specification), tool-agnostic делегирование D2-Tech и D3-D6 внешним инструментам через универсальный handoff.

**Статус:** v1.3.0 — Phase 0-5 shipped (Discovery + Planning + Feature Enrichment + Handoff + Validation full + **Integrator Installation + first cc-sdd reference adapter**). Phase 5 implementation done (DEC-DEV-0041); runtime smoke S1-S6 + closure ritual Unit 2 pending. См. [CHANGELOG.md](CHANGELOG.md) и [ROADMAP.md](ROADMAP.md).
**Целевая аудитория:** solo-разработчики, ведущие продуктовые проекты с Claude Code как primary tool.

---

## Концепция в одной строке

Я детально контролирую процессы D1-D2 (продуктовая стратегия + поведенческая спецификация) через **Product Module** и **Design Module**, а внешние инструменты (D2-Technical, D3-D6) подключаются через **Integrator Module** и работают по принципу «я дал тебе всё о продукте через handoff — ты качественно выполнил свою зону».

## Четыре модуля

| Модуль | Ответственность | Статус |
|---|---|---|
| **Product Module** | D1 + D2-Behavioral: 22 типа артефактов, процессы P1-P5, handoff-генерация | ✅ SPEC v1.0 |
| **Design Module** | D2-B04 UI Design: итеративная генерация через Stitch/HTML, conditional на `has_ui=true` | ✅ SPEC v1.0 |
| **Integrator Module** | Подключение/замена внешних инструментов под PMO-карту («сисадмин») | ✅ SPEC v1.0 |
| **Orchestrator Module** | Запуск инструментов и оркестрация сценариев D3-D6 | 🔜 После Integrator MVP |

## Что входит в репозиторий

```
claude-ecosystem-3.0/
├── README.md, BOOTSTRAP.md, INSTALL-HUMAN.md, CHANGELOG.md, ROADMAP.md
├── install.sh, install.ps1                # global installers
├── .env.template, settings.json.template, gitignore.template
├── docs/                                   # SPECs (декларативная база)
│   ├── product-module/
│   ├── design-module/
│   ├── integrator-module/
│   └── pmo/
│       ├── pmo-map.md, processes.md, validation.md
│       └── artifacts/                      # 22 типа артефактов
├── commands/                               # slash-команды → .claude/commands/
│   ├── ecosystem/                          # /ecosystem:bootstrap, /ecosystem:verify
│   └── integrator/                         # /integrator:* (6 read-only)
├── skills/                                 # methodology → .claude/skills/
├── agents/                                 # subagents → .claude/agents/
├── hooks/                                  # automation → .claude/hooks/
├── output-styles/                          # → .claude/output-styles/
└── templates/                              # шаблоны (в т.ч. CLAUDE.md.template)
```

## Quick Start — двухфазная установка

### Фаза 1 — глобальная установка (один раз на машину)

**Unix / macOS / WSL:**

```bash
curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
iwr -useb https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.ps1 | iex
```

Что делает installer:
1. Клонирует репо в `~/.claude/ecosystem/` (глобальный кэш)
2. Копирует `commands/ecosystem/*.md` в `~/.claude/commands/ecosystem/`
3. После этого `/ecosystem:bootstrap` доступна в автокомплите в любой папке

### Фаза 2 — bootstrap в новом проекте

```bash
mkdir my-new-product && cd my-new-product
claude
```

В Claude Code:

```
> /ecosystem:bootstrap
```

Что произойдёт:
1. Клонирует ecosystem в `<project>/.claude/`
2. Инициализирует `.product/` skeleton
3. Запрашивает API-ключи интерактивно (см. [INSTALL-HUMAN.md](./INSTALL-HUMAN.md))
4. Генерирует `CLAUDE.md` в корне проекта (контекст для Claude Code)
5. Устанавливает Core MCP stack через `/integrator:add` (по одному approve)
6. Финальный `/integrator:status` → предлагает `/product:init`

**Перед Фазой 2** — пройди чеклист в [INSTALL-HUMAN.md](./INSTALL-HUMAN.md): получи API ключи (Brave, Firecrawl, Exa), при необходимости — Stitch project.

Подробности процесса bootstrap — в [`commands/ecosystem/bootstrap.md`](commands/ecosystem/bootstrap.md) и обзорно в [BOOTSTRAP.md](./BOOTSTRAP.md).

### Фаза 3 — обновление existing project (когда вышла новая версия ecosystem)

```
> /ecosystem:update --dry-run    # preview changes
> /ecosystem:update               # apply (с автобэкапом .claude/)
```

Sync ecosystem zone (commands, skills, agents, hooks, docs, templates) к latest upstream — rsync-style overwrite + delete obsolete + re-derive hooks. Preserves `.product/`, `.env`, `settings.local.json`, `product.yaml`, `integrator/` state. Подробности — [`commands/ecosystem/update.md`](commands/ecosystem/update.md), human-side guide — [INSTALL-HUMAN.md Блок C](./INSTALL-HUMAN.md).

> **Не путать с** bootstrap re-install — `/ecosystem:bootstrap` для greenfield, `/ecosystem:update` для existing install. Per [DEC-DEV-0019](DEV_JOURNAL.md), legacy bootstrap merge mode (cp -rn additive only) не handle ecosystem updates корректно — use `/ecosystem:update`.

## Ключевые принципы

1. **Assistant-led, human-approved** (DEC-P13). ИИ делает работу — человек принимает решения.
2. **Tool-agnostic для D2-Tech и D3-D6** (DEC-A06). Внешние инструменты заменяемы через Integrator.
3. **Self-contained handoff**. Универсальный markdown-snapshot для передачи фичи в любой реализатор.
4. **Continuous consistency**. BG extraction, cascade protocol, bi-dir refs работают в фоне.
5. **Adversarial validation**. Product DA review, adaptive-depth триггеры (refactored DEC-DEV-0012 — single subagent invocation, self-classification), 6 lenses.
6. **Drift detection**. `confidence:` поле, `/product:drift-check`, `/product:patterns`, `/product:meta-feedback` — против дрифта при долгих сессиях.

## Документация

| Хочу узнать... | Смотри |
|---|---|
| **План имплементации и где мы сейчас** | **[ROADMAP.md](ROADMAP.md)** |
| Как установить и запустить | [BOOTSTRAP.md](BOOTSTRAP.md) + [INSTALL-HUMAN.md](INSTALL-HUMAN.md) |
| Что такое каждый модуль и как они взаимодействуют | [docs/product-module/SPEC.md](docs/product-module/SPEC.md), [docs/design-module/SPEC.md](docs/design-module/SPEC.md), [docs/integrator-module/SPEC.md](docs/integrator-module/SPEC.md) |
| Как передать фичу во внешний tool | [docs/product-module/handoff-spec.md](docs/product-module/handoff-spec.md) |
| Какие есть типы артефактов | [docs/pmo/artifacts/README.md](docs/pmo/artifacts/README.md) |
| PMO-карта (D1-D6) | [docs/pmo/pmo-map.md](docs/pmo/pmo-map.md) |
| Процессы P1-P5 | [docs/pmo/processes.md](docs/pmo/processes.md) |
| Валидационные правила | [docs/pmo/validation.md](docs/pmo/validation.md) |
| Команды `/ecosystem:*` | [commands/ecosystem/bootstrap.md](commands/ecosystem/bootstrap.md), [commands/ecosystem/verify.md](commands/ecosystem/verify.md) |
| История изменений и v1 модификации | [CHANGELOG.md](CHANGELOG.md) |

## Поддержка

Это персональная экосистема разработки. Issues и PR не ожидаются, но репозиторий открыт для clone/fork.
