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
 * ingestEmits(charter, processName, resultJson) → [{event, payload}] (0 or 1) (DEC-DEV-0171).
 * Rules charter.ingest[processName] are checked IN ORDER; the FIRST matching rule emits its ONE
 * event (not every matching rule). `default:true` is an unconditional fallback. Predicates:
 * when.nonEmpty (present & non-empty), when.eq (===), when.in (membership) over when.path.
 *
 * PAYLOAD BRIDGE (DEC-DEV-0171): a rule MAY carry an optional `payloadPath` (dot-path, resolved by
 * getPath) — a slice of the result (e.g. §6 capability-requests from P7 `requests[]`) that rides the
 * emitted event through to the human-gate PA-record, so the owner/Integrator see WHAT to provision,
 * not merely THAT the line parked. `payload` is present on the emitted object ONLY when payloadPath
 * is set AND getPath yields a value !== undefined; otherwise the object has no `payload` key at all —
 * bit-for-bit the pre-0171 shape. This keeps a rule without payloadPath identical to old behaviour.
 */
function ingestEmits(charter, processName, resultJson) {
  const rules = ((charter.ingest || {})[processName]);
  if (!Array.isArray(rules)) return [];
  const emitFor = (rule) => {
    const o = { event: rule.emit };
    if (rule.payloadPath) {
      const p = getPath(resultJson, rule.payloadPath);
      if (p !== undefined) o.payload = p;
    }
    return o;
  };
  for (const rule of rules) {
    if (rule.default === true) return [emitFor(rule)];
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
    if (match) return [emitFor(rule)];
  }
  return [];
}

/**
 * applyIngest(charter, processName, resultJson) → [eventName] (0 or 1). Backward-compatible wrapper
 * over ingestEmits (DEC-DEV-0171): units call it directly for event NAMES only. Signature + return
 * are unchanged (the payload bridge rides ingestEmits, which cmdIngest consumes).
 */
function applyIngest(charter, processName, resultJson) {
  return ingestEmits(charter, processName, resultJson).map((e) => e.event);
}

// ---- disposition + prescription (pure; consumes F1 autonomy-policy) -----------------------------

/**
 * resolveDisposition(stateMeta, env) → the F1 envelope from autonomy-policy.resolve().
 *   operation_class ← stateMeta.operation_class || 'process-step'
 *   risk_tier       ← stateMeta.risk           || 'HIGH'   (conservative; consumed, not re-derived)
 *   env_tier        ← stateMeta.env_tier || env.limits.env_tier || 'dev'  (per-state routes the
 *                     deploy column; F3/DEC-DEV-0194 — absent meta.env_tier ⇒ global limit, 1:1 back-compat)
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
  const envTier = meta.env_tier || (env && env.limits && env.limits.env_tier) || 'dev';
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

// ---- PA bridge (phase 2b) — projecting human gates into pending-actions.md (pure part) ----------
//
// WHY (CONCEPT §4.4): a human-gate prescription is the fabric asking for the OWNER's attention. The
// engine has no daemon, so it mirrors the gate into the canonical `.claude/pending-actions.md` (the
// existing OD7 owner channel), giving the parked line ONE durable, listable surface instead of only
// run.md prose. The owner flips the entry's Status → and the resume is a plain machine tick. These
// helpers are pure (charter/text/prescription in, values out); the FS side lives in the shell.

/** A prescription that needs the owner: an explicit human-gate, or an invoke floored to human-gate. */
function isHumanGatePrescription(p) {
  if (!p) return false;
  if (p.kind === 'human-gate') return true;
  return p.kind === 'run-process' && p.disposition === 'human-gate';
}

/**
 * resume-event for a parked state, derived DETERMINISTICALLY from the charter's on{} keys:
 *   1) the first key starting with "evt:pa." (the canonical PA-resolution event), else
 *   2) "evt:owner.resume" if handled, else
 *   3) "evt:env.up" if handled, else
 *   4) the first on{} key (last-resort; a human-gate state always declares ≥1 handler).
 * This is the ONE event pa-scan ticks when the owner resolves the PA, hence the pa-first ordering:
 * evt:pa.resolved un-parks the awaiting_* gates, evt:owner.resume the escalated gate, evt:env.up the
 * substrate-down retry gate. Returns null only for a handler-less state (never a real human gate).
 */
function deriveResumeEvent(charter, state) {
  const on = (((charter.states || {})[state] || {}).on) || {};
  const keys = Object.keys(on);
  const pa = keys.find((k) => k.indexOf('evt:pa.') === 0);
  if (pa) return pa;
  if (on['evt:owner.resume']) return 'evt:owner.resume';
  if (on['evt:env.up']) return 'evt:env.up';
  return keys[0] || null;
}

