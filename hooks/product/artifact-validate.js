#!/usr/bin/env node
/**
 * artifact-validate.js — PostToolUse hook for .product/ artifact validation.
 *
 * v1 modifications:
 *   B1 — tier-aware (pilot: only 🔴 Blocking inline; mvp: + 🟡 Warning; full: all)
 *   B2 — quiet draft mode (findings queued when status=draft, surfaced on approve)
 *
 * Reads stdin (Claude Code hook JSON), parses artifact frontmatter, applies
 * applicable V-* rules per tier, writes findings (stderr or queue file).
 *
 * Exit 0 always — non-blocking.
 *
 * Scope v1: V-01, V-03, V-04, V-09, V-10, V-11 (basic, automatable).
 * Full catalog in .claude/docs/pmo/validation.md §5.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- Read Claude Code hook input from stdin ----------

let rawInput = '';
try {
  rawInput = fs.readFileSync(0, 'utf-8');
} catch (e) {
  // No stdin — manual invocation for testing. Exit cleanly.
  process.exit(0);
}

let hookInput;
try {
  hookInput = JSON.parse(rawInput);
} catch (e) {
  // Invalid JSON — likely not called by Claude Code. Exit cleanly.
  process.exit(0);
}

const filePath = hookInput?.tool_input?.file_path;
if (!filePath) {
  process.exit(0);
}

// ---------- Filter: only .product/**/*.md ----------

const normalized = filePath.replace(/\\/g, '/');
if (!/\.product\/.*\.md$/.test(normalized)) {
  process.exit(0);
}

// Skip hook-meta files
if (normalized.includes('/.sessions/') || normalized.includes('/.pending/')) {
  process.exit(0);
}

// ---------- Read the artifact file ----------

let content;
try {
  content = fs.readFileSync(filePath, 'utf-8');
} catch (e) {
  process.exit(0);
}

