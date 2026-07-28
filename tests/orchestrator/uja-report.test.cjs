'use strict';
/**
 * Unit test for the Orchestrator P8 uja-report lib (DEC-DEV-0225).
 *
 * WHAT IT PINS, and why:
 *  - THE VERDICT REDUCTION (pass / fail / empty). One *.spec.ts == one journey; a journey fails if
 *    ANY of its specs fails; the verdict is PASS | FAIL | ENV_NOT_READY. Exercised BOTH through the
 *    pure `parseReport(obj)` and the CLI `parse --report <file>` against real temp files.
 *  - THE ZERO-EVIDENCE RULE (the load-bearing safety property). A report with 0 journeys is
 *    ENV_NOT_READY (could-not-judge), NEVER a PASS — a gate that goes green on zero evidence is a
 *    false green (the "false DEPLOYED" class, one layer up). An unparseable / unreadable report is
 *    likewise ENV_NOT_READY, never a FAIL (could-not-judge ≠ code-failed — they route oppositely:
 *    re-run vs fix the journey).
 *  - DETERMINISM. The parse is a pure byte-reduction (no clock): N parses of one report are
 *    byte-identical (a stochastic verdict behind an acceptance gate is a coin-flip in both directions).
 *  - PREFLIGHT (Definition-of-Readiness). Playwright equipped (dep OR config) + journeys authored at
 *    the convention path — each missing piece yields an actionable DoR reason, never a fabricated pass.
 *
 * Node stdlib only; run with `node tests/orchestrator/uja-report.test.cjs`.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const LIB = path.join(ROOT, 'orchestrator', 'lib', 'uja-report.cjs');

const lib = require(LIB);
const { parseReport, readReport, assessPreflight } = lib;

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.stack || e.message); process.exitCode = 1; }
}
function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'uja-report-')); }

// ---- report fixtures (Playwright JSON reporter shape) -------------------------------------------
const spec = (title, ok) => ({ title, ok, file: undefined, tests: [{ results: [{ status: ok ? 'passed' : 'failed' }] }] });
const suite = (file, specs) => ({ file, specs: specs.map((s) => Object.assign({}, s, { file })) });

const PASS_REPORT = {
  config: { outputDir: 'test-results' },
  suites: [suite('login.spec.ts', [spec('logs in and reaches home', true)]),
    suite('checkout.spec.ts', [spec('buys an item', true)])],
  stats: { expected: 2, unexpected: 0 },
};
const FAIL_REPORT = {
  config: { outputDir: 'test-results' },
  suites: [suite('login.spec.ts', [spec('logs in and reaches home', false)]),
    suite('checkout.spec.ts', [spec('buys an item', true)])],
  stats: { expected: 1, unexpected: 1 },
};
const EMPTY_REPORT = { config: {}, suites: [], stats: { expected: 0, unexpected: 0 } };

console.log('orchestrator P8 — uja-report lib (DEC-DEV-0225)');

// ==== parseReport (pure core) ====================================================================

test('PASS: all journeys green ⇒ uja_result PASS, counts + artifacts_dir', () => {
  const v = parseReport(PASS_REPORT);
  assert.strictEqual(v.uja_result, 'PASS');
  assert.strictEqual(v.journeys_total, 2);
  assert.strictEqual(v.journeys_passed, 2);
  assert.deepStrictEqual(v.journeys_failed, []);
  assert.strictEqual(v.artifacts_dir, 'test-results', 'the report outputDir is surfaced as the visual-conformance artifacts dir');
});

test('FAIL: any journey with a failing spec ⇒ uja_result FAIL, the failing journey is named', () => {
  const v = parseReport(FAIL_REPORT);
  assert.strictEqual(v.uja_result, 'FAIL');
  assert.strictEqual(v.journeys_total, 2);
  assert.strictEqual(v.journeys_passed, 1);
  assert.strictEqual(v.journeys_failed.length, 1);
  assert.strictEqual(v.journeys_failed[0].journey, 'login.spec.ts');
  assert.deepStrictEqual(v.journeys_failed[0].failing, ['logs in and reaches home']);
});

test('EMPTY: 0 journeys ⇒ ENV_NOT_READY (the zero-evidence rule), NEVER a PASS', () => {
  const v = parseReport(EMPTY_REPORT);
  assert.strictEqual(v.uja_result, 'ENV_NOT_READY',
    'a report that exercised NO journey must NOT be a PASS — a green gate on zero evidence is a false green');
  assert.strictEqual(v.journeys_total, 0);
  assert.ok(/zero evidence|0 journeys|could-not-judge/i.test(v.reasons.join(' ')), 'the reason must explain the zero-evidence block');
});

test('a journey fails if ANY of its multiple specs fails (a broken step breaks the whole journey)', () => {
  const rep = { suites: [suite('flow.spec.ts', [spec('step 1', true), spec('step 2', false), spec('step 3', true)])] };
  const v = parseReport(rep);
  assert.strictEqual(v.uja_result, 'FAIL');
  assert.strictEqual(v.journeys_total, 1);
  assert.deepStrictEqual(v.journeys_failed[0].failing, ['step 2']);
});

test('nested describe suites are walked (specs one level down still count)', () => {
  const rep = { suites: [{ file: 'nested.spec.ts', specs: [], suites: [{ file: 'nested.spec.ts', specs: [Object.assign(spec('inner passes', true), { file: 'nested.spec.ts' })] }] }] };
  const v = parseReport(rep);
  assert.strictEqual(v.journeys_total, 1, 'the nested spec is discovered as a journey');
  assert.strictEqual(v.uja_result, 'PASS');
});

test('a spec with NO test results is NOT counted green (spec-level zero-evidence)', () => {
  const rep = { suites: [{ file: 'x.spec.ts', specs: [{ title: 'ran nothing', file: 'x.spec.ts' /* no ok, no tests */ }] }] };
  const v = parseReport(rep);
  assert.strictEqual(v.uja_result, 'FAIL', 'a spec that never produced a result must not pass');
});

