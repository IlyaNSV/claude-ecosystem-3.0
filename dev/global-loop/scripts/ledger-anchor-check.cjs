#!/usr/bin/env node
/**
 * ledger-anchor-check.cjs — ANCHOR gate for the Wave-0 assist ledger
 * (ENFORCEMENT_PLAN pack 3 — DEC-DEV-0232).
 *
 * WHY THIS EXISTS (measurement M7 — anchoring rate 38.5%):
 *   ASSIST_LOG is the evidence base the conductor's mandate is derived from. Its own
 *   format block has demanded an `evidence:` line since day one — and 61.5% of the
 *   entries carry no anchor at all: no sha, no PR, no artifact id, no transcript. A
 *   claim about work done, with nothing to check it against, is a memory, not a record;
 *   and memories are exactly what the seam protocol forbids trusting. The convention
 *   existed; the CARRIER did not. This is the carrier.
 *
 * CONTRACT:
 *   Every entry dated on or after the WATERMARK (`ANCHOR_GATE_SINCE`) must carry at
 *   least one machine-checkable anchor in its BODY — or explicitly declare the absence
 *   with a reason (`evidence: N/A (<почему>)`). Nothing else changes.
 *
 * WHY A WATERMARK RATHER THAN A BACKFILL:
 *   Retro-anchoring 100 historical entries would mean reconstructing evidence from
 *   memory — manufacturing exactly the unverifiable claims the gate exists to prevent.
 *   Entries older than the watermark are LEGAL as written and are skipped. The gate
 *   binds the future, where the evidence is still at hand.
 *
 * DESIGN NOTES (the two decisions that make it non-obvious):
 *   1. ANCHORS ARE SEARCHED IN THE BODY, NOT THE HEADING. Every entry id is itself an
 *      artifact id (`RUN-B.58`), so scanning the heading would anchor every entry
 *      trivially — the gate would pass 100% and measure nothing.
 *   2. FENCED CODE BLOCKS ARE NOT ENTRIES. The `## Формат записи` block contains a
 *      literal `### <RUN-ID>.<N> — <ts, UTC+3>` template; parsing it as a dateless
 *      entry would make the file permanently red against its own documentation.
 *
 * EXIT CODES:
 *   0   every entry at or after the watermark is anchored (or nothing is that new)
 *   1   one or more unanchored / mis-headed entries
 *   2   file cannot be read
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LEDGER_ANCHOR_SCHEMA_VERSION = 1;

/**
 * Watermark: entries dated BEFORE this day are historical and exempt (see
 * "WHY A WATERMARK"). Raising it is a policy change and belongs in DEV_JOURNAL.
 */
const ANCHOR_GATE_SINCE = '2026-07-31';

const DEFAULT_LEDGER = path.join(__dirname, '..', 'ASSIST_LOG.md');

