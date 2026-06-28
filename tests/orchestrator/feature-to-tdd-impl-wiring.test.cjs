'use strict';
/**
 * Static guard for the Orchestrator P5 `feature-to-tdd-impl` process wiring, focused on the
 * T5 remediation-discretion guardrails (DEC-DEV-0096) + the core per-task FSM invariants.
 *
 * The .mjs is a harness Workflow script (agent/phase/parallel/workflow globals + top-level
 * return) and cannot run standalone, so this asserts structural invariants at the source level
 * (same approach as validate-feature-impl-wiring.test.cjs). T5's risk is agent CONCURRENCY, so
 * the invariants here pin the *shape* of the discretion logic that a live run would exercise:
 *  - a BLOCK is CLASSIFIED before a debug round is spent (FB-LR-08);
 *  - a TRANSIENT block gets a bounded auto-retry that does NOT consume a debug round;
 *  - a cross-spec/design contradiction ESCALATES (recorded + tracked in conflicts), never
 *    self-resolved or auto-retried (FB-LR-07);
 *  - the implementer prompt forbids a unilateral resolution of a contradiction;
 *  - tasks run SEQUENTIALLY (single-writer git safety — for…of, not parallel());
 *  - remediation-guard.cjs is wired as the deterministic backbone;
 *  - the process returns the contract keys (incl. the new `conflicts`).
 *
 * Node stdlib only; run with `node tests/orchestrator/feature-to-tdd-impl-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const PROC = path.join(__dirname, '..', '..', 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'feature-to-tdd-impl.mjs'), 'utf8');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('orchestrator P5 — feature-to-tdd-impl wiring (T5 remediation discretion, DEC-DEV-0096)');

test('a BLOCK is classified before a debug round is spent (FB-LR-08)', () => {
  assert(/const classifyBlock\b/.test(SRC), 'no classifyBlock helper');
  assert(/REMEDIATION_GUARD\b/.test(SRC) && /remediation-guard\.cjs/.test(SRC), 'remediation-guard backbone not wired');
  // the discretion loop (which calls classifyBlock) must precede the debug-escalation loop
  const classifyIdx = SRC.indexOf('await classifyBlock(');
  const debugLoopIdx = SRC.indexOf('debugRounds < MAX_DEBUG_ROUNDS');
  assert(classifyIdx !== -1 && debugLoopIdx !== -1 && classifyIdx < debugLoopIdx,
    'the block-classification must run BEFORE the debug-escalation loop (else a transient burns a debug round)');
});

test('a TRANSIENT block gets a bounded auto-retry that does NOT consume a debug round (FB-LR-08)', () => {
  assert(/MAX_TRANSIENT_RETRIES\b/.test(SRC), 'no MAX_TRANSIENT_RETRIES bound');
  assert(/transientRetries\s*<\s*MAX_TRANSIENT_RETRIES/.test(SRC), 'transient retry not bounded by the cap');
  assert(/FB-LR-08/.test(SRC), 'FB-LR-08 (transient auto-retry) not referenced');
  // the transient branch re-probes env + re-implements, and is the SAME loop that classifies —
  // separate from (and before) the debugRounds loop, so no debug round is consumed by a retry.
  assert(/env-recheck:/.test(SRC), 'transient retry does not re-probe env before retrying');
  assert(/transientRetries\s*\+=\s*1/.test(SRC), 'transient retry counter not incremented');
});

test('a cross-spec/design contradiction ESCALATES, never self-resolved or retried (FB-LR-07)', () => {
  assert(/'cross-spec-conflict'/.test(SRC) && /'design-contradiction'/.test(SRC), 'escalation classes not present');
  assert(/escalatedConflict/.test(SRC), 'no escalation branch');
  assert(/conflicts\.push/.test(SRC), 'escalated conflicts are not tracked');
  assert(/FB-LR-07/.test(SRC), 'FB-LR-07 (no unilateral resolution) not referenced');
  // an escalated conflict must break out and skip the task (no debug, no retry)
  const escalateIdx = SRC.indexOf('escalatedConflict = true');
  assert(escalateIdx !== -1, 'escalation does not set the skip flag');
  assert(/if \(escalatedConflict\) \{[\s\S]{0,80}continue/.test(SRC), 'an escalated conflict must skip the task (continue), not fall into debug');
});

test('the implementer prompt forbids a unilateral resolution of a contradiction (FB-LR-07)', () => {
  assert(/NEVER resolve a cross-spec\/requirement contradiction or a design self-contradiction yourself/.test(SRC),
    'implementer prompt does not forbid unilateral contradiction resolution');
  assert(/IMPL_SCHEMA[\s\S]*block_class/.test(SRC), 'IMPL_SCHEMA does not carry block_class for self-escalation');
});

test('tasks run SEQUENTIALLY — single-writer git safety (for…of, not parallel())', () => {
  assert(/for \(const task of tasks\)/.test(SRC), 'tasks not iterated sequentially');
  // the per-task body must NOT fan tasks out via parallel() (which would race the git index)
  assert(!/parallel\(\s*tasks\.map/.test(SRC), 'tasks must not be dispatched via parallel() — single-writer (FB-004)');
});

test('the classifier is conservative: an unmatched class defaults to content (no auto-retry)', () => {
  // classifyBlock resolves to 'content' when neither the lib nor the agent matched — never a retry
  assert(/\|\|\s*'content'\)/.test(SRC), 'classifyBlock does not default to content (conservative)');
});

test('returns the P5 contract keys incl. conflicts + findings', () => {
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  for (const key of ['feature', 'implemented', 'blocked', 'concerns', 'conflicts', 'findings', 'go_gate', 'readiness']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(m[0]), `return object missing key: ${key}`);
  }
});

test('the envelope surfaces the P6 gate conflicts + findings, not just impl-time ones (DEC-DEV-0104, FB-LR-19)', () => {
  // P5 must CAPTURE p6.conflicts off the gate result (was: only result/readiness/findings read → escalations invisible)
  assert(/conflicts:\s*\(p6 && p6\.conflicts\)\s*\|\|\s*\[\]/.test(SRC),
    'P5 does not capture p6.conflicts from the gate result');
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  // the return MERGES impl-time conflicts with the gate's (concat), not impl-time only
  assert(/conflicts:\s*conflicts\.concat\(\s*\(go && go\.conflicts\)/.test(m[0]),
    'P5 return does not merge the gate conflicts into the envelope (FB-LR-19)');
  // and surfaces the gate findings in the envelope (was captured in `go` but dropped at return)
  assert(/findings:\s*\(go && go\.findings\)\s*\|\|\s*\[\]/.test(m[0]),
    'P5 return does not surface the gate findings in the envelope (FB-LR-19)');
  assert(/FB-LR-19/.test(SRC), 'DEC-DEV-0104 / FB-LR-19 not referenced in the source');
});

test('PA-writes target the canonical worktree-shared file + commit-zone advisory (FB-LR-23)', () => {
  // parallel git worktrees share one .git → a worktree-local pending-actions.md lets PA-ids collide.
  assert(/FB-LR-23/.test(SRC), 'FB-LR-23 parallel-worktree guard not referenced');
  assert(/const PA_CANON\b/.test(SRC), 'no PA_CANON canonical-pending-actions instruction');
  assert(/git worktree list --porcelain/.test(SRC), 'PA_CANON does not resolve the canonical file via git worktree list');
  // 1 declaration + 2 uses (block + concern) = 3 occurrences
  const uses = (SRC.match(/\bPA_CANON\b/g) || []).length;
  assert(uses >= 3, `both PA-emitting prompts (block + concern) must include PA_CANON (decl + 2 uses; found ${uses})`);
  // the block-commit carries the commit-zone advisory (shared-worktree .git → explicit-path is the isolation)
  assert(/shared-worktree \.git/.test(SRC), 'recordBlock lacks the FB-LR-23 commit-zone advisory');
});

test('keeps the prior P5 guards (FB-001 args, FB-002 empty feature, P6 delegation by scriptPath)', () => {
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
  assert(/!FEATURE/.test(SRC) && /FB-002/.test(SRC), 'FB-002 empty-feature guard missing');
  assert(/workflow\(\s*\{\s*scriptPath:\s*['"][^'"]*validate-feature-impl\.mjs['"]/.test(SRC),
    'P5 must still delegate to P6 by scriptPath (DEC-DEV-0091)');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
