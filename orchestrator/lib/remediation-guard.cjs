#!/usr/bin/env node
/**
 * remediation-guard.cjs — deterministic remediation-discretion classifier for the
 * Orchestrator P5/P6 remediation loops (DEC-DEV-0096, N+2 queue P5 / T5; work-order
 * dev/_archive/orchestrator/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md).
 *
 * WHY THIS EXISTS (live-run B+C, FB-LR-07 / FB-LR-08 — DEC-DEV-0091):
 *   Remediation agents had no codified discretion. Two failure modes were observed:
 *     (1) FB-LR-07 — a remediation that hit a CROSS-SPEC contradiction (FM-001↔FM-005
 *         `had_trial`: two requirements disagree) or a DESIGN self-contradiction
 *         (`card_last4`) was sometimes RESOLVED UNILATERALLY by one agent that
 *         committed and "won" — masking an upstream conflict that should have escalated
 *         to a CONCERN/product decision. Two sibling agents correctly BLOCKED; the
 *         committer overrode them silently.
 *     (2) FB-LR-08 — a TRANSIENT impl-block (a locked git index / a flaky install / a
 *         momentarily-down substrate) was treated like a content block: one debug round
 *         then skip, needing a manual re-drive — when a bounded auto-retry would clear it.
 *   This lib is the DETERMINISTIC backbone (run by an agent via Bash, relayed as JSON —
 *   like coverage-oracle / fidelity-oracle / env-readiness, DEC-DEV-0073 §D.1) that turns
 *   a free-text blocker / remediation note into a machine-readable discretion verdict:
 *     classifyBlock(text)              — what KIND of block is this, and is it retryable?
 *     detectsUnilateralResolution(text)— does this "fix" note admit a unilateral
 *                                        resolution of a contradiction? (the FB-LR-07
 *                                        anti-mask backstop, even on a CLAIMED success).
 *   The agent's structured self-report is the hybrid judgment layer on top; the FSM
 *   routes on the worst-of (conservative toward ESCALATION — never toward silent GO).
 *
 * CONSERVATIVE BY DESIGN:
 *   - A block that matches NO signature is `content` (route: debug-block) — never
 *     auto-retried, never silently escalated. Uncertainty does not become a retry.
 *   - A conflict signal ALWAYS beats a transient signal (a "retry" must never paper over
 *     a real cross-spec/design contradiction).
 *   - detectsUnilateralResolution fires only on the CONJUNCTION of a resolution verb
 *     (chose / picked / decided / went-with / resolved-by) AND a contradiction context
 *     (contradiction / conflict / both specs / two requirements disagree) — so a routine
 *     "I chose the simplest assertion" fix is NOT flagged. A flagged note is SURFACED for
 *     review (it does not unwind the commit) — surface-not-block, matching the gate's
 *     "surface, don't auto-fix" philosophy (DEC-DEV-0095 lesson 3).
 *
 * SCOPE / KNOWN BOUNDARY (FB-LR-22, Run C glossary live-run — documented, not yet tightened):
 *   In practice this lib is a TRANSIENT / INFRA / CAPABILITY classifier. Its cross-spec /
 *   design-contradiction signatures match an EXPLICITLY-WORDED contradiction ("specs
 *   contradict", "req 1.1 vs 12.6", "design says both"), but a freshly-worded SEMANTIC conflict
 *   often matches NO signature → classifyBlock returns `content`, and the ESCALATION is then
 *   carried entirely by the agent's own reading. This is BY CONTRACT: the FSM escalates if
 *   EITHER the lib OR the agent sees a contradiction (conservative — a missed lib match does not
 *   lose an escalation as long as the agent reads carefully), so the deterministic layer must
 *   NOT be relied on as the SOLE conflict detector. Evidence: in Run C glossary all 3 real
 *   cross-spec escalations classified `content` and rode the agent's judgment — the lib carried
 *   0 load on the T5-critical semantic-conflict path. Tightening the cross-spec heuristic so the
 *   deterministic backbone shares that load is an OPEN follow-up (FB-LR-22); until then treat
 *   this as a transient/infra/capability classifier with best-effort conflict detection, and keep
 *   the agent-side "escalate on your own reading" instruction load-bearing (it is, in run.md / P5 / P6).
 *
 * EXIT CODES: 0 ran ok (verdict in JSON) · 2 usage/internal error.
 * Dual-use: `require()` it for the pure classifiers (unit-tested, no child_process);
 * run it as a CLI to classify a single blocker / fix-note.
 *
 * Node stdlib only; cross-platform.
 */

'use strict';

const REMEDIATION_GUARD_SCHEMA_VERSION = 1;

