# Adjudication Policy — single judge, verified premises, reverse pass

> **Status:** validated (owner-ratified default 2026-07-30, DEC-DEV-0230; embodied in code —
> P6 deviation-triage, DEC-DEV-0231; canonized as the general judging rule — DEC-DEV-0233).
> The **default policy for adjudicating ONE open fork/decision**: a single pinned judge with
> mandatory premise verification and a reverse pass. A consilium (jury) is **demoted to an
> opt-in instrument convened only on the owner's explicit request** — it is not the default.

## When applicable

- Preparing a verdict on **one open fork**: fix-forward vs re-derive, option A vs option B of an
  escalated decision-PA, "is this deviation acceptable", GO/NO-GO-shaped judgment calls that a
  script cannot express.
- Any place a process or a session is about to **convene multiple agents to "decide together"** —
  this policy is the gate you pass first: default to ONE judge; a jury needs the owner's explicit
  request.

**NOT for:**
- **Comparing arms on quality** ("is A better than B", A/B studies, judged evaluations of two
  outputs) — that is [Blind Pre-registered Comparison](blind-comparison-protocol.md) (≥2 blind
  judges, pre-registration). The two patterns are complementary, not competing: *comparison* of
  systems vs *adjudication* of one question.
- **Mechanically checkable outcomes** — script > judge, always (analysis-plan §9 rule). If a
  test/oracle can express the verdict, no judge convenes at all.

## The policy (rules, in force)

1. **Script > judge.** Before convening anyone: can the verdict be computed? A deterministic
   check beats any adjudication (П-2, «механику — скриптам»).
2. **The D027 gate — "is the question already ratified?"** Before ANY convening, verify the
   question is still open against the decision registers (the PA's `Status:`, DEC-DEV/DEC-PLAN
   records, the journal tail). Precedent: 1 of 6 consilium runs in the M13 corpus re-judged a
   fork ratified 16 days earlier — 3.38M tokens of pure waste, avoidable by one `Status:` read.
   Code embodiment: `product/processes/consilium.mjs` D027 gate (refuses a ratified/closed PA
   before the fan-out).
3. **One judge, pinned model, judge ≠ author.** A single judge on a fixed, explicitly pinned
   model (kept identical across re-runs of the same question — the Wave-2 confound lesson);
   the judge must not have produced the material it judges.
4. **Premise verification FIRST.** The judge re-checks every load-bearing premise against ground
   truth (code/tests/spec/registers) *before* judging — a verdict built on an unverified premise
   is void. This is the exact failure that broke the M13 jury both times: N jurors sharing ONE
   unverified premise read as N independent confirmations (defect D025), and both jury errors
   were curable by a single premise check.
5. **Reverse pass.** Before finalising, the judge writes the strongest case FOR the option it is
   NOT recommending (a `counter_case`), and only then commits. Not a formality: in M16 the
   reverse pass flipped 2 of 6 axes.
6. **Prepare-only on owner-class questions.** The judge recommends; the OWNER ratifies. The
   verdict lands as a non-blocking package (PA route), never as an applied decision.
7. **A consilium is opt-in.** A heterogeneous jury (P2 `decide-architecture-foundation`,
   `/product:consilium`) remains available as an *instrument*, convened only when the owner
   explicitly asks for one. Before its first new convening, close its two open defects:
   D025 (the aggregator drops `risks_of_recommendation`, where a disqualifying fact lived) and
   D026 (no cost/velocity lens — the most expensive option can win unanimously with its price
   unweighed). Until then, its verdicts inherit those defects.

## Evidence (why single-judge is the default)

- **M13 (`dev/global-loop/analysis/M13_CONSILIUM.md`):** re-judging 6 consilium decisions —
  jury agreement with the owner-ratified outcome 4/6, single judge 5.5/6, at a jury price of
  24.5M tokens; both jury misses carried a `strong/unanimous` label; the disqualifying facts sat
  in the jurors' own prose and were dropped by the aggregator (D025).
- **M16 (`dev/global-loop/analysis/M16_RESULT.md`):** single blind judge + reverse pass held up
  in a controlled A/B; the reverse pass alone flipped 2 of 6 axes.
- Vision-D research prior: a jury on a single connected decision loses to one good opinion
  (~15× cost + groupthink) unless it is a heterogeneous *preparing* jury — and even then only
  on a genuinely fork-shaped, still-open question.

## Anti-patterns

1. **Convening on a closed question** — skipping the D027 gate; the run is waste at best,
   contradiction of the ratified record at worst.
2. **Unverified premises** — judging on the findings' own claims without re-checking ground
   truth (D025's root); unanimity built on one shared false premise is not confidence.
3. **Jury-by-default** — reaching for a panel because the question feels important; importance
   routes to the *owner* (prepare-only), not to more agents.
4. **Judge = author** — the producer of the material grading it.
5. **Unpinned / drifting judge model** — comparing verdicts across runs judged by different
   models; pin one model per question.
6. **Skipping the reverse pass** — a verdict that never argued the other side is a first-draft
   opinion, not an adjudication.

## Examples (instances)

- **P6 deviation-triage (`orchestrator/processes/validate-feature-impl.mjs`, DEC-DEV-0231):**
  the embodied core — single pinned judge, `premises_verified` required by schema, `counter_case`
  reverse pass, prepare-only PA route; wiring-pinned by
  `tests/orchestrator/validate-feature-impl-wiring.test.cjs`.
- **`product/processes/consilium.mjs` D027 gate (DEC-DEV-0233):** ratified/closed PA → refusal
  in code before any jury spawn; wiring-pinned by `tests/product/consilium-wiring.test.cjs`.
- **M13 / M16** — the measurement studies behind the demotion (see Evidence).
