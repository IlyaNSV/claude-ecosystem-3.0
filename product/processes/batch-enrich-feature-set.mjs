export const meta = {
  name: 'batch-enrich-feature-set',
  description: 'Product C-i — the MACRO batch-enrichment step of the Autonomous Pipeline Vision (Epic C-i, DEC-DEV-0145 decisions г/д). The completeness-loop (complete-feature.mjs, Wave B) hardens ONE feature\'s spec; this runner takes a SET of FMs (a release\'s worth) and drives each through enrichment (F.2→F.7 of P2.A) + the bounded completeness-loop, with the human gates moved from per-item approve to PHASE BOUNDARIES realized as L1 PA-escalations (the owner ratifies from the ledger). It is a THIN ORCHESTRATION over the EXISTING machinery — the ENRICH stage EXECUTES the procedure of the existing /product:feature command doc, the COMPLETE stage delegates to the existing complete-feature.mjs via workflow(); vision cut #4 forbids re-implementing the F.2-F.10 authoring here. CHECKPOINT-FIRST (урок E1: batches can hit a session limit mid-run) — a resumable manifest is written BEFORE the first enrichment touch. PREPARE-ONLY: the runner NEVER transitions FM status (F.10 is the owner\'s ratification); boundary gates are PA-escalations the owner ratifies. Invoked by /product:batch-enrich <FM-NNN ...> | --all-planned.',
  phases: [
    { title: 'Plan' },
    { title: 'Enrich' },
    { title: 'Complete' },
    { title: 'Gate' },
    { title: 'Report' },
  ],
}

