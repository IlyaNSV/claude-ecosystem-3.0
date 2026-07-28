#!/usr/bin/env node
'use strict';
/**
 * status-collector.cjs — deterministic, read-only census of a Product Module.
 *
 * Purpose (DEC-DEV-0217): /product:status is prompt-only today — its completeness
 * depends on model discipline (does the model remember to list every dir, every
 * pending queue, every ghost reference?). This lib is the deterministic backbone:
 * one machine pass over `.product/` + the `.claude/` product config that emits a
 * stable JSON snapshot the command can render without re-deriving counts by hand.
 *
 * Model:
 *   1. Census the typed artifact dirs (features/scenarios/... + mockups split into
 *      MK/NM) and the root singletons (rpm/design-system/glossary/...).
 *   2. Handoffs + their staleness — REUSED from the Integrator lib, never
 *      reimplemented (orchestrate-don't-duplicate).
 *   3. Pending queues (`.product/.pending/*.yaml`) with a GHOST check: a queue
 *      entry can reference an artifact that no longer exists on disk (real
 *      precedent: an isolated smoke commit left FM-008/MK-008/NM-008/FM-SG-TEST/
 *      SC-030/SC-031 refs in untracked queues). We resolve every ref against a
 *      live index of `.product/**\/*.md` and flag the dangling ones.
 *   4. Session, DA findings, stale drafts, integrator/pending-actions integration.
 *
 * Ghost resolution (why an entry is flagged): each entry contributes a PRIMARY ref
 * (first present of artifact | source_artifact | triggered_by | source_mk) plus
 * SECONDARY refs (the remaining ones). The entry is a ghost if ANY of them fails to
 * resolve. This is load-bearing: app-map-pending entries carry `artifact: AM`
 * (alive — app-map.md has id AM) yet must flag on their `triggered_by` ghost, while
 * cascade-pending entries flag on their `artifact` (SC-030/SC-031). A single fixed
 * field priority can't satisfy both; "any ref dangling ⇒ ghost" does.
 *
 * Ref resolve steps (per ref): exact hit in the live index (basename | short-id |
 * frontmatter id) → alive; else short-id /^[A-Z]{2,5}-\d+/ of the ref hits the index
 * → alive; else the ref is an id-prefix of some basename → alive; else ghost. A
 * non-numeric ref like `FM-SG-TEST` has no /^[A-Z]{2,5}-\d+/ short-id, so it can
 * only survive via exact/prefix match — and correctly falls through to ghost.
 *
 * Tolerant, never throws: any per-section failure is captured in notes[] and the
 * pass continues. `.product/` absent → { initialized:false }. Hand-rolled YAML/
 * frontmatter parsing only — NO npm deps (not even js-yaml). CRLF-normalized.
 * READ-ONLY: this lib never writes anywhere. CLI always exits 0; non-zero only on
 * an internal crash.
 *
 * Output schema (stable contract, schema: 1):
 *   { schema, generated_at, root, initialized,
 *     config:       { present, project_name, project_language, validation_tier,
 *                     default_discovery_mode, ecosystem_version,
 *                     product_class:{archetype,distribution,data_sensitivity},
 *                     domain_fit:{subcategory,score,threshold,verdict} },
 *     artifacts:    { total_typed,
 *                     byType: { <DIR|MK|NM>: { dir, total, byStatus, items:[{file,id,status,version,updated}] } },
 *                     singletons: [ {file,id,type,status,version,updated, ...special} ] },
 *     handoffs:     { total, byStatus, items:[{file,feature,status,version,generated_at}],
 *                     staleness:{ available, source, verdicts } },
 *     pending:      { queues:[{file,entries,ghosts,items:[{ref,secondary_refs,status_or_action,queued_at,ghost}]}],
 *                     total_entries, total_ghosts },
 *     session:      { present, ...current.yaml scalars, last_artifact_exists },
 *     da_findings:  { total, latest5:[filename] },
 *     stale_drafts_over_14d: { count, items },
 *     integrations: { integrator:{present,tools_count,tool_names},
 *                     pending_actions:{present,total,marker_counts,status_counts} },
 *     notes: [ warnings about anything unparseable ] }
 *
 *   byType keys are the directory names listed below, except `mockups` which is
 *   split into `MK` and `NM` (each with dir:"mockups") by filename prefix.
 *   The `nfr` entry additionally carries per-item `scope` + an `nfr_scope`
 *   aggregate. The glossary singleton's `term_sections` is an APPROXIMATE count
 *   (`### ` headings in the body) — marked with `term_sections_approximate:true`.
 *   REF_FIELDS extends the spec's artifact|source_artifact|triggered_by trio with
 *   `source_mk` (the only ref field ds-pending entries carry).
 *   `pending_actions.status_counts` tallies `**Status:** <value>` body lines
 *   (the actual PA status carrier per commands/ecosystem/pending-actions.md);
 *   it is line-based, not entry-based — an entry re-statused in place can
 *   contribute several lines, so treat it as an approximate signal.
 *
 * CLI seam:
 *   node hooks/product/lib/status-collector.cjs --root <path> [--json] [--now <ISO>]
 *   (--json accepted for symmetry; output is ALWAYS pretty JSON on stdout.)
 */

