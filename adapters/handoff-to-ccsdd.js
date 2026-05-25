#!/usr/bin/env node
/**
 * handoff-to-ccsdd.js — reference adapter from Product Module universal handoff
 * to cc-sdd /kiro:spec-init input.
 *
 * Dual-location pattern (DEC-DEV-0040 Q1):
 *   - This file (repo `adapters/handoff-to-ccsdd.js`) is the canonical source.
 *   - At /integrator:add cc-sdd, this file is copied to
 *     <project>/.claude/integrator/adapters/handoff-to-ccsdd.js and the
 *     metadata block below is populated with concrete values.
 *
 * Adapter metadata (filled in installed instance, not in repo reference):
 *   @target_tool: cc-sdd
 *   @target_tool_version: ^2.1.0          // populated from tool profile at install
 *   @contract_schema_version: 1           // bumped when output shape changes
 *   @source_ref: <git-commit-hash>        // populated from repo HEAD at install
 *   @installed_at: <ISO-8601>             // populated at install time
 *
 * Phase 5 scope (DEC-DEV-0040 Q3, Integrator-only):
 *   - --verify-only: parse handoff + validate contract + emit structured JSON
 *     that cc-sdd /kiro:spec-init WOULD receive. No actual cc-sdd invocation.
 *   - Production routing (handoff → live /kiro:spec-init invocation) is
 *     Orchestrator scope, out of Phase 5.
 *
 * Design constraints:
 *   - Node stdlib only (no npm deps); cross-platform LF-normalized I/O.
 *   - Line-based frontmatter parser (NOT regex on whole block — lesson
 *     DEC-DEV-0031 A1: regex on multi-entry hash maps silently failed).
 *   - Robust to optional sections (UI Spec conditional on has_ui).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CONTRACT_SCHEMA_VERSION = 1;
const SUPPORTED_HANDOFF_GENERATORS = ['product-module-v1.0', 'product-module-v1.1', 'product-module-v1.2'];

// ---------- Normalization ----------

function normalizeLF(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// ---------- Frontmatter parser ----------

/**
 * Line-based YAML subset parser tailored to handoff-spec.md §5 frontmatter shape.
 * Supports:
 *   - top-level scalars: `key: value`
 *   - inline lists: `key: [a, b, c]`
 *   - nested mappings (1 level): `key:\n  subkey: value`
 *   - nested lists (1 level): `key:\n  - item` or `key:\n  - name: x\n    role: y`
 *
 * Not supported (intentionally — handoff-spec doesn't use them at frontmatter
 * level): deep nesting beyond 2 levels, anchors/aliases, block scalars (| >).
 */
function parseFrontmatter(raw) {
  const normalized = normalizeLF(raw);
  const m = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) {
    throw new Error('PARSE_ERROR: no leading frontmatter block (`---\\n...\\n---`)');
  }
  const lines = m[1].split('\n');
  const out = {};
  let topKey = null;
  let mode = null; // 'scalar' | 'list' | 'map' | 'list-of-maps'
  let pendingMapItem = null;

  const stripQuotes = (v) => {
    const t = v.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  };
  const parseInlineList = (v) => {
    const inner = v.trim().slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => stripQuotes(s));
  };
  const isComment = (line) => /^\s*#/.test(line);
  const isBlank = (line) => /^\s*$/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;

    // Top-level key (no leading whitespace)
    const top = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (top) {
      // Flush previous list-of-maps pending item
      if (pendingMapItem !== null && mode === 'list-of-maps') {
        out[topKey].push(pendingMapItem);
        pendingMapItem = null;
      }
      topKey = top[1];
      const v = top[2];
      if (v === '' || v === 'null' || v === '~') {
        out[topKey] = null;
        mode = 'pending'; // resolves on next line based on indent prefix
      } else if (v.startsWith('[') && v.endsWith(']')) {
        out[topKey] = parseInlineList(v);
        mode = 'scalar';
      } else {
        out[topKey] = stripQuotes(v);
        mode = 'scalar';
      }
      continue;
    }

    // Indented continuation
    const indent2 = line.match(/^  ([^\s-].*)$/); // `  key: value` (map entry)
    const indent2list = line.match(/^  - (.*)$/); // `  - item` (list entry, scalar or map-start)
    const indent4 = line.match(/^    ([^\s-].*)$/); // `    subkey: value` (map item field)

    if (indent2list) {
      const item = indent2list[1];
      const kvInItem = item.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
      if (kvInItem) {
        // list-of-maps entry start
        if (mode !== 'list-of-maps') {
          if (pendingMapItem !== null) {
            out[topKey].push(pendingMapItem);
          }
          out[topKey] = [];
          mode = 'list-of-maps';
        } else if (pendingMapItem !== null) {
          out[topKey].push(pendingMapItem);
        }
        pendingMapItem = {};
        pendingMapItem[kvInItem[1]] = stripQuotes(kvInItem[2]);
      } else {
        if (mode !== 'list') {
          out[topKey] = [];
          mode = 'list';
        }
        out[topKey].push(stripQuotes(item));
      }
      continue;
    }

    if (indent4 && mode === 'list-of-maps' && pendingMapItem !== null) {
      const kv = indent4[1].match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
      if (kv) {
        pendingMapItem[kv[1]] = stripQuotes(kv[2]);
        continue;
      }
    }

    if (indent2) {
      const kv = indent2[1].match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
      if (kv) {
        if (mode !== 'map') {
          out[topKey] = {};
          mode = 'map';
        }
        const subKey = kv[1];
        const subVal = kv[2];
        if (subVal.startsWith('[') && subVal.endsWith(']')) {
          out[topKey][subKey] = parseInlineList(subVal);
        } else {
          out[topKey][subKey] = stripQuotes(subVal);
        }
        continue;
      }
    }
    // Unknown shape — skip silently (parser is best-effort for handoff schema)
  }

  // Flush trailing list-of-maps pending item
  if (pendingMapItem !== null && mode === 'list-of-maps') {
    out[topKey].push(pendingMapItem);
  }

  return out;
}

