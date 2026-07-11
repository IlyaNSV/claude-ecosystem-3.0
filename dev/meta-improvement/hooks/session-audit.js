#!/usr/bin/env node
/**
 * session-audit.js — SessionEnd hook (marker writer mode, Phase 4.1).
 *
 * Appends a Pending row to dev/meta-improvement/audit-index.md for the
 * completed session, so that /meta:audit-smoke (or scripts/audit-smoke.js)
 * can later batch-audit accumulated markers against the active phase
 * smoke test plan.
 *
 * Refactored from the prototype (8a83562 + 06e718b) which spawned a
 * detached `claude -p` auditor per session. New design separates capture
 * (this hook, idempotent) from audit (manual command, on-demand). See
 * DEC-DEV-0034.
 *
 * Behaviour:
 *   - Reads SessionEnd payload from stdin (JSON).
 *   - Resolves the ecosystem repo root — see findRepoRoot() precedence below.
 *   - Reads audit-index.md, skips if session_id is already in Pending or
 *     Processed (idempotent on retry / resume / fork).
 *   - Appends one row to the Pending section between the sentinel
 *     comments PENDING_ROWS_START / PENDING_ROWS_END.
 *   - Never spawns the auditor. Never modifies anything outside
 *     audit-index.md.
 *
 * Exit 0 always — SessionEnd cannot block per Claude Code hooks spec.
 *
 * Repo-root resolution (DEC-DEV-0183 — closes gap G24 leg (f)): the hook is
 * registered in a pilot's .claude/settings.local.json with an ABSOLUTE path to
 * this script. That path is the one thing that breaks when the ecosystem repo
 * relocates (node can't find a moved script → the hook silently never runs).
 * To make root-resolution robust for the cases the script CAN see, findRepoRoot
 * resolves in this order — and, crucially, warns LOUDLY (never silently) when it
 * cannot resolve at all:
 *   1. $ECOSYSTEM_ROOT env var (explicit operator override; survives relocation)
 *   2. walk up from cwd until CLAUDE.md + DEV_JOURNAL.md are both present
 *   3. fall back to the script's own location (dev/meta-improvement/hooks → 3 up)
 *   4. null → loud stderr with remediation (set $ECOSYSTEM_ROOT or re-run
 *      /ecosystem:enable-d7-audit).
 *
 * Failure modes:
 *   - Cannot resolve repo root → LOUD stderr warning, exit 0.
 *   - Missing audit-index.md → stderr warning, exit 0 (operator must run
 *     git pull or check Phase 4.1 install).
 *   - Corrupted sentinels → stderr warning, exit 0 (operator fixes file
 *     manually; loud error guides them).
 *   - Missing transcript_path → stderr warning, exit 0.
 *   - JSON parse error on payload → silent exit 0 (likely test harness).
 *
 * Activation: register in the TARGET project's .claude/settings.local.json:
 *   {
 *     "hooks": {
 *       "SessionEnd": [{
 *         "hooks": [{
 *           "type": "command",
 *           "command": "node <ABS_PATH>/dev/meta-improvement/hooks/session-audit.js"
 *         }]
 *       }]
 *     }
 *   }
 * Use /ecosystem:enable-d7-audit for automated setup.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PENDING_START = '<!-- PENDING_ROWS_START -->';
const PENDING_END = '<!-- PENDING_ROWS_END -->';

/**
 * True iff `dir` looks like the ecosystem repo root (its two signature files).
 */
function isRepoRoot(dir) {
  return (
    fs.existsSync(path.join(dir, 'CLAUDE.md')) &&
    fs.existsSync(path.join(dir, 'DEV_JOURNAL.md'))
  );
}

/**
 * Resolve the ecosystem repo root. See the module header for the precedence
 * rationale. Pure + injectable (opts.env / opts.scriptDir) so the resolution —
 * including the "repo relocated" path — is unit-testable without spawning.
 *
 * @param {string} start        cwd to walk up from
 * @param {object} [opts]
 * @param {object} [opts.env]        env bag (default: process.env)
 * @param {string} [opts.scriptDir]  this script's dir (default: __dirname)
 * @param {(msg:string)=>void} [opts.warn]  loud-warn sink (default: stderr)
 * @returns {string|null} absolute repo root, or null if unresolvable
 */
function findRepoRoot(start, opts = {}) {
  const env = opts.env || process.env;
  const scriptDir = opts.scriptDir || __dirname;
  const warn = opts.warn || ((m) => process.stderr.write(m));

  // 1. Explicit operator override — the relocation-proof knob.
  const envRoot = env.ECOSYSTEM_ROOT;
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (isRepoRoot(resolved)) return resolved;
    // Set but wrong — do NOT fail silently; say so, then try fallbacks.
    warn(
      `[session-audit] ECOSYSTEM_ROOT=${envRoot} is not the ecosystem repo ` +
        `(missing CLAUDE.md/DEV_JOURNAL.md); ignoring it and trying fallbacks\n`
    );
  }

  // 2. Walk up from cwd — works when the hook runs inside the ecosystem repo.
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (isRepoRoot(dir)) return dir;
    dir = path.dirname(dir);
  }

  // 3. Fall back to the script's own location. The hook lives at
  //    dev/meta-improvement/hooks/session-audit.js → repo root is 3 levels up.
  //    Makes the hook usable from external pilot projects whose cwd has no
  //    DEV_JOURNAL.md (precedent: 06e718b).
  const scriptRepoRoot = path.resolve(scriptDir, '..', '..', '..');
  if (isRepoRoot(scriptRepoRoot)) return scriptRepoRoot;

  return null;
}

