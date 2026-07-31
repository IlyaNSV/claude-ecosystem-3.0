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

test('SKIPPED specs are SURFACED (specs_skipped + a reason), never silent — and do not fail the verdict', () => {
  const skippedSpec = { title: 'library with data (designed, not built)', ok: true, file: 'dashboard.spec.ts', tests: [{ results: [{ status: 'skipped' }] }] };
  const rep = { suites: [{ file: 'dashboard.spec.ts', specs: [Object.assign(spec('empty state renders', true), { file: 'dashboard.spec.ts' }), skippedSpec] }] };
  const v = parseReport(rep);
  assert.strictEqual(v.uja_result, 'PASS', 'an explicit skip does not fail the verdict');
  assert.strictEqual(v.specs_skipped.length, 1);
  assert.strictEqual(v.specs_skipped[0].journey, 'dashboard.spec.ts');
  assert.deepStrictEqual(v.specs_skipped[0].skipped, ['library with data (designed, not built)']);
  assert.ok(/SKIPPED/.test(v.reasons.join(' ')), 'every skip must be NAMED in the verdict (the designed-but-unbuilt class must be visible, pilot finding #8)');
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
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'neg-guest-protected.spec.ts'), '// negative access journey');
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'helper.ts'), '// NOT a spec');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ devDependencies: { '@playwright/test': '^1.40.0' } }));
  const p = assessPreflight({ root: base, journeysDir: 'tests/uja' });
  assert.strictEqual(p.playwright_present, true);
  assert.strictEqual(p.journeys_present, true);
  assert.deepStrictEqual(p.journeys, ['checkout.spec.ts', 'login.spec.ts', 'neg-guest-protected.spec.ts'], 'only *.spec.ts count, sorted; helper.ts excluded');
  assert.strictEqual(p.negative_present, true, 'neg-*.spec.ts is recognized as the negative access leg');
  assert.deepStrictEqual(p.negative_journeys, ['neg-guest-protected.spec.ts']);
  assert.deepStrictEqual(p.reasons, []);
});

test('preflight: positive-only suite ⇒ negative_present false + an RPM-Access-Matrix DoR hint (DEC-DEV-0230)', () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, 'tests', 'uja'), { recursive: true });
  fs.writeFileSync(path.join(base, 'tests', 'uja', 'login.spec.ts'), '// journey');
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ devDependencies: { '@playwright/test': '^1.40.0' } }));
  const p = assessPreflight({ root: base, journeysDir: 'tests/uja' });
  assert.strictEqual(p.journeys_present, true);
  assert.strictEqual(p.negative_present, false, 'a positive-only suite is NOT equipped (the cross-realm-hole class ships behind green positive runs)');
  assert.ok(p.reasons.some((r) => /neg-\*\.spec\.ts/.test(r) && /Access Matrix/i.test(r)),
    'the DoR hint must name the neg-*.spec.ts convention and the RPM Access Matrix as the source');
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

// ==== visual conformance (DEC-DEV-0237) ==========================================================
//
// WHAT THIS LEG PINS: green journeys prove the flow WORKS; they say nothing about whether the
// DESIGNED screens were built. The gate intersects each has_ui feature's active MK Screen Inventory
// (`SI-<n>` rows) with the files the run captured under <artifacts>/visual/<MK-id>/. The load-bearing
// properties, each with its own failure mode:
//   · zero evidence ≠ green (no visual/ dir at all ⇒ INCOMPLETE, never COMPLETE);
//   · BLIND ≠ pass (missing FM/MK, empty mockups[], unparseable Screen Inventory ⇒ INCOMPLETE + a
//     reason — the gate must never answer "conformant" to a question it could not read);
//   · a skip is a DISCLOSURE, not a mute button (declared + reasoned ⇒ COMPLETE_WITH_SKIPS and named
//     in reasons; unreasoned ⇒ it does NOT close the hole);
//   · SI-1 must never be satisfied by SI-10.png (an off-by-nine false green).
// Fixtures are injected (readFile/readdir/exists), like assessPreflight — no temp FS in the matrix.

const { assessVisualEvidence } = lib;
const FX = path.resolve(path.sep + 'uja-fx');   // a fake absolute root; nothing is ever written