/** Date (and optional time) as written in an entry heading. */
const HEADING_DATE_RE = /(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/;

/** Fence toggles — ``` or ~~~ at (possibly indented) line start. */
const FENCE_RE = /^[ \t]*(?:```|~~~)/;

/**
 * Machine-checkable anchors. Each one is something a reader can go and open.
 * Deliberately generous: the gate asks for A trace, not a specific ceremony.
 */
const ANCHOR_PATTERNS = [
  { id: 'sha', re: /\b[0-9a-f]{7,40}\b/ },
  { id: 'pr', re: /PR ?#\d+/i },
  { id: 'release-id', re: /\d{8}T\d{6}Z/ },
  { id: 'artifact-id', re: /(?:NOTE|PA|FM|RL|SC|CNT|DEC-DEV|DEC-PLAN|RUN-[A-Z]+)[-.]?\d+/ },
  { id: 'count', re: /\d+\/\d+/ },
  { id: 'transcript', re: /\.jsonl/ },
  { id: 'evidence-na', re: /evidence:[ \t]*N\/A[ \t]*\(/i },
];

// ---------- pure parsing ----------

/**
 * Cut a ledger into entries. An entry runs from a `### ` heading OUTSIDE a fenced code
 * block to the next such heading (or EOF). Text before the first heading (the file
 * preamble and the format documentation) is ignored by design.
 */
function parseEntries(rawText) {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const entries = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      if (current) current.body.push(line);
      continue;
    }
    if (!inFence && /^###[ \t]+/.test(line)) {
      if (current) entries.push(current);
      current = { heading: line, body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) entries.push(current);

  return entries.map((e) => {
    const title = e.heading.replace(/^###[ \t]+/, '').trim();
    const dm = HEADING_DATE_RE.exec(title);
    const bodyLines = e.body;
    const firstBodyLine = bodyLines.find((l) => l.trim().length > 0) || null;
    return {
      id: title.split(/[—–]/)[0].trim() || title.split(/\s+/)[0] || '(без id)',
      heading: title,
      date: dm ? dm[1] : null,
      time: dm && dm[2] ? dm[2] : null,
      body: bodyLines.join('\n'),
      body_empty: firstBodyLine === null,
      first_line: firstBodyLine ? firstBodyLine.trim() : '',
    };
  });
}

/** Anchor ids found in an entry BODY (never the heading — see DESIGN NOTE 1). */
function findAnchors(bodyText) {
  const t = String(bodyText || '');
  return ANCHOR_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.id);
}

/**
 * Gate the whole ledger.
 * @returns {{schema_version:number, gate_since:string, entries_total:number,
 *            entries_checked:number, entries_skipped:number,
 *            violations:Array<{id:string, date:?string, reason:string, first_line:string}>,
 *            passed:boolean}}
 */
function checkLedgerAnchors(rawText) {
  const entries = parseEntries(rawText);
  const violations = [];
  let checked = 0;
  let skipped = 0;

  for (const e of entries) {
    if (!e.date) {
      // A heading outside the template. Empty stub entries are ignored (nothing is
      // claimed yet); a dateless entry WITH a body is an unverifiable claim.
      if (e.body_empty) { skipped += 1; continue; }
      checked += 1;
      violations.push({ id: e.id, date: null, reason: 'no-date-in-heading', first_line: e.first_line });
      continue;
    }
    if (e.date < ANCHOR_GATE_SINCE) { skipped += 1; continue; }

    checked += 1;
    if (findAnchors(e.body).length === 0) {
      violations.push({ id: e.id, date: e.date, reason: 'no-anchor', first_line: e.first_line });
    }
  }

  return {
    schema_version: LEDGER_ANCHOR_SCHEMA_VERSION,
    gate_since: ANCHOR_GATE_SINCE,
    entries_total: entries.length,
    entries_checked: checked,
    entries_skipped: skipped,
    violations,
    passed: violations.length === 0,
  };
}

// ---------- CLI ----------

function printHelp() {
  console.log(`ledger-anchor-check.cjs — anchor gate for dev/global-loop/ASSIST_LOG.md (pack 3)

Usage:
  node ledger-anchor-check.cjs [ledger.md]     (default: dev/global-loop/ASSIST_LOG.md)

Every entry dated >= ${ANCHOR_GATE_SINCE} must carry at least one anchor in its BODY:
  commit sha (>=7 hex) · PR #N · release-id 20260723T193232Z · artifact id
  (DEC-DEV-0231 / PA-118 / RUN-B.58 / NOTE-032) · счёт N/M · путь *.jsonl
  ...or an explicit "evidence: N/A (<почему>)" — a declared absence, with a reason.

Older entries are historical and exempt: back-filling them would mean reconstructing
evidence from memory, which is the very thing this gate exists to prevent.

Exit codes:
  0  all checked entries anchored
  1  unanchored / mis-headed entries found
  2  ledger cannot be read
`);
}

function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }

  const file = arg ? arg : DEFAULT_LEDGER;
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`ERROR: cannot read ${file}: ${e.message}`);
    process.exit(2);
  }

  const report = checkLedgerAnchors(raw);

  if (report.passed) {
    console.log(
      `✓ ledger anchors OK — ${report.entries_checked} entry(ies) checked since ${report.gate_since}, ` +
      `${report.entries_skipped} historical skipped (${report.entries_total} total) — ${path.basename(file)}`
    );
    process.exit(0);
  }

  console.error(
    `✗ ledger anchors FAILED — ${report.violations.length} of ${report.entries_checked} checked entry(ies) ` +
    `since ${report.gate_since} carry no anchor (${path.basename(file)}):`
  );
  for (const v of report.violations) {
    console.error(`  - ${v.id} [${v.reason}] ${v.first_line}`);
  }
  console.error(
    '\n  Добавь якорь в тело записи: commit sha · PR #N · release-id · artifact-id (DEC-DEV-NNNN / PA-NNN)\n' +
    '  · счёт N/M · путь *.jsonl — либо объяви отсутствие явно: `evidence: N/A (<почему>)`.'
  );
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  LEDGER_ANCHOR_SCHEMA_VERSION,
  ANCHOR_GATE_SINCE,
  DEFAULT_LEDGER,
  ANCHOR_PATTERNS,
  parseEntries,
  findAnchors,
  checkLedgerAnchors,
};
