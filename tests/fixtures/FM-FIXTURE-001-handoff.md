---
id: HANDOFF-FM-001
type: feature-handoff
feature: FM-001
title: "Note capture and promotion"

status: ready
mode: production
version: 1
generated_at: 2026-05-25T12:00:00Z
generator: product-module-v1.2
dor_overrides: []

dor_validation_passed: true
blocking_issues: []
warnings: []
validation_rules_passed: [V-H-01, V-H-02, V-H-03, V-H-05, V-H-06]
validation_rules_failed: []

embedded_artifacts:
  feature: FM-001
  scenarios: [SC-001, SC-002]
  business_rules: [BR-001]
  lifecycles: [LC-001]
  verifications: [VC-001]
  invariants: [IC-001]
  rpm_roles_excerpted: [R-user]
  bg_terms_excerpted: [Note, Promotion]

artifact_hashes:
  FM-001: "sha256:0000000000000000000000000000000000000000000000000000000000000001"
  SC-001: "sha256:0000000000000000000000000000000000000000000000000000000000000002"
  SC-002: "sha256:0000000000000000000000000000000000000000000000000000000000000003"
  BR-001: "sha256:0000000000000000000000000000000000000000000000000000000000000004"
  LC-001: "sha256:0000000000000000000000000000000000000000000000000000000000000005"
  VC-001: "sha256:0000000000000000000000000000000000000000000000000000000000000006"
  IC-001: "sha256:0000000000000000000000000000000000000000000000000000000000000007"

target_adapter: "universal"
target_tool: null
target_tool_version: null

previous_version: null
regenerated_from: "manual"

nfr_status: declined
nfr_decline_reason: "Pilot stage; applying MVP-tier defaults from NFR.md §5"
current_product_tier: pilot

created: 2026-05-25
updated: 2026-05-25
---

## 1. Executive Summary

**Feature:** Note capture and promotion
**Delivers value to:** Solo founder solving "capture insight without context-switch"
**Validates hypothesis:** HYP-001 (success = ≥5 notes/week converted to structured artifact)
**Release:** RL-001, target 2026-06-15
**Has UI:** no
**Critical dependencies:** none

The feature lets the user drop an unstructured **Note** anywhere in `.product/`
via a quick-capture command, then later **promote** it to a structured artifact
(PS, HYP, FM, etc.) once intent crystallizes.

## 2. Business Context

**FM-001 — Note capture and promotion**

- Why: discovery sessions surface fleeting insights that don't yet fit any
  artifact type; losing them = re-discovering them later.
- What: low-friction capture + deliberate promotion path.
- Success: ≥5 notes/week, ≥60% promoted within 14 days, <30% abandoned.

**Segment:** SEG-solo-founder.
**Value proposition:** "Capture now, classify later — without losing insights to context switches."
**Hypothesis:** HYP-001 — solo founders adopt quick-capture if friction < 10 seconds.

## 3. Terminology

| Term | Definition | Alternative terms to avoid |
|---|---|---|
| Note | Unstructured idea captured for later classification | "draft", "memo" |
| Promotion | Conversion of a Note to a structured artifact | "upgrade", "conversion" |

## 4. Role & Permission Model

| Role | Actions |
|---|---|
| R-user | capture-note, list-notes, promote-note, discard-note |

No conditional permissions (single-role MVP).

## 5. Scenarios

### SC-001 — Quick-capture a note

**Actors:** R-user
**Preconditions:** `.product/` initialised
**Trigger:** User invokes capture flow

**Steps:**
1. R-user provides note text (free-form, ≤500 chars)
2. System creates `.product/notes/NOTE-NNN.md` with frontmatter (id, created, status: captured)
3. System confirms capture with NOTE-NNN identifier

**Postconditions:** NOTE-NNN persisted with status=captured

### SC-002 — Promote a note to structured artifact

**Actors:** R-user
**Preconditions:** NOTE-NNN exists with status=captured
**Trigger:** User selects NOTE-NNN for promotion + target artifact type

**Steps:**
1. R-user picks target type (PS | HYP | FM | other)
2. System opens structured-authoring flow seeded with NOTE-NNN content
3. R-user completes required fields (per target artifact spec)
4. System creates target artifact + marks NOTE-NNN as status=promoted with reference

**Postconditions:** target artifact created; NOTE-NNN.status=promoted

## 6. Business Rules

### BR-001 — Note retention

**Statement:** A Note remains in `.product/notes/` indefinitely until explicitly
discarded by R-user; status transitions (captured → promoted | discarded) are
one-way (no reverting to captured).

**Context:** retention discipline; promoted notes preserved for audit trail.
**Rationale:** auditability of insight evolution.

## 7. Entity Lifecycles

### LC-001 — Note

**Entity:** Note
**States:** captured | promoted | discarded

States transitions:
- captured → promoted (via SC-002)
- captured → discarded (via discard flow, out of scope this FM)

## 8. Verification Criteria

### VC-001 — Quick-capture happy path

**Given** `.product/` initialised
**When** R-user captures a note "spike on payment edge case"
**Then** a file `.product/notes/NOTE-NNN.md` exists with status=captured and original text preserved verbatim.

## 9. Invariants

### IC-001 — Note ID monotonicity

**Statement:** NOTE-NNN identifiers are monotonically increasing per project; no reuse on discard.
**Severity:** medium
**Detection:** scan `.product/notes/` for gaps or duplicates.

## 11. Non-Functional Requirements

**Status:** NFR Review explicitly declined for this feature (2026-05-25).

**Rationale:** Pilot stage; small audience (~1 user); applying Ecosystem 3.0 MVP-tier defaults from NFR.md §5.

**Applicable defaults (MVP tier):**
- Performance: capture flow <2s end-to-end
- Reliability: single-user local filesystem; no SLA
- Security: filesystem ACLs only
- Privacy: notes stored locally, never transmitted

## 12. Dependencies & Context

- **Feature dependencies:** none
- **External integrations:** none (filesystem only)
- **Environment prerequisites:** writable `.product/notes/` directory

## 13. Out of Scope

- Encryption of note content (deferred to v2 if multi-user scenarios emerge)
- Note search / fuzzy lookup (deferred; small N in pilot)
- Bulk discard (deferred; manual filesystem deletion sufficient for pilot)