/** Inject a virtual FS: files = { 'rel/path': content }, dirs = ['rel/path', …] (empty dirs). */
function vfs(root, files, dirs) {
  const F = new Map();
  const D = new Set([root]);
  const abs = (p) => path.join(root, ...String(p).split('/'));
  const parents = (a) => {
    let d = path.dirname(a);
    for (let i = 0; i < 32 && d && d !== path.dirname(d); i += 1) { D.add(d); if (d === root) break; d = path.dirname(d); }
  };
  for (const [p, c] of Object.entries(files || {})) { const a = abs(p); F.set(a, String(c)); parents(a); }
  for (const p of (dirs || [])) { const a = abs(p); D.add(a); parents(a); }
  const enoent = (p) => { const e = new Error(`ENOENT: ${p}`); e.code = 'ENOENT'; throw e; };
  return {
    root,
    readFile: (p) => (F.has(p) ? F.get(p) : enoent(p)),
    readdir: (p) => {
      if (!D.has(p)) return enoent(p);
      const out = new Set();
      for (const f of F.keys()) if (path.dirname(f) === p) out.add(path.basename(f));
      for (const d of D) if (d !== p && path.dirname(d) === p) out.add(path.basename(d));
      return [...out].sort();
    },
    exists: (p) => F.has(p) || D.has(p),
    // the virtual FS knows the difference a bare listing cannot express: a name in `dirs` is a
    // DIRECTORY, however file-shaped it looks (`SI-1.png/`).
    isFile: (p) => F.has(p),
  };
}

const fmDoc = (id, hasUi, mockups) => ['---', `id: ${id}`, 'type: feature-map-entry',
  `has_ui: ${hasUi}                   # активирует Design Module`,
  `mockups: [${(mockups || []).join(', ')}]`, 'status: in-progress', '---', '', `# ${id}`, ''].join('\n');

/** An MK with a canonical Screen Inventory table (docs/pmo/artifacts/MK.md §Screen Inventory формат). */
const mkDoc = (id, feature, sis, status, nl) => {
  const eol = nl || '\n';
  return ['---', `id: ${id}`, 'type: mockup-package', `feature: ${feature}`, `status: ${status || 'active'}`, '---', '',
    '## 1. Screen Inventory', '',
    '| Screen ID | Title      | Type   | SC step  | Purpose |',
    '|-----------|------------|--------|----------|---------|',
    ...(sis || []).map((si, i) => `| ${si}      | Screen ${i + 1}   | screen | SC-001/${i + 1} | purpose |`),
    ''].join(eol);
};

test('visual N/A: no has_ui feature in scope ⇒ N/A said EXPLICITLY (an empty scope is not a pass-by-default)', () => {
  const fs1 = vfs(FX, { '.product/features/FM-001-api.md': fmDoc('FM-001', 'false', []) });
  const v = assessVisualEvidence({ root: FX, features: ['FM-001'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'N/A');
  assert.deepStrictEqual(v.mk_scope, []);
  assert.ok(/has_ui/.test(v.reasons.join(' ')), 'the N/A must SAY why (no has_ui feature), never be silent');

  const v2 = assessVisualEvidence({ root: FX, features: [], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v2.visual_evidence, 'N/A');
  assert.ok(/no features supplied/i.test(v2.reasons.join(' ')), 'an empty scope must be named as such (the DoD gate reads this)');
});

test('visual COMPLETE: every designed SI has a file — suffixed slugs and .jpg/.webp count', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2', 'SI-3']),
    'test-results/visual/MK-003/SI-1.png': 'x',
    'test-results/visual/MK-003/SI-2-empty-state.jpg': 'x',
    'test-results/visual/MK-003/SI-3.webp': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'COMPLETE');
  assert.strictEqual(v.mk_scope.length, 1);
  assert.strictEqual(v.mk_scope[0].mk, 'MK-003');
  assert.strictEqual(v.mk_scope[0].feature, 'FM-003');
  assert.strictEqual(v.mk_scope[0].si_total, 3);
  assert.deepStrictEqual(v.mk_scope[0].si_covered, ['SI-1', 'SI-2', 'SI-3']);
  assert.deepStrictEqual(v.mk_scope[0].si_missing, []);
});

test('visual: SI-1 is NOT satisfied by SI-10.png (word-boundary prefix — the off-by-nine false green)', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-10']),
    'test-results/visual/MK-003/SI-10.png': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.deepStrictEqual(v.mk_scope[0].si_covered, ['SI-10']);
  assert.deepStrictEqual(v.mk_scope[0].si_missing, ['SI-1'], 'SI-10.png must not count as evidence for SI-1');
});

