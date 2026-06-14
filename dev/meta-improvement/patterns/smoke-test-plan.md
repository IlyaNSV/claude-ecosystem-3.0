# Pattern: Smoke Test Plan

> **Status:** provisional (2026-04-28). 1 instance accumulated. Refinement trigger: 2nd+ instance после Phase 4 / Phase 5 implementation → validate shape.

## Name

**Smoke Test Plan** — split static verification (AI session can execute) vs real run (user-driven interactive Claude Code session). Document plan as standalone deliverable когда AI cannot complete validation alone.

## When applicable

✅ **Applicable triggers:**
- After substantive phase implementation (commands/skills/hooks)
- Before integration trust (handoff к dependent phase, или к user-facing claim «Phase N done»)
- When implementation involves interactive AI sessions / commands that current AI cannot self-execute (e.g., `/ecosystem:bootstrap` from another cwd, `/product:plan` interactive flow)
- Phase Section 5 of phase-kickoff.md (smoke test plan placeholder)

❌ **NOT applicable:**
- Pure refactor без behavior change (existing tests sufficient)
- Documentation-only commits
- Single-line bug fixes

## Steps

### 1. Identify what AI session CAN verify (static)

Static verification deliverables:
- File presence (commands/skills/hooks shipped)
- Cross-reference resolution (references к skills/commands point к existing files)
- Hook syntax (`node -c hook.js`)
- Frontmatter compliance (B.1 convention spot check)
- Manifest entries (registered hooks match files)
- Inline rule checks (canonical field names, ASCII slugs, etc.)

These don't require user interactive session.

### 2. Identify what AI session CANNOT verify (real run)

Real-run deliverables:
- Prompt-following correctness (skill actually produces canonical artifact via real conversation)
- Hook actually firing (PostToolUse triggers when expected)
- Subagent orchestration end-to-end (hook → stderr → orchestrator → Agent tool)
- Cascade detection real semantics
- A1 auto-approve actually firing under correct conditions
- User experience flow (approve gates feel right, notifications useful)

These require interactive Claude Code session in pilot project.

### 3. Document scenarios

Per real-run scenario:
- **Goal** — what's validated
- **Setup** — prerequisites (e.g., re-bootstrap pilot project, verify Phase N-1 artifacts intact)
- **Invocation** — exact command (`/product:plan`, `/product:feature FM-001`, etc.)
- **Expected flow** — step-by-step what should happen
- **Verify checks** — read-only post-state checks (file existence, content patterns)
- **Acceptance criteria** — bullet checklist
- **Possible findings** — known regressions to watch for

### 4. Document reporting format

After real run completion, populate retroactive DEC-DEV entry:

```markdown
## DEC-DEV-NNNN — Phase N smoke test results (real run on <pilot>)

Date: <ISO>
Trigger: Per Phase N.I plan (dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md)
Tag: #pilot-finding #validation

### Outcome
- Test scenario 1 (X): <pass | partial | fail с findings>
- ...

### Findings
1. [Specific finding с evidence]
...

### Lessons
- [Generalized takeaway]

### Next
- [Phase N+1 / fix list / pivot if major]
```

### 5. Define «done» criteria

Smoke test passes when:
- All scenarios run к completion (graceful skip placeholders OK)
- No regressions on prior phases (DEC-DEV-NNNN baseline maintained)
- N-of-M scenarios pass (e.g., 4+ of 5)

## Outputs

- `dev/gates/PHASE_<N>_SMOKE_TEST_PLAN.md` — standalone document
- Static verification done by AI session (in same Phase N implementation commit)
- Real run = user-driven, retroactive DEC-DEV-NNNN entry populates results

## Examples (instances)

### Instance 1: Phase 3 (DEC-DEV-0014 + dev/PHASE_3_SMOKE_TEST_PLAN.md)

**Context:** Phase 3 implementation completed (23 files, 5 commands + 13 skills + 4 hooks + 1 ext). Real run requires `/product:plan` + `/product:feature FM-001` interactive flow на my-first-test — current AI session cannot execute interactive Claude Code в other cwd.

**Static verification (DEC-DEV-0014 sub-phase 3.I, in implementation commit):**
- Hook syntax: all 6 hooks pass `node -c`
- Manifest references: all 6 hook entries resolve к existing files
- Skill cross-references: all referenced skills exist
- Hook references: all hook paths resolve
- Frontmatter compliance: all 18 Phase 3 files have description: frontmatter
- B.1 convention compliance: explicit frontmatter templates с anti-pattern lists
- ASCII slug rule: pilot files match
- No spec drift: «magnitude-gated» только в historical refactor blocks

**Real run scenarios (5 documented):**
1. `/product:plan` end-to-end (Planning P1.B)
2. `/product:feature FM-001` end-to-end (Enrichment P2.A)
3. `/product:bg-review` (Phase 3.G)
4. `/product:cascade --pending` (Phase 3.G)
5. D2 overrides (Phase 3.F)

Per scenario: setup, expected flow с step-by-step, acceptance criteria, possible findings (DEC-DEV-NNNN regression watch).

**Result:** real run pending user execution; static verification confirmed shippable. Pattern validated separation works.

## Anti-patterns

### Over-application

❌ **Smoke test plan для каждого commit** — pattern is per-phase, не per-commit. Routine commits validated via existing tests / CI.
❌ **Inflating scenarios** — 5 scenarios для Phase 3 = right balance. 15 scenarios = over-engineering, user won't run them all.
❌ **Smoke testing things AI can verify statically** — duplicates effort.

### Under-application

❌ **Skipping plan, hoping smoke test happens organically** — DEC-DEV-0008 lesson: «smoke test after each phase» окупается. Plan ensures it happens.
❌ **Static verification only, no real run** — DEC-DEV-0014 lesson #3: «static verification valuable but doesn't replace real run». Catches: missing files, broken cross-refs, syntax. Doesn't catch: prompt-following correctness, A1 actually firing per spec, DA orchestration end-to-end.
❌ **No reporting format** — real run results lost если no DEC-DEV entry template provided.

### Misapplication

❌ **Smoke test plan as substitute для acceptance criteria** — plan is *validation* of implementation; acceptance criteria are *requirements*. Both needed.
❌ **Skip user-driven execution** — current AI cannot spawn interactive Claude Code session in other cwd; pretending otherwise = false validation.
❌ **One-off plan** — pattern is reusable template; per phase create similar plan, не reinvent.

## Refinement triggers

- **2nd instance** (Phase 4 implementation) → validate template reusability across phase types
- **Real run findings consistent class** → refine scenario template к surface that class explicitly
- **Static vs real run boundary unclear** → refine «what AI can/cannot verify» list

## Related

- [Cuttable Scope Discipline](cuttable-scope-discipline.md) — sometimes smoke test scope cuttable (e.g., 5 → 3 scenarios)
- [`dev/PHASE_3_SMOKE_TEST_PLAN.md`](../../PHASE_3_SMOKE_TEST_PLAN.md) — instance 1 reference document
- [`dev/meta-improvement/checklists/phase-kickoff.md`](../checklists/phase-kickoff.md) Section 5 — Plan refinement step (creates smoke test placeholder)
- [`dev/meta-improvement/checklists/phase-closure.md`](../checklists/phase-closure.md) Step 2 — Bootstrap regression test (similar pattern для bootstrap-specific scenarios)
