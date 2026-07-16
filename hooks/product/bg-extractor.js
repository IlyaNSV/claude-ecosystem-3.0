#!/usr/bin/env node
/**
 * bg-extractor.js — PostToolUse hook for BG candidate extraction.
 *
 * Implements Phase 1 of BG Extraction Algorithm per processes.md §5.1.
 * Scans markdown files under .product (recursive) for bold terms at PostToolUse,
 * filters via stoplist, dedupes against existing BG, appends candidates to
 * .product/.pending/bg-candidates.yaml.
 *
 * Bold term patterns: double-asterisk wrapped or double-underscore wrapped.
 *
 * Phase 2 (classification) + Phase 3 (presentation) + Phase 4 (approval) handled
 * by skill (bg-extraction.md) + command (/product:bg-review). Hook is Phase 1 only.
 *
 * Exit 0 always — non-blocking.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Stoplist: common RU + EN words; technical terms (not domain).
// Conservative — false negatives (real domain term filtered) caught at Phase 4 review.
//
// Declared at module top (not co-located with termPasses below) because const has
// no hoisting / lives in TDZ until evaluated. termPasses() is called from the
// bold-term scan loop near line ~90 — long before its old position would have
// initialized STOPWORDS. Triggered ReferenceError 119 times in Phase 3 smoke test
// (DEC-DEV-0023 / first run без single hook smoke).
const STOPWORDS = new Set([
  // RU function words / pronouns / common verbs
  'мы', 'они', 'вы', 'я', 'ты', 'он', 'она', 'оно', 'это', 'эти', 'тот', 'та', 'те',
  'будет', 'будут', 'был', 'была', 'было', 'есть', 'нет', 'да',
  'должен', 'должна', 'должно', 'может', 'можно', 'нужно', 'нужен',
  'через', 'между', 'после', 'перед', 'когда', 'если', 'тогда', 'но', 'или', 'и', 'а',
  'для', 'из', 'на', 'в', 'к', 'с', 'по', 'до', 'от', 'под', 'над', 'при', 'без',
  'весь', 'все', 'всё', 'каждый', 'любой', 'некий',
  // EN function words
  'we', 'you', 'i', 'he', 'she', 'it', 'they', 'this', 'that', 'these', 'those',
  'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'have', 'has', 'had',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'done',
  'and', 'or', 'but', 'if', 'then', 'when', 'while', 'because',
  'for', 'from', 'in', 'on', 'at', 'to', 'of', 'with', 'by', 'as', 'about',
  'all', 'each', 'every', 'any', 'some',
  // Technical terms (not domain — implementation zone)
  'database', 'db', 'api', 'endpoint', 'function', 'method', 'class', 'module',
  'component', 'service', 'controller', 'model', 'view', 'route',
  'request', 'response', 'json', 'yaml', 'http', 'https', 'url', 'uri',
  'string', 'number', 'integer', 'boolean', 'array', 'object', 'null', 'undefined',
  'true', 'false',
  'frontend', 'backend', 'server', 'client',
  'react', 'vue', 'angular', 'nodejs', 'python', 'java',
]);

// ---------- Read Claude Code hook input ----------

let rawInput = '';
try {
  rawInput = fs.readFileSync(0, 'utf-8');
} catch (e) {
  process.exit(0);
}

let hookInput;
try {
  hookInput = JSON.parse(rawInput);
} catch (e) {
  process.exit(0);
}

const filePath = hookInput?.tool_input?.file_path;
if (!filePath) process.exit(0);

// ---------- Filter: ONLY source artifact zones of .product (allowlist) ----------
//
// Allowlist, not blocklist (DEC-DEV-0219). Derived/compiled docs (handoffs/ —
// выжимки артефактов с шаблонными **лейблами**) и рабочие dot-директории
// (.design-sessions/, .reports/, .consilium/, .fixtures/, .sessions/, .pending/,
// .decisions/, .da-findings/, ...) — НЕ источники глоссария: всякий извлекаемый
// термин уже живёт в source-артефакте. Прежний блоклист гнил дважды вживую:
// 223 мусорных кандидата из перегенерированных handoff'ов («Фича:», «Сегмент:»)
// и ghost-кандидаты из .design-sessions/FM-008-* (изолированный смоук).
const SOURCE_DIRS = new Set([
  'features', 'scenarios', 'business-rules', 'lifecycles', 'verification',
  'invariants', 'segments', 'value-propositions', 'hypotheses', 'nfr', 'notes',
  'releases', 'mockups',
]);

const normalized = filePath.replace(/\\/g, '/');
const inProduct = normalized.match(/\.product\/(.+\.md)$/);
if (!inProduct) process.exit(0);
const relInProduct = inProduct[1];
const topSeg = relInProduct.includes('/') ? relInProduct.split('/')[0] : null;
if (topSeg === null) {
  // Root singletons (PS/MR/CA/RPM/DS/RM/AM/...) are sources — except the
  // glossary itself (don't extract from BG into BG).
  if (relInProduct === 'glossary.md') process.exit(0);
} else if (!SOURCE_DIRS.has(topSeg)) {
  process.exit(0); // handoffs/, any dot-dir, unknown dirs — not extraction sources
}

// ---------- Find project root ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

// ---------- Read the artifact file ----------

let content;
try {
  content = fs.readFileSync(filePath, 'utf-8');
} catch (e) {
  process.exit(0);
}

// ---------- Parse frontmatter to get artifact id ----------

const fm = parseMinimalFrontmatter(content);
const artifactId = fm.id || path.basename(filePath, '.md');

// ---------- Strip frontmatter from content для term scanning ----------

const bodyOnly = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/m, '');

// ---------- Extract bold terms (**term** or __term__) ----------

const candidates = new Set();
const boldRegex = /\*\*([^\*\n]+?)\*\*|__([^_\n]+?)__/g;
let match;
while ((match = boldRegex.exec(bodyOnly)) !== null) {
  const term = (match[1] || match[2] || '').trim();
  if (term && termPasses(term)) {
    candidates.add(term);
  }
}

if (candidates.size === 0) process.exit(0);

// ---------- Dedupe against existing BG ----------

const existingTerms = readExistingBgTerms(projectRoot);
const rejectedTerms = readRejectedBgTerms(projectRoot);

const newCandidates = [];
for (const term of candidates) {
  const termLower = term.toLowerCase();
  // Skip if already in BG
  if (existingTerms.has(termLower)) continue;
  // Skip if previously rejected
  if (rejectedTerms.has(termLower)) continue;
  newCandidates.push(term);
}

if (newCandidates.length === 0) process.exit(0);

// ---------- Append к .product/.pending/bg-candidates.yaml ----------

const pendingDir = path.join(projectRoot, '.product', '.pending');
try {
  if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
} catch (e) {
  process.exit(0);
}

const queueFile = path.join(pendingDir, 'bg-candidates.yaml');
const now = new Date().toISOString();
const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

// Read existing queue (if exists)
let existing = [];
if (fs.existsSync(queueFile)) {
  try {
    const text = fs.readFileSync(queueFile, 'utf-8');
    existing = parseCandidatesYaml(text);
  } catch (e) {
    existing = [];
  }
}

// Build dedup set из existing entries (term + source_artifact key)
const existingKeys = new Set(existing.map((c) => `${(c.term || '').toLowerCase()}|${c.source_artifact || ''}`));

let added = 0;
for (const term of newCandidates) {
  const key = `${term.toLowerCase()}|${artifactId}`;
  if (existingKeys.has(key)) continue;
  // Extract context snippet (~100 chars around first occurrence)
  const snippet = extractContext(bodyOnly, term);
  existing.push({
    term,
    source_artifact: artifactId,
    source_file: relPath,
    extraction_at: now,
    context: snippet,
  });
  added++;
}

if (added === 0) process.exit(0);

// Write back atomically (read-modify-write per DEC-DEV-0010 pattern)
try {
  fs.writeFileSync(queueFile, formatCandidatesYaml(existing));
} catch (e) {
  // Silent fail
}

process.exit(0);

// ---------- Helpers ----------

function findProjectRoot(filePath) {
  let dir = path.dirname(path.resolve(filePath));
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude')) && fs.existsSync(path.join(dir, '.product'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function parseMinimalFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return {};
  const obj = {};
  m[1].split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    let val = kv[2].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
    obj[kv[1]] = val;
  });
  return obj;
}

function termPasses(term) {
  // Length check
  if (term.length < 3) return false;
  if (term.length > 100) return false;  // Probably not a term, just emphasized text
  // Numeric only
  if (/^\d+$/.test(term)) return false;
  // Stoplist (case-insensitive)
  if (STOPWORDS.has(term.toLowerCase())) return false;
  // Markdown link syntax slipped through (e.g., **[text](url)**) — skip
  if (/[\[\]\(\)]/.test(term)) return false;
  // Multiple sentences (period within term — likely accidental bold)
  if (/[.!?]{1}\s/.test(term)) return false;
  return true;
}

function readExistingBgTerms(projectRoot) {
  const bgPath = path.join(projectRoot, '.product', 'glossary.md');
  const terms = new Set();
  if (!fs.existsSync(bgPath)) return terms;
  try {
    const text = fs.readFileSync(bgPath, 'utf-8');
    // BG entries use `### TermName` heading per BG.md spec body structure
    const headingRegex = /^###\s+(.+?)$/gm;
    let m;
    while ((m = headingRegex.exec(text)) !== null) {
      terms.add(m[1].trim().toLowerCase());
    }
  } catch (e) {
    // Silent
  }
  return terms;
}

function readRejectedBgTerms(projectRoot) {
  // Local ignore list per processes.md §5 Phase 4 reject action
  const rejectedFile = path.join(projectRoot, '.product', '.bg-rejected.yaml');
  const terms = new Set();
  if (!fs.existsSync(rejectedFile)) return terms;
  try {
    const text = fs.readFileSync(rejectedFile, 'utf-8');
    // Simple format: list of "- term: <name>" entries
    const m = text.matchAll(/^\s*-\s+term:\s*(.+)$/gm);
    for (const match of m) {
      terms.add(match[1].trim().replace(/^["'](.*)["']$/, '$1').toLowerCase());
    }
  } catch (e) {
    // Silent
  }
  return terms;
}

function extractContext(body, term) {
  // Find first occurrence and return ~50 chars before + 50 chars after
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(\\*\\*${escaped}\\*\\*|__${escaped}__)`, 'i');
  const m = re.exec(body);
  if (!m) return '';
  const idx = m.index;
  const start = Math.max(0, idx - 50);
  const end = Math.min(body.length, idx + m[0].length + 50);
  return body.slice(start, end).replace(/\s+/g, ' ').trim();
}

function parseCandidatesYaml(text) {
  // Minimal parse — looking for entries under `candidates:` key
  // v1 format: `- term: ...` blocks
  const items = [];
  const blocks = text.split(/^-\s+/m).slice(1);
  blocks.forEach((block) => {
    const item = {};
    block.split(/\r?\n/).forEach((line) => {
      const kv = /^\s*([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
      if (kv) {
        let val = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
        item[kv[1]] = val;
      }
    });
    if (Object.keys(item).length) items.push(item);
  });
  return items;
}

function formatCandidatesYaml(candidates) {
  const lines = [
    '# Pending BG candidates (auto-extracted by bg-extractor.js)',
    '# Reviewed via /product:bg-review or при следующем /product:status',
    '# Schema per skills/product/bg-extraction.md Phase 1',
    '',
    'candidates:',
  ];
  candidates.forEach((c) => {
    lines.push(`  - term: ${formatScalar(c.term)}`);
    if (c.source_artifact) lines.push(`    source_artifact: ${formatScalar(c.source_artifact)}`);
    if (c.source_file) lines.push(`    source_file: ${formatScalar(c.source_file)}`);
    if (c.extraction_at) lines.push(`    extraction_at: ${formatScalar(c.extraction_at)}`);
    if (c.context) lines.push(`    context: ${formatScalar(c.context)}`);
  });
  return lines.join('\n') + '\n';
}

function formatScalar(value) {
  const s = String(value);
  if (/[:#"'\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}
