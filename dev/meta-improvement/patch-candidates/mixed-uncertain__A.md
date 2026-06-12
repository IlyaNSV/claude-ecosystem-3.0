---
schema: patch-candidate/v1
zone: mixed-uncertain
check_id: A
verdict: refuted
instances: 4
sessions: 4
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [b240a4635e71, b406b7e6c467, 3f4645670d87, 7e1d349cd4ca]
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — mixed-uncertain / A

## Verdict (adversarial verification)

**Majority verdict: REFUTED (3/3 lenses independently refute a single, verifiable, systemic problem).**

As with the precedent `mixed-uncertain__F.md`, the grouping key is the worst case for a real cluster.
`zone=mixed-uncertain` is the **explicit classifier fallback** —
`dev/meta-improvement/rubrics/mixed-uncertain.md:14` («классификатор не выделил ни одной зоны с
достаточным сигналом… явный fallback») and `:18` («Приоритетные критерии: A–F (ничего не скипаем, раз
зона неясна)»). So `check_id A` is a **generic catch-all criterion** applied because no PMO zone could be
determined — not a coherent root-cause signal. Co-bucketing four findings here is exactly the
de-conflation hazard DEC-DEV-0057 Lesson #1 warns about.

### Lens 1 — Reality (genuine current violation vs unverifiable/self-hedged) → REFUTES

I tried to open every cited artifact. **None of the three `.product/` artifacts exist in this repo**, and
none ever existed in its git history:

- `git log --all -- ".product/notes/NOTE-013-fm002-polish-backlog.md"
  ".product/notes/NOTE-014-hyp003-adoption-metric-inflation.md" ".product/problem.md"` → **empty**.
- `Glob .product/**/*` → **No files found** (there is no `.product/` tree in the ecosystem-dev repo).

These are artifacts of a **consumer/pilot project** (the same Phase-4 smoke family as `90413790`, which
also drives `mixed-uncertain__F`), outside this working tree. I therefore **cannot verify** whether
NOTE-013/NOTE-014 are genuine current violations or were since normalized/cleaned, nor whether they were
authored by the skill or hand-written. Per this prompt's rule — «Do NOT pass a cluster you could not
actually verify against the repo — mark it refuted and say what was missing» — findings `b240a4635e71`
and `b406b7e6c467` are **unverifiable here**.

The remaining two are self-hedged by the auditor:

- `3f4645670d87` — `info`/`low`, snippet itself says «pre-existing, **не введён**» (the session did not
  cause it; `confidence_rationale` is a known pre-existing field, not a new defect).
- `7e1d349cd4ca` — severity `uncertain`; the «artifact» is literally `F.5a.0 Ask prompt flow` (not a
  file) and the snippet describes an **audit-mechanism limitation** («filtered transcript extract не
  содержит assistant text turns»), not an artifact violation at all.

Reality lens: 2 unverifiable (foreign project) + 1 explicitly pre-existing info/low + 1 mechanism-limit
uncertain. **Refutes** «this `(zone,check)` is a real, current, recurring artifact problem.»

### Lens 2 — Systemic (one root cause vs coincidence) → REFUTES (decisive)

The four findings have **distinct, unrelated root causes / categories**:

- `b240a4635e71` → NOTE frontmatter: missing `version`, `related_artifacts` vs canonical `related`.
- `b406b7e6c467` → NOTE frontmatter: non-canonical `promote_target` / `promote_target_confidence` /
  `source` / `related_artifacts` + missing `version`.
- `3f4645670d87` → **PS** (`problem.md`) pre-existing `confidence_rationale` preserved by a cleanup —
  a *different artifact type*, *not introduced*, info/low.
- `7e1d349cd4ca` → **audit tooling** transcript-extraction gap — categorically not an artifact at all.

The only internally-coherent sub-theme is «NOTE frontmatter field drift» (`b240a4635e71`,
`b406b7e6c467`) — but that is **only 2 instances across 2 sessions**, *below* the ≥3 systemic threshold,
and both live in the un-inspectable consumer project. Folding the PS pre-existing item and the
mechanism-limitation item in to reach «4» mixes three categories under one classifier-fallback key. No
single mechanism can remove all four (mechanism-ratio, CONVENTIONS §3). Systemic: **NO.**

### Lens 3 — Already-handled (existing mechanism covers it) → REFUTES for the verifiable spine

