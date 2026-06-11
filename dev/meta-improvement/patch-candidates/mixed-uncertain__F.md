---
schema: patch-candidate/v1
zone: mixed-uncertain
check_id: F
verdict: refuted
instances: 8
sessions: 5
severity: warning
confidence: high
patch_type: none
risk: low
finding_ids: [1f983743ff78, 9b29da98a4c4, 449a0d0901d9, 74ae51a9c084, 9abc5726638b, d6690b1d59a9, f408601e0053, 9c4f02f03cdf]
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — mixed-uncertain / F

## Verdict (adversarial verification)

**Majority verdict: REFUTED (3/3 lenses independently refute a single systemic problem).**

The grouping key here is the worst-case for a real cluster: `zone=mixed-uncertain` is the **explicit
classifier fallback** — `rubrics/mixed-uncertain.md:14` («явный fallback… классификатор не выделил ни
одной зоны с достаточным сигналом») and `:18` («Приоритетные критерии: A–F (ничего не скипаем, раз
зона неясна)»). So `check_id F` is a **generic catch-all criterion** applied because no PMO zone could
be determined, not a coherent root-cause signal. All 5 sessions are **pre-Incr.3a Phase-4 smoke runs**
in the `my-first-test` consumer project (`mode: full, phase: 4, smoke_plan_path` set in every report),
whose findings were bucketed by the OLD smoke auditor's `check_id F` = «Process catalog / skill
discipline» grab-bag — exactly the de-conflation hazard DEC-DEV-0057 Lesson #1 warns about.

### Lens 1 — Reality (genuine violation vs auditor artefact) → REFUTES

I opened every cited audit report. The cluster is a **mix**, and the majority are not problems:

- **`9abc5726638b` — NOT a problem (positive).** Report `5345f116…md:170`: «Check F (skill discipline)
  — **proper** cleanup-detector load… Recommended action: **keep as baseline pattern**.» This is praise
  for correct behaviour mis-shelved as a «finding».
- **`d6690b1d59a9` — NOT a problem (positive).** Report `0c10a7c0…md:55` («F skill discipline OK») and
  the only F finding there is `:41` «cleanup-detector.md skill loaded **as expected**». Positive again.
- **`74ae51a9c084` — NOT a behavioural violation; a smoke-test coverage gap.** Report
  `90413790…md:208-211`: S3 acceptance expected `--scope FM-*`/`--tier blocking` to be *exercised*; the
  session only ran `--deep`/`--rule`. Recommended action `:211` is «next runtime smoke должен exercise
  full filter matrix» — a test-plan task, not an AI defect.
- **`f408601e0053` — correct outcome, soft process nit.** Report `90413790…md:216`: NOTE→NFR promotion
  «Frontmatter mutation корректна… **все anti-patterns avoided**»; only the `note-promote.md` skill
  wasn't explicitly Read first. Outcome was right.
- **`9c4f02f03cdf` — auditor-self-marked uncertain/low.** Report `5345f116…md:172-174`: «Conservative
  reading: borderline violation. **Liberal reading: allowed manual cleanup.** Confidence: **Low** —
  требуется skill text clarification before promoting к Warning.» The source hedged.
- Only **`1f983743ff78`, `9b29da98a4c4`, `449a0d0901d9`** are genuine violations (verified below).

Reality lens: the cluster-as-problem is largely an artefact — 2 positives + 1 test-gap + 1 correct-
outcome nit + 1 auditor-hedged item, with 3 genuine violations of unrelated kinds. **Refutes** the
notion that this `(zone,check)` is a real recurring problem.

### Lens 2 — Systemic (one root cause vs coincidence) → REFUTES (decisive)

The genuine instances have **distinct, unrelated root causes across 5 different mechanisms**:

- `1f983743ff78` → `/product:cleanup --pending-hygiene` wiped a *fresh* da-pending entry —
  **`cleanup-detector.md` anti-pattern #2** (report `98cb1b97…md:193-199`, timeline action 28).
- `9b29da98a4c4` → DA spawned via `subagent_type=general-purpose` — **`product-da-review.md`
  anti-pattern #5**; report `9da2652a…md:171` attributes the likely root cause to a **deployment gap**
  («subagent_type не registered в этом проекте `.claude/`… verify `/ecosystem:update` copies
  devils-advocate.md»), i.e. NOT skill drift.
- `449a0d0901d9` → custom 700-line Node validator instead of inline flow — **`validation-runner.md`
  methodology**; report `90413790…md:206` notes this may be *legitimate* («признать что… inline-flow
  непрактично… Phase 4.5 candidate») — an open design question, not a clear defect.
