---
description: Run the bounded completeness-loop on a feature's D1-D2B spec (Autonomous Pipeline Vision, Epic B). Drives FM + SC/BR/LC/VC/IC/NFR (and MK/NM if has_ui) to handoff-DoR-sufficient completeness in bounded waves — deterministic completeness-oracle for the stop-signal, heterogeneous profile personas (architect/qa/ux-advisor) on each zone's gaps, auto-resolve the resolvable + escalate real decisions. Stop is external + bounded (cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0)). v1 core/skeleton (DEC-DEV-0098).
argument-hint: "<FM-NNN> [--max-waves N] [--dry-run]"
allowed-tools: Read, Glob, Grep, Agent, Edit, Write, Bash(node:*), Bash(git:*)
---

# /product:complete

User invoked: `/product:complete $ARGUMENTS`

Run the **bounded completeness-loop** (Epic B / B1) on a feature. Methodology + the hard rails
(external stop-signal, bounded waves, τ=DoR, decisions escalate, no silent truncation) live in
the skill — load and follow it.

> **Load:** `skills/product/completeness-loop.md` (the full wave + stop contract).
> **v1 status:** core/skeleton — the oracle + stop contract are enforced; auto-fix is conservative
> (surface + escalate by default) pending pilot calibration.

## Process

### Step 1: Parse + validate

- `$ARGUMENTS` first token MUST be an `FM-NNN` id. Other prefixes → refuse (this loop scopes to a
  feature's D1-D2B spec; for ad-hoc DA use `/product:da-review`).
- `--max-waves N` (default 3). `--dry-run` → SCORE + SURFACE only, no auto-fix / no escalation writes.
- Confirm `.product/features/<FM>-*.md` exists; else stop with a clear message.

### Step 2: Load the skill + run the loop

Load `skills/product/completeness-loop.md` and execute its wave until the stop contract fires:

1. **SCORE** — `node hooks/product/lib/completeness-oracle.cjs --feature <FM> --root .` → relay the
   JSON ({score, tau, met, gaps[], ambiguities[], delegated_unverified[]}). This is the external,
   deterministic stop-signal — never grade completeness by self-judgment.
2. **SURFACE** — for each gap/ambiguity, spawn the zone's persona(s) as their **canonical
   subagent_type** (`architect-advisor` / `qa-advisor` / `ux-advisor`; not-found = STOP, never a
   `general-purpose` fallback). Findings are gaps only.
3. **CLASSIFY → RESOLVE → ESCALATE** — auto-resolve only resolvable derivations (verify-before-act,
   idempotent update-in-place); escalate every decision (threshold / MoSCoW / 🔴 BR-IC / screen).
4. **RE-SCORE** — re-run the oracle; compute Δ.

### Step 3: Stop + report

Stop on `met` (no new progress) OR `wave==max_waves` OR `Δscore<ε` OR no resolvable gaps left.
Emit the completion report: final score, blockers still failing, escalated decisions, and the
oracle's `delegated_unverified` (run `/product:validate` + `/product:bg-review` to close B5/B6/B8).
If stopped un-met, say so plainly — never round a partial spec up to "done".

## Notes
- The loop edits `.product/` only through the normal authoring path so existing hooks
  (validation / cascade / BG / zone-router) fire.
- Idempotency + recovery: a wave is resumable; re-running re-derives gaps from current `.product/`
  state (the oracle is pure). See `dev/LOOP_READINESS_AUDIT.md`.
- Related: `dev/ECOSYSTEM_VISION.md` (Epic B); `skills/product/completeness-loop.md`.
