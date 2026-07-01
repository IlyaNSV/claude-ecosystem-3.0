'use strict';
/**
 * Unit test for the Orchestrator consilium-synth lib (DEC-DEV-0129) — the P2
 * `decide-architecture-foundation` deterministic synthesis core. The CLI's FS reads are
 * environment-dependent; the PURE functions are the correctness surface the
 * recommendation rides on:
 *   - buildMatrix(): option × prior scores + sum/min + veto attribution (a missing
 *     score is 0, never a crash).
 *   - VETO is worst-of: an option ANY prior marks blocking is vetoed even if the others
 *     score it 5 (a conflict beats a preference — the remediation-guard philosophy).
 *   - rankSurvivors(): sum desc → min desc (worst-of floor) → id asc; a vetoed option
 *     is never ranked.
 *   - synthesize(): STRONG (full panel unanimous on a survivor) / SPLIT (lenses diverge
 *     → surface the trade-off) / NONE (every option vetoed → escalate); panel honesty
 *     (a 2-of-3 agreement is never STRONG).
 *
 * Node stdlib only; run with `node tests/orchestrator/consilium-synth.test.cjs`.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'consilium-synth.cjs');
const lib = require(LIB_PATH);
const {
  clampScore, collectOptionIds, buildMatrix, rankSurvivors, synthesize, summarize,
  PRIORS, PRIOR_LIST, STRENGTH,
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

// An ArchVerdict factory.
const V = (prior, scores, rec, blocking) => ({
  prior,
  scores,
  recommended_option: rec,
  risks_of_recommendation: [],
  blocking_concerns: blocking || [],
});

console.log('orchestrator consilium-synth — P2 pure functions (DEC-DEV-0129)');

test('exports the contract surface + prior/strength enums are stable', () => {
  assert.ok(typeof buildMatrix === 'function', 'buildMatrix missing');
  assert.ok(typeof synthesize === 'function', 'synthesize missing');
  assert.ok(typeof rankSurvivors === 'function', 'rankSurvivors missing');
  assert.deepStrictEqual(PRIOR_LIST, ['velocity', 'fidelity', 'integrity'], 'prior list drifted');
  assert.deepStrictEqual({ ...PRIORS }, { VELOCITY: 'velocity', FIDELITY: 'fidelity', INTEGRITY: 'integrity' }, 'PRIORS drifted');
  assert.deepStrictEqual({ ...STRENGTH }, { STRONG: 'strong', SPLIT: 'split', NONE: 'none' }, 'STRENGTH enum drifted');
});

test('clampScore: clamps to [0,5]; non-numeric ⇒ 0; floats pass', () => {
  assert.strictEqual(clampScore(7), 5);
  assert.strictEqual(clampScore(-3), 0);
  assert.strictEqual(clampScore('nope'), 0);
  assert.strictEqual(clampScore(null), 0);
  assert.strictEqual(clampScore(3.5), 3.5);
  assert.strictEqual(clampScore(4), 4);
});

test('collectOptionIds: union of declared ∪ scored ∪ recommended ∪ blocked', () => {
  const ids = collectOptionIds(
    [V('velocity', { b: 3 }, 'c', [{ option_id: 'd', concern: 'x' }])],
    ['a'],
  );
  assert.deepStrictEqual(ids.slice().sort(), ['a', 'b', 'c', 'd'], 'must collect every referenced option id');
});

test('buildMatrix: per-prior scores + sum/min; a missing score is 0 (no crash)', () => {
  const m = buildMatrix([V('velocity', { a: 5, b: 2 }, 'a'), V('fidelity', { a: 4 }, 'a'), V('integrity', { a: 4, b: 1 }, 'a')], ['a', 'b']);
  assert.deepStrictEqual(m.a.scores, { velocity: 5, fidelity: 4, integrity: 4 });
  assert.strictEqual(m.a.sum, 13);
  assert.strictEqual(m.a.min, 4);
  // b: fidelity never scored it ⇒ 0
  assert.deepStrictEqual(m.b.scores, { velocity: 2, fidelity: 0, integrity: 1 });
  assert.strictEqual(m.b.sum, 3);
  assert.strictEqual(m.b.min, 0);
  assert.strictEqual(m.a.vetoed, false);
});

test('VETO is worst-of: an option ANY prior blocks is vetoed even scored 5 elsewhere', () => {
  const m = buildMatrix([
    V('velocity', { a: 5, b: 3 }, 'a'),
    V('fidelity', { a: 5, b: 3 }, 'a'),
    V('integrity', { a: 0, b: 4 }, 'b', [{ option_id: 'a', concern: 'leaves a dead runtime seam' }]),
  ], ['a', 'b']);
  assert.strictEqual(m.a.vetoed, true, 'a must be vetoed despite two 5s');
  assert.strictEqual(m.a.blocking.length, 1);
  assert.strictEqual(m.a.blocking[0].prior, 'integrity');
  assert.ok(/dead runtime seam/.test(m.a.blocking[0].concern), 'the concern text is preserved');
  assert.strictEqual(m.b.vetoed, false);
});

test('rankSurvivors: sum desc → min desc tie-break → id asc; vetoed excluded', () => {
  // a & b tie on sum (10) but b has the higher floor (min) ⇒ b ranks first.
  const m = buildMatrix([
    V('velocity', { a: 5, b: 5 }, 'a'),
    V('fidelity', { a: 1, b: 3 }, 'b'),
    V('integrity', { a: 4, b: 2 }, 'a'),
  ], ['a', 'b']);
  assert.strictEqual(m.a.sum, 10);
  assert.strictEqual(m.b.sum, 10);
  assert.deepStrictEqual(rankSurvivors(m), ['b', 'a'], 'equal sum ⇒ higher worst-of floor wins');
});

test('synthesize STRONG: full panel unanimous on a surviving option', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 2 }, 'a'),
    V('fidelity', { a: 4, b: 3 }, 'a'),
    V('integrity', { a: 4, b: 2 }, 'a'),
  ], ['a', 'b']);
  assert.strictEqual(s.strength, STRENGTH.STRONG);
  assert.strictEqual(s.recommended, 'a');
  assert.strictEqual(s.panel_complete, true);
  assert.deepStrictEqual(s.vetoed, []);
  assert.strictEqual(s.split, false);
});

test('synthesize SPLIT: lenses diverge ⇒ top-by-sum survivor + split (no forced consensus)', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 2 }, 'a'),
    V('fidelity', { a: 3, b: 4 }, 'b'),
    V('integrity', { a: 2, b: 5 }, 'b'),
  ], ['a', 'b']);
  // sums: a=10, b=11 ⇒ b leads; recs a,b,b not unanimous ⇒ split
  assert.strictEqual(s.strength, STRENGTH.SPLIT);
  assert.strictEqual(s.recommended, 'b');
  assert.strictEqual(s.split, true);
  assert.deepStrictEqual(s.recommendations, { velocity: 'a', fidelity: 'b', integrity: 'b' });
});

test('synthesize: unanimous on a VETOED option ⇒ not strong (recommend a different survivor)', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 3 }, 'a'),
    V('fidelity', { a: 5, b: 3 }, 'a'),
    V('integrity', { a: 0, b: 4 }, 'a', [{ option_id: 'a', concern: 'must not ship' }]),
  ], ['a', 'b']);
  // all recommend 'a' but 'a' is vetoed ⇒ cannot be strong; 'b' is the only survivor
  assert.strictEqual(s.strength, STRENGTH.SPLIT);
  assert.strictEqual(s.recommended, 'b');
  assert.deepStrictEqual(s.vetoed, ['a']);
  assert.deepStrictEqual(s.survivors, ['b']);
});

test('synthesize NONE: every option vetoed ⇒ recommended null + strength none', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 1 }, 'a', [{ option_id: 'b', concern: 'unsafe' }]),
    V('fidelity', { a: 3, b: 3 }, 'a'),
    V('integrity', { a: 2, b: 4 }, 'b', [{ option_id: 'a', concern: 'dead seam' }]),
  ], ['a', 'b']);
  assert.strictEqual(s.strength, STRENGTH.NONE);
  assert.strictEqual(s.recommended, null);
  assert.deepStrictEqual(s.survivors, []);
  assert.strictEqual(s.blocking_concerns.length, 2, 'both vetoes are surfaced in the ledger');
});

test('synthesize: a reduced panel (<3 priors) is never STRONG (panel honesty)', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 2 }, 'a'),
    V('fidelity', { a: 4, b: 2 }, 'a'),
  ], ['a', 'b']);
  assert.strictEqual(s.panel_complete, false, 'only 2 priors reported');
  assert.strictEqual(s.strength, STRENGTH.SPLIT, 'a 2-of-3 agreement must not be promoted to strong');
  assert.strictEqual(s.recommended, 'a', 'still recommends the top-by-sum survivor');
});

test('synthesize: an unknown-prior verdict is ignored (only velocity/fidelity/integrity count)', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 2 }, 'a'),
    V('cost', { a: 0, b: 5 }, 'b'),          // not a known prior ⇒ dropped
    V('fidelity', { a: 4, b: 2 }, 'a'),
    V('integrity', { a: 4, b: 2 }, 'a'),
  ], ['a', 'b']);
  assert.strictEqual(s.strength, STRENGTH.STRONG, 'the bogus prior must not break the full-panel unanimity');
  assert.strictEqual(s.recommended, 'a');
  assert.deepStrictEqual(s.priors_reported.slice().sort(), ['fidelity', 'integrity', 'velocity']);
});

test('summarize: reports recommended, strength, and the option/survivor/veto counts', () => {
  const s = synthesize([
    V('velocity', { a: 5, b: 1 }, 'a', [{ option_id: 'b', concern: 'x' }]),
    V('fidelity', { a: 4, b: 2 }, 'a'),
    V('integrity', { a: 4, b: 2 }, 'a'),
  ], ['a', 'b']);
  const sum = summarize(s);
  assert.strictEqual(sum.recommended, 'a');
  assert.strictEqual(sum.strength, STRENGTH.STRONG);
  assert.strictEqual(sum.options, 2);
  assert.strictEqual(sum.survivors, 1);
  assert.strictEqual(sum.vetoed, 1);
  assert.strictEqual(sum.panel_complete, true);
});

// --- CLI seam: verdicts file ⇒ synthesised JSON end-to-end -------------------
test('CLI seam: --verdicts-file + --options flows to a deterministic recommendation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-synth-'));
  try {
    const run = (verdicts, opts) => {
      const file = path.join(tmp, 'verdicts.json');
      fs.writeFileSync(file, JSON.stringify(verdicts));
      const out = execFileSync('node', [LIB_PATH, '--verdicts-file', file, '--options', opts], { encoding: 'utf8' });
      return JSON.parse(out);
    };

    // STRONG: full panel converges on 'a'
    const strong = run([
      V('velocity', { a: 5, b: 2 }, 'a'),
      V('fidelity', { a: 4, b: 3 }, 'a'),
      V('integrity', { a: 4, b: 2 }, 'a'),
    ], 'a,b');
    assert.strictEqual(strong.recommended, 'a', 'CLI must relay the strong recommendation');
    assert.strictEqual(strong.strength, 'strong');
    assert.ok(strong.summary && strong.summary.recommended === 'a', 'the summary rides in the CLI output');

    // VETO: 'a' blocked by integrity ⇒ 'b' recommended, 'a' vetoed
    const vetoed = run([
      V('velocity', { a: 5, b: 3 }, 'a'),
      V('fidelity', { a: 5, b: 3 }, 'a'),
      V('integrity', { a: 0, b: 4 }, 'b', [{ option_id: 'a', concern: 'must not ship' }]),
    ], 'a,b');
    assert.strictEqual(vetoed.recommended, 'b', 'a vetoed option is never recommended');
    assert.deepStrictEqual(vetoed.vetoed, ['a']);
    assert.strictEqual(vetoed.strength, 'split');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: --verdicts inline JSON is accepted (test/agent convenience)', () => {
  const out = execFileSync('node', [
    LIB_PATH,
    '--verdicts', JSON.stringify([
      V('velocity', { a: 5, b: 2 }, 'a'),
      V('fidelity', { a: 4, b: 3 }, 'a'),
      V('integrity', { a: 4, b: 2 }, 'a'),
    ]),
    '--options', 'a,b',
  ], { encoding: 'utf8' });
  const s = JSON.parse(out);
  assert.strictEqual(s.recommended, 'a');
  assert.strictEqual(s.strength, 'strong');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
