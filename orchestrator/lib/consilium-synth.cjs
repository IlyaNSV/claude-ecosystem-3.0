#!/usr/bin/env node
/**
 * consilium-synth.cjs — deterministic synthesis core of the Orchestrator P2
 * `decide-architecture-foundation` process (DEC-DEV-0129; design DEC-DEV-0127).
 *
 * WHY THIS EXISTS (SPEC §3.2 P2 / §3.3 RA-1; Vision Epic D; RUN 01 E1):
 *   P2 supports a decision on an UNDECIDED architecture fork. Its engine is a
 *   heterogeneous jury of 3 architects (priors velocity / fidelity / integrity —
 *   RA-1), each scoring the fork's options under its own lens, INDEPENDENTLY (a
 *   jury, not a debate: cross-talk on a single connected decision is groupthink +
 *   ~15× cost, Vision D). The jury's 3 structured verdicts must then be aggregated
 *   into ONE recommendation for the owner. If that aggregation were "thinking", the
 *   recommendation would drift run-to-run and could quietly force a consensus the
 *   lenses do not actually share. This lib is the DETERMINISTIC aggregator — the
 *   Layer-3 gate of the hybrid synthesis (DEC-DEV-0127 §9.2): CODE computes the
 *   matrix + rank + veto; the PROMPT (in the .mjs) only formulates the human-readable
 *   `the_real_tradeoff` + `rationale` on top of this fixed skeleton.
 *
 *   Run by an agent via Bash and RELAYED as JSON — like coverage-oracle /
 *   fidelity-oracle / env-readiness / remediation-guard (DEC-DEV-0073 §D.1); the
 *   Workflow script may not touch FS / child_process, so the agent materializes the
 *   verdicts to a temp file and runs this CLI.
 *
 * THE RULE (DEC-DEV-0127 §5 + §9.1 — worst-of by blocking, sum by scores for rank):
 *   - VETO (worst-of, conservative — mirrors remediation-guard's "a conflict beats a
 *     transient"): an option that ANY prior marks with a `blocking_concern` is
 *     VETOED — it cannot be the recommendation (you may not recommend an option one
 *     lens calls unacceptable). The veto is RECORDED, never hidden.
 *   - RANK among survivors: by the summed per-prior score (0..5 each) descending;
 *     tie-break by the option's WORST prior score (the higher floor wins — worst-of
 *     again), then by id (stable). The top survivor is the recommendation.
 *   - STRENGTH:
 *       · `strong` ⟺ the FULL panel (all 3 priors) reported AND all 3 recommend the
 *         SAME surviving option (owner ratification is near-formal).
 *       · `split`  ⟺ the lenses diverge (or the top option is vetoed by some lens) —
 *         the recommendation is the top-by-sum survivor, and the DIVERGENCE is the
 *         product: P2 does NOT force consensus, it SURFACES the trade-off the owner
 *         must weigh.
 *       · `none`   ⟺ EVERY option is vetoed by ≥1 lens — there is no clean pick; the
 *         veto set itself is the finding to escalate (harder than a split).
 *   - SOFT-VETO (DEC-DEV-0135 — the distributed-weakness flag): an option that NO lens
 *     scores ≥ SOFT_VETO_THRESHOLD is "soft-vetoed" — weak under EVERY prior. It is NOT
 *     removed (a hard veto does that), but it is FLAGGED, because the deterministic SUM
 *     can rank a weak-across-the-board option as a viable split survivor, masking that no
 *     lens actually endorsed it. If even the RECOMMENDED option is soft-vetoed, a
 *     full-panel "agreement" is agreement on the LEAST-BAD option, never a rubber-stamp →
 *     it is demoted out of `strong`. (Profiling study DEC-DEV-0132 finding #2: independent
 *     fixed-lens scoring + a sum trades away holistic cross-lens integration; this recovers
 *     the "unanimously weak ⇒ re-examine" signal the raw sum drops. The complementary
 *     "one lens's fact undercuts another's score" case, which CODE cannot see, is the .mjs
 *     post-panel integration pass — surfacing-only, it never changes this deterministic pick.)
 *
 * HONEST ABOUT THE PANEL (fail-loud, not fail-open): if fewer than 3 priors reported
 *   (an architect died on a terminal error), `panel_complete:false` rides in the
 *   result so the process discloses that the recommendation rests on a reduced panel —
 *   a 2-of-3 "agreement" is NEVER promoted to `strong`.
 *
 * BOUNDARY: this lib SYNTHESISES. It does not decide FOR the owner, edit specs, close
 *   a pending-action, or finalize a DEC — those are the owner's (FB-LR-07). The .mjs
 *   emits a recommendation + a DRAFT dec into the fork's pending-action; the owner
 *   ratifies.
 *
 * EXIT CODES: 0 ran ok (JSON on stdout) · 2 usage/internal error.
 * Dual-use: require() it for the pure functions (unit-tested, no child_process); run
 * it as a CLI to synthesise a verdicts file.
 *
 * Node stdlib only; cross-platform.
 */

