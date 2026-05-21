---
phase: 4
aggregated_at: 2026-05-20T11:32:23.353Z
sessions_count: 9
status: fail
coverage_summary:
  total_scenarios: 13
  covered: 3
  partial: 6
  fail: 2
  not_covered: 4
  uncertain: 0
findings_count:
  blocking: 1
  warning: 11
  info: 8
  uncertain: 2
sessions:
  - bbb68ac9-0d05-43c4-9566-87891e44a6cf
  - e1615a0c-149d-446f-9111-7ca8d49d46ab
  - bf7eaea4-d53f-4b0d-b736-fd78a6193f8b
  - 98cb1b97-d338-435b-b152-182d4aec90d3
  - 5345f116-93ff-455f-92f4-77410fd3a37d
  - 5ba3ee30-592c-4e45-9ef6-08aa22e0ef55
  - fbb32599-4066-435b-a92d-54374b683596
  - 9da2652a-7d70-452a-9e74-fe6cbfcc4b3d
  - 8f10e02f-816c-4b56-a364-cdc925d00f6f
---

# Phase 4 smoke audit summary

## Overview

Nine sessions in the `my-first-test` pilot were audited against the 13 runtime scenarios of `PHASE_4_SMOKE_TEST_PLAN.md`. The plan envisioned a single guided session; in practice the smoke was spread across 9 partial sessions (2 of which were pure setup/meta and triggered nothing). Aggregate verdict is **fail**: 2 scenarios FAIL (S1, S12), 1 blocking finding, and only 3 of 13 scenarios reached COVERED — well short of the plan's «≥10/13 PASS, 0 blockers» closure bar. The single most important takeaway: the canonical `product-devils-advocate` subagent type **is not registerable in the Claude Code harness**, forcing a `general-purpose` fallback in every DA-bearing session — the exact «P1 regression» the plan was written to catch — and the critical scenario S12 (verifying the DEC-DEV-0036 cleanup-detector fixes) failed in **both** sessions that exercised it.

## Coverage matrix

| Scenario | Title | Best verdict | Sessions hit | Conflict? |
|---|---|---|---|---|
| S1 | HYP frontmatter canonical | 🔴 FAIL | e1615a0c | — |
| S2 | Language discipline | ✅ COVERED | e1615a0c, bf7eaea4, fbb32599, 9da2652a | yes — see «Conflicts» |
| S3 | Full validation | 🟡 PARTIAL | e1615a0c | — |
| S4 | NFR review (Ask + Define) | ✅ COVERED | e1615a0c | — |
| S5 | Handoff draft | ✅ COVERED | fbb32599, 9da2652a | yes — see «Conflicts» |
| S6 | Handoff production | 🟡 PARTIAL | fbb32599 | — |
| S7 | Cross-platform hash | ⚪ NOT-COVERED | — | — |
| S8 | DA review FM | 🟡 PARTIAL | bf7eaea4, fbb32599 | yes — see «Conflicts» |
| S9 | DA review RL | ⚪ NOT-COVERED | — | — |
| S10 | Handoff `--with-da-review` | 🟡 PARTIAL | 9da2652a | — |
| S11 | Cleanup orphan detection | 🟡 PARTIAL | 5345f116 | — |
| S12 | Cleanup `--pending-hygiene` ⚠ CRITICAL (verifies DEC-DEV-0036 fixes) | 🔴 FAIL | 98cb1b97, 5345f116 | — |
| S13 | NFR tier upgrade | 🟡 PARTIAL | 8f10e02f | — |
| S14 | (not in plan) | ⚪ NOT-COVERED | — | — |
| S15 | (not in plan) | ⚪ NOT-COVERED | — | — |

## Findings synthesis

### Recurring patterns

