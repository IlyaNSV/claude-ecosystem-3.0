# Patch 1.3.3 Readiness — Integrator scope discipline + environment tiers + pending-actions журнал

> **Назначение:** D7 phase-kickoff ritual output (Sections 1-5) для patch 1.3.3. Patch следует за DEC-DEV-0045 (Phase 5.1 / 1.3.2) и DEC-DEV-0046 (Local docs polish). Fresh-session implementation prompt в конце документа.
>
> **Trigger:** Pilot session 2026-05-27 (`636f2cd3-80e7-4c3c-8626-8a2f1e02d11a` на `my-first-test/`) выявила 4 паттерна нарушений / gaps Integrator-модуля.
>
> **Convention:** patch-level readiness — не phase, поэтому именование `PATCH_1.3.3_READINESS.md` вместо `PHASE_N_READINESS.md`. После closure → archive в `dev/_archive/patch-1.3.3/`.

---

## Status banner

🟢 **Implementation closed** (2026-05-27, same-day execution).

- ✅ Gap-анализ выполнен (kickoff session)
- ✅ D7 Sections 1-5 выполнены
- ✅ Architectural decisions resolved (Section 1)
- ✅ Ambiguities resolved (Section 2)
- ✅ Spec drift candidates identified (Section 3)
- ✅ Scope discipline applied — hard block deferred к v1.4.0 (Section 4)
- ✅ Sub-phases A-I decomposed (Section 5)
- ✅ DEC-DEV-0047 stub в DEV_JOURNAL → uplifted to full Outcome+Lessons
- ✅ Fresh-session execute sub-phases A→I (commits 4d23dbc → see DEC-DEV-0047 Outcome for full list)
- ✅ Static smoke 13/13 PASS (`node dev/meta-improvement/scripts/smoke-hooks.js`)
- ✅ CHANGELOG `[1.3.3]` finalized; release tag candidate (sub-phase I)
- ⏳ **Runtime smoke deferred** — S1-S5 in `dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md`, execute at user's discretion next pilot session

---

## Trigger & evidence (gap-анализ)

Пилотная сессия Integrator показала 4 паттерна:

1. **PROD-only рекомендации.** Vercel Pro ($20/мес), Trigger.dev v3, Hetzner CX32 — без разбивки local-dev / staging / production. Research output даёт монолитный prod-пакет вместо tier-stratified рекомендаций. **SPEC и research-protocol environment tiers не упоминают** → этого нет в спецификации, gap.
2. **Самостоятельное scope-creep в архитектурные решения.** Integrator запустил 3-prior consilium-research (DIY/PaaS/RU-friendly) и автономно выбрал «Пакет 1 (DIY)» без approve gate. SPEC §1.3 требует «явный аппрув», но ad-hoc prompt (не `/integrator:research`/`/integrator:add`) обошёл approve gate. Implementation bug: формальные команды gate работают; ad-hoc flows — нет.
3. **Запись в `.product/`.** 9 правок `.product/.decisions/journal.md` + правки `mvp-scope.md`, `roadmap.md`, `releases/RL-001.md`. **Direct violation** SPEC §1.2 («Не управляет `.product/`»), §8.1 («Не трогает артефакты в `.product/`»), installation-protocol Anti-pattern #5 («`/integrator:add` must NOT touch `.product/`»). Нарушение существует только на prompt-уровне — нет runtime guard.
4. **«🚧 Требует USER» action items.** Hetzner signup, ЮKassa регистрация ИП/ООО, API keys — растворены в narrative research отчёте. Нет structured журнала pending user-actions → юзер пропускает обязательные внешние действия.

**Категоризация:** A (impl bugs / нарушения existing SPEC) + B (gaps в SPEC, нужны новые механизмы).
- Категория A: #2 (approve gate skip) + #3 (`.product/` write). Fixes — prompt дисциплина + runtime guard.
- Категория B: #1 (env tiers) + #4 (PA журнал). Fixes — новые механизмы.

