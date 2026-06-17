---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: C
verdict: refuted
instances: 12
sessions: 9
severity: blocking
confidence: high
patch_type: none
risk: low
finding_ids: [1ff552c0c6b4, 55e019642cc7, de9d27ea6afb, fa71e9215bf1, 3331299ce15f, 685265ce3985, 8fc985c97d5f, 94dc1b5a4ff9, b2e3035c3fdd, 2fffc308fb96, 335c0ad6d370, d14d82cd6341]
gate: rejected         # [N] 2026-06-17: dismissed per synthesizer rec (refuted — see Verdict); per-finding re-routes in Evidence
prior_decision: DEC-DEV-0064 (archived candidate dev/_archive/meta-improvement/patch-decisions/D2B-behavioral__C.md, gate accepted 2026-06-12)
---

# Patch candidate — D2B-behavioral / C

## Verdict (adversarial verification)

**Majority verdict: REFUTED (already-handled).** This is a **re-run on a cluster whose genuine
systemic spine was already adversarially verified, accepted, and patched** — DEC-DEV-0064 (2026-06-12),
template fix in `skills/product/feature-session.md` + codified pattern
`dev/meta-improvement/patterns/da-subagent-type-contract.md`. The cluster grew by 3 findings from two
2026-06-16-audited pilot sessions (`ebf3cc2c`, `a64afb94`), but none introduces a *new* systemic gap
that survives the already-handled lens. Two of three lenses say the spine is real & recurring, but the
**already-handled lens vetoes** (the rule requires real AND systemic AND not-already-handled — the last
fails). No new prompt-level mechanism exists to add.

### Lens 1 — Reality (genuine violation vs auditor misread)

Mixed, exactly as in the prior decision. Opened the new cited reports:

- **REAL (spine recurrence):** `fa71e9215bf1` (blocking) — `audit-reports/ebf3cc2c-…md:115-123` quotes the
  transcript verbatim: `[209] TOOL Agent: subagent=general-purpose :: Batch DA review BR-086..090`. A
  genuine violation of the canonical-subagent contract. (Its zone-B sibling `IC-033..036` at record 289
  is the same defect, audited under check B, not in this cluster.)
