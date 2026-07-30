export const meta = {
  name: 'user-journey-acceptance',
  description: 'Orchestrator P8 — the user-journey acceptance gate AFTER a staging deploy (E.B DEPLOYED), the last check before `done`. It drives DETERMINISTIC Playwright browser journeys (tests/uja/*.spec.ts) against the live staging URL with a realistic user simulation, and answers the question P7 cannot: "does the FIRST user touch actually work?" (the live precedent: P6/P7/deploy all green, yet the pilot post-login hit a 404 — HTTP-liveness ≠ a working journey). Preflight is a Definition-of-Readiness check (Playwright equipped? journeys authored — incl. NEGATIVE access journeys neg-*.spec.ts from the RPM Access Matrix? staging 2xx? a DoD run on a realistic input profile?) → an honest ENV_NOT_READY with a DoR hint when not; the run + verdict are read through the deterministic uja-report.cjs lib — no LLM judgment. Implementer deviations forwarded from P5/P6 are DISCLOSED in the verdict (DEC-DEV-0225; neg-leg + full design-state rule — DEC-DEV-0230; realistic-input DoD leg + deviations disclosure — DEC-DEV-0231).',
  phases: [
    { title: 'Preflight' },
    { title: 'Run' },
    { title: 'Report' },
  ],
}

