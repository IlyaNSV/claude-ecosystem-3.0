---
description: Generate self-contained handoff для FM-NNN — 13-section markdown с embedded artifact excerpts + SHA-256 hashes для drift detection. Mode-aware DoR (--mode production 8 blockers; --mode draft 3 blockers per handoff-spec §7). approve_overrides[] handling (D2). Uses hooks/product/lib/hash.js (body-only, LF-normalized, cross-platform). Phase 4 per DEC-DEV-0025 C.1 + DEC-DEV-0028 D.1.
---

# Handoff Generator — Phase 4 skill

Loaded by `/product:handoff <FM-id> [flags]`. Produces `.product/handoffs/FM-<NNN>-handoff.md` — universal snapshot для external implementation tool через adapter (Integrator Phase 5+).

## Purpose

Per [handoff-spec.md §1](../../docs/product-module/handoff-spec.md): self-contained snapshot фичи с embedded excerpts всех relevant артефактов, SHA-256 hashes per артефакт для drift detection, mode-aware Definition of Ready.

**Не делает:**
- Не заменяет `.product/` (это snapshot, не source of truth)
- Не специфицирует стек / реализацию
- Не передаёт между внешними инструментами (это работа adapter в Integrator Phase 5+)

## Input

- `FM-<NNN>` — must exist в `.product/features/`
- `FM.status: in-progress` или `shipped` (per V-H-* B1 blocker)
- All FM dependencies (SC, BR, LC, VC, IC, MK если has_ui, RPM, NFR если active) в required states (см. DoR §7)
- `.claude/product.yaml` для validation_tier

## Output

`.product/handoffs/FM-<NNN>-handoff.md`:
- Frontmatter per [handoff-spec.md §5](../../docs/product-module/handoff-spec.md)
- Body 13 sections per handoff-spec.md §6

Versions preserved в git (no manual archiving).

## Modes (per DEC-DEV-0028 D.1 + handoff-spec.md §7)

### `--mode production` (default)

Full DoR: 8 blockers required (B1-B8 per handoff-spec.md §7.1):

| # | Condition | Source |
|---|---|---|
| B1 | `FM.status == in-progress` (или shipped) | FM frontmatter |
| B2 | ≥1 SC в `status: active` | scenarios list |
| B3 | Все BR, упомянутые в embedded SC, в `status: active` | cross-check |
| B4 | Для каждого SC ≥1 VC в `status: active` | VC coverage |
| B5 | BG содержит все bold terms из embedded artifacts | extraction check |
| B6 | V-01..V-11 passed (per validation-runner.md) | validation run |
| B7 | Если has_ui=true — ≥1 MK активный + NM для main flows | UI check |
| B8 | RPM содержит все роли из SC.actors | RPM check |

→ `status: ready` если все passed + W1-W6 acceptable; `partial` если warnings; `blocked` если failure → no file written.

### `--mode draft` (PoC / early experiments)

Relaxed DoR: 3 blockers required — B1, B2, B5. Остальные → warnings.

→ Always `status: partial`; `mode: draft` в frontmatter; body имеет «⚠ Draft Mode Warnings» section перед §1 listing missed blockers.

**Per Ambiguity 12 / DEC-DEV-0030:** draft mode never produces `ready` status даже если все B1-B8 passed. Mode сам по себе marker — explicit experimental snapshot.

**Per Ambiguity 13 / DEC-DEV-0030:** `--mode production` НЕ auto-downgrades к draft. Если production DoR fails → `status: blocked`, file НЕ generated, surface missing blockers к user. User explicitly re-invokes с `--mode draft` если хочет experimental snapshot.

## Args

- `<FM-id>` — required (e.g., `FM-001`)
- `--mode draft | production` — default `production`
- `--regenerate` — force version++ даже без drift (per Ambiguity 14)
- `--with-da-review` — invoke `/product:da-review FM-<NNN>` перед generation (Phase 4.H deliverable — DEC-DEV-0026 hybrid trigger)
- **RL-NNN bundle handoff:** Phase 4 ships FM-NNN scope only; RL bundle deferred к v1.1+ (per handoff-spec.md §14 Open Extensions)

## Process

### Step 1: Parse args + verify prerequisites

- FM-id matches `^FM-\d{3}$`
- File `.product/features/<FM-id>-*.md` exists (glob)
- Project bootstrapped (`.claude/product.yaml`)

Если prerequisite fails — refuse early с suggestion.

### Step 2: Load FM frontmatter

