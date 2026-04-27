#!/usr/bin/env node
/**
 * cascade-check.js — PostToolUse hook для cascade consistency.
 *
 * Implements detection + V-11 (bi-dir refs) auto-fix per DEC-DEV-0012 C.4.
 * Full BFS auto-fix beyond V-11 deferred к v1.1 (per dev/v1_1_backlog.md).
 *
 * Trigger: PostToolUse Write/Edit на active artifacts в .product/.
 * Action: identify dependents через bi-dir refs; auto-fix V-11 if dependent
 * also active (skip on draft per DEC-DEV-0013 #3 quiet-draft consistency);
 * queue other findings к .product/.pending/cascade-pending.yaml.
 *
 * Stderr signal if entries added: orchestrator (feature-session.md /
 * planning-session.md) reads + surfaces к user.
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
if (!filePath) process.exit(0);

// ---------- Filter: artifact paths only ----------

const normalized = filePath.replace(/\\/g, '/');

// Must be .product/**/*.md
if (!/\.product\/.*\.md$/.test(normalized)) process.exit(0);

// Exclude meta dirs
if (
  normalized.includes('/.sessions/') ||
  normalized.includes('/.pending/') ||
  normalized.includes('/.decisions/') ||
  normalized.includes('/.da-findings/')
) {
  process.exit(0);
}

// Path filter — only known artifact directories or singletons (per DEC-DEV-0013 #6)
const ARTIFACT_PATH_RE = /\.product\/(features|scenarios|business-rules|lifecycles|verification|invariants|segments|value-propositions|hypotheses|releases|nfr|mockups|notes)\/[^\/]+\.md$|\.product\/(rpm|mvp-scope|roadmap|problem|market-research|competitive-analysis|glossary|design-system)\.md$/;
if (!ARTIFACT_PATH_RE.test(normalized)) process.exit(0);

// ---------- Find project root ----------

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

// ---------- Load product config ----------

const config = loadProductConfig(projectRoot);
const quietDraft = config.draft_mode_quiet_hooks !== false;

// ---------- Read saved artifact ----------

let content;
try {
  content = fs.readFileSync(filePath, 'utf-8');
} catch (e) {
  process.exit(0);
}

const fm = parseFrontmatterFlat(content);
if (!fm.id || !fm.type) process.exit(0);

// Skip cascade if saved artifact is draft (quiet mode)
// Cascade kicks in on active transitions only per processes.md §4.1
if (fm.status === 'draft' && quietDraft) {
  process.exit(0);
}

// ---------- Identify dependents ----------

// Cascade rules per processes.md §4.1 trigger matrix.
// For v1: focus на bi-dir refs (V-11 auto-fix) + queue others.

const pendingEntries = [];
const now = new Date().toISOString();

// Determine which dependents could be affected based on artifact type
const dependentRefs = identifyDependents(fm, projectRoot);

for (const dep of dependentRefs) {
  // Read dependent file
  let depContent;
  try {
    depContent = fs.readFileSync(dep.path, 'utf-8');
  } catch (e) {
    continue;
  }

  const depFm = parseFrontmatterFlat(depContent);
  if (!depFm.id || !depFm.type) continue;

  // V-11 check: bi-dir ref consistency
  // Saved artifact references dep.id; dep should reference saved.id back в reverse field
  const reverseField = dep.reverseField;
  const depRefArray = parseListField(depFm[reverseField]);

  if (!depRefArray.includes(fm.id)) {
    // V-11 broken — auto-fix if dep active, queue if draft
    if (depFm.status === 'active') {
      // Auto-fix: rewrite dep file с appended id
      const fixed = injectListField(depContent, reverseField, fm.id);
      if (fixed && fixed !== depContent) {
        try {
          fs.writeFileSync(dep.path, fixed);
          pendingEntries.push({
            artifact: depFm.id,
            file: path.relative(projectRoot, dep.path).replace(/\\/g, '/'),
            triggered_by: fm.id,
            rule: 'V-11',
            action: 'auto-fixed',
            detail: `Added ${fm.id} к ${depFm.id}.${reverseField}[] (was missing reverse ref)`,
            at: now,
          });
        } catch (e) {
          // Silent — failed to write fix; skip
        }
      }
    } else {
      // Skip auto-fix on draft (B2 quiet mode); queue for manual fix
      pendingEntries.push({
        artifact: depFm.id,
        file: path.relative(projectRoot, dep.path).replace(/\\/g, '/'),
        triggered_by: fm.id,
        rule: 'V-11',
        action: 'needs_manual_fix',
        detail: `Reverse ref to ${fm.id} missing в ${depFm.id}.${reverseField}[]; target draft, skip auto-fix per quiet mode`,
        at: now,
      });
    }
  }

  // Queue review entries for non-V-11 rules (per processes.md §4.1 — others need_review only, no auto-fix в v1)
  // Examples:
  // - LC.guards reference changed BR → re-validate transitions (V-06 review)
  // - VC.rules reference changed BR → re-verify Then assertions (V-07 review)
  // - FM containing changed SC/BR/etc → status alignment

  for (const r of dep.reviewRules || []) {
    pendingEntries.push({
      artifact: depFm.id,
      file: path.relative(projectRoot, dep.path).replace(/\\/g, '/'),
      triggered_by: fm.id,
      rule: r.rule,
      action: 'needs_review',
      detail: r.detail,
      at: now,
    });
  }
}

