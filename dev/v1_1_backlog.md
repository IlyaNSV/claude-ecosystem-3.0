# v1.1+ Backlog — Deferred from initial Phase scope

> **Назначение:** preserved context для функциональности, отложенной из phases v1.0 в v1.1+. Фиксирует **полный architectural intent** — чтобы при возврате к реализации не пришлось reconstructing context из обрывков SPEC и git log.
>
> **Статус:** living document. При deferral новой функциональности — добавить entry с тем же шаблоном.
>
> **НЕ путать с:**
> - `ROADMAP.md` Post-MVP section — там high-level список с pointer'ом сюда
> - `DEV_JOURNAL.md` — там decision что отложить (с rationale); здесь — что именно реализовывать когда вернёмся

---

## Format per entry

```
## <Component name>

**Originally planned:** Phase N (per ROADMAP draft 2026-04-18)
**Deferred:** YYYY-MM-DD per DEC-DEV-NNNN
**Defer rationale:** <why deferred — обычно scope discipline / unproven need>
**Bring-forward trigger:** <signals что пора реализовать>

### Architectural intent
<полное описание что компонент должен делать, без сокращений>

### Implementation notes
<technical detail, dependencies, integration points>

### References to existing spec
<куда смотреть в существующих SPEC при возврате>

### Estimated effort при возврате
<часы>
```

---

## Deep mode subagents (D1.2 / D1.3 Discovery)

**Originally planned:** Phase 3 (per ROADMAP draft 2026-04-18)
**Deferred:** 2026-04-20 per DEC-DEV-0012 (D.1 decision)
**Defer rationale:** Phase 2 pilot Quick mode (DEC-DEV-0008) produced quality output exceeding expectations: MR 22 sources, CA 7 competitors, credibility-tagged. Нет evidence что Quick mode insufficient. Building Deep mode without validated need = textbook over-engineering.
**Bring-forward trigger:** 2-3 real Discoveries с Quick mode демонстрируют конкретные limits — недостаточная triangulation для regulated domains, missing competitor coverage, MR depth insufficient для investor pitch level.

### Architectural intent

Two subagents с **isolated context** (preserves main session, не загрязняет conversation):

**`market-researcher.md`** — D1.2 Deep mode (replaces `market-research-protocol-quick.md` workflow для thorough research):
- Spawn'ится из `discovery-session.md` skill при `/product:init --deep`
- Контекст: PS + отрасль + география (passed как brief)
- Tools: Firecrawl, Brave Search, Exa AI, Sequential Thinking
- **8-фазный pipeline** (адаптация 199-biotechnologies):
  1. **Scope** — clarify research questions из PS, identify TAM/SAM/SOM dimensions
  2. **Plan** — 15-30 search queries план, prioritization
  3. **Retrieve** — execute searches, scrape primary sources (Firecrawl)
  4. **Triangulate** — cross-reference 2+ sources per major claim, mark credibility
  5. **Synthesize** — структурировать findings в MR sections (TAM/SAM/SOM, trends, barriers, demographics, behavior)
  6. **Critique** — self-review для bias, gaps, weak evidence; tag `[оценочно]` где applicable
  7. **Refine** — fill gaps, повторить retrieve если нужно
  8. **Package** — output draft MR с credibility scores per major claim, source list с datestamps
- Output: structured MR draft + meta (sources_count, credibility_distribution, gaps_acknowledged)

**`competitor-analyst.md`** — D1.3 Deep mode (replaces `competitive-analysis-protocol-quick.md`):
- Spawn'ится при `/product:init --deep` после MR (или parallel)
- Контекст: PS + MR + список конкурентов (может extend сам через discovery)
- Tools: Exa AI (semantic «competitors of X»), Firecrawl (scraping competitor sites), GitHub MCP (для dev-focused tools), Brave Search
- **Pipeline:**
  1. **Discovery** — Exa semantic search + GitHub topics search (для dev tools); shortlist 8-15 candidates
  2. **Filtering** — relevance check vs PS scope; cut to 5-8 final candidates
  3. **Scraping** — full content per candidate site (pricing pages, feature pages, about); recent changelog
  4. **Structured extraction** — feature matrix (15-30 ключевых фич × competitors), pricing comparison, positioning attributes
  5. **Synthesis** — strengths/weaknesses per competitor; positioning map (2-axis); market gaps identification
  6. **Our positioning proposal** — где мы будем on positioning map, why
- Output: structured CA draft с feature matrix, positioning map (text-version diagram), strengths/weaknesses, market gaps

### Implementation notes

**MCP requirements:**
- **Firecrawl** — primary scraping engine. Free tier 500 pages/month; Deep mode ≈ 50-150 pages per Discovery (8-30 sources × 2-5 pages each). Pilot scope sustainable.
- **Exa AI** — semantic search. Free credits at signup; Deep mode ≈ 10-30 queries per Discovery. Sustainable.
- **GitHub MCP** — для dev-focused niches. Optional если non-tech project. Free.
- **Brave Search** — keyword fallback. Free 2k/month.
- **Sequential Thinking MCP** — critical для multi-step reasoning. Subagent uses этот для structured synthesis (Шаг 4-5 of MR pipeline).

**Subagent file structure** (per `.claude/agents/integrator/tool-researcher.md` template):
```yaml
---
name: market-researcher
description: Deep mode D1.2 Market Research subagent. 8-phase pipeline для credibility-scored MR draft. Isolated context.
tools: Firecrawl, BraveSearch, Exa, WebFetch, Sequential Thinking
model: claude-opus-4-7
---

# brief format expected, output format expected, time budget, anti-patterns
```

**Integration в `discovery-session.md` skill:**
- Mode selection step: «Quick (default) | Deep | Config?»
- Deep mode = spawn subagent в D1.2 / D1.3 instead of running protocol inline
- Subagent returns draft через standard subagent output channel
- Main skill processes draft через стандартный gate flow (G2 / G3 → DRC)

**Config:**
- `.claude/product.yaml.default_discovery_mode: quick | deep` — already spec'd
- Per-invocation override via `--deep` / `--quick` flag

### References to existing spec