/** One-line owner instruction, keyed by parked state (queue_kind is the fallback discriminator). */
function paActionLine(state, queueKind, resumeEvent) {
  switch (state) {
    case 'awaiting_product':
      return 'Resolve the routed product/spec item, then flip this PA to done to resume the line.';
    case 'awaiting_capability':
      return 'Provision the missing capability (tool / MCP / secret), then flip this PA to done to resume.';
    case 'escalated':
      return 'Escalated gate: flip to done to resume the line, or dismiss to handle abort/resume manually.';
    case 'runtime_gate_retry':
      return 'Bring the runtime substrate back up, then flip this PA to done to re-probe readiness.';
    default:
      return `Resolve the ${queueKind || 'gate'} on the parked line, then flip this PA to done (resume: ${resumeEvent}).`;
  }
}

/**
 * Render ONE canonical PA-NNN entry (schema per skills/ecosystem/user-action-tracker.md). The
 * `fabric-instance` / `fabric-state` / `resume-event` marker lines inside **Details** are the
 * machine contract pa-scan parses back — one marker per line, verbatim. Pure (string builder).
 *
 * PAYLOAD BRIDGE (DEC-DEV-0171): when `payload` is present (non-null/undefined) — the ingest slice a
 * charter rule carried via payloadPath (e.g. capability-requests) — a fenced-json **Payload** section
 * is inserted AFTER the textual details and BEFORE the machine markers, so the markers stay verbatim
 * on their own lines and pa-scan still parses them. The serialised JSON is truncated at 2000 chars
 * (with a pointer to events.ndjson for the full copy) so a large payload never bloats the journal —
 * truncation only ever cuts the json body, never a marker line.
 */
function renderFabricPaBlock(id, at, snapshot, queueKind, resumeEvent, payload) {
  const subject = snapshot.subject == null ? '(no subject)' : snapshot.subject;
  const action = paActionLine(snapshot.state, queueKind, resumeEvent);
  const details = [
    `The \`${snapshot.charter_id}\` line for subject \`${subject}\` reached the human gate`,
    `\`${snapshot.state}\` and cannot proceed autonomously (autonomy-policy → human-gate). Once the`,
    'blocking item is resolved, flip **Status:** to `done` and run',
    `\`fabric-engine.cjs pa-scan --at <ISO-now> --tick\` (or tick \`${resumeEvent}\` manually).`,
  ].join('\n');
  const lines = [
    `## PA-${id} — fabric line parked — ${snapshot.state}`,
    '',
    '**Status:** pending',
    `**Created:** ${at}`,
    '**Source:** orchestrator',
    `**Trigger:** fabric ${snapshot.instance}`,
    `**Action required:** ${action}`,
    '',
    '**Details:**',
    '',
    details,
  ];
  if (payload !== undefined && payload !== null) {
    let json = JSON.stringify(payload, null, 2);
    let truncated = false;
    if (json.length > 2000) { json = json.slice(0, 2000); truncated = true; }
    lines.push('', '**Payload (capability-spec / event data):**', '', '```json', json, '```');
    if (truncated) lines.push('… (payload truncated; full copy lives in events.ndjson of the instance)');
  }
  lines.push(
    '',
    `fabric-instance: ${snapshot.instance}`,
    `fabric-state: ${snapshot.state}`,
    `resume-event: ${resumeEvent}`,
    '',
    `**Blocking:** fabric line ${subject} (instance ${snapshot.instance})`,
    '',
  );
  return lines.join('\n');
}

/** Highest PA-NNN in the journal text (−1 if none, so the PA-000 sentinel yields next id = 1). */
function maxPaId(text) {
  let max = -1;
  const re = /^## PA-(\d+)\b/gm;
  let m;
  while ((m = re.exec(text)) !== null) max = Math.max(max, Number(m[1]));
  return max;
}

/**
 * Parse the PA journal into entries carrying the fabric markers (+ current Status). One entry spans
 * from its `## PA-NNN` header to the next such header; markers are matched anywhere inside. Entries
 * without a `fabric-instance` marker come back with instance:null (non-fabric PAs the caller skips).
 * Pure (text → array); the caller decides ready/surfaced from status + on-disk state.
 */
