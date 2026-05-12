---
description: P2 Feature Definition orchestrator (F.0-F.10). Manages enrichment mode (FM-id) and creation mode ("idea"). Per-FM session state, A1 auto-approve flow для 🟢 skills, DA orchestration via stderr signals, cascade handling.
---

> **User-facing output language:** Russian (per CLAUDE.md § Language and tone). Keep identifiers, file paths, commands/flags, technical terms, abbreviations, and code blocks verbatim — don't translate or inflect them.

# Feature Session — Orchestrator Skill

Used by `/product:feature`. Orchestrates **P2 Feature Definition** per `.claude/docs/pmo/processes.md §3.2` (P2.A enrichment + P2.B creation).

## Modes

The skill supports two modes determined by argument shape:

- **Enrichment mode (P2.A):** `/product:feature FM-001` — FM skeleton already exists в `planned` status (created during Phase 3.A `/product:plan` D1.8); flow starts at F.1.
- **Creation mode (P2.B):** `/product:feature "<idea description>"` — no FM exists; flow starts at F.0 (idea parsing) → F.0a (D1-alignment) → F.0b (skeleton creation), then continues с F.1.

Mode detection happens in command (parse `$ARGUMENTS`), passed in invocation context.

## Prerequisites

**Enrichment mode:**
- `<FM-id>.md` exists в `.product/features/`
- FM.status = `planned` (skeleton; not in-progress yet)
- All FM.frontmatter.* fields filled per skeleton schema (per [release-planning.md Phase B](release-planning.md))

**Creation mode:**
- ≥1 SEG active (для F.0a alignment)
- ≥1 VP active
- ≥1 HYP в testing (для optional FM.hypotheses link)

## Flow

### F.0 Idea parsing (creation mode only)

Parse user's idea description. Extract:
- What feature does (high-level)
- For whom (segment hints)
- Why (potential JTBD/HYP hints)

Don't draft FM yet. Surface understanding to user — «Let me restate: you want <X> for <Y> to solve <Z>. Right?»

### F.0a D1-alignment check (creation mode only — per DEC-DEV-0013 #5)

**Goal:** verify feature aligns с existing D1 (SEG/VP/HYP) или explicitly flag as new SEG/exploratory.

**Process:**
1. Read all SEG-* в `.product/segments/`
2. AI proposes top-2 SEG candidates с rationale:
   ```
   D1-alignment check для proposed feature:

   Top match candidates:
     [1] SEG-001 (solo-creators) — match because <reason: feature solves JTBD-1.2 mentioned в SEG body>
     [2] SEG-002 (edu-centers) — partial match because <reason: similar pain but different scale>

   Options:
     [A] Use SEG-001 (best fit per matching JTBD)
     [B] Use SEG-002
     [C] Create new SEG via mini-D1.4 (mini segment-discovery flow — out-of-scope для текущего session)
     [D] Mark FM as exploratory (no required SEG, but won't validate any HYP either)
   ```
3. User confirms choice
4. **If [C]** — surface: «Mini-D1.4 not in scope текущего session. Suggest /product:init --add-segment (future feature) или create SEG manually then re-run /product:feature.»
5. **If [D]** — FM.priority = `could`; FM.hypotheses = []; flag в confidence_notes

### F.0b FM skeleton creation (creation mode only)

Per [release-planning.md Phase B](release-planning.md) skeleton template:
- Assign next available FM-NNN ID (read existing `.product/features/`)
- Fill skeleton fields (segment from F.0a, jtbd/hypotheses from dialogue, has_ui dialogue)
- Body: Why / What (brief) / Priority rationale / Success metric

Approve skeleton (per-FM Strategic gate per release-planning.md). After approve → FM status=planned.

Then continue с F.1 (enrichment).

### F.1 Load FM context

Read FM frontmatter + body. Surface к user:

```
Enriching FM-<NNN>: <title>
  - Segment: SEG-<NNN> (<title>)
  - JTBDs: [JTBD-X.Y, ...]
  - Hypotheses: [HYP-<NNN>, ...]
  - VP: VP-<NNN>
  - Release: RL-<NNN>
  - Priority: <must|should|could>
  - Has UI: <true|false>
  - Success metric: <text>

Starting F.2 Scenario Authoring.
```

If `has_ui=true` — note: «Will trigger F.8 Design Module step (placeholder в Phase 3 — manual fallback) after F.7.»

