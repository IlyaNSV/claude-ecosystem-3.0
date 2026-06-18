---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: F
verdict: refuted
instances: 11
sessions: 10
severity: blocking
confidence: high
patch_type: none
risk: low
finding_ids: [309cc2cf996a, 5b7ba5367875, 679597d354f1, 1fa0041ac562, 20b71d58353a, 7f198ef9dd30, 80fd8e68fa6b, c4379e1a856b, c92edeee7c32, f322a70fc569, 9dcfec2aaf4f]
gate: rejected         # [N] 2026-06-17: dismissed per synthesizer rec (refuted — see Verdict); per-finding re-routes in Evidence (incl. blocking 309cc2cf → own item)
---

# Patch candidate — D2B-behavioral / F

## Verdict (adversarial verification)

**Majority verdict: REFUTED (Systemic + Already-handled lenses against; Reality leans against).** The
cluster grew from 6→11 findings since the prior synth run (5 new findings from sessions audited
2026-06-16). The prior refutation rested on «no root cause recurs ≥3×»; that is now **partly false** — a
**«governing skill not loaded» sub-spine** (`f322a70fc569` cascade, `c4379e1a856b` notes, `c92edeee7c32`
pivot) reaches 3 instances. I therefore re-ran all three lenses against the *new* material specifically,
rather than re-asserting the old reasoning. The sub-spine **still fails**: the three share only the surface
**label** «skill not loaded» (`F = «skill discipline»`, `rubrics/D2B-behavioral.md:30`, criteria `:14`),
not a single removable root cause — and every one is an **info-level, correct-result, auditor-declined-
to-escalate** observation. The loud findings in the bucket (the blocking handoff bug; the DA-subagent
substitutions) are **not** skill-discipline at all and are owned elsewhere. No single «smallest mechanism»
(CONVENTIONS §3, `CONVENTIONS.md:85`) removes the set. This is the heterogeneous-cluster trap DEC-DEV-0057
Lesson #1 warns about (same shape the `__C.md` run de-conflated). Genuine signal is **re-routed per-finding**
in Evidence, not dropped.

> Verification scope (stated honestly per global CLAUDE.md): the cited `.product/…` artifacts live in the
> downstream `my-first-test` pilot, **not** in this repo (`.product/` is deliberately absent here —
> CONVENTIONS §9, `CONVENTIONS.md:227`). Evidence is the audit reports' verbatim transcript quotes
> (file:line). This run I **re-read** the 5 reports behind the new findings —
> `0f2827ea`, `52fff494`, `a64afb94`, `ebf3cc2c`, `4e5d7666` — plus `a2aa99d4` (the cascade sub-spine
> anchor). The 5 carried-over findings (`abb35d42`, `fbb32599`, `98cb1b97`, `8f10e02f`) rely on the prior
> candidate's file:line quotes, which I did not re-open this run.

### Lens 1 — Reality (genuine violation vs auditor misread) → MIXED, leans REFUTE

I opened the 5 new-finding reports. At most ~3 of 11 are even arguable F-discipline gaps, and the auditors
**declined to escalate every one**:

- **New sub-spine, all info + correct-result + non-escalated:**
  - `f322a70fc569` (`a2aa99d4:173-176`): cascade-protocol skill **is registered** (`:174`) but not loaded;
    «Результат корректен … **это не Warning** — но skill discipline ослаблена.»
  - `c4379e1a856b` (`a64afb94:170-174`): confidence **LOW**, «**Приемлемо** для capture отложенных DA-находок»;
    the only cost is a missing canonical `version`, which is the *separate* check-**A** warning (`a64afb94:112-144`).
  - `c92edeee7c32` (`ebf3cc2c:151-152`): «human-approved (AskUserQuestion + DEC-PLAN-032)» and «the pivot has
    **no dedicated command (OQ-P1)**, so this is low-severity.»
- **Mis-bucketed under F (skill WAS loaded / not a discipline gap):**
  - `1fa0041ac562` (`0f2827ea:117-127,160`): skill `handoff-generator.md` **was loaded** (step 28); the file
    was produced by an ad-hoc deterministic-hash script `.gen-handoff-fm005.cjs` (using canonical `lib/hash.js`),
    run + `rm`'d ×2; auditor: «оценка «проблема ли это» — **нет**, т.к. чисто убрано».
  - `309cc2cf996a` (carried, `abb35d42`): blocking — but a worktree/main-repo **path-split bug** in handoff
    regen, with the skill loaded correctly. A git-execution defect mis-bucketed under F.
  - `20b71d58353a` (`52fff494:95-98`): «**no governing skill/command** enforces schema» — a *missing-mechanism*
    note, not skill-not-loaded; «A one-off manual bookkeeping flip is **reasonable**.»
  - `80fd8e68fa6b` (`4e5d7666:97-100`): DA via `general-purpose` + role-file is «a **methodologically sound
    substitute, not a violation**.»
- **Already-known non-violation / uncertain:** `7f198ef9dd30` (`8f10e02f`: loader fired, «action: none»);
  `9dcfec2aaf4f` (`abb35d42`: DoR-observability, auditor-hedged uncertain).

