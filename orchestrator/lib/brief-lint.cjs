#!/usr/bin/env node
/**
 * brief-lint.cjs — deterministic CONDUCTOR-BRIEF linter (ENFORCEMENT_PLAN pack 3 —
 * DEC-DEV-0232).
 *
 * WHY THIS EXISTS (lesson I8_FIDELITY — translation fidelity of the conductor):
 *   The conductor is a TRANSLATOR of owner intent into the ecosystem's canonical
 *   paths, not an optimiser of them. Every measured fidelity loss of RUN-B was born
 *   in the BRIEF — the moment a session was told to touch code without being told
 *   which gate proves it. Three cut classes were catalogued:
 *     K1 — amendment lands straight in the downstream spec (`.kiro/`), bypassing the
 *          `.product/` SSOT, so the source of truth silently diverges;
 *     K2 — a NEW feature is built without `handoff → P3 → P5`, i.e. with no spec
 *          layer at all;
 *     K3 — code changes ship with NO gate named (`P6` / `validate-feature-impl`);
 *          this is the P21 shape: "реализуй forward-гард, закоммить" + a green
 *          deploy, and nobody ever asked whether the feature still satisfies its BRs.
 *   Lesson of M16/M7: "what works is what has an enforcement carrier." A convention
 *   saying "briefs must name the gate" is not a carrier. THIS is: a brief that
 *   orders code work while naming no gate FAILS, deterministically, before dispatch.
 *
 * CONTRACT IN ONE LINE:
 *   A brief that changes a feature's CODE must name that feature's GATE.
 *
 * WHAT IT IS NOT:
 *   Not a semantic judge of brief quality — no LLM, no scoring, no style opinion. It
 *   answers exactly one deterministic question per rule: does the brief order work of
 *   class X while omitting the structural counterpart X demands? Whether the brief is
 *   *good* remains a judgment call and stays with the conductor.
 *
 * DESIGN CONSTRAINTS (mirror coverage-oracle.cjs / br-constants-oracle.cjs):
 *   - Node stdlib only; cross-platform LF-normalized I/O; dual-use (require() or CLI).
 *   - Reuses coverage-oracle's `normalizeLF` — single source of truth for CRLF folding.
 *   - Every detection function is pure and exported for contract tests.
 *   - Cyrillic-safe word boundaries: ASCII `\b` does NOT separate `P6` from `Р`/`батч`
 *     in Russian prose, so gate/pipeline tokens use Unicode lookarounds
 *     `(?<![\p{L}\d])P6(?![\p{L}\d])/u` — the same technique br-constants-oracle uses
 *     for unit tails.
 *
 * ANTI-NOISE (a gate that cries wolf gets switched off):
 *   1. `фикс` / `fix` / `почини` count as CODE markers ONLY when the brief also carries
 *      an `FM-NNN` id or a code path (`src/`, `.ts`, `.js`, `middleware`). Otherwise
 *      "фикс опечатки в README" would FAIL every doc brief — and the gate would die.
 *   2. R1/R2 are code-gated BY CONSTRUCTION: a recon / observe / harvest brief carries
 *      neither an FM id nor a code marker, so it passes silently. The linter fires only
 *      where it is certain.
 *   3. R4 (question suppression) is deliberately NOT code-gated: an order to stop asking
 *      is an I-8 violation whatever the work class. The word `предрешен*` alone is NOT a
 *      trigger — pre-decided answers to questions the owner already settled are legal.
 *
 * SANCTION ESCAPE (I-8: narrowing by a DIRECT owner sanction is legitimate):
 *   A line `SANCTION(R1): <reason>` (or `САНКЦИЯ(K3): <reason>`) disables the matching
 *   rule — by rule id, by cut class, or by rule name. The sanction is recorded in
 *   `sanctions[]` instead of `findings[]`, so the escape is auditable, never invisible.
 *   A sanction with an EMPTY reason does NOT apply and raises its own finding
 *   (`sanction-without-reason`) — an unexplained escape is exactly the shape this
 *   linter exists to prevent. Sanction lines are stripped from the text the rules read,
 *   so a reason mentioning "хотфикс" can never itself trip a marker.
 *   A sanction naming an UNKNOWN token is recorded with `applied: false` and disables
 *   nothing — a typo makes the gate stricter, never looser.
 *
 * DELIBERATE LIMITATIONS (documented, not accidental):
 *   1. Markers match WITHIN a line (`[ \t]` separators, never `\s`), so a phrase wrapped
 *      across two lines is missed. Chosen over `\s` because `\s` spanning newlines glues
 *      unrelated bullets into false matches.
 *   2. Rule R1 demands the P6 gate SPECIFICALLY. Naming `feature-to-tdd-impl` without
 *      `P6`/`validate-feature-impl` still FAILS: the build step is not the proof step.
 *   3. Vocabulary is closed and Russian-first (the language briefs are written in).
 *      Unknown synonyms are misses, never false alarms — subtractive by design.
 *
 * EXIT CODES:
 *   0   PASS — no findings
 *   1   FAIL — one or more findings
 *   2   usage / read error
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeLF } = require('./coverage-oracle.cjs');

const BRIEF_LINT_SCHEMA_VERSION = 1;

/** Max length of the `evidence` fragment carried with every finding. */
const EVIDENCE_MAX = 160;

