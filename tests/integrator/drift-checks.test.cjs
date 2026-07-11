'use strict';
/**
 * Unit test for hooks/integrator/lib/drift-checks.cjs — the shared local-only
 * adapter-drift lib (DEC-DEV-0176, Integrator Phase 7).
 *
 * Covers the pure heart the SessionStart hook + /integrator:verify ride on:
 *   - parseActiveTools: list form, keyed-mapping form, broken/empty tolerance.
 *   - D2 CONTRACT_SCHEMA_VERSION: match / mismatch / missing file (skipped).
 *   - D3 header-stripped body: identical bodies under different headers = ok;
 *     differing bodies = drift; missing file = skipped.
 *   - staleness: fresh / >90d / absent last_audit.
 *   - runDriftChecks: no active-tools.yaml → empty result; broken yaml → no
 *     crash; end-to-end drift + stale over tmp fixtures.
 *   - semverSatisfies + the CLI seam (`--json`, exit 0).
 *
 * Node stdlib only; run: node tests/integrator/drift-checks.test.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'hooks', 'integrator', 'lib', 'drift-checks.cjs');
const lib = require(LIB_PATH);
const {
  parseActiveTools, extractSchemaVersion, extractTargetVersion, stripAdapterHeader,
  semverSatisfies, checkD2, checkD3, checkStaleness, runDriftChecks, summarizeDriftLines,
  adapterFileName,
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

// ── fixture helpers ──────────────────────────────────────────────────────────

function mkAdapter(schemaVersion, bodyMarker, headerNote) {
  return [
    '#!/usr/bin/env node',
    "'use strict';",
    '/**',
    ` * some adapter header — ${headerNote || 'note'}`,
    ' * @target_tool_version: ^2.1.0',
    ' */',
    `const CONTRACT_SCHEMA_VERSION = ${schemaVersion};`,
    `function transformToInput() { return '${bodyMarker}'; }`,
    'module.exports = { transformToInput };',
    '',
  ].join('\n');
}

function seedProject(opts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-'));
  fs.mkdirSync(path.join(root, '.claude', 'integrator', 'adapters'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'adapters'), { recursive: true });
  if (opts.activeTools != null) {
    fs.writeFileSync(path.join(root, '.claude', 'integrator', 'active-tools.yaml'), opts.activeTools, 'utf8');
  }
  if (opts.refAdapter != null) {
    fs.writeFileSync(path.join(root, '.claude', 'adapters', opts.adapterFile), opts.refAdapter, 'utf8');
  }
  if (opts.insAdapter != null) {
    fs.writeFileSync(path.join(root, '.claude', 'integrator', 'adapters', opts.adapterFile), opts.insAdapter, 'utf8');
  }
  return root;
}

console.log('integrator drift-checks — local-only D1/D2/D3 + staleness (DEC-DEV-0176)');

// ── parseActiveTools ─────────────────────────────────────────────────────────

test('parseActiveTools: list form pulls name/version/adapter/last_audit', () => {
  const yaml = [
    'tools:',
    '  - name: cc-sdd',
    '    version_installed: 2.1.0',
    '    target_tool_version: "^2.1.0"',
    '    adapter: handoff-to-ccsdd',
    '    last_audit: 2026-04-18',
    '    contracts: [CNT-001]',
  ].join('\n');
  const recs = parseActiveTools(yaml);
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].name, 'cc-sdd');
  assert.strictEqual(recs[0].version_installed, '2.1.0');
  assert.strictEqual(recs[0].target_tool_version, '^2.1.0');
  assert.strictEqual(recs[0].adapter, 'handoff-to-ccsdd');
  assert.strictEqual(recs[0].last_audit, '2026-04-18');
  assert.deepStrictEqual(recs[0].contracts, ['CNT-001']);
});

test('parseActiveTools: keyed-mapping form (tool name is the key)', () => {
  const yaml = [
    'tools:',
    '  cc-sdd:',
    '    version_installed: 2.1.0',
    '    adapter: handoff-to-ccsdd',
    '    last_audit: 2026-04-18',
    '  beads:',
    '    version_installed: 1.2.0',
    '    adapter: beads-handoff-parser',
  ].join('\n');
  const recs = parseActiveTools(yaml);
  assert.strictEqual(recs.length, 2);
  assert.strictEqual(recs[0].name, 'cc-sdd');
  assert.strictEqual(recs[0].adapter, 'handoff-to-ccsdd');
  assert.strictEqual(recs[1].name, 'beads');
  assert.strictEqual(recs[1].version_installed, '1.2.0');
});

test('parseActiveTools: comments stripped, empty/nonsense → []', () => {
  assert.deepStrictEqual(parseActiveTools(''), []);
  assert.deepStrictEqual(parseActiveTools('# just a comment\n'), []);
  assert.deepStrictEqual(parseActiveTools('some: unrelated\nkeys: here\n'), []);
  const withComment = 'tools:\n  - name: cc-sdd  # inline comment\n    adapter: a\n';
  const recs = parseActiveTools(withComment);
  assert.strictEqual(recs[0].name, 'cc-sdd');
});

