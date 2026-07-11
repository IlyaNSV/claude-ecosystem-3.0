---
description: Run an Orchestrator PMO process end-to-end as an in-harness Workflow. First increment ships P3 batch-features-to-cc-sdd (route Product handoffs into cc-sdd specs). Reads handoffs + tool-docs; delegates spec generation to cc-sdd's kiro-spec-batch; gates with a content-fidelity preflight and an independent coverage oracle.
argument-hint: "<process> [--feature FM-NNN ...] [--all] [--no-stack-gate] [--fabric] [--autonomy L0|L1|L2|L3]"
---

# /orchestrator:run

User invoked: `/orchestrator:run $ARGUMENTS`

You are the **orchestrator-controller (RA-0)**. You load the process regimen and launch
its Workflow skeleton. The Workflow owns sequencing + deterministic gates; cc-sdd's kiro
skills own the spec-generation judgment (see `orchestrator/README.md` — hybrid design,
DEC-DEV-0076).

## Available processes (first increment)

| `<process>` | What it does | Zone |
|---|---|---|
| `decide-architecture-foundation` | Decision-support on an undecided architecture fork: a 3-prior jury (velocity/fidelity/integrity) → a scored recommendation + DRAFT DEC for the owner (P2) | D2-T01/T02 |
| `batch-features-to-cc-sdd` | Route a batch of `status: ready\|partial` handoffs into cc-sdd specs (P3) | D2-T01/T06 |
| `audit-spec-fidelity` | Audit generated specs against `.product` for fidelity drift, before impl (P4) | D2-T verify |
| `feature-to-tdd-impl` | Drive one feature's `tasks.md` to implemented code via native TDD loop (P5) | D3 |
| `validate-feature-impl` | Feature-level GO/NO-GO gate after impl: full suite+build + 3 validators (RA-8/9/10) + verify-finding (P6) | D3 verify |
| `runtime-smoke-readiness` | Runtime-smoke gate after P6 GO: is a boot ATTEMPTABLE (run-target + §6 boot-caps + env)? boot the dev server + diagnose a failed start (P7) | D3+ runtime |

P5 delegates its feature-level gate to P6 (`validate-feature-impl`) via `workflow()`; you can
also run P6 standalone to re-gate an already-implemented feature. P7 (`runtime-smoke-readiness`)
runs after a P6 GO — its **readiness leg** (the deterministic verdict) is built; the **live boot**
is substrate-gated (needs a pilot dev env), and the full Epic E deploy chain awaits Integrator
D3-runtime. **P2 (`decide-architecture-foundation`) is built** — it runs an undecided
architecture fork through a heterogeneous 3-prior consilium (velocity/fidelity/integrity) and
hands the owner a scored recommendation + a DRAFT DEC; it never auto-decides (FB-LR-07). Its
live grade is a dogfood on the S7 fork `PA-040/042`.

## Pre-flight (read-only, before launching)

**Always (the cc-sdd processes P3–P7 — P2 is the exception, see its block below):** confirm cc-sdd is `active` in `.claude/integrator/active-tools.yaml`. If not →
stop: these processes need cc-sdd; run `/integrator:add cc-sdd` first. Do NOT improvise a
substitute.

**For `decide-architecture-foundation` (P2)** — the one process that does NOT need cc-sdd (it
reads a declared fork + the `.product`/spec sources; it does not touch cc-sdd):
1. `consilium-synth` present (`.claude/orchestrator/lib/consilium-synth.cjs`) — the
   deterministic matrix/rank/veto backbone (the recommendation is not eyeballed).
2. **A declared fork.** `--fork <PA-NNN | ref>` names the architecture fork to weigh — best a
   **cross-spec-conflict pending-action** that already enumerates the options (P6/P4 escalate
   these; the S7 fork `PA-040/042` is the live example). P2 does NOT detect forks — it consumes
   a posed one; a fork with fewer than 2 enumerated options is under-specified → P2 surfaces
   that (route the spec-author/owner), it does not fabricate an option.

**For `batch-features-to-cc-sdd` (P3):**
1. `kiro-spec-batch` skill installed.
2. **Handoffs?** `--feature FM-NNN` (repeatable) → those handoffs; `--all`/none → all
   `status: ready|partial` in `.product/handoffs/`; none found → stop.
3. **Stack decided?** P3 pins `tech.md`. If `.kiro/steering/tech.md` already pins a stack,
   proceed. If not, this is the one irreducible human gate (RUN 01) — ask the user (or run
   P2 (`decide-architecture-foundation`) to weigh the stack fork through the consilium first). `--no-stack-gate` passes `stackDecided:false` to halt cleanly at
   Steering (dry inspection).

