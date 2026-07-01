---
description: Co-form a precise Research Brief with the requester (human OR AI) and set an upfront usefulness-metrics contract that gates the final synthesis. Pillars A+B of the Guided Research capability; front-end for /ecosystem:research.
---

# Research Intake — Skill for Ecosystem (Pillars A + B)

Turns a fuzzy ask into (A) a frozen **Research Brief** and (B) an upfront **usefulness-metrics
contract** that later **gates** the synthesis. This is the front-end that the existing research
loops (`deep-research`, `skills/integrator/research-protocol.md`, `skills/product/market-research-protocol-quick.md`)
were missing — they retrieve and triangulate well, but none negotiate scope first or score
**decision-usefulness**. Load this before any searching burns budget.

> **Load-bearing distinction:** *relevance ≠ usefulness.* Information can be accurate and on-topic
> yet change nothing for the requester's decision. Pillar B scores **fitness-for-application**, not
> just credibility.

## When to use

- The user (or an upstream AI agent) asks for research / "find out X" / "compare Y" and the request
  is broader than a single-fact lookup.
- Invoked by `/ecosystem:research` Step 1–2.
- **Skip** for a trivial fact you can answer directly — intake ceremony scales to the size and
  reversibility (stakes) of the decision the research feeds.

---

## Pillar A — Co-form protocol (human OR AI requester)

Goal: a frozen Research Brief. Mechanics:

1. **Ask the question behind the question first.** What *decision* does this research feed, and what
   will the requester *do* with the answer? This guards the XY problem (the requester usually hands
   you an attempted *solution* X, not the *goal* Y). Use neutral, open, non-diagnostic questions.
2. **Batch, don't interrogate.** ONE round of **≈3 (up to ~6) targeted questions**, ordered by
   information-gain (the axis that splits interpretations most evenly). *These counts are tunable
   defaults, not calibrated optima.* Gate each candidate question: *"would the answer change the
   structure, depth, or direction of the output?"* If no → take a conventional default and **state
   the assumption** instead of asking. (This mirrors the harness ITP T0/T1/T2 gate.)
3. **An empty brief slot is the trigger for a question.** Don't ask about slots you can infer from
   context / the codebase / prior session.
4. **Present an editable PLAN, then confirm** before retrieval starts. Cheap to correct scope now,
   expensive after search runs.
5. **Separate elicitation from decomposition.** A freezes *what* to answer; the loop (Pillar C /
   `/ecosystem:research` Step 3) decomposes the frozen brief into ordered sub-questions.

### Research Brief — explicit template

