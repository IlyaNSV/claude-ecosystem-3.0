# Pilot runbook — N+2 gate-followups batch (executor-facing)

> **What this is:** the step-by-step you (owner) follow IN THE PILOT (`my-first-test`) to exercise the
> N+2 gate-followups + the carried-over backlog. It is the **executor** half. The **grading rubric**
> lives separately in [`ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md`](ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md) §6
> and stays with the reviewer (me) — **do not read the rubric to the pilot session.**
>
> **The one rule — executor/reviewer separation** ([[feedback_separate_task_from_test]]): paste ONLY
> the command blocks below into a FRESH pilot session. **Never tell the session what is being checked**
> (no "we're testing FB-LR-15", no hints). Answer factual clarifying questions, but do not coach
> mid-run. After each run, hand me the result; I grade in one sweep.
>
> Increment under test: DEC-DEV-0101/0102/0106 (merged, PR #67) + carried-over 0096-T5-transient /
> 0103-V2 / 0104-FB-LR-19.

---

> **STATE SNAPSHOT — pilot `my-first-test`, verified 2026-06-26 (read-only sweep). Pin these so the
> runs use real targets, not placeholders:**
> - **Delivery already landed.** `.claude/` is synced to upstream `37ec14e` (pilot commit `3489e34`),
>   which is *after* PR #67 — the gate-followups are already installed. Verified in the INSTALLED copies:
>   `validate-feature-impl.mjs` carries `validators_incomplete` (×2) + `committed_under_non_ready` (0101/0102);
>   the 3 advisor agents are present (0103); `feature-to-tdd-impl.mjs:494-495` carries `conflicts.concat` +
>   `findings` (0104). A fresh `.claude-backup-20260626-144807/` confirms an `/ecosystem:update` ran today.
>   **→ Step 0's update is OPTIONAL for this batch** — re-run it only to pull ecosystem past `37ec14e`
>   (0107 verify Step 4.5 / 0108-0110 work-rails — none of which this batch needs).
> - **Feature slug ≠ FM-id.** For P5/P6, `--feature` takes the **cc-sdd slug** (the `.kiro/specs/<slug>/` dir
>   name): `admin` · `auth` · `billing` · `glossary` · `localization`. (`--feature FM-NNN` is P3-only, for handoffs.)
> - **Every feature is fully `[x]`-done** (admin 17/17 · auth 26/26 · billing 19/19 · glossary 20/20 ·
>   localization 26/26). P6 (G-1/G-2) gating a *done* feature is its normal mode (it validates the result).
>   **P5 (G-3) on a done feature is a no-op** (0 actionable tasks, the Run-C-admin lesson) → see the G-3 fork in Step 1.
> - **Orphan carrier (FB-LR-21) = `glossary`.** `design.md` exposes `GlossarySnapshotService.buildSnapshot` as a
>   *synchronous in-process* call from FM-002 with **no worker hook** (deliberate, spec-sanctioned) — exactly the
>   deferred seam RA-10 wrongly returned `clean:true` over in Run C.
> - **`advisor-pending.yaml` is empty** (`entries: []`, cleared 2026-06-26 per DEC-PLAN-037) → R-1 needs a fresh
>   significant `.product/` edit to repopulate it before the personas fire.

## Step 0 — deliver once (then never again this batch)

> **For THIS batch, delivery is already done (see snapshot). Run Step 0 only if you also want
> ecosystem ≥ 0107.** Otherwise skip to the verification sub-steps (4) and the baseline tag (5).

In the pilot repo:

1. **`/ecosystem:update`** *(optional — only to go past `37ec14e`)* — pulls the merged ecosystem into `.claude/`.
2. **HARD STOP** if the update would delete `.product/`, `.claude/orchestrator/runs/`, or
   `.product/.upstream/feedback-outbox.md`. Wipe-protection (DEC-DEV-0061/0088) must hold — if anything
   pilot-local is at risk, **stop and tell me**.
3. **`/ecosystem:verify`** — health check.
4. **Confirm the delivery landed** (run these checks yourself, not via the pilot session). **All three were
   already verified ✅ on 2026-06-26** — re-run only if you push another update:
   - installed gate carries the new fields ✅: `grep -E "validators_incomplete|committed_under_non_ready" .claude/orchestrator/processes/validate-feature-impl.mjs`
     → both present (×2 / ×1). Also `feature-to-tdd-impl.mjs:494-495` carries `conflicts.concat` + `findings` (0104). ✅
   - the 3 advisor agents register ✅ (pre-req for R-1): `.claude/agents/product/architect-advisor.md`,
     `.claude/agents/product/qa-advisor.md`, `.claude/agents/design/ux-advisor.md` all present.
   - `ecosystem_version` re-stamped — ⚠️ **note:** in THIS pilot `product.yaml` is NOT under `.product/`
     (only backup copies exist under `.claude-backup-*/`); locate the live one (`find . -iname product.yaml -not -path '*/.claude-backup-*/*'`)
     before grepping its `ecosystem_version`. Non-blocking for the runs.
5. **Tag a clean baseline** so I have a fixed grade reference:
   `git -C <pilot> tag pre-n2-followups-baseline` (or just note the HEAD sha and send it to me).

---

## Step 1 — pick the features (pinned from the snapshot; one fork to decide)

- **P6 runs (G-1, G-2) — use a DONE feature; that is P6's normal mode** (it gates an implemented result):
  - **G-1 → `glossary`** — the orphan carrier. Exercises **FB-LR-21** (RA-10 over `buildSnapshot`) + the
    FB-LR-15/16 negatives on a clean run.
  - **G-2 → `billing`** — the original B-run; carries the `had_trial` seam → a good T1 / FB-LR-16 carrier with
    the substrate DOWN.
- **P5 run (G-3) — BLOCKED as-is: no un-done feature exists.** P5 implements unchecked `[ ]` tasks; with
  everything `[x]` it's a no-op (the Run-C-admin lesson).
  > **DECISION 2026-06-26 — Fork C selected.** This pass = **G-1 + G-2 + R-1 only**. G-3 (and with it the
  > *live* re-confirmation of FB-LR-19 / T5-transient) is deferred to the next real P5 feature — both are already
  > verify-green + code-confirmed (`feature-to-tdd-impl.mjs:494-495`), so this defers only their live re-run, not the fix.

  The forks (kept for when G-3 is taken up later):
  - **Fork A (cleanest, costliest) — author a new small feature** (fresh handoff → P3 → un-done `tasks.md`),
    then P5 it. A real new pilot increment (what `glossary` itself was in Run C). G-3 slug = the new spec.
  - **Fork B (cheapest live G-3) — roll back the tail of `glossary`**: `git revert` the last few impl commits
    (branch `tdd-impl-glossary`) AND flip those `[x]`→`[ ]` in `glossary/tasks.md`, so P5 re-implements them and
    the nested P6 fires on the orphan carrier → **FB-LR-19 (P5 envelope) + FB-LR-21 + T5-transient in one run**.
    Tag a baseline first (it's git-reversible). **Do G-1 on done-`glossary` BEFORE the rollback** so the clean
    orphan baseline isn't lost. G-3 slug = `glossary`.
  - **Fork C (defer) — skip G-3 this pass.** Run G-1+G-2 now (FB-LR-21 + the FB-LR-15/16 negatives + T1); mark
    FB-LR-19 / T5-transient **"not-exercised — awaits the next real P5 feature"** (FB-LR-19 is already verify-green
    + code-confirmed at `feature-to-tdd-impl.mjs:494-495`, so this defers only its *live* re-confirmation).

---

## Step 2 — the runs (paste each block CLEAN into a fresh session; capture the result)

> After each run, copy back to me: the **session id**, the workflow's **`result: { ... }` JSON**
> (the final return envelope), and confirm the transcript is saved. Nothing else needed.

**G-1 — P6 gate, substrate UP** (orphan carrier + FB-LR-15/16 negatives):
```
/orchestrator:run validate-feature-impl --feature glossary
```

**G-2 — P6 gate, substrate DOWN** (the FB-LR-16 / T1 carrier):
1. Bring the substrate down first: `docker compose down` (or stop the Docker daemon / the DB).
2. Then:
```
/orchestrator:run validate-feature-impl --feature billing
```
3. Bring the substrate back **up** afterwards.
> If no real defect surfaces to remediate, G-2 still exercises T1 (down substrate → `MANUAL_VERIFY`,
> not NO-GO) and the FB-LR-16 negative — that's a valid result, don't force a defect.

**G-3 — P5→P6 nesting** (FB-LR-19 + T5-transient) — ⏸ **DEFERRED this pass (Fork C, Step 1).** Run only when
a real un-done feature exists (Fork A new spec, or Fork B `glossary`-tail rollback):
```
/orchestrator:run feature-to-tdd-impl --feature <un-done slug — a new Fork-A spec, or `glossary` after a Fork-B rollback>
```
> Do NOT run this against a fully-`[x]` slug — it's a no-op (0 actionable tasks). Resolve the slug from
> whichever G-3 fork you pick when you take it up.

**R-1 — V-2 personas** (the 0103 frontmatter fix — already delivered ✅):
1. Make a **significant** edit to a real `.product/` artifact (a BR or IC **body** change — not just a
   `version:`/`updated:` bump) to repopulate the now-empty `.product/.pending/advisor-pending.yaml`.
   Concrete pick: change the logic in a BR body, e.g. **`BR-051` (glossary-snapshot-construction-mechanics)** →
   drives FM-003, or **`BR-068` (checkout-idempotency)** → drives FM-005. Both are reviewed by architect+qa personas.
2. Drive the completeness loop on that BR's feature, which fires the personas:
```
/product:complete FM-003      # if you edited a glossary BR (BR-051); use FM-005 for a billing BR (BR-068)
```
> What I check: the personas resolve to their registered agents (no «Agent type not found»). If you
> see that error — **stop and tell me** (the frontmatter fix did not land); never let it fall back to a
> generic agent.

---

## Step 3 — hand back

Give me, per run: session id + the `result` JSON + "transcript saved". I grade all of them in **one
sweep** against the rubric (§6 of the live-plan) with a blind second auditor + a neutral adjudicator
for the headline runs, and write the ledger rows. Green ⇒ that increment is live-validated; a genuine
new defect ⇒ a new `DEC-DEV` (next free **0111** — 0107-0110 are consumed; the journal tail is the source of truth).

---

## Don'ts (the contamination guards)

- ❌ Don't tell the pilot session what's being tested (no FB-LR ids, no "watch for X").
- ❌ Don't coach mid-run or fix things for it — let it run; the transcript is the evidence.
- ❌ Don't manufacture a validator crash (FB-LR-15) or a transient block (T5) — those are
  **opportunistic**; assert the negative on clean runs, capture the positive only if it happens naturally.
- ❌ Don't skip the wipe-protection check in Step 0.

## Related
- Plan + grading rubric (reviewer): `dev/ORCHESTRATOR_N2_GATE_FOLLOWUPS_LIVE_PLAN.md`
- Ledger (where findings land): `dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md`
- Increment: `DEV_JOURNAL.md` DEC-DEV-0101 / 0102 / 0106
- Separation principle: `dev/meta-improvement/checklists/live-run-validation.md`
