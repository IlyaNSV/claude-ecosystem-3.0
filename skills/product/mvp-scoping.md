---
description: D1.6 step — define MVP scope using MoSCoW prioritization. Produces .product/mvp-scope.md from HYP + VP + SEG. Called by planning-session.
---

# MVP Scoping — D1.6 Skill

Define the minimum feature set needed to validate the **primary HYP**. Discipline > generosity — MUST list ≤8 items.

## Input

- 1+ HYP в status=`testing` (one с `priority: primary` или candidate identified)
- 1+ VP active (per primary SEG)
- 1+ SEG active (primary clearly identified)
- MR + CA active (для context — не required для scoping per se)

## Goal

Produce `.product/mvp-scope.md` в active after approve. Defines scope → blocks RM (D1.7) and RL-001 (D1.8).

## Process

### Step 1: Identify primary HYP

Read all HYP-* в `.product/hypotheses/`. Identify primary:
- Если ровно одна HYP с `priority: primary` — use it
- Если несколько с `priority: primary` — surface conflict, ask user pick one (multiple primaries = focus lost per processes.md §1.2 P4)
- Если ни одной с `primary` — propose candidate based on VP-alignment + biggest unknown; user confirms

### Step 2: Inventory candidate features

From available inputs, extract feature candidates:
- Each HYP body: какие фичи реально нужны для validate (обычно 1-3)
- Each VP body: «main pain» suggests 1-2 features
- Each JTBD от primary SEG: 1-2 features

Surface candidates list к user. **Не draft FM skeletons здесь** — те создаются в D1.8 release-planning.

### Step 3: MoSCoW prioritization

Per candidate, classify:
- **MUST** — без этой фичи primary HYP cannot be validated
- **SHOULD** — important, но не блокирует validation
- **COULD** — приятно если время позволит
- **WON'T (для MVP)** — explicitly out of scope с reason

**Discipline rules:**
- MUST list ≤8 items. Если push'ит выше — это уже не MVP, а v1.0 full release. Push back, surface MoSCoW бюджет.
- WON'T must be non-empty. Без explicit out-of-scope, scope creep неизбежен (см. anti-pattern AP-4 в handoff-spec).
- Каждый MUST должен иметь one-sentence «как помогает validate primary HYP». Если AI не может articulate — это не MUST.

### Step 4: Define success criteria

«MVP achieved» means primary HYP validated per its `target_value` (canonical HYP frontmatter field; см. [HYP.md](../../docs/pmo/artifacts/HYP.md)). Не reword; copy paste из HYP.body / frontmatter.

### Step 5: Identify top 3 risks

Что может prevent MVP from validating primary HYP? Categories:
- **Technical risks** — что может не работать (3rd party API down, performance limits)
- **Adoption risks** — пользователи не придут / не используют (низкая awareness, friction)
- **External risks** — 3rd party dependencies, юридика, geo-restrictions

Per risk: pair с mitigation. «Risk без mitigation» — incomplete entry; surface к user.

### Step 6: Draft MVP

**Frontmatter** (canonical field names — per [MVP.md artifact spec](../../docs/pmo/artifacts/MVP.md); enforce per CLAUDE.md B.1 convention):

```yaml
---
id: MVP                                  # singleton, fixed
type: mvp-scope
title: "MVP v1 — <короткое описание цели, 5-10 слов>"
status: draft                            # → active after approve
primary_hypothesis: HYP-<NNN>            # required, exactly one
target_launch: YYYY-MM-DD                # estimated; tentative is OK
achieved_on:                             # null until status=achieved
confidence: high | medium | low          # C2 modification — required
confidence_notes: |                      # required если confidence != high; recommended всегда
  <what's solid: HYP clear, MoSCoW disciplined, ...>
  <what's assumed: target_launch tentative; depends on FM-002 effort>
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1
---
```

**Anti-pattern field names — НЕ варьировать (per DEC-DEV-0011 lesson; AI tendency to rename для естественности приводит к drift):**
- ❌ `confidence_rationale`, `confidence_reasoning`, `rationale` → canonical = `confidence_notes`
- ❌ `primary_hyp`, `hyp_primary`, `primary_hypothesis_id` → canonical = `primary_hypothesis`
- ❌ `launch_date`, `target_date`, `mvp_target` → canonical = `target_launch` (note: `target_date` это RL field, не MVP — different artifact)
- ❌ `confidence_level`, `conf` → canonical = `confidence`

