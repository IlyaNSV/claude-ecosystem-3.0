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

## Step 0 — deliver once (then never again this batch)

In the pilot repo:

1. **`/ecosystem:update`** — pulls the merged ecosystem into `.claude/`.
2. **HARD STOP** if the update would delete `.product/`, `.claude/orchestrator/runs/`, or
   `.product/.upstream/feedback-outbox.md`. Wipe-protection (DEC-DEV-0061/0088) must hold — if anything
   pilot-local is at risk, **stop and tell me**.
3. **`/ecosystem:verify`** — health check.
4. **Confirm the delivery landed** (run these checks yourself, not via the pilot session):
   - the installed gate carries the new fields:
     `grep -E "validators_incomplete|committed_under_non_ready" .claude/orchestrator/processes/validate-feature-impl.mjs` → both present;
   - the 3 advisor agents register (pre-req for the V-2 re-run): `.claude/agents/product/architect-advisor.md`,
     `qa-advisor.md`, `.claude/agents/design/ux-advisor.md` present and parse;
   - `ecosystem_version` re-stamped in `product.yaml` (DEC-DEV-0083 Step 5c).
5. **Tag a clean baseline** so I have a fixed grade reference:
   `git -C <pilot> tag pre-n2-followups-baseline` (or just note the HEAD sha and send it to me).

---

## Step 1 — pick the features (do this before the runs)

- **For G-1 / G-3 you need an UN-DONE feature** — `tasks.md` with unchecked `[ ]` boxes. A fully-`[x]`
  feature is a no-op (the Run-C-admin lesson: 0 actionable → the gate never engages). Find one:
  look in `.kiro/specs/*/tasks.md` for remaining `- [ ]`.
- **For the orphan check (G-1):** prefer a feature whose `design.md` defers a symbol ("wired up by a
  later feature / task"). If you know one carries a deliberately-unwired export, use it — otherwise any
  un-done feature is fine; the orphan check just won't fire (that's a valid "not-exercised", not a fail).
- Note the chosen feature slug(s); you'll paste them below.

---

## Step 2 — the runs (paste each block CLEAN into a fresh session; capture the result)

> After each run, copy back to me: the **session id**, the workflow's **`result: { ... }` JSON**
> (the final return envelope), and confirm the transcript is saved. Nothing else needed.

**G-1 — P6 gate, substrate UP:**
```
/orchestrator:run validate-feature-impl --feature <UNDONE_FEATURE>
```

**G-2 — P6 gate, substrate DOWN** (the FB-LR-16 / T1 carrier):
1. Bring the substrate down first: `docker compose down` (or stop the Docker daemon / the DB).
2. Then:
```
/orchestrator:run validate-feature-impl --feature <FEATURE_WITH_A_REAL_DEFECT>
```
3. Bring the substrate back **up** afterwards.
> If no real defect surfaces to remediate, G-2 still exercises T1 (down substrate → `MANUAL_VERIFY`,
> not NO-GO) and the FB-LR-16 negative — that's a valid result, don't force a defect.

**G-3 — P5→P6 nesting** (FB-LR-19 + T5-transient opportunistic):
```
/orchestrator:run feature-to-tdd-impl --feature <UNDONE_FEATURE>
```

**R-1 — V-2 personas** (after delivery — the 0103 frontmatter fix):
1. Make a **significant** edit to a real `.product/` artifact (a BR or IC body change — not just a
   `version:`/`updated:` bump) to populate `.product/.pending/advisor-pending.yaml`.
2. Drive the completeness loop on a feature, which fires the personas:
```
/product:complete <FM-NNN>
```
> What I check: the personas resolve to their registered agents (no «Agent type not found»). If you
> see that error — **stop and tell me** (the frontmatter fix did not land); never let it fall back to a
> generic agent.

---

## Step 3 — hand back

Give me, per run: session id + the `result` JSON + "transcript saved". I grade all of them in **one
sweep** against the rubric (§6 of the live-plan) with a blind second auditor + a neutral adjudicator
for the headline runs, and write the ledger rows. Green ⇒ that increment is live-validated; a genuine
new defect ⇒ a new `DEC-DEV` (next free **0107**).

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
