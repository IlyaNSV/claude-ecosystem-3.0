#!/usr/bin/env node
/**
 * verify-hooks.js — combined verifier для hooks/.
 *
 * Always runs: smoke-hooks.js (syntax + runtime test, no deps).
 * Conditionally runs: eslint hooks/ — only if node_modules/eslint installed.
 *
 * Used by:
 *   - `npm run verify` / `npm run verify:hooks` (manual)
 *   - dev/meta-improvement/checklists/phase-closure.md "Hook smoke run" step
 *   - .git/hooks/pre-commit (if installed via dev/meta-improvement/scripts/install-pre-commit.sh)
 *
 * Exit codes:
 *   0 — all checks pass (smoke + eslint if available)
 *   1 — at least one check failed (caller should treat as blocking)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
let ECO_ROOT = SCRIPT_DIR;
while (ECO_ROOT !== path.parse(ECO_ROOT).root) {
  if (fs.existsSync(path.join(ECO_ROOT, 'hooks')) && fs.existsSync(path.join(ECO_ROOT, 'docs', 'pmo'))) break;
  ECO_ROOT = path.dirname(ECO_ROOT);
}

let exitCode = 0;

// Step 1: smoke runner (always)
console.log('=== smoke-hooks ===');
const smokeRes = spawnSync('node', [path.join(SCRIPT_DIR, 'smoke-hooks.js')], {
  stdio: 'inherit',
  cwd: ECO_ROOT,
});
if (smokeRes.status !== 0) {
  exitCode = 1;
}

// Step 2: eslint (conditional)
const eslintBin = path.join(ECO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint');
if (fs.existsSync(eslintBin)) {
  console.log('\n=== eslint hooks/ ===');
  const lintRes = spawnSync(eslintBin, ['hooks/'], {
    stdio: 'inherit',
    cwd: ECO_ROOT,
    shell: process.platform === 'win32',
  });
  if (lintRes.status !== 0) {
    exitCode = 1;
  }
} else {
  console.log('\nSKIP  eslint hooks/ (run `npm install` to enable richer static analysis)');
}

console.log('');
process.exit(exitCode);
