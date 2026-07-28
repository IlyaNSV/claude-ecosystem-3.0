'use strict';
/**
 * Unit test for hooks/product/bg-extractor.js source-zone allowlist (DEC-DEV-0219).
 *
 * The extractor must queue BG candidates ONLY from source artifact zones.
 * Derived docs (handoffs/) and working dot-dirs (.design-sessions/, ...) are not
 * glossary sources — live precedents: 223 junk candidates from regenerated
 * handoffs (template labels), ghost candidates from .design-sessions/FM-008-*.
 *
 * Node stdlib only; run: node tests/product/bg-extractor-scope.test.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', '..', 'hooks', 'product', 'bg-extractor.js');

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

function seed() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgext-'));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  for (const d of ['features', 'handoffs', '.design-sessions', '.pending']) {
    fs.mkdirSync(path.join(root, '.product', d), { recursive: true });
  }
  return root;
}

function runHook(filePath) {
  const res = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
  assert.strictEqual(res.status, 0, `hook exits 0 (got ${res.status}; stderr: ${res.stderr})`);
}

function queue(root) {
  const p = path.join(root, '.product', '.pending', 'bg-candidates.yaml');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const BODY = '\n# Doc\n\nHere **Уникальный Термин** appears in running text of the body.\n';

test('source zone (features/) still queues candidates', () => {
  const root = seed();
  const f = path.join(root, '.product', 'features', 'FM-001-alpha.md');
  fs.writeFileSync(f, '---\nid: FM-001\ntype: feature\nstatus: active\n---' + BODY, 'utf8');
  runHook(f);
  assert.ok(queue(root).includes('Уникальный Термин'), 'candidate queued from features/');
});

test('handoffs/ is NOT an extraction source (derived doc)', () => {
  const root = seed();
  const f = path.join(root, '.product', 'handoffs', 'FM-001-handoff.md');
  fs.writeFileSync(f, '---\nid: HANDOFF-FM-001\ntype: feature-handoff\n---\n\n- **Фича:** FM-001\n- **Сегмент:** SEG-001\n- **Уникальный Термин** тоже тут.\n', 'utf8');
  runHook(f);
  assert.strictEqual(queue(root), '', 'no queue file created from handoffs/');
});

test('.design-sessions/ is NOT an extraction source (working dot-dir)', () => {
  const root = seed();
  const f = path.join(root, '.product', '.design-sessions', 'FM-008-export-preview.md');
  fs.writeFileSync(f, '# Session\n\n- **MK-008** — mockup package\n', 'utf8');
  runHook(f);
  assert.strictEqual(queue(root), '', 'no queue file created from .design-sessions/');
});

test('glossary.md itself stays excluded (no BG -> BG loop)', () => {
  const root = seed();
  const f = path.join(root, '.product', 'glossary.md');
  fs.writeFileSync(f, '---\nid: BG\ntype: glossary\nstatus: active\n---' + BODY, 'utf8');
  runHook(f);
  assert.strictEqual(queue(root), '', 'no queue file created from glossary.md');
});

test('root singleton (rpm.md) remains a source', () => {
  const root = seed();
  const f = path.join(root, '.product', 'rpm.md');
  fs.writeFileSync(f, '---\nid: RPM\ntype: role-permission-map\nstatus: active\n---' + BODY, 'utf8');
  runHook(f);
  assert.ok(queue(root).includes('Уникальный Термин'), 'candidate queued from root singleton');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
