'use strict';
/**
 * Unit test for hooks/product/lib/status-collector.cjs — the deterministic,
 * read-only Product Module census that backs /product:status (DEC-DEV-0217).
 *
 * Covers:
 *   - initialized:false when there is no .product/ (exit 0, no throw).
 *   - basic census: total_typed, per-dir byType/byStatus, mockups MK/NM split,
 *     singletons (rpm roles_count, glossary approximate term_sections).
 *   - ghost detection: an alive primary ref vs a dangling one; AND the load-bearing
 *     case where the primary ref is alive but a SECONDARY ref (triggered_by) is a
 *     ghost — the entry must still flag (app-map-pending shape).
 *   - non-numeric ref (FM-SG-TEST) correctly falls through to ghost.
 *   - --now clock override drives stale_drafts_over_14d (draft older than 14d).
 *   - tolerant behaviour on a malformed .pending/*.yaml (note, never a throw).
 *   - config + integrator reads; CLI seam emits pretty JSON and exits 0.
 *
 * Node stdlib only; run: node tests/product/status-collector.test.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'status-collector.cjs');
const lib = require(LIB_PATH);
const { collect, refIsAlive, buildLiveIndex, parseQueue, queueEntryRefs } = lib;

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

// ── fixture builder ──────────────────────────────────────────────────────────

function art(id, status, extra) {
  const lines = ['---', `id: ${id}`, `status: ${status}`];
  for (const [k, v] of Object.entries(extra || {})) lines.push(`${k}: ${v}`);
  lines.push('---', '', `# ${id}`, '', 'body', '');
  return lines.join('\n');
}

/** Seed a minimal, well-formed project. Returns the root path. */
function seed() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'statcol-'));
  const P = path.join(root, '.product');
  const mk = (d) => fs.mkdirSync(path.join(P, d), { recursive: true });
  ['features', 'scenarios', 'mockups', 'nfr', '.pending', '.sessions', '.da-findings'].forEach(mk);

  fs.writeFileSync(path.join(P, 'features', 'FM-001-alpha.md'), art('FM-001', 'in-progress'), 'utf8');
  fs.writeFileSync(path.join(P, 'features', 'FM-002-beta.md'), art('FM-002', 'shipped'), 'utf8');
  fs.writeFileSync(path.join(P, 'scenarios', 'SC-001-do.md'), art('SC-001', 'active'), 'utf8');
  fs.writeFileSync(path.join(P, 'nfr', 'NFR-001-sec.md'), art('NFR-001', 'active', { scope: 'per_feature' }), 'utf8');
  fs.writeFileSync(path.join(P, 'mockups', 'MK-001-scr.md'), art('MK-001', 'active'), 'utf8');
  fs.writeFileSync(path.join(P, 'mockups', 'NM-001-nav.md'), art('NM-001', 'active'), 'utf8');
  // mockups/assets should be ignored by the top-level-only listing
  fs.mkdirSync(path.join(P, 'mockups', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(P, 'mockups', 'assets', 'ignored.md'), art('MK-999', 'active'), 'utf8');

  // Singletons with special fields.
  fs.writeFileSync(path.join(P, 'rpm.md'),
    '---\nid: RPM\ntype: role-permission-map\nstatus: active\nroles: [R-a, R-b, R-c]\n---\n\n# RPM\n', 'utf8');
  fs.writeFileSync(path.join(P, 'glossary.md'),
    '---\ntype: glossary\nstatus: active\nversion: 1\n---\n\n# G\n\n### Term one\ntext\n\n### Term two\ntext\n', 'utf8');

  fs.writeFileSync(path.join(P, '.sessions', 'current.yaml'),
    'session_id: s1\ntype: unknown\nlast_artifact_path: .product/features/FM-001-alpha.md\nedits_since_start: 3\n', 'utf8');

  fs.writeFileSync(path.join(P, '.da-findings', 'BR-001-2026-06-01-1000.md'), '# f', 'utf8');
  fs.writeFileSync(path.join(P, '.da-findings', 'BR-002-2026-06-01-1200.md'), '# f', 'utf8');
  fs.writeFileSync(path.join(P, '.da-findings', 'BR-003-2026-06-02.md'), '# f', 'utf8');

  fs.mkdirSync(path.join(root, '.claude', 'integrator'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'product.yaml'),
    'project_name: t\nproject_language: en\nvalidation_tier: pilot\ndefault_discovery_mode: quick\necosystem_version: 1.0.0\n'
    + 'product_class:\n  archetype: web-app\n  distribution: saas\n  data_sensitivity: pii\n'
    + 'domain_fit:\n  subcategory: A2\n  score: 90\n  threshold: 75\n  verdict: fit\n  hybrid_components:\n    - subcategory: G1\n      score: 71\n', 'utf8');
  fs.writeFileSync(path.join(root, '.claude', 'integrator', 'active-tools.yaml'),
    'version: 1\ntools:\n  - name: cc-sdd\n    version_installed: "1"\n  - name: stitch\n    version_installed: "2"\n', 'utf8');
  return root;
}

