---
description: D1.5 step — formulate testable hypotheses using H.A.R.M.E.D. framework. 3-5 HYP with explicit thresholds.
---

# Hypothesis Formulation — D1.5 Skill

## Input

- Active SEG-* (with JTBDs)
- Active VP-* (per SEG)
- MR (queued for DRC, includes user behavior and market size claims)

## Goal

Produce 3-5 `.product/hypotheses/HYP-00N-*.md` artifacts in status=`testing` with explicit thresholds (success / invalidation / deferred zone). One tagged `priority: primary`.

## H.A.R.M.E.D. framework

Each HYP is structured как:

- **H** — Hypothesis (specific claim about reality)
- **A** — Assumption (what we take for granted for H to be true)
- **R** — Reasoning (why we believe H, what evidence или logic)
- **M** — Metric (how we'll measure H)
- **E** — Expected value (specific threshold)
- **D** — Decision (what happens at threshold crossing)

## Process

### Step 1: Identify assumption-risk hotspots

From VP, where are we making non-trivial leaps? Look for:

- **Behavioral assumptions** («users will switch from email to our inbox»)
- **Economic assumptions** («users will pay $X/month»)
- **Capability assumptions** («users can self-onboard in <5 min»)
- **Market assumptions** («this segment is underserved»)

Each risky assumption = hypothesis candidate.

### Step 2: Formulate candidate hypotheses

For each assumption, write H.A.R.M.E.D.:

```
HYP-001:
  H: Freelance translators are willing to pay $X/month for revisions centralization.
  A: Problem is painful enough to justify recurring payment (not one-time tool).
  R: PS pain (2-3h/week lost) → 10h/month. At translator rate $40/h = $400/month
     lost value. $X/month = trivial capture if product works.
  M: Conversion rate free → paid (over 3-month trial period).
  E: success ≥10%; invalidation <3%; deferred zone 3-10% (continue testing).
  D: Validated → grow MVP into MMP with pricing. Invalidated → pivot pricing or
     abandon SEG-001. Deferred → continue collecting data.
```

Target: 3-5 HYPs covering different risk dimensions. Don't all hypotheses have to be economic — include behavior, adoption, feature fit.

### Step 3: Balance HYP portfolio

Check coverage across dimensions:

| Dimension | Typical HYP |
|---|---|
| **Desirability** | «Users want this solution» (conversion, activation, retention) |
| **Feasibility** | «We can build это on solo budget» (internal; may not need external validation) |
| **Viability** | «Pricing works sustainably» (willingness to pay) |
| **Adoption speed** | «Users can self-onboard» (activation time, support tickets) |

3-5 HYPs should span at least desirability + viability. Feasibility обычно manageable в-house.

### Step 4: Formulate thresholds

Thresholds должны быть:

- **Numeric** — no «reasonable conversion»
- **Time-bound** — «over 3 months of testing»
- **Context-aware** — different tier (pilot vs MMP) = different threshold

Three zones:
- **success_threshold** — evidence enough to validate, invest more
- **invalidation_threshold** — evidence enough to invalidate, pivot or abandon
- **deferred_zone** — between the two — continue testing, не выводов yet

Example:
```
success_threshold: ≥10% conversion free → paid over 3 months
invalidation_threshold: <3% conversion
deferred_zone: 3-10% (continue data collection, consider variations)
testing_period: 3 months from MVP release
sample_size_minimum: 50 active pilot users
```

### Step 5: Suggest primary HYP

Primary HYP = «if this one fails, the entire premise fails». Usually:
- The biggest unknown
- The biggest potential invalidator
- The one whose success unlocks the most

Suggest one candidate with rationale. Human can overrule.

### Step 6: Present draft portfolio

```
Draft HYPs for your product:

🎯 HYP-001 (SUGGESTED PRIMARY): Freelance translators willing to pay for centralization
   H: ...
   A: ...
   R: ...
   M: Conversion rate free → paid
   E: success ≥10% | invalidation <3% | deferred 3-10%
   D: success → grow MMP | invalidation → pivot | deferred → continue

🎯 HYP-002: Email-native integration reduces onboarding friction
   ...

🎯 HYP-003: Multi-client view solves primary pain better than per-client tools
   ...

🎯 HYP-004: MVP feature set sufficient for first month of use
   ...

Portfolio covers: desirability (HYP-001, HYP-003), adoption (HYP-002), 
                  feature fit (HYP-004).

Primary candidate: HYP-001 — because failure would invalidate VP and force pivot.

Iterate? Adjust primary? Approve?
```

### Step 7: Iterate

Typical corrections:
- Thresholds too optimistic («10% conversion unrealistic for B2C tools — use 5%»)
- Wrong metric («conversion per month не captures engagement quality»)
- Missing dimension («we haven't tested willingness to change workflows»)

Adjust based on user + re-check portfolio balance.

### Step 8: Per-HYP approve (G5)

Per HYP:
- Status → `testing` (special HYP lifecycle, не `active`)
- Frontmatter includes:
  ```yaml
  id: HYP-00N
  type: hypothesis
  priority: primary | secondary | exploratory
  status: testing
  success_threshold: "≥10% conversion free→paid over 3mo"
  invalidation_threshold: "<3%"
  deferred_zone: "3-10%"
  testing_period: "3mo from MVP release"
  confidence: high | medium | low
  confidence_notes: "..."
  ```

### Step 9: Post-approve

- BG extraction
- Cascade check — MVP scope will reference these HYPs
- Journal: «HYP portfolio established — 4 HYPs, primary=HYP-001»

## Content rules per HYP artifact (see HYP.md)

- **Testable.** Human should be able to look at HYP и say «we'll know if this is true within 3 months».
- **Single claim.** «Users will pay AND use daily» = two hypotheses. Split.
- **Thresholds explicit.** Numeric + time-bound.
- **Deferred zone mandatory.** Не binary (success/invalidation) — real data is noisy.
- **Decision actionable.** Each HYP has «if X then Y» — не «если validated мы рассмотрим…»

## Confidence articulation (C2)

```
HYP-001 ready для G5 approve.

Confidence: medium
Rationale:
- Hypothesis based on PS pain (high) + translator economics reasoning (medium)
- Threshold 10% conversion — typical B2B SaaS, но untested в our niche
- Testing period 3 months — reasonable, но assumes MVP quality matches what attracts conversion
- Risk: we measure conversion но не WHY conversions happen — may validate H without learning what drives it

Approve или add complementary qualitative hypothesis (interviews etc)?
```

## Anti-patterns

1. **Wishful thresholds.** «30% conversion» — what's evidence basis? Typical is 2-10% для B2B SaaS.
2. **Binary decision.** No deferred zone = too rigid.
3. **Testing period too short.** «1 month» often не enough для adoption to settle.
4. **Vanity metrics.** «10k signups» measures discoverability, не product quality.
5. **Single dimension.** All HYPs only about willingness to pay — miss adoption/usability.
6. **Primary HYP bias toward easy.** Primary should be what most threatens the premise — не что easiest to validate.

## Examples

**Strong HYP:**
```
H: Freelance translators with 5+ concurrent projects (per SEG-001) will
   process revision batches 3x faster with our inbox vs current email workflow.
M: Time from revision arrival to resolution, measured in pilot study.
E: success ≥3x faster (median); invalidation ≤1.5x; deferred 1.5-3x.
D: success → this IS core VP, invest в polishing.
   invalidation → re-examine IF batch processing really pain, not our solution.
```

**Weak HYP:**
```
H: Users будут love our product.  ❌ not testable, no metric
M: User satisfaction.  ❌ what's the instrument?
E: High satisfaction.  ❌ what number?
```

## Handoff to D1.5z BG Extraction

After G5, HYPs are в testing. Discovery Session now complete содержательно. D1.5z is final BG extraction pass across всё — no new content, just vocabulary curation.
