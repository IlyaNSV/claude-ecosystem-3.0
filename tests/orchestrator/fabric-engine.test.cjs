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
 *   - --autonomy per-invocation override (env.override → F1 resolve; floor still wins; DEC-DEV-0154);
 *   - replay == snapshot;
 *   - unknown event → rejected, never throws;
 *   - unparseable --at → clean exit 2;
 *   - PA bridge (phase 2b): a human-gate tick mirrors a canonical PA entry (create-if-absent,
 *     dedup on re-park, none on rejected/init), and pa-scan resumes done PAs / surfaces dismissed.
 *   - owner-queue (ANOM-5): the write-path self-prunes a line's stale gate entry on leaving/terminal
 *     + global orphans, append is deduped, and `status` is a read-only live/stale split (proven by bytes);
 *   - --force-manual (rec #4): the reason must reference a PA-id that already exists in the pa-file.
 *   - payload bridge (DEC-DEV-0171): ingestEmits carries a payloadPath slice onto the event (applyIngest
 *     stays event-names); the slice lands FULL in events.ndjson and, on a human-gate park, in the
 *     PA-record as fenced json (truncated >2000, markers intact); a rule without payloadPath is inert.
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
// PA journal lives under the temp base-root (via --pa-file below) so a human-gate tick never writes
// outside the sandbox — the default path (root/../../pending-actions.md) is a real-deploy concern.
function paFile(base) { return path.join(base, 'pending-actions.md'); }
function readPa(base) { try { return fs.readFileSync(paFile(base), 'utf8'); } catch (_e) { return null; } }
// owner-queue.json lives directly under the base-root (fabricRoot(base)/owner-queue.json).
function readOwnerQueue(base) {
  try { return JSON.parse(fs.readFileSync(path.join(base, 'owner-queue.json'), 'utf8')); } catch (_e) { return []; }
}
// Seed a minimal PA journal so a --force-manual "PA-001: …" fixture passes the rec#4 validation
// (the reason must reference a PA-id that already exists in pending-actions.md).
function seedPaFixture(base) {
  fs.writeFileSync(paFile(base), '## PA-001 — fixture\n\n**Status:** pending\n');
}

const AT = '2026-07-07T10:00:00.000Z';

function initInstance(base, subject, at) {
  const r = cli(['init', '--charter', CHARTER, '--subject', subject, '--at', at || AT, '--base-root', base]);
  assert.strictEqual(r.code, 0, `init failed: ${r.stderr || r.stdout}`);
  return r.json.instance;
}
function tick(base, id, event, at, extra) {
  return cli(['tick', '--instance', id, '--event', event, '--charter', CHARTER, '--at', at || AT, '--base-root', base, '--pa-file', paFile(base), ...(extra || [])]);
}
// A bare tick of a process-RESULT event (an ingest-emit of the state's invoked process) is refused by
// the DEF-3 bracket guard. Unit fixtures that drive the machine directly through such events (bounded
// remediation, replay) carry this conscious-override flag; real dispatch routes them via `ingest`.
// The reason must reference a PA-id present in the pa-file (rec #4) — tests using this MUST first call
// seedPaFixture(base) so PA-001 exists in the base's pending-actions.md.
const FORCE_FIXTURE = ['--force-manual', 'PA-001: unit-test fixture'];
function ingest(base, id, proc, result, at, runId) {
  const args = ['ingest', '--instance', id, '--process', proc, '--result', JSON.stringify(result), '--charter', CHARTER, '--at', at || AT, '--base-root', base, '--pa-file', paFile(base)];
  if (runId) args.push('--run-id', runId);
  return cli(args);
}
function paScan(base, extra) {
  return cli(['pa-scan', '--at', AT, '--charter', CHARTER, '--base-root', base, '--pa-file', paFile(base), ...(extra || [])]);
}
/** reachImplementing → ingest conflicts ⇒ parks the instance in awaiting_product (a human gate). */
function reachAwaitingProduct(base, subject) {
  const id = reachImplementing(base, subject);
  assert.strictEqual(ingest(base, id, 'feature-to-tdd-impl', { conflicts: ['c'] }).json.ticks[0].to, 'awaiting_product');
  return id;
}
/** Flip a PA entry's Status in the journal file (simulates the owner acting on it). */
function setPaStatus(base, paId, status) {
  const f = paFile(base);
  const text = fs.readFileSync(f, 'utf8');
  const re = new RegExp(`(## ${paId} —[\\s\\S]*?\\*\\*Status:\\*\\* )\\w+`);
  fs.writeFileSync(f, text.replace(re, `$1${status}`));
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

test('--autonomy override: L0 tightens a dev HIGH step to human-gate; floor stays non-crossable', () => {
  const { resolveDisposition } = lib;
  const meta = { autonomy: 'auto', operation_class: 'process-step', risk: 'HIGH' };
  const base = { limits: { env_tier: 'dev' }, policy: {} };
  assert.strictEqual(resolveDisposition(meta, base).disposition, 'auto', 'L1 default: non-floor dev → auto');
  assert.strictEqual(resolveDisposition(meta, Object.assign({}, base, { override: 'L0' })).disposition,
    'human-gate', 'L0 override: HIGH×dev → human-gate');
  // floor beats a permissive override
  const floorMeta = { autonomy: 'auto', operation_class: 'prod_deploy' };
  const fl = resolveDisposition(floorMeta, Object.assign({}, base, { override: 'L1' }));
  assert.strictEqual(fl.disposition, 'human-gate');
  assert.strictEqual(fl.floor_hit, true, 'floor is not crossable by override');
  // an invalid override is ignored LOUDLY (F1 why-entry), disposition unchanged
  const bad = resolveDisposition(meta, Object.assign({}, base, { override: 'L9' }));
  assert.strictEqual(bad.disposition, 'auto');
  assert.ok(bad.why.some((w) => /override "L9"/.test(w)), `why[] must name the ignored override: ${JSON.stringify(bad.why)}`);
});

test('CLI --autonomy L0 flows through tick to the emitted prescription', () => {
  const base = mkTmp();
  const id = initInstance(base, 'FM-OV');
  // --pa-file is REQUIRED here: L0 turns authoring into a human-gate, whose PA-projection would
  // otherwise land in defaultPaFile(root) = <base>/../../pending-actions.md — filesystem root on
  // a Linux tmpdir (EACCES, the standing CI failure) and stray litter on Windows (silent pass).
  const r = cli(['tick', '--instance', id, '--event', 'evt:line.start', '--charter', CHARTER,
    '--at', AT, '--base-root', base, '--autonomy', 'L0', '--pa-file', paFile(base)]);
  assert.strictEqual(r.json.to, 'authoring');
  assert.strictEqual(r.json.prescription.kind, 'run-process');
  assert.strictEqual(r.json.prescription.disposition, 'human-gate',
    'authoring (risk defaults HIGH) under an L0 override must human-gate');
  // control: the same tick without the flag resolves to auto under L1×dev
  const base2 = mkTmp();
  const id2 = initInstance(base2, 'FM-OV2');
  const q = cli(['tick', '--instance', id2, '--event', 'evt:line.start', '--charter', CHARTER,
    '--at', AT, '--base-root', base2, '--pa-file', paFile(base2)]);
  assert.strictEqual(q.json.prescription.disposition, 'auto');
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
  seedPaFixture(base);
  assert.strictEqual(tick(base, id, 'evt:impl.no_go', null, FORCE_FIXTURE).json.to, 'remediation'); // round 1
  assert.strictEqual(readState(base, id).counters.remediation_rounds, 1);
  assert.strictEqual(tick(base, id, 'evt:impl.no_go', null, FORCE_FIXTURE).json.to, 'remediation'); // round 2 (self-loop)
  assert.strictEqual(readState(base, id).counters.remediation_rounds, 2);
  const third = tick(base, id, 'evt:impl.no_go', null, FORCE_FIXTURE); // rounds_left fails → escalated
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
  seedPaFixture(base2);
  assert.strictEqual(tick(base2, id2, 'evt:impl.no_go', null, FORCE_FIXTURE).json.to, 'remediation');
  assert.strictEqual(tick(base2, id2, 'evt:impl.go', null, FORCE_FIXTURE).json.to, 'runtime_gate');
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
  seedPaFixture(base);
  tick(base, id, 'evt:impl.no_go', null, FORCE_FIXTURE); // → remediation (an event with a counter increment)
  tick(base, id, 'evt:impl.go', null, FORCE_FIXTURE);     // → runtime_gate

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

// ==== DEF-3 bracket guard ========================================================================

test('DEF-3 guard: a bare tick of an ingest-mapped process result is refused (exit 2)', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-GUARD');   // state = implementing (invoke feature-to-tdd-impl)
  const r = tick(base, id, 'evt:impl.go');           // evt:impl.go is an ingest-emit of the invoked process
  assert.strictEqual(r.code, 2, 'a bare ingest-mapped tick must exit 2');
  assert.ok(/feature-to-tdd-impl/.test(r.stderr), `stderr names the invoked process: ${r.stderr}`);
  assert.ok(/--force-manual/.test(r.stderr), `stderr points at the --force-manual escape: ${r.stderr}`);
  assert.strictEqual(readState(base, id).state, 'implementing', 'the refused tick is a no-op');
});

test('DEF-3 guard: --force-manual applies the tick and stamps a forced-manual audit marker in the event', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-FORCE');
  seedPaFixture(base);
  const r = tick(base, id, 'evt:impl.go', null, ['--force-manual', 'PA-001: reason text']);
  assert.strictEqual(r.code, 0, `a forced tick must succeed: ${r.stderr}`);
  assert.strictEqual(r.json.to, 'runtime_gate', 'the forced tick applies the real transition');
  // the marker must LIVE in events.ndjson (audit survives beyond stdout), not merely be printed
  const events = fs.readFileSync(path.join(base, id, 'events.ndjson'), 'utf8');
  assert.ok(/forced-manual: PA-001: reason text/.test(events), `the forced-manual marker must be in the event log: ${events}`);
  // and replay stays bit-for-bit consistent — the marker is an event-sourced audit note, not state
  const rep = cli(['replay', '--instance', id, '--charter', CHARTER, '--base-root', base]);
  assert.strictEqual(rep.code, 0, `replay must stay consistent after a forced tick: ${JSON.stringify(rep.json)}`);
  assert.strictEqual(rep.json.ok, true);
});

test('DEF-3 guard: --force-manual with an empty reason is refused (exit 2)', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-EMPTY');
  const r = tick(base, id, 'evt:impl.go', null, ['--force-manual', '']);
  assert.strictEqual(r.code, 2, 'an empty force-manual reason must exit 2');
  assert.ok(/--force-manual/.test(r.stderr) && /reason/.test(r.stderr), `stderr must demand a reason: ${r.stderr}`);
  assert.strictEqual(readState(base, id).state, 'implementing', 'still a no-op');
});

test('DEF-3 guard: a resume event outside the ingest map still ticks freely (regression)', () => {
  const base = mkTmp();
  const id = reachAwaitingProduct(base, 'FM-RESUME');  // parked in awaiting_product (a human gate, no invoke)
  const r = tick(base, id, 'evt:pa.resolved');          // resume event, NOT an ingest-emit → must pass through
  assert.strictEqual(r.code, 0, `a resume tick must not be blocked by the guard: ${r.stderr}`);
  assert.strictEqual(r.json.to, 'implementing', 'the resume un-parks the line exactly as before');
});

// ==== owner-queue write-path prune + read-only status (ANOM-5) ===================================

test('owner-queue: parking queues an entry; resuming off the gate self-prunes it (write-path)', () => {
  const base = mkTmp();
  const id = reachAwaitingProduct(base, 'FM-OQ');            // parks in awaiting_product, queues owner
  let q = readOwnerQueue(base);
  assert.strictEqual(q.length, 1, 'the park queued exactly one owner entry');
  assert.strictEqual(q[0].instance, id);
  assert.strictEqual(q[0].state, 'awaiting_product');
  // resume off the gate → the write-path drops the now-stale entry (it left the gate)
  assert.strictEqual(tick(base, id, 'evt:pa.resolved').json.to, 'implementing');
  q = readOwnerQueue(base);
  assert.strictEqual(q.length, 0, 'leaving the gate self-prunes the entry on the write-path');
});

test('owner-queue: reaching a terminal state clears the line\'s queued entries', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-TERM');
  // manual_verify parks the line in escalated (queues the owner)
  assert.strictEqual(ingest(base, id, 'feature-to-tdd-impl', { go_gate: 'MANUAL_VERIFY_REQUIRED' }).json.ticks[0].to, 'escalated');
  assert.strictEqual(readOwnerQueue(base).length, 1, 'escalated queued the owner');
  // owner aborts → terminal 'aborted'; the write-path prunes the stale escalated entry
  assert.strictEqual(tick(base, id, 'evt:owner.abort').json.to, 'aborted');
  assert.strictEqual(readOwnerQueue(base).length, 0, 'the terminal move cleared the queued entry');
});

