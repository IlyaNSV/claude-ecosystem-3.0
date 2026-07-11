'use strict';
/**
 * Unit test for hooks/integrator/lib/handoff-staleness.cjs — the Integrator-side
 * handoff artifact-hash staleness check (DEC-DEV-0179, gap G22).
 *
 * Covers:
 *   - parseArtifactHashes: multi-entry block, block-exit on next top-level key,
 *     absent block.
 *   - buildArtifactIndex: id→path resolution across artifact dirs + singletons,
 *     tolerant of missing dirs.
 *   - computeHandoffStaleness: fresh (hashes match live .product/), stale (an
 *     artifact edited after handoff generation), missing (artifact deleted),
 *     error (no artifact_hashes), and the no-.product/handoffs empty case.
 *   - hash-reuse invariant: fresh verdict uses the SAME algorithm as
 *     hooks/product/lib/hash.js (a handoff seeded with that module's own output
 *     reads back fresh; a byte-level body edit flips it to stale).
 *   - toYaml persistence shape + CLI seam (--json, --write, exit 0).
 *
 * Node stdlib only; run: node tests/integrator/handoff-staleness.test.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'hooks', 'integrator', 'lib', 'handoff-staleness.cjs');
const HASH_PATH = path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'hash.js');
const lib = require(LIB_PATH);
const hash = require(HASH_PATH);
const {
  computeHandoffStaleness, buildArtifactIndex, parseArtifactHashes, toYaml,
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

/** An artifact .md with frontmatter id + a body. Body drives the hash. */
function mkArtifact(id, body) {
  return `---\nid: ${id}\nstatus: active\n---\n\n# ${id}\n\n${body}\n`;
}

/**
 * Seed a project root with a .product/ tree.
 * opts.artifacts: [{ dir, file, id, body }]
 * opts.handoffs:  { 'FM-003-handoff.md': '<full handoff text>' }
 */
function seedProject(opts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hstale-'));
  const productDir = path.join(root, '.product');
  fs.mkdirSync(path.join(productDir, 'handoffs'), { recursive: true });
  for (const a of (opts.artifacts || [])) {
    const dir = a.dir === '' ? productDir : path.join(productDir, a.dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, a.file), mkArtifact(a.id, a.body), 'utf8');
  }
  for (const [name, text] of Object.entries(opts.handoffs || {})) {
    fs.writeFileSync(path.join(productDir, 'handoffs', name), text, 'utf8');
  }
  return root;
}

/** Build a handoff whose artifact_hashes are computed from the real files. */
function mkHandoff(feature, entries /* [{id, filePath}] */, status = 'ready') {
  const hashLines = entries.map((e) => `  ${e.id}: "${hash.computeArtifactHash(e.filePath)}"`).join('\n');
  return [
    '---',
    `id: HANDOFF-${feature}`,
    'type: feature-handoff',
    `feature: ${feature}`,
    `status: ${status}`,
    'version: 1',
    'artifact_hashes:',
    hashLines,
    'target_adapter: "universal"',
    '---',
    '',
    `# Feature Handoff: ${feature}`,
    '',
  ].join('\n');
}

// ── tests ────────────────────────────────────────────────────────────────────

test('parseArtifactHashes: multi-entry block, stops at next top-level key', () => {
  const handoff = [
    '---',
    'id: HANDOFF-FM-003',
    'artifact_hashes:',
    `  FM-003: "sha256:${'a'.repeat(64)}"`,
    `  SC-005: 'sha256:${'b'.repeat(64)}'`,
    `  BR-010: sha256:${'c'.repeat(64)}`,
    'target_adapter: universal',
    '---',
    'body',
  ].join('\n');
  const map = parseArtifactHashes(handoff);
  assert.strictEqual(Object.keys(map).length, 3, 'all three entries parsed');
  assert.strictEqual(map['FM-003'], `sha256:${'a'.repeat(64)}`);
  assert.strictEqual(map['SC-005'], `sha256:${'b'.repeat(64)}`);
  assert.strictEqual(map['BR-010'], `sha256:${'c'.repeat(64)}`);
});

test('parseArtifactHashes: no block ⇒ empty map', () => {
  assert.deepStrictEqual(parseArtifactHashes('---\nid: X\n---\nbody'), {});
});