test('spec.ok is authoritative when present; falls back to result statuses when absent', () => {
  // spec.ok=false wins even if a nested result looks passed
  const rep1 = { suites: [{ file: 'a.spec.ts', specs: [{ title: 't', ok: false, file: 'a.spec.ts', tests: [{ results: [{ status: 'passed' }] }] }] }] };
  assert.strictEqual(parseReport(rep1).uja_result, 'FAIL');
  // no ok field → derive from statuses (timedOut is a failure)
  const rep2 = { suites: [{ file: 'b.spec.ts', specs: [{ title: 't', file: 'b.spec.ts', tests: [{ results: [{ status: 'timedOut' }] }] }] }] };
  assert.strictEqual(parseReport(rep2).uja_result, 'FAIL');
});

test('a null / non-object / array report ⇒ ENV_NOT_READY (could-not-judge, never a throw)', () => {
  for (const bad of [null, undefined, 42, 'nope', []]) {
    const v = parseReport(bad);
    assert.strictEqual(v.uja_result, 'ENV_NOT_READY', `bad report ${JSON.stringify(bad)} must be ENV_NOT_READY`);
  }
});

// ==== determinism (the whole reason it is a lib) =================================================

test('DETERMINISM: N parses of one report are byte-identical (clock-free reduction)', () => {
  const hashes = new Set();
  for (let i = 0; i < 8; i += 1) hashes.add(crypto.createHash('sha256').update(JSON.stringify(parseReport(FAIL_REPORT))).digest('hex'));
  assert.strictEqual(hashes.size, 1, 'the same report must reduce to the same verdict every time');
});

// ==== CLI parse ==================================================================================

