#!/usr/bin/env node
/**
 * worktree-enter-guard.js — PreToolUse hook for EnterWorktree.
 *
 * Auto-runs the worktree pre-flight (worktree-preflight.js, same dir) BEFORE
 * a worktree is entered, so its hazards (non-empty .pending/ queues, fresh
 * session, beads in_progress, shared gitignored state) are surfaced while cwd
 * is still the main checkout where that state is visible.
 *
 * Warn-only convention (ecosystem-wide; see scope-guard.js / product-handoff-gate.js):
 *   - never blocks the tool — exit 0 always
 *   - report goes to stderr (visible in transcript) AND, when supported, is
 *     injected as PreToolUse additionalContext so Claude sees it pre-call.
 *
 * Registered in settings.json PreToolUse with matcher "EnterWorktree"; the
 * matcher already filters, the tool_name guard below is defensive.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (_) { return ''; }
}

function main() {
  const raw = readStdin().replace(/^﻿/, ''); // strip BOM (some shells prepend it)
  if (!raw.trim()) return;

  let payload;
  try { payload = JSON.parse(raw); } catch (_) { return; }

  const toolName = payload.tool_name || payload.tool || '';
  if (toolName !== 'EnterWorktree') return; // defensive — matcher should filter

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const script = path.join(__dirname, 'worktree-preflight.js');
  if (!fs.existsSync(script)) return;

  // Run preflight from the main checkout (cwd=root): that's where gitignored
  // session/pending/shared state is visible. Never pass --strict — advisory only.
  const res = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
  });

  const out = ((res.stdout || '') + (res.stderr || '')).trim();
  if (!out) return;

  const banner = `Worktree pre-flight (auto, before EnterWorktree):\n${out}`;

  // Always emit to stderr — visible to the user in the transcript regardless of version.
  process.stderr.write('\n' + banner + '\n');

  // Also inject as advisory context for Claude without blocking the tool.
  // permissionDecision "allow" => tool proceeds; additionalContext is surfaced.
  // additionalContext is capped at ~10k chars by Claude Code — trim defensively.
  const MAX_CTX = 9500;
  const ctx = banner.length > MAX_CTX ? banner.slice(0, MAX_CTX) + '\n… (обрезано)' : banner;
  try {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: 'Worktree pre-flight advisory (non-blocking).',
        additionalContext: ctx,
      },
    }));
  } catch (_) { /* stderr already carried the report */ }

  // exit 0 — warn-only, never blocks (ecosystem convention).
}

if (require.main === module) {
  main();
}

module.exports = { main };