Parse FM.frontmatter (через Read + manual YAML parse):
- `status` (must be `in-progress` или `shipped` — B1)
- `scenarios[]`, `rules[]`, `lifecycles[]`, `verification[]`, `invariants[]` — embedded refs
- `mockups[]` если `has_ui=true`
- `segment`, `value_proposition`, `hypotheses[]`, `release` — context section refs
- `nfr_status`, `nfr[]`, `nfr_decline_reason`, `nfr_reviewed_at` — для §11
- `has_ui` — для §10 conditional
- `approve_overrides[]` — для D2 handling (если present)

### Step 3: Drift detection (если file exists)

Если `.product/handoffs/FM-<NNN>-handoff.md` already exists:
1. Read existing handoff frontmatter `artifact_hashes`
2. Re-compute current hashes per `hooks/product/lib/hash.js computeArtifactHash` через Bash:
   ```bash
   node -e "const h=require('.claude/hooks/product/lib/hash.js'); console.log(h.computeArtifactHash('.product/features/FM-001-revisions-inbox.md'));"
   ```
3. Compare per artifact:
   - All match → no drift; если `--regenerate` not passed surface к user:
     ```
     HANDOFF-FM-001 v1 exists; no drift detected.
     Use --regenerate to force regeneration с version++.
     ```
   - Mismatch → list drifted artifacts:
     ```
     Drift detected для HANDOFF-FM-001 vs current .product/:
       SC-005: hash changed
       BR-010: hash changed
     
     Approve regeneration? [y/n]
     > y
     
     Generating HANDOFF-FM-001 v2 (previous v1 preserved в git).
     ```

Per Ambiguity 14 / DEC-DEV-0030: `--regenerate` force version++ даже без drift (user explicit intent).

### Step 4: `--with-da-review` handling (per DEC-DEV-0026 hybrid)

**Если `--with-da-review` flag passed:**
- Invoke `/product:da-review FM-<NNN>` (Phase 4.H deliverable: skill `product-da-review.md`)
- Wait DA findings written к `.product/.da-findings/FM-<NNN>-<timestamp>.md`
- Если 🔴 Critical findings unresolved → block generation, surface к user, refuse continue
- Иначе → continue к Step 5

**Иначе (default):** soft DoR warning (per DEC-DEV-0026 D.3 hybrid):
- Glob `.product/.da-findings/FM-<NNN>-*.md` (если directory exists)
- Найти most recent finding с `scope: feature` для этой FM
- Age check: > 7 days from now → warning:
  ```
  ⚠ Last FM-level DA review для FM-001: <date> (>7 days ago)
  Consider:
    /product:da-review FM-001                    # explicit pre-gen review
    /product:handoff FM-001 --with-da-review     # combined flow
  
  Continue без fresh DA? [y/n]
  ```
- < 7 days OR не exists fresh — proceed silent (но V-H-* B6 уже cover это conceptually)

**Phase 4.E placeholder note:** actual subagent invocation в Step 4 delegated к Phase 4.H skill. В sub-phase E: parse flag, age-check logic, surface warning; actual invocation TBD при Phase 4.H lands.

### Step 5: DoR validation per mode

Run V-H-* checks (re-using validation-runner.md skill V-H-* table inline conceptually):

Per mode:
- **production:** B1-B8 hard blockers + W1-W6 warnings (per handoff-spec.md §7.2)
- **draft:** B1, B2, B5 hard blockers; B3-B4, B6-B8 → warnings

Collect:
- `blocking_issues[]` — list of failed blockers (rule + artifact + reason)
- `warnings[]` — list of warnings
- `validation_rules_passed[]`, `validation_rules_failed[]`

**Если any blocking** → status: `blocked`; file NOT written; surface report:
```
Handoff generation для FM-001 blocked:

🔴 Blockers (2):
  B4: SC-005 not covered by VC (V-07 — main flow VC missing)
  B7: has_ui=true но 0 active MK

🟡 Warnings (1; would proceed but advisory):
  B6: V-08 — 3 bold terms в SC bodies не в BG (Revision batch, Project, Freelancer)

Fix blockers перед re-invoke.
Alternative: /product:handoff FM-001 --mode draft (3-blocker mode для PoC).
```

**Else** — continue.

### Step 6: `approve_overrides[]` handling (D2 modification + handoff-spec.md §7.3)

