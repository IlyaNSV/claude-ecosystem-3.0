#!/usr/bin/env node
/**
 * run-ledger.cjs — deterministic per-run observability ledger for the Orchestrator
 * (VC-087 quantitative observability + VC-134 trace-leg; closes the "tracked
 * follow-up" the run.md Run-records block left open, and the trace-leg of the
 * VC-133/134 production-substrate graduation gate).
 *
 * WHY THIS EXISTS (dev/VIBE_CODING_ANALYSIS.md §4 VC-087 / §7 risks 7-8):
 *   The Orchestrator's BEHAVIOURAL observability is strong (audit-journal,
 *   feedback-intake, effect-probe) but its QUANTITATIVE observability was absent —
 *   no durable per-run record of duration / model-mix / verdict, so auto-runs could
 *   drift silently (cost/latency/verdict). And `.claude/orchestrator/runs/` was NOT
 *   auto-created (run.md Run-records) — the VC-134 trace-leg gap. This lib is BOTH:
 *   the dispatcher calls `start` before a Workflow and `finish` after it, which
 *   materialises `runs/<id>/run.json` (a durable per-run summary — a crashed run
 *   still leaves `status: running`) and appends one compact line to
 *   `runs/ledger.ndjson` (the scannable time-series). The harness transcript-dir
 *   (`…/subagents/workflows/wf_*`) stays the source of truth for per-agent detail;
 *   this ledger is the durable, greppable SUMMARY layer over it.
 *
 * DETERMINISM CONTRACT (hard design constraint — the reason timestamps are INPUTS):
 *   Workflow `.mjs` scripts must resume deterministically, so THEY may never read
 *   the wall clock (`Date.now()` / `new Date()` with no arg). All timestamps are
 *   stamped by the DISPATCHER (the harness executing commands/orchestrator/run.md)
 *   from the environment date and PASSED IN to this lib as ISO strings. This lib is
 *   a plain CJS tool run via `node` by that dispatcher — parsing a GIVEN ISO string
 *   (`Date.parse(iso)`) is deterministic in its input and is allowed here (the ban
 *   is on wall-clock reads inside the resumable Workflow body, not on arithmetic
 *   over a supplied timestamp). The run-id suffix is derived from the passed
 *   timestamp (base36 of its epoch-ms) — NO Math.random, so a given (process,
 *   timestamp) pair always yields the same run-id (unit-tested).
 *
 * MODEL-MAP (VC-118 companion): `finish` extracts the per-stage `label → model` map
 *   straight from the process `.mjs` SOURCE — every agent() call pins `model:` (or
 *   `agentType:` for a canonical persona) on its single-line opts object (enforced by
 *   the workflow-syntax smoke). So the map is read deterministically from the source,
 *   never by re-parsing the 56 live agent() calls at runtime. A persona spawned by
 *   agentType (model pinned in its agents/**.md frontmatter) is recorded as
 *   `via-agent-definition`.
 *
 * EXIT CODES: 0 ran ok · 2 usage/internal error.
 * Dual-use: require() it for the pure helpers (unit-tested), or run as a CLI.
 * Node stdlib only; cross-platform (path.join for Windows).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RUN_LEDGER_VERSION = 1;

const STATUS = {
  RUNNING: 'running',
  FINISHED: 'finished',
  FINISHED_UNSTARTED: 'finished-unstarted', // finish with no prior start (dispatcher forgot / crashed before start)
};

// Default ledger root, relative to cwd. The dispatcher may override via baseRoot.
function defaultBaseRoot() {
  return path.join('.claude', 'orchestrator', 'runs');
}

// ---------------------------------------------------------------------------
// Pure helpers (no FS) — the deterministic heart, unit-tested.
// ---------------------------------------------------------------------------

/** Slugify a process name for the run-id (ASCII, lowercase, dash-safe). */
function slugifyProcess(name) {
  return String(name == null ? 'process' : name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'process';
}

/**
 * Derive a deterministic run-id from a process name + an ISO timestamp:
 *   <yyyy-mm-dd>-<process-slug>-<short base36 suffix from the timestamp>
 * No Math.random — the suffix is base36(epoch-ms) sliced to 6 chars, so the same
 * (process, timestamp) always yields the same id. Falls back gracefully if the
 * timestamp is unparseable (suffix = 'nots').
 */
function deriveRunId(processName, iso) {
  const slug = slugifyProcess(processName);
  const ms = Date.parse(iso);
  let datePart;
  let suffix;
  if (Number.isFinite(ms)) {
    datePart = new Date(ms).toISOString().slice(0, 10); // yyyy-mm-dd (UTC, from the GIVEN ms)
    suffix = Math.abs(ms).toString(36).slice(-6);
  } else {
    datePart = '0000-00-00';
    suffix = 'nots';
  }
  return `${datePart}-${slug}-${suffix}`;
}

/**
 * Duration in ms between two ISO timestamps. null if either is missing/unparseable
 * or the result is negative (a clock the dispatcher stamped out of order — never a
 * negative duration on the record).
 */
function durationMs(startIso, finishIso) {
  const a = Date.parse(startIso);
  const b = Date.parse(finishIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = b - a;
  return d >= 0 ? d : null;
}

/**
 * Extract the per-stage `label → model` map from a Workflow process `.mjs` source.
 * Relies on the invariant the workflow-syntax smoke enforces: each agent() call
 * passes its opts as a SINGLE-LINE object literal, `label:` appears ONLY on an
 * agent() opts line, and model/agentType live on that same line.
 *   `model: 'opus'`      → map[label] = 'opus'
 *   `agentType: 'qa'` (no model) → map[label] = 'via-agent-definition'
 * A label may be a template literal (e.g. `impl:${task.id}`) — the STATIC template
 * text is captured verbatim (the interpolation is left as-is, it is a stable key).
 */
function extractModelMap(source) {
  const map = {};
  const text = String(source == null ? '' : source).replace(/\r\n/g, '\n');
  for (const line of text.split('\n')) {
    if (!/\blabel:/.test(line)) continue; // not an agent() opts line
    const labelM = line.match(/\blabel:\s*(['"`])([\s\S]*?)\1/);
    if (!labelM) continue;
    const label = labelM[2];
    const modelM = line.match(/\bmodel:\s*(['"`])([\s\S]*?)\1/);
    if (modelM) {
      map[label] = modelM[2];
      continue;
    }
    if (/\bagentType:/.test(line)) {
      map[label] = 'via-agent-definition';
    }
  }
  return map;
}

/**
 * Compact the Workflow return value into the fields the ndjson line carries.
 * Opportunistic: pulls whatever of verdict / result / readiness / conflicts /
 * counts is present (processes return different shapes — P4 vs P6 vs P7). Never
 * throws on a missing/oddly-shaped field.
 */
function summarizeResult(result) {
  const r = result && typeof result === 'object' ? result : {};
  const conflicts = Array.isArray(r.conflicts) ? r.conflicts.length : (r.conflicts != null ? undefined : 0);
  return {
    verdict: r.verdict != null ? r.verdict : (r.result != null ? r.result : null),
    result: r.result != null ? r.result : null,
    readiness: r.readiness != null ? r.readiness : null,
    conflicts: conflicts,
    counts: r.counts != null ? r.counts : null,
  };
}

// ---------------------------------------------------------------------------
// FS layer — the dispatcher-facing start / finish.
// ---------------------------------------------------------------------------

function runDir(baseRoot, runId) {
  return path.join(path.resolve(baseRoot || defaultBaseRoot()), runId);
}

function ledgerPath(baseRoot) {
  return path.join(path.resolve(baseRoot || defaultBaseRoot()), 'ledger.ndjson');
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return null; }
}

/**
 * start — create runs/<id>/ + run.json (status: running). The record exists BEFORE
 * the Workflow launches, so a crashed run leaves a durable `status: running` trace.
 * Returns { runId, dir, runJson }.
 */
function startRun(opts) {
  const o = opts || {};
  const iso = o.iso;
  const runId = deriveRunId(o.process, iso);
  const dir = runDir(o.baseRoot, runId);
  fs.mkdirSync(dir, { recursive: true });
  const runJsonPath = path.join(dir, 'run.json');
  const record = {
    run_ledger_version: RUN_LEDGER_VERSION,
    run_id: runId,
    process: o.process || null,
    status: STATUS.RUNNING,
    started_at: iso || null,
    finished_at: null,
    duration_ms: null,
    args_summary: o.argsSummary != null ? String(o.argsSummary) : '',
  };
  writeJson(runJsonPath, record);
  return { runId, dir, runJson: runJsonPath, record };
}

/**
 * Append one compact line to ledger.ndjson — IDEMPOTENT BY run_id: if a line for
 * this run_id already exists (a re-run of `finish`), the append is skipped so the
 * ndjson never grows a duplicate. run.json is the mutable record (last-write-wins);
 * ledger.ndjson is an append-once summary keyed by run_id. Returns whether it
 * appended. The append itself is a single atomic appendFileSync of one line (the
 * common path — the dup-scan is a cheap read that only matters on retry).
 */
function appendLedgerLine(baseRoot, entry) {
  const file = ledgerPath(baseRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8').split('\n');
    for (const raw of existing) {
      if (!raw.trim()) continue;
      let parsed;
      try { parsed = JSON.parse(raw); } catch (_e) { continue; }
      if (parsed && parsed.run_id === entry.run_id) return { appended: false, reason: 'duplicate-run_id' };
    }
  }
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  return { appended: true };
}

/**
 * finish — stamp run.json with finished_at / duration_ms / status + the result
 * summary + the model_map (extracted from the process source), and append the
 * compact ndjson line. Tolerant of a missing prior `start` (dispatcher forgot or
 * crashed before start): materialises the record fresh with
 * status: finished-unstarted (started_at null, duration_ms null) — the run still
 * gets a durable trace. Returns { runJson, status, ledgerAppended, record }.
 */
function finishRun(opts) {
  const o = opts || {};
  const runId = o.runId;
  if (!runId) throw new Error('finishRun: runId required');
  const dir = runDir(o.baseRoot, runId);
  const runJsonPath = path.join(dir, 'run.json');
  const prior = readJsonSafe(runJsonPath);

  fs.mkdirSync(dir, { recursive: true });

  const startedAt = prior && prior.started_at ? prior.started_at : null;
  const status = prior ? STATUS.FINISHED : STATUS.FINISHED_UNSTARTED;
  const processName = (prior && prior.process)
    || o.process
    || (o.processPath ? path.basename(o.processPath).replace(/\.mjs$/, '') : null);

  let modelMap = {};
  if (o.processPath) {
    try {
      modelMap = extractModelMap(fs.readFileSync(o.processPath, 'utf8'));
    } catch (_e) { modelMap = {}; }
  }

  const summary = summarizeResult(o.result);
  const record = Object.assign({}, prior || {}, {
    run_ledger_version: RUN_LEDGER_VERSION,
    run_id: runId,
    process: processName,
    status,
    started_at: startedAt,
    finished_at: o.iso || null,
    duration_ms: durationMs(startedAt, o.iso),
    args_summary: prior && prior.args_summary != null ? prior.args_summary : (o.argsSummary != null ? String(o.argsSummary) : ''),
    result_summary: summary,
    model_map: modelMap,
  });
  if (o.tokens != null) record.tokens = o.tokens;
  writeJson(runJsonPath, record);

  const ledgerEntry = {
    run_id: runId,
    process: processName,
    status,
    started_at: startedAt,
    finished_at: o.iso || null,
    duration_ms: record.duration_ms,
    verdict: summary.verdict,
    result: summary.result,
    readiness: summary.readiness,
    conflicts: summary.conflicts,
    counts: summary.counts,
  };
  if (o.tokens != null) ledgerEntry.tokens = o.tokens;
  const app = appendLedgerLine(o.baseRoot, ledgerEntry);

  return { runJson: runJsonPath, status, ledgerAppended: app.appended, record };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  const rest = argv.slice(3); // skip node, script, subcommand
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--process': a.process = next(); break;
      case '--at': a.at = next(); break;
      case '--args': a.args = next(); break;
      case '--base-root': a.baseRoot = next(); break;
      case '--run-id': a.runId = next(); break;
      case '--process-path': a.processPath = next(); break;
      case '--result': a.result = next(); break;
      case '--result-file': a.resultFile = next(); break;
      case '--tokens': a.tokens = next(); break;
      case '--tokens-file': a.tokensFile = next(); break;
      default: break;
    }
  }
  return a;
}

function readMaybeJson(inline, file) {
  if (file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
      throw new Error(`cannot read/parse JSON file ${file}: ${e.message}`);
    }
  }
  if (inline != null) {
    try { return JSON.parse(inline); } catch (e) {
      throw new Error(`cannot parse inline JSON: ${e.message}`);
    }
  }
  return undefined;
}

function printHelp() {
  process.stdout.write([
    'run-ledger.cjs — deterministic per-run Orchestrator observability ledger (VC-087 / VC-134).',
    '',
    'START (before the Workflow launches) — prints the run-id on stdout:',
    "  node run-ledger.cjs start --process <name> --at <ISO> [--args '<summary>'] [--base-root <dir>]",
    '  → creates <base-root>/<run-id>/run.json (status: running); echoes <run-id>.',
    '',
    'FINISH (after the Workflow returns) — prints a JSON summary on stdout:',
    '  node run-ledger.cjs finish --run-id <id> --at <ISO> --process-path <process.mjs> \\',
    "        (--result '<json>' | --result-file <path>) [--tokens '<json>'|--tokens-file <p>] [--base-root <dir>]",
    '  → stamps run.json (finished_at/duration_ms/status/result_summary/model_map) + appends ledger.ndjson.',
    '  A finish with no prior start ⇒ status: finished-unstarted (still a durable trace).',
    '',
    'Timestamps are INPUTS (--at ISO), stamped by the dispatcher — the Workflow body never reads the clock.',
    'run-id = <yyyy-mm-dd>-<process>-<base36 suffix from the timestamp> (deterministic, no Math.random).',
    'ledger.ndjson append is idempotent by run_id (a re-run of finish does not duplicate the line).',
  ].join('\n') + '\n');
}

function main() {
  const sub = process.argv[2];
  if (sub === '--help' || sub === '-h' || !sub) { printHelp(); process.exit(sub ? 0 : 2); }
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  try {
    if (sub === 'start') {
      if (!args.process) { console.error('ERROR: start needs --process'); process.exit(2); }
      if (!args.at) { console.error('ERROR: start needs --at <ISO> (dispatcher-stamped)'); process.exit(2); }
      const r = startRun({ process: args.process, iso: args.at, argsSummary: args.args, baseRoot: args.baseRoot });
      process.stdout.write(r.runId + '\n'); // bare run-id: the dispatcher captures it for finish
      process.exit(0);
    }
    if (sub === 'finish') {
      if (!args.runId) { console.error('ERROR: finish needs --run-id'); process.exit(2); }
      if (!args.at) { console.error('ERROR: finish needs --at <ISO> (dispatcher-stamped)'); process.exit(2); }
      const result = readMaybeJson(args.result, args.resultFile);
      const tokens = readMaybeJson(args.tokens, args.tokensFile);
      const r = finishRun({
        runId: args.runId,
        iso: args.at,
        result,
        tokens,
        processPath: args.processPath,
        process: args.process,
        baseRoot: args.baseRoot,
      });
      process.stdout.write(JSON.stringify({
        run_id: args.runId,
        status: r.status,
        run_json: r.runJson,
        ledger_appended: r.ledgerAppended,
        duration_ms: r.record.duration_ms,
        model_map: r.record.model_map,
        result_summary: r.record.result_summary,
      }, null, 2) + '\n');
      process.exit(0);
    }
    console.error(`ERROR: unknown subcommand "${sub}" (expected start | finish)`);
    process.exit(2);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  RUN_LEDGER_VERSION,
  STATUS,
  defaultBaseRoot,
  slugifyProcess,
  deriveRunId,
  durationMs,
  extractModelMap,
  summarizeResult,
  startRun,
  finishRun,
  appendLedgerLine,
};
