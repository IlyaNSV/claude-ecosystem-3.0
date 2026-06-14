---
description: Orchestrator P3/P6 gate — verify a generated cc-sdd spec covers every source requirement by re-deriving the canonical IDs from ground truth (the handoff), never from the spec-author's self-report. Backed by the deterministic orchestrator/lib/coverage-oracle.cjs helper. Load when closing the spec-author wave.
---

# coverage-oracle — independent coverage gate (P1-1)

The closing gate of the P3 spec-author wave (and reusable in P6). It answers "did the
spec cover every source requirement?" from **ground truth**, not from the subagent
that authored the spec.

> RUN 01 grounding (P1-1, DEC-DEV-0073): in the dogfood run, coverage was taken from
> the spec-author's self-report. A subagent that silently drops SC-002 also reports
> "all scenarios covered". The gate must re-derive IDs from the handoff independently.

> Positioning (DEC-DEV-0076): this is the **deterministic complement** to
> kiro-spec-batch's Step 4 cross-spec review. That review is thorough but LLM-judgment
> (data models, interfaces, naming…); this gate is code over ground truth — it answers
> the one question an LLM reviewer can still get wrong by trusting a self-report:
> "is every source requirement id actually present in the spec?" The two are additive,
> not redundant.

## The determinism boundary

The verdict comes from **code**, not judgment. The Workflow gate dispatches an agent
whose only job is to run the deterministic helper via Bash and relay its JSON; the
schema validation catches a mis-relay. The helper:

- extracts source IDs from the handoff's §5/§6/§9 (SC-/BR-/IC-) with the same
  monotonic section-guard the adapter uses (no §10-clobber leakage);
- checks each source ID appears in the generated spec text;
- optionally cross-checks the spec-author's self-report against ground truth (flags
  omissions AND fabrications).

## Usage

Extract mode (ground-truth IDs — done at brief time, reused here):

```bash
node .claude/orchestrator/lib/coverage-oracle.cjs \
  --handoff .product/handoffs/FM-NNN-handoff.md
```

Coverage mode (every source ID must appear in the authored spec):

```bash
node .claude/orchestrator/lib/coverage-oracle.cjs \
  --handoff .product/handoffs/FM-NNN-handoff.md \
  --spec .kiro/specs/<slug>/requirements.md \
  --spec .kiro/specs/<slug>/design.md
echo "exit: $?"   # 0 = all covered; 1 = something missing
```

Optional self-report cross-check (pass the author's `traced_source_ids` flattened):

```bash
... --self-report '["SC-001","BR-001","IC-001"]'
```

## Reading the verdict

- `coverage.passed: true` (exit 0) → wave gate green for this feature.
- `coverage.families.<fam>.missing: [...]` (exit 1) → those source requirements are not
  in the spec. **Block the feature** → route back to a `spec-author` remediation pass
  (re-author the missing requirements), then re-run the gate.
- `self_report_cross_check.unclaimed_ground_truth` non-empty → the author dropped IDs
  it didn't even claim (the silent-drop signature).
- `self_report_cross_check.fabricated_claims` non-empty → the author claimed coverage
  for IDs not in ground truth (inflated self-report) — treat the whole report with
  suspicion.

## Anti-patterns

1. **Trusting the self-report.** The author's "covered" list is evidence to
   cross-check, never the verdict.
2. **Eyeballing coverage.** "Looks complete" is the judgment this gate replaces. Run
   the helper; read the exit code.
3. **Passing a feature with `missing` non-empty.** Missing source IDs = incomplete
   spec; remediate before the cross-spec loop, not after.
4. **Re-implementing extraction in the agent.** The agent runs the helper; it does not
   re-grep IDs itself (that re-introduces the self-report trust problem).
