#!/usr/bin/env node
/**
 * fabric-engine.cjs — Process Fabric micro-interpreter: the deterministic, event-sourced
 * INTER-process coordination engine (DEC-DEV-0153; design SSOT dev/process-fabric/CONCEPT.md).
 *
 * WHY THIS EXISTS (CONCEPT §1-§3):
 *   Inside a process the statechart already exists — Workflow skeletons P2-P7 are deterministic
 *   FSMs with bounded rounds and schema-gates. The real gap is BETWEEN processes and BETWEEN
 *   sessions: outcome-routing (NO-GO / conflicts / product_routed / capability-request) lives in
 *   run.md prose and fires "if the LLM remembers"; a long-lived "feature-in-production" instance
 *   has NO durable carrier of state and NO machine transitions; backpressure is absent while the
 *   overloaded resource is the OWNER's attention (human gates smeared across ≥5 queues).
 *   This engine is the thin fabric: declarative charters (orchestrator/charters/*.json) + a pure
 *   transition core + an event-sourced FS shell. It NEVER calls an LLM and NEVER replaces Workflow
 *   — it is the policeman and the navigator: it ingests MATERIALISED events from process results
 *   (structured JSON the dispatcher already writes to the run-ledger), deterministically computes
 *   the transition, persists instance state, and PRESCRIBES the next step with a disposition drawn
 *   from ./autonomy-policy.cjs (F1; co-located in orchestrator/lib/ since DEC-DEV-0154 so the
 *   update-sync delivers both together). Backpressure = extended state (WIP-limits per lane + one
 *   prioritised owner-queue).
 *
 * DETERMINISM CONTRACT (same discipline as run-ledger.cjs):
 *   The pure core (transition / applyIngest / prescribe / guards) reads NO clock and touches NO FS.
 *   All timestamps are INPUTS (--at ISO), stamped by the dispatcher from the environment date and
 *   passed in. The instance-id suffix is base36(epoch-ms) of the passed timestamp — NO Math.random,
 *   so a given (charter, subject, timestamp) always yields the same id (unit-tested). events.ndjson
 *   is the single source of truth; state.json is a materialised snapshot that `replay` must
 *   reproduce bit-for-bit. Rejected / guard-failed ticks are NO-OPS: reported on stdout but NOT
 *   appended to the log (keeps event-sourcing clean and makes replay env-independent — the only
 *   env-dependent guard, wipOk, never has to be reproduced because a rejected line.start was never
 *   recorded, and successful transitions replay under an empty laneCounts, 0 < wip).
 *
 * EXIT CODES: 0 ran ok · 2 usage / internal error (run-ledger.cjs convention).
 * Dual-use: require() it for the pure helpers (unit-tested), or run as a CLI.
 * Node stdlib only; cross-platform (path.join for Windows).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const autonomyPolicy = require(path.join(__dirname, 'autonomy-policy.cjs'));

const FABRIC_ENGINE_VERSION = 1;

// Owner-queue priority table (CONCEPT §4.5): floor > conflict-escalation > gate-approve > review.
const OWNER_PRIORITY = { floor: 0, conflict: 1, gate: 2, review: 3 };

// ===========================================================================
// PURE CORE — no FS, no clock. The deterministic heart (unit-tested).
// ===========================================================================

/** ASCII/dash slug for ids (charter-id, subject); falls back if it empties out. */
function slugify(s, fallback) {
  const out = String(s == null ? '' : s)
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || fallback || 'x';
}

/** base36(epoch-ms) sliced to 6 — deterministic suffix; 'nots' if the timestamp is unparseable. */
function base36Suffix(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.abs(ms).toString(36).slice(-6) : 'nots';
}

/**
 * Deterministic instance-id: <yyyy-mm-dd>-<charterId-slug>-<subject-slug>-<base36 suffix>.
 * Same discipline as run-ledger.deriveRunId — derived from the PASSED timestamp, no Math.random.
 */
function deriveInstanceId(charterId, subject, iso) {
  const ms = Date.parse(iso);
  const date = Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '0000-00-00';
  return `${date}-${slugify(charterId, 'charter')}-${slugify(subject, 'subject')}-${base36Suffix(iso)}`;
}