'use strict';

const fs = require('fs');

const CONSILIUM_SYNTH_SCHEMA_VERSION = 1;

// The 3 fixed priors (RA-1). v1 is a fixed panel; a configurable panel (cost /
// security / …) is post-v1 (DEC-DEV-0127 §9.3).
const PRIORS = { VELOCITY: 'velocity', FIDELITY: 'fidelity', INTEGRITY: 'integrity' };
const PRIOR_LIST = [PRIORS.VELOCITY, PRIORS.FIDELITY, PRIORS.INTEGRITY];

// Recommendation strength — how much the jury converges (drives owner ratification).
const STRENGTH = {
  STRONG: 'strong', // full panel unanimous on a surviving option
  SPLIT: 'split',   // lenses diverge — surface the trade-off, do not force consensus
  NONE: 'none',     // every option vetoed — no clean pick, escalate the veto set
};

const SCORE_MIN = 0;
const SCORE_MAX = 5;

// An option NO lens scores ≥ this is "soft-vetoed": weak under EVERY prior (DEC-DEV-0135).
// Not removed (a hard veto does that) — flagged for re-examination so the deterministic sum
// cannot quietly promote a weak-across-the-board option to a viable split, and a full-panel
// agreement on such an option is never `strong` (profiling study DEC-DEV-0132 finding #2).
// 3 = the 0..5 midpoint: max score < 3 ⇒ every lens scored it ≤ 2 (weak-to-bad everywhere).
const SOFT_VETO_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/** Coerce a score to a finite number clamped to [0,5]; non-numeric ⇒ 0 (a missing
 *  score is a zero, never a crash — conservative toward NOT recommending). */
function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return SCORE_MIN;
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));
}

/** A verdict counts only if it names one of the 3 known priors. */
function isPriorVerdict(v) {
  return !!(v && typeof v === 'object' && PRIOR_LIST.includes(v.prior));
}

/** The blocking_concern → option id it vetoes ({option_id|option} object form).
 *  A bare-string concern has no attributable option → returns null (not a veto). */
function concernOptionId(b) {
  if (!b || typeof b !== 'object') return null;
  const id = b.option_id != null ? b.option_id : b.option;
  return id != null ? String(id) : null;
}

/**
 * Collect every option id that appears anywhere: the declared list ∪ any option a
 * verdict scored ∪ any option a verdict recommended ∪ any option a blocking_concern
 * names. A prior that scores an option the ForkBrief forgot to declare still lands in
 * the matrix (defensive — we never silently drop a scored option).
 */
function collectOptionIds(verdicts, optionIds) {
  const set = new Set();
  for (const id of Array.isArray(optionIds) ? optionIds : []) {
    if (id != null) set.add(String(id));
  }
  for (const v of Array.isArray(verdicts) ? verdicts : []) {
    if (!isPriorVerdict(v)) continue;
    if (v.scores && typeof v.scores === 'object') {
      for (const k of Object.keys(v.scores)) set.add(String(k));
    }
    if (v.recommended_option != null) set.add(String(v.recommended_option));
    for (const b of Array.isArray(v.blocking_concerns) ? v.blocking_concerns : []) {
      const o = concernOptionId(b);
      if (o != null) set.add(o);
    }
  }
  return Array.from(set);
}

/**
 * Build the option × prior score matrix + veto attribution.
 * @returns { [optionId]: { scores:{velocity,fidelity,integrity}, sum, min, max,
 *                          blocking:[{prior,concern}], vetoed:boolean, soft_vetoed:boolean } }
 */
