'use strict';
/**
 * gap-classifier.cjs — deterministic CLASSIFY + stop-verdict for the bounded completeness-loop
 * (Autonomous Pipeline Vision, Epic B / B-b durable wave-runner).
 *
 * The wave-runner (`product/processes/complete-feature.mjs`) is a harness Workflow script and
 * CANNOT `require()` Node modules (same dialect constraint as orchestrator/processes/*.mjs —
 * see tests/orchestrator/workflow-syntax.smoke.cjs). It delegates CLASSIFY (skill step 3,
 * skills/product/completeness-loop.md) and the stop-verdict (skill "Stop contract") to a
 * subagent that runs `node` and calls THIS library, so classification and the stop contract
 * are CODE, never LLM judgment — the same "external, deterministic stop-signal" rail the
 * sibling completeness-oracle.cjs implements for SCORE (hard rail 1 of completeness-loop.md).
 *
 * Disposition SSOT is the 🟢/🔴 markup in dev/LOOP_READINESS_AUDIT.md:
 *   🟢 loop-body (auto-resolvable derivations) — §3 F.4 (LC), §3 F.6 (VC), §3 F.7 (RPM)
 *   🔴 gate (decision, escalate, NEVER auto)   — §1 D1.1 G1 (PS), §1 D1.4 G4 (SEG),
 *       §1 D1.5 G5 (HYP thresholds), §2 D1.6 (MVP MoSCoW), §2 D1.8 (RL/FM composition),
 *       §3 F.10 (FM status transition), §3 F.2 (SC semantic authoring/approve),
 *       §3 F.3 (BR, 🔴 Critical), §3 F.5 (IC, 🔴 Critical), §3 F.5a (NFR ask-phase),
 *       §4 D.2/D.3 (screen/MK decisions)
 * See LOOP_READINESS_AUDIT.md §5.1 (loop body) / §5.2 (escalation points) for the synthesis.
 *
 * Dual-use (orchestrator-lib convention, cf. completeness-oracle.cjs): require() exports a
 * pure-function API + a require.main CLI a subagent runs via Bash and relays as JSON.
 *
 *   node hooks/product/lib/gap-classifier.cjs <input.json>
 *   node hooks/product/lib/gap-classifier.cjs -        (read stdin)
 *
 * Node stdlib only. Every function here is a pure function of its arguments — no fs/network
 * I/O except the CLI's own input read, so it is trivially unit-testable and safe to re-run
 * every wave (idempotent by construction: same input -> same classification, always).
 */

const fs = require('fs');

// ---------- disposition maps (SSOT: dev/LOOP_READINESS_AUDIT.md, cited per row) ----------

/**
 * Oracle gap-string DoR-blocker prefix -> disposition.
 * completeness-oracle.cjs prefixes every gaps[] entry with its blocker id (`B<n>:`).
 *   B4 (active SC without an active VC)   -> resolvable, missing-vc  (§3 F.6 — VC auto-approve, loop-body)
 *   B1 (FM status not in-progress)        -> decision,  fm-status    (§3 F.10 — FM status transition, gate)
 *   B2 (no active SC)                     -> decision,  missing-sc   (§3 F.2 — SC authoring/approve, 🔴 gate)
 *   B3 (referenced BR missing/inactive)   -> decision,  br-inactive  (§3 F.3 — BR, 🔴 Critical gate)
 *   B7 (has_ui without an active MK)      -> decision,  missing-mk   (§4 D.2/D.3 — screen decisions, 🔴 gate)
 * Any other/unknown/missing prefix is intentionally NOT listed here — see ORACLE_DEFAULT
 * (conservative: never guess a blocker into auto-resolvable).
 */
const ORACLE_PREFIX_MAP = {
  B4: { category: 'missing-vc', disposition: 'resolvable' },
  B1: { category: 'fm-status', disposition: 'decision' },
  B2: { category: 'missing-sc', disposition: 'decision' },
  B3: { category: 'br-inactive', disposition: 'decision' },
  B7: { category: 'missing-mk', disposition: 'decision' },
};

// Unknown/no prefix -> conservative default (rail 4: decisions escalate, never auto-resolved).
const ORACLE_DEFAULT = { category: 'other', disposition: 'decision' };

