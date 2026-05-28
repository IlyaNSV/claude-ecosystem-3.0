#!/usr/bin/env node
/**
 * design-artifact-validate.js — PostToolUse hook for Design Module artifacts
 * (MK, DS, NM). Per DEC-DEV-0052 Q8.
 *
 * Validates:
 *   - YAML frontmatter parseable
 *   - 5 required fields (MK): id, type, feature, design_tool, scenarios
 *     (DS: id, type, status; NM: id, type, feature, mockups)
 *   - Ref existence (MK.scenarios → .product/scenarios/SC-*.md;
 *                    MK.feature → .product/features/FM-*.md;
 *                    NM.mockups → .product/mockups/MK-*.md;
 *                    NM.feature → .product/features/FM-*.md)
 *   - V-MK-08 (MK only): token regex DS\.\w+\.\w+(?:-\w+)* — refs match DS body
 *
 * SPEC §B2 quiet-draft mode (Q8):
 *   - status: draft     → queue findings к .product/.pending/validation-pending.yaml; no stderr surface
 *   - status: non-draft → surface к stderr (review / active / deprecated all visible)
 *
 * Exit 0 always (non-blocking per ecosystem hook convention; strict mode deferred к v1.1+
 * per v1_1_backlog «Integrator hard-block scope-guard» class pattern).
 *
 * Cross-platform path normalization: filePath.replace(/\\/g, '/') per Phase 5 bug 3
 * (DEC-DEV-0044) — Windows backslash compatibility.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- Read Claude Code hook input from stdin ----------

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
if (!filePath) {
  process.exit(0);
}

// ---------- Filter: only Design Module artifacts ----------

const normalized = filePath.replace(/\\/g, '/');

// MK + NM live in .product/mockups/; DS is .product/design-system.md singleton
const isMockup = /\.product\/mockups\/(MK|NM)-[^/]+\.md$/.test(normalized);
const isDS = /\.product\/design-system\.md$/.test(normalized);

if (!isMockup && !isDS) {
  process.exit(0);
}

// Skip drafts-in-progress / hook-meta files
if (normalized.includes('/.design-sessions/') || normalized.includes('/.pending/')) {
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
  yaml.split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    const key = kv[1];
    let val = kv[2].trim();
    val = val.replace(/\s+#.*$/, '').trim();
    val = val.replace(/^["'](.*)["']$/, '$1');
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    obj[key] = val;
  });
  return obj;
}

const fm = parseFrontmatter(content);

if (!fm.id || !fm.type) {
  // Unparseable frontmatter — likely in progress; skip silently
  process.exit(0);
}

// ---------- Locate project root (existing pattern from hooks/product/) ----------

function findProjectRoot(filePathNormalized) {
  let dir = path.dirname(path.resolve(filePathNormalized));
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude')) && fs.existsSync(path.join(dir, '.product'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

// ---------- Apply applicable checks per artifact type ----------

const findings = [];

if (fm.type === 'mockup-package') {
  // MK required fields per DEC-DEV-0052 Q8: id, type, feature, design_tool, scenarios
  const required = ['id', 'type', 'feature', 'design_tool', 'scenarios'];
  for (const field of required) {
    if (!fm[field] || (Array.isArray(fm[field]) && fm[field].length === 0)) {
      findings.push({
        rule: 'V-MK-frontmatter',
        severity: 'blocking',
        message: `MK ${fm.id || '<unknown>'}: missing required frontmatter field '${field}' (Q8)`,
      });
    }
  }

  // design_tool enum (per SPEC §10.4 + MK.md frontmatter schema)
  if (fm.design_tool) {
    const validTools = ['stitch', 'claude-design', 'figma', 'penpot', 'html'];
    if (!validTools.includes(fm.design_tool)) {
      findings.push({
        rule: 'V-MK-frontmatter',
        severity: 'warning',
        message: `MK ${fm.id}: design_tool '${fm.design_tool}' not в enum [${validTools.join('|')}]`,
      });
    }
  }

  // Ref existence — feature (FM)
  if (fm.feature) {
    const fmDir = path.join(projectRoot, '.product', 'features');
    const exists = checkArtifactExists(fmDir, fm.feature);
    if (!exists) {
      findings.push({
        rule: 'V-MK-feature-ref',
        severity: 'blocking',
        message: `MK ${fm.id}: feature ${fm.feature} not found в .product/features/`,
      });
    }
  }

  // Ref existence — scenarios (SC)
  if (Array.isArray(fm.scenarios)) {
    const scDir = path.join(projectRoot, '.product', 'scenarios');
    for (const scId of fm.scenarios) {
      const exists = checkArtifactExists(scDir, scId);
      if (!exists) {
        findings.push({
          rule: 'V-MK-sc-ref',
          severity: 'blocking',
          message: `MK ${fm.id}: scenarios reference ${scId} not found в .product/scenarios/`,
        });
      }
    }
  }

  // V-MK-08: DS token coverage
  const dsPath = path.join(projectRoot, '.product', 'design-system.md');
  if (fs.existsSync(dsPath)) {
    try {
      const dsContent = fs.readFileSync(dsPath, 'utf-8');
      const tokenRegex = /DS\.\w+\.\w+(?:-\w+)*/g;
      const mkTokens = new Set();
      let match;
      while ((match = tokenRegex.exec(content)) !== null) {
        mkTokens.add(match[0]);
      }
      // Build DS resolved tokens set (any DS.x.y mentioned в DS body counts as resolved)
      const dsTokens = new Set();
      tokenRegex.lastIndex = 0;
      while ((match = tokenRegex.exec(dsContent)) !== null) {
        dsTokens.add(match[0]);
      }
      for (const tok of mkTokens) {
        if (!dsTokens.has(tok)) {
          findings.push({
            rule: 'V-MK-08',
            severity: 'warning',
            message: `MK ${fm.id}: token ${tok} referenced but not declared в DS (.product/design-system.md)`,
          });
        }
      }
    } catch (e) {
      // DS read failed — silent; check is informational
    }
  }
  // If DS missing entirely — skip V-MK-08 (first MK ever создаёт DS skeleton; check would flood)
} else if (fm.type === 'design-system') {
  // DS required: id, type, status (minimal — DS is singleton)
  const required = ['id', 'type', 'status'];
  for (const field of required) {
    if (!fm[field]) {
      findings.push({
        rule: 'V-DS-frontmatter',
        severity: 'blocking',
        message: `DS: missing required frontmatter field '${field}'`,
      });
    }
  }
  if (fm.id && fm.id !== 'DS') {
    findings.push({
      rule: 'V-DS-id',
      severity: 'blocking',
      message: `DS singleton: id should be 'DS' literally (found: '${fm.id}')`,
    });
  }
} else if (fm.type === 'navigation-map') {
  // NM required: id, type, feature, mockups
  const required = ['id', 'type', 'feature', 'mockups'];
  for (const field of required) {
    if (!fm[field] || (Array.isArray(fm[field]) && fm[field].length === 0)) {
      findings.push({
        rule: 'V-NM-frontmatter',
        severity: 'blocking',
        message: `NM ${fm.id || '<unknown>'}: missing required frontmatter field '${field}'`,
      });
    }
  }

  // Ref existence — feature (FM)
  if (fm.feature) {
    const fmDir = path.join(projectRoot, '.product', 'features');
    const exists = checkArtifactExists(fmDir, fm.feature);
    if (!exists) {
      findings.push({
        rule: 'V-NM-feature-ref',
        severity: 'blocking',
        message: `NM ${fm.id}: feature ${fm.feature} not found в .product/features/`,
      });
    }
  }

  // Ref existence — mockups (MK)
  if (Array.isArray(fm.mockups)) {
    const mkDir = path.join(projectRoot, '.product', 'mockups');
    for (const mkId of fm.mockups) {
      const exists = checkArtifactExists(mkDir, mkId);
      if (!exists) {
        findings.push({
          rule: 'V-NM-mk-ref',
          severity: 'blocking',
          message: `NM ${fm.id}: mockups reference ${mkId} not found в .product/mockups/`,
        });
      }
    }
  }
}