function buildMatrix(verdicts, optionIds) {
  const vs = (Array.isArray(verdicts) ? verdicts : []).filter(isPriorVerdict);
  const ids = collectOptionIds(vs, optionIds);
  const matrix = {};
  for (const id of ids) {
    const scores = {};
    for (const p of PRIOR_LIST) {
      const v = vs.find((x) => x.prior === p);
      const raw = v && v.scores && Object.prototype.hasOwnProperty.call(v.scores, id) ? v.scores[id] : 0;
      scores[p] = clampScore(raw);
    }
    // veto attribution: every prior that lists this option in blocking_concerns.
    const blocking = [];
    for (const v of vs) {
      for (const b of Array.isArray(v.blocking_concerns) ? v.blocking_concerns : []) {
        if (concernOptionId(b) === id) {
          blocking.push({ prior: v.prior, concern: String((b && (b.concern || b.reason)) || '') });
        }
      }
    }
    const vals = PRIOR_LIST.map((p) => scores[p]);
    const max = Math.max(...vals);
    matrix[id] = {
      scores,
      sum: vals.reduce((a, b) => a + b, 0),
      min: Math.min(...vals),
      max,
      blocking,
      vetoed: blocking.length > 0,
      // soft veto (DEC-DEV-0135): NO lens scored it ≥ SOFT_VETO_THRESHOLD — weak under every
      // prior. A pure property of the scores (a hard veto subsumes it; synthesize() separates
      // the actionable, non-hard-vetoed set).
      soft_vetoed: max < SOFT_VETO_THRESHOLD,
    };
  }
  return matrix;
}

/**
 * Rank the non-vetoed options: sum desc → min desc (worst-of floor) → id asc (stable).
 * A vetoed option is never ranked (it cannot be recommended).
 */