/** Dotted-path getter over a plain result object ('gate.result' → obj.gate.result). */
function getPath(obj, dotted) {
  if (obj == null || !dotted) return undefined;
  let cur = obj;
  for (const key of String(dotted).split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Present + non-empty: null/undefined/''/[]/{} are empty; other primitives are non-empty. */
function isNonEmpty(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

// ---- builtin guards (pure) ---------------------------------------------------------------------

/** wipOk(env, charterLimits): laneCounts[lane]||0 < wip. No lane/wip declared ⇒ always ok. */
function wipOk(env, charterLimits) {
  const lim = charterLimits || {};
  const lane = lim.lane;
  const wip = lim.wip;
  if (!lane || !(typeof wip === 'number' && wip > 0)) return true;
  const counts = (env && env.laneCounts) || {};
  return (counts[lane] || 0) < wip;
}

/** counterBelowMax(snapshot, targetMeta): counters[name]||0 < max. Self-contained (no env). */
function counterBelowMax(snapshot, targetMeta) {
  const meta = targetMeta || {};
  if (!meta.counter || typeof meta.max !== 'number') return true;
  const counters = (snapshot && snapshot.counters) || {};
  return (counters[meta.counter] || 0) < meta.max;
}

/**
 * Evaluate a named charter guard against the current snapshot/env. Returns { pass, why }.
 * A candidate WITHOUT a guard is an unconditional fallback (pass:true). An undefined or
 * unknown-kind guard fails LOUDLY (never silently passes — a typo must not open a transition).
 */
function evalGuard(guardName, charter, snapshot, targetMeta, env) {
  if (!guardName) return { pass: true, why: 'unconditional (no guard)' };
  const g = (charter.guards || {})[guardName];
  if (!g) return { pass: false, why: `guard "${guardName}" is not defined in charter.guards — fails closed` };
  if (g.kind === 'builtin' && g.ref === 'wipOk') {
    const lim = charter.limits || {};
    const counts = (env && env.laneCounts) || {};
    const pass = wipOk(env, lim);
    return { pass, why: `wipOk: laneCounts[${lim.lane}]=${counts[lim.lane] || 0} < wip=${lim.wip} → ${pass}` };
  }
  if (g.kind === 'builtin' && g.ref === 'counterBelowMax') {
    const counters = (snapshot && snapshot.counters) || {};
    const cur = (targetMeta && targetMeta.counter) ? (counters[targetMeta.counter] || 0) : 0;
    const pass = counterBelowMax(snapshot, targetMeta);
    return { pass, why: `counterBelowMax: ${targetMeta && targetMeta.counter}=${cur} < max=${targetMeta && targetMeta.max} → ${pass}` };
  }
  return { pass: false, why: `guard "${guardName}" has an unknown kind/ref (${g.kind}/${g.ref}) — fails closed` };
}

// ---- effects (descriptors emitted by transitions; the SHELL applies them) -----------------------

/** Turn a charter action name into an effect descriptor (queue_owner / note). */
function actionToEffect(action, charter, targetState) {
  if (action === 'queue_owner') {
    const meta = ((charter.states || {})[targetState] || {}).meta || {};
    const queueKind = meta.queue_kind || 'gate';
    const priority = Object.prototype.hasOwnProperty.call(OWNER_PRIORITY, queueKind)
      ? OWNER_PRIORITY[queueKind] : OWNER_PRIORITY.gate;
    return { kind: 'queue_owner', queueKind, priority, state: targetState };
  }
  if (typeof action === 'string' && action.startsWith('note:')) {
    return { kind: 'note', text: action.slice('note:'.length) };
  }
  // Any other named action (e.g. project_fm_shipped_hint) materialises as a note prescription —
  // NEVER a direct side effect (the "Orchestrator does not edit .product" boundary stays intact).
  return { kind: 'note', text: String(action) };
}

/** Effects for entering targetState = transition actions ++ the target state's own entry actions. */
function entryEffects(charter, targetState, transitionActions) {
  const targetDef = (charter.states || {})[targetState] || {};
  const actions = (transitionActions || []).concat(targetDef.actions || []);
  return actions.map((a) => actionToEffect(a, charter, targetState));
}

/** Counters after entering targetState: increment counters[meta.counter] if the target declares one. */
function entryCounters(charter, targetState, prevCounters) {
  const meta = ((charter.states || {})[targetState] || {}).meta || {};
  const counters = Object.assign({}, prevCounters || {});
  if (meta.counter) counters[meta.counter] = (counters[meta.counter] || 0) + 1;
  return counters;
}

// ---- the transition (pure) ----------------------------------------------------------------------

/**
 * transition(charter, snapshot, event, payload, env) → { next, effects, why }.
 *
 * Candidate resolution (XState semantics): charter.states[state].on[event] may be an OBJECT or an
 * ARRAY. An array is checked IN ORDER; the first candidate whose guard passes wins; a candidate
 * with no guard is an unconditional fallback. On entry into the target, the target's meta.counter
 * (if any) is incremented and the transition+entry actions become effect descriptors.
 *
 *   - unknown event in this state      → next = the SAME snapshot, effects = [{kind:'rejected',…}],
 *                                         why explains — NEVER throws.
 *   - known event, all guards fail and no fallback → same rejected shape (why names the failed guards).
 *
 * PURE: reads no clock, touches no FS. updated_at is stamped by the shell from event.at (this fn
 * leaves it untouched so replay under an empty env reproduces the recorded transition).
 */
function transition(charter, snapshot, event, payload, env) {
  const e = env || { laneCounts: {}, limits: {}, policy: {} };
  const stateDef = (charter.states || {})[snapshot.state] || {};
  const onSpec = stateDef.on && stateDef.on[event];
  const why = [];

  if (onSpec === undefined) {
    why.push(`event "${event}" is not handled in state "${snapshot.state}" — rejected (no-op)`);
    return { next: snapshot, effects: [{ kind: 'rejected', reason: `unknown-event:${event}@${snapshot.state}` }], why };
  }

  const candidates = Array.isArray(onSpec) ? onSpec : [onSpec];
  let chosen = null;
  for (const c of candidates) {
    const targetMeta = ((charter.states || {})[c.target] || {}).meta || {};
    const gRes = evalGuard(c.guard, charter, snapshot, targetMeta, e);
    why.push(`candidate → ${c.target}${c.guard ? ` [${c.guard}]` : ''}: ${gRes.why}`);
    if (gRes.pass) { chosen = c; break; }
  }

  if (!chosen) {
    why.push(`all ${candidates.length} candidate(s) for "${event}" failed their guards — rejected (stay in "${snapshot.state}")`);
    return { next: snapshot, effects: [{ kind: 'rejected', reason: `guards-failed:${event}@${snapshot.state}` }], why };
  }

  const target = chosen.target;
  why.push(`transition ${snapshot.state} → ${target} on ${event}`);
  const next = Object.assign({}, snapshot, {
    state: target,
    counters: entryCounters(charter, target, snapshot.counters),
    seq: snapshot.seq + 1,
  });
  const effects = entryEffects(charter, target, chosen.actions);
  return { next, effects, why };
}

// ---- ingest: materialise result JSON into events (pure) -----------------------------------------

/**
 * applyIngest(charter, processName, resultJson) → [eventName] (0 or 1).
 * Rules charter.ingest[processName] are checked IN ORDER; the FIRST matching rule emits its ONE
 * event (not every matching rule). `default:true` is an unconditional fallback. Predicates:
 * when.nonEmpty (present & non-empty), when.eq (===), when.in (membership) over when.path.
 */
function applyIngest(charter, processName, resultJson) {
  const rules = ((charter.ingest || {})[processName]);
  if (!Array.isArray(rules)) return [];
  for (const rule of rules) {
    if (rule.default === true) return [rule.emit];
    const w = rule.when;
    if (!w || !Object.prototype.hasOwnProperty.call(w, 'path')) continue;
    const val = getPath(resultJson, w.path);
    let match = false;
    if (Object.prototype.hasOwnProperty.call(w, 'nonEmpty')) {
      match = w.nonEmpty ? isNonEmpty(val) : !isNonEmpty(val);
    } else if (Object.prototype.hasOwnProperty.call(w, 'eq')) {
      match = val === w.eq;
    } else if (Object.prototype.hasOwnProperty.call(w, 'in')) {
      match = Array.isArray(w.in) && w.in.indexOf(val) !== -1;
    }
    if (match) return [rule.emit];
  }
  return [];
}

// ---- disposition + prescription (pure; consumes F1 autonomy-policy) -----------------------------

/**
 * resolveDisposition(stateMeta, env) → the F1 envelope from autonomy-policy.resolve().
 *   operation_class ← stateMeta.operation_class || 'process-step'
 *   risk_tier       ← stateMeta.risk           || 'HIGH'   (conservative; consumed, not re-derived)
 *   env_tier        ← env.limits.env_tier       || 'dev'
 *   policy          ← env.policy                || {}
 *   override        ← env.override              (per-invocation --autonomy flag; F1 precedence:
 *                     floor > override > pin > default — an invalid level is ignored LOUDLY by F1)
 * The floor (prod_deploy/destructive/…) is non-crossable in autonomy-policy, so a floor class
 * yields human-gate REGARDLESS of the charter's meta.autonomy='auto' — Fabric cannot code past it.
 */
function resolveDisposition(stateMeta, env) {
  const meta = stateMeta || {};
  const operationClass = meta.operation_class || 'process-step';
  const riskTier = meta.risk || 'HIGH';
  const envTier = (env && env.limits && env.limits.env_tier) || 'dev';
  const policy = (env && env.policy) || {};
  const override = (env && env.override) || undefined;
  return autonomyPolicy.resolve(operationClass, riskTier, envTier, policy, override);
}

/**
 * prescribe(charter, snapshot, env) → the prescription for OCCUPYING snapshot.state.
 *   final:true                 → { kind:'none', final:true }
 *   invoke                     → { kind:'run-process', process, argsHint, disposition, why }
 *   meta.autonomy='human-gate' → { kind:'human-gate', paEntry }
 *   otherwise                  → { kind:'none' }
 * Every invoke disposition is routed through F1 (resolveDisposition) — floor/human-gate is not
 * bypassable by construction.
 */
function prescribe(charter, snapshot, env) {
  const def = (charter.states || {})[snapshot.state] || {};
  const meta = def.meta || {};
  if (def.final) return { kind: 'none', final: true, state: snapshot.state };
  if (def.invoke) {
    const disp = resolveDisposition(meta, env);
    // An author who explicitly marks an invoke state meta.autonomy='human-gate' means it: floor the
    // F1 result up to human-gate (never below). F1 can only RAISE to human-gate (floor classes), so
    // this closes the gap where a human-gate hint on an invoke state would otherwise be silently
    // dropped and the step auto-run. Strictly conservative — it never weakens a disposition.
    const humanGated = meta.autonomy === 'human-gate';
    return {
      kind: 'run-process',
      process: def.invoke.process,
      argsHint: { subject: snapshot.subject, instance: snapshot.instance },
      disposition: humanGated ? 'human-gate' : disp.disposition,
      floor_hit: disp.floor_hit,
      why: humanGated
        ? disp.why.concat([`charter meta.autonomy='human-gate' on invoke state "${snapshot.state}" → disposition floored to human-gate`])
        : disp.why,
      state: snapshot.state,
    };
  }
  if (meta.autonomy === 'human-gate') {
    return {
      kind: 'human-gate',
      paEntry: { instance: snapshot.instance, subject: snapshot.subject, state: snapshot.state },
      state: snapshot.state,
    };
  }
  return { kind: 'none', state: snapshot.state };
}

/** Build the initial snapshot for a charter (entry into charter.initial: counters + context). */
function initialSnapshot(charter, instanceId, subject, iso) {
  const initial = charter.initial;
  return {
    instance: instanceId,
    charter_id: charter.id,
    charter_version: charter.version,
    subject: subject == null ? null : String(subject),
    state: initial,
    context: JSON.parse(JSON.stringify(charter.context || {})),
    counters: entryCounters(charter, initial, {}),
    seq: 0,
    created_at: iso || null,
    updated_at: iso || null,
  };
}

// ===========================================================================
// FS SHELL — the only place that touches disk. Thin over the pure core.
// ===========================================================================

function defaultFabricRoot() {
  return path.join('.claude', 'orchestrator', 'fabric');
}
function fabricRoot(baseRoot) {
  return path.resolve(baseRoot || defaultFabricRoot());
}
function instanceDir(root, id) { return path.join(root, id); }
function statePath(root, id) { return path.join(instanceDir(root, id), 'state.json'); }
function eventsPath(root, id) { return path.join(instanceDir(root, id), 'events.ndjson'); }
function limitsPath(root) { return path.join(root, 'limits.json'); }
function ownerQueuePath(root) { return path.join(root, 'owner-queue.json'); }
function defaultChartersDir() { return path.join(__dirname, '..', 'charters'); }

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return null; }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

/** limits.json — created with dev defaults at init if absent (CONCEPT §4.5). */
function readLimits(root) {
  const l = readJsonSafe(limitsPath(root));
  if (l) return l;
  return { env_tier: 'dev', lanes: {}, owner_queue_soft_cap: 7 };
}
function ensureLimits(root) {
  if (!fs.existsSync(limitsPath(root))) {
    writeJson(limitsPath(root), { env_tier: 'dev', lanes: {}, owner_queue_soft_cap: 7 });
  }
}

function listInstances(root) {
  let entries = [];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (_e) { return []; }
  return entries
    .filter((d) => d.isDirectory() && fs.existsSync(statePath(root, d.name)))
    .map((d) => d.name);
}

function readEvents(root, id) {
  let raw;
  try { raw = fs.readFileSync(eventsPath(root, id), 'utf8'); } catch (_e) { return []; }
  return raw.split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_e) { return null; }
  }).filter(Boolean);
}
function appendEvent(root, id, ev) {
  fs.mkdirSync(instanceDir(root, id), { recursive: true });
  fs.appendFileSync(eventsPath(root, id), JSON.stringify(ev) + '\n');
}