// Block classes, ordered by ESCALATION SEVERITY (later = more serious / less recoverable
// inside the loop). worstClass() picks the highest-ranked of two — conservative toward
// surfacing, so a "retry" never masks a conflict.
const BLOCK_CLASSES = {
  TRANSIENT: 'transient',                 // a flaky/locked/timed-out hiccup → bounded auto-retry
  CONTENT: 'content',                     // a genuine code/logic gap → debug round, then block
  CAPABILITY: 'capability',               // missing tool/secret/access → capability request (§6)
  CROSS_SPEC_CONFLICT: 'cross-spec-conflict', // two requirements/specs disagree → escalate, do NOT self-resolve
  DESIGN_CONTRADICTION: 'design-contradiction', // design.md contradicts itself → escalate, do NOT pick a side
};

const CLASS_RANK = {
  [BLOCK_CLASSES.TRANSIENT]: 0,
  [BLOCK_CLASSES.CONTENT]: 1,
  [BLOCK_CLASSES.CAPABILITY]: 2,
  [BLOCK_CLASSES.CROSS_SPEC_CONFLICT]: 3,
  [BLOCK_CLASSES.DESIGN_CONTRADICTION]: 3,
};

// Per-class routing: how the FSM should treat this class.
//   retry            — bounded auto-retry (transient only)
//   debug-block      — one debug round then record-block (the existing content path)
//   capability-request — route to the Integrator via pending-actions (§6), do not self-equip
//   escalate-concern — surface as a CONCERN / product decision, NEVER self-resolve, NEVER retry
const ROUTE = {
  [BLOCK_CLASSES.TRANSIENT]: 'retry',
  [BLOCK_CLASSES.CONTENT]: 'debug-block',
  [BLOCK_CLASSES.CAPABILITY]: 'capability-request',
  [BLOCK_CLASSES.CROSS_SPEC_CONFLICT]: 'escalate-concern',
  [BLOCK_CLASSES.DESIGN_CONTRADICTION]: 'escalate-concern',
};

// ---------------------------------------------------------------------------
// Signature tables. Each entry is labelled so the relayed JSON + the unit test can
// name which signal fired. Single source of truth — classifyBlock + the test read these.
// Order of EVALUATION does not matter (we collect ALL hits, then pick worst-of); the
// CLASS_RANK ordering is what makes a conflict beat a transient.
// ---------------------------------------------------------------------------

// A genuine cross-spec / cross-feature contradiction — two parts of the canon disagree.
// This is the FB-LR-07 trial-seam class: NEVER resolve it inside remediation.
// NB: the gaps use [^\n] (not [^.\n]) because requirement IDs contain dots
// ("req 1.1 vs 12.6", "FM-005"); the tight char window still keeps the match from
// crossing into an unrelated sentence, and the conservative direction here is toward
// ESCALATION (a false conflict is surfaced for review, never a silent GO).
const CROSS_SPEC_SIGNATURES = [
  { label: 'specs-contradict', re: /\b(?:specs?|requirements?)\b[^\n]{0,40}\b(?:contradict|conflict|disagree|incompatible)/i },
  { label: 'contradicts-requirement', re: /contradict(?:s|ed|ion)?\b[^\n]{0,40}\b(?:requirement|spec|FM-\d|BR-\d|IC-\d)/i },
  { label: 'requirement-vs-requirement', re: /\b(?:req(?:uirement)?|FM|BR|IC|SC)[-\s]?\d+[^\n]{0,30}\b(?:vs\.?|versus|↔|against)\b[^\n]{0,30}\b(?:req(?:uirement)?|FM|BR|IC|SC)[-\s]?\d+/i },
  { label: 'conflicting-requirements', re: /\bconflicting\b[^\n]{0,20}\b(?:requirements?|specs?|rules?)/i },
  { label: 'cross-feature-conflict', re: /cross[-\s]?(?:spec|feature)[^\n]{0,20}\b(?:conflict|contradiction|ownership)/i },
  { label: 'ambiguous-ownership', re: /\b(?:ambiguous|disputed|unclear)\b[^\n]{0,20}\bownership\b/i },
];

