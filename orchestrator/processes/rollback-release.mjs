export const meta = {
  name: 'rollback-release',
  description: 'Orchestrator process E.C — the staging auto-rollback cell of the feature-production line, run when a deploy flipped a release that then failed its healthcheck. Gate (the §3.2 autonomy-policy resolver — operation_class rollback, so staging→auto level-independent = the auto-rollback net fires at the default level with no human; prod→human-gate) → Rollback (revert the `current` symlink to the prior releases/<ts> + restart — VM-gated) → Verify (healthcheck the restored release against the P7 taxonomy). Two-axis result (ROLLED_BACK | ROLLBACK_FAILED | NO_PRIOR_RELEASE | BLOCKED) × readiness (READY | DEGRADED | ENV_NOT_READY).',
  phases: [
    { title: 'Gate' },
    { title: 'Rollback' },
    { title: 'Verify' },
  ],
}

/*
 * Orchestrator process `rollback-release` — Epic E sub-phase E.C (PROD readiness campaign
 * DEC-DEV-0198 / Волна B, B3). Design SSOTs: dev/plans/PROD_READINESS_CAMPAIGN.md §3.2 + §8.2 pt 3;
 * dev/gates/EPIC_E_READINESS.md D-4 (rollback = git-tag + release-dir symlink-swap, Capistrano-style)
 * + owner decision "staging auto-rollback, prod always human-confirm".
 *
 * WHY A SEPARATE operation_class 'rollback' (NOT 'destructive'): a rollback moves the system toward a
 * PREVIOUSLY-deployed known-good release — it cannot introduce novel broken state, so it is safe on
 * the reversible side. autonomy-policy.cjs keys `rollback` on env ONLY, ABOVE the level matrix:
 * staging → auto (every level), prod → human-gate (owner rail). This is load-bearing: the D-4/D-9
 * auto-rollback bracket must fire on a healthcheck failure at the project's ACTUAL level (L1 default,
 * possibly L0) WITHOUT a human. If this were classed `destructive` it would hit the FLOOR → human-gate
 * → the staging auto-rollback would be SILENTLY DISABLED and the owner's decision defeated, while
 * looking like it "works per the spec" (campaign §8.2 pt 3). So the class is `rollback`, exactly.
 *
 * THE §3.2 GATE (still mandatory even though staging returns auto): the swap below is reached ONLY on
 * a fresh disposition==='auto' from the resolver CLI seam. It is the audit trail + the prod-human
 * enforcement (prod rollback → human-gate → BLOCKED) + the readiness guard (a DEGRADED substrate
 * downgrades auto→human-gate; ENV_NOT_READY → the swap cannot be verified → ROLLBACK_FAILED) + the
 * floor guarantee for a bypassed/standalone invocation. A rollback that mutates without this gate is
 * an E.C failure, even if it "works".
 *
 * TWO-AXIS CONTRACT (mirrors validate-feature-impl / deploy-to-stage): result ∈ {ROLLED_BACK |
 * ROLLBACK_FAILED | NO_PRIOR_RELEASE | BLOCKED} × readiness ∈ {READY | DEGRADED | ENV_NOT_READY}.
 * NO_PRIOR_RELEASE is DISTINCT from ROLLBACK_FAILED (A-1..A-9 edge): nothing to swap to → the bad
 * release stays, flagged, and the owner decides (evt:rollback.no_prior → escalated), rather than
 * pretending a swap failed. ENV_NOT_READY / a swap error → ROLLBACK_FAILED; prod / a DEGRADED
 * downgrade → BLOCKED. Both non-ROLLED_BACK/NO_PRIOR outcomes route to escalate (evt:rollback.failed).
 *
 * CAPTURE-DON'T-FIX (D-5): the swap + verify agents SURFACE a failed revert / an unhealthy restored
 * release (diagnosed against the P7 taxonomy runtime-readiness.cjs::smokePlan.failure_classes) — they
 * do NOT remediate.
 *
 * VM-GATED (E.D/E.G): the real symlink swap, `systemctl restart`, and the live /health call are real
 * only on the VM prod-stand — they live INSIDE agent() bodies, never executed repo-side.
 *
 * HARNESS CONSTRAINT (DEC-DEV-0073 §D.1): no FS / Node API / Date.now() — every probe / lib run /
 * swap / restart / healthcheck happens INSIDE an agent(); inputs via args. The clock is not read.
 *
 * SMOKE: tests/orchestrator/workflow-syntax.smoke.cjs (harness dialect + MDP pin) +
 * tests/orchestrator/rollback-release-wiring.test.cjs (static invariants incl. §3.2 resolver-before-
 * swap + the rollback-not-destructive class). A live rollback needs a VM staging target (E.G, VM-gated).
 */

