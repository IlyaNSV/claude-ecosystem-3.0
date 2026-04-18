# INSTALL-HUMAN.md — Pre-install Checklist for Human

> **Для человека:** этот чеклист — что нужно сделать **до** запуска `/ecosystem:bootstrap` в новом проекте. Один раз для каждого нового продуктового проекта.

## Обязательные шаги

### 1. Claude Code установлен и актуален

```bash
claude --version
```

Если не установлен — https://docs.claude.com/claude-code/quickstart

### 2. Git установлен

```bash
git --version
```

### 3. API-ключи для Core MCP (Discovery Deep mode без них работает с fallback, но хуже)

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

### 4. Решение про Stitch (только если первая фича будет UI)

Если планируешь сразу писать UI-фичу (FM с has_ui=true):
1. Получи доступ к Google Stitch: https://stitch.withgoogle.com/
2. Создай project для своего продукта
3. Скопируй URL проекта (понадобится при первом `/design:start`)

Если первая фича без UI — пропусти, добавишь позже.

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

| Этап | Время |
|---|---|
| Bootstrap (Steps 1-11) | 10-20 мин (зависит от подтверждений) |
| Discovery Quick (`/product:init`) | 30-90 мин разговора |
| Discovery Deep (`/product:init --deep`) | 2-4 часа разговора + research |
| Первая UI-фича end-to-end (Discovery + Planning + Feature + Design + Handoff) | Полдня — день |

## Что делать если bootstrap прервался

Просто запусти повторно:
```
> Продолжи установку Ecosystem 3.0
```

Bootstrap детектит partial state и продолжает с нужного места.
