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

// Dedup against existing entries by composite key (artifact, rule, triggered_by)
// — original code unconditionally appended, growing монотонно (DEC-DEV-0023 fix).
// Skip duplicates; keep first-seen entry (preserves earliest at: timestamp).
const seenKeys = new Set(
  existing.map((e) => `${e.artifact || ''}|${e.rule || ''}|${e.triggered_by || ''}`)
);
const newOnes = [];
for (const e of pendingEntries) {
  const k = `${e.artifact}|${e.rule}|${e.triggered_by}`;
  if (seenKeys.has(k)) continue;
  seenKeys.add(k);
  newOnes.push(e);
}
existing.push(...newOnes);

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
  //
  // v1.1 (DEC-DEV-0023): forward-driven cascade. For each forward ref в saved
  // frontmatter, look up the target dependent file by ID and queue только его.
  // Replaces v1's "include all candidates of dependent type" pattern, which
  // generated false-positive V-11 entries for unrelated artifacts (e.g., FM-002..N
  // flagged for missing SC reverse refs, even though SC.feature pointed at FM-001).
  //
  // Reverse-driven additional review rules (e.g., LC.rules contains BR → on BR
  // change re-validate LC transitions) deferred to v1.2 — current v1.1 covers
  // the V-11 bi-dir cases that matter most.
  //
  // Returns list of {path, reverseField, reviewRules: [{rule, detail}]} entries.
  const productDir = path.join(projectRoot, '.product');
  const results = [];
  const idStr = fm.id;

  const specs = getForwardSpecs(fm.type, idStr);
  for (const spec of specs) {
    const refs = parseRefValue(fm[spec.fieldName], spec.isScalar);
    for (const refId of refs) {
      const depFile = findArtifactFileById(productDir, spec.depDir, refId);
      if (!depFile) continue;  // Forward ref to non-existent artifact — separate V-* concern
      results.push({
        path: depFile,
        reverseField: spec.depReverseField,
        reviewRules: spec.additionalRules || [],
      });
    }
  }

  return results;
}

/**
 * Forward-ref topology per artifact type.
 * Each entry: which field on saved (`fieldName`) points at which dependent dir
 * (`depDir`) and what reverse field on dep (`depReverseField`) should mirror it.
 *
 * isScalar=true treats fm[fieldName] as a single id; false treats as YAML list.
 *
 * additionalRules: extra review entries to queue alongside V-11 (semantic checks
 * that humans should re-verify after the change cascades — e.g., LC mermaid
 * diagram still reachable after SC step rewrite).
 */
function getForwardSpecs(type, sourceId) {
  switch (type) {
    case 'scenario':
      return [
        { fieldName: 'rules',        depDir: 'business-rules', depReverseField: 'scenarios', isScalar: false },
        { fieldName: 'lifecycle',    depDir: 'lifecycles',     depReverseField: 'scenarios', isScalar: false,
          additionalRules: [{ rule: 'V-06', detail: `LC may need re-validation: SC ${sourceId} steps changed` }] },
        { fieldName: 'verification', depDir: 'verification',   depReverseField: 'scenario',  isScalar: false,
          additionalRules: [{ rule: 'V-07', detail: `VC coverage check: SC ${sourceId} flow changed` }] },
        { fieldName: 'feature',      depDir: 'features',       depReverseField: 'scenarios', isScalar: true },
      ];
    case 'business-rule':
      return [
        { fieldName: 'scenarios', depDir: 'scenarios', depReverseField: 'rules', isScalar: false },
        { fieldName: 'feature',   depDir: 'features',  depReverseField: 'rules', isScalar: true },
      ];
    case 'lifecycle':
      return [
        { fieldName: 'scenarios', depDir: 'scenarios', depReverseField: 'lifecycle',  isScalar: false },
        { fieldName: 'feature',   depDir: 'features',  depReverseField: 'lifecycles', isScalar: true },
      ];
    case 'invariant-check':
      return [
        { fieldName: 'feature', depDir: 'features', depReverseField: 'invariants', isScalar: true },
      ];
    case 'verification-criteria':
      return [
        { fieldName: 'scenario', depDir: 'scenarios', depReverseField: 'verification', isScalar: true },
        { fieldName: 'feature',  depDir: 'features',  depReverseField: 'verification', isScalar: true },
      ];
    case 'feature-map-entry':
      // FM changes — minimal cascade in v1; status alignment with embedded artifacts
      // covered by individual artifact saves.
      return [];
    default:
      // Other types (PS, MR, CA, SEG, VP, HYP, MVP, RM, RL, BG, RPM, NFR, MK, DS, NM, NOTE)
      // Cascade impact per processes.md §4.1, but less common in P2 enrichment.
      return [];
  }
}

function parseRefValue(value, isScalar) {
  if (value === undefined || value === null || value === '') return [];
  if (isScalar) {
    const s = String(value).trim();
    if (!s || s === '[]') return [];
    return [s];
  }
  return parseListField(value);
}

function findArtifactFileById(productDir, subdir, id) {
  const dir = path.join(productDir, subdir);
  if (!fs.existsSync(dir)) return null;
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch (e) {
    return null;
  }
  // Convention per docs/pmo/artifacts/README.md: filename starts with `<id>-<slug>.md`
  // OR exact `<id>.md`. Match both via prefix `^<id>[-.]`.
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}[-.]`);
  for (const f of files) {
    if (re.test(f)) return path.join(dir, f);
  }
  return null;
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
