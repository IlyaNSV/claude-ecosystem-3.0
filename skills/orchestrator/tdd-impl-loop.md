---
description: Orchestrator P5 regimen — drive a feature spec to implemented code via a native per-task TDD loop that LIFTS cc-sdd kiro-impl's prompts and gates (because kiro-impl is disable-model-invocation) and adds the gate-risk-classifier. Load during /orchestrator:run feature-to-tdd-impl.
---

# tdd-impl-loop — native P5 controller that lifts cc-sdd (P5)

P5 implements a feature's `tasks.md` task-by-task with TDD, independent review, debug
escalation, and a final GO-gate. cc-sdd already has all of this in **`kiro-impl`** — but
`kiro-impl` is `disable-model-invocation: true`, so neither a Workflow nor the model can
invoke it (only a human typing the command). Therefore the Orchestrator owns the
**dispatch FSM** itself, while **lifting** every piece of methodology from cc-sdd.

> Cost discipline (DEC-DEV-0076/0072): do NOT rewrite kiro-impl's implementer/reviewer/
> debugger methodology. Lift it. Net-new is the FSM + the gate-risk-classifier.

## What we LIFT vs what we OWN

| Concern | Source |
|---|---|
| Implementer prompt (TDD: RED→GREEN→REFACTOR, Task Brief, structured STATUS) | **lift** `.claude/skills/kiro-impl/templates/implementer-prompt.md` |
| Reviewer prompt (adversarial, "run git diff yourself", 12-point rubric) | **lift** `.claude/skills/kiro-impl/templates/reviewer-prompt.md` + `kiro-review` |
| Debugger prompt (fresh-context root cause) | **lift** `.claude/skills/kiro-impl/templates/debugger-prompt.md` + `kiro-debug` |
| Completion verification (fresh evidence) | **lift** `kiro-verify-completion` |
| Feature-level GO/NO-GO gate | **lift** `kiro-validate-impl` |
| Per-task gate-severity routing (HIGH/LOW) | **OWN** `gate-risk-classifier` (P0-2) |
| Durable dispatch FSM + bounded rounds + sequencing | **OWN** Workflow skeleton |

The kiro templates are **self-contained** (they embed the protocol as a fallback: "if the
host can invoke skills, use kiro-review; otherwise follow the embedded procedure"). So the
lift is just: an agent reads the template and applies it. We never copy kiro's prompt text
into the ecosystem repo — that would re-create the tri-location sync debt (DEC-DEV-0040).
The templates live in the pilot's cc-sdd install and are read at runtime.

## The loop (per task, SEQUENTIAL)

Tasks run one at a time — even `(P)` tasks — for git-conflict safety, mirroring kiro-impl.

```
plan:   classify every task (gate-risk-classifier) + discover validation commands + order by _Depends_
per task (dependency order, skip done/_Blocked_):
   impl    = agent(implementer-prompt.md + task context)        # lift; structured STATUS
   STATUS == NEEDS_CONTEXT → re-dispatch once with more context
   STATUS == BLOCKED       → debugger-prompt.md (≤2 rounds) → RETRY | BLOCK | STOP_FOR_HUMAN
   gate by tier:
     HIGH → agent(reviewer-prompt.md / kiro-review)  — independent adversarial
     LOW  → inline-verify by profile                 — skeleton, no separate subagent
   VERDICT == REJECTED → re-implement (≤2 rounds, reduced re-gate) → debug → else _Blocked_
   APPROVED → kiro-verify-completion (fresh evidence) → SELECTIVE commit + mark [x]
final:  kiro-validate-impl → GO | NO-GO (fix concrete findings ≤3 rounds) | MANUAL_VERIFY_REQUIRED
```

## Invariants preserved from kiro-impl (do not weaken)

- **Strict structured-handoff parsing** — read implementer `STATUS` only from the exact
  `## Status Report` `- STATUS:` line; reviewer `VERDICT` only from `## Review Verdict`
  `- VERDICT:`. Never infer from prose; re-dispatch once if unparseable.
- **Selective staging** — never `git add -A` / `git add .`; stage explicit changed files +
  tasks.md only.
- **No destructive reset** inside the loop (`git checkout .` / `git reset --hard`).
- **Bounded rounds** — 2 review re-dispatch, 2 debug, 3 final-validation remediation.
- **Notes-ledger** — append cross-cutting insights to `## Implementation Notes` in tasks.md
  (this is the persistent inter-task contract, P1-3); feed relevant notes into later tasks.
- **Upstream-ownership routing** — if a failure's root cause belongs to an upstream/shared
  spec, do NOT patch around it in the downstream task; route it back (capability/Product
  channel), keep the task `_Blocked_` until the contract is repaired.
- **Feature Flag Protocol** for behavioral tasks (RED with flag OFF → GREEN with flag ON →
  remove flag, tests still green).

## What P5 adds over a human running /kiro-impl

1. **gate-risk-classifier** — kiro-impl always runs the full independent reviewer; P5
   rations it (HIGH→reviewer / LOW→inline-verify), the validated cost-optimization.
2. **Durable Workflow skeleton** — phase/agent boundaries survive `/compact` (kiro-impl
   already has good resume discipline; this is incremental).
3. **Fits the cross-feature pipeline** — P5 is one stage of P3→P5→P6 across features, with
   the §6 capability channel for infra/secret gaps.

## Anti-patterns

1. **Rebuilding kiro's implementer/reviewer/debugger from scratch.** Lift the templates.
2. **Parallelizing tasks.** Sequential only (git safety) — `(P)` is informational.
3. **Weakening the structured-handoff parse or the bounded rounds.** Those are what keep
   the loop deterministic and terminating.
4. **Self-fixing an upstream root cause inside a downstream task.** Route it; block the task.
5. **Skipping kiro-verify-completion before the commit / claim.** Fresh evidence, not the
   implementer's word.