**Не входит в патч (отложено, см. v1.1+ backlog):**
- Hard block hook вместо warn-only (потребовалось бы DEC-DEV-уровня архитектурное обоснование, нарушает ecosystem hook convention)
- VM-based DevOps Integrator (отдельная идея для post-pilot)

---

## Section 1 — Architectural readiness

### B-1 Environment tiers

**Decision 1.** Добавить multi-valued поле `environment_tiers` в tool profile YAML (SPEC §4.1). Schema:
```yaml
environment_tiers:
  local_dev:
    suitability: full | partial | none
    notes: "..."
  staging:
    suitability: full | partial | none
    notes: "..."
  production:
    suitability: full | partial | none
    notes: "..."
```

**Decision 2.** `/integrator:research` Phase 5 output **обязательно** содержит per-tier разбивку (или явный disclaimer «tool is environment-agnostic — не зависит от tier»). Скип = research output невалиден.

**Decision 3.** При `/integrator:add` если tool заявляет `local_dev.suitability: none` → Stage 2 propose обязан включить предупреждение «Этот tool не подходит для local dev — обсудить parallel/separate dev решение?».

**Alternatives rejected:**
- Single `tier_recommended` enum — теряет nuance multi-tier применимости (tool может подходить full для prod + partial для staging + none для local dev).
- Отложить до v1.4.0 — юзер уже видит проблему в pilot session; паттерн ad-hoc PROD-recommendations повторится.

**Cascading effects:**
- `~/.claude/integrator/tool-catalog/*.yaml` schema потенциально stale, но profiles lazy-regenerable при следующем профайлинге.
- Никакого migration script — при следующем профиле новые fields добавляются.

### B-2 Physical scope-boundary