test('parseActiveTools: malformed text does not throw (tolerance)', () => {
  assert.doesNotThrow(() => parseActiveTools('tools:\n  - : : : bad\n\t\tmixed\n  garbage['));
});

// ── adapter source helpers ───────────────────────────────────────────────────

test('extractSchemaVersion / extractTargetVersion', () => {
  const src = mkAdapter(3, 'x', 'h');
  assert.strictEqual(extractSchemaVersion(src), 3);
  assert.strictEqual(extractTargetVersion(src), '^2.1.0');
  assert.strictEqual(extractSchemaVersion('no const here'), null);
  assert.strictEqual(extractTargetVersion('no header'), null);
});

test('stripAdapterHeader: slices from the CONTRACT_SCHEMA_VERSION const', () => {
  const src = mkAdapter(1, 'body', 'header-A');
  const stripped = stripAdapterHeader(src);
  assert.ok(stripped.startsWith('const CONTRACT_SCHEMA_VERSION'));
  assert.ok(!/header-A/.test(stripped), 'header note must be stripped');
});

// ── D2 schema ────────────────────────────────────────────────────────────────

test('D2: equal schema versions ⇒ ok', () => {
  const d = checkD2(mkAdapter(1, 'a', 'h1'), mkAdapter(1, 'a', 'h2'));
  assert.strictEqual(d.status, 'ok');
});

test('D2: installed < reference ⇒ drift (reference evolved)', () => {
  const d = checkD2(mkAdapter(2, 'a', 'h1'), mkAdapter(1, 'a', 'h2'));
  assert.strictEqual(d.status, 'drift');
  assert.ok(/reference evolved/.test(d.detail));
});

test('D2: missing installed file ⇒ skipped, not fail', () => {
  const d = checkD2(mkAdapter(1, 'a', 'h'), null);
  assert.strictEqual(d.status, 'skipped');
  assert.ok(/installed instance missing/.test(d.detail));
});

// ── D3 body ──────────────────────────────────────────────────────────────────

test('D3: identical bodies under DIFFERENT headers ⇒ ok', () => {
  const ref = mkAdapter(1, 'same-body', 'HEADER ONE with @source_ref abc');
  const ins = mkAdapter(1, 'same-body', 'HEADER TWO with @source_ref xyz totally different');
  const d = checkD3(ref, ins);
  assert.strictEqual(d.status, 'ok', 'header-only differences must not count as body drift');
});

test('D3: differing bodies ⇒ drift', () => {
  const d = checkD3(mkAdapter(1, 'body-A', 'h'), mkAdapter(1, 'body-B', 'h'));
  assert.strictEqual(d.status, 'drift');
});

test('D3: missing reference file ⇒ skipped', () => {
  const d = checkD3(null, mkAdapter(1, 'b', 'h'));
  assert.strictEqual(d.status, 'skipped');
});

// ── staleness ────────────────────────────────────────────────────────────────

test('staleness: fresh audit ⇒ not stale', () => {
  const now = Date.parse('2026-07-11');
  const s = checkStaleness('2026-07-01', now);
  assert.strictEqual(s.stale, false);
});

test('staleness: >90d ⇒ stale', () => {
  const now = Date.parse('2026-07-11');
  const s = checkStaleness('2026-01-01', now);
  assert.strictEqual(s.stale, true);
  assert.ok(/>90d/.test(s.detail));
});

test('staleness: absent last_audit ⇒ stale', () => {
  const s = checkStaleness(undefined, Date.now());
  assert.strictEqual(s.stale, true);
  assert.ok(/no last_audit/.test(s.detail));
});

// ── semverSatisfies ──────────────────────────────────────────────────────────

test('semverSatisfies: caret / tilde / exact / out-of-range / unparseable', () => {
  assert.strictEqual(semverSatisfies('2.3.0', '^2.1.0'), true);
  assert.strictEqual(semverSatisfies('3.0.0', '^2.1.0'), false);
  assert.strictEqual(semverSatisfies('1.2.9', '~1.2.0'), true);
  assert.strictEqual(semverSatisfies('1.3.0', '~1.2.0'), false);
  assert.strictEqual(semverSatisfies('2.1.0', '2.1.0'), true);
  assert.strictEqual(semverSatisfies('2.1.0', '*'), true);
  assert.strictEqual(semverSatisfies('not-a-version', '^2.0.0'), null);
});

// ── runDriftChecks — end to end ──────────────────────────────────────────────

test('runDriftChecks: no active-tools.yaml ⇒ empty result + note', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-none-'));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  const r = runDriftChecks(root);
  assert.deepStrictEqual(r.tools, []);
  assert.strictEqual(r.summary.checkedTools, 0);
  assert.strictEqual(r.note, 'no Integrator state');
});

