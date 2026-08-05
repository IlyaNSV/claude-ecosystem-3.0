'use strict';
/**
 * Static guard for the Orchestrator P8 `user-journey-acceptance` process wiring (DEC-DEV-0225).
 *
 * The .mjs is a harness Workflow script (agent/phase globals + top-level return) and cannot run
 * standalone, so this asserts structural invariants at the source level (same approach as
 * runtime-smoke-readiness-wiring.test.cjs / deploy-to-stage-wiring.test.cjs). The invariants pin the
 * preflight→(gate|run)→report FSM a live run would exercise, AND the charter contract that slots P8
 * between the staging deploy and `done`:
 *  - uja-report.cjs is the DETERMINISTIC backbone (the verdict is relayed, not eyeballed — the whole
 *    point of the lib: a green gate on a broken first-user-touch is the "false DEPLOYED" class);
 *  - preflight is a Definition-of-Readiness gate (Playwright equipped? journeys present? staging 2xx?)
 *    and a missing piece is an honest ENV_NOT_READY with a DoR hint, NEVER a fabricated pass;
 *  - the run agent is capture-don't-fix and carries the real-vendor BUDGET GUARD (minimal fixtures);
 *  - the zero-evidence rule is respected (a 0-journey report is ENV_NOT_READY, never a PASS);
 *  - the VISUAL-CONFORMANCE leg (DEC-DEV-0237) is wired: the release scope arrives as `features`, the
 *    per-SI verdict is read through the same deterministic lib, its fields are OPTIONAL in the agent
 *    schema (an older uja-report.cjs in the target degrades to an honest gap, not a schema error), and
 *    on a Release-DoD run an INCOMPLETE / unavailable leg HARD-BLOCKS to ENV_NOT_READY — a green
 *    acceptance over screens nobody ever saw is the "designed — not built" class at the pixel level;
 *  - the HEADED/VIDEO channel (DEC-DEV-0240) is opt-in and SEPARATE from the verdict: headless stays
 *    the default arm byte-for-byte (a gate whose default needs an X server breaks in CI/ssh), the
 *    headed arm makes the browser visible + records video/trace WITHOUT editing the target's
 *    playwright config, and a recording is evidence for HUMANS — it never feeds PASS/FAIL;
 *  - PA-writes target the canonical worktree-shared file (PA_CANON / FB-LR-23);
 *  - MDP: every stage is a mechanical transport ⇒ sonnet (there is NO LLM-graded step in v0);
 *  - CHARTER v6: `journey_acceptance` sits BETWEEN deploying_staging and done; a P8 PASS → done,
 *    FAIL → awaiting_journey_fix (owner-queued), ENV_NOT_READY → runtime_gate_retry; and the deploy
 *    cell's success now routes to journey_acceptance, not straight to done.
 *  - DEPLOY-GATE-SAFETY analogue: journey_acceptance's derived resume-event is a SAFE owner.close,
 *    never a journey-result event (a stray pa-scan of the gate must never mark a feature done without
 *    an actual journey run).
 *
 * Node stdlib only; run with `node tests/orchestrator/user-journey-acceptance-wiring.test.cjs`.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const PROC = path.join(ROOT, 'orchestrator', 'processes');
const SRC = fs.readFileSync(path.join(PROC, 'user-journey-acceptance.mjs'), 'utf8');
const CHARTER = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'orchestrator', 'charters', 'feature-production-line.json'), 'utf8'));
const engine = require(path.join(ROOT, 'orchestrator', 'lib', 'fabric-engine.cjs'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

console.log('orchestrator P8 — user-journey-acceptance wiring (DEC-DEV-0225)');

test('declares the meta header (name + Preflight/Run/Report phases) and FB-001 args guard', () => {
  assert(/export const meta\s*=/.test(SRC), 'missing export const meta');
  assert(/name:\s*'user-journey-acceptance'/.test(SRC), 'process name drifted');
  for (const ph of ['Preflight', 'Run', 'Report']) {
    assert(new RegExp(`title:\\s*'${ph}'`).test(SRC), `meta.phases missing ${ph}`);
    assert(new RegExp(`phase\\('${ph}'\\)`).test(SRC), `phase('${ph}') call missing`);
  }
  assert(/typeof args === 'string' \? JSON\.parse\(args\)/.test(SRC), 'FB-001 args guard missing');
});

test('uja-report.cjs is the DETERMINISTIC backbone (verdict + preflight relayed, not eyeballed)', () => {
  assert(/const UJA_LIB\b/.test(SRC) && /uja-report\.cjs/.test(SRC), 'uja-report lib not wired');
  assert(/DEC-DEV-0225/.test(SRC), 'DEC-DEV-0225 not referenced');
  // preflight relay + parse relay both go through the lib
  assert(/node \$\{UJA_LIB\} preflight/.test(SRC), 'the preflight is not read through the deterministic lib');
  assert(/node \$\{UJA_LIB\} parse --report/.test(SRC), 'the verdict is not read through the deterministic lib parse');
  const runSeg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/TRANSPORT/i.test(runSeg) && /do NOT judge/i.test(runSeg),
    'the run agent must be a TRANSPORT — it must NOT judge PASS/FAIL itself (the lib decides)');
});

test('preflight is a DoR gate: Playwright equipped? journeys present? staging 2xx? — probed before the run', () => {
  const preIdx = SRC.indexOf("label: 'uja-preflight'");
  const hcIdx = SRC.indexOf("label: 'staging-healthcheck'");
  const runIdx = SRC.indexOf("label: 'run-journeys'");
  assert(preIdx !== -1, 'no uja-preflight probe');
  assert(hcIdx !== -1, 'no staging healthcheck probe');
  assert(runIdx !== -1, 'no run-journeys agent');
  assert(preIdx < runIdx && hcIdx < runIdx, 'the DoR probes must run BEFORE the journey run');
  // the deterministic gate reads all the DoR signals
  assert(/const playwrightPresent\b/.test(SRC) && /const journeysPresent\b/.test(SRC) && /const negativePresent\b/.test(SRC) && /const stagingTwoxx\b/.test(SRC),
    'the gate must read playwright_present + journeys_present + the staging 2xx signals');
  // the short-circuit reads EVERY DoR leg. Pinned leg-by-leg (not as one frozen line) so a NEW leg
  // extends the gate instead of silently replacing it — the 0237 visual-scope leg was added this way.
  const gate = SRC.split('\n').find((l) => /^if \(!playwrightPresent/.test(l)) || '';
  assert(gate, 'the deterministic DoR short-circuit (if (!playwrightPresent …)) is gone');
  for (const leg of ['!playwrightPresent', '!journeysPresent', '!negativePresent', '!STAGING_URL', '!stagingTwoxx',
    "(DOD_RUN && INPUT_PROFILE !== 'realistic')", '(DOD_RUN && !FEATURES.length)']) {
    assert(gate.includes(leg), `the DoR gate drops a leg: ${leg} — any missing piece (incl. a dev-profile DoD run, DEC-DEV-0231, and a scope-less DoD run, DEC-DEV-0237) must short-circuit to ENV_NOT_READY`);
  }
});

test('realistic-input DoD leg (DEC-DEV-0231 2.5): a DoD run on dev fixtures is an honest DoR gap, and the profile is auditable', () => {
  assert(/const DOD_RUN\b/.test(SRC) && /const INPUT_PROFILE\b/.test(SRC), 'no dodRun / inputProfile args');
  // the owner directive is named with its numbers (видео 30 мин – 2 ч; 5-сек — только dev)
  assert(/30 мин/.test(SRC) && /2 ч/.test(SRC) && /5-сек|5-second|5-sec/i.test(SRC),
    'the realistic-input directive (видео 30 мин – 2 ч; 5-сек только dev) is not named');
  assert(/2026-07-23/.test(SRC), 'the owner-directive provenance date is not carried');
  // both return arms carry input_profile so RL DoD категория 3 can read it from run.json
  const returns = (SRC.match(/return \{[\s\S]*?\n\}/g) || []).filter((r) => /uja_result/.test(r));
  for (const r of returns) {
    assert(/input_profile\s*:/.test(r), 'a return arm drops input_profile — RL DoD cannot audit the run');
  }
  // the realistic profile swaps the minimal-fixtures guard for the realistic-load instruction (still single-pass)
  assert(/REALISTIC-INPUT PROFILE/.test(SRC), 'the run prompt has no realistic-profile branch');
  assert(/INPUT_PROFILE === 'realistic'/.test(SRC), 'the run prompt is not conditional on the input profile');
});

test('forwarded implementer deviations are DISCLOSED in the P8 verdict (DEC-DEV-0231 2.2)', () => {
  assert(/const CONCERNS = A\.concerns \|\| \[\]/.test(SRC), 'P8 does not accept forwarded concerns');
  const returns = (SRC.match(/return \{[\s\S]*?\n\}/g) || []).filter((r) => /uja_result/.test(r));
  for (const r of returns) {
    assert(/concerns\s*:/.test(r), 'a return arm drops the forwarded concerns');
  }
  assert(/PASS-with-caveats/.test(SRC), 'a PASS over a declared deviation must be disclosed as PASS-with-caveats');
  assert(/RL DoD п\.5/.test(SRC), 'the disclosure does not route deviations to owner ratification (RL DoD п.5)');
});

// ---- the VISUAL-CONFORMANCE leg (DEC-DEV-0237) --------------------------------------------------

test('visual leg: the release scope arrives as args.features (a DoD run must know WHICH features are has_ui)', () => {
  assert(/const FEATURES\b/.test(SRC) && /A\.features/.test(SRC),
    'P8 does not accept the release scope (args.features) — visual conformance is judged per has_ui feature');
  assert(/DEC-DEV-0237/.test(SRC), 'DEC-DEV-0237 not referenced');
  // the visual verdict is read through the SAME deterministic lib, relayed — never eyeballed
  assert(/node \$\{UJA_LIB\} visual --root/.test(SRC), 'the visual verdict is not read through the deterministic lib');
  assert(/--features \$\{FEATURES\.join\(','\)\}/.test(SRC), 'the visual lib call does not forward the release scope');
  // …and the JOURNEYS dir: the lib reads `<journeys-dir>/visual-skips.json`, and the prompts tell
  // the agent to declare skips at `${JOURNEYS_DIR}/visual-skips.json`. Without the flag the lib fell
  // back to its default `tests/uja`, so on any project with a non-default journeys dir every DECLARED
  // skip was invisible to the gate — the file the owner was told to write was never the file read.
  assert(/visual --root[^`]*--journeys-dir \$\{JOURNEYS_DIR\}/.test(SRC),
    'the visual lib call does not forward --journeys-dir — declared skips would be read from the wrong path');
});

test('visual leg: on a DoD run an INCOMPLETE (or an unavailable leg) HARD-BLOCKS to ENV_NOT_READY, never a silent PASS', () => {
  assert(/const visualBlocks = DOD_RUN && \(visualEvidence === 'INCOMPLETE' \|\| visualEvidence === null\)/.test(SRC),
    'the hard block must fire on a DoD run when the visual evidence is INCOMPLETE or the leg could not answer (null)');
  assert(/const finalResult = \(visualBlocks && ujaResult !== 'FAIL'\) \? 'ENV_NOT_READY' : ujaResult/.test(SRC),
    'a blocked visual leg must degrade the verdict to ENV_NOT_READY (could-not-judge ⇒ re-run) — but must NOT mask a real FAIL, '
    + 'which the charter routes to awaiting_journey_fix (masking it would send the owner to "bring the env up" while the app is broken)');
  assert(/uja_result: finalResult/.test(SRC), 'the returned uja_result must be the blocked-aware finalResult');
  // and the block is still visible on a FAIL run: readiness answers a DIFFERENT question than uja_result
  assert(/readiness: \(finalResult === 'ENV_NOT_READY' \|\| visualBlocks\)/.test(SRC),
    'a visual block must show in readiness even when a FAIL keeps the routing verdict');
  assert(/visualBlocks[\s\S]{0,120}recordDoRGap\(visualBlockReasons\)/.test(SRC),
    'a visual hard block must record the DoR gap (routed to the owner), not just flip a field');
  // null (a pre-0237 uja-report.cjs in the target) is could-not-judge, and says so with the remedy
  assert(/ecosystem:update/.test(SRC), 'the null-leg reason must name the remedy (/ecosystem:update in the target)');
});

test('visual leg: both return arms carry visual_evidence (+ the per-MK matrix), auditable from run.json alone', () => {
  const returns = (SRC.match(/return \{[\s\S]*?\n\}/g) || []).filter((r) => /uja_result/.test(r));
  assert(returns.length >= 2, `expected the ENV_NOT_READY early return + the final return; found ${returns.length}`);
  for (const r of returns) {
    assert(/visual_evidence\s*:/.test(r), 'a return arm drops visual_evidence — the DoD gate cannot be audited from run.json');
    assert(/(^|[\s{,])visual\s*:/.test(r), 'a return arm drops the visual{} matrix');
    assert(/features\s*:/.test(r), 'a return arm drops the judged release scope (features)');
  }
  // "auditable from run.json alone" is a claim about the WHOLE seam, and the arms are only its first
  // half. It was FALSE while the ledger's summarizeResult projected visual_evidence away: the process
  // returned the field, run.json never carried it, and `/product:impl-sync` read `visual: none` on
  // every judged feature. A return arm that nothing transports is not an audit trail — so pin the
  // carrier here too, in the test that makes the claim (DEC-DEV-0237).
  const TRAIL_KEYS = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'run-ledger.cjs')).TRAIL_KEYS;
  for (const k of ['visual_evidence', 'artifacts_dir']) {
    assert(TRAIL_KEYS.includes(k),
      `run-ledger drops ${k} from the summary — the arm carries it, run.json does not, and the claim above is a lie`);
  }
});

test('visual leg: the new schema fields are OPTIONAL (an older uja-report.cjs degrades to a gap, not a schema error)', () => {
  const seg = SRC.slice(SRC.indexOf('const VERDICT_SCHEMA'), SRC.indexOf('const PA_CANON'));
  assert(/visual_evidence:/.test(seg) && /visual_mk_scope:/.test(seg) && /visual_reasons:/.test(seg),
    'the verdict schema does not declare the visual fields');
  const required = (seg.match(/required:\s*\[([^\]]*)\]/) || [])[1] || '';
  for (const f of ['visual_evidence', 'visual_mk_scope', 'visual_reasons']) {
    assert(!required.includes(f), `${f} must NOT be required (precedent negative_present): a pre-0237 lib in the target must degrade to an honest gap, not a schema failure`);
  }
});

test('visual leg: the authoring rule is carried in the prompts (per-SI path + the declared-skip file), never silence', () => {
  for (const needle of ['visual/<MK-id>/SI-', 'visual-skips.json']) {
    assert(SRC.includes(needle), `the authoring rule does not name ${needle}`);
  }
  const runSeg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/visual\/<MK-id>\/SI-/.test(runSeg) && /visual-skips\.json/.test(runSeg),
    'the RUN prompt must carry the authoring rule (capture every SI state, or DECLARE it unbuilt with a reason)');
  const gapSeg = SRC.slice(SRC.indexOf('const recordDoRGap'), SRC.indexOf('// ====='));
  assert(/visual\/<MK-id>\/SI-/.test(gapSeg) && /visual-skips\.json/.test(gapSeg),
    'the DoR-gap note must carry the same authoring rule — a hint that names no path is not a hint');
  assert(/a skip without a reason does NOT count/.test(SRC), 'an unreasoned skip must be declared not to count');
});

test('visual leg: the disclosure line routes the owner reality↔MK review to /product:impl-sync (V-23), MK-diff still v1.1', () => {
  assert(/visual-conformance: per-SI evidence under/.test(SRC), 'the visual-conformance disclosure line drifted');
  assert(/\/product:impl-sync/.test(SRC) && /impl_sync\.visual_review/.test(SRC) && /V-23/.test(SRC),
    'the disclosure must say the owner review is RECORDED via /product:impl-sync (impl_sync.visual_review, V-23) — not left as an unrecorded eyeball');
  assert(/an automatic MK-diff is v1\.1/.test(SRC), 'the disclosure must still scope out the automatic MK-diff (v1.1)');
});

test('an ENV_NOT_READY DoR gap is DISCLOSED with hints (integrator:add playwright / author journeys / staging up), never a fake pass', () => {
  assert(/const recordDoRGap\b/.test(SRC), 'no recordDoRGap helper');
  const seg = SRC.slice(SRC.indexOf('const recordDoRGap'), SRC.indexOf('const recordDoRGap') + 1400);
  assert(/integrator:add playwright/i.test(seg), 'the DoR hint must name /integrator:add playwright');
  assert(/author journeys/i.test(seg), 'the DoR hint must name authoring journeys (from NM)');
  assert(/do NOT invent journeys or fake a pass/i.test(seg), 'a DoR gap must never be faked into a pass');
  assert(/PA_CANON/.test(seg), 'the DoR-gap PA write must resolve the canonical pending-actions (PA_CANON)');
});

test('the healthcheck + preflight probes are READ-ONLY (a down staging / missing tool is EVIDENCE, not fixed here)', () => {
  const preSeg = SRC.slice(SRC.indexOf('const preflight = await agent'), SRC.indexOf("label: 'uja-preflight'"));
  assert(/READ-ONLY/.test(preSeg) && /never REPAIR/i.test(preSeg) && /do NOT install Playwright/i.test(preSeg),
    'the preflight relay must MEASURE, never install/scaffold to improve the verdict');
  const hcSeg = SRC.slice(SRC.indexOf('const stagingUp = STAGING_URL'), SRC.indexOf("label: 'staging-healthcheck'"));
  assert(/READ-ONLY/.test(hcSeg) && /docker start/.test(hcSeg) && /EVIDENCE/.test(hcSeg),
    'the staging healthcheck must not start/repair services to coax a 2xx (a down staging is EVIDENCE for ENV_NOT_READY)');
});

test('the run agent is capture-don\'t-fix, uses the JSON reporter, and carries the real-vendor BUDGET GUARD', () => {
  const seg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/CAPTURE-DON'T-FIX/i.test(seg), 'the run agent must be capture-don\'t-fix');
  assert(/do NOT patch the app, retry until green/i.test(seg), 'the run agent must not remediate/retry-to-green');
  assert(/playwright test/.test(seg) && /--reporter=json/.test(seg), 'the run must use `npx playwright test --reporter=json`');
  assert(/even when tests fail/i.test(seg), 'the report must be captured even on a non-zero playwright exit (a FAIL still writes a report)');
  assert(/BUDGET GUARD/.test(seg) && /MINIMAL fixtures/i.test(seg),
    'the run must carry the real-vendor budget guard — journeys MUST use minimal fixtures (real jobs = real spend)');
  // HEADLESS IS THE DEFAULT ARM, not merely a word somewhere in the prompt (DEC-DEV-0240). The
  // headed mode is opt-in, so the ELSE branch of the fork must still be the headless command: a
  // gate whose default needs an X server breaks in exactly the environment it matters most (CI/ssh).
  assert(/HEADED\s*\?[\s\S]*?\n\s*:\s*`2\) Run HEADLESS with the JSON reporter/.test(seg),
    'the journeys must run HEADLESS BY DEFAULT — the headless command must be the ELSE arm of the HEADED fork, not an option among two');
  assert(/:\s*`2\) Run HEADLESS with the JSON reporter, capturing the report to a file even when tests fail[\s\S]*?npx playwright test \$\{JOURNEYS_DIR\} --reporter=json > \$\{ARTIFACTS_DIR\}\/uja-report\.json/.test(seg),
    'the DEFAULT (toggle absent) run command drifted — absent UJA_HEADED must send the byte-identical headless command this gate has always sent');
});

// ---- the HEADED / VIDEO channel (DEC-DEV-0240, vm-observability Волна B) -------------------------

test('headed toggle: default headless, opt-in via UJA_HEADED=1 env OR args.headed (the env read is guarded)', () => {
  assert(/const HEADED\b/.test(SRC), 'no HEADED toggle');
  assert(/ENV\.UJA_HEADED === '1'/.test(SRC), 'the operator channel is the UJA_HEADED=1 env toggle (owner decision, DEC-DEV-0240)');
  assert(/A\.headed/.test(SRC), 'the harness channel (args.headed) is missing — the Workflow dialect promises inputs via args, not a Node API');
  // the env read MUST be guarded: DEC-DEV-0073 §D.1 — "No filesystem / Node.js API access" in a
  // Workflow script, so `process` may not exist in the sandbox at all. An unguarded read would throw
  // a ReferenceError and take the whole acceptance gate down instead of just the toggle.
  assert(/typeof process !== 'undefined'/.test(SRC),
    'the process.env read must be typeof-guarded (DEC-DEV-0073 §D.1: the harness promises no Node API — an unguarded read crashes the gate, not just the toggle)');
  assert(/DEC-DEV-0240/.test(SRC), 'DEC-DEV-0240 not referenced');
  assert(/const HEADED_DISPLAY\b/.test(SRC) && /UJA_DISPLAY/.test(SRC),
    'the visible browser needs a display it can land on (UJA_DISPLAY, default :0) — hardcoding is how a "visible" run ends up visible to nobody');
});

test('headed run: visible browser + video/trace WITHOUT mutating the project\'s canonical playwright config', () => {
  const seg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/export DISPLAY=\$\{HEADED_DISPLAY\}/.test(seg), 'the headed arm must export DISPLAY — otherwise nothing is visible to the owner');
  assert(/xvfb/i.test(seg), 'the headed arm must forbid xvfb — a framebuffer nobody can see defeats the mode');
  assert(/video: 'on'/.test(seg) && /trace: 'on'/.test(seg), 'the headed arm must turn video + trace on');
  assert(/--headed/.test(seg), 'the headed arm must pass --headed to playwright');
  // the canonical config is the PROJECT's contract — a gate that edits the config it judges under is
  // the evidence-fabrication this whole process exists to prevent (same family as hand-placing a
  // screenshot to close a visual gap). The override must be a throwaway file that IMPORTS it.
  assert(/WITHOUT TOUCHING THE PROJECT'S CANONICAL CONFIG/.test(seg),
    'the headed arm must forbid mutating the target playwright.config.* (the gate never edits what it judges under)');
  assert(/uja-headed\.config/.test(seg) && /IMPORTS the project's config/.test(seg),
    'video has no CLI flag ⇒ the headed arm must use a throwaway override config that imports the project config');
  // and the fallback is honest: no display ⇒ headless + video, DISCLOSED, never abandoned or faked
  assert(/If no display is reachable[\s\S]{0,400}DISCLOSED, never silent/.test(seg),
    'a missing display must degrade to headless-with-video and be DISCLOSED, never silently dropped or faked');
});

test('headed run: the recording is EVIDENCE FOR HUMANS — it never becomes an input to the verdict (two channels)', () => {
  const seg = SRC.slice(SRC.indexOf('const verdict = await agent'), SRC.indexOf("label: 'run-journeys'"));
  assert(/NEVER AN INPUT TO THE VERDICT/.test(seg),
    'the headed arm must state that a recording never decides PASS/FAIL — the machine channel decides from the report bytes, the visual channel only supplements it');
  assert(/do NOT re-run to get a cleaner recording/i.test(seg),
    'a prettier video must never be a reason to re-run (that is retry-until-green wearing a camera)');
  assert(/HUMAN-VISUAL CHANNEL \(DEC-DEV-0240/.test(SRC), 'the header contract does not document the human-visual channel');
});

test('headed run: video_files/trace_files are relayed (optional schema), returned, and DISCLOSED', () => {
  const schemaSeg = SRC.slice(SRC.indexOf('const VERDICT_SCHEMA'), SRC.indexOf('const PA_CANON'));
  assert(/video_files:/.test(schemaSeg) && /trace_files:/.test(schemaSeg), 'the verdict schema does not declare the recording fields');
  const required = (schemaSeg.match(/required:\s*\[([^\]]*)\]/) || [])[1] || '';
  for (const f of ['video_files', 'trace_files']) {
    assert(!required.includes(f), `${f} must NOT be required — a pre-0240 uja-report.cjs in the target must degrade to "no recordings", not a schema failure`);
  }
  const returns = (SRC.match(/return \{[\s\S]*?\n\}/g) || []).filter((r) => /uja_result/.test(r));
  assert(returns.length >= 2, `expected the ENV_NOT_READY early return + the final return; found ${returns.length}`);
  for (const r of returns) {
    for (const key of ['headed', 'video_files', 'trace_files']) {
      assert(new RegExp('(^|[\\s{,])' + key + '\\s*:').test(r), `a return arm drops ${key} — a headed run must be auditable from run.json`);
    }
  }
  // run.json carries `disclosures` (run-ledger TRAIL_KEYS) but NOT video_files — so the recordings
  // must be NAMED in a disclosure, or a headed run leaves evidence nobody can find from the record.
  assert(/disclosures[\s\S]*\.concat\(HEADED/.test(SRC), 'a headed run must disclose its recordings (disclosures is what the ledger carries)');
  const TRAIL_KEYS = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'run-ledger.cjs')).TRAIL_KEYS;
  assert(TRAIL_KEYS.includes('disclosures'), 'the ledger no longer carries disclosures — the headed recordings would vanish from run.json');
  // a headed run with ZERO videos is a BROKEN CHANNEL, said out loud — and NOT a verdict change
  assert(/NO video was recorded/.test(SRC), 'a headed run that recorded nothing must say so (a silent empty channel reads as "all fine")');
  // …and the toggle stays OUT of the verdict computation entirely — the two channels do not mix.
  const verdictAssignments = SRC.split('\n').filter((l) => /^(?:const|let)\s+(?:ujaResult|finalResult)\b/.test(l));
  assert(verdictAssignments.length === 2, `expected ujaResult + finalResult to be computed once each; found ${verdictAssignments.length}`);
  assert(!verdictAssignments.some((l) => /HEADED/.test(l)),
    'the headed toggle must never enter the verdict computation — a run mode may change what is RECORDED, never what is JUDGED');
});

test('the zero-evidence rule + FAIL disclosure ride in the report phase (a 0-journey run is recorded, not silently passed)', () => {
  assert(/if \(ujaResult === 'ENV_NOT_READY'\)/.test(SRC), 'a lib-returned ENV_NOT_READY (empty report) must be recorded as a DoR gap too');
  // the FAIL disclosure names the P7-green-but-404 class this gate exists to catch
  assert(/first-user-touch|404/i.test(SRC), 'a FAIL disclosure must name the first-user-touch / P7-green-but-404 class');
});

test('PA-writes target the canonical worktree-shared file (FB-LR-23)', () => {
  assert(/FB-LR-23/.test(SRC), 'FB-LR-23 parallel-worktree guard not referenced');
  assert(/const PA_CANON\b/.test(SRC), 'no PA_CANON canonical-pending-actions instruction');
  assert(/git worktree list --porcelain/.test(SRC), 'PA_CANON does not resolve the canonical file via git worktree list');
});

test('the return envelope carries the two-leg contract (uja_result + counts + failed[] + artifacts_dir + disclosures)', () => {
  const returns = (SRC.match(/return \{[\s\S]*?\n\}/g) || []).filter((r) => /uja_result/.test(r));
  assert(returns.length >= 2, `expected the ENV_NOT_READY early return + the final return; found ${returns.length}`);
  for (const r of returns) {
    for (const key of ['feature', 'staging_url', 'uja_result', 'journeys_total', 'journeys_passed', 'journeys_failed', 'artifacts_dir', 'readiness_reasons', 'disclosures']) {
      assert(new RegExp('(^|[\\s{,])' + key + '\\s*[:,]').test(r), `a uja_result return arm drops key: ${key}`);
    }
  }
  // all three verdict values are represented in the source
  for (const v of ['PASS', 'FAIL', 'ENV_NOT_READY']) assert(SRC.includes(v), `uja_result value ${v} missing`);
});

test('MDP: every stage is a mechanical transport ⇒ sonnet (no LLM-graded step in v0)', () => {
  for (const label of ['uja-preflight', 'staging-healthcheck', 'run-journeys', 'dor-gap']) {
    const line = SRC.split('\n').find((l) => l.includes(`label: '${label}'`)) || '';
    assert(/model: 'sonnet'/.test(line), `stage ${label} must be sonnet (mechanical transport — the verdict is a deterministic lib reduction, not judgment); got: ${line.trim()}`);
  }
});

// ---- CHARTER v6 contract: P8 slots between the deploy and done ----------------------------------

test('charter v6: journey_acceptance invokes user-journey-acceptance, is auto, sits after the deploy cell', () => {
  assert(CHARTER.version === 6, `charter must be v6 (P8), got ${CHARTER.version}`);
  const ja = CHARTER.states.journey_acceptance;
  assert(ja && ja.invoke && ja.invoke.process === 'user-journey-acceptance', 'journey_acceptance must invoke user-journey-acceptance');
  assert(ja.meta.autonomy === 'auto', 'journey_acceptance is a read-mostly staging gate ⇒ auto (mirrors runtime_gate)');
  // the deploy cell now routes its success into journey_acceptance, not straight to done
  assert(CHARTER.states.deploying_staging.on['evt:deploy.succeeded'].target === 'journey_acceptance',
    'a DEPLOYED staging deploy must route to journey_acceptance (the new leg), NOT straight to done');
});

test('charter v6: journey outcomes route PASS→done, FAIL→awaiting_journey_fix (owner-queued), ENV_NOT_READY→retry', () => {
  const ja = CHARTER.states.journey_acceptance;
  assert(ja.on['evt:journey.passed'].target === 'done', 'a PASS ships → done');
  assert(ja.on['evt:journey.failed'].target === 'awaiting_journey_fix', 'a FAIL parks at awaiting_journey_fix');
  assert(Array.isArray(ja.on['evt:journey.failed'].actions) && ja.on['evt:journey.failed'].actions.includes('queue_owner'),
    'a FAIL must queue the owner');
  assert(ja.on['evt:journey.env_not_ready'].target === 'runtime_gate_retry', 'an ENV_NOT_READY routes to the env-up retry gate');
  // the ingest maps the process return to those events (order-significant, keyed on uja_result)
  const eq = (result, expected) => {
    const got = engine.applyIngest(CHARTER, 'user-journey-acceptance', result);
    assert(JSON.stringify(got) === JSON.stringify(expected), `${JSON.stringify(result)} → expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  };
  eq({ uja_result: 'PASS' }, ['evt:journey.passed']);
  eq({ uja_result: 'FAIL' }, ['evt:journey.failed']);
  eq({ uja_result: 'ENV_NOT_READY' }, ['evt:journey.env_not_ready']);
});

test('charter v6: awaiting_journey_fix is a human gate with an owner.resume→implementing re-drive + owner.close exit', () => {
  const g = CHARTER.states.awaiting_journey_fix;
  assert(g && g.meta.autonomy === 'human-gate', 'awaiting_journey_fix must be a human gate');
  assert(g.on['evt:owner.resume'].target === 'implementing', 'the owner resume re-drives the fix through implementing');
  assert(g.on['evt:owner.close'].target === 'closed_without_runtime', 'a parked line must always have an owner.close exit');
  assert(engine.deriveResumeEvent(CHARTER, 'awaiting_journey_fix') === 'evt:owner.resume', 'the gate resume-event is owner.resume');
});

test('DEPLOY-GATE-SAFETY analogue: journey_acceptance resume-event is a SAFE owner.close, never a journey-result event', () => {
  // journey_acceptance is auto at L1, but an L0 override could human-gate it; the engine would then
  // auto-append a PA whose resume-event is deriveResumeEvent()'s keys[0] fallback. If that were
  // evt:journey.passed, an owner flipping the PA + `pa-scan --tick` would mark the feature DONE
  // WITHOUT a journey run (pa-scan bypasses the DEF-3 guard). The charter orders owner.close first so
  // the fallback is a safe close — the same fix as deploying_staging (DEC-DEV-0198).
  const resume = engine.deriveResumeEvent(CHARTER, 'journey_acceptance');
  assert(!/^evt:journey\./.test(resume),
    `journey_acceptance resume-event must NOT be a journey-result event (a stray pa-scan would false-ship); got ${resume}`);
  assert(resume === 'evt:owner.close', `journey_acceptance resume-event must be the safe owner.close fallback; got ${resume}`);
  assert(CHARTER.states.journey_acceptance.on['evt:owner.close'].target === 'closed_without_runtime',
    'evt:owner.close on journey_acceptance must target closed_without_runtime');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
