#!/usr/bin/env node
/**
 * subagent-watchdog.js — deterministic watchdog over the pending-review queues and
 * canonical-persona subagent spawns (DEC-DEV-0159; closes audit gaps G05 + G06).
 *
 * The pending queues (.product/.pending/da-pending.yaml + advisor-pending.yaml) are a
 * WRITE-ONLY producer channel: br/ic/zone-change-trigger hooks append entries, but nothing
 * machine-verifies that the orchestrating LLM actually spawned the reviewer — the spawn
 * lives in conversation memory only. Two documented failure classes:
 *   G05 — a queue entry is wiped/overwritten with NO review having run
 *         (live incident 1ff552c0c6b4 / DEC-DEV-0038 finding #1: BR edit emptied
 *         da-pending.yaml without a product-devils-advocate spawn);
 *   G06 — the reviewer runs under the WRONG agent type: harness answers «Agent type
 *         'product-devils-advocate' not found» and the LLM silently falls back to
 *         general-purpose (recurring S8 P1 regression; prompt-level guards exist —
 *         feature-session.md anti-patterns #9/#10 — but nothing detects violations).
 *
 * This hook closes the sensor side deterministically (lesson-gate pattern: deterministic
 * listener, LLM judgment stays with the orchestrator). Three prongs, one file:
 *
 *   SubagentStop (matcher "" — all agents):
 *     • canonical persona finished (product-devils-advocate / architect-advisor /
 *       qa-advisor / ux-advisor) → find its spawn prompt in the MAIN-session transcript
 *       (payload.transcript_path; SubagentStop payload carries agent_type + agent_id per
 *       code.claude.com/docs/en/hooks, verified 2026-07), extract artifact ids, and record
 *       consumption in the watchdog's OWN sidecar state — producer files are never mutated
 *       (their formatters whitelist fields; foreign keys would be silently dropped on the
 *       next re-emit, see br-change-trigger.js formatDaEntriesYaml).
 *     • generic agent finished (general-purpose / claude) whose spawn prompt looks like a
 *       persona/DA brief → LOUD stderr: the S8 P1 substitution happened again; review is
 *       NOT valid, respawn under the canonical type (never re-grade prompt-side).
 *
 *   Stop (matcher ""): session is closing while queue entries remain unconsumed → stderr
 *     reminder listing them (warn-only backstop; the queue outlives the session, but the
 *     spawn-memory does not — exactly how G05 rots).
 *
 *   PostToolUse (Write|Edit on the pending yamls): the LLM just rewrote a queue file →
 *     diff current entries against the sidecar state; an entry that DISAPPEARED without a
 *     recorded consumption = the G05 incident signature → loud stderr (warn once, then the
 *     record is dropped).
 *
 * Sidecar state: .product/.pending/.watchdog-state.json
 *   { "<queue-basename>": { "<artifact-id>": { queued_at, seen_at, consumed_at?, consumed_by? } } }
 * Keyed by (artifact, queued_at): a re-queued artifact (new queued_at) is a NEW review
 * obligation — prior consumption does not carry over.
 *
 * Rollout discipline: warn-only (exit 0 ALWAYS — the only blocking hook in the ecosystem
 * stays lesson-gate), fail-open on any fs/parse error, env SUBAGENT_WATCHDOG=0 silences.
 * NB: exit 2 on SubagentStop would force the SUBAGENT to continue — never wanted here.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CANONICAL_PERSONAS = new Set([
  'product-devils-advocate',
  'architect-advisor',
  'qa-advisor',
  'ux-advisor',
]);
// Catch-all agent types a persona brief must never run under (S8 P1 signature).
const GENERIC_TYPES = new Set(['general-purpose', 'claude']);
// A spawn prompt that references the canonical machinery = a persona/DA brief.
const BRIEF_MARKERS = /product-devils-advocate|devils-advocate\.md|\bDA review\b|Mode:\s*(adaptive|full)|architect-advisor|qa-advisor|ux-advisor/i;
const ARTIFACT_ID_RE = /\b(?:FM|BR|IC|SC|NFR|MK|RL|LC|BG|AM)-\d+[a-z]?\b/g;
const QUEUE_FILES = ['da-pending.yaml', 'advisor-pending.yaml'];
const STATE_BASENAME = '.watchdog-state.json';
const TRANSCRIPT_TAIL_BYTES = 1024 * 1024;

function main() {
  if (process.env.SUBAGENT_WATCHDOG === '0') return;

  let payload = {};
  try {
    payload = JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch (e) {
    return;
  }

  const root = findProjectRoot(payload.cwd || process.cwd());
  if (!root) return;
  const pendingDir = path.join(root, '.product', '.pending');

  const event =
    payload.hook_event_name ||
    (payload.agent_type ? 'SubagentStop' : payload.tool_input ? 'PostToolUse' : 'Stop');

  // PostToolUse: only queue-file rewrites are interesting; stay cheap on every other Write.
  if (event === 'PostToolUse') {
    const fp = String(payload.tool_input?.file_path || '').replace(/\\/g, '/');
    if (!/\.product\/\.pending\/(da|advisor)-pending\.yaml$/.test(fp)) return;
  }

  const state = readState(pendingDir);
  const queues = readQueues(pendingDir);

  if (event === 'SubagentStop') {
    onSubagentStop(payload, queues, state);
  }

  // Every invocation: reconcile state against current queue content.
  // (Detects G05 wipes no matter which event observed them first.)
  reconcile(queues, state);

  if (event === 'Stop') {
    warnUnconsumed(queues, state);
  }

  writeState(pendingDir, state);
}

// ─── Prongs ──────────────────────────────────────────────────────────────────

function onSubagentStop(payload, queues, state) {
  const agentType = String(payload.agent_type || '');
  const spawn = findLastSpawn(payload.transcript_path, agentType);

  if (CANONICAL_PERSONAS.has(agentType)) {
    if (!spawn) return; // cannot attribute — fail open
    const ids = new Set(String(spawn.prompt || '').match(ARTIFACT_ID_RE) || []);
    if (!ids.size) return;
    const consumed = [];
    for (const [file, entries] of Object.entries(queues)) {
      for (const e of entries) {
        if (!ids.has(e.artifact)) continue;
        const rec = ensureRecord(state, file, e);
        if (!rec.consumed_at) {
          rec.consumed_at = new Date().toISOString();
          rec.consumed_by = agentType;
          consumed.push(`${e.artifact} (${file})`);
        }
      }
    }
    if (consumed.length) {
      process.stderr.write(
        `subagent-watchdog: consumed ${consumed.join(', ')} — reviewed by ${agentType}. ` +
          `Queue entries may now be cleared.\n`
      );
    }
    return;
  }

  if (GENERIC_TYPES.has(agentType) && spawn && BRIEF_MARKERS.test(String(spawn.prompt || ''))) {
    process.stderr.write(
      `subagent-watchdog: ⛔ S8 P1 REGRESSION — a persona/DA brief just ran under subagent_type ` +
        `"${agentType}" instead of its canonical agent type. This review is NOT valid ` +
        `(Builder/Critic isolation + persona system prompt were bypassed). ` +
        `Do NOT clear the pending entry. Respawn with the canonical subagent_type ` +
        `(product-devils-advocate / architect-advisor / qa-advisor / ux-advisor); ` +
        `if the harness says "agent not found" → STOP and surface to the owner ` +
        `(feature-session.md anti-patterns #9/#10, G06).\n`
    );
  }
}

function reconcile(queues, state) {
  const wiped = [];
  for (const file of QUEUE_FILES) {
    const current = new Map((queues[file] || []).map((e) => [e.artifact, e]));
    const recs = state[file] || {};

    // Track every live entry so its later disappearance is observable.
    for (const e of current.values()) ensureRecord(state, file, e);

    for (const [artifact, rec] of Object.entries(recs)) {
      const live = current.get(artifact);
      if (live && live.queued_at === rec.queued_at) continue; // still queued, same obligation
      if (live && live.queued_at !== rec.queued_at) {
        // Re-queued: new obligation replaces the old record.
        ensureRecord(state, file, live, true);
        continue;
      }
      // Entry disappeared from the queue.
      if (!rec.consumed_at) wiped.push(`${artifact} (${file}, queued_at ${rec.queued_at || '?'})`);
      delete state[file][artifact]; // warn once / consumed cleanup — either way, done tracking
    }
  }
  if (wiped.length) {
    process.stderr.write(
      `subagent-watchdog: ⚠️ G05 — pending entr${wiped.length === 1 ? 'y' : 'ies'} removed WITHOUT a ` +
        `recorded canonical review: ${wiped.join(', ')}. If no reviewer subagent actually ran, ` +
        `restore the entr${wiped.length === 1 ? 'y' : 'ies'} (incident class 1ff552c0c6b4 / DEC-DEV-0038 #1); ` +
        `if a review DID run under its canonical type, this watchdog missed it — note why.\n`
    );
  }
}

function warnUnconsumed(queues, state) {
  const open = [];
  for (const [file, entries] of Object.entries(queues)) {
    for (const e of entries) {
      const rec = (state[file] || {})[e.artifact];
      if (!rec || rec.queued_at !== e.queued_at || !rec.consumed_at) {
        open.push(`${e.artifact} (${file})`);
      }
    }
  }
  if (open.length) {
    process.stderr.write(
      `subagent-watchdog: session closing with ${open.length} unconsumed pending review(s): ` +
        `${open.join(', ')}. The queue survives, the spawn-intent does not (G05) — next session ` +
        `must spawn the canonical reviewer(s) or the owner should resolve the entries explicitly.\n`
    );
  }
}

// ─── Queue / state IO ────────────────────────────────────────────────────────

function readQueues(pendingDir) {
  const queues = {};
  for (const file of QUEUE_FILES) {
    queues[file] = parseEntries(path.join(pendingDir, file));
  }
  return queues;
}

// Minimal line-parser for the trigger hooks' emitted format: entries keyed by
// `  - artifact: <id>` blocks; only artifact + queued_at are needed here.
function parseEntries(absPath) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf-8');
  } catch (e) {
    return [];
  }
  const entries = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const start = /^\s{2}-\s+artifact:\s*("?)([^"\s]+)\1\s*$/.exec(line);
    if (start) {
      cur = { artifact: start[2], queued_at: '' };
      entries.push(cur);
      continue;
    }
    if (cur) {
      const q = /^\s{4}queued_at:\s*("?)(\S+)\1\s*$/.exec(line);
      if (q) cur.queued_at = q[2];
    }
  }
  return entries;
}

function ensureRecord(state, file, entry, replace) {
  if (!state[file]) state[file] = {};
  const existing = state[file][entry.artifact];
  if (!replace && existing && existing.queued_at === entry.queued_at) return existing;
  state[file][entry.artifact] = {
    queued_at: entry.queued_at || '',
    seen_at: new Date().toISOString(),
  };
  return state[file][entry.artifact];
}

function readState(pendingDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(pendingDir, STATE_BASENAME), 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeState(pendingDir, state) {
  try {
    if (!fs.existsSync(pendingDir)) return; // no queues ever existed — do not create dirs
    fs.writeFileSync(path.join(pendingDir, STATE_BASENAME), JSON.stringify(state, null, 2) + '\n');
  } catch (e) {
    // fail open
  }
}

// ─── Transcript spawn lookup ─────────────────────────────────────────────────

// The MAIN-session transcript is JSONL; assistant tool_use blocks carry
// input.subagent_type + input.prompt. Scan a bounded tail, newest-first, and return the
// most recent spawn matching the agent type that just stopped. Shape-tolerant: any object
// with { type: "tool_use", input: { subagent_type } } counts, wherever it nests.
function findLastSpawn(transcriptPath, agentType) {
  if (!transcriptPath || !agentType) return null;
  let text;
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    text = buf.toString('utf-8');
  } catch (e) {
    return null;
  }
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"subagent_type"')) continue;
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch (e) {
      continue; // first line of the tail may be truncated
    }
    const uses = [];
    collectToolUses(obj, uses);
    for (let j = uses.length - 1; j >= 0; j--) {
      if (uses[j].input.subagent_type === agentType) {
        return { prompt: String(uses[j].input.prompt || '') };
      }
    }
  }
  return null;
}

function collectToolUses(node, acc, depth) {
  if (!node || typeof node !== 'object' || (depth || 0) > 8) return;
  if (node.type === 'tool_use' && node.input && typeof node.input.subagent_type === 'string') {
    acc.push(node);
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') collectToolUses(v, acc, (depth || 0) + 1);
  }
}

// ─── Root discovery ──────────────────────────────────────────────────────────

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.product'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

try {
  main();
} catch (e) {
  // deterministic sensor must never wound the session — fail open
}
process.exit(0);
