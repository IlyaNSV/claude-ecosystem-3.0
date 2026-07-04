'use strict';
/**
 * Unit test for the Orchestrator run-ledger lib (VC-087 observability + VC-134
 * trace-leg). Exercises BOTH the pure helpers (deriveRunId / extractModelMap /
 * durationMs / summarizeResult) and the FS-facing start / finish against a real
 * temp-dir (the ledger is a small, deterministic FS side-effect — unlike the
 * env/capability probes there is no child_process, so the FS path IS unit-tested).
 *
 * Key contracts covered:
 *   - start: creates runs/<id>/run.json (status: running); id is DETERMINISTIC from
 *     the passed timestamp (no Math.random).
 *   - finish: stamps duration_ms + status: finished, extracts the model_map from a
 *     fixture .mjs (incl. an agentType/persona ⇒ via-agent-definition case), appends
 *     ONE compact ledger.ndjson line.
 *   - finish-without-start ⇒ status: finished-unstarted (still a durable trace).
 *   - a re-run of finish does NOT duplicate the ndjson line (idempotent by run_id).
 *
 * Node stdlib only; run with `node tests/orchestrator/run-ledger.test.cjs`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lib = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'run-ledger.cjs'));
const {
  deriveRunId, durationMs, extractModelMap, summarizeResult,
  startRun, finishRun, STATUS,
} = lib;

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

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run-ledger-'));
}

// A mini Workflow-dialect fixture with 3 agent() opts lines: two pin model:, one
// pins agentType: (a canonical persona) with NO model → via-agent-definition. The
// third label is a template literal (impl:${task.id}) to prove the static template
// key is captured verbatim.
const FIXTURE_MJS = `export const meta = { goal: 'fixture' }
const plan = await agent('do the plan', { model: 'sonnet', schema: PLAN_SCHEMA, phase: 'Plan', label: 'plan' })
const impl = await agent('implement', { model: 'opus', schema: IMPL_SCHEMA, phase: 'Impl', label: \`impl:\${task.id}\` })
const qa = await agent('qa persona review', { agentType: 'qa-advisor', phase: 'Review', label: 'qa-review' })
const badge = { label: 'not-an-agent-line' }   // a schema-ish line; label present but NOT an agent() opts (no model/agentType)
`;

console.log('orchestrator run-ledger — observability ledger (VC-087 / VC-134)');

test('exports the contract surface', () => {
  for (const fn of ['deriveRunId', 'durationMs', 'extractModelMap', 'summarizeResult', 'startRun', 'finishRun']) {
    assert.strictEqual(typeof lib[fn], 'function', `${fn} missing`);
  }
  assert.deepStrictEqual(
    { ...STATUS },
    { RUNNING: 'running', FINISHED: 'finished', FINISHED_UNSTARTED: 'finished-unstarted' },
    'status enum drifted',
  );
});

test('deriveRunId is deterministic from the timestamp (no Math.random)', () => {
  const iso = '2026-07-04T12:34:56.789Z';
  const a = deriveRunId('batch-features-to-cc-sdd', iso);
  const b = deriveRunId('batch-features-to-cc-sdd', iso);
  assert.strictEqual(a, b, 'same (process, timestamp) must yield the same id');
  assert.ok(a.startsWith('2026-07-04-batch-features-to-cc-sdd-'), `unexpected id shape: ${a}`);
  // suffix = base36(epoch-ms) sliced to 6 — recompute independently
  const expectSuffix = Math.abs(Date.parse(iso)).toString(36).slice(-6);
  assert.ok(a.endsWith(`-${expectSuffix}`), `suffix not timestamp-derived: ${a} (want …-${expectSuffix})`);
});

test('deriveRunId slugifies a messy process name to ASCII/dash', () => {
  const id = deriveRunId('Weird Name!! v2', '2026-07-04T00:00:00.000Z');
  assert.ok(/^\d{4}-\d{2}-\d{2}-weird-name-v2-[a-z0-9]+$/.test(id), `bad slug: ${id}`);
});

test('durationMs: ordered pair → positive; missing/negative → null', () => {
  assert.strictEqual(durationMs('2026-07-04T00:00:00.000Z', '2026-07-04T00:00:01.500Z'), 1500);
  assert.strictEqual(durationMs(null, '2026-07-04T00:00:01.000Z'), null);
  assert.strictEqual(durationMs('2026-07-04T00:00:05.000Z', '2026-07-04T00:00:01.000Z'), null, 'negative must be null');
});

test('extractModelMap: pulls label→model + persona ⇒ via-agent-definition; ignores non-agent label line', () => {
  const map = extractModelMap(FIXTURE_MJS);
  assert.strictEqual(map.plan, 'sonnet');
  assert.strictEqual(map['impl:${task.id}'], 'opus', 'template-literal label key must be captured verbatim');
  assert.strictEqual(map['qa-review'], 'via-agent-definition', 'agentType persona must map to via-agent-definition');
  assert.ok(!('not-an-agent-line' in map), 'a label line without model/agentType must be ignored');
});

test('summarizeResult: opportunistic pull, tolerant of odd shapes', () => {
  const s = summarizeResult({ result: 'GO', readiness: 'READY', conflicts: [1, 2], counts: { specced: 3 } });
  assert.strictEqual(s.verdict, 'GO', 'verdict falls back to result');
  assert.strictEqual(s.result, 'GO');
  assert.strictEqual(s.readiness, 'READY');
  assert.strictEqual(s.conflicts, 2, 'conflicts array → length');
  assert.deepStrictEqual(s.counts, { specced: 3 });
  assert.deepStrictEqual(summarizeResult(null), { verdict: null, result: null, readiness: null, conflicts: 0, counts: null });
});

test('startRun: creates runs/<id>/run.json with status running', () => {
  const base = mkTmp();
  const iso = '2026-07-04T09:00:00.000Z';
  const r = startRun({ process: 'validate-feature-impl', iso, argsSummary: '--feature auth', baseRoot: base });
  assert.ok(fs.existsSync(r.dir), 'run dir not created');
  const rec = JSON.parse(fs.readFileSync(r.runJson, 'utf8'));
  assert.strictEqual(rec.status, 'running');
  assert.strictEqual(rec.process, 'validate-feature-impl');
  assert.strictEqual(rec.started_at, iso);
  assert.strictEqual(rec.args_summary, '--feature auth');
  assert.strictEqual(rec.finished_at, null);
  assert.strictEqual(r.runId, deriveRunId('validate-feature-impl', iso));
});

test('finish after start: duration, status finished, model_map, ONE ndjson line', () => {
  const base = mkTmp();
  const startIso = '2026-07-04T09:00:00.000Z';
  const finishIso = '2026-07-04T09:00:12.000Z';
  const s = startRun({ process: 'feature-to-tdd-impl', iso: startIso, argsSummary: '--feature auth', baseRoot: base });

  // write the fixture process source somewhere for the model-map extraction
  const procPath = path.join(base, 'fixture.mjs');
  fs.writeFileSync(procPath, FIXTURE_MJS);

  const f = finishRun({
    runId: s.runId, iso: finishIso, baseRoot: base, processPath: procPath,
    result: { result: 'GO', readiness: 'READY', conflicts: [], counts: { implemented: 5 } },
  });
  assert.strictEqual(f.status, STATUS.FINISHED);
  assert.strictEqual(f.ledgerAppended, true);

  const rec = JSON.parse(fs.readFileSync(f.runJson, 'utf8'));
  assert.strictEqual(rec.status, 'finished');
  assert.strictEqual(rec.duration_ms, 12000, 'duration = finish - start');
  assert.strictEqual(rec.finished_at, finishIso);
  assert.strictEqual(rec.args_summary, '--feature auth', 'args_summary carried from start');
  assert.strictEqual(rec.model_map.plan, 'sonnet');
  assert.strictEqual(rec.model_map['qa-review'], 'via-agent-definition');
  assert.strictEqual(rec.result_summary.result, 'GO');

  const ndjson = fs.readFileSync(path.join(base, 'ledger.ndjson'), 'utf8').trim().split('\n').filter(Boolean);
  assert.strictEqual(ndjson.length, 1, 'exactly one ledger line');
  const line = JSON.parse(ndjson[0]);
  assert.strictEqual(line.run_id, s.runId);
  assert.strictEqual(line.duration_ms, 12000);
  assert.strictEqual(line.result, 'GO');
  assert.deepStrictEqual(line.counts, { implemented: 5 });
});

test('finish WITHOUT start ⇒ status finished-unstarted, still a durable trace', () => {
  const base = mkTmp();
  const runId = deriveRunId('audit-spec-fidelity', '2026-07-04T10:00:00.000Z');
  const f = finishRun({
    runId, iso: '2026-07-04T10:05:00.000Z', baseRoot: base,
    process: 'audit-spec-fidelity',
    result: { impl_ready: ['auth'] },
  });
  assert.strictEqual(f.status, STATUS.FINISHED_UNSTARTED);
  const rec = JSON.parse(fs.readFileSync(f.runJson, 'utf8'));
  assert.strictEqual(rec.status, 'finished-unstarted');
  assert.strictEqual(rec.started_at, null);
  assert.strictEqual(rec.duration_ms, null, 'no start ⇒ no duration');
  assert.strictEqual(rec.process, 'audit-spec-fidelity');
  assert.ok(fs.existsSync(path.join(base, 'ledger.ndjson')), 'unstarted finish still lands a ledger line');
});

test('re-run of finish does NOT duplicate the ndjson line (idempotent by run_id)', () => {
  const base = mkTmp();
  const startIso = '2026-07-04T09:00:00.000Z';
  const s = startRun({ process: 'validate-feature-impl', iso: startIso, baseRoot: base });
  const doFinish = (iso) => finishRun({
    runId: s.runId, iso, baseRoot: base,
    result: { result: 'GO' },
  });
  const first = doFinish('2026-07-04T09:00:10.000Z');
  const second = doFinish('2026-07-04T09:00:20.000Z');
  assert.strictEqual(first.ledgerAppended, true);
  assert.strictEqual(second.ledgerAppended, false, 'second finish must not append a duplicate');

  const ndjson = fs.readFileSync(path.join(base, 'ledger.ndjson'), 'utf8').trim().split('\n').filter(Boolean);
  assert.strictEqual(ndjson.length, 1, 'ndjson must hold exactly one line for the run_id');
  // run.json itself is last-write-wins (mutable record) — it reflects the SECOND finish
  const rec = JSON.parse(fs.readFileSync(s.runJson, 'utf8'));
  assert.strictEqual(rec.finished_at, '2026-07-04T09:00:20.000Z', 'run.json is last-write-wins');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