// ---------- Quiet-draft mode (SPEC §B2 / Q8) ----------

const status = (fm.status || '').toLowerCase();

if (status === 'draft' && findings.length > 0) {
  // Queue findings, no stderr surface
  queueValidationFindings(projectRoot, filePath, fm.id, findings);
  process.exit(0);
}

// ---------- Surface findings (status != draft) ----------

if (findings.length > 0) {
  const lines = [];
  lines.push(`[design-artifact-validate] ${fm.id} (type=${fm.type}, status=${fm.status || '<missing>'}):`);
  findings.forEach((f) => {
    const icon = f.severity === 'blocking' ? '🔴' : f.severity === 'warning' ? '🟡' : '🔵';
    lines.push(`  ${icon} ${f.rule}: ${f.message}`);
  });
  process.stderr.write(lines.join('\n') + '\n');
}

process.exit(0);

// ---------- Helpers ----------

/**
 * Check if any file matching <id-prefix>*.md exists в dir.
 * Pattern: id like 'FM-001' should match 'FM-001-anything.md' OR 'FM-001.md'.
 * For 'DS' (singleton) — special path: check '<dir>/../design-system.md'.
 */
function checkArtifactExists(dir, id) {
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = fs.readdirSync(dir);
    const prefix = id + '-';  // e.g. 'FM-001-'
    const exact = id + '.md';
    for (const entry of entries) {
      if (entry === exact) return true;
      if (entry.startsWith(prefix) && entry.endsWith('.md')) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function parsePendingYaml(text) {
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
  const lines = [
    '# Pending validation findings (design-artifact-validate.js — quiet-draft mode)',
    '# Surfaced at: D.5 approve gate (design-validation.md skill) / /product:validate / /design:status',
    '',
  ];
  queue.forEach((item) => {
    lines.push('-');
    Object.entries(item).forEach(([k, v]) => {
      const val = typeof v === 'string' && /[:\s#]/.test(v) ? JSON.stringify(v) : v;
      lines.push(`  ${k}: ${val}`);
    });
  });
  return lines.join('\n') + '\n';
}

function queueValidationFindings(projectRoot, filePath, artifactId, findings) {
  const pendingDir = path.join(projectRoot, '.product', '.pending');
  try {
    if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
  } catch (e) {
    return;
  }

  const queueFile = path.join(pendingDir, 'validation-pending.yaml');
  let queue = [];
  if (fs.existsSync(queueFile)) {
    try {
      queue = parsePendingYaml(fs.readFileSync(queueFile, 'utf-8'));
    } catch (e) {
      queue = [];
    }
  }

  // Purge prior entries for этот artifact (parallel hooks/product/artifact-validate.js DEC-DEV-0023 pattern)
  queue = queue.filter((e) => e.artifact !== artifactId);

  const now = new Date().toISOString();
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  findings.forEach((f) => {
    queue.push({
      artifact: artifactId,
      file: relPath,
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      status: 'pending',
      source: 'design-artifact-validate',
      queued_at: now,
    });
  });

  try {
    fs.writeFileSync(queueFile, formatPendingYaml(queue));
  } catch (e) {
    // Silent fail
  }
}
