---
description: Mechanically filter harvested research claims — SIFT + provenance tiers + hype-signal scan + keep/DEMOTE/drop with an audit-trail — before they enter a synthesis. Pillar D of the Guided Research capability.
---

# Anti-Hype Filter — Skill for Ecosystem (Pillar D)

A mechanically-runnable pass over harvested claims that consolidates the anti-patterns already
scattered across `skills/integrator/research-protocol.md` (recency/star/single-source bias) and
`skills/product/market-research-protocol-quick.md` (triangulation, credibility, `[оценочно]` weak-claim
tagging), and adds the one behavior neither has: **down-weight with an audit-trail, don't silently
drop.** Feeds its results into the Pillar-B metrics contract (`skills/ecosystem/research-intake.md`).

## When to use

- After retrieval, before synthesis, in `/ecosystem:research` Step 4.
- Any time you're about to fold web/search findings into a decision-facing summary.
- Especially for **tool/vendor** research and **hype-prone** domains (AI, "SOTA", "10x", pricing).

---

## Per-claim pipeline

Run each harvested claim through these steps:

**0. Atomize.** Split into atomic claims; keep every number/quote bound to its citation. A paragraph
   is not a claim — its individual assertions are.

**1. SIFT gate.**
   - **Stop** — don't propagate before checking.
   - **Investigate the source laterally** — what do *other* sources say about *this* source? (The move
     that separates fact-checkers from students. A vendor's own page is not evidence about the vendor.)
   - **Find better coverage** — is there a more independent / more primary source for the same claim?
   - **Trace to origin** — follow every load-bearing claim/number to its primary source. "Three blogs
     say X" is often one press release echoed three times.

**2. Provenance tier.** Classify: primary / secondary / tertiary / **marketing** (a vendor describing
   its own product or benchmarking itself = marketing, regardless of polish).

**3. Hype-signal scan** (binary flags):
   - H1 superlatives / hyperbole ("game-changer, 10x, next-gen, industry-leading, SOTA")
   - H2 unfalsifiable / vague claim
   - H3 vendor-funded / conflict-of-interest
   - H4 citation-less number
   - H5 novelty / recency as proof ("the newest, therefore the best")
   - H6 bandwagon / **star-bias** (GitHub stars ≠ fit)
   - H7 spin (null result → "effect"; causal language on observational data)
   - H8 self-benchmark cherry-pick (vendor picks the queries, the judge, and the metric, then "wins")
   - *Caveat:* the superlative lexicon needs project-domain tuning to avoid false positives on
     **legitimate** technical superlatives; a flag is a signal, not an automatic kill.

**4. Triangulate by independence.** Count *independent* converging sources; collapse shared-origin
   ones to a single source. Vendor A citing vendor A is n=1, not n=2.

**5. Faithfulness check.** Does the claim actually follow from its cited context? Use an LLM-judge (or
   a lighter NLI classifier) with bias guards: **swap the order and require agreement**, use an
   explicit rubric + reference. The judge is **one signal, not the sole arbiter.**

**6. Decide — keep / DEMOTE / drop** (GRADE philosophy: move certainty by discrete levels, always with
   a recorded reason):
   - **KEEP** (full weight): provenance ≥ secondary AND ≥2 independent sources AND faithfulness pass
     AND zero *severe* flags (H3 / H4 / H7 / H8).
   - **DEMOTE** (down-weight + caveat + audit-line): single-source, marketing-origin, 1–2 flags, or
     judge/human disagreement → record *why*, lower confidence 1–2 levels, **surface as a caveat** in
     the synthesis (not as a headline).
   - **DROP** (exclude but **still log**): faithfulness fail / fabricated-or-dead citation /
     (unfalsifiable AND citation-less AND vendor-only) / contradicted by higher-tier evidence.
   - **Never silently drop** — every demote/drop writes a one-line rationale (this is the audit-trail).

**7. Compose into the Pillar-B contract:**
   - H1/H2/H5/H6 + spin → down-weight **independence**
   - H3/H8 + weak tier → down-weight **provenance**
   - triangulation count → **corroboration** (Tier-1 gate)
   - faithfulness + calibrated confidence → **uncertainty-honesty**
   - H4 / dead-citation → cap **provenance** at marketing tier

> **Key property:** a finding can be high-relevance AND high-usefulness and still be **demoted to a
> caveat** if independence/provenance fail. Usefulness and credibility are orthogonal — score both.

---

## Audit-trail format

Every non-KEEP decision appends one line so the synthesis is auditable:

```
- [DEMOTE] "<claim, trimmed>" — single-source (marketing tier), H1+H8; confidence high→low. src: <url>
- [DROP]   "<claim, trimmed>" — faithfulness fail: source says X, claim says Y. src: <url>
```

Demoted claims still appear in the synthesis **as caveats**; dropped claims are excluded from the
body but listed in a short "Filtered out" appendix (so nothing vanishes without a trace).

## Anti-patterns

1. **Silent drop.** Removing a claim with no logged reason — reads as "we covered everything" when we
   didn't. Always log.
2. **Trusting an aggregator as independent corroboration.** SEO reposts of a vendor's numbers are the
   same source, not a second one.
3. **"Everyone wins their own benchmark."** Non-comparable metrics (F-score vs accuracy on different
   sets) do not establish a ranking — say so, don't smooth over.
4. **LLM-judge as verdict.** The judge is one input; triangulation + provenance sit above it.
5. **Killing legitimate technical superlatives.** H1 is a signal to check, not an automatic drop —
   tune the lexicon to the domain.