- `docs/product-module/SPEC.md §5.1` (`market-researcher` subagent description)
- `docs/product-module/SPEC.md §5.2` (`competitor-analyst` subagent description)
- `docs/pmo/processes.md §3.1` (P1.A Discovery Session — Deep mode mention)
- `docs/pmo/processes.md §14.3` (Subagents list)
- `docs/product-module/SPEC.md §8.5` (MCP Matrix — Deep mode requires Firecrawl + Brave + Exa + Memory + Context7 + GitHub)
- `commands/product/init.md` step 2 (mode selection logic)
- `skills/product/market-research-protocol-quick.md` (Quick mode reference, contrast point)
- `skills/product/competitive-analysis-protocol-quick.md` (same)

### Estimated effort при возврате

- `market-researcher.md` subagent: 2-3 часа (prompt engineering + 8-phase template)
- `competitor-analyst.md` subagent: 1-2 часа (similar pattern, simpler pipeline)
- Integration в `discovery-session.md` (Deep branches): 30-60 мин
- Smoke test на real Discovery: 1-2 часа
- **Total: 4-7 часов focused work**

---

## Atomic mass-rename `/product:bg-rename`

**Originally planned:** Phase 3 (per ROADMAP draft)
**Deferred:** 2026-04-20 per DEC-DEV-0012 (D.2 decision)
**Defer rationale:** Pilot frequency = 0; predicted real frequency ≤раз в неделю. Atomic implementation requires git tooling, conflict handling, rollback path — significant code для unvalidated frequency. Manual workflow (preview + sed/IDE find-replace + cascade-check) sufficient для v1.
**Bring-forward trigger:** 5+ mass-renames в течение месяца на любом active project, с user feedback что manual workflow tedious / error-prone.

### Architectural intent

`/product:bg-rename <old> <new>`:
1. Validate `<old>` exists в BG, `<new>` doesn't conflict
2. Scan `.product/**/*.md` для bold occurrences `**old**` (+ frontmatter alt_terms etc.)
3. Show preview: per-file count, total changes, list affected artifacts
4. **Atomic apply:**
   - Update BG entry (rename primary, добавить old в alt_terms списке как ❌)
   - Apply find-replace в всех affected files
   - Run V-11 bi-dir consistency check
   - Run V-08 terminology consistency check
   - Run cascade-check для all touched artifacts
   - Single git commit (или staged changes + ask user to commit)
5. **Rollback** при failure: revert all changes, restore from snapshot
6. Decision journal entry с full diff summary

### Implementation notes

**Atomicity strategy:**
- **Option A:** in-memory diff построение, single sequential write. Fail при partial write — manual recovery hard.
- **Option B:** copy `.product/` to `.product/.tmp-rename-<timestamp>/`, apply changes there, validate, swap on success. Rollback = delete tmp.
- **Option C (preferred):** use git stash workflow — apply changes in working tree, run validations, если ok = stage + commit; если fail = `git checkout .` rollback.

Option C прост в implementation, leverages git natively. Single dependency: project must be git-initialised (V-prereq check).

**Conflict handling:**
- `<new>` уже term в BG → reject (suggest merge через separate command)
- Bold `**new**` occurrence existed pre-rename → may indicate already-mixed terminology, warn user
- Open uncommitted changes in `.product/` → warn, suggest commit/stash before rename

**Validation post-apply:**
- V-11 (bi-dir refs) — должен pass (rename не затрагивает refs)
- V-08 (terms in BG) — должен pass с new term
- Все `<old>` occurrences gone except в BG entry alt_terms history

### References to existing spec

- `docs/pmo/processes.md §5.3` (Mass-Rename Workflow)
- `docs/pmo/artifacts/BG.md` (BG entry structure, alt_terms field)
- `docs/pmo/validation.md` V-08, V-11
- `commands/product/bg-rename.md` (when created — placeholder в Phase 3 manual)

### Estimated effort

- Command + skill: 2-3 часа
- Atomicity + rollback: 1-2 часа
- Smoke test: 1 час
- **Total: 4-6 часов**

---

## Full BFS cascade auto-fix beyond V-11

**Originally planned:** Phase 3-4 (per ROADMAP draft)
**Deferred:** 2026-04-20 per DEC-DEV-0012 (C.4 decision)
**Defer rationale:** V-11 (bi-dir refs auto-fix) — high-value/low-risk; everything beyond требует semantic understanding которое automation gets wrong. Risk silent breakage > manual labor cost для v1.
**Bring-forward trigger:** Phase 3 cascade-check accumulates `.product/.pending/cascade-pending.yaml` entries которые user resolves predictably (one-pattern fixes). Если pattern emerges → automate.

### Architectural intent

Beyond V-11 auto-fix, full BFS:
1. Build dependency graph from bi-dir refs across all artifacts
2. BFS traversal с priority ordering (Critical 🔴 → Strategic 🟠 → Standard 🟡 → Confirmation 🟢)
3. Per-dependent re-validation (run V-* rules per artifact type per current tier)
4. Auto-fix where safe (V-11 done; expand к V-08 terminology, simple referential integrity)
5. Bundle approve UX — present consolidated changes, user approves all/per-item
6. Atomic rollback при conflict (все или ничего)

### Implementation notes

**Auto-fix candidates beyond V-11:**
- V-08 (terms in BG) — auto-add bold term as draft BG entry; user reviews batch (current Phase 3 manual через `/product:bg-review`)
- Dependency status updates (FM `requires_review` flag когда supporting BR changed)
- Stale draft cleanup (V-12) — if scheduled review enabled

**NOT auto-fix:**
- Semantic content (BR statements, IC formulations) — never auto-edit
- Cross-artifact validation conflicts — always require human judgment
- Mass renames (handled separately через bg-rename command)

**Bundle approve UX:**
- Single consolidated diff summary к user
- Options: `[approve all] [approve per-item] [reject + show what stays]`
- Decision journal entry с list applied + rejected

### References to existing spec

- `docs/pmo/processes.md §4` (Cascade Consistency)
- `docs/pmo/validation.md §6` (Cascade Protocol full algorithm)

### Estimated effort

- Graph builder + BFS: 2-3 часа
- V-08 auto-fix: 1 час
- Bundle UX: 1-2 часа
- Atomic rollback: 1-2 часа
- **Total: 5-8 часов**

---

## DA debt mechanism (DROPPED, not deferred)