// ---------- vocabularies ----------

/** Feature id — the signal that the brief addresses a SPECIFIC feature. */
const FM_ID_RE = /(?<![A-Za-z0-9_])FM-\d+/;

/** Code coordinates — the guard that turns `фикс`/`fix` into a code marker. */
const CODE_PATH_RE = /(?:src\/|\.ts\b|\.js\b|middleware)/i;

/**
 * CODE markers — the brief orders a change to running code.
 * `guarded: true` markers need FM_ID_RE or CODE_PATH_RE somewhere in the brief
 * (anti-noise 1). Order is the report order of `findCodeMarkers`.
 */
const CODE_MARKERS = [
  { id: 'реализуй', guarded: false, re: /реализ(?:уй|уйте|овать|уем)/iu },
  { id: 'напиши/построй код', guarded: false, re: /(?:построй|напиши|пиши)[ \t]+код/iu },
  { id: 'правь код', guarded: false, re: /правь[ \t]+код/iu },
  { id: 'добавь код', guarded: false, re: /добавь[ \t]+(?:в[ \t]+)?код/iu },
  { id: 'коммит', guarded: false, re: /(?:коммить|\bcommit)/iu },
  { id: 'implement', guarded: false, re: /\bimplement/i },
  { id: 'patch', guarded: false, re: /\bpatch/i },
  { id: 'фикс/почини', guarded: true, re: /(?:почини|исправь|фикс|\bfix\b)/iu },
];

/** GATE names — the proof step for a feature's implementation (P6). */
const GATE_MARKERS = [
  { id: 'validate-feature-impl', re: /validate-feature-impl/i },
  { id: 'P6', re: /(?<![\p{L}\d])P6(?![\p{L}\d])/iu },
];

/** PIPELINE names — the spec layer a NEW feature must travel through. */
const PIPELINE_MARKERS = [
  { id: 'product:handoff', re: /product:handoff/i },
  { id: 'handoff', re: /handoff/i },
  { id: 'batch-features-to-cc-sdd', re: /batch-features-to-cc-sdd/i },
  { id: 'feature-to-tdd-impl', re: /feature-to-tdd-impl/i },
  { id: 'P3', re: /(?<![\p{L}\d])P3(?![\p{L}\d])/iu },
  { id: 'P5', re: /(?<![\p{L}\d])P5(?![\p{L}\d])/iu },
];

/** NEW-FEATURE markers — work that has no upstream spec yet (K2 shape). */
const FEATURE_MARKERS = [
  { id: 'новая фича', re: /нов(?:ая|ую|ый|ое)[ \t]+(?:фич|функциональн|поведени)/iu },
  { id: 'new feature', re: /new[ \t]+feature/i },
  { id: 'с нуля', re: /с[ \t]+нуля/iu },
];

