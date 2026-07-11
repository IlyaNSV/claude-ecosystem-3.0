#!/usr/bin/env node
'use strict';
/**
 * handoff-staleness.cjs — Integrator-side handoff artifact-hash staleness check.
 *
 * Closes gap G22 (audit APPENDIX-B): handoff-spec §10 + §13 promise that when a
 * handoff is *used* (Integrator at add/update, and at /integrator:verify) the
 * embedded `artifact_hashes` are recomputed from `.product/` and compared, and a
 * mismatch flips the handoff to `stale`. Before this lib, no such recompute step
 * existed on the Integrator side — the only drift signal lived in the Product-zone
 * PostToolUse hook (hooks/product/product-handoff-gate.js) and was stderr-ephemeral
 * (never persisted). This lib provides the recompute AND a persisted verdict in the
 * Integrator zone.
 *
 * Reuse, not copy (orchestrate-don't-duplicate): the SHA-256 / frontmatter-strip /
 * LF-normalize algorithm is the single source of truth in hooks/product/lib/hash.js
 * (DEC-DEV-0025 C.1 + DEC-DEV-0030). This lib requires that module and calls
 * computeArtifactHash — it does NOT reimplement hashing. The relative path
 * `../../product/lib/hash.js` holds both in this repo (hooks/…) and in a pilot
 * (.claude/hooks/…), so the reuse survives deployment.
 *
 * Model (per handoff in <root>/.product/handoffs/*-handoff.md):
 *   1. Parse the frontmatter `artifact_hashes:` map (artifactId → sha256:<hex>).
 *   2. Resolve each artifactId to its source file via an index built by scanning
 *      the `.product/` artifact dirs (+ singletons) and reading each file's `id`.
 *   3. Recompute the current hash via hash.computeArtifactHash and compare.
 *   4. Mismatch → stale_artifacts; artifact gone / unreadable → missing_artifacts.
 *   5. Verdict per handoff: fresh | stale | error. Handoff is `stale` when any
 *      artifact drifted or went missing.
 *
 * Scope discipline: READ-ONLY with respect to `.product/` (Integrator NEVER writes
 * there — add.md/update.md/verify.md constraint). The only write this lib performs
 * is the persisted snapshot inside the Integrator zone
 * (.claude/integrator/handoff-staleness.yaml), and only under --write.
 *
 * Detect-only, tolerant, no network. Absent `.product/handoffs/` (e.g. the
 * ecosystem-dev repo, or a pilot with no handoffs yet) → empty result with a note,
 * never a throw. CLI always exits 0; non-zero only on an internal crash.
 *
 * CLI seam:
 *   node hooks/integrator/lib/handoff-staleness.cjs --root <path> [--json] [--write]
 */

const fs = require('fs');
const path = require('path');
const hash = require('../../product/lib/hash.js');

// Artifact directories under .product/ that carry hashable, id-bearing artifacts
// (mirrors the trigger filter in hooks/product/product-handoff-gate.js).
const ARTIFACT_DIRS = [
  'features', 'scenarios', 'business-rules', 'lifecycles', 'verification',
  'invariants', 'segments', 'value-propositions', 'hypotheses', 'releases',
  'nfr', 'mockups',
];
// Single-file artifacts that live at the .product/ root.
const SINGLETON_FILES = ['rpm.md', 'glossary.md', 'design-system.md'];

const HANDOFF_SUFFIX = '-handoff.md';

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_) {
    return null;
  }
}