**Originally planned:** Phase 3
**Status:** **Dropped permanently** 2026-04-20 per DEC-DEV-0012 (C.2 decision)
**Rationale:** Adaptive-depth DA (C.1) на каждое изменение removes need для skip+batch. Decisions принимаются в момент изменения, не пост-фактум. Архитектурно несовместимо с adaptive-depth — debt не накапливается.

**Историческая справка:** изначально A3 modification (magnitude-gated DA) полагался на skip cosmetic + DA debt batch для balance ergonomics vs rigor. Adaptive-depth solves ergonomics через depth adaptation в single subagent invocation, делая skip + debt unnecessary.

**Если кто-то предложит revival:** см. discussion C.1+C.2 в session log около 2026-04-20. Argument против revival: decisions пост-фактум — anti-pattern (catch уже сделанное вместо catch-перед-commit).

---

## BR.feature schema — single vs array vs global directory

**Originally planned:** Phase 3 (per DEC-DEV-0014; не считалось проблемой)
**Surfaced:** 2026-04-29 per DEC-DEV-0023 (my-first-test pilot — BR-001 email format universal across all FMs, но schema = `feature: FM-001` scalar)
**Defer rationale:** Phase 3 implementation shipped с scalar schema; pilot не блокировал но revealed ergonomic gap. Decision deferred к v1.1 чтобы не interrupt Phase 4 readiness; minor pilot workaround = duplicate BR per FM или manually edit schema.
**Bring-forward trigger:** второй FM enrichment (FM-002 или другой) который reveals shared rule reuse pain. До тех пор — current scalar schema pragmatic.

### Architectural intent

Текущая схема BR frontmatter:
```yaml
owner_feature: FM-001                # scalar — primary FM
scenarios: [SC-001, SC-002, ...]     # SCs где applied (всё равно multi)
```

Проблема: BR-001 (email format) логически универсально (RFC 5322 valid). При FM-002+ enrichment AI:
- Либо дублирует BR-001 → drift риск + V-11 cascade complexity
- Либо вручную меняет owner_feature на array (не supported by current cascade-check.js spec) → inconsistent

### Three options для v1.1 evaluation

**Option A — global rules dir (least invasive):**
- Введение `.product/business-rules/global/BR-XXX.md` для shared rules
- Scalar `owner_feature` остаётся; для global — `owner_feature: GLOBAL` или omit
- cascade-check.js spec обновляется: BR в `global/` doesn't trigger FM-specific cascade
- Pros: minimal schema change; clear separation
- Cons: requires manual classification per BR (global vs FM-specific); some rules borderline

**Option B — array schema (more flexibility):**
- `owner_features: [FM-001, FM-002]` — array, multi-FM ownership
- All BRs use this; rules used by 1 FM = single-element array
- cascade-check.js V-11 updated для multi-FM bidir
- Pros: uniform schema; flexible
- Cons: V-11 logic more complex; array operations on single-FM BR feels heavy

**Option C — separate rule reuse mechanism (most invasive):**
- Introduce `BR-EXTENDS: BR-001` field — BR can extend / refine another BR
- Each FM has own BR-NNN that extends shared base
- Pros: explicit refinement model
- Cons: graph complexity; over-engineering для current scope

### Implementation notes

When picking option (v1.1):
- Option A wins на pragmatism; Option B wins на uniformity. C unlikely правильный.
- Migration path: existing scalar BRs auto-classified — heuristic «BR используется в >1 FM after second FM enrichment → propose move к global/».
- Update `docs/pmo/artifacts/BR.md` schema doc + `cascade-check.js getForwardSpecs('business-rule')` spec accordingly.

### References to existing spec

- `docs/pmo/artifacts/BR.md` — current BR schema
- `hooks/product/cascade-check.js getForwardSpecs()` — current cascade map per type
- DEC-DEV-0023 my-first-test smoke test findings — pilot evidence

### Estimated effort при возврате

- Option A: 2-3 часа (mkdir, schema doc note, cascade-check minor branch)
- Option B: 4-6 часов (V-11 multi-FM bi-dir logic, migration script, doc updates)

---

## Bundle approve UX для cascade

**Originally planned:** Phase 3
**Deferred:** 2026-04-20 per DEC-DEV-0012 (C.4 decision)
**Defer rationale:** V1 cascade — detection-only + V-11 auto-fix; navigation manual через `/product:cascade`. Bundle UX makes sense только когда auto-fixes accumulate (full BFS scenario). Premature без full BFS.
**Bring-forward trigger:** одновременно с full BFS auto-fix expansion (см. выше).

### Architectural intent

См. `docs/pmo/processes.md §4.2` («Bundle approve UX»).

### Estimated effort

1-2 часа (часть full BFS expansion).

---

## D.7 Release-level DA aspirational layer

**Originally planned:** Phase 4 (per DEC-DEV-0026, D.7 decision 2026-05-10)
**Deferred (aspirational layer):** 2026-05-12 per DEC-DEV-0030 (D.7 core/aspirational split)
**Defer rationale:** Phase 4 ships D.7 core (`scope: release` schema field, `/product:da-review RL-NNN` routing, release sub-mode в `devils-advocate.md`, basic 6-lens brief через RL.features[] + FM frontmatter reads). Aspirational layer (recursive auto drill-down + cross-FM structural dependency graph) требует evidence что text-parsing FM bodies для cross-FM concerns insufficient. Premature без real pilot evidence.
**Bring-forward trigger:**
- First release-level DA flagged false positive/negative из-за text parsing inadequacy
- ИЛИ user request structural `FM.depends_on` (cross-feature workflow demonstrably blocked)
- ИЛИ 3+ FM bodies revealed inconsistent dependency representation patterns

### Architectural intent

**Aspirational features (deferred):**

1. **Recursive auto drill-down.**
   `suggested_drill_down: /product:da-review FM-001` field в release-level finding автоматически fires per-FM DA при user confirmation. Currently Phase 4: hint surfaced в frontmatter; user manually invokes если wants. v1.1: prompt `[Y/N/skip]` per hint, auto-spawn если [Y]. Single consolidated decision journal entry для cross-level findings chain (release → FM).

