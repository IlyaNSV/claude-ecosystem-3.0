# Phase D — Implementation Plan (Wiki Initiative)

> ⏸ **STATUS: DEFERRED to v1.1+ (2026-05-27)**
>
> **Active alternative:** [`dev/LOCAL_DOCS_POLISH_PLAN.md`](LOCAL_DOCS_POLISH_PLAN.md) (Obsidian + README polish, 4-9ч).
>
> **Rationale:** phantom-audience guard fired. Pre-pilot Ecosystem 3.0 не имеет реальных end-user/stakeholder consumers; единственная audience сейчас — solo dev. Непропорционально инвестировать 32-50ч в 3-audience wiki когда 80% value достижимо через light-touch альтернативу.
>
> **Bring-forward triggers** (любого достаточно для возврата к этому плану):
> - First real end-user feedback / ask «where do I start»
> - Stakeholder asks for shareable URL
> - Solo dev обнаруживает Obsidian недостаточным (audience-tagging, cross-tool sharing)
> - Ecosystem 3.0 готовится к public release (>2 weeks horizon)
>
> **Decision record:** DEC-DEV-NNNN (записывается в Stage 1 of LOCAL_DOCS_POLISH_PLAN).
>
> **Preservation:** full content ниже сохранён без изменений; resumption по этому плану всё ещё возможна как описано (Stage 0 fresh-session kickoff). Связанные artifacts ([`wiki-design.md`](wiki-design.md), [`PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md)) тоже preserved.
>
> ---
>
> **Назначение:** последовательный план реализации Phase D для resumption в любой следующей сессии. Источники истины — [`dev/wiki-design.md`](wiki-design.md) §1-17 + [`dev/PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md) A-H. Этот файл — workflow guide.
>
> **Создан:** 2026-05-27 (planning session post Phase 5.1 closure).
>
> **Статус на момент создания (до deferral):** Stage 0 (Kickoff) ещё не запущен. Phase 5 closure + 5.1 patch done. Implementation UNBLOCKED.
>
> **Estimate:** 16-25ч optimistic / **32-50ч realistic** (×2-4 множитель per DEC-DEV-0032). Multi-session.

---

## Как пользоваться этим документом в будущей сессии

1. Начни с **fresh-session** per `dev/meta-improvement/checklists/phase-kickoff.md` (recommended для bias-resistance)
2. Substrate paste — список в Stage 0.1 ниже
3. Иди по Stage 0 → 10 sequentially; checkboxes — атомарные действия
4. После каждой Stage — commit per template в каждом stage блоке
5. **🛑 Пауза после Stage 4 (DW.D) — обязательно** перед переходом к auto-sync
6. Если revealed need pivot — fix Charter через `[charter-change]` commit + repeat от affected stage

---

## Стратегические принципы (применяемые во всех stage'ах)

1. **Incremental pilot (CLAUDE.md §2):** обязательная пауза после DW.D — manual review wiki output до перехода к auto-sync workflow (DW.H). НЕ waterfall.
2. **Cuttable scope (CLAUDE.md §4):** на kickoff пересматриваем `wiki-drift-detector`, `docs-verify`, nightly verify, audience admonitions, headless action — каждый имеет cut-альтернативу с bring-forward trigger.
3. **Per-sub-phase commits (DEC-DEV-0014):** один conventional commit per DW.X с mental smoke test в body. Никаких WIP.
4. **Meta-risk awareness (CLAUDE.md §3):** Phase D — самореферентная инфраструктура. После DW.D — manual spot-check narrative, audience-tags, cross-links перед DW.H.
5. **DEV_JOURNAL discipline:** 2 entries minimum — open DEC-DEV-NNNN (kickoff + OQ resolutions) и close DEC-DEV-NNNN (findings + lessons).

---

## Stage 0 — Kickoff (~60-90 min)

> **Режим:** **fresh-session recommended** per `phase-kickoff.md` (anti-bias guard). Substantive phase с архитектурными решениями (8 OQ ожидают резолюции) → fresh-session ROI 6-8x подтверждён в Phase 5.

### 0.1 — Fresh-session kickoff
- [ ] Открыть новый Claude Code session в `cwd=claude-ecosystem-3.0`
- [ ] Paste substrate:
  - `ROADMAP.md` § «Где мы сейчас» + Phase D section (строки 63-64 brief — расширяется в этом stage)
  - `CHANGELOG.md` latest entry
  - `DEV_JOURNAL.md` last 5 entries
  - `dev/PHASE_D_DOCS_WIKI_READINESS.md` (specific phase readiness gate)
  - `dev/wiki-design.md` (full design doc)
  - `dev/v1_1_backlog.md` (deferral context)
  - `dev/meta-improvement/CONVENTIONS.md` (D7 conventions)
  - `dev/meta-improvement/checklists/phase-kickoff.md` (executed checklist)
  - `dev/PHASE_D_IMPLEMENTATION_PLAN.md` (этот файл)
- [ ] Execute Sections 1-5 phase-kickoff.md

### 0.2 — Section 1: Architectural readiness (OQ-DW-01..08)
Резолюции к 8 открытым вопросам — каждая в DEC-DEV-NNNN open entry с rationale:
- **OQ-DW-01** concurrency lock (queue vs cancel-in-progress)
- **OQ-DW-02** headless auth + rate limits на large diff
- **OQ-DW-03** charter section markers syntax (design предлагает HTML-комментарии)
- **OQ-DW-04** wiki-author skill: один с разветвлениями vs 4 separate per page type
- **OQ-DW-05** reference auto-generation: inline (Claude reads sources каждый раз) vs precomputed manifest
- **OQ-DW-06** cross-links: `[[wiki-link]]` plugin vs relative paths (design B.2 guidance — склониться к `[[]]`)
- **OQ-DW-07** Charter §3 inline vs separate `dev/wiki-mappings.yaml`
- **OQ-DW-08** `/docs-update` autoapply vs prompt user confirmation

### 0.3 — Section 3: Spec drift sweep
- [ ] Grep устаревших терминов в `docs/`, `dev/`, commands/skills/agents/hooks
- [ ] Single prerequisite commit если drift найден: `refactor(<scope>): pre-Phase-D spec drift sweep (DEC-DEV-NNNN A.X)`

### 0.4 — Section 4: Scope discipline
Подтвердить cuttable candidates из readiness C.1 — что в default, что cut:
- `wiki-drift-detector` skill (DW.C) — ship или inline в `/docs-verify`?
- `/ecosystem:docs-verify` command (DW.F) — ship или manual grep+find?
- Nightly `docs-verify.yml` schedule — ship или manual weekly?
- GH Pages deploy (DW.G) — ship или local `mkdocs serve` only?
- Per-page audience admonitions — ship или single tone → v1.1?
- Headless Claude в Action (DW.H) — ship или Action только detect→issue?

### 0.5 — Section 5: Plan refinement
- [ ] **ROADMAP update** — расширить строки 63-64 до полного раздела с sub-phases A-J, deliverables, smoke plan placeholder
- [ ] **PHASE_E_READINESS.md skeleton** (или PHASE_6 refresh) — placeholder для следующей фазы
- [ ] **PHASE_D_DOCS_WIKI_READINESS.md Section H** — fill placeholders findings из Phase 5 closure (см. DEC-DEV-0043+0044+0045)
- [ ] **DEV_JOURNAL** — DEC-DEV-NNNN «Phase D open» entry с OQ резолюциями и cut decisions
- [ ] **Status banner update** в readiness → 🟢 READY for kick-off

### 0.6 — Exit criteria Stage 0
- ✅ DEC-DEV-NNNN entry committed с 8 OQ резолюциями
- ✅ ROADMAP Phase D раздел полный с sub-phases
- ✅ Если drift → prerequisite commit landed
- ✅ Sub-phase decomposition зафиксирован (мог быть уточнён на kickoff)
- ✅ User explicit «Стартуем DW.A»

---

## Stage 1 — DW.A: Charter draft (~2-3ч)

**Deliverable:** `dev/wiki-charter.md` — 8 секций с mutability-маркерами per wiki-design §2

- [ ] 1.1 Скелет файла с 8 секциями
- [ ] 1.2 Wrappers `<!-- charter-section: NAME, mutability: X -->...<!-- /charter-section -->` для каждой
- [ ] 1.3 Section 1 (Mission & audiences) — **immutable**; копия из wiki-design §1
- [ ] 1.4 Section 2 (Wiki taxonomy) — **append-only**; полная иерархия из design §3
- [ ] 1.5 Section 3 (Source-to-target map) — **append-only**; YAML mappings из design §4 (decision OQ-DW-07: inline vs separate)
- [ ] 1.6 Section 4 (Exclusion list) — **append-only**; design §5
- [ ] 1.7 Section 5 (Anti-patterns) — **immutable**; «no duplicate SPEC body, no WIP, no AI marketing speak, ...»
- [ ] 1.8 Section 6 (Page templates) — **immutable**; inline templates per page type (concept/reference/guide/decision-index)
- [ ] 1.9 Section 7 (Audience tagging conventions) — **immutable**; admonition usage
- [ ] 1.10 Section 8 (Versioning policy) — **immutable**; «current only, mike bring-forward criteria»
- [ ] 1.11 **Commit:** `feat(wiki): DW.A — charter draft with mutability markers`

**DoD:** Charter parsable hook'ом (Stage 2 test). Все 8 секций tagged. `dev/wiki-charter.md` существует.

---

## Stage 2 — DW.B: Charter protection hooks (~1-2ч)

**Deliverable:** PreToolUse hook + git pre-commit hook + manifest entry

- [ ] 2.1 `hooks/ecosystem/protect-wiki-charter.js` per design §6 (locateSection, isStrictAppend, immutable-block logic)
- [ ] 2.2 `hooks/ecosystem/manifest.yaml` entry (PreToolUse, Edit|Write|NotebookEdit matcher, scope=ecosystem)
- [ ] 2.3 `.githooks/pre-commit-charter.sh` — defence against Bash-bypass (`[charter-change]` tag check)
- [ ] 2.4 Установочные инструкции — `git config core.hooksPath .githooks/` (в CLAUDE.md или CONTRIBUTING)
- [ ] 2.5 **Test passes per readiness E.1:**
  - Попытка Edit immutable section → blocked
  - Edit append-only с modification existing → blocked
  - Edit append-only с pure addition (new entries at end) → allowed
  - Bash commit без `[charter-change]` tag → rejected
- [ ] 2.6 **Commit:** `feat(wiki): DW.B — charter protection (PreToolUse + git pre-commit)`

**DoD:** все 4 теста pass. Hook reloaded в session (или новая session) для активации.

---

## Stage 3 — DW.C: Skills (~2-3ч)

**Deliverable:** 3 skills в `skills/ecosystem/`

- [ ] 3.1 `wiki-author.md` — per OQ-DW-04 decision (один разветвляющийся skill vs 4 separate). Page templates per type (concept / reference / guide / decision-index). Frontmatter:
  ```yaml
  ---
  description: Draft wiki page following Charter §6 templates per page type
  ---
  ```
- [ ] 3.2 `wiki-source-mapper.md` — extracts target from source per Charter §3 mapping; handles all action types (regenerate-index/table/list/catalog, update-section, sync-section, cross-link-refresh, append-new-decisions, update-status-block)
- [ ] 3.3 `wiki-drift-detector.md` — *if Stage 0 не cut'нул* — drift report logic (orphan/missing/broken-link/status-drift)
- [ ] 3.4 Per DEC-DEV-0012: если skill создаёт артефакт типа из `docs/pmo/artifacts/` → explicit frontmatter template. Wiki pages не из catalog → templates per page type в Charter §6 (skill consumes Charter).
- [ ] 3.5 **Commit:** `feat(wiki): DW.C — 3 skills for wiki authoring/mapping/drift`

**DoD:** Each skill loadable (proper frontmatter); references Charter §6 templates по convention.

---

## Stage 4 — DW.D: `/docs-init` + initial wiki bootstrap (~3-4ч)

**Deliverable:** Command + initial `docs/wiki/**` tree + `mkdocs.yml` + `.last-sync`

- [ ] 4.1 `commands/ecosystem/docs-init.md` per design §7.1 (workflow steps 1-9)
- [ ] 4.2 Команда читает Charter, generates directory tree per taxonomy §3
- [ ] 4.3 Создание `mkdocs.yml`:
  - theme=material
  - plugins=[search, mermaid2, *plus wiki-link plugin per OQ-DW-06*]
  - nav structure from taxonomy
  - edit_uri pointing GitHub
  - **strict mode** (`mkdocs build --strict`)
- [ ] 4.4 Для каждого mapping в Charter §3:
  - Read source(s)
  - Invoke `wiki-author` skill (или `wiki-source-mapper` для regenerate-*)
  - Write target page
- [ ] 4.5 Generate per-section `index.md` с cross-links
- [ ] 4.6 Write `docs/wiki/.last-sync` JSON v1:
  ```json
  {"sha": "<HEAD>", "timestamp": "<now>", "action_run_id": null, "synced_by": "manual", "version": 1}
  ```
- [ ] 4.7 `/ecosystem:docs-verify` invoke (placeholder — Stage 6 ещё не deployed; пока manual)
- [ ] 4.8 **Idempotency check:** второй вызов на существующем `docs/wiki/` → refuse, suggest `/docs-update`
- [ ] 4.9 **Commit:** `feat(wiki): DW.D — /docs-init + bootstrap initial wiki tree (~25 pages)`

**DoD:** `mkdocs build --strict` без errors. ~25 страниц в `docs/wiki/`. Static smoke per readiness E.1.

### 🛑 PAUSE POINT — Manual review per design §14

**Mandatory pause перед Stage 5+.** Цели:
- Spot-check каждой section (overview / concept / reference / guide / decisions / roadmap) — narrative корректный, audience-tags осмысленные
- Verify cross-links resolve (внутри wiki через `[[]]`; вне wiki через relative paths)
- Charter refinement: если bootstrap revealed что mappings неполные / неверные → fix Charter через `[charter-change]` commit
- Решение: продолжить (Stage 5) или итерировать DW.A-DW.D

**Possible cycle:** `/docs-init` rerun не permitted (idempotency). Если respect — delete `docs/wiki/`, re-run.

---

## Stage 5 — DW.E: `/docs-update` incremental sync (~2-3ч)

**Deliverable:** Command для diff-driven update

- [ ] 5.1 `commands/ecosystem/docs-update.md` per design §7.2
- [ ] 5.2 Args: `--since=<sha>`, `--dry-run`, `--force`
- [ ] 5.3 Workflow:
  - Read `.last-sync` → `last_sha`
  - `git diff <last_sha>..HEAD --name-status`
  - Read commit messages, apply exclusion filter (paths + msg patterns + heuristics per Charter §4)
  - Per unfiltered path: lookup mapping, apply action
  - `--dry-run` → print diff, exit
  - Else → write changes, update `.last-sync`
  - Suggest commit `docs(wiki): auto-sync against <new_sha>` (anti-cycle prefix)
- [ ] 5.4 **Test per readiness E.2:**
  - Dry-run --since=<sha 5 commits назад> → proposes changes
  - Commit только в `dev/**` → 0 proposed (exclusion works)
  - Typo-only commit (<10 lines) → 0 proposed (heuristic works)
- [ ] 5.5 **Commit:** `feat(wiki): DW.E — /docs-update incremental sync with exclusion filter`

**DoD:** Dry-run output корректен на real diff history. Exclusion + heuristic catch обычные skip cases.

---

## Stage 6 — DW.F: `/docs-verify` drift detector (~1-2ч)

> **Conditional на Stage 0 decision** — если cut'нули, skip stage и replace на `grep`-инструкции в Charter.

**Deliverable:** Non-mutating drift report command

- [ ] 6.1 `commands/ecosystem/docs-verify.md` per design §7.3
- [ ] 6.2 Workflow:
  - Read Charter source-to-target map
  - Per mapping: check source/target exists, cross-links resolve
  - Orphan pages, missing pages, status drift, roadmap drift
  - Output structured report с exit code (0 warnings / 1 critical / 2 errors)
- [ ] 6.3 **Commit:** `feat(wiki): DW.F — /docs-verify drift detection (non-mutating)`

**DoD:** Report корректен на текущем (post-Stage 4) wiki state.

---

## Stage 7 — DW.G: MkDocs config refinement + deploy workflow (~1-2ч)

> Может выполняться **параллельно** со Stage 5/6 (no dependency).

**Deliverable:** `mkdocs.yml` + GH Pages deploy workflow

- [ ] 7.1 `mkdocs.yml` finalize:
  - Plugins per OQ-DW-06 (wiki-link plugin)
  - Strict mode confirmed
  - Theme customizations minimal
- [ ] 7.2 `.github/workflows/docs-deploy.yml` per design §9
  - Triggers: push main с `docs/wiki/**` или `mkdocs.yml`
  - Build → upload-pages-artifact → deploy-pages
  - Concurrency `pages` (cancel-in-progress: true)
- [ ] 7.3 GH Pages settings docs — enable Pages в repo settings (manual step, document это)
- [ ] 7.4 **Commit:** `feat(wiki): DW.G — mkdocs deploy workflow + GH Pages config`

**DoD:** Local `mkdocs serve` рендерит wiki. После push на main → deploy workflow триггерится → URL открывается.

---

## Stage 8 — DW.H: Auto-sync workflow (~2-3ч)

**Deliverable:** `.github/workflows/docs-sync.yml` + test verification

> **🔴 Высокий risk** (R1 design §12). Перед Stage 8 — обязательная пауза для confidence check после DW.D-G.

- [ ] 8.1 `.github/workflows/docs-sync.yml` per design §8:
  - Triggers с paths-ignore (anti-cycle gate 1)
  - Commit message filter (anti-cycle gate 2)
  - `concurrency: docs-sync` per OQ-DW-01 decision
  - Headless `claude --print "/ecosystem:docs-update"` per OQ-DW-02 decision
  - `peter-evans/create-pull-request@v6` draft PR (anti-cycle gate 3)
  - Timeout 20 min
- [ ] 8.2 ANTHROPIC_API_KEY в GitHub Secrets (manual setup) — document это в Phase D closure
- [ ] 8.3 Optional: `.github/workflows/docs-verify.yml` nightly (per readiness C.1 — cuttable, decision на Stage 0)
- [ ] 8.4 **Commit:** `feat(wiki): DW.H — auto-sync workflow with headless Claude (DW.I pending)`

**DoD:** Workflow valid YAML, references consistent. Real verification — Stage 9.

---

## Stage 9 — DW.I: E2E pilot (~1-2ч)

> **Не commitable** — findings doc, no code artifacts.

Per readiness E.3:
- [ ] 9.1 Dummy non-trivial commit (например, в `commands/ecosystem/verify.md`)
- [ ] 9.2 Action триггерится <5 min
- [ ] 9.3 Headless `/docs-update` completes без error
- [ ] 9.4 Draft PR создан, label `docs-auto-sync`
- [ ] 9.5 Human review: wiki diff осмысленный (не мусор)
- [ ] 9.6 Merge PR → deploy workflow триггерится
- [ ] 9.7 Deployed URL open, изменённая страница reflects update
- [ ] 9.8 Findings doc → `dev/_archive/phase-D-pilot.md` (или inline в DEV_JOURNAL closure)

**Decision tree per readiness E.4:**
- ✅ Pilot pass → Stage 10 closure
- ⚠️ Action создаёт мусор системно → cut DW.H, оставить manual `/docs-update`, re-evaluate
- ⚠️ Charter spec drift revealed → fix Charter (`[charter-change]` commit), repeat Stage 9

---

## Stage 10 — DW.J: Closure (~1ч)

**Deliverable:** Phase D officially closed

- [ ] 10.1 DEV_JOURNAL DEC-DEV-NNNN **closure entry** с findings + lessons
- [ ] 10.2 CHANGELOG `[1.4.0]` — Added: wiki + 3 commands + 3 skills + 1 hook + 2 actions; Modified: ROADMAP
- [ ] 10.3 ROADMAP «Где мы сейчас» refresh
- [ ] 10.4 `dev/PHASE_6_READINESS.md` Section A — Phase D в prerequisites done
- [ ] 10.5 Phase 5 smoke plan archive → `dev/_archive/phase-D-smoke.md` (если применимо)
- [ ] 10.6 D7 phase-closure.md 6 steps ritual (fresh-session recommended)
- [ ] 10.7 Memory MCP sync per readiness F.1:
  - `project_ecosystem_status.md` — Phase D shipped (1.4.0)
  - `project_ecosystem_architecture.md` — wiki layer (Charter + commands + hook + 2 actions)
  - `MEMORY.md` index — Phase D entry
- [ ] 10.8 Update CLAUDE.md «Где мы сейчас» snapshot
- [ ] 10.9 **Commit:** `docs: Phase D closure — wiki initiative shipped (1.4.0)`

**DoD:** Per readiness G — все 14 пунктов done.

---

## Decision points & guardrails

| Точка | Решение | Default | Trigger to revisit |
|---|---|---|---|
| Stage 0 OQ-DW-04 | Skill design | 1 разветвляющийся `wiki-author` | Complexity blow-up |
| Stage 0 OQ-DW-06 | Cross-links | `[[wiki-link]]` plugin | `mkdocs build --strict` fails on plugin |
| Stage 0 cuttables | DW.F, DW.H nightly | Ship default | Time pressure → cut DW.F first |
| После DW.D | Continue к DW.E? | Yes (если spot-check pass) | Narrative bad / cross-links broken → iterate Charter |
| После DW.H | Continue к pilot? | Yes | Workflow YAML smells → fix Charter §4 exclusions |
| DW.I findings | Phase closure? | Yes (если pilot pass) | Action создаёт мусор → re-design DW.H |

---

## Risks (top 3 per design §12)

1. **R6 — Spec wiki без validation pilot** (high likelihood, meta-проект risk) — Mitigation: pause после DW.D, не пропускать manual review
2. **R1 — Action создаёт мусорные правки** (high initial) — Mitigation: draft PR (не auto-merge); review дисциплина
3. **R2 — Credit drain** (medium) — Mitigation: exclusion filters + heuristics + concurrency 1

См. полный risk register в `dev/wiki-design.md` §12 (10 risks с mitigations).

---

## Sequence summary (для быстрого вспоминания)

```
Stage 0 (Kickoff)  →  Stage 1 (DW.A Charter)  →  Stage 2 (DW.B Hooks)
        ↓
Stage 3 (DW.C Skills)  →  Stage 4 (DW.D /docs-init + wiki)
        ↓
    🛑 PAUSE — manual review
        ↓
Stage 5 (DW.E /docs-update)  →  Stage 6 (DW.F /docs-verify) ‖ Stage 7 (DW.G deploy)
        ↓
Stage 8 (DW.H auto-sync)  →  Stage 9 (DW.I pilot)  →  Stage 10 (DW.J closure)
```

---

## References

- [`dev/wiki-design.md`](wiki-design.md) — full design doc (§1-17)
- [`dev/PHASE_D_DOCS_WIKI_READINESS.md`](PHASE_D_DOCS_WIKI_READINESS.md) — readiness gate (A-H)
- [`dev/meta-improvement/checklists/phase-kickoff.md`](meta-improvement/checklists/phase-kickoff.md) — D7 kickoff procedure
- [`dev/meta-improvement/checklists/phase-closure.md`](meta-improvement/checklists/phase-closure.md) — D7 closure procedure
- [`CLAUDE.md`](../CLAUDE.md) — repo conventions
- [`DEV_JOURNAL.md`](../DEV_JOURNAL.md) — где DEC-DEV entries Phase D open/close будут