/**
 * Persona finding category -> disposition. Personas write findings keyed by `category`
 * (skill step 2 SURFACE: architect-advisor / qa-advisor / ux-advisor, zone-routed).
 *
 * resolvable (🟢 loop-body, LOOP_READINESS_AUDIT §5.1):
 *   missing-vc       — §3 F.6 Verification Criteria (auto-approve derivation from SC+BR+LC+NFR)
 *   missing-lc       — §3 F.4 Entity Lifecycle (derivation from SC+BR, auto-approve confidence:high)
 *   lc-unlinked-state— §3 F.4 Entity Lifecycle (state/transition merge, same loop-body class)
 *   rpm-role-gap     — §3 F.7 Role & Permission Model (role/action derived from SC.actors)
 *
 * decision (🔴 gate, LOOP_READINESS_AUDIT §5.2 — escalate, never auto-resolve):
 *   fm-status        — §3 F.10 FM status transition
 *   missing-sc       — §3 F.2 Scenario Authoring (approve is 🔴 Strategic)
 *   br-inactive      — §3 F.3 Business Rule (🔴 Critical)
 *   br-semantic      — §3 F.3 Business Rule (🔴 Critical)
 *   ic-semantic      — §3 F.5 Invariant Check (🔴 Critical)
 *   missing-mk       — §4 D.2 Screen Generation (🔴 Strategic)
 *   screen-decision  — §4 D.2/D.3 (visual/iteration decisions)
 *   threshold        — §1 D1.5 Hypothesis Formulation, G5 (success/invalidation thresholds)
 *   moscow           — §2 D1.6 MVP Scope (MoSCoW priorities)
 *   nfr-ask          — §3 F.5a NFR Review (ask-phase [Y]/[D]/[L])
 *   broken-ref       — any zone: a dangling/ambiguous reference, surfaced, never auto-fixed (rail 5)
 *   sc-semantic      — §3 F.2 Scenario Authoring (semantic content, 🔴 Strategic approve)
 *   other            — conservative default for anything unrecognized (rail 4)
 */
const CATEGORY_DISPOSITION = {
  'missing-vc': 'resolvable',
  'missing-lc': 'resolvable',
  'lc-unlinked-state': 'resolvable',
  'rpm-role-gap': 'resolvable',

  'fm-status': 'decision',
  'missing-sc': 'decision',
  'br-inactive': 'decision',
  'br-semantic': 'decision',
  'ic-semantic': 'decision',
  'missing-mk': 'decision',
  'screen-decision': 'decision',
  threshold: 'decision',
  moscow: 'decision',
  'nfr-ask': 'decision',
  'broken-ref': 'decision',
  'sc-semantic': 'decision',
  other: 'decision',
};

// ---------- helpers ----------

