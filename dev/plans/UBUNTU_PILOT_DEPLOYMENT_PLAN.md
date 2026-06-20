# Ubuntu 24.04 — Pilot Deployment Plan

> **Что это:** план переноса пилотного проекта `my-first-test` на ВМ Ubuntu 24.04 для
> продолжения работы. Источник: research-сессия 2026-06-15 (прямая верификация git-состояния
> пилота + аудит кросс-платформенности кода экосистемы).
>
> **Scope:** **только пилот** (`my-first-test`). Сам dev-репозиторий экосистемы НЕ переносится.
> ВМ **с GUI** — значит Chrome/App Map thumbnails и open-design viewer в области применения
> (опциональны, но доступны).
>
> **Зачем документ:** миграция = `git clone` + пересоздание gitignored-секретов, но есть два
> неочевидных блокера (имя ветки на remote, runtime-версии), которые ломают наивный `clone`.
> После выполнения и успешного `/ecosystem:verify` на Ubuntu — архивируется в `dev/_archive/`.

**Статус:** Шаг 0 ⬜ (push ветки) | Шаги 1-6 ⬜ (Ubuntu) | Верификация ⬜
**Дата research/верификации:** 2026-06-15

---

## Верифицированное состояние пилота (на 2026-06-15)

Проверено напрямую (`git` в `C:\Users\pw201\WebstormProjects\my-first-test`, включая live `ls-remote`):

| Факт | Значение |
|---|---|
| Путь пилота | `C:\Users\pw201\WebstormProjects\my-first-test` (отдельный репо, **не** внутри экосистемы) |
| GitHub remote | `https://github.com/IlyaNSV/my-first-test.git` |
| Локальная ветка | `orchestrator-live-run` @ `928c971` |
| Ветки **на** GitHub | `main` (`e612088`), `pre-cc-sdd-pilot` (`928c971`) — ветки `orchestrator-live-run` нет |
| Топология | `928c971` = `origin/main` (`e612088`) + 15+ коммитов (auth 4.4→6.3, eco 1.5.0, orchestrator) |
| Рабочее дерево | чистое |
| `.product/` | закоммичен, 398 файлов |
| App runtime | `package.json`: `node>=22`, `pnpm>=11`, `packageManager: pnpm@11.6.0` |
| Docker-сервисы | `docker-compose.yml`: `postgres`, `redis`, `api`, `worker` |

### 🔴 Блокер №1 — имя ветки на remote вводит в заблуждение

Последняя работа (`928c971`) **уже на GitHub**, но под именем `pre-cc-sdd-pilot` (тот же SHA, сверено),
а не `orchestrator-live-run`. Наивный `git clone` отдаст `main` (старое — merge-base). Данные не потеряны,
но имена ветвей не совпадут и легко продолжить не с того состояния.

**Решение — Шаг 0 ниже** (push ветки под её настоящим именем).

---

## Что переносится и что нет

### Через `git clone` (всё текстовое, кросс-платформенное as-is)
`.product/` (398 артефактов) · `.claude/` (commands/skills/agents/hooks/docs экосистемы) ·
`apps/` + `packages/` (код приложения) · `.env.example` · `docker-compose.yml` · `pnpm-lock.yaml`.

> Хуки регистрируются как `node .claude/hooks/<module>/<file>` (прямые слэши, относительные пути,
> вызов `node`) — работают на Linux без изменений. Хуки используют `git` через `execSync` /
> `spawnSync(process.execPath, …)` — POSIX-совместимо. Проверено: `commands/ecosystem/bootstrap.md:438,473`.

### НЕ переносится (gitignored — пересоздать на Ubuntu)
Подтверждено по `gitignore.template` + `git check-ignore`:

| Что | Как восстановить |
|---|---|
| `.env` (корень пилота) | `cp .env.example .env` + дозаполнить ключи экосистемы (Brave/Firecrawl/Exa/GitHub) |
| `.claude/integrator/secrets/` | сгенерировать заново (open-design токен и пр.) |
| `.product/.sessions/` · `.pending/` · `.reports/` | эфемерное — регенерируется само |
| `.claude-backup-*/` · `integrator/backups/` | НЕ переносить |
| `node_modules/` | `pnpm install` на Ubuntu |

---

## Системные пререквизиты Ubuntu 24.04

> ⚠️ apt в Ubuntu 24.04 (Noble) даёт Node **18** — нужен **≥22**. apt-овый node не подходит.

### A. Для приложения пилота
```bash
# Node 22 через NodeSource (НЕ apt-овый node 18)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm 11.6.0 через corepack (идёт с Node)
corepack enable && corepack prepare pnpm@11.6.0 --activate

# Docker + compose v2 (postgres/redis/api/worker)
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER     # ⚠️ перелогиниться после этого
```

