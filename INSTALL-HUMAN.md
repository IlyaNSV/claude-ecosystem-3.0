# INSTALL-HUMAN.md — Pre-install Checklist for Human

> **Для человека:** этот чеклист разделён на два блока — **одноразовые шаги** (один раз на машину) и **шаги для каждого нового проекта**.

## Блок A — один раз на машину

### A.1 Claude Code установлен и актуален

```bash
claude --version
```

Если не установлен — https://docs.claude.com/claude-code/quickstart

### A.2 Git и Node.js установлены

```bash
git --version
node --version
```

Node.js (LTS) нужен обязательно: хуки экосистемы — `.js`/`.cjs`-скрипты, а инструменты Fabric/Orchestrator запускаются через `node`. Без него часть механики тихо не сработает. Если не установлен — https://nodejs.org/

### A.3 Глобальная установка Ecosystem 3.0

**Unix / macOS / WSL:**

```bash
curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
iwr -useb https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.ps1 | iex
```

Что делает installer:
- Клонирует репо в `~/.claude/ecosystem/` (глобальный кэш)
- Копирует `commands/ecosystem/*.md` в `~/.claude/commands/ecosystem/`
- После этого `/ecosystem:bootstrap` доступна в автокомплите Claude Code

**Обновить глобальную установку** позже — просто повтори one-liner: он идемпотентен (pulls latest `main`).

### A.4 Получи API-ключи для Core MCP

Нужны **три** ключа для нормальной работы Deep Discovery mode (без них работает с fallback на WebFetch/WebSearch, но хуже).

---

## Блок B — для каждого нового продукта

Этот блок проходишь **один раз на каждый новый product project**, который захочешь вести через Ecosystem 3.0.

### B.1 API-ключи (если ещё не получены)

#### Brave Search API (бесплатно)

1. Зарегистрируйся: https://api.search.brave.com/
2. Создай subscription (Free tier — 2000 запросов/месяц, достаточно для pilot)
3. Сгенерируй API key
4. Сохрани — понадобится при bootstrap

#### Firecrawl API (бесплатно с лимитом)

1. Зарегистрируйся: https://www.firecrawl.dev/
2. Free tier: 500 страниц/месяц
3. Сгенерируй API token
4. Сохрани

#### Exa AI API (платный, но есть free credits)

1. Зарегистрируйся: https://exa.ai/
2. При регистрации обычно дают free credits
3. Сгенерируй API key
4. Сохрани

### B.2 Решение про Stitch (только если первая фича будет UI)

Если планируешь сразу писать UI-фичу (FM с has_ui=true):
1. Получи доступ к Google Stitch: https://stitch.withgoogle.com/
2. Создай project для своего продукта
3. Скопируй URL проекта (понадобится при первом `/design:start`)

Если первая фича без UI — пропусти, добавишь позже.

### B.3 Запуск bootstrap — два режима

Bootstrap требует ~20-30 tool invocations (git, file ops, settings writes, MCP installs). Есть два варианта:

#### B.3a — Bypass mode (🚀 fastest, рекомендую для первой установки)

```powershell
mkdir my-new-product; cd my-new-product
claude --dangerously-skip-permissions
```

В Claude Code:

```
> /ecosystem:bootstrap
```

**Zero permission prompts** для всей сессии. Bootstrap пройдёт быстро и тихо.

**После завершения:**

```
> /exit
```

Перезапусти claude **без флага** для обычной работы:

```powershell
claude
```

Это вернёт default permission prompts — для daily work безопаснее.

**Почему это ok для bootstrap:** один раз в новый пустой проект, команды auditable (все перечислены в [commands/ecosystem/bootstrap.md](commands/ecosystem/bootstrap.md)). Для daily work — нет, там default mode нужен.

#### B.3b — Standard mode (default, с pre-stage)

```powershell
mkdir my-new-product; cd my-new-product
claude
```

В Claude Code:

```
> /ecosystem:bootstrap
```

Bootstrap Step 1d предложит pre-stage широкого allowlist в `.claude/settings.local.json`. Ответишь `Y` → ~1-3 prompt'а остаток пути (вместо ~25).

Этот режим лучше если:
- Хочешь **auditable record** какие разрешения были выданы
- Не доверяешь bypass mode по любой причине

Оба режима приводят к тому же end-state.

**Общее для обоих:** если в автокомплите команды `/ecosystem:bootstrap` нет — глобальная установка `A.3` не выполнена. Проверь `ls ~/.claude/commands/ecosystem/`.

---

## Блок C — обновление existing project

После того как новая версия Ecosystem 3.0 вышла (например, после Phase 4-7 ship), обновить existing pilot project:

### C.1 Update global cache (если нужна свежая команда `/ecosystem:update`)

Если `/ecosystem:update` ещё нет в автокомплите — повторить `A.3` global installer. Idempotent.

### C.2 В projects directory

```powershell
cd path/to/your/product
claude
```

В Claude Code:

```
> /ecosystem:update --dry-run    # ← preview изменений
```

Smoke-проверить changeset preview. Затем без `--dry-run`:

```
> /ecosystem:update
```

