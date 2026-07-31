#!/usr/bin/env node
'use strict';
/**
 * uja-report.cjs — the DETERMINISTIC core of the Orchestrator P8 `user-journey-acceptance`
 * process (DEC-DEV-0225). Three jobs, all facts-about-bytes that MUST NOT be eyeballed by an LLM:
 *
 *   preflight — is the target project EQUIPPED to run browser user-journeys? (Playwright installed?
 *               journeys authored at the convention path? — a Definition-of-Readiness check)
 *   parse     — given a Playwright JSON reporter output, what is the VERDICT?
 *               (PASS | FAIL | ENV_NOT_READY) — a deterministic reduction over the report bytes.
 *   visual    — does the run leave PER-SCREEN evidence for every DESIGNED state of every has_ui
 *               feature in the release scope? (DEC-DEV-0237 — the visual-conformance gate:
 *               COMPLETE | COMPLETE_WITH_SKIPS | INCOMPLETE | N/A over MK Screen Inventory × files)
 *
 * ── WHY A DETERMINISTIC LIB (same lesson as deploy-manifest.cjs / runtime-readiness.cjs) ──────────
 * "Did every journey pass" is a FACT ABOUT BYTES sitting behind an acceptance gate. A stochastic
 * answer is a coin-flip in BOTH directions: a false FAIL blocks a good release, and — the graver
 * one — a false PASS ships a broken first-user-touch (the live precedent: P6/P7/deploy all green,
 * yet the pilot's post-login landed on a 404 because nothing exercised the real journey). So the
 * parse lives in CODE and the harness process is a TRANSPORT: it runs `node uja-report.cjs …` via
 * Bash and relays the JSON verbatim (the harness .mjs may not require() a lib — DEC-DEV-0073 §D.1).
 *
 * ── THE ZERO-EVIDENCE RULE (the load-bearing safety property) ─────────────────────────────────────
 * A report with 0 journeys/tests is NOT a PASS. A gate that goes green on zero evidence is the worst
 * thing this lib can emit (it is exactly the "false DEPLOYED" class one layer over: a green verdict
 * that verified nothing). An empty / unparseable report ⇒ `uja_result: 'ENV_NOT_READY'` — "could not
 * judge" (DoR gap: journeys missing or not discovered), which routes to a re-run, never to `done`.
 *
 * Clock-free and side-effect-free on `parse` (N parses of one report are byte-identical); `preflight`
 * only READS the FS. Exit 0 for any successful read (a broken report/target is DATA: a verdict +
 * reasons); exit 2 on a usage error.
 *
 * Node stdlib only; run with `node orchestrator/lib/uja-report.cjs (preflight|parse) …`.
 */

const fs = require('node:fs');
const path = require('node:path');

// 3 — adds the `visual` subcommand (visual-conformance evidence gate, DEC-DEV-0237).
// 2 — adds negative_present / negative_journeys to preflight (DEC-DEV-0230).
const UJA_REPORT_SCHEMA_VERSION = 3;

// The journey-file convention (DEC-DEV-0225): one *.spec.ts under the journeys dir == one journey.
const JOURNEY_SPEC_RE = /\.spec\.(?:ts|tsx|js|mjs|cjs)$/;
// Negative access journeys (DEC-DEV-0230, package 1): generated from the RPM Access Matrix
// (auth-state × route-class × realm — guest on protected, authed on /login, cross-realm cookie).
// Their ABSENCE is a DoR gap: an acceptance suite of positive-only journeys is exactly the class
// that let the pilot's cross-realm hole (#9) ship behind three green UJA runs.
const NEG_JOURNEY_RE = /^neg-.*\.spec\.(?:ts|tsx|js|mjs|cjs)$/;
const PLAYWRIGHT_CONFIGS = [
  'playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs',
];

// ---------------------------------------------------------------------------
// parse — the verdict reduction over a Playwright JSON report (PURE)
// ---------------------------------------------------------------------------

/**
 * Did this spec pass? Prefer Playwright's own `spec.ok` boolean (authoritative); fall back to the
 * per-test result statuses when it is absent. A spec with NO test results is NOT a pass (a journey
 * that never actually ran must never count as green — the zero-evidence rule at the spec level).
 */
function specPassed(spec) {
  if (spec && typeof spec.ok === 'boolean') return spec.ok;
  const tests = (spec && Array.isArray(spec.tests)) ? spec.tests : [];
  if (!tests.length) return false;
  return tests.every((t) => Array.isArray(t.results) && t.results.length > 0
    && t.results.every((r) => r && (r.status === 'passed' || r.status === 'skipped')));
}

/**
 * Was this spec SKIPPED (every result status 'skipped')? A skip does not fail the verdict, but it
 * must be SURFACED, never silent: the P8 authoring rule (DEC-DEV-0230) is "journeys cover the FULL
 * design-state inventory; a designed-but-unbuilt state is an EXPLICIT skip/ESCALATE" — the pilot's
 * dashboard-library hole (#8) shipped precisely because an unbuilt state was silently absent.
 */
