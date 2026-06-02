---
schema: patch-candidate/v1
zone: D2B-behavioral
check_id: C
verdict: survived
instances: 9
sessions: 7
severity: blocking
confidence: high
patch_type: patch-template
risk: low
finding_ids: [1ff552c0c6b4, 55e019642cc7, de9d27ea6afb, 3331299ce15f, 685265ce3985, 94dc1b5a4ff9, b2e3035c3fdd, 2fffc308fb96, 335c0ad6d370]
gate: pending          # human sets: accepted | rejected | edited | deferred  ([Y/N/E/D])
---

# Patch candidate — D2B-behavioral / C

## Verdict (adversarial verification)

**Majority verdict: SURVIVED (3/3 lenses for the genuine spine).** The cluster as
deterministically grouped by `(zone=D2B-behavioral, check=C)` is **heterogeneous** — it conflates
≥3 distinct root causes. Only **3 of 9** distinct findings form a real, recurring, same-root-cause
spine; the patch targets that spine. The other 6 are dispositioned separately below (Evidence).

### Lens 1 — Reality (genuine violation vs auditor misread)

Opened the cited transcripts/audit reports — the spine is verbatim-confirmed, the periphery is not:

- **REAL (spine):** `e1615a0c` audit, Finding C (`audit-reports/e1615a0c-…md:205-209`): two Agent calls
  (transcript L163-164) both `"subagent_type":"general-purpose"` with hand-rolled DA briefs
  («DA Reviewer A/B»). `0781ad12` audit, Finding C (`…0781ad12-…md:176-180`): Agent L135
  `subagent_type: general-purpose`, «Batched DA на 13 BRs FM-005», prompt merely *points* the generic
  agent at `agents/product/devils-advocate.md` and asks it to «принять роль». The auditors' own
  mitigating note is correct — the adversarial *content* was produced — but the **defect is the
  subagent type**: `general-purpose` loses the registered agent's `model: claude-opus-4-8` pin, its
  `tools:` restriction, the isolated Builder/Critic separation, and the canonical `.da-findings/`
  schema guarantee (`agents/product/devils-advocate.md:1-6, 607-617`). Genuine violation.
- **DISCARDED (auditor self-marked non-violation):** `2fffc308fb96` (info, «no fresh DA spawn —
  anti-circular by design») and `335c0ad6d370` (info, «P-RULE-02 intent satisfied; post-edit not
  re-reviewed»). The auditor graded these `info` precisely because they are *correct* behaviour
  (re-DAing edits derived from DA findings would be circular). Not defects.
- **DISCARDED (cosmetic carve-out):** `94dc1b5a4ff9` (medium, «48 active BR русифицированы без
  P-RULE-02 DA»). Russification = doc-only translation. The rubric's own mode-interaction clause
  exempts it: `rubrics/D2B-behavioral.md:32` — «при mode=fix/maintenance косметические правки BR/IC …
  НЕ требуют Devil's Advocate (P-RULE применяется к семантическим изменениям)».
- **SEPARATE ROOT CAUSE (not this patch):** `1ff552c0c6b4` (DA *skipped entirely* — da-pending entry
  wiped) traces to the hook's dedup-replace (`hooks/product/br-change-trigger.js:121-123`, latest diff
  wins), not to wrong subagent_type. `b2e3035c3fdd` + `685265ce3985` (re-DA on DA-resolution edits /
  DA-remediation BR) are an **open owner-call** the audits themselves raise
  (`…0781ad12-…md:228, 250`) — distinct policy question, distinct fix.

### Lens 2 — Systemic (same root cause vs coincidence)

The 3 spine instances are the **same root cause across 3 sessions / 2 dates**: `e1615a0c`
(2026-05-20), `e3bfd3a3` + `0781ad12` (2026-05-26). `de9d27ea6afb`'s own snippet says «S8 P1
regression **повторился**». Two independent audit reports converge — unprompted — on the identical
remediation: «the feature-session **F.3** step must spawn `subagent_type: product-devils-advocate`»
(`…e1615a0c-…md:209, 238`) and «refactor `/product:feature` skill **F.3** batched-DA step чтобы
explicit отправлял canonical subagent_type» (`…0781ad12-…md:180, 247`). Convergent independent
root-cause attribution ⇒ systemic, not coincidence.

### Lens 3 — Already-handled (existing mechanism makes fix redundant?)

Checked every candidate mechanism — the recurring path is **not** covered:

- `skills/product/product-da-review.md:234` anti-pattern #5 *does* pin
  `subagent_type: product-devils-advocate` — but only for the **manual FM/RL** path, which
  **explicitly refuses BR-\*** (`commands/product/da-review.md:23`; `product-da-review.md:21`). It
  does not reach F.3 batched-BR DA.
- `skills/product/feature-session.md:599` anti-pattern #8 pins **Mode** (`adaptive` vs `full`), **not
  subagent_type**. The «DA orchestration flow» section (`feature-session.md:345-389`) describes
  DA **per single BR** via hook stderr and shows a brief **without** an explicit
  `Agent({subagent_type: "product-devils-advocate"})` snippet. **No batched/cluster-BR path exists at
  all** — so when a session authors 9–13 BRs at once, there is no first-class canonical invocation to
  copy, and operators hand-roll `general-purpose`.