test('owner-queue: a removed instance\'s orphan entry is swept by another line\'s write-path tick', () => {
  const base = mkTmp();
  const idA = reachAwaitingProduct(base, 'FM-ORPH-A');       // A parks at awaiting_product, queues owner
  assert.strictEqual(readOwnerQueue(base).length, 1);
  // the instance is deleted out from under the queue → its entry is now a global orphan
  fs.rmSync(path.join(base, idA), { recursive: true, force: true });
  // any OTHER line's applied write-path tick sweeps the orphan (the lane is free now A is gone)
  const idB = initInstance(base, 'FM-ORPH-B');
  assert.strictEqual(tick(base, idB, 'evt:line.start').json.to, 'authoring');
  assert.strictEqual(readOwnerQueue(base).length, 0, 'the orphan of the removed instance was swept');
});

test('owner-queue: a repeated park of the same (instance,state,kind) is deduped, not duplicated', () => {
  const base = mkTmp();
  const entry = { at: AT, instance: 'inst-d', state: 'escalated', kind: 'gate', priority: 2, source: 'x' };
  lib.appendOwnerQueue(base, entry);
  lib.appendOwnerQueue(base, Object.assign({}, entry, { at: '2026-07-08T00:00:00.000Z' })); // same instance+state+kind
  const q = readOwnerQueue(base);
  assert.strictEqual(q.length, 1, 'the duplicate park was suppressed');
});