### B. Для слоя экосистемы
```bash
sudo apt-get install -y git openssl          # openssl — для open-design токена
# Claude Code CLI — по официальной инструкции docs.claude.com/claude-code
#   (вариант: npm i -g @anthropic-ai/claude-code — нужен Node из шага A)
```
> После установки Claude Code на новой машине — **залогиниться заново** (`claude` → OAuth/API key).
> Авторизация с Windows не переносится.

### C. Для GUI-фич (есть GUI → в scope, опционально)
```bash
# Chromium — для App Map PNG thumbnails (Design-модуль)
sudo apt-get install -y chromium-browser
# (или google-chrome-stable из репозитория Google)
```

---

## План развёртывания

### Шаг 0 — на Windows (разблокировать Блокер №1)
```bash
cd /c/Users/pw201/WebstormProjects/my-first-test
git push origin orchestrator-live-run
```

### Шаги 1-6 — на Ubuntu 24.04
```bash
# 1. Пререквизиты — секции A, B (и C при необходимости) выше

# 2. Глобальная установка экосистемы (Phase 1)
curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash

# 3. Клонировать пилот и встать на рабочую ветку
git clone https://github.com/IlyaNSV/my-first-test.git
cd my-first-test
git checkout orchestrator-live-run            # доступна после Шага 0
git rev-parse HEAD                            # должно дать 928c971… (или новее)

# 4. Пересоздать секреты (НЕ в git)
cp .env.example .env
#   → заполнить app-переменные (DB/redis/JWT/OAuth) + ключи экосистемы:
#     BRAVE_API_KEY, FIRECRAWL_API_KEY, EXA_API_KEY, GITHUB_TOKEN
mkdir -p ~/.claude/integrator/secrets         # если используешь open-design:
openssl rand -hex 32 > ~/.claude/integrator/secrets/open-design.token

# 5. Зависимости и сервисы приложения
pnpm install
docker compose up -d postgres redis           # + api/worker по необходимости

# 6. Запустить Claude Code в проекте
claude
> /ecosystem:verify
```

---

## Кросс-платформенные подводные камни (найдены при аудите кода)

1. **Жёсткий путь к Chrome** — `hooks/design/app-map-thumbs.js:27`:
   `DEFAULT_CHROME = 'C:\Program Files\…\chrome.exe'`. Только для App Map thumbnails.
   На Ubuntu передавать `--chrome /usr/bin/chromium-browser`. Не блокирует основную работу.

2. **CRLF-окончания строк.** Репозиторий разрабатывается на Windows; `.sh`-скрипты с CRLF
   падают на Linux (`bad interpreter: …^M`). Хуки на `.js` (Node терпит CRLF) — не проблема.
   Глобальный `install.sh` через `curl|bash` приходит с GitHub в LF — чист. При нужде:
   `sudo apt install dos2unix && dos2unix dev/scripts/*.sh` (только если запускаешь dev-скрипты).

3. **open-design daemon — `127.0.0.1`, не `localhost`** (`BOOTSTRAP.md:183-215`). На Linux менее
   критично, но токен генерируется заново (Шаг 4). Запускать только если используешь Design-визуализацию.

4. **Statusline-напоминалка** (OpenAI-based, машинно-глобальная в `~/.claude/statusline/`) —
   её нет в репозитории, настраивается на Ubuntu заново. Опционально.

---

## 🔴 Блокер №2 — НЕ запускать `/ecosystem:update` в пилоте вслепую

`/ecosystem:update` — **rsync-with-delete** внутри managed-namespace'ов (см.
[`PILOT_RECONCILIATION_PLAN.md`](./PILOT_RECONCILIATION_PLAN.md)). Шаги 1-3 реконсиляции уже выполнены
(DEC-DEV-0065/0066/0067), острый риск wipe снят, но на свежей машине:
- сначала `/ecosystem:verify`;
- `/ecosystem:update` — только с `--dry-run` и осознанно.
- `.product/` не трогается в любом случае.

---

## Верификация на Ubuntu (Definition of Done)

- [ ] `git rev-parse HEAD` == `928c971…` (или новее после допуша)
- [ ] `/ecosystem:verify` — зелёный health-check (`.claude/`, `.product/`, MCP, git)
- [ ] `dev/scripts/capture-pilot-state.sh` из корня пилота — снапшот без ошибок
      (кросс-платформенный: зависит от `sha256sum`/`find` — на Linux нативно)
- [ ] `pnpm install` без ошибок; `docker compose up -d postgres redis` поднимает сервисы
- [ ] `.env` заполнен; `~/.claude/integrator/secrets/` создан (если нужен open-design)
- [ ] (если GUI-фичи) Chromium установлен; App Map thumbnails рендерятся с `--chrome`

→ при выполнении всех пунктов: архивировать этот план в `dev/_archive/`.
