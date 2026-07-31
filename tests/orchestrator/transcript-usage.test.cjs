'use strict';
/**
 * Contract test for orchestrator/lib/transcript-usage.cjs — the generic reader of
 * Claude Code session transcripts.
 *
 * The fixture `tests/fixtures/transcript-usage/session-a.jsonl` is hand-written but
 * SHAPE-FAITHFUL: every record form in it was copied from live transcripts under
 * ~/.claude/projects/ (streamed multi-record message, partial usage, `<synthetic>`
 * with null nested objects, an `isApiErrorMessage` rate-limit record, a `tool_result`
 * user turn). The numbers are small and hand-checkable; the shapes are real.
 *
 * The load-bearing regressions this file locks in — each one an over-count that a
 * naive reader commits and that costs a wrong spend figure:
 *
 *   #1 STREAMED RECORDS. Claude Code writes one record per CONTENT BLOCK and repeats
 *      the whole `message.usage` on each. Summing per record over-counts a message
 *      2-5×. Only ONE usage per `message.id` may be summed, taken from the LAST
 *      record (the complete snapshot). `msg_A` in the fixture is exactly that shape:
 *      output_tokens 5 (partial) then 40 (final) — the answer is 40, never 45.
 *   #2 ITERATIONS. `usage.iterations[]` already equals the top-level fields; adding
 *      it is a second double count. `msg_A`'s final record carries iterations with
 *      the same numbers — the answer stays 40, never 80.
 *   #3 `totalTokens`. The fixture plants a `system` record carrying
 *      totalTokens: 987654321 — the PEAK CONTEXT of the thread, not the spend
 *      (lesson x9.4). If it ever leaked into the arithmetic, every assert explodes.
 *   #4 `<synthetic>`. Harness-generated messages are not API calls. The fixture's
 *      rate-limit synthetic carries DELIBERATELY non-zero usage (999s) so that
 *      "synthetic is excluded" is proved, not merely assumed from zeros.
 *   #5 `*.meta.json`. The subagent companion file carries poisoned 500000s; reading
 *      anything but *.jsonl blows the fixture arithmetic apart.
 *
 * Node stdlib only; run with `node tests/orchestrator/transcript-usage.test.cjs`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  TRANSCRIPT_USAGE_SCHEMA_VERSION,
  emptyLayer,
  accumulate,
  toOtelTokens,
  listSessionFiles,
  readLayerUsage,
  readSessionUsage,
} = require('../../orchestrator/lib/transcript-usage.cjs');

const LIB = path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'transcript-usage.cjs');
const FIX = path.join(__dirname, '..', 'fixtures', 'transcript-usage');
const MAIN = path.join(FIX, 'session-a.jsonl');
const SUBS = path.join(FIX, 'session-a', 'subagents');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Hand-computed expectations for the fixture (recompute these by hand, not by
// running the lib — a test that trusts the implementation proves nothing).
//
// MAIN — 4 distinct messages over 5 assistant records:
//   msg_A  2 records (streamed): final usage in 100 / out 40 / cc 200 / cr 300
//                                1h 150 / 5m 50 / web_search 1 / web_fetch 2
//   msg_B  1 record, PARTIAL usage: in 7 / out 3, every other key absent (= 0)
//   msg_C  <synthetic>, zero usage            → excluded from spend & models
//   msg_D  <synthetic> + isApiErrorMessage    → excluded despite its 999s
//   ⇒ main: in 107, out 43, cc 200, cr 300, 1h 150, 5m 50, ws 1, wf 2, msgs 2, files 1
//
// SUBAGENTS — 3 messages over 2 files (one of them under a nested dir):
//   msg_S1 in 11  / out 22  / cc 33 / cr 44 / 1h 30 / 5m 3 / web_search 5
//   msg_S2 in 1   / out 2   (partial usage)
//   msg_S3 in 100 / out 200 (nested file wf_demo/agent-0002.jsonl)
//   ⇒ subs: in 112, out 224, cc 33, cr 44, 1h 30, 5m 3, ws 5, wf 0, msgs 3, files 2
// ---------------------------------------------------------------------------

const MAIN_LAYER = {
  input_tokens: 107,
  output_tokens: 43,
  cache_creation_input_tokens: 200,
  cache_read_input_tokens: 300,
  ephemeral_1h_input_tokens: 150,
  ephemeral_5m_input_tokens: 50,
  web_search_requests: 1,
  web_fetch_requests: 2,
  assistant_msgs: 2,
  files: 1,
};

const SUB_LAYER = {
  input_tokens: 112,
  output_tokens: 224,
  cache_creation_input_tokens: 33,
  cache_read_input_tokens: 44,
  ephemeral_1h_input_tokens: 30,
  ephemeral_5m_input_tokens: 3,
  web_search_requests: 5,
  web_fetch_requests: 0,
  assistant_msgs: 3,
  files: 2,
};

const TOTALS = {
  input_tokens: 219,
  output_tokens: 267,
  cache_creation_input_tokens: 233,
  cache_read_input_tokens: 344,
  ephemeral_1h_input_tokens: 180,
  ephemeral_5m_input_tokens: 53,
  web_search_requests: 6,
  web_fetch_requests: 2,
  assistant_msgs: 5,
  files: 3,
};

console.log('transcript-usage contract test (generic Claude Code transcript usage reader)');

// ---------- pure helpers ----------

// 1 — emptyLayer is total: every field present, every field zero
test('emptyLayer: all 10 LayerUsage fields present and zero', () => {
  const l = emptyLayer();
  assert.deepStrictEqual(l, {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    ephemeral_1h_input_tokens: 0,
    ephemeral_5m_input_tokens: 0,
    web_search_requests: 0,
    web_fetch_requests: 0,
    assistant_msgs: 0,
    files: 0,
  }, 'exact zeroed LayerUsage shape');
  assert.notStrictEqual(emptyLayer(), emptyLayer(), 'a FRESH object each call (no shared accumulator)');
});

// 2 — accumulate reads the nested objects and returns the same target
test('accumulate: full usage → every field, nested cache_creation / server_tool_use read', () => {
  const target = emptyLayer();
  const back = accumulate(target, {
    input_tokens: 100,
    output_tokens: 40,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 300,
    cache_creation: { ephemeral_1h_input_tokens: 150, ephemeral_5m_input_tokens: 50 },
    server_tool_use: { web_search_requests: 1, web_fetch_requests: 2 },
  });
  assert.strictEqual(back, target, 'returns the accumulator it was given');
  assert.strictEqual(target.input_tokens, 100, 'input');
  assert.strictEqual(target.output_tokens, 40, 'output');
  assert.strictEqual(target.cache_creation_input_tokens, 200, 'cache write');
  assert.strictEqual(target.cache_read_input_tokens, 300, 'cache read');
  assert.strictEqual(target.ephemeral_1h_input_tokens, 150, 'nested 1h');
  assert.strictEqual(target.ephemeral_5m_input_tokens, 50, 'nested 5m');
  assert.strictEqual(target.web_search_requests, 1, 'server_tool_use web_search');
  assert.strictEqual(target.web_fetch_requests, 2, 'server_tool_use web_fetch');
  assert.strictEqual(target.assistant_msgs, 0, 'accumulate does NOT touch message bookkeeping');
  assert.strictEqual(target.files, 0, 'accumulate does NOT touch file bookkeeping');
});

// 3 — missing / null / non-numeric keys read as 0, never NaN
test('accumulate: absent keys, null nested objects and junk values all read as 0', () => {
  const a = accumulate(emptyLayer(), { input_tokens: 7, output_tokens: 3 });
  assert.strictEqual(a.cache_creation_input_tokens, 0, 'absent top-level key = 0');
  assert.strictEqual(a.ephemeral_1h_input_tokens, 0, 'absent nested object = 0');
  assert.strictEqual(a.web_search_requests, 0, 'absent server_tool_use = 0');

  const b = accumulate(emptyLayer(), {
    input_tokens: null, output_tokens: '42', cache_creation: null, server_tool_use: null, iterations: null,
  });
  assert.deepStrictEqual(b, emptyLayer(), 'null / string values never leak NaN into the layer');

  const c = accumulate(emptyLayer(), undefined);
  assert.deepStrictEqual(c, emptyLayer(), 'a missing usage object is a no-op, not a throw');
});

// 4 — accumulate is additive across calls (it is an accumulator, not a setter)
test('accumulate: repeated calls add up', () => {
  const t = emptyLayer();
  accumulate(t, { input_tokens: 10, output_tokens: 1 });
  accumulate(t, { input_tokens: 5, output_tokens: 2 });
  assert.strictEqual(t.input_tokens, 15, 'inputs summed');
  assert.strictEqual(t.output_tokens, 3, 'outputs summed');
});

// 5 — OTel attribute names + semconv semantics are the contract with every collector.
//     Names verified 2026-07-31 (informed-fetch, two sources): the cache attributes use
//     the DOTTED form, and gen_ai.usage.input_tokens is a SUM including cache — because
//     Anthropic's own input_tokens counts only the UNCACHED remainder.
test('toOtelTokens: standard semconv names; input_tokens is the cache-inclusive SUM', () => {
  const otel = toOtelTokens(Object.assign(emptyLayer(), {
    input_tokens: 219, output_tokens: 267,
    cache_creation_input_tokens: 233, cache_read_input_tokens: 344,
    ephemeral_1h_input_tokens: 180, web_search_requests: 6,
  }));
  assert.deepStrictEqual(otel, {
    'gen_ai.usage.input_tokens': 796, // 219 uncached + 344 cache-read + 233 cache-write
    'gen_ai.usage.output_tokens': 267,
    'gen_ai.usage.cache_read.input_tokens': 344,
    'gen_ai.usage.cache_creation.input_tokens': 233,
  }, 'exact semconv names and values');
  assert.strictEqual(otel['gen_ai.usage.input_tokens'], 219 + 344 + 233,
    'the SUM, never the raw Anthropic input_tokens (which would under-report every cached call)');
  assert.deepStrictEqual(Object.keys(otel).length, 4, 'ephemeral split / server tools are NOT projected');
  assert.ok(!Object.keys(otel).includes('gen_ai.usage.cache_read_input_tokens'),
    'underscore spelling is NOT semconv — the dotted form is canonical');

  const noCache = toOtelTokens(Object.assign(emptyLayer(), { input_tokens: 50, output_tokens: 7 }));
  assert.strictEqual(noCache['gen_ai.usage.input_tokens'], 50, 'with no cache the sum collapses to input_tokens');

  assert.deepStrictEqual(toOtelTokens(undefined), {
    'gen_ai.usage.input_tokens': 0,
    'gen_ai.usage.output_tokens': 0,
    'gen_ai.usage.cache_read.input_tokens': 0,
    'gen_ai.usage.cache_creation.input_tokens': 0,
  }, 'a missing layer projects to zeros, not undefineds');
});

// ---------- listSessionFiles ----------

// 6 — top-level only: subagent transcripts are NOT sessions
test('listSessionFiles: top level only — subagent transcripts are not listed', () => {
  const files = listSessionFiles(FIX);
  assert.deepStrictEqual(files.map((f) => path.basename(f)), ['session-a.jsonl'],
    'exactly the one top-level transcript');
  assert.ok(files.every((f) => path.isAbsolute(f)), 'absolute paths');
  assert.ok(!files.some((f) => f.includes('agent-0001')), 'session-a/subagents/*.jsonl NOT recursed into');
  assert.ok(!files.some((f) => f.endsWith('.meta.json')), 'non-.jsonl never listed');
});

// 7 — a missing dir is data, not a throw
test('listSessionFiles: missing dir → [] (absence of transcripts is data)', () => {
  assert.deepStrictEqual(listSessionFiles(path.join(FIX, 'no-such-dir')), [], 'empty, no throw');
});

// ---------- readLayerUsage ----------

// 8 — the main layer: exact arithmetic, dedup, synthetic exclusion, counters
test('readLayerUsage(main): exact layer arithmetic + service counters', () => {
  const r = readLayerUsage([MAIN]);
  assert.deepStrictEqual(r.layer, MAIN_LAYER, 'exact main LayerUsage');
  assert.strictEqual(r.assistant_msgs, 2, 'two real assistant messages');
  assert.strictEqual(r.synthetic_msgs, 2, 'both <synthetic> messages counted separately');
  assert.strictEqual(r.api_error_msgs, 1, 'one isApiErrorMessage record (truthy-gated: false does not count)');
  assert.strictEqual(r.parse_failures, 1, 'the one broken line, and the read continued past it');
  assert.strictEqual(r.assistant_records, 5, 'five raw assistant records');
  assert.strictEqual(r.dedup_skipped_records, 1, 'one record folded away as a repeat stream snapshot');
  assert.strictEqual(r.files_read, 1, 'one file read');
  assert.strictEqual(r.skipped_files, 0, 'nothing skipped');
});

// 9 — REGRESSION #1: streamed records must not be double counted
test('streamed records: msg_A appears twice → counted ONCE, from the LAST (complete) snapshot', () => {
  const r = readLayerUsage([MAIN]);
  assert.strictEqual(r.layer.output_tokens, 43,
    'msg_A contributes its FINAL 40, not 5 (first) and not 45 (naive per-record sum)');
  assert.strictEqual(r.layer.input_tokens, 107, 'msg_A input counted once: 100 + msg_B 7');
  assert.strictEqual(r.layer.cache_read_input_tokens, 300, 'cache read counted once, not 600');
  assert.strictEqual(r.layer.web_fetch_requests, 2, 'server tool counters counted once');
  const raw = readLayerUsage([MAIN], { dedupeByMessageId: false });
  assert.strictEqual(raw.output_tokens === undefined, true, 'shape unchanged by the opt');
  assert.strictEqual(raw.layer.output_tokens, 48, 'without dedup the naive sum over-counts (5 + 40 + 3)');
  assert.strictEqual(raw.dedup_skipped_records, 0, 'nothing folded when dedup is off');
});

// 10 — REGRESSION #2: usage.iterations[] must be ignored
test('iterations[]: same numbers as the top-level fields → NOT added a second time', () => {
  const r = readLayerUsage([MAIN]);
  assert.strictEqual(r.layer.output_tokens, 43, 'msg_A iterations[0].output_tokens 40 not re-added (would be 83)');
  assert.strictEqual(r.layer.cache_creation_input_tokens, 200, 'iterations cache_creation not re-added (would be 400)');
  assert.strictEqual(r.layer.ephemeral_1h_input_tokens, 150, 'nested iterations cache_creation not re-added');
});

// 11 — REGRESSION #3+#4: totalTokens never read, synthetic never summed
test('<synthetic> + totalTokens: neither reaches the numbers', () => {
  const r = readLayerUsage([MAIN]);
  // msg_D is <synthetic> with 999 in every field; the system record carries 987654321.
  assert.ok(r.layer.input_tokens < 1000, 'the 999s of the synthetic rate-limit message stayed out');
  assert.ok(r.layer.output_tokens < 1000, 'and so did its output');
  assert.strictEqual(r.layer.web_search_requests, 1, 'synthetic server_tool_use 9 not summed');
  assert.strictEqual(r.layer.ephemeral_5m_input_tokens, 50, 'synthetic nested 999 not summed');
  assert.ok(!Object.keys(r.models).includes('<synthetic>'), '<synthetic> is NOT a model in the histogram');
  assert.deepStrictEqual(r.models, { 'claude-opus-4-8': 1, 'claude-sonnet-5': 1 }, 'real models only, one msg each');
});

// 12 — tool_use blocks are counted over EVERY record (blocks are split, not repeated)
test('tool_calls: counted per tool_use block across all records; tool_result is not a call', () => {
  const r = readLayerUsage([MAIN]);
  assert.deepStrictEqual(r.tool_calls, { Read: 1, Grep: 1 },
    'both tool_use blocks of msg_A counted, the user tool_result ignored');
});

// 13 — unreadable file is skipped, not thrown
test('readLayerUsage: unreadable file → skipped_files++, the rest still read', () => {
  const r = readLayerUsage([path.join(FIX, 'does-not-exist.jsonl'), MAIN]);
  assert.strictEqual(r.skipped_files, 1, 'the missing file counted as skipped');
  assert.strictEqual(r.files_read, 1, 'the readable one still read');
  assert.deepStrictEqual(r.layer, MAIN_LAYER, 'arithmetic unaffected by the skip');
});

// 14 — timestamps come from the records, never from the clock
test('readLayerUsage: first/last ts span EVERY record type, not just assistant ones', () => {
  const r = readLayerUsage([MAIN]);
  assert.strictEqual(r.first_ts, '2026-07-20T10:00:00.000Z', 'first assistant record');
  assert.strictEqual(r.last_ts, '2026-07-20T10:07:30.000Z', 'the trailing system record, not the last assistant one');
  const again = readLayerUsage([MAIN]);
  assert.deepStrictEqual(again, r, 'clock-free: two reads of one transcript are identical');
});

// ---------- readSessionUsage ----------

// 15 — the full report: both layers, totals, otel
test('readSessionUsage: byLayer + totals + otel exact', () => {
  const r = readSessionUsage(MAIN);
  assert.strictEqual(r.schema_version, TRANSCRIPT_USAGE_SCHEMA_VERSION, 'schema version stamped');
  assert.strictEqual(TRANSCRIPT_USAGE_SCHEMA_VERSION, 1, 'schema version is 1');
  assert.strictEqual(r.main_file, path.resolve(MAIN), 'absolute main path');
  assert.deepStrictEqual(r.byLayer.main, MAIN_LAYER, 'main layer');
  assert.deepStrictEqual(r.byLayer.subagents, SUB_LAYER, 'subagents layer');
  assert.deepStrictEqual(r.totals, TOTALS, 'totals = main + subagents, field by field');
  assert.deepStrictEqual(r.otel, {
    'gen_ai.usage.input_tokens': 796, // 219 + 344 cache-read + 233 cache-write (semconv sum)
    'gen_ai.usage.output_tokens': 267,
    'gen_ai.usage.cache_read.input_tokens': 344,
    'gen_ai.usage.cache_creation.input_tokens': 233,
  }, 'otel projects the TOTALS under semconv names');
  assert.strictEqual(r.totals.input_tokens, 219,
    'the RAW per-provider key stays uncached-only — semconv semantics live in the otel block alone');
  assert.deepStrictEqual(Object.keys(r.byLayer.main).sort(), Object.keys(emptyLayer()).sort(),
    'byLayer.main is EXACTLY a LayerUsage — no service counters glued on');
});

// 16 — recursive subagent discovery, *.meta.json ignored
test('subagents: discovered recursively; the *.meta.json companion is not read', () => {
  const r = readSessionUsage(MAIN);
  assert.strictEqual(r.subagent_files, 2, 'agent-0001.jsonl + the NESTED wf_demo/agent-0002.jsonl');
  assert.strictEqual(r.byLayer.subagents.files, 2, 'file count mirrored into the layer');
  assert.strictEqual(r.byLayer.subagents.output_tokens, 224,
    'includes the nested file (22 + 2 + 200); the poisoned meta.json 500000s are absent');
  assert.ok(r.totals.input_tokens < 1000, 'the meta.json companion never entered the arithmetic');
  assert.strictEqual(r.skipped_files, 0, 'a non-.jsonl sibling is not a "skipped file" — it was never a candidate');
  assert.deepStrictEqual(r.models, { 'claude-opus-4-8': 1, 'claude-sonnet-5': 3, 'claude-haiku-4-5': 1 },
    'models merged across layers');
  assert.deepStrictEqual(r.tool_calls, { Read: 1, Grep: 1, WebSearch: 1 }, 'tool calls merged across layers');
});

// 17 — includeSubagents:false
test('includeSubagents:false → main only, subagents layer all zeros', () => {
  const r = readSessionUsage(MAIN, { includeSubagents: false });
  assert.strictEqual(r.subagent_files, 0, 'no subagent file read');
  assert.deepStrictEqual(r.byLayer.subagents, emptyLayer(), 'empty subagents layer');
  assert.deepStrictEqual(r.byLayer.main, MAIN_LAYER, 'main layer unchanged');
  assert.deepStrictEqual(r.totals, Object.assign({}, MAIN_LAYER), 'totals collapse to the main layer');
  assert.deepStrictEqual(r.models, { 'claude-opus-4-8': 1, 'claude-sonnet-5': 1 }, 'only main-thread models');
  assert.strictEqual(r.assistant_msgs, 2, 'only main-thread messages');
});

// 18 — explicit subagentsDir override
test('subagentsDir override: an explicit dir replaces the convention path', () => {
  const r = readSessionUsage(MAIN, { subagentsDir: path.join(SUBS, 'wf_demo') });
  assert.strictEqual(r.subagent_files, 1, 'only the nested dir was read');
  assert.strictEqual(r.byLayer.subagents.output_tokens, 200, 'just msg_S3');
});

// 19 — span across both layers
test('first_ts / last_ts / span_min: merged across layers, rounded to 0.1 min', () => {
  const both = readSessionUsage(MAIN);
  assert.strictEqual(both.first_ts, '2026-07-20T10:00:00.000Z', 'earliest record, main layer');
  assert.strictEqual(both.last_ts, '2026-07-20T10:09:00.000Z', 'latest record, SUBAGENT layer');
  assert.strictEqual(both.span_min, 9, '10:00:00 → 10:09:00 is 9 minutes');

  const mainOnly = readSessionUsage(MAIN, { includeSubagents: false });
  assert.strictEqual(mainOnly.last_ts, '2026-07-20T10:07:30.000Z', 'without subagents the main tail wins');
  assert.strictEqual(mainOnly.span_min, 7.5, 'half-minute precision preserved (0.1 min rounding)');
});

// 20 — report-level counters
test('report counters: assistant / synthetic / api-error / parse-failure / dedup', () => {
  const r = readSessionUsage(MAIN);
  assert.strictEqual(r.assistant_msgs, 5, '2 main + 3 subagent messages');
  assert.strictEqual(r.synthetic_msgs, 2, 'both synthetics, neither in spend');
  assert.strictEqual(r.api_error_msgs, 1, 'the rate-limit record');
  assert.strictEqual(r.parse_failures, 1, 'the broken line');
  assert.strictEqual(r.assistant_records, 8, '5 main + 3 subagent raw records');
  assert.strictEqual(r.dedup_skipped_records, 1, 'exactly one repeat snapshot folded away');
  assert.strictEqual(r.assistant_records - r.dedup_skipped_records, r.assistant_msgs + r.synthetic_msgs,
    'records minus folded == distinct messages (the dedup bookkeeping is self-consistent)');
});

// 21 — an unreadable MAIN transcript throws (zeros would be a false "this was free")
test('readSessionUsage: unreadable main transcript THROWS (never silent zeros)', () => {
  assert.throws(
    () => readSessionUsage(path.join(FIX, 'no-such-session.jsonl')),
    /cannot read main transcript/,
    'a missing main transcript is fatal for the reader',
  );
  assert.throws(() => readSessionUsage(FIX), /cannot read main transcript/, 'a directory is not a transcript');
});

// 22 — a transcript with no assistant records is a legitimate shape
test('empty-ish transcript: no assistant records → zeros, no throw', () => {
  // Written under the OS temp dir, never into the repo tree: a crashed assert must not
  // leave a stray fixture behind that the next run would silently pick up.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-usage-'));
  const tmp = path.join(dir, 'empty-probe.jsonl');
  fs.writeFileSync(tmp, '{"type":"user","uuid":"x","timestamp":"2026-07-20T11:00:00.000Z"}\n\n', 'utf8');
  try {
    const r = readSessionUsage(tmp, { includeSubagents: false });
    assert.deepStrictEqual(r.byLayer.main, Object.assign(emptyLayer(), { files: 1 }), 'zeroed layer, one file');
    assert.strictEqual(r.parse_failures, 0, 'a blank line is NOT a parse failure');
    assert.strictEqual(r.span_min, 0, 'a single-timestamp transcript spans 0 minutes');
    assert.deepStrictEqual(r.models, {}, 'no models');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- CLI ----------

// 23 — --json: clean parseable stdout, exit 0, nothing on stderr
test('CLI --json: exit 0, stdout is the parseable report, stderr silent', () => {
  const res = spawnSync(process.execPath, [LIB, MAIN, '--json'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'exit 0 = the transcript was read');
  assert.strictEqual(res.stderr, '', '--json suppresses the human summary');
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.schema_version, 1, 'schema version in the payload');
  assert.deepStrictEqual(report.totals, TOTALS, 'CLI numbers == library numbers');
  assert.strictEqual(report.otel['gen_ai.usage.output_tokens'], 267, 'otel block present');
  assert.strictEqual(report.otel['gen_ai.usage.cache_read.input_tokens'], 344, 'dotted semconv name survives JSON');
});

// 24 — without --json: stdout STAYS parseable, the summary goes to stderr
test('CLI (no --json): stdout still pure JSON, human summary on stderr', () => {
  const res = spawnSync(process.execPath, [LIB, MAIN], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'exit 0');
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.totals.output_tokens, 267, 'stdout is never polluted by the summary');
  assert.match(res.stderr, /transcript-usage:/, 'the human summary is on stderr');
  assert.match(res.stderr, /tokens/, 'and it names the token block');
});

// 25 — --no-subagents
test('CLI --no-subagents: main layer only', () => {
  const res = spawnSync(process.execPath, [LIB, MAIN, '--no-subagents', '--json'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'exit 0');
  const report = JSON.parse(res.stdout);
  assert.strictEqual(report.subagent_files, 0, 'subagents not read');
  assert.strictEqual(report.totals.output_tokens, 43, 'main-only total');
});

// 26 — exit 2 on an unreadable transcript / usage error; never exit 1 (the reader does not judge)
test('CLI: missing file → exit 2; no args → exit 2; unknown flag → exit 2', () => {
  const missing = spawnSync(process.execPath, [LIB, path.join(FIX, 'nope.jsonl'), '--json'], { encoding: 'utf8' });
  assert.strictEqual(missing.status, 2, 'unreadable transcript = exit 2');
  assert.match(missing.stderr, /cannot read main transcript/, 'and it says why');
  assert.strictEqual(missing.stdout, '', 'no half-written report on the failure path');

  assert.strictEqual(spawnSync(process.execPath, [LIB], { encoding: 'utf8' }).status, 2, 'no args = usage error');
  assert.strictEqual(spawnSync(process.execPath, [LIB, MAIN, '--budget'], { encoding: 'utf8' }).status, 2,
    'unknown flag = usage error');
  assert.strictEqual(spawnSync(process.execPath, [LIB, '--help'], { encoding: 'utf8' }).status, 0, '--help = exit 0');
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
