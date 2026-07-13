#!/usr/bin/env node
/**
 * session-state.js — PostToolUse hook for session progress snapshot.
 *
 * Snapshots .product/.sessions/current.yaml when artifact files in .product/
 * are written or edited, enabling `/product:<command> --continue` recovery.
 *
 * Exit 0 always — non-blocking.
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
const toolName = hookInput?.tool_name;
if (!filePath || !toolName) {
  process.exit(0);
}

// ---------- Filter: .product/**/*.md, excluding session/pending internal files ----------

const normalized = filePath.replace(/\\/g, '/');
if (!/\.product\//.test(normalized)) {
  process.exit(0);
}
if (normalized.includes('/.sessions/') || normalized.includes('/.pending/')) {
  process.exit(0);
}

// ---------- Find project root ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

const sessionsDir = path.join(projectRoot, '.product', '.sessions');
try {
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }
} catch (e) {
  process.exit(0);
}

const currentPath = path.join(sessionsDir, 'current.yaml');

// ---------- Parse artifact frontmatter (minimal) ----------

let artifactId = null;
let artifactType = null;
let artifactStatus = null;

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(content);
  if (m) {
    const yaml = m[1];
    const idMatch = /^id:\s*(.+)$/m.exec(yaml);
    const typeMatch = /^type:\s*(.+)$/m.exec(yaml);
    const statusMatch = /^status:\s*(\w+)/m.exec(yaml);
    if (idMatch) artifactId = idMatch[1].trim().replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '').trim();
    if (typeMatch) artifactType = typeMatch[1].trim().replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '').trim();
    if (statusMatch) artifactStatus = statusMatch[1].trim();
  }
} catch (e) {
  // Can't read — proceed with minimal snapshot (filepath only)
}

// ---------- Update current.yaml ----------

const now = new Date().toISOString();
const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

let current = {};
if (fs.existsSync(currentPath)) {
  try {
    const existing = fs.readFileSync(currentPath, 'utf-8');
    current = parseYamlFlat(existing);
  } catch (e) {
    current = {};
  }
}

// Initialize session if none present.
// Command-issued sessions (e.g., /product:init) pre-write `type` and `started_at`
// to current.yaml before the first artifact write — check `if (!current.X)` to
// preserve those values instead of overwriting with defaults.
if (!current.session_id) {
  current.session_id = `${now.replace(/[:.]/g, '-')}-${process.pid}`;
  if (!current.type) current.type = 'unknown';
  if (!current.started_at) current.started_at = now;
}

current.last_checkpoint = now;
current.last_tool = toolName;
current.last_artifact_path = relPath;
// Update artifact fields atomically from current file (the last write).
// For singletons without `id:` in frontmatter (e.g., problem.md, glossary.md),
// artifactId is null — last_artifact_id is cleared so the three fields always
// describe the same file. The YAML formatter skips null/undefined values, so
// null fields don't appear in output.
current.last_artifact_id = artifactId;
current.last_artifact_type = artifactType;
current.last_artifact_status = artifactStatus;

// Increment edit counter (rough activity signal)
current.edits_since_start = (parseInt(current.edits_since_start, 10) || 0) + 1;

// Track recently touched artifacts (dedupe)
let recent = current.recent_artifacts ? String(current.recent_artifacts).split(',').map((s) => s.trim()).filter(Boolean) : [];
if (artifactId && !recent.includes(artifactId)) {
  recent.unshift(artifactId);
  recent = recent.slice(0, 10); // keep last 10
}
current.recent_artifacts = recent.join(', ');

// Git head (optional — helps OQ-PM-02 concurrent session detection)
try {
  const gitDir = path.join(projectRoot, '.git');
  const headFile = path.join(gitDir, 'HEAD');
  if (fs.existsSync(headFile)) {
    const head = fs.readFileSync(headFile, 'utf-8').trim();
    // If ref: refs/heads/main, resolve to SHA
    const refMatch = /^ref:\s+(\S+)/.exec(head);
    if (refMatch) {
      // .git/HEAD is attacker-influenceable (prompt-injection can get an agent to write it), and
      // this hook auto-runs on every .product/ write. Unvalidated, `ref: ../../../../etc/passwd`
      // escaped .git/ and leaked the first 12 bytes of an arbitrary file into current.yaml
      // (L-2, SECURITY_REVIEW_2026-07-11). safeRefPath() returns null for anything unresolvable,
      // which falls through to the pre-existing 'detached' sentinel.
      const refPath = safeRefPath(gitDir, refMatch[1]);
      if (refPath && fs.existsSync(refPath)) {
        current.git_head_sha = fs.readFileSync(refPath, 'utf-8').trim().slice(0, 12);
      } else {
        current.git_head_sha = 'detached';
      }
    } else {
      current.git_head_sha = head.slice(0, 12);
    }
  }
} catch (e) {
  // Ignore — not critical
}

// ---------- Write back ----------

try {
  fs.writeFileSync(currentPath, formatYamlFlat(current));
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

// Resolve `<gitDir>/<ref>` — but ONLY for a well-formed ref (L-2 path-traversal guard).
// Returns null (→ caller records 'detached') for anything else. Two independent layers:
//   1. shape — must be `refs/<segments>` over a conservative charset, and no '..' segment.
//      NB the charset alone is NOT sufficient: '.' and '/' are both in [\w./-], so the regex
//      happily matches 'refs/../../../etc/passwd'. The explicit '..'-segment rejection is what
//      actually closes the traversal — the report's recommendation needs BOTH halves.
//   2. containment — re-check the RESOLVED absolute path still sits under <gitDir>. Belt-and-
//      braces: if a future maintainer widens the charset (e.g. for non-ASCII branch names, which
//      git permits and \w does not), traversal stays blocked.
function safeRefPath(gitDir, ref) {
  if (!/^refs\/[\w./-]+$/.test(ref)) return null;
  if (ref.split('/').includes('..')) return null;
  const abs = path.resolve(gitDir, ref);
  const base = path.resolve(gitDir) + path.sep;
  return abs.startsWith(base) ? abs : null;
}

function parseYamlFlat(text) {
  const obj = {};
  text.split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    const key = kv[1];
    let val = kv[2].trim();
    val = val.replace(/^["'](.*)["']$/, '$1');
    obj[key] = val;
  });
  return obj;
}

function formatYamlFlat(obj) {
  const lines = [
    '# Session state — snapshot by session-state.js hook',
    `# Used by /product:<command> --continue for recovery.`,
    `# Regenerated on every .product/*.md write.`,
    '',
  ];
  const order = [
    'session_id',
    'type',
    'started_at',
    'last_checkpoint',
    'last_tool',
    'last_artifact_id',
    'last_artifact_type',
    'last_artifact_status',
    'last_artifact_path',
    'edits_since_start',
    'recent_artifacts',
    'git_head_sha',
  ];
  order.forEach((k) => {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const v = obj[k];
      const valStr = typeof v === 'string' && /[:\s#]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
      lines.push(`${k}: ${valStr}`);
    }
  });
  // Include unknown fields (extensibility)
  Object.keys(obj).forEach((k) => {
    if (!order.includes(k) && obj[k] !== undefined) {
      const v = obj[k];
      const valStr = typeof v === 'string' && /[:\s#]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v;
      lines.push(`${k}: ${valStr}`);
    }
  });
  return lines.join('\n') + '\n';
}
