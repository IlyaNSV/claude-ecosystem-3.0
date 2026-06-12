#!/usr/bin/env node
/**
 * app-map-cascade.js — PostToolUse hook: flag the App Map (AM) for review when its inputs
 * (FM-*, NM-*, SC-*) change and the mechanical layer drifts from the persisted app-map.md.
 * Implements AM.md cascade-impact (DEC-DEV-0066).
 *
 * Pattern: own pending queue + stderr signal (mirrors br-change-trigger.js → da-pending.yaml),
 *   NOT a modification of cascade-check.js core. Reuses scan() from app-map-scan.js (no spawn).
 *
 * Trigger: PostToolUse Write/Edit on .product/{features/FM-*, mockups/NM-*, scenarios/SC-*}.md.
 * Action: if app-map.md exists & active, compare fresh scan vs persisted modules/navigation_maps
 *   (+ SC presence in primary_journeys). On drift → append .product/.pending/app-map-pending.yaml
 *   (rule AM-stale | AM-journey-ref, action needs_review) + stderr "run /design:map --write".
 *
 * Quiet: skips when AM is draft OR the changed artifact is draft (per product.yaml
 *   draft_mode_quiet_hooks, default true) — consistent with cascade-check.js §B2.
 * Known v1 gap: a has_ui flip that changes neither the FM-id set nor NM coverage is not
 *   detected (modules[]/navigation_maps[] unchanged). Add a per-module signature in v1.1.
 * Exit 0 always — non-blocking. Cross-platform path norm per DEC-DEV-0044.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { scan } = require('./app-map-scan.js');

// ---------- hook input ----------
let raw = '';
try { raw = fs.readFileSync(0, 'utf-8'); } catch (e) { process.exit(0); }
let hookInput;
try { hookInput = JSON.parse(raw); } catch (e) { process.exit(0); }
const filePath = hookInput?.tool_input?.file_path;
if (!filePath) process.exit(0);

const normalized = filePath.replace(/\\/g, '/');

// Never self-trigger on the AM artifact itself
if (/\.product\/app-map\.md$/.test(normalized)) process.exit(0);

const isFM = /\.product\/features\/FM-[^/]+\.md$/.test(normalized);
const isNM = /\.product\/mockups\/NM-[^/]+\.md$/.test(normalized);
const isSC = /\.product\/scenarios\/SC-[^/]+\.md$/.test(normalized);
if (!isFM && !isNM && !isSC) process.exit(0);
if (path.basename(normalized).startsWith('.')) process.exit(0);

const projectRoot = findProjectRoot(normalized);
if (!projectRoot) process.exit(0);

const amPath = path.join(projectRoot, '.product', 'app-map.md');
if (!fs.existsSync(amPath)) process.exit(0);

let amContent;
try { amContent = fs.readFileSync(amPath, 'utf-8'); } catch (e) { process.exit(0); }
const amFm = parseFlat(amContent);

const quietDraft = loadQuietDraft(projectRoot);

// Skip when AM itself is draft (already under review)
if ((amFm.status || '').toLowerCase() === 'draft' && quietDraft) process.exit(0);

// Read the changed artifact (id + status) to skip draft sources
let changedFm = {};
try { changedFm = parseFlat(fs.readFileSync(filePath, 'utf-8')); } catch (e) { /* deleted? continue */ }
const changedId = changedFm.id || path.basename(normalized).replace(/-.*$/, '').replace(/\.md$/, '');
if ((changedFm.status || '').toLowerCase() === 'draft' && quietDraft) process.exit(0);

// ---------- detect drift ----------
const s = scan(projectRoot);
const now = new Date().toISOString();
const entries = [];

const currentModules = s.modules.map((m) => m.id).sort();
const amModules = (Array.isArray(amFm.modules) ? amFm.modules.slice() : []).sort();
const currentNav = (s.navigation_maps || []).slice().sort();
const amNav = (Array.isArray(amFm.navigation_maps) ? amFm.navigation_maps.slice() : []).sort();

const modDelta = symDiff(currentModules, amModules);
const navDelta = symDiff(currentNav, amNav);

if ((isFM || isNM) && (modDelta.added.length || modDelta.removed.length || navDelta.added.length || navDelta.removed.length)) {
  const bits = [];
  if (modDelta.added.length) bits.push('+modules ' + modDelta.added.join(','));
  if (modDelta.removed.length) bits.push('-modules ' + modDelta.removed.join(','));
  if (navDelta.added.length) bits.push('+NM ' + navDelta.added.join(','));
  if (navDelta.removed.length) bits.push('-NM ' + navDelta.removed.join(','));
  entries.push({
    artifact: 'AM',
    rule: 'AM-stale',
    triggered_by: changedId,
    action: 'needs_review',
    detail: 'Mechanical layer drift: ' + bits.join('; ') + ' — re-run /design:map --write',
    at: now,
  });
}