2. **Cross-FM structural dependency graph.**
   - FM frontmatter extension: `depends_on: [FM-NNN, ...]` (currently dependencies в FM body §12 free text)
   - V-11-DEP bi-dir rule: if FM-A.depends_on contains FM-B, то FM-B should имеет FM-A в `dependent_features[]` (или auto-derived view from inverse map)
   - `cascade-check.js` extension: dependency change → cascade re-validate dependents
   - Release-level brief composes dependency graph structurally (not text parsing)

### Implementation notes

**FM.depends_on migration:**
- Optional field, defaults to `[]`
- Existing FM bodies parsed at migration time для seed values (best-effort, low-confidence flag за каждое derived dependency)
- New FM creation flow (P1.B `release-planning.md` skeleton): explicit prompt про dependencies
- Validation V-11-DEP: bi-dir consistency между `depends_on` / `dependent_features` (или derived inverse map)

**Recursive drill-down UX:**
- При finding с `suggested_drill_down`: prompt user `[Y/N/skip]`
- Если [Y] — auto-spawn `/product:da-review FM-NNN` within same session
- Single consolidated decision journal entry для cross-level findings (release-level → FM-level chain)

### References to existing spec
- DEC-DEV-0026 (release-level DA core в Phase 4)
- DEC-DEV-0030 (core/aspirational split decision)
- `agents/product/devils-advocate.md` sub-mode `scope: release` (Phase 4 core)
- `docs/pmo/artifacts/FM.md` (`depends_on` field would extend schema)
- `hooks/product/cascade-check.js` (would extend для FM-level dependency cascades)

### Estimated effort при возврате
- `FM.depends_on` schema + migration: ~1 ч
- V-11-DEP rule + `cascade-check.js` update: ~1-2 ч
- Release-level brief refactor для structural graph: ~1 ч
- Recursive drill-down UX: ~1-2 ч
- Smoke test: ~1 ч
- **Total: ~5-7 ч focused work**

---

## Phase D — Wiki initiative (full implementation)

**Originally planned:** Phase D (design frozen 2026-05-26)
**Deferred:** 2026-05-27 per DEC-DEV-0046 (phantom-audience guard)
**Defer rationale:** Pre-pilot Ecosystem 3.0 не имеет real end-user/stakeholder consumers; единственная active audience — solo dev. Непропорционально инвестировать 32-50h в 3-audience wiki когда 80% value достижимо через 4-9h Obsidian + README polish (active alternative: `dev/LOCAL_DOCS_POLISH_PLAN.md`). Audience reality check should have happened before design freeze; done now via alternatives analysis pre-implementation.
**Bring-forward trigger:** any of:
- First real end-user feedback / ask «where do I start»
- Stakeholder asks for shareable URL
- Solo dev обнаруживает Obsidian недостаточным (audience-tagging, cross-tool sharing, narrative depth, etc.)
- Ecosystem 3.0 готовится к public release (>2 weeks horizon)

### Architectural intent

Full Phase D wiki implementation per design freeze 2026-05-26:
- **MkDocs Material SSG** — narrative wiki (~25 pages) под `docs/wiki/**`; theme=material; plugins=[search, mermaid2, wiki-link]; strict-mode build
- **Protected Charter** `dev/wiki-charter.md` — 8 sections с mutability markers (Mission/Anti-patterns/Templates/Audience-tags/Versioning **immutable**; Taxonomy/Source-map/Exclusions **append-only**)
- **PreToolUse hook** `protect-wiki-charter.js` — blocks AI Edit/Write of immutable/middle-edit append-only sections; allows pure-addition
- **Git pre-commit hook** `pre-commit-charter.sh` — defence against Bash-bypass; requires `[charter-change]` commit tag
- **3 commands:** `/ecosystem:docs-init` (one-shot bootstrap), `/ecosystem:docs-update` (incremental sync с --dry-run + exclusion filter), `/ecosystem:docs-verify` (non-mutating drift report)
- **3 skills:** `wiki-author` (page templates per type), `wiki-source-mapper` (source-to-target action executor), `wiki-drift-detector` (orphan/missing/broken-link/status-drift)
- **2 GH Actions:** `docs-sync.yml` (push → headless Claude → draft PR), `docs-deploy.yml` (push → GH Pages)
- **Optional:** `docs-verify.yml` nightly safety net (cron 0 6 * * *)
- **3 audiences served:** solo dev + end-users + stakeholders via MkDocs admonitions (`!!! note "for-stakeholders"`, `!!! tip "for-internal"`)
- **Anti-cycle triple gate:** paths-ignore + commit-msg-filter + draft-PR (не auto-merge)
- **Cost control:** exclusion list (Charter §4) + typo-only heuristic + concurrency 1
- **Last-sync state:** `docs/wiki/.last-sync` JSON v1

### Implementation notes

**Full implementation plan preserved at** `dev/PHASE_D_IMPLEMENTATION_PLAN.md` (DEFERRED banner): 10 stages DW.A-DW.J, resumption-ready в любой future session via fresh-session kickoff.

**Decision options + 8 OQ-DW resolutions** documented в plan Stage 0.2. Design rationale + alternatives — `dev/wiki-design.md` §1-17. Risk register — `dev/wiki-design.md` §12 (10 risks с mitigations).

**При resumption** — start от Stage 0 (kickoff), не от Stage 1; OQ resolutions могут drift'нуть с момента deferral. Особенно re-verify:
- OQ-DW-02 (headless Claude auth + rate limits) — может измениться pricing/limits API
- OQ-DW-05 (reference auto-gen approach — inline vs precomputed) — может появиться лучший pattern
- OQ-DW-06 (cross-links — `[[wiki-link]]` vs relative paths) — Obsidian polish track выявит, что работает в practice

**Mandatory pause** после DW.D (manual review wiki output перед auto-sync action DW.H) — не пропускать.

### References to existing spec

- `dev/wiki-design.md` — full design doc (§1-17)
- `dev/PHASE_D_DOCS_WIKI_READINESS.md` — readiness gate (Sections A-H, DEFERRED banner)
- `dev/PHASE_D_IMPLEMENTATION_PLAN.md` — implementation plan (DEFERRED banner)
- `dev/LOCAL_DOCS_POLISH_PLAN.md` — active alternative track
- DEC-DEV-0046 — defer decision (rationale + 5 options considered + lessons)

### Estimated effort при возврате