- **`general-purpose` substituted for the canonical `product-devils-advocate` subagent — 4 sessions.** Surfaced under check F in `fbb32599` and `9da2652a` («subagent_type=general-purpose instead of product-devils-advocate (skill anti-pattern #5)»), under check C in `e1615a0c` («BR-cluster DA ran via subagent_type general-purpose»), and as the S8 FAIL in `bf7eaea4`. This is **not skill drift** — `bf7eaea4` captured the harness error verbatim: `"Agent type 'product-devils-advocate' not found. Available agents: claude, ..., general-purpose, ..."`. The project-defined agent type cannot be registered in the current Claude Code runtime; the fallback is faithful (STEP-0 role-adoption from `devils-advocate.md`) but bypasses the agent's tool whitelist and model pinning. Systemic — needs a spec-level decision, not per-session correction.
- **Frontmatter / schema drift on written artifacts — 5 check-A findings across 4 sessions.** Representative snippet (`9da2652a`): «DA findings file uses nested `review_metadata` + `findings[]` block instead of flat canonical fields». Also: IC files with `type: invariant` vs canonical `invariant-check` (`e1615a0c`), NOTE-013 missing `version` and using `related_artifacts` for `related` (`fbb32599`), DA-findings rendered as markdown bold-text rather than per-finding YAML (`fbb32599`). Two distinct root causes: (a) the AI matches the pilot's pre-existing non-canonical convention for intra-project consistency, and (b) the canonical shape for a *multi-finding* `.product/.da-findings/` file is genuinely ambiguous in spec — `9da2652a` flags this explicitly.
- **`/product:cleanup` anti-pattern violations — both S12 runs failed, on different anti-patterns.** `98cb1b97`: «Auto-delete of fresh DA-pending entry violates cleanup-detector.md anti-pattern 2» (the wiped entry was queued *within the same session* — not even stale). `5345f116`: direct `node cascade-check.js` synthetic-hook-input loop instead of delegating to `/product:cascade --pending --revalidate` (anti-pattern #5). The DEC-DEV-0036 defensive fixes that S12 was written to verify did **not hold** at runtime.
- **V-11 bi-directional reference gap — 3 check-D findings.** Representative (`e1615a0c`): «SC written with `rules: []` / `verification: []`; BR/VC reverse refs never backfilled». Whether `cascade-check.js` backfills reverse links inside a `/product:feature` flow could not be confirmed from any transcript (`fbb32599`, `e1615a0c` both note this as unverified).

### Critical issues

- **🔴 Blocking — check C, `98cb1b97`, `BR-027-pipeline-stage-ordering.md`.** A semantic BR edit (`lifecycles: [LC-Job]` → `[LC-004]` + version bump) correctly triggered `br-change-trigger.js`, which queued a P-RULE-02 DA-pending entry — and the assistant then overwrote `da-pending.yaml` to `entries: []` ~2 minutes later without ever invoking `product-devils-advocate`. P-RULE-02 was silently defeated. Suggested action: restore the BR-027 DA-pending entry (or record a justified `resolution: dismissed` DA-finding), and add a session-window guard to `skills/product/cleanup-detector.md` so pending-hygiene never touches entries queued during the current session. See [98cb1b97](./98cb1b97-d338-435b-b152-182d4aec90d3.md).

### Conflicts

- **S2 — Language discipline** (`conflict: true`). Verdicts: `e1615a0c` COVERED, `bf7eaea4` COVERED, `fbb32599` COVERED, `9da2652a` UNCERTAIN. **Resolution:** best-of → ✅ COVERED. Three independent sessions verified Russian-default dialogue with identifiers/paths preserved; `9da2652a`'s UNCERTAIN is a transcript-extract limitation (no user-facing assistant prose in its extract), not a discipline failure. COVERED stands.
- **S5 — Handoff draft** (`conflict: true`). Verdicts: `fbb32599` COVERED, `9da2652a` PARTIAL. **Resolution:** best-of → ✅ COVERED. `fbb32599` generated `FM-001-handoff.md` with `status: partial`, draft warnings, and 52 full sha256 hashes. `9da2652a`'s PARTIAL is a flaky path: the session ended (`prompt_input_exit`) before Task #3 (handoff write) ran — an incomplete run, not a draft-mode defect.
- **S8 — DA review FM** (`conflict: true`). Verdicts: `bf7eaea4` FAIL, `fbb32599` PARTIAL; script `best_verdict: PARTIAL`. **Resolution:** the FAIL is authoritative for closure purposes. `bf7eaea4` is the chronologically later transcript (session ran 2026-05-16 vs `fbb32599`'s 2026-05-15) **and** per the FAIL-propagation rule a FAIL is never overridden absent commit evidence of a fix — and none exists. Both sessions fail the same acceptance item («subagent_type canonical, НЕ general-purpose fallback»). S8 should be treated as not-passing even though the matrix `best_verdict` shows PARTIAL (best-of).

## Per-session reports

- [bbb68ac9-0d05-43c4-9566-87891e44a6cf](./bbb68ac9-0d05-43c4-9566-87891e44a6cf.md) — status: clean; coverage 0/0/0/13/0 (setup-only: built the `phase-4-smoke-test` isolation branch).
- [e1615a0c-149d-446f-9111-7ca8d49d46ab](./e1615a0c-149d-446f-9111-7ca8d49d46ab.md) — status: fail; coverage 2/1/1/9/0 (S1 FAIL, S3, S4; HYP-005 + FM-004 enrichment).
- [bf7eaea4-d53f-4b0d-b736-fd78a6193f8b](./bf7eaea4-d53f-4b0d-b736-fd78a6193f8b.md) — status: fail; coverage 1/0/1/11/0 (S8 FAIL — `product-devils-advocate` not registerable).
- [98cb1b97-d338-435b-b152-182d4aec90d3](./98cb1b97-d338-435b-b152-182d4aec90d3.md) — status: fail; coverage 0/0/1/14/0 (S12 FAIL — DA-pending wipe; 1 blocking finding).
- [5345f116-93ff-455f-92f4-77410fd3a37d](./5345f116-93ff-455f-92f4-77410fd3a37d.md) — status: fail; coverage 0/1/1/13/0 (S12 FAIL — direct `cascade-check.js`; S11 PARTIAL).
- [5ba3ee30-592c-4e45-9ef6-08aa22e0ef55](./5ba3ee30-592c-4e45-9ef6-08aa22e0ef55.md) — status: clean; coverage 0/0/0/15/0 (meta-setup: `/ecosystem:update` + `/ecosystem:enable-d7-audit`).
- [fbb32599-4066-435b-a92d-54374b683596](./fbb32599-4066-435b-a92d-54374b683596.md) — status: partial; coverage 2/2/0/11/0 (S5 COVERED, S2 COVERED, S6 + S8 PARTIAL).
- [9da2652a-7d70-452a-9e74-fe6cbfcc4b3d](./9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md) — status: partial; coverage 0/2/0/12/1 (S5 + S10 PARTIAL — session ended before handoff write).
- [8f10e02f-816c-4b56-a364-cdc925d00f6f](./8f10e02f-816c-4b56-a364-cdc925d00f6f.md) — status: partial; coverage 0/1/0/14/0 (S13 PARTIAL — `nfr-upgrade-tier mmp --dry-run` only).

## Recommendations

- **Re-run S12 after hardening `skills/product/cleanup-detector.md`.** Both runs FAILed on different anti-patterns (#2 DA-pending wipe in `98cb1b97`; #5 direct `cascade-check.js` in `5345f116`) — the DEC-DEV-0036 fixes did not hold. Add a Step 5c session-window guard (skip entries with `queued_at >= session_start`) and strengthen the cascade-delegation contract, then re-smoke. High signal: fixes are in Phase 4 scope.
- **Resolve the `product-devils-advocate` registration gap before Phase 5.** The harness cannot register the project agent type (`bf7eaea4` evidence). Decide and codify: either make the `general-purpose` + STEP-0 role-adoption substitute the official contract in `skills/product/product-da-review.md` and `agents/product/devils-advocate.md`, or fix harness registration. Affects S8 (FAIL) and 4 sessions.
- **Reconcile S1 with the pilot, then re-run.** `dev/PHASE_4_SMOKE_TEST_PLAN.md` §S1 can never PASS as written: `my-first-test` HYP-001..005 all use the non-canonical `success_threshold`/`linked_segment`/`linked_vp` schema, and the AI matched it for intra-project consistency. Either correct S1's acceptance criteria or migrate the pilot HYPs to canonical `docs/pmo/artifacts/HYP.md` fields.
- **Codify the frontmatter-drift pattern into D7 `patterns/` and disambiguate the DA-findings shape.** 5 check-A findings across 4 sessions are systemic; `9da2652a` shows the canonical multi-finding `.product/.da-findings/<id>-<timestamp>.md` structure (flat per-finding vs nested `review_metadata` + `findings[]`) is genuinely ambiguous — clarify it in `agents/product/devils-advocate.md` before the Integrator consumes these files in Phase 5.
- **Schedule a follow-up session for S7 and S9.** Neither cross-platform hash (S7) nor DA-review-on-release-scope (S9) was triggered by any of the 9 sessions; the «≥10/13 PASS» closure bar is unreachable without dedicated coverage.

## Skipped / out-of-scope

- **S7 (Cross-platform hash) and S9 (DA review RL)** — `best_verdict: NOT-COVERED`; zero sessions triggered them and no re-run is yet scheduled (see Recommendations).
- **S14 / S15** — appear in the coverage matrix as «(not in plan)»; per smoke plan §A they were retroactively marked PASS in DEC-DEV-0032/0033 and sit outside the 13-scenario runtime count.
- **2 uncertain findings carried without resolution:** `98cb1b97` check D — the V-15 orphan-detection Explore subagent timed out at 389s and never surfaced its orphan list (S11/S12 orphan output inconclusive); `5345f116` check F — a user-authorised DA-pending wipe framed as «Recommended», a borderline reading of anti-pattern #2 that needs skill-text clarification.
- **Aggregate counting nuance (not recomputed):** the script-computed `coverage_summary` is copied verbatim into the frontmatter as required; note that its components (3+6+2+4) sum to 15 while `total_scenarios` is 13 — `not_covered: 4` appears to fold in S14/S15. Flagged for the `audit-smoke.js` maintainer; not adjusted here.
