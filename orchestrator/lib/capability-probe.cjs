#!/usr/bin/env node
/**
 * capability-probe.cjs — deterministic §6 detect-leg probe for the Orchestrator
 * capability-channel (DEC-DEV-0117; closes the #3/#4 remainder of DEC-DEV-0081).
 *
 * WHY THIS EXISTS (S6 dogfood, DEC-DEV-0081 root cause):
 *   The §6 capability-channel was a BLOCK-handler, not a gap-DETECTOR: it fired
 *   only when an implementer happened to emit a blocking signal. A spec-mandated
 *   Mock made a deferred provider non-blocking → the channel stayed silent and a
 *   GO shipped with a real provider seam (DeepL/ElevenLabs/Whisper) hidden behind
 *   a stand-in. Fixes #1/#2/#5 (MERGED) fixed the PLUMBING (a reported CONCERN is
 *   propagated, GO discloses it). This lib is the missing DETECT-leg: the
 *   orchestrator itself enumerates a feature's declared external capabilities at
 *   pre-flight and dispositions the absent ones — it no longer waits for the
 *   implementer to notice.
 *
 * SOURCE OF TRUTH — the `external_capabilities` manifest (DEC-DEV-0117):
 *   A feature (FM-*) declares its external/provider/secret dependencies in an
 *   OPTIONAL frontmatter list (absent == [] == old behaviour 1:1, backward-compat).
 *   Each item: { capability, secret_env, provider, tier, dev_stand_in }. Because
 *   `tier` + `dev_stand_in` are DECLARED, the disposition (block vs deferred) is
 *   DETERMINISTIC (read it), not a heuristic — defusing the dead-rule / noisy-rule
 *   risk the S7 brief warned about (a heuristic would fire on every mocked seam).
 *
 * WHAT IS DETERMINISTIC HERE (offline, fixtures) vs SUBSTRATE-GATED (S7/RL-002):
 *   DETECT (enumerate + env-presence) and DISPOSITION (from the manifest) are pure
 *   and unit-tested below. The ESCALATE→AWAIT execution on a BLOCK (the OD7 async
 *   request→await→resume protocol) and the live S7 validation are NOT in this lib —
 *   they need a real, in-scope blocking provider gap (RL-002 vendor wiring) and are
 *   tracked as the deferred remainder of DEC-DEV-0081 #4 / S7.
 *
 * Like env-readiness.cjs: an agent runs this via Bash and RELAYS its JSON — the
 * Workflow script may not touch the FS / child_process, only a lib like this may
 * (DEC-DEV-0073 §D.1). Node stdlib only; cross-platform.
 *
 * EXIT CODES: 0 ran ok (JSON on stdout) · 2 usage/internal error.
 * Dual-use: require() it for the pure functions (unit-tested), or run as a CLI.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CAPABILITY_SCHEMA_VERSION = 1;

// Access-axis disposition (does the run have the external access it needs NOW?).
const DISPOSITION = {
  SATISFIED: 'SATISFIED',                                 // secret present → no surface
  EXPECTED_ABSENT_BUT_DEFERRED: 'EXPECTED_ABSENT_BUT_DEFERRED', // absent but a dev stand-in covers it; tracking item, must be real before `tier`
  BLOCK: 'BLOCK',                                         // absent, no stand-in → real access needed now (would trigger OD7 — execution deferred)
};

// Where a surfaced item routes (an item may carry BOTH: access + provider choice).
const ROUTE = { INTEGRATOR: 'Integrator', PRODUCT: 'Product' };

const FIELDS = ['capability', 'secret_env', 'provider', 'tier', 'dev_stand_in'];

// ---------------------------------------------------------------------------
// Pure parsing (no FS): tolerant of a YAML flow-mapping per list item, e.g.
//   - { capability: machine-translation, secret_env: DEEPL_API_KEY, provider: DeepL, tier: prod, dev_stand_in: Mock }
// Quotes are stripped; unknown keys ignored; missing keys → undefined. Kept
// stdlib-only (no YAML dep) on purpose — the orchestrator libs are dependency-free.
// ---------------------------------------------------------------------------
function unquote(s) {
  const t = String(s == null ? '' : s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function isBlankProvider(p) {
  return !p || /^(tbd|\?|none|unknown|undecided|n\/a)$/i.test(String(p).trim());
}

function hasStandIn(s) {
  const t = String(s == null ? '' : s).trim();
  return !!t && !/^(none|null|-|n\/a)$/i.test(t);
}

/** Parse one manifest item from a YAML flow-mapping body (the text inside `{ … }`). */
function parseManifestItem(raw) {
  const body = String(raw == null ? '' : raw).trim().replace(/^\{/, '').replace(/\}$/, '');
  const item = {};
  // split on commas that separate top-level k:v pairs (values here are simple scalars)
  for (const pair of body.split(',')) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    const key = unquote(pair.slice(0, idx)).toLowerCase();
    const val = unquote(pair.slice(idx + 1));
    if (FIELDS.includes(key)) item[key] = val;
  }
  return item;
}