- Substrate paste + Stage 0.1 kickoff (fresh-session): 30-60 min
- Full implementation: 16-25h optimistic / 32-50h realistic (per ×2-4 multiplier)
- **Total: ~17-26h optimistic / 33-51h realistic**

Phase D estimate включает mandatory manual review pause после DW.D; не может быть дальше compressed без quality risk.

---

## /product:clarify — Receiver questions channel

**Originally planned:** Phase 4 (per ROADMAP draft 2026-04-18 → reaffirmed в Phase 4 deliverables list)
**Deferred:** 2026-05-12 per DEC-DEV-0030 (scope discipline cut)
**Defer rationale:** Receiver не существует до Phase 5 (cc-sdd adapter installation). До Phase 5 нет реального use case для clarify channel — внешний tool ещё не interacts с Product Module. Contract receiver↔Product Module (как receiver вызывает: через MCP? CLI? human-mediated?) также не определён.
**Bring-forward trigger:** First adapter (Phase 5) live + receiver demonstrably needs question channel (например, implementer не понимает SC step, handoff ambiguity).

### Architectural intent

`/product:clarify <FM-id>` — receiver-initiated question channel:

1. External tool / human implementer запускает команду с FM-id + question text
2. Product Module:
   - Logs question в `.product/.clarifications/FM-NNN-questions.yaml` с timestamp + question id
   - Surfaces к product owner (на следующей session или через async signal — TBD)
3. Product owner отвечает per question:
   - Update artifact (FM body, BR statement, etc.) — answer = behavior change
   - Add к Dependencies section — answer = scope clarification
   - Add к Out of Scope — answer = explicit exclusion
   - Approve override — temporary acceptance с rationale
4. Decision journal entry per resolved clarification

### Implementation notes

**Contract surface (определить в v1.1+ при возврате):**
- Synchronous CLI: `claude /product:clarify FM-001 "Question text"` — requires Claude Code running
- MCP server export для external tools — major architecture work, не для v1.1
- File-based async: external tool writes к shared location, Product Module polls при session start — simplest для PoC

**Recommendation для v1.1:** start с file-based async pattern + simple CLI wrapper. MCP integration — v2.

### References to existing spec
- `ROADMAP.md` Phase 4 deliverables list (originally included; ROADMAP update per Phase 4 closure отражает defer)
- DEC-DEV-0030 (defer decision)
- `docs/product-module/SPEC.md §3.2` (упоминает `/product:clarify <FM-id>` как future capability)
- `docs/pmo/processes.md` (нет formal process для clarifications)

### Estimated effort при возврате
- Command + skill: ~30-45 мин
- File format + storage: ~15 мин
- Integration с decision journal: ~15 мин
- Smoke test: ~30 мин
- **Total: ~2 ч**

---

## Integrator hard-block scope-guard (escalation от warn-only)

**Originally planned:** Patch 1.3.3 (B-2 deliverable)
**Deferred:** 2026-05-27 per DEC-DEV-0047 Section 4 (scope discipline)
**Defer rationale:** Hard block (`{"continue": false}` PreToolUse JSON response) нарушает ecosystem-wide hook convention «warn don't block» (см. `hooks/product/product-handoff-gate.js:12` и аналогичные). Чтобы override этот principle для одного hook — нужен отдельный архитектурный DEC-DEV с обоснованием класса исключения, проверкой downstream impact (что если hook crash блокирует всю работу?), discoverable opt-out. Это substantial work, не patch.

Patch 1.3.3 ships warn-only вариант. Если warn недостаточно — bring-forward triggers ниже.

**Bring-forward trigger:** Любое из:
- Повторное violation `.product/` write от Integrator-context session ПОСЛЕ 1.3.3 (т.е. AI игнорирует stderr warning + PA entry).
- Пользователь явно запрашивает «hard block, я хочу invariant».
- Кросс-проект migration на ecosystem 2+ pilots, где solo-dev convention not applicable.

### Architectural intent

Hook `hooks/integrator/scope-guard.js` в **strict mode**:
- Response к PreToolUse hook callback: `{"continue": false, "stopReason": "<explanation>"}` JSON to stdout (per Claude Code hook spec — нужна validation actual API).
- Tool call **отменяется**; assistant видит stopReason и должен явно reroute (ask user, switch to Product Module, или принудительно подтвердить через дополнительный mechanism).
- Возможность mode-switch: `INTEGRATOR_SCOPE_GUARD_MODE=warn|strict` env var (default `warn`); или config в `.claude/integrator/scope-guard.yaml`.

### Implementation notes

**Dependencies:**
- DEC-DEV-level decision: «exception к ecosystem warn-only hook convention для критичных boundary violations». Включает review всех остальных hooks: должны ли они тоже иметь strict mode?
- Validation Claude Code PreToolUse hook spec: точная JSON schema для blocking response.
- Cross-platform smoke: Windows vs Linux/macOS edge cases (stdin/stdout encoding).

**Integration points:**
- `commands/integrator/*.md` boilerplate (session marker write) — без изменений; hook читает marker как раньше.
- `commands/ecosystem/verify.md` — добавить проверку strict mode setting (config valid? sane?).
- New: `commands/integrator/scope-guard-override.md` (или флаг к существующему `/integrator:debug`) для emergency unblock сценариев. UX: explicit user confirmation чтобы избежать automation bypass.

### References to existing spec

- `dev/PATCH_1.3.3_READINESS.md` Section 1 B-2 Decision 1 («warn-only» rationale).
- DEC-DEV-0047 Options considered, вариант 1 (отвержение strict mode для patch).
- `hooks/integrator/scope-guard.js` (after 1.3.3 implementation) — base для extension.

### Estimated effort при возврате

- Architectural DEC-DEV (review всех hooks + exception rationale): ~1 ч.
- Hook strict mode + config support: ~1.5 ч.
- Override command + UX: ~1 ч.
- Cross-platform smoke + docs: ~1 ч.
- **Total: ~4-5 ч**

---

## Integrator-as-DevOps на изолированной VM (full-OS access)