/** Load a charter by explicit path, else by id from the default charters dir. */
function loadCharter(explicitPath, charterId) {
  if (explicitPath) {
    const c = readJsonSafe(path.resolve(explicitPath));
    if (!c) throw new Error(`cannot read/parse charter: ${explicitPath}`);
    return c;
  }
  if (charterId) {
    const p = path.join(defaultChartersDir(), `${charterId}.json`);
    const c = readJsonSafe(p);
    if (c) return c;
  }
  throw new Error('no charter: pass --charter <file> (or an instance whose charter_id resolves in orchestrator/charters/)');
}

/**
 * laneCounts for a wip check: OTHER instances (self excluded) that are non-final on the same lane.
 * A rejected line.start is never recorded, so replay never needs this — it is an admission-time
 * measurement only. Self is excluded because the starting instance still sits in its pre-lane
 * queued state and must not count itself out of the lane it is trying to enter.
 */
function computeLaneCounts(root, charter, selfId) {
  const lane = charter.limits && charter.limits.lane;
  const counts = {};
  if (!lane) return counts;
  for (const id of listInstances(root)) {
    if (id === selfId) continue;
    const snap = readJsonSafe(statePath(root, id));
    if (!snap) continue;
    let ch = charter;
    if (snap.charter_id !== charter.id) {
      try { ch = loadCharter(null, snap.charter_id); } catch (_e) { continue; }
    }
    const laneOfInst = ch.limits && ch.limits.lane;
    if (laneOfInst !== lane) continue;
    const def = (ch.states || {})[snap.state] || {};
    if (def.final) continue;
    counts[lane] = (counts[lane] || 0) + 1;
  }
  return counts;
}

