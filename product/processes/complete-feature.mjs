export const meta = {
  name: 'complete-feature',
  description: 'Product B-b — the durable, executable form of the bounded completeness-loop (Autonomous Pipeline Vision, Epic B / B1). Drives one feature\'s D1-D2B spec (FM + SC/BR/LC/VC/IC/NFR, MK/NM if has_ui) toward handoff-DoR-sufficient completeness in BOUNDED waves: the deterministic completeness-oracle is the EXTERNAL stop-signal (never self-grading), heterogeneous profile personas (architect/qa/ux-advisor) name each zone\'s gaps from the RAW artifacts, the deterministic gap-classifier splits resolvable derivations from real decisions, resolvable are auto-fixed (conservative whitelist + verify-before-act), decisions escalate to the canonical pending-actions ledger. Stop is external + bounded (hard cap ∧ (score≥τ ∨ Δ<ε ∨ decisions-only)). Invoked by /product:complete <FM-id>. The skill skills/product/completeness-loop.md remains the SSOT for the wave semantics.',
  phases: [
    { title: 'Score' },
    { title: 'Surface' },
    { title: 'Resolve' },
    { title: 'Escalate' },
    { title: 'CloseOut' },
  ],
}

/*
 * Product process B-b `complete-feature` — the executable form of the completeness-loop
 * (DEC-DEV-0098 skill; Wave B / B-b, dev/CONSOLIDATED_EXECUTION_PLAN.md §4.1). The behavioral
 * contract + the five HARD RAILS live in skills/product/completeness-loop.md (the SSOT); this
 * script is its bounded, deterministic executor. Do NOT duplicate the skill prose — read it.
 *
 * FIVE RAILS (from the vision research; enforced HERE, not just documented):
 *   1. The stop-signal is EXTERNAL + deterministic — completeness-oracle.cjs, never the model
 *      grading its own artifact (Huang et al. 2310.01798). The oracle runs inside an agent()
 *      (harness has no fs), but its verdict is a pure function of .product/ state.
 *   2. BOUNDED — a HARD cap in CODE (`for wave<=MAX_WAVES`) + convergence (Δ<ε) + decisions-only
 *      info-gain→0. The loop MUST terminate regardless of any agent/classifier behaviour.
 *   3. τ anchored to the DoR (oracle's computed blockers), never to perfection.
 *   4. Decisions ESCALATE (canonical pending-actions), only resolvable DERIVATIONS auto-fix.
 *   5. NO silent truncation — every wave logs; the report surfaces residual + delegated_unverified
 *      + an honest_unmet plain-words note when we stop below τ (never round a partial spec to done).
 *
 * STOP AUTHORITY vs SAFETY MIRROR (the explicit division rail 1/2 demand):
 *   - The gap-classifier.cjs is the STOP AUTHORITY. It receives {oracle, persona_findings, wave,
 *     max_waves, epsilon, resolved_last_wave} and returns stop:{fire,status,reasons}. An agent()
 *     only TRANSPORTS its stdout — the stop LOGIC is the deterministic .cjs, not the LLM.
 *   - This .mjs ALSO keeps its OWN belt-and-suspenders in CODE so a classifier bug can neither
 *     make the loop unbounded nor round up to "done": (a) the for-bound hard cap; (b) a cheap
 *     pre-SURFACE met-check (met && nothing resolved last wave → success, skip a wasteful wave);
 *     (c) a post-classify in-code met-check + Δ<ε mirror. The classifier's stop.fire is honored;
 *     the in-code mirrors are the redundant floor.
 *
 * SEQUENCING (why the classifier runs ONCE per wave, after SURFACE): the two stop conditions that
 * need no persona findings (already-met-with-no-progress; the cap) are handled in code (b + the
 * for-bound). Everything else — converged / decisions_only + the resolvable/decision split — needs
 * the surfaced findings, so: SCORE → in-code early-exit → SURFACE → CLASSIFY (full verdict + split)
 * → RESOLVE → ESCALATE → honor stop.fire. One classifier call per wave, never two.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1, mirrored from orchestrator/*.mjs): NO fs / Node API /
 * Date.now() / Math.random() / new Date() in the script. Inputs only via `args`. Every oracle run /
 * classifier run / file read / persona / fix / escalation happens INSIDE an agent() via Bash.
 * Personas run in parallel(); resolves run SEQUENTIALLY (single-writer — a fix triggers .product
 * hooks; sequential avoids a hook/cascade race, mirroring P6 remediation).
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect — strip `export `, parse the
 * body as an AsyncFunction with the injected globals; never executed). A live run needs a pilot
 * feature with a real oracle<1 gap (B-d calibration, separate session). /product:complete dispatches
 * this via Workflow({scriptPath}); it falls back to the skill prose inline if the path is unresolvable.
 */