const fs = require('fs');
const path = require('path');

// The Integrator-side staleness check — same relative path in the repo (hooks/…)
// and in an installation (.claude/hooks/…). Required lazily inside a try/catch so a
// resolution failure degrades to { available:false } rather than crashing the pass.
const STALENESS_REL = '../../integrator/lib/handoff-staleness.cjs';

// Typed artifact dirs → byType key. mockups is handled separately (MK/NM split).
const TYPED_DIRS = [
  'segments', 'value-propositions', 'hypotheses', 'features', 'scenarios',
  'business-rules', 'lifecycles', 'verification', 'invariants', 'nfr', 'notes',
  'releases',
];

// Root singletons that carry extra machine-readable structure worth surfacing.
const SINGLETON_SPECIAL = {
  'rpm.md': 'rpm',
  'design-system.md': 'design-system',
  'glossary.md': 'glossary',
};

// Pending-queue ref fields, in primary-preference order. First present ⇒ primary;
// the rest ⇒ secondary. `source_mk` extends the spec's trio for ds-pending.
const REF_FIELDS = ['artifact', 'source_artifact', 'triggered_by', 'source_mk'];

// pending-actions.md status markers counted in ## PA- headers (case-insensitive).
const PA_MARKERS = ['open', 'deferred', 'done', 'ratified', 'resolved', 'implemented'];

const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Small tolerant helpers
// ─────────────────────────────────────────────────────────────────────────────

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
}

function normalize(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function existsSafe(p) {
  try { return fs.existsSync(p); } catch (_) { return false; }
}

function readdirSafe(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return null; }
}

