#!/usr/bin/env node
/**
 * gate-risk-classifier.cjs — deterministic verify-gate-severity predicate for the
 * Orchestrator P5 `feature-to-tdd-impl` process (DEC-DEV-0073 P0-2, design in
 * dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md; build S5b / DEC-DEV-0077).
 *
 * WHY THIS EXISTS (RUN 01, P0-2):
 *   cc-sdd's kiro-impl runs a full independent adversarial reviewer (kiro-review)
 *   after EVERY task — safe but expensive (×2 subagents on each of ~26 tasks). The
 *   single most-frequent un-codified human judgment in the dogfood run was "does THIS
 *   task need the independent reviewer, or is inline-verify enough?". This helper
 *   replaces that eyeball with a deterministic predicate: HIGH-tier tasks (imperative
 *   load-bearing logic) get the independent reviewer; LOW-tier tasks get a profiled
 *   inline-verify. Validated 16/17 against RUN 01's actual gate decisions (17/17 with
 *   the M5 first-task rule). The reviewer (Layer-3) is irreducible; the CHOICE of gate
 *   severity is not — that is what this codifies.
 *
 * KEY REFINEMENT (design §3): "touches an invariant" is NOT automatically HIGH. What
 * matters is the ENFORCEMENT: a declaratively-enforced invariant (UNIQUE/CHECK, schema)
 * → LOW + DB-introspection (the constraint IS the guarantee); an imperatively-enforced
 * one (transaction ordering, timing, row-lock ordering) → HIGH (where subtle bugs hide).
 *
 * DESIGN CONSTRAINTS: Node stdlib only; pure functions over parsed tasks + requirement
 * text + the load-bearing registry; no judgment. Tested by reproducing the design §6
 * validation table (tests/orchestrator/gate-risk-classifier.test.cjs).
 *
 * EXIT CODES (CLI): 0 ran OK; 2 usage/read error.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CLASSIFIER_SCHEMA_VERSION = 1;

// ---- §4 marker signatures (case-insensitive regex over task+requirement+boundary) ----
const MARKERS = {
  // M1 security-AC
  M1: /anti.?enum|constant.?time|timing|generic\s+(error|success)|fail.?closed|default.?deny|csrf|open.?redirect|safe.?redirect|bcrypt|argon|\bstate\b.*oauth|oauth.*\bstate\b|token.*(issue|consume|rotate|supersede)/i,
  // M2 concurrency / idempotency
  M2: /for\s+update|row.?lock|\batomic\b|\$transaction|idempoten|\blru\b|evict|outbox|dedup|webhook/i,
  // M3 shared mutable primitive used cross-task
  M3: /\bconsume\(|invalidateallforuser|invalidate\s+all|session\s+create|createsession|@shared\b|shared\s+primitive/i,
};

// ---- §4 LOW-tier profile detectors (boundary-based, only when no M1–M3) ----
function detectProfile(task, haystack) {
  const b = (task.boundary || '').toLowerCase();
  const isSchema = /schema|migration|prisma|constraint|unique|\bindex\b|\bddl\b/.test(haystack);
  if (/packages\/db|\bdb\b|database/.test(b) && isSchema) return 'declarative-invariant';
  if (/test|spec|__tests__|\.test\.|\.spec\./.test(b)) return 'test-only';
  if (/apps\/web|frontend|\bui\b|web/.test(b)) return 'UI';
  if (/docker|worker|infra|config|scaffold|monorepo|ci/.test(b)) return 'infra/mechanical';
  if (/packages\/(shared|providers|core)|pure|util/.test(b)) return 'pure-module';
  return null;
}

// canonical id families found in text
function extractIds(text, prefix) {
  const re = new RegExp('\\b' + prefix + '-\\d+', 'g');
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[0])) { seen.add(m[0]); out.push(m[0]); }
  }
  return out;
}

/**
 * Classify one task. Pure.
 *   task: { id, text, boundary, requirements:[refs], depends:[], crossFm?:bool }
 *   ctx:  { requirementText, registry:{invariants:[{id,enforcement,markers}]}, isFirstTask, m5 }
 * → { tier:'HIGH'|'LOW', profile, why:[], confidence:'high'|'low', default_applied? }
 */