/** DOWNSTREAM spec zone (K1 shape) and its SSOT counterpart. */
const KIRO_RE = /\.kiro\//i;
const PRODUCT_SSOT_RE = /\.product\b/i;

/** I-8: orders that strip the executor's right to ask / escalate / park. */
const SUPPRESSION_MARKERS = [
  { id: 'не спрашивай', re: /не[ \t]+спрашивай/iu },
  { id: 'не задавай вопрос', re: /не[ \t]+задавай[ \t]+вопрос/iu },
  { id: 'вопросов не задавать', re: /вопрос(?:ов)?[ \t]+не[ \t]+задавать/iu },
  { id: 'без вопросов', re: /без[ \t]+вопросов/iu },
  { id: 'не эскалируй', re: /не[ \t]+эскалируй/iu },
  { id: 'не паркуйся', re: /не[ \t]+паркуйся/iu },
  { id: 'AskUserQuestion запрещ', re: /AskUserQuestion[ \t]+запрещ/i },
  { id: 'не поднимай AskUserQuestion', re: /не[ \t]+поднимай[ \t]+AskUserQuestion/iu },
];

/** B2 remediation mode: catching the canon up on work already done. */
const REMEDIATION_RE = /REMEDIATION-RUN/;

/** The three legs a REMEDIATION-RUN must name — spec, audit, gate. */
const REMEDIATION_LEGS = [
  { id: 'handoff', res: [/handoff/i] },
  { id: 'audit-spec-fidelity|P4', res: [/audit-spec-fidelity/i, /(?<![\p{L}\d])P4(?![\p{L}\d])/iu] },
  { id: 'validate-feature-impl|P6', res: [/validate-feature-impl/i, /(?<![\p{L}\d])P6(?![\p{L}\d])/iu] },
];

/** Rule metadata — id / stable name / cut class / remediation hint. */
const RULES = [
  {
    id: 'R1',
    name: 'code-without-gate',
    cls: 'K3',
    hint: 'Бриф меняет код фичи — назови её гейт: P6 / validate-feature-impl (полный брекет).',
  },
  {
    id: 'R2',
    name: 'feature-bypass',
    cls: 'K2',
    hint: 'Новая фича строится мимо спек-слоя — назови путь: product:handoff → P3 (batch-features-to-cc-sdd) → P5 (feature-to-tdd-impl).',
  },
  {
    id: 'R3',
    name: 'amendment-bypass',
    cls: 'K1',
    hint: 'Правка downstream-спеки (.kiro/) мимо SSOT — амендмент идёт в .product/, затем регенерация.',
  },
  {
    id: 'R4',
    name: 'question-suppression',
    cls: 'I-8',
    hint: 'Убери подавление права на вопрос: исполнитель обязан эскалировать owner-класс, а не молчать.',
  },
  {
    id: 'R5',
    name: 'remediation-incomplete',
    cls: 'B2',
    hint: 'REMEDIATION-RUN обязан назвать все три ноги: handoff + audit-spec-fidelity (P4) + validate-feature-impl (P6).',
  },
];

/** Sanction line: `SANCTION(R1): reason` / `САНКЦИЯ(K3): reason`. */
const SANCTION_RE = /^[ \t]*(?:SANCTION|САНКЦИЯ)[ \t]*\([ \t]*([^)\n]{1,40}?)[ \t]*\)[ \t]*:?[ \t]*(.*)$/iu;

// ---------- pure helpers ----------

function clip(s) {
  const t = String(s == null ? '' : s).trim();
  return t.length > EVIDENCE_MAX ? t.slice(0, EVIDENCE_MAX) : t;
}

/** First line matching any marker → { id, evidence }; else null. Deterministic order. */
function findFirst(lines, markers) {
  for (const line of lines) {
    for (const m of markers) {
      const re = m.re || m;
      if (re.test(line)) return { id: m.id || null, evidence: clip(line) };
    }
  }
  return null;
}

/** Presence check over the whole text (used for ABSENCE assertions). */
function hasAny(text, markers) {
  return markers.some((m) => (m.re || m).test(text));
}

function hasGateName(text) {
  return hasAny(String(text || ''), GATE_MARKERS);
}

