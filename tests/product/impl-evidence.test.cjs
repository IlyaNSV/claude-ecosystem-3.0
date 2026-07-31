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

/**
 * THE REAL WRITER of `result_summary` (DEC-DEV-0237 seam pin). The visual-leg tests used to
 * HAND-BUILD `result_summary: { visual_evidence: … }` flat — a shape the ledger never writes.
 * They passed while the live chain was broken: summarizeResult projected visual_evidence away,
 * so every real run.json reported `visual: none`. Requiring the actual summarizer means the
 * fixtures are the LIVE form by construction: a P8-shaped process return → summarizeResult →
 * run.json → this collector. A regression in the ledger now breaks these tests, which is the
 * whole point — a test that invents its own input cannot pin a seam.
 */
const summarizeResult = require(
  path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'run-ledger.cjs'),
).summarizeResult;

/** A P8 (user-journey-acceptance) process return — the arm shape user-journey-acceptance.mjs uses. */
function p8Result(fields) {
  return Object.assign({
    feature: null, features: [], staging_url: 'https://staging.example',
    uja_result: 'PASS', journeys_total: 3, journeys_passed: 3, journeys_failed: [], specs_skipped: [],
    artifacts_dir: 'test-results', visual_evidence: 'COMPLETE', visual: { mk_scope: [], reasons: [] },
    input_profile: 'realistic', dod_run: true, concerns: [],
    readiness: 'READY', readiness_reasons: [], disclosures: [],
  }, fields);
}

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

// ── runs: slug-addressed runs (meta-feedback #4, DEC-DEV-0234) ──────────────────

test('runs: a run addressed by FEATURE SLUG (no FM-id anywhere) is matched via slug(title)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-040-x.md', fmFile('FM-040', 'in-progress', 'Auth', ['SC-040']));
    write(dir, '.product/scenarios/SC-040-x.md', scFile('SC-040', 'active'));
    // The orchestrator takes a cc-sdd slug, not an FM-id — this run never names FM-040.
    write(dir, '.claude/orchestrator/runs/run-slug/run.json', runJson({
      run_id: 'run-slug', args_summary: 'auth main', finished_at: '2026-07-11T10:00:00Z',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-040' });
    eq(ev.runs.count, 1, 'slug-addressed run is visible');
    eq(ev.runs.matches[0].matched_by, 'feature-slug', 'match provenance recorded');
    eq(ev.runs.latest_gate, 'GO', 'its gate verdict is read');
    const fm = { id: 'FM-040', status: 'in-progress', scenarios: ['SC-040'] };
    eq(lib.disposition(fm, ev, lib.checkV01(dir, fm)).disposition, 'ready-to-ship',
      'the slug-addressed GO now carries the FM to ready-to-ship (was: no-evidence)');
  } finally { rm(dir); }
});

