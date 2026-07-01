# D7 Pattern Library

> **Status:** Stage 3 (2026-04-28). Patterns marked **provisional** — extracted при early instance accumulation per user request override of SPEC §4.2 «pattern emerge before formalize» (3+ instances default). Refinement triggers explicit per pattern.
>
> **Refinement protocol:** after Phase 4-5 closures, re-validate each pattern against accumulated instances. Update / consolidate / promote per CONVENTIONS §10. Pattern status moves «provisional» → «validated» когда 3+ real instances confirm shape.

## Patterns

| Pattern | When applicable | Status | Instances |
|---|---|---|---|
| [Spec Drift Sweep](spec-drift-sweep.md) | After architectural refactor; before next phase kickoff | provisional | 2 (DEC-DEV-0013, DEC-DEV-0018) |
| [Readiness Gate](readiness-gate.md) | Before substantive phase implementation | provisional | 2 (DEC-DEV-0012, DEC-DEV-0020) |
| [B.1 Frontmatter Convention](b1-frontmatter-convention.md) | Skill creates artifact с specific frontmatter schema | validated (codified в CLAUDE.md) | ongoing |
| [Cuttable Scope Discipline](cuttable-scope-discipline.md) | Phase planning; meta-domain design; mid-phase scope creep concern | provisional | 3 (DEC-DEV-0012, DEC-DEV-0017, DEC-DEV-0020) |
| [Smoke Test Plan](smoke-test-plan.md) | After substantive phase implementation, before integration trust | provisional | 1 (Phase 3.I plan, DEC-DEV-0014) |
| [Blind Pre-registered Comparison](blind-comparison-protocol.md) | Qualitative/semantic comparison where the verdict is a judgment (not a passing test), esp. when the evaluator has a stake | provisional | 1 (DEC-DEV-0132 — P2 jury vs 1-GP) |

## How to use

**Reference pattern в DEC-DEV entry / commit message:**
> «Применил Spec Drift Sweep pattern (см. dev/meta-improvement/patterns/spec-drift-sweep.md) перед Phase 4 implementation kickoff — нашёл 2 stale references, fixed inline.»

**Reference pattern в phase-kickoff / phase-closure execution:**
> Section 3 (Spec drift sweep) executes Spec Drift Sweep pattern.

**Add new instance к existing pattern:**
- Append к pattern's «Examples» section с DEC-DEV reference + brief context
- Update «Instances» count в README index
- If 3+ instances reach «validated» — update status

**Propose new pattern:**
- Triggered when phase closure surfaces same friction class 3+ times
- Draft pattern doc; reference 3+ DEC-DEV instances
- DEC-DEV-NNNN entry для proposal с rationale

## Per-pattern doc structure

Each pattern follows:
- **Name** — clearly named, non-abstract
- **When applicable** — explicit triggers (not «always»)
- **Steps** — reproducible, sequential
- **Outputs** — what artifact / state change results
- **Examples** — DEC-DEV references, brief context per instance
- **Anti-patterns** — when over-applied / misapplied

## Provisional → validated promotion

Patterns shipped Stage 3 с only 1-3 instances each. Validation criterion: 3+ real instances confirm:
- Steps reproducible across instances
- Triggers reliable (no false-positive «applies always»)
- Outputs consistent

Pattern status moves «provisional» → «validated» в DEC-DEV-NNNN entry when criterion met. If pattern fails validation (instances don't fit shape) — refine OR retire.

## Open questions for pattern library evolution

- **Cross-references between patterns** — Cuttable Scope often cascades с Readiness Gate decisions; should pattern docs reference each other? Defer until 3+ patterns interact в practice.
- **Pattern composition** — meta-pattern «pre-kickoff readiness» = Readiness Gate + Spec Drift Sweep + Cuttable Scope chained. Useful abstraction OR over-abstraction?
- **Pattern retirement** — какой process если pattern doesn't validate after Phase 6-7? Move к `_archive/`?

These resolve через usage в Phase 4-7.
