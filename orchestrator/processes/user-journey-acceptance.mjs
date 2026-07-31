export const meta = {
  name: 'user-journey-acceptance',
  description: 'Orchestrator P8 — the user-journey acceptance gate AFTER a staging deploy (E.B DEPLOYED), the last check before `done`. It drives DETERMINISTIC Playwright browser journeys (tests/uja/*.spec.ts) against the live staging URL with a realistic user simulation, and answers the question P7 cannot: "does the FIRST user touch actually work?" (the live precedent: P6/P7/deploy all green, yet the pilot post-login hit a 404 — HTTP-liveness ≠ a working journey). Preflight is a Definition-of-Readiness check (Playwright equipped? journeys authored — incl. NEGATIVE access journeys neg-*.spec.ts from the RPM Access Matrix? staging 2xx? a DoD run on a realistic input profile?) → an honest ENV_NOT_READY with a DoR hint when not; the run + verdict are read through the deterministic uja-report.cjs lib — no LLM judgment. Implementer deviations forwarded from P5/P6 are DISCLOSED in the verdict. A VISUAL-CONFORMANCE leg then asks what green journeys cannot answer — is there a captured screenshot for EVERY designed screen state (each MK Screen Inventory `SI-<n>`) of every has_ui feature in the release scope, or an EXPLICIT declared skip? — and on a Release-DoD run an INCOMPLETE (or an unavailable leg) HARD-BLOCKS to ENV_NOT_READY instead of shipping un-evidenced screens (DEC-DEV-0225; neg-leg + full design-state rule — DEC-DEV-0230; realistic-input DoD leg + deviations disclosure — DEC-DEV-0231; visual-conformance gate — DEC-DEV-0237).',
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
 * VISUAL CONFORMANCE (DEC-DEV-0237, meta-feedback #5 — the third leg): green journeys prove the flow
 * WORKS; they say nothing about whether the designed SCREENS were built. RL DoD категория 5 already
 * called the P8 screenshots "visual-conformance evidence" — but nothing checked that the evidence
 * COVERS the design, so a has_ui feature could ship with half its states never seen (the pilot's
 * "designed — not built — invisible to acceptance" class, finding #8, survived three green UJA runs).
 * The leg is deterministic and lives in the SAME lib: `uja-report.cjs visual` intersects each has_ui
 * FM's active MK Screen Inventory (`SI-<n>` rows) with the files under <artifacts>/visual/<MK-id>/ and
 * with the DECLARED designed-but-unbuilt skips in tests/uja/visual-skips.json. It does NOT diff pixels
 * against the mockup (an automatic MK-diff is v1.1) — the owner's reality↔MK review is RECORDED one
 * layer over, in /product:impl-sync (impl_sync.visual_review, V-23). MODE: hard on a DoD confirmation
 * run (INCOMPLETE or an unavailable leg ⇒ ENV_NOT_READY, never a silent PASS), disclosure otherwise.
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
// DEC-DEV-0237 — the VISUAL-CONFORMANCE leg (meta-feedback #5): the release scope this acceptance
// covers. `feature` is a single-feature lens; `features` is the full scope a DoD run must know, because
// visual conformance is judged PER has_ui FEATURE (its MK Screen Inventory × the captured screenshots).
// A DoD run that cannot name its scope cannot judge it — that is a DoR gap, not a pass (see the gate below).
const FEATURES = (Array.isArray(A.features) ? A.features
  : (typeof A.features === 'string' && A.features ? A.features.split(',') : (FEATURE ? [FEATURE] : [])))
  .map((f) => String(f).trim()).filter(Boolean)

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
    // DEC-DEV-0237 — the visual-conformance leg, relayed from `uja-report.cjs visual` in the SAME
    // transport step. NOT `required` (same precedent as negative_present): a target still carrying a
    // pre-0237 uja-report.cjs cannot answer, and must degrade to an honest gap — not a schema error.
    visual_evidence: { type: ['string', 'null'] },             // COMPLETE | COMPLETE_WITH_SKIPS | INCOMPLETE | N/A | null (lib too old / could not run)
    visual_mk_scope: { type: 'array', items: { type: 'object' } },  // [{ mk, feature, si_total, si_covered[], si_missing[], si_skipped[], evidence_dir }]
    visual_reasons: { type: 'array', items: { type: 'string' } },
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
    // DEC-DEV-0237 — the same authoring rule the run prompt carries, repeated here because THIS is the
    // note the owner reads when the gap IS the visual evidence (a hint that names no path is not a hint).
    `When a reason concerns VISUAL evidence, carry the authoring rule verbatim into the entry: "every designed screen state is CAPTURED — each MK Screen Inventory row \`SI-<n>\` is screenshotted by the journey to \`${ARTIFACTS_DIR}/visual/<MK-id>/SI-<n>.png\` (a suffix is fine: SI-3-empty-state.png; .jpg/.jpeg/.webp also count); a state that is DESIGNED BUT NOT BUILT is an EXPLICIT entry in \`${JOURNEYS_DIR}/visual-skips.json\` ([{ mk, si, reason }] — a skip without a reason does NOT count), never silence". Do NOT capture placeholder/blank screenshots to close a visual gap — that is fabricating evidence. ` +
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
  // DEC-DEV-0237 (visual leg, pre-run half): a DoD confirmation run MUST know its release scope —
  // visual conformance is judged per has_ui FEATURE (MK Screen Inventory × captured screenshots), so
  // with an empty features[] the gate cannot tell "no UI in this release" from "nobody told me".
  // Blocking BEFORE the run also saves the real-vendor spend of journeys that could not be judged anyway.
  ...(DOD_RUN && !FEATURES.length
    ? ['this is a Release-DoD confirmation run but no features[] was supplied — a DoD run cannot judge VISUAL conformance without knowing the release scope (which features are has_ui, hence which MK Screen Inventories the screenshots must cover; DEC-DEV-0237). DoR: pass args.features (the FM-ids in this release) and re-run. An unknown scope is could-not-judge, never a pass.'] : []),
]
if (!playwrightPresent || !journeysPresent || !negativePresent || !STAGING_URL || !stagingTwoxx || (DOD_RUN && INPUT_PROFILE !== 'realistic') || (DOD_RUN && !FEATURES.length)) {
  await recordDoRGap(dorReasons)
  log(`P8 ENV_NOT_READY: DoR gap (${dorReasons.length} reason(s)) — recorded, routed to owner. Not running journeys.`)
  phase('Report')
  return {
    feature: FEATURE || null,
    features: FEATURES,                                      // DEC-DEV-0237: the release scope the visual leg judges against
    staging_url: STAGING_URL || null,
    uja_result: 'ENV_NOT_READY',                             // could-not-judge (DoR gap) — routes to a re-run, NEVER to `done`
    journeys_total: journeys.length,
    journeys_passed: 0,
    journeys_failed: [],
    specs_skipped: [],
    artifacts_dir: null,
    visual_evidence: null,                                   // DEC-DEV-0237: the journeys never ran ⇒ there is no visual evidence to judge (null ≠ COMPLETE)
    visual: null,
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
  // DEC-DEV-0237 — the VISUAL-CONFORMANCE leg, relayed by the SAME transport (no new agent: this is
  // another deterministic lib read, and a second agent would only add a hop + a model pin to drift).
  `4) VISUAL-CONFORMANCE leg (DEC-DEV-0237) — does the run leave a screenshot for every DESIGNED screen state? Run it through the SAME deterministic lib and relay ITS JSON verbatim too:\n` +
  `   \`node ${UJA_LIB} visual --root ${PROJECT_ROOT} --features ${FEATURES.join(',')} --artifacts-dir ${ARTIFACTS_DIR} --journeys-dir ${JOURNEYS_DIR}\`\n` +
  `   Add its fields to the object you return, under these EXACT keys (verbatim values, namespaced so they do not collide with the parse output): \`visual_evidence\` = its visual_evidence string (COMPLETE | COMPLETE_WITH_SKIPS | INCOMPLETE | N/A), \`visual_mk_scope\` = its mk_scope array, \`visual_reasons\` = its reasons array. Again a TRANSPORT: do NOT judge coverage yourself, do NOT open the screenshots, do NOT re-derive the lib's verdict.\n` +
  `   ⚠ If that command FAILS because the lib has no \`visual\` subcommand (an older uja-report.cjs in this target), do NOT improvise a substitute check and do NOT omit the fields: return \`visual_evidence: null\` and put the exact error text in \`visual_reasons\`. A null is an honest "could not judge"; a fabricated COMPLETE would be exactly the false green this gate exists to prevent.\n` +
  `   📐 AUTHORING RULE (what the journeys must do, for the note you leave if evidence is missing): every designed screen state is CAPTURED — each MK Screen Inventory row \`SI-<n>\` is screenshotted to \`${ARTIFACTS_DIR}/visual/<MK-id>/SI-<n>.png\` (a suffix is fine: SI-3-empty-state.png; .jpg/.jpeg/.webp also count); a state that is DESIGNED BUT NOT BUILT is an EXPLICIT entry in \`${JOURNEYS_DIR}/visual-skips.json\` ([{ mk, si, reason }] — a skip without a reason does NOT count), never silence.\n` +
  `🚫 CAPTURE-DON'T-FIX: if a journey fails, that is the RESULT — do NOT patch the app, retry until green, or comment out the failing step, and do NOT commit anything. If \`npx playwright test\` cannot run at all (Playwright not actually installed, staging unreachable mid-run), say so and relay the lib's ENV_NOT_READY on the (missing/empty) report — do NOT fabricate a verdict. The same holds for the visual leg: never hand-place, rename, or blank-capture files under ${ARTIFACTS_DIR}/visual/ to make the coverage look complete — a missing screenshot is the RESULT.`,
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

// ---- the VISUAL-CONFORMANCE leg (DEC-DEV-0237) ------------------------------------------------
// Green journeys prove the flow WORKS; they do not prove the designed SCREENS exist. The pilot's
// "designed — not built — invisible to acceptance" class (finding #8) survived three green UJA runs
// precisely because nothing checked the screenshots against the MK Screen Inventory. This leg does.
// It is HARD only on a DoD confirmation run (the release gate): elsewhere it DISCLOSES.
const visualEvidence = (verdict && typeof verdict.visual_evidence === 'string' && verdict.visual_evidence) || null
const visualMkScope = (verdict && verdict.visual_mk_scope) || []
const visualReasons = (verdict && verdict.visual_reasons) || []
// null = the leg could not answer at all (a pre-0237 uja-report.cjs in the target, or the command
// failed). On a DoD run that is NOT a pass — it is an un-judged release gate, i.e. a DoR gap.
const visualBlocks = DOD_RUN && (visualEvidence === 'INCOMPLETE' || visualEvidence === null)
const visualBlockReasons = visualBlocks
  ? visualReasons.concat([visualEvidence === null
    ? `the visual-conformance leg returned NOTHING (visual_evidence: null) — the target's uja-report.cjs has no \`visual\` subcommand (pre-DEC-DEV-0237) or the command failed. A release-DoD run cannot be judged without it: update the ecosystem in the target (\`/ecosystem:update\`) and re-run. Could-not-judge, NOT a pass.`
    : `visual_evidence=INCOMPLETE on a Release-DoD confirmation run — designed screen states carry no captured evidence and no declared skip (DEC-DEV-0237). DoR: capture the missing states to ${ARTIFACTS_DIR}/visual/<MK-id>/SI-<n>.png, or declare each designed-but-unbuilt state in ${JOURNEYS_DIR}/visual-skips.json with a reason, then re-run. A DoD that ships un-evidenced screens is the "designed — not built — invisible to acceptance" class (pilot finding #8).`])
    .concat([`⚠ WHAT TO ACTUALLY FIX: the missing thing is EVIDENCE, not the environment — prepare the evidence (capture the missing SI screenshots under ${ARTIFACTS_DIR}/visual/<MK-id>/ or declare each designed-but-unbuilt state as a reasoned skip in ${JOURNEYS_DIR}/visual-skips.json) and re-run P8. The route is unchanged (ENV_NOT_READY → runtime_gate_retry → \`evt:env.up\` once the evidence is ready): the verdict says "could not judge", so do NOT go debugging a staging environment that is already up.`])
  : []
// The final acceptance verdict: a blocked visual leg on a DoD run degrades the outcome to
// ENV_NOT_READY (could-not-judge ⇒ re-run), NEVER to a silent PASS, and never to FAIL (nothing about
// the journeys broke — the EVIDENCE is missing, which routes to fixing the suite, not the app).
// A real FAIL is NOT masked, though: the charter routes on uja_result, so overwriting FAIL would send
// the owner to `runtime_gate_retry` ("bring the env up") while the app is actually broken — the sharper
// signal must win. The property this leg owns is narrower and still intact: nothing SHIPS (→ `done`)
// over un-evidenced screens, and only a PASS ships. The gap is recorded either way (PA + disclosures).
const finalResult = (visualBlocks && ujaResult !== 'FAIL') ? 'ENV_NOT_READY' : ujaResult
log(`P8 visual-conformance: ${visualEvidence || 'null (leg unavailable)'}${visualMkScope.length ? ` over ${visualMkScope.length} MK(s)` : ''}${visualBlocks ? ' — HARD BLOCK on this DoD run ⇒ ENV_NOT_READY' : ''}`)

// ---- Phase 3: Report — the two-leg contract (verdict + evidence + disclosures) ----------------
phase('Report')
// A zero-journey run comes back ENV_NOT_READY from the lib (the zero-evidence rule) — record it as a
// DoR gap too, so a gate never silently "passes" having exercised nothing.
if (ujaResult === 'ENV_NOT_READY') {
  await recordDoRGap(verdictReasons.length ? verdictReasons : ['the journey run produced no judgeable report (0 journeys or an unparseable report) — DoR: author/repair journeys and re-run'])
} else if (visualBlocks) {
  // (else-if: when the lib already said ENV_NOT_READY the gap is recorded above — one PA per run)
  await recordDoRGap(visualBlockReasons)
}
return {
  feature: FEATURE || null,
  features: FEATURES,                                        // DEC-DEV-0237: the release scope the visual leg judged
  staging_url: STAGING_URL || null,
  uja_result: finalResult,                                   // PASS | FAIL | ENV_NOT_READY — the outcome the charter routes on (a blocked visual leg on a DoD run degrades PASS → ENV_NOT_READY)
  journeys_total: journeysTotal,
  journeys_passed: journeysPassed,
  journeys_failed: journeysFailed,                           // [{ journey, failing[] }] — the failing journeys, surfaced (capture-don't-fix)
  specs_skipped: specsSkipped,                               // [{ journey, skipped[] }] — designed-but-unbuilt states, disclosed EXPLICITLY (DEC-DEV-0230), never silent
  artifacts_dir: artifactsDir,                               // step screenshots / trace — the visual-conformance evidence for owner review vs MK
  visual_evidence: visualEvidence,                           // DEC-DEV-0237: COMPLETE | COMPLETE_WITH_SKIPS | INCOMPLETE | N/A | null (leg unavailable)
  visual: (visualEvidence || visualMkScope.length)           // the per-MK matrix: which designed SI states are covered / missing / declared-skipped
    ? { mk_scope: visualMkScope, reasons: visualReasons }
    : null,
  input_profile: INPUT_PROFILE,                              // DEC-DEV-0231 (2.5): 'realistic' is what RL DoD категория 3 requires of the DoD run — auditable from run.json
  dod_run: DOD_RUN,
  concerns: CONCERNS,                                        // DEC-DEV-0231 (2.2): forwarded implementer deviations — disclosed here, not only at the GO-gate
  // readiness answers "was this acceptance judgeable?", uja_result answers "what happened" — so a
  // visual block shows up here even when a FAIL keeps the routing verdict (the two are not the same question)
  readiness: (finalResult === 'ENV_NOT_READY' || visualBlocks) ? 'ENV_NOT_READY' : 'READY',
  readiness_reasons: ujaResult === 'ENV_NOT_READY' ? verdictReasons : visualBlockReasons,
  disclosures: verdictReasons
    .concat(ujaResult === 'FAIL' ? ['a FAILED journey is the first-user-touch breaking (the P7-green-but-404 class) — route to a P5/P6 re-drive (awaiting_journey_fix); this gate does not remediate.'] : [])
    .concat(specsSkipped.length ? [`${specsSkipped.length} journey file(s) carry SKIPPED specs — each skip must map to a designed-but-unbuilt state and ESCALATE to the owner (the "designed — not built — invisible to acceptance" class, pilot finding #8); a skip with no such mapping is a gap in the suite.`] : [])
    .concat(CONCERNS.length ? [`${CONCERNS.length} implementer deviation(s)/concern(s) declared at impl (DEC-DEV-0231): ${CONCERNS.map((c) => (typeof c === 'string' ? c : `${c.task || ''}: ${c.concern || ''}`)).join(' | ')} — a PASS over a declared deviation is PASS-with-caveats; each deviation needs owner ratification (RL DoD п.5).`] : [])
    .concat(DOD_RUN ? [`DoD run on input_profile='${INPUT_PROFILE}' — RL DoD категория 3 reads this field; only 'realistic' satisfies the first-release DoD (владелец 2026-07-23).`] : [])
    // DEC-DEV-0237: the visual leg's own reasons ride in the disclosures — a per-SI gap must be
    // readable from run.json alone, not only from the PA note the DoD block writes.
    .concat(visualReasons)
    .concat([`visual-conformance: per-SI evidence under ${artifactsDir}/visual/<MK>/SI-n → owner review is RECORDED via /product:impl-sync (impl_sync.visual_review, V-23); an automatic MK-diff is v1.1`
      + ` — verdict: ${visualEvidence || 'null (leg unavailable — pre-DEC-DEV-0237 uja-report.cjs in the target)'}${DOD_RUN ? '' : ' (disclosed here; the HARD block applies on a DoD confirmation run)'}.`]),
  run_id: RUN_ID || null,
}