// ---------- Body sectioning ----------

/**
 * Split handoff body into 13 sections keyed by section number.
 * Returns Map<number, {title, content}>.
 *
 * Section headers per handoff-spec §6 are `## N. <Title>` at column 0.
 */
function extractSections(rawBody) {
  const body = normalizeLF(rawBody);
  const out = new Map();
  const lines = body.split('\n');
  let currentNum = null;
  let currentTitle = null;
  let buf = [];

  const flush = () => {
    if (currentNum !== null) {
      out.set(currentNum, { title: currentTitle, content: buf.join('\n').trim() });
    }
    buf = [];
  };

  for (const line of lines) {
    const h = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (h) {
      flush();
      currentNum = parseInt(h[1], 10);
      currentTitle = h[2].trim();
    } else {
      if (currentNum !== null) buf.push(line);
    }
  }
  flush();
  return out;
}

function stripFrontmatter(raw) {
  const normalized = normalizeLF(raw);
  const m = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : normalized;
}

// ---------- Validation ----------

/**
 * Contract validation (V-CNT-* — adapter-side contract checks, NOT V-H-*).
 * Returns { passed: boolean, checks: [{id, level, status, detail}] }.
 *
 * V-H-* validation is Product Module's responsibility (already enforced by
 * /product:handoff). Adapter trusts handoff.status=ready|partial but
 * re-checks contract-side invariants relevant to cc-sdd input shape.
 */
function validateContract(fm, sections) {
  const checks = [];

  // C-01: feature ID present and FM-shaped
  if (!fm.feature || !/^FM-\d{3}$/.test(fm.feature)) {
    checks.push({ id: 'C-01', level: 'blocking', status: 'fail',
      detail: `feature must match FM-NNN, got: ${JSON.stringify(fm.feature)}` });
  } else {
    checks.push({ id: 'C-01', level: 'blocking', status: 'pass' });
  }

  // C-02: status acceptable (ready | partial; blocked → refuse)
  if (fm.status === 'ready' || fm.status === 'partial') {
    checks.push({ id: 'C-02', level: 'blocking', status: 'pass' });
  } else {
    checks.push({ id: 'C-02', level: 'blocking', status: 'fail',
      detail: `handoff status must be ready|partial, got: ${fm.status}` });
  }

  // C-03: generator string recognized (warn if unknown, but proceed)
  if (fm.generator && !SUPPORTED_HANDOFF_GENERATORS.includes(fm.generator)) {
    checks.push({ id: 'C-03', level: 'warning', status: 'fail',
      detail: `unrecognized generator: ${fm.generator}; adapter tested against ${SUPPORTED_HANDOFF_GENERATORS.join(', ')}` });
  } else {
    checks.push({ id: 'C-03', level: 'warning', status: 'pass' });
  }

  // C-04: required sections present (1, 2, 5, 6, 9, 13)
  // cc-sdd /kiro:spec-init needs: Executive Summary, Business Context,
  // Scenarios, Business Rules, Invariants, Out of Scope.
  const required = [1, 2, 5, 6, 9, 13];
  const missing = required.filter((n) => !sections.has(n));
  if (missing.length === 0) {
    checks.push({ id: 'C-04', level: 'blocking', status: 'pass' });
  } else {
    checks.push({ id: 'C-04', level: 'blocking', status: 'fail',
      detail: `missing required sections: ${missing.join(', ')}` });
  }

  // C-05: title present (cc-sdd uses for feature_name slug fallback)
  if (typeof fm.title === 'string' && fm.title.length > 0) {
    checks.push({ id: 'C-05', level: 'blocking', status: 'pass' });
  } else {
    checks.push({ id: 'C-05', level: 'blocking', status: 'fail',
      detail: 'title is required for cc-sdd feature naming' });
  }

  // C-06: if partial, surface to receiver (warning, not blocking)
  if (fm.status === 'partial') {
    checks.push({ id: 'C-06', level: 'warning', status: 'fail',
      detail: 'handoff.status=partial — receiver should treat output as experimental' });
  } else {
    checks.push({ id: 'C-06', level: 'warning', status: 'pass' });
  }

  const blockingFails = checks.filter((c) => c.level === 'blocking' && c.status === 'fail');
  return { passed: blockingFails.length === 0, checks };
}

