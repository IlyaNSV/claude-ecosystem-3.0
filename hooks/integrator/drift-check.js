#!/usr/bin/env node
'use strict';
/**
 * drift-check.js — SessionStart hook: proactive Integrator adapter-drift listener.
 *
 * Phase 7 deliverable (DEC-DEV-0176 dec. 6, closes the substance of gap G16 —
 * the "proactive listener"). On session start, IFF the project carries live
 * Integrator state (<root>/.claude/integrator/active-tools.yaml), it runs the
 * shared local-only drift checks (hooks/integrator/lib/drift-checks.cjs) and, if
 * anything has drifted or gone stale, injects a COMPACT one-line-per-tool note
 * via additionalContext pointing at /integrator:verify + /integrator:update
 * --repair. Clean state → stays silent (no per-session noise).
 *
 * Contract, mirrored from hooks/orchestrator/session-fabric-status.js:
 *   - Non-blocking, no-op-safe: exits 0 ALWAYS; every error is swallowed to stderr.
 *   - Never writes user files (detect-only; the underlying lib is read-only).
 *   - Silent no-op when: disabled (INTEGRATOR_DRIFT_CHECK=0), no project root,
 *     no active-tools.yaml (the ecosystem-dev repo itself → inert here), or
 *     nothing worth surfacing (driftCount == 0 && staleCount == 0).
 *   - SessionStart additionalContext MUST carry hookEventName: 'SessionStart'
 *     alongside it (harness contract; DEC-DEV-0162 live-defect) — else the whole
 *     inject is silently dropped.
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  INTEGRATOR_DRIFT_CHECK=0
 *   - Disable the hook entirely: remove the `drift-check` entry from
 *     hooks/integrator/manifest.yaml and re-run /ecosystem:bootstrap (or update).
 *
 * Registration (deployed project, .claude/settings.json, via bootstrap Step 6b):
 *   "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command",
 *     "command": "node .claude/hooks/integrator/drift-check.js" }] }]
 */

const fs = require('fs');
const path = require('path');

// Toggle OFF without touching settings.
if (process.env.INTEGRATOR_DRIFT_CHECK === '0') process.exit(0);

// SessionStart sends JSON on stdin; we only need cwd (optional).
let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch (_) { /* fine */ }

try {
  const root = findProjectRoot(payload.cwd || process.cwd());
  if (!root) process.exit(0);

  // No Integrator state → inert (the common case, incl. the ecosystem-dev repo).
  const activeTools = path.join(root, '.claude', 'integrator', 'active-tools.yaml');
  if (!fs.existsSync(activeTools)) process.exit(0);

  // Load the shared lib (travels beside this hook in both layouts:
  //   deployed  .claude/hooks/integrator/ → .claude/hooks/integrator/lib/
  //   repo      hooks/integrator/         → hooks/integrator/lib/ ).
  const lib = require(path.join(__dirname, 'lib', 'drift-checks.cjs'));
  const result = lib.runDriftChecks(root);

  const drift = (result.summary && result.summary.driftCount) || 0;
  const stale = (result.summary && result.summary.staleCount) || 0;
  if (drift === 0 && stale === 0) process.exit(0); // clean → stay quiet

  const lines = lib.summarizeDriftLines(result);
  if (lines.length === 0) process.exit(0);

  const context = [
    'Integrator adapter-drift detected at SessionStart (local-only, detect-only). '
      + `${drift} tool(s) drifting, ${stale} stale:`,
    ...lines,
    '',
    'Run /integrator:verify for details, /integrator:update <tool> --repair to fix.',
  ].join('\n');

  // Per Claude Code SessionStart contract: hookEventName is REQUIRED alongside
  // additionalContext, else the harness drops the whole payload (DEC-DEV-0162).
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
  process.exit(0);
} catch (e) {
  // Fail-open: any internal throw → stderr note, never block a session.
  process.stderr.write(`[drift-check] non-fatal: ${(e && e.message) || e}\n`);
  process.exit(0);
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Walk up from `start` (cap ~10 levels) to the first dir containing `.claude/`; else null. */
function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 10; i += 1) {
    try {
      if (fs.existsSync(path.join(dir, '.claude'))) return dir;
    } catch (_) { /* keep walking */ }
    const parent = path.dirname(dir);
    if (parent === dir) break; // hit filesystem root
    dir = parent;
  }
  return null;
}
