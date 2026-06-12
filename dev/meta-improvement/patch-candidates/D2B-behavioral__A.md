---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: A
verdict: survived
instances: 10
sessions: 7
severity: warning
confidence: medium
patch_type: add-hook
risk: medium
finding_ids: [1e18b6d8c972, 3441931da1f1, 613ae7128d66, 7dbaf0922cb3, f7039575c7e5, 13fafe80a7f8, 7f01559525d7, 84886f6af31c, 99030316972c, 3cf4371caedf]
gate: accepted          # [Y] 2026-06-12 — D2 (V-18 per-type schema hook, IC/BR/SC scope)
dec_dev_ref: DEC-DEV-0064
---

# Patch candidate — D2B-behavioral / A

## Verdict (adversarial verification)

**Majority verdict: SURVIVED (3/3 lenses for the genuine spine).** Check A = «frontmatter B.1»
(`rubrics/D2B-behavioral.md:30`). The cluster as deterministically grouped by
`(zone=D2B-behavioral, check=A)` is **heterogeneous** — like the de-conflated check-C cluster
(DEC-DEV-0057 Lesson #1). A real, recurring, same-root-cause **spine** of 5 findings (per-type
frontmatter/enum drift on `.product/` artifacts) survives; 5 periphery/discard findings are
dispositioned separately below. The patch targets the spine only.

**Honesty caveats (per global CLAUDE.md «state uncertainty»):**
1. The cited `.product/` artifacts (`IC-022..028`, `BR-064..076`, `SC-015e1`, the `.da-findings/`
   files) live in the **audited product sessions' workspaces, not in this repo** — there is no
   `.product/` here (`ls .product` → absent). I therefore verified the **canonical schemas** the
   auditor measured against (and confirmed the «canonical = X» claims are correct), but I am trusting
   the auditor's snippet that each artifact actually held the drifted value. I could not open the
   artifacts themselves.
2. The root-cause attribution «inline bulk-authoring bypassed the per-artifact skill template» is a
   **hypothesis** — the session transcripts are not in this repo, so I cannot prove *how* the
   artifacts were created. What I *can* assert firmly: (a) the templates are present and correct, so
   «missing template» is refuted as cause; (b) no automated check validates per-type schema, so the
   drift is uncatchable post-write regardless of authoring path.

### Lens 1 — Reality (genuine violation vs auditor misread)

Verified each spine snippet against the real canonical spec in this repo:

- **IC `type=invariant` (canonical `invariant-check`) + missing `severity`/`entity`/`testable_as`** —
  GENUINE. `docs/pmo/artifacts/IC.md:18` mandates `type: invariant-check`; `:20-25` make
  `severity` / `entity` / `testable_as` required schema fields. Findings `1e18b6d8c972`,
  `7dbaf0922cb3`, `7f01559525d7` all describe exactly this drift. `7dbaf0922cb3`'s extra
  `owner_feature`/`scenarios` fields (which belong to FM/BR, not IC) corroborate that the IC was
  shaped from a different artifact type, not from the IC template.
- **BR `category` off-enum (`integration, lifecycle, pricing, security, observability,
  data-integrity, anti-abuse`)** — GENUINE. `docs/pmo/artifacts/BR.md:21` fixes the enum to
  `validation | calculation | authorization | workflow | constraint | state-transition`. None of the
  cited values are members. Finding `3441931da1f1`.
- **SC `status=medium`** — GENUINE (self-corrected in-session via Edit → `active`). `medium` is a
  severity value misplaced into `status`, whose enum is `draft | active | deprecated`
  (`docs/pmo/artifacts/README.md:192-204` common lifecycle). Finding `84886f6af31c`.
- **DISCARD (auditor self-marked non-verifiable):** `3cf4371caedf` (uncertain/low) — the auditor
  itself hedged «IC schema может следовать локальной project convention (existing IC-001..018
  недоступны для verify)». Non-verified by the source → not counted toward the spine.

### Lens 2 — Systemic (same root cause vs coincidence)

The spine is the **same root cause across 3 sessions / 2 dates**: `e1615a0c` (2026-05-20, IC drift),
`0781ad12` (2026-05-26, IC + BR-category drift), `e3bfd3a3` (2026-05-26, IC + SC-status drift). The
identical IC `type=invariant` + missing-required-fields drift recurs across all three — coincidence
would not reproduce the same field-level signature three times. Common mechanism: **`.product/`
artifacts reach disk with non-canonical per-type frontmatter (wrong `type` value, missing required
per-type fields, off-enum `category`/`status`) and nothing validates per-type schema on write.** This
is the precise escalation the B.1 pattern itself anticipates:
`patterns/b1-frontmatter-convention.md:128` — «Multiple skills share same drift class → consider
hook-level validation (e.g., `artifact-validate.js` checking field name strict match)». Systemic: YES.

