# D7 Meta-Improvement Module — Conventions

> **Назначение:** правила (когда какие — for what reason) для D7 module mechanisms.
>
> **Status:** Stage 2 (2026-04-28). Resolves 10 SPEC §6 open questions с conservative defaults.
>
> **Refinement:** triggers и updates documented per-convention. Update via `chore(meta-improvement): D7 refinement post-Phase-<N> closure` commit.

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

**Layout (Stage 2):**

```
dev/meta-improvement/
├── SPEC.md                      # preliminary spec (Stage 1)
├── DESIGN_KICKOFF.md            # design session prompt (Stage 1)
├── CONVENTIONS.md               # this file (Stage 2)
├── checklists/
│   ├── phase-closure.md         # Stage 2
│   └── phase-kickoff.md         # Stage 2
└── (future) patterns/           # Stage 3+
    └── ...
```

---

## 3. Mechanism ratio (skill / command / hook / checklist)

**Convention:** start с simplest mechanism. Promote to higher only когда manual proves repeatable + heavy.

**Hierarchy (least → most ceremony):**

1. **Checklist (markdown)** — manual, developer runs, ≤60 min. **DEFAULT for Stage 2.**
2. **Skill** — AI-assisted execution, lazy-loaded. **Promote when:** checklist has 5+ instances + steps too rote to remember.
3. **Command** (`/<namespace>:<name>`) — explicit invocation. **Promote when:** skill has 10+ instances + needs argument support.
4. **Hook** — automatic on event. **Promote when:** command needs to fire on commit/file-change без developer action.

**Stage 2 status:** все D7 mechanisms = checklists. Promotion deferred Stage 3+ per SPEC §4.1 «cuttable scope».

**Rationale:** SPEC §5 anti-pattern #4 «Tooling over discipline» — first iteration must be manual to discover real workflow.

---

## 4. Activation triggers

**Convention:** manual at phase boundaries. No automatic activation в Stage 2.

| Mechanism | Trigger | Cadence |
|---|---|---|
| `phase-kickoff.md` | Before Phase N implementation | Once per phase |
| `phase-closure.md` | After Phase N implementation, before Phase N+1 readiness gate | Once per phase |
| (future) bootstrap-regression script | Stage 3+ if manual proves error-prone | Per phase or per-commit |
| (future) memory-sync skill | Stage 3+ if manual proves heavy | Per phase или quarterly |

**Reminder integration:**
- One-line pointer в `CLAUDE.md` § «Что делать в этой сессии (Claude)» — ensures discovery
- DEV_JOURNAL closure entry should reference `phase-closure.md` execution status

---

## 5. Cleanup criteria

**Convention:** archive `dev/PHASE_<N>_*` docs post-closure when criteria met. NEVER archive certain files.

### 5.1 Archive eligible

| File pattern | When archive | Where |
|---|---|---|
| `dev/PHASE_<N>_READINESS.md` | Post-Phase-N closure | `dev/_archive/phase-<N>/` |
| `dev/PHASE_<N>_SMOKE_TEST_PLAN.md` | After smoke run done | `dev/_archive/phase-<N>/` |
| Pre-Phase-N proposals (e.g., spec drafts если были) | Post-decision | `dev/_archive/phase-<N>/` |

### 5.2 NEVER archive

- `DEV_JOURNAL.md` — cross-session memory (per SPEC §6.4)
- `CHANGELOG.md` — consumer-facing release notes
- `ROADMAP.md`, `README.md`, `CLAUDE.md` — live root docs
- `dev/v1_1_backlog.md` — living deferral context
- `dev/PHASE_<N+1>_READINESS.md` — active for next phase
- `dev/meta-improvement/SPEC.md`, `CONVENTIONS.md`, `checklists/*` — D7 living docs

### 5.3 Mechanics

```bash
mkdir -p dev/_archive/phase-<N>/
git mv dev/PHASE_<N>_READINESS.md dev/_archive/phase-<N>/
git commit -m "chore(meta-improvement): archive PHASE_<N>_READINESS post-closure"
```

---

## 6. Memory MCP sync

**Convention:** manual review at phase closure (Step 5 of `phase-closure.md`). No automation Stage 2.

**Refinement trigger:** after Phase 4 closure — reassess. Если manual sync stays heavy (>10 min/closure) или drift discovered late — promote to skill (Stage 3).

**Files in scope:**
- `~/.claude/projects/<project-slug>/memory/MEMORY.md` (index)
- `~/.claude/projects/<project-slug>/memory/<entry>.md` (each tracked memory)

---

## 7. Pattern library

**Convention:** defer to Stage 3+. Stage 2 ships без named patterns.

**Rationale:** SPEC §4.2 «pattern emerge before formalize» — phase closure has only 1 instance (DEC-DEV-0014). Need 3+ для emergence.

**Promotion trigger:** after Phase 5 closure — extract first 3-5 patterns с full DEC-DEV references:
- Spec Drift Sweep (DEC-DEV-0013 A.1-A.4)
- Readiness Gate (DEC-DEV-0012)
- B.1 Frontmatter Convention (DEC-DEV-0011)
- Cuttable Scope Discipline (DEC-DEV-0012, cross-cutting)
- Smoke Test Plan (DEC-DEV-0014, Phase 3.I)

**Future location:** `dev/meta-improvement/patterns/<pattern-name>.md`.

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

## Open questions (revisit Stage 3+)

These are NOT settled in Stage 2 — flagged для re-evaluation после real instance accumulation:

- **Memory sync automation timing** — manual sufficient? или skill needed?
- **Pattern library structure** — what format proven через Phase 4-5 closures?
- **Bootstrap regression scripting** — manual recall в checklist OK, или test runner script?
- **Hook integration** — какие D7 mechanisms require hook auto-trigger (e.g., commit message «Phase X done» fires phase-closure reminder)?
- **CLAUDE.md update strategy** — when D7 mechanisms multiply, как keep CLAUDE.md от bloating?

These are NOT blocking Stage 2 ship. Each tracked в SPEC §6 originally; will close с DEC-DEV-NNNN entry as instance accumulates.
