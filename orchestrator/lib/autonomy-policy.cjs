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
 *   - F2 (DEC-DEV-0193) implements L0-L3. L2 routes the staging/prod cells to `consilium-gate`
 *     (Epic D jury + confidence threshold τ + human-fallback). F3 (DEC-DEV-0194) differentiates
 *     L3: L3 × staging → auto (pre-deploy jury replaced by the healthcheck → auto-rollback net),
 *     L3 × prod stays consilium-gate; plus a `rollback` class (dev/staging → auto, prod → human).
 *     The floor remains non-crossable and its classes are human-gate FIRST (never consilium-gate).
 *   - WIRED (F2 seed, DEC-DEV-0154): consumed by orchestrator/lib/fabric-engine.cjs
 *     (Process Fabric prescriptions). Home is orchestrator/lib/ — co-located with its
 *     consumer so the existing `/ecosystem:update` orchestrator `lib/` namespace sync
 *     delivers it to user projects (the repo-level lib/ home of the F1 skeleton wave had
 *     NO deployment mapping — the §6 checklist item resolved by DEC-DEV-0154).
 *     Same-inputs → same-disposition; the returned why[] chain IS
 *     the audit-trail seed (fabric persists the transition-level why[] in events.ndjson).
 *
 * CONSUMES, NEVER RE-DERIVES (wave hard-constraint #3, dev/_archive/vision/ECOSYSTEM_VISION_BATCH_3.md §0):
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
 * Node stdlib only, zero deps. The PURE resolver (resolve / resolveLevel / applyReadinessGuard /
 * confidenceFromSynth / applyConsiliumVerdict / parseAutonomyConfig) does NO I/O — require()-able
 * from anywhere, unit-tested by tests/orchestrator/autonomy-policy.test.cjs. Only loadAutonomyPolicy()
 * and the CLI seam touch the FS.
 *
 * F2 (DEC-DEV-0193): L2/L3 are now BUILT. resolve() emits `consilium-gate` on the staging/prod
 * cells of L2. F3 (DEC-DEV-0194) differentiates L3 (L3 × staging → auto, L3 × prod → consilium-gate)
 * and adds a `rollback` class (dev/staging → auto, prod → human-gate). The consilium verdict is folded
 * back by applyConsiliumVerdict (confidence ≥ τ → auto, else human-fallback). The floor stays
 * non-crossable — a floor class is human-gate + floor_hit FIRST, consilium-gate is never emitted on
 * it. product.yaml `autonomy:` is parsed by parseAutonomyConfig/loadAutonomyPolicy (default=L1 / autonomous=L3).
 */

const fs = require('fs');
const path = require('path');

const POLICY_SCHEMA_VERSION = 1;

// ---- enums (vision §Epic F, locked 2026-06-23) ------------------------------------------------

/** Autonomy ladder. F1 implemented L0/L1; F2 built L2; F3 differentiated L3 (staging → auto). */
const LEVELS = ['L0', 'L1', 'L2', 'L3'];
const LEVEL_ORDER = { L0: 0, L1: 1, L2: 2, L3: 3 };
const BUILT_IN_DEFAULT_LEVEL = 'L1'; // ecosystem built-in (vision: дефолт новых проектов = L1)

/** Dispositions the resolver can emit (vision §Epic F enum). `consilium-gate` is emitted on the
 * L2/L3 staging/prod cells (F2, DEC-DEV-0193) — the Epic D jury + threshold gate; it is NEVER
 * emitted on a floor class (floor is human-gate + floor_hit, checked first). */
const DISPOSITIONS = ['auto', 'consilium-gate', 'human-gate', 'block'];

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

  // F2 (DEC-DEV-0193): L2/L3 are BUILT — returned verbatim (no more degradation to L1). resolve()
  // maps them onto the disposition matrix; F3 (DEC-DEV-0194) differentiates L3 from L2 on staging.
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
 * → { disposition: 'auto'|'consilium-gate'|'human-gate'|'block', level_applied, floor_hit, why: [string] }
 *
 * Disposition matrix (F2+F3, L0-L3 — the contract doc carries the table with rationale):
 *   floor class                → human-gate, always (floor_hit: true) — checked FIRST, never consilium
 *   rollback class (non-floor) → auto on dev/staging, human-gate on prod — level-INDEPENDENT, checked
 *                                before the matrix (reverse ⇒ more autonomous; owner rail: prod always human)
 *   L0: auto iff LOW × dev; HIGH/staging/prod → human-gate (человек на всех 🟠+🔴)
 *   L1: auto iff dev (staging/prod → human-gate; irreversibility is carried by the floor classes)
 *   L2: auto on dev (as L1); staging/prod → consilium-gate (Epic D jury + τ + human-fallback)
 *   L3: auto on dev AND staging (F3: staging jury replaced by the healthcheck → auto-rollback net);
 *       prod → consilium-gate (conservative — monotone with L2, never a blanket prod auto)
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

  // ---- rollback operation-class (F3, DEC-DEV-0194 D-8): "reverse => more autonomous" ----------
  // A rollback moves the system toward a PREVIOUSLY-deployed known-good release: it cannot introduce
  // novel broken state, so it is safe-by-construction on the reversible side. Owner rail
  // (EPIC_E_READINESS.md:22): staging auto, prod ALWAYS human-confirm. Keyed on env ONLY
  // (level-independent) and placed ABOVE the generic level-matrix: the D-4/D-9 auto-rollback bracket
  // must fire on a healthcheck failure at the project's ACTUAL level (L1 default, possibly L0) WITHOUT
  // a human. Riding the generic staging column would human-gate it at L0/L1 and silently defeat the
  // owner's "staging auto" decision. rollback is NOT in DEFAULT_FLOOR, so the floor already returned
  // above; prod is human-gate (NEVER consilium - "human-confirm" is unconditional, agents are not a human).
  if (opClass === 'rollback') {
    if (env === 'prod') {
      whyAll.push(`rollback x prod: human-gate at ${level} (owner rail: prod rollback is ALWAYS human-confirm, every level)`);
      return { disposition: 'human-gate', level_applied: level, floor_hit: false, why: whyAll };
    }
    whyAll.push(`rollback x ${env}: auto at ${level} (reverse -> more autonomous; a rollback only restores a prior known-good release - safe-by-construction, level-independent so D-4 auto-rollback fires at the project default level)`);
    return { disposition: 'auto', level_applied: level, floor_hit: false, why: whyAll };
  }

  // ---- the F3 disposition matrix (L0-L3) ------------------------------------------------------
  // F3 (DEC-DEV-0194) removes the F2 "L3 == L2" stub. L3 differs from L2 in exactly ONE cell:
  // L3 x staging = auto (was consilium-gate). Staging is reversible by construction (symlink-swap
  // rollback, dev-tier secrets); at L3 the operator has opted into replacing the pre-deploy jury (L2)
  // with the post-deploy healthcheck -> auto-rollback net (D-4/D-5). L3 x prod stays consilium-gate:
  // prod is conservative (monotonicity forbids human-gate below L2; owner intent forbids a blanket
  // auto on real users). The floor (checked first) and applyReadinessGuard (downstream) are untouched.
  let disposition;
  if (env === 'dev') {
    if (level === 'L0') {
      disposition = tier === 'LOW' ? 'auto' : 'human-gate';
      whyAll.push(`L0 × dev × ${tier}: auto only on LOW (человек на всех 🟠+🔴)`);
    } else {
      // L1/L2/L3: auto on dev; irreversible operation classes are already caught by the floor
      // above, so a non-floor dev operation is the reversible case.
      disposition = 'auto';
      whyAll.push(`${level} × dev × ${tier}: auto on the reversible/dev side (floor classes already human-gated)`);
    }
  } else if (level === 'L3' && env === 'staging') {
    // F3: the ONE cell that differentiates L3 from L2. The pre-deploy jury is replaced by the
    // post-deploy healthcheck -> auto-rollback net; staging is reversible, and the floor +
    // readiness-guard still apply. This is the operational meaning of profile:autonomous (L3).
    disposition = 'auto';
    whyAll.push(`L3 × staging × ${tier}: auto (F3 - pre-deploy jury replaced by the post-deploy healthcheck -> auto-rollback net; staging is reversible, floor + readiness-guard still apply)`);
  } else if (level === 'L2' || level === 'L3') {
    // L2 × staging/prod AND L3 × prod: the consilium gate (Epic D jury + threshold + human-fallback).
    // The verdict is folded back by applyConsiliumVerdict; the floor already returned human-gate
    // above, so a consilium-gate is only ever emitted on a NON-floor operation.
    disposition = 'consilium-gate';
    whyAll.push(`${level} × ${env}: consilium-gate (Epic D jury + threshold + human-fallback; floor stays human)`);
  } else {
    // L0/L1 × staging/prod: human-gate (no consilium at these levels).
    disposition = 'human-gate';
    whyAll.push(`${level} × ${env}: staging+ is human-gated at ${level} (no consilium gate below L2)`);
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

// ---- consilium verdict folding (F2, DEC-DEV-0193) ----------------------------------------------

/**
 * confidenceFromSynth(synthResult) — deterministic map of a consilium-synth.cjs result's strength
 * to a [0,1] confidence: strong → 1.0, split → 0.5, none → 0.0. A non-object / unknown strength → 0.0
 * (conservative — an unreadable verdict is no confidence). recommended_soft_vetoed is already demoted
 * to `split` by the synth, so this never double-counts it.
 */
function confidenceFromSynth(synthResult) {
  if (!synthResult || typeof synthResult !== 'object') return 0.0;
  switch (synthResult.strength) {
    case 'strong': return 1.0;
    case 'split': return 0.5;
    case 'none': return 0.0;
    default: return 0.0;
  }
}

/**
 * applyConsiliumVerdict(envelope, synthResult, gateCfg) — fold an Epic D jury verdict back into a
 * `consilium-gate` disposition (vision §Epic F "consilium-gate with safe-fallback"):
 *   - envelope.disposition !== 'consilium-gate' → returned UNCHANGED (only the gate cell is folded).
 *   - τ = gateCfg.confidence_threshold when finite, else 0.8 (vision default).
 *   - confidence = confidenceFromSynth(synthResult).
 *   - confidence ≥ τ AND synthResult.recommended != null → 'auto' (the jury cleared the gate).
 *   - else → 'human-gate' (safe-fallback: a weak/split/none verdict is a HUMAN gate, never a blind
 *     auto — "agents instead of a human" degrades safely, it does not fall into prod).
 * Never throws. The floor is unreachable here (a floor class never carries a consilium-gate).
 */
function applyConsiliumVerdict(envelope, synthResult, gateCfg) {
  const e = envelope || {};
  if (e.disposition !== 'consilium-gate') return e;
  const why = (e.why || []).slice();
  const tau = gateCfg && Number.isFinite(gateCfg.confidence_threshold) ? gateCfg.confidence_threshold : 0.8;
  const confidence = confidenceFromSynth(synthResult);
  const recommended = synthResult && typeof synthResult === 'object' && synthResult.recommended != null
    ? synthResult.recommended : null;
  if (confidence >= tau && recommended != null) {
    why.push(`consilium verdict: confidence ${confidence} ≥ τ ${tau} on recommended "${recommended}" → auto (Epic D jury cleared the gate)`);
    return Object.assign({}, e, { disposition: 'auto', consilium: { confidence, threshold: tau, recommended }, why });
  }
  why.push(`consilium verdict: confidence ${confidence} < τ ${tau}${recommended == null ? ' (no recommended option — split/none/veto-set)' : ` on "${recommended}"`} → human-gate (safe-fallback, never blind auto)`);
  return Object.assign({}, e, { disposition: 'human-gate', consilium: { confidence, threshold: tau, recommended }, why });
}

// ---- product.yaml `autonomy:` config parse (F2, DEC-DEV-0193) -----------------------------------

function unquoteScalar(s) {
  return String(s == null ? '' : s).trim().replace(/^["'](.*)["']$/, '$1');
}

/** Parse an inline `{ k: v, k2: v2 }` map (the vision config uses the inline form). null if not one. */
function parseInlineMap(val) {
  const m = /^\{(.*)\}$/.exec(String(val == null ? '' : val).trim());
  if (!m) return null;
  const out = {};
  for (const pair of m[1].split(',')) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

/**
 * parseAutonomyConfig(yamlText) — extract the `.claude/product.yaml` `autonomy:` block into a policy
 * object `{ default_level?, process_overrides?, consilium_gate?:{confidence_threshold?, panel?},
 * profile?, why[] }`. NO js-yaml dep — a line state-machine scoped to the autonomy block (technique
 * mirrors hooks/product/lib/agent-roster.cjs parseRoster). Semantics (vision §Epic F, locked):
 *   - profile: default → base default_level L1; profile: autonomous → base L3 (Vision Locked);
 *     an explicit default_level OVERRIDES the profile base (noted in why[]).
 *   - floor: is IGNORED loudly (FLOOR_LOCKED — the F1 hard rail; shrinking the floor is a separate
 *     explicit opt-in, never an ordinary config key).
 *   - consilium_gate: { confidence_threshold (0..1; junk → ignored), panel (string) } (inline or block).
 *   - invalid levels / junk → tolerant ignore + why; NO autonomy block → {} (absent == built-in L1,
 *     1:1 — the product_class soft-migration precedent). Never throws.
 */
function parseAutonomyConfig(yamlText) {
  if (typeof yamlText !== 'string') return {};
  const lines = yamlText.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^autonomy:\s*$/.test(lines[i].replace(/\s+#.*$/, ''))) { start = i; break; }
  }
  if (start === -1) return {};

  const why = [];
  const indentOf = (s) => s.match(/^\s*/)[0].length;
  let baseIndent = null;
  let sub = null; // 'consilium_gate' | 'process_overrides' | null
  let explicitDefault;
  let profileDefault; // 'L1' | 'L3'
  let profileName;
  const processOverrides = {};
  const consiliumGate = {};

  const applyConsiliumGateKV = (key, val) => {
    if (key === 'confidence_threshold') {
      const n = Number(unquoteScalar(val));
      if (Number.isFinite(n) && n >= 0 && n <= 1) consiliumGate.confidence_threshold = n;
      else why.push(`autonomy.consilium_gate.confidence_threshold "${val}" is not a number in [0,1] — ignored`);
    } else if (key === 'panel') {
      const p = unquoteScalar(val);
      if (p) consiliumGate.panel = p;
    }
  };
  const applyProcessOverrideKV = (key, val) => {
    const lvl = unquoteScalar(val);
    if (isLevel(lvl)) processOverrides[key] = lvl;
    else why.push(`autonomy.process_overrides.${key} "${val}" is not a valid level — ignored`);
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].replace(/\s+#.*$/, '');
    if (line.trim() === '') continue;
    const indent = indentOf(line);
    if (indent === 0) break; // next top-level key → autonomy block ends
    if (baseIndent === null) baseIndent = indent;

    if (indent <= baseIndent) {
      sub = null;
      const kv = /^\s*([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (!kv) continue;
      const key = kv[1];
      const val = kv[2].trim();
      if (key === 'default_level') {
        const v = unquoteScalar(val);
        if (isLevel(v)) explicitDefault = v;
        else why.push(`autonomy.default_level "${val}" is not a valid level (${LEVELS.join('/')}) — ignored`);
      } else if (key === 'profile') {
        profileName = unquoteScalar(val);
        if (profileName === 'default') profileDefault = 'L1';
        else if (profileName === 'autonomous') profileDefault = 'L3';
        else why.push(`autonomy.profile "${val}" is not a known profile (default/autonomous) — ignored`);
      } else if (key === 'floor') {
        why.push('autonomy.floor is IGNORED (FLOOR_LOCKED): the built-in floor is a hard rail; shrinking/replacing it is a separate explicit opt-in, never an ordinary config key');
      } else if (key === 'consilium_gate') {
        const inline = parseInlineMap(val);
        if (inline) { for (const [k, v] of Object.entries(inline)) applyConsiliumGateKV(k, v); sub = null; }
        else sub = 'consilium_gate';
      } else if (key === 'process_overrides') {
        const inline = parseInlineMap(val);
        if (inline) { for (const [k, v] of Object.entries(inline)) applyProcessOverrideKV(k, v); sub = null; }
        else sub = 'process_overrides';
      }
    } else {
      const kv = /^\s*([A-Za-z_][\w.-]*):\s*(.*)$/.exec(line);
      if (!kv) continue;
      if (sub === 'consilium_gate') applyConsiliumGateKV(kv[1], kv[2].trim());
      else if (sub === 'process_overrides') applyProcessOverrideKV(kv[1], kv[2].trim());
    }
  }

  const out = {};
  if (explicitDefault !== undefined && profileDefault !== undefined && explicitDefault !== profileDefault) {
    why.push(`autonomy.default_level ${explicitDefault} overrides profile "${profileName}" base ${profileDefault}`);
  }
  const effectiveDefault = explicitDefault !== undefined ? explicitDefault : profileDefault;
  if (effectiveDefault !== undefined) out.default_level = effectiveDefault;
  if (profileName !== undefined) out.profile = profileName;
  if (Object.keys(processOverrides).length) out.process_overrides = processOverrides;
  if (Object.keys(consiliumGate).length) out.consilium_gate = consiliumGate;
  // Attach why[] only when non-empty so an empty `autonomy:` block returns {} (1:1 with absent).
  if (why.length) out.why = why;
  return out;
}

/**
 * loadAutonomyPolicy(root) — read `<root>/.claude/product.yaml` and parse its `autonomy:` block.
 * Fail-tolerant: a missing/unreadable file → {} (absent == built-in L1, 1:1). The ONLY FS in this
 * module besides the CLI seam.
 */
function loadAutonomyPolicy(root) {
  let text;
  try { text = fs.readFileSync(path.join(root || '.', '.claude', 'product.yaml'), 'utf8'); }
  catch (_e) { return {}; }
  return parseAutonomyConfig(text);
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
  confidenceFromSynth,
  applyConsiliumVerdict,
  parseAutonomyConfig,
  loadAutonomyPolicy,
};

// ---------------------------------------------------------------------------
// CLI seam (FS + loadAutonomyPolicy live here only). Two subcommands (DEC-DEV-0193):
//   resolve           — resolve() (+ optional applyReadinessGuard) → JSON. The P5/P6 live-caller
//                       seam: the harness .mjs cannot require() this lib (DEC-DEV-0073 §D.1), so a
//                       process agent runs this via Bash and relays the disposition into its result.
//   resolve-consilium — applyConsiliumVerdict() → JSON. The run.md dispatcher's consilium-gate
//                       actuator (fold an Epic D jury verdict back into a disposition).
// Exit 0 ok · 2 usage/error.
// ---------------------------------------------------------------------------
function cliParse(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    const next = () => argv[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--operation-class': a.operationClass = next(); break;
      case '--risk': a.risk = next(); break;
      case '--env-tier': a.envTier = next(); break;
      case '--policy': a.policy = next(); break;
      case '--policy-file': a.policyFile = next(); break;
      case '--override': a.override = next(); break;
      case '--readiness': a.readiness = next(); break;
      case '--envelope': a.envelope = next(); break;
      case '--envelope-file': a.envelopeFile = next(); break;
      case '--synth': a.synth = next(); break;
      case '--synth-file': a.synthFile = next(); break;
      case '--threshold': a.threshold = next(); break;
      default: break;
    }
  }
  return a;
}

function cliReadJson(inline, file, label) {
  if (file != null) {
    try { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
    catch (e) { throw new Error(`cannot read/parse --${label}-file: ${(e && e.message) || e}`); }
  }
  if (inline != null) {
    try { return JSON.parse(inline); }
    catch (e) { throw new Error(`--${label} is not valid JSON: ${(e && e.message) || e}`); }
  }
  return undefined;
}

function cliHelp() {
  process.stdout.write([
    'autonomy-policy.cjs — Epic F disposition resolver (F1+F2, DEC-DEV-0193).',
    '',
    'USAGE:',
    '  node autonomy-policy.cjs resolve --operation-class <c> --risk <HIGH|LOW> [--env-tier <dev|staging|prod>]',
    '        [--policy <json>|--policy-file <p>] [--override <L0|L1|L2|L3>] [--readiness <READY|DEGRADED|ENV_NOT_READY>]',
    '     → resolve() (then applyReadinessGuard when --readiness is given) as JSON. The P5/P6 live-caller seam.',
    '  node autonomy-policy.cjs resolve-consilium --envelope <json>|--envelope-file <p> --synth <json>|--synth-file <p>',
    '        [--threshold <0..1>]',
    '     → applyConsiliumVerdict() as JSON (fold an Epic D jury verdict into a consilium-gate disposition).',
    '',
    'Exit 0 ok · 2 usage/error. The floor is never crossable; invalid levels are ignored loudly.',
  ].join('\n') + '\n');
}

function cliMain() {
  const sub = process.argv[2];
  const a = cliParse(process.argv.slice(3));
  if (a.help || sub === '--help' || sub === '-h' || sub === 'help') { cliHelp(); process.exit(0); }

  if (sub === 'resolve') {
    let policy;
    try { policy = cliReadJson(a.policy, a.policyFile, 'policy'); }
    catch (e) { process.stderr.write(`autonomy-policy: ${e.message}\n`); process.exit(2); }
    let envelope = resolve(a.operationClass, a.risk, a.envTier, policy || {}, a.override);
    if (a.readiness != null) envelope = applyReadinessGuard(envelope, a.readiness);
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
    process.exit(0);
  }

  if (sub === 'resolve-consilium') {
    let envelope;
    let synth;
    try {
      envelope = cliReadJson(a.envelope, a.envelopeFile, 'envelope');
      synth = cliReadJson(a.synth, a.synthFile, 'synth');
    } catch (e) { process.stderr.write(`autonomy-policy: ${e.message}\n`); process.exit(2); }
    if (envelope === undefined) {
      process.stderr.write('autonomy-policy: resolve-consilium needs --envelope or --envelope-file\n');
      process.exit(2);
    }
    const gateCfg = a.threshold != null && Number.isFinite(Number(a.threshold))
      ? { confidence_threshold: Number(a.threshold) } : undefined;
    process.stdout.write(JSON.stringify(applyConsiliumVerdict(envelope, synth, gateCfg), null, 2) + '\n');
    process.exit(0);
  }

  cliHelp();
  process.exit(2);
}

if (require.main === module) {
  cliMain();
}