- **REAL but DISTINCT root cause:** `8fc985c97d5f` (warning/**medium**) — `…ebf3cc2c-…md:136-139`: the
  *orchestrator* self-classified BR-080/081/082 pivot edits as "cosmetic" and **purged** their
  `da-pending` entries (record 269) instead of letting the subagent make the cosmetic/significant call
  (DEC-DEV-0012). This is the "cosmetic self-classification bypass" mechanism — **not** wrong
  `subagent_type`. The auditor graded it medium and noted the BR-082 banner is borderline-semantic.
- **NON-violation (confirmed):** `d14d82cd6341` (info) — `…a64afb94-…md:148-168` self-marks "OK per
  §6.5". I verified `docs/pmo/processes.md:817-820` — §6.5 Reception workflow «Act on: modify related
  artifact» exists; re-DAing a change that *implements* a DA finding would be circular. Not a defect.
  (Same disposition the prior decision already gave `2fffc308fb96` and `335c0ad6d370`.)

### Lens 2 — Systemic (same root cause vs coincidence)

The spine **is** recurring (`de9d27ea6afb`'s own snippet: «S8 P1 regression повторился»; `fa71e9215bf1`
on 2026-06-16 repeats it again). So the defect-class is systemic — which is **why a patch already
exists**. Recurrence here does **not** indicate a *new* gap: the new instance occurred in the
`my-first-test` **pilot** (worktree `silly-hatching-swing`), whose `.claude/` is a stale bootstrap
pending the pilot-reconciliation (DEC-DEV-0065 / PR #29). The mechanism is the pilot harness answering
«Agent type 'product-devils-advocate' not found» → fallback — i.e. the **agent-registration root
cause**, which the codified pattern explicitly carves out as a separate **live-harness** task
(DEC-DEV-0043 R4), *not* a prompt-level patch. `8fc985c97d5f` is a *different* root cause and currently
**1 genuine medium instance** (the related `94dc1b5a4ff9` is a dismissed russification carve-out;
`1ff552c0c6b4` is the hook dedup-replace, a third mechanism) — below the ≥3-same-root-cause systemic bar.

### Lens 3 — Already-handled (DECISIVE — existing mechanism makes a new fix redundant)

Verified the deployed enforcement against the live repo — the spine path **is covered**:

- `skills/product/feature-session.md:352-371` — the «DA orchestration flow» now contains the explicit,
  copy-pasteable `Agent({ subagent_type: "product-devils-advocate", … })` snippet, the batched-cluster
  note («list the WHOLE cluster in ONE Agent call — still subagent_type: product-devils-advocate»), AND
  the STOP-on-«not found» instruction. The exact gap the prior synth identified (no canonical batched
  invocation to copy) is closed.
- `skills/product/feature-session.md:611` anti-pattern #9 forbids `general-purpose` (incl. **batched**
  F.3, «per DEC-DEV-0064»); `:612` anti-pattern #10 classifies the silent fallback as a **BLOCKING
  setup error** and names the registration root-cause as a **separate live-harness step (DEC-DEV-0043
  R4)**. The `ebf3cc2c` auditor itself *quotes these very lines* (`…ebf3cc2c-…md:119-132`) as the basis
  for the flag — proving the contract is deployed; the pilot simply hit the unregistered-agent path.
- `dev/meta-improvement/patterns/da-subagent-type-contract.md:3,33,42-43` — pattern is **provisional**,
  states the registration fix is out-of-prompt-scope, and **already rejected** a hard enforcement hook
  («PostToolUse cannot reliably observe an Agent call's `subagent_type` … higher-risk/weaker-
  justification than the template fix», CONVENTIONS §3).

No new prompt-level mechanism is available. Re-issuing a template patch would be redundant; proposing the
agent-registration edit from prompt scope is precisely the plausible-but-wrong move clause 3 +
DEC-DEV-0057 Lesson #1 warn against. **Already-handled → refuted.**

## Problem (if survived)

N/A — refuted. The systemic spine is already patched (DEC-DEV-0064 template fix + provisional pattern).
The genuine residual is the **agent-registration root cause** tracked as live-harness item DEC-DEV-0043
R4 — by design *not* fixable from this prompt-level synthesizer.

## Evidence

Spine — already patched (no action; tracked elsewhere):

- `fa71e9215bf1` — blocking/high — `BR-086..BR-090` — session `ebf3cc2c` (audited 2026-06-16) — batch DA
  via `general-purpose`. **Recurrence of the DEC-DEV-0064 spine in the stale pilot bootstrap; root cause
  = R4 agent registration.** Recommend journal status → **dismissed** with reason «covered by
  DEC-DEV-0064 template fix; residual is DEC-DEV-0043 R4 live-harness registration, not a prompt patch».
- `55e019642cc7`, `de9d27ea6afb`, `3331299ce15f` — the original spine — already **patched** under
  DEC-DEV-0064 (journal status should already reflect this).

Distinct root cause — route separately (do NOT fold into this spine):

- `8fc985c97d5f` — warning/medium — `BR-080/081/082` — session `ebf3cc2c` — orchestrator self-classified
  pivot edits as cosmetic and purged `da-pending`, bypassing the subagent's own cosmetic/significant
  call (DEC-DEV-0012). **1 genuine instance; below systemic bar.** Recommend: leave **open** as a
  standalone finding — if «orchestrator self-purge of active-BR da-pending» recurs ≥3× it earns its own
  cluster/patch (likely target: an anti-pattern in `feature-session.md` that the cosmetic call belongs
  to the subagent, or a guard in `br-change-trigger.js`). Not this cluster's spine.
- `1ff552c0c6b4` — blocking — DA **skipped entirely** (da-pending entry wiped via the hook dedup-replace,
  `hooks/product/br-change-trigger.js:121-123`). Distinct root cause; the prior decision already routed
  it to a **separate finding/patch**. Unchanged.
- `b2e3035c3fdd`, `685265ce3985` — warning — re-DA on DA-resolution / DA-remediation edits. Prior
  decision flagged these as an **open owner-call**; `d14d82cd6341` shows that question was **resolved**
  in the affirmative (no re-DA needed) per `processes.md` §6.5 — so these trend toward **dismissed**.

Non-violations — dismiss:

- `d14d82cd6341` (info) — «OK per §6.5», verified `processes.md:817-820`. → **dismissed**.
- `2fffc308fb96`, `335c0ad6d370` (info) — auditor-marked non-violations (anti-circular / intent
  satisfied). → **dismissed** (as in the prior decision).
- `94dc1b5a4ff9` (medium) — russification = cosmetic/maintenance per `rubrics/D2B-behavioral.md:32`. →
  **dismissed**.

## Proposed patch (if survived)

None — `patch_type: none`. The smallest correct mechanism (template fix forbidding the `general-purpose`
substitution + canonical batched snippet) is **already deployed** (DEC-DEV-0064). The only remaining
work is the agent-registration root cause, which is an out-of-scope **live-harness** task (DEC-DEV-0043
R4) — proposing a registration edit from here is the exact plausible-but-wrong patch DEC-DEV-0057
Lesson #1 warns against.

## Human gate — [Y / N / E / D]

- **[Y] accept** → not applicable (no patch to apply). If you instead want to **escalate** the recurring
  pilot fallback, the correct action is to close **DEC-DEV-0043 R4** (register `product-devils-advocate`
  in the pilot's `.claude/agents/` via pilot-reconciliation DEC-DEV-0065 / PR #29) and then promote
  `da-subagent-type-contract.md` from *provisional* → *validated* — handled outside this synthesizer.
- **[N] reject** → set `gate: rejected`; journal status of `fa71e9215bf1` → **dismissed** (reason:
  already covered by DEC-DEV-0064; residual = R4 live-harness). Dismiss the non-violations
  (`d14d82cd6341`, `2fffc308fb96`, `335c0ad6d370`, `94dc1b5a4ff9`). Keep `8fc985c97d5f` and
  `1ff552c0c6b4` **open** on their own (distinct root causes).
- **[E] edit** → if you judge `8fc985c97d5f` (orchestrator cosmetic self-purge) already systemic, re-scope
  this candidate to *that* root cause (new spine, new target) rather than the registration one.
- **[D] defer** → set `gate: deferred`; revisit when R4 closes or `8fc985c97d5f` recurs.