function classifyTask(task, ctx = {}) {
  const { requirementText = '', registry = { invariants: [] }, isFirstTask = false, m5 = true } = ctx;
  const haystack = `${task.text || ''} ${requirementText} ${task.boundary || ''}`;

  // M5 (design §6 variant A): first task of a feature gets one foundational review.
  if (m5 && isFirstTask) {
    return { tier: 'HIGH', profile: null, why: ['M5-first-task'], confidence: 'high' };
  }

  const why = [];
  if (MARKERS.M1.test(haystack)) why.push('M1');
  if (MARKERS.M2.test(haystack)) why.push('M2');
  if (MARKERS.M3.test(haystack)) why.push('M3');
  if (task.crossFm) why.push('M4');

  // registry: referenced invariants and their enforcement
  const refIds = (task.requirements || [])
    .concat(extractIds(haystack, 'IC'), extractIds(haystack, 'BR'));
  let registryImperative = false;
  let registryDeclarative = false;
  for (const id of refIds) {
    const inv = registry.invariants.find((i) => i.id === id);
    if (inv && inv.enforcement === 'imperative') registryImperative = true;
    if (inv && inv.enforcement === 'declarative') registryDeclarative = true;
  }
  if (registryImperative) why.push('registry-imperative');

  // HIGH: any imperative load-bearing marker
  if (why.length) {
    return { tier: 'HIGH', profile: null, why, confidence: 'high' };
  }

  // LOW: a clear profile, no markers. Declarative invariants ride here (LOW + introspection).
  const profile = detectProfile(task, haystack);
  if (profile) {
    const lowWhy = [profile];
    if (registryDeclarative) lowWhy.push('registry-declarative');
    return { tier: 'LOW', profile, why: lowWhy, confidence: 'high' };
  }

  // DEFAULT (§8): uncertain → HIGH (cheaper to over-review than miss a timing-oracle).
  return { tier: 'HIGH', profile: null, why: ['default-uncertain'], confidence: 'low', default_applied: true };
}

// ---- load-bearing invariant registry derivation (§5.1) ----
/**
 * Derive enforcement per invariant by scanning its formulation for M1/M2 signatures.
 * invariants: [{ id, text }]. overrides: [{ id, enforcement }]. → {invariants:[{id,enforcement,markers}]}
 */
function deriveRegistry(invariants = [], overrides = []) {
  const out = invariants.map((inv) => {
    const markers = [];
    if (MARKERS.M1.test(inv.text || '')) markers.push('M1');
    if (MARKERS.M2.test(inv.text || '')) markers.push('M2');
    // declarative signal: schema/constraint with no imperative marker
    const declarative = /\bunique\b|\bcheck\b|constraint|\bindex\b|varchar|schema/i.test(inv.text || '') && !markers.length;
    const enforcement = markers.length ? 'imperative' : (declarative ? 'declarative' : 'mixed');
    return { id: inv.id, enforcement, markers };
  });
  for (const ov of overrides) {
    const found = out.find((i) => i.id === ov.id);
    if (found) found.enforcement = ov.enforcement;
    else out.push({ id: ov.id, enforcement: ov.enforcement, markers: ['override'] });
  }
  return { invariants: out };
}

