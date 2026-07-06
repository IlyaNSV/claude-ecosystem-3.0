#!/usr/bin/env node
/**
 * zone-change-trigger.js — PostToolUse hook for the completeness-loop zone→persona router
 * (Autonomous Pipeline Vision, Epic A / A2).
 *
 * Trigger: PostToolUse Write/Edit on a .product/ artifact.
 * Action:
 *   1. Match the changed file to a zone (zone-router.cjs + zone-routing.yaml).
 *   2. Compute git diff against HEAD (best-effort) → deterministic magnitude.
 *   3. If a persona fires (zone matched AND magnitude >= threshold) — append/update an
 *      entry in .product/.pending/advisor-pending.yaml (dedup by artifact id) +
 *      stderr signal so the orchestrating skill spawns each canonical subagent_type.
 *   4. Otherwise exit 0 silently (no zone, or a cosmetic edit below threshold —
 *      the panel does not burn tokens on trivial changes).
 *
 * The hook does NOT spawn a subagent itself — it only signals (same contract as
 * br/ic-change-trigger). Persona invocation happens in the next LLM action.
 *
 * Entries are FLAT scalars (no embedded multiline diff) on purpose — sidesteps the
 * diff-yaml whitespace-ladder round-trip fragility (DEC-DEV-0023); each persona reads
 * the artifact fresh on invocation.
 *
 * Exit 0 always — non-blocking.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let router;
try {
  router = require('./zone-router.cjs');
} catch (e) {
  process.exit(0); // router unavailable → fail-open, never block a write
}

// ---------- Read hook input ----------

let rawInput = '';
try {
  rawInput = fs.readFileSync(0, 'utf-8');
} catch (e) {
  process.exit(0);
}

let hookInput;
try {
  hookInput = JSON.parse(rawInput);
} catch (e) {
  process.exit(0);
}

const filePath = hookInput?.tool_input?.file_path;
if (!filePath) process.exit(0);

const normalized = filePath.replace(/\\/g, '/');

// Only .product/ markdown; skip hidden/temp files.
if (!/\.product\/.+\.md$/.test(normalized)) process.exit(0);
if (path.basename(normalized).startsWith('.')) process.exit(0);

// ---------- Find project root ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

// ---------- Load manifest + match zone (cheap pre-check before reading file) ----------

let manifest;
try {
  manifest = router.loadManifest();
} catch (e) {
  process.exit(0);
}
if (!router.matchZone(normalized, manifest.zones)) process.exit(0);

// ---------- Read artifact ----------

let content;
try {
  content = fs.readFileSync(filePath, 'utf-8');
} catch (e) {
  process.exit(0);
}

const fm = parseFrontmatterFlat(content);
if (!fm.id) process.exit(0);

// ---------- git diff against HEAD (best effort) → magnitude ----------

let diff = '';
try {
  const relForGit = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  diff = execSync(`git -C "${projectRoot}" diff HEAD -- "${relForGit}"`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  }).trim();
} catch (e) {
  diff = ''; // no git / no HEAD / new file
}
if (!diff) diff = '# (No git diff available — likely creation or file not in git)';

let result = router.route(normalized, { diff, manifest });

// ---------- G2 roster layer (participation-matrix over the zone router) ----------
// Optional per-project .product/agent-roster.yaml. ABSENT file → loadRoster returns null →
// resolveFiring returns the route() result UNCHANGED (byte-identical to pre-G behavior).
// A broken/missing roster lib must NEVER block a write or silently kill the panel → fail-open.
let rosterWarnings = [];
try {
  const rosterLib = require('./lib/agent-roster.cjs');
  const roster = rosterLib.loadRoster(path.join(projectRoot, '.product', 'agent-roster.yaml'));
  if (roster && Array.isArray(roster.warnings)) rosterWarnings = roster.warnings;
  result = rosterLib.resolveFiring(result, roster);
} catch (e) {
  // roster lib unavailable / any error → proceed with the un-layered route result (fail-open)
}

// Fire gate: no zone, magnitude below threshold, or all personas dropped by roster → silent no-op.
if (!result.fire) process.exit(0);

// ---------- Append / update advisor-pending.yaml (dedup by artifact id) ----------

const pendingDir = path.join(projectRoot, '.product', '.pending');
try {
  if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
} catch (e) {
  process.exit(0);
}

const pendingFile = path.join(pendingDir, 'advisor-pending.yaml');
const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
const now = new Date().toISOString();

let existing = [];
if (fs.existsSync(pendingFile)) {
  try {
    existing = parseEntries(fs.readFileSync(pendingFile, 'utf-8'));
  } catch (e) {
    existing = [];
  }
}

// Dedup: an open entry for the same artifact is UPDATED in place (idempotent re-run —
// LOOP_READINESS_AUDIT §5.3 / DEC-DEV-0089), not appended as a near-duplicate.
const filtered = existing.filter((e) => e.artifact !== fm.id);
filtered.push({
  artifact: fm.id,
  zone: result.zone,
  personas: result.personas.join(', '),
  magnitude: result.magnitude,
  title: fm.title || '<unknown>',
  status: fm.status || '<unknown>',
  file: relPath,
  trigger: 'zone-router',
  hook: 'zone-change-trigger.js',
  queued_at: now,
});

try {
  fs.writeFileSync(pendingFile, formatEntries(filtered));
} catch (e) {
  // silent
}

// ---------- Stderr signal for the orchestrating skill ----------

process.stderr.write(
  `Advisor review pending for ${fm.id} (zone: ${result.zone}, magnitude: ${result.magnitude}) — ` +
    `personas: ${result.personas.join(', ')}.\n` +
    `See .product/.pending/advisor-pending.yaml; spawn each as its canonical subagent_type ` +
    `(not-found = STOP, never general-purpose fallback).\n` +
    (rosterWarnings.length ? `Roster warnings (non-blocking): ${rosterWarnings.join('; ')}.\n` : '')
);

process.exit(0);

// ---------- Helpers ----------

function findProjectRoot(fp) {
  let dir = path.dirname(path.resolve(fp));
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude')) && fs.existsSync(path.join(dir, '.product'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function parseFrontmatterFlat(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return {};
  const obj = {};
  m[1].split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    const val = kv[2].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
    obj[kv[1]] = val;
  });
  return obj;
}

function parseEntries(text) {
  const items = [];
  const entriesMatch = /^entries:\s*$([\s\S]*)/m.exec(text);
  if (!entriesMatch) return items;
  const blocks = entriesMatch[1].split(/^\s{2}-\s+/m).slice(1);
  blocks.forEach((block) => {
    const item = {};
    block.split(/\r?\n/).forEach((line) => {
      const kv = /^\s*([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
      if (kv) item[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    });
    if (Object.keys(item).length) items.push(item);
  });
  return items;
}

function formatEntries(entries) {
  const lines = [
    '# Advisor review pending entries (managed by zone-change-trigger.js)',
    '# The orchestrating skill reads this → spawns each persona as its canonical subagent_type.',
    '# Personas are heterogeneous profile reviewers (Epic A); dedup is by artifact id (idempotent re-run).',
    '',
    'entries:',
  ];
  entries.forEach((e) => {
    lines.push(`  - artifact: ${scalar(e.artifact)}`);
    if (e.zone) lines.push(`    zone: ${scalar(e.zone)}`);
    if (e.personas) lines.push(`    personas: ${scalar(e.personas)}`);
    if (e.magnitude) lines.push(`    magnitude: ${scalar(e.magnitude)}`);
    if (e.title) lines.push(`    title: ${scalar(e.title)}`);
    if (e.status) lines.push(`    status: ${scalar(e.status)}`);
    if (e.file) lines.push(`    file: ${scalar(e.file)}`);
    if (e.trigger) lines.push(`    trigger: ${scalar(e.trigger)}`);
    if (e.hook) lines.push(`    hook: ${scalar(e.hook)}`);
    if (e.queued_at) lines.push(`    queued_at: ${scalar(e.queued_at)}`);
  });
  return lines.join('\n') + '\n';
}

function scalar(value) {
  const s = String(value);
  if (/[:#"'\n]/.test(s) || /^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}
