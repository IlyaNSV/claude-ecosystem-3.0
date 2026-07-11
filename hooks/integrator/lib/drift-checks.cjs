#!/usr/bin/env node
'use strict';
/**
 * drift-checks.cjs — shared Integrator adapter-drift detection library.
 *
 * The single mechanical heart of the local-only drift model (DEC-DEV-0045,
 * tri-location DEC-DEV-0044), consumed by TWO callers so the D1/D2/D3 logic is
 * not copy-pasted a third time (update.md Stage 3 stays inline for now — its
 * migration onto this lib is a separate v1.1 refactor, DEC-DEV-0176 dec. 8):
 *   - hooks/integrator/drift-check.js — SessionStart proactive listener (warn-only)
 *   - commands/integrator/verify.md   — via the CLI seam (`--json`)
 *
 * Model (mirrors commands/integrator/update.md Stage 3 semantics, LOCAL-only —
 * NEVER cross-repo):
 *   D1 semver    — declared @target_tool_version range (adapter header or
 *                  active-tools.yaml) vs the tool version recorded offline in
 *                  active-tools.yaml (version_installed). Registry/live version
 *                  is NOT queried (offline budget) → if a needed input is
 *                  missing the axis returns `skipped`, never a false `drift`.
 *   D2 schema    — CONTRACT_SCHEMA_VERSION constant compared between the pilot
 *                  reference  <root>/.claude/adapters/<adapter>.js  and the
 *                  installed instance <root>/.claude/integrator/adapters/<adapter>.js.
 *   D3 body      — header-stripped body of those SAME two files compared.
 *   staleness    — per-tool last_audit in active-tools.yaml older than 90 days
 *                  (or absent) → stale flag.
 *
 * Adapter resolution (DEF-SMK-1, smoke-batch 2026-07-11): the tool→adapter link
 * does NOT live in active-tools.yaml. The real pilot schema keeps it in the
 * contracts under <root>/.claude/integrator/contracts/CNT-*.yaml — `consumer`
 * (or `contract.consumer`) names the tool, `transformation.script` points at the
 * adapter (`.claude/integrator/adapters/<name>.js`) when `transformation.type` is
 * `adapter_script` (or type is absent but a script is present). We therefore
 * resolve each tool's adapters from those contracts, UNION any legacy `adapter`
 * field on the active-tools record (kept for backward-compat). A tool may map to
 * >1 adapter → each axis is computed per adapter and the tool row reports the
 * worst-of (drift > ok > skipped). Adapter files that exist in BOTH the reference
 * and installed dirs yet are attributed to no tool are reported under a synthetic
 * `(unattributed)` row (safety net for contracts the tolerant parser could not
 * read). Before this fix the lib looked only at the (absent) `adapter` field, so
 * D1/D2/D3 always skipped as "no adapter declared" — blind to real drift.
 *
 * Detect-only. No mutation, no network. Every status ∈ 'ok' | 'drift' | 'skipped'.
 * Tolerant: a broken active-tools.yaml, a missing adapter file, or an
 * unreadable field degrades to `skipped` with a reason — it never throws out
 * of runDriftChecks().
 *
 * CLI seam:
 *   node hooks/integrator/lib/drift-checks.cjs --root <path> [--json]
 *   exit 0 ALWAYS (detect-only); non-zero only on an internal crash.
 */

const fs = require('fs');
const path = require('path');

const STALE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// YAML-lite parsing (no dependency; tolerant line-based parser tailored to the
// active-tools.yaml snapshot shape — SPEC §4.1 / §4.3). We only need a handful
// of scalar fields per tool, so deeper nested structures are skipped, not parsed.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip a trailing ` # comment` (or a full-line comment) when the '#' is not
 *  inside a quoted string. Conservative: leaves '#' that sits inside quotes. */
function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      // Only treat as a comment if at line start or preceded by whitespace.
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

