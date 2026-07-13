#!/usr/bin/env node
/**
 * artifact-validate.js — PostToolUse hook for .product/ artifact validation.
 *
 * v1 modifications:
 *   B1 — tier-aware (pilot: only 🔴 Blocking inline; mvp: + 🟡 Warning; full: all)
 *   B2 — quiet draft mode (findings queued when status=draft, surfaced on approve)
 *   D2 — per-artifact overrides (validation_overrides + approve_overrides + expires_at)
 *        Phase 3.F extension per DEC-DEV-0012 C.5 + DEC-DEV-0013
 *
 * Reads stdin (Claude Code hook JSON), parses artifact frontmatter (+ D2 override
 * sections), applies applicable V-* rules per tier filtered by overrides, writes
 * findings (stderr or queue file).
 *
 * D2 override semantics (per validation.md §9.3-9.4):
 *   - validation_overrides[]: permanent severity downgrade for this artifact (rule
 *     skipped в this hook; logged со status: overridden in queue)
 *   - approve_overrides[]: temporary gate pass with optional expires_at; if expired,
 *     re-applies rule; if active, skipped с status: overridden + approval metadata
 *
 * Exit 0 always — non-blocking.
 *
 * Scope v1: V-01, V-03, V-04, V-09, V-10, V-11 (basic, automatable) + V-18 (per-type
 *   frontmatter schema conformance for IC/BR/SC — DEC-DEV-0064; extended to NFR per
 *   DEF-CTX-1).
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

// ---------- Parse D2 overrides (Phase 3.F per DEC-DEV-0012 C.5) ----------

const validationOverrides = parseOverridesSection(content, 'validation_overrides');
const approveOverrides = parseOverridesSection(content, 'approve_overrides');

// Build override sets for fast lookup
const overrideMap = buildOverrideMap(validationOverrides, approveOverrides);

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

// V-18: per-type frontmatter schema conformance (DEC-DEV-0064, from Session Audit
// cluster D2B-behavioral::A). Warning-level + override-aware (rule 'V-18' in
// overrideMap is skipped like any other) + tier-aware (surfaces at mvp/full, queued
// at pilot). Scoped to IC / BR / SC / NFR — the types with confirmed canonical enums
// and the highest observed drift — to keep false-positives low; other types deferred.
// Canonical source of truth: docs/pmo/artifacts/<TYPE>.md.
//
// ⚠ BOUNDARY WITH C2 (see :180) — do not "helpfully" add a confidence-PRESENCE check
// here. C2 is NOT type-scoped: it already flags any `status: active` artifact missing
// `confidence`, for every type including NFR. It merely stays invisible at the default
// `pilot` tier (tierAllowsSeverity lets only 'blocking' through) and fires at mvp/full.
// V-18 validates the VALUE of confidence and the conditional confidence_notes — never
// its presence. Checking presence in both = double-report on one defect (DEF-CTX-1,
// whose own write-up wrongly claimed NFR passes validation without `confidence`).
{
  const idPrefix = (String(fm.id).match(/^([A-Z]+)-/) || [])[1];
  const LIFECYCLE = ['draft', 'active', 'deprecated']; // common status enum (README.md)
  const v18 = (message) => findings.push({ rule: 'V-18', severity: 'warning', message });

  if (idPrefix === 'IC') {
    if (fm.type && fm.type !== 'invariant-check') {
      v18(`IC ${fm.id} type='${fm.type}' should be 'invariant-check' (IC.md)`);
    }
    if (fm.severity && !['critical', 'high', 'medium'].includes(fm.severity)) {
      v18(`IC ${fm.id} severity='${fm.severity}' off canonical enum (critical|high|medium) (IC.md)`);
    }
    if (fm.status && !LIFECYCLE.includes(fm.status)) {
      v18(`IC ${fm.id} status='${fm.status}' off canonical enum (draft|active|deprecated)`);
    }
    if (fm.status === 'active') {
      for (const req of ['severity', 'entity', 'testable_as']) {
        if (!fm[req]) v18(`IC ${fm.id} active but missing required per-type field '${req}' (IC.md)`);
      }
    }
  } else if (idPrefix === 'BR') {
    if (fm.type && fm.type !== 'business-rule') {
      v18(`BR ${fm.id} type='${fm.type}' should be 'business-rule' (BR.md)`);
    }
    if (fm.category && !['validation', 'calculation', 'authorization', 'workflow', 'constraint', 'state-transition'].includes(fm.category)) {
      v18(`BR ${fm.id} category='${fm.category}' off canonical enum (validation|calculation|authorization|workflow|constraint|state-transition) (BR.md)`);
    }
    if (fm.status && !LIFECYCLE.includes(fm.status)) {
      v18(`BR ${fm.id} status='${fm.status}' off canonical enum (draft|active|deprecated)`);
    }
  } else if (idPrefix === 'SC') {
    if (fm.status && !LIFECYCLE.includes(fm.status)) {
      v18(`SC ${fm.id} status='${fm.status}' off canonical enum (draft|active|deprecated)`);
    }
  } else if (idPrefix === 'NFR') {
    // NFR — DEF-CTX-1. Canon: docs/pmo/artifacts/NFR.md §Frontmatter Schema.
    // `sanity_check: failed` is a DEAD state (DEC-DEV-0025 C.2 + Ambiguity 9): runtime
    // knows only passed|overridden. An out-of-range target is an *override*, not a
    // failure — so `failed` gets a targeted migration hint rather than a bare enum gripe.
    const SANITY = ['passed', 'overridden'];
    const CONFIDENCE = ['high', 'medium', 'low'];

    if (fm.type && fm.type !== 'non-functional-requirement') {
      v18(`NFR ${fm.id} type='${fm.type}' should be 'non-functional-requirement' (NFR.md)`);
    }
    if (fm.status && !LIFECYCLE.includes(fm.status)) {
      v18(`NFR ${fm.id} status='${fm.status}' off canonical enum (draft|active|deprecated)`);
    }
    if (fm.sanity_check && !SANITY.includes(fm.sanity_check)) {
      const hint = fm.sanity_check === 'failed'
        ? " — 'failed' is deprecated: treat as 'overridden' + backfill override_rationale"
        : '';
      v18(`NFR ${fm.id} sanity_check='${fm.sanity_check}' off canonical enum (passed|overridden) (NFR.md)${hint}`);
    }
    if (fm.sanity_check === 'overridden' && !fm.override_rationale) {
      v18(`NFR ${fm.id} sanity_check='overridden' but 'override_rationale' is missing/empty (NFR.md)`);
    }
    if (fm.confidence && !CONFIDENCE.includes(fm.confidence)) {
      v18(`NFR ${fm.id} confidence='${fm.confidence}' off canonical enum (high|medium|low)`);
    }
    // Conditional-required. Gated on a VALID non-high value so that a typo'd confidence
    // reports once (the enum check above) instead of twice.
    if (['medium', 'low'].includes(fm.confidence) && !fm.confidence_notes) {
      v18(`NFR ${fm.id} confidence='${fm.confidence}' (!= high) but 'confidence_notes' is missing (NFR.md)`);
    }
  }
}

// ---------- Filter by tier (B1 modification) + D2 overrides ----------

const tierAllowsSeverity = (severity) => {
  if (tier === 'pilot') return severity === 'blocking';
  if (tier === 'mvp') return ['blocking', 'warning'].includes(severity);
  if (tier === 'full') return true;
  return severity === 'blocking'; // fallback
};

// Phase 3.F: separate findings into «overridden» (logged со status: overridden
// в pending queue) и «to surface» (normal flow). Per DEC-DEV-0012 C.5.
const overriddenFindings = [];
const toSurface = findings.filter((f) => {
  if (!tierAllowsSeverity(f.severity)) return false;
  const override = overrideMap.get(f.rule);
  if (override) {
    overriddenFindings.push({ ...f, override });
    return false; // skip surfacing
  }
  return true;
});

// ---------- Auto-purge prior pending entries for this artifact (DEC-DEV-0023) ----------

// На каждом save этот validation pass = authoritative state для fm.id. Stale
// entries from earlier saves (где правило падало) clear-ятся automatically when
// it now passes. Without this, fixed issues remain в validation-pending.yaml
// indefinitely (observed Phase 3 smoke test: FM-006 missing-jtbd entry оставалась
// после option-B fix).
purgeValidationPendingFor(projectRoot, fm.id);

// ---------- Queue overridden findings always (Phase 3.F audit log) ----------

// Per DEC-DEV-0012 C.5 — overridden rules logged regardless of quiet mode for
// audit trail. Different from B2 quiet-draft mode (which queues pending findings
// only on draft). Override entries logged on every save с status: overridden.

if (overriddenFindings.length > 0) {
  queueValidationFindings(projectRoot, filePath, fm.id, overriddenFindings, 'overridden');
}

// ---------- Quiet mode (B2 modification) ----------

if (fm.status === 'draft' && quietDraft) {
  // Queue surface findings, don't write to stderr
  if (toSurface.length > 0) {
    queueValidationFindings(projectRoot, filePath, fm.id, toSurface, 'pending');
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
  const lines = ['# Pending validation findings (B2 quiet draft mode + D2 overrides)',
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

// ---------- D2 Overrides parsing (Phase 3.F per DEC-DEV-0012 C.5) ----------

/**
 * Parse a list-of-objects override section from frontmatter YAML.
 * Handles both `validation_overrides:` (per validation.md §9.3) and
 * `approve_overrides:` (per validation.md §9.4) sections.
 *
 * Accepts standard YAML list format inside the frontmatter block:
 *   <sectionName>:
 *     - rule: V-XX
 *       reason: "..."
 *       approved: true                    # validation_overrides
 *       approved_by: human                # approve_overrides
 *       approved_at: 2026-04-18T15:30
 *       expires_at: 2026-05-18            # optional, approve_overrides only
 *
 * Returns array of objects (possibly empty).
 */
