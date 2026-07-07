'use strict';
/**
 * fabric-dispatcher-wiring.test.cjs — structural guard over the Process Fabric dispatcher
 * wiring (DEC-DEV-0154; phase 2a of dev/process-fabric/EXECUTION_ROADMAP.md).
 *
 * commands/orchestrator/run.md IS the dispatcher (LLM-executed prose + command blocks), so —
 * same approach as the *-wiring tests over the .mjs process sources — this asserts structural
 * invariants at the source-text level:
 *   - the fabric bracket rides the run-ledger bracket (same result file, same $RUN_ID, --at);
 *   - line start is opt-in (--fabric) and a rejected start is documented as FB-004 backpressure;
 *   - prescriptions are disposition-routed (auto → continue the bracket loop; human-gate → STOP
 *     at the owner-queue; final → close);
 *   - run.md, the charter, update.md's delivery examples and the engine's require-graph stay in
 *     lockstep (charter ingest keys are dispatchable processes; resume events exist in the charter;
 *     charters/ is delivered and fabric/ state is wipe-protected; autonomy-policy is co-located).
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const RUN_MD = fs.readFileSync(path.join(ROOT, 'commands', 'orchestrator', 'run.md'), 'utf8');
const UPDATE_MD = fs.readFileSync(path.join(ROOT, 'commands', 'ecosystem', 'update.md'), 'utf8');
const VERIFY_MD = fs.readFileSync(path.join(ROOT, 'commands', 'ecosystem', 'verify.md'), 'utf8');
const CHARTER = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'orchestrator', 'charters', 'feature-production-line.json'), 'utf8'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('fabric-dispatcher-wiring — run.md ↔ charter ↔ delivery lockstep (DEC-DEV-0154)');

test('fabric section exists and sits AFTER the run-ledger finish wiring', () => {
  const finishIdx = RUN_MD.indexOf('run-ledger.cjs finish');
  const fabricIdx = RUN_MD.indexOf('### Process Fabric');
  assert(finishIdx !== -1, 'run-ledger finish block missing from run.md');
  assert(fabricIdx !== -1, 'Process Fabric section missing from run.md');
  assert(finishIdx < fabricIdx, 'the fabric bracket must come after the ledger finish wiring');
});

test('ingest bracket: same result file + same $RUN_ID as ledger finish, dispatcher-stamped --at', () => {
  const idx = RUN_MD.indexOf('fabric-engine.cjs ingest');
  assert(idx !== -1, 'fabric ingest call missing');
  const slice = RUN_MD.slice(idx, idx + 400);
  assert(/--result-file/.test(slice), 'ingest must take --result-file');
  assert(/--run-id "\$RUN_ID"/.test(slice), 'ingest must reuse the captured $RUN_ID (idempotency key)');
  assert(/--at "<ISO-now>"/.test(slice), 'ingest must take a dispatcher-stamped --at');
  assert(RUN_MD.includes('same-file-as-finish'),
    'the ingest result file must be the SAME file passed to run-ledger finish');
});

test('line start is opt-in (--fabric): init against the DEPLOYED charter + tick evt:line.start', () => {
  assert(RUN_MD.includes('--fabric'), 'the --fabric opt-in flag is not documented');
  assert(/fabric-engine\.cjs init[\s\S]{0,200}feature-production-line\.json/.test(RUN_MD),
    'init must load the feature-production-line charter');
  assert(RUN_MD.includes('.claude/orchestrator/charters/feature-production-line.json'),
    'the charter must be referenced at its DEPLOYED path (.claude/orchestrator/charters/)');
  assert(RUN_MD.includes('evt:line.start'), 'the evt:line.start tick is missing');
});

test('rejected line.start is documented as FB-004 backpressure, not an error', () => {
  const idx = RUN_MD.indexOf('REJECTED `evt:line.start`');
  assert(idx !== -1, 'the rejected-start note is missing');
  assert(/FB-004/.test(RUN_MD.slice(idx, idx + 300)), 'the wip guard must be tied to FB-004');
});

test('prescription routing: auto continues the bracket loop, human-gate STOPs at the owner-queue, final closes', () => {
  assert(RUN_MD.includes('`disposition: auto`'), 'the auto-disposition branch is missing');
  const hgIdx = RUN_MD.indexOf('`disposition: human-gate`');
  assert(hgIdx !== -1, 'the human-gate branch is missing');
  assert(/STOP/.test(RUN_MD.slice(hgIdx, hgIdx + 400)), 'a human gate must STOP the line');
  assert(/owner-queue/.test(RUN_MD.slice(hgIdx, hgIdx + 400)), 'the human-gate branch must point at the owner-queue');
  assert(RUN_MD.includes('`final: true`'), 'the final-prescription branch is missing');
  // the auto branch must describe the full continuation bracket, not a bare re-launch
  const autoIdx = RUN_MD.indexOf('`disposition: auto`');
  assert(/ledger `start`[\s\S]{0,120}fabric `ingest`/.test(RUN_MD.slice(autoIdx, autoIdx + 400)),
    'the auto continuation must repeat the full ledger+fabric bracket');
});

test('every resume event documented in run.md exists in the charter (and vice-noted)', () => {
  const resumeEvents = ['evt:pa.resolved', 'evt:env.up', 'evt:owner.resume', 'evt:owner.abort'];
  const charterEvents = new Set();
  for (const s of Object.values(CHARTER.states)) {
    for (const e of Object.keys(s.on || {})) charterEvents.add(e);
  }
  for (const ev of resumeEvents) {
    assert(RUN_MD.includes(ev), `run.md must document the resume event ${ev}`);
    assert(charterEvents.has(ev), `the charter no longer handles ${ev} — run.md is stale`);
  }
});

test('every charter ingest key is a dispatchable process in run.md (name + scriptPath)', () => {
  const keys = Object.keys(CHARTER.ingest || {});
  assert(keys.length >= 5, `charter ingest unexpectedly small: ${keys.join(', ')}`);
  for (const proc of keys) {
    assert(RUN_MD.includes('`' + proc + '`'), `charter ingest key "${proc}" is not a run.md process`);
    assert(RUN_MD.includes(`processes/${proc}.mjs`), `no scriptPath mapping for "${proc}" in run.md`);
  }
});

test('--autonomy flag: in the argument-hint, forwarded to fabric calls, floor disclaimed', () => {
  assert(/argument-hint:.*--autonomy L0\|L1/.test(RUN_MD), 'argument-hint must document --autonomy');
  assert(RUN_MD.includes('--autonomy <level>'), 'the forwarding note (--autonomy <level>) is missing');
  const secIdx = RUN_MD.indexOf('### Process Fabric');
  assert(/floor/.test(RUN_MD.slice(secIdx, secIdx + 1200)), 'the non-crossable floor must be disclaimed');
});

test('delivery contract: update.md examples ship charters/ and wipe-protect fabric/ state', () => {
  assert(/processes,\s*lib,\s*charters/.test(UPDATE_MD),
    'charters/ missing from the orchestrator managed-namespace examples in update.md');
  assert(/registries,\s*ledger,\s*runs,\s*fabric/.test(UPDATE_MD),
    'fabric/ missing from the preserved project-state examples in update.md');
});

test('verify.md step-4 baseline spot-checks the shipped charter dir', () => {
  assert(/orchestrator\/charters/.test(VERIFY_MD),
    'verify.md must count .claude/orchestrator/charters/*.json');
});

test('engine + policy are co-located in orchestrator/lib (deployment home, no stale repo-lib copy)', () => {
  const engineSrc = fs.readFileSync(path.join(ROOT, 'orchestrator', 'lib', 'fabric-engine.cjs'), 'utf8');
  assert(fs.existsSync(path.join(ROOT, 'orchestrator', 'lib', 'autonomy-policy.cjs')),
    'autonomy-policy.cjs must live in orchestrator/lib/ (DEC-DEV-0154)');
  assert(!fs.existsSync(path.join(ROOT, 'lib', 'autonomy-policy.cjs')),
    'a stale copy at repo-level lib/ must not exist (single home)');
  assert(engineSrc.includes("require(path.join(__dirname, 'autonomy-policy.cjs'))"),
    'the engine must require the CO-LOCATED policy (a ../../lib path breaks in deployed projects)');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