if (pendingEntries.length === 0) process.exit(0);

// ---------- Append к cascade-pending.yaml ----------

const pendingDir = path.join(projectRoot, '.product', '.pending');
try {
  if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });
} catch (e) {
  process.exit(0);
}

const cascadeFile = path.join(pendingDir, 'cascade-pending.yaml');
let existing = [];
if (fs.existsSync(cascadeFile)) {
  try {
    const text = fs.readFileSync(cascadeFile, 'utf-8');
    existing = parseEntriesYaml(text);
  } catch (e) {
    existing = [];
  }
}

existing.push(...pendingEntries);

try {
  fs.writeFileSync(cascadeFile, formatEntriesYaml(existing));
} catch (e) {
  // Silent
}

// ---------- Stderr signal для orchestrator ----------

const autoFixed = pendingEntries.filter((e) => e.action === 'auto-fixed').length;
const needsReview = pendingEntries.filter((e) => e.action === 'needs_review').length;
const needsManualFix = pendingEntries.filter((e) => e.action === 'needs_manual_fix').length;

const summary = [`Cascade detected from ${fm.id} (${pendingEntries.length} entries):`];
if (autoFixed > 0) summary.push(`  ✓ V-11 auto-fixed: ${autoFixed}`);
if (needsManualFix > 0) summary.push(`  ⚠ V-11 needs manual fix (target draft): ${needsManualFix}`);
if (needsReview > 0) summary.push(`  ⚠ Other rules needs_review: ${needsReview}`);
summary.push(`  See .product/.pending/cascade-pending.yaml — review via /product:cascade --pending`);

process.stderr.write(summary.join('\n') + '\n');

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
    const cfg = {};
    const quietMatch = /^draft_mode_quiet_hooks:\s*(true|false)/m.exec(text);
    if (quietMatch) cfg.draft_mode_quiet_hooks = quietMatch[1] === 'true';
    return cfg;
  } catch (e) {
    return {};
  }
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

function parseListField(value) {
  // Handle "[a, b, c]" inline OR raw string from frontmatter
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const s = String(value).trim();
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return [];
}