test('runs: slug match is anti-noise — whole token only, and not below the length floor', () => {
  const dir = mkProject();
  try {
    // (a) substring, not a token: slug `auth` must NOT match the run of feature `author-flow`.
    write(dir, '.product/features/FM-041-x.md', fmFile('FM-041', 'in-progress', 'Auth', []));
    write(dir, '.claude/orchestrator/runs/run-other/run.json', runJson({
      run_id: 'run-other', args_summary: 'author-flow main',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    eq(lib.collectEvidence({ root: dir, fmId: 'FM-041' }).runs.count, 0,
      'a neighbouring feature\'s run must not be attributed by substring');
    // (b) below the 4-char floor: slug `api` is an ordinary word in an args line.
    write(dir, '.product/features/FM-042-x.md', fmFile('FM-042', 'in-progress', 'API', []));
    write(dir, '.claude/orchestrator/runs/run-api/run.json', runJson({
      run_id: 'run-api', args_summary: 'api main',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    eq(lib.collectEvidence({ root: dir, fmId: 'FM-042' }).runs.count, 0, 'short slug is not evidence');
  } finally { rm(dir); }
});

test('runs: literal FM-id matching is unchanged (regression) — args_summary AND dump', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-043-x.md', fmFile('FM-043', 'in-progress', 'Payments Ledger', []));
    write(dir, '.claude/orchestrator/runs/run-args/run.json', runJson({
      run_id: 'run-args', args_summary: 'FM-043 --deep', finished_at: '2026-07-11T10:00:00Z',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    write(dir, '.claude/orchestrator/runs/run-dump/run.json', runJson({
      run_id: 'run-dump', args_summary: '', finished_at: '2026-07-11T09:00:00Z',
      result_summary: { verdict: null, result: null, readiness: null, conflicts: 0, counts: null, decision_trail: { note: 'covers FM-043' } },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-043' });
    eq(ev.runs.count, 2, 'both id paths still match');
    eq(ev.runs.matches.every((m) => m.matched_by === 'fm-id'), true, 'both recorded as fm-id matches');
    eq(ev.runs.latest_gate, 'GO', 'gate unchanged');
  } finally { rm(dir); }
});

// ── runs: object-form result_summary (D094) ──────────────────────────────────────

test('runs: object-form result_summary.result (wrapped envelope) — gate is unwrapped, not lost (D094)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-044-x.md', fmFile('FM-044', 'in-progress', 'Wrapped', []));
    // run-ledger's summarizeResult copies the process outcome VERBATIM — a wrapped return
    // lands an OBJECT in result_summary.result, where the bare-string check read straight over it.
    write(dir, '.claude/orchestrator/runs/run-obj/run.json', runJson({
      run_id: 'run-obj', args_summary: 'FM-044',
      result_summary: { verdict: null, result: { result: 'GO', readiness: 'READY' }, readiness: null, conflicts: 0, counts: null },
    }));
    eq(lib.collectEvidence({ root: dir, fmId: 'FM-044' }).runs.latest_gate, 'GO', 'GO read out of the object form');
  } finally { rm(dir); }
});

test('runs: object-form unwrap follows OUTCOME_KEYS precedence + ignores a non-verdict object', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-045-x.md', fmFile('FM-045', 'in-progress', 'Keys', []));
    // go_gate/p7_result/uja_result are the other names processes give their outcome.
    write(dir, '.claude/orchestrator/runs/run-gg/run.json', runJson({
      run_id: 'run-gg', args_summary: 'FM-045', finished_at: '2026-07-11T10:00:00Z',
      result_summary: { verdict: { go_gate: 'NO-GO' }, result: null, readiness: null, conflicts: 0, counts: null },
    }));
    eq(lib.collectEvidence({ root: dir, fmId: 'FM-045' }).runs.latest_gate, 'NO-GO', 'verdict object unwrapped via go_gate');

    write(dir, '.product/features/FM-046-x.md', fmFile('FM-046', 'in-progress', 'NoGate', []));
    write(dir, '.claude/orchestrator/runs/run-nogate/run.json', runJson({
      run_id: 'run-nogate', args_summary: 'FM-046',
      result_summary: { verdict: null, result: { counts: 3, note: 'no outcome here' }, readiness: null, conflicts: 0, counts: null },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-046' });
    eq(ev.runs.count, 1, 'run still counted as activity');
    eq(ev.runs.latest_gate, null, 'an object without a gate key is NOT invented into a verdict');
  } finally { rm(dir); }
});

// ── visual evidence: the 5th source (P8 visual leg, DEC-DEV-0237) ───────────────

test('visual: THE LIVE SEAM — a real summarizeResult() record is read; freshest P8 run wins', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-050-x.md', fmFile('FM-050', 'in-progress', 'Gallery', []));
    // No hand-built shape anywhere below: the ledger's own summarizer produces result_summary,
    // exactly as finishRun() would write it to disk on a real P8 run.
    write(dir, '.claude/orchestrator/runs/run-p8-old/run.json', runJson({
      run_id: 'run-p8-old', process: 'user-journey-acceptance', args_summary: 'FM-050',
      finished_at: '2026-07-11T09:00:00Z',
      result_summary: summarizeResult(p8Result({ visual_evidence: 'INCOMPLETE', artifacts_dir: 'old-results' })),
    }));
    write(dir, '.claude/orchestrator/runs/run-p8-new/run.json', runJson({
      run_id: 'run-p8-new', process: 'user-journey-acceptance', args_summary: 'FM-050',
      finished_at: '2026-07-11T12:00:00Z',
      result_summary: summarizeResult(p8Result({ visual_evidence: 'COMPLETE_WITH_SKIPS', artifacts_dir: 'test-results' })),
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-050' });
    eq(ev.runs.visual, 'COMPLETE_WITH_SKIPS', 'freshest P8 run wins by finished_at');
    eq(ev.runs.visual_run_id, 'run-p8-new', 'its run id is disclosed');
    eq(ev.runs.visual_artifacts_dir, 'test-results', 'artifacts dir lifted from the same run');
    // …and the shape really is the ledger's, not a flat convenience: prove where the fields sit.
    const rs = JSON.parse(fs.readFileSync(path.join(dir, '.claude/orchestrator/runs/run-p8-new/run.json'), 'utf8')).result_summary;
    eq(rs.visual_evidence, undefined, 'the ledger does NOT write visual_evidence flat — that shape was the fiction');
    eq(rs.decision_trail.visual_evidence, 'COMPLETE_WITH_SKIPS', 'it rides in decision_trail (run-ledger TRAIL_KEYS)');
    eq(rs.decision_trail.artifacts_dir, 'test-results', 'and so does the artifacts dir');
  } finally { rm(dir); }
});

test('visual: a FLAT result_summary is still tolerated (backward compat with pre-0237 hand-written records)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-057-x.md', fmFile('FM-057', 'in-progress', 'Flat', []));
    write(dir, '.claude/orchestrator/runs/run-p8-flat/run.json', runJson({
      run_id: 'run-p8-flat', process: 'user-journey-acceptance', args_summary: 'FM-057',
      result_summary: {
        verdict: null, result: 'PASS', readiness: null, conflicts: 0, counts: null,
        visual_evidence: 'COMPLETE', artifacts_dir: 'test-results',
      },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-057' });
    eq(ev.runs.visual, 'COMPLETE', 'the flat container stays readable — widening what is READ never narrows it');
    eq(ev.runs.visual_artifacts_dir, 'test-results', 'artifacts dir too');
  } finally { rm(dir); }
});

test('visual: object-form result_summary (wrapped envelope) — same gateOf-class unwrap', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-051-x.md', fmFile('FM-051', 'in-progress', 'Wrapped UI', []));
    // A process returning its whole envelope lands an OBJECT in result_summary.result — the
    // visual fields sit one level down, exactly like the D094 gate did.
    write(dir, '.claude/orchestrator/runs/run-p8-obj/run.json', runJson({
      run_id: 'run-p8-obj', process: 'user-journey-acceptance', args_summary: 'FM-051',
      result_summary: {
        verdict: null, readiness: null, conflicts: 0, counts: null,
        result: { uja_result: 'PASS', visual_evidence: 'COMPLETE', artifacts_dir: 'test-results' },
      },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-051' });
    eq(ev.runs.visual, 'COMPLETE', 'visual read out of the object form, not lost');
    eq(ev.runs.artifacts_dir, undefined, 'no phantom top-level field on the evidence object');
    eq(ev.runs.visual_artifacts_dir, 'test-results', 'artifacts dir unwrapped too');
  } finally { rm(dir); }
});

test('visual: a pre-visual-leg run.json → none (never a throw, never an invented verdict)', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-052-x.md', fmFile('FM-052', 'in-progress', 'Legacy', []));
    write(dir, '.claude/orchestrator/runs/run-p8-legacy/run.json', runJson({
      run_id: 'run-p8-legacy', process: 'user-journey-acceptance', args_summary: 'FM-052',
      result_summary: { verdict: null, result: 'PASS', readiness: null, conflicts: 0, counts: null },
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-052' });
    eq(ev.runs.count, 1, 'the old record is still evidence of a run');
    eq(ev.runs.visual, 'none', 'no visual fields → none');
    eq(ev.runs.visual_run_id, 'run-p8-legacy', 'the run we looked at is still disclosed');
    // …and an unrecognized value is treated as absent, not passed through as a verdict.
    write(dir, '.product/features/FM-053-x.md', fmFile('FM-053', 'in-progress', 'Bogus', []));
    write(dir, '.claude/orchestrator/runs/run-p8-bogus/run.json', runJson({
      run_id: 'run-p8-bogus', process: 'user-journey-acceptance', args_summary: 'FM-053',
      result_summary: { verdict: null, result: 'PASS', readiness: null, conflicts: 0, counts: null, visual_evidence: 'MOSTLY_FINE' },
    }));
    eq(lib.collectEvidence({ root: dir, fmId: 'FM-053' }).runs.visual, 'none', 'unknown value is not a verdict');
  } finally { rm(dir); }
});

test('visual: N/A ("no has_ui in scope") is a VALUE, not an absence — never collapsed into none', () => {
  const dir = mkProject();
  try {
    write(dir, '.product/features/FM-058-x.md', fmFile('FM-058', 'in-progress', 'Backend only', []));
    write(dir, '.claude/orchestrator/runs/run-p8-na/run.json', runJson({
      run_id: 'run-p8-na', process: 'user-journey-acceptance', args_summary: 'FM-058',
      result_summary: summarizeResult(p8Result({ visual_evidence: 'N/A' })),
    }));
    const ev = lib.collectEvidence({ root: dir, fmId: 'FM-058' });
    // The distinction that was destroyed: a gate that RAN and found nothing to judge vs a gate
    // that was never asked. Both used to read `none` at the owner's approve gate.
    eq(ev.runs.visual, 'N/A', 'P8 said "nothing to judge" — that is an answer, not a silence');
    eq(ev.runs.visual_run_id, 'run-p8-na', 'and the run that answered is named');
    // …still not a conformance verdict: N/A conforms to nothing, it judged nothing.
    assert(!lib.VISUAL_VERDICTS.has('N/A'), 'N/A must not be counted among the CONFORMANCE verdicts');
    assert(lib.VISUAL_READABLE.has('N/A'), 'but it must be READ');
  } finally { rm(dir); }
});

test('visual: has_ui candidate carries visual_review_required; a non-UI candidate does not', () => {
  const dir = mkProject();
  try {
    const uiFm = fmFile('FM-054', 'in-progress', 'Player', ['SC-054'])
      .replace('status: in-progress', 'status: in-progress\nhas_ui: true\nmockups: [MK-003]');
    write(dir, '.product/features/FM-054-x.md', uiFm);
    write(dir, '.product/scenarios/SC-054-x.md', scFile('SC-054', 'active'));
    write(dir, '.claude/orchestrator/runs/run-go-ui/run.json', runJson({
      run_id: 'run-go-ui', args_summary: 'FM-054',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    const fm = lib.readFm(dir, 'FM-054');
    eq(fm.has_ui, true, 'has_ui parsed off the frontmatter');
    eq(fm.mockups.join(','), 'MK-003', 'mockups parsed (which MK the review is against)');
    const report = lib.scanProject({ root: dir, at: AT });
    const r = report.results[0];
    eq(r.disposition, 'ready-to-ship', 'the disposition chain is NOT extended by the visual leg');
    eq(r.visual_review_required, true, 'has_ui candidate demands the owner visual review (V-23)');
    eq(r.evidence_summary.visual, 'none', 'no P8 run here — reported honestly, still not blocking');
    assert(r.reasons.some((x) => /V-23/.test(x)), 'the reason names the rule');

    // …the same evidence on a non-UI feature raises nothing.
    write(dir, '.product/features/FM-055-x.md', fmFile('FM-055', 'in-progress', 'Backend job', ['SC-055']));
    write(dir, '.product/scenarios/SC-055-x.md', scFile('SC-055', 'active'));
    write(dir, '.claude/orchestrator/runs/run-go-nonui/run.json', runJson({
      run_id: 'run-go-nonui', args_summary: 'FM-055',
      result_summary: { verdict: 'GO', result: 'GO', readiness: 'READY', conflicts: 0, counts: null },
    }));
    const r2 = lib.scanProject({ root: dir, at: AT }).results.find((x) => x.fm_id === 'FM-055');
    eq(r2.visual_review_required, false, 'no has_ui → no visual review requirement');
  } finally { rm(dir); }
});

test('visual: an already-shipped has_ui FM is not re-flagged (idempotent, nothing to gate)', () => {
  const dir = mkProject();
  try {
    const uiFm = fmFile('FM-056', 'shipped', 'Shipped UI', ['SC-056'])
      .replace('status: shipped', 'status: shipped\nhas_ui: true');
    write(dir, '.product/features/FM-056-x.md', uiFm);
    write(dir, '.product/scenarios/SC-056-x.md', scFile('SC-056', 'active'));
    write(dir, '.claude/orchestrator/runs/run-p8-shipped/run.json', runJson({
      run_id: 'run-p8-shipped', process: 'user-journey-acceptance', args_summary: 'FM-056',
      // live form again: the summarizer writes the record, the test only supplies the process return
      result_summary: summarizeResult(p8Result({ visual_evidence: 'COMPLETE' })),
    }));
    const r = lib.scanProject({ root: dir, at: AT }).results[0];
    eq(r.disposition, 'already-shipped', 'idempotent skip unchanged');
    eq(r.visual_review_required, false, 'no gate on a feature that is already shipped');
    eq(r.evidence_summary.visual, 'COMPLETE', 'the visual evidence is still reported');
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
