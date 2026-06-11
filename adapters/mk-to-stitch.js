#!/usr/bin/env node
/**
 * mk-to-stitch.js — reference adapter: Design Module MK (mockup-package)
 * → Google Stitch MCP (screen/design-system generation).
 *
 * Tri-location pattern (DEC-DEV-0040 Q1):
 *   - This file (repo `adapters/mk-to-stitch.js`) is the canonical source.
 *   - At /integrator:add stitch, this file is copied to
 *     <project>/.claude/integrator/adapters/mk-to-stitch.js and the
 *     metadata block below is populated with concrete values.
 *
 * Adapter metadata (filled in installed instance, not in repo reference):
 *   @contract: CNT-002
 *   @producer: design-module
 *   @consumer: stitch
 *   @target_tool: stitch
 *   @target_tool_version: <populated at install; "hosted" for Stitch MCP>
 *   @contract_schema_version: 1                  // bumped when output shape changes
 *   @source_ref: <git-commit-hash>               // populated from repo HEAD at install
 *   @installed_at: <ISO-8601>                    // populated at install time
 *   @stitch_endpoint: https://stitch.googleapis.com/mcp
 *   @env_var: STITCH_ACCESS_TOKEN (Bearer) + STITCH_QUOTA_PROJECT (X-Goog-User-Project)
 *
 * Modes:
 *   --verify-only --fixture <MK.md> [--phase D.2]
 *       Dry-run: parse MK frontmatter + sections, validate contract C-01..C-09,
 *       emit planned Stitch MCP calls. No live MCP invocation.
 *   --live   Reserved for Orchestrator scope (out of Phase 5; exits 3).
 *
 * Exit codes: 0=ok, 1=schema fail, 2=adapter/IO error, 3=live-mode error.
 *
 * Design constraints: Node stdlib only; cross-platform LF-normalized I/O.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const CONTRACT_SCHEMA_VERSION = 1;
const SUPPORTED_MK_TYPES = ['mockup-package'];
const SUPPORTED_MK_STATUSES = ['draft', 'review', 'active'];
const PHASE_TOOL_MAP = {
  'D.1': ['list_projects', 'create_project', 'upload_design_md'],
  'D.2': ['create_project', 'upload_design_md', 'create_design_system_from_design_md', 'generate_screen_from_text'],
  'D.3': ['list_screens', 'get_screen', 'edit_screens', 'generate_variants'],
  'D.4': ['list_screens', 'get_screen', 'generate_variants'],
  'D.5': ['list_design_systems', 'create_design_system', 'update_design_system', 'apply_design_system'],
  'D.6': ['get_project', 'list_screens', 'get_screen', 'list_design_systems'],
};
function normalizeLF(s) {
  return s.split('\r\n').join('\n').split('\r').join('\n');
}

function parseFrontmatter(raw) {
  const normalized = normalizeLF(raw);
  const m = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) throw new Error('PARSE_ERROR: no leading frontmatter block');
  const lines = m[1].split('\n');
  const out = {}; let topKey = null, mode = null, pendingMapItem = null;
  const isQ = (c) => c === '"' || c === "'";
  const stripQ = (v) => { const t = v.trim(); if (t.length >= 2 && isQ(t[0]) && t[0] === t[t.length-1]) return t.slice(1,-1); return t; };
  const parseIL = (v) => { const inner = v.trim().slice(1,-1).trim(); if (!inner) return []; return inner.split(',').map((s) => stripQ(s.trim())); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const top = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (top) {
      if (pendingMapItem !== null && mode === 'list-of-maps') { out[topKey].push(pendingMapItem); pendingMapItem = null; }
      topKey = top[1]; const v = top[2];
      if (v === '' || v === 'null' || v === '~') { out[topKey] = null; mode = 'pending'; }
      else if (v === '[]') { out[topKey] = []; mode = 'scalar'; }
      else if (v.startsWith('[') && v.endsWith(']')) { out[topKey] = parseIL(v); mode = 'scalar'; }
      else { out[topKey] = stripQ(v); mode = 'scalar'; }
      continue;
    }
    const il = line.match(/^  - (.*)$/); const i2 = !il && line.match(/^  ([^\s-].*)$/); const i4 = line.match(/^    ([^\s-].*)$/);
    if (il) {
      const item = il[1]; const kv = item.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
      if (kv) { if (mode !== 'list-of-maps') { if (pendingMapItem !== null && Array.isArray(out[topKey])) out[topKey].push(pendingMapItem); out[topKey] = []; mode = 'list-of-maps'; } else if (pendingMapItem !== null) { out[topKey].push(pendingMapItem); } pendingMapItem = {}; pendingMapItem[kv[1]] = stripQ(kv[2]); }
      else { if (mode !== 'list') { out[topKey] = []; mode = 'list'; } out[topKey].push(stripQ(item)); }
      continue;
    }
    if (i4 && mode === 'list-of-maps' && pendingMapItem !== null) { const kv = i4[1].match(/^([a-zA-Z_][\w-]*):\s*(.*)$/); if (kv) { pendingMapItem[kv[1]] = stripQ(kv[2]); continue; } }
    if (i2) { const kv = i2[1].match(/^([a-zA-Z_][\w-]*):\s*(.*)$/); if (kv) { if (mode !== 'map') { out[topKey] = {}; mode = 'map'; } const sv = kv[2]; out[topKey][kv[1]] = (sv.startsWith('[') && sv.endsWith(']')) ? parseIL(sv) : stripQ(sv); continue; } }
  }
  if (pendingMapItem !== null && mode === 'list-of-maps') out[topKey].push(pendingMapItem);
  return out;
}

function extractSections(rawBody) {
  const body = normalizeLF(rawBody); const out = new Map(); const lines = body.split('\n'); let cn = null, ct = null, buf = [];
  const flush = () => { if (cn !== null) out.set(cn, { title: ct, content: buf.join('\n').trim() }); buf = []; };
  for (const line of lines) { const h = line.match(/^##\s+(\d+)\.\s+(.+)$/); if (h) { flush(); cn = parseInt(h[1],10); ct = h[2].trim(); } else if (cn !== null) buf.push(line); }
  flush(); return out;
}

function stripFrontmatter(raw) {
  const n = normalizeLF(raw); const m = n.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : n;
}

function validateContract(fm, sections) {
  const ch = (id, level, pass, detail) => pass ? { id, level, status: 'pass' } : { id, level, status: 'fail', detail };
  const checks = [
    ch('C-01','blocking',!!(fm.id && /^MK-/.test(fm.id)),'id must match MK-NNN, got: '+JSON.stringify(fm.id)),
    ch('C-02','blocking',SUPPORTED_MK_TYPES.includes(fm.type),'type must be mockup-package, got: '+JSON.stringify(fm.type)),
    ch('C-03','blocking',SUPPORTED_MK_STATUSES.includes(fm.status),'status must be draft|review|active, got: '+JSON.stringify(fm.status)),
    ch('C-04','blocking',!!(fm.feature && /^FM-/.test(fm.feature)),'feature must be FM-NNN, got: '+JSON.stringify(fm.feature)),
    ch('C-05','blocking',fm.design_tool==='stitch','design_tool must be stitch for CNT-002; got: '+JSON.stringify(fm.design_tool)+'. Use /design:migrate.'),
    ch('C-06','blocking',!!(fm.platform && typeof fm.platform==='string' && fm.platform.length>0),'platform required (web|mobile|responsive|desktop)'),
  ];
  const miss = [1,2,3].filter((n) => !sections.has(n));
  checks.push(ch('C-07','blocking',miss.length===0,'missing MK sections: '+miss.join(', ')+' (need: 1=Screen Inventory, 2=Component States, 3=Interaction Spec)'));
  const hasS = Array.isArray(fm.scenarios) && fm.scenarios.length>0;
  checks.push(ch('C-08','warning',hasS,'scenarios empty'));
  const hasConf = !!(fm.confidence && ['high','medium','low'].includes(fm.confidence));
  checks.push(ch('C-09','warning',hasConf,'confidence must be high|medium|low (C2)'));
  return { passed: checks.filter((x) => x.level==='blocking' && x.status==='fail').length===0, checks };
}

function deriveProjectName(fm, ov) {
  if (ov) return ov;
  if (fm.tool_project_url) { const m = fm.tool_project_url.match(/\/project\/([^/?#]+)/); if (m) return m[1].toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,48); }
  if (fm.title) return fm.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48);
  return fm.id ? fm.id.toLowerCase() : 'mk-project';
}

function extractScreenInventory(sections) {
  const sec1 = sections.get(1); if (!sec1) return []; const screens = [];
  for (const line of sec1.content.split('\n')) {
    const cols = line.split('|').map((x) => x.trim()).filter(Boolean);
    if (cols.length>=4 && cols[0]!=='Screen ID' && !/^-+$/.test(cols[0])) screens.push({ screen_id: cols[0], title: cols[1]||'', type: cols[2]||'screen', sc_step: cols[3]||'', purpose: cols[4]||'' });
  }
  return screens;
}

function buildDesignMd(fm) {
  return ['# Design Spec for '+(fm.title||fm.id),'','Platform: '+(fm.platform||'responsive'),'Feature: '+(fm.feature||'unknown'),'','## Brand Direction','Style: clean, minimal, professional','Tone: approachable, not corporate','','## Accessibility','Standard: WCAG AA','Minimum contrast ratio: 4.5:1','Touch targets: minimum 44x44px'].join('\n');
}

function buildMinimalTheme() {
  return { font: 'Inter', components: { button: { rounded: 'medium', padding: 'comfortable' }, input: { rounded: 'small' } }, _note: 'Minimal stub. Orchestrator populates from .claude/design.yaml at runtime.' };
}

function buildPlannedCalls(fm, sections, phase, projectName) {
  const tools = PHASE_TOOL_MAP[phase] || []; const screens = extractScreenInventory(sections);
  const sec3 = sections.get(3); const intSum = sec3 ? sec3.content.trim().slice(0,300) : ''; const calls = [];
  for (const t of tools) {
    switch (t) {
      case 'create_project': calls.push({ tool: t, args: { title: (fm.title||fm.id)+' -- '+(fm.platform||'responsive') }, rationale: 'Create Stitch project; project_name cached in MK tool_project_url for idempotency.' }); break;
      case 'get_project': calls.push({ tool: t, args: { project_name: projectName }, rationale: 'Verify project exists before screen operations.' }); break;
      case 'list_projects': calls.push({ tool: t, args: {}, rationale: 'Check for existing project before create (idempotency).' }); break;
      case 'generate_screen_from_text': for (const s of screens) calls.push({ tool: t, args: { project_name: projectName, prompt: 'Screen: '+s.title+' ('+s.type+'). Platform: '+(fm.platform||'responsive')+'. SC: '+s.sc_step+'. Purpose: '+s.purpose+'. Roles: '+(Array.isArray(fm.roles)?fm.roles.join(', '):(fm.roles||'user')) }, rationale: 'D.2 -- generate '+s.screen_id+': '+s.title }); break;
      case 'edit_screens': calls.push({ tool: t, args: { project_name: projectName, screen_ids: screens.map((s) => s.screen_id), prompt: 'Apply iteration '+((parseInt(fm.iteration,10)||1)+1)+' refinements. Interaction spec: '+intSum }, rationale: 'D.3 iterative refinement.' }); break;
      case 'generate_variants': calls.push({ tool: t, args: { project_name: projectName, screen_ids: screens.slice(0,2).map((s) => s.screen_id), prompt: 'Generate component state variants (error, disabled, loading, empty) per MK section 2.' }, rationale: 'D.3/D.4 -- state variants for Component State Matrix.' }); break;
      case 'list_screens': calls.push({ tool: t, args: { project_name: projectName }, rationale: 'Enumerate screens to confirm generation or check before edit/apply.' }); break;
      case 'get_screen': if (screens.length>0) calls.push({ tool: t, args: { project_name: projectName, screen_id: screens[0].screen_id }, rationale: 'Retrieve screen metadata -- D.4/D.5 sync.' }); break;
      case 'upload_design_md': calls.push({ tool: t, args: { project_name: projectName, design_md: buildDesignMd(fm) }, rationale: 'Upload brand hints as DESIGN.md for brand-consistent generation.' }); break;
      case 'create_design_system': calls.push({ tool: t, args: { project_name: projectName, theme: buildMinimalTheme() }, rationale: 'D.5 -- create Stitch design system.' }); break;
      case 'create_design_system_from_design_md': calls.push({ tool: t, args: { project_name: projectName, design_md: buildDesignMd(fm) }, rationale: 'D.2 -- derive Stitch design system from DESIGN.md.' }); break;
      case 'update_design_system': calls.push({ tool: t, args: { project_name: projectName, design_system_id: '<stitch-ds-id>', theme: buildMinimalTheme() }, rationale: 'D.5 -- update Stitch design system.' }); break;
      case 'list_design_systems': calls.push({ tool: t, args: { project_name: projectName }, rationale: 'Enumerate design systems before create/update (idempotency).' }); break;
      case 'apply_design_system': calls.push({ tool: t, args: { project_name: projectName, design_system_id: '<stitch-ds-id>', screen_ids: screens.map((s) => s.screen_id) }, rationale: 'D.5 -- apply design system tokens to all screens.' }); break;
      default: calls.push({ tool: t, args: { project_name: projectName }, rationale: t+' -- see Stitch MCP docs.' }); break;
    }
  }
  return calls;
}

function main() {
  const argv = process.argv;
  const args = { verifyOnly: true, live: false, fixture: null, phase: 'D.2', projectName: null, output: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verify-only') args.verifyOnly = true;
    else if (a === '--live') { args.verifyOnly = false; args.live = true; }
    else if (a === '--fixture') args.fixture = argv[++i];
    else if (a === '--phase') args.phase = argv[++i];
    else if (a === '--project-name') args.projectName = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--help' || a === '-h') { process.stdout.write('mk-to-stitch.js\nUsage: --verify-only --fixture <MK.md> [--phase D.2]\n'); process.exit(0); }
    else if (!args.fixture && !a.startsWith('--')) args.fixture = a;
  }
  if (!args.fixture) { process.stderr.write('ERROR: --fixture required\n'); process.exit(2); }
  if (args.live) { process.stderr.write('ERROR: --live not in Phase 5.\n'); process.exit(3); }
  const vp = Object.keys(PHASE_TOOL_MAP);
  if (!vp.includes(args.phase)) { process.stderr.write('ERROR: unknown phase '+JSON.stringify(args.phase)+'\n'); process.exit(2); }
  let raw; try { raw = fs.readFileSync(args.fixture, 'utf8'); } catch (e) { process.stderr.write('ERROR: '+e.message+'\n'); process.exit(2); }
  let fm, body, sections;
  try { fm = parseFrontmatter(raw); body = stripFrontmatter(raw); sections = extractSections(body); } catch (e) { process.stderr.write('ERROR: '+e.message+'\n'); process.exit(2); }
  const validation = validateContract(fm, sections);
  const projectName = deriveProjectName(fm, args.projectName);
  const plannedCalls = validation.passed ? buildPlannedCalls(fm, sections, args.phase, projectName) : null;
  const output = { mode: 'verify-only', contract_schema_version: CONTRACT_SCHEMA_VERSION, contract_id: 'CNT-002',
    pmo_zone: 'D2-B04', mk_file: path.resolve(args.fixture), phase: args.phase, project_name: projectName,
    contract_validation: validation, planned_calls: plannedCalls,
    metadata: { adapter_version: 'mk-to-stitch.js@csv'+CONTRACT_SCHEMA_VERSION, stitch_endpoint: 'https://stitch.googleapis.com/mcp', stitch_tools_covered: 14, note: '--verify-only: no live calls; planned_calls shows what WOULD execute' } };
  const json = JSON.stringify(output, null, 2); if (args.output) { fs.writeFileSync(args.output, json, 'utf8'); } else { process.stdout.write(json+'\n'); }
  process.exit(validation.passed ? 0 : 1);
}

if (require.main === module) { main(); }
module.exports = { CONTRACT_SCHEMA_VERSION, normalizeLF, parseFrontmatter, extractSections, stripFrontmatter, validateContract, deriveProjectName, extractScreenInventory, buildPlannedCalls, PHASE_TOOL_MAP };
