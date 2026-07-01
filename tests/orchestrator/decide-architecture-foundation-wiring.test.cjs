'use strict';
/**
 * Static guard for the Orchestrator P2 `decide-architecture-foundation` process wiring
 * (DEC-DEV-0128; design DEC-DEV-0127).
 *
 * The .mjs is a harness Workflow script (agent/parallel/phase globals + top-level return)
 * and cannot run standalone, so this asserts structural invariants at the source level
 * (same approach as runtime-smoke-readiness-wiring.test.cjs). The invariants pin the
 * Brief→Consilium→Synthesize→Recommend FSM a live run would exercise:
 *  - the deterministic consilium-synth.cjs is the backbone (the recommendation is RELAYED,
 *    not eyeballed — CODE decides the matrix/rank/veto, DEC-DEV-0127 §9.2);
 *  - the engine is a heterogeneous JURY of 3 fixed priors run in parallel with NO
 *    consensus round (velocity/fidelity/integrity — Vision Epic D);
 *  - an under-specified fork (<2 options) is surfaced, never fabricated into a decision;
 *  - the BOUNDARY holds: P2 recommends, it does NOT edit specs / finalize a DEC / close the
 *    pending-action (FB-LR-07) — it emits a DRAFT dec + a proposal for the owner;
 *  - PA-writes target the canonical worktree-shared pending-actions (PA_CANON, FB-LR-23),
 *    never git-added;
 *  - the recommendation + trade-off + disclosures ride in the return envelope, never dropped.
 *
 * Node stdlib only; run with `node tests/orchestrator/decide-architecture-foundation-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const PROC = path.join(__dirname, '..', '..', 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'decide-architecture-foundation.mjs'), 'utf8');

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
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('orchestrator P2 — decide-architecture-foundation wiring (DEC-DEV-0128)');

test('declares the meta header (name + Brief/Consilium/Synthesize/Recommend phases) and FB-001 args guard', () => {
  assert(/export const meta\s*=/.test(SRC), 'missing export const meta');
  assert(/name:\s*'decide-architecture-foundation'/.test(SRC), 'process name drifted');
  for (const ph of ['Brief', 'Consilium', 'Synthesize', 'Recommend']) {
    assert(new RegExp(`title:\\s*'${ph}'`).test(SRC), `meta.phases missing ${ph}`);
    assert(new RegExp(`phase\\('${ph}'\\)`).test(SRC), `phase('${ph}') call missing`);
  }
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
  assert(/DEC-DEV-0128/.test(SRC), 'DEC-DEV-0128 (build) not referenced');
  assert(/DEC-DEV-0127/.test(SRC), 'DEC-DEV-0127 (ratified design) not referenced');
});

test('consilium-synth.cjs is the deterministic backbone (the recommendation is RELAYED, not eyeballed)', () => {
  assert(/const SYNTH\b/.test(SRC) && /consilium-synth\.cjs/.test(SRC), 'consilium-synth lib not wired');
  assert(/RELAY its JSON VERBATIM/i.test(SRC), 'the synth JSON must be RELAYED (CODE, not LLM judgment)');
  assert(/Do NOT hand-compute or second-guess/i.test(SRC), 'the prompt must forbid re-deriving the matrix/rank/veto');
  // the recommendation + strength + vetoes are read FROM the lib output, not computed in the script.
  assert(/const recommended = [^\n]*synth\.recommended/.test(SRC), 'recommended must come from the synth result');
  assert(/const strength = [^\n]*synth\.strength/.test(SRC), 'strength must come from the synth result');
  assert(/const vetoed = [^\n]*synth\.vetoed/.test(SRC), 'the veto set must come from the synth result');
});

test('the engine is a heterogeneous JURY of 3 fixed priors, parallel, no consensus round', () => {
  assert(/const PRIOR_LIST = \['velocity', 'fidelity', 'integrity'\]/.test(SRC), 'the 3 fixed priors drifted');
  assert(/parallel\(PRIOR_LIST\.map\(/.test(SRC), 'the consilium must run the priors in parallel()');
  assert(/JURY, not a debate/i.test(SRC), 'the jury-not-debate constraint must be in the architect prompt');
  assert(/do NOT coordinate with them/i.test(SRC), 'architects must vote independently (no cross-talk)');
  // each architect returns a structured ArchVerdict (deterministic synthesis input)
  assert(/ARCH_VERDICT_SCHEMA\b/.test(SRC), 'no ArchVerdict schema');
  assert(/blocking_concerns/.test(SRC), 'the veto channel (blocking_concerns) must be in the verdict schema');
});

test('an under-specified fork (<2 options) is surfaced, never fabricated into a decision', () => {
  assert(/optionIds\.length >= 2/.test(SRC), 'the >=2-options decidability guard is missing');
  assert(/const recordUnDecidable\b/.test(SRC), 'no recordUnDecidable helper for an under-specified fork');
  const seg = SRC.slice(SRC.indexOf('const recordUnDecidable'), SRC.indexOf('const recordUnDecidable') + 900);
  assert(/Do NOT fabricate a second option/i.test(seg), 'must not fabricate an option to force a fork');
  // the early-return path exists (does not fall through to the consilium)
  assert(/if \(!decidable\)/.test(SRC), 'no !decidable early branch');
  assert(/decidable: false/.test(SRC), 'the under-specified return must carry decidable:false');
});

test('BOUNDARY: P2 recommends — it does NOT edit specs / finalize a DEC / close the PA (FB-LR-07)', () => {
  // the trade-off formulator is fenced
  const tradeoffSeg = SRC.slice(SRC.indexOf("label: 'tradeoff'") - 1600, SRC.indexOf("label: 'tradeoff'") + 60);
  assert(/do NOT finalize a DEC/i.test(tradeoffSeg), 'the trade-off prompt must forbid finalizing a DEC');
  assert(/DRAFT/.test(tradeoffSeg), 'the dec must be a DRAFT the owner ratifies');
  assert(/do NOT (edit|close)/i.test(tradeoffSeg), 'the trade-off prompt must forbid editing specs / closing the PA');
  // the delivery writer is fenced
  const deliverSeg = SRC.slice(SRC.indexOf('const deliverRecommendation'), SRC.indexOf('const deliverRecommendation') + 1200);
  assert(/Do NOT change the PA status/i.test(deliverSeg), 'delivery must not flip the PA to done/dismissed (owner ratifies)');
  assert(/Do NOT edit any spec/i.test(deliverSeg), 'delivery must not edit specs');
});

test('PA-writes target the canonical worktree-shared file (PA_CANON, FB-LR-23), never git-added', () => {
  assert(/FB-LR-23/.test(SRC), 'FB-LR-23 parallel-worktree guard not referenced');
  assert(/const PA_CANON\b/.test(SRC), 'no PA_CANON canonical-pending-actions instruction');
  assert(/git worktree list --porcelain/.test(SRC), 'PA_CANON does not resolve the canonical file via git worktree list');
  assert(/Do NOT .{0,12}git add/i.test(SRC), 'PA_CANON must forbid git-add of the pending-actions file');
  // declaration + brief + deliver + under-specified = 4 uses (every PA-touching prompt carries it)
  const uses = (SRC.match(/\bPA_CANON\b/g) || []).length;
  assert(uses >= 3, `every PA-emitting prompt must include PA_CANON (decl + uses; found ${uses})`);
});

test('Synthesize runs the deterministic lib BEFORE the semantic trade-off (code fixes the matrix, prompt explains it)', () => {
  const synthIdx = SRC.indexOf("label: 'synth'");
  const tradeoffIdx = SRC.indexOf("label: 'tradeoff'");
  assert(synthIdx !== -1, 'no synth (deterministic) agent');
  assert(tradeoffIdx !== -1, 'no tradeoff (semantic) agent');
  assert(synthIdx < tradeoffIdx, 'the deterministic synth must run BEFORE the trade-off formulation');
  // the trade-off is instructed NOT to change what the lib recommended
  const seg = SRC.slice(tradeoffIdx - 1600, tradeoffIdx);
  assert(/You may NOT change what it recommends/i.test(seg), 'the trade-off must not override the deterministic recommendation');
});

test('the recommendation + trade-off + disclosures ride in the return envelope, never dropped', () => {
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  for (const key of [
    'fork_id', 'decidable', 'recommendation', 'strength', 'the_real_tradeoff',
    'rationale', 'dec_draft', 'applies_to', 'matrix', 'ranked', 'vetoed',
    'panel_complete', 'verdicts_count', 'disclosures',
  ]) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(m[0]), `return envelope missing key: ${key}`);
  }
});

test('a reduced panel / split / all-vetoed fork is disclosed (a recommendation is not a rubber-stamp)', () => {
  assert(/panel_complete/.test(SRC), 'panel completeness is not threaded');
  assert(/REDUCED panel/i.test(SRC), 'a reduced panel must be disclosed');
  assert(/the lenses DIVERGE/i.test(SRC), 'a split must be disclosed as a real trade-off');
  assert(/every option is vetoed/i.test(SRC), 'an all-vetoed fork must be disclosed as no-clean-pick');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