### Lens 3 — Already-handled (existing mechanism makes the fix redundant?)

Checked the entire prevention + enforcement layer — the recurring path is **not** covered:

- **Templates exist and are correct** (so adding more is redundant, NOT the fix):
  `skills/product/invariant-discovery.md:99-131` (Step 7) already pins `type: invariant-check`,
  required `severity`/`entity`/`testable_as`, an anti-pattern field-name list, and anti-pattern #9
  (`:250`). `skills/product/note-promote.md:159-178` (IC) also pins `type: invariant-check`; `:137-157`
  (BR) pins the correct `category` enum. Templates are prevention-only and only in context when the
  skill is loaded — they cannot catch artifacts authored inline in a feature/handoff session.
- **The inline validation hook does NOT check schema:** `hooks/product/artifact-validate.js:23` states
  its scope is «V-01, V-03, V-04, V-09, V-10, V-11 (basic)». The implemented rules (`:132-185`) check
  SEG→VP, FM→segment/jtbd, SC→feature, and confidence-present — all **relationship/presence** checks.
  There is **no** check for `type`-value correctness, per-type required fields, or enum membership
  (`category`/`status`/`severity`).
- **The on-demand runner does NOT check schema either:** `skills/product/validation-runner.md:48-68`
  catalogs V-01..V-16 — every rule is a graph/relationship rule (refs, bi-dir, reachability, NFR
  status). `docs/pmo/validation.md` rule headers (V-01..V-16, V-H-01..11) confirm no per-type schema
  rule; V-H-06 (`:423`) validates required frontmatter fields **only for handoff** artifacts; V-13 was
  dropped to a process rule; V-17/V-20 are Integrator cross-boundary (`.kiro/` existence), unrelated.
- **The requirement is stated but unenforced:** `docs/pmo/artifacts/README.md:284-289` says every
  `.product/` artifact «должен иметь валидный YAML frontmatter с обязательными общими полями +
  специфичные per тип» — a stated rule with no implemented automation behind it.

Already-handled: **REFUTED** — confirmed enforcement gap. Recurrence on 2026-05-26 *after* the
2026-05-20 flag proves surfacing-via-audit alone did not prevent it.

## Problem (survived)

`.product/` behavioral artifacts can reach disk with non-canonical per-type frontmatter — wrong `type`
value (`invariant` vs `invariant-check`), missing required per-type fields (IC `severity`/`entity`/
`testable_as`), or off-enum scalar values (`BR.category`, `SC.status`, `IC.severity`). The B.1
templates prevent this **only when the creating skill is in context**; when artifacts are authored
inline/in bulk the templates are not loaded, and **neither the inline hook (`artifact-validate.js`,
V-01/03/04/09/10/11 + C2) nor the on-demand runner (V-01..V-16) validates per-type schema**. So the
drift is structurally uncatchable post-write, and the same IC signature recurs across 3 sessions. The
smallest gap-closing mechanism is to extend the hook that already runs on every `.product/**/*.md`
save with a per-type schema-conformance rule.

## Evidence

Spine (patch targets these — recommend journal status → **patched** on accept):

- `1e18b6d8c972` — warning/high — `IC-022..028` `type=invariant`, missing severity/entity/testable_as,
  non-canonical fields — session `0781ad12` (2026-05-26).
- `7dbaf0922cb3` — warning/high — `IC-019..023` (5 files) `type: invariant`, `owner_feature`/`scenarios`
  extra, severity/entity/testable_as missing — session `e1615a0c` (2026-05-20).
- `7f01559525d7` — info/medium — `IC-019..021` (3 files) `type=invariant`, missing
  severity/entity/testable_as — session `e3bfd3a3` (2026-05-26).
- `3441931da1f1` — warning/medium — `BR-064..076` `category` off canonical enum — session `0781ad12`
  (2026-05-26).
- `84886f6af31c` — info/medium — `SC-015e1` `status=medium` (not draft|active|deprecated; later Edit→active)
  — session `e3bfd3a3` (2026-05-26).

