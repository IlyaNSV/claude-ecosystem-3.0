#!/usr/bin/env node
'use strict';
/**
 * transcript-usage.cjs — a GENERIC READER of Claude Code session transcripts that
 * answers ONE question deterministically: how many tokens did this session actually
 * SPEND (main thread + its subagents), and on which models / tools?
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────
 * Token spend is a FACT ABOUT BYTES sitting in `~/.claude/projects/<slug>/*.jsonl`.
 * Every consumer that wanted it so far re-derived it inline, and every inline
 * re-derivation got it wrong in the same two ways (both are recorded below as hard
 * rules, because both were paid for in a live miss):
 *
 *   🛑 LESSON "×9.4" — the harness field `totalTokens` is the PEAK CONTEXT of the
 *      thread, NOT the spend. Reading it as spend overstated a session by 9.4×.
 *      This lib NEVER touches it. Spend lives only in `message.usage` of
 *      `type: "assistant"` records.
 *
 *   🛑 LESSON "streamed records" — Claude Code writes ONE TRANSCRIPT RECORD PER
 *      CONTENT BLOCK, and every one of those records repeats the WHOLE message
 *      envelope, `message.usage` included. Summing per RECORD therefore counts one
 *      API message 2-5 times. Measured over the live corpus of this project
 *      (1607 transcripts, 65 661 assistant records, 25 165 distinct messages,
 *      20 838 of them multi-record): naive per-record summation reports 61.84 M
 *      output tokens where the truth is 34.56 M — a ~1.78× overstatement over the
 *      corpus as a whole. PER TRANSCRIPT the spread is far wider: median ~3× and an
 *      observed maximum of ~7×. (Re-measured 2026-07-31; the earlier "up to ~2.7×"
 *      was a corpus-level figure mis-stated as a per-transcript ceiling — the real
 *      ceiling is 2.6× larger, which is exactly the direction that matters here.)
 *      See DEDUPLICATION below.
 *
 * ── WHAT IT IS NOT ────────────────────────────────────────────────────────────────
 * It is a READER, not a judge. There is no budget, no threshold, no verdict, no
 * "too expensive" — hence there is NO exit code 1. Either the transcript was read
 * (exit 0, here are the numbers) or it could not be read (exit 2). Whoever wants a
 * policy on top of these numbers owns that policy; this lib owns only the arithmetic.
 * It is also CLOCK-FREE: every timestamp it reports is copied out of a transcript
 * record, never read from the machine — so N reads of one transcript are identical.
 *
 * ── DEDUPLICATION: ONE USAGE PER `message.id`, TAKEN FROM THE LAST RECORD ─────────
 * Records sharing a `message.id` are progressive snapshots of one streaming API
 * message: the early ones carry a PARTIAL usage (`output_tokens: 5`, `iterations:
 * null`), the final one carries the complete usage. Verified over the same live
 * corpus (20 838 multi-record groups):
 *   - the LAST record is the argmax of BOTH `output_tokens` and `input_tokens` — 100.0%
 *   - `output_tokens` is monotone non-decreasing across a group — 0 violations
 *   - `stop_reason` is NOT a usable "final" marker: it is already set on a non-last
 *     record in 6 421 groups and absent on the last record in 13.9% of them.
 * Hence the rule: LAST RECORD PER `message.id` WINS, wholesale (never a per-field
 * max — mixing fields from different snapshots would invent a message that never
 * existed). Because the sequence is monotone, last == max, so the rule is also
 * order-stable. Set `opts.dedupeByMessageId = false` to get the raw per-record sum
 * (only useful for auditing this very rule).
 *
 * CONTENT BLOCKS ARE NOT DEDUPED. The blocks of one message are SPLIT across its
 * records (record 1 `thinking`, record 2 `text`, records 3-4 two distinct
 * `tool_use`s), so `tool_calls` is counted over EVERY assistant record. Deduping
 * there would silently drop tool calls (99 groups in one transcript alone carry
 * tool_use in more than one record).
 *
 * ── OTHER RULES, ALL VERIFIED AGAINST LIVE TRANSCRIPTS ────────────────────────────
 *  - `usage.iterations[]` is IGNORED. The top-level fields ALREADY equal the sum of
 *    the iterations (34 379 of 34 387 records exactly; the 8 exceptions are all
 *    multi-iteration records off by ≤3 tokens). Adding iterations on top of the
 *    top-level fields is a second, independent double count.
 *  - `message.model === '<synthetic>'` — harness-generated messages ("No response
 *    requested.", "You've hit your session limit"). Their usage is all zeros today;
 *    it is skipped anyway and counted separately as `synthetic_msgs`. Defensive by
 *    intent: a synthetic message is not an API call, so it must never enter spend
 *    even if the harness starts stamping numbers on it. `<synthetic>` is likewise
 *    kept out of the `models` histogram.
 *  - Missing / partial usage keys read as 0. `cache_creation` and `server_tool_use`
 *    are NESTED objects that are legitimately `null` on synthetic records.
 *  - An unparseable line is DATA, not a crash: `parse_failures++`, keep going.
 *  - `isApiErrorMessage` is present-and-`false` on ordinary records, so it is counted
 *    truthy-gated, per RECORD (an API error is not a billable message and carries no
 *    `message.id` semantics worth deduping).
 *
 * ── EXIT CODES ────────────────────────────────────────────────────────────────────
 *   0  the transcript was read (the numbers follow on stdout)
 *   2  the main transcript is unreadable, or a usage error
 *   (there is deliberately NO 1 — see "WHAT IT IS NOT")
 *
 * Node stdlib only. FULLY SYNCHRONOUS by design (`readFileSync` + split): callers
 * such as the factory dispatcher `require()` this lib inside synchronous code paths
 * and cannot await. Dual-use: `require()` the pure helpers, or run it as a CLI.
 */