/** Number of leading spaces (tabs count as one; mixed indent is rare here). */
function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].replace(/\t/g, ' ').length : 0;
}

/** Parse a scalar / inline-flow-list value string. '' → undefined (nested). */
function parseValue(raw) {
  const v = (raw == null ? '' : String(raw)).trim();
  if (v === '') return undefined;
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => stripQuotes(s.trim())).filter((s) => s !== '');
  }
  return stripQuotes(v);
}

function stripQuotes(s) {
  if (s.length >= 2) {
    const a = s[0];
    const b = s[s.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return s.slice(1, -1);
  }
  return s;
}

/**
 * Extract tool records from an active-tools.yaml text.
 * Supports both the list form (`tools:\n  - name: x\n    ...`) and the keyed-
 * mapping form (`tools:\n  x:\n    ...`), plus a bare top-level list fallback.
 * Returns [] on unparseable / empty input (tolerance — caller treats as "no state").
 * Each record: { name, version_installed?, target_tool_version?, adapter?, last_audit?, contracts? }
 */
function parseActiveTools(text) {
  if (typeof text !== 'string' || text.trim() === '') return [];
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // Keep non-blank, comment-stripped lines with their indent.
  const lines = [];
  for (const rl of rawLines) {
    const stripped = stripComment(rl);
    if (stripped.trim() === '') continue;
    if (stripped.trim() === '---' || stripped.trim() === '...') continue; // doc markers
    lines.push({ indent: indentOf(stripped), content: stripped.trim() });
  }
  if (lines.length === 0) return [];

  // Locate the `tools:` block, else fall back to a bare top-level list.
  let blockStart = -1;
  let blockParentIndent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].indent === 0 && /^tools:\s*$/.test(lines[i].content)) {
      blockStart = i + 1;
      blockParentIndent = 0;
      break;
    }
  }
  let block;
  if (blockStart >= 0) {
    block = [];
    for (let i = blockStart; i < lines.length; i += 1) {
      if (lines[i].indent <= blockParentIndent) break;
      block.push(lines[i]);
    }
  } else if (lines[0].indent === 0 && lines[0].content.startsWith('- ')) {
    // Bare top-level list of tool items.
    block = lines.filter((l) => l.indent === 0 || l.indent > 0);
  } else {
    return [];
  }
  if (!block || block.length === 0) return [];

  const baseIndent = block[0].indent;
  const isList = block[0].content.startsWith('- ');
  const records = [];

  if (isList) {
    let current = null;
    for (const line of block) {
      if (line.indent === baseIndent && line.content.startsWith('- ')) {
        if (current) records.push(current);
        current = {};
        const inline = line.content.slice(2).trim(); // after "- "
        applyField(current, inline);
      } else if (current && line.indent > baseIndent) {
        applyField(current, line.content);
      }
    }
    if (current) records.push(current);
  } else {
    // Keyed-mapping form: each tool name is a key at baseIndent.
    let current = null;
    let fieldIndent = -1;
    for (const line of block) {
      const keyMatch = line.content.match(/^([\w.@/-]+):\s*(.*)$/);
      if (line.indent === baseIndent && keyMatch && parseValue(keyMatch[2]) === undefined) {
        if (current) records.push(current);
        current = { name: keyMatch[1] };
        fieldIndent = -1;
      } else if (current && line.indent > baseIndent) {
        if (fieldIndent === -1) fieldIndent = line.indent;
        if (line.indent === fieldIndent) applyField(current, line.content);
        // deeper nested lines are ignored (we only need top scalars)
      }
    }
    if (current) records.push(current);
  }

  return records.filter((r) => r && (r.name || r.adapter || r.version_installed));
}

const FIELD_KEYS = new Set([
  'name', 'version_installed', 'target_tool_version', 'adapter',
  'last_audit', 'contracts', 'source', 'source_spec', 'installed_at',
]);