Periphery (NOT covered by this patch — disposition separately):

- `613ae7128d66`, `f7039575c7e5` (warning) — `.da-findings/` files in non-canonical format (markdown
  bold-text / nested `review_metadata` block instead of canonical YAML). **Same class (schema
  conformance) but a different producer** — the `product-devils-advocate` subagent, with a distinct
  `.da-findings/` schema. → **adjacent sub-cluster**; fix in the same hook only if `.da-findings/`
  schema is included as a second rule (see [E]), else a separate candidate against
  `agents/product/devils-advocate.md`.
- `13fafe80a7f8` (info) — `.da-findings/` filename uses `-batch-` infix vs slug rule
  `<ID>-YYYY-MM-DD-HHMM.md`. **Filename convention, not frontmatter** → adjacent; could be a minor
  filename-pattern rule, but distinct from schema.
- `99030316972c` (info) — BR-027 **body text** still says «LC-Job» after the frontmatter was fixed to
  `LC-004`. **Body-prose consistency, not frontmatter/schema** (rename didn't cascade to body) →
  **separate root cause**, do not fold in here.
- `3cf4371caedf` (uncertain/low) — auditor self-marked non-verifiable → recommend journal status
  **dismissed**.

## Proposed patch (survived)

- **Type:** add-hook (extend an existing hook — not a new mechanism)
- **Target files:**
  - `hooks/product/artifact-validate.js` — **primary**. Add a per-type schema-conformance rule
    (proposed id **V-18**; V-17 is taken by the Integrator cross-boundary rule). For each known
    `type`, check: (a) `type` value equals the canonical type for the artifact prefix; (b) required
    per-type fields are present (start with the highest-recurrence type — IC: `severity`, `entity`,
    `testable_as`); (c) key scalar enums are members of the canonical set (`IC.severity`,
    `BR.category`, `SC.status`, plus the common `status` enum). Emit as **🟡 warning** (not blocking),
    tier-aware and `validation_overrides`-aware via the machinery already in the hook (`:187-236`), so
    legitimate local conventions can be waived (directly addresses the `3cf4371caedf` concern).
  - `docs/pmo/validation.md` + `skills/product/validation-runner.md` — (optional, [E]) formalize the
    same check as catalog rule **V-18** so the inline hook and on-demand runner stay consistent
    (`validation-runner.md` anti-pattern #1: catalog↔runner are mirrored by hand).
- **Change:** described only — extend the existing save-time hook with a schema-conformance rule whose
  canonical type/field/enum source mirrors `docs/pmo/artifacts/<TYPE>.md`. **Not applied.** No source,
  spec, skill, or artifact edits made by this synthesizer.
- **Risk:** **medium.**
  - *False positives* on legitimate local project conventions (the exact worry in `3cf4371caedf`).
    Mitigated by **warning** severity + the existing `validation_overrides`/`approve_overrides`
    escape hatch (`artifact-validate.js:111-117, 396-423`).
  - *Enum-sync drift* between the hook's hardcoded canonical sets and the artifact specs (same risk
    `validation-runner.md` anti-pattern #1 calls out). Mitigated by keeping the per-type table small
    (IC first), and referencing the spec in a comment; a future catalog↔code linter is the proper
    long-term fix, out of scope here.
  - *Deployment scope* — this is a **Product Module** hook (Level A, deployed to user projects), not a
    D7 mechanism; it is the correct home and respects CONVENTIONS §2/§9 (D7 does not own it).
- **Confidence / estimate:** confidence **medium** — the enforcement gap is verified three
  independent ways (hook scope, runner catalog, validation.md rule list) and the spine drift is
  verified against the specs; residual uncertainty is that I could not open the audited `.product/`
  files or transcripts, and a minority of instances could be local-convention false positives.
  Estimate **~45–90 min** (IC-first rule + enum tables + tests in `artifact-validate.js`; +~30 min if
  V-18 is also formalized in validation.md/runner per [E]).

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status of
  the 5 spine findings → patched. Disposition periphery per Evidence (dismiss `3cf4371caedf`; open a
  separate `.da-findings/`-schema item for `613ae7128d66`/`f7039575c7e5`/`13fafe80a7f8`; open a
  separate body-cascade item for `99030316972c`).
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope: e.g. also fold the `.da-findings/` schema (periphery sub-cluster) into
  the same hook, add the filename-pattern check, and/or formalize V-18 in validation.md + runner.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.
