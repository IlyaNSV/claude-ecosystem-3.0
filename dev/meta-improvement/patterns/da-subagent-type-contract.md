# Pattern: DA Subagent-Type Contract

> **Status:** provisional (codified DEC-DEV-0064, 2026-06-12, from Session Audit v2 clusters `D2B-behavioral::C` + `::B`). Promote to **validated** after the live-harness registration step (DEC-DEV-0043 R4) closes and one pilot session confirms no `general-purpose` fallback.

## Name

**DA Subagent-Type Contract** — every Devil's Advocate review (P-RULE-01 IC→DA, P-RULE-02 BR→DA), in **both** the hook-driven (`feature-session.md` F.3/F.5) and manual (`/product:da-review`) paths, spawns **`subagent_type: "product-devils-advocate"`** and treats an «Agent type not found» reply as a **loud blocking setup error**, never a silent fallback to `general-purpose` + role-adoption.

## Why this exists

Two converging Session Audit clusters (≥3 instances each, across ≥3 product sessions / 2 dates), adversarially verified:

- **`D2B-behavioral::C`** (batched BR→DA): F.3 produces a *cluster* of BRs (9, 13…) and operators ran one batched DA via `Agent({subagent_type: "general-purpose"})` pointed at the DA spec — because the skill gave no canonical batched invocation to copy.
- **`D2B-behavioral::B`** (IC→DA): the harness replied «Agent type 'product-devils-advocate' not found» and the assistant **silently** degraded to `general-purpose` + a «STEP-0 role-adoption» prompt (`DEV_JOURNAL.md` DEC-DEV-0038 «системное #2», DEC-DEV-0043 E1; recurring «S8 P1 regression»).

`general-purpose` produces adversarial *content* but loses what makes the registered agent correct: the `model: claude-opus-4-8` pin, the `tools:` restriction, the isolated Builder/Critic separation, and the canonical `.da-findings/` schema guarantee.

## When applicable

✅ **Applicable triggers:**
- Authoring/refactoring any skill or command that spawns the DA subagent (`feature-session.md`, `product-da-review.md`, future Design-DA).
- Any hook-driven DA path off `br-change-trigger.js` / `ic-change-trigger.js` stderr signals.
- Reviewing a session where DA was run — audit check: was `subagent_type` canonical?

❌ **NOT applicable:**
- Non-DA subagents (tool-profiler, contract-designer, etc. — they have their own registered types).
- The *registration root-cause* fix (why the type fails to resolve) — that is a separate **live-harness** task (R4), out of this prompt-level pattern.

## The contract (3 clauses)

1. **Canonical type, always.** DA is invoked as `Agent({ subagent_type: "product-devils-advocate", … })` in every path. A batched/cluster DA (multiple BRs in one review) is a multi-artifact *brief* to the **same** canonical subagent — there is no separate "batched" agent type.
2. **No silent fallback.** «Agent type 'product-devils-advocate' not found» ⇒ STOP and surface to the user: the canonical DA agent is not registered. Never substitute `general-purpose` + role-adoption.
3. **Registration is a separate fix.** Do not patch bootstrap/registration speculatively from prompt scope — the resolution path (nested `agents/product/` dir vs `name:` field vs stale pilot bootstrap) requires live-harness verification (DEC-DEV-0043 R4). Proposing a concrete registration edit without that check is exactly the plausible-but-wrong patch DEC-DEV-0057 Lesson #1 warns against.

## Deployed enforcement (where the teeth live)

- `skills/product/feature-session.md` — «DA orchestration flow» Step 4 (explicit canonical `Agent()` snippet + batched note) + anti-patterns #9 (no `general-purpose`) and #10 (not-found = STOP).
- `skills/product/product-da-review.md` — anti-pattern #5 already pins the type for the manual path; this pattern mirrors it into the hook-driven path.

## Open / follow-up

- **R4 registration root-cause** (live-harness) — promote this pattern to *validated* once closed.
- A PostToolUse hook cannot reliably observe an Agent call's `subagent_type`, so detection stays at audit (post-mortem) + these prompt-level guards. A hard enforcement hook was **rejected** as higher-risk/weaker-justification than the template fix (CONVENTIONS §3 smallest-mechanism).

## Related

- DEC-DEV-0064 (this codification) · DEC-DEV-0043 R1/R4 · DEC-DEV-0038 · DEC-DEV-0057 Lesson #1 (de-conflate before synthesizing)
- Candidates: [`../patch-candidates/D2B-behavioral__C.md`](../patch-candidates/D2B-behavioral__C.md), [`../patch-candidates/D2B-behavioral__B.md`](../patch-candidates/D2B-behavioral__B.md)
- [`b1-frontmatter-convention.md`](b1-frontmatter-convention.md) — sibling "canonical-form contract" pattern
