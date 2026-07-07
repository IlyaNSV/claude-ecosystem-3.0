#!/usr/bin/env node
/**
 * install-git-hooks.cjs — cross-platform installer for the ecosystem git hooks
 * (DEC-DEV-0157; closes audit gap G23 — the D7 process-gate existed only where
 * install-pre-commit.sh had been run by hand, so a fresh clone carried NO
 * blocking gate until someone remembered the ritual).
 *
 * Single implementation (this file). Entry points:
 *   - npm "prepare" (package.json) → runs on every `npm install` / `npm ci`
 *     with --best-effort: NEVER fails the install (no git / not a repo → warn, exit 0)
 *   - manual strict: node dev/meta-improvement/scripts/install-git-hooks.cjs
 *   - bash dev/meta-improvement/scripts/install-pre-commit.sh — thin wrapper
 *     kept for the documented CLAUDE.md entry point
 *
 * Installs TWO hooks (same contract as the historical bash installer,
 * DEC-DEV-0023 + DEC-DEV-0083):
 *   pre-commit  ← pre-commit.sh   (hook-smoke gate; blocks on hooks/ verification failure)
 *   commit-msg  ← commit-msg.sh   (D7 process gate — process-gate.js: count drift /
 *                                   missing CHANGELOG / missing DEV_JOURNAL)
 *
 * Idempotent (identical target → no-op). Worktree-safe: `git rev-parse --git-path hooks`
 * resolves the shared common hooks dir and honours core.hooksPath. A pre-existing
 * DIFFERING hook is backed up before overwrite.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BEST_EFFORT = process.argv.includes('--best-effort');

function bail(msg) {
  process.stderr.write(`install-git-hooks: ${msg}\n`);
  process.exit(BEST_EFFORT ? 0 : 1);
}

function git(args, cwd) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function main() {
  let repoRoot;
  try {
    repoRoot = git(['rev-parse', '--show-toplevel'], __dirname);
  } catch (e) {
    return bail('not inside a git repo (tarball install?) — skipping hook install');
  }

  let hooksDir;
  try {
    // Relative output is relative to the cwd we ran git in (repoRoot) — resolve handles both.
    hooksDir = path.resolve(repoRoot, git(['rev-parse', '--git-path', 'hooks'], repoRoot));
  } catch (e) {
    return bail(`cannot resolve the hooks dir: ${e.message}`);
  }
  fs.mkdirSync(hooksDir, { recursive: true });

  const srcDir = path.join(repoRoot, 'dev', 'meta-improvement', 'scripts');
  const hooks = [
    ['pre-commit', 'pre-commit.sh'],
    ['commit-msg', 'commit-msg.sh'],
  ];

  for (const [name, srcBase] of hooks) {
    const source = path.join(srcDir, srcBase);
    if (!fs.existsSync(source)) return bail(`source script missing: ${source}`);
    const target = path.join(hooksDir, name);
    const srcBuf = fs.readFileSync(source);

    if (fs.existsSync(target)) {
      if (fs.readFileSync(target).equals(srcBuf)) {
        process.stdout.write(`install-git-hooks: ${name} already up to date\n`);
        continue;
      }
      const backup = `${target}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.copyFileSync(target, backup);
      process.stdout.write(`install-git-hooks: existing ${name} backed up to ${backup}\n`);
    }

    fs.copyFileSync(source, target);
    try { fs.chmodSync(target, 0o755); } catch (e) { /* Windows: mode is a no-op */ }
    process.stdout.write(`install-git-hooks: installed ${name} → ${target}\n`);
  }

  process.stdout.write(
    'install-git-hooks: done — pre-commit (hook smoke) + commit-msg (D7 process gate).\n' +
    'Bypass a single commit: add [skip-process-gate] to the message (use sparingly).\n'
  );
}

main();
