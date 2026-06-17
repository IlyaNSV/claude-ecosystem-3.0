---
schema: patch-candidate/v1
zone: D2B04-design
check_id: A
verdict: refuted
instances: 5
sessions: 3
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [610527279177, 6eff514c473f, 7d461a40cbab, c5c0338c9563, 6e783899bc96]
gate: rejected         # [N] 2026-06-17: dismissed per synthesizer rec (refuted — AM exists only in pilot fork; back-port = DEC-DEV-scale)
---

# Patch candidate — D2B04-design / A

## Verdict (adversarial verification)

**Majority verdict: REFUTED (3 of 3 lenses independently refute).** The cluster is a coincidental
`(zone, check_id=A)` bucket, not one systemic problem, and its three driving warning/high findings point
at an artifact that **does not exist in this canonical repository** — they live in a pilot fork.

### Lens 1 — Reality (REFUTES for 4/5)

- **Findings 610527279177, 6eff514c473f, c5c0338c9563 (AM.md drift): cannot be verified against this repo —
  the cited files do not exist here.** There is **no `AM.md`** in `docs/pmo/artifacts/` (the catalog holds
  23 artifacts: BG, FM, BR, CA, DS, HYP, IC, LC, MR, MVP, NM, NOTE, NFR, PS, RL, RM, RPM, SC, SEG, VC, VP,
  MK, LESSON — **App Map is not among them**). There is no `skills/design/app-map-generate.md` and no
  `commands/design/map.md` (design skills are design-session / component-states / design-system-rules /
  stitch-workflow / claude-design-workflow / html-fallback / design-validation / open-design-viewer;
  design commands are iterate / system / export / migrate / start / status). A repo-wide grep for
  `module_roles|primary_journeys|cross_module_edges` and for `app.?map` returns matches **only** in
  `dev/meta-improvement/audit-journal.ndjson` and `dev/meta-improvement/audit-reports/256c3749-…md` — i.e.
  the auditor's own output, never a source/spec/skill. The audit report (`256c3749…md:62`) states plainly:
  the AM type, `AM.md`, `app-map-generate.md`, `/design:map` and six hooks were authored inside the pilot
  `my-first-test`'s `.claude/` fork (branch `elegant-beaming-parrot`) and "расходятся с каноническим
  репозиторием экосистемы." So these three findings describe internal drift **within the pilot fork**, not
  a defect in the ecosystem source. They are not falsifiable here.
- **Finding 6e783899bc96 (MK-002 draft→active, no explicit human approve): an admitted evidentiary
  uncertainty, not a confirmed violation.** Cluster severity/confidence are both `uncertain`. The auditor's
  own "Skipped checks" note that intent / human-approval verification was limited because the transcript
  extract contained "ни одного пользовательского текстового сообщения" — i.e. the gate could not be
  observed, not that it was skipped. "Couldn't see it" ≠ "it didn't happen."
- **Finding 7d461a40cbab (design_tool `open-design` absent from MK.md enum): real-but-by-design, single
  instance.** This is the only finding verifiable here, and it confirms the enum is intentionally narrow:
  `docs/pmo/artifacts/MK.md:25` → `design_tool: stitch | claude-design | figma | penpot | html`, and
  `docs/design-module/SPEC.md:482` → `default_design_tool: stitch # stitch | claude-design | figma | penpot
  | html`. Per DEC-DEV-0063 (1.5.0), `open-design` was wired as an **external viewer / migrate-import
  target**, not an authoring tool — it surfaces via `skills/design/open-design-viewer.md`,
  `commands/design/migrate.md` (`--to open-design`, "viewer-import, no metadata/iteration"),
  `adapters/stitch-to-opendesign.js`, and an `external_viewers` template, **not** via `design_tool`. So
  omitting `open-design` from the `design_tool` enum is the intended model, not a drift. (info/medium.)

### Lens 2 — Systemic (REFUTES)

