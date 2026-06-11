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

**Majority verdict: REFUTED (2/3 lenses against; Systemic lens decisive).** The 6 findings are grouped
only by the broad bucket `F = «skill discipline»` (`rubrics/D2B-behavioral.md:30`, criteria list `:14`),
**not** by a shared root cause. Mapping each instance to its cause yields **6 distinct causes** — and
**none recurs ≥3×**, the threshold for «systemic». One finding is an explicit **non-violation**, one is
auditor-hedged **uncertain**. With no shared cause there is no single «smallest mechanism» to remove
(CONVENTIONS §3, `CONVENTIONS.md:85`). This is exactly the heterogeneous-cluster trap DEC-DEV-0057
Lesson #1 warns about (same shape the `__C.md` synth run de-conflated). The genuine signal is **re-routed
per-finding** in Evidence, not silently dropped.

> Verification scope (stated honestly per global CLAUDE.md): the cited `.product/...` artifacts live in
> the downstream `my-first-test` pilot, **not** in this repo (`.product/` is deliberately absent here —
> CONVENTIONS §9 «NOT `.product/` для Ecosystem 3.0 itself», `CONVENTIONS.md:224`; confirmed `ls .product/`
> → no such dir). Evidence below is therefore the audit reports' verbatim transcript quotes (file:line),
> which I opened and checked individually — not the pilot artifacts themselves.

### Lens 1 — Reality (genuine violation vs auditor misread) → MIXED (no single defect)

I opened all 5 cited audit reports. The instances are a grab-bag, not one problem:

- **Finding 4 `7f198ef9dd30` is a NON-violation.** `8f10e02f-…md:163` (verbatim): «Skill loader сработал
  штатно. Это **нейтральное наблюдение** … **Recommended action: none.**» It is `info` because the loader
  behaved correctly — swept in purely by `(zone, check)` coincidence.
- **Finding 6 `9dcfec2aaf4f` is auditor-hedged uncertain.** `abb35d42-…md:137-152`: `dor_validation_passed:
  true` asserted with no observable V-* run, but the auditor explicitly marks it Uncertain because inline
  validation «cannot be ruled out from a tool-call extract» and `validation_tier: pilot` «may relax
  checks». Cannot be asserted as a violation.
- **Finding 1 `309cc2cf996a` is genuine and blocking — but is NOT a skill-discipline defect.** The
  handoff-generator skill **was loaded correctly** (`abb35d42-…md:63`, «skill loaded — criterion F»). The
  failure is a git-worktree path split: Bash `PWD`=worktree (`rm`/`printf` hit the worktree copy) while
  `Write`/`Read` got the **main-repo** abs path, which exceeds the 25k read cap so the read-before-write
  guard is unsatisfiable (`abb35d42-…md:86-109`). A path/worktree execution bug mis-bucketed under F.
- **Findings 2, 3, 5 are each a different thing** — environment registration, cleanup scope creep, advisory
  skill-load (see Lens 2). Only finding 3 is a clean discipline gap.

Net: ~2 genuine defects, 1 environment-attributed, 1 non-violation, 1 marginal info, 1 uncertain. No
coherent single problem behind the bucket.

### Lens 2 — Systemic (same root cause vs coincidence) → REFUTES (decisive)

Each finding maps to its own root cause; **none recurs ≥3×**:

1. `309cc2cf996a` — `/product:handoff` not worktree-aware + `rm`-before-verified-write
   (`abb35d42-…md:86-124, 207-214`).
2. `5b7ba5367875` — `subagent_type=general-purpose`; the report's own root cause is an **environment
   limitation** — «причина workaround — environment limitation (canonical subagent type не registered в
   текущей runtime), **не choice**» (`fbb32599-…md:205`), with an explicit fallback disclaimer (`:150`)
   and the fix routed to registration drift / `/ecosystem:verify` (`:230`).
3. `679597d354f1` — `/product:cleanup` scope creep: BR semantic edit + `git commit` inside cleanup; skill
   has no «out-of-scope: git/semantic edit» guard (`98cb1b97-…md:201-206`).
4. `7f198ef9dd30` — none (loader fired correctly; `8f10e02f-…md:163`).
5. `f322a70fc569` — cascade-protocol skill not explicitly loaded; result correct, «это не Warning … skill
   discipline ослаблена» (`a2aa99d4-…md:173-176`).
6. `9dcfec2aaf4f` — validation observability, uncertain (`abb35d42-…md:137-152`).

The only candidate «pair» on skill-loading is 4 + 5 — and **4 is the explicit non-violation**, so that
spine is one marginal info instance, not a recurrence. Coincidence of `(zone, check)` ≠ systemic. Refuted.

### Lens 3 — Already-handled / distinct ownership → REFUTES (no F mechanism warranted)

Each genuine piece already has a smaller, distinct home — none is «this F cluster»:

