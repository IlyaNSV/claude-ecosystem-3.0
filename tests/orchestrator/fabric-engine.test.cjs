'use strict';
/**
 * fabric-engine.test.cjs — units for the Process Fabric interpreter (DEC-DEV-0153;
 * CONCEPT dev/process-fabric/CONCEPT.md §9). Exercises BOTH the pure core (require) and
 * the FS-facing CLI (child_process against a real temp-dir), like run-ledger.test.cjs.
 *
 * Contract covered (CONCEPT §9 p.3):
 *   - transition determinism (same inputs → deepStrictEqual outputs);
 *   - full happy path of one instance (init → line.start → P3→P4→P5(GO)→P7 → done);
 *   - bounded remediation (2 no_go rounds → escalation on the third);
 *   - wip-guard (a second instance on the same lane is rejected and why[] explains);
 *   - ingest mapping across every result branch (P3–P7);
 *   - ingest idempotency (a seen run_id is a no-op);
 *   - floor non-crossability (operation_class=prod_deploy → human-gate under autonomy='auto');
 *   - replay == snapshot;
 *   - unknown event → rejected, never throws;
 *   - unparseable --at → clean exit 2.
 *
 * Node stdlib only; run with `node tests/orchestrator/fabric-engine.test.cjs`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.join(__dirname, '..', '..');
const ENGINE = path.join(REPO, 'orchestrator', 'lib', 'fabric-engine.cjs');
const CHARTER = path.join(REPO, 'orchestrator', 'charters', 'feature-production-line.json');

const lib = require(ENGINE);
const { transition, applyIngest, prescribe, deriveInstanceId, OWNER_PRIORITY } = lib;

const charter = JSON.parse(fs.readFileSync(CHARTER, 'utf8'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.stack || e.message); process.exitCode = 1; }
}

function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fabric-')); }

// ---- CLI harness --------------------------------------------------------------------------------
function cli(args) {
  try {
    const stdout = execFileSync(process.execPath, [ENGINE, ...args], { encoding: 'utf8' });
    let json = null; try { json = JSON.parse(stdout); } catch (_e) { /* non-JSON */ }
    return { code: 0, stdout, json };
  } catch (e) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
    };
  }
}
function readState(base, id) { return JSON.parse(fs.readFileSync(path.join(base, id, 'state.json'), 'utf8')); }

const AT = '2026-07-07T10:00:00.000Z';

function initInstance(base, subject, at) {
  const r = cli(['init', '--charter', CHARTER, '--subject', subject, '--at', at || AT, '--base-root', base]);
  assert.strictEqual(r.code, 0, `init failed: ${r.stderr || r.stdout}`);
  return r.json.instance;
}
function tick(base, id, event, at) {
  return cli(['tick', '--instance', id, '--event', event, '--charter', CHARTER, '--at', at || AT, '--base-root', base]);
}
function ingest(base, id, proc, result, at, runId) {
  const args = ['ingest', '--instance', id, '--process', proc, '--result', JSON.stringify(result), '--charter', CHARTER, '--at', at || AT, '--base-root', base];
  if (runId) args.push('--run-id', runId);
  return cli(args);
}
/** init → line.start → spec.authored → impl_ready ⇒ leaves the instance in `implementing`. */
function reachImplementing(base, subject) {
  const id = initInstance(base, subject);
  assert.strictEqual(tick(base, id, 'evt:line.start').json.to, 'authoring');
  assert.strictEqual(ingest(base, id, 'batch-features-to-cc-sdd', {}).json.ticks[0].to, 'fidelity_audit');
  assert.strictEqual(ingest(base, id, 'audit-spec-fidelity', { impl_ready: ['x'] }).json.ticks[0].to, 'implementing');
  return id;
}

console.log('fabric-engine — Process Fabric interpreter (DEC-DEV-0153)');

// ==== pure core ==================================================================================

