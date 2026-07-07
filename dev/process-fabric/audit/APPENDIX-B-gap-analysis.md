# Агрегатор №2 — GAP-анализ кросс-процессной коммуникации Ecosystem 3.0

> Адверсариальный взгляд на сквозной поток «бизнес-овнер даёт задачу → сколько угодно итераций → рабочий продукт на проде», с нелинейными связями (результат шага инициирует другой процесс / пересмотр архитектуры). Источник — 9 зонных ридеров.

---

## §0. Карта сквозного потока и его швов (seams)

Идеальный сквозной конвейер, каким его хочет владелец:

```
идея владельца
  → D1 Discovery (/product:init)         PS/MR/CA/SEG/VP/HYP/BG
  → D1.B Planning (/product:plan)         MVP/RM/RL/FM-скелеты
  → P2 Feature (/product:feature)         SC/BR/LC/VC/IC/NFR/RPM (+DA review)
  → [Design (/design:start) если has_ui]  MK/DS/NM/AM
  → completeness-loop (/product:complete)  DoR-достаточность
  → handoff (/product:handoff)             handoff.md (13 секций, SHA-256)
  → Integrator (/integrator:add)           external tool (cc-sdd)
  → Orchestrator P3 batch→cc-sdd           specs
  → Orchestrator P4 audit-spec-fidelity    fidelity-гейт
  → Orchestrator P5 feature-to-tdd-impl    имплементация
  → Orchestrator P6 validate-feature-impl  GO/NO-GO
  → Orchestrator P7 runtime-smoke          «стартует ли приложение»
  → Epic E deploy/rollback → PROD          ← НЕ СУЩЕСТВУЕТ
```

Ключевое наблюдение адверсариального прохода: **вперёд** поток держится на цепочке ручных вызовов команд и текстовых подсказок «Next: /...»; **назад** (нелинейность — результат шага пересматривает архитектуру/спеку) поток почти целиком идёт через **write-only очереди** (`pending-actions.md`, `*-pending.yaml`), у которых **нет процесса-слушателя** — только человек или «LLM должен вспомнить». Единственный контур с настоящей замкнутой петлёй во всей системе — `lesson-gate` (write `status:open` → Stop блокирует сессию → форсированный resolve). Это и есть эталон, которого лишено всё остальное.

---

## §1. Классифицированный реестр разрывов

Классы: **(a)** результат есть, триггер следующего процесса отсутствует/ручной · **(b)** обратная связь не возвращается (fire-and-forget) · **(c)** связь на «LLM должен вспомнить» (prompted, хрупко) · **(d)** связь только в голове человека · **(e)** спека без имплементации · **(f)** мёртвая ссылка / дрейф.