test('visual INCOMPLETE: the reason carries the EXACT expected path (a self-healing hint, not a scolding)', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2']),
    'test-results/visual/MK-003/SI-1.png': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.deepStrictEqual(v.mk_scope[0].si_missing, ['SI-2']);
  assert.strictEqual(v.mk_scope[0].evidence_dir, 'test-results/visual/MK-003');
  const joined = v.reasons.join(' ');
  assert.ok(joined.includes('test-results/visual/MK-003/SI-2.png'), `the exact expected path must be in the reason; got: ${joined}`);
  assert.ok(joined.includes('tests/uja/visual-skips.json'), 'the reason must name the declare-a-skip alternative');
});

test('visual: NO visual/ dir at all ⇒ INCOMPLETE (zero evidence is not a green), and it is SAID', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2']),
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE', 'a run that captured nothing must never be COMPLETE');
  assert.deepStrictEqual(v.mk_scope[0].si_missing, ['SI-1', 'SI-2']);
  assert.ok(/does not exist/.test(v.reasons.join(' ')), 'the absent evidence dir must be named, not inferred from the per-SI list');
});

test('visual COMPLETE_WITH_SKIPS: a reasoned declared skip closes the hole and is SURFACED', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-4']),
    'test-results/visual/MK-003/SI-1.png': 'x',
    'tests/uja/visual-skips.json': JSON.stringify([{ mk: 'MK-003', si: 'SI-4', reason: 'dismiss dialog designed, not built yet (RL-2)' }]),
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'COMPLETE_WITH_SKIPS');
  assert.deepStrictEqual(v.mk_scope[0].si_missing, []);
  assert.deepStrictEqual(v.mk_scope[0].si_skipped, [{ si: 'SI-4', reason: 'dismiss dialog designed, not built yet (RL-2)' }]);
  assert.ok(/SI-4: dismiss dialog designed/.test(v.reasons.join(' ')), 'every skip must be NAMED (surface, don\'t fail — pilot finding #8)');
});

test('visual: a skip with NO reason does NOT close the hole (silence with extra steps) ⇒ INCOMPLETE + a reason', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-4']),
    'test-results/visual/MK-003/SI-1.png': 'x',
    'tests/uja/visual-skips.json': JSON.stringify([{ mk: 'MK-003', si: 'SI-4', reason: '   ' }]),
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.deepStrictEqual(v.mk_scope[0].si_missing, ['SI-4']);
  assert.ok(/carries NO reason/.test(v.reasons.join(' ')), 'an unreasoned skip must be called out');
});

test('visual: a skip for an SI outside the judged scope is SURFACED (a stale skip is not coverage)', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1']),
    'test-results/visual/MK-003/SI-1.png': 'x',
    'tests/uja/visual-skips.json': JSON.stringify([{ mk: 'MK-003', si: 'SI-9', reason: 'was dropped in iteration 2' }]),
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'COMPLETE', 'a stale skip does not change the verdict…');
  assert.ok(/not in the judged visual scope/i.test(v.reasons.join(' ')), '…but it must be surfaced');
});

test('visual: an MK with no parseable Screen Inventory ⇒ INCOMPLETE + a named reason (blind ≠ pass, blind ≠ silence)', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': ['---', 'id: MK-003', 'status: active', '---', '', '## 1. Screen Inventory', '', 'TODO: draw the table', ''].join('\n'),
    'test-results/visual/MK-003/SI-1.png': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.ok(/no parseable Screen Inventory rows/.test(v.reasons.join(' ')));
  assert.strictEqual(v.mk_scope[0].si_total, 0, 'the blind MK is still listed in the scope (auditable), with 0 states');
});