/*
 * Product process C-i `batch-enrich-feature-set` — the executable MACRO step of the
 * Autonomous Pipeline Vision Wave (C∥D), design in dev/ECOSYSTEM_VISION_BATCH_3.md §C-i
 * (DEC-DEV-0145 decisions г/д). The completeness-loop (complete-feature.mjs, Wave B) is the
 * PER-FEATURE hardener; this runner is the release-level driver that fans a SET of FMs
 * through enrichment + the bounded completeness-loop, moving the human approve-gate from
 * per-item to phase-boundary L1 PA-escalations (the owner ratifies from the ledger).
 *
 * THIN ORCHESTRATION, NOT A REBUILD (vision cut #4; [[feedback_orchestrate_not_duplicate]]):
 * this .mjs contains ZERO authoring logic — no SC/BR templates, no field lists, no wave loop.
 * The ENRICH stage EXECUTES the procedure of the EXISTING command doc commands/product/feature.md
 * (enrichment mode F.2→F.7); the COMPLETE stage DELEGATES to the EXISTING complete-feature.mjs
 * via workflow(). Re-implementing either here would fork the SSOT.
 *
 * SEVEN HARD RAILS (enforced HERE in code, not just documented):
 *   B1. EXPLICIT TARGET — refuse a target-less run (FB-002 precedent). `--all-planned` discovery
 *       NEVER silently expands the batch: the discovered list is LOGGED before any work.
 *   B2. CHECKPOINT-FIRST (урок E1: session-limit on batches) — the checkpoint manifest is written
 *       BEFORE the first enrichment touch. Layout avoids write races + needs no timestamps (Date.now
 *       is unavailable in the harness): a batch dir `.product/.batch-enrich/<batch-slug>/` (slug is
 *       DETERMINISTIC from the sorted feature list), a `manifest.json` written once up front, and a
 *       per-FM state file `<FM>.json` — ONE writer per FM, no shared-file race. RESUME: an FM with all
 *       stages done is SKIPPED (logged + reported, never silent); a partially-done FM resumes at its
 *       first unfinished stage (verify-before-act, DEC-DEV-0093).
 *   B3. ORCHESTRATE, DON'T DUPLICATE (vision cut #4) — the ENRICH stage agent EXECUTES the procedure
 *       of the resolved commands/product/feature.md scoped to one FM (enrichment mode F.2→F.7). No
 *       authoring logic lives in this script.
 *   B4. PHASE-BOUNDARY GATES, NOT PER-ITEM (decision д / vision C1) — the command doc's per-item human
 *       APPROVES are REPLACED for this batch run by L1 PA-escalation: anything that is a real DECISION
 *       under the gap-classifier vocabulary (threshold / moscow / *-semantic / screen-decision / the
 *       NFR F.5a.0 [Y/D/L] call / anything the enrich agent is genuinely unsure of) escalates to the
 *       canonical pending-actions ledger (PA_CANON) instead of being decided inline. Derivable,
 *       convention-bound authoring (SC skeletons from the FM, BR extraction from SC text, LC/VC/RPM
 *       derivations) proceeds. F.8 (design module) + F.9 (DA review) are SKIPPED + logged (conditional/
 *       optional, out of C-i scope). The GATE stage writes/updates ONE per-FM boundary PA.
 *   B5. NO STATUS ROUND-UP (prepare-only; decision в / [[project_autonomy_obedience_balance]]) — the
 *       runner NEVER transitions FM status (F.10 is the owner's ratification); the child complete-
 *       feature's `honest_unmet` is carried VERBATIM into the batch report; a below-τ FM is never
 *       rounded to done.
 *   B6. NO SILENT TRUNCATION — every skipped FM/stage is logged AND in the report (`skipped`); a failed
 *       stage marks the FM failed-at-stage and the batch CONTINUES to the next FM (degrade loud — one
 *       FM's failure never kills the batch).
 *   B7. BOUNDED + SINGLE-WRITER — FMs run SEQUENTIALLY in a plain `for` loop, an EXPLICIT deviation
 *       from the vision's word "pipeline()": concurrent FM chains would race the single .product/ tree,
 *       the product hooks, AND the canonical PA ledger's next-id allocation (two chains minting the same
 *       PA-NNN — the same single-writer rationale as complete-feature's sequential RESOLVE). Boundedness
 *       = a finite feature list × bounded stages; the child completeness-loop is itself hard-capped.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1, mirrored from complete-feature.mjs / consilium.mjs):
 *   NO fs / Node API / Date.now() / Math.random() / new Date() in this script. Inputs only via `args`.
 *   Every file read, artifact Write/Edit, ledger touch, and checkpoint write happens INSIDE an agent()
 *   via Bash. FMs run sequentially (B7); the child completeness-loop is invoked via workflow().
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect — never executed; it also
 * enforces the MDP model-pin on every agent() call). A live run needs a pilot with ≥2 planned FMs
 * (separate session). /product:batch-enrich dispatches this via Workflow({scriptPath}); it falls back
 * to inline prose if the path is unresolvable.
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent (or the /product:batch-enrich
// dispatch) may pass a JSON string. Parse defensively, then read the fields.
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURES_ARG = Array.isArray(A.features) ? A.features.filter(Boolean) : []   // B1: the explicit target list
const ALL_PLANNED = A.all_planned === true || A.allPlanned === true                // alternative: discover status:planned FMs
const MAX_WAVES = A.max_waves || A.maxWaves || 3                                    // passed through to the child complete-feature (its hard cap)
const EPSILON = typeof A.epsilon === 'number' ? A.epsilon : 0.01                    // passed through to the child (Δscore convergence floor)
const DRY_RUN = !!(A.dry_run || A.dryRun)                                           // passed through to the child (SCORE + SURFACE only)

// complete-feature.mjs resolution (B3): the deployed `.claude/`-prefixed location first (FB-LR-18),
// then the repo-form for a dev/worktree run — the anchor agent picks the first that exists.
// Overridable via args.complete for dev runs.
const COMPLETE_CANDIDATES = A.complete
  ? [A.complete]
  : ['.claude/product/processes/complete-feature.mjs', 'product/processes/complete-feature.mjs']
// The EXISTING enrichment command doc whose F.2→F.7 procedure the ENRICH stage orchestrates (B3):
// deployed `.claude/`-prefixed first, then the repo-form (same two-candidate pattern as consilium's SYNTH_CANDIDATES).
const FEATURE_DOC_CANDIDATES = ['.claude/commands/product/feature.md', 'commands/product/feature.md']

// FB-LR-23 (parallel-worktree PA-id safety): every escalation / boundary-PA write below targets the
// SINGLE canonical pending-actions file (the main checkout) + allocates its id from it — a worktree-
// local copy lets parallel runs mint the same PA-NNN. Copied VERBATIM from complete-feature.mjs /
// consilium.mjs (the PA write lives inside an agent prompt — there is no shared lib to import). Do NOT edit.
const PA_CANON = 'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '
  + 'one .git but have SEPARATE working trees, so a worktree-local `.claude/pending-actions.md` lets PA-ids collide '
  + 'across concurrent runs (two trees each mint the same PA-NNN). Resolve the SINGLE canonical file ONCE: run '
  + '`git worktree list --porcelain` and take the FIRST `worktree <path>` line (the main checkout, shared by every '
  + 'worktree) → `<that-path>/.claude/pending-actions.md`; if not inside a git worktree, fall back to '
  + '`.claude/pending-actions.md`. READ / SCAN / allocate the next PA-NNN (highest existing id + 1) / APPEND against '
  + 'THAT canonical file — never a worktree-local copy. Do NOT `git add` or commit the pending-actions file (it may '
  + 'live in another checkout; committing it from this worktree would write into a foreign tree) — leave it as '
  + 'working-tree state. '

// B1 refusal envelope (target-less guard) — a well-formed report the caller surfaces, never a throw.
// Mirrors consilium's refusal() shape adapted to the batch report.
function refusal(reason) {
  return {
    features: [],
    processed: [],
    skipped: [],
    escalated_total: 0,
    checkpoint_dir: null,
    refused: true,
    reason,
    caveats: [reason, 'PREPARE-ONLY: this runner never transitions FM status and never unlocks F.10/handoff — the owner ratifies.'],
  }
}

// FB-002 precedent: refuse to run with NO target rather than scanning .product/ and guessing which FMs.
if (!FEATURES_ARG.length && !ALL_PLANNED) {
  log('HALT: no target — refusing to run. Pass args as an OBJECT, e.g. {features:["FM-001","FM-003"]} or {all_planned:true}.')
  return refusal('batch-enrich: no target (pass {features:["FM-NNN", ...]} or {all_planned:true}).')
}

// ---- schemas ---------------------------------------------------------------------------------
const ANCHOR_SCHEMA = {
  type: 'object',
  required: ['root'],
  properties: {
    root: { type: 'string' },               // the SINGLE anchored run root (FB-LR-28) — absolute run cwd
    feature_doc: { type: 'string' },         // resolved commands/product/feature.md path (first candidate that exists)
    complete_path: { type: 'string' },       // resolved complete-feature.mjs path (first candidate that exists)
  },
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  required: ['features'],
  properties: {
    features: { type: 'array', items: { type: 'string' } },   // FM ids with frontmatter status: planned
  },
}

const CHECKPOINT_SCHEMA = {
  type: 'object',
  required: ['resume'],
  properties: {
    resume: { type: 'object' },              // { "<FM>": {enrich:bool, complete:bool, gate:bool} } — per-FM stage_done read from existing state files
    manifest_path: { type: 'string' },
  },
}

const STATUS_SCHEMA = {
  type: 'object',
  required: ['exists'],
  properties: {
    exists: { type: 'boolean' },             // the FM file resolved under .product/features/
    status: { type: 'string' },              // FM frontmatter status (planned|in-progress|shipped|deprecated)
    has_ui: { type: 'boolean' },
    stages_done: { type: 'object' },         // {enrich, complete, gate} read from the checkpoint state file (if present)
    skip: { type: 'boolean' },               // true ⇒ do not process this FM (missing file, etc.)
    reason: { type: 'string' },
  },
}

const ENRICH_SCHEMA = {
  type: 'object',
  required: ['authored'],
  properties: {
    authored: { type: 'array', items: { type: 'string' } },   // artifact ids written via the normal authoring path (hooks fired)
    escalated: {                                              // real DECISIONS pushed to the canonical ledger (B4) — NOT decided inline
      type: 'array',
      items: { type: 'object', properties: { pa_id: { type: 'string' }, decision_key: { type: 'string' } } },
    },
    skipped_steps: { type: 'array', items: { type: 'string' } },   // F.8 / F.9 (+ any conditional step) logged as skipped
    notes: { type: 'string' },
  },
}

const CHECKPOINT_UPDATE_SCHEMA = {
  type: 'object',
  required: ['written'],
  properties: {
    written: { type: 'boolean' },
    stage: { type: 'string' },
  },
}

const GATE_SCHEMA = {
  type: 'object',
  required: ['boundary_pa'],
  properties: {
    boundary_pa: {
      type: 'object',
      properties: { pa_id: { type: 'string' }, updated_in_place: { type: 'boolean' } },
    },
    note: { type: 'string' },
  },
}

// ===============================================================================================

// ---- Plan: anchor the run root + resolve the feature doc + the child runner ONCE (FB-LR-28) ----
phase('Plan')
const anchor = await agent(
  `Anchor this batch-enrich run ONCE (FB-LR-28 path-anchoring).\n`
  + `1) Run \`pwd\` (or \`git rev-parse --show-toplevel\`) via Bash to get the absolute run root.\n`
  + `2) Resolve the /product:feature command doc: test each candidate under the run root, in order, and return the FIRST that EXISTS (via Bash \`test -f\`): ${JSON.stringify(FEATURE_DOC_CANDIDATES)}. If none exists, return the first candidate anyway (the Enrich stage surfaces the failure honestly).\n`
  + `3) Resolve the child completeness-loop runner: same \`test -f\` pattern over ${JSON.stringify(COMPLETE_CANDIDATES)}; return the FIRST that exists (else the first candidate).\n`
  + `Return {root: <absolute run cwd>, feature_doc: <resolved feature.md path>, complete_path: <resolved complete-feature.mjs path>}. This single root anchors EVERY stage's paths for the whole run — do NOT switch checkouts mid-run.`,
  { model: 'sonnet', schema: ANCHOR_SCHEMA, phase: 'Plan', label: 'anchor-root' },   // MDP: resolve run root + doc/runner paths (pwd/test -f — mechanical)
)
const ANCHOR_ROOT = (anchor && anchor.root) || '.'
const FEATURE_DOC = (anchor && anchor.feature_doc) || FEATURE_DOC_CANDIDATES[0]
const COMPLETE_PATH = (anchor && anchor.complete_path) || COMPLETE_CANDIDATES[0]
log(`anchored run root (FB-LR-28): ${ANCHOR_ROOT}; feature doc: ${FEATURE_DOC}; child runner: ${COMPLETE_PATH}`)

// ---- Plan: resolve the target feature set (B1 — explicit target, no silent expansion) ----------
// features[] takes precedence (the explicit list); all_planned is the discovery alternative. The
// discovered list is LOGGED before any work — discovery never silently expands the batch (B1).
let FEATURES = FEATURES_ARG.slice()
if (!FEATURES.length && ALL_PLANNED) {
  const discovery = await agent(
    `Discover the planned feature set for a batch-enrich run (B1 — the discovered list is LOGGED before any work; discovery NEVER silently expands the batch).\n`
    + `ANCHORED ROOT (FB-LR-28): ${ANCHOR_ROOT} — build every path from it.\n`
    + `Glob ${ANCHOR_ROOT}/.product/features/FM-*.md; read each file's frontmatter \`status\`; return the ids whose status is EXACTLY "planned" as {features:["FM-NNN", ...]}. Read-only — do NOT edit or enrich anything.`,
    { model: 'sonnet', schema: DISCOVERY_SCHEMA, phase: 'Plan', label: 'discover-planned' },   // MDP: glob + frontmatter status read (mechanical recon)
  )
  FEATURES = (discovery && Array.isArray(discovery.features)) ? discovery.features.filter(Boolean) : []
  log(`--all-planned discovery (B1, logged before any work): ${FEATURES.length} planned FM(s) — [${FEATURES.join(', ')}]`)
  if (!FEATURES.length) {
    log('HALT: --all-planned discovered ZERO status:planned FMs — nothing to enrich.')
    return refusal('batch-enrich: --all-planned found no status:planned FMs under .product/features/.')
  }
}
// Sort for a deterministic batch-slug + a stable processing order (single-writer, B7). Sorting is
// pure JS (no Date/random) — the slug must be identical across a resume so the checkpoint dir is reused.
FEATURES = FEATURES.slice().sort()

// ---- batch-slug — DETERMINISTIC from the sorted feature list, NO timestamps (B2) ----------------
// ≤4 FMs → join with '+' (readable, e.g. FM-001+FM-003); more → a bounded first-to-last-xN form so the
// dir name stays short. Pure string derivation — no Date.now()/random (harness constraint).
const BATCH_SLUG = FEATURES.length <= 4
  ? FEATURES.join('+')
  : `${FEATURES[0]}-to-${FEATURES[FEATURES.length - 1]}-x${FEATURES.length}`
const CHECKPOINT_DIR = `${ANCHOR_ROOT}/.product/.batch-enrich/${BATCH_SLUG}`
log(`batch: ${FEATURES.length} FM(s) [${FEATURES.join(', ')}]; slug=${BATCH_SLUG}; checkpoint dir=${CHECKPOINT_DIR}`)

// ---- Plan: CHECKPOINT-FIRST write (B2) — BEFORE the first enrichment touch ----------------------
// урок E1 (session-limit on batches): the manifest + the read of any existing per-FM state MUST land
// before any enrichment work, so a mid-run session limit resumes cleanly. This is the checkpoint-first
// write; it happens BEFORE the for loop below.
const manifest = {
  features: FEATURES,
  stages: ['enrich', 'complete', 'gate'],
  created_by_run_note: 'batch-enrich-feature-set runner (Product C-i, DEC-DEV-0145) — checkpoint-first manifest, written once; resume reads the per-FM state files, never this.',
}
const checkpoint = await agent(
  `Checkpoint-FIRST write for the batch-enrich run (урок E1: a batch can hit a session limit mid-run, so the manifest MUST be written BEFORE the first enrichment touch — B2).\n`
  + `ANCHORED ROOT (FB-LR-28): ${ANCHOR_ROOT}.\n`
  + `1) mkdir -p ${CHECKPOINT_DIR} (the batch dir; the slug is deterministic from the sorted feature list — no timestamps, which avoids write races, B2).\n`
  + `2) If ${CHECKPOINT_DIR}/manifest.json is ABSENT, Write it ONCE, byte-for-byte:\n${JSON.stringify(manifest)}\nIf it is PRESENT, LEAVE it untouched (idempotent resume — never overwrite an existing manifest).\n`
  + `3) READ every per-FM state file ${CHECKPOINT_DIR}/<FM>.json that EXISTS for these FMs: ${JSON.stringify(FEATURES)}. Each holds {stage_done:{enrich,complete,gate}, notes}. Return their stage_done maps as {resume: {"<FM>": {enrich:<bool>, complete:<bool>, gate:<bool>}}} — an FM with NO state file is simply absent from resume (it starts fresh).\n`
  + `Return {resume, manifest_path:"${CHECKPOINT_DIR}/manifest.json"}. Do NOT touch any .product/ artifact and do NOT commit — this is checkpoint bookkeeping only.`,
  { model: 'sonnet', schema: CHECKPOINT_SCHEMA, phase: 'Plan', label: 'checkpoint-first' },   // MDP: mkdir + manifest write + per-FM state read (mechanical bookkeeping)
)
const resumeMap = (checkpoint && checkpoint.resume) || {}
const resumeCount = Object.keys(resumeMap).length
log(`checkpoint-first done (B2): manifest at ${CHECKPOINT_DIR}/manifest.json; ${resumeCount} FM(s) have prior state → resume-aware`)

// ---- report accumulators (B6: surfaced, never silently dropped) --------------------------------
const processed = []       // [{feature, enrich, complete:{final_score,tau,met,stop,honest_unmet}, gate_pa, failed_at}]
const skipped = []         // [{feature, stage, reason}] — every skip logged AND reported (B6)
let escalatedTotal = 0     // decisions escalated across ENRICH + the child completeness-loop

// ---- the SEQUENTIAL batch loop — plain `for`, ONE FM at a time (B7 single-writer) --------------
// EXPLICIT deviation from the vision's word "pipeline()": concurrent FM chains would race the single
// .product/ tree, the product hooks, AND the canonical PA ledger's next-id allocation (two chains
// minting the same PA-NNN). Sequential = the same single-writer rationale as complete-feature's RESOLVE.
for (const FM of FEATURES) {
  const done = resumeMap[FM] || {}

  // RESUME (B2): an FM with ALL stages done is SKIPPED — logged + reported, NEVER silent.
  if (done.enrich && done.complete && done.gate) {
    log(`${FM}: checkpoint says all stages done → SKIP (resume semantics, B2)`)
    skipped.push({ feature: FM, stage: 'all', reason: 'checkpoint: all stages already done (resume)' })
    processed.push({ feature: FM, enrich: 'skipped-resume', complete: null, gate_pa: null, failed_at: null })
    continue
  }

  phase('Enrich')
  let failedAt = null
  let enrichResult = null
  let completeSummary = null
  let gatePa = null
  const escalatedForFm = []   // this FM's escalated decision PAs (ENRICH + COMPLETE) — the GATE lists them

  // ---- STATUS (verify-before-act, DEC-DEV-0093): resolve the FM file + read its frontmatter -----
  let status = null
  try {
    status = await agent(
      `Pre-check feature ${FM} for the batch-enrich run (verify-before-act, DEC-DEV-0093).\n`
      + `ANCHORED ROOT (FB-LR-28): ${ANCHOR_ROOT} — build every path from it.\n`
      + `1) Resolve the FM file ${ANCHOR_ROOT}/.product/features/${FM}-*.md (Glob). If it does NOT exist, return {exists:false, skip:true, reason:"FM file not found"}.\n`
      + `2) Read its frontmatter: \`status\` + \`has_ui\`.\n`
      + `3) This FM's checkpoint state file is ${CHECKPOINT_DIR}/${FM}.json (may be absent). Report its stage_done as \`stages_done\` if present, else {}.\n`
      + `Resume state already read up front for this FM: ${JSON.stringify(done)}.\n`
      + `Return {exists:true, status, has_ui, stages_done, skip:false, reason:""}. READ-ONLY — do NOT edit anything and do NOT change FM status.`,
      { model: 'sonnet', schema: STATUS_SCHEMA, phase: 'Enrich', label: `status:${FM}` },   // MDP: resolve FM file + read frontmatter/checkpoint (mechanical recon)
    )
  } catch (e) {
    log(`${FM}: STATUS stage threw (${(e && e.message) || 'agent error'}) — failed-at-status, continuing batch (B6)`)
    failedAt = 'status'
  }
  if (!failedAt && (!status || status.exists === false || status.skip === true)) {
    const reason = (status && status.reason) || 'FM file not found / unreadable'
    log(`${FM}: SKIP at status — ${reason}`)
    skipped.push({ feature: FM, stage: 'status', reason })
    continue
  }
  // An explicitly-targeted FM that is not status:planned proceeds (the explicit list is the owner's
  // call, B1) — but LOUDLY: enriching an in-progress/shipped FM is unusual and must not pass silently.
  if (!failedAt && status && status.status && status.status !== 'planned') {
    log(`${FM}: frontmatter status is "${status.status}" (not "planned") — proceeding on the explicit target (B1), but flag this to the owner if unexpected`)
  }

  // ---- ENRICH (opus — real authoring judgment): EXECUTE the feature.md F.2→F.7 procedure (B3) ----
  // Gates replaced by PA-escalation (B4); derivations proceed via the NORMAL authoring path so hooks
  // fire; F.8/F.9 skipped + logged; FM status untouched (B5). Idempotent, keyed on artifact id.
  if (!failedAt && !done.enrich) {
    try {
      enrichResult = await agent(
        `Enrich feature ${FM} (Product C-i batch step) — EXECUTE the procedure of the EXISTING command doc ${FEATURE_DOC}, ENRICHMENT mode, stages F.2→F.7 (Scenario Authoring → Business Rule Extraction → Lifecycle Derivation → Invariant Check → NFR Ask/Define → VC Derivation → RPM Update).\n`
        + `ANCHORED ROOT (FB-LR-28): ${ANCHOR_ROOT} — build every path from it. Product dir: ${ANCHOR_ROOT}/.product/.\n`
        + `ORCHESTRATE, DON'T DUPLICATE (vision cut #4; [[feedback_orchestrate_not_duplicate]]): READ ${FEATURE_DOC} and FOLLOW its steps — this batch runner carries NO authoring logic of its own (no SC/BR templates, no field lists). If ${FEATURE_DOC} is unreadable, say so plainly in \`notes\` and do NOT improvise a substitute procedure.\n`
        + `RAW-SOURCE RAIL (FB-LR-31): READ the raw artifacts under ${ANCHOR_ROOT}/.product/ YOURSELF — the FM file ${ANCHOR_ROOT}/.product/features/${FM}-*.md + its linked SC/BR/LC/VC/IC/NFR (and MK/NM if has_ui). This brief deliberately does NOT paraphrase them (a lossy paraphrase would hide the very gap you author against).\n`
        + `GATE-REPLACEMENT (decision д / B4): the per-item human APPROVES in ${FEATURE_DOC} are REPLACED for this batch run by L1 PA-escalation. Anything that is a real DECISION under the gap-classifier vocabulary (threshold / moscow / *-semantic / screen-decision / the NFR F.5a.0 [Y/D/L] call / ANYTHING you are genuinely unsure of) is ESCALATED to the canonical pending-actions ledger instead of being decided inline.\n`
        + PA_CANON
        + `For EACH such decision: allocate the next PA-NNN and APPEND a concise entry (feature ${FM}, the decision + its gap-classifier category, the route); if an equivalent PA already exists for this feature+decision, UPDATE it in place (PA-dedup, DEC-DEV-0089).\n`
        + `Derivable, convention-bound authoring PROCEEDS via the NORMAL authoring path — Write/Edit the .product/ artifacts (SC skeletons from the FM, BR extraction from SC step text, LC/VC/RPM derivations) so the existing validation/cascade/BG/zone-router hooks fire. IDEMPOTENT, keyed on artifact id: UPDATE IN PLACE, NEVER append a near-duplicate (DEC-DEV-0089).\n`
        + `SKIP F.8 (design module / P2.5) and F.9 (FM-level Product DA review) — conditional/optional stages OUT OF C-i scope; record them in \`skipped_steps\`.\n`
        + `Do NOT touch the FM status: F.10 (planned → in-progress) is the OWNER's ratification — this runner NEVER transitions FM status (B5).\n`
        + `Return {authored:[<artifact ids written>], escalated:[{pa_id, decision_key}], skipped_steps:[...], notes}.`,
        { model: 'opus', schema: ENRICH_SCHEMA, phase: 'Enrich', label: `enrich:${FM}` },   // MDP: real authoring judgment executing feature.md F.2→F.7 + decision-vs-derivation calls (opus)
      )
      const enrEsc = (enrichResult && Array.isArray(enrichResult.escalated)) ? enrichResult.escalated : []
      for (const q of enrEsc) escalatedForFm.push({ pa_id: (q && q.pa_id) || null, decision_key: (q && q.decision_key) || '', from: 'enrich' })
      escalatedTotal += enrEsc.length
      log(`${FM}: ENRICH done — authored=${((enrichResult && enrichResult.authored) || []).length}; escalated=${enrEsc.length}; skipped-steps=[${((enrichResult && enrichResult.skipped_steps) || []).join(', ')}]`)
      // Checkpoint update (single writer for THIS FM, B2/B7): mark enrich done AFTER the work landed.
      await agent(
        `Update the batch-enrich checkpoint for ${FM}: mark stage "enrich" done.\n`
        + `ANCHORED ROOT: ${ANCHOR_ROOT}. State file: ${CHECKPOINT_DIR}/${FM}.json (SINGLE writer — this FM only, no shared-file race, B7).\n`
        + `Read it if present (else start from {stage_done:{enrich:false,complete:false,gate:false}, notes:""}); set stage_done.enrich=true; Write it back IN PLACE (idempotent, keyed on FM id — NEVER timestamped, no Date). Return {written:true, stage:"enrich"}.`,
        { model: 'sonnet', schema: CHECKPOINT_UPDATE_SCHEMA, phase: 'Enrich', label: `ckpt:enrich:${FM}` },   // MDP: single-writer checkpoint state update (mechanical)
      )
    } catch (e) {
      log(`${FM}: ENRICH stage threw (${(e && e.message) || 'agent error'}) — failed-at-enrich, continuing batch (B6)`)
      failedAt = 'enrich'
    }
  } else if (!failedAt && done.enrich) {
    log(`${FM}: ENRICH already done (resume) — skipping to COMPLETE`)
  }

  // ---- COMPLETE (B3): DELEGATE to the child completeness-loop via workflow() — reuse, not re-run --
  // workflow() THROWS on an unreadable scriptPath — try/catch: on throw, mark the stage failed +
  // continue (degrade loud, B6); do NOT re-implement the wave loop inline (vision cut #4).
  if (!failedAt && !done.complete) {
    phase('Complete')
    try {
      const child = await workflow({ scriptPath: COMPLETE_PATH }, {
        feature: FM,
        maxWaves: MAX_WAVES,
        epsilon: EPSILON,
        dryRun: DRY_RUN,
      })
      // B5: carry the child's honesty VERBATIM — never round a below-τ FM up to done.
      completeSummary = {
        final_score: (child && child.final_score) != null ? child.final_score : null,
        tau: (child && child.tau) != null ? child.tau : null,
        met: !!(child && child.met),
        stop: (child && child.stop) || null,
        honest_unmet: (child && child.honest_unmet) || '',
      }
      const childEsc = (child && Array.isArray(child.escalated)) ? child.escalated : []
      for (const q of childEsc) escalatedForFm.push({ pa_id: (q && q.pa_id) || null, decision_key: (q && q.decision_key) || '', from: 'complete' })
      escalatedTotal += childEsc.length
      log(`${FM}: COMPLETE (child completeness-loop) — score=${completeSummary.final_score} (τ=${completeSummary.tau}, met=${completeSummary.met}); stop=${completeSummary.stop && completeSummary.stop.status}; escalated=${childEsc.length}${completeSummary.honest_unmet ? `; honest_unmet: ${completeSummary.honest_unmet}` : ''}`)
      await agent(
        `Update the batch-enrich checkpoint for ${FM}: mark stage "complete" done.\n`
        + `ANCHORED ROOT: ${ANCHOR_ROOT}. State file: ${CHECKPOINT_DIR}/${FM}.json (SINGLE writer — this FM only, B7).\n`
        + `Read it if present (else start from {stage_done:{enrich:false,complete:false,gate:false}, notes:""}); set stage_done.complete=true; Write it back IN PLACE (idempotent, keyed on FM id — no Date). Return {written:true, stage:"complete"}.`,
        { model: 'sonnet', schema: CHECKPOINT_UPDATE_SCHEMA, phase: 'Complete', label: `ckpt:complete:${FM}` },   // MDP: single-writer checkpoint state update (mechanical)
      )
    } catch (e) {
      // workflow() unresolvable / threw — degrade loud, do NOT re-implement the loop inline (B3/B6).
      log(`${FM}: COMPLETE delegation threw (${(e && e.message) || 'workflow scriptPath unresolvable'}) — failed-at-complete, continuing batch (B6). Runner path was ${COMPLETE_PATH}.`)
      failedAt = 'complete'
    }
  } else if (!failedAt && done.complete) {
    log(`${FM}: COMPLETE already done (resume) — skipping to GATE`)
  }

  // ---- GATE (B4): write/update the ONE per-FM phase-boundary PA (prepare-only, B5) ----------------
  if (!failedAt && !done.gate) {
    phase('Gate')
    try {
      const gate = await agent(
        `Write the batch-enrich PHASE-BOUNDARY pending-action for feature ${FM} (decision д / B4 — the human gate moved from per-item approve to a phase boundary; this is PREPARE-ONLY).\n`
        + PA_CANON
        + `APPEND a single boundary PA — or UPDATE IT IN PLACE if one already exists for this feature's batch-enrich boundary (PA-dedup, DEC-DEV-0089) — with this text: "batch-enrich prepared ${FM} — enrichment + completeness done up to the escalated decisions; owner ratifies before F.10/handoff."\n`
        + `List this FM's escalated decision PAs from this run (so the owner ratifies from the ledger, not per item): ${JSON.stringify(escalatedForFm)}. When updating an EXISTING boundary PA, MERGE this list with the escalation list already recorded there — never drop prior entries (a resumed run whose enrich stage completed earlier passes an empty list here; the prior PA text is the record).\n`
        + `Add an explicit line: "Owner ratifies — F.10/handoff is NOT unlocked by this batch run."\n`
        + `Do NOT change any PA status to done/dismissed. Do NOT edit any spec/FM. Do NOT transition FM status (B5). Do NOT commit. Return {boundary_pa:{pa_id, updated_in_place}, note}.`,
        { model: 'sonnet', schema: GATE_SCHEMA, phase: 'Gate', label: `gate:${FM}` },   // MDP: phase-boundary PA write/update-in-place from a fixed package (mechanical write)
      )
      gatePa = (gate && gate.boundary_pa && gate.boundary_pa.pa_id) || null
      log(`${FM}: GATE — boundary PA ${gatePa || '(none returned)'}${gate && gate.boundary_pa && gate.boundary_pa.updated_in_place ? ' (updated in place)' : ''}`)
      await agent(
        `Update the batch-enrich checkpoint for ${FM}: mark stage "gate" done.\n`
        + `ANCHORED ROOT: ${ANCHOR_ROOT}. State file: ${CHECKPOINT_DIR}/${FM}.json (SINGLE writer — this FM only, B7).\n`
        + `Read it if present (else start from {stage_done:{enrich:false,complete:false,gate:false}, notes:""}); set stage_done.gate=true; Write it back IN PLACE (idempotent, keyed on FM id — no Date). Return {written:true, stage:"gate"}.`,
        { model: 'sonnet', schema: CHECKPOINT_UPDATE_SCHEMA, phase: 'Gate', label: `ckpt:gate:${FM}` },   // MDP: single-writer checkpoint state update (mechanical)
      )
    } catch (e) {
      log(`${FM}: GATE stage threw (${(e && e.message) || 'agent error'}) — failed-at-gate, continuing batch (B6)`)
      failedAt = 'gate'
    }
  } else if (!failedAt && done.gate) {
    log(`${FM}: GATE already done (resume)`)
  }

  // Record the FM outcome (B6: failed-at-stage surfaced, never silently dropped).
  processed.push({
    feature: FM,
    enrich: enrichResult ? { authored: enrichResult.authored || [], escalated: (enrichResult.escalated || []).length, skipped_steps: enrichResult.skipped_steps || [] } : (done.enrich ? 'done-prior' : null),
    complete: completeSummary || (done.complete ? 'done-prior' : null),   // B5: honest_unmet carried verbatim
    gate_pa: gatePa || (done.gate ? 'done-prior' : null),
    failed_at: failedAt,
  })
  if (failedAt) log(`${FM}: recorded failed_at=${failedAt} — batch continues (B6)`)
}

// ---- Report (B6 / B5: no silent truncation; prepare-only always disclosed) ----------------------
phase('Report')
const failedCount = processed.filter((p) => p.failed_at).length
const caveats = [
  'PREPARE-ONLY: boundary gates are PA-escalations — the owner ratifies; no FM status was transitioned (F.10/handoff is NOT unlocked by this batch run).',
]
if (skipped.length) caveats.push(`${skipped.length} FM/stage skip(s) surfaced (resume-done or unresolvable FM file) — see \`skipped\` (B6, no silent truncation).`)
if (failedCount) caveats.push(`${failedCount} FM(s) failed at a stage and were carried past (degrade loud, B6) — see each processed entry's \`failed_at\`; the batch did not stop.`)
const belowTau = processed.filter((p) => p.complete && typeof p.complete === 'object' && p.complete.met === false)
if (belowTau.length) caveats.push(`${belowTau.length} FM(s) stopped BELOW τ in the completeness-loop — their \`honest_unmet\` is carried verbatim (B5); do NOT round up to done.`)

log(`batch-enrich DONE: ${processed.length} processed, ${skipped.length} skipped, ${failedCount} failed-at-stage; escalated_total=${escalatedTotal}; checkpoint=${CHECKPOINT_DIR}`)

return {
  features: FEATURES,
  processed,                     // [{feature, enrich, complete:{final_score,tau,met,stop,honest_unmet}, gate_pa, failed_at}]
  skipped,                       // [{feature, stage, reason}] — every skip surfaced (B6)
  escalated_total: escalatedTotal,
  checkpoint_dir: CHECKPOINT_DIR,
  caveats,                       // prepare-only + skip/fail/below-τ disclosures — carried, never dropped
  refused: false,
}
