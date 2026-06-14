---
description: Orchestrator P5 gate — deterministically decide each task's verify-gate severity (HIGH → independent adversarial reviewer / LOW → profiled inline-verify) instead of eyeballing it. Backed by orchestrator/lib/gate-risk-classifier.cjs. The key rule: enforcement decides, not "touches an invariant" — declarative (UNIQUE/CHECK) is LOW, imperative (transaction/timing/row-lock) is HIGH. Load during /orchestrator:run feature-to-tdd-impl planning.
---

# gate-risk-classifier — verify-gate severity as a predicate (P0-2)

cc-sdd's `kiro-impl` runs a full independent reviewer after EVERY task — safe but
expensive (×2 subagents on each of ~26 tasks). The most-frequent un-codified human
judgment in RUN 01 was "does THIS task need the independent reviewer, or is
inline-verify enough?". This skill replaces that eyeball with a deterministic predicate.

> RUN 01 grounding (P0-2, DEC-DEV-0073; full design `dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md`):
> validated 16/17 against the run's actual gate decisions, 17/17 with the M5 first-task
> rule. The single REJECT of the whole run (atomic reset, task 4.6) landed on a HIGH-tier
> task — and the predicate marks it HIGH.

## The determinism boundary

The verdict comes from CODE. The Workflow plan phase dispatches an agent that runs the
helper and relays its JSON — it does not eyeball tiers:

```bash
node .claude/orchestrator/lib/gate-risk-classifier.cjs \
  --tasks .kiro/specs/<feature>/tasks.md \
  --requirements .kiro/specs/<feature>/requirements.md \
  [--registry .claude/orchestrator/registries/load-bearing.<FM>.yaml]
# → { tasks: [ { id, tier: HIGH|LOW, profile, why, confidence } ] }
```

## The predicate

**HIGH ⟺ the task introduces/changes IMPERATIVE logic carrying a load-bearing marker:**

| Marker | What |
|---|---|
| **M1 security-AC** | anti-enumeration, constant-time/timing-parity, default-deny/fails-closed, CSRF/state-verify, safe-redirect, token issue/consume/rotate |
| **M2 concurrency/idempotency** | FOR UPDATE row-lock ordering, atomic multi-step transaction, LRU/eviction, idempotent signal, webhook/outbox dedup |
| **M3 shared primitive** | changes a shared mutable primitive used cross-task (`consume()`, `invalidateAllForUser()`, session create) |
| **M4 cross-FM seam** | `_Boundary_` / contract leaves the owned zone (pmo-mapping owner ≠ this FM) |
| **M5 first-task** | the first task of a feature gets one foundational review (it sets the feature's patterns) — variant A, design §6 |

**LOW ⟺ none of M1–M5, and the task fits a verify-profile** (declarative-invariant /
pure-module / test-only / UI / infra-mechanical).

**DEFAULT:** uncertain (no marker, no clear profile) → **HIGH** (cheaper to over-review
than to miss a timing-oracle). **OVERRIDE:** a human may force a tier; record it in the
Notes-ledger for rubric calibration.

## THE key refinement — enforcement, not presence

Referencing an invariant (IC-/BR-) does **not** by itself make a task HIGH. What decides
is HOW the invariant is enforced:

- **declarative** (UNIQUE / CHECK constraint, schema) → **LOW + DB-introspection** — the
  constraint *is* the guarantee; the gate verifies the constraint exists, no reviewer.
- **imperative** (transaction ordering, timing, two-row-lock ordering, race windows) →
  **HIGH** — this is exactly where subtle bugs hide (RUN 01 task 4.6 = atomic reset).

This came straight from the run: tasks 1.3/2.1/4.2 touch IC-001/004 but passed
inline+introspection (declarative); 4.6 (IC-006, atomic reset) was imperative → independent
reviewer → REJECT.

## Verify-profiles (what the LOW inline-verify actually does)

| profile | RED evidence | property-check |
|---|---|---|
| `declarative-invariant` | classic RED | **live DB introspection** (`pg_constraint`/`pg_indexes`) — constraint present |
| `pure-module` | classic RED | property assert (e.g. identical-response for anti-enum) |
| `test-only` | would-fail-if-broken | mutation proof (inject a defect → test fails → revert) |
| `UI` | — | boundary + CTA/route hrefs + proxy relay |
| `infra/mechanical` | — | boundary + `git check-ignore` of new artifact + secrets-scan |

All LOW profiles are fully deterministic (a fixed command set) — Layer-3 executed by the
skeleton, not a separate role-agent.

## load-bearing registry (optional refinement)

The classifier can take a registry that marks each IC-/BR- as `imperative` or
`declarative`. It is **derived** (scan requirement/invariant text for M1/M2 signatures —
`deriveRegistry`), not hardcoded, with an optional human override file
(`orchestrator/registries/load-bearing.<FM>.yaml`). Without a registry the predicate runs
on markers + profiles alone (sufficient for imperative cases — markers catch them);
the registry only refines the declarative-vs-imperative call on referenced invariants.
Per-project registry derivation is a documented follow-up (design §10).

## Anti-patterns

1. **Eyeballing the tier.** Run the helper; relay its JSON. The eyeball is exactly what
   this replaces.
2. **"Touches an invariant → HIGH".** Wrong — declarative enforcement is LOW + introspection.
   Over-HIGH-ing every invariant task wastes the reviewer it exists to ration.
3. **Skipping inline-verify on LOW.** LOW ≠ no verification. The profile's RED + property
   check still runs; it is just not a separate adversarial subagent.
4. **Forcing all-LOW to save cost.** A false-LOW on a load-bearing task is how a
   timing-oracle ships. When unsure → HIGH.