/** Flat frontmatter scalar parse (first `---`…`---` block). Tolerant, never throws. */
function parseFrontmatterFlat(content) {
  const normalized = String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  match[1].split('\n').forEach((line) => {
    const m = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return result;
}

/** Read just the frontmatter `id` of an artifact file; null if absent/unreadable. */
function readArtifactId(p) {
  const content = readFileSafe(p);
  if (content == null) return null;
  const fm = parseFrontmatterFlat(content);
  return fm.id || null;
}

/**
 * Parse the `artifact_hashes:` block of a handoff into { id: 'sha256:<hex>' }.
 * Line-based (robust to multi-entry blocks — the same trap the Product gate hit,
 * R5/A1 2026-05-13): a regex with `$` in multiline mode captured only the first
 * entry. We walk the block until the first column-0 line.
 */
function parseArtifactHashes(handoffContent) {
  const normalized = String(handoffContent).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return {};
  const out = {};
  let inBlock = false;
  for (const line of fmMatch[1].split('\n')) {
    if (/^artifact_hashes:\s*$/.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (/^\S/.test(line)) { inBlock = false; continue; } // next top-level key
    const m = line.match(/^\s+([\w.@/-]+):\s*["']?(sha256:[a-f0-9]{64})["']?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function extractFeatureFromFilename(handoffFile) {
  const m = handoffFile.match(/^(FM-\d+|RL-\d+)-handoff\.md$/);
  return m ? m[1] : null;
}

/**
 * Build an artifactId → absolute-path index by scanning the `.product/` artifact
 * dirs + singletons and reading each file's frontmatter `id`. Tolerant: a missing
 * dir is skipped. Filenames carry ASCII slugs, so we resolve by `id`, not name.
 */
function buildArtifactIndex(productDir) {
  const index = {};
  for (const d of ARTIFACT_DIRS) {
    const dir = path.join(productDir, d);
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch (_) {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const id = readArtifactId(path.join(dir, f));
      if (id && !(id in index)) index[id] = path.join(dir, f);
    }
  }
  for (const f of SINGLETON_FILES) {
    const p = path.join(productDir, f);
    const id = readArtifactId(p);
    if (id && !(id in index)) index[id] = p;
  }
  return index;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY = { handoffsChecked: 0, staleCount: 0, errorCount: 0 };

/**
 * Recompute handoff staleness for a project root.
 * @param {string} root project root containing `.product/`
 * @returns {{ handoffs: Array, summary: {handoffsChecked,staleCount,errorCount}, note?: string }}
 */
function computeHandoffStaleness(root) {
  const productDir = path.join(root, '.product');
  const handoffsDir = path.join(productDir, 'handoffs');
  if (!fs.existsSync(handoffsDir)) {
    return { handoffs: [], summary: { ...EMPTY_SUMMARY }, note: 'no .product/handoffs (nothing to check)' };
  }

  let handoffFiles;
  try {
    handoffFiles = fs.readdirSync(handoffsDir).filter((f) => f.endsWith(HANDOFF_SUFFIX));
  } catch (e) {
    return { handoffs: [], summary: { ...EMPTY_SUMMARY }, note: `handoffs dir unreadable (${e.message})` };
  }
  if (handoffFiles.length === 0) {
    return { handoffs: [], summary: { ...EMPTY_SUMMARY }, note: 'no handoffs generated yet' };
  }

  const index = buildArtifactIndex(productDir);
  const handoffs = [];
  let staleCount = 0;
  let errorCount = 0;

  for (const hf of handoffFiles) {
    const content = readFileSafe(path.join(handoffsDir, hf));
    if (content == null) {
      handoffs.push(mkRow(hf, null, 'error', { detail: 'handoff unreadable' }));
      errorCount += 1;
      continue;
    }
    const fm = parseFrontmatterFlat(content);
    const feature = fm.feature || fm.release || extractFeatureFromFilename(hf);
    const hashes = parseArtifactHashes(content);
    const ids = Object.keys(hashes);
    if (ids.length === 0) {
      handoffs.push(mkRow(hf, feature, 'error', { detail: 'no artifact_hashes in frontmatter' }));
      errorCount += 1;
      continue;
    }

    const stale = [];
    const missing = [];
    for (const id of ids) {
      const p = index[id];
      if (!p) { missing.push(id); continue; }
      let current;
      try {
        current = hash.computeArtifactHash(p);
      } catch (_) {
        missing.push(id);
        continue;
      }
      if (current !== hashes[id]) stale.push(id);
    }

    const status = (stale.length || missing.length) ? 'stale' : 'fresh';
    if (status === 'stale') staleCount += 1;
    handoffs.push(mkRow(hf, feature, status, {
      declared_status: fm.status || null,
      checked: ids.length,
      stale_artifacts: stale,
      missing_artifacts: missing,
    }));
  }

  return { handoffs, summary: { handoffsChecked: handoffs.length, staleCount, errorCount } };
}

function mkRow(handoff, feature, status, extra) {
  return {
    handoff,
    feature: feature || null,
    status,
    declared_status: (extra && extra.declared_status) || null,
    checked: (extra && extra.checked) || 0,
    stale_artifacts: (extra && extra.stale_artifacts) || [],
    missing_artifacts: (extra && extra.missing_artifacts) || [],
    ...(extra && extra.detail ? { detail: extra.detail } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence (Integrator zone only — NEVER `.product/`)
// ─────────────────────────────────────────────────────────────────────────────

const SNAPSHOT_REL = path.join('.claude', 'integrator', 'handoff-staleness.yaml');

function flowList(arr) {
  if (!arr || arr.length === 0) return '[]';
  return `[${arr.join(', ')}]`;
}

/** Serialize a result to the persisted YAML snapshot text. */
function toYaml(result, now) {
  const ts = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
  const lines = [
    '# .claude/integrator/handoff-staleness.yaml',
    '# Auto-generated by hooks/integrator/lib/handoff-staleness.cjs (DEC-DEV-0179, gap G22).',
    '# Detect-only snapshot of handoff artifact-hash drift vs .product/. Regenerated by',
    '# /integrator:add and /integrator:update; read by /integrator:verify. Do not edit by hand.',
    `generated_at: ${ts}`,
    'summary:',
    `  handoffs_checked: ${result.summary.handoffsChecked}`,
    `  stale_count: ${result.summary.staleCount}`,
    `  error_count: ${result.summary.errorCount}`,
  ];
  if (result.note) lines.push(`note: ${JSON.stringify(result.note)}`);
  lines.push('handoffs:');
  if (!result.handoffs.length) {
    lines.push('  []');
  } else {
    for (const h of result.handoffs) {
      lines.push(`  - handoff: ${h.handoff}`);
      lines.push(`    feature: ${h.feature == null ? 'null' : h.feature}`);
      lines.push(`    status: ${h.status}`);
      lines.push(`    checked: ${h.checked}`);
      lines.push(`    stale_artifacts: ${flowList(h.stale_artifacts)}`);
      lines.push(`    missing_artifacts: ${flowList(h.missing_artifacts)}`);
      if (h.detail) lines.push(`    detail: ${JSON.stringify(h.detail)}`);
    }
  }
  return lines.join('\n') + '\n';
}

/** Persist the snapshot under the Integrator zone. Returns the written path. */
function writeSnapshot(root, result, now) {
  const dest = path.join(root, SNAPSHOT_REL);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, toYaml(result, now), 'utf8');
  return dest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

function summarizeStaleLines(result) {
  const lines = [];
  for (const h of result.handoffs) {
    if (h.status === 'stale') {
      const bits = [];
      if (h.stale_artifacts.length) bits.push(`changed: ${h.stale_artifacts.join(', ')}`);
      if (h.missing_artifacts.length) bits.push(`missing: ${h.missing_artifacts.join(', ')}`);
      lines.push(`  - ${h.handoff} (${h.feature || '?'}): ${bits.join('; ')} → /product:handoff ${h.feature || '<FM>'} --regenerate`);
    } else if (h.status === 'error') {
      lines.push(`  - ${h.handoff}: error — ${h.detail || 'unknown'}`);
    }
  }
  return lines;
}

function renderHuman(result) {
  const out = ['Handoff staleness (Integrator-side; detect-only, read-only vs .product/)'];
  if (result.note) out.push(`  note: ${result.note}`);
  for (const h of result.handoffs) {
    const flag = h.status === 'fresh' ? 'FRESH' : h.status.toUpperCase();
    out.push(`  ${h.handoff} (${h.feature || '?'}): ${flag}${h.detail ? ` — ${h.detail}` : ''}`);
    if (h.stale_artifacts.length) out.push(`      changed: ${h.stale_artifacts.join(', ')}`);
    if (h.missing_artifacts.length) out.push(`      missing: ${h.missing_artifacts.join(', ')}`);
  }
  out.push(`Summary: ${result.summary.staleCount} stale, ${result.summary.errorCount} error of ${result.summary.handoffsChecked} handoff(s).`);
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI seam
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { root: process.cwd(), json: false, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') { args.root = argv[i + 1]; i += 1; }
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--write') args.write = true;
  }
  return args;
}

function cliMain() {
  const args = parseArgs(process.argv.slice(2));
  const result = computeHandoffStaleness(args.root);
  if (args.write) {
    const dest = writeSnapshot(args.root, result);
    result.persisted = dest;
  }
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(renderHuman(result) + '\n');
    if (args.write) process.stdout.write(`Persisted: ${result.persisted}\n`);
  }
  process.exit(0);
}

if (require.main === module) {
  try {
    cliMain();
  } catch (e) {
    process.stderr.write(`[handoff-staleness] internal error: ${(e && e.stack) || e}\n`);
    process.exit(1);
  }
}

module.exports = {
  computeHandoffStaleness,
  buildArtifactIndex,
  parseArtifactHashes,
  parseFrontmatterFlat,
  readArtifactId,
  toYaml,
  writeSnapshot,
  renderHuman,
  summarizeStaleLines,
  extractFeatureFromFilename,
  ARTIFACT_DIRS,
  SINGLETON_FILES,
  HANDOFF_SUFFIX,
  SNAPSHOT_REL,
};