/** Lowercase/trim/collapse-whitespace — a stable fallback dedupe-key part when no artifact id is found. */
function normalizeDetail(text) {
  return String(text == null ? '' : text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Matches the repo's artifact-id shape (FM-003, SC-001, SC-001a, VC-100, BR-001, ...).
const ARTIFACT_ID_RE = /\b([A-Z]{2,5}-\d+[a-zA-Z]?)\b/;

/**
 * Best-effort extraction of a single artifact id out of free text (an oracle gap/ambiguity
 * string, or a persona finding description). Used as the dedupe-key anchor so an oracle gap
 * and a persona finding about the SAME artifact collapse to the same key even though their
 * `detail` text differs. If a gap string bundles multiple ids ("SC-001, SC-002"), only the
 * FIRST is used as the key anchor — the full text is still preserved verbatim in `detail`, so
 * no information is lost, only the dedupe anchor is approximate (acceptable: worst case is an
 * extra un-deduped entry, never a wrongly-dropped one).
 */
function extractArtifactId(text) {
  const m = ARTIFACT_ID_RE.exec(String(text == null ? '' : text));
  return m ? m[1] : null;
}

/** Classify a single oracle gaps[] string by its `B<n>:` blocker prefix. Pure. */
function classifyOracleGap(gapString) {
  const m = /^(B\d+):/.exec(String(gapString == null ? '' : gapString));
  const prefix = m ? m[1] : null;
  const mapped = (prefix && ORACLE_PREFIX_MAP[prefix]) || ORACLE_DEFAULT;
  return { category: mapped.category, disposition: mapped.disposition };
}

/** Classify a persona finding's `category` field. Unknown category -> conservative `other`/decision. */
function classifyPersonaCategory(category) {
  if (typeof category === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_DISPOSITION, category)) {
    return { category, disposition: CATEGORY_DISPOSITION[category] };
  }
  return { category: 'other', disposition: 'decision' };
}

/** Build one output item (resolvable[] / decisions[] element) with a stable dedupe key. */
function buildItem(source, category, detail, opts) {
  const options = opts || {};
  const artifactId = options.artifactId || extractArtifactId(detail) || null;
  const idPart = artifactId || normalizeDetail(detail);
  // Dedupe key intentionally omits `source` — the whole point is that the SAME gap surfaced
  // by both the oracle and a persona (e.g. a missing VC for SC-001) collapses to one entry
  // (oracle wins; see classifyGaps below). `source` is still reported on the item itself.
  const key = `${category}:${idPart}`;
  const item = { source, key, category, detail: detail == null ? '' : String(detail) };
  if (options.persona) item.persona = options.persona;
  if (artifactId) item.artifact_id = artifactId;
  return item;
}

// ---------- stop contract ----------

/**
 * Pure stop-verdict — skill "Stop contract" / LOOP_READINESS_AUDIT §5.4:
 *   stop = (wave >= max_waves) OR (score >= tau, i.e. met, with no new resolution this wave)
 *          OR (delta-score < epsilon) OR (info-gain -> 0, i.e. only decisions remain)
 * Multiple conditions may co-fire in the same wave; ALL are collected into `reasons`, but
 * `status` reports only the FIRST matched condition in this fixed priority order:
 *   met > cap > converged > decisions_only
 * (met and cap are absolute/bounded conditions; converged and decisions_only are about the
 * shape of what's left — checking met/cap first matches the skill's own condition ordering).
 */
function shouldStop(params) {
  const p = params || {};
  const met = p.met === true;
  const wave = Number.isFinite(p.wave) ? p.wave : 1;
  const maxWaves = Number.isFinite(p.maxWaves) ? p.maxWaves : 3;
  const score = typeof p.score === 'number' && Number.isFinite(p.score) ? p.score : null;
  const prevScore = typeof p.prevScore === 'number' && Number.isFinite(p.prevScore) ? p.prevScore : null;
  const epsilon = Number.isFinite(p.epsilon) ? p.epsilon : 0.01;
  const resolvedLastWave = Number.isFinite(p.resolvedLastWave) ? p.resolvedLastWave : 0;
  const resolvableCount = Number.isFinite(p.resolvableCount) ? p.resolvableCount : 0;
  const decisionsCount = Number.isFinite(p.decisionsCount) ? p.decisionsCount : 0;

  const reasons = [];
  let status = null;

  if (met && resolvedLastWave === 0) {
    reasons.push('met: score >= tau over the computed DoR blockers, and no gap was newly resolved this wave');
    status = status || 'met';
  }
  if (wave >= maxWaves) {
    reasons.push(`cap: wave ${wave} >= max_waves ${maxWaves}`);
    status = status || 'cap';
  }
  if (prevScore != null && score != null && Math.abs(score - prevScore) < epsilon) {
    reasons.push(`converged: |score(${score}) - prev_score(${prevScore})| < epsilon(${epsilon})`);
    status = status || 'converged';
  }
  if (resolvableCount === 0 && decisionsCount > 0) {
    reasons.push('decisions_only: no resolvable gaps remain — only decisions (info-gain -> 0)');
    status = status || 'decisions_only';
  }

  if (!status) return { fire: false, status: 'continue', reasons: [] };
  return { fire: true, status, reasons };
}

// ---------- main entry ----------

/**
 * CLASSIFY + stop-verdict over one wave's raw findings. Pure function of `input`
 * (see the CLI usage banner / hooks/product/lib/gap-classifier.cjs module doc for the shape).
 * Every field is defensively defaulted — `classifyGaps({})` never throws.
 */
function classifyGaps(rawInput) {
  const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const oracle = input.oracle && typeof input.oracle === 'object' ? input.oracle : {};
  const gaps = Array.isArray(oracle.gaps) ? oracle.gaps : [];
  const ambiguities = Array.isArray(oracle.ambiguities) ? oracle.ambiguities : [];
  const personaFindings = Array.isArray(input.persona_findings) ? input.persona_findings : [];

  // priority 0 = oracle-sourced (wins dedupe), priority 1 = persona-sourced.
  const candidates = [];

  for (const g of gaps) {
    if (typeof g !== 'string' || !g) continue;
    const mapped = classifyOracleGap(g);
    candidates.push({ priority: 0, disposition: mapped.disposition, item: buildItem('oracle', mapped.category, g) });
  }
  for (const a of ambiguities) {
    if (typeof a !== 'string' || !a) continue;
    // Every ambiguity is a decision, category broken-ref — surfaced, never auto-fixed (rail 5).
    candidates.push({ priority: 0, disposition: 'decision', item: buildItem('oracle', 'broken-ref', a) });
  }
  for (const f of personaFindings) {
    if (!f || typeof f !== 'object') continue;
    const mapped = classifyPersonaCategory(f.category);
    const detail = typeof f.description === 'string' ? f.description : '';
    const item = buildItem('persona', mapped.category, detail, {
      artifactId: typeof f.artifact_id === 'string' ? f.artifact_id : null,
      persona: typeof f.persona === 'string' ? f.persona : null,
    });
    candidates.push({ priority: 1, disposition: mapped.disposition, item });
  }

  // Dedupe by key; oracle (priority 0) wins over persona (priority 1) on collision.
  // No silent drops: the raw pre-dedup counts are preserved in counts.oracle_gaps /
  // counts.persona_findings below, even though the deduped item itself is dropped.
  const byKey = new Map();
  for (const c of candidates) {
    const existing = byKey.get(c.item.key);
    if (!existing || c.priority < existing.priority) byKey.set(c.item.key, c);
  }
  const deduped = Array.from(byKey.values());
  const resolvable = deduped.filter((c) => c.disposition === 'resolvable').map((c) => c.item);
  const decisions = deduped.filter((c) => c.disposition === 'decision').map((c) => c.item);

  const stop = shouldStop({
    met: oracle.met === true,
    wave: Number.isFinite(input.wave) ? input.wave : 1,
    maxWaves: Number.isFinite(input.max_waves) ? input.max_waves : 3,
    score: typeof oracle.score === 'number' ? oracle.score : null,
    prevScore: typeof oracle.prev_score === 'number' ? oracle.prev_score : null,
    epsilon: Number.isFinite(input.epsilon) ? input.epsilon : 0.01,
    resolvedLastWave: Number.isFinite(input.resolved_last_wave) ? input.resolved_last_wave : 0,
    resolvableCount: resolvable.length,
    decisionsCount: decisions.length,
  });

  return {
    resolvable,
    decisions,
    stop,
    counts: {
      resolvable: resolvable.length,
      decisions: decisions.length,
      oracle_gaps: gaps.length + ambiguities.length,
      persona_findings: personaFindings.length,
    },
  };
}

module.exports = {
  classifyGaps,
  shouldStop,
  classifyOracleGap,
  classifyPersonaCategory,
  extractArtifactId,
  normalizeDetail,
  ORACLE_PREFIX_MAP,
  CATEGORY_DISPOSITION,
};

// ---------- CLI ----------

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.length !== 1) {
    console.error('usage: node gap-classifier.cjs <input.json>|-  (- = read stdin)');
    process.exit(2);
  }
  const src = argv[0];
  let raw;
  try {
    raw = src === '-' ? fs.readFileSync(0, 'utf-8') : fs.readFileSync(src, 'utf-8');
  } catch (e) {
    console.error(`gap-classifier: cannot read input (${src}): ${e.message}`);
    process.exit(2);
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error(`gap-classifier: invalid JSON: ${e.message}`);
    process.exit(2);
  }
  const result = classifyGaps(input);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