The "≥3 recurrence" that triggered this cluster is an artifact of bucketing, not a shared root cause. The
three warning/high findings (610527279177, 6eff514c473f, c5c0338c9563) all come from **one** session
(`256c3749`) building **one** artifact (AM) in a single rapid pass where the spec lagged the instance/skill
— one drift event, not cross-session recurrence. The remaining two are unrelated: `7d461a40cbab` is a
different artifact (MK), different session (`b93269d3`), different cause (open-design viewer model);
`6e783899bc96` is a different session (`48cb5bfe`) and a different *kind* of check entirely (a
process/human-gate concern, not frontmatter-schema conformance). Three heterogeneous concerns sharing
`check_id=A` is exactly the de-conflation hazard DEC-DEV-0057 Lesson #1 warns about — coincidence ≠ systemic.

### Lens 3 — Already-handled / wrong-scope (REFUTES)

- For the AM findings there is **nothing to patch in this repo**: the canonical `AM.md` doesn't exist. Any
  schema-sync must be preceded by **back-porting the entire AM type** — a DEC-DEV-scale scope decision, not
  a synth patch. The audit report already captures this as follow-up #1 ("Back-port AM в источник истины
  экосистемы") and follow-up #2 ("свести AM.md спеку с фактическим frontmatter"). The drift will be
  resolved — or re-decided — when/if AM is back-ported; patching a non-existent file now is wrong scope.
- For the MK-enum finding, the omission is intentional (Lens 1) — a "fix" would be redundant or wrong.
- For the human-gate finding, there is no verifiable defect to address (Lens 1).

## Problem (if survived)

N/A — refuted. (For transparency, the one *genuine* systemic signal underneath this bucket is **SSOT drift
from un-back-ported pilot work**: the AM tier-3 artifact, `/design:map`, and six hooks live only in the
`my-first-test` fork and the canonical repo doesn't know them. That is already recorded as the audit
report's primary follow-up and is a DEC-DEV-scale back-port decision — outside the synthesizer's
"smallest mechanism" remit and not what `check_id=A` schema-conformance is about.)

## Evidence

- **610527279177** — `primary_journeys` flat-list (spec) vs object-list (instance/skill). Artifact
  `.product/app-map.md + .claude/docs/pmo/artifacts/AM.md`. Session `256c3749`. **Discarded:** AM.md absent
  from this repo; verifiable only in pilot fork.
- **6eff514c473f** — `module_roles` used in instance+skill, absent from AM.md schema. Same artifact.
  Session `256c3749`. **Discarded:** same reason (pilot-fork-only).
- **c5c0338c9563** — `cross_module_edges[].kind` used, not in AM.md schema example. Same artifact.
  Session `256c3749`. **Discarded:** same reason; finding itself flagged low-risk/optional.
- **7d461a40cbab** — `design_tool: open-design` absent from MK.md enum. Artifact
  `.product/mockups/MK-003-personal-glossary.md`. Session `b93269d3`. **Genuine but by-design:** open-design
  is a viewer/migrate-target (DEC-DEV-0063), not a `design_tool`; enum correctly omits it (info/medium,
  single instance).
- **6e783899bc96** — MK-002 (Strategic) draft→active with no explicit human approve in extract. Artifact
  `.product/mockups/MK-002-localization-workflow.md`. Session `48cb5bfe`. **Discarded:** uncertain/uncertain
  — evidentiary gap (no human text in transcript extract), not a confirmed violation.

## Proposed patch (if survived)

- **Type:** none
- **Target files:** —
- **Change:** —
- **Risk:** —
- **Confidence / estimate:** —

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status → patched.
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope, then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

**Recommended:** journal status → **dismissed**. Reason: cluster refuted — 4/5 findings reference an AM
artifact that exists only in the `my-first-test` pilot fork (not patchable in this repo) or are
unverifiable; the lone repo-verifiable finding (open-design enum) is intentional per DEC-DEV-0063. The real
underlying signal (un-back-ported AM → SSOT drift) is already tracked as the audit report's follow-up #1 and
belongs in a DEC-DEV back-port decision, not a schema-conformance patch. Suppress this `(D2B04-design, A)`
bucket until AM is back-ported into the ecosystem source.