function shellEnv(root, charter, selfId) {
  return {
    laneCounts: computeLaneCounts(root, charter, selfId),
    limits: readLimits(root),
    policy: (readLimits(root).policy) || {},
  };
}

function appendOwnerQueue(root, entry) {
  const q = readJsonSafe(ownerQueuePath(root)) || [];
  q.push(entry);
  writeJson(ownerQueuePath(root), q);
}

/** Apply the shell-side effects of an applied transition (owner-queue writes). Notes are inert. */
function applyEffects(root, snapshot, at, effects) {
  for (const eff of effects || []) {
    if (eff.kind === 'queue_owner') {
      appendOwnerQueue(root, {
        at: at || null,
        instance: snapshot.instance,
        state: eff.state,
        kind: eff.queueKind,
        priority: eff.priority,
        source: snapshot.charter_id,
      });
    }
  }
}

/**
 * Apply ONE event to an instance on disk. Rejected / guard-failed events are NO-OPS: reported in
 * the return value but NOT persisted (see the determinism contract). Returns a report object.
 */
function applyEventFS(root, charter, id, eventName, payload, at, runId, autonomyOverride) {
  const snap = readJsonSafe(statePath(root, id));
  if (!snap) throw new Error(`no such instance: ${id}`);
  const env = shellEnv(root, charter, id);
  if (autonomyOverride) env.override = autonomyOverride;
  const { next, effects, why } = transition(charter, snap, eventName, payload, env);
  const applied = next.state !== snap.state || next.seq !== snap.seq;

  if (!applied) {
    return { instance: id, event: eventName, from: snap.state, to: snap.state, applied: false, why, effects, prescription: prescribe(charter, snap, env) };
  }

  next.updated_at = at || snap.updated_at;
  writeJson(statePath(root, id), next);
  const evRecord = { seq: next.seq, at: at || null, event: eventName, from: snap.state, to: next.state, why, effects };
  if (payload !== undefined && payload !== null) evRecord.payload = payload;
  if (runId) evRecord.run_id = runId;
  appendEvent(root, id, evRecord);
  applyEffects(root, next, at, effects);

  return { instance: id, event: eventName, from: snap.state, to: next.state, applied: true, why, effects, prescription: prescribe(charter, next, env) };
}

