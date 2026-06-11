---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: D
verdict: refuted
instances: 5
sessions: 5
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [680f790f4e91, e365213552d3, a0c1debb8d48, 39c99904200c, 96d7df26b0a1]
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — D2B-behavioral / D

## Verdict (adversarial verification)

**Majority verdict: REFUTED (4/4 lenses).** Check D = V-11 bi-directional reference integrity. The
cluster deterministically grouped by `(zone=D2B-behavioral, check=D)` is the **heterogeneous
co-tagged** kind that DEC-DEV-0057 Lesson #1 (the journal-hook phantom) warns against: 5 findings that
share only the `(zone, check)` tag but split across **3 different artifact pairings** (IC↔BR, SC↔BR,
SC↔MK) and **4 different failure modes** (genuine-but-confounded / empty-forward-misframe /
unverified×3). Headline "5 distinct findings / 5 sessions" collapses, on inspection of the real
artifacts and the auditors' own words, to **at most one arguably-real instance, itself confounded with
a different root cause**. That is not a systemic problem; it is a tag bucket.

**Honesty caveat (per global CLAUDE.md «state uncertainty»):** the cited `.product/` artifacts live in
the audited product sessions' workspaces (`my-first-test`), not in this repo (`ls .product` → absent).
I verified (a) the **canonical schemas** the auditor measured against, (b) the **actual mechanism**
(`hooks/product/cascade-check.js`, `docs/pmo/validation.md` V-11), and (c) the **full audit reports**
that are in this repo (`audit-reports/0781ad12…md`, `…/1cdfa987…md`). For findings 3/4/5 the refutation
rests on the auditors' **own snippet text** declaring non-verification — which is airtight regardless
of opening the product files.

### Lens 1 — Reality (genuine violation vs auditor non-observation)

Only **1 of 5** is an arguably-genuine, observed violation; the rest are unverified or misframed:

- **`680f790f4e91` (warning/high) — arguably real but CONFOUNDED.** IC↔BR bi-dir IS canonical:
  `docs/pmo/artifacts/IC.md:22` (`rules: [BR-…]`) ↔ `docs/pmo/artifacts/BR.md:23` (`invariants: [IC-…]`).
  BUT the audited ICs used the **non-canonical** field `related_brs`, not `rules`
  (`audit-reports/0781ad12…md:196`, Warning A: «`related_brs` ← non-canonical (canonical: `rules`)»).
  So the V-11 "violation" is a **downstream symptom of frontmatter drift**, which the SAME session
  already flags under **check A** (`…:50-51, 184-200`). It is double-counted: one event, two checks.
- **`e365213552d3` (warning/medium) — MISFRAMED.** Snippet: «SC written with `rules: []` /
  `verification: []`; BR/VC reverse refs never backfilled». An **empty** forward array has nothing to
  mirror — V-11 ("if A.refs B, then B.refs A") is vacuously satisfied. This is a **completeness** gap
  (V-02 «SC references ≥1 BR», `docs/pmo/validation.md:231-238`, explicitly 🟡 *warning, downgraded
  because some SC are pure navigation*), not a bi-dir **integrity** violation. Mislabeled as check D.
- **`a0c1debb8d48` (info/low) — NOT OBSERVED.** Auditor's own words: «V-11 bi-dir refs **claimed
  auto-fixed** by cascade-check.js; **not directly verified** in transcript». This testifies the
  mechanism *exists*; it is not evidence of a defect.
- **`39c99904200c` (uncertain/low) — NOT OBSERVED.** Auditor's own words: «bi-dir refs SC↔BR **not
  verified** (read access to my-first-test **blocked by sandbox**)». An audit-tooling limitation, not a
  product violation.
- **`96d7df26b0a1` (uncertain/uncertain) — NOT OBSERVED / NON-FINDING.** Auditor's own words: «V-11
  reverse refs SC.mockup=MK-001 **not evidenced**; **no SC edits in session**». The full report
  (`audit-reports/1cdfa987…md:9,37`) summarizes the very session as «MK-001/DS/NM-001 created clean +
  FM-001 bi-dir ref … **0 new validator findings**» and «образцовая git/integrator-гигиена». Nothing
  was edited that could violate V-11; the finding is pure speculation about pre-existing SCs the
  auditor never read.

Reality: **REFUTED.** 3/5 are self-declared non-observations, 1/5 is misframed, and the lone
arguably-real one is a re-tag of a frontmatter-drift event.

### Lens 2 — Systemic (same root cause vs coincidental same tag)

The findings do **not** share a root cause:

- **Three distinct pairings:** IC↔BR (`680f790f4e91`), SC↔BR (`e365213552d3`, `a0c1debb8d48`,
  `39c99904200c`), SC↔MK (`96d7df26b0a1`).
- **Heterogeneous mechanisms:** genuine-missing-reverse-via-non-canonical-field / empty-forward /
  hook-ran-but-unobserved / sandbox-blocked-read / no-edits-speculation.
- **Spread:** 5 sessions, 4 dates (2026-05-15, -20, -26, 2026-06-02), 2 projects (`my-first-test`
  product sessions + one Design-Module shakedown).

They co-occur only because each auditor mentioned "V-11" and the classifier filed them under check D.
Coincidental co-tagging ≠ systemic. **REFUTED.**

### Lens 3 — Already-handled (existing mechanism makes a fix redundant?)

The pairings the cluster actually keeps citing are **already covered**:

- **V-11 is a documented 🔴 Blocking rule *with auto-fix*** (`docs/pmo/validation.md:311-319`), and
  `hooks/product/cascade-check.js` implements it forward-driven on every active `.product/**/*.md` save
  (`:115-153`). Its topology (`getForwardSpecs`, `:363-402`) covers **SC↔BR, SC↔LC, SC↔VC, SC↔FM,
  BR↔SC, BR↔FM, LC↔SC, LC↔FM, IC↔FM, VC↔SC, VC↔FM**. So all three SC↔BR findings
  (`a0c1debb8d48`, `39c99904200c`, and the vacuous `e365213552d3`) fall squarely inside an existing
  auto-fix — which is exactly why the auditors saw "claimed auto-fixed" / couldn't observe a violation
  (the hook edits silently, signalling only via stderr, `:217-229`).
- **The narrow genuine gap is real but is NOT what the cluster is about** (see "Residual signal").

Already-handled: **REFUTED in the cluster's favour** (i.e., the dominant cited cases are handled, so a
patch would be redundant for them).

### Lens 4 — Safety / regression of a hypothetical fix

A naïve "fix" (broaden `cascade-check.js` topology to IC↔BR) would **mirror the wrong field**: in
`680f790f4e91` the source field is the non-canonical `related_brs`, so an auto-fix keyed on the
canonical `rules` would no-op, while one keyed on `related_brs` would **entrench the drift**. The
correct lever for that finding is the **frontmatter-conformance hook already proposed under check A**
(`patch-candidates/D2B-behavioral__A.md`, V-18) — fix the field name, and the V-11 symptom dissolves.
Patching V-11 here would be effort against a symptom and could harden a bad convention. **A fix is
misdirected.**

## Problem (if survived)

_N/A — refuted._

## Evidence

Per-instance disposition (recommend journal status in brackets):

- `680f790f4e91` — warning/high — `BR-064..076.invariants[]` missing reverse of IC `related_brs[]` —
  session `0781ad12` (2026-05-26). **Confounded re-tag of a check-A frontmatter-drift event**
  (non-canonical `related_brs`). → defer to check-A candidate (V-18); **dismiss as standalone V-11**.
- `e365213552d3` — warning/medium — `SC-015..SC-015e2` with `rules: []` / `verification: []` — session
  `e1615a0c` (2026-05-20). **Misframed: empty forward = no bi-dir to maintain; it is a V-02
  completeness note.** → **dismiss** (or re-file under a V-02 completeness bucket).
- `a0c1debb8d48` — info/low — `SC-010, BR-043` — session `fbb32599` (2026-05-15). Auditor: «not
  directly verified». **Not observed.** → **dismiss.**
- `39c99904200c` — uncertain/low — `SC-015…↔BR-054..063` — session `e3bfd3a3` (2026-05-26). Auditor:
  «not verified — sandbox blocked». **Not observed (tooling limitation).** → **dismiss.**
- `96d7df26b0a1` — uncertain/uncertain — `MK-001↔SC-001…` — session `1cdfa987` (2026-06-02). Auditor:
  «not evidenced; no SC edits in session»; report = «0 new validator findings». **Non-finding.** →
  **dismiss.**

### Residual signal (preserve — do NOT use to survive this cluster)

There **is** one narrow, genuine, *unhandled* gap worth a future eye, but the current evidence does not
establish it: `cascade-check.js`'s V-11 topology omits the **cross-derived** bi-dir pairings among
D2-behavioral artifacts — **IC↔BR** (`IC.rules` ↔ `BR.invariants`), **IC↔LC**, **BR↔LC**, and
**SC↔MK** (`SC.mockup` ↔ MK reverse) — because `invariant-check` exposes only `feature`
(`cascade-check.js:384-387`), `business-rule` only `scenarios`/`feature` (`:374-378`), and MK is in the
`default` no-cascade case (`:397-401`). **Re-open condition:** if check D recurs with **canonical
frontmatter** (canonical `rules`/`invariants`, actual in-session edits, and a *verified* absent reverse
ref — not a sandbox-blocked or no-edit speculation), that is a legitimate `add-hook` topology-extension
candidate. The present cluster fails that bar on every instance.

## Proposed patch (if survived)

_N/A — refuted (`patch_type: none`)._ No source, spec, hook, skill, or artifact was modified by this
synthesizer; only this candidate file was written.

## Human gate — [Y / N / E / D]

- **[Y] accept** → n/a (refuted; nothing to patch).
- **[N] reject** → set `gate: rejected`. **Recommended.** Journal status for all 5 findings →
  **dismissed** with reason: heterogeneous co-tagged cluster; 3 self-declared non-observations, 1
  misframe (V-02, not V-11), 1 confounded re-tag of a check-A frontmatter-drift event already targeted
  by `D2B-behavioral__A.md` (V-18). The SC↔BR core is already auto-fixed by `cascade-check.js`. Open a
  suppress window on check D for the SC↔BR/SC↔MK pairings.
- **[E] edit** → if you want the **residual signal** pursued, convert this into a *separate* narrow
  `add-hook` candidate that extends `cascade-check.js` topology to IC↔BR/IC↔LC/BR↔LC/SC↔MK — but only
  after a session produces a *verified* canonical-field bi-dir violation (the re-open condition above).
- **[D] defer** → set `gate: deferred`; revisit on next synth run if check D recurs with verified
  canonical-field evidence.
