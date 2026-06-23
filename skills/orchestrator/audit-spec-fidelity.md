---
description: Orchestrator P4 regimen — audit generated cc-sdd specs against the .product source for FIDELITY drift before impl. Deterministic trace-integrity (fidelity-oracle) + an LLM fidelity-auditor; each drift is triaged to spec-fix (Orchestrator's zone) or product-feedback (→Product, OD8); auto-re-audit after a spec-fix. Load during /orchestrator:run audit-spec-fidelity.
---

# audit-spec-fidelity — pre-impl fidelity gate (P4)

P4 runs **between P3 (specs authored) and P5 (impl)**. It asks one question per feature:
**does the generated `.kiro/specs/<slug>/{requirements,design,tasks}.md` faithfully represent
the `.product` intent it was generated from?** A spec can be fully *present* (coverage-oracle
green) and internally *consistent* (cc-sdd cross-spec review green) yet still **distort** the
product — RUN 01 found NFR backoff values contradicting BR-040, stale event names, and a
**missing-trace-source** (a spec citing IC-013 that no product artifact defines — FB-LR-12: the
kind names the *missing source*, not an accusation the id was fabricated; it also fires on a real
owned contract whose source lives outside this feature's resolved `.product`). Those are fidelity
drifts; catching them before impl is cheaper than after.

## What P4 is NOT (don't duplicate)

- **C-07** (adapter content-fidelity) — handoff→brief field mapping, pre-generation, narrow. Already a P3 preflight.
- **coverage-oracle** — are all source ids *present* in the spec (presence). Already P3/P6.
- **cross-spec review** — do the specs agree with *each other* (kiro-spec-batch Step 4).

P4 is **spec-vs-`.product` semantic faithfulness** — a different axis from all three.

## Two layers (determinism model §2)

1. **Deterministic — trace-integrity (`fidelity-oracle.cjs`).** Every id the spec REFERENCES
   (`FM/SC/BR/IC/NFR-\d+`) must EXIST in the `.product` ground truth (handoff + the feature's
   `.product` artifacts). A dangling ref = a missing trace source (`kind:missing-trace-source`), caught by CODE, not judgment. Run it,
   relay its JSON — do NOT eyeball trace refs. (This is the half that must never trust a subagent.)
2. **Semantic — the `fidelity-auditor` role (LLM).** Reads the spec + its `.product` source and
   reports drifts the oracle can't: value mismatches (a spec NFR backoff ≠ the BR it cites), a rule
   the spec contradicts or silently re-scopes, stale/renamed entities, an acceptance criterion that
   drops or weakens a product constraint. Each drift carries a **route** and **severity**.

## Triage — every drift gets a route

- **`spec-defect`** → the spec misrepresents a CORRECT product → **fix the spec** (Orchestrator's
  zone). After a fix, **auto-re-audit that spec** (P1-2: remediation itself introduced drift in RUN
  01 — a cross-spec fix invented the fictitious IC-013). Bounded (≤2 re-audit rounds).
- **`product-defect`** → the `.product` canon itself is wrong / under-specified / requires a business
  decision (e.g. provider choice) → do **NOT** fix the spec around it. Record a **product-feedback**
  item in `.claude/pending-actions.md` with `route: product` (this is the OD8 reverse channel — the
  Orchestrator does not edit `.product/`). Leave the drift surfaced, not silently patched.

Owner-arbitration is the simple rule **consumer-conforms-to-owner**: a downstream spec that
disagrees with an upstream/shared spec or with `.product` conforms to the owner; it does not
unilaterally redefine the contract.

## Output

Per feature: `faithful` (no drift) | drifts partitioned into `spec_fixed` (re-audited clean) and
`product_routed` (surfaced to Product) | `residual` (unresolved after bounded rounds). The verdict
gates route-to-impl: a feature with unresolved high-severity spec drift is **not impl-ready**.
