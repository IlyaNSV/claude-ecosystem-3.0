'use strict';
/**
 * autonomy-policy.cjs — F1 SKELETON of the deterministic autonomy-disposition resolver
 * (Autonomous Pipeline Vision, Epic F / F1; kickoff DEC-DEV-0145 decision «и»;
 * contract SSOT: dev/AUTONOMY_POLICY_F1_CONTRACT.md).
 *
 * WHAT THIS IS (and is not):
 *   - The pure-function resolver of the vision §Epic F precedence chain:
 *       floor (non-crossable) > per-invocation override > per-process pin
 *       > project default_level > ecosystem built-in (L1)
 *     resolve(operation_class, risk_tier, env_tier, policy, override)
 *       → { disposition ∈ {auto | human-gate | block}, level_applied, floor_hit, why[] }
 *   - F1 implements L0/L1 ONLY. L2/L3 (consilium-gate + confidence threshold +
 *     human-fallback) are F2 — a requested L2/L3 here DEGRADES to L1 semantics with a
 *     loud why-entry (safe-fallback: never a blind auto in a level that is not built).
 *   - NOT WIRED into any process or gate (kickoff «и»: wiring needs a field-контракт
 *     sweep with the orchestrator track first — the reason F1 was deferred in 0136).
 *     Consequently there is no deployment mapping for this file yet; its home is the
 *     repo-level lib/ (the vision's literal path) until the F2 wiring decides the
 *     deployed location. Same-inputs → same-disposition; the returned why[] chain IS
 *     the audit-trail seed (persisting it is wiring, not resolving).
 *
 * CONSUMES, NEVER RE-DERIVES (wave hard-constraint #3, dev/ECOSYSTEM_VISION_BATCH_3.md §0):
 *   - risk_tier ∈ {HIGH, LOW} — the OUTPUT of orchestrator/lib/gate-risk-classifier.cjs
 *     (classifyTask().tier). This lib never inspects task text or markers itself —
 *     two diverging gate-policy mechanisms is exactly what the constraint forbids.
 *   - substrate readiness ∈ {READY, DEGRADED, ENV_NOT_READY} — the OUTPUT of
 *     orchestrator/lib/env-readiness.cjs. Consumed via applyReadinessGuard() below,
 *     which only ever DOWNGRADES a disposition (mirror of env-readiness's own rail:
 *     never upgrade toward GO/auto).
 *
 * THE SINGLE LLM-JUDGMENT BOUNDARY (vision §Epic F): the content of a consilium verdict
 * (F2). The disposition DECISION is code — this file.
 *
 * Node stdlib only, zero deps, no I/O — require()-able from anywhere, unit-tested by
 * tests/orchestrator/autonomy-policy.test.cjs.
 */

const POLICY_SCHEMA_VERSION = 1;

// ---- enums (vision §Epic F, locked 2026-06-23) ------------------------------------------------

/** Autonomy ladder. F1 implements L0/L1; L2/L3 recognized but degrade to L1 (F2 builds them). */
const LEVELS = ['L0', 'L1', 'L2', 'L3'];
const LEVEL_ORDER = { L0: 0, L1: 1, L2: 2, L3: 3 };
const BUILT_IN_DEFAULT_LEVEL = 'L1'; // ecosystem built-in (vision: дефолт новых проектов = L1)

/** Dispositions F1 can emit. `consilium-gate` exists in the vision enum but is F2-only —
 * this skeleton NEVER emits it (no consilium machinery to honor it would be a silent gap). */
const DISPOSITIONS = ['auto', 'human-gate', 'block'];

/**
 * FLOOR (предохранитель необратимости) — operation classes that are ALWAYS human-gated,
 * regardless of level and override, until the floor itself is reconfigured by an explicit,
 * separate opt-in (NOT buildable via the ordinary policy object — resolve() rejects a
 * policy that tries to shrink it; see FLOOR_LOCKED below). Vision default, locked 2026-06-23.
 */
const DEFAULT_FLOOR = ['prod_deploy', 'destructive', 'spend_money', 'provision_real_secret'];

/** F1 hard rail: the floor is NOT policy-configurable in this skeleton. A policy.floor that
 * omits a default entry is ignored (with a why-entry) — shrinking the floor is a separate
 * explicit opt-in mechanism that F2+ may design; it must never ride in on an ordinary config. */
const FLOOR_LOCKED = true;

const ENV_TIERS = ['dev', 'staging', 'prod'];

// ---- level resolution (the precedence chain) ---------------------------------------------------

function isLevel(v) {
  return typeof v === 'string' && LEVELS.indexOf(v) !== -1;
}