// ── tests ────────────────────────────────────────────────────────────────────

test('initialized:false when .product/ is absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'statcol-empty-'));
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  assert.strictEqual(r.initialized, false);
  assert.strictEqual(r.schema, 1);
  assert.ok(r.generated_at);
  assert.strictEqual(r.artifacts, undefined, 'no artifacts section when uninitialized');
});

test('basic census: total_typed, byType, byStatus, mockups MK/NM split', () => {
  const root = seed();
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  const bt = r.artifacts.byType;
  // features 2 + scenarios 1 + nfr 1 + MK 1 + NM 1 = 6 (assets/ ignored)
  assert.strictEqual(r.artifacts.total_typed, 6);
  assert.strictEqual(bt.features.total, 2);
  assert.strictEqual(bt.features.byStatus['in-progress'], 1);
  assert.strictEqual(bt.features.byStatus.shipped, 1);
  assert.strictEqual(bt.MK.total, 1);
  assert.strictEqual(bt.NM.total, 1);
  assert.strictEqual(bt.MK.dir, 'mockups');
  assert.strictEqual(bt.nfr.nfr_scope.per_feature, 1);
  assert.strictEqual(bt.nfr.items[0].scope, 'per_feature');
});

test('singletons: rpm roles_count + glossary approximate term_sections', () => {
  const root = seed();
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  const s = (f) => r.artifacts.singletons.find((x) => x.file === f);
  assert.strictEqual(r.artifacts.singletons.length, 2, 'rpm.md + glossary.md');
  assert.strictEqual(s('rpm.md').roles_count, 3);
  assert.strictEqual(s('glossary.md').term_sections, 2);
  assert.strictEqual(s('glossary.md').term_sections_approximate, true);
});

test('ghost detection: alive primary ref vs a dangling one', () => {
  const root = seed();
  fs.writeFileSync(path.join(root, '.product', '.pending', 'q.yaml'),
    'entries:\n'
    + '  - artifact: SC-001\n    status: active\n    queued_at: "2026-07-01T00:00:00Z"\n'
    + '  - artifact: SC-999\n    status: active\n    queued_at: "2026-07-02T00:00:00Z"\n', 'utf8');
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  const q = r.pending.queues.find((x) => x.file === 'q.yaml');
  assert.strictEqual(q.entries, 2);
  assert.strictEqual(q.ghosts, 1);
  assert.strictEqual(q.items.find((i) => i.ref === 'SC-001').ghost, false);
  assert.strictEqual(q.items.find((i) => i.ref === 'SC-999').ghost, true);
  assert.strictEqual(r.pending.total_entries, 2);
  assert.strictEqual(r.pending.total_ghosts, 1);
});

test('ghost via SECONDARY ref: alive artifact + dangling triggered_by (app-map shape)', () => {
  const root = seed();
  // artifact SC-001 is alive; triggered_by FM-SG-TEST is a non-numeric ghost.
  fs.writeFileSync(path.join(root, '.product', '.pending', 'am.yaml'),
    'entries:\n  - artifact: SC-001\n    triggered_by: FM-SG-TEST\n    action: needs_review\n    at: "2026-07-01T00:00:00Z"\n', 'utf8');
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  const q = r.pending.queues.find((x) => x.file === 'am.yaml');
  assert.strictEqual(q.entries, 1);
  assert.strictEqual(q.ghosts, 1, 'entry flags on secondary ghost even though primary is alive');
  assert.strictEqual(q.items[0].ref, 'SC-001');
  assert.deepStrictEqual(q.items[0].secondary_refs, ['FM-SG-TEST']);
  assert.strictEqual(q.items[0].status_or_action, 'needs_review');
});

test('refIsAlive: non-numeric ref never falsely resolves via numeric short-id', () => {
  const index = new Set(['FM-001', 'FM-001-alpha', 'SC-001', 'SC-001-do']);
  assert.strictEqual(refIsAlive('FM-001', index), true);
  assert.strictEqual(refIsAlive('FM-001-alpha', index), true, 'prefix/exact basename');
  assert.strictEqual(refIsAlive('FM-SG-TEST', index), false, 'non-numeric → ghost');
  assert.strictEqual(refIsAlive('FM-008', index), false, 'numeric short-id absent → ghost');
});

