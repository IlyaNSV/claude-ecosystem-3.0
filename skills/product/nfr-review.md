---
description: F.5a NFR Review skill — two-phase (F.5a.0 Ask mandatory, F.5a.1 Define conditional). Sanity ranges from docs/pmo/artifacts/NFR.md §5 as guardrails; tier auto-detected from RM.current_phase fallback to product.yaml.product_tier. Consumes NOTE-NNN с promote_target=NFR queue. Phase 4 per DEC-DEV-0028 D.2 + DEC-DEV-0025 C.2.
---

# NFR Review — F.5a Skill

Loaded by `/product:nfr-review <FM-id>` или auto-invoked during P2 Feature Definition step F.5a (после F.5 Invariant Discovery, перед F.6 VC Derivation). Two-phase workflow per `.claude/docs/pmo/processes.md §3.2`:

- **F.5a.0 Ask (mandatory):** «Есть ли у этой FM measurable NFR? [Y/N]» — фиксируется decision в journal + `FM.nfr_status` update.
- **F.5a.1 Define (conditional on [Y]):** create NFR-NNN artifacts с targets, measurement methods, sanity-check validation.

## Input

- FM-NNN с `nfr_status: pending` (default при FM skeleton creation) или explicit re-review request
- Active NOTE-NNN с `promote_target: NFR` (queue from `feature-session.md` Q4 NOTE creation guidance, DEC-DEV-0023 F8)
- RM (для tier detection via `RM.current_phase`)
- `.claude/product.yaml` (fallback `product_tier`)
- `.product/nfr/` existing NFRs (для scope=global lookup + reuse)

## Output

Per FM:
- `FM.nfr_status` transition: `pending` → `active` | `declined`
- `FM.nfr_reviewed_at: <YYYY-MM-DD>` set
- Если declined: `FM.nfr_decline_reason: "<rationale>"` required (free-text)
- Если active: `FM.nfr[]` array populated с NFR-NNN refs
- Decision journal entry `DEC-NFR-NNN`

Если F.5a.1 Define executed:
- 0..N `.product/nfr/NFR-NNN-<slug>.md` в active (или draft если confidence low + needs G5-style approve)
- Per NFR: frontmatter с canonical schema (per [`docs/pmo/artifacts/NFR.md`](../../docs/pmo/artifacts/NFR.md))

**FM version++ atomically с `nfr_status` change** (per Ambiguity 25 resolution в DEC-DEV-0030).

## F.5a.0 Ask flow (mandatory)

### Step 1: Consume NOTE queue для FM

Read `.product/notes/NOTE-*.md` где `promote_target: NFR`. Filter к:
- `related: FM-<NNN>` matches current FM
- Or `related: GLOBAL` (если scope=global candidates)

Present queue к user:

```
NOTE candidates for NFR promotion (FM-001):

  [1] NOTE-003 (created 2026-04-29) — "2FA security requirement"
      promote_target: NFR
      promote_target_confidence: medium
      promote_target_alternative: BR        # if AI was unsure NFR vs BR (DEC-DEV-0023 F8)
  [2] NOTE-005 (created 2026-05-02) — "Performance: inbox load <2s"
      promote_target: NFR

Use these as starting point для F.5a Define? [Y promote all / S select / N skip queue]
```

Если queue empty — surface: «No NOTE candidates с promote_target=NFR для FM-001. Proceeding к Ask без queue.»

### Step 2: High-risk auto-detect

Scan FM body для keywords: `payments`, `PII`, `billing`, `real-time`, `public API`, `concurrent editing`. Если `FM.frontmatter.requires_nfr=true` OR keyword match — flag к user:

```
High-risk indicators detected в FM-001:
  - body mentions "payment processing" (keyword: payments)
  - body mentions "concurrent editing" (keyword)

This FM strongly recommends NFR Review (Define phase). Skipping
to declined требует explicit rationale — V-16 NFR blocking
если high_risk + declined без rationale (per validation.md §5.1).
```

