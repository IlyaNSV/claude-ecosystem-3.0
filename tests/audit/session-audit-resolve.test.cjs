'use strict';
/**
 * Unit test for session-audit.js findRepoRoot() — the D7 SessionEnd marker
 * hook's ecosystem-repo-root resolver (DEC-DEV-0183; closes gap G24 leg (f)).
 *
 * The hook is registered in a pilot with an ABSOLUTE path; the resolver is what
 * keeps root-resolution robust for the cases the script can still see, and must
 * fail LOUDLY (never silently) when it can't resolve. Both the "valid" and the
 * "repo relocated" paths are exercised here without spawning.
 *
 * Node stdlib only; run with `node tests/audit/session-audit-resolve.test.cjs`
 * or `npm run test:audit`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const { findRepoRoot, isRepoRoot, buildMarkerRow } = require(
  path.join(REPO_ROOT, 'dev', 'meta-improvement', 'hooks', 'session-audit.js')
);

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

console.log('session-audit — repo-root resolver (DEC-DEV-0183, G24 leg f)');

// ---- fixtures: a fake "ecosystem repo" laid out in a temp dir --------------

function makeFakeRepo(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sa-${label}-`));
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# fake\n');
  fs.writeFileSync(path.join(root, 'DEV_JOURNAL.md'), '# fake\n');
  // Mirror the real hook location so the scriptDir fallback (3 levels up) lands
  // on the repo root: <root>/dev/meta-improvement/hooks/
  const hookDir = path.join(root, 'dev', 'meta-improvement', 'hooks');
  fs.mkdirSync(hookDir, { recursive: true });
  return { root, hookDir };
}

const cleanups = [];
function tmpRepo(label) {
  const r = makeFakeRepo(label);
  cleanups.push(r.root);
  return r;
}

// A silent warn sink that records whether a loud warning was emitted.
function warnSink() {
  const calls = [];
  const fn = (m) => calls.push(String(m));
  fn.calls = calls;
  return fn;
}

// ---- VALID resolution ------------------------------------------------------

test('valid: walks up from a cwd inside the repo → repo root', () => {
  const { root } = tmpRepo('valid-cwd');
  const deepCwd = path.join(root, 'some', 'nested', 'dir');
  fs.mkdirSync(deepCwd, { recursive: true });
  const warn = warnSink();
  const got = findRepoRoot(deepCwd, { env: {}, scriptDir: '/nope', warn });
  assert.strictEqual(fs.realpathSync(got), fs.realpathSync(root), 'cwd-walk should find the root');
  assert.strictEqual(warn.calls.length, 0, 'a clean resolve must not warn');
});

test('valid: $ECOSYSTEM_ROOT override wins even from an unrelated cwd', () => {
  const { root } = tmpRepo('valid-env');
  const unrelated = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-unrelated-'));
  cleanups.push(unrelated);
  const got = findRepoRoot(unrelated, { env: { ECOSYSTEM_ROOT: root }, scriptDir: '/nope' });
  assert.strictEqual(fs.realpathSync(got), fs.realpathSync(root), 'env override should resolve');
});

test('valid: scriptDir fallback resolves when cwd has no repo markers (pilot case)', () => {
  const { root, hookDir } = tmpRepo('valid-script');
  const pilotCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-pilot-'));
  cleanups.push(pilotCwd);
  const got = findRepoRoot(pilotCwd, { env: {}, scriptDir: hookDir });
  assert.strictEqual(fs.realpathSync(got), fs.realpathSync(root), 'scriptDir (3 up) should be the root');
});

// ---- RELOCATED / broken resolution -----------------------------------------

test('relocated: a wrong $ECOSYSTEM_ROOT warns loudly then falls back to cwd-walk', () => {
  const { root } = tmpRepo('reloc-env-fallback');
  const bogus = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-bogus-'));
  cleanups.push(bogus);
  const deepCwd = path.join(root, 'a', 'b');
  fs.mkdirSync(deepCwd, { recursive: true });
  const warn = warnSink();
  const got = findRepoRoot(deepCwd, { env: { ECOSYSTEM_ROOT: bogus }, scriptDir: '/nope', warn });
  assert.strictEqual(fs.realpathSync(got), fs.realpathSync(root), 'should recover via cwd-walk');
  assert.ok(warn.calls.length === 1, 'a wrong ECOSYSTEM_ROOT must warn (not silent)');
  assert.ok(/ECOSYSTEM_ROOT/.test(warn.calls[0]), 'warning names the bad env var');
});

test('relocated: everything gone → returns null (caller emits the loud remediation)', () => {
  // cwd has no markers, env unset, scriptDir points somewhere without markers →
  // this is the "repo moved, hook path stale" total-miss the gap is about.
  const pilotCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-orphan-'));
  cleanups.push(pilotCwd);
  const noMarkers = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-nomarkers-'));
  cleanups.push(noMarkers);
  const got = findRepoRoot(pilotCwd, { env: {}, scriptDir: noMarkers });
  assert.strictEqual(got, null, 'unresolvable → null (so main() can warn loudly + skip)');
});

// ---- helpers ---------------------------------------------------------------

test('isRepoRoot: true only when BOTH signature files exist', () => {
  const { root } = tmpRepo('sig');
  assert.strictEqual(isRepoRoot(root), true);
  const halfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-half-'));
  cleanups.push(halfDir);
  fs.writeFileSync(path.join(halfDir, 'CLAUDE.md'), 'x'); // only one signature
  assert.strictEqual(isRepoRoot(halfDir), false, 'one signature file is not enough');
});

test('buildMarkerRow: stable table row with a fixed timestamp', () => {
  const row = buildMarkerRow({
    session_id: 'sess-1',
    transcript_path: '/t/abc.jsonl',
    cwd: '/home/dev/my-first-test',
    reason: 'clear',
    now: new Date('2026-07-11T00:00:00Z'),
  });
  assert.ok(row.includes('| `sess-1` |'), 'session id cell');
  assert.ok(row.includes('2026-07-11T00:00:00.000Z'), 'ended_at cell');
  assert.ok(row.includes('my-first-test'), 'target basename cell');
  assert.ok(row.includes('`/t/abc.jsonl` (reason: clear)'), 'transcript + reason cell');
});

// ---- teardown --------------------------------------------------------------

for (const dir of cleanups) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
