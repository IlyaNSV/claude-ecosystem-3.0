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
 *                    AND every LOCAL branch (a parallel session's number lives in a local
 *                    commit long before it is pushed — G32 hole #1, DEC-DEV-0160)
 *   - active claims = unexpired reservations in <git-common-dir>/dec-dev-claims.json
 *                    (see --claim below — G32 hole #2)
 *   - global max   = highest of all of the above; next-free = global max + 1
 *
 * Usage:
 *   node dev/meta-improvement/scripts/next-dec-dev.js              # report + next-free number
 *   node dev/meta-improvement/scripts/next-dec-dev.js --check 0141 # is this number free?
 *   node dev/meta-improvement/scripts/next-dec-dev.js --claim      # next-free + RESERVE it
 *
 * --claim (G32, DEC-DEV-0160): the race window between «allocated a number» and «committed
 * the journal entry» was covered by nothing — two same-machine sessions could both read the
 * same tails and both take the same number (reproduced ≥7×). A claim writes a reservation
 * into <git-common-dir>/dec-dev-claims.json — the COMMON git dir is shared by every
 * worktree of the checkout, so parallel sessions see each other's claims immediately,
 * without the file ever being committed. Claims expire after 72h (a crashed session must
 * not burn a number forever) and are pruned once the number appears in a scanned journal.
 *
 * Exit codes:
 *   report / --claim mode : always 0 (informational).
 *   --check mode: 0 = FREE, 1 = TAKEN (or a bad/missing argument).
 *
 * Network: does a best-effort `git fetch origin --quiet` first so remote-tracking refs are
 * fresh. Offline / fetch failure is non-fatal — falls back to whatever `origin/*` refs are
 * already known locally (a warning is printed to stderr either way).
 */

const { execSync, execFileSync } = require('child_process');
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

// Local branches other than the current one: a parallel session's committed-but-unpushed
// journal tail is invisible to the remote scan (G32 hole #1).
function listLocalBranches() {
  let current = '';
  try {
    current = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) { /* detached HEAD — scan everything */ }
  let out;
  try {
    out = execSync('git branch --format=%(refname:short)', { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    process.stderr.write(`warn: cannot list local branches: ${e.message}\n`);
    return [];
  }
  return out
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(ref => ref && ref !== current);
}

// ─── Claims (G32 hole #2) ────────────────────────────────────────────────────

const CLAIM_TTL_MS = 72 * 60 * 60 * 1000;

function claimsPath() {
  try {
    const common = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    return path.resolve(ROOT, common, 'dec-dev-claims.json');
  } catch (e) {
    return null;
  }
}

function readClaims(file) {
  if (!file) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

// Active = unexpired AND not yet visible in any scanned journal (then the claim served
// its purpose and is pruned on the next write).
function activeClaims(claims, journalNums) {
  const now = Date.now();
  const seen = new Set(journalNums);
  const active = {};
  for (const [numStr, meta] of Object.entries(claims)) {
    const n = parseInt(numStr, 10);
    if (Number.isNaN(n) || seen.has(n)) continue;
    const at = Date.parse(meta && meta.claimed_at);
    if (Number.isNaN(at) || now - at > CLAIM_TTL_MS) {
      process.stderr.write(`warn: stale claim DEC-DEV-${pad4(n)} (claimed_at ${meta && meta.claimed_at}) ignored (>72h).\n`);
      continue;
    }
    active[n] = meta;
  }
  return active;
}

function writeClaims(file, claims) {
  if (!file) return false;
  try {
    fs.writeFileSync(file, JSON.stringify(claims, null, 2) + '\n');
    return true;
  } catch (e) {
    process.stderr.write(`warn: cannot write claims file ${file}: ${e.message}\n`);
    return false;
  }
}

// `ref` is a branch name harvested from `git branch -r/--format` — i.e. it can originate from a
// hostile remote (a PR/fork branch that `gitFetch()` above pulls into our refs). `git
// check-ref-format` permits backtick / $() / ; / | in a ref name, so interpolating one into a
// shell command string was a command-injection sink on the maintainer's machine (M-2,
// SECURITY_REVIEW_2026-07-11). execFileSync spawns git directly with a discrete argv — no shell,
// so no metacharacter is ever interpreted. (No `--` separator: `<ref>:<path>` is a rev, not a
// pathspec; `git show -- <arg>` would change the meaning.)
function readJournalAtRef(ref) {
  try {
    const out = execFileSync('git', ['show', `${ref}:${JOURNAL_REL}`], {
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
  const claimMode = args.includes('--claim');

  const localNums = readLocalJournal();
  const localMax = localNums.length ? Math.max(...localNums) : 0;

  gitFetch();
  const branches = [...listRemoteBranches(), ...listLocalBranches()];

  const sources = [{ label: 'main (local DEV_JOURNAL.md)', numbers: localNums, max: localMax }];
  for (const ref of branches) {
    const nums = readJournalAtRef(ref);
    if (nums.length) sources.push({ label: ref, numbers: nums, max: Math.max(...nums) });
  }

  const allJournalNums = sources.flatMap(s => s.numbers);
  const claimsFile = claimsPath();
  const claims = activeClaims(readClaims(claimsFile), allJournalNums);
  for (const [numStr, meta] of Object.entries(claims)) {
    const n = parseInt(numStr, 10);
    sources.push({
      label: `claim (${(meta && meta.branch) || '?'}, ${(meta && meta.claimed_at) || '?'})`,
      numbers: [n],
      max: n,
    });
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

  // ── --claim mode: reserve the number BEFORE the journal entry exists ──
  if (claimMode) {
    const now = new Date().toISOString();
    let branch = '?';
    try {
      branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim() || '?';
    } catch (e) { /* keep '?' */ }
    claims[nextFree] = { claimed_at: now, branch };
    const ok = writeClaims(claimsFile, claims);
    process.stdout.write(`NEXT-FREE DEC-DEV = ${pad4(nextFree)}\n`);
    process.stdout.write(
      ok
        ? `CLAIMED for ${branch} @ ${now} → ${claimsFile}\n(expires in 72h; released automatically once the heading lands in a scanned DEV_JOURNAL.md)\n`
        : 'warn: claim NOT persisted — number is informational only.\n'
    );
    return;
  }

  // ── report mode ──
  process.stdout.write(`NEXT-FREE DEC-DEV = ${pad4(nextFree)}\n\n`);
  process.stdout.write(`main-tail (local DEV_JOURNAL.md): DEC-DEV-${pad4(localMax)}\n`);

  const ahead = sources.slice(1).filter(s => s.max > localMax);
  if (ahead.length) {
    process.stdout.write('Branches/claims holding numbers ahead of main-tail:\n');
    for (const s of ahead) {
      process.stdout.write(`  ${s.label}: max DEC-DEV-${pad4(s.max)}\n`);
    }
  } else {
    process.stdout.write('No branches or active claims hold DEC-DEV numbers ahead of main-tail.\n');
  }
}

main();
