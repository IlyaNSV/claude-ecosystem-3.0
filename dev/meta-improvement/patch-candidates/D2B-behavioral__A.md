---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: A
verdict: refuted
instances: 13
sessions: 10
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [1e18b6d8c972, 3441931da1f1, 5a2a945b7465, 613ae7128d66, 7dbaf0922cb3, 8d31d27fb692, f7039575c7e5, 13fafe80a7f8, 32efc5d11610, 7f01559525d7, 84886f6af31c, 99030316972c, 3cf4371caedf]
gate: rejected         # [N] 2026-06-17: dismissed per synthesizer rec (refuted — see Verdict); per-finding re-routes in Evidence
prior_decision: DEC-DEV-0064 (V-18 schema hook + B.1 templates — this very cluster D2B-behavioral::A is the one that birthed it, gate accepted 2026-06-12)
---

# Patch candidate — D2B-behavioral / A

## Verdict (adversarial verification)

**Majority verdict: REFUTED (all three lenses against; Already-handled is decisive).** Check **A** in this
zone is the **per-type frontmatter / schema-conformance** check (`rubrics/D2B-behavioral.md:30`, «A
(frontmatter B.1)»). The genuine systemic spine of this exact cluster — `(D2B-behavioral, A)` — **was
already adversarially verified, accepted, and patched** as **DEC-DEV-0064 → the V-18 hook**. The hook's own
header names its origin literally: `hooks/product/artifact-validate.js:188-189` —
«V-18: per-type frontmatter schema conformance (DEC-DEV-0064, **from Session Audit cluster
D2B-behavioral::A**)». So the smallest authoring-time mechanism for catching frontmatter drift already
exists *and was created in response to these findings*. Re-proposing it would be re-issuing DEC-DEV-0064 —
the exact plausible-but-wrong, redundant move CLAUDE.md («never fabricate; state uncertainty») and
DEC-DEV-0057 Lesson #1 warn against.

> Verification scope (stated honestly per global CLAUDE.md): the cited `.product/…` artifacts live in the
> downstream `my-first-test` pilot — `.product/` is **deliberately absent** from this repo
> (`CONVENTIONS.md:238` «❌ NOT `.product/` для Ecosystem 3.0 itself (DEC-DEV-0008 dogfooding stays
> deferred)»; a fresh `**/.product/**` glob returns nothing). I therefore could NOT open the pilot artifacts
> directly. What I verified against the live repo: the canonical spec (`docs/pmo/artifacts/IC.md`), the
> current authoring skill (`skills/product/invariant-discovery.md`), the deployed V-18 hook
> (`artifact-validate.js`), the reconciliation plan (`dev/_archive/plans/PILOT_RECONCILIATION_PLAN.md`), and the
> sibling refutations (`__C.md`, `__F.md`). The per-finding violation text I rely on is the cluster JSON +
> audit-report transcript quotes, not a re-read of each pilot file.

### Lens 1 — Reality (genuine violation vs auditor misread) → MIXED, leans REFUTE

Against the *current ecosystem canonical baseline* the divergences are technically real — e.g. `IC.md:18`
requires `type: invariant-check`, `:24` `severity`, `:21` `entity`, `:25` `testable_as`, so an IC written as
`type: invariant` with those fields missing (findings `1e18b6d8c972`, `7dbaf0922cb3`, `7f01559525d7`) is a
real schema mismatch. **But** these are artifacts in the downstream pilot, and the auditor itself flagged the
divergence as a *deliberate, internally-consistent pilot-local schema*, not an ecosystem defect:

- `32efc5d11610` (info/high): «Frontmatter follows **pilot-local schema** (diverges from ecosystem spec);
  **internally consistent**».
- `8d31d27fb692` (warning/high): NOTE omits canonical `version` «(**pre-existing pilot convention**)».
- `3cf4371caedf` was already **dismissed** (uncertain/low) precisely because «existing IC-001..018
  недоступны для verify» — the pilot's own baseline could not be established.

So the items are real-against-current-canon but **mis-attributed**: they are pilot version-lag, not a defect
of the ecosystem prompts/specs. Leans refute.

### Lens 2 — Systemic (same root cause vs coincidence) → REFUTES (heterogeneous bucket)

The 13 findings map to **≥6 distinct root causes** sharing only the surface label `(zone=A)`:

1. **IC frontmatter schema** (`type:invariant` not `invariant-check`; missing `severity/entity/testable_as`)
   — `1e18b6d8c972`, `7dbaf0922cb3`, `7f01559525d7`, `3cf4371caedf` (and overlap with `84886f6af31c`).
   The one genuine ≥3 spine — but uniform «pilot wrote ICs under a stale schema», i.e. one **pilot
   version-lag** cause, not an ecosystem skill defect.
2. **BR category taxonomy** off-enum — `3441931da1f1` (1).
3. **DA-findings memo format** (renamed `follow_up`→`gate_discharged`; markdown-bold vs YAML; nested
   `review_metadata`+`findings[]` block) — `5a2a945b7465`, `613ae7128d66`, `f7039575c7e5` (3) — but **three
   different signatures**, plus it's DA *output* format (DEC-DEV-0064 DA-contract territory), not IC/BR/SC
   frontmatter.