function parseOverridesSection(text, sectionName) {
  // Find the frontmatter block
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!fmMatch) return [];
  const fmBody = fmMatch[1];

  // Find the section header line (e.g., "validation_overrides:" at start of a line)
  const sectionRe = new RegExp(`^${sectionName}\\s*:\\s*$`, 'm');
  const sectionMatch = sectionRe.exec(fmBody);
  if (!sectionMatch) return [];

  // Extract lines after section header until next non-indented key or end of frontmatter
  const startIdx = sectionMatch.index + sectionMatch[0].length;
  const remaining = fmBody.slice(startIdx);
  const lines = remaining.split(/\r?\n/);

  const overrides = [];
  let current = null;

  for (const line of lines) {
    if (/^\s*$/.test(line)) continue;
    // New top-level key (no leading whitespace beyond comment) — end of section
    if (/^[a-zA-Z_]/.test(line)) break;

    // List item start: `  - rule: V-XX`
    const listStart = /^\s*-\s+([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (listStart) {
      if (current) overrides.push(current);
      current = {};
      let val = listStart[2].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
      current[listStart[1]] = parseScalar(val);
      continue;
    }

    // Continuation key inside current item: `    field: value`
    const contKey = /^\s+([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (contKey && current) {
      let val = contKey[2].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
      current[contKey[1]] = parseScalar(val);
      continue;
    }
  }
  if (current) overrides.push(current);

  return overrides;
}

function parseScalar(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~' || val === '') return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  return val;
}

/**
 * Build a Map from rule-id → override object for fast lookup.
 * Per DEC-DEV-0012 C.5: approve_overrides с expires_at < now treat as inactive.
 * validation_overrides всегда active (permanent severity downgrade).
 *
 * If both validation + approve override exist для same rule, validation_overrides
 * wins (more permanent).
 */
function buildOverrideMap(validationOverrides, approveOverrides) {
  const map = new Map();
  const now = Date.now();

  // approve_overrides first (potentially overridden by validation)
  for (const ov of approveOverrides) {
    if (!ov.rule) continue;
    if (ov.expires_at) {
      const expiry = Date.parse(ov.expires_at);
      if (!isNaN(expiry) && expiry < now) {
        // Expired — skip this override (re-apply rule)
        continue;
      }
    }
    map.set(ov.rule, { ...ov, _kind: 'approve' });
  }

  // validation_overrides second (wins if conflict — permanent severity downgrade)
  for (const ov of validationOverrides) {
    if (!ov.rule) continue;
    if (ov.approved !== false) {
      // approved field defaults to true if absent
      map.set(ov.rule, { ...ov, _kind: 'validation' });
    }
  }

  return map;
}

/**
 * Remove all validation-pending entries for the given artifactId.
 * Called at start of each hook run (DEC-DEV-0023) so stale entries from prior
 * saves get cleared when the rule now passes. New findings (if any) re-queued
 * by subsequent queueValidationFindings() call.
 */
function purgeValidationPendingFor(projectRoot, artifactId) {
  const queueFile = path.join(projectRoot, '.product', '.pending', 'validation-pending.yaml');
  if (!fs.existsSync(queueFile)) return;
  try {
    const text = fs.readFileSync(queueFile, 'utf-8');
    const queue = parsePendingYaml(text);
    const filtered = queue.filter((e) => e.artifact !== artifactId);
    if (filtered.length === queue.length) return;  // No matching entries — skip rewrite
    fs.writeFileSync(queueFile, formatPendingYaml(filtered));
  } catch (e) {
    // Silent — keep going; subsequent queue ops still work
  }
}

/**
 * Append finding entries to validation-pending.yaml with given status.
 * status options: 'pending' (B2 quiet draft) | 'overridden' (D2 audit log).
 */
function queueValidationFindings(projectRoot, filePath, artifactId, findings, status) {
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

  const now = new Date().toISOString();
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  findings.forEach((f) => {
    const entry = {
      artifact: artifactId,
      file: relPath,
      rule: f.rule,
      severity: f.severity,
      message: f.message,
      status,
      queued_at: now,
    };
    // For overridden entries — include audit metadata
    if (status === 'overridden' && f.override) {
      entry.override_kind = f.override._kind;
      if (f.override.reason) entry.override_reason = f.override.reason;
      if (f.override.approved_by) entry.override_approved_by = f.override.approved_by;
      if (f.override.approved_at) entry.override_approved_at = f.override.approved_at;
      if (f.override.expires_at) entry.override_expires_at = f.override.expires_at;
    }
    queue.push(entry);
  });

  try {
    fs.writeFileSync(queueFile, formatPendingYaml(queue));
  } catch (e) {
    // Silent fail
  }
}