function parsePaEntries(text) {
  const heads = [];
  const re = /^## PA-(\d+)\b/gm;
  let m;
  while ((m = re.exec(text)) !== null) heads.push({ id: Number(m[1]), start: m.index });
  const entries = [];
  for (let i = 0; i < heads.length; i += 1) {
    const end = i + 1 < heads.length ? heads[i + 1].start : text.length;
    const block = text.slice(heads[i].start, end);
    const pick = (rx) => { const r = block.match(rx); return r ? r[1].trim() : null; };
    entries.push({
      pa: `PA-${String(heads[i].id).padStart(3, '0')}`,
      status: ((pick(/^\*\*Status:\*\*\s*(\w+)/m)) || '').toLowerCase() || null,
      instance: pick(/^fabric-instance:\s*(.+)$/m),
      state: pick(/^fabric-state:\s*(.+)$/m),
      event: pick(/^resume-event:\s*(.+)$/m),
    });
  }
  return entries;
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
  const limits = readLimits(root);
  // F2 (DEC-DEV-0193): the effective autonomy policy = product.yaml `autonomy:` (the PROJECT default)
  // OVERLAID by the fabric-local limits.json `policy` (a fabric-scoped override). The project root is
  // three levels up from the fabric root (.claude/orchestrator/fabric → .claude → <project>).
  // loadAutonomyPolicy is fail-tolerant: no product.yaml (or no `autonomy:` block) → {} → the merge is
  // bit-identical to the pre-F2 `readLimits(root).policy || {}` (existing fabric units stay green).
  const projectRoot = path.resolve(root, '..', '..', '..');
  const productPolicy = autonomyPolicy.loadAutonomyPolicy(projectRoot);
  return {
    laneCounts: computeLaneCounts(root, charter, selfId),
    limits,
    policy: Object.assign({}, productPolicy, limits.policy || {}),
  };
}

/**
 * Append a park into the owner-queue, UNLESS an identical entry (same instance + state + kind) already
 * sits there — that dedup makes a repeated park of the same line at the same gate idempotent (ANOM-5,
 * companion to the write-path prune below). Never touches the file when the entry is a duplicate.
 */
function appendOwnerQueue(root, entry) {
  const q = readJsonSafe(ownerQueuePath(root)) || [];
  const dup = q.some((e) => e.instance === entry.instance && e.state === entry.state && e.kind === entry.kind);
  if (dup) return;
  q.push(entry);
  writeJson(ownerQueuePath(root), q);
}

/**
 * Prune the owner-queue on the WRITE-PATH (ANOM-5). Drops (a) entries of THIS instance whose parked
 * `state` no longer matches its currentState (the line has left the gate — including a move to a
 * terminal state) and (b) global orphans: entries of ANY instance that no longer has a state.json
 * (the instance was removed). Writes the file ONLY if something was actually dropped. Called from
 * applyEventFS right after the new snapshot is persisted and BEFORE applyEffects, so a fresh park into
 * the NEW gate is appended AFTER the prune and is never removed by its own tick. Side-effect only —
 * NOT event-sourced (like the PA bridge), so replay stays bit-for-bit (replayInstance never routes
 * through the shell). This is the write-path counterpart of the read-only reconcileOwnerQueue.
 */
function dequeueOwnerEntries(root, instanceId, currentState) {
  const q = readJsonSafe(ownerQueuePath(root));
  if (!Array.isArray(q) || q.length === 0) return;
  const kept = q.filter((e) => {
    if (e.instance === instanceId) return e.state === currentState;   // (a) this line left the gate
    return fs.existsSync(statePath(root, e.instance));                // (b) global orphan (instance gone)
  });
  if (kept.length !== q.length) writeJson(ownerQueuePath(root), kept);
}

/**
 * Read-only liveness split of the owner-queue for `status` (ANOM-5). An entry is LIVE when its
 * instance still exists AND is still parked in the entry's state; otherwise it is STALE, tagged with a
 * reason ('instance gone' | 'left state <s>'). Reads FS but WRITES NOTHING — `status` is invoked by the
 * SessionStart hook and must stay side-effect-free; the actual self-pruning is the write-path's job
 * (dequeueOwnerEntries). Returns { live, stale }.
 */
function reconcileOwnerQueue(root) {
  const q = readJsonSafe(ownerQueuePath(root)) || [];
  const live = [];
  const stale = [];
  for (const entry of q) {
    const snap = readJsonSafe(statePath(root, entry.instance));
    if (!snap) { stale.push(Object.assign({}, entry, { reason: 'instance gone' })); continue; }
    if (snap.state !== entry.state) { stale.push(Object.assign({}, entry, { reason: `left state ${entry.state}` })); continue; }
    live.push(entry);
  }
  return { live, stale };
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

// ---- PA bridge (phase 2b) — FS side -------------------------------------------------------------

/** Canonical PA journal: <project>/.claude/pending-actions.md — two levels up from the fabric root
 *  (deploy layout .claude/orchestrator/fabric → .claude/pending-actions.md). `explicit` (--pa-file)
 *  overrides it (tests + non-standard layouts). */
function defaultPaFile(root) { return path.resolve(root, '..', '..', 'pending-actions.md'); }
function paFilePath(root, explicit) { return explicit ? path.resolve(explicit) : defaultPaFile(root); }

/** Run-ledger summary file for a fabric root — the sibling `runs/` dir in the deploy layout
 *  (.claude/orchestrator/fabric → .claude/orchestrator/runs/ledger.ndjson, run-ledger.cjs's own
 *  default). `explicit` (--ledger-file) overrides it (tests + non-standard layouts). */
function defaultLedgerFile(root) { return path.resolve(root, '..', 'runs', 'ledger.ndjson'); }
function ledgerFilePath(root, explicit) { return explicit ? path.resolve(explicit) : defaultLedgerFile(root); }

/** True iff ledger.ndjson carries a line whose run_id === runId (unparseable lines are skipped;
 *  a missing/unreadable ledger has NO runs — the guard fails closed). */
function ledgerHasRun(file, runId) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (_e) { return false; }
  return raw.split('\n').some((l) => {
    try { return JSON.parse(l).run_id === runId; } catch (_e) { return false; }
  });
}

