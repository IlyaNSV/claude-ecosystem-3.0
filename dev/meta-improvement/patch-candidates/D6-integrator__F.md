---
schema: patch-candidate/v1
zone: D6-integrator
check_id: F
verdict: refuted
instances: 5
sessions: 2
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [8f69174639be, ed54776a8c97, 10b3466be004, 6d022db4e381, 712a2d53346b]
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — D6-integrator / F

## Verdict (adversarial verification)

**Majority verdict: REFUTED.** This is a heterogeneous coincidence-cluster, not one systemic
problem. Two of three primary lenses independently conclude "not systemic"; the third finds the
instances real but heavily mitigated, which does not establish a shared root cause. Forcing a
single patch here would be the exact DEC-DEV-0057 Lesson #1 failure (de-conflate before
synthesizing).

**Lens 1 — Systemic (REFUTES, decisive).** Check `F` is the *rubric category* "skill discipline"
(`rubrics/D6-integrator.md:27`, `rubrics/README.md:35`), not a root cause. The 5 findings have
**5 unrelated mechanisms** that share only the `(zone, check_id)` bucket:
- `8f69174639be` — outward-facing git-ops approval gap (merge --no-ff + push origin main)
- `ed54776a8c97` — journal-append path resolution (absolute MAIN path vs worktree-relative)
- `10b3466be004` — audit-trail: skill not visibly `Read` before `/integrator:add`
- `6d022db4e381` — subagent selection (`tool-profiler` → `general-purpose`)
- `712a2d53346b` — schema enum value (`low-partial` ∉ `high|medium|low`)
No single "smallest mechanism" removes "the" root cause — it would take five different fixes (a
git-push confirm, a path resolver, a skill-load enforcement, a subagent-type guard, a YAML enum
validator). Coincidence ≠ systemic (prompt Stage 1, lens 2).

**Lens 2 — Recurrence/temporal (REFUTES).** The "recurred ≥3 times" gate is satisfied only by
counting 5 distinct findings inside **one pilot** (`my-first-test`), audited across **two adjacent
sessions on the same day** — `48cb5bfe` @ `2026-06-11T14:42:38Z` and `b87c7903` @
`2026-06-11T14:49:15Z`, seven minutes apart. Every finding has `first_seen == last_seen`. This is a
single audit batch, not recurrence across independent contexts over time; the "systemic = persistent"
premise fails. (One genuine *sub*-signal does recur across both sessions — `tool-profiler` not
spawned, see `48cb5bfe…md:116` and `b87c7903…md:129` — but that is at most 1–2 of the 5 findings,
info-severity, and explicitly self-justified as a re-scope.)

**Lens 3 — Reality (PARTIAL; does not rescue).** Each instance is a genuine observation, but every
one carries an auditor-flagged mitigation:
- `712a2d53346b` verified real — `docs/integrator-module/SPEC.md:234` confirms `confidence: high #
  high | medium | low`; `low-partial` is non-canonical. Cosmetic nit only: `evidence` + `boundary`
  present, semantics clear (`b87c7903…md:135-141`).
- `6d022db4e381` verified real — `tool-profiler` is the documented Stage-1 agent
  (`docs/integrator-module/SPEC.md:375`); substitution is a *defensible* deviation under a re-scope
  from full-install to skill-fit study (confidence-noted as such).
- `ed54776a8c97` **self-corrected** within the same session — stray MAIN append detected, reverted
  clean, re-appended to the worktree (`b87c7903…md:99-111`). A self-healed slip is weak grounds for a
  systemic patch.
- `8f69174639be` mitigated — solo-dev pilot dogfooding the just-grafted `finishing-a-development-branch`
  skill; possible standing push convention not visible in transcript → auditor confidence *medium*.
- `10b3466be004` mitigated — the flow honored the documented installation shape; methodology may have
  been prompt-carried (`48cb5bfe…md:111-114`).

**Already-handled note (4th lens, partial).** `hooks/integrator/` contains `scope-guard.js` and
`journal-hook.js` but no git-push confirm and no pmo-mapping enum validator — so the findings are not
*already* fully handled. This does not rescue the systemic claim; it just means any future per-finding
re-file would not be redundant.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these recurrences; they are five distinct,
mostly-mitigated process notes coincidentally bucketed under `D6-integrator / F`.

## Evidence

Genuine but heterogeneous, single-batch (two pilots-sessions 7 min apart, all 2026-06-11):

- `8f69174639be` — *my-first-test main / origin/main* — session `b87c7903` — autonomous merge --no-ff +
  push origin main past the `/integrator:add` Stage-6 boundary, no explicit git-ops confirm (mitigated:
  solo-dev pilot / standing convention; confidence medium).
- `ed54776a8c97` — *.claude/integrator/project-journal.md* — session `b87c7903` — DEC-INT-0010 appended
  to MAIN working copy from a worktree; **self-corrected** (net clean).
- `10b3466be004` — *.claude/skills/integrator/installation-protocol.md* — session `48cb5bfe` —
  `/integrator:add` ran without a visible `Read` of its named skill (flow shape still honored).
- `6d022db4e381` — *Agent tool-use (records 14, 15)* — session `b87c7903` — Stage-1 `tool-profiler`
  replaced by two `general-purpose` subagents (defensible re-scope; also recurs in `48cb5bfe`).
- `712a2d53346b` — *.claude/integrator/pmo-mapping.yaml D3-03* — session `b87c7903` — `confidence:
  low-partial` vs SPEC §4.2 enum (cosmetic; semantics clear).

Discarded as systemic basis: all five — no shared mechanism; single batch; each individually mitigated.

## Proposed patch (if survived)

None — `patch_type: none`. (Refuted; no proposal.)

If a human still wants to salvage signal rather than discard wholesale, the honest path is
**de-conflation, not a patch**: re-key the two strongest, mechanism-distinct items to their own
single-finding signatures and let them re-accumulate independently — (a) `8f69174639be`
outward-facing-git-confirm and (b) the `tool-profiler`/skill-load Stage-1 discipline pair
(`10b3466be004` + `6d022db4e381`, which is the only item that genuinely recurs across both sessions).
The schema nit `712a2d53346b` and the self-corrected `ed54776a8c97` are not worth a mechanism on
current evidence. None of this is an edit; it is a re-bucketing recommendation for the journal driver.

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status → patched.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope, then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

**Recommendation:** journal status → **dismissed** (de-conflate). The cluster is a coincidence of
`(zone, check_id)`, not a systemic problem; passing it through would manufacture a bad multi-target
patch — the precise DEC-DEV-0057 Lesson #1 failure mode. Optionally re-file the two
mechanism-distinct sub-signals above so genuine recurrence can be detected without the noise.
