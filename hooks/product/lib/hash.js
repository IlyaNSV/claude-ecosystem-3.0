#!/usr/bin/env node
/**
 * lib/hash.js — single source of truth для artifact hash computation.
 *
 * Used by:
 *   - skills/product/handoff-generator.md (computes hashes for handoff
 *     frontmatter `artifact_hashes` field during /product:handoff)
 *   - hooks/product/product-handoff-gate.js (Phase 4.F — V-H-04 drift detection)
 *
 * Algorithm (per DEC-DEV-0025 C.1 + DEC-DEV-0030 A.3):
 *   1. Read file content as UTF-8 string
 *   2. extractBody() — strip leading YAML frontmatter (body markdown only;
 *      frontmatter metadata excluded so hash не dirty при mechanical version
 *      bumps; tracks behavioral change только)
 *   3. normalizeForHash() — strip CR characters (\r\n → \n; bare \r → \n);
 *      cross-platform consistency: hash invariant к Windows core.autocrlf
 *   4. SHA-256 of UTF-8 bytes
 *   5. Output format: `sha256:<hex64>` (lowercase hex, full digest)
 *
 * Content scope rationale (per DEC-DEV-0030 user choice 2026-05-12):
 * hash detection отражает изменения содержимого как trigger для других
 * процессов экосистемы; frontmatter (metadata: version, status, refs,
 * updated timestamps) — vehicle для версионирования, не behavioral spec.
 */

'use strict';

const fs = require('fs');
const crypto = require('crypto');

/**
 * Strip CR characters — normalize CRLF and bare CR к LF.
 * Cross-platform: hash invariant к Windows core.autocrlf=true vs Unix LF.
 */
function normalizeForHash(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extract markdown body without YAML frontmatter.
 *
 * Frontmatter convention: YAML block delimited by leading `---\n` and
 * second `---\n` at start of file. If no leading frontmatter — entire
 * content is body.
 */
function extractBody(content) {
  const normalized = normalizeForHash(content);
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  if (match) {
    return match[1];
  }
  return normalized;
}

/**
 * Compute artifact hash from file path.
 * Returns `sha256:<hex64>` lowercase.
 */
function computeArtifactHash(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  return computeContentHash(raw);
}

/**
 * Compute hash from in-memory content string.
 * Convenience для skill workflows where content already loaded.
 */
function computeContentHash(content) {
  const body = extractBody(content);
  // extractBody already normalizes, but call normalizeForHash again
  // defensively — explicit guarantee LF-only bytes hit SHA-256.
  const normalized = normalizeForHash(body);
  const digest = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

/**
 * Verify hash format string conforms to `sha256:<hex64>` lowercase.
 */
function isValidHashFormat(s) {
  return typeof s === 'string' && /^sha256:[a-f0-9]{64}$/.test(s);
}

module.exports = {
  normalizeForHash,
  extractBody,
  computeArtifactHash,
  computeContentHash,
  isValidHashFormat,
};

// CLI usage for ad-hoc testing:
//   node hooks/product/lib/hash.js <file>
if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node hash.js <file>');
    process.exit(1);
  }
  console.log(computeArtifactHash(file));
}