test('transition is deterministic (same inputs → deepStrictEqual outputs)', () => {
  const snap = {
    instance: 'i', charter_id: 'feature-production-line', charter_version: 1, subject: 'FM-1',
    state: 'implementing', context: {}, counters: { remediation_rounds: 0 }, seq: 3,
    created_at: AT, updated_at: AT,
  };
  const env = { laneCounts: { orchestrator: 0 }, limits: { env_tier: 'dev' }, policy: {} };
  const a = transition(charter, snap, 'evt:impl.no_go', null, env);
  const b = transition(charter, snap, 'evt:impl.no_go', null, env);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.next.state, 'remediation', 'first no_go → remediation (rounds_left passes at 0)');
  assert.strictEqual(a.next.counters.remediation_rounds, 1, 'counter increments on entry');
  assert.strictEqual(a.next.seq, 4);
});

test('unknown event → rejected effect, snapshot unchanged, never throws', () => {
  const snap = { instance: 'i', state: 'implementing', counters: {}, seq: 1 };
  const env = { laneCounts: {}, limits: {}, policy: {} };
  const r = transition(charter, snap, 'evt:does-not-exist', null, env);
  assert.strictEqual(r.next, snap, 'same snapshot returned (no-op)');
  assert.strictEqual(r.effects[0].kind, 'rejected');
  assert.ok(/unknown-event/.test(r.effects[0].reason), 'reason names the unknown event');
  assert.ok(r.why.length >= 1);
});

test('ingest mapping covers every result branch (first matching rule wins)', () => {
  const cases = [
    ['batch-features-to-cc-sdd', { blocked: ['boom'] }, 'evt:spec.blocked'],
    ['batch-features-to-cc-sdd', {}, 'evt:spec.authored'], // default fallback
    ['audit-spec-fidelity', { product_routed: ['q'] }, 'evt:fidelity.product_routed'],
    ['audit-spec-fidelity', { residual: ['r'] }, 'evt:fidelity.residual'],
    ['audit-spec-fidelity', { impl_ready: ['ok'] }, 'evt:fidelity.impl_ready'],
    ['feature-to-tdd-impl', { go_gate: 'GO' }, 'evt:impl.go'],       // P5 exposes go_gate at top level, NOT gate.result
    ['feature-to-tdd-impl', { go_gate: 'NO-GO' }, 'evt:impl.no_go'],
    ['feature-to-tdd-impl', { go_gate: 'MANUAL_VERIFY_REQUIRED' }, 'evt:impl.manual_verify'],
    ['feature-to-tdd-impl', { conflicts: ['c'], go_gate: 'GO' }, 'evt:impl.conflict'], // conflict rule is first
    ['validate-feature-impl', { result: 'GO' }, 'evt:impl.go'],
    ['validate-feature-impl', { result: 'NO-GO' }, 'evt:impl.no_go'],
    ['validate-feature-impl', { result: 'MANUAL_VERIFY_REQUIRED' }, 'evt:impl.manual_verify'],
    ['runtime-smoke-readiness', { verdict: 'READY_TO_SMOKE' }, 'evt:runtime.ready_or_started'],
    ['runtime-smoke-readiness', { verdict: 'BLOCKED_ON_CAPABILITY' }, 'evt:runtime.blocked_capability'],
    ['runtime-smoke-readiness', { verdict: 'ENV_NOT_READY' }, 'evt:runtime.env_not_ready'],
    ['runtime-smoke-readiness', { verdict: 'NOT_STARTABLE' }, 'evt:fidelity.product_routed'],
  ];
  for (const [proc, result, expected] of cases) {
    assert.deepStrictEqual(applyIngest(charter, proc, result), [expected], `${proc} ${JSON.stringify(result)}`);
  }
  // no rule matches and no default ⇒ no event
  assert.deepStrictEqual(applyIngest(charter, 'audit-spec-fidelity', {}), []);
  assert.deepStrictEqual(applyIngest(charter, 'unknown-process', { anything: 1 }), []);
});

