---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: F
verdict: refuted
instances: 6
sessions: 5
severity: blocking
confidence: high
patch_type: none
risk: low
finding_ids: [309cc2cf996a, 5b7ba5367875, 679597d354f1, 7f198ef9dd30, f322a70fc569, 9dcfec2aaf4f]
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — D2B-behavioral / F

## Verdict (adversarial verification)

**Majority verdict: REFUTED (2/3 lenses against, decisively on Systemic).** The cluster is grouped
only by the broad bucket `check F = «skill discipline»` (`rubrics/D2B-behavioral.md:30`, `:14`), not by a
shared root cause. The 6 distinct findings carry **5–6 unrelated root causes**, and **none recurs ≥3
times**. There is no single «smallest mechanism» that removes a shared cause (CONVENTIONS §3,
`CONVENTIONS.md:85`) — because there is no shared cause. This is exactly the heterogeneous-cluster trap
DEC-DEV-0057 Lesson #1 warns about (the same shape the `__C.md` synth run de-conflated). No systemic F
patch is warranted. The genuine pieces are re-routed, not dismissed, in **Evidence**.

> Verification limitation (stated honestly per global CLAUDE.md): the cited `.product/...` artifacts live
> in the downstream `my-first-test` pilot, **not** in this repo (`.product/**` → no files here, by design;
> CONVENTIONS §9 `CONVENTIONS.md:224`). Evidence below is therefore the audit reports' verbatim
> transcript quotes (file:line), not the artifacts themselves.

### Lens 1 — Reality (genuine violation vs auditor misread) → MIXED, no single problem

Opened all 5 cited audit reports. The instances are a grab-bag, not one defect:

- **Finding 4 `7f198ef9dd30` is a NON-violation.** `8f10e02f-…md:163` (verbatim): «Skill loader сработал
  штатно. Это **нейтральное наблюдение** … **Recommended action: none.**» It is `info` because the
  loader behaved correctly — swept into the cluster purely by `(zone, check)` coincidence.
- **Finding 6 `9dcfec2aaf4f` is auditor-hedged uncertain.** `abb35d42-…md:136-152`: DoR/`dor_validation_passed:
  true` asserted with no observable V-* run — but the auditor explicitly marks it Uncertain because inline
  validation «cannot be ruled out from a tool-call extract» and `validation_tier: pilot` «may relax checks».
  Cannot be asserted as a violation.
- **Finding 1 `309cc2cf996a` is genuine and blocking — but is NOT a skill-discipline defect.** The
  handoff-generator skill **was loaded correctly** (`abb35d42-…md:63-64`, timeline step 3). The failure is a
  git-worktree path split: Bash `PWD`=worktree while `Write`/`Read` got the main-repo abs path, which exceeds
  the 25k read cap so the read-before-write guard is unsatisfiable (`abb35d42-…md:86-109`). It is a
  path/worktree execution bug, mis-bucketed under F.
- **Findings 2, 3, 5 are real-ish but each a different thing** (env registration, cleanup scope creep,
  advisory skill load — see Lens 2). Only finding 3 is a clean discipline gap.

Net: ~2 genuine defects, 1 environment-attributed, 1 non-violation, 1 marginal, 1 uncertain. No coherent
single problem behind the bucket.

### Lens 2 — Systemic (same root cause vs coincidence) → REFUTES (decisive)

Mapping each finding to its root cause shows **no cause recurs ≥3×**:

1. `309cc2cf996a` — `/product:handoff` not worktree-aware + `rm`-before-verified-write (`abb35d42-…md:86-124`).
2. `5b7ba5367875` — `subagent_type=general-purpose`; the report's own root cause is an **environment
   limitation** — «причина workaround — environment limitation (canonical subagent type не registered в
   текущей runtime), **не choice**» (`fbb32599-…md:205-206`), with an explicit fallback disclaimer
   (`:150`) and the fix routed to registration drift (`:230`, follow-up 1).
