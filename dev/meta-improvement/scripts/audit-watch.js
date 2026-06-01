#!/usr/bin/env node
/**
 * audit-watch.js — thin semi-auto entry for Session Audit v2 (G1, Increment 2).
 *
 * Wraps `audit-smoke.js --classify --since=<interval>` with a sane default interval so a
 * single short, stable command can be driven by `/loop` (the chosen semi-auto trigger),
 * by a durable `CronCreate`, or run by hand. The driver is idempotent — it skips sessions
 * already in Processed and `--since` batches recent markers — so repeated firings are safe
 * and cheap (only new sessions spawn `claude -p`).
 *
 *   /loop 45m node dev/meta-improvement/scripts/audit-watch.js
 *
 * Usage:
 *   node audit-watch.js [--since=<dur>] [passthrough audit-smoke flags...]
 *
 *   --since=<dur>   recency window (default 1h). e.g. 30m, 2h, 7d. Set it ≥ your loop
 *                   interval so no session slips between firings; widen it (or omit the
 *                   filter on the driver directly) to catch up on older Pending markers.
 *   --help, -h      this help
 *
 * Any other flags (--dry-run, --force, --target-project=<name>, --skip-aggregate, ...) pass
 * straight through to audit-smoke.js.
 *
 * Trigger note: routines / RemoteTrigger run in the cloud and CANNOT see local transcripts
 * or local git — they are disqualified for this local audit. `/loop` and `CronCreate` need
 * an open Claude session. A fully-autonomous "when Claude is closed" path (Windows Task
 * Scheduler → this script) is an upgrade path, not wired here (see SESSION_AUDIT_V2_DESIGN §5.1).
 *
 * Per DEC-DEV-0057 (Session Audit v2, Increment 2). D7 dev-only.
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_SINCE = '1h';

function printHelp() {
  process.stdout.write(fs0(__filename));
}

// Print the JSDoc header as help (keeps usage text single-sourced).
function fs0(file) {
  const fs = require('fs');
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const out = [];
  for (const l of lines) {
    if (l.startsWith('#!') || l.trim() === '/**') continue;
    if (l.startsWith(' */')) break;
    out.push(l.replace(/^ \* ?/, '').replace(/^ \*$/, ''));
  }
  return out.join('\n') + '\n';
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let since = DEFAULT_SINCE;
  const passthrough = [];
  for (const a of argv) {
    if (a.startsWith('--since=')) since = a.slice(8);
    else passthrough.push(a);
  }

  const smoke = path.join(__dirname, 'audit-smoke.js');
  const args = [smoke, '--classify', `--since=${since}`, ...passthrough];

  process.stdout.write(
    `[audit-watch] node audit-smoke.js --classify --since=${since}`
    + `${passthrough.length ? ' ' + passthrough.join(' ') : ''}\n`
  );

  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.error) {
    process.stderr.write(`[audit-watch] failed to spawn audit-smoke: ${r.error.message}\n`);
    process.exit(1);
  }
  process.exit(r.status == null ? 1 : r.status);
}

main();
