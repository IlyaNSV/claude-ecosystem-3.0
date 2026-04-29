#!/usr/bin/env node
/**
 * ic-change-trigger.js — PostToolUse hook for P-RULE-01 enforcement.
 *
 * Adaptive-depth DA model per DEC-DEV-0012 + DEC-DEV-0013 #8.
 *
 * Trigger: PostToolUse Write/Edit на .product/invariants/*.md.
 * Action:
 *   1. Detect IC file change
 *   2. Compute git diff against HEAD (best-effort — graceful если no git/no HEAD)
 *   3. Append entry к .product/.pending/da-pending.yaml
 *   4. Stderr signal: orchestrator (feature-session.md) reads → spawns
 *      product-devils-advocate subagent с Mode: adaptive brief
 *
 * Hook не блокирует write и не вызывает subagent сам — только signals.
 * Subagent invocation happens through orchestrator skill в next LLM action.
 *
 * Symmetric to br-change-trigger.js (same pattern, different artifact directory).
 *
 * Exit 0 always — non-blocking.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// ---------- Filter: only .product/invariants/*.md ----------

const normalized = filePath.replace(/\\/g, '/');
if (!/\.product\/invariants\/[^\/]+\.md$/.test(normalized)) process.exit(0);

if (path.basename(normalized).startsWith('.')) process.exit(0);

// ---------- Find project root ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

// ---------- Read IC file ----------

let content;
try {
  content = fs.readFileSync(filePath, 'utf-8');
} catch (e) {
  process.exit(0);
}

const fm = parseFrontmatterFlat(content);
if (!fm.id) process.exit(0);

const icId = fm.id;
const icTitle = fm.title || '<unknown>';
const icStatus = fm.status || '<unknown>';
const icSeverity = fm.severity || '<unknown>';

// ---------- Compute git diff против HEAD (best effort) ----------

let diff = '';
try {
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  diff = execSync(`git -C "${projectRoot}" diff HEAD -- "${relPath}"`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  }).trim();
} catch (e) {
  diff = '';
}

if (!diff) {
  diff = `# (No git diff available — likely IC creation or file not in git)\n# Full file content:\n\n${content.slice(0, 4000)}`;
  if (content.length > 4000) diff += '\n# ... (truncated for da-pending entry)';
}

// ---------- Append entry к da-pending.yaml ----------

const pendingDir = path.join(projectRoot, '.product', '.pending');
try {
  if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
} catch (e) {
  process.exit(0);
}

const daFile = path.join(pendingDir, 'da-pending.yaml');
const now = new Date().toISOString();
const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

let existing = [];
if (fs.existsSync(daFile)) {
  try {
    const text = fs.readFileSync(daFile, 'utf-8');
    existing = parseDaEntriesYaml(text);
  } catch (e) {
    existing = [];
  }
}

// Dedup: replace pending entry для same artifact (latest diff wins)
const filtered = existing.filter((e) => e.artifact !== icId);

filtered.push({
  artifact: icId,
  artifact_type: 'invariant-check',
  title: icTitle,
  status: icStatus,
  severity: icSeverity,
  file: relPath,
  trigger: 'P-RULE-01',
  hook: 'ic-change-trigger.js',
  mode: 'adaptive',
  queued_at: now,
  diff,
});

try {
  fs.writeFileSync(daFile, formatDaEntriesYaml(filtered));
} catch (e) {
  // Silent
}

// ---------- Stderr signal для orchestrator ----------

process.stderr.write(
  `DA review pending для ${icId} (${icTitle}, severity: ${icSeverity}, status: ${icStatus}) — Mode: adaptive (P-RULE-01).\n` +
    `See .product/.pending/da-pending.yaml; orchestrator should spawn product-devils-advocate subagent с adaptive brief.\n`
);

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

function parseFrontmatterFlat(text) {
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

function parseDaEntriesYaml(text) {
  const items = [];
  const entriesMatch = /^entries:\s*$([\s\S]*)/m.exec(text);
  if (!entriesMatch) return items;
  const blocks = entriesMatch[1].split(/^\s{2}-\s+/m).slice(1);
  blocks.forEach((block) => {
    const item = {};
    let inDiff = false;
    let diffLines = [];
    block.split(/\r?\n/).forEach((line) => {
      if (inDiff) {
        // Diff is multiline literal block (|), formatter emits 6-space indent.
        // Parser must strip exactly 6 to round-trip cleanly; mismatch (was 4) caused
        // exponential whitespace ladder accumulation across re-emits — DEC-DEV-0023.
        if (/^\s{6,}/.test(line) || line === '') {
          diffLines.push(line.replace(/^\s{6}/, ''));
        } else {
          inDiff = false;
        }
      }
      if (!inDiff) {
        const diffStart = /^\s*diff:\s*\|/.exec(line);
        if (diffStart) {
          inDiff = true;
          return;
        }
        const kv = /^\s*([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
        if (kv) {
          let val = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
          item[kv[1]] = val;
        }
      }
    });
    if (diffLines.length) item.diff = diffLines.join('\n');
    if (Object.keys(item).length) items.push(item);
  });
  return items;
}

function formatDaEntriesYaml(entries) {
  const lines = [
    '# DA review pending entries (managed by br-change-trigger.js + ic-change-trigger.js)',
    '# Orchestrator (feature-session.md) reads → spawns product-devils-advocate subagent',
    '# Mode: adaptive — subagent self-classifies cosmetic vs significant per DEC-DEV-0012',
    '# Schema per skills/product/feature-session.md DA orchestration flow',
    '',
    'entries:',
  ];
  entries.forEach((e) => {
    lines.push(`  - artifact: ${formatScalar(e.artifact)}`);
    if (e.artifact_type) lines.push(`    artifact_type: ${formatScalar(e.artifact_type)}`);
    if (e.title) lines.push(`    title: ${formatScalar(e.title)}`);
    if (e.status) lines.push(`    status: ${formatScalar(e.status)}`);
    if (e.severity) lines.push(`    severity: ${formatScalar(e.severity)}`);
    if (e.file) lines.push(`    file: ${formatScalar(e.file)}`);
    if (e.trigger) lines.push(`    trigger: ${formatScalar(e.trigger)}`);
    if (e.hook) lines.push(`    hook: ${formatScalar(e.hook)}`);
    if (e.mode) lines.push(`    mode: ${formatScalar(e.mode)}`);
    if (e.queued_at) lines.push(`    queued_at: ${formatScalar(e.queued_at)}`);
    if (e.diff) {
      lines.push(`    diff: |`);
      e.diff.split(/\r?\n/).forEach((dl) => {
        lines.push(`      ${dl}`);
      });
    }
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