Default behavior:
- Backup `.claude/` → `.claude-backup-<timestamp>/` перед изменениями
- Sync ecosystem zone (commands/skills/agents/hooks/docs/templates) — rsync-style (delete obsolete + copy fresh)
- Re-derive hooks section в settings.json from latest manifest
- Preserve user zone (settings.local.json, product.yaml, .env, integrator/, .product/)

**Что НЕ trogает /ecosystem:update:**
- `.product/` — артефакты (всегда intact)
- `.env`, `.claude/settings.local.json`, `.claude/product.yaml` — user config
- Claude Code auto-files (sessions, todos, etc.)

### C.3 Verify

```
> /ecosystem:verify
```

Если что-то broken — rollback:

```bash
rm -rf .claude
mv .claude-backup-<timestamp> .claude
```

`.product/` not touched → artifacts intact regardless.

### C.4 Difference: bootstrap vs update

- `/ecosystem:bootstrap` — для greenfield (нет .claude/ или нет ecosystem signature)
- `/ecosystem:update` — для existing install (есть ecosystem signature)

Bootstrap re-install option (b) Merge — DEPRECATED per [DEC-DEV-0019](DEV_JOURNAL.md), используй `/ecosystem:update`.

---

## Опциональные шаги

### GitHub Personal Access Token

Только если хочешь использовать GitHub MCP (для CA Deep mode по dev-tools или NFR research):

1. https://github.com/settings/tokens
2. Generate new token (classic)
3. Scopes: `public_repo`, `read:org`
4. Сохрани — это секрет, не публикуй

### Дополнительные MCP

После bootstrap можно добавлять любые MCP через `/integrator:add <mcp-name>`. Полный список рекомендованных — в [docs/integrator-module/SPEC.md §14](./docs/integrator-module/SPEC.md).

### Реализатор cc-sdd (понадобится позже, готовить заранее не нужно)

Когда дойдёшь до превращения handoff в код ([docs/guide/05-implementation.md](docs/guide/05-implementation.md)), понадобится внешний реализатор **cc-sdd**. Отдельной регистрации, аккаунта или API-ключа он не требует — команда `/integrator:add cc-sdd` сама установит и подключит его (с approve-гейтом перед установкой).

## Проверка готовности

Перед запуском bootstrap убедись:

- [ ] Claude Code работает (`claude --version`)
- [ ] Git настроен (`git config user.name` возвращает имя)
- [ ] Node.js установлен (`node --version`)
- [ ] Глобальная установка сделана (Блок A.3) — `ls ~/.claude/commands/ecosystem/` показывает `bootstrap.md` и `verify.md`
- [ ] У тебя на руках 3 ключа: Brave, Firecrawl, Exa
- [ ] Папка под новый проект создана и пустая (или ты OK ставить `.claude/` рядом с существующим)
- [ ] Для UI-проектов: Stitch project создан, URL скопирован

## Безопасность ключей

⚠️ Важно:
- Ключи будут сохранены в `.env` локально (gitignored)
- НЕ публикуй `.env` в репозитории
- НЕ копируй ключи в чат с Claude — bootstrap их запросит и сохранит безопасно
- Если случайно засветил ключ — ротируй его на сайте провайдера

## Стоимость и лимиты

Экосистема сама по себе бесплатна, но работает поверх **платного** Claude Code (подписка или API-биллинг) и жжёт токены пропорционально глубине работы:

- **Discovery Quick** (`/product:init`) — обычный разговорный расход, самый дешёвый режим.
- **Discovery Deep** (`--deep`) — research-субагенты + внешний поиск: заметно дороже; на ограниченной подписке может съесть существенную часть дневного лимита. Начинай с Quick, Deep запускай точечно.
- **DA-ревью и Orchestrator-прогоны** (P3–P6) — тоже субагентные и токеноёмкие; планируй их на «свежий» лимит, а не в конец дня.
- API-ключи Core MCP (Brave/Firecrawl/Exa) — free tier'ов хватает для пилота (см. Блок B.1).

## Сколько займёт первый запуск

| Этап | Время | Частота |
|---|---|---|
| Блок A (глобальная установка + API keys) | 20-40 мин | один раз на машину |
| Bootstrap `/ecosystem:bootstrap` (Блок B.3) | 10-20 мин | на каждый новый проект |
| Discovery Quick (`/product:init`) | 30-90 мин разговора | на каждый новый продукт |
| Discovery Deep (`/product:init --deep`) | 2-4 часа + research | опционально |
| Первая UI-фича end-to-end | Полдня — день | per фича |

## Что делать если bootstrap прервался

Просто запусти повторно:
```
> /ecosystem:bootstrap
```

Bootstrap детектит partial state и продолжает с нужного места (см. "Resumability" в [commands/ecosystem/bootstrap.md](commands/ecosystem/bootstrap.md)).

## Проверка что всё установилось правильно

После bootstrap в Claude Code:

```
> /ecosystem:verify
```

Это non-destructive health check: проверяет наличие всех критичных файлов, состояние `.product/`, установленные MCP, git state. Покажет ✓ / 🟡 / ❌ per checkpoint.
