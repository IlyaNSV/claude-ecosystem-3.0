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
  adapterFileName, extractContractFields, resolveContractAdapters,
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
  // Extra adapter files: [{ file, ref?, ins? }]
  for (const a of (opts.extraAdapters || [])) {
    if (a.ref != null) fs.writeFileSync(path.join(root, '.claude', 'adapters', a.file), a.ref, 'utf8');
    if (a.ins != null) fs.writeFileSync(path.join(root, '.claude', 'integrator', 'adapters', a.file), a.ins, 'utf8');
  }
  // Contracts: { 'CNT-001.yaml': '<yaml text>' , ... }
  if (opts.contracts) {
    const cdir = path.join(root, '.claude', 'integrator', 'contracts');
    fs.mkdirSync(cdir, { recursive: true });
    for (const [name, text] of Object.entries(opts.contracts)) {
      fs.writeFileSync(path.join(cdir, name), text, 'utf8');
    }
  }
  return root;
}

/** A real-form active-tools.yaml record (list form, NO `adapter` field — the
 *  shape the pilot actually writes; see DEC-DEV-0177 lesson #1). */
function realActiveTools(fields) {
  const f = fields || {};
  return [
    'tools:',
    `  - name: ${f.name || 'cc-sdd'}`,
    `    version_installed: "${f.version || '2.1.0'}"`,
    '    source: npm',
    '    source_spec: "cc-sdd@latest"',
    '    installed_at: 2026-04-18T00:00:00Z',
    '    last_verified: 2026-07-01',
    `    last_audit: ${f.lastAudit || new Date().toISOString().slice(0, 10)}`,
    '    category: spec-generation',
  ].join('\n');
}

/** A real-form CNT contract linking a consumer(tool) to an adapter script. */
function realContract(fields) {
  const f = fields || {};
  const lines = [
    'contract:',
    `  id: ${f.id || 'CNT-001'}`,
    '  name: "Product Handoff → cc-sdd spec-init"',
    '  producer: product-module',
    `  consumer: ${f.consumer || 'cc-sdd'}`,
    '  created: 2026-05-01',
    '  status: active',
    '',
    'data_flow:',
    '  from:',
    '    artifact: product-handoff.md',
    '    location: .product/handoffs/FM-{NNN}-handoff.md',
    '    format: markdown+yaml_frontmatter',
    '',
    'transformation:',
  ];
  if (f.type !== null) lines.push(`  type: ${f.type || 'adapter_script'}`);
  lines.push(`  script: .claude/integrator/adapters/${f.script || 'handoff-to-ccsdd.js'}`);
  lines.push('  contract_schema_version: 1');
  lines.push('');
  lines.push('validation:');
  lines.push('  pre:');
  lines.push('    - check: "handoff.md exists"');
  return lines.join('\n');
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

// ── DEF-SMK-1: contract-based adapter resolution ─────────────────────────────

test('extractContractFields: nested contract.consumer + transformation.script', () => {
  const f = extractContractFields(realContract({ consumer: 'cc-sdd', script: 'handoff-to-ccsdd.js' }));
  assert.strictEqual(f.consumer, 'cc-sdd');
  assert.strictEqual(f.transformationType, 'adapter_script');
  assert.strictEqual(f.transformationScript, '.claude/integrator/adapters/handoff-to-ccsdd.js');
});

test('extractContractFields: flat top-level consumer/script fallback', () => {
  const flat = ['consumer: beads', 'type: adapter_script', 'script: adapters/x.js'].join('\n');
  const f = extractContractFields(flat);
  assert.strictEqual(f.consumer, 'beads');
  assert.strictEqual(f.transformationScript, 'adapters/x.js');
});

test('resolveContractAdapters: maps consumer → adapter basename', () => {
  const root = seedProject({
    contracts: { 'CNT-001.yaml': realContract({ consumer: 'cc-sdd', script: 'handoff-to-ccsdd.js' }) },
  });
  const map = resolveContractAdapters(root);
  assert.deepStrictEqual(map.get('cc-sdd'), ['handoff-to-ccsdd.js']);
});

test('resolveContractAdapters: no contracts dir ⇒ empty map (tolerant)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-nocnt-'));
  assert.strictEqual(resolveContractAdapters(root).size, 0);
});

// (a) REGRESSOR — real pilot form (active-tools has NO adapter field): the link
// comes from the contract, and D2 drift is caught. Before the fix D2 skipped.
test('runDriftChecks: DEF-SMK-1 — adapter resolved via CNT, D2 drift caught on real form', () => {
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: mkAdapter(2, 'new-body', 'ref'),
    insAdapter: mkAdapter(1, 'old-body', 'ins'),
    activeTools: realActiveTools({ name: 'cc-sdd', lastAudit: new Date().toISOString().slice(0, 10) }),
    contracts: { 'CNT-001.yaml': realContract({ consumer: 'cc-sdd', script: 'handoff-to-ccsdd.js' }) },
  });
  const r = runDriftChecks(root, { now: Date.parse('2026-07-11') });
  assert.strictEqual(r.summary.checkedTools, 1);
  assert.strictEqual(r.tools[0].adapter, 'handoff-to-ccsdd.js', 'adapter resolved from contract');
  assert.strictEqual(r.tools[0].d2.status, 'drift', 'schema drift must be caught (regressor)');
  assert.strictEqual(r.tools[0].d3.status, 'drift');
  assert.strictEqual(r.summary.driftCount, 1);
});

