---
description: Guided Research — co-form a precise brief + usefulness-metrics contract, run a skeptical research loop over the existing stack, filter hype, and synthesize a cited answer scored against the contract. Read-only.
argument-hint: "<what you want to find out>"
---

# /ecosystem:research

User invoked: `/ecosystem:research $ARGUMENTS`

You are running **guided, read-only research**. You do **not** act on findings, install anything, or
mutate project files — you produce a cited, metric-scored answer and let the user decide. This is the
thin orchestrator for the **Guided Research** capability; the methodology lives in two skills — load
both:

- `.claude/skills/ecosystem/research-intake.md` — Pillars A (co-form brief) + B (usefulness-metrics contract)
- `.claude/skills/ecosystem/anti-hype-filter.md` — Pillar D (keep/DEMOTE/drop + audit-trail)

The retrieval loop (Pillar C) **reuses** what's already installed — do not rebuild it.

## Process

### Step 1: Intake — co-form the Research Brief (Pillar A)

Load `research-intake.md`. If `$ARGUMENTS` is broader than a single-fact lookup, run the co-form
protocol: ask the question-behind-the-question, then **one batch of ≈3 (≤6) questions** gated by
information-gain. Fill the Research Brief template. **Skip questions you can infer** from context; for
each skipped slot, state the assumption in one line. Present the brief + an editable plan; **confirm
before searching** (silence is not consent — wait).

> If the requester is an upstream AI agent, accept the brief as a machine-readable object and return
> an explicit `input-required` state for any empty load-bearing slot instead of guessing.

### Step 2: Metrics contract (Pillar B)

Co-set the usefulness-metrics contract with the requester (Tier-1 hard gates + Tier-2 weights +
`min_aggregate` + `stakes`). Fill the Metrics Contract template. **Freeze it before retrieval.** For
`stakes: high`, plan for ≥2 judges on faithfulness.

### Step 3: Skeptical research loop (Pillar C — reuse, don't rebuild)

Decompose the frozen brief into ordered sub-questions, then retrieve using whatever is installed,
in this order of preference:

1. **`deep-research`** skill — for `effort_budget: deep` (fan-out → fetch → adversarial verify).
2. **`skills/product/market-research-protocol-quick.md`** — for market/competitor/user-behavior needs.
3. **`skills/integrator/research-protocol.md`** — for tool/technology needs.
4. **MCP stack when present** — Brave / Exa / Firecrawl / Context7 / Memory (installed by
   `/ecosystem:bootstrap` in consumer projects). **Fallback** to built-in `WebSearch` / `WebFetch`
   when MCPs are unavailable — note reduced structure in the output.

Loop is **bounded by the brief's Definition-of-Ready** (Tier-1 gates + coverage met), not "until it
tires." Fan out to parallel angles **only under a declared scope** (subject + angles) — inherit the
consilium-scope gate from `research-protocol.md`; otherwise stay single-stream. Escalate a shortfall,
do not fabricate closure.

> A dedicated citation-first answer-engine (e.g. Perplexity Sonar) is a **future (Wave 2)** addition,
> not yet wired — do not assume it. Use the stack above.

### Step 4: Anti-hype filter (Pillar D)

Load `anti-hype-filter.md`. Run every harvested claim through the per-claim pipeline
(atomize → SIFT → provenance tier → hype-scan → triangulate → faithfulness → keep/DEMOTE/drop).
Write the audit-trail. Demoted claims survive **as caveats**; dropped claims go to a "Filtered out"
appendix.

### Step 5: Score against the contract + synthesize

Score each surviving finding on the two axes (Relevance, Decision-Utility) and the Tier-1/Tier-2
metrics. Synthesize a cited answer in the brief's `deliverable_form`. **Publish per-dimension
subscores**, not just a total, and end with an explicit verdict:

- **PASS** — Tier-1 all pass, aggregate ≥ `min_aggregate`.
- **PARTIAL** — delivered, but **name the shortfall metric** (e.g. "corroboration short on claim X").
- **SHORTFALL** — a Tier-1 gate fails / coverage materially incomplete → report what's missing; if
  `effort_budget` allows, loop back to Step 3 for the gap.

(Render PASS/PARTIAL/SHORTFALL in the project's language.)

### Step 6: Approve gate (Silence is NOT consent)

After presenting the scored synthesis, stop:

```
STOP. What next?
  [use]     accept this research to inform <decision_it_feeds>
  [deeper]  loop on a named gap: /ecosystem:research "<refined brief>"
  [details] expand any finding / its score / the filtered-out list
  [cache]   save this research for reuse
```

No action beyond Step 7 caching without an explicit user response. If the user is silent, wait.

### Step 7: Cache (optional, on request or for deep runs)

Save to `~/.claude/integrator/research-cache/<YYYY-MM-DD>-<slug>.md` (create the dir if missing) — the
frozen brief, the metrics contract, the scored findings + verdict, sources with URLs, and a date for
staleness (research expires after ~7 days for re-validation). This cache is **global** — reusable
across projects.

## Constraints

- **READ-ONLY.** No installs, no config or file changes outside the research cache.
- **No fabrication.** If a claim isn't verified in a source, mark it low-confidence or drop it — never
  invent pricing, maturity, or benchmark numbers (they change fast; verify live).
- **Cite everything load-bearing.** Every significant claim carries a dereferenced URL.
- **Respect project tier.** For `validation_tier: pilot`, bias toward simple/mature and a `quick`
  effort budget unless the user asks for depth.
