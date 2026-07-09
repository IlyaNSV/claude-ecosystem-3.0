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

## Дорожная карта после MVP — с чего продолжать

> **Точка входа для будущей сессии.** MVP (spawn/send/peek/status/harvest/stop)
> построен и live-провалидирован 2 полосами (DEC-DEV-0161, main `20bb912`). Ниже —
> упорядоченный след «что дальше», первым идёт следующий шаг.

### Следующий шаг (Фаза 2 — наблюдаемость и агрегация)

1. **`events.jsonl` — полный поток hook-событий полосы.** Сейчас хуки пишут только
   маркеры-файлы (`started`/`idle`/`session_id`, last-write-wins). Добавить в
   генерируемый `settings.json` аппенд каждого события (с `session_id`, timestamp,
   тип) в `~/.factory/lanes/<lane>/events.jsonl` — durable timeline, а не только
   «последнее состояние». *DoD:* `status` умеет показать «сколько промптов /
   когда последний Stop» из events, не только mtime маркера.
2. **harvest-агрегация N полос через `consilium-synth.cjs`.** `harvest` уже пишет
   `harvest-*.json` (commits/dirty/diffstat/transcript) на полосу. Добавить
   команду `factory synth <lane...>` — свести несколько harvest-записей в один
   сравнительный отчёт (переиспользовать `orchestrator/lib/consilium-synth.cjs`).
   *DoD:* два независимых прогона одной задачи → один свод с расхождениями.
3. **feedback-outbox.** Замкнуть на существующий meta-feedback outbox паттерн:
   findings из полос → в очередь на разбор оператором.

### Позже (Фаза 3 — масштаб и интеграция)

- OTEL-дашборд поверх транскриптов (`~/.claude/projects/<slug>/*.jsonl`).
- Интеграция с Process Fabric `limits.json` (единый диспетчер лимитов после его
  graduation) — сейчас лимит 2–3 полос держит оператор вручную.

### Место Agent Teams — ортогональная ось, НЕ замена субстрата

> Уточнение (2026-07-09): ранняя формулировка «мигрировать субстрат на Agent
> Teams» была неверна. Это **две разные оси параллелизма**, они комплементарны.

- **Factory Conductor — ось «задачи».** N *независимых* задач/проектов, каждая в
  изолированном worktree, полосы **не общаются** между собой, оператор = мета-луп.
  Fan-out по **работе**.
- **Agent Teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) **— ось «роли».** *Одна*
  комплексная задача, разложенная на команду профилей (архитектор/кодер/ревьюер),
  делящих контекст цели и координируемых через SendMessage под ведущим агентом.
  Fan-out по **исполнителю над одной целью**. Вся его машинерия (общий teamspace,
  сообщения, ~5-6 предел, 1 team/сессия, нет resume) заточена под декомпозицию
  одной задачи; изоляции worktree в его модели нет.
- **Связь — вложенность, не замена:** когда конкретная задача *одной полосы*
  Conductor потребует команды ролей, эта полоса может внутри себя запустить Agent
  Team. Conductor остаётся внешним слоем «разные задачи + изоляция + оператор»;
  Agent Team — опциональный внутренний примитив полосы. Мигрировать одно в другое
  нельзя — они решают ортогональные задачи.

### Backlog нюансов из live-смоука (мелкие, не блокеры)

- **Упрочнить pre-trust против гонки** `~/.claude.json`: параллельный `claude`
  может перезаписать патч. Вариант — ретрай патча + проверка после старта, или
  файловый лок на запись `~/.claude.json`.
- **Многострочный `send`** — сейчас `--text` схлопывает `\n` в пробел (TUI сабмитит
  по Enter). Обходной путь есть (`--file`), но tmux paste-buffer
  (`load-buffer`+`paste-buffer`) дал бы настоящий многострочный ввод.
- **Алиас `attach`** (`factory attach <lane>` → `tmux attach -t cf-<lane>`) для
  удобства владельца из GUI.
- **`status` не отличает «idle после ответа» от «idle = задача сделана»** — это
  сознательное ограничение MVP (контроль за оператором), но events.jsonl из шага 1
  даст материал для эвристики.

Дизайн-контекст и разведка (Agent Teams / Claude Squad / лимиты) — память
`project_factory_conductor_initiative`; решение и lessons — DEV_JOURNAL DEC-DEV-0161.