test('buildArtifactIndex: resolves ids across dirs + singletons; tolerant of missing dirs', () => {
  const root = seedProject({
    artifacts: [
      { dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'f' },
      { dir: 'scenarios', file: 'SC-005-email.md', id: 'SC-005', body: 's' },
      { dir: '', file: 'glossary.md', id: 'BG-GLOSSARY', body: 'g' },
    ],
  });
  const idx = buildArtifactIndex(path.join(root, '.product'));
  assert.ok(idx['FM-003'].endsWith(path.join('features', 'FM-003-inbox.md')));
  assert.ok(idx['SC-005'].endsWith(path.join('scenarios', 'SC-005-email.md')));
  assert.ok(idx['BG-GLOSSARY'].endsWith('glossary.md'));
});

test('computeHandoffStaleness: fresh when hashes match live .product/', () => {
  const root = seedProject({
    artifacts: [
      { dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'alpha' },
      { dir: 'scenarios', file: 'SC-005-email.md', id: 'SC-005', body: 'beta' },
    ],
  });
  const fmPath = path.join(root, '.product', 'features', 'FM-003-inbox.md');
  const scPath = path.join(root, '.product', 'scenarios', 'SC-005-email.md');
  fs.writeFileSync(
    path.join(root, '.product', 'handoffs', 'FM-003-handoff.md'),
    mkHandoff('FM-003', [{ id: 'FM-003', filePath: fmPath }, { id: 'SC-005', filePath: scPath }]),
    'utf8',
  );
  const res = computeHandoffStaleness(root);
  assert.strictEqual(res.summary.handoffsChecked, 1);
  assert.strictEqual(res.summary.staleCount, 0);
  assert.strictEqual(res.handoffs[0].status, 'fresh');
  assert.strictEqual(res.handoffs[0].checked, 2);
});

test('computeHandoffStaleness: stale when an embedded artifact body changed', () => {
  const root = seedProject({
    artifacts: [
      { dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'alpha' },
      { dir: 'business-rules', file: 'BR-010-link.md', id: 'BR-010', body: 'rule-v1' },
    ],
  });
  const fmPath = path.join(root, '.product', 'features', 'FM-003-inbox.md');
  const brPath = path.join(root, '.product', 'business-rules', 'BR-010-link.md');
  fs.writeFileSync(
    path.join(root, '.product', 'handoffs', 'FM-003-handoff.md'),
    mkHandoff('FM-003', [{ id: 'FM-003', filePath: fmPath }, { id: 'BR-010', filePath: brPath }]),
    'utf8',
  );
  // Edit BR-010 body AFTER the handoff snapshot → drift.
  fs.writeFileSync(brPath, mkArtifact('BR-010', 'rule-v2-CHANGED'), 'utf8');
  const res = computeHandoffStaleness(root);
  assert.strictEqual(res.summary.staleCount, 1);
  assert.strictEqual(res.handoffs[0].status, 'stale');
  assert.deepStrictEqual(res.handoffs[0].stale_artifacts, ['BR-010']);
  assert.deepStrictEqual(res.handoffs[0].missing_artifacts, []);
});

test('computeHandoffStaleness: frontmatter-only bump does NOT flip stale (hash reuse invariant)', () => {
  const root = seedProject({
    artifacts: [{ dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'alpha' }],
  });
  const fmPath = path.join(root, '.product', 'features', 'FM-003-inbox.md');
  fs.writeFileSync(
    path.join(root, '.product', 'handoffs', 'FM-003-handoff.md'),
    mkHandoff('FM-003', [{ id: 'FM-003', filePath: fmPath }]),
    'utf8',
  );
  // Change ONLY frontmatter (status/updated) — body untouched. hash.js excludes
  // frontmatter, so this must stay fresh.
  fs.writeFileSync(fmPath, '---\nid: FM-003\nstatus: shipped\nversion: 2\n---\n\n# FM-003\n\nalpha\n', 'utf8');
  const res = computeHandoffStaleness(root);
  assert.strictEqual(res.handoffs[0].status, 'fresh', 'frontmatter-only bump is not behavioral drift');
});