function hasPipelineName(text) {
  return hasAny(String(text || ''), PIPELINE_MARKERS);
}

/**
 * CODE markers present in the brief, guard applied (anti-noise 1).
 * Returns [{ id, evidence }] in CODE_MARKERS order — not document order, so the
 * report is stable regardless of how the brief is worded.
 */
function findCodeMarkers(text) {
  const raw = normalizeLF(String(text || ''));
  const lines = raw.split('\n');
  const guardOk = FM_ID_RE.test(raw) || CODE_PATH_RE.test(raw);
  const out = [];
  for (const m of CODE_MARKERS) {
    if (m.guarded && !guardOk) continue;
    const hit = findFirst(lines, [m]);
    if (hit) out.push({ id: m.id, evidence: hit.evidence });
  }
  return out;
}

/** Rules a sanction token addresses: by rule id, by cut class, or by rule name. */
function rulesForSanctionToken(token) {
  const t = String(token || '').trim().toUpperCase();
  if (!t) return [];
  return RULES.filter(
    (r) => r.id.toUpperCase() === t || r.cls.toUpperCase() === t || r.name.toUpperCase() === t
  );
}

/**
 * Split brief lines into sanction declarations and the text the rules actually read.
 * Returns { lines (sanctions removed), sanctions: [{rule, reason, applied}],
 *           disabled: Set<ruleId>, unreasoned: [{token, evidence}] }.
 */
function parseSanctions(inputLines) {
  const lines = [];
  const sanctions = [];
  const disabled = new Set();
  const unreasoned = [];

  for (const line of inputLines) {
    const m = SANCTION_RE.exec(line);
    if (!m) {
      lines.push(line);
      continue;
    }
    const token = m[1].trim();
    const reason = m[2].trim();
    const targets = rulesForSanctionToken(token);
    const applied = reason.length > 0 && targets.length > 0;
    if (applied) for (const r of targets) disabled.add(r.id);
    if (!reason.length) unreasoned.push({ token, evidence: clip(line) });
    sanctions.push({ rule: token, reason: reason || null, applied });
  }

  return { lines, sanctions, disabled, unreasoned };
}

// ---------- the linter ----------

/**
 * Lint one brief. Pure: text in, report out, no I/O.
 *
 * @param {string} rawText brief text (LF or CRLF — folded internally)
 * @returns {{schema_version:number, verdict:'PASS'|'FAIL',
 *            findings:Array<{id:string,rule:string,cls:string,evidence:string,hint:string}>,
 *            sanctions:Array<{rule:string,reason:?string,applied:boolean}>,
 *            stats:{rules_checked:number, sanctioned:number}}}
 */
