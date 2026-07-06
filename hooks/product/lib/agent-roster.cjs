'use strict';
/**
 * agent-roster.cjs — optional per-project roster config + the G2 participation-matrix
 * LAYER over the zone router (Autonomous Pipeline Vision, Epic G MINIMUM / G1+G2).
 *
 * Epic A gave a deterministic zone→persona router (zone-router.cjs + zone-routing.yaml,
 * hardcoded routing). Epic G adds a CONFIG LAYER on top — it does NOT replace the router:
 *
 *   G1 (roster config): an OPTIONAL .product/agent-roster.yaml with per-persona
 *       enabled / model / depth_threshold / extra_lenses knobs. ABSENT file == built-in
 *       default; behavior is then byte-identical (1:1) to the pre-G ecosystem.
 *   G2 (participation-matrix): resolveFiring(routeResult, roster) — a STACK over the
 *       router (kickoff DEC-DEV-0145 decision «е»: a layer, not a parallel mechanism).
 *       roster == null → the route() result is returned UNCHANGED (the byte-identical seam).
 *   Named panel presets (kickoff «ж»: former D3 ≡ G4, ONE implementation): built-in
 *       `lean` / `full`, user-overridable in the roster file. Exposed via getPreset /
 *       resolvePanel for future D1b (consilium) consumption — that wiring is DEFERRED.
 *
 * G3 (dashboards / metrics / ROI) is CUT — this lib carries no reporting.
 *
 * Dual-use (orchestrator-lib convention, cf. gap-classifier.cjs / zone-router.cjs):
 *   - require() exports the pure-function API for zone-change-trigger.js + the unit test.
 *   - CLI guarded by require.main === module — an agent runs it via Bash and relays JSON.
 *
 * There is deliberately NO shipped roster template file: absent == default, and this
 * header is the SCHEMA SSOT. The roster schema (all fields optional; omitted == default):
 *
 *   version: 1
 *   personas:
 *     - name: ux-advisor        # canonical subagent_type; unknown name → kept + warning
 *       enabled: false          # default true; false drops the persona from firing
 *       model: sonnet           # default null (persona's own default); annotation only
 *       depth_threshold: significant  # default null; may only RAISE the fire bar, never lower
 *       extra_lenses: [accessibility] # default []; extra review lenses (annotation only)
 *   presets:
 *     - name: lean              # a user preset with a built-in name OVERRIDES the built-in
 *       personas: [architect-advisor, qa-advisor]
 *
 * A merged roster is `{version, personas: {<name>: {enabled, model, depth_threshold,
 * extra_lenses}}, presets: {<name>: [names]}, warnings: [string]}`. Node stdlib only.
 */

const fs = require('fs');
const path = require('path');

// zone-router is the router this layer stacks over; MAGNITUDE_ORDER is its exported
// scale (cosmetic < significant) — reused so the roster depth-gate can never disagree.
const { MAGNITUDE_ORDER } = require('../zone-router.cjs');

// ---------- built-in default roster ----------

/**
 * The built-in roster. ABSENT config == this, and every roster MERGES over it (an omitted
 * persona or field keeps its default here). Presets: kickoff «ж» named composition sets.
 */
const DEFAULT_ROSTER = {
  personas: {
    'architect-advisor': { enabled: true, model: null, depth_threshold: null, extra_lenses: [] },
    'qa-advisor': { enabled: true, model: null, depth_threshold: null, extra_lenses: [] },
    'ux-advisor': { enabled: true, model: null, depth_threshold: null, extra_lenses: [] },
  },
  presets: {
    lean: ['architect-advisor', 'qa-advisor'],
    full: ['architect-advisor', 'qa-advisor', 'ux-advisor'],
  },
};

function defaultPersonaEntry() {
  return { enabled: true, model: null, depth_threshold: null, extra_lenses: [] };
}

/** Deep clone of DEFAULT_ROSTER — the mutable base every parse merges over. */
function cloneDefaultRoster() {
  const personas = {};
  for (const [name, e] of Object.entries(DEFAULT_ROSTER.personas)) {
    personas[name] = { enabled: e.enabled, model: e.model, depth_threshold: e.depth_threshold, extra_lenses: e.extra_lenses.slice() };
  }
  const presets = {};
  for (const [name, list] of Object.entries(DEFAULT_ROSTER.presets)) presets[name] = list.slice();
  return { personas, presets };
}

// ---------- parse ----------