const fs = require('node:fs');
const path = require('node:path');

const TRANSCRIPT_USAGE_SCHEMA_VERSION = 1;

/**
 * The canonical LayerUsage field order. `files` and `assistant_msgs` are per-layer
 * bookkeeping (how much evidence this layer rests on), not token counts.
 */
const LAYER_FIELDS = [
  'input_tokens',
  'output_tokens',
  'cache_creation_input_tokens',
  'cache_read_input_tokens',
  'ephemeral_1h_input_tokens',
  'ephemeral_5m_input_tokens',
  'web_search_requests',
  'web_fetch_requests',
  'assistant_msgs',
  'files',
];

/** The model name the harness stamps on messages it generated itself (never an API call). */
const SYNTHETIC_MODEL = '<synthetic>';

// ---------------------------------------------------------------------------
// Pure helpers — no FS, no clock. The arithmetic heart, unit-tested.
// ---------------------------------------------------------------------------

/** A number, or 0 for anything that is not a finite number (null / undefined / "12" / NaN). */
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** A zeroed LayerUsage. Every field is always present, so consumers never see `undefined`. */
function emptyLayer() {
  const layer = {};
  for (const f of LAYER_FIELDS) layer[f] = 0;
  return layer;
}

/**
 * Add ONE `message.usage` object into an accumulator, in place, and return it.
 *
 * Pure in the family sense: no FS, no clock, no randomness — the same (target, usage)
 * pair always produces the same result. It DOES mutate `target` (the accumulator
 * idiom the whole reader is built on); pass `emptyLayer()` when you want a fresh sum.
 *
 * Does NOT touch `assistant_msgs` / `files`: a usage object knows nothing about how
 * many messages or files it came from — that is the caller's bookkeeping.
 *
 * Reads ONLY the top-level fields plus the two nested objects. `usage.iterations[]`
 * is deliberately not read (see the file header: it would double-count).
 */
function accumulate(target, usageObj) {
  const u = usageObj && typeof usageObj === 'object' ? usageObj : {};
  // `cache_creation` / `server_tool_use` are legitimately null on synthetic records.
  const cc = u.cache_creation && typeof u.cache_creation === 'object' ? u.cache_creation : {};
  const st = u.server_tool_use && typeof u.server_tool_use === 'object' ? u.server_tool_use : {};

  target.input_tokens += num(u.input_tokens);
  target.output_tokens += num(u.output_tokens);
  target.cache_creation_input_tokens += num(u.cache_creation_input_tokens);
  target.cache_read_input_tokens += num(u.cache_read_input_tokens);
  target.ephemeral_1h_input_tokens += num(cc.ephemeral_1h_input_tokens);
  target.ephemeral_5m_input_tokens += num(cc.ephemeral_5m_input_tokens);
  target.web_search_requests += num(st.web_search_requests);
  target.web_fetch_requests += num(st.web_fetch_requests);
  return target;
}