// Defend against a stringified args payload — the harness forwards `args` verbatim and an invoking
// agent (or the /product:complete dispatch) may pass a JSON string. (Mirrors orchestrator FB-001.)
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURE = A.feature || ''                                                       // FM-NNN id
const MAX_WAVES = A.maxWaves || 3                                                     // rail 2: hard cap (community: reflection plateaus by ~round 2-3)
const EPSILON = typeof A.epsilon === 'number' ? A.epsilon : 0.01                      // rail 2: Δscore convergence floor
const DRY_RUN = !!A.dryRun                                                            // SCORE + SURFACE only; no auto-fix / no escalation writes
// .claude/-prefixed DEPLOY locations (FB-LR-18 precedent); overridable via args for dev runs.
const ORACLE = A.oracle || '.claude/hooks/product/lib/completeness-oracle.cjs'        // the external stop-signal
const CLASSIFIER = A.classifier || '.claude/hooks/product/lib/gap-classifier.cjs'     // the deterministic stop-verdict + gap split (built in parallel to this exact contract)

// Refuse to run target-less rather than throwing silently or scanning .product/ and guessing (FB-002
// precedent). Return a well-formed error report so the caller can surface it.
if (!FEATURE) {
  log('HALT: empty feature — refusing to run. Pass args as an OBJECT, e.g. {feature:"FM-001"}.')
  return {
    error: 'complete-feature: empty feature id (pass {feature:"FM-NNN"})',
    feature: '', waves_run: 0, final_score: 0, tau: 1.0, met: false,
    stop: { status: 'error', reasons: ['no feature id supplied'] },
    honest_unmet: 'No feature id was supplied — nothing was scored or resolved. This is NOT a completed spec.',
  }
}

// ---- CLASSIFY category enums (mirror the gap-classifier.cjs contract) --------------------------
// Resolvable = a DERIVATION the assistant can complete from existing upstream (auto-fix candidates,
// conservative v1 whitelist). Decisions = strategic / connected / irreversible → escalate (rail 4).
// A persona uses `other` when unsure; the deterministic classifier escalates any unknown.
const RESOLVABLE_KINDS = ['missing-vc', 'missing-lc', 'lc-unlinked-state', 'rpm-role-gap']
const DECISION_KINDS = [
  'fm-status', 'missing-sc', 'br-inactive', 'br-semantic', 'ic-semantic', 'missing-mk',
  'screen-decision', 'threshold', 'moscow', 'nfr-ask', 'broken-ref', 'sc-semantic', 'other',
]

// ---- schemas ---------------------------------------------------------------------------------
const ANCHOR_SCHEMA = {
  type: 'object',
  required: ['root'],
  properties: {
    root: { type: 'string' },                          // the SINGLE anchored run root (FB-LR-28) — absolute run cwd
    product_dir: { type: 'string' },
    fm_file: { type: 'string' },                       // resolved .product/features/<FM>-*.md
  },
}

const ORACLE_SCHEMA = {
  type: 'object',
  required: ['score', 'tau', 'met'],
  properties: {
    feature: { type: 'string' },
    fm_status: { type: 'string' },
    has_ui: { type: 'boolean' },
    blockers: { type: 'array' },                       // [{id,name,status,detail}] — status ∈ pass|fail|n/a
    score: { type: 'number' },
    tau: { type: 'number' },
    met: { type: 'boolean' },
    gaps: { type: 'array', items: { type: 'string' } },        // STRINGS, e.g. "B4: 2 active SC have no active VC: SC-001"
    ambiguities: { type: 'array', items: { type: 'string' } }, // strings (W-class)
    delegated_unverified: { type: 'array' },           // [{id,name,via}] — B5/B6/B8, NOT computed by the oracle (rail 5)
  },
}

const GAPS_SCHEMA = {
  type: 'object',
  required: ['clean', 'findings'],
  properties: {
    clean: { type: 'boolean' },                        // true iff the persona found NO gap for its lens
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['artifact_id', 'category', 'description'],
        properties: {
          artifact_id: { type: 'string' },
          zone: { type: 'string' },
          category: { type: 'string', enum: [...RESOLVABLE_KINDS, ...DECISION_KINDS] },
          description: { type: 'string' },
          proposed_fix: { type: 'string' },
        },
      },
    },
  },
}

const GAP_ITEM = {
  type: 'object',
  required: ['category', 'detail'],
  properties: {
    source: { type: 'string' },                        // oracle | <persona>
    key: { type: 'string' },
    category: { type: 'string' },
    detail: { type: 'string' },
    artifact_id: { type: 'string' },
  },
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  required: ['resolvable', 'decisions', 'stop'],
  properties: {
    resolvable: { type: 'array', items: GAP_ITEM },
    decisions: { type: 'array', items: GAP_ITEM },
    stop: {
      type: 'object',
      required: ['fire', 'status'],
      properties: {
        fire: { type: 'boolean' },
        status: { type: 'string', enum: ['met', 'cap', 'converged', 'decisions_only', 'continue'] },
        reasons: { type: 'array', items: { type: 'string' } },
      },
    },
    counts: { type: 'object' },
  },
}

