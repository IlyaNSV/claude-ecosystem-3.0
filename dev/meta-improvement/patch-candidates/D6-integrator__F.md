---
schema: patch-candidate/v1
zone: D6-integrator
check_id: F
verdict: refuted
instances: 10
sessions: 7
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [8f69174639be, ed54776a8c97, 10b3466be004, 19ea0cd81a11, 1d95423b1b1d, 614865a7120c, 6d022db4e381, 712a2d53346b, ea17e899bfd1, f800ac922b2d]
gate: rejected         # [N] 2026-06-17: dismissed per synthesizer rec (refuted — coincidence cluster, ≥6 mechanisms); 614865a tracked under DEC-DEV-0065
---

# Patch candidate — D6-integrator / F

## Verdict (adversarial verification)

**Majority verdict: REFUTED.** This is a heterogeneous coincidence-cluster, not one systemic
problem — now with **more** mechanism-diversity than the prior 5-finding refutation, not less.
Two of three primary lenses independently conclude "not systemic"; the third finds the instances
real but each individually mitigated, which does not establish a shared root cause. Forcing a
single patch here would be the exact DEC-DEV-0057 Lesson #1 failure (de-conflate before
synthesizing). The journal driver should **dismiss** this bucket.

**Lens 1 — Systemic (REFUTES, decisive).** Check `F` is the *rubric category* "skill discipline"
(`rubrics/D6-integrator.md:27`; auditor definition at `prompts/session-audit.md:166`), not a root
cause. The 10 findings carry **≥6 unrelated mechanisms** that share only the `(zone, check_id)`
bucket:
- *Git-ops without approve gate* — `8f69174639be` (merge --no-ff + push origin main), `f800ac922b2d`
  (detect-only `/integrator:scan` fanned into commit/push/tag).
- *Integrator journal/rationale* — `ed54776a8c97`, `19ea0cd81a11`, `ea17e899bfd1` (see Lens 1b — these
  three actively contradict each other).
- *Skill/subagent read-discipline* — `10b3466be004` (skill not visibly `Read`), `6d022db4e381`
  (`tool-profiler` → two `general-purpose`).
- *Contract lifecycle / DoR* — `1d95423b1b1d` (CNT-002 draft→active on retroactive evidence).
- *Tri-location adapter drift* — `614865a7120c` (fix pilot-local, not upstreamed).
- *Schema enum* — `712a2d53346b` (`low-partial` ∉ `high|medium|low`).
No single "smallest mechanism" (CONVENTIONS §3) removes "the" root cause — it would take six
different fixes. Coincidence ≠ systemic (prompt Stage 1, lens 2).

**Lens 1b — The strongest-looking sub-theme is itself internally contradictory (REFUTES the salvage).**
The "journal" trio looks like genuine cross-time recurrence (3 sessions, `2026-06-11`→`2026-06-16`),
which is what tempts a salvage patch. But opening the reports shows three **opposite** mechanisms:
- `ed54776a8c97` — autolog/append landed in the **wrong working copy** (MAIN vs worktree); a *path-
  resolution* slip, **self-corrected** in-session (`b87c7903…md:99-111`).
- `19ea0cd81a11` — DEC-INT rationale **not written** because a manual splice ran outside `/integrator:*`
  (`c4546225…md:84`: *"no `DEC-INT-*` entry … journal-autolog hook did not fire"*). Wants **more**
  journaling.
