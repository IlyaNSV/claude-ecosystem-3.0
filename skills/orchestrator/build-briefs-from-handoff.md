---
description: Orchestrator P3 bridge — turn Product handoffs into the inputs cc-sdd's kiro-spec-batch consumes (per-feature brief.md + roadmap.md "## Specs (dependency order)"), gated by a blocking content-fidelity preflight (C-07). This is the programmatic substitute for kiro-discovery (which is disable-model-invocation + interactive and cannot run headless). Load during /orchestrator:run batch-features-to-cc-sdd before invoking kiro-spec-batch.
---

# build-briefs-from-handoff — the handoff→cc-sdd bridge (P3)

cc-sdd's `kiro-spec-batch` engine consumes two things it does NOT know how to produce
from Product handoffs:

- `.kiro/steering/roadmap.md` with a `## Specs (dependency order)` section, and
- a per-feature `.kiro/specs/<feature>/brief.md`.

Normally those come from `kiro-discovery`. But `kiro-discovery` is
`disable-model-invocation: true` **and** interactive (AskUserQuestion) — a Workflow
cannot invoke it. The Product Module already did discovery (it owns `.product/` and
emits handoffs). So **this bridge is the programmatic replacement for kiro-discovery**:
it derives kiro-spec-batch's inputs from handoffs, with a content-fidelity gate in
front. That is the Orchestrator's sharp, non-duplicative value over cc-sdd here.

> RUN 01 grounding (P0-1, DEC-DEV-0068): a handoff can pass *presence-level* checks
> yet have silently clobbered bodies (§10 UI sub-docs overwriting §1/§5/§6). The brief
> is only as good as the handoff it derives from — so the fidelity gate runs first.

## Step 1 — Preflight content-fidelity gate (BLOCKING)

For each handoff, run the integrator adapter in verify-only mode; require exit 0,
`contract_validation.passed: true`, AND `C-07` = pass:

```bash
node .claude/integrator/adapters/handoff-to-ccsdd.js \
  --verify-only --fixture .product/handoffs/FM-NNN-handoff.md
echo "exit: $?"
```

- **pass** → the adapter's `cc_sdd_input` block is the verified source for the brief.
- **C-07 fail** (content mis-mapping / §10 clobber) or **exit 2** (parse error) → do
  NOT write a brief for this feature. A brief from a clobbered handoff would make
  kiro-spec-batch author plausible garbage. Route the defect — handoff content →
  Product; adapter → Integrator capability — do not self-fix (RUN 01 boundary
  anti-pattern).
- **C-06 (status: partial)** → proceed, carry `experimental` into the brief so cc-sdd
  and downstream P5 know.

This gate is the determinism boundary: a deterministic predicate over the handoff
text, not a judgment.

## Step 2 — Write per-feature brief.md

From the adapter's `cc_sdd_input` (do NOT re-parse the handoff by hand), write
`.kiro/specs/<slug>/brief.md`. Carry forward, at minimum:

- title + feature id (FM-NNN) + slug (`feature_name`)
- the §1 description and §2 business context (the *why*)
- pointers to the canonical requirement families the spec must cover — the
  ground-truth source IDs from the coverage-oracle extract:

```bash
node .claude/orchestrator/lib/coverage-oracle.cjs \
  --handoff .product/handoffs/FM-NNN-handoff.md
# → source_ids { scenarios:[SC-...], rules:[BR-...], invariants:[IC-...] }
```

Embed those IDs in the brief so the spec-author subagents kiro-spec-batch dispatches
know exactly which requirements to cover (and so the later coverage-oracle gate shares
one ground truth). The brief is context for cc-sdd's pipeline — keep it the feature's
intent + the must-cover IDs, not a re-statement of the whole handoff.

## Step 3 — Write the roadmap "## Specs (dependency order)"

kiro-spec-batch parses `.kiro/steering/roadmap.md` `## Specs (dependency order)` to
build waves. Write/append one line per feature in its exact format:

```
- [ ] <slug> -- <one-line description>. <FM-NNN>. Dependencies: <slug|slug2 | none>
```

Dependencies come from the handoff §12 (Dependencies & Context) mapped to sibling
slugs in this batch. A feature whose deps are all outside the batch (or already
`[x]`) is a wave-1 feature — but you do NOT compute the waves; kiro-spec-batch does.
Your job is the correct dependency-order lines. A dependency cycle → surface to the
Orchestrator (it may need P2 / a human call); do not force an order.

## Output

Per feature: a verified `brief.md` + a `## Specs (dependency order)` roadmap line +
the ground-truth source IDs. Blocked features (preflight fail) are recorded with a
route and never reach kiro-spec-batch. The Orchestrator then invokes kiro-spec-batch,
which takes over wave-grouping, dispatch, and cross-spec consistency (Step 4 of its
own pipeline).

## Anti-patterns

1. **Writing a brief on a C-07 fail.** Authoring from a clobbered handoff is the exact
   silent-fidelity-loss class P0-1 exists to stop.
2. **Re-deriving the brief by hand.** The adapter transform is the contract; hand
   parsing re-introduces the line-based-vs-regex bug class (DEC-DEV-0031).
3. **Reimplementing kiro-discovery's dialogue.** The bridge is the *headless* substitute
   fed by handoffs — it does not re-ask the user what the Product Module already
   decided.
4. **Computing waves here.** Dependency-order lines are your output; wave grouping +
   dispatch + cross-spec review belong to kiro-spec-batch. Do not duplicate them.
5. **Self-fixing a failed handoff/adapter.** Content → Product; adapter → Integrator.
   The Orchestrator routes; it does not absorb.