### Step 3: Ask user

```
F.5a.0 NFR Review для FM-001:

Are there measurable non-functional requirements для this feature?

Examples что обычно captures как NFR:
  - Performance (response time, throughput)
  - Reliability (uptime, recovery time)
  - Scalability (concurrent users, data volume)
  - Security (auth, encryption, audit)
  - Privacy (PII handling, retention)
  - Accessibility, Compatibility, Usability, Observability

[Y] Yes — define NFRs (proceed к F.5a.1)
[N] No — use MVP defaults (per docs/pmo/artifacts/NFR.md §5)
[D] Defer — keep nfr_status: pending (review later)
```

### Step 4: Process answer

**Y → F.5a.1 Define** (see below).

**N → declined:**
```
Why decline (rationale required для V-16 + audit trail):

Examples valid rationale:
  - "MVP pilot, ≤20 users — MVP defaults from NFR.md §5 sufficient"
  - "No external-facing surface — internal tool only"
  - "Performance not user-perceivable — batch operations"

Rationale:
> _<user input>_
```

Если rationale empty AND high_risk detected — **block**: «High-risk FM cannot decline без rationale (V-16 enforcement per validation.md §5.1).»

Если rationale provided:
- Set `FM.nfr_status: declined`
- Set `FM.nfr_decline_reason: "<rationale>"`
- Set `FM.nfr_reviewed_at: <today YYYY-MM-DD>`
- FM `version++` atomically
- Decision journal entry `DEC-NFR-NNN`:
  ```yaml
  decision: declined
  feature: FM-001
  rationale: "<user input>"
  high_risk: false                       # или true с rationale если applicable
  reviewed_by: human
  reviewed_at: <ISO timestamp>
  ```

**D → pending (re-review later):**
- No FM frontmatter change (still pending)
- Surface к user: «`FM-001.nfr_status` remains pending. `/product:nfr-review FM-001` to re-trigger.»
- Decision journal entry **NOT** created (no decision yet)

## F.5a.1 Define flow (conditional)

Triggered when F.5a.0 Ask returned [Y].

### Step 1: Tier auto-detection (per Ambiguity 10)

Determine effective product tier (для sanity range selection per [`docs/pmo/artifacts/NFR.md §5`](../../docs/pmo/artifacts/NFR.md)):

```
IF RM exists AND RM.current_phase set:
    tier = RM.current_phase           # mvp | mmp | growth | mature
ELIF product.yaml.product_tier set:
    tier = product.yaml.product_tier
ELSE:
    tier = mvp                         # fallback default
```

Surface к user (per Ambiguity 10 — never silent fallback):
```
Detected product tier: mvp (source: RM.current_phase)
Sanity ranges applied: NFR.md §5 MVP column.
Override tier для this NFR Review session? [N keep / mmp / growth / mature]
```

### Step 2: Process NOTE queue (если Step 1 user said [Y promote all] или [S select])

Per promoted NOTE-NNN:
1. Read NOTE body
2. Classify category (performance | reliability | scalability | security | privacy | accessibility | compatibility | usability | observability)
3. Extract preliminary target (если упоминается в NOTE)
4. Pre-fill NFR-NNN draft per template (Step 3 ниже)

### Step 3: Per-NFR creation flow

Для each NFR (from NOTE promote queue + manual additions):

Frontmatter (canonical per [NFR.md schema](../../docs/pmo/artifacts/NFR.md); enforce per CLAUDE.md B.1 convention):