function specSkipped(spec) {
  const tests = (spec && Array.isArray(spec.tests)) ? spec.tests : [];
  if (!tests.length) return false;
  return tests.every((t) => Array.isArray(t.results) && t.results.length > 0
    && t.results.every((r) => r && r.status === 'skipped'));
}

/** Flatten the Playwright suite tree into { file, title, passed } specs. Recurses describe blocks. */
function collectSpecs(suites, inheritedFile, out) {
  if (!Array.isArray(suites)) return;
  for (const s of suites) {
    if (!s || typeof s !== 'object') continue;
    const file = (typeof s.file === 'string' && s.file) ? s.file : inheritedFile;
    for (const spec of (Array.isArray(s.specs) ? s.specs : [])) {
      if (!spec || typeof spec !== 'object') continue;
      const specFile = (typeof spec.file === 'string' && spec.file) ? spec.file : (file || 'unknown');
      out.push({ file: specFile, title: String(spec.title == null ? '' : spec.title), passed: specPassed(spec), skipped: specSkipped(spec) });
    }
    if (Array.isArray(s.suites)) collectSpecs(s.suites, file, out);
  }
}

/** The artifacts (screenshots / trace) dir the report declares — never guessed. */
function extractArtifactsDir(report) {
  const cfg = report && report.config;
  if (cfg && typeof cfg.outputDir === 'string' && cfg.outputDir) return cfg.outputDir;
  const projects = cfg && Array.isArray(cfg.projects) ? cfg.projects : [];
  const proj = projects.find((p) => p && typeof p.outputDir === 'string' && p.outputDir);
  return proj ? proj.outputDir : null;
}

/**
 * Reduce a parsed Playwright JSON report to the P8 verdict. PURE — no FS, no clock.
 * Returns { uja_result, journeys_total, journeys_passed, journeys_failed, artifacts_dir, reasons }.
 *   uja_result ∈ PASS | FAIL | ENV_NOT_READY   (ENV_NOT_READY = empty/unparseable — could-not-judge)
 *   journeys are GROUPED BY FILE — one *.spec.ts is one journey; a journey fails if ANY of its
 *   specs fails (a broken step anywhere breaks the journey).
 */
function parseReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return {
      uja_result: 'ENV_NOT_READY', journeys_total: 0, journeys_passed: 0, journeys_failed: [], specs_skipped: [], artifacts_dir: null,
      reasons: ['no parseable Playwright JSON report — the journey run produced nothing to judge (could-not-judge, NOT a code FAIL): re-run once the report is produced'],
    };
  }
  const specs = [];
  collectSpecs(report.suites, null, specs);

  const byFile = new Map();
  for (const sp of specs) {
    if (!byFile.has(sp.file)) byFile.set(sp.file, []);
    byFile.get(sp.file).push(sp);
  }
  const journeys_total = byFile.size;
  const journeys_failed = [];
  const specs_skipped = [];
  let journeys_passed = 0;
  for (const [file, list] of byFile) {
    const failing = list.filter((s) => !s.passed).map((s) => s.title);
    if (failing.length) journeys_failed.push({ journey: file, failing });
    else journeys_passed += 1;
    const skipped = list.filter((s) => s.skipped).map((s) => s.title);
    if (skipped.length) specs_skipped.push({ journey: file, skipped });
  }
  const artifacts_dir = extractArtifactsDir(report);
  const reasons = [];

  let uja_result;
  if (journeys_total === 0) {
    // THE ZERO-EVIDENCE RULE: no journey was exercised ⇒ this is NOT a PASS.
    uja_result = 'ENV_NOT_READY';
    reasons.push('the Playwright report contains 0 journeys/tests — no user journey was actually exercised. '
      + 'A gate that PASSES on zero evidence is a false green (the "false DEPLOYED" class, one layer up); '
      + 'this is could-not-judge (DoR: journeys missing or not discovered under the journeys dir), NOT a PASS.');
  } else if (journeys_failed.length) {
    uja_result = 'FAIL';
    reasons.push(`${journeys_failed.length} of ${journeys_total} journey(s) FAILED: ${journeys_failed.map((j) => j.journey).join(', ')}`);
  } else {
    uja_result = 'PASS';
    reasons.push(`all ${journeys_total} journey(s) passed`);
  }
  if (specs_skipped.length) {
    // Surface, don't fail: a skip is legitimate ONLY as an explicit designed-but-unbuilt disclosure
    // (DEC-DEV-0230). Silent skips hide exactly the "designed — not built — invisible to acceptance"
    // class (pilot finding #8), so every skip is named in the verdict for the owner to see.
    const n = specs_skipped.reduce((acc, s) => acc + s.skipped.length, 0);
    reasons.push(`${n} spec(s) SKIPPED (${specs_skipped.map((s) => s.journey).join(', ')}) — a skip must be an EXPLICIT designed-but-unbuilt disclosure (ESCALATE), never a silent gap`);
  }
  return { uja_result, journeys_total, journeys_passed, journeys_failed, specs_skipped, artifacts_dir, reasons };
}