/*
 * Orchestrator process P8 `user-journey-acceptance` — build DEC-DEV-0225 (owner decision 2026-07-22:
 * final testing with a realistic user simulation becomes a mandatory acceptance leg before `done`).
 *
 * WHY P8: the fabric line went `deploying_staging` (DEPLOYED × READY, healthcheck 2xx) → `done`
 * (charter v5). But a green healthcheck is HTTP-liveness, not a working USER JOURNEY. The live
 * precedent on the pilot: P6 GO, P7 READY_TO_SMOKE, deploy DEPLOYED + a 2xx /health — and the very
 * first user touch was broken (post-login 404, no home page). P7 only pings liveness
 * (runtime-readiness.cjs), the DoD had no journey leg, and the Design Module never promised to check
 * implementation↔MK. P8 closes that gap: it inserts a browser user-journey gate between the deploy
 * and `done`, so "shipped" means "a real user can walk the flow", not "the process answered a ping".
 *
 * TOOL (owner approve after research, 2026-07-22): DETERMINISTIC Playwright npm (`@playwright/test`) —
 * journey scripts with real assertions, reproducible verdicts. Playwright MCP is a LATER unit (its
 * download tool is gone — closed-not-fixed issue #154 — and its assertions are weaker). Rejected for
 * v0 core: Playwright MCP as the driver; Stagehand (silent cache-failure + per-action LLM cost);
 * browser-use (exploratory, non-deterministic); Chrome DevTools MCP (debugging-first, no diff).
 *
 * TWO LEGS (mirrors P7 / E.B — a deterministic detect/readiness leg here, a substrate-gated
 * execution leg that runs only against a live staging target):
 *   READINESS (deterministic) — uja-report.cjs::assessPreflight: is Playwright installed in the
 *     target? are journeys authored at the convention path (tests/uja/*.spec.ts)? Plus a live
 *     staging healthcheck (2xx?). Any gap ⇒ uja_result: ENV_NOT_READY with a DoR hint
 *     (`/integrator:add playwright`, "author journeys from NM") — DISCLOSED + tracked, NEVER faked.
 *   EXECUTION (substrate-gated) — `npx playwright test tests/uja --reporter=json` headless against
 *     the staging URL, captured to a report file (even on non-zero exit), then reduced to a verdict
 *     by uja-report.cjs::parse — DETERMINISTICALLY, no LLM judgment. A LIVE grade needs a real
 *     DEPLOYED staging target (VM-gated), like the E.B live axis.
 *
 * THE ZERO-EVIDENCE RULE (the load-bearing safety property — inherited from the "false DEPLOYED"
 * lesson, DEC-DEV-0203): a report with 0 journeys is NOT a PASS. The lib maps empty/unparseable →
 * ENV_NOT_READY (could-not-judge), so a gate never goes green having exercised nothing.
 *
 * BUDGET GUARD (autonomy note): staging journeys are read-mostly and reversible ⇒ the charter cell
 * is `auto`. BUT a journey can create REAL jobs on the deployed app (real-vendor spend). The mitigation
 * is NOT a floor — it is a DoR contract: journeys MUST use MINIMAL fixtures (a throwaway/seed account,
 * the smallest input that exercises the flow), never a production-scale run. prod journeys are OUT OF
 * SCOPE for v0 (this process is staging-only; prod stays behind the autonomy floor).
 *
 * CAPTURE-DON'T-FIX: the run agent SURFACES a failed journey (the report carries the failing specs +
 * errors) — it does NOT remediate, edit code, or re-run to "get green". A FAIL routes to
 * `awaiting_journey_fix` for a P5/P6 re-drive (charter). Nothing about the substrate is repaired.
 *
 * VM-GATED: the real `npx playwright test` against a live staging deploy runs only on the VM staging
 * target. It lives INSIDE agent() bodies (prompts), never executed repo-side. Repo-side ships fully
 * structured + wiring-tested (user-journey-acceptance-wiring.test.cjs) + a unit-tested verdict parser
 * (uja-report.test.cjs). The live axis is the VM-restore gate.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script. Every lib run
 * / probe / playwright run / PA write happens INSIDE an agent(); inputs via args.
 *
 * DETERMINISM MODEL (SPEC §2): Layer-1 SKELETON = the preflight→(gate|run)→report FSM. Layer-3 GATE =
 * uja-report.cjs (deterministic .cjs, run by a transport agent) — there is NO Layer-2 JUDGMENT here
 * (v0 has no LLM-graded step; the verdict is a byte-reduction over the report).
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent (or the dispatcher's Workflow call)
// may pass a JSON string. (Keep the comment ABOVE this line — the args-parsing smoke evals it.)
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURE = A.feature || ''                                 // optional lens: which feature this acceptance covers (FM-id)
const STAGING_URL = A.stagingUrl || A.baseUrl || ''             // the live staging URL journeys run against (from the deploy result or env) — REQUIRED for the run
const JOURNEYS_DIR = A.journeysDir || 'tests/uja'               // convention: tests/uja/*.spec.ts in the product repo
const PROJECT_ROOT = A.root || '.'                              // the target project checkout (where package.json + tests/uja live)
const UJA_LIB = A.ujaLib || '.claude/orchestrator/lib/uja-report.cjs'  // DEC-DEV-0225: the deterministic preflight + verdict core
const ARTIFACTS_DIR = A.artifactsDir || 'test-results'          // where Playwright writes step screenshots / trace (the visual-conformance evidence)
const RUN_ID = A.runId || ''                                    // the ledger bracket run-id, forwarded (evidence handle; the harness may not read a clock/FS)
const CONCERNS = A.concerns || []                               // DEC-DEV-0231 (2.2): implementer deviations forwarded from P5/P6 — disclosed in THIS verdict too, not only at the GO-gate
// DEC-DEV-0231 (2.5) — the realistic-input DoD leg (owner directive 2026-07-23, RUN-B.36 / feedback A4):
// a DoD-confirmation run of a FIRST release must exercise a REALISTIC load ("видео 30 мин – 2 ч"),
// not the 5-second dev fixtures — a 5-sec pass tells the owner nothing about the real pipeline
// (Whisper ~25MB chunking, cost, duration). dodRun marks the run as the release-DoD confirmation;
// inputProfile declares what the journeys feed the app. dev profile on a DoD run ⇒ an honest DoR gap.
const DOD_RUN = !!A.dodRun                                      // this run is the Release-DoD confirmation run (RL DoD категория 3)
const INPUT_PROFILE = A.inputProfile || 'dev'                   // 'dev' (minimal fixtures) | 'realistic' (DoD-grade load, e.g. видео 30 мин – 2 ч)

// ---- schemas ---------------------------------------------------------------
const PREFLIGHT_SCHEMA = {
  type: 'object',
  required: ['playwright_present', 'journeys_present'],
  properties: {
    playwright_present: { type: 'boolean' },                   // @playwright/test dep OR a playwright.config.* on disk
    journeys_present: { type: 'boolean' },                     // ≥1 *.spec.ts under the journeys dir
    journeys: { type: 'array', items: { type: 'string' } },    // the journey spec files discovered
    negative_present: { type: 'boolean' },                     // ≥1 neg-*.spec.ts (RPM Access Matrix journeys) — DEC-DEV-0230; not `required` so an older lib degrades to a DoR gap, not a schema error
    negative_journeys: { type: 'array', items: { type: 'string' } },
    reasons: { type: 'array', items: { type: 'string' } },     // DoR hints for each missing piece
  },
}

const HEALTHCHECK_SCHEMA = {
  type: 'object',
  required: ['twoxx'],
  properties: {
    twoxx: { type: 'boolean' },                                // did the staging URL answer 2xx? (the journey has a live target)
    reachable: { type: 'boolean' },
    status_code: { type: ['number', 'null'] },
    observed: { type: 'string' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['uja_result'],
  properties: {
    uja_result: { type: 'string', enum: ['PASS', 'FAIL', 'ENV_NOT_READY'] },
    journeys_total: { type: 'number' },
    journeys_passed: { type: 'number' },
    journeys_failed: { type: 'array', items: { type: 'object' } },   // [{ journey, failing[] }]
    specs_skipped: { type: 'array', items: { type: 'object' } },     // [{ journey, skipped[] }] — explicit designed-but-unbuilt disclosures (DEC-DEV-0230), surfaced never silent
    artifacts_dir: { type: ['string', 'null'] },               // step screenshots / trace dir (visual-conformance evidence)
    reasons: { type: 'array', items: { type: 'string' } },
  },
}

// FB-LR-23 (parallel-worktree PA-id safety): shared instruction so every PA-write below targets the
// SINGLE canonical pending-actions file (the main checkout) + allocates ids from it — a worktree-local
// copy lets parallel runs collide PA-ids. Duplicated verbatim across the PA-emitting processes.
const PA_CANON = 'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '
  + 'one .git but have SEPARATE working trees, so a worktree-local `.claude/pending-actions.md` lets PA-ids collide '
  + 'across concurrent runs (two trees each mint the same PA-NNN). Resolve the SINGLE canonical file ONCE: run '
  + '`git worktree list --porcelain` and take the FIRST `worktree <path>` line (the main checkout, shared by every '
  + 'worktree) → `<that-path>/.claude/pending-actions.md`; if not inside a git worktree, fall back to '
  + '`.claude/pending-actions.md`. READ / SCAN / allocate the next PA-NNN (highest existing id + 1) / APPEND against '
  + 'THAT canonical file — never a worktree-local copy. Do NOT `git add` or commit the pending-actions file (it may '
  + 'live in another checkout; committing it from this worktree would write into a foreign tree) — leave it as '
  + 'working-tree state. '

// On an ENV_NOT_READY (a DoR gap: no Playwright / no journeys / staging down): record a NON-BLOCKING
// tracking entry with the exact DoR hint, routed to the owner/Integrator. Track it, never fabricate a pass.
const recordDoRGap = (reasons) =>
  agent(
    `The user-journey acceptance (P8) is ENV_NOT_READY: the target is not equipped to run browser journeys, OR the staging target is not up. This is a Definition-of-Readiness gap, NOT a journey failure.\n` +
    `Reasons (each already carries its remedy): ${JSON.stringify(reasons)}\n` +
    `Append a NON-BLOCKING tracking entry to the canonical pending-actions file: "P8 user-journey-acceptance could not run — DoR gap", listing each reason verbatim and its DoR hint (\`/integrator:add playwright\` when Playwright is missing; "author journeys at ${JOURNEYS_DIR}/*.spec.ts from the feature's NM covering the FULL design-state inventory — every MK Screen Inventory state incl. with-data, where a designed-but-unbuilt state is an EXPLICIT skip/ESCALATE, never silence" when journeys are missing; "author NEGATIVE access journeys at ${JOURNEYS_DIR}/neg-*.spec.ts from the RPM Access Matrix rows" when the suite is positive-only; "bring the staging target up and re-run" when the healthcheck was not 2xx). Route the owner (provisioning / journey authoring) — do NOT invent journeys or fake a pass. ` +
    PA_CANON +
    `Do NOT commit code. Return a one-line confirmation.`,
    { model: 'sonnet', phase: 'Report', label: 'dor-gap' },   // MDP: non-blocking PA tracking write (standard/mechanical)
  )

// ===========================================================================

// ---- Phase 1: Preflight — is the target EQUIPPED + is staging up? ----------
phase('Preflight')

// (a) DoR: Playwright installed + journeys authored — read DETERMINISTICALLY by the lib (the agent
// only RELAYS the JSON; "is Playwright equipped / are journeys present" are facts about the FS, not
// an LLM's reading). READ-ONLY.
const preflight = await agent(
  `Relay the DETERMINISTIC user-journey preflight. Run this via Bash and return its JSON VERBATIM:\n` +
  `node ${UJA_LIB} preflight --root ${PROJECT_ROOT} --journeys-dir ${JOURNEYS_DIR}\n` +
  `Return its { playwright_present, journeys_present, journeys, reasons } object EXACTLY as printed. ` +
  `🚫 READ-ONLY — you MEASURE readiness, you never REPAIR it: do NOT install Playwright, scaffold journeys, or create anything to improve the verdict — a missing piece is a DoR gap the process discloses honestly (that IS the job). You are a TRANSPORT, not a judge: do NOT re-derive or "sanity-check" the lib output.`,
  { model: 'sonnet', schema: PREFLIGHT_SCHEMA, phase: 'Preflight', label: 'uja-preflight' },   // MDP: deterministic-lib JSON relay (mechanical transport)
)
const playwrightPresent = !!(preflight && preflight.playwright_present)
const journeysPresent = !!(preflight && preflight.journeys_present)
const journeys = (preflight && preflight.journeys) || []
// DEC-DEV-0230 (hard DoR leg): a positive-only suite is NOT equipped — the pilot's cross-realm hole
// (#9) shipped behind three green UJA runs that never sent an admin cookie down a user route. An
// older uja-report.cjs (no negative_present field) degrades to false ⇒ an honest DoR gap.
const negativePresent = !!(preflight && preflight.negative_present)
const negativeJourneys = (preflight && preflight.negative_journeys) || []
const preflightReasons = (preflight && preflight.reasons) || []
log(`preflight: playwright=${playwrightPresent ? 'present' : 'MISSING'}, journeys=${journeysPresent ? `${journeys.length} present` : 'MISSING'}, negative=${negativePresent ? `${negativeJourneys.length} present` : 'MISSING'}${preflightReasons.length ? ` — ${preflightReasons.join('; ')}` : ''}`)

// (b) live staging healthcheck — the journeys need a live target answering 2xx. READ-ONLY: a down
// staging is EVIDENCE (ENV_NOT_READY), never something to bring up here (the deploy cell owns that).
const stagingUp = STAGING_URL
  ? await agent(
    `Healthcheck the staging target the user journeys will run against (READ-ONLY — capture-don't-fix).\n` +
    `URL: ${STAGING_URL}\n` +
    `GET the URL (or its /health path) and report whether it answered 2xx within a short window. Do NOT start, restart, or repair ANY service/container to coax a 2xx (no \`docker start\`, no \`systemctl start\`) — a down staging is EVIDENCE for an ENV_NOT_READY, not an obstacle to clear (the deploy cell brings staging up, not this gate). Return twoxx + reachable + status_code + observed.`,
    { model: 'sonnet', schema: HEALTHCHECK_SCHEMA, phase: 'Preflight', label: 'staging-healthcheck' },   // MDP: read-only live probe relay (mechanical transport)
  )
  : null
const stagingTwoxx = !!(stagingUp && stagingUp.twoxx)
if (!STAGING_URL) log('preflight: NO staging URL provided (args.stagingUrl / baseUrl) — cannot run journeys against a target')
else log(`preflight: staging ${STAGING_URL} → ${stagingTwoxx ? '2xx (live)' : `NOT 2xx (${(stagingUp && stagingUp.status_code) || 'unreachable'})`}`)

// ---- deterministic DoR gate: any missing piece ⇒ ENV_NOT_READY (never fake a pass) ------------
const dorReasons = [
  ...preflightReasons,
  // fallback when the target still carries a pre-neg-leg uja-report.cjs (its reasons[] then has no neg hint)
  ...(!negativePresent && !preflightReasons.some((r) => /neg-/.test(r))
    ? [`no NEGATIVE access journey (${JOURNEYS_DIR}/neg-*.spec.ts) — the suite is positive-only. DoR: author negative access journeys from the RPM Access Matrix rows (guest → protected; authenticated → /login, /signup; cross-realm: a realm-A session on realm-B routes, both directions).`] : []),
  ...(!STAGING_URL ? ['no staging URL supplied (args.stagingUrl / baseUrl) — the journeys have no live target to run against. DoR: forward the DEPLOYED staging URL from the deploy result, or set it in env.'] : []),
  ...(STAGING_URL && !stagingTwoxx ? [`staging ${STAGING_URL} did not answer 2xx (${(stagingUp && stagingUp.observed) || 'unreachable'}) — bring the staging target up and re-run (the deploy cell owns provisioning, not this gate).`] : []),
  ...(DOD_RUN && INPUT_PROFILE !== 'realistic'
    ? [`this is a Release-DoD confirmation run but inputProfile='${INPUT_PROFILE}' — a DoD run MUST exercise a realistic load (owner directive 2026-07-23 / DEC-DEV-0231: видео 30 мин – 2 ч; 5-сек фикстуры — только dev). DoR: prepare realistic fixtures, re-run with inputProfile:'realistic'. A 5-sec pass proves nothing about the real pipeline (chunking, cost, duration).`] : []),
]
if (!playwrightPresent || !journeysPresent || !negativePresent || !STAGING_URL || !stagingTwoxx || (DOD_RUN && INPUT_PROFILE !== 'realistic')) {
  await recordDoRGap(dorReasons)
  log(`P8 ENV_NOT_READY: DoR gap (${dorReasons.length} reason(s)) — recorded, routed to owner. Not running journeys.`)
  phase('Report')
  return {
    feature: FEATURE || null,
    staging_url: STAGING_URL || null,
    uja_result: 'ENV_NOT_READY',                             // could-not-judge (DoR gap) — routes to a re-run, NEVER to `done`
    journeys_total: journeys.length,
    journeys_passed: 0,
    journeys_failed: [],
    specs_skipped: [],
    artifacts_dir: null,
    input_profile: INPUT_PROFILE,                            // DEC-DEV-0231 (2.5): what the journeys feed the app — RL DoD reads this from run.json
    dod_run: DOD_RUN,
    concerns: CONCERNS,                                      // DEC-DEV-0231 (2.2): forwarded implementer deviations, carried even on a DoR gap
    readiness: 'ENV_NOT_READY',
    readiness_reasons: dorReasons,                           // the DoR hints — the gate must be auditable from run.json alone
    disclosures: dorReasons.concat(['readiness=ENV_NOT_READY — the journeys could not be RUN/judged; this is NOT a journey FAIL. Remedy: close the DoR gap (equip Playwright / author journeys incl. neg-*.spec.ts / bring staging up / realistic input on a DoD run) and re-run.']),
    run_id: RUN_ID || null,
  }
}

// ---- Phase 2: Run — drive the Playwright journeys against staging (VM-GATED) ------------------
phase('Run')
// One transport agent: run the journeys headless against the staging URL, capture the JSON report to
// a file (EVEN on a non-zero playwright exit — a FAIL still writes a report), then reduce it to the
// verdict through the DETERMINISTIC lib. NO LLM judgment: the verdict is a byte-reduction over the
// report; the agent transports it. Capture-don't-fix.
const verdict = await agent(
  `Run the user-journey acceptance suite against the LIVE staging deploy, then relay the DETERMINISTIC verdict (VM-gated; capture-don't-fix — SURFACE a failed journey, do NOT remediate/re-run to get green/edit code).\n` +
  `1) Point Playwright at the staging URL: ${STAGING_URL} (export it as PLAYWRIGHT_BASE_URL, or pass it however the project's playwright config reads the base URL). ` +
  (INPUT_PROFILE === 'realistic'
    ? `⚠ REALISTIC-INPUT PROFILE (DoD leg, DEC-DEV-0231): this run MUST exercise the realistic load the release will face (owner directive: видео 30 мин – 2 ч, not the 5-sec dev fixtures) — the point is to prove the REAL pipeline (chunking, cost, duration). Still ONE realistic pass per journey on a throwaway/seed account: do NOT loop, do NOT hammer paid endpoints beyond the single realistic pass.\n`
    : `⚠ BUDGET GUARD (real-vendor spend): the journeys may create REAL jobs on the deployed app — they MUST use MINIMAL fixtures (a throwaway/seed account, the smallest input that exercises the flow). Do NOT run a production-scale pass, do NOT loop, do NOT hammer paid endpoints.\n`) +
  `2) Run HEADLESS with the JSON reporter, capturing the report to a file even when tests fail (playwright exits non-zero on a failing journey but STILL writes the report — capture it):\n` +
  `   \`npx playwright test ${JOURNEYS_DIR} --reporter=json > ${ARTIFACTS_DIR}/uja-report.json\` (create ${ARTIFACTS_DIR} first if absent; keep the step screenshots / trace Playwright writes under ${ARTIFACTS_DIR} — that is the visual-conformance evidence for owner review against the MK).\n` +
  `3) Reduce the report to the verdict through the DETERMINISTIC lib and relay its JSON VERBATIM:\n` +
  `   \`node ${UJA_LIB} parse --report ${ARTIFACTS_DIR}/uja-report.json\`\n` +
  `   Return its { uja_result, journeys_total, journeys_passed, journeys_failed, artifacts_dir, reasons } object EXACTLY as printed. You are a TRANSPORT — do NOT judge PASS/FAIL yourself, do NOT re-interpret the report; the lib decides (PASS | FAIL | ENV_NOT_READY, where a 0-journey report is ENV_NOT_READY, never a PASS).\n` +
  `🚫 CAPTURE-DON'T-FIX: if a journey fails, that is the RESULT — do NOT patch the app, retry until green, or comment out the failing step, and do NOT commit anything. If \`npx playwright test\` cannot run at all (Playwright not actually installed, staging unreachable mid-run), say so and relay the lib's ENV_NOT_READY on the (missing/empty) report — do NOT fabricate a verdict.`,
  { model: 'sonnet', schema: VERDICT_SCHEMA, phase: 'Run', label: 'run-journeys' },   // MDP: run playwright + relay the DETERMINISTIC lib verdict (mechanical transport — no LLM judgment)
)
const ujaResult = (verdict && verdict.uja_result) || 'ENV_NOT_READY'
const journeysTotal = (verdict && verdict.journeys_total) || 0
const journeysPassed = (verdict && verdict.journeys_passed) || 0
const journeysFailed = (verdict && verdict.journeys_failed) || []
const specsSkipped = (verdict && verdict.specs_skipped) || []
const artifactsDir = (verdict && verdict.artifacts_dir) || ARTIFACTS_DIR
const verdictReasons = (verdict && verdict.reasons) || []
log(`P8 verdict: ${ujaResult} (${journeysPassed}/${journeysTotal} journeys passed${journeysFailed.length ? `; failed: ${journeysFailed.map((j) => j && j.journey).join(', ')}` : ''})`)

// ---- Phase 3: Report — the two-leg contract (verdict + evidence + disclosures) ----------------
phase('Report')
// A zero-journey run comes back ENV_NOT_READY from the lib (the zero-evidence rule) — record it as a
// DoR gap too, so a gate never silently "passes" having exercised nothing.
if (ujaResult === 'ENV_NOT_READY') {
  await recordDoRGap(verdictReasons.length ? verdictReasons : ['the journey run produced no judgeable report (0 journeys or an unparseable report) — DoR: author/repair journeys and re-run'])
}
return {
  feature: FEATURE || null,
  staging_url: STAGING_URL || null,
  uja_result: ujaResult,                                     // PASS | FAIL | ENV_NOT_READY — the outcome the charter routes on
  journeys_total: journeysTotal,
  journeys_passed: journeysPassed,
  journeys_failed: journeysFailed,                           // [{ journey, failing[] }] — the failing journeys, surfaced (capture-don't-fix)
  specs_skipped: specsSkipped,                               // [{ journey, skipped[] }] — designed-but-unbuilt states, disclosed EXPLICITLY (DEC-DEV-0230), never silent
  artifacts_dir: artifactsDir,                               // step screenshots / trace — the visual-conformance evidence for owner review vs MK
  input_profile: INPUT_PROFILE,                              // DEC-DEV-0231 (2.5): 'realistic' is what RL DoD категория 3 requires of the DoD run — auditable from run.json
  dod_run: DOD_RUN,
  concerns: CONCERNS,                                        // DEC-DEV-0231 (2.2): forwarded implementer deviations — disclosed here, not only at the GO-gate
  readiness: ujaResult === 'ENV_NOT_READY' ? 'ENV_NOT_READY' : 'READY',
  readiness_reasons: ujaResult === 'ENV_NOT_READY' ? verdictReasons : [],
  disclosures: verdictReasons
    .concat(ujaResult === 'FAIL' ? ['a FAILED journey is the first-user-touch breaking (the P7-green-but-404 class) — route to a P5/P6 re-drive (awaiting_journey_fix); this gate does not remediate.'] : [])
    .concat(specsSkipped.length ? [`${specsSkipped.length} journey file(s) carry SKIPPED specs — each skip must map to a designed-but-unbuilt state and ESCALATE to the owner (the "designed — not built — invisible to acceptance" class, pilot finding #8); a skip with no such mapping is a gap in the suite.`] : [])
    .concat(CONCERNS.length ? [`${CONCERNS.length} implementer deviation(s)/concern(s) declared at impl (DEC-DEV-0231): ${CONCERNS.map((c) => (typeof c === 'string' ? c : `${c.task || ''}: ${c.concern || ''}`)).join(' | ')} — a PASS over a declared deviation is PASS-with-caveats; each deviation needs owner ratification (RL DoD п.5).`] : [])
    .concat(DOD_RUN ? [`DoD run on input_profile='${INPUT_PROFILE}' — RL DoD категория 3 reads this field; only 'realistic' satisfies the first-release DoD (владелец 2026-07-23).`] : [])
    .concat(['visual-conformance: the step screenshots / trace under ' + artifactsDir + ' are the owner-review evidence against the design MK (owner reviews reality↔MK; an automatic MK-diff is v1.1).']),
  run_id: RUN_ID || null,
}