**Body structure** (per MVP.md spec §Body Structure):

```markdown
# MVP Scope: <title>

## Primary hypothesis
HYP-<NNN>: <одно предложение из HYP statement>

## Success definition
<«MVP achieved» means primary HYP validated per `target_value` from HYP frontmatter + context from body>
<Sample size, period, measurement method — copy from HYP>

## Scope — MUST have
1. **<Candidate feature 1>** — <one-sentence rationale: «как помогает validate primary HYP»>
2. **<Candidate feature 2>** — ...
... (≤8 items)

## Scope — SHOULD have
1. **<...>** — important but not blocking validation
...

## Scope — COULD have
1. **<...>** — if time permits
...

## Scope — WON'T have (для MVP)
- **<...>** — <reason: «not in primary HYP scope», «substitute, distracts from differentiation», ...>
- **<...>** — ...

## Non-goals
- <What MVP сознательно не делает (избежать scope creep)>
- ...

## Risks
1. **<Risk 1>** — <mitigation plan>
2. **<Risk 2>** — ...
3. **<Risk 3>** — ...

## Assumptions
- <Что MVP предполагает true (например, «3rd party email API stable»)>
- ...

## Rollout plan
<Internal beta? Public launch? Invite-only? Timeline overview — детали в RL-001.>
```

### Step 7: Filename

ASCII slug rule (per [docs/pmo/artifacts/README.md](../../docs/pmo/artifacts/README.md) Naming conventions):
- MVP — singleton — file `.product/mvp-scope.md` (no slug, no NNN)

### Step 8: Present + iterate

Standard 1-3 iteration rounds:
- User corrects MUST/SHOULD/COULD assignments
- Adjusts target_launch
- Refines risks/mitigations

Don't drag out. Если 5+ iterations без convergence — flag «may need re-examine primary HYP first».

### Step 9: Approve gate (🟠 Strategic)

Confidence statement format (C2):

```
MVP draft ready для approve.

Confidence: <high | medium | low>
Rationale: <one paragraph — what's solid (G5'd HYP, MoSCoW disciplined, risks identified)
            vs assumed (target_launch estimate, dependency assumption)>

Approve? [Y/N/edit]
```

### Step 10: Post-approve

