#!/usr/bin/env node
/**
 * br-constants-oracle.cjs — deterministic NUMERIC-CONSTANT oracle for the
 * CODE ↔ BR layer (ENFORCEMENT_PLAN pack 2.1 — DEC-DEV-0231).
 *
 * WHY THIS EXISTS (causal probe M16 — DEC-DEV-0229):
 *   In the A/B causal probe, the implementation arm TRUNCATED an auto-retry
 *   schedule declared by the spec as 15/30/60 (it shipped only 15/30), and it
 *   accepted a video duration "as the client said it" — walking straight past the
 *   spec's 180-minute ceiling and the 30-minute trial cap. Neither miss was
 *   caught, for one structural reason: NO template and NO gate ever required
 *   anyone to reconcile a constant living in CODE with the BR that is its source.
 *   The knowledge existed in the handoff; nothing carried enforcement to it.
 *   Lesson of the probe: "what works is what has an enforcement carrier."
 *   This oracle is that carrier for numeric constants — the verdict comes from
 *   CODE over ground truth, never from an implementer's self-report.
 *
 * WHAT IT IS NOT — no overlap with P4 (`audit-spec-fidelity.mjs`):
 *   P4 already owns the SPEC ↔ BR layer: an LLM fidelity-auditor emits findings of
 *   kind `value-mismatch` by JUDGING generated spec text against product artifacts.
 *   That is semantic and probabilistic by construction. THIS oracle owns the
 *   distinct CODE ↔ BR layer and is 100% deterministic: it re-derives the numeric
 *   constants declared by the Business Rules from GROUND TRUTH handoff text, and
 *   diffs them against a claim set describing what the CODE actually contains.
 *   Different layer, different mechanism; neither replaces the other.
 *
 * DIVISION OF LABOUR — WHO CONVERTS UNITS (read this before writing claims):
 *   Values are compared IN THE UNITS OF THE SPEC. This oracle does NOT convert:
 *   a BR saying `30 мин` and code saying `TRIAL_CAP_SECONDS = 1800` is NOT
 *   reconciled here. Normalising the code constant into spec units (1800 s → 30)
 *   is the obligation of the validator agent that composes the claim set; that
 *   conversion is a judgment call (which unit, which rounding) and judgment is
 *   exactly what an oracle must not do. The oracle then checks the arithmetic
 *   claim deterministically.
 *
 * DESIGN CONSTRAINTS (mirror coverage-oracle.cjs / fidelity-oracle.cjs):
 *   - Node stdlib only; cross-platform LF-normalized I/O; dual-use (require() or CLI).
 *   - Reuses coverage-oracle's { normalizeLF, stripFrontmatter, extractSections } —
 *     single source of truth for frontmatter stripping and the monotonic-increase
 *     `## N.` section guard; those are NOT re-implemented here.
 *   - Every extraction/derivation function is pure and exported for contract tests.
 *
 * ANTI-NOISE: MASKING BEFORE NUMBER SCANNING (the core of the design)
 *   A BR block is full of digits that are NOT constants: artifact ids (BR-010,
 *   SC-005), dates (2026-05-10), section refs (§7), step refs (шаг 3 / step 2),
 *   versions (v1.2). Those tokens are masked with `#` (LENGTH-PRESERVING, so raw
 *   fragments can still be sliced out of the ORIGINAL line) BEFORE any number
 *   regex runs. Masking is subtractive-only: it can never invent a constant.
 *
 * DELIBERATE LIMITATIONS (documented, not accidental):
 *   1. BARE NUMBERS ARE NOT EXTRACTED. A digit with no name, no unit, no slash-list
 *      and no comparison operator is prose ("3 варианта"), not a checkable constant.
 *      Extracting it would flood the report with false `missing` entries and the gate
 *      would be turned off — a noisy gate is a dead gate.
 *   2. Parameter names are ASCII by grammar (`имя: значение`), so Russian prose lines
 *      fall through to the unit/predicate scanners instead of becoming "parameters".
 *   3. Rule universe = the rules that contributed at least one constant. A claim
 *      naming a BR that declares NO numbers is reported `fabricated` — deliberately
 *      conservative: a numeric claim attributed to a rule without numbers is
 *      exactly the M16 failure shape ("accepted as the client said it").
 *   4. Only `### …BR-NNN…` headings cut blocks (the oracle is BR-scoped by name).
 *
 * MODES:
 *   extract  (--handoff only)              → dump the ground-truth constants
 *   check    (--handoff + --claims <json>) → diff CODE claims against ground truth
 *
 * EXIT CODES:
 *   0   extract mode ran OK, or check mode passed
 *   1   check mode: missing / mismatched / fabricated constants found
 *   2   usage / read error / malformed claims JSON
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeLF, stripFrontmatter, extractSections } = require('./coverage-oracle.cjs');

const BR_CONSTANTS_SCHEMA_VERSION = 1;

/** §6 Business Rules is where BR-NNN blocks live (handoff-spec §6). */
const DEFAULT_SECTIONS = [6];