/**
 * Resolve the EFFECTIVE autonomy level for a process from the precedence chain
 * (floor is handled separately in resolve() — it is not a level, it is a non-crossable gate):
 *
 *   per-invocation override  — raises or lowers the session default…
 *   per-process pin          — …but a policy.process_overrides pin CAPS the level
 *                              (vision: «пин: не выше L0 даже в L3-сессии» — a pin is a
 *                              ceiling, never a promoter)
 *   project default_level    — policy.default_level
 *   built-in                 — L1
 *
 * Returns { level, why: [] }. Invalid inputs are ignored with a why-entry (degrade loud,
 * never throw — a malformed config must not change dispositions silently).
 */
function resolveLevel(policy, override, processName) {
  const why = [];
  const p = policy || {};

  let level = BUILT_IN_DEFAULT_LEVEL;
  why.push(`built-in default ${BUILT_IN_DEFAULT_LEVEL}`);

  if (p.default_level !== undefined) {
    if (isLevel(p.default_level)) {
      level = p.default_level;
      why.push(`policy.default_level ${p.default_level}`);
    } else {
      why.push(`policy.default_level "${p.default_level}" is not a valid level (${LEVELS.join('/')}) — ignored`);
    }
  }

  if (override !== undefined && override !== null) {
    if (isLevel(override)) {
      level = override;
      why.push(`per-invocation override ${override}`);
    } else {
      why.push(`override "${override}" is not a valid level — ignored`);
    }
  }

  // Per-process pin is a CEILING: it caps the effective level, it never raises it.
  const pins = p.process_overrides || {};
  if (processName && Object.prototype.hasOwnProperty.call(pins, processName)) {
    const pin = pins[processName];
    if (isLevel(pin)) {
      if (LEVEL_ORDER[pin] < LEVEL_ORDER[level]) {
        why.push(`process pin ${processName}:${pin} caps ${level} → ${pin}`);
        level = pin;
      } else {
        why.push(`process pin ${processName}:${pin} does not raise ${level} (a pin is a ceiling, never a promoter)`);
      }
    } else {
      why.push(`process pin ${processName}:"${pin}" is not a valid level — ignored`);
    }
  }

  // F1 implements L0/L1 only — L2/L3 degrade to L1 semantics, LOUDLY (safe-fallback:
  // an unbuilt level must not silently mean "more auto"; F2 builds the consilium gate).
  if (level === 'L2' || level === 'L3') {
    why.push(`${level} requested but the consilium gate is F2 (not built) — degraded to L1 semantics (human-fallback, never blind auto)`);
    level = 'L1';
  }

  return { level, why };
}

// ---- the resolver -------------------------------------------------------------------------------

/**
 * resolve(operation_class, risk_tier, env_tier, policy, override) → disposition envelope.
 *
 *   operation_class  string — the operation's class (floor classes: DEFAULT_FLOOR; anything
 *                    else is an ordinary operation). Unknown/absent → treated ordinary, noted.
 *   risk_tier        'HIGH' | 'LOW' — CONSUMED from gate-risk-classifier.classifyTask().tier.
 *                    Absent/unknown → conservatively 'HIGH' (a missing classification must
 *                    not widen autonomy), noted in why[].
 *   env_tier         'dev' | 'staging' | 'prod' — the TARGET environment of the operation.
 *                    Absent/unknown → conservatively 'prod', noted.
 *   policy           { default_level?, process_overrides?, process? } — the project config
 *                    slice (vision: .claude/product.yaml `autonomy:`). `process` names the
 *                    invoking process for pin lookup (or pass opts via policy.process).
 *   override         'L0'..'L3' | undefined — the per-invocation --autonomy= flag.
 *
 * → { disposition: 'auto'|'human-gate'|'block', level_applied, floor_hit, why: [string] }
 *
 * Disposition matrix (F1, L0/L1 — the contract doc carries the table with rationale):
 *   floor class                → human-gate, always (floor_hit: true)
 *   L0: auto  iff LOW × dev    (человек на всех 🟠+🔴; auto только на заведомо-зелёном)
 *   L1: auto  iff dev          (человек на необратимом/staging+; auto на обратимом/dev —
 *                               irreversibility beyond env is carried by the floor classes)
 *   staging/prod               → human-gate at both levels (F1 has no consilium to gate them)
 *
 * Pure: same inputs → same disposition. The why[] chain is replayable (audit-trail seed).
 */