/**
 * Create the journal with header + PA-000 sentinel if absent (mirrors bootstrap Step 6c so the
 * counter starts at PA-001). In a deployed project bootstrap already made this file; create-if-
 * absent only fires in fresh/test contexts. The sentinel is dismissed and load-bearing — its
 * HTML comment warns against deletion — so PA-NNN never collides at 0.
 */
function ensurePaFile(paFile, at) {
  if (fs.existsSync(paFile)) return;
  fs.mkdirSync(path.dirname(paFile), { recursive: true });
  fs.writeFileSync(paFile, [
    '# Pending User Actions',
    '',
    '> Ecosystem-wide journal of actions that only the user can do. Auto-managed by ecosystem',
    '> skills + hooks (the Process Fabric engine projects human gates here — phase 2b).',
    '> Status workflow: pending → done | dismissed. Manual edits are fine; keep schema intact.',
    '',
    '<!-- PA-000 sentinel ensures counter starts at 1 — do not delete -->',
    '',
    '## PA-000 — Sentinel (do not delete)',
    '',
    '**Status:** dismissed',
    `**Created:** ${at}`,
    '**Source:** ecosystem',
    '**Trigger:** fabric-engine (auto-init)',
    '**Action required:** none (placeholder so PA-NNN counter starts at 1)',
    '',
    '**Blocking:** none.',
    '',
  ].join('\n'));
}

/**
 * Tail-append a canonical PA-NNN entry for a human-gate `snapshot`, UNLESS an identical PENDING
 * entry already exists (same fabric-instance + fabric-state) — that dedup makes a repeated ingest/
 * tick that re-parks the same line at the same gate idempotent. Never mutates existing entries
 * (Status is the owner's to flip). `payload` (DEC-DEV-0171, optional) is the ingest slice carried by
 * the parking event — rendered as a fenced-json **Payload** section. Returns { appended, pa } or
 * { appended:false, deduped }.
 */
function appendFabricPa(paFile, charter, snapshot, at, payload) {
  const resumeEvent = deriveResumeEvent(charter, snapshot.state);
  if (!resumeEvent) return { appended: false, reason: 'no resume-event on state' };
  const queueKind = (((charter.states || {})[snapshot.state] || {}).meta || {}).queue_kind || 'gate';

  ensurePaFile(paFile, at);
  const text = fs.readFileSync(paFile, 'utf8');
  const dup = parsePaEntries(text).some(
    (e) => e.instance === snapshot.instance && e.state === snapshot.state && e.status === 'pending');
  if (dup) return { appended: false, deduped: true };

  const id = String(maxPaId(text) + 1).padStart(3, '0');
  const block = renderFabricPaBlock(id, at, snapshot, queueKind, resumeEvent, payload);
  fs.appendFileSync(paFile, (text.endsWith('\n') ? '\n' : '\n\n') + block);
  return { appended: true, pa: `PA-${id}` };
}

/** Project a human-gate prescription into the PA journal. Side-effect ONLY — not event-sourced,
 *  so `replay` (which never calls the shell) reproduces state.json bit-for-bit regardless. `payload`
 *  (DEC-DEV-0171) is the parking event's ingest slice, forwarded into the rendered PA-record. */
function maybeAppendFabricPa(paFile, charter, snapshot, at, prescription, payload) {
  if (!isHumanGatePrescription(prescription)) return null;
  return appendFabricPa(paFile, charter, snapshot, at, payload);
}

/**
 * Apply ONE event to an instance on disk. Rejected / guard-failed events are NO-OPS: reported in
 * the return value but NOT persisted (see the determinism contract). Returns a report object.
 *
 * `paFile` (raw --pa-file value or undefined) is resolved against `root`: when an APPLIED tick lands
 * the instance in a human-gate state, the shell mirrors that gate into pending-actions.md (phase 2b).
 * init never reaches here (it writes the initial handoff_ready snapshot directly), so the initial
 * human gate is not spammed — the dispatcher immediately ticks evt:line.start out of it.
 *
 * `forcedManual` (a PA-referencing reason string, set + validated ONLY by cmdTick's DEF-3 bracket
 * guard — it must carry a PA-id that already exists in pending-actions.md) stamps a
 * `forced-manual: <reason>` marker into the event's why[] so the deliberate bare-tick bypass is
 * audited IN the events.ndjson record (not just on stdout). why[] is not read during replay — the
 * rebuilt snapshot ignores it — so the marker is replay-neutral (state.json stays bit-for-bit).
 *
 * As part of persisting an applied transition the shell also self-prunes the owner-queue
 * (dequeueOwnerEntries, ANOM-5): the just-vacated gate's entry for this line, plus any global orphans.
 */