test('ingest binds to the REAL P5/P6 envelope shape (charter-drift guard, CONCEPT §10)', () => {
  // P5 feature-to-tdd-impl exposes the verdict as a TOP-LEVEL `go_gate` string (processes/
  // feature-to-tdd-impl.mjs return) — there is NO `gate` object. A charter reading `gate.result`
  // would emit NOTHING on a clean GO and stall the instance in `implementing`. Drive applyIngest
  // with the real envelope so the drift cannot silently reappear.
  const realP5Go = { feature: 'FM-1', implemented: ['t1'], blocked: [], conflicts: [], findings: [], go_gate: 'GO', readiness: 'READY' };
  assert.deepStrictEqual(applyIngest(charter, 'feature-to-tdd-impl', realP5Go), ['evt:impl.go'], 'real P5 GO envelope must map to evt:impl.go');
  const realP5NoGo = { feature: 'FM-1', conflicts: [], findings: ['x'], go_gate: 'NO-GO' };
  assert.deepStrictEqual(applyIngest(charter, 'feature-to-tdd-impl', realP5NoGo), ['evt:impl.no_go']);
  // the stale path must now be inert: a synthetic gate.result no longer fires any rule
  assert.deepStrictEqual(applyIngest(charter, 'feature-to-tdd-impl', { gate: { result: 'GO' } }), [], 'gate.result is dead — proves the fix, not a fallback');
  // P6 validate-feature-impl returns BOTH result and go_gate; the charter reads `result` (still valid)
  const realP6 = { feature: 'FM-1', conflicts: [], result: 'GO', go_gate: 'GO', readiness: 'READY' };
  assert.deepStrictEqual(applyIngest(charter, 'validate-feature-impl', realP6), ['evt:impl.go']);
});

test('floor is non-crossable: prod_deploy → human-gate even with charter autonomy=auto', () => {
  const floorCharter = {
    id: 'x', version: 1, initial: 'deploy',
    states: { deploy: { invoke: { process: 'ship-it' }, meta: { autonomy: 'auto', operation_class: 'prod_deploy' } } },
    guards: {},
  };
  const p = prescribe(floorCharter, { state: 'deploy', subject: 's', instance: 'i' }, { limits: { env_tier: 'dev' }, policy: {} });
  assert.strictEqual(p.kind, 'run-process');
  assert.strictEqual(p.disposition, 'human-gate', 'floor overrides autonomy=auto');
  assert.strictEqual(p.floor_hit, true);
  // an ordinary invoke state under L1×dev resolves to auto
  const q = prescribe(charter, { state: 'authoring', subject: 's', instance: 'i' }, { limits: { env_tier: 'dev' }, policy: {} });
  assert.strictEqual(q.disposition, 'auto');
});

test('prescribe emits kind:human-gate + paEntry for a human-gate (non-invoke) state', () => {
  // The kind:'human-gate' branch is the owner-channel signal for every human-gate state
  // (handoff_ready, escalated, awaiting_*, runtime_gate_retry). Assert the full envelope so a
  // silent degradation to kind:'none' (mutation M7) is caught.
  const p = prescribe(charter, { state: 'escalated', subject: 'FM-9', instance: 'inst-9' }, { limits: { env_tier: 'dev' }, policy: {} });
  assert.strictEqual(p.kind, 'human-gate', 'human-gate state must prescribe kind:human-gate');
  assert.deepStrictEqual(p.paEntry, { instance: 'inst-9', subject: 'FM-9', state: 'escalated' });
  // the initial handoff_ready state is likewise a human-gate prescription
  const h = prescribe(charter, { state: 'handoff_ready', subject: 'FM-9', instance: 'inst-9' }, { limits: { env_tier: 'dev' }, policy: {} });
  assert.strictEqual(h.kind, 'human-gate');
});

test('meta.autonomy=human-gate on an INVOKE state floors the disposition to human-gate', () => {
  // Regression guard: without the floor, an invoke state marked human-gate is prescribed run-process
  // with an F1-resolved disposition that (for a non-floor process-step at L1×dev) resolves to 'auto',
  // silently dropping the author's human-gate intent.
  const gated = {
    id: 'g', version: 1, initial: 'step',
    states: { step: { invoke: { process: 'do-it' }, meta: { autonomy: 'human-gate', operation_class: 'process-step' } } },
    guards: {},
  };
  const p = prescribe(gated, { state: 'step', subject: 's', instance: 'i' }, { limits: { env_tier: 'dev' }, policy: {} });
  assert.strictEqual(p.kind, 'run-process', 'still an invoke → run-process');
  assert.strictEqual(p.disposition, 'human-gate', 'human-gate hint must NOT be silently dropped to auto');
  // control: the same invoke state with autonomy=auto resolves to auto under L1×dev
  const auto = { id: 'g', version: 1, initial: 'step',
    states: { step: { invoke: { process: 'do-it' }, meta: { autonomy: 'auto', operation_class: 'process-step' } } }, guards: {} };
  const q = prescribe(auto, { state: 'step', subject: 's', instance: 'i' }, { limits: { env_tier: 'dev' }, policy: {} });
  assert.strictEqual(q.disposition, 'auto');
});