// ---- tasks.md parser (cc-sdd DAG: `## N.` headers + `- [ ] X.Y` + _annotations_) ----
function parseTasks(tasksMd) {
  const lines = tasksMd.replace(/\r\n/g, '\n').split('\n');
  const tasks = [];
  let cur = null;
  let first = true;
  const flush = () => { if (cur) { tasks.push(cur); cur = null; } };
  for (const line of lines) {
    const head = line.match(/^-\s*\[( |x|X)\]\s*(\d+\.\d+)\s*(\(P\))?\s*(.*)$/);
    if (head) {
      flush();
      cur = {
        id: head[2],
        done: head[1].toLowerCase() === 'x',
        parallel: !!head[3],
        text: head[4].trim(),
        boundary: null,
        requirements: [],
        depends: [],
        blocked: null,
        isFirstTask: first,
      };
      first = false;
      continue;
    }
    if (!cur) continue;
    const req = line.match(/_Requirements?:\s*([^_]+)_/i);
    if (req) { cur.requirements = req[1].split(',').map((s) => s.trim()).filter(Boolean); }
    const bnd = line.match(/_Boundary:\s*([^_]+)_/i);
    if (bnd) { cur.boundary = bnd[1].trim(); }
    const dep = line.match(/_Depends:\s*([^_]+)_/i);
    if (dep) { cur.depends = dep[1].split(',').map((s) => s.trim()).filter(Boolean); }
    const blk = line.match(/_Blocked:\s*([^_]+)_/i);
    if (blk) { cur.blocked = blk[1].trim(); }
    // accumulate body text (Observable lines etc.) into the task text for marker scan
    if (/^\s+\S/.test(line) && !req && !bnd && !dep && !blk) { cur.text += ' ' + line.trim(); }
  }
  flush();
  return tasks;
}

// ---- CLI ----
function parseArgs(argv) {
  const a = { tasks: null, requirements: null, registry: null, noM5: false, output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--tasks') a.tasks = argv[++i];
    else if (x === '--requirements') a.requirements = argv[++i];
    else if (x === '--registry') a.registry = argv[++i];
    else if (x === '--no-m5') a.noM5 = true;
    else if (x === '--output') a.output = argv[++i];
    else if (x === '--help' || x === '-h') a.help = true;
    else if (!a.tasks && !x.startsWith('--')) a.tasks = x;
  }
  return a;
}

function printHelp() {
  console.log(`gate-risk-classifier.cjs — deterministic verify-gate-severity predicate (Orchestrator P5)

Usage:
  node gate-risk-classifier.cjs --tasks <tasks.md> [--requirements <requirements.md>] [--registry <registry.json>] [--no-m5]
      classify every actionable sub-task → { tier: HIGH | LOW, profile, why, confidence }

Output: JSON { classifier_schema_version, tasks: [ { id, tier, profile, why, confidence } ] }
HIGH → dispatch the independent kiro-review reviewer. LOW → profiled inline-verify.

Exit: 0 ok; 2 usage/read error.`);
}

function readOrDie(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { console.error(`ERROR: cannot read ${p}: ${e.message}`); process.exit(2); }
}

function main() {
  const a = parseArgs(process.argv);
  if (a.help) { printHelp(); process.exit(0); }
  if (!a.tasks) { console.error('ERROR: --tasks <tasks.md> is required'); printHelp(); process.exit(2); }

  const tasks = parseTasks(readOrDie(a.tasks));
  const requirementText = a.requirements ? readOrDie(a.requirements) : '';
  let registry = { invariants: [] };
  if (a.registry) {
    try { registry = JSON.parse(readOrDie(a.registry)); }
    catch (e) { console.error(`ERROR: --registry must be JSON: ${e.message}`); process.exit(2); }
  }

  const classified = tasks
    .filter((t) => !t.done && !t.blocked)
    .map((t) => {
      const v = classifyTask(t, { requirementText, registry, isFirstTask: t.isFirstTask, m5: !a.noM5 });
      return { id: t.id, tier: v.tier, profile: v.profile, why: v.why, confidence: v.confidence };
    });

  const output = { classifier_schema_version: CLASSIFIER_SCHEMA_VERSION, tasks_file: path.resolve(a.tasks), tasks: classified };
  const json = JSON.stringify(output, null, 2);
  if (a.output) fs.writeFileSync(a.output, json, 'utf8'); else process.stdout.write(json + '\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  CLASSIFIER_SCHEMA_VERSION,
  MARKERS,
  detectProfile,
  extractIds,
  classifyTask,
  deriveRegistry,
  parseTasks,
};