/** Replay events.ndjson back into a snapshot and (optionally) diff against state.json. */
function replayInstance(root, charter, id) {
  const events = readEvents(root, id);
  if (!events.length) throw new Error(`no events to replay for instance ${id}`);
  const init = events[0];
  if (init.event !== '@init' || !init.meta) throw new Error(`first event is not a well-formed @init for ${id}`);
  const replayEnv = { laneCounts: {}, limits: {}, policy: {} };

  let snap = {
    instance: id,
    charter_id: init.meta.charter_id,
    charter_version: init.meta.charter_version,
    subject: init.meta.subject == null ? null : String(init.meta.subject),
    state: init.to,
    context: JSON.parse(JSON.stringify(charter.context || {})),
    counters: entryCounters(charter, init.to, {}),
    seq: 0,
    created_at: init.at,
    updated_at: init.at,
  };

  for (let i = 1; i < events.length; i += 1) {
    const ev = events[i];
    const { next } = transition(charter, snap, ev.event, ev.payload, replayEnv);
    next.updated_at = ev.at;
    snap = next;
  }
  return snap;
}

// ===========================================================================
// CLI
// ===========================================================================

function parseArgs(argv) {
  const a = {};
  const rest = argv.slice(3); // skip node, script, subcommand
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--charter': a.charter = next(); break;
      case '--subject': a.subject = next(); break;
      case '--instance': a.instance = next(); break;
      case '--event': a.event = next(); break;
      case '--process': a.process = next(); break;
      case '--payload': a.payload = next(); break;
      case '--result': a.result = next(); break;
      case '--result-file': a.resultFile = next(); break;
      case '--run-id': a.runId = next(); break;
      case '--at': a.at = next(); break;
      case '--autonomy': a.autonomy = next(); break;
      case '--base-root': a.baseRoot = next(); break;
      case '--all': a.all = true; break;
      default: break;
    }
  }
  return a;
}

