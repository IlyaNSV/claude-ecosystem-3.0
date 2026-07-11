---
description: "Orchestrator P2 methodology — run an undecided architecture fork through a heterogeneous JURY of 3 priors (velocity/fidelity/integrity), synthesise their structured verdicts DETERMINISTICALLY (matrix + rank + veto-by-blocking, à la remediation-guard) and surface the real trade-off, then hand the OWNER a scored recommendation + a DRAFT DEC — never an auto-decision. Backed by orchestrator/lib/consilium-synth.cjs. Load during /orchestrator:run decide-architecture-foundation."
---

# architecture-consilium — an architecture fork as a jury verdict (P2 / RA-1)

P2 `decide-architecture-foundation` is **decision SUPPORT**, not a decision. It takes an
already-posed architecture fork (best: a cross-spec-conflict pending-action that already
enumerates the options) and compresses it to a decidable shape — *options × lenses × risks
× recommendation + the surfaced split* — that the **owner ratifies**. It never picks the
architecture for you.

> Grounding: SPEC §3.2 (P2 slot, "scope-defining gate") + §3.3 RA-1
> (`architecture-consilium`, priors velocity/fidelity/integrity); the ratified design
> DEC-DEV-0127 (`dev/_archive/orchestrator/ORCHESTRATOR_P2_KICKOFF.md`); Vision Epic D (a consilium is a **jury**,
> not a debate); RUN 01 E1 (`dev/ORCHESTRATOR_DOGFOOD_RUN_01.md` #129–184, the fork once run
> by hand).

## Why support, not auto-decide (the load-bearing boundary)

- The whole ecosystem routes architecture decisions to the owner (FB-LR-07 /
  `remediation-guard` escalate-don't-self-resolve). An auto-deciding P2 would become exactly
  the **unilateral resolution** the gates forbid.
- The research behind Vision D: a consilium **loses** on a single connected decision (~15×
  cost + groupthink) **unless** it is a heterogeneous jury that **prepares** the decision
  rather than taking it for the user. "100% coverage of the path with gates at the
  boundaries", not "100% autonomy."

**P2's autonomy is in the QUALITY of preparation; its obedience is in WHO makes the final
call** ([[project_autonomy_obedience_balance]]). It emits a recommendation + a **DRAFT** DEC
into the fork's pending-action. The owner ratifies → flips the PA → commits the DEC → edits
the specs (or orders P3/P5 to implement the chosen option). **P2 never edits a
spec/design/tasks file, never closes the PA, never finalizes a DEC.**

## The determinism boundary

The verdict comes from CODE; the narrative comes from the prompt. Two layers, in order:

1. **Layer-3 (deterministic — `consilium-synth.cjs`):** the matrix, the rank, and the veto.
   The Workflow runs the lib via Bash and **relays** its JSON — it does not eyeball which
   option wins.
   ```bash
   node .claude/orchestrator/lib/consilium-synth.cjs \
     --verdicts-file <the 3 ArchVerdicts as JSON> --options a,b,c
   # → { recommended, strength: strong|split|none, matrix, ranked, survivors, vetoed, ... }
   ```
2. **Layer-2 (semantic — the prompt):** given that fixed matrix, formulate `the_real_tradeoff`
   on a split, the `rationale`, the `dec_draft`, and `applies_to`. **The prompt may explain
   the recommendation; it may not change it.**

## The jury — 3 fixed priors, no cross-talk

Three architects run in `parallel()`, each seeing **only** the ForkBrief, each voting
**independently**. Heterogeneity is the condition under which a panel beats one opinion;
cross-talk collapses it to groupthink. There is **no consensus round** — a jury, not a debate.

| Prior | Lens | Optimises for | Its blind spot |
|---|---|---|---|
| **velocity** | delivery speed / simplicity / time-to-feedback | reaching working software fastest | may ship a shortcut that leaves a seam |
| **fidelity** | faithfulness to specs / steering / design mandates | least drift from what is documented | may defend a documented choice that reality has outgrown |
| **integrity** | runtime integrity / correctness / no dead seam | the system actually working end-to-end | may over-build for a risk the product does not carry |

Each architect must be **honest about its own prior's blind spot** in
`risks_of_recommendation` — that is what makes the split legible to the owner.

(v1 is a fixed 3-prior panel. A configurable panel — cost, security — is post-v1,
DEC-DEV-0127 §9.3.)

## The ArchVerdict — the structured input that makes synthesis deterministic

Each architect returns EXACTLY this shape (the synthesis reads these field names — do not
rename them):

```
ArchVerdict {
  prior:                     velocity | fidelity | integrity
  scores:                    { <option_id>: 0..5 }   // this lens's score for EACH option
  recommended_option:        <option_id>             // the top under THIS lens
  risks_of_recommendation:   [ "<what my lens pays for my pick>" ]
  blocking_concerns:         [ { option_id, concern } ]   // a VETO — see below
}
```

**Anti-patterns (field-name drift the model is prone to — all FORBIDDEN):** do NOT emit
`recommendation`/`pick`/`choice` instead of `recommended_option`; `veto`/`blockers`/`rejected`
instead of `blocking_concerns`; a bare option-id string instead of `{ option_id, concern }`;
`ratings`/`weights` instead of `scores`. A drifted field is silently dropped by the
deterministic synthesiser → a lost veto or a mis-ranked option.

## The rule the synthesiser applies (worst-of by blocking, sum by scores)

- **VETO (worst-of, conservative):** an option that **any** prior lists in
  `blocking_concerns` is **vetoed** — it cannot be the recommendation (you may not recommend
  an option one lens calls unacceptable). A `blocking_concern` is a genuine "this must not
  ship" — **not** "I mildly dislike it." The veto is **recorded**, never hidden.
- **RANK among survivors:** by summed per-prior score, descending; tie-break by the option's
  **worst** prior score (higher floor wins), then id. The top survivor is the recommendation.
- **STRENGTH:**
  - `strong` — the **full panel** (all 3) recommends the **same surviving** option →
    ratification is near-formal.
  - `split` — the lenses diverge (or the top option is vetoed by some lens). The
    recommendation is the top-by-sum survivor, and **the divergence is the product**: P2
    surfaces the trade-off the owner must weigh, it does not force consensus. **A split is not
    a bug of the synthesis — it IS the decision.**
  - `none` — **every** option is vetoed. There is no clean pick; the veto set is the finding
    to escalate (harder than a split — the fork must be re-posed).
- **Panel honesty (fail-loud):** if fewer than 3 priors report (an architect died), the run
  is **never** promoted to `strong` (`panel_complete:false` is disclosed).

## Anti-patterns

1. **Deciding for the owner.** P2 recommends; the owner ratifies. Editing a spec, closing the
   PA, or finalizing the DEC is out of bounds — that is the unilateral resolution the gates
   forbid.
2. **Eyeballing the winner.** The matrix/rank/veto come from `consilium-synth.cjs`. Relay its
   JSON; do not re-rank by hand.
3. **Forcing consensus on a split.** Papering over a divergence hides the exact thing the
   owner needs to see. Surface `the_real_tradeoff`; do not smooth it away.
4. **A debating panel.** Architects vote independently — no cross-talk, no consensus round. A
   homogeneous or coordinated panel is groupthink at ~15× the cost of one opinion.
5. **Inventing an option.** P2 weighs the fork **as posed**. If it enumerates fewer than 2
   options it is under-specified — surface that (route the spec-author/owner), never fabricate
   a second option to manufacture a decision.
6. **A blocking_concern for a preference.** A veto removes an option from contention. Reserve
   it for "unacceptable", or a mild dislike silently kills a viable option.