/**
 * Build the Pending marker row for a session.
 */
function buildMarkerRow({ session_id, transcript_path, cwd, reason, now }) {
  const targetProject = cwd ? path.basename(path.resolve(cwd)) : '(unknown)';
  const endedAt = (now || new Date()).toISOString();
  const reasonNote = reason ? ` (reason: ${reason})` : '';
  return `| \`${session_id}\` | ${endedAt} | ${targetProject} | \`${transcript_path}\`${reasonNote} |`;
}

/**
 * The SessionEnd hook entry point. Reads stdin, resolves root, appends a marker.
 * Always exits 0 (SessionEnd cannot block). Kept out of module top-level so the
 * module can be `require()`d by tests without consuming stdin.
 */
function main() {
  // === Read SessionEnd payload ===
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    process.exit(0);
  }

  const { session_id, transcript_path, cwd, reason } = payload || {};
  if (!session_id || !transcript_path) {
    process.stderr.write('[session-audit] no transcript_path in payload; skipping\n');
    process.exit(0);
  }
  if (!fs.existsSync(transcript_path)) {
    process.stderr.write(`[session-audit] transcript not found: ${transcript_path}\n`);
    process.exit(0);
  }

  // === Locate ecosystem repo root ===
  const repoRoot = findRepoRoot(cwd || process.cwd());
  if (!repoRoot) {
    process.stderr.write(
      '[session-audit] could not locate the ecosystem repo root — the D7 audit ' +
        'marker was NOT written. This is usually a relocated ecosystem repo ' +
        '(the hook path in .claude/settings.local.json is stale). Fix by either: ' +
        '(a) set env ECOSYSTEM_ROOT=<abs path to the ecosystem repo>, or ' +
        '(b) re-run /ecosystem:enable-d7-audit in this project to re-point the hook.\n'
    );
    process.exit(0);
  }

  // === Locate audit-index.md ===
  const indexPath = path.join(repoRoot, 'dev', 'meta-improvement', 'audit-index.md');
  if (!fs.existsSync(indexPath)) {
    process.stderr.write(
      `[session-audit] audit-index.md not found at ${indexPath}; skipping (run /ecosystem:update or git pull)\n`
    );
    process.exit(0);
  }

  let indexContent;
  try {
    indexContent = fs.readFileSync(indexPath, 'utf-8');
  } catch (e) {
    process.stderr.write(`[session-audit] audit-index.md read failed: ${e.message}\n`);
    process.exit(0);
  }

  // === Idempotency: skip if session_id already present ===
  if (indexContent.includes(`| \`${session_id}\` |`)) {
    process.stderr.write(`[session-audit] session ${session_id} already in audit-index; skipping\n`);
    process.exit(0);
  }

  // === Locate Pending sentinels ===
  const pendingStartIdx = indexContent.indexOf(PENDING_START);
  const pendingEndIdx = indexContent.indexOf(PENDING_END);
  if (pendingStartIdx === -1 || pendingEndIdx === -1 || pendingEndIdx < pendingStartIdx) {
    process.stderr.write(
      `[session-audit] audit-index.md sentinels missing or malformed (expected ${PENDING_START} ... ${PENDING_END}); skipping\n`
    );
    process.exit(0);
  }

  // === Build + insert marker row ===
  const row = buildMarkerRow({ session_id, transcript_path, cwd, reason });
  const head = indexContent.slice(0, pendingStartIdx + PENDING_START.length);
  const tail = indexContent.slice(pendingStartIdx + PENDING_START.length);
  const updated = `${head}\n${row}${tail}`;

  // === Atomic-ish write: tmp file + rename ===
  const tmpPath = `${indexPath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmpPath, updated);
    fs.renameSync(tmpPath, indexPath);
  } catch (e) {
    process.stderr.write(`[session-audit] audit-index write failed: ${e.message}\n`);
    try { fs.unlinkSync(tmpPath); } catch {}
    process.exit(0);
  }

  const targetProject = cwd ? path.basename(path.resolve(cwd)) : '(unknown)';
  process.stderr.write(
    `[session-audit] marker written for ${session_id} (target: ${targetProject}); run /meta:audit-smoke to process\n`
  );
  process.exit(0);
}

// Run only when invoked directly (not when required by a test).
if (require.main === module) {
  main();
}

module.exports = { findRepoRoot, isRepoRoot, buildMarkerRow };
