---
description: Capture SYSTEMIC feedback about the ecosystem itself (defective rules/processes) into a committable upstream outbox for delivery to the ecosystem repo. Hybrid delivery — local pickup (co-located) or git/issue (remote). C3 upstream contour.
argument-hint: "[--review] [--push] [--issue] [--from <validation-tune|feedback-journal|manual>]"
---

# /ecosystem:meta-feedback

User invoked: `/ecosystem:meta-feedback $ARGUMENTS`

The **upstream** feedback contour — fixes the long-standing misnomer (DEC-DEV-0090): this is
the command whose name actually means "feedback about the ecosystem". It does **not** tune the
local project (that's `/product:validation-tune`). It captures **systemic** defects — a rule or
process that misfires regardless of project — into a committable **upstream outbox**, for
delivery back to the ecosystem repository (`claude-ecosystem-3.0`) where the real fix lands.

> **What's systemic vs local?** Oracle question: «Если бы этот же артефакт лежал в другом
> проекте — правило/процесс сработали бы так же неверно?» **Yes → systemic** (belongs here).
> **No → project-local** (belongs in `/product:validation-tune`). See `skills/ecosystem/meta-feedback.md`.

## What it produces

A committable outbox file in the pilot tree:

```
.product/.upstream/feedback-outbox.md
```

Each entry (`UF-NNN` — upstream-feedback) is self-contained, FEEDBACK-JOURNAL-style:
**симптом → корневая причина → доказательство → предлагаемый фикс → статус**. The outbox is
committed to the pilot's git so it is auditable and survives, and so a remote pilot can deliver it.

## Two invocation modes

### Mode A: escalation sink (called by /product:validation-tune)

When `validation-tune` classifies a finding as SYSTEMIC, it routes here to append a `UF-NNN`
entry. Non-blocking; the local tuning session continues.

### Mode B: human-initiated (this command)

User runs `/ecosystem:meta-feedback` to explicitly:
- Review the current outbox (`--review`)
- Scan local sources for systemic findings not yet captured
- Deliver the outbox upstream (`--push` / `--issue`)

## Process (Mode B)

Load skill `.claude/skills/ecosystem/meta-feedback.md` for detail.

### Step 1: Gather candidate sources

Read (whatever exists locally):
- `.product/.pending/validation-tune.yaml` — proposals marked `Classification: SYSTEMIC`
- `.claude/orchestrator/runs/*FEEDBACK-JOURNAL*.md` — FB-items flagged for upstream (not yet ported)
- Journal entries tagged `#systemic` / `#error-fix` where root cause is an ecosystem artifact
- Existing `.product/.upstream/feedback-outbox.md` — to dedupe against already-captured `UF-*`

### Step 2: Confirm each finding is systemic (verify-before-capture)

For each candidate, re-apply the oracle question and require **evidence** (the rule/process
text + the input that makes it misfire). A candidate that only reproduces because of this
project's specifics is **project-local** → send it back to `/product:validation-tune`, do not
capture. (Mirrors the verify-finding-before-act discipline of the Orchestrator gates.)

### Step 3: Append to outbox

For each confirmed systemic finding, append a `UF-NNN` entry:

```
## 🟠 UF-007 — V-12 references artifact field `owner_fm` that no spec defines

**Источник:** /product:validation-tune escalation (FM-005 VC validation)
**Класс:** SYSTEMIC — reproduces in any project (rule defect, not project specifics)

**Симптом:** V-12 fails on every VC whose frontmatter is spec-correct.
**Корневая причина:** rule body reads `owner_fm`; the canonical field is `owner` (per
                       docs/pmo/artifacts/VC.md). Field renamed; rule not updated.
**Доказательство:** <rule file:line> + <artifact frontmatter> + <validate output>.
**Предлагаемый фикс (для экосистемы):** update V-12 to read `owner`; add a count/field sweep.
**Статус:** captured — awaiting delivery upstream.
```

`UF-NNN` numbering is a single sequence within the outbox (the outbox is the SSOT for the counter).

### Step 4: Deliver (hybrid — choose per pilot topology)

- **local / co-located (default):** leave the committed outbox in place. The ecosystem-repo side
  (Session Audit v2 / reconciliation, running on the same machine) reads it directly — same
  local model as `audit-watch.js`. Print the outbox path so the owner knows where it is.
- **`--push`:** `git add .product/.upstream/feedback-outbox.md && git commit && git push` on the
  pilot branch (needs network → run with sandbox disabled; see env note). For remote/Ubuntu pilots.
- **`--issue`:** open a GitHub issue in the ecosystem repo with the new `UF-*` entries
  (needs network/`gh`). Use for the highest-signal systemic defects.

Delivery only *transports* findings; **acceptance** (turning a `UF-*` into a `DEC-DEV-*` + patch)
happens in the ecosystem repo — never auto-applied here.

### Step 5: Summary

```
Upstream feedback session complete.

Captured: <N> systemic findings (UF-019…UF-021)
Sent back to validation-tune (not systemic): <N>
Delivery: local (outbox at .product/.upstream/feedback-outbox.md) | pushed | issue #NN

Acceptance happens in claude-ecosystem-3.0 (Session Audit / reconciliation).
```

## Important constraints

- **Capture, don't fix.** This command never edits ecosystem artifacts or local validation config.
  It records systemic findings; the fix is authored in the ecosystem repo with a `DEC-DEV-*` entry.
- **Verify before capture.** A finding must reproduce independent of this project. Project-local
  noise goes to `/product:validation-tune`, not here.
- **Outbox is committed.** It lives in git so it is auditable and deliverable from remote pilots.
- **Human-gated delivery.** `--push` / `--issue` are explicit; default leaves the outbox local.
- **No silent dedupe loss.** When skipping a candidate as already-captured, name the `UF-*` it matches.

## Out of scope (v1 — DEC-DEV-0090)

- **Receiving-side automation** (auto-pickup of the outbox, dedupe against existing DEC-DEV,
  unified finding contract with `FEEDBACK-JOURNAL` + Session Audit) — **phase 2**.
- Cross-pilot aggregation of multiple outboxes.

## Related

- Skill: `.claude/skills/ecosystem/meta-feedback.md` — systemic-classification + outbox methodology
- Local sibling: `/product:validation-tune` — project-local tuning (downstream contour)
- Receiving side (ecosystem repo): Session Audit v2 (`audit-watch.js`) + reconciliation
- DEC-DEV-0090 — design rationale (`dev/FEEDBACK_CONTOUR_SPLIT_PLAN.md`)
