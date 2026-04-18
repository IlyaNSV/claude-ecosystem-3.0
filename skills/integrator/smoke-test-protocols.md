---
description: Per-category smoke test templates for /integrator:add verification and /integrator:verify periodic audits. Validates that tool actually does what its profile claims.
---

# Smoke Test Protocols — Skill for Integrator

**Purpose:** move tool confidence from "declared" (trust docs) to "smoke-verified" (observed on our stack).

**When invoked:**
- `/integrator:add <tool>` Stage 6 (smoke test) — один-раз verification
- `/integrator:verify` — periodic audit (weekly/monthly)
- `/integrator:update <tool>` — after version change, re-verify
- `/integrator:debug <tool>` — when troubleshooting, re-run relevant smoke

## Core principles

1. **Non-destructive.** Smoke tests run в sandbox/ephemeral setup. Never touch production data, git main branch, или `.product/` live артефактов.
2. **Minimal footprint.** Create test artifacts → verify behavior → cleanup. No persistent state.
3. **Honest results.** Pass/fail without interpretation. If tool fails edge case — that's a fail, not "mostly passes".
4. **Category-specific.** Different tool categories need different tests. Don't run implementation test on spec-gen tool.
5. **Timeboxed.** Each smoke test capped at 5 minutes. If tool hangs — fail with timeout.

## Classification → Test selection

From tool profile `metadata.category`:

| Category | Test protocol (below) |
|---|---|
| `spec-gen` | §A Spec Generation |
| `implementation` | §B Implementation |
| `testing` | §C Testing |
| `monitoring` | §D Monitoring |
| `deploy` | §E Deploy (dry-run only) |
| `infrastructure` (MCP, adapters) | §F Infrastructure |
| `other` | §G Generic |

Tool может be in 2+ categories — run all applicable tests.

---

## §A Spec Generation (e.g., cc-sdd, Kiro)

**Setup:**
1. Create temp test FM: `.product/features/FM-SMOKE-TEST-<timestamp>.md` with minimal valid content
2. Ensure tool's working directory is empty of artifacts

**Action:**
1. Invoke tool's spec-init equivalent on FM-SMOKE-TEST
2. Wait for completion (timeout 5 min)

**Verify (pass criteria):**
- [ ] Expected output files created (per tool profile `outputs[].location`)
- [ ] Output file content syntactically valid (YAML parseable, markdown renderable)
- [ ] Output references the input FM ID correctly
- [ ] No errors or warnings in tool's stderr
- [ ] Exit code 0

**Cleanup:**
1. Delete FM-SMOKE-TEST-* and all generated outputs
2. Revert any config changes tool made during test

**Example (cc-sdd):**
```bash
# Setup
echo "---
id: FM-SMOKE-TEST-$(date +%s)
title: Smoke test feature
has_ui: false
---
## Why
Smoke test для Integrator.
## What
Dummy feature." > .product/features/FM-SMOKE-TEST-$(date +%s).md

# Action
/kiro:spec-init FM-SMOKE-TEST-$(date +%s)

# Verify
test -f .kiro/specs/FM-SMOKE-TEST-*/spec.json && echo PASS
test -s .kiro/specs/FM-SMOKE-TEST-*/spec.json || echo FAIL: empty output

# Cleanup
rm -rf .kiro/specs/FM-SMOKE-TEST-* .product/features/FM-SMOKE-TEST-*
```

---

## §B Implementation (e.g., beads, superpowers)

**Setup:**
1. Create temp branch: `smoke-test-<timestamp>` (isolated from main)
2. Provide minimal spec input (from §A output or minimal hand-written)
3. Optionally: init a minimal test project (`npm init -y` or equivalent)

**Action:**
1. Invoke tool's implementation command
2. Wait for completion (timeout 5 min)

**Verify:**
- [ ] Expected code files created
- [ ] Files pass basic syntax check (`node --check file.js`, `python -m py_compile file.py`, etc.)
- [ ] Git commit made (if tool auto-commits) — check commit message format
- [ ] No errors in stderr
- [ ] Exit code 0

**Optional deeper check (if tool fast enough):**
- [ ] Generated code compiles / type-checks (if applicable)
- [ ] Basic smoke run of generated code (if trivial to invoke)

**Cleanup:**
1. `git checkout main` and delete smoke-test branch
2. Remove any staged files

---

## §C Testing (e.g., vitest, playwright, jest)

**Setup:**
1. Create temp test file with 1 passing + 1 failing known-good fixture
2. Ensure tool config present (or create minimal)

**Action:**
1. Invoke tool's run command
2. Wait for completion (timeout 5 min)

**Verify:**
- [ ] Tool picked up the fixture
- [ ] Reports 1 pass + 1 fail correctly
- [ ] Exit code reflects failure presence (non-zero for failing test, 0 for passing-only)
- [ ] Report format matches tool profile (JSON/JUnit/etc.)

**For code generation tools (e.g., tool generates tests from VC):**
- [ ] Invokes with VC input → generates test code
- [ ] Generated test syntactically valid
- [ ] Generated test's assertions map to VC's given/when/then

