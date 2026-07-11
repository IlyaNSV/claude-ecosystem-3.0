'use strict';
/**
 * da-depth-floor.cjs — deterministic depth-floor guardrail for the P-RULE-01/02
 * adaptive-depth DA classifier (closes audit gap G30).
 *
 * The problem (G30): the adaptive-depth DA model (processes.md §6.2, DEC-DEV-0012)
 * lets the product-devils-advocate subagent SELF-classify each BR/IC change as
 * `cosmetic` or `significant`. A `cosmetic` verdict downgrades the review to a quick
 * consistency check and SKIPS the full 6-lens DA. That self-classification is pure LLM
 * judgment with no backstop — a false-cosmetic on a genuinely significant change
 * silently skips the review that change required. The G05/G06 watchdog guards that a
 * subagent was spawned at all; nothing guarded the DEPTH it chose.
 *
 * The guardrail: a small set of HIGH-PRECISION, purely structural signals — computed by
 * CODE from the same git diff the hook already has — that make a `cosmetic` verdict
 * unambiguously wrong. When any fire, the entry is stamped `depth_floor: significant`
 * and the DA brief overrides the subagent's self-classification (full 6-lens is
 * mandatory). This mirrors the project's Epic-F principle (also codified in
 * zone-router.cjs): *disposition is deterministic; only the CONTENT of a verdict is a
 * judgment.*
 *
 * Design constraints honored:
 *   - cheap-to-check: reuses the diff already computed by the hook; pure string scan.
 *   - fail-loud: caller emits a loud stderr override + a machine-readable entry field.
 *   - absent == old behavior 1:1: NO signal → floor === null → nothing is stamped, and
 *     the adaptive subagent self-classifies exactly as before. The guardrail only ever
 *     RAISES the floor; it never downgrades and never touches the cosmetic path.
 *
 * Deliberately NOT deterministic here (left to the adaptive LLM — genuinely
 * non-structural, and floor-ing them would collapse DEC-DEV-0012's cost model):
 *   - "statement semantic change" / "statement rewrite" — prose edits are
 *     indistinguishable from typo fixes / rewording (both are §6.2 COSMETIC triggers)
 *     by any regex. The LLM keeps that call.
 *   - BR "parameter TYPE change vs value tune" — a value tune (first_match → best_match)
 *     is an explicit §6.2 COSMETIC example that lives in the same `parameters:` block as
 *     a type change, so a generic parameters-touched signal would false-positive on the
 *     documented cosmetic case. Left to the LLM (agent Step 1 anti-rationalization guard).
 *
 * Pure, dependency-free, unit-tested (tests/product/da-depth-floor.test.cjs).
 */

// A hook replaces an empty `git diff HEAD` with a synthetic marker string when the file
// is new / not yet in git — i.e. artifact CREATION, a §6.2 significant trigger for both
// IC and BR. Same detection used by zone-router.cjs classifyMagnitude.
const CREATION_RE = /No git diff available|likely .*creation|file not in git/i;

/**
 * Return the added/removed CONTENT lines of a unified diff (drops the +++/--- file
 * headers and all context lines). Each element keeps its leading +/- marker.
 */
function changedLines(diff) {
  return String(diff)
    .split(/\r?\n/)
    .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
}

/**
 * computeDepthFloor(diff, artifactType) → { floor: 'significant'|null, signals: string[] }
 *
 * @param {string} diff          unified git diff against HEAD (or the hook's synthetic
 *                               creation marker for a brand-new file).
 * @param {string} artifactType  'invariant-check' | 'business-rule' (others → shared
 *                               signals only).
 *
 * Signals (all map to an ENUMERATED §6.2 "significant" trigger; none fire on the §6.2
 * cosmetic path of typo / reword / metadata-only / ref-list / value-tune edits):
 *   - creation        : new artifact (no HEAD version)              [IC + BR]
 *   - activation      : status transitioning to `active` (binding)  [IC + BR]
 *   - severity-critical: severity line changed to/from `critical`   [IC]
 *   - entity-change   : `entity:` value added/changed               [IC]
 *   - category-change : `category:` value added/changed             [BR]
 */
function computeDepthFloor(diff, artifactType) {
  const signals = [];
  const text = String(diff == null ? '' : diff);

  // Creation (or an otherwise empty/unavailable diff — be safe, same as zone-router).
  if (!text.trim() || CREATION_RE.test(text)) {
    return { floor: 'significant', signals: ['creation'] };
  }

  const lines = changedLines(text);
  const added = lines.filter((l) => l.startsWith('+')).map((l) => l.slice(1).trim());
  // Direction-agnostic set: a field changed to OR from a critical value both appear here.
  const touched = lines.map((l) => l.slice(1).trim());

  // Shared — an artifact becoming `active` is the contract-binding moment; a cosmetic
  // verdict there skips DA exactly when the rule starts to bind.
  if (added.some((l) => /^status:\s*active\b/i.test(l))) signals.push('activation');

  if (artifactType === 'invariant-check') {
    // §6.2: "severity change to/from critical".
    if (touched.some((l) => /^severity:\s*critical\b/i.test(l))) signals.push('severity-critical');
    // §6.2: "entity change" — which entity the invariant binds.
    if (touched.some((l) => /^entity:\s*\S/i.test(l))) signals.push('entity-change');
  } else if (artifactType === 'business-rule') {
    // §6.2: "category change" (validation → authorization → workflow → …).
    if (touched.some((l) => /^category:\s*\S/i.test(l))) signals.push('category-change');
  }

  return signals.length ? { floor: 'significant', signals } : { floor: null, signals: [] };
}

module.exports = { computeDepthFloor, changedLines, CREATION_RE };