test('status is read-only: stale entries surface under owner_queue_stale, file bytes unchanged', () => {
  const base = mkTmp();
  const id = reachAwaitingProduct(base, 'FM-STALE');         // one live entry at awaiting_product
  const oqPath = path.join(base, 'owner-queue.json');
  const live = JSON.parse(fs.readFileSync(oqPath, 'utf8'));
  // hand-craft two stale rows next to the live one (status must NOT prune them — that is write-path work)
  const doctored = live.concat([
    { at: AT, instance: id, state: 'escalated', kind: 'gate', priority: 2, source: 'feature-production-line' },   // wrong state → left state
    { at: AT, instance: 'ghost-instance', state: 'awaiting_product', kind: 'conflict', priority: 1, source: 'x' }, // no state.json → instance gone
  ]);
  fs.writeFileSync(oqPath, JSON.stringify(doctored, null, 2) + '\n');
  const beforeBytes = fs.readFileSync(oqPath);
  const beforeMtime = fs.statSync(oqPath).mtimeMs;

  const st = cli(['status', '--base-root', base]);
  assert.strictEqual(st.code, 0);
  assert.strictEqual(st.json.owner_queue.length, 1, 'only the live entry is in owner_queue');
  assert.strictEqual(st.json.owner_queue[0].state, 'awaiting_product');
  assert.strictEqual(st.json.owner_queue_stale.length, 2, 'both stale rows are surfaced (nothing hidden)');
  assert.ok(st.json.owner_queue_stale.some((e) => e.instance === id && /left state escalated/.test(e.reason)),
    'the same-instance/wrong-state row is tagged "left state <s>"');
  assert.ok(st.json.owner_queue_stale.some((e) => e.instance === 'ghost-instance' && /instance gone/.test(e.reason)),
    'the missing-instance row is tagged "instance gone"');
  // PROOF status wrote nothing: exact bytes + mtime unchanged
  assert.ok(beforeBytes.equals(fs.readFileSync(oqPath)), 'status must not rewrite owner-queue.json (read-only)');
  assert.strictEqual(fs.statSync(oqPath).mtimeMs, beforeMtime, 'owner-queue.json mtime unchanged (no write)');
});