**Cleanup:**
1. Delete fixture file(s)
2. Delete generated artifacts

---

## §D Monitoring (e.g., Sentry, Plausible MCP, custom)

**Setup:**
1. Configure tool to point at test endpoint (not production)
2. Ensure test API key / credentials (not production)

**Action:**
1. Trigger test event (error, pageview, metric)
2. Wait for propagation (timeout 2 min — monitoring has ingestion delay)

**Verify:**
- [ ] Tool received the event
- [ ] Event format matches expected schema (check via tool's query API)
- [ ] Metadata (timestamp, source) correct
- [ ] Retention configured per profile

**Cleanup:**
1. Delete test event from monitoring dashboard (if possible via API)
2. Disconnect test configuration

---

## §E Deploy (DRY-RUN ONLY)

**⚠ Constraint:** Deploy tools могут быть destructive. Smoke test **только в dry-run mode**, если tool поддерживает. Если не поддерживает — **skip smoke** и mark `last_smoke_result: skipped` с reason "deploy tool, dry-run not supported — manual verification required".

**Setup:**
1. Ensure tool has `--dry-run` flag or equivalent
2. Provide minimal deployable artifact (or pointer)

**Action:**
1. Invoke tool with dry-run
2. Wait for completion

**Verify:**
- [ ] Tool's plan output showed expected steps (target env, resources)
- [ ] No actual deployment happened
- [ ] Exit code 0 for successful plan
- [ ] Output parseable (for later contract verification)

**Cleanup:**
- Nothing to clean (dry-run only)

---

## §F Infrastructure (MCP servers, adapters, scanners)

**Setup:**
1. For MCP: ensure MCP server running and configured
2. For adapter: prepare minimal input matching contract

**Action:**
1. For MCP: invoke simple tool call (list_tools, or minimal tool invocation)
2. For adapter: feed input, capture transformation output

**Verify:**
- [ ] Response received within 30 seconds
- [ ] Response matches expected schema
- [ ] No errors
- [ ] For MCP: tool list includes expected capabilities

**Cleanup:**
1. Disconnect MCP session (if created)
2. Delete temp input/output files

---

## §G Generic (fallback)

For tools that don't fit above categories, minimum smoke:

**Setup:**
1. Note tool version + install confirmation

**Action:**
1. Invoke tool's `--version` or equivalent health-check
2. If tool has built-in self-test — invoke it
3. Read 1 documented "hello world" example from tool's README and run it

**Verify:**
- [ ] Tool responds to health check
- [ ] Self-test (if exists) passes
- [ ] Hello world example produces expected output

**Cleanup:**
1. Remove any artifacts from example

**Mark confidence appropriately:**
- If only `--version` works — `last_smoke_result: partial` (tool alive, capabilities untested)
- If self-test passes — `last_smoke_result: pass`
- If hello world matches docs — `last_smoke_result: pass`

---

## Result recording

After test, update tool profile:

```yaml
# ~/.claude/integrator/tool-catalog/<tool>.yaml
tool:
  last_smoke_test: 2026-04-18T15:30:00Z
  last_smoke_result: pass | fail | skipped | partial
  smoke_test_protocol: "§A Spec Generation"      # which protocol applied
  smoke_test_notes: "All steps passed; cc-sdd 2.3.0 on node 20"

pmo_coverage:
  D2-Tech-02:
    last_verified: 2026-04-18                     # update verification date
    # confidence может быть upgraded: low → medium если smoke passed впервые
```

And update `.claude/integrator/pmo-mapping.yaml`:

```yaml
coverage:
  D2-Tech-02:
    last_smoke_test: 2026-04-18
    last_smoke_result: pass
```

## When smoke fails

- **First failure after prior pass:** mark `last_smoke_result: fail`, create journal entry, suggest `/integrator:debug <tool>`
- **Consistent failures (3+ in row):** automatic `effective_confidence` downgrade to `low`, warn in `/integrator:status`, require user action before further use

**Don't silently retry.** Single failure is data. Retry only after explicit fix или debug session.

## When smoke is skipped

Valid reasons for `last_smoke_result: skipped`:
- Deploy tool, dry-run not supported
- Tool requires network to production services not available in test env
- User explicitly disables smoke for this tool (rationale in journal)

**Invalid** reasons (don't do this):
- "Smoke takes too long"
- "Tool worked yesterday"
- "I trust the docs"

Skipped smoke → `confidence_source: declared` (не hybrid), warn в map display.

## Extensions (v1.1+)

- Automated smoke scheduler: weekly `/integrator:verify --light` через ScheduleWakeup
- Smoke history tracking (not just last result, rolling window)
- Cross-project smoke results aggregation via Memory MCP
- Fixture library for common smoke scenarios (shared via ecosystem repo)

---

**Anti-pattern to avoid:** "я посмотрел docs tool'а и очевидно что он работает, confidence high". Without actual smoke run — `confidence_source: declared`, not verified. Be honest в recording.