- `f408601e0053` → **`note-promote.md`** not loaded; `9c4f02f03cdf` → **`cleanup-detector.md` Ask
  framing** (a different sub-aspect of AP#2 than `1f983743ff78`).

That is **five different skills/anti-patterns / one deployment issue** — no single root cause is shared
by ≥3 distinct findings across multiple sessions. The two cleanup-detector items (`1f983743ff78`,
`9c4f02f03cdf`) are only 2 instances, one of which is uncertain/low. The loose meta-theme «AI deviates
from a prescribed skill mechanism» (`9b29…`, `449a…`, `f408…`) spans only **2 sessions**, mixes a
deployment cause with two methodology causes, and is **contradicted by the two positives** (`9abc…`,
`d6690…`) showing the discipline *was* honoured. A single mechanism cannot remove five heterogeneous
causes — this fails mechanism-ratio (CONVENTIONS §3). Systemic: **NO.**

### Lens 3 — Already-handled (existing mechanism covers it) → REFUTES for the genuine spine

The two highest-severity genuine items are **already codified into the skill**:
`skills/product/cleanup-detector.md` anti-pattern #2 (`:259-275`) now lists **both** these exact
sessions as precedent — `:275`: «Precedent: anti-pattern #2 violation в Phase 4 smoke зарегистрирована
дважды — `5345f116` (user-authorized purge через misleading `Recommended` framing) и `98cb1b97`
(silent Write `entries: []` для session-fresh entry, blocking P-RULE-02) — обе как 🔴 FAIL.» The skill
also added the **session-window guard** (`:108` «Skip entries с `queued_at >= session_start_timestamp`»)
that directly prevents `1f983743ff78`. So `1f983743ff78` and `9c4f02f03cdf` are **already handled** —
patching again would be redundant. `9b29da98a4c4`'s likely cause is a bootstrap/registration gap to be
checked at deployment, not a D7 pattern. Already-handled: **confirmed for the spine.**

**Majority across all three lenses → REFUTED.** This is a heterogeneous `mixed-uncertain/F`
fallback-bucket, not a systemic cluster.

## Problem (if survived)

N/A — refuted. No single systemic gap produces these findings; they are coincidentally co-bucketed
under the classifier-fallback zone + generic check F.

## Evidence

Genuine violations (distinct root causes — do **not** fold into one patch):

- `1f983743ff78` — warning/high — `.product/.pending/da-pending.yaml` — cleanup wiped fresh DA-pending
  entry (AP#2) — session `98cb1b97` — **already codified** in cleanup-detector.md AP#2 + session-window
  guard. → dismiss (already-handled).
- `9b29da98a4c4` — warning/high — Agent invocation — `general-purpose` vs `product-devils-advocate`
  (AP#5) — session `9da2652a` — likely deployment/registration root cause; single instance. → dismiss
  here; revisit as its own candidate only if it recurs in a properly-classified zone (D6 / D2B).
- `449a0d0901d9` — info/high — `validation-runner.md` — custom validator vs inline flow — session
  `90413790` — open design question (Phase 4.5 runtime candidate), not a clear defect. → roadmap, not a
  D7 patch.

Non-problems / non-systemic (dismiss):

- `9abc5726638b` (info/high, `5345f116`) — **positive** («proper discipline, keep as baseline»).
- `d6690b1d59a9` (info/high, `0c10a7c0`) — **positive** («skill loaded as expected»).
- `74ae51a9c084` (info/medium, `90413790`) — smoke-test coverage gap, not behaviour.
- `f408601e0053` (info/medium, `90413790`) — correct outcome; soft note-promote-load nit.
- `9c4f02f03cdf` (uncertain/low, `5345f116`) — auditor-hedged; already covered by cleanup-detector AP#2.

Distinct sessions: `98cb1b97`, `9da2652a`, `90413790`, `5345f116`, `0c10a7c0` (5).

## Proposed patch (if survived)

None — verdict refuted.

## Human gate — [Y / N / E / D]

- **[Y] accept** → n/a (no patch proposed).
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → if you disagree with the de-conflation, the only defensible single-finding follow-ups
  are: (a) `9b29da98a4c4` as a standalone **deployment-verification** item (does `/ecosystem:update`
  register `product-devils-advocate` in target `.claude/agents/product/`?), and (b) `449a0d0901d9` as a
  **roadmap** decision on `/product:validate` runtime vs inline-flow. Neither belongs in a
  `mixed-uncertain/F` cluster patch.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.

**Recommended:** journal status → **dismissed** for all 8 findings (2 positives, 1 test-gap, 1 correct-
outcome nit, 1 auditor-hedged, + 2 already-codified in cleanup-detector.md AP#2; the lone genuinely-open
item `9b29da98a4c4` is a single-instance deployment issue, not systemic here).
