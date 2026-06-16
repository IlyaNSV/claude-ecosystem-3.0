'use strict';
/**
 * Regression test for the Orchestrator audit zone (Session Audit blind-spot fix).
 *
 * Live-run RUN 01 (pilot c4546225) was the most valuable session in its batch — a first
 * live Orchestrator P3+P5 run that found a critical bug — yet the classifier tagged it
 * `D6-integrator / maintenance / shakedown` and the actionable channel nearly lost it.
 * Root cause: (1) no `orchestrator` zone in rubrics/, (2) the `Workflow` tool_use — the
 * core orchestrator action — was not captured by extractSignals.
 *
 * This test guards both: the zone exists + a Workflow-on-orchestrator session activates it.
 *
 * Node stdlib only; run with `node tests/audit/classify-orchestrator.test.cjs`
 * or `npm run test:audit`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const classify = require(path.join(REPO_ROOT, 'dev', 'meta-improvement', 'scripts', 'classify.js'));

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

console.log('orchestrator audit-zone classification');

const zones = classify.loadZones(REPO_ROOT);

test('orchestrator zone is registered in rubrics/', () => {
  const z = zones.find((x) => x.id === 'orchestrator');
  assert.ok(z, 'no zone with id "orchestrator" — rubrics/orchestrator.md missing');
  assert.ok(z.triggers.length > 0, 'orchestrator zone has no triggers');
  assert.ok(z.baseline.length > 0, 'orchestrator zone has no baseline');
});

test('extractSignals captures Workflow tool_use → workflow_scripts + flag', () => {
  const rec = {
    message: {
      role: 'assistant',
      content: [{
        type: 'tool_use',
        name: 'Workflow',
        input: { scriptPath: '.claude/orchestrator/processes/feature-to-tdd-impl.mjs', args: { feature: 'auth' } },
      }],
    },
  };
  const tmp = path.join(os.tmpdir(), `classify-orch-${process.pid}.jsonl`);
  fs.writeFileSync(tmp, JSON.stringify(rec) + '\n');
  try {
    const s = classify.extractSignals(tmp, { target_project: 'x' }, {});
    assert.deepStrictEqual(s.workflow_scripts, ['.claude/orchestrator/processes/feature-to-tdd-impl.mjs']);
    assert.strictEqual(s.flags.used_orchestrator_workflow, true);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('a Workflow-on-orchestrator session activates the orchestrator zone', () => {
  const signals = {
    slash_commands: [], subagent_types: [], written_paths: [], workflow_scripts: [],
    commit_types: [], commit_scopes: [],
    flags: { used_orchestrator_workflow: true, module_recently_shipped: false },
  };
  const cls = classify.classifyZones(signals, zones);
  const ids = cls.zones.map((z) => z.id);
  assert.ok(ids.includes('orchestrator'), `orchestrator not active; got [${ids.join(', ')}]`);
});

test('inline Workflow (no scriptPath) does NOT set the orchestrator flag', () => {
  const rec = {
    message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Workflow', input: { script: 'export const meta={}...' } }] },
  };
  const tmp = path.join(os.tmpdir(), `classify-orch-inline-${process.pid}.jsonl`);
  fs.writeFileSync(tmp, JSON.stringify(rec) + '\n');
  try {
    const s = classify.extractSignals(tmp, { target_project: 'x' }, {});
    assert.deepStrictEqual(s.workflow_scripts, []);
    assert.strictEqual(s.flags.used_orchestrator_workflow, false);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