// (b) MULTI-ADAPTER worst-of: one clean adapter + one drifting ⇒ tool row = drift.
test('runDriftChecks: multi-adapter tool ⇒ worst-of across adapters', () => {
  const clean = mkAdapter(1, 'same', 'h');
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: clean,
    insAdapter: mkAdapter(1, 'same', 'other-header'),
    extraAdapters: [{ file: 'handoff-to-beads.js', ref: mkAdapter(2, 'a', 'r'), ins: mkAdapter(1, 'b', 'i') }],
    activeTools: realActiveTools({ name: 'cc-sdd', lastAudit: new Date().toISOString().slice(0, 10) }),
    contracts: {
      'CNT-001.yaml': realContract({ id: 'CNT-001', consumer: 'cc-sdd', script: 'handoff-to-ccsdd.js' }),
      'CNT-002.yaml': realContract({ id: 'CNT-002', consumer: 'cc-sdd', script: 'handoff-to-beads.js' }),
    },
  });
  const r = runDriftChecks(root, { now: Date.parse('2026-07-11') });
  assert.strictEqual(r.summary.checkedTools, 1);
  assert.ok(/handoff-to-ccsdd\.js/.test(r.tools[0].adapter) && /handoff-to-beads\.js/.test(r.tools[0].adapter),
    'both adapters listed in the row');
  assert.strictEqual(r.tools[0].d2.status, 'drift', 'worst-of: the drifting adapter wins');
  assert.ok(/worst-of/.test(r.tools[0].d2.detail), 'multi-adapter detail enumerates');
  assert.strictEqual(r.summary.driftCount, 1);
});

// (c) UNATTRIBUTED pair: adapter in both dirs, no contract ⇒ separate row, drift counted.
test('runDriftChecks: unattributed adapter pair is checked + drift counted', () => {
  const root = seedProject({
    extraAdapters: [{ file: 'orphan-adapter.js', ref: mkAdapter(2, 'new', 'r'), ins: mkAdapter(1, 'old', 'i') }],
    activeTools: realActiveTools({ name: 'cc-sdd', lastAudit: new Date().toISOString().slice(0, 10) }),
    // no contracts → tool has no adapter; orphan-adapter attributed to nobody
  });
  const r = runDriftChecks(root, { now: Date.parse('2026-07-11') });
  const orphan = r.tools.find((t) => t.tool === '(unattributed)');
  assert.ok(orphan, 'unattributed row present');
  assert.strictEqual(orphan.adapter, 'orphan-adapter.js');
  assert.strictEqual(orphan.d2.status, 'drift');
  assert.strictEqual(orphan.staleness.stale, false, 'unattributed staleness is n/a');
  assert.strictEqual(r.summary.driftCount, 1, 'unattributed drift counts');
  assert.strictEqual(r.summary.staleCount, 0, 'unattributed not counted as stale');
});

// (d) BROKEN CNT ⇒ skip that contract, no crash; other resolution still works.
test('runDriftChecks: broken CNT is skipped, not fatal', () => {
  const root = seedProject({
    adapterFile: 'handoff-to-ccsdd.js',
    refAdapter: mkAdapter(1, 'x', 'r'),
    insAdapter: mkAdapter(1, 'x', 'i'),
    activeTools: realActiveTools({ name: 'cc-sdd', lastAudit: new Date().toISOString().slice(0, 10) }),
    contracts: {
      'CNT-001.yaml': realContract({ consumer: 'cc-sdd', script: 'handoff-to-ccsdd.js' }),
      'CNT-BAD.yaml': ': : : not a contract [[[\n\t garbage',
    },
  });
  let r;
  assert.doesNotThrow(() => { r = runDriftChecks(root, { now: Date.parse('2026-07-11') }); });
  assert.strictEqual(r.tools[0].adapter, 'handoff-to-ccsdd.js', 'good contract still resolved');
  assert.strictEqual(r.tools[0].d2.status, 'ok');
});

// (e) Contract with a non-adapter_script transformation.type contributes no adapter.
test('resolveContractAdapters: type=direct contract contributes no adapter', () => {
  const root = seedProject({
    contracts: { 'CNT-009.yaml': realContract({ consumer: 'cc-sdd', type: 'direct', script: 'x.js' }) },
  });
  assert.strictEqual(resolveContractAdapters(root).size, 0);
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
