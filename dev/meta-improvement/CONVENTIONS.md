# D7 Meta-Improvement Module — Conventions

> **Назначение:** правила (когда какие — for what reason) для D7 module mechanisms.
>
> **Status:** v1.0 final state (2026-04-28). Stages 1-6 shipped per DEC-DEV-0015..0021. SPEC §6 open questions resolved (8/10 settled v1.0; 2 open kept як ongoing refinement triggers).
>
> **Refinement:** triggers и updates documented per-convention. Update via `chore(meta-improvement): D7 refinement post-Phase-<N> closure` commit. ~~Structural growth complete; ongoing changes refine existing mechanisms rather than add new ones.~~ **Перекрыто DEC-DEV-0083:** структурный рост возобновлён осознанным решением — добавлены enforcement-механизмы (блокирующий `commit-msg` gate `process-gate.js` + детерминированный `check-counts.js`), что **перевешивает** дефолт §3 «tooling over discipline». Operational SSOT для harness = `CLAUDE.md` «Process triggers — harness contract».

---

## 1. Naming convention

### 1.1 DEV_JOURNAL entries для D7 decisions

**Convention:** continue `DEC-DEV-NNNN` sequence (нет separate `DEC-META-NNNN` или `DEC-D7-NNNN`).

**Rationale:** D7 entries are dev decisions; solo dev with single sequence проще than dual-stack mental load. ~5 D7-specific entries/year expected — separate sequence overkill.

**Revisit trigger:** if D7-specific entries dominate volume (>50% of new entries) — consider split.

### 1.2 D7 file naming

**Convention:** no prefix в `dev/meta-improvement/`. Folder is namespace.

**Examples:**
- `dev/meta-improvement/SPEC.md` (existing, Stage 1)
- `dev/meta-improvement/CONVENTIONS.md` (this file)
- `dev/meta-improvement/checklists/phase-closure.md`
- NOT `D7_phase-closure.md` (prefix duplicates folder info)

### 1.3 D6 vs D7 disambiguation

> **CRITICAL** — terminological collision risk.

| Aspect | D6 | D7 |
|---|---|---|
| pmo-map.md row label | «Meta: Ecosystem Governance» / «Integrator Module + человек» | (NOT в pmo-map.md) |
| Concern | governance over **user's** PMO | governance over **Ecosystem 3.0 development** itself |
| Lives | user projects (deployed via bootstrap) | этот repo, `dev/` only (NOT deployed) |
| Owner | Integrator Module + user | ecosystem creator (developer side) |
| Layer | Level A (продуктовый) | Level B (мета) |

When writing/reading «meta» / «governance» — disambiguate target audience:
- «meta-improvement» / «meta-домен» / «D7» → Level B (this module)
- «integrator-module» / «D6» / «Meta: Ecosystem Governance» (pmo-map sense) → Level A

---

## 2. Mechanism location

**Convention:** ALL D7 artifacts live в `dev/meta-improvement/`. NEVER deployed to user projects via bootstrap. NEVER в `commands/`, `skills/`, `agents/`, `hooks/`.

**Rationale:** D7 governs ecosystem dev (Level B), не user projects (Level A). Strict separation per SPEC §4.3 keeps architectural cleanliness, avoids self-referential collapse risk (SPEC §5.1).

**Layout (updated DEC-DEV-0083 — reflects actual tree):**