The skill templates that would produce these notes are **already canonical**, so the cited drifts are not
caused by a wrong template that a patch could fix:

- `skills/product/note-capture.md:60-76` — Step 3 frontmatter template already uses canonical `related:`
  (`:70`) and `version: 1` (`:74`); required-field set matches `docs/pmo/artifacts/NOTE.md:42`
  (`id, type, title, status, created, updated, version`) and canonical link field `related`
  (`NOTE.md:32`).
- `skills/product/note-promote.md:78-83` — uses canonical `promoted_to`/`related`/`version` and
  **explicitly forbids** `confidence_rationale` (`:83`, «caused PS drift (DEC-DEV-0011); canonical =
  `confidence_notes`»). The PS template (DEC-DEV-0011) bans the very field finding `3f4645670d87` flags.

So `3f4645670d87` is **already codified** (and pre-existing in a foreign project anyway), and the
canonical NOTE fields for `b240…`/`b406…` are **already in the template**. The one residual micro-gap is
real but narrow: `note-capture.md`'s Anti-patterns section (`:138-144`) is behavioral and does **not**
carry an explicit forbidden-field-name list à la `note-promote.md:83` (no `❌ related_artifacts` /
`❌ promote_target`). That, however, is supported by **≤2 unverifiable instances** and does not touch
findings 3 or 4 — far too thin to call the *cluster* systemic. Already-handled: **confirmed for the
verifiable spine.**

**Majority across all three lenses → REFUTED.** A heterogeneous `mixed-uncertain/A` fallback bucket, not
a systemic cluster.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these findings; they are coincidentally co-bucketed under
the classifier-fallback zone + generic check A, span two un-inspectable consumer artifacts, one
pre-existing PS field, and one audit-mechanism limitation.

## Evidence

Unverifiable here (foreign / non-existent in this repo — `git log` empty, no `.product/` tree):

- `b240a4635e71` — warning/high — `.product/notes/NOTE-013-fm002-polish-backlog.md` — missing `version`;
  `related_artifacts` vs canonical `related` — session `fbb32599` (2026-05-15). Consumer project; cannot
  confirm current state. NOTE template already canonical (`note-capture.md:60-76`).
- `b406b7e6c467` — warning/medium — `.product/notes/NOTE-014-hyp003-adoption-metric-inflation.md` —
  non-canonical `promote_target`/`promote_target_confidence`/`source`/`related_artifacts` + missing
  `version` — session `e3bfd3a3` (2026-05-26). Consumer project; unverifiable.

Self-hedged / non-artifact (dismiss):

- `3f4645670d87` — info/low — `.product/problem.md` — pre-existing `confidence_rationale` preserved in a
  cleanup preserve-list, «**не введён**» — session `04649f41` (2026-06-01). Already banned by PS template
  (DEC-DEV-0011) + `note-promote.md:83`.
- `7e1d349cd4ca` — uncertain/medium — `F.5a.0 Ask prompt flow` (not a file) — audit transcript-extract
  lacks assistant text turns — session `90413790` (2026-05-14). Mechanism limitation, not an artifact.

Distinct sessions: `fbb32599`, `e3bfd3a3`, `04649f41`, `90413790` (4).

## Proposed patch (if survived)

None — verdict refuted.

## Human gate — [Y / N / E / D]

- **[Y] accept** → n/a (no patch proposed).
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → if you disagree with the de-conflation, the only defensible follow-up is a **standalone
  micro patch-template**: add an explicit forbidden-field list to `skills/product/note-capture.md`
  Anti-patterns (`❌ related_artifacts → related`, `❌ promote_target → promoted_to`,
  `❌ promote_target_confidence`, `❌ source`), mirroring `note-promote.md:83`. Defer until ≥3 **verifiable**
  NOTE instances exist — it does not belong in a `mixed-uncertain/A` cluster patch, and findings 3/4 are
  out of its scope entirely.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

**Recommended:** journal status → **dismissed** for all 4 findings (2 unverifiable foreign-project NOTE
drifts against an already-canonical template, 1 pre-existing PS field already banned by DEC-DEV-0011, 1
audit-mechanism limitation that is not an artifact violation). The lone potentially-actionable item is the
note-capture forbidden-field list above, which must clear the ≥3-verifiable-instance bar on its own first.
