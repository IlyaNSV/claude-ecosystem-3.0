#!/usr/bin/env node
/**
 * hooks/integrator/scope-guard.js — Integrator scope-boundary guard.
 *
 * Per DEC-DEV-0047 / patch 1.3.3 deliverable B-2.
 *
 * PreToolUse hook (matcher: Edit|Write|Bash). Fires only when an Integrator
 * slash-command is active (detected via `.claude/integrator/.session-context.json`
 * marker; stale TTL = 1 hour). On forbidden path/command:
 *   - emit loud stderr warning (multi-line, emoji prefix)
 *   - append entry to `.claude/pending-actions.md` (PA-NNN, dedup'd by
 *     (action, subject, minute))
 *   - exit 0 (warn-only — does NOT block tool execution)
 *
 * Warn-only convention follows the ecosystem-wide hook pattern (see
 * `hooks/product/product-handoff-gate.js:12-20` comment block). Hard-block
 * mode is deferred to v1.4.0+ — see `dev/v1_1_backlog.md` "hard-block
 * scope-guard" entry. Override would require a DEC-DEV-level decision +
 * cross-hook review per ecosystem convention.
 *
 * Forbidden paths (single source of truth here for patch 1.3.3; centralized
 * cross-hook config = v1.4.0 candidate):
 *   - .product/        — Product Module territory
 *   - .kiro/           — cc-sdd output (consumed by Integrator, not editable)
 *   - docs/pmo/        — PMO meta-docs (ecosystem repo workdir variant)
 *   - .claude/docs/pmo/ — PMO meta-docs (pilot project workdir variant)
 *
 * Whitelisted exceptions:
 *   - .product/.sessions/  (transient session state)
 *   - .product/.pending/   (transient pending state)
 *   - .claude/integrator/.session-context.json (marker — written by Integrator commands themselves)
 *   - .claude/integrator/.scope-guard-dedup.json (hook's own dedup cache)
 *   - .claude/pending-actions.md (PA journal — hook itself writes here)
 *
 * Bash matcher: regex sniffer (NOT AST parser — see Decision 2 of readiness
 * §B-2). Complex constructs (here-docs, subshells, var expansion) may slip
 * through; Edit/Write coverage is the reliable layer.
 *
 * Stderr only on internal error. Never blocks tool execution (per ecosystem
 * convention; exit 0 always).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MARKER_PATH = path.join(PROJECT_ROOT, '.claude/integrator/.session-context.json');
const DEDUP_PATH = path.join(PROJECT_ROOT, '.claude/integrator/.scope-guard-dedup.json');
const PENDING_ACTIONS_PATH = path.join(PROJECT_ROOT, '.claude/pending-actions.md');

const STALE_MARKER_MS = 60 * 60 * 1000; // 1 hour
const DEDUP_CACHE_SIZE = 100;

// ---------- Forbidden path patterns ----------
//
// Apply to normalized (forward-slash) paths. Each entry is a RegExp.
// Whitelist exceptions handled by FORBIDDEN_PATH_EXCEPTIONS — checked first.
//
const FORBIDDEN_PATH_PATTERNS = [
  /(^|\/)\.product\//,
  /(^|\/)\.kiro\//,
  /(^|\/)docs\/pmo\//,
  /(^|\/)\.claude\/docs\/pmo\//,
];

const FORBIDDEN_PATH_EXCEPTIONS = [
  /(^|\/)\.product\/\.sessions\//,
  /(^|\/)\.product\/\.pending\//,
  /(^|\/)\.claude\/integrator\/\.session-context\.json$/,
  /(^|\/)\.claude\/integrator\/\.scope-guard-dedup\.json$/,
  /(^|\/)\.claude\/pending-actions\.md$/,
];

// ---------- Bash matcher patterns ----------
//
// Best-effort regex sniffer for common shell mutation idioms targeting
// forbidden paths. NOT AST-aware: subshells, here-docs, var expansion may
// not be detected. Edit/Write matchers are the authoritative layer.
//
const FORBIDDEN_PATH_SHELL_FRAGMENT = '(\\.product/|\\.kiro/|docs/pmo/|\\.claude/docs/pmo/)';

const BASH_MUTATING_PATTERNS = [
  // rm / cp / mv / tee / truncate / touch targeting forbidden path
  new RegExp(`\\b(rm|cp|mv|tee|truncate|touch)\\b[^|;]*?${FORBIDDEN_PATH_SHELL_FRAGMENT}`),
  // sed -i targeting forbidden path
  new RegExp(`\\bsed\\s+-i[^|;]*?${FORBIDDEN_PATH_SHELL_FRAGMENT}`),
  // echo / printf / cat redirected (>, >>) into forbidden path
  new RegExp(`\\b(echo|printf|cat)\\b[^|;]*?>>?\\s*${FORBIDDEN_PATH_SHELL_FRAGMENT}`),
  // python / node / ruby / perl -e/-c targeting forbidden path in args
  new RegExp(`\\b(python|node|ruby|perl)\\s+-[ec][^|;]*?${FORBIDDEN_PATH_SHELL_FRAGMENT}`),
  // Direct redirect (`>` or `>>`) into forbidden path (catches some constructs the above miss)
  new RegExp(`>>?\\s*${FORBIDDEN_PATH_SHELL_FRAGMENT}`),
];

// ---------- IO helpers ----------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
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
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[scope-guard] dedup cache write failed: ${e.message}\n`);
  }
}

// ---------- Session marker ----------

function readSessionMarker() {
  if (!fs.existsSync(MARKER_PATH)) return null;
  let raw;
  try {
    raw = fs.readFileSync(MARKER_PATH, 'utf8');
  } catch (_) {
    return null;
  }
  let marker;
  try {
    marker = JSON.parse(raw);
  } catch (_) {
    return null;
  }
  if (!marker || typeof marker !== 'object' || !marker.started_at) return null;

  // Stale TTL check
  const startedAt = Date.parse(marker.started_at);
  if (Number.isNaN(startedAt)) return null;
  if (Date.now() - startedAt > STALE_MARKER_MS) {
    // Stale — proactively remove and treat as absent
    try { fs.unlinkSync(MARKER_PATH); } catch (_) { /* ignore */ }
    return null;
  }
  return marker;
}

