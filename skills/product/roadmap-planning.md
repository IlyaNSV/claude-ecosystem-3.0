---
description: D1.7 step — derive Product Roadmap (RM) from MVP + HYP. Defines horizon goals, release sequence, validation cadence. Called by planning-session.
---

# Roadmap Planning — D1.7 Skill

Build 3-6 month roadmap that translates MVP + HYP portfolio into ordered RL-* sequence with **horizon goals** (направления, не фичи).

## Input

- MVP в active (D1.6 complete — primary HYP + MoSCoW set)
- 3-5 HYP в testing/validated/invalidated
- VP-* active (понимание what each direction delivers)
- SEG-* active (primary identified; secondary mentioned for exploratory RL)

## Goal

Produce `.product/roadmap.md` в active. Defines RL-* sequence (high-level, без detailed scope — это D1.8) + horizon goals + validation cadence.

## Process

### Step 1: Identify current phase

From RM.md spec §Body Structure §1:
- **Идея** — pre-MVP, ничего production не active
- **MVP** — primary HYP testing, MVP active
- **MMP** — primary HYP validated, refining product (post-MVP achieved)
- **Growth** — PMF achieved, scaling
- **Mature** — established product

При первой Planning Session после Discovery — обычно `MVP`.

### Step 2: Define horizon goals (3-5)

Goals спецifying «куда движемся за horizon», не features. Format: «<measurable outcome> by <timing>»

**Strong goals:**
- «Validated HYP-001 (primary) через MVP release — конец Q3 2026»
- «MMP scope сформулирован если HYP-001 validated — начало Q4»
- «SEG-002 secondary segment exploration started — Q4»
- «Revenue positivity (≥$5k MRR) — конец Q4»

**Weak goals (anti-pattern):**
- ❌ «Improve UX» (не measurable)
- ❌ «Add many features» (не направление)
- ❌ «Marketing campaign» (не product roadmap concern)

**Bounds:**
- 3-5 goals — fewer = under-articulated; more = размывание
- Each goal должен иметь measurable outcome OR clear milestone

### Step 3: Build release sequence

Order RL-* per HYP validation order + dependencies:
- **RL-001** — обычно = MVP (validates primary HYP)
- **RL-002** — usually depends on RL-001 outcome (validation result)
- **RL-003+** — secondary HYPs или secondary SEG exploration
- **RL-N pending** — explicit «depends on RL-N-1 outcome», not committed scope

Per RL: target window (month/quarter, NOT exact date — exact date живёт в RL.md), validates which HYP, dependency notes.

### Step 4: Validation cadence

Map HYP validation timeline:
- HYP-001 (primary): testing window <X months>, expected result <date>
- HYP-002 (secondary): testing window <Y months>
- ...

Identify overlap windows (две HYP testing simultaneously OK; три+ — рисково — данные конфликтуют).

### Step 5: Recent changes log

Если RM v2+ (regular monthly review):
- Added/removed RL
- Moved features между RL
- Updated horizon goals
- Pivot mentions

If first RM — пишем «Initial roadmap» или просто пусто.

### Step 6: Draft RM

**Frontmatter** (canonical field names — per [RM.md artifact spec](../../docs/pmo/artifacts/RM.md); enforce per CLAUDE.md B.1 convention):

```yaml
---
id: RM                                   # singleton, fixed
type: roadmap
title: "Product roadmap"
status: draft                            # → active after approve
horizon: "Q3-Q4 2026"                    # 3-6 month window
last_reviewed: YYYY-MM-DD
next_review: YYYY-MM-DD                  # +1 month default
confidence: high | medium | low
confidence_notes: |
  <what's solid: HYP portfolio settled, primary HYP clear>
  <what's assumed: target windows estimated, can shift after RL-001 result>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names — НЕ варьировать:**
- ❌ `confidence_rationale`, `rationale` → canonical = `confidence_notes`
- ❌ `time_horizon`, `period`, `planning_horizon` → canonical = `horizon`
- ❌ `review_date`, `next_review_at` → canonical = `next_review`
- ❌ `last_review` → canonical = `last_reviewed` (note: past participle)

**Body structure** (per RM.md spec):

```markdown
# Product Roadmap