**Originally planned:** Not planned — surfaced 2026-05-27 user idea
**Deferred:** 2026-05-27 per DEC-DEV-0047 Section «Backlog»
**Defer rationale:** Out of scope patch 1.3.3 (а также любой near-term phase). Требует:
- Sandbox/VM provisioning strategy (Hyper-V? WSL2? Docker desktop? Lima?)
- Screen-capture / keyboard injection protocol для AI as user (Anthropic computer-use API? Custom MCP server?)
- Security review: что Integrator может сделать на host через VM boundary breach?
- Cross-platform support — Windows host (текущий dev env) vs Linux/macOS.
- Cost model: long-running VM = compute + storage; кто платит, как scale.

Pre-pilot Ecosystem 3.0 не имеет use case justification: solo-dev workflow прекрасно работает на host без VM. Bring-forward после post-pilot validation с real demand.

**Bring-forward trigger:** Любое из:
- Post-pilot evidence что local-host execution создаёт class проблем (dependency conflicts host vs project, OS-specific tools mismatch, security concerns про что AI имеет доступ к user filesystem).
- Multi-developer pilot где cross-machine consistency критична (VM as «pinned dev environment»).
- Computer-use API matures и becomes ergonomic для long-running sessions.
- User explicit demand для «true DevOps» Integrator с visual feedback loop (browser interaction, IDE driving).

### Architectural intent

**Vision:** Integrator runs в VM с полным OS access:
- Видит экран (screen capture stream доступен модели).
- Печатает в любом приложении (keyboard injection через computer-use API).
- Работает как «настоящий разработчик»: открывает IDE, navigates GitHub UI, configures tools through their actual UIs (не CLI-only).
- Изолирован: host filesystem недоступен; only VM shared volume для project files.

**Концептуальные роли VM-Integrator vs current Integrator:**
- Current (host-based): tool-installer + contract-designer + journal-keeper. Limited к Claude Code's tool API (Bash, Edit, Write, etc.).
- VM-based (proposed): full DevOps engineer. Может install, configure, troubleshoot tools через их native UIs; видит actual error messages в IDE/browser; реагирует на visual state.

### Implementation notes

**Major unknowns (design needed before estimate):**
- VM platform: Hyper-V vs WSL2 vs Docker Desktop vs Lima — каждый imposes different constraints на screen access.
- AI-to-VM bridge: existing computer-use (Anthropic API beta) vs custom MCP server vs RDP/VNC client integration.
- Session model: persistent VM (state survives sessions) vs ephemeral (clean per task) vs hybrid.
- Trust boundary: что VM-Integrator может сделать что обычный Integrator не может? И какие новые risks (e.g., AI запускает malicious script внутри VM — impact?)
- Cost: continuous VM ~$X/мес если cloud-based; local — disk + RAM overhead.

**Initial PoC scope (если bring-forward):**
- Single-platform (Windows host + Hyper-V Linux VM).
- Shared folder для project files (read+write).
- Computer-use API integration для screen + keyboard.
- 1 smoke scenario: VM-Integrator установить инструмент через его UI (например, Docker Desktop через GUI вместо CLI) + verify.

### References to existing spec

- None — это greenfield extension. Текущий `docs/integrator-module/SPEC.md` §1.1 «Что Integrator делает» — все capabilities остаются valid; VM extension добавляет «как делает» layer.
- Anthropic computer-use API docs (external) — reference architecture.
- Возможная связь с Orchestrator Module (out-of-scope для v1; см. ROADMAP) — Orchestrator может использовать VM-Integrator capabilities когда запускает инструменты.

### Estimated effort при возврате

- Design phase (PoC arch, platform choice, trust boundary): ~8-12 ч.
- PoC implementation (1 platform, 1 scenario): ~16-24 ч.
- Production hardening (multi-platform, security, session model): TBD — significant, ≥40 ч.
- **Total для valuable v1 capability: ≥60-80 ч.** Multi-session work.

---

## Design Module — `claude-design-workflow.md` full skill (C1 cut)

**Originally planned:** Phase 6 v1.0 (per DEC-DEV-0048 SPEC §4.4a, post-2026-05-27 addendum)
**Deferred:** 2026-05-27 per DEC-DEV-0052 cut C1
**Defer rationale:** OQ-DM-08 open — Claude Design (`claude.ai/design`) — research preview на 2026-05-27 без MCP/API. Ship'нуть full skill spec без actual claude.ai/design experimentation = speculation (phantom-audience risk, аналогично DEC-DEV-0046). Skill spec выглядит content-rich, но без real pilot data prompt patterns = vapor. Predicted regret: first real Claude Design pilot обнаружит skill mismatch с actual UX → rewrite all the same.
**Bring-forward trigger:** Любое из:
- First FM в pilot где user выбирает Claude Design over Stitch (real evidence)
- Anthropic releases public Claude Design MCP/API (announced «coming weeks» на 2026-05-27)
- ≥2 Claude Design sessions completed manually (export workflow к `.product/.design-sessions/`)

### Architectural intent

Полноценный `claude-design-workflow.md` skill (per SPEC §4.4a):

- **Prompt patterns library:** chat-driven generation, inline comments на UI elements, iterative refinement
- **Project context attachment workflow:** screenshots, codebases (via UI upload), design files
- **DS-inheritance:** Claude Design auto-inherits org's design system — Ecosystem 3.0 DS экспортируется как brand-package для импорта (manual export текстом в v1.1; MCP/API automation в v1.2+)
- **Export workflow:** ZIP/HTML/PDF/PPTX → `.product/.design-sessions/<MK-id>-export/` для capture; structured archive convention
- **Native «Handoff to Claude Code» integration:** Claude Design generates visual bundle → Ecosystem `/product:handoff` §10 ссылается на bundle URL; разграничение product-level behavioral vs design-level visual закреплено
- **Subscription tier handling:** graceful detection Pro/Max/Team/Enterprise availability; degradation path к Stitch / HTML fallback per `mcp_preferences.fallback_chain`
- **Known limitations workarounds:** comment persistence issues, compact view save errors, large codebase lag — документированные workarounds per real pilot evidence

### Implementation notes

**v1.0 stub (~30 lines, что shipped per Q5):**
- Параграф «manual workflow: open claude.ai/design, paste brief, export ZIP/HTML to `.product/.design-sessions/<MK-id>-export/`»
- Link to SPEC §4.4a + §9.1 для baseline info
- TODO marker «full skill — v1.1 after Claude Design pilot OR Anthropic MCP/API»