const RESOLVE_SCHEMA = {
  type: 'object',
  required: ['applied'],
  properties: {
    applied: { type: 'boolean' },                      // the derivation was written to the .product/ artifact (idempotent, keyed on id)
    dropped: { type: 'boolean' },                      // verify-before-act found the gap already closed → dropped, not applied (DEC-DEV-0093)
    artifact_id: { type: 'string' },
    note: { type: 'string' },
  },
}

const ESCALATE_SCHEMA = {
  type: 'object',
  required: ['queued'],
  properties: {
    queued: { type: 'array', items: { type: 'object', properties: { pa_id: { type: 'string' }, decision_key: { type: 'string' } } } },
    updated_in_place: { type: 'array' },               // PA-dedup: an equivalent PA already existed for this feature+decision (DEC-DEV-0089)
  },
}

const CLOSEOUT_SCHEMA = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['PASS', 'FAIL', 'PARTIAL'] },
    summary: { type: 'string' },
    findings: { type: 'array' },
  },
}

// FB-LR-23 (parallel-worktree PA-id safety): the escalation must target the SINGLE canonical
// pending-actions file (the main checkout) + allocate its id from it — a worktree-local copy lets two
// parallel runs mint the same PA-NNN. Copied VERBATIM from the orchestrator P4/P5/P6 processes (the
// PA-write lives inside an agent prompt — there is no shared lib to import). Do NOT edit this string.
const PA_CANON = 'CANONICAL pending-actions (FB-LR-23, parallel-worktree safety): parallel git worktrees SHARE '
  + 'one .git but have SEPARATE working trees, so a worktree-local `.claude/pending-actions.md` lets PA-ids collide '
  + 'across concurrent runs (two trees each mint the same PA-NNN). Resolve the SINGLE canonical file ONCE: run '
  + '`git worktree list --porcelain` and take the FIRST `worktree <path>` line (the main checkout, shared by every '
  + 'worktree) → `<that-path>/.claude/pending-actions.md`; if not inside a git worktree, fall back to '
  + '`.claude/pending-actions.md`. READ / SCAN / allocate the next PA-NNN (highest existing id + 1) / APPEND against '
  + 'THAT canonical file — never a worktree-local copy. Do NOT `git add` or commit the pending-actions file (it may '
  + 'live in another checkout; committing it from this worktree would write into a foreign tree) — leave it as '
  + 'working-tree state. '

// ===============================================================================================

// ---- anchor the run root ONCE (FB-LR-28) — every persona brief builds its paths from THIS root -
// A present-but-edited artifact handed at the wrong checkout is a SILENT stale read (no not-found to
// trigger a Glob self-heal). Resolve the run cwd + the feature file ONCE, before the wave loop, and
// thread the same absolute root through every brief for the whole run.
const anchor = await agent(
  `Anchor the run's feature root for ${FEATURE} ONCE (FB-LR-28 path-anchoring). ` +
  `Run \`pwd\` (or \`git rev-parse --show-toplevel\`) via Bash to get the absolute run root, then locate the feature file ` +
  `\`.product/features/${FEATURE}-*.md\` under it (Glob). Return {root: <absolute run cwd>, product_dir: <root>/.product, ` +
  `fm_file: <absolute path to the FM file, or "" if not found>}. This single root anchors EVERY persona brief's paths for ` +
  `the whole run — do NOT switch checkouts mid-run.`,
  { model: 'sonnet', schema: ANCHOR_SCHEMA, phase: 'Score', label: 'anchor-root' },   // MDP: resolve run root + feature file (pwd/glob — mechanical)
)
const ANCHOR_ROOT = (anchor && anchor.root) || '.'
const ANCHOR_FM = (anchor && anchor.fm_file) || `${ANCHOR_ROOT}/.product/features/${FEATURE}-*.md`
log(`anchored run root (FB-LR-28): ${ANCHOR_ROOT}; feature file: ${ANCHOR_FM}`)

// ---- cross-wave accumulators (rail 5: surfaced, never silently dropped) ------------------------
const resolvedAll = []          // [{artifact_id, category, wave, note}] — derivations applied across all waves
const droppedAll = []           // [{artifact_id, category, wave, note}] — verify-before-act dropped (already closed)
const escalatedAll = []         // [{pa_id, decision_key, wave, updated_in_place}] — decisions queued to the canonical ledger
const personasIncomplete = []   // persona names that never returned (after bounded re-spawn) in ANY wave — degrade loud

let prevScore = null            // wave N-1 oracle.score (for Δ convergence + the classifier's prev_score)
let resolvedLastWave = 0        // # derivations applied in wave N-1 (feeds the met-with-no-progress mirror + classifier)
let resolvedAfterLastScore = 0  // # derivations applied SINCE the most recent oracle SCORE — >0 at exit means finalOracle is stale (feeds the final re-score guard)
let finalOracle = null          // the most recent SCORE — the report's source of final_score/met
let stop = null                 // {status, reasons} — set on a break; a for-bound exit means we hit the cap
let wavesRun = 0                // waves that completed SURFACE + CLASSIFY (a pre-SURFACE early-exit does not count)

