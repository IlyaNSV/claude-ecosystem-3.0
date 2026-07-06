'use strict';
/**
 * Syntax smoke for the harness Workflow scripts — orchestrator/processes/*.mjs AND
 * product/processes/*.mjs (the completeness-loop wave-runner, Epic B / B-b, lives in the
 * latter). Both dirs use the same harness Workflow dialect and are scanned identically.
 *
 * The harness Workflow dialect is NOT plain ESM: scripts use `export const meta`
 * (module goal) together with top-level `await` AND top-level `return` (which the
 * harness allows by wrapping the body). `node --check file.mjs` therefore fails with
 * "Illegal return statement" even on a valid Workflow script. This smoke validates the
 * real dialect: strip the single `export ` keyword, wrap the body in an AsyncFunction
 * with the injected globals as parameters, and let the JS engine PARSE it (never
 * execute — so undefined agents / fs-less environment are irrelevant). A SyntaxError
 * fails the smoke; a successful parse passes.
 *
 * Node stdlib only; run with `node tests/orchestrator/workflow-syntax.smoke.cjs`
 * or `npm run smoke:orchestrator`.
 */

const fs = require('node:fs');
const path = require('node:path');

// Every dir that holds harness Workflow scripts. existsSync-guarded below so a dir that
// hasn't been created yet (e.g. product/processes/ before the wave-runner lands) is simply
// skipped, not a failure.
const PROC_DIRS = [
  path.join(__dirname, '..', '..', 'orchestrator', 'processes'),
  path.join(__dirname, '..', '..', 'product', 'processes'),
].filter((d) => fs.existsSync(d));

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// globals the harness injects into a Workflow script
const INJECTED = ['agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow'];

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}

function parseWorkflow(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!/^\s*export\s+const\s+meta\s*=/.test(raw)) {
    throw new Error('missing `export const meta = {...}` header');
  }
  // strip ONLY the leading `export ` of the meta declaration; the rest is the body.
  const body = raw.replace(/^\s*export\s+const\s+meta/, 'const meta');
  // parse (do not execute) as an async function body with injected globals in scope.
  // new AsyncFunction throws SyntaxError on a parse failure — exactly what we want.
  // eslint-disable-next-line no-new
  new AsyncFunction(...INJECTED, body);
}

console.log('Workflow syntax smoke (harness dialect)');

// { dir, file } pairs across every scanned PROC_DIRS entry, so output/assertions can name
// which dir a script came from (orchestrator/processes vs product/processes).
const entries = [];
for (const dir of PROC_DIRS) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  for (const f of files) entries.push({ dir, file: f });
}

test('at least one Workflow script present', () => {
  if (!entries.length) throw new Error(`no .mjs under ${PROC_DIRS.join(', ') || '(no scanned dirs exist)'}`);
});

for (const { dir, file } of entries) {
  // Both scanned dirs are named `processes/` (orchestrator/processes, product/processes) —
  // basename(dir) alone would collide, so label with the parent dir too.
  const label = `${path.basename(path.dirname(dir))}/${path.basename(dir)}/${file}`;
  test(`${label} — parses in harness dialect + has meta`, () => {
    parseWorkflow(path.join(dir, file));
  });
}

// ---- MDP model-pinning gate (VC-118) ---------------------------------------
// The Model Delegation Policy (global CLAUDE.md, §3.3) requires every Workflow agent()
// call to pin its model per-stage: an agent() WITHOUT opts.model inherits the (expensive)
// SESSION model, which is both waste AND a confound for judged/graded stages (a jury must
// hold ONE fixed model across its arms). This gate makes that non-optional: EVERY agent()
// call must carry either `model:` (an explicit per-stage pin) OR `agentType:` (a canonical
// persona whose model is pinned in its agents/**/*.md frontmatter — pinning it again in the
// call would just duplicate the definition). It is placed HERE, in the shared smoke that
// scans BOTH PROC_DIRS, rather than in the per-process wiring tests, because (a) it then
// covers files that have no wiring test (batch-features-to-cc-sdd.mjs) and every FUTURE
// process for free, and (b) it is one check in one place instead of N.
//
// Invariant this relies on (true across every process today, and the style to keep): each
// agent() call passes its opts as a SINGLE-LINE object literal, and `label:` appears ONLY in
// an agent() opts object (never in a schema / workflow() / parallel() opts). So "# of lines
// with `label:`" == "# of agent() calls", and model/agentType live on that same line. A
// future multi-line opts object would trip this — the fix is to keep model/agentType on the
// label line, which also keeps the pin visible at the call site.
for (const { dir, file } of entries) {
  const label = `${path.basename(path.dirname(dir))}/${path.basename(dir)}/${file}`;
  test(`${label} — every agent() call pins model: or agentType: (MDP/VC-118)`, () => {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = src.split(/\r?\n/);
    const unpinned = [];
    lines.forEach((line, i) => {
      if (!/\blabel:/.test(line)) return;                 // not an agent() opts line
      if (/\b(model|agentType):/.test(line)) return;      // pinned (explicit model OR a canonical persona)
      unpinned.push(`L${i + 1}: ${line.trim()}`);
    });
    if (unpinned.length) {
      throw new Error(
        `${unpinned.length} agent() call(s) missing an MDP model pin (add \`model: '…'\` per MDP tier, ` +
        `or \`agentType:\` for a canonical persona):\n        ${unpinned.join('\n        ')}`
      );
    }
  });
}

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