**Decision 1.** Новый hook `hooks/integrator/scope-guard.js`, **PreToolUse**, matcher `Edit|Write|Bash`. **Warn-only**, не blocking (соответствует ecosystem-wide hook convention «warn don't block» per `hooks/product/product-handoff-gate.js:12`). При обнаружении: loud stderr + force-append PA entry (см. B-3) типа «⚠️ Integrator attempted modification of forbidden path; review».

**Decision 2.** Для Bash matcher — простой regex sniffer (не AST). Patterns:
```js
const BASH_MUTATING_PATTERNS = [
  /\b(rm|cp|mv|tee|truncate|touch)\b[^|;]*?(\.product\/|\.kiro\/|docs\/pmo\/)/,
  /\bsed\s+-i[^|;]*?(\.product\/|\.kiro\/|docs\/pmo\/)/,
  /\b(echo|printf|cat)\b.*?>>?\s*(\.product\/|\.kiro\/|docs\/pmo\/)/,
  /\b(python|node|ruby|perl)\s+-[ec][^|;]*?(\.product\/|\.kiro\/|docs\/pmo\/)/,
  />\s*(\.product\/|\.kiro\/|docs\/pmo\/)/,
];
```
Disclaimer в hook header: «Не AST-парсер; complex constructs (subshells, vars, here-docs) могут не отлавливаться. Полное покрытие — Edit/Write hooks (надёжны)».

**Decision 3.** Context detection — **session marker file** `.claude/integrator/.session-context.json`. Integrator slash-commands (`/integrator:research`, `:add`, `:remove`, `:update`, `:replace`, `:debug`, `:scan`, `:gaps`, `:journal`, `:status`, `:map`, `:docs`) запись на entry, удаление на exit. Hook reads marker; absent → no-op; present + write to forbidden path → warn.

Schema marker:
```json
{
  "command": "/integrator:research",
  "started_at": "2026-05-27T15:30:00Z",
  "session_id": "<uuid optional>"
}
```

**Decision 4.** Forbidden paths — централизованный regex array в hook file (single source of truth для патча; centralizing across hooks — задача v1.4.0 если потребуется):
- `.product/` — Product Module территория
- `.kiro/` — cc-sdd output (потребляется Integrator-ом, не редактируется)
- `docs/pmo/` — PMO map / processes / validation (мета-документация)

Whitelisted exceptions:
- `.product/.sessions/` (transient session state)
- `.product/.pending/` (transient pending state)

**Decision 5.** Stale marker handling — marker содержит `started_at` timestamp; если старше 1 часа → hook treat as stale, удаляет marker, no-op. `/ecosystem:verify` также проверяет stale marker и предлагает cleanup.

**Alternatives rejected:**
- Hard block (`{"continue": false}` JSON) — нарушает ecosystem hook principle «warn don't block», требует архитектурного DEC-DEV. Отложено к v1.4.0.
- Transcript scanning (read `transcript_path`, tail recent assistant messages) — brittle, slow, hard на Windows.
- Env var — slash commands это markdown, нельзя exportить env per command invocation в Claude Code.

**Cascading effects:**
- `skills/integrator/installation-protocol.md` Anti-pattern #5 — добавить ссылку «теперь backed by runtime hook scope-guard».
- `commands/integrator/*.md` (все 12) — добавить boilerplate про session-marker write на entry + cleanup на successful exit.

### B-3 Pending user-actions журнал

**Decision 1.** Файл `.claude/pending-actions.md` (ecosystem-wide, project-local, committed в git). Не Integrator-owned — любой модуль может писать.

**Decision 2.** Schema markdown:
```markdown
## PA-NNN — <short title>

**Status:** pending | done | dismissed
**Created:** YYYY-MM-DDTHH:MM:SSZ
**Source:** integrator | product | design | ecosystem
**Trigger:** /integrator:research "..." (или decision DEC-INT-NNNN, или session ID)
**Action required:** <one-line>
**Details:**

<free-form context — why action needed, what unblocks>

**Blocking:** <what's blocked until done; empty if non-blocking>
```

**Decision 3.** Новая команда `/ecosystem:pending-actions` (read-only list/filter, kebab matches existing `/ecosystem:bootstrap|verify|update` family). Опции: `--status <pending|all|done|dismissed>` (default pending), `--source <module>` (filter).

**Decision 4.** Новый skill `skills/ecosystem/user-action-tracker.md` (новая директория `skills/ecosystem/` — пока пустой, создаём с этим skill). Skill знает: как append PA-NNN записи (NNN counter — tail файла regex `## PA-(\d+)` + 1; atomic — solo dev контекст, race не возможен), как мутировать status, как format.

**Decision 5.** Integration — обновить:
- `skills/integrator/research-protocol.md` Phase 5 — любой «user must signup/install/get-API-key/register entity» в recommendation = MUST add PA entry с правильным `source: integrator`
- `skills/integrator/installation-protocol.md` Stage 2-3 — любая «🚧 Требует USER» = MUST add PA entry
- `hooks/integrator/scope-guard.js` — на каждое срабатывание добавлять PA entry «scope violation requires review» (dedup by `(action, path, minute)`)

**Alternatives rejected:**
- Inline в `.claude/integrator/project-journal.md` — mixed concerns (decisions vs pending actions).
- `.product/.pending/` — Product-owned namespace, нарушает boundary.
- JSON store — markdown human-readable выигрывает (юзер открывает и читает).

**Cascading effects:**
- `commands/ecosystem/bootstrap.md` Step 6 — добавить `.claude/pending-actions.md` init (header + первый «PA-000 sentinel» entry).
- `commands/ecosystem/update.md` — preserve `.claude/pending-actions.md` user entries (idempotent merge).
- `.gitignore` — НЕ exclude (commit это).

### B-4 Approve gate research → decision

**Decision 1.** Усилить `skills/integrator/research-protocol.md` Phase 5 — добавить **mandatory approve gate** перед Phase 7 caching:
> «STOP. После представления comparison table + recommendation — пользователь должен явно выбрать опцию [1..N] или явно сказать “не сейчас / отложить” перед записью в journal. Никакого automatic caching без user response.»

Текущий текст («Format per /integrator:research Step 5-6 output template») недостаточно жёсткий.

**Decision 2.** В `commands/integrator/research.md` Step 7 — переписать как **hard gate** (analog `commands/integrator/add.md` Stage 2):
```
Approve research outcome? [<number>/defer/details]
```

**Decision 3.** Consilium-pattern (3+ parallel research priors) — добавить **новую секцию** «§7.X Consilium research» в SPEC:
> Consilium-pattern (multiple parallel research priors с разными bias-anchors) разрешён только при scope, явно объявленном до start (предмет, priors, expected output structure). Без явного declared scope — use single research stream. Если subagent fan-out > 1 без declared scope → research-protocol Phase 5 должен возразить и спросить user о scope.

**Alternatives rejected:**
- Оставить prompt-soft (текущая ситуация) — не работает; pilot показал scope-creep.
- Запретить consilium вовсе — теряем value параллельной экспертизы для подходящих scope.

**Cascading effects:**
- `commands/integrator/research.md` Step 7 переписать.
- SPEC §3.1 («Read-only commands») — добавить note «outputs include explicit approve gates, не выполняют автоматически follow-up actions».

---

## Section 2 — Ambiguity sweep

| # | Ambiguity | Resolution |
|---|---|---|
| 1 | environment_tiers + tools, которые legitimately только-prod (e.g., Vercel Production Deploy) | Поле `suitability: none` валидно; присутствие самого поля — обязательно (per Section 1 B-1 Decision 1). Disclaimer optional в `notes`. |
| 2 | session marker — какие именно Integrator commands пишут его (только modifying? все?) | **Все** Integrator commands: read-only тоже (research может trigger writes если bug). На exit маркер удаляется. |
| 3 | PA-NNN counter — где счётчик? | Tail `.claude/pending-actions.md` для last `## PA-(\d+)` regex; increment. Atomic — solo-dev контекст, race не возможен. |
| 4 | `/ecosystem:pending-actions` без аргументов — что показывать? | Default: `--status pending`, отсортированные по `created` desc. |
| 5 | hook output — что в stderr пишет для loud warning? | Multi-line с emoji prefix `⚠️ INTEGRATOR SCOPE GUARD`, путь, рекомендация «If intentional — switch context to Product Module, или явно подтвердить override в session». |
| 6 | session marker stale cleanup — кто удаляет если 1ч+ протух? | Hook сам удаляет при detect (lazy). Plus: `/ecosystem:verify` проверяет + предлагает cleanup. |
| 7 | consilium scope declaration — где? | В первом message от user или в скоупе slash-command. Если subagent fan-out > 1 без declared scope — research-protocol Phase 5 должен возразить и спросить. |
| 8 | `commands/integrator/{add,remove,…}.md` boilerplate write/cleanup — каким примитивом? | Bash через `Bash` tool или Write через `Write` tool — оба работают; командные `.md` файлы prompt-инструкции, реальная команда — Bash в Stage 0 «pre-flight». Cleanup в final stage + try/catch fallback. |

---

## Section 3 — Spec drift sweep

Grep candidates: что меняется и где старые refs могут остаться?

**Added terms (scaffolding, not drift):**
- `environment_tiers` — грепнуть SPEC.md, research-protocol.md, tool-profiling.md, add.md, research.md для **отсутствия** (это новое поле). Добавить refs в нужные места.
- `pending-actions` — новый термин, grep после реализации чтобы убедиться: все 3 модуля знают про существование + `/ecosystem:pending-actions` зарегистрирована в `commands/ecosystem/` family.
- `scope-guard` — добавить в installation-protocol Anti-pattern #5 (теперь backed by hook).
- `.session-context.json` — новый файл, grep чтобы убедиться единый source-of-truth (только в hook + integrator commands).

**Audit (negative drift check — старое не должно ссылаться на новое):**
- `docs/pmo/pmo-map.md` НЕ должен ничего знать про новый hook (right layer — PMO-карта не знает про hooks).
- `docs/product-module/SPEC.md` НЕ должен ссылаться на scope-guard (Product Module — не subject hook'а).
- `docs/design-module/SPEC.md` тоже не должен (Design Module аналогично).

**Backlog candidate:**
- `dev/v1_1_backlog.md` — добавить entry «hard-block scope-guard» если warn-only оказывается недостаточным (bring-forward trigger: повторное violation в pilot session после 1.3.3).

**Prerequisite commit:** none. Это patch, не refactor с supersede.

---

## Section 4 — Scope discipline

**Cuttable scope (отрезано):**

- ❌ **Hard block (вариант B-2)** — отложен до 1.4.0 если warn-only недостаточно. Bring-forward trigger: повторное violation в pilot session после 1.3.3. Сохранить в `dev/v1_1_backlog.md`.
- ❌ **Cross-module pending-actions broker / async notifications** — out of scope, file-based достаточно (юзер сам читает / `/ecosystem:pending-actions`).
- ❌ **PA expiry / auto-archive** — out of scope, ручная пометка `dismissed` ОК.
- ❌ **Migration tool-catalog YAML retroactively (add `environment_tiers`)** — lazy regeneration при следующем профиле достаточно.
- ❌ **Centralized FORBIDDEN_PATHS config (across hooks)** — out of scope, single-hook local declaration ОК для patch.
- ❌ **VM-based Integrator DevOps** — отдельный v1.1+ backlog entry (см. ниже).

**На критическом пути (НЕ режем):**

- ✅ Документация в `docs/integrator-module/SPEC.md` §4.1 (профиль) + новая §7.X (consilium) + §3.1 amendment.
- ✅ Test fixture для scope-guard hook (`dev/meta-improvement/scripts/smoke-hooks.js` extension).
- ✅ Bootstrap/update integration для `.claude/pending-actions.md` (без этого новый файл не появится в pilot projects).
- ✅ Session marker boilerplate во всех 12 Integrator commands (без этого hook ничего не отлавливает).

---

## Section 5 — Plan refinement (sub-phase decomposition)

### Sub-phases

```
A: docs (SPEC §4.1 environment_tiers schema, §7.X consilium, §3.1 amendment) + DEV_JOURNAL DEC-DEV-0047 entry stub uplift
B: skills updates — research-protocol.md (Phase 5 hard gate + environment tier extraction + consilium constraint), installation-protocol.md (Anti-pattern #5 hook ref + scope marker boilerplate), tool-profiling.md (environment_tiers field requirement)
C: commands updates — integrator/research.md Step 7 hard gate; all 12 integrator commands — session-marker write/cleanup boilerplate
D: hooks — hooks/integrator/scope-guard.js implementation + manifest.yaml registration + smoke-hooks.js fixture
E: pending-actions infrastructure — .claude/pending-actions.md template, skills/ecosystem/user-action-tracker.md skill, commands/ecosystem/pending-actions.md command
F: bootstrap/update integration — bootstrap.md Step 6 PA file init, update.md preserve PA + sync new commands/skills/hooks
G: smoke test plan — dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md draft (5 сценариев: scope-guard fires; environment_tier per-tier output; PA append; approve gate refusal; idempotency)
H: ROADMAP + CHANGELOG + CLAUDE.md update + DEC-DEV-0047 entry final + readiness banner 🟢
I: commit per sub-phase merged; release tag v1.3.3
```

### Smoke test scenarios (sketch)

- **S1:** `/integrator:research "deploy tool"` → output contains per-tier (local/stage/prod) разбивку; approve gate срабатывает (тест: «не сейчас» → caching skipped, journal entry status=deferred).
- **S2:** От Integrator-context попытка Edit `.product/features/FM-TEST.md` → hook stderr warning + PA entry appended (`/ecosystem:pending-actions` shows it).
- **S3:** `/ecosystem:pending-actions` без аргументов → list pending only.
- **S4:** `/integrator:add cc-sdd@latest` → Stage 2 включает environment_tier preview; если tool заявляет prod-only — warning visible.
- **S5 (idempotency):** re-run S2 не дублирует PA entry в same minute (hook dedup by `(action, path, minute)` tuple).

### Phase N+1 readiness

Не создаём (это patch, не phase); после closure snapshot `dev/PATCH_1.3.3_READINESS.md` → archive в `dev/_archive/patch-1.3.3/`. Следующий artifact decision-уровня — DEC-DEV-0048 closure entry (или phase-closure ritual если решим формализовать).

---

## Files to modify / create

### New files
- `dev/PATCH_1.3.3_READINESS.md` ← этот файл
- `dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md` (sub-phase G)
- `hooks/integrator/scope-guard.js` (sub-phase D)
- `commands/ecosystem/pending-actions.md` (sub-phase E)
- `skills/ecosystem/user-action-tracker.md` (sub-phase E — новая директория `skills/ecosystem/`)
- `.claude/pending-actions.md` template stub (создаётся при bootstrap)

### Modified files
- `docs/integrator-module/SPEC.md` — §4.1 profile schema (add `environment_tiers`), новая §7.X consilium, §3.1 «Read-only» amendment
- `skills/integrator/research-protocol.md` — Phase 1 environment-tier identification, Phase 4 profile extraction, Phase 5 hard approve gate
- `skills/integrator/installation-protocol.md` — Anti-pattern #5 hook ref, новая секция scope marker boilerplate
- `skills/integrator/tool-profiling.md` — `environment_tiers` field в profiling output requirements
- `commands/integrator/research.md` Step 7 — hard gate
- `commands/integrator/{add,remove,update,scan,journal,gaps,status,map}.md` — boilerplate marker write/cleanup
- `hooks/integrator/manifest.yaml` — добавить scope-guard registration (PreToolUse Edit|Write|Bash)
- `commands/ecosystem/bootstrap.md` Step 6 — добавить `.claude/pending-actions.md` init
- `commands/ecosystem/update.md` — preserve PA + sync new artifacts (commands/ecosystem/pending-actions.md, skills/ecosystem/user-action-tracker.md, hooks/integrator/scope-guard.js)
- `dev/meta-improvement/scripts/smoke-hooks.js` — добавить scope-guard fixture
- `DEV_JOURNAL.md` — DEC-DEV-0047 entry (stub created в current session; fresh-session uplifts)
- `ROADMAP.md` — «Где мы сейчас» + история patch 1.3.3
- `CHANGELOG.md` — `[1.3.3]` секция
- `CLAUDE.md` snapshot date + Phase 5.2 entry

### Existing patterns to reuse
- Hook stdin JSON parsing — `hooks/integrator/journal-hook.js:34-50` (path patterns array)
- Hook output convention — `process.stderr.write(...)` + `process.exit(0)` (см. `hooks/product/product-handoff-gate.js:26,157`)
- Smoke harness pattern — `dev/meta-improvement/scripts/smoke-hooks.js:87-100` (setup callback)
- Approve gate UX template — `commands/integrator/add.md` Stage 2 («Approve installation? [y/n/details]»)
- Hook manifest schema — `hooks/integrator/manifest.yaml` + `hooks/product/manifest.yaml`
- DEC-DEV journal entry template — конец `DEV_JOURNAL.md`

---

## Verification (acceptance gate)

1. **D7 kickoff acceptance:** все Section 1-5 boxes ↑ checked, status banner 🟢. Метрика: 0 unresolved decision points.
2. **Static smoke:** `node dev/meta-improvement/scripts/smoke-hooks.js` — все hooks (включая новый scope-guard) exit 0; ReferenceError/TypeError absent.
3. **Manual smoke:** в `my-first-test/` (после rollback `a67a482` + `/ecosystem:update`) — 5 сценариев из `dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md` PASS.
4. **Acceptance gate:** `/integrator:research` возвращает per-tier matrix; attempted write to `.product/` от Integrator-сессии → warning visible; `/ecosystem:pending-actions` показывает >0 entries после S2; consilium-fan-out без declared scope → research-protocol объясняет «нужен scope declaration».
5. **DEC-DEV-0047** записан с rationale всех 4 deliverables + cascading effects.
6. **Release tag:** `git tag v1.3.3` после merge + CHANGELOG entry финализирован.

---

## Размер патча (estimate)

- Sub-phase A-I: ~3-5 часов фокус-времени (calibration per DEC-DEV-0041 lesson: code-light + methodology-heavy patch ≈ ×1.5-2 от raw write-time).
- Lines changed: ~400-600 (SPEC additions ~120, skills updates ~80, commands updates ~150, hook + manifest ~80 + Bash regex ~30, pending-actions infra ~120, journal/changelog ~40).
- Files touched: 6 new + ~14 modified.
- Risk: medium. Hook PreToolUse — первый в codebase; warn-only mitigates blast radius. Session marker convention новая — может потребовать iteration после первого pilot. Bash regex matcher — best-effort, не AST (acceptable per Decision 2 §B-2).

---

## Fresh-session implementation prompt

> **Use this verbatim** в новой Claude Code сессии в `cwd=C:\Users\pw201\WebstormProjects\claude-ecosystem-3.0`:

```
Я фрэш-сессия для Patch 1.3.3 implementation на Ecosystem 3.0. Не загружай context из prev work — нужна clean view of patch scope.

Substrate (минимум):
1. dev/PATCH_1.3.3_READINESS.md — readiness gate с 4 deliverables (B-1..B-4) + sub-phase decomposition A-I
2. DEV_JOURNAL.md — последние 3 entries (DEC-DEV-0044/0045/0046) + DEC-DEV-0047 stub (нужно заполнить outcome+lessons после implementation)
3. docs/integrator-module/SPEC.md §1, §3, §4.1, §7, §8.1 (где Integrator boundaries определены)
4. skills/integrator/{research-protocol,installation-protocol,tool-profiling}.md (что меняем)
5. commands/integrator/{research,add}.md (approve gate pattern для копирования)
6. hooks/integrator/journal-hook.js + manifest.yaml (path patterns + registration format для копирования)
7. hooks/product/product-handoff-gate.js (warn-only convention для копирования)
8. dev/meta-improvement/scripts/smoke-hooks.js (fixture pattern для нового scope-guard test)
9. CLAUDE.md + ROADMAP.md (current state)

Затем execute sub-phases A→I из PATCH_1.3.3_READINESS.md, commit per sub-phase. После sub-phase I — release tag v1.3.3 + DEV_JOURNAL DEC-DEV-0047 финализирован + CHANGELOG секция готова.

Anti-bias guard: я (фрэш AI) free to surface decisions, которые prev session миссed. Если sub-phase scope не реалистичен — surface честно вместо silent execution. Если encounter unexpected complexity (например, hook PreToolUse не работает на Windows) — STOP + ask user, не workaround silently.

После closure — отдельный fresh-session execute dev/meta-improvement/checklists/phase-closure.md.
```

---

## Refinement tracker

| Patch | Kickoff date | Decisions resolved | Ambiguities | Drifts found | Time | Refinements |
|---|---|---|---|---|---|---|
| 1.3.3 | 2026-05-27 (inline current session) | 4 deliverables × ~5 decisions = ~20 | 8 (table Section 2) | 0 active drift; 4 scaffolding refs to add | ~1.5h (analysis + plan + this doc) | Patch-level readiness pattern established (vs phase-level) |
