# Orchestrator P2 — profiling study: 3-prior jury vs 1 general-purpose subagent

> **What:** a detailed audit of the P2 `decide-architecture-foundation` dogfood run (pilot
> session `4af995d1`, 7 real cross-spec-conflict forks) **plus** a controlled, blind,
> pre-registered A/B experiment answering the owner's question: **how profitable is P2's
> 3-profiled-subagent architecture jury (velocity/fidelity/integrity + deterministic
> veto/synthesis) versus 1 undifferentiated general-purpose (GP) subagent?**
>
> **Method instance of:** [`patterns/blind-comparison-protocol.md`](meta-improvement/patterns/blind-comparison-protocol.md)
> (the reusable unbiased-comparison pattern this study also codified). DEC-DEV-0132.
>
> **Honesty note:** I (the reviewer) built the P2 jury → I have a stake → I did **not** score.
> Two blind neutral judges + one adversarial red-team scored; I aggregate + disclose the
> disconfirming evidence and the design flaw I found.

---

## Part A — audit of the jury run (rubric P2-0…G)

Ground truth: the 7 P2 workflows in session `4af995d1` + the delivered PA resolution blocks +
the deterministic synth objects extracted from the workflow records.

| Fork | Strength | Rec | Owner action |
|---|---|---|---|
| PA-024 | none | — | correctly **punted** (under-specified — 1 directed action, not ≥2 options) |
| PA-027 | split | (1) durable audit column; (3) vetoed | — |
| PA-028 | split | (c) shape adapter | — |
| PA-029 | split | (a)/(1) extend EmailPort | — |
| PA-030 | strong | (1) defer Stripe | — |
| PA-040 | split | (a) BullMQ | **RATIFIED (a)** → DEC-PLAN-039 |
| PA-042 | strong | (a) add Task 5.x; (b),(c) vetoed | **RATIFIED (a)** → DEC-PLAN-040 |

**Grade — all PASS:**
- **P2-0 brief-fidelity / P2-A heterogeneity:** options lifted faithfully; the 3 lenses genuinely
  diverge (PA-042: fidelity vetoes (b), integrity vetoes (c) — two different lenses kill two
  different options — the sharpest possible non-groupthink signal).
- **P2-B deterministic synth — VERIFIED.** The `consilium-synth.cjs` output stored in each
  workflow matches the delivered PA matrix exactly (PA-042 `{strong, vetoed[b,c], ranked[a]}`,
  PA-040 `{split, vetoed[], ranked[a,b]}`, PA-027 `{split, vetoed[3], ranked[1,2]}`). The matrix
  is code, not eyeballed.
- **P2-C/D/E/F/G:** vetoes recorded with reasons; PA-040 split honestly priced the velocity
  dissent (incl. a self-critical "by worst-lens, (b) edges (a)" caveat); every delivery is a
  PROPOSAL (PA stays pending; DEC left DRAFT); panels complete 3/3; **owner ratified PA-040 +
  PA-042** on the strength of the packages — the strongest external signal the output is
  decision-grade.

**Verdict:** the P2 jury machinery works as designed — heterogeneous, faithful, bounded, and
its picks matched the owner. The interesting question is whether the machinery was *worth it*.

---

## Part B — the experiment (pre-registered, blind)

- **Arm A (jury):** the delivered P2 consilium output per fork.
- **Arm B (1 GP):** one **fresh** general-purpose subagent per fork, given the same fork,
  asked to weigh options + recommend, with a **mechanism-neutral** contract (the 3 priors were
  **not** disclosed — imposing them would inject the variable under test).
- **Pre-registration** (fixed before any Arm-B output): rubric D1–D6 (recommendation soundness /
  decisive-factor coverage / risk-veto detection / calibration / boundary-punt / actionability),
  a falsifiable null (H0 = profiling adds nothing measurable), and the blind-key.
- **Blinding:** both arms scrubbed of mechanism vocabulary, labelled Analysis-1/2 on a
  pre-committed randomized key; judges told to score content and ignore length/format. **Arm B
  outputs were LONGER than the jury's 6/7 times** — so "longer = the multi-agent one" was false,
  which muddies any length tell.
- **Judging:** 2 independent blind judges (all 7 forks each) + 1 de-anonymized adversarial
  red-team tasked to steelman the baseline.

### Results — blind judge scores (de-anonymized, /18)

