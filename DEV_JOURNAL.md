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
