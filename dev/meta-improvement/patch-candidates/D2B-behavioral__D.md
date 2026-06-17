---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: D
verdict: survived
instances: 11
sessions: 10
severity: warning
confidence: high
patch_type: add-hook
risk: medium
finding_ids: [20890600456e, 5e6afa9a788d, 680f790f4e91, 95ff47f6cb97, e365213552d3, 03d380467184, a0c1debb8d48, 39c99904200c, 964d0e0c5eb4, 96d7df26b0a1, 9db903148f07]
gate: edited           # [E] 2026-06-17 (DEC-DEV-0080): SC↔MK spine accepted (mockup-package case + scalar write-back); secondary IC↔BR scope dropped
prior_decision: this candidate was REFUTED on a 5-finding cluster in a prior synth run with an explicit re-open condition (verified canonical-field bi-dir violation from in-session edits). The cluster grew 5→11; the re-open condition is now MET → overturned to survived.
supersedes: D2B-behavioral__D.md (prior refuted version, 5 findings)
---

# Patch candidate — D2B-behavioral / D

Check **D** = **V-11 (bi-directional references consistent)** — rubric `rubrics/D2B-behavioral.md:30`
(«D (V-11)»), effect_focus «FM-граф консистентен (bi-dir refs целы)».

## Verdict (adversarial verification)

**Majority verdict: SURVIVED (overturns the prior refutation; de-conflated to one verified spine).**
A prior synth run REFUTED this check on a 5-finding cluster, but set an explicit **re-open condition**:
*«if check D recurs with canonical frontmatter (canonical `rules`/`invariants`, actual in-session edits,
and a verified absent reverse ref — not a sandbox-blocked or no-edit speculation), that is a legitimate
add-hook topology-extension candidate.»* The cluster grew 5→11; **two new high-confidence findings
satisfy that bar on every clause**, so the survivor is the **SC↔MK (mockup-package ↔ scenario) topology
gap in `cascade-check.js`**. The remaining findings are explicitly separated (merge-bypass) or discarded
(unverifiable), per the de-conflation discipline of DEC-DEV-0064 / DEC-DEV-0057 Lesson #1.

**Lens 1 — Reality (REAL; two findings independently verified).** Unlike the prior 5 (all
non-observations / misframes), the two new high-confidence findings are **observed and corroborated**,
and both auditors independently reached the SAME source-level diagnosis I did:
- `5e6afa9a788d` (warning/high, session `4b141121`, 2026-06-16): the auditor read MK-007 frontmatter
  (`scenarios: [SC-027, SC-028, SC-029]`, transcript L112) AND SC-027 frontmatter (L62 — carries
  `rules/lifecycle/verification` but **no `mockup` field at all**), cited canonical `SC.md:26`
  (`mockup: MK-<NNN>`) + `validation.md:313` (V-11), and pinpointed the mechanism:
  «`cascade-check.js` `getForwardSpecs` … для `mockup-package` уходит в `default` → `return []` … V-11
  auto-fix **не покрывает MK↔SC**» (`audit-reports/4b141121-…md:90-101`).