function requireAt(iso) {
  if (!iso) { console.error('ERROR: --at <ISO> is required (dispatcher-stamped)'); process.exit(2); }
  if (!Number.isFinite(Date.parse(iso))) { console.error(`ERROR: --at "${iso}" is not a parseable ISO timestamp`); process.exit(2); }
}

function readResult(args) {
  if (args.resultFile) {
    try { return JSON.parse(fs.readFileSync(path.resolve(args.resultFile), 'utf8')); } catch (e) {
      throw new Error(`cannot read/parse --result-file ${args.resultFile}: ${e.message}`);
    }
  }
  if (args.result != null) {
    try { return JSON.parse(args.result); } catch (e) { throw new Error(`cannot parse --result JSON: ${e.message}`); }
  }
  return {};
}
function readPayload(args) {
  if (args.payload == null) return undefined;
  try { return JSON.parse(args.payload); } catch (e) { throw new Error(`cannot parse --payload JSON: ${e.message}`); }
}

function out(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }

function printHelp() {
  process.stdout.write([
    'fabric-engine.cjs — Process Fabric interpreter (DEC-DEV-0153; CONCEPT dev/process-fabric/).',
    '',
    'init   --charter <f> --subject <id> --at <ISO> [--base-root <dir>]',
    '  → create instance (state.json + events.ndjson@init); echo instance-id + initial prescription.',
    'ingest --instance <id> --process <name> (--result <json>|--result-file <p>) --at <ISO> [--run-id <r>] [--charter <f>]',
    '  → materialise the result into ≤1 event, then tick it. Idempotent: a seen --run-id is a no-op.',
    'tick   --instance <id> --event <evt:…> [--payload <json>] --at <ISO> [--charter <f>]',
    '  → transition + persist + emit the next prescription (stdout JSON).',
    'status [--all] [--base-root <dir>]   → instances, states, prioritised owner-queue.',
    'replay --instance <id> [--charter <f>]   → rebuild state from events; diff vs state.json (exit 2 on mismatch).',
    '',
    'init/ingest/tick also take --autonomy <L0|L1> — per-invocation F1 override for the emitted',
    'prescription (tighten/restore the level; the floor is never crossable, invalid levels ignored loudly).',
    'Timestamps are INPUTS (--at ISO), stamped by the dispatcher. Instance-id is deterministic',
    '(<date>-<charter>-<subject>-<base36 suffix>, no Math.random). Exit 0 ok · 2 usage/internal.',
  ].join('\n') + '\n');
}