// SC: only relevant if referenced by a primary journey AND now deprecated/gone
if (isSC && amContent.includes(changedId)) {
  const st = (changedFm.status || '').toLowerCase();
  if (st === 'deprecated' || st === '') {
    entries.push({
      artifact: 'AM',
      rule: 'AM-journey-ref',
      triggered_by: changedId,
      action: 'needs_review',
      detail: `primary_journeys ссылается на ${changedId} (status: ${changedFm.status || 'missing'}) — проверить app-map.md §3`,
      at: now,
    });
  }
}

if (entries.length === 0) process.exit(0);

// ---------- append to own pending queue (dedup by rule|triggered_by) ----------
const pendingDir = path.join(projectRoot, '.product', '.pending');
try { if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true }); } catch (e) { process.exit(0); }
const queueFile = path.join(pendingDir, 'app-map-pending.yaml');

let existing = [];
if (fs.existsSync(queueFile)) {
  try { existing = parseEntries(fs.readFileSync(queueFile, 'utf-8')); } catch (e) { existing = []; }
}
const key = (e) => `${e.rule}|${e.triggered_by}`;
const merged = existing.filter((e) => !entries.some((n) => key(n) === key(e)));
merged.push(...entries);

try { fs.writeFileSync(queueFile, formatEntries(merged)); } catch (e) { /* silent */ }

// ---------- stderr signal ----------
process.stderr.write(
  `App Map (AM) может быть stale (${entries.length}): ` +
  entries.map((e) => `${e.rule}←${e.triggered_by}`).join(', ') + '\n' +
  `  Re-run /design:map --write; see .product/.pending/app-map-pending.yaml\n`
);
process.exit(0);

// ---------- helpers ----------
function findProjectRoot(fp) {
  let dir = path.dirname(path.resolve(fp));
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.claude')) && fs.existsSync(path.join(dir, '.product'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function loadQuietDraft(root) {
  const cfg = path.join(root, '.claude', 'product.yaml');
  if (!fs.existsSync(cfg)) return true;
  try {
    const m = /^draft_mode_quiet_hooks:\s*(true|false)/m.exec(fs.readFileSync(cfg, 'utf-8'));
    return m ? m[1] === 'true' : true;
  } catch (e) { return true; }
}

function parseFlat(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return {};
  const o = {};
  m[1].split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    let v = kv[2].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    o[kv[1]] = v;
  });
  return o;
}

function symDiff(current, persisted) {
  const cs = new Set(current), ps = new Set(persisted);
  return {
    added: current.filter((x) => !ps.has(x)),     // present now, not in AM
    removed: persisted.filter((x) => !cs.has(x)),  // in AM, gone now
  };
}

function parseEntries(text) {
  const items = [];
  const mm = /^entries:\s*$([\s\S]*)/m.exec(text);
  if (!mm) return items;
  mm[1].split(/^\s{2}-\s+/m).slice(1).forEach((block) => {
    const item = {};
    block.split(/\r?\n/).forEach((line) => {
      const kv = /^\s*([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
      if (kv) item[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    });
    if (Object.keys(item).length) items.push(item);
  });
  return items;
}

function formatEntries(entries) {
  const lines = [
    '# App Map (AM) cascade-pending — managed by app-map-cascade.js',
    '# AM-stale: mechanical layer drift (FM/NM set changed) → re-run /design:map --write',
    '# AM-journey-ref: primary_journeys SC deprecated/missing → verify app-map.md §3',
    '',
    'entries:',
  ];
  entries.forEach((e) => {
    lines.push(`  - artifact: ${fmtScalar(e.artifact)}`);
    lines.push(`    rule: ${fmtScalar(e.rule)}`);
    lines.push(`    triggered_by: ${fmtScalar(e.triggered_by)}`);
    lines.push(`    action: ${fmtScalar(e.action)}`);
    lines.push(`    detail: ${fmtScalar(e.detail)}`);
    lines.push(`    at: ${fmtScalar(e.at)}`);
  });
  return lines.join('\n') + '\n';
}

function fmtScalar(v) {
  const s = String(v == null ? '' : v);
  return /[:#"'\n]/.test(s) || /^\s|\s$/.test(s) ? JSON.stringify(s) : s;
}