/**
 * Extract the `external_capabilities:` list from a raw frontmatter string.
 * Returns [] if the key is absent (backward-compat: old features 1:1).
 * Accepts list items as flow-mappings (`- { … }`). Tolerant of indentation.
 */
function extractManifest(frontmatter) {
  const text = String(frontmatter == null ? '' : frontmatter).replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^\s*external_capabilities\s*:/.test(l));
  if (start === -1) return [];
  // inline empty (external_capabilities: [] | "") → no items
  const inline = lines[start].slice(lines[start].indexOf(':') + 1).trim();
  if (inline && inline !== '[]') {
    // a rare single-line flow-seq — split top-level `{…}` groups
    const groups = inline.replace(/^\[/, '').replace(/\]$/, '').match(/\{[^}]*\}/g) || [];
    return groups.map(parseManifestItem).filter((it) => Object.keys(it).length);
  }
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^\s*-\s*\{/.test(l)) { items.push(parseManifestItem(l.replace(/^\s*-\s*/, ''))); continue; }
    if (/^\s*-\s+/.test(l)) { continue; }            // tolerate non-flow item; skip (no fields)
    if (/^\S/.test(l) || /^\s*\w[\w-]*\s*:/.test(l)) break;   // next top-level key → manifest ended
    if (!l.trim()) continue;
  }
  return items.filter((it) => Object.keys(it).length);
}

// ---------------------------------------------------------------------------
// Pure disposition + surfacing (the detect-leg's deterministic heart).
// ---------------------------------------------------------------------------
/**
 * Disposition for ONE declared capability given whether its secret is present.
 *   present                          → SATISFIED
 *   absent + a dev stand-in declared → EXPECTED_ABSENT_BUT_DEFERRED (tracking)
 *   absent + no stand-in             → BLOCK (real access needed now; OD7 — deferred)
 * Orthogonal: an undecided `provider` (TBD) sets provider_choice_pending (→ Product/OD8),
 * independent of the access axis.
 */
function dispositionFor(item, present) {
  if (present) return { disposition: DISPOSITION.SATISFIED, provider_choice_pending: false };
  const disposition = hasStandIn(item.dev_stand_in)
    ? DISPOSITION.EXPECTED_ABSENT_BUT_DEFERRED
    : DISPOSITION.BLOCK;
  return { disposition, provider_choice_pending: isBlankProvider(item.provider) };
}

/**
 * Build the surfaced capability-items (the §6 SURFACE / fix #4 tracking format).
 * `envHas(name)` is an injected predicate (pure-testable; the CLI builds it from
 * the real env). SATISFIED items with no pending provider choice are NOT surfaced.
 */