// ---- the bounded wave loop — HARD cap in CODE (rail 2) -----------------------------------------
for (let wave = 1; wave <= MAX_WAVES; wave += 1) {
  // 1. SCORE — the external, deterministic stop-signal (rail 1). On wave N>1 this IS the re-score
  //    of wave N-1's resolves (the oracle is a pure function of the current .product/ tree).
  const oracle = await agent(
    `Run the completeness-oracle (the EXTERNAL, deterministic stop-signal — NEVER grade completeness by your own judgment):\n` +
    `\`node ${ORACLE} --feature ${FEATURE} --root ${ANCHOR_ROOT}\` via Bash, from the anchored run root. ` +
    `Return its JSON output VERBATIM — {feature, fm_status, has_ui, blockers, score, tau, met, gaps[] (STRINGS), ` +
    `ambiguities[], delegated_unverified[]}. Do NOT add, drop, or reinterpret fields.`,
    { model: 'sonnet', schema: ORACLE_SCHEMA, phase: 'Score', label: `score:wave${wave}` },   // MDP: completeness-oracle JSON relay — the stop-signal is CODE (mechanical transport)
  )
  if (!oracle) {
    // The stop-signal itself failed — cannot proceed without it. Stop honestly (rail 5), do not guess done.
    log(`wave ${wave}: oracle SCORE returned null — cannot judge completeness; stopping honestly`)
    stop = { status: 'oracle_unavailable', reasons: [`oracle run returned null on wave ${wave}`] }
    break
  }
  finalOracle = oracle

  // 2. SAFETY MIRROR (b) — cheap PRE-SURFACE met-check: already at τ and nothing moved last wave →
  //    success without spawning personas (info-gain is zero; the classifier would agree). In-code
  //    floor, redundant to the classifier's 'met' (rail 2).
  if (oracle.met === true && resolvedLastWave === 0) {
    log(`wave ${wave}: oracle.met && no resolve last wave → STOP (met) [in-code pre-surface mirror]`)
    stop = { status: 'met', reasons: [`oracle.met at score ${oracle.score}≥τ ${oracle.tau} and no new resolve last wave`] }
    break
  }

  // 3. SURFACE — resolve each zone's persona on the RAW artifacts (FB-LR-31), paths anchored ONCE
  //    (FB-LR-28). architect + qa always; ux ONLY if has_ui. Canonical subagent_type — NEVER a
  //    general-purpose fallback: a dropped persona is bounded RE-SPAWNed once (P6 slot pattern);
  //    still null → marked incomplete and SURFACED (degrade loud, never silently drop the lens).
  const personas = [
    { name: 'architect-advisor', zone: 'D2-T/feasibility', focus: 'feasibility / structural decomposition / data-state / technical-risk gaps that compound downstream' },
    { name: 'qa-advisor', zone: 'D4/acceptance', focus: 'testability / acceptance completeness / edge & failure paths / VC-coverage of active SC' },
  ]
  if (oracle.has_ui === true) {
    personas.push({ name: 'ux-advisor', zone: 'D2-B04/design', focus: 'flow completeness (happy/alt/error) / UI-state coverage / interaction consistency' })
  }

  const surfaceBrief = (p) =>
    `You are the ${p.name} persona (zone ${p.zone}) in the bounded completeness-loop for feature ${FEATURE} (wave ${wave}).\n` +
    `ANCHORED ROOT (FB-LR-28 — use THIS single root for EVERY path; do NOT switch checkouts): ${ANCHOR_ROOT}\n` +
    `Feature file: ${ANCHOR_FM}. Product dir: ${ANCHOR_ROOT}/.product/.\n` +
    `RAW-SOURCE RAIL (FB-LR-31): READ the raw artifact files YOURSELF — the FM file above and its linked ` +
    `SC/BR/VC/LC/IC/NFR (and MK/NM if has_ui) under ${ANCHOR_ROOT}/.product/. This brief deliberately does NOT paraphrase ` +
    `artifact content (a lossy paraphrase would hide the very gap you look for) — go to the files.\n` +
    `Oracle-computed DoR gaps this wave (your starting lens, NOT the whole story): ${JSON.stringify(oracle.gaps || [])}.\n` +
    `Your zone focus: ${p.focus}.\n` +
    `Report GAPS ONLY (a satisfied dimension is clean:true, NEVER a finding). Each finding is ` +
    `{artifact_id, zone:'${p.zone}', category, description, proposed_fix?}. category MUST be one of the classifier enum — ` +
    `resolvable derivations [${RESOLVABLE_KINDS.join(', ')}] or decisions [${DECISION_KINDS.join(', ')}]; when UNSURE use \`other\` ` +
    `(the deterministic classifier escalates unknowns — do NOT optimistically label a gap resolvable).`

  const spawnPersona = (p) => agent(surfaceBrief(p), { agentType: p.name, schema: GAPS_SCHEMA, phase: 'Surface', label: `surface:${p.name}:wave${wave}` })
  // Crash-safe slot: agent() with an unresolvable agentType may THROW (not just return null) — an
  // uncaught throw would collapse the parallel() thunk to a null SLOT and TypeError the accumulators
  // below. Both attempts are try/caught so the slot ALWAYS returns the {persona, zone, result,
  // incomplete} shape; a throw is treated exactly like a null return. Bounded single re-spawn kept
  // (canonical type ONLY — never general-purpose).
  const runPersonaSlot = async (p) => {
    let r = null
    try { r = await spawnPersona(p) } catch (e) {
      log(`persona ${p.name} threw (${(e && e.message) || 'agent spawn error'}) — treated as dropped`)
    }
    if (!r) {
      log(`persona ${p.name} dropped (null/rejected/threw) — bounded re-spawn 1/1 (canonical type ONLY, never general-purpose)`)
      try { r = await spawnPersona(p) } catch (e) {
        log(`persona ${p.name} threw on re-spawn (${(e && e.message) || 'agent spawn error'}) — lens marked incomplete`)
        r = null
      }
    }
    return { persona: p.name, zone: p.zone, result: r, incomplete: !r }
  }
  const surfaced = await parallel(personas.map((p) => () => runPersonaSlot(p)))
  const incompleteThisWave = surfaced.filter((s) => s.incomplete).map((s) => s.persona)
  for (const name of incompleteThisWave) if (!personasIncomplete.includes(name)) personasIncomplete.push(name)
  const personaFindings = surfaced.flatMap((s) => ((s.result && s.result.findings) || []).map((f) => ({ ...f, persona: s.persona })))
  wavesRun = wave
  log(`wave ${wave}: surfaced ${personaFindings.length} persona finding(s); clean: ${surfaced.filter((s) => s.result && s.result.clean).map((s) => s.persona).join(',') || '∅'}${incompleteThisWave.length ? `; INCOMPLETE lens: ${incompleteThisWave.join(',')}` : ''}`)

  // Findings persistence — a DEDICATED writer step, NOT the personas: the advisors are read-only by
  // design (least-privilege — no Write tool; they also fire as PostToolUse zone-router advisories),
  // so the loop runner persists their returned findings for them. ADVISORY persistence: findings
  // already flow to CLASSIFY via GAPS_SCHEMA above — a failed write never blocks the wave.
  if (personaFindings.length) {
    const persistSchema = { type: 'object', required: ['written'], properties: { written: { type: 'array', items: { type: 'string' } } } }
    const persisted = await agent(
      `Persist this wave's advisor findings for feature ${FEATURE} (wave ${wave}) — the advisor personas are read-only, so YOU write for them.\n` +
      `For EACH persona below that has findings, Write the file ${ANCHOR_ROOT}/.product/.advisor-findings/<persona>-${FEATURE}.md ` +
      `OVERWRITING in place — keyed on persona+feature id, never timestamped, so a re-run overwrites and never appends a ` +
      `near-duplicate (idempotent, DEC-DEV-0140). Content: a short markdown list of that persona's findings — one bullet per ` +
      `finding with artifact_id / category / description / proposed_fix (when present).\n` +
      `The findings (grouped by the \`persona\` key):\n${JSON.stringify(personaFindings)}\n` +
      `Return {written: [<file paths written>]}.`,
      { model: 'sonnet', schema: persistSchema, phase: 'Surface', label: `persist-findings:wave${wave}` },   // MDP: dedicated writer of advisor-findings files (mechanical)
    )
    log(`wave ${wave}: persisted advisor-findings files: ${(persisted && persisted.written && persisted.written.length) || 0} (advisory — findings already carried in-band)`)
  }

  // 4. CLASSIFY — the STOP AUTHORITY. Write the classifier input to a temp file, run the .cjs, relay
  //    its stdout verbatim. The agent is TRANSPORT only — the split + stop verdict are deterministic
  //    code in gap-classifier.cjs (rail 1). One call per wave (sequencing note above).
  const classifyInput = {
    oracle: { score: oracle.score, prev_score: prevScore, tau: oracle.tau, met: oracle.met, gaps: oracle.gaps || [], ambiguities: oracle.ambiguities || [] },
    persona_findings: personaFindings,
    wave,
    max_waves: MAX_WAVES,
    epsilon: EPSILON,
    resolved_last_wave: resolvedLastWave,
  }
  const cls = await agent(
    `Deterministic gap-classification + stop-verdict for feature ${FEATURE}, wave ${wave}. You are the TRANSPORT — the LOGIC ` +
    `is in ${CLASSIFIER} (a pure .cjs). Do NOT classify or decide anything yourself.\n` +
    `1) Write this EXACT JSON to a temp file in your scratchpad (e.g. classify-input.json), byte-for-byte:\n${JSON.stringify(classifyInput)}\n` +
    `2) Run \`node ${CLASSIFIER} <that-file>\` via Bash.\n` +
    `3) Return its stdout JSON VERBATIM — {resolvable:[{source,key,category,detail,artifact_id?}], decisions:[same], ` +
    `stop:{fire,status,reasons}, counts}. Do NOT edit, re-interpret, or add fields. The classifier is the stop authority.`,
    { model: 'sonnet', schema: CLASSIFY_SCHEMA, phase: 'Score', label: `classify:wave${wave}` },   // MDP: gap-classifier.cjs transport — the split + stop verdict are CODE (mechanical transport)
  )
  const stopVerdict = (cls && cls.stop) || { fire: false, status: 'continue', reasons: ['classifier returned no stop verdict — defaulting to continue (in-code mirrors below still bound the loop)'] }

  // In-code conservative guard (belt-and-suspenders vs the classifier, rail 4): only the whitelisted
  // derivation categories may auto-fix. Anything the classifier put in `resolvable` that is NOT
  // whitelisted (should not happen — the classifier guards) is folded into decisions and escalated.
  const rawResolvable = (cls && cls.resolvable) || []
  const toResolve = rawResolvable.filter((r) => RESOLVABLE_KINDS.includes(r.category))
  const misclassified = rawResolvable.filter((r) => !RESOLVABLE_KINDS.includes(r.category))
  const decisions = [...((cls && cls.decisions) || []), ...misclassified]
  if (misclassified.length) log(`wave ${wave}: ${misclassified.length} classifier-resolvable item(s) not in the auto-fix whitelist → folded into decisions (conservative guard)`)

  // 5. RESOLVE — conservative auto-fix of the whitelisted derivations. SEQUENTIAL (single-writer —
  //    each fix Writes/Edits a .product/ artifact and fires validation/cascade/BG hooks; sequential
  //    avoids a hook race, mirroring P6 remediation). One agent PER item (not batched) so each gets
  //    its own verify-before-act + idempotent apply + independent {applied|dropped} — a batch that
  //    partially fails is harder to reason about. Skipped entirely on dryRun.
  let resolvedThisWave = 0
  if (!DRY_RUN) {
    for (const g of toResolve) {
      const fix = await agent(
        `Resolve a CONSERVATIVE, whitelisted derivation gap in feature ${FEATURE} (wave ${wave}). ` +
        `category: ${g.category}; artifact: ${g.artifact_id || g.key || 'n/a'}; detail: ${g.detail}.\n` +
        `ANCHORED ROOT (FB-LR-28): ${ANCHOR_ROOT} — build every path from it; the feature file is ${ANCHOR_FM}.\n` +
        `VERIFY-BEFORE-ACT (DEC-DEV-0093, order-aware): FIRST re-read the CURRENT ground truth under ${ANCHOR_ROOT}/.product/. ` +
        `If this gap is ALREADY CLOSED (e.g. a sibling step in this wave fixed it, or the oracle no longer reports it), ` +
        `DROP it — return {applied:false, dropped:true, artifact_id, note:"already closed"}. Do NOT re-apply.\n` +
        `Otherwise complete ONLY this derivation from existing upstream (a missing VC for an active SC; an unlinked LC state; ` +
        `an RPM role from SC.actors) via the NORMAL authoring path — Write/Edit the .product/ artifact so the existing hooks ` +
        `(validation / cascade / BG / zone-router) fire. IDEMPOTENT, keyed on the artifact id: UPDATE IN PLACE, NEVER append a ` +
        `near-duplicate (DEC-DEV-0089). Do NOT invent a threshold / MoSCoW call / 🔴 BR-IC semantic / screen choice — those are ` +
        `DECISIONS (they are escalated, not here). Return {applied:true, dropped:false, artifact_id, note}.`,
        { model: 'sonnet', schema: RESOLVE_SCHEMA, phase: 'Resolve', label: `resolve:${g.category}:${g.artifact_id || g.key || wave}` },   // MDP: conservative WHITELISTED derivation only (decisions escalate) + verify-before-act — de-risked mechanical authoring
      )
      if (fix && fix.applied) {
        resolvedThisWave += 1
        resolvedAll.push({ artifact_id: fix.artifact_id || g.artifact_id || null, category: g.category, wave, note: fix.note || '' })
      } else if (fix && fix.dropped) {
        droppedAll.push({ artifact_id: fix.artifact_id || g.artifact_id || null, category: g.category, wave, note: fix.note || 'dropped by verify-before-act' })
      }
      // fix === null (agent dropped) → neither applied nor dropped; it re-surfaces next wave via the oracle (rail 5, no silent loss)
    }
  }
  // Set (not accumulate) each wave: this wave's SCORE already reflected all PRIOR resolves, so only
  // the fixes applied in THIS wave's RESOLVE can leave finalOracle stale at exit (final re-score guard).
  resolvedAfterLastScore = resolvedThisWave

  // 6. ESCALATE — queue each decision as a pending-action in the CANONICAL ledger (rail 4). ONE agent
  //    for the batch. Idempotent: scan open PAs first, update-in-place if an equivalent PA for this
  //    feature+decision already exists (PA-dedup, DEC-DEV-0089). Skipped on dryRun.
  let escalatedThisWave = []
  if (!DRY_RUN && decisions.length) {
    const esc = await agent(
      `Escalate ${decisions.length} strategic / connected / irreversible DECISION(s) for feature ${FEATURE} (wave ${wave}) to the ` +
      `owner as pending-actions — these are NEVER auto-resolved (rail 4). The decisions:\n${JSON.stringify(decisions)}\n` +
      PA_CANON +
      `For EACH decision: first SCAN the open pending-actions for an equivalent entry (same feature + same decision) — if one exists, ` +
      `UPDATE it in place (do NOT append a duplicate, DEC-DEV-0089); otherwise allocate the next PA-NNN and APPEND a concise entry ` +
      `(the feature, the decision + its category, the route: Product for a threshold/MoSCoW/provider/screen/🔴 BR-IC semantic; the ` +
      `owning spec's author for a broken-ref / structural gap). Return {queued:[{pa_id, decision_key}], updated_in_place:[{pa_id, decision_key}]}.`,
      { model: 'sonnet', schema: ESCALATE_SCHEMA, phase: 'Escalate', label: `escalate:wave${wave}` },   // MDP: batch decision PA write + dedup (standard/mechanical)
    )
    const queued = (esc && esc.queued) || []
    const updated = (esc && esc.updated_in_place) || []
    escalatedThisWave = [...queued, ...updated]
    for (const q of queued) escalatedAll.push({ pa_id: q.pa_id || null, decision_key: q.decision_key || '', wave, updated_in_place: false })
    for (const u of updated) escalatedAll.push({ pa_id: u.pa_id || null, decision_key: u.decision_key || '', wave, updated_in_place: true })
  }

  // rail 5: per-wave log — score, resolved count, escalated count (surfaced, not silent).
  log(`wave ${wave}: score=${oracle.score} (τ=${oracle.tau}, met=${oracle.met}); resolved=${resolvedThisWave}; escalated=${escalatedThisWave.length}; stop-verdict=${stopVerdict.status}${stopVerdict.fire ? ' (FIRE)' : ''}`)

  // 7. HONOR the classifier stop verdict (the authority) — then the in-code safety mirrors.
  if (stopVerdict.fire) {
    stop = { status: stopVerdict.status, reasons: stopVerdict.reasons || [`classifier fired stop:${stopVerdict.status}`] }
    break
  }
  // SAFETY MIRROR (c) — in-code floors in case the classifier did NOT fire (rail 2): met with no
  // progress this wave, or Δscore<ε with no progress (convergence plateau). Redundant to the
  // classifier; guarantees termination + no round-up regardless of classifier behaviour.
  if (oracle.met === true && resolvedThisWave === 0) {
    stop = { status: 'met', reasons: [`in-code mirror: oracle.met at ${oracle.score}≥τ ${oracle.tau} and nothing resolved this wave`] }
    break
  }
  if (prevScore !== null && Math.abs(oracle.score - prevScore) < EPSILON && resolvedThisWave === 0) {
    stop = { status: 'converged', reasons: [`in-code mirror: Δscore ${Math.abs(oracle.score - prevScore)} < ε ${EPSILON} and nothing resolved this wave`] }
    break
  }

  prevScore = oracle.score
  resolvedLastWave = resolvedThisWave
}