**For `feature-to-tdd-impl` (P5):**
1. `kiro-impl` templates present (`.claude/skills/kiro-impl/templates/{implementer,reviewer,debugger}-prompt.md`)
   and the `kiro-review` / `kiro-verify-completion` / `kiro-validate-impl` skills installed
   (P5 LIFTS these). If absent → stop; cc-sdd install is incomplete.
2. **Spec authored?** `.kiro/specs/<feature>/{spec.json,requirements.md,design.md,tasks.md}`
   must exist and tasks be approved (run P3 / `kiro-spec-*` first). Resolve `<feature>` from
   `--feature` (cc-sdd slug, e.g. `auth`).
3. **Env ready?** `feature-to-tdd-impl` implements real code — it runs the shared
   env-readiness probe (`.claude/orchestrator/lib/env-readiness.cjs`) as a pre-flight and
   forwards the verdict to P6 (DEC-DEV-0092). A down substrate does NOT abort impl (a task may
   bring it up) but is carried on the `readiness` axis so the gate is never a false NO-GO. A
   missing tool/secret is a capability gap → request from Integrator (§6), do not self-equip.

**For `audit-spec-fidelity` (P4)** — run BETWEEN P3 and P5 (the pre-impl gate):
1. The features' specs exist (`.kiro/specs/<feature>/{requirements,design,tasks}.md`) — run P3 first.
2. `fidelity-oracle` present (`.claude/orchestrator/lib/fidelity-oracle.cjs`).
3. `design-coverage-oracle` present (`.claude/orchestrator/lib/design-coverage-oracle.cjs`) — the
   design→tasks structural-coverage layer (T4, DEC-DEV-0095) catches a design module no task builds
   (the unmounted-API gap), pre-impl.
4. Resolve `--feature` slug(s) to audit; each needs its `.product` source (handoff + traced
   FM/SC/BR/IC/NFR artifacts) readable for the deterministic trace-integrity gate.

**For `validate-feature-impl` (P6)** — usually reached via P5's delegation, but runnable standalone:
1. The feature is implemented (`.kiro/specs/<feature>/tasks.md` tasks mostly `[x]`) — P6 gates
   the result, it does not implement. Resolve `<feature>` from `--feature` (cc-sdd slug).
2. `coverage-oracle` present (`.claude/orchestrator/lib/coverage-oracle.cjs`) — the
   requirements-coverage validator (RA-8) reuses it as the anti-self-report backbone.
3. `env-readiness` present (`.claude/orchestrator/lib/env-readiness.cjs`) — the mechanical
   layer probes it BEFORE the suite so a down substrate is `readiness=ENV_NOT_READY`
   (MANUAL_VERIFY), not a false NO-GO (DEC-DEV-0092).
4. `remediation-guard` present (`.claude/orchestrator/lib/remediation-guard.cjs`) — the
   remediation loop's discretion backbone (DEC-DEV-0096 / T5): classifies a block and
   self-checks a fix note so a cross-spec/design contradiction escalates, never self-resolves.
5. The full TEST/BUILD commands are discoverable (manifests/CI) — the mechanical layer runs them.

**For `runtime-smoke-readiness` (P7)** — run AFTER a P6 GO (the runtime gate):
1. `runtime-readiness` present (`.claude/orchestrator/lib/runtime-readiness.cjs`) — the deterministic
   readiness core (run-target detection + §6 boot-capability disposition + verdict). `env-readiness`
   and `capability-probe` (`.claude/orchestrator/lib/`) are its inputs (env axis + §6 disposition).
2. A **run target** is declared (`package.json` scripts.dev|start|serve, or a runtime command) — without
   one the verdict is `NOT_STARTABLE` (a scaffold/spec gap routed to Product, not a P7 failure).
3. **Substrate-gated:** the live boot needs a working dev env (Docker/DB/etc up). Pass `bootSmoke:false`
   to run the **readiness leg only** (assess + disclose, no boot) — the explicit knob while the
   execution leg is substrate-gated. A boot-required capability that is `BLOCK` emits a §6
   capability-request (Integrator/Product, OD7 await) — do NOT self-equip or mock it.

## Launch

Load the regimen skills for context, then launch the matching Workflow.

> **Pass `args` as an OBJECT, not a JSON string.** Write `args: { feature: "auth" }`,
> NOT `args: "{\"feature\":\"auth\"}"`. The harness forwards `args` verbatim — a
> stringified value reaches the script as a string, so `feature`/`handoffs` come back
> undefined and the process runs target-less (live-run RUN 01 FB-001/FB-002: an empty
> feature let the Plan agent pick the wrong spec). The scripts now defensively parse a
> string, but pass an object so the guard is belt-and-suspenders.