/** Apply a single `key: value` fragment to a record (only recognized scalar fields). */
function applyField(record, fragment) {
  const m = fragment.match(/^([\w.@/-]+):\s*(.*)$/);
  if (!m) return;
  const key = m[1];
  if (!FIELD_KEYS.has(key)) return;
  const value = parseValue(m[2]);
  if (value === undefined) return; // nested block → skip
  record[key] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter source helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the integer CONTRACT_SCHEMA_VERSION constant; null if not found. */
function extractSchemaVersion(source) {
  if (typeof source !== 'string') return null;
  const m = source.match(/CONTRACT_SCHEMA_VERSION\s*=\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Extract the declared @target_tool_version range from an adapter header; null if absent. */
function extractTargetVersion(source) {
  if (typeof source !== 'string') return null;
  const m = source.match(/@target_tool_version:\s*([^\s*][^\n]*)/);
  return m ? m[1].trim() : null;
}

/** Strip the leading JSDoc/comment header (mirror update.md D3): slice from the
 *  first `const CONTRACT_SCHEMA_VERSION` occurrence, else return LF-normalized whole. */
function stripAdapterHeader(source) {
  if (typeof source !== 'string') return '';
  const s = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const idx = s.indexOf('const CONTRACT_SCHEMA_VERSION');
  return idx >= 0 ? s.slice(idx) : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal semver-range satisfaction (offline, no dep). Returns true | false |
// null (unparseable → the D1 axis skips rather than lying).
// ─────────────────────────────────────────────────────────────────────────────

function parseSemver(v) {
  const m = String(v).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function cmpSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function semverSatisfies(version, range) {
  const ver = parseSemver(version);
  if (!ver) return null;
  let r = String(range).trim();
  if (r === '' || r === '*' || r === 'latest' || r === 'x') return true;

  // Comparator ranges: >=, >, <=, <, =
  const cmpMatch = r.match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (cmpMatch) {
    const bound = parseSemver(cmpMatch[2]);
    if (!bound) return null;
    const c = cmpSemver(ver, bound);
    switch (cmpMatch[1]) {
      case '>=': return c >= 0;
      case '<=': return c <= 0;
      case '>': return c > 0;
      case '<': return c < 0;
      case '=': return c === 0;
      default: return null;
    }
  }

  // Caret: ^1.2.3 → >=1.2.3 <2.0.0 (major-pinned; ^0.x has narrower rules but
  // we keep the common-case major pin — good enough for a warn-only listener).
  if (r.startsWith('^')) {
    const base = parseSemver(r.slice(1));
    if (!base) return null;
    if (cmpSemver(ver, base) < 0) return false;
    return ver[0] === base[0];
  }

  // Tilde: ~1.2.3 → >=1.2.3 <1.3.0 (minor-pinned).
  if (r.startsWith('~')) {
    const base = parseSemver(r.slice(1));
    if (!base) return null;
    if (cmpSemver(ver, base) < 0) return false;
    return ver[0] === base[0] && ver[1] === base[1];
  }

  // `1.x` / `1.2.x` wildcards.
  if (/x/i.test(r)) {
    const parts = r.split('.');
    for (let i = 0; i < parts.length; i += 1) {
      if (/^x$/i.test(parts[i]) || parts[i] === '*') break;
      if (parseInt(parts[i], 10) !== ver[i]) return false;
    }
    return true;
  }

  // Exact version.
  const exact = parseSemver(r);
  if (exact) return cmpSemver(ver, exact) === 0;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-axis checks (pure)
// ─────────────────────────────────────────────────────────────────────────────

function checkD1(declaredRange, installedVersion) {
  if (!declaredRange) return { status: 'skipped', detail: 'no declared @target_tool_version' };
  if (!installedVersion) return { status: 'skipped', detail: 'no version_installed recorded' };
  const ok = semverSatisfies(installedVersion, declaredRange);
  if (ok === null) return { status: 'skipped', detail: `unparseable range/version (${declaredRange} vs ${installedVersion})` };
  if (ok) return { status: 'ok', detail: `${installedVersion} in range ${declaredRange}` };
  return { status: 'drift', detail: `${installedVersion} out of range ${declaredRange}` };
}

function checkD2(refSource, insSource) {
  if (refSource == null) return { status: 'skipped', detail: 'reference adapter missing' };
  if (insSource == null) return { status: 'skipped', detail: 'installed instance missing' };
  const refV = extractSchemaVersion(refSource);
  const insV = extractSchemaVersion(insSource);
  if (refV == null || insV == null) {
    return { status: 'skipped', detail: `schema version not found (ref=${refV}, installed=${insV})` };
  }
  if (refV === insV) return { status: 'ok', detail: `schema=${refV} match` };
  if (insV < refV) return { status: 'drift', detail: `installed schema=${insV} < reference=${refV} (reference evolved)` };
  return { status: 'drift', detail: `installed schema=${insV} > reference=${refV} (installed ahead — investigate)` };
}

function checkD3(refSource, insSource) {
  if (refSource == null) return { status: 'skipped', detail: 'reference adapter missing' };
  if (insSource == null) return { status: 'skipped', detail: 'installed instance missing' };
  const refBody = stripAdapterHeader(refSource);
  const insBody = stripAdapterHeader(insSource);
  if (refBody === insBody) return { status: 'ok', detail: 'bodies identical (header-stripped)' };
  return { status: 'drift', detail: 'header-stripped bodies differ' };
}

function checkStaleness(lastAudit, now, thresholdDays) {
  const days = thresholdDays == null ? STALE_DAYS : thresholdDays;
  const nowMs = now == null ? Date.now() : (now instanceof Date ? now.getTime() : now);
  if (!lastAudit) return { stale: true, detail: 'no last_audit recorded' };
  const t = Date.parse(String(lastAudit));
  if (Number.isNaN(t)) return { stale: true, detail: `unparseable last_audit (${lastAudit})` };
  const ageDays = Math.floor((nowMs - t) / DAY_MS);
  if (ageDays > days) return { stale: true, detail: `last_audit ${lastAudit} is ${ageDays}d old (>${days}d)` };
  return { stale: false, detail: `last_audit ${lastAudit} is ${ageDays}d old` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract → adapter resolution (DEF-SMK-1)
// The tool→adapter link lives in .claude/integrator/contracts/CNT-*.yaml, not in
// active-tools.yaml. We only need three scalar paths per contract, so a tolerant
// nested-scalar walker is enough (lists/deeper structures ignored).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flatten a YAML-lite document to a { 'dotted.path': scalar } map. Blocks (keys
 * with no inline value) become path prefixes; list items (`- ...`) are skipped —
 * we only harvest the scalar leaves we care about. Tolerant: never throws.
 */
function parseNestedScalars(text) {
  const out = {};
  if (typeof text !== 'string' || text.trim() === '') return out;
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const stack = []; // { indent, key }
  for (const rl of rawLines) {
    const stripped = stripComment(rl);
    const t = stripped.trim();
    if (t === '' || t === '---' || t === '...') continue;
    if (t.startsWith('- ')) continue; // list item — not a scalar path we need
    const indent = indentOf(stripped);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const m = t.match(/^([\w.@/-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = parseValue(m[2]);
    if (val === undefined) {
      stack.push({ indent, key }); // nested block → becomes a path prefix
    } else {
      const dotted = stack.map((s) => s.key).concat(key).join('.');
      out[dotted] = val;
    }
  }
  return out;
}

/** Pull { consumer, transformationType, transformationScript } from a CNT text.
 *  Supports both the canonical nesting (`contract.consumer`, `transformation.*`)
 *  and a flat top-level fallback. Any field may be undefined. */
function extractContractFields(text) {
  const flat = parseNestedScalars(text);
  const pick = (nested, bare) => (flat[nested] != null ? flat[nested] : flat[bare]);
  return {
    consumer: pick('contract.consumer', 'consumer'),
    transformationType: pick('transformation.type', 'type'),
    transformationScript: pick('transformation.script', 'script'),
  };
}

/** basename of a script path, tolerant of both `/` and `\` regardless of host OS. */
function scriptBasename(scriptPath) {
  if (!scriptPath) return null;
  const parts = String(scriptPath).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Scan <root>/.claude/integrator/contracts/CNT-*.{yaml,yml} and build a map
 * consumer(tool name) → [adapterFile...] (deduped, `.js`-suffixed basenames).
 * Only contracts whose transformation is an adapter_script (or has a script with
 * no explicit type) contribute. A broken/unreadable contract is skipped, never
 * fatal. Returns an empty Map when the contracts dir is absent.
 */
function resolveContractAdapters(root) {
  const map = new Map();
  const dir = path.join(root, '.claude', 'integrator', 'contracts');
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (_) {
    return map;
  }
  for (const f of files) {
    if (!/^CNT-.*\.ya?ml$/i.test(f)) continue;
    const text = readFileSafe(path.join(dir, f));
    if (text == null) continue;
    let fields;
    try {
      fields = extractContractFields(text);
    } catch (_) {
      continue; // tolerant: unparseable contract → skip (falls to unattributed net)
    }
    const { consumer, transformationType, transformationScript } = fields;
    if (!consumer || !transformationScript) continue;
    // Only adapter_script contracts declare an adapter; type absent + script → accept.
    if (transformationType && transformationType !== 'adapter_script') continue;
    const adapterFile = adapterFileName(scriptBasename(transformationScript));
    if (!adapterFile) continue;
    if (!map.has(consumer)) map.set(consumer, []);
    const arr = map.get(consumer);
    if (!arr.includes(adapterFile)) arr.push(adapterFile);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration
// ─────────────────────────────────────────────────────────────────────────────

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_) {
    return null;
  }
}

/** Resolve the adapter basename to a `<name>.js` filename (idempotent). */
function adapterFileName(adapter) {
  if (!adapter) return null;
  return /\.js$/.test(adapter) ? adapter : `${adapter}.js`;
}

/** List `*.js` filenames in a dir (tolerant: missing dir → []). */
function listAdapterFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => /\.js$/i.test(f));
  } catch (_) {
    return [];
  }
}

// Axis status ordering for worst-of collapse: skipped < ok < drift.
const STATUS_RANK = { skipped: 0, ok: 1, drift: 2 };

/**
 * Collapse per-adapter results for ONE axis to a single verdict. Single adapter →
 * the raw check result (preserves its exact detail). Multiple → worst-of by rank,
 * detail enumerating each adapter's status.
 * @param {Array<{af:string,res:{status:string,detail:string}}>} entries
 */
function reduceAxis(entries) {
  if (!entries || entries.length === 0) {
    return { status: 'skipped', detail: 'no adapter declared for tool' };
  }
  if (entries.length === 1) return entries[0].res;
  let worst = entries[0];
  for (const e of entries) {
    const r = STATUS_RANK[e.res.status] == null ? 0 : STATUS_RANK[e.res.status];
    const w = STATUS_RANK[worst.res.status] == null ? 0 : STATUS_RANK[worst.res.status];
    if (r > w) worst = e;
  }
  const detail = entries.map((e) => `${e.af}=${e.res.status} (${e.res.detail})`).join('; ');
  return { status: worst.res.status, detail: `worst-of ${entries.length} adapters — ${detail}` };
}

/**
 * Run all drift checks against a project root.
 * @param {string} root project root containing `.claude/`
 * @param {object} [opts] { now?: Date|number, thresholdDays?: number }
 * @returns {{ tools: Array, summary: {driftCount:number, staleCount:number, checkedTools:number}, note?: string }}
 */
function runDriftChecks(root, opts) {
  const options = opts || {};
  const activeToolsPath = path.join(root, '.claude', 'integrator', 'active-tools.yaml');
  if (!fs.existsSync(activeToolsPath)) {
    return { tools: [], summary: { driftCount: 0, staleCount: 0, checkedTools: 0 }, note: 'no Integrator state' };
  }

  const text = readFileSafe(activeToolsPath);
  if (text == null) {
    return { tools: [], summary: { driftCount: 0, staleCount: 0, checkedTools: 0 }, note: 'active-tools.yaml unreadable' };
  }

  let records;
  try {
    records = parseActiveTools(text);
  } catch (e) {
    return {
      tools: [],
      summary: { driftCount: 0, staleCount: 0, checkedTools: 0 },
      note: `active-tools.yaml unparseable (${e.message})`,
    };
  }

  if (!records || records.length === 0) {
    return { tools: [], summary: { driftCount: 0, staleCount: 0, checkedTools: 0 }, note: 'no tools in active-tools.yaml' };
  }

  const refDir = path.join(root, '.claude', 'adapters');
  const insDir = path.join(root, '.claude', 'integrator', 'adapters');

  // DEF-SMK-1: the real tool→adapter link lives in the contracts, not on the
  // active-tools record. Resolve consumer(tool) → [adapters] once up front.
  const contractMap = resolveContractAdapters(root);

  const tools = [];
  const attributed = new Set(); // adapter files claimed by some tool (any source)
  let driftCount = 0;
  let staleCount = 0;

  // Compute the D1/D2/D3 trio for a single adapter file against the two dirs.
  function axesFor(adapterFile, rec) {
    const refSource = readFileSafe(path.join(refDir, adapterFile));
    const insSource = readFileSafe(path.join(insDir, adapterFile));
    // D1: prefer the declared range from active-tools; fall back to the installed
    // adapter header (that is what update.md reads when the yaml lacks it).
    const declaredRange = (rec && rec.target_tool_version)
      || (insSource && extractTargetVersion(insSource))
      || (refSource && extractTargetVersion(refSource))
      || null;
    return {
      d1: checkD1(declaredRange, rec && rec.version_installed),
      d2: checkD2(refSource, insSource),
      d3: checkD3(refSource, insSource),
    };
  }

  for (const rec of records) {
    // Adapter sources per tool: legacy `adapter` field ∪ contract-resolved,
    // deduped by basename. The contract link is the real-world path (DEF-SMK-1).
    const adapterFiles = [];
    const pushAdapter = (af) => { if (af && !adapterFiles.includes(af)) adapterFiles.push(af); };
    pushAdapter(adapterFileName(rec.adapter));
    for (const af of (contractMap.get(rec.name) || [])) pushAdapter(af);
    for (const af of adapterFiles) attributed.add(af);

    let d1;
    let d2;
    let d3;
    if (adapterFiles.length === 0) {
      const none = { status: 'skipped', detail: 'no adapter declared for tool' };
      d1 = { ...none };
      d2 = { ...none };
      d3 = { ...none };
    } else {
      const e1 = [];
      const e2 = [];
      const e3 = [];
      for (const af of adapterFiles) {
        const ax = axesFor(af, rec);
        e1.push({ af, res: ax.d1 });
        e2.push({ af, res: ax.d2 });
        e3.push({ af, res: ax.d3 });
      }
      d1 = reduceAxis(e1);
      d2 = reduceAxis(e2);
      d3 = reduceAxis(e3);
    }

    const staleness = checkStaleness(rec.last_audit, options.now, options.thresholdDays);

    const anyDrift = d1.status === 'drift' || d2.status === 'drift' || d3.status === 'drift';
    if (anyDrift) driftCount += 1;
    if (staleness.stale) staleCount += 1;

    tools.push({
      tool: rec.name || rec.adapter || '(unnamed)',
      adapter: adapterFiles.length ? adapterFiles.join(', ') : null,
      d1,
      d2,
      d3,
      staleness,
    });
  }

  // Unattributed pairs (safety net): adapter files present in BOTH the reference
  // and installed dirs but claimed by no tool contract. Check D2/D3 so drift is
  // still surfaced; staleness is n/a (no tool → no last_audit) and excluded from
  // staleCount. Drift here DOES count toward driftCount.
  const refFiles = new Set(listAdapterFiles(refDir));
  for (const af of listAdapterFiles(insDir)) {
    if (attributed.has(af) || !refFiles.has(af)) continue;
    const ax = axesFor(af, null);
    const anyDrift = ax.d2.status === 'drift' || ax.d3.status === 'drift';
    if (anyDrift) driftCount += 1;
    tools.push({
      tool: '(unattributed)',
      adapter: af,
      d1: { status: 'skipped', detail: 'unattributed adapter — tool/version unknown' },
      d2: ax.d2,
      d3: ax.d3,
      staleness: { stale: false, detail: 'n/a' },
    });
  }

  return {
    tools,
    summary: { driftCount, staleCount, checkedTools: tools.length },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting (human + JSON) for the CLI seam and the hook note
// ─────────────────────────────────────────────────────────────────────────────

/** Build a compact one-line-per-tool summary of drift/stale tools (for the hook). */
function summarizeDriftLines(result) {
  const lines = [];
  for (const t of result.tools) {
    const flags = [];
    if (t.d1 && t.d1.status === 'drift') flags.push(`semver (${t.d1.detail})`);
    if (t.d2 && t.d2.status === 'drift') flags.push(`schema (${t.d2.detail})`);
    if (t.d3 && t.d3.status === 'drift') flags.push('body drift');
    if (t.staleness && t.staleness.stale) flags.push(`stale (${t.staleness.detail})`);
    if (flags.length) lines.push(`  - ${t.tool}: ${flags.join('; ')}`);
  }
  return lines;
}

function renderHuman(result) {
  const out = [];
  out.push('Integrator drift detection (local-only; detect-only)');
  if (result.note) out.push(`  note: ${result.note}`);
  for (const t of result.tools) {
    out.push('');
    out.push(`${t.tool} (adapter: ${t.adapter || '—'})`);
    out.push(`  D1 semver: ${t.d1.status} — ${t.d1.detail}`);
    out.push(`  D2 schema: ${t.d2.status} — ${t.d2.detail}`);
    out.push(`  D3 body:   ${t.d3.status} — ${t.d3.detail}`);
    out.push(`  staleness: ${t.staleness.stale ? 'STALE' : 'fresh'} — ${t.staleness.detail}`);
  }
  out.push('');
  out.push(`Summary: ${result.summary.driftCount} drifting, ${result.summary.staleCount} stale of ${result.summary.checkedTools} tool(s).`);
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI seam
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { root: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') { args.root = argv[i + 1]; i += 1; }
    else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

function cliMain() {
  const args = parseArgs(process.argv.slice(2));
  const result = runDriftChecks(args.root);
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(renderHuman(result) + '\n');
  }
  // Detect-only: always exit 0 (drift is reported, not an error condition).
  process.exit(0);
}

if (require.main === module) {
  try {
    cliMain();
  } catch (e) {
    // Internal crash only — this is the sole non-zero exit path.
    process.stderr.write(`[drift-checks] internal error: ${(e && e.stack) || e}\n`);
    process.exit(1);
  }
}

module.exports = {
  runDriftChecks,
  parseActiveTools,
  parseNestedScalars,
  extractContractFields,
  resolveContractAdapters,
  scriptBasename,
  reduceAxis,
  parseValue,
  stripComment,
  extractSchemaVersion,
  extractTargetVersion,
  stripAdapterHeader,
  semverSatisfies,
  checkD1,
  checkD2,
  checkD3,
  checkStaleness,
  summarizeDriftLines,
  renderHuman,
  adapterFileName,
  STALE_DAYS,
};