**Full v1.1+ deliverable depth:** ~120-180 lines (mirrors `stitch-workflow.md` структуру after Phase 6 v1.0 ships).

**Dependencies:**
- Real Claude Design pilot session(s) — substrate для prompt patterns
- OR Anthropic public MCP/API release — enables automation paths

### References to existing spec

- `docs/design-module/SPEC.md` §4.4a — skill spec sketch (DEC-DEV-0048 addendum)
- `docs/design-module/SPEC.md` §9.1 — Claude Design tool block
- DEC-DEV-0048 research baseline 2026-05-27 (Claude Design known limitations)
- DEC-DEV-0052 Q5/C1 — defer decision

### Estimated effort при возврате

- Pilot session(s) capture: 2-4ч (depends on Claude Design subscription + UI complexity)
- Skill full draft: 2-3ч (prompt patterns + workflow + DS export + degradation)
- Smoke verification (Q9 PA integration triggers + fallback chain): 1ч
- **Total: 5-8ч focused work**

---

## Design Module — `screen-generator` subagent (C2 cut)

**Originally planned:** Phase 6 v1.0 (per SPEC §5.1 + ROADMAP `subagents/design/screen-generator.md`)
**Deferred:** 2026-05-27 per DEC-DEV-0052 cut C2
**Defer rationale:** Pre-optimization — D.2 «множественная генерация экранов» теоретически потребляет много контекста, но это не доказано в real D.2 pilot. SPEC §5.1 предполагает subagent для context isolation, но v1.0 D.2 inline в `design-session.md` workable если main session capacity sufficient. Phase 5 lesson «не build subagents до evidence о context pollution» применим.
**Bring-forward trigger:** Любое из:
- Real D.2 запуск >5 экранов hits >50% main context (measured)
- Multiple D.3 «крупные правки» sessions показывают context pollution patterns
- User explicit feedback «subagent isolation хотелось бы»

### Architectural intent

Per SPEC §5.1:

- **Контекст:** Design Brief + SC steps + BR constraints + LC states + DS snapshot + RPM
- **Инструменты:** Stitch MCP (primary), Figma MCP (future), WebFetch (HTML fallback), Sequential Thinking
- **Триггер:** D.2 (first iteration for multiple screens), D.3 крупные правки (2+ экрана одновременно), D.5 при missing states
- **Вход:** структурированный prompt с feature context + screen inventory draft + DS tokens + a11y requirements
- **Выход JSON schema (per DEC-DEV-0052 A10):**
  ```yaml
  screens: [{si_id, tool_url, generation_status, issues[]}]
  new_components_proposed: [{name, variants, tokens_used}]
  new_tokens_proposed: [{name, value, usage, source_si}]
  issues: [{severity, message, related_si?}]
  ```
- **Fallback behavior:** Stitch unavailable → HTML/React artifact generation through Claude Code primitives

### Implementation notes

**Structural template:** Phase 5 `tool-profiler` → `contract-designer` pattern (DEC-DEV-0040 + 0044) — single-tool deep work + verify-only smoke. Adapt к multi-screen-generation purpose.

**Subagent registration cycle:** проверить per DEC-DEV-0038 R7 follow-up (product-devils-advocate registration gap precedent). Этот gap stays unverified в v1.0 без subagent — если bring-forward пробуждается, на kickoff проверить.

**Dependencies:**
- Stitch MCP active (через `/integrator:add stitch-mcp`)
- DS snapshot accessible (via skill `design-system-rules.md`)
- Real D.2 pilot evidence

### References to existing spec

- `docs/design-module/SPEC.md` §5.1 — subagent definition
- `agents/integrator/{tool-profiler,contract-designer}.md` — structural template (Phase 5)
- DEC-DEV-0052 Q2/C2 — defer decision + A10 JSON schema

### Estimated effort при возврате

- Subagent file (prompt + tools + brief contract): 1-2ч
- Smoke fixture (≥3 cases — single screen, multi-screen, Stitch unavailable): 1ч
- Integration в `design-session.md` D.2 + D.3 dispatch logic: 30-45 min
- **Total: 2-4ч focused work**

---

## Design Module — `/design:migrate` Stitch ↔ Claude Design path (C3 cut)

**Originally planned:** Phase 6 v1.0 (per SPEC §3.6 + DEC-DEV-0048 §16.2 — full matrix Stitch ↔ Claude Design ↔ HTML)
**Deferred:** 2026-05-27 per DEC-DEV-0052 cut C3
**Defer rationale:** Schema полная (MK frontmatter enum includes claude-design; `previous_tools[]` поддерживает); только command logic narrower в v1.0. Claude Design migration path требует prerequisite: working `claude-design-workflow.md` skill (см. C1) — без него regen в Claude Design = pure manual paste без skill guidance, низкое UX качество. Защищает от phantom-validation: v1.0 ships Stitch ↔ HTML (mechanical paths) — both fully validated; Claude Design path waits for C1 unlock.
**Bring-forward trigger:** Tied to C1 unlock — когда `claude-design-workflow.md` full skill ships, `/design:migrate` matrix expansion = trivial follow-up.

### Architectural intent

Per SPEC §3.6 расширенный матрикс:
- `--to stitch` from claude-design OR html — regenerate в Stitch через brief
- `--to claude-design` from stitch OR html — manual workflow в `claude.ai/design` (v1.1) ИЛИ MCP/API automated (v1.2+)
- `--to html` from stitch OR claude-design — direct Claude Code HTML/React generation

Все paths используют common:
- Hard approve gate per DEC-DEV-0052 Q1 (silence ≠ consent; per-MK granularity)
- `previous_tools[]` audit trail
- Brief + MK metadata + DS snapshot → regen input
- Rollback on regen failure (delete last `previous_tools[]` entry per A8)

### Implementation notes

**Что в v1.0 ships (per Q6):**
- `/design:migrate <MK-id> --to {stitch, html}` only
- Schema полная (enum `stitch | claude-design | figma | penpot | html` keeps в MK frontmatter)
- Command rejects `--to claude-design` с message «Claude Design migration: v1.1+ (см. v1_1_backlog.md)»

