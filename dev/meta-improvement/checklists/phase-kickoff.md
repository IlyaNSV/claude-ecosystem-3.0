# Phase Kickoff Checklist

> **Назначение:** template для readiness gate перед каждой Phase N implementation. Extracted from proven instances DEC-DEV-0012 (Phase 3 readiness gate) + DEC-DEV-0013 (ambiguity resolution + spec drift sweep) + Phase 3 implementation kickoff prompt structure.
>
> **Когда запускать:** после Phase N-1 closure, перед Phase N implementation start.
>
> **Owner:** developer.
>
> **Time budget:** 60-90 min focused work.

---

## Pre-flight

- [ ] Phase N-1 closure complete (DEC-DEV-NNNN closure findings entry exists)
- [ ] Phase N-1 smoke test passed (или queued + risk accepted)
- [ ] Phase N section в `ROADMAP.md` present с deliverables list
- [ ] `dev/PHASE_<N>_READINESS.md` skeleton exists (created at Phase N-1 kickoff Section 5)

---

## Section 1 — Architectural readiness (≤30 min)

**Цель:** identify decisions left implicit / ambiguous в Phase N spec; resolve before kickoff. Pattern from DEC-DEV-0012 (15 items resolved за ~3 conversation turns; ROI 3-5x vs sunk cost при mid-phase discovery).

### Что делать

1. **Read Phase N section ROADMAP** — list deliverables and acceptance criteria.

2. **For each deliverable, ask «What would I be guessing if I started writing this right now?»** — общие decision points (per past phases):
   - Hook event semantics (PostToolUse vs PreToolUse vs Stop; matcher specificity)
   - File path conventions (project-relative vs absolute; slug rules; per-FM vs singleton)
   - Session state ownership (hook-managed vs skill-managed vs command-managed; atomicity)
   - Failure handling (block vs warn vs queue)
   - Activation triggers (manual vs automatic vs flag)
   - Cross-skill / cross-hook contracts (data passing format)

3. **Document decision per item** в DEC-DEV-NNNN entry с rationale. Note alternatives rejected.

4. **Watch for cascading decisions** — per DEC-DEV-0012 lesson «решения каскадятся»: when X is chosen, what becomes unnecessary? E.g., adaptive-depth DA → DA debt mechanism unnecessary.

### Pass

- Each deliverable has explicit answer для «what would I be guessing» test
- Decisions documented в DEC-DEV-NNNN entry (numbered list)
- Cascading effects explicit

### Fail

- Cannot resolve decision in 10 min → flag для design discussion перед continuing
- > 5 unresolved → Phase scope likely too big; consider split
- Decisions cascade unexpectedly → group + document together (1 DEC-DEV entry, not separate)

---

## Section 2 — Ambiguity sweep (≤20 min)

**Цель:** identify spec ambiguities (не architectural но enough to block implementation). Pattern from DEC-DEV-0013 (9 ambiguities found; if not resolved — каждая 1 hour mid-implementation = 9-15h sunk cost).

### Что делать

1. **Sweep dimensions:**
   - **Naming** — file paths, identifiers, slug conventions
   - **State management** — где session state живёт, atomicity guarantees, owner contracts
   - **Edge cases** — null, missing, expired, concurrent
   - **Cross-mechanism contracts** — what data passes между skills/hooks/commands; format
   - **Integration overlap** — какие hooks fire together; semantics

2. **Per ambiguity:**
   - Surface explicit (state как «ambiguous: X — choice between A or B»)
   - Propose resolution с rationale
   - Document в same DEC-DEV-NNNN entry as Section 1 (under «Decisions — N ambiguity resolutions»)

### Pass

- 0 ambiguities feel «I'd need to ask user mid-implementation»
- Resolutions consistent с architectural decisions из Section 1

### Fail

- > 5 ambiguities → Phase scope likely too big; consider split, или treat ambiguity sweep as own session

---

## Section 3 — Spec drift sweep (≤15 min)

**Цель:** find stale references in docs/ and code that contradict latest architectural decisions. Pattern from DEC-DEV-0013 A.1-A.4 (4 stale sections found by single grep run; pre-kickoff sweep cost ~30 min vs ~2-4h sunk cost при mid-phase discovery).

