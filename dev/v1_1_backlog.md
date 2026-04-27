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

## Atomic mass-rename `/product:bg:rename`

**Originally planned:** Phase 3 (per ROADMAP draft)
**Deferred:** 2026-04-20 per DEC-DEV-0012 (D.2 decision)
**Defer rationale:** Pilot frequency = 0; predicted real frequency ≤раз в неделю. Atomic implementation requires git tooling, conflict handling, rollback path — significant code для unvalidated frequency. Manual workflow (preview + sed/IDE find-replace + cascade-check) sufficient для v1.
**Bring-forward trigger:** 5+ mass-renames в течение месяца на любом active project, с user feedback что manual workflow tedious / error-prone.

### Architectural intent

`/product:bg:rename <old> <new>`:
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
- V-08 (terms in BG) — auto-add bold term as draft BG entry; user reviews batch (current Phase 3 manual через `/product:bg:review`)
- Dependency status updates (FM `requires_review` flag когда supporting BR changed)
- Stale draft cleanup (V-12) — if scheduled review enabled

**NOT auto-fix:**
- Semantic content (BR statements, IC formulations) — never auto-edit
- Cross-artifact validation conflicts — always require human judgment
- Mass renames (handled separately через bg:rename command)

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

## Bundle approve UX для cascade

**Originally planned:** Phase 3
**Deferred:** 2026-04-20 per DEC-DEV-0012 (C.4 decision)
**Defer rationale:** V1 cascade — detection-only + V-11 auto-fix; navigation manual через `/product:cascade`. Bundle UX makes sense только когда auto-fixes accumulate (full BFS scenario). Premature без full BFS.
**Bring-forward trigger:** одновременно с full BFS auto-fix expansion (см. выше).

### Architectural intent

См. `docs/pmo/processes.md §4.2` («Bundle approve UX»).

### Estimated effort

1-2 часа (часть full BFS expansion).