// ==== --force-manual PA-reference validation (judge rec #4) =======================================

test('force-manual: a reason with no PA reference is refused (exit 2)', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-NOPA');
  const r = tick(base, id, 'evt:impl.go', null, ['--force-manual', 'no pa ref']);
  assert.strictEqual(r.code, 2, 'a reason without a PA-id must exit 2');
  assert.ok(/PA-id/.test(r.stderr), `stderr must demand a PA reference: ${r.stderr}`);
  assert.strictEqual(readState(base, id).state, 'implementing', 'the refused tick is a no-op');
});

test('force-manual: a PA reference absent from pending-actions.md is refused (exit 2)', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-GHOSTPA');
  seedPaFixture(base);                                        // seeds PA-001 only
  const r = tick(base, id, 'evt:impl.go', null, ['--force-manual', 'PA-999: x']);
  assert.strictEqual(r.code, 2, 'a PA-id absent from the journal must exit 2');
  assert.ok(/PA-999/.test(r.stderr) && /not.*found/.test(r.stderr), `stderr must name the missing PA: ${r.stderr}`);
  assert.strictEqual(readState(base, id).state, 'implementing', 'the refused tick is a no-op');
});

test('force-manual: a valid, existing PA reference applies the tick and stamps the audit marker', () => {
  const base = mkTmp();
  const id = reachImplementing(base, 'FM-VALIDPA');
  seedPaFixture(base);
  const r = tick(base, id, 'evt:impl.go', null, ['--force-manual', 'PA-001: manual recovery']);
  assert.strictEqual(r.code, 0, `a valid PA-referencing force must apply: ${r.stderr}`);
  assert.strictEqual(r.json.to, 'runtime_gate', 'the forced tick applies the real transition');
  assert.ok(r.json.why.some((w) => w === 'forced-manual: PA-001: manual recovery'),
    `why[] must carry the forced-manual marker: ${JSON.stringify(r.json.why)}`);
});