test('OWNER_PRIORITY table ranks floor > conflict > gate > review', () => {
  assert.ok(OWNER_PRIORITY.floor < OWNER_PRIORITY.conflict);
  assert.ok(OWNER_PRIORITY.conflict < OWNER_PRIORITY.gate);
  assert.ok(OWNER_PRIORITY.gate < OWNER_PRIORITY.review);
});

test('deriveInstanceId is deterministic and shaped from the timestamp (no Math.random)', () => {
  const a = deriveInstanceId('feature-production-line', 'FM-3', AT);
  const b = deriveInstanceId('feature-production-line', 'FM-3', AT);
  assert.strictEqual(a, b);
  assert.ok(/^2026-07-07-feature-production-line-fm-3-[a-z0-9]+$/.test(a), `bad id: ${a}`);
});

// ==== CLI ========================================================================================

test('CLI happy path: init → line.start → P3→P4→P5(GO)→P7 → done', () => {
  const base = mkTmp();
  const id = initInstance(base, 'FM-3');
  assert.ok(/-fm-3-/.test(id), `instance id shape: ${id}`);
  assert.strictEqual(readState(base, id).state, 'handoff_ready');

  assert.strictEqual(tick(base, id, 'evt:line.start').json.to, 'authoring');
  assert.strictEqual(ingest(base, id, 'batch-features-to-cc-sdd', {}).json.ticks[0].to, 'fidelity_audit');
  assert.strictEqual(ingest(base, id, 'audit-spec-fidelity', { impl_ready: ['FM-3'] }).json.ticks[0].to, 'implementing');
  assert.strictEqual(ingest(base, id, 'feature-to-tdd-impl', { go_gate: 'GO' }).json.ticks[0].to, 'runtime_gate');
  const last = ingest(base, id, 'runtime-smoke-readiness', { verdict: 'READY_TO_SMOKE' });
  assert.strictEqual(last.json.ticks[0].to, 'done');
  assert.deepStrictEqual(last.json.ticks[0].prescription, { kind: 'none', final: true, state: 'done' });
  assert.strictEqual(readState(base, id).state, 'done');
});

test('CLI P7 NOT_STARTABLE routes out of runtime_gate (no dead-end stall)', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-NS');
  assert.strictEqual(ingest(base, id, 'feature-to-tdd-impl', { go_gate: 'GO' }).json.ticks[0].to, 'runtime_gate');
  // NOT_STARTABLE emits evt:fidelity.product_routed; runtime_gate must handle it (route to product),
  // NOT reject it as an unknown event and strand the instance in runtime_gate.
  const r = ingest(base, id, 'runtime-smoke-readiness', { verdict: 'NOT_STARTABLE' });
  assert.strictEqual(r.json.emitted[0], 'evt:fidelity.product_routed');
  assert.strictEqual(r.json.ticks[0].applied, true, 'NOT_STARTABLE must apply a real transition, not a rejected no-op');
  assert.strictEqual(r.json.ticks[0].to, 'awaiting_product');
  assert.strictEqual(readState(base, id).state, 'awaiting_product');
  const st = cli(['status', '--base-root', base]);
  assert.ok(st.json.owner_queue.some((e) => e.state === 'awaiting_product'), 'the product route queues the owner');
});

