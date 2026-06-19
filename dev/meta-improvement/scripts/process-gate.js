#!/usr/bin/env node
/**
 * process-gate.js — D7 BLOCKING commit gate (DEC-DEV-0082).
 *
 * Invoked as a git `commit-msg` hook:  node process-gate.js <commit-msg-file>
 * Blocks the commit (exit 1) when the development-process obligations the 2026-06-19
 * D7 audit found UNENFORCED are unmet. This is the enforcement half of the
 * "harness follows the process autonomously" goal — it fires the same whether the
 * commit is made by Claude (via the Bash tool) or by a human in a terminal.
 *
 * Why commit-msg (not pre-commit / not a PreToolUse hook): at commit-msg time the
 * index is final (reflects `git add` done earlier in the same shell command) AND the
 * commit message is available — both are needed and both are reliable here.
 *
 * Checks (all blocking):
 *   1. COUNT DRIFT      — runs check-counts.js; canonical counts must agree across live docs.
 *   2. CHANGELOG MISSING — feat/fix touching the consumer zone must stage a CHANGELOG.md entry.
 *   3. DEV_JOURNAL MISSING — fix: (or a DEC-DEV-N reference) must stage a DEV_JOURNAL.md entry.
 *
 * Escape: put [skip-process-gate] anywhere in the commit message (intentional bypass).
 * Skip-not-abort: any internal error → exit 0 (a tooling bug must never wedge the repo).
 *
 * NB on philosophy: this gate deliberately overrides the D7 "tooling over discipline"
 * default (SPEC §5 #4) — an explicit owner decision (DEC-DEV-0082) to harden the two
 * worst silently-violated obligations with a real block, not just a reminder.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function main() {
  const msgFile = process.argv[2];
  if (!msgFile || !fs.existsSync(msgFile)) return 0; // not invoked as a commit-msg hook
  const message = fs.readFileSync(msgFile, 'utf8');
  const subject = message.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';

  if (/\[skip-process-gate\]/i.test(message)) {
    process.stderr.write('process-gate: skipped via [skip-process-gate].\n');
    return 0;
  }

  let staged = [];
  try {
    staged = git('diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean);
  } catch (e) {
    return 0;
  }
  if (staged.length === 0) return 0; // nothing to commit (e.g. --amend with no changes)

  const repoRoot = git('rev-parse --show-toplevel');
  const failures = [];

  // ── 1. Count consistency (deterministic, repo-wide) ──
  try {
    execSync(`node "${path.join(repoRoot, 'dev/meta-improvement/scripts/check-counts.js')}"`,
      { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    const out = ((e.stderr || '').toString() || 'check-counts reported drift').trimEnd();
    failures.push('COUNT DRIFT — canonical counts disagree across live docs:\n' +
      out.split('\n').map(l => '      ' + l).join('\n'));
  }

  // ── classify commit ──
  const isFeat = /^feat(\(|:)/i.test(subject);
  const isFix = /^fix(\(|:)/i.test(subject);
  const mentionsDecDev = /DEC-DEV-\d+/i.test(message);

  const CONSUMER = /^(commands|skills|agents|hooks|docs|templates|adapters|orchestrator)\//;
  const CONSUMER_ROOT = /^(README\.md|ROADMAP\.md|install\.(sh|ps1)|\.env\.template|gitignore\.template)$/;
  const touchesConsumer = staged.some(f => CONSUMER.test(f) || CONSUMER_ROOT.test(f));
  const stagedChangelog = staged.includes('CHANGELOG.md');
  const stagedJournal = staged.includes('DEV_JOURNAL.md');

  // ── 2. CHANGELOG accumulation contract ──
  if ((isFeat || isFix) && touchesConsumer && !stagedChangelog) {
    failures.push('CHANGELOG MISSING — a feat/fix touching the consumer zone ' +
      '(commands/skills/agents/hooks/docs/templates/adapters/orchestrator or root README/ROADMAP/install) ' +
      'must carry a CHANGELOG.md [Unreleased] entry (accumulation contract — CONVENTIONS §11.1).');
  }

  // ── 3. DEV_JOURNAL contract ──
  if ((isFix || mentionsDecDev) && !stagedJournal) {
    failures.push('DEV_JOURNAL MISSING — ' +
      (isFix ? 'a fix: commit (root cause + lesson)' : 'a commit referencing DEC-DEV-N (decision rationale)') +
      ' must carry a DEV_JOURNAL.md entry (CLAUDE.md §1).');
  }

  if (failures.length === 0) return 0;

  process.stderr.write(`\n✗ process-gate: commit BLOCKED — ${failures.length} obligation(s) unmet:\n\n`);
  failures.forEach((f, i) => process.stderr.write(`  [${i + 1}] ${f}\n\n`));
  process.stderr.write('Fix the above and re-commit, or bypass intentionally with ' +
    '[skip-process-gate] in the commit message.\n');
  process.stderr.write('(D7 process gate — DEC-DEV-0082; see CLAUDE.md "Process triggers — harness contract".)\n');
  return 1;
}

let code = 0;
try {
  code = main();
} catch (e) {
  code = 0; // skip-not-abort: never block on an internal gate error
}
process.exit(code);