Per FM (и per embedded artifact с `approve_overrides[]`):
- Parse `approve_overrides[]` from frontmatter
- Per override entry:
  - `rule: V-H-NN` — blocker rule
  - `reason: "string"` — **required** rationale (refuse если empty)
  - `approved_by: human` (или AI per anti-sycophancy mechanism)
  - `approved_at: <ISO>`
  - `expires_at: <date>` — optional
- Per active override:
  - Если `expires_at` passed (today > expires_at) → treat as expired → blocker re-applies
  - Иначе → blocker считается passed для DoR; logged в handoff frontmatter:
    ```yaml
    dor_overrides:
      - artifact: FM-001
        rule: V-H-08
        reason: "PoC stage — UI added в v0.2"
        approved_by: human
        approved_at: <ISO>
    ```

### Step 7: Compute artifact hashes

Per embedded artifact (FM + всех SC из FM.scenarios[] + всех BR из FM.rules[] + LC + VC + IC + RPM если applicable + MK/NM если has_ui + NFR если nfr_status=active):

Use `hooks/product/lib/hash.js computeArtifactHash` через Bash:
```bash
node -e "
const h = require('.claude/hooks/product/lib/hash.js');
const files = [
  '.product/features/FM-001-revisions-inbox.md',
  '.product/scenarios/SC-005-revision-arrived.md',
  // ... all embedded
];
files.forEach(f => console.log(f + ': ' + h.computeArtifactHash(f)));
"
```

Или batch single invocation reading все files. Skill instructs orchestrator (Claude) execute через Bash tool.

Build `artifact_hashes` map:
```yaml
artifact_hashes:
  FM-001: "sha256:abc123...64chars"
  SC-005: "sha256:def456...64chars"
  BR-010: "sha256:..."
  # ... все embedded; full hex64 — НЕ truncate
```

**Per DEC-DEV-0025 C.1 + DEC-DEV-0030 user choice 2026-05-12:** content scope = body markdown **без frontmatter**. LF-normalized cross-platform. `hooks/product/lib/hash.js` — single source of truth алгоритма (skill — invariant doc; sub-phase F gate hook — same utility).

### Step 8: Generate body — 13 sections per handoff-spec.md §6

Sections в фиксированном порядке:

| # | Section | Required | Content |
|---|---|---|---|
| 1 | Executive Summary | MUST | FM title, SEG primary + JTBD, primary HYP с thresholds, RL, has_ui, dependencies, 2-3 sentence description |
| 2 | Business Context | MUST | FM full body + SEG excerpt + VP statement + HYP statement+thresholds |
| 3 | Terminology | MUST | BG excerpt filtered к terms used в embedded artifacts (table format) |
| 4 | Role & Permission Model | MUST | RPM filtered к roles в SC.actors + actions matrix |
| 5 | Scenarios | MUST | Full body всех SC из FM.scenarios[] |
| 6 | Business Rules | MUST | Full body всех BR из FM.rules[] |
| 7 | Entity Lifecycles | MUST | Full body всех LC из FM.lifecycles[] |
| 8 | Verification Criteria | MUST | Full body всех VC из FM.verification[] |
| 9 | Invariants | MUST | Full body всех IC из FM.invariants[] |
| 10 | UI Specification | CONDITIONAL (has_ui=true) | MK + DS snapshot + NM; иначе section omitted entirely |
| 11 | Non-Functional Requirements | MUST | Three cases per FM.nfr_status (см. Step 8b) |
| 12 | Dependencies & Context | MUST | Feature deps, external integrations, data assumptions, environment prerequisites |
| 13 | Out of Scope | MUST | Explicit list of NOT included items (или «ничего явно не excluded» если empty) |

Optional `14 Rollout Notes` + `15 Open Questions for Receiver` — только если applicable (typically RL-level handoff).

### Step 8b: NFR section three cases (per handoff-spec.md §6 Раздел 11)

#### Case A: FM.nfr_status = active

```markdown
## 11. Non-Functional Requirements

NFR Review conducted на <FM.nfr_reviewed_at>; <count> NFRs defined.

### NFR-<NNN>: <title>
[Full body content: Statement, Target value с tier rationale, Rationale,
Measurement method, Anti-target, Test strategy, Known tradeoffs, Tier
upgrade plan]

[Repeat per NFR в FM.nfr[]]

### Global NFRs applicable

[NFRs со scope: global; excerpts]

### Receiver guidance

- NFR targets — acceptance baselines для tier=<current_tier>, не enterprise SLA
- При невозможности достичь target → verify через /product:clarify с автором,
  не overpromise
```

