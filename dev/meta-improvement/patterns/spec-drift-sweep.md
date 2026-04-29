# Pattern: Spec Drift Sweep

> **Status:** provisional (2026-04-28). 2 instances accumulated. Refinement trigger: 3rd instance после Phase 4 / Phase 5 closure → promote к validated.

## Name

**Spec Drift Sweep** — systematic grep across docs/code/dev artifacts для stale references после architectural refactor.

## When applicable

✅ **Applicable triggers:**
- DEC-DEV-NNNN updates SPEC (terms renamed, mechanism replaced, fields refactored)
- Architectural decision replaces existing model (e.g., magnitude-gated → adaptive-depth)
- Pre-phase implementation kickoff (Section 3 of phase-kickoff.md)
- Discovery of multiple stale references suggests broader rot

❌ **NOT applicable:**
- Cosmetic doc edits (typo fixes)
- New feature additions без replacing existing model
- Routine commit-level changes (use git log для these)

## Steps

### 1. Identify «refactored model» terms

Per DEC-DEV-NNNN that triggered sweep — что заменено, что устарело:
- Old term names → new term names
- Old mechanism IDs → new mechanism IDs
- Old hook/command/skill names → new names
- Old conventions / approaches replaced

**Output:** list of «search terms» для grep.

### 2. Grep entire repo

```bash
grep -rn "<old-term-1>\|<old-term-2>\|<old-mechanism-name>" \
  docs/ dev/ commands/ skills/ agents/ hooks/ \
  CLAUDE.md ROADMAP.md README.md CHANGELOG.md
```

Use ripgrep alternative if available:
```bash
rg "<old-term-1>|<old-term-2>" docs/ dev/ commands/ skills/ agents/ hooks/
```

### 3. Categorize each hit

Per match:
- **Active reference** (current intent, would mislead reader) → fix к new model
- **Historical reference** (DEV_JOURNAL entry, «superseded» block, CHANGELOG `[<old-version>]`) → leave with marker / preserve

Категоризация важна: removing all references loses history; keeping all references creates rot. Pattern: edit only «active» references; preserve historical context.

### 4. Apply fixes

Edit each active reference. Group edits by file для clean diffs. Atomic where possible.

### 5. Commit prerequisite

Single commit перед next phase implementation kickoff:
```
refactor(<scope>): pre-Phase-<N> spec drift sweep (DEC-DEV-NNNN A.X)
```

Prerequisite commit pattern: drift fixes shipped перед main phase work, не bundled.

## Outputs

- Prerequisite commit с N stale references fixed
- DEC-DEV-NNNN entry references «N stale sections found in single grep run, fixed inline»
- Updated spec consistency: 0 active references к superseded model

## Examples (DEC-DEV instances)

### Instance 1: DEC-DEV-0013 (Phase 3 implementation kickoff, 2026-04-27)

**Context:** DEC-DEV-0012 refactored P-RULE-01/02 from magnitude-gated → adaptive-depth. processes.md §6.2 + validation.md §7 updated, but other docs не sweep'нуты.

**Sweep terms:** `magnitude-gated|da-debt|ic-change-da-trigger|br-change-review-trigger`

**Findings:** 4 stale sections found:
- `docs/product-module/SPEC.md` (lines 6, 77, 350; §6.4, §6.5; §6.7 missing)
- `docs/pmo/processes.md §14.2` (hook list still old names)
- `agents/product/devils-advocate.md` (frontmatter description, brief format, output shape — full refactor needed)
- `CHANGELOG.md` (forward-compat note hook names)

**Fix commit:** `d82b656` «pre-Phase-3 spec drift fixes»

**ROI:** ~30 min sweep cost vs ~2-4h sunk cost при mid-phase discovery (each finding caused ~30-60 min блокирующее «спец X говорит, что новый код должен делать?»).

### Instance 2: DEC-DEV-0018 (Phase 3 closure, 2026-04-28)

**Context:** Phase 3 closure ritual Step 1 (doc health check) caught 5 stale sections (status banners, snapshots, count typos).

**Sweep terms:** `Phase 3` + arithmetic check «14 skills» vs 13 actual.

**Findings:** 5 doc rot fixes (README v1.0→v1.1.0, CLAUDE.md «Где мы сейчас» snapshot, item 4 Phase-3-specific, tree subdir; ROADMAP+CHANGELOG count typo).

**ROI:** ~15 min sweep cost; would've compounded across Phase 4-5 без catch.

## Anti-patterns

### Over-application

❌ **Applying to cosmetic changes** — typo fixes don't create drift; sweep adds overhead без value.
❌ **Removing historical references** — DEV_JOURNAL/CHANGELOG history important context. Sweep should preserve historical mentions с marker.
❌ **Sweeping для new additions без replacement** — пeрвая mention of new term = no drift exists yet.

### Under-application

❌ **Sweep only docs/, не agents/skills/commands/hooks/** — Phase 3 caught drift в agents/product/devils-advocate.md, не пойманное только-docs sweep.
❌ **Skipping CLAUDE.md / README.md / ROADMAP / CHANGELOG** — root docs often have stale forward-compat notes.
❌ **Single-doc updates without full sweep** — DEC-DEV-0013 lesson: same document может leave hanging references in different sections (processes.md §6.2 updated but §14.2 stale).

### Misapplication

❌ **Sweep instead of architectural design** — pattern detects stale references; doesn't fix architectural inconsistency. If sweep finds active references that contradict each other (not just stale), need architectural decision first.

## Refinement triggers

- **3rd instance** → promote к validated (current: 2 instances; next: Phase 4 closure or pre-Phase-5 kickoff likely добавит instance).
- **False positives observed** (sweep flags non-drift) → refine «categorize each hit» step с specific decision criteria.
- **Pattern composition** — if used together с Readiness Gate consistently, document composition.

## Related

- [Readiness Gate](readiness-gate.md) — often cascades; readiness gate produces architectural decisions, drift sweep cleans up references к superseded model
- [`dev/meta-improvement/checklists/phase-kickoff.md`](../checklists/phase-kickoff.md) Section 3 — Spec drift sweep step in kickoff template
- [`dev/meta-improvement/checklists/phase-closure.md`](../checklists/phase-closure.md) Step 1 — caught instance 2