function cmdInit(args) {
  if (!args.charter) { console.error('ERROR: init needs --charter <file>'); process.exit(2); }
  if (!args.subject) { console.error('ERROR: init needs --subject <id>'); process.exit(2); }
  requireAt(args.at);
  const root = fabricRoot(args.baseRoot);
  const charter = loadCharter(args.charter, null);
  ensureLimits(root);
  const id = deriveInstanceId(charter.id, args.subject, args.at);
  if (fs.existsSync(statePath(root, id))) { console.error(`ERROR: instance already exists: ${id}`); process.exit(2); }

  const snap = initialSnapshot(charter, id, args.subject, args.at);
  writeJson(statePath(root, id), snap);
  const initEffects = entryEffects(charter, charter.initial, []);
  appendEvent(root, id, {
    seq: 0, at: args.at, event: '@init', from: null, to: charter.initial,
    why: [`instance created for subject "${args.subject}" on charter ${charter.id} v${charter.version}`],
    effects: initEffects,
    meta: { charter_id: charter.id, charter_version: charter.version, subject: args.subject },
  });
  applyEffects(root, snap, args.at, initEffects);

  const env = shellEnv(root, charter, id);
  if (args.autonomy) env.override = args.autonomy;
  out({ instance: id, state: snap.state, prescription: prescribe(charter, snap, env) });
  process.exit(0);
}

function cmdTick(args) {
  if (!args.instance) { console.error('ERROR: tick needs --instance <id>'); process.exit(2); }
  if (!args.event) { console.error('ERROR: tick needs --event <evt:…>'); process.exit(2); }
  requireAt(args.at);
  const root = fabricRoot(args.baseRoot);
  const snap = readJsonSafe(statePath(root, args.instance));
  if (!snap) { console.error(`ERROR: no such instance: ${args.instance}`); process.exit(2); }
  const charter = loadCharter(args.charter, snap.charter_id);
  const payload = readPayload(args);
  const report = applyEventFS(root, charter, args.instance, args.event, payload, args.at, args.runId, args.autonomy);
  out(report);
  process.exit(0);
}