test('buildLiveIndex + queueEntryRefs primary/secondary ordering', () => {
  const root = seed();
  const idx = buildLiveIndex(path.join(root, '.product'), []);
  assert.ok(idx.has('FM-001'));
  assert.ok(idx.has('RPM'), 'frontmatter id indexed');
  const refs = queueEntryRefs({ artifact: 'A', triggered_by: 'B', source_mk: 'C' });
  assert.strictEqual(refs.primary, 'A');
  assert.deepStrictEqual(refs.secondary, ['B', 'C']);
  const dsShape = queueEntryRefs({ proposal_id: 'DSP-001', source_mk: 'MK-008' });
  assert.strictEqual(dsShape.primary, 'MK-008', 'source_mk is a recognised ref field');
});

test('--now drives stale_drafts_over_14d (draft older than 14 days)', () => {
  const root = seed();
  fs.writeFileSync(path.join(root, '.product', 'features', 'FM-003-old.md'),
    art('FM-003', 'draft', { updated: '2026-01-01' }), 'utf8');
  // now = 2026-02-01 → 31 days old → stale
  const stale = collect(root, new Date('2026-02-01T00:00:00Z'));
  assert.strictEqual(stale.stale_drafts_over_14d.count, 1);
  assert.strictEqual(stale.stale_drafts_over_14d.items[0].id, 'FM-003');
  // now = 2026-01-05 → 4 days old → fresh
  const fresh = collect(root, new Date('2026-01-05T00:00:00Z'));
  assert.strictEqual(fresh.stale_drafts_over_14d.count, 0);
});

test('tolerant on malformed .pending yaml — note, never a throw', () => {
  const root = seed();
  fs.writeFileSync(path.join(root, '.product', '.pending', 'broken.yaml'),
    ':::\n- not: really\n   weird: [unterminated\n  - another\n', 'utf8');
  let r;
  assert.doesNotThrow(() => { r = collect(root, new Date('2026-07-17T00:00:00Z')); });
  const q = r.pending.queues.find((x) => x.file === 'broken.yaml');
  assert.ok(q, 'malformed queue still surfaces');
  // It parses as a top-level list; the point is it does not throw and stays counted.
  assert.ok(typeof q.entries === 'number');
});

test('config + integrator reads', () => {
  const root = seed();
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  assert.strictEqual(r.config.present, true);
  assert.strictEqual(r.config.project_name, 't');
  assert.strictEqual(r.config.domain_fit.score, 90);
  assert.strictEqual(r.config.domain_fit.subcategory, 'A2', 'nested sub-list must not overwrite subcategory');
  assert.strictEqual(r.config.product_class.archetype, 'web-app');
  assert.strictEqual(r.integrations.integrator.tools_count, 2);
  assert.deepStrictEqual(r.integrations.integrator.tool_names, ['cc-sdd', 'stitch']);
  assert.strictEqual(r.integrations.pending_actions.present, false);
});

test('session: last_artifact_exists resolves against root', () => {
  const root = seed();
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  assert.strictEqual(r.session.present, true);
  assert.strictEqual(r.session.type, 'unknown');
  assert.strictEqual(r.session.last_artifact_exists, true, 'FM-001-alpha.md exists');
});

test('da_findings: total + latest5 sorted by embedded timestamp desc', () => {
  const root = seed();
  const r = collect(root, new Date('2026-07-17T00:00:00Z'));
  assert.strictEqual(r.da_findings.total, 3);
  // BR-002 (06-01-1200) > BR-001 (06-01-1000); BR-003 (06-02, no time) is newest date.
  assert.deepStrictEqual(r.da_findings.latest5, [
    'BR-003-2026-06-02', 'BR-002-2026-06-01-1200', 'BR-001-2026-06-01-1000',
  ]);
});

test('parseQueue: block scalar content does not split entries or leak fields', () => {
  const content = [
    'entries:',
    '  - artifact: BR-080',
    '    queued_at: "2026-07-09T00:00:00Z"',
    '    diff: |',
    '      diff --git a/x b/x',
    '       created: 2026-05-27',
    '      -updated: 2026-06-12',
    '      +updated: 2026-07-10',
  ].join('\n');
  const parsed = parseQueue(content);
  assert.strictEqual(parsed.entries.length, 1, 'diff block must not create phantom entries');
  assert.strictEqual(parsed.entries[0].artifact, 'BR-080');
  assert.strictEqual(parsed.entries[0].created, undefined, 'block-scalar content not parsed as fields');
});

test('CLI seam: --root + --now emits pretty JSON, exit 0', () => {
  const root = seed();
  const res = spawnSync('node', [LIB_PATH, '--root', root, '--json', '--now', '2026-07-17T00:00:00Z'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'CLI exits 0 (read-only)');
  const parsed = JSON.parse(res.stdout);
  assert.strictEqual(parsed.schema, 1);
  assert.strictEqual(parsed.generated_at, '2026-07-17T00:00:00.000Z', '--now flows into generated_at');
  assert.strictEqual(parsed.artifacts.total_typed, 6);
  assert.ok(res.stdout.includes('\n  '), 'output is pretty-printed');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