// The for-bound is the hard cap (rail 2): if we exhausted MAX_WAVES without a break, the stop is 'cap'.
if (!stop) stop = { status: 'cap', reasons: [`reached the hard wave cap max_waves=${MAX_WAVES}`] }

// ---- final re-score when fixes landed after the last SCORE (honesty, rail 5) -------------------
// The re-score of a wave's resolves is the NEXT wave's SCORE. ANY exit that follows a RESOLVE with
// applied fixes leaves finalOracle stale — not just 'cap': the classifier's stop verdict (e.g.
// 'converged') is computed PRE-RESOLVE but honored POST-RESOLVE, so it too can exit with unreflected
// fixes. The guard is therefore state-based, not status-based: re-run the oracle ONCE iff ≥1 fix was
// applied since the most recent SCORE (and not a dry run) so final_score/met — and therefore
// honest_unmet — reflect ALL applied work. By construction resolvedAfterLastScore stays 0 for the
// 'met' / 'decisions_only' exits (nothing resolved that wave), so behavior there is unchanged.
if (!DRY_RUN && resolvedAfterLastScore > 0) {
  const rescore = await agent(
    `Final re-score for feature ${FEATURE} — reflect the last wave's applied fixes (the loop exited after RESOLVE, ` +
    `so the last oracle run predates them). ` +
    `Run \`node ${ORACLE} --feature ${FEATURE} --root ${ANCHOR_ROOT}\` via Bash and return its JSON VERBATIM. Do NOT change anything.`,
    { model: 'sonnet', schema: ORACLE_SCHEMA, phase: 'Score', label: 'final-rescore' },   // MDP: completeness-oracle JSON relay (mechanical transport)
  )
  if (rescore) { finalOracle = rescore; log(`final re-score (post-loop): score=${rescore.score}, met=${rescore.met}`) }
}