Produce this as markdown (Wave 1 is **markdown, not a formal PMO artifact** — keep the field names
stable so the form doesn't drift):

```markdown
# Research Brief — <short title>

- **objective:** <what question are we answering, in one sentence>
- **decision_it_feeds:** <the concrete decision/action this informs>
- **audience:** <who consumes the result — human role or which AI agent>
- **scope_in:** <what IS in scope — bullet list>
- **scope_out:** <explicit must-NOT-cover — bullet list>
- **constraints:**
  - deadline: <when needed / N-A>
  - recency_window: <how fresh must facts be, e.g. ≤6mo for pricing; N-A for stable theory>
- **deliverable_form:** <table | memo | ranked list | decision-brief | ...>
- **effort_budget:** <quick | deep>   # quick ≈ built-in search; deep ≈ fan-out loop
- **must_cover_checklist:** <the specific points the answer MUST address — bullet list>
- **prior_knowledge:** <what the requester already knows / has ruled out>
```

**Anti-patterns:** renaming slots "for naturalness" (breaks reuse — keep `scope_out`,
`decision_it_feeds`, `must_cover_checklist` verbatim); skipping `scope_out` (unbounded research is
the #1 waste); asking about slots you could infer.

### AI-requester mode

When the requester is another agent, the same brief is a **machine-readable object** (four core
fields: `objective + deliverable_form + scope (in/out) + constraints`). The callee returns an
explicit **`input-required`** state when a load-bearing slot is empty — it asks before guessing,
rather than silently defaulting. *Do not hardwire any inter-agent protocol as "the standard" —
adopt the concept of a structured task object with an input-required state.*

---

## Pillar B — Usefulness-metrics contract (the CORE)

The requester co-sets `goal`, weights, and thresholds **before** retrieval; the synthesizer then
promotes / demotes / flags / drops each finding against them.

### Two orthogonal axes, tagged on every finding (never collapse them)

| Axis | Meaning | Role |
|---|---|---|
| **Topical Relevance** (1–5) | aboutness / query match | **prefilter** — drop off-topic noise |
| **Decision Utility** (1–5) | does it move / de-risk the requester's decision? | **ranker + gate** — demote relevant-but-inert findings. Triage: *"if true, does this change the recommendation, ranking, or confidence?"* (High/Med/Low) |

### Tier-1 — HARD GATES (pass/fail; a failing finding is quarantined, cannot be a headline)

| Gate | Test | Default threshold (tunable) |
|---|---|---|
| **Faithfulness / grounding** | each atomic claim entailed by its cited source | 1.0 high-stakes, ≥0.8 exploratory |
| **Citation support** | every load-bearing claim carries ≥1 verifiable, dereferenced citation | pass/fail per claim |
| **Freshness** | volatile facts (pricing, tool maturity, availability) within the brief's recency_window | per brief; N/A for stable theory |
| **Corroboration** | ≥2 **independent** (non-shared-origin) sources for significant claims | ≥2 |

### Tier-2 — WEIGHTED 1–5 SCORE (requester sets weights + a minimum aggregate)

| Metric | Measures |
|---|---|
| **Decision-Utility** (usually highest weight) | advances the decision; synthesizes/prioritizes rather than enumerates |
| **Coverage** | `must_cover_checklist` items present; uncovered items surfaced as **explicit named gaps**, never silently dropped |
| **Independence / source-reliability** | grade the **source** separately from the **claim**; tag {independent-primary, independent-secondary, vendor/self-interested, echo}; collapse echo-sources to one |
| **Directness** | answers the asked question without padding |

Plus **Uncertainty-honesty** (pass/fail): stated confidence must be evidence-backed (corroboration +
faithfulness), never the generator's asserted tone.

### How it gates the summary

`aggregate = Σ(weightᵢ × scoreᵢ)` over Tier-2, subject to **all** Tier-1 gates passing. **Publish
per-dimension subscores, not just the total**, so a shortfall is diagnosable (retrieval gap vs
grounding gap vs utility gap). Emit an explicit verdict:

- **PASS** — all Tier-1 pass, aggregate ≥ requester's minimum → deliver.
- **PARTIAL** — delivers value but one dimension is short → deliver **and name the shortfall metric**.
- **SHORTFALL** — a Tier-1 gate fails or coverage is materially incomplete → do **not** dress it up
  as done; report what's missing and (if effort_budget allows) loop for more.

Never a silent "done." (The assistant renders PASS/PARTIAL/SHORTFALL in the project's language.)

### Metrics Contract — explicit template

```markdown
## Metrics Contract (frozen before retrieval)

- **goal:** <the decision goal g the usefulness is measured against>
- **tier1_gates:** faithfulness=<thr> · citation=on · freshness=<window> · corroboration=<n>
- **tier2_weights:** decision_utility=<w> · coverage=<w> · independence=<w> · directness=<w>
- **min_aggregate:** <e.g. 3.5/5>
- **stakes:** <low | high>   # high ⇒ tighter gates + ≥2 judges (see caveats)
```

### Caveats (carry these, don't hide them)

- Most scores are **LLM-as-judge-computed and uncalibrated** for a given domain — treat any 0–1
  number as directional, not ground truth. For high-stakes calls use **≥2 judges** or a neutral third.
- Full Value-of-Information (EVPI/EVSI) needs a decision model a brief rarely has — use the
  **High/Med/Low Decision-Impact proxy**, not a quantified VoI.
- The RAG-eval vocabulary (faithfulness, context precision/recall, citation accuracy) is real but
  cite the **constructs**, not any single framework as "the standard."

---

## Handoff

Frozen brief + metrics contract → the research loop (`/ecosystem:research` Step 3, reusing
`deep-research` / `research-protocol` / `market-research`) retrieves; then
`skills/ecosystem/anti-hype-filter.md` (Pillar D) filters each finding; then the synthesizer scores
against **this** contract and emits the PASS/PARTIAL/SHORTFALL verdict.