// FB-001: the harness forwards `args` verbatim; an invoking agent (or the dispatcher's Workflow call)
// may pass a JSON string. (Keep the comment ABOVE this line — the args-parsing smoke evals it.)
const A = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const FEATURE = A.feature || ''                                  // optional lens: the feature whose deploy is being rolled back
const CAPABILITY = A.capability || 'cc-sdd-deploy'               // the deploy-capability slug (Integrator-equipped, E.A)
const MANIFEST = A.manifest || (CAPABILITY ? `.claude/integrator/deploy/${CAPABILITY}/deploy-manifest.yaml` : '')  // E.A deploy-setup — release layout + healthcheck spec
const ENV_TIER = A.envTier || 'staging'                          // per-state env tier — staging (prod rollback is human-gated, owner rail)
const RISK = A.risk || 'HIGH'                                    // a rollback is HIGH by construction (real mutation, even if reversible-safe)
const AUTONOMY_LIB = A.autonomyLib || '.claude/orchestrator/lib/autonomy-policy.cjs'  // §3.2 resolver CLI seam (rollback class, F3/DEC-DEV-0194)
const ENV_PROBE = A.envProbe || '.claude/orchestrator/lib/env-readiness.cjs'          // DEC-DEV-0092: substrate readiness backbone
const AUTONOMY_OVERRIDE = A.autonomyOverride || null            // the forwarded --autonomy flag (rollback×staging is auto regardless; prod stays human)
const AUTONOMY_POLICY_CFG = A.autonomyPolicy || null            // optional inline policy slice