**Что добавляется в v1.1:**
- `--to claude-design` branch
- Manual workflow walkthrough (paste brief, export ZIP back) — if MCP/API unavailable
- MCP/API automation path — if Anthropic shipped

### References to existing spec

- `docs/design-module/SPEC.md` §3.6 — full matrix spec
- `docs/design-module/SPEC.md` §16.2 — lossy migration принципы
- `docs/pmo/artifacts/MK.md` — `previous_tools[]` schema (already v1.1 ready)
- DEC-DEV-0052 Q6/C3 — defer decision
- C1 entry — dependency

### Estimated effort при возврате

- Tied to C1 timeline; standalone expansion of `migrate.md` command: ~1-2ч
- Smoke fixture (≥2 cases — claude-design from stitch, claude-design from html): 30-45 min
- **Total: 1.5-3ч focused work** (after C1 lands)

---

## Design Module — `html-fallback.md` React + multi-screen (C4 cut)

**Originally planned:** Phase 6 v1.0 (per ROADMAP — «HTML fallback работает без Stitch (полноценный путь, не заглушка)»)
**Deferred:** 2026-05-27 per DEC-DEV-0052 cut C4
**Defer rationale:** «Полноценный путь» в v1.0 trips на scope creep — React generation + multi-screen + state-aware components = full second UI tooling stack. Primary use case HTML fallback = «Stitch down» emergency unblock (rate limit hit, network down) — single HTML page достаточен для unblocking session. React/multi-screen — orthogonal capability (когда user в HTML mode постоянно, не emergency).
**Bring-forward trigger:** Любое из:
- User explicitly demands React-quality fallback («HTML mode primary, not emergency»)
- ≥3 sessions completed end-to-end в HTML mode (evidence что HTML — не emergency, а real workflow)
- Multi-screen requirement surfaced в real D.2 (Stitch failed mid-session, нужно continue в HTML для 2+ screens)

### Architectural intent

**Full HTML fallback skill (~80-120 lines):**
- HTML page generation per screen с DS tokens via CSS vars
- React component generation (functional components, hooks, props typed)
- Multi-screen support: navigation between screens via state (no router complexity)
- Component state matrix codification (default/hover/error в CSS pseudo-selectors)
- Accessibility: aria-*, tab order, contrast checks inline
- Export к `.product/.design-sessions/<MK-id>-html/` с index.html + per-screen.html + assets/

### Implementation notes

**v1.0 ships (per Q4):**
- Minimal `html-fallback.md` (~80 lines):
  - Single HTML page generation
  - DS tokens via CSS vars
  - No React (vanilla HTML/CSS)
  - No multi-screen — output = одна страница per `/design:start` request

**Full v1.1+:**
- React expansion (functional components, prop types via TS or JSDoc)
- Multi-screen support
- Navigation logic между screens (sessionStorage-based mini-router)

### References to existing spec

- `docs/design-module/SPEC.md` §9.3 — HTML/React artifact fallback
- ROADMAP Phase 6 acceptance criteria — refreshed per DEC-DEV-0052 к «minimal single-page»
- DEC-DEV-0052 Q4/C4 — defer decision

### Estimated effort при возврате

- React expansion: 1.5-2ч (functional components + state hooks)
- Multi-screen + mini-router: 1.5-2ч
- Smoke verification (3+ screens, navigation, a11y): 1ч
- **Total: 4-5ч focused work**

---

## Design Module — V-MK-02..03 full automation (C5 cut)

**Originally planned:** Phase 6 v1.0 (per ROADMAP — «V-MK-01..V-MK-08 валидация active»)
**Deferred:** 2026-05-27 per DEC-DEV-0052 cut C5
**Defer rationale:** V-MK-02 (Component State Matrix completeness) и V-MK-03 (BR constraints reflected in states) — full automation требует semantic recognition «is this an interactive component or static label?» — high false-positive risk на real MK с creative naming. v1.0 ships V-MK-02 partial (mechanical states `default`+`error` для components с pattern-match interactive verbs); V-MK-03 manual via `component-states.md` skill checklist. Bring-forward после accumulated evidence о safe auto-check patterns.
**Bring-forward trigger:** Любое из:
- 10+ MK created в pilot → pattern emerges для safe component classification
- 5+ false-positive cases logged против V-MK-02 mechanical mode (signals need для semantic upgrade OR signals current mode adequate)
- User requests «automate full V-MK-02/03» с willingness to tolerate false positives

### Architectural intent

**Full V-MK-02:**
- Automatic detection всех interactive components (buttons, inputs, links, cards с onclick, modals, menus)
- Per-component state coverage check: default / hover / focus / error / disabled / loading / empty / overflow / skeleton
- Cross-reference с BR constraints (если BR-NNN.statement references component → corresponding error state в matrix)
- Cross-reference с LC states (если LC entity has disabled state → corresponding component disabled state)

**Full V-MK-03:**
- Detect все BR rules применимые к UI (по keyword scan «validation», «format», «required», «max», «min» в BR statement)
- Verify каждое BR rule reflected в Component State Matrix error state
- Auto-flag missing coverage с suggest text «BR-NNN не reflected в MK-NNN/Component-X error state»

### Implementation notes

**v1.0 ships (per Q3):**
- V-MK-02 partial: warn если в Component State Matrix отсутствует `default` или `error` state для row с `interactive_verb` pattern match (`click`, `submit`, `select`, `toggle`)
- V-MK-03 manual: `component-states.md` skill checklist runs human через все BR с UI-applicable patterns; ассистент proposes, human confirms

**Full v1.1+:**
- Semantic component classifier (likely keyword + position heuristic; advanced — call screen-generator subagent для semantic decision)
- BR ↔ MK cross-ref automation с safe-mode threshold (≥X confidence to auto-flag, else queue)

### References to existing spec

- `docs/pmo/validation.md` V-MK-01..V-MK-08 — full validation suite
- `docs/design-module/SPEC.md` §4.5 — `design-validation.md` skill
- DEC-DEV-0052 Q3/C5 — defer decision

### Estimated effort при возврате

- Semantic component classifier (regex + position + keyword heuristic): 1.5-2ч
- BR ↔ MK cross-ref automation: 1.5-2ч
- Confidence threshold tuning + fixture (≥5 cases с mixed FP/TP): 1ч
- **Total: 4-5ч focused work**