#### Case B: FM.nfr_status = declined

```markdown
## 11. Non-Functional Requirements

**Status:** NFR Review explicitly declined для this feature (<FM.nfr_reviewed_at>).

**Rationale (from FM.nfr_decline_reason):** «<text>»

**Applicable defaults (<current_tier>):**
- Performance: <range from NFR.md §5 Performance × tier>
- Reliability: <range>
- Scalability: <range>
- Security: <range>
- Privacy: <range>

**Full sanity ranges:** see `.claude/docs/pmo/artifacts/NFR.md §5` (published с handoff).

**Receiver guidance:**
- Implement с tier defaults as baseline
- Flag any performance / reliability gaps к author через `/product:clarify`
- Do NOT silently over-engineer beyond defaults (e.g., add caching «just в case» без discussion)
```

#### Case C: FM.nfr_status = pending (warning)

```markdown
## 11. Non-Functional Requirements

⚠ **Status:** NFR Review was NOT conducted для this feature.

This is a known gap. Handoff proceeds с warning.

**Receiver guidance:**
- Apply most conservative MVP defaults from NFR.md §5
- Escalate back через `/product:clarify` если увидите critical concerns
- Author should run `/product:nfr-review FM-<NNN>` at next opportunity
```

→ Handoff frontmatter `warnings[]` adds NFR-pending entry; `status` = `partial` (не `ready`).
→ V-H-08 DoR check raises warning (per NFR opt-in philosophy, не блокирует даже в production mode).

### Step 9: Frontmatter assembly

Per handoff-spec.md §5 schema (полный):

```yaml
---
id: HANDOFF-FM-<NNN>
type: feature-handoff
feature: FM-<NNN>
title: "<FM title> — handoff"

status: ready | partial | blocked | stale
mode: production | draft
version: <N>
generated_at: <ISO>
generator: product-module-v<version>
dor_overrides:                          # если any approve_overrides applied
  - artifact: FM-001
    rule: V-H-08
    reason: "..."
    approved_by: human
    approved_at: <ISO>

dor_validation_passed: true | false
blocking_issues: []
warnings: []
validation_rules_passed: [V-H-01, V-H-02, ...]
validation_rules_failed: []

embedded_artifacts:
  feature: FM-<NNN>
  scenarios: [SC-...]
  business_rules: [BR-...]
  lifecycles: [LC-...]
  verifications: [VC-...]
  invariants: [IC-...]
  rpm_roles_excerpted: [R-...]
  bg_terms_excerpted: [Term, ...]
  mockup_packages: [MK-...]              # если has_ui
  navigation_maps: [NM-...]              # если has_ui
  design_system_tokens_snapshot: DS@v<N> # если has_ui
  nfr: [NFR-...]                          # если nfr_status=active

nfr_status: active | declined | pending
nfr_decline_reason: "..."                # если declined
current_product_tier: mvp                # для receiver context

artifact_hashes:
  FM-<NNN>: "sha256:<hex64>"
  SC-NNN: "sha256:<hex64>"
  # ... все embedded; full hex64

target_adapter: "universal"
target_tool: null
target_tool_version: null

previous_version: null | HANDOFF-FM-<NNN>-v<prev>
regenerated_from: "artifact_changes" | "manual" | "drift_detection"

created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

### Step 10: Write file

Ensure `.product/handoffs/` exists (mkdir -p):
```bash
mkdir -p .product/handoffs
```

Write `.product/handoffs/FM-<NNN>-handoff.md` (overwrite если existing — previous version preserved в git).

**Если status: blocked** (per Step 5) — DO NOT write file. Surface report only.

### Step 11: Surface результат к user

**Success (status: ready):**
```
Handoff generated: .product/handoffs/FM-001-handoff.md
  Mode: production
  Status: ready
  Version: 1
  Embedded: 7 SC, 12 BR, 1 LC, 5 VC, 2 IC, 1 MK, 1 NM, 2 NFR
  Hashes: 28 computed
  DoR overrides applied: 0
  V-H-* passed: 10/10 (V-H-04 not applicable, no drift)

Receiver ready. Adapter selection — Integrator Module (`/integrator:add <tool>` Phase 5+).
```

**Partial (warnings):**
```
Handoff generated: .product/handoffs/FM-001-handoff.md
  Mode: production
  Status: partial (3 warnings)
  ...
  Warnings:
    V-H-07: BG excerpt missing term "Revision batch"
    V-H-09: Dependencies section не mentions FM-002 prerequisite
  
