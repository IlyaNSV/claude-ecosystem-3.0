#!/usr/bin/env node
/**
 * hooks/integrator/journal-hook.js — autolog every modifying Integrator action.
 *
 * Per DEC-DEV-0040 Q6 (every modifying action — install/remove/update/config).
 * Per SPEC §6 (decision journal format).
 *
 * PostToolUse matcher: Bash|Write|Edit. Filters internally to integrator-relevant
 * paths/commands; non-matching invocations exit silently (cost is one stdin read).
 *
 * Dedup: (action + path + minute_timestamp) hashed → recent dedup keys cached
 * in .claude/integrator/.journal-dedup.json (last 100). Prevents spam from
 * cascade saves (precedent DEC-DEV-0023 cascade-pending 396 entries).
 *
 * Retention: count `^## ` headers in project-journal.md after append; if > 500,
 * move oldest entries to .claude/integrator/_archive/journal-<YYYY-MM>.md.
 *
 * Never blocks tool execution. Stderr on internal error (per Phase 4 hook convention).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RETENTION_THRESHOLD = 500;
const DEDUP_CACHE_SIZE = 100;
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const JOURNAL_PATH = path.join(PROJECT_ROOT, '.claude/integrator/project-journal.md');
const DEDUP_PATH = path.join(PROJECT_ROOT, '.claude/integrator/.journal-dedup.json');
const ARCHIVE_DIR = path.join(PROJECT_ROOT, '.claude/integrator/_archive');

// ---------- Path patterns considered integrator-relevant ----------

const INTEGRATOR_PATH_PATTERNS = [
  /\.claude\/integrator\/active-tools\.yaml$/,
  /\.claude\/integrator\/pmo-mapping\.yaml$/,
  /\.claude\/integrator\/contracts\/CNT-\d+\.(yaml|md)$/,
  /\.claude\/integrator\/adapters\/[^/]+\.js$/,
  /\.claude\/integrator\/tool-docs\/[^/]+\.md$/,
  /\.claude\/integrator\/baseline\.yaml$/,
];

const INTEGRATOR_BASH_PATTERNS = [
  /^\s*npx\s+/,                                 // npm tool invocation (install / one-shot)
  /^\s*npm\s+(install|uninstall|update)\b/,
  /^\s*pip\s+(install|uninstall)\b/,
  /\.claude\/integrator\/adapters\/[^\s]+\.js/, // adapter execution
];

// FB-008 (orchestrator live-run RUN 01): the broad `npx` pattern above also matches
// incidental dev-tool runs (prettier/eslint/tsc/…). Orchestrator P5 subagents fire many
// of these during implement, flooding the integrator journal with #auto noise. The hook
// is for integrator TOOL-MANAGEMENT actions, not formatter/linter/test runs — skip these.
const INCIDENTAL_NPX_TOOLS = /^(?:prettier|eslint|tsc|typescript|vitest|jest|mocha|playwright|cypress|tsx|ts-node|nodemon|concurrently|rimraf|husky|biome|stylelint)$/;

// ---------- IO helpers ----------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) { /* ignore */ }
}