| Fork | Jury (avg) | GP (avg) | Δ | driver |
|---|---|---|---|---|
| PA-024 | 12.0 | 18.0 | +6.0 | ⚠ **confound** — Arm A here is a terse process-punt, not a jury analysis |
| PA-027 | 17.5 | 17.5 | 0.0 | the one pick-DISAGREEMENT (jury→(1) ratified; GP→(2)); judges split |
| PA-028 | 16.5 | 18.0 | +1.5 | GP flagged (a) latent cross-feature hazard + "adapter already exists" |
| PA-029 | 16.0 | 18.0 | +2.0 | GP: "dunning targets users **not in the app**" → (2)'s premise is weak |
| PA-030 | 18.0 | 18.0 | 0.0 | tie — both DEFER, both flag traps must-not-ship |
| PA-040 | 16.0 | 18.0 | +2.0 | ⚠ **confound** — GP had a fact the jury's brief dropped (below) |
| PA-042 | 17.5 | 18.0 | +0.5 | near-tie |
| **Σ** | **113.5** | **125.5** | **+12** | |

**Inter-rater: strong.** Both judges independently placed the GP ≥ jury everywhere except
PA-027, and both localized the gap to exactly **D2 (decisive-factor coverage) + D3 (must-not-ship
detection)**; **D1, D4, D5, D6 were essentially even.** The adversarial red-team (tasked to favor
the GP) independently found the same: 6/7 identical dispositions, the GP reproduced **100% of the
jury's veto kill-list** with plain reasoning, and the jury's DEC-drafts / uniform format are the
one clear jury-only value — but it labelled those an **output-contract** property, not a
mechanism one.

---

## The confound (found by digging — the load-bearing caveat)

The D2/D3 gap is the input-sensitive part of the rubric, and **my design fed the two arms
unequal input**: Arm B (GP) read the **full raw PA**; Arm A (jury) saw a **lifted ForkBrief**
produced by P2's own Brief phase.

**Verified on PA-040 (the pivotal fork):** the jury's actual lifted brief
(`forkbrief_jury_PA-040_full.md`) does **not** contain the "apps/worker already runs BullMQ
(FM-001/FM-005)" fact, and its option-(a) line even calls the BullMQ worker **"NEW … Queue/
Worker"** — the brief-lift *dropped and mis-framed* the exact fact the GP used to win D2. So a
large part of the GP's factor-coverage edge is **input asymmetry, not "1 reasons better than 3."**

I own this as a design flaw (the arms should have had identical input). But it is not only an
artifact — it mirrors a **real P2 pipeline property: the Brief phase is lossy, and all 3
architects inherit that loss.** The jury is capped by the brief it is fed.

### Confound-check (controlled): a GP on the jury's OWN lossy brief

I ran a fresh GP on the *identical* lifted brief the jury saw. Result — and it cuts **against**
my jury, not for it:

- It still recommended **(a)** and called it a **CLEAR call** (the jury called it a **SPLIT**) —
  reasoning from governance + NFR-004, **without** the dropped house-consistency fact. So the
  jury's split was not caused by the missing fact; a holistic reasoner on the same input read it
  as a clear call.
- It **caught a must-not-ship the jury missed on the same input**: "ratifying the in-process
  `sleep()` backoff *as canon* structurally violates NFR-004 (a HIGH-confidence active pinned
  NFR)." The jury raised **no blocking concern** on (b) — it scored (b) merely "weak" (2/2 on
  fidelity/integrity) and summed it into a balanced split.

**Why the jury missed it (the mechanism finding):** independent fixed-lens scoring + a
deterministic *sum* trades away **holistic cross-lens integration.** No single architect vetoed
(b); each found it "weak" within its lens; and a sum of "weak, weak, strong-on-velocity" is a
*split*, not a veto. A single reasoner integrating across concerns sees "weak on governance AND
NFR AND still needs the drain → this is a clear call, and (b)-as-literally-posed is actually
unacceptable." The jury's guarantee that *every lens is heard* has a flip side: **nobody notices
that distributed weakness sums to a veto, or that one lens's fact undercuts another's score →
the mechanism can manufacture a balanced "split" and miss a distributed must-not-ship.**

(Scope of this specific finding: the controlled confound-check was run on **PA-040 (N=1)**. It is
a strong, non-confounded signal, but one fork — suggestive, not proven across the set.)

---

## Part C — the answer: how profitable is the 3-profiled jury vs 1 GP?

