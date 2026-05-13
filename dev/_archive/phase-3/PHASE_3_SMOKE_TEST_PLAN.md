# Phase 3 Smoke Test Plan

> **Назначение:** real run smoke test plan для validation Phase 3 implementation на existing pilot project `my-first-test/` (Phase 2 Discovery already complete per DEC-DEV-0008).
>
> **Why this is a separate document:** Phase 3.I requires interactive `/product:plan` + `/product:feature` invocation в Claude Code session. AI implementation сессия (which produced Phase 3 code) cannot directly execute slash commands — these need user-driven Claude Code session с `cwd=my-first-test`.
>
> **Когда выполнить:** после Phase 3.J (CHANGELOG/DEV_JOURNAL/ROADMAP updates) commit. Findings populate retroactive DEV_JOURNAL entry «DEC-DEV-NNNN — Phase 3 smoke test results».

---

## Static verification (already done — Phase 3.I AI session)

✅ **Hook syntax** — all 6 hooks pass `node -c`:
- `hooks/product/artifact-validate.js` (with Phase 3.F D2 overrides extension)
- `hooks/product/session-state.js`
- `hooks/product/bg-extractor.js` (Phase 3.E)
- `hooks/product/cascade-check.js` (Phase 3.E)
- `hooks/product/br-change-trigger.js` (Phase 3.E)
- `hooks/product/ic-change-trigger.js` (Phase 3.E)

✅ **Manifest references** — all 6 hook entries в `hooks/product/manifest.yaml` resolve к existing files.

✅ **Skill cross-references** — все `skills/product/*.md` references из commands и других skills resolve к existing files (16 unique skill files referenced — все present).

✅ **Hook references** — all hook paths referenced from skills/commands resolve (4 Phase 3 hooks present).

✅ **Frontmatter compliance** — все 18 Phase 3 files (5 Phase 3.A + 2 Phase 3.B + 6 Phase 3.C + 2 Phase 3.D + 3 Phase 3.G — 18 total) have `description:` frontmatter (B.1 convention).

✅ **B.1 convention compliance** — explicit frontmatter templates с anti-pattern field name lists в каждом skill, создающем артефакт.

✅ **ASCII slug rule** verified в pilot files:
- `SEG-001-solo-creators.md`, `SEG-002-edu-centers.md`, `SEG-003-self-learners.md`
- `HYP-001-glossary-retention.md` etc.

✅ **No spec drift** in active descriptions — все mentions «magnitude-gated» только в historical refactor blocks (per DEC-DEV-0013 spec drift sweep).

---

## Real run smoke test (user execution required)

### Prerequisites

1. **Re-bootstrap `my-first-test/`** to pick up new Phase 3 hooks + commands:
   ```bash
   cd C:/Users/pw201/WebstormProjects/my-first-test
   claude
   > /ecosystem:bootstrap
   ```
   Per [DEC-DEV-0002](../DEV_JOURNAL.md), bootstrap is idempotent — re-run merges new hooks (4 Phase 3 + extension к artifact-validate) into existing settings.json без data loss.

2. **Verify hooks registered:**
   ```bash
   cat .claude/settings.json | grep -A 2 hooks
   ```
   Should see 6 hooks: artifact-validate, session-state, bg-extractor, cascade-check, br-change-trigger, ic-change-trigger.

3. **Verify Phase 2 artifacts intact:**
   ```bash
   ls .product/
   ls .product/segments/
   ls .product/hypotheses/
   ```
   Expected: PS, MR, CA, 3 SEG, 3 VP, 4 HYP — все active per DEC-DEV-0008.

---

### Test scenario 1: `/product:plan` end-to-end (P1.B Planning)

**Goal:** validate Phase 3.A Planning core (D1.6-D1.8) creates MVP + RM + RL-001 + FM skeletons.

```
> /product:plan
```

**Expected flow:**