function cliParse(reportObj) {
  const base = mkTmp();
  const f = path.join(base, 'report.json');
  fs.writeFileSync(f, JSON.stringify(reportObj));
  const out = execFileSync(process.execPath, [LIB, 'parse', '--report', f], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('CLI parse: pass/fail/empty fixtures reduce to the right uja_result', () => {
  assert.strictEqual(cliParse(PASS_REPORT).uja_result, 'PASS');
  assert.strictEqual(cliParse(FAIL_REPORT).uja_result, 'FAIL');
  assert.strictEqual(cliParse(EMPTY_REPORT).uja_result, 'ENV_NOT_READY');
});

test('CLI parse: a missing report file ⇒ ENV_NOT_READY (could-not-judge), exit 0 (it is DATA)', () => {
  const out = execFileSync(process.execPath, [LIB, 'parse', '--report', path.join(mkTmp(), 'nope.json')], { encoding: 'utf8' });
  assert.strictEqual(JSON.parse(out).uja_result, 'ENV_NOT_READY');
});

test('CLI parse: an unparseable (non-JSON) report ⇒ ENV_NOT_READY, never a FAIL', () => {
  const base = mkTmp();
  const f = path.join(base, 'bad.json');
  fs.writeFileSync(f, 'this is not json {{{');
  const out = execFileSync(process.execPath, [LIB, 'parse', '--report', f], { encoding: 'utf8' });
  assert.strictEqual(JSON.parse(out).uja_result, 'ENV_NOT_READY', 'a broken report is could-not-judge, NOT a code FAIL');
});

test('CLI parse without --report exits 2 (usage error)', () => {
  let code = 0;
  try { execFileSync(process.execPath, [LIB, 'parse'], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { code = e.status; }
  assert.strictEqual(code, 2);
});

// readReport wrapper (FS)
test('readReport reads + reduces a report file; a read error is DATA, not a throw', () => {
  const base = mkTmp();
  const f = path.join(base, 'r.json');
  fs.writeFileSync(f, JSON.stringify(PASS_REPORT));
  assert.strictEqual(readReport(f).uja_result, 'PASS');
  assert.strictEqual(readReport(path.join(base, 'missing.json')).uja_result, 'ENV_NOT_READY');
});

// ==== preflight (Definition-of-Readiness) ========================================================

test('preflight: journeys present + Playwright dep ⇒ both present, journeys enumerated', () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, 'tests', 'uja'), { recursive: true });
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'login.spec.ts'), '// journey');
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'checkout.spec.ts'), '// journey');
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'helper.ts'), '// NOT a spec');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ devDependencies: { '@playwright/test': '^1.40.0' } }));
  const p = assessPreflight({ root: base, journeysDir: 'tests/uja' });
  assert.strictEqual(p.playwright_present, true);
  assert.strictEqual(p.journeys_present, true);
  assert.deepStrictEqual(p.journeys, ['checkout.spec.ts', 'login.spec.ts'], 'only *.spec.ts count, sorted; helper.ts excluded');
  assert.deepStrictEqual(p.reasons, []);
});

test('preflight: no journeys dir ⇒ journeys_present false + a DoR hint to author journeys', () => {
  const base = mkTmp();
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ devDependencies: { '@playwright/test': '^1.40.0' } }));
  const p = assessPreflight({ root: base, journeysDir: 'tests/uja' });
  assert.strictEqual(p.journeys_present, false);
  assert.ok(p.reasons.some((r) => /author/i.test(r) && /tests\/uja/.test(r)), 'a missing journeys dir must hint at authoring journeys');
});

test('preflight: no Playwright (no dep, no config) ⇒ playwright_present false + /integrator:add hint', () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, 'tests', 'uja'), { recursive: true });
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'login.spec.ts'), '// journey');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ devDependencies: {} }));
  const p = assessPreflight({ root: base, journeysDir: 'tests/uja' });
  assert.strictEqual(p.playwright_present, false);
  assert.ok(p.reasons.some((r) => /integrator:add playwright/i.test(r)), 'a missing Playwright must hint at /integrator:add playwright');
});

test('preflight: a playwright.config.* satisfies playwright_present even without a package.json dep', () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, 'tests', 'uja'), { recursive: true });
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'login.spec.ts'), '// journey');
  fs.writeFileSync(path.join(base, 'playwright.config.ts'), 'export default {}');
  const p = assessPreflight({ root: base, journeysDir: 'tests/uja' });
  assert.strictEqual(p.playwright_present, true, 'a playwright.config.ts is enough to consider Playwright equipped');
});

test('CLI preflight prints JSON + exits 0 (a not-ready target is DATA)', () => {
  const base = mkTmp();
  const out = execFileSync(process.execPath, [LIB, 'preflight', '--root', base, '--journeys-dir', 'tests/uja'], { encoding: 'utf8' });
  const j = JSON.parse(out);
  assert.strictEqual(j.playwright_present, false);
  assert.strictEqual(j.journeys_present, false);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
