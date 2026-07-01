# Blind Pre-registered Comparison

> **Status:** provisional (1 instance — the P2 3-jury vs 1-GP profiling study, DEC-DEV-0132).
> For **qualitative / semantic / otherwise non-mechanical comparison** where the verdict is a
> judgment, not a passing test — and *especially* where the evaluator has a stake in the outcome.

## When applicable

- Comparing two (or more) approaches / outputs / designs on **quality**, where "better" is a
  semantic judgment (decision quality, writing, design soundness, review thoroughness), not an
  objective check.
- **Trigger amplifier — evaluator has a stake:** you built one arm, proposed one approach, or
  would look good if a particular side wins. Stake ⇒ high bias risk ⇒ this protocol is
  mandatory, not optional.
- Typical cases: "is A better than B", "did my change improve the output", "N specialized agents
  vs 1 generalist", prompt/model A/B, scoring design options, "is the expensive path worth it".

**NOT for** (skip — no blinding needed): mechanical / objective checks — does it compile, does the
test pass, is the number larger, is the file present. Reserve the ceremony for judgments that can
be rationalized.

## Steps

1. **Pre-register BEFORE producing or seeing the compared outputs.** In a timestamped doc, fix:
   the **rubric** (named dimensions + a 0–N scale), a **falsifiable null hypothesis** ("no
   measurable difference" — stated concretely), and **what result would confirm vs reject it**.
   The rubric predating the data is the anchor — you cannot rationalize toward a preferred answer
   if you committed the yardstick first.
2. **Symmetric conditions — vary only the independent variable.** Same inputs, same output
   contract, same budget / model tier for both arms. **Equalize the INPUT explicitly** — give both
   arms the *identical* source, not "arm A's distilled brief" vs "arm B's raw source" (see
   anti-pattern 4; this is the exact flaw the P2 study caught in itself).
3. **No treatment leakage into the baseline.** Do NOT inject the very thing under test into the
   control's instructions (testing "3 fixed lenses vs 1 generalist" ⇒ do NOT tell the generalist
   the 3 lenses). The baseline gets the *job*, not the *mechanism*.
4. **Separate the roles: producer ≠ judge ≠ stakeholder-aggregator.** If you built an arm, you do
   **not** score. Neutral judge sub-agents score.
5. **Blind the judge.** Symmetric-scrub provenance / mechanism tells from **both** outputs, label
   them neutrally (Analysis-1 / Analysis-2), and **randomize which is which per item** on a
   **pre-committed, judge-hidden key** (alternate the treatment's slot across items so the judge
   can't deduce "slot-1 is always the new one"). Instruct the judge to score **content** and to
   explicitly **ignore length, format, structure, vocabulary** (in the P2 study the *baseline* was
   longer 6/7 times — length tracked nothing).
6. **≥2 independent judges + 1 adversarial pass.** Two blind judges give inter-rater reliability.
   Then a de-anonymized **red-team** tasked to argue FOR the side you would be biased *against*
   ("steelman the baseline; find where the expensive arm is ceremony, not signal").
7. **Investigate the delta before believing it.** When one arm wins on a dimension, **verify the
   winning claims against the source** and ask "is this a mechanism difference or a confound
   (input richness, length, format)?" Run a **controlled follow-up** that removes the suspected
   confound (in the P2 study: re-run the baseline on the *treatment's own input* to separate
   "reasons better" from "had more to read"). A surface score gap is a hypothesis, not a verdict.
8. **De-anonymize, aggregate, disclose.** Report per-dimension **effect sizes** (not a bare
   verdict), inter-rater agreement, **every item where the baseline matched or beat your preferred
   arm**, and every validity threat (N, scope, residual leakage, shared model lineage, the input
   asymmetry).

## Outputs

- A **pre-registration** doc (rubric + hypotheses), timestamped before any compared output exists.
- **Per-item blind scores** from ≥2 judges + an adversarial critique + a confound investigation.
- An **aggregate**: per-dimension effect sizes, inter-rater agreement, disconfirming evidence
  surfaced, threats disclosed — and a verdict that *could have gone the other way* (falsifiable).

## Anti-patterns

1. **Post-hoc rubric** — deciding what "better" means after seeing results → you fit the yardstick
   to your preferred winner.
2. **Self-judging** — the builder scores their own arm → confirmation bias, every time.
3. **Un-blind judging** — the judge knows which is the new / preferred one → halo effect.
4. **Asymmetric inputs / contract** — one arm gets richer context or a weaker task spec. The
   subtlest and most damaging: the P2 study first gave the baseline the *full raw source* while the
   treatment saw a *distilled brief*, so the baseline's factor-coverage "win" was partly just
   having more to read. **Caught only by the confound investigation (step 7).** Equalize inputs.
5. **Treatment leakage** — handing the control the mechanism under test → the arms converge and you
   "prove" nothing.
6. **Single judge** — one judge's noise/bias becomes the result; no reliability signal.
7. **Believing the surface score** — accepting the raw delta without asking "mechanism or
   confound?" A win you can't reproduce under equal input is not a mechanism win.
8. **Report only confirmations** — hiding the items where the baseline won re-introduces the exact
   bias the protocol exists to remove.

## Examples (instances)

- **P2 profiling study (DEC-DEV-0132, `dev/ORCHESTRATOR_P2_PROFILING_STUDY.md`):** 3-profiled
  jury vs 1 GP on 7 architecture forks. Pre-registered D1–D6 rubric, mechanism-neutral baseline
  contract, symmetric scrub + randomized blind key, 2 blind judges + 1 adversarial steelman.
  Surface result (GP ≥ jury) survived to a nuanced verdict only *because* step 7 caught the
  input-asymmetry confound and a controlled re-run (GP on the jury's own brief) separated the
  input effect from a genuine mechanism finding. Without the confound investigation the study would
  have over-claimed.