// ---------- Path classification ----------

function normalizePath(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/');
}

function isWhitelisted(normalizedPath) {
  for (const re of FORBIDDEN_PATH_EXCEPTIONS) {
    if (re.test(normalizedPath)) return true;
  }
  return false;
}

function classifyEditWrite(toolInput) {
  const p = toolInput && (toolInput.file_path || toolInput.notebook_path);
  if (!p) return null;
  const norm = normalizePath(p);
  if (isWhitelisted(norm)) return null;
  for (const re of FORBIDDEN_PATH_PATTERNS) {
    if (re.test(norm)) {
      return { action: 'write', subject: norm };
    }
  }
  return null;
}

function classifyBash(toolInput) {
  const cmd = toolInput && toolInput.command;
  if (!cmd || typeof cmd !== 'string') return null;
  for (const re of BASH_MUTATING_PATTERNS) {
    if (re.test(cmd)) {
      // Don't false-positive on whitelist subpaths (e.g. `> .product/.sessions/foo`)
      const wsMatch = FORBIDDEN_PATH_EXCEPTIONS.some((ex) => ex.test(cmd));
      if (wsMatch) return null;
      return { action: 'shell', subject: cmd.slice(0, 200) };
    }
  }
  return null;
}

function classify(toolName, toolInput) {
  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit') {
    return classifyEditWrite(toolInput);
  }
  if (toolName === 'Bash') {
    return classifyBash(toolInput);
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

// ---------- Pending-actions append ----------

function nextPAId(content) {
  // Tail-scan for `## PA-(\d+)` headers; increment max.
  const re = /^##\s+PA-(\d+)\b/gm;
  let max = 0;
  let m;
  while ((m = re.exec(content)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function appendPAEntry(classification, marker, isoTimestamp) {
  // Best-effort: only append if pending-actions.md exists. If missing —
  // emit hint to stderr and skip (file initialized via /ecosystem:bootstrap
  // Step 6 — patch 1.3.3 sub-phase F).
  if (!fs.existsSync(PENDING_ACTIONS_PATH)) {
    process.stderr.write(
      '[scope-guard] .claude/pending-actions.md not initialized; PA entry skipped.\n' +
      '  Run /ecosystem:update to backfill (patch 1.3.3 sub-phase F).\n'
    );
    return null;
  }
  let content;
  try {
    content = fs.readFileSync(PENDING_ACTIONS_PATH, 'utf8');
  } catch (e) {
    process.stderr.write(`[scope-guard] failed to read pending-actions.md: ${e.message}\n`);
    return null;
  }
  const paId = nextPAId(content);
  const paIdPadded = String(paId).padStart(3, '0');
  const subjectEscaped = classification.subject.replace(/`/g, '\\`');
  const cmd = (marker && marker.command) || '/integrator:?';
  const entry = [
    '',
    `## PA-${paIdPadded} — Integrator scope-guard violation (${classification.action})`,
    '',
    '**Status:** pending',
    `**Created:** ${isoTimestamp}`,
    '**Source:** integrator',
    `**Trigger:** scope-guard hook fired during ${cmd}`,
    '**Action required:** Review the flagged write and decide: revert (and switch to correct module context), or confirm intentional override.',
    '',
    '**Details:**',
    '',
    `- Action: \`${classification.action}\``,
    `- Subject: \`${subjectEscaped}\``,
    `- Active Integrator command: \`${cmd}\``,
    '- Hook: `hooks/integrator/scope-guard.js` (PreToolUse, warn-only)',
    '',
    '**Blocking:** none (warn-only); investigate before next Integrator session if violation was unintentional.',
    '',
  ].join('\n');
  try {
    fs.appendFileSync(PENDING_ACTIONS_PATH, entry, 'utf8');
    return `PA-${paIdPadded}`;
  } catch (e) {
    process.stderr.write(`[scope-guard] PA append failed: ${e.message}\n`);
    return null;
  }
}

// ---------- Warning ----------

function emitWarning(classification, marker, paId) {
  const lines = [
    '',
    '⚠️ INTEGRATOR SCOPE GUARD',
    `   Active command: ${(marker && marker.command) || '/integrator:?'}`,
    `   Detected: ${classification.action} → ${classification.subject}`,
    '   This path is outside Integrator territory (Product / cc-sdd / PMO docs).',
    '',
    '   If intentional — switch context to the correct module (e.g., /product:*),',
    '   or explicitly confirm the override in this session.',
    '',
  ];
  if (paId) {
    lines.push(`   Pending action logged: ${paId} → .claude/pending-actions.md`);
    lines.push('');
  }
  process.stderr.write(lines.join('\n'));
}

// ---------- Main ----------

function main() {
  const raw = readStdinSync();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[scope-guard] stdin not JSON: ${e.message}\n`);
    return;
  }

  const toolName = payload.tool_name || payload.tool || '';
  const toolInput = payload.tool_input || payload.input || {};
  if (!toolName) return;

  // Session marker: hook is no-op unless an Integrator command is active.
  const marker = readSessionMarker();
  if (!marker) return;

  // Classify
  const classification = classify(toolName, toolInput);
  if (!classification) return;

  // Dedup
  const now = new Date();
  const iso = now.toISOString();
  const isoMinute = iso.slice(0, 16);
  const key = dedupKey(classification, isoMinute);
  if (isDuplicate(key)) return;
  recordKey(key);

  // PA append + warning
  const paId = appendPAEntry(classification, marker, iso);
  emitWarning(classification, marker, paId);
}

if (require.main === module) {
  main();
}

module.exports = {
  classify,
  classifyEditWrite,
  classifyBash,
  dedupKey,
  nextPAId,
  FORBIDDEN_PATH_PATTERNS,
  FORBIDDEN_PATH_EXCEPTIONS,
  BASH_MUTATING_PATTERNS,
  STALE_MARKER_MS,
};
