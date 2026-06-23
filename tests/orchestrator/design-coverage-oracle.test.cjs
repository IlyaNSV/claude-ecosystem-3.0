'use strict';
/**
 * Unit test for the Orchestrator design-coverage-oracle (DEC-DEV-0095, N+2 / T4, FB-LR-05).
 *
 * The lib is the deterministic backbone for the design→tasks structural-coverage axis: it
 * re-derives the design's File-Structure file list + scans tasks.md from GROUND TRUTH text.
 * The pure extractors are unit-tested here (the P4 process layers a semantic-checker +
 * verify-finding-before-act on top — that part is exercised by the wiring test).
 *
 * Node stdlib only; run with `node tests/orchestrator/design-coverage-oracle.test.cjs`.
 */

const assert = require('node:assert');
const path = require('node:path');

const lib = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'design-coverage-oracle.cjs'));
const { extractDesignFiles, computeCoverage, extractForwardRefs } = lib;

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

console.log('orchestrator design-coverage-oracle — design→tasks coverage (DEC-DEV-0095)');

const designMd = [
  '# Design',
  '',
  '## File Structure',
  '',
  '```',
  'src/',
  '├── admin/',
  '│   ├── admin.module.ts',
  '│   └── admin.controller.ts',
  '└── shared/util.ts',
  '```',
  '',
  '## Components',          // a sibling ## heading closes the File Structure section
  'outside/ignored.ts',     // must NOT be extracted (outside the structure section)
  '',
].join('\n');

const tasksMd = [
  '# Tasks',
  '- [ ] 1.1 Create the admin controller',
  '  _Boundary: src/admin/admin.controller.ts_',
  '- [ ] 1.2 Create the shared util',
  '  _Boundary: src/shared/util.ts_',
  '- [ ] 1.3 Wire the routes (wired up in a later task)',
  '  _Boundary: src/routes.ts_',
].join('\n');

test('extractDesignFiles: only files under the File-Structure section (dirs + outside ignored)', () => {
  const files = extractDesignFiles(designMd).map((f) => f.path);
  assert.ok(files.includes('admin.module.ts'), 'admin.module.ts not extracted');
  assert.ok(files.includes('admin.controller.ts'), 'admin.controller.ts not extracted');
  assert.ok(files.includes('shared/util.ts'), 'shared/util.ts not extracted');
  assert.ok(!files.some((f) => f.includes('ignored')), 'a path outside the structure section leaked in');
  assert.ok(!files.some((f) => /\/$/.test(f)), 'a bare directory was extracted as a file');
});

test('extractDesignFiles: no structure section → [] (conservative, no findings)', () => {
  assert.deepStrictEqual(extractDesignFiles('# Design\n\nSome prose, no structure heading.\nfoo/bar.ts'), []);
});

test('computeCoverage: a design file no task mentions is UNCOVERED (the FB-LR-05 unmounted-module gap)', () => {
  const files = extractDesignFiles(designMd);
  const { covered, uncovered } = computeCoverage(files, tasksMd);
  const u = uncovered.map((f) => f.path);
  assert.deepStrictEqual(u, ['admin.module.ts'], `expected only admin.module.ts uncovered, got ${JSON.stringify(u)}`);
  const c = covered.map((f) => f.path);
  assert.ok(c.includes('admin.controller.ts') && c.includes('shared/util.ts'), 'mentioned files not marked covered');
});

test('computeCoverage: a full-path match counts as covered', () => {
  const files = [{ path: 'src/shared/util.ts', line: 1 }];
  const { uncovered } = computeCoverage(files, '- [ ] 1.1 x\n  _Boundary: src/shared/util.ts_');
  assert.strictEqual(uncovered.length, 0, 'full-path boundary match should be covered');
});

test('extractForwardRefs: a vague deferred wiring is flagged (T4-lite)', () => {
  const refs = extractForwardRefs(tasksMd);
  assert.strictEqual(refs.length, 1, `expected 1 forward-ref, got ${refs.length}`);
  assert.strictEqual(refs[0].line, 6, 'forward-ref line number wrong');
});

test('extractForwardRefs: a normal task line is not flagged', () => {
  assert.strictEqual(extractForwardRefs('- [ ] 1.1 Implement the login handler\n  _Boundary: src/auth.ts_').length, 0);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
