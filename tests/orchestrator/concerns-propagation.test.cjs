'use strict';
/**
 * Static guard for DEC-DEV-0081 fix #1 (FB-013): the P5 process must PROPAGATE the
 * implementer's CONCERNS field, not drop it.
 *
 * Root cause (S6 dogfood): feature-to-tdd-impl.mjs declared `concerns` in IMPL_SCHEMA but
 * never READ it, routed only on `impl.status`, and the FSM return omitted it — so a real
 * upward signal ("real adapter is an unwired skeleton, real access deferred") was silently
 * discarded and the feature closed at GO with the deferred capability hidden.
 *
 * The .mjs is a harness Workflow script (uses agent/phase/log/args globals + top-level
 * return) and cannot be executed standalone, so this is a SOURCE-level assertion — the same
 * approach as workflow-syntax.smoke.cjs. It locks the three invariants of the fix so a
 * future refactor cannot quietly re-drop concerns.
 *
 * Node stdlib only; run with `node tests/orchestrator/concerns-propagation.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'orchestrator', 'processes', 'feature-to-tdd-impl.mjs');
const src = fs.readFileSync(SRC, 'utf8');

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

console.log('orchestrator P5 — CONCERNS propagation (FB-013 / DEC-DEV-0081 fix #1)');

test('IMPL_SCHEMA still declares the concerns field', () => {
  assert(/concerns:\s*\{\s*type:\s*'string'/.test(src), 'IMPL_SCHEMA.concerns declaration missing');
});

test('the FSM READS impl.concerns (not only declares it in the schema)', () => {
  assert(/impl\.concerns/.test(src), 'impl.concerns is never read — concerns would be dropped (the S6 bug)');
});

test('a non-blocking surfaceConcern routing branch exists', () => {
  assert(/const\s+surfaceConcern\s*=/.test(src), 'surfaceConcern helper missing');
  assert(/await\s+surfaceConcern\(/.test(src), 'surfaceConcern is defined but never invoked in the loop');
});

test('concerns are accumulated', () => {
  assert(/const\s+concerns\s*=\s*\[\]/.test(src), 'concerns accumulator missing');
  assert(/concerns\.push\(/.test(src), 'concerns are never pushed into the accumulator');
});

test('the FSM return value carries concerns (not dropped at the boundary)', () => {
  // the process result object lists `concerns` near `go_gate` — assert that adjacency
  // directly (avoids matching the early FB-002 guard return, which has no `concerns`).
  // DEC-DEV-0096 (T5) inserted a `conflicts` sibling; DEC-DEV-0104 (FB-LR-19) made it a
  // `conflicts.concat(...)` expression and added a `findings` sibling — so tolerate any
  // number of `key: value` sibling lines between `concerns,` and `go_gate:`.
  assert(/concerns\s*,[^\n]*\n(\s*\w+\s*:[^\n]*\n)*\s*go_gate\s*:/.test(src),
    'the process return object does not list `concerns` alongside `go_gate`');
});

test('the feature-level gate is told about concerns (disclosed at GO, not hidden)', () => {
  assert(/concernNote/.test(src), 'concerns are not threaded into the GO-gate prompt (no concernNote)');
});

// ---- DEC-DEV-0231 (2.2): concerns is the MANDATORY deviations report -----------------------------
// M16: the control arm won the honesty axis by FORM (its cycle forces a decisions register); the
// canon arm shipped two UNDECLARED deviations. An optional field is carrier-less discipline.

test('DEC-DEV-0231: concerns is REQUIRED in IMPL_SCHEMA (silence is not representable)', () => {
  const m = src.match(/const IMPL_SCHEMA[\s\S]*?required:\s*\[([^\]]*)\]/);
  assert(m, 'could not locate IMPL_SCHEMA.required');
  assert(/'concerns'/.test(m[1]), `IMPL_SCHEMA.required must include 'concerns' — got [${m[1].trim()}]`);
});

test('DEC-DEV-0231: the implementer prompt demands EVERY deviation or the literal none', () => {
  assert(/mandatory deviations report/i.test(src), 'the implement() prompt does not name the mandatory deviations report');
  assert(/literal 'none'/.test(src), 'the prompt does not give the explicit no-deviations sentinel');
  assert(/truncated schedule/i.test(src), 'the prompt does not name the M16 deviation classes (truncated schedule/threshold)');
});

test('DEC-DEV-0231: the none-sentinel is filtered — only substantive deviations propagate', () => {
  assert(/concernIsNone/.test(src), 'no none-sentinel filter — a literal "none" would spam the concern route');
  assert(/\^\(none\|/.test(src), 'the sentinel regex does not anchor on none');
});

test('DEC-DEV-0231: surfaceConcern triages the SPEC DEVIATION class to owner ratification', () => {
  const seg = src.slice(src.indexOf('const surfaceConcern'), src.indexOf('const surfaceCapability'));
  assert(/SPEC DEVIATION/.test(seg), 'surfaceConcern has no spec-deviation class (only the mock/deferred class)');
  assert(/owner ratification|принят/i.test(seg), 'a spec deviation is not routed to owner ratification (RL DoD п.5)');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
