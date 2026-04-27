---
description: D1.8 step — define RL-001 detailed plan + create FM skeletons for features in RL. Two-phase output (RL plan, then per-FM skeleton). Called by planning-session.
---

# Release Planning — D1.8 Skill

**Two outputs:**
1. **RL-001** — first release plan (typically = MVP) с target_date, features list, rollout plan
2. **FM-* skeletons** — per FM в RL-001.features, create skeleton (D1 fields filled, D2 empty arrays) ready для `/product:feature` enrichment

## Input

- MVP active (с MUST/SHOULD lists)
- RM active (с RL-001 entry в release sequence)
- HYP active (для FM.hypotheses field)
- VP active (для FM.value_proposition field)
- SEG active (primary identified для FM.segment + JTBD)

## Goal

Produce:
- `.product/releases/RL-001-<slug>.md` в active
- `.product/features/FM-00N-<slug>.md` per feature, all в `planned` status

## Process

### Phase A: RL-001 plan

#### Step A.1: Pull MUST + (optionally) SHOULD from MVP

RL-001.features = MVP MUST + (optional) MVP SHOULD if dev capacity allows. COULD/WON'T excluded by definition.

User may push back на SHOULD inclusion («тоже MUST» = поднимать в MVP first, не expanding RL).

#### Step A.2: Order features by dependency

Order via known patterns:
- Auth before any user-flow features
- Data model features (CRUD entities) before features that operate on them
- Notification features after features that emit events
- Dashboard / aggregation views after underlying data features

Если dependency ambiguous — surface к user with options.

#### Step A.3: Estimate target_date

Без detailed estimates — rough «1 dev × N weeks per feature». Conservative.

Если user has specific target — adopt + flag risk если unrealistic («4 features × 1.5 weeks = 6 weeks; user wants 4 weeks → risk flag»).

`target_date` (RL field) обычно ≈ MVP.target_launch (per spec — RL-001 = MVP).

#### Step A.4: Define rollout plan

3-stage typical:
- **Internal alpha** (week N): closed dogfood, 5-10 users
- **Invite-only beta** (week N+M): 20-50 pilot users
- **Public launch** (week N+M+L): general availability

Each stage с specific date + criteria для transition («alpha → beta when smoke-tests pass + zero P0 bugs»).

#### Step A.5: Identify dependencies

External:
- 3rd party APIs (Stripe, email provider, translation service)
- Legal (ToS, privacy policy)
- Infrastructure (domain, hosting, monitoring)

Per dependency: target date for ready + risk если late.

#### Step A.6: Identify risks

Top 2-3 что может delay/derail RL. Pair с mitigation.

#### Step A.7: Draft RL-001

**Frontmatter** (canonical per [RL.md artifact spec](../../docs/pmo/artifacts/RL.md); enforce per CLAUDE.md B.1 convention):

```yaml
---
id: RL-001                               # 3-digit padded; enumerable
type: release-plan
title: "<short release name>"            # «MVP v1 — <theme>»
status: planned                          # → in-progress when work starts; → released when MUST shipped
target_date: YYYY-MM-DD                  # planned launch date
released_on:                             # filled при released; null otherwise
features: [FM-001, FM-002, ...]          # all FM в scope; populated в Phase B
hypotheses: [HYP-NNN, ...]               # which HYP validated через release
release_number: "v1.0"                   # human-readable version
confidence: high | medium | low
confidence_notes: |
  <solid: HYP/MVP clear, dependencies known, rollout staged>
  <assumed: target_date conservative, может slip 2 weeks if 3rd party delays>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names — НЕ варьировать:**
- ❌ `confidence_rationale`, `rationale` → canonical = `confidence_notes`
- ❌ `target_launch` (это MVP field, не RL!) → canonical = `target_date`
- ❌ `released_at`, `release_date` → canonical = `released_on`
- ❌ `version_number`, `release_version` → canonical = `release_number`
- ❌ `feature_list`, `included_features` → canonical = `features`
- ❌ `hypothesis`, `tested_hypotheses` → canonical = `hypotheses`

**Body** (per RL.md spec):

```markdown
# Release Plan: <title>

## Release purpose
<Why this release. Which HYP validates. Customer-visible value.>

## Success criteria

**Technical:**
- All MUST features released, smoke-tests passed
- Uptime ≥X% (если NFR set; иначе implied default per NFR.md sanity ranges)