/** Strip a trailing `# comment`, surrounding quotes; coerce a plain integer. */
function cleanScalar(raw) {
  let v = String(raw).trim();
  if (v === '') return '';
  const q = v[0];
  if (q === '"' || q === "'") {
    const end = v.indexOf(q, 1);
    if (end !== -1) return v.slice(1, end);
    return v.slice(1);
  }
  v = v.replace(/\s+#.*$/, '').trim();
  v = v.replace(/^["']|["']$/g, '');
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  return v;
}

/** Split a normalized doc into { fm: {flat scalars}, body: string }. Tolerant. */
function splitFrontmatter(content) {
  const norm = normalize(content);
  const m = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: norm };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const km = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (km) fm[km[1]] = km[2].replace(/^["']|["']$/g, '');
  }
  return { fm, body: m[2] };
}

/** Frontmatter scalars only (first block). */
function parseFrontmatterFlat(content) {
  return splitFrontmatter(content).fm;
}

/** List *.md files directly inside dir (non-recursive). */
function listMd(dir) {
  const ents = readdirSafe(dir);
  if (!ents) return [];
  return ents.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort();
}

/** All *.md paths under dir, recursively (incl. dot-directories). */
function walkMd(dir, out) {
  out = out || [];
  const ents = readdirSafe(dir);
  if (!ents) return out;
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(full, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ghost index + ref resolution
// ─────────────────────────────────────────────────────────────────────────────

const SHORT_ID_FROM_BASENAME = /^([A-Z]{2,5}-[A-Za-z0-9]+)/;
const NUMERIC_SHORT_ID = /^[A-Z]{2,5}-\d+/;

/**
 * Build a Set of live identifiers from every `.product/**\/*.md`:
 *   (a) full basename without .md, (b) short id from basename, (c) frontmatter id.
 */
function buildLiveIndex(productDir, notes) {
  const index = new Set();
  for (const p of walkMd(productDir)) {
    const base = path.basename(p, '.md');
    index.add(base);
    const sm = base.match(SHORT_ID_FROM_BASENAME);
    if (sm) index.add(sm[1]);
    const content = readFileSafe(p);
    if (content == null) { notes.push(`unreadable while indexing: ${p}`); continue; }
    const fm = parseFrontmatterFlat(content);
    if (fm.id) index.add(fm.id);
  }
  return index;
}

/** Resolve a single ref against the live index. Returns true when alive. */
function refIsAlive(ref, index) {
  if (ref == null) return true;
  const r = String(ref).trim();
  if (r === '') return true;
  if (index.has(r)) return true;
  const m = r.match(NUMERIC_SHORT_ID);
  if (m && index.has(m[0])) return true;
  for (const key of index) {
    if (key === r || key.startsWith(r + '-')) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config (.claude/product.yaml) — tolerant nested-scalar read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse product.yaml into { top:{}, sections:{name:{}} } — top-level scalars plus
 * one level of nested maps. Only direct children of a section are captured (so a
 * deeper sub-list like domain_fit.hybrid_components can't overwrite subcategory).
 */
function parseNestedYaml(content) {
  const lines = normalize(content).split('\n');
  const top = {};
  const sections = {};
  let curSection = null;
  let childIndent = null;
  for (const raw of lines) {
    if (raw.trim() === '' || /^\s*#/.test(raw)) continue;
    const indent = raw.match(/^(\s*)/)[1].length;
    if (indent === 0) {
      curSection = null; childIndent = null;
      const m = raw.match(/^([\w-]+):\s*(.*)$/);
      if (!m) continue;
      if (m[2].trim() === '') { curSection = m[1]; sections[m[1]] = {}; }
      else top[m[1]] = cleanScalar(m[2]);
    } else if (curSection) {
      if (childIndent === null) childIndent = indent;
      if (indent !== childIndent) continue; // deeper nesting — ignore
      const m = raw.match(/^\s+([\w-]+):\s*(.*)$/);
      if (m && m[2].trim() !== '') sections[curSection][m[1]] = cleanScalar(m[2]);
    }
  }
  return { top, sections };
}

function collectConfig(root, notes) {
  const p = path.join(root, '.claude', 'product.yaml');
  const content = readFileSafe(p);
  if (content == null) return { present: false };
  let parsed;
  try { parsed = parseNestedYaml(content); }
  catch (e) { notes.push(`product.yaml unparseable (${e.message})`); return { present: false }; }
  const t = parsed.top;
  const pc = parsed.sections.product_class || {};
  const df = parsed.sections.domain_fit || {};
  return {
    present: true,
    project_name: t.project_name ?? null,
    project_language: t.project_language ?? null,
    validation_tier: t.validation_tier ?? null,
    default_discovery_mode: t.default_discovery_mode ?? null,
    ecosystem_version: t.ecosystem_version ?? null,
    product_class: {
      archetype: pc.archetype ?? null,
      distribution: pc.distribution ?? null,
      data_sensitivity: pc.data_sensitivity ?? null,
    },
    domain_fit: {
      subcategory: df.subcategory ?? null,
      score: df.score ?? null,
      threshold: df.threshold ?? null,
      verdict: df.verdict ?? null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifacts census (typed dirs + singletons)
// ─────────────────────────────────────────────────────────────────────────────

function bumpStatus(byStatus, status) {
  const key = status || 'unknown';
  byStatus[key] = (byStatus[key] || 0) + 1;
}

function artifactItem(dir, file, fm) {
  return {
    file,
    id: fm.id || null,
    status: fm.status || null,
    version: fm.version != null ? cleanScalar(fm.version) : null,
    updated: fm.updated || fm.last_updated || null,
  };
}

function censusDir(productDir, dirName) {
  const byType = { dir: dirName, total: 0, byStatus: {}, items: [] };
  for (const file of listMd(path.join(productDir, dirName))) {
    const content = readFileSafe(path.join(productDir, dirName, file));
    const fm = content == null ? {} : parseFrontmatterFlat(content);
    const item = artifactItem(dirName, file, fm);
    if (dirName === 'nfr') item.scope = fm.scope || null;
    byType.items.push(item);
    byType.total += 1;
    bumpStatus(byType.byStatus, item.status);
  }
  if (dirName === 'nfr') {
    byType.nfr_scope = {
      per_feature: byType.items.filter((i) => i.scope === 'per_feature').length,
      global: byType.items.filter((i) => i.scope === 'global').length,
    };
  }
  return byType;
}

/** Count entries in a `key: [a, b]` inline list OR a following `- item` block. */
function countListField(content, key) {
  const norm = normalize(content);
  const lines = norm.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(new RegExp(`^${key}:\\s*(.*)$`));
    if (!m) continue;
    const inline = m[1].trim();
    if (inline.startsWith('[')) {
      const inner = inline.replace(/^\[/, '').replace(/\]$/, '').trim();
      if (inner === '') return 0;
      return inner.split(',').map((s) => s.trim()).filter(Boolean).length;
    }
    // multi-line list: count following `  - ` lines
    let n = 0;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s*-\s+/.test(lines[j])) n += 1;
      else if (/^\S/.test(lines[j])) break; // next top-level key
      else if (lines[j].trim() === '') continue;
    }
    return n;
  }
  return null;
}

function collectSingletons(productDir) {
  const singletons = [];
  const ents = readdirSafe(productDir) || [];
  const files = ents.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort();
  for (const file of files) {
    const content = readFileSafe(path.join(productDir, file));
    const { fm, body } = content == null ? { fm: {}, body: '' } : splitFrontmatter(content);
    const item = {
      file,
      id: fm.id || null,
      type: fm.type || null,
      status: fm.status || null,
      version: fm.version != null ? cleanScalar(fm.version) : null,
      updated: fm.updated || fm.last_updated || null,
    };
    const special = SINGLETON_SPECIAL[file];
    if (special === 'rpm' && content != null) {
      const rc = countListField(content, 'roles');
      item.roles_count = rc == null ? null : rc;
    } else if (special === 'design-system') {
      item.token_count = fm.token_count != null ? cleanScalar(fm.token_count) : null;
      item.component_count = fm.component_count != null ? cleanScalar(fm.component_count) : null;
      item.pattern_count = fm.pattern_count != null ? cleanScalar(fm.pattern_count) : null;
    } else if (special === 'glossary') {
      const headings = (body.match(/^###\s/gm) || []).length;
      item.term_sections = headings;
      item.term_sections_approximate = true;
    }
    singletons.push(item);
  }
  return singletons;
}

function collectArtifacts(productDir) {
  const byType = {};
  let totalTyped = 0;
  for (const dirName of TYPED_DIRS) {
    const entry = censusDir(productDir, dirName);
    byType[dirName] = entry;
    totalTyped += entry.total;
  }
  // mockups → MK / NM split (top-level *.md only; assets/** ignored by listMd).
  const mk = { dir: 'mockups', total: 0, byStatus: {}, items: [] };
  const nm = { dir: 'mockups', total: 0, byStatus: {}, items: [] };
  for (const file of listMd(path.join(productDir, 'mockups'))) {
    const content = readFileSafe(path.join(productDir, 'mockups', file));
    const fm = content == null ? {} : parseFrontmatterFlat(content);
    const item = artifactItem('mockups', file, fm);
    const bucket = file.startsWith('NM') ? nm : mk;
    bucket.items.push(item);
    bucket.total += 1;
    bumpStatus(bucket.byStatus, item.status);
  }
  byType.MK = mk;
  byType.NM = nm;
  totalTyped += mk.total + nm.total;
  return { total_typed: totalTyped, byType, singletons: collectSingletons(productDir) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handoffs + staleness (reuse the Integrator lib)
// ─────────────────────────────────────────────────────────────────────────────

function collectHandoffs(root, notes) {
  const dir = path.join(root, '.product', 'handoffs');
  const result = { total: 0, byStatus: {}, items: [], staleness: { available: false, source: null, verdicts: [] } };
  for (const file of listMd(dir)) {
    const content = readFileSafe(path.join(dir, file));
    const fm = content == null ? {} : parseFrontmatterFlat(content);
    result.items.push({
      file,
      feature: fm.feature || null,
      status: fm.status || null,
      version: fm.version != null ? cleanScalar(fm.version) : null,
      generated_at: fm.generated_at || null,
    });
    result.total += 1;
    bumpStatus(result.byStatus, fm.status || null);
  }
  // Staleness — try the exported API, then the CLI, else degrade gracefully.
  result.staleness = computeStaleness(root, notes);
  return result;
}

function computeStaleness(root, notes) {
  try {
    const lib = require(STALENESS_REL);
    if (lib && typeof lib.computeHandoffStaleness === 'function') {
      const r = lib.computeHandoffStaleness(root);
      return {
        available: true,
        source: 'lib:computeHandoffStaleness',
        verdicts: (r.handoffs || []).map((h) => ({
          handoff: h.handoff,
          feature: h.feature || null,
          status: h.status,
          stale_artifacts: h.stale_artifacts || [],
          missing_artifacts: h.missing_artifacts || [],
        })),
        summary: r.summary || null,
        ...(r.note ? { note: r.note } : {}),
      };
    }
    notes.push('handoff-staleness lib present but computeHandoffStaleness not exported; trying CLI');
  } catch (e) {
    notes.push(`handoff-staleness require failed (${e.message}); trying CLI`);
  }
  try {
    const cp = require('child_process');
    const libPath = path.join(__dirname, STALENESS_REL);
    const out = cp.execFileSync(process.execPath, [libPath, '--root', root, '--json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    const r = JSON.parse(out);
    return {
      available: true,
      source: 'cli:handoff-staleness',
      verdicts: (r.handoffs || []).map((h) => ({
        handoff: h.handoff,
        feature: h.feature || null,
        status: h.status,
        stale_artifacts: h.stale_artifacts || [],
        missing_artifacts: h.missing_artifacts || [],
      })),
      summary: r.summary || null,
      ...(r.note ? { note: r.note } : {}),
    };
  } catch (e) {
    return { available: false, source: null, verdicts: [], note: `staleness unavailable (${e.message})` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending queues + ghost check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hand-rolled tolerant parse of a `.pending/*.yaml` queue into a list of entry
 * objects ({key:value} maps). Handles: entries under an `entries:`/`candidates:`
 * key, a top-level `- ` list, and block scalars (`key: |`) whose indented content
 * is skipped so it can't masquerade as fields or split entries. Never throws.
 * Returns { entries:[{...}], listCount, unparseable }.
 */
function parseQueue(content) {
  const lines = normalize(content).split('\n');
  // Locate item indent: the indentation of the first `- ` list dash.
  let itemIndent = null;
  for (const line of lines) {
    const m = line.match(/^(\s*)-\s+/);
    if (m) { itemIndent = m[1].length; break; }
  }
  if (itemIndent === null) return { entries: [], listCount: 0, unparseable: false };

  const entries = [];
  let cur = null;
  let listCount = 0;
  let skipDeeperThan = null; // block-scalar guard: skip lines more indented than this

  for (const line of lines) {
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    const indent = line.match(/^(\s*)/)[1].length;

    if (skipDeeperThan !== null) {
      if (indent > skipDeeperThan) continue; // inside block scalar
      skipDeeperThan = null;
    }

    const dash = line.match(/^(\s*)-\s+(.*)$/);
    if (dash && dash[1].length === itemIndent) {
      listCount += 1;
      cur = {};
      entries.push(cur);
      // first field lives on the dash line: `- key: value`
      const kv = dash[2].match(/^([\w-]+):\s*(.*)$/);
      if (kv) applyField(cur, kv[1], kv[2], indent + 2, (d) => { skipDeeperThan = d; });
      continue;
    }
    if (!cur) continue; // preamble before first entry
    const kv = line.match(/^\s+([\w-]+):\s*(.*)$/);
    if (kv) applyField(cur, kv[1], kv[2], indent, (d) => { skipDeeperThan = d; });
  }
  return { entries, listCount, unparseable: false };
}

/** Record a field on an entry; arm block-scalar skip on `|`/`>` values. */
function applyField(entry, key, rawVal, keyIndent, armSkip) {
  const v = rawVal.trim();
  if (v === '|' || v === '>' || v === '|-' || v === '>-' || v === '|+' || v === '>+') {
    armSkip(keyIndent);
    return;
  }
  if (!(key in entry)) entry[key] = cleanScalar(v); // first occurrence wins
}

function queueEntryRefs(entry) {
  let primary = null;
  const secondary = [];
  for (const f of REF_FIELDS) {
    if (entry[f] == null || String(entry[f]).trim() === '') continue;
    if (primary === null) primary = String(entry[f]).trim();
    else secondary.push(String(entry[f]).trim());
  }
  return { primary, secondary };
}

function collectPending(productDir, index, notes) {
  const pendingDir = path.join(productDir, '.pending');
  const ents = readdirSafe(pendingDir);
  const queues = [];
  let totalEntries = 0;
  let totalGhosts = 0;
  if (!ents) return { queues, total_entries: 0, total_ghosts: 0 };

  const files = ents.filter((e) => e.isFile() && e.name.endsWith('.yaml')).map((e) => e.name).sort();
  for (const file of files) {
    const content = readFileSafe(path.join(pendingDir, file));
    const q = { file, entries: 0, ghosts: 0, items: [] };
    if (content == null) { q.note = 'unreadable'; queues.push(q); continue; }

    let parsed;
    try { parsed = parseQueue(content); }
    catch (e) { parsed = { entries: [], listCount: 0, unparseable: true }; notes.push(`${file}: parse error (${e.message})`); }

    if (parsed.unparseable || parsed.entries.length === 0) {
      const norm = normalize(content);
      // Fallback: count raw list dashes so a malformed queue still surfaces a size.
      const rawCount = (norm.match(/^\s*-\s+/gm) || []).length;
      // A drained queue is a VALID state, not a parse failure: `entries: []`,
      // `candidates: []`, a bare `[]` document, or a lone `key:` with nothing
      // under it (live precedent: the ghost-cleanup pass leaves exactly these
      // forms behind, and they were misreported as 'unparseable').
      const looksEmptyList = rawCount === 0 && (
        /^\s*[\w-]+:\s*\[\s*\]\s*$/m.test(norm)
        || /^\s*\[\s*\]\s*$/m.test(norm)
        || norm.split('\n').every((l) => l.trim() === '' || l.trim().startsWith('#') || /^[\w-]+:\s*$/.test(l.trim()))
      );
      if (!parsed.unparseable && looksEmptyList) {
        q.entries = 0; // legitimately empty queue — no note
      } else {
        q.entries = rawCount;
        q.note = 'unparseable';
        if (rawCount > 0) notes.push(`${file}: parsed 0 structured entries, ${rawCount} raw list item(s) — see note`);
        else notes.push(`${file}: no parseable entries and not an empty-list form — inspect manually`);
      }
      totalEntries += q.entries;
      queues.push(q);
      continue;
    }

    for (const entry of parsed.entries) {
      const { primary, secondary } = queueEntryRefs(entry);
      const ghost = !refIsAlive(primary, index) || secondary.some((s) => !refIsAlive(s, index));
      q.items.push({
        ref: primary,
        secondary_refs: secondary,
        status_or_action: entry.status || entry.action || null,
        queued_at: entry.queued_at || entry.at || entry.extraction_at || null,
        ghost,
      });
      if (ghost) q.ghosts += 1;
    }
    q.entries = parsed.entries.length;
    totalEntries += q.entries;
    totalGhosts += q.ghosts;
    queues.push(q);
  }
  return { queues, total_entries: totalEntries, total_ghosts: totalGhosts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Session, DA findings, stale drafts, integrations
// ─────────────────────────────────────────────────────────────────────────────

function collectSession(root) {
  const p = path.join(root, '.product', '.sessions', 'current.yaml');
  const content = readFileSafe(p);
  if (content == null) return { present: false };
  const out = { present: true };
  for (const line of normalize(content).split('\n')) {
    if (line.trim() === '' || /^\s*#/.test(line)) continue;
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m && m[2].trim() !== '') out[m[1]] = cleanScalar(m[2]);
  }
  const lap = out.last_artifact_path;
  out.last_artifact_exists = lap ? existsSafe(path.join(root, String(lap))) : false;
  return out;
}

const DATE_TIME_IN_NAME = /(\d{4}-\d{2}-\d{2}(?:-\d{3,4})?)/;

function collectDaFindings(productDir) {
  const dir = path.join(productDir, '.da-findings');
  const files = listMd(dir).map((f) => path.basename(f, '.md'));
  // Sort by the timestamp embedded in the name (date + optional -HHMM), desc;
  // ties broken by filename asc. Names without a timestamp sort last.
  const sorted = files.slice().sort((a, b) => {
    const ta = (a.match(DATE_TIME_IN_NAME) || [''])[0];
    const tb = (b.match(DATE_TIME_IN_NAME) || [''])[0];
    if (ta !== tb) return ta < tb ? 1 : -1; // desc
    return a < b ? -1 : (a > b ? 1 : 0);    // filename asc
  });
  return { total: files.length, latest5: sorted.slice(0, 5) };
}

function collectStaleDrafts(artifacts, nowMs) {
  const items = [];
  const scan = (bucket) => {
    for (const it of bucket.items) {
      if (!it.status || String(it.status).toLowerCase() !== 'draft') continue;
      if (!it.updated) continue;
      const t = Date.parse(String(it.updated));
      if (Number.isNaN(t)) continue;
      if (nowMs - t > 14 * DAY_MS) items.push({ file: it.file, id: it.id, updated: it.updated });
    }
  };
  for (const key of Object.keys(artifacts.byType)) scan(artifacts.byType[key]);
  return { count: items.length, items };
}

function collectIntegrations(root, notes) {
  const out = { integrator: { present: false, tools_count: 0, tool_names: [] },
    pending_actions: { present: false, total: 0, marker_counts: {} } };

  const atPath = path.join(root, '.claude', 'integrator', 'active-tools.yaml');
  const at = readFileSafe(atPath);
  if (at != null) {
    const names = [];
    for (const line of normalize(at).split('\n')) {
      const m = line.match(/^\s*-\s+name:\s*(.+)$/);
      if (m) names.push(cleanScalar(m[1]));
    }
    out.integrator = { present: true, tools_count: names.length, tool_names: names };
  }

  const paPath = path.join(root, '.claude', 'pending-actions.md');
  const pa = readFileSafe(paPath);
  if (pa != null) {
    const paLines = normalize(pa).split('\n');
    const headers = paLines.filter((l) => /^##\s+PA-/.test(l));
    const markerCounts = {};
    for (const h of headers) {
      const lower = h.toLowerCase();
      for (const mk of PA_MARKERS) {
        if (new RegExp(`\\b${mk}\\b`).test(lower)) markerCounts[mk] = (markerCounts[mk] || 0) + 1;
      }
    }
    // The actual status carrier is a `**Status:** <value>` body line (see
    // commands/ecosystem/pending-actions.md). Take the first word token after
    // the colon; line-based (an entry can carry several over its history).
    const statusCounts = {};
    for (const line of paLines) {
      const m = line.match(/^\*\*Status:\s*\*{0,2}\s*:?\s*(.+)$/);
      if (!m) continue;
      const tok = m[1].replace(/^\*+/, '').match(/[A-Za-zА-Яа-я][\wА-Яа-я-]*/);
      if (tok) {
        const k = tok[0].toLowerCase();
        statusCounts[k] = (statusCounts[k] || 0) + 1;
      }
    }
    out.pending_actions = {
      present: true, total: headers.length, marker_counts: markerCounts, status_counts: statusCounts,
    };
  } else {
    notes.push('.claude/pending-actions.md absent — pending_actions reported as present:false');
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level collect
// ─────────────────────────────────────────────────────────────────────────────

function collect(root, nowDate) {
  const notes = [];
  const now = nowDate instanceof Date && !Number.isNaN(nowDate.getTime()) ? nowDate : new Date();
  const base = {
    schema: 1,
    generated_at: now.toISOString(),
    root: path.resolve(root),
    initialized: false,
  };
  const productDir = path.join(root, '.product');
  if (!existsSafe(productDir)) {
    base.notes = notes;
    return base;
  }
  base.initialized = true;

  base.config = collectConfig(root, notes);

  const index = buildLiveIndex(productDir, notes);
  base.artifacts = collectArtifacts(productDir);
  base.handoffs = collectHandoffs(root, notes);
  base.pending = collectPending(productDir, index, notes);
  base.session = collectSession(root);
  base.da_findings = collectDaFindings(productDir);
  base.stale_drafts_over_14d = collectStaleDrafts(base.artifacts, now.getTime());
  base.integrations = collectIntegrations(root, notes);
  base.notes = notes;
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI seam
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { root: '.', json: false, now: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') { args.root = argv[i + 1]; i += 1; }
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--now') { args.now = argv[i + 1]; i += 1; }
  }
  return args;
}

function cliMain() {
  const args = parseArgs(process.argv.slice(2));
  const nowDate = args.now ? new Date(args.now) : new Date();
  const result = collect(args.root, nowDate);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  try {
    cliMain();
  } catch (e) {
    process.stderr.write(`[status-collector] internal error: ${(e && e.stack) || e}\n`);
    process.exit(1);
  }
}

module.exports = {
  collect,
  buildLiveIndex,
  refIsAlive,
  parseQueue,
  queueEntryRefs,
  parseNestedYaml,
  collectConfig,
  collectArtifacts,
  collectPending,
  collectSession,
  collectDaFindings,
  collectStaleDrafts,
  collectIntegrations,
  splitFrontmatter,
  parseFrontmatterFlat,
  cleanScalar,
  countListField,
  TYPED_DIRS,
  REF_FIELDS,
};