- `20890600456e` (warning/high, session `a8afb3b1`, 2026-06-16): MK-004 written with
  `scenarios: [SC-015, SC-015a, SC-015e1, SC-015e2]` (Write #114); the **effect-probe git diff** lists
  FM-004/MK-004/NM-004/design-system but **no `scenarios/SC-015*` edits** — verified-absent reverse, not
  speculation (`audit-reports/a8afb3b1-…md:95-103`). The auditor notes the MK→SC auto-fix is
  «currently **deferred to v1.2 per DEC-DEV-0023**» (`:142`).
- I independently confirmed the mechanism in-repo: `MK.scenarios[]` ↔ `SC.mockup` is canonical
  (`MK.md:21`, `SC.md:26`); `getForwardSpecs('mockup-package')` falls to `default → []`
  (`cascade-check.js:398-401`); the `scenario` case has no `mockup` spec (`:365-373`); and the Design
  hook only checks ref **existence** (`design-artifact-validate.js:173-186`), never writes back
  `SC.mockup`. **Mechanism proven; instances corroborated by transcript + effect-probe.**
- Caveat (honesty): no `.product/` exists in this repo (`Glob .product/**` → none), so I could not open
  the SC files myself — I rely on the auditors' quoted frontmatter + effect-probe. The MECHANISM,
  however, is fully verified in-repo.

**Lens 2 — Systemic (REAL spine after de-conflation).** The 11-finding cluster shares only `(zone,
check)`; it splits by root cause:
- **(a) SC↔MK topology gap — the spine.** 5 findings / 5 sessions: `20890600456e` (high✓),
  `5e6afa9a788d` (high✓), `95ff47f6cb97` (medium), `964d0e0c5eb4` (uncertain), `96d7df26b0a1`
  (uncertain). One verifiable root cause (`mockup-package → default → []`). Systemic by the journal's
  ≥3 rule, with 2 independently-verified high-confidence anchors. **← survives.**
- **(b) IC↔BR topology gap — same class, but the cited instance is confounded.** `680f790f4e91`
  (high). `IC.rules[]` ↔ `BR.invariants[]` IS canonical (`IC.md:23`, `BR.md:23`) and IS absent from
  `getForwardSpecs` (`invariant-check` exposes only `feature` `:384-387`; `business-rule` lacks
  `invariants` `:374-378`). BUT the audited ICs used the **non-canonical** field `related_brs` (not
  `rules`) — a check-A frontmatter-drift symptom, already targeted by `D2B-behavioral__A.md` (V-18). A
  topology fix keyed on canonical `rules` would no-op on that instance. → folded in as a **secondary,
  lower-confidence** scope item, not the spine.
- **(c) Merge-bypass — different root cause.** `e365213552d3`, `03d380467184` («наследовано через
  merge», `4b141121-…md:114`), `9db903148f07` («worktree gone»). These edges ARE in the topology; the
  gap is that artifacts entered via git merge, so PostToolUse never fired. A topology fix won't help. →
  separated.
- **(d) Unverifiable.** `a0c1debb8d48` («not directly verified»), `39c99904200c` («sandbox blocked»).
  → discarded.

**Lens 3 — Already-handled (NOT handled for SC↔MK).** Auto path `cascade-check.js`: NO (`default →
[]`). Design hook `design-artifact-validate.js`: existence-check only, no back-write. Manual path
`/product:validate --fix`: does V-11 for «all» artifacts (`validation-runner.md:62,187`) but explicitly
**skips V-MK-\*** as Phase-6 conditional (`:145-152`) and is a Phase-4 command whose `cross_refs` graph I
could not confirm walks the mockup edge. Net: the SC↔MK reverse ref is maintained by **no automatic
mechanism** — it is a *known deferred* item (DEC-DEV-0023, «v1.2»), and its bring-forward trigger
(recurring verified pattern, cuttable-scope-discipline) has now fired.

**Majority: 3/3 lenses support a real, systemic, not-auto-handled SC↔MK gap.**

## Problem (if survived)

`cascade-check.js` auto-fixes V-11 reverse refs only for the edges hard-coded in `getForwardSpecs()`.
When the Design Module (Phase 6) made **MK (mockup-package) ↔ SC** canonical (`MK.scenarios[]` ↔ scalar
`SC.mockup`), the topology was not extended — `mockup-package` falls to `default → []`, and the
`scenario` case has no `mockup` spec. So every time a designer authors/activates an MK with `scenarios:`,
the reverse `SC.mockup` is left unwritten, surfacing repeatedly as a V-11 asymmetry (MK→SC present,
SC→MK absent). This was consciously deferred to v1.2 (DEC-DEV-0023); the deferral's bring-forward trigger
has now fired with two verified high-confidence recurrences.

## Evidence

Spine — SC↔MK (the patch target):
- `20890600456e` high✓ — MK-004.scenarios=[SC-015…] but no SC.mockup; effect-probe confirms no SC edits · `a8afb3b1` (2026-06-16)
- `5e6afa9a788d` high✓ — MK-007.scenarios=[SC-027..029] but SC-027 frontmatter lacks `mockup` · `4b141121` (2026-06-16)
- `95ff47f6cb97` medium — MK-002.scenarios lists 6 SC; no SC.mockup reverse · `e3fedd85` (2026-06-11)
- `964d0e0c5eb4` uncertain — MK-003 declares 5 scenarios[]; SC reverse not visible · `b93269d3` (2026-06-11)
- `96d7df26b0a1` uncertain — MK-001 ↔ SC-001…; SC.mockup reverse not evidenced · `1cdfa987` (2026-06-02)

Secondary — IC↔BR (same class; instance confounded with check-A drift):
- `680f790f4e91` high — IC→BR via non-canonical `related_brs[]`; `BR.invariants[]` reverse absent · `0781ad12` (2026-05-26)

Separated — merge-bypass (NOT this root cause):
- `e365213552d3` medium — SC rules:[]/verification:[]; reverse never backfilled · `e1615a0c` (2026-05-20)
- `03d380467184` info — SC.verification:[] vs VC-034..036, «наследовано через merge» · `4b141121`
- `9db903148f07` uncertain — SC-027..029 reverse arrays; «worktree gone» · `ebf3cc2c`

Discarded — unverifiable:
- `a0c1debb8d48` info — «claimed auto-fixed; not directly verified» · `fbb32599`
- `39c99904200c` uncertain — «not verified — sandbox blocked» · `e3bfd3a3`

## Proposed patch (if survived)

- **Type:** add-hook (extend the existing cascade hook — not a new hook). This is the exact fix both
  auditors recommended (`4b141121-…md:101,146`; `a8afb3b1-…md:142`).
- **Target files:** `hooks/product/cascade-check.js` (primary); cascade smoke fixtures; secondary note
  in `docs/pmo/validation.md §6` cascade-scope table if the topology is documented there. DEC-DEV-0023
  «v1.2 deferral» note should be retired in the journal on accept.
- **Change (described, NOT applied):**
  1. Add a `mockup-package` case to `getForwardSpecs()`:
     `{ fieldName: 'scenarios', depDir: 'scenarios', depReverseField: 'mockup', isScalar: false, reverseIsScalar: true }`,
     and add to the `scenario` case `{ fieldName: 'mockup', depDir: 'mockups', depReverseField: 'scenarios', isScalar: true }` so both write directions are maintained.
  2. **Scalar write-back (the riskiest part).** `SC.mockup` is a **scalar** (`mockup: MK-004`), but
     `injectListField` (`cascade-check.js:285-315`) only emits list syntax (`field: [v]`). Naive reuse
     would write malformed `mockup: [MK-004]`. Add a scalar branch (write/replace `mockup: MK-004`)
     gated on `reverseIsScalar`. Needs its own fixture.
  3. **(Secondary, [E]-scopable)** Add `{ fieldName: 'rules', depDir: 'business-rules',
     depReverseField: 'invariants', isScalar: false }` to `invariant-check` and the mirror
     `{ fieldName: 'invariants', depDir: 'invariants', depReverseField: 'rules', isScalar: false }` to
     `business-rule` (both list↔list — work with existing `injectListField`). NOTE: this won't fix the
     `680f790f4e91` instance (non-canonical `related_brs`); that needs the check-A V-18 field-name fix.
- **Risk (medium):** (a) new scalar write-back path over a list-only helper — a bug there corrupts
  `SC.mockup` format; (b) MK/IC/BR saves now mutate partner SC/BR/IC files — more cascade churn + stderr
  noise; (c) this patch does NOT address merge-bypass (artifacts entering via `git merge` never trigger
  PostToolUse) — that needs a separate `/product:cascade --revalidate`-on-merge mechanism.
- **Confidence / estimate:** confidence high (mechanism verified in-repo by me + 2 independent auditors;
  2 verified high-confidence instances; known-deferred item with fired bring-forward trigger). Estimate
  ~1-2h: small surface (1-2 new edges + scalar branch) but each write direction + the scalar path need
  fixture coverage in the cascade smoke set.

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry (retire the DEC-DEV-0023 v1.2 deferral for MK↔SC) + branch/PR
  extending `getForwardSpecs` with the `mockup-package` case + scalar write-back; set `gate: accepted`,
  journal status → patched for the 5 SC↔MK findings.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → accept the SC↔MK spine only and **drop the secondary IC↔BR scope** (its cited instance
  is a check-A frontmatter-drift symptom; defer to V-18); or scope to the scalar fix alone first.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.