4. **NOTE `version` omission** — `8d31d27fb692` (1).
5. **SC `status=medium` typo** — `84886f6af31c` (1), and it was **self-fixed → active within the session**;
   transient.
6. **BR-027 body text «LC-Job»** — `99030316972c` (1) — **body prose, not frontmatter at all**; mis-bucketed
   under a frontmatter check.
7. **`.da-findings` batch filename slug** — `13fafe80a7f8` (1) — filename convention, not frontmatter.
8. **Meta-observation** that the whole pilot uses a local schema — `32efc5d11610` (1).

Same `(zone, check)` ≠ same root cause. A single «smallest mechanism» cannot span «IC type enum», «DA output
markdown→YAML», «BR body cross-ref», and «filename slug». This is the heterogeneous-cluster trap
(DEC-DEV-0057 Lesson #1; the same shape `__C.md` and `__F.md` de-conflated). Refuted as a *cluster*.

### Lens 3 — Already-handled / distinct ownership → REFUTES (DECISIVE)

The genuine, count-meeting spine is **already covered twice over**, and the residual is **owned by an
explicit plan**:

- **Authoring-time prevention (B.1 templates):** `skills/product/invariant-discovery.md:99-130` already emits
  the canonical IC frontmatter (`type: invariant-check`, `severity`, `entity`, `testable_as`) **with an
  explicit anti-pattern field-name list** (`:124-130`) — the DEC-DEV-0011/0012 convention codified
  2026-04-20. The exact «smallest mechanism» a patch would add already exists in the prompt.
- **Authoring-time detection (V-18 hook):** `hooks/product/artifact-validate.js:199-228` catches precisely
  this cluster's dominant items — IC `type != invariant-check` (`:200`), IC `active` missing
  `severity/entity/testable_as` (`:209-213`), **BR `category` off the canonical enum** (`:218` — whose
  allowed set `validation|calculation|authorization|workflow|constraint|state-transition` is exactly what
  `3441931da1f1` violates), and **SC `status` off enum** (`:225` — exactly `84886f6af31c`). The header
  attributes the hook to «DEC-DEV-0064, from Session Audit cluster **D2B-behavioral::A**» (`:188-189`).
- **Residual pilot drift has an owner:** `dev/_archive/plans/PILOT_RECONCILIATION_PLAN.md:7-8` states the design
  intent verbatim — «Session Audit видит pilot-fork drift, но **рефьютит его («не дефект канона»)** — у
  аудита нет категории «канонизировать пилотную фичу». **Этот план — owner дрейфа.**» V-18 + the canonical
  templates sit in **Поток А** (`plan:45`, ecosystem→pilot, pilot byte-equal-behind), so they land in the
  pilot's stale `.claude/` via the pending `/ecosystem:update` (Step 4 ⬜, `plan:11`). Closing the drift is a
  reconciliation step, **not** a prompt-level D7 patch (CONVENTIONS §8 keeps D7 surface-only).
- **DA-findings format / NOTE `version`** are out of V-18's current scope (IC/BR/SC only,
  `artifact-validate.js:191`); DEC-DEV-0064's follow-up explicitly defers extending V-18 to more types
  (`DEV_JOURNAL.md:5130`) — a *planned extension*, not an unaddressed gap warranting a fresh patch now.

Real AND systemic AND **not-already-handled** is the survival rule; the last clause fails decisively.
Refuted.

## Problem (if survived)

N/A — refuted. There is no *new* systemic ecosystem gap. The one genuine ≥3 spine (IC frontmatter schema) is
already prevented by the B.1 skill template (`invariant-discovery.md:99-130`) and detected by the V-18 hook
(`artifact-validate.js:199-228`) — both born from this very cluster under DEC-DEV-0064. The recurrence
appears in the **pilot's stale bootstrap**, whose closure is owned by DEC-DEV-0065 /
`PILOT_RECONCILIATION_PLAN.md`, not by a prompt-level synthesizer.

## Evidence

13 findings / 10 sessions. Genuine-against-canon items are **already covered** (prevent + detect); the rest
are heterogeneous one-offs. Disposition per finding:

- `1e18b6d8c972` (warning/high, **patched**) — `IC-022..028`, session `0781ad12` — `type=invariant`, missing
  `severity/entity/testable_as`. → **dismissed**: covered by V-18 (`artifact-validate.js:200,209-213`) +
  template (`invariant-discovery.md:99-130`); residual = pilot version-lag (reconciliation Поток А).
- `7dbaf0922cb3` (warning/high, **patched**) — `IC-019..023`, session `e1615a0c` — same spine + extra
  `owner_feature/scenarios`. → **dismissed**: same coverage as above.
- `7f01559525d7` (info/medium, **patched**) — `IC-019..021`, session `e3bfd3a3` — same spine. → **dismissed**.
- `3cf4371caedf` (uncertain/low, **dismissed**) — `IC-019..021`, session `e3bfd3a3` — «may follow local
  project convention; IC-001..018 unavailable for verify». → **stays dismissed** (unverifiable baseline).