// ---------- Parse minimal frontmatter ----------

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return {};
  const yaml = m[1];
  const obj = {};
  // Simple key: value extraction (v1 — doesn't handle nested YAML)
  yaml.split(/\r?\n/).forEach((line) => {
    // Skip comments and empty lines
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    const key = kv[1];
    let val = kv[2].trim();
    // Strip inline comments
    val = val.replace(/\s+#.*$/, '').trim();
    // Strip quotes
    val = val.replace(/^["'](.*)["']$/, '$1');
    // Parse list — simple "[a, b, c]"
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    obj[key] = val;
  });
  return obj;
}

const fm = parseFrontmatter(content);

if (!fm.id || !fm.type) {
  // No parseable frontmatter or missing id/type — skip validation (may be in progress)
  process.exit(0);
}

// ---------- Load config: validation_tier + draft quiet mode ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

const config = loadProductConfig(projectRoot);
const tier = config.validation_tier || 'pilot'; // default pilot per CHANGELOG
const quietDraft = config.draft_mode_quiet_hooks !== false; // default true

// ---------- Apply applicable V-* rules ----------

const findings = [];

// V-09: SEG has exactly 1 VP
if (fm.type === 'segment' && fm.status === 'active') {
  if (!fm.value_proposition) {
    findings.push({
      rule: 'V-09',
      severity: 'blocking',
      message: `SEG ${fm.id} active but missing value_proposition in frontmatter`,
    });
  }
}

// V-10: FM has SEG and JTBD
if (fm.type === 'feature-map-entry') {
  if (!fm.segment) {
    findings.push({
      rule: 'V-10',
      severity: 'blocking',
      message: `FM ${fm.id} missing segment in frontmatter`,
    });
  }
  const jtbd = Array.isArray(fm.jtbd) ? fm.jtbd : [];
  if (jtbd.length === 0) {
    findings.push({
      rule: 'V-10',
      severity: 'blocking',
      message: `FM ${fm.id} missing jtbd[] in frontmatter`,
    });
  }
}

// V-04: SC references active FM
if (fm.type === 'scenario' && fm.status === 'active') {
  if (!fm.feature) {
    findings.push({
      rule: 'V-04',
      severity: 'blocking',
      message: `SC ${fm.id} active but missing feature reference`,
    });
  }
}

// V-01: FM has ≥1 active SC (requires cross-file check — skip in hook, defer to gate)
// Covered by approve-gate validation, not inline here (too expensive per save)

// V-11 auto-fix for bi-dir refs — skip in v1 inline hook, handle at approve gate

// Confidence field present (C2 modification)
if (fm.status === 'active' && !fm.confidence) {
  findings.push({
    rule: 'C2',
    severity: 'warning',
    message: `${fm.id} in active status but missing 'confidence:' field (C2 modification)`,
  });
}

// ---------- Filter by tier (B1 modification) ----------

const tierAllowsSeverity = (severity) => {
  if (tier === 'pilot') return severity === 'blocking';
  if (tier === 'mvp') return ['blocking', 'warning'].includes(severity);
  if (tier === 'full') return true;
  return severity === 'blocking'; // fallback
};

const toSurface = findings.filter((f) => tierAllowsSeverity(f.severity));

// ---------- Quiet mode (B2 modification) ----------

if (fm.status === 'draft' && quietDraft) {
  // Queue findings, don't surface
  const pendingDir = path.join(projectRoot, '.product', '.pending');
  try {
    if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
    const queueFile = path.join(pendingDir, 'validation-pending.yaml');
    let queue = [];
    if (fs.existsSync(queueFile)) {
      const existing = fs.readFileSync(queueFile, 'utf-8');
      queue = parsePendingYaml(existing);
    }
    toSurface.forEach((f) => {
      queue.push({
        artifact: fm.id,
        file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        rule: f.rule,
        severity: f.severity,
        message: f.message,
        queued_at: new Date().toISOString(),
      });
    });
    fs.writeFileSync(queueFile, formatPendingYaml(queue));
  } catch (e) {
    // Silent fail — don't break workflow
  }
  process.exit(0);
}

// ---------- Surface findings to stderr (non-blocking) ----------

if (toSurface.length > 0) {
  const lines = [];
  lines.push(`Validation findings for ${fm.id} (tier=${tier}):`);
  toSurface.forEach((f) => {
    const icon = f.severity === 'blocking' ? '🔴' : f.severity === 'warning' ? '🟡' : '🔵';
    lines.push(`  ${icon} ${f.rule}: ${f.message}`);
  });
  process.stderr.write(lines.join('\n') + '\n');
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

function loadProductConfig(projectRoot) {
  const cfgPath = path.join(projectRoot, '.claude', 'product.yaml');
  if (!fs.existsSync(cfgPath)) return {};
  try {
    const text = fs.readFileSync(cfgPath, 'utf-8');
    // Extract simple fields we need
    const cfg = {};
    const tierMatch = /^validation_tier:\s*(\w+)/m.exec(text);
    if (tierMatch) cfg.validation_tier = tierMatch[1].trim();
    const quietMatch = /^draft_mode_quiet_hooks:\s*(true|false)/m.exec(text);
    if (quietMatch) cfg.draft_mode_quiet_hooks = quietMatch[1] === 'true';
    return cfg;
  } catch (e) {
    return {};
  }
}

function parsePendingYaml(text) {
  // v1 minimal: queue is array of objects, each represented as indented block
  // Re-parse not critical — we mostly append. Safe fallback: return empty.
  try {
    const items = [];
    const blocks = text.split(/^-\s+/m).slice(1);
    blocks.forEach((block) => {
      const item = {};
      block.split(/\r?\n/).forEach((line) => {
        const kv = /^\s*([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
        if (kv) item[kv[1]] = kv[2].trim();
      });
      if (Object.keys(item).length) items.push(item);
    });
    return items;
  } catch (e) {
    return [];
  }
}

function formatPendingYaml(queue) {
  const lines = ['# Pending validation findings (B2 quiet draft mode)',
                 '# Surfaced at: approve gate, /product:status, /product:validate', ''];
  queue.forEach((item) => {
    lines.push('-');
    Object.entries(item).forEach(([k, v]) => {
      const val = typeof v === 'string' && /[:\s#]/.test(v) ? JSON.stringify(v) : v;
      lines.push(`  ${k}: ${val}`);
    });
  });
  return lines.join('\n') + '\n';
}