- **Finding 2's symptom is owned by the in-flight `patch-candidates/D2B-behavioral__C.md`** (`gate:
  pending`), whose spine is the identical `general-purpose`-vs-`product-devils-advocate` substitution
  (`D2B-behavioral__C.md:20-37, 116-128`). The residual cause here is registration drift →
  `/ecosystem:verify` (`fbb32599-…md:230`). Folding it into an F patch would duplicate `__C.md`.
- **Finding 3** is a genuine gap, but its actionable fix («Out of scope: git stage/commit/rm + semantic
  artifact edits» anti-pattern in `cleanup-detector.md`) is its own narrow candidate — and its real
  companion, the check-**G** finding in session `a2aa99d4` («2 git commits inside cleanup flow»,
  `a2aa99d4-…md:163-169`, codify-recommendation `:197`), sits **outside this F cluster**. So the cleanup
  pattern is a 2-instance F+G item, not a ≥3 F spine.
- **Finding 5** — `/product:cascade` **already references** `cascade-protocol.md` as a Skill
  (`commands/product/cascade.md:211`); the only gap is a `# Required skills` loader directive — info-level,
  single instance, correct result.
- **Finding 4** — explicitly needs no action.

No single hook/skill/template change addresses the set, and CONVENTIONS §8 (`CONVENTIONS.md:203`) keeps D7
surface-only anyway. Refuted as a cluster patch.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these findings; the cluster conflates 6 distinct root
causes (one of them a non-violation, one uncertain). Per-finding routing is in **Evidence**, so genuine
signal — especially the blocking finding 1 — is preserved, not lost.

## Evidence

The 6 instances (genuine → re-routed vs discarded), across 5 sessions:

- `309cc2cf996a` — blocking/high — `.product/handoffs/FM-001-handoff.md` — session `abb35d42` (2026-06-02)
  — handoff regen never persisted; worktree/main-repo path split, `rm`+29B placeholder stub. **GENUINE —
  do NOT dismiss.** → recommend journal status **open (re-routed)**: own DEC-DEV / backlog for
  worktree-aware `/product:handoff` path resolution + «never `rm` before a verified regenerate» in
  `skills/product/handoff-generator.md` §15 (`abb35d42-…md:118-124, 207-214`). Not a skill-discipline (F)
  problem.
- `679597d354f1` — warning/medium — `.product/business-rules/BR-027…md` — session `98cb1b97` (2026-05-15)
  — BR semantic edit + `git commit` inside `/product:cleanup`. **GENUINE.** → recommend journal status
  **open (re-routed)** to a *separate narrow* candidate against `skills/product/cleanup-detector.md` (add
  «Out of scope: git + semantic artifact edits» anti-pattern), bundled with the check-**G** companion
  `a2aa99d4-…md:163-169`. Not part of this F cluster.
- `5b7ba5367875` — warning/high — Agent (FM-002 DA review) — session `fbb32599` (2026-05-15) —
  `subagent_type=general-purpose`. → recommend journal status **dismissed (covered elsewhere)**: subagent
  symptom owned by `D2B-behavioral__C.md` (gate: pending); residual cause is registration drift →
  `/ecosystem:verify` (`fbb32599-…md:230`).
- `f322a70fc569` — info/medium — `/product:cascade FM-005, LC-001` — session `a2aa99d4` (2026-05-26) —
  cascade edits without explicit skill load; result correct. → recommend journal status **dismissed**
  (optionally add a one-line `# Required skills` directive to `commands/product/cascade.md` if ever bundled).
- `7f198ef9dd30` — info/medium — `/product:nfr-upgrade-tier` — session `8f10e02f` (2026-05-15) —
  **non-violation**, loader fired correctly, «Recommended action: none». → recommend journal status
  **dismissed**.
- `9dcfec2aaf4f` — uncertain/low — `.product/handoffs/FM-001-handoff.md` — session `abb35d42` (2026-06-02)
  — DoR asserted without observable V-* run; auditor-hedged. → recommend journal status **dismissed
  (uncertain)** or keep as a validation-observability backlog note; cannot be asserted as a violation.

## Proposed patch (if survived)

N/A — refuted. `patch_type: none`. No edits proposed. The two genuine items (finding 1, finding 3) are
recommended for their **own** separate dispositions above, not for an F-cluster patch.

## Human gate — [Y / N / E / D]

- **[Y] accept** → not applicable (no patch). If you want the two genuine items actioned, open them as
  their **own** candidates (handoff worktree fix; cleanup «out-of-scope: git» anti-pattern), not under F.
- **[N] reject** → set `gate: rejected`; journal status of the cluster → dismissed. Apply the per-finding
  recommendations in **Evidence** so the blocking finding 1 and the warning finding 3 are re-routed to
  their own items rather than silently dropped.
- **[E] edit** → narrow to a single genuine sub-finding (most defensible: re-scope as a
  `cleanup-detector.md` «out-of-scope: git/semantic» candidate covering finding 3 + the check-G companion)
  and accept that.
- **[D] defer** → set `gate: deferred`; revisit on next synth run (e.g., after the cluster is re-bucketed
  so F holds only same-root-cause findings).