**For a capable single model (Opus) on well-posed forks, the profiling mechanism did not buy
proportional decision value on these 7 forks — and on the one input-controlled fork it was
slightly *worse*.** Decomposed:

| Dimension | 3-jury vs 1-GP | Confounded? |
|---|---|---|
| **The pick** | **Tie** — 6/7 identical; both hit both ratified anchors | no |
| **Veto coverage** | **Tie** — GP reproduced 100% of the jury's kill-list | no |
| **Calibration (clear vs split)** | **GP slightly better** — jury's independent-lens-sum manufactured a split a holistic reasoner called clear | no (confound-check) |
| **Distributed must-not-ship** | **GP better** — caught an NFR-violating option the jury scored "merely weak" | no (confound-check) |
| **Factor coverage (D2)** | GP ahead — but **largely input asymmetry** (GP read full PA) | **yes** |
| **Auditability / uniform record** | **Jury** — DEC drafts + touch-points + matrix | — (replicable by prompting 1 GP for the same artifacts) |
| **Reliability floor** | **Jury** — structural guarantee dissent is surfaced + non-forks refused | — (insurance, matters on a *variable/weaker* fleet) |
| **Cost** | **GP** — jury is ~4–7× the tokens | no |

**Net.** The jury's ROI is **insurance + auditability, not decision-quality uplift**:
- **Worth the 3 subagents when:** agent reliability is variable/untrusted (the structural
  dissent + non-fork-refusal guarantee floors a bad single agent); stakes justify insurance; or
  you need an auditable multi-perspective record.
- **Not worth it when:** you have one strong model and a well-posed fork — a single GP,
  **prompted for the same output artifacts** (recommend + score each option + flag unacceptable +
  clear-vs-tradeoff + DEC draft + touch-points), matched the picks and vetoes at ~⅕ the cost, and
  its holistic integration avoided the jury's manufactured-split / distributed-veto blind spot.

The mechanism's theoretical strength (heterogeneous perspectives, no groupthink) is real, but on
a strong base model its marginal decision value over one holistic pass was ~zero here, and its
independent-lens-then-sum structure carries a real, opposite-signed cost: **loss of cross-lens
integration.**

---

## Actionable findings for P2 (candidate improvements)

1. **The binding constraint is the Brief phase, not the jury.** The lossy lift dropped/mis-framed
   a decision-relevant fact on PA-040. Candidate fixes: let architects also see the raw PA (not
   only the distilled brief); or make the brief-lift lossless-by-contract on the enumerated facts;
   or add a "did the brief drop a load-bearing fact?" check. **Highest-leverage P2 improvement.**
2. **Distributed-veto blind spot.** `consilium-synth.cjs` sums scores; it has no rule for
   "unanimously *weak* (no lens strong) ⇒ escalate to review even absent an explicit veto." A
   holistic pass caught an NFR-violating option the sum treated as a viable split. Candidate: a
   synth rule that flags "no lens scores it ≥ N" as a soft-veto / re-examine trigger.
3. **These do not argue for deleting the jury** — they argue that the jury's value is
   insurance/auditability, and that a **holistic-integration pass** (one agent reading the raw
   fork after the panel) would plug its specific blind spot cheaply.

---

## Threats to validity (disclosed)

- **N=7, one product** (localization/glossary/billing forks); the controlled confound-check is **N=1** (PA-040).
- **Input asymmetry** (GP full PA vs jury lifted brief) — the dominant confound; partially
  corrected by the confound-check, which still favored the GP on non-confounded dimensions.
- **Judge & subjects share model lineage** (all Opus-class) → possible shared blind spots.
- **Only 2 owner-ratified anchors** (PA-040, PA-042); D1 on the other 5 rests on argument soundness.
- **A single strong base model.** The whole conclusion is conditional on that; on a weaker/variable
  agent population the jury's reliability floor is expected to matter more (untested here).

---

## Artifacts

Working set under the session scratchpad `…/p2-experiment/`: `PRE-REGISTRATION.md`,
`forkinput_PA-*.md` (arm inputs), `armA_PA-*.md` / `armB_PA-*.md` (the two arms),
`forkbrief_jury_PA-040_full.md` (the jury's actual lifted brief),
`armB2_PA-040_juryinput.md` (the confound-check), `RESULTS-aggregate.md` (de-anonymized scores),
`blind/` (anonymized judge pairs + key), `partA-audit-notes.md`.