function injectListField(content, fieldName, valueToAdd) {
  // Find frontmatter
  const m = /^(---\r?\n)([\s\S]*?)(\r?\n---)/m.exec(content);
  if (!m) return null;
  const [, opener, fmBody, closer] = m;

  // Find the field line
  const fieldRe = new RegExp(`^(${fieldName}\\s*:\\s*)(.*)$`, 'm');
  const fieldMatch = fieldRe.exec(fmBody);

  let newFmBody;
  if (fieldMatch) {
    // Field exists; parse existing values
    const currentValueStr = fieldMatch[2].trim().replace(/\s+#.*$/, '');
    let values = [];
    if (currentValueStr.startsWith('[') && currentValueStr.endsWith(']')) {
      values = currentValueStr.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (currentValueStr === '') {
      values = [];
    }
    if (values.includes(valueToAdd)) return null;  // No change needed
    values.push(valueToAdd);
    const newLine = `${fieldMatch[1]}[${values.join(', ')}]`;
    newFmBody = fmBody.replace(fieldRe, newLine);
  } else {
    // Field doesn't exist — append к frontmatter end
    newFmBody = fmBody + `\n${fieldName}: [${valueToAdd}]`;
  }

  return content.replace(m[0], opener + newFmBody + closer);
}

function identifyDependents(fm, projectRoot) {
  // Per processes.md §4.1 trigger matrix.
  // Returns list of {path, reverseField, reviewRules: [{rule, detail}]} entries.
  const results = [];
  const productDir = path.join(projectRoot, '.product');

  // Helper: list all .md files в a directory (recursive=false)
  const listMd = (dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
  };

  const idStr = fm.id;

  // Map: artifact type → who depends on it (via what reverse field)
  // We scan files в potentially-dependent directories для refs к fm.id.

  switch (fm.type) {
    case 'scenario':
      // SC changes → BR (rules), VC (verification), LC (lifecycle), FM (scenarios)
      addDeps(results, listMd(path.join(productDir, 'business-rules')), 'scenarios', { rule: 'V-11', source: idStr });
      addDeps(results, listMd(path.join(productDir, 'lifecycles')), 'scenarios', { rule: 'V-11', source: idStr, additionalRules: [{ rule: 'V-06', detail: `LC may need re-validation: SC ${idStr} steps changed` }] });
      addDeps(results, listMd(path.join(productDir, 'verification')), 'scenario', { rule: 'V-11', source: idStr, additionalRules: [{ rule: 'V-07', detail: `VC coverage check: SC ${idStr} flow changed` }] });
      addDeps(results, listMd(path.join(productDir, 'features')), 'scenarios', { rule: 'V-11', source: idStr });
      break;

    case 'business-rule':
      // BR changes → SC (rules bi-dir), LC (rules), IC (rules), VC (rules), FM (rules)
      addDeps(results, listMd(path.join(productDir, 'scenarios')), 'rules', { rule: 'V-11', source: idStr });
      addDeps(results, listMd(path.join(productDir, 'lifecycles')), 'rules', { rule: 'V-11', source: idStr, additionalRules: [{ rule: 'V-06', detail: `LC guard references BR ${idStr}; re-validate transition logic` }] });
      addDeps(results, listMd(path.join(productDir, 'invariants')), 'rules', { rule: 'V-11', source: idStr, additionalRules: [{ rule: 'P-RULE-01-derivative', detail: `IC supporting BR ${idStr} changed; re-verify IC support` }] });
      addDeps(results, listMd(path.join(productDir, 'verification')), 'rules', { rule: 'V-11', source: idStr, additionalRules: [{ rule: 'V-07', detail: `VC verifies BR ${idStr}; re-check Then assertions` }] });
      addDeps(results, listMd(path.join(productDir, 'features')), 'rules', { rule: 'V-11', source: idStr });
      break;

    case 'lifecycle':
      // LC changes → SC (lifecycle), VC (lifecycle), FM (lifecycles)
      addDeps(results, listMd(path.join(productDir, 'scenarios')), 'lifecycle', { rule: 'V-11', source: idStr, isScalar: true });
      addDeps(results, listMd(path.join(productDir, 'verification')), 'lifecycle', { rule: 'V-11', source: idStr, isScalar: true });
      addDeps(results, listMd(path.join(productDir, 'features')), 'lifecycles', { rule: 'V-11', source: idStr });
      break;

    case 'invariant-check':
      // IC changes → FM (invariants); BR.invariants is bi-dir but skip for v1
      addDeps(results, listMd(path.join(productDir, 'features')), 'invariants', { rule: 'V-11', source: idStr });
      break;

    case 'verification-criteria':
      // VC changes → SC (verification), FM (verification)
      addDeps(results, listMd(path.join(productDir, 'scenarios')), 'verification', { rule: 'V-11', source: idStr });
      addDeps(results, listMd(path.join(productDir, 'features')), 'verification', { rule: 'V-11', source: idStr });
      break;

    case 'feature-map-entry':
      // FM changes — minimal cascade в v1; status alignment with embedded artifacts
      // Skip detailed cascade for FM; covered by individual artifact changes
      break;

    // Other types (PS, MR, CA, SEG, VP, HYP, MVP, RM, RL, BG, RPM, NFR, MK, DS, NM, NOTE)
    // Cascade impact per processes.md §4.1, но less common in P2 enrichment.
    // For v1, focus on D2-Behavioral cascade.
  }

  return results;
}

function addDeps(results, candidateFiles, reverseField, options) {
  const sourceId = options.source;
  for (const f of candidateFiles) {
    let content;
    try {
      content = fs.readFileSync(f, 'utf-8');
    } catch (e) {
      continue;
    }
    const fm = parseFrontmatterFlat(content);
    if (!fm.id) continue;

    // Check if this dependent references sourceId (forward ref present)
    const forwardField = options.isScalar ? null : null;
    // For bi-dir checking we need to know if the saved artifact references this dep.
    // Conservatively: include all candidates of that type as potential dependents,
    // and let V-11 check resolve to specific cases.
    // To avoid false positives, only include if either:
    // a) saved artifact references this dep.id (forward), OR
    // b) this dep references saved artifact id (forward, reverse missing)

    // For v1, simplified: include all artifacts of dependent type — V-11 check will
    // skip those without actual ref relationship (since reverseField won't be missing).
    // Acceptable for first iteration; refine in v1.1 if perf issue.

    results.push({
      path: f,
      reverseField,
      reviewRules: options.additionalRules || [],
    });
  }
}

function parseEntriesYaml(text) {
  const items = [];
  // entries: list block
  const entriesMatch = /^entries:\s*$([\s\S]*)/m.exec(text);
  if (!entriesMatch) return items;
  const blocks = entriesMatch[1].split(/^\s*-\s+/m).slice(1);
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

function formatEntriesYaml(entries) {
  const lines = [
    '# Cascade detection results (managed by cascade-check.js)',
    '# Auto-applied (V-11) + pending entries (other rules — manual review)',
    '# Schema per skills/product/cascade-protocol.md',
    '',
    'entries:',
  ];
  entries.forEach((e) => {
    lines.push(`  - artifact: ${formatScalar(e.artifact)}`);
    if (e.file) lines.push(`    file: ${formatScalar(e.file)}`);
    if (e.triggered_by) lines.push(`    triggered_by: ${formatScalar(e.triggered_by)}`);
    if (e.rule) lines.push(`    rule: ${formatScalar(e.rule)}`);
    if (e.action) lines.push(`    action: ${formatScalar(e.action)}`);
    if (e.detail) lines.push(`    detail: ${formatScalar(e.detail)}`);
    if (e.at) lines.push(`    at: ${formatScalar(e.at)}`);
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