test('CLI bounded remediation: 2 no_go rounds, escalate on the third', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-REM');
  assert.strictEqual(tick(base, id, 'evt:impl.no_go').json.to, 'remediation'); // round 1
  assert.strictEqual(readState(base, id).counters.remediation_rounds, 1);
  assert.strictEqual(tick(base, id, 'evt:impl.no_go').json.to, 'remediation'); // round 2 (self-loop)
  assert.strictEqual(readState(base, id).counters.remediation_rounds, 2);
  const third = tick(base, id, 'evt:impl.no_go'); // rounds_left fails → escalated
  assert.strictEqual(third.json.to, 'escalated');
  assert.ok(third.json.effects.some((e) => e.kind === 'queue_owner'), 'escalation queues the owner');

  const st = cli(['status', '--base-root', base]);
  assert.ok(st.json.owner_queue.length >= 1, 'owner-queue has the escalation entry');
  assert.strictEqual(st.json.owner_queue[0].kind, 'gate');
  assert.strictEqual(st.json.owner_queue[0].priority, OWNER_PRIORITY.gate);

  // a remediation GO is the graduation path — fresh base (the id above still holds the lane in
  // `escalated`, a non-final state) to prove NO-GO→remediation→GO works machine-side.
  const base2 = mkTmp();
  const id2 = reachImplementing(base2, 'FM-REM2');
  assert.strictEqual(tick(base2, id2, 'evt:impl.no_go').json.to, 'remediation');
  assert.strictEqual(tick(base2, id2, 'evt:impl.go').json.to, 'runtime_gate');
});

test('CLI wip-guard: second instance on the orchestrator lane is rejected, why explains', () => {
  const base = mkTmp();
  const id1 = initInstance(base, 'FM-A');
  assert.strictEqual(tick(base, id1, 'evt:line.start').json.to, 'authoring'); // lane now occupied (wip=1)

  const id2 = initInstance(base, 'FM-B');
  const r = tick(base, id2, 'evt:line.start');
  assert.strictEqual(r.json.applied, false, 'second start must be rejected');
  assert.strictEqual(r.json.to, 'handoff_ready', 'instance stays queued');
  assert.ok(r.json.why.some((w) => /wipOk/.test(w) && /false/.test(w)), `why[] must explain the wip block: ${JSON.stringify(r.json.why)}`);
  assert.strictEqual(readState(base, id2).state, 'handoff_ready');
});

test('CLI ingest idempotency: a seen run_id is a no-op', () => {
  const base = mkTmp();
  const id = initInstance(base, 'FM-IDEM');
  tick(base, id, 'evt:line.start');
  const first = ingest(base, id, 'batch-features-to-cc-sdd', {}, AT, 'run-R');
  assert.strictEqual(first.json.deduped, false);
  assert.strictEqual(readState(base, id).state, 'fidelity_audit');

  // same run_id R, on a DIFFERENT (valid-for-this-state) process ⇒ dedup skips it entirely,
  // even though evt:fidelity.impl_ready WOULD otherwise advance to implementing.
  const dup = ingest(base, id, 'audit-spec-fidelity', { impl_ready: ['x'] }, AT, 'run-R');
  assert.strictEqual(dup.json.deduped, true, 'seen run_id → deduped');
  assert.deepStrictEqual(dup.json.emitted, []);
  assert.strictEqual(readState(base, id).state, 'fidelity_audit', 'state unchanged by the duplicate');

  // a fresh run_id applies normally
  const fresh = ingest(base, id, 'audit-spec-fidelity', { impl_ready: ['x'] }, AT, 'run-S');
  assert.strictEqual(fresh.json.deduped, false);
  assert.strictEqual(readState(base, id).state, 'implementing');
});

test('CLI replay reproduces the persisted snapshot exactly', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-RE');
  tick(base, id, 'evt:impl.no_go'); // → remediation (an event with a counter increment)
  tick(base, id, 'evt:impl.go');     // → runtime_gate

  const r = cli(['replay', '--instance', id, '--charter', CHARTER, '--base-root', base]);
  assert.strictEqual(r.code, 0, `replay mismatch: ${JSON.stringify(r.json)}`);
  assert.strictEqual(r.json.ok, true);
  assert.strictEqual(r.json.seq, readState(base, id).seq);
});

test('CLI unparseable --at → clean exit 2', () => {
  const base = mkTmp();
  const r = cli(['init', '--charter', CHARTER, '--subject', 'FM-X', '--at', 'not-a-date', '--base-root', base]);
  assert.strictEqual(r.code, 2, 'must exit 2 on a bad timestamp');
  assert.ok(/parseable ISO/.test(r.stderr), `stderr should explain: ${r.stderr}`);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
