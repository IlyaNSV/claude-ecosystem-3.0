#!/usr/bin/env node
'use strict';
/**
 * override-sweep-check.js — SessionStart hook: proactive expired-approve_override listener.
 *
 * Closes audit gap G28 (DEC-DEV-0180). The inline validator (artifact-validate.js)
 * only re-applies a rule when it happens to re-read an artifact that carries an
 * expired approve_override — expired entries otherwise accumulate silently as dead
 * frontmatter. On session start, IFF the project carries a .product/ tree, this hook
 * runs the read-only sweep (hooks/product/lib/override-sweep.cjs) and, if any expired
 * (or malformed-date) approve_overrides exist, injects a COMPACT note via
 * additionalContext pointing at the --clean sweeper. Clean state → stays silent.
 *
 * Contract, mirrored from hooks/integrator/drift-check.js:
 *   - Non-blocking, no-op-safe: exits 0 ALWAYS; every error is swallowed to stderr.
 *   - Detect-only: NEVER writes user files (the sweep lib read path is read-only;
 *     the mutating --clean path is only reachable via explicit CLI, not this hook).
 *   - Silent no-op when: disabled (PRODUCT_OVERRIDE_SWEEP=0), no project root,
 *     no .product/ dir (the ecosystem-dev repo itself → inert here), or nothing
 *     expired/malformed to surface.
 *   - SessionStart additionalContext MUST carry hookEventName: 'SessionStart'
 *     (harness contract; DEC-DEV-0162) — else the whole inject is silently dropped.
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  PRODUCT_OVERRIDE_SWEEP=0
 *   - Disable entirely: remove the `override-sweep-check` entry from
 *     hooks/product/manifest.yaml and re-run /ecosystem:bootstrap (or update).
 *
 * Registration (deployed project, .claude/settings.json, via bootstrap Step 6b):
 *   "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command",
 *     "command": "node .claude/hooks/product/override-sweep-check.js" }] }]
 */

const fs = require('fs');
const path = require('path');

// Toggle OFF without touching settings.
if (process.env.PRODUCT_OVERRIDE_SWEEP === '0') process.exit(0);

// SessionStart sends JSON on stdin; we only need cwd (optional).
let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch (_) { /* fine */ }

try {
  const root = findProjectRoot(payload.cwd || process.cwd());
  if (!root) process.exit(0);

  // No product state → inert (the common case, incl. the ecosystem-dev repo).
  if (!fs.existsSync(path.join(root, '.product'))) process.exit(0);

  // Load the shared lib (travels beside this hook in both layouts:
  //   deployed  .claude/hooks/product/ → .claude/hooks/product/lib/
  //   repo      hooks/product/         → hooks/product/lib/ ).
  const lib = require(path.join(__dirname, 'lib', 'override-sweep.cjs'));
  const result = lib.sweepTree(root);

  const expired = result.summary.expiredCount || 0;
  const malformed = result.summary.invalidDateCount || 0;
  if (expired === 0 && malformed === 0) process.exit(0); // clean → stay quiet

  const lines = lib.summarizeLines(result);
  if (lines.length === 0) process.exit(0);

  const context = [
    'Expired approve_overrides detected at SessionStart (D2 override hygiene, detect-only). '
      + `${expired} expired, ${malformed} malformed across ${result.summary.filesScanned} artifact(s):`,
    ...lines,
    '',
    'Expired entries are already ignored by the inline validator (the rule is re-applied); '
      + 'run  node .claude/hooks/product/lib/override-sweep.cjs --clean  to reap them. '
      + 'Fix any malformed expires_at dates by hand — the validator still treats those as active.',
  ].join('\n');

  // Per Claude Code SessionStart contract: hookEventName is REQUIRED alongside
  // additionalContext, else the harness drops the whole payload (DEC-DEV-0162).
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
  process.exit(0);
} catch (e) {
  // Fail-open: any internal throw → stderr note, never block a session.
  process.stderr.write(`[override-sweep-check] non-fatal: ${(e && e.message) || e}\n`);
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
