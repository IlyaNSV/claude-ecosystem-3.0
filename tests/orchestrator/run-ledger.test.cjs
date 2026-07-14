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
  assert.deepStrictEqual(summarizeResult(null), {
    verdict: null, result: null, readiness: null, readiness_reasons: null,
    conflicts: 0, counts: null, outcome_key: null, unread_outcome_keys: [],
  });
});

// ---------------------------------------------------------------------------
// DEC-DEV-0200 — the ledger must not LOSE the outcome.
//
// These fixtures are the REAL return shapes, lifted from the process `return {…}`
// blocks (and, for P7, from the live 2026-07-14 run.json whose backend boot actually
// FAILED). The old suite tested an INVENTED shape ({result, readiness, conflicts,
// counts}) that NO process returns — `counts` does not exist anywhere in
// orchestrator/processes/. That is precisely why the defect survived: the ledger's
// units agreed with the ledger, and nobody reconciled either with the processes.
// ---------------------------------------------------------------------------

/** P7 runtime-smoke-readiness — the live run: readiness READY, but the boot FAILED. */
const P7_LIVE_FAILED_BOOT = {
  feature: 'FM-002', app: 'backend',
  verdict: 'READY_TO_SMOKE',          // the READINESS verdict — NOT the outcome
  p7_result: 'FAILS_TO_START',        // the OUTCOME (NestJS DI error on live boot)
  smoke_attemptable: true,
  smoke: { result: 'FAILS_TO_START', started: false, failure_class: 'env-not-loaded' },
  requests: [], disclosures: [],
  readiness: 'READY',
  readiness_reasons: ['env-probe: all used substrates up'],
};

test('P7 real shape: a FAILED boot is NOT summarized as null (the DEC-DEV-0200 regression)', () => {
  const s = summarizeResult(P7_LIVE_FAILED_BOOT);
  assert.strictEqual(s.result, 'FAILS_TO_START',
    'the live boot FAILED — a ledger that writes null here greens a failure (SUBSTRATE_GRADUATION_GATE component 2)');
  assert.strictEqual(s.outcome_key, 'p7_result', 'provenance: the outcome was read from p7_result');
  assert.strictEqual(s.verdict, 'READY_TO_SMOKE', 'the readiness verdict keeps its own column — it is not the outcome');
  assert.deepStrictEqual(s.unread_outcome_keys, [], 'nothing outcome-shaped left unread');
});

test('readiness_reasons are carried (the PR #190 promise: auditable from run.json alone)', () => {
  const s = summarizeResult(P7_LIVE_FAILED_BOOT);
  assert.deepStrictEqual(s.readiness_reasons, ['env-probe: all used substrates up']);
  // deploy-to-stage makes the same promise in-code
  const dep = summarizeResult({ result: 'BLOCKED', readiness: 'DEGRADED', readiness_reasons: ['redis: down'], flipped: false });
  assert.deepStrictEqual(dep.readiness_reasons, ['redis: down']);
  // a process that gives none ⇒ null (honest: "not disclosed", not a fake empty list)
  assert.strictEqual(summarizeResult({ result: 'ROLLED_BACK', readiness: 'READY' }).readiness_reasons, null);
});

test('P5 real shape: the gate verdict lives under go_gate — it was ALSO being lost', () => {
  // feature-to-tdd-impl has NO top-level `result` at all. Before the fix its summary was
  // {verdict: null, result: null} — so impl-evidence.cjs::collectRunsEvidence, which claims
  // to find "the LATEST gate verdict across P5/P6-class gate runs", could never see a P5 run.
  const s = summarizeResult({
    feature: 'FM-002', implemented: ['1.1', '1.2'], blocked: [], concerns: [],
    conflicts: [], findings: [], go_gate: 'NO-GO', readiness: 'READY', autonomy: null,
  });
  assert.strictEqual(s.result, 'NO-GO', 'P5 outcome must be read from go_gate');
  assert.strictEqual(s.verdict, 'NO-GO', 'and it must reach the verdict column impl-evidence gates on');
  assert.strictEqual(s.outcome_key, 'go_gate');
});

