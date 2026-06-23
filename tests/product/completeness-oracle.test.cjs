'use strict';
/**
 * Unit test for the completeness-oracle (Autonomous Pipeline Vision, Epic B / B1 core).
 *
 * Builds a throwaway .product/ fixture and exercises real scoring against the DoR
 * blockers — score, gaps, ambiguities, the delegated-unverified list, and `met`.
 *
 * Node stdlib only; run with `node tests/product/completeness-oracle.test.cjs`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const oracle = require(path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'completeness-oracle.cjs'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'ne'} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

// ---------- fixture builder ----------

function mkFixture(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-oracle-'));
  const product = path.join(root, '.product');
  for (const d of ['features', 'scenarios', 'verification', 'mockups', 'business-rules']) {
    fs.mkdirSync(path.join(product, d), { recursive: true });
  }
  const write = (dir, id, fm) => {
    const lines = ['---', `id: ${id}`, ...Object.entries(fm).map(([k, v]) =>
      `${k}: ${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`), '---', '', `# ${id}`, ''];
    fs.writeFileSync(path.join(product, dir, `${id}-x.md`), lines.join('\n'), 'utf-8');
  };
  spec(write);
  return product;
}

console.log('completeness-oracle — Epic B B1');

test('a fully-ready non-UI feature scores 1.0 and met=true', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-001', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'false', scenarios: ['SC-001'], rules: ['BR-001'], verification: ['VC-001'] });
    w('scenarios', 'SC-001', { type: 'scenario', status: 'active', feature: 'FM-001' });
    w('business-rules', 'BR-001', { type: 'business-rule', status: 'active' });
    w('verification', 'VC-001', { type: 'verification-criteria', status: 'active', scenario: 'SC-001' });
  });
  const r = oracle.scoreFeature('FM-001', product);
  eq(r.score, 1, 'score');
  eq(r.met, true, 'met');
  eq(r.gaps.length, 0, 'no gaps');
  assert(r.delegated_unverified.some((d) => d.id === 'B6'), 'B6 delegated reported');
  assert(/confirm delegated/.test(r.note), 'note warns about delegated checks even when met');
});

test('B4 accepts a LIST-form VC scenario (scenario: [SC-x, SC-y]) — real pilot shape, DEC-DEV-0099', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-100', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'false', scenarios: ['SC-100', 'SC-101'], verification: ['VC-100'] });
    w('scenarios', 'SC-100', { type: 'scenario', status: 'active', feature: 'FM-100' });
    w('scenarios', 'SC-101', { type: 'scenario', status: 'active', feature: 'FM-100' });
    // ONE VC covering a family of SCs via a list — the form real pilot VCs use
    w('verification', 'VC-100', { type: 'verification-criteria', status: 'active', scenario: ['SC-100', 'SC-101'] });
  });
  const r = oracle.scoreFeature('FM-100', product);
  const b4 = r.blockers.find((b) => b.id === 'B4');
  eq(b4.status, 'pass', 'B4 should pass with a list-form VC covering both SC');
  eq(r.met, true, 'feature met with list-form coverage');
});

test('B4 accepts the `scenarios:` (plural) field name too — real pilot uses both, DEC-DEV-0099', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-110', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'false', scenarios: ['SC-110'], verification: ['VC-110'] });
    w('scenarios', 'SC-110', { type: 'scenario', status: 'active', feature: 'FM-110' });
    // VC links via `scenarios:` (plural) — the billing-VC form in the pilot
    w('verification', 'VC-110', { type: 'verification-criteria', status: 'active', scenarios: ['SC-110'] });
  });
  const r = oracle.scoreFeature('FM-110', product);
  eq(r.blockers.find((b) => b.id === 'B4').status, 'pass', 'B4 should accept plural scenarios field');
  eq(r.met, true, 'feature met via plural-field VC');
});

test('B1 fails when FM is planned (not in-progress)', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-002', { type: 'feature-map-entry', status: 'planned', has_ui: 'false', scenarios: ['SC-002'], verification: ['VC-002'] });
    w('scenarios', 'SC-002', { type: 'scenario', status: 'active', feature: 'FM-002' });
    w('verification', 'VC-002', { type: 'verification-criteria', status: 'active', scenario: 'SC-002' });
  });
  const r = oracle.scoreFeature('FM-002', product);
  assert(r.met === false, 'should not be met');
  assert(r.gaps.some((g) => /B1/.test(g)), 'B1 gap reported');
  assert(r.score < 1, 'score below tau');
});

test('B4 fails (and is gapped) when an active SC has no active VC', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-003', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'false', scenarios: ['SC-003'] });
    w('scenarios', 'SC-003', { type: 'scenario', status: 'active', feature: 'FM-003' });
    // no VC
  });
  const r = oracle.scoreFeature('FM-003', product);
  assert(r.gaps.some((g) => /B4/.test(g)), 'B4 gap');
  assert(r.met === false, 'not met without VC coverage');
});

test('B7 fires only for has_ui features with no active MK', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-004', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'true', scenarios: ['SC-004'], verification: ['VC-004'], mockups: ['MK-004'] });
    w('scenarios', 'SC-004', { type: 'scenario', status: 'active', feature: 'FM-004' });
    w('verification', 'VC-004', { type: 'verification-criteria', status: 'active', scenario: 'SC-004' });
    w('mockups', 'MK-004', { type: 'mockup-package', status: 'draft', feature: 'FM-004' }); // draft, not active
  });
  const r = oracle.scoreFeature('FM-004', product);
  assert(r.gaps.some((g) => /B7/.test(g)), 'B7 gap for draft MK');
  const b7 = r.blockers.find((b) => b.id === 'B7');
  eq(b7.status, 'fail', 'B7 fail');
});

test('a draft SC surfaces as an ambiguity, not silently dropped', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-005', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'false', scenarios: ['SC-005', 'SC-006'] });
    w('scenarios', 'SC-005', { type: 'scenario', status: 'active', feature: 'FM-005' });
    w('scenarios', 'SC-006', { type: 'scenario', status: 'draft', feature: 'FM-005' });
    w('verification', 'VC-005', { type: 'verification-criteria', status: 'active', scenario: 'SC-005' });
  });
  const r = oracle.scoreFeature('FM-005', product);
  assert(r.ambiguities.some((a) => /SC-006.*draft/.test(a)), 'draft SC ambiguity surfaced');
});

test('a missing feature returns an explicit error, never a false 1.0', () => {
  const product = mkFixture(() => {});
  const r = oracle.scoreFeature('FM-999', product);
  assert(r.error && /not found/.test(r.error), 'error reported');
  eq(r.met, false, 'not met');
  eq(r.score, 0, 'score 0');
});

test('delegated blockers (B5/B6/B8) are always reported (no silent truncation)', () => {
  const product = mkFixture((w) => {
    w('features', 'FM-007', { type: 'feature-map-entry', status: 'in-progress', has_ui: 'false', scenarios: ['SC-007'], verification: ['VC-007'] });
    w('scenarios', 'SC-007', { type: 'scenario', status: 'active', feature: 'FM-007' });
    w('verification', 'VC-007', { type: 'verification-criteria', status: 'active', scenario: 'SC-007' });
  });
  const r = oracle.scoreFeature('FM-007', product);
  const ids = r.delegated_unverified.map((d) => d.id).sort();
  eq(ids.join(','), 'B5,B6,B8', 'all three delegated reported');
});

console.log(`\n${passed} assertions passed.`);
