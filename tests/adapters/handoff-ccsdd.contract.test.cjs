'use strict';
/**
 * Contract + content-fidelity regression test for adapters/handoff-to-ccsdd.js.
 *
 * Canonizes P0-1 (content-level verification oracle) from Orchestrator dogfood
 * RUN 01 (DEC-DEV-0073). Locks in three things the silent §10-sub-doc clobber
 * exposed:
 *   1. extractSections monotonic guard — restarted `## N.` UI sub-doc headers
 *      must NOT overwrite the real §1/§5/§6.
 *   2. C-03 supported-generator range includes v1.3/v1.4.
 *   3. C-07 content-fidelity is a BLOCKING gate (presence ≠ correctness): the
 *      mapped field must carry its section's canonical ID family (SC-/BR-/IC-).
 *
 * Node stdlib only; run with `node tests/adapters/handoff-ccsdd.contract.test.cjs`
 * or `npm run test:adapters`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  extractSections,
  validateContract,
  transformToCcSddInput,
  parseFrontmatter,
  stripFrontmatter,
} = require('../../adapters/handoff-to-ccsdd.js');

const FIX = path.join(__dirname, '..', 'fixtures');
const checkOf = (v, id) => v.checks.find((c) => c.id === id);

function loadFixture(file) {
  const raw = fs.readFileSync(path.join(FIX, file), 'utf8');
  const fm = parseFrontmatter(raw);
  const sections = extractSections(stripFrontmatter(raw));
  const validation = validateContract(fm, sections);
  const out = validation.passed ? transformToCcSddInput(fm, sections) : null;
  return { fm, sections, validation, out };
}

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

console.log('handoff-to-ccsdd contract + content-fidelity test (DEC-DEV-0073)');

// 1 — clean baseline still green
test('FM-FIXTURE-001 (clean v1.2) passes; mapping correct', () => {
  const { validation, out } = loadFixture('FM-FIXTURE-001-handoff.md');
  assert.strictEqual(validation.passed, true, 'contract should pass');
  assert.strictEqual(checkOf(validation, 'C-07').status, 'pass', 'C-07 content-fidelity pass');
  assert.match(out.spec_init_input.scenarios, /\bSC-\d/, 'scenarios carry SC- id');
  assert.match(out.spec_init_input.business_rules, /\bBR-\d/, 'business_rules carry BR- id');
});

// 2 — the regression: §10 UI sub-docs must not clobber real sections
test('FM-FIXTURE-002 (§10 UI sub-docs, v1.4) — real sections survive', () => {
  const { sections, validation, out } = loadFixture('FM-FIXTURE-002-handoff.md');
  assert.strictEqual(validation.passed, true, 'contract should pass');
  assert.strictEqual(checkOf(validation, 'C-03').status, 'pass', 'C-03 accepts v1.4 generator');
  assert.strictEqual(checkOf(validation, 'C-07').status, 'pass', 'C-07 content-fidelity pass');
  const si = out.spec_init_input;
  assert.match(si.description, /REAL-EXEC-SUMMARY-SENTINEL/, '§1 survives into description');
  assert.doesNotMatch(si.description, /Screen Inventory|Flow Diagram/, '§1 not overwritten by §10 sub-docs');
  assert.match(si.scenarios, /\bSC-\d/, '§5 scenarios survive (SC-)');
  assert.doesNotMatch(si.scenarios, /Accessibility/, '§5 not overwritten by UI Accessibility Notes');
  assert.match(si.business_rules, /\bBR-\d/, '§6 business_rules survive (BR-)');
  assert.doesNotMatch(si.business_rules, /Edge Cases/, '§6 not overwritten by UI Edge Cases');
  assert.match(si.invariants, /\bIC-\d/, '§9 invariants survive (IC-)');
  const sec10 = sections.get(10) ? sections.get(10).content : '';
  assert.match(sec10, /Accessibility Notes/, '§10 body absorbed the restarted MK sub-doc');
  assert.match(sec10, /Flow Diagram/, '§10 body absorbed the restarted NM sub-doc');
});

// 3 — extractSections monotonic guard, isolated
test('extractSections monotonic guard: restarted ## N. stays in parent body', () => {
  const body = [
    '## 5. Scenarios', 'SC-100 real', '',
    '## 10. UI Specification', 'ui intro', '',
    '## 5. Accessibility Notes', 'wcag here', '', // restart — must NOT overwrite §5
    '## 11. NFR', 'nfr body',
  ].join('\n');
  const s = extractSections(body);
  assert.match(s.get(5).content, /SC-100 real/, 'real §5 intact');
  assert.doesNotMatch(s.get(5).content, /wcag here/, '§5 not clobbered by restart');
  assert.match(s.get(10).content, /wcag here/, 'restarted ## 5. absorbed into §10 body');
  assert.ok(s.has(11), '§11 (>10) still accepted');
});

// 4 — negative: the C-07 oracle must BLOCK a clobbered mapping (proves it is a real gate)
test('C-07 blocks a clobbered §5 (no SC- id) — silent fidelity loss caught', () => {
  const fm = { feature: 'FM-902', status: 'ready', title: 'x', generator: 'product-module-v1.4.0' };
  const sections = new Map([
    [1, { title: 'Executive Summary', content: 'summary' }],
    [2, { title: 'Business Context', content: 'ctx' }],
    [5, { title: 'Accessibility Notes', content: 'WCAG 2.1 AA — no scenario id here' }], // clobbered §5
    [6, { title: 'Business Rules', content: '### BR-001 — rule' }],
    [9, { title: 'Invariants', content: '### IC-001 — inv' }],
    [13, { title: 'Out of Scope', content: 'oos' }],
  ]);
  const v = validateContract(fm, sections);
  assert.strictEqual(checkOf(v, 'C-07').status, 'fail', 'C-07 must FAIL on clobbered §5');
  assert.strictEqual(v.passed, false, 'blocking C-07 fail → contract not passed');
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