test('computeHandoffStaleness: missing artifact file ⇒ stale via missing_artifacts', () => {
  const root = seedProject({
    artifacts: [{ dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'alpha' }],
  });
  // Handoff references SC-999 which has no file.
  const handoff = [
    '---',
    'id: HANDOFF-FM-003',
    'feature: FM-003',
    'status: ready',
    'artifact_hashes:',
    `  FM-003: "${hash.computeArtifactHash(path.join(root, '.product', 'features', 'FM-003-inbox.md'))}"`,
    `  SC-999: "sha256:${'d'.repeat(64)}"`,
    '---',
    'body',
  ].join('\n');
  fs.writeFileSync(path.join(root, '.product', 'handoffs', 'FM-003-handoff.md'), handoff, 'utf8');
  const res = computeHandoffStaleness(root);
  assert.strictEqual(res.handoffs[0].status, 'stale');
  assert.deepStrictEqual(res.handoffs[0].missing_artifacts, ['SC-999']);
});

test('computeHandoffStaleness: handoff without artifact_hashes ⇒ error', () => {
  const root = seedProject({
    artifacts: [{ dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'a' }],
    handoffs: { 'FM-003-handoff.md': '---\nid: HANDOFF-FM-003\nfeature: FM-003\nstatus: ready\n---\nbody' },
  });
  const res = computeHandoffStaleness(root);
  assert.strictEqual(res.summary.errorCount, 1);
  assert.strictEqual(res.handoffs[0].status, 'error');
});

test('computeHandoffStaleness: no .product/handoffs ⇒ empty result + note, no throw', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hstale-empty-'));
  const res = computeHandoffStaleness(root);
  assert.strictEqual(res.summary.handoffsChecked, 0);
  assert.ok(/no \.product\/handoffs/.test(res.note));
});

test('toYaml: renders summary + per-handoff rows with flow lists', () => {
  const result = {
    handoffs: [{
      handoff: 'FM-003-handoff.md', feature: 'FM-003', status: 'stale',
      declared_status: 'ready', checked: 2, stale_artifacts: ['BR-010'], missing_artifacts: [],
    }],
    summary: { handoffsChecked: 1, staleCount: 1, errorCount: 0 },
  };
  const yaml = toYaml(result, new Date('2026-07-11T00:00:00Z'));
  assert.ok(/generated_at: 2026-07-11T00:00:00\.000Z/.test(yaml));
  assert.ok(/stale_count: 1/.test(yaml));
  assert.ok(/stale_artifacts: \[BR-010\]/.test(yaml));
  assert.ok(/missing_artifacts: \[\]/.test(yaml));
});

test('CLI seam: --json + --write persists snapshot, exit 0', () => {
  const root = seedProject({
    artifacts: [{ dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'alpha' }],
  });
  const fmPath = path.join(root, '.product', 'features', 'FM-003-inbox.md');
  fs.writeFileSync(
    path.join(root, '.product', 'handoffs', 'FM-003-handoff.md'),
    mkHandoff('FM-003', [{ id: 'FM-003', filePath: fmPath }]),
    'utf8',
  );
  const res = spawnSync('node', [LIB_PATH, '--root', root, '--json', '--write'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'CLI exits 0 (detect-only)');
  const parsed = JSON.parse(res.stdout);
  assert.strictEqual(parsed.summary.handoffsChecked, 1);
  const snapshot = path.join(root, '.claude', 'integrator', 'handoff-staleness.yaml');
  assert.ok(fs.existsSync(snapshot), 'snapshot persisted to Integrator zone');
  assert.ok(/handoffs_checked: 1/.test(fs.readFileSync(snapshot, 'utf8')));
});

test('CLI seam: never writes .product/ (read-only there)', () => {
  const root = seedProject({
    artifacts: [{ dir: 'features', file: 'FM-003-inbox.md', id: 'FM-003', body: 'alpha' }],
  });
  const fmPath = path.join(root, '.product', 'features', 'FM-003-inbox.md');
  const handoffPath = path.join(root, '.product', 'handoffs', 'FM-003-handoff.md');
  fs.writeFileSync(handoffPath, mkHandoff('FM-003', [{ id: 'FM-003', filePath: fmPath }]), 'utf8');
  const before = fs.readFileSync(handoffPath, 'utf8');
  spawnSync('node', [LIB_PATH, '--root', root, '--write'], { encoding: 'utf8' });
  assert.strictEqual(fs.readFileSync(handoffPath, 'utf8'), before, 'handoff (.product/) untouched');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