1. **Status → active, version++** (write file with status: active, version: <N+1>)
2. **BG extraction queued** (orchestrator reads bold terms from MVP body → bg-candidates.yaml)
3. **Decision journal entry** (Strategic level — per DEC-DEV-0013 #9):
   - Create `.product/.decisions/journal.md` if not exists
   - Append entry:
     ```markdown
     ## DEC-PLAN-NNN — MVP scope approved (primary HYP-<NNN>)

     Date: <ISO timestamp>
     Approved by: human
     Confidence: <level>
     Scope summary: <X MUST, Y SHOULD, Z COULD, N WON'T>
     Primary HYP: HYP-<NNN> — <one-sentence>
     Target launch: <date>
     Rationale: <brief>
     ```
4. **Update planning-progress.yaml** в orchestrator (not этим skill direct)

## Anti-patterns

1. **MUST = wishlist.** «Authentication, dashboard, search, profile, notifications, settings, search, export, ...» — это v1.0, не MVP. MVP MUST ≤8 items, ideally 3-5.
2. **Multiple primary HYP.** Невозможно validate two HYP independently через one MVP — данные конфликтуют. Pick ONE primary; secondary HYP может test'иться через MUST features incidentally.
3. **WON'T missing.** Если list пустой — push for explicit «what we're NOT doing». Без anchoring sent scope creep guaranteed.
4. **Implementation в scope.** «Build с PostgreSQL» — implementation detail, не MVP scope. MVP — про что фичу делаем, не как.
5. **Vague success.** «MVP achieved when users like it» — не falsifiable. Copy threshold from primary HYP exactly (numeric + time-bound).
6. **Fabricating target_launch.** Если effort estimates unknown — explicit «TBD, refine in D1.8 RL» в `confidence_notes`. Не выдумывай дату.
7. **Risks без mitigation.** «Adoption could be low» without «mitigation: launch с 5 pilot users from interviews». Pair каждый risk с action item.
8. **Variant field names.** Use canonical exactly (per DEC-DEV-0011); skill template above explicit.

## Confidence calibration (C2)

| Уровень | Когда применять |
|---|---|
| **high** | Primary HYP G5'd; MoSCoW chosen via dialogue (не AI guessed); risks pair'd с mitigations; target_launch consistent with feature complexity |
| **medium** | One+ из above incomplete (например target_launch estimate, или risks identified но mitigations sketchy) — но scope coherent |
| **low** | Primary HYP candidate (не G5'd), MoSCoW unverified, или target_launch totally guess — scope tentative, требует pilot |

## Examples

**Good MVP fragment (TranslateIT-style):**

```yaml
---
id: MVP
title: "MVP v1 — проверка готовности solo-creators платить за personal glossary"
status: active
primary_hypothesis: HYP-002
target_launch: 2026-07-15
confidence: medium
confidence_notes: |
  Primary HYP-002 clear (G5 approved 2026-04-20); MoSCoW disciplined
  (4 MUST, 2 SHOULD, 1 COULD); WON'T-have explicit (4 items с rationale);
  3 risks identified.
  Assumed: target_launch 2026-07-15 — estimate based on 4 MUST features
  и 1 dev. Refine after RL-001 detailed scoping.
created: 2026-04-26
updated: 2026-04-26
version: 1
---

## Primary hypothesis
HYP-002: Solo-creators (SEG-001) с personal glossary remain subscribed
во 2-м месяце на >+20pp выше vs without_glossary cohort.

## Success definition
≥+20pp retention delta (with_glossary vs without_glossary) на 2-м месяце.
Sample: N≥30 per cohort. Period: 3 months from MVP launch.

## Scope — MUST have
1. **Authentication** — без login невозможно cohort tracking для HYP-002
2. **Personal glossary CRUD** — core feature, проверяет HYP-002 directly
3. **Translation pipeline (basic)** — без translate работы — нет retention
4. **Cohort metrics dashboard** — нужно для measure delta retention

## Scope — SHOULD have
5. **Onboarding flow** — снижает activation friction; ускоряет cohort filling
6. **Glossary import (CSV)** — пользовательски удобно но manual workaround OK для MVP

## Scope — COULD have
7. **Glossary suggest from corpus** — приятный UX, но в pilot можно manual

## Scope — WON'T have (для MVP)
- **Team features** — SEG-001 = solo, не нужно для primary HYP
- **Mobile app** — web-first, mobile = v2
- **Voice cloning** — out of HYP-002 scope (это HYP-001, отложено)
- **Analytics export** — admin tool, не нужно для cohort metric

## Non-goals
- Не целимся в SEG-002 edu-centers (другие requirements)
- Не строим marketplace/community feature (другая бизнес-модель)

## Risks
1. **Cohort signup imbalance** — без random assignment trial flow get skewed
   - Mitigation: invite-only beta с manual cohort assignment first 30 users
2. **Glossary feature low adoption** — если users просто не используют → нельзя measure HYP
   - Mitigation: in-app prompt при первом translate; pre-populate с 5 sample terms
3. **Retention measurement gaming** — пользователи могут open app для login без real use
   - Mitigation: метрика «active session ≥3 min» а не just «logged in»

## Assumptions
- Translation API (Yandex/Google) stable
- Browser-only access acceptable для primary segment

## Rollout plan
- Internal alpha (2026-06-01): 5 dogfood users
- Invite-only beta (2026-07-01): 30 cohort participants
- Public launch (2026-07-15): general availability
- 3-month checkpoint (2026-10-15): measure HYP-002 result
```

**Anti-example:**

```yaml
---
id: MVP
title: "MVP — make awesome product"           # ❌ vague, не tied to HYP
primary_hypothesis: [HYP-001, HYP-002]        # ❌ multiple primaries
confidence_rationale: "..."                   # ❌ wrong field name (per DEC-DEV-0011)
target_date: 2026-07-15                       # ❌ wrong field name (target_launch для MVP; target_date для RL)
---

## MUST have
1-22. (22 фичи)                               # ❌ это v1.0, не MVP

## WON'T have
(пусто)                                       # ❌ scope creep guaranteed
```

## Related

- [`planning-session.md`](planning-session.md) — orchestrator (delegates to this skill)
- [`roadmap-planning.md`](roadmap-planning.md) — D1.7 (RM consumes MVP)
- [`release-planning.md`](release-planning.md) — D1.8 (RL-001 features list = MVP MUST)
- Artifact spec: [docs/pmo/artifacts/MVP.md](../../docs/pmo/artifacts/MVP.md)
- Process: [docs/pmo/processes.md §3.2 P1.B Planning](../../docs/pmo/processes.md)
