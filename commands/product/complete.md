---
description: Run the bounded completeness-loop on a feature's D1-D2B spec (Autonomous Pipeline Vision, Epic B). Drives FM + SC/BR/LC/VC/IC/NFR (and MK/NM if has_ui) to handoff-DoR-sufficient completeness in bounded waves — deterministic completeness-oracle for the stop-signal, heterogeneous profile personas (architect/qa/ux-advisor) on each zone's gaps, auto-resolve the resolvable + escalate real decisions. Stop is external + bounded (cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0)). v1 core/skeleton (DEC-DEV-0098).
argument-hint: "<FM-NNN> [--max-waves N] [--dry-run]"
allowed-tools: Read, Glob, Grep, Agent, Edit, Write, Bash(node:*), Bash(git:*)
---

# /product:complete

User invoked: `/product:complete $ARGUMENTS`

Run the **bounded completeness-loop** (Epic B / B1) on a feature. The methodology + the five hard
rails (external stop-signal, bounded waves, τ=DoR, decisions escalate, no silent truncation) live in
the skill — it is the **SSOT for the wave semantics**. The durable executor of that contract is the
Workflow `product/processes/complete-feature.mjs` (deployed `.claude/product/processes/`); this
command dispatches it.

> **Contract (SSOT):** `skills/product/completeness-loop.md` (the full wave + stop contract).
> **Executable form:** `.claude/product/processes/complete-feature.mjs` — the runner IS the contract,
> executed; do not re-run the skill prose when the runner is available.
> **v1 status:** core/skeleton — the oracle + stop contract are enforced; auto-fix is conservative
> (surface + escalate by default) pending pilot calibration (B-d).

## Process

### Step 1: Parse + validate

- `$ARGUMENTS` first token MUST be an `FM-NNN` id. Other prefixes → refuse (this loop scopes to a
  feature's D1-D2B spec; for ad-hoc DA use `/product:da-review`).
- `--max-waves N` (default 3). `--dry-run` → SCORE + SURFACE only, no auto-fix / no escalation writes.
- Confirm `.product/features/<FM>-*.md` exists; else stop with a clear message. (The runner also
  anchors + refuses an empty feature, but fail fast here with a friendly message.)

### Step 2: Dispatch the durable runner

Launch the Workflow — it owns the bounded wave loop, the deterministic stop-verdict, the personas,
the conservative auto-resolve, and the canonical escalation:

```
Workflow({
  scriptPath: '.claude/product/processes/complete-feature.mjs',
  args: {
    feature: "<FM-NNN>",                                          // required
    maxWaves: 3,                                                  // from --max-waves; hard cap (rail 2)
    epsilon: 0.01,                                                // optional Δscore convergence floor
    dryRun: false,                                                // from --dry-run: SCORE + SURFACE only
    oracle: '.claude/hooks/product/lib/completeness-oracle.cjs',  // the EXTERNAL, deterministic stop-signal
    classifier: '.claude/hooks/product/lib/gap-classifier.cjs'    // the deterministic gap-split + stop-verdict
  }
})
```

> **Pass `args` as an OBJECT, not a JSON string.** Write `args: { feature: "FM-001" }`, NOT
> `args: "{\"feature\":\"FM-001\"}"` — the harness forwards `args` verbatim, so a stringified value
> reaches the script as a string and `feature` comes back undefined. (The runner defensively parses a
> string, but pass an object so the guard is belt-and-suspenders.)

The oracle + classifier paths are the `.claude/`-prefixed **deploy** locations (FB-LR-18) — the
runner reads them via `node` inside its agents; do not point at the repo `hooks/` sources.

**Canonical personas — NO general-purpose fallback (rail).** The runner spawns each zone's persona
as its **canonical `subagent_type`** (`architect-advisor` / `qa-advisor` / `ux-advisor`). A dropped
persona is bounded RE-SPAWNed once; still null → that lens is marked `personas_incomplete` and
SURFACED (degrade loud). It NEVER falls back to a `general-purpose` agent — a wrong-lens review is
worse than a disclosed missing one.

### Step 3: Surface the completion report

The runner returns a completion report (rail 5 — no silent truncation). Surface:
- `stop` (`met` / `converged` / `decisions_only` / `cap`) + `final_score` vs `tau` + `met`;
- `blockers_failing` (DoR blockers still failing), `escalated` (decisions queued to the canonical
  pending-actions ledger, with PA ids), `resolved` / `dropped` (auto-fixed vs verify-before-act
  dropped), `personas_incomplete`;
- `delegated_unverified` (B5/B6/B8) + `delegated_closeout` (the advisory `/product:bg-review` +
  `/product:validate` verdicts — advisory only, they never flip `met`);
- **`honest_unmet`** — when the loop stopped below τ, this plain-words note says so. Relay it
  verbatim; never round a partial spec up to "done".

### Fallback — runner unresolvable (pre-1.7.0 install)

If `Workflow({scriptPath: '.claude/product/processes/complete-feature.mjs'})` is **unresolvable**
(the `product/processes/` deploy is not present — an install predating 1.7.0), fall back to executing
`skills/product/completeness-loop.md` **prose inline** — SCORE (oracle) → SURFACE (canonical
personas, no general-purpose fallback) → CLASSIFY → RESOLVE (verify-before-act, idempotent) →
ESCALATE (canonical ledger) → RE-SCORE, bounded by the same stop contract — and **SAY SO** in the
summary (honest degrade: "runner unavailable — ran the completeness-loop skill inline"). Recommend
`/ecosystem:update` to land the runner. The skill stays the behavioral contract either way.

## Notes
- The loop edits `.product/` only through the normal authoring path so existing hooks
  (validation / cascade / BG / zone-router) fire.
- Idempotency + recovery: a wave is resumable; re-running re-derives gaps from current `.product/`
  state (the oracle is pure). See `dev/LOOP_READINESS_AUDIT.md`.
- Related: `dev/ECOSYSTEM_VISION.md` (Epic B); `skills/product/completeness-loop.md` (SSOT);
  `product/processes/complete-feature.mjs` (runner); `hooks/product/lib/gap-classifier.cjs`
  (deterministic stop-verdict).
