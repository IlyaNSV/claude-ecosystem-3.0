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

### Step 4: `--with-da-review` handling (per DEC-DEV-0026 hybrid + Phase 4.H wiring)

**Если `--with-da-review` flag passed:**

1. **Pre-flight: skill availability safe-guard** (B3 defensive check — DEC-DEV-0031).
   Phase 4.H shipped `skills/product/product-da-review.md` — default state passes. Defensive check на случай incomplete bootstrap (older project с outdated `.claude/`):

   ```bash
   test -f .claude/skills/product/product-da-review.md
   ```

   Если skill отсутствует (incomplete bootstrap / older `.claude/`) — surface к user fallback:

   ```
   ⚠ --with-da-review требует skill product-da-review.md, который отсутствует
     в этом проекте. Likely cause: incomplete /ecosystem:bootstrap или outdated
     .claude/. Run /ecosystem:update для refresh.

   Варианты:
     [c] Continue без DA invocation — soft warning fallback (если последний
         FM-level DA review > 7 days старый, увидите advisory; иначе silent).
     [a] Abort — выйти из handoff generation, run /ecosystem:update first.
   ```

   При выборе [c] — fall through к soft warning branch ниже (как если бы flag не был passed).
   При [a] — refuse generation, exit cleanly.

2. **Если skill доступен (default Phase 4.H+ state)** — invoke real DA через SlashCommand:
   - SlashCommand tool: `/product:da-review FM-<NNN>` — handoff caller passes provenance через handoff-generator session context (skill `product-da-review.md` Step 4 spawns subagent с `Mode: full, Scope: feature, Trigger: auto-pre-handoff`).
   - Skill writes findings к `.product/.da-findings/FM-<NNN>-<YYYY-MM-DD>-<HHMM>.md` per canonical schema (DEC-DEV-0030 A.1).
3. **Wait findings file written** — orchestrator (Claude) waits skill completion; glob `.product/.da-findings/FM-<NNN>-<TODAY>-*.md` для confirm.
4. **Parse findings frontmatter** — verify `id, severity, artifact_ref, source, scope` per canonical schema. Source check: для `--with-da-review` invocation, `source: auto-pre-handoff` ожидается. Frontmatter drift (e.g., `confidence_rationale` вместо `resolution`) → surface к user, refuse continue.
5. **Critical gate:** count findings с `severity: critical` AND `resolution: pending`:
   - **≥1 critical pending** → block handoff generation. Surface:
     ```
     Handoff generation для FM-001 blocked: 🔴 <N> critical DA findings unresolved.

     Critical findings:
       F1 [Cross-rule consistency] BR-022 нарушает IC-003 invariant
            Suggested action: либо update IC-003 (с rationale), либо переформулировать BR-022
       F2 ...

     Resolve findings:
       /product:da-review FM-001    # re-open для per-finding [Act/Defer/Dismiss/Skip]

     Then re-invoke /product:handoff FM-001 --with-da-review.
     ```
     Refuse generation; exit early.
   - **0 critical pending** (но possibly important/discussion) → handoff proceeds. Warnings (important/discussion) appended к handoff frontmatter `warnings[]`.
6. **Continue к Step 5** с DA context attached (handoff frontmatter записывает `da_review_reference: FM-NNN-<timestamp>.md`).

**Иначе (default — flag not passed OR fallback [c]):** soft DoR warning (per DEC-DEV-0026 D.3 hybrid):

1. Glob `.product/.da-findings/FM-<NNN>-*.md` (если directory exists)
2. Найти most recent finding файл с `scope: feature` для этой FM (по frontmatter parse)
3. Age check: > 7 days from now → warning:
   ```
   ⚠ Last FM-level DA review для FM-001: <date> (>7 days ago)
   Consider:
     /product:da-review FM-001                    # explicit pre-gen review
     /product:handoff FM-001 --with-da-review     # combined flow
   
   Continue без fresh DA? [y/n]
   ```
4. < 7 days OR не exists fresh — proceed silent (но V-H-* B6 уже cover это conceptually).

**Per DEC-DEV-0030 D.7 cut (aspirational layer deferred):** recursive auto drill-down (`suggested_drill_down` finding field auto-fires per-FM DA) — v1.1. Phase 4 ships hints surfaced к user; user manually invokes `/product:da-review FM-NNN` per recommendation.

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
→ V-H-11 DoR check raises warning (per NFR opt-in philosophy); pending → 🟡 Warning, не блокирует даже в production mode. V-H-11 = handoff section 11 conformity к `FM.nfr_status` (см. `validation-runner.md` V-H-11 matrix).

### Step 8c: UI Specification section (Phase 6 / DEC-DEV-0052 Q10 resolution)

**Section 10 — CONDITIONAL on FM.has_ui=true.** Если `has_ui: false` или absent → section omitted entirely, no further reads. Если `has_ui: true` — proceed below.