## Current phase
**<Идея | MVP | MMP | Growth | Mature>** — <one sentence: что валидируем сейчас + when expected result>

## Horizon goals
1. **<Goal 1>** — <measurable outcome by timing>
2. **<Goal 2>** — ...
3. **<Goal 3>** — ...
... (3-5 total)

## Release sequence

### RL-001: <Title>
- **Target:** <month/quarter — например «June-July 2026»>
- **Validates:** HYP-XXX (+ optionally HYP-YYY secondary)
- **Contains:** <high-level — «MVP MUST features» или enumerate FM-001, FM-002, ...>
- **Status:** planned | in-progress | released

### RL-002: <Title>
- **Target:** <...>
- **Validates:** HYP-XXX
- **Contains:** <...>
- **Depends on:** RL-001 outcome (HYP-XXX validation result)

### RL-003 (pending HYP-001 result):
- **If validated:** MMP — расширение for validated segment, new features list
- **If invalidated:** pivot scenario — переориентация на SEG-002 или новый VP

## Validation cadence
- <Month-Month>: HYP-001 testing (через RL-001)
- <Month-Month>: HYP-002 testing (через RL-002)
- <Month-Month>: HYP-005 testing (через RL-003 если RL-001 validated)

## Recent changes (since v<N-1>, <date>)
- <Added/removed/moved>
- ...

(Если v1 — «Initial roadmap.»)
```

### Step 7: Filename

Singleton: `.product/roadmap.md` (no slug, no NNN — per artifacts/README.md).

### Step 8: Present + iterate

Standard 1-3 rounds. User corrects:
- Horizon ranges («Q3-Q4 too aggressive — extend to Q4 2026 - Q1 2027»)
- RL ordering / dependencies
- Goal phrasing для measurability

### Step 9: Approve gate (🟡 Standard)

RM is 🟡 Standard — assistant predominantly derives, human validates per-item approve.

Confidence statement (C2):

```
RM draft ready для approve.

Confidence: <level>
Rationale: <what's evidence-based: HYP from G5'd portfolio, MVP scope set>
           <what's assumed: target windows estimates, RL-002 contents tentative>

Approve? [Y/N/edit]
```

### Step 10: Post-approve

1. **Status → active, version++**
2. **BG extraction** queued (orchestrator)
3. **Decision journal entry** (`.product/.decisions/journal.md`):
   ```markdown
   ## DEC-PLAN-NNN — RM approved (horizon <X>, N releases)

   Date: <ISO timestamp>
   Approved by: human
   Confidence: <level>
   Horizon: <range>
   Release sequence: RL-001 (HYP-XXX), RL-002 (HYP-YYY), ...
   Rationale: <brief>
   ```
4. **Update planning-progress.yaml** (orchestrator)

## Anti-patterns

1. **Roadmap = выписка FM list.** Roadmap — directions с целями, не feature list. FM list живёт в RL-*.
2. **Слишком детальные даты.** Quarter/month OK, точная дата живёт в RL. «May 15» — нет; «May 2026» — yes.
3. **>12 месяцев horizon.** Это мечты, не roadmap. Limit 3-6 months. Long-term vision можно как optional «Long-term» section, без commitments.
4. **Goals без measurable outcomes.** «Improve UX» — нет. «Onboarding time-to-first-value <5 min by Q4» — yes.
5. **No connection to HYP.** Каждый RL должен validate ≥1 HYP или close known gap. «Just to ship» — антипаттерн.
6. **Fabricating «what'll happen if HYP invalidated».** RL-003 pending должен иметь explicit if/else scenarios; не молчать о pivot path.
7. **Recent changes log empty в v2+.** Если version > 1 без recent changes — review didn't happen или was trivial; explicit «no significant changes since vN-1» better than blank.

## Confidence calibration (C2)

| Уровень | Когда применять |
|---|---|
| **high** | HYP portfolio G5'd; MVP active; horizon goals all measurable; RL sequence dependencies clear |
| **medium** | One+ из above sketchy (например, RL-003 contents speculative; goal #4 directional не measurable yet) — но overall coherent |
| **low** | Pre-pilot territory: target windows guesses; HYP not all G5'd; RL-002+ pure speculation |

## Examples

**Good RM fragment:**

```yaml
---
id: RM
title: "Product roadmap"
status: active
horizon: "Q3-Q4 2026"
last_reviewed: 2026-04-26
next_review: 2026-05-26
confidence: medium
confidence_notes: |
  HYP portfolio G5'd (4 HYPs, primary HYP-002); MVP active с 4 MUST.
  RL-001 dates (June-July) reasonable based on solo dev capacity.
  Assumed: RL-003 contents speculative — depends entirely на RL-001 outcome.