test('visual: CRLF artifacts parse identically (the DEC-DEV-0190 lesson — no trailing \\r in ids/values)', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']).replace(/\n/g, '\r\n'),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2'], 'active', '\r\n'),
    'test-results/visual/MK-003/SI-1.png': 'x',
    'test-results/visual/MK-003/SI-2.png': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'COMPLETE', 'a CRLF checkout must not turn has_ui/status/SI ids into misses');
  assert.deepStrictEqual(v.mk_scope[0].si_covered, ['SI-1', 'SI-2']);
});

test('visual: several MKs per feature — SI numbers are keyed BY MK, never pooled', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003', 'MK-004']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2']),
    '.product/mockups/MK-004-settings.md': mkDoc('MK-004', 'FM-003', ['SI-1', 'SI-2']),
    // MK-003 fully captured; MK-004 has only SI-1 — the shared SI numbering must NOT cross-cover
    'test-results/visual/MK-003/SI-1.png': 'x',
    'test-results/visual/MK-003/SI-2.png': 'x',
    'test-results/visual/MK-004/SI-1.png': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.strictEqual(v.mk_scope.length, 2);
  const byMk = Object.fromEntries(v.mk_scope.map((m) => [m.mk, m]));
  assert.deepStrictEqual(byMk['MK-003'].si_missing, []);
  assert.deepStrictEqual(byMk['MK-004'].si_missing, ['SI-2'], 'MK-003/SI-2.png must not cover MK-004/SI-2');
  assert.ok(v.reasons.join(' ').includes('test-results/visual/MK-004/SI-2.png'));
});

test('visual: a has_ui feature with an EMPTY mockups[] ⇒ INCOMPLETE + a design-gap reason (judging nothing ≠ conformant)', () => {
  const fs1 = vfs(FX, { '.product/features/FM-007-ui.md': fmDoc('FM-007', 'true', []) }, ['.product/mockups', 'test-results/visual']);
  const v = assessVisualEvidence({ root: FX, features: ['FM-007'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.deepStrictEqual(v.mk_scope, []);
  assert.ok(/mockups\[\] is EMPTY/.test(v.reasons.join(' ')) && /design gap/i.test(v.reasons.join(' ')),
    'an empty mockups[] on a has_ui feature is a DESIGN gap the gate must name, not swallow');
});

test('visual: only an ACTIVE MK is a design contract — a draft is out of scope, and an all-draft feature is INCOMPLETE', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1'], 'draft'),
  }, ['test-results/visual']);
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE', 'a has_ui feature whose MKs are all non-active leaves the scope unknown');
  assert.deepStrictEqual(v.mk_scope, []);
  assert.ok(/status='draft'/.test(v.reasons.join(' ')) && /ACTIVE MK/.test(v.reasons.join(' ')));
});

test('visual: an unreadable FM / a missing MK file ⇒ INCOMPLETE (could-not-judge, never a silent COMPLETE)', () => {
  const noFm = vfs(FX, {}, ['.product/features', 'test-results/visual']);
  const v1 = assessVisualEvidence({ root: FX, features: ['FM-042'], readFile: noFm.readFile, readdir: noFm.readdir, exists: noFm.exists });
  assert.strictEqual(v1.visual_evidence, 'INCOMPLETE', 'an unresolvable FM must not degrade to N/A — that would read as "no UI here"');
  assert.ok(/has_ui is UNKNOWN/.test(v1.reasons.join(' ')));

  const noMk = vfs(FX, { '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']) }, ['.product/mockups', 'test-results/visual']);
  const v2 = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: noMk.readFile, readdir: noMk.readdir, exists: noMk.exists });
  assert.strictEqual(v2.visual_evidence, 'INCOMPLETE');
  assert.ok(/no readable MK/.test(v2.reasons.join(' ')));
});

test('visual: a malformed visual-skips.json is DATA (a reason), never a throw — and it closes nothing', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1']),
    'tests/uja/visual-skips.json': '{{ not json',
  }, ['test-results/visual']);
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE');
  assert.ok(/not valid JSON/.test(v.reasons.join(' ')));
});

