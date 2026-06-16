'use strict';
/**
 * FB-001 regression test (Orchestrator live-run RUN 01) — args must resolve to an object
 * even when the harness delivers them as a JSON STRING.
 *
 * Root cause (verified against transcript c4546225): an invoking agent stringified the
 * Workflow args (args:"{...}") instead of passing an object; the harness forwards args
 * verbatim, so the script saw a string. `const A = args || {}` then left A.feature
 * undefined → the Plan agent improvised a wrong target (billing under an "auth" run).
 * The fix is a defensive parse in every process script's `const A = ...` line.
 *
 * This test does NOT execute the Workflow body (harness dialect, no real agent/fs). It
 * extracts the actual `const A = ...` line from each process file and exercises it with
 * string / object / undefined inputs, and guards against regression to the bare idiom.
 *
 * Node stdlib only; run with `node tests/orchestrator/args-parsing.test.cjs`
 * or `npm run test:orchestrator`.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const PROC_DIR = path.join(__dirname, '..', '..', 'orchestrator', 'processes');

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

// Extract the `const A = ...args...` line (the args-resolution idiom) from a file.
function extractArgsLine(raw) {
  const line = raw.split('\n').find((l) => /^const A = .*args/.test(l.trim()));
  if (!line) throw new Error('no `const A = ...args...` line found');
  return line.trim();
}

// Build a tiny evaluator for the extracted line: (args) => { <line>; return A }
function evalArgsLine(line, argsValue) {
  // eslint-disable-next-line no-new-func
  const fn = new Function('args', `${line}; return A;`);
  return fn(argsValue);
}

console.log('orchestrator args-parsing regression (FB-001)');

const files = fs.existsSync(PROC_DIR)
  ? fs.readdirSync(PROC_DIR).filter((f) => f.endsWith('.mjs'))
  : [];

test('at least one Workflow script present', () => {
  if (!files.length) throw new Error(`no .mjs under ${PROC_DIR}`);
});

for (const f of files) {
  const raw = fs.readFileSync(path.join(PROC_DIR, f), 'utf8');

  test(`${f} — no regression to bare \`args || {}\``, () => {
    assert.ok(
      !/^const A = args \|\| \{\}\s*$/m.test(raw),
      'found `const A = args || {}` — FB-001 defensive parse was reverted',
    );
  });

  test(`${f} — string args resolve to an object`, () => {
    const line = extractArgsLine(raw);
    const A = evalArgsLine(line, '{"feature":"auth","handoffs":["x"],"specDir":".kiro/specs/auth"}');
    assert.strictEqual(typeof A, 'object', 'A should be an object');
    assert.strictEqual(A.feature, 'auth', 'A.feature should resolve from string args');
    assert.deepStrictEqual(A.handoffs, ['x'], 'A.handoffs should resolve from string args');
  });

  test(`${f} — object args pass through`, () => {
    const line = extractArgsLine(raw);
    const A = evalArgsLine(line, { feature: 'billing', handoffs: ['y'] });
    assert.strictEqual(A.feature, 'billing');
    assert.deepStrictEqual(A.handoffs, ['y']);
  });

  test(`${f} — undefined args → empty object`, () => {
    const line = extractArgsLine(raw);
    const A = evalArgsLine(line, undefined);
    assert.deepStrictEqual(A, {});
  });
}

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