If FM.requires_nfr=true OR FM body содержит high-risk keywords (payments, PII, real-time, billing, public API, concurrent editing) — note: «Will trigger F.5a NFR Review step (Phase 4 implementation per DEC-DEV-0028 D.2 — Ask mandatory + Define conditional).»

### F.2 Scenario Authoring → SC-* approve

Load `.claude/skills/product/scenario-authoring.md`.

Skill produces 2-4 SC-* drafts (main / alternative / error flows separately). Per-SC approve (🟠 Strategic).

After per-SC approve:
- SC status → active, version: 1
- Update FM.scenarios[] += SC-NNN (bi-dir consistency, V-11)
- BG extraction queued

### F.3 Business Rule Extraction → BR-* approve

Load `.claude/skills/product/business-rule-extraction.md`.

Skill extracts implicit rules from active SC steps. Per-BR approve (🔴 Critical):
- Per-BR DA triggered automatically via `br-change-trigger.js` hook (Phase 3.E)
- **DA orchestration** (per DEC-DEV-0013 #8 — see «DA orchestration flow» section below)
- Per-BR approve requires DA findings resolved (act / defer / dismiss with rationale)

After per-BR approve:
- BR status → active, version: 1
- Update FM.rules[] += BR-NNN
- Update SC.rules[] for related SC (V-11 bi-dir)
- BG extraction queued
- Cascade-check.js (Phase 3.E) auto-runs

### F.4 Lifecycle Derivation → LC-* (🟢 Confirmation, A1 auto-approve eligible)

Load `.claude/skills/product/lifecycle-derivation.md`.

Skill derives LC per entity from SC transitions + BR guards. **A1 auto-approve eligible** (per DEC-DEV-0013 #2 + #7):

**A1 conditions для LC (skill self-checks):**
- `confidence: high`
- `confidence_notes` non-empty
- V-05 passed (all states reachable from initial via parsed transitions)
- V-06 passed (all transitions have trigger or guard)

**If all met:** skill writes LC status=active directly + decision journal entry; orchestrator surfaces conversational notification:

```
✓ LC-002 (Revision lifecycle) auto-approved
   Confidence: high
   Conditions: V-05 + V-06 passed; states reachable; transitions trigger/guard'd
   Rationale: <skill-provided>

   Type 'revert LC-002' to roll back в draft (cascade откатится тоже).
```

**If any condition fails:** standard 🟢 Confirmation gate (human confirms derivation).

### F.5 Invariant Discovery → IC-* approve

Load `.claude/skills/product/invariant-discovery.md`.

Skill proposes IC candidates from BR + LC. Per-IC approve (🔴 Critical):
- Per-IC DA triggered automatically via `ic-change-trigger.js` hook (Phase 3.E)
- DA orchestration (см. ниже)
- Per-IC approve requires DA findings resolved

After per-IC approve:
- IC status → active
- Update FM.invariants[] += IC-NNN
- Update BR.invariants[] for supporting BRs (V-11)

### F.5a NFR Review (Phase 4 — DEC-DEV-0028 D.2)

Two-phase NFR Review per `.claude/docs/pmo/processes.md §3.2`:
- **F.5a.0 Ask (mandatory):** «Есть ли у этой FM measurable NFR? [Y/N/D]»
- **F.5a.1 Define (conditional on [Y]):** create NFR-NNN artifacts с sanity range checks per [`docs/pmo/artifacts/NFR.md §5`](../../docs/pmo/artifacts/NFR.md)

Load skill `.claude/skills/product/nfr-review.md` для full methodology.

**Inline invocation (during feature enrichment, after F.5):**
- Skill auto-consumes NOTE-NNN с `promote_target: NFR` queue для current FM (DEC-DEV-0023 F8 Q4 NOTE creation guidance)
- High-risk auto-detect surfaces warning если FM body contains keywords (payments, PII, billing, real-time, public API, concurrent editing) OR `FM.requires_nfr=true`
- Tier auto-detected per Ambiguity 10 fallback chain (`RM.current_phase` → `product.yaml.product_tier` → MVP default); surface к user для confirmation, не silent fallback
- F.5a.1 per-NFR creation + sanity range warning (informational, **не block** per DEC-DEV-0025 C.2) + per-NFR Strategic approve gate
- Atomic FM update: `nfr_status` + (`nfr_decline_reason` | `nfr[]`) + `nfr_reviewed_at` + `version++` (per Ambiguity 25)

**Standalone invocation (re-trigger after FM enrichment complete или при tier change):**
- `/product:nfr-review FM-<NNN>` — post-enrichment review (если skipped inline)
- `/product:nfr-upgrade-tier <new-tier>` — batch re-review при product tier change (MVP→MMP etc)

**Outcome:**
- `FM.nfr_status: active | declined` (no longer `pending` after Ask answer accepted)
- Decision journal entry `DEC-NFR-NNN` recorded per skill template
- Continue к F.6 VC Derivation (VC inputs могут include NFR-derived acceptance criteria если `nfr_status: active`)

### F.6 Verification Criteria → VC-* (🟢 Confirmation, A1 auto-approve eligible)

Load `.claude/skills/product/vc-derivation.md`.

Skill generates VC from SC + BR + LC + (NFR если active, иначе skip NFR-derived VCs). **A1 auto-approve eligible:**

**A1 conditions для VC (skill self-checks):**
- `confidence: high`
- `confidence_notes` non-empty
- V-07 passed (count: VC covers main + alt + error flows of related SC.flow_type)

**If all met:** auto-approve + notification (per F.4 pattern). Else: 🟢 standard gate.

### F.7 RPM Update → RPM (🟢 Confirmation, A1 auto-approve eligible)

Load `.claude/skills/product/rpm-derivation.md`.

Skill updates RPM с new actors / actions from active SC + authorization BR. **A1 auto-approve eligible:**

**A1 conditions для RPM (skill self-checks):**
- `confidence: high`
- `confidence_notes` non-empty
- V-11 passed (RPM.roles[] bi-dir с SC.actors; new actions all match SC steps; conditional permissions reference active BRs)

**If all met:** auto-approve + notification.

### F.8 Design Module → PLACEHOLDER (Phase 6)

**Skipped в Phase 3 implementation** per ROADMAP / Phase 6 conditional activation.

Surface к user:

```
F.8 Design Module step skipped в Phase 3.

If FM.has_ui=true:
  - Phase 6 (Design Module) активируется conditionally on first FM с has_ui=true
  - Placeholder: для текущей FM, MK-* (Mockup Package) creation deferred
  - Manual fallback: human может create mockups externally and reference в FM
  
Continuing к F.9 Product DA Review (placeholder Phase 4).
```

### F.9 Product DA Review → PLACEHOLDER (Phase 4)

**Skipped в Phase 3 implementation** per ROADMAP.

Note: per-BR / per-IC DA already triggered автоматически via Phase 3.E hooks (adaptive-depth model — DEC-DEV-0012). F.9 — это explicit FM-level review предпрод-handoff. В Phase 3 нет manual /product:da-review command.

Surface к user:

```
F.9 FM-level Product DA Review skipped в Phase 3 (planned Phase 4).

Per-BR + per-IC DA reviews already happened automatically via adaptive-depth
hooks (Phase 3.E). Findings written to .product/.da-findings/.

For FM-level pre-handoff DA — wait для /product:da-review FM-<NNN>
command в Phase 4.

Continuing к F.10 FM status transition.
```

### F.10 FM status transition planned → in-progress

**Verify all blocking conditions:**
- All FM.scenarios[] in active
- All FM.rules[] in active (with DA findings resolved)
- All FM.lifecycles[] in active
- All FM.verification[] in active
- All FM.invariants[] in active (with DA findings resolved)
- RPM updated for new actors/actions if any

**If has_ui=true:**
- FM.mockups[] should have ≥1 MK in active — но Phase 6 placeholder, так что в Phase 3 surface warning: «Has UI but mockups missing — Phase 6 not implemented; FM transition allowed but handoff readiness will require mockups when /product:handoff Phase 4 lands.»

**If all conditions met:**
- FM status → in-progress
- version++
- Decision journal entry: «DEC-PLAN-NNN — FM-<NNN> transitioned planned → in-progress (P2.A enrichment complete)»
- Update feature-progress.yaml.current_step → complete

**Completion summary:**

```
P2 Feature Definition complete для FM-<NNN>: <title>.

Artifacts created/updated:
  ✓ FM-<NNN>: planned → in-progress
  ✓ SC-XXX..XXX (<N> scenarios, all active)
  ✓ BR-XXX..XXX (<N> rules, all active, DA reviewed)
  ✓ LC-XXX..XXX (<N> lifecycles, all active)
  ✓ VC-XXX..XXX (<N> verification criteria)
  ✓ IC-XXX..XXX (<N> invariants, DA reviewed)
  ✓ RPM updated (+<N> actors, +<N> actions)
  ✓ BG candidates queued: <N>

Skipped (Phase 3 placeholders):
  ⊘ F.5a NFR Review (Phase 4)
  ⊘ F.8 Design Module (Phase 6)
  ⊘ F.9 FM-level DA Review (Phase 4)

Next:
  /product:feature FM-<other> — enrich next planned FM
  /product:status — view dashboard
  (Phase 4 будущее: /product:handoff FM-<NNN> для handoff generation)
```

## Deferral capture — NOTE creation guidance (DEC-DEV-0023)

When F.2-F.5 surfaces что-то out-of-scope для current FM / RL — это становится `NOTE-NNN` artifact с `promote_target` field, picking up в RL-NN+1 planning. Critical для traceability + future-proofing.

### `promote_target` decision tree

Before writing NOTE, classify nature of deferred item — это determines `promote_target`:

| Item nature | Examples (my-first-test pilot) | promote_target | Why |
|---|---|---|---|
| **Sub-feature with own UX/SC surface** | "Edit profile" flow (NOTE-002), "2FA" (NOTE-003), "Logout-all-sessions admin tool" (NOTE-005) | **FM** | Stand-alone feature; needs own SC/BR/UX в future RL |
| **New rule modifying existing flow** | "OAuth-vs-email account merge logic" (NOTE-004 placeholder), "Hard account lockout policy" (NOTE-001) | **BR** | Modifies existing FM behavior; не stand-alone |
| **Cross-cutting non-functional concern** | Throughput targets, latency budgets, security compliance (e.g., GDPR data export), accessibility AAA, retention policies | **NFR** | Quality attribute, не functional behavior; F.5a Phase 4 review handles |
| **Open hypothesis / market question** | "Pivot pricing к freemium tier", "Test SEG-002 in late RL-002" | **HYP** | Empirical question requiring measurement |
| **Domain insight без actionable form** | Competitor observation, user-interview anecdote | (no promote — keep as NOTE forever) | Idea-capture, не decision |

### NFR vs FM — common confusion (security territory)

Security-related deferrals часто looks like FM-candidates но actually fit NFR better. Heuristic:

- **«User does X» в the deferred item description** → FM (functional)  
  Example: "User can log out from all devices" → FM-NNN (account management feature)

- **«System enforces X» / «Property holds X»** → NFR or BR  
  Example: "After N failed logins, account locks for 1 hour" → BR (rule modifying SC-002e1) или NFR (security control)
  - If the item is parameterized rule с specific behavior → BR
  - If the item is qualitative property («account must be reasonably protected against brute force») → NFR

- **Compliance / regulatory** → NFR by default  
  Example: "GDPR data export within 72 hours" → NFR (regulatory quality attribute), trigger F.5a

### Confidence-of-placement field

Если AI unsure, encode uncertainty in NOTE:
```yaml
promote_target_confidence: medium
promote_target_alternative: NFR  # альтернативный target если в planning RL-NN+1 reconsider
```

Then planning skill для RL-NN+1 surfaces к user: «NOTE-001 promote_target=BR с medium confidence; consider NFR alternative.»

### Pain origin

my-first-test pilot создал 5 NOTE'ов, все с `promote_target: FM | BR`. NOTE-001 (hard lockout) и NOTE-003 (2FA) — security territory; могли быть NFR кандидаты. AI правильно flagged для RL-002, но без NFR-vs-FM placement decision. Codified guard здесь обеспечивает explicit consideration.

---

## DA orchestration flow (per DEC-DEV-0013 #8)

After each BR or IC active write, hook (`br-change-trigger.js` или `ic-change-trigger.js`, Phase 3.E) автоматически runs:

1. Hook detects change → writes `.product/.pending/da-pending.yaml` entry с artifact id + git diff
2. Hook outputs stderr signal: «DA review pending for <ARTIFACT-ID> (mode: adaptive). See .product/.pending/da-pending.yaml.»
3. **Orchestrator (этот skill)** reads stderr from tool result → sees pending DA notification
4. Orchestrator immediately spawns `product-devils-advocate` subagent via Agent tool с brief:
   ```
   Mode: adaptive
   Artifact(s) under review: <BR-NNN | IC-NNN>
   Trigger: P-RULE-01 | P-RULE-02 (hook)
   Diff (for adaptive mode): <git diff против HEAD — copied from da-pending.yaml entry>
   Context files to read: .product/business-rules/, .product/scenarios/, .product/lifecycles/, .product/glossary.md
   Project context: <stage from RM, tier from product.yaml.validation_tier, prior DA findings if any>
   ```
5. Subagent (per refactored devils-advocate.md, DEC-DEV-0013 A.1):
   - Step 1 classify magnitude (cosmetic | significant)
   - Step 2 adapt depth (cosmetic → quick consistency check; significant → full 6-lens)
   - Single LLM invocation (no double call)
6. Subagent writes findings to `.product/.da-findings/<artifact-id>-<YYYY-MM-DD>-<HHMM>.md`
7. Orchestrator reads findings → presents к user в approve gate:

   ```
   DA review complete для BR-<NNN> (magnitude: <cosmetic|significant>):
     <Classification rationale>
   
   Findings (<count>):
     🔴 Critical: <N>
     🟡 Important: <N>
     🔵 Discussion: <N>
   
   Per-finding action: act / defer / dismiss (with rationale).
   
   Once findings resolved, BR-<NNN> can transition to active.
   ```

8. User decides per finding:
   - **Act:** modify related artifact, journal entry «addressed DA finding X by Y»
   - **Defer:** add to FM Out of Scope или Roadmap; journal entry с rationale
   - **Dismiss:** explicit rationale required (anti-sycophancy mechanism); journal entry

9. After all critical findings resolved → BR/IC status → active

**Important:** orchestrator не блокирует workflow если DA findings всё 🔵 Discussion (no critical/important). Auto-passes to active с notification.

### Structured DA findings format в decision journal (DEC-DEV-0023)

When orchestrator writes `DEC-PLAN-NNN` или `DEC-AUTO-NNN` entry summarizing F.3 / F.5 batch approve, **DA findings MUST be embedded structurally** (не free-text). Schema:

```yaml
da_findings:
  - id: I1                                      # short local id (sequential per session)
    severity: critical | important | discussion # per devils-advocate.md classification
    artifact_ref: BR-008                        # what this finding is about
    statement: >
      <one-line statement of finding>
    resolution: accepted | acted | deferred | dismissed
    follow_up:
      - action: <what done / what scheduled>
        target_artifact: BR-008 | NOTE-005 | none   # where action lands
        revisit_trigger: <metric / event / condition that triggers revisit>
        revisit_window: <when, e.g., "RL-002 planning" / "if >1% events / month">
```

**Required for accepted и deferred resolutions** — without `revisit_trigger`, "accepted" silently becomes "forgotten." For acted resolutions — `revisit_trigger` optional (action already taken). For dismissed — rationale в `statement` field overrides need для revisit (decision is final).

**Pain origin:** my-first-test DEC-PLAN-006 had 4 important findings + 5 discussion findings as free-text. Trace-friendly но не machine-readable; future agent захочет re-validate I4 «BR-011 resend rate-limit blocked >1% events» — нет structured query path. Codification обеспечивает trigger reproducibility.

**Example (rendered from my-first-test DEC-PLAN-006):**

```yaml
da_findings:
  - id: I1
    severity: important
    artifact_ref: BR-008
    statement: BR-008 (duplicate-email explicit messaging) asymmetric с BR-016/020 anti-enumeration
    resolution: accepted
    follow_up:
      - action: documented в BR-008 confidence_notes; periodic review
        target_artifact: BR-008
        revisit_trigger: enumeration attack signal в logs OR security audit finding
        revisit_window: RL-002 planning OR triggered by signal
  - id: I3
    severity: important
    artifact_ref: BR-014
    statement: race condition concurrent logins при count=5 boundary
    resolution: acted
    follow_up:
      - action: added DB row-lock requirement к BR-014 body (`SELECT ... FOR UPDATE`)
        target_artifact: BR-014
```

## A1 auto-approve flow (per DEC-DEV-0013 #2 + #7)

For 🟢 Confirmation skills (LC, VC, RPM):

1. Skill self-assesses confidence + checks tier-applicable V-* internally
2. **If all conditions met** (confidence: high + confidence_notes + applicable V-* passed):
   - Skill writes status=active directly (skips human approve gate)
   - Skill creates `.product/.decisions/journal.md` entry если не exists; appends `DEC-AUTO-NNN` entry per DEC-DEV-0013 #9 format
   - Skill returns «auto-approved» signal к orchestrator
3. **Orchestrator surfaces notification к user:**
   ```
   ✓ <ARTIFACT-ID> auto-approved
     Confidence: high
     Conditions met: <V-* list>
     Rationale: <skill-provided one-paragraph>
   
     Type 'revert <ARTIFACT-ID>' в conversation to roll back в draft.
     (Cascade dependents will also revert.)
   ```
4. **Revert command:** if user types «revert <ARTIFACT-ID>» — orchestrator:
   - Reads `.product/.decisions/journal.md` entry
   - Sets artifact status=draft, version++
   - Triggers cascade-check (downstream dependents go to requires_review)
   - Adds revert entry в journal

**If any A1 condition fails:** standard 🟢 Confirmation gate (orchestrator presents derivation, human confirms). No auto-write.

## Cascade handling

After each artifact transition to active:
- `cascade-check.js` (Phase 3.E) hook auto-runs
- V-11 (bi-dir refs) auto-fixes inline (e.g., adds missing reverse ref)
- Other affected dependents → entries в `.product/.pending/cascade-pending.yaml`

**Orchestrator behavior:**
- Reads cascade-pending.yaml after each active transition
- If new entries: surfaces summary к user — «Cascade detected N dependents requires_review. Review now? [Y/N]»
- If user [Y]: invoke `/product:cascade <artifact-id>` flow inline
- If user [N]: continue с current step, cascade entries persist для later review

**Quiet draft mode (B2):** если target артефакт draft — cascade-check skips auto-fix, queues only (per DEC-DEV-0013 #3).

## Session state management

Feature Session uses **two files** (per DEC-DEV-0009 pattern + DEC-DEV-0013 #1):

### 1. `current.yaml` — managed by `session-state.js` hook

Pre-initialized by `/product:feature` command (Step 3b) с `type: feature-session` + `feature_id: FM-<NNN>` + `started_at`. Hook subsequently updates last_artifact_*, edits_since_start, recent_artifacts на каждый Write/Edit.

### 2. `feature-<FM-id>-progress.yaml` — managed by этим skill (per-FM)

**Path:** `.product/.sessions/feature-<FM-id>-progress.yaml`.

**Per-FM file** (per DEC-DEV-0013 #1) — switching между FMs не overwrite'ит progress:
- `/product:feature FM-001` создаёт `feature-FM-001-progress.yaml`
- `/product:feature FM-002` создаёт `feature-FM-002-progress.yaml`
- `current.yaml` tracks last-touched id для `--continue` defaults

**Schema:**

```yaml
session_id: "<same as current.yaml>"
type: feature-session
feature_id: FM-<NNN>
mode: enrichment | creation
started_at: <ISO timestamp>
project: <project_name>
language: <from product.yaml>

current_step: F.0 | F.0a | F.0b | F.1 | F.2 | F.3 | F.4 | F.5 | F.5a | F.6 | F.7 | F.8 | F.9 | F.10 | complete
last_completed_step: <prior step or null>

last_approved_artifacts:
  - id: SC-005
    type: scenario
    confidence: high
    approved_at: YYYY-MM-DD
    auto_approved: false
  - id: LC-002
    type: lifecycle
    confidence: high
    approved_at: YYYY-MM-DD
    auto_approved: true                # A1 auto-approve flag
  # ...

pending_da_findings:                   # DA findings awaiting resolution
  - artifact: BR-010
    findings_file: .product/.da-findings/BR-010-2026-04-26-1530.md
    critical_count: 1
    important_count: 2
    discussion_count: 0
  # ...

pending_cascade_entries: <count>       # from cascade-pending.yaml
bg_candidates_queued: <count>

next_steps:
  - <description of immediate next action>

progress_percent: <0-100>
```

**Update protocol** (atomicity per DEC-DEV-0010 lesson):
1. Read existing feature-<FM-id>-progress.yaml
2. Modify только need-to-update fields
3. Write back

**Update points:** after each F.* step approve. См. DA orchestration / A1 flow для interaction sequencing.

**Recovery:** на `--continue <FM-id>` orchestrator reads `feature-<FM-id>-progress.yaml` → resumes c `current_step`.

If current.yaml.last_touched matches FM — `--continue` без arg works default. Иначе ask: «Continue FM-001 (last touched) or specify other FM?»

## Confidence articulation (C2)

At each non-auto-approve gate:

```
<Artifact> draft ready для approve.

Confidence: <high | medium | low>
Rationale: <one paragraph — what's solid vs what's assumed>

Approve? [Y/N/edit]
```

For 🔴 Critical (BR/IC) — append:

```
DA findings (<count>):
  🔴 Critical: <N> — must resolve
  🟡 Important: <N> — should resolve
  🔵 Discussion: <N> — optional

Resolve findings before approve.
```

## Error handling

| Error | Recovery |
|---|---|
| FM-id не существует (enrichment mode) | Refuse, list available planned FMs from `.product/features/` |
| FM.status != planned (enrichment mode) | Surface: «FM-<NNN> already <status>; cannot re-enrich. Use /product:cascade if changes needed.» |
| Discovery prereq missing (creation mode) | Refuse, suggest /product:init first |
| F.0a no SEG candidate matches | Offer [C] new SEG (out-of-scope текущ session) или [D] exploratory |
| User rejects all DA critical findings без act/defer/dismiss | Refuse approve; require explicit per-finding action |
| Hook stderr unparseable (DA orchestration) | Log error, continue без auto-DA; surface к user — «DA hook may have failed; consider manual review» |
| Subagent invocation fails (Agent tool error) | Surface к user; offer manual continue или retry |
| feature-progress.yaml corrupted on --continue | Recovery options similar to discovery-session.md / planning-session.md |
| User interrupts mid-step | Save partial progress; --continue resumes |

## Anti-patterns

1. **Skipping F.0a в creation mode.** D1-alignment critical — feature без SEG link создаёт orphan FM. Always run F.0a, even если seems obvious.
2. **Bundle approve для critical artifacts.** Per-BR / per-IC approve mandatory (Critical level decisions). Не bundle.
3. **Auto-approve без A1 conditions check.** A1 — skill self-check responsibility, не orchestrator. Если skill says «approved high confidence», orchestrator trusts but verifies через journal entry. If conditions actually fail — это skill bug, escalate via meta-feedback.
4. **DA findings dismiss без journal entry.** Anti-sycophancy mechanism per devils-advocate.md — dismissed findings всегда recorded с rationale.
5. **Touching FM.status manually.** Status transitions должны быть orchestrator-driven (planned → in-progress только в F.10 после all conditions met). Не allow user to skip ahead.
6. **F.5a / F.8 / F.9 implementing inline.** Phase 4 / Phase 6 work — surface placeholder, не attempt inline. Discipline.
7. **Drift в feature-progress.yaml.** Atomicity per DEC-DEV-0010 — read-modify-write, не overwrite.
8. **Spawn subagent не на adaptive mode.** Hook-triggered DA — always Mode: adaptive (per DEC-DEV-0013 #8 + refactored devils-advocate.md). Mode: full только для manual /product:da-review (Phase 4).

## Related

- [`scenario-authoring.md`](scenario-authoring.md) — F.2 step (Phase 3.C)
- [`business-rule-extraction.md`](business-rule-extraction.md) — F.3 step (Phase 3.C)
- [`lifecycle-derivation.md`](lifecycle-derivation.md) — F.4 step (Phase 3.C; A1 eligible)
- [`invariant-discovery.md`](invariant-discovery.md) — F.5 step (Phase 3.C)
- [`vc-derivation.md`](vc-derivation.md) — F.6 step (Phase 3.C; A1 eligible)
- [`rpm-derivation.md`](rpm-derivation.md) — F.7 step (Phase 3.C; A1 eligible)
- Companion command: [`commands/product/feature.md`](../../commands/product/feature.md)
- Subagent: [`agents/product/devils-advocate.md`](../../agents/product/devils-advocate.md) (refactored adaptive-depth)
- Hooks: [`hooks/product/br-change-trigger.js`](../../hooks/product/br-change-trigger.js), [`hooks/product/ic-change-trigger.js`](../../hooks/product/ic-change-trigger.js), [`hooks/product/cascade-check.js`](../../hooks/product/cascade-check.js) (Phase 3.E)
- Process: [docs/pmo/processes.md §3.2 P2 Feature Definition](../../docs/pmo/processes.md)
- Predecessor: P1.B Planning via `/product:plan` (Phase 3.A)
- Future: `/product:handoff <FM-id>` Phase 4