/** Add one LayerUsage into another, in place (used to fold layers into `totals`). */
function addLayer(target, src) {
  const s = src || {};
  for (const f of LAYER_FIELDS) target[f] += num(s[f]);
  return target;
}

/**
 * Project a LayerUsage onto the OpenTelemetry GenAI token attributes.
 *
 * All four names below are STANDARD OTel GenAI semconv (verified 2026-07-31 via
 * informed-fetch, triangulated on two sources) — note the DOT before `input_tokens`
 * in the two cache attributes; that dotted form is the canonical spelling, not an
 * extension of ours.
 *
 * ⚠ `gen_ai.usage.input_tokens` IS A SUM, NOT A COPY. Semconv requires the attribute
 * to carry ALL input tokens of the call, whereas Anthropic reports cached input
 * SEPARATELY — its `input_tokens` counts only the uncached remainder. So the
 * projection is
 *     input_tokens + cache_read_input_tokens + cache_creation_input_tokens
 * and emitting the raw Anthropic `input_tokens` here would under-report every cached
 * call. The RAW per-provider keys stay untouched in LayerUsage / totals — semconv
 * naming and semantics live in this block and nowhere else.
 *
 * The ephemeral 1h/5m split and the server-tool counters are NOT projected: they have
 * no semconv home and belong to the raw LayerUsage.
 */
function toOtelTokens(layer) {
  const l = layer || {};
  const cacheRead = num(l.cache_read_input_tokens);
  const cacheCreation = num(l.cache_creation_input_tokens);
  return {
    'gen_ai.usage.input_tokens': num(l.input_tokens) + cacheRead + cacheCreation,
    'gen_ai.usage.output_tokens': num(l.output_tokens),
    'gen_ai.usage.cache_read.input_tokens': cacheRead,
    'gen_ai.usage.cache_creation.input_tokens': cacheCreation,
  };
}

/** Round a millisecond span to 0.1 of a minute (the report's `span_min` precision). */
function msToSpanMin(ms) {
  return Math.round((ms / 60000) * 10) / 10;
}

// ---------------------------------------------------------------------------
// FS layer
// ---------------------------------------------------------------------------

/**
 * The session transcripts of a project dir: `<rootDir>/*.jsonl`, TOP LEVEL ONLY.
 *
 * Top-level only is the whole point: a session's own subagent transcripts live in
 * `<rootDir>/<session-id>/subagents/` and are NOT sessions — recursing would count
 * every subagent as a session of its own and then count it a second time as part of
 * its parent. Returns absolute paths, sorted (deterministic order). A missing or
 * unreadable dir yields `[]` — absence of transcripts is data, not an error.
 */
function listSessionFiles(rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && /\.jsonl$/i.test(e.name))
    .map((e) => path.resolve(rootDir, e.name))
    .sort();
}

/** Every `*.jsonl` under `dir`, RECURSIVELY, sorted. Non-`.jsonl` (e.g. `*.meta.json`) is skipped. */
function listJsonlRecursive(dir, out) {
  const acc = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listJsonlRecursive(p, acc);
    else if (e.isFile() && /\.jsonl$/i.test(e.name)) acc.push(path.resolve(p));
  }
  return acc.sort();
}

/** Split a transcript into records. Strips a BOM; blank lines are not parse failures. */
function splitRecords(raw) {
  const text = String(raw).replace(/^﻿/, '');
  return text.split(/\r?\n/);
}

/**
 * Read ONE LAYER (a set of transcript files that belong together — the main thread,
 * or all of its subagents) into a LayerUsage plus the bookkeeping counters.
 *
 * Returns `{ layer, ...counters }` rather than a LayerUsage with counters glued on,
 * so that `layer` stays EXACTLY the 10-field LayerUsage the report schema promises
 * (a `byLayer.main` carrying stray keys would make the schema a lie).
 *
 * A file that cannot be read is skipped (`skipped_files++`) — one unreadable subagent
 * transcript must not blind the reader to the other twenty. Throwing is the caller's
 * call: `readSessionUsage` throws only for the MAIN transcript.
 *
 * @param {string[]} jsonlPaths
 * @param {{dedupeByMessageId?: boolean}} [opts]
 */