function surface(items, envHas) {
  const has = typeof envHas === 'function' ? envHas : () => false;
  const out = [];
  for (const item of items || []) {
    // DEC-DEV-0174 (DEF-OD7-1): the predicate may return a SOURCE label ('process-env' | '.env' |
    // '.env.local') instead of a bare boolean — truthiness drives `present` exactly as before, the
    // label is surfaced as `env_source` (a plain-true predicate reads as 'process-env').
    const src = item.secret_env ? has(item.secret_env) : false;
    const present = !!src;
    const d = dispositionFor(item, present);
    const routes = [];
    if (d.disposition !== DISPOSITION.SATISFIED) routes.push(ROUTE.INTEGRATOR);   // access
    if (d.provider_choice_pending) routes.push(ROUTE.PRODUCT);                    // provider CHOICE (OD8)
    const surfaceWorthy = d.disposition !== DISPOSITION.SATISFIED || d.provider_choice_pending;
    out.push({
      type: item.secret_env ? 'secret' : 'tool',
      capability: item.capability || '(unnamed)',
      secret_env: item.secret_env || null,
      provider: item.provider || null,
      tier: item.tier || null,
      dev_stand_in: item.dev_stand_in || null,
      present,
      env_source: present ? (typeof src === 'string' ? src : 'process-env') : null,
      disposition: d.disposition,
      provider_choice_pending: d.provider_choice_pending,
      zone: 'external-capability',
      routes,
      surface: surfaceWorthy,
      rationale: rationaleFor(item, d, src),
    });
  }
  return out;
}

function rationaleFor(item, d, src) {
  const present = !!src;
  if (present) return `${item.secret_env} present (${typeof src === 'string' ? src : 'process-env'}) — access satisfied.`;
  if (d.disposition === DISPOSITION.EXPECTED_ABSENT_BUT_DEFERRED) {
    return `${item.secret_env || item.capability} absent; dev stand-in "${item.dev_stand_in}" covers ${item.tier || 'dev'} — must be real before ${item.tier || 'staging/prod'}. Tracking, not a blocking request now.`;
  }
  return `${item.secret_env || item.capability} absent and no dev stand-in declared — real access needed for this capability (route Integrator)${d.provider_choice_pending ? '; provider undecided (route Product / OD8)' : ''}.`;
}

/** Summary counts over a surfaced set. */
function summarize(surfaced) {
  const by = { SATISFIED: 0, EXPECTED_ABSENT_BUT_DEFERRED: 0, BLOCK: 0 };
  let provider_choices = 0;
  for (const s of surfaced) {
    by[s.disposition] = (by[s.disposition] || 0) + 1;
    if (s.provider_choice_pending) provider_choices += 1;
  }
  return {
    total: surfaced.length,
    surfaced: surfaced.filter((s) => s.surface).length,
    blocking: by.BLOCK,
    deferred: by.EXPECTED_ABSENT_BUT_DEFERRED,
    satisfied: by.SATISFIED,
    provider_choices,
  };
}

// ---------------------------------------------------------------------------
// Presence sources (DEC-DEV-0174, DEF-OD7-1). The OD7 live run (DEC-DEV-0173)
// proved process.env alone is a false-positive BLOCK machine: the pilot's
// runtime loads `.env` via dotenv, so a secret can be fully provisioned yet
// invisible to a probe spawned without it in the environment — the line parked
// on a capability it actually had. Presence is therefore read from process.env
// FIRST, then `.env`, then `.env.local` under --root. Read-only; only PRESENCE
// is reported, a secret's value never leaves this function.
// ---------------------------------------------------------------------------
/**
 * dotenv-lite parse (pure): KEY=VALUE lines; `# comment` and blank lines skipped;
 * an `export ` prefix is tolerated; surrounding quotes are stripped. Only keys
 * with a NON-EMPTY value are returned (an empty assignment is NOT presence —
 * same rule as the process.env check below). No interpolation, no multi-line
 * values — deliberately minimal, presence is all the probe needs.
 */
function parseEnvFileText(text) {
  const vars = {};
  for (const line of String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const val = unquote(m[2]);
    if (val) vars[m[1]] = val;
  }
  return vars;
}

