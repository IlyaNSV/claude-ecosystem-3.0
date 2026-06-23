'use strict';
/**
 * zone-router.cjs — deterministic zone → profile-persona router (Epic A / A2).
 *
 * Given a changed .product/ file path (+ a diff or an explicit magnitude), decides
 * which completeness-loop persona(s) should review it. Pure, dependency-free,
 * unit-tested — the firing decision is CODE, not LLM judgment (vision Epic F principle:
 * disposition is deterministic; only the *content* of a persona verdict is a judgment).
 *
 * Dual-use (orchestrator lib convention):
 *   - require() exports {parseManifest, loadManifest, matchZone, classifyMagnitude, route}
 *     for the zone-change-trigger hook + the unit test.
 *   - CLI guarded by require.main === module: an agent can run it via Bash and relay JSON
 *     (useful for the bounded completeness-loop, B1).
 *
 * SSOT for the zone map is the sibling zone-routing.yaml.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MANIFEST = path.join(__dirname, 'zone-routing.yaml');
const MAGNITUDE_ORDER = { cosmetic: 1, significant: 2 };

// ---------- manifest ----------

/**
 * Parse the zone-routing.yaml manifest. Purpose-built for THIS schema (a flat list of
 * zones, each with scalar fields + an inline `personas: [a, b]` array) — no YAML dep.
 */
function parseManifest(text) {
  const zones = [];
  let version = null;
  let cur = null;
  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, ''); // strip trailing comments (not inside quotes — schema has none)
    if (/^\s*#/.test(raw) || line.trim() === '') continue;

    const vMatch = /^version:\s*(\d+)\s*$/.exec(line);
    if (vMatch) { version = Number(vMatch[1]); continue; }

    const idMatch = /^\s*-\s*id:\s*(.+?)\s*$/.exec(line);
    if (idMatch) {
      cur = { id: unquote(idMatch[1]), path_glob: null, personas: [], min_magnitude: 'significant' };
      zones.push(cur);
      continue;
    }
    if (!cur) continue;

    const kv = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (key === 'personas') {
      cur.personas = parseInlineArray(val);
    } else if (key === 'path_glob') {
      cur.path_glob = unquote(val);
    } else if (key === 'min_magnitude') {
      cur.min_magnitude = unquote(val);
    }
  }
  return { version, zones };
}

function loadManifest(manifestPath) {
  return parseManifest(fs.readFileSync(manifestPath || DEFAULT_MANIFEST, 'utf-8'));
}

function parseInlineArray(val) {
  const m = /^\[(.*)\]$/.exec(val.trim());
  if (!m) return [];
  return m[1].split(',').map((s) => unquote(s.trim())).filter(Boolean);
}

function unquote(s) {
  return String(s).trim().replace(/^["'](.*)["']$/, '$1');
}

// ---------- zone match ----------

/** Convert a `.product/dir/*.md` glob into a suffix regex (matches absolute paths too). */
function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials (NOT * — handled next)
    .replace(/\*/g, '[^/]+'); // * = one path segment, no separators
  return new RegExp(`(^|/)${escaped}$`);
}

/** Return the first matching zone for a file path, or null. */
function matchZone(filePath, zones) {
  const norm = String(filePath).replace(/\\/g, '/');
  for (const z of zones) {
    if (!z.path_glob) continue;
    if (globToRegex(z.path_glob).test(norm)) return z;
  }
  return null;
}

// ---------- magnitude ----------

/**
 * Deterministic magnitude classifier (a PRE-FILTER, not the persona's own depth call).
 * Conservative: defaults to `significant` when uncertain (anti-rationalization guard —
 * a false-cosmetic that skips a real review costs more than a review on a borderline edit).
 *
 *   - empty / creation diff           → significant
 *   - every changed content line is cosmetic (frontmatter metadata key created|updated|
 *     version, a reference-list bullet, or whitespace) → cosmetic
 *   - otherwise                        → significant
 */
function classifyMagnitude(diff) {
  if (!diff || !String(diff).trim()) return 'significant';
  const text = String(diff);
  if (/No git diff available|likely .*creation|file not in git/i.test(text)) return 'significant';

  const changed = text
    .split(/\r?\n/)
    .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
    .map((l) => l.slice(1)); // drop the +/- marker

  if (changed.length === 0) return 'significant'; // a diff with no content lines (e.g. mode change) — be safe

  const isCosmeticLine = (l) => {
    const t = l.trim();
    if (t === '') return true; // whitespace-only
    if (/^(created|updated|version|updated_at|created_at):/i.test(t)) return true; // frontmatter metadata
    if (/^-\s+[A-Z]{2,}-\d/.test(t)) return true; // reference-list bullet "- SC-005"
    if (/^[a-z_]+:\s*\[.*\]$/i.test(t)) return true; // inline ref-list "scenarios: [SC-005]"
    return false;
  };

  return changed.every(isCosmeticLine) ? 'cosmetic' : 'significant';
}

// ---------- route ----------

/**
 * Decide the routing for a changed file.
 * @param {string} filePath
 * @param {{magnitude?: string, diff?: string, manifest?: object}} [opts]
 * @returns {{zone: string|null, personas: string[], magnitude: string, fire: boolean, reason: string}}
 */
function route(filePath, opts = {}) {
  const manifest = opts.manifest || loadManifest();
  const zone = matchZone(filePath, manifest.zones);
  const magnitude = opts.magnitude
    ? opts.magnitude
    : opts.diff !== undefined
    ? classifyMagnitude(opts.diff)
    : 'significant';

  if (!zone) {
    return { zone: null, personas: [], magnitude, fire: false, reason: 'no zone match' };
  }
  const meetsThreshold =
    (MAGNITUDE_ORDER[magnitude] || 0) >= (MAGNITUDE_ORDER[zone.min_magnitude] || 0);
  const fire = zone.personas.length > 0 && meetsThreshold;
  return {
    zone: zone.id,
    personas: zone.personas.slice(),
    magnitude,
    fire,
    reason: fire
      ? 'zone matched and magnitude >= threshold'
      : meetsThreshold
      ? 'zone matched but no personas'
      : `magnitude ${magnitude} below ${zone.min_magnitude}`,
  };
}

module.exports = { parseManifest, loadManifest, matchZone, globToRegex, classifyMagnitude, route, MAGNITUDE_ORDER };

// ---------- CLI ----------

if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  const file = get('--file');
  if (!file) {
    console.error('usage: node zone-router.cjs --file <path> [--magnitude cosmetic|significant] [--diff-file <path>]');
    process.exit(2);
  }
  const magnitude = get('--magnitude');
  const diffFile = get('--diff-file');
  const diff = diffFile ? fs.readFileSync(diffFile, 'utf-8') : undefined;
  const result = route(file, { magnitude: magnitude || undefined, diff });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
