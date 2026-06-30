'use strict';
/**
 * Static guard for the Orchestrator P7 `runtime-smoke-readiness` process wiring (DEC-DEV-0120).
 *
 * The .mjs is a harness Workflow script (agent/phase/workflow globals + top-level return) and
 * cannot run standalone, so this asserts structural invariants at the source level (same
 * approach as feature-to-tdd-impl-wiring.test.cjs). The invariants pin the assess→branch→report
 * FSM a live run would exercise:
 *  - the deterministic runtime-readiness.cjs is the backbone (verdict is NOT eyeballed);
 *  - env-readiness is probed BEFORE the readiness assessment (a down substrate is ENV_NOT_READY,
 *    never a false NOT_STARTABLE);
 *  - all four verdicts are handled, and only READY_TO_SMOKE boots;
 *  - a BLOCK boot-capability emits a §6 request (PA_CANON, OD7 await), never auto-provisions/mocks;
 *  - the boot smoke is capture-don't-fix (surfaces a failed start, does not remediate);
 *  - the bootSmoke knob gates the substrate-gated execution leg;
 *  - disclosures (mock-only boot / non-GO / DEGRADED) ride in the envelope, never dropped.
 *
 * Node stdlib only; run with `node tests/orchestrator/runtime-smoke-readiness-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const PROC = path.join(__dirname, '..', '..', 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'runtime-smoke-readiness.mjs'), 'utf8');

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

console.log('orchestrator P7 — runtime-smoke-readiness wiring (DEC-DEV-0120)');

test('declares the meta header (name + Assess/Smoke/Report phases) and FB-001 args guard', () => {
  assert(/export const meta\s*=/.test(SRC), 'missing export const meta');
  assert(/name:\s*'runtime-smoke-readiness'/.test(SRC), 'process name drifted');
  for (const ph of ['Assess', 'Smoke', 'Report']) {
    assert(new RegExp(`title:\\s*'${ph}'`).test(SRC), `meta.phases missing ${ph}`);
    assert(new RegExp(`phase\\('${ph}'\\)`).test(SRC), `phase('${ph}') call missing`);
  }
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
});

test('runtime-readiness.cjs is the deterministic backbone (the verdict is relayed, not eyeballed)', () => {
  assert(/const RUNTIME_PROBE\b/.test(SRC) && /runtime-readiness\.cjs/.test(SRC), 'runtime-readiness lib not wired');
  assert(/relay its JSON verbatim/.test(SRC), 'the probe JSON must be RELAYED (CODE, not LLM judgment)');
  assert(/DEC-DEV-0120/.test(SRC), 'DEC-DEV-0120 not referenced');
});

test('env-readiness is probed BEFORE the runtime-readiness assessment (no false NOT_STARTABLE on a down env)', () => {
  const envIdx = SRC.indexOf("label: 'env-readiness'");
  const assessIdx = SRC.indexOf("label: 'runtime-readiness'");
  assert(envIdx !== -1, 'no env-readiness pre-flight probe');
  assert(assessIdx !== -1, 'no runtime-readiness assessment agent');
  assert(envIdx < assessIdx, 'env-readiness must run BEFORE the runtime-readiness assessment');
  // and the env readiness is fed into the runtime probe (--env)
  assert(/--env \$\{envReadiness\}/.test(SRC), 'env readiness is not fed into the runtime-readiness probe');
});

test('all four verdicts are handled and ONLY READY_TO_SMOKE boots', () => {
  for (const v of ['BLOCKED_ON_CAPABILITY', 'NOT_STARTABLE', 'ENV_NOT_READY', 'READY_TO_SMOKE']) {
    assert(SRC.includes(v), `verdict ${v} not handled`);
  }
  // the boot-smoke agent must be reached only on the READY_TO_SMOKE path (the final else of the
  // verdict chain), i.e. after all the non-ready branches have been handled.
  const blockIdx = SRC.indexOf("verdict === 'BLOCKED_ON_CAPABILITY'");
  const bootIdx = SRC.indexOf("label: 'boot-smoke'");
  assert(blockIdx !== -1 && bootIdx !== -1 && blockIdx < bootIdx,
    'the boot smoke must be the READY path AFTER the non-ready branches');
});

test('a BLOCK boot-capability emits a §6 request (PA_CANON, OD7 await), never auto-provisions/mocks', () => {
  assert(/const emitRuntimeRequest\b/.test(SRC), 'no emitRuntimeRequest helper');
  const seg = SRC.slice(SRC.indexOf('const emitRuntimeRequest'), SRC.indexOf('const emitRuntimeRequest') + 1400);
  assert(/PA_CANON/.test(seg), 'the §6 request does not resolve the canonical pending-actions (PA_CANON)');
  assert(/OD7/.test(seg), 'a runtime BLOCK must be flagged for the OD7 escalate→await leg');
  assert(/Do NOT provision, mock, or fake/i.test(seg), 'the §6 request must NOT auto-provision/mock to make the boot pass');
  // emitted on the BLOCKED_ON_CAPABILITY branch, before any boot
  assert(/BLOCKED_ON_CAPABILITY'\)\s*\{[\s\S]{0,200}emitRuntimeRequest/.test(SRC),
    'emitRuntimeRequest must fire on the BLOCKED_ON_CAPABILITY branch');
});

test('NOT_STARTABLE records a tracking item routed to Product, never invents a boot command', () => {
  assert(/const recordNotStartable\b/.test(SRC), 'no recordNotStartable helper');
  const seg = SRC.slice(SRC.indexOf('const recordNotStartable'), SRC.indexOf('const recordNotStartable') + 900);
  assert(/route Product/.test(seg), 'NOT_STARTABLE must route Product (scaffold/spec gap)');
  assert(/Do NOT invent or guess a boot command/i.test(seg), 'must not fabricate a run target');
});

test('the boot smoke is capture-don\'t-fix (surfaces a failed start, does not remediate)', () => {
  const seg = SRC.slice(SRC.indexOf("label: 'boot-smoke'") - 1400, SRC.indexOf("label: 'boot-smoke'") + 200);
  assert(/capture-don't-fix/i.test(seg), 'the boot smoke prompt must be capture-don\'t-fix');
  assert(/do NOT remediate/i.test(seg), 'the boot smoke must not remediate');
  assert(/env-not-loaded/.test(seg), 'the boot smoke must diagnose the RUN 01 env-not-loaded 500 class');
  assert(/Do NOT edit code, do NOT commit/i.test(seg), 'the boot smoke must not edit/commit');
});

test('the bootSmoke knob gates the substrate-gated execution leg', () => {
  assert(/const BOOT_SMOKE\b/.test(SRC), 'no BOOT_SMOKE knob');
  assert(/A\.bootSmoke !== false/.test(SRC), 'bootSmoke default must be true (opt-out, not opt-in)');
  assert(/!BOOT_SMOKE/.test(SRC), 'the readiness-only branch (bootSmoke disabled) is not handled');
  assert(/READY_NOT_RUN/.test(SRC), 'a readiness-only run must report READY_NOT_RUN, not a fake STARTS');
});

test('PA-writes target the canonical worktree-shared file (FB-LR-23)', () => {
  assert(/FB-LR-23/.test(SRC), 'FB-LR-23 parallel-worktree guard not referenced');
  assert(/const PA_CANON\b/.test(SRC), 'no PA_CANON canonical-pending-actions instruction');
  assert(/git worktree list --porcelain/.test(SRC), 'PA_CANON does not resolve the canonical file via git worktree list');
  // declaration + 2 PA-emitting prompts (runtime-request + not-startable) = 3 occurrences
  const uses = (SRC.match(/\bPA_CANON\b/g) || []).length;
  assert(uses >= 3, `every PA-emitting prompt must include PA_CANON (decl + 2 uses; found ${uses})`);
});

test('disclosures + the §6 requests ride in the return envelope, never dropped', () => {
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m, 'could not locate the process return object');
  for (const key of ['feature', 'verdict', 'p7_result', 'smoke_attemptable', 'capabilities_unknown', 'run_target', 'smoke', 'requests', 'disclosures', 'readiness']) {
    assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(m[0]), `return envelope missing key: ${key}`);
  }
});

test('a §6 probe that cannot resolve is fail-loud, not fail-open (capabilities_unknown threaded through)', () => {
  // the lib distinguishes "no caps" from "could not probe"; the process must surface the latter
  // (a silent clean READY on an unprobeable feature is the reviewer-flagged fail-open).
  assert(/const capsUnknown\b/.test(SRC), 'process does not read capabilities_unknown from the assessment');
  assert(/UNAVAILABLE/.test(SRC), 'an unresolved capability probe must be logged, not silent');
  const m = SRC.match(/return\s*\{[\s\S]*\n\}/);
  assert(m && /capabilities_unknown:\s*capsUnknown/.test(m[0]), 'capabilities_unknown not surfaced in the envelope');
});

test('reuses the §6 manifest via the lib (composes capability-probe, does not duplicate disposition)', () => {
  // the .mjs feeds --feature to runtime-readiness, which internally reuses capability-probe; the
  // process must NOT re-implement the disposition logic (no parseManifestItem / dispositionFor here).
  assert(/--feature \$\{FEATURE\}/.test(SRC), 'the feature lens is not passed to the runtime probe');
  assert(!/parseManifestItem|dispositionFor|external_capabilities:/.test(SRC),
    'P7 must compose capability-probe via the lib, not re-implement §6 disposition');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