// ---- CloseOut (B-c) — the delegated DoR blockers the oracle does NOT compute (rail 5) ----------
// B5 (BG covers bold terms) / B6 (V-01..V-11) / B8 (RPM covers SC.actors) are delegated_unverified —
// the oracle refuses to silently truncate them. If any remain AND this is not a dry run, run the two
// named validators ADVISORY: their verdicts are folded into the report, they NEVER flip `met`.
const finalDelegated = (finalOracle && finalOracle.delegated_unverified) || []
let delegatedCloseout = null
if (finalDelegated.length && !DRY_RUN) {
  const [bgReview, validate] = await parallel([
    () => agent(
      `Advisory close-out B5 for feature ${FEATURE}: execute the procedure of ${ANCHOR_ROOT}/.claude/commands/product/bg-review.md scoped to ${FEATURE} ` +
      `(BG covers the bold terms). Read that command doc and follow it against the anchored root ${ANCHOR_ROOT}. This is ADVISORY — report the outcome; ` +
      `do NOT treat it as the loop's stop-signal. Return {status:'PASS'|'FAIL'|'PARTIAL', summary, findings:[...]}.`,
      { model: 'sonnet', schema: CLOSEOUT_SCHEMA, phase: 'CloseOut', label: 'closeout:bg-review' },   // MDP: advisory execution of the bg-review command procedure (standard; never flips met)
    ),
    () => agent(
      `Advisory close-out B6/B8 for feature ${FEATURE}: execute the procedure of ${ANCHOR_ROOT}/.claude/commands/product/validate.md scoped to ${FEATURE} ` +
      `(V-01..V-11 + the RPM-covers-SC.actors check). Read that command doc and follow it against the anchored root ${ANCHOR_ROOT}. This is ADVISORY — report ` +
      `the outcome; do NOT treat it as the loop's stop-signal. Return {status:'PASS'|'FAIL'|'PARTIAL', summary, findings:[...]}.`,
      { model: 'sonnet', schema: CLOSEOUT_SCHEMA, phase: 'CloseOut', label: 'closeout:validate' },   // MDP: advisory execution of the validate command procedure V-01..V-11 (standard; never flips met)
    ),
  ])
  delegatedCloseout = {
    bg_review: bgReview ? { status: bgReview.status, summary: bgReview.summary || '', findings: bgReview.findings || [] } : { status: 'INCONCLUSIVE', summary: 'bg-review advisory agent returned null', findings: [] },
    validate: validate ? { status: validate.status, summary: validate.summary || '', findings: validate.findings || [] } : { status: 'INCONCLUSIVE', summary: 'validate advisory agent returned null', findings: [] },
  }
  log(`close-out (advisory, B5/B6/B8): bg-review=${delegatedCloseout.bg_review.status}; validate=${delegatedCloseout.validate.status} (does NOT flip met)`)
}