function readLayerUsage(jsonlPaths, opts) {
  const o = opts || {};
  const dedupe = o.dedupeByMessageId !== false;

  const layer = emptyLayer();
  const models = {};
  const tool_calls = {};
  let synthetic_msgs = 0;
  let api_error_msgs = 0;
  let parse_failures = 0;
  let assistant_records = 0;
  let files_read = 0;
  let skipped_files = 0;
  let first_ms = null;
  let last_ms = null;
  let first_ts = null;
  let last_ts = null;

  // message.id → the LAST seen record's usage/model. See DEDUPLICATION in the header:
  // records of one message are progressive snapshots and the last one is complete.
  // A Map preserves insertion order, so the models histogram stays document-ordered.
  const byMessage = new Map();
  let noIdSeq = 0;

  const noteTs = (ts) => {
    if (typeof ts !== 'string' || !ts) return;
    const ms = Date.parse(ts);
    if (Number.isNaN(ms)) return;
    if (first_ms === null || ms < first_ms) { first_ms = ms; first_ts = ts; }
    if (last_ms === null || ms > last_ms) { last_ms = ms; last_ts = ts; }
  };

  let fileIndex = -1;
  for (const file of jsonlPaths || []) {
    fileIndex += 1;
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (_e) {
      skipped_files += 1;
      continue;
    }
    files_read += 1;

    for (const line of splitRecords(raw)) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch (_e) {
        parse_failures += 1;
        continue;
      }
      if (!rec || typeof rec !== 'object') { parse_failures += 1; continue; }

      // first/last span covers EVERY record, not only assistant ones: the session
      // started when its first record was written, whatever that record was.
      noteTs(rec.timestamp);

      // Truthy-gated: ordinary records carry `isApiErrorMessage: false`.
      if (rec.isApiErrorMessage) api_error_msgs += 1;

      if (rec.type !== 'assistant') continue;
      const msg = rec.message;
      if (!msg || typeof msg !== 'object') continue;
      assistant_records += 1;

      // Tool calls are counted over EVERY record: the content blocks of one message
      // are SPLIT across its records, so deduping here would drop real tool calls.
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && block.type === 'tool_use') {
            const name = typeof block.name === 'string' && block.name ? block.name : '(unnamed)';
            tool_calls[name] = (tool_calls[name] || 0) + 1;
          }
        }
      }

      if (!msg.usage || typeof msg.usage !== 'object') continue;
      // The dedup key is SCOPED TO THE FILE. The rule it implements is "records of one message,
      // within one transcript, are progressive snapshots of that message" — a statement about ONE
      // file. A layer, though, is MANY files (all subagents of a session), and a bare `msg.id` made
      // the Map global across them: two different subagents sharing a message.id would collapse into
      // one, and the second one's spend would vanish silently — an UNDERCOUNT, the one direction a
      // token reader must never drift in. (No collision in the current corpus; the scoping makes the
      // key match the stated intent instead of relying on ids never repeating across files.)
      const key = dedupe && typeof msg.id === 'string' && msg.id
        ? `${fileIndex}:${msg.id}`
        : `__norec__${(noIdSeq += 1)}`;
      // LAST WRITE WINS — the final snapshot of a streamed message is the complete one.
      byMessage.set(key, { model: msg.model, usage: msg.usage });
    }
  }

  let assistant_msgs = 0;
  for (const { model, usage } of byMessage.values()) {
    if (model === SYNTHETIC_MODEL) {
      // Not an API call: no spend, and kept out of the models histogram.
      synthetic_msgs += 1;
      continue;
    }
    assistant_msgs += 1;
    const name = typeof model === 'string' && model ? model : '(unknown)';
    models[name] = (models[name] || 0) + 1;
    accumulate(layer, usage);
  }

  layer.assistant_msgs = assistant_msgs;
  layer.files = files_read;

  return {
    layer,
    models,
    tool_calls,
    assistant_msgs,
    synthetic_msgs,
    api_error_msgs,
    parse_failures,
    assistant_records,
    // How many assistant records were folded away as repeat snapshots of a message
    // already seen. `assistant_records - dedup_skipped_records` == messages seen.
    dedup_skipped_records: Math.max(0, assistant_records - byMessage.size),
    files_read,
    skipped_files,
    first_ts,
    last_ts,
  };
}