function readJSONSafe(filepath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJSONSafe(filepath, obj) {
  try {
    ensureDir(path.dirname(filepath));
    fs.writeFileSync(filepath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[journal-hook] dedup cache write failed: ${e.message}\n`);
  }
}

// ---------- Classification ----------

function classifyAction(toolName, toolInput) {
  if (!toolInput) return null;

  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') {
    const p = toolInput.file_path || toolInput.notebook_path || '';
    if (!p) return null;
    // Normalize backslash to forward slash; INTEGRATOR_PATH_PATTERNS use `/` but
    // Edit/Write tool emit native separators (`\` on Windows).
    const pNorm = p.replace(/\\/g, '/');
    for (const pat of INTEGRATOR_PATH_PATTERNS) {
      if (pat.test(pNorm)) {
        return { action: 'edit', subject: path.relative(PROJECT_ROOT, p) || p, tool: toolName };
      }
    }
    return null;
  }

  if (toolName === 'Bash') {
    const cmd = (toolInput.command || '').trim();
    if (!cmd) return null;
    // FB-008: skip incidental dev-tool runs (npx/pnpm dlx/npm exec prettier|eslint|…) —
    // these are not integrator tool-management actions and would otherwise spam the journal.
    const runner = cmd.match(/^\s*(?:npx|pnpm\s+dlx|npm\s+exec)\s+(?:-{1,2}[^\s]+\s+)*([@\w./-]+)/);
    if (runner) {
      const tool = runner[1].replace(/@.*/, '').replace(/^.*\//, '');
      if (INCIDENTAL_NPX_TOOLS.test(tool)) return null;
    }
    for (const pat of INTEGRATOR_BASH_PATTERNS) {
      if (pat.test(cmd)) {
        return { action: 'shell', subject: cmd.slice(0, 200), tool: 'Bash' };
      }
    }
    return null;
  }

  return null;
}

// ---------- Dedup ----------

function dedupKey(classification, isoMinute) {
  const h = crypto.createHash('sha1');
  h.update(`${classification.action}|${classification.subject}|${isoMinute}`);
  return h.digest('hex').slice(0, 16);
}

function isDuplicate(key) {
  const cache = readJSONSafe(DEDUP_PATH, { keys: [] });
  return Array.isArray(cache.keys) && cache.keys.includes(key);
}

function recordKey(key) {
  const cache = readJSONSafe(DEDUP_PATH, { keys: [] });
  cache.keys = (cache.keys || []).filter((k) => k !== key);
  cache.keys.push(key);
  if (cache.keys.length > DEDUP_CACHE_SIZE) {
    cache.keys = cache.keys.slice(-DEDUP_CACHE_SIZE);
  }
  writeJSONSafe(DEDUP_PATH, cache);
}

// ---------- Retention ----------

function maybeArchive() {
  if (!fs.existsSync(JOURNAL_PATH)) return;
  const content = fs.readFileSync(JOURNAL_PATH, 'utf8');
  const lines = content.split('\n');
  const headerIdx = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) headerIdx.push(i);
  }
  if (headerIdx.length <= RETENTION_THRESHOLD) return;

  // Move oldest half to archive
  const splitAt = headerIdx[Math.floor(headerIdx.length / 2)];
  const archiveContent = lines.slice(0, splitAt).join('\n');
  const keepContent = lines.slice(splitAt).join('\n');

  ensureDir(ARCHIVE_DIR);
  const ym = new Date().toISOString().slice(0, 7); // YYYY-MM
  const archivePath = path.join(ARCHIVE_DIR, `journal-${ym}.md`);

  try {
    // Append to existing archive of same month if present
    if (fs.existsSync(archivePath)) {
      fs.appendFileSync(archivePath, '\n' + archiveContent, 'utf8');
    } else {
      fs.writeFileSync(archivePath, archiveContent, 'utf8');
    }
    fs.writeFileSync(JOURNAL_PATH, keepContent, 'utf8');
    process.stderr.write(`[journal-hook] retention: archived ${headerIdx.length - (headerIdx.length - Math.floor(headerIdx.length / 2))} entries to ${archivePath}\n`);
  } catch (e) {
    process.stderr.write(`[journal-hook] archive failed: ${e.message}\n`);
  }
}

// ---------- Append journal entry ----------

function appendEntry(classification, isoTimestamp) {
  ensureDir(path.dirname(JOURNAL_PATH));

  // Initialize file with header if absent
  if (!fs.existsSync(JOURNAL_PATH)) {
    const header = '# Integrator Project Journal\n\n' +
      '> Autologged by hooks/integrator/journal-hook.js on every modifying action.\n' +
      '> Free-form rationale entries (from /integrator:* commands) interleave with auto-entries.\n\n';
    fs.writeFileSync(JOURNAL_PATH, header, 'utf8');
  }

  const subjectQuoted = classification.subject.replace(/`/g, '\\`');
  const entry = [
    '',
    `## [${isoTimestamp}] #auto`,
    '',
    `**Action:** ${classification.action}`,
    `**Subject:** \`${subjectQuoted}\``,
    `**Tool:** ${classification.tool}`,
    '',
  ].join('\n');

  fs.appendFileSync(JOURNAL_PATH, entry, 'utf8');
}

// ---------- Main ----------

function main() {
  const raw = readStdinSync();
  if (!raw.trim()) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[journal-hook] stdin not JSON: ${e.message}\n`);
    return;
  }

  const toolName = payload.tool_name || payload.tool || '';
  const toolInput = payload.tool_input || payload.input || {};
  if (!toolName) return;

  const classification = classifyAction(toolName, toolInput);
  if (!classification) return;

  const now = new Date();
  const iso = now.toISOString();
  const isoMinute = iso.slice(0, 16); // YYYY-MM-DDTHH:MM
  const key = dedupKey(classification, isoMinute);

  if (isDuplicate(key)) {
    return; // silent skip
  }

  try {
    appendEntry(classification, iso);
    recordKey(key);
    maybeArchive();
  } catch (e) {
    process.stderr.write(`[journal-hook] append failed: ${e.message}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyAction,
  dedupKey,
  INTEGRATOR_PATH_PATTERNS,
  INTEGRATOR_BASH_PATTERNS,
};