> **Lesson из Phase 3 (DEC-DEV-0014 #10):** spec docs не атомарны при refactor. DEC-DEV-0012 update'ил `processes.md §6.2` + `validation.md §7`, но `processes.md §14.2` (тот же документ!) остался стейл. Single-doc updates тоже могут leave hanging references.

### Что делать

1. **Identify «refactored model» terms** — anything DEC-DEV-NNNN replaced. Examples:
   - Phase 3: «magnitude-gated» → «adaptive-depth»; old hook names → new hook names
   - Phase 4 (likely): «draft mode partial» → «production mode strict» если flag changes

2. **Grep entire repo:**
   ```bash
   grep -rn "<old-term-1>\|<old-term-2>\|<old-mechanism-name>" \
     docs/ dev/ commands/ skills/ agents/ hooks/ \
     CLAUDE.md ROADMAP.md README.md CHANGELOG.md
   ```

3. **For each hit categorize:**
   - **Active reference** (current intent) → fix to new model
   - **Historical reference** (DEV_JOURNAL DEC-DEV entry, или «superseded» block, или CHANGELOG[<old-version>]) → leave with marker

4. **Commit fixes as prerequisite commit** перед Phase N kickoff — `refactor(<scope>): pre-Phase-<N> spec drift sweep (DEC-DEV-NNNN A.1-A.X)`.

### Pass

- 0 active references к superseded model (грепом)
- Historical references properly marked / preserved
- Single prerequisite commit lands перед Phase N implementation start

### Fail

- > 5 stale references active → architectural decision wasn't propagated; possibly Phase N-1 closure missed Step 1 / 3 — surface к D7 refinement
- Drift в код (skill/hook бы implements old model) → CRITICAL — fix перед kickoff (otherwise Phase N starts с broken base)

---

## Section 4 — Scope discipline (≤15 min)

**Цель:** apply «cuttable scope» pattern. Identify deliverables что can defer to v1.1+ без blocking Phase N value.

### Что делать

1. **Per Phase N deliverable, ask «Что отрежем?»:**
   - Is this on critical path для Phase N value?
   - Can simpler version ship + full → v1.1+?
   - Will Phase N+1+ work be blocked без этого?

2. **Common cut candidates (from past phases):**
   - **Subagents** — ship Quick mode without Deep first (per Phase 3 D.1)
   - **Atomic operations** — ship manual workflow first (per Phase 3 D.2)
   - **Auto-fix beyond critical** — V-11 only, rest queue (per Phase 3 C.4)
   - **Bundle UX** — defer until volume justifies
   - **Edge case handling** — defer until edge case observed
   - **Deep mode** — Quick first, Deep когда Quick limits hit

3. **Document cuts** в `dev/v1_1_backlog.md` per existing template (originally planned, deferred date, defer rationale, bring-forward trigger, full architectural intent + estimated effort).

### Pass

- Phase N deliverables list trimmed to «critical path»
- Cuts documented с full architectural intent (reconstructable)
- Bring-forward triggers explicit

### Fail

- Can't trim → Phase N может быть too big; consider split; или accept full scope с longer timeline + flag risk

---

## Section 5 — Plan refinement (≤10 min)

**Цель:** consolidate above into actionable plan для implementation session.

### Что делать

1. **Sub-phase decomposition** — break Phase N в A → B → ... → final. Per DEC-DEV-0014 lesson — «per-sub-phase commits + commit messages with mental smoke tests» works (10 commits for Phase 3, none «WIP»).

2. **Smoke test plan placeholder** — identify scenarios для Phase N.I (real run). Pattern from DEC-DEV-0014 — «static verification suite valuable but doesn't replace real run» — split static + real.

3. **Phase N+1 readiness placeholder** — create `dev/PHASE_<N+1>_READINESS.md` skeleton с sections A-G mirror current.

4. **Update ROADMAP** — Phase N section reflects refined scope, sub-phase plan, smoke test path. Update «Где мы сейчас» indicators.

### Pass

- Sub-phases enumerated A→J style
- Smoke test scenarios sketched
- PHASE_<N+1>_READINESS.md skeleton exists
- ROADMAP current

### Fail

- Sub-phases unclear → architectural / ambiguity sweep missed something — back to Section 1-2

---

## Closing

1. **DEC-DEV-NNNN entry** — record kickoff verified + decisions made (Sections 1-2 outputs)
2. **Single prerequisite commit** — spec drift fixes from Section 3
3. **Status banner update** — `dev/PHASE_<N>_READINESS.md` 🟢 READY for kick-off
4. **Begin implementation** — typically explicit «Стартуем!» от user

---

## Refinement tracker

| Phase | Kickoff date | Decisions resolved | Ambiguities | Drifts found | Time | Refinements |
|---|---|---|---|---|---|---|
| Phase 3 | 2026-04-20 / -27 | 15 (DEC-DEV-0012) | 9 (DEC-DEV-0013) | 4 (A.1-A.4) | ~3h split | (this template extracted from these instances) |
| Phase 4 | TBD | | | | | |
| Phase 5 | TBD | | | | | |
