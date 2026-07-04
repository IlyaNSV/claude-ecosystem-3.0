export const meta = {
  name: 'consilium',
  description: 'Product D1b — decision-preparation jury for the completeness-loop\'s escalated decision-PAs (Autonomous Pipeline Vision, Epic D generalization, DEC-DEV-0145). The completeness-loop (complete-feature.mjs) escalates strategic/connected decisions to the canonical pending-actions ledger as plain PAs; this runner takes ONE already-escalated, FORK-SHAPED decision-PA (>=2 mutually-exclusive options) and prepares an owner decision by running a heterogeneous jury of Epic-A profile personas (architect/qa + ux only when the decision touches UI) that score the options INDEPENDENTLY from the RAW artifacts, then aggregates their verdicts DETERMINISTICALLY through the shared consilium-synth.cjs (matrix + rank + hard/soft-veto), surfaces a cross-lens integration note, and writes a recommendation package back into the SAME PA in place (PA-dedup). PREPARE-ONLY: the jury recommends, the OWNER ratifies — this never closes the PA, never edits a spec, never fabricates a missing option. Invoked by /product:consilium <PA-NNN>. It reuses the Orchestrator P2 synthesis primitive via the DEC-DEV-0145 --panel parameterization; it does NOT build a new aggregator.',
  phases: [
    { title: 'Load' },
    { title: 'Scope' },
    { title: 'Jury' },
    { title: 'Synthesize' },
    { title: 'Recommend' },
  ],
}

