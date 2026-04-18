# INSTALL-HUMAN.md — Pre-install Checklist for Human

> **Для человека:** этот чеклист разделён на два блока — **одноразовые шаги** (один раз на машину) и **шаги для каждого нового проекта**.

## Блок A — один раз на машину

### A.1 Claude Code установлен и актуален

```bash
claude --version
```

Если не установлен — https://docs.claude.com/claude-code/quickstart

### A.2 Git установлен

```bash
git --version
```

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

### B.3 Запуск bootstrap

```bash
mkdir my-new-product && cd my-new-product
claude
```

В Claude Code:

```
> /ecosystem:bootstrap
```

(Если в автокомплите команды нет — глобальная установка `A.3` не выполнена. Проверь `ls ~/.claude/commands/ecosystem/`.)

Bootstrap сам спросит API-ключи интерактивно и настроит всё остальное.

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

## Проверка готовности

Перед запуском bootstrap убедись:

- [ ] Claude Code работает (`claude --version`)
- [ ] Git настроен (`git config user.name` возвращает имя)
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