created: 2026-04-26
updated: 2026-04-26
version: 1
---

## Current phase
**MVP** — валидируем primary HYP-002 (glossary retention) через RL-001 release.
Достижение phase MMP ожидается при validated HYP-002 (~Q4 2026).

## Horizon goals
1. **Validated HYP-002 (primary)** через MVP release к концу Q3 2026
2. **MMP scope сформулирован** если HYP-002 validated — начало Q4 2026
3. **SEG-002 (edu-centers) exploration started** — конец Q4 2026
4. **30+ cohort participants engaged** в HYP-002 measurement period

## Release sequence

### RL-001: MVP v1 (personal glossary cohort study)
- **Target:** June-July 2026
- **Validates:** HYP-002 (primary), HYP-003 (granular regen secondary)
- **Contains:** 4 MUST features из MVP — Auth, Glossary CRUD, Translation pipeline, Cohort dashboard
- **Status:** planned

### RL-002: MMP+ (onboarding & import)
- **Target:** August 2026
- **Validates:** secondary HYP-001 (glossary retention)
- **Contains:** FM-005 onboarding, FM-006 glossary import (MVP SHOULD items)
- **Depends on:** RL-001 outcome — если HYP-002 invalidated, RL-002 cancelled или pivot scope

### RL-003 (pending HYP-002 result):
- **If HYP-002 validated:** MMP scope с edu-centers (SEG-002) exploration features
- **If HYP-002 invalidated:** pivot — re-examine VP-001 «domain-aware» claim, возможно new MVP scope

## Validation cadence
- June-September 2026: HYP-002 testing through RL-001 (3 months post-launch)
- August-November 2026: HYP-001 secondary measurement через RL-002

## Recent changes (since v0)
- Initial roadmap (Phase 3 implementation, 2026-04-26)
```

**Anti-example:**

```yaml
---
id: RM
title: "Roadmap"
status: active
time_horizon: "until 2027"                    # ❌ wrong field name + too long
review_date: 2026-09-01                       # ❌ wrong field name
---

## Roadmap
Q3: Feature A, B, C, D, E                     # ❌ feature list вместо directions
Q4: Feature F, G, H

## Goals
- Make product awesome                        # ❌ не measurable
- Add many features                           # ❌ anti-pattern
- Marketing campaign                          # ❌ не product roadmap concern
```

## Related

- [`planning-session.md`](planning-session.md) — orchestrator (delegates to this skill)
- [`mvp-scoping.md`](mvp-scoping.md) — D1.6 (RM consumes MVP output)
- [`release-planning.md`](release-planning.md) — D1.8 (RM defines RL-001 in sequence; RL fills detail)
- Artifact spec: [docs/pmo/artifacts/RM.md](../../docs/pmo/artifacts/RM.md)
- Process: [docs/pmo/processes.md §3.2 P1.B Planning](../../docs/pmo/processes.md)