**P2 — `decide-architecture-foundation`** (skills: `orchestrator-init`,
`architecture-consilium`) — decision-support on an undecided architecture fork; hands the
owner a scored recommendation + a DRAFT DEC, never an auto-decision:

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/decide-architecture-foundation.mjs',
  args: {
    fork: "<PA-NNN | ref>",                                  // the declared fork (best: a cross-spec-conflict PA)
    synth: '.claude/orchestrator/lib/consilium-synth.cjs',   // DEC-DEV-0129: deterministic matrix/rank/veto
    forkBrief: {}                                            // optional pre-assembled ForkBrief (else P2 lifts it from the PA)
  }
})
```

**P3 — `batch-features-to-cc-sdd`** (skills: `orchestrator-init`, `build-steering`,
`build-briefs-from-handoff`, `coverage-oracle`):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/batch-features-to-cc-sdd.mjs',
  args: {
    handoffs: [ ".product/handoffs/FM-NNN-handoff.md", ... ],   // resolved above
    adapter: '.claude/integrator/adapters/handoff-to-ccsdd.js',
    oracle: '.claude/orchestrator/lib/coverage-oracle.cjs',
    stackDecided: true | false
  }
})
```

**P5 — `feature-to-tdd-impl`** (skills: `orchestrator-init`, `gate-risk-classifier`,
`tdd-impl-loop`):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/feature-to-tdd-impl.mjs',
  args: {
    feature: "<cc-sdd slug, e.g. auth>",
    specDir: ".kiro/specs/<feature>",
    classifier: '.claude/orchestrator/lib/gate-risk-classifier.cjs',
    envProbe: '.claude/orchestrator/lib/env-readiness.cjs',   // DEC-DEV-0092: pre-flight readiness probe (forwarded to P6)
    remediationGuard: '.claude/orchestrator/lib/remediation-guard.cjs',   // DEC-DEV-0096 / T5: block-discretion backbone (transient-retry vs escalate)
    kiroTemplates: '.claude/skills/kiro-impl/templates',
    registry: ''   // optional .claude/orchestrator/registries/load-bearing.<FM>.yaml
  }
})
```

**P4 — `audit-spec-fidelity`** (skills: `orchestrator-init`, `audit-spec-fidelity`) — run
between P3 and P5 (pre-impl fidelity gate):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/audit-spec-fidelity.mjs',
  args: {
    features: [ "<cc-sdd slug>", ... ],   // resolved above
    specBase: '.kiro/specs',
    oracle: '.claude/orchestrator/lib/fidelity-oracle.cjs',
    coverageOracle: '.claude/orchestrator/lib/design-coverage-oracle.cjs'   // DEC-DEV-0095: design→tasks structural coverage (T4)
  }
})
```

**P6 — `validate-feature-impl`** (skills: `orchestrator-init`) — feature-level GO-gate AFTER
impl; usually invoked by P5 via `workflow()`, runnable standalone to re-gate a feature:

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/validate-feature-impl.mjs',
  args: {
    feature: "<cc-sdd slug, e.g. auth>",
    specDir: ".kiro/specs/<feature>",
    oracle: '.claude/orchestrator/lib/coverage-oracle.cjs',
    envProbe: '.claude/orchestrator/lib/env-readiness.cjs',   // DEC-DEV-0092: readiness probe (run before the suite)
    remediationGuard: '.claude/orchestrator/lib/remediation-guard.cjs',   // DEC-DEV-0096 / T5: remediation-discretion backbone (escalate cross-spec/design conflicts)
    source: '.product/handoffs/FM-NNN-handoff.md',   // optional — RA-8 coverage-oracle backbone
    validationCommands: {},                          // {test, build, smoke} if known; else discovered
    concerns: [],                                    // forwarded from P5 (deferred-capability flags)
    degraded: false,                                 // true if upstream tasks were blocked → advisory
    readiness: 'READY'                               // optional pre-flight hint; P6 takes worst-of with its own probe
  }
})
```

**P7 — `runtime-smoke-readiness`** (skills: `orchestrator-init`) — runtime-smoke gate AFTER a
P6 GO. The readiness leg is deterministic; the live boot is substrate-gated (`bootSmoke:false` =
readiness only):

```
Workflow({
  scriptPath: '.claude/orchestrator/processes/runtime-smoke-readiness.mjs',
  args: {
    feature: "<cc-sdd slug, e.g. auth>",   // optional lens: which feature's §6 boot caps to check
    runtimeProbe: '.claude/orchestrator/lib/runtime-readiness.cjs',   // DEC-DEV-0120: readiness core
    envProbe: '.claude/orchestrator/lib/env-readiness.cjs',           // DEC-DEV-0092: shared readiness probe
    p6Verdict: 'GO',                        // optional: the prior P6 result (a non-GO smoke is informational, disclosed)
    bootSmoke: true                         // false = readiness leg only (no boot; the substrate-gated execution knob)
  }
})
```

### Run ledger (dispatcher wiring — VC-087 / VC-134)

You (the dispatcher) bracket the Workflow with the run-ledger so every run leaves a
durable, greppable record. **The Workflow body may never read the wall clock** (it
must resume deterministically) — so YOU stamp both timestamps from the environment
date and pass them in as ISO strings.

**Before launching the Workflow** — open the ledger and capture the run-id:

```
RUN_ID=$(node .claude/orchestrator/lib/run-ledger.cjs start \
  --process <process> --at "<ISO-now>" --args "<the raw $ARGUMENTS>")