/** Max length of the `raw` evidence fragment carried with every constant. */
const RAW_MAX = 120;

// ---------- masking (anti-noise) ----------

// Artifact-id families whose `-NNN` suffix is an identifier, never a constant.
const ARTIFACT_PREFIXES = [
  'BR', 'SC', 'FM', 'IC', 'VC', 'NFR', 'LC', 'MK', 'NM', 'SI', 'RPM', 'AM',
  'BG', 'HYP', 'MVP', 'RL', 'SEG', 'VP', 'MR', 'CA', 'PS', 'RM', 'DS',
  'NOTE', 'LESSON',
];

const MASK_PATTERNS = [
  new RegExp('\\b(?:' + ARTIFACT_PREFIXES.join('|') + ')-\\d+\\b', 'g'), // BR-010, SC-005
  /\b\d{4}-\d{2}-\d{2}\b/g,                                             // 2026-05-10
  /§[ \t]*\d+/g,                                                        // §7, § 12
  /(?<![\p{L}\p{N}_])(?:шаг|step)[ \t]*\d+/giu,                         // шаг 3 / step 2
  /\bv\d+(?:\.\d+)*\b/gi,                                               // v1.2
];

/**
 * Replace non-constant numeric tokens with `#` of the SAME length, so character
 * offsets still address the original line (raw fragments stay verbatim).
 */
function maskNonConstants(line) {
  let out = String(line);
  for (const re of MASK_PATTERNS) out = out.replace(re, (m) => '#'.repeat(m.length));
  return out;
}

// ---------- grammars ----------

const NUMBER = '\\d+(?:[.,]\\d+)?';
const NUMBER_RE = new RegExp(NUMBER, 'g');

// Conservative unit vocabulary. Longest alternatives first; `s`/`h`/`ч` last so a
// longer unit always wins. The trailing lookahead forbids matching a letter that is
// merely the START of a longer word (`180 минимум` must NOT read as `180 мин`).
const UNIT_ALT =
  'минут(?:а|ы)?|мин|час(?:а|ов)?|сек(?:унд(?:а|ы))?|мс|ms|min(?:ute)?s?|' +
  'sec(?:ond)?s?|hour(?:s)?|дн(?:я|ей)?|day(?:s)?|MB|GB|KB|TB|МБ|ГБ|КБ|%|шт|ч|h|s';
const UNIT_TAIL = '(?![\\p{L}\\p{N}_])';

const SLASH_RE = new RegExp(NUMBER + '(?:[ \\t]*\\/[ \\t]*' + NUMBER + ')+', 'g');
const UNIT_RE = new RegExp('(?<![\\d.,])(' + NUMBER + ')[ \\t]*(' + UNIT_ALT + ')' + UNIT_TAIL, 'giu');
const UNIT_ONLY_RE = new RegExp('^[ \\t]*(' + NUMBER + ')[ \\t]*(' + UNIT_ALT + ')' + UNIT_TAIL + '[ \\t]*\\.?[ \\t]*$', 'iu');
const PREDICATE_RE = new RegExp('(>=|<=|==|≥|≤|>|<)[ \\t]*(' + NUMBER + ')', 'g');

// `name: value` / `name = value`, tolerating a leading list bullet and markdown
// bold (`- **retry_backoff:** 15/30/60`). Name is ASCII by grammar (see LIMITATIONS).
const PARAM_RE = /^[ \t]*(?:[-*+][ \t]+)?\*{0,2}([A-Za-z_][A-Za-z0-9_ .-]{0,40}?)\*{0,2}[ \t]*([:=])\*{0,2}[ \t]*(.+)$/;

// Frontmatter-like keys: metadata, never business constants (per pack-2.1 contract).
const EXCLUDED_NAME_RE =
  /^(status|type|id|category|owner_feature|confidence|created|updated|version|scenarios|invariants|lifecycles|title)$/i;

