# Phase 5 — Smoke Test Plan

> **Status:** active until runtime smoke executed, then archived to `dev/_archive/phase-5/`.
> **Owner:** developer.
> **When to run:** after sub-phase J static smoke passes; before Phase 5 closure ritual (Unit 2).

---

## Scope

Per **DEC-DEV-0040 Q3 boundary** — Phase 5 is **Integrator-only**. Runtime smoke verifies:
- 6-stage `/integrator:add` orchestration
- `pmo-mapping.yaml` reflects `DEC-DEV-0040 Q5` zone assignments
- Stage-6 fixture contract-test passes (`adapter --verify-only`)
- `/integrator:remove` backup + rollback works
- `/integrator:update` drift detection produces actionable report
- `journal-hook` autologs without dedup loss

Full handoff → live `/kiro:spec-init` end-to-end is **out of scope** (Orchestrator territory). PILOT POINT (`adapter → real cc-sdd → spec.json`) requires Orchestrator work that is not in Phase 5.

---

## Pre-flight

- [ ] Local clone has Phase 5 commits acb5113 → 69ab156 + closure commit
- [ ] `node --version` ≥ 18 (adapter uses ES2020 features)
- [ ] Pilot project `my-first-test/` has been bootstrapped with Phase 4 deliverables (F4 from PHASE_4 closure — `/ecosystem:update` ran in pilot session). If not — sequence: F4 first, then smoke.
- [ ] No prior `.claude/integrator/` in pilot (fresh state for S1) OR backup of existing state captured

---

## Scenarios

### S1 — `/integrator:add cc-sdd` greenfield (CRITICAL)

**Setup:** clean pilot project; no `.claude/integrator/` state; no cc-sdd installed.

**Steps:**
1. In pilot session: `/integrator:add cc-sdd`
2. Stage 1 should spawn `tool-profiler` subagent (verify Agent tool invocation in transcript)
3. Stage 2 should present approve gate with: profile summary, what tool installs, conflicts (likely none in greenfield), CNT preview
4. Approve with `y`
5. Stage 3 should `npx cc-sdd@latest --claude-agent --lang ru`; verify install
6. Stage 4 should write `active-tools.yaml`, `pmo-mapping.yaml`
7. Stage 5 should spawn `contract-designer` subagent; subagent detects `adapters/handoff-to-ccsdd.js` (REUSE per Q1); copy to `.claude/integrator/adapters/handoff-to-ccsdd.js` with metadata injected; `--verify-only` smoke against tests/fixtures/FM-FIXTURE-001-handoff.md exit 0
8. Stage 6 generates `tool-docs/cc-sdd.md` per `tool-docs-generator` skill

**Acceptance:**
- All 6 stages completed without manual fix (approve gate accepted)
- `.claude/integrator/active-tools.yaml` contains `cc-sdd` entry with `version_installed`, `installed_at`, `claude_primitives[]`, `contracts: [CNT-001]`
- `.claude/integrator/pmo-mapping.yaml` exists and is well-formed
- `.claude/integrator/contracts/CNT-001.yaml` + `.md` present
- `.claude/integrator/adapters/handoff-to-ccsdd.js` present, metadata header populated (target_tool_version, source_ref, installed_at, contract_schema_version)
- `.claude/integrator/tool-docs/cc-sdd.md` exists, follows SPEC §14 structure, English, project-agnostic
- `~/.claude/integrator/tool-catalog/cc-sdd.yaml` cached globally
- `.claude/integrator/project-journal.md` has DEC-INT-NNNN entry from add-flow + journal-hook entries for each YAML write

**Failure modes to capture:**
- Subagent invocation absent (skill loaded inline instead — wrong)
- Approve gate skipped (silent install — wrong)
- Stage 6 verify smoke exit ≠ 0 (adapter contract issue)

---

### S2 — pmo-mapping.yaml zone assignments (CRITICAL — per DEC-DEV-0040 Q5)

**Setup:** S1 completed successfully.

**Steps:** read `.claude/integrator/pmo-mapping.yaml` after S1.

