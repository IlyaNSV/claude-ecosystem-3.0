'use strict';
/**
 * Unit test for the gap-classifier (Autonomous Pipeline Vision, Epic B / B-b wave-runner).
 *
 * Exercises CLASSIFY (oracle-gap-prefix + persona-category disposition maps, dedupe) and the
 * stop-verdict (met/cap/converged/decisions_only/continue) as pure functions, plus a CLI
 * round-trip through a real `node` child process.
 *
 * Node stdlib only; run with `node tests/product/gap-classifier.test.cjs`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'gap-classifier.cjs');
const classifier = require(LIB_PATH);

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'ne'} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

console.log('gap-classifier — Epic B B-b');

// ---------- oracle gap prefix -> disposition ----------

test('B4 (active SC without VC) classifies resolvable/missing-vc', () => {
  const r = classifier.classifyGaps({ oracle: { gaps: ['B4: 2 active SC have no active VC: SC-001, SC-002'] } });
  eq(r.resolvable.length, 1, 'one resolvable item');
  eq(r.decisions.length, 0, 'no decisions');
  eq(r.resolvable[0].category, 'missing-vc', 'category');
  eq(r.resolvable[0].source, 'oracle', 'source');
});

test('B1/B2/B3/B7 each classify as decision with their mapped category', () => {
  const r = classifier.classifyGaps({
    oracle: {
      gaps: [
        "B1: FM FM-001 is 'planned', not in-progress",
        'B2: no active SC for FM-003',
        'B3: BR not found: BR-009',
        'B7: has_ui feature FM-004 has no active MK',
      ],
    },
  });
  eq(r.resolvable.length, 0, 'no resolvable items');
  eq(r.decisions.length, 4, 'four decisions');
  const byCategory = Object.fromEntries(r.decisions.map((d) => [d.category, d]));
  eq(byCategory['fm-status'].source, 'oracle', 'B1 -> fm-status');
  eq(byCategory['missing-sc'].source, 'oracle', 'B2 -> missing-sc');
  eq(byCategory['br-inactive'].source, 'oracle', 'B3 -> br-inactive');
  eq(byCategory['missing-mk'].source, 'oracle', 'B7 -> missing-mk');
});

test('ambiguities[] always classify as decision/broken-ref, never dropped', () => {
  const r = classifier.classifyGaps({
    oracle: { ambiguities: ['SC SC-009 referenced by FM-003 but file not found'] },
  });
  eq(r.decisions.length, 1, 'one decision');
  eq(r.decisions[0].category, 'broken-ref', 'category broken-ref');
  eq(r.decisions[0].artifact_id, 'SC-009', 'artifact id extracted');
});

test('an unknown/no-prefix oracle gap conservatively classifies as decision/other', () => {
  const r = classifier.classifyGaps({ oracle: { gaps: ['some unprefixed free-text gap'] } });
  eq(r.decisions.length, 1, 'one decision');
  eq(r.decisions[0].category, 'other', 'category other');
});

// ---------- persona finding category -> disposition ----------

test('all four resolvable persona categories classify resolvable', () => {
  const categories = ['missing-vc', 'missing-lc', 'lc-unlinked-state', 'rpm-role-gap'];
  const r = classifier.classifyGaps({
    persona_findings: categories.map((category, i) => ({
      persona: 'qa-advisor',
      artifact_id: `SC-${100 + i}`,
      zone: 'verification',
      category,
      description: `gap ${category}`,
    })),
  });
  eq(r.resolvable.length, categories.length, 'all resolvable');
  eq(r.decisions.length, 0, 'none decided');
  const gotCategories = r.resolvable.map((x) => x.category).sort();
  eq(gotCategories.join(','), categories.slice().sort().join(','), 'categories preserved');
});

test('a persona finding with an unrecognized category conservatively classifies decision/other', () => {
  const r = classifier.classifyGaps({
    persona_findings: [{ persona: 'architect-advisor', artifact_id: 'FM-050', category: 'totally-unknown-category', description: 'x' }],
  });
  eq(r.resolvable.length, 0, 'no resolvable');
  eq(r.decisions.length, 1, 'one decision');
  eq(r.decisions[0].category, 'other', 'category coerced to other');
});

// ---------- dedupe ----------

test('the same gap surfaced by both oracle and a persona dedupes — oracle wins', () => {
  const r = classifier.classifyGaps({
    oracle: { gaps: ['B4: 1 active SC have no active VC: SC-001'] },
    persona_findings: [
      { persona: 'qa-advisor', artifact_id: 'SC-001', zone: 'verification', category: 'missing-vc', description: 'SC-001 has no VC' },
    ],
  });
  eq(r.resolvable.length, 1, 'deduped to one entry');
  eq(r.resolvable[0].source, 'oracle', 'oracle wins the collision');
  eq(r.counts.oracle_gaps, 1, 'raw oracle count preserved');
  eq(r.counts.persona_findings, 1, 'raw persona count preserved (even though its item was dropped)');
});

// ---------- stop contract ----------

test('stop fires met when the oracle is met and nothing resolved this wave', () => {
  const r = classifier.shouldStop({ met: true, resolvedLastWave: 0, wave: 1, maxWaves: 3 });
  eq(r.fire, true, 'fires');
  eq(r.status, 'met', 'status met');
});

test('met does NOT fire stop if something was resolved this wave (still in progress)', () => {
  const r = classifier.shouldStop({ met: true, resolvedLastWave: 2, wave: 1, maxWaves: 3 });
  eq(r.status, 'continue', 'met alone insufficient — resolved_last_wave gates it');
});

test('stop fires cap at wave == max_waves', () => {
  const r = classifier.shouldStop({ met: false, wave: 3, maxWaves: 3 });
  eq(r.fire, true, 'fires');
  eq(r.status, 'cap', 'status cap');
});

test('stop fires converged when |score - prev_score| < epsilon', () => {
  const r = classifier.shouldStop({ met: false, wave: 2, maxWaves: 3, score: 0.8, prevScore: 0.795, epsilon: 0.01 });
  eq(r.fire, true, 'fires');
  eq(r.status, 'converged', 'status converged');
});

test('stop fires decisions_only when nothing resolvable remains but decisions do', () => {
  const r = classifier.shouldStop({ met: false, wave: 1, maxWaves: 3, resolvableCount: 0, decisionsCount: 2 });
  eq(r.fire, true, 'fires');
  eq(r.status, 'decisions_only', 'status decisions_only');
});

test('stop does not fire (continue) when none of the conditions hold', () => {
  const r = classifier.shouldStop({ met: false, wave: 1, maxWaves: 3, score: 0.5, prevScore: 0.2, epsilon: 0.01, resolvableCount: 3, decisionsCount: 1 });
  eq(r.fire, false, 'does not fire');
  eq(r.status, 'continue', 'status continue');
  eq(r.reasons.length, 0, 'no reasons collected');
});

test('multiple stop conditions co-fire — reasons collects all, status is the first match (met)', () => {
  // met (resolved_last_wave=0) AND cap (wave>=max_waves) both hold simultaneously.
  const r = classifier.shouldStop({ met: true, resolvedLastWave: 0, wave: 3, maxWaves: 3 });
  eq(r.fire, true, 'fires');
  eq(r.status, 'met', 'met takes priority over cap');
  assert(r.reasons.length >= 2, 'both reasons collected');
});

test('classifyGaps folds the stop verdict into its output using oracle/wave/epsilon fields', () => {
  const r = classifier.classifyGaps({
    oracle: { score: 1, prev_score: null, tau: 1.0, met: true, gaps: [], ambiguities: [] },
    persona_findings: [],
    wave: 1,
    max_waves: 3,
    epsilon: 0.01,
    resolved_last_wave: 0,
  });
  eq(r.stop.fire, true, 'fires');
  eq(r.stop.status, 'met', 'status met');
  eq(r.counts.resolvable, 0, 'no resolvable');
  eq(r.counts.decisions, 0, 'no decisions');
});

// ---------- defensive defaults ----------

test('classifyGaps({}) does not throw and returns a well-shaped, continue result', () => {
  const r = classifier.classifyGaps({});
  eq(r.resolvable.length, 0, 'no resolvable');
  eq(r.decisions.length, 0, 'no decisions');
  eq(r.stop.status, 'continue', 'continue by default');
  eq(r.counts.oracle_gaps, 0, 'zero oracle gaps');
  eq(r.counts.persona_findings, 0, 'zero persona findings');
});

test('classifyGaps(undefined) does not throw', () => {
  const r = classifier.classifyGaps(undefined);
  eq(r.resolvable.length, 0, 'no resolvable');
  eq(r.stop.status, 'continue', 'continue');
});

// ---------- CLI round-trip ----------

test('CLI round-trip: node gap-classifier.cjs <input.json> prints the same shape as the lib call', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-gap-classifier-'));
  const inputPath = path.join(tmpDir, 'input.json');
  const input = {
    oracle: { score: 0.8, prev_score: null, tau: 1.0, met: false, gaps: ['B4: 1 active SC have no active VC: SC-001'], ambiguities: [] },
    persona_findings: [],
    wave: 1,
    max_waves: 3,
    epsilon: 0.01,
    resolved_last_wave: 0,
  };
  fs.writeFileSync(inputPath, JSON.stringify(input), 'utf-8');
  const stdout = execFileSync(process.execPath, [LIB_PATH, inputPath], { encoding: 'utf-8' });
  const parsed = JSON.parse(stdout);
  eq(parsed.resolvable.length, 1, 'one resolvable via CLI');
  eq(parsed.resolvable[0].category, 'missing-vc', 'category via CLI');
  eq(parsed.stop.status, 'continue', 'not met yet -> continue');
  const direct = classifier.classifyGaps(input);
  eq(JSON.stringify(parsed), JSON.stringify(direct), 'CLI output matches direct lib call byte-for-byte');
});

test('CLI usage error (no args) exits 2 and writes to stderr', () => {
  let threw = false;
  try {
    execFileSync(process.execPath, [LIB_PATH], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    threw = true;
    eq(e.status, 2, 'exit code 2');
    assert(/usage/i.test(e.stderr), 'stderr mentions usage');
  }
  assert(threw, 'process should have exited non-zero');
});

test('CLI invalid JSON exits 2 and writes to stderr', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-gap-classifier-badjson-'));
  const inputPath = path.join(tmpDir, 'input.json');
  fs.writeFileSync(inputPath, '{ this is not json', 'utf-8');
  let threw = false;
  try {
    execFileSync(process.execPath, [LIB_PATH, inputPath], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    threw = true;
    eq(e.status, 2, 'exit code 2');
    assert(/invalid JSON/i.test(e.stderr), 'stderr mentions invalid JSON');
  }
  assert(threw, 'process should have exited non-zero');
});

console.log(`\n${passed} assertions passed.`);