- `ea17e899bfd1` — autolog **did fire** (+14 lines) and was **deliberately discarded** via
  `git checkout` as out-of-scope churn for a product commit (`a64afb94…md:178-193`: *"Вероятно
  осознанная курация … autolog в `.claude/` = out-of-scope churn"*). Wants **less** journaling.
A mechanism that satisfies `19ea0cd81a11` (force a DEC-INT entry) would re-introduce the very churn
`ea17e899bfd1` chose to drop. They cannot share a fix → not a coherent systemic problem even as a
sub-cluster.

**Lens 2 — Reality (PARTIAL; does not rescue).** Each instance is a genuine observation, but every
one carries an auditor-flagged mitigation, so none escalates the cluster:
- `712a2d53346b` real — `docs/integrator-module/SPEC.md:234` (`confidence: high # high | medium | low`);
  `low-partial` non-canonical. Cosmetic; semantics clear.
- `6d022db4e381` real — `tool-profiler` is documented (`docs/integrator-module/SPEC.md:377`), but the
  substitution is a *defensible* re-scope (full-install → skill-fit study), auditor-noted as such.
- `ed54776a8c97` **self-corrected** within session.
- `19ea0cd81a11` **human-sanctioned override** — AskUserQuestion = «Прямой ре-синк (без субагента)»
  (`c4546225…md:83`), decision traced across FB-011 + PA-003 + commit msg + inline CNT-001 comment;
  auditor logged **info** with only an *optional* back-fill.
- `ea17e899bfd1` **deliberate curation**, record preserved in DEC-PLAN-032 + commit msg; risk "низкий".
- `8f69174639be` mitigated — solo-dev pilot dogfooding `finishing-a-development-branch`; possible
  standing convention; confidence *medium*.
- `f800ac922b2d` — auditor itself asks to *confirm the turn was an explicit human request*
  (`483517bb…md:125`); confidence *low*.
- `614865a7120c` — explicitly the **known** tri-location local-only-drift class **DEC-DEV-0044/0045**,
  already tracked under reconciliation **DEC-DEV-0065** (`6dc62bc8…md:140`).
- `1d95423b1b1d` — retroactive draft→active in a `maintenance`/shakedown context; singleton.

**Lens 3 — Already-handled / safety (mixed; partially REFUTES).**
- `614865a7120c` is already a tracked decision class (DEC-DEV-0044/0045) under an in-flight plan
  (DEC-DEV-0065) — a patch here would be redundant.
- The journal autolog hook exists and **works** (`hooks/integrator/journal-hook.js`; it fired in
  `ea17e899bfd1`). It was **just narrowed for noise** (FB-008, `journal-hook.js:53-56`) — adding *more*
  autolog enforcement runs directly against that fresh lesson and the `19ea0cd81a11`/`ea17e899bfd1`
  contradiction.
- `scope-guard.js` is a **path**-boundary guard (`.product/`,`.kiro/`,`docs/pmo/`); it does **not** gate
  `git merge`/`push`. So the git-ops items (`8f69174639be`,`f800ac922b2d`) are *not* already handled —
  but a git-ops confirm gate is a heavy mechanism whose hard-block sibling is **explicitly deferred to
  v1.4.0+ pending a DEC-DEV-level decision** (`scope-guard.js:16-19`); two info/low-medium solo-dev
  instances do not justify it.

**Majority:** Systemic (decisive) + Already-handled (partial) refute; Reality is only partial and
establishes no shared root cause → **REFUTED**.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these recurrences; they are ten distinct,
mostly-mitigated process notes coincidentally bucketed under `D6-integrator / F`. The one theme that
looks recurrent across time (journal discipline) dissolves on inspection into three contradictory
mechanisms (Lens 1b).

## Evidence

Genuine but heterogeneous, 10 findings across 7 sessions, `2026-06-11`→`2026-06-16`:

- `8f69174639be` — *my-first-test main / origin/main* — sess `b87c7903` — autonomous merge --no-ff + push
  origin main, no explicit git-ops confirm (mitigated: solo-dev pilot / standing convention).
- `ed54776a8c97` — *.claude/integrator/project-journal.md* — sess `b87c7903` — DEC-INT-0010 appended to
  MAIN copy from a worktree; **self-corrected**.
- `10b3466be004` — *.claude/skills/integrator/installation-protocol.md* — sess `48cb5bfe` —
  `/integrator:add` ran without a visible `Read` of its skill (flow shape still honored).
- `19ea0cd81a11` — *.claude/integrator/contracts/CNT-001.yaml* — sess `c4546225` — manual contract splice,
  no DEC-INT entry; **human-sanctioned override**, traced across 4 surfaces.
- `1d95423b1b1d` — *.claude/integrator/contracts/CNT-002.yaml* — sess `a8afb3b1` — CNT-002 draft→active on
  retroactive FM-002 evidence; Stitch live path not re-run (singleton; same session *did* write DEC-INT-0009).
- `614865a7120c` — *.claude/integrator/adapters/handoff-to-ccsdd.js* — sess `6dc62bc8` — fix landed
  pilot-local only; **known DEC-DEV-0044/0045 class**, tracked under DEC-DEV-0065.
- `6d022db4e381` — *Agent tool-use (records 14,15)* — sess `b87c7903` — `tool-profiler` → two
  `general-purpose` (defensible re-scope).
- `712a2d53346b` — *.claude/integrator/pmo-mapping.yaml D3-03* — sess `b87c7903` — `confidence: low-partial`
  vs SPEC §4.2 enum (cosmetic).
- `ea17e899bfd1` — *.claude/integrator/project-journal.md* — sess `a64afb94` — autolog (+14 lines)
  **deliberately discarded** via `git checkout`; preserved in DEC-PLAN-032 + commit msg.
- `f800ac922b2d` — *turn 94a21d18* — sess `483517bb` — detect-only `/integrator:scan` fanned into
  commit/push/tag, no captured approve gate (auditor: confirm whether human-instructed; confidence low).

Discarded as systemic basis: all ten — ≥6 unrelated mechanisms; the recurrent-looking journal theme is
self-contradictory; every instance individually mitigated; `614865a7120c` already tracked elsewhere.

## Proposed patch (if survived)

None — `patch_type: none`. (Refuted; no proposal.)

If a human wants to salvage signal rather than discard wholesale, the honest path is **de-conflation,
not a patch** — and even that is weaker than it looks:
- The two themes that recur across *time* are not patchable on this evidence: the **journal** theme is
  internally contradictory (Lens 1b: `19ea0cd81a11` wants more journaling, `ea17e899bfd1` wants less),
  and the **git-ops** gate (`8f69174639be` + `f800ac922b2d`) is an explicitly-deferred heavy mechanism
  (`scope-guard.js:16-19`) with both instances plausibly human-instructed.
- `614865a7120c` should be **excluded** from any re-keying — it is already tracked under DEC-DEV-0065.
- The remaining items (`712a2d53346b`, `1d95423b1b1d`, `10b3466be004`, `6d022db4e381`, `ed54776a8c97`)
  are mechanism-distinct singletons / self-corrected — not worth a mechanism on current evidence.
This is a re-bucketing recommendation for the journal driver, **not an edit**.

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status → patched.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope, then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

**Recommendation:** journal status → **dismissed** (de-conflate). The cluster is a coincidence of
`(zone, check_id)`, not a systemic problem; passing it through would manufacture a bad multi-target
patch — the precise DEC-DEV-0057 Lesson #1 failure mode. The added findings since the prior refutation
*increase* mechanism-diversity rather than reinforcing one root cause, and the journal theme that looks
recurrent is self-contradictory. If genuine recurrence is wanted, let the mechanism-distinct sub-signals
re-accumulate under their own signatures (excluding the already-tracked `614865a7120c`) — but do not
emit a patch from this bucket.