// Handoff BLOCK LABELS. `**Statement:** … 180 мин …` is a structural marker, not a
// parameter named "Statement": swallowing the whole sentence into one multi-valued
// "parameter" would hide the individual constants from the unit/predicate scanners.
// Excluded names do NOT abort the line — it falls through to the fragment scanners.
const BLOCK_LABEL_RE =
  /^(statement|context|rationale|severity|detection|actors|preconditions|trigger|steps|postconditions|given|when|then|entity|states|example|note|source|why|what|impact|mitigation|success)$/i;

// ---------- pure extraction ----------

/** Canonical numeric string: `1,5` → `1.5`, `030` → `30`. Non-numeric passes through. */
function canonNumber(x) {
  const s = String(x).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? String(x).trim() : String(n);
}

function clip(s) {
  const t = String(s).trim();
  return t.length > RAW_MAX ? t.slice(0, RAW_MAX) : t;
}

/**
 * Cut a handoff section into ordered BR blocks. A `###`-level heading containing
 * `BR-<digits>` opens a block; text before the first such heading (section preamble)
 * is ignored by design. The heading line itself stays in the block body, so a
 * constant stated in the title is still extractable.
 */
function extractRuleBlocks(sectionText) {
  const lines = normalizeLF(String(sectionText || '')).split('\n');
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const h = /^###+[ \t]+.*?\b(BR-\d+)/.exec(line);
    if (h) {
      if (current) blocks.push({ rule: current.rule, text: current.buf.join('\n').trim() });
      current = { rule: h[1], buf: [line] };
    } else if (current) {
      current.buf.push(line);
    }
  }
  if (current) blocks.push({ rule: current.rule, text: current.buf.join('\n').trim() });
  return blocks;
}

/** Unit suffix of a scalar value (`30 мин` → `мин`), else null. */
function scalarUnit(maskedValue) {
  const m = UNIT_ONLY_RE.exec(String(maskedValue));
  return m ? m[2] : null;
}

/**
 * Numeric constants declared by ONE rule block.
 *
 * Scanning is line-by-line, on the MASKED line, with span-overlap suppression so a
 * single number is never reported twice under two kinds. Priority:
 *   1. parameter    — a `name: value` / `name = value` line CONSUMES THE WHOLE LINE
 *                     (so `retry_backoff: 15/30/60` is ONE constant with three values,
 *                     not a parameter plus a stray slash-list).
 *   2. slash-list   — `15/30/60` schedules (the M16 truncation shape).
 *   3. unit-number  — `180 мин`, `25 MB`.
 *   4. predicate    — `>= 50`, `≤ 100000`.
 * De-duplicated per (rule, raw). Bare numbers are skipped by design (LIMITATION 1).
 */