// ==== PA bridge (phase 2b) =======================================================================

test('PA bridge: entering a human gate creates pending-actions.md with a canonical PA-001', () => {
  const base = mkTmp();
  assert.strictEqual(readPa(base), null, 'no PA journal exists before any human gate');
  const id = reachImplementing(base, 'FM-PA');
  const conflict = ingest(base, id, 'feature-to-tdd-impl', { conflicts: ['c'] });
  assert.strictEqual(conflict.json.ticks[0].to, 'awaiting_product', 'conflict routes to the human gate');
  assert.strictEqual(conflict.json.ticks[0].pa, 'PA-001', 'the applied tick report echoes the appended PA id');

  const text = readPa(base);
  assert.ok(text, 'the human gate must create the journal (create-if-absent)');
  assert.ok(/^## PA-000 — Sentinel/m.test(text), 'sentinel PA-000 present so the counter starts at 1');
  assert.ok(/^## PA-001 —/m.test(text), 'the fabric gate is the first real entry (PA-001)');
  assert.ok(/\*\*Status:\*\* pending/.test(text), 'appended pending (Status is the owner to flip)');
  assert.ok(/\*\*Source:\*\* orchestrator/.test(text), 'Source is orchestrator');
  assert.ok(new RegExp(`\\*\\*Created:\\*\\* ${AT.replace(/\./g, '\\.')}`).test(text), 'Created == the --at input');
  assert.ok(new RegExp(`^fabric-instance: ${id}$`, 'm').test(text), 'machine marker: fabric-instance');
  assert.ok(/^fabric-state: awaiting_product$/m.test(text), 'machine marker: fabric-state');
  assert.ok(/^resume-event: evt:pa\.resolved$/m.test(text), 'machine marker: resume-event (charter-derived)');
});

test('PA bridge: re-parking the same line at the same gate does not duplicate the PA (dedup)', () => {
  const base = mkTmp();
  const id = reachAwaitingProduct(base, 'FM-DEDUP');          // PA-001 pending
  // resume then re-conflict → re-enters awaiting_product; PA-001 is still pending ⇒ dedup, no PA-002.
  assert.strictEqual(tick(base, id, 'evt:pa.resolved').json.to, 'implementing');
  const re = ingest(base, id, 'feature-to-tdd-impl', { conflicts: ['c'] });
  assert.strictEqual(re.json.ticks[0].to, 'awaiting_product', 'the line re-parks at the same gate');
  assert.strictEqual(re.json.ticks[0].pa, undefined, 'no new PA is appended on the deduped re-entry');
  const count = (readPa(base).match(/^## PA-\d+ — fabric line parked/gm) || []).length;
  assert.strictEqual(count, 1, 'exactly one fabric PA entry survives the re-park');
});

test('PA bridge: a rejected tick writes no PA and creates no journal', () => {
  const base = mkTmp();
  const id = initInstance(base, 'FM-REJ');                    // sits in handoff_ready (a human gate)
  const r = tick(base, id, 'evt:does-not-exist');            // unknown event → rejected no-op
  assert.strictEqual(r.json.applied, false, 'the tick is a rejected no-op');
  assert.strictEqual(readPa(base), null, 'a rejected tick must not touch pending-actions.md');
});

test('PA bridge: pa-scan is inert while pending, ready+ticks on done, then idempotent', () => {
  const base = mkTmp();
  const id = reachAwaitingProduct(base, 'FM-SCAN');           // PA-001 pending

  const pending = paScan(base);
  assert.strictEqual(pending.code, 0);
  assert.strictEqual(pending.json.scanned.length, 1, 'the fabric PA is scanned');
  assert.strictEqual(pending.json.ready.length, 0, 'a pending PA is not yet actionable');

  setPaStatus(base, 'PA-001', 'done');                        // the owner resolves the item
  const doneScan = paScan(base);
  assert.strictEqual(doneScan.json.ready.length, 1, 'a done PA on a still-parked instance is ready');
  assert.strictEqual(doneScan.json.ready[0].instance, id);
  assert.strictEqual(doneScan.json.ready[0].event, 'evt:pa.resolved');
  assert.strictEqual(doneScan.json.ticked.length, 0, 'without --tick nothing fires');

  const ticked = paScan(base, ['--tick']);
  assert.strictEqual(ticked.json.ticked.length, 1);
  assert.strictEqual(ticked.json.ticked[0].to, 'implementing', 'the resume-event un-parks the line');
  assert.strictEqual(readState(base, id).state, 'implementing');

  const again = paScan(base, ['--tick']);
  assert.strictEqual(again.json.ready.length, 0, 'the instance left the gate → repeated pa-scan is a no-op');
  assert.strictEqual(again.json.ticked.length, 0);
});

test('PA bridge: a dismissed fabric PA is surfaced, never auto-ticked', () => {
  const base = mkTmp();
  const id = reachAwaitingProduct(base, 'FM-DIS');
  setPaStatus(base, 'PA-001', 'dismissed');
  const r = paScan(base, ['--tick']);
  assert.strictEqual(r.json.ready.length, 0, 'dismissed is never ready');
  assert.strictEqual(r.json.ticked.length, 0, 'dismissed is never ticked');
  assert.strictEqual(r.json.surfaced.length, 1);
  assert.ok(/dismissed/.test(r.json.surfaced[0].reason), 'the surfaced reason names the dismissal');
  assert.strictEqual(readState(base, id).state, 'awaiting_product', 'a dismissed scan leaves the state parked');
});

// ==== payload bridge: ingest → event → PA-record (DEC-DEV-0171) ==================================
//
// Minimal, self-contained charter fixture (NOT orchestrator/charters/*, per the work-order): two
// live states — an invoke `probing` (initial, so init never spams a human gate) and a human-gate
// `awaiting_capability` with an evt:pa.resolved resume-event — plus an ingest rule whose FIRST branch
// carries a payloadPath (`requests`) and a payloadPath-less `default` branch. Written into the temp
// base-root so nothing escapes the sandbox; passed via --charter <file> like the existing helpers.
const PAYLOAD_CHARTER = {
  id: 'payload-line',
  version: 1,
  context: {},
  initial: 'probing',
  states: {
    probing: {
      invoke: { process: 'probe-caps' },
      meta: { autonomy: 'auto' },
      on: {
        'evt:caps.needed': { target: 'awaiting_capability', actions: ['queue_owner'] },
        'evt:caps.ok': { target: 'done' },
      },
    },
    awaiting_capability: {
      meta: { autonomy: 'human-gate', queue_kind: 'conflict' },
      on: { 'evt:pa.resolved': { target: 'probing' } },
    },
    done: { final: true },
  },
  guards: {},
  ingest: {
    'probe-caps': [
      { when: { path: 'requests', nonEmpty: true }, emit: 'evt:caps.needed', payloadPath: 'requests' },
      { default: true, emit: 'evt:caps.ok' },
    ],
  },
};
function setupPayloadFixture() {
  const base = mkTmp();
  const charterPath = path.join(base, 'payload-line.json');
  fs.writeFileSync(charterPath, JSON.stringify(PAYLOAD_CHARTER, null, 2));
  return { base, charterPath };
}
function initFix(base, charterPath, subject) {
  const r = cli(['init', '--charter', charterPath, '--subject', subject, '--at', AT, '--base-root', base]);
  assert.strictEqual(r.code, 0, `init failed: ${r.stderr || r.stdout}`);
  return r.json.instance;
}
function ingestFix(base, charterPath, id, proc, result, runId) {
  const args = ['ingest', '--instance', id, '--process', proc, '--result', JSON.stringify(result),
    '--charter', charterPath, '--at', AT, '--base-root', base, '--pa-file', paFile(base)];
  if (runId) args.push('--run-id', runId);
  return cli(args);
}
function readEventsFix(base, id) {
  return fs.readFileSync(path.join(base, id, 'events.ndjson'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

test('(a) ingestEmits carries payload by payloadPath; applyIngest stays event-names (regression)', () => {
  const { ingestEmits, applyIngest } = lib;
  const result = { requests: [{ capability: 'mcp:stripe' }], noise: 1 };
  assert.deepStrictEqual(
    ingestEmits(PAYLOAD_CHARTER, 'probe-caps', result),
    [{ event: 'evt:caps.needed', payload: [{ capability: 'mcp:stripe' }] }],
    'the matching rule emits {event, payload} with the payloadPath slice');
  // the backward-compatible wrapper returns the SAME event name, no payload leakage
  assert.deepStrictEqual(applyIngest(PAYLOAD_CHARTER, 'probe-caps', result), ['evt:caps.needed']);
});

test('(b) a rule without payloadPath emits no payload key + writes no payload field to events.ndjson', () => {
  const { ingestEmits } = lib;
  const emitted = ingestEmits(PAYLOAD_CHARTER, 'probe-caps', {}); // default branch → evt:caps.ok, no payloadPath
  assert.deepStrictEqual(emitted, [{ event: 'evt:caps.ok' }]);
  assert.ok(!('payload' in emitted[0]), 'no payload key when the rule has no payloadPath (bit-for-bit pre-0171)');
  // and end-to-end: the event persisted to events.ndjson carries no payload field
  const { base, charterPath } = setupPayloadFixture();
  const id = initFix(base, charterPath, 'CAP-NOPL');
  const r = ingestFix(base, charterPath, id, 'probe-caps', {});
  assert.strictEqual(r.code, 0, `ingest failed: ${r.stderr || r.stdout}`);
  assert.strictEqual(r.json.ticks[0].to, 'done');
  const ev = readEventsFix(base, id).find((e) => e.event === 'evt:caps.ok');
  assert.ok(!('payload' in ev), 'the persisted event has no payload key when the rule lacks payloadPath');
});

test('(c) CLI ingest --result-file parks a human gate; payload lands in events.ndjson + the PA-record', () => {
  const { base, charterPath } = setupPayloadFixture();
  const id = initFix(base, charterPath, 'CAP-1');
  const requests = [{ capability: 'mcp:stripe', why: 'charge API' }];
  const resultFile = path.join(base, 'result.json');
  fs.writeFileSync(resultFile, JSON.stringify({ requests }));
  const r = cli(['ingest', '--instance', id, '--process', 'probe-caps', '--result-file', resultFile,
    '--charter', charterPath, '--at', AT, '--base-root', base, '--pa-file', paFile(base)]);
  assert.strictEqual(r.code, 0, `ingest failed: ${r.stderr || r.stdout}`);
  assert.strictEqual(r.json.emitted[0], 'evt:caps.needed');
  assert.strictEqual(r.json.ticks[0].to, 'awaiting_capability', 'the payloadPath rule parks the line at the human gate');
  // events.ndjson carries the FULL payload slice
  const parkEv = readEventsFix(base, id).find((e) => e.event === 'evt:caps.needed');
  assert.deepStrictEqual(parkEv.payload, requests, 'events.ndjson carries the payload slice');
  // the PA-record fences the payload as json AND keeps all three machine markers verbatim
  const pa = readPa(base);
  assert.ok(/\*\*Payload \(capability-spec \/ event data\):\*\*/.test(pa), 'PA-record has the Payload section header');
  assert.ok(/```json/.test(pa), 'PA-record fences the payload as json');
  assert.ok(/mcp:stripe/.test(pa), 'the payload data is inside the PA-record');
  assert.ok(new RegExp(`^fabric-instance: ${id}$`, 'm').test(pa), 'fabric-instance marker intact');
  assert.ok(/^fabric-state: awaiting_capability$/m.test(pa), 'fabric-state marker intact');
  assert.ok(/^resume-event: evt:pa\.resolved$/m.test(pa), 'resume-event marker intact');
  // replay stays bit-for-bit (payload is event-sourced but transition-neutral)
  const rep = cli(['replay', '--instance', id, '--charter', charterPath, '--base-root', base]);
  assert.strictEqual(rep.code, 0, `replay must stay consistent: ${JSON.stringify(rep.json)}`);
  assert.strictEqual(rep.json.ok, true);
});

test('(d) an oversized payload is truncated in the PA-record but full in events.ndjson; markers intact', () => {
  const { base, charterPath } = setupPayloadFixture();
  const id = initFix(base, charterPath, 'CAP-BIG');
  const requests = [];
  for (let i = 0; i < 80; i += 1) requests.push({ capability: `mcp:tool-${i}`, why: 'x'.repeat(40) });
  const resultFile = path.join(base, 'big.json');
  fs.writeFileSync(resultFile, JSON.stringify({ requests }));
  const r = cli(['ingest', '--instance', id, '--process', 'probe-caps', '--result-file', resultFile,
    '--charter', charterPath, '--at', AT, '--base-root', base, '--pa-file', paFile(base)]);
  assert.strictEqual(r.code, 0, `ingest failed: ${r.stderr || r.stdout}`);
  assert.strictEqual(r.json.ticks[0].to, 'awaiting_capability');
  const pa = readPa(base);
  assert.ok(/payload truncated; full copy lives in events\.ndjson/.test(pa), 'the oversized payload is truncated in the PA-record');
  // the machine markers survive the truncation (they render after the truncated json body)
  assert.ok(new RegExp(`^fabric-instance: ${id}$`, 'm').test(pa), 'fabric-instance marker intact after truncation');
  assert.ok(/^fabric-state: awaiting_capability$/m.test(pa), 'fabric-state marker intact after truncation');
  assert.ok(/^resume-event: evt:pa\.resolved$/m.test(pa), 'resume-event marker intact after truncation');
  // events.ndjson still carries the FULL untruncated payload
  const parkEv = readEventsFix(base, id).find((e) => e.event === 'evt:caps.needed');
  assert.strictEqual(parkEv.payload.length, 80, 'events.ndjson carries the FULL untruncated payload');
});

test('(e) a repeated ingest with the same run-id is a no-op even with a payloadPath rule (dedup regression)', () => {
  const { base, charterPath } = setupPayloadFixture();
  const id = initFix(base, charterPath, 'CAP-IDEM');
  const first = ingestFix(base, charterPath, id, 'probe-caps', { requests: [{ capability: 'mcp:x' }] }, 'run-P');
  assert.strictEqual(first.json.deduped, false);
  assert.strictEqual(readState(base, id).state, 'awaiting_capability');
  const dup = ingestFix(base, charterPath, id, 'probe-caps', { requests: [{ capability: 'mcp:y' }] }, 'run-P');
  assert.strictEqual(dup.json.deduped, true, 'a seen run_id short-circuits the whole ingest');
  assert.deepStrictEqual(dup.json.emitted, []);
  assert.strictEqual(readState(base, id).state, 'awaiting_capability', 'state unchanged by the duplicate');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
