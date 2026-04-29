# Pattern: Readiness Gate (Architectural)

> **Status:** provisional (2026-04-28). 2 instances accumulated. Refinement trigger: 3rd instance после Phase 4 kickoff → promote к validated.

## Name

**Readiness Gate** — pre-implementation architectural decision consolidation. Surface implicit / ambiguous decisions explicitly, document с rationale + alternatives, cascade through dependent decisions.

## When applicable

✅ **Applicable triggers:**
- Before substantive phase implementation (multi-deliverable scope, multi-file changes)
- Before standalone task с architectural impact (e.g., new command implementation)
- After phase scope refactor (DEC-DEV-NNNN consolidation work itself = readiness gate output)
- When phase ROADMAP entry mentions «architectural review needed»

❌ **NOT applicable:**
- Routine maintenance work (typo fixes, dependency bumps)
- Phases с single deliverable + clear precedent
- Bug fixes без architectural implications

## Steps

### 1. Read phase / task scope

Source: ROADMAP.md phase section, OR proposed work brief, OR DEC-DEV-NNNN proposal.

Output: list of deliverables + acceptance criteria.

### 2. Per deliverable: «what would I be guessing?»

Apply mental test: «If I started writing this right now, what decision would I be guessing?»

Common decision points (per past instances):
- **Hook event semantics** — PostToolUse vs PreToolUse vs Stop; matcher specificity
- **File path conventions** — project-relative vs absolute; slug rules; per-FM vs singleton
- **State management** — hook-managed vs skill-managed vs command-managed; atomicity guarantees
- **Failure handling** — block vs warn vs queue
- **Activation triggers** — manual vs automatic vs flag
- **Cross-mechanism contracts** — что данные passes между skills/hooks/commands; format

### 3. Document decisions explicitly

Per decision:
- Surface alternatives considered (≥2)
- Choose с rationale
- Note cascading effects (decision X implies decision Y becomes unnecessary)
- Document anti-patterns to avoid

Format: DEC-DEV-NNNN entry «Options considered» / «Decision» sections.

### 4. Watch for cascading decisions

When choice locks dependent decisions — group + document together:
- Adaptive-depth DA → DA debt mechanism unnecessary (DEC-DEV-0012 C.2)
- Path Y split → bootstrap simplification (DEC-DEV-0020)

Pattern: «решения каскадятся» — single readiness session better than serial decisions.

### 5. Update ROADMAP / READINESS doc

After decisions locked:
- Phase deliverables refined
- Estimated effort revised
- Sub-phase decomposition possible
- READINESS.md status banner updated 🟢 READY

### 6. Optional: ambiguity sweep + spec drift sweep

If readiness gate uncovers ambiguities (decisions need finer resolution) — chain to ambiguity sweep (DEC-DEV-0013 pattern).

If decisions replace previous model — chain к Spec Drift Sweep.

Часто readiness gate + ambiguity sweep + drift sweep run together.

## Outputs

- DEC-DEV-NNNN entry с N decisions + rationale + cascading effects
- Updated READINESS.md status: 🟢 READY for kick-off
- Sub-phase plan (Phase decomposed A→J style)
- Optional: prerequisite commit для spec drift fixes
- ROI: 3-5x vs sunk cost при mid-phase decisions (DEC-DEV-0012 measured)

## Examples (DEC-DEV instances)

### Instance 1: DEC-DEV-0012 (Phase 3 architectural readiness, 2026-04-20)

**Context:** Phase 3 ROADMAP draft (18 files, 4-6h estimate). Pre-implementation review surfaced 5 architectural unknowns + 5 alignment items + 5 scope decisions = 15 items.

**Process:** 3 conversation turns ~3h total.

**Decisions resolved:**
- C.1-C.5 — architectural (adaptive-depth DA, DA debt dropped, A1 skill writes status, cascade detection-only+V-11, hook reads overrides)
- B.1-B.5 — alignment (skill convention, fields audit, slug ASCII rule)
- D.1-D.5 — scope (Deep mode→v1.1, atomic mass-rename→v1.1, NFR Phase 4)

**Cascading effects:**
- C.1 (adaptive-depth) → C.2 (DA debt unnecessary, DROPPED not deferred)

**ROI:** ~3h readiness gate cost prevented ~9-15h sunk cost (15 items × ~1h avg блокирующее каждое при mid-phase discovery).

### Instance 2: DEC-DEV-0020 (mini-readiness for `/ecosystem:update`, 2026-04-28)

**Context:** Standalone command implementation triggered by DEC-DEV-0019 4 architectural findings. User wanted decisions explicit перед implementation.

**Process:** 1 conversation turn (user proposed via «3 questions, ага по всем»), ~10 min.

**Decisions resolved (3 questions):**
- Q1 Allowlist vs blocklist → Allowlist
- Q2 Delete obsolete files → Yes (rsync-style + backup mitigation)
- Q3 Manifest + settings.json sync → Always overwrite manifest; replace not merge hooks section

**Cascading effects:**
- Q3 «replace not merge» → Manifest = single source of truth post-update

**ROI:** mini-version of pattern — even non-phase work benefits.

## Anti-patterns

### Over-decision

❌ **Decision paralysis** — surfacing every micro-detail. Pattern: only «would I be guessing?» triggers. Если answer obvious from precedent — don't decide explicitly.
❌ **Premature locking** — locking decisions с insufficient context. Better: surface as ambiguity, defer к design discussion.

### Under-decision

❌ **Skip readiness, start coding** — DEC-DEV-0012 measured ROI 3-5x. Skipping = decisions accumulate mid-phase, ~1h block each.
❌ **Gut-feel decisions** — without alternatives + rationale, future readers (incl. future you) lose «why».
❌ **Single-decision focus** — missing cascading. Если C.1 changes implies C.2 obsolete, document both together.

### Misapplication

❌ **Readiness gate as design session** — pattern is *consolidation*, не creative design. If decisions need exploration, separate that work first.
❌ **Pattern для tasks без architectural impact** — typo fix doesn't need readiness gate; bug fix often doesn't either.

## Refinement triggers

- **3rd instance** → promote к validated (current: 2; next: Phase 4 kickoff likely instance).
- **«How to scope decisions per readiness session»** unclear — refine when 3+ instances show consistent boundary issue.
- **Mini-readiness vs full-readiness** distinction emerging — formalize if 3+ mini instances.

## Related

- [Spec Drift Sweep](spec-drift-sweep.md) — chains after readiness gate (drift cleanup для superseded model)
- [Cuttable Scope Discipline](cuttable-scope-discipline.md) — applies during readiness Section 4 (scope discipline)
- [`dev/meta-improvement/checklists/phase-kickoff.md`](../checklists/phase-kickoff.md) Section 1 — Architectural readiness step embeds this pattern