- No hook/validation observes the Agent `subagent_type` post-hoc. Detection here is the **audit
  itself** (post-mortem) — and recurrence on 2026-05-26 *after* the 2026-05-20 flag proves surfacing
  alone did not prevent it.

Residual uncertainty (stated honestly): the audits reference `dev/PHASE_5_READINESS.md Section B`
re-smoke candidates — a *tracking* item may exist, but no applied fix to the F.3 template was found.

## Problem (survived)

`skills/product/feature-session.md` specifies P-RULE-02 DA as **per-single-BR**, adaptive, spawned by
the orchestrator off the hook stderr signal. In practice F.3 produces a **cluster** of BRs (9, 13…)
and sessions run **one batched DA** over the cluster. The skill provides **no canonical batched-BR DA
template and no `subagent_type` pin** for this path (anti-pattern #8 pins Mode only; the manual
`/product:da-review` path that *does* pin the type refuses BR-\*). With no first-class canonical
invocation to copy, operators reach for `Agent({subagent_type: "general-purpose"})` pointed at the DA
spec — recurring as the «S8 P1 regression». The fix is to give F.3 an explicit, copy-pasteable
canonical invocation and an anti-pattern that forbids the `general-purpose` substitution.

## Evidence

Spine (patch targets these — recommend journal status → **patched** on accept):

- `55e019642cc7` — blocking/high — `BR-054..BR-062` batched DA — session `e3bfd3a3` (2026-05-26) —
  DA via `general-purpose`, not canonical.
- `de9d27ea6afb` — blocking/high — Agent L135 batched DA 13 BRs FM-005 — session `0781ad12`
  (2026-05-26) — «S8 P1 regression повторился».
- `3331299ce15f` — warning/high — `BR-054..BR-062` (9 files) — session `e1615a0c` (2026-05-20) —
  cluster DA via `general-purpose`.

Periphery (NOT covered by this patch — disposition separately):

- `2fffc308fb96` (info), `335c0ad6d370` (info) — auditor-marked **non-violations** (anti-circular /
  intent satisfied) → recommend journal status **dismissed**.
- `94dc1b5a4ff9` (medium) — russification = cosmetic/maintenance per `rubrics/D2B-behavioral.md:32`
  → recommend journal status **dismissed** (verify edits were translation-only).
- `1ff552c0c6b4` (blocking) — DA **skipped entirely** (da-pending wiped); distinct root cause in
  `br-change-trigger.js` dedup → **separate finding/patch**.
- `b2e3035c3fdd`, `685265ce3985` (warning) — re-DA on DA-resolution / DA-remediation edits; **open
  owner-call** raised by the audits → **separate DEC-DEV**, do not fold in here.

## Proposed patch (survived)

- **Type:** patch-template
- **Target files:**
  - `skills/product/feature-session.md` — **primary**. (a) In «DA orchestration flow»
    (`:345-389`) add an explicit batched/cluster-BR branch with a copy-pasteable
    `Agent({ subagent_type: "product-devils-advocate", … })` snippet (Mode: adaptive). (b) Add
    anti-pattern #9: «DA subagent **MUST** be `subagent_type: product-devils-advocate` — **never**
    `general-purpose`, even with a DA-role prompt; `general-purpose` loses the model/tools pin,
    isolated Builder/Critic separation, and canonical `.da-findings/` schema.» Mirror the wording of
    `product-da-review.md` anti-pattern #5 into the hook-driven path.
  - `commands/product/feature.md` — (optional) one-line cross-reference to the pinned subagent_type so
    the command surface stays consistent.
- **Change:** described only — pin the canonical `subagent_type` for the F.3 batched-BR path + forbid
  the `general-purpose` substitution. **Not applied.** No hook/spec/artifact edits.
- **Risk:** **low.** Doc/template-only change to one orchestration skill; no behaviour change to hooks,
  validation, or artifacts. The one open design question — *is batched DA sanctioned, or must F.3 stay
  strictly per-BR?* — is surfaced, not resolved (leave to the owner). A hard enforcement **hook** is
  **not** recommended over the template fix: PostToolUse cannot reliably observe an Agent call's
  `subagent_type`, and such a hook would have to live in the Product Module deployed to user projects
  (CONVENTIONS §2/§9) — higher risk, weaker justification than the smallest mechanism (CONVENTIONS §3).
- **Confidence / estimate:** confidence **high** (root cause independently confirmed by two converging
  audit reports + smoke-plan S8 naming it a known P1 regression). Estimate **~30–45 min** (edit F.3 +
  DA-orchestration § + anti-pattern list; optional cross-ref in `feature.md`).

## Human gate — [Y / N / E / D]

- **[Y] accept** → draft DEC-DEV entry + (optional) branch/PR; set `gate: accepted`, journal status of
  the 3 spine findings → patched. Disposition periphery per Evidence (dismiss `2fffc308`/`335c0ad6`/
  `94dc1b5a`; open separate items for `1ff552c0` and the `b2e3035c`/`685265ce` owner-call).
- **[N] reject** → set `gate: rejected`; journal status → dismissed + reason (suppress window).
- **[E] edit** → adjust scope (e.g., fold the owner-call in, or also touch `feature.md`), then accept.
- **[D] defer** → set `gate: deferred`; revisit on next synth run.
