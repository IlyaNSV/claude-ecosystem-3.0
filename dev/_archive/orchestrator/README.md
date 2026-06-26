# Archived Orchestrator / Vision dev-docs

> Process records (kickoffs, briefs, review-handoffs, resume-checkpoints, replayed run-plans) whose
> work is **done and live-validated**. Moved out of `dev/` top-level on 2026-06-26 to stop the
> kickoff+brief+handoff triads from outliving the process they served. Nothing here is a live plan —
> the living Orchestrator/Vision docs stay in `dev/` (ledger, workorder, S7 brief, the N+2 followups
> plan/runbook, `ECOSYSTEM_VISION.md`).

| file | what it was | closed by |
|---|---|---|
| `ORCHESTRATOR_BUILD_KICKOFF.md` | D7 kickoff of build increment 1 (P3+P5) | DEC-DEV-0075; P3/P5 built |
| `ORCHESTRATOR_GATE_RISK_CLASSIFIER.md` | design source for the gate-risk predicate | DEC-DEV-0077; WIRED into code+skill+test |
| `ORCHESTRATOR_P4_P6_KICKOFF.md` | D7 kickoff of increment 2 (P4+P6) | P4/P6 built + live-validated (DEC-DEV-0091) |
| `ORCHESTRATOR_P4_P6_LIVE_BRIEF.md` | operator brief for the first P4/P6 live-run | findings in the ledger (0091) |
| `ORCHESTRATOR_P4_P6_REVIEW_HANDOFF.md` | reviewer handoff for the P4/P6 post-hoc grade | grade done → ledger (0091) |
| `ORCHESTRATOR_S6_BRIEF.md` | design of the S6 dogfood (§6 capability channel) | DEC-DEV-0081 |
| `ORCHESTRATOR_S6_REVIEW_HANDOFF.md` | reviewer handoff for the S6 grade | DEC-DEV-0081 |
| `ORCHESTRATOR_N2_RESUME.md` | session resume-checkpoint for the N+2 queue | queue merged; superseded by workorder + ledger |
| `UNIFIED_PILOT_VALIDATION_PLAN.md` | unified wave: N+2 Track O + Vision Track V | wave replayed; continued by the N+2 followups plan |
| `PILOT_SESSION_RUNBOOK_BLOCK2.md` | executor runbook for the Vision Epic A+B live-run | Track V graded (DEC-DEV-0103) |
| `ECOSYSTEM_VISION_BATCH_1.md` | execution work-order for Vision Increment 1 | DEC-DEV-0098/0099; deliverables landed |

**Note on internal links:** cross-references *between* these archived files (and a few `dev/…` paths
inside them) are frozen as written and may not resolve post-move — that is acceptable for a historical
record. Links *from* living docs into this folder were updated to `dev/_archive/orchestrator/…`.