function rankSurvivors(matrix, survivors) {
  const m = matrix && typeof matrix === 'object' ? matrix : {};
  const s = Array.isArray(survivors)
    ? survivors
    : Object.keys(m).filter((id) => !m[id].vetoed);
  return s.slice().sort((a, b) => {
    if (m[b].sum !== m[a].sum) return m[b].sum - m[a].sum;
    if (m[b].min !== m[a].min) return m[b].min - m[a].min;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * The deterministic heart — aggregate the jury's verdicts into a recommendation.
 * The PROMPT (in the .mjs) formulates `the_real_tradeoff`/`rationale`/`dec_draft` on
 * top of this; this lib fixes WHAT is recommended, WHY it survived, and how strongly.
 */
function synthesize(verdicts, optionIds) {
  const vs = (Array.isArray(verdicts) ? verdicts : []).filter(isPriorVerdict);
  const ids = collectOptionIds(vs, optionIds);
  const matrix = buildMatrix(vs, ids);

  const survivors = ids.filter((id) => !matrix[id].vetoed);
  const vetoed = ids.filter((id) => matrix[id].vetoed);
  const ranked = rankSurvivors(matrix, survivors);

  const priorsReported = Array.from(new Set(vs.map((v) => v.prior)));
  const panelComplete = priorsReported.length >= PRIOR_LIST.length;

  // per-prior recommended option (raw — the prompt reads this to name the divergence).
  const recommendations = {};
  for (const v of vs) {
    if (v.recommended_option != null) recommendations[v.prior] = String(v.recommended_option);
  }
  const recVals = Object.values(recommendations);
  const unanimousRec = recVals.length > 0 && new Set(recVals).size === 1 ? recVals[0] : null;

  let recommended = null;
  let strength = STRENGTH.NONE;
  if (survivors.length === 0) {
    // every option carries a blocking concern → no clean recommendation.
    recommended = null;
    strength = STRENGTH.NONE;
  } else {
    recommended = ranked[0] || null;
    // strong requires the FULL panel unanimous on a SURVIVING option (a 2-of-3 with a
    // missing prior is never strong — panel honesty).
    if (panelComplete && unanimousRec && survivors.includes(unanimousRec)) {
      recommended = unanimousRec;
      strength = STRENGTH.STRONG;
    } else {
      strength = STRENGTH.SPLIT;
    }
  }

  // Soft-veto (DEC-DEV-0135): surviving options no lens scored ≥ SOFT_VETO_THRESHOLD — weak
  // under every prior. A hard veto subsumes a soft one, so only NON-hard-vetoed options count.
  // If even the RECOMMENDED option is soft-vetoed, a full-panel "agreement" is agreement on the
  // LEAST-BAD option — never near-formal; demote STRONG → SPLIT so it is re-examined, not
  // rubber-stamped. It is never REMOVED (that is a hard veto's job) — only flagged + disclosed.
  const softVetoed = survivors.filter((id) => matrix[id].soft_vetoed);
  const recommendedSoftVetoed = recommended != null && softVetoed.includes(recommended);
  if (recommendedSoftVetoed && strength === STRENGTH.STRONG) {
    strength = STRENGTH.SPLIT;
  }

  // all blocking concerns, flattened + option-attributed (the veto ledger the owner sees).
  const blockingConcerns = ids.flatMap((id) =>
    matrix[id].blocking.map((b) => ({ option_id: id, prior: b.prior, concern: b.concern })));

  return {
    schema_version: CONSILIUM_SYNTH_SCHEMA_VERSION,
    options: ids,
    matrix,
    ranked,
    survivors,
    vetoed,
    recommendations,               // prior -> option_id
    priors_reported: priorsReported,
    panel_complete: panelComplete,
    recommended,                   // option_id | null (null ⇔ strength none)
    strength,                      // strong | split | none
    split: strength === STRENGTH.SPLIT,
    soft_vetoed: softVetoed,       // survivors weak under EVERY lens (no prior ≥ threshold) — flagged, not removed
    recommended_soft_vetoed: recommendedSoftVetoed,  // true ⇒ even the top pick is weak everywhere (demoted from strong)
    blocking_concerns: blockingConcerns,
  };
}

/** A compact one-line-friendly summary of a synthesis. */
function summarize(synth) {
  const s = synth && typeof synth === 'object' ? synth : {};
  return {
    recommended: s.recommended || null,
    strength: s.strength || null,
    options: Array.isArray(s.options) ? s.options.length : 0,
    survivors: Array.isArray(s.survivors) ? s.survivors.length : 0,
    vetoed: Array.isArray(s.vetoed) ? s.vetoed.length : 0,
    soft_vetoed: Array.isArray(s.soft_vetoed) ? s.soft_vetoed.length : 0,
    panel_complete: !!s.panel_complete,
  };
}

// ---------------------------------------------------------------------------
// CLI (FS lives here only). The agent writes the jury verdicts to a temp file and
// runs `node consilium-synth.cjs --verdicts-file <path> [--options a,b,c]`; we read,
// synthesise, and print JSON. `--verdicts <inline-json>` is also accepted for tests.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--verdicts-file': a.verdictsFile = next(); break;
      case '--verdicts': a.verdicts = next(); break;
      case '--options': a.options = next(); break;
      default: break;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'consilium-synth.cjs — Orchestrator P2: aggregate a 3-prior architecture jury into',
    'a recommendation (matrix + rank + veto). Deterministic (DEC-DEV-0129).',
    '',
    'USAGE:  node consilium-synth.cjs --verdicts-file verdicts.json [--options a,b,c]',
    '        node consilium-synth.cjs --verdicts \'[{"prior":"velocity",...}]\' --options a,b',
    '',
    'verdicts = an array of ArchVerdict { prior, scores:{opt:0..5}, recommended_option,',
    '           risks_of_recommendation[], blocking_concerns:[{option_id, concern}] }.',
    '',
    '→ JSON { recommended, strength: strong|split|none, matrix, ranked, survivors, vetoed,',
    '         soft_vetoed, recommendations, panel_complete, blocking_concerns, summary }.',
    'strong ⇒ full panel unanimous on a surviving option; split ⇒ lenses diverge (surface',
    'the trade-off); none ⇒ every option vetoed (escalate). An option ANY prior blocks is',
    'vetoed and never recommended (worst-of). soft_vetoed = survivors no lens scored >= 3',
    '(weak under every lens) — flagged, not removed; a soft-vetoed top pick is never strong.',
    'The owner ratifies — P2 does not decide.',
  ].join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  let raw;
  if (args.verdictsFile != null) {
    try { raw = fs.readFileSync(args.verdictsFile, 'utf8'); }
    catch (e) { process.stderr.write(`consilium-synth: cannot read --verdicts-file: ${(e && e.message) || e}\n`); process.exit(2); }
  } else if (args.verdicts != null) {
    raw = args.verdicts;
  } else {
    printHelp();
    process.exit(2);
  }

  let verdicts;
  try {
    verdicts = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`consilium-synth: --verdicts is not valid JSON: ${(e && e.message) || e}\n`);
    process.exit(2);
  }
  // accept either a bare array or { verdicts:[...], options:[...] }
  let optionIds = args.options ? String(args.options).split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (verdicts && !Array.isArray(verdicts) && typeof verdicts === 'object') {
    if (!optionIds && Array.isArray(verdicts.options)) optionIds = verdicts.options;
    verdicts = verdicts.verdicts;
  }
  if (!Array.isArray(verdicts)) {
    process.stderr.write('consilium-synth: verdicts must be an array (or {verdicts:[...]})\n');
    process.exit(2);
  }

  const synth = synthesize(verdicts, optionIds);
  process.stdout.write(JSON.stringify({ ...synth, summary: summarize(synth) }, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  CONSILIUM_SYNTH_SCHEMA_VERSION,
  PRIORS,
  PRIOR_LIST,
  STRENGTH,
  SCORE_MIN,
  SCORE_MAX,
  SOFT_VETO_THRESHOLD,
  clampScore,
  isPriorVerdict,
  concernOptionId,
  collectOptionIds,
  buildMatrix,
  rankSurvivors,
  synthesize,
  summarize,
};