/** Read a report file and parse it. A read/JSON error is DATA (ENV_NOT_READY), never a throw. */
function readReport(file, opts) {
  const o = opts || {};
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  let raw;
  try { raw = String(readFile(file)); } catch (e) {
    return {
      uja_result: 'ENV_NOT_READY', journeys_total: 0, journeys_passed: 0, journeys_failed: [], specs_skipped: [], artifacts_dir: null,
      reasons: [`Playwright report not readable at ${file}: ${e.code || e.message} — the journey run left no report (could-not-judge, NOT a FAIL): re-run`],
    };
  }
  let report;
  try { report = JSON.parse(raw); } catch (e) {
    return {
      uja_result: 'ENV_NOT_READY', journeys_total: 0, journeys_passed: 0, journeys_failed: [], specs_skipped: [], artifacts_dir: null,
      reasons: [`Playwright report at ${file} is not valid JSON (${raw.length} bytes): ${e.message} — could-not-judge, NOT a FAIL`],
    };
  }
  return parseReport(report);
}

// ---------------------------------------------------------------------------
// preflight — is the target EQUIPPED to run journeys? (READS the FS)
// ---------------------------------------------------------------------------

/**
 * Definition-of-Readiness for a journey run: Playwright installed + journeys authored at the
 * convention path. A missing piece is a DoR gap the process reports as ENV_NOT_READY with a hint
 * (`/integrator:add playwright`, `author journeys at <dir>/*.spec.ts`) — NEVER a fabricated pass.
 * Returns { playwright_present, journeys_present, journeys, reasons }.
 */
function assessPreflight(opts) {
  const o = opts || {};
  const root = o.root || '.';
  const journeysDir = o.journeysDir || 'tests/uja';
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  const readdir = o.readdir || ((p) => fs.readdirSync(p));
  const exists = o.exists || ((p) => fs.existsSync(p));
  const reasons = [];

  // (1) journeys present at the convention path?
  const jdir = path.join(root, journeysDir);
  let journeys = [];
  if (!exists(jdir)) {
    reasons.push(`journeys dir "${journeysDir}" does not exist under ${root} — there are no journey specs to run. `
      + `DoR: author browser journeys at ${journeysDir}/*.spec.ts (generate the key user flows from the feature's NM / navigation map).`);
  } else {
    let entries = [];
    try { entries = readdir(jdir); } catch (_e) { entries = []; }
    journeys = entries.filter((f) => JOURNEY_SPEC_RE.test(String(f))).map(String).sort();
    if (!journeys.length) {
      reasons.push(`journeys dir "${journeysDir}" exists but carries no *.spec.ts — no journey to run. `
        + `DoR: author browser journeys at ${journeysDir}/*.spec.ts (generate from the feature's NM).`);
    }
  }
  const journeys_present = journeys.length > 0;

  // (1b) NEGATIVE access journeys present? (DEC-DEV-0230, hard DoR leg) — the neg-*.spec.ts
  // convention, generated from the RPM Access Matrix. A positive-only suite is NOT equipped:
  // three green UJA runs on the pilot never exercised "admin cookie on a user route" and the
  // cross-realm hole (#9) shipped. Absence ⇒ a DoR reason (the process gates on it).
  const negative_journeys = journeys.filter((f) => NEG_JOURNEY_RE.test(String(f)));
  const negative_present = negative_journeys.length > 0;
  if (journeys_present && !negative_present) {
    reasons.push(`journeys dir "${journeysDir}" carries no NEGATIVE access journey (neg-*.spec.ts) — the suite is positive-only. `
      + `DoR: author negative access journeys at ${journeysDir}/neg-*.spec.ts from the RPM Access Matrix rows `
      + `(guest → protected routes; authenticated → /login, /signup; cross-realm: a realm-A session on realm-B routes, both directions).`);
  }

  // (2) Playwright equipped? — a dep in package.json OR a playwright.config.* on disk.
  let pkg = null;
  try { pkg = JSON.parse(String(readFile(path.join(root, 'package.json')))); } catch (_e) { pkg = null; }
  const deps = pkg ? Object.assign({}, pkg.dependencies, pkg.devDependencies) : {};
  const hasDep = !!(deps && (deps['@playwright/test'] || deps.playwright));
  const hasConfig = PLAYWRIGHT_CONFIGS.some((c) => exists(path.join(root, c)));
  const playwright_present = hasDep || hasConfig;
  if (!playwright_present) {
    reasons.push('Playwright (@playwright/test) is not installed in the target project '
      + '(no dep in package.json, no playwright.config.*). DoR: `/integrator:add playwright`.');
  }

  return { playwright_present, journeys_present, journeys, negative_present, negative_journeys, reasons };
}