function lintBrief(rawText) {
  const allLines = normalizeLF(String(rawText || '')).split('\n');
  const { lines, sanctions, disabled, unreasoned } = parseSanctions(allLines);
  const body = lines.join('\n');

  const findings = [];
  const ruleById = new Map(RULES.map((r) => [r.id, r]));
  const add = (ruleId, evidence, hintOverride) => {
    const r = ruleById.get(ruleId);
    findings.push({
      id: r.id,
      rule: r.name,
      cls: r.cls,
      evidence: evidence || '',
      hint: hintOverride || r.hint,
    });
  };
  const active = (ruleId) => !disabled.has(ruleId);

  // An unexplained escape is itself a finding — and does NOT disable its rule.
  for (const u of unreasoned) {
    findings.push({
      id: 'S0',
      rule: 'sanction-without-reason',
      cls: 'meta',
      evidence: u.evidence,
      hint: `Санкция SANCTION(${u.token}) без причины не действует — допиши причину (кто разрешил и почему).`,
    });
  }

  const codeMarkers = findCodeMarkers(body);
  const hasCode = codeMarkers.length > 0;
  const hasFm = FM_ID_RE.test(body);

  // R1 — code on a named feature with no gate named (K3, the P21 shape).
  if (active('R1') && hasFm && hasCode && !hasGateName(body)) {
    add('R1', codeMarkers[0].evidence);
  }

  // R2 — a NEW feature built with no spec layer named (K2).
  const featureHit = findFirst(lines, FEATURE_MARKERS);
  if (active('R2') && featureHit && hasCode && !hasPipelineName(body)) {
    add('R2', featureHit.evidence);
  }

  // R3 — downstream spec edited without the .product/ SSOT in sight (K1).
  if (active('R3') && KIRO_RE.test(body) && !PRODUCT_SSOT_RE.test(body)) {
    const hit = findFirst(lines, [{ id: '.kiro/', re: KIRO_RE }]);
    add('R3', hit ? hit.evidence : '');
  }

  // R4 — the executor's right to ask is being revoked (I-8).
  const suppressionHit = findFirst(lines, SUPPRESSION_MARKERS);
  if (active('R4') && suppressionHit) {
    add('R4', suppressionHit.evidence);
  }

  // R5 — remediation run that skips one of the three canon legs (B2).
  if (active('R5') && REMEDIATION_RE.test(body)) {
    const missing = REMEDIATION_LEGS.filter((leg) => !leg.res.some((re) => re.test(body))).map((l) => l.id);
    if (missing.length) {
      const hit = findFirst(lines, [{ id: 'REMEDIATION-RUN', re: REMEDIATION_RE }]);
      add(
        'R5',
        hit ? hit.evidence : '',
        `REMEDIATION-RUN не называет: ${missing.join(', ')}. Догон канона обязан пройти все три ноги (handoff + P4 + P6).`
      );
    }
  }

  return {
    schema_version: BRIEF_LINT_SCHEMA_VERSION,
    verdict: findings.length ? 'FAIL' : 'PASS',
    findings,
    sanctions,
    stats: {
      rules_checked: RULES.length - disabled.size,
      sanctioned: disabled.size,
    },
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { brief: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--brief') args.brief = argv[++i];
    else if (!args.brief && !a.startsWith('--')) args.brief = a;
  }
  return args;
}

function printHelp() {
  console.log(`brief-lint.cjs — deterministic conductor-brief linter (ENFORCEMENT_PLAN pack 3)

Usage:
  node brief-lint.cjs <brief-file>
      Lint a brief; prints a JSON report on stdout.

Contract: a brief that changes a feature's CODE must name that feature's GATE.

Rules:
  R1 code-without-gate      (K3)  FM-id + code marker, no P6 / validate-feature-impl
  R2 feature-bypass         (K2)  new feature + code marker, no handoff / P3 / P5
  R3 amendment-bypass       (K1)  edits .kiro/ without naming the .product/ SSOT
  R4 question-suppression   (I-8) orders the executor to stop asking / escalating
  R5 remediation-incomplete (B2)  REMEDIATION-RUN missing handoff / P4 / P6

Owner escape (auditable, never silent):
  SANCTION(R1): <причина>      disables R1 for this brief (also САНКЦИЯ(...), or a
  SANCTION(K3): <причина>      cut class / rule name as the token).
  A sanction without a reason does NOT apply and raises its own finding.

Exit codes:
  0  PASS — no findings
  1  FAIL — findings present
  2  usage / read error

Schema: brief_lint_schema_version ${BRIEF_LINT_SCHEMA_VERSION}
`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.brief) {
    console.error('ERROR: <brief-file> is required');
    printHelp();
    process.exit(2);
  }

  let raw;
  try {
    raw = fs.readFileSync(args.brief, 'utf8');
  } catch (e) {
    console.error(`ERROR: cannot read ${args.brief}: ${e.message}`);
    process.exit(2);
  }

  const report = lintBrief(raw);
  report.brief_file = path.resolve(args.brief);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  BRIEF_LINT_SCHEMA_VERSION,
  RULES,
  CODE_MARKERS,
  GATE_MARKERS,
  PIPELINE_MARKERS,
  FEATURE_MARKERS,
  SUPPRESSION_MARKERS,
  clip,
  findFirst,
  hasAny,
  hasGateName,
  hasPipelineName,
  findCodeMarkers,
  rulesForSanctionToken,
  parseSanctions,
  lintBrief,
};
