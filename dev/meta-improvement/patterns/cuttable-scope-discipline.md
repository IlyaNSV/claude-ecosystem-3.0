# Pattern: Cuttable Scope Discipline

> **Status:** provisional (2026-04-28). 3 instances accumulated. Refinement trigger: 4th+ instance после Phase 4-5 closures → validate variance across phase types.

## Name

**Cuttable Scope Discipline** — per deliverable, ask «что отрежем?» perед implementation. Defer non-critical-path items с preserved architectural intent.

## When applicable

✅ **Applicable triggers:**
- Phase scope planning (per-deliverable scope decision)
- Mid-phase scope creep concern (something proposed beyond original scope)
- Meta-domain design (D7 itself — limited number of mechanisms can ship первой iteration)
- Standalone task с substantive scope (mini-readiness gate Section 4)

❌ **NOT applicable:**
- Bug fixes — no «cut» possible (fix it or don't)
- Single-deliverable phases — already minimum
- Essential complexity — cutting would break value proposition

## Steps

### 1. Per deliverable, ask three questions

1. **Is this on critical path для Phase / task value?** If yes — keep. If no — candidate cut.
2. **Can simpler version ship + full к v1.1+?** Если yes — defer full implementation, ship simpler.
3. **Will Phase N+1+ work be blocked без этого?** Если yes — keep. Если no — defer.

### 2. Identify common cut candidates

Per past phase patterns:
- **Subagents** (e.g., Deep mode pipeline) — ship Quick mode without Deep first
- **Atomic operations** (e.g., mass-rename) — ship manual workflow first
- **Auto-fix beyond critical** — V-11 only; rest queue к manual review
- **Bundle UX** — defer until volume justifies investment
- **Edge case handling** — defer until edge case observed
- **Deep coverage** (e.g., full BFS cascade) — partial coverage первой iteration
- **Skill / command / hook formalization** (D7 specific) — checklist-only first iteration

### 3. Document cuts с full architectural intent

Critical: cut doesn't lose context. Per cut item, record в `dev/v1_1_backlog.md`:

```markdown
## <Component name>

**Originally planned:** Phase N (per ROADMAP draft <date>)
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

Pattern: «defer не значит выкинуть» (DEC-DEV-0012 lesson). Reconstruction effort при возврате должна быть минимальной.

### 4. Document explicit «bring-forward triggers»

Each deferred item — what signal triggers implementation:
- N+ real instances showing limit hit
- M+ users requesting feature
- Performance threshold exceeded
- Time-based revisit (e.g., after Phase 5 closure)

## Outputs

- Trimmed phase deliverables list
- `dev/v1_1_backlog.md` updated с deferred items + full intent
- DEC-DEV-NNNN entry с cuts + rationale + triggers
- Bring-forward triggers explicit (no implicit «at some point»)

## Examples (DEC-DEV instances)

### Instance 1: DEC-DEV-0012 (Phase 3 scope cuts, 2026-04-20)

**Original Phase 3 scope:** 18 files, 4-6h estimate. Included Deep mode subagents, atomic mass-rename, full BFS cascade auto-fix, bundle approve UX.

**Cuts applied (D.1-D.5):**
- **Deep mode subagents** (D.1) → v1.1; preserve в `dev/v1_1_backlog.md` с 8-phase pipeline reference, MCP requirements (Firecrawl+Exa+GitHub), isolated-context rationale, integration points. Bring-forward trigger: 2-3 real Discoveries показывают Quick mode limits.
- **Atomic mass-rename** (D.2) → v1.1; v1 ships manual preview workflow. Bring-forward trigger: 5+ mass-renames в month showing manual workflow tedious.
- **Full BFS cascade auto-fix** (C.4) → v1.1; v1 ships V-11 only + manual /product:cascade for rest. Bring-forward trigger: pattern emerges from cascade-pending.yaml resolutions.
- **Bundle approve UX** → v1.1, tied к full BFS expansion.

**Result:** Phase 3 estimate revised 4-6h → 6-10h after scope analysis (вместо 8-12h при no cuts). Implementation completed в 1 day focused work.

### Instance 2: DEC-DEV-0017 (D7 Stage 2 ships 3 vs 7 files, 2026-04-28)

**Tempting scope:** 7 files (3 mandatory + bootstrap-regression.md + memory-sync.md + 5 pattern files starter).

**Cuts applied:**
- **Pattern library starter** → Stage 3+ (only 1 closure instance, premature по SPEC §4.2)
- **Bootstrap regression as standalone doc** → inline as Step 2 of phase-closure.md
- **Memory sync as standalone doc** → inline as Step 5 of phase-closure.md

**Rationale:** «cuttable scope discipline applies к meta-domain too» (DEC-DEV-0017 lesson). 10-15:1 add:cleanup ratio means D7 itself shouldn't bloat.

**Result:** Stage 2 ships 3 files; Stage 3+ promotion triggers explicit; D7 utility tested via inline application before formalization.

### Instance 3: DEC-DEV-0020 (`/ecosystem:update` minimum viable, 2026-04-28)

**Tempting scope additions:**
- Custom file detection («user modified ecosystem file?»)
- Multi-environment support
- Migration scripts для major version bumps

**Cuts applied:**
- Custom file detection → defer; v1 documents «backup before run if customized»
- Migration scripts → defer; v1 = simple sync (rsync-style + manifest re-derive)

**Result:** `/ecosystem:update` ships minimum viable resolving 4 DEC-DEV-0019 findings; complexity cut но architectural correctness preserved.

## Anti-patterns

### Over-cutting

❌ **Defer everything → no value ships** — pattern requires «critical path» preserved. Если nothing ships, pattern misapplied.
❌ **Cutting essential complexity** — some scope не cuttable (e.g., handoff = essential для Phase 4 value; cutting it = no Phase 4). Distinguish accidental complexity (cuttable) vs essential (не cuttable).
❌ **Aggressive cuts без bring-forward triggers** — deferred items без triggers stagnate в backlog forever.

### Under-cutting

❌ **«All deliverables critical»** — rarely true; mental shortcut to avoid thinking. Force ranking.
❌ **No rationale documented** — cut without «why» means future you (or AI) restores cut item не knowing why deferred.
❌ **Missing v1.1 backlog entries** — cuts disappear from memory; reconstruction effort при возврате high.

### Misapplication

❌ **Cuttable scope as «do less work»** — pattern is *prioritization*, не laziness. Cuts shift work, не eliminate (preserved в backlog с full intent).
❌ **Cutting after sunk cost** — once work invested, cuts lose value (work already done). Pattern best applied at planning / readiness gate, не mid-phase.
❌ **Cuts without architectural review** — naive cuts can break system (cutting V-11 auto-fix would break cascade). Apply during readiness gate с full architectural context.

## Refinement triggers

- **4th+ instance** → validate pattern across phase types (architectural Phase 4 vs maintenance Phase 7)
- **Cuts that turn out wrong** (deferred item urgently needed before trigger) → refine «bring-forward trigger» specification
- **Pattern composition с Readiness Gate** — already cascading в practice; document if 3+ instances show consistent composition

## Related

- [Readiness Gate](readiness-gate.md) — typically applied within Section 4 «scope discipline» of kickoff
- [`dev/v1_1_backlog.md`](../../v1_1_backlog.md) — preserved deferral context (formal location for cut items)
- [`dev/meta-improvement/checklists/phase-kickoff.md`](../checklists/phase-kickoff.md) Section 4 — Scope discipline step
- [`CLAUDE.md`](../../../CLAUDE.md) Принципы §4 «Cuttable scope — default»