/*
 * Product process D1b `consilium` — the executable form of the Epic-D generalization
 * (DEC-DEV-0145 wave (C∥D); design in dev/ECOSYSTEM_VISION_BATCH_3.md §D1b/§D2). The
 * consilium PRIMITIVE (heterogeneous jury → deterministic matrix/rank/veto synthesis) was
 * already built and live-validated as the Orchestrator P2 `decide-architecture-foundation`
 * (DEC-DEV-0129/0135). This wave GENERALIZES it to the completeness-loop's decision
 * escalations rather than re-implementing the aggregator — the math lives ONCE in
 * orchestrator/lib/consilium-synth.cjs, parameterized by an injectable jury `panel`
 * (DEC-DEV-0145 D1a). Do NOT duplicate the synthesis here; this .mjs only orchestrates
 * the jury + transports the lib output.
 *
 * WHY A SEPARATE COMMAND, NOT INLINE-EVERY-WAVE (kickoff decision б): a jury on a single
 * connected decision LOSES to one good opinion unless it is a heterogeneous jury that
 * PREPARES the decision (~15x cost + groupthink otherwise, Vision D). So the completeness-
 * loop stays bounded + cheap (it escalates decisions to plain PAs), and THIS command is
 * invoked deliberately on an already-escalated fork-shaped PA. PA-in → recommendation-out,
 * mirroring the proven P2 pattern.
 *
 * PREPARE-ONLY (kickoff decision в; [[project_autonomy_obedience_balance]]): the jury
 * produces a recommendation + strength; the OWNER ratifies. Auto-proceed on confidence>=tau
 * is F2/L2, explicitly NOT this wave. This runner NEVER closes the PA, edits a spec, or
 * finalizes a decision — it updates the PA in place with a "jury recommendation — owner
 * ratifies" package (a proposal, never a resolution).
 *
 * HARD RAILS (enforced in CODE here, not just prose):
 *   R1. FORK-SHAPED GUARD (kickoff decision б / synth "requires >=2 options"): the PA must
 *       enumerate >=2 mutually-exclusive options. Fewer → HONEST REFUSAL before any jury
 *       spawn: report "not a fork — reformulate the options or leave it to the owner", and
 *       NEVER fabricate a second option (that would manufacture a decision the fork does not
 *       pose). This guard runs in code BEFORE the fan-out.
 *   R2. DECLARED SCOPE, NO SILENT FAN-OUT (§D2): the subject + the panel composition + the
 *       comparison axes are declared in the report BEFORE the jury spawns. A run whose scope
 *       cannot be assembled STOPS — it does not "guess" a decision into being.
 *   R3. HETEROGENEOUS PANEL BY ZONE (kickoff decision е / zone-routing 1:1): default panel is
 *       [architect-advisor, qa-advisor]; ux-advisor is added ONLY when the decision touches UI
 *       (has_ui, or a screen-decision-class category) — mirroring the conditional ux spawn in
 *       complete-feature.mjs (the zone-router's UI-lens gate). The whole panel is never fired
 *       by default.
 *   R4. RAW-SOURCE BRIEFS (FB-LR-31): each persona is handed the PA text + the artifact PATHS
 *       and reads the raw artifacts ITSELF — this brief deliberately does NOT paraphrase
 *       artifact bodies (a lossy paraphrase would hide the very trade-off the jury weighs).
 *   R5. CANONICAL AGENTTYPE, CRASH-SAFE SLOTS, BOUNDED RE-SPAWN (Epic A rail, mirrored from
 *       complete-feature.mjs): each persona spawns as its canonical subagent_type — NEVER a
 *       general-purpose fallback (a wrong-lens verdict is worse than a disclosed missing one).
 *       A dropped persona is bounded RE-SPAWNed ONCE (MAX_RESPAWN = 1); still null → the panel
 *       is marked incomplete and the recommendation carries panel_complete:false (degrade loud).
 *   R6. DETERMINISTIC SYNTHESIS (transport-only): the recommendation comes from CODE
 *       (consilium-synth.cjs), relayed VERBATIM. The agent is TRANSPORT only — it never
 *       re-scores or second-guesses the matrix/rank/veto.
 *   R7. INTEGRATION PASS IS SURFACING-ONLY (mirror DEC-DEV-0135): one reasoner reads all
 *       verdicts + the synth result for a cross-lens pattern (one lens's fact undercuts
 *       another's score) — it raises a DISCLOSURE, it NEVER changes recommended/strength.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1, mirrored from complete-feature.mjs / orchestrator/*):
 *   NO fs / Node API / Date.now() / Math.random() / new Date() in this script. Inputs only via
 *   `args`. Every ledger read, artifact read, persona, synth run, and PA write happens INSIDE an
 *   agent() via Bash. Personas run in parallel(); the PA write is a single sequential agent.
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect — never executed) +
 * tests/product/consilium-wiring.test.cjs (static invariants). /product:consilium dispatches
 * this via Workflow({scriptPath}); it falls back to inline prose if the path is unresolvable.
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent (or the /product:consilium
// dispatch) may pass a JSON string. Parse defensively, then read the fields.
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const PA_ID = A.pa_id || A.paId || ''                                    // required — the escalated decision-PA id (PA-NNN)
const FEATURE = A.feature || ''                                          // optional — the FM the decision belongs to (narrows the PA search)
const MAX_RESPAWN = 1                                                    // R5: bounded single re-spawn of a dropped persona

// consilium-synth.cjs resolution (R6): the deployed `.claude/`-prefixed location first (FB-LR-18),
// then the repo-form for a dev/worktree run — the SYNTH agent picks the first that exists under the
// anchored root (mirrors gap-classifier's deploy-vs-repo tolerance). Overridable via args.synth.
const SYNTH_CANDIDATES = A.synth
  ? [A.synth]
  : ['.claude/orchestrator/lib/consilium-synth.cjs', 'orchestrator/lib/consilium-synth.cjs']

// Consilium-eligible decision categories (gap-classifier.cjs SSOT): a jury only helps on a
// SEMANTIC / STRATEGIC fork. threshold/moscow/screen-decision/*-semantic are eligible; broken-ref /
// fm-status are NOT (a dangling ref or a status flip is not a fork to weigh) — surfaced as a caveat,
// while the HARD block stays the >=2-options fork guard (R1).
const ELIGIBLE_CATEGORIES = ['threshold', 'moscow', 'screen-decision', 'ic-semantic', 'br-semantic', 'sc-semantic']

// R1 refusal report (fork guard) — a well-formed envelope the caller surfaces, never a throw.
// Reused for the empty-pa_id guard and the <2-options guard so the caller always gets the same shape.
function refusal(reason, extra) {
  return Object.assign({
    pa_id: PA_ID,
    feature: FEATURE || null,
    decidable: false,
    panel: [],
    scope: null,
    recommended: null,
    strength: 'none',
    panel_complete: true,
    vetoed: [],
    soft_vetoed: [],
    integration_note: '',
    verdicts_count: 0,
    refused: true,
    reason,
    caveats: [reason],
  }, extra || {})
}

// FB-002 precedent: refuse target-less rather than scanning the ledger and guessing which PA.
if (!PA_ID) {
  log('HALT: empty pa_id — refusing to run. Pass args as an OBJECT, e.g. {pa_id:"PA-042"}.')
  return refusal('consilium: empty pa_id (pass {pa_id:"PA-NNN"} — the id of an already-escalated, fork-shaped decision-PA).')
}

// FB-LR-23 (parallel-worktree PA-id safety): every PA read/scan/write below targets the SINGLE
// canonical pending-actions file (the main checkout) — a worktree-local copy lets parallel runs
// collide PA-ids. Copied VERBATIM from the orchestrator P2/P4/P5/P6 + complete-feature processes
// (the PA read/write lives inside an agent prompt — there is no shared lib to import). Do NOT edit.
const PA_CANON = 'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '
  + 'one .git but have SEPARATE working trees, so a worktree-local `.claude/pending-actions.md` lets PA-ids collide '
  + 'across concurrent runs (two trees each mint the same PA-NNN). Resolve the SINGLE canonical file ONCE: run '
  + '`git worktree list --porcelain` and take the FIRST `worktree <path>` line (the main checkout, shared by every '
  + 'worktree) → `<that-path>/.claude/pending-actions.md`; if not inside a git worktree, fall back to '
  + '`.claude/pending-actions.md`. READ / SCAN / allocate the next PA-NNN (highest existing id + 1) / APPEND against '
  + 'THAT canonical file — never a worktree-local copy. Do NOT `git add` or commit the pending-actions file (it may '
  + 'live in another checkout; committing it from this worktree would write into a foreign tree) — leave it as '
  + 'working-tree state. '

// ---- schemas ---------------------------------------------------------------

const ANCHOR_SCHEMA = {
  type: 'object',
  required: ['root'],
  properties: {
    root: { type: 'string' },                          // the SINGLE anchored run root (FB-LR-28) — absolute run cwd
    synth: { type: 'string' },                         // the resolved consilium-synth.cjs path (first candidate that exists)
  },
}

// The decision-fork lifted from the PA (LOAD) — options are LIFTED, never invented (R1).
const FORK_SCHEMA = {
  type: 'object',
  required: ['options'],
  properties: {
    pa_id: { type: 'string' },
    subject: { type: 'string' },                       // what the decision is (1-2 sentences)
    category: { type: 'string' },                      // gap-classifier category (threshold/moscow/screen-decision/*-semantic/...)
    has_ui: { type: 'boolean' },                       // the decision touches UI (drives the ux-advisor gate, R3)
    options: {                                         // >=2 mutually-exclusive options the PA enumerates
      type: 'array',
      items: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
    artifact_refs: { type: 'array', items: { type: 'string' } },   // paths of the raw artifacts the personas must read (R4)
    source_excerpt: { type: 'string' },                // VERBATIM PA block + cited constraint lines (the ground truth)
    comparison_axes: { type: 'array', items: { type: 'string' } }, // the axes the options differ on (declared scope, R2)
    decidable: { type: 'boolean' },                    // false ⇒ <2 enumerated options
    note: { type: 'string' },                          // what is missing when not decidable
  },
}

// One persona verdict — the `prior` is the PERSONA NAME (the active panel passed to --panel), so
// consilium-synth.isPriorVerdict() counts it. Same structured shape as the P2 ArchVerdict.
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['prior', 'scores'],
  properties: {
    prior: { type: 'string' },                         // persona name — MUST be in the declared panel
    scores: { type: 'object' },                        // { option_id: 0..5 } under THIS persona's lens
    recommended_option: { type: 'string' },
    risks_of_recommendation: { type: 'array', items: { type: 'string' } },
    blocking_concerns: {                               // a VETO — reserve for "must not ship"
      type: 'array',
      items: {
        type: 'object',
        required: ['option_id'],
        properties: { option_id: { type: 'string' }, concern: { type: 'string' } },
      },
    },
  },
}

const SYNTH_SCHEMA = {
  type: 'object',
  required: ['recommended', 'strength'],
  properties: {
    recommended: { type: ['string', 'null'] },
    strength: { type: 'string', enum: ['strong', 'split', 'none'] },
    panel: { type: 'array', items: { type: 'string' } },
    matrix: { type: 'object' },
    ranked: { type: 'array', items: { type: 'string' } },
    survivors: { type: 'array', items: { type: 'string' } },
    vetoed: { type: 'array', items: { type: 'string' } },
    soft_vetoed: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'object' },
    panel_complete: { type: 'boolean' },
    blocking_concerns: { type: 'array', items: { type: 'object' } },
  },
}

// R7: post-panel integration pass — surfacing-only (never changes the deterministic pick).
const INTEGRATION_SCHEMA = {
  type: 'object',
  required: ['integration_flag'],
  properties: {
    integration_flag: { type: 'boolean' },             // true ⇒ a cross-lens issue the per-lens sum could miss
    note: { type: 'string' },                          // the surfaced disclosure (owner re-examines; not auto-applied)
  },
}

// ---- persona lenses (Epic A profile personas; canonical subagent_type names) ---------------
// architect + qa always; ux ONLY on a UI-bearing decision (R3). Each lens focus mirrors the
// persona's zone-routing prior — heterogeneity is the point (a jury, not an echo).
const PERSONAS = {
  'architect-advisor': 'feasibility / structural decomposition / data-state / technical-risk — which option compounds least downstream',
  'qa-advisor': 'testability / acceptance completeness / edge & failure paths / verifiability — which option is provable and which hides an unverifiable claim',
  'ux-advisor': 'flow completeness (happy/alt/error) / UI-state coverage / interaction consistency — which option serves the user flow',
}

// ===========================================================================

// ---- anchor the run root + resolve the synth lib ONCE (FB-LR-28) ----------------------------
phase('Load')
const anchor = await agent(
  `Anchor this consilium run ONCE (FB-LR-28 path-anchoring) for PA "${PA_ID}".\n`
  + `1) Run \`pwd\` (or \`git rev-parse --show-toplevel\`) via Bash to get the absolute run root.\n`
  + `2) Resolve the consilium-synth library: test each of these candidate paths under the run root, in order, and return the FIRST that EXISTS (via Bash \`test -f\`): ${JSON.stringify(SYNTH_CANDIDATES)}. If none exists, return the first candidate anyway (the Synthesize step will surface the failure honestly).\n`
  + `Return {root: <absolute run cwd>, synth: <resolved consilium-synth.cjs path>}. This single root anchors EVERY persona brief's paths for the whole run — do NOT switch checkouts mid-run.`,
  { schema: ANCHOR_SCHEMA, phase: 'Load', label: 'anchor-root' },
)
const ANCHOR_ROOT = (anchor && anchor.root) || '.'
const SYNTH = (anchor && anchor.synth) || SYNTH_CANDIDATES[0]
log(`anchored run root (FB-LR-28): ${ANCHOR_ROOT}; synth lib: ${SYNTH}`)

// ---- LOAD — lift the decision-fork from the canonical PA (options are LIFTED, never invented) -
const fork = await agent(
  `Assemble the decision-fork for consilium prep on pending-action "${PA_ID}"${FEATURE ? ` (feature ${FEATURE})` : ''}. `
  + `This is DECISION-SUPPORT prep for the OWNER, NOT a decision.\n`
  + `ANCHORED ROOT (FB-LR-28): ${ANCHOR_ROOT} — build every path from it.\n`
  + `1) Resolve the PA. ${PA_CANON}Find the pending-action block whose id is "${PA_ID}". If no such PA exists, return {options:[], decidable:false, note:"PA ${PA_ID} not found in the canonical ledger"}.\n`
  + `2) LIFT — do NOT invent — the mutually-exclusive options (a/b/c…) the PA enumerates: each with an id and a short summary. Read the cited artifacts ONLY to understand the options; NEVER add an option the PA does not pose. If the PA states a decision but enumerates FEWER THAN 2 options, set decidable:false + a one-line note naming what is missing — do NOT fabricate a second option.\n`
  + `3) Classify the decision \`category\` from the PA (gap-classifier vocabulary: threshold | moscow | screen-decision | ic-semantic | br-semantic | sc-semantic | broken-ref | fm-status | other) and set \`has_ui\`:true if the decision touches UI (a screen/MK/NM choice, a flow, or the feature's has_ui is true).\n`
  + `4) Collect \`artifact_refs\`: the absolute PATHS (under ${ANCHOR_ROOT}/.product/) of the raw artifacts a juror must read to weigh the options — the FM + the specific SC/BR/IC/NFR/VC/MK the decision hinges on. Paths only — the jurors read the files themselves (FB-LR-31).\n`
  + `5) Capture \`source_excerpt\`: the VERBATIM PA block text + the specific cited constraint lines (QUOTE, do not paraphrase) — the ground truth the jurors read alongside your lift.\n`
  + `6) Name \`comparison_axes\`: the 2-4 axes the options genuinely differ on (e.g. "delivery cost", "data-integrity risk", "user-flow friction") — the declared scope of what the jury weighs.\n`
  + `Return the fork. Do NOT edit any file. Do NOT commit. Do NOT change the PA.`,
  { schema: FORK_SCHEMA, phase: 'Load', label: `load:${PA_ID}` },
)

const options = (fork && Array.isArray(fork.options)) ? fork.options : []
const optionIds = options.map((o) => o && o.id).filter(Boolean)
const category = (fork && fork.category) || ''
const decidable = optionIds.length >= 2 && !(fork && fork.decidable === false)
const categoryEligible = !category || ELIGIBLE_CATEGORIES.includes(category)

// R1 — the fork guard, IN CODE, BEFORE any jury spawn. <2 options → honest refusal, no fabrication.
if (!decidable) {
  const missing = (fork && fork.note) ? ` Missing: ${fork.note}.` : ''
  log(`PA "${PA_ID}": ${optionIds.length} option(s) — NOT a fork; refusing to run a jury (rail R1).`)
  // Record a NON-BLOCKING routing note on the PA (route the spec-author/owner) — never fabricate an option.
  await agent(
    `The consilium could NOT run on pending-action "${PA_ID}": it enumerates FEWER THAN 2 mutually-exclusive options `
    + `— there is nothing for a jury to weigh (an under-specified decision, not a fork).\n`
    + `${PA_CANON}Append a NON-BLOCKING tracking note to that PA (do NOT change its status): "consilium could not run — needs >=2 enumerated, mutually-exclusive options; reformulate the options or leave the call to the owner."${missing}\n`
    + `Do NOT fabricate a second option. Do NOT edit any spec. Do NOT commit. Return a one-line confirmation.`,
    { phase: 'Load', label: 'refuse:under-specified' },
  )
  return refusal(
    `PA ${PA_ID} is not fork-shaped (${optionIds.length} option(s), need >=2) — reformulate the options or leave the call to the owner.${missing}`,
    { subject: (fork && fork.subject) || '', category },
  )
}

// ---- SCOPE (R2 / §D2) — declare the subject + panel + comparison axes BEFORE the fan-out ------
phase('Scope')
// R3: heterogeneous panel by zone — architect + qa always; ux ONLY on a UI-bearing decision
// (has_ui, or a screen-decision category). Mirrors complete-feature's conditional ux spawn / the
// zone-router UI-lens gate; the whole panel is never fired by default.
const uiBearing = !!(fork && fork.has_ui === true) || category === 'screen-decision'
const panelNames = uiBearing
  ? ['architect-advisor', 'qa-advisor', 'ux-advisor']
  : ['architect-advisor', 'qa-advisor']
const comparisonAxes = (fork && Array.isArray(fork.comparison_axes)) ? fork.comparison_axes : []
const scope = {
  subject: (fork && fork.subject) || `decision on ${PA_ID}`,
  category,
  category_eligible: categoryEligible,
  options: optionIds,
  panel: panelNames,
  comparison_axes: comparisonAxes,
  ui_bearing: uiBearing,
}
// No silent fan-out (R2): the panel + scope are logged BEFORE any persona spawns.
log(`SCOPE declared — subject: ${scope.subject} | options: [${optionIds.join(', ')}] | panel: [${panelNames.join(', ')}] `
  + `| axes: [${comparisonAxes.join(', ')}]${categoryEligible ? '' : ` | CAVEAT: category "${category}" is not a typical consilium-eligible fork (proceeding on the >=2-option guard)`}`)

// ---- JURY (R4/R5) — heterogeneous personas fan out in parallel, no cross-talk ----------------
phase('Jury')
const juryBrief = (name) =>
  `You are ONE juror on a heterogeneous consilium — a JURY, not a debate — preparing a decision for the OWNER on pending-action "${PA_ID}".\n`
  + `Your persona is "${name}". Your lens: ${PERSONAS[name]}.\n`
  + `You do NOT see the other jurors' verdicts and you do NOT coordinate — independent voting is what makes a jury worth more than one opinion; cross-talk collapses it to groupthink.\n`
  + `ANCHORED ROOT (FB-LR-28 — build every path from THIS single root; do NOT switch checkouts): ${ANCHOR_ROOT}\n`
  + `The DECISION: ${scope.subject}\n`
  + `The mutually-exclusive OPTIONS to weigh (these are the ONLY options — do NOT invent another): ${JSON.stringify(options)}\n`
  + `Comparison axes the fork turns on: ${JSON.stringify(comparisonAxes)}\n`
  + `RAW SOURCE (the ground truth — read it): the verbatim PA block + cited constraints: ${JSON.stringify((fork && fork.source_excerpt) || '')}\n`
  + `RAW-SOURCE RAIL (FB-LR-31): READ these raw artifact files YOURSELF — this brief deliberately does NOT paraphrase their content (a lossy paraphrase would hide the very trade-off you weigh): ${JSON.stringify((fork && fork.artifact_refs) || [])}. Read the FM + the linked SC/BR/IC/NFR/VC (and MK/NM if UI) under ${ANCHOR_ROOT}/.product/ as needed.\n`
  + `Score EACH option 0..5 STRICTLY from your "${name}" lens (0 = terrible for your lens, 5 = ideal) — return them in \`scores\` as { option_id: score }. Set \`prior\` to EXACTLY "${name}" (your persona name — the synthesis filters on it). Name your \`recommended_option\` (the top under YOUR lens). List \`risks_of_recommendation\` — what YOUR lens pays if the owner takes your pick (be honest about your prior's blind spots). Only if an option is genuinely UNACCEPTABLE under your lens, add it to \`blocking_concerns\` as { option_id, concern } — a blocking_concern is a VETO (it removes that option from the recommendation), so reserve it for "this must not ship", not "I mildly dislike it".\n`
  + `Judge the fork AS POSED — do NOT invent options, do NOT edit any file, do NOT decide for the owner. Return the verdict.`

// R5: crash-safe slot — agent() with an unresolvable agentType may THROW (not just return null);
// an uncaught throw would collapse the parallel() thunk to a null slot. Both attempts are
// try/caught so the slot ALWAYS returns {persona, verdict, incomplete}. Bounded single re-spawn
// (canonical type ONLY — never general-purpose: a wrong-lens verdict is worse than a disclosed
// missing one).
const spawnJuror = (name) => agent(juryBrief(name), { agentType: name, schema: VERDICT_SCHEMA, phase: 'Jury', label: `juror:${name}` })
const runJurorSlot = async (name) => {
  let r = null
  try { r = await spawnJuror(name) } catch (e) {
    log(`juror ${name} threw (${(e && e.message) || 'agent spawn error'}) — treated as dropped`)
  }
  for (let attempt = 0; !r && attempt < MAX_RESPAWN; attempt += 1) {
    log(`juror ${name} dropped (null/rejected/threw) — bounded re-spawn ${attempt + 1}/${MAX_RESPAWN} (canonical type ONLY, never general-purpose)`)
    try { r = await spawnJuror(name) } catch (e) {
      log(`juror ${name} threw on re-spawn (${(e && e.message) || 'agent spawn error'}) — lens marked incomplete`)
      r = null
    }
  }
  // Force `prior` to the canonical persona name so the synthesis panel-filter counts it even if
  // the agent mislabeled it — the slot is authoritative about WHICH lens ran.
  if (r) r.prior = name
  return { persona: name, verdict: r, incomplete: !r }
}
const slots = await parallel(panelNames.map((name) => () => runJurorSlot(name)))
const verdicts = slots.map((s) => s.verdict).filter(Boolean)
const jurorsIncomplete = slots.filter((s) => s.incomplete).map((s) => s.persona)
for (const name of jurorsIncomplete) log(`juror ${name} INCOMPLETE after bounded re-spawn — panel will be marked incomplete (degrade loud)`)
log(`jury: ${verdicts.length}/${panelNames.length} verdict(s) returned${jurorsIncomplete.length ? `; INCOMPLETE: ${jurorsIncomplete.join(', ')}` : ''}`)

// ---- SYNTHESIZE (R6) — deterministic matrix/rank/veto via the shared lib, relayed VERBATIM ----
phase('Synthesize')
// The recommendation comes from CODE (consilium-synth.cjs), parameterized with the persona panel
// (DEC-DEV-0145 --panel). The agent is TRANSPORT only — it materializes the verdicts to a temp
// file UNDER the anchored root and runs the CLI; it never re-scores or second-guesses the matrix.
const synth = await agent(
  `Synthesise the consilium verdicts DETERMINISTICALLY — the recommendation must come from CODE, not from your judgment. You are the TRANSPORT.\n`
  + `1) Write this JSON array of the ${verdicts.length} persona verdict(s) to the file ${ANCHOR_ROOT}/.product/.consilium/${PA_ID}-verdicts.json (create the .consilium dir if absent), byte-for-byte:\n${JSON.stringify(verdicts)}\n`
  + `2) Run \`node ${SYNTH} --verdicts-file ${ANCHOR_ROOT}/.product/.consilium/${PA_ID}-verdicts.json --options ${optionIds.join(',')} --panel ${panelNames.join(',')}\` via Bash. The --panel flag injects THIS persona jury (DEC-DEV-0145) so verdicts naming these personas are counted (not filtered as non-architecture priors).\n`
  + `3) RELAY its JSON output VERBATIM — {recommended, strength, panel, matrix, ranked, survivors, vetoed, soft_vetoed, recommendations, panel_complete, blocking_concerns}. Do NOT hand-compute, re-interpret, or second-guess the matrix / rank / veto — relay the lib output exactly. If \`node\` fails or the lib path does not exist, return {recommended:null, strength:"none", panel_complete:false} and say so.`,
  { schema: SYNTH_SCHEMA, phase: 'Synthesize', label: 'synth' },
)
const recommended = (synth && synth.recommended != null) ? synth.recommended : null
const strength = (synth && synth.strength) || 'none'
const vetoed = (synth && Array.isArray(synth.vetoed)) ? synth.vetoed : []
const softVetoed = (synth && Array.isArray(synth.soft_vetoed)) ? synth.soft_vetoed : []
// panel_complete is honest about BOTH a synth-reported reduced panel AND a juror that never returned.
const panelComplete = !(synth && synth.panel_complete === false) && jurorsIncomplete.length === 0

// ---- INTEGRATION PASS (R7 / mirror DEC-DEV-0135) — surfacing-only, never changes the pick ----
const integration = await agent(
  `You are the POST-PANEL INTEGRATION check of a consilium jury — one reasoner who reads ALL verdicts + the deterministic synthesis AFTER the independent panel, to catch what independent fixed-lens scoring + a deterministic SUM structurally miss. The panel scored each option under ONE lens in isolation; the synthesis SUMMED those scores. Nobody integrated ACROSS lenses — that is your job, adversarially.\n`
  + `You do NOT re-score and you do NOT change the recommendation (it is deterministic CODE — you SURFACE a concern, the owner decides). Look for: (1) a DISTRIBUTED must-not-ship — an option the sum keeps as viable that crosses a hard line no single lens vetoed; (2) one lens's FACT undercutting another lens's SCORE (e.g. one juror scored high on a premise another juror's finding invalidates); (3) a MIS-CALIBRATED strength.\n`
  + `The ${verdicts.length} verdict(s): ${JSON.stringify(verdicts)}\n`
  + `The deterministic synthesis: ${JSON.stringify(synth)}\n`
  + `Set integration_flag:true ONLY if you find a REAL cross-lens issue the per-lens sum missed (default false — do NOT invent one; a clean, well-summed fork returns false). Put the disclosure in \`note\`. This is SURFACED to the owner — you are NOT vetoing, re-scoring, or deciding.`,
  { schema: INTEGRATION_SCHEMA, phase: 'Synthesize', label: 'integration' },
)
const integrationFlag = !!(integration && integration.integration_flag)
const integrationNote = integrationFlag ? ((integration && integration.note) || 'cross-lens issue surfaced (see verdicts)') : ''

// ---- RECOMMEND (prepare-only) — update the PA in place with the recommendation package --------
phase('Recommend')
const pkg = {
  pa_id: PA_ID,
  subject: scope.subject,
  recommendation: { option_id: recommended, strength },
  panel: panelNames,
  panel_complete: panelComplete,
  matrix: (synth && synth.matrix) || {},
  ranked: (synth && synth.ranked) || [],
  vetoed,
  soft_vetoed: softVetoed,
  blocking_concerns: (synth && synth.blocking_concerns) || [],
  integration: integrationFlag ? { flag: true, note: integrationNote } : { flag: false },
}
// PA-dedup (DEC-DEV-0089): scan the PA for a prior consilium block → UPDATE IN PLACE, never append
// a duplicate. PREPARE-ONLY: this NEVER closes the PA, edits a spec, or finalizes the decision.
await agent(
  `Deliver the consilium recommendation into pending-action "${PA_ID}" as a PROPOSAL for the OWNER — you are NOT resolving it.\n`
  + `${PA_CANON}Find the PA block for "${PA_ID}". APPEND a sub-block — or UPDATE IT IN PLACE if a prior "Recommendation (prepared by consilium jury)" block already exists (idempotent re-runs, PA-dedup DEC-DEV-0089) — containing:\n`
  + `- the recommended option + strength ("${strength}");\n`
  + `- the panel that sat (${panelNames.join(', ')})${panelComplete ? '' : ' — PANEL INCOMPLETE: a juror did not return, the recommendation rests on a reduced panel'};\n`
  + `- the option-by-persona score matrix (as a readable table);\n`
  + `- the veto ledger (which lens blocked which option, if any) + any soft-veto (options weak under EVERY lens — surfaced for re-examination, NOT removed);\n`
  + `${integrationFlag ? `- the post-panel integration disclosure (SURFACED, not auto-applied): ${integrationNote};\n` : ''}`
  + `- an explicit line: "This is the JURY'S recommendation — RATIFICATION is the owner's; the fork is not decided."\n`
  + `Package: ${JSON.stringify(pkg)}\n`
  + `Do NOT change the PA status to done/dismissed (the owner ratifies). Do NOT edit any spec / design / feature file. Do NOT commit code. Return a one-line confirmation.`,
  { phase: 'Recommend', label: 'deliver-recommendation' },
)

// ---- disclosures + honest report (no silent truncation) --------------------------------------
const caveats = []
if (!panelComplete) caveats.push(`the jury ran with a REDUCED panel (${verdicts.length}/${panelNames.length} personas returned${jurorsIncomplete.length ? `; incomplete: ${jurorsIncomplete.join(', ')}` : ''}) — the recommendation rests on fewer lenses; re-run for a full panel before ratifying a close call.`)
if (strength === 'none') caveats.push('every option is vetoed by at least one lens — there is NO clean pick; the fork must be re-posed (see the veto ledger).')
else if (strength === 'split') caveats.push('the lenses DIVERGE — the recommendation is the top-scoring survivor, but the owner is weighing a real trade-off, not rubber-stamping a consensus.')
if (recommended && softVetoed.includes(recommended)) caveats.push('the recommended option is WEAK under every lens (no persona scored it strongly — soft-veto): a least-bad pick, not an endorsement; re-examine whether the fork is well-posed before ratifying.')
else if (softVetoed.length) caveats.push(`soft-veto: option(s) [${softVetoed.join(', ')}] survived the sum but no lens scored them strongly (weak under every lens).`)
if (integrationFlag) caveats.push(`post-panel integration flag (SURFACED, not auto-applied): ${integrationNote}`)
if (!categoryEligible) caveats.push(`category "${category}" is not a typical consilium-eligible fork (eligible: ${ELIGIBLE_CATEGORIES.join(', ')}) — the jury ran on the >=2-option guard, but consider whether this is really a jury decision.`)
caveats.push('PREPARE-ONLY: this is the jury\'s recommendation — the OWNER ratifies. The PA was NOT closed and no spec was edited.')

if (caveats.length) log(`consilium disclosures: ${caveats.join(' | ')}`)
log(`consilium DONE for ${PA_ID}: recommended=${recommended || '(none)'} [${strength}]; panel=[${panelNames.join(', ')}]; panel_complete=${panelComplete}; vetoed=${vetoed.length}; soft_vetoed=${softVetoed.length}`)

return {
  pa_id: PA_ID,
  feature: FEATURE || null,
  decidable: true,
  scope,                                 // subject + panel + comparison_axes + category (declared, R2)
  panel: panelNames,                     // the jury that sat (disclosure — no silent fan-out)
  recommended,                           // option_id | null (null ⇔ strength none)
  strength,                              // strong | split | none
  panel_complete: panelComplete,         // false ⇒ a persona did not return — recommendation on a reduced panel
  vetoed,                                // options a lens blocked (never recommended)
  soft_vetoed: softVetoed,               // survivors weak under EVERY lens — flagged, not removed
  integration_note: integrationNote,     // R7: cross-lens disclosure (surfaced, never auto-applied) — '' when clean
  matrix: pkg.matrix,                    // the option × persona score matrix (from the deterministic synth)
  verdicts_count: verdicts.length,
  jurors_incomplete: jurorsIncomplete,   // personas that never returned after bounded re-spawn — degrade loud
  caveats,                               // reduced-panel / split / soft-veto / integration / prepare-only notes — carried, never dropped
  refused: false,
}
