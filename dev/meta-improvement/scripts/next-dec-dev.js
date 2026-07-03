#!/usr/bin/env node
/**
 * next-dec-dev.js — deterministic DEC-DEV decision-number allocator.
 *
 * Closes the collision pattern found across 2026-06-30..07-01: DEC-DEV numbers were
 * assigned from the local main-branch DEV_JOURNAL.md tail alone, but parallel sessions
 * working on OTHER branches had already claimed higher numbers in their own (unmerged)
 * DEV_JOURNAL.md. Five separate collisions in two days (see memory
 * `feedback_dec_dev_collision_check`) — the fix is to scan main AND every remote branch,
 * not just the branch you happen to be on.
 *
 * GROUND TRUTH (computed, not asserted):
 *   - local tail  = max `## DEC-DEV-NNNN` heading in the local DEV_JOURNAL.md
 *   - branch tails = max `## DEC-DEV-NNNN` heading in DEV_JOURNAL.md as committed on
 *                    every `origin/*` remote-tracking branch (except origin/HEAD, origin/main)
 *   - global max   = highest of all of the above; next-free = global max + 1
 *
 * Usage:
 *   node dev/meta-improvement/scripts/next-dec-dev.js              # report + next-free number
 *   node dev/meta-improvement/scripts/next-dec-dev.js --check 0141 # is this number free?
 *
 * Exit codes:
 *   report mode : always 0 (informational).
 *   --check mode: 0 = FREE, 1 = TAKEN (or a bad/missing argument).
 *
 * Network: does a best-effort `git fetch origin --quiet` first so remote-tracking refs are
 * fresh. Offline / fetch failure is non-fatal — falls back to whatever `origin/*` refs are
 * already known locally (a warning is printed to stderr either way).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function repoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch (e) {
    return process.cwd();
  }
}

const ROOT = repoRoot();
const JOURNAL_REL = 'DEV_JOURNAL.md';
const HEADING_RE = /^## DEC-DEV-(\d{4})/gm;

function extractNumbers(text) {
  const nums = [];
  let m;
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(text)) !== null) {
    nums.push(parseInt(m[1], 10));
  }
  return nums;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

function readLocalJournal() {
  const p = path.join(ROOT, JOURNAL_REL);
  try {
    return extractNumbers(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write(`warn: cannot read local ${JOURNAL_REL}: ${e.message}\n`);
    return [];
  }
}

function gitFetch() {
  try {
    execSync('git fetch origin --quiet', { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    process.stderr.write('warn: git fetch origin failed — using offline snapshot of remote-tracking refs.\n');
  }
}

function listRemoteBranches() {
  let out;
  try {
    out = execSync('git branch -r --format=%(refname:short)', { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    process.stderr.write(`warn: cannot list remote branches: ${e.message}\n`);
    return [];
  }
  return out
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(ref => ref !== 'origin/HEAD' && ref !== 'origin/main');
}

function readJournalAtRef(ref) {
  try {
    const out = execSync(`git show ${ref}:${JOURNAL_REL}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return extractNumbers(out);
  } catch (e) {
    // Branch may not have DEV_JOURNAL.md (or the ref may be gone) — not fatal, just no data.
    return [];
  }
}

function pad4(n) {
  return String(n).padStart(4, '0');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const checkIdx = args.indexOf('--check');
  const checkValue = checkIdx !== -1 ? args[checkIdx + 1] : null;

  const localNums = readLocalJournal();
  const localMax = localNums.length ? Math.max(...localNums) : 0;

  gitFetch();
  const branches = listRemoteBranches();

  const sources = [{ label: 'main (local DEV_JOURNAL.md)', numbers: localNums, max: localMax }];
  for (const ref of branches) {
    const nums = readJournalAtRef(ref);
    if (nums.length) sources.push({ label: ref, numbers: nums, max: Math.max(...nums) });
  }

  const globalMax = Math.max(0, ...sources.map(s => s.max));
  const nextFree = globalMax + 1;

  // ── --check mode ──
  if (checkValue !== null) {
    const n = parseInt(checkValue, 10);
    if (Number.isNaN(n)) {
      process.stderr.write(`error: --check requires a numeric DEC-DEV number, got "${checkValue}"\n`);
      process.exit(1);
    }
    if (n > globalMax) {
      process.stdout.write(`DEC-DEV-${pad4(n)}: FREE\n`);
      process.exit(0);
    }
    const holders = sources.filter(s => s.numbers.includes(n)).map(s => s.label);
    if (holders.length) {
      process.stdout.write(`DEC-DEV-${pad4(n)}: TAKEN by ${holders.join(', ')}\n`);
    } else {
      process.stdout.write(
        `DEC-DEV-${pad4(n)}: TAKEN (<= current max DEC-DEV-${pad4(globalMax)}; no exact heading found — ` +
        `likely a gap in the sequence, still avoid reusing it)\n`
      );
    }
    process.exit(1);
  }

  // ── report mode ──
  process.stdout.write(`NEXT-FREE DEC-DEV = ${pad4(nextFree)}\n\n`);
  process.stdout.write(`main-tail (local DEV_JOURNAL.md): DEC-DEV-${pad4(localMax)}\n`);

  const ahead = sources.slice(1).filter(s => s.max > localMax);
  if (ahead.length) {
    process.stdout.write('Branches holding numbers ahead of main-tail:\n');
    for (const s of ahead) {
      process.stdout.write(`  ${s.label}: max DEC-DEV-${pad4(s.max)}\n`);
    }
  } else {
    process.stdout.write('No remote branches hold DEC-DEV numbers ahead of main-tail.\n');
  }
}

main();