function cmdIngest(args) {
  if (!args.instance) { console.error('ERROR: ingest needs --instance <id>'); process.exit(2); }
  if (!args.process) { console.error('ERROR: ingest needs --process <name>'); process.exit(2); }
  requireAt(args.at);
  const root = fabricRoot(args.baseRoot);
  const snap = readJsonSafe(statePath(root, args.instance));
  if (!snap) { console.error(`ERROR: no such instance: ${args.instance}`); process.exit(2); }
  const charter = loadCharter(args.charter, snap.charter_id);

  // Idempotency: a run-id already present in the log ⇒ skip the whole ingest (no-op, exit 0).
  const runId = args.runId || null;
  if (runId) {
    const seen = readEvents(root, args.instance).some((ev) => ev.run_id === runId);
    if (seen) { out({ instance: args.instance, process: args.process, run_id: runId, deduped: true, emitted: [], ticks: [] }); process.exit(0); }
  }

  const result = readResult(args);
  const emitted = applyIngest(charter, args.process, result);
  const ticks = [];
  for (const eventName of emitted) {
    ticks.push(applyEventFS(root, charter, args.instance, eventName, undefined, args.at, runId, args.autonomy));
  }
  out({ instance: args.instance, process: args.process, run_id: runId, deduped: false, emitted, ticks });
  process.exit(0);
}

function cmdStatus(args) {
  const root = fabricRoot(args.baseRoot);
  const instances = listInstances(root).map((id) => {
    const s = readJsonSafe(statePath(root, id)) || {};
    return { instance: id, state: s.state, charter_id: s.charter_id, seq: s.seq, subject: s.subject };
  });
  const queue = (readJsonSafe(ownerQueuePath(root)) || [])
    .slice()
    .sort((a, b) => (a.priority - b.priority) || String(a.at).localeCompare(String(b.at)));
  out({ instances, owner_queue: queue, limits: readLimits(root) });
  process.exit(0);
}

function cmdReplay(args) {
  if (!args.instance) { console.error('ERROR: replay needs --instance <id>'); process.exit(2); }
  const root = fabricRoot(args.baseRoot);
  const persisted = readJsonSafe(statePath(root, args.instance));
  if (!persisted) { console.error(`ERROR: no such instance: ${args.instance}`); process.exit(2); }
  const charter = loadCharter(args.charter, persisted.charter_id);
  const rebuilt = replayInstance(root, charter, args.instance);
  const ok = JSON.stringify(rebuilt) === JSON.stringify(persisted);
  out({ instance: args.instance, ok, seq: rebuilt.seq, rebuilt: ok ? undefined : rebuilt, persisted: ok ? undefined : persisted });
  process.exit(ok ? 0 : 2);
}

function main() {
  const sub = process.argv[2];
  if (sub === '--help' || sub === '-h' || !sub) { printHelp(); process.exit(sub ? 0 : 2); }
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  try {
    switch (sub) {
      case 'init': return cmdInit(args);
      case 'tick': return cmdTick(args);
      case 'ingest': return cmdIngest(args);
      case 'status': return cmdStatus(args);
      case 'replay': return cmdReplay(args);
      default:
        console.error(`ERROR: unknown subcommand "${sub}" (expected init | ingest | tick | status | replay)`);
        process.exit(2);
    }
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  FABRIC_ENGINE_VERSION,
  OWNER_PRIORITY,
  // pure core
  slugify,
  base36Suffix,
  deriveInstanceId,
  getPath,
  isNonEmpty,
  wipOk,
  counterBelowMax,
  evalGuard,
  actionToEffect,
  entryEffects,
  entryCounters,
  transition,
  applyIngest,
  resolveDisposition,
  prescribe,
  initialSnapshot,
  // shell (exported for integration/tests)
  fabricRoot,
  loadCharter,
  computeLaneCounts,
  applyEventFS,
  replayInstance,
};