function resolve(operationClass, riskTier, envTier, policy, override) {
  const why = [];
  const p = policy || {};

  // ---- floor: non-crossable, checked FIRST — no level or override crosses it -----------------
  const floor = DEFAULT_FLOOR.slice();
  if (FLOOR_LOCKED && p.floor !== undefined) {
    why.push('policy.floor present but the F1 floor is LOCKED to the built-in default — shrinking/replacing the floor is a separate explicit opt-in (not an ordinary config key); ignored');
  }
  const opClass = typeof operationClass === 'string' && operationClass.trim() ? operationClass.trim() : '';
  if (!opClass) why.push('operation_class absent — treated as an ordinary (non-floor) operation');
  if (opClass && floor.indexOf(opClass) !== -1) {
    return {
      disposition: 'human-gate',
      level_applied: null,
      floor_hit: true,
      why: why.concat([`operation_class "${opClass}" is on the floor (${floor.join(', ')}) — ALWAYS human, regardless of level/override`]),
    };
  }

  // ---- inputs, consumed not re-derived; absent → conservative --------------------------------
  let tier = riskTier;
  if (tier !== 'HIGH' && tier !== 'LOW') {
    why.push(`risk_tier "${tier}" is not HIGH/LOW (expected gate-risk-classifier output) — conservatively HIGH`);
    tier = 'HIGH';
  }
  let env = envTier;
  if (ENV_TIERS.indexOf(env) === -1) {
    why.push(`env_tier "${env}" is not ${ENV_TIERS.join('/')} — conservatively prod`);
    env = 'prod';
  }

  // ---- effective level via the precedence chain ----------------------------------------------
  const lv = resolveLevel(p, override, p.process);
  const level = lv.level;
  const whyAll = why.concat(lv.why);

  // ---- the F1 disposition matrix (L0/L1) ------------------------------------------------------
  let disposition;
  if (env !== 'dev') {
    disposition = 'human-gate';
    whyAll.push(`${level} × ${env}: staging+ is human-gated in F1 (no consilium gate below F2)`);
  } else if (level === 'L0') {
    disposition = tier === 'LOW' ? 'auto' : 'human-gate';
    whyAll.push(`L0 × dev × ${tier}: auto only on LOW (человек на всех 🟠+🔴)`);
  } else {
    // L1 (the built-in default): auto on dev; irreversible operation classes are already
    // caught by the floor above, so a non-floor dev operation is the reversible case.
    disposition = 'auto';
    whyAll.push(`L1 × dev × ${tier}: auto on the reversible/dev side (floor classes already human-gated)`);
  }

  return { disposition, level_applied: level, floor_hit: false, why: whyAll };
}

// ---- readiness guard (consumes env-readiness.cjs, never re-probes) ------------------------------

/**
 * Downgrade a resolved disposition by the substrate-readiness verdict CONSUMED from
 * env-readiness.cjs ({READY, DEGRADED, ENV_NOT_READY}). Mirrors that lib's own rail:
 * only ever downgrades, never upgrades toward auto.
 *
 *   READY          → unchanged
 *   DEGRADED       → auto → human-gate (an undisclosed substrate must not widen autonomy);
 *                    human-gate/block unchanged
 *   ENV_NOT_READY  → block (the gate cannot judge — resolving to auto OR human-gate would
 *                    pretend it could)
 *   unknown value  → treated as DEGRADED, noted (conservative)
 */
function applyReadinessGuard(envelope, readiness) {
  const e = envelope || { disposition: 'human-gate', why: [] };
  const why = (e.why || []).slice();
  let r = readiness;
  if (r !== 'READY' && r !== 'DEGRADED' && r !== 'ENV_NOT_READY') {
    why.push(`readiness "${r}" is not READY/DEGRADED/ENV_NOT_READY (expected env-readiness output) — treated as DEGRADED`);
    r = 'DEGRADED';
  }
  if (r === 'READY') return Object.assign({}, e, { why });
  if (r === 'ENV_NOT_READY') {
    why.push('env-readiness ENV_NOT_READY — disposition blocked (the gate cannot judge; never auto/human-gate on a down substrate)');
    return Object.assign({}, e, { disposition: 'block', why });
  }
  // DEGRADED
  if (e.disposition === 'auto') {
    why.push('env-readiness DEGRADED — auto downgraded to human-gate (readiness only ever downgrades)');
    return Object.assign({}, e, { disposition: 'human-gate', why });
  }
  why.push('env-readiness DEGRADED — disposition already human-gate/block, unchanged');
  return Object.assign({}, e, { why });
}

module.exports = {
  POLICY_SCHEMA_VERSION,
  LEVELS,
  LEVEL_ORDER,
  BUILT_IN_DEFAULT_LEVEL,
  DISPOSITIONS,
  DEFAULT_FLOOR,
  FLOOR_LOCKED,
  ENV_TIERS,
  resolveLevel,
  resolve,
  applyReadinessGuard,
};
