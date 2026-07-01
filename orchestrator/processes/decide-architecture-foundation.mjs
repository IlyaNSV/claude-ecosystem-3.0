export const meta = {
  name: 'decide-architecture-foundation',
  description: 'Orchestrator P2 — decision SUPPORT on an undecided architecture fork. Consumes a DECLARED fork (best: a cross-spec-conflict pending-action that already enumerates the options), runs a heterogeneous jury of 3 architects (priors velocity/fidelity/integrity) that score the options INDEPENDENTLY (a jury, not a debate), synthesises their verdicts DETERMINISTICALLY (a matrix + rank + veto-by-blocking, à la remediation-guard) and formulates the real trade-off on a split, then writes a scored recommendation + a DRAFT DEC into the fork\'s pending-action for the OWNER to ratify. P2 prepares the decision; it does NOT edit specs, close the pending-action, or finalize the DEC — the final choice is the owner\'s (FB-LR-07).',
  phases: [
    { title: 'Brief' },
    { title: 'Consilium' },
    { title: 'Synthesize' },
    { title: 'Recommend' },
  ],
}

/*
 * Orchestrator process P2 `decide-architecture-foundation` — build DEC-DEV-0129
 * (Phase 5C of the "module complete" plan; design ratified in DEC-DEV-0127, contract
 * dev/ORCHESTRATOR_P2_KICKOFF.md). Reading: SPEC §3.2 P2 / §3.3 RA-1 (the
 * architecture-consilium role, priors velocity/fidelity/integrity); Vision Epic D
 * (consilium = jury, not consensus-debate); RUN 01 E1 (#129–184, the fork run by hand);
 * open-Q#7 (needs a DIFFERENT fork than RUN 01's stack-choice to confirm the synthesis
 * automates — the dogfood target is the S7 fork PA-040/042).
 *
 * WHY P2 IS SUPPORT, NOT DECISION (the key boundary, DEC-DEV-0127 §1):
 *   The whole system routes architecture decisions to the owner (FB-LR-07 /
 *   remediation-guard escalate-don't-self-resolve). An auto-deciding P2 would become
 *   exactly the "unilateral resolution" the gates forbid. And Vision D's research: a
 *   consilium LOSES on a single connected decision (~15× cost + groupthink) UNLESS it
 *   is a heterogeneous JURY that PREPARES the decision rather than taking it for the
 *   user. So P2 compresses the fork to a decidable shape (options × lenses × risks ×
 *   recommendation + the surfaced split) and the OWNER ratifies. Autonomy in the
 *   QUALITY of preparation; obedience in WHO makes the final call.
 *
 * THE ENGINE — a jury, not a debate (DEC-DEV-0127 §4):
 *   3 architects run in `parallel()`, each with a distinct prior, each reading the ForkBrief
 *   + the RAW SOURCE it was lifted from (Fix A, DEC-DEV-0135 — see below), no cross-talk, no
 *   consensus round. Heterogeneity is the condition under which a panel beats one opinion;
 *   cross-talk collapses it to groupthink. Each returns a structured ArchVerdict (scores per
 *   option + recommended + risks-of-own-prior + blocking_concerns) so the synthesis is
 *   deterministic, not hand-waved.
 *
 * THE SYNTHESIS — hybrid code + prompt (DEC-DEV-0127 §5 / §9.2):
 *   Layer-3 (CODE, consilium-synth.cjs): matrix + rank + veto — worst-of by blocking
 *   (any lens's blocking_concern vetoes an option), sum-of-scores for rank, + a SOFT-VETO
 *   flag (Fix synthesis, DEC-DEV-0135: an option no lens scores strongly is weak-across-the-
 *   board — flagged, and a soft-vetoed top pick is demoted out of `strong`). This fixes WHAT
 *   is recommended and how strongly (strong | split | none). Layer-2.5 (PROMPT, surfacing-
 *   only): a post-panel holistic INTEGRATION pass — one reasoner reads the whole fork after
 *   the panel to catch the distributed must-not-ship / cross-lens-fact blind spot a fixed-
 *   lens SUM cannot see; it raises a disclosure, it never changes the deterministic pick.
 *   Layer-2 (PROMPT): formulates `the_real_tradeoff` on a split + the DRAFT dec — the semantic
 *   layer on top of the fixed skeleton. A split is NOT a bug of the synthesis; it IS the
 *   product (the trade-off the owner must weigh), so P2 surfaces it, never papers it over.
 *
 * FIX A + FIX SYNTHESIS (DEC-DEV-0135; profiling study DEC-DEV-0132): the P2 dogfood A/B
 *   surfaced two mechanism blind spots. (Layer-2 loss) the jury saw only a LOSSY lifted
 *   ForkBrief → architects now also read the raw source_excerpt (the ground truth wins on a
 *   fact the lift dropped). (Layer-3 integration loss) independent fixed-lens scoring + a
 *   deterministic sum trades away holistic cross-lens integration → the soft-veto rule
 *   (deterministic) + the post-panel integration pass (holistic, surfacing-only) recover it
 *   without abandoning the jury (whose value is insurance / auditability, not decision uplift).
 *
 * DETERMINISM MODEL (SPEC §2): Layer-1 SKELETON = the Brief→Consilium→Synthesize→
 *   Recommend FSM (below). Layer-2 JUDGMENT = the 3 architects + the trade-off
 *   formulator. Layer-3 GATE = consilium-synth.cjs (deterministic .cjs, run by an
 *   agent, relayed as JSON).
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() in the script.
 *   The synth lib runs INSIDE an agent (which materialises the verdicts to a temp file
 *   and runs the CLI); inputs arrive via args.
 *
 * BOUNDARY DISCIPLINE: P2 never edits design.md/tech.md/tasks.md/any spec, never closes
 *   the fork's pending-action, never finalizes a DEC — it emits a proposal + a DRAFT
 *   dec. The owner ratifies → flips the PA → commits the DEC → edits the specs (or
 *   orders P3/P5 to implement the chosen option).
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect) +
 * tests/orchestrator/decide-architecture-foundation-wiring.test.cjs (static invariants).
 * The synth lib is unit-tested in tests/orchestrator/consilium-synth.test.cjs. A live
 * grade is the dogfood on the S7 fork PA-040/042 (a separate session).
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent may stringify it.
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FORK = A.fork || A.forkId || ''                                   // fork id (PA-NNN or an ad-hoc ref)
const FORK_BRIEF_IN = (A.forkBrief && typeof A.forkBrief === 'object') ? A.forkBrief : null  // optional pre-assembled ForkBrief
const SYNTH = A.synth || '.claude/orchestrator/lib/consilium-synth.cjs' // DEC-DEV-0129: deterministic synthesis core

// The 3 fixed priors (RA-1). v1 is a fixed panel; a configurable panel is post-v1
// (DEC-DEV-0127 §9.3). Mirrors consilium-synth.cjs PRIOR_LIST (the script cannot require the lib).
const PRIOR_LIST = ['velocity', 'fidelity', 'integrity']
const PRIOR_LENS = {
  velocity: 'delivery speed / simplicity / time-to-feedback — optimise for reaching working software fastest',
  fidelity: 'faithfulness to the specs / steering / design mandates — optimise for the least drift from what is documented',
  integrity: 'runtime integrity / correctness / no dead seam — optimise for the system actually working end-to-end',
}

// ---- schemas ---------------------------------------------------------------
const FORK_BRIEF_SCHEMA = {
  type: 'object',
  required: ['fork_id', 'options'],
  properties: {
    fork_id: { type: 'string' },
    statement: { type: 'string' },                          // what the fork is (1-2 sentences)
    options: {                                              // ≥2 mutually-exclusive options (lifted, not invented)
      type: 'array',
      items: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          summary: { type: 'string' },
          mutates: { type: 'array', items: { type: 'string' } },   // sanctioned artifacts each option would touch
        },
      },
    },
    constraints: { type: 'string' },                        // .product (VP/NFR/product_class) + steering/design pins
    source_excerpt: { type: 'string' },                     // DEC-DEV-0135 (Fix A): VERBATIM raw PA block + cited constraint lines — the ground truth the architects read alongside the (lossy) lift
    affected_specs: { type: 'array', items: { type: 'string' } },
    decidable: { type: 'boolean' },                         // false ⇒ <2 enumerated options (under-specified fork)
    note: { type: 'string' },
  },
}

const ARCH_VERDICT_SCHEMA = {
  type: 'object',
  required: ['prior', 'scores'],
  properties: {
    prior: { type: 'string', enum: ['velocity', 'fidelity', 'integrity'] },
    scores: { type: 'object' },                             // { option_id: 0..5 } under THIS lens
    recommended_option: { type: 'string' },                 // top under this lens
    risks_of_recommendation: { type: 'array', items: { type: 'string' } },   // what this lens pays for its pick
    blocking_concerns: {                                    // a VETO — reserve for "must not ship"
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
    recommended: { type: ['string', 'null'] },              // option_id | null (null ⇔ strength none)
    strength: { type: 'string', enum: ['strong', 'split', 'none'] },
    matrix: { type: 'object' },
    ranked: { type: 'array', items: { type: 'string' } },
    survivors: { type: 'array', items: { type: 'string' } },
    vetoed: { type: 'array', items: { type: 'string' } },
    soft_vetoed: { type: 'array', items: { type: 'string' } },   // DEC-DEV-0135: survivors weak under every lens (no prior ≥ threshold)
    recommendations: { type: 'object' },
    panel_complete: { type: 'boolean' },
    blocking_concerns: { type: 'array', items: { type: 'object' } },
  },
}

// DEC-DEV-0135 (Fix synthesis / Layer-3): the post-panel holistic INTEGRATION pass — one
// reasoner reads the WHOLE fork AFTER the independent panel, adversarially, to catch what
// independent fixed-lens scoring + a deterministic SUM structurally miss (a distributed
// must-not-ship no single lens vetoed; one lens's fact undercutting another's score; a
// mis-calibrated strength). SURFACING-ONLY: it raises a disclosure, it does NOT change the
// deterministic recommendation (that stays CODE — profiling study DEC-DEV-0132 finding #3).
const INTEGRATION_SCHEMA = {
  type: 'object',
  required: ['integration_flag'],
  properties: {
    integration_flag: { type: 'boolean' },                  // true ⇒ the per-lens sum may mislead (surfaced, never auto-applied)
    distributed_veto: {                                     // options the sum keeps as viable that cross a hard line no single lens blocked
      type: 'array',
      items: {
        type: 'object',
        required: ['option_id', 'why'],
        properties: {
          option_id: { type: 'string' },
          hard_line: { type: 'string' },                    // the pinned constraint it crosses (NFR-x / steering pin / dead runtime seam)
          why: { type: 'string' },
        },
      },
    },
    recalibration: { type: 'string' },                      // e.g. "this 'split' reads as a clear call once X is integrated across lenses"
    note: { type: 'string' },
  },
}

const TRADEOFF_SCHEMA = {
  type: 'object',
  required: ['rationale'],
  properties: {
    the_real_tradeoff: { type: 'string' },                  // on a split: what the owner is weighing
    rationale: { type: 'string' },                          // why the recommended option leads, in matrix terms
    dec_draft: { type: 'string' },                          // DRAFT DEC-<MODULE>-NNNN (owner ratifies/edits/numbers)
    applies_to: { type: 'array', items: { type: 'string' } },   // specs/docs the chosen option would change
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

// ---- role prompts + PA writers ---------------------------------------------

// One consilium architect. Sees the ForkBrief + the RAW SOURCE it was lifted from + its own
// prior; votes independently (jury, not debate — cross-talk collapses a panel to groupthink,
// Vision D). Fix A (DEC-DEV-0135): the architects read the raw source, not only the lifted
// brief, so a lossy Brief-lift can no longer cap the panel (profiling study DEC-DEV-0132: the
// PA-040 brief dropped + mis-framed a decision-relevant fact the whole panel then inherited).
const archPrompt = (prior, brief) =>
  `You are ONE architect on a 3-member consilium — a JURY, not a debate. Your prior is "${prior}": ${PRIOR_LENS[prior]}.\n`
  + `You do NOT see the other architects' verdicts and you do NOT coordinate with them — independent voting is what makes a consilium worth more than one opinion; cross-talk collapses it to groupthink.\n`
  + `ForkBrief (a convenience INDEX — the enumerated options + a distilled constraints view): ${JSON.stringify(brief)}\n`
  + (brief && brief.source_excerpt
    ? `RAW SOURCE the brief was lifted from (the GROUND TRUTH — read it): ${JSON.stringify(brief.source_excerpt)}\nThe brief is a lift and may have DROPPED or mis-framed a fact. For FACTS and CONSTRAINTS the raw source WINS over the brief — if they disagree, trust the source and correct your reasoning. But the OPTIONS to weigh are exactly the brief's enumerated options: use the source to get the facts right, NOT to invent an option the fork does not pose.\n`
    : '')
  + `Score EACH option 0..5 STRICTLY from your "${prior}" lens (0 = terrible for ${prior}, 5 = ideal for ${prior}) — return them in scores as { option_id: score }. Name your recommended_option (the top under YOUR lens). List risks_of_recommendation — what YOUR lens pays if the owner takes your pick (be honest about your prior's blind spots). Only if an option is genuinely UNACCEPTABLE under your lens, add it to blocking_concerns as { option_id, concern } — a blocking_concern is a VETO (it removes that option from the recommendation), so reserve it for "this must not ship", not "I mildly dislike it".\n`
  + `Judge the fork AS POSED — do NOT invent new options, do NOT edit any file, do NOT decide for the owner. Return the ArchVerdict.`

// The post-panel holistic INTEGRATION pass (DEC-DEV-0135, Fix synthesis / Layer-3). One
// reasoner reads the WHOLE fork AFTER the independent panel, adversarially, to catch the
// cross-lens failures a fixed-lens sum cannot see. SURFACING-ONLY: it raises a disclosure,
// it does NOT re-score and does NOT change the deterministic recommendation (that stays CODE).
const integrationPrompt = (brief, verdicts, synth) =>
  `You are the POST-PANEL INTEGRATION check of a 3-architect consilium — one reasoner who reads the WHOLE fork AFTER the independent panel, to catch what independent fixed-lens scoring + a deterministic SUM structurally miss. The panel scored each option under ONE lens in isolation; the synthesis SUMMED those scores. That guarantees every lens is heard, but nobody integrated ACROSS lenses — that is your job, adversarially.\n`
  + `You do NOT re-score and you do NOT change the recommendation (the recommendation is deterministic CODE — you SURFACE a concern, the owner decides). Look for three failure modes the sum cannot see:\n`
  + `1) DISTRIBUTED must-not-ship: an option the sum keeps as a viable survivor that actually crosses a HARD line — violates a pinned / HIGH-confidence NFR or steering / product-class constraint, or leaves a dead runtime seam — where NO single lens raised a blocking veto because each only found it "weak" within its lens. A sum of "weak, weak, strong" is a split; integrated, it may be a must-not-ship.\n`
  + `2) One lens's FACT undercuts another lens's SCORE: e.g. velocity scored an option high on a premise that fidelity's or integrity's finding invalidates.\n`
  + `3) MIS-CALIBRATION: a "split" that is really a clear call once you integrate across concerns, or a "strong" shakier than the sum implies.\n`
  + `RAW FORK (read source_excerpt as the ground truth, not only the lifted brief): ${JSON.stringify(brief)}\n`
  + `The 3 architect verdicts: ${JSON.stringify(verdicts)}\n`
  + `The deterministic synthesis (recommended + strength + matrix + vetoed + soft_vetoed): ${JSON.stringify(synth)}\n`
  + `Set integration_flag:true ONLY if you find a REAL cross-lens issue the per-lens sum missed (default false — do NOT invent one; a clean, well-summed fork returns false). For each distributed must-not-ship add { option_id, hard_line (the exact constraint it crosses), why }. Use recalibration to name a mis-calibrated strength. This is SURFACED to the owner as a disclosure — you are NOT vetoing, re-scoring, or deciding. Return the integration verdict.`

// Write the recommendation into the fork's pending-action as a PROPOSAL (never a resolution).
const deliverRecommendation = (pkg) =>
  agent(
    `Deliver the P2 consilium recommendation into the fork's pending-action as a PROPOSAL for the owner — you are NOT resolving it.\n`
    + `Find the PA block for fork "${pkg.fork_id}". APPEND a sub-block — or UPDATE IT IN PLACE if a prior "Resolution (proposed by P2 consilium)" block already exists (idempotent re-runs) — containing: the recommended option + strength ("${pkg.recommendation.strength}"); the_real_tradeoff; the option-by-prior score matrix (as a readable table); the veto ledger (which lens blocked which option, if any); the soft-veto + integration flags if present (options weak under EVERY lens / a possible distributed must-not-ship the per-lens sum missed — marked SURFACED for re-examination, NOT removed); and the DEC DRAFT verbatim (clearly marked DRAFT — the owner ratifies/edits it and assigns the real number).\n`
    + `Package: ${JSON.stringify(pkg)}\n`
    + `${PA_CANON}`
    + `Do NOT change the PA status to done/dismissed (the owner ratifies). Do NOT edit any spec / design / tasks file. Do NOT commit code. Return a one-line confirmation.`,
    { phase: 'Recommend', label: 'deliver-recommendation' },
  )

// On an under-specified fork (<2 options): record a non-blocking note, do NOT fabricate an option.
const recordUnDecidable = (brief) =>
  agent(
    `The P2 consilium could NOT run: architecture fork "${FORK || (brief && brief.fork_id) || '(unknown)'}" enumerates FEWER THAN 2 mutually-exclusive options — there is nothing to weigh (an under-specified fork, not a real decision).\n`
    + `Append a NON-BLOCKING tracking note to the fork's PA (or a new item if none exists): "P2 decide-architecture-foundation could not run — the fork needs >=2 enumerated, mutually-exclusive options; route the spec-author / owner to pose them." ${brief && brief.note ? `Missing: ${brief.note}. ` : ''}\n`
    + `${PA_CANON}`
    + `Do NOT fabricate a second option. Do NOT commit code. Return a one-line confirmation.`,
    { phase: 'Brief', label: 'under-specified' },
  )

// ===========================================================================

// ---- Phase 1: brief — assemble/lift the ForkBrief --------------------------
phase('Brief')
let brief = FORK_BRIEF_IN
if (!brief) {
  brief = await agent(
    `Assemble the ForkBrief for architecture fork "${FORK}" — the input P2 will weigh. This is DECISION-SUPPORT prep, NOT a decision.\n`
    + `1) Resolve the fork's pending-action. ${PA_CANON}Find the PA block whose id/title matches "${FORK}" (a cross-spec-conflict PA is the ideal input — it already enumerates the options and names the conflicting specs).\n`
    + `2) LIFT — do NOT invent — the mutually-exclusive options (a/b/c…) the PA lists: each with an id, a short summary, and the sanctioned artifacts it would mutate (design.md / tech.md / tasks.md / a spec section). Read the cited specs and .product ONLY to fill constraints (VP / NFR / product_class, steering / design pins) — never to add an option the fork does not pose.\n`
    + `3) Capture source_excerpt (Fix A, DEC-DEV-0135): the VERBATIM text of the fork's PA block + the specific cited constraint lines you read (the pinned NFR / VP / product_class / steering / design lines that bear on an option) — QUOTE, do not paraphrase. The architects read this raw source as the GROUND TRUTH alongside your lift, so a fact your distillation drops does NOT silently cap the panel. Do not editorialize; this is the source, not your summary.\n`
    + `4) If the fork enumerates FEWER THAN 2 options (nothing to weigh — under-specified, not a real fork), set decidable:false + a one-line note naming what is missing; do NOT fabricate a second option.\n`
    + `Return the ForkBrief. Do NOT edit any file. Do NOT commit.`,
    { schema: FORK_BRIEF_SCHEMA, phase: 'Brief', label: `brief:${FORK || 'fork'}` },
  )
}
const options = (brief && Array.isArray(brief.options)) ? brief.options : []
const optionIds = options.map((o) => o && o.id).filter(Boolean)
const decidable = optionIds.length >= 2 && !(brief && brief.decidable === false)
const forkId = (brief && brief.fork_id) || FORK || null
log(`fork "${forkId}": ${optionIds.length} option(s) [${optionIds.join(', ')}]${decidable ? '' : ' — UNDER-SPECIFIED (need >=2)'}`)

if (!decidable) {
  // no real fork to weigh — surface it (route the spec-author/owner), do not run a consilium.
  await recordUnDecidable(brief)
  return {
    fork_id: forkId,
    decidable: false,
    recommendation: { option_id: null, strength: 'none' },
    strength: 'none',
    the_real_tradeoff: '',
    rationale: '',
    dec_draft: '',
    applies_to: [],
    matrix: {},
    ranked: [],
    vetoed: [],
    panel_complete: true,
    verdicts_count: 0,
    disclosures: [`fork under-specified — needs >=2 enumerated options${brief && brief.note ? `: ${brief.note}` : ''}`],
  }
}

// ---- Phase 2: consilium — the heterogeneous jury (parallel, no cross-talk) --
phase('Consilium')
const verdicts = (await parallel(PRIOR_LIST.map((prior) => () =>
  agent(archPrompt(prior, brief), { schema: ARCH_VERDICT_SCHEMA, phase: 'Consilium', label: `arch:${prior}` }),
))).filter(Boolean)
log(`consilium: ${verdicts.length}/${PRIOR_LIST.length} architect verdict(s) returned`)

// ---- Phase 3: synthesize — deterministic matrix/rank/veto, then the trade-off
phase('Synthesize')
// Layer-3 (CODE): the recommendation comes from consilium-synth.cjs, not judgment.
const synth = await agent(
  `Synthesise the consilium verdicts DETERMINISTICALLY — the recommendation must come from CODE, not from your judgment.\n`
  + `1) Write this JSON array of the ${verdicts.length} architect verdict(s) to a temporary file (via Bash — e.g. a heredoc, or Node fs to a scratch path):\n${JSON.stringify(verdicts)}\n`
  + `2) Run \`node ${SYNTH} --verdicts-file <that-temp-file> --options ${optionIds.join(',')}\` via Bash and RELAY its JSON VERBATIM (recommended + strength + matrix + ranked + survivors + vetoed + recommendations + panel_complete + blocking_concerns). Do NOT hand-compute or second-guess the matrix / rank / veto — relay the lib output exactly.`,
  { schema: SYNTH_SCHEMA, phase: 'Synthesize', label: 'synth' },
)
const recommended = (synth && synth.recommended != null) ? synth.recommended : null
const strength = (synth && synth.strength) || 'none'
const vetoed = (synth && synth.vetoed) || []
const softVetoed = (synth && Array.isArray(synth.soft_vetoed)) ? synth.soft_vetoed : []   // DEC-DEV-0135: survivors weak under every lens
const panelComplete = !(synth && synth.panel_complete === false)

// Layer-2.5 (PROMPT, surfacing-only): the post-panel holistic integration pass — one reasoner
// reads the WHOLE fork after the panel to catch the distributed must-not-ship / cross-lens-fact
// blind spot the independent-lens sum cannot see (profiling study DEC-DEV-0132 finding #3). It
// SURFACES a disclosure — it does NOT change the deterministic recommendation (that stays CODE).
const integration = await agent(
  integrationPrompt(brief, verdicts, synth),
  { schema: INTEGRATION_SCHEMA, phase: 'Synthesize', label: 'integration' },
)
const integrationFlag = !!(integration && integration.integration_flag)
const distributedVeto = (integration && Array.isArray(integration.distributed_veto)) ? integration.distributed_veto : []

// Layer-2 (PROMPT): formulate the human-readable trade-off + a DRAFT dec ON TOP of the fixed matrix.
const tradeoff = await agent(
  `Formulate the owner-facing recommendation narrative ON TOP of this deterministic synthesis. You may NOT change what it recommends or which options it vetoed — you EXPLAIN it.\n`
  + `Synthesis: ${JSON.stringify(synth)}\n`
  + `ForkBrief: ${JSON.stringify(brief)}\n`
  + (strength === 'split'
    ? `This is a SPLIT (the lenses diverge). Your MOST IMPORTANT output is the_real_tradeoff: name precisely what the owner is weighing (e.g. "velocity pulls to A for a week-faster ship; integrity pulls to B because A leaves a dead runtime seam"). Do NOT paper over the split — it IS the decision.\n`
    : strength === 'none'
      ? `This is NONE — EVERY option is vetoed by at least one lens. Do NOT recommend one anyway. the_real_tradeoff must state that there is no clean option and what each veto demands, so the owner can re-pose the fork.\n`
      : `This is a STRONG recommendation (the full panel converged, no veto). Keep the rationale short — ratification is near-formal.\n`)
  + `Also produce: rationale (why the recommended option leads, in the matrix's terms); dec_draft — a DRAFT "DEC-<MODULE>-NNNN" the owner will ratify / edit (NOT a finalized decision — leave the number as NNNN and mark it DRAFT); applies_to — the specs / docs / tasks the recommended option would change (for the owner's follow-up edit).\n`
  + `BOUNDARY: you are PREPARING a recommendation, NOT making the decision. Do NOT edit design.md / tech.md / tasks.md / any spec, do NOT finalize a DEC, do NOT close the pending-action. Return the trade-off package.`,
  { schema: TRADEOFF_SCHEMA, phase: 'Synthesize', label: 'tradeoff' },
)

// ---- Phase 4: recommend — deliver the package to the owner (never auto-decide)
phase('Recommend')
const pkg = {
  fork_id: forkId,
  recommendation: { option_id: recommended, strength },
  the_real_tradeoff: (tradeoff && tradeoff.the_real_tradeoff) || '',
  rationale: (tradeoff && tradeoff.rationale) || '',
  dec_draft: (tradeoff && tradeoff.dec_draft) || '',
  applies_to: (tradeoff && tradeoff.applies_to) || [],
  matrix: (synth && synth.matrix) || {},
  ranked: (synth && synth.ranked) || [],
  vetoed,
  soft_vetoed: softVetoed,                                    // DEC-DEV-0135: survivors weak under every lens (flagged, not removed)
  integration: integrationFlag                               // post-panel holistic flag (surfaced, never auto-applied)
    ? { flag: true, distributed_veto: distributedVeto, recalibration: (integration && integration.recalibration) || '', note: (integration && integration.note) || '' }
    : { flag: false },
  panel_complete: panelComplete,
}
await deliverRecommendation(pkg)

// disclosures ride with the result — a reduced panel / a split / an all-vetoed fork must never read as a clean, ratify-and-go pick.
const disclosures = []
if (!panelComplete) disclosures.push(`consilium ran with a REDUCED panel (${verdicts.length}/${PRIOR_LIST.length} priors reported) — the recommendation rests on fewer than 3 lenses; re-run for a full panel before ratifying a close call.`)
if (strength === 'none') disclosures.push('every option is vetoed by at least one lens — there is NO clean pick; the fork must be re-posed (see the veto ledger).')
else if (strength === 'split') disclosures.push('the lenses DIVERGE — the recommendation is the top-scoring survivor, but the owner is weighing a real trade-off (see the_real_tradeoff), not rubber-stamping a consensus.')
// DEC-DEV-0135 — soft-veto: an option weak under EVERY lens survived the sum but no lens endorsed it.
if (recommended && softVetoed.includes(recommended)) disclosures.push('the recommended option is WEAK under every lens (no prior scored it strongly — soft-veto): a least-bad pick, not an endorsement; re-examine whether the fork is well-posed before ratifying.')
else if (softVetoed.length) disclosures.push(`soft-veto: option(s) [${softVetoed.join(', ')}] survived the sum but no lens scored them strongly (weak under every lens).`)
// DEC-DEV-0135 — post-panel integration flag (surfaced, never auto-applied): a cross-lens issue the per-lens sum could not see.
if (integrationFlag) {
  const dv = distributedVeto.map((d) => `${d.option_id}${d.hard_line ? ` (${d.hard_line})` : ''}`).filter(Boolean).join(', ')
  disclosures.push(`post-panel integration flag: the per-lens sum may mislead${dv ? ` — possible distributed must-not-ship on [${dv}] that no single lens vetoed` : ''}${integration && integration.recalibration ? ` — recalibration: ${integration.recalibration}` : ''}; owner should re-examine before ratifying (SURFACED, not auto-applied).`)
}
if (disclosures.length) log(`P2 disclosures: ${disclosures.join(' | ')}`)
log(`P2 recommendation: ${recommended || '(none)'} [${strength}] on fork "${forkId}" — proposed to owner (not auto-decided)`)

return {
  fork_id: forkId,
  decidable: true,
  recommendation: pkg.recommendation,   // { option_id, strength }
  strength,                             // strong | split | none
  the_real_tradeoff: pkg.the_real_tradeoff,
  rationale: pkg.rationale,
  dec_draft: pkg.dec_draft,             // DRAFT — the owner ratifies/finalizes (P2 never commits a DEC)
  applies_to: pkg.applies_to,
  matrix: pkg.matrix,
  ranked: pkg.ranked,
  vetoed,                               // options a lens blocked (never recommended)
  soft_vetoed: softVetoed,              // DEC-DEV-0135: survivors weak under EVERY lens — flagged for re-examination, not removed
  integration: pkg.integration,         // DEC-DEV-0135: post-panel holistic flag { flag, distributed_veto, recalibration, note } (surfaced, not auto-applied)
  panel_complete: panelComplete,        // false ⇒ a prior died; recommendation on a reduced panel (disclosed)
  verdicts_count: verdicts.length,
  disclosures,                          // reduced-panel / split / all-vetoed / soft-veto / integration caveats — carried, never dropped
}
