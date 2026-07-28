# Ecosystem 3.0

> **PMO-слой для управления продуктовыми проектами через Claude Code.** Тонкий контроль D1-D2 (Discovery + Behavioral specification), tool-agnostic делегирование D2-Tech и D3-D5 внешним инструментам через универсальный handoff.

**Статус:** единственный источник — [ROADMAP.md «Где мы сейчас»](ROADMAP.md#где-мы-сейчас) (verify против `git log`). Краткая история релизов — [CHANGELOG.md](CHANGELOG.md). _Здесь статус намеренно не дублируется — pointer-collapse против triple-declaration drift (Tier-1 doc reform)._
**Целевая аудитория:** solo-разработчики, ведущие продуктовые проекты с Claude Code как primary tool.

---

## Где начать

| Зачем пришёл | Куда смотреть |
|---|---|
| 🗺️ **Карта системы одним взглядом** | **[docs/MAP.md](docs/MAP.md)** — pipeline D1-D6 + C4 container (визуальный entry-point) |
| 🚀 **Научиться вести продукт** (руководство оператора) | **[docs/guide/README.md](docs/guide/README.md)** — единый вход «Начни здесь»: лестница L0→L5, роутер «Я хочу…», две интерактивные карты |
| 🤔 **Первый раз — что это и зачем** | [Концепция в одной строке](#концепция-в-одной-строке) + [Четыре модуля](#четыре-модуля) ниже → потом [ROADMAP.md «Где мы сейчас»](ROADMAP.md#где-мы-сейчас) |
| 🔧 **Установить и запустить** | [BOOTSTRAP.md](BOOTSTRAP.md) → [INSTALL-HUMAN.md](INSTALL-HUMAN.md) → [Quick Start](#quick-start--двухфазная-установка) ниже |
| 📍 **План и где мы сейчас** | [ROADMAP.md «Где мы сейчас»](ROADMAP.md#где-мы-сейчас) — единственный источник статуса |
| 📖 **Развиваю саму экосистему** | [CLAUDE.md](CLAUDE.md) (repo conventions) → [DEV_JOURNAL.md](DEV_JOURNAL.md) последние 5 entries → [ROADMAP.md](ROADMAP.md) |
| 🧭 **Где ПРАВДА про класс X / кто authoritative при конфликте** | [dev/INFORMATION-MAP.yaml](dev/INFORMATION-MAP.yaml) — information-topology resolver |
| 🧠 **Понять прошлые decisions** | [DEV_JOURNAL.md](DEV_JOURNAL.md) (DEC-DEV-* entries — rationale за каждым решением; счётчик не дублируем, бери из хвоста журнала) |
| 📚 **Module SPEC / API reference** | [docs/README.md](docs/README.md) → [product](docs/product-module/SPEC.md) · [design](docs/design-module/SPEC.md) · [integrator](docs/integrator-module/SPEC.md) · [orchestrator](docs/orchestrator-module/SPEC.md) |
| 🧩 **PMO: карта D1-D6, процессы, правила, артефакты** | [pmo-map.md](docs/pmo/pmo-map.md) · [processes.md](docs/pmo/processes.md) · [validation.md](docs/pmo/validation.md) · [артефакты](docs/pmo/artifacts/README.md) |
| 📦 **Как передать фичу во внешний tool** | [handoff-spec.md](docs/product-module/handoff-spec.md) |
| 📜 **История изменений** | [CHANGELOG.md](CHANGELOG.md) |

---

## Концепция в одной строке

Я детально контролирую процессы D1-D2 (продуктовая стратегия + поведенческая спецификация) через **Product Module** и **Design Module**, а внешние инструменты (D2-Technical, D3-D5) подключаются через **Integrator Module** и работают по принципу «я дал тебе всё о продукте через handoff — ты качественно выполнил свою зону».

## Agent = Model + Harness

Поведение AI-агента задаётся не только моделью, но и *harness*-слоем вокруг неё — уравнение **Agent = Model + Harness**, где harness — это инструкции, инструменты, песочницы, оркестрация, guardrails и наблюдаемость. **Ecosystem 3.0 — это именно harness-слой поверх Claude Code, а не «более умная модель»:** slash-команды, гейты, хуки, оркестрация процессов и верификация определяют поведение агента не меньше, чем сама модель. Отсюда и вектор улучшения: лучший результат достигается работой над harness (точнее инструкции, строже гейты, надёжнее оркестрация), а не ожиданием, что «модель сама догадается».

## Четыре модуля

| Модуль | Ответственность | Статус |
|---|---|---|
| **Product Module** | D1 + D2-Behavioral: 24 типа артефактов, процессы P1-P5, handoff-генерация | ✅ SPEC v1.0 |
| **Design Module** | D2-B04 UI Design: итеративная генерация через Stitch/HTML, conditional на `has_ui=true` | ✅ SPEC v1.0 |
| **Integrator Module** | Подключение/замена внешних инструментов под PMO-карту («сисадмин») | ✅ SPEC v1.0 |
| **Orchestrator Module** | Runtime-владелец D2-Technical + D3+: проводит PMO-процессы end-to-end силами role-агентов по регламентам | ✅ семейство процессов P1–P8 + §6-канал построено и live-validated (P8 — браузерная приёмка, DEC-DEV-0225) — живой статус в [ROADMAP](ROADMAP.md#где-мы-сейчас) |

## Что входит в репозиторий

| Зона | Что внутри | Едет ли в проект |
|---|---|---|
| `docs/` | SPEC модулей + PMO-каталоги (артефакты, процессы, правила валидации) — декларативная база | да |
| `commands/` `skills/` `agents/` `hooks/` | slash-команды, методология, субагенты, автоматизация | да → `.claude/` |
| `orchestrator/` `product/` | детерминированные runtime-хелперы и Workflow-скрипты | да |
| `adapters/` | reference-адаптеры `handoff.md` → внешний инструмент | да |
| `templates/` | шаблоны для end-user проектов (в т.ч. `CLAUDE.md.template`) | да |
| `dev/` `tests/` | разработка **самой** экосистемы: планы, гейты, D7-модуль, тесты | **нет** — фильтруются при bootstrap |

Корень: `README` · `BOOTSTRAP` · `INSTALL-HUMAN` · `CHANGELOG` · `ROADMAP` · `CLAUDE` · `DEV_JOURNAL`, инсталляторы `install.sh`/`install.ps1` и `*.template`-конфиги.

_Фактическое дерево — `ls`; топология зон визуально — [docs/MAP.md](docs/MAP.md) §2 (C4 container). Здесь дерево намеренно не разворачивается: развёрнутая копия дважды за историю репо расходилась с диском._

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
2. **Tool-agnostic для D2-Tech и D3-D5** (DEC-A06). Внешние инструменты заменяемы через Integrator.
3. **Self-contained handoff**. Универсальный markdown-snapshot для передачи фичи в любой реализатор.
4. **Continuous consistency**. BG extraction, cascade protocol, bi-dir refs работают в фоне.
5. **Adversarial validation**. Product DA review, adaptive-depth триггеры (refactored DEC-DEV-0012 — single subagent invocation, self-classification), 6 lenses.
6. **Drift detection**. `confidence:` поле, `/product:drift-check`, `/product:patterns`, `/product:validation-tune` — против дрифта при долгих сессиях.

## Документация

Роутер — единственная таблица [«Где начать»](#где-начать) выше. _(Раньше здесь стояла вторая копия того же роутера; копии разошлись — свёрнуто в один вход, DEC-DEV-0227.)_

Команды: [`/ecosystem:bootstrap`](commands/ecosystem/bootstrap.md) · [`/ecosystem:verify`](commands/ecosystem/verify.md) · полный каталог всех команд — [docs/guide/02-commands.md](docs/guide/02-commands.md) (генерируется из frontmatter, не правится руками).

## Поддержка

Это персональная экосистема разработки. Issues и PR не ожидаются, но репозиторий открыт для clone/fork.
