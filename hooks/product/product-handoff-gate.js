#!/usr/bin/env node
/**
 * product-handoff-gate.js — PostToolUse hook для handoff drift detection.
 *
 * Triggers on Write/Edit к .product/ artifact files. For each existing handoff
 * в .product/handoffs/ that includes the edited artifact в artifact_hashes,
 * recomputes current hash через hooks/product/lib/hash.js (shared с skill
 * handoff-generator.md per DEC-DEV-0025 C.1 + DEC-DEV-0030 contract: body
 * markdown без frontmatter, LF-normalized, SHA-256, sha256:<hex64>). Mismatch →
 * stderr warning suggesting /product:handoff <FM-id> --regenerate.
 *
 * Design choice — PostToolUse, non-blocking:
 *   - PHASE_4_READINESS §B.1 worded как "PreToolUse-блокировка"; deviating
 *     к PostToolUse warning per ecosystem convention (DEC-DEV-0023 lessons +
 *     CLAUDE.md «Hook never blocks commits — reminder only») + V-H-04 declared
 *     Warning level (→ status: stale), не Blocking. PreToolUse blocking would
 *     prevent legitimate fixes; PostToolUse stderr lets user proceed but
 *     informs про staleness.
 *
 * Trigger filter: artifact paths под .product/{features,scenarios,business-rules,
 * lifecycles,verification,invariants,segments,value-propositions,hypotheses,
 * releases,nfr,mockups}/ + singletons (rpm.md, glossary.md, design-system.md).
 * Excludes meta dirs (.sessions, .pending, .decisions, .da-findings, .reports)
 * и сам .product/handoffs/ (handoff editing → not artifact change).
 *
 * Exit 0 always — non-blocking per ecosystem convention.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const hash = require('./lib/hash.js');

// ---------- Read hook input ----------

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

// ---------- Filter: .product/ artifact paths ----------

const normalized = filePath.replace(/\\/g, '/');

if (!/\.product\/.*\.md$/.test(normalized)) process.exit(0);

if (
  normalized.includes('/.sessions/') ||
  normalized.includes('/.pending/') ||
  normalized.includes('/.decisions/') ||
  normalized.includes('/.da-findings/') ||
  normalized.includes('/.reports/') ||
  normalized.includes('/handoffs/')
) {
  process.exit(0);
}

const ARTIFACT_PATH_RE = /\.product\/(features|scenarios|business-rules|lifecycles|verification|invariants|segments|value-propositions|hypotheses|releases|nfr|mockups)\/[^\/]+\.md$|\.product\/(rpm|glossary|design-system)\.md$/;
if (!ARTIFACT_PATH_RE.test(normalized)) process.exit(0);

// ---------- Find project root ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

const handoffsDir = path.join(projectRoot, '.product', 'handoffs');
if (!fs.existsSync(handoffsDir)) process.exit(0);

// ---------- Find which artifact id was edited ----------

let artifactId;
try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fm = parseFrontmatterFlat(content);
  artifactId = fm.id;
  if (!artifactId) process.exit(0);
} catch (e) {
  process.exit(0);
}

// ---------- Scan handoffs for references to this artifact id ----------

let handoffFiles;
try {
  handoffFiles = fs.readdirSync(handoffsDir).filter((f) => f.endsWith('-handoff.md'));
} catch (e) {
  process.exit(0);
}

const driftEntries = [];

for (const hfile of handoffFiles) {
  const hpath = path.join(handoffsDir, hfile);
  let hcontent;
  try {
    hcontent = fs.readFileSync(hpath, 'utf-8');
  } catch (e) {
    continue;
  }

  if (!hcontent.includes(artifactId)) continue;

  const fm = parseFrontmatterFlat(hcontent);
  // Only ready / partial handoffs matter; blocked/stale already known invalid
  if (!fm.status || !['ready', 'partial'].includes(fm.status)) continue;

  const storedHash = extractArtifactHashFromHandoff(hcontent, artifactId);
  if (!storedHash) continue;

  let currentHash;
  try {
    currentHash = hash.computeArtifactHash(filePath);
  } catch (e) {
    continue;
  }

  if (storedHash !== currentHash) {
    driftEntries.push({
      handoff: hfile,
      handoff_id: fm.id || hfile.replace('-handoff.md', ''),
      feature: fm.feature || extractFeatureFromFilename(hfile),
      artifact: artifactId,
    });
  }
}

// ---------- Emit stderr warning if drift detected ----------

if (driftEntries.length > 0) {
  const messages = ['', '⚠ Handoff drift detected:'];
  for (const e of driftEntries) {
    messages.push(`  ${e.handoff_id} (${e.feature}): ${e.artifact} hash changed`);
  }
  messages.push('');
  messages.push('Affected handoff(s) now stale. Regenerate:');
  const uniqFeatures = [...new Set(driftEntries.map((e) => e.feature).filter(Boolean))];
  for (const f of uniqFeatures) {
    messages.push(`  /product:handoff ${f} --regenerate`);
  }
  messages.push('');
  process.stderr.write(messages.join('\n'));
}

process.exit(0);

// ---------- Helpers ----------

function findProjectRoot(absFilePath) {
  let dir = path.dirname(absFilePath);
  while (dir !== path.parse(dir).root) {
    if (
      fs.existsSync(path.join(dir, '.product')) &&
      fs.existsSync(path.join(dir, '.claude'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function parseFrontmatterFlat(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fmText = match[1];
  const result = {};
  fmText.split('\n').forEach((line) => {
    const m = line.match(/^(\w[\w-]*):\s*(.*?)\s*$/);
    if (m) {
      let val = m[2];
      val = val.replace(/^["']|["']$/g, '');
      result[m[1]] = val;
    }
  });
  return result;
}

function extractArtifactHashFromHandoff(handoffContent, artifactId) {
  const fmMatch = handoffContent.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];

  // Locate `artifact_hashes:` block, capture until next top-level key (or end)
  const hashesMatch = fm.match(/^artifact_hashes:\s*\n([\s\S]*?)(?=\n[a-z_]+:|$)/m);
  if (!hashesMatch) return null;

  const hashesBlock = hashesMatch[1];
  const entryRe = new RegExp(`^\\s+${escapeRegex(artifactId)}:\\s*["']?(sha256:[a-f0-9]{64})["']?`, 'm');
  const entryMatch = hashesBlock.match(entryRe);
  if (!entryMatch) return null;

  return entryMatch[1];
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFeatureFromFilename(handoffFile) {
  const match = handoffFile.match(/^(FM-\d+|RL-\d+)-handoff\.md$/);
  return match ? match[1] : null;
}