test('runDriftChecks: broken yaml ⇒ no crash, empty tools', () => {
  const root = seedProject({
    adapterFile: 'a.js',
    activeTools: ': : not valid yaml at all [[[\n\t\tbroken',
  });
  let r;
  assert.doesNotThrow(() => { r = runDriftChecks(root); });
  assert.strictEqual(r.summary.checkedTools, 0);
});

test('runDriftChecks: clean tool (matching adapters, fresh audit) ⇒ 0 drift 0 stale', () => {
  const body = mkAdapter(1, 'identical', 'ref-header');
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: mkAdapter(1, 'identical', 'ref-header'),
    insAdapter: mkAdapter(1, 'identical', 'INSTALLED-header-differs'),
    activeTools: [
      'tools:',
      '  - name: cc-sdd',
      '    version_installed: 2.1.0',
      '    target_tool_version: "^2.1.0"',
      '    adapter: handoff-to-ccsdd',
      `    last_audit: ${new Date().toISOString().slice(0, 10)}`,
    ].join('\n'),
  });
  void body;
  const r = runDriftChecks(root);
  assert.strictEqual(r.summary.checkedTools, 1);
  assert.strictEqual(r.summary.driftCount, 0, 'header-only diff is not drift');
  assert.strictEqual(r.summary.staleCount, 0);
  assert.strictEqual(r.tools[0].d2.status, 'ok');
  assert.strictEqual(r.tools[0].d3.status, 'ok');
});

test('runDriftChecks: schema + body drift + stale audit ⇒ flagged', () => {
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: mkAdapter(2, 'new-body', 'ref'),
    insAdapter: mkAdapter(1, 'old-body', 'ins'),
    activeTools: [
      'tools:',
      '  - name: cc-sdd',
      '    version_installed: 2.1.0',
      '    target_tool_version: "^2.1.0"',
      '    adapter: handoff-to-ccsdd',
      '    last_audit: 2026-01-01',
    ].join('\n'),
  }, );
  const r = runDriftChecks(root, { now: Date.parse('2026-07-11') });
  assert.strictEqual(r.summary.driftCount, 1);
  assert.strictEqual(r.summary.staleCount, 1);
  assert.strictEqual(r.tools[0].d2.status, 'drift');
  assert.strictEqual(r.tools[0].d3.status, 'drift');
  assert.strictEqual(r.tools[0].staleness.stale, true);
  const lines = summarizeDriftLines(r);
  assert.strictEqual(lines.length, 1);
  assert.ok(/cc-sdd/.test(lines[0]));
});

test('runDriftChecks: missing installed adapter ⇒ D2/D3 skipped, no crash', () => {
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: mkAdapter(1, 'b', 'ref'),
    // no insAdapter written
    activeTools: [
      'tools:',
      '  - name: cc-sdd',
      '    version_installed: 2.1.0',
      '    adapter: handoff-to-ccsdd',
      `    last_audit: ${new Date().toISOString().slice(0, 10)}`,
    ].join('\n'),
  });
  const r = runDriftChecks(root);
  assert.strictEqual(r.tools[0].d2.status, 'skipped');
  assert.strictEqual(r.tools[0].d3.status, 'skipped');
  assert.strictEqual(r.summary.driftCount, 0);
});

test('adapterFileName: idempotent .js suffixing', () => {
  assert.strictEqual(adapterFileName('handoff-to-ccsdd'), 'handoff-to-ccsdd.js');
  assert.strictEqual(adapterFileName('handoff-to-ccsdd.js'), 'handoff-to-ccsdd.js');
  assert.strictEqual(adapterFileName(null), null);
});

// ── CLI seam ─────────────────────────────────────────────────────────────────

test('CLI seam: --json prints valid JSON and exits 0', () => {
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: mkAdapter(2, 'new', 'ref'),
    insAdapter: mkAdapter(1, 'old', 'ins'),
    activeTools: [
      'tools:',
      '  - name: cc-sdd',
      '    version_installed: 2.1.0',
      '    target_tool_version: "^2.1.0"',
      '    adapter: handoff-to-ccsdd',
      '    last_audit: 2026-01-01',
    ].join('\n'),
  });
  const res = spawnSync('node', [LIB_PATH, '--root', root, '--json'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'CLI must exit 0 (detect-only)');
  const parsed = JSON.parse(res.stdout);
  assert.strictEqual(parsed.summary.checkedTools, 1);
  assert.strictEqual(parsed.tools[0].d2.status, 'drift');
});

test('CLI seam: no state ⇒ exit 0, human report mentions the note', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-cli-'));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  const res = spawnSync('node', [LIB_PATH, '--root', root], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert.ok(/no Integrator state/.test(res.stdout));
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
