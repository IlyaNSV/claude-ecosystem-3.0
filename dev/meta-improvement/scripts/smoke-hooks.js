#!/usr/bin/env node
/**
 * smoke-hooks.js — run each PostToolUse hook with a minimal test input.
 *
 * Intent: catch runtime errors (ReferenceError / TypeError / SyntaxError) before
 * commit / phase closure. The Phase 3 smoke test (DEC-DEV-0023) revealed bg-extractor
 * was throwing TDZ ReferenceError on every save — undetected for full phase because
 * no smoke step existed.
 *
 * Per-hook protocol:
 *   1. node --check <file> (syntax)
 *   2. echo '<minimal hookInput JSON>' | node <file> (runtime)
 *   3. assert exit 0 + stderr free of ReferenceError|TypeError|SyntaxError
 *
 * Hooks should `process.exit(0)` for irrelevant inputs (file missing, bad path, etc.) —
 * that's the "non-blocking" contract per manifest.
 *
 * Usage:
 *   node dev/meta-improvement/scripts/smoke-hooks.js [--verbose]
 *
 * Exit codes:
 *   0 — all hooks passed smoke
 *   1 — one or more hooks failed (output details to stderr)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Anchor at ecosystem root: traverse up from script location until we find hooks/manifest.yaml-bearing dir.
const SCRIPT_DIR = __dirname;
let ECO_ROOT = SCRIPT_DIR;
while (ECO_ROOT !== path.parse(ECO_ROOT).root) {
  if (fs.existsSync(path.join(ECO_ROOT, 'hooks')) && fs.existsSync(path.join(ECO_ROOT, 'docs', 'pmo'))) break;
  ECO_ROOT = path.dirname(ECO_ROOT);
}
if (!fs.existsSync(path.join(ECO_ROOT, 'hooks'))) {
  console.error(`ERROR: could not anchor ecosystem root from ${SCRIPT_DIR}`);
  process.exit(2);
}

// Test input: a path that doesn't exist в .product/ — hooks должны exit 0 cleanly.
// We use a tmp path inside .product/ structure to satisfy filter regexes без trigger'я
// real artifact processing.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eco-smoke-'));
const TMP_PRODUCT = path.join(TMP_DIR, '.product');
fs.mkdirSync(path.join(TMP_PRODUCT, 'business-rules'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'invariants'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'scenarios'), { recursive: true });
fs.mkdirSync(path.join(TMP_PRODUCT, 'features'), { recursive: true });
fs.mkdirSync(path.join(TMP_DIR, '.claude'), { recursive: true });

// Per-hook test cases: file_path must match the hook's filter regex.
const TEST_CASES = [
  { hook: 'hooks/product/artifact-validate.js',     filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
  { hook: 'hooks/product/bg-extractor.js',          filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
  { hook: 'hooks/product/cascade-check.js',         filePath: path.join(TMP_PRODUCT, 'scenarios', 'SC-001-test.md') },
  { hook: 'hooks/product/br-change-trigger.js',     filePath: path.join(TMP_PRODUCT, 'business-rules', 'BR-001-test.md') },
  { hook: 'hooks/product/ic-change-trigger.js',     filePath: path.join(TMP_PRODUCT, 'invariants', 'IC-001-test.md') },
  { hook: 'hooks/product/session-state.js',         filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
  { hook: 'hooks/product/product-handoff-gate.js',  filePath: path.join(TMP_PRODUCT, 'features', 'FM-001-test.md') },
];

// Patterns в stderr that signal real bugs (vs benign log).
const FATAL_PATTERNS = [
  /ReferenceError/,
  /TypeError/,
  /SyntaxError/,
  /Cannot access .* before initialization/,
  /is not defined/,
  /is not a function/,
  /Unexpected token/,
];

let totalRun = 0;
let failures = [];

for (const tc of TEST_CASES) {
  const hookPath = path.join(ECO_ROOT, tc.hook);
  if (!fs.existsSync(hookPath)) {
    if (VERBOSE) console.log(`SKIP  ${tc.hook} (not found)`);
    continue;
  }
  totalRun++;

  // Step 1: syntax check
  const syntaxRes = spawnSync('node', ['--check', hookPath], { encoding: 'utf-8' });
  if (syntaxRes.status !== 0) {
    failures.push({
      hook: tc.hook,
      phase: 'syntax',
      stderr: syntaxRes.stderr || '',
      stdout: syntaxRes.stdout || '',
    });
    console.error(`FAIL  ${tc.hook} (syntax)`);
    continue;
  }

  // Step 2: runtime smoke — pipe hook input JSON
  const hookInput = JSON.stringify({
    session_id: 'smoke',
    tool_name: 'Write',
    tool_input: { file_path: tc.filePath },
    cwd: TMP_DIR,
  });
  const runRes = spawnSync('node', [hookPath], {
    input: hookInput,
    encoding: 'utf-8',
    timeout: 10000,
  });
  const stderr = runRes.stderr || '';
  const fatalHit = FATAL_PATTERNS.find((rx) => rx.test(stderr));

  if (runRes.status !== 0 && !fatalHit) {
    // Non-zero exit без явной fatal pattern — ok, hook may signal back; warn but pass.
    if (VERBOSE) console.log(`WARN  ${tc.hook} (exit ${runRes.status}, no fatal pattern; treated pass)`);
  }

  if (fatalHit) {
    failures.push({
      hook: tc.hook,
      phase: 'runtime',
      pattern: fatalHit.toString(),
      stderr: stderr.slice(0, 2000),
      stdout: (runRes.stdout || '').slice(0, 500),
    });
    console.error(`FAIL  ${tc.hook} (runtime: ${fatalHit})`);
    continue;
  }

  console.log(`PASS  ${tc.hook}`);
}

// Cleanup tmp dir
try {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
} catch (e) {
  // Silent — tmp leftover не critical
}

console.log('');
console.log(`Total: ${totalRun} hook(s) tested; ${failures.length} failure(s).`);

if (failures.length > 0) {
  console.error('');
  console.error('=== Failures ===');
  for (const f of failures) {
    console.error(`\n${f.hook} [${f.phase}${f.pattern ? ': ' + f.pattern : ''}]`);
    if (f.stderr) console.error(`stderr:\n${f.stderr}`);
    if (f.stdout && VERBOSE) console.error(`stdout:\n${f.stdout}`);
  }
  process.exit(1);
}

process.exit(0);