**Product:**
- <N user signups by week M after launch>
- <Activation rate ≥X%>
- <Conversion HYP measurement по target_value from primary HYP>

## Scope — included features
| FM | Title | Priority | Depends on |
|----|-------|----------|------------|
| FM-001 | <Title> | MUST | — |
| FM-002 | <Title> | MUST | FM-001 |
| FM-003 | <Title> | MUST | FM-001, FM-002 |
| FM-004 | <Title> | SHOULD | FM-001 |

## Scope — excluded with reason
- **<Feature X>** — moved to RL-002 (SHOULD, не блокирует HYP)
- **<Feature Y>** — COULD per MVP, deferred (complex, не в pilot)

## Dependencies
- **<External dep 1>** — target ready: <date>; risk if late: <impact>
- **<External dep 2>** — ...

## Risks & mitigations
1. **<Risk>** — mitigation: <action item с owner если возможно>
2. **<...>** — ...

## Rollout plan
1. <Date>: internal alpha (5-10 dogfood users)
2. <Date>: invite-only beta (N pilot users)
3. <Date>: public launch
4. <Date>: post-launch checkpoint (measure HYP)
```

#### Step A.8: Filename

ASCII slug: `.product/releases/RL-001-<slug>.md` где slug = first 3-5 значимых words из title (per [docs/pmo/artifacts/README.md](../../docs/pmo/artifacts/README.md) Naming conventions).

**Examples:**
- title: «MVP v1 — personal glossary cohort study» → slug: `mvp-glossary-cohort` → `RL-001-mvp-glossary-cohort.md`
- title: «v1.1 onboarding & import» → slug: `onboarding-import` → `RL-002-onboarding-import.md`

#### Step A.9: Approve RL-001 (🟡 Standard)

Confidence statement:

```
RL-001 draft ready для approve.

Confidence: <level>
Rationale: <what's solid: features list from MVP, dependencies known>
           <what's assumed: target_date conservative, может slip if API X delays>

Approve RL-001? [Y/N/edit]
```

После approve: status → planned (или in-progress если user уже committed work). version++.

### Phase B: FM skeletons

For each feature listed в RL-001.features (typically MVP MUST list), create FM skeleton.

#### Step B.1: Per-FM skeleton dialogue

Each FM has D1 phase 1 (skeleton) fields filled; D2 phase 2 fields empty arrays (для `/product:feature` enrichment в Phase 3.B).

**Per FM, ask user:**
- Confirm FM.title (от RL-001 features list)
- `has_ui` (true/false — определяется here at skeleton, not в D2)
- `priority` (inherits MVP MoSCoW — `must` for MUST list features)
- `jtbd[]` (which JTBD из primary SEG.body это решает? Map to JTBD-N references)
- `hypotheses[]` (which HYP validates)
- `value_proposition` (which VP — usually primary SEG's VP)
- `success_metric` (one measurable outcome of feature; ≠ HYP threshold but related)
- `requires_nfr` (default false; flip true для high-risk: payments, PII, real-time, public API)

#### Step B.2: Frontmatter

**Canonical per [FM.md artifact spec](../../docs/pmo/artifacts/FM.md) — full schema even at skeleton stage; D2 fields = empty arrays:**

```yaml
---
id: FM-<NNN>                             # 3-digit padded; assign sequentially per existing FM
type: feature-map-entry
title: "<short feature name>"
status: planned                          # FM lifecycle: skeleton = planned (NOT draft)
priority: must | should | could          # from MVP MoSCoW
segment: SEG-<NNN>                       # primary segment, required
jtbd: [JTBD-N-from-SEG, ...]             # which JTBDs solved; ≥1 required
hypotheses: [HYP-<NNN>, ...]             # which HYP validated; ≥1 typical
value_proposition: VP-<NNN>              # required
release: RL-001                          # which release; required
has_ui: true | false                     # determined at skeleton stage
scenarios: []                            # empty в skeleton; populated в P2 F.2
rules: []
lifecycles: []
verification: []
invariants: []
mockups: []                              # only если has_ui=true (populated в P2.5 Design)
success_metric: "<measurable outcome of this feature>"

# NFR Review status (opt-in, per FM)
nfr_status: pending                      # default; F.5a Phase 4 reviews
nfr: []                                  # empty until F.5a active
nfr_reviewed_at:
nfr_decline_reason:
requires_nfr: false                      # default; flip true для high-risk

