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
 *   - Locates ecosystem repo root (via __dirname fallback if cwd has no
 *     DEV_JOURNAL.md — supports registration from external pilot projects).
 *   - Reads audit-index.md, skips if session_id is already in Pending or
 *     Processed (idempotent on retry / resume / fork).
 *   - Appends one row to the Pending section between the sentinel
 *     comments PENDING_ROWS_START / PENDING_ROWS_END.
 *   - Never spawns the auditor. Never modifies anything outside
 *     audit-index.md.
 *
 * Exit 0 always — SessionEnd cannot block per Claude Code hooks spec.
 *
 * Failure modes:
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
const PROCESSED_START = '<!-- PROCESSED_ROWS_START -->';
const PROCESSED_END = '<!-- PROCESSED_ROWS_END -->';

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
  process.stderr.write('[session-audit] could not locate ecosystem repo root; skipping\n');
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

// === Build marker row ===
const targetProject = cwd ? path.basename(path.resolve(cwd)) : '(unknown)';
const endedAt = new Date().toISOString();
const reasonNote = reason ? ` (reason: ${reason})` : '';
const row = `| \`${session_id}\` | ${endedAt} | ${targetProject} | \`${transcript_path}\`${reasonNote} |`;

// === Insert row between sentinels ===
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

process.stderr.write(
  `[session-audit] marker written for ${session_id} (target: ${targetProject}); run /meta:audit-smoke to process\n`
);
process.exit(0);

// === Helpers ===
function findRepoRoot(start) {
  // Walk up from cwd first — works when hook runs inside ecosystem repo.
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (
      fs.existsSync(path.join(dir, 'CLAUDE.md')) &&
      fs.existsSync(path.join(dir, 'DEV_JOURNAL.md'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback: derive from script location. Hook lives at
  // dev/meta-improvement/hooks/session-audit.js → ecosystem repo root is 3
  // levels up. Makes the hook usable from external pilot projects where
  // cwd has no DEV_JOURNAL.md (precedent: 06e718b).
  const scriptRepoRoot = path.resolve(__dirname, '..', '..', '..');
  if (
    fs.existsSync(path.join(scriptRepoRoot, 'CLAUDE.md')) &&
    fs.existsSync(path.join(scriptRepoRoot, 'DEV_JOURNAL.md'))
  ) {
    return scriptRepoRoot;
  }
  return null;
}