3. `679597d354f1` — `/product:cleanup` scope creep: `cleanup-detector.md` forbids pending-file writes
   (anti-pattern #2 `cleanup-detector.md:259`, #5 `:281`) but has **no** «out-of-scope: git/semantic edit»
   rule (`98cb1b97-…md:201-206`).
4. `7f198ef9dd30` — none (loader fired correctly; `8f10e02f-…md:163`).
5. `f322a70fc569` — cascade-protocol skill not explicitly loaded; result correct, «это не Warning … skill
   discipline ослаблена» (`a2aa99d4-…md:173-176`).
6. `9dcfec2aaf4f` — validation observability, uncertain (`abb35d42-…md:136-152`).

The only candidate «pair» on skill-loading is 4 + 5 — and **4 is the explicit non-violation**, so that
spine is one marginal instance, not a recurrence. Coincidence of `(zone, check)` ≠ systemic. Refuted.

### Lens 3 — Already-handled / distinct ownership → REFUTES (no F mechanism warranted)

Each genuine piece already has a different, smaller home — none of them is «this F cluster»:

- **Finding 2 overlaps the in-flight `patch-candidates/D2B-behavioral__C.md`** (`gate: pending`), whose
  *spine root cause is the identical* `general-purpose`-vs-`product-devils-advocate` substitution
  (`D2B-behavioral__C.md:20-37, 116-128`). Plus the report attributes the cause to registration drift and
  routes it to `/ecosystem:verify` (`fbb32599-…md:230`). Folding it into an F patch would duplicate `__C.md`.
- **Finding 3** is a genuine gap, but the actionable fix («Out of scope: git stage/commit/rm + semantic
  artifact edits» anti-pattern in `cleanup-detector.md`) is its own narrow candidate — and its real
  companion instance, `a2aa99d4-…md:163-169` («2 git commits inside cleanup flow»), is filed under check
  **G**, *outside this F cluster*. So the cleanup pattern is a 2-instance F+G item, not a ≥3 F spine.
- **Finding 5** — the `/product:cascade` command **already references** `cascade-protocol.md`
  (`commands/product/cascade.md:211`); the only gap is a `# Required skills` directive — info-level, single
  instance, correct result.
- **Finding 4** — explicitly needs no action.

No single hook/skill/template change addresses the set, and CONVENTIONS §8 (`CONVENTIONS.md:203`) keeps D7
surface-only anyway. Refuted as a cluster patch.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these findings; the cluster conflates ≥5 distinct root
causes plus one non-violation and one uncertain. (Per-finding routing is in **Evidence**, so genuine
signal — especially the blocking finding 1 — is preserved, not lost.)

## Evidence

The 6 instances (distinguish genuine → re-routed from discarded), 5 sessions:

- `309cc2cf996a` — blocking/high — `.product/handoffs/FM-001-handoff.md` — session `abb35d42` (2026-06-02)
  — handoff regen never persisted; worktree/main-repo path split. **GENUINE — do NOT dismiss.** → recommend
  journal status **open (re-routed)**: own DEC-DEV / backlog for worktree-aware `/product:handoff` path
  resolution + «never `rm` before a verified regenerate» in `skills/product/handoff-generator.md` §15
  (`abb35d42-…md:207-214`). Not a skill-discipline (F) problem.
- `679597d354f1` — warning/medium — `.product/business-rules/BR-027…md` — session `98cb1b97` (2026-05-15)
  — BR semantic edit + `git commit` inside `/product:cleanup`. **GENUINE.** → recommend journal status
  **open (re-routed)** to a *separate narrow* candidate against `skills/product/cleanup-detector.md`
  (add «Out of scope: git + semantic artifact edits» anti-pattern), bundled with the check-**G** companion
  `a2aa99d4-…md:163-169`. Not part of this F cluster.
- `5b7ba5367875` — warning/high — Agent (FM-002 DA review) — session `fbb32599` (2026-05-15) —
  `subagent_type=general-purpose`. → recommend journal status **dismissed (covered elsewhere)**: subagent
  spine is owned by `D2B-behavioral__C.md` (gate: pending); residual cause is registration drift →
  `/ecosystem:verify` (`fbb32599-…md:230`).
- `f322a70fc569` — info/medium — `/product:cascade FM-005, LC-001` — session `a2aa99d4` (2026-05-26) —
  cascade edits without explicit skill load; result correct. → recommend journal status **dismissed**
  (optionally fold a one-line `# Required skills` ref into `commands/product/cascade.md:211` if ever bundled).
- `7f198ef9dd30` — info/medium — `/product:nfr-upgrade-tier` — session `8f10e02f` (2026-05-15) —
  **non-violation**, loader fired correctly, «Recommended action: none». → recommend journal status **dismissed**.
- `9dcfec2aaf4f` — uncertain/low — `.product/handoffs/FM-001-handoff.md` — session `abb35d42` (2026-06-02)
  — DoR asserted without observable V-* run; auditor-hedged. → recommend journal status **dismissed
  (uncertain)** or keep as a validation-observability backlog note; cannot be asserted as a violation.

## Proposed patch (if survived)

N/A — refuted. `patch_type: none`. No edits proposed. (The two genuine items — finding 1 and finding 3 —
are recommended for their **own** separate dispositions above, not for an F-cluster patch.)

## Human gate — [Y / N / E / D]

- **[Y] accept** → not applicable (no patch). If you instead want the two genuine items actioned, open them
  as their **own** candidates (handoff worktree fix; cleanup «out-of-scope: git» anti-pattern), not under F.
- **[N] reject** → set `gate: rejected`; journal status of the cluster → dismissed. Apply the per-finding
  recommendations in **Evidence** so the blocking finding 1 and the warning finding 3 are re-routed to their
  own items rather than silently dropped.
- **[E] edit** → narrow to a single genuine sub-finding (most defensible: re-scope as a `cleanup-detector.md`
  «out-of-scope: git/semantic» candidate covering finding 3 + the check-G companion) and accept that.
- **[D] defer** → set `gate: deferred`; revisit on next synth run (e.g., after the cluster is re-bucketed so
  F holds only same-root-cause findings).
