'use strict';
/**
 * complete-feature wiring test — Wave B / B-b (DEC-DEV-0142).
 *
 * Static wiring checks over the wave-runner + its dispatch command, in the orchestrator
 * wiring-test style (validate-feature-impl-wiring et al.): read the sources, assert the
 * load-bearing contracts are PRESENT IN THE TEXT. Behavior is validated live (B-d pilot
 * calibration); this guards against a refactor silently dropping a rail.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RUNNER = path.join(ROOT, 'product', 'processes', 'complete-feature.mjs');
const COMMAND = path.join(ROOT, 'commands', 'product', 'complete.md');
const P6 = path.join(ROOT, 'orchestrator', 'processes', 'validate-feature-impl.mjs');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
  passed += 1;
}

const runner = fs.readFileSync(RUNNER, 'utf-8');
const command = fs.readFileSync(COMMAND, 'utf-8');

console.log('complete-feature wiring — Wave B B-b');

test('meta header: single-line export, name complete-feature, all five phases', () => {
  assert(/^export const meta = \{/.test(runner), 'line-1 export const meta missing (smoke dialect contract)');
  assert(runner.includes("name: 'complete-feature'"), 'meta.name drifted');
  for (const p of ['Score', 'Surface', 'Resolve', 'Escalate', 'CloseOut']) {
    assert(runner.includes(`{ title: '${p}' }`), `meta phase ${p} missing`);
  }
});

test('FB-001: stringified-args guard, not bare args || {}', () => {
  assert(runner.includes("typeof args === 'string' ? JSON.parse(args) : args"), 'FB-001 args guard missing');
});

test('FB-002: an empty feature id is refused with a well-formed error report, never scanned/guessed', () => {
  assert(runner.includes('if (!FEATURE)'), 'empty-feature guard missing');
  assert(/error: 'complete-feature: empty feature id/.test(runner), 'error report shape missing');
});

test('SCORE: the completeness-oracle is the external stop-signal, relayed VERBATIM', () => {
  assert(runner.includes('completeness-oracle.cjs'), 'oracle path missing');
  assert(/Return its JSON output VERBATIM/.test(runner), 'verbatim-relay instruction missing');
});

test('CLASSIFY: gap-classifier.cjs is the stop authority; its stop.fire is honored in code', () => {
  assert(runner.includes('gap-classifier.cjs'), 'classifier path missing');
  assert(runner.includes('stopVerdict.fire'), 'classifier stop verdict not honored');
  assert(/the LLM is only transport|agent is TRANSPORT only|You are the TRANSPORT/i.test(runner), 'transport-only framing missing');
});

test('rail 2: in-code termination mirrors — for-bound hard cap + met-check + delta-convergence', () => {
  assert(runner.includes('wave <= MAX_WAVES'), 'for-bound hard cap missing');
  assert(runner.includes('oracle.met === true && resolvedLastWave === 0'), 'pre-SURFACE met mirror missing');
  assert(runner.includes('Math.abs(oracle.score - prevScore) < EPSILON'), 'delta-convergence mirror missing');
});

test('SURFACE: canonical persona agentType, crash-safe slot, bounded re-spawn, never general-purpose', () => {
  assert(runner.includes('agentType: p.name'), 'canonical agentType spawn missing');
  assert(/try \{ r = await spawnPersona\(p\) \} catch/.test(runner), 'crash-safe try/catch slot missing (persona throw would null the parallel slot)');
  assert(/never general-purpose/i.test(runner), 'no-general-purpose-fallback rail missing');
  assert(!/agentType:\s*'general-purpose'/.test(runner), 'a general-purpose fallback spawn crept in');
});

test('SURFACE: ux-advisor is gated on oracle.has_ui; findings persisted by a dedicated writer step (advisors are read-only)', () => {
  assert(runner.includes('oracle.has_ui === true'), 'has_ui gate for ux-advisor missing');
  assert(runner.includes('persist-findings:wave'), 'writer-step label missing');
  assert(/advisors are read-only/i.test(runner), 'read-only-advisors rationale missing');
});

test('RESOLVE: conservative in-code whitelist guard + verify-before-act + sequential single-writer', () => {
  assert(runner.includes('RESOLVABLE_KINDS.includes(r.category)'), 'whitelist re-filter missing');
  assert(runner.includes('misclassified'), 'misclassified fold-into-decisions missing');
  assert(/VERIFY-BEFORE-ACT/.test(runner), 'verify-before-act instruction missing (DEC-DEV-0093)');
  assert(/for \(const g of toResolve\)/.test(runner), 'sequential single-writer resolve loop missing');
});

test('ESCALATE: PA_CANON verbatim from the orchestrator processes (FB-LR-23) + PA-dedup', () => {
  const canonMatch = /const PA_CANON = ('CANONICAL[\s\S]*?)\n\n/.exec(runner);
  assert(canonMatch, 'PA_CANON const missing');
  assert(runner.includes('FB-LR-23'), 'FB-LR-23 reference missing');
  const p6 = fs.readFileSync(P6, 'utf-8');
  const firstLine = "'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '";
  assert(runner.includes(firstLine) && p6.includes(firstLine), 'PA_CANON opening line does not match the P6 source verbatim');
  assert(/UPDATE it in place \(do NOT append a duplicate, DEC-DEV-0089\)/.test(runner), 'PA-dedup instruction missing');
});

test('rail 5: the completion report carries honest_unmet + delegated_unverified + personas_incomplete', () => {
  for (const key of ['honest_unmet', 'delegated_unverified', 'personas_incomplete', 'blockers_failing', 'dry_run']) {
    assert(runner.includes(`${key}:`), `report key ${key} missing from the return envelope`);
  }
  assert(/never round a partial spec up/i.test(runner), 'honest-unmet no-round-up wording missing');
});

test('B-c CloseOut: advisory B5/B6/B8 delegates run on stop and NEVER flip met', () => {
  assert(runner.includes('bg-review.md'), 'B5 bg-review close-out missing');
  assert(runner.includes('validate.md'), 'B6/B8 validate close-out missing');
  assert(/never flips met|NEVER flips met|does NOT flip met/i.test(runner), 'advisory-only (no met flip) contract missing');
});

test('final re-score: state-based guard (resolved since the last SCORE), not status-based', () => {
  assert(runner.includes('resolvedAfterLastScore = resolvedThisWave'), 'resolvedAfterLastScore tracking missing');
  assert(runner.includes('!DRY_RUN && resolvedAfterLastScore > 0'), 'state-based re-score guard missing');
});

test('/product:complete dispatches the deployed runner by scriptPath + keeps an honest inline fallback', () => {
  assert(command.includes(".claude/product/processes/complete-feature.mjs"), 'scriptPath dispatch missing from the command');
  assert(/fall back to executing[\s\S]*completeness-loop\.md[\s\S]*prose inline/i.test(command), 'honest inline-fallback clause missing');
  assert(/pass `args` as an OBJECT/i.test(command), 'args-as-object warning missing (FB-001 companion)');
});

console.log(`\n${passed} assertions passed.`);