```

This creates `.claude/orchestrator/runs/<RUN_ID>/run.json` (`status: running`) — a
crashed run still leaves that trace. Then launch the matching `Workflow({…})` above.

**After the Workflow returns** — stamp the ledger with the return value:

```
node .claude/orchestrator/lib/run-ledger.cjs finish \
  --run-id "$RUN_ID" --at "<ISO-now>" \
  --process-path .claude/orchestrator/processes/<process>.mjs \
  --result-file <path-to-the-Workflow-return-value-JSON>
```

`finish` records `finished_at` / `duration_ms` / the result summary + a `model_map`
(the per-stage `label → model`, extracted from the process source — a persona spawned
by `agentType:` is recorded `via-agent-definition`), and appends ONE compact line to
`.claude/orchestrator/runs/ledger.ndjson`. Write the Workflow return value (the object
the process returned) to a temp JSON file and pass it via `--result-file` (or `--result
'<inline-json>'` for a small one). Pass `--tokens '<json>'` opportunistically if the
harness surfaced usage. If a `start` never ran (a crash before it), `finish` still
lands the record as `status: finished-unstarted` — it never fails for a missing start.

The Workflow runs in the background; watch progress with `/workflows`. P3 returns
features-specced / blocked / cross-spec / coverage-incomplete / commit sha; P4 returns
audited / faithful / spec_fixed / product_routed / residual / **`coverage_gaps`** (design→tasks
structural gaps, DEC-DEV-0095) / impl_ready; P5 returns
implemented task ids / blocked / **`concerns`** (deferred-capability / mock-stand-in flags,
FB-013) / **`conflicts`** (cross-spec/design contradictions escalated at impl, DEC-DEV-0096 / T5) /
GO-gate result / **`readiness`**; P6 returns mechanical / **`readiness`** (READY |
DEGRADED | ENV_NOT_READY) / validators / confirmed_findings / **`already_resolved`**
(real-but-fixed-since-baseline, DEC-DEV-0093) / remediated / residual / **`conflicts`**
(escalated cross-spec/design contradictions, DEC-DEV-0096 / T5) /
**`result`** (GO | NO-GO | MANUAL_VERIFY_REQUIRED) / findings.

> **One orchestrator workflow per repo at a time (FB-004).** Two processes that both
> `git commit` race on the shared git index even when their file zones don't overlap
> (corrupt index / failed commit). Run P3 and P5 sequentially, not concurrently. **In-run
> single-writer (DEC-DEV-0096 / T5):** within a process, remediation and impl are strictly
> sequential — one commit at a time, never fanned out — so committers never race inside a run;
> a fix that finds the defect already resolved by a sibling commit does not double-commit.

> **Run records (FB-003 / VC-087 / VC-134).** `.claude/orchestrator/runs/` is now
> **auto-created by the run-ledger** (`start`/`finish` wiring above) — the "tracked
> follow-up" is closed. Each run gets a durable `runs/<RUN_ID>/run.json` (process,
> timestamps, `duration_ms`, `status`, result summary, per-stage `model_map`) and one
> compact line in `runs/ledger.ndjson` — the quantitative-observability layer (duration
> / model-mix / verdict) that behavioural observability (audit-journal, feedback-intake)
> lacked, and the trace-leg of the VC-133/134 production-substrate graduation gate. The
> harness transcript-dir (`/workflows`, `…/subagents/workflows/wf_*`) stays the **source
> of truth for per-agent detail** (prompts, transcripts, tokens); the ledger is the
> durable, greppable **summary** over it, not a replacement. A human/agent may still
> write feedback journals or checkpoints under `runs/` alongside it.

### Process Fabric (inter-process line coordination — DEC-DEV-0154)

The fabric (`.claude/orchestrator/lib/fabric-engine.cjs`; design SSOT `dev/process-fabric/CONCEPT.md`)
is the durable INTER-process statechart: it tracks a feature's whole production line
(P3 → P4 → P5/P6 → P7) across sessions and prescribes the next step. The engine never calls
an LLM and never launches anything itself — YOU (the dispatcher) are its actuator. Same
clock discipline as the ledger: every fabric call takes a dispatcher-stamped `--at "<ISO-now>"`.
Every prescription's disposition has been resolved through the autonomy-policy (F1+F2, DEC-DEV-0193)
— the floor (prod_deploy / destructive / spend_money / provision_real_secret) is not overridable;
`--autonomy L0|L1|L2|L3` on this command is forwarded to each fabric call as `--autonomy <level>`
(a per-invocation override; it can tighten to L0 or raise to L2/L3, never cross the floor). **L2/L3**
route the staging/prod cells to a `consilium-gate` disposition (an Epic D jury replaces the human up
to the floor) — see the consilium-gate prescription below; L0/L1 keep those cells human-gated.

**Starting a line (opt-in, `--fabric`)** — when the user asks for a fabric-tracked line,
BEFORE the first process of the line (usually P3):

```
node .claude/orchestrator/lib/fabric-engine.cjs init \
  --charter .claude/orchestrator/charters/feature-production-line.json \
  --subject <feature-slug> --at "<ISO-now>"