```
dev/meta-improvement/
├── SPEC.md                      # v1.0 spec (FROZEN snapshot — см. header caveat)
├── CONVENTIONS.md               # this file
├── checklists/
│   ├── phase-kickoff.md
│   ├── phase-closure.md
│   ├── patch-cut.md             # version cut ritual (DEC-DEV-0079)
│   ├── audit-smoke-workflow.md  # phase smoke→audit ритуал (Phase 4.1)
│   ├── audit-watch.md           # semi-auto session-audit watcher (Audit v2 Incr.2)
│   └── live-run-validation.md   # live-прогон (dogfood) validation protocol (DEC-DEV-0086)
├── patterns/                    # 8 patterns + index
│   ├── README.md
│   ├── spec-drift-sweep.md
│   ├── readiness-gate.md
│   ├── b1-frontmatter-convention.md    (validated)
│   ├── cuttable-scope-discipline.md
│   ├── smoke-test-plan.md
│   ├── blind-comparison-protocol.md    # DEC-DEV-0132
│   ├── da-subagent-type-contract.md    # DEC-DEV-0064
│   └── config-failure-first-triage.md  # DEC-DEV-0144 / VC-096
├── skills/
│   └── memory-sync.md
├── scripts/
│   ├── verify-update.sh / .ps1         # post-/ecosystem:update verification
│   ├── verify-hooks.js / smoke-hooks.js   # hook syntax + runtime smoke
│   ├── pre-commit.sh / commit-msg.sh / install-pre-commit.sh   # git-hook gates
│   ├── check-counts.js                 # canonical-count reconciler (DEC-DEV-0083)
│   ├── process-gate.js                 # blocking commit-msg gate (DEC-DEV-0083)
│   └── audit-smoke.js · audit-watch.js · audit-index.js · audit-journal.js · classify.js · effect-probe.js · patch-synth.js   # Session Audit v2
├── hooks/                       # registered in .claude/settings.local.json
│   ├── phase-closure-reminder.js       # PostToolUse Bash — warn: phase-completion commit без closure
│   ├── dev-journal-reminder.js         # PostToolUse Bash — warn: feat/fix commit без DEV_JOURNAL
│   ├── memory-drift-reminder.js        # PostToolUse Bash — warn: status-file commit → memory-sync due
│   ├── rails-session-start.js          # SessionStart — inject work-rails digest (DEC-DEV-0110)
│   ├── context-map-session-start.js    # SessionStart — inject context-map digest: MAP.md + INFORMATION-MAP.yaml (DEC-DEV-0197/D1)
│   ├── d7-hygiene-reminder.js          # SessionStart — warn: stale G25/G26/G27 feedback-contour backlog (DEC-DEV-0181)
│   └── session-audit.js                # SessionEnd marker writer (для pilot projects)
├── prompts/                     # Session Audit v2 auditor prompts
├── rubrics/                     # per-zone audit rubrics
├── audit-reports/               # runtime: per-session audit outputs (data, не process-def)
└── patch-candidates/            # runtime: synthesizer output + [Y/N/E/D] disposition
```

---

## 3. Mechanism ratio (skill / command / hook / checklist)

**Convention:** start с simplest mechanism. Promote to higher only когда manual proves repeatable + heavy.

**Hierarchy (least → most ceremony):**

1. **Checklist (markdown)** — manual, developer runs, ≤60 min. **DEFAULT for Stage 2.**
2. **Skill** — AI-assisted execution, lazy-loaded. **Promote when:** checklist has 3+ instances + steps too rote to remember. *(Согласовано с «Promotion criteria» ниже — было «5+», DEC-DEV-0083 свёл к одному порогу «3+».)*
3. **Command** (`/<namespace>:<name>`) — explicit invocation. **Promote when:** skill has 10+ instances + needs argument support.
4. **Hook** — automatic on event. **Promote when:** command needs to fire on commit/file-change без developer action.

**v1.0 status (mechanism mix):**
- **Checklists** (default): phase-closure.md, phase-kickoff.md, audit-smoke-workflow.md (Phase 4.1), live-run-validation.md (dogfood live-run protocol, DEC-DEV-0086)
- **Patterns** (Stage 3, mostly provisional): 5 в `patterns/`
- **Skills** (Stage 4): memory-sync.md (formalizes phase-closure Step 5; manual run still default)
- **Scripts** (Stage 4 + Phase 4.1 + Audit v2): verify-update.sh / .ps1 (post-/ecosystem:update verification); audit-smoke.js + audit-index.js (Phase 4.1 D7 conformance auditor CLI); classify.js + effect-probe.js + audit-watch.js (Session Audit v2 Incr.1-2 — universal session auditor: deterministic classifier, effect-on-product probe, semi-auto watcher; DEC-DEV-0056/0057)
- **Hooks** (Stage 4 + Phase 4.1): phase-closure-reminder.js (PostToolUse on Bash; surfaces stderr reminder when phase-completion commit detected без closure entry); session-audit.js (SessionEnd marker writer for pilot projects, Phase 4.1)
- **Slash commands** (Phase 4.1): `/meta:audit-smoke` (.claude/commands/meta/, ecosystem-repo-local), `/ecosystem:enable-d7-audit` (deployable but D7-internal — opt-in setup для pilot)
- **Composite mechanism** (Phase 4.1): hook-collects-state + command-consumes-batch pattern — `session-audit.js` пишет markers в `audit-index.md`, `/meta:audit-smoke` обрабатывает batch'ем

