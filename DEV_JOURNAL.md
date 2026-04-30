# DEV_JOURNAL — Ecosystem 3.0

> **Что это:** журнал решений о разработке самой Ecosystem 3.0. Фиксирует **rationale и lessons**, не «что изменилось» (это CHANGELOG.md), не «что мы строим» (это ROADMAP.md).
>
> **Не путать с:**
> - `CHANGELOG.md` — release notes (что вошло в версию)
> - `ROADMAP.md` — план фаз
> - `.product/.decisions/journal.md` — журнал решений для **пользовательских** продуктовых проектов, которые ведутся через Ecosystem 3.0 (когда dogfooding запустится — для самой Ecosystem 3.0 тоже появится свой `.product/`)
> - `.claude/integrator/project-journal.md` — журнал инфраструктурных решений Integrator
>
> **Что записываем:**
> - Архитектурные решения с rationale (почему X вместо Y; какие альтернативы отвергнуты)
> - Баги → root cause → fix → lesson
> - Specs, которые оказались неверными на практике
> - Изменения scope phase (что выкинули, что добавили, почему)
> - Cross-cutting рефакторы
>
> **Что НЕ записываем:**
> - Рутинные commit-level правки (git log)
> - User stories / фичи (нет такого — экосистема сама продукт)
> - Личные заметки (используй NOTE-* когда dogfooding запустится)
>
> **Формат записи:** см. шаблон в конце документа.
>
> **Теги в использовании:** `#architecture`, `#bug-fix`, `#scope-change`, `#spec-revision`, `#pilot-finding`, `#refactor`, `#tooling`, `#ux`.

---

## Backfill (retroactive entries из CHANGELOG)

Эти записи восстановлены из существующих коммитов и [CHANGELOG.md](CHANGELOG.md) для baseline. Будущие записи делаются по ходу работы.

---

## DEC-DEV-0001 — Two-phase install для решения discoverability `/ecosystem:bootstrap`

**Date:** 2026-04-18
**Trigger:** При первом design pass обнаружено: пока ничто не установит slash commands в `~/.claude/commands/` или `<project>/.claude/commands/`, Claude Code физически не может автокомплит `/ecosystem:bootstrap`. Изначальный дизайн полагался на natural-language trigger («Установи Ecosystem 3.0...») — работал, но discoverability ноль.
**Tag:** #architecture #ux #tooling

### Context
Bootstrap — entry point для всей экосистемы. Если его невозможно вызвать predictably, экосистема не имеет точки входа. Нужен механизм, который сделает команду discoverable до того, как ecosystem физически появится в проекте.

### Options considered
1. **Natural-language trigger** — «скажи Claude установить Ecosystem 3.0». Работает, но требует от пользователя помнить точную фразу; нет автокомплита; нет sanity checks до начала.
2. **Single-step install** — пакет, который при `npx ecosystem-3 init` сразу делает per-project setup. Не работает: нужно помнить команду, нет integration с Claude Code slash commands.
3. **Two-phase install** — global installer (один раз на машину) + slash command `/ecosystem:bootstrap` для per-project. Global installer кладёт команду в `~/.claude/commands/ecosystem/`, после чего автокомплит работает в любой папке.

### Decision
Вариант 3. `install.sh` (Unix/macOS/WSL) + `install.ps1` (Windows PowerShell) one-liner via `curl|bash`/`iwr|iex`. Идемпотентны (re-run = pull latest). `commands/ecosystem/bootstrap.md` отдельно описывает 12 шагов per-project.

### Outcome
Реализовано в коммите Bootstrap infrastructure. Рабочий результат: `mkdir my-product && cd my-product && claude` → `> /ecosystem:bootstrap` (автокомплит работает). Rollout flow в README.md и INSTALL-HUMAN.md разделён на Блок A (one-time) и Блок B (per project).

### Lessons
- Discoverability команд через автокомплит — не косметика, а необходимость для adoption. Полагаться на пользователя «который помнит точную фразу» — пользовательски враждебно.
- Two-phase pattern (global registration → per-project execution) переносится на любую такую систему.
- Idempotent installers — must-have. Каждое design решение должно проходить тест «что если запустить дважды?»

---

## DEC-DEV-0002 — Hook auto-registration через manifest.yaml (Gap 4)

**Date:** 2026-04-19
**Trigger:** Bootstrap копирует hook JS файлы в `.claude/hooks/<module>/`, но `.claude/settings.json.hooks[]` остаётся пустым. Phase 2 hooks (`artifact-validate.js`, `session-state.js`) физически установлены, но **не запускаются** — Claude Code не знает, что их надо вызывать.
**Tag:** #architecture #bug-fix #tooling

### Context
Phase 2 спроектирована с предположением, что hooks работают «из коробки» после bootstrap. Без hooks — quiet-draft-mode (B2), inline validation, session recovery — всё неактивно. Фактически Phase 2 в проде не работала бы.

### Options considered
1. **Документировать в bootstrap.md ручную настройку settings.json** — каждый user копирует hook entries вручную. Хрупко, мешает Phase 3+ (там новые hooks — каждый раз обновлять docs и пользователи отстают).
2. **Hardcode hook list в Step 6 bootstrap** — bootstrap знает захардкоженный список. Каждая новая phase требует правки bootstrap.md. Tight coupling между phase implementation и bootstrap.
3. **Manifest convention** — каждая `hooks/<module>/` директория имеет `manifest.yaml`, описывающий event registrations. Bootstrap Step 6b сканирует manifests, мерджит в settings.json (preserves user-added hooks). Phase N добавляет hook → drop .js + update manifest.yaml. Bootstrap картирует автоматически.

### Decision
Вариант 3. Schema задокументирована в headers manifest файла: `version`, `module`, `hooks[]` с `id`, `file`, `events[]` (`{type, matcher}`), `description`. `hooks/product/manifest.yaml` поставляется с Phase 2 hooks registered. Merge logic: dedup by command string; user-added hooks preserved.

### Outcome
Реализовано (коммит bd42332). Phase 3-6 могут добавлять hooks без правки bootstrap. Existing проекты (если бутстраплены до фикса) — re-run `/ecosystem:bootstrap` (идемпотентно) подхватит manifests без потери data.

### Lessons
- Convention over configuration окупается, когда планируется N+ итераций с похожей структурой. Single-source-of-truth (manifest) убирает класс багов «забыли обновить bootstrap».
- Если первая итерация требует ручной настройки post-install — это технический долг, который нужно погасить до второй итерации (иначе compound).
- Idempotent merge (preserve user data) обязателен для tooling, которое user может re-run.

---

## DEC-DEV-0003 — pmo-mapping.yaml schema simplification (single-layer declared confidence)

**Date:** 2026-04-17 (refactored from 023c3f7)
**Trigger:** Pre-pilot review схемы `pmo-mapping.yaml` — какой confidence-уровень декларируем для PMO coverage инструментов?
**Tag:** #architecture #spec-revision #scope-change

### Context
В первой draft схемы рассматривались три слоя confidence:
1. **Declared** — что заявлено в profile инструмента (high/medium/low)
2. **Smoke-verified** — результат smoke-теста при `/integrator:add` (passes/fails per category)
3. **Empirical** — autoinstrumented usage tracking from adapter invocations

Вопрос: оставить все три или сжать?

### Options considered
1. **All three layers** — максимум визибилити, но требует smoke test infrastructure + tracking adapters per tool. Большой scope для v1.
2. **Declared + smoke-verified** — отбросить empirical (autoinstrument сложно). Smoke tests — overhead для каждого `/integrator:add`.
3. **Single-layer declared confidence** — только что в profile. Refinement через human-driven actions (`/integrator:debug`, `/product:meta-feedback`).

### Decision
Вариант 3. Empirical отброшен, потому что autoinstrumentation captures только invocations через Integrator adapters, миссит direct slash-command invocations (например `/kiro:spec-init`) — partial data хуже чем no data. Smoke-verified отброшен, потому что роль Integrator — «sysadmin, not observer» (DEC-INT-F01). Verification of tool behavior — human-driven через normal usage.

### Outcome
Реализовано в коммите 023def6. Schema в SPEC §4.3, lifecycle в §4.4. Confidence changes требуют explicit human action с journal entry — никакого automatic tracking.

### Lessons
- Сложность системы должна оправдываться value. Если три слоя дают partial visibility, лучше один честный.
- Принцип «sysadmin, not observer» помогает резать scope: что выходит за метафору — кандидат на отброс.
- Empirical tracking with partial coverage = лживая метрика. Лучше явно polагаться на human signal.

---

## DEC-DEV-0004 — Bootstrap first-run usability (clone-to-temp + auto-files awareness)

**Date:** 2026-04-19
**Trigger:** Первая реальная попытка bootstrap провалилась дважды.
**Tag:** #bug-fix #ux #tooling

### Context
Два бага вскрылись при первом bootstrap attempt:

**Bug 1:** `.claude/settings.local.json` блокирует bootstrap. Claude Code auto-creates этот файл при первом запуске (user's permission approvals). Прошлый bootstrap design treated любое non-empty `.claude/` как требующее user confirmation — то есть bootstrap **всегда** prompt'ит, даже на genuinely fresh projects.

**Bug 2:** `git clone <url> .claude` фейлится. Git отказывается клонировать в non-empty directory, поэтому direct-clone strategy фейлится **всегда**, когда `.claude/settings.local.json` присутствует (т.е. почти всегда).

### Options considered
**Bug 1:**
1. Игнорировать любой `.claude/` content — опасно (затрёт user data)
2. Whitelist Claude Code auto-files — distinguish auto-generated vs user-created

**Bug 2:**
1. `rm -rf .claude/ && git clone` — destructive, теряет user permissions
2. Move existing files, clone, restore — fragile
3. Clone-to-temp + merge с `cp -rn` (no-clobber) — preserves existing

### Decision
Bug 1: whitelist known auto-files (`settings.local.json`, `projects/`, `todos/`, `statsig/`, `shell-snapshots/`, `ide/`, `plugins/`). Только truly unknown content триггерит user prompt.

Bug 2: clone-to-`.claude-ecosystem-tmp/` → remove temp `.git/` (avoid nested repo) → `cp -rn` into `.claude/` (preserves existing) → cleanup temp.

Также: ecosystem signature detection (presence of `.claude/docs/pmo/pmo-map.md`) — distinguish re-install от unknown content. Re-install предлагает explicit options (backup+fresh / merge / abort).

### Outcome
Реализовано (коммит cf2178a). Bootstrap теперь работает на typical fresh project без false prompts.

### Lessons
- Real-world dependencies (Claude Code's own state) могут невидимо ломать bootstrap. **Always test bootstrap на машине, где Claude Code уже запускался**, не только на чистой VM.
- `cp -rn` (no-clobber) > `cp -r` для merge сценариев. Default `cp` затирает.
- Distinguish «system state» от «user state» от «our state» — три категории, разная политика для каждой.
- **Каждый bootstrap fix — потенциально DEV_JOURNAL entry.** Эти баги бы повторились в Phase 7 (`/ecosystem:upgrade`), если бы lessons не зафиксированы.

---

## DEC-DEV-0005 — install.ps1 encoding (Windows-1252 → UTF-8)

**Date:** 2026-04-19
**Trigger:** PowerShell 5.1 (default Windows 10/11) выводит Windows-1252 by default, маньглит Unicode box chars (`━━━` → `????`).
**Tag:** #bug-fix #tooling

### Context
Installer output — первое впечатление user от Ecosystem 3.0. Если `━━━` рендерится как `????`, это outright выглядит broken.

### Options considered
1. Force UTF-8 в installer и hope console accepts
2. Replace Unicode chars на ASCII fallback
3. Both — force UTF-8 AND ASCII fallback

### Decision
Вариант 3. `[Console]::OutputEncoding = UTF8` + `$OutputEncoding = UTF8` в начале installer (preserves UTF-8 для последующих user commands в same session). Unicode box chars (`━`, `→`, `✓`, `⚠`, `✗`) заменены на ASCII (`=`, `->`, `[ok]`, `[warn]`, `[fail]`). Bullet-proof rendering независимо от console encoding.

### Outcome
Реализовано (коммит cf2178a). Installer теперь работает консистентно на Windows 10/11 PowerShell 5.1 + 7.x.

### Lessons
- **Windows PowerShell 5.1 ≠ PowerShell 7+.** Default install Windows = 5.1. Always test на 5.1, не только на 7.
- Belt + suspenders для critical UX. Cost — minimal (5 chars replaced); benefit — never breaks.
- При cross-platform tooling — unicode в output это ловушка. Default ASCII, optional rich.

---

## DEC-DEV-0006 — Apply 12 v1 modifications atomically (A1-A3, B1-B2, C1-C4, D1-D3)

**Date:** 2026-04-18
**Trigger:** Pre-imelementation review раскрыл, что v1 baseline (10 итераций design archive) имеет 12 known smell-points. Решение: apply все одновременно в spec, не инкрементально.
**Tag:** #architecture #spec-revision #scope-change

### Context
12 модификаций (A1-A3 ceremony reduction, B1-B2 validation tiering, C1-C4 drift detection, D1-D3 flexibility) обсуждались по одной в design conversations. Каждая независима, но все compatible. Вопрос: ship baseline сначала, потом apply mods? Или apply вместе?

### Options considered
1. **Baseline first, mods later** — реализовать v1 без modifications, потом отдельным release добавить. Минимизирует риск регрессий.
2. **Apply atomically в SPEC, реализация инкрементальная по фазам** — modifications уже в spec, реализация раскатывается в Phase 2-4 по применимости (например, B2 quiet-draft реализуется в Phase 2 hooks; D1 handoff modes в Phase 4).

### Decision
Вариант 2. Modifications уже изменяют core conventions (frontmatter `confidence`, `validation_tier` в product.yaml, `approve_overrides`). Если ship baseline без них, всё придётся переписывать. Все 22 типа артефактов в каталоге уже включают C2 confidence field; B1 tier referenced в hook design; etc.

### Outcome
12 модификаций задокументированы в SPEC, CHANGELOG.md секция [1.0.0]. Реализация раскатывается per phase (B2 implemented в Phase 2 hooks; A1, A3, B1, C1, D2, D3 — в Phase 2/3; D1 — Phase 4).

### Lessons
- Когда modifications изменяют **conventions** (frontmatter fields, config schema), apply atomically в spec обычно дешевле, чем split. Backwards compat overhead для convention changes обычно > value of incremental shipping.
- НО: реализация может быть инкрементальной даже когда spec атомарный. Это снижает риск регрессий без накопления long-term tech debt.
- Documented intent в SPEC ≠ implemented. Каждая v1 modification требует tracking «реализовано ли это где-то». Запиши в Phase Definition of Done.

---

## DEC-DEV-0007 — DEV_JOURNAL.md introduced + methodology framework для разработки экосистемы

**Date:** 2026-04-19
**Trigger:** Pre-Phase-3 methodology discussion. User asked «есть ли журнал ошибок и rationale?» Ответ: для будущих user-projects есть (через Integrator/Product), для разработки самой экосистемы — нет.
**Tag:** #tooling #refactor

### Context
Перед началом длительной работы над Phase 3-7 (~13-20 часов focused) необходим foundation: где фиксировать решения, как избежать повторения ошибок, как обеспечить incremental validation вместо waterfall.

### Options considered
1. **Использовать только git log + CHANGELOG** — традиционный подход. Минусы: git log capture WHAT not WHY; CHANGELOG = release notes, не decision log.
2. **Использовать `.product/.decisions/journal.md` для Ecosystem 3.0 itself** — dogfood early. Минусы: требует bootstrapping `.product/` для самой экосистемы (preventatively heavy перед smoke test).
3. **Separate DEV_JOURNAL.md в корне репо** — namespace clean от user-project journals. Можно migrate в `.product/.decisions/` когда dogfooding запустится.

### Decision
Вариант 3 для immediate. Дополнительные commitments:
- **Memory entries** в `~/.claude/projects/<this-project>/memory/` для context cross-session.
- **CLAUDE.md в корне** — context для AI assistants работающих над самой экосистемой (отличается от `templates/project/CLAUDE.md.template` который для end-user projects).
- **dev/PHASE_3_READINESS.md** — чеклист smoke tests + alignment checks + архитектурных решений перед стартом Phase 3.
- **Incremental pilot** — smoke-test после каждой Phase, не только после Phase 5.
- **Dogfooding direction** — после Phase 2 smoke-test обсудить создание `.product/` для самой Ecosystem 3.0.

### Outcome
Этот файл (DEV_JOURNAL.md) создан + backfilled из CHANGELOG. CLAUDE.md и dev/PHASE_3_READINESS.md создаются параллельно. Memory entries записаны.

### Lessons
- Meta-проекты (system для X, который сам не использует X) — высокий risk самореферентного коллапса. Foundation methodology должен быть установлен **до** начала significant implementation work.
- Decision journals нужны не только для production систем. Solo dev на длительном проекте теряет память о rationale за 2-3 недели; журнал — это память будущего себя.
- **CHANGELOG ≠ DEV journal.** Первый — для consumers (что вошло в release), второй — для developers (почему решили так).

---

## DEC-DEV-0008 — Pilot finding: Phase 2 Discovery validated end-to-end on my-first-test

**Date:** 2026-04-20
**Trigger:** Per DEC-DEV-0007 commitment to incremental pilot: user запустил `/product:init` с реальной идеей (AI video localization для длинного educational контента) в test project `my-first-test/` после завершения Phase 2.
**Tag:** #pilot-finding #validation

### Context
До Phase 3 нужен signal — работает ли Phase 2 end-to-end на реальной идее, или spec-first design имеет критические gaps. ROADMAP изначально ставил PILOT POINT после Phase 5, DEC-DEV-0007 перенёс на after-each-phase. Это первый pilot.

### Options considered
1. Synthetic test-idea — fast, но не поверхит real UX issues (token volume, orchestration complexity).
2. Real idea из user-backlog — slower, но genuine signal.
3. Defer до Phase 5 per original ROADMAP — too late (Phase 3-4 построены на Phase 2 assumptions).

### Decision
Option 2. User выбрал реальную product idea, прогнал Quick mode end-to-end.

### Outcome
**14 артефактов создано, все в `active`:**
- PS, MR (22 sources, credibility medium-high), CA (7 competitors, 6 identified gaps)
- 3 SEG (solo-creators primary, edu-centers secondary, self-learners exploratory)
- 3 VP (per SEG, 1:1 per DEC-ART03)
- 4 HYP (H.A.R.M.E.D. полный, HYP-002 primary)
- BG (18 terms + 2 synonym resolutions)

**Все gates пройдены:** G1 (PS), G4×3 (per-SEG), DRC (A2 batch MR+CA), G4a×3 (per-VP), G5×4 (per-HYP), D1.5z (BG extraction pass).

**Hooks работали:** `edits_since_start: 16` подтверждает реальные invocations `artifact-validate.js` + `session-state.js`.

**Качество output (неожиданно высокое):**
- C2 confidence калиброван нюансированно: `medium-high`, `medium-low`, `low-medium` — не дефолтный `high` везде. Explicit `confidence_notes` с разницей verified vs assumed.
- H.A.R.M.E.D. с deferred zones и per-outcome Decision matrices — spec выдержан.
- Critical thinking: PS утверждение «нет AI-flow для voiceover» явно помечено как частично опровергнутое в MR (Rask/HeyGen/Vozo/Kapwing); primary HYP свитч от HYP-001 к HYP-002 с explicit counter-argument; 5 carry-forward caveats перед `/product:plan`.
- Priority discipline: 3 SEG разведены per primary/secondary/exploratory с rationale; SEG-003 явно out-of-v1 с документированными pivot-сценариями.
- D3 NOTE discipline: «Якорный кейс — process-term Discovery, не BG → в session notes» — ассистент правильно различил типы.

**4 issues found → превращены в DEC-DEV-0009/0010/0011 + одно принято как Phase 3 deliverable:**
1. `discovery-progress.yaml` stale — orchestrator skill не обновляет файл по ходу. → DEC-DEV-0009.
2. `current.yaml` partial-atomicity — `last_artifact_id` и `last_artifact_type` рассинхронизируются. → DEC-DEV-0010.
3. `current.yaml.type: unknown` — command не set explicit. → DEC-DEV-0009 (связано с 1).
4. `confidence_rationale` vs `confidence_notes` drift в PS. → DEC-DEV-0011.
5. BG extraction manually через Bash (`rm .product/.pending/bg-candidates.yaml`) — expected (bg-extractor.js = Phase 3). Не bug.
6. VP-001 не cascade после primary HYP switch — expected (cascade = Phase 3). Не bug.

### Lessons
- **Real pilot vs synthetic test — night and day.** Большинство багов (stale progress yaml, atomicity race) видны только на longer conversation с realistic artifact volume (thousands of lines в артефактах, session compaction сработал).
- **«Smoke test after each Phase» (DEC-DEV-0007) окупился:** 4 небольших fixes до Phase 3 на порядок дешевле, чем обнаружить после Phase 3-5 построенных на флейстоунах.
- **Качество AI orchestration неожиданно высокое.** Критическое мышление, synonym resolution, counter-arguments, priority adjustments — skill prompts работают. Это существенно снижает риск «spec-first-design даст низкое качество output» — основной страх meta-проекта.
- **Future:** pilot после **каждой** phase становится default policy, не только после major. Добавлено в CLAUDE.md § Принципы.

---

## DEC-DEV-0009 — Fix: session-state orchestrator integration (discovery-progress.yaml + current.yaml type)

**Date:** 2026-04-20
**Trigger:** Pilot (DEC-DEV-0008) обнаружил два связанных bug'а: `discovery-progress.yaml` stale на `current_step: D1.2` при завершённой сессии; `current.yaml.type: 'unknown'` вместо `'discovery-session'`.
**Tag:** #bug-fix #architecture #spec-revision

### Context
Phase 2 session state design предполагал **два файла** с разными owners:
- `current.yaml` — hook-managed (session-state.js), file-level metadata (last write)
- `discovery-progress.yaml` — skill-managed (discovery-session.md), orchestration state (current step, approved gates)

Но contract между hook и skill был **implicit**:
1. Skill должен был обновлять `discovery-progress.yaml` при прохождении gates — но в skill не было explicit инструкции. На pilot skill создал файл на D1.1 и забыл.
2. Hook по умолчанию ставил `current.yaml.type = 'unknown'` с комментарием «Command-issued sessions set this explicitly» — но commands этого не делали (`/product:init` не имел step для pre-write).

Без fix `/product:init --continue` восстановит неверную точку.

### Options considered
1. **Всё через hook** — auto-detect step progress из артефактов (если SEG exists → D1.4 done). Сложная эвристика, fragile к timing races.
2. **Разделить responsibilities explicit:** hook — file metadata, skill — orchestration, command — session init. Explicit contract, документированный на обеих сторонах.
3. **Monolithic current.yaml**, убрать progress.yaml. Разные частоты updates (hook на каждый write vs skill на каждый gate) конфликтуют при merge.

### Decision
Option 2. Three-way fix:
- `skills/product/discovery-session.md` — expanded "Session state management" section: 2-file model, explicit table «когда обновлять какие поля» per gate, atomicity instruction (read → modify → write, не терять prior gates).
- `hooks/product/session-state.js` — protect existing values:
  ```javascript
  if (!current.type) current.type = 'unknown';
  if (!current.started_at) current.started_at = now;
  ```
  Если command уже записал — hook не перезаписывает.
- `commands/product/init.md` — new **Step 3b**: перед delegating в skill, создать `current.yaml` с `type: discovery-session` + `discovery-progress.yaml` с initial state (current_step=D1.1, empty gates).

### Outcome
- Hook syntax verified (`node -c`).
- Skill содержит table перехода current_step ↔ last_approved_gates per gate.
- Command initialization contract установлен.
- Future-proof для Phase 3: `/product:plan`, `/product:feature` могут использовать тот же pattern (свой `planning-progress.yaml`, `feature-progress.yaml`).

### Lessons
- **Implicit contracts между компонентами не работают при meta-проекте.** Hook и skill написаны разными сессиями, без explicit owner/update protocol они drift.
- **«Command-issued sessions set this explicitly» в comment кода — design intent, который никто не реализовал.** Audit other TBD-comments в Phase 2 code — возможно есть ещё такие gaps. Added to PHASE_3_READINESS.
- **Pattern для Phase 3+:** любой state file требует в SPEC явного описания: **OWNER, UPDATE FREQUENCY, UPDATE PROTOCOL.** Hook vs skill vs command — разные owners, не путать.

---

## DEC-DEV-0010 — Fix: atomicity of last_artifact_id/type/status in session-state.js

**Date:** 2026-04-20
**Trigger:** Pilot `current.yaml` показал `last_artifact_id: HYP-004, last_artifact_type: glossary` — id от одного файла (enumerable), type от другого (singleton).
**Tag:** #bug-fix #hooks

### Context
`session-state.js` использовал:
```javascript
if (artifactId) current.last_artifact_id = artifactId;
if (artifactType) current.last_artifact_type = artifactType;
if (artifactStatus) current.last_artifact_status = artifactStatus;
```

Intent: «сохранить last enumerable artifact even when write is to singleton». Actual behaviour: если write → HYP-004 (enumerable, id=HYP-004), потом write → glossary.md (singleton, no `id:`), то `artifactId = null`, `if (artifactId)` skips update — `last_artifact_id` остаётся «HYP-004», а `last_artifact_type` обновляется на «glossary». Inconsistent pair.

### Options considered
1. **Store per-file entries** (map path → metadata). Overhead для простого tracking, invalidates simple YAML format.
2. **Always update all three atomically.** Three fields describe the **same file** (last write). For singletons, id=null → YAML formatter skips → field отсутствует в output.
3. **Separate `last_enumerable_*` vs `last_singleton_*` fields.** Extra API surface, unclear consumer value.

### Decision
Option 2. Minimal change:
```javascript
current.last_artifact_id = artifactId;     // null for singletons
current.last_artifact_type = artifactType;
current.last_artifact_status = artifactStatus;
```

YAML formatter existing logic (`if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '')`) skips null → для singletons field просто не появится в output.

### Outcome
- Semantics clearer: три поля всегда описывают одну file (last write).
- Null handling correct — для singleton write last_artifact_id просто не появляется в YAML.
- Hook syntax verified.
- `recent_artifacts` tracking (отдельно, ниже) **остался с `if (artifactId)`** — correct, don't want to push null into recent list (recent только для enumerable artifacts).

### Lessons
- **«If present, update; else preserve»** — attractive convention, но creates inconsistent state когда fields semantically coupled (один источник — один file).
- Atomic updates > clever preservation. Even when it means less info в edge cases.
- Semantic coupling нужно проверять: какие fields describe the same entity? Update их together.

---

## DEC-DEV-0011 — Fix: `confidence_notes` canonicalization in problem-discovery skill

**Date:** 2026-04-20
**Trigger:** Pilot PS (my-first-test) используется `confidence_rationale` вместо `confidence_notes` — drift от канонической schema (PS.md artifact spec, C2 modification в artifacts/README.md).
**Tag:** #spec-revision #bug-fix

### Context
C2 modification (applied в DEC-DEV-0006) определил canonical frontmatter:
- `confidence: high | medium | low` — required во всех 22 типах артефактов
- `confidence_notes: "string"` — required при `confidence != high`, recommended всегда

PS.md artifact spec в `docs/pmo/artifacts/PS.md` использует canonical. Но `skills/product/problem-discovery.md` **не имел explicit frontmatter template** — только conversational instruction «Confidence: X / Rationale: Y» при approve. Ассистент при записи PS guess'ил field name → получилось `confidence_rationale`.

Cross-check other Phase 2 skills: `segment-discovery.md`, `vp-design.md`, `hypothesis-formulation.md` — все имели explicit frontmatter examples с canonical `confidence_notes`. Pilot artifacts (SEG-001..003, VP-001..003, HYP-001..004) использовали правильно. **Drift только в PS.**

### Options considered
1. **Fix только skill** — future PS будет canonical. Existing pilot PS stays (user decides).
2. **Fix skill + rename field в pilot PS** — touch user data без request.
3. **Add validation rule V-C2b** проверяющий exact field name. Overhead; better solved at authoring layer.

### Decision
Option 1. Skill-level fix в `skills/product/problem-discovery.md` Step 3 — added explicit frontmatter template с явным warning «Canonical field names — НЕ варьировать» и списком anti-patterns (`confidence_rationale`, `rationale`, `confidence_reasoning` — все запрещены).

Existing pilot PS в my-first-test — user's call (renaming или leave as-is). Hook validation не проверяет field name (только presence of `confidence`), так что existing PS продолжает работать.

### Outcome
- Future PS artifacts используют canonical `confidence_notes`.
- Consistency recovery pattern: explicit frontmatter template + anti-pattern warnings + spec cross-reference.
- SPEC → skill-prompt alignment restored (at least для PS).

### Lessons
- **Spec говорит «что», skills должны говорить «как»** с explicit templates. Прошение ассистента «follow PS.md artifact spec» — не достаточно; AI склонен rename fields «для естественности» если явно не запрещено.
- **Каждый тип артефакта, создаваемый skill-ом, требует frontmatter template непосредственно в skill** (не только в artifact spec). Added to PHASE_3_READINESS: audit all skills when new artifacts added в Phase 3.
- **Layer-2 validation (hook checking exact field name) — полезная safety net для Phase 4.** Но primary fix — на authoring layer.
- **Pattern of drift:** когда skill ссылается на spec без inline template, drift inevitable. Inline templates + anti-pattern warnings — лучшая defensive programming в skill prompts.

---

## DEC-DEV-0012 — Phase 3 architectural decisions consolidation (C.1-C.5, B.1-B.5, D.1-D.5)

**Date:** 2026-04-20
**Trigger:** Phase 2 pilot validated (DEC-DEV-0008); 3 pre-Phase-3 fixes applied (DEC-DEV-0009..0011); architectural readiness review per `dev/PHASE_3_READINESS.md` Sections C/B/D. Discussion across 3 conversation turns covered all 15 unresolved items.
**Tag:** #architecture #scope-change #spec-revision

### Context

Phase 3 ROADMAP draft (2026-04-18) включала 18 файлов: 5 commands, 9+3 skills, 2 subagents, 4 hooks. Estimated 4-6 часов. Реальный анализ перед kick-off вскрыл:
- 5 архитектурных неопределённостей (Раздел C) — без явного decision implementation будет блокировать каждые 30 мин
- 5 точечных alignment вопросов (Раздел B)
- 5 scope discipline решений (Раздел D)

Решение принимать каждый item explicit, записывать rationale, fix spec drift до kick-off — иначе Phase 3 будет накапливать ошибки.

### Decisions summary (15 items)

**Section C — architectural:**

**C.1 Magnitude classifier для P-RULE-01/02** — accepted: **Trigger-DA-on-every-change + adaptive-depth single subagent invocation**. Subagent сам классифицирует magnitude (cosmetic / significant) на Шаге 1 (~30 сек), затем выбирает depth output на Шаге 2. Cosmetic → quick consistency check; significant → full 6-lens. Output unified format с `magnitude` + `classification_rationale`. Никогда не пропускаем real changes; cost для cosmetic minimal; решения в момент изменения, не batched.

**C.2 DA debt mechanism** — **DROPPED, not deferred.** Logical consequence of C.1: при trigger-every-change нет skip → нет debt. Также: оценка пост-фактум — anti-pattern (catch-уже-сделанное вместо catch-перед-commit). SPEC §6.2 (processes.md) и §7 (validation.md) refactored.

**C.3 A1 auto-approve trigger location** — accepted: **Skill writes status:active directly + decision journal + conversational notification**. 🟢 skills (`lifecycle-derivation.md`, `vc-derivation.md`, `rpm-derivation.md`) включают decision logic в prompt: self-assess confidence + check tier-applicable V-* + write status. Hook validates independently, не auto-reverts (race risk). Notification flow: «✓ LC-002 auto-approved (rationale). Type 'revert LC-002' to roll back.»

**C.4 Cascade protocol implementation scope** — accepted: **Detection + V-11 auto-fix только**. Hook `cascade-check.js` detects, V-11 (bi-dir refs) auto-fixes; rest queued в `.pending/cascade-pending.yaml`; navigation manual через `/product:cascade`. Full BFS auto-fix beyond V-11 + bundle approve UX → v1.1.

**C.5 D2 approve_overrides runtime** — accepted: **Hook reads + inline expires_at check + audit log via pending/validation-pending.yaml со статусом overridden**. `artifact-validate.js` extension parses `validation_overrides[]` + `approve_overrides[]`; expired treat as inactive; skipped rules logged для audit trail.

**Section B — alignment:**

**B.1 Skill audit + convention** — accepted: convention codified в CLAUDE.md «Skill конвенции». Каждый skill, создающий артефакт, обязан содержать explicit frontmatter template + anti-pattern warnings + ASCII slug rule reference. Reference: `problem-discovery.md` (post-DEC-DEV-0011), `note-promote.md` (created в этом же commit как Phase 2 gap fix). Phase 3 skills — checklist при написании.

**B.2 product.yaml fields runtime check** — confirmed: `artifact-validate.js` reads `validation_tier` + `draft_mode_quiet_hooks`. Other fields decorative до Phase 3 (где skills для C.3 add `auto_approve_confirmation_artifacts.*` reading) и Phase 4+ (NFR, stale, validation-tier full).

**B.3 + B.4 Stub validation** — confirmed no gap. BG extraction manual placeholder в Phase 2 OK; `bg-extractor.js` приходит Phase 3. drift-check работает independently от cascade-check (different mechanisms — semantic alignment vs structural traversal).

**B.5 Path/slug conventions** — accepted: **ASCII slugs only**, transliterate cyrillic per ГОСТ 7.79-2000 System B. Rule codified в `docs/pmo/artifacts/README.md` («Naming conventions»). Pilot files (`SEG-001-solo-creators`, `HYP-001-glossary-retention`) уже соответствуют — no retroactive fixes.

**Section D — scope discipline:**

**D.1 Deep mode subagents** — deferred to v1.1. Phase 2 Quick mode produced quality output exceeding expectations (DEC-DEV-0008). Building Deep without validated need = over-engineering. **Full architectural context preserved** в `dev/v1_1_backlog.md` (8-phase pipeline reference, MCP requirements Firecrawl+Exa+GitHub, isolated-context rationale, integration points). Bring-forward trigger: 2-3 real Discoveries показывают Quick mode limits.

**D.2 Atomic mass-rename `/product:bg:rename`** — deferred to v1.1. v1 ships manual preview workflow (sed-suggest + IDE find-replace). Atomic implementation требует git tooling + conflict handling + rollback — significant code для unvalidated frequency (pilot = 0 mass-renames). Context preserved в `dev/v1_1_backlog.md`.

**D.3 NFR Review F.5a** — confirmed Phase 4 (per ROADMAP). Phase 3 `feature-session.md` skill включает explicit placeholder: F.5a deferred Phase 4, FM.nfr_status default = pending.

**D.4 + D.5 Final must-have / deferred lists** — finalized в обновлённой Phase 3 секции ROADMAP.md. 5 commands + 12 skills + 3 new hooks + 1 hook extension. Estimate revised 4-6h → 6-10h после scope analysis.

### Outcome

**Files modified:**
- `docs/pmo/processes.md §6.2` — magnitude-gated → adaptive-depth refactor
- `docs/pmo/validation.md §7 P-RULE-01/02` — same refactor
- `docs/pmo/artifacts/README.md` — ASCII slug rule + transliteration spec
- `ROADMAP.md` — Phase 3 deliverables refined; «Где мы сейчас» updated; Post-MVP v1.1 section expanded
- `dev/PHASE_3_READINESS.md` — status banner final readiness; sections C/B/D marked done
- `CLAUDE.md` — Skill conventions section с frontmatter template requirement
- `DEV_JOURNAL.md` — this entry

**Files created:**
- `dev/v1_1_backlog.md` — preserved context для всех v1.1 deferrals (Deep mode, atomic mass-rename, full BFS cascade, bundle approve UX, DA debt revival argument)
- `skills/product/note-promote.md` — Phase 2 gap fix (skill referenced в `commands/product/promote-note.md` но не существовал)

**Verified:**
- `my-first-test/.product/` files use ASCII slugs ✓
- `artifact-validate.js` reads correct config fields ✓

**Phase 3 status:** 🟢 READY for kick-off. All blocking items resolved.

### Lessons

- **Architectural readiness review до kick-off окупается всегда.** 15 items исследованы за ~3 conversation turns (~2 часа); каждый item имел real implementation impact. Без review — каждый блокировал бы implementation работу × ~1 час avg = 15 часов sunk cost. ROI positive in expectation.
- **Решения каскадятся.** C.1 (adaptive-depth DA) автоматически закрыл C.2 (DA debt). При scope review всегда искать «какие decisions станут unnecessary при decision X».
- **Спецификация — не неизменна.** SPEC писался без implementation experience; pilot vскрыл что magnitude-gated подход оправдывает себя хуже adaptive-depth. Refactor SPEC в момент решения, не позже — иначе spec drift накапливается.
- **«Defer не значит выкинуть.»** Deep mode + atomic mass-rename + full BFS cascade — все имеют preserved architectural context в `dev/v1_1_backlog.md`. При возврате не пришлось бы reconstruct из обрывков. User explicit потребовал этого preserve action — ценный pattern для всех future deferrals.
- **Phase 2 gap каскадно вскрылся.** `note-promote.md` skill был referenced в command но не создан — gap не замечен в pilot (NOTE promotion не использовался). Audit при readiness review поймал. Lesson: каждый «referenced but not implemented» pointer — потенциальный gap; sweep periodically.
- **Spec drift через AI rename fields** (DEC-DEV-0011 lesson) — generalised в convention (CLAUDE.md). Pattern: один observed instance → systemic preventative measure для всех future similar artifacts.

---

## DEC-DEV-0013 — Phase 3 implementation kickoff + 9 ambiguity resolutions + 4 spec drift fixes

**Date:** 2026-04-27
**Trigger:** Per CLAUDE.md «Принципы работы § 1 DEV_JOURNAL обязателен» + Phase 3 implementation brief (Этап 3 «Decision gate»). Перед kickoff Phase 3 implementation работы — все validation findings и resolved ambiguities должны быть зафиксированы. User accepted findings + plan; этот entry consolidates resolutions для будущей справки.
**Tag:** #architecture #scope-change #spec-revision #ux

### Context

Этап 1-2 загрузки контекста для Phase 3 implementation выявили:

1. **9 ambiguities** в DEC-DEV-0012 outcome, требующих explicit resolution до implementation. Без резолюции skill prompts либо ambiguous, либо рискуют drift как PS skill DEC-DEV-0011.
2. **4 spec drift'а** — superseded magnitude-gated language оставшийся в `docs/product-module/SPEC.md`, `docs/pmo/processes.md §14.2`, `agents/product/devils-advocate.md`, `CHANGELOG.md`. DEC-DEV-0012 update'ил `processes.md §6.2` + `validation.md §7`, но не sweep'нул другие docs — остаточные references противоречат refactored model.

### Decisions — 9 ambiguity resolutions

1. **planning-progress.yaml / feature-progress.yaml schema:** Per-FM file `.product/.sessions/feature-<FM-id>-progress.yaml`. Planning singleton `.product/.sessions/planning-progress.yaml` (только одна Planning сессия в момент времени). `current.yaml` tracks last-touched id для `--continue` defaults. **Rationale:** per-FM избегает overwrite при switching между features mid-enrichment; aligns DEC-DEV-0009 pattern (skill-managed orchestration vs hook-managed file metadata).

2. **A1 conditions per 🟢 skill (auto-approve logic в C.3 implementation):**
   - LC (lifecycle-derivation): V-05 (states reachable from initial via parsing transitions) + V-06 (transitions имеют trigger or guard) — оба auto-checkable in skill через parsing
   - VC (vc-derivation): V-07 (count main/alt/error vs SC.flow_type)
   - RPM (rpm-derivation): V-11 (bi-dir refs к SC.actors valid; нет orphan roles)
   - All also require `confidence: high` + `confidence_notes` filled (C2 modification compliance)

3. **cascade-check.js V-11 на draft target:** Skip auto-fix, queue только. Aligns B2 quiet draft mode — hook не surfacing на draft, queue findings для approve gate.

4. **DA findings persistence:** `.product/.da-findings/<artifact-id>-<YYYY-MM-DD>-<HHMM>.md` per existing devils-advocate.md convention.

5. **F.0 D1-alignment (P2.B creation mode):** AI proposes top-2 SEG candidates с rationale; user confirms или chooses новый SEG (mini-D1.4 invocation).

6. **manifest.yaml entries для Phase 3 hooks:** Все 4 hooks PostToolUse, matcher `Write|Edit` (Claude Code matcher работает на tool name, не file path). File-path filtering — internal в JS (per Phase 2 pattern: artifact-validate.js, session-state.js).

7. **A1 notification placement:** Skill записывает `status: active` + journal entry в `.product/.decisions/journal.md` + surfaces conversational notification user'у в orchestrator output (не stderr — user immediate sees + can revert через «revert <ID>»).

8. **DA orchestration flow (NEW resolved):** Hooks (br-change-trigger.js / ic-change-trigger.js) PostToolUse — записывают pending entry в `.product/.pending/da-pending.yaml` + stderr signal. Active LLM session видит stderr → orchestrator skill (feature-session.md) spawns `product-devils-advocate` subagent через Agent tool с `Mode: adaptive` brief. Subagent внутри: Step 1 classify magnitude, Step 2 adapt depth (cosmetic → quick consistency / significant → full 6-lens). Findings → `.product/.da-findings/`. Approve gate (orchestrator) reads findings + presents to user.

   **Critical architectural note:** hook не может spawn subagent напрямую (PostToolUse limitations — runs as bash, не в LLM context). Но stderr-driven follow-up в next LLM action preserves «in-the-moment» semantic per DEC-DEV-0012 — subagent invocation происходит на the same turn, не batched.

9. **Decision journal location (NEW resolved):** `.product/.decisions/journal.md` — создаётся при первом auto-approve / DA decision (skill creates dir + file if not exists). Entry format:
   ```
   ## DEC-AUTO-NNN — Auto-approve <ARTIFACT-ID>
   Date: <ISO>
   Triggered by: <skill> A1 logic
   Confidence: <high|medium|low>
   Conditions met: [V-XX passed, ...]
   Rationale: <one paragraph>
   Revert: type 'revert <ARTIFACT-ID>' in conversation
   ```
   Convention новая для Phase 3, не в spec ранее. Documented в feature-session.md / planning-session.md skills.

### Decisions — 4 spec drift fixes (executed pre-kickoff)

**A.1 `agents/product/devils-advocate.md` refactor:**
- Frontmatter description: добавлен adaptive-depth language; removed «Magnitude-gated trigger (A3)»
- Brief format: `Mode: adaptive | full` field; для adaptive — `Diff (for adaptive mode):` field вместо pre-classified `Magnitude` от caller
- Новая секция «Adaptive-depth mode» — Step 1 classify (cosmetic | significant с triggers per processes.md §6.2 + validation.md §7) + Step 2 adapt depth + Anti-rationalization guard (don't over-classify as cosmetic)
- Output format split на Shape A (cosmetic abbreviated single-block) + Shape B (significant/full 3-tier); header теперь содержит `Mode`, `Magnitude`, `Classification rationale`

**A.2 `docs/product-module/SPEC.md` refactor:**
- Line 6 v1 modifications: «A3 (adaptive-depth DA — refactored DEC-DEV-0012 from magnitude-gated)»
- Line 77 (Adversarial consciousness): «adaptive-depth DA review» с reference на §6.2 refactored
- Line 350 (`product-da-review.md` description): «adaptive-depth trigger logic» с DEC-DEV-0012 reference
- §6.4 (`ic-change-trigger.js`): full refactor с superseded block referencing DEC-DEV-0012 + новая adaptive-depth flow description
- §6.5 (`br-change-trigger.js`): same pattern
- §6.7 added (`cascade-check.js`) — был не задокументирован в SPEC.md hooks section до DEC-DEV-0012 (только в processes.md / validation.md упоминался)
- Line 903 hooks list: old hook names → new `ic-change-trigger`, `br-change-trigger`, `cascade-check`

**A.3 `docs/pmo/processes.md` §14.2 hooks list (lines 1165-1166):** old names + «magnitude-gated» replaced на new + «adaptive-depth single subagent invocation»

**A.4 `CHANGELOG.md` line 103 forward-compat note:** old hook names → new

### Outcome

All blocking spec inconsistencies resolved before Phase 3 implementation:
- `devils-advocate.md` ready to be invoked с `Mode: adaptive` от new hooks (A.1) — будет работать как single subagent invocation per DEC-DEV-0012 C.1
- `SPEC.md` / `processes.md` / `CHANGELOG` cleaned of magnitude-gated references (A.2-A.4) — нет ложных pointers для будущего читателя
- 9 ambiguities documented с decisions for skill prompts to follow

**Phase 3 plan revised:** 22 files (originally 21 + devils-advocate.md refactor counted as #20 в Phase 3.E), 10 sub-phases (A→J).

Pre-existing skill drift (B.1 — `hypothesis-formulation.md` non-canonical fields `success_threshold`/`linked_segment` vs HYP.md spec `target_value`/`segment`) — out-of-scope Phase 3, noted for future audit. Pilot HYP-001..HYP-004 follow skill conventions, not spec — это accepted state per DEC-DEV-0011 «don't touch user data without permission».

### Lessons

- **Pre-kickoff sweep окупается.** 4 spec drift fixes найдены за 1 grep run по `magnitude-gated|da-debt|ic-change-da-trigger|br-change-review-trigger`; иначе бы каскадили в implementation как «спец говорит X, но что новый код должен делать?» blockers по 30 мин каждый. Total cost ~30 мин fix vs ~2-4 часа sunk cost при discovery в середине Phase 3.

- **Spec docs не атомарны при refactor.** DEC-DEV-0012 update'ил `processes.md §6.2` + `validation.md §7`, но `processes.md §14.2` (hook list в том же документе) остался стейл — single-doc updates тоже могут leave hanging references. **Pattern для будущих architectural decisions:** при refactor — grep stale terms по всему `docs/` + `dev/` + agents/skills/commands/hooks/CHANGELOG перед закрытием decision. Add to checklist в DEV_JOURNAL template.

- **«Single subagent invocation» constraint требует subagent-side classification.** Adaptive-depth model architecturally диктует, что subagent prompt должен handle оба mode'а internally — caller (hook) не может pre-classify (требует LLM call, ломает «no double LLM call» claim). Это меняет brief format и output format одновременно — refactor нужен полный, не cosmetic.

- **«In-the-moment» semantics через stderr-driven orchestration.** PostToolUse hooks не могут directly spawn subagent (architectural boundary Claude Code), но stderr signals → next LLM action видит → spawns. Preserves DEC-DEV-0012 «no debt accumulation» claim, при этом respect'ит Claude Code architectural boundaries. **Pattern переносим на любой hook → subagent flow.**

- **Decision journal location convention emerged late.** Phase 2 не создал `.product/.decisions/`, и spec не явно требовал. Phase 3 A1 auto-approve вынуждает существование — convention заводится здесь. Documenting в DEC-DEV-NNNN перед использованием в коде, не post-facto.

---

## DEC-DEV-0014 — Phase 3 implementation complete + lessons

**Date:** 2026-04-27
**Trigger:** Phase 3.J final — implementation across 10 sub-phases (A→J + prerequisite) completed; document outcome + accumulated lessons before Phase 4 readiness gate.
**Tag:** #scope-change #refactor #ux #tooling

### Context

Phase 3 (Planning + Feature Enrichment per ROADMAP) implemented per scope refined в DEC-DEV-0012 + ambiguity resolutions / spec drift fixes locked в DEC-DEV-0013. Implementation took один focused day session (1 user message «Стартуем!» kicked off, 9 subsequent commits).

**Sub-phases delivered:**

| Sub-phase | Files | Lines | Commit |
|---|---|---|---|
| Prerequisite (A.1-A.4 spec drift + DEC-DEV-0013) | 8 modified | +221/-25 | d82b656 |
| Phase 3.A — Planning core | 5 new (4 skills + 1 cmd) | +1384 | 044fdf0 |
| Phase 3.B — Feature orchestrator | 2 new (1 skill + 1 cmd) | +731 | a7619cc |
| Phase 3.C — F.2-F.7 derivation skills | 6 new skills | +1683 | 64c741b |
| Phase 3.D — BG + cascade protocol | 2 new skills | +567 | 292b411 |
| Phase 3.E — 4 hooks | 4 new hooks | +1279 (после bg-extractor JSDoc fix) | 52667e0 |
| Phase 3.F — D2 overrides | 1 modified hook | +209/-28 | 6638b84 |
| Phase 3.G + 3.H — cmds + manifest | 3 new cmds + manifest | +537/-1 | 4ab35eb |
| Phase 3.I — static verification + smoke plan | 1 new doc | +298 | 5dd4d4c |
| Phase 3.J — final docs (this entry) | CHANGELOG + ROADMAP + DEV_JOURNAL + Phase 4 readiness | TBD | TBD |

**Total:** 23 new + 9 modified files; ~6800+ lines net additions across 10 commits.

### Outcome

**All Phase 3 acceptance criteria from ROADMAP met (modulo real run smoke test):**

- [x] `/product:plan` command + planning-session/mvp-scoping/roadmap-planning/release-planning skills (Phase 3.A)
- [x] `/product:feature` command + feature-session orchestrator + 6 per-step skills (F.2-F.7) (Phase 3.B + 3.C)
- [x] BG extraction (bg-extractor.js Phase 1 + bg-extraction.md skill methodology) (Phase 3.D + 3.E)
- [x] Cascade detection + V-11 auto-fix (cascade-check.js + cascade-protocol.md) per DEC-DEV-0012 C.4
- [x] Adaptive-depth DA orchestration (br-change-trigger.js + ic-change-trigger.js + refactored devils-advocate.md) per DEC-DEV-0012 C.1 + DEC-DEV-0013 #8
- [x] A1 auto-approve logic для 🟢 LC/VC/RPM (in-skill self-checks per DEC-DEV-0013 #2 + #7)
- [x] D2 overrides runtime (artifact-validate.js extension per DEC-DEV-0012 C.5)
- [x] Manual mass-rename (`/product:bg-rename`) per DEC-DEV-0012 D.2 (atomic deferred v1.1)
- [x] Manifest registration для 4 new hooks (Phase 3.H)
- [ ] **Real run smoke test pending** — see `dev/PHASE_3_SMOKE_TEST_PLAN.md`; results будет populate retroactive DEC-DEV-NNNN entry

**Phase 3 placeholders surfaced (Phase 4/6 work, не bugs):**
- F.5a NFR Review (Phase 4)
- F.8 Design Module (Phase 6 conditional activation)
- F.9 FM-level Product DA (Phase 4 manual `/product:da-review`)

### Lessons

#### Process lessons

1. **Architectural readiness gate (DEC-DEV-0012) + ambiguity resolution gate (DEC-DEV-0013) saved entire Phase 3 from churn.** 9 ambiguities resolved + 4 spec drift fixes pre-kickoff = zero мid-phase blocking decisions. Without these, each ambiguity would have cost ~1 hour mid-implementation = 9-15 hours sunk cost. Pre-kickoff cost: ~3 hours of conversation. **ROI: ~3-5x.**

2. **Per-sub-phase commits + commit messages with mental smoke tests** — disciplined cadence (10 commits, none «WIP»). Commit messages document architectural rationale immediately when decisions made; Phase 3 commits read as mini-DEV-JOURNAL entries.

3. **Static verification suite valuable but doesn't replace real run.** Catches: missing files, broken cross-refs, syntax errors, frontmatter compliance. Doesn't catch: prompt-following correctness, A1 actually firing per spec, DA orchestration end-to-end, cascade triggering как expected. Both layers needed.

4. **Cuttable scope discipline held throughout.** F.5a/F.8/F.9 surface placeholders without inline implementation; v1.1 deferrals (atomic mass-rename, full BFS cascade, bundle approve UX) preserved via dev/v1_1_backlog.md references вместо silent scope creep. **Pattern:** «defer не значит выкинуть» (DEC-DEV-0012 lesson) generalized.

#### Architectural lessons

5. **Per-FM session state pattern (`feature-<FM-id>-progress.yaml`) is correct architecture per DEC-DEV-0013 #1.** Rationale: switching между FMs mid-enrichment без overwrite. Singleton (planning-progress.yaml) works для Planning because MVP/RM are themselves singletons; per-FM correct for Features because features parallel.

6. **A1 auto-approve self-check responsibility belongs к skill, не orchestrator.** Skill knows applicable V-* rules + can self-validate them. Orchestrator (feature-session.md) trusts but verifies через journal entry inspection. Cleaner separation; if A1 misfires — meta-feedback issue, не orchestrator bug.

7. **DA orchestration through stderr → orchestrator → Agent tool — works around hook architectural constraint elegantly.** Hooks (PostToolUse) can't spawn subagents directly (run as bash, не имеют LLM context). Stderr-driven follow-up в next LLM action preserves «in-the-moment» semantic per DEC-DEV-0012 «no debt accumulation» claim. **Pattern перено

симо on any future hook → subagent flow.**

8. **Cascade scope discipline (V-11 only auto-fix; rest queue) — right tradeoff.** Broader auto-fix would risk silent breakage (e.g., V-08 terminology auto-add could create wrong BG entries). Manual review через `/product:cascade --pending` для non-V-11 — slower but safer для v1. Full BFS auto-fix has v1.1 trigger condition (pattern emerges from `cascade-pending.yaml` resolutions).

#### Implementation traps avoided / patterns generalized

9. **JSDoc + glob patterns conflict** — `/** ... .product/**/*.md ... */` block comment terminates at `*/` substring inside path. Caught by `node -c` syntax check. **Pattern:** avoid glob patterns в JSDoc /** ... */ blocks; use prose descriptions or escape sequences. Added к Phase 3.E commit message lessons; future hooks reference.

10. **Spec docs sweep pattern proven again** — DEC-DEV-0012 update'ил processes.md §6.2 + validation.md §7 but не §14.2 (same document!). DEC-DEV-0013 grep run found 4 stale sections. **Pattern:** при architectural refactor — `grep stale terms` по entire `docs/` + `dev/` + agents/skills/commands/hooks/CHANGELOG **before** closing decision. Should be added to DEV_JOURNAL template note.

11. **B.1 frontmatter convention discipline pays off.** All Phase 3 skills include explicit frontmatter templates с anti-pattern field name lists (per CLAUDE.md + DEC-DEV-0011 lesson). Anti-pattern field name lists especially important для FM (many fields), BR (parameters easy to misname), MVP/RL (target_launch vs target_date confusion). **Result:** zero PS-style drift expected в Phase 3 outputs (real run will verify).

12. **Decision journal location convention (`.product/.decisions/journal.md`) emerged late but cleanly.** Не was в spec; Phase 3 A1 auto-approve forced existence. DEC-DEV-0013 #9 documented convention before code reference. **Pattern:** novel filesystem conventions → document в DEC-DEV-NNNN before first code reference.

#### Open items для Phase 4 readiness

- **Real run smoke test outcome** populates retroactive DEV_JOURNAL entry. If regressions found — fix before Phase 4 kick-off.
- **A.1 / B.1 hypothesis** (no PS-drift в Phase 3 outputs) verified только by smoke test; static verification cannot prove this.
- **`hypothesis-formulation.md` non-canonical fields** (B.1 finding из DEC-DEV-0013) — pre-existing Phase 2 drift, не addressed Phase 3. Should be queued для Phase 4 readiness audit.
- **Decision journal volume.** Phase 3 introduces journal entries для every Strategic approve + every A1 auto-approve + every DA dismissal + every cascade resolution. Volume may grow large; consider periodic archive convention в Phase 4.

### Next

- **Phase 3.I real run smoke test** (user-driven, см. `dev/PHASE_3_SMOKE_TEST_PLAN.md`) → results to retroactive entry.
- **Phase 4 readiness gate** перед Phase 4 kick-off (TBD when scheduled). See `dev/PHASE_4_READINESS.md` placeholder.

---

## DEC-DEV-0015 — D7 Meta-Improvement Module preliminary spec + design kickoff prompt

**Date:** 2026-04-27
**Trigger:** Post-Phase-3-closure user observation: после major phase implementation systematically не выполняются hygiene activities (doc health check, bootstrap regression, doc consistency, cleanup discipline). 10-15:1 add:cleanup ratio is alarming для long-term healthy state. User proposed formalizing this as new module.
**Tag:** #architecture #scope-change #tooling

### Context

User observed что Phase 3 closure missed several systematic post-phase activities:
1. Documentation health check (ROADMAP, README, SPEC, processes, validation, artifacts)
2. Bootstrap install/update verification (can /ecosystem:bootstrap install Phase N changes cleanly?)
3. Documentation consistency check (cross-doc references after changes)
4. Cleanup/archive obsolete information (counter to add-only growth)

Methodological framing emerged through conversation:

**Two-layer system:**
- Level A (продуктовый): Ecosystem 3.0 как инструмент управления **чужими** продуктами (existing — Product/Design/Integrator/Orchestrator modules)
- Level B (мета): **сама Ecosystem 3.0** как продукт, который мы строим с AI-assist'ом — нет formalized methodology

**D6 vs D7 distinction:**
- D6 (existing pmo-map.md «integrator-module») — governance over user's PMO (Level A)
- D7 (new, this entry) — governance over Ecosystem 3.0 development itself (Level B)

D6 ≠ D7. They address different concerns at different layers. User clarified explicitly (response #1).

### Options considered

User initially proposed combining with existing D6 or adding to CLAUDE.md. Through discussion:

1. **Add rules к CLAUDE.md только** — minimal, но heavyweight CLAUDE.md grows; rules не codified for actual execution
2. **Extend D6 (integrator-module) с meta-improvement subdomain** — мixes user-PMO governance с ecosystem-dev governance; muddles architectural cleanliness
3. **New D7 module — meta-improvement, separate** — clean separation, owned by ecosystem creator (developer side, not user-of-Ecosystem)
4. **Recursive Product Module application к самой Ecosystem** — дед'ом DEC-DEV-0008 проговорил dogfooding direction; user clarified (response #3) что это **НЕ направление** для D7

### Decision

**Option 3** — separate D7 module, named «meta-improvement».

**Scope discipline applied к D7 itself per user response #4:**
- **Stage 1 (this entry):** preliminary SPEC + design kickoff prompt for next session — capture only, не mechanism design
- **Stage 2 (next session):** mechanism design (checklists primarily; skills/commands deferred until proven need)
- **Stage 3+ (later):** formalization as skills/commands/hooks if multiple phase closures show pattern emergence

**Stage 1 deliverables (this commit):**
- `dev/meta-improvement/SPEC.md` (513 lines) — preliminary spec capturing:
  - Origin observation (user's 4 rules)
  - Two-layer methodological framing (Level A/B)
  - D7 vs D6 distinction
  - Reference model skeleton (7 components, gap analysis vs current capabilities)
  - 10 open questions for design session
  - Anti-patterns specific to meta-domain (8 enumerated)
  - Initial principles (cuttable scope, pattern emerge before formalize, separate from product modules, dev/ location, real ROI focus, self-application without recursion)
  - References (internal + external/methodological)
  - Status update protocol
  - Distillation of one principle (SPEC §9): «D7 — это «нашему развитию нужна **своя** дисциплина», не «та же дисциплина что мы даём пользователям»»

- `dev/meta-improvement/DESIGN_KICKOFF.md` (310 lines) — self-contained kickoff prompt для new Claude Code session:
  - Mirror structure of «Phase 3 implementation kickoff» prompt (proven pattern)
  - 6 stages: context loading (5 levels) → validation → decision gate → design tasks → discipline → commit
  - Design tasks divided: 4.A mandatory (phase closure checklist, phase kickoff template, conventions doc, DEV_JOURNAL entry), 4.B stretch (pattern library starter, bootstrap regression test plan, memory sync protocol), 4.C deferred (skills/commands/hooks, CLAUDE.md updates, full pattern library, .product/ for Ecosystem)
  - Anti-pattern specific guards (8 enumerated, focus on premature formalization + Product Module recursion + scope creep)
  - Pre-kickoff 6-question final check

### Outcome

D7 substrate prepared. Design session in fresh chat continues per DESIGN_KICKOFF.md:
- Substrate sufficient for grounded design без re-discovery
- 10 open questions explicit для resolution
- Mandatory deliverables defined (4.A) — concrete + actionable
- Stretch + deferred clearly marked — guards against scope creep
- Reference model skeleton serves as substrate, not authoritative

**Files created:**
- `dev/meta-improvement/SPEC.md`
- `dev/meta-improvement/DESIGN_KICKOFF.md`

**No changes к:**
- CLAUDE.md (defer to next session per user response #4 + premature update guard)
- Product/Design/Integrator namespaces (separate per user response #3)
- ROADMAP.md (D7 not part of Phase progression — это developer-side module, не product release artifact)
- Memory MCP (defer; design session may decide synchronization protocol)

### Lessons

- **«Two-layer system» framing helps unblock self-referential collapse risk.** Trying to apply Product Module recursively к Ecosystem itself creates infinite complexity. Separating Level A (product) from Level B (meta-development) gives architectural cleanliness. User explicitly chose Level B / D7 distinct from Product Module recursion (response #3).
- **Capture-then-design pattern proven again.** This is третий instance: DEC-DEV-0007 (DEV_JOURNAL framework conversation → next conversation implements), DEC-DEV-0012/0013 (Phase 3 readiness conversation → implementation conversation), now DEC-DEV-0015 (D7 substrate → design session). Pattern: «extract substrate в separate file pair (SPEC + KICKOFF) when transition between sessions imminent» reduces context drift, enables fresh-session deep work.
- **«Cuttable scope discipline applies к meta-domain too».** D7 itself follows ecosystem principles — minimal first iteration, defer formalization until pattern emerges. Иначе D7 becomes ironic case: meta-doc о cleanup discipline что itself bloats. SPEC §4.1-4.6 codifies six initial principles, all expecting design session validation.
- **Naming differentiation matters.** D6 (integrator-module — user's PMO) vs D7 (meta-improvement — ecosystem's dev) — without explicit naming distinction, confusion accumulates. User explicit numbering (response #1) sets clear separation.
- **Pre-written design kickoff prompts are high-leverage artifacts.** Today's Phase 3 kickoff prompt (the very first message of this conversation) was extremely well-structured — multi-stage с context loading + validation + decision gates. Mirroring that structure для D7 design ensures fresh-session AI can ground itself без re-discovering rationale. Pattern: «pre-write self-contained kickoff prompt to file» вместо relying on user to remember structure.
- **«Distillation of one principle» (SPEC §9) — useful epistemic discipline.** When document grows long, ask «if reader takes one thing, what should it be?» Forces clarity. SPEC §9: «D7 — это «нашему развитию нужна **своя** дисциплина», не «та же дисциплина что мы даём пользователям»». Захватывает critical avoidance pattern в одной фразе.

---

## DEC-DEV-0016 — D7 design session kickoff verified

**Date:** 2026-04-28
**Trigger:** Stage 2 D7 design session start per `dev/meta-improvement/DESIGN_KICKOFF.md` Этап 3 (Decision gate). Substrate (DEC-DEV-0015) loaded; 10 design decisions accepted by user. Per KICKOFF discipline — record kickoff verified entry перед mechanism design.
**Tag:** #architecture #tooling

### Context

DESIGN_KICKOFF.md Этап 1-2 completed в opening session turn:
- Substrate loaded: SPEC.md (513 lines), DESIGN_KICKOFF.md (310 lines), DEV_JOURNAL DEC-DEV-0007/0008/0011-0015, ROADMAP.md, dev/PHASE_3_*.md, v1_1_backlog.md, pmo-map.md, CHANGELOG.md
- Existing capabilities verified (DEV_JOURNAL pattern, CLAUDE.md, Memory MCP, dev/ folder, hook manifest, B.1 frontmatter convention)
- **Memory verified stale (8-day lag — «Phase 3 ready to start» vs actual «closed»).** Live instance reference model gap #5 (Memory & continuity automation absent).

User затем explicitly requested «применить D7 на текущем моменте (только сделали реализацию phase 3)» с конкретным painpoint: bootstrap не обновляет my-first-test с Phase 2 → Phase 3. Это example user rule #2 (bootstrap install/update verification gap).

### Decisions accepted (10 items, all «ага по всем»)

**A. Naming & structure:**
- A1: continue `DEC-DEV-NNNN` sequence (no separate DEC-META)
- A2: no file prefix в `dev/meta-improvement/` (folder is namespace)

**B. Stage 2 scope discipline:**
- B1: bootstrap regression inline as step в phase-closure.md (NOT separate doc)
- B2: memory sync as step #5 в phase-closure.md (real gap discovered live)

**C. Phase 3 closure (immediate application):**
- C1: run phase-closure.md inline this session
- C2: I document exact bootstrap re-run steps; user executes; I verify post-state read-only
- C3: findings = DEC-DEV-0018 (после design entry 0017)
- C4: inline small fixes (≤10 min); queue bigger to PHASE_4_READINESS.md

**D. Cross-cutting:**
- D1: one-line pointer в CLAUDE.md «5. После завершения phase — phase-closure.md»
- D2: 2 commits — design + application

**E. Cleanup:**
- E1: archive PHASE_3_READINESS.md в `dev/_archive/phase-3/`; KEEP PHASE_3_SMOKE_TEST_PLAN.md until smoke run

### Decision

**Substrate verified coherent + clarifications clear + no profanation risks.** Proceed Этап 4 (design tasks 4.A mandatory). 4.B stretch + 4.C deferred per KICKOFF discipline.

### Outcome

Proceeded к design output (DEC-DEV-0017). This entry serves as audit trail of decisions accepted перед mechanism design — separation от design output entry intentional per KICKOFF Этап 3 «record kickoff verified».

### Lessons

- **Substrate verification gate explicit перед design pays off** — prevents «built design ON unstable substrate» risk. Same pattern as DEC-DEV-0012 (Phase 3 readiness gate перед Phase 3 implementation). Now generalized для D7 (Section 1 phase-kickoff.md template).
- **«ага по всем» pattern works для well-structured Q&A** — 10 questions с proposals + rationale = fast user agreement vs back-and-forth. Pattern reusable для future multi-decision gates: surface decisions as enumerated proposals (не «what do you think?») when substrate is clear.
- **Live discovery of substrate gap (memory stale)** — captured как instance of reference model component #5. First-class evidence для phase-closure step #5 justification — без discovered live instance might've defer'ed memory sync to Stage 3+ on principle «pattern emerge before formalize».

---

## DEC-DEV-0017 — D7 Stage 2 — checklists + conventions

**Date:** 2026-04-28
**Trigger:** D7 Stage 2 design output per DESIGN_KICKOFF.md 4.A mandatory deliverables. Continues from DEC-DEV-0016 (kickoff verified).
**Tag:** #architecture #tooling #scope-change

### Context

Stage 2 mandatory deliverables (per DESIGN_KICKOFF 4.A):
- 4.A.1 phase-closure.md (primary user need — 4 user rules + memory sync)
- 4.A.2 phase-kickoff.md (extract pattern from DEC-DEV-0012/0013 instances)
- 4.A.3 CONVENTIONS.md (resolves SPEC §6 open questions + D6 vs D7 disambiguation)
- 4.A.4 DEV_JOURNAL DEC-DEV entry (this one)

Stage 2 stretch (4.B) deferred to Stage 3+:
- pattern library starter (only 1 closure instance — DEC-DEV-0014 — premature abstraction risk per SPEC §4.2)
- bootstrap regression as separate doc (kept inline as Step 2 в phase-closure.md per B1)
- memory sync as separate doc (kept inline as Step 5 в phase-closure.md per B2)

Stage 2 deferred (4.C, per KICKOFF):
- Skill/command/hook formalization (no proven need — checklists sufficient first)
- Full pattern library enumeration
- D7 self-application via Product Module recursion (refused per SPEC §4.3)
- Premature `.product/` creation для Ecosystem 3.0

### Options considered (per SPEC §6 open questions)

**6.1 Naming convention:**
- Option A: separate `DEC-META-NNNN` sequence — adds dual-stack mental load для solo dev with ≤5 D7-specific entries/year expected
- **Option B (chosen):** continue `DEC-DEV-NNNN` — one sequence, simpler navigation
- Revisit trigger: if D7 entries dominate volume (>50% of new) — split

**6.4 Cleanup criteria:**
- Option A: aggressive archive (move all phase-N docs к _archive after closure)
- **Option B (chosen):** selective archive — `PHASE_<N>_READINESS` archives post-closure; `PHASE_<N>_SMOKE_TEST_PLAN` stays until smoke run; `v1_1_backlog`, `PHASE_<N+1>_READINESS` stay active; DEV_JOURNAL never archived
- Rationale: archive criterion = «obsolete + unneeded for current/next phase reference»

**6.6 Pattern library timing:**
- Option A: extract patterns now (Spec Drift Sweep, Readiness Gate, B.1 Frontmatter, etc.)
- **Option B (chosen):** defer Stage 3+. Phase closure has 1 instance (DEC-DEV-0014); pattern emergence requires 3+ instances per SPEC §4.2
- Trigger: после Phase 4 + 5 closures — extract first pattern set

**Inline vs separate docs (B1, B2 в kickoff Q&A):**
- Option A: separate `bootstrap-regression.md` + `memory-sync.md` docs
- **Option B (chosen):** inline as steps в phase-closure.md
- Rationale: SPEC §1.1 наблюдение про 10-15:1 add:cleanup ratio applies к D7 itself. Document count growth = anti-pattern. Promote to separate docs только если step grew complex (>15 min per phase closure).

### Decision

**Stage 2 ships:**

1. `dev/meta-improvement/checklists/phase-closure.md` — 5-step checklist:
   - Step 1: Doc health check (rule #1)
   - Step 2: Bootstrap install/update verification (rule #2; user pain origin documented)
   - Step 3: Doc consistency check (rule #3)
   - Step 4: Cleanup/archive discipline (rule #4)
   - Step 5: Memory MCP sync (discovered gap, marked refine-after-Phase-4)

2. `dev/meta-improvement/checklists/phase-kickoff.md` — 5-section template:
   - Architectural readiness (DEC-DEV-0012 pattern, ROI 3-5x)
   - Ambiguity sweep (DEC-DEV-0013 pattern)
   - Spec drift sweep (DEC-DEV-0013 A.1-A.4 pattern)
   - Scope discipline (cuttable scope, v1.1+ deferrals)
   - Plan refinement

3. `dev/meta-improvement/CONVENTIONS.md` — 10 sections resolving SPEC §6 open questions; includes D6 vs D7 disambiguation table (terminological collision risk).

**One new line к CLAUDE.md** (per D1 anti-bloat compromise):
- After «4. Если starting Phase 3 — пройди [dev/PHASE_3_READINESS.md]» insert «5. После завершения phase — пройди [dev/meta-improvement/checklists/phase-closure.md]»
- Existing item 5 («Перед commit-ом») renumber → 6

### Outcome

Stage 2 mandatory complete. Stage 3+ triggers identified (post-Phase-4-closure: pattern library extraction, memory-sync skill if manual proves heavy, bootstrap regression script if manual proves error-prone).

Phase 3 closure run = next step (DEC-DEV-0018) — first concrete application of D7. Will populate findings + checklist refinement.

### Lessons

- **«Cuttable scope discipline» applies к meta-domain too.** Stage 2 ships 3 files vs the 7 tempting (бы добавил bootstrap-regression.md + memory-sync.md + patterns/<5>.md если бы scope не был резан). Living evidence для SPEC §4.1.
- **Inline-step approach для cross-cutting concerns** (bootstrap regression, memory sync as steps в phase-closure rather than separate docs) reduces document count — само по себе anti-pattern в 10-15:1 add:cleanup ratio context. Promote to separate docs только if Phase 4-5 closures show step grew complex.
- **Kickoff prompt + Q&A structure proven for fast multi-decision alignment.** 10 questions с proposals + rationale → user «ага по всем». Pattern: surface decisions as enumerated proposals (не «what do you think?») when substrate is clear.
- **Live application как ROI test для D7.** Designing checklists + immediately applying them на Phase 3 closure = checks utility перед formalization. Если closure run finds 0 issues — design over-engineered. If finds 5+ — pattern proven. Bootstrap regression already known case (user explicit) — minimum 1 finding guaranteed.
- **D6 vs D7 terminological disambiguation** — explicit table в CONVENTIONS.md §1.3 catches collision risk. pmo-map.md row uses «Meta: Ecosystem Governance» для D6 sense; D7 module also uses «meta» language (meta-improvement, meta-domain). Without explicit disambiguation reader confusion compounds.

---

## DEC-DEV-0018 — Phase 3 closure run + first D7 application

**Date:** 2026-04-28
**Trigger:** Apply `dev/meta-improvement/checklists/phase-closure.md` (Stage 2 D7 deliverable, DEC-DEV-0017) к Phase 3 immediately после design — first concrete D7 application; living ROI test of D7 utility per DESIGN_KICKOFF.md scope discipline.
**Tag:** #pilot-finding #refactor #tooling

### Context

Per user's explicit request «применить D7 на текущем моменте». First instance of phase-closure.md run. Concurrent purposes:
1. **Properly close Phase 3** (was open ended after DEC-DEV-0014; smoke test queued user-side но closure hygiene никто не делал)
2. **Validate D7 design** (≤60 min budget; if 0 findings → over-engineered; if 5+ → pattern proven; baseline expectation: bootstrap regression already known + memory stale already known = 2 guaranteed findings)

### Findings per checklist step

**Pre-flight ✓:** Phase 3 commits merged, CHANGELOG updated, DEC-DEV-0014 closure entry exists, git status clean.

**Step 1 — Doc health check (5 finds, all fixed inline):**
1. `README.md` line 5 — «Статус: v1.0 — готова к pilot имплементации» → updated к «v1.1.0 — Phase 0-3 shipped; Phase 3 smoke test pending; Phase 4 next»
2. `CLAUDE.md` § «Где мы сейчас» snapshot — listed Phase 3 как «⏳ Next» (stale; Phase 3 closed) → refreshed
3. `CLAUDE.md` item 4 «Если starting Phase 3 — пройди dev/PHASE_3_READINESS.md» (stale + would dangle after archive) → generic «Перед стартом phase — phase-kickoff.md (D7) + dev/PHASE_<N>_READINESS.md»
4. `CLAUDE.md` tree dev/ subdir showed только PHASE_3_READINESS.md (incomplete + Phase-3-specific) → generic listing с meta-improvement/, PHASE_<N>_READINESS.md, _archive/
5. `dev/PHASE_4_READINESS.md` status banner ✓ (already correct, says «Phase 3 implementation complete»)

**Step 2 — Bootstrap regression (1 finding queued, user execution required):**

User's primary painpoint origin: bootstrap не обновляет `my-first-test/` с Phase 2 → Phase 3. Rule #2 cannot be self-executed from this session (interactive Claude Code needed in pilot project cwd).

Inventory Phase 3 additions:
- 5 commands: `plan`, `feature`, `cascade`, `bg-review`, `bg-rename`
- 13 skills: planning-session, mvp-scoping, roadmap-planning, release-planning, feature-session, scenario-authoring, business-rule-extraction, lifecycle-derivation, invariant-discovery, vc-derivation, rpm-derivation, bg-extraction, cascade-protocol
- 4 hooks: bg-extractor, cascade-check, br-change-trigger, ic-change-trigger
- 1 hook extension: artifact-validate.js (D2 overrides)

User-side execution + post-state verification documented в Closing section ниже.

**Step 3 — Doc consistency (1 find fixed + others ✓):**
1. **Skill count discrepancy:** ROADMAP.md line 18 + CHANGELOG.md line 11 stated «14 new skills» — actual filesystem = 13. Math check: «23 files = 5 cmds + 13 skills + 4 hooks + 1 ext» — sum ✓; «14 skills» variant gives 24 ≠ 23 (arithmetic disagrees with own claim). Both fixed inline.
2. Hook names ✓ — `validation.md`, `processes.md`, `SPEC.md` всё use new names (`br-change-trigger`, `ic-change-trigger`, `cascade-check`, `bg-extractor`); old names (`br-change-review-trigger`, `ic-change-da-trigger`) только в historical refactor blocks или archived `dev/PHASE_3_READINESS.md` per DEC-DEV-0013 sweep.
3. CHANGELOG additions resolve ✓ (spot check — `lifecycle-derivation.md`, hook manifest entries match files).
4. B.1 convention spot check on `lifecycle-derivation.md` ✓ (description present + 9 frontmatter pattern matches confirming inline templates per CLAUDE.md «Skill конвенции»).

**Step 4 — Cleanup (1 archive + ✓ rest):**
1. `dev/PHASE_3_READINESS.md` → `dev/_archive/phase-3/PHASE_3_READINESS.md` (per E1 decision via `git mv`)
2. `dev/PHASE_3_SMOKE_TEST_PLAN.md` kept active (smoke run pending — stays until run, then archive next closure)
3. No orphan «TODO Phase 3» markers in shipped artifacts ✓
4. `dev/` count post-archive: SPEC dirs + meta-improvement/ + 3 active phase docs + v1_1_backlog + _archive — reasonable per CONVENTIONS §5

**Step 5 — Memory MCP sync (3 files updated):**
1. `project_ecosystem_status.md` — was 8 days stale («Phase 3 ready to start»); now reflects «Phase 3 closed + D7 Stage 2 active + closure run»
2. `project_ecosystem_architecture.md` — added D7 Meta-Improvement Module + Phase 3 architectural patterns (A1 auto-approve, adaptive-depth DA via stderr orchestration, per-FM session state, B.1 frontmatter convention)
3. `MEMORY.md` index — descriptions refreshed for status + architecture + methodology entries

### Time

~45 min total (within ≤60 min budget):
- Step 1: ~15 min (5 finds, multiple files)
- Step 2: ~5 min (documentation only; user runs)
- Step 3: ~10 min (count verification + grep sweeps + B.1 spot check)
- Step 4: ~3 min (single archive operation)
- Step 5: ~10 min (3 memory files rewrite)
- Synthesis + this entry: ~5 min

### Refinements applied к phase-closure.md (per CONVENTIONS §10)

1. **Step 1 substep added:** Root doc snapshots + tree diagrams refresh (was implicit; Phase 3 closure caught 2 stale tree/snapshot blocks в CLAUDE.md). Pattern: snapshot phrases nominally honest disclaimers, but в практике require explicit closure-step refresh.

2. **Step 3 substep added:** Count verification with explicit `ls | wc -l` ↔ ROADMAP/CHANGELOG arithmetic check. Phase 3 closure caught «14 skills» typo в обоих docs that contradicted own arithmetic.

3. **Refinement tracker row** populated с Phase 3 actual: 9 findings, ~45 min, 2 refinements applied.

### Outcome

**Phase 3 closure complete на developer side.** Bootstrap regression (Step 2) pending user execution. Phase 4 readiness gate один step closer (per `dev/PHASE_4_READINESS.md` Section A — closure findings done; smoke test still queued).

**D7 utility validated:** 9 findings vs 0-finding-over-engineered-baseline. Bootstrap regression + memory stale (2 known) + 7 emergent (5 doc rot + 1 count typo + 1 archive). All would've compounded across Phase 4-5 без closure ritual. ROI clearly positive.

### Lessons

#### D7 mechanism validation

1. **Phase closure ritual catches real rot.** 9 issues в один Phase closure — not because Phase 3 was sloppy, but because hygiene activities are systematically deferred without explicit checklist. User's 10-15:1 add:cleanup ratio observation correct и actionable.

2. **«Inline-step approach for cross-cutting concerns» (DEC-DEV-0017 lesson) validated.** Bootstrap regression as Step 2 (vs separate doc) + Memory sync as Step 5 — both natural fit во flow без navigation overhead. Promote-к-separate-doc trigger NOT met.

3. **«Cuttable scope discipline» в meta-domain validated.** Stage 2 ships 3 files; closure runs в ≤60 min. Если бы я добавил pattern library starter + bootstrap-regression standalone + memory-sync skill — closure run был бы 2-3 hours, отстой ROI.

#### Concrete pattern observations

4. **Skill count typos propagate across docs.** Single source of truth = filesystem. ROADMAP/CHANGELOG estimates need verification. Refinement applied: Step 3 sub-step 5 (count verification).

5. **CLAUDE.md «Где мы сейчас» snapshot is fragile but worth keeping.** Two options weighed: (a) refresh per closure (current); (b) remove snapshot, rely solely on ROADMAP. Option (a) chosen для AI loading-context utility; closure ritual handles rot. Snapshots deserved explicit Step 1 substep.

6. **Tree diagrams в long-living root docs drift fast.** Phase-N specific entries в CLAUDE.md tree showed only PHASE_3_READINESS.md. Replaced с generic listing. Lesson: avoid Phase-N specific items в long-living root docs; use generic patterns / placeholders.

7. **Memory MCP stale was substantial (8 days).** Confirms reference model component #5 importance. Manual update ~10 min для 3 files; not heavy enough для escalation к skill yet (per CONVENTIONS §6 trigger). Re-evaluate after Phase 4 closure.

8. **Step 2 architectural constraint confirmed:** bootstrap regression cannot be self-executed from current session (no spawn-Claude-in-other-cwd capability). Documentation + read-only post-state verification = working pattern для Stage 2.

#### Process-level

9. **«Living application as ROI test» pattern proves out.** Built D7 → immediately applied → discovered refinements during application → updated artifacts in same session. Без application, refinements would've waited until Phase 4 closure (1+ phase delay). Pattern: «Stage 2 ship + immediate Stage 2 application» preserves refinement loop tight.

10. **Closure run finds clarify D7 scope для Stage 3+.** 0 findings would've meant over-design; 5+ findings means pattern real (got 9). Stage 3+ formalization triggers (skill / command / hook) need 3+ closure runs showing same friction class. Phase 4 + 5 closures will reveal.

### Open для Phase 4 readiness gate

- **Bootstrap regression result** — populates retroactive update к этому entry (or separate DEC-DEV-NNNN if substantive findings)
- **Memory MCP automation** — re-evaluate trigger после Phase 4 closure
- **Phase-closure refinements adoption** — verify Step 1.4 + Step 3.5 actually run в Phase 4 closure (validates refinement protocol per CONVENTIONS §10)

### Next

**User executes (interactive Claude Code session in pilot project):**

```
cd C:/Users/pw201/WebstormProjects/my-first-test
claude
> /ecosystem:bootstrap
```

**Then back-verify here (read-only checks из этой сессии):**

```bash
# expect 12 commands (7 Phase 2 + 5 Phase 3)
ls C:/Users/pw201/WebstormProjects/my-first-test/.claude/commands/product/

# expect 25 skills (12 Phase 2 + 13 Phase 3)
ls C:/Users/pw201/WebstormProjects/my-first-test/.claude/skills/product/

# expect 6 hook files
ls C:/Users/pw201/WebstormProjects/my-first-test/.claude/hooks/product/

# expect ≥6 hook command entries
grep -c '"command"' C:/Users/pw201/WebstormProjects/my-first-test/.claude/settings.json

# verify Phase 2 .product/ artifacts intact
ls C:/Users/pw201/WebstormProjects/my-first-test/.product/
```

If bootstrap succeeds + all checks pass: Phase 3 closure 100% complete; Phase 4 readiness gate unblocked (modulo smoke test). If bootstrap regression: file specific issue, fix in `chore(bootstrap): Phase 3 regression` commit.

---

## DEC-DEV-0019 — Bootstrap regression outcome + D7 v1 turnkey

**Date:** 2026-04-28
**Trigger:** Phase 3 closure Step 2 (bootstrap regression) execution by user в pilot Claude session yielded 4 substantive findings; user requested «D7 turnkey + fresh-session invocation» как finalization. This entry consolidates execution outcome + D7 v1 closeout work.
**Tag:** #pilot-finding #architecture #ux

### Context

DEC-DEV-0018 closing said «Bootstrap regression result populates retroactive update». Pilot Claude executed `/ecosystem:bootstrap` в my-first-test:

1. Bootstrap detected ecosystem signature → asked user (a) abort / (b) merge / (c) backup+fresh per DEC-DEV-0004 design
2. User chose (b) merge — successful clone к temp + `cp -rn` into .claude/
3. **Manual interventions required** by pilot Claude после merge:
   - Manifest.yaml preserved by cp -rn → new hooks installed but unregistered → pilot Claude manually copied upstream manifest
   - Settings.json hooks list только had 2 entries → pilot Claude manually added 4 new hook command entries
   - Dev-only files contaminated .claude/ (root CLAUDE.md, DEV_JOURNAL.md, dev/ directory) → pilot Claude flagged + cleaned после user confirm

### Bootstrap test outcome

**Technical pass** — Phase 3 additions present в pilot project after merge + manual fixes:
- 12 commands (7 Phase 2 + 5 Phase 3) ✓
- 25 skills (12 Phase 2 + 13 Phase 3) ✓
- 6 hook files + 6 hook command entries в settings.json ✓
- .product/ Phase 2 artifacts intact ✓
- Cleanup of contamination ✓

**Functional fail без manual interventions** — stock bootstrap (no manual hand-fixes) would have left:
- Hooks installed but unregistered → silent failures
- Dev contamination в `.claude/CLAUDE.md` → future sessions misled («I'm working on the ecosystem» vs «I'm working on user's product»)

### 4 architectural findings (substantive)

**Finding A — Dev-only files copy contamination (CRITICAL):**

`.claude-ecosystem-tmp` clones full upstream repo, then `cp -rn .claude-ecosystem-tmp/. .claude/` brings root files (CLAUDE.md, DEV_JOURNAL.md) and dev/ subfolder. Эти ecosystem-developer-only — should never enter user's `.claude/`.

Worst: `.claude/CLAUDE.md` would be read by future Claude Code sessions and mislead them.

**Root cause:** bootstrap.md spec assumes upstream repo == packaged release. Real upstream = full developer repo with dev artifacts.

**Finding B — `cp -rn` additive only (CRITICAL, user's main concern):**

`cp -rn` (no-clobber) **only adds new files**, **never updates existing**. Implication:
- Bug fixes к commands/skills/hooks shipped в upstream НЕ propagate to user's `.claude/`
- SPEC updates remain stale для existing pilots
- Refactored hooks (e.g., DEC-DEV-0013 A.1 devils-advocate.md adaptive-depth refactor) НЕ reach existing projects

**Root cause:** «merge» semantics designed для «extend ecosystem» не «sync ecosystem to latest». DEC-DEV-0002 idempotent merge promise covers add but not update.

**Finding C — manifest.yaml preservation breaks hook auto-registration (CRITICAL):**

Bootstrap Step 6b auto-registers hooks из `manifest.yaml`. Но `cp -rn` preserves user's existing manifest.yaml — которое omits new hooks. Result: new hooks installed but not registered → silent fails.

**Special case of Finding B** but distinct severity потому что: hooks runtime-required, manifest single-source-of-truth для registration, automatic-but-incomplete merge gives false confidence «bootstrap done».

**Finding D — Re-install default = (a) abort, не (b) merge (UX):**

Per DEC-DEV-0004 signature detection, re-install scenarios force user choice (a)/(b)/(c). Default = (a). Для post-Phase-N update path (the common case для any active pilot project), (b) is correct — but user must know to pick it.

«Bootstrap не обновляет» perception (user's words) = «default option doesn't update», technically «can update только after manual choice».

### Decision: Path Y for bootstrap update mechanism

**3 paths considered:**
- **Path X** — refactor bootstrap.md zone-based merge (add zone filter + overwrite semantics для ecosystem zone + preserve user zone). One command, multi-mode.
- **Path Y** — split: `/ecosystem:bootstrap` greenfield-only (per DEC-DEV-0001 envision); new `/ecosystem:update` для existing projects с proper sync (overwrite ecosystem zone, preserve user zone, sync manifest, update settings.json hooks, never copy dev zone). Two commands, single-mode each.
- **Path Z** — defer V1.1, document workaround в bootstrap.md «for re-install, manual: rm -rf .claude/{commands,skills,...,docs}; re-bootstrap; restore product.yaml + .env»

**Chosen: Path Y** — cleaner separation match natural workflow («install once» vs «update each phase»). Bootstrap не несёт multi-mode complexity. Each command single-purpose.

**Status:** decision deferred к Phase 4 architectural readiness gate (per `dev/PHASE_4_READINESS.md` Section C.6 added в этом commit). Implementation = Phase 4 deliverable. NOT shipped в этом commit.

### D7 v1 turnkey deliverables (this commit)

**Fresh-session invocation pattern** (per user's idea — bias-resistance via independent observer):

Both `phase-closure.md` and `phase-kickoff.md` extended с «Invocation» section:
- **Inline mode** — current session runs (fast; small phase OK)
- **Fresh-session mode** — copy-paste prompt для new Claude Code session, loads minimal substrate (CHANGELOG, ROADMAP, last 5 DEV_JOURNAL entries, CONVENTIONS), executes checklist independently. **Anti-bias guard explicit** в prompt («не smooth over findings to look good для AI which designed Phase N»).

**Rationale:** SPEC §6.8 «failure mode handling» implicitly assumed inline execution. User's observation that AI which just designed Phase N may rationalize away closure findings = sharp methodological refinement. Fresh-session = independent observer pattern (substitute для absent code reviewer in solo dev context).

**No new mechanism types added** — still markdown checklists, just с invocation section. Per CONVENTIONS §3 mechanism hierarchy preserved (checklist remains default).

### Outcome

**Phase 3 closure 100% complete:**
- DEC-DEV-0018 — design-time closure findings (9 issues fixed inline + refinements applied)
- DEC-DEV-0019 — execution outcome (4 architectural bootstrap findings + Phase 4 path)
- Total: 13 findings surfaced by D7 v1 closure ritual on first phase

**D7 v1 ships как turnkey (per user request):**
- 2 checklists (phase-closure, phase-kickoff) с dual-mode invocation
- 1 conventions doc (10 sections + Stage 3+ open questions)
- D7 conventions established (DEC-DEV continued sequence; folder=namespace; checklist-first hierarchy; selective archive; manual sync; pattern library deferred)
- 5 DEV_JOURNAL entries (DEC-DEV-0015 substrate + 0016 kickoff verified + 0017 design output + 0018 closure findings + 0019 execution + turnkey)
- One-line CLAUDE.md pointer для discoverability

**Phase 4 readiness gate updated:**
- Section C.6 added — bootstrap update mechanism architecture с Path Y recommendation. Decision required перед Phase 4 implementation kickoff (else Phase 4 deliverables suffer same update gap).

### Lessons

#### Bootstrap-specific architectural

1. **«Idempotent merge» promise (DEC-DEV-0002) covered hook registration, не file content updates.** Original promise was «hooks fire after install»; reality requires «ecosystem zone files reach latest after each phase update». Two distinct concerns; DEC-DEV-0002 covered только first.

2. **Upstream repo ≠ packaged release.** Bootstrap design treated full clone как ship-ready; reality = clone includes developer artifacts (dev/, DEV_JOURNAL.md, root CLAUDE.md). Need explicit zone categorization (ecosystem / user / never-copy) для proper update semantics.

3. **Manifest preservation = silent failure mode.** Hooks installed без registration = worst kind of silence (no error, no fire). Pattern: any «auto-derived from manifest» mechanism needs «manifest update» step in update path.

4. **«Update vs install» concerns split cleanly architecturally.** Bootstrap (greenfield) и update (existing project) have different semantics: install = «set up everything»; update = «sync to latest, preserve user state». Path Y splitting follows this architectural cleavage.

#### D7 mechanism-specific

5. **Fresh-session invocation = methodological refinement worth shipping.** User's observation about self-rationalization bias was sharp. Implementation cost = trivial (markdown section). Value = high (catches what inline mode would smooth over). Pattern: when reviewer ≠ implementer, bias drops; для solo dev, fresh session = available «reviewer» substitute.

6. **«Living application as ROI test» pattern doubled value here.** Phase 3 closure → 9 inline finds (DEC-DEV-0018). Phase 3 closure Step 2 execution → 4 architectural finds (DEC-DEV-0019). Both rounds от единственной Phase 3 «pilot» of D7. Без D7, эти 13 findings would've compounded across Phase 4-5.

7. **Closure ritual surfaces architectural debt that work-mode rationalizes.** During Phase 3 implementation, bootstrap update path was «не нужно сейчас, Phase 3 focus». Closure ritual forced revisit; revealed это actually critical для Phase 4-7 deployment to existing pilots. Pattern: hygiene rituals выявляют debt that work-mode discounts.

#### Process-level

8. **Pilot Claude manual interventions = signal что mechanism под-design'нен.** When external AI session needs 4 manual fixes для completing bootstrap (manifest copy, settings.json edit, contamination cleanup, dev-only file removal) — signal mechanism doesn't fit real use case. «Asking user for permission to fix» = workaround, не proper design.

9. **Severity classification helped scope Phase 4.** Findings A/B/C all CRITICAL (block silent failures); D = UX gap. Path Y решает все 4 architecturally; не required immediate hotfix потому что Phase 3 deployment к my-first-test работает (after manual interventions). Phase 4 architectural readiness gate appropriate location.

### Refinements applied this commit

- `phase-closure.md` — Invocation section added (top, after Pre-flight)
- `phase-kickoff.md` — Invocation section added (top, after Pre-flight)
- `dev/PHASE_4_READINESS.md` — Section C.6 «Bootstrap update mechanism architecture» added с Path Y recommendation

### Next

**Phase 3 fully closed.** Next D7 mechanism use = Phase 4 kickoff (когда user decides to start Phase 4 work). Phase 4 readiness gate must address C.6 bootstrap update path **перед Phase 4 implementation kickoff** — else Phase 4 deliverables (handoff.md, NFR commands, etc.) would suffer same update gap к existing pilots.

**Stage 3+ D7 work** triggered после Phase 4 + 5 closures:
- Pattern library extraction (3+ instances для emergence per CONVENTIONS §7)
- Memory sync skill if manual proves heavy
- Bootstrap regression script if `/ecosystem:update` doesn't fully resolve

---

## DEC-DEV-0020 — `/ecosystem:update` standalone command (closes DEC-DEV-0019 bootstrap findings)

**Date:** 2026-04-28
**Trigger:** DEC-DEV-0019 4 architectural bootstrap findings + Path Y recommendation. User chose «закроем эту задачу сейчас, не подмешивая в Phase 4». Standalone implementation track per Phase 4 readiness item C.6 resolution upfront.
**Tag:** #architecture #tooling #ux

### Context

DEC-DEV-0019 surfaced 4 critical findings про `/ecosystem:bootstrap` re-install path. Path Y was recommended (split: bootstrap greenfield-only + new `/ecosystem:update` для existing projects). User opted для immediate implementation вместо deferring к Phase 4 architectural readiness.

Mini-readiness gate (3 architectural decisions, all accepted «ага по всем»):

**Q1: Allowlist vs blocklist?** Allowlist (только commands/, skills/, agents/, hooks/, docs/, templates/, output-styles/ subdirs + README/CHANGELOG/ROADMAP/BOOTSTRAP/install.sh/install.ps1/.env.template/gitignore.template root files). Anything else — never enters `.claude/`. Safer; explicit enumeration; защищает от future contamination if dev/ растёт.

**Q2: Delete obsolete files в ecosystem zone?** Yes — rsync-style sync для allowlisted subdirs (delete files in `.claude/<subdir>/` not present в upstream + copy fresh). Risk mitigation: pre-update backup `.claude/` → `.claude-backup-<timestamp>/` (default; skip только с `--no-backup` flag).

**Q3: Manifest + settings.json hooks sync?** Always overwrite manifest.yaml from upstream (it's в hooks/ subdir → in ecosystem zone). Re-derive hooks section в settings.json from new manifest. Preserve permissions section + other top-level fields verbatim. Idempotent.

### Options considered (Path X / Y / Z из DEC-DEV-0019)

- **Path X — refactor bootstrap.md zone-based merge** (one command, multi-mode). Pros: single command. Cons: bootstrap карьеры multi-mode complexity; greenfield + update flows mix; harder mental model.
- **Path Y (chosen) — split: bootstrap greenfield-only + new /ecosystem:update.** Pros: cleaner separation match natural workflow («install once» vs «update each phase»); each command single-purpose; bootstrap stays simple. Cons: 2 commands instead of 1.
- **Path Z — defer V1.1, document workaround.** Pros: zero new code now. Cons: tech debt compounds across Phase 4-7 для existing pilots; user pain persists.

**Path Y rationale:** match natural conceptual cleavage. Bootstrap = «set everything up» (greenfield assumption); update = «sync to latest, preserve user state» (existing assumption). Mixing them в bootstrap caused all 4 DEC-DEV-0019 findings.

### Decision

**Implemented:**

1. `commands/ecosystem/update.md` (new command, ~280 lines):
   - 8 execution steps: signature check, backup, clone temp, compute changeset (с `--dry-run`), apply, re-derive hooks, cleanup+verify, summary
   - Allowlist explicit (subdirs + root files), never-copy zone explicit (CLAUDE.md root, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md), user zone explicit (settings.local.json, product.yaml, integrator/, .product/)
   - Flags: `--offline`, `--dry-run` (recommended first run), `--force`, `--no-backup`
   - Rollback workflow documented
   - Comparison table bootstrap vs update

2. `commands/ecosystem/bootstrap.md` minor edit (re-install scenario):
   - Added recommendation block to use `/ecosystem:update` instead of legacy (a)/(b)/(c) options
   - Marked option (b) Merge as «LEGACY — use /ecosystem:update instead»
   - Preserved (a)/(b)/(c) availability for edge cases (corruption recovery)

3. `INSTALL-HUMAN.md` extended (Блок C — обновление existing project):
   - C.1 update global cache (re-run installer)
   - C.2 invocation в project (--dry-run first, then apply)
   - C.3 verify + rollback procedure
   - C.4 bootstrap vs update distinction

4. `README.md` extended (Quick Start «Фаза 3 — обновление»):
   - Brief invocation example + link к INSTALL-HUMAN Блок C
   - Distinction note: bootstrap re-install (legacy) vs /ecosystem:update (recommended)

### Outcome

**4 DEC-DEV-0019 findings architecturally resolved:**
- Finding A (dev contamination) → solved by allowlist-only copy + explicit never-copy zone
- Finding B (cp -rn additive only — user's main concern) → solved by rsync-style sync (delete + copy fresh для each subdir; overwrite for root files)
- Finding C (manifest preservation breaks hook registration) → solved by manifest.yaml в ecosystem zone (overwritten) + Step 6 hooks re-derivation
- Finding D (re-install UX gap) → solved by dedicated `/ecosystem:update` command with «I want to update» semantic; bootstrap edit recommends update for re-install

**Phase 4 readiness gate item C.6 RESOLVED upfront** — Phase 4 implementation kickoff не блокируется bootstrap update path; future Phase 4 deliverables (handoff.md, NFR commands, etc.) reach existing pilots via `/ecosystem:update`.

**Discoverability path:** new command file added, but globally users получат command в autocomplete только после:
- (a) Re-running install.sh/.ps1 (which copies `commands/ecosystem/*.md` к `~/.claude/commands/ecosystem/`), OR
- (b) Running this very `/ecosystem:update` on existing project (which syncs `commands/ecosystem/update.md` к `.claude/commands/ecosystem/`)

For my-first-test test (Step 5 below) — manual copy required since update.md doesn't exist там yet (chicken-and-egg).

### Test execution (Step 5 — user runs interactive)

**Critical caveat:** `/ecosystem:update` cannot be invoked в my-first-test/ until update.md exists в its `.claude/commands/ecosystem/`. Manual copy required для first time.

**User-side test workflow:**

```bash
# Manual copy (one-time bootstrap of update.md itself)
cp commands/ecosystem/update.md C:/Users/pw201/WebstormProjects/my-first-test/.claude/commands/ecosystem/update.md

# In my-first-test/ interactively
cd C:/Users/pw201/WebstormProjects/my-first-test
claude
> /ecosystem:update --dry-run
```

Expected dry-run output: changeset preview showing what would sync (likely no-op since pilot Claude already manually fixed everything в DEC-DEV-0019 Step 2 work).

If dry-run looks correct:
```
> /ecosystem:update
```

After apply:
- Verify `.claude/commands/ecosystem/update.md` present (self-update validation)
- Verify backup directory `.claude-backup-<timestamp>/` created
- Verify `.product/` intact (no changes)
- Run `/ecosystem:verify` to confirm health

**Read-only post-state verification (this session):**

```bash
ls C:/Users/pw201/WebstormProjects/my-first-test/.claude/commands/ecosystem/
ls -d C:/Users/pw201/WebstormProjects/my-first-test/.claude-backup-*/
ls C:/Users/pw201/WebstormProjects/my-first-test/.product/
```

If test reveals issues — fix in follow-up commit OR rollback и address per failure mode.

### Lessons

#### Architectural

1. **«Concerns split cleanly architecturally» test was right indicator.** Path Y separation matches natural workflow — sign that this is correct architectural cleavage, не just convenience. Pattern: when 4 distinct findings all share root cause «one mechanism doing two different things», split mechanism > patch mechanism.

2. **Allowlist > blocklist для file copy/sync operations.** Explicit enumeration prevents future contamination if dev folder grows (e.g., adding `dev/proposals/`, `dev/_archive/phase-4/`). Blocklist requires updating with every new dev artifact type.

3. **rsync-style sync с backup default = right safety/utility tradeoff.** Without backup, user fears running update; without sync (additive only), update doesn't update. Backup makes rsync semantics palatable.

4. **«Replace, not merge» для ecosystem-managed sections.** Hooks section в settings.json — manifest is single source of truth post-update; merging old + new = ambiguous semantics. Replace = clear ownership. Merge would re-introduce DEC-DEV-0019 Finding C (preserved old manifest leads к stale hooks).

#### Process

5. **Mini-readiness gate (3 questions) before implementation paid off.** Without explicit Q1-Q3 decisions, я бы wandered between allowlist/blocklist mid-implementation, или skipped delete semantics. Pattern: even non-phase implementation work benefits от phase-kickoff.md Section 1 architectural readiness в miniature.

6. **«Closing the task now, not mixing into Phase 4» preserves Phase 4 cognitive scope.** User's instinct to handle bootstrap fix immediately (vs deferring к Phase 4 architectural readiness) keeps Phase 4 focus pure (handoff/NFR/validation). Pattern: when finding crosses phase boundary, sometimes resolving immediately в standalone track simpler than phase-readiness-coordination.

7. **Self-application of D7 helped surface this scope.** DEC-DEV-0018 phase-closure ritual found bootstrap regression need; DEC-DEV-0019 execution surfaced 4 findings; this commit resolves them. Без D7 closure ritual, bootstrap update gap would've been «obvious in hindsight» после Phase 4 deployment к existing pilots failed silently.

8. **Self-update validation = nice debugging affordance.** Step 7 verify includes check that `commands/ecosystem/update.md` present after sync — incidentally validates that update successfully synced itself. If absent post-update: indicates allowlist filter wrong (excluded ecosystem/ subfolder of commands/) OR upstream missing file. Useful diagnostic.

### Refinements applied to existing artifacts

- `commands/ecosystem/bootstrap.md` — re-install section: recommend `/ecosystem:update`, mark legacy (b) Merge as DEPRECATED
- `INSTALL-HUMAN.md` — added Блок C (3 sections: update global cache, invocation в project, verify+rollback)
- `README.md` — added «Фаза 3 — обновление» section в Quick Start
- `dev/PHASE_4_READINESS.md` Section C.6 — already references this work; status moves «pending decision» → «resolved DEC-DEV-0020»

### Next

**Test execution by user (interactive Claude Code в my-first-test):**
1. Manual copy update.md к pilot's .claude/commands/ecosystem/
2. Run `/ecosystem:update --dry-run`
3. If looks correct → apply
4. Report back results
5. Я verify post-state read-only

**После successful test:** Phase 3 closure cycle truly complete; Phase 4 implementation kickoff has clean ground. Phase 4 deliverables (handoff/NFR/validation) reach existing pilots via `/ecosystem:update`.

**После Phase 4 ship:** re-run `/ecosystem:update` на my-first-test → first true production usage; populate retroactive update к этому entry с findings (если any).

---

## DEC-DEV-0021 — D7 v1.0 final state (Stages 3-6 shipped)

**Date:** 2026-04-28
**Trigger:** User request «остальное давай сделаем сейчас, т.к. мне уже сейчас на ранних этапах нужны механизмы решения обозначенных проблем». Bundles Stages 3-6 of D7 roadmap (per prev conversation analysis) into single session — pattern library, memory sync skill, verification script, phase-closure reminder hook, CLAUDE.md restructure, SPEC v1.0 declaration.
**Tag:** #architecture #tooling #scope-change

### Context

Per planned D7 roadmap (response в prev turn):
- Stage 3 — pattern library extraction (5 patterns) — was scheduled после Phase 5 closure (3+ instances per SPEC §4.2)
- Stage 4 — mechanism promotions (memory sync skill, bootstrap regression script, hook integration) — was conditional on triggers across Phase 5-7
- Stage 5 — CLAUDE.md restructuring — when D7 references multiply
- Stage 6 — SPEC v1.0 declaration — final state

User overrode «pattern emerge before formalize» (SPEC §4.2) timing с rationale «нужны механизмы на ранних этапах». Adapted approach: ship patterns с **provisional** marker + explicit refinement triggers; formalize promotions с current evidence basis vs waiting Phase 5+ instance accumulation.

User specifically prioritized concerns:
- **Bootstrap regression script:** «убедиться что update работает корректно» → verification script для post-/ecosystem:update outcome (not standalone bootstrap regression test суите broadly)
- **Hook integration:** «убедиться что хук точно будет триггериться и работать» → implement + test phase-closure reminder hook in this session
- **Self-stability check:** explicitly «не нужен» → skipped
- **Категория C (speculative):** explicitly «не нужна» → skipped

### Stage 3 — Pattern library (5 patterns в `dev/meta-improvement/patterns/`)

**Decision:** ship 5 patterns с **provisional** status; refinement triggers explicit (3+ instances → validated).

**Patterns shipped:**
- `spec-drift-sweep.md` (provisional, 2 instances: DEC-DEV-0013 A.1-A.4 + DEC-DEV-0018)
- `readiness-gate.md` (provisional, 2 instances: DEC-DEV-0012 + DEC-DEV-0020)
- `b1-frontmatter-convention.md` (validated — codified в CLAUDE.md «Skill конвенции»)
- `cuttable-scope-discipline.md` (provisional, 3 instances: DEC-DEV-0012 + DEC-DEV-0017 + DEC-DEV-0020)
- `smoke-test-plan.md` (provisional, 1 instance: Phase 3.I plan)

**README.md index** в patterns/ с usage guidance + promotion criteria (provisional → validated transition).

**Per-pattern doc structure:** name, when applicable, steps, outputs, examples (DEC-DEV refs), anti-patterns (over-applied / under-applied / misapplied), refinement triggers, related.

**Trade-off accepted:** ranked early extraction (with provisional markers) over deferred extraction (per SPEC §4.2 strict). Risk: pattern shape revises through Phase 4-5 instances. Mitigation: provisional marker + explicit refinement triggers per pattern.

### Stage 4a — Memory sync skill (`dev/meta-improvement/skills/memory-sync.md`)

**Decision:** formalize phase-closure Step 5 procedure as standalone skill.

**Format:** D7 skill (in `dev/meta-improvement/skills/`, not Product Module skills/). Frontmatter с `description:` per CLAUDE.md skill convention, but D7 location preserves namespace separation per CONVENTIONS §2.

**Content:**
- Inputs (memory MCP files + authoritative sources)
- 5 steps (inventory → verify → update → index update → post-sync verify)
- Anti-patterns (over-sync / under-sync / misapplication)
- Time budget ~10 min (matches DEC-DEV-0018 measured)
- Promotion triggers Stage 5+ (auto-detection, bidirectional sync, DEV_JOURNAL integration)
- Fresh-session invocation prompt embedded

**Trigger logic для skill invocation:** primary = phase-closure Step 5; secondary = standalone (long break return, AI cites stale data).

### Stage 4b — Bootstrap update verification script (`dev/meta-improvement/scripts/verify-update.{sh,ps1}`)

**Decision:** ship bash + PowerShell версии; user runs externally к Claude Code session (not skill invocation).

**Scope (per user concern «убедиться что update работает корректно»):** verifies post-/ecosystem:update outcome, not broader bootstrap regression suite.

**9 checks performed:**
1. .claude/ directory present
2. Ecosystem signature (3 critical files)
3. Backup directory exists (post-update default rollback path)
4. Allowlist subdirs present (commands/, skills/, agents/, hooks/, docs/, templates/)
5. Hook manifest present + parseable (hooks count в manifest)
6. settings.json valid + hooks section + count matches manifest
7. **Dev contamination absent** (DEC-DEV-0019 Finding A — no .claude/CLAUDE.md, .claude/DEV_JOURNAL.md, .claude/INSTALL-HUMAN.md, ecosystem-internal в .claude/dev/)
8. User zone preserved (settings.local.json, product.yaml, .product/)
9. Self-update validation (.claude/commands/ecosystem/update.md present after sync)

**Output:** colorized pass/fail/warn per check; summary с pass+fail+warn counts; exit code 0/1 для CI compatibility.

**Usage:** `./verify-update.sh [path-to-pilot]` или `.\verify-update.ps1 -ProjectPath <path>`.

### Stage 4c — Phase-closure reminder hook (`dev/meta-improvement/hooks/phase-closure-reminder.js`)

**Decision:** PostToolUse hook on Bash matching `git commit` invocations; surfaces stderr reminder when phase-completion commit detected без closure entry.

**Implementation:**
- Reads stdin JSON (Claude Code hook contract)
- Extracts tool_input.command from input
- Pattern matches `\bgit\s+commit\b` (handles `-m`, `-am`, `--message`, HEREDOC)
- Extracts commit message
- Detects phase-completion pattern: `Phase <N>` + completion words (complete, done, finished, ship, implementation, closure, final)
- Searches DEV_JOURNAL.md (walks up к 5 parent dirs) для closure entry: regex `## DEC-DEV-\\d+ — [^\\n]*Phase\\s+<N>[^\\n]*closure`
- If pattern matched AND no closure entry → stderr reminder
- Never blocks (failure-silent on errors)

**Registration:** `.claude/settings.local.json` (ecosystem repo development) PostToolUse Bash. NOT в `hooks/<module>/manifest.yaml` per CONVENTIONS §2 (D7 hooks не deploy to user projects).

**Manual test (per user concern «убедиться что хук точно будет триггериться»):**
- Test 1 (Phase 99 «implementation complete», no closure entry) → ✅ stderr reminder fired correctly
- Test 2 («fix: typo in README», no phase pattern) → ✅ silent (correct no trigger)
- Test 3 («Phase 3 implementation complete», closure entry exists DEC-DEV-0018) → ✅ silent (closure entry detected, correct quiet)
- Test 4 («ls -la», not git commit) → ✅ silent

**4/4 tests pass.** Hook ships shipping behavior validated.

### Stage 5 — CLAUDE.md D7 section restructure

**Decision:** collapse 2 separate items (kickoff + closure) в single «D7 ritual» block с sub-bullets per mechanism.

**Before:**
```
4. Перед стартом phase — phase-kickoff.md + dev/PHASE_<N>_READINESS.md
5. После завершения phase — phase-closure.md (D7 module, Stage 2)
6. Перед commit-ом значимых изменений — спроси «нужна ли DEV_JOURNAL запись?»
```

**After:**
```
4. D7 ritual (см. dev/meta-improvement/):
   - Перед phase: checklists/phase-kickoff.md + dev/PHASE_<N>_READINESS.md
   - После phase: checklists/phase-closure.md
   - При architectural decisions: patterns/ (5 patterns)
   - При memory drift: skills/memory-sync.md
   - Verify update outcome: scripts/verify-update.sh
   - Hook reminder зарегистрирован (.claude/settings.local.json PostToolUse Bash) — fires на phase-completion commits
5. Перед commit-ом значимых изменений — спроси «нужна ли DEV_JOURNAL запись?»
```

**Rationale:** prevents item-by-item growth as D7 mechanisms multiply (anti-pattern from prev «Stage 5 — CLAUDE.md restructuring trigger» discussion). Single nested block contains все entry points.

### Stage 6 — SPEC v1.0 declaration + CONVENTIONS update

**SPEC.md changes:**
- Header: «preliminary draft» → «v1.0 final state»
- Added explicit list of v1.0 mechanisms (CONVENTIONS, checklists, patterns, skills, scripts, hooks)
- Note: «Continued evolution через CONVENTIONS §10 refinement protocol; structural growth complete; ongoing changes are refinements, не expansions»

**CONVENTIONS.md changes:**
- Status: Stage 2 → v1.0 final
- §3 mechanism ratio: «v1.0 status (mechanism mix)» showing checklists + patterns + skills + scripts + hooks balance; promotion criteria validated through Stages 3-4
- §4 activation triggers: added skills/memory-sync, scripts/verify-update, hooks/phase-closure-reminder rows; activation type column
- §6 Memory MCP sync: references skills/memory-sync.md as Stage 4 implementation
- §7 Pattern library: Stage 3 shipped с 5 provisional patterns + refinement triggers
- «Open questions» → «Resolutions» — 5 questions ✅ resolved (memory sync, pattern library structure, bootstrap regression scripting, hook integration, CLAUDE.md update strategy); 2 ongoing (provisional → validated, Stage 5+ promotions)

### Outcome

**D7 v1.0 final state shipped:**

```
dev/meta-improvement/
├── SPEC.md                      # v1.0 spec (≈340 lines)
├── DESIGN_KICKOFF.md            # archival (Stage 1)
├── CONVENTIONS.md               # 10 sections + Open questions resolutions
├── checklists/                  # Stage 2 + 2.5 refinements
│   ├── phase-closure.md
│   └── phase-kickoff.md
├── patterns/                    # Stage 3 — 5 patterns + README index
│   ├── README.md
│   ├── spec-drift-sweep.md
│   ├── readiness-gate.md
│   ├── b1-frontmatter-convention.md
│   ├── cuttable-scope-discipline.md
│   └── smoke-test-plan.md
├── skills/                      # Stage 4
│   └── memory-sync.md
├── scripts/                     # Stage 4
│   ├── verify-update.sh
│   └── verify-update.ps1
└── hooks/                       # Stage 4
    └── phase-closure-reminder.js
```

**11 new files (5 patterns + README + 1 skill + 2 scripts + 1 hook + 1 doc) + 4 modified (SPEC, CONVENTIONS, CLAUDE.md, settings.local.json).**

**7 reference model components addressed (per SPEC §2.1):**
1. ✅ Theory externalization — pattern library + DEV_JOURNAL
2. ✅ Phase kickoff hygiene — phase-kickoff.md
3. ✅ Phase closure hygiene — phase-closure.md (+ Stage 2.5 refinements)
4. ✅ Drift management — Spec Drift Sweep pattern + B.1 Frontmatter Convention pattern + phase-closure Step 1
5. ✅ Memory & continuity — memory-sync skill (formalizes Step 5)
6. ✅ Validation gates — phase-closure Step 2 + verify-update.sh script (DEC-DEV-0019 → DEC-DEV-0020 → this verification)
7. ✅ Self-application discipline — clarified Stage 1; not violated через Stages 2-6

### Lessons

#### Architectural

1. **«Provisional pattern marker» enables early extraction without sacrificing emergence rigor.** Pattern docs ship с current evidence + explicit «refinement trigger» for promotion. Future closures refine OR retire patterns based on usage. Avoids both extremes (defer indefinitely vs lock-in based on 1 instance).

2. **D7 hooks namespace cleanly separated от Product Module hooks.** D7 hook lives в `dev/meta-improvement/hooks/`, registered в `.claude/settings.local.json` (developer-only, not deployed). Product Module hooks live в `hooks/<module>/` registered via manifest.yaml (deployed к user projects). No collision; CONVENTIONS §2 enforced.

3. **Verify-update script as external validator complements в-Claude-Code verification.** Not all verification fits skill chain (e.g., post-/ecosystem:update сessions cwd different от ecosystem repo cwd). External script gives user reliable validation outside Claude Code session, addresses concern «обеспечить что update корректно работает» systemically.

4. **Hook test discipline pays off.** 4 simulated inputs covered trigger / non-trigger / closure-exists / non-applicable cases. Without testing, would've shipped silent-failing hook (pattern matching bugs common). Pattern: any hook implementation needs ≥3 simulated test cases before commit.

#### Process

5. **«Override SPEC §4.2 emerge timing с user authority» works для solo dev meta-domain.** SPEC §4.2 written conservatively assuming external review; for solo dev who knows own patterns intimately, earlier extraction acceptable если provisional marker preserves discipline. User has primary authority over their own development workflow.

6. **Bundle Stages 3-6 в single session works когда trade-offs explicit.** Большая ceremony alternative was 4 separate sessions across Phase 4-7 closures. Bundle accelerates 4-month timeline → 1 session. Acceptable когда provisional markers + refinement triggers preserve future correction path.

7. **Hook is most «substantive» mechanism shipped Stage 4.** Skills + scripts mostly formalize existing manual procedures; hook adds new capability (auto-detection of «forgot to run closure»). Highest value-per-LOC of D7 v1.0 mechanisms.

8. **«Final state» semantically = «structural growth complete», не «no more changes».** Refinement protocol (CONVENTIONS §10) carries ongoing evolution. Structural growth = adding new mechanisms / sections; refinement = adjusting existing mechanisms. Distinction matters для signaling «D7 done» without implying «D7 frozen».

#### D7 mechanism-specific

9. **B.1 Frontmatter Convention pattern = only validated pattern Stage 3.** Other 4 patterns provisional (1-3 instances). B.1 codified в CLAUDE.md long ago, multiple skills implement it correctly = «validated» в pattern library sense. Future Phase closures will validate others.

10. **Phase-closure reminder hook addresses class «forgot to invoke ritual».** Even с CLAUDE.md item «5. После phase — phase-closure.md», user может forget. Hook auto-fires reminder = belt-and-suspenders. Pattern: discoverability docs (CLAUDE.md) + auto-reminder hooks для critical rituals.

11. **Verify-update.sh exit code 0/1 = CI-compatible.** Future automation possibility: run verify-update.sh as part of CI on `.claude-update` automation (если добавится). Stage 4 ships manual run; CI integration deferred.

### Refinements applied this commit

- `dev/meta-improvement/SPEC.md` — header v1.0 final state declaration
- `dev/meta-improvement/CONVENTIONS.md` — 7 sections updated (status, layout, mechanism ratio, activation, memory sync, pattern library, open questions → resolutions)
- `CLAUDE.md` — D7 ritual block restructured (collapse items 4+5 → single nested block)
- `.claude/settings.local.json` — phase-closure-reminder.js hook registered

### Open для future

- **Provisional → validated patterns** через Phase 4-5 closures — patterns recheck'ются per CONVENTIONS §10
- **Stage 5+ promotions если new triggers emerge** — bidirectional memory sync / verify-update CI integration / hook on DEV_JOURNAL.md
- **D7 self-stability check** explicitly DEFERRED per user (2026-04-28); revisit only если accumulating «D7 itself drift» evidence

### Next

**D7 ready for next phase use.**
- Phase 4 kickoff — recommended fresh-session invocation. C.6 (bootstrap update mechanism) уже resolved per DEC-DEV-0020. Other Phase 4 readiness items (C.1-C.5) pending architectural readiness gate execution.
- Phase 4 implementation — D7 patterns referenced as needed (Cuttable Scope Discipline для scope cuts; Readiness Gate для architectural decisions; Spec Drift Sweep после refactor).
- Phase 4 closure — fresh-session phase-closure run; D7 mechanisms validate via second instance (Stage 2.5 refinement opportunity).
- Hook reminder fires automatically on Phase 4 completion commits — catches missed closure invocation.

**Phase 3 closure cycle truly 100% closed.** All artifacts Phase 3 + closure findings + bootstrap fix + D7 v1.0 final state shipped в этой PR.

---

## DEC-DEV-0022 — Bootstrap never-copy zone filter (closes Finding A для greenfield install)

**Date:** 2026-04-28
**Trigger:** User request «убедиться что [D7 changes] не попадут в продуктовые проекты при bootstrap / update». Verified `/ecosystem:update` correctly excludes dev/ via allowlist (DEC-DEV-0020), но `/ecosystem:bootstrap` Step 2b/2c still naive `cp -rn` — copies ALL upstream files including dev/, root CLAUDE.md, DEV_JOURNAL.md, INSTALL-HUMAN.md. Closing remaining gap before main merge.
**Tag:** #bug-fix #architecture

### Context

DEC-DEV-0019 Finding A identified `.claude/CLAUDE.md` contamination как critical issue (auto-loaded by future Claude sessions, misleads them into thinking they work on ecosystem itself). DEC-DEV-0020 fixed это для existing projects (Path Y `/ecosystem:update` с allowlist). Но greenfield install path (`/ecosystem:bootstrap` Step 2b/2c) had **same vulnerability** — just hidden by «greenfield = empty .claude/» mental model.

User's pre-merge verification request surfaced this. Both paths must filter never-copy zone.

### Options considered

**Path A — minimal `rm` filter в Step 2b/2c:**
- Add 4 `rm` lines в both code blocks (remove dev/, CLAUDE.md, DEV_JOURNAL.md, INSTALL-HUMAN.md from temp staging dir before merge)
- Pros: minimal change; preserves existing `cp -rn` semantics для user files; easy verify; small diff
- Cons: blocklist approach (specifies what's NOT copied)

**Path B — full allowlist conversion:**
- Rewrite Step 2b/2c к explicit allowlist (loop через subdirs/files)
- Mirror /ecosystem:update sync semantics
- Pros: parallel structure с update; consistent allowlist в both commands
- Cons: substantial bootstrap.md rewrite; risk regressions to existing greenfield flow; user already has working bootstrap

**Path C — defer к v1.1:**
- Document как known issue
- Cons: contamination still possible на every fresh bootstrap; user explicit request «убедиться»

### Decision

**Path A — minimal `rm` filter.** Rationale: Path A solves immediate concern с smallest surface area; bootstrap stays simple; allowlist consistency можно achieve later if needed (Path B candidate для v1.1 если new contamination class emerges).

**Implementation:**

Step 2b (online path) — add filter after `.git` removal:
```bash
rm -rf .claude-ecosystem-tmp/dev
rm -f .claude-ecosystem-tmp/CLAUDE.md
rm -f .claude-ecosystem-tmp/DEV_JOURNAL.md
rm -f .claude-ecosystem-tmp/INSTALL-HUMAN.md
```

Step 2c (offline path) — restructured к stage-and-filter pattern (mirror Step 2b):
```bash
cp -r ~/.claude/ecosystem .claude-ecosystem-tmp
rm -rf .claude-ecosystem-tmp/.git
# [same 4 rm commands]
mkdir -p .claude
cp -rn .claude-ecosystem-tmp/. .claude/
rm -rf .claude-ecosystem-tmp
```

Step 2e «Note on preserved files» updated с explicit «NOT copied (filtered)» list + rationale referencing DEC-DEV-0019/0020.

### Outcome

**Both paths now safe:**
- `/ecosystem:bootstrap` (greenfield) — Step 2b/2c filter never-copy zone before merge
- `/ecosystem:update` (existing project) — allowlist explicit per DEC-DEV-0020

**Verified D7 не propagates к user projects:**
- `dev/meta-improvement/` (всё D7) — в never-copy zone, removed from temp перед cp
- DEV_JOURNAL.md (root, ecosystem-dev's) — removed from temp
- CLAUDE.md (root, ecosystem-dev's) — removed from temp
- Bootstrap completing на user project leaves `.claude/{commands,skills,agents,hooks,docs,templates}` + root references (README, BOOTSTRAP, CHANGELOG, ROADMAP, install scripts, .env.template, gitignore.template) — нет contamination.

**Verify-update.sh script** (DEC-DEV-0021 Stage 4b) Check 7 explicitly tests это — «Dev contamination absent (DEC-DEV-0019 Finding A)»:
- `.claude/CLAUDE.md` correctly absent → PASS
- `.claude/DEV_JOURNAL.md` correctly absent → PASS
- `.claude/INSTALL-HUMAN.md` correctly absent → PASS
- `.claude/dev/` only user files OR absent → PASS

После this fix, fresh bootstrap of user project on clean dir → verify-update.sh would pass all 9 checks.

### Lessons

1. **«Verified by allowlist» ≠ «universally safe» — both copy paths need explicit filter.** Mental model «bootstrap = greenfield, no contamination concern» missed что greenfield ALSO copies dev/ from upstream. Pattern: any file-copy operation needs explicit zone treatment, regardless of source/target state.

2. **User pre-merge verification requests are valuable.** «Убедиться что [X] не происходит» surfaced gap that automated testing didn't catch. Prompt: «verify that [behavior] cannot happen» = useful pre-merge audit pattern.

3. **Path A vs Path B tradeoff captured.** Minimal blocklist filter (Path A) shipped now; full allowlist conversion (Path B) deferred unless contamination class evolves. Pattern: «smallest fix that closes gap» preferred unless larger refactor solves multiple problems.

### Refinements applied

- `commands/ecosystem/bootstrap.md` Step 2b — added 4-line filter
- `commands/ecosystem/bootstrap.md` Step 2c — restructured к stage-and-filter
- `commands/ecosystem/bootstrap.md` Step 2e — «Note on preserved + filtered files» с explicit list + rationale

### Next

**Immediate:** PR #3 ready для merge к main (this commit closes verification gap).

**Future regression watch:** if new contamination class emerges (e.g., new ecosystem-dev folders в repo) → add к Step 2b/2c filter list + here. Verify-update.sh Check 7 catches на user side.

---

## DEC-DEV-0023 — Phase 3 smoke test executed; 8 hook-class fixes + lint pipeline + skill refinements

**Date:** 2026-04-29
**Trigger:** User-driven Phase 3 smoke test on `my-first-test` project (5.5 hour real-run: bootstrap → Discovery → Planning → enrichment FM-001). Fresh post-test analysis revealed 119 silent hook failures + cascade false-positive accumulation + skill convention gaps. User reviewed findings list, approved subset, requested implementation pre-Phase-4.
**Tag:** #smoke-test #regression-fixes #hooks #skill-refinements #phase-closure-gap

### Context

[CHANGELOG 1.1.0](CHANGELOG.md) shipped Phase 3 (Planning Module + Feature Definition Module + cascade detection + adaptive-depth DA + BG extraction Phase 1) с note «Real-world smoke test pending — see `dev/PHASE_3_SMOKE_TEST_PLAN.md` (run by user в interactive Claude Code session)». Plan was queued, never executed before Phase 4 work began. User executed real run 2026-04-29 — first time hook code touched real product workflow at scale (~70 markdown writes, 23 BR + 7 SC + 7 IC + 7 VC + 3 LC).

Findings from session JSONL log + artifact inspection:

**🔴 Critical hook bugs (silent regressions):**

1. **`bg-extractor.js` TDZ — 119 failures.** `const STOPWORDS = new Set([...])` declared at line 195, but `termPasses(term)` (which uses STOPWORDS) called at line 88 — inside top-level execution, before the const declaration evaluated. Function declaration `termPasses` hoisted; `const STOPWORDS` lives in TDZ → `ReferenceError: Cannot access 'STOPWORDS' before initialization`. Result: **0 BG candidates extracted** entire session. Bug class catchable by `eslint --rule no-use-before-define` в один проход.

2. **`cascade-check.js` over-eager dependents — 396 entries (most false positives).** `addDeps()` had explicit comment-sanctioned shortcut «Conservatively: include all candidates of that type as potential dependents ... Acceptable for first iteration; refine in v1.1 if perf issue.» Each SC save → V-11 missing-reverse-ref entry для **all 6 FMs**, even though SC.feature scalar pointed at only one FM. `cascade-pending.yaml` = 173 KB, 50 false positives per unrelated FM × 5 FMs.

3. **`cascade-check.js` no dedup on append.** Line 196 `existing.push(...pendingEntries)` — every save appended всё without dedup. Compound с (2): 23 BRs × 7 SC × X re-emits = monotonic growth.

4. **`br/ic-change-trigger.js` parser-formatter mismatch.** Formatter emits `      ${dl}` (6 spaces); parser strips `^\s{4}` (4 spaces). Each round-trip adds +2 leading whitespace per diff line. After 23 BR writes (sequential dedup re-rewrite all entries), BR-001's diff field had ~44 spaces leading per line. `da-pending.yaml` = 143 KB.

**🟡 Validation lifecycle gap:**

5. **`artifact-validate.js` no auto-purge.** FM-006 missing-jtbd[] flagged at 14:42:58 при первой генерации skeleton. User picked option B (jtbd: [JTBD-1.1] supporting), field added — but stale entry remained in `validation-pending.yaml` indefinitely. No mechanism to clear when rule passes на subsequent save.

**🟡 Skill convention gaps surfaced:**

6. JTBD «supporting» convention applied к FM-001/005/006 ad-hoc; not codified в release-planning.md. Future planners may diverge.
7. VC-005 covered SC-002 + multi-device + security в одном файле (15 cases, 5 BRs, 2 ICs) — no split heuristic в vc-derivation.md.
8. NOTE-001 (hard lockout) + NOTE-003 (2FA) — security territory; could be NFR candidates rather than FM. No NFR-vs-FM placement guard в feature-session.md.
9. BR-013/014/018 — judgment-call numeric defaults (30-day TTL, 5 devices, captcha threshold=5) с medium confidence, but no telemetry plan для refinement post-launch.
10. DEC-PLAN-006 captured 4 important DA findings as free-text — not machine-readable; future re-validation cannot programmatically resolve revisit triggers.
11. BR.feature schema is scalar — BR-001 (email format universal) gets `feature: FM-001`, would duplicate or fight schema при FM-002 enrichment.
12. `/product:cascade` had no `--reset` / `--revalidate` для cleanup of accumulated pending bloat.

**📋 Process gap:** Phase 3 closure ritual (DEC-DEV-0018) had no «hook smoke run» step. Closure looked at files, не executed hooks. 119 failures прошли через closure undetected.

### Options considered

**Path X — defer всё до Phase 4 implementation as "fixed during Phase 4 work":**
- Pros: focuses на forward Phase 4 deliverables.
- Cons: Phase 4 builds on Phase 3 hooks; broken hooks degrade Phase 4 testing. False sense of stability.
- Reject.

**Path Y — minimal hot-fix только critical hooks (bg-extractor + cascade dedup):**
- Pros: smallest diff; fast.
- Cons: leaves whitespace ladder + skill convention gaps + no infra prevention. Same class re-emerges next phase.
- Reject.

**Path Z (chosen) — comprehensive fix package: 4 hook bugs + 1 validation gap + 5 skill conventions + 1 schema decision deferred + lint infra + closure ritual addition + test cleanup.**
- Pros: closes all surfaced gaps; adds preventive infra (smoke runner + pre-commit + closure step) so не повторится; codifies discovered patterns. v1.1.1 patch release captures.
- Cons: more files touched (25+); requires careful sequencing.
- Accepted. User pre-approved scope (kept all F-items + Q1-Q5/Q7 + R3 + closure step + cleanup; cut Q6 standalone DA-review command + P1/P2/P4 ritual runs as not yet warranted).

### Decision

**Path Z applied 2026-04-29:**

**Hook code fixes:**
- F1: `hooks/product/bg-extractor.js` — moved STOPWORDS const + comment к module top (after requires). Added comment explaining TDZ history.
- F2: `hooks/product/cascade-check.js` — replaced `identifyDependents()` switch + `addDeps()` "iterate all candidates" pattern с forward-driven `getForwardSpecs(type)` map + `findArtifactFileById()` lookup. Only candidates that saved actually forward-references queued. Reverse-driven additional review rules (BR change → LC re-validate) deferred к v1.2.
- F3: `hooks/product/cascade-check.js` — dedup logic before `existing.push(...)` via composite-key Set (`artifact|rule|triggered_by`).
- F4: `hooks/product/br-change-trigger.js` + `ic-change-trigger.js` — parser strip `/^\s{6}/` aligned с formatter emit (was `/^\s{4}/`).
- F5: `hooks/product/artifact-validate.js` — `purgeValidationPendingFor(projectRoot, fm.id)` called at start of each hook run; clears stale entries; new findings re-queued via existing flow.

**Lint infrastructure (F6 + R3):**
- `dev/meta-improvement/scripts/smoke-hooks.js` — self-contained Node script: per hook does `node --check` + minimal hookInput JSON pipe + assert exit 0 + stderr free of `ReferenceError|TypeError|SyntaxError|TDZ patterns`. No npm deps required.
- `dev/meta-improvement/scripts/verify-hooks.js` — wrapper: always runs smoke; conditionally runs eslint if `node_modules/eslint` installed.
- `package.json` (root, ecosystem-dev only) — `npm run smoke:hooks | verify:hooks | verify`; `eslint` as devDep (optional install).
- `eslint.config.js` (flat config v9) — rules: `no-use-before-define`, `no-undef`, `prefer-const`, `no-var`, `eqeqeq`. Catches TDZ class.
- `dev/meta-improvement/scripts/pre-commit.sh` — git hook: blocks commits touching `hooks/` if verify-hooks fails.
- `dev/meta-improvement/scripts/install-pre-commit.sh` — idempotent installer (backs up existing pre-commit).
- Updated `commands/ecosystem/bootstrap.md` Step 2b/2c never-copy filter + `commands/ecosystem/update.md` allowlist + `dev/meta-improvement/scripts/verify-update.sh` Check 7 — exclude `package.json`, `package-lock.json`, `eslint.config.js`, `node_modules/` from user `.claude/`.

**Phase-closure step:**
- `dev/meta-improvement/checklists/phase-closure.md` — new Step 3 «Hook runtime smoke (≤5 min)»; existing steps 3/4/5 renumbered к 4/5/6. Time budget bumped 35-65 min. Pre-commit installer documented. Pain-origin reference к этому DEC.

**Skill / command refinements:**
- Q7: `commands/product/cascade.md` — added `--pending --revalidate` (re-detect cascade across active artifacts) and `--pending --reset` (destructive cleanup с confirmation) sub-actions. Step 3a documents bulk operation flow.
- Q1: `skills/product/release-planning.md` — «JTBD mapping decision tree» с 3 options (empty array / supporting / demote priority) + decision criteria + required `confidence_notes` text для option B.
- Q3: `skills/product/vc-derivation.md` — «Complexity threshold» heuristic (>2 rule clusters / >12 cases / >6 BRs covers_rules → split); naming convention `VC-NNNa | VC-NNNs`; non-blocking для A1.
- Q4: `skills/product/feature-session.md` — «Deferral capture — NOTE creation guidance» section с promote_target decision tree + NFR vs FM placement heuristic.
- Q5: `skills/product/business-rule-extraction.md` — Step 4 body template добавил `## Telemetry plan` section (mandatory для confidence: medium|low + numeric parameters); Step 4a trigger.
- F8: `skills/product/feature-session.md` — «Structured DA findings format в decision journal» section — YAML schema с `revisit_trigger` mandatory для accepted/deferred resolutions.
- Q2: `dev/v1_1_backlog.md` — «BR.feature schema — single vs array vs global directory» entry с 3 options + bring-forward trigger + estimated effort.

**Test project cleanup:**
- `my-first-test/.product/.pending/cascade-pending.yaml` — reset 4317 → ~10 lines (clean template + rationale comment).
- `my-first-test/.product/.pending/da-pending.yaml` — reset 2397 → ~10 lines.
- `my-first-test/.product/.pending/validation-pending.yaml` — stale FM-006 entry cleared.
- Core artifacts (FM/SC/BR/IC/LC/VC/NOTE) untouched — quality verified clean в analysis.

### Outcome

После fixes:
- `node dev/meta-improvement/scripts/verify-hooks.js` returns exit 0; all 6 hooks pass smoke (was: bg-extractor would have FAIL'd).
- Test project pending files clean baseline; next Phase 4 enrichment will populate с correct (forward-driven, deduplicated, whitespace-clean) entries.
- Phase-closure ritual now includes hook smoke step — same class regression catchable in 5 minutes.
- 5 skill conventions codified — future planners explicit guidance instead of ad-hoc.

User to do separately (out-of-scope этой commit):
- R2 — `/ecosystem:update --dry-run` then apply on `my-first-test` to propagate fixes (verifies update path).
- R4 — re-run smoke test after fixes (validate F1-F5 in real workflow).

Phase 4 readiness items C.1-C.5 не unblocked этой commit; они независимы. C.6 уже resolved (DEC-DEV-0020).

### Lessons

1. **Smoke test gap = silent regression habit.** CHANGELOG 1.1.0 explicit said «smoke test pending» but Phase 3 closure (DEC-DEV-0018) didn't enforce. Phase implementation → closure ritual → smoke test execution must be **gated** не sequential. Closure step «Hook runtime smoke» is permanent fix for class.

2. **Comment-sanctioned shortcuts age badly.** `cascade-check.js` had explicit comment «Conservatively: include all candidates ... Acceptable for first iteration; refine in v1.1 if perf issue.» Author thought perf; reality was correctness. Comment described a simplification, but hide the implication that simplification has bugs. Pattern: comments documenting «v1 simplification» need «known incorrect for X case» qualifier, not «acceptable».

3. **Symmetric code = symmetric bugs.** br-change-trigger.js + ic-change-trigger.js had identical parser/formatter — both had the +2 whitespace ladder. Symmetry implementation is benefit, but symmetric bugs spread without help. Helper function extraction would have made fix one-line; consider for v1.2.

4. **Static check infrastructure pays off на bug 1.** Smoke runner + eslint flat config = 6 KB scripts that would catch bg-extractor TDZ in 30 seconds. Same infra also catches future TDZ / undefined / typo class. ROI massive vs not having it.

5. **Pilot evidence trumps spec proposals для skill refinements.** Q1 (JTBD supporting), Q3 (VC complexity), Q4 (NFR placement), Q5 (telemetry plan) — все codified из real ad-hoc choices in pilot. Without pilot, these would be hypothetical concerns at design time. Evidence-based codification > preemptive design.

6. **Validation lifecycle: queues need purges.** «Append to pending; surface at gate» is half the story. Без purge, queues only grow. F5 «auto-purge on resolution» pattern applies к **any** validation-pending-style queue (cascade-pending will benefit too — но Q7's revalidate handles that user-initiated).

7. **D7 phase-closure ritual self-improved through application.** Phase 3 closure (DEC-DEV-0018) caught 9 inline issues; this Phase 3 smoke test (DEC-DEV-0023) caught 12 more issues + introduces hook-smoke step that prevents recurrence. Each closure iteration refines the ritual. 3 instances now (DEC-DEV-0014 closure, DEC-DEV-0018 closure run, DEC-DEV-0023 smoke test) — pattern «closure-driven improvement» graduates from provisional к established.

### Refinements applied

| File | Change |
|---|---|
| `hooks/product/bg-extractor.js` | STOPWORDS hoisted к module top |
| `hooks/product/cascade-check.js` | forward-driven `getForwardSpecs()` + dedup |
| `hooks/product/br-change-trigger.js` | parser /^\s{6}/ aligned |
| `hooks/product/ic-change-trigger.js` | parser /^\s{6}/ aligned |
| `hooks/product/artifact-validate.js` | `purgeValidationPendingFor()` |
| `dev/meta-improvement/scripts/smoke-hooks.js` | NEW |
| `dev/meta-improvement/scripts/verify-hooks.js` | NEW |
| `dev/meta-improvement/scripts/pre-commit.sh` | NEW |
| `dev/meta-improvement/scripts/install-pre-commit.sh` | NEW |
| `dev/meta-improvement/scripts/verify-update.sh` | Check 7 extended (lint files contamination) |
| `dev/meta-improvement/checklists/phase-closure.md` | Step 3 «Hook runtime smoke»; renumbered |
| `package.json` | NEW (ecosystem-dev only) |
| `eslint.config.js` | NEW (ecosystem-dev only) |
| `commands/ecosystem/bootstrap.md` | never-copy zone extended |
| `commands/ecosystem/update.md` | never-copy zone extended |
| `commands/product/cascade.md` | --reset / --revalidate sub-actions |
| `skills/product/release-planning.md` | JTBD mapping decision tree |
| `skills/product/vc-derivation.md` | VC complexity split heuristic |
| `skills/product/feature-session.md` | Deferral capture guidance + structured DA findings schema |
| `skills/product/business-rule-extraction.md` | Telemetry plan template |
| `dev/v1_1_backlog.md` | BR.feature schema entry |
| `my-first-test/.product/.pending/*.yaml` | reset clean |

### Next

**Immediate (this commit):**
- CHANGELOG 1.1.1 patch release entry referencing this DEC.
- Memory sync (feedback_methodology + project_ecosystem_status updates).
- Possible SPEC.md / processes.md note about cascade behavior change.

**User-driven follow-up (out of scope этой commit):**
- R2: `/ecosystem:update --dry-run` then `--apply` on `my-first-test`.
- R4: re-run smoke test after fixes — validate F1-F5 in real workflow.

**Phase 4 readiness:** unblocked. Original C.1-C.5 architectural items pending readiness gate execution. C.6 (bootstrap update mechanism) уже resolved (DEC-DEV-0020). DEC-DEV-0023 fixes don't constrain Phase 4 scope.

---

## DEC-DEV-0023-A — Addendum: severity correction + second smoke session findings

**Date:** 2026-04-30
**Trigger:** Second smoke session on `my-first-test` (FM-002 enrichment, 6.3h, log `e361cf0c-...jsonl`). User analyzed log per «есть ли ошибки, которые мы еще не починили». R2 task (propagate 1.1.1 к test project via `/ecosystem:update`) **was NOT yet performed** — session ran on stale 1.1.0 hooks/skills. Result: same bugs fired again, plus revealed что DEC-DEV-0023 finding 2 was **understated в severity**.
**Tag:** #severity-correction #smoke-test-2 #propagation-lag #cascade-corruption

### Context

Между первой смок-сессией (DEC-DEV-0023) и второй пользователь не выполнил R2 follow-up (`/ecosystem:update` on my-first-test). Test project's `.claude/hooks/`, `.claude/skills/`, `.claude/commands/` остались на pre-1.1.1. FM-002 enrichment запустился с **buggy** hooks. Three classes of finding emerged.

### Finding N1 — Severity correction для F2 (cascade-check destructive auto-fix)

**Original DEC-DEV-0023 description:** «over-eager dependents — 396 false positives in pending file».

**Corrected severity:** cascade-check.js v1 auto-fix branch (`if depFm.status === 'active'`) **silently writes к active artifact's frontmatter via `injectListField()`**. Это не just queue noise — это **active data corruption**.

**Evidence из second smoke session (2026-04-30):**

302 unintended `auto-fixed` actions during FM-002 enrichment, distributed по triggering artifact:

| Triggered by | Unintended writes к FM-001 artifacts |
|---|---|
| SC-010 creation | 33 (BR-001..023, LC-001..003, IC-001..007 polluted) |
| SC-010a, SC-010e1, SC-010e2, SC-010e3, SC-011 (× 5) | 33 each = 165 |
| LC-004 creation | 20 (FM-001 SC.lifecycle / VC.covers_lifecycles polluted) |
| VC-008..VC-013 (× 6) | 13 each = 78 |
| VC-001 edit | 6 |

**Worst case — scalar field destruction:** VC-002..VC-007 в FM-001 имели scalar `scenario: SC-001a` (без brackets). Cascade-check's `parseListField()` returns `[]` for unbracketed scalars; `injectListField()` then writes new bracketed array, **overwriting original SC ref**:

```
Before: VC-002.scenario = SC-001a
After:  VC-002.scenario = [SC-010, SC-011, SC-010a, SC-010e1, SC-010e2, SC-010e3]
```

Original SC-001a fully erased. Recovered только manual sed (4 cleanup batches by AI during session). Without vigilance — 302 cross-FM bi-dir refs would have stuck permanently.

**Implication для F2 fix:** forward-driven `getForwardSpecs()` + `findArtifactFileById()` (DEC-DEV-0023) corrects the over-eager iteration — only candidates that saved actually forward-references queued. Скан-all-of-type pattern полностью убран. Therefore F2 fix architecturally addresses the destruction, not just queue noise. **Code fix остаётся правильным**; только описание impact в DEC-DEV-0023 надо считать дополненным.

**Lesson:** «v1 simplification» comment («Acceptable for first iteration; refine in v1.1 if perf issue») described pattern as performance concern. Reality: correctness concern с silent data corruption. When future commit-sanctioned shortcuts surface, audit для real worst case, не assumed perf pattern.

### Finding N2 — Bash bypasses PostToolUse hook (intentional design, observed worth documenting)

**Observation:** AI's recovery cleanup использовал `sed -i` через Bash tool. Each sed batch modified `.product/*.md` files но **не triggered cascade-check.js / artifact-validate.js / bg-extractor.js**. Reason: hook matcher = `"matcher": "Write|Edit"` (Claude Code tool names); Bash invocations don't match.

**Это properties:**
- ✓ **Intentional дизайн** — lets cleanup workflow operate without recursive cascade re-fire.
- ✓ Used productively in this session — AI cleaned up 33+33+33+33 cross-FM pollution без racing с cascade-check (которое уже broken).
- ⚠ **Side effect:** sed/awk правки .product/*.md через Bash bypass V-* validation, BG extraction, cascade detection entirely. Manual edit mistake = silent insert.

**Decision:** keep current matcher behavior. Bash-driven mass operations (sed, awk, bulk file moves) — power-user territory. If future telemetry shows sed misuse — revisit с pattern detection в Bash hook layer. **Не блокер** для Phase 4.

**Documentation impact:** добавить mention в `dev/meta-improvement/CONVENTIONS.md` или similar — «Mass operations via Bash bypass PostToolUse hooks; trade-off documented».

### Finding N3 — Skills (не только hooks) propagate via `/ecosystem:update`

**Observation:** Originally я фокусировался на hooks при cleanup и в DEC-DEV-0023 narrative. Test project's `.claude/skills/` were also stale (Q1, Q3, Q4, Q5, Q7, F8 codifications absent; counts = 0).

**Effect on second smoke session:**

| Codification (1.1.1) | FM-002 enrichment behavior |
|---|---|
| Q1 JTBD supporting decision tree | N/A — FM-002 had legitimate JTBD-1.1; codification not exercised |
| Q3 VC complexity threshold | VC-013 (trial cap verification) covers SC-010e3 + 6 BRs + 3 ICs — borderline split candidate; AI proceeded без heuristic |
| Q4 NOTE NFR placement guard | 3 new NOTEs (NOTE-006/007/008): asset retention, multi-target email, trial cap reset — **all** `promote_target: BR`. NOTE-006 + NOTE-008 — typical NFR territory (data lifecycle / quota policy) but Q4 framework absent → AI defaulted к BR |
| Q5 telemetry plan template | **0 of 24 new BRs** (BR-024..BR-043) include `## Telemetry plan` section. Several judgment-call defaults (BR-031 trial_cap=30 min, BR-035 signed URL TTL) without revisit-trigger codified |
| Q7 `/product:cascade --reset/--revalidate` | Not available in test project — AI used manual sed для cleanup instead of structured command |
| F8 structured DA findings YAML | DEC-PLAN-009..017 в decision journal — free-text format (legacy). Not machine-readable |

**Implication:** `/ecosystem:update` (R2) propagates BOTH `hooks/` AND `skills/` AND `commands/` per allowlist (DEC-DEV-0020). User running `/ecosystem:update` once enables all 1.1.1 benefits simultaneously. Single propagation step — uniform expectation.

### Outcome

После second smoke session:

- **Bug F1 (bg-extractor TDZ):** fired 57 times (vs 119 in first session — shorter session). Fix correctness verified в master via smoke runner. Awaiting propagation.
- **Bug F2 (cascade over-eager):** fired 302 active-artifact corruptions + 143 queue entries. Severity now correctly understood. Fix correctness verified.
- **Bug F3 (cascade dedup):** cascade-pending grew к 3120 lines / 445 entries. Fix correctness verified.
- **Bug F4 (BR/IC trigger whitespace):** da-pending 159 KB. Fix correctness verified.
- **Bug F5 (validation auto-purge):** N/A в этой session (no validation rules failed).
- **AI's discipline in handling cascade incident:** strong — recognized bug at minute 4 of cascade fire; recorded incident in `feature-FM-002-progress.yaml` cascade_incident_2026-04-30 block; correctly classified as ecosystem (not product) issue (no NOTE-* spawn для tooling bug); recommended `/ecosystem:update` в next_steps.
- **FM-002 final artifact quality:** high — 6 SC + 20 BR + 1 LC + 6 IC + 6 VC + 3 NOTE; LC-004 LocalizationJob с 8 states + 12 transitions; BR-039 error classification taxonomy clever architectural choice; cross-feature ICs proper (e.g., IC-012 RESOLVES F.3 BR-033 DA flag).

### Action items

1. **🔴 USER:** `/ecosystem:update --dry-run` then `--apply` on `my-first-test` — propagates 1.1.1 hooks + skills + commands. Single step closes all five F-fixes + Q1-Q7 + F8 для будущих enrichment sessions.
2. **🟢 (this commit):** addendum в DEV_JOURNAL preserves correction trace для future audit / pattern-emergence (D7 Stage 5+).
3. **🟡 Optional (опять-таки this commit или separate):** brief mention в `dev/meta-improvement/CONVENTIONS.md` про Bash-bypasses-PostToolUse documentary observation (low priority — power-user territory).

### Lessons (additions к DEC-DEV-0023 lessons block)

8. **Severity assessment requires execution evidence, не just code review.** DEC-DEV-0023 first-pass narrative described F2 as queue noise. Second smoke session evidence (302 unintended writes + scalar destruction) revealed active corruption. Code review can verify mechanism existence; runtime evidence quantifies impact + worst case.

9. **Propagation lag = compound risk.** Period between fix-in-master и fix-in-pilot is high-risk window. User explicitly deferred R2 («сделаю сам»); 1 day lapse → second smoke ran on stale code → 302 corruption events that wouldn't have occurred с propagated fix. Pattern: when fix and pilot are decoupled, propagation should have explicit time-bound expectation.

10. **«Bash bypasses hooks» is feature, not bug — but worth documenting.** Manual cleanup workflows benefit from this; auto-validation bypass risk is real but bounded к explicit user/AI sed actions. Trade-off accepted; document.

### Next

**Immediate:** этот PR landed с addendum. No code changes — pure documentation severity correction.

**Awaiting user (out of scope этой PR):**
- R2: `/ecosystem:update` on my-first-test (urgent before next FM enrichment)
- R4: third smoke session с propagated 1.1.1 — should show 0 hook errors + clean cascade-pending growth + Q5 telemetry plans applied automatically.

---

## Шаблон новой записи

```markdown
## DEC-DEV-NNNN — <one-line title>

**Date:** YYYY-MM-DD
**Trigger:** <what prompted this>
**Tag:** #category #subcategory

### Context
What was the situation, what constraints applied.

### Options considered
1. Option A — pros/cons
2. Option B — pros/cons
3. ...

### Decision
What was chosen and why.

### Outcome
What happened after applying. (Filled in retroactively if outcome takes time.)

### Lessons
What to remember next time.
```

**Numbering:** continuous, no gaps. Start each new entry with next NNNN.

**When to add an entry:** default yes for architectural choices, rejected alternatives, root causes of bugs, things that turned out different from plan. Default no for: typo fixes, doc reformatting, dependency bumps.