test('visual DETERMINISM: N assessments of one tree are byte-identical', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2']),
    'test-results/visual/MK-003/SI-1.png': 'x',
  });
  const hashes = new Set();
  for (let i = 0; i < 8; i += 1) {
    hashes.add(crypto.createHash('sha256').update(JSON.stringify(assessVisualEvidence({
      root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists,
    }))).digest('hex'));
  }
  assert.strictEqual(hashes.size, 1);
});

test('CLI visual: reads a real tree, prints JSON + exits 0 (a non-conformant target is DATA)', () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, '.product', 'features'), { recursive: true });
  fs.mkdirSync(path.join(base, '.product', 'mockups'), { recursive: true });
  fs.mkdirSync(path.join(base, 'test-results', 'visual', 'MK-003'), { recursive: true });
  fs.writeFileSync(path.join(base, '.product', 'features', 'FM-003-inbox.md'), fmDoc('FM-003', 'true', ['MK-003']));
  fs.writeFileSync(path.join(base, '.product', 'mockups', 'MK-003-inbox.md'), mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2']));
  fs.writeFileSync(path.join(base, 'test-results', 'visual', 'MK-003', 'SI-1.png'), 'x');
  const out = execFileSync(process.execPath, [LIB, 'visual', '--root', base, '--features', 'FM-003', '--artifacts-dir', 'test-results'], { encoding: 'utf8' });
  const j = JSON.parse(out);
  assert.strictEqual(j.visual_evidence, 'INCOMPLETE');
  assert.strictEqual(j.uja_report_schema_version, lib.UJA_REPORT_SCHEMA_VERSION);
  assert.deepStrictEqual(j.mk_scope[0].si_missing, ['SI-2']);

  fs.writeFileSync(path.join(base, 'test-results', 'visual', 'MK-003', 'SI-2-with-data.png'), 'x');
  const out2 = execFileSync(process.execPath, [LIB, 'visual', '--root', base, '--features', 'FM-003', '--artifacts-dir', 'test-results'], { encoding: 'utf8' });
  assert.strictEqual(JSON.parse(out2).visual_evidence, 'COMPLETE', 'capturing the missing state flips the gate green');
});

test('CLI visual without --features is DATA (N/A + a reason), NOT a usage error — the transport must not break', () => {
  const out = execFileSync(process.execPath, [LIB, 'visual', '--root', mkTmp()], { encoding: 'utf8' });
  assert.strictEqual(JSON.parse(out).visual_evidence, 'N/A');
});

// ── the inventory is the SECTION, not the document (a decoy SI row must not inflate it) ─────────

test('SI scope: an `| SI-9 |` row in ANOTHER section is NOT a designed state (no phantom INCOMPLETE)', () => {
  // A Component State Matrix legitimately cites SI ids. Read document-wide, every such citation
  // became a designed screen no screenshot could ever cover ⇒ a release blocked by a cross-reference.
  const mkWithDecoy = [
    '---', 'id: MK-003', 'type: mockup-package', 'feature: FM-003', 'status: active', '---', '',
    '## 1. Screen Inventory', '',
    '| Screen ID | Title | Type | SC step | Purpose |',
    '|---|---|---|---|---|',
    '| SI-1 | Inbox | screen | SC-001/1 | list |',
    '',
    '## 2. Component State Matrix', '',
    '| Screen ID | Component | State |',
    '|---|---|---|',
    '| SI-9 | Toast | error |',       // ← a citation, not a designed screen of this inventory
    '',
  ].join('\n');
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkWithDecoy,
    'test-results/visual/MK-003/SI-1.png': 'x',
  });
  assert.deepStrictEqual(lib.screenInventoryIds(mkWithDecoy), ['SI-1'],
    'SI-9 lives outside the Screen Inventory section — it is not part of the designed inventory');
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'COMPLETE', 'the decoy row must not manufacture a missing state');
  assert.deepStrictEqual(v.mk_scope[0].si_missing, []);
});

