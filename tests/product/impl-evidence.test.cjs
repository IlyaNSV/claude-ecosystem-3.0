'use strict';
/**
 * Unit test for the implementation-evidence collector (G02 / DEC-DEV-0192).
 *
 * Exercises real behaviour against seeded .product/ + .claude/orchestrator/ + .kiro/
 * trees in tmp dirs: the oracle-reuse liveness, runs/fabric/external/handoff evidence,
 * the advisory coverage, V-01 (incl. a CRLF regressor), all six disposition branches,
 * scanProject summary + idempotency, and a CLI round-trip.
 *
 * Node stdlib only; run with `node tests/product/impl-evidence.test.cjs`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'impl-evidence.cjs');
const lib = require(LIB_PATH);

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'ne'} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

const AT = '2026-07-11T00:00:00Z';

// ── fixture helpers ───────────────────────────────────────────────────────────

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'implev-'));
  fs.mkdirSync(path.join(dir, '.product', 'features'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.product', 'scenarios'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.product', 'handoffs'), { recursive: true });
  return dir;
}
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function rm(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

function fmFile(id, status, title, scenarios) {
  return [
    '---',
    `id: ${id}`,
    'type: feature-map-entry',
    `title: "${title}"`,
    `status: ${status}`,
    `scenarios: [${(scenarios || []).join(', ')}]`,
    '---',
    '',
    `# ${id}`,
    '',
  ].join('\n');
}
function scFile(id, status) {
  return [
    '---',
    `id: ${id}`,
    'type: scenario',
    `status: ${status}`,
    '---',
    '',
    `# ${id}`,
    '',
  ].join('\n');
}
function handoff(feature, sc, br, ic) {
  return [
    '---',
    `id: HANDOFF-${feature}`,
    `feature: ${feature}`,
    '---',
    '',
    '## 5. Scenarios',
    `- ${sc} main flow`,
    '',
    '## 6. Business Rules',
    `- ${br} linking`,
    '',
    '## 9. Invariants',
    `- ${ic} nothing lost`,
    '',
  ].join('\n');
}
function runJson(fields) {
  return JSON.stringify(Object.assign({
    run_ledger_version: 1,
    run_id: 'r-x',
    process: 'validate-feature-impl',
    status: 'finished',
    started_at: '2026-07-11T10:00:00Z',
    finished_at: '2026-07-11T10:05:00Z',
    args_summary: '',
    result_summary: { verdict: null, result: null, readiness: null, conflicts: 0, counts: null },
  }, fields), null, 2);
}

console.log('impl-evidence — G02 / DEC-DEV-0192');

// ── oracle-reuse liveness ───────────────────────────────────────────────────────

test('oracle reuse is live (extractIds / extractSourceIds require works)', () => {
  assert(typeof lib.extractIds === 'function', 'extractIds re-exported');
  assert(typeof lib.extractSourceIds === 'function', 'extractSourceIds re-exported');
  eq(lib.extractIds('see FM-001 and FM-010 and FM-001', 'FM').join(','), 'FM-001,FM-010', 'dedup + order');
  const src = lib.extractSourceIds(handoff('FM-001', 'SC-001', 'BR-010', 'IC-003'));
  eq(src.scenarios.join(','), 'SC-001', '§5 scenarios');
  eq(src.rules.join(','), 'BR-010', '§6 rules');
  eq(src.invariants.join(','), 'IC-003', '§9 invariants');
});

// ── runs evidence + latest gate ─────────────────────────────────────────────────

test('runs: run.json mentioning FM in args_summary → evidence; latest GO → latest_gate GO', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-001-x.md', fmFile('FM-001', 'in-progress', 'Inbox', ['SC-001']));
    write(dir, '.claude/orchestrator/runs/run-a/run.json', runJson({
      run_id: 'run-a', args_summary: 'FM-001', finished_at: '2026-07-11T10:00:00Z',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-001' });
    eq(ev.runs.count, 1, 'one matched run');
    eq(ev.runs.latest_gate, 'GO', 'latest gate GO');
    eq(ev.runs.latest_gate_run_id, 'run-a', 'gate run id');
  } finally { rm(dir); }
});

test('runs: NO-GO newer than GO → latest_gate NO-GO → disposition gate-not-passed', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-002-x.md', fmFile('FM-002', 'in-progress', 'Thing', ['SC-002']));
    write(dir, '.product/scenarios/SC-002-x.md', scFile('SC-002', 'active'));
    write(dir, '.claude/orchestrator/runs/run-go/run.json', runJson({
      run_id: 'run-go', args_summary: 'FM-002', finished_at: '2026-07-11T09:00:00Z',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    write(dir, '.claude/orchestrator/runs/run-nogo/run.json', runJson({
      run_id: 'run-nogo', args_summary: 'FM-002', finished_at: '2026-07-11T11:00:00Z',
      result_summary: { verdict: 'NO-GO', result: 'NO-GO', readiness: 'NOT_READY', conflicts: 1, counts: null },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-002' });
    eq(ev.runs.count, 2, 'two matched runs');
    eq(ev.runs.latest_gate, 'NO-GO', 'newest gate wins');
    const fm = { id: 'FM-002', status: 'in-progress', scenarios: ['SC-002'] };
    const disp = lib.disposition(fm, ev, lib.checkV01(dir, fm));
    eq(disp.disposition, 'gate-not-passed', 'NO-GO blocks');
  } finally { rm(dir); }
});

// ── fabric evidence ─────────────────────────────────────────────────────────────

test('fabric: state.json done + mentions FM → fabric_done', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-003-x.md', fmFile('FM-003', 'in-progress', 'Fab', []));
    write(dir, '.claude/orchestrator/fabric/inst-1/state.json', JSON.stringify({
      instance: 'inst-1', charter_id: 'feature-production-line', subject: 'FM-003 rollout', state: 'done',
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-003' });
    eq(ev.fabric.fabric_done, true, 'fabric done');
    eq(ev.fabric.instances[0].charter_id, 'feature-production-line', 'charter id captured');
  } finally { rm(dir); }
});

test('fabric: subject matched via handoff text (no FM id in state.json)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-004-x.md', fmFile('FM-004', 'in-progress', 'Revisions inbox flow', []));
    // handoff body mentions the subject string:
    const h = handoff('FM-004', 'SC-004', 'BR-040', 'IC-004') + '\nsubject anchor: unique-subject-token-42\n';
    write(dir, '.product/handoffs/FM-004-handoff.md', h);
    write(dir, '.claude/orchestrator/fabric/inst-2/state.json', JSON.stringify({
      instance: 'inst-2', charter_id: 'feature-production-line', subject: 'unique-subject-token-42', state: 'running',
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-004' });
    eq(ev.fabric.instances.length, 1, 'matched by subject-in-handoff');
    eq(ev.fabric.fabric_done, false, 'running, not done');
  } finally { rm(dir); }
});

// ── external evidence + coverage ─────────────────────────────────────────────────

test('external: .kiro/specs dir mentioning FM → evidence (all top-level files read)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-005-x.md', fmFile('FM-005', 'in-progress', 'Inbox', []));
    write(dir, '.kiro/specs/inbox/spec.json', JSON.stringify({ feature_id: 'FM-005', title: 'Inbox' }));
    write(dir, '.kiro/specs/inbox/requirements.md', '# Requirements\nSC-005 covered.');
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-005' });
    eq(ev.external.present, true, 'external present');
    eq(ev.external.file_count, 2, 'both files counted');
    eq(ev.external.dirs[0].files.join(','), 'requirements.md,spec.json', 'files listed sorted');
  } finally { rm(dir); }
});

test('external: dir matched by title slug (no FM id in files)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-006-x.md', fmFile('FM-006', 'in-progress', 'Revision Flow', []));
    write(dir, '.kiro/specs/revision-flow/spec.json', JSON.stringify({ title: 'Revision Flow' }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-006' });
    eq(ev.external.present, true, 'matched by slug(title) == revision-flow');
  } finally { rm(dir); }
});

test('computeImplCoverage: missing_count when external is incomplete; null without external', () => {
  const src = lib.extractSourceIds(handoff('FM-001', 'SC-001', 'BR-010', 'IC-003'));
  // external text covers SC-001 + BR-010 but NOT IC-003:
  const cov = lib.computeImplCoverage(src, ['spec covers SC-001 and BR-010 only']);
  assert(cov != null, 'coverage computed');
  eq(cov.missing_count, 1, 'IC-003 missing');
  eq(lib.computeImplCoverage(src, []), null, 'no external → null');
  eq(lib.computeImplCoverage({ scenarios: [], rules: [], invariants: [] }, ['text']), null, 'no source ids → null');
});

// ── handoff sourceIds ────────────────────────────────────────────────────────────

test('handoff: sourceIds extracted; absent handoff → empty + present false', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-007-x.md', fmFile('FM-007', 'in-progress', 'H', []));
    write(dir, '.product/handoffs/FM-007-handoff.md', handoff('FM-007', 'SC-007', 'BR-070', 'IC-007'));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-007' });
    eq(ev.handoff.present, true, 'handoff present');
    eq(ev.handoff.sourceIds.rules.join(','), 'BR-070', 'rule id');
    const ev2 = lib.collectEvidence({ root: dir, fmId: 'FM-999' });
    eq(ev2.handoff.present, false, 'absent handoff');
  } finally { rm(dir); }
});

// ── V-01 (incl. CRLF regressor) ─────────────────────────────────────────────────

test('checkV01: pass with active SC, fail without active SC, fail with empty scenarios', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/scenarios/SC-010-x.md', scFile('SC-010', 'active'));
    write(dir, '.product/scenarios/SC-011-x.md', scFile('SC-011', 'draft'));
    eq(lib.checkV01(dir, { id: 'FM-010', scenarios: ['SC-010'] }).passed, true, 'active SC → pass');
    eq(lib.checkV01(dir, { id: 'FM-011', scenarios: ['SC-011'] }).passed, false, 'draft SC → fail');
    eq(lib.checkV01(dir, { id: 'FM-012', scenarios: [] }).passed, false, 'empty scenarios → fail');
  } finally { rm(dir); }
});

test('checkV01: CRLF frontmatter in FM + SC parses (EOL regressor, DEC-DEV-0190)', () => {
  const dir = mkProject();
  try {
    // Force CRLF line endings on both the FM and the SC file.
    write(dir, '.product/features/FM-013-x.md', fmFile('FM-013', 'in-progress', 'CRLF', ['SC-013']).replace(/\n/g, '\r\n'));
    write(dir, '.product/scenarios/SC-013-x.md', scFile('SC-013', 'active').replace(/\n/g, '\r\n'));
    const fm = lib.parseFm(fs.readFileSync(path.join(dir, '.product/features/FM-013-x.md'), 'utf8'));
    eq(fm.status, 'in-progress', 'CRLF status parsed without trailing \\r');
    const scenarios = lib.fmList(lib.frontmatterBlock(fs.readFileSync(path.join(dir, '.product/features/FM-013-x.md'), 'utf8')), 'scenarios');
    eq(scenarios.join(','), 'SC-013', 'CRLF scenarios list parsed');
    eq(lib.checkV01(dir, { id: 'FM-013', scenarios }).passed, true, 'CRLF SC status active → V-01 pass');
  } finally { rm(dir); }
});

// ── disposition: all six branches (pure) ─────────────────────────────────────────

function ev(overrides) {
  return Object.assign({
    runs: { count: 0, latest_gate: null, latest_gate_run_id: null, matches: [] },
    fabric: { fabric_done: false, instances: [] },
    external: { present: false, file_count: 0, dirs: [] },
    handoff: { present: false, sourceIds: { scenarios: [], rules: [], invariants: [] }, raw: '' },
  }, overrides);
}
const V_PASS = { passed: true, active_scenarios: ['SC-001'], reason: 'ok' };
const V_FAIL = { passed: false, active_scenarios: [], reason: 'no active SC' };

test('disposition: already-shipped (idempotent)', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'shipped' }, ev({ runs: { count: 1, latest_gate: 'GO', latest_gate_run_id: 'r', matches: [] } }), V_PASS).disposition, 'already-shipped');
});
test('disposition: deprecated (never proposed)', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'deprecated' }, ev({ external: { present: true, file_count: 1, dirs: [] } }), V_PASS).disposition, 'deprecated');
});
test('disposition: no-evidence', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({}), V_PASS).disposition, 'no-evidence');
});
test('disposition: gate-not-passed (latest NO-GO)', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({ runs: { count: 1, latest_gate: 'NO-GO', latest_gate_run_id: 'r', matches: [] } }), V_PASS).disposition, 'gate-not-passed');
});
test('disposition: gate-not-passed (MANUAL_VERIFY_REQUIRED)', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({ runs: { count: 1, latest_gate: 'MANUAL_VERIFY_REQUIRED', latest_gate_run_id: 'r', matches: [] } }), V_PASS).disposition, 'gate-not-passed');
});
test('disposition: validation-blocked (GO but V-01 fails)', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({ runs: { count: 1, latest_gate: 'GO', latest_gate_run_id: 'r', matches: [] } }), V_FAIL).disposition, 'validation-blocked');
});
test('disposition: ready-to-ship via GO gate + V-01', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({ runs: { count: 1, latest_gate: 'GO', latest_gate_run_id: 'r', matches: [] } }), V_PASS).disposition, 'ready-to-ship');
});
test('disposition: ready-to-ship via fabric done + external', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({ fabric: { fabric_done: true, instances: [] }, external: { present: true, file_count: 2, dirs: [] } }), V_PASS).disposition, 'ready-to-ship');
});
test('disposition: fallback (activity but no GO verdict) → gate-not-passed', () => {
  eq(lib.disposition({ id: 'FM-1', status: 'in-progress' }, ev({ runs: { count: 1, latest_gate: null, latest_gate_run_id: null, matches: [] } }), V_PASS).disposition, 'gate-not-passed');
});

// ── scanProject: summary + idempotency ───────────────────────────────────────────

test('scanProject: end-to-end ready-to-ship + summary shape', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-001-x.md', fmFile('FM-001', 'in-progress', 'Inbox', ['SC-001']));
    write(dir, '.product/scenarios/SC-001-x.md', scFile('SC-001', 'active'));
    write(dir, '.product/handoffs/FM-001-handoff.md', handoff('FM-001', 'SC-001', 'BR-010', 'IC-003'));
    write(dir, '.claude/orchestrator/runs/run-a/run.json', runJson({
      run_id: 'run-a', args_summary: 'FM-001',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    write(dir, '.kiro/specs/inbox/spec.json', JSON.stringify({ feature_id: 'FM-001', scenarios: 'SC-001', rules: 'BR-010', invariants: 'IC-003' }));
    const report = lib.scanProject({ root: dir, at: AT });
    eq(report.schema_version, 1, 'schema version');
    eq(report.generated_at, AT, 'at override honoured');
    eq(report.results.length, 1, 'one FM');
    eq(report.results[0].disposition, 'ready-to-ship', 'ready');
    eq(report.results[0].coverage.missing_count, 0, 'full coverage');
    eq(report.summary.ready, 1, 'summary.ready');
    eq(report.summary.total, 1, 'summary.total');
  } finally { rm(dir); }
});

test('scanProject: already-shipped FM is idempotent (skip, counted, not ready)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-020-x.md', fmFile('FM-020', 'shipped', 'Done', ['SC-020']));
    write(dir, '.product/scenarios/SC-020-x.md', scFile('SC-020', 'active'));
    write(dir, '.claude/orchestrator/runs/run-b/run.json', runJson({
      run_id: 'run-b', args_summary: 'FM-020',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    const report = lib.scanProject({ root: dir, at: AT });
    eq(report.results[0].disposition, 'already-shipped', 'idempotent skip');
    eq(report.summary.already_shipped, 1, 'already_shipped counted');
    eq(report.summary.ready, 0, 'not re-proposed');
  } finally { rm(dir); }
});

test('scanProject: deprecated FM lands in its own summary bucket (never blocked/ready)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-021-x.md', fmFile('FM-021', 'deprecated', 'Old', ['SC-021']));
    const report = lib.scanProject({ root: dir, at: AT });
    eq(report.results[0].disposition, 'deprecated', 'deprecated disposition');
    eq(report.summary.deprecated, 1, 'deprecated counted');
    eq(report.summary.ready + report.summary.blocked + report.summary.no_evidence
      + report.summary.already_shipped + report.summary.deprecated,
    report.summary.total, 'summary buckets add up to total');
  } finally { rm(dir); }
});

test('scanProject: no FM under features → empty results, zeroed summary', () => {
  const dir = mkProject();
  try {
    const report = lib.scanProject({ root: dir, at: AT });
    eq(report.results.length, 0, 'no results');
    eq(report.summary.total, 0, 'total 0');
  } finally { rm(dir); }
});

// ── CLI round-trip ───────────────────────────────────────────────────────────────

test('CLI: --json emits valid JSON and exits 0', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-030-x.md', fmFile('FM-030', 'in-progress', 'CLI', ['SC-030']));
    write(dir, '.product/scenarios/SC-030-x.md', scFile('SC-030', 'active'));
    const out = execFileSync('node', [LIB_PATH, '--root', dir, '--json', '--at', AT], { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    eq(parsed.schema_version, 1, 'schema version');
    eq(parsed.generated_at, AT, 'at echoed');
    eq(parsed.results[0].fm_id, 'FM-030', 'fm scanned');
  } finally { rm(dir); }
});

test('CLI: human report runs and exits 0; unknown flag exits 2', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-031-x.md', fmFile('FM-031', 'in-progress', 'CLI2', []));
    const out = execFileSync('node', [LIB_PATH, '--root', dir, '--at', AT], { encoding: 'utf8' });
    assert(/FM-031/.test(out), 'human report names the FM');
    assert(/Summary:/.test(out), 'has a summary line');
    let code = 0;
    try { execFileSync('node', [LIB_PATH, '--bogus'], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (e) { code = e.status; }
    eq(code, 2, 'unknown flag → exit 2');
  } finally { rm(dir); }
});

console.log(`\nimpl-evidence: ${passed} passed`);
if (process.exitCode) { console.error('FAILED'); } else { console.log('OK'); }