// ---- schemas ---------------------------------------------------------------
const ENV_READINESS_SCHEMA = {
  type: 'object',
  required: ['readiness'],
  properties: {
    readiness: { type: 'string', enum: ['READY', 'DEGRADED', 'ENV_NOT_READY'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
}

// The §3.2 disposition envelope relayed from the autonomy-policy CLI seam (shape = resolve()'s return).
const AUTONOMY_SCHEMA = {
  type: 'object',
  required: ['disposition'],
  properties: {
    disposition: { type: 'string' },                           // auto | consilium-gate | human-gate | block
    level_applied: { type: ['string', 'null'] },
    floor_hit: { type: 'boolean' },
    why: { type: 'array', items: { type: 'string' } },
  },
}

const SWAP_SCHEMA = {
  type: 'object',
  required: ['swapped'],
  properties: {
    swapped: { type: 'boolean' },                              // `current` now points at the prior known-good release
    no_prior: { type: 'boolean' },                             // no prior releases/<ts> to revert to (the A-1..A-9 edge)
    restored_release: { type: ['string', 'null'] },            // the releases/<ts> now live
    diagnosis: { type: 'string' },
    observed: { type: 'string' },
  },
}

const HEALTHCHECK_SCHEMA = {
  type: 'object',
  required: ['healthy'],
  properties: {
    healthy: { type: 'boolean' },                              // the restored release comes back 2xx within boot_window_sec
    failure_class: { type: ['string', 'null'] },               // a P7 smokePlan.failure_classes id, or null
    diagnosis: { type: 'string' },
    observed: { type: 'string' },
  },
}

// worst-of readiness (only ever downgrades toward "could not judge", never upgrades toward READY).
const RANK = { READY: 0, DEGRADED: 1, ENV_NOT_READY: 2 }
const worstReadiness = (a, b) => (RANK[a] >= RANK[b] ? a : b)

// ===========================================================================

// ---- Phase 1: Gate — readiness + the §3.2 resolver call, BEFORE the swap -----
phase('Gate')

// substrate readiness axis (CODE, not LLM initiative) — feeds --readiness into the resolver so a
// DEGRADED substrate downgrades the auto-rollback to human-gate and ENV_NOT_READY blocks it.
const envProbe = await agent(
  `Run the env-readiness probe for the ${ENV_TIER} rollback target: \`node ${ENV_PROBE}\` via Bash and relay its JSON verbatim (readiness + reasons). ` +
  `Do NOT start any substrate — just report whether what the target uses is up.`,
  { model: 'sonnet', schema: ENV_READINESS_SCHEMA, phase: 'Gate', label: 'env-readiness' },   // MDP: env-probe JSON relay (mechanical transport)
)
const readiness = (envProbe && envProbe.readiness) || 'DEGRADED'   // unknown/absent → conservatively DEGRADED (never silently READY)
log(`rollback pre-flight env-readiness: ${readiness}${envProbe && envProbe.reasons && envProbe.reasons.length ? ` — ${envProbe.reasons.join('; ')}` : ''}`)

// §3.2 resolver — operation_class 'rollback' (NOT 'destructive'). staging → auto (level-independent =
// the auto-rollback net); prod → human-gate. --readiness applies applyReadinessGuard here.
const disposition = await agent(
  `Resolve the authoritative autonomy disposition for THIS ${ENV_TIER} rollback (§3.2 ACCEPTANCE — the disposition is CODE; relay the JSON verbatim, do NOT judge or override):\n` +
  `node ${AUTONOMY_LIB} resolve --operation-class rollback --risk ${RISK} --env-tier ${ENV_TIER} --readiness ${readiness}` +
  `${AUTONOMY_POLICY_CFG ? ` --policy '${JSON.stringify(AUTONOMY_POLICY_CFG)}'` : ''}${AUTONOMY_OVERRIDE ? ` --override ${AUTONOMY_OVERRIDE}` : ''}\n` +
  `Return its { disposition, level_applied, floor_hit, why } object exactly. (operation_class rollback is keyed on env ABOVE the level matrix: staging → auto at EVERY level — the auto-rollback net; prod → human-gate always — the owner rail. A DEGRADED substrate downgrades auto→human-gate; ENV_NOT_READY → block.)`,
  { model: 'sonnet', schema: AUTONOMY_SCHEMA, phase: 'Gate', label: 'autonomy-resolve' },   // MDP: deterministic resolver JSON relay (mechanical transport)
)
// OBEDIENCE RULE (§5): the swap below is reached ONLY on a fresh disposition==='auto'. A non-auto is
// either a readiness block (ENV_NOT_READY → the swap could not be verified → ROLLBACK_FAILED) or an
// authorization block (prod human-gate / DEGRADED downgrade / floor → BLOCKED, owner rail). Both route
// to escalate; the distinction is disclosed. A rollback that swaps without this gate is an E.C failure.
if (!disposition || disposition.disposition !== 'auto') {
  const d = disposition ? disposition.disposition : 'null'
  const envBlocked = readiness === 'ENV_NOT_READY'
  log(`§3.2 GATE: disposition=${d} (not auto${disposition && disposition.floor_hit ? ', floor_hit' : ''}) — STOP. No swap. ${envBlocked ? 'ROLLBACK_FAILED (substrate down — cannot verify a revert).' : 'BLOCKED (owner rail — prod / degraded / floor).'}`)
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: envBlocked ? 'ROLLBACK_FAILED' : 'BLOCKED', readiness,
    restored_release: null, healthcheck: null,
    disposition, autonomy: disposition,   // envelope carried for the owner
    disclosures: [`rollback gated by autonomy-policy → ${d}${disposition && disposition.floor_hit ? ' (floor)' : ''}: ${(disposition && disposition.why && disposition.why.slice(-1)[0]) || 'see why[]'}`],
  }
}
log(`§3.2 GATE: disposition=auto (level ${disposition.level_applied}) — proceeding to the symlink swap.`)

// ---- Phase 2: Rollback (VM-GATED) — revert `current` to the prior known-good release. Reads the E.A
// manifest for the on-disk layout (CRLF-tolerant — this process is a CNT consumer). The NO_PRIOR edge
// is distinct: nothing to revert to → the bad release stays, flagged, owner decides.
phase('Rollback')
const swap = await agent(
  `Roll back the ${ENV_TIER} deploy for capability "${CAPABILITY}" — revert the \`current\` symlink to the prior known-good release (VM-gated — the ONE mutating step, authorized by the §3.2 auto disposition above; D-4 Capistrano symlink-swap).\n` +
  `First read the deploy layout from \`${MANIFEST}\` — normalize line endings BEFORE parsing (\`.replace(/\\r\\n/g,'\\n')\` or \`/^---\\r?\\n/\` + \`split(/\\r?\\n/)\`; the .yaml materialises CRLF on a Windows pilot — capability-probe.cjs extractManifest pattern, campaign §8.2 pt 7).\n` +
  `1) Resolve the CURRENT release and the PRIOR releases/<ts> (the newest release older than current) from the on-disk layout. 2) If there is NO prior release to revert to, STOP — return swapped:false, no_prior:true (the bad release stays live, flagged; the owner decides — do NOT delete it, do NOT fabricate a release). 3) Otherwise flip \`current\` back to the prior release — ATOMICALLY, the same idiom E.B uses forward: \`ln -sfn <prior_release> <current>.tmp && mv -T <current>.tmp <current>\` (mv -T on one filesystem is a single rename(2), so \`current\` is never absent). Do NOT \`rm current && ln -s …\` — that opens a window in which a restarting service finds no \`current\` at all, and you are already recovering from one failure. Then \`sudo systemctl restart\` the units — they follow \`current\`, so the restart is what makes the revert take effect (a unit pinned to a concrete releases/<ts> would make this whole process a silent no-op; deploy-manifest.cjs blocks that equipment upstream — DEC-DEV-0203 / FIND-B).\n` +
  `CAPTURE-DON'T-FIX: if the swap/restart fails, STOP and record swapped:false + a diagnosis — do NOT retry-hack, edit code, or commit. Set swapped:true ONLY once \`current\` actually points at the prior release.\n` +
  `Return swapped + no_prior + restored_release + diagnosis + observed.`,
  { model: 'opus', schema: SWAP_SCHEMA, phase: 'Rollback', label: 'rollback-swap' },   // MDP: real high-R mutation (symlink swap + restart) + no-prior edge diagnosis (impl/depth)
)
if (swap && swap.no_prior) {
  log('NO_PRIOR_RELEASE — nothing to revert to; the bad release stays live, flagged for the owner (escalate).')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'NO_PRIOR_RELEASE', readiness,
    restored_release: null, healthcheck: null, disposition, autonomy: disposition,
    disclosures: ['no prior releases/<ts> to roll back to — the current (failed) release remains live; owner decision required (re-deploy a known-good, or accept)'],
  }
}
const swapped = !!(swap && swap.swapped)
const restoredRelease = (swap && swap.restored_release) || null
if (!swapped) {
  log('ROLLBACK_FAILED — the symlink swap/restart did not complete (capture-don\'t-fix); escalate.')
  return {
    feature: FEATURE || null, capability: CAPABILITY, env_tier: ENV_TIER,
    result: 'ROLLBACK_FAILED', readiness,
    restored_release: restoredRelease, healthcheck: null, disposition, autonomy: disposition,
    disclosures: [`rollback swap failed: ${(swap && swap.diagnosis) || 'see observed'}`],
  }
}
log(`rollback swap: reverted \`current\` → ${restoredRelease || 'prior release'}`)

// ---- Phase 3: Verify (VM-GATED) — healthcheck the restored release (same P7 taxonomy). Healthy →
// ROLLED_BACK. Unhealthy → ROLLBACK_FAILED (the revert did not restore health — owner intervention).
phase('Verify')
const healthcheck = await agent(
  `Healthcheck the RESTORED ${ENV_TIER} release after the rollback swap (VM-gated; capture-don't-fix).\n` +
  `Read the healthcheck spec from \`${MANIFEST}\` (normalize CRLF before parsing, as above) — hit its url and wait up to boot_window_sec for a 2xx.\n` +
  `If it does NOT come healthy, diagnose against the P7 failure taxonomy (runtime-readiness.cjs::smokePlan.failure_classes — reuse, do NOT reinvent): env-not-loaded / missing-migration / port-in-use / missing-runtime-secret / dependency-not-up.\n` +
  `Do NOT remediate, edit code, or commit — SURFACE the diagnosis (an unhealthy RESTORED release means even the prior release is not serving; owner intervention is required). Return healthy + failure_class (a taxonomy id or null) + diagnosis + observed.`,
  { model: 'opus', schema: HEALTHCHECK_SCHEMA, phase: 'Verify', label: 'verify-health' },   // MDP: live probe + diagnosis against the failure taxonomy (judgment/depth)
)
const healthy = !!(healthcheck && healthcheck.healthy)
log(`rollback verify: ${healthy ? 'HEALTHY → ROLLED_BACK' : `UNHEALTHY (${(healthcheck && healthcheck.failure_class) || 'unknown'}) → ROLLBACK_FAILED`}`)

// ---- synthesize the two-axis result. A healthy restored release is a clean ROLLED_BACK; an unhealthy
// one is ROLLBACK_FAILED (the revert did not restore service — the prior release is also broken).
const result = healthy ? 'ROLLED_BACK' : 'ROLLBACK_FAILED'
return {
  feature: FEATURE || null,
  capability: CAPABILITY,
  env_tier: ENV_TIER,
  result,                              // ROLLED_BACK | ROLLBACK_FAILED (NO_PRIOR_RELEASE / BLOCKED handled above)
  readiness,                           // READY | DEGRADED (ENV_NOT_READY → ROLLBACK_FAILED above)
  restored_release: restoredRelease,
  healthcheck,                         // { healthy, failure_class, diagnosis, observed }
  disposition,                         // the §3.2 resolver envelope
  autonomy: disposition,               // alias (mirrors validate-feature-impl / deploy-to-stage)
  disclosures: healthy
    ? [`rolled back to ${restoredRelease || 'the prior release'} — staging restored to known-good (owner notified)`]
    : [`restored release ${restoredRelease || ''} is UNHEALTHY (${(healthcheck && healthcheck.failure_class) || 'unknown'}): ${(healthcheck && healthcheck.diagnosis) || 'see observed'} — owner intervention required`],
}