test('backward-compat: deploy-to-stage / rollback-release / P6 summarize exactly as before', () => {
  const deploy = summarizeResult({
    feature: 'FM-002', capability: 'api', env_tier: 'staging', result: 'DEPLOY_FAILED',
    readiness: 'READY', readiness_reasons: [], flipped: true, release: 'releases/20260714',
    healthcheck: { healthy: false, failure_class: 'env-not-loaded' }, disclosures: [],
  });
  assert.strictEqual(deploy.verdict, 'DEPLOY_FAILED', 'no `verdict` key ⇒ falls back to result (unchanged)');
  assert.strictEqual(deploy.result, 'DEPLOY_FAILED');
  assert.strictEqual(deploy.readiness, 'READY');
  assert.strictEqual(deploy.outcome_key, 'result');

  const rollback = summarizeResult({
    feature: 'FM-002', capability: 'api', env_tier: 'staging', result: 'NO_PRIOR_RELEASE',
    readiness: 'DEGRADED', restored_release: null, healthcheck: null, disclosures: ['nothing to revert to'],
  });
  assert.strictEqual(rollback.result, 'NO_PRIOR_RELEASE');
  assert.strictEqual(rollback.verdict, 'NO_PRIOR_RELEASE');
  assert.strictEqual(rollback.readiness, 'DEGRADED');

  // P6 carries BOTH `result` and its `go_gate` alias — `result` wins, as before.
  const p6 = summarizeResult({ feature: 'FM-002', mechanical: true, result: 'GO', go_gate: 'GO', readiness: 'READY', conflicts: [] });
  assert.strictEqual(p6.result, 'GO');
  assert.strictEqual(p6.outcome_key, 'result');
  assert.strictEqual(p6.conflicts, 0);
});

test('a nested `verdict` object: readiness AND outcome are found one level down', () => {
  // The wrapped-envelope row seen in the ledger: top-level readiness was null while
  // verdict.readiness said DEGRADED. The summary used to read null straight over it.
  const s = summarizeResult({ verdict: { verdict: 'READY_TO_SMOKE', readiness: 'DEGRADED', p7_result: 'STARTS' } });
  assert.strictEqual(s.readiness, 'DEGRADED', 'nested verdict.readiness must be found');
  assert.strictEqual(s.result, 'STARTS', 'nested outcome must be found too');
  assert.strictEqual(s.outcome_key, 'verdict.p7_result', 'provenance discloses that it came from one level down');
});

test('no outcome at all (P4-class) stays null — but DISTINGUISHABLE from an unread one', () => {
  // audit-spec-fidelity genuinely returns no scalar outcome: null is CORRECT, nothing was lost.
  const p4 = summarizeResult({ audited: ['FM-002'], faithful: ['FM-002'], residual: [], impl_ready: ['FM-002'] });
  assert.strictEqual(p4.result, null);
  assert.strictEqual(p4.outcome_key, null, 'null key ⇒ the process returned no outcome');
  assert.deepStrictEqual(p4.unread_outcome_keys, [], 'and nothing outcome-shaped was ignored');

  // vs. a process that DID give an outcome under a key the ledger does not know: the ledger
  // must SAY SO. This is the disclosure that would have exposed p7_result on day one.
  const future = summarizeResult({ p8_result: 'EXPLODED', readiness: 'READY' });
  assert.strictEqual(future.result, null, 'we do not guess a value we have no contract for');
  assert.deepStrictEqual(future.unread_outcome_keys, ['p8_result'],
    'an outcome-shaped key the ledger cannot read must be disclosed, not silently dropped');
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

test('finish end-to-end: a FAILED boot reaches run.json AND ledger.ndjson (not null)', () => {
  const base = mkTmp();
  const startIso = '2026-07-14T09:00:00.000Z';
  const s = startRun({ process: 'runtime-smoke-readiness', iso: startIso, argsSummary: '--feature FM-002', baseRoot: base });
  const f = finishRun({ runId: s.runId, iso: '2026-07-14T09:03:00.000Z', baseRoot: base, result: P7_LIVE_FAILED_BOOT });

  const rec = JSON.parse(fs.readFileSync(f.runJson, 'utf8'));
  assert.strictEqual(rec.result_summary.result, 'FAILS_TO_START', 'run.json must carry the failed boot');
  assert.strictEqual(rec.result_summary.outcome_key, 'p7_result');
  assert.deepStrictEqual(rec.result_summary.readiness_reasons, ['env-probe: all used substrates up'],
    'the §3.2 gate must be auditable from run.json ALONE (PR #190 promise)');

  const line = JSON.parse(fs.readFileSync(path.join(base, 'ledger.ndjson'), 'utf8').trim().split('\n')[0]);
  assert.strictEqual(line.result, 'FAILS_TO_START', 'the greppable ndjson row must carry it too');
  assert.strictEqual(line.readiness, 'READY');
  assert.strictEqual(line.outcome_key, 'p7_result');
  assert.ok(!('unread_outcome_keys' in line), 'the alarm key is absent when there is nothing to disclose');
});

test('finish: an unknown outcome key raises the alarm ON the ndjson row', () => {
  const base = mkTmp();
  const s = startRun({ process: 'future-process', iso: '2026-07-14T10:00:00.000Z', baseRoot: base });
  finishRun({ runId: s.runId, iso: '2026-07-14T10:01:00.000Z', baseRoot: base, result: { p8_result: 'EXPLODED' } });
  const line = JSON.parse(fs.readFileSync(path.join(base, 'ledger.ndjson'), 'utf8').trim().split('\n')[0]);
  assert.deepStrictEqual(line.unread_outcome_keys, ['p8_result'],
    'a row that may be under-reporting its run must say so where people grep');
});

// ---------------------------------------------------------------------------
// THE GUARD (DEC-DEV-0200). The defect class, not the defect: the ledger summarized
// results whose SHAPE nobody had ever reconciled with what the processes actually
// return. This test reconciles them MECHANICALLY — it reads the real process sources
// and fails if any of them returns an outcome-shaped key the ledger does not read.
// Add a process that returns `p8_result` and this goes red at `npm run verify`,
// instead of quietly writing null into the trace for months.
// ---------------------------------------------------------------------------

const PROCESS_DIR = path.join(__dirname, '..', '..', 'orchestrator', 'processes');

/**
 * Depth-1 keys of every `return { … }` block in a process source. Two INDEPENDENT
 * passes, unioned, because a miss here means the guard goes blind (the failure mode
 * that lets a mis-key through), while an over-report merely makes it shout:
 *   1. brace-matched walk — catches `result: x`, misses comment-mangled shorthand;
 *   2. line-anchored regex — catches shorthand (`p7_result,`) the walk can miss.
 */
function returnBlockKeys(source) {
  const text = String(source).replace(/\r\n/g, '\n');
  const keys = new Set();
  let blocks = 0;
  const re = /\breturn\s*\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue;
    blocks += 1;
    const body = text.slice(open + 1, end);

    let d = 0;
    let buf = '';
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      if (c === '{' || c === '[' || c === '(') { d += 1; buf = ''; continue; }
      if (c === '}' || c === ']' || c === ')') { d -= 1; buf = ''; continue; }
      if (d !== 0) continue;
      if (c === ':') {
        const k = buf.trim().split(/\s+/).pop();
        if (/^[A-Za-z_$][\w$]*$/.test(k)) keys.add(k);
        buf = '';
      } else if (c === ',') { buf = ''; } else { buf += c; }
    }
    // pass 2 — shorthand or explicit, anchored at the start of an indented line
    const shorthand = /^[ \t]+((?:\w+_)?(?:result|gate|verdict))[ \t]*[,:]/gm;
    let sm;
    while ((sm = shorthand.exec(body)) !== null) keys.add(sm[1]);
  }
  return { keys: [...keys], blocks };
}