/** Read the dotenv presence sources under `root` (a missing/unreadable file is simply skipped). */
function readEnvFiles(root) {
  const sources = [];
  for (const name of ['.env', '.env.local']) {
    let text = null;
    try { text = fs.readFileSync(path.join(root || '.', name), 'utf8'); } catch (_e) { continue; }
    sources.push({ source: name, vars: parseEnvFileText(text) });
  }
  return sources;
}

/**
 * Presence predicate for surface(): name → 'process-env' | '.env' | '.env.local' | false.
 * process.env wins (a live export overrides a file), then the files in order.
 */
function envPresence(root) {
  const files = readEnvFiles(root);
  return (name) => {
    if (Object.prototype.hasOwnProperty.call(process.env, name) && !!process.env[name]) return 'process-env';
    for (const f of files) {
      if (Object.prototype.hasOwnProperty.call(f.vars, name)) return f.source;
    }
    return false;
  };
}

// ---------------------------------------------------------------------------
// CLI (FS lives here only) — resolve the FM, read its frontmatter, probe env.
// ---------------------------------------------------------------------------
function readFrontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

function resolveFeatureFile(feature, root) {
  const dir = path.join(root || '.', '.product', 'features');
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (_e) { return null; }
  const md = entries.filter((f) => f.endsWith('.md'));
  const key = String(feature || '').toLowerCase();
  // exact FM-id prefix, else slug substring
  const hit = md.find((f) => f.toLowerCase().startsWith(`${key}-`))
    || md.find((f) => f.toLowerCase().includes(key));
  return hit ? path.join(dir, hit) : null;
}

function parseArgs(argv) {
  const a = { root: '.' };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--feature': a.feature = next(); break;
      case '--root': a.root = next(); break;
      case '--file': a.file = next(); break;
      default: break;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'capability-probe.cjs — §6 detect-leg: enumerate a feature\'s declared external',
    'capabilities and disposition the absent ones (DEC-DEV-0117).',
    '',
    'USAGE:  node capability-probe.cjs --feature FM-002 [--root .]',
    '        node capability-probe.cjs --file path/to/FM.md',
    '',
    '→ JSON { capabilities:[{capability,secret_env,present,env_source,disposition,routes,surface,...}], summary }',
    'Disposition is DETERMINISTIC from the manifest (tier + dev_stand_in + env presence).',
    'Presence sources (DEC-DEV-0174): process.env, then `.env`, then `.env.local` under --root',
    '(non-empty values only; env_source discloses which source satisfied the secret).',
    'An absent secret with NO dev stand-in ⇒ BLOCK (the OD7 await is a deferred S7 leg).',
  ].join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  const file = args.file || resolveFeatureFile(args.feature, args.root);
  if (!file) {
    process.stdout.write(JSON.stringify({
      capability_schema_version: CAPABILITY_SCHEMA_VERSION,
      feature: args.feature || null,
      resolved: false,
      reason: 'feature file not found under .product/features',
      capabilities: [],
      summary: summarize([]),
    }, null, 2) + '\n');
    process.exit(0);
  }

  let fm = '';
  try { fm = readFrontmatter(file); } catch (e) {
    console.error(`ERROR: cannot read ${file}: ${e.message}`); process.exit(2);
  }
  const items = extractManifest(fm);
  // DEC-DEV-0174 (DEF-OD7-1): presence = process.env ∪ .env ∪ .env.local (see envPresence above).
  const surfaced = surface(items, envPresence(args.root));
  process.stdout.write(JSON.stringify({
    capability_schema_version: CAPABILITY_SCHEMA_VERSION,
    feature: args.feature || path.basename(file),
    resolved: true,
    file: path.relative(args.root || '.', file),
    capabilities: surfaced,
    summary: summarize(surfaced),
  }, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  CAPABILITY_SCHEMA_VERSION,
  DISPOSITION,
  ROUTE,
  FIELDS,
  parseManifestItem,
  extractManifest,
  dispositionFor,
  surface,
  summarize,
  parseEnvFileText,
  readEnvFiles,
  envPresence,
};