// ---------- Transformation ----------

/**
 * Slug derivation: FM-003 + "Project revision flow" → "project-revision-flow".
 * ASCII-only; non-ASCII → '-'; lowercase; collapse repeats.
 */
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

/**
 * Produce cc-sdd /kiro:spec-init input shape.
 * Output is the JSON cc-sdd WOULD receive — actual invocation is Orchestrator's job.
 */
function transformToCcSddInput(fm, sections) {
  const sec1 = sections.get(1)?.content || '';
  const sec2 = sections.get(2)?.content || '';
  const sec5 = sections.get(5)?.content || '';
  const sec6 = sections.get(6)?.content || '';
  const sec9 = sections.get(9)?.content || '';
  const sec13 = sections.get(13)?.content || '';

  const featureSlug = slugify(fm.title || fm.feature);

  return {
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    target_tool: 'cc-sdd',
    target_command: '/kiro:spec-init',
    spec_init_input: {
      feature_name: featureSlug,
      feature_id: fm.feature,
      title: fm.title,
      description: sec1,
      business_context: sec2,
      scenarios: sec5,
      business_rules: sec6,
      invariants: sec9,
      out_of_scope: sec13,
    },
    steering_prefix: {
      product_tier: fm.current_product_tier || null,
      nfr_status: fm.nfr_status || null,
      mode: fm.mode || null,
    },
    provenance: {
      handoff_id: fm.id,
      handoff_version: fm.version,
      handoff_generator: fm.generator,
      generated_at: fm.generated_at,
    },
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { verifyOnly: false, fixture: null, output: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verify-only') args.verifyOnly = true;
    else if (a === '--fixture') args.fixture = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.fixture && !a.startsWith('--')) args.fixture = a;
  }
  return args;
}

function printHelp() {
  console.log(`handoff-to-ccsdd.js — Product handoff → cc-sdd /kiro:spec-init adapter (reference)

Usage:
  node handoff-to-ccsdd.js --verify-only --fixture <handoff.md>
  node handoff-to-ccsdd.js --verify-only --fixture <handoff.md> --output result.json

Modes:
  --verify-only   Parse handoff, validate contract, emit JSON cc-sdd input
                  shape. No cc-sdd invocation (Phase 5 scope — production
                  routing is Orchestrator's job).

Exit codes:
  0   contract OK; transformation emitted
  1   contract validation failed (blocking)
  2   parse error (malformed handoff)

Schema:
  contract_schema_version: ${CONTRACT_SCHEMA_VERSION}
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (!args.fixture) {
    console.error('ERROR: --fixture <handoff.md> is required');
    printHelp();
    process.exit(2);
  }

  let raw;
  try {
    raw = fs.readFileSync(args.fixture, 'utf8');
  } catch (e) {
    console.error(`ERROR: cannot read fixture: ${e.message}`);
    process.exit(2);
  }

  let fm, body, sections;
  try {
    fm = parseFrontmatter(raw);
    body = stripFrontmatter(raw);
    sections = extractSections(body);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(2);
  }

  const validation = validateContract(fm, sections);
  const output = args.verifyOnly ? {
    mode: 'verify-only',
    contract_schema_version: CONTRACT_SCHEMA_VERSION,
    handoff_file: path.resolve(args.fixture),
    contract_validation: validation,
    cc_sdd_input: validation.passed ? transformToCcSddInput(fm, sections) : null,
  } : (() => {
    console.error('ERROR: production-mode invocation is Orchestrator scope (Phase 5 ships verify-only).');
    process.exit(1);
  })();

  const json = JSON.stringify(output, null, 2);
  if (args.output) {
    fs.writeFileSync(args.output, json, 'utf8');
  } else {
    process.stdout.write(json + '\n');
  }
  process.exit(validation.passed ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  CONTRACT_SCHEMA_VERSION,
  normalizeLF,
  parseFrontmatter,
  extractSections,
  stripFrontmatter,
  validateContract,
  transformToCcSddInput,
  slugify,
};