**Acceptance:**
- `coverage.D2-T01.covered_by` contains `cc-sdd`
- `coverage.D2-T01.primary` = `cc-sdd`
- `coverage.D2-T01.confidence` = `high` (with `evidence` field non-empty)
- `coverage.D2-T01.contracts` includes `CNT-001`
- `coverage.D2-T06.*` mirror D2-T01 structure
- `coverage.D2-T04.*` present with `confidence: partial` (per Q5 profile-stage finding)
- `coverage.D2-B02.*` present with `boundary:` field noting Product Module ownership; cc-sdd listed in `consumed_by:` (not `covered_by:`)
- **No phantom IDs** — grep should find zero occurrences of `D2-Tech-02`, `D2-03`, `D2-04` style legacy IDs

**Failure modes:**
- Phantom IDs reappearing (regression on DEC-DEV-0040 lesson #3)
- D2-B02 in `covered_by` (boundary violation — Product Module owns)
- Missing `evidence` on `confidence: high` (SPEC §4.3 invariant violation)

---

### S3 — Stage-6 fixture contract-test (CRITICAL)

**Setup:** S1 completed.

**Steps:**
```bash
node .claude/integrator/adapters/handoff-to-ccsdd.js --verify-only --fixture tests/fixtures/FM-FIXTURE-001-handoff.md
echo "exit: $?"
```

(In ecosystem repo root or pilot project root with the fixture path adjusted.)

**Acceptance:**
- Exit 0
- JSON output: `contract_validation.passed: true`
- All 6 contract checks C-01..C-06 present; blocking-level all `pass`
- `cc_sdd_input.spec_init_input.feature_name` = slugified title
- `cc_sdd_input.spec_init_input.feature_id` = `FM-001`
- `cc_sdd_input.steering_prefix.product_tier` populated from fixture frontmatter
- `cc_sdd_input.provenance.handoff_id` = `HANDOFF-FM-001`

**Failure modes:**
- Parse error (parseFrontmatter regression)
- Missing required section detection failure (C-04 should catch)
- contract_schema_version mismatch between repo reference and installed instance (drift between Phase 5 commits)

---

### S4 — `/integrator:remove cc-sdd` with backup

**Setup:** S1-S3 completed; cc-sdd installed and contract active.

**Steps:**
1. `/integrator:remove cc-sdd`
2. Stage 2 should present impact report: CNT-001, D2-T01/T06 affected, no orphaned handoffs (fixture-only state)
3. Confirm with `y`
4. Stage 4 backs up state files + contracts + adapter + tool-docs to `.claude/integrator/backups/<ISO-timestamp>/`
5. Stage 5 removes tool primitives, CNT files, adapter instance, tool-doc; updates pmo-mapping (D2-T01/T06 → uncovered or secondary promoted)

**Acceptance:**
- Backup directory exists with all listed files
- `active-tools.yaml` no longer contains `cc-sdd`
- `pmo-mapping.yaml` reflects coverage removal correctly
- `.claude/integrator/contracts/CNT-001.*` removed
- `.claude/integrator/adapters/handoff-to-ccsdd.js` removed
- `.claude/integrator/tool-docs/cc-sdd.md` removed
- `~/.claude/integrator/tool-catalog/cc-sdd.yaml` **NOT** deleted; has `deprecated_in_projects:` entry with project path + date
- `.product/handoffs/` **untouched** (no fixture handoffs in pilot; but invariant must hold)
- journal entry DEC-INT-NNNN with rollback procedure

**Manual rollback verification (optional but recommended):**
- Follow rollback steps from journal entry; verify state restored

**Failure modes:**
- `.product/` modified (invariant violation)
- Backup missing files (would block rollback)
- Global catalog deleted instead of deprecated (cross-project regression)

---

### S5 — `/integrator:update cc-sdd` drift detection (mock scenario)

**Setup:** S1 completed (cc-sdd installed at version X); S4 NOT executed yet (or re-run S1 after S4).

**Mock approach** (no real cc-sdd version bump): manually edit `adapters/handoff-to-ccsdd.js` in repo:
- Bump `CONTRACT_SCHEMA_VERSION = 1` → `CONTRACT_SCHEMA_VERSION = 2`
- Add a 2-line change to `transformToCcSddInput` (e.g., add `cc_sdd_input.spec_init_input.dry_run = true` field)
- Commit on a throwaway branch (or stash before running)

**Steps:**
1. `/integrator:update cc-sdd --check-only`
2. Verify drift report shows:
   - D1 semver: in-range (same version)
   - D2 schema: installed=1, repo=2 → 🔴 BREAKING
   - D3 body diff: 2 lines in transformation function → 🔴 functional drift
   - Overall: 1 contract needs repair (CNT-001)
3. Run `/integrator:update cc-sdd` (without --check-only) — should invoke `contract-designer` in repair mode → re-instantiate adapter from new reference → re-verify

**Acceptance:**
- `--check-only` report present, machine-parseable structure
- Repair flow re-instantiates adapter with new metadata (`contract_schema_version: 2`, new `source_ref`)
- Stage 5 verify passes with new contract
- CNT-001 companion .md has "Drift repair YYYY-MM-DD" appended

**Failure modes:**
- Drift checks return false negatives (D2 or D3 not detecting actual change)
- Adapter not re-instantiated after repair (would silently use stale instance)
- Verify smoke fails post-repair (contract design regression)

**Cleanup after S5:** revert the throwaway branch / unstash; ensure `adapters/handoff-to-ccsdd.js` is back to `CONTRACT_SCHEMA_VERSION = 1` body.

---

### S6 — journal-hook autolog + dedup + retention

**Setup:** any state (independent of S1-S5).

**Steps:** already demonstrated in sub-phase F static smoke (commit 777282c). Re-verify in runtime:

1. Save `.claude/integrator/active-tools.yaml` via Edit tool → journal entry appears
2. Within the same minute, save again with identical content → no duplicate entry (dedup)
3. Save a non-integrator file (e.g., `README.md`) → no entry (filter)
4. Run a Bash `npx cc-sdd ...` command → entry appears with `Tool: Bash`, `Action: shell`
5. Generate > 500 entries (test harness with loop in S6 setup) → archive triggers: oldest half moved to `_archive/journal-YYYY-MM.md`

**Acceptance:**
- 1, 2, 3, 4 confirmed via grep `^## ` count on project-journal.md
- 5 confirmed via existence of `_archive/journal-<YYYY-MM>.md` + reduced count in project-journal.md
- `.journal-dedup.json` exists with last 100 keys

**Failure modes:**
- Dedup cache not persisted (each invocation treats as fresh)
- Retention threshold trigger logic wrong (archive at wrong threshold or wrong split)
- Hook blocks tool execution (must be non-blocking per Phase 4 convention)

---

## Aggregated audit (after runtime execution)

Run `/meta:audit-smoke --phase=5` from ecosystem repo to validate per-session markers against this plan. Per DEC-DEV-0034 mechanism.

---

## Known issues to ignore (per DEC-DEV-0038)

These are Phase 4 known issues that may resurface during Phase 5 runtime smoke; do NOT block on them:
- `product-devils-advocate` subagent type registration gap → `general-purpose` fallback. Phase 5 Stage 5 invokes `contract-designer` and `tool-profiler` — verify these register correctly; if they fall back to `general-purpose`, log as new finding.
- S1 from Phase 4 (rassinkhron smoke plan vs pilot HYP) — not Phase 5 territory.

If new issues surface that look like AI regression vs harness behavior — flag in DEV_JOURNAL closure entry for triage.

---

## Post-execution

1. Mark each scenario PASS/PARTIAL/FAIL in this plan
2. Surface findings in DEV_JOURNAL closure entry (`DEC-DEV-NNNN — Phase 5 runtime smoke results`)
3. Archive this plan: `mv dev/PHASE_5_SMOKE_TEST_PLAN.md dev/_archive/phase-5/`
4. Update `dev/PHASE_5_READINESS.md` Section A status accordingly (smoke executed: yes/no, pass/fail)
5. Decide Phase 6 readiness: per closure ritual outcome → start Phase 6 (if pilot FM has UI) OR Phase 7