/** Default subagent home: `<dir>/<basename without .jsonl>/subagents`. */
function defaultSubagentsDir(mainJsonlPath) {
  const abs = path.resolve(mainJsonlPath);
  return path.join(path.dirname(abs), path.basename(abs, path.extname(abs)), 'subagents');
}

/** Fold two `{key: count}` histograms into a new one. */
function mergeCounts(a, b) {
  const out = {};
  for (const [k, v] of Object.entries(a || {})) out[k] = (out[k] || 0) + v;
  for (const [k, v] of Object.entries(b || {})) out[k] = (out[k] || 0) + v;
  return out;
}

/** The earlier / later of two ISO timestamps, either of which may be null. */
function minTs(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}
function maxTs(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * THE MAIN ENTRY POINT. Read one session (main transcript + its subagents) into a
 * UsageReport.
 *
 * @param {string} mainJsonlPath  the session transcript
 * @param {{includeSubagents?: boolean, subagentsDir?: string|null,
 *          dedupeByMessageId?: boolean}} [opts]
 *   includeSubagents   default true — fold `<main-dir>/<session-id>/subagents/**\/*.jsonl`
 *                      (RECURSIVE; `*.meta.json` companions are not `.jsonl` and are skipped)
 *   subagentsDir       override that convention path
 *   dedupeByMessageId  default true — see DEDUPLICATION in the file header
 *
 * THROWS only when the MAIN transcript cannot be read: without it there is no session
 * to report on, and returning zeros would be a false "this session was free". An
 * unreadable SUBAGENT file is data — it lands in `skipped_files`.
 */
function readSessionUsage(mainJsonlPath, opts) {
  const o = opts || {};
  const includeSubagents = o.includeSubagents !== false;
  const dedupeByMessageId = o.dedupeByMessageId !== false;
  const mainAbs = path.resolve(mainJsonlPath);

  // Fail loudly on the main transcript, and only there.
  try {
    fs.accessSync(mainAbs, fs.constants.R_OK);
    if (!fs.statSync(mainAbs).isFile()) {
      throw new Error('not a file');
    }
  } catch (e) {
    throw new Error(`transcript-usage: cannot read main transcript ${mainAbs}: ${e.code || e.message}`);
  }

  const mainRead = readLayerUsage([mainAbs], { dedupeByMessageId });

  let subPaths = [];
  if (includeSubagents) {
    const dir = o.subagentsDir || defaultSubagentsDir(mainAbs);
    subPaths = listJsonlRecursive(dir);
  }
  const subRead = readLayerUsage(subPaths, { dedupeByMessageId });

  const totals = addLayer(addLayer(emptyLayer(), mainRead.layer), subRead.layer);

  const first_ts = minTs(mainRead.first_ts, subRead.first_ts);
  const last_ts = maxTs(mainRead.last_ts, subRead.last_ts);
  const span_min = first_ts && last_ts
    ? msToSpanMin(Date.parse(last_ts) - Date.parse(first_ts))
    : null;

  return {
    schema_version: TRANSCRIPT_USAGE_SCHEMA_VERSION,
    main_file: mainAbs,
    subagent_files: subRead.files_read,
    skipped_files: mainRead.skipped_files + subRead.skipped_files,
    byLayer: { main: mainRead.layer, subagents: subRead.layer },
    totals,
    otel: toOtelTokens(totals),
    models: mergeCounts(mainRead.models, subRead.models),
    assistant_msgs: mainRead.assistant_msgs + subRead.assistant_msgs,
    synthetic_msgs: mainRead.synthetic_msgs + subRead.synthetic_msgs,
    api_error_msgs: mainRead.api_error_msgs + subRead.api_error_msgs,
    parse_failures: mainRead.parse_failures + subRead.parse_failures,
    // Deviation bookkeeping (see DEDUPLICATION): how many raw assistant records the
    // transcripts held, and how many were folded away as repeat streaming snapshots.
    // Surfaced so the dedup rule is auditable from the report itself, never implicit.
    assistant_records: mainRead.assistant_records + subRead.assistant_records,
    dedup_skipped_records: mainRead.dedup_skipped_records + subRead.dedup_skipped_records,
    tool_calls: mergeCounts(mainRead.tool_calls, subRead.tool_calls),
    first_ts,
    last_ts,
    span_min,
  };
}

// ---------------------------------------------------------------------------
// CLI (argv + process exit live here only)
// ---------------------------------------------------------------------------

function printHelp() {
  process.stdout.write([
    'transcript-usage.cjs — generic reader of Claude Code session transcripts (spend, not peak context).',
    '',
    'Usage:',
    '  node transcript-usage.cjs <main.jsonl> [--no-subagents] [--json]',
    '',
    '  <main.jsonl>     a session transcript, e.g. ~/.claude/projects/<slug>/<session-id>.jsonl',
    '  --no-subagents   read the main thread only (default folds in',
    '                   <dir>/<session-id>/subagents/**/*.jsonl, recursively)',
    '  --json           suppress the human summary; stdout carries the JSON report alone',
    '',
    'stdout is ALWAYS the JSON UsageReport (so it is always parseable); without --json a',
    'human-readable summary is written to stderr in addition.',
    '',
    'It reads, it does not judge: there is no budget and no verdict, hence no exit code 1.',
    'Exit codes:  0 the transcript was read   2 unreadable transcript / usage error',
    '',
    `Schema: transcript_usage_schema_version ${TRANSCRIPT_USAGE_SCHEMA_VERSION}`,
  ].join('\n') + '\n');
}

/** Thousands-separated integer, ASCII only (Windows consoles mangle thin spaces). */
function fmt(n) {
  return String(num(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function humanSummary(r) {
  const t = r.totals;
  const top = (obj, n) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return [
    `transcript-usage: ${r.main_file}`,
    `  files      main 1 | subagents ${r.subagent_files} | skipped ${r.skipped_files}`,
    `  messages   assistant ${fmt(r.assistant_msgs)} (from ${fmt(r.assistant_records)} records, `
      + `${fmt(r.dedup_skipped_records)} folded as stream snapshots) | synthetic ${r.synthetic_msgs}`
      + ` | api-errors ${r.api_error_msgs} | parse-failures ${r.parse_failures}`,
    `  tokens     in ${fmt(t.input_tokens)} | out ${fmt(t.output_tokens)}`
      + ` | cache-write ${fmt(t.cache_creation_input_tokens)} | cache-read ${fmt(t.cache_read_input_tokens)}`,
    `  by layer   main out ${fmt(r.byLayer.main.output_tokens)} (${r.byLayer.main.assistant_msgs} msgs)`
      + ` | subagents out ${fmt(r.byLayer.subagents.output_tokens)} (${r.byLayer.subagents.assistant_msgs} msgs)`,
    `  server     web_search ${t.web_search_requests} | web_fetch ${t.web_fetch_requests}`,
    `  models     ${top(r.models, 6) || '(none)'}`,
    `  tools      ${top(r.tool_calls, 8) || '(none)'}`,
    `  span       ${r.first_ts || 'n/a'} .. ${r.last_ts || 'n/a'} (${r.span_min === null ? 'n/a' : r.span_min + ' min'})`,
  ].join('\n') + '\n';
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) { printHelp(); process.exit(0); }

  let file = null;
  let includeSubagents = true;
  let jsonOnly = false;
  for (const a of argv) {
    if (a === '--no-subagents') includeSubagents = false;
    else if (a === '--json') jsonOnly = true;
    else if (a.startsWith('--')) {
      process.stderr.write(`transcript-usage: unknown option ${a}\n`);
      printHelp();
      process.exit(2);
    } else if (file === null) file = a;
    else {
      process.stderr.write('transcript-usage: expected exactly one <main.jsonl>\n');
      process.exit(2);
    }
  }
  if (!file) {
    process.stderr.write('transcript-usage: <main.jsonl> is required\n');
    printHelp();
    process.exit(2);
  }

  let report;
  try {
    report = readSessionUsage(file, { includeSubagents });
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!jsonOnly) process.stderr.write(humanSummary(report));
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  TRANSCRIPT_USAGE_SCHEMA_VERSION,
  emptyLayer,
  accumulate,
  toOtelTokens,
  listSessionFiles,
  readLayerUsage,
  readSessionUsage,
};