**Q10 carry-forward decision (resolved Phase 6 sub-phase G — DEC-DEV-0053):** handoff §10 assembled inline by этот skill читая MK/DS/NM artifacts directly. **`/design:export` NOT invoked from `/product:handoff`.** Separation rationale: `/design:export` = standalone verify / debug aid; this skill has full filesystem access к `.product/mockups/` + `.product/design-system.md` без command-call overhead.

**Assembly algorithm:**

1. **Load active MK для FM:** glob `.product/mockups/MK-*.md`; filter where `MK.feature == <FM-id>` AND `MK.status == active`. Если 0 active → DoR check B7 already caught earlier (Step 5); this assembly point assumes ≥1 active MK.

2. **Load NM для FM:** glob `.product/mockups/NM-*.md`; filter where `NM.feature == <FM-id>` AND `NM.status == active`. Если 0 — surface inline note: «No active NM — single-screen flow assumed»; не block.

3. **Load DS:** read `.product/design-system.md`; parse все Token tables + Component Library Index + Pattern Library + Deprecated tokens section.

4. **Compute DS subset (only tokens / components referenced by active MK):**
   - Scan all MK bodies для tokens via regex `/DS\.(\w+)\.(\w+(?:-\w+)*)/g`
   - Build referenced-tokens set
   - Filter DS body — keep entries для referenced tokens + components referenced via Component State Matrix component names + patterns used
   - Bare-token-not-found in DS → log как drift warning (informational)

5. **Assemble section markdown:**

```markdown
## 10. UI Specification

> Generated from MK/DS/NM artifacts active for <FM-id> at <ISO timestamp>.

### 10.1 Mockup Packages

<For each MK active>:
  #### <MK.id> — <MK.title>

  - **design_tool:** <MK.design_tool>
  - **tool_project_url:** <MK.tool_project_url>
  - **platform:** <MK.platform>
  - **iteration:** <MK.iteration>
  - **scenarios covered:** <MK.scenarios joined ", ">
  - **previous_tools history:** <count из previous_tools[]> migrations (см. MK frontmatter для full trail)

  <MK body verbatim — все 7 sections (Screen Inventory, Component State Matrix,
   Interaction Spec, Responsive Notes, Accessibility Notes, Edge Cases, Design Decisions Log)>

### 10.2 Design System Snapshot (subset)

> Subset of `.product/design-system.md` containing only tokens / components / patterns
> referenced by MKs in §10.1. Full DS in repo file.

**DS version:** <DS.version>
**Last extraction:** <DS.last_extraction_at>

#### Tokens (used)

<Tables — colors / typography / spacing / border / radius / shadows — filtered к referenced subset>

#### Components (referenced via Component State Matrix)

<Component Library Index entries — filtered к components mentioned в any MK matrix>

#### Patterns (used)

<Pattern Library entries — filtered к patterns referenced>

#### Deprecated tokens (active references)

<Deprecated entries — only if any referenced by current MK (audit warning)>

### 10.3 Navigation Maps

<For each NM active>:
  #### <NM.id> — <NM.title>

  - **mockups linked:** <NM.mockups joined ", ">
  - **roles:** <NM.roles joined ", ">

  <NM body verbatim — все 4 sections (Flow Diagram, Entry Points, Screen Transitions, Dead Ends & Error Flows)>
```

6. **Hash MK / DS / NM bodies** для `artifact_hashes` block (Step 7 already computes — этот step ensures MK/DS/NM included в hash set so drift detection covers them).

7. **Warnings cases:**
   - DS subset empty (MK references tokens но none resolve в DS) → 🟡 warning в frontmatter.warnings[]: «UI Specification: DS token references unresolved»; не block
   - NM absent — inline note (см. Step 2)
   - V-MK-08 token coverage failures from hook queue (`.product/.pending/validation-pending.yaml`) → 🟡 warning «UI Specification: deferred validation findings pending»

**Format compliance:** `.claude/docs/product-module/handoff-spec.md §10` is authoritative. This step's algorithm aligns с handoff-spec semantics. Schema fields в frontmatter (line ~398 `mockup_packages[]`, `navigation_maps[]`, `design_system_tokens_snapshot`) — populated to list active MK / NM IDs + DS version reference per assembly above.

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

**Anti-pattern field names — НЕ варьировать** (B.1 convention applied к handoff frontmatter — handoff schema живёт в `docs/product-module/handoff-spec.md`, не в `docs/pmo/artifacts/`, но same drift risk apply при AI generation; explicit list = defensive programming в skill prompts. Added post-review per R5/B2 fix-up 2026-05-13):

