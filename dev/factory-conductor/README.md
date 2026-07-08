# Factory Conductor — оркестрация параллельных Claude Code сессий (MVP)

> **Статус:** MVP (DEC-DEV-0161, 2026-07-08). Живёт в `dev/` (не consumer-zone) до
> live-валидации на пилоте; после — кандидат на промоушен. Дизайн-контекст:
> память `project_factory_conductor_initiative`, DEV_JOURNAL DEC-DEV-0161.

## Что это

Тонкий Node-пульт (`factory.cjs`, stdlib-only, без LLM) поверх **tmux** на VM
`Ubuntu-ClaudeCode`, который позволяет запускать и вести несколько
**интерактивных** Claude Code сессий параллельно — так, как это делал бы человек
с несколькими терминалами:

- каждая сессия («полоса», *lane*) живёт в своей tmux-сессии `cf-<lane>`;
- каждая полоса работает в **своём git worktree** (`~/projects/lanes/<lane>`,
  ветка `lane/<lane>`) — single-writer инвариант FB-004: две сессии никогда не
  пишут в один checkout;
- состояние (idle/busy) снимается **через hooks Claude Code**, не парсингом
  экрана: Stop-хук ставит маркер `idle`, UserPromptSubmit его снимает;
- каждая полоса брекетируется в **run-ledger** (`~/.factory/runs/ledger.ndjson`)
  — durable-журнал запусков;
- владелец видит те же экраны из GUI VM (`tmux attach`), пульт-оператор (человек
  или Claude на хосте по SSH) управляет теми же сессиями — без конфликтов.

```
Хост (я/ты) --ssh--> factory.cjs --tmux send-keys/capture-pane--> claude TUI (N полос)
                          |--- git worktree add/remove (изоляция полос)
                          |--- ~/.factory/lanes/<lane>/ (meta, idle-маркер, harvest)
                          '--- run-ledger (журнал запусков)
```

## Установка на VM

```bash
# однократно (из клона репо экосистемы на VM):
mkdir -p ~/factory ~/bin
cp ~/projects/claude-ecosystem-3.0/dev/factory-conductor/factory.cjs ~/factory/
printf '#!/usr/bin/env bash\nexec node ~/factory/factory.cjs "$@"\n' > ~/bin/factory
chmod +x ~/bin/factory
```

Зависимости уже на VM: tmux ≥3.4, Node 22, jq, `claude` в `~/.local/bin`.

## Команды

| Команда | Что делает |
|---|---|
| `factory spawn <lane> --repo <path> [--base <ref>] [--prompt "<текст>"] [--brief <файл>]` | Создаёт worktree + ветку `lane/<lane>`, генерирует hook-настройки, стартует tmux-сессию с `claude --dangerously-skip-permissions`, регистрирует в ledger. С `--prompt`/`--brief` — дожидается готовности сессии и сразу шлёт задачу |
| `factory send <lane> --text "<текст>"` \| `--file <бриф.md>` | Шлёт промпт в полосу. `--file` копирует файл в worktree как `FACTORY-BRIEF.md` и шлёт указатель на него (надёжнее длинных инлайн-текстов) |
| `factory peek <lane> [-n 60]` | Последние N строк экрана полосы (не вмешиваясь) |
| `factory status [--json]` | Таблица всех полос: `LANE STATE BRANCH AHEAD DIRTY LAST_ACTIVITY`; STATE = busy / idle / dead / stopped |
| `factory harvest <lane>` | Съём результата: полный скролбэк → `harvest-*.txt`, git-съём (коммиты от базы, dirty, diffstat) → `harvest-*.json`, финиш в ledger |
| `factory stop <lane> [--rm-worktree]` | Graceful `/exit` (потом kill), мини-harvest если не снимали, отметка в meta + ledger. Ветка `lane/<lane>` всегда сохраняется |

Состояние живёт в `~/.factory/lanes/<lane>/` (meta.json, маркеры, harvest-файлы).

## Типовой сценарий: две полосы на пилоте