**Rationale:** SPEC §5 anti-pattern #4 «Tooling over discipline» honored — checklist remained default; promotions made only когда manual proved insufficient (Memory sync skill formalizes ~10 min ritual; verify-update script enables external validation; hook addresses «forget to run closure» failure mode).

**Promotion criteria (validated through Stages 3-4):**
- Checklist → Skill: when 3+ instances + manual procedure stable enough к codify (memory-sync trigger)
- Skill → Command: when needs argument support (deferred — no current trigger)
- Command → Hook: когда auto-fire required (phase-closure-reminder trigger: «forget to invoke closure» class issue)

---

## 4. Activation triggers

**Convention:** manual at phase boundaries; auto-reminder hook добавлен Stage 4 для catching missed invocations.

| Mechanism | Trigger | Cadence | Activation type |
|---|---|---|---|
| `phase-kickoff.md` | Before Phase N implementation | Once per phase | Manual (user types invocation) |
| `phase-closure.md` | After Phase N implementation, before Phase N+1 readiness gate | Once per phase | Manual (user types invocation) |
| `patch-cut.md` | Before accumulated `[Unreleased]` must reach pilot (i.e. before `/ecosystem:update` in a product project / live run) | Per delivery event (NOT scheduled / not «N features») | Manual (developer runs) |
| `live-run-validation.md` | After a non-trivial change is built + static smoke green, before declaring it validated / dropping «pending runtime smoke» | Per non-trivial change (skip tiny edits) | Manual (operator runs; reviewer grades post-hoc — executor/reviewer separation) |
| `skills/memory-sync.md` | Phase closure Step 5 OR standalone (long break, AI cites stale) | Per phase + ad-hoc | Manual (user types invocation) |
| `scripts/verify-update.sh` | Post-/ecosystem:update | Per update | Manual (user runs externally) |
| `hooks/phase-closure-reminder.js` | PostToolUse on Bash matching `git commit` с phase-completion pattern | Auto on commit | **Auto** (registered в .claude/settings.local.json) |
| `hooks/d7-hygiene-reminder.js` | SessionStart — stale G25 audit-Pending (≥7d) / G26 open FB-ledger intake / G27 survived patch-candidate idle at `gate: pending` (≥14d) | Once per session (if any arm stale) | **Auto** (registered в .claude/settings.local.json; detect-only warn, toggle env `D7_HYGIENE_REMINDER=0`; DEC-DEV-0181) |
| `hooks/session-audit.js` | SessionEnd in pilot project | Per session | **Auto** (registered в pilot's `.claude/settings.local.json` via `/ecosystem:enable-d7-audit`) — writes marker only, no spawn |
| `/meta:audit-smoke` (+ `scripts/audit-smoke.js`) | Post-smoke, after N sessions in pilot accumulated markers | Once per phase smoke | Manual (developer types invocation from ecosystem repo cwd) |
| `checklists/audit-smoke-workflow.md` | Developer reference for the smoke-then-audit ritual | Per phase | Manual (developer reads) |
| `scripts/audit-watch.js` (+ `/loop`) | Pilot sessions accumulated, Claude session open | Per loop interval (~45m) | **Semi-auto** (`/loop`/`CronCreate` drives `audit-smoke.js --classify --since`; idempotent skip-Processed; routines/RemoteTrigger disqualified — cloud can't see local transcripts/git). Session Audit v2 Incr.2, DEC-DEV-0057 |
| `checklists/audit-watch.md` | Developer reference for the semi-auto watcher | Ad-hoc | Manual (developer reads) |

**Reminder integration:**
- D7 section в `CLAUDE.md` § «Что делать в этой сессии (Claude)» — ensures discovery (single block за all D7 mechanisms)
- DEV_JOURNAL closure entry should reference `phase-closure.md` execution status
- Hook auto-fires reminder если commit pattern matched но closure entry absent — catches «forgot to run closure» class issue
- Hook never blocks commits — reminder only (per CONVENTIONS §8 failure handling)

---

## 5. Cleanup criteria

**Convention:** active phase-gate docs live в `dev/gates/`; archive `dev/gates/PHASE_<N>_*` docs post-closure when criteria met. NEVER archive certain files.

> **Локация (reorg 2026-06-14):** активные `PHASE_<N>_READINESS.md` / `PHASE_<N>_SMOKE_TEST_PLAN.md` лежат в `dev/gates/` (не в корне `dev/`). Тулинг (`scripts/audit-smoke.js`) резолвит live-план из `dev/gates/`, archived — из `dev/_archive/phase-<N>/`.

### 5.1 Archive eligible

| File pattern | When archive | Where |
|---|---|---|
| `dev/gates/PHASE_<N>_READINESS.md` | Post-Phase-N closure | `dev/_archive/phase-<N>/` |
| `dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md` | After smoke run done | `dev/_archive/phase-<N>/` |
| Pre-Phase-N proposals (e.g., spec drafts если были) | Post-decision | `dev/_archive/phase-<N>/` |

**Ротация накопительных канонов** (введена 2026-07-11, DEC-DEV-0185; файл остаётся живым — уезжает только старое СОДЕРЖИМОЕ, дословно):

| Канон | Порог ротации | Что уезжает | Куда | Ритуал-носитель |
|---|---|---|---|---|
| `DEV_JOURNAL.md` | живой файл >~250 КБ или >~50 записей | самый старый полный месяц записей; текущий + предыдущий месяц всегда остаются | `dev/_archive/journal/DEV_JOURNAL_<период>.md` | этот § (проверять на patch-cut) |
| `CHANGELOG.md` | >~150 КБ на cut версии | релизы старше текущего квартала; `[Unreleased]` + текущие релизы + footer остаются | `dev/_archive/changelog/CHANGELOG_<диапазон>.md` | `checklists/patch-cut.md` |
| `ROADMAP.md` | closure фазы | развёрнутый блок закрытой фазы → строка pointer-таблицы; «Где мы сейчас» — НИКОГДА (SSOT + входящие якоря) | `dev/_archive/roadmap/` | `checklists/phase-closure.md` |
| `audit-index.md` | rows clean/dismissed или >1 мес | Processed-строки; sentinel-пары и Pending — НИКОГДА | `dev/_archive/audit-index-<YYYY>.md` | audit-index §Notes |
| `audit-journal.ndjson` | **DEFER** до >~500 findings / >~500 КБ | только findings с несуществующим artifact И status dismissed/patched (это dedup-память: удаление строки = потеря подавления, re-emergence осознанно принимается) | `dev/_archive/audit-journal-<YYYY>.ndjson` | этот § |

### 5.2 NEVER archive

- `DEV_JOURNAL.md` — cross-session memory (per SPEC §6.4)
- `CHANGELOG.md` — consumer-facing release notes
- `ROADMAP.md`, `README.md`, `CLAUDE.md` — live root docs
- `dev/v1_1_backlog.md` — living deferral context
- `dev/gates/PHASE_<N+1>_READINESS.md` — active for next phase
- `dev/meta-improvement/SPEC.md`, `CONVENTIONS.md`, `checklists/*` — D7 living docs

### 5.3 Mechanics

```bash
mkdir -p dev/_archive/phase-<N>/
git mv dev/gates/PHASE_<N>_READINESS.md dev/_archive/phase-<N>/
git commit -m "chore(meta-improvement): archive PHASE_<N>_READINESS post-closure"
```

### 5.4 Patch-candidate disposition (post-gate)

`patch-candidates/<zone>__<check>.md` — output синтезатора (Session Audit v2 §6.2). После human gate `[Y/N/E/D]` (см. [`patch-candidates/README.md`](patch-candidates/README.md)) судьба файла:

| `gate:` | Что значит | Где живёт |
|---|---|---|
| `accepted` (есть `dec_dev_ref`) | Решение принято + закодировано в DEC-DEV | **архив:** `git mv → dev/_archive/meta-improvement/patch-decisions/` |
| `refuted` / `rejected` | Проверено и отклонено | **остаётся** в `patch-candidates/` — анти-фантом-память (README §40) |
| `pending` / `deferred` | Ждёт решения / следующего прогона | **остаётся** в `patch-candidates/` |

Архивируются **только** разрешённые (`accepted`) кандидаты — как запись «что было принято и куда вошло». `audit-journal.ndjson` (источник кластеров) и `audit-index.md` (idempotency-контракт) НЕ архивируются.

---

## 6. Memory MCP sync

**Convention:** manual review at phase closure (Step 5 of `phase-closure.md`); skill formalization shipped Stage 4 (`skills/memory-sync.md`).

**Skill provides:** standalone procedure для phase-closure Step 5 OR ad-hoc invocation (long break return, AI cites stale data). ~10 min budget. Promotion к scheduled hook on DEV_JOURNAL.md write — deferred unless 3+ closures show «forgot to sync memory» pattern.

**Files in scope:**
- `~/.claude/projects/<project-slug>/memory/MEMORY.md` (index)
- `~/.claude/projects/<project-slug>/memory/<entry>.md` (each tracked memory)

**See also:** [`skills/memory-sync.md`](skills/memory-sync.md).

---

## 7. Pattern library

**Convention:** Stage 3 shipped (2026-04-28). 5 patterns в `patterns/` directory. Most marked **provisional** (early extraction per user request override of SPEC §4.2 «pattern emerge before formalize» 3-instance rule). Refinement к validated status when 3+ instances accumulate per pattern.

**Patterns shipped:**
- [Spec Drift Sweep](patterns/spec-drift-sweep.md) (provisional, 2 instances)
- [Readiness Gate](patterns/readiness-gate.md) (provisional, 2 instances)
- [B.1 Frontmatter Convention](patterns/b1-frontmatter-convention.md) (validated, codified в CLAUDE.md)
- [Cuttable Scope Discipline](patterns/cuttable-scope-discipline.md) (provisional, 3 instances)
- [Smoke Test Plan](patterns/smoke-test-plan.md) (provisional, 1 instance)

**Refinement triggers** (per pattern):
- 3rd+ instance accumulated → status moves «provisional» → «validated»
- Pattern fails validation (instances don't fit shape) → refine OR retire

**See also:** [`patterns/README.md`](patterns/README.md) — index с usage guidance.

---

## 8. Failure mode handling

**Convention:** все D7 mechanisms surface findings к developer (you). No auto-fix Stage 2.

**Per checklist step:** «what's pass / what's fail / what to do on failure» explicit. Failure → fix inline (≤10 min) или queue с DEC-DEV entry.

**Rationale:** auto-fix on hygiene mechanisms risks silent damage (e.g., aggressive archive eats live doc). Manual surface = developer judgment retained.

---

## 9. Self-application principle

**Convention:** D7 governs ecosystem dev practices. NOT Product Module recursively applied to Ecosystem.

**Per SPEC §4.6 + DEC-DEV-0015 user clarification #3:**
- D7 has own conventions (this file)
- D7 may borrow patterns (DEV_JOURNAL pattern, B.1 frontmatter discipline) but NOT reuse Product Module commands/skills/agents/hooks
- D7 не превращает Ecosystem 3.0 в собственного customer

**What this means concretely:**
- ✅ D7 entries live в `DEV_JOURNAL.md` (existing convention, borrowed)
- ✅ D7 checklists в `dev/` (existing convention, borrowed)
- ❌ NOT `.product/.decisions/journal.md` для D7 entries
- ❌ NOT `.product/` для Ecosystem 3.0 itself (DEC-DEV-0008 dogfooding stays deferred)
- ❌ NOT Product Module commands/skills для D7 mechanisms

---

## 10. Refinement protocol

**Convention:** after each phase closure run, update CONVENTIONS.md and checklists if pain points emerge.

**Per DEC-DEV-NNNN closure findings entry — possible updates:**
- Add step / refine step in checklist
- Promote mechanism (checklist → skill, etc.)
- Update activation trigger
- Add to «NEVER archive» / «archive eligible» lists
- Refine pattern emergence (Stage 3+ readiness)

Updates committed как `chore(meta-improvement): D7 refinement post-Phase-<N> closure`.

---

## 11. Patch accumulation & cut

> **Codified:** DEC-DEV-0079 follow-up. Тонкий ритуал поверх существующих блоков
> (CHANGELOG `[Unreleased]` + DEV_JOURNAL + `/ecosystem:update`), не новый тулинг —
> SPEC §5 anti-pattern #4 «tooling over discipline» honored.

### 11.1 Контракт накопления (per-change)

**Convention:** каждое смёрженное изменение несёт запись в `CHANGELOG.md [Unreleased]`
(consumer-facing, `### Added | Fixed | Modified`) + при наличии rationale — `DEC-DEV-NNNN`
в `DEV_JOURNAL.md`. Это per-change дисциплина, не только фазовая (`phase-closure.md`
Pre-flight/Step 4 — фазовый чекпоинт того же контракта; для ad-hoc работы вне фаз контракт
тот же).

**Rationale:** `[Unreleased]` — единственная «корзина», из которой режется патч. Пропущенная
запись = тихо потерянная из release-notes фича. Разделение CHANGELOG↔DEV_JOURNAL — по
таблице в `CLAUDE.md` (что/где).

### 11.2 Модель доставки (важно — снимает недопонимание)

`/ecosystem:update` синкает из **upstream HEAD `main`**, НЕ из тега. Следствие: всё
смёрженное в `main` доезжает в пилот при следующем `update`, нарезана версия или нет.
**Cut — это bundling + gates + ярлык, не gate доставки.** Порядок: cut смёржен в `main` →
затем `update` в пилоте.

### 11.3 Cut-ритуал

**Convention:** нарезка версии из `[Unreleased]` — по чеклисту
[`checklists/patch-cut.md`](checklists/patch-cut.md). Каденс **по событию** (перед
доставкой в пилот / live-прогоном), не по расписанию и не «N фич» — пустых cut'ов нет.
Bump patch vs minor — semver-ish (patch = багфиксы + аддитивные opt-in фичи; minor =
заметный модуль/связка). Cut коммитится как `chore(release): cut vX.Y.Z` + тег.

**Mechanism level (D7 §3):** checklist (default). Promotion к skill/script — отложено, пока
ручной ритуал не докажет «too rote» (порог: 3+ cut'а с одинаковой рутиной).

---

## Open questions — resolutions (Stage 3-6)

5 originally open questions resolved through Stage 3-6 work:

- ✅ **Memory sync automation timing** → Stage 4 (skill formalized; promotion к hook deferred unless 3+ closures show drift class)
- ✅ **Pattern library structure** → Stage 3 (`patterns/<name>.md` с consistent format: name/when applicable/steps/outputs/examples/anti-patterns/refinement triggers)
- ✅ **Bootstrap regression scripting** → Stage 4 (`scripts/verify-update.sh` + `.ps1` для post-/ecosystem:update validation; complements phase-closure Step 2)
- ✅ **Hook integration** → Stage 4 (`hooks/phase-closure-reminder.js` PostToolUse on Bash; registered в `.claude/settings.local.json`; tested manually с 4 simulated inputs)
- ✅ **CLAUDE.md update strategy** → Stage 5 (D7 ritual collapsed в single section с sub-bullets per mechanism; replaces 2-line item-by-item growth)

**Still open (refine through usage):**

- **Provisional → validated pattern promotion** — patterns extracted на early instance basis; validation requires 3+ instances per pattern. Refinement protocol (CONVENTIONS §10) handles за phase closures.
- **Stage 5+ promotions** — if memory-sync skill, verify-update script, or hook reveal друг pattern (e.g., bidirectional memory sync, automated rollback in verify-update, hook на DEV_JOURNAL.md edits) → DEC-DEV-NNNN entry with rationale.

**Continued evolution:** через CONVENTIONS §10 refinement protocol per phase closures. Structural growth complete v1.0; ongoing changes refine existing mechanisms.
