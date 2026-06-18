#!/usr/bin/env node
/**
 * cascade-scalar.test.cjs — functional test for the SC↔MK cascade topology.
 *
 * DEC-DEV-0080 (Session Audit cluster D2B-behavioral::D): cascade-check.js now
 * maintains the V-11 reverse ref between mockup-packages and scenarios. The risky
 * part is the SCALAR write-back — SC.mockup is a single id (`mockup: MK-NNN`), not a
 * YAML list, so the list-only injectListField would have written the malformed
 * `mockup: [MK-NNN]`. This test pins the format + the conflict / no-op / list
 * directions that the smoke harness (stderr-only) cannot assert.
 *
 * Run: node tests/product/cascade-scalar.test.cjs   (part of `npm run verify`)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ECO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK = path.join(ECO_ROOT, 'hooks', 'product', 'cascade-check.js');

let pass = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { failures.push(name); console.error(`FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}

// Build a throwaway project root with .claude + .product so findProjectRoot anchors.
function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-scalar-'));
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.mkdirSync(path.join(root, '.product', 'mockups'), { recursive: true });
  fs.mkdirSync(path.join(root, '.product', 'scenarios'), { recursive: true });
  return root;
}

function writeMK(root, id, { status = 'active', scenarios = [] } = {}) {
  const p = path.join(root, '.product', 'mockups', `${id}-pkg.md`);
  fs.writeFileSync(
    p,
    `---\nid: ${id}\ntype: mockup-package\nstatus: ${status}\nfeature: FM-001\n` +
      `scenarios: [${scenarios.join(', ')}]\n---\n\n# ${id}\n`,
    'utf-8'
  );
  return p;
}

function writeSC(root, id, { status = 'active', mockup = undefined } = {}) {
  const p = path.join(root, '.product', 'scenarios', `${id}-flow.md`);
  let fm = `---\nid: ${id}\ntype: scenario\nstatus: ${status}\nrules: []\nlifecycle: []\nverification: []\n`;
  if (mockup !== undefined) fm += `mockup: ${mockup}\n`;
  fm += `---\n\n# ${id}\n`;
  fs.writeFileSync(p, fm, 'utf-8');
  return p;
}

function runHook(savedPath, root) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: savedPath }, cwd: root }),
    encoding: 'utf-8',
    timeout: 10000,
  });
}

function fmLine(file, field) {
  const m = new RegExp(`^${field}\\s*:\\s*(.*)$`, 'm').exec(fs.readFileSync(file, 'utf-8'));
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Case 1 — MK save → SC.mockup set as a SCALAR (the headline fix).
// ---------------------------------------------------------------------------
{
  const root = makeProject();
  const sc = writeSC(root, 'SC-001', {}); // active, no mockup field
  const mk = writeMK(root, 'MK-001', { scenarios: ['SC-001'] });
  const r = runHook(mk, root);
  check('MK→SC: hook exits 0', r.status === 0, `exit=${r.status}`);
  check('MK→SC: cascade signalled auto-fix', /V-11 auto-fixed/.test(r.stderr || ''), r.stderr);
  const val = fmLine(sc, 'mockup');
  check('MK→SC: SC.mockup written as scalar `MK-001`', val === 'MK-001', `got: ${JSON.stringify(val)}`);
  check('MK→SC: SC.mockup is NOT list `[MK-001]`', val !== '[MK-001]', `got: ${JSON.stringify(val)}`);
  fs.rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Case 2 — SC save (with scalar mockup) → MK.scenarios[] gets the SC (list dir).
// ---------------------------------------------------------------------------
{
  const root = makeProject();
  const mk = writeMK(root, 'MK-002', { scenarios: [] }); // active, empty scenarios
  const sc = writeSC(root, 'SC-002', { mockup: 'MK-002' });
  const r = runHook(sc, root);
  check('SC→MK: hook exits 0', r.status === 0, `exit=${r.status}`);
  const val = fmLine(mk, 'scenarios');
  check('SC→MK: MK.scenarios contains SC-002 (list)', val === '[SC-002]', `got: ${JSON.stringify(val)}`);
  fs.rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Case 3 — Scalar conflict: SC already bound to a different MK → NOT overwritten,
//          conflict queued to cascade-pending.yaml.
// ---------------------------------------------------------------------------
{
  const root = makeProject();
  const sc = writeSC(root, 'SC-003', { mockup: 'MK-OTHER' });
  const mk = writeMK(root, 'MK-003', { scenarios: ['SC-003'] });
  const r = runHook(mk, root);
  check('conflict: hook exits 0', r.status === 0, `exit=${r.status}`);
  const val = fmLine(sc, 'mockup');
  check('conflict: existing SC.mockup left intact (MK-OTHER)', val === 'MK-OTHER', `got: ${JSON.stringify(val)}`);
  const pendingPath = path.join(root, '.product', '.pending', 'cascade-pending.yaml');
  const pending = fs.existsSync(pendingPath) ? fs.readFileSync(pendingPath, 'utf-8') : '';
  check('conflict: needs_manual_fix queued', /needs_manual_fix/.test(pending) && /scalar reverse conflict/.test(pending), pending.slice(0, 300));
  fs.rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Case 4 — No-op: SC already carries the correct scalar reverse → no rewrite, no entry.
// ---------------------------------------------------------------------------
{
  const root = makeProject();
  const sc = writeSC(root, 'SC-004', { mockup: 'MK-004' });
  const before = fs.readFileSync(sc, 'utf-8');
  const mk = writeMK(root, 'MK-004', { scenarios: ['SC-004'] });
  const r = runHook(mk, root);
  check('no-op: hook exits 0', r.status === 0, `exit=${r.status}`);
  check('no-op: SC file unchanged', fs.readFileSync(sc, 'utf-8') === before);
  check('no-op: no auto-fix signalled', !/V-11 auto-fixed/.test(r.stderr || ''), r.stderr);
  fs.rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Case 5 — Draft SC target → no scalar write (quiet-draft), queued manual fix.
// ---------------------------------------------------------------------------
{
  const root = makeProject();
  const sc = writeSC(root, 'SC-005', { status: 'draft' }); // draft, no mockup
  const mk = writeMK(root, 'MK-005', { scenarios: ['SC-005'] });
  const r = runHook(mk, root);
  check('draft: hook exits 0', r.status === 0, `exit=${r.status}`);
  check('draft: SC.mockup NOT written (quiet-draft)', fmLine(sc, 'mockup') === null, fmLine(sc, 'mockup'));
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`\nTotal: ${pass} assertion(s) passed; ${failures.length} failure(s).`);
process.exit(failures.length > 0 ? 1 : 0);