```bash
# 1. Запустить две независимые задачи
factory spawn docs-sweep --repo ~/projects/my-first-test \
  --prompt "Проверь README на устаревшие команды, исправь, закоммить"
factory spawn test-gaps --repo ~/projects/my-first-test \
  --brief ~/briefs/test-gaps.md

# 2. Следить (быстрый цикл)
factory status            # обе busy → ждём
factory peek docs-sweep   # что на экране, без вмешательства

# 3. Полоса стала idle → диалог при необходимости
factory send docs-sweep --text "Также проверь INSTALL.md"

# 4. Снять результаты и погасить
factory harvest docs-sweep && factory stop docs-sweep
factory harvest test-gaps && factory stop test-gaps --rm-worktree

# 5. Слить работу (сериализованно, single-writer у main)
cd ~/projects/my-first-test && git merge lane/docs-sweep
```

## Управление с Windows-хоста (режим «я оркестрирую»)

Все команды работают по SSH; кавычки — **одинарные снаружи** (грабли ssh.exe):

```powershell
ssh -p 2222 -i C:\Users\pw201\.ssh\vm-claude-factory -o BatchMode=yes cc-dev@127.0.0.1 '~/bin/factory status'
```

Длинные брифы с хоста: `scp` файла в `~/briefs/` + `factory send <lane> --file ~/briefs/x.md`
(инлайн-текст через двойной слой квотинга Windows→ssh→bash — известное минное поле).

## Наблюдение владельцем (визуал)

- В GUI VM: `tmux attach -t cf-<lane>` — живой экран полосы; отцепиться `Ctrl+B, D`
  (сессия продолжает жить). Одновременный attach владельца и управление пультом —
  штатно, tmux это и есть «один экран, много зрителей».
- В VS Code: терминал (`Ctrl+``) → `factory status` / `tmux attach`; ветки полос
  видны в GitLens/Git Graph.

## Известные нюансы (по live-смоуку 2026-07-08)

- **Trust-диалог worktree.** Свежий worktree для Claude Code — незнакомая папка;
  без пре-доверия TUI встаёт на «Is this a project you trust?» и SessionStart не
  срабатывает. `spawn` пре-одобряет worktree в `~/.claude.json`
  (`hasTrustDialogAccepted`) до запуска. Гонка: параллельный `claude` может
  перезаписать `~/.claude.json` поверх патча — окно крошечное; если диалог всё же
  вылез, оператор подтверждает `tmux send-keys -t cf-<lane> Enter` (в GUI —
  просто Enter в attached-сессии).
- **ITP из глобального CLAUDE.md.** Сессии на VM наследуют Intent Triage Protocol
  — на неоднозначном промпте модель встанет на уточняющее меню (это штатное
  поведение Claude, не сбой фабрики). Оператор отвечает `send --text "<выбор>"`
  или выбором пункта (`tmux send-keys -t cf-<lane> -l -- 3` + Enter). Чтобы
  минимизировать — давай в промпте предмет действия явно.
- **Ledger-verdict.** Если сделать `harvest` до `stop`, финальный verdict в ledger
  = `harvested` (финиш once-only, `stop` не перезапишет). `stopped` пишется
  только когда полосу гасят без предварительного harvest. Оба варианта — durable
  трейс запуска.

## Ограничения MVP (сознательные)

- **2–3 параллельные полосы** — sweet spot (16 GB RAM; при 5–6 начинаются 429/529
  на подписке). Спавнить ступенчато, не залпом (гонка `~/.claude.json`).
- Параллелить **независимые** work-units; одно связанное решение в N полос — анти-паттерн
  (~15× токенов без выигрыша в качестве).
- `send --text` — однострочный (TUI сабмитит по Enter); многострочное — через `--file`.
- idle-маркер означает «Claude закончил отвечать», не «задача сделана» — контроль
  результата за оператором (`peek` + `harvest`).
- Хуки полосы подмешиваются через `--settings` только в сессию полосы; глобальные
  настройки не трогаются.
- Merge полос в main — вручную, сериализованно (инвариант FB-004 держит оператор).

## Дорожная карта после MVP

Фаза 2: `events.jsonl` (полный поток hook-событий), harvest-агрегация N полос через
`consilium-synth.cjs`, feedback-outbox. Фаза 3: OTEL-дашборд, интеграция с Fabric
`limits.json`, миграция на Agent Teams при его созревании (см. память
`project_factory_conductor_initiative`).
