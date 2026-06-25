---
description: Bounded completeness-loop for D1-D2B artifacts (Autonomous Pipeline Vision, Epic B / B1). Drives a feature's spec to handoff-DoR-sufficient completeness in bounded waves — runs the deterministic completeness-oracle for the stop-signal, fires the heterogeneous profile personas (architect/qa/ux-advisor) on each zone's gaps, auto-resolves the resolvable and escalates real decisions. Stop is external + bounded (cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0)), never the generator grading itself. Invoked by /product:complete <FM-id>. v1 core/skeleton.
---

# Completeness Loop — bounded D1-D2B doved-completeness

> **Status:** v1 **core/skeleton** (Epic B / B1, DEC-DEV-0098). The deterministic oracle +
> the stop contract + the wave shape are real and enforced; the auto-fix step is intentionally
> **conservative** (surface + escalate by default) until live pilot data calibrates what is
> safe to auto-resolve. Full auto-fix breadth + the consilium escalation channel (Epic D) come later.

## Purpose

Iteratively bring a feature's behavioral spec (FM + SC/BR/LC/VC/IC/NFR, and MK/NM if `has_ui`)
to **"sufficient"** completeness — where "sufficient" = the handoff **Definition of Ready**
(handoff-spec.md §7, B1-B8), **not** "ideal" (vision B2; the highest-leverage place to fight
quality is the input, because spec errors compound downstream — METR/error-compounding).

This is the **rychag #1** of the Autonomous Pipeline Vision: a precise front of the pipeline.

## Hard rails (from the research — vision §4 cluster 1; do not remove)

1. **The stop-signal is EXTERNAL and deterministic.** The loop NEVER decides "good enough" by
   asking the model that wrote the artifact. The stop authority is `completeness-oracle.cjs`
   (a DoR-anchored score) + an iteration cap. Self-grading-as-sole-stop is the documented
   failure mode (Huang et al. 2310.01798).
2. **Bounded.** `max_waves` hard cap (default **3** — community evidence: reflection plateaus
   by ~round 2-3). Plus convergence: stop when `Δscore < ε` between waves, or open-question
   info-gain → 0 (Active Task Disambiguation 2502.04485 — the same info-gain logic as the ITP).
3. **τ anchored to DoR, not to perfection.** `τ = 1.0` over the oracle's *computed* DoR blockers.
   Do not raise the bar above what downstream (cc-sdd/impl) actually consumes.
4. **Decisions escalate, they are never auto-resolved.** Strategic/connected/irreversible gaps
   (PS/SEG/HYP thresholds, MoSCoW, 🔴 BR/IC, screen decisions — see `dev/LOOP_READINESS_AUDIT.md`)
   are routed to a human (later: the Epic D consilium *prepares* the decision). Only resolvable
   *derivations* are auto-fixed.
5. **No silent truncation.** Every wave reports what remains unresolved + the oracle's
   `delegated_unverified` (B5/B6/B8 — run `/product:validate` + `/product:bg-review`).

## The wave

For `scope = <FM-id>` (or a release's FM set), repeat until the stop contract fires:

```
wave N:
  1. SCORE      — run the oracle (external stop-signal):
                    node .claude/hooks/product/lib/completeness-oracle.cjs --feature <FM> --root .
                  → { score, tau, met, gaps[], ambiguities[], delegated_unverified[] }
                  If met AND no new info this wave → STOP (success).

  2. SURFACE    — for each gap/ambiguity, let the zone's persona name precisely what is missing.
                  The personas are already routed by zone (advisor-pending.yaml / zone-router):
                    architect-advisor (feasibility/decomposition/data-state),
                    qa-advisor (testability/acceptance/edge/VC-coverage),
                    ux-advisor (flows/states — has_ui only).
                  Spawn each as its CANONICAL subagent_type (not-found = STOP, never
                  general-purpose fallback). Findings are GAPS only (clean:true otherwise).

  3. CLASSIFY   — split this wave's gaps:
                    resolvable  = a derivation the assistant can complete from existing upstream
                                  (a missing VC for an active SC; an unlinked LC state; an RPM
                                  role from SC.actors) → auto-fix candidate
                    decision    = strategic/connected/irreversible (a threshold, a MoSCoW call,
                                  a 🔴 BR/IC semantic, a screen choice) → escalate

  4. RESOLVE    — for each resolvable gap: produce the fix, then VERIFY-BEFORE-ACT
                  (re-read ground truth; drop a gap that the oracle no longer reports — it may
                  have been fixed by a sibling step; order-aware, cf. DEC-DEV-0093). Apply via
                  the normal authoring path so the existing hooks (validation/cascade/BG) fire.
                  IDEMPOTENT: update the artifact in place keyed on its id — never append a
                  near-duplicate (LOOP_READINESS_AUDIT §5.3 / DEC-DEV-0089).

  5. ESCALATE   — queue each decision for the human (a pending-action / open question). Record
                  the assumption if you proceed on a reversible one (ITP T1 style), block on the rest.

  6. RE-SCORE   — run the oracle again; compute Δscore vs wave N-1.
```

## Stop contract (all bounded; the loop MUST terminate)

Stop when **any** of:
- `met == true` (score ≥ τ over computed DoR blockers) **and** no gap was newly resolved this wave;
- `wave == max_waves` (default 3);
- `Δscore < ε` between consecutive waves (default ε = 0.01) — convergence plateau;
- open-question info-gain → 0 (the remaining gaps are all `decision` — nothing left to auto-resolve).

On stop, emit a **completion report**: final score, blockers still failing, escalated decisions,
and the oracle's `delegated_unverified` (B5/B6/B8). If stopped un-met, say so plainly — never
round a partial spec up to "done" (no silent truncation, rail 5).

## Idempotency & recovery (per B4 / LOOP_READINESS_AUDIT)

- Every write step updates in place keyed on artifact id (re-running a wave must not duplicate).
- The advisor personas write to `.product/.advisor-findings/<persona>-<ARTIFACT-ID>.md` (keyed,
  not timestamped) — a re-run overwrites.
- A wave is resumable: a crash between write and commit re-enters at SCORE, which re-derives
  the gap set from the current tree (the oracle is a pure function of `.product/` state).

## Output

- Per-wave: a short log (score, gaps resolved, decisions escalated) — surfaced, not silent.
- On stop: the completion report above.
- The loop **never** edits `.product/` outside the normal authoring path (so hooks + validation fire).

## Related
- Oracle: `.claude/hooks/product/lib/completeness-oracle.cjs` (the external stop-signal)
- Personas + routing: `.claude/agents/{product,design}/*-advisor.md`, `.claude/hooks/product/zone-router.cjs`
- Loop-readiness disposition per step: `dev/LOOP_READINESS_AUDIT.md`
- Concept: `dev/ECOSYSTEM_VISION.md` (Epic B); kickoff: DEC-DEV-0098
- Command: `/product:complete`