// ---- completion report (rail 5: no silent truncation) ------------------------------------------
const finalScore = finalOracle ? finalOracle.score : 0
const tau = finalOracle ? finalOracle.tau : 1.0
const met = !!(finalOracle && finalOracle.met)
const blockersFailing = ((finalOracle && finalOracle.blockers) || [])
  .filter((b) => b && b.status === 'fail')
  .map((b) => ({ id: b.id, name: b.name, detail: b.detail }))

// When we stop BELOW τ, say so plainly — never round a partial spec up to "done" (rail 5).
const honestUnmet = met
  ? ''
  : `Stopped ${stop.status} at score ${finalScore} < τ=${tau} after ${wavesRun} wave(s): `
    + `${blockersFailing.length} DoR blocker(s) still failing`
    + (blockersFailing.length ? ` (${blockersFailing.map((b) => b.id).join(', ')})` : '')
    + `${escalatedAll.length ? ` and ${escalatedAll.length} decision(s) escalated to the owner` : ''}. `
    + `The spec is NOT handoff-DoR-ready — do NOT treat it as done.`

log(`completeness-loop DONE for ${FEATURE}: stop=${stop.status}; final_score=${finalScore} (τ=${tau}); met=${met}; `
  + `resolved=${resolvedAll.length}; escalated=${escalatedAll.length}; delegated_unverified=${finalDelegated.length}`
  + `${personasIncomplete.length ? `; INCOMPLETE personas: ${personasIncomplete.join(',')}` : ''}`)

return {
  feature: FEATURE,
  waves_run: wavesRun,
  final_score: finalScore,
  tau,
  met,
  stop,                                  // {status, reasons}
  blockers_failing: blockersFailing,
  resolved: resolvedAll,                 // whitelisted derivations applied across all waves
  dropped: droppedAll,                   // gaps dropped by verify-before-act (already closed, DEC-DEV-0093)
  escalated: escalatedAll,               // decisions queued to the canonical pending-actions ledger (rail 4)
  personas_incomplete: personasIncomplete, // lenses that never returned after bounded re-spawn — degrade loud, not silent
  delegated_unverified: finalDelegated,  // B5/B6/B8 — the oracle does NOT compute these (rail 5)
  delegated_closeout: delegatedCloseout, // advisory B5/B6/B8 verdicts (B-c) — folded in, NEVER flips met
  honest_unmet: honestUnmet,             // plain-words note when stopped below τ (rail 5) — '' when met
  dry_run: DRY_RUN,
}
