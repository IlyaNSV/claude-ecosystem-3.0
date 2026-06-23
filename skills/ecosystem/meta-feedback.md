---
description: C3 upstream contour — methodology for capturing SYSTEMIC ecosystem defects (rules/processes that misfire regardless of project) into a committable outbox for delivery to the ecosystem repo. Companion to /ecosystem:meta-feedback.
---

# Upstream Meta-Feedback — C3 Skill (ecosystem-facing)

Methodology for `/ecosystem:meta-feedback` — the **upstream** half of the feedback split
(DEC-DEV-0090). The **local** half (`/product:validation-tune` + `skills/product/validation-tune.md`)
tunes one project; this half routes **systemic** defects back to the ecosystem repository.

## Core idea

A finding observed while using the ecosystem in a real project can be one of two things:
- **project-local** — the rule/process is fine, this project's specifics make it noisy → tune locally;
- **systemic** — the rule/process is wrong for *everyone* → it must be fixed in the ecosystem itself.

This skill captures the **systemic** class into a committable **upstream outbox**
(`.product/.upstream/feedback-outbox.md`) so it travels back to `claude-ecosystem-3.0`, where the
real fix is authored as a `DEC-DEV-*` patch. **Capture here; fix there.**

## The classification oracle (single source of the local/upstream boundary)

> «Если бы этот же артефакт лежал в **другом** проекте — правило/процесс сработали бы так же неверно?»

- **No → PROJECT-LOCAL.** Send to `/product:validation-tune`. Do not capture upstream.
- **Yes → SYSTEMIC.** Capture as `UF-NNN`.

Sharpen "yes" with evidence categories — a finding is systemic when the root cause is in an
**ecosystem-owned artifact**, not in `.product/` content:
- a V-* rule references a field/artifact that the canonical spec doesn't define (or renamed);
- a rule's logic produces a false positive on spec-valid input;
- a process/gate step is always-redundant or always-missing a needed check;
- a skill/command instruction is factually wrong (stale path, wrong field name, broken contract);
- a hook misfires independent of project data.

If the root cause is in `.product/` (the project's own artifacts) — it is **not** systemic.

## When AI should initiate (Mode A — escalation from validation-tune)

`/product:validation-tune` calls here when it classifies a proposal as SYSTEMIC. The escalation
carries: the rule/process id, the reproduction (input + expected vs actual), and the suspected
ecosystem-owned root cause. This skill appends a `UF-NNN` entry (Step «Capture» below). It does
**not** block the local tuning session.

## Process

### Step 1: Collect candidates

- `.product/.pending/validation-tune.yaml` entries marked `Classification: SYSTEMIC`
- `.claude/orchestrator/runs/*FEEDBACK-JOURNAL*.md` — FB-items flagged upstream, not yet ported
- Journal entries where the root cause is an ecosystem artifact
- Dedupe against existing `UF-*` in `.product/.upstream/feedback-outbox.md`

### Step 2: Verify before capture

Re-apply the oracle question and demand evidence: the **ecosystem artifact text** (rule/skill/hook
file + line) plus the **input** that makes it misfire, plus expected-vs-actual. A candidate that
only reproduces because of this project's data is project-local → return it to `validation-tune`.
This mirrors the verify-finding-before-act discipline of the Orchestrator gates: don't capture a
finding you haven't confirmed against ground truth.

### Step 3: Capture as UF-NNN

Append to `.product/.upstream/feedback-outbox.md`:

```
## <severity> UF-NNN — <one-line systemic defect>

**Источник:** <validation-tune escalation | feedback-journal FB-NNN | manual scan>
**Класс:** SYSTEMIC — <one line: why it reproduces regardless of project>

**Симптом:** <observable failure>
**Корневая причина:** <ecosystem-owned artifact + file:line>
**Доказательство:** <rule/skill text> + <input> + <expected vs actual>
**Предлагаемый фикс (для экосистемы):** <what should change in claude-ecosystem-3.0>
**Статус:** captured — awaiting delivery / delivered (<how>) / ported → DEC-DEV-NNNN
```

Severity legend mirrors FEEDBACK-JOURNAL: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low/positive · ℹ️ note.

`UF-NNN` is one sequence; the outbox file is the SSOT for the counter (no per-run fragmentation —
the lesson from the Orchestrator FEEDBACK-JOURNAL split).

### Step 4: Deliver (hybrid)

| Mode | Mechanism | Use when |
|---|---|---|
| local (default) | leave committed outbox in tree; ecosystem-repo side reads it directly | pilot co-located with ecosystem repo (same machine) |
| `--push` | commit + push outbox on pilot branch | remote / Ubuntu pilot |
| `--issue` | open GitHub issue in ecosystem repo with new `UF-*` | high-signal defects worth a tracked issue |

`--push` / `--issue` need network → run with sandbox disabled (port-443). Delivery transports
only; acceptance is a separate act in the ecosystem repo.

## Acceptance happens upstream (not here)

A `UF-*` becomes a fix only when, **in `claude-ecosystem-3.0`**, it is triaged into a `DEC-DEV-*`
entry + patch (today: manually, or via Session Audit v2 / reconciliation reading the outbox).
This skill never edits ecosystem artifacts and never auto-applies anything. Mark the `UF-*`
`ported → DEC-DEV-NNNN` once accepted, so the outbox shows what is still open.

## Anti-patterns

1. **Capturing project-local noise as systemic.** Inflates the outbox; wastes upstream triage.
   The oracle question + evidence gate is the guard.
2. **Fixing here.** This contour captures; the ecosystem repo fixes. Editing rules/config from
   here erases the human-gated upstream review.
3. **Silent dedupe loss.** When skipping a candidate already captured, name the matching `UF-*`.
4. **Per-run outbox files.** Keep one outbox = one `UF-*` counter. Do not spawn `S7-OUTBOX` etc.
   (the fragmentation lesson from `FEEDBACK-JOURNAL` / `S6-FEEDBACK-JOURNAL`).

## Integration

- Invoked by `/ecosystem:meta-feedback` (primarily) and by `/product:validation-tune` (escalation)
- Produces / appends `.product/.upstream/feedback-outbox.md` (committed)
- Receiving side: Session Audit v2 (`dev/meta-improvement/scripts/audit-watch.js`) + the **phase-2
  consolidator `dev/meta-improvement/scripts/feedback-intake.js`** (DEC-DEV-0097, ecosystem-repo /
  dev-only): it picks this outbox up, maps `UF-*` / `FB-*` / Session-Audit findings onto one finding
  contract, and dedupes each against `DEV_JOURNAL.md` (open | likely-ported | ported). Capture here;
  the consolidator reads + reports there (it never edits the outbox or auto-applies a fix).

## Related

- Command: `/ecosystem:meta-feedback`
- Local sibling: `/product:validation-tune` + `skills/product/validation-tune.md`
- Plan / rationale: `dev/FEEDBACK_CONTOUR_SPLIT_PLAN.md` (DEC-DEV-0090)
- Precedent (local read model): `dev/meta-improvement/scripts/audit-watch.js`