Receiver consumable; warnings advisory.
```

**Draft mode:**
```
Handoff generated: .product/handoffs/FM-001-handoff.md
  Mode: draft (3-blocker DoR — experimental snapshot)
  Status: partial (always для draft)
  Embedded: 7 SC, 12 BR, 1 LC, 5 VC, 0 IC (missing), ...
  Hashes: 25 computed
  
⚠ Draft mode warnings:
  B6: V-04 — SC-005 references FM-001 not yet in-progress
  B7: has_ui=true но 0 active MK
  B8: RPM missing role R-system-scheduler
  
Re-invoke /product:handoff FM-001 (production mode) when ready для full DoR.
```

**Blocked:**
```
Handoff blocked: .product/handoffs/FM-001-handoff.md NOT written.
  Mode: production
  Status: blocked
  Blockers (2):
    B4: SC-005 not covered by VC
    B7: has_ui=true но 0 active MK
  Warnings: 1
  
Fix blockers, then re-invoke.
Alternative: /product:handoff FM-001 --mode draft (relaxed DoR для PoC).
```

## Anti-patterns

1. **Hash включает frontmatter — НЕЛЬЗЯ.** Per DEC-DEV-0025 C.1 + DEC-DEV-0030 user choice: body markdown only. Frontmatter metadata (version, updated, status) меняется при mechanical bumps; hash должен tracker behavioral change только.

2. **Cross-platform hash — never assume CRLF tolerance.** Always normalize LF через `hooks/product/lib/hash.js`; do not rely на `.gitattributes` (хрупко). Single utility source — sub-phase E skill + sub-phase F hook same module.

3. **`--mode production` НЕ auto-downgrade.** Per Ambiguity 13 / DEC-DEV-0030: refuse если DoR fails; let user explicitly re-invoke с `--mode draft` если intent — experimental.

4. **References вместо embedded — нарушает self-contained принцип.** Per handoff-spec.md AP-2: «See SC-005 в .product/scenarios/» — receiver may not have access. Embed full content.

5. **`--with-da-review` placeholder в Phase 4.E.** Real DA invocation = Phase 4.H. В sub-phase E: parse flag, soft warning logic, но actual subagent invocation delegated к Phase 4.H deliverables (skill `product-da-review.md`). Document explicitly until H lands.

6. **Не emit blocked handoff к диску.** Если blocked → no file write. Inconsistent handoffs с `dor_validation_passed=false` confuse receiver + create stale-detection false positives.

7. **`approve_overrides` без rationale — invalid.** Per D2 spec: rationale required field. Refuse generation если override entry missing `reason` (empty string не valid).

8. **Hash truncation в frontmatter — НЕЛЬЗЯ.** Output format `sha256:<hex64>` — full 64-char digest. Truncated versions break V-H-04 drift detection (false positives).

9. **`--regenerate` мolча overwrite без diff к user.** При drift detected: explicit prompt approve regeneration; show drifted artifacts list первым. Per Step 3 protocol.

10. **NFR Section omitted даже если nfr_status=pending.** Section 11 **always present** per handoff-spec.md §6 Раздел 11 «Общий принцип для receiver». Pending → Case C warning text. Receiver не должен assume отсутствие = «NFR не нужны».

## Related

- Spec: `.claude/docs/product-module/handoff-spec.md` (full handoff format reference)
- Hash utility: `.claude/hooks/product/lib/hash.js` (DEC-DEV-0025 C.1 + DEC-DEV-0030 contract; single source of truth)
- Companion command: `.claude/commands/product/handoff.md`
- Gate hook (Phase 4.F): `hooks/product/product-handoff-gate.js` — PreToolUse block FM edits если valid handoff exists с status: stale (uses same hash utility)
- DoR validation: `.claude/skills/product/validation-runner.md` V-H-* checks (shared logic conceptually)
- NFR section (Phase 4.D consumed): `FM.nfr_status` + NFR-* artifacts; three cases per handoff-spec §6 Раздел 11
- DA pre-handoff (Phase 4.H): `--with-da-review` invokes `/product:da-review FM-NNN` (skill `product-da-review.md`)
- Receiver-side adapter (Phase 5+): generated by `/integrator:add <tool>` consuming this handoff
- V-H-* full spec: `.claude/docs/pmo/validation.md §5.2`
- Validation cross-ref: `validation-runner.md` V-H-* matrix