- ❌ `hashes`, `hash_map`, `artifact_hash` (singular) → canonical = `artifact_hashes` (plural, mapping)
- ❌ `dor_pass`, `dor_passed`, `validation_passed` (bare) → canonical = `dor_validation_passed`
- ❌ `dor_override`, `approve_overrides_applied`, `overrides` → canonical = `dor_overrides` (на handoff frontmatter, отображает применённые `approve_overrides` из FM)
- ❌ `embedded`, `embedded_refs`, `artifacts_embedded` → canonical = `embedded_artifacts` (object с типизированными полями `feature`/`scenarios`/`business_rules`/...)
- ❌ `tool_target`, `target`, `adapter_target` → canonical = `target_adapter` + `target_tool` (раздельные fields per handoff-spec §5)
- ❌ `tool_version`, `target_v` → canonical = `target_tool_version`
- ❌ `gen_at`, `generated`, `created_at` (для generated_at) → canonical = `generated_at` (ISO timestamp); `created` и `updated` — отдельные ASCII date fields per artifact convention
- ❌ `regenerator`, `regen_source`, `regen_reason` → canonical = `regenerated_from` (enum: `artifact_changes | manual | drift_detection`)
- ❌ `prev_version`, `previous`, `parent_version` → canonical = `previous_version` (либо null либо `HANDOFF-FM-<NNN>-v<prev>` ID)
- ❌ `tier`, `product_tier`, `tier_snapshot` → canonical = `current_product_tier` (для receiver context)
- ❌ `nfr_state`, `nfr_review_status`, `nfrs_status` → canonical = `nfr_status` (mirror FM frontmatter field — enum `active | declined | pending`)
- ❌ `decline_reason`, `nfr_reason` → canonical = `nfr_decline_reason`
- ❌ `passed_rules`, `validation_passed_list` → canonical = `validation_rules_passed` (array of V-* IDs)
- ❌ `failed_rules`, `validation_failed_list` → canonical = `validation_rules_failed`

**Filename slug rule** (per `docs/product-module/handoff-spec.md §4 Naming convention`): `<FM-id>-handoff.md` для feature-level (e.g., `FM-001-handoff.md`); `<RL-id>-handoff.md` для release-level (deferred к v1.1+). Никаких суффиксов c version-номером в filename — версии preserved через git history.

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
  V-H-* passed: 11/11 (V-H-04 not applicable, no drift)

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

5. **`--with-da-review` critical gate — non-bypassable + B3 safe-guard preserved.** Phase 4.H shipped real DA invocation через SlashCommand к `/product:da-review FM-<NNN>`. Findings с `severity: critical` AND `resolution: pending` MUST block handoff. Не «warn and continue» — refuse generation; refer user к `/product:da-review FM-NNN` для interactive [Act/Defer/Dismiss/Skip] resolution. Bypass only через explicit defer/dismiss в DA workflow. **B3 safe-guard** (pre-flight existence check `skills/product/product-da-review.md`) preserved для defense против incomplete bootstrap: если skill отсутствует (older `.claude/`) — explicit [c] continue без DA / [a] abort prompt к user, не silent fall-through. Default Phase 4.H+ state passes safe-guard natural'но → real invocation path активен.

6. **Не emit blocked handoff к диску.** Если blocked → no file write. Inconsistent handoffs с `dor_validation_passed=false` confuse receiver + create stale-detection false positives.

7. **`approve_overrides` без rationale — invalid.** Per D2 spec: rationale required field. Refuse generation если override entry missing `reason` (empty string не valid).

8. **Hash truncation в frontmatter — НЕЛЬЗЯ.** Output format `sha256:<hex64>` — full 64-char digest. Truncated versions break V-H-04 drift detection (false positives).

9. **`--regenerate` мolча overwrite без diff к user.** При drift detected: explicit prompt approve regeneration; show drifted artifacts list первым. Per Step 3 protocol.

10. **NFR Section omitted даже если nfr_status=pending.** Section 11 **always present** per handoff-spec.md §6 Раздел 11 «Общий принцип для receiver». Pending → Case C warning text. Receiver не должен assume отсутствие = «NFR не нужны».

## Related

- Spec: `.claude/docs/product-module/handoff-spec.md` (full handoff format reference)
- Hash utility: `.claude/hooks/product/lib/hash.js` (DEC-DEV-0025 C.1 + DEC-DEV-0030 contract; single source of truth)
- Companion command: `.claude/commands/product/handoff.md`
- Gate hook (Phase 4.F): `hooks/product/product-handoff-gate.js` — PostToolUse non-blocking warning при drift между saved artifact и embedded hash в `.product/handoffs/*.md` (uses same hash utility)
- DoR validation: `.claude/skills/product/validation-runner.md` V-H-* checks (shared logic conceptually)
- NFR section (Phase 4.D consumed): `FM.nfr_status` + NFR-* artifacts; three cases per handoff-spec §6 Раздел 11
- DA pre-handoff (Phase 4.H shipped): `--with-da-review` invokes `/product:da-review FM-NNN` через SlashCommand; consumes findings file (`source: auto-pre-handoff`); critical pending findings block handoff per Step 4 gate
- Receiver-side adapter (Phase 5+): generated by `/integrator:add <tool>` consuming this handoff
- V-H-* full spec: `.claude/docs/pmo/validation.md §5.2`
- Validation cross-ref: `validation-runner.md` V-H-* matrix