1. Step 2 prereq check — should pass (Discovery artifacts present).
2. Step 3b — initializes `.product/.sessions/current.yaml` (type: planning-session) + `.product/.sessions/planning-progress.yaml` (current_step: D1.6).
3. **D1.6 MVP Scope Definition** (delegates к `mvp-scoping.md`):
   - AI proposes primary HYP candidate (HYP-002 «Self-serve glossary drives retention» likely from pilot context)
   - User does MoSCoW prioritization
   - Approve gate (🟠 Strategic) с confidence statement
   - **Verify:** `.product/mvp-scope.md` created с canonical frontmatter (id: MVP, type: mvp-scope, primary_hypothesis: HYP-NNN, target_launch, confidence + confidence_notes — NO `confidence_rationale` drift)
   - **Verify:** Decision journal entry в `.product/.decisions/journal.md` (новая дир/файл — convention новая для Phase 3 per DEC-DEV-0013 #9)
   - **Verify:** BG extraction triggered (bg-extractor.js hook runs автоматически, появляются candidates в `.product/.pending/bg-candidates.yaml`)
4. **D1.7 RM** (delegates к `roadmap-planning.md`):
   - **Verify:** `.product/roadmap.md` created с canonical frontmatter (horizon, current_phase, ...)
5. **D1.8 RL-001 + FM skeletons** (delegates к `release-planning.md`):
   - RL-001 approve (🟡 Standard, one-item)
   - **Verify:** `.product/releases/RL-001-<slug>.md` ASCII slug
   - Per FM skeleton approve (🟠 Strategic per-FM)
   - **Verify:** `.product/features/FM-001-<slug>.md`, `FM-002-<slug>.md`, etc. — все с full FM canonical frontmatter (id, type, status: planned, priority, segment, jtbd, hypotheses, value_proposition, release: RL-001, has_ui, scenarios: [], rules: [], lifecycles: [], verification: [], invariants: [], mockups: [], success_metric, nfr_status: pending, nfr: [], requires_nfr: false, confidence + confidence_notes)
   - **Verify:** Phase 1 (skeleton) sections present в FM body — Why / What (brief) / Priority rationale / Success metric

**Acceptance:**
- [ ] MVP, RM, RL-001 created с canonical frontmatter
- [ ] 2-3 FM skeletons created для primary HYP (count depends on user's MoSCoW choices)
- [ ] ASCII slugs соответствуют B.5 rule (no Cyrillic в filenames)
- [ ] Decision journal entries appear для each Strategic approve
- [ ] BG candidates queued (Phase 3.E hook works)
- [ ] No A1 auto-approve в Phase 3.A skills (these are 🟠 Strategic — manual approve always)

**Possible findings:**
- If `current.yaml.type` defaults к `unknown` despite Step 3b — DEC-DEV-0009 regression
- If `last_artifact_*` fields desynchronize — DEC-DEV-0010 regression
- If `confidence_rationale` field appears anywhere — DEC-DEV-0011 regression (B.1 convention violation)
- If decision journal не creates dir/file automatically — Phase 3.A bug

---

### Test scenario 2: `/product:feature FM-001` end-to-end (P2.A Enrichment)

**Goal:** validate Phase 3.B/3.C/3.E end-to-end — F.0-F.10 with A1 auto-approve, DA orchestration, cascade detection.

```
> /product:feature FM-001
```

**Expected flow:**

1. Step 1 detect mode: enrichment (FM-001 matches FM-NNN pattern).
2. Step 2 prereq check: FM-001 exists в planned status (created в scenario 1).
3. Step 3b initialize per-FM session state:
   - `.product/.sessions/feature-FM-001-progress.yaml` (per DEC-DEV-0013 #1 — per-FM file, not singleton)
4. **F.1 Load FM context** — surface к user.
5. **F.2 Scenario Authoring** (delegates к `scenario-authoring.md`):
   - AI proposes 2-4 SC + alt + error flows
   - Per-SC approve (🟠 Strategic)
   - **Verify:** SC files в `.product/scenarios/SC-NNN-<slug>.md`, frontmatter canonical (id, type: scenario, feature: FM-001, flow_type, actors с R- prefix, ...)
   - **Verify:** Bi-dir update — FM-001.scenarios[] += SC-NNN ids
   - **Verify:** Cascade-check.js auto-runs — entries в cascade-pending.yaml для downstream notifications (если FM-001 уже had refs)
6. **F.3 Business Rule Extraction** (delegates к `business-rule-extraction.md`):
   - Per BR (🔴 Critical): adaptive-depth DA auto-triggers
   - **Verify:** br-change-trigger.js writes к `.product/.pending/da-pending.yaml` с Mode: adaptive + git diff
   - **Verify:** Stderr signal visible в Claude Code output: «DA review pending для BR-NNN ... Mode: adaptive (P-RULE-02)»
   - **Verify:** Orchestrator (feature-session.md skill prompt) spawns devils-advocate subagent через Agent tool с adaptive brief
   - **Verify:** Subagent (refactored devils-advocate.md) does Step 1 classify (cosmetic vs significant) + Step 2 adapt depth
   - **Verify:** Findings written к `.product/.da-findings/BR-NNN-<timestamp>.md` с magnitude + classification_rationale + 3-tier output (или single-block if cosmetic)
   - User resolves findings (act/defer/dismiss с rationale)
   - **Verify:** Per-BR approve only after critical findings resolved
7. **F.4 Lifecycle Derivation** (delegates к `lifecycle-derivation.md`) — **A1 auto-approve eligible**:
   - Skill self-checks: confidence: high + confidence_notes filled + V-05 (states reachable from initial) + V-06 (transitions trigger/guard)
   - **If A1 met:** skill writes LC status=active directly, journal DEC-AUTO-NNN entry, surfaces conversational notification «✓ LC-NNN auto-approved (rationale). Type 'revert LC-NNN' to roll back.»
   - **If A1 fails:** standard 🟢 Confirmation gate (manual approve)
   - **Verify:** Mermaid state diagram present в LC body
8. **F.5 Invariant Discovery** (delegates к `invariant-discovery.md`):
   - Per IC (🔴 Critical): adaptive-depth DA auto-triggers via ic-change-trigger.js
   - Same flow as F.3 BR (DA → findings → resolve → approve)
9. **F.5a NFR Review** — placeholder Phase 4:
   - **Verify:** Surface notification «F.5a skipped в Phase 3 (planned для Phase 4). FM.nfr_status remains pending. Continuing к F.6.»
10. **F.6 VC Derivation** (delegates к `vc-derivation.md`) — **A1 auto-approve eligible**:
    - Skill self-checks: confidence: high + V-07 coverage (all SC main/alt/error covered)
    - Same A1 flow as F.4
11. **F.7 RPM Update** (delegates к `rpm-derivation.md`) — **A1 auto-approve eligible**:
    - Skill self-checks: confidence: high + V-11 (RPM.roles bi-dir с SC.actors; conditional perms reference active BRs)
    - Incremental update (preserve existing RPM matrix, add new actors/actions/cells)
    - Same A1 flow as F.4
12. **F.8 Design Module** — placeholder Phase 6:
    - **Verify:** Surface skip notification (Phase 6 conditional activation; placeholder в Phase 3)
13. **F.9 FM-level Product DA** — placeholder Phase 4:
    - **Verify:** Surface skip notification (per-BR/per-IC DA already happened automatically; FM-level DA в Phase 4)
14. **F.10 FM status transition planned → in-progress**:
    - **Verify:** All blocking conditions met (SC/BR/LC/VC/IC active с DA findings resolved)
    - **Verify:** FM-001 status updated to in-progress
    - **Verify:** Decision journal entry «DEC-PLAN-NNN — FM-001 transitioned planned → in-progress (P2.A enrichment complete)»
    - **Verify:** Completion summary report

**Acceptance:**
- [ ] F.1-F.7 produce SC/BR/LC/VC/IC/RPM artifacts
- [ ] F.5a/F.8/F.9 placeholders surface как expected (skip notifications, no inline implementation)
- [ ] BG extraction queues candidates after each artifact write
- [ ] Cascade-check.js auto-runs; pending entries logged для non-V-11 reviews
- [ ] V-11 auto-fix applied для bi-dir refs (e.g., new BR added к SC.rules without manual edit)
- [ ] DA subagent invoked при BR/IC creation; output format matches refactored devils-advocate.md (Mode: adaptive, magnitude, classification_rationale, dual shape — abbreviated for cosmetic / 3-tier для significant)
- [ ] A1 auto-approve fires для at least one of LC/VC/RPM (depends on skill confidence + V-* checks)
- [ ] If A1 fires: notification format matches «✓ <ID> auto-approved... Type 'revert <ID>' to roll back»
- [ ] Decision journal в `.product/.decisions/journal.md` populated (DEC-AUTO-NNN entries для A1; DEC-PLAN-NNN для approved Strategic; DEC-CASCADE-NNN если cascade resolved)

**Possible findings:**
- If `feature-FM-001-progress.yaml` overwrites existing on switching FMs — DEC-DEV-0013 #1 violation (should be per-FM)
- If A1 fires when conditions actually fail — skill bug (B.1 / DEC-DEV-0011 lesson — surface via /product:meta-feedback)
- If DA subagent gets pre-classified «Magnitude:» от caller (instead of self-classifying) — A.1 spec drift regression
- If cascade-check auto-fixes V-11 on draft target — DEC-DEV-0013 #3 violation
- If decision journal не gets entries — Phase 3.B/3.C bug

---

### Test scenario 3: `/product:bg-review` (Phase 3.G)

```
> /product:bg-review
```

**Expected:**
- Read `.product/.pending/bg-candidates.yaml` (populated by hooks during scenarios 1-2)
- Phase 2 classification + Phase 3 batched presentation
- Per-term action options (Y/edit/reject/M/K/R)

**Acceptance:**
- [ ] Pending candidates surfaced
- [ ] After Y accept: BG entry appended к `.product/glossary.md`, term_count updated
- [ ] After reject: term added к `.product/.bg-rejected.yaml`

---

### Test scenario 4: `/product:cascade --pending` (Phase 3.G)

```
> /product:cascade --pending
```

**Expected:**
- Read `.product/.pending/cascade-pending.yaml`
- Group by triggered_by source
- Per entry: action options

**Acceptance:**
- [ ] Pending entries surfaced
- [ ] After resolution: entries removed from pending file
- [ ] Decision journal entry per resolution

---

### Test scenario 5: D2 overrides (Phase 3.F)

**Setup:** add `validation_overrides[]` к одному из artifacts (e.g., FM-001):

```yaml
---
id: FM-001
# ... existing fields ...
validation_overrides:
  - rule: V-02
    reason: "Pure navigation feature — logout flow"
    approved: true
---
```

Save the file.

**Expected:**
- `artifact-validate.js` parses validation_overrides[]
- V-02 finding (if applicable to FM-001) skipped from stderr surface
- Entry в `.product/.pending/validation-pending.yaml` со status: overridden + override_kind: validation + override_reason

**Acceptance:**
- [ ] Overridden findings logged со status: overridden (audit trail)
- [ ] expires_at check works для approve_overrides (test by setting past date — finding should re-surface)

---

## Reporting findings

After real run completion, populate retroactive DEV_JOURNAL entry:

```markdown
## DEC-DEV-NNNN — Phase 3 smoke test results (real run on my-first-test)

Date: <ISO>
Trigger: Per Phase 3.I plan (dev/PHASE_3_SMOKE_TEST_PLAN.md)
Tag: #pilot-finding #validation

### Context
[Per Phase 3.I goal]

### Outcome
- Test scenario 1 (/product:plan): <pass | partial | fail с findings>
- Test scenario 2 (/product:feature FM-001): <pass | partial | fail>
- Test scenario 3 (/product:bg-review): <pass | partial | fail>
- Test scenario 4 (/product:cascade): <pass | partial | fail>
- Test scenario 5 (D2 overrides): <pass | partial | fail>

### Findings
1. [Specific finding с evidence]
2. ...

### Lessons
- [Generalized takeaway]
- ...

### Next
- [Phase 4 / fix list / pivot if major]
```

---

## Done criteria

Smoke test passes when:
- [ ] All 5 test scenarios run к completion (allowing graceful skip placeholders)
- [ ] No regressions on Phase 2 (DEC-DEV-0008 quality maintained)
- [ ] No B.1 frontmatter convention violations (canonical field names exact)
- [ ] DA orchestration flow works (hook → stderr → orchestrator → subagent → findings)
- [ ] A1 auto-approve fires correctly где expected
- [ ] Decision journal accumulates correctly
- [ ] Cascade detection produces actionable pending entries

If 4+ scenarios pass — Phase 3 ships. Findings → Phase 4 readiness checklist.