test('GUARD: every outcome-shaped key the processes RETURN is one the ledger READS', () => {
  const files = fs.readdirSync(PROCESS_DIR).filter((f) => f.endsWith('.mjs'));
  assert.ok(files.length >= 8, `expected the 8 orchestrator processes, found ${files.length}`);

  const offenders = [];
  for (const file of files) {
    const { keys, blocks } = returnBlockKeys(fs.readFileSync(path.join(PROCESS_DIR, file), 'utf8'));
    // Fail LOUD on blindness: no parsed return block ⇒ the .mjs house style changed and this
    // guard is no longer looking at anything. "Cannot see" must never read as "nothing there".
    assert.ok(blocks > 0, `${file}: parsed 0 return blocks — the guard went BLIND, fix the parser`);
    for (const k of keys) {
      if (lib.OUTCOME_SHAPED_KEY.test(k) && !lib.READ_OUTCOME_KEYS.has(k)) offenders.push(`${file} → ${k}`);
    }
  }
  assert.deepStrictEqual(offenders, [],
    'a process returns its outcome under a key run-ledger does not read — it would be summarized as null.\n'
    + `      Add the key to OUTCOME_KEYS in orchestrator/lib/run-ledger.cjs. Offenders: ${offenders.join(', ')}`);
});

test('GUARD is not vacuous: it CATCHES a mis-keyed outcome (the p7_result defect, reproduced)', () => {
  // Feed the guard's own parser the shape that shipped the bug — a process returning its
  // outcome under an unknown key. If this does not trip, the guard above proves nothing.
  const { keys, blocks } = returnBlockKeys([
    'const x = 1',
    'return {',
    "  feature: FEATURE || null,",
    "  p8_result: outcome,        // shorthand-adjacent, comma in a comment, still must be seen",
    '  readiness,',
    '}',
  ].join('\n'));
  assert.strictEqual(blocks, 1, 'the parser must find the return block');
  assert.ok(keys.includes('p8_result'), `parser missed the mis-keyed outcome (saw: ${keys.join(', ')})`);
  const caught = keys.filter((k) => lib.OUTCOME_SHAPED_KEY.test(k) && !lib.READ_OUTCOME_KEYS.has(k));
  assert.deepStrictEqual(caught, ['p8_result'], 'the guard must flag an outcome key the ledger cannot read');
});

test('GUARD: the ledger reads exactly the keys the processes use today (contract snapshot)', () => {
  // Pins the CURRENT contract so a silent widening/narrowing of OUTCOME_KEYS is a red test.
  assert.deepStrictEqual(lib.OUTCOME_KEYS, ['result', 'p7_result', 'go_gate'],
    'OUTCOME_KEYS changed — is a process actually returning the new key? (update the guard + DEV_JOURNAL)');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