```yaml
---
id: NFR-<NNN>
type: non-functional-requirement
title: "Короткое описание"
category: performance | reliability | scalability | security | privacy | accessibility | compatibility | usability | observability
target_value: "string"               # ">=95%", "<2s p50", "≤10 concurrent users"
target_tier: <effective tier>
measurement_method: "string"         # how we know target met/violated
scope: global | per_feature
related_features: [FM-<NNN>, ...]    # empty if scope=global
status: draft                         # → active after approve gate
sanity_check: passed | overridden    # auto-set by skill (см. Step 4)
override_rationale: "string"         # required if sanity_check=overridden
confidence: high | medium | low
confidence_notes: |
  <what's solid: source of target, measurement method validated>
  <what's assumed: typical user volume, MVP scale>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names — НЕ варьировать (B.1 convention; AI tendency to rename для естественности → drift):**
- ❌ `nfr_target`, `value`, `threshold` → canonical = `target_value`
- ❌ `tier`, `product_tier`, `nfr_tier` → canonical = `target_tier`
- ❌ `measure`, `measurement`, `how_measured` → canonical = `measurement_method`
- ❌ `applies_to`, `for_features`, `features` → canonical = `related_features`
- ❌ `sanity`, `range_check`, `within_range` → canonical = `sanity_check`
- ❌ `override_reason`, `out_of_range_reason` → canonical = `override_rationale`
- ❌ `category: perf`, `reliability_category`, `security-level` → use exact enum from canonical list
- ❌ **`sanity_check: failed`** → НЕ canonical state в Phase 4 workflow per DEC-DEV-0025 C.2 + Ambiguity 9; runtime использует только `passed | overridden`. State `failed` deprecated (legacy NFRs treat как `overridden` с empty rationale + backfill prompt).
- ❌ `confidence_rationale`, `confidence_reasoning` → canonical = `confidence_notes`

Body sections (per NFR.md §Body Structure):
1. **Statement** — формулировка требования
2. **Target value** — числовое значение + tier rationale
3. **Rationale** — почему этот target, не выше / не ниже
4. **Measurement method** — что измеряем, чем, с какой периодичностью
5. **Anti-target** — что осознанно НЕ обеспечиваем (defense against gold-plating)
6. **Test strategy** — manual / automated / production monitoring
7. **Known tradeoffs** — что жертвуем (деньги, сложность, гибкость)
8. **Related features** — если scope=per_feature
9. **Tier upgrade plan** — что надо для перехода в next tier

### Step 4: Sanity range warning (per DEC-DEV-0025 C.2)

Compare proposed `target_value` против [`docs/pmo/artifacts/NFR.md §5`](../../docs/pmo/artifacts/NFR.md) tier ranges для current category.

**Within range:**
- Set `sanity_check: passed`
- No warning
- Proceed к approve

**Out of range:**
- Set `sanity_check: overridden`
- Require `override_rationale` (free-text from user)
- Per Ambiguity 9: this state replaces deprecated `failed` — informational warning, **не блокирует**
- Surface к user:
  ```
  ⚠ Sanity range check для NFR-<NNN> (<category>):
  
  Вы specified: <target_value>
  Typical <tier> range: <range_from_NFR.md_§5>
  
  This is outside typical range. Why this target?
  
  Examples valid override rationale:
    - "Regulatory compliance (HIPAA) requires <stricter>"
    - "Batch operation — slow tolerated, < typical real-time UX"
    - "Stretch goal для MMP; tracking via tier upgrade plan"
  
  Rationale:
  > _<user input>_
  ```
- Decision journal entry `DEC-NFR-NNN`:
  ```yaml
  nfr: NFR-<NNN>
  sanity_check: overridden
  proposed_target: "<user value>"
  typical_range: "<range from NFR.md>"
  rationale: "<user rationale>"
  ```

Per DEC-DEV-0025 C.2: informational warning, **не block**. No mandatory DA review per override (would add friction without proven value).

### Step 5: Per-NFR approve

Standard Strategic approve gate (NFR review level: 🟠):

```
NFR-<NNN> draft ready для approve.

Confidence: <high|medium|low>
Rationale: <one paragraph>