test('SI scope: no Screen Inventory HEADING ⇒ no parseable rows ⇒ BLIND (INCOMPLETE + a reason), never a pass', () => {
  const headless = [
    '---', 'id: MK-004', 'type: mockup-package', 'feature: FM-004', 'status: active', '---', '',
    '| SI-1 | Inbox | screen | SC-001/1 | list |', '',
  ].join('\n');
  assert.deepStrictEqual(lib.screenInventoryIds(headless), [], 'rows outside any section are not an inventory');
  const fs1 = vfs(FX, {
    '.product/features/FM-004-x.md': fmDoc('FM-004', 'true', ['MK-004']),
    '.product/mockups/MK-004-x.md': headless,
  }, ['test-results/visual']);
  const v = assessVisualEvidence({ root: FX, features: ['FM-004'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE', 'blind ≠ pass — the existing behaviour is preserved');
  assert.ok(/no parseable Screen Inventory rows/.test(v.reasons.join(' ')), 'and it says so');
});

test('SI scope: a `### Screen Inventory` sub-section ends at the next same-or-higher heading', () => {
  const nested = [
    '### Screen Inventory', '',
    '| SI-1 | A | screen | SC-1/1 | x |',
    '| SI-2 | B | screen | SC-1/2 | x |', '',
    '### Interaction Spec', '',
    '| SI-7 | cited elsewhere | — | — | — |', '',
  ].join('\n');
  assert.deepStrictEqual(lib.screenInventoryIds(nested), ['SI-1', 'SI-2'], 'the section stops at the sibling heading');
});

// ── a directory is not evidence (listSafe/isFile) ────────────────────────────────────────────────

test('evidence: a DIRECTORY named SI-1.png is NOT a screenshot (an empty dir must never close a gap)', () => {
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1']),
  }, ['test-results/visual/MK-003/SI-1.png']);   // ← a DIRECTORY wearing a screenshot's name
  const v = assessVisualEvidence({
    root: FX, features: ['FM-003'],
    readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists, isFile: fs1.isFile,
  });
  assert.strictEqual(v.visual_evidence, 'INCOMPLETE',
    'a listing entry is a NAME, not a file — `mkdir SI-1.png` built a false green out of an empty directory');
  assert.deepStrictEqual(v.mk_scope[0].si_missing, ['SI-1']);
});

test('evidence: the isFile default TRUSTS a listing it cannot stat (the injected-FS contract survives)', () => {
  // Every other test in this file injects readdir/readFile/exists but NOT isFile: nothing exists on
  // disk, so a strict default would filter every listing to empty and silently break the matrix.
  const fs1 = vfs(FX, {
    '.product/features/FM-003-inbox.md': fmDoc('FM-003', 'true', ['MK-003']),
    '.product/mockups/MK-003-inbox.md': mkDoc('MK-003', 'FM-003', ['SI-1']),
    'test-results/visual/MK-003/SI-1.png': 'x',
  });
  const v = assessVisualEvidence({ root: FX, features: ['FM-003'], readFile: fs1.readFile, readdir: fs1.readdir, exists: fs1.exists });
  assert.strictEqual(v.visual_evidence, 'COMPLETE', 'no isFile injected ⇒ the listing is trusted, as before');
});

test('CLI visual on a REAL tree: a directory named SI-2.png does not cover SI-2 (the default isFile bites)', () => {
  const base = mkTmp();
  fs.mkdirSync(path.join(base, '.product', 'features'), { recursive: true });
  fs.mkdirSync(path.join(base, '.product', 'mockups'), { recursive: true });
  fs.mkdirSync(path.join(base, 'test-results', 'visual', 'MK-003', 'SI-2.png'), { recursive: true });
  fs.writeFileSync(path.join(base, '.product', 'features', 'FM-003-inbox.md'), fmDoc('FM-003', 'true', ['MK-003']));
  fs.writeFileSync(path.join(base, '.product', 'mockups', 'MK-003-inbox.md'), mkDoc('MK-003', 'FM-003', ['SI-1', 'SI-2']));
  fs.writeFileSync(path.join(base, 'test-results', 'visual', 'MK-003', 'SI-1.png'), 'x');
  const j = JSON.parse(execFileSync(process.execPath,
    [LIB, 'visual', '--root', base, '--features', 'FM-003', '--artifacts-dir', 'test-results'], { encoding: 'utf8' }));
  assert.strictEqual(j.visual_evidence, 'INCOMPLETE');
  assert.deepStrictEqual(j.mk_scope[0].si_missing, ['SI-2'], 'the decoy directory covered nothing');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