function unquote(s) {
  return String(s).trim().replace(/^["'](.*)["']$/, '$1');
}

function parseInlineArray(val) {
  const m = /^\[(.*)\]$/.exec(String(val).trim());
  if (!m) return [];
  return m[1].split(',').map((s) => unquote(s.trim())).filter(Boolean);
}

/** enabled: true|false. Unrecognized value → true (conservative: a typo never disables). */
function parseBool(val) {
  const t = String(val).trim().toLowerCase();
  if (t === 'false') return false;
  if (t === 'true') return true;
  return true;
}

/** model / depth_threshold: empty or `null` → null; else the unquoted scalar. */
function parseNullableScalar(val) {
  const t = String(val).trim();
  if (t === '' || /^null$/i.test(t)) return null;
  return unquote(t);
}

/**
 * Parse a roster document. Purpose-built for THIS schema (mirrors zone-router.parseManifest's
 * technique — a line state-machine, no YAML dep). Result MERGES over DEFAULT_ROSTER: an
 * omitted persona/field keeps its default; an unknown persona name is KEPT but flagged in
 * warnings[] (a typo must never silently disable a real persona); a user preset whose name
 * collides with a built-in OVERRIDES it. Never throws on ordinary content.
 */
function parseRoster(text) {
  const base = cloneDefaultRoster();
  const warnings = [];
  let version = null;
  let section = null; // 'personas' | 'presets'
  let cur = null; // current persona entry object, or {__preset: name}

  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, ''); // strip trailing comments (schema has no quoted #)
    if (/^\s*#/.test(raw) || line.trim() === '') continue;

    // top-level keys (column 0, no leading whitespace)
    const vMatch = /^version:\s*(\d+)\s*$/.exec(line);
    if (vMatch) { version = Number(vMatch[1]); cur = null; continue; }
    if (/^personas:\s*$/.test(line)) { section = 'personas'; cur = null; continue; }
    if (/^presets:\s*$/.test(line)) { section = 'presets'; cur = null; continue; }

    // list-item start: "  - name: foo"
    const nameMatch = /^\s*-\s*name:\s*(.+?)\s*$/.exec(line);
    if (nameMatch) {
      const name = unquote(nameMatch[1]);
      if (section === 'personas') {
        if (!base.personas[name]) {
          base.personas[name] = defaultPersonaEntry();
          warnings.push(`unknown persona "${name}" kept but not a built-in advisor (typo?) — it will not be routed by any zone`);
        }
        cur = base.personas[name];
      } else if (section === 'presets') {
        base.presets[name] = []; // user preset overrides a built-in of the same name
        cur = { __preset: name };
      } else {
        cur = null;
      }
      continue;
    }

    if (!cur) continue;

    const kv = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();

    if (section === 'personas') {
      if (key === 'enabled') cur.enabled = parseBool(val);
      else if (key === 'model') cur.model = parseNullableScalar(val);
      else if (key === 'depth_threshold') cur.depth_threshold = parseNullableScalar(val);
      else if (key === 'extra_lenses') cur.extra_lenses = parseInlineArray(val);
    } else if (section === 'presets') {
      if (key === 'personas') base.presets[cur.__preset] = parseInlineArray(val);
    }
  }

  return { version, personas: base.personas, presets: base.presets, warnings };
}

/**
 * Read a roster file. ABSENT file → null (the "no config" sentinel; callers treat null as
 * "apply nothing" — the byte-identical seam). Unreadable/malformed → DEFAULT-merged-nothing
 * WITH a warnings[] entry (degrade loud, never throw — mirrors the normalizePanel lesson,
 * DEC-DEV-0149: a malformed config must not empty or mutate the panel).
 */
function loadRoster(rosterPath) {
  let text;
  try {
    text = fs.readFileSync(rosterPath, 'utf-8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return null; // absent → no-config sentinel
    const base = cloneDefaultRoster();
    return {
      version: null,
      personas: base.personas,
      presets: base.presets,
      warnings: [`roster unreadable at ${rosterPath}: ${e.message} — using built-in defaults`],
    };
  }
  try {
    return parseRoster(text);
  } catch (e) {
    const base = cloneDefaultRoster();
    return {
      version: null,
      personas: base.personas,
      presets: base.presets,
      warnings: [`roster parse failed: ${e.message} — using built-in defaults`],
    };
  }
}

// ---------- G2 participation-matrix (the layer over the router) ----------

/**
 * Apply the roster over a zone-router route() result. Takes the router output
 * `{zone, personas, magnitude, fire, reason}` VERBATIM.
 *
 *   roster == null → returns the routeResult UNCHANGED (the byte-identical seam).
 *   else → drops personas whose roster entry is enabled:false; drops personas whose
 *          depth_threshold EXCEEDS the change magnitude (per-persona threshold may only
 *          RAISE the bar above the zone gate, never lower it — conservative; uses the
 *          router's MAGNITUDE_ORDER). If every persona is dropped → fire:false with an
 *          honest reason naming the roster. Returns the same shape + roster_applied:true +
 *          dropped:[{persona, why}] (no silent truncation).
 */
function resolveFiring(routeResult, roster) {
  if (roster == null) return routeResult; // byte-identical seam — same values, unchanged

  const magOrder = MAGNITUDE_ORDER[routeResult.magnitude] || 0;
  const personas = [];
  const dropped = [];

  for (const p of routeResult.personas) {
    const entry = roster.personas[p];
    if (entry && entry.enabled === false) {
      dropped.push({ persona: p, why: 'disabled in roster (enabled: false)' });
      continue;
    }
    if (entry && entry.depth_threshold) {
      const thr = MAGNITUDE_ORDER[entry.depth_threshold] || 0;
      // Only RAISE the bar: drop iff the persona's threshold is stricter than the change.
      if (thr > magOrder) {
        dropped.push({
          persona: p,
          why: `roster depth_threshold ${entry.depth_threshold} exceeds change magnitude ${routeResult.magnitude}`,
        });
        continue;
      }
    }
    personas.push(p);
  }

  const allDropped = routeResult.personas.length > 0 && personas.length === 0;
  const fire = routeResult.fire && personas.length > 0;

  let reason = routeResult.reason;
  if (routeResult.fire && !fire && allDropped) {
    reason = `all personas dropped by roster (${dropped.map((d) => d.persona).join(', ')})`;
  }

  return {
    zone: routeResult.zone,
    personas,
    magnitude: routeResult.magnitude,
    fire,
    reason,
    roster_applied: true,
    dropped,
  };
}

// ---------- panel / preset resolution (for future D1b consumption) ----------

/**
 * Filter a panel name-list against the roster, annotating each surviving name with its
 * model + extra_lenses. roster == null → all names pass with default annotations.
 * (Future D1b/consilium use; consilium.mjs wiring is DEFERRED — kickoff bring-forward.)
 */
function resolvePanel(names, roster) {
  const list = Array.isArray(names) ? names : [];
  if (roster == null) {
    return list.map((name) => ({ name, model: null, extra_lenses: [] }));
  }
  const out = [];
  for (const name of list) {
    const entry = roster.personas[name];
    if (entry && entry.enabled === false) continue;
    out.push({
      name,
      model: entry ? entry.model : null,
      extra_lenses: entry ? entry.extra_lenses.slice() : [],
    });
  }
  return out;
}

/**
 * Resolve a named preset to its persona names. User presets override built-ins.
 * roster == null → built-in presets. Unknown name → null (caller decides).
 */
function getPreset(name, roster) {
  const presets = roster == null ? DEFAULT_ROSTER.presets : roster.presets;
  const list = presets[name];
  return Array.isArray(list) ? list.slice() : null;
}

module.exports = {
  DEFAULT_ROSTER,
  parseRoster,
  loadRoster,
  resolveFiring,
  resolvePanel,
  getPreset,
};

// ---------- CLI ----------

if (require.main === module) {
  const router = require('../zone-router.cjs');
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };

  const presetName = get('--preset');
  const rosterPath = get('--roster');
  const roster = rosterPath ? loadRoster(rosterPath) : null;

  if (presetName) {
    const personas = getPreset(presetName, roster);
    process.stdout.write(JSON.stringify({ preset: presetName, personas }, null, 2) + '\n');
    process.exit(0);
  }

  const file = get('--file');
  if (!file) {
    console.error('usage: node agent-roster.cjs --file <path> [--magnitude cosmetic|significant | --diff-file <path>] [--roster <path>]');
    console.error('       node agent-roster.cjs --preset <name> [--roster <path>]');
    process.exit(2);
  }
  const magnitude = get('--magnitude');
  const diffFile = get('--diff-file');
  const diff = diffFile ? fs.readFileSync(diffFile, 'utf-8') : undefined;
  const routeResult = router.route(file, { magnitude: magnitude || undefined, diff });
  const result = resolveFiring(routeResult, roster);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