[A] Approve → status: active
[E] Edit → modify draft
[R] Re-do → restart Step 3 для this NFR
[D] Defer → save as draft, return позже
```

After approve:
- NFR.status → active, version: 1
- Update `FM.nfr[] += NFR-NNN` (bi-dir consistency, V-11)
- Если promoted from NOTE-NNN: set `NOTE.status: promoted` + `NOTE.promoted_to: NFR-NNN`

### Step 6: F.5a.1 completion

После всех NFRs (from queue + manual) processed:
- Set `FM.nfr_status: active`
- Set `FM.nfr_reviewed_at: <today>`
- FM `version++` atomically
- Decision journal entry `DEC-NFR-NNN` summary:
  ```yaml
  decision: active
  feature: FM-001
  nfrs_created: [NFR-001, NFR-002, ...]
  nfrs_from_notes: [NOTE-003, NOTE-005]
  tier_applied: mvp
  high_risk: false
  reviewed_by: human
  reviewed_at: <ISO>
  ```

### Step 7: Continue support

При interrupted session (много NFR, user wants break):
- `/product:nfr-review FM-001 --continue` resumes
- Session state в `.product/.sessions/nfr-review-FM-<NNN>-progress.yaml`
- Singleton pattern per FM (same approach as `feature-session.md`)

Schema:
```yaml
session_id: <ISO timestamp>
type: nfr-review
feature_id: FM-001
started_at: <ISO>
phase: F.5a.0_ask | F.5a.1_define | complete
ask_answer: pending | Y | N | D
nfrs_processed: [NFR-001, NFR-002]
nfrs_queued: [NOTE-003, NOTE-005]
notes_promoted: [NOTE-003 → NFR-001]
tier_applied: mvp
next_step: <description>
```

## Anti-patterns

1. **Не пропускать F.5a.0 Ask.** Mandatory phase — per DEC-DEV-0028 D.2 Ask без Define создаёт orphan decision; обе фазы вместе.

2. **Не блокировать override молча.** Per DEC-DEV-0025 C.2: informational warning. Mandatory rationale = sufficient barrier; mandatory DA review per override = overengineering.

3. **`NFR.sanity_check: failed` — deprecated state.** Phase 4 workflow uses только `passed | overridden`. Если encounter `failed` в existing NFR (legacy) — treat как `overridden` с empty rationale; prompt user backfill.

4. **High-risk FM declined без rationale — block.** V-16 enforcement: high_risk indicators + nfr_status: declined без `nfr_decline_reason` → blocking severity (per validation.md §5.1 V-16 table).

5. **Не auto-tier-override молча.** Per Ambiguity 10: if RM.current_phase missing, surface fallback к user explicitly, не silently use MVP.

6. **NOTE.promote_target=NFR consumption — не bulk approve.** Per-NFR confirmation; NOTE just seeds draft, user reviews per Step 5.

7. **Не emit sanity_check значения вне enum.** Только `passed | overridden`. Custom values (например `partially_passed`) — drift kandidat, B.1 convention violation.

## Related

- Catalog: `.claude/docs/pmo/artifacts/NFR.md` (schema + sanity ranges §5)
- Process: `.claude/docs/pmo/processes.md §3.2 F.5a`
- Companion commands: `.claude/commands/product/nfr-review.md`, `.claude/commands/product/nfr-upgrade-tier.md`
- Triggered from: `.claude/skills/product/feature-session.md` F.5a step (Phase 3 placeholder; Phase 4 actual call)
- Consumes: `.product/notes/NOTE-*.md` с `promote_target: NFR` (per DEC-DEV-0023 F8)
- Updates: `FM.nfr_status`, `FM.nfr_decline_reason`, `FM.nfr[]`, `FM.nfr_reviewed_at`, NFR-* artifacts
- Validation impact: V-16 (FM.nfr_status tracking; см. `validation-runner.md` skill V-16 matrix)
- Handoff impact (Phase 4.E): handoff §11 reads `FM.nfr_status` + NFR artifacts per active scope