function applyEventFS(root, charter, id, eventName, payload, at, runId, autonomyOverride, paFile, forcedManual) {
  const snap = readJsonSafe(statePath(root, id));
  if (!snap) throw new Error(`no such instance: ${id}`);
  const env = shellEnv(root, charter, id);
  if (autonomyOverride) env.override = autonomyOverride;
  const { next, effects, why } = transition(charter, snap, eventName, payload, env);
  if (forcedManual) why.push(`forced-manual: ${forcedManual}`);
  const applied = next.state !== snap.state || next.seq !== snap.seq;

  if (!applied) {
    return { instance: id, event: eventName, from: snap.state, to: snap.state, applied: false, why, effects, prescription: prescribe(charter, snap, env) };
  }

  next.updated_at = at || snap.updated_at;
  writeJson(statePath(root, id), next);
  // ANOM-5: self-prune the owner-queue on the write-path BEFORE applyEffects re-parks the new gate —
  // drop this line's stale gate entries (it just left the gate) + any global orphans. Ordered here so
  // the fresh park below survives its own tick.
  dequeueOwnerEntries(root, id, next.state);
  const evRecord = { seq: next.seq, at: at || null, event: eventName, from: snap.state, to: next.state, why, effects };
  if (payload !== undefined && payload !== null) evRecord.payload = payload;
  if (runId) evRecord.run_id = runId;
  appendEvent(root, id, evRecord);
  applyEffects(root, next, at, effects);

  const prescription = prescribe(charter, next, env);
  // DEC-DEV-0171: the parking event's payload (an ingest payloadPath slice) rides into the PA-record.
  const pa = maybeAppendFabricPa(paFilePath(root, paFile), charter, next, at, prescription, payload);

  const report = { instance: id, event: eventName, from: snap.state, to: next.state, applied: true, why, effects, prescription };
  if (pa && pa.appended) report.pa = pa.pa;
  return report;
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
      case '--force-manual': a.forceManual = next(); break;
      case '--base-root': a.baseRoot = next(); break;
      case '--pa-file': a.paFile = next(); break;
      case '--ledger-file': a.ledgerFile = next(); break;
      case '--tick': a.tick = true; break;
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
    'ingest --instance <id> --process <name> (--result <json>|--result-file <p>) --at <ISO> --run-id <r>',
    '       [--charter <f>] [--ledger-file <p>] [--force-manual <reason>]',
    '  → materialise the result into ≤1 event, then tick it. Idempotent: a seen --run-id is a no-op.',
    '    DEF-OD7-2 bracket guard: --run-id is REQUIRED and must exist in the run-ledger',
    '    (default <fabric-root>/../runs/ledger.ndjson; override --ledger-file) — a result from a run',
    '    the ledger never saw (raw Workflow, no bracket) is refused; --force-manual "<PA-NNN: reason>"',
    '    consciously overrides (audit-stamped, PA must already exist in pending-actions.md).',
    '    A charter ingest rule may carry payloadPath (dot-path): the resolved slice of the result rides',
    '    the emitted event into events.ndjson and, if the tick parks a human gate, into the PA-record',
    '    (capability-spec / event data the owner or Integrator provisions before resuming the line).',
    'tick   --instance <id> --event <evt:…> [--payload <json>] --at <ISO> [--charter <f>] [--force-manual <reason>]',
    '  → transition + persist + emit the next prescription (stdout JSON). DEF-3 guard: a process-RESULT',
    '    event (an ingest-emit of the state\'s invoked process) is REFUSED bare — route it through the',
    '    bracket + `ingest --run-id`. ANOM-OD7-2 guard: an `evt:owner.*` OWNER-decision event is also',
    '    REFUSED bare — the sanctioned path is the owner\'s PA flip + `pa-scan --tick`. For both,',
    '    --force-manual "<PA-NNN: reason>" consciously overrides (audit-stamped; the reason MUST',
    '    reference a PA entry that already exists in pending-actions.md).',
    'status [--all] [--base-root <dir>]   → instances, states, prioritised LIVE owner-queue plus',
    '    owner_queue_stale. Read-only: staleness is reported, NOT pruned (the write-path self-prunes).',
    'replay --instance <id> [--charter <f>]   → rebuild state from events; diff vs state.json (exit 2 on mismatch).',
    'pa-scan --at <ISO> [--pa-file <p>] [--tick] [--base-root <dir>] [--charter <f>]',
    '  → resolution half of the PA bridge: find fabric PA entries the owner set to done and, with',
    '    --tick, fire their resume-event to un-park the line; dismissed entries are only surfaced.',
    '',
    'init/ingest/tick also take --autonomy <L0|L1|L2|L3> — per-invocation override for the emitted',
    'prescription (F3: L2 → consilium-gate on staging/prod; L3 → auto on staging, consilium-gate on prod; floor never crossable, invalid levels ignored loudly).',
    'tick/ingest/pa-scan take --pa-file <path> to override the canonical .claude/pending-actions.md',
    'target — an APPLIED tick into a human-gate state mirrors the gate there as a PA-NNN (phase 2b).',
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

/**
 * Shared --force-manual escape validation (judge rec #4; reused by BOTH tick guards and the ingest
 * bracket-guard, DEC-DEV-0174): the escape must be dearer than the honest path. Requires the flag to
 * be PRESENT with a non-empty reason, the reason to reference a PA-id (/PA-\d{3,}/), and that PA to
 * already exist in pending-actions.md. `refusalLines` is the guard-specific explanation printed when
 * the flag is absent. Returns the validated reason (audit-stamped into the event's why[] by
 * applyEventFS); exits 2 on any failure.
 */
function requireForceManual(args, root, refusalLines) {
  const forcedPresent = Object.prototype.hasOwnProperty.call(args, 'forceManual');
  const reason = typeof args.forceManual === 'string' ? args.forceManual.trim() : '';
  if (!forcedPresent) {
    console.error(refusalLines.join('\n'));
    process.exit(2);
  }
  if (!reason) {
    console.error('ERROR: --force-manual requires a non-empty "<reason>" (audit trail for the bypassed guard)');
    process.exit(2);
  }
  // rec #4: the reason must reference a PA-id AND that PA must exist in pending-actions.md.
  const paRefMatch = reason.match(/PA-(\d{3,})/);
  if (!paRefMatch) {
    console.error([
      `ERROR: --force-manual reason must reference a PA-id (matching /PA-\\d{3,}/), got "${reason}".`,
      '       First record the manual intervention as a pending-action in pending-actions.md,',
      '       then retry:  --force-manual "PA-NNN: <why>".',
    ].join('\n'));
    process.exit(2);
  }
  const paRef = paRefMatch[0];
  const paNum = Number(paRefMatch[1]);
  const paPath = paFilePath(root, args.paFile);
  let paText = null;
  try { paText = fs.readFileSync(paPath, 'utf8'); } catch (_e) { paText = null; }
  const paHeaderNums = new Set();
  if (paText !== null) {
    const paHeadRe = /^## PA-(\d+)\b/gm;
    let hm;
    while ((hm = paHeadRe.exec(paText)) !== null) paHeaderNums.add(Number(hm[1]));
  }
  if (!paHeaderNums.has(paNum)) {
    console.error([
      `ERROR: --force-manual references ${paRef}, but it was not found in ${paPath}.`,
      '       Record the manual intervention there first as a PA entry (## PA-NNN — …,',
      '       **Status:** pending), then retry:  --force-manual "PA-NNN: <why>".',
    ].join('\n'));
    process.exit(2);
  }
  return reason;
}

function cmdTick(args) {
  if (!args.instance) { console.error('ERROR: tick needs --instance <id>'); process.exit(2); }
  if (!args.event) { console.error('ERROR: tick needs --event <evt:…>'); process.exit(2); }
  requireAt(args.at);
  const root = fabricRoot(args.baseRoot);
  const snap = readJsonSafe(statePath(root, args.instance));
  if (!snap) { console.error(`ERROR: no such instance: ${args.instance}`); process.exit(2); }
  const charter = loadCharter(args.charter, snap.charter_id);

  // DEF-3 bracket guard: a PROCESS RESULT event — one the current state's invoked process emits via
  // charter.ingest — must NOT be tick'd bare. Its contract (run.md kind:run-process) is a full bracket
  // (run-ledger start → run the process → run-ledger finish → `fabric-engine ingest --run-id`, which
  // materialises the result into this very event). A bare `tick` skips the run-ledger and the Workflow.
  // Refuse it unless the operator consciously forces a manual run with an audited reason that
  // REFERENCES a real pending-action (judge rec #4, validated by requireForceManual).
  // NOTE: pa-scan reaches applyEventFS through the sanctioned path (a PA the OWNER flipped), and
  // replay never routes through here (replayInstance rebuilds straight from events.ndjson). cmdIngest
  // carries its own twin bracket-guard on the run-ledger side (DEF-OD7-2, DEC-DEV-0174).
  let forcedManual = null;
  const invoke = ((charter.states || {})[snap.state] || {}).invoke;
  const invoked = invoke && invoke.process;
  let ingestMapped = false;
  if (invoked) {
    const rules = (charter.ingest || {})[invoked];
    const emitted = Array.isArray(rules) ? rules.map((r) => r.emit).filter(Boolean) : [];
    ingestMapped = emitted.indexOf(args.event) !== -1;
  }
  if (ingestMapped) {
    forcedManual = requireForceManual(args, root, [
      `ERROR: event "${args.event}" is an ingest-mapped result of process "${invoked}"`,
      `       (invoked by state "${snap.state}") — it must NOT be tick'd bare (DEF-3 guard).`,
      '       A process result enters the fabric through the full bracket:',
      `         run-ledger start → run "${invoked}" → run-ledger finish → fabric-engine ingest --run-id <r>`,
      '       (ingest materialises the result into this event itself). Bare tick bypasses the',
      '       run-ledger and the Workflow, so it is refused. For a deliberate manual run, first record',
      '       the intervention as a PA entry in pending-actions.md, then pass',
      '         --force-manual "PA-NNN: <reason>"   (the reason is stamped into the event as an audit marker).',
    ]);
  } else if (/^evt:owner\./.test(args.event)) {
    // ANOM-OD7-2 guard (DEC-DEV-0174): an `evt:owner.*` event is an OWNER-decision — the executor
    // must not project it on the owner's behalf (the OD7 live run had the executor tick
    // evt:owner.abort itself, translating an owner decision it merely witnessed). The sanctioned
    // path is an owner ACT: the owner flips the gate's PA entry and pa-scan --tick fires the
    // resume-event. A manual owner.* tick must point at the PA that RECORDS the owner's decision.
    forcedManual = requireForceManual(args, root, [
      `ERROR: event "${args.event}" is an OWNER-decision event — the executor must not tick it`,
      '       on the owner\'s behalf (ANOM-OD7-2 guard). The sanctioned path is an owner act:',
      '       the owner flips the gate\'s PA entry to done, then `pa-scan --tick` fires the',
      '       resume-event. For a manual owner decision (abort / close / out-of-band resume),',
      '       first record the owner\'s decision as/in a PA entry in pending-actions.md, then pass',
      '         --force-manual "PA-NNN: <owner decision>"   (audit-stamped into the event).',
    ]);
  }

  const payload = readPayload(args);
  const report = applyEventFS(root, charter, args.instance, args.event, payload, args.at, args.runId, args.autonomy, args.paFile, forcedManual);
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

  // Idempotency FIRST: a run-id already present in the log ⇒ skip the whole ingest (no-op, exit 0).
  // Ordered before the bracket-guard on purpose: a repeat of an already-recorded run (including a
  // previously force-manual'd one) stays a clean no-op instead of re-litigating the guard.
  const runId = args.runId || null;
  if (runId) {
    const seen = readEvents(root, args.instance).some((ev) => ev.run_id === runId);
    if (seen) { out({ instance: args.instance, process: args.process, run_id: runId, deduped: true, emitted: [], ticks: [] }); process.exit(0); }
  }

  // DEF-OD7-2 bracket guard (DEC-DEV-0174) — the ingest-side twin of tick's DEF-3 guard. The OD7
  // live run (DEC-DEV-0173) proved the hole: a P5 launched as a raw Workflow handed ingest a run_id
  // the run-ledger had never seen (wf_c6a17829-426) and it was ACCEPTED — the bracket contract
  // (run-ledger start → run → finish → ingest --run-id) was enforceable on the tick side only.
  // A result now enters the fabric only with a ledger-backed run_id; --force-manual "PA-NNN: …" is
  // the audited escape (same rec#4 contract as tick — the PA must already exist).
  const ledgerFile = ledgerFilePath(root, args.ledgerFile);
  let forcedManual = null;
  if (!runId || !ledgerHasRun(ledgerFile, runId)) {
    forcedManual = requireForceManual(args, root, [
      runId
        ? `ERROR: --run-id "${runId}" is not in the run-ledger (${ledgerFile}) — ingest refused (DEF-OD7-2 bracket guard).`
        : `ERROR: ingest without --run-id — refused (DEF-OD7-2 bracket guard; ledger: ${ledgerFile}).`,
      '       A process result enters the fabric only through the full bracket:',
      '         run-ledger start → run the process → run-ledger finish → fabric-engine ingest --run-id <r>',
      '       A run_id the run-ledger never saw means the process ran OUTSIDE the bracket (e.g. a raw',
      '       Workflow invocation) — route the run through the dispatcher so the bracket is cut.',
      '       For a deliberate manual ingest, first record the intervention as a PA entry in',
      '       pending-actions.md, then pass  --force-manual "PA-NNN: <reason>"   (audit-stamped).',
    ]);
  }

  const result = readResult(args);
  // DEC-DEV-0171: ingestEmits carries an optional payloadPath slice per emitted event; that payload is
  // threaded into applyEventFS (→ events.ndjson + the human-gate PA-record). `emitted` in the output
  // stays an array of event-NAME strings (bit-for-bit the pre-0171 CLI contract).
  const emits = ingestEmits(charter, args.process, result);
  const ticks = [];
  for (const em of emits) {
    ticks.push(applyEventFS(root, charter, args.instance, em.event, em.payload, args.at, runId, args.autonomy, args.paFile, forcedManual));
  }
  out({ instance: args.instance, process: args.process, run_id: runId, deduped: false, emitted: emits.map((e) => e.event), ticks });
  process.exit(0);
}

function cmdStatus(args) {
  const root = fabricRoot(args.baseRoot);
  const instances = listInstances(root).map((id) => {
    const s = readJsonSafe(statePath(root, id)) || {};
    return { instance: id, state: s.state, charter_id: s.charter_id, seq: s.seq, subject: s.subject };
  });
  // Read-only liveness split (ANOM-5): status NEVER writes the queue (SessionStart-hook contract).
  // Live entries are prioritised as before; stale ones are surfaced (never hidden) under owner_queue_stale.
  const { live, stale } = reconcileOwnerQueue(root);
  const queue = live
    .slice()
    .sort((a, b) => (a.priority - b.priority) || String(a.at).localeCompare(String(b.at)));
  out({ instances, owner_queue: queue, owner_queue_stale: stale, limits: readLimits(root) });
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

/**
 * pa-scan — the RESOLUTION half of the PA bridge (phase 2b). Reads pending-actions.md, finds the
 * fabric-marked entries the owner has acted on, and (with --tick) resumes the corresponding parked
 * lines by firing their recorded resume-event — closing the G03/G04 feedback loop deterministically.
 *
 *   Status done + instance still parked in fabric-state + charter still handles resume-event → ready.
 *   Status dismissed → surfaced (never auto-ticked — abort vs resume is the owner's call).
 *   instance gone / already left the state → skipped (idempotency of a repeated pa-scan).
 * Each instance's charter is resolved by its own charter_id (multi-charter safe); --charter is a
 * fallback path. JSON {scanned, ready, surfaced, ticked}; exit 0 (or 2 on a bad --at).
 */
function cmdPaScan(args) {
  requireAt(args.at);
  const root = fabricRoot(args.baseRoot);
  const paFile = paFilePath(root, args.paFile);
  let text = '';
  try { text = fs.readFileSync(paFile, 'utf8'); } catch (_e) { text = ''; }
  const entries = parsePaEntries(text).filter((e) => e.instance && e.state && e.event);

  const resolveCharter = (charterId) => {
    try { return loadCharter(null, charterId); }
    catch (_e) { return loadCharter(args.charter, null); }
  };

  const scanned = [];
  const ready = [];
  const surfaced = [];
  for (const e of entries) {
    scanned.push({ pa: e.pa, instance: e.instance, state: e.state, event: e.event, status: e.status });
    if (e.status === 'dismissed') {
      surfaced.push({ pa: e.pa, instance: e.instance, state: e.state,
        reason: 'dismissed — resolve manually (abort vs resume — за владельцем)' });
      continue;
    }
    if (e.status !== 'done') continue;                 // pending / other → not actionable yet
    const snap = readJsonSafe(statePath(root, e.instance));
    if (!snap) continue;                               // instance gone → skip
    if (snap.state !== e.state) continue;              // already left the gate → idempotent skip
    let charter;
    try { charter = resolveCharter(snap.charter_id); } catch (_e2) { continue; }
    const on = (((charter.states || {})[snap.state] || {}).on) || {};
    if (!Object.prototype.hasOwnProperty.call(on, e.event)) continue; // charter no longer resumes here
    ready.push({ pa: e.pa, instance: e.instance, state: e.state, event: e.event });
  }

  const ticked = [];
  if (args.tick) {
    for (const r of ready) {
      const snap = readJsonSafe(statePath(root, r.instance));
      if (!snap) continue;
      let charter;
      try { charter = resolveCharter(snap.charter_id); } catch (_e) { continue; }
      const rep = applyEventFS(root, charter, r.instance, r.event, undefined, args.at, undefined, args.autonomy, args.paFile);
      ticked.push({ pa: r.pa, instance: r.instance, event: r.event, from: rep.from, to: rep.to, applied: rep.applied, prescription: rep.prescription });
    }
  }
  out({ scanned, ready, surfaced, ticked });
  process.exit(0);
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
      case 'pa-scan': return cmdPaScan(args);
      default:
        console.error(`ERROR: unknown subcommand "${sub}" (expected init | ingest | tick | status | replay | pa-scan)`);
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
  ingestEmits,
  applyIngest,
  resolveDisposition,
  prescribe,
  initialSnapshot,
  // PA bridge (phase 2b) — pure helpers
  isHumanGatePrescription,
  deriveResumeEvent,
  paActionLine,
  renderFabricPaBlock,
  maxPaId,
  parsePaEntries,
  // shell (exported for integration/tests)
  fabricRoot,
  loadCharter,
  computeLaneCounts,
  applyEventFS,
  replayInstance,
  paFilePath,
  ledgerFilePath,
  ledgerHasRun,
  appendFabricPa,
  maybeAppendFabricPa,
  appendOwnerQueue,
  dequeueOwnerEntries,
  reconcileOwnerQueue,
};
