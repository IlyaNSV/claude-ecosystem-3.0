'use strict';
/**
 * consilium wiring test — Wave (C∥D) / D1b (DEC-DEV-0145).
 *
 * Static wiring checks over the decision-prep jury runner + its dispatch command, in the
 * complete-feature-wiring / orchestrator wiring-test style: read the sources, assert the
 * load-bearing contracts are PRESENT IN THE TEXT. Behavior is validated live (a fixture
 * decision-PA, separate session); this guards against a refactor silently dropping a rail.
 *
 * Also asserts the harness-dialect constraints the generic smoke enforces (no fs / Date /
 * Math.random; line-1 export const meta) so a drift is caught here with a targeted message.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RUNNER = path.join(ROOT, 'product', 'processes', 'consilium.mjs');
const COMMAND = path.join(ROOT, 'commands', 'product', 'consilium.md');
const P2 = path.join(ROOT, 'orchestrator', 'processes', 'decide-architecture-foundation.mjs');
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

// The banned harness tokens (Date.now / Math.random / new Date) legitimately appear in the
// runner's harness-constraint COMMENT (idiomatic — complete-feature.mjs does the same). Strip
// block + line comments before the dialect check so we test EXECUTABLE code, not the doc-comment.
// (The authoritative dialect gate is tests/orchestrator/workflow-syntax.smoke.cjs, which parses
// the body; this is a targeted redundant guard.)
const runnerCode = runner
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (naive; avoids http:// via the [^:] guard)

console.log('consilium wiring — Wave (C∥D) D1b');

test('meta header: line-1 export const meta, name consilium, all five phases', () => {
  assert(/^export const meta = \{/.test(runner), 'line-1 export const meta missing (smoke dialect contract)');
  assert(runner.includes("name: 'consilium'"), 'meta.name drifted');
  for (const p of ['Load', 'Scope', 'Jury', 'Synthesize', 'Recommend']) {
    assert(runner.includes(`{ title: '${p}' }`), `meta phase ${p} missing`);
  }
});

test('harness dialect: no fs / Date / Math.random in the runner CODE (agents transport all I/O)', () => {
  // Checked against comment-stripped code — the banned tokens are allowed in the doc-comment.
  assert(!/\brequire\s*\(/.test(runnerCode), 'require() crept into the runner (harness has no module loader)');
  assert(!/Date\.now\s*\(/.test(runnerCode), 'Date.now() is banned in the harness dialect');
  assert(!/new Date\b/.test(runnerCode), 'new Date() is banned in the harness dialect');
  assert(!/Math\.random\s*\(/.test(runnerCode), 'Math.random() is banned in the harness dialect');
});

test('FB-001: stringified-args guard, not bare args || {}', () => {
  assert(runner.includes("typeof args === 'string' ? JSON.parse(args) : args"), 'FB-001 args guard missing');
});

test('FB-002: an empty pa_id is refused with a well-formed report, never scanned/guessed', () => {
  assert(runner.includes('if (!PA_ID)'), 'empty-pa_id guard missing');
  assert(/consilium: empty pa_id/.test(runner), 'empty-pa_id refusal report missing');
});

test('R1 fork guard: <2 options -> honest refusal BEFORE any jury spawn, never fabricate an option', () => {
  assert(runner.includes('optionIds.length >= 2'), 'fork >=2-options guard missing');
  assert(runner.includes('if (!decidable)'), 'decidable code-guard missing');
  assert(/do NOT fabricate a second option|Do NOT fabricate a second option/i.test(runner), 'no-fabrication rail missing');
  // the guard must sit before the Jury phase call in source order (guard runs pre-fan-out).
  assert(runner.indexOf('if (!decidable)') < runner.indexOf("phase('Jury')"), 'fork guard is not before the jury fan-out');
});

test('R2 declared scope / no silent fan-out: scope (subject+panel+axes) logged before the fan-out', () => {
  assert(runner.includes("phase('Scope')"), 'Scope phase missing');
  assert(/SCOPE declared/.test(runner), 'scope-declaration log missing (no silent fan-out)');
  assert(runner.indexOf('SCOPE declared') < runner.indexOf("phase('Jury')"), 'scope is declared after the jury spawns (silent fan-out)');
  assert(command.includes('No silent fan-out') || command.includes('no silent'), 'D2 no-silent-fan-out policy missing from the command');
});

test('R3 heterogeneous panel by zone: architect+qa default, ux ONLY when UI-bearing', () => {
  assert(runner.includes("['architect-advisor', 'qa-advisor', 'ux-advisor']"), 'UI-bearing panel (with ux) missing');
  assert(runner.includes("['architect-advisor', 'qa-advisor']"), 'default panel (architect+qa) missing');
  assert(/has_ui === true|uiBearing/.test(runner), 'UI-bearing gate for ux-advisor missing');
});

test('R4 raw-source briefs (FB-LR-31): jurors read the raw artifact paths themselves', () => {
  assert(runner.includes('FB-LR-31'), 'FB-LR-31 raw-source reference missing');
  assert(/artifact_refs/.test(runner), 'artifact_refs (paths for the jurors to read) missing');
  assert(/does NOT paraphrase/i.test(runner), 'no-paraphrase raw-source rail missing');
});

test('R5 canonical agentType, crash-safe slot, bounded re-spawn, never general-purpose', () => {
  assert(runner.includes('agentType: name'), 'canonical agentType spawn missing');
  assert(/try \{ r = await spawnJuror\(name\) \} catch/.test(runner), 'crash-safe try/catch slot missing');
  assert(/never general-purpose/i.test(runner), 'no-general-purpose-fallback rail missing');
  assert(!/agentType:\s*'general-purpose'/.test(runner), 'a general-purpose fallback spawn crept in');
  assert(runner.includes('MAX_RESPAWN = 1'), 'bounded single re-spawn cap missing');
});

test('R6 deterministic synthesis: consilium-synth.cjs transported VERBATIM with --panel', () => {
  assert(runner.includes('consilium-synth.cjs'), 'consilium-synth.cjs path missing');
  assert(/--panel \$\{panelNames\.join\(','\)\}/.test(runner), '--panel injection of the persona jury missing (DEC-DEV-0145)');
  assert(/RELAY its JSON output VERBATIM|relay the lib output exactly/i.test(runner), 'verbatim-relay (transport-only) instruction missing');
  assert(/You are the TRANSPORT/i.test(runner), 'transport-only framing missing');
});

test('R6 synth path resolves BOTH deploy (.claude/) and repo (orchestrator/lib) forms', () => {
  assert(runner.includes(".claude/orchestrator/lib/consilium-synth.cjs"), 'deploy-form synth path missing');
  assert(runner.includes("orchestrator/lib/consilium-synth.cjs"), 'repo-form synth path missing');
  assert(runner.includes('SYNTH_CANDIDATES'), 'synth candidate resolution missing');
});

test('R7 integration pass is surfacing-only (never changes recommended/strength)', () => {
  assert(runner.includes('integration_flag'), 'integration pass flag missing');
  assert(/SURFACED to the owner|surfacing-only|never changes/i.test(runner), 'surfacing-only framing missing');
  // recommended/strength are read from the synth, never from the integration agent.
  assert(runner.includes('synth.recommended') && runner.includes('synth.strength'), 'recommendation must come from the deterministic synth, not integration');
});

test('PA_CANON verbatim from the P2/complete-feature sources (FB-LR-23) + PA-dedup, prepare-only', () => {
  const firstLine = "'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '";
  assert(runner.includes(firstLine), 'PA_CANON opening line missing');
  const p2 = fs.readFileSync(P2, 'utf-8');
  const complete = fs.readFileSync(COMPLETE, 'utf-8');
  assert(p2.includes(firstLine) && complete.includes(firstLine), 'PA_CANON opening line does not match the P2 / complete-feature sources verbatim');
  assert(/UPDATE IT IN PLACE|update.*in place/i.test(runner) && runner.includes('DEC-DEV-0089'), 'PA-dedup (update-in-place) instruction missing');
  assert(/Do NOT change the PA status to done|owner ratifies/i.test(runner), 'prepare-only (never close the PA) contract missing');
});

test('report envelope carries panel / scope / panel_complete / caveats (no silent truncation)', () => {
  for (const key of ['scope:', 'panel:', 'recommended,', 'strength,', 'panel_complete:', 'vetoed,', 'soft_vetoed:', 'integration_note:', 'caveats,', 'jurors_incomplete:']) {
    assert(runner.includes(key), `report key ${key} missing from the return envelope`);
  }
  assert(/PREPARE-ONLY/.test(runner), 'prepare-only caveat missing from the report');
});

test('/product:consilium dispatches the deployed runner by scriptPath + keeps an honest inline fallback', () => {
  assert(command.includes(".claude/product/processes/consilium.mjs"), 'scriptPath dispatch missing from the command');
  assert(/fall back to running the same flow \*\*inline\*\*|inline/i.test(command), 'honest inline-fallback clause missing');
  assert(/pass `args` as an OBJECT/i.test(command), 'args-as-object warning missing (FB-001 companion)');
  assert(/PREPARE-ONLY/i.test(command), 'prepare-only policy missing from the command');
});

console.log(`\n${passed} assertions passed.`);
