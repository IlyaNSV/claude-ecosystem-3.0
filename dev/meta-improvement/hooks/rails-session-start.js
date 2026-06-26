#!/usr/bin/env node
'use strict';
/**
 * rails-session-start.js — SessionStart hook (work-rails wiring, DEC-DEV-0110).
 *
 * On session start: (1) regenerates the work-rails digest (RAILS.md) so it is
 * fresh against current git history, and (2) injects a compact summary into the
 * session via additionalContext, so a new session "enters the course of work"
 * without being asked to run anything.
 *
 * Non-blocking, no-op-safe: exits 0 always; skips silently if disabled, not an
 * ecosystem repo, or the projector is absent. Fast (projector is a bounded
 * git-log scan, ~1-2s).
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  RAILS_AUTOGEN=0
 *   - Disable the hook entirely: remove the SessionStart entry from
 *     .claude/settings.local.json (registration is local — that file is
 *     gitignored in the ecosystem repo).
 *   - Remove the feature: revert the wiring PR (DEC-DEV-0110).
 *
 * Registration (ecosystem repo, .claude/settings.local.json):
 *   "SessionStart": [{ "hooks": [{ "type": "command",
 *     "command": "node dev/meta-improvement/hooks/rails-session-start.js" }] }]
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Toggle OFF without touching settings.
if (process.env.RAILS_AUTOGEN === '0') process.exit(0);

// SessionStart sends JSON on stdin; we only need cwd (optional).
let payload = {};
try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch { /* fine */ }

const repoRoot = findRepoRoot(payload.cwd || process.cwd());
if (!repoRoot) process.exit(0);

const script = path.join(repoRoot, 'dev', 'meta-improvement', 'scripts', 'rails-build.js');
if (!fs.existsSync(script)) process.exit(0);

// (1) Regenerate — non-fatal; a stale RAILS.md is still better than nothing.
try {
  execFileSync('node', [script], { cwd: repoRoot, stdio: 'ignore', timeout: 30000 });
} catch { /* keep going */ }

// (2) Build a compact summary from the digest.
const railsMd = path.join(repoRoot, 'dev', 'meta-improvement', 'rails', 'RAILS.md');
let summary = '';
try {
  const lines = fs.readFileSync(railsMd, 'utf-8').split('\n');
  const sumLine = lines.find((l) => l.startsWith('**Summary:'));
  const areaIdx = lines.findIndex((l) => l.startsWith('## Areas'));
  const parts = [];
  if (sumLine) parts.push(sumLine.replace(/\*\*/g, ''));
  if (areaIdx >= 0) {
    const rows = lines.slice(areaIdx + 1, areaIdx + 12).filter((l) => l.startsWith('|'));
    parts.push(...rows.slice(0, 9)); // header + separator + ~7 area rows
  }
  summary = parts.join('\n').trim();
} catch { /* no digest */ }

if (!summary) process.exit(0);

const context =
  'Work-rails digest (auto-regenerated from git log on session start; full file: ' +
  'dev/meta-improvement/rails/RAILS.md, catalog class `work-history` in dev/INFORMATION-MAP.yaml). ' +
  'Consult it to see how often / in what area past work happened before editing — it answers ' +
  '"have we touched this N times / did it help / is it a skill-candidate":\n\n' + summary;

// Per Claude Code SessionStart contract: hookSpecificOutput.additionalContext
// (hookEventName is input-only; must be valid JSON on stdout; exit 0; <10k chars).
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { additionalContext: context },
}));
process.exit(0);

// ── helpers ──────────────────────────────────────────────────────────────────
function findRepoRoot(start) {
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'DEV_JOURNAL.md')) && fs.existsSync(path.join(dir, 'CLAUDE.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Fallback: hook lives at dev/meta-improvement/hooks/ → repo root is 3 up.
  const fallback = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(fallback, 'DEV_JOURNAL.md'))) return fallback;
  return null;
}
