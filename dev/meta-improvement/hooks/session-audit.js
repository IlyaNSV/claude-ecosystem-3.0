#!/usr/bin/env node
/**
 * session-audit.js — SessionEnd hook for post-session conformance audit.
 *
 * Reads the session's JSONL transcript, spawns a headless `claude -p`
 * auditor against docs/pmo/processes.md + validation.md + B.1 frontmatter
 * conventions, and writes findings to
 * dev/meta-improvement/audit-reports/<session-id>.md.
 *
 * Exit 0 always — SessionEnd cannot block per Claude Code hooks spec.
 *
 * Skip conditions:
 *   - transcript_path missing in payload, or file unreadable
 *   - session contains no Write/Edit to .product/ files (nothing to audit)
 *
 * Activation: registered in .claude/settings.local.json SessionEnd hook.
 *
 * Configuration:
 *   CLAUDE_CLI_PATH — override path to the `claude` binary (default: PATH lookup)
 *
 * Limitations (prototype):
 *   - Pre-filter only catches .product/ writes. Extend MATCH_PATHS below to
 *     audit dev/meta-improvement/ or docs/ work.
 *   - JSONL schema assumed to follow Anthropic API content-block shape
 *     (rec.message.content[].type === 'tool_use'). If Claude Code changes
 *     transcript format, the pre-filter silently misses and audit is skipped.
 *   - Auditor runs detached fire-and-forget. No retry, no progress signal to
 *     the user beyond the stderr line on hook exit.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MATCH_PATHS = ['.product/', '.product\\'];

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

// === Pre-filter: did the session touch .product/ ? ===
let touched = false;
try {
  const lines = fs.readFileSync(transcript_path, 'utf-8').split('\n');
  outer: for (const line of lines) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const content = rec?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== 'tool_use') continue;
      const tn = block.name;
      if (tn !== 'Write' && tn !== 'Edit' && tn !== 'NotebookEdit') continue;
      const fp = String(block.input?.file_path || '');
      if (MATCH_PATHS.some((p) => fp.includes(p))) {
        touched = true;
        break outer;
      }
    }
  }
} catch (e) {
  process.stderr.write(`[session-audit] transcript read failed: ${e.message}\n`);
  process.exit(0);
}
if (!touched) {
  process.stderr.write('[session-audit] no .product/ changes in session; skipping\n');
  process.exit(0);
}

// === Locate repo root + prompt template ===
const repoRoot = findRepoRoot(cwd || process.cwd());
if (!repoRoot) {
  process.stderr.write('[session-audit] could not locate ecosystem repo root; skipping\n');
  process.exit(0);
}
const promptTemplate = path.join(repoRoot, 'dev', 'meta-improvement', 'prompts', 'session-audit.md');
if (!fs.existsSync(promptTemplate)) {
  process.stderr.write(`[session-audit] prompt template missing: ${promptTemplate}\n`);
  process.exit(0);
}

// === Prepare output path ===
const reportsDir = path.join(repoRoot, 'dev', 'meta-improvement', 'audit-reports');
try { fs.mkdirSync(reportsDir, { recursive: true }); } catch {}
const reportPath = path.join(reportsDir, `${session_id}.md`);

// === Build prompt ===
let prompt;
try {
  prompt = fs.readFileSync(promptTemplate, 'utf-8')
    .replace(/\{\{SESSION_ID\}\}/g, session_id)
    .replace(/\{\{TRANSCRIPT_PATH\}\}/g, transcript_path)
    .replace(/\{\{REPO_ROOT\}\}/g, repoRoot)
    .replace(/\{\{REPORT_PATH\}\}/g, reportPath)
    .replace(/\{\{SESSION_END_REASON\}\}/g, reason || 'unknown');
} catch (e) {
  process.stderr.write(`[session-audit] prompt template read failed: ${e.message}\n`);
  process.exit(0);
}

// === Spawn headless claude auditor (detached, fire-and-forget) ===
const claudeBin = process.env.CLAUDE_CLI_PATH || 'claude';
try {
  const child = spawn(claudeBin, ['-p', prompt], {
    cwd: repoRoot,
    stdio: 'ignore',
    detached: true,
    shell: process.platform === 'win32',
  });
  child.unref();
  process.stderr.write(
    `[session-audit] auditor spawned (PID ${child.pid}); report → ${path.relative(repoRoot, reportPath)}\n`
  );
} catch (e) {
  process.stderr.write(`[session-audit] spawn failed: ${e.message}\n`);
}

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
  // levels up. This makes the hook usable from external projects (e.g.,
  // my-first-test) where cwd has no DEV_JOURNAL.md.
  const scriptRepoRoot = path.resolve(__dirname, '..', '..', '..');
  if (
    fs.existsSync(path.join(scriptRepoRoot, 'CLAUDE.md')) &&
    fs.existsSync(path.join(scriptRepoRoot, 'DEV_JOURNAL.md'))
  ) {
    return scriptRepoRoot;
  }
  return null;
}
