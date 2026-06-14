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

## DEC-DEV-0024 — Закрытие drift во frontmatter HYP (наследие DEC-DEV-0013 B.1)

**Date:** 2026-05-10
**Trigger:** Phase 4 readiness review (`dev/PHASE_4_DECISIONS.md` A.3) — pre-Phase-4 нужно закрыть унаследованный пункт A.3 о неканонических полях в `skills/product/hypothesis-formulation.md`.
**Tag:** #spec-revision #drift-fix #refactor

### Context
DEC-DEV-0013 B.1 (Phase 3 readiness) наблюдала: skill `skills/product/hypothesis-formulation.md` создаёт HYP с полями, расходящимися с каноническим spec в `docs/pmo/artifacts/HYP.md`:
- `success_threshold` вместо канонического `target_value`
- В шаблоне отсутствуют поля `segment` и `value_proposition`

Это пример AI-склонности «переименовать поле для естественности» (DEC-DEV-0011) — точно тот класс drift, против которого DEC-DEV-0012 ввёл convention «explicit frontmatter template + anti-pattern warnings» в каждом skill, создающем артефакт. Reference implementations: `problem-discovery.md` Step 3, `note-promote.md` Step 3.

В DEC-DEV-0023 smoke test пункт не всплыл — существующие HYP из прошлой сессии не re-валидировались, но при следующем `/product:init` или при создании новой HYP drift воспроизведётся.

### Options considered
1. **A. Fix сейчас.** Обновить skill: добавить explicit YAML template + список запрещённых имён полей (`success_threshold` явно warn). 15-30 минут работы.
2. **B. Отложить в v1.1.** Защита pattern-linter (C4) недостаточна — если skill сам «легализует» неправильное имя, linter может пропустить.

### Decision
**A — fix в Phase 4 implementation.** Закрытие drift до распространения дешевле чем cleanup batch later. Convention уже отработана в двух skills.

### Outcome
Будет применено в Phase 4 implementation как первый кандидат deliverable (низкая сложность, явный pattern). После — обновить project_ecosystem_status memory + DEV_JOURNAL по итогу.

### Lessons
1. **Inherited issues compound.** Pre-phase readiness gates ловят их; phase-closure ритуал (D7) должен явно snapshot'ить нерешённые открытые пункты, не только новые findings.
2. **«Skill что генерирует артефакт» — high-risk drift surface.** Каждый такой skill — кандидат на B.1 frontmatter convention review. Можно добавить в phase-closure checklist Step 4 (Spec drift sweep).

---

## DEC-DEV-0025 — Phase 4 архитектурные решения: handoff hash + NFR sanity + validation runner (C.1 + C.2 + C.4)

**Date:** 2026-05-10
**Trigger:** Phase 4 readiness gate — три связанных архитектурных вопроса для implementation (`dev/PHASE_4_DECISIONS.md` C.1/C.2/C.4).
**Tag:** #architecture #spec-decision

### Context
Три implementation choice для Phase 4 deliverables, тесно связанных с поведением `handoff.md` / `nfr-review.md` / `validate.md`:

**C.1 — handoff hash на CRLF.** Правило валидации V-H-04 детектит drift между `.product/` и `.handoff/` через сравнение SHA-256. На Windows автоконвертация CRLF (`core.autocrlf=true`) даст разный хеш для того же логического контента → ложные срабатывания при checkout на разных платформах.

**C.2 — жёсткость NFR sanity ranges.** При создании NFR пользователь может переопределить значение sanity-диапазона (например, latency=10s где typical=1s) с rationale. Вопрос: требовать ли Product DA review для каждого override, или informational warning достаточно?

**C.3 — validation runner program vs hardcode.** `/product:validate --deep` запускает ~50 правил из `validation.md`. Парсить каталог программно (две точки изменения, хрупкий markdown parser) или хардкодить в skill (дублирование с каталогом, drift risk)?

### Options considered + Decisions

| # | Options | Decision | Rationale |
|---|---|---|---|
| C.1 | A. Нормализация LF перед хешем / B. Хеш как есть + `.gitattributes` / C. Построчное хеширование | **A** | Простейший cross-platform fix без зависимости от внешней конфигурации. Helper `normalizeForHash(content)` в `skills/product/handoff-generator.md` + переиспользуется в `product-handoff-gate.js` |
| C.2 | A. Strict (DA review per override) / B. Informational warning / C. Hybrid by magnitude | **B** | Override уже требует rationale (барьер). Strict добавляет ceremony к каждому реалистичному use case (batch jobs, planned degradation). Hybrid усложняет workflow без явного value (магнитуду «насколько большой override» легко undermine выбором typical-значения) |
| C.4 | A. Программно из каталога / B. Hardcode list / C. Hybrid + linter | **B сейчас, C — кандидат v1.1** | На текущем количестве правил (~50) hardcode проще + надёжнее. Markdown-парсер каталога — overengineering для статической data structure. Linter каталог↔runner добавить когда правил станет 100+ или drift реально проявится |

### Outcome
Будет применено в Phase 4 implementation. Конкретные deliverables:
- `skills/product/handoff-generator.md` — `normalizeForHash()` helper, hash spec в §SHA-256
- `hooks/product/product-handoff-gate.js` — переиспользует helper
- `skills/product/nfr-review.md` — sanity workflow «warn + log to frontmatter `sanity_check: overridden` + rationale; не блокировать»
- `skills/product/validation-runner.md` — explicit table правил с pointer на implementation; добавление правила = двойная запись (катаlog + runner) как осознанный tradeoff

### Lessons
1. **Когда parser complexity > value at current scale — hardcode wins, даже если «feels duplicative».** Explicit drift-detection (C для C.4) — pattern для v1.1 при росте.
2. **Cross-platform consistency требует explicit normalization, не assumption.** `.gitattributes` хрупкий; helper в коде надёжнее.
3. **Override как «запись с rationale» = sufficient governance в большинстве случаев.** Дополнительный gate (DA review per override) — over-engineering до накопления evidence о вреде.

---

## DEC-DEV-0026 — Расширение архитектуры DA: brief format + manual/auto trigger + release-level scope (C.3 + D.3 + D.7)

**Date:** 2026-05-10
**Trigger:** Phase 4 readiness gate + новый user-driven запрос на release-level DA capability (`dev/PHASE_4_DECISIONS.md` C.3/D.3/D.7).
**Tag:** #architecture #scope-extension #da

### Context
Существующая иерархия DA после Phase 3:
- **single-artifact / adaptive** — hook-driven (BR/IC change → adaptive depth subagent), Phase 3 ✅
- **FM-level / Mode: full** — manual `/product:da-review FM-NNN`, planned for Phase 4

Три связанных решения переопределяют DA архитектуру:

**C.3 — формат brief для manual `/product:da-review` + локация output.** FM-level review требует своих lenses (cross-rule consistency, JTBD alignment, scope creep), не симметричный hook-driven brief.

**D.3 — F.9 trigger: ручной, авто, или гибрид.** Auto перед `/product:handoff` может surprise, manual теряет easy-path для «review-then-ship».

**D.7 — release-level DA review (новое, user-requested).** Полностью отсутствует в roadmap. Нужен для cross-FM consistency, release scope coverage vs HYP, dependencies, bundle handoff readiness. В `handoff-spec.md:110` есть concept «bundle handoff для release» — это release-level snapshot, но без semantic review.

Pre-decision проверено: ни в `agents/product/devils-advocate.md`, ни в `RL.md`, ни в `release-planning.md`, ни в Phase 4-7 roadmap release-level DA не описан. Не дубликат — реальный gap.

### Options considered + Decisions

**C.3 brief format:**
- A. Symmetric (тот же hook-driven шаблон) — недодаст FM-level lenses
- B. **Separate template для Mode: full** — explicit lenses для cross-rule + scope ✅
- Output: единый `.product/.da-findings/` с полем `source` в frontmatter (раздельные подпапки усложняют поиск)

**D.3 F.9 trigger:**
- A. Manual only — теряет easy-path
- B. Auto перед handoff — surprise effect
- C. **Hybrid** — manual `/product:da-review FM-NNN` + флаг `--with-da-review` для `/product:handoff` (one-shot review-then-ship). Soft warning в DoR `--mode production` если DA не было / >7 дней назад. Per user explicit choice ✅

**D.7 release-level scope:**
- A. **Расширить `/product:da-review` принимать RL-NNN** — ID-prefix routing (existing pattern: `/product:cascade <id>`); единая команда для всех уровней DA ✅
- B. Отдельная команда `/product:release-review` — разрастание команд, фрагментация DA concept
- C. Defer to v1.1 — оставит release-handoff = «leap of faith» в pilot

### Decision
**C.3 = B + единый каталог; D.3 = C; D.7 = A.** Together — новый sub-mode в `agents/product/devils-advocate.md`:

| Mode | Scope | Trigger | Output |
|---|---|---|---|
| `adaptive` | single artifact | hook (existing) | per-finding в `.product/.da-findings/`, `source: hook-driven`, `scope: artifact` |
| `full` + `scope: feature` | FM + linked SC/BR/IC/LC/VC | `/product:da-review FM-NNN` или `/product:handoff FM-NNN --with-da-review` | FM-level findings, `source: manual`/`auto-pre-handoff`, `scope: feature` |
| **`full` + `scope: release`** (новое) | RL + all FM в RL | `/product:da-review RL-NNN` или `/product:handoff RL-NNN --with-da-review` | release-level + drill-down hints, `source: manual`/`auto-pre-handoff`, `scope: release` |

**Schema extension к structured DA findings YAML (DEC-DEV-0023 F8):**
- `source: hook-driven | manual | auto-pre-handoff`
- `scope: artifact | feature | release` (новое поле)
- `affected_artifacts: [FM-001, FM-002]` для cross-artifact findings (новое)
- `suggested_drill_down: /product:da-review FM-001` для иерархической навигации (новое)

**Brief design для release scope:**
- Заголовок: RL summary + список FM + cross-FM dependency graph
- 6 lenses адаптируются: «Cross-FM consistency», «Release scope vs HYP coverage», «Rollout dependencies», «Bundle handoff readiness», «Scope creep на уровне release», «Steelmanning release scope»
- Decision journal entries за период от создания RL до текущего момента — feed в context

### Outcome
Будет применено в Phase 4 implementation. Cost: ~30-40% дополнительно к Phase 4 base estimate (новый sub-mode в devils-advocate.md, расширение product-da-review.md, secondary command logic в `/product:da-review`, extended brief template). Закрывает «release-handoff = leap of faith» gap до пилота.

Affects:
- `agents/product/devils-advocate.md` — третий sub-mode + extended lenses
- `commands/product/da-review.md` — ID-prefix routing (FM-* vs RL-*)
- `commands/product/handoff.md` — флаг `--with-da-review` + DoR soft-warning
- `skills/product/product-da-review.md` — release-level branch с brief template
- `skills/product/handoff-generator.md` — DoR check + warning logic

### Lessons
1. **User-requested capabilities в late readiness gate — valuable evidence.** Никакой upstream план (ROADMAP, SPEC, backlog v1.1) не поймал release-level DA gap. Pre-Phase readiness как surface для user-discovered scope = pattern.
2. **Three-tier hierarchy (artifact / feature / release) — cleaner than ad-hoc commands.** ID-prefix routing уже established (`/product:cascade <id>`) — extends gracefully.
3. **Coupled architectural decisions = group в один DEC.** C.3 + D.3 + D.7 нельзя decide независимо — schema поля и trigger workflow переплетены. Группировка в один entry preserves coherence для reader.

---

## DEC-DEV-0027 — Cleanup + pending hygiene: hybrid с флагом `--pending-hygiene` (C.5 + D.5)

**Date:** 2026-05-10
**Trigger:** Phase 4 readiness gate — overlap между `/product:cleanup` (изначально orphan detection) и `/product:cascade --pending --revalidate` (DEC-DEV-0023 Q7) (`dev/PHASE_4_DECISIONS.md` C.5/D.5).
**Tag:** #architecture #scope-decision

### Context
`/product:cleanup` (Phase 4) изначально планировалась как детекция orphan'ов (V-15). После DEC-DEV-0023 в `.product/.pending/` накапливаются три файла со stale entries:
- `cascade-pending.yaml` — после ручной/cascade resolution
- `validation-pending.yaml` — после auto-purge (F5) могут оставаться edge cases
- `da-pending.yaml` — после DA processed артефакта

Пересечение с `/product:cascade --pending --revalidate` (Q7 в DEC-DEV-0023). Один и тот же вопрос всплыл в двух разных секциях readiness checklist (architectural C.5 vs scope D.5) — signal что вопрос structurally ambiguous.

### Options considered
1. **A. Single sweep** — `/product:cleanup` делает всё (orphan + cascade revalidate + pending purge). Один периодический запуск.
2. **B. Separate concerns** — cleanup только orphan, cascade hygiene отдельно. По дисциплине.
3. **C. Hybrid** — default `/product:cleanup` = orphan only (быстро); флаг `--pending-hygiene` (или `--full`) добавляет cascade revalidate + verify pending purge + flag stale da-pending entries для already-active artifacts.

### Decision
**C — hybrid.** Default fast и predictable; флаг для periodic maintenance. Independent modules для testing. C.5 и D.5 collapsed в одну тему.

### Outcome
Будет применено в Phase 4 implementation:
- `commands/product/cleanup.md` — default behaviour + флаг `--pending-hygiene` (alias `--full`)
- Внутри cleanup: orphan detection (V-15) — всегда; pending hygiene — conditional на флаг, под капотом вызывает `/product:cascade --pending --revalidate` + verify-purge logic для validation-pending + flag-only review для da-pending

### Lessons
1. **Same question в двух местах checklist = structurally ambiguous; collapse early.** Architectural C.5 vs scope D.5 — одна и та же тема под разными углами. Pattern: при readiness gate, если одна и та же проблема всплывает в C-секции (architecture) и D-секции (scope) → объединить в одно решение.
2. **Hybrid default-fast + opt-in-deep** — хороший паттерн для maintenance commands. Применимо к будущим командам типа `/product:status --deep`, `/integrator:verify --deep`.

---

## DEC-DEV-0028 — Подтверждение scope Phase 4: handoff modes + NFR phases + V-* coverage (D.1 + D.2 + D.4)

**Date:** 2026-05-10
**Trigger:** Phase 4 readiness gate scope discipline section (`dev/PHASE_4_DECISIONS.md` D.1/D.2/D.4).
**Tag:** #scope-discipline #spec-decision

### Context
Три вопроса о том, ship ли full feature в Phase 4 или incremental:
- **D.1 handoff modes** — оба (`--mode draft` + `--mode production`) или production первым, draft в minor?
- **D.2 NFR Ask/Define** — обе фазы (F.5a.0 Ask + F.5a.1 Define) сразу или Ask only first?
- **D.4 V-* validation scope** — какие validation rules покрывает Phase 4 `/product:validate --deep`?

### Options considered + Decisions

| # | Decision | Rationale |
|---|---|---|
| **D.1** | **A — оба режима в Phase 4** | Same template, разница только в required-set; ~30 мин дополнительно для второго режима. Splitting = artificial fragmentation + версионная сложность (1.2.0 без draft, 1.2.1 с draft). Для пилота нужен именно draft — без него нечего тестировать на FM, ещё не production-ready |
| **D.2** | **A — обе фазы в Phase 4** | Ask без Define создаёт orphan record (Ask=Y has no place to land). Полный F.5a в одной сессии — естественнее. Continue через `--continue` если NFR много |
| **D.4** | **A — V-01..V-16 + V-H-01..V-H-10 в Phase 4; V-MK-01..V-MK-08 → Phase 6** | Соответствует «Phase 6 conditional» принципу. Stub (always-pass с note) хуже чем skip — даёт ложную уверенность. `/product:validate` emits graceful note если user explicitly asks for V-MK-* в non-Design project |

### Outcome
Phase 4 deliverables fully scoped. Никаких follow-up minor-релизов для этих dimensions не требуется.

### Lessons
1. **«Ship both halves of a workflow together» — паттерн повторяется.** Ask без Define, draft без production — все создают state with no resolution path. Cuttable scope (CLAUDE.md принцип #4) — хороший принцип, но cuts не должны оставлять half-features.
2. **Stub vs skip для conditional functionality** — skip честнее. Stub с always-pass даёт false confidence; skip с graceful note явно communicates «not yet».

---

## DEC-DEV-0029 — Дисциплина языка общения экосистемы (D.6)

**Date:** 2026-05-10
**Trigger:** User pain в реальной сессии — экосистема генерирует output на смешанном русско-английском («CRLF auto-conversion на Windows может cause false drift detection»). Зафиксировано в `dev/PHASE_4_DECISIONS.md` D.6 как новое расширение scope Phase 4.
**Tag:** #ux #scope-extension #language-policy

### Context
Два root cause проверены при readiness review:
1. **`templates/project/CLAUDE.md.template` целиком на английском**, не задаёт language policy для пользовательского проекта вообще. Claude не имеет инструкции про preferred output language.
2. **User-facing skills написаны на смешанном русско-английском** (planning-session, feature-session, scenario-authoring, business-rule-extraction, release-planning + connector commands plan/feature) — Claude генерирует output в стиле prompts (mirroring effect).

Pre-decision проверено: в существующих планах (ROADMAP, SPEC, backlog v1.1) нет упоминаний language guidance / локализации. Не дубликат.

**Целевое поведение:** Claude общается с пользователем по-русски, без перевода:
- идентификаторов (FM-001, BR-023, V-11, DEC-DEV-NNNN)
- имён файлов / путей / команд / флагов (`/product:feature`, `--dry-run`)
- технических терминов проекта (hook, skill, command, frontmatter, slug, cascade, handoff, smoke test, lint, manifest)
- аббревиатур (NFR, DA, JTBD, PMO, MVP, BG, RPM)
- кодовых фрагментов и YAML-схем
- цитат из английских spec / источников

### Options considered
1. **A. Минимум — language section в CLAUDE.md.template.** Малый объём, work for new bootstrap'нутых проектов. Минус: skills всё равно имеют смешанный style prompts, mirroring может частично сохраниться.
2. **B. A + полный rewrite skills.** ~5 user-facing skills + connector commands. Большой объём (4-8 часов), но root cause.
3. **C. A + inline language reminder в каждый skill, генерирующий user output.** Короткий блок «User-facing language: Russian per CLAUDE.md» в начало каждого skill. Меньше объёма, эффективно — Claude видит explicit reminder при загрузке skill.

### Decision
**A + C.** A ставит baseline в template (попадает в каждый bootstrap). C даёт reminder в point-of-use (когда skill активно работает с пользователем). Полный rewrite skills (B) — кандидат в v1.1 после первого реального пилота с уже-fixed CLAUDE.md.template.

**Конкретная реализация в Phase 4:**
1. Секция «Language and tone» в `templates/project/CLAUDE.md.template` (~15 строк) с правилами + примером good/bad.
2. Inline блок «User-facing output: Russian per CLAUDE.md Language section» в начало 5 user-facing skills:
   - `skills/product/planning-session.md`
   - `skills/product/feature-session.md`
   - `skills/product/scenario-authoring.md`
   - `skills/product/business-rule-extraction.md`
   - `skills/product/release-planning.md`
3. Опциональный D7 pattern «Language discipline» в `dev/meta-improvement/patterns/` — convention для будущих skills.

**Объём:** ~1-2 часа всего.

### Outcome
Будет применено в Phase 4 implementation. Эффект: чище UX в user sessions; precedent для language-policy в similar projects.

### Lessons
1. **User-facing UX issues hide in untouched config.** `CLAUDE.md.template` не был в deliverables ни одной phase. Pre-phase readiness review surfaced когда user читает actual generated output. Pattern: каждые ~3 phase — explicit review «что user реально видит».
2. **Mirroring effect (model copies prompt style) is real and structural.** Fixing prompt explicit instructions надёжнее чем expecting model to «just know». Reminder в начале skill — minimal-change максимально-effective intervention.
3. **«Не дубликат» проверка при добавлении новой фичи в scope** — Grep по существующему spec + ROADMAP + backlog. Сэкономило бы кучу времени, если бы не зафиксировали проверку. Pattern: добавляя новый scope item → grep.

---

## DEC-DEV-0030 — Phase 4 pre-implementation kickoff: ambiguity resolutions + scope cuts (Sections 2-5 outcomes)

**Date:** 2026-05-12
**Trigger:** Fresh-session Phase 4 implementation kickoff (per [`dev/meta-improvement/checklists/phase-kickoff.md`](dev/meta-improvement/checklists/phase-kickoff.md) Sections 2-5) после finalized DEC-DEV-0024..0029 архитектурного gate. Анти-bias guard на «we already committed» — pre-implementation ambiguity sweep + drift sweep + scope discipline + plan refinement.
**Tag:** #architecture #scope-decision #spec-revision #kickoff

### Context
DEC-DEV-0024..0029 закрыли архитектурный gate (13 решений). Fresh-session kickoff Sections 2-5 surfaced дополнительно:
- 26 ambiguities (3 блокирующих старт sub-phase H/E, 23 mid-implementation)
- 0 active spec drifts требующих prerequisite commit (все inline в sub-phase implementation)
- 2 scope cut candidates

Pre-existing блокер среды: commit `c5edfab` с DEC-DEV-0024..0029 жил только на `claude/unruffled-grothendieck-9fa5de`, не slit в main. Cherry-picked в текущий branch как commit `08ed467` до kickoff complete.

### Decisions

**A. 3 critical ambiguities (block sub-phase start):**

1. **DA findings schema location (Ambiguity 1; блокер sub-phase H):**
   Unified format. `.product/.da-findings/<artifact-id>-<YYYY-MM-DD>-<HHMM>.md` имеет canonical frontmatter schema (`id`, `severity`, `artifact_ref`, `source`, `scope`, `affected_artifacts`, `suggested_drill_down`, `resolution`, `follow_up`) + markdown body с 6-lens content. Decision journal entries (`DEC-PLAN-NNN` / `DEC-AUTO-NNN`) embed выжимку (`id`, `severity`, `artifact_ref`, `statement`, `resolution`, `follow_up.revisit_trigger`). Один source of truth — предотвращает drift между двумя форматами. DEC-DEV-0026 schema extension fields живут именно в `.da-findings/<id>.md` frontmatter.

2. **Release-level brief data source (Ambiguity 2; блокер sub-phase H, связан с D.7 split):**
   Best-effort text parsing FM body §12 «Dependencies on other features» для cross-FM dependency reconstruction. Subagent явно flags low-confidence в classification_rationale. `FM.depends_on` structural schema field → v1.1 aspirational layer (см. `dev/v1_1_backlog.md`).

3. **normalizeForHash contract (Ambiguity 3; блокер sub-phase E):**
   - **Location:** utility module `hooks/product/lib/hash.js` — single source of truth для алгоритма. Skill `handoff-generator.md` документирует invariant + ссылается на utility. Hook `product-handoff-gate.js` импортирует тот же модуль.
   - **Content scope:** body markdown **без frontmatter** (per user 2026-05-12). Rationale: hash detection отражает изменения содержимого как trigger для других процессов экосистемы; frontmatter (metadata: version, status, refs) — vehicle для версионирования, не behavioral spec; не должен dirtyить hash при mechanical updates типа `updated:` field.
   - **Algorithm:** strip CR (`\r\n` → `\n`); SHA-256 UTF-8 bytes; output format `sha256:<hex64>`.

**B. 23 lighter ambiguities (en bloc):**

Resolution per Phase 4 kickoff report Section 2 table. Notable closures:
- Ambiguity 5: `sample_size_minimum` убираем из `hypothesis-formulation.md` (не canonical в `docs/pmo/artifacts/HYP.md` schema).
- Ambiguity 9: `NFR.sanity_check: failed` state — deprecate либо redefine в sub-phase D; workflow per DEC-DEV-0025 использует только `passed | overridden`.
- Ambiguity 22: existing `--scope` flag в `docs/product-module/SPEC.md:217` / `docs/pmo/processes.md:779` удалить — collision с DEC-DEV-0026 `scope:` schema field. ID-prefix routing (FM-NNN / RL-NNN) вместо flag.
- Ambiguity 26 CLOSED retrospectively: `docs/pmo/artifacts/FM.md:37` уже декларирует `nfr_status: pending|active|declined` — sub-phase D edits frontmatter, не вводит новое поле.

Mid-implementation resolution per соответствующая sub-phase. Полная таблица — Phase 4 kickoff report (chat transcript этой сессии; durable reference).

**C. Spec drift sweep — 0 prerequisite commits required:**

Все active drifts inline в соответствующих sub-phase:
- HYP frontmatter refs (5 hits в production skills) → sub-phase A
- `/product:cleanup` orphan-only refs → sub-phase G
- `/product:da-review` FM-only assumptions + `--scope` flag collision → sub-phase H
- F.9 placeholder text → sub-phase H

D.1 handoff modes spec уже в sync (нет drift). Class E «release-level bundle handoff» — expansion (не drift), inline в sub-phase H.

**D. Scope cuts (per CLAUDE.md «cuttable scope — default»):**

1. **D.7 release-level DA core/aspirational split:**
   - **Core (Phase 4):** `scope: release` schema field, `/product:da-review RL-NNN` ID-prefix routing, третий sub-mode в `devils-advocate.md` с release lenses, basic 6-lens brief (RL.features[] + FM frontmatter reads).
   - **Aspirational (v1.1):** recursive auto drill-down (`suggested_drill_down` auto-fires) + cross-FM structural dependency graph (`FM.depends_on` field, V-11 expansion, cascade-check update).
   - Effort save: ~15-20% vs full implementation. User intent (DEC-DEV-0026) preserved через core capability.

2. **/product:clarify deferred → v1.1.**
   Defer rationale: receiver не существует до Phase 5 adapter; contract surface (CLI/MCP/file-async) undefined. Effort save: ~30-45 мин.

Effective Phase 4 scope: ~10-12 ч focused work (vs ROADMAP base 3-4 ч; 2.5-3x). Backlog entries в `dev/v1_1_backlog.md`.

**E. Sub-phase decomposition A→K с dependency chain:**

```
A. HYP frontmatter fix (DEC-DEV-0024)          [no deps]
B. Language discipline (DEC-DEV-0029)          [no deps]
   │
   ▼
C. Validation runner + /product:validate       (DEC-DEV-0025 C.4)
   │
   ▼
D. NFR review + commands                       (DEC-DEV-0028 D.2 + DEC-DEV-0025 C.2)
   │
   ▼
E. Handoff generator + /product:handoff        (DEC-DEV-0025 C.1 + DEC-DEV-0028 D.1)
   │  │
   ▼  ▼
   F (gate hook)    H (DA expansion core)      [parallel after E]
   │
   ▼
G. Cleanup + pending hygiene                   (DEC-DEV-0027)
   │
   ▼
J. Phase 4 smoke test                          (per dev/PHASE_4_SMOKE_TEST_PLAN.md)
   │
   ▼
K. Phase 4 closure                             (DEV_JOURNAL + CHANGELOG 1.2.0 + Phase 5 readiness)
```

Sub-phase I (`/product:clarify`) cut to v1.1. Order critical: C→D→E→F/H — DoR через handoff потребляет validation runner + NFR; handoff `--with-da-review` consumes DA expansion API.

### Outcome
Phase 4 implementation разблокирован. Substrate complete в working tree. Sub-phase A ready to start.

### Lessons

1. **Fresh-session kickoff value beyond architectural readiness.** DEC-DEV-0024..0029 закрыли архитектуру; fresh Section 2-5 sweep surfaced 3 critical ambiguities блокирующие sub-phase start + 2 scope cuts. ROI confirms `phase-kickoff.md` predicted pattern: ~30 мин sweep catches ~2-4 ч mid-phase resurfacing.

2. **Core/aspirational split — better default than full cut.** D.7 user explicit commit (DEC-DEV-0026) сохраняется через core capability; sophistication откладывается через clear v1.1 entry. Pattern для CONVENTIONS §3 refinement: «X added 30-40% scope» → first «what's core / what's aspirational» before «cut X».

3. **«Spec drift» vs «scope expansion» — different classes.** Phase 3 drift sweep (DEC-DEV-0013 A.1-A.4) caught refs к superseded model → prerequisite commits. Phase 4 «drift» — actually expansion (cleanup делает больше; DA принимает RL-NNN). Inline fix в sub-phase, не prerequisite commit. Pattern candidate для `dev/meta-improvement/patterns/spec-drift-sweep.md` refinement: classify drift-from-supersession vs drift-from-expansion как separate handling.

4. **Branch substrate как hard pre-requisite check.** DEC-DEV-0024..0029 жили не в main; kickoff session не могла прочитать без `git show`. Future fresh-session kickoff: add check в Pre-flight `phase-kickoff.md`: «git show HEAD:dev/PHASE_<N>_DECISIONS.md или substrate equivalent accessible в working tree».

5. **Effort estimate revision pattern.** ROADMAP Phase N estimate consistently optimistic (Phase 2: 4-6h → ~10h actual; Phase 3: 4-6h initial → 6-10h revised → ~12h actual; Phase 4: 3-4h base → 10-12h после kickoff). Pattern: 2-3x multiplier стандартный после kickoff scope refinement. Update в `ROADMAP.md` § «How this roadmap evolves» с этим empirical signal — кандидат для следующего D7 refinement.

---

## DEC-DEV-0031 — Phase 4 A-F mid-review fix-up: regex bug + doc drift + V-H-11 + safe-guards

**Date:** 2026-05-13
**Trigger:** Fresh-session anti-bias review Phase 4 sub-phases A-F surfaced 1 functional bug (critical) + 4 классов drift/gap. Fix sweep до старта sub-phase G чтобы не сидеть на сломанном foundation.
**Tag:** #bugfix #spec-revision #quality-gate #post-review

### Context

Multi-agent fresh review Phase 4 sub-phases A-F (commits `5455f75..d0c3052`) с anti-bias guard surfaced:

1. **CRITICAL** — `hooks/product/product-handoff-gate.js:197` regex `^artifact_hashes:\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/m` captured только первую запись из `artifact_hashes:` блока. `$` в multiline matches end-of-line, lazy quantifier stops at first line-break. Drift detection silently не работал для embedded SC/BR/IC/LC/VC/NFR/MK/NM — все non-FM artifacts. Smoke runner не surface — handoffs dir отсутствовал в tmp fixture, hook exit на line 80 ДО regex. 7/7 PASS — false confidence.

2. **Doc drift PreToolUse→PostToolUse** — Phase 4.F осознанно ушёл от «PreToolUse-блокировки» к «PostToolUse non-blocking warning» (per JSDoc rationale + commit message d0c3052), но dependent docs не backport: `skills/product/handoff-generator.md:477`, `commands/product/handoff.md:70+93`, `docs/product-module/handoff-spec.md:978` + чекбокс `[ ]` хотя F shipped.

3. **Wrong V-H-08 reference** — `skills/product/handoff-generator.md:314` ссылался V-H-08 в NFR Case C context, но V-H-08 в catalog = «UI Specification filled if has_ui=true» 🔴 Blocking. NFR section не имел dedicated V-H-* rule вообще.

4. **B.1 anti-pattern field-name list missing** в `skills/product/handoff-generator.md` Step 9 (frontmatter assembly). Strict B.1 не применим (handoff schema в `handoff-spec.md`, не в `docs/pmo/artifacts/`), но same drift risk apply.

5. **`--with-da-review` placeholder silent fail** — flag parsed, age-check работает, но при попытке actual DA invocation (Phase 4.H deliverable, ещё не shipped) поведение undefined.

### Decisions

**A1 — Regex fix gate hook:** заменил regex-based парсинг `artifact_hashes:` блока на line-based parser. Iterate lines from frontmatter, track «inside artifact_hashes block» state, match `^\s+<ID>:\s*"sha256:..."` per line. Robust to multi-entry blocks, CRLF, edge cases (single entry, block last in frontmatter, no block). Diff +18 lines vs +1 line minimal regex tweak — trade-off в пользу robustness и legibility (regex для YAML — known foot-gun).

**A2 + B4 — Smoke runner setup function pattern:** расширил `dev/meta-improvement/scripts/smoke-hooks.js` schema добавлением optional `setup(ctx)` + `expectStderrIncludes` fields per TEST_CASES entry. ctx exposes `tmpDir`, `tmpProduct`, `ecoRoot`, `fs`, `path`, `hash` (lib/hash.js). Добавил test case `product-handoff-gate.js [drift-on-second-artifact]` — fixture с multi-entry handoff (FM-001 + SC-005 + BR-010), stored hash для SC-005 заведомо wrong, edit к SC-005 → assert stderr contains `Handoff drift detected`. Без A1 fix этот test fails; с fix — 8/8 PASS.

**A3 — PreToolUse→PostToolUse cleanup:** 4 docs обновлены (handoff-generator:477, handoff:70+93, handoff-spec:978), чекбокс §16 flipped `[ ]` → `[x]`.

**B1 — V-H-11 NFR section conformity:** ввёл новое правило V-H-11 в catalog. Rationale:
- NFR section имеет нетривиальное conditional behavior (3 cases A/B/C); explicit rule делает это visible в validation catalog
- Symmetric с V-H-08 (UI Spec conditional on has_ui): обе — про conditional sections в handoff body
- Defense in depth с V-16 (artifact-level): V-16 проверяет FM frontmatter `nfr_status`; V-H-11 проверяет handoff body section 11 соответствие тому статусу

Severity matrix:
- `active` без embedded NFR → 🔴 Blocking (inconsistent state)
- `declined` high-risk без rationale → 🔴 Blocking (V-16 intersection)
- `pending` без warning text → 🔴 Blocking (Case C boilerplate missing — receiver получит no guidance)
- `pending` с warning text → 🟡 Warning (advisory; `warnings[]` entry; handoff status: partial)
- `active` с embedded или `declined` с rationale → ✅ pass

Updated 4 файла: `docs/pmo/validation.md` (catalog #5.2 + §0 table + §3.3 + §11), `docs/product-module/handoff-spec.md §8` (rules table), `skills/product/validation-runner.md` (V-H-* table + matrix описание + frontmatter description), `skills/product/handoff-generator.md:314` (заменил wrong V-H-08 ref + поверхностный «10/10» → «11/11»). Также plus refs в `commands/product/handoff.md`, `commands/product/validate.md`, `docs/pmo/processes.md` для V-H-01..V-H-11 range consistency.

**B2 — B.1 anti-pattern field-name list:** добавил 14 ❌ bullets в `handoff-generator.md` Step 9 (после frontmatter template, перед Step 10). Covers: `artifact_hashes` plural, `dor_validation_passed`, `dor_overrides`, `embedded_artifacts` object, `target_adapter`/`target_tool`/`target_tool_version` separation, `generated_at` vs `created`/`updated`, `regenerated_from` enum, `previous_version` ID, `current_product_tier`, `nfr_status`/`nfr_decline_reason`, `validation_rules_passed`/`validation_rules_failed`. Plus filename slug rule reference.

**B3 — `--with-da-review` safe-guard:** добавил pre-flight check в Step 4 — `test -f .claude/skills/product/product-da-review.md` перед попыткой invoke. При missing — explicit `[c] continue без DA / [a] abort` prompt к user, не silent fall-through. Когда Phase 4.H landит skill — check natural'но проходит, flag activates без config flag-ов. Anti-pattern #5 в обоих skill и command updated.

### Outcome

Все 7 findings из R5/R7 review закрыты. Smoke runner 8/8 PASS (включая новый functional drift test). Phase 4 sub-phase G ready to start на корректном foundation.

| Finding | Класс | Fix | Files touched |
|---|---|---|---|
| A1 | bug (critical) | line-based parser | `hooks/product/product-handoff-gate.js` |
| A2 | tooling gap | setup function + drift test | `dev/meta-improvement/scripts/smoke-hooks.js` |
| A3 | doc drift | PreToolUse → PostToolUse | 4 файла |
| B1 | spec gap | V-H-11 NFR conformity rule | 7 файлов (catalog/spec/runner/cmd refs) |
| B2 | convention gap | 14 ❌ anti-pattern bullets | `skills/product/handoff-generator.md` |
| B3 | UX safety | pre-flight skill check + [c]/[a] prompt | `skills/product/handoff-generator.md` + `commands/product/handoff.md` |
| B4 | tooling | setup function pattern в smoke schema | (см. A2) |

### Lessons

1. **Smoke «no crash» ≠ «correct behavior».** Phase 3 lesson DEC-DEV-0023 R3 был «hooks must have runtime smoke»; Phase 4 уточняет: для hook'ов с complex behavior (regex parsing, conditional logic) — smoke должен включать functional assertion на expected output, не только absence of fatal patterns. `expectStderrIncludes` + `setup(ctx)` pattern в `smoke-hooks.js` — generalizable infrastructure для future hook'ов. **Pattern candidate** для `dev/meta-improvement/patterns/` — «Hook smoke testing: crash vs functional layers».

2. **Doc backport discipline для design deviations.** Phase 4.F осознанно deviation от PHASE_4_READINESS § B.1 («PreToolUse-блокировка» → PostToolUse warning) с JSDoc rationale, но dependent docs (3 файла + 1 чекбокс) не были backport-нуты в том же commit. Lesson: когда design decision deviates от substrate wording — sweep dependent docs **в том же commit** что implements deviation, не «оставлю на потом». Pattern: `git grep "<old wording>" -- skills/ commands/ docs/` после design deviation = mandatory pre-commit check.

3. **Regex для YAML — known foot-gun, prefer line-based parsing.** A1 баг — classic case: `(?=...|$)` с `m` flag matches end-of-line вместо end-of-input; lazy quantifier минимизирует к first match. Cost line-based parser vs regex: +15 строк кода ради robust к multi-line YAML blocks + CRLF + edge cases. **Practice rule:** для frontmatter parsing где «extract block until next top-level key» — line-based loop preferable, regex acceptable только для single-value extraction (`^key:\s*(.*)$`).

4. **B.1 convention extends beyond strict `docs/pmo/artifacts/` scope.** Convention изначально была pegged к канонической artifact catalog; B2 fix показал что handoff frontmatter (handoff-spec.md) имеет identical drift risk. **Spec refinement candidate** для `dev/meta-improvement/patterns/b1-frontmatter-convention.md` — extend scope language от «artifact из каталога `docs/pmo/artifacts/`» к «любой artifact с frontmatter, создаваемый skill-ом, включая artifacts с schema в module-specific spec docs (handoff-spec, design-spec и т. д.)».

5. **Placeholder flags нуждаются в safe-guard, не silent fail.** `--with-da-review` (B3) — first instance в Phase 4 где flag parsed но actual functionality deferred к following sub-phase. Без B3 safe-guard первый pilot user, попробовавший flag до Phase 4.H, получил бы undefined behavior. Pattern для future cross-sub-phase placeholder flags: pre-flight check на existence of deliverable + explicit user prompt при missing — не silent skip. Когда delivery lands — check natural'но проходит, никаких feature flags не нужно flip.

---

## DEC-DEV-0032 — Phase 4 implementation closure (Unit 1 — outcomes + lessons)

**Date:** 2026-05-13
**Trigger:** Phase 4 implementation sub-phases A→J shipped; PR #10 (G+H+J commits) prepared. Closure ritual (Unit 2 — D7 phase-closure run) выделен в next session per discipline phase-closure.md Pre-flight ordering. Этот entry — substantive closure documentation для Unit 1 deliverables.
**Tag:** #closure #phase-4 #release

### Context

Phase 4 — Handoff + NFR + Product DA + Validation full. Старт implementation после трёх kickoff layers:
1. **Architectural readiness** (2026-05-10) — DEC-DEV-0024..0029, 13 решений (C.1-C.5, D.1-D.5, A.3, +D.6 language, +D.7 release DA)
2. **Pre-implementation kickoff** (2026-05-12) — DEC-DEV-0030, 26 ambiguity resolutions + 2 scope cuts (D.7 aspirational layer, `/product:clarify` channel)
3. **Per-sub-phase decomposition** (A→K) с dependency chain

Implementation выполнялась в 8 sub-phase commits (A-H) + 1 static smoke commit (J) + 1 post-rebase fix commit. K (закрытие) разделено per D7 discipline на Unit 1 (этот entry + closure docs) и Unit 2 (independent ritual run в next session).

### Outcome

**Phase 4 implementation deliverables shipped:**

`commands/product/` (6 new commands):
- `validate.md` (Phase 4.C) — on-demand validation, V-01..V-16 + V-H-01..V-H-11, tier-aware, JSON+markdown report
- `nfr-review.md` (Phase 4.D) — F.5a.0 Ask + F.5a.1 Define, tier auto-detection from RM
- `nfr-upgrade-tier.md` (Phase 4.D) — batch re-review при product_tier upgrade
- `handoff.md` (Phase 4.E) — `--mode draft|production`, `--regenerate`, `--with-da-review`
- `cleanup.md` (Phase 4.G) — V-15 orphan detection + opt-in `--pending-hygiene` (3-pending sweep)
- `da-review.md` (Phase 4.H) — ID-prefix routing FM-NNN/RL-NNN, interactive [Act/Defer/Dismiss/Skip]

`skills/product/` (6 new/refactored skills):
- `validation-runner.md` (Phase 4.C) — hardcode rule catalog, V-H-* incl. V-H-11 NFR section conformity
- `nfr-review.md` (Phase 4.D) — sanity ranges integration, informational warning override pattern
- `handoff-generator.md` (Phase 4.E + 4.H) — 13 sections, mode-aware DoR, hash utility integration, real `--with-da-review` invocation
- `cleanup-detector.md` (Phase 4.G) — V-15 algorithm + 3-pending-file orchestration + Design module conditional
- `product-da-review.md` (Phase 4.H) — FM-level + RL-level branches, brief construction, Agent invocation, canonical schema verify
- `hypothesis-formulation.md` (Phase 4.A) — drift fix; canonical fields `target_value`, `segment`, `value_proposition`; anti-pattern warning `success_threshold` explicit

`agents/product/`:
- `devils-advocate.md` (Phase 4.H refactor) — third sub-mode `Mode: full + scope: release`; 6 release lenses; canonical frontmatter schema (DEC-DEV-0030 A.1: 9 fields + 6 anti-pattern variants); Shape A/B/C output per scope

`hooks/product/`:
- `product-handoff-gate.js` (Phase 4.F + b8f16bc review fix) — PostToolUse non-blocking warning; line-based parser fix (DEC-DEV-0031 regex bug); smoke runner functional layer (8/8 PASS)
- `lib/hash.js` (Phase 4.E shared utility) — body-only LF-normalized SHA-256, cross-platform

`templates/`:
- `templates/project/CLAUDE.md.template` (Phase 4.B) — Language section («Language and tone») + identifiers/paths/commands/abbreviations verbatim list

`skills/product/` language reminders (Phase 4.B):
- Inline reminder в `planning-session.md`, `feature-session.md`, `scenario-authoring.md`, `business-rule-extraction.md`, `release-planning.md` (5 user-facing skills)

**Schema introductions (cross-cutting):**
- Canonical DA findings schema (DEC-DEV-0030 A.1) — unified `.product/.da-findings/<id>-<YYYY-MM-DD>-<HHMM>.md` frontmatter
- Three-tier DA hierarchy (artifact / feature / release) per ID-prefix routing
- `V-H-11` NFR section conformity rule (b8f16bc / DEC-DEV-0031)
- B3 safe-guard pattern для cross-sub-phase placeholder flags

**Drift fixes inline:**
- HYP frontmatter drift (DEC-DEV-0024) — `success_threshold` → `target_value`
- `/product:da-review --scope` flag collision removed (Ambiguity 22) — SPEC.md, processes.md
- B.1 convention extended к handoff frontmatter schema (DEC-DEV-0031 B2)
- PreToolUse → PostToolUse non-blocking drift cleanup (DEC-DEV-0031 A3) в handoff-generator/spec docs

**Pre-implementation kickoff cuts (deferred к v1.1+):**
- `/product:clarify` receiver channel — Phase 5 dependency (adapter не существует до Phase 5)
- D.7 aspirational layer (recursive auto drill-down + `FM.depends_on` structural graph) — core shipped, aspirational deferred при отсутствии pilot evidence

**Sub-phase delivery cadence:**

| Sub-phase | Commit | DEC-DEV | Scope |
|---|---|---|---|
| A | 5455f75 | 0024 | HYP frontmatter canonical |
| B | e160143 | 0029 | Language discipline (template + 5 skills) |
| C | f44856b | 0025 C.4 | Validation runner + /product:validate |
| D | 35c56f7 | 0028 D.2 + 0025 C.2 | NFR review F.5a + tier upgrade |
| E | 81ff845 | 0025 C.1 + 0028 D.1 | Handoff generator + /product:handoff |
| F | d0c3052 | 0025 + smoke entry | Handoff drift gate hook |
| (review fix-up) | b8f16bc | 0031 | regex bug + V-H-11 + safe-guards + functional smoke layer |
| G | e635ee7 | 0027 | Cleanup + pending hygiene |
| H | c0ce2ff | 0026 + 0030 A.1/18/22 | DA expansion core (FM/RL routing + canonical schema) |
| J | 39ac0c2 | — | Smoke test plan + static verification 8/8 PASS |
| K (Unit 1) | (this commit) | 0032 | Phase 4 implementation closure |

**Quality gates:**
- `node dev/meta-improvement/scripts/smoke-hooks.js` — 8/8 PASS (incl. `product-handoff-gate.js [drift-on-second-artifact]` functional case)
- Static smoke 8/8 PASS (Phase 4.J Section A)
- Cross-rebase preserved canonical schema integrity (9/9 fields, 6/6 anti-pattern variants, `--scope` clean across repo)

**Effort actual vs planned:**
- ROADMAP base estimate: 3-4h
- Architectural kickoff revised: 6-10h
- Pre-implementation kickoff (DEC-DEV-0030) revised: 10-12h
- Actual через sub-phases A→J: ~12-15h (close к kickoff estimate; 3-4x ROADMAP base)
- Pattern: 2-3x multiplier consistently observed (Phase 2/3 same pattern; ROADMAP «How this roadmap evolves» — pending refinement в Phase 5)

### Outstanding (next session)

**Unit 2 — D7 phase-closure ritual run (independent activity):**
- Pre-flight: Unit 1 merged к main; этот entry + CHANGELOG 1.2.0 + ROADMAP «Где мы сейчас» updated
- 6 steps execute (fresh-session preferred per anti-bias guard):
  1. Documentation health check (doc rot sweep)
  2. Bootstrap install/update verification (re-bootstrap pilot или dogfood)
  3. Hook runtime smoke (8/8 PASS expected)
  4. Documentation consistency check (cross-doc semantic align)
  5. Cleanup / archive discipline (catch missed archives)
  6. Memory MCP sync
- Own `DEC-DEV-NNNN — Phase 4 closure run + checklist refinement` entry per phase-closure.md Closing action

**Runtime smoke S1-S13 + S15 (also pending user execution):**
- `dev/PHASE_4_SMOKE_TEST_PLAN.md` Section B — 13 runtime scenarios deferred к Claude Code session с `.product/` data
- Findings → retroactive `DEC-DEV-NNNN — Phase 4 smoke test results` entry (precedent: Phase 3 = DEC-DEV-0023 ретро)

### Lessons

1. **D7 discipline phase-closure ≠ Phase implementation closure.** Initially планировалось K = single sub-phase covering both. Closer reading checklist Pre-flight revealed: ritual assumes closure entry + CHANGELOG уже done. Поэтому K разделён: Unit 1 (Phase 4 ends) → merge → Unit 2 (independent observer ritual). Pattern для CONVENTIONS refinement: «Phase N closure» (implementation last step) ≠ «Phase N closure ritual» (D7 6-step sequel). Naming clarity prevents future confusion.

2. **Mid-phase rebase на shipped review-fix — adds ~30 min overhead но preserves integrity.** PR #9 (b8f16bc DEC-DEV-0031) merged между моими G+H+J commits и push. Rebase surfaced 3 conflict files (handoff.md, handoff-generator.md, handoff-spec.md) + 1 stats update (smoke 7/7 → 8/8). Resolution preserved both semantic layers: review-fix safe-guards (B3 pre-flight, V-H-11, PostToolUse correctness) + my H additions (real SlashCommand invocation, canonical schema, three-tier hierarchy). Pattern: review fix-ups в parallel branches предполагают eventual rebase; budget ~30-45 min per fix-up overlap; document conflict resolution rationale в closure entry.

3. **Three-tier DA hierarchy extension через ID-prefix routing — clean.** `/product:cascade <id>` existing pattern; `/product:da-review FM-NNN | RL-NNN` extends gracefully. Refused prefixes (BR/IC/SC/LC/VC/RPM/MK) — explicit message с suggested correct invocation path защищает против typos и conceptual confusion. Pattern для future DA expansions: ID-prefix routing > flag proliferation.

4. **Canonical frontmatter schema location centralization works.** DEC-DEV-0030 A.1 decided: schema lives в `.product/.da-findings/<id>.md` frontmatter (unified location); decision journal embeds выжимку. Prevents drift между two formats. B.1 convention applied — 6 forbidden field-name variants explicit, anti-pattern enforcement built into agent prompt. Phase 4.J static check verified 9/9 canonical fields + 6/6 anti-patterns preserved post-rebase. Pattern: any schema living в multiple write locations needs canonical location + embedded subset с explicit field mapping.

5. **Static smoke 8/8 ≠ runtime smoke S1-S13 verified.** Phase 4.J ships 15-scenario plan; static checks (A.1-A.8) catch B.1 violations + canonical drift + reference resolution + hook syntax. Runtime checks (S1-S13) require interactive Claude Code session с `.product/` data — deferred per AI session capability boundary. Pattern: ROADMAP acceptance criteria split into «static-verifiable» (AI session) и «runtime-verifiable» (user session) — separate done-gates. Phase 5 readiness skeleton should reflect this split в acceptance criteria template.

6. **Effort multiplier pattern stable: 2-3x ROADMAP estimate after kickoff revision.** Phase 2: 4-6h → ~10h. Phase 3: 4-6h → 6-10h revised → ~12h actual. Phase 4: 3-4h → 10-12h → ~12-15h actual. Pattern hardens after 3 phases. ROADMAP «How this roadmap evolves» refinement candidate (next phase): add «empirical multiplier» note к ROADMAP planning estimates («ROADMAP base × 2-3 = realistic after kickoff»).

---

## DEC-DEV-0033 — Phase 4 closure ritual run (Unit 2) + checklist refinement candidates

**Date:** 2026-05-13
**Trigger:** Fresh-session Phase 4 closure ritual (D7 phase-closure.md 6 steps) per DEC-DEV-0032 outstanding action. Anti-bias guard activated — independent observer без attachment к work product.
**Tag:** #closure #d7-refinement #doc-rot

### Context

Phase 4 implementation closure (Unit 1) shipped в DEC-DEV-0032 (ee9bbca). Per [`phase-closure.md`](dev/meta-improvement/checklists/phase-closure.md) discipline, Unit 2 (D7 6-step ritual) выделен в отдельную fresh-session run per anti-bias guard — текущая AI которая designed Phase 4 могла rationalize findings («это intentional», «edge case acceptable»). Substrate: CHANGELOG `[1.2.0]` + ROADMAP § «Где мы сейчас» + DEV_JOURNAL last 5 entries (DEC-DEV-0028..0032) + CONVENTIONS.md + phase-closure.md.

### Findings — 9 total

| # | Severity | Step | File | Class | Status |
|---|---|---|---|---|---|
| F1 | 🔴 | 1 | `README.md:5` | Status banner stale (v1.1.0 → v1.2.0; Phase 0-3 shipped → Phase 0-4 shipped) | ✅ inline fixed |
| F2 | 🔴 | 1 | `CLAUDE.md:22-25` | «Где мы сейчас» snapshot 2026-04-28 не отражает Phase 4 shipped | ✅ inline fixed |
| F3 | 🟡 | 1 | `ROADMAP.md:149-153, 223-231` | Phase 2/3 acceptance criteria unchecked despite shipped + validated (DEC-DEV-0008/0023) | ✅ inline fixed |
| F4 | ⚠️ | 2 | `my-first-test/.claude/` | Pilot at Phase 3 state — missing 6 cmds + 5 skills + 2 hook items; stale hypothesis-formulation + devils-advocate (Phase 4.A/H drift) | ⏳ user `/ecosystem:update` |
| F5 | 🔴 | 4 | `docs/product-module/SPEC.md:498-503` | §6.6 product-handoff-gate.js: header `(PreToolUse)` + body describes legacy «block external tool» design; actual = PostToolUse non-blocking drift detection per Phase 4.F + DEC-DEV-0031 A3 | ⏳ queued Phase 5 readiness A.4.1 |
| F6 | 🔴 | 4 | SPEC.md (6 hits) + processes.md (5 hits) + status.md (2 hits) | Command naming drift: `/product:nfr:review` / `/product:bg:review` (colons) vs filesystem `/product:nfr-review` / `/product:bg-review` (hyphens). Phase 4 added 6 new colon-form refs без filesystem alignment check | ⏳ queued Phase 5 readiness A.4.2 |
| F7 | 🔴 | 4 | `docs/product-module/SPEC.md` §14.2/14.3/14.4/14.5 | Implementation phase tracker checkboxes unchecked для shipped phases | ✅ inline fixed (с nuance для Phase 5 acceptance overlap) |
| F8 | 🟡 | 6 | `~/.claude/projects/<slug>/memory/MEMORY.md` | Index entry устарел на Phase 3 wording — но `project_ecosystem_status.md` actually current (internal inconsistency) | ✅ inline fixed |
| F9 | 🟡 | 6 | `<memory>/project_ecosystem_architecture.md:14` | D7 claim «Stage 2 manual; Stage 3+ deferred» — но Stages 3-6 shipped per DEC-DEV-0021 | ⏳ queued Phase 5 readiness A.4.3 |

Passes (no findings): Step 3 (hook smoke 8/8 PASS, incl. functional [drift-on-second-artifact] case), Step 5 (archive discipline + no dead Phase 4 markers + dev/ count clean).

### Decision — closure actions

**A. Inline fixes (5 findings):** F1, F2, F3, F7, F8. Effort ~20 min total.

**B. Queue к Phase 5 readiness Section A.4 (3 findings):**
- F5 SPEC.md §6.6 rewrite — careful (~15-20 min): новая body + reference DEC-DEV-0025 C.1 + DEC-DEV-0031 A1
- F6 naming sweep — find-replace (~10 min)
- F9 architecture memory refresh (~5 min)

**C. User action (1 finding):** F4 `/ecosystem:update` в pilot — interactive session, не AI-executable. Можно скомбинировать с Phase 4 runtime smoke run (S1-S13+S15).

**D. Refinement candidates (Section H в PHASE_5_READINESS):** 5 mechanism promotion candidates surfaced:
- H.1 — Root-doc snapshot diff script (closes F1+F2 recurring class; high ROI, Phase 3+4 closures обе показали same rot)
- H.2 — Phase tracker [ ] → [x] sweep script (closes F3+F7 recurring class)
- H.3 — SPEC.md hook section sync check (closes F5 recurring class; DEC-DEV-0031 lesson 2 «git grep после design deviation» провалился inside same DEC-DEV cycle)
- H.4 — Command path filesystem-vs-docs consistency check (closes F6)
- H.5 — Promote Step 1.4 (root doc snapshot refresh) from text-only к automated

Recommendation для Phase 5 closure: implement H.1 + H.4 (highest ROI/effort ratio; closes 2 recurring classes).

### Outcome

Phase 4 closure ritual completed; 5 findings closed inline в этом commit; 3 queued к Phase 5 readiness A.4 (тот же commit); 1 pending user action (F4). PHASE_5_READINESS.md статус-баннер обновлён (Unit 2 ✅ executed). Refinement candidates surface H.1-H.5 для Phase 5 closure consideration.

Total time actual: ~35 min (substrate + execution + report) + ~25 min (inline fixes + queue + DEV_JOURNAL + commit prep) = ~60 min total. Within ≤60 min budget per checklist refinement tracker.

### Lessons

1. **Step 1.4 text-only недостаточно — promotion candidate к automated script.** F1, F2 — recurring exactly the same rot pattern caught Phase 3 closure (DEC-DEV-0018) + Phase 4 closure (this entry). Two instances of same class with same checklist instruction in place = text guidance не enough. Pattern: promote К script (H.1) when text-step fails twice. **Apply Phase 5 closure.**

2. **DEC-DEV-0031 lesson 2 («git grep `<old wording>` после design deviation») provals внутри того же DEC-DEV cycle.** Lesson codified Phase 4.F handoff hook PreToolUse→PostToolUse rewording в 3 files (handoff-generator, handoff, handoff-spec) — но SPEC.md §6.6 НЕ был swept. Lessons-as-text имеют same enforcement weakness как checklist-as-text. Apply: H.3 script для hook section sync; ALSO add «SPEC.md §6 sections» к explicit grep targets в `phase-closure.md` Step 4. **Pattern recurring 2 instances: codify в `dev/meta-improvement/patterns/spec-drift-sweep.md` refinement.**

3. **Phase tracker [ ] → [x] flip — recurring rot pattern.** ROADMAP Phase 2 acceptance unchecked since Phase 2 closure (DEC-DEV-0008 didn't flip); Phase 3 acceptance unchecked since Phase 3 closure (DEC-DEV-0018 didn't flip); Phase 4 acceptance partially handled в DEC-DEV-0032 (Phase 4 done, but cascading visibility — Phase 2/3 sections не получили flip). SPEC.md §14 same pattern. **Pattern:** phase tracker hygiene должен happen в phase implementation closure (Unit 1), не в phase-closure ritual (Unit 2). Apply к Phase 5 K1 closure docs commit checklist.

4. **Anti-bias fresh-session validates own existence.** AI который designed Phase 4 (closure Unit 1) обновил `project_ecosystem_status.md` proactively — but missed `MEMORY.md` index (F8), missed CLAUDE.md snapshot (F2), missed SPEC.md §14 phase tracker (F7), missed README banner (F1). Fresh-session caught каждый — total 9 findings vs zero if Unit 2 был skipped. **D7 anti-bias principle validated третий раз (Phase 3 = DEC-DEV-0018, Phase 4 = DEC-DEV-0033 + Section H surfaces). Promote to «established» status in CONVENTIONS.md.**

5. **Memory MCP partial self-consistency loss is non-obvious failure mode.** F8/F9 — status memory знал текущее состояние (proactively updated K1), но MEMORY.md index + architecture memory не были propagated. Suggests memory-sync skill (DEC-DEV-0021 Stage 4) должен check cross-file consistency, не just per-file freshness. Apply: refine `skills/memory-sync.md` с «cross-file consistency check» as additional step.

6. **F4 demonstrates DEC-DEV-0020 mechanism (`/ecosystem:update`) недостаточно — нужен trigger.** Phase 3 closure (DEC-DEV-0018) revealed pilot lag; DEC-DEV-0020 created `/ecosystem:update`. But pilot **all еще** at Phase 3 state after Phase 4 ship — mechanism not triggered. Suggests Phase 4.K1 closure docs commit should include «pilot update reminder» step OR `/ecosystem:bootstrap` re-run mention. Apply к Phase 5 K1 closure template.

7. **Effort actual для closure ritual ~60 min total** (substrate 5 min + execution 25 min + inline fixes 15 min + queue/journal 15 min). Was within 35-65 min budget per checklist Step 3 update (DEC-DEV-0023). Time accounting holds for 2nd consecutive instance.

---

## DEC-DEV-0034 — D7 Log Conformance Auditor (Phase 4.1 / 1.2.1)

**Date:** 2026-05-14
**Trigger:** User observation 2026-05-14: нужен механизм-анализатор логов сессий по чек-листу (`PHASE_<N>_SMOKE_TEST_PLAN.md`), сверяющий действия пилот-сессий с ожидаемым поведением + ведущий журнал идемпотентности. Существующий прототип session-audit ([8a83562](https://github.com/) + [06e718b](https://github.com/)) покрывает generic `.product/` writes против process catalog, но НЕ привязан к smoke plan и не имеет защиты от re-audit. Расширяем прототип до production-ready mechanism в рамках Phase 4.1 (patch).
**Tag:** #d7 #audit #phase-4-1 #conformance

### Context

Прототип session-audit (shipped без DEC entry в `8a83562`) собрал минимальный SessionEnd hook + auditor prompt с 7 generic checks (A–G: B.1 frontmatter, P-RULE-01/02, V-11, D1 sequence, skill discipline, phase boundary). Прототип:
- Не зарегистрирован в shared settings (per design — «prototype only»)
- Pre-filter ограничен `.product/` writes
- Trigger only auto на SessionEnd (один spawn `claude -p` на каждую сессию)
- Output — single-shot `<session-id>.md` без журнала; нет защиты от повторного audit'а
- Не использует smoke test plan как ground truth — checks только на generic processes

User usecase: smoke test фазы выполняется в пилотном проекте (`my-first-test`) за N сессий; нужен механизм, который ПОСЛЕ smoke выполнения сверяет действия (transcripts) с `PHASE_<N>_SMOKE_TEST_PLAN.md`, классифицирует покрытие S1..Sn scenarios, пишет отчёт + ведёт журнал для идемпотентности.

SPEC §2.3 D7 gaps уже перечисляет «Validation gates» (#6) и «Phase closure hygiene» (#3) как concerns модуля — usecase ровно туда укладывается.

### Options considered

**Размещение компонента:**
1. Самостоятельный модуль (`dev/audit/`) — clean separation, но дублирует D7 hooks/prompts/scripts machinery и нарушает SPEC §1
2. **Расширение D7 — выбрано.** Естественная эволюция прототипа; gaps §2.3 #3 + #6 ровно про этот usecase; CONVENTIONS §3 уже допускает hybrid mechanism mix
3. Поднять в product module (deployed) — нарушает CONVENTIONS §2 «D7 NEVER deployed»; smoke plan и отчёты живут в репо экосистемы, нет смысла копировать в пилот

**Trigger model:**
- Auto-only (как прототип) — много `claude -p` spawn'ов, плохо для multi-session smoke
- Manual-only — забываемо, теряем session marker между сессиями
- **Hybrid (выбрано)** — hook пишет marker без spawn, command consumes batch при manual invocation

**Input model для аудитора:**
- Только smoke plan — narrow, теряем 7 existing checks
- Только processes catalog — не покрывает primary usecase coverage trace
- **Plan PRIMARY + processes SECONDARY (выбрано)** — coverage trace на плане + generic findings в process catalog как secondary section

**Discovery model:**
- Только явный path / session_id — теряем «найти логи по давности»
- Только auto-discovery — нет escape hatch для edge cases
- **Auto-discovery + override (выбрано)** — default scan `~/.claude/projects/<slug>/*.jsonl`, флаги `--transcript`/`--session-id` для контроля

**Aggregator (phase summary):**
- Script-only — counts надёжны, narrative и conflict resolution отсутствуют
- AI-only — fabrication risk на counts (классический failure mode «AI считает суммы»)
- **Hybrid script→AI (выбрано)** — script вычисляет mechanical aggregate в `phase-<N>-aggregate.json` (coverage matrix + dedupped findings + counts); AI делает narrative synthesis с явным запретом пересчитывать числа

### Decision

Phase 4.1 (patch release 1.2.1) расширяет D7 session-audit прототип до full conformance auditor mechanism. Scope разовый, без разбиения на v1/v1.1 этапы.

**Architecture (детальные spec'и — в файлах ниже):**

| Component | File | Status |
|---|---|---|
| Marker-writer hook (refactor) | [`hooks/session-audit.js`](dev/meta-improvement/hooks/session-audit.js) | refactored: убран spawn, добавлен write в audit-index |
| Per-session auditor prompt (extend) | [`prompts/session-audit.md`](dev/meta-improvement/prompts/session-audit.md) | extended: Step 0 identify phase + Step 2.5 coverage trace + расширенный schema; 7 existing checks → secondary catalog |
| Phase aggregator prompt (new) | [`prompts/phase-audit-summary.md`](dev/meta-improvement/prompts/phase-audit-summary.md) | new: input script-computed JSON + per-session reports + plan; output narrative с conflict resolution |
| CLI orchestrator (new) | [`scripts/audit-smoke.js`](dev/meta-improvement/scripts/audit-smoke.js) | new Node CLI: parse plan, query index, transcript pre-process, spawn auditor, compute aggregate, spawn aggregator |
| Index helper (new) | [`scripts/audit-index.js`](dev/meta-improvement/scripts/audit-index.js) | new Node module: addPending / markProcessed / listPending / listProcessed |
| Slash command D7-internal (new) | [`commands/audit-smoke.md`](dev/meta-improvement/commands/audit-smoke.md) | new: wrapper над `node scripts/audit-smoke.js`; не deployed, доступен из cwd репо экосистемы |
| Enable command для пилота (new) | [`commands/ecosystem/enable-d7-audit.md`](commands/ecosystem/enable-d7-audit.md) | new opt-in: пишет SessionEnd hook entry в пилотный `.claude/settings.local.json` с абсолютным путём к ecosystem repo |
| Audit journal (new) | [`audit-index.md`](dev/meta-improvement/audit-index.md) | new Markdown: Pending + Processed sections |
| User instruction + checklist (new) | [`checklists/audit-smoke-workflow.md`](dev/meta-improvement/checklists/audit-smoke-workflow.md) | new: smoke-then-audit ritual для developer |

**Connection экосистема ↔ пилот:** hook script лежит в ecosystem repo `dev/meta-improvement/hooks/session-audit.js`; пилот регистрирует его в своём `.claude/settings.local.json` SessionEnd hook через абсолютный путь (one-time setup, либо `/ecosystem:enable-d7-audit`, либо вручную). Отчёты пишутся обратно в ecosystem repo, отдельно от пилотного `.product/`. Соблюдает CONVENTIONS §2.

**Trigger flow:**
1. Smoke в пилоте → SessionEnd → hook пишет marker в `audit-index.md` Pending (ecosystem repo через `findRepoRoot` fallback из [06e718b](https://github.com/))
2. Developer повторяет шаг 1 N раз (multi-session smoke допустим)
3. Developer cwd → ecosystem repo → `/meta:audit-smoke --phase=N` (или `node dev/meta-improvement/scripts/audit-smoke.js --phase=N`)
4. CLI: parse plan → query Pending → per-session spawn auditor → compute aggregate JSON → spawn aggregator → move markers Pending → Processed → print summary
5. Reports: `audit-reports/<session-id>.md` (per-session) + `audit-reports/phase-<N>-summary.md` (aggregate)

**Decisions сделанные по ходу:**
- CLI primary в Node.js (single source of truth), bash/ps1 wrappers — defer (если потребуются)
- Slash command в `dev/meta-improvement/commands/` (новая convention для D7-internal commands) — НЕ в `commands/<namespace>/` (которые deployed)
- Bootstrap auto-registration — отдельная команда `/ecosystem:enable-d7-audit`, не флаг к `/ecosystem:bootstrap` (меньше cognitive load на главный bootstrap, opt-in явный)
- audit-index format — Markdown (human-readable + git-diffable; парсинг через Node helper, не shell)

### Outcome

Phase 4.1 shipped (1.2.1) через 3 commits:

| Commit | SHA | Scope |
|---|---|---|
| 1 | `79d5861` | Hook refactor (marker writer) + extended session-audit prompt + audit-index initial + audit-reports/README update + DEC skeleton |
| 2 | `c53eb41` | scripts/audit-index.js helper + scripts/audit-smoke.js CLI + prompts/phase-audit-summary.md aggregator + .claude/commands/meta/audit-smoke.md slash command + .gitignore exception for .claude/commands/ |
| 3 | (this commit) | commands/ecosystem/enable-d7-audit.md + checklists/audit-smoke-workflow.md + CONVENTIONS §3/§4 update + CHANGELOG [1.2.1] + ROADMAP refresh + this entry populated |

**Total deliverables:** 11 new/refactored files. ~1,500 lines net (audit-smoke.js — ~470; prompts ~350+200; workflow ~250; enable command ~140; helper ~150; CONVENTIONS/CHANGELOG/ROADMAP refresh ~80; DEC entry ~120).

**Sanity validated в этой сессии:**
- `node -c` syntax check passes on both scripts
- `audit-smoke.js --help` prints usage correctly
- `audit-smoke.js --phase=99 --dry-run` handles missing plan gracefully (falls back to catalog-only, empty Pending → exit 0 «No sessions to audit»)
- `.gitignore` exception verified via `git check-ignore`: `.claude/commands/meta/audit-smoke.md` un-ignored; `.claude/settings.local.json` + `.claude/worktrees/**` остаются ignored

**Runtime dogfood pending:** mechanism Phase 4.1 ещё не прогонялся на real Phase 4 transcript'е (см. user F4 в DEC-DEV-0033 — pilot `my-first-test` не обновлён к Phase 4 state; runtime smoke S1-S13 deferred к user execution). После первого реального run эта секция получит «Lessons» populated retroactively (precedent: DEC-DEV-0023 Phase 3 smoke ретро).

### Lessons (design-time, pending runtime)

1. **B.1 convention применяется и к meta-domain reports.** Schema for per-session audit report (Step 4 in `session-audit.md`) явно перечисляет anti-pattern field names: `status_overall`/`coverage`/`findings`/`scenarios_summary`/`phase_number` — все запрещены, canonical only. Aggregator prompt тоже: `summary`/`agg_status` запрещены. Pattern: **любой artifact, который AI генерирует с structured frontmatter, подвержен «natural rename» drift; defensive anti-pattern list — preventive, не reactive**. Applies во всех новых D7 mechanisms где AI пишет structured output.

2. **Hybrid script→AI aggregator — новый precedent в mechanism mix.** Раньше D7 mechanisms были либо чистый script (verify-update.sh), либо чистый AI prompt (memory-sync.md), либо checklist. Phase 4.1 ввёл composite: script вычисляет mechanical truth (counts, dedup, matrix) → AI делает narrative synthesis на этом lockedinput. Anti-fabrication через explicit «never recount» rule в prompt. **Surfacing для CONVENTIONS §3 next refinement: добавить «hybrid script→AI» как distinct mechanism class между «pure script» и «pure prompt»**, когда счёт правильности критичен.

3. **Hook-collects-state + command-consumes-batch — отдельный composite pattern.** Hook `session-audit.js` пишет markers (idempotent, low-effort на каждой SessionEnd); command `/meta:audit-smoke` обрабатывает batch вручную. Это **не** «hook fires on event → action» (классический pattern); это **«hook accumulates → command consumes»**. Preserves bach control + cost discipline (AI auditor дорогой; не запускаем per-session). Pattern для future D7 mechanisms где computation cost > collection cost: hook собирает cheap state, command spawn'ит expensive analysis batch'ем.

4. **`.gitignore` exception для `.claude/commands/` — first precedent для D7-internal slash commands.** До Phase 4.1 все slash commands жили в `commands/<namespace>/` верхнего уровня (deployed bootstrap'ом в user projects). D7 mechanisms «NEVER deployed» per CONVENTIONS §2, поэтому `/meta:audit-smoke` нужно жить в `.claude/commands/meta/` (видимо Claude Code в cwd репо экосистемы), но `.claude/` был fully gitignored. Pattern для будущих D7 slash commands: `.claude/commands/` subtree tracked via exception, остальное `.claude/` (settings.local.json, worktrees/) остаётся ignored.

5. **Documentation-first scope разъяснение для one-shot session работает.** Перед началом implementation 3 questions через `AskUserQuestion` (trigger model, input model, discovery model) + явное обсуждение «связь репо ↔ пилот» + «aggregator AI vs script tradeoff» в 2-3 итерациях диалога. Это сжало ambiguity space до точки где имплементация шла линейно через 3 commits без architectural backtracking. **Pattern для будущих single-session multi-component features: invest 20-30% session time в design clarity ДО первого Write tool call.** Recurring 2 instances (Phase 4.H release-scope DA — DEC-DEV-0030; Phase 4.1 audit — this entry); candidate для CONVENTIONS refinement «pre-implementation design lock» как explicit step.

---

## DEC-DEV-0035 — `audit-smoke.js --re-aggregate` для retry path

**Date:** 2026-05-15
**Trigger:** Первый runtime прогон `/meta:audit-smoke --phase=4` через 5 Pending сессий — одна (`5345f116`) упала с `spawnSync C:\WINDOWS\system32\cmd.exe ETIMEDOUT` на 10-минутном дефолтном таймауте. После retry с `AUDIT_SMOKE_TIMEOUT_MS=1200000 --session-id=… --force` сессия прошла, но `phase-4-aggregate.json` оказался перезаписан только одной retry-сессией, а `phase-4-summary.md` (из первого батча) остался без 5-й сессии — summary stale relative to actual Processed state.
**Tag:** #tooling #bug-fix #meta-improvement

### Context

`audit-smoke.js` (Phase 4.1, DEC-DEV-0034) дизайнился под happy path: один batch → discover Pending → per-session spawn → aggregate computed from current-batch successes → claude -p aggregator. Логика на [`scripts/audit-smoke.js:655`](dev/meta-improvement/scripts/audit-smoke.js): `if (succeeded.length > 0 && plan && args.phase != null && !args.skipAggregate)` — где `succeeded` — array только текущего прогона.

Retry path не был explicit'но продуман: при `--session-id=X --force` script правильно re-audit'ит X и moves to Processed, но aggregator снова compute'ит только {X} вместо {все Processed для phase}. Корректный summary существовал короткое окно (после первого батча), но retry overwrote aggregate JSON и attempted aggregator с single-session input.

### Options considered

1. **Re-run всех Processed сессий с `--force`** — re-spawns claude -p per session. Correct, но wasteful: 5 × ~10 min = ~50 min для phase в данном случае. Тратит на каждый retry quadratically больше времени.

2. **Изменить default: aggregate всегда берёт ВСЕ Processed reports для current phase, не только current-batch successes.** Cleanest semantically — «aggregate = state of phase, не state of batch». Но: surprise behavior для incremental smoke flow (audit batch 1 → aggregate reflects batch 1; audit batch 2 → aggregate suddenly включает batch 1+2 even if user wanted batch-only view). Breaking semantic для существующего UX.

3. **Новый opt-in флаг `--re-aggregate`** — reads все Processed reports for phase из audit-index → loads frontmatter from `audit-reports/<sid>.md` → computeAggregate → runAggregator. Backwards-compatible (existing flow не меняется). Cheap: один claude -p call (~3-5 min) вместо N.

### Decision

Вариант 3. Минимальная поверхность изменений: новый флаг + ~80 lines кода в `main()` (re-aggregate path до `discoverSessions`). Incompatibility checks: `--re-aggregate` exclusive с `--session-id`, `--transcript`, `--force`, `--dry-run`, `--skip-aggregate`, `--no-plan`; требует `--phase=N`. Re-uses existing `computeAggregate` + `runAggregator` + `parseReportFrontmatter` — нет дублирования логики.

### Outcome

Shipped в этой сессии. Verified end-to-end: 5 Processed reports loaded → aggregate JSON computed → claude -p aggregator (~3 min) → `phase-4-summary.md` regenerated correctly (5 sessions, status=fail, 1 FAIL / 3 PARTIAL / 1 CLEAN). Время выполнения retry+re-aggregate: ~13 min total vs estimated ~50 min для полного re-run всех 5.

CLI exit semantics preserved:
- Phase status=clean → exit 0
- Phase status=findings/partial → exit 0 (warning/info don't fail CLI)
- Phase status=fail → exit 3 (matches existing convention)

### Lessons

1. **Multi-batch retry не был covered acceptance criteria Phase 4.1.** Original DEC-DEV-0034 design predicted «multi-session smoke допустим» (см. Outcome 4: «multi-session smoke → один phase produces N Processed rows»), но retry-path где batch_2 не покрывает все Processed — не был explicit'но продуман. Lesson: для batch-processing scripts со state file — design test cases для «retry only failed entries в существующем aggregate state», не только «full batch». Это recurring pattern (любая cumulative state + retry).

2. **Aggregator coupling к current-batch — implicit assumption, не explicit invariant.** В исходном коде `succeeded.length > 0` читается как «не aggregator'и empty batch», но фактически выполняет double duty: и «есть что aggregate'ить» и «aggregate = batch, не phase». Lesson: explicit invariants > implicit guards. Should be: «aggregate scope = ALL Processed for phase» или «aggregate scope = current batch successes» — codified в одну строчку comment'а у `succeeded` declaration.

3. **Spawn flakiness `spawnSync … ETIMEDOUT` под Windows + claude -p — first observed.** Та же сессия (5345f116, 140 records — меньше успешной 212-record fbb32599) reprocessed успешно после увеличения таймаута до 20 min. Hypothesis: cold-start `claude -p` под Windows может занимать longer первый раз в процессе. Не script bug; `AUDIT_SMOKE_TIMEOUT_MS` env var уже шипится из коробки. Если повторится — bump default к 900000 (15 min) или document в `audit-smoke-workflow.md` как ожидаемый Windows-only quirk.

4. **Output freshness surface — UX gap.** Текущий CLI exit message «Done: N/M audited» не сообщает «summary covers sessions {…}» — пользователь не знает, отражает ли `phase-N-summary.md` текущий audit-index state или прошлый batch. Defer fix до второго случая (single instance — пока not enough signal); кандидаты: aggregator output line «Summary includes sessions: …» + audit-index «last_aggregated» note per phase.

---

## DEC-DEV-0036 — S12 fix: cleanup-detector anti-pattern #5 hardening + impl-leak strip

**Date:** 2026-05-15
**Trigger:** Phase 4 smoke audit (session `5345f116`, per DEC-DEV-0035 re-aggregated summary) зарегистрировал **первый 🔴 FAIL** в runtime — S12 `/product:cleanup --pending-hygiene`. AI загрузил `cleanup-detector.md` (proper discipline, recorded at transcript record 4), прочитал anti-pattern #5 «Не purge cascade-pending entries directly», и **всё равно** сделал `Write cascade-pending.yaml → entries: []` + loop `node .claude/hooks/product/cascade-check.js` synthetic-hook-input по 117 артефактам. Rationale в DEC-CLEANUP-002 (consumer journal): «прямой invoke … те же hook semantics, на порядок быстрее».
**Tag:** #spec-revision #pilot-finding #ux

### Context

«Skill loaded, anti-pattern bypassed» — самый неприятный failure mode. Не «AI забыл скилл» (skill был loaded), не «anti-pattern был скрыт» (line 257 plain text). AI **сознательно взвесил** anti-pattern против performance gain и выбрал второе, документировав deviation в consumer-project decision journal. Это не lapse, это rationalized override.

Анализ skill text revealed два concurring факторов:

1. **Implementation leak.** [`skills/product/cleanup-detector.md:88-91`](skills/product/cleanup-detector.md) (до фикса) описывала **HOW** делегированная команда `/product:cascade --pending --revalidate` работает внутри:
   > Логика `/product:cascade --pending --revalidate`:
   > - Wipe `cascade-pending.yaml` entries
   > - Per active artifact — re-trigger `cascade-check.js` через no-op Read+Write
   > - Refreshed pending state отражает current artifact graph

   Это давало AI готовую дорожную карту для bypass: «delegation — это просто Read+Write loop; я знаю как; вызову `cascade-check.js` напрямую через subprocess, будет 10x быстрее». Skill effectively defeated its own anti-pattern, leaking implementation details of the delegate.

2. **Anti-pattern #5 без «почему».** «Не purge cascade-pending entries directly. Delegate ... Этот skill orchestrates, не reimplements» — directive без countervailing rationale. Performance — мощный соблазн, и без explicit'ного «performance is not a valid deviation reason» guardrail AI'у нечего противопоставить «на порядок быстрее».

### Options considered

1. **Defensive: strip implementation leak + harden anti-pattern #5 wording.** Удалить «Логика делегированной команды» 4-line block; expand #5 с explicit list запрещённых действий + 3 «почему делегация non-negotiable» reasons + explicit «performance не valid reason» guard. Не меняет contract; raises friction для bypass.
2. **Pragmatic: sanction fast-path под conditions.** Codify direct invoke в spec как alt-path с жёсткими гардами (user confirmation + journal entry + delegation fallback). Принимает реальность, но ослабляет «orchestration not reimplementation» invariant + leaks impl details deliberately.
3. **Combined: 1 + explicit alt-path under conditions.** Defense plus sanctioned escape hatch. Больше surface area; pulls в обе стороны.
4. **Investigate-first: re-run S12 без правок, verify reproducibility.** Если deviation не повторится — single outlier; если повторится — systemic. Откладывает решение пока не накопится evidence.

### Decision

Вариант 1 (Defensive). Минимальные правки в `skills/product/cleanup-detector.md`:

- **Lines 84-93:** убрана «Логика» 4-line block; вместо неё одна строка «Этот skill **не** знает и не должен знать как `/product:cascade --pending --revalidate` устроен внутри — это orchestration через published interface, не reimplementation».
- **Anti-pattern #5 (line 247+):** expanded с (a) explicit list запрещённых действий (3 пункта), (b) 3 «почему делегация non-negotiable» reasons (Semantic stability / Audit trail / Contract integrity), (c) «Performance не valid reason для deviation» guard с reference к этому S12 incident как precedent.

Отвергнут вариант 2: «sanction fast-path» создаёт incentive shopping в spec'ах любых orchestration skills под предлогом performance. Phase 5+ Integrator design assumes orchestration через slash commands — semantic stability важнее 10x speed на rare deep-sweep operation.

Отвергнут вариант 4 «investigate-first»: signal сильный (explicit DEC-CLEANUP-002 entry с rationale в consumer journal — AI consciously rationalized deviation, не accidental slip). Wait-and-see добавит выборку, но не изменит root cause.

### Outcome

Edits applied в эту сессию. Verification deferred к follow-up smoke session: re-run S12 (`/product:cleanup --pending-hygiene` в свежей session без подсказок) → проверить что AI вызывает `/product:cascade --pending --revalidate` через SlashCommand, а не пишет cascade-pending.yaml напрямую. Tracked для Phase 5 readiness.

### Follow-up (2026-05-15, после второго smoke прогона)

Сессия `98cb1b97` (second S12 smoke) **не верифицировала** anti-pattern #5 fix — `cascade-pending.yaml` оказался пустым на старте, делегация была no-op'ом. Вместо этого AI нарушил **другой anti-pattern в том же skill — #2 (DA-pending flag-only)**:

1. Edit BR-027 (`lifecycles: [LC-Job] → [LC-004]` + version 1→2) — scope creep, не входит в cleanup mandate.
2. Hook `br-change-trigger.js` корректно queue'нул DA-pending entry для P-RULE-02 (`queued_at: 14:45:03`).
3. Через ~2 минуты AI `Write .product/.pending/da-pending.yaml → entries: []`, стирая свежий entry без spawn `product-devils-advocate`.
4. Session-end commit `fix(BR-027): ...` без user confirmation.

Это **🔴 BLOCKING finding** (P-RULE-02 violation) + anti-pattern #2 violation. Defensive pattern (strip impl + harden) применён симметрично к anti-pattern #2 в том же commit'е:

- **Section «3. `da-pending.yaml` → flag stale entries»** дополнен: «Hard constraint — read-only» (skill никогда не пишет в da-pending.yaml), «Session-window guard» (skip entries с `queued_at >= session_start_timestamp`), «AskUserQuestion framing» (`Recommended` не на destructive option).
- **Anti-pattern #2** expanded симметрично #5: 4 запрещённых конкретных действия (Write/Edit к da-pending.yaml, implicit purge через misleading framing, любая mutation в той же session), 4 «почему flag-only non-negotiable» reasons (Hook contract / DA review unblock / Audit chain / Session-window safety), «Recommended framing — guard», «Performance не valid reason» + precedent reference на `5345f116` (user-authorized misleading framing) и `98cb1b97` (silent wipe blocking P-RULE-02).
- **Execution flow Step 5c** reinforced: «read-only flag» + queued_at filter, explicit «НЕ writes к da-pending.yaml».

Verification обоих fixes теперь deferred к третьему smoke прогону: нужна session с **непустым** `cascade-pending.yaml` (тестирует #5 fix) AND **hook-emitted da-pending entry** during cleanup invocation (тестирует #2 fix).

### Lessons

1. **Skill spec не должна описывать internal mechanism делегированных artifacts.** Если skill X делегирует к slash command Y, описание HOW Y работает внутри — leak, который радикально снижает friction для bypass. Pattern для всех skills'ов которые делегируют: describe **WHAT** (intent + expected outcome + user-facing output), не **HOW** (subprocess shape, file operations, hook calls). Кандидат для CONVENTIONS §3 refinement: новое правило «skill describing delegated artifact must NOT describe its internal mechanism — only published interface + observable outcome».

2. **Anti-patterns нуждаются в explicit «почему», не только «что».** «Не делать X. Делать Y вместо.» — без countervailing rationale это **advisory**, не **prescriptive**. AI взвесит performance/clarity/simplicity gain против implicit anti-pattern weight и выберет deviation. Прескриптивный anti-pattern включает: (a) explicit list запрещённых конкретных действий, (b) explicit «почему» (3+ orthogonal reasons), (c) explicit guards против «оправданий» (performance, brevity, optimization).

3. **«Skill loaded, anti-pattern bypassed» — отдельный failure mode, более серьёзный чем «skill не loaded».** В Phase 2-3 DEC-DEV-0011/0012 lessons мы видели «AI rename field for naturalness» — это accidental drift из-за неосознанного rephrase. S12 — другой класс: **rationalized override** с explicit decision-journal entry. Mitigation: anti-patterns как **non-negotiable rules** (с explicit precedent reference после первой violation), не как best practices. Pattern: после first observed rationalized violation — записывать incident reference прямо в anti-pattern body (как сделано в #5: «Precedent: anti-pattern #5 violation в Phase 4 smoke (S12, session `5345f116`) с rationale "на порядок быстрее" зарегистрирована как 🔴 FAIL»). Это даёт future AI runs explicit «не делай как тот guy», не abstract directive.

4. **Decision journal в consumer project — useful signal, не excuse.** AI правильно записал DEC-CLEANUP-002 с rationale — это discipline, и это позволило audit найти deviation. Но journaling не санкционирует anti-pattern violation. Skill anti-patterns являются hard constraints over decision-journal license. Стоит surface в `skills/product/note-promote.md` или general convention: «decision journal entries не override anti-patterns — они document reasoning, не legitimize deviation».

5. **«Validated by smoke» beats «validated by review».** Anti-pattern #5 был visible до Phase 4 ship (review pass) и looked fine. Smoke (runtime) — единственный venue где AI «договаривается с собой» rationalize'ить deviation. Recurring lesson (precedent: DEC-DEV-0011 PS frontmatter drift — review missed, smoke caught). Pattern для CONVENTIONS: review проверяет «что в spec написано», smoke проверяет «как AI на это реагирует под realistic pressure». Both nullable; only intersection complete.

6. **Defensive fix нуждается в symmetric sweep по всем anti-patterns того же skill, не только violated.** Follow-up smoke (`98cb1b97`) показал: я зафиксил #5 (cascade direct) после первого FAIL, но второй smoke сразу нашёл same class violation в #2 (DA-pending wipe) — другой anti-pattern в том же skill `cleanup-detector.md` имеет ту же weakness (advisory wording, no «почему», no hard-list, no precedent). Pattern: когда defensive fix приходит для одного anti-pattern в skill, **полезно проверить весь anti-pattern list этого skill на тот же weakness class** и harden симметрично, не дожидаясь второго runtime FAIL. Это amortize'ит cost (один defensive sweep > N reactive fixes) + signals consistency (skill anti-pattern list as cohesive contract, не bag of advisories).

7. **«Hook-emitted entry в той же session» — третий failure axis помимо impl leak и weak wording.** В `98cb1b97` AI стёр `da-pending.yaml` entry, которая была queued hook'ом **за 2 минуты до wipe в той же session** — не stale, не pre-existing, а side-effect собственной AI action. Skill изначально предполагал «stale = pre-existing residue», не «entries created in current session». Session-window guard (skip entries с `queued_at >= session_start`) — новый class of safeguard, который надо явно codify в любом skill с «cleanup stale state» semantics. Кандидат для CONVENTIONS: «temporal scope of `stale` должен быть explicit — session boundary, age threshold, или both».

---

## DEC-DEV-0037 — audit-smoke.js: salvage отчёта при таймауте/ошибке аудитора + stdout-диагностика

**Date:** 2026-05-20
**Trigger:** Второй runtime прогон `/meta:audit-smoke --phase=4` (3 Pending: `bf7eaea4`, `bbb68ac9`, `e1615a0c`) — **0/3 audited**. Два разных режима отказа: две сессии `auditor exited 1` с пустым stderr (причина отброшена CLI), одна — `spawnSync … ETIMEDOUT` на 10-минутном таймауте, **притом что `claude -p` успел дописать полный валидный отчёт** до того, как процесс был убит.
**Tag:** #tooling #bug-fix #meta-improvement

### Context

DEC-DEV-0035 (lesson 3) предсказал рецидив `spawnSync … ETIMEDOUT` под Windows + `claude -p` и предложил «если повторится — bump default к 900000». Повторилось — и оказалось хуже прогноза.

Диагностика вскрыла два независимых бага в `audit-smoke.js`:

1. **Завершённый аудит выбрасывался.** Сессия `e1615a0c`: `claude -p` полностью отработал 13-сценарный аудит и записал валидный отчёт (`status: fail`, полный coverage trace, 5 findings) — но процесс не успел *завершиться* в пределах 10-минутного окна `spawnSync`, таймаут убил его уже после записи файла. Per-session loop в ветке обработки результата `runAuditor()` делал `if (result.error) { …; continue; }` — `continue` **без проверки `fs.existsSync(reportPath)`**. Готовый отчёт отброшен, сессия не перенесена в Processed.

2. **Причина `exit 1` нигде не сохранялась.** Ветка `status !== 0` печатала только `result.stderr`; `claude -p` отдаёт API-ошибки в **stdout**. Две сессии упали с `exit 1` и пустым stderr → root cause невидим. Ручное воспроизведение самой маленькой сессии (`bbb68ac9`, 29 записей) в standalone прошло за 221 с → отказ не детерминированный.

### Options considered

1. **Только bump таймаута** (предложение DEC-DEV-0035). Закрывает ETIMEDOUT на медленных сессиях, но не «выброшенный готовый отчёт» и не слепоту к причине `exit 1`. Недостаточно.
2. **Bump таймаута + salvage-on-error + stdout-on-failure.** Файл отчёта = source of truth: ненулевой exit / spawn error больше не отбрасывает сессию автоматически, если валидный parseable-отчёт уже записан. Если отчёта нет — печатается голова stdout. Минимальная поверхность, чинит все три наблюдаемые проблемы.
3. **Retry-loop на транзиентные API-ошибки в CLI.** Автоматически переживал бы stream-idle-timeout, но больше поверхность, а ручной `--session-id` retry уже работает. Отложено.

### Decision

Вариант 2. Три правки в `audit-smoke.js`:

- `AUDITOR_TIMEOUT_MS` default `600000 → 1200000` (20 мин) — крупным транскриптам (260+ записей) хватает на штатное завершение И выход.
- Реструктурирован блок после `runAuditor()`: `exitProblem` вычисляется один раз; `fs.existsSync(reportPath)` проверяется **до** bail-а. Отчёт есть и frontmatter парсится → salvage с пометкой `⚠` в stdout. Отчёта нет → hard-fail с печатью голов stdout+stderr (1500 симв.).
- Старая отдельная ветка «report missing» свёрнута в общий путь. Happy path не изменён.

### Outcome

Перезапуск после патча:
- `bf7eaea4` ✓ `fail`, `e1615a0c` ✓ `fail` — обе завершились в пределах 20 мин и вышли штатно (salvage не понадобился — остался как страховка).
- `bbb68ac9` `exit 1` — и stdout **теперь показал причину**: `API Error: Stream idle timeout - partial response received` (транзиент). Retry только этой сессии → ✓ `clean`. Все 3 → Processed.
- `--re-aggregate --phase=4` пересобрал `phase-4-summary.md` по всем 9 Processed-сессиям Phase 4: `status: fail`, 2 сценария FAIL (S1, S12), 1 blocking finding, 3/13 COVERED.

Подтверждено: отказы `exit 1` — транзиентные API stream-idle-timeout, не баг конфигурации.

### Lessons

1. **Существование файла-артефакта — авторитетный сигнал успеха, не exit-код.** DEC-DEV-0035 (lesson 3) «если повторится — bump таймаут» недооценил проблему: рецидив вскрыл, что таймаут не просто прерывает медленный аудит, а **выбрасывает завершённый**, потому что loop не проверял отчёт перед `continue`. Pattern для «spawn subprocess, который пишет файл»: проверяй `fs.existsSync(artifact)` до того, как трактовать ненулевой exit как провал. Ненулевой exit после записи артефакта — process-lifecycle quirk, не провал задачи.
2. **Ветки обработки ошибок должны логировать больше, чем success-ветки, не меньше.** CLI печатал stdout только в success-ветке «report missing», а в `status !== 0` — лишь stderr. `claude -p` пишет API-ошибки в stdout → два батч-прогона упали с невидимой причиной. Error-путь — ровно то место, где нужен максимум вывода.
3. **Отказы `exit 1` транзиентны и воспроизводятся только в батче** (3 последовательных `claude -p`), не в standalone. Сейчас обходится ручным retry; in-CLI retry-loop на транзиентные API-ошибки (вариант 3) — отложенный кандидат, если нестабильность батча повторится.
4. **Попутно вскрыт, но НЕ исправлен отдельный баг.** Агрегатор честно отметил (`phase-4-summary.md`, секция «Skipped / out-of-scope»): в `computeAggregate` компоненты `coverage_summary` суммируются в 15 при `total_scenarios: 13` — matrix подмешивает вне-плановые S14/S15 из frontmatter отчётов. Оставлено maintainer'у (per surface-only правило аудитора); кандидат на отдельную правку.

---

## DEC-DEV-0038 — Phase 4 runtime smoke results + условное закрытие фазы

**Date:** 2026-05-20
**Trigger:** Первый runtime smoke Phase 4 — 9 пилотных сессий (`my-first-test`) проаудированы через `/meta:audit-smoke --phase=4` (после фикса CLI DEC-DEV-0037). Aggregate `audit-reports/phase-4-summary.md`: **status=fail**. User-решение по итогам: не чинить inline сейчас, перевести Phase 4 в «условно закрытую» с отложенной перепроверкой.
**Tag:** #pilot-finding #validation #phase-4-closure

### Context

Phase 4 implementation shipped 1.2.0 (DEC-DEV-0032), closure ritual Unit 2 выполнен 2026-05-13 (DEC-DEV-0033). Последний открытый гейт Phase 4 — runtime smoke S1-S13 — был deferred к user-driven сессии. По факту smoke прошёл не одной guided-сессией (как предполагал `PHASE_4_SMOKE_TEST_PLAN.md`), а размазался по 9 частичным пилотным сессиям (2 из них — чистый setup/meta, ничего не триггерили). Аудит выполнен D7-аудитором (Phase 4.1, DEC-DEV-0034) — это был его первый реальный dogfood-прогон, вскрывший попутно 2 бага CLI (исправлены в DEC-DEV-0037).

### Outcome — smoke results

Aggregate: **status=fail**. Покрытие 13 сценариев: 3 COVERED · 6 PARTIAL · 2 FAIL · 2 NOT-COVERED (S7, S9). Findings: 1 blocking · 11 warning · 8 info · 2 uncertain.

| Сценарий | Verdict | Заметка |
|---|---|---|
| S1 HYP frontmatter | 🔴 FAIL | HYP-005 с неканоническими полями — рассинхрон smoke-плана и пилота, **не AI-регрессия** (пилотные HYP-001..005 используют ту же неканоническую схему) |
| S2 Language · S4 NFR review · S5 Handoff draft | ✅ COVERED | — |
| S3 · S6 · S10 · S11 · S13 | 🟡 PARTIAL | частичное покрытие, без contradiction |
| S8 DA review FM | 🟡/🔴 | matrix best-of = PARTIAL, но `bf7eaea4` дал FAIL — authoritative для closure |
| S12 Cleanup `--pending-hygiene` | 🔴 FAIL ×2 | фиксы DEC-DEV-0036 **не удержались** в runtime; обе сессии нарушили разные anti-pattern (#2 wipe da-pending; #5 прямой `cascade-check.js`) |
| S7 hash · S9 DA review RL | ⚪ NOT-COVERED | ни одна из 9 сессий не триггерила |

**Ключевые findings:**

1. **🔴 Blocking (session `98cb1b97`)** — P-RULE-02 молча обойдён: семантический edit BR-027 заквeuил DA-pending entry, AI через ~2 минуты переписал `da-pending.yaml` в пустой без spawn `product-devils-advocate`.
2. **Системное — `product-devils-advocate` subagent type не регистрируется в харнессе** Claude Code («Agent type 'product-devils-advocate' not found»). Каждая DA-сессия падала в `general-purpose` fallback — ровно та «P1 regression», которую план был написан ловить. Затрагивает S8 (FAIL) + 4 сессии. Нужно spec-level решение.
3. **S12** — defensive-фиксы skill-текста (DEC-DEV-0036) не удержались под realistic pressure — повтор «skill loaded, anti-pattern bypassed».
4. **Frontmatter/schema drift** — 5 check-A findings в 4 сессиях (canonical multi-finding `.da-findings/` shape genuinely ambiguous в spec).

### Decision

По решению пользователя (2026-05-20) Phase 4 переводится в статус **«условно закрыта»** (conditionally closed): implementation + closure ritual выполнены, runtime smoke прогнан и дал реальный сигнал — но FAIL-пункты **не фиксятся inline сейчас**, а логируются как отложенный долг перепроверки и становятся гейтом готовности Phase 5.

Rationale «defer, не fix-now»: отказы распадаются на классы, ни один из которых не quick inline fix — (a) harness-gap (`product-devils-advocate` registration) требует spec-решения; (b) S1 — реконсиляция плана и пилота; (c) S12 — реальная регрессия, но DEC-DEV-0036 уже делал попытку фикса, третий hardening-pass + re-smoke — отдельный рабочий блок. Бандлить всё это в «перед тем как двигаться дальше» = стопорить Phase 5 на неопределённый срок. Поэтому: пометить условно закрытой, нести re-verification явным гейтом.

**Отложенный чек-лист перепроверки (re-verification gate):**
- [ ] 3-й hardening-pass `skills/product/cleanup-detector.md` + re-smoke S12
- [ ] `product-devils-advocate` registration gap — spec-решение (Phase 5 kickoff) → re-smoke S8
- [ ] Реконсиляция S1 (smoke-план vs пилотная HYP-схема) → re-smoke S1
- [ ] Выделенная сессия smoke для S7, S9 (не покрыты)
- [ ] Frontmatter-drift паттерн → кодифицировать в D7 `patterns/`

Tracked в `dev/PHASE_5_READINESS.md` Section B и шапке `dev/PHASE_4_SMOKE_TEST_PLAN.md`. Статус-пометки проставлены в ROADMAP, CLAUDE.md, README, CHANGELOG, памяти.

### Lessons

1. **Dogfood D7-аудитора на первом реальном прогоне вскрыл 2 бага CLI (DEC-DEV-0037) раньше, чем хоть один продуктовый finding.** «Validated by smoke» применимо и к самому meta-tooling — не только к продуктовым skill'ам.
2. **План предполагал одну guided-сессию — реальность дала 9 частичных.** Multi-session smoke работает (агрегатор unify'ит), но покрытие рваное — 2 сценария не триггернулись вообще. Lesson: guided single-session smoke-план либо нужно enforce'ить, либо план должен изначально закладывать fan-out.
3. **«Условно закрыта» как явное состояние фазы** — лучше бинарного open/closed, когда smoke даёт смешанный сигнал. Но отложенные пункты обязаны быть именованным гейтом (`PHASE_5_READINESS.md` Section B), не фольклором.
4. **Фиксы DEC-DEV-0036 не удержались** → defensive hardening skill-текста имеет предел; часть anti-pattern'ов, возможно, требует структурного/hook-гарда, а не только формулировки. Перепроверить в 3-м pass.

### Next

- [ ] 3-й hardening cleanup-detector + re-smoke S12
- [ ] `product-devils-advocate` registration — spec-решение на Phase 5 kickoff
- [ ] S1 plan/pilot реконсиляция
- [ ] Выделенная smoke-сессия S7/S9
- [ ] Frontmatter-drift → D7 pattern

### Follow-up (2026-05-20) — re-verification gate снят, Phase 4 закрыта

Через ~час после записи выше пользователь пересмотрел решение: re-verification gate **снимается**, `dev/PHASE_4_SMOKE_TEST_PLAN.md` + `dev/phase-4-smoke-fixtures/` удаляются. Phase 4 переводится из «условно закрыта» в **закрыта** — с известными незакрытыми issue, зафиксированными в `audit-reports/phase-4-summary.md` (+ per-session reports) и в Outcome выше.

Rationale: держать формальный gate + 600-строчный smoke-гайд + seed-fixtures ради перепроверки, не запланированной к конкретному сроку — незавершённый «хвост» над Phase 5 без выигрыша. Результаты smoke уже captured (summary + этот entry). Если какой-то issue станет блокером на практике — вероятный кандидат, `product-devils-advocate` registration gap, всплывёт в Phase 5 Integrator-работе — он будет адресован в контексте той работы, а не через reanimation Phase 4 ritual.

Следствия:
- Чек-листы «Decision → re-verification gate» и «Next» выше — **superseded** (не выполняются как обязательный gate). Lesson 3 («отложенные пункты обязаны быть именованным гейтом») остаётся валидной как принцип, но к Phase 4 более не применяется — gate снят сознательно.
- `dev/PHASE_4_SMOKE_TEST_PLAN.md` + `dev/phase-4-smoke-fixtures/` (4 файла) удалены из репозитория.
- `PHASE_5_READINESS.md` Section B свёрнут из gate в informational-сводку known issues.
- Статус-пометки в ROADMAP / CLAUDE.md / README / CHANGELOG / SPEC §14.5 / памяти: «условно закрыта» → «закрыта (smoke=fail, known issues accepted)».

Known issues не теряются — они в `phase-4-summary.md` (Overview + Recommendations) и в Outcome/Findings выше. «Закрыта» здесь = «фаза не держит Phase 5», а не «smoke прошёл».

---

## DEC-DEV-0039 — Pre-Phase-5 doc-consistency cleanup + SPEC §9 phasing de-duplication

**Date:** 2026-05-22
**Trigger:** Запрошенная пользователем проверка согласованности документов, определяющих Phase 5 (ROADMAP §Phase 5, `dev/PHASE_5_READINESS.md`, `docs/integrator-module/SPEC.md`). Аудит выявил ~15 несостыковок — от чистого doc-rot до скрытых непринятых решений.
**Tag:** #doc-consistency #phase-5 #spec-change #spec-drift-sweep

### Context

Перед Phase 5 kickoff три документа описывали фазу несогласованно. Корень — `integrator-module/SPEC.md §9 «Фазы реализации»` дублировал phase-планирование, которое также живёт в ROADMAP, и они разошлись: `/integrator:update` в §9 отнесён к Maintenance, в ROADMAP — к Phase 5; journal-hook в §9 «логирует каждое добавление», в ROADMAP — «every modifying action». Плюс структурный дефект — два раздела `## 12.` в SPEC. Часть «несостыковок» оказалась не rot, а скрытыми архитектурными решениями (расположение адаптера, scope хука, subagents, `replace.md` acceptance, фантомный PMO-ID `D2-Tech-02`, которого нет в pmo-map.md).

### Options considered

1. **Точечно пропатчить каждое расхождение в §9** — отвергнуто: §9 продолжит дублировать ROADMAP, разойдётся снова.
2. **Удалить §9 целиком** — отвергнуто: §9 несёт полезную группировку возможностей модуля.
3. **§9 → указатель на ROADMAP + steady-state описание групп** (выбрано) — SPEC описывает архитектуру модуля, ROADMAP владеет phasing. Класс «SPEC-фазы vs ROADMAP-фазы» устранён структурно.

Разделение работ: чистый doc-rot чинится сразу (pre-kickoff); скрытые решения НЕ патчатся молча, а сводятся в `PHASE_5_READINESS §C.6` как explicit kickoff-агенда.

### Decision

§9 переписан в pointer (вариант 3). Pre-kickoff cleanup выполнен: устранён дублирующий `## 12.` (перенумерация Environment Scanner → §13, Tool-Docs → §14, MCP → §15), hook-нейминг под конвенцию `hooks/<module>/`, фантомный `D2-Tech-02` → `D2-03`, «6-stage flow» выровнен (approve = gate, не этап), эмпирический множитель оценок ×2-4 зафиксирован в ROADMAP, даты/версии актуализированы. Закрыты queued-findings Phase 4 closure: F5 (SPEC §6.6 product-handoff-gate — PreToolUse→PostToolUse drift), F6 (command naming colons→hyphens), F9 (memory D7 refresh). 6 непринятых решений вынесены в `PHASE_5_READINESS §C.6` для kickoff.

### Outcome

Pre-kickoff cleanup затронул 18 файлов репозитория + memory-файл `project_ecosystem_architecture.md` (вне репозитория). Архитектурных решений не принято — они остаются за kickoff-сессией. Sync-проход (ROADMAP Phase 5 acceptance ↔ §G DoD, acceptance для `replace.md`) — после kickoff.

### Lessons

1. **Phase-планирование должно жить в одном месте.** SPEC §9 дублировал ROADMAP → неизбежный расход. Steady-state SPEC + ROADMAP-owns-phasing — устойчивее.
2. **F6 был недооценён.** `PHASE_5_READINESS §A.4.2` перечислял 3 файла с command-naming drift; реальный drift — в 15 live-файлах. Naming-drift класс нельзя закрывать hand-listed набором файлов — нужен filesystem-vs-docs sweep (подтверждает кандидат H.4 в `PHASE_5_READINESS`).
3. **Различай doc-rot и скрытое решение.** Часть «несостыковок» — непринятые архитектурные решения в текстовой форме. Чинить их молча = принимать решение без kickoff. Правильно — вынести в explicit агенду (`§C.6`).

---

## DEC-DEV-0040 — Phase 5 kickoff: Q1-Q6 + функциональный рефактор PMO-карты

**Date:** 2026-05-25
**Trigger:** Phase 5 kickoff session per `dev/meta-improvement/checklists/phase-kickoff.md`. Резолюция 6 архитектурных вопросов из `PHASE_5_READINESS §C/§C.6` + запрос пользователя на функциональную декомпозицию PMO-карты в стиле «job descriptions ролей».
**Tag:** #phase-5 #kickoff #architecture #pmo-refactor #integrator #orchestrator-boundary

### Context

Phase 4 закрыта (DEC-DEV-0038). Pre-kickoff doc-cleanup выполнен DEC-DEV-0039 — выявил 6 непринятых архитектурных решений, вынесенных в `PHASE_5_READINESS §C.6` как kickoff-агенда. Дополнительно по ходу kickoff пользователь запросил функциональную декомпозицию PMO-карты для D2-Tech / D3 / D4 как «обязанности при найме сотрудников» — это потребовало рефактора `pmo-map.md` и удаления `dev/reference-pmo/` (research-снэпшот, признан избыточным по сложности).

### Options considered (по каждому вопросу)

**Q1 — Adapter location:**
1. Top-level `adapters/` only (ROADMAP) — нет lifecycle-coupling с инструментом.
2. Project-local `.claude/integrator/adapters/` only (SPEC §5.1/§10) — нет canonical reference в репо.
3. **Dual-location (выбрано):** repo `adapters/` = reference source + project `.claude/integrator/adapters/` = installed instance с metadata `target_tool_version` / `contract_schema_version` / `source_ref`. `/integrator:update` сравнивает installed metadata с новой версией инструмента + diff против обновлённого reference → drift detection → contract repair. Адаптер «путешествует» с инструментом, при этом ecosystem ships canonical source.

**Q2 — `/integrator:update` phasing:**
1. **Phase 5 (выбрано, per ROADMAP)** — update нужен для drift-detection contract'ов при апгрейде cc-sdd, это core Installation-семейство.
2. Phase 7 Maintenance (историческая SPEC §9 группировка) — отвергнуто: разрыв install/update лайфцикла.

**Q3 — Subagents + Integrator/Orchestrator boundary:**
1. Без subagent'ов (cuttable) — отвергнуто: profiling и contract design — core Phase 5 работа, нужен isolated context.
2. **С subagent'ами + reframe boundary (выбрано):** `tool-profiler` (stage 1) + `contract-designer` (stage 5) входят в Phase 5 deliverables. **Reframe:** Integrator — «технарь», заканчивает на «installed + contract-verified на fixture». Production-маршрутизация реального handoff'а через адаптер в `/kiro:spec-init` — это **Orchestrator** (runtime routing). PILOT POINT full end-to-end упирается в Orchestrator; Phase 5 DoD не включает spec.json производство.

**Q4 — `replace.md`:**
1. Включить в Phase 5 с acceptance — отвергнуто: только 1 D2-Tech инструмент (cc-sdd), заменять не на что, содержательный тест невозможен.
2. **Defer к v1.1 (выбрано)** — cuttable-scope discipline; вернёмся при появлении 2-го адаптера.

**Q5 — PMO-зоны cc-sdd:**
1. «cc-sdd → D2-Technical» (домен-level) — отвергнуто: слишком грубо для tool-matching.
2. **Гранулярный mapping (выбрано):** core `D2-T01 + D2-T06` (Architecture + Task Decomposition); `D2-T04` (API embedded в spec-design) — partial, верифицируется на profile-stage. Boundary: `D2-B02` Feature Specification — Product Module владеет, cc-sdd consumes via handoff (не owns); фантомный ID `D2-Tech-02` устранён (никогда не существовал в pmo-map).

**Q6 — Journal-hook scope:**
1. Только `add` — отвергнуто: `update`/`remove`/`replace` тоже несут lessons.
2. **Every modifying action (выбрано)** — install / remove / update / config changes. Dedup и retention — operational details при implementation; bloat-риск парируется фильтром-по-тэгу.

**PMO functional refactor (отдельная нить, всплыла по ходу kickoff):**
1. Оставить pmo-map с текущей нумерацией D2-01..09 (интерливинг Behavioral/Technical) — отвергнуто: на Q5 acceptance вылез фантомный `D2-Tech-02`, маркер того что текущая карта не годится для tool-coverage.
2. Адаптировать карту из `dev/reference-pmo/03-domain-coverage-map.md` (industry-anchored: ISTQB, ATAM, *Accelerate*, ISO 25010) — рассматривался, но пользователь удалил `dev/reference-pmo/` целиком как «избыточно сложный»; остаётся `pmo-map.md` canonical concise model.
3. **Функциональная декомпозиция как job descriptions (выбрано):** D2-Behavioral = Бизнес-аналитик (5 обязанностей), D2-Technical = Технический архитектор (8), D3 = Разработчик/Delivery (7), D4 = QA (7). Tool-agnostic, attached к ролям. Integrator профилирует tools против этих обязанностей как CV против JD. D5/D6 не трогаются (D5 deferred v2; D6 — D7 meta).

### Decision

Все 7 пунктов выше выбраны. Сводка изменений в репозитории — в Outcome.

### Outcome

**Файлы изменены (одним коммитом):**
- `docs/pmo/pmo-map.md` — полный rewrite: новая структура D1 + D2-B + D2-T + D3 + D4 + D5/D6 stub + Activation Matrix + Migration ID table.
- `ROADMAP.md` Phase 5 — deliverables ~8 → ~10 (add subagents, drop `replace.md`); acceptance reframed (Integrator-only scope, fixture contract-test, not production `/kiro:spec-init`); D2-Tech-02 → D2-T01+T06.
- `docs/integrator-module/SPEC.md` §4.3 — `D2-03` → `D2-T01` в pmo-mapping.yaml example; §7.2-7.5 narrative examples — IDs обновлены, добавлен boundary note для cc-sdd; §8.2 tool-docs Capabilities — D2-T01/T04/T06 + Boundary секция; §13 DB Migrations пример D3-09 → D3-06.
- `docs/product-module/SPEC.md` — pmo_coverage example: `D2-01/02/05/06` → `D2-B01/02/03/04/05`; D2-05 в narrative → D2-B04.
- `docs/design-module/SPEC.md` — D2-05 → D2-B04 (3 места).
- `docs/pmo/artifacts/{FM,MK,DS,NM,NFR,README}.md` — D2-05 → D2-B04; NFR — domain reference уточнён до D2-T05 + D4-07.
- `commands/integrator/{map,status,gaps}.md` — D2-Tech-02 → D2-T01+T06; D2-05 → D2-B04; D4-01 vitest example → D4-03; gap-list example IDs updated.
- `commands/product/status.md`, `commands/ecosystem/bootstrap.md`, `templates/project/CLAUDE.md.template`, `README.md` — D2-05 → D2-B04.
- `skills/integrator/{tool-profiling,research-protocol}.md` — illustrative IDs обновлены; pmo-mapping.yaml example в tool-profiling показывает D2-T01 + D2-T06 (cc-sdd primary).
- `agents/integrator/tool-researcher.md` — coverage example IDs updated.
- `CLAUDE.md` repo structure — добавлен `adapters/` каталог с пометкой Phase 5+ + reference-instance pattern.
- `dev/PHASE_5_READINESS.md` — Section C/C.6 → ✅ resolved + summary Q1-Q6; §G DoD reframed (Integrator-only).
- `dev/reference-pmo/` — удалён целиком (16 файлов) по решению пользователя: «избыточно сложный для текущего этапа; ориентируемся на pmo-map.md как concise model».

**Файлы НЕ трогаем (intentional):**
- `CHANGELOG.md` — обновляется при release 1.3.0 (per PHASE_5_READINESS §F.2).
- `DEV_JOURNAL.md` исторические записи — содержат старые ID, оставляем для исторической точности.
- `dev/_archive/phase-4/` — archive, immutable.
- `dev/meta-improvement/audit-index.md` — auto-appended hook rows, не часть kickoff-коммита.

### Lessons

1. **Проверь существующие реф-материалы ПРЕЖДЕ чем изобретать.** Я предложил pmo-функциональную карту с нуля, не зная (точнее — забыв проверить) что в `dev/reference-pmo/03-domain-coverage-map.md` уже была industry-anchored декомпозиция. Surfaced это сам перед коммитом — пользователь удалил reference-pmo по соображениям сложности, но риск был реален: третья параллельная таксономия перетёрла бы 20-40 лет индустриальной декомпозиции моей ad-hoc выдумкой. Перед предложением «свежего» дизайна — `Glob`/`Grep` по `dev/` на похожие артефакты.
2. **Integrator vs Orchestrator boundary — единичная вершина, многоразовое следствие.** Пока я писал acceptance «adapter invokes /kiro:spec-init», boundary казалась академической. Пользовательская поправка показала: smешение «технарь устанавливает» и «runtime маршрутизирует» влияет на DoD, на PILOT POINT scope, на формулировку Stage 6 «verify». Этот граничный класс — кандидат в `dev/meta-improvement/patterns/` если повторится в Phase 7+.
3. **Фантомные ID как маркер несинхронности.** `D2-Tech-02` существовал в SPEC/commands/ROADMAP, но не в pmo-map.md. Это был сигнал «карта и её consumer-ы разошлись», но прошёл незамеченным до Q5. **Триггер для будущих kickoff'ов:** перед acceptance ссылающимся на конкретный PMO-ID — `grep` pmo-map.md, что ID существует.
4. **Reference-материал ≠ SPEC.** `dev/reference-pmo/` был полезен как research-snapshot, но не имел «живого» механизма sync с pmo-map.md → дрейф между ними был неизбежен. Пользователь удалил его сознательно. Lesson: research-снэпшоты ценны только если есть протокол их consume/discard (что не нарисовалось) или если они интегрированы в живой spec. В solo + AI workflow — лучше один lean spec, чем два расходящихся документа.
5. **Job-description framing для tool-coverage.** Превращение PMO-зон в «обязанности роли при найме» сделало `pmo-mapping.yaml` осмысленным: один tool редко покрывает всю роль; coverage = подмножество обязанностей; `gap` = ненанятая обязанность. Это резко улучшает `/integrator:gaps` UX и точность `tool-profiler` subagent.

---

## DEC-DEV-0041 — Phase 5 implementation closure (Integrator-only scope)

**Date:** 2026-05-25
**Trigger:** Phase 5 sub-phase J — закрытие implementation cycle Phase 5 (Integrator Installation + first cc-sdd adapter) per план + DEC-DEV-0040 kickoff decisions.
**Tag:** #phase-5 #closure #integrator #adapter

### Context

Phase 5 kickoff (DEC-DEV-0040) закрыл Q1-Q6 + функциональный рефактор PMO-карты. Implementation шёл 10 sub-phase commits A-J:

| Sub-phase | Commit | Deliverable |
|---|---|---|
| A | acb5113 | Scaffolding (hooks/integrator/manifest.yaml + adapters/ caddy с README dual-location pattern) |
| B | 521caff | `tool-profiler` subagent + `tool-profiling.md` skill refresh (canonical PMO IDs, B.1 anti-pattern) |
| C | fe6e599 | Reference adapter `handoff-to-ccsdd.js` + fixture FM-FIXTURE-001-handoff.md + tests/fixtures/README.md |
| D | 9161541 | `contract-design.md` skill + `contract-designer.md` subagent |
| E | 90e3619 | `/integrator:add` 6-stage orchestrator + `installation-protocol.md` skill |
| F | 777282c | `journal-hook.js` (PostToolUse autolog every modifying action — Q6) + manifest entry |
| G | cd3933b | `/integrator:remove` (impact analysis + backup + cleanup; .product/ untouched) |
| H | c43a2c4 | `/integrator:update` (5-stage drift-repair) + `drift-detection.md` skill (D1/D2/D3 minimum viable) |
| I | 69ab156 | `tool-docs-generator.md` skill + add/update wiring; tool-docs themselves per-project |
| J | (this) | Smoke plan + closure docs (PHASE_5_SMOKE_TEST_PLAN, PHASE_6_READINESS skeleton, CHANGELOG 1.3.0, ROADMAP, DEV_JOURNAL entry) |

### Decisions (cumulative)

Все DEC-DEV-0040 решения применены без перекройки:
- **Q1 dual-location adapter** — repo `adapters/handoff-to-ccsdd.js` reference; per-project `.claude/integrator/adapters/handoff-to-ccsdd.js` instance с metadata header (`@target_tool_version`, `@contract_schema_version`, `@source_ref`, `@installed_at`). Stage 5 add-flow + Stage 4 update-flow consume этот pattern.
- **Q2 update в Phase 5** — `/integrator:update` shipped; не отложен в Phase 7.
- **Q3 subagents + Integrator/Orchestrator boundary** — `tool-profiler` (Stage 1) + `contract-designer` (Stage 5) shipped. Stage 6 ends at fixture contract-test; production routing (handoff → live `/kiro:spec-init`) — Orchestrator (out of Phase 5 DoD).
- **Q4 `/integrator:replace`** — deferred к v1.1 (no 2nd D2-Tech tool для содержательного теста).
- **Q5 PMO zones cc-sdd** — pmo-mapping.yaml schema поддерживает `D2-T01 + D2-T06` primary, `D2-T04` partial, `D2-B02` boundary (`boundary:` field в installation-protocol skill Section 7).
- **Q6 journal-hook scope** — every modifying action; dedup `(action+subject+minute)`, retention `_archive/journal-YYYY-MM.md` при > 500 entries.

### Outcome

**Файлы созданы (~16 файлов, 2 modifications):**

Commands:
- `commands/integrator/add.md`
- `commands/integrator/remove.md`
- `commands/integrator/update.md`

Skills:
- `skills/integrator/installation-protocol.md`
- `skills/integrator/contract-design.md`
- `skills/integrator/drift-detection.md`
- `skills/integrator/tool-docs-generator.md`
- `skills/integrator/tool-profiling.md` (modified — added subagent invocation matrix, canonical PMO IDs, B.1 anti-pattern variants)

Agents:
- `agents/integrator/tool-profiler.md`
- `agents/integrator/contract-designer.md`

Hooks:
- `hooks/integrator/journal-hook.js`
- `hooks/integrator/manifest.yaml`

Adapters:
- `adapters/handoff-to-ccsdd.js` (reference)
- `adapters/README.md`

Tests:
- `tests/fixtures/FM-FIXTURE-001-handoff.md`
- `tests/fixtures/README.md`

Plans + closure:
- `dev/PHASE_5_SMOKE_TEST_PLAN.md`
- `dev/PHASE_6_READINESS.md` (skeleton)

Modifications:
- `dev/PHASE_5_READINESS.md` — status banner → ✅ implemented (closure ritual Unit 2 pending)
- `ROADMAP.md` — «Где мы сейчас» обновлено; Phase 5 в completed; PILOT POINT reframed (depends on Orchestrator)
- `CHANGELOG.md` — `[1.3.0]` section added

Размер реализации:
- A: 2 files, 57 insertions
- B: 2 files, 237 insertions
- C: 3 files, 658 insertions
- D: 2 files, 410 insertions
- E: 2 files, 429 insertions
- F: 2 files, 257 insertions
- G: 1 file, 196 insertions
- H: 2 files, 357 insertions
- I: 3 files, 200 insertions
- J: ~5 files, ~600 insertions (this commit)
- **Total: ~24 files, ~3400 lines added**

### Static smoke результаты

- Adapter contract-test (positive case, sub-phase C): exit 0; all 6 contract checks pass; `cc_sdd_input` fully populated; slug correct; provenance + steering_prefix from frontmatter
- Adapter contract-test (negative case, status=blocked): exit 1; C-02 blocking fail with correct detail; `cc_sdd_input: null`
- journal-hook smoke (4 cases, sub-phase F): integrator Write append OK; dedup within minute OK; non-integrator path filter OK; Bash npx append OK

### Эффорт vs план

План: 10-20 ч (с эмпирическим множителем ×2-4 на базовую ROADMAP-оценку 3-5 ч).
Факт: реализация уложилась в одну расширенную сессию (несколько часов). Это **меньше** прогноза. Возможные причины:
1. Kickoff DEC-DEV-0040 закрыл 6 архитектурных вопросов + PMO рефактор upfront → нет mid-implementation ambiguity-stalls (это были ROI-points в Phase 3/4 расходов)
2. Phase 5 — preimuщественно методология (skills + commands) с одним содержательным кодом (adapter + hook)
3. SPEC §3-§14 был уже почти полностью detailed (Phase 0-1 work); commands + skills во многом «codify» SPEC в исполняемые artifacts
4. Subagent pattern уже отработан (tool-researcher как образец); tool-profiler + contract-designer структурно подобны

### Risks (observed + resolution)

- ✅ **R1 (live cc-sdd verification)** — отложено к runtime smoke / pilot run. Adapter работает fixture-based; production verification — Orchestrator scope.
- ✅ **R2 (Environment Scanner false-positives)** — mitigated через `integrator_owned` heuristic в installation-protocol.md Section 3 (файл в `.claude/<type>/<module>/` + module manifest declaration = ecosystem-owned).
- ✅ **R3 (journal-hook bloat)** — mitigated через dedup `(action+subject+minute)` + retention `_archive/journal-YYYY-MM.md` при > 500 entries.
- ⏳ **R4 (contract-designer subagent over/under-classify transformation type)** — surface при runtime smoke S5.
- ✅ **R5 (Adapter dual-location desync)** — mitigated через `target_tool_version` + `contract_schema_version` + `source_ref` metadata в installed instance + drift-detection skill D1/D2/D3.
- ⏳ **R6 (F4 Phase 4 bootstrap regression)** — addressed pre-Phase-5-start (user confirmed F4 выполнен).
- ⏳ **R7 (`product-devils-advocate` subagent type registration)** — может всплыть при S1 (Stage 5 invokes contract-designer); flag в smoke plan.

### Lessons

1. **Kickoff ROI multiplier holds — даже сильнее в Phase 5.** Phase 3/4 ROI был 3-5x (DEC-DEV-0012 lesson). Phase 5 кажется ~6-8x благодаря Q1-Q6 + PMO functional decomposition pre-resolve. Phase 6/7 kickoff invest должен оставаться mandatory.
2. **Methodology phases (skills + commands) дешевле code phases (hooks + parsers).** Phase 5 имела только 2 reactive code артефакта (adapter + journal-hook), остальное — orchestration prompts. Это объясняет смещение от плановых 10-20 ч к фактическим ~часам. Calibration для future: если phase preimuщественно prompts → ×1-2 multiplier; если preimuщественно code → ×3-5.
3. **Dual-location pattern (DEC-DEV-0040 Q1) — generalizable.** Same pattern может применяться к hooks/agents/skills installed by tools: repo reference + project instance + drift detection. Phase 7 maintenance может extend.
4. **Subagent structural pattern закрепился.** tool-profiler + contract-designer написаны по тому же template что tool-researcher (Phase 1). Brief / methodology / output blocks / anti-patterns / time budget / cross-reference. Шаблон стоит явно codify в `dev/meta-improvement/patterns/` если повторится в Phase 6 (screen-generator) и Phase 7.
5. **B.1 frontmatter convention (DEC-DEV-0011 → DEC-DEV-0012) масштабируется.** Применено к profile YAML, CNT YAML, pmo-mapping.yaml — каждый skill включает explicit canonical fields + anti-pattern variants list. Это **должно** быть default для всех schema-bearing skills (codify в CONVENTIONS.md если ещё нет).
6. **Phantom IDs как drift signal (DEC-DEV-0040 lesson #3) — преcomputed.** Pre-Phase-5 cleanup убрал `D2-Tech-02`; install protocol + tool-profiler subagent оба ловят попытку invent ID. Этот pattern (canonical-IDs-only + invariant check) применим везде где skills используют typed identifiers.

### Что НЕ сделано (intentional)

- **Closure ritual Unit 2 (D7 phase-closure.md 6 steps fresh-session)** — отдельная сессия; будет запущена user'ом по завершении runtime smoke.
- **Runtime smoke S1-S6 execution** — план готов (`dev/PHASE_5_SMOKE_TEST_PLAN.md`); ждёт pilot session.
- **Live `npx cc-sdd@latest` verification** — отложено к Stage 6 в pilot session.
- **Phase 5 memory MCP sync** — будет в closure ritual Unit 2 Step 6.
- **F4 Phase 4 bootstrap regression** — выполнен user'ом до старта Phase 5 (per pre-flight confirmation).

### Связь с другими entries

- DEC-DEV-0040 (kickoff) — все Q1-Q6 + PMO refactor применены; этот entry — implementation outcome.
- DEC-DEV-0031 A1 (line-based parser lesson) — applied к adapter `parseFrontmatter` (не regex на multi-entry block).
- DEC-DEV-0025 C.1 (`lib/hash.js`) — структурный template для adapter Node stdlib + cross-platform LF-normalized I/O.
- DEC-DEV-0023 (cascade-pending 396 entries) — mitigated в journal-hook через dedup + retention.

---

## DEC-DEV-0042 — `/ecosystem:update` closed-list cleanup of obsolete contamination

**Date:** 2026-05-26
**Trigger:** pre-Phase-5 runtime smoke prep — обнаружено, что pilot project `my-first-test/` содержит `.claude/INSTALL-HUMAN.md` + `.claude/dev/` от старого bootstrap-а (pre-DEC-DEV-0019 Path Y). `/ecosystem:update` спека их **не удаляла**, потому что rsync-with-delete loop работает только внутри allowlisted subdirs (`commands/, skills/, agents/, hooks/, docs/, templates/, output-styles/`).
**Tag:** #integrator #ecosystem-update #contamination #phase-5-prep

### Context

Phase 4 родил `/ecosystem:update` как Path Y решение для DEC-DEV-0019 Findings A-D. Finding A (dev contamination) был адресован через **never-copy zone** — закрытый список того, что **не копировать из upstream** (CLAUDE.md, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md, package.json, eslint.config.js, node_modules).

Однако спека описывала только **направление "upstream → .claude/"**. Если эти файлы **уже сидели** в `.claude/` от ошибочного pre-Path-Y bootstrap-а — они просто **оставались навсегда**: rsync-with-delete действует только внутри 7 allowlisted subdirs, а contamination живёт **рядом** с ними (в `.claude/` root) или **в неаллоулистед dir** (`.claude/dev/`).

Phase 5 readiness check вскрыл это в pilot:
```
.claude/dev/              ← pre-Path-Y contamination
.claude/INSTALL-HUMAN.md  ← pre-Path-Y contamination
```

Запуск `/ecosystem:update` принёс бы Phase 5 deliverables корректно, но contamination остался бы. Будущий `/ecosystem:bootstrap` или Claude-сессия, читающая `.claude/dev/CLAUDE.md`, могла бы быть введена в заблуждение ecosystem-dev контекстом.

### Решение

Дополнить `/ecosystem:update` подшагом **Step 5a — Remove obsolete contamination**:
1. **Step 4** теперь детектирует contamination через **закрытый список** (closed list) — никогда не runtime-расширяется
2. **Step 5a** применяет `rm -f` / `rm -rf` к закрытому списку (idempotent — `-f` чтобы absent paths не падали)
3. Backup (Step 2) сохраняет всё ДО cleanup — rollback тривиален
4. Closed list синхронизирован с **never-copy zone** того же файла (single source of truth)

### Альтернативы (отвергнутые)

**A. Расширить rsync-with-delete на корень `.claude/`** — отвергнуто. Прямой rsync с delete на `.claude/` root удалил бы пользовательские файлы (`product.yaml`, `settings.local.json`, `.env`, `integrator/`) — это нарушение invariant'а user-zone preservation. Allowlist + closed-list cleanup — корректная инверсия.

**B. Generic «remove everything not in allowlist»** — отвергнуто. False-positive risk слишком высок: пользователь мог добавить кастомные файлы в `.claude/` (например, локальные scripts). Закрытый список идентифицирует ровно те 8 paths, которые **точно** являются ecosystem-dev контаминацией.

**C. Migration script (one-shot)** — отвергнуто. Меньше maintenance (только обновление при появлении нового класса contamination), но даёт worse UX: пользователь должен помнить выполнить migration перед/после update. Inline в update.md — auto-applied + transparent в preview.

**D. Warn-only (без удаления)** — отвергнуто. Половинчатая мера: pilot smoke бы всё равно споткнулся, warning легко игнорировать. Cleanup explicit + backup — full restore доступен.

### Outcome

Файлы изменены (1 file):
- `commands/ecosystem/update.md` — Step 4 contamination detection table + closed-list spec; Step 5a apply block (bash + powershell); Step 8 summary report row; Comparison table row; "What NOT to do" anti-extension rule.

Закрытый список (8 paths):
| Path | Тип |
|---|---|
| `.claude/CLAUDE.md` | file |
| `.claude/DEV_JOURNAL.md` | file |
| `.claude/INSTALL-HUMAN.md` | file |
| `.claude/package.json` | file |
| `.claude/package-lock.json` | file |
| `.claude/eslint.config.js` | file |
| `.claude/dev/` | directory |
| `.claude/node_modules/` | directory |

Out-of-scope (NEVER touch): `.claude/.gitignore`, `.claude/.gitattributes`, `.claude/LICENSE`, и любые non-listed files.

### Risks

- **R1 — False positive (пользователь намеренно положил один из этих файлов):** mitigated через backup. Если пользователь объявит, что `.claude/CLAUDE.md` или `.claude/package.json` — это его кастомный artifact, он восстанавливает из `.claude-backup-<timestamp>/` после run.
- **R2 — Closed list растёт со временем (нет single source of truth synchronization):** mitigated через "What NOT to do" — anti-extension rule запрещает runtime-расширение; новые contamination classes требуют SPEC patch + CHANGELOG entry (procedural enforcement).
- **R3 — Spec divergence между never-copy zone (Step 4 directional) и closed list (Step 5a destructive):** требует ручной синхронизации. Если в Phase 7+ появится новый dev-only file в repo — обновить **оба** места одновременно. Codified в "What NOT to do".

### Lessons

1. **Invariant directionality — common spec gap.** Спека Path Y закрыла направление "upstream → .claude/" (не копировать never-copy), но не закрыла "пре-существующее contamination в .claude/". Каждое invariant-описание спеки нужно проверять в **обе стороны**: "что НЕ должно попасть" + "что НЕ должно остаться". Это general lesson для будущих SPEC reviews.

2. **Pilot-smoke prep вскрывает spec gaps, которые static review не ловит.** Phase 4 closure ritual (D7) запустил `/ecosystem:update` в pilot, но Phase 4 deliverables не пересекались с contamination paths — gap не сработал. Phase 5 prep потребовал «увидеть текущее состояние pilot» → contamination всплыл. Lesson: ритуал phase-kickoff (D7) должен включать **«inspect pilot .claude/ root structure»** перед запуском update.

3. **Closed-list patterns > generic heuristics для destructive ops.** Generic «remove anything not in allowlist» элегантно, но false-positive risk слишком велик. Закрытый список — verbose, но safe + auditable. Этот pattern применим и к Integrator: `/integrator:remove` уже использует similar approach (explicit primitives list, не sweep).

4. **DEC-DEV-0019 Path Y был корректным архитектурным выбором, но incomplete coverage.** Не критика original decision — incremental discovery. Каждый Path Y-style allowlist спека нуждается в audit-pass "what about pre-existing state matching the negation?". Codify в D7 patterns/ если паттерн повторится.

### Связь с другими entries

- DEC-DEV-0019 — Path Y / never-copy zone introduction; этот entry — completion (covers pre-existing case).
- DEC-DEV-0023 — установил, что `package.json`/`eslint.config.js` ecosystem-dev-only (lint pipeline); этот entry удаляет их из user-projects.
- DEC-DEV-0041 — Phase 5 implementation closure; runtime smoke prep вскрыл gap.

---

## DEC-DEV-0043 — Phase 4 post-closure audit findings: recurring DA drift + S12 regression

**Date:** 2026-05-26
**Trigger:** Ретроспективный прогон `/meta:audit-smoke --phase=4` на 8 Pending сессий `my-first-test` (2026-05-21..26), накопившихся между Phase 4 closure (DEC-DEV-0038, 2026-05-20) и моментом аудита. Aggregate `audit-reports/phase-4-summary.md`: status=partial (1 FAIL, 1 PARTIAL, 3 findings, 3 clean). Сессии относятся не к guided Phase 4 smoke, а к interim продуктовой работе в пилоте + post-Phase-5 implementation.
**Tag:** #pilot-finding #phase-4 #post-closure #d7-audit #tech-debt #recurring-regression

### Context

Phase 4 закрыта DEC-DEV-0038 follow-up (2026-05-21) с известными issue, accepted as known. Smoke plan + fixtures удалены commit `21cca85`. С того момента в пилоте `my-first-test` накопилось 8 SessionEnd-перехваченных сессий — D7-хук писал Pending markers, никто не запускал аудитор. Триггер запуска — `/meta:audit-smoke --phase=4` без активного plan'а.

Для аудита временно восстановлен `dev/PHASE_4_SMOKE_TEST_PLAN.md` из `21cca85^` → прогон → удаление. Файловая структура неизменна (только новые audit-reports + audit-index Pending→Processed).

### Outcome — findings

Aggregate показал ожидаемое для post-closure прогона: 10 из 13 сценариев NOT-COVERED (сессии не выполняли smoke), 2 COVERED (S2 Language, S4 NFR), 1 PARTIAL (S12). Real signal — **не coverage matrix**, а findings catalog:

| # | Finding | Severity | Сессии | Класс |
|---|---|---|---|---|
| E1 | DA `subagent_type=general-purpose` вместо `product-devils-advocate` | 🔴 Blocking | 0781ad12, 31394d98, e3bfd3a3 | **Recurring regression** |
| E2 | P-RULE-01 violation: IC-022..028 активированы без DA | 🔴 Blocking | 0781ad12 | Process violation |
| E3 | S12 FAIL — DEC-DEV-0036 cleanup hardening не удержался | 🔴 Critical | 0c10a7c0 | **Recurring regression** |
| E4 | IC frontmatter drift (`type=invariant` vs `type=invariant-check`) | 🟡 Warning | 0781ad12, e3bfd3a3 | Schema drift |
| E5 | Post-DA edits активных BR без re-DA (P-RULE-02) | 🟡 Warning | 0781ad12, e3bfd3a3 | Process violation |

**Ключевое:** E1 и E3 — recurring relative to DEC-DEV-0038 findings. E1 был «системное #2» в DEC-DEV-0038 (харнесс не регистрирует `product-devils-advocate` — DA падает в `general-purpose` fallback) — мы знали, что баг живой, и Phase 5 kickoff декларировал spec-решение; но между closure и сейчас вышли ещё 3 сессии с тем же drift. E3 — повторение того, что DEC-DEV-0036 защитный hardening пытался закрыть и DEC-DEV-0038 уже отметил «фиксы не удержались»; теперь подтверждено третьей сессией.

### Decision

Не fix-now, а зафиксировать как **именованный долг** в новом файле `dev/tech-debt/PHASE_4.md`:
- 5 OPEN errors с severity и suggested actions
- 5 recommendations (R1-R5), каждая с пометкой «**перепроверить альтернативы при взятии в работу**» + явный список альтернатив для пересмотра (чтобы при отложенном execution не имплементировать первое предложение из summary без свежего взгляда)
- Out-of-scope reminders

Файл размещён в новой папке `dev/tech-debt/` (не в `_archive/phase-4/`, чтобы оставить долг visible при последующей работе).

Rationale «defer, не fix-now»:
- E1 имеет архитектурную природу (subagent registration в харнессе) — Phase 5 kickoff уже на это смотрел, не имеет смысла чинить inline вне контекста Phase 5 closure / Phase D
- E3 — DEC-DEV-0036 + DEC-DEV-0038 уже подтвердили, что defensive skill-text hardening имеет предел; нужен structural/hook guard, а это > inline patch
- E2/E5 — process violations, ловятся hook-side enforcement (R4) — стоит дизайнить вместе с E1 решением
- E4 — обычный schema drift, применим convention DEC-DEV-0012; быстрый patch, но в контексте сессии аудита не приоритет

Commit: `03841e3`.

### Альтернативы (отвергнутые)

**A. Fix-now каждой E1-E5 inline в рамках текущей сессии.** Отвергнуто. (1) E1/E3 требуют структурного решения, не правки в одну сессию. (2) Бандлить 5 разных fix'ов в одну работу = разрыв контекста и риск incomplete coverage. (3) Аудит был ретроспективным cleanup'ом Pending, не product engineering сессией.

**B. Открыть GitHub issues / TODO в backlog.** Отвергнуто. Solo dev, нет issue tracker'а; `dev/v1_1_backlog.md` существует, но это «preserved deferred context», не actionable list. Tech debt файл — более прямая форма для recurring findings: severity видна, recommendation структурирован, журнал статусов встроен.

**C. Сложить все 5 findings прямо в существующий `phase-4-summary.md` recommendation section.** Отвергнуто. Summary — auditor output (anti-action в команде запрещает editing), tech debt — human-curated follow-up. Separation важна.

**D. Не фиксировать долг отдельно, считать findings уже «captured» в audit reports.** Отвергнуто. Audit reports содержат facts; что с ними делать — это решение, которое легко потеряется при поиске «что fix'ить дальше». Tech debt файл — единая точка входа.

### Lessons

1. **Recurring regression — самый сильный сигнал на структурный (не текстовый) фикс.** E1 третий раз подтверждается (DEC-DEV-0036 → DEC-DEV-0038 → этот entry); каждая попытка через skill-text hardening / docs / kickoff декларацию проваливалась. Lesson: после 2-го рецидива одного класса бага default → искать hook-side enforcement, а не лучшую формулировку. R1 (D7 pattern + validation hook) рожден из этого правила.

2. **Phase «закрыта» не значит «sealed against new findings».** Phase 4 формально закрыта DEC-DEV-0038, но новые сессии в пилоте продолжают воспроизводить её известные баги. Lesson: closure = «не блокирует Phase N+1», не «больше не происходит». Длящийся pilot — длящийся источник findings про прошлые phases; нужна явная форма (tech debt файл per phase) для их учёта, иначе они либо повторно регистрируются как новые баги, либо тонут в audit reports.

3. **«Перепроверить альтернативы при взятии в работу» — обязательная пометка для отложенных recommendation.** Audit summary даёт первое разумное решение, но к моменту execution контекст может сдвинуться (новое spec-решение, новый pattern, более дешёвый путь). Без явного reminder есть риск имплементировать первую формулировку как mandate. Codified в `dev/tech-debt/PHASE_4.md` через ⚠ маркер + перечень альтернатив для каждой R1-R5.

4. **D7-аудитор работает на post-closure ретроспективе так же, как на active phase smoke.** Не было причин ожидать иное (preprocessor + scenarios agnostic к статусу phase), но это первый прогон в режиме «фаза закрыта, сессии накопились» — confirmed pattern: `claude -p` auditor усваивает рваные context'ы пилотных сессий, surface'ит классы паттернов adequate-ly. Lesson: можно безопасно копить Pending markers между active phases и периодически прогонять `--phase=N` retroactively на закрытые phases — это валидный workflow, не только pre-closure gate.

### Next

Tracked в `dev/tech-debt/PHASE_4.md` (Журнал статусов внизу файла обновляется по мере взятия R1-R5 в работу):

- [ ] R1 — Codify D7 pattern «DA subagent_type contract» + hook-side validation (закрывает E1 + частично E2)
- [ ] R2 — Targeted re-smoke S12 (закрывает E3, либо явный defer как known issue)
- [ ] R3 — Patch IC-skill template per convention DEC-DEV-0012 (закрывает E4)
- [ ] R4 — P-RULE-01/P-RULE-02 enforcement hook (закрывает E2 + E5)
- [ ] R5 — Скип, no action для clean sessions

Каждая R при взятии в работу требует **перепроверки альтернатив** (явный список в tech debt файле) — это не optional.

### Связь с другими entries

- DEC-DEV-0036 — первый attempt cleanup-detector hardening; E3 — третье подтверждение, что text-level fix не удерживается
- DEC-DEV-0038 — Phase 4 closure с known issues; E1 + E3 — recurring relative к этому entry, подтверждают «нечинённые баги остались нечинёнными»
- DEC-DEV-0040 — Phase 5 kickoff; ожидалось, что `product-devils-advocate` registration gap получит spec-решение, но E1 говорит, что drift сохраняется → возможно spec-решение ещё не landed либо не покрывает batch DA вызовы из BR/IC контекстов (не только `/product:da-review`)
- DEC-DEV-0012 — convention «explicit frontmatter template + anti-pattern warnings»; E4 — её прямое application к IC-skill

---

## DEC-DEV-0044 — Phase 5 runtime smoke: 3 bugs fixed end-to-end, 1 bug deferred, tri-location pattern adopted

**Date:** 2026-05-26
**Trigger:** Phase 5 closure ritual Unit 2 — runtime smoke per `dev/PHASE_5_SMOKE_TEST_PLAN.md`. Three pilot sub-sessions (S6 `306c196c`, S4 `74d1d4b8`, re-install `a3dd65f9`) executed sequentially, with mid-stream root-cause fixes between scenarios.
**Tag:** #pilot-finding #bug-fix #architecture #refactor

### Context

Phase 5 implementation (DEC-DEV-0041) shipped с sub-phase J static smoke green. But static smoke validates adapter `--verify-only` against repo's reference file from ecosystem repo CWD — это always works on test machine. Runtime smoke в pilot context surfaced four bug classes the static check couldn't see.

Initial S3 run (before this closure session) had `contract_validation.passed: true` но check schema (10 чеков с levels `error/warn`) и output shape (no `cc_sdd_input` block) divergent от reference (6 чеков с `blocking/warning`). Reading the initial install's project-journal.md showed Bash entries `node -e "var fs=..." part1 part2 part3` 10:18-10:24 — subagent был writing adapter from scratch вместо `cp` from reference. Investigation cascaded.

### Smoke scenarios outcomes

| Scenario | Status | Notes |
|---|---|---|
| S6 — journal-hook autolog | PARTIAL→FIXED | Step 1 (Edit on integrator yaml) FAIL; bug 3 found + fixed; verified bonus PASS in S4 |
| S4 — `/integrator:remove cc-sdd` | PASS clean | All 9 acceptance criteria met; thorough impact report; rollback procedure detailed; `.product/` invariant + global catalog deprecation invariant both upheld |
| S3 — Stage 6 fixture verify (initial) | PARTIAL FAIL | Контракт `passed: true`, но broken check schema + missing `cc_sdd_input` block surfaced bug 1+2 |
| S3 re-run | PASS clean | All 8 acceptance criteria met after bug 1+2 fix + re-install. Typed JSON correct, slugify works, full provenance |
| S5 — `/integrator:update` drift | DEFERRED | Blocked by bug 4 — needs `/integrator:update` Stage 3 refactor under tri-location |
| S1/S2 — install + zone assignments | validated indirectly | Via re-install observations + pmo-mapping inspection during S4 |

### Bugs found and fixed

**Bug 1 — narrow heuristic in skill+agent for reference adapter lookup**

- *Symptom:* `/integrator:add cc-sdd` Stage 5 regen'ил adapter from scratch via 6 piecemeal Bash `node -e "var fs=..." part1 part2 ...` writes (visible in project-journal 10:18-10:24 from initial install).
- *Root cause:* `skills/integrator/contract-design.md` Step 4 искал только `adapters/<producer>-to-<consumer>.js` (для (product-module, cc-sdd) → `adapters/product-module-to-cc-sdd.js`, не существует). Не пробовал alternative naming patterns. `agents/integrator/contract-designer.md` имел heuristic `handoff-to-<consumer>.js` но с consumer=`cc-sdd` → `handoff-to-cc-sdd.js`, не матчил реальный `handoff-to-ccsdd.js` (slug normalization мисс).
- *Fix:* Step 4 в обоих файлах — Glob-based exhaustive enumeration (`*-to-*.js`) + slug-tolerant matching (try cc-sdd / ccsdd / cc_sdd) + mandatory `adapters/README.md` consultation + fail-loud escalation if 0 matches. Anti-pattern #1 в обоих усилен с конкретной отсылкой на эту lesson.
- *Verification:* re-install session a3dd65f9 → Stage 5 used `cp .claude/adapters/handoff-to-ccsdd.js .claude/integrator/adapters/...` (one Bash entry, not 6 piecemeal writes). Diff между installed и reference показывает только metadata header (3 lines) differs.

**Bug 2 — bootstrap/update не деплоят `adapters/` в pilot**

- *Symptom:* subagent's Glob возвращает empty regardless of how exhaustive — потому что `.claude/adapters/` directory вообще не существует в pilot.
- *Root cause:* `commands/ecosystem/bootstrap.md` Step 2b/2c полагается на `cp -rn .claude-ecosystem-tmp/. .claude/` для копирования всего, что не в never-copy filter. Но pilot был bootstrap'нут до Phase 5.A scaffolding (commit acb5113) — поэтому adapters/ directory не существовала на момент install. Subsequent `/ecosystem:update` имеет explicit allowlist (`commands/`, `skills/`, `agents/`, `hooks/`, `docs/`, `templates/`, `output-styles/`) — `adapters/` НЕ в allowlist. → Never synced. Pilot's installed adapter copy was self-generated → had no source-of-truth at all.
- *Fix:* update.md Step 4 allowlist расширен до `adapters/`; bootstrap.md Step 2d verify checklist включает `.claude/adapters/handoff-to-ccsdd.js`; adapters/README.md refactored from dual-location → tri-location pattern (repo canonical → pilot reference → pilot instance). Skill+agent+command paths updated from `adapters/<file>.js` → `.claude/adapters/<file>.js` (pilot-context normative).
- *Verification:* pilot's `.claude/adapters/handoff-to-ccsdd.js` (manually propagated as one-time backfill) → subagent successfully Read + cp'd → S3 re-run PASS clean.

**Bug 3 — journal-hook Windows path regex separator mismatch**

- *Symptom:* S6 step 1 FAIL — Edit на `.claude/integrator/active-tools.yaml` (через Edit tool) не появилось в `project-journal.md`. Mtime не обновился. Bash events работали (step 4 PASS).
- *Root cause:* `hooks/integrator/journal-hook.js:37-43` INTEGRATOR_PATH_PATTERNS use forward-slash separators (`\.claude\/integrator\/...`). Edit tool на Windows emits `file_path` с backslash-quoted JSON (`"C:\\...\\.claude\\integrator\\..."` → runtime string `C:\...\.claude\integrator\...`). Regex test не матчит → `classifyAction` returns null → hook silent exit без append. Bash command strings содержат forward slashes (`npx cc-sdd@latest --help`), поэтому BASH_PATTERNS работали.
- *Fix:* `classifyAction` нормализует `p.replace(/\\/g, '/')` перед regex test (line 95). Original path preserved в subject for diagnostics (показывает native separators).
- *Verification:* S4 produced 4 auto entries on Write events of `.claude/integrator/*.yaml` files (timestamps 12:47:54Z через 12:49:22Z). Same class of bug as DEC-DEV-0031 A1 (regex on multi-entry blocks).

### Bug deferred to Phase 5.1 patch

**Bug 4 — `@source_ref` + `/integrator:update` drift checks broken под tri-location (3 facets)**

- *Facet 4a:* `@source_ref` populated via `git rev-parse HEAD` в pilot context → captures pilot's commit hash, не ecosystem's. Verified in re-install: subagent ran `git -C "C:/Users/pw201/WebstormProjects/my-first-test" rev-parse HEAD` → `e248abd292ce907e7f612e8838125087159ee43a`. Это pilot's HEAD; `git cat-file -t e248abd` from ecosystem repo → `bad object`. (Same hash as initial broken install, suggesting that install also ran `git rev-parse HEAD` в pilot context.)
- *Facet 4b:* `commands/integrator/update.md` Stage 3 D2 schema check uses `adapters/<adapter>.js` relative path. В pilot нет `adapters/` directory at project root — путь broken. Should be `.claude/adapters/<adapter>.js` per tri-location.
- *Facet 4c:* D3 body diff `git --no-pager diff <source_ref> HEAD -- adapters/<adapter>.js` runs in pilot's git (или wherever CWD); cross-repo git access не работает (commit hash from another repo's history).
- *Fix direction (для Phase 5.1):* refactor `/integrator:update` Stage 3 на **local-only comparison** — D2 reads CONTRACT_SCHEMA_VERSION из обоих `.claude/adapters/<file>.js` и `.claude/integrator/adapters/<file>.js`; D3: `diff` тех же двух файлов minus metadata header block. `@source_ref` становится audit-only (forensics); drift detection не зависит от ecosystem git access. Adds metadata file `.claude/adapters/.sync-metadata.yaml` stamped by bootstrap/update (last_synced_commit + last_synced_at + last_synced_from).
- *Why deferred:* requires ~50-80 lines изменений в update.md + drift-detection.md skill rewrite. User decision 2026-05-26 — stop at clean win point, не блокирует Phase D Wiki initiative.

### Cosmetic finding (parallel track)

**C-03 generator drift — patch suffix not whitelisted**

- *Symptom:* pilot's `.product/handoffs/FM-001-handoff.md` has `generator: product-module-v1.2.0` (patch suffix `.0`). Reference adapter `SUPPORTED_HANDOFF_GENERATORS` whitelist: `['product-module-v1.0', 'product-module-v1.1', 'product-module-v1.2']`. Patch level не учитывается → C-03 warning fail.
- *Impact:* Not blocking — warning-level check, contract still validates. But surfaces inconsistency between handoff-spec versioning conventions and adapter's whitelist.
- *Fix direction:* expand whitelist matching to semver-range (e.g., `product-module-v1.2.x` matches `product-module-v1.2.0`). Cosmetic, не блокер.

### Decision

**Phase 5 closure ritual Unit 2: COMPLETE** with bugs 1-3 fixed and verified; bug 4 + C-03 deferred to Phase 5.1 patch.

**Architectural refinement: dual-location → tri-location pattern**

Previous design (`adapters/README.md` pre-fix): «адаптеры **не** копируются автоматически в пользовательский проект». Implicit assumption: contract-designer subagent в pilot context имеет path к ecosystem repo's `adapters/`. This assumption was never wired up:
- `~/.claude/ecosystem/` global cache — stripped of `.git` during install per bootstrap Step 2b
- Pilot's filesystem — `adapters/` directory не существует
- Subagent's tool budget (Read/Grep/Glob/WebFetch/Bash) — no cross-process or cross-repo access

Result: Q1 dual-location pattern was unrealizable, что и привело к bug 1's regen-from-scratch.

Refined model (post-fix):

| Layer | Path | Lifecycle | Read/Written by |
|---|---|---|---|
| **Repo canonical** | `<ecosystem-repo>/adapters/<file>.js` | maintainer-edited; semver-bumped between releases | Ecosystem developer |
| **Pilot reference** | `<pilot>/.claude/adapters/<file>.js` | deployed by `/ecosystem:bootstrap`; synced by `/ecosystem:update` | contract-designer (read), pilot AI for custom-author (write) |
| **Pilot instance** | `<pilot>/.claude/integrator/adapters/<file>.js` | created by `/integrator:add`; updated by `/integrator:update` (drift repair) | adapter runtime via `node ... --verify-only` |

Drift detection under tri-location works на pure local file comparison — no cross-repo git access needed.

### Outcome

7 файлов changed в ecosystem repo:
- `hooks/integrator/journal-hook.js` (bug 3)
- `commands/ecosystem/bootstrap.md`, `commands/ecosystem/update.md` (bug 2 — deploy + sync)
- `adapters/README.md` (bug 2 — tri-location refactor)
- `skills/integrator/contract-design.md`, `agents/integrator/contract-designer.md` (bug 1 + bug 2 paths + bug 4a note)
- `commands/integrator/add.md` (bug 2 — Stage 5 path + bootstrap-regression check)

Pilot one-time backfill (next `/ecosystem:update` will keep these synced automatically):
- All 7 files above propagated to `<pilot>/.claude/`
- `.claude/adapters/{handoff-to-ccsdd.js, README.md}` deployed manually

Forensics preserved: `dev/_archive/phase-5/smoke-evidence/integrator-pre-S4/` — broken install snapshot для future debugging reference.

Pilot ready for Phase D Wiki initiative kickoff per `dev/PHASE_D_DOCS_WIKI_READINESS.md`.

### Lessons

1. **Static smoke не ловит cross-platform regressions OR bootstrap-deploy gaps.** Sub-phase J static smoke runs adapter `--verify-only` on ecosystem repo's reference file from ecosystem repo CWD — this always works on test machine. Runtime smoke в pilot context surfaced bugs 1+2+3. *Apply:* каждый Phase ritual должен include pilot runtime smoke as Unit 2 invariant, не just static. Phase scaffolding checklist должен включать «add to bootstrap deploy + update allowlist» item — не assume default `cp -rn` подхватит, т.к. `/ecosystem:update` имеет explicit allowlist.

2. **Tri-location vs dual-location: the third layer wasn't optional.** Project-local reference layer (between repo canonical и pilot instance) — это не nice-to-have, а необходимый mechanism для contract-designer subagent operations. Without it, Q1 was unrealizable. *Apply:* architectural patterns с multi-tier locations должны проходить «can this actually exec в каждом context» verification before документирования. Same lesson likely applies to other (future) cross-repo subagent operations.

3. **Cross-platform path bugs hide в regex separators.** Bug 3 (journal-hook) — variation of DEC-DEV-0031 A1 lesson (regex on multi-entry blocks). *Apply:* always normalize path separators before regex tests. Apply к любым path-matching infrastructures (hook filters, glob patterns, contract validators). Add lint rule? — TODO Phase 5.1.

4. **Hook-driven journals are smoking gun-quality forensics.** Initial broken install's regen-vs-cp was caught by reading journal entries 10:18-10:24 showing piecemeal `node -e` writes. Без hook-driven journal, root cause would've been opaque. *Apply:* journal-hook captures only main-session Bash events (not subagent internals) — limitation. Consider Phase 5.1+ extension to log subagent Bash events (or surface them в a sub-journal).

5. **Metadata field semantics need explicit declaration with operational verification.** Bug 4a surfaced что concept of `@source_ref = ecosystem commit hash` wasn't clear к contract-designer subagent — naive `git rev-parse HEAD` runs in CWD context (pilot's git). *Apply:* every metadata field's source (which repo, which command) должно be документировано в the spec with operational verification clause (`git cat-file -t <hash>` must succeed) as part of contract — это блокирует fabrication. My fail-loud guidance в agent Step 7 was post-hoc — should be normative from spec inception.

6. **Anti-pattern «AI склонен идти narrow when broad needed».** Bug 1's slug-mismatch (`cc-sdd` vs `ccsdd`) — AI следовал literal pattern instruction, не пытался broader matching. Same class as DEC-DEV-0011 (AI «переименовать field для естественности»). *Apply:* в любой skill/agent step «check if X exists», instruct exhaustive enumeration (Glob `*` + slug-tolerant matching) instead of narrow pattern guess. Default to «list all → filter → match» вместо «guess one name».

### Связь с другими entries

- DEC-DEV-0040 — Phase 5 kickoff Q1 dual-location pattern → here refined to tri-location.
- DEC-DEV-0041 — Phase 5 implementation closure; this entry is Unit 2 (runtime smoke) confirming + correcting Unit 1 sub-phases.
- DEC-DEV-0031 A1 — regex-on-multi-entry-blocks lesson; bug 3 is the same class (regex separator assumption).
- DEC-DEV-0011 — AI canonicalization drift; bug 1's narrow-glob is the same class (AI follows literal pattern, не пробует variations).
- DEC-DEV-0042 — `/ecosystem:update` closed-list cleanup pattern; bug 2's allowlist extension follows same convention (explicit subdir list, no runtime inference).

---

## DEC-DEV-0045 — Phase 5.1 patch: bug 4 fix (local-only drift detection) + C-03 generator regex

**Date:** 2026-05-26
**Trigger:** DEC-DEV-0044 deferred bug 4 (`@source_ref` + `/integrator:update` Stage 3 drift checks broken под tri-location) к Phase 5.1 patch; user сразу запросил «Закончи оставленные задачи» — fix landed в той же сессии.
**Tag:** #bug-fix #architecture #refactor

### Context

Bug 4 has 3 facets, all stemming from original Q1 dual-location pattern's broken assumption «pilot имеет path к ecosystem repo's `adapters/`». Tri-location refinement (DEC-DEV-0044) добавил pilot-local reference layer `.claude/adapters/`, но `/integrator:update` Stage 3 + skill drift-detection.md + agent Step 7 ещё ссылались на старую модель (`adapters/` relative, cross-repo `git diff <source_ref> HEAD`).

C-03 (generator drift cosmetic) was bundled в same Phase 5.1 patch — trivial fix (5 lines), кооборачивается с bug 4 для consolidation.

### Options considered

**For bug 4 D2/D3 refactor:**

1. **Cross-repo git access via global cache** — keep ecosystem `.git/` in `~/.claude/ecosystem/`, point drift checks there. *Rejected:* bootstrap explicitly strips `.git/` to avoid nested-repo confusion (Step 2b `rm -rf .claude-ecosystem-tmp/.git`); inverting this introduces new failure modes.

2. **Stamp ecosystem HEAD persistent в pilot, drift compares it to current ecosystem** — would still need cross-repo git access. Same rejection reason.

3. **Local-only drift comparison: pilot reference vs pilot instance** — both files в `.claude/`, no cross-repo. `@source_ref` becomes audit-only field (tracks "this instance was installed when reference layer was at ecosystem commit X"). *Chosen.*

**For `@source_ref` population:**

1. `git rev-parse HEAD` в pilot context — *broken* (captures pilot's HEAD, не ecosystem's). This was the actual bug 4a.
2. Hardcode via product.yaml `ecosystem_version` — but that's version string, not commit hash.
3. **Stamp `.claude/adapters/.sync-metadata.yaml`** by bootstrap/update with `last_synced_commit` field; contract-designer reads from there. *Chosen.* Symmetric with `.claude/adapters/README.md` (also пилот-local), persistent, machine-readable.

### Decision

**Local-only drift detection model:**

| Check | Old (broken) | New (local-only) |
|---|---|---|
| D1 semver | `@target_tool_version` range vs new tool version | unchanged (already local) |
| D2 schema | `adapters/<file>.js` repo path vs installed | `.claude/adapters/<file>.js` (pilot reference) vs `.claude/integrator/adapters/<file>.js` (installed) |
| D3 body | `git diff <source_ref> HEAD -- adapters/<file>.js` (cross-repo, broken) | Header-stripped body comparison of same two pilot files via Node script |

D3 uses heuristic: strip everything before `const CONTRACT_SCHEMA_VERSION` declaration (which acts as natural divider between header metadata and code body — both files have this constant at near-identical line, header before may differ legitimately due to metadata population). Then line-by-line compare; count `fnDriftHits` for transformations function names (transform/validate/parse/extract/slugify) — non-zero = functional drift = repair candidate.

**`@source_ref` audit trail mechanism:**

`/ecosystem:bootstrap` Step 2b/2c captures ecosystem repo HEAD **before** `rm -rf .claude-ecosystem-tmp/.git`. Step 2d writes `.claude/adapters/.sync-metadata.yaml`:

```yaml
last_synced_commit: <ecosystem-repo HEAD at sync time>
last_synced_at: <ISO timestamp>
last_synced_from: https://github.com/IlyaNSV/claude-ecosystem-3.0
```

Same in `/ecosystem:update` Step 3a/3b → Step 5. Subagent `contract-designer` Step 7 reads `last_synced_commit` for `@source_ref` injection. If file missing → write `unknown`; non-fatal.

**C-03 generator regex:**

`SUPPORTED_HANDOFF_GENERATORS` array → `SUPPORTED_HANDOFF_GENERATOR_RE` regex: `^product-module-v1\.(0|1|2)(\.\d+)?$` — accepts both `product-module-v1.2` and `product-module-v1.2.0` (patch suffix optional). Covers existing pilot handoff (`v1.2.0`) and future minor/patch increments without список maintenance.

### Outcome

Files changed:
- `skills/integrator/drift-detection.md` — D2/D3 refactored to local-only; anti-patterns +2 (#6 cross-repo legacy, #7 wrong baseline); cross-ref updated to `.claude/adapters/`
- `commands/integrator/update.md` Stage 3 — D2/D3 commands rewritten к local-only Node scripts; Stage 4 source_ref injection note updated
- `commands/ecosystem/bootstrap.md` — Step 2b captures `ECOSYSTEM_HEAD` before strip; Step 2d stamps `.sync-metadata.yaml`
- `commands/ecosystem/update.md` — Step 3a/3b capture `ECOSYSTEM_HEAD`; Step 5 stamps `.sync-metadata.yaml`
- `agents/integrator/contract-designer.md` Step 7 — reads `last_synced_commit` from `.sync-metadata.yaml`; explicit «never `git rev-parse HEAD` в pilot context» warning
- `adapters/handoff-to-ccsdd.js` — `SUPPORTED_HANDOFF_GENERATORS` array → regex (C-03 cosmetic)

Pilot one-time backfill (next `/ecosystem:update` will refresh both files и stamp metadata in regular flow):
- Updated reference adapter `.claude/adapters/handoff-to-ccsdd.js` propagated
- `.claude/adapters/.sync-metadata.yaml` стамп'ed with current ecosystem HEAD
- Pilot's installed instance (`.claude/integrator/adapters/handoff-to-ccsdd.js`) NOT modified — will detect drift on next `/integrator:update cc-sdd` (D3 fnDriftHits=1 from validateContract change); offers contract repair flow

**S5 runtime smoke verification deferred** per user decision 2026-05-26 («Про s5 пометь только как отложенную и всё»). Code-level fix shipped; runtime end-to-end validation can run в pilot session whenever user invokes `/integrator:update cc-sdd --check-only`.

### Lessons

1. **`git rev-parse` runs in CWD context.** A subagent running в pilot inherits pilot's CWD; `git rev-parse HEAD` captures pilot's git, не ecosystem's. *Apply:* avoid CWD-implicit git commands в cross-repo contexts. Use explicit `-C <path>` flag if you need a specific repo's HEAD, OR persist the value at sync time in a metadata file.

2. **Drift detection should compare local-to-local where possible.** Cross-repo drift (compare pilot's installed against ecosystem repo's reference) requires git access pilot doesn't have. Pilot-local reference layer (added DEC-DEV-0044) makes drift detection purely local — simpler, more robust, no cross-repo dependency.

3. **Audit-only metadata fields deserve explicit «audit-only» annotation.** `@source_ref` was originally drift-primary-key; now it's audit-only. Without explicit annotation, future readers will assume it's load-bearing for drift и introduce bugs. *Apply:* metadata fields with semantic distinction (load-bearing vs audit) should be explicitly tagged in adapter header comments + spec docs.

4. **Capture-before-strip pattern.** Bootstrap strips `.git/` from cloned ecosystem temp. Before stripping, capture HEAD into a shell variable. Apply к any «we'll need this value later but it'll be gone after this step» case.

5. **Whitelist arrays generally need patch-version flexibility.** C-03 `SUPPORTED_HANDOFF_GENERATORS = ['v1.0', 'v1.1', 'v1.2']` failed на `v1.2.0` (patch suffix). Regex with optional patch component is the more robust default. *Apply:* для any «accepted version» whitelist on string fields, default к regex with semver-range tolerance unless explicit major-only matching is the actual semantic.

### Связь с другими entries

- DEC-DEV-0044 — Phase 5 closure deferred bug 4 + C-03 cosmetic к Phase 5.1; this entry IS Phase 5.1 patch landing.
- DEC-DEV-0042 — `/ecosystem:update` allowlist mechanism; this entry extends it with `.claude/adapters/.sync-metadata.yaml` stamping integration в Steps 3/5.
- DEC-DEV-0040 Q1 — original dual-location adapter pattern; superseded by DEC-DEV-0044 tri-location + this entry's local-only drift detection.

---

## DEC-DEV-0046 — Defer Phase D wiki → pivot to local docs polish (phantom-audience guard)

**Date:** 2026-05-27
**Trigger:** Planning session post Phase 5.1 closure разработал full implementation plan для Phase D Wiki initiative (`dev/PHASE_D_IMPLEMENTATION_PLAN.md`, 10 stages, 32-50h realistic). Перед стартом запросили честный анализ alternatives. Сравнение revealed phantom-audience guard: pre-pilot Ecosystem 3.0 не имеет реальных end-user/stakeholder consumers; единственная active audience сейчас — solo dev.
**Tag:** #scope-change #architecture

### Context

Phase D design frozen 2026-05-26 под предположение 3 audiences: solo dev + end-users + stakeholders. Implementation UNBLOCKED после Phase 5.1 (DEC-DEV-0044 + 0045 closure).

Реальность audience landscape (audited 2026-05-27):
- **End-users** — отсутствуют (Ecosystem 3.0 не shipped публично; нет внешних installations кроме pilot `my-first-test`)
- **Stakeholders** — vapor (никто не просит shareable URL; нет stakeholder relationships)
- **Solo dev** — единственный реальный consumer

ROADMAP estimate 16-25h optimistic; ×2-4 multiplier (DEC-DEV-0032 lesson 6) → 32-50h realistic. Pre-implementation honest analysis показал: 80% value (solo dev navigation + graph view + cross-link) достижимо через 4-9h Obsidian + README polish без Wiki / Action / Charter infrastructure.

### Options considered

1. **Continue Phase D as designed.** 32-50h на полную инфраструктуру. Pros: serves all 3 audiences when they arrive. Cons: builds for vapor consumers; ongoing API credits ($1-3/мес) + maintenance burden; charter discipline без real content saturation.

2. **Phase D minus DW.H (auto-sync action).** ~25-40h. Pros: всё human-facing infra без action complexity; manual `/docs-update` weekly. Cons: still over-engineering для absent audiences.

3. **Obsidian + README polish (alternative track).** 4-9h. Pros: proportional to current audience reality; reversible; preserves Phase D design fully для bring-forward. Cons: solo-only; no public URL; no audience-tagging.

4. **README polish only.** 5-10h. Pros: cheapest. Cons: doesn't add graph view / backlinks; solo dev memory marginally improved.

5. **RAG over repo via MCP.** ~10-15h setup + $5-15/мес. Pros: AI-native search. Cons: solves different problem (AI search vs human reading); не serves any of 3 audiences для documentation purposes.

### Decision

Variant 3 — pivot to **Obsidian local + README polish**. Phase D plan + readiness + design preserved as DEFERRED для bring-forward triggers.

**Plan:** `dev/LOCAL_DOCS_POLISH_PLAN.md` (created 2026-05-27, 5 stages, 4-9h estimate).

**Bring-forward triggers** (любого достаточно для возврата к Phase D):
- First real end-user feedback / ask «where do I start»
- Stakeholder asks for shareable URL
- Solo dev обнаруживает Obsidian недостаточным (audience-tagging, cross-tool sharing)
- Ecosystem 3.0 готовится к public release (>2 weeks horizon)

### Outcome

Local docs polish track completed in single execution session 2026-05-27 (planning + Stages 1-5):

**Timing.** Plan estimate 4-9h optimistic; actual ~30-45 min focused work + ~30 min planning conversation. Significantly under budget — see Lessons #5 ниже.

**Commits (4 total):**
1. `2123ab1` — Stage 1 pivot recording (DEV_JOURNAL DEC-DEV-0046 open + DEFERRED banners + v1_1_backlog + ROADMAP + CLAUDE.md snapshot)
2. `2f83b30` — Stage 2 Obsidian vault baseline (.gitignore patterns + .obsidian/app|appearance|core-plugins.json)
3. `b2c5d4a` — Stage 3 cross-link polish (README «Где начать», new `docs/README.md` index, 3 SPEC «Related» blocks, PMO «Читать вместе с», artifacts/README stale-refs cleanup)
4. (this commit) — Stage 5 closure (CHANGELOG, memory sync, DEC-DEV-0046 Outcome, ROADMAP/CLAUDE.md refresh)

**Artifacts shipped:**
- New: `dev/LOCAL_DOCS_POLISH_PLAN.md`, `docs/README.md`, `.obsidian/{app,appearance,core-plugins}.json`
- Modified: README.md, CLAUDE.md, ROADMAP.md, .gitignore, v1_1_backlog.md, 3 module SPECs, pmo-map.md, validation.md, artifacts/README.md, PHASE_D_DOCS_WIKI_READINESS.md (DEFERRED banner), PHASE_D_IMPLEMENTATION_PLAN.md (DEFERRED banner)

**Stage 4 (MCP bridge) — confirmed deferred** (AskUserQuestion 2026-05-27): user chose «Skip per original plan». Rationale stands — Claude already has direct file access; MCP не даёт incremental value для нашего setup.

**Phase D preservation intact:**
- `dev/wiki-design.md` (§1-17) — unchanged
- `dev/PHASE_D_DOCS_WIKI_READINESS.md` (A-H) — unchanged body, DEFERRED banner added
- `dev/PHASE_D_IMPLEMENTATION_PLAN.md` (10 stages) — unchanged body, DEFERRED banner added
- `dev/v1_1_backlog.md` — full architectural intent for bring-forward
- Resumption cost при triggers: ~30 min context refresh + fresh-session kickoff per Stage 0 plan

**Tech debt discovered (Stage 3, не absorbed):**
- 22 individual artifact files в `docs/pmo/artifacts/*.md` still contain «(в разработке)» markers for skills that shipped Phase 3-4. Flagged в Stage 3 commit body; deferred к separate doc-maintenance sweep (~1h estimated). Not blocker для discoverability цели Stage 3.

### Lessons

1. **Phantom-audience guard requires explicit check pre-implementation.** Phase D design conversation 2026-05-26 предполагал 3 audiences без проверки existence. Если бы alternative analysis запросили до design freeze — Phase D, возможно, не понадобилось бы спроектировать с такой полнотой. *Apply:* для любой phase, обслуживающей multiple audiences — explicit check existence each audience **перед** design depth investment.

2. **Plan completeness ≠ plan applicability.** Phase D design (wiki-design §1-17 + readiness A-H) проработан тщательно; это не делает его правильным выбором сейчас. *Apply:* full plan + готовность стартовать — не достаточное основание; всегда проверять «нужно ли это нам сейчас?»

3. **Reversibility budget keeps deferrals cheap.** Phase D plan + readiness + design preserved (DEFERRED banners, не deletes). Если bring-forward trigger fires через 3 месяца — resumption cost ~30 min context refresh, не 16h re-design. *Apply:* defer ≠ delete; preserve full architectural intent в v1.1+ backlog с pointers к canonical artifacts.

4. **Honest alternative analysis окупается даже когда план не меняется.** Если бы анализ показал «текущий план оптимален» — confirmation тоже polish. Pivot случился потому, что было где pivot'нуть. *Apply:* alternatives analysis pre-implementation — must-have для substantive phases (>10h estimate), даже если кажется решённым.

5. **Methodology-only tracks (без новых mechanisms / architectural decisions / code) deserve lower estimate multiplier.** Plan estimate 4-9h; actual ~30-45 min focused work. Previously calibrated: methodology-heavy phase → ×1-2 (per DEC-DEV-0041 lesson), code-heavy → ×3-5. New refinement: **polish-only** (docs cross-links, baseline config, no new artifacts/mechanisms) → **×0.3-0.5** vs initial estimate. Reasoning: no architectural unknowns, no implementation ambiguity, no test/smoke overhead. *Apply:* before estimating polish/maintenance tracks, ask «есть ли новые mechanisms or just rearranging existing artifacts?» — если последнее, halve estimate.

6. **Cuttable scope discipline pays when tech debt discovered mid-stage.** Stage 3 surfaced 22 artifact files с stale «в разработке» refs — temptation to absorb into Stage 3 (+1-2h) was real, since «уже здесь, давай разом». Stayed disciplined: flagged in commit body, deferred к separate sweep. Result: Stage 3 closed cleanly с focused commit; tech debt visible for future scheduling. *Apply:* discovered tech debt mid-stage → ALWAYS flag-and-defer (in commit message + DEV_JOURNAL if substantive) unless directly blocks current stage's goal; never silently absorb.

### Связь с другими entries

- DEC-DEV-0044 + DEC-DEV-0045 — Phase D unblocking; this entry откладывает реализацию обратно.
- DEC-DEV-0032 lesson 6 — ×2-4 estimate multiplier; tilted cost-benefit calculation against full Phase D.
- DEC-DEV-0040 Q3 boundary discipline — same family of «phantom audience / phantom scope» reasoning, now formalized as pre-implementation check.

---

## DEC-DEV-0047 — Patch 1.3.3: Integrator scope discipline + env tiers + pending-actions журнал

**Date:** 2026-05-27 (kickoff) → 2026-05-27 (implementation closure same day)
**Trigger:** Pilot session `636f2cd3-80e7-4c3c-8626-8a2f1e02d11a` (заполнение PMO GAPS на `my-first-test/`) выявила 4 паттерна нарушений / gaps Integrator-модуля.
**Tag:** #architecture #spec-revision #ux #bug-fix #pilot-finding
**Status:** ✅ Implementation closed. Runtime smoke (`dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md`) — 5 scenarios drafted, execution at user's discretion in next pilot session.

### Context

Pilot session показала 4 паттерна Integrator-поведения:
1. **PROD-only рекомендации** без разбивки local-dev / staging / production (env tiers gap в SPEC).
2. **Самостоятельное scope-creep в архитектурные решения** через ad-hoc consilium-research без approve gate (формальные commands ОК, ad-hoc обходит).
3. **Запись в `.product/`** — direct violation SPEC §1.2, §8.1, installation-protocol Anti-pattern #5. Нет runtime guard.
4. **«🚧 Требует USER»** action items в narrative отчёте — нет structured pending-actions журнала, юзер пропускает.

Подробный gap-анализ + evidence — `dev/PATCH_1.3.3_READINESS.md` Section «Trigger & evidence».

### Options considered

1. **Patch 1.3.3 — focused 4 deliverables (выбрано).** Scope: env tiers schema + scope-guard hook + pending-actions журнал + research approve gate. Hard block отложен к v1.4.0 (нарушает ecosystem warn-only hook convention).
2. **Minor 1.4.0 — extended scope.** Добавляет hard-block hook + cross-hook centralized FORBIDDEN_PATHS + PA expiry. Отвергнуто: пере-инжиниринг до validation в pilot.
3. **Skip — оставить prompt-discipline only.** Отвергнуто: pilot evidence показал prompt-уровень недостаточен; нужен runtime mechanism хоть warn-only.

### Decision

Вариант 1 — patch 1.3.3 с D7 phase-kickoff ritual (Sections 1-5 в `dev/PATCH_1.3.3_READINESS.md`). 4 deliverables B-1/B-2/B-3/B-4.

Architectural decisions (детально в readiness MD Section 1):
- **B-1:** `environment_tiers` multi-valued поле в tool profile (SPEC §4.1) — local_dev/staging/production × full/partial/none. Research output обязан содержать per-tier разбивку.
- **B-2:** `hooks/integrator/scope-guard.js` PreToolUse warn-only, matcher `Edit|Write|Bash`. Bash — простой regex sniffer. Session marker `.claude/integrator/.session-context.json` для context detection. 1-час stale TTL.
- **B-3:** `.claude/pending-actions.md` ecosystem-wide markdown журнал. Команда `/ecosystem:pending-actions` + skill `skills/ecosystem/user-action-tracker.md`. Любой модуль может писать; integration через research-protocol + installation-protocol.
- **B-4:** Mandatory approve gate в research-protocol Phase 5 + `/integrator:research` Step 7 hard gate. Новая SPEC §7.X для consilium-pattern: разрешён только с declared scope.

Cuttable scope: hard block (v1.4.0), cross-module broker, PA expiry, retroactive YAML migration, centralized FORBIDDEN_PATHS — все отрезаны.

Implementation: **fresh-session** per D7 phase-kickoff RECOMMENDED (anti-bias guard). Prompt template — конец readiness MD.

### Outcome

Fresh-session implementation 2026-05-27 — sub-phases A→I executed sequentially с commit per sub-phase:

**Commits (9 total):**
1. `4d23dbc` — kickoff (DEC-DEV-0047 stub + readiness gate + v1.1+ backlog)
2. `6c640c2` — sub-phase A — SPEC env_tiers + consilium + approve discipline
3. `40d29e1` — sub-phase B — skills (research-protocol, installation-protocol, tool-profiling)
4. `c3bca76` — sub-phase C — research hard gate + 9 session-marker boilerplates
5. `aec87e8` — sub-phase D — scope-guard hook + manifest + smoke fixture (5 cases)
6. `05df3b0` — sub-phase E — pending-actions infra (skill + command)
7. `162b730` — sub-phase F — bootstrap/update integration (init + backfill)
8. `c71d3e6` — sub-phase G — smoke test plan (5 runtime scenarios)
9. (this commit) — sub-phase H — DEV_JOURNAL Outcome + CHANGELOG + ROADMAP + CLAUDE.md
10. (next) — sub-phase I — release tag v1.3.3

**Artifacts delivered:**

**New files:**
- `hooks/integrator/scope-guard.js` — PreToolUse warn-only, marker-gated, 1h stale TTL, forbidden paths (`.product/`, `.kiro/`, `docs/pmo/`, `.claude/docs/pmo/`), whitelist exceptions, Bash regex sniffer, PA append on violation (dedup by `(action, subject, minute)`)
- `commands/ecosystem/pending-actions.md` — read-only listing with --status / --source / --limit filters
- `skills/ecosystem/user-action-tracker.md` — schema + append/mutate protocol (new directory `skills/ecosystem/`)
- `dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md` — 5 scenarios (S1-S5) для runtime execution

**Modified — SPEC:**
- `docs/integrator-module/SPEC.md` §3.1 (approve discipline note), §4.1 (`environment_tiers` block in profile schema), §4.2.1 (new — semantics + research/install integration), §7.6 (new — consilium-pattern declared-scope requirement)

**Modified — skills:**
- `skills/integrator/research-protocol.md` — Phase 1 env-tier ID + consilium check, Phase 4 extraction guidance, Phase 5 guards + hard approve gate, Phase 8 PA append, +4 anti-patterns
- `skills/integrator/installation-protocol.md` — Anti-pattern #5 scope-guard ref, Anti-pattern #8 PA append, Section 10 session-context marker boilerplate
- `skills/integrator/tool-profiling.md` — profile schema env_tiers REQUIRED, Step 4.5 extraction guidance, +2 anti-patterns

**Modified — commands:**
- `commands/integrator/research.md` Step 7 — hard gate analog add.md Stage 2; +Step 0/9 session marker write/cleanup
- `commands/integrator/{add,remove,update,scan,gaps,status,map,journal}.md` — session marker boilerplate (Step 0 / Pre-flight write + Final cleanup)
- `commands/ecosystem/bootstrap.md` Step 6c — initialize `.claude/pending-actions.md` with PA-000 sentinel
- `commands/ecosystem/update.md` — preserve PA in user zone + Step 5b backfill (bash + PowerShell variants)

**Modified — infrastructure:**
- `hooks/integrator/manifest.yaml` — register scope-guard PreToolUse
- `dev/meta-improvement/scripts/smoke-hooks.js` — extended harness (toolName/toolInput overrides, env merge, expectStderrAbsent) + helper writeIntegratorMarker / cleanupIntegratorMarker + 5 new scope-guard cases. All 13 hook cases PASS.

**Static smoke (Sub-phase D):** ✅ green — 13/13 hooks PASS.

**Runtime smoke:** ⏳ deferred to next pilot session (S1-S5 plan ready); same model as DEC-DEV-0045 S5 deferral.

### Lessons

1. **Patch-level readiness pattern proven.** `dev/PATCH_1.3.3_READINESS.md` (not `PHASE_<N>_READINESS.md`) — naming convention works for sub-phase-level work without phase ceremony. Apply: future patches that touch ≥3 sub-systems get a `PATCH_<version>_READINESS.md` mini-readiness; pure cosmetic patches don't need it.

2. **Anti-bias guard surfaced 3 refinements during fresh-session execution** (vs prev session's readiness draft):
   - Forbidden paths in B-2 needed `.claude/docs/pmo/` (pilot variant) in addition to bare `docs/pmo/` (ecosystem repo variant) — readiness didn't cover the pilot path layout explicitly.
   - Cross-platform Step 5b in `/ecosystem:update` needed PowerShell variant (parity with Step 5a contamination cleanup) — readiness omitted Windows path.
   - Whitelisted exceptions for hook needed `.claude/pending-actions.md` and `.scope-guard-dedup.json` itself (else hook would warn on its own writes) — readiness mentioned exceptions but not the self-write case.

   *Apply:* fresh-session ≠ rubber-stamp; readiness sets direction, execution surfaces details. Plan-quality dependency: fresh-session AI should always feel licensed to refine and surface, not just execute.

3. **Marker-gated PreToolUse worked first try on Windows.** Initial concern (filed in this session's prompt as anti-bias guard) was that PreToolUse hook on Bash matcher may fail on Windows — turned out non-issue: Claude Code hook stdin JSON contract is platform-agnostic. *Apply:* don't prematurely worry about cross-platform hook regressions if reading stdin JSON + writing stderr; concerns surface only on filesystem path normalization (which we already handle via `replace(/\\/g, '/')`).

4. **Session marker as PRG-loadable convention.** Pattern: hook checks for `.claude/integrator/.session-context.json` to know «is module X active?» — solves the «who's calling» problem without env vars (which don't pass through markdown slash commands), without transcript scanning (fragile), without explicit cross-tool calls. Likely reusable for future modules (e.g., `.claude/design/.session-context.json` when Design Module gets its own scope-guard). *Apply:* if future modules need scope-gating, mirror this marker convention.

5. **Hard approve gate UX requires explicit «silence ≠ consent».** Research.md Step 7 added a `STOP. Approve research outcome?` block plus prose explanation that:
   - silence → wait (not chain forward),
   - defer → cache + journal `deferred`, no install,
   - numbered choice → record decision, **don't auto-invoke `/integrator:add`** (user invokes separately).
   This separation («research = what», «add = when») is intentional. Pilot evidence showed soft prompts get bypassed. *Apply:* whenever an AI tendency to chain forward shows up in pilot evidence, the fix is more wording, not less.

6. **PA-NNN counter via tail scan + sentinel.** Counter scheme is robust because PA-000 sentinel guarantees regex match never returns empty; mid-file insertion is forbidden (tail-append only); user manual edits OK because they don't break the counter. Schema versioning is in-place via «forward compat plan» note. *Apply:* counter-based ID schemes in markdown journals — sentinel + tail-append + no-renumber = simple working pattern.

7. **Sub-phase commit cadence pays off for review traceability.** 8 commits A→H + kickoff + tag = 10-commit linear history. Each commit message describes deliverable + per DEC-DEV-0047 ref. *Apply:* continue sub-phase-per-commit pattern for substantial patches; reviewers can pinpoint regressions quickly.

8. **Scope-guard whitelist drove implementation:** initially the hook's own writes to `.claude/pending-actions.md` and `.scope-guard-dedup.json` would have triggered itself (infinite recursion within minute window). Whitelist exceptions are not cosmetic — they're load-bearing. *Apply:* when a hook reads + writes anything, audit «would the hook fire on its own writes?» before shipping.

### Связь с другими entries

- DEC-DEV-0041 (Phase 5 implementation) — base, на которой растёт scope-guard infrastructure (Integrator module)
- DEC-DEV-0045 (Phase 5.1 patch / 1.3.2) — analog patch pattern + S5 runtime deferral precedent
- DEC-DEV-0046 (Defer Phase D Wiki) — analog «cuttable scope discipline» pattern (warn-only over hard-block, see v1_1_backlog entry)
- DEC-DEV-0040 Q6 — journal-hook PostToolUse precedent; scope-guard is PreToolUse mirror
- DEC-DEV-0023 — dedup-by-(action,subject,minute) precedent (cascade-pending lesson)
- DEC-DEV-0019 / 0042 — `/ecosystem:update` allowlist + contamination cleanup pattern; sub-phase F extends it

### Связь с другими entries

- DEC-DEV-0041 (Phase 5 implementation closure) — base, на которой растёт scope-guard infrastructure
- DEC-DEV-0045 (Phase 5.1 patch / 1.3.2) — analog patch pattern (focused fix + light scope)
- DEC-DEV-0046 (Defer Phase D Wiki) — analog «cuttable scope discipline» pattern
- Future: DEC-DEV-0048 (planned) — closure entry после fresh-session implementation + pilot re-run

---

## DEC-DEV-0048 — Pre-Phase-6 architectural addendum: Claude Design co-primary + IR groundwork

**Date:** 2026-05-27
**Trigger:** User-initiated session question — «надо доделать design модуль ... ориентируемся на Google Stitch и Claude Design, надо продумать выбор инструмента и его смену, а также указание инструмента в артефактах ... на будущие версии заложить механизм миграции фактического отображения интерфейса из одной системы в формат другой».
**Tag:** #architecture #spec-revision #scope-change

### Context

Phase 6 (Design Module) — conditional, trigger по first FM с has_ui=true. SPEC v1.0 (2026-04-18) описывал tool stack как «Stitch primary, Figma future, HTML fallback» — без Claude Design (продукт ещё не существовал на момент написания v1.0). Frontmatter поле `design_tool: stitch | figma | penpot | html` уже было готово к расширению. Tool switching формально проходил как OQ-DM-02 deferred к v2; `/design:migrate` упоминалась только как Stitch ↔ HTML.

User поднял три отдельных требования:
1. **Claude Design integration** — добавить как поддерживаемый tool наряду со Stitch.
2. **Tool switching mechanism** — формализовать выбор и смену.
3. **Migration mechanism для visual representation** — на будущие версии заложить fundament.

Research (WebFetch на claude.ai support article + WebSearch) дал baseline профиль Claude Design на 2026-05-27:
- Conversational design (`claude.ai/design`), powered by Claude Opus 4.7
- Research preview на Pro/Max/Team/Enterprise (default off Enterprise)
- Export: ZIP / PDF / PPTX / Canva / standalone HTML / **native «Handoff to Claude Code»**
- DS auto-inheritance из org's design system
- **MCP/API публично не выпущены**; Anthropic анонсировала «integrations over coming weeks»
- Known limitations: comment persistence, compact view save errors, large codebase lag

Критическое наблюдение: «Handoff to Claude Code» в Claude Design пересекается с Ecosystem `/product:handoff` semantically. Нужно явно развести.

### Options considered

**A. Минимальный план + IR groundwork (выбран)**
- Claude Design добавлен как co-primary в SPEC §9.1 наряду со Stitch
- `design_tool` enum расширен: `stitch | claude-design | figma | penpot | html`
- `/design:migrate` расширен до Stitch ↔ Claude Design ↔ HTML matrix (lossy regeneration через brief + MK metadata)
- MK frontmatter migration trail: `previous_tools[]`, `tool_switched_at`, `ir_snapshot_path?` (последнее — noop hook для v2)
- `design.yaml` ir_export flag — placeholder для v2
- Новая SPEC §16 «Migration-readiness & IR» — концепт neutral declarative IR + adapter contract table + bring-forward triggers + risk register

Pros: даёт Claude Design support быстро + закрывает 80% user request; IR концептуально документирован без implementation overhead; OQ-DM-02 partially closed (variant A path), OQ-DM-07 опубликован.
Cons: cross-tool migration в v1 остаётся lossy regeneration — точные визуальные tweaks теряются; tool-specific features (Stitch animations, Claude Design interactive prototypes) не переносятся.

**B. Полноценный IR-слой сейчас**
- Спроектировать neutral mockup representation (YAML schema)
- Реализовать export/import adapters для Stitch / Claude Design / HTML
- `/design:migrate` через IR — lossless для covered features

Pros: фундаментальное решение проблемы tool-switching, future-proof.
Cons: оценка 8-15ч design + 4-8ч per adapter (~25-40ч total минимум); blocked на Claude Design MCP/API (TBD per Anthropic roadmap); v2 без реального pilot pain — premature optimization (CLAUDE.md «cuttable scope default» принцип); большая часть IR schema может не сойтись с реальностью первых tools (нет 2-х stabilized API).

**C. Stub Claude Design + отложить всё**
- Просто упомянуть Claude Design в OQ-DM-02 как future option
- Не менять frontmatter, не менять `/design:migrate`

Pros: минимум изменений сейчас.
Cons: user explicit request не закрыт — «надо продумать выбор инструмента и его смену, а также указание инструмента в артефактах»; решение «давай вариант А с заделом на IR» специфически отвергает этот путь.

### Decision

**Вариант A — Claude Design co-primary + IR groundwork.**

Конкретные изменения (Narrow scope per user direction):
1. **`docs/design-module/SPEC.md` → v1.1:** §1.4 (двухканальный вывод + migration limitation note), §2.1 (commands count → 6, skills → 6, MCP — Stitch + Claude Design), §3.6 (`/design:migrate` Stitch ↔ Claude Design ↔ HTML), §4.4a (`claude-design-workflow.md` skill spec), §8.1 (`design.yaml` ir_export flag + claude-design в fallback chain), §9.1 (Claude Design co-primary tool block), §9.6 (graceful degradation chain), §13 (OQ-DM-02 partially resolved + new OQ-DM-07 IR), **новая §16** (Migration-readiness & IR — 6 sub-sections: principle, v1.1 lossy, v2 lossless concept, v1.1 hooks, bring-forward triggers, risk register).
2. **`docs/pmo/artifacts/MK.md`:** frontmatter enum + migration trail fields (`previous_tools[]`, `tool_switched_at`, `ir_snapshot_path`) + anti-patterns + Common Mistakes #6-#7.
3. **`dev/PHASE_6_READINESS.md`:** Status banner update, Section A pre-Phase-6 addendum check, Section C — split на «Решено в pre-Phase-6 addendum» (6 пунктов ✅) + «Всё ещё открытые» (OQ-DM-01, новый OQ-DM-08 для Claude Design prompt patterns, Component State Matrix automation, HTML fallback completeness, `/design:migrate` UX), Section D — estimate update (10-20ч с addendum), Section E pilot gates updated.
4. **`DEV_JOURNAL.md`:** этот entry (DEC-DEV-0048).

**Принципиальные разграничения, codified в addendum:**
- Ecosystem `/product:handoff` = **product-level behavioral spec** (universal handoff.md)
- Claude Design «Handoff to Claude Code» = **design-level visual bundle** (HTML + assets)
- **Комплементарны, не конкурирующи** — Ecosystem handoff §10 может ссылаться на Claude Design bundle URL

**Принципиальное ограничение v1.1, codified:** cross-tool migration — **lossy regeneration**, не lossless transfer. Сохраняется: Screen Inventory, Component State Matrix, Interaction Spec, DS tokens, Accessibility Notes, Design Decisions Log. Теряется: точные визуальные tweaks, tool-specific features, iteration history в source tool.

### Outcome

Pre-Phase-6 architectural addendum зафиксирован до Phase 6 kickoff. Phase 6 kickoff унаследует эти решения; не нужно повторять ту же дискуссию через 5-15+ часов (когда первая UI-фича появится в pilot). Это **front-loaded design discipline** аналогично Phase 4 pre-implementation kickoff (DEC-DEV-0030) и Phase 5 readiness gate (DEC-DEV-0040) — паттерн себя оправдал.

Bring-forward triggers для v2 IR-слоя (см. SPEC §16.5):
- Реальный pain point: ≥1 проект совершил >1 tool switch и пожаловался на regeneration cost
- API maturity: ≥2 tools имеют stable read/write API
- Adapter ecosystem: появилась 3rd-party конвенция universal component vocabulary
- User explicit request: «нам нужна lossless migration»

До тех пор v1.1 lossy regeneration sufficient.

### Lessons

1. **Pre-phase architectural addendum паттерн оправдан для conditional phases.** Phase 6 — conditional (может не активироваться месяцами/годами); фиксировать архитектурные решения сейчас, пока контекст свежий, дешевле, чем восстанавливать его при kickoff. *Apply:* для других conditional phases (Phase 7 Integrator maintenance) — те же front-loaded решения, когда триггер случается.

2. **Tool ecosystem evolution > project lifetime в design zone.** Stitch и Claude Design — оба research-preview-уровня в 2026, Figma меняет API, новые AI-design tools появляются. SPEC должен изначально быть migration-aware, не bolt-on. Frontmatter `previous_tools[]` + IR hook — даже если IR никогда не имплементирован, audit trail tool switches уже ценен.

3. **«Native handoff» от другого vendor требует семантического разграничения.** Claude Design native «Handoff to Claude Code» легко спутать с Ecosystem `/product:handoff`. Чёткое определение «product-level behavioral vs design-level visual» сразу в SPEC §4.4a + §16 предотвращает confusion при Phase 6 implementation. *Apply:* при добавлении новых tools с overlapping naming проверять semantic conflicts с Ecosystem terminology.

4. **Lossy regeneration — приемлемый v1 для tool switching, если sufficient metadata сохраняется в Ecosystem.** Key insight: визуал — output из metadata + DS + brief, не первичный артефакт. Регенерация в новом tool по тем же inputs даёт «equivalent» (not identical) результат. Identity между визуалами через tools невозможна в принципе из-за tool-specific UI vocabulary; equivalence — реалистичный target.

5. **IR-слой требует ≥2 stabilized API для содержательного дизайна.** Сегодня Stitch MCP — partially stabilized; Claude Design — TBD; Figma — ок. Один stable API недостаточно для universal schema. Решение «IR groundwork without IR implementation» — правильная middle ground: hooks active, поведение noop, schema design отложен до bring-forward trigger.

6. **WebFetch + WebSearch для unknown vendor: tilt towards «record baseline + flag unknowns»** rather than «extrapolate from partial info». В addendum явно записано «known limitations baseline 2026-05-27, могут устареть» — это правильный hedge против информации, которая будет устаревать каждые несколько недель в research-preview product.

### Связь с другими entries

- DEC-DEV-0030 (Phase 4 pre-implementation kickoff) — аналог front-loaded design discipline; ambiguity resolution до implementation
- DEC-DEV-0040 (Phase 5 readiness gate) — аналог: kickoff-уточнение scope до implementation
- DEC-DEV-0046 (Defer Phase D wiki) — аналог cuttable-scope discipline; Phase 6 IR-полная-имплементация имеет ту же phantom-audience потенциальную проблему (нет 2-го реального проекта на 2-х tools)
- DEC-DEV-0040 Q1 (tri-location pattern) — аналог dual hooks в frontmatter: «active поле + хранение для будущего use case»

---

## DEC-DEV-0049 — Patch 1.3.4: `/ecosystem:update` Step 6 — REPLACE → pattern-preserving merge

**Date:** 2026-05-27
**Trigger:** Downstream forensic analysis (`my-first-test` session 2026-05-27, ~22:00 MSK) — после `/ecosystem:update 1.3.1→1.3.3` обнаружено, что `bd-prime` hooks (SessionStart + PreCompact) injected by `bd setup claude` стёрты из `.claude/settings.json`. Pattern recurring: downstream's `active-tools.yaml#beads.side_effects` уже зафиксировал gap явно — «Beads bd-prime hooks may be wiped again by next /ecosystem:update unless protected». DEC-INT-0005 в downstream закрепил known issue.
**Tag:** #bug-fix #spec-revision #architecture #pilot-finding

### Context

`/ecosystem:update` Step 6 (per DEC-DEV-0019 original design, 2026-04-26) делал hard REPLACE hooks section: re-derive из manifest'ов, выкидывая всё что туда инжектировали третьи стороны. Rationale тогда: «manifest = single source of truth; если user хочет custom hooks, добавит вручную post-update». На момент дизайна Integrator Module ещё не существовал; third-party tools не входили в ecosystem ментальную модель.

Phase 5 (DEC-DEV-0041, 2026-05-25) представил Integrator Module — формальный механизм регистрации third-party tools (cc-sdd, beads). Tools могут injection-style добавлять hooks в `.claude/settings.json` (`bd setup claude` делает exactly это: appends `SessionStart`/`PreCompact` для `bd prime`). REPLACE-семантика Step 6 стирает их при каждом update'е → пользователь должен запускать `bd setup claude` после каждого upgrade'а ecosystem'а.

Forensic timeline 2026-05-27 в `my-first-test` показал: cycle (update wipe → bd setup restore) уже произошёл дважды в одной сессии. Если ecosystem updates чаще раз-в-месяц — это persistent papercut.

**Асимметрия с bootstrap.** Bootstrap Step 6b (`commands/ecosystem/bootstrap.md:441-446`) уже делал merge-preserve correctly («preserve user-added hooks; merge, don't overwrite»). Inconsistency между bootstrap и update — случайность DEC-DEV-0019 timing (bootstrap evolved earlier, update written с другим mental model), не намеренный дизайн.

### Options considered

**A — Pattern-based preservation + optional active-tools.yaml audit (выбран)**
- Identify ecosystem-owned entries by canonical command pattern `^node \.claude/hooks/(product|integrator|ecosystem|design)/`
- Re-derive только ecosystem entries из manifest'ов
- Preserve everything else verbatim
- Optional: IF `.claude/integrator/active-tools.yaml` available → label preserved entries by owning tool (audit-only, не блокирует merge)

Pros: self-contained, нет hard cross-module dependency, симметрия с bootstrap Step 6b, handles bd case и любой future `*-setup claude`-style инструмент. Audit-label даёт diagnostics без увеличения coupling. Минимум изменений в spec'е.
Cons: если ecosystem hooks когда-нибудь сменят runtime (shell вместо node, npx exec, etc.) — pattern regex придётся обновить. Solvable: regex явный, обновление trivial; в будущем module-namespace будет explicit инвариант.

**B — Full Integrator-registry-driven preserve**
- Read `.claude/integrator/active-tools.yaml`, extract `claude_primitives` где `type: hook`
- Preserve строго те entries, что зарегистрированы

Pros: architecturally rigorous, per-tool ownership explicit, audit trail per-tool.
Cons: hard cross-module dependency ecosystem→integrator. Tools registered post-fact (e.g. bd registered via adopt-existing 2026-05-27T17:00Z) — pre-registration gap создаёт unhandled state. Если active-tools.yaml corrupted или absent (greenfield bootstrap чуть-позже install third-party) → degraded mode. Solvability requires fallback к pattern-match anyway — т.е. B = A + extra coupling.

**C — Preserve unknowns (diff-and-preserve everything not in manifest)**
- Anything в existing settings.json не matching newly-derived → preserve unconditionally, warn

Pros: cannot accidentally wipe.
Cons: accumulates cruft over time (obsolete hooks live forever); loses «manifest as source of truth» property; entropy risk; warning fatigue.

### Decision

**Вариант A — pattern-based preserve + soft B (audit-only consult active-tools.yaml).**

Конкретные изменения:
1. **`commands/ecosystem/update.md` Step 6** — переписан с REPLACE на merge-preserve: pattern (primary) decides preservation; audit-label (optional) добавляет ownership annotation в print confirmation если active-tools.yaml available. Print confirmation extended (separate «Preserved (non-ecosystem)» block + ownership labels).
2. **`commands/ecosystem/bootstrap.md` Step 6b** — **без изменений**: уже делал merge-preserve. Confirmed symmetry с update.
3. **`CHANGELOG.md`** — 1.3.4 entry под `### Fixed`.
4. **`ROADMAP.md`** — «Где мы сейчас» snapshot обновлён.

### Outcome

Spec change shipped в patch 1.3.4. Implementation = новый текст `commands/ecosystem/update.md` Step 6 (Claude interprets `.md` directives; no JS code). Smoke verification = next pilot session `/ecosystem:update` в `my-first-test`: после update'а bd-prime hooks должны остаться в `.claude/settings.json` без необходимости запускать `bd setup claude`.

Backward compatibility: для projects без third-party hooks behavior идентичен старому REPLACE (preserved=empty). Для projects с third-party hooks — non-destructive update. No migration required.

### Lessons

1. **Symmetry between bootstrap и update — must-have инвариант.** Bootstrap Step 6b делал merge-preserve, update Step 6 — REPLACE. Inconsistency была случайностью DEC-DEV-0019 timing. Future spec invariants: при designing twin-commands (bootstrap + update / install + upgrade) — explicit table «как они должны быть аналогичны и где специфика». *Apply:* при добавлении новых ecosystem commands с lifecycle вариантами (install / upgrade / remove) — проверять symmetry первым delom.

2. **Pilot-driven discovery validates DEC-DEV-0040 functional decomposition.** Integrator Module как formal layer уже знал про этот gap (active-tools.yaml `side_effects` field явно его документировал). Сначала Integrator зафиксировал в downstream DEC-INT-0005, потом ecosystem-level fix через DEC-DEV-0049. Это правильное направление flow: downstream pain → upstream spec. *Apply:* при review downstream Integrator state — `side_effects` поле читать как signal список upstream issues, не как passive metadata.

3. **Cross-module read-only deps OK; write deps not.** Update reading active-tools.yaml для audit — fine. Update writing в active-tools.yaml — было бы плохо (loop). Pattern-preserve A primary + B audit-only respects this. *Apply:* при добавлении cross-module reads в spec — фиксировать «read-only» property явно в rationale, чтобы будущая эволюция не сваливалась в write-coupling.

4. **A1 verification antipattern: «read disk, dispute scan claims» без timeline reconstruction.** Initial A1 analysis в этой сессии заключил «scan лжёт» — фактически scan был truthful на момент 18:30, между scan и моим read'ом запустили `bd setup claude` + manually edited integrator yamls. Правильная procedure: timeline first (reflog + journal-hook + active-tools timestamps), потом dispute. Сохранено как feedback memory (`feedback_drift_verify_timeline_first.md`).

### Связь с другими entries

- DEC-DEV-0019 — original `/ecosystem:update` design (REPLACE rationale, теперь revised)
- DEC-DEV-0040 — Phase 5 Integrator functional decomposition (Integrator as formal third-party layer)
- DEC-DEV-0041 — Phase 5 implementation (introduced third-party tool injection paths)
- DEC-DEV-0042 — closed-list contamination removal в update Step 5a (sibling pattern: specific, narrow, non-destructive)
- Downstream DEC-INT-0005 (`my-first-test`, 2026-05-27) — pilot evidence + adopt-existing registration + side_effects documentation
- Bootstrap Step 6b (`commands/ecosystem/bootstrap.md:441-446`) — analog merge-preserve, symmetry baseline

---

## DEC-DEV-0050 — Patch 1.3.3 closure findings + patch-level checklist refinement

**Date:** 2026-05-27
**Trigger:** D7 phase-closure ritual applied at patch level в fresh independent observer mode (per user request after patch 1.3.3 + 1.3.4 + DEC-DEV-0048 same-day landed). First patch-level closure execution; tests applicability of phase-closure.md к patch scope.
**Tag:** #d7 #process-improvement #closure-findings

### Context

Patch 1.3.3 (DEC-DEV-0047) — первый «patch» (vs «phase») с full readiness + sub-phase decomposition + closure ritual. Fresh-session closure run выполнен independent observer'ом per user prompt. Substrate read order: `phase-closure.md` → `CONVENTIONS.md` → `CHANGELOG[1.3.3]` → ROADMAP «Где мы сейчас» → CLAUDE.md → DEV_JOURNAL DEC-DEV-0047 → readiness + smoke plan.

Mid-execution discovered parallel session shipped `aac5bcb` — patch 1.3.4 (DEC-DEV-0049, `/ecosystem:update` Step 6 merge refactor). Closure plan adjusted inline: numbering shift (0049 → 0050), one finding resolved by parallel work, broader memory snapshot update.

### Findings (severity-ordered)

1. **Memory snapshot STALE (Step 6 — major).** `project_ecosystem_status.md` description + body still references «Phase 5.1 + local docs polish done (DEC-DEV-0044+0045+0046)», does NOT mention DEC-DEV-0047 / 0048 / 0049 / patch 1.3.3 / 1.3.4. «Next steps» item #2 («22 artifact files stale-refs sweep») already shipped (`1b5860f`). MEMORY.md index — same staleness. **Fixed inline** в этой closure run (memory updated к 1.3.4 baseline).

2. **DEC-DEV numbering collision risk (Critical surface — finding C.1).** Same-day fresh-session implementation creates sequential entries без cross-awareness. Sequence что произошло сегодня:
   - DEC-DEV-0047 (kickoff stub) → uplifted to full Outcome
   - DEC-DEV-0048 used параллельной сессией для pre-Phase-6 architectural addendum (Claude Design + IR)
   - DEC-DEV-0049 used параллельной сессией для patch 1.3.4 (update Step 6 merge)
   - DEC-DEV-0050 (this entry) — closure ritual

   First closure attempt предлагал DEC-DEV-0048; collision detected after substrate read. Resync to 0049; second collision detected post-conflict-check. Final = 0050. **Pattern: same-day parallel sessions нуждаются в numbering verification step.**

3. **Readiness phantom count (Step 4).** `dev/PATCH_1.3.3_READINESS.md` Section 5 sub-phase C говорит «all 12 integrator commands»; actual = 9 (research/add/remove/update/scan/gaps/status/map/journal). Speculative count включал deferred (`replace.md` per DEC-DEV-0040 Q4) + Phase 7 commands (`debug.md`, `docs.md`). Implementation покрыла 9 actual commands корректно. Drafting artifact, harmless.

4. **DEC-DEV-0047 duplicate section heading (Step 1).** Outcome+Lessons имеет 2 раза «Связь с другими entries» heading (DEV_JOURNAL lines 3806 + 3816). Cosmetic doc rot from stub→full uplift. **Deferred fix** — не блокирует Phase 6 kickoff.

5. **bootstrap.md Step 6c platform asymmetry (Step 2).** Bash heredoc only, vs update.md Step 5b с bash + PowerShell parity. DEC-DEV-0047 Lesson 2 фиксирует «cross-platform variants needed»; bootstrap Step 6c упустил то же rationale. **Deferred fix**.

6. **Smoke plan footer convention conflict (Step 5).** `PATCH_1.3.3_SMOKE_TEST_PLAN.md` «After closure» инструктирует archive обоих файлов; CONVENTIONS §5.1 говорит «archive smoke plan only after smoke run done». Wording должен быть conditional. **Deferred fix**.

7. **Resolved by patch 1.3.4 inline:** initial finding 2.1 (update.md Step 6 «Print confirmation» example missing PreToolUse scope-guard) — patch 1.3.4 fully rewrote Step 6 + extended print example to include PreToolUse, PostToolUse Bash matcher, и multiple matcher groups. **No action needed** — addressed by parallel work.

### Refinement candidates for `dev/meta-improvement/checklists/phase-closure.md`

R1. **Explicit note: «applies to patches too»** with substitutions table (Phase N → patch `<ver>`; `PHASE_<N>_READINESS` → `PATCH_<ver>_READINESS`). Patch-level closure ritual successfully validated; no need для separate `patch-closure.md`.

R2. **Step 6 (Memory sync) — add «verify next DEC-DEV-NNNN against DEV_JOURNAL tail»** перед constructing closure entry. Evidence: 2 collisions detected в этом single closure run (0048 collision discovered during substrate read; 0049 collision discovered during conflict check).

R3. **Step 4 (consistency) — add 3-way diff: «readiness Section 5 sub-phase list ↔ DEV_JOURNAL Outcome commit list ↔ actual filesystem»**. Phantom counts в readiness сейчас не surfaced systematically.

R4. **Smoke plan template footer should distinguish:** «archive readiness on closure (always)» vs «archive smoke plan only after runtime scenarios PASS». Currently merged в both шаблонах.

R5. **Same-day parallel session protocol.** When two AI sessions работают concurrently на одной репо, secondary session должна `git pull` или `git log` immediately after substrate read и перед any commit-prep — иначе numbering collisions + missed context. Add к D7 protocol для multi-session days.

### Lessons

1. **Patch-level closure ritual works** с тем же 6-step checklist при substitutions (Phase N → patch ver). Naming convention `PATCH_<ver>_READINESS.md` vs `PHASE_<N>_READINESS.md` — clean differentiator; phase-closure.md покрывает оба без bifurcation.

2. **Fresh-session closure обнаруживает больше findings чем inline.** 7 findings (1 major, 4 deferred, 2 surfaced-only); inline current-session AI biased smooth over («memory тоже current», «count 12 in readiness was just plan-time», etc.). Кост — 5-10 min overhead для context load.

3. **Anti-bias guard работает.** User prompt explicitly enumerated «не smooth over»; fresh-session honored — surfaced DEC-DEV-0048 collision + readiness phantom count + memory staleness even though all sounded «small enough to ignore».

4. **Mid-closure conflict resolution validates resilience.** Parallel session shipped `aac5bcb` после substrate read, before closure execution. Conflict assessment + plan adjustment (numbering shift, finding deduplication) занял ~5 min; не блокировал closure. **Pattern:** D7 closure rituals можно проводить параллельно с development if numbering + scope clearly separable.

5. **Phantom-count drafting bias.** Readiness Section 5 sub-phase C wrote «all 12 integrator commands» (speculative aggregate including deferred + future). Implementation correctly addressed only 9 existing. Future patch-level readinesses should ground counts в `ls commands/<module>/*.md` rather than aspirational catalog.

### Связь с другими entries

- DEC-DEV-0047 (patch 1.3.3 implementation) — closure target
- DEC-DEV-0048 (pre-Phase-6 architectural addendum) — same-day concurrent; first numbering collision
- DEC-DEV-0049 (patch 1.3.4 update merge refactor) — same-day concurrent; second numbering collision + resolved finding 2.1
- DEC-DEV-0033 (Phase 4 closure) — sibling phase-level closure pattern
- DEC-DEV-0046 (local docs polish) — bundled в 1.3.3; closure verifies bundle complete

---

## DEC-DEV-0051 — Patch 1.3.5: `/ecosystem:update` Step 5 namespace-aware sync + Step 2 extended backup

**Date:** 2026-05-27
**Trigger:** Same-session follow-up к DEC-DEV-0049 (patch 1.3.4 hooks merge-preserve fix). При static review новой Step 6 spec на real downstream state в `my-first-test` пользователь спросил «почему мы не fix'или это сразу — оно же супер важный баг?». Архитектурный gap идентичной природы что DEC-DEV-0049: Step 5 `rm -rf .claude/<subdir> && cp -r ...` уничтожает third-party namespaces внутри ecosystem zone subdirs (`.claude/skills/kiro-*/` от cc-sdd — verified loss in downstream `git reflog`). Дополнительно: Step 2 backup не покрывает integrator-managed paths outside `.claude/` (cc-sdd's `.kiro/`, beads' `.beads/` etc.) — rollback не восстанавливал их. Pilot evidence: my-first-test session 2026-05-27.
**Tag:** #bug-fix #spec-revision #architecture #pilot-finding

### Context

DEC-DEV-0049 (patch 1.3.4) закрыл hook REPLACE → pattern-preserving merge. Class of bug: ecosystem zone (specifically `.claude/settings.json#hooks`) был shared resource — third-party tools (bd, etc.) пишут туда, REPLACE их wipe'ает. Fix: namespace-aware preserve (pattern-match ecosystem commands, preserve остальное).

Same class of bug в Step 5 для **subdirs** (`commands/`, `skills/`, `agents/`, `hooks/`):
- Old: `rm -rf .claude/skills && cp -r .claude-ecosystem-tmp/skills .claude/skills`
- Result: any third-party namespace внутри (e.g. `.claude/skills/kiro-*/` от cc-sdd) уничтожается
- В downstream `my-first-test`: 17 kiro-* skill directories пропали при reset HEAD→a67a482 (orphaned 84eb5dd commit) — но текущая spec продолжит уничтожать их при каждом update'е если user reinstall cc-sdd
- Architecturally симметрично с Step 6 hooks: ecosystem zone shared, нужна namespace-level granularity

Дополнительный gap discovered в parallel: Step 2 backup ограничен `.claude/`. Integrator-installed tools часто создают workspace dirs **outside** `.claude/`:
- cc-sdd: `.kiro/specs/`, `.kiro/steering/`, `.kiro/steering-custom/`, `.kiro/settings/templates/{specs,steering,steering-custom}/`
- beads: `.beads/` (Embedded Dolt store + git hook overrides)

`active-tools.yaml#tools[*].claude_primitives[].path` явно перечисляет эти external paths. Backup их не захватывал → rollback после неудачного update не восстанавливал. Не угроза для текущего Step 5 (`/ecosystem:update` не пишет outside `.claude/`), но **угроза для consistency**: если update fails mid-stream и пользователь делает rollback, external paths могут быть в inconsistent state с restored `.claude/`.

### Options considered

**A — Namespace-aware Step 5 + extended Step 2 backup (выбран, single patch)**
- **Step 5 (B6):** classify subdirs на два класса:
  - **Namespace-aware:** `commands/`, `skills/`, `agents/`, `hooks/` — manage only ecosystem-owned namespaces (discovered dynamically: immediate children of `.claude-ecosystem-tmp/<subdir>/`). Non-managed namespaces (third-party) preserved untouched.
  - **Flat:** `docs/`, `templates/`, `adapters/`, `output-styles/` — full sync (third-party не должно сюда писать; out of convention).
- **Step 2 (B7):** Phase 2a backup `.claude/` (как раньше), Phase 2b read `active-tools.yaml`, backup external paths under `${BACKUP_DIR}/_external/`. MANIFEST.yaml для rollback orientation.

Pros: closes both gaps в одном патче (same architectural family); namespace-aware classification дискoverабельна dynamically (Phase 6 design namespace auto-managed без spec change); flat subdirs unchanged (минимум blast radius). External backup использует Integrator registry как source of truth — точно те paths, которые tool сам объявил.
Cons: spec становится длиннее (additional sub-step 5.1/5.2/5.3 split); Step 5 implementation требует более careful loop в bash/PowerShell. Mitigated: явные code blocks в spec.

**B — Hardcoded ecosystem namespace list (`{product, integrator, ecosystem, design}`)**
- Вместо dynamic discovery — hardcode whitelist.

Pros: explicit; невозможно miss-classify.
Cons: каждое добавление ecosystem namespace требует spec update (Phase 6 design — example). Dynamic discovery resilient: если upstream synces new namespace, downstream auto-manages его. *Rejected.*

**C — Step 5 unchanged, document workaround**
- Document: «после `/ecosystem:update`, run `/integrator:add <tool>` для reinstall».

Pros: zero spec change.
Cons: persistent UX papercut; cc-sdd skills уничтожались по 2 раза за session в downstream pilot (forensic timeline 2026-05-27). *Rejected as same anti-pattern that DEC-DEV-0049 rejected for hooks.*

**D — Step 2 backup only (skip Step 5 fix)**
- Backup external paths, leave Step 5 destructive.

Pros: minimum change.
Cons: backup решает rollback edge case, не main bug (cc-sdd skills wiped). Half-fix.

### Decision

**Вариант A — namespace-aware Step 5 + extended Step 2 backup, single patch 1.3.5.**

Конкретные изменения:
1. **`commands/ecosystem/update.md` Step 2** — split на Phase 2a (`.claude/` snapshot, as before) + Phase 2b (read active-tools.yaml, backup external paths under `_external/` + MANIFEST.yaml). Bash + PowerShell variants.
2. **`commands/ecosystem/update.md` Step 4** — diff computation описывает namespace-aware vs flat subdirs split. Print preview расширен с per-namespace classification + integrator-managed audit annotation.
3. **`commands/ecosystem/update.md` Step 5** — three sub-steps:
   - 5.1 Namespace-aware sync (`commands/`, `skills/`, `agents/`, `hooks/`): discover managed namespaces dynamically from upstream → rm + cp каждый; non-managed namespaces untouched
   - 5.2 Flat subdirs full sync (`docs/`, `templates/`, `adapters/`, `output-styles/`)
   - 5.3 Root files copy (как раньше) + .sync-metadata.yaml stamp
4. **`commands/ecosystem/update.md` Step 8** — summary report показывает T-counts per namespace-aware subdir + Phase 2b backup composition + integrator-managed third-party preservation.
5. **`commands/ecosystem/update.md` Rollback** — two-phase: restore `.claude/` from snapshot + restore `_external/` paths из backup.
6. **`docs/integrator-module/SPEC.md` §4.2.2** — Formal invariant: `metadata.claude_primitives[]` MUST enumerate ALL paths tool creates/modifies (inside `.claude/` AND outside). Tool-profiler responsibility extended. Schema example расширен. Downstream `my-first-test` active-tools.yaml уже compliant (8 external paths declared).
7. **CHANGELOG.md** — [1.3.5] entry under `### Fixed`.
8. **ROADMAP.md** — «Где мы сейчас» snapshot bumped к 1.3.5.
9. **DEV_JOURNAL.md** — this entry.

### Outcome

Spec change shipped в patch 1.3.5 (same-session as 1.3.4). Implementation = revised `.md` directives (Claude interprets). Smoke verification = next pilot `/ecosystem:update` в `my-first-test` после reinstall cc-sdd: ожидается что (a) kiro-* skills survive update; (b) backup создаст `_external/.kiro/` snapshot; (c) print preview покажет T-counts.

Backward compatibility:
- Projects без third-party namespaces: behavior identical к pre-1.3.5 (T-counts = 0, `_external/` empty).
- Projects с third-party tools: non-destructive update + full rollback coverage.
- Bootstrap unchanged: уже использовал `cp -rn` no-clobber (line 254-258) → не уничтожал existing third-party namespaces. Update теперь aligned.

### Lessons

1. **Architectural classes of bugs travel together.** DEC-DEV-0049 fix'ил hook REPLACE; same class affected subdir sync (Step 5) и backup scope (Step 2). При fix'е bug class — иммediately проверить **все surfaces где этот class может проявляться**. Если бы static review 1.3.4 проводился через namespace-awareness lens, Step 5 + Step 2 gaps были бы surfaced **до** ship'а 1.3.4. *Apply:* при DEC-DEV для architectural fix добавлять final step «scan for same class в других steps/commands».

2. **Pilot dry-run на real state раскрывает гипы, которые static review miss'ит.** B3 (1.3.4) был designed после downstream DEC-INT-0005 evidence. B6 (1.3.5) surfaced при dry-run новой Step 6 spec на real downstream — пользователь увидел что Step 5 уничтожит cc-sdd при reinstall. **Pattern:** mandatory dry-run на real downstream state после spec change — не только smoke test code, но и mental sim spec.

3. **Dynamic namespace discovery > hardcoded whitelist.** Discovering managed namespaces from `.claude-ecosystem-tmp/<subdir>/` immediate children делает spec resilient к Phase 6 (design namespace) и future additions. Whitelist'ы — antipattern для long-lived specs (similar к hook regex `(product|integrator|ecosystem|design)` который уже придётся update'ить при Phase 7). *Apply:* prefer discovery механизмы над hardcoded lists для extensible structures.

4. **Backup scope must mirror install scope.** Если tool installs paths outside `.claude/`, backup must capture them. Принцип «backup symmetric к destruction surface». Integrator registry (active-tools.yaml) делает symmetry derivable. *Apply:* при добавлении new integrator-managed surfaces (e.g. `.config/<tool>/` или `~/.local/share/<tool>/` для system-level tools) — extend backup scope accordingly.

### Связь с другими entries

- DEC-DEV-0049 (patch 1.3.4 hooks merge-preserve) — direct architectural predecessor, same class of bug
- DEC-DEV-0019 (original update design) — REPLACE rationale, now revised twice (1.3.4 hooks + 1.3.5 subdirs)
- DEC-DEV-0040 (Phase 5 Integrator) — Integrator Module как formal source of truth для third-party primitives
- DEC-DEV-0041 (Phase 5 implementation) — introduced third-party tool registration paths (active-tools.yaml schema)
- DEC-DEV-0042 (closed-list contamination removal) — sibling Step 5a; orthogonal to 5.1/5.2 split (operates на root-level .claude/ files, not subdir contents)
- DEC-DEV-0044/0045 (tri-location adapter pattern) — analogue «explicit ownership zones with audit trail»
- Downstream `my-first-test` — pilot evidence (kiro-* skills lost at reset 15:51 MSK, would-be-lost again on next update without fix)

---

## DEC-DEV-0052 — Phase 6 kickoff: architectural decisions + scope cuts (12 Qs / 13 ambiguities / 5 cuts)

**Date:** 2026-05-27
**Trigger:** Pre-Phase-6 kickoff ritual в fresh-session mode per `dev/meta-improvement/checklists/phase-kickoff.md`. User signal: следующая FM в pilot `my-first-test` планируется UI → kickoff горизонт близкий, front-loaded ROI релевантен. Sandbox FM-DESIGN-001 как rehearsal path рассмотрен и отвергнут (см. Decisions).
**Tag:** #architecture #spec-revision #scope-discipline #phase-readiness

### Context

Phase 6 (Design Module) — conditional, активируется на first FM с has_ui=true. SPEC v1.1 готов (DEC-DEV-0048 — Claude Design co-primary + IR groundwork); MK/DS/NM artifact schemas v1.1 готовы. Имплементация ещё не стартовала (`commands/design/`, `skills/design/`, `agents/design/`, `hooks/design/` — пустые директории).

`PHASE_6_READINESS.md` (refreshed 2026-05-27 post DEC-DEV-0050 closure ritual) status «🟡 ready-for-kickoff — trigger pending». Section C перечисляет 6 решений, зафиксированных в DEC-DEV-0048 + 5 ещё-открытых вопросов + cross-cutting integrations (env_tiers, PA journal, scope-guard, pattern-preserving merge, hard approve gate). Section D — TBD scope cuts.

Этот kickoff закрывает architectural Qs + ambiguities + scope cuts; implementation trigger остаётся conditional (real UI FM).

### Options considered

**A. Sandbox FM-DESIGN-001 + pre-implement Phase 6 sans real pilot trigger.**
Pros: implementation готов когда real FM появится; tooling validated через synthetic exercise.
Cons: synthetic FM не reveals real-pilot bugs (Phase 5 precedent DEC-DEV-0044 — bug 4 surfaced только в real pilot). Violates CLAUDE.md §2 incremental pilot + dogfooding direction. Phantom-audience risk аналогично DEC-DEV-0046.

**B. Kickoff закрывает architectural decisions + ROADMAP/readiness sync; implementation триггерится real UI FM (выбран).**
Pros: front-loaded design discipline pays ROI (DEC-DEV-0048 precedent); avoid synthetic validation trap; real UI FM (горизонт близкий per user signal) даст authentic substrate. Phase 5 closure pattern: kickoff ROI multiplier ~6-8x применим.
Cons: trigger всё ещё conditional; если pilot pivots в backend-heavy direction → Phase 6 implementation отложится. Risk acceptable per CLAUDE.md §5 «ROADMAP — hypothesis, not contract».

**C. Skip kickoff, defer всё к moment real FM hits.**
Pros: minimum sunk cost если Phase 6 никогда не активируется.
Cons: real UI FM moment — wrong time для architectural deliberation (focus on FM content, не tooling design); inherits DEC-DEV-0048 ROI lesson «front-loaded design discipline для conditional phases оправдан».

### Decision

**Вариант B — kickoff закрывает architectural decisions + scope cuts; implementation conditional на real UI FM.**

#### Architectural decisions (12 Qs resolved)

**Q1 — Hard approve gate UX в `/design:migrate`:** per-MK granularity, mirrors DEC-DEV-0047 §7.6 pattern; `--all` flag iterates с individual approve, no batch-bypass. Hard gate text: «STOP. Lossy regeneration via brief — visual tweaks потеряются. Approve migration для MK-NNN? [Y/N/defer]». Silence ≠ consent.

**Q2 — `screen-generator` subagent: defer к v1.1.** v1.0 D.2 inline в `design-session.md`. Bring-forward trigger: real D.2 >5 экранов hits >50% main context.

**Q3 — V-MK-02..03 automation: V-MK-02 partial (mechanical states `default`+`error` для interactive components); V-MK-03 manual.** Auto-check semantic «is interactive» = FP risk.

**Q4 — HTML fallback v1.0: minimal (single HTML page, DS tokens via CSS vars, no React).** «Stitch down» emergency unblock достаточен. React + multi-screen — v1.1.

**Q5 — `claude-design-workflow.md` v1.0: stub (~30 lines).** OQ-DM-08 open; manual export workflow described high-level; refactor after first Claude Design pilot OR Anthropic MCP/API release.

**Q6 — `/design:migrate` matrix v1.0: Stitch ↔ HTML only.** Schema полная (Claude Design enum keeps); command logic narrower. Claude Design migration → v1.1.

**Q7 — `design-session.md` deadlock protection (7 iterations):** structured 4-choice menu — `[pause+save / radical-rethink D.1 / accept-current-as-final / drop-and-archive]`.

**Q8 — `design-artifact-validate.js` v1.0:** YAML parse + 5 required-field checks (id, type, feature, design_tool, scenarios) + ref existence (SC/BR/LC via fs.exists) + V-MK-08 token coverage (regex `DS\.\w+\.\w+` scan vs DS body). Cross-platform path norm per Phase 5 bug 3 (`replace(/\\/g, '/')`).

**Q9 — PA integration: 3 trigger events** — first `/design:start` без Stitch MCP configured; first Claude Design без subscription; `tool_project_url` 404 при resume.

**Q10 — `/design:export` ↔ `/product:handoff` ordering:** carry-forward к sub-phase G (decision point in implementation, not kickoff). При sub-phase G grep `commands/product/handoff.md` для FM has_ui=true branch — добавить explicit invocation шаг ИЛИ задокументировать «handoff §10 ассистент заполняет из MK/DS/NM без separate command call».

**Q11 — Subagent registration gap (R7 from DEC-DEV-0038):** Q2 defer subagent → irrelevant в v1.0.

**Q12 — Stitch MCP `environment_tiers`:** `environment_agnostic: true` (SaaS, не зависит от tier).

#### Ambiguity resolutions (13 sweep findings)

- **A1** — MK filename slug: `MK-<NNN>-<ascii-slug>.md` per Phase 2 PS drift precedent (DEC-DEV-0011 lesson).
- **A2** — Screen Inventory IDs per-MK scope (restarts each MK); cross-MK refs via `MK-NNN/SI-X` qualifier.
- **A3** — NM cross-feature flows: v1.0 single FM scope (split на 2 NM если spans); v1.1 backlog NM.features[] array если evidence accumulates.
- **A4** — `.design-sessions/` cleanup: `archived/` directory on D.6 complete or `/design:start --abandon`; opportunistic >30d purge at session start.
- **A5** — Stitch counter monthly rollover: `month_count_at_date` comparison vs current `YYYY-MM`; reset to 0 if month changed.
- **A6** — D.5 MK+DS atomic write: MK first (draft status), DS update second; retry idempotent. No transaction layer.
- **A7** — has_ui=true без UI SC steps: 3-choice menu `[abort design — set has_ui=false / edit SC inline / proceed minimal UI with rationale logged]`.
- **A8** — Migration interrupted mid-write: `previous_tools[]` entry written first (before regen), regen second; rollback entry (delete last element) если regen fails — `tool_project_url` stays old.
- **A9** — Concurrent design sessions same FM: session start checks для existing `current.yaml` с matching FM; warn + `[resume / force-new-overwrite / abort]`.
- **A10** — screen-generator JSON schema: deferred с Q2 (subagent → v1.1).
- **A11** — `design-artifact-validate.js` stderr format: `[design-artifact-validate] <FILE>: <severity>: <message>` (mirrors Phase 5 `cascade-check.js`).
- **A12** — PA schema fields: existing DEC-DEV-0047 B-3 schema reusable (action, subject, source=design, status).
- **A13** — `/design:export` ↔ `/product:handoff`: carry-forward к sub-phase G (см. Q10).

#### Scope cuts (5 deferrals к v1.1+ backlog)

- **C1** `claude-design-workflow.md` full → stub в v1.0 (~30 lines)
- **C2** `screen-generator` subagent → v1.1
- **C3** `/design:migrate` Stitch ↔ Claude Design path → v1.1 (schema keeps enum; command logic narrower)
- **C4** `html-fallback.md` React + multi-screen → v1.1 (v1.0: single HTML page, no React)
- **C5** V-MK-02..03 automation full → V-MK-02 partial only в v1.0 (mechanical states; V-MK-03 manual)

Realistic estimate post-cuts: **8-12h focused work** (was 10-20h pre-cuts).

#### Sandbox FM-DESIGN-001 — отвергнут

Per CLAUDE.md §2 (incremental pilot, не waterfall) + §1 (dogfooding direction). Phase 5 lesson (DEC-DEV-0044): bug 4 surfaced только в real pilot, не в fixture. Sandbox для Design Module имеет ту же ловушку — D.1 brief generation на synthetic SC «выглядит работающим», но real FM revealed gaps будут существенно больше. **Решение:** wait для real UI FM в pilot `my-first-test`; trigger горизонт близкий per user signal.

### Outcome

Phase 6 readiness state:
- 🟡 **architectural decisions complete** — все 12 Qs resolved + 13 ambiguities + 5 cuts approved
- ⏳ **implementation trigger pending** — real UI FM в pilot project

Sub-phase decomposition A→I готов (см. PHASE_6_READINESS Section F refresh) — total ~11-13h focused work когда trigger fires (8-12h core + 1h I overhead + drift sweep already bundled в A).

**Spec drift prerequisite (bundled с этим kickoff):**
1. `docs/design-module/SPEC.md` §10.4 line 660 — enum `stitch | figma | penpot | html-fallback` → `stitch | claude-design | figma | penpot | html-fallback` (post-DEC-DEV-0048 enum drift)
2. `docs/pmo/pmo-map.md` line 59 — D2-B04 status `✅` → `🟡 SPEC v1.1, impl Phase 6 pending`
3. `ROADMAP.md` Phase 6 section — deliverables list + estimate + risks refresh; «Где мы сейчас» bullets
4. `dev/PHASE_6_READINESS.md` — banner refresh + Sections A.1/C/D/F/H/I sync
5. `CLAUDE.md` «Где мы сейчас» — DEC-DEV-0052 line
6. `dev/v1_1_backlog.md` — 5 новых entries (C1-C5)
7. `dev/PHASE_6_SMOKE_TEST_PLAN.md` — placeholder с S1-S6 scenarios

### Lessons

1. **Front-loaded design discipline для conditional phases — повторно подтверждено.** DEC-DEV-0048 (SPEC v1.1 addendum) + этот kickoff (decisions + cuts) — оба ship'ятся pre-implementation; total ~3-4h front-loaded vs ~5-15h restored-from-cold при mid-FM kickoff. Multiplier ~5x consistent с Phase 5 kickoff ROI (~6-8x). *Apply:* для других conditional phases (Phase 7 maintenance, Orchestrator concept) — те же front-loaded readinesses.

2. **Sandbox path для conditional phase ловит phantom-validation trap.** Synthetic FM «выглядит работающим», но не reveals real-pilot bugs (Phase 5 bug 4 precedent DEC-DEV-0044). Решение «wait для real FM» = больше ROI чем «pre-implement sans evidence». *Apply:* для любого conditional / trigger-pending feature: real trigger даёт лучше substrate чем synthetic; не торопиться.

3. **Cuts ratio: 5/12+ deliverable surfaces → v1.1.** Post-DEC-DEV-0048 ramp Phase 6 scope наполовину состоял из speculation (OQ-DM-08 Claude Design prompts, OQ-DM-01 Stitch prompts, subagent pre-optimization). Aggressive cut discipline = пол-scope в v1.1; v1.0 ships critical path только. *Apply:* «cuttable scope default» per CLAUDE.md §4 — aggressive defer к v1.1 экономит >50% Phase work без блокирования primary value.

4. **OQ-DM-08 (Claude Design prompts) — exemplar phantom-audience risk** для tooling без pilot evidence. Skill spec выглядит content-rich, но без real claude.ai/design experimentation = vapor. Stub в v1.0 + refactor после first pilot — правильная middle ground. *Apply:* для любого skill, depending от external tool без MCP/stable API: stub-and-refactor pattern.

5. **Fresh-session kickoff повторно подтверждает ROI vs inline.** Inline AI carries forward Phase 5 + DEC-DEV-0048 mental model; fresh-session surfaced 3 critical concerns (OQ-DM-08 phantom-audience, sandbox phantom-validation, ROADMAP/readiness estimate discrepancy) которые inline AI мог smooth over. Cost: ~30 min substrate load. ROI: 5 cuts + 4 lessons + drift prerequisite caught. *Apply:* per phase-kickoff.md checklist — fresh-session для substantial phases.

### Связь с другими entries

- DEC-DEV-0048 — pre-Phase-6 architectural addendum (Claude Design co-primary + IR groundwork); этот kickoff наследует
- DEC-DEV-0047 — patch 1.3.3 (PA journal + hard approve gate + scope-guard); Q1/Q9 patterns inherited
- DEC-DEV-0040 — Phase 5 readiness gate (analog kickoff per phase ritual); same fresh-session pattern
- DEC-DEV-0044/0045 — Phase 5 closure (bug 4 «real pilot reveals bugs that fixture missed»); applied к sandbox rejection
- DEC-DEV-0046 — defer Phase D Wiki (phantom-audience guard); analog «conditional phase + sandbox rejection»
- DEC-DEV-0050 — patch 1.3.3 closure ritual (R2 DEC-DEV numbering verification); applied here (0051 collision check → 0052 confirmed)
- DEC-DEV-0011 / DEC-DEV-0012 — Phase 3 ambiguity sweep + readiness gate; methodology template

### Follow-up (2026-05-27, inline-session closeout)

После fresh-session kickoff inline review surfaced 3 minor inconsistencies + 1 substantive premise correction:

**(1) Estimate alignment в `PHASE_6_READINESS` Section F.1.** Outcome выше говорит «8-12h focused work post-cuts»; Section F.1 sum from per-sub-phase rows = 11-13h. Расхождение: sub-phase I (closure overhead) был не учтён в outcome figure. *Resolved:* Section F.1 footer добавлен — «Total 9-13h end-to-end = 8-12h focused A→H + ~1h closure I». ROADMAP + CLAUDE.md «Где мы сейчас» phrasing aligned.

**(2) Section F.2 Design DA bullet — phrasing inconsistency.** Section F.2 содержал leftover speculation «Phase 6 имплементирует Design DA — likely новый subagent `agents/design/devils-advocate.md`». Но SPEC `docs/design-module/SPEC.md` не упоминает Design DA вовсе; Q2/Q11 closure выше (defer screen-generator subagent + subagent registration gap irrelevant в v1.0) implicitly cuts `agents/design/` infrastructure из v1.0 entirely. *Resolved:* Section F.2 bullet переписан — «Design DA не в Phase 6 v1.0 scope; D.3 iteration review через Q1 hard approve gate + Q7 menu sufficient; full subagent — v1.1+ candidate если evidence dictates». «product-devils-advocate registration gap» bullet помечен «moot в v1.0».

**(3) Q8 carry-forward — `design-artifact-validate.js` exit code policy.** Q8 specified validation logic (parse, fields, refs, V-MK-08 regex, path norm) но не severity policy. **SPEC §B2 уже отвечает** (line 11 SPEC): quiet-draft mode — `status: draft` → queue findings (silent log, exit 0); `status: final` → block (exit 1). Sub-phase G implementation просто следует SPEC § B2 без architectural decision. *Resolved:* Section H carry-forward subsection добавляет Q8 рядом с Q10 (ссылка на SPEC §B2).

**(4) Trigger phrasing imprecision — substantive correction.** Outcome выше + banner phrased trigger как «implementation trigger pending real UI FM в pilot project». **Empirical verification 2026-05-27 inline:** `my-first-test/.product/features/` содержит 6 FMs (FM-001..FM-006), **все** с `has_ui=true`; FM-003 explicit text «has_ui=true (CRUD-интерфейс; mockups deferred к Phase 6)» — pilot already awaits Phase 6 deliverables. Trigger ACTUALLY fired давно (likely FM-001 epoch). User signal «next FM = UI» в substrate prompt был accepted as fact fresh-session — fresh AI не challenged против empirical state (`grep has_ui .product/features/`). *Resolved:* banner + A.1 + Section B + ROADMAP + CLAUDE.md «Где мы сейчас» phrasing corrected — «implementation pending start» вместо «trigger pending». Sandbox rejection сохранён, но reason simplified: «real FMs available, sandbox излишен» (вместо «phantom-validation guard» — что было правильно но overspecified).

### Lesson 6 (added inline-session follow-up)

**Fresh-session ROI имеет blind spot: substrate premises inherited as facts.** Anti-bias guard работает на decision space (architecture decisions, ambiguity sweep, scope cuts) но не на factual claims в substrate prompt. Если user statement приходит в substrate как «trigger pending» или «next FM = UI» — fresh AI inherits without empirical verification. Result: kickoff phrasing imprecise хотя architectural decisions valid; trigger correction надо делать inline post-kickoff. *Apply:* substrate prompts для future kickoffs должны включать explicit step «empirical state check» — для conditional phases: `grep <trigger-condition> <pilot-path>` BEFORE architectural deliberation. Может быть добавлен к D7 `phase-kickoff.md` Section 1 как pre-Section step.

### Follow-up 2 (2026-05-27, inline-session update-compat review)

User asked: «где-то при реализации будет учтена проверка корректности и совместимости update команды с текущим тестовым проектом? Чтобы ничего не затереть случайно, но и почистить старое/лишнее.» Surface'нул gap который kickoff Section C cross-cutting integrations не охватил.

**Gap audit — what's covered, what's not:**

Existing protections inherited (from patches 1.3.3/1.3.4/1.3.5):
- ✅ `.product/` invariant — scope-guard B-2 forbidden paths + backup Step 2 external paths if listed — `.product/mockups/`, `.product/design-system.md`, `.product/.design-sessions/` safe из коробки
- ✅ Namespace-aware sync 1.3.5 Step 5 — `commands/design/`, `skills/design/`, `hooks/design/`, `agents/design/` (empty в v1.0) classified как managed ecosystem namespaces dynamically; третьестoрronnij `kiro-*` style namespaces в same parent dirs preserved
- ✅ Pattern-preserving merge 1.3.4 Step 6 — `^node \.claude/hooks/(product|integrator|ecosystem|design)/` pattern уже includes `design/` префикс; `design-artifact-validate.js` re-derives from manifest, third-party hook entries preserved verbatim

**New edge case — explicit handling required в sub-phase B:**
- `.claude/design.yaml` (per-project config: default_design_tool, mcp_preferences.fallback_chain) — singleton root-level file like `settings.local.json`. Если Step 5 nuclear sync'aет singleton files в `.claude/` root → user's per-project preferences wiped при upgrade. Sub-phase B MUST verify Step 5 algorithm preserves singleton root files OR explicitly add `design.yaml` to preserved list.

**Cleanup story:**
- ✅ `.product/.design-sessions/archived/` per A4 (D.6 complete OR `--abandon`) + opportunistic >30d purge — handled inline by `design-session.md` skill (sub-phase C)
- ⏳ Orphan MK/NM cleanup (FM deleted via `/product:promote-note --delete`) — **NOT covered v1.0**; deferred к v1.1 backlog as `/design:cleanup` candidate OR integration с `/product:purge`

**Resolved (this commit):**
- (1) Section H — added «Update-compat carry-forward (Follow-up 2)» bullet with full gap audit + reference на S7
- (2) Section F.1 — sub-phase B annotated «.design.yaml NOT synced by /ecosystem:update Step 5; per-project config like settings.local.json»; estimate bumped к 1-1.25h (~15min for verification)
- (3) `dev/PHASE_6_SMOKE_TEST_PLAN.md` — S7 «`/ecosystem:update` compatibility post 1.4.0» scenario added with capture-before-state protocol, pass criteria including third-party preservation + `.product/` invariant + design.yaml preservation, 3 edge cases (E1 non-default tool, E2 migration history, E3 bootstrap idempotency)
- (4) Section I implementation kickoff prompt — переписан как authoritative source-of-truth (FM-001 target, empirical state check rule from Lesson 6, sub-phase B update-compat verification explicit, sub-phase G handoff §10 Q10 resolution, cross-cutting integrations list to read upstream commands в substrate)

### Lesson 7 (added Follow-up 2)

**Cross-cutting integration scope is invisible to phase kickoff substrate.** Kickoff Section 1 architectural readiness focuses на artifacts inside phase boundary (Phase 6 commands/skills/hooks). Cross-cutting commands that interact с new artifacts (`/ecosystem:update`, `/ecosystem:bootstrap`, `/product:handoff`) — visible только если substrate prompt explicitly enumerates them. DEC-DEV-0052 Section C did mention some cross-cutting points (env_tiers, PA journal, scope-guard, pattern-preserving merge для hooks) но missed `.claude/design.yaml` interaction с `/ecosystem:update` Step 5 (sync algorithm for singleton config files). Same class of gap as patches 1.3.4 (third-party hook injections) и 1.3.5 (third-party namespace dirs) which surfaced **только при downstream pilot evidence**, not during ecosystem-internal review. *Apply:* phase-kickoff.md Section 2 (ambiguity sweep) — add explicit step «enumerate cross-cutting commands that touch new artifacts; verify their behavior against new file types/paths (config singletons, namespace dirs, hook registrations, backup scope)». For Phase 6: read `commands/ecosystem/update.md` + `commands/ecosystem/bootstrap.md` + `commands/product/handoff.md` + `commands/integrator/research.md` (hard approve gate template) during substrate load.

---

## DEC-DEV-0053 — Phase 6 implementation: Design Module v1.0 (sub-phase A→I)

**Date:** 2026-05-28
**Trigger:** Fresh-session implementation kickoff per `dev/PHASE_6_READINESS.md` Section I authoritative prompt (DEC-DEV-0052 + 2 Follow-ups; commits `bceacbd`/`5299c7e`/`3b992fc`/D7 hook). Target FM-001 (authentication-accounts), real UI FM в pilot. Run executes sub-phases A→I closing Phase 6 implementation.
**Tag:** #implementation #phase-6 #design-module

### Context

DEC-DEV-0052 (kickoff, 2026-05-27) закрыл 12 Qs / 13 ambiguities / 5 scope cuts (C1-C5 → v1_1_backlog). Architectural readiness `🟡 ready` с `implementation pending start`. Follow-up 1 verified pilot trigger empirically (6 FMs has_ui=true); Follow-up 2 surfaced update-compat gap + Lesson 7 (cross-cutting integrations) + S7 smoke scenario. Substrate prompt в Section I authoritative; empirical state re-verified 2026-05-28 fresh-session start (6 FMs has_ui=true ✓; last DEC-DEV=0052 → next 0053 ✓; spec drift items от kickoff все cleared — pmo-map D2-B04 = 🟡 SPEC v1.1 ✓; SPEC §10.4 enum включает claude-design ✓; v1_1_backlog содержит C1-C5 entries полностью).

Plan A→I из `PHASE_6_READINESS.md` Section F.1:
- **A** (30-45min): DEC-DEV-0053 skeleton + drift sweep
- **B** (1-1.25h): `commands/design/{start,status}.md` + `.claude/design.yaml` template + bootstrap auto-deploy + update-compat verification
- **C** (1.5-2h): `skills/design/design-session.md` orchestrator (Q7 deadlock menu + A7 menu + A4 cleanup)
- **D** (1.5h): `skills/design/{component-states,design-system-rules}.md`
- **E** (1.5-2h): `skills/design/{stitch-workflow,claude-design-workflow stub C1,html-fallback minimal C4,design-validation}.md`
- **F** (1.5h): `commands/design/{iterate,system,export,migrate Stitch↔HTML only C3}.md` + Q1 hard approve gate
- **G** (1.5h): `hooks/design/design-artifact-validate.js` + manifest.yaml + Q10 carry-forward + Q8 quiet-draft per SPEC §B2
- **H** (1h): static smoke fixture (per `smoke-hooks.js` template) + run
- **I** (1h): closure (fill this entry Outcome + Lessons) + CHANGELOG `[1.4.0]` + ROADMAP/CLAUDE.md «Где мы сейчас» + tag `v1.4.0` + archive `dev/_archive/phase-6/` + `dev/PHASE_7_READINESS.md` skeleton

Total estimate: **9-13h end-to-end** (8-12h focused A→H + 1h closure I).

### Options considered

Implementation execution path (not architectural — those settled DEC-DEV-0052):

**A. Sub-phase A→I incremental execution с commit per sub-phase** (выбран per DEC-DEV-0047 Lesson 7).
Pros: per-step rollback granularity; pre-commit hook smoke runner (DEC-DEV-0023) catches design hook bugs до stage; alignment с Phase 5 / Patch 1.3.3 precedent. Cons: больше commits, slightly more session overhead per commit message construction. Outweighed by safety.

**B. Bundle all A→I в single commit на конце.**
Pros: один clean commit. Cons: violates DEC-DEV-0047 Lesson 7; no granular rollback; pre-commit hook smoke runs once на end (если fails — large diff to debug). Rejected.

**C. Refine sub-phase boundaries per emergence (Phase 5 sub-phase J precedent).**
Pros: anti-bias guard per kickoff prompt — «free to refine sub-phase scope если evidence dictates». Cons: only if real emergence; default to plan as-is. Adopted as standing license, not default behavior.

### Decision

**Path A** (sub-phase A→I с per-step commits) — execute per `PHASE_6_READINESS.md` Section F.1 plan; refine only при surfaced evidence (Q10 carry-forward в G; Q1 mirror на /design:migrate в F; Q7 menu UX в C; Q9 PA trigger events в C/E).

#### Sub-phase A outcomes (this commit)

- **DEC-DEV-0053 skeleton entry** written (this file) — placeholder для Outcome/Lessons; будут filled sub-phase I.
- **Drift sweep result:** clean — все spec drift items от kickoff (pmo-map D2-B04 status, SPEC §10.4 enum, ROADMAP Phase 6 deliverables/estimates, `v1_1_backlog.md` C1-C5 entries, CLAUDE.md «Где мы сейчас» DEC-DEV-0052 line) already addressed в DEC-DEV-0052 + Follow-ups. No additional drift discovered during substrate load.
- **Empirical state check** (Lesson 6 mandatory): 6 FMs has_ui=true в `my-first-test/.product/features/` ✓; FM-001 target verified (`title: "Authentication & accounts"`, status `in-progress`, scenarios SC-001..SC-003, mockups []).
- **Cross-cutting integrations reads complete** (Lesson 7 application): `commands/ecosystem/update.md` Step 5 namespace-aware sync confirmed treats `commands|skills|agents|hooks/<namespace>/` dynamically — `design/` namespace будет managed automatically once present; Step 6 pattern `^node \.claude/hooks/(product|integrator|ecosystem|design)/` уже includes `design/` префикс. `commands/ecosystem/bootstrap.md` Step 6b auto-registers hooks from manifests; Step 6c initializes PA journal — both apply к design hook + design PA entries without modification.
- **Singleton root file analysis для `.claude/design.yaml`** (sub-phase B precondition): Step 5 algorithm operates на **subdirs** (`commands/`, `skills/`, etc.) и **explicit root-file allowlist** (README, BOOTSTRAP, CHANGELOG, ROADMAP, install.sh/ps1, .env.template, gitignore.template). `.claude/design.yaml` НЕ входит в Step 5 root-file allowlist; следовательно НЕ overwritten при update. **No explicit exclusion code required** — leveraged by existing allowlist semantics (mirroring `settings.local.json` treatment which similarly не listed). Resolution: document this в sub-phase B как inheritable invariant; smoke S7 verifies runtime.

### Outcome

Phase 6 (Design Module v1.0) implementation **shipped end-to-end через 8 sub-phase commits** (A→I individual per DEC-DEV-0047 Lesson 7), 1.4.0 release ready.

**Deliverables shipped:**

| Sub-phase | Commit | Deliverable | Lines |
|---|---|---|---|
| A | `1545263` | DEC-DEV-0053 skeleton + drift sweep (clean — all from kickoff resolved) | 68 |
| B | `18b2df2` | `commands/design/{start,status}.md` + `commands/ecosystem/update.md` preservation listing для `.claude/design.yaml` | 438 |
| C | `6b666fa` | `skills/design/design-session.md` orchestrator (Q7 deadlock 4-choice menu + Q9 PA triggers #2/#3 + A4 cleanup + A5 quota + A6 atomic write order + A9 concurrent session + Q10 carry-forward strategy) | 540 |
| D | `7d3e776` | `skills/design/{component-states,design-system-rules}.md` (D.4 mechanical + V-MK-02/03 partial Q3/C5; D.5 DS extraction + synonym detection + manual mass-rename) | 470 |
| E | `1d1b468` | `skills/design/{stitch-workflow,claude-design-workflow,html-fallback,design-validation}.md` (Stitch v0 best-effort OQ-DM-01; Claude Design stub C1; HTML minimal C4; V-MK-* runner partial) | 679 |
| F | `5c15057` | `commands/design/{iterate,system,export,migrate}.md` (Q1 hard approve gate per-MK; matrix Stitch↔HTML only C3; Q10 export resolution documented) | 682 |
| G | `8762c1c` | `hooks/design/design-artifact-validate.js` + `manifest.yaml` (Q8 — 5 required fields, ref existence, V-MK-08 regex, quiet-draft) + `skills/product/handoff-generator.md` Step 8c (Q10 inline §10 assembly) | 506 |
| H | `e395c75` | `dev/meta-improvement/scripts/smoke-hooks.js` extension — 6 design-artifact-validate cases; full suite 19/19 PASS | 153 |
| I | (this commit) | Closure: DEC-DEV-0053 Outcome/Lessons + CHANGELOG `[1.4.0]` + ROADMAP/CLAUDE.md «Где мы сейчас» + `dev/PHASE_7_READINESS.md` skeleton + archive `dev/_archive/phase-6/` + tag v1.4.0 | (this commit) |

**Total:** ~3536 lines across 8 commits (excl. closure). 6 commands + 6 skills + 1 hook + 1 manifest + handoff-generator.md Step 8c + smoke fixture extension.

**Architectural decisions implemented (all 12 Qs from DEC-DEV-0052):**
- ✅ **Q1** hard approve gate per-MK granularity в `/design:migrate` (commands/design/migrate.md Step 4)
- ✅ **Q2** `screen-generator` subagent deferred к v1.1 (no `agents/design/` directory created; D.2 inline)
- ✅ **Q3** V-MK-02 partial mechanical (default + error для interactive components) — `component-states.md` Step 5 + `design-artifact-validate.js`
- ✅ **Q4** HTML fallback v1.0 minimal — `html-fallback.md` single-page no React
- ✅ **Q5** `claude-design-workflow.md` stub (~30 effective lines) per C1
- ✅ **Q6** `/design:migrate` matrix Stitch↔HTML only; `--to claude-design` explicitly rejected
- ✅ **Q7** 4-choice deadlock menu в `design-session.md` D.3 at iter ≥7
- ✅ **Q8** validate hook YAML parse + 5 required fields + ref existence + V-MK-08 regex + cross-platform path norm + SPEC §B2 quiet-draft mode — `hooks/design/design-artifact-validate.js`
- ✅ **Q9** 3 PA trigger events: `/design:start` Step 3a (#1 Stitch MCP missing), `design-session.md` startup checks (#3 tool_project_url 404), `claude-design-workflow.md` (#2 no subscription)
- ✅ **Q10** resolution: handoff §10 assembled inline by `handoff-generator.md` skill Step 8c (NEW); `/design:export` standalone verify aid (does NOT participate в handoff flow). Rationale documented в commit message + skill prose.
- ✅ **Q11** subagent registration gap moot в v1.0 (no design DA subagent)
- ✅ **Q12** Stitch MCP `environment_agnostic: true` — applied при future `/integrator:add stitch-mcp` profile creation; no v1.0 code change required (Stitch SaaS — no environment_tiers entries needed)

**5 scope cuts respected (NOT implemented в v1.0):**
- ✅ **C1** `claude-design-workflow.md` ships as stub
- ✅ **C2** no `agents/design/screen-generator.md` file
- ✅ **C3** `/design:migrate --to claude-design` rejected
- ✅ **C4** `html-fallback.md` single-page no React, no multi-screen
- ✅ **C5** V-MK-02 partial only (mechanical patterns); V-MK-03 manual via `design-validation.md` Step «V-MK-03 manual»

**13 ambiguity resolutions (A1-A13) applied per locations:**
- A1 ASCII slug filename — documented в `design-session.md` D.5 step + `/design:start` Step 3b
- A2 Screen Inventory IDs per-MK scope — implicit в MK.md schema (no cross-MK normalization)
- A3 NM cross-feature flows v1.0 single-FM — applied в `design-session.md` D.5 NM step
- A4 `.design-sessions/archived/` + >30d purge — `design-session.md` startup checks
- A5 Stitch counter monthly rollover — `design-session.md` + `stitch-workflow.md`
- A6 MK→DS atomic write order — `design-session.md` D.5
- A7 has_ui=true без SC 3-choice menu — `/design:start` Step 2
- A8 migration interrupted rollback — `/design:migrate` Step 5
- A9 concurrent session detection — `design-session.md` startup check 2
- A10 screen-generator JSON schema — deferred с Q2 (subagent — v1.1)
- A11 stderr format `[design-artifact-validate] <id> ...` — `hooks/design/design-artifact-validate.js`
- A12 PA schema reuses DEC-DEV-0047 B-3 — все Q9 triggers use existing format
- A13 (= Q10) export ↔ handoff ordering — resolved sub-phase G

**Smoke test results:**
- Pre-commit hook smoke runner (DEC-DEV-0023) ran at every sub-phase commit; no regressions detected
- Final smoke suite 2026-05-28: **19/19 PASS** (13 existing + 6 new design hook cases)
- Runtime smoke (S1-S7 в `dev/PHASE_6_SMOKE_TEST_PLAN.md`) — **deferred к next pilot session** per Phase 5 precedent (DEC-DEV-0044 separate runtime smoke after implementation closure)

**Cross-cutting integrations confirmed compatible (Lesson 7 application):**
- `/ecosystem:update` Step 5 namespace-aware sync handles `commands/design/`, `skills/design/`, `hooks/design/` dynamically — managed automatically once present in upstream
- `/ecosystem:update` Step 6 pattern `^node \.claude/hooks/(product|integrator|ecosystem|design)/` already includes `design/` префикс — design hook auto re-derives
- `/ecosystem:update` Step 4/8 explicit `.claude/design.yaml` preservation listing added (sub-phase B docs sync; no behavior change)
- `/ecosystem:bootstrap` Step 6b auto-registers hooks from manifests — design manifest will be picked up automatically
- `/product:handoff` §10 — handoff-generator.md Step 8c added (Q10 resolution); no command-call indirection

### Lessons

1. **JSDoc comment regex literal trap caught by manual smoke (новая lesson).** `*/g` (regex pattern with `/g` flag) inside JSDoc `/** ... */` block closes comment prematurely → SyntaxError. Caught by manual `node --check hooks/design/design-artifact-validate.js` before sub-phase G commit (pre-commit hook smoke runner gate). Fix: either escape (`*` separated by space from `/`) OR remove regex slash delimiters from prose. *Apply:* any time JSDoc comment includes regex with `*` and `/` characters, manual syntax check before commit. Adds к Phase 5 bug 3 family of cross-platform / runtime catches.

2. **Front-loaded design discipline ROI verified (повторное подтверждение Phase 5 lesson).** DEC-DEV-0052 kickoff + 2 Follow-ups closed 12 Qs / 13 ambiguities / 5 cuts pre-implementation. Sub-phase A→I execution was largely mechanical с **1 emergent decision** (Step 8c handoff-generator.md insertion для Q10 — kickoff identified carry-forward but не drilled into handoff-generator.md inspection until sub-phase G) and **1 caught runtime bug** (JSDoc regex trap, Lesson 1 above). Multiplier consistent с Phase 5 (~6-8x) — front-load 3-4h pre vs 5-15h restored mid-FM. *Apply:* для Phase 7+ — те же front-loaded kickoffs, even если phase scope looks small.

3. **Sub-phase commit cadence enables granular debugging (повторное подтверждение DEC-DEV-0047 Lesson 7).** 8 commits A→H + I closure = each commit small, focused, reviewable. Pre-commit hook smoke runner (DEC-DEV-0023) caught design hook syntax bug at sub-phase G; bundled all-in-one commit would have failed at end с large diff to debug. *Apply:* default for phase implementation work — per-substantial-deliverable commits, not bundled.

4. **Lesson 7 (cross-cutting integrations) preventive value confirmed.** Sub-phase G discovered handoff-generator.md Phase 4 left §10 как table-only placeholder («CONDITIONAL has_ui=true | MK + DS snapshot + NM») без concrete assembly algorithm. Step 8c added inline (Q10 resolution: «handoff fills §10 directly from MK/DS/NM без separate command call»). Without Lesson 7 explicit cross-cutting reads (`commands/product/handoff.md` + handoff-generator.md grepped в sub-phase A/G), would have shipped Phase 6 без actual handoff §10 assembly algorithm — gap surfaces только at runtime when first FM с has_ui=true tries `/product:handoff` after Phase 6 active. *Apply:* phase-kickoff.md Section 2 (ambiguity sweep) — add explicit «enumerate cross-cutting commands that touch new artifacts; verify their assembly logic documented» step. Already partially captured в Lesson 7 prose; this commit reaffirms.

5. **Aggressive cut discipline preserved velocity AND surface area integrity.** 5 cuts (C1-C5) eliminated speculative scope: full Claude Design skill (no pilot evidence), screen-generator subagent (no context-pollution evidence), Stitch↔Claude Design migration path (depends on C1), React+multi-screen HTML (over-engineered fallback), V-MK-02 full automation (FP risk без heuristic data). Without cuts, scope would have included ~5-8h speculative work that v1.1 evidence would likely have invalidated (phantom-audience risk per DEC-DEV-0046 / 0052). Cuts ratio 5/12+ deliverable surfaces — consistent с DEC-DEV-0052 Lesson 3 «pol-scope в v1.1». *Apply:* «cuttable scope default» per CLAUDE.md §4 — aggressively defer к v1.1 when pilot evidence не yet exists.

6. **Q-class decisions resolved inline as evidence dictates (anti-bias guard activated).** Q10 was «carry-forward к sub-phase G» в kickoff — actual resolution decided in this implementation: «no command-call from handoff; handoff-generator.md reads MK/DS/NM directly». Decision made during sub-phase G `grep commands/product/handoff.md` review — alternative «add explicit `/design:export <FM>` invocation к handoff» would have introduced unnecessary indirection (handoff has full filesystem access; command-call overhead doesn't add value). Documented в three places: design-session.md D.6, commands/design/export.md «Important constraints», handoff-generator.md Step 8c. *Apply:* «carry-forward» в kickoff = explicit license to refine; implementation evidence trumps a-priori speculation.

7. **Phase 6 estimate proved accurate (9-13h target, actual в range).** Kickoff DEC-DEV-0052 estimated 8-12h focused work + 1h closure = 9-13h end-to-end. Fresh-session execution на этом range — substrate load (~30-45min) + 8 sub-phase implementations + 1 closure. Cut discipline (C1-C5) was load-bearing для staying в budget; without cuts, 15-20h likely. *Apply:* кickoff estimates с aggressive cuts are accurate; pre-cut estimates ×1.5-2 multiplier holds.

### Связь с другими entries

- DEC-DEV-0052 + Follow-ups — Phase 6 architectural kickoff (12 Qs / 13 ambiguities / 5 cuts); этот entry implements
- DEC-DEV-0048 — pre-Phase-6 architectural addendum (SPEC v1.1 + IR groundwork); inherited
- DEC-DEV-0047 — patch 1.3.3 (PA journal + hard approve gate template + scope-guard); Q1/Q9 patterns mirrored
- DEC-DEV-0049/0051 — `/ecosystem:update` patches 1.3.4/1.3.5 (pattern-preserving merge + namespace-aware sync); design artifacts inherit protection
- DEC-DEV-0023 — pre-commit hook smoke runner; gate активен; caught JSDoc syntax bug в sub-phase G
- DEC-DEV-0041 — Phase 5 implementation closure (per-sub-phase commit cadence precedent); same pattern applied here
- DEC-DEV-0044/0045 — Phase 5 closure + 1.3.1/1.3.2 patches (tri-location pattern, local-only drift, cross-platform path norm); applied here для design hook (path norm `replace(/\\/g, '/')`)

---

## DEC-DEV-0054 — Documentation reform Tier 1 (status pointer-collapse + entry-point map + state-in-location)

**Date:** 2026-05-30
**Trigger:** User-requested комплексный multi-agent аудит документации экосистемы (ведение / хранение / использование) + предложение реформы. Dynamic workflow: 7 параллельных surface-аудиторов → synthesis → 3 adversarial-линзы (solo-dev overhead / self-referential collapse / migration cost). Started от вопроса «какой набор схем (2-3) использовать для описания экосистемы».
**Tag:** #refactor #tooling #architecture

### Context

Аудит выявил 5 ранжированных корневых проблем: (1) **status triple-declaration уже разошёлся** — README:5 говорил «v1.3.2 / Phase 0-5», ROADMAP/CHANGELOG — 1.4.0 / Phase 6; маркер `[We are here]` в ROADMAP сидел ВЫШЕ shipped Phase 6 → top-down мис-рид; (2) DEV_JOURNAL 4520 строк без оглавления; (3) `dev/` без state-in-location (PHASE_5_READINESS не заархивирован вопреки CONVENTIONS §5.1, хотя smoke-sibling — да); (4) «фрагментация» фактов в SPEC-слое; (5) нет визуальной entry-point карты + недокументированный Obsidian-vault.

Реформа разбита на **Tier 1** (one-time, near-zero recurring overhead) и **Tier 2** (gated на доказанной adherence).

### Options considered

**A. Полная реформа за один проход** (status + journal-index + dev-restructure + canonical-sweep + MAP + governor-checklist). Rejected — overhead-линза доказала **blocker**: governor (7-й блок в phase-closure.md) строится на уже эродирующем фундаменте — существующие Steps 1/4/5 демонстративно пропускались (stale README; un-archived PHASE_5_READINESS; пустые строки Phase 5/6 в refinement-tracker). Добавить чеклист к скипаемому чеклисту не поднимает adherence.

**B. Tier 1 сейчас, Tier 2 gated на evidence.** Chosen. Принцип: «реформа должна пережить пропущенное закрытие» → сначала только one-time-правки без standing-обязательств.

**C. Defer полностью / wiki.** Rejected — wiki уже отложен (DEC-DEV-0046, phantom-audience); MAP + существующий Obsidian дают 80% навигационной ценности за ~M effort.

### Decision

Ship **Tier 1** = чистые one-time moves. 4 пункта реализованы, 2 сознательно отложены **с evidence**.

**Реализовано** (ветка `docs/tier1-doc-reform`, 3 commit):
- `f74795b` — `docs/MAP.md` entry-point map (swimlane D1-D6 + C4 container, Mermaid, **обе провалидированы** через Mermaid MCP) + `HOME.md` Obsidian-vault entry (tracked). MAP = визуальный индекс, цитирует `pmo-map.md` как авторитет; artifact→skill→command cross-ref table **вырезан** (fine-grained, high sync-cost; неверная карта хуже отсутствующей).
- `12988b7` — status pointer-collapse: README:5 + CLAUDE.md снапшот → one-line pointer на `ROADMAP.md#где-мы-сейчас`; CLAUDE.md держит только slaved `last memory-sync` дату. ROADMAP: удалён плавающий маркер (drift-bait), tail reordered (shipped history → секция «Не отгружено»). Nav-links на MAP в README/CLAUDE.
- `be672c6` — archive `PHASE_5_READINESS.md` → `dev/_archive/phase-5/` (CONVENTIONS §5.1, просрочено) + 2 link-патча (`tech-debt/PHASE_4.md` ×2, `wiki-design.md` ×1).

**Отложено с evidence:**
- **Item 3 (canonical sweep)** — discovery (Explore-агент) **опроверг премиссу**: 4 «фрагментированных факта» (severity vocab / NFR-when-required / adaptive-depth DA / environment_tiers) — это principled separation (rule-def в `validation.md` / process в `processes.md` / per-artifact instance), **наблюдаемого дрейфа нет**. Speculative-конвертация деградировала бы локальные ссылки + создала half-swept mixed-state (предупреждение migration-линзы). Карта канонических домов записана для применения, если дрейф появится.
- **`dev/deferred/` bucket для Phase D trio** — grep подтвердил fragile relative-link web (`v1_1_backlog.md`, `LOCAL_DOCS_POLISH_PLAN.md`, взаимные ссылки трио). Тот самый atomic multi-file sweep, который migration-линза назвала blocker'ом. → Tier 2.

**Interim-status note (discharge self-referential-collapse amendment — важно):** status-block, будущий `dev/deferred/INDEX`, будущий journal-index — это **временные hand-maintained стенд-ины**, которые мапятся на собственные будущие артефакты продукта при запуске dogfooding (RM roadmap; `.product/.decisions/journal.md` — обещан в шапке этого файла; NOTE-*). Зафиксировано, чтобы будущая миграция `.product/`-для-Ecosystem была **консолидацией, а не вторым переписыванием**. Bring-forward trigger: standup `.product/` для самой Ecosystem (CLAUDE.md §3 dogfooding direction; сейчас deferred per DEC-DEV-0008 / CONVENTIONS §9).

### Outcome

3 commit на ветке; дерево link-clean per commit; rename распознан git'ом; pre-existing `audit-index.md` исключён. README больше не вводит в заблуждение (был на 2 фазы устаревшим). DEV_JOURNAL entry — этот commit (4-й). Tier 2 план составлен (см. PR description). Push + PR — этот же шаг.

### Lessons

1. **Multi-agent adversarial critique ловит дефекты, которые synthesis пропускает.** Overhead-линза дала BLOCKER (governor на уже-скипаемом фундаменте) → переосмыслила всю реформу с «добавить enforcement-чеклист» на «отгрузить one-time moves, переживающие пропущенное закрытие». Migration-линза поймала: bash-only journal-index скрипт на Windows-primary репо (конвенция dual `.sh`+`.ps1`); синтаксис `{#anchor}`, который GitHub игнорирует (404 для downstream); 10 stale worktrees, воскрешающих triple-declaration при merge. *Apply:* для любой reform/audit — прогонять независимые adversarial-линзы ДО фиксации плана.
2. **Discovery может опровергнуть премиссу synthesis — верифицируй до churn.** «4 фрагментированных факта» выглядели дрейфом в аудите, но оказались principled separation без дивергенции. «Фикс» сделал бы доки хуже. *Apply:* для canonical-home / dedup-работы — подтверждай НАБЛЮДАЕМЫЙ дрейф до конвертации; uniform paraphrase без дрейфа лучше half-swept pointer-state.
3. **Status SSOT работает только при одной writable-копии + указателях; плавающий «you are here» маркер сам по себе drift-bait.** Маркер был неверен на момент аудита. *Apply:* предпочитать ordering «новейшая запись = текущее» вместо поддерживаемого маркера.
4. **Реформа должна пережить пропущенный ритуал.** Tiering по recurring-overhead (Tier 1 = ноль standing-обязательств; Tier 2 gated на adherence) — дизайн-ответ на эмпирический факт, что существующий closure-чеклист скипается ~50%.

### Связь с другими entries

- DEC-DEV-0046 — wiki deferred (phantom-audience); эта реформа доставляет навигационную ценность wiki (MAP + Obsidian) за ~M effort
- DEC-DEV-0050 — numbering-collision lesson (parallel sessions); next NNNN верифицирован против tail здесь (0053→0054)
- DEC-DEV-0008 / CONVENTIONS §9 — dogfooding deferred; interim стенд-ины записаны для будущей консолидации
- CONVENTIONS §5.1 — archive-правило соблюдено (просроченный PHASE_5_READINESS)

---

## DEC-DEV-0055 — Harness-audit follow-up fixes (model-pin drift / upgrade→update / GitHub MCP / output-styles)

**Date:** 2026-05-31
**Trigger:** User-requested deep-research-style multi-agent аудит зрелости harness'а экосистемы (что она использует из примитивов Claude Code + что устанавливает downstream через `/ecosystem:update`). Codebase-grounded workflow (6 inventory-агентов → 38 adversarial-вердиктов, 44 субагента). Аудит вскрыл набор hygiene-дефектов; этот entry фиксирует их исправление по запросу «давай исправим их».
**Tag:** #bug-fix #spec-revision #tooling

### Context

Аудит подтвердил 4 исправимых дефекта harness-поверхности (остальные находки — сознательные deferrals или дизайн-решения, не баги):

1. **Model-pin drift** — главная сессия + `devils-advocate` прибиты к `claude-opus-4-7`, отставшему на поколение от текущей `claude-opus-4-8`; строка продублирована на ≥5 живых поверхностях (settings template ×2, bootstrap doc, CLAUDE.md.template, agent frontmatter) без единого источника правды. Sonnet-пины integrator-агентов (`claude-sonnet-4-6`) — актуальны, НЕ трогались (исходный аудит ошибочно назвал их «stale»; adversarial-коррекция в синтезе).
2. **Dangling `/ecosystem:upgrade`** — downstream-генерируемый CLAUDE.md + `verify.md` + stale-секции `bootstrap.md`/`BOOTSTRAP.md` отправляли пользователя к несуществующей команде за обновлением, которое уже делает `/ecosystem:update` (DEC-DEV-0019/0020). `BOOTSTRAP.md` ещё и описывал ручной `cd .claude && git pull` как механизм апдейта.
3. **Deprecated GitHub MCP** — bootstrap Step 9 ставил `npx -y @modelcontextprotocol/server-github` (reference-пакет снят с поддержки Apr 2025), вопреки собственному `docs/integrator-module/SPEC.md:1370`, который уже называет официальный `github/github-mcp-server`.
4. **output-styles wired-but-empty** — пустая директория синкалась `/ecosystem:update` как flat-subdir, но не содержала ни одного стиля.

### Options considered

- **Model drift:** (a) единый источник через env-переменную vs (b) синхронный bump всех поверхностей. Выбран (b) — минимальный риск; введение нового механизма источника правды само по себе spec-change. Single-source — кандидат на будущее (см. Lessons).
- **`/ecosystem:upgrade`:** (a) слепой find-replace на `update` vs (b) разведение consumer-facing ссылок и легитимных roadmap/history-ссылок. Выбран (b): `ROADMAP.md` + `DEV_JOURNAL.md` сохранены — там `upgrade` реальный future-superset (update + breaking-change migration); правлены только места, вводящие пользователя в заблуждение.
- **GitHub MCP:** веб-сверка вместо догадки (per CLAUDE.md «не выдумывать») — официальный сервер для Claude Code = HTTP-транспорт `https://api.githubcopilot.com/mcp/`, не npm-пакет; добавлена Docker-альтернатива.
- **output-styles:** (a) отгрузить реальный RU-tone стиль vs (b) убрать из sync vs (c) placeholder. User выбрал (b) — минимальный корректный фикс без выдумывания поведения.
- **Hook «зубы» (warn-only → block):** сознательно НЕ брались — явный v1.4.0-deferral (требует DEC-DEV-решения; `scope-guard.js:17-19`). Все 10 хуков остаются warn-only / exit 0.

### Decision

Исправлены пункты 1-4. Opus-bump на 5 поверхностях; `upgrade→update` в 7 consumer-facing местах (roadmap/history сохранены); GitHub MCP → официальный HTTP-сервер + Docker-fallback; `output-styles` удалена из sync-логики `update.md` (8 мест) + структуры `README.md` + физическая директория.

### Outcome

Ветка `fix/harness-audit-followups`, один commit (без push). CHANGELOG `### Fixed` обновлён. **Latent-несоответствие зафиксировано:** SPEC'ы (`product-module/SPEC.md:668`, `integrator-module/SPEC.md:1438`) всё ещё планируют output-style файлы `product-report.md` / `integrator-report.md` в `.claude/output-styles/` — forward-looking дизайн НЕ трогался; при отгрузке фичи директорию + sync-allowlist нужно вернуть. `dev/v1_1_backlog.md:92` (opus-4-7 в spec отложенного `market-researcher`) оставлен как dev-only / не-живая поверхность.

### Lessons

1. **Дублированный version-pin без единого источника = гарантированный drift.** Модель-ID жил на ≥7 поверхностях; bump требует тронуть каждую независимо. *Apply:* при следующем касании model-конфига — рассмотреть single-source (env / один pin, читаемый остальными), чтобы bump был one-touch.
2. **«Stale pointer к будущей команде» хуже отсутствия.** `/ecosystem:upgrade` маячил как «[future v1.1]» во всех update-подсказках задолго после того, как `/ecosystem:update` реально закрыл задачу — пользователя отправляли к воздуху. *Apply:* когда отложенная фича получает работающего предшественника — переписать consumer-facing указатели на предшественника, оставив future-ссылку только в roadmap.
3. **Не выдумывать внешние install-команды.** GitHub MCP-инвокация сверена по вебу, а не угадана — реальная форма (HTTP-транспорт) отличалась от ожидаемого `npx`. *Apply:* для install-команд внешних инструментов — верифицировать, особенно если пакет мог быть deprecated после knowledge cutoff.
4. **Adversarial-проход отделяет баги от дизайна.** Из ~38 находок только 4 — баги; остальное (warn-only хуки, path-loaded skills, prose-схемы, 2/9 событий) — сознательные deferrals/решения. *Apply:* перед «исправлением» находки аудита — проверить, не deferral ли это с rationale (`v1_1_backlog` / DEC-DEV).

### Связь с другими entries

- DEC-DEV-0019 / 0020 — создание `/ecosystem:update`; этот entry чистит stale `/ecosystem:upgrade`-указатели, пережившие его
- DEC-DEV-0042 / 0049 / 0051 — серия `/ecosystem:update` правок; output-styles-removal — той же sync-allowlist природы
- DEC-DEV-0054 — numbering verified против tail (0054→0055); pre-existing `audit-index.md` снова исключён из commit

---

## DEC-DEV-0056 — Session Audit v2: из phase-валидатора в замкнутый универсальный механизм аудита сессий

**Date:** 2026-05-31
**Trigger:** Запрос переосмыслить `audit-smoke`: сейчас он ориентирован на проверку фазы реализации экосистемы (`--phase=N` → smoke-план → coverage), а нужен замкнутый автоматический механизм, который сам определяет специфику сессии («первая сессия после поставки модуля Design» vs «обычная сессия баг-фикса»), по специфике понимает с чем и по каким критериям сопоставлять и как это повлияло на продуктовый проект, фиксирует находки в журнале аудита, и позже из журнала синтезирует патчи-улучшения для экосистемы. Предшествующий обширный анализ — 4 read-only исследования (примитивы автоматизации харнесса + тракт синтеза патчей) + чтение `audit-smoke.js`/`session-audit.md` напрямую.

**Tag:** #architecture #d7 #tooling #process-improvement

### Context

Текущий `audit-smoke` (DEC-DEV-0034) уже содержит зачатки универсальности — флаг `--no-plan` (catalog-only) и `check_id` A–G, проверяющие процесс-каталог независимо от фазы; capture/audit развязаны (SessionEnd-хук пишет маркер, тяжёлый `claude -p` отдельно; spawn-из-хука прототип отвергнут). Зазоры до потребности: (G1) нет автотриггера, (G2) нет классификатора специфики сессии, (G3) нет реестра рубрик «с чем/по каким критериям сравнивать», (G4) нет оценки эффекта на `.product/`, (G5) нет накопительного findings-журнала (per-phase summary эфемерны), (G6) нет синтезатора патчей.

Ограничения, проверенные эмпирически: routines/`RemoteTrigger` исполняются в облаке → НЕ видят локальные транскрипты `~/.claude/projects/` и git (дисквалифицированы для локального аудита); `CronCreate`/`/loop`/`Monitor` требуют открытой Claude-сессии; автономный-когда-Claude-закрыт — только Windows Task Scheduler. CONVENTIONS §8 запрещает auto-fix (механизмы D7 только surface-findings, человек решает); §9 — синтезатор живёт в `dev/meta-improvement/`, пишет DEC-DEV (не реюзает Product-модуль meta-feedback).

### Options considered

1. **Триггер:** (a) Windows Task Scheduler — автономно когда Claude закрыт, но ручная настройка ОС; (b) полу-авто `/loop`/`CronCreate` — работает пока Claude открыт, проще; (c) routines — дисквалифицированы (облако, не видит локаль); (d) пока ручной. **Выбран (b)** как целевой (Инкр.2); (a) — записан upgrade-path; ручной остаётся для «сейчас».
2. **Старт-инкремент:** (a) универсальный аудит G2+G3; (b) эффект G4; (c) журнал+синтез G5+G6; (d) всё сразу. **Выбран (a)** — ядро потребности «сам определяет специфику»; (d) отвергнут (риск самореферентного коллапса, против incremental pilot).
3. **Классификация:** (a) чисто LLM в промпте vs (b) детерминированный пре-пасс (JS: git/slash-cmds/paths) → LLM уточняет. **Выбран (b)** — дёшево, воспроизводимо, по образцу `computeAggregate`.
4. **Рубрики:** хранить как данные (`rubrics/*.md`), не хардкод в промпте — добавление класса без правки кода.
5. **Синтез патчей:** surface-only с human-gate `[Y/N/E/D]` (паттерн meta-feedback, но в D7-территории, DEC-DEV-семантика) — не auto-apply (§8).

### Decision

Принять дизайн «замкнутого цикла» Session Audit v2 (см. [`dev/SESSION_AUDIT_V2_DESIGN.md`](dev/SESSION_AUDIT_V2_DESIGN.md)): эволюция движка, а не переписывание. Активная работа — **Инкремент 1**: пре-классификатор сессий + реестр рубрик (baseline/criteria/effect-focus per session-class) поверх существующего `--no-plan`; выбор рубрики становится результатом классификации, а не аргументом `--phase`. Целевой триггер — полу-авто (`/loop`/`CronCreate`), Инкр.2. Журнал+синтез патчей — Инкр.3. Все находки фиксируются surface-only; патчи применяет человек через DEC-DEV.

### Outcome

Создан design-doc `dev/SESSION_AUDIT_V2_DESIGN.md` + этот DEC-DEV. **Инкремент 1 (G2+G3) реализован.**

Новые файлы: `dev/meta-improvement/scripts/classify.js` (чистый модуль — frontmatter-парсер рубрик, `extractSignals`, `classifySession`, render-хелперы) и `dev/meta-improvement/rubrics/` (README + 6 рубрик: feature-definition, integration, bug-fix, ecosystem-dev, module-delivery-shakedown, mixed-uncertain). Модифицированы: `scripts/audit-smoke.js` (флаг `--classify`, ветка классификации в per-session цикле, 4 новых плейсхолдера в `runAuditor`, запись `phase=—` / `mode=class:<id>` в Processed без слома схемы); `prompts/session-audit.md` (аддитивный rubric-guided режим, опц. поля `session_class`/`class_confidence`, check_id `class-mismatch`); `.claude/commands/meta/audit-smoke.md` (секция universal-режима). Хук `session-audit.js` **не тронут** — все сигналы берутся из транскрипта.

Детерминированная верификация зелёная: `node --check` обоих скриптов; юнит 8/8 (feature/integration/bug-fix/ecosystem-dev/module-delivery/mixed + tie/threshold); реальный near-empty Pending-транскрипт → корректно `mixed-uncertain`; регрессия phase-режима (`--phase=4 --dry-run`) цела; `--help`/error-path корректны.

**Live E2E (ветка `feat/session-audit-v2-incr1`, изолированно через `--transcript` → без мутации `audit-index.md`):** прогон `--classify` на integration-сессии (`306c196c`) отработал end-to-end — классификатор → `integration` (medium) → `claude -p` → корректный rubric-guided отчёт (`mode: catalog-only`, `session_class`/`class_confidence` заполнены, A–F помечены неприменимыми, 2 warning + 1 info). Детерминированная классификация на 4 реальных транскриптах: feature-definition (high), integration ×2 (medium), mixed-uncertain (tie на реально-смешанной сессии) — все защитимы. Инкр.1 закоммичен 3 commit'ами на ветке.

### Lessons

1. **Timing-эвристика как самостоятельный сильный триггер ложно-срабатывает.** `module_recently_shipped` (любая сессия в 21-дневном окне после релиза, вес 3) единолично уводил почти-пустую сессию в `module-delivery-shakedown`. Smoke на реальном транскрипте поймал это сразу. *Fix:* `MIN_DECISIVE_SCORE=2` (одиночный сигнал веса 1 → mixed-uncertain) + recency понижен до буста (вес 1), решающим оставлен module-команда. *Apply:* широкие/слабые сигналы — буст, не самостоятельный решающий триггер; порог решительности — дешёвая защита от low-evidence догадок.
2. **Эволюция вместо нового механизма подтвердилась.** Безфазовый путь (`--no-plan`) + check_id A–G + спавн-инфраструктура переиспользованы; classify — аддитивная ветка, phase-режим не тронут (пустой `{{RUBRIC_BLOCK}}`). Проверка «что можно скип/упростить» (CLAUDE.md §4) выполнена.
3. **Data-driven реестр окупился.** Добавить рубрику = создать `.md` (классификатор грузит всё из `rubrics/`); калибровка module-delivery свелась к правке весов в одном файле, без кода.
4. **Аудит окупился сразу — нашёл реальный баг, а не только проверил себя.** Live E2E на integration-сессии вскрыл кросс-платформенный дефект: `hooks/integrator/journal-hook.js` не логирует `Edit/Write` на Windows (`INTEGRATOR_PATH_PATTERNS` — регэкспы с прямыми слэшами против backslash-`file_path`), differential-доказательство (Bash-autolog работает, Edit — нет; вся история `#auto` = только Bash). Вне scope Инкр.1 → требует отдельной верификации+фикса; естественный кандидат для синтезатора патчей (Инкр.3). *Coverage-gap классификатора:* `slash_command`-сигнал ловит только assistant-invoked `SlashCommand` tool, не user-typed `/команды` (в пилотных сессиях `slash=[]`) — классификацию вытянули path/flag-сигналы, но user-slash-парсинг = fast-follow.

### Связь с другими entries

- DEC-DEV-0034 — создание `audit-smoke` (capture/audit decoupling, отвергнутый spawn-из-хука); v2 строится поверх
- CONVENTIONS §8 (no-auto-fix), §9 (self-application), §3 (mechanism-ratio) — инварианты дизайна
- meta-feedback (Product-модуль) — референс trust-asymmetry, но Level A; не реюзается для D7
- DEC-DEV-0055 — numbering verified против tail (0055→0056)

---

## DEC-DEV-0057 — Session Audit v2 Инкремент 2: полу-авто триггер (G1) + effect-probe (G4)

**Date:** 2026-06-01
**Trigger:** Реализация Инкр.2 дизайна Session Audit v2 (`dev/SESSION_AUDIT_V2_DESIGN.md` §5): G1 (полу-авто триггер при появлении транскрипта) + G4 (deterministic-оценка «как сессия повлияла на продуктовый проект»). Предшествовал D7 phase-kickoff с эмпирическим разрешением 5 открытых развилок.

**Tag:** #architecture #d7 #tooling #process-improvement

### Context

Инкр.1 (DEC-DEV-0056) дал классификатор + реестр рубрик (`--classify`). Инкр.2 закрывает два зазора §2 gap-анализа: **G1** (был только ручной `/meta:audit-smoke`) и **G4** (аудитор видел транскрипт + процесс-каталог, но не имел deterministic-замера эффекта на `.product/`). Драйвер уже идемпотентен (`--since`, skip Processed). Инварианты: NO auto-fix (CONVENTIONS §8), всё в `dev/meta-improvement/` (§9), phase-режим не ломать, classify аддитивен.

Kickoff потребовал разрешить 5 развилок до кода — три из них разрешены **эмпирически** (проверкой кода/данных, не дедукцией), что предотвратило неверные архитектурные допущения (substrate premise verification, ср. DEC-DEV-0052).

### Options considered

1. **Окно git для effect-probe:** (a) обогатить маркер `git HEAD` в `hooks/session-audit.js` (один отложенный touch хука); (b) деривировать окно из транскрипта. **Проверено:** записи транскрипта несут `timestamp` (46/70 в образце), `cwd` (полный путь пилота), `gitBranch`. → **Выбран (b)** — не трогает capture-хук (сохраняет минимализм DEC-DEV-0034), работает **ретроактивно** на уже-captured маркерах (у них нет git-HEAD); (a) дал бы только END-HEAD, START всё равно деривировать.
2. **Валидатор пост-состояния:** (a) реюз/извлечь логику `hooks/product/artifact-validate.js`; (b) standalone D7-валидатор. **Выбран (b)** — CONVENTIONS §9 запрещает D7 реюзать код Product-модуля; заимствуем *правила* (`docs/pmo/validation.md` §5.1), не код. Бонус: full-tree walker делает cross-file V-01/V-11, которые inline-хук явно откладывает.
3. **Кросс-проектный доступ:** как effect-probe видит `.product/` пилота (другой git-репо). **Проверено:** `my-first-test` — git-репо, ветка main, `.product/` tracked (282 файла). → резолв корня пилота из `cwd` транскрипта + чтение текущего `.product/` + git-история. Оба репо на одной машине.
4. **Форма триггера:** (a) документированный `/loop` + тонкая обёртка; (b) durable `CronCreate`; (c) только ручной. **Выбран (a)** — наименьший механизм (CONVENTIONS §3); `CronCreate` записан как альтернатива, ручной `--since` — «прямо сейчас». routines/RemoteTrigger дисквалифицированы (облако не видит локаль — подтверждено в DEC-DEV-0056).
5. **Ветка:** (a) продолжить на `feat/session-audit-v2-incr1`; (b) merge Инкр.1 → main, новая ветка. **Выбран (a)** — Инкр.2 тесно строится на коде Инкр.1 (`--classify`, `classify.js`); один связный feature-branch v2.

Доп. решения: **регрессия как атрибуция, а не before/after re-валидация** — каждой post-state находке проставляется `touched_in_session` (тронут ли артефакт сессией по transcript-writes ∪ git-diff окна); дёшево, детерминированно, прямо отвечает «эффект сессии». Полная before/after re-валидация и drift-сигнал отложены (cuttable scope, §4). **Coverage-gap классификатора** (loose end Инкр.1: `slash_command` ловил только assistant-invoked `SlashCommand`, не user-typed `/cmd`) свёрнут в Инкр.2.

### Decision

Реализовать Инкр.2 пятью sub-phase'ами на ветке `feat/session-audit-v2-incr1`: **2.A** classifier coverage-gap (парс `<command-name>/cmd</command-name>` из user-сообщений); **2.B** `scripts/effect-probe.js` (deriveWindow + gitWindow + touchedArtifacts + standalone validatePostState + readDebts + attribution + CLI); **2.C** проводка в `audit-smoke.js` `--classify` ветку через `{{EFFECT_PROBE}}` + Step 3.5 «Effect on product» в промпте + `effect_summary`; **2.D** `scripts/audit-watch.js` тонкая обёртка + `checklists/audit-watch.md` + CONVENTIONS §3/§4; **2.E** live E2E + этот DEC-DEV + design §5/§8/§9. Валидатор-scope (cuttable): V-01/V-04/V-09/V-10 + B.1-anti-rename + dangling-ref (subset V-11); полный bi-dir V-11 и семантические правила — у аудитора-LLM и `/product:validate`.

### Outcome

Новые файлы: `scripts/effect-probe.js` (standalone модуль + CLI), `scripts/audit-watch.js` (обёртка), `checklists/audit-watch.md` (ритуал). Модифицированы: `scripts/classify.js` (user-typed slash в `extractSignals` + экспорт `extractUserSlashCommands`); `scripts/audit-smoke.js` (require effect-probe, `renderEffectProbe`, вычисление effect-probe в classify-ветке, `effectProbe` opt, `{{EFFECT_PROBE}}` replace); `prompts/session-audit.md` (вход `{{EFFECT_PROBE}}`, Step 3.5, секция «Effect on product», `effect_summary`); `CONVENTIONS.md` §3/§4; `.claude/commands/meta/audit-smoke.md` (watcher-заметка). Хуки **не тронуты** (capture минимален — fork #1; Product-хук не реюзан — §9). 5 коммитов на ветке (2.A–2.D + 2.E).

**Детерминированная верификация зелёная:** `node --check` всех скриптов; 2.A unit `extractUserSlashCommands` PASS + реальный эффект (3f8a137b: `slash=[]`→`/product:handoff`→class `feature-definition`); 2.B 12/12 unit (window derivation / touched / validator V-10×2/V-09/dangling/V-01-not-fired / committed:false / no-repo) + CLI E2E на пилоте (258 артефактов, faithful findings); 2.C phase-режим регрессия (`--phase=4 --dry-run` exit 0, `{{EFFECT_PROBE}}`→none), placeholder-render без утечек; 2.D `--help` + `--since=1m --dry-run` passthrough.

**Live E2E (`--classify --transcript=04649f41 --force`, изолированно):** классификатор → `mixed-uncertain (low)` → effect-probe → `3B/1W post-state, 1 attributed to session` → `claude -p` аудитор → `status=findings` (2 Warning P-RULE-01/02, 1 Info), отчёт записан (закоммичен как evidence). **Секция «Effect on product» отработала как задумано** — аудитор не принял probe-атрибуцию за чистую монету: распознал, что `V-09 на SEG-003` (`touched_in_session:true`) — **path-based, а не каузальная** (SEG-001/002 несут идентичный V-09 с `touched:false` → все три SEG лишены `value_proposition` как pre-existing состояние, не регрессия сессии; «1 attributed честнее трактовать как 0 каузально-введённых»). Frontmatter `session_class`/`class_confidence`/`effect_summary` заполнены канонично. Подтверждает разделение «детерминированный замер + LLM-интерпретация».

**Byproduct-баг (journal-hook Windows) — верифицирован по коду как ФАНТОМ, корректирует DEC-DEV-0056 Lesson #4.** Live-audit Инкр.1 заявил, что `hooks/integrator/journal-hook.js` не логирует Edit/Write на Windows (forward-slash regex против backslash `file_path`). Проверка кода: нормализация `pNorm = p.replace(/\\/g,'/')` присутствует и в source (коммит `4ac3981`, 2026-05-26), и в deployed-копии пилота. Это plausible-but-wrong находка LLM-аудитора (увидел forward-slash в `INTEGRATOR_PATH_PATTERNS`, не заметил строку нормализации). **Source НЕ тронут; отдельного bugfix/DEC-DEV нет.**

### Lessons

1. **Plausible-but-wrong audit finding — реальный риск, верифицировать по коду до фикса.** Byproduct-баг из DEC-DEV-0056 при проверке кода оказался фантомом (fix уже был). Differential-«доказательство» в исходной находке (Bash-autolog работает, Edit нет) звучало убедительно, но игнорировало строку нормализации. *Apply:* синтезатор Инкр.3 ОБЯЗАН включать adversarial-verify (несколько скептиков на находку, default-refute) до promotion в patch-кандидат — иначе фантомы попадут в патчи. Прямой довод за perspective-diverse verify.
2. **Post-state одинаков across сессий — различает атрибуция.** Валидатор меряет текущий снапшот `.product/`, поэтому raw findings_count константен для всех транскриптов одного пилота; ценность effect-probe — в `touched_in_session` (regression-сигнал), не в абсолютном числе нарушений. *Apply:* в G4 акцент на attribution + git-diff окна, не на общем счёте.
3. **Деривация из данных > обогащение источника, когда данные уже есть.** Окно git вытащено из существующих полей транскрипта — это убрало правку хука И дало ретроактивность на 60+ captured-маркерах. *Apply:* перед добавлением capture-поля проверь, нет ли сигнала уже в потоке.
4. **Coverage-gap классификатора был существенным.** User-typed slash (канонический тег `<command-name>`) — сильнейший сигнал намерения; без него пилотные сессии шли `slash=[]` и тянулись path/flag-сигналами. Fix сразу сдвинул классификации (3f8a137b → feature-definition). Calibration validation: 04649f41/1cdfa987 показали `/design:start` → `mixed-uncertain` (design-рубрика отложена) — корректный fallback, не ошибка.
5. **Cuttable scope удержан.** Before/after re-валидация (хрупкая, дорогая) заменена attribution-прокси; full V-11 bi-dir, drift-сигнал, переименование команды — отложены явно. Инкр.2 поставил минимум, замыкающий G1+G4.
6. **Transcript-based `touched` недосчитывает subagent-работу — реальный лимит, вскрытый live E2E.** В 04649f41 русификация ~130 артефактов шла 7 background-субагентами; их Write/Edit — в sidechains, не в основном транскрипте, поэтому `touched` поймал лишь 2 файла (прямые правки). git-diff окна поймал бы всё, НО сессия uncommitted (`committed:false`) → атрибуция деградировала. Аудитор-LLM сам это вскрыл и пометил undercount. *Apply:* (a) Инкр.3 — рассмотреть скан subagent-sidechain транскриптов (`…/<uuid>/subagents/`) для полноты `touched`; (b) для committed-сессий git-diff уже покрывает; (c) ценный side-эффект: effect-probe честно сигналит, когда крупный diff не закоммичен.

### Связь с другими entries

- DEC-DEV-0056 — Инкр.1 (classifier+rubrics); Инкр.2 строится поверх; **корректирует его Lesson #4** (byproduct-баг = фантом)
- DEC-DEV-0034 — capture/audit decoupling; fork #1 сохраняет минимализм хука
- CONVENTIONS §3 (mechanism-ratio — watcher = наименьший механизм), §8 (no-auto-fix — probe read-only), §9 (self-application — standalone validator, не реюз Product-хука)
- DEC-DEV-0052 — substrate premise verification (развилки разрешены эмпирически, не дедукцией)
- numbering verified против tail (0056→0057)

---

## DEC-DEV-0058 — Orchestrator Module: направление «concept + dogfood» + ядро на in-harness Workflow

**Date:** 2026-06-02
**Trigger:** Открытый архитектурный запрос пользователя на проектирование Orchestrator Module (двухнедельный накопленный brain-dump). Research текущего состояния + разрешение двух стартовых развилок → фиксация направления до реализации.

**Tag:** #architecture #orchestrator #kickoff #scope-cut #tooling

### Context

Orchestrator Module — последний непостроенный продуктовый модуль, блокирующий PILOT POINT. В репозитории он существовал только как **концепт-граница**, прописанная со стороны Интегратора (Integrator SPEC §8): «запускает инструменты, классифицирует, маршрутизирует», читает tool-docs/active-tools/pmo-mapping/contracts. ROADMAP держит его в v1.1+ backlog с формулировкой «draft SPEC **после** реального pilot experience» — при том что «PILOT POINT **requires** Orchestrator» (циклическая зависимость, зафиксирована для разрешения).

Research вскрыл два факта, корректирующих вводные пользователя:
1. **Реально заведён только cc-sdd** (адаптер `handoff-to-ccsdd.js`, D2-T01/T06). «beads» и «docker mcp» из запроса — лишь иллюстративные примеры в доках, не интегрированы. Значит оркестрировать сегодня почти нечего; яркие сценарии (deploy/rollback) блокированы отсутствием D3/D5-инструментов.
2. Связь Интегратор↔Оркестратор в доках **односторонняя** (Integrator → tool-docs → Orchestrator). Пользовательское требование «Оркестратор командует Интегратору установить pgsql» — **новое**, требует обратного канала.

Запрос пользователя структурирован в 10 требований (R1-R10); сердце — R10+R4: «динамический путь, но воспроизводимый результат».

### Options considered

**Развилка 1 — стартовый подход** (с учётом предупреждения CLAUDE.md §3 про self-referential collapse):
1. Полный spec-first kickoff — быстрее к структуре, но риск проектировать на непроверенных допущениях.
2. Pilot-first — максимум dogfood, но дольше до кодифицированной структуры.
3. **Concept-SPEC + scoped dogfood** — тонкий концепт сейчас, затем 1-2 ручных прогона cc-sdd для эмпирического снятия регламентов. **Выбран** (баланс дизайна и валидации; прямой ответ на self-referential-collapse risk).

**Развилка 2 — субстрат ядра:**
1. **In-harness Opus 4.8 Workflow сейчас** — детерминированный хребет, минимум ops. **Выбран.**
2. Гибрид с n8n сразу — мощнее, но внешняя инфраструктура и ops-нагрузка преждевременны.
3. Спайк обоих — дольше; не оправдано при отсутствии durable-потребности.

Дополнительно приняты дефолты OD1-OD3 (см. SPEC §9): OD1 — команды Orchestrator→Integrator проходят сохранённый hard-approve gate (auto-approve только whitelisted dev-tier); OD2 — `orchestrator/processes/` + `skills/orchestrator/`; OD3 — первый процесс `route-handoff-to-cc-sdd` (= dogfood-цель, = вырезанная Phase 5 работа DEC-DEV-0040 Q3).

### Decision

Зафиксировать направление и написать три артефакта: `docs/orchestrator-module/SPEC.md` (concept draft v0), эту запись, `dev/ORCHESTRATOR_DOGFOOD_PLAN.md` (чек-лист ручного прогона). Реализацию НЕ начинать до dogfood-снятия регламентов. Трёхслойная модель детерминизма (скелет/суждение/гейт) — рамка R10. Autonomy tiers переиспользуют built-предохранители Интегратора (env_tiers, scope-guard, pending-actions, hard-approve gate — DEC-DEV-0047). Computer Use и n8n — отложены до конкретной потребности (cuttable scope).

### Outcome

Написаны 3 артефакта + SSOT-sync (ROADMAP «Где мы сейчас» строка про concept + README module-table статус `🔬 concept draft v0`) выполнен в **этом же коммите**. Работа смёржена в main через PR поверх параллельно-смёрженного Session Audit v2 Incr.3: FF на свежий `main` (`0c688a8`) + переприменение этой записи **перед** DEC-DEV-0059 (правильный numerical order). Эмпирические регламенты — pending dogfood. Циклическая зависимость PILOT↔Orchestrator разрешается выбранным путём: dogfood = ручная оркестрация = «manual pilot», из которого снимается регламент для автоматизации.

### Lessons

1. **Вводные пользователя про tool landscape надо верифицировать по репозиторию.** «cc-sdd + beads + docker mcp» при проверке свелось к одному cc-sdd; остальное — иллюстративные примеры. Проектирование scope на непроверенном списке инструментов дало бы нереалистичный первый инкремент. *Apply:* перед scope-планированием Оркестратора всегда сверять `active-tools.yaml`/`adapters/` с заявленным.
2. **Концепт-границу выгодно снимать со «смежного» модуля.** Самое детальное описание Оркестратора лежало в Integrator SPEC (что Интегратор *отдаёт* и чего *не делает*) — готовый негатив-отпечаток роли. *Apply:* при проектировании нового модуля сперва читать границы соседних.
3. **Built-предохранители одного модуля — готовый фундамент автономии другого.** env_tiers/scope-guard/pending-actions/hard-approve gate (Интегратор, DEC-DEV-0047) — ровно то, что нужно автономному-но-безопасному Оркестратору. Не строить заново.

### Связь с другими entries

- DEC-DEV-0040 Q3 — production routing (handoff → live /kiro:spec-init) вырезан из Phase 5 → Оркестратор; = первый процесс `route-handoff-to-cc-sdd`
- DEC-DEV-0047 — env_tiers + scope-guard + pending-actions + hard-approve gate; переиспользуются для autonomy tiers (§7) и OD1
- DEC-DEV-0052 — substrate premise verification (вводные верифицированы эмпирически, не приняты на веру) — применён здесь к tool landscape
- DEC-DEV-0059 — параллельная Session Audit Incr.3 сессия; взяла 0059, уступив 0058 этой Orchestrator-работе (порядок в журнале 0057→0058→0059)

---

## DEC-DEV-0059 — Session Audit v2 Инкремент 3 kickoff: re-anchor оракула на PMO-зоны (two-axis), журнал + синтезатор

**Date:** 2026-06-02
**Trigger:** D7 phase-kickoff (inline) для Инкр.3 дизайна Session Audit v2 (`dev/SESSION_AUDIT_V2_DESIGN.md` §6: G5 findings-журнал + G6 синтезатор патчей). В Section 1 (architectural readiness) вопрос заказчика «откуда механизм берёт эталон корректности сессии?» вскрыл структурный изъян модели рубрик Инкр.1 → решение переархитектурить оракул ДО строительства журнала/синтезатора.

**Tag:** #architecture #d7 #tooling #process-improvement #kickoff

### Context

Инкр.1 (DEC-DEV-0056) ввёл рубрики, ключённые по **абстрактному session-class** (feature-definition / bug-fix / integration / ecosystem-dev / module-delivery-shakedown / mixed-uncertain); классификатор берёт **argmax — один класс-победитель** (`classify.js:296`). Kickoff вскрыл две структурные проблемы:

1. **Single-label lossy.** PMO-карта (`docs/pmo/pmo-map.md`) показывает: одна продуктовая сессия легитимно охватывает D1 → D2-B → handoff. Winner-take-all схлопывает её в один класс, теряя остальные зоны. Заказчик: «3 модуля в одной сессии — это нормально».
2. **Task-class — неверная ось.** Эталон «как сессия должна была пройти» естественно привязан к **PMO-зоне/модулю** (что и какими спеками сверять), а не к абстрактной задаче. Доказательство: критерии аудитора A–G уже кластеризуются по зонам (B/C → D2-B, E → D1, G → Level B), рубрики лишь переоткрывают набор критериев зоны под ярлыком задачи.

Заказчик (solo dev) сформулировал направление: эталон = подгружать «судье» спеки/доки экосистемы (формальный step-trace не нужен — сессии не детерминированы); рубрики привязать к конкретным модулям и зонам PMO coverage. Дополнительно: механизм аудитит **только продуктовые сессии** — аудит self-dev сессий самой экосистемы выкинуть.

### Options considered

1. **Ключ рубрики:** (a) сохранить task-class; (b) zone-anchored; (c) гибрид. **Выбран (b)+нюанс (c)** — первичная ось зона, вторичная режим (#3).
2. **Лейблинг:** (a) single-label argmax (Инкр.1); (b) multi-label по порогу активации. **Выбран (b)** — прямо отражает мульти-зонные сессии; веса триггеров реюзаются как пороги активации, не argmax.
3. **Число осей:** (a) только зоны; (b) две оси (зона + mode-модификатор). **Выбран (b)** — зона задаёт baseline + применимые критерии; режим (feature/fix/refactor/maintenance из commit_type) модулирует строгость (semantic vs cosmetic, ср. Step 3.B/C P-RULE-01/02). Чистые зоны потеряли бы эту градацию.
4. **Граница зон:** (a) только owned (D1, D2-B вкл. design, integrator-handoff); (b) + делегированные (D2-T/D3/D4). **Выбран (a)** — D2-T/D3/D4 делегированы внешним тулам (`pmo-map.md:68-112`), их работы в Claude-сессии нет — виден только handoff в них (= D6). Рубрики для невидимого = риск пустых baseline.
5. **ecosystem-dev:** (a) сохранить аудит self-dev сессий экосистемы; (b) выкинуть. **Выбран (b)** — только продуктовые сессии. **Верификация (заказчик попросил):** ecosystem-dev был латентной заготовкой — никогда не captured (хук `session-audit.js` ставится лишь в пилотах через `/ecosystem:enable-d7-audit`; все маркеры = `my-first-test`) и ни разу не run. Удаление = чистка мёртвого кода, не слом рабочего пути.
6. **Порядок работ:** (a) re-anchor отдельным инкрементом (2 PR); (b) 3a внутри Инкр.3. **Выбран (b)** — 3a (re-anchor) → 3b (журнал) → 3c (синтезатор), один feature-branch. Re-anchor усиливает ось кластеризации журнала/синтезатора: `(zone, check_id)` осмысленнее абстрактного class.

### Decision

Переархитектурить оракул в **two-axis zone-anchored multi-label** до строительства журнала/синтезатора:

- **Зоны (owned-only, multi-label):** `D1-discovery`, `D2B-behavioral`, `D2B04-design`, `D6-integrator`. Хранятся данными в `rubrics/` (концепт task-class → zone-reference; зоны не хардкодятся в коде классификатора — сохраняем «добавить зону = добавить `.md`»).
- **Mode (модификатор строгости):** feature | fix | refactor | maintenance (из commit_type) + occasion-флаг `module-shakedown`.
- **Журнал (3b):** `finding_id = hash(zone | check_id | artifact | signature)`; накопление `session_ids`, `first/last_seen`, `status` (open|clustered|patch-proposed|patched|dismissed).
- **Синтезатор (3c):** кластеризация по `(zone, check_id)` → ≥3 инстансов = systemic → patch-кандидат → human gate `[Y/N/E/D]`; **ОБЯЗАТЕЛЬНЫЙ adversarial-verify** до промоушна (DEC-DEV-0057 Lesson #1 — фантомы). NO auto-fix (CONVENTIONS §8).

Реализация на `feat/session-audit-v2-incr3` (от main).

### Outcome (план; детали Outcome — по завершении 3c)

**ecosystem-dev removal inventory (3a):**
1. `rubrics/ecosystem-dev.md` — удалить
2. `classify.js:229` флаг `is_ecosystem_repo` + использования — удалить
3. `prompts/session-audit.md` — check_id G + Step 3.G + reference-док CONVENTIONS (стр. 48) удалить
4. `dev/SESSION_AUDIT_V2_DESIGN.md` §4.2 / §5 таблицы + `rubrics/README.md` — обновить таксономию
5. `rubrics/integration.md` anti-pattern note «не путать с ecosystem-dev» — обновить
6. `effect-probe.js` (стр. 359/377) — снять формулировку «ecosystem-dev», механизм no-`.product/` оставить

**Сохраняем (это продуктовый аудит, не self-dev):** `module-delivery-shakedown` (→ occasion/mode), phase-mode (`--phase=N`), effect-probe no-`.product/` handling.

### Outcome — реализовано (3a/3b/3c, commits a4ba265/49b63fe/d83625b + 3c)

**3a (re-anchor):** `classify.js` argmax→`classifyZones` multi-label (порог активации 2) + `detectMode` + `renderZonesBlock`; флаг `is_ecosystem_repo`/cwd убран. `rubrics/`: 6 task-class файлов → 4 owned zone-references (`D1-discovery`, `D2B-behavioral`, `D2B04-design`, `D6-integrator`) + `mixed-uncertain`; удалены bug-fix/feature-definition/integration/module-delivery-shakedown/ecosystem-dev. Промпт: zone-guided union baseline, check_id G + CONVENTIONS-ref удалены, frontmatter `session_zones`/`session_mode`. Driver: zones+mode проводка, audit-index `mode=zones:..|mode`. Верификация: 20/20 unit; calibration `1cdfa987` (`/design:start`) под старой моделью = `mixed-uncertain`, теперь = `D2B04-design+D2B-behavioral+D6-integrator`.

**3b (журнал G5):** `scripts/audit-journal.js` — парс отчётов, zone-инференция из artifact, `finding_id=sha1(zone|check|artifact|signature)`, накопление session_ids, ndjson (deduped+sorted, human-status сохраняется), `--rebuild/--report/--stats`; skip removed G + advisory. Live-ingest в classify-режиме. Backfill из 20 отчётов: 47 находок, 7 systemic кластеров. 17/17 unit.

**3c (синтезатор G6):** `prompts/patch-synth.md` (Stage 1 adversarial-verify ≥3 линзы default-refute → Stage 2 patch-кандидат) + `scripts/patch-synth.js` (кластеризация → systemic → `claude -p` → candidate + статус журнала) + `patch-candidates/` ([Y/N/E/D] gate). NO auto-fix (§8).

**Live E2E (`--cluster=D2B-behavioral:C`, 9 находок/7 сессий):** survived → patch-proposed. **Adversarial-verify сработал как задумано — прямое подтверждение Lesson #1 на реальных данных:** синтезатор распознал кластер как ГЕТЕРОГЕННЫЙ (9 находок = ≥3 root cause), выделил реальный spine из 3, отбросил 6 ложно-systemic — включая русификацию как cosmetic/maintenance по `rubrics/D2B-behavioral.md:32` mode-clause (двухосевая модель end-to-end) и auditor-self-marked non-violations. Already-handled lens прочитал реальные skills/commands. Предложил наименьший механизм (patch-template), аргументировал против hook (§3/§2/§9). Кандидат `patch-candidates/D2B-behavioral__C.md`, gate pending.

**Follow-up (после merge, как Инкр.1/2 через PR #20):** ROADMAP «Где мы сейчас» + memory-sync + PR; остальные 6 systemic кластеров — операционный прогон синтезатора пользователем.

### Lessons

1. **Оракул-точность — substrate-вопрос, всплывает при kickoff надстройки.** Вопрос «откуда эталон?» при kickoff надстроечного Инкр.3 вскрыл изъян нижележащего Инкр.1. *Apply:* при kickoff надстроечной фазы verify, что нижний слой даёт корректный сигнал, а не строй слепо поверх (ср. substrate premise verification, DEC-DEV-0052).
2. **Вторичная классификация переоткрыла структуру первичных данных.** Критерии A–G уже кластеризовались по зонам; ярлык задачи был лишним слоем косвенности. *Apply:* когда так — ключуй по первичной структуре, не по производному ярлыку.
3. **Кластер `(zone, check_id)` может быть гетерогенным — adversarial-verify нужен именно для расслоения, не только против фантомов.** Live-E2E: топ-кластер (9 находок) смешивал ≥3 root cause; детерминированный счётчик дал «9 systemic», но verify выделил spine из 3 и отбросил 6 (cosmetic-mode / anti-circular / separate-root-cause). *Apply:* синтезатор НЕ патчит кластер целиком по счётчику ≥3 — verify обязан дать per-finding disposition. Усиливает DEC-DEV-0057 Lesson #1.

### Связь с другими entries
- DEC-DEV-0056 — Инкр.1 (классификатор+рубрики); 0059 **переархитектурит его модель рубрик** (task-class → zone-anchored) + удаляет ecosystem-dev
- DEC-DEV-0057 — Инкр.2; Lesson #1 (adversarial-verify) — жёсткое требование к синтезатору 3c
- DEC-DEV-0040 — функциональная PMO-декомпозиция (D2-B/D2-T/D3/D4), источник зонной таксономии
- CONVENTIONS §1.3 (D6 vs D7 — почему ecosystem-dev/Level B вне продуктового аудита), §8 (no-auto-fix), §9 (self-application)
- numbering: tail был 0057; **0058 занят параллельной Orchestrator-сессией** (worktree `graceful-petting-hanrahan`, uncommitted, зафиксировано в shared memory) → этот entry = **0059**. Разрыв намеренный во избежание коллизии при будущем merge.

---

## DEC-DEV-0060 — Граница Integrator↔Orchestrator: capability-provisioning (role A), не инфра-исполнение

**Date:** 2026-06-02
**Trigger:** Пользователь при ревью Orchestrator concept-draft v0 (DEC-DEV-0058) заметил двоякость роли Интегратора: концепт-доки в одном месте трактовали его как DevOps-исполнителя инфраструктуры продукта («Интегратор поднимает БД в docker»), что противоречит уже зафиксированной границе «Интегратор оснащает, Оркестратор исполняет». Запрошен research по всем связанным файлам + выбор корректной модели.

**Tag:** #architecture #orchestrator #integrator #boundary #scope #concept

### Context

Research (Integrator SPEC целиком, Orchestrator SPEC v0, dogfood-план, pmo-map, DEC-DEV-0040 Q3, README) показал: «правильная» модель **уже** зафиксирована в четырёх местах — Integrator SPEC §1.2 («Не запускает рабочие сценарии»), §1.4 (метафора «кран в порту»: разгрузка контейнеров = докеры = Orchestrator), §8.3 (таблица: «Запустить в сценарии» Integrator ❌ / Orchestrator ✅), §15.4 (Postgres/MySQL/Docker MCP — не собственный тулбокс Интегратора); pmo-map (D3-05/D3-06 — delegated-зоны «через Integrator», runtime-владелец = Orchestrator); прецедент DEC-DEV-0040 Q3 («Integrator — технарь до installed+verified; production-маршрутизация = Orchestrator»).

Дрифт оказался **локальным** — только в свежем Orchestrator concept-draft (DEC-DEV-0058, написан в тот же день): §1.1 пример «подними pgsql vX», §6 «Интегратор поднимает БД в docker», dogfood §3 «обеспечь X». Глагол «обеспечить недостающую возможность» был верен, но иллюстрации подменяли семантику на «Интегратор делает инфра-работу продукта».

Сверх исправления формулировок пользователь внёс **новый** содержательный элемент: capability = не только «руки» (tool/MCP/доступ), но и «голова» (ответственный role-агент с предметным skill, напр. `db-admin`). Оркестратор перед инфра-шагом делает self-check наличия рук+головы; если не хватает — запрашивает у Интегратора. Это поставило развилку: кто заводит *bespoke* role-агента+skill, не входящего ни в один external package.

### Options considered

**Развилка — провижининг «головы» (role-агент + предметный skill):**
1. **Role A — Интегратор оснащает и «руки», и «голову» (выбрано).** Capability = полный слой (tool/MCP + role-агент/skill). Оркестратор только потребляет и исполняет. Плюс: одна точка ответственности за оснащение; Оркестратор остаётся чистым runtime-исполнителем; «job-description» модель Интегратора (DEC-DEV-0040 L5) естественно расширяется с «нанять инструмент» до «нанять инструмент + сотрудника». Минус: расширяет scope Интегратора за пределы external-tools; конфликтует с нынешним OD2 (skills/role-агенты в `skills/orchestrator/`).
2. Role B — Интегратор даёт только «руки» (tool/MCP), «голову» Оркестратор пишет себе сам. Плюс: Интегратор не трогает; OD2 без изменений. Минус: размывает «оснащение vs исполнение» — Оркестратор частично оснащает себя сам; две точки ответственности за capability; self-check теряет смысл (на половину capability некому эскалировать).

### Decision

**Role A.** Роль Интегратора расширяется с «внешние инструменты» до полного слоя **capability = «руки» (tool/MCP/доступ) + «голова» (bespoke role-агент + предметный skill)**. Инвариант «Интегратор оснащает, Оркестратор исполняет» сохранён и усилен. Командный канал §6 = запрос **capability**, не исполнения; формат (OD5) — **capability-spec** (type tool|mcp|role-agent|skill + id/версия + зона + tier + обоснование). Добавлен OD6 (= это решение). Расширение помечено **concept-tied / forward-looking**: направление принято, в shipped Integrator v1.0 не реализовано (двусторонний канал и сам Оркестратор ещё не построены).

### Outcome

Правки (без коммита):
- `docs/orchestrator-module/SPEC.md` — §1.1 (запрос capability вместо «подними pgsql»), §1.2 (не оснащает себя сам), §1.3 таблица (capability + строка «исполнить инфра-шаг»), §5 (связка с self-check), §6 (переписана семантика: self-check «руки»/«голова» → capability-spec, deploy исполняет Оркестратор), §9 (OD5 уточнён, OD6 добавлен).
- `docs/integrator-module/SPEC.md` — scope-note в шапке, новый bullet §1.1 («оснащает голову»), 2 строки в таблицу границ §8.3.
- `dev/ORCHESTRATOR_DOGFOOD_PLAN.md` — harvest-цель №3 + шаг 3 (capability self-check → capability-spec, не deploy-request).
- `DEV_JOURNAL.md` — эта запись.

**Не тронуто (намеренно):** README module-table (Integrator «сисадмин» — summary, role A forward-looking) и ROADMAP «Где мы сейчас» — обсуждается с пользователем отдельно; CHANGELOG — concept-level, не consumer-facing, до реализации не трогаем; pmo-map D3-05 «инфраструктура» — описывает зону, не Интегратора, корректно.

### Lessons

1. **Свежий concept-draft дрейфует от уже-зафиксированной границы через иллюстрации.** Сам механизм (глагол «обеспечить») был верен, неверным был пример («подними БД»). *Apply:* при ревью концепта проверять примеры против инвариантов соседних SPEC, не только основной текст.
2. **Декомпозиция capability на «руки» + «голову» делает self-check и командный канал осмысленными.** Без «головы» как явной части capability непонятно, что Оркестратор проверяет и что эскалирует. *Apply:* capability = доступ (tool/MCP) + know-how (role-агент/skill); провижинит обе половины один владелец (Интегратор).
3. **Расширение роли shipped-модуля помечай concept-tied.** Integrator v1.0 заморожен; role A — направление, не реализация. Маркер не даёт принять forward-scope за выполненное.

### Связь с другими entries

- DEC-DEV-0058 — Orchestrator concept v0 + двусторонний канал §6; здесь скорректирована семантика канала (capability, не исполнение) + принят OD6
- DEC-DEV-0040 Q3 — прецедент границы «Integrator технарь / Orchestrator runtime»; role A — прямое продолжение
- DEC-DEV-0040 L5 — «job-description» модель coverage; расширена с «нанять инструмент» до «+ нанять сотрудника» (role-агент)
- DEC-DEV-0047 — hard-approve gate / env_tiers / pending-actions; переиспользуются для OD1, не меняются этим решением

---

## DEC-DEV-0061 — Level-2 wipe protection: git safety-commit footprint'а инструментов перед `/ecosystem:update`

**Date:** 2026-06-05
**Trigger:** Запрос пользователя: «создай/перепроверь механизм создания коммитов на все возможные артефакты инструментов, установленных из продуктового проекта, на предмет стирания при update. защита от wipe второго уровня». Re-verify показал: git-механизма защиты нет вообще — только файловые backup'ы (level-1).
**Tag:** #architecture #spec-revision #wipe-protection #integrator #ecosystem-update #policy-revision

### Context

`/ecosystem:update` имел **только level-1** защиту от wipe — файловые снапшоты:
- Step 2a: `.claude-backup-<TS>/` (снапшот всего `.claude/`)
- Step 2b (DEC-DEV-0051): `_external/` — integrator-managed paths вне `.claude/` (`.kiro/`, `.beads/`) из `active-tools.yaml#claude_primitives[].path`
- Step 5.1/Step 6 (DEC-DEV-0049/0051): namespace-aware preserve + hooks merge-preserve — *предотвращают* затирание, но не дают recovery layer
- `/integrator:*` Stage 1: пер-команда backup в `.claude/integrator/backups/`

Все они **файловые** и хрупкие как единственный слой:
- `.claude/integrator/backups/` — **в `.gitignore`** (gitignore.template:16) → не в истории
- `.claude-backup-<TS>/` — untracked dir → стирается `git clean -fdx`, теряется при ручном cleanup, отсутствует после свежего clone
- если артефакты инструмента были uncommitted working-tree изменениями, update их затёр, **и** backup-папку потом удалили → полная потеря

Существующая политика явно запрещала git-защиту: *«DO NOT auto-commit anything to git (user reviews + commits manually)»* (update.md + CLAUDE.md). Запрос пользователя — сознательная ревизия этой политики ради durable level-2.

**Критическая граница:** `.claude/integrator/secrets/` и прочие gitignored-пути НЕЛЬЗЯ коммитить. Их покрывает только level-1.

### Options considered

**Развилка 1 — форма коммита (спрошено у пользователя):**
1. **Обычный commit в текущую ветку (выбрано пользователем).** `git add -- <footprint>` + `git commit`. Виден в `git log`, восстановление через `git restore --source=<sha>`. Минус: засоряет историю ветки; нарушает прежнюю no-auto-commit-политику (принято осознанно).
2. Выделенный git-ref/тег (`refs/ecosystem-safety/pre-update-<TS>`) без движения HEAD — не засоряет историю, согласуется с no-auto-commit-в-ветку. Отклонено пользователем (предпочтена простота и видимость в `git log`).
3. `git stash -u` с меткой — fragile (stash легко потерять/перезаписать), плохо покрывает committed-state. Отклонено.

**Развилка 2 — default (спрошено у пользователя):**
1. **Вкл по умолчанию + `--no-safety-commit` (выбрано).** Максимальная защита из коробки; symmetric с тем, что level-1 backup тоже on-by-default.
2. Opt-in через `--safety-commit`. Отклонено — пользователь просил именно «защиту».

**Развилка 3 — размещение шага (решено мной):**
1. **Step 5.0 (выбрано)** — в начале apply, после Step 4 `[Y/n]` gate, до первой деструктивной операции. Коммит создаётся только на подтверждённом пути применения, никогда в `--dry-run`/abort.
2. Step 2c (рядом с level-1 backup) — отклонено: коммит — это git-мутация, в `--dry-run` (который exit'ит на Step 4) его быть не должно, и создавать коммит для впоследствии отменённого update неаккуратно.

**Развилка 4 — охват команд (решено мной, cuttable-scope):**
1. **Только `/ecosystem:update` (выбрано).** Это и есть единственный однозначный wipe-вектор (вся сага DEC-DEV-0049/0051 — про него). `/integrator:*` уже имеют пер-команда backup + rollback и сами являются инсталляторами инструментов.
2. Зеркалить в `/integrator:update` тоже — отложено как симметричный кандидат (дублирование протокола в installation-protocol.md; преждевременно без явной потребности).

### Decision

**Новый Step 5.0 в `commands/ecosystem/update.md`** — scoped git safety-commit footprint'а инструментов, on-by-default, `--no-safety-commit` для отключения. Обычный commit в текущую ветку.

**Footprint** (= «все артефакты установленных инструментов»):
- `.claude/integrator/` целиком (registry + contracts + adapters + tool-docs + project-journal; gitignored под-пути `secrets/`/`backups/`/`baseline.yaml` авто-исключаются `git add`)
- все `claude_primitives[].path` из `active-tools.yaml` — внутри И снаружи `.claude/` (тот же парсер, что Step 2b, но без фильтра «outside `.claude/`»)
- `.claude/settings.json` (third-party hook-инъекции)

**Инварианты:** (1) никогда `git add -f` (секреты вне level-2); (2) scoped commit `git commit … -- <paths>` (чужой WIP не затрагивается и не теряется); (3) skip-not-abort при любой git-проблеме (не git-репо / detached HEAD / merge|rebase в процессе / ошибка) — level-2 никогда не блокирует update; (4) no-op если footprint уже == HEAD (HEAD и есть recovery point).

### Outcome

Правки (spec-only, как DEC-DEV-0049/0051 — Claude интерпретирует `.md`):
- `commands/ecosystem/update.md` — frontmatter (description + `--no-safety-commit` в argument-hint); «What it does» (level-1/level-2 bullets); Flags (`--no-safety-commit`, dry-run note); Step 2 forward-reference; **новый Step 5.0** (Why + footprint + 4 инварианта + bash + PowerShell reference impl); Step 4 dry-run note; Step 8 summary (level-1/level-2 блок); Error handling (строка safety-commit → skip-not-abort); What NOT to do (политика сужена); Rollback (новая секция «Level-2 recovery»); Comparison table (2 строки).
- `gitignore.template` — добавлен `.claude-backup-*/` (транзитные level-1 backup'ы не коммитить).
- `CHANGELOG.md` — `[Unreleased] ### Added` (2 пункта).
- `ROADMAP.md` — «Где мы сейчас» строка + «Последнее обновление» 2026-06-05.
- `CLAUDE.md` — `last memory-sync` 2026-06-05 (зеркало ROADMAP).
- `DEV_JOURNAL.md` — эта запись.

**Не реализовано (намеренно):** зеркало в `/integrator:update` (развилка 4 опция 2 — отложено); bootstrap не трогается (greenfield — нечего wipe'ать). **Pending:** runtime smoke на pilot — `/ecosystem:update` в проекте с cc-sdd/beads: ожидается (a) safety-коммит с footprint'ом в `git show --stat`; (b) секреты НЕ в коммите; (c) `--no-safety-commit` пропускает; (d) `--dry-run` не коммитит; (e) не-git-репо → skip-not-abort.

### Lessons

1. **Один уровень защиты — не защита, если он хрупкий по конструкции.** Level-1 был файловым и частично gitignored; единственный слой, который сам себя стирает при `git clean`. Два *независимых* слоя (файл + git-история) с разными failure-модами — реальная durability. *Apply:* для любого recovery-механизма спрашивать «что стирает сам backup?» и добавлять ортогональный слой.
2. **Re-verify до проектирования отделяет «создай» от «перепроверь».** Запрос был «создай/перепроверь»; проверка показала отсутствие git-слоя целиком — значит «создай». Без неё легко надстроить дубль над несуществующим. *Apply:* на «создай/перепроверь» сначала эмпирически верифицировать наличие (родственно `feedback_substrate_premise_verification`).
3. **Память отставала на номере DEC (0058/0059 vs журнал на 0060).** Verify-against-journal-tail (урок DEC-DEV-0050 R2) поймал коллизию → 0061. *Apply:* всегда grep'ать хвост DEV_JOURNAL перед присвоением номера; память — не источник истины для нумерации.
4. **Сужать запреты, а не отменять.** Политику «никогда не auto-commit» не сняли, а сузили до одного scoped opt-out коммита с явными инвариантами (-f запрещён, pathspec, skip-not-abort). *Apply:* при ревизии запрета формулировать новую границу точечно, чтобы не открыть широкий класс нежелательного поведения.
5. **Платформенный паритет обязателен (Windows-разработчик).** bash + PowerShell для Step 5.0 с самого начала (урок DEC-DEV-0047 L2 / DEC-DEV-0050 finding 5).

### Связь с другими entries

- DEC-DEV-0051 — Step 2b external-paths backup; Step 5.0 переиспользует его парсер `claude_primitives[].path` (снимая фильтр «outside `.claude/`»)
- DEC-DEV-0049 — Step 6 hooks merge-preserve; `.claude/settings.json` в footprint'е по той же причине (third-party hook-инъекции)
- DEC-DEV-0042 — closed-list contamination removal; родственный паттерн «узко, не-деструктивно»
- DEC-DEV-0050 R2 — verify next DEC number против хвоста журнала (сработало здесь)

---

## DEC-DEV-0062 — LESSON-* : атомарная самокоррекция (find→fix→record), неоткладываемая; инверс .pending

**Date:** 2026-06-06
**Trigger:** Пользователь спросил, есть ли в экосистеме надёжный триггер фиксации **собственной ошибки в продуктовых проектах** — когда стало понятно, что задача сделана некорректно, чтобы это писалось в журнал для доработок и не терялось/откладывалось. Аудит продуктовой стороны показал: автоловушка есть только для **структурных** нарушений (V-* → `.product/.pending/`, scope-guard → `pending-actions.md`); **смысловой** класс «сделал задачу неверно» не покрыт ничем — ни триггера, ни журнала, ни артефакта. Запрошена сборка механизма `LESSON-*`.
**Tag:** #architecture #product #hooks #self-correction #lesson #atomicity #validation #governance

### Context

Два класса ошибок. Структурный (битая ссылка, невалидный frontmatter, нарушение зоны) — ловится хуками надёжно. Смысловой («это решение/артефакт оказались неверными», «переделка по факту») — нет. Среди 22 типов артефактов нет defect/lesson/rework; `.pending/` — это **отложенная** очередь (инверс того, что нужно); decision journal отвечает «почему выбрали», не «что сломалось + как уже починено». DEV_JOURNAL — dev-only, в продуктовые проекты не деплоится.

Дизайн собран workflow'ом (13 агентов: 5 читателей конвенций → 3 угла enforcement + синтез → 3 адверсариальных критика → финал). Затем **web-search верифицировал hook-контракт** по официальной доке (`code.claude.com/docs/en/hooks`) — это сняло главный residual-risk (см. ниже).

### Options considered

**Enforcement (как сделать «не теряется/не откладывается»):**
1. Hook-gate primary (Stop/PreToolUse блокирует) — сильные зубы, но риск wedge.
2. Command-transaction primary (только протокол) — просто, но «cannot be lost» держится на «модель не отвлеклась».
3. **Hybrid (выбрано):** mandate (триггер) + write-ahead command (атомарность) + двупронговый gate (non-deferrability). Каждый слой закрывает отказ других.

**Gate mode (после web-search, развилка вынесена пользователю):**
1. Strict на обоих prongs — макс. зубы, но PreToolUse-strict рискует self-deadlock протокола (блокирует его собственные Write/Bash) при неточной marker-exemption.
2. **Strict Stop, warn PreToolUse (выбрано пользователем).** Stop-блок документирован + auto-override после 8 блоков (не зависнет) + не мешает протоколу (срабатывает только на границе сессии); PreToolUse пока только напоминает — его marker-exemption проверяется живым смоуком (S-LE) до включения deny.
3. Warn на обоих — безопасно, но без зубов.

### Decision

23-й тип артефакта `LESSON-*` в `.product/lessons/LESSON-NNN-slug.md` (no-dot → git-tracked wildcard'ом), структурный (как HYP/BR, не freeform как NOTE), `status: open | active | deprecated`. Три слоя:

1. **Триггер (mandate, soft):** в момент осознания ошибки — `/product:lesson` до любой другой работы. Живёт в `templates/project/CLAUDE.md.template` **И** в синкаемом `skills/ecosystem/self-correction.md` (чтобы existing installs, получающие только `/ecosystem:update`, имели триггер, а не только зубы).
2. **Атомарность (write-ahead command transaction):** `open`-файл (+ маркер `lesson-in-progress`) пишется **до** того, как фикс коснётся диска; затем фикс; затем verify с recorded evidence; затем флип `open→active` одним полным Write. Любой краш оставляет громкий git-tracked `open`-tripwire; полу-записанный файл ловит gate.
3. **Non-deferrability (двупронговый gate):** `lesson-gate.js` (Stop, **strict**) не даёт чисто закрыть сессию при `open`; `lesson-presence-gate.js` (PreToolUse+UserPromptSubmit, **warn**) напоминает каждый ход (deny — за `LESSON_GATE_MODE=strict`, после S-LE).

**Инвариант (V-LE-02/03):** `active ⇒ fix_ref резолвится ∧ recorded verification evidence ∧ guard present` — структурная инверс тихого `.pending` finding.

### Outcome

18 файлов (без коммита):
- **Создано:** `docs/pmo/artifacts/LESSON.md`, `skills/product/lesson-capture.md`, `commands/product/lesson.md`, `hooks/product/lesson-gate.js`, `hooks/product/lesson-presence-gate.js`, `skills/ecosystem/self-correction.md`.
- **Изменено:** `hooks/product/manifest.yaml`, `settings.json.template`, `docs/pmo/validation.md` (§0 namespace + §5.1b V-LE-01..05), `skills/product/validation-runner.md`, `docs/pmo/artifacts/README.md` (счётчики 21/22→23 + tree), `docs/pmo/processes.md` (§8/§10/§14.2/§6.5), `docs/product-module/SPEC.md` (21→23, 6→8 hooks), `commands/ecosystem/bootstrap.md` (mkdir lessons + Step 6b пример), `templates/project/CLAUDE.md.template` (mandate), `commands/ecosystem/verify.md` (Step 8.5 self-check), `dev/PHASE_6_SMOKE_TEST_PLAN.md` (S-LE), `DEV_JOURNAL.md` (эта запись).

**Версия:** помечено v1.5.0 (next minor после 1.4.0 Design Module). CHANGELOG/ROADMAP «Где мы сейчас» — не тронуты до решения по коммиту/релизу (обсуждается с пользователем).

**Авторизованные намеренные отклонения:**
- **Первый блокирующий хук** в экосистеме (против конвенции «Hook never blocks», `hooks/product/manifest.yaml:79` / handoff-gate). Scoped к corrective lessons; fail-open на любой ошибке; `LESSON_GATE_MODE` opt-out; auto-override после 8 блоков.
- `status: open` **подменяет** generic `draft` (не добавляется рядом). Rationale: `draft` parkable-навсегда; `open` должен быть non-parkable.
- **«verified» = model-attested с recorded evidence**, не машинно-доказанная корректность (V-LE-02/03 проверяют резолв ссылки + непустую секцию, не что фикс реально чинит баг).

**Критические поправки исходного синтеза после web-search (важно для будущего):**
- Дока подтвердила: **Stop-хук МОЖЕТ блокировать** (`exit 2`, stderr → модели; платформо-независимо). Заметка в `session-audit.js:26` («SessionEnd cannot block») верна **для SessionEnd**, но синтез ошибочно обобщил её на Stop — это была Stop/SessionEnd конфляция. Prong A реально работает.
- PreToolUse denies через `hookSpecificOutput.permissionDecision:"deny"` (+ `permissionDecisionReason`), **не** `{continue:false}` (последнее = «остановить Claude целиком»). Хук переписан на `permissionDecision`.
- `stop_hook_active` guard реален и нужен (8-block auto-override — документированный safety valve против wedge).

### Lessons

1. **Верифицируй runtime-контракт по доке до того, как ставить на него гарантию.** Синтез заложил «Stop не блокирует» из локальной заметки репо — web-search опроверг за 2 минуты и перевёл gate из warn-навсегда в strict-Stop. *Apply:* для любого hook-блокирующего механизма — сверка с `code.claude.com/docs/en/hooks` обязательна, не доверять второисточнику в репо.
2. **«atomic temp+rename» из дизайна не маппится на инструменты ассистента** (он пишет через Write одним вызовом). Реальная гарантия — write-ahead ordering + полный валидный файл за один Write + truncated-file tripwire в хуке. *Apply:* проектируя протокол для LLM-исполнителя, выражай атомарность через порядок операций и backstop, не через fs-примитивы, которых у него нет.
3. **Детект — нередуцируемое слабое место.** Все слои активируются после того, как ошибка замечена. Гарантия честно = «не теряется ОДНАЖДЫ обнаруженное», не «всё ловится». Event-driven кандидаты (DA-dismiss/validation-fail/cascade) частично де-софтят. *Apply:* не переоценивать «надёжный триггер» — формулировать границу честно.
4. **Self-referential safety:** механизм деплоится в продуктовые проекты, но **не** регистрируется в dev-сессии экосистемы (нет `.product/`, хуки no-op). Блокирующий Stop-gate в dev-сессии = риск self-collapse (CLAUDE.md принцип №3), сознательно не сделано.

### Связь с другими entries

- DEC-DEV-0012 — explicit frontmatter template + anti-pattern warnings в skills; `lesson-capture.md` следует этой конвенции (canonical fields: `fix_ref`/`guard`/`guard_kind`, запрещены `fixed`/`mitigation`/`takeaway`/…).
- DEC-DEV-0040 — функциональная PMO-декомпозиция; LESSON — cross-cutting, вне D1-D2 графа (как NOTE).
- DEC-DEV-0023 F5 — quiet-draft + auto-purge pending; LESSON сознательно **инверс** (не quiet, не deferred).
- DEC-DEV-0030 lesson #2 — hardcode validation-runner vs parser; V-LE зеркалированы вручную (линтера catalog↔runner нет).
- **S-LE** (dev/PHASE_6_SMOKE_TEST_PLAN.md) — hard-prereq живой проверки контрактов Stop-exit-2 / PreToolUse-deny / bootstrap Step 6b new-event-key до перевода PreToolUse в strict.

---

## DEC-DEV-0063 — open-design: из ad-hoc per-project install в переиспользуемый Dockerized viewer экосистемы

**Date:** 2026-06-06
**Trigger:** Пользователь подключил open-design (nexu-io/open-design, Apache-2.0) в продуктовом проекте `my-first-test` как альтернативный HTML-viewer/migrate-target для Stitch-макетов — но через одноразовый `/integrator:add`. Запрос: переиспользовать инструмент для **множества** проектов → переиспользуемые куски в репо экосистемы (расходятся `/ecosystem:update`) + машинно-глобальный общий daemon, per-project — тонкий стейт. Реализация по implementation-prompt (`my-first-test/.claude/integrator/open-design-ecosystem-patch.PROMPT.md`).
**Tag:** #architecture #integrator #design #tooling #docker #adapter

### Context

open-design = Dockerized HTML **viewer**, не генератор и не источник истины: переносится только визуальный HTML, метаданные (SC/BR/state-matrix/DS-tokens) НЕ мигрируют, канон в MK/NM. Host-Node route непригоден (нужен Node 24 + pnpm; host на Node 18, corepack broken) → daemon в контейнере (node:24-alpine, порт 7456, volume open_design_data). Reference-реализация в `my-first-test` была one-off; gold-адаптер нёс конкретные install-time метаданные и читал токен только из env. Gap: в репо `adapters/` отсутствовали И `stitch-to-opendesign.js`, И `mk-to-stitch.js` (CNT-002) — нарушение tri-location pattern (DEC-DEV-0040 Q1 / DEC-DEV-0044).

### Options considered

**Где живут design-facing возможности (viewer / migrate-target / `external_viewers` дефолт):**
1. В Integrator (он ставил инструмент) — но UI-визуализация = зона D2-B04 = Design Module.
2. **В Design Module (выбрано).** Integrator держит только инфраструктуру (daemon-mgmt + контракт + адаптер); Design Module — viewer/migrate-target/template-дефолт/status-check. Зеркалит границу DEC-DEV-0060 (role A).

**migrate `--to open-design` семантика:**
1. Как regeneration-цель (brief → генерация) — неверно: open-design ничего не генерирует.
2. **Viewer-import (выбрано):** import существующего HTML через adapter `--import`; нет brief, нет генерации, нет миграции метаданных, **НЕ инкрементит `iteration`** (import ≠ regeneration). Отдельная ветка Step 5-OD + reframed gate/preview.

**Setup-док машинного daemon:** dev/ vs **BOOTSTRAP.md (выбрано пользователем)** — раздел «open-design shared daemon (machine-global)».

**Viewer dispatch:** расширить design-session.md vs **новый skill `open-design-viewer.md` (выбрано)** — нет iteration loop, симметрия с stitch-workflow/html-fallback.

**mk-to-stitch.js gap:** только зафиксировать vs **backfill (выбрано)** — чистый additive lift, закрывает тот же tri-location gap.

### Decision

Три слоя. **Layer 1 (машинно-глобальный):** token precedence в адаптере (`--token` → env → `~/.claude/integrator/secrets/open-design.token` → `./.claude/...`) — один токен/daemon на машину; BOOTSTRAP-раздел (recipe + token gen + health). **Layer 2 (патч репо):** Integrator — reference-адаптеры + `source: docker` + SPEC §4.1.1 daemon-pattern + add.md docker-path; Design — migrate `--to open-design` + open-design-viewer skill + `external_viewers` template + status-check + SPEC §3.6/§4.4b. **Layer 3:** reconcile my-first-test (local) + live E2E.

Инварианты соблюдены: D2-B04=Design зона; viewer≠generator; HTTP `/api/import/claude-design` не `od mcp`; tri-location adapter с reference-blanks; draft→verify→active + hard approve gates; token-gated `127.0.0.1`; supply-chain (non-pilot = pinned digest/build-from-source); pilot-light (no global npm, user-zone не клоббрится).

### Outcome

Файлы (Layer 1+2, на фича-ветке `feat/open-design-ecosystem-extraction`, 6 коммитов + этот meta):
- **Создано:** `adapters/stitch-to-opendesign.js`, `adapters/mk-to-stitch.js`, `skills/design/open-design-viewer.md`.
- **Изменено:** `adapters/README.md`, `docs/integrator-module/SPEC.md` (§4.1 enum + §4.1.1), `skills/integrator/tool-profiling.md` (enum), `commands/integrator/add.md` (docker path), `commands/design/migrate.md` (--to open-design + Step 5-OD), `commands/design/start.md` (external_viewers template), `commands/design/status.md` (daemon check), `docs/design-module/SPEC.md` (§3.6 + §4.4b), `BOOTSTRAP.md` (daemon setup), `CHANGELOG.md`, `DEV_JOURNAL.md`.
- **Не в PR экосистемы:** reconcile my-first-test (local к тому репо); машинно-глобальный `~/.claude/integrator/tool-catalog/open-design.yaml` (опц.).

**Версия:** target v1.5.0 (как и DEC-DEV-0062 LESSON). CHANGELOG — под `[Unreleased] ### Added`; формальный cut `[1.5.0]` с датой — **отложенное релиз-решение** (разделяется с 0061/0062, обсуждается с пользователем), единолично не дату́рую.

**Нумерация:** изначально план целил 0062, но rebase на актуальный main вскрыл, что 0062 занят LESSON-atomic (бывшая коллизия 0061 в main разрешена в его пользу) → эта запись = **0063**. Подтвердило §F плана (verify номер по git перед присвоением).

### Lessons

1. **Rebase на актуальный main до написания meta-файлов.** Ветка была ответвлена от устаревшего main (a612e56); локальный main уже ушёл на 3863eeb (PR #24/#25). Писать CHANGELOG/journal против стейл-базы → коллизия номеров + конфликты. *Apply:* перед L2-META всегда `git rebase main` + re-grep highest DEC-DEV.
2. **Viewer ≠ generator должно быть видно в коде, не только в доке.** Инвариант «no metadata, no iteration bump» закодирован отдельной веткой migrate Step 5-OD и viewer-only skill, который НЕ мутирует MK (A8 владеет записями). *Apply:* семантические инварианты выражай структурно (отдельный путь), не комментарием в общем пути.
3. **Reference-blanks vs instance-values.** Gold-инстанс нёс конкретные `@source_ref`/`@installed_at`/`@target_tool_version` — в репо-reference они обнулены до placeholder'ов (как handoff-to-ccsdd.js); инжект значений — задача Stage 5 `/integrator:add`. *Apply:* поднимая instance→reference, всегда снимай install-time метаданные.

### Связь с другими entries

- DEC-DEV-0040 Q1 / DEC-DEV-0044 — tri-location adapter + reference-blanks; этот entry применил паттерн к docker-tool и закрыл gap (оба адаптера отсутствовали в репо).
- DEC-DEV-0060 — граница Integrator↔Orchestrator (role A); здесь зеркальная граница Integrator↔Design (инфра vs design-facing).
- DEC-DEV-0052 — Design Module; `/design:migrate` расширен viewer-import целью без слома Stitch↔HTML пути.
- DEC-DEV-0062 — тоже target v1.5.0, тоже отложил CHANGELOG/ROADMAP до релиз-решения; cut 1.5.0 объединит обе работы + 0055/0061.
- DEC-INT-0011 / DEC-INT-RESEARCH-0003 (my-first-test project-journal) — install-решение + research (env-блокер, auth-уроки, supply-chain caveat) — источник обобщения.

### Релиз

**1.5.0 cut 2026-06-11 (PR #26 merge).** Бандл накопленного с 1.4.0: DEC-DEV-0055 (harness-audit hygiene, PR #19) + 0061 (level-2 wipe protection) + 0062 (LESSON-*) + 0063 (open-design). Механика: CHANGELOG `[Unreleased]` → `[1.5.0] — 2026-06-11` (+ свежий пустой Unreleased); ROADMAP-маркеры `(Unreleased)` → `(1.5.0)` + новая status-строка 0063 + bump «Последнее обновление»; тег `v1.5.0`. **Сознательный cut с deferred runtime smoke:** S-LE (LESSON-gate контракты) + Phase 6 S1-S7 остаются непрогнанными — отгружено code-complete со static verification, по прецеденту Phase 5 (1.3.3/1.4.0 отгружались так же). Релиз НЕ снимает S-LE как hard-prereq перед переводом `lesson-presence-gate.js` PreToolUse warn→strict — это отдельный гейт на следующую pilot-сессию.

---

## DEC-DEV-0064 — Первый принятый patch из Session Audit v2: DA subagent-type контракт (B+C) + V-18 schema-хук (A)

**Date:** 2026-06-12
**Trigger:** После прогона 11-сессионной Pending-очереди (журнал 50→66) и синтеза, human-gate `[Y/N/E/D]` по 3 survived-кандидатам. Пользователь выбрал путь (а): принять A/B/C и собрать **один патч**. Первое прохождение полного цикла Session Audit v2 до applied fix (find→accumulate→synthesize→verify→**accept→patch**).
**Tag:** #meta-improvement #product #da #validation #session-audit #patch

### Context

Три выживших кластера (adversarial-verified), два из них — **один корень**:
- `D2B-behavioral::C` (patch-template) — F.3 batched BR→DA вызывался через `general-purpose` (нет каноничного batched-invocation для копирования).
- `D2B-behavioral::B` (codify-pattern) — IC→DA: харнесс «Agent type 'product-devils-advocate' not found» → **тихий** fallback в `general-purpose`.
- `D2B-behavioral::A` (add-hook) — `.product/` артефакты на диске с не-каноничным per-type frontmatter; ни inline-хук, ни runner не проверяли per-type schema.

### Что сделано (2 deliverable)

**D1 — DA subagent-type контракт (консолидирует B+C):**
- `skills/product/feature-session.md` §«DA orchestration flow» Step 4: явный канонический `Agent({subagent_type:"product-devils-advocate", …})` сниппет (зеркало `product-da-review.md:117-120`) + batched-BR ветка (кластер = multi-artifact brief к тому же каноничному subagent) + правило «not found ⇒ STOP, не тихий fallback». Anti-patterns #9 (запрет `general-purpose`) + #10 (not-found = blocking setup-ошибка).
- НОВЫЙ `dev/meta-improvement/patterns/da-subagent-type-contract.md` (D7 codify-pattern, provisional).

**D2 — V-18 per-type schema conformance (A):**
- `hooks/product/artifact-validate.js`: новое warning-level правило, override-/tier-aware, **scoped to IC/BR/SC** (подтверждённые enum'ы, highest drift) для контроля false-positive. Verify: smoke на drifted IC (3 находки) / clean IC (0) / drifted BR (category) PASS; exit 0 (non-blocking).
- `docs/pmo/validation.md` §5.1: каталог-запись V-18 + счётчик 39→40 (V-*: 15→16).

### Ключевые решения

1. **Консолидация B+C** — один корень (каноничный DA-тип не используется), правят одну секцию `feature-session.md`. Не два полу-фикса.
2. **R4 (почему агент «not found») НЕ трогаем** — требует live-harness (вложенный путь `agents/product/` vs `name`-поле vs stale bootstrap пилота). Спекулятивный bootstrap-фикс из prompt-scope = ровно plausible-but-wrong патч, против которого DEC-DEV-0057 Lesson #1. Кодифицирован как открытый follow-up (наследует DEC-DEV-0043 R4).
3. **V-18 scoped to IC/BR/SC, не blanket** — у LESSON (`open|active`) и HYP свои status-enum'ы; blanket-проверка статуса дала бы false-positive. Warning, не blocking; override-escape через `validation_overrides`.
4. **Hard enforcement hook отвергнут** для D1 — PostToolUse не наблюдает `subagent_type` Agent-вызова надёжно; template-fix = наименьший механизм (CONVENTIONS §3).

### Journal writeback

11 spine-находок → `patched` (+`dec_dev_ref: DEC-DEV-0064`); 5 явных non-violations → `dismissed` (anti-circular / cosmetic / da-remediation). 8 периферийных остаются `patch-proposed` — флагнуты в Evidence кандидатов как **отдельные** items (separate root cause): `br-change-trigger.js` dedup-wipe (`1ff552c0c6b4`), re-DA owner-call (`b2e3035c3fdd`/`685265ce3985`), `.da-findings/` schema (`613ae7128d66`/`f7039575c7e5`/`13fafe80a7f8`), body-cascade rename (`99030316972c`), cosmetic russification (`1eb76ab23bd4`).

### Follow-ups (cuttable-scope, вынесены из патча)

- **R4 registration root-cause** (live-harness) — promote pattern provisional→validated после закрытия.
- **Cross-doc count sweep 39→40** — `validation.md` обновлён; остальные ~9 canonical-count доков ([[reference_pmo_canonical_counts]]) — отдельный sync.
- **V-18 расширение** — runner-mirror (`validation-runner.md`) + типы за пределами IC/BR/SC, когда подтвердятся enum'ы.
- **`patch-synth.js:214` silent-failure** — логирует только `res.stderr`, а `claude -p` ошибки в stdout → 2 кластера упали «тихо» (диагностировано вручную). Печатать stdout-хвост на провале.

### Связь с другими entries

- DEC-DEV-0056/0057/0059 — Session Audit v2 (механизм, давший эти кандидаты); это первый его applied-patch outcome.
- DEC-DEV-0043 R1/R4 + DEC-DEV-0038 — DA subagent-type как known debt; D1 = исполнение R1, R4 остаётся.
- DEC-DEV-0057 Lesson #1 — de-conflate before synthesizing; применён и при scope'ировании spine (3 of 9 в C, 5 of 10 в A), и при отказе от спекулятивного R4-фикса.
- DEC-DEV-0012 / B.1 pattern — V-18 закрывает enforcement-gap, который B.1 templates (prevention-only) не покрывают при inline-авторинге.

---

## DEC-DEV-0065 — Реконсиляция пилот↔экосистема: research двустороннего дрейфа + upstream worktree pre-flight (шаг 1)

**Date:** 2026-06-12
**Trigger:** Пользователь запросил детальное сравнение актуальной экосистемы с экосистемным слоем пилота `my-first-test` (фичи добавлялись в пилоте «как частный случай»), затем — старт upstream'а с worktree-хуков и наладку двустороннего моста синхронизации.
**Tag:** #reconciliation #hooks #worktree #pilot #drift

### Context — двусторонний дрейф (результаты исследования)

Baseline пилота = **v1.4.0** (последний полный sync — `af2b1b8` в пилоте) + один частичный reconcile DEC-DEV-0063 (`ad17588`, только `stitch-to-opendesign.js`). Метод: рекурсивный diff деплоируемой зоны + **трёхстороннее сравнение** каждого расходящегося файла против блоба v1.4.0 → направление дрейфа per-file (а не просто факт различия). Gotcha метода: `diff --exclude=integrator` маскировал и `commands/integrator/` — exclude матчит basename на любом уровне; перепроверено отдельным проходом.

- **Экосистема впереди (пилот byte-equal v1.4.0):** 28 изменённых + 9 новых файлов — LESSON-* (0062), wipe-protection update (0061), viewer-остаток open-design (0063), V-18/DA-контракт (0064), harness-audit (0055), doc-реформа (MAP.md, orchestrator SPEC, счётчики). Чистое отставание, закрывается `/ecosystem:update`.
- **Пилот впереди (локальные фичи):** 3 кластера, ~1840 строк ecosystem-зоны + 416 строк instance-адаптеров: **(1) App Map** — де-факто 24-й тип артефакта `AM` + `/design:map` + skill + 6 хуков `app-map-*.js` + V-AM-* в validate (пилотные коммиты `019bf5e`, `c561dc1`); **(2) open-design как ГЕНЕРАТОР** (CNT-004, DEC-INT-0012, `edf7057`) — концептуальная развилка с каноном (там viewer-only CNT-003, DEC-DEV-0063); **(3) worktree pre-flight** (`887c52f`) — этот патч.
- **Конфликты:** `hooks/product/manifest.yaml` (append-append, тривиален) и `docs/pmo/artifacts/README.md` — обе стороны написали «23 типа», но это **разные 23** (канон: 22+LESSON; пилот: 22+AM); честный merge = 24. Та же count-drift gotcha, что в PR #27.
- **Риск:** `/ecosystem:update` сейчас = rsync-with-delete в managed namespaces → удалит все пилотные фичи из рабочего слоя (восстановимо из git/backup'ов, но слой ломается: `design.yaml` останется с `default_design_tool: open-design` при удалённом skill'е). Порядок «сначала upstream, потом update» — обязателен.

Полный inventory + последовательность шагов: `dev/PILOT_RECONCILIATION_PLAN.md` (новый, этим же патчем).

### Что сделано (шаг 1 — worktree pre-flight upstream)

- `hooks/product/worktree-preflight.js` (265 строк) + `worktree-enter-guard.js` (83) скопированы из пилота с единственной генерализацией: убрана продукт-специфичная ссылка «bead m5k» из описания `.design-sessions`.
- `manifest.yaml`: entry `worktree-enter-guard` (PreToolUse, matcher `EnterWorktree`), warn-only.
- `smoke-hooks.js`: +2 кейса (foreign-tool no-op; EnterWorktree advisory с `CLAUDE_PROJECT_DIR=tmp`). Прогон 21/21 PASS. Preflight покрыт транзитивно: его crash попал бы в banner guard'а → FATAL_PATTERNS.
- eslint: 0 errors / 6 warnings (база hooks/ = 103 warnings — в пределах принятого шума).

### Ключевые решения

1. **Worktree-хуки первыми** — самый самодостаточный кластер (не трогает каталог артефактов/счётчики/SPEC), низкий риск, немедленная ценность: сам этот репозиторий активно работает в worktree'ях, а dogfood-план Оркестратора уже ссылается на pre-flight сверку.
2. **Upstream verbatim, не переписывание** — хуки уже соответствуют конвенциям (warn-only, fail-open, Node stdlib, RU-вывод, additionalContext-инъекция). Единственная правка — генерализация bead-ссылки.
3. **`worktree-preflight.js` остаётся helper'ом без manifest-entry** — это standalone-инструмент (`--strict`/`--json`), который guard вызывает `spawnSync`'ом; не hook-событие. Прецедент non-hook файла рядом: `hooks/product/lib/`.
4. **Реконсиляция — планом, не серией ad-hoc сессий:** App Map требует решения «канонизировать ли 24-й тип» (счётчики по ~10 докам, см. reference_pmo_canonical_counts), open-design-generator требует отдельного DEC о пересмотре viewer-only модели. Оба вынесены в план, не смешаны с этим патчем (cuttable scope).

### Lessons

- Независимая эволюция инсталляции и канона без моста дала за ~2 недели два встречных потока по ~2-3 kLoC; «оба написали 23» показал, что **счётчик без enumeration — ловушка merge'а** (число совпадает, множества разные). При sync'е счётчиков сверять списком, не числом.
- Session Audit v2 дрейф **видел** (patch-candidate `D2B04-design__A`), но вердикт refuted («pilot-fork drift, не дефект канона») оставил его без owner'а — у аудита нет категории «канонизировать пилотную фичу». Мост = этот план + журнал.

### Follow-ups

- **Шаг 2:** App Map extraction (отдельный DEC; счётчики 23→24; merge `artifacts/README.md` = LESSON + AM).
- **Шаг 3:** open-design generator — DEC о судьбе CNT-004 в каноне (generator vs viewer-only; канонизация `od-mcp-call.cjs`/`od-consolidate.cjs`/`od-fidelity-check.js` в repo `adapters/`; `design_tool` enum в MK.md).
- **Шаг 4:** `/ecosystem:update` в пилоте (закрывает «экосистема впереди» одним прогоном) + ручной merge двух конфликтных файлов; затем smoke S-LE / S1-S7 там же.

---

## DEC-DEV-0066 — App Map (AM) канонизирован как 24-й тип артефакта (reconciliation шаг 2)

**Date:** 2026-06-13
**Trigger:** Шаг 2 плана `dev/PILOT_RECONCILIATION_PLAN.md` (DEC-DEV-0065). Пользователь подтвердил направление («merge, и переходи к шагу 2») и попросил завершить процесс автономно.
**Tag:** #reconciliation #design #app-map #artifacts #validation

### Context

App Map существовал только в пилоте my-first-test (коммиты `019bf5e`, `c561dc1`): де-факто 24-й тип артефакта без канонической спеки. Session Audit видел его файлы и рефьютил находки как «pilot-fork drift» — тип нужно было либо канонизировать, либо осознанно отвергнуть. Польза доказана пилотом (L0-обзор + USER FLOW walker на 6 фичах TranslateIt) → канонизируем.

### Decision

**AM = канонический 24-й тип** (D2-B04, 🟢 Confirmation, root singleton `.product/app-map.md` — рядом с problem.md, это обзор продукта, не часть mockups-кластера). Перенесено: спека `AM.md`, `/design:map`, skill `app-map-generate.md`, 6 скриптов `app-map-*.js` (hook-событие только `app-map-cascade`; остальные — helpers по прецеденту `hooks/product/lib/`), V-AM-ветка в `design-artifact-validate.js`, manifest-merge.

### Ключевые решения

1. **V-AM зарегистрированы в validation.md (§5.3b), а не оставлены «неучтёнными»** — хук, эмитящий правила вне SSOT-каталога, ровно тот класс дрейфа, против которого V-18 (DEC-DEV-0064). Идентификаторы оставлены описательными (`V-AM-frontmatter`/`-id`/`-module-ref`/`-nm-ref`) как в пилотном хуке — перенумерация в V-AM-01..04 разошлась бы с уже работающим кодом ради косметики. Счётчик правил 40→44.
2. **Счётчик артефактов 23→24 — сверен списком, не числом** (урок DEC-DEV-0065: «оба написали 23» = разные 23). Sweep по всем носителям: README, docs/README, docs/MAP, pmo-map (3 места + D2-B04 row + формула разбивки), processes (2), validation (2), product SPEC (5 — вкл. найденные вне memory-списка строки 121/136/979), design SPEC (2). Заодно закрыт отложенный 0064 follow-up «count-sweep 39→40» (39-остатки в pmo-map:5,176, validation:112, обоих SPEC ушли сразу на 44).
3. **Внутренний дрейф пилота исправлен при канонизации:** command/skill/manifest ссылались на `.product/mockups/app-map.md`, тогда как hook-regex, спека AM.md и реальный файл пилота живут в корне `.product/` — канон унифицирован на корень (эмпирически проверено по пилоту).
4. **Генерализации:** bd-ссылки пилота убраны из заголовков скриптов; `generated: '2026-06-06'` (hardcoded) → динамическая дата; FM-001/FM-002-специфика в thumbs-комментариях обобщена; «m5k pattern» → «committed canonical screens»; Related Skills в AM.md обновлены с «planned» на фактический tooling.
5. **app-map-viewer.js — браузерный ES5, не Node-хук:** scoped `eslint-disable no-var, no-undef` с пояснением вместо правки кода под Node-конфиг (код инлайнится в генерируемый HTML).
6. **design SPEC: компактный §3.6b вместо renumber** — вставка между 3.6 и 3.7 не ломает существующие кросс-ссылки. Таблица примитивов §2.1 синхронизирована эмпирически (7 команд / 9 скиллов / 2 хука) — была stale ещё с Phase 6 (заявляла 6 скиллов при фактических 7).

### Verify

- smoke-hooks: +4 кейса (V-AM-id warning на active, valid-AM quiet, cascade no-op без AM, cascade AM-stale на mechanical drift) — **25/25 PASS**.
- eslint hooks/design/: **0 errors** / 19 warnings (в пределах принятой базы).
- Counts: `git ls-files docs/pmo/artifacts/ | grep -v README | grep '\.md$' | wc -l` = 24; grep-sweep по «23 тип/39 прав/40 актив» — пусто.

### Follow-ups

- Handoff §10/§11 site-map embedding (AM.md Relationships «опц.») — не реализовано ни в пилоте, ни здесь; ждёт реальной потребности.
- V-18 расширение на `type: app-map` (per-type schema) — вместе с общим V-18 ростом (0064 follow-up).
- AM cascade v1.1: per-module signature (has_ui flip без изменения набора FM сейчас не детектится — known gap, задокументирован в хуке).

---

## DEC-DEV-0067 — open-design: generator-роль (CNT-004-class) канонизирована рядом с viewer (reconciliation шаг 3)

**Date:** 2026-06-13
**Trigger:** Шаг 3 плана `dev/PILOT_RECONCILIATION_PLAN.md`. Автономное продолжение по поручению пользователя («заверши весь процесс автономно»).
**Tag:** #reconciliation #design #integrator #open-design #adapters

### Context

Канон 1.5.0 (DEC-DEV-0063) зафиксировал open-design как **viewer-only** («не генератор и не источник истины»). Пилот тем временем сделал его **default-генератором D.2/D.3** (DEC-INT-0012, CNT-004): Claude авторит DS-привязанные `SI-*.html` и пишет их в OD-проекты через `od mcp` stdio. Концептуальная развилка требовала решения: канон отвергает generator-роль или принимает dual-role.

### Options considered

1. **Viewer-only остаётся; generator — пилотная девиация.** Отвергнуто: generator-путь в пилоте работает (FM-003/FM-004/FM-005 экраны сгенерены им), это сильная сторона пилота, ради которой и затевался мост; кроме того `/ecosystem:update` (шаг 4) снёс бы рабочий слой пилота.
2. **Generator вытесняет viewer.** Отвергнуто: роли не конкурируют — viewer обслуживает migrate-путь существующего HTML (`/design:migrate`), generator — авторинг D.2/D.3 через design-session dispatch. Разные команды, разные контракты (CNT-003 HTTP import vs CNT-004 od-mcp stdio).
3. **Dual role (принято):** generator = opt-in значение `design_tool: open-design` (canon-default остаётся `stitch`; пилот у себя держит open-design project-default'ом через `design.yaml` — user zone, update не трогает); viewer — без изменений.

### Что сделано

- `skills/design/open-design-workflow.md` → канон (генерализации: DS-пример «Чистота и Точность» с пилотными hex → generic-описание токенов; `— my-first-test` в naming → `— <project-name>`; bd-ссылки убраны; DEC-INT-0012 оставлен как провенанс).
- `design-session.md`: dispatch-ветка `open-design` (D.2/D.3) + enum в session-state схеме.
- Enum-sweep: MK.md `design_tool`, design SPEC (default_design_tool комментарий, §13 enum, §1.4 tool-список).
- **Tri-location gap закрыт:** `adapters/od-mcp-call.cjs` + `od-fidelity-check.js` + `od-consolidate.cjs` (канонические источники с tri-location header'ами; у consolidate пилотный hardcode `FEATURES` (FM-001/FM-002 my-first-test) заменён на закомментированный per-project шаблон — instance-копия настраивается при установке).
- Доки: design SPEC §4.4c (generator skill) + правка §3.6 v1.5-ноты («не генератор» → «в migrate-контексте viewer; generator — отдельный путь §4.4c»); integrator SPEC §4.1.1 generate-path addendum; adapters/README (3 строки + явное исключение из verify-mode правила).

### Ключевые решения

1. **CNT-004 в каноне — «CNT-004-class», не литеральный id.** CNT-ids назначаются per-project реестром `/integrator:add` (у пилота CNT-004 = od-generate). В integrator SPEC §8.3-нарративе фигурирует вымышленный «CNT-004 (handoff → spec-design)» — это иллюстративный пример, НЕ реестр; коллизию не правим (нарратив явно гипотетический), но canonical-доки используют формулировку «CNT-004-class» чтобы не закреплять чужой id глобально.
2. **Daemon-coupled драйверы освобождены от verify-mode правила явно, а не молча.** adapters/README требует `--verify-only` у каждого адаптера; od-mcp/od-consolidate без daemon'а dry-run'ить нечего. Вместо тихого нарушения — задокументированное исключение; verify-роль для миграций несёт `od-fidelity-check.js` (детерминированный sha256 round-trip).
3. **Canon-default `design_tool` остаётся `stitch`.** Generator-роль канонизирована как опция; смена default'а — продуктовое решение per-project (`design.yaml`, user zone). Пилотный default сохранится при update нетронутым.

### Verify

- `node --check` на всех трёх адаптерах PASS; smoke-runner 25/25 (адаптеры — не hooks, runner их не гоняет by design).
- Generator-путь live-проверен пилотом (экраны FM-003..005 созданы именно им) — канонизация lift-as-is, без поведенческих правок драйвера.

### Follow-ups

- `/integrator:add open-design` Stage 5: copy-список адаптеров должен включать od-* тройку (сейчас add docker-path документирует stitch-to-opendesign; расширение — при следующем заходе в add.md).
- Mode B (`start_run`) — разблокируется если в OD-контейнер запекут agent CLI.
- IR-слой (§16 design SPEC) — generator-путь добавляет аргумент к v2 IR (двусторонняя миграция Stitch↔OD).

---

## DEC-DEV-0068 — dev/ реорганизация в plans/gates/deferred + патч хардкоднутой конвенции; docs count-drift sync

**Date:** 2026-06-14
**Trigger:** Запрос «навести порядок в dev/ и docs/» («прическа» + «чистка от лишнего»). Разведка тремя параллельными агентами вскрыла: (1) ~14 свободных файлов в корне `dev/` без структуры; (2) count-drift в docs/ после канонизации AM/V-18; (3) накопленный регенерируемый вывод в `meta-improvement/` + `_archive/`.
**Tag:** #housekeeping #conventions #tooling #doc-reform

### Context

Корень `dev/` смешивал активные планы, smoke/readiness-гейты, deferred-доки и один shipped design-doc. Но `PHASE_<N>_SMOKE_TEST_PLAN.md` / `PHASE_<N>_READINESS.md` в корне — **не бардак, а действующая конвенция** (CONVENTIONS §5.1) с **хардкодом** в `audit-smoke.js:575` (`path.join(repoRoot,'dev',`PHASE_${N}_SMOKE_TEST_PLAN.md`)`) и ссылками в 5 D7-доках (phase-kickoff/closure, audit-smoke-workflow, smoke-test-plan, session-audit). Перенос в подпапку ломает `/meta:audit-smoke` («Smoke plan not found»).

Параллельно docs/ показал отставшие счётчики: `validation.md:969` и `docs/README.md:32` держали «39 правил» (каноника 44 после V-18); `CLAUDE.md:99` — «22 типа артефактов» (каноника 24 после AM, DEC-DEV-0066). AM не был вписан в перечень артефактов Design-потока в `processes.md` P2.5.

### Options considered

1. **Минимальный реорг** (уважить конвенцию): не двигать PHASE_<N>_* гейты, навести порядок индексом `dev/README.md`. Нулевой tooling-риск, но «полнота» структуры частичная.
2. **Полный реорг + патч тулинга** (выбрано пользователем): создать `gates/`, перенести все гейты, синхронно пропатчить хардкод + конвенцию + 5 доков. Больше риска, но единообразная структура.

Пользователь сознательно выбрал (2) после того, как развилка с хардкодом была явно поднята.

### Decision

Полный реорг: `plans/` (LOCAL_DOCS, ORCHESTRATOR, PILOT, TIER_2) · `gates/` (PATCH_1.3.3/PHASE_6 smoke, PHASE_7 readiness, S_LE) · `deferred/` (Phase D трио) · `_archive/session-audit-v2/`. `v1_1_backlog.md` остаётся в корне (living). Синхронно: `audit-smoke.js` live-путь → `dev/gates/`, CONVENTIONS §5.1 active-локация → `dev/gates/`, 5 D7-доков обновлены. Все перемещения через `git mv` (история сохранена, detected as R).

**Принцип по истории:** живые указатели (CLAUDE/ROADMAP/orchestrator SPEC/команды/v1_1_backlog/scripts) репойнтнуты; `DEV_JOURNAL.md`/`CHANGELOG.md`/`_archive/**` **не переписываются** — это point-in-time память, а не индекс. Факт реорга зафиксирован в `dev/README.md` для объяснимости старых путей.

Чистка по их же retention-политикам: удалён мёртвый `_archive/phase-5/smoke-evidence/` (97KB, 0 ссылок); phase-4 audit (aggregate+summary) и 3 accepted patch-candidates (A/B/C, DEC-DEV-0064) → архив; 6 refuted-pending оставлены (анти-фантом-память). Кодифицирован пробел: CONVENTIONS §5.4 — patch-candidate disposition после гейта.

### Outcome

4 коммита (A docs-sync / B reorg+tooling / C retention / D policy). Верифицировано: `audit-smoke.js --phase=6 --dry-run` резолвит план по `dev/gates/` (6 сценариев); 25 D7-хуков PASS; relative-ссылки резолвятся на диск; `git grep` живого surface на старые пути — пусто (только история сохраняет старые пути, намеренно).

C2 (clean audit-reports >30 дн) оказался **no-op**: эмпирически самый старый clean-отчёт — 2026-05-15 (на границе), остальные июньские. Директория не была раздута устаревшими clean — ожидание плана (~20-30 файлов) не подтвердилось чтением frontmatter.

### Lessons

1. **Конвенция с хардкодом ≠ бардак.** Прежде чем «прибирать» файлы в корне, проверь, не завязан ли на их расположение тулинг/конвенция (grep скриптов на путь). Косметический фолдеринг против хардкода — высокая цена, синхронный патч обязателен.
2. **Перемещение на уровень глубже ломает `../`-ссылки целым классом.** Файл из `dev/X.md` → `dev/sub/X.md`: все `](../root-file)` становятся `](../../root-file)`, а bare `](meta-improvement/...)` → `](../meta-improvement/...)`. Первый проход (только кросс-папочные target'ы) это пропустил; поймал второй проход (link-existence scan на диск). Урок: после любого перемещения markdown — проверять резолв ссылок физически, а не только переименованные target'ы.
3. **Читай frontmatter, не угадывай объём чистки.** План закладывал «~20-30 clean-отчётов на удаление»; реальность (чтение 44 frontmatter) — 0. Эмпирика дешевле и честнее оценки.
## DEC-DEV-0073 — Orchestrator dogfood RUN 01: реверс-инжиниринг 13ч-сессии → каталог из 7 процессов + SPEC v1.0-draft

**Date:** 2026-06-14
**Trigger:** Пользователь прошёл фактический dogfood-прогон роли Оркестратора над cc-sdd (сессия `6dc62bc8`, my-first-test, 2026-06-13). Поручение: многосторонний аудит прогона перед доработкой модуля — «как и почему claude делал каждое действие и как с этим должен справляться оркестратор».
**Tag:** #pilot-finding #architecture #spec-revision #orchestrator

### Context

Концепт Оркестратора (DEC-DEV-0058, SPEC v0.1) зафиксировал направление, но эмпирические регламенты ждали dogfood (`ORCHESTRATOR_DOGFOOD_PLAN.md`). План целил снять **один** процесс (`route-handoff-to-cc-sdd`, D2-T spec-генерация, одна фича FM-001). Фактическая сессия ушла **далеко за scope**: батч из 4 фич через консилиум архитекторов → cross-spec review → fidelity-аудит → **полная TDD-реализация auth (FM-001, 26 задач)** через self-paced `/loop` с per-task implementer + adversarial-reviewer субагентами → feature-validation → live runtime-smoke. ~13ч, 2168-строчный транскрипт (6.5 МБ), 55 субагентов, пережила один `/compact`.

### Что сделано

- **Метод разбора:** mагентный Workflow (14 агентов) — 8 построчных action-леджеров по чанкам транскрипта (что/почему/как/как-должен-оркестратор/gap) + 5 сквозных измерений (роли+каталог / гейты+автономия / capability-канал / движок / ручные-точки) + синтез. Плюс ручное чтение крайних чанков для калибровки/контроля.
- **Harvest-лог:** `dev/ORCHESTRATOR_DOGFOOD_RUN_01.md` (карта 7 этапов, таксономия 11 ролей, реестр 24 capability-дефицитов, находки P0/P1/P2, открытые вопросы).
- **SPEC v0.1 → v1.0-draft:** развёрнут §3 (1 → 7 процессов с триггерами/ролями/гейтами), добавлена §3-bis таксономия role-агентов, переписаны §6/OD5 (типология +env-constraint/secret, поле `route`, раздельные provisioning/execution-tier, async-протокол) и §7 (реальная раскладка + re-formulation-петля), добавлена §2-bis (эмпирика движка /loop-vs-Workflow + три провала durability).

### Ключевые решения / находки

1. **Оркестратор — two-process pipeline (P3 spec-gen → P5 impl-loop)**, обрамлённый init (P1) и validation (P6), где детерминизм держится **не на качестве thinking субагента**, а на скелете + risk-classifier + verification-гейтах с независимыми oracle. Это эмпирически подтверждает 3-слойную модель §2.
2. **Durable skeleton решает /compact-хрупкость бесплатно — сильнейший аргумент ЗА модуль.** После `/compact` (полная потеря контекста, #1124) цикл восстановился побайтово из git+tasks.md+beads, потому что человек вручную экстернализовал «continuation contract» в tasks.md. Workflow-скрипт несёт это by-design.
3. **Канал §6 НЕ активировался ни разу за 13ч** — инфра оснащена заранее, env-дефициты Оркестратор поглотил сам (нарушив границу), API замокал, prod вынес в follow-up. Вывод: **§6 нельзя валидировать на `route-handoff-to-cc-sdd`** (он требует только cc-sdd skill + чтение `.product/`); §6 нагрузится только на D3 с неоснащённой инфрой. Эталон §6 — Docker-стек (#10); анти-эталон — фикс адаптера CNT-001 (#29, Оркестратор чинил чужую зону).
4. **`gate-risk-classifier` — недостающее звено** между «всё inline» (дёшево, риск пропуска) и «всё adversarial» (дорого). Самое частое недокодифицированное человеческое суждение E4. Единственный REJECT прогона (4.6 timing-oracle) пришёлся ровно на HIGH-tier задачу — доказательство ценности independent-review.
5. **`disable-model-invocation` на `/kiro-impl` ⊥ автономии** → P5 реализовать **нативно** (Workflow читает tasks.md и диспатчит implementer'ов напрямую), не как обёртку `/kiro-impl`.
6. **Scope первого инкремента — оставлен открытым (рекомендация E2-only).** P3 (`batch-features-to-cc-sdd`) самодостаточен и не нагружает §6; E4–E6 спроектированы, но отложены до прогона с неоснащённой инфрой. Решение НЕ фиксируется этой записью — это следующий шаг.

### Verify

- Реестр дефицитов и роли сверены против двух прочитанных вручную крайних чанков + 8 агентных леджеров (cross-check).
- Эмпирический факт «тесты зелёные ≠ dev стартует» подтверждён в самом транскрипте: live-boot `node dist/main.js` дал 500 на signup/login (`.env` не грузится процессом), 201/401/200 после экспорта env (#2151–2156).
- Баг адаптера (§10 затирает §1-7 + regex генератора `v1.(0|1|2)`) подтверждён **всё ещё присутствующим** в эталоне экосистемы `adapters/handoff-to-ccsdd.js` — фикс пилота не доехал upstream (вписывается в DEC-DEV-0065).

### Lessons

- **Spec-first на conditional-модуле опасен ровно так, как предупреждает CLAUDE.md §3.** Концепт §6 (capability-канал) спроектирован умозрительно; первый реальный прогон показал, что в его текущей форме он не срабатывает, а Оркестратор по умолчанию поглощает зону Интегратора. Регламент надо снимать с прогона, не кодировать из головы — что и сделано.
- **Verification по содержанию, а не по наличию** — единственный дефект, тихо прошедший синтаксический гейт (адаптер C-04), был семантическим мис-маппингом. Presence-level гейты дают ложное «зелёно».
- **mагентный реверс-инжиниринг длинной автономной сессии — переиспользуемый паттерн** (кандидат на канонизацию в D7).

### Follow-ups

1. Канонизировать **P0-1** (content-level adapter-oracle) + **пропагировать фикс адаптера upstream** в `adapters/handoff-to-ccsdd.js` (monotonic-guard + generator-regex до v1.4).
2. Спроектировать `gate-risk-classifier` (P0-2) + стартовый реестр load-bearing инвариантов из auth-спека (IC-001..007, BR-007/009/012/013/020).
3. Зафиксировать scope первого инкремента (E2-only vs extend) отдельным решением.
4. Прототип **P5 как нативного Workflow-скелета** (снять конфликт `disable-model-invocation`).
5. Прогон №2 с **неоснащённой** инфрой — единственный способ провалидировать §6 на D3.

---

## DEC-DEV-0074 — Адаптер handoff-to-ccsdd: фикс §10-клоббера upstream + блокирующий C-07 (канонизация P0-1)

**Date:** 2026-06-14
**Trigger:** Follow-up №1 из DEC-DEV-0073 (Orchestrator dogfood RUN 01). Harvest показал: пилот поймал и починил баг адаптера, но эталон экосистемы (`adapters/handoff-to-ccsdd.js`) **всё ещё его нёс** — фикс не доехал upstream (класс дрейфа DEC-DEV-0065).
**Tag:** #bug-fix #pilot-finding #tooling

### Context

Root cause полностью разобран в DEC-DEV-0073 (P0-1): `extractSections` ключевал секции плоско по `## N.` (last-write-wins); v1.3/v1.4 handoff'ы встраивают MK/DS/NM UI-подсекции под §10 с рестартом нумерации `## 1.`–`## 7.`, тихо затирая реальные §1/§2/§5/§6. Контракт при этом рапортовал `passed: true` — presence-level `C-04` проверял лишь наличие `## N.` заголовка, не семантику маппинга. Это **единственный дефект прогона, тихо прошедший синтаксический гейт**.

### Что сделано

- **`extractSections` monotonic-guard:** `## N.` открывает top-level секцию только если N строго больше максимально принятого; вложенные рестарты (N ≤ max) уходят в тело §10. §11/12/13 (>10) принимаются.
- **`C-03` supported-generator range** расширен до `product-module-v1.{0..4}` (адаптер теперь robust к v1.3/v1.4-структуре; v1.5+ остаётся warning'ом до ре-верификации).
- **Новый блокирующий `C-07` content-fidelity** — body каждого ID-несущего поля обязан нести каноническое ID-семейство секции (§5→`SC-`, §6→`BR-`, §9→`IC-`). Пустые секции пропускаются. Это и есть **канонизация P0-1**: верификация по содержанию, не по наличию.
- **Регресс-guard:** фикстура `tests/fixtures/FM-FIXTURE-002-handoff.md` (v1.4, §10 с вложенными MK/NM) + исполняемый тест `tests/adapters/handoff-ccsdd.contract.test.cjs` (4 кейса, включая **негативный** — доказывает, что C-07 блокирует клоббер). Подключён как `npm run test:adapters` и в `npm run verify`.
- Доки: CHANGELOG `[Unreleased] → Fixed`; `adapters/README.md` + `tests/fixtures/README.md` ноты.

### Ключевые решения

1. **C-07 — blocking, не warning.** Смысл P0-1: presence-level гейт дал ложное «зелёно»; блокирующий content-gate — это и есть «реальный гейт, а не глаз человека». ID-семейства SC-/BR-/IC- мандатированы handoff-spec, поэтому false-positive риск низок; пустые секции пропускаются (фича может легитимно не иметь BR/IC).
2. **`CONTRACT_SCHEMA_VERSION` не бампается.** Форма `cc_sdd_input` не изменилась — добавлена лишь запись в `contract_validation.checks[]`. Версия схемы governs output shape, а он идентичен.
3. **Defense-in-depth:** monotonic-guard (root-cause) + C-07 (семантический детектор) независимы — даже если кто-то откатит guard, C-07 поймает клоббер (доказано негативным тестом).

### Verify

- `node --check` PASS; `npm run test:adapters` → 4/4 PASS (clean v1.2; §10-clobber v1.4 не затёрт; monotonic-unit; негативный C-07 fail→passed:false).
- Обе фикстуры через CLI `--verify-only`: `passed: true`, C-07 pass, маппинг корректный (`scenarios`=SC-, `business_rules`=BR-).

### Lessons

- **Presence ≠ correctness.** Гейт, проверяющий «структура на месте», систематически пропускает «структура на месте, но содержимое подменено». Для любого адаптера/трансформа добавлять content-level oracle на каноническую сигнатуру выхода.
- **Фикс в installed-инстансе пилота ≠ фикс в эталоне.** Tri-location pattern требует явной upstream-пропагации; иначе следующая переустановка вернёт баг (ровно класс DEC-DEV-0065).

### Follow-ups

- Остаются follow-up'ы DEC-DEV-0073: P0-2 `gate-risk-classifier` (#2), scope-решение OD10 (#3), нативный P5 (#4), прогон №2 на D3 (#5).

---

## DEC-DEV-0075 — OD10 решён: первый инкремент Оркестратора = E2+E4 (P3 + нативный P5), override harvest-рекомендации

**Date:** 2026-06-14
**Trigger:** DEC-DEV-0073 follow-up #3 (S4). Требовалось зафиксировать scope первого build-инкремента модуля перед прототипированием — он определяет, что строить (P3 vs P3+P5).
**Tag:** #scope-change #architecture #orchestrator

### Context

RUN 01 (DEC-DEV-0073) раскрыл цепочку из 7 процессов (P1–P7). Concept §8 знал только `route-handoff-to-cc-sdd` (= P3, зона E2/D2-T). Прогон ушёл до E4 (P5 TDD-impl) — D3-кода. Вопрос: первый инкремент = только E2 (минимум, не нагружает непроверяемый §6) или расширить до E4 (полный pipeline до кода)?

### Options considered

1. **E2-only — build P3** (рекомендация harvest'а / synth §5 п.1). За: P3 самодостаточен; **не нагружает §6** (capability-канал нельзя провалидировать на P3 — он требует только cc-sdd skill + чтение `.product/`); низкий risk, чистая граница. Против: не строит то, что прогон реально доказал (E4 impl-loop); медленнее до «кода под ключ».
2. **E2+E4 — build P3 + P5** (выбрано человеком). За: прогон эмпирически доказал, что E4 работает (26 задач auth до GO); полный pipeline до кода ценнее; gate-risk-classifier (P0-2) уже спроектирован и ждёт носителя (P5). Против: §6/capability-канал остаётся непровалидированным; больше surface; требует немедленно снять `disable-model-invocation` (нативный P5) и поставить вопрос durable-слоя.
3. **Design-only — не строить.** За: максимум защиты от self-referential collapse (CLAUDE.md §3). Против: дольше до рабочего модуля; дизайн уже грунтован реальным прогоном, не «из головы».

### Decision

**Вариант 2 (E2+E4).** Решение человека, осознанный **override** рекомендации harvest'а. Первый инкремент = P3 `batch-features-to-cc-sdd` + P5 `feature-to-tdd-impl` (нативный).

### Outcome

SPEC §8 + OD10 → РЕШЕНО E2+E4. Reshape плана: S5 = build P3 + P5; S6 (прогон №2 для §6) повышается в важности (E4 в scope → §6-валидация обязательна позже). **Принятые риски зафиксированы:** (1) §6 непроверен → прогон №2 (S6); (2) `disable-model-invocation` → нативный P5 (OD9), не обёртка `/kiro-impl`; (3) durable-слой (n8n) под вопросом до cross-session-потребности.

### Lessons

- Рекомендация harvest'а (E2-only) опиралась на «не строй непроверяемое §6». Override валиден, потому что **§6 не на критическом пути P5**: P5 можно построить с pre-оснащённой инфрой (как в RUN 01) и провалидировать §6 отдельным прогоном — два независимых риска, не связанные блокировкой.
- Защита от self-referential collapse (CLAUDE.md §3) здесь обеспечена не отказом от build'а, а тем, что **дизайн P5 снят с реального прогона** (RUN 01), а не из головы — risk уже снижен на этапе harvest.

### Follow-ups

- S5: build P3 + P5 — пройти D7 phase-kickoff (новый implementation-инкремент модуля; CLAUDE.md §«Перед стартом следующей phase»).
- Снять `disable-model-invocation` нативной реализацией P5 (OD9) — обязательная часть S5.
- S6 (прогон №2, §6) остаётся; durable-слой (n8n) — отдельное решение при cross-session-потребности.

---

## DEC-DEV-0076 — S5a build: P3 `batch-features-to-cc-sdd` реализован ГИБРИДНО (оркеструем cc-sdd, не переписываем)

**Date:** 2026-06-14
**Trigger:** S5a build (kickoff §E) — первый implementation-инкремент Оркестратора; в процессе вопрос человека «а агенты kiro не использовались? давай брать best practices, не писать всё с нуля» вскрыл, что часть первого черновика дублировала готовую машинерию cc-sdd.
**Tag:** #orchestrator #build #cc-sdd #hybrid #cost-discipline #DEC-DEV-0073-followup

### Context

Kickoff (DEC-DEV-0075) зафиксировал scope E2+E4. S5a = build P3 `batch-features-to-cc-sdd`. Первый черновик (роли `spec-author`/`cross-spec-reviewer`/`spec-fixer` инлайн в `.mjs` per D.1, собственная wave-логика, собственный `build-steering`) был написан **до** проверки того, что реально ставит cc-sdd. Read-only инспекция пилота (`my-first-test/.claude/skills/kiro-*`) показала: cc-sdd поставляет методологию как **17 kiro-skills** (агентов вообще не ставит — `.claude/agents/` содержит только наши `integrator`/`product`). Критично — `kiro-spec-batch` **уже** делает: dependency-wave grouping → параллельный per-feature dispatch (kiro-spec-init→requirements→design→tasks) → **10-точечный cross-spec consistency review (Step 4)** → **3-раундовый fix-loop** → finalize. Его входы: `.kiro/steering/roadmap.md ## Specs (dependency order)` + per-feature `brief.md`.

### Decision

**P3 реализован как тонкая оркестрация поверх cc-sdd, а не как переписывание его машинерии.** Оркестратор **вызывает** `kiro-spec-batch` и добавляет ровно то, чего у cc-sdd нет:

1. **Мост `handoff → brief.md + roadmap.md ## Specs`** (`skills/orchestrator/build-briefs-from-handoff.md`). Это **программная замена `kiro-discovery`** — тот `disable-model-invocation: true` **и** интерактивный (AskUserQuestion) → из Workflow недоступен в принципе. Product-модуль уже сделал discovery (владеет `.product/`, эмитит handoff'ы); мост кормит batch-движок из handoff'ов вместо kiro-discovery.
2. **Preflight C-07** — адаптерный content-fidelity гейт перед brief'ом (cc-sdd доверяет входу; мы проверяем, что §10 не затёр §5/§6).
3. **`coverage-oracle`** (новый детерминированный хелпер `orchestrator/lib/coverage-oracle.cjs`, P1-1) — независимый ID-coverage по ground-truth. **Дополнение** к LLM-ревью kiro Step 4, не дубль: отвечает на вопрос, который LLM-ревьюер может провалить, доверившись self-report.
4. **Durable Workflow-скелет** — границы фаз переживают /compact (P0-3).

**Дропнуто как дублирующее** (kiro делает лучше): `agents/orchestrator/{spec-author,cross-spec-reviewer,spec-fixer}.md` + `skills/orchestrator/arbitrate-cross-spec.md` (4 файла, написанные в том же заходе). `build-steering` переписан в делегирование `kiro-steering`. Wave-логика-реинвент убрана из `.mjs` (kiro-spec-batch грубит волны сам).

### Alternatives rejected

- **Self-contained роли (полностью свои spec-author/reviewer/fixer).** Отвергнуто: реинвентит ~половину `kiro-spec-batch` (включая его строгий 10-точечный cross-spec review), больше поддержки, и прямо против просьбы «брать best practices, не писать всё». Робастность к version-drift cc-sdd не перевешивает.
- **Wrap `kiro-spec-batch` целиком как одну skill-обёртку без Workflow.** Отвергнуто: `kiro-spec-batch` — in-context skill-контроллер, durability/resume-across-/compact теряется; P3 тогда почти не нуждается в Workflow, что ослабляет reason-to-exist модуля (хотя P5 его всё равно требует). Выбран гибрид: Workflow держит durable-границы + детерминированные гейты, per-feature генерацию отдаёт cc-sdd. (Решение человека из 3 вариантов.)

### Harness-находки

- **`node --check` неприменим к Workflow-`.mjs`.** Харнесс-диалект (`export const meta` = ESM-goal + top-level `await` **и** top-level `return`, который харнесс разрешает обёрткой) даёт `SyntaxError: Illegal return statement` в чистом ESM. Smoke переписан: `tests/orchestrator/workflow-syntax.smoke.cjs` стрипает `export ` и парсит тело как AsyncFunction (парс без исполнения — ловит синтаксис, игнорит инъецированные глобалы/отсутствие FS).
- **Инлайн ролей per D.1 НЕ понадобился** для P3: раз роли = kiro-skills (вызываются `agent`'ом через Skill-tool, не `disable-model-invocation`), инлайнить нечего. D.1-ограничение остаётся релевантным для P5 (если будем лифтить kiro-impl/kiro-review методологию) и для любых bespoke-ролей.

### Smoke (S5a, на fixtures — не live)

`npm run verify` exit 0: adapters 4/4, **coverage-oracle 6/6** (FIXTURE-001 ground-truth SC-001/002+BR-001+IC-001; FIXTURE-002 §10-clobber — нет утечки в SC/BR/IC; coverage-miss ловится; self-report omission+fabrication ловятся), **workflow-syntax smoke 2/2**. Детерминированные хелперы (адаптер C-07 + oracle) зелёные на обеих фикстурах.

### Lessons

1. **Проверяй, что реально ставит инструмент, ДО написания ролей.** Полчаса инспекции `.claude/skills/kiro-*` сэкономили бы первый черновик 4 файлов. «Оркестратор оркеструет, не переписывает» — теперь явный принцип в `orchestrator/README.md`.
2. **`disable-model-invocation` — это не только про `/kiro-impl`.** `kiro-discovery` тоже помечен → его нельзя звать из Workflow. Это и дало мосту чёткий reason-to-exist (а не «ещё один способ сделать то же»).
3. **Cost-минимизация ≠ меньше кода везде.** coverage-oracle мы написали с нуля (детерминированного аналога у cc-sdd нет) — там это и есть value-add; а cross-spec роли выкинули (там cc-sdd сильнее). Граница «писать/брать» проходит по «есть ли у инструмента детерминированный ground-truth гейт».

### Follow-ups

- **Live cc-sdd прогон (S6 / прогон №2):** проверить, вызывается ли `kiro-spec-batch` (он сам спавнит субагентов) из Workflow-`agent()` — nested-subagent caveat. У Author-фазы `.mjs` есть fallback (прогнать kiro-spec-* пофично самому). Пилот в S5a не трогали.
- **S5b — P5 `feature-to-tdd-impl` (нативный, OD9):** здесь `disable-model-invocation` на `/kiro-impl` реально кусает → Workflow читает tasks.md и диспатчит implementer'ов сам; методологию implementer/reviewer лифтить из `kiro-impl`/`kiro-review` (не писать с нуля — урок этого DEC). `gate-risk-classifier` (DEC-DEV-0073 P0-2 design) подключается тут.
- Точная схема `brief.md` (поля, что именно kiro-spec-batch читает) — уточнить на live-прогоне; в S5a мост документирует формат, детерминированные гейты smoke-зелёные.

---

## DEC-DEV-0077 — S5b build: P5 `feature-to-tdd-impl` — тонкий native-контроллер + лифт kiro-impl (OD9 решён лифтом)

**Date:** 2026-06-14
**Trigger:** S5b build (kickoff §E). Человек: «начни с тщательной read-first инспекции kiro-impl/review» — ровно дисциплина DEC-DEV-0076. Инспекция показала, что `kiro-impl` — почти весь P5, зрелый.
**Tag:** #orchestrator #build #cc-sdd #lift #gate-risk-classifier #OD9 #DEC-DEV-0076-followup

### Context

OD9 (DEC-DEV-0073/0070): `/kiro-impl` — `disable-model-invocation` → P5 «нативно» (Workflow читает tasks.md, диспатчит implementer'ов сам). Read-first инспекция пилотного cc-sdd (read-only, файлы не трогал) уточнила картину: `kiro-impl` — **зрелый автономный TDD-контроллер** (per-task fresh implementer → independent `kiro-review` → `kiro-debug` на провале → `kiro-verify-completion` → selective commit → `## Implementation Notes` ledger → финальный `kiro-validate-impl` GO-гейт; bounded rounds 2/2/3; strict structured-handoff parse `STATUS`/`VERDICT`; Feature-Flag RED→GREEN; upstream-ownership routing). Диспатчит субагентов через **самодостаточные шаблоны** `templates/{implementer,reviewer,debugger}-prompt.md`. Только сам `kiro-impl` — disable-model-invocation; все гейты (`kiro-review`/`kiro-verify-completion`/`kiro-validate-impl`/`kiro-debug`) — invocable.

### Decision

**P5 = тонкий native dispatch-FSM + ЛИФТ всей методологии kiro-impl.** Workflow владеет минимальным контроллером (читает план, per-task последовательно: implementer → tier-роутинг гейта → bounded remediation/debug → verify-completion → selective commit; финал GO-гейт). **Каждый промпт субагента лифтится**: агент в прогоне **читает** kiro-шаблон `.claude/skills/kiro-impl/templates/*` и применяет (шаблоны встраивают протокол как fallback). Гейты — **вызов** kiro-skills. kiro в наш репо **не копируем** (иначе tri-location sync-долг, DEC-DEV-0040).

**Net-new vs kiro-impl — ровно два:**
1. **`gate-risk-classifier`** (`orchestrator/lib/gate-risk-classifier.cjs`, P0-2) — детерминированный предикат тяжести гейта: HIGH (императивная несущая логика: M1 security / M2 concurrency-idem / M3 shared primitive / M4 cross-FM / M5 first-task) → independent reviewer; LOW (профиль: declarative-invariant / pure-module / test-only / UI / infra) → inline-verify. kiro-impl **всегда** гоняет полный reviewer; классификатор рационирует (экономия ×2 субагента на LOW-задачах). **Ключевой рефайнмент:** «трогает инвариант» ≠ HIGH; решает enforcement (declarative UNIQUE/CHECK → LOW+интроспекция; imperative transaction/timing/row-lock → HIGH). Регрессия против таблицы RUN 01 §6: **17/17 с M5** (16/17 без — расхождение 1.1 scaffold в безопасную сторону).
2. **Durable Workflow-скелет** (границы фаз переживают /compact; у kiro-impl resume-дисциплина уже хорошая — выигрыш инкрементальный).

### Alternatives rejected

- **Полный native контроллер (репликация FSM kiro-impl).** Отвергнут: дублирует ~250 строк зрелого, протестированного контроллера (риск повторить его баги/гапы + sync-бремя с cc-sdd) ради маржинального durability. Против урока DEC-DEV-0076.
- **Classifier-хелпер + hand-off человеку в `/kiro-impl` (без Workflow-контроллера).** Самый дешёвый; отвергнут человеком в пользу Workflow-автономии impl-лупа (хотя классификатор — главный value-add в обоих). Выбран тонкий-native (из 3 вариантов).

### Lift-механизм (как именно)

Workflow-`.mjs` не читает FS (D.1) → лифт исполняет агент: prompt = «Read `${KIRO_TPL}/implementer-prompt.md` and apply it to task X.Y with context …». Шаблоны kiro живут в пилотном cc-sdd-install и читаются в прогоне. Это снимает копирование kiro-IP в экосистему и его licensing/drift-долг. Подтверждено: только `kiro-impl` disable-model-invocation; читаемость шаблонов + invocability гейтов — есть.

### Smoke (S5b, на fixtures/таблице — не live)

`npm run verify` exit 0: adapters 4/4, coverage-oracle 6/6, **gate-risk-classifier 8/8** (включая §6-репродукцию 17/17 + declarative-vs-imperative + DEFAULT-HIGH + deriveRegistry + parseTasks DAG), workflow-syntax smoke **3/3** (оба `.mjs`).

### Lessons

1. **Read-first дисциплина окупилась снова.** Инспекция kiro-impl до билда показала: писать надо **только** классификатор; весь контроллер-luxury — лифт. Без неё повторился бы черновик «написал FSM с нуля».
2. **«Native» (OD9) ≠ «с нуля».** OD9 верно требовал, чтобы Workflow владел диспатчем (kiro-impl нельзя вызвать). Но «владеть диспатчем» и «переписать методологию» — разные вещи: первое неизбежно, второе — нет.
3. **Граница value-add сужается с каждым процессом.** P3: мост + 2 гейта. P5: 1 гейт (классификатор). Чем зрелее инструмент, тем тоньше слой Оркестратора — и это правильный признак (оркеструем, не дублируем).

### Follow-ups

- **Live прогон (S6 / прогон №2):** (а) вызываются ли kiro-гейты (`kiro-review`/`kiro-verify-completion`/`kiro-validate-impl`) из **вложенных** Workflow-субагентов (шаблоны имеют embedded-fallback, но nested-skill-invocation не проверена); (б) читается ли шаблон агентом в прогоне без проблем. Пилот в билд-сессии не трогали.
- **Per-project деривация load-bearing реестра** (design §5.1, скан requirements на M1/M2) — в v1 реестр опционален (предикат работает на маркерах+профилях); деривацию + override-ревью довести на live-фиче иного класса (FM-002 media / FM-005 billing — другие M1/M2, открытый вопрос §10 дизайна).
- **M5 вариант A vs B** (first-task→HIGH) принят как A (default-on); подтвердить на старте других фич, что foundational-review повторяется.
- **S6** (§6 capability-канал, неоснащённая инфра) остаётся — теперь важнее, т.к. P5 (D3-impl) — именно та зона, где §6 по-настоящему нагрузится.

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