- `3441931da1f1` (warning/medium, **patched**) — `BR-064..076`, session `0781ad12` — non-canonical category
  taxonomy. → **dismissed**: caught by V-18 BR-category enum (`artifact-validate.js:218`); residual =
  reconciliation.
- `84886f6af31c` (info/medium, **patched**) — `SC-015e1`, session `e3bfd3a3` — `status=medium`, **self-fixed
  → active via Edit in-session**. → **dismissed**: transient; also caught by V-18 SC-status enum (`:225`).
- `8d31d27fb692` (warning/high, **open**) — `NOTE-026..029`, session `a64afb94` — omits canonical `version`
  (pre-existing pilot convention). → **dismissed (re-routed)**: frontmatter cost owned by V-18 follow-up
  (extend beyond IC/BR/SC, `DEV_JOURNAL.md:5130`) + reconciliation; not a fresh ecosystem defect.
- `32efc5d11610` (info/high, **open**) — `IC-033..036 / BR-086..090 / FM-007 / LC-008-009 / VC-034-036`,
  session `ebf3cc2c` — «pilot-local schema, internally consistent». → **dismissed (re-routed)**: this **is**
  the reconciliation matter (`PILOT_RECONCILIATION_PLAN.md:7-8`), not a canon defect.
- `5a2a945b7465` (warning/medium, **open**) — `.da-findings/BR-086-090-batch…`, session `52fff494` —
  `follow_up.revisit_trigger`→`gate_discharged`; `resolution_summary` undocumented. → **dismissed
  (re-routed)**: DA *output* format, DEC-DEV-0064 DA-contract territory; distinct from IC/BR frontmatter; if
  «DA-findings memo schema» drifts ≥3× with **one** signature it earns its own cluster.
- `613ae7128d66` (warning/medium, **patch-proposed**) — `.da-findings/FM-002…`, session `fbb32599` —
  per-finding fields as markdown-bold not YAML. → **dismissed (re-routed)**: same DA-output-format home.
- `f7039575c7e5` (warning/medium, **patch-proposed**) — `.da-findings/FM-003…`, session `9da2652a` — nested
  `review_metadata`+`findings[]` vs flat. → **dismissed (re-routed)**: same DA-output-format home (3rd
  *distinct* signature — confirms «not one root cause»).
- `13fafe80a7f8` (info/medium, **patch-proposed**) — `.da-findings/IC-019-021-batch…`, session `31394d98` —
  `-batch-` infix vs `<ID>-YYYY-MM-DD-HHMM.md` slug. → **dismissed (re-routed)**: filename-slug convention
  for *batched* DA findings; if it recurs, a one-line note in the DA-findings naming rule, not an A-cluster
  patch.
- `99030316972c` (info/medium, **patch-proposed**) — `BR-027` **body** still says «LC-Job» after frontmatter
  fixed to LC-004, session `98cb1b97`. → **dismissed (mis-bucketed)**: body-prose staleness, **not**
  frontmatter; out of check-A scope. If body↔frontmatter ref-drift recurs it belongs to a V-11/bi-dir-style
  item, not here.

## Proposed patch (if survived)

N/A — refuted. `patch_type: none`. No edits proposed. The prevention+detection mechanism (B.1 templates +
V-18) is already deployed under DEC-DEV-0064; the residual pilot drift is owned by DEC-DEV-0065 /
`PILOT_RECONCILIATION_PLAN.md` (Step 4 `/ecosystem:update`). Proposing a frontmatter patch from here would
duplicate DEC-DEV-0064.

## Human gate — [Y / N / E / D]

- **[Y] accept** → not applicable (no patch). If you want the *residual* actioned, the correct lever is
  outside this synthesizer: run reconciliation **Step 4** (`/ecosystem:update` in the pilot) so V-18 + the
  canonical IC/BR templates land in the pilot's stale `.claude/` and catch this drift at authoring time
  going forward (`PILOT_RECONCILIATION_PLAN.md:11,45`).
- **[N] reject** → set `gate: rejected`; journal status of the cluster → **dismissed** with reason «already
  handled: DEC-DEV-0064 V-18 + B.1 templates (this cluster birthed them); residual pilot drift owned by
  DEC-DEV-0065 reconciliation». Apply the per-finding re-routes in **Evidence** so no genuine signal is
  silently dropped (the DA-findings-format trio and the BR-027 body-ref item are tracked as their own
  potential clusters, not folded into A).
- **[E] edit** → if you judge the **DA-findings memo schema** (`5a2a945b7465` + `613ae7128d66` +
  `f7039575c7e5`) already worth a mechanism, re-scope a *separate* candidate to that single root cause
  (target: the DA subagent's findings-file template in `agents/product/devils-advocate.md` /
  `feature-session.md`) — **not** an A-frontmatter cluster patch.
- **[D] defer** → set `gate: deferred`; revisit if, *after* the pilot is reconciled (Step 4 done), the same
  IC/BR/SC frontmatter drift recurs in a **freshly-bootstrapped** session — which would mean V-18/templates
  failed and a genuine ecosystem gap exists.