confidence: high | medium | low
confidence_notes: |
  <skeleton complete: jtbd/hyp/vp linked, has_ui decided>
  <D2 enrichment pending — SC, BR, LC, VC, IC TBD>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names — НЕ варьировать (FM имеет много fields, легко перепутать):**
- ❌ `confidence_rationale`, `rationale` → canonical = `confidence_notes`
- ❌ `vp`, `value_prop`, `vp_ref` → canonical = `value_proposition`
- ❌ `kpi`, `metric`, `target_metric` → canonical = `success_metric`
- ❌ `is_ui`, `ui`, `with_ui`, `ui_required` → canonical = `has_ui`
- ❌ `nfr_review_status`, `nfr_state` → canonical = `nfr_status`
- ❌ `needs_nfr`, `nfr_required` → canonical = `requires_nfr`
- ❌ `target_release`, `release_id` → canonical = `release`
- ❌ `seg`, `segment_id` → canonical = `segment`
- ❌ `hyp`, `hypothesis_ids`, `hyps` → canonical = `hypotheses`
- ❌ `jobs`, `jobs_to_be_done` → canonical = `jtbd`

**Body** (skeleton phase per [FM.md](../../docs/pmo/artifacts/FM.md) §1; D2 sections empty):

```markdown
# Feature Map: <title>

## Why
- **JTBD-X.Y (<SEG name>):** <one sentence из SEG.body>
- **HYP-XXX:** <one sentence: validates this feature's effect on метрика>
- **VP-XXX:** <one sentence: какая ценность реализуется>

## What (brief)
<2-3 sentences про что фича делает; без SC details, без implementation>

## Priority rationale
<почему этот priority — связь с MVP scope. «MUST потому что HYP-XXX cannot be validated без этой фичи».>

## Success metric
<measurable outcome of this feature; обычно более узкое чем HYP threshold.>
<Example: «≥80% pilot users add ≥10 glossary terms в first month» (FM metric для glossary feature, validating HYP-002 retention)>
```

#### Step B.3: Filename

ASCII slug: `.product/features/FM-<NNN>-<slug>.md`.

**Examples:**
- title: «Personal glossary management» → `FM-003-personal-glossary.md`
- title: «Email-to-project linking» → `FM-001-email-linking.md`

#### Step B.4: Per-FM approve gate (🟠 Strategic)

Per FM, present skeleton + confidence statement → user approves.

```
FM-<NNN> skeleton ready для approve.

Confidence: <level>
Rationale: <jtbd link clear, has_ui decided, success_metric measurable>

Approve FM-<NNN> as planned? [Y/N/edit]
```

After per-FM approve:
- File written с status: planned
- version: 1

#### Step B.5: After all FM skeletons approved

- **Update RL-001.features[]** с list of approved FM ids (bi-dir consistency, V-11 — RL.features ↔ FM.release)
- **Update each FM.release = RL-001** (already in skeleton frontmatter; verify написано правильно)

### Phase C: Cleanup

1. **Update planning-progress.yaml**:
   - last_approved_gates += D1.8/RL-001
   - last_approved_gates += per-FM (D1.8/FM-NNN)
   - artifacts_active += RL-001 + each FM
   - current_step → complete

