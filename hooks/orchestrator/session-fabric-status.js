#!/usr/bin/env node
'use strict';
/**
 * session-fabric-status.js — SessionStart hook (Process Fabric wiring, phase 2 · 2c;
 * DEC-DEV-0154 / dev/process-fabric/EXECUTION_ROADMAP.md §2c).
 *
 * On session start: if the project carries live Process Fabric state
 * (<root>/.claude/orchestrator/fabric/), injects a COMPACT summary into the new
 * session via additionalContext — the active instances + the top of the prioritised
 * owner-queue — so a returning session "enters the course of the line" without being
 * asked to run `fabric status`. The FIRST shipped SessionStart hook of the ecosystem
 * (orchestrator module).
 *
 * Non-blocking, no-op-safe: exits 0 ALWAYS; every error is swallowed. Silently no-ops
 * when disabled, when there is no fabric state (the ecosystem-dev repo itself has no
 * fabric dir → this hook is inert there), when the engine is not found, or when there
 * is nothing worth surfacing (no instances AND an empty owner-queue). Read-only: it
 * never mutates fabric state — it only shells the engine's `status` (which is read-only).
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  FABRIC_STATUS_INJECT=0
 *   - Disable the hook entirely: remove the `fabric-session-status` entry from
 *     hooks/orchestrator/manifest.yaml and re-run /ecosystem:bootstrap (or
 *     /ecosystem:update) so it re-derives .claude/settings.json without it.
 *   - Remove the feature: revert the wiring PR (DEC-DEV-0154, roadmap §2c).
 *
 * Registration (deployed project, .claude/settings.json, via bootstrap Step 6b):
 *   "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command",
 *     "command": "node .claude/hooks/orchestrator/session-fabric-status.js" }] }]
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Toggle OFF without touching settings.
if (process.env.FABRIC_STATUS_INJECT === '0') process.exit(0);

// SessionStart sends JSON on stdin; we only need cwd (optional).
let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch { /* fine */ }

const root = findProjectRoot(payload.cwd || process.cwd());
if (!root) process.exit(0);

// No live fabric state → inert (the common case, incl. the ecosystem-dev repo).
const fabricRoot = path.join(root, '.claude', 'orchestrator', 'fabric');
if (!fs.existsSync(fabricRoot)) process.exit(0);

// Engine path: relative to THIS hook works in both layouts —
//   deployed  .claude/hooks/orchestrator/ → .claude/orchestrator/lib/
//   repo      hooks/orchestrator/         → orchestrator/lib/
// Fall back to the project's deployed copy; give up (no-op) if neither resolves.
let enginePath = path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'fabric-engine.cjs');
if (!fs.existsSync(enginePath)) {
  enginePath = path.join(root, '.claude', 'orchestrator', 'lib', 'fabric-engine.cjs');
}
if (!fs.existsSync(enginePath)) process.exit(0);

// Ask the engine for status (read-only). Any failure → silent no-op.
let status = null;
try {
  const raw = execFileSync(process.execPath, [enginePath, 'status', '--base-root', fabricRoot], {
    encoding: 'utf-8',
    timeout: 15000,
  });
  status = JSON.parse(raw);
} catch {
  process.exit(0);
}

const instances = Array.isArray(status && status.instances) ? status.instances : [];
const queue = Array.isArray(status && status.owner_queue) ? status.owner_queue : [];

// Nothing worth surfacing → stay quiet.
if (instances.length === 0 && queue.length === 0) process.exit(0);

const context = buildContext(instances, queue);
if (!context) process.exit(0);

// Per Claude Code SessionStart contract: hookSpecificOutput MUST carry
// hookEventName: 'SessionStart' alongside additionalContext — without it the
// harness rejects the whole payload («missing required field "hookEventName"»,
// live-дефект Fabric фазы 3, DEC-DEV-0162) and the inject is silently dropped.
// (Valid JSON on stdout; exit 0; keep well under the 10k-char cap.)
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
}));
process.exit(0);

// ── helpers ──────────────────────────────────────────────────────────────────

/** Walk up from `start` (cap ~10 levels) to the first dir containing `.claude/`; else null. */
function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 10; i += 1) {
    try {
      if (fs.existsSync(path.join(dir, '.claude'))) return dir;
    } catch { /* keep walking */ }
    const parent = path.dirname(dir);
    if (parent === dir) break; // hit filesystem root
    dir = parent;
  }
  return null;
}

/** Compose the compact, size-capped additionalContext string. Empty → falsy (skip). */
function buildContext(instances, queue) {
  const SAFE_LIMIT = 8000; // well under the 10k SessionStart cap
  const lines = [];

  lines.push(
    'Process Fabric status (auto-injected at SessionStart; engine: ' +
    '.claude/orchestrator/lib/fabric-engine.cjs; resume-протокол: ' +
    'commands/orchestrator/run.md §Process Fabric). Инстансы = long-lived ' +
    'inter-process lines; owner-queue = приоритизированные ожидания владельца.'
  );

  if (instances.length) {
    lines.push('');
    lines.push(`Active instances (${instances.length}):`);
    for (const inst of instances) {
      const id = inst && inst.instance != null ? String(inst.instance) : '(unknown)';
      const state = inst && inst.state != null ? String(inst.state) : '?';
      const subject = inst && inst.subject != null && String(inst.subject).length
        ? String(inst.subject) : '—';
      lines.push(`  ${id} · state=${state} · subject=${subject}`);
    }
  }

  if (queue.length) {
    lines.push('');
    const shown = queue.slice(0, 5);
    lines.push(`Owner-queue (top ${shown.length} of ${queue.length}, by priority):`);
    for (const q of shown) {
      const prio = q && q.priority != null ? String(q.priority) : '?';
      const kind = q && q.kind != null ? String(q.kind) : '?';
      const id = q && q.instance != null ? String(q.instance) : '(unknown)';
      const state = q && q.state != null ? String(q.state) : '?';
      lines.push(`  [p${prio}/${kind}] ${id} @ ${state}`);
    }
    if (queue.length > shown.length) {
      lines.push(`  …и ${queue.length - shown.length} ещё`);
    }
  }

  let out = lines.join('\n').trim();
  if (out.length > SAFE_LIMIT) out = out.slice(0, SAFE_LIMIT) + '\n…(truncated)';
  return out;
}