node .claude/orchestrator/lib/fabric-engine.cjs tick \
  --instance <instance-id> --event evt:line.start --at "<ISO-now>"
```

A REJECTED `evt:line.start` (guard `wip_ok` failed) is backpressure, not an error: the
orchestrator lane already has a live line (FB-004 — one orchestrator workflow per repo).
Do NOT force a second line; finish or abort the running one first (`status` shows it).

**After every `run-ledger finish`** — feed the SAME result file into the fabric:

1. `node .claude/orchestrator/lib/fabric-engine.cjs status` → is there a non-final instance
   whose `subject` matches this run's feature slug(s)? None → done (no line tracks this feature).
2. For each matching instance:

```
node .claude/orchestrator/lib/fabric-engine.cjs ingest \
  --instance <instance-id> --process <process> \
  --result-file <same-file-as-finish> --at "<ISO-now>" --run-id "$RUN_ID"
```

   Idempotent by `--run-id`: re-running a crashed bracket never double-ticks.
   **Bracket-guarded (DEF-OD7-2, DEC-DEV-0174):** `ingest` refuses a `--run-id` the run-ledger
   has never seen (and an ingest without one) — a result from a raw `Workflow(...)` launched
   outside the `start`/`finish` bracket does NOT enter the fabric. Cut the bracket first; the
   audited escape for a deliberate manual ingest is `--force-manual "PA-NNN: <reason>"` with a
   PA entry that already exists in `pending-actions.md`.
3. **Act on the printed prescription:**
   - `kind: run-process` + `disposition: auto` → run the prescribed process next, as its own
     full bracket (ledger `start` → `Workflow({…})` → ledger `finish` → fabric `ingest`),
     sequentially (FB-004) — this is the machine-driven continuation of the line;
   - `disposition: human-gate` / `kind: human-gate` → the gate is already in the prioritised
     owner-queue (`status` shows it); surface it to the user and STOP the line here — never
     run past a human gate. The engine has ALSO already projected the gate into the canonical
     `pending-actions.md` as a `PA-NNN` entry (carrying `fabric-instance` / `fabric-state` /
     `resume-event` markers) — point the owner at it via `/ecosystem:pending-actions`.
     **Capability gates (OD7, DEC-DEV-0171):** when the parked state is `awaiting_capability`
     (P7 boot-blocker) or `awaiting_capability_impl` (P5 §6 BLOCK), the ingest carried the
     capability-spec as the event payload — the PA entry embeds it verbatim (what to provision,
     `secret_env`, routes Integrator/Product), so the resolution side needs no re-forensics.
     Do NOT self-equip or mock the capability — provisioning is the Integrator's (access) or
     the owner's (provider choice, OD8) move.
   - `kind: none` + `final: true` → the line is complete; say so in the run summary.
4. `rejected` ticks (unknown event / guards failed) are deliberate no-ops — report the `why[]`,
   do not retry blindly and do not hand-edit `state.json` (events.ndjson is the source of truth).

**Consilium-gate prescription (L2/L3 — DEC-DEV-0193).** When a prescription's `disposition` is
`consilium-gate` (an L2/L3 line reached a staging/prod cell — the Epic D jury replaces the human on
the gate, up to the floor), fold a jury verdict into a disposition BEFORE acting:

1. **Convene the jury** with the existing consilium mechanism (`skills/orchestrator/architecture-consilium.md`,
   the P2 methodology) — subject = the prescribed process + the line's context; panel =
   `policy.consilium_gate.panel` or the built-in. No new machinery: the same heterogeneous jury P2 runs.
2. **Synthesise** the verdicts deterministically:
   `node .claude/orchestrator/lib/consilium-synth.cjs --verdicts-file <verdicts.json>` →
   `{ recommended, strength: strong|split|none, … }`.
3. **Fold** the verdict back into a disposition (code decides, not you):
   `node .claude/orchestrator/lib/autonomy-policy.cjs resolve-consilium --envelope-file <prescription.json>
   --synth-file <synth.json> [--threshold <τ from policy.consilium_gate.confidence_threshold>]`
   (default τ 0.8; confidence maps strength → strong 1.0 / split 0.5 / none 0.0).
4. **Act on the folded disposition:** `auto` (confidence ≥ τ on a recommended option) → continue the
   line with your FULL bracket (ledger `start` → `Workflow({…})` → ledger `finish` → fabric `ingest`),
   exactly as for an `auto` prescription; `human-gate` (safe-fallback — split / none / low confidence)
   → the prioritised owner-queue + STOP, exactly as for a human-gate prescription.

**The floor stays human, always** — a floor class never carries a consilium-gate. **Reversibility-first
(vision Epic F rail):** an L2/L3 auto MUST be reversible — feature-flags / staging-first / a safety-commit
(DEC-DEV-0061) — so a wrong auto-decision is recoverable. **Live grade is pilot-gated:** the jury runs,
but the L2/L3 consilium loop has not yet been dogfooded end-to-end.

**Resuming a parked line** — when the owner resolves the blocking item, tick the matching
event and follow the new prescription: `evt:pa.resolved` (a resolved Product/capability PA),
`evt:env.up` (substrate back up), `evt:owner.resume` / `evt:owner.abort` / `evt:owner.close`
(an escalated gate):

```
node .claude/orchestrator/lib/fabric-engine.cjs tick \
  --instance <instance-id> --event <evt:…> --at "<ISO-now>"