| # | Шов / разрыв | Класс | Канал сейчас | Зона |
|---|---|---|---|---|
| G01 | **Epic E — «последняя миля» до прода** (CI/build, provisioning, deploy/rollback, monitoring) не существует ни как процесс, ни как инструмент | **(e)** | нет | orchestrator / vision |
| G02 | **Внешний инструмент → назад в `.product/`** (P-INT-12): результат cc-sdd/impl не возвращается в спеки/статус фичи; цепочка Product→adapter→tool однонаправленная | **(b)+(e)** | нет (делегировано ненастроенному каналу) | integrator |
| G03 | **Orchestrator → Product/Integrator/owner через `pending-actions.md`**: единственный канал эскалации конфликтов/capability-gaps/product-routed drifts; нет уведомления, нет resume-хука | **(b)+(d)** | write-only файл, читает человек | orchestrator |
| G04 | **OD7 escalate→await→resume** (async capability-request на BLOCK): механика ожидания и авто-возобновления P5/P7 после решения Integrator явно НЕ реализована | **(e)+(b)** | PA-запись «await: OD7», resume отсутствует | orchestrator |
| G05 | **hook-сигнал → реальный spawn subagent** (br/ic-change-trigger, zone-change-trigger): хук пишет pending+stderr, но спавн держится на памяти оркестратора; при следующем save dedup тихо перезаписывает без watchdog | **(c)** | stderr + `*-pending.yaml` | hooks / product |
| G06 | **DA-review canonical subagent**: задокументированный recurring regression (S8 P1) — LLM подменяет `product-devils-advocate` на general-purpose вместо остановки на «agent not found» | **(c)** | prompted spawn | product |
| G07 | **«Next: /product:X» между всеми командами** (init→plan→feature→handoff→add): чистый текст, нулевой enforcement, нет state-machine, форсирующей следующий шаг | **(c)+(d)** | текст в summary | product |
| G08 | **/product:handoff → /integrator:add**: нет авто-триггера, только текстовая подсказка следующего шага | **(a)+(d)** | human-memory | product↔integrator |
| G09 | **Autonomy resolver F1** (`lib/autonomy-policy.cjs`): построен, 70 юнитов зелёные, но НЕ подключён ни к одному гейту; 6-пунктовый чек-лист перед F2-wiring не закрыт | **(e)** | нет (orphan capability) | vision / product-lib |
| G10 | **Orchestrator agent() ↔ nested kiro-* skill**: живой прогон cc-sdd не подтверждён; вся P3/P5 держится на fallback-пути именно из-за неопределённости | **(c)** | prompted, unverified | orchestrator |
| G11 | **Layer-3 гейт relay verbatim**: промпт требует «relay, do NOT eyeball», но нет runtime-проверки, что агент реально запустил .cjs, а не подделал JSON под schema | **(c)** | prompted | orchestrator |
| G12 | **run-ledger start/finish wiring**: поведенческий контракт диспетчера, без hook/CI-enforcement; забыл обернуть — трейса нет без предупреждения | **(c)** | prompted | orchestrator |
| G13 | **Integrator tool-docs → Orchestrator Module**: артефакт производится на каждом add/update, но живого читателя нет (потребление Orchestrator'ом не подтверждено) | **(b)+(a)** | файл без reader | integrator |
| G14 | **/integrator:verify, :debug, :replace, :docs** — spec-only (Phase 7); при этом реализованные команды текстом ссылаются на несуществующие verify/debug/replace | **(e)+(f)** | мёртвые ссылки | integrator |
| G15 | **§4.4 confidence-downgrade lifecycle** зависит от `/integrator:debug`, которого нет → у lifecycle нет автоматической точки входа | **(e)** | нет | integrator↔product |
| G16 | **Integrator drift-check.js (SessionStart) + contract-validate.js (PreToolUse)** заявлены в manifest как Phase-7 кандидаты, не существуют → дрейф/битые контракты ловятся только ручным `/integrator:update --repair` | **(e)** | нет проактивного слушателя | hooks / integrator |
| G17 | **/ecosystem:update → /integrator:update --repair**: после sync reference-адаптеров нет хука, инициирующего repair; update.md лишь «скажи юзеру перезапустить» | **(a)+(d)** | human-memory | integrator↔ecosystem |
| G18 | **/integrator:scan auto-invoke drift**: SPEC §13.1 «Always» перед add/update/replace; код вызывает условно (add) или не вызывает (update/remove) | **(f)** | spec↔impl дрейф | integrator |
| G19 | **catalog↔runner sync**: `validation.md` (каталог) и `validation-runner.md` (hardcoded таблица) синхронизируются вручную, линтера нет — silent drift | **(f)** | нет | product / docs |
| G20 | **templates/project/CLAUDE.md.template**: устаревшие числа «23 artifact / 33 rules» вместо канонических 24/44 — тиражируются в КАЖДЫЙ новый пилот при bootstrap | **(f)** | count-sweep пропустил | templates |
| G21 | **Product/Design SPEC drift**: SPEC не знают об Epic A/B/D (complete/consilium/batch-enrich, architect/qa/ux-advisor) — устарели относительно кода | **(f)** | doc-drift | docs |
| G22 | **handoff staleness на стороне Integrator**: handoff-spec обещает пересчёт хэшей «при использовании», но в add.md/update.md нет шага пересчёта; единственный drift-хук живёт в hooks/product и не персистит staleness в файл | **(a)+(b)** | stderr-эфемерно | integrator / hooks |
| G23 | **process-gate.js установлен только там, где вручную запущен install-pre-commit.sh**; `.git/hooks` не версионируется → на свежем клоне/worktree блокирующего гейта нет | fragile-enforcement | ручная установка | D7 |
| G24 | **Session Audit v2 требует opt-in `/ecosystem:enable-d7-audit` в каждом пилоте**; пропущен — весь pipeline молчит без сигнала. Хук хардкодит абсолютный путь repo → тихо ломается при переезде | **(d)+(f)** | opt-in + хардкод-путь | D7 |
| G25 | **audit-index.md: 3 незакрытых Pending-маркера**; capture произошёл, аудит не запущен, ничто не обязывает прогнать `/meta:audit-smoke` | **(b)+(d)** | write-only | D7 |
| G26 | **meta-feedback receiving-side** (`feedback-intake.js`): человек должен вручную вспомнить прогнать intake/reconciliation; авто-триггера нет | **(d)** | human-memory | D7 |
| G27 | **patch-candidates [Y/N/E/D]**: чисто ручной гейт без напоминалки, если кандидат месяцами висит в pending | **(d)** | нет reminder | D7 |
| G28 | **approve_overrides.expires_at**: нет hook/rule/periodic job, который бы sweep'ал истёкшие overrides; Periodic (§3.5) явно не реализован | **(e)** | нет sweeper | product / docs |
| G29 | **Periodic-мониторинг (§3.5)** stale-draft detection в реальном времени не реализован; забытые draft'ы копятся без проактивного сигнала | **(e)** | ручной /status | product |
| G30 | **P-RULE-01/02 adaptive-depth классификатор**: если субагент ошибочно пометит significant как cosmetic, quick-check пропустит то, что требовало full 6-lens; мета-верификации нет | **(c)** | judgment без backstop | product |
| G31 | **bg-rename без атомарного apply**: реальный rename — ручной sed/IDE шаг человека; destructive-rename риск вне контроля инструмента | **(a)** | ручной шаг | product |
| G32 | **DEC-DEV номер-аллокатор**: race condition воспроизведена ≥7 раз; `next-dec-dev` не атомарен, митигация чисто дисциплинарная | **(f)+(d)** | broken atomic-lock | D7 |
| G33 | **verify.md ручной command-count baseline** существует параллельно и несинхронизированно с автогенерируемым docs/guide/02-commands.md | **(f)** | два несвязанных механизма | ecosystem |
| G34 | **INFORMATION-MAP P3** (каждый ssot-путь обязан резолвиться): заявлен как принцип, guard-скрипт не реализован | **(e)** | нет | ecosystem |
| G35 | **/ecosystem:disable-d7-audit** упомянут как «not implemented, manual removal works» — мёртвая ссылка | **(f)** | нет | ecosystem |
| G36 | **Design screen-generator / market-researcher / competitor-analyst субагенты** описаны в SPEC, файлов нет; Deep Discovery mode нефункционален | **(e)** | нет | docs / agents |

---

## §2. Ранжирование по ущербу для сквозного потока «идея → прод»

### Tier 0 — потока до прода структурно НЕТ (блокеры самой цели)

1. **G01 — Epic E (последняя миля до прода) не существует.** Буквально нельзя дойти до «прод» через систему: нет CI/build, provisioning, deploy/rollback, monitoring. Всё, что построено, останавливается на P7 «стартует ли приложение в mock-режиме». Зависит от чужих непостроенных предпосылок (Orchestrator §6-канал провалил S6-dogfood; Integrator D3/D4/D5-инструментов нет вовсе). **Это не gap в проводке — это отсутствие финального сегмента конвейера.**

2. **G02 + G03 + G04 — обратный контур отсутствует как класс.** Вся заявленная владельцем нелинейность («результат шага инициирует пересмотр архитектуры / другой процесс») опирается на возврат сигнала назад. Сейчас назад ведёт ровно один канал — запись в `pending-actions.md` — **fire-and-forget, без слушателя, без resume**. Внешний инструмент вообще ничего не возвращает в `.product/`. OD7 await/resume не реализован. То есть петля «impl нашёл проблему → спека/архитектура пересматривается автоматически» физически не замкнута нигде, кроме `lesson-gate`.

### Tier 1 — форвард-цепочка есть, но держится на ручных/prompted швах

3. **G07 + G08 — между командами нет машины состояний.** Весь путь idea→plan→feature→handoff→add — это ручные вызовы + текстовые «Next:». Один пропущенный шаг = поток встал, и ничто об этом не сигналит.

4. **G05 + G06 + G30 — «рефлексы» ревью хрупкие.** Хуки, которые должны форсировать DA/persona-ревью, лишь пишут в очередь; реальный спавн — на памяти LLM, с задокументированным recurring regression (подмена канонического агента). Это подрывает качество на входе в impl-фазу.

5. **G10 + G11 + G12 — середина конвейера (spec→impl) не подтверждена вживую.** Orchestrator↔cc-sdd живьём не прогонялся; вся P3/P5 архитектурно опирается на fallback. Layer-3 вердикты детерминированы, но их релей и запуск — prompted, без runtime-доказательства, что .cjs реально исполнен.

6. **G09 — autonomy resolver построен, но подключён к нулю.** Механизм, который дал бы «сколько угодно итераций» с градуированной автономией (L0-L3), не эмитит ничего — L2/L3 громко деградируют к L1. Владелец сознательно предпочёл честный «не построено» тихой имитации, но для цели «arbitrary iterations autonomously» это ключевой недостающий орган.

### Tier 2 — дрейф и мёртвые ссылки (доверие / корректность, не блок потока)

7. **G14–G18, G20, G21, G33, G35 — spec↔impl drift и мёртвые ссылки.** Реализованные команды ссылаются на несуществующие (verify/debug/replace); SPEC устарели; шаблон тиражирует неверные счётчики в каждый пилот; scan auto-invoke расходится с кодом. Каждый по отдельности не блокирует, но вместе они разъедают доверие к «карте» системы — а владельцу нужна именно предсказуемая карта.

8. **G19, G23, G28, G29, G32, G34 — отсутствующие детерминированные страховки.** Нет catalog↔runner линтера, нет sweep'а истёкших overrides, нет periodic-детектора stale-draft, нет атомарного DEC-DEV-lock, нет guard'а резолвимости SSOT-путей. Всё это «известные, задокументированные» разрывы — честно, но нарастающий built≠validated долг (порог >2 deferred-smoke уже превышен по собственному substrate-graduation-гейту).

### Tier 3 — гигиена контуров обратной связи D7

9. **G24–G27 — контур самоулучшения полу-разомкнут.** Session-audit требует ручного opt-in per-pilot + хардкод-путь; Pending-маркеры висят незакрытыми; patch-candidates и feedback-intake ждут, что человек вспомнит. Это «мета»-версия той же болезни: capture есть, автоматического потребления нет.

---

## §3. Работающие рефлексы (машинная проводка, которую можно считать «нервной системой»)

Настоящий (harness-level) enforcement, а не prompted-дисциплина:

**Блокирующие рефлексы (реально останавливают):**
- **`lesson-gate.js` (Stop, exit 2)** — единственный blocking-by-default хук во всей событийной ткани; замкнутая петля write→block→resolve. Эталон, которого лишено остальное.
- **`cascade-check.js` V-11 auto-fix** — единственный хук, который сам детерминированно мутирует зависимые файлы (переписывает bi-dir refs), а не только сигналит.
- **`process-gate.js` (commit-msg)** + **`check-counts.js`** — блокируют коммит при count-drift / отсутствии CHANGELOG / DEV_JOURNAL (там, где установлен — см. G23).
- **`pre-commit.sh → verify-hooks.js`** — блокирует коммит при синтакс/рантайм-ошибке в любом hook (родился из инцидента 119 silent TDZ-фейлов).
- **CI `.github/workflows/verify.yml`** — блокирующий gate на PR: `npm run verify` (unit+wiring+workflow-syntax smoke).
- **model-pin smoke-gate** (`workflow-syntax.smoke.cjs`) — блокирует agent()-вызов без явного model:/agentType:.
- **runner-level persona re-spawn guard** (`complete-feature.mjs`, `consilium.mjs`) — bounded re-spawn, затем громкий degrade `panel_complete:false`, НИКОГДА general-purpose fallback (правильный анти-паттерн, в отличие от G06).
- **handoff `--with-da-review`** — реальный SlashCommand-вызов, critical findings блокируют генерацию.
- **product-handoff-gate** DoR: 🔴 fail → файл не создаётся, status=blocked.

**Детерминированные оракулы/утилиты (вердикт из кода, не суждения):**
- `completeness-oracle.cjs`, `gap-classifier.cjs` — внешний не-self-grading stop-signal для completeness-loop.
- `consilium-synth.cjs` — детерминированный синтез вердикта жюри (матрица×ранг×veto), общий для Product Epic D и Orchestrator P2.
- `fidelity-oracle.cjs`, `design-coverage-oracle.cjs`, `coverage-oracle.cjs`, `gate-risk-classifier.cjs`, `capability-probe.cjs`, `env-readiness.cjs`, `runtime-readiness.cjs`, `remediation-guard.cjs` — Layer-3 гейты Orchestrator.
- `run-ledger.cjs` — детерминированный per-run трейс (но wiring в диспетчер prompted — G12).
- `next-dec-dev.js` — глобальный max+1 по всем origin/* (но не атомарен — G32).
- `hash.js` — SHA-256 drift-детекция артефактов в handoff.

**Пассивные, но реальные (авто-запись/инъекция, warn-only):**
- `session-state.js` — авто-снапшот `current.yaml` для --continue.
- `bg-extractor.js` — авто-очередь кандидатов глоссария.
- `journal-hook.js` (integrator) — автолог модифицирующих действий с dedup+retention.
- `scope-guard.js` (integrator) — PA-запись при write в forbidden-зону.
- `rails-session-start.js` — SessionStart-инъекция work-history сводки.
- `worktree-enter-guard.js` — advisory pre-flight перед EnterWorktree.
- warn-хуки D7 (`dev-journal/phase-closure/memory-drift-reminder`) — stderr-напоминалки.

Итого: из ~19 продуктовых/дизайн/интегратор-хуков **блокирует по умолчанию ровно один** (`lesson-gate`). Вся прочая ткань — advisory (exit 0), пишущая в 6+ разрозненных `*-pending.yaml`. Реальный enforcement сконцентрирован в git-хуках, CI и детерминированных .cjs/.mjs, а НЕ в событийной ткани runtime.

---

## §4. Сигналы без слушателей и процессы без машинного триггера

### 4a. Сигналы/события, у которых нет процесса-слушателя (пишутся в пустоту)

| Сигнал (кто пишет) | Кто должен слушать | Реальность |
|---|---|---|
| **`pending-actions.md` PA-NNN** (Orchestrator P2-P7, completeness-loop, batch-enrich, consilium, scope-guard) | Product/Integrator/owner-процесс | Нет процесса. Только `/ecosystem:pending-actions` read-only просмотр человеком. **Центральный «немой» канал системы.** |
| **`da-pending.yaml`** (br/ic-change-trigger) | оркестрирующий skill → DA subagent | Prompted; dedup тихо перезаписывает (G05) |
| **`advisor-pending.yaml`** (zone-change-trigger) | completeness-loop → persona subagents | Prompted (G05) |
| **`cascade-pending.yaml`** (cascade-check, non-V-11) | `/product:cascade` | human-memory |
| **`bg-candidates.yaml`** (bg-extractor) | `/product:bg-review` | human-memory (batched) |
| **`app-map-pending.yaml`** (app-map-cascade) | `/design:map --write` | human-memory |
| **Integrator `tool-docs/<tool>.md`** | future Orchestrator Module | Producer без reader (G13) |
| **handoff staleness** (product-handoff-gate stderr) | человек/LLM → --regenerate | Эфемерно, не персистится (G22) |
| **`audit-index.md` Pending-маркеры** (session-audit.js) | `/meta:audit-smoke` | Ничто не обязывает прогнать (G25) |
| **meta-feedback outbox UF-NNN** | `feedback-intake.js` reconciliation | Человек должен вспомнить (G26) |
| **Orchestrator run-ledger / FB-ledger** | consumer/аналитика | live-run не выполнен (built≠validated) |

**Паттерн:** система богата продюсерами сигналов и бедна консьюмерами. Почти каждый обратный/боковой сигнал — это append в файл-очередь, чей единственный «слушатель» — внимательность LLM в текущем контексте или память человека.

### 4b. Процессы без машинного триггера (запускаются только человеком/по памяти)

- **Весь форвард-конвейер** `/product:init → plan → feature → complete → handoff → /integrator:add → /orchestrator:run P3…P7` — каждый шаг explicit human-invocation; нет оркестратора-над-оркестратором, гонящего фичу от идеи до прода.
- **`/integrator:update --repair`** после `/ecosystem:update` (G17).
- **`/meta:audit-smoke`** после накопления Pending-маркеров (G25).
- **`feedback-intake.js`** reconciliation (G26).
- **Periodic validation / stale-draft sweep** (§3.5) — заявлен «ScheduleWakeup v2», не реализован (G29).
- **`approve_overrides` expiry sweep** (G28).
- **memory-sync** — только ручной триггер (promotion к хуку отложена).
- **Epic E deploy** — нет ни триггера, ни процесса (G01).
- **OD7 resume** после решения Integrator по capability-request — нет listener'а (G04).

### 4c. Capabilities-«сироты» (построены, но никем не вызываются)

- **`lib/autonomy-policy.cjs`** — 70 юнитов зелёные, вызывающих 0 (G09).
- **Integrator drift-check.js / contract-validate.js** — в manifest, файлов нет (G16).
- **market-researcher / competitor-analyst / screen-generator субагенты** — в SPEC, файлов нет (G36).

### 4d. Событийные типы, вообще не используемые в продуктовой ткани

В зонах hooks/product, hooks/design, hooks/integrator — **0 из 5** типов SessionStart/SessionEnd/PreCompact/Notification/SubagentStop (схема их поддерживает). Значит: нет проактивного session-start health/drift-check на стороне продукта, нет SubagentStop-хука для верификации, что заспавненный DA/persona реально отработал (что могло бы закрыть G05/G06 механически), нет PreCompact-сохранения контекста очередей.

---

## §5. Мета-вывод и вектор закрытия

**Диагноз.** Ecosystem 3.0 построила богатый набор *детерминированных мышц* (Layer-3 оракулы, git-хуки, CI, консилиум-синтез) и плотную сеть *сенсоров* (PostToolUse-хуки, пишущие в очереди), но **между сенсором и мышцей почти везде стоит человек или «LLM-должен-вспомнить»**. Нервная система разомкнута ровно в тех местах, где владельцу нужна автономная нелинейность: обратный контур (impl→спека), последняя миля (P7→прод), и градуированная автономия (F1-resolver).

**Единственный полностью замкнутый контур — `lesson-gate`** (Stop-хук exit 2 + PreToolUse/UserPromptSubmit ре-сюрфейсинг). Он показывает шаблон, которого лишено всё остальное: *детерминированный блокирующий слушатель на конце очереди*.

**Три структурных приоритета (в порядке ущерба):**
1. **Замкнуть обратный контур** (G02/G03/G04): дать `pending-actions.md` детерминированного слушателя (SessionStart/PreToolUse-хук, который блокирует/сигналит на открытых PA route:product|owner, по образцу lesson-gate) и построить хотя бы минимальный external-output→`.product/` ридер.
2. **Достроить/подключить недостающие органы**: Epic E — иначе цель «на проде» недостижима в принципе; F1-wiring — иначе «сколько угодно итераций автономно» не исполнимо.
3. **Механизировать хрупкие «рефлексы»** (G05/G06): SubagentStop-хук как watchdog, что заспавненный канонический агент реально отработал, — это конвертирует prompted-дисциплину в enforced-контракт.

---

## Короткий ответ

Форвард-поток «идея → спека → impl» существует, но собран из ручных вызовов и prompted-подсказок; **обратный контур (нелинейность, ради которой всё затевалось) не замкнут нигде, кроме `lesson-gate`** — всё назад идёт в `pending-actions.md`/`*-pending.yaml` как fire-and-forget без слушателя. Два разрыва делают саму цель недостижимой сегодня: **Epic E (последняя миля до прода) не построен**, а **внешний инструмент ничего не возвращает в `.product/`**. Реальные «рефлексы» системы — это git-хуки, CI и детерминированные .cjs/.mjs-оракулы; из ~19 runtime-хуков блокирует по умолчанию ровно один, и именно он — единственный образец замкнутой петли, который стоит тиражировать на остальные каналы.
