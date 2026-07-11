'use strict';
/**
 * Unit test for the approve_overrides expiry sweeper (G28 / DEC-DEV-0180).
 *
 * Exercises classification (expired / active / no-expiry / malformed-date — the four
 * cases the brief requires), the --clean rewrite (validation-neutral removal of only
 * expired entries), the tree walk, and a CLI round-trip through a real `node` child.
 *
 * Node stdlib only; run with `node tests/product/override-sweep.test.cjs`.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LIB_PATH = path.join(__dirname, '..', '..', 'hooks', 'product', 'lib', 'override-sweep.cjs');
const sweeper = require(LIB_PATH);

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'ne'} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

// Fixed reference clock so tests are deterministic.
const NOW = Date.parse('2026-07-11T00:00:00Z');

function artifact(overridesBlock) {
  return [
    '---',
    'id: FM-001',
    'type: feature',
    'status: active',
    overridesBlock,
    '---',
    '',
    '# Body',
    '',
    'Some content.',
    '',
  ].join('\n');
}

console.log('override-sweep — G28 / DEC-DEV-0180');

// ---------- classification: the four required cases ----------

test('EXPIRED: expires_at parses and is < now', () => {
  eq(sweeper.classifyOverride({ rule: 'V-10', expires_at: '2026-05-18' }, NOW), 'expired', 'expired');
});

test('ACTIVE: expires_at parses and is >= now', () => {
  eq(sweeper.classifyOverride({ rule: 'V-10', expires_at: '2026-12-31' }, NOW), 'active', 'active');
});

test('NO-EXPIRY: no expires_at field (inline keeps active forever)', () => {
  eq(sweeper.classifyOverride({ rule: 'V-10' }, NOW), 'no-expiry', 'no-expiry');
  eq(sweeper.classifyOverride({ rule: 'V-10', expires_at: null }, NOW), 'no-expiry', 'null → no-expiry');
  eq(sweeper.classifyOverride({ rule: 'V-10', expires_at: '' }, NOW), 'no-expiry', 'empty → no-expiry');
});

test('MALFORMED: unparseable expires_at — NOT expired (inline treats as active)', () => {
  eq(sweeper.classifyOverride({ rule: 'V-10', expires_at: 'not-a-date' }, NOW), 'invalid-date', 'invalid-date');
  eq(sweeper.classifyOverride({ rule: 'V-10', expires_at: 'soon' }, NOW), 'invalid-date', 'invalid-date2');
});

// ---------- inline-consistency guard ----------

test('classification matches buildOverrideMap: only parseable-and-past deactivates', () => {
  // Mirror of the inline predicate `!isNaN(expiry) && expiry < now`.
  const inlineWouldDeactivate = (exp) => {
    const t = Date.parse(exp);
    return !Number.isNaN(t) && t < NOW;
  };
  for (const exp of ['2026-05-18', '2026-12-31', 'garbage']) {
    const deactivated = inlineWouldDeactivate(exp);
    const cls = sweeper.classifyOverride({ rule: 'V', expires_at: exp }, NOW);
    eq(cls === 'expired', deactivated, `inline/sweeper agree for ${exp}`);
  }
});

// ---------- sweepArtifact buckets ----------

test('sweepArtifact buckets a mixed approve_overrides block', () => {
  const block = [
    'approve_overrides:',
    '  - rule: V-10',
    '    reason: "past"',
    '    approved_by: human',
    '    expires_at: 2026-05-18',
    '  - rule: V-11',
    '    reason: "future"',
    '    expires_at: 2026-12-31',
    '  - rule: V-12',
    '    reason: "permanent"',
    '  - rule: V-13',
    '    reason: "typo date"',
    '    expires_at: whenever',
  ].join('\n');
  const s = sweeper.sweepArtifact(artifact(block), NOW);
  eq(s.expired.length, 1, 'one expired');
  eq(s.expired[0].rule, 'V-10', 'expired rule');
  eq(s.active.length, 1, 'one active');
  eq(s.noExpiry.length, 1, 'one no-expiry');
  eq(s.invalidDate.length, 1, 'one malformed');
});

test('sweepArtifact ignores entries without a rule (matches inline `if (!ov.rule) continue`)', () => {
  const block = [
    'approve_overrides:',
    '  - reason: "orphan, no rule"',
    '    expires_at: 2026-05-18',
  ].join('\n');
  const s = sweeper.sweepArtifact(artifact(block), NOW);
  eq(s.expired.length, 0, 'orphan not counted');
});

test('sweepArtifact no-op on artifact without approve_overrides', () => {
  const s = sweeper.sweepArtifact(artifact('title: hello'), NOW);
  eq(s.expired.length + s.active.length + s.noExpiry.length + s.invalidDate.length, 0, 'nothing');
});

// ---------- cleanContent: removes ONLY expired, validation-neutral ----------

test('cleanContent removes expired entry, keeps active/permanent/malformed', () => {
  const block = [
    'approve_overrides:',
    '  - rule: V-10',
    '    reason: "past"',
    '    expires_at: 2026-05-18',
    '  - rule: V-11',
    '    reason: "future"',
    '    expires_at: 2026-12-31',
  ].join('\n');
  const src = artifact(block);
  const { content, removed } = sweeper.cleanContent(src, NOW);
  eq(removed.length, 1, 'one removed');
  eq(removed[0].rule, 'V-10', 'removed V-10');
  assert(!content.includes('2026-05-18'), 'expired date gone');
  assert(content.includes('rule: V-11'), 'active kept');
  assert(content.includes('approve_overrides:'), 'header kept (survivors remain)');
  // Re-sweep the cleaned content: no expired left, active survives.
  const re = sweeper.sweepArtifact(content, NOW);
  eq(re.expired.length, 0, 're-swept: no expired');
  eq(re.active.length, 1, 're-swept: active survives');
});

test('cleanContent drops the header when all entries were expired', () => {
  const block = [
    'approve_overrides:',
    '  - rule: V-10',
    '    reason: "past"',
    '    expires_at: 2026-05-18',
  ].join('\n');
  const { content, removed } = sweeper.cleanContent(artifact(block), NOW);
  eq(removed.length, 1, 'one removed');
  assert(!content.includes('approve_overrides:'), 'empty header dropped');
  // Frontmatter still well-formed (opening + closing fence present).
  eq((content.match(/^---$/gm) || []).length, 2, 'two fences intact');
});

test('cleanContent is a no-op when nothing is expired', () => {
  const block = [
    'approve_overrides:',
    '  - rule: V-11',
    '    expires_at: 2026-12-31',
  ].join('\n');
  const src = artifact(block);
  const { content, removed } = sweeper.cleanContent(src, NOW);
  eq(removed.length, 0, 'nothing removed');
  eq(content, src, 'content untouched');
});

// ---------- tree walk ----------

function mkTmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovsweep-'));
  fs.mkdirSync(path.join(dir, '.product', 'features'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.product', '.pending'), { recursive: true });
  return dir;
}

test('sweepTree scans .product, counts expired, skips .pending', () => {
  const dir = mkTmpProject();
  try {
    fs.writeFileSync(path.join(dir, '.product', 'features', 'FM-001.md'), artifact([
      'approve_overrides:',
      '  - rule: V-10',
      '    expires_at: 2026-05-18',
    ].join('\n')));
    // A file in .pending must be ignored.
    fs.writeFileSync(path.join(dir, '.product', '.pending', 'noise.md'), artifact([
      'approve_overrides:',
      '  - rule: V-99',
      '    expires_at: 2000-01-01',
    ].join('\n')));
    const res = sweeper.sweepTree(dir, { now: NOW });
    eq(res.summary.filesScanned, 1, 'only the non-pending file scanned');
    eq(res.summary.expiredCount, 1, 'one expired total');
    eq(res.summary.filesWithExpired, 1, 'one file flagged');
    eq(res.files[0].rel, '.product/features/FM-001.md', 'rel path');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sweepTree returns empty summary when no .product dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovsweep-none-'));
  try {
    const res = sweeper.sweepTree(dir, { now: NOW });
    eq(res.summary.filesScanned, 0, 'nothing scanned');
    eq(res.files.length, 0, 'no files');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI round-trip ----------

test('CLI reports expired (default dry-run, no mutation) then --clean reaps them', () => {
  const dir = mkTmpProject();
  const file = path.join(dir, '.product', 'features', 'FM-001.md');
  try {
    fs.writeFileSync(file, artifact([
      'approve_overrides:',
      '  - rule: V-10',
      '    expires_at: 2020-01-01',
      '  - rule: V-11',
      '    expires_at: 2099-12-31',
    ].join('\n')));

    // Dry-run report: mentions the expired rule, must NOT touch the file.
    const before = fs.readFileSync(file, 'utf-8');
    const report = execFileSync('node', [LIB_PATH, dir], { encoding: 'utf-8' });
    assert(/V-10/.test(report), 'report names V-10');
    assert(/expired/i.test(report), 'report says expired');
    eq(fs.readFileSync(file, 'utf-8'), before, 'dry-run did not mutate the file');

    // --clean: reap only the expired one.
    const clean = execFileSync('node', [LIB_PATH, dir, '--clean'], { encoding: 'utf-8' });
    assert(/V-10/.test(clean), 'clean names V-10');
    const after = fs.readFileSync(file, 'utf-8');
    assert(!after.includes('2020-01-01'), 'expired reaped');
    assert(after.includes('rule: V-11'), 'active survives');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI --strict exits 1 when expired found, 0 when clean', () => {
  const dir = mkTmpProject();
  const file = path.join(dir, '.product', 'features', 'FM-001.md');
  try {
    fs.writeFileSync(file, artifact([
      'approve_overrides:',
      '  - rule: V-10',
      '    expires_at: 2020-01-01',
    ].join('\n')));
    let code = 0;
    try { execFileSync('node', [LIB_PATH, dir, '--strict', '--quiet'], { encoding: 'utf-8' }); }
    catch (e) { code = e.status; }
    eq(code, 1, '--strict exits 1 on expired');

    // Reap, then --strict should be clean.
    execFileSync('node', [LIB_PATH, dir, '--clean', '--quiet'], { encoding: 'utf-8' });
    let code2 = 1;
    try { execFileSync('node', [LIB_PATH, dir, '--strict', '--quiet'], { encoding: 'utf-8' }); code2 = 0; }
    catch (e) { code2 = e.status; }
    eq(code2, 0, '--strict exits 0 when clean');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\noverride-sweep: ${passed} passed`);
if (process.exitCode) { console.error('FAILED'); } else { console.log('OK'); }