```

When the owner flips a fabric PA's **Status** to `done` in `pending-actions.md`, you can let the
engine resume the line for you instead of hand-picking the event: `node
.claude/orchestrator/lib/fabric-engine.cjs pa-scan --at "<ISO-now>" --tick` scans the PA journal,
matches each resolved fabric-PA back to its parked instance, and ticks the recorded `resume-event`
(the manual tick above stays a valid path). A `dismissed` PA is only *surfaced* — abort vs resume is
the owner's call — never auto-ticked.

**Owner-decision events are the owner's to initiate (ANOM-OD7-2 guard, DEC-DEV-0174).** A bare
manual tick of any `evt:owner.*` event is refused — the executor must not project an owner decision
it merely witnessed. The sanctioned path is the PA flip + `pa-scan --tick` above. For a decision the
PA flip cannot express (`evt:owner.abort` after a dismissal, `evt:owner.close` when the owner
split/deferred the remaining work and closes the line without runtime — terminal
`closed_without_runtime`), make sure the owner's decision is recorded in a PA entry, then tick with
`--force-manual "PA-NNN: <owner decision>"` (audit-stamped into the event). `evt:owner.close` is
handled from EVERY parked human gate (`awaiting_*`, `runtime_gate_retry`, `escalated` — charter v4,
DEC-DEV-0175): a parked line always has an owner exit that neither fakes a resolution nor
overloads `owner.abort`.

**OD7 mid-process resume is the normal bracket re-run — nothing special to restore.** After a
capability gate resolves (`awaiting_capability_impl` → `evt:pa.resolved` → `implementing`), the
new prescription re-invokes `feature-to-tdd-impl` as an ordinary full bracket. The process is
resume-safe by construction: its plan stage reads `tasks.md` checkbox state and filters tasks
already `done` — so the line CONTINUES from the blocked tasks (now unblocked by the granted
capability), it does not restart from scratch. Same for `awaiting_capability` → `runtime_gate`:
P7's readiness probe is cheap and re-assesses from zero. This closes the OD7
`request → await-fix → resume` loop end-to-end (SPEC OD7 — was a RUN 01 hypothesis).

`replay --instance <id>` rebuilds the state from `events.ndjson` and diffs it against
`state.json` (exit 2 on mismatch) — the recovery/audit tool after a crashed session.

## Autonomy & gates (SPEC §6/§7)

- **Reversible / dev-scoped** steps run autonomously.
- **The stack choice** is a human gate (above) — do not pick a stack silently.
- **Preflight C-07 fail** is not yours to fix: a clobbered handoff routes to Product
  (content) or Integrator (adapter), not a self-repair (RUN 01 boundary anti-pattern).
- **Capability gaps** (a tool/MCP/secret the process needs and lacks) → a capability
  request to the Integrator via `pending-actions.md`, not a self-equip (§6).

## After the run

- Surface the summary + the commit sha(s) to the user.
- **Disclose the test substrate at GO (FB-013, DEC-DEV-0081).** If a deliverable's acceptance
  / E2E ran against Mock or stub stand-ins for a *deferred* real seam (provider / API / secret
  / adapter), the GO summary MUST say so — e.g. "E2E ran on Mock providers; real adapters are
  unwired skeletons; real access deferred." A clean "feature complete / GO" over an unwired
  real seam is an over-claim. Surface every `concerns[]` item the run returned + its route
  (Integrator for access/tool/secret; Product for provider choice) — a green GO must not hide
  them. (S6/DEC-DEV-0081: the implementer flagged exactly this and the FSM used to drop it.)
- **P2 (`decide-architecture-foundation`):** the return is a **recommendation for the owner,
  not a decision.** `recommendation` = `{option_id, strength}`, `strength ∈ strong | split |
  none`: `strong` (the full 3-prior panel converged, no veto) → ratification is near-formal;
  `split` (the lenses diverge) → **surface `the_real_tradeoff`** — the owner weighs a real
  trade-off, not a rubber-stamp; `none` (every option vetoed by ≥1 lens) → no clean pick, the
  fork must be re-posed (see `vetoed`). The recommendation + the option×prior `matrix` + a
  **DRAFT** `dec_draft` are written into the fork's pending-action as a *proposal*
  (`**Resolution (proposed by P2 consilium)**`) — P2 does **not** flip the PA, edit any spec,
  or finalize the DEC (FB-LR-07); the owner ratifies → commits the DEC + edits the specs (or
  orders P3/P5 to implement the chosen option). Read `disclosures`: `panel_complete:false` = an
  architect died → the recommendation rests on a reduced panel (re-run before ratifying a close
  call); `decidable:false` = the fork was under-specified (<2 options), nothing was weighed.
  `applies_to` lists the specs the chosen option would change.
- **P3:** if `coverage_incomplete` is non-empty → those features miss source ids in their
  specs; recommend re-running the relevant `kiro-spec-*`. If blocked features exist →
  surface the route (Product / Integrator) per item. Live caveat: can a Workflow `agent()`
  invoke `kiro-spec-batch` (which self-dispatches)? If not, the Author phase falls back to
  running the kiro-spec-* pipeline per feature itself.
- **P4:** `impl_ready` lists features safe to route to P5. `spec_fixed` had spec-route drift
  repaired + re-audited clean. `product_routed` drift went to Product via `pending-actions.md`
  (OD8) — it is NOT auto-fixed; surface it. `residual` = spec drift unresolved after the
  re-audit rounds — those features are NOT impl-ready; surface for manual review before P5.
  **`coverage_gaps` (DEC-DEV-0095, T4 / FB-LR-05):** a design File-Structure file/module that NO
  task builds (e.g. a missing assembly module → an API that mounts nothing) — a blind spot of the
  fidelity/coverage/RA-10 oracles. A feature with a confirmed gap is **excluded from `impl_ready`**;
  the gap is routed `spec` (a spec-completion pending-action recommending the missing assembly/wiring
  task) and is **not auto-fixed** here (a missing task is for the spec author / a P3 re-run). Add the
  task, then re-run P4. (The T4-lite forward-ref check is partial — it flags vague "wired later"
  deferrals as candidates; it does not by itself prove the wiring task is absent.)
- **P5:** per-task commits land as the loop runs (selective staging). If `blocked` is
  non-empty → those tasks hit `_Blocked_`; an upstream-ownership block routes back to the
  owning spec (do not patch around it). **Block discretion (DEC-DEV-0096 / T5):** a BLOCK is
  classified before a debug round is spent — a *transient* hiccup (locked git index / flaky
  install / a momentarily-down substrate, FB-LR-08) gets a **bounded auto-retry** (re-probe env,
  retry, no debug round), so a flake no longer needs a manual re-drive. **`conflicts` (FB-LR-07):**
  a task that requires resolving a contradiction BETWEEN specs/requirements or a design
  self-contradiction is **ESCALATED, not self-resolved** — it is recorded with the upstream route
  (Product for a cross-spec/requirement contradiction or a provider/design choice; the owning
  spec's author for a design self-contradiction) and listed in `conflicts`; it also counts as
  `blocked`, so the feature gate runs advisory (never a clean GO). Surface each `conflicts[]` item
  for the owner — a remediation must never pick a side of a contradiction. If the GO-gate is
  `NO-GO` after 3 remediation
  rounds, or `MANUAL_VERIFY_REQUIRED` → surface the findings; the feature is not done. P5 also
  returns `readiness` (forwarded from its pre-flight probe + P6) — a `MANUAL_VERIFY_REQUIRED`
  with `readiness=ENV_NOT_READY` means the substrate was down, not that the code failed (re-run
  once it is up; DEC-DEV-0092 — see P6 below). If
  `concerns` is non-empty → a task met a real seam with a Mock/unwired skeleton because real
  access is deferred (FB-013); those are tracked in `pending-actions.md` and MUST be disclosed
  at GO (above) — a GO over them is GO-with-caveats. Live
  caveat: the lift reads kiro templates + invokes per-task kiro gates (`kiro-review` /
  `kiro-verify-completion`) from Workflow agents — confirm nested skill invocation works in
  the pilot; the templates embed the protocol as a fallback. The feature-level gate is now P6.
- **P6:** `result` is the feature verdict — `GO` only if the mechanical layer (full suite +
  build) is green AND no confirmed validator finding remains AND no upstream task was blocked.
  `confirmed_findings` are the ones that passed verify-finding-before-act — now **order-aware**
  (DEC-DEV-0093): each finding is classified against BOTH the current worktree AND a pre-gate
  baseline sha into `present` (real & unresolved → remediated), `already-resolved` (real at the
  baseline, fixed since the gate started — surfaced in `already_resolved`/`findings`, NOT
  re-fixed and NOT mislabelled a hallucination), or `refuted` (absent in both → dropped). This
  closes the TOCTOU where a confirmer reading an already-remediated tree called a REAL finding a
  "hallucination", or a racing commit masked an unresolved defect (FB-LR-03/13). An
  `already_resolved` item must still be **verified as a genuine fix, not a mask** (remediation
  is now single-writer — DEC-DEV-0096 / T5 — but a fix landed *before* the gate by another path
  still warrants the check). `residual` = `present` defects still
  unresolved after the remediation cap (3 rounds) → not a clean GO; surface them. A
  high-severity residual forces `NO-GO`, otherwise `MANUAL_VERIFY_REQUIRED`.
  **`conflicts` (DEC-DEV-0096 / T5, FB-LR-07):** if remediation hit a cross-spec/requirement
  contradiction or a design self-contradiction, it is **ESCALATED — surfaced as a CONCERN/upstream
  decision, never self-resolved**; a non-empty `conflicts` **degrades a would-be GO to
  `MANUAL_VERIFY_REQUIRED`** (the feature's correctness is undecided until the owner resolves it).
  A `conflicts` entry flagged `masked:true` means a remediation reported a *unilateral* resolution
  — verify it did not bury the conflict. Route each to Product (cross-spec / provider / design
  choice) or the owning spec's author (design self-contradiction). **Read `readiness` alongside `result`
  (DEC-DEV-0092):** `result` answers "is the code good?", `readiness` answers "did the gate get
  to judge?". `ENV_NOT_READY` (substrate down — Docker/DB/Redis off, or a RED suite whose
  failures are *all* substrate errors per the allowlist) is reported as
  `MANUAL_VERIFY_REQUIRED`, **never** `NO-GO` — bring the substrate up and re-run; do not read
  it as "the code failed" (the run-B false-NO-GO this contract fixes). `DEGRADED` (upstream
  blocked tasks) is likewise advisory; only `READY`/`DEGRADED` can pair with a `GO`.
  `concerns` forwarded from P5 are disclosed in
  `findings` (FB-013) — a GO over a mock-only / unwired real seam is GO-with-caveats. Live
  caveat: P5 reaches P6 via `workflow()` (one-level nesting); if unavailable P5 falls back to
  the inline `kiro-validate-impl` lift.
- **P7 (DEC-DEV-0120):** `verdict` is the readiness gate — `READY_TO_SMOKE` (boot attemptable),
  `BLOCKED_ON_CAPABILITY` (a boot-required external capability is `BLOCK` — a §6 request was emitted
  to `pending-actions.md`, route Integrator/Product, OD7 await; **the boot was NOT run** and nothing
  was mocked), `ENV_NOT_READY` (substrate down — transient, bring it up and re-run), or
  `NOT_STARTABLE` (no run target declared — route Product). `p7_result` adds the live outcome when a
  boot ran: `STARTS` / `FAILS_TO_START` (with a `failure_class`, e.g. env-not-loaded 500) /
  `INCONCLUSIVE`, or `READY_NOT_RUN` when `bootSmoke:false`. **`disclosures` ride with the result and
  must be surfaced** — a green boot over a dev stand-in (mock-only), a non-GO P6, or a `DEGRADED` env
  is "indicative, not proof" (the RUN 01 lesson: 223 tests green ≠ app starts; a green boot on mocks
  ≠ prod-ready). P7 is **capture-don't-fix**: a failed start is surfaced for a P5/P6 re-run, never
  auto-remediated. The live boot is **substrate-gated** (needs a pilot dev env); the full Epic E
  deploy/rollback chain awaits Integrator D3-runtime tooling.