Net: no coherent single defect; the strongest items are info-level «discipline relaxed but the work was
fine.» Leans refute.

### Lens 2 — Systemic (same root cause vs coincidence) → REFUTES (decisive)

The 11 map to **≥7 distinct root causes**. The only sub-spine that meets the ≥3 count — «governing skill
not loaded» — itself splits into **three different mechanisms-of-failure**, so there is no single fix:

1. **cascade** — skill exists *and is already referenced by the command* (`commands/product/cascade.md:211`);
   gap = a missing `# Required skills` loader directive.
2. **notes** — skill exists; inline `Write` was deemed *acceptable*; the only cost is a frontmatter omission
   already caught by check A / V-18.
3. **pivot** — `planning-session.md` exists but the pivot workflow has **no command** to carry a loader
   directive (OQ-P1); the block was human-gated.

Same surface **label** ≠ same root cause. A `codify-pattern` or `add-hook` built on these would have to span
«add a directive to a command», «accept an inline shortcut», and «invent a missing pivot command» — three
mechanisms, not one. The remaining findings (handoff path-bug, handoff ad-hoc-script, DA-subagent ×2,
cleanup scope-creep, DA-ledger missing-skill, non-violation, uncertain) are each their own cause. Coincidence
of `(zone, check)` ≠ systemic. Refuted.

### Lens 3 — Already-handled / distinct ownership → REFUTES

Each genuine piece already has a smaller, distinct home — none is «this F cluster»:

- **DA-subagent** (`5b7ba5367875`, `80fd8e68fa6b`) is owned by **DEC-DEV-0064 DA Subagent-Type Contract**
  (`patterns/da-subagent-type-contract.md`, anti-patterns #9/#10) + the in-flight `__C.md`; the *blocking*
  variants of the same issue this batch appear under checks **C/B** (`ebf3cc2c:115-132`), **outside this F
  cluster**. Folding it into an F patch would duplicate `__C.md`.
- **notes-frontmatter cost** (`c4379e1a856b`) → check A + **V-18** per-type schema / pilot reconciliation
  (DEC-DEV-0064/0065).
- **pivot** (`c92edeee7c32`) → **OQ-P1** open question; human-gated, no command to attach a fix to.
- **DA-ledger reconciliation** (`20b71d58353a`) → recommended fix is to extend
  `/product:cleanup --pending-hygiene` (`52fff494:98,131`); its own narrow item.
- **cleanup scope-creep** (`679597d354f1`) → its own narrow **F+G** candidate against
  `skills/product/cleanup-detector.md` («Out of scope: git/semantic edit»); its companion is the check-**G**
  finding in `a2aa99d4:163-169` (codify-rec `:197`), **outside** this F cluster — a 2-instance F+G item, not a
  ≥3 F spine.
- **handoff generation** (`309cc2cf996a` + `1fa0041ac562`) → its own shakedown item against
  `skills/product/handoff-generator.md` (worktree-aware paths + direct file emit instead of ad-hoc
  deterministic-hash scripts); the skill **loads fine**, so not F.
- **`7f198ef9dd30`** → explicitly needs no action.

No mechanism currently catches «skill not loaded» (`lesson-presence-gate.js` is the LESSON-* gate,
DEC-DEV-0062 — not a skill-loader), and CONVENTIONS §8 (`CONVENTIONS.md:217`) keeps D7 surface-only. But
building one for **three info-level, correct-result, non-escalated** observations is over-engineering with
weak justification (CONVENTIONS §3 smallest-mechanism; DEC-DEV-0057 Lesson #1). Refuted as a cluster patch.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these findings; the 11-finding bucket conflates ≥7 distinct
root causes. The one count-meeting sub-spine («skill not loaded», ×3) is itself three different removable
problems and all info-level with correct results. Per-finding routing is in **Evidence**, so genuine signal —
especially the blocking finding `309cc2cf996a` — is preserved, not lost.

## Evidence

The 11 instances across 10 sessions (genuine → re-routed vs discarded):

- `309cc2cf996a` — blocking/high — `.product/handoffs/FM-001-handoff.md` — session `abb35d42` (2026-06-02) —
  handoff regen never persisted; worktree/main-repo path split, `rm`+placeholder stub. **GENUINE — do NOT
  dismiss.** → journal status **open (re-routed)**: own DEC-DEV / backlog for worktree-aware
  `/product:handoff` + «never `rm` before a verified regenerate» in `handoff-generator.md`. Not an F problem.
- `1fa0041ac562` — info/high — `.product/handoffs/FM-005-handoff.md` — session `0f2827ea` (2026-06-16) —
  handoff produced via ad-hoc `.gen-handoff-fm005.cjs`, run + `rm`'d ×2; **skill was loaded**, output clean
  (`0f2827ea:117-127,160`). → journal status **open (re-routed)**, *bundled with* `309cc2cf996a` into the
  handoff-generator shakedown item (skill should emit the file directly with canonical hashes, not need a
  hand-written script). Not an F (skill-discipline) problem.
- `679597d354f1` — warning/medium — `.product/business-rules/BR-027…md` — session `98cb1b97` (2026-05-15) —
  BR semantic edit + `git commit` inside `/product:cleanup`. **GENUINE.** → journal status **open
  (re-routed)** to a *separate narrow* candidate against `cleanup-detector.md` («Out of scope: git/semantic
  edit» anti-pattern), bundled with the check-**G** companion `a2aa99d4:163-169`. Not part of this F cluster.
- `20b71d58353a` — info/high — `.product/.da-findings/BR-086-090-batch…md` — session `52fff494` (2026-06-16)
  — DA-ledger flipped pending→actioned by hand; **no governing skill exists** (`52fff494:95-98`). → journal
  status **dismissed (re-routed)**: extend `/product:cleanup --pending-hygiene` to flip ledger status + clear
  the matching `da-pending.yaml` under one schema (its check-**A** frontmatter-rename companion is owned by
  B.1 / V-18). Missing-mechanism, not skill-discipline.
- `5b7ba5367875` — warning/high — Agent (FM-002 DA review) — session `fbb32599` (2026-05-15) —
  `subagent_type=general-purpose`. → journal status **dismissed (covered elsewhere)**: owned by DEC-DEV-0064
  + `__C.md`; residual cause is registration drift → `/ecosystem:verify` (R4).
- `80fd8e68fa6b` — info/medium — Agent (DA re-review) — session `4e5d7666` (2026-06-16) — DA via
  `general-purpose` + role-file; auditor: «methodologically sound substitute, **not a violation**»
  (`4e5d7666:97-100`). → journal status **dismissed (covered elsewhere)**: same DEC-DEV-0064 home as
  `5b7ba5367875`.
- `c4379e1a856b` — info/low — `.product/notes/NOTE-026..029` — session `a64afb94` (2026-06-16) — 4 NOTEs
  created inline without note-capture/note-promote; auditor «Приемлемо», low confidence; only cost = missing
  `version` (`a64afb94:170-174`). → journal status **dismissed**: frontmatter cost owned by check A / V-18.
- `c92edeee7c32` — info/medium — FM-007 + pivot artifacts — session `ebf3cc2c` (2026-06-16) — pivot/FM-007
  skeleton free-form, planning-session skill not loaded; human-gated, «pivot has no dedicated command
  (OQ-P1)» (`ebf3cc2c:151-152`). → journal status **dismissed (re-routed)** to OQ-P1 (no command to attach a
  fix to).
- `f322a70fc569` — info/medium — `/product:cascade FM-005, LC-001` — session `a2aa99d4` (2026-05-26) —
  cascade edits without explicit skill load; skill registered, result correct, «это не Warning»
  (`a2aa99d4:173-176`). → journal status **dismissed**: optionally add a `# Required skills` directive to
  `commands/product/cascade.md` (single-instance info nicety; the command already *references* the skill at
  `:211`).
- `7f198ef9dd30` — info/medium — `/product:nfr-upgrade-tier` — session `8f10e02f` (2026-05-15) —
  **non-violation**, loader fired correctly, «Recommended action: none». → journal status **dismissed**.
- `9dcfec2aaf4f` — uncertain/low — `.product/handoffs/FM-001-handoff.md` — session `abb35d42` (2026-06-02) —
  DoR asserted without observable V-* run; auditor-hedged. → journal status **dismissed (uncertain)** or keep
  as a validation-observability backlog note; cannot be asserted as a violation.

## Proposed patch (if survived)

N/A — refuted. `patch_type: none`. No edits proposed. The genuine items are recommended for their **own**
separate dispositions above, not for an F-cluster patch.

## Human gate — [Y / N / E / D]

- **[Y] accept** → not applicable (no patch). If you want the genuine items actioned, open them as their
  **own** candidates: (a) handoff-generator shakedown (`309cc2cf996a` + `1fa0041ac562` — worktree-aware path +
  direct emit); (b) `cleanup-detector.md` «out-of-scope: git/semantic» covering `679597d354f1` + the check-G
  companion; (c) `/product:cleanup --pending-hygiene` ledger-reconciliation for `20b71d58353a`.
- **[N] reject** → set `gate: rejected`; journal status of the cluster → dismissed. Apply the per-finding
  recommendations in **Evidence** so the blocking finding `309cc2cf996a` and the warning findings are
  re-routed to their own items rather than silently dropped.
- **[E] edit** → most defensible narrowing: re-scope to the `cleanup-detector.md` «out-of-scope: git/semantic»
  candidate (F+G, 2 instances), and/or a one-line `# Required skills` directive on `commands/product/cascade.md`
  — both single, smallest mechanisms — then accept those, *not* an F-cluster patch.
- **[D] defer** → set `gate: deferred`; revisit on next synth run, e.g. if a future session shows a skill-skip
  causing *actual artifact damage* (not frontmatter drift already caught), which would re-found a genuine
  same-root-cause spine.
