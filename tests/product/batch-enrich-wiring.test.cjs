'use strict';
/**
 * batch-enrich-feature-set wiring test — Wave (C∥D) / Epic C-i (DEC-DEV-0145 decisions г/д).
 *
 * Static wiring checks over the release-level batch-enrichment runner + its dispatch command, in
 * the consilium-wiring / complete-feature-wiring style: read the sources, assert the load-bearing
 * contracts are PRESENT IN THE TEXT. Behavior is validated live (a pilot run with >=2 planned FMs,
 * separate session); this guards against a refactor silently dropping a rail.
 *
 * Also asserts the harness-dialect constraints the generic smoke enforces (no fs / Date /
 * Math.random / require / import; line-1 export const meta) so a drift is caught here with a
 * targeted message.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RUNNER = path.join(ROOT, 'product', 'processes', 'batch-enrich-feature-set.mjs');
const COMMAND = path.join(ROOT, 'commands', 'product', 'batch-enrich.md');
const COMPLETE = path.join(ROOT, 'product', 'processes', 'complete-feature.mjs');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
  passed += 1;
}

const runner = fs.readFileSync(RUNNER, 'utf-8');
const command = fs.readFileSync(COMMAND, 'utf-8');

// The banned harness tokens (Date.now / Math.random / new Date / require / import) legitimately
// appear in the runner's harness-constraint COMMENT (idiomatic — complete-feature.mjs /
// consilium.mjs do the same). Strip block + line comments before the dialect check so we test
// EXECUTABLE code, not the doc-comment.
// (The authoritative dialect gate is tests/orchestrator/workflow-syntax.smoke.cjs, which parses
// the body; this is a targeted redundant guard.)
const runnerCode = runner
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (naive; avoids http:// via the [^:] guard)

console.log('batch-enrich-feature-set wiring — Wave (C∥D) Epic C-i');

// ---- 1. Meta/dialect ---------------------------------------------------------------------------

test('meta header: line-1 export const meta, name batch-enrich-feature-set, all five phases', () => {
  assert(/^export const meta = \{/.test(runner), 'line-1 export const meta missing (smoke dialect contract)');
  assert(runner.includes("name: 'batch-enrich-feature-set'"), 'meta.name drifted');
  for (const p of ['Plan', 'Enrich', 'Complete', 'Gate', 'Report']) {
    assert(runner.includes(`{ title: '${p}' }`), `meta phase ${p} missing`);
  }
});

test('every phase(\'X\') call title exists in meta.phases', () => {
  const calls = [...runner.matchAll(/phase\('([^']+)'\)/g)].map((m) => m[1]);
  assert(calls.length > 0, 'no phase() calls found in the runner');
  for (const title of calls) {
    assert(runner.includes(`{ title: '${title}' }`), `phase('${title}') has no matching meta.phases entry`);
  }
});

test('harness dialect: no fs / Date / Math.random / require / import in the runner CODE (agents transport all I/O)', () => {
  // Checked against comment-stripped code — the banned tokens are allowed in the doc-comment.
  assert(!/\brequire\s*\(/.test(runnerCode), 'require() crept into the runner (harness has no module loader)');
  assert(!/\bimport\s+/.test(runnerCode), 'an import statement crept into the runner (harness has no module loader)');
  assert(!/Date\.now\s*\(/.test(runnerCode), 'Date.now() is banned in the harness dialect');
  assert(!/new Date\b/.test(runnerCode), 'new Date() is banned in the harness dialect');
  assert(!/Math\.random\s*\(/.test(runnerCode), 'Math.random() is banned in the harness dialect');
  assert(!/\bfs\./.test(runnerCode), 'a direct fs. call crept into the runner (all file I/O must go through an agent())');
});

// ---- 2. B1 explicit-target refusal -------------------------------------------------------------

test('B1: target-less guard refuses (no silent .product/ scan/guess), discovery logged before work', () => {
  assert(runner.includes('!FEATURES_ARG.length && !ALL_PLANNED'), 'target-less guard missing');
  assert(/return refusal\(/.test(runner), 'refusal() return missing from the target-less guard path');
  assert(/refused:\s*true/.test(runner), 'refusal() does not return refused:true');
  // discovery is logged BEFORE the batch loop (before any work).
  const discoveryLogIdx = runner.search(/log\(`--all-planned discovery/);
  const loopIdx = runner.indexOf('for (const FM of FEATURES)');
  assert(discoveryLogIdx !== -1, 'all-planned discovery log missing');
  assert(discoveryLogIdx < loopIdx, 'discovery is not logged before the batch loop (B1: no silent expansion)');
});

// ---- 3. B2 checkpoint-first ---------------------------------------------------------------------

test('B2: .product/.batch-enrich/ checkpoint dir literal present', () => {
  assert(runner.includes('.product/.batch-enrich/'), 'checkpoint dir literal missing');
});

test('B2: checkpoint-first manifest write happens BEFORE the batch loop', () => {
  const checkpointIdx = runner.indexOf('const checkpoint = await agent(');
  const loopIdx = runner.indexOf('for (const FM of FEATURES)');
  assert(checkpointIdx !== -1, 'checkpoint-first agent() call missing');
  assert(loopIdx !== -1, 'batch for-loop missing');
  assert(checkpointIdx < loopIdx, 'checkpoint-first write is not before the first-enrichment-touch loop (B2)');
});

test('B2: deterministic batch-slug (no Date/timestamp in the slug derivation)', () => {
  const sliceStart = runner.indexOf('const BATCH_SLUG');
  const sliceEnd = runner.indexOf('const CHECKPOINT_DIR');
  assert(sliceStart !== -1 && sliceEnd !== -1 && sliceStart < sliceEnd, 'BATCH_SLUG derivation block not found');
  const slugBlock = runner.slice(sliceStart, sliceEnd);
  assert(!/Date\.now|new Date/.test(slugBlock), 'BATCH_SLUG derivation references Date (must be deterministic from the sorted feature list)');
  assert(/FEATURES\.join/.test(slugBlock) || /FEATURES\[/.test(slugBlock), 'BATCH_SLUG is not derived from the sorted FEATURES list');
});

test('B2: per-FM state file <FM>.json single-writer wording', () => {
  assert(runner.includes('${CHECKPOINT_DIR}/${FM}.json'), 'per-FM state file path missing');
  assert(/SINGLE writer/i.test(runner), 'single-writer wording missing for the per-FM state file');
});

test('B2: resume map skip logic present (all-stages-done FM is skipped, logged + reported)', () => {
  assert(runner.includes('resumeMap'), 'resumeMap missing');
  assert(runner.includes('const done = resumeMap[FM] || {}'), 'per-FM resume lookup missing');
  assert(runner.includes('if (done.enrich && done.complete && done.gate)'), 'all-stages-done resume-skip guard missing');
  assert(runner.includes("skipped.push({ feature: FM, stage: 'all'"), 'resume-skip is not pushed to the skipped[] report (B6, no silent truncation)');
});

// ---- 4. B3 orchestrate, don't duplicate ----------------------------------------------------------

test('B3: FEATURE_DOC_CANDIDATES two-candidate array, deployed form first', () => {
  const m = runner.match(/const FEATURE_DOC_CANDIDATES = (\[[^\]]*\])/);
  assert(!!m, 'FEATURE_DOC_CANDIDATES declaration missing');
  assert(m[1].includes("'.claude/commands/product/feature.md'"), 'deployed-form feature.md candidate missing');
  assert(m[1].includes("'commands/product/feature.md'"), 'repo-form feature.md candidate missing');
  assert(m[1].indexOf('.claude/commands/product/feature.md') < m[1].indexOf("'commands/product/feature.md'"), 'deployed-form candidate must be listed FIRST');
});

test('B3: COMPLETE_CANDIDATES two-candidate array, deployed form first', () => {
  assert(runner.includes("'.claude/product/processes/complete-feature.mjs'"), 'deployed-form complete-feature.mjs candidate missing');
  assert(runner.includes("'product/processes/complete-feature.mjs'"), 'repo-form complete-feature.mjs candidate missing');
  const deployedIdx = runner.indexOf('.claude/product/processes/complete-feature.mjs');
  const repoIdx = runner.indexOf("'product/processes/complete-feature.mjs'");
  assert(deployedIdx !== -1 && repoIdx !== -1 && deployedIdx < repoIdx, 'deployed-form complete-feature.mjs candidate must be listed FIRST');
});

test('B3: workflow({ scriptPath: COMPLETE_PATH } delegation call present', () => {
  assert(/workflow\(\{\s*scriptPath:\s*COMPLETE_PATH\s*\}/.test(runner), 'workflow({scriptPath: COMPLETE_PATH}) delegation call missing');
});

test('B3: no re-implemented authoring templates (SC field vocabulary) in the runner', () => {
  assert(!/\bpreconditions\b/i.test(runner), 'preconditions (SC field vocabulary) crept into the runner — authoring must not be re-implemented here');
  assert(!/\bpostconditions\b/i.test(runner), 'postconditions (SC field vocabulary) crept into the runner — authoring must not be re-implemented here');
});

// ---- 5. B4 PA_CANON verbatim + phase-boundary gate ------------------------------------------------

test('B4: PA_CANON present in the runner AND byte-identical to complete-feature.mjs', () => {
  const firstLine = "'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '";
  assert(runner.includes(firstLine), 'PA_CANON opening line missing from the runner');
  const complete = fs.readFileSync(COMPLETE, 'utf-8');
  assert(complete.includes(firstLine), 'PA_CANON opening line does not match the complete-feature.mjs source verbatim');
});

test('B4: gate-replacement wording (per-item approve -> PA-escalation) present in the ENRICH brief', () => {
  assert(/GATE-REPLACEMENT/.test(runner), 'GATE-REPLACEMENT label missing');
  assert(/per-item human APPROVES.*REPLACED/s.test(runner) || /REPLACED for this batch run by L1 PA-escalation/.test(runner), 'per-item-approve -> PA-escalation replacement wording missing');
});

test('B4: F.8/F.9 skip present, boundary-PA GATE stage present, PA-dedup 0089 referenced', () => {
  assert(/SKIP F\.8.*F\.9|F\.8.*F\.9.*SKIPPED/.test(runner), 'F.8/F.9 skip wording missing');
  assert(runner.includes("phase('Gate')"), 'Gate phase call missing');
  assert(/boundary PA|boundary_pa/.test(runner), 'boundary-PA wording missing from the GATE stage');
  assert(runner.includes('DEC-DEV-0089'), 'PA-dedup DEC-DEV-0089 reference missing');
});

// ---- 6. B5 prepare-only -----------------------------------------------------------------------

test('B5: prepare-only (never transitions FM status) present in runner + command doc', () => {
  assert(/NEVER transitions FM status/i.test(runner), '"NEVER transitions FM status" wording missing from the runner');
  assert(/never transitions FM status|PREPARE-ONLY/i.test(command), 'prepare-only wording missing from the command doc');
});

test('B5: honest_unmet carried verbatim into the per-FM completeSummary', () => {
  assert(runner.includes('honest_unmet'), 'honest_unmet missing from the runner');
  assert(/honest_unmet:\s*\(child && child\.honest_unmet\) \|\| ''/.test(runner), 'honest_unmet is not carried verbatim from the child completeness-loop result');
});

test('B5: caveats include the prepare-only line', () => {
  assert(/PREPARE-ONLY:/.test(runner), 'PREPARE-ONLY caveat line missing');
  assert(runner.includes("caveats = ["), 'caveats array construction missing');
});

// ---- 7. B6/B7 accounting + sequential loop -----------------------------------------------------

test('B6: skipped[] and failed_at accounting present', () => {
  assert(runner.includes('const skipped = []'), 'skipped[] accumulator missing');
  assert(runner.includes('failed_at: failedAt'), 'failed_at accounting missing from the per-FM processed record');
});

test('B7: sequential for-loop over FEATURES, no pipeline() call', () => {
  assert(runner.includes('for (const FM of FEATURES)'), 'sequential for-loop over FEATURES missing');
  // pipeline() is referenced in the doc-comment (contrasting with the chosen sequential for-loop) —
  // check the comment-stripped CODE for an actual call, not the prose mention.
  assert(!/\bpipeline\s*\(/.test(runnerCode), 'a pipeline() call crept into the runner (B7 requires a plain sequential for-loop)');
});

test('B6/B7: try/catch guards each stage (status/enrich/complete/gate)', () => {
  for (const marker of ["failed-at-status", "failed-at-enrich", "failed-at-complete", "failed-at-gate"]) {
    assert(runner.includes(marker), `${marker} try/catch guard wording missing`);
  }
});

// ---- 8. MDP model-pin gate ----------------------------------------------------------------------

test('MDP: every agent() opts line (identified by `label:`) pins model: or agentType:', () => {
  const lines = runner.split(/\r?\n/);
  const unpinned = [];
  lines.forEach((line, i) => {
    if (!/\blabel:/.test(line)) return;                 // not an agent() opts line
    if (/\b(model|agentType):/.test(line)) return;      // pinned (explicit model OR a canonical persona)
    unpinned.push(`L${i + 1}: ${line.trim()}`);
  });
  assert(unpinned.length === 0, `${unpinned.length} agent() call(s) missing an MDP model pin:\n        ${unpinned.join('\n        ')}`);
});

// ---- 9. Command doc ------------------------------------------------------------------------------

test('command frontmatter: description + argument-hint containing --all-planned', () => {
  assert(/^description:/m.test(command), 'frontmatter description missing');
  assert(/^argument-hint:.*--all-planned/m.test(command), 'argument-hint missing --all-planned');
});

test('command dispatch block: scriptPath .claude/product/processes/batch-enrich-feature-set.mjs', () => {
  assert(command.includes(".claude/product/processes/batch-enrich-feature-set.mjs"), 'scriptPath dispatch missing from the command');
});

test('command: "pass `args` as an OBJECT" note present (FB-001 companion)', () => {
  assert(/pass `args` as an OBJECT/i.test(command), 'args-as-object warning missing');
});

test('command: B1-B7 rails section present', () => {
  assert(/B1[–\-]B7/.test(command), 'B1-B7 rails section header missing');
  for (const b of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']) {
    assert(command.includes(`**${b} `), `${b} rail bullet missing from the command doc`);
  }
});

test('command: inline fallback section present', () => {
  assert(/Fallback.*runner unresolvable/i.test(command), 'inline fallback section header missing');
  assert(/\*\*inline\*\*/.test(command), 'inline-fallback emphasis missing');
});

test('command: recommends /ecosystem:update on fallback', () => {
  assert(/Recommend `\/ecosystem:update`/.test(command), 'Recommend `/ecosystem:update` line missing');
});

console.log(`\n${passed} assertions passed.`);