// The design document contradicts ITSELF (one spec, internally inconsistent). The
// `card_last4` class — picking a path is a DESIGN decision, not a remediation's to make.
const DESIGN_CONTRADICTION_SIGNATURES = [
  { label: 'design-self-contradiction', re: /design\b[^.\n]{0,30}\b(?:self[-\s]?contradict|contradicts itself|internally inconsistent)/i },
  { label: 'design-says-both', re: /design(?:\.md)?\b[^.\n]{0,30}\b(?:says|states|specifies)\b[^.\n]{0,30}\bboth\b/i },
  { label: 'contradictory-design', re: /\bcontradictory\b[^.\n]{0,20}\bdesign\b|\bdesign\b[^.\n]{0,20}\bcontradictor/i },
  { label: 'two-design-paths', re: /design\b[^.\n]{0,40}\b(?:two|both|either)\b[^.\n]{0,30}\b(?:paths?|approaches?|options?)\b[^.\n]{0,30}\b(?:contradict|incompatible|mutually exclusive)/i },
];

// A capability the process needs and lacks — a tool / secret / access / an upstream
// product decision. Routes to the Integrator/Product (§6), not a self-equip, not a retry.
const CAPABILITY_SIGNATURES = [
  { label: 'missing-secret', re: /\b(?:missing|no|absent|lack(?:s|ing)?)\b[^.\n]{0,20}\b(?:secret|api[-\s]?key|credential|token|env(?:ironment)? var)/i },
  { label: 'tool-not-installed', re: /\b(?:tool|binary|cli|command|mcp)\b[^.\n]{0,20}\bnot (?:installed|available|found|on PATH)/i },
  { label: 'needs-access', re: /\b(?:needs?|requires?|lack(?:s|ing)?)\b[^.\n]{0,25}\b(?:access|permission|provisioning|an account)/i },
  { label: 'needs-upstream-decision', re: /\b(?:needs?|requires?|awaiting|pending)\b[^.\n]{0,25}\b(?:upstream|product|human|owner)\b[^.\n]{0,15}\bdecision/i },
  { label: 'capability-gap', re: /\bcapability\b[^.\n]{0,15}\b(?:gap|missing|lack)/i },
];

// A flaky / recoverable hiccup that a bounded retry would clear. KEPT NARROW — only
// genuinely transient signatures; anything broader risks auto-retrying a real defect.
const TRANSIENT_SIGNATURES = [
  { label: 'git-index-lock', re: /index\.lock|Unable to create[^.\n]*\.lock|another git process/i },
  { label: 'resource-temporarily-unavailable', re: /\b(?:EAGAIN|resource temporarily unavailable|ETXTBSY)\b/i },
  { label: 'network-timeout', re: /\b(?:ETIMEDOUT|ECONNRESET|socket hang up|network timeout|registry .*timed? ?out)\b/i },
  { label: 'rate-limited', re: /\b(?:rate[-\s]?limit(?:ed|ing)?|too many requests|HTTP 429|HTTP 503|temporarily unavailable)\b/i },
  { label: 'install-flake', re: /\b(?:ENOTEMPTY|EBUSY)\b[^.\n]{0,30}\b(?:rename|rmdir|unlink)|npm (?:WARN|ERR).*ETIMEDOUT|lockfile .*changed/i },
  { label: 'try-again', re: /\b(?:please )?(?:try again|retry|transient|flaky|intermittent)\b/i },
];

const SIGNATURE_TABLES = [
  { cls: BLOCK_CLASSES.CROSS_SPEC_CONFLICT, sigs: CROSS_SPEC_SIGNATURES },
  { cls: BLOCK_CLASSES.DESIGN_CONTRADICTION, sigs: DESIGN_CONTRADICTION_SIGNATURES },
  { cls: BLOCK_CLASSES.CAPABILITY, sigs: CAPABILITY_SIGNATURES },
  { cls: BLOCK_CLASSES.TRANSIENT, sigs: TRANSIENT_SIGNATURES },
];

function worstClass(a, b) {
  if (!a) return b;
  if (!b) return a;
  return CLASS_RANK[a] >= CLASS_RANK[b] ? a : b;
}

/**
 * Classify a free-text blocker / remediation-failure reason into a discretion verdict.
 * Collects ALL matching signals across the tables, then picks the worst-of class (a
 * conflict beats a transient beats … — conservative toward escalation). A reason matching
 * NO signature is `content` (route: debug-block) — uncertainty never becomes a retry.
 *
 * @returns {{ class, route, retryable, signals: [{class,label}], schema_version }}
 */
function classifyBlock(text) {
  const s = String(text == null ? '' : text);
  const signals = [];
  let cls = null;
  for (const table of SIGNATURE_TABLES) {
    for (const sig of table.sigs) {
      if (sig.re.test(s)) {
        signals.push({ class: table.cls, label: sig.label });
        cls = worstClass(cls, table.cls);
      }
    }
  }
  const finalClass = cls || BLOCK_CLASSES.CONTENT;
  return {
    schema_version: REMEDIATION_GUARD_SCHEMA_VERSION,
    class: finalClass,
    route: ROUTE[finalClass],
    retryable: finalClass === BLOCK_CLASSES.TRANSIENT,
    signals,
  };
}