function extractConstantsFromBlock(rule, blockText) {
  const out = [];
  const seen = new Set();
  const push = (c) => {
    const key = c.rule + '|' + c.raw;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  const lines = normalizeLF(String(blockText || '')).split('\n');
  for (const line of lines) {
    const masked = maskNonConstants(line);
    if (!/\d/.test(masked)) continue;

    // (1) parameter line — whole-line consumption when it fires
    const pm = PARAM_RE.exec(masked);
    if (pm) {
      const name = pm[1].trim();
      const sep = pm[2];
      const value = pm[3].trim();
      const isComparison = sep === '=' && value.startsWith('='); // `x == 5` is a predicate
      const isMeta = EXCLUDED_NAME_RE.test(name) || BLOCK_LABEL_RE.test(name);
      if (!isMeta && !isComparison && /\d/.test(value)) {
        const values = (value.match(NUMBER_RE) || []).map(canonNumber);
        if (values.length) {
          push({
            rule,
            name,
            values,
            unit: scalarUnit(value),
            raw: clip(line),
            kind: 'parameter',
          });
          continue;
        }
      }
    }

    const spans = [];
    const free = (s, e) => !spans.some((sp) => s < sp[1] && sp[0] < e);
    const take = (s, e) => spans.push([s, e]);
    let m;

    // (2) slash-lists — `15/30/60`
    SLASH_RE.lastIndex = 0;
    while ((m = SLASH_RE.exec(masked)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (!free(s, e)) continue;
      take(s, e);
      push({
        rule,
        name: null,
        values: (m[0].match(NUMBER_RE) || []).map(canonNumber),
        unit: null,
        raw: clip(line.slice(s, e)),
        kind: 'slash-list',
      });
    }

    // (3) number + unit — `180 мин`, `25 MB`
    UNIT_RE.lastIndex = 0;
    while ((m = UNIT_RE.exec(masked)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (!free(s, e)) continue;
      take(s, e);
      push({
        rule,
        name: null,
        values: [canonNumber(m[1])],
        unit: m[2],
        raw: clip(line.slice(s, e)),
        kind: 'unit-number',
      });
    }

    // (4) comparison predicates — `>= 50`
    PREDICATE_RE.lastIndex = 0;
    while ((m = PREDICATE_RE.exec(masked)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      if (!free(s, e)) continue;
      take(s, e);
      push({
        rule,
        name: null,
        values: [canonNumber(m[2])],
        unit: null,
        raw: clip(line.slice(s, e)),
        kind: 'predicate',
      });
    }
  }

  return out;
}

/**
 * Ground-truth constants of a whole handoff: every BR block of the requested
 * `## N.` sections (default §6 Business Rules). A requested section that does not
 * exist is skipped silently — absence of §6 is a legitimate handoff shape, not an error.
 */
function extractConstants(rawHandoff, sections) {
  const wanted = Array.isArray(sections) && sections.length ? sections : DEFAULT_SECTIONS;
  const parsed = extractSections(stripFrontmatter(String(rawHandoff || '')));
  const out = [];
  for (const n of wanted) {
    const text = parsed.get(Number(n));
    if (!text) continue;
    for (const block of extractRuleBlocks(text)) {
      out.push(...extractConstantsFromBlock(block.rule, block.text));
    }
  }
  return out;
}

// ---------- claim reconciliation ----------

function normName(n) {
  if (n === null || n === undefined) return null;
  const s = String(n).trim().toLowerCase().replace(/\s+/g, '_');
  return s === '' ? null : s;
}

function normRaw(r) {
  if (r === null || r === undefined) return null;
  const s = String(r).trim().toLowerCase().replace(/\s+/g, ' ');
  return s === '' ? null : s;
}

/** Claim values may arrive as a scalar or an array, as numbers or as strings. */
function toValues(v) {
  if (Array.isArray(v)) return v.map(canonNumber);
  if (v === null || v === undefined) return [];
  return [canonNumber(v)];
}

function numEq(a, b) {
  const na = parseFloat(String(a).replace(',', '.'));
  const nb = parseFloat(String(b).replace(',', '.'));
  if (Number.isNaN(na) || Number.isNaN(nb)) return String(a).trim() === String(b).trim();
  return na === nb;
}

/** Same arity AND pairwise numeric equality. `[15,30]` vs `[15,30,60]` → false (M16). */
function valuesEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => numEq(v, b[i]));
}

/**
 * Diff CODE claims against the ground-truth constants of the handoff.
 *
 * A claim is `{ rule, name?, raw?, values (array|scalar), where? }` — `where` being
 * the code coordinate (file:line) reported back verbatim.
 *
 * MATCHING (deterministic, order-stable — no scoring, no fuzz):
 *   candidates = not-yet-matched source constants OF THE SAME RULE, in source order.
 *   Tried in strict priority, first hit in source order wins:
 *     (1) name equality after normalisation (trim / lowercase / spaces → `_`);
 *     (2) raw containment — either fragment contains the other (whitespace-folded,
 *         case-insensitive). Heuristic by construction: a claim raw `80 мин` could
 *         attach to a source `180 мин`; names or exact values disambiguate when given;
 *     (3) exact values equality.
 *   Each source constant can be consumed by at most one claim (no double-counting).
 *
 * OUTCOMES:
 *   fabricated  — claim cites a rule that declares no constants at all → FAILS the gate
 *                 (LIMITATION 3; the M16 "as the client said it" shape).
 *   extraneous  — claim of a valid rule that matched nothing. REPORTED, does NOT fail:
 *                 code legitimately holds constants the BR never fixed.
 *   mismatched  — matched pair whose values differ → FAILS (the M16 15/30/60 → 15/30 shape).
 *   missing     — source constant no claim covered → FAILS (the M16 180-min-cap shape).
 *
 * Values are compared IN SPEC UNITS — see "DIVISION OF LABOUR" in the file header.
 */
function computeConstantsCheck(sourceConstants, claims) {
  const source = (sourceConstants || []).map((c, i) => ({ i, c }));
  const ruleUniverse = new Set(source.map((s) => s.c.rule));
  const used = new Set();

  const matched = [];
  const mismatched = [];
  const fabricated = [];
  const extraneous = [];

  for (const incoming of claims || []) {
    const claim = {
      rule: incoming.rule,
      name: incoming.name === undefined ? null : incoming.name,
      raw: incoming.raw === undefined ? null : incoming.raw,
      values: toValues(incoming.values),
      where: incoming.where === undefined ? null : incoming.where,
    };

    if (!ruleUniverse.has(claim.rule)) {
      fabricated.push(claim);
      continue;
    }

    const candidates = source.filter((s) => s.c.rule === claim.rule && !used.has(s.i));
    let hit = null;

    const cn = normName(claim.name);
    if (cn) hit = candidates.find((s) => normName(s.c.name) === cn) || null;

    if (!hit) {
      const cr = normRaw(claim.raw);
      if (cr) {
        hit = candidates.find((s) => {
          const sr = normRaw(s.c.raw);
          return sr !== null && (sr.includes(cr) || cr.includes(sr));
        }) || null;
      }
    }

    if (!hit) hit = candidates.find((s) => valuesEqual(s.c.values, claim.values)) || null;

    if (!hit) {
      extraneous.push(claim);
      continue;
    }

    used.add(hit.i);
    const pair = {
      rule: claim.rule,
      name: hit.c.name,
      raw: hit.c.raw,
      expected: hit.c.values,
      found: claim.values,
      where: claim.where,
    };
    if (valuesEqual(hit.c.values, claim.values)) matched.push(pair);
    else mismatched.push(pair);
  }

  const missing = source.filter((s) => !used.has(s.i)).map((s) => s.c);

  return {
    schema_version: BR_CONSTANTS_SCHEMA_VERSION,
    constants_total: source.length,
    matched,
    missing,
    mismatched,
    fabricated,
    extraneous,
    passed: missing.length === 0 && mismatched.length === 0 && fabricated.length === 0,
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { handoff: null, claims: null, sections: [], help: false, badSection: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--handoff') args.handoff = argv[++i];
    else if (a === '--claims') args.claims = argv[++i];
    else if (a === '--section') {
      const n = parseInt(argv[++i], 10);
      if (Number.isNaN(n)) args.badSection = true;
      else args.sections.push(n);
    } else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.handoff && !a.startsWith('--')) args.handoff = a;
  }
  return args;
}

function printHelp() {
  console.log(`br-constants-oracle.cjs — deterministic CODE ↔ BR numeric-constant oracle (pack 2.1)

Usage:
  node br-constants-oracle.cjs --handoff <handoff.md> [--section 6 ...]
      extract mode: print the numeric constants the Business Rules declare.

  node br-constants-oracle.cjs --handoff <handoff.md> --claims <claims.json>
      check mode: diff the CODE constants (claims) against that ground truth.

Claims JSON: an array (or { "claims": [...] }) of
  { "rule": "BR-002", "name": "retry_backoff", "raw": "15/30/60",
    "values": [15, 30, 60], "where": "src/scheduler.ts:42" }
  Values are compared IN SPEC UNITS — converting code units (1800 s → 30 мин) is
  the claiming agent's job, not the oracle's.

Exit codes:
  0  extract mode ran OK, or check mode passed
  1  check mode: missing / mismatched / fabricated constants
  2  usage / read error / malformed claims JSON

Schema: br_constants_schema_version ${BR_CONSTANTS_SCHEMA_VERSION}
`);
}

function readOrDie(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    console.error(`ERROR: cannot read ${p}: ${e.message}`);
    process.exit(2);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (args.badSection) {
    console.error('ERROR: --section expects an integer section number (e.g. --section 6)');
    process.exit(2);
  }
  if (!args.handoff) {
    console.error('ERROR: --handoff <handoff.md> is required');
    printHelp();
    process.exit(2);
  }

  const sections = args.sections.length ? args.sections : DEFAULT_SECTIONS;
  const constants = extractConstants(readOrDie(args.handoff), sections);
  const mode = args.claims ? 'check' : 'extract';

  const output = {
    br_constants_schema_version: BR_CONSTANTS_SCHEMA_VERSION,
    mode,
    handoff_file: path.resolve(args.handoff),
    sections,
    constants,
  };

  let exitCode = 0;

  if (mode === 'check') {
    let claims;
    try {
      const parsed = JSON.parse(readOrDie(args.claims));
      claims = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.claims) ? parsed.claims : null;
      if (!claims) throw new Error('expected a JSON array of claims, or { "claims": [...] }');
    } catch (e) {
      console.error(`ERROR: cannot parse claims ${args.claims}: ${e.message}`);
      process.exit(2);
    }
    const check = computeConstantsCheck(constants, claims);
    output.check = check;
    exitCode = check.passed ? 0 : 1;
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  BR_CONSTANTS_SCHEMA_VERSION,
  DEFAULT_SECTIONS,
  maskNonConstants,
  canonNumber,
  valuesEqual,
  extractRuleBlocks,
  extractConstantsFromBlock,
  extractConstants,
  computeConstantsCheck,
};