// ---------------------------------------------------------------------------
// visual — is every DESIGNED screen state covered by run evidence? (READS the FS)
// ---------------------------------------------------------------------------
//
// WHY (DEC-DEV-0237, meta-feedback #5): the P8 run already captures screenshots, and RL DoD
// категория 5 already calls them "visual-conformance evidence" — but NOTHING checked that the
// evidence actually COVERS the designed states. So a has_ui feature could ship with three green
// journeys and zero screenshots of half its screens: the "designed — not built — invisible to
// acceptance" class (pilot finding #8) one layer up, at the pixel level. This leg is the missing
// GATE: MK Screen Inventory (what was DESIGNED) × files under <artifacts>/visual/<MK>/ (what the
// run actually SAW). Deterministic — a file either exists or it does not.
//
// It does NOT compare pixels to the mockup (an automatic MK-diff is v1.1). It answers the strictly
// weaker, strictly checkable question: "is there a captured state for every designed state, or an
// EXPLICIT declared skip?" — the same surface-don't-fail discipline as specs_skipped above.

// A screenshot file for SI-<n>: `SI-3.png`, `SI-3.jpg`, `SI-3-empty-state.webp`. The SI prefix must
// end on a DIGIT BOUNDARY — the match is `^SI-1(?![0-9])`, so `SI-1` is never satisfied by
// `SI-10.png` (the off-by-nine false green this guards). It is NOT a word boundary: `SI-1x.png`
// DOES match, being read as `SI-1` + the suffix-slug `x` — which is the intended latitude
// (`SI-3-empty-state.png`), just without a required separator.
const VISUAL_EVIDENCE_EXT_RE = /\.(?:png|jpe?g|webp)$/i;
// A Screen Inventory row: the SI id sits in the FIRST table column (docs/pmo/artifacts/MK.md
// §Screen Inventory формат: `| SI-1 | Inbox (list) | screen | SC-005/6 | … |`).
const SI_ROW_RE = /^\s*\|\s*(SI-\d+)\s*\|/;
// …but ONLY inside the Screen Inventory SECTION. The MK template numbers its headings
// (`## 1. Screen Inventory`), and other sections legitimately cite SI ids in tables of their own
// (Component State Matrix, Interaction Spec, Edge Cases). Scanning the whole document therefore
// INFLATED the inventory with ids that were never designed screens, and every inflated id was an
// SI with no screenshot ⇒ a false INCOMPLETE that blocks a release for a citation.
const SI_SECTION_RE = /^(#{2,3})\s+.*Screen\s+Inventory/i;
const MD_HEADING_RE = /^(#{1,6})\s+/;
const VISUAL_SKIPS_FILE = 'visual-skips.json';

/* ── EOL-tolerant frontmatter parse ────────────────────────────────────────────────────────────
 * PORTED from hooks/product/lib/impl-evidence.cjs (`frontmatterBlock` / `parseFm` / `fmList`,
 * ~lines 94-143) — THAT file is the first-source of the convention; this is a stdlib-only copy
 * because uja-report.cjs runs via Bash inside a TARGET project checkout (no js-yaml, no reaching
 * into hooks/). Keep the two in sync if the frontmatter convention changes.
 * CRLF lesson (DEC-DEV-0190): the fence regex accepts `\r?\n` and every split is `/\r?\n/` — never
 * `.` before `$` to capture a value (that leaves a trailing `\r` on CRLF checkouts).
 */
function frontmatterBlock(raw) {
  const m = String(raw == null ? '' : raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}
function stripQuotes(s) { return String(s).replace(/^["']|["']$/g, ''); }
/** Trailing `# comment` off a frontmatter value. NARROW: only applied to the 3 fields read here. */
function stripComment(s) { return String(s == null ? '' : s).replace(/\s+#.*$/, ''); }
/** Flat scalar frontmatter parse (first block). Tolerant, never throws. */
function parseFm(raw) {
  const out = {};
  for (const line of frontmatterBlock(raw).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
/** List-valued frontmatter field: inline flow (`key: [A, B]`) or block form (`key:` + `- A`). */
function fmList(block, key) {
  const lines = String(block).split(/\r?\n/);
  const head = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':[ \\t]*(.*)$');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(head);
    if (!m) continue;
    const inline = stripComment(m[1]).trim();
    if (inline && inline !== '[]') {
      return inline.replace(/^\[/, '').replace(/\]$/, '')
        .split(',').map((s) => stripQuotes(s.trim())).filter(Boolean);
    }
    const items = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const li = lines[j].match(/^\s+-\s+(.*)$/);
      if (li) { items.push(stripQuotes(stripComment(li[1]).trim())); continue; }
      if (/^\s*$/.test(lines[j])) continue;
      break; // next top-level key (or anything that is not a list item)
    }
    return items.filter(Boolean);
  }
  return [];
}

/**
 * Screen Inventory ids of an MK body, in document order, de-duplicated — SCOPED TO THE SECTION.
 *
 * The scan starts after the `## … Screen Inventory` heading and stops at the next heading of the
 * SAME OR HIGHER level, so an `| SI-9 |` row in a later section (a Component State Matrix row, an
 * Edge Case table) is NOT part of the designed inventory. Reading the whole document made any such
 * citation a phantom designed state that no screenshot could ever cover ⇒ a permanent INCOMPLETE.
 *
 * No section heading ⇒ `[]`, which the caller reports as "no parseable Screen Inventory rows" and
 * treats as BLIND ⇒ INCOMPLETE. That is deliberate and unchanged in direction: a gate that cannot
 * find the designed inventory has not judged it, and blind must never read as conformant.
 */
function screenInventoryIds(raw) {
  const lines = String(raw == null ? '' : raw).split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(SI_SECTION_RE);
    if (m) { start = i + 1; level = m[1].length; break; }
  }
  if (start < 0) return [];
  const seen = new Set();
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const h = lines[i].match(MD_HEADING_RE);
    if (h && h[1].length <= level) break;   // the section ended — everything below is another topic
    const m = lines[i].match(SI_ROW_RE);
    if (m && !seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

/**
 * The visual-conformance evidence gate (DEC-DEV-0237). PURE w.r.t. injection: readFile/readdir/exists
 * are injectable exactly like assessPreflight, so the whole matrix is unit-testable without a temp FS.
 *
 * Reads (and NOTHING else — it never writes, never runs a browser):
 *   <productDir>/features/FM-*.md   → frontmatter `id`, `has_ui`, `mockups[]`   (which features have UI)
 *   <productDir>/mockups/MK-*.md    → frontmatter `status` + the Screen Inventory rows (what was DESIGNED)
 *   <artifactsDir>/visual/<MK>/*    → .png/.jpg/.jpeg/.webp named `SI-<n>*`     (what the run actually SAW)
 *   <journeysDir>/visual-skips.json → [{ mk, si, reason }]                       (designed-but-unbuilt, DECLARED)
 *
 * Returns { visual_evidence, mk_scope[], reasons[] } where visual_evidence ∈
 *   N/A                  — no has_ui feature in scope (said EXPLICITLY in reasons, never silent)
 *   COMPLETE             — every SI of every active MK of every has_ui feature has ≥1 evidence file
 *   COMPLETE_WITH_SKIPS  — the holes are closed by VALID declared skips (all named in reasons)
 *   INCOMPLETE           — an SI with neither a file nor a valid skip, OR the gate went BLIND
 *                          (missing FM/MK, empty mockups[], no parseable Screen Inventory). Blind is
 *                          NOT green: "could not judge" must never read as "conformant" — that is the
 *                          zero-evidence rule (see parseReport) applied to pixels.
 */
function assessVisualEvidence(opts) {
  const o = opts || {};
  const root = o.root || '.';
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));
  const readdir = o.readdir || ((p) => fs.readdirSync(p));
  const exists = o.exists || ((p) => fs.existsSync(p));
  const under = (p) => (path.isAbsolute(p) ? p : path.join(root, p));
  const productDir = under(o.productDir || '.product');
  const artifactsDir = under(o.artifactsDir || 'test-results');
  const journeysDir = under(o.journeysDir || 'tests/uja');
  const features = (Array.isArray(o.features) ? o.features : String(o.features == null ? '' : o.features).split(','))
    .map((f) => String(f).trim()).filter(Boolean);

  const readSafe = (p) => { try { return String(readFile(p)); } catch (_e) { return null; } };
  const listSafe = (p) => { try { const l = readdir(p); return Array.isArray(l) ? l.map(String) : []; } catch (_e) { return []; } };
  /**
   * A listing entry is a NAME, not a promise that it is a FILE. `mkdir <evidence>/SI-1.png` matched
   * the coverage regex and turned an EMPTY DIRECTORY into "evidence for SI-1" — a false green built
   * out of nothing, which is precisely what this gate exists to prevent.
   *
   * `isFile` is injectable exactly like readFile/readdir/exists. The DEFAULT stats the real FS; when
   * the stat cannot answer at all it TRUSTS the listing (returns true) instead of filtering
   * everything away — that is the injected-virtual-FS case, where no path exists on disk and a
   * strict default would silently empty every listing. Under a real FS the stat always answers, so
   * a directory is excluded; under an injected FS the caller supplies its own `isFile`.
   */
  const isFile = o.isFile || ((p) => { try { return fs.statSync(p).isFile(); } catch (_e) { return true; } });
  const listFilesSafe = (p) => listSafe(p).filter((f) => isFile(path.join(p, f)));
  const fileById = (dir, id) => {
    const hit = listFilesSafe(dir).find((f) => f === `${id}.md` || f.startsWith(`${id}-`));
    return hit ? path.join(dir, hit) : null;
  };
  // display path: root-relative, forward slashes — the reasons are read by humans AND pasted as hints
  const rel = (p) => {
    const r = path.relative(root, p);
    return (r && !r.startsWith('..') ? r : p).split(path.sep).join('/');
  };

  const featuresDir = path.join(productDir, 'features');
  const mockupsDir = path.join(productDir, 'mockups');
  const visualRoot = path.join(artifactsDir, 'visual');
  const skipsFile = path.join(journeysDir, VISUAL_SKIPS_FILE);

  const reasons = [];
  const mk_scope = [];
  let blind = false;   // could-not-judge — forces INCOMPLETE, never a silent green

  // (1) which of the judged features carry UI at all?
  const uiFeatures = [];
  for (const fmId of features) {
    const file = fileById(featuresDir, fmId);
    const raw = file ? readSafe(file) : null;
    if (raw == null) {
      blind = true;
      reasons.push(`${fmId}: no readable FM under ${rel(featuresDir)}/ — has_ui is UNKNOWN, so the visual scope cannot be established (could-not-judge, NOT conformant).`);
      continue;
    }
    const flat = parseFm(raw);
    if (!/^(?:true|yes)$/i.test(stripQuotes(stripComment(flat.has_ui)).trim())) continue;
    uiFeatures.push({ id: stripQuotes(stripComment(flat.id)).trim() || fmId, mockups: fmList(frontmatterBlock(raw), 'mockups') });
  }

  if (!uiFeatures.length && !blind) {
    reasons.push(features.length
      ? `none of the ${features.length} feature(s) in scope (${features.join(', ')}) declares has_ui: true — there is no designed UI for run evidence to conform to. Visual conformance is N/A here (an explicit "nothing to judge", NOT a pass-by-default).`
      : 'no features supplied (--features) — there is no release scope to resolve has_ui against, so no visual scope could be built. N/A here; a caller that MUST know the scope (a DoD confirmation run) has to pass features[].');
    return { visual_evidence: 'N/A', mk_scope, reasons };
  }

  // (2) declared designed-but-unbuilt states (surface, don't fail — but ONLY when reasoned)
  let skips = [];
  const skipsRaw = exists(skipsFile) ? readSafe(skipsFile) : null;
  if (skipsRaw != null) {
    let parsed = null;
    try { parsed = JSON.parse(skipsRaw); } catch (e) {
      reasons.push(`${rel(skipsFile)} is not valid JSON (${e.message}) — ignored. A designed-but-unbuilt state must be declared in a PARSEABLE skips file; an unreadable one reads as silence.`);
    }
    if (parsed != null) {
      if (Array.isArray(parsed)) skips = parsed.filter((s) => s && typeof s === 'object');
      else reasons.push(`${rel(skipsFile)} is not a JSON array of { mk, si, reason } — ignored.`);
    }
  }
  const skipKey = (mk, si) => `${mk} ${si}`;
  const usedSkips = new Set();
  const findSkip = (mk, si) => skips.find((s) => String(s.mk == null ? '' : s.mk).trim() === mk
    && String(s.si == null ? '' : s.si).trim() === si);

  if (!exists(visualRoot)) {
    reasons.push(`${rel(visualRoot)}/ does not exist — the run captured NO per-screen visual evidence at all. Zero evidence is not a green (the zero-evidence rule at the pixel level): every designed state below counts as missing.`);
  }

  // (3) the matrix: designed states × captured files
  for (const fm of uiFeatures) {
    if (!fm.mockups.length) {
      blind = true;
      reasons.push(`${fm.id}: has_ui: true but mockups[] is EMPTY — a DESIGN gap (the V-MK chain owns fixing it), and for this gate it means the visual scope is unknown: there is nothing to hold the screenshots against. Judging nothing ⇒ INCOMPLETE, because staying silent here is exactly how an unbuilt screen ships.`);
      continue;
    }
    let activeMks = 0;
    for (const mkId of fm.mockups) {
      const mkFile = fileById(mockupsDir, mkId);
      const raw = mkFile ? readSafe(mkFile) : null;
      if (raw == null) {
        blind = true;
        reasons.push(`${fm.id} → ${mkId}: no readable MK under ${rel(mockupsDir)}/ — the designed screen inventory is unavailable (could-not-judge, NOT conformant).`);
        continue;
      }
      const status = stripQuotes(stripComment(parseFm(raw).status)).trim().toLowerCase();
      if (status !== 'active') {
        // MK.md lifecycle: draft → review → active → deprecated. Only `active` is a design CONTRACT;
        // a draft is still moving, so holding an implementation against it would be noise.
        reasons.push(`${fm.id} → ${mkId}: status='${status || '(none)'}' — only an ACTIVE MK is a design contract (MK.md lifecycle), so it is OUT of the visual scope.`);
        continue;
      }
      activeMks += 1;
      const sis = screenInventoryIds(raw);
      const evidenceDir = path.join(visualRoot, mkId);
      const files = listFilesSafe(evidenceDir).filter((f) => VISUAL_EVIDENCE_EXT_RE.test(f));
      if (!sis.length) {
        blind = true;
        reasons.push(`${mkId}: no parseable Screen Inventory rows (expected \`| SI-<n> | … |\` rows UNDER a \`## … Screen Inventory\` heading, per docs/pmo/artifacts/MK.md §Screen Inventory — rows are read inside that section only, so a missing or renamed heading reads as no inventory) — the gate went BLIND on this MK. Blind ≠ pass, and blind ≠ silence: fix the MK table.`);
        mk_scope.push({ mk: mkId, feature: fm.id, si_total: 0, si_covered: [], si_missing: [], si_skipped: [], evidence_dir: rel(evidenceDir) });
        continue;
      }
      const si_covered = [];
      const si_missing = [];
      const si_skipped = [];
      for (const si of sis) {
        // DIGIT-boundary prefix match: SI-1 is NOT satisfied by SI-10-foo.png (a suffix slug is
        // fine — SI-1-empty.png and even SI-1x.png read as SI-1 + slug; only a DIGIT may not follow)
        const hit = new RegExp(`^${si}(?![0-9])`, 'i');
        if (files.some((f) => hit.test(f))) { si_covered.push(si); continue; }
        const sk = findSkip(mkId, si);
        if (sk) {
          usedSkips.add(skipKey(mkId, si));
          if (typeof sk.reason === 'string' && sk.reason.trim()) { si_skipped.push({ si, reason: sk.reason.trim() }); continue; }
          reasons.push(`${mkId} ${si}: a visual-skip entry exists but carries NO reason — an unreasoned skip is silence with extra steps and does NOT close the gap (a skip must be an EXPLICIT designed-but-unbuilt disclosure).`);
        }
        si_missing.push(si);
      }
      mk_scope.push({ mk: mkId, feature: fm.id, si_total: sis.length, si_covered, si_missing, si_skipped, evidence_dir: rel(evidenceDir) });
      if (si_missing.length) {
        reasons.push(`${mkId} (${fm.id}): ${si_missing.length}/${sis.length} designed screen state(s) have NO visual evidence — expected ${si_missing.map((si) => `${rel(evidenceDir)}/${si}.png`).join(', ')} (.jpg/.jpeg/.webp also count, and a suffix is fine: ${si_missing[0]}-<slug>.png). Capture the state in the journey, or declare it designed-but-unbuilt in ${rel(skipsFile)} as { "mk": "${mkId}", "si": "${si_missing[0]}", "reason": "…" }.`);
      }
      if (si_skipped.length) {
        reasons.push(`${mkId} (${fm.id}): ${si_skipped.length} designed state(s) DECLARED skipped — ${si_skipped.map((s) => `${s.si}: ${s.reason}`).join(' | ')}. Surfaced, never silent: each one is a designed-but-unbuilt state the owner must see (pilot finding #8).`);
      }
    }
    if (!activeMks) {
      blind = true;
      reasons.push(`${fm.id}: none of its mockups (${fm.mockups.join(', ')}) resolved to an ACTIVE MK — the visual scope of a has_ui feature is unknown. Judging nothing ⇒ INCOMPLETE.`);
    }
  }

  // (4) stale skips: declared for something outside the judged scope — surfaced, not fatal
  for (const s of skips) {
    const mk = String(s.mk == null ? '' : s.mk).trim();
    const si = String(s.si == null ? '' : s.si).trim();
    if (!usedSkips.has(skipKey(mk, si))) {
      reasons.push(`${rel(skipsFile)} declares a skip for ${mk || '(no mk)'} ${si || '(no si)'} that is NOT in the judged visual scope (no such SI in an active MK of these features) — surfaced: a stale skip covers nothing, and must not be mistaken for coverage.`);
    }
  }

  const anyMissing = mk_scope.some((m) => m.si_missing.length > 0);
  const anySkipped = mk_scope.some((m) => m.si_skipped.length > 0);
  let visual_evidence;
  if (blind || anyMissing) visual_evidence = 'INCOMPLETE';
  else if (anySkipped) visual_evidence = 'COMPLETE_WITH_SKIPS';
  else visual_evidence = 'COMPLETE';

  if (visual_evidence === 'COMPLETE' || visual_evidence === 'COMPLETE_WITH_SKIPS') {
    const total = mk_scope.reduce((n, m) => n + m.si_total, 0);
    const covered = mk_scope.reduce((n, m) => n + m.si_covered.length, 0);
    reasons.push(`${covered}/${total} designed screen state(s) across ${mk_scope.length} active MK(s) carry visual evidence under ${rel(visualRoot)}/`
      + (anySkipped ? ' (the rest are EXPLICIT declared skips, listed above).' : '.'));
  }

  return { visual_evidence, mk_scope, reasons };
}

// ---------------------------------------------------------------------------
// CLI (FS + argv live here only)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--help' || t === '-h') a.help = true;
    else if (t.startsWith('--')) {
      const key = t.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { a[key] = next; i += 1; } else a[key] = true;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'uja-report.cjs — deterministic core of the P8 user-journey-acceptance process (DEC-DEV-0225).',
    '',
    'PREFLIGHT:  node uja-report.cjs preflight [--root <dir>] [--journeys-dir <dir=tests/uja>]',
    '  → JSON { playwright_present, journeys_present, journeys[], negative_present, negative_journeys[], reasons[] }',
    '    A DoR check: is Playwright installed + are journeys authored at <journeys-dir>/*.spec.ts',
    '    + are NEGATIVE access journeys authored at <journeys-dir>/neg-*.spec.ts (from the RPM Access Matrix)?',
    '',
    'PARSE:      node uja-report.cjs parse --report <playwright-json-report>',
    '  → JSON { uja_result, journeys_total, journeys_passed, journeys_failed[], specs_skipped[], artifacts_dir, reasons[] }',
    '    uja_result  PASS | FAIL | ENV_NOT_READY. One *.spec.ts == one journey; a journey fails if',
    '                ANY of its specs fails. A report with 0 journeys is ENV_NOT_READY (could-not-judge),',
    '                NEVER a PASS — a gate that goes green on zero evidence is a false green.',
    '',
    'VISUAL:     node uja-report.cjs visual --root <dir> --features FM-001,FM-002 --artifacts-dir <dir>',
    '                                       [--product-dir .product] [--journeys-dir tests/uja]',
    '  → JSON { visual_evidence, mk_scope[], reasons[] }   (DEC-DEV-0237)',
    '    visual_evidence  COMPLETE | COMPLETE_WITH_SKIPS | INCOMPLETE | N/A. Does the run leave a',
    '                     screenshot for EVERY designed state (MK Screen Inventory `SI-<n>`) of every',
    '                     has_ui feature in scope, under <artifacts-dir>/visual/<MK-id>/SI-<n>.png?',
    '                     A designed-but-unbuilt state must be DECLARED in <journeys-dir>/visual-skips.json',
    '                     ([{ mk, si, reason }] — a skip with no reason does not count). Missing FM/MK,',
    '                     an empty mockups[] or an unparseable Screen Inventory ⇒ INCOMPLETE (blind ≠ pass).',
    '                     No has_ui feature in scope ⇒ N/A, said explicitly in reasons.',
    '',
    'Clock-free on parse (N parses of one report are byte-identical). Exit 0 for any successful read',
    '(a broken report/target is DATA: verdict + reasons); exit 2 on a usage error.',
  ].join('\n') + '\n');
}

function main() {
  const sub = process.argv[2];
  const a = parseArgs(process.argv.slice(3));
  if (a.help || sub === '--help' || sub === '-h' || sub === 'help' || !sub) { printHelp(); process.exit(sub ? 0 : 2); }

  if (sub === 'preflight') {
    const out = assessPreflight({
      root: typeof a.root === 'string' ? a.root : '.',
      journeysDir: typeof a.journeysDir === 'string' ? a.journeysDir : 'tests/uja',
    });
    process.stdout.write(JSON.stringify(Object.assign({ uja_report_schema_version: UJA_REPORT_SCHEMA_VERSION }, out), null, 2) + '\n');
    process.exit(0);
  }

  if (sub === 'parse') {
    if (!a.report || a.report === true) {
      process.stderr.write('uja-report: parse needs --report <playwright-json-report>\n');
      process.exit(2);
    }
    const out = readReport(String(a.report));
    process.stdout.write(JSON.stringify(Object.assign({ uja_report_schema_version: UJA_REPORT_SCHEMA_VERSION }, out), null, 2) + '\n');
    process.exit(0);
  }

  if (sub === 'visual') {
    // NOTE: a MISSING --features is not a usage error — it is DATA (an N/A verdict with an explicit
    // reason). The caller that must not tolerate an unknown scope (a DoD confirmation run) gates on
    // that N/A itself; exiting 2 here would only break the transport relay.
    const out = assessVisualEvidence({
      root: typeof a.root === 'string' ? a.root : '.',
      features: typeof a.features === 'string' ? a.features : [],
      artifactsDir: typeof a.artifactsDir === 'string' ? a.artifactsDir : 'test-results',
      productDir: typeof a.productDir === 'string' ? a.productDir : '.product',
      journeysDir: typeof a.journeysDir === 'string' ? a.journeysDir : 'tests/uja',
    });
    process.stdout.write(JSON.stringify(Object.assign({ uja_report_schema_version: UJA_REPORT_SCHEMA_VERSION }, out), null, 2) + '\n');
    process.exit(0);
  }

  printHelp();
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  UJA_REPORT_SCHEMA_VERSION,
  JOURNEY_SPEC_RE,
  NEG_JOURNEY_RE,
  PLAYWRIGHT_CONFIGS,
  VISUAL_EVIDENCE_EXT_RE,
  SI_ROW_RE,
  SI_SECTION_RE,
  VISUAL_SKIPS_FILE,
  screenInventoryIds,
  assessVisualEvidence,
  specPassed,
  specSkipped,
  collectSpecs,
  extractArtifactsDir,
  parseReport,
  readReport,
  assessPreflight,
};