// ---------------------------------------------------------------------------
// detectsUnilateralResolution — the FB-LR-07 anti-mask backstop.
// A "fix" note that admits a unilateral resolution of a contradiction is flagged so the
// FSM can SURFACE it as a CONCERN (forcing MANUAL_VERIFY) rather than accepting it as a
// clean fix that silently buried the conflict. Fires ONLY on the CONJUNCTION of a
// resolution verb AND a contradiction context — a routine fix note is not flagged.
// ---------------------------------------------------------------------------
const RESOLUTION_VERB_SIGNATURES = [
  { label: 'chose', re: /\bI?\s*(?:chose|choose|picked|pick|selected|opted for|went with|decided (?:to|on)|settled on)\b/i },
  { label: 'resolved-by-deciding', re: /\bresolv(?:ed|e|ing)\b[^.\n]{0,30}\b(?:by (?:choosing|picking|deciding|going with|using)|in favou?r of)/i },
  { label: 'disambiguated', re: /\b(?:disambiguat|adjudicat|arbitrat)(?:ed|e|ing)\b/i },
];

const CONTRADICTION_CONTEXT_SIGNATURES = [
  { label: 'contradiction-context', re: /\b(?:contradict(?:s|ed|ion|ory)?|conflict(?:s|ed|ing)?|inconsistent|disagree(?:s|d|ment)?|incompatible|mutually exclusive)\b/i },
  { label: 'both-specs-context', re: /\b(?:both|two|either)\b[^.\n]{0,25}\b(?:specs?|requirements?|designs?|rules?|paths?|sources?)\b/i },
  { label: 'spec-ids-context', re: /\b(?:FM|BR|IC|SC|NFR)[-\s]?\d+\b[^.\n]{0,40}\b(?:FM|BR|IC|SC|NFR)[-\s]?\d+\b/i },
];

/**
 * Scan a remediation / fix note for a unilateral resolution of a contradiction.
 * @returns {{ unilateral: boolean, verb_signals, context_signals, schema_version }}
 */
function detectsUnilateralResolution(text) {
  const s = String(text == null ? '' : text);
  const verbSignals = RESOLUTION_VERB_SIGNATURES.filter((sig) => sig.re.test(s)).map((sig) => sig.label);
  const contextSignals = CONTRADICTION_CONTEXT_SIGNATURES.filter((sig) => sig.re.test(s)).map((sig) => sig.label);
  return {
    schema_version: REMEDIATION_GUARD_SCHEMA_VERSION,
    unilateral: verbSignals.length > 0 && contextSignals.length > 0,
    verb_signals: verbSignals,
    context_signals: contextSignals,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--reason': a.reason = next(); break;
      case '--fix-note': a.fixNote = next(); break;
      default: break;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'remediation-guard.cjs — remediation-discretion classifier (DEC-DEV-0096, T5)',
    '',
    'CLASSIFY A BLOCK:  node remediation-guard.cjs --reason "<blocker text>"',
    '  → JSON { class: transient|content|capability|cross-spec-conflict|design-contradiction,',
    '           route, retryable, signals }',
    '  transient ⇒ bounded auto-retry; cross-spec-conflict|design-contradiction ⇒ escalate (never self-resolve);',
    '  capability ⇒ Integrator/Product request; content/unmatched ⇒ debug-block (conservative default).',
    '',
    'CHECK A FIX NOTE:  node remediation-guard.cjs --fix-note "<remediation note>"',
    '  → JSON { unilateral: bool, verb_signals, context_signals }',
    '  unilateral=true ⇒ the note admits resolving a contradiction by picking a side ⇒ SURFACE as a CONCERN',
    '  (FB-LR-07 anti-mask) — do NOT accept it as a clean fix.',
  ].join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (args.reason == null && args.fixNote == null)) {
    printHelp();
    process.exit(args.help ? 0 : 2);
  }
  let output;
  if (args.fixNote != null) {
    output = { mode: 'fix-note', ...detectsUnilateralResolution(args.fixNote) };
  } else {
    output = { mode: 'block', ...classifyBlock(args.reason) };
  }
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  REMEDIATION_GUARD_SCHEMA_VERSION,
  BLOCK_CLASSES,
  CLASS_RANK,
  ROUTE,
  CROSS_SPEC_SIGNATURES,
  DESIGN_CONTRADICTION_SIGNATURES,
  CAPABILITY_SIGNATURES,
  TRANSIENT_SIGNATURES,
  worstClass,
  classifyBlock,
  detectsUnilateralResolution,
};