2. **Decision journal entries** (Strategic-level, per DEC-DEV-0013 #9):
   - DEC-PLAN-NNN: «RL-001 approved, target <date>, N features»
   - DEC-PLAN-NNN: «FM-001 skeleton approved (planned status)» (per FM)

## Anti-patterns

1. **RL-001 без FM skeletons.** Если RL approved but FM list empty — user не сможет `/product:feature` enrich. Always create skeletons как Phase B.
2. **FM skeleton без Why.** Empty body или просто title — не skeleton. Phase 1 sections (Why / What / Priority rationale / Success metric) обязательны per FM.md spec §1.
3. **All MUST become FM skeleton; SHOULD скип.** Если SHOULD включён в RL.features — нужны skeletons. Иначе exclude из RL.features.
4. **Same FM-NNN ID для двух features.** Sequential numbering обязательно. Read existing `.product/features/` to get next available NNN.
5. **Fabricating jtbd/hypotheses.** Если SEG body не имеет JTBD-N подходящего — surface к user, не выдумывай. Same для HYP/VP.
6. **has_ui=false для UI feature.** has_ui determined here, в skeleton. User должен явно confirm. Если sketchy — default true (safer; D2.5 Design активируется в Phase 6 если has_ui=true).
7. **Skip success_metric.** «TBD» в success_metric допустимо если фича experimental, но обычно user должен knowtable measurable outcome already (что вообще measure?). Push для concrete.
8. **target_date после `target_launch` MVP.** RL-001.target_date обычно ≤ MVP.target_launch. Если RL планируется позже MVP launch — flag inconsistency.

## Confidence calibration (C2)

**For RL-001:**
| Уровень | Когда применять |
|---|---|
| **high** | All features mapped from MVP MUST, dependencies clear, target_date based on dev estimate, rollout staged с criteria |
| **medium** | Most clear но 1-2 dependencies sketchy или target_date estimate (no historical data) |
| **low** | Pre-pilot, mostly speculation; target_date wild guess |

**For FM skeletons:**
| Уровень | Когда применять |
|---|---|
| **high** | jtbd/hypotheses/value_proposition all directly from existing artifacts, has_ui obvious, success_metric measurable |
| **medium** | Some links inferred (например, JTBD-N не explicitly mentioned but matches), success_metric somewhat speculative |
| **low** | jtbd guessed; HYP unclear which validates это feature; success_metric vague — surface к user |

## Examples

**Good RL-001 fragment** (см. RL.md spec §Examples — full version).

**Good FM skeleton fragment:**

```yaml
---
id: FM-003
type: feature-map-entry
title: "Personal glossary management"
status: planned
priority: must
segment: SEG-001
jtbd: [JTBD-1.2]
hypotheses: [HYP-002]
value_proposition: VP-001
release: RL-001
has_ui: true
scenarios: []
rules: []
lifecycles: []
verification: []
invariants: []
mockups: []
success_metric: "≥80% pilot users add ≥10 glossary terms в first month"
nfr_status: pending
nfr: []
nfr_reviewed_at:
nfr_decline_reason:
requires_nfr: false
confidence: high
confidence_notes: |
  Skeleton fields complete. JTBD-1.2 (glossary persistence) — primary use
  case per SEG-001 body. HYP-002 explicitly tests this feature's effect on
  retention. has_ui=true confirmed (CRUD UI need).
  D2 enrichment (SC, BR, LC, VC, IC) pending via /product:feature FM-003.
created: 2026-04-26
updated: 2026-04-26
version: 1
---

# Feature Map: Personal glossary management

## Why
- **JTBD-1.2 (Solo-creator):** When working on long course series, I want
  domain glossary persistent across episodes, so translation quality stays
  consistent without re-explaining terms every time.
- **HYP-002:** Validates retention delta — pilot users с активным glossary
  should remain subscribed >+20pp выше vs without_glossary cohort.
- **VP-001:** «Domain-aware translation» — без personal glossary это claim
  без backing.

## What (brief)
CRUD interface для personal glossary terms. Term consists из source phrase +
target translation + optional context note. Glossary applied automatically
на translate operations. Import from CSV supported (SHOULD priority).

## Priority rationale
**MUST** — без этой фичи HYP-002 нельзя validated (cohort splits на
with/without glossary). Core differentiator per CA gap #2 (glossary =
enterprise-only у 6 AI competitors).

## Success metric
≥80% активных pilot users add ≥10 glossary terms в течение первого месяца use.
Если adoption <50% — feature не drives retention — HYP-002 invalidation flag.
```

**Anti-example FM:**

```yaml
---
id: FM-003
title: "Glossary"                        # ❌ vague
priority: must
hypotheses: []                           # ❌ skeleton без HYP — для чего фича?
segment: TBD                             # ❌ выбери или surface к user
has_ui:                                  # ❌ нужно явно true/false
confidence_rationale: "..."              # ❌ wrong field name
---

(empty body)                             # ❌ skeleton требует Phase 1 sections per FM.md
```

## Related

- [`planning-session.md`](planning-session.md) — orchestrator
- [`mvp-scoping.md`](mvp-scoping.md) — D1.6 (MVP MUST → RL-001 features)
- [`roadmap-planning.md`](roadmap-planning.md) — D1.7 (RM defines RL-001 в sequence)
- Artifact specs: [RL.md](../../docs/pmo/artifacts/RL.md), [FM.md](../../docs/pmo/artifacts/FM.md)
- Companion command: [`commands/product/plan.md`](../../commands/product/plan.md)
- Next step: `/product:feature FM-001` (or any planned FM) для D2 enrichment
