#!/usr/bin/env node
/**
 * design-coverage-oracle.cjs — deterministic design→tasks structural-coverage oracle
 * for the Orchestrator P4 `audit-spec-fidelity` process (DEC-DEV-0095, N+2 queue P4 /
 * T4; work-order dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md).
 *
 * WHY THIS EXISTS (live-run C, FB-LR-05 / FB-019):
 *   `design.FileStructure ⊆ ⋃ tasks.boundary` was a blind spot of ALL existing oracles —
 *   coverage-oracle checks requirement-id→presence, fidelity-oracle checks spec-ref→.product,
 *   RA-10 checks cross-task seams POST-impl. None checks, PRE-impl, that every file/module the
 *   design says to build is owned by SOME task. In the pilot a missing `admin.module.ts`
 *   assembly task shipped a fully-unmounted API: design listed the module, no task built it,
 *   every gate was green. This oracle is the anti-self-report backbone for that axis — it
 *   re-derives the design's file list + scans tasks.md from GROUND TRUTH text (never a subagent
 *   claim); the P4 process then runs a semantic-checker over the candidates (naming/path
 *   variance) + verify-finding-before-act before surfacing a gap.
 *
 * TWO CHECKS:
 *   coverage      — a design File-Structure file whose basename appears NOWHERE in tasks.md
 *                   (no boundary, no task text) → uncovered (the FB-LR-05 unmounted-module gap).
 *   forward-refs  — the cheap T4-lite linter: tasks.md text that defers wiring to a vague
 *                   "(a later task)" / "wired later" with no concrete emitter → a dangling
 *                   forward reference (PARTIAL mitigation — flags a candidate, does not prove
 *                   the emitter is absent; the semantic-checker decides).
 *
 * CONSERVATIVE BY DESIGN: lenient toward "covered" (basename match anywhere in tasks.md, and a
 *   too-generic basename ≤3 chars is skipped) so the deterministic layer surfaces only STRONG
 *   gap candidates; the P4 semantic-checker + verify-finding-before-act filter the rest. Never
 *   auto-edits anything — it only reports.
 *
 * EXIT CODES: 0 ran ok, no uncovered files · 1 ran ok, ≥1 uncovered design file · 2 usage/read.
 * Dual-use: `require()` for the pure extractors (unit-tested); run as a CLI for the gate.
 *
 * Node stdlib only; cross-platform LF-normalized I/O.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DESIGN_COVERAGE_SCHEMA_VERSION = 1;

// file extensions that mark a line as a real code/asset file (not a prose path or a directory)
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|cs|kt|swift|scala|vue|svelte|sql|prisma|proto|graphql|gql|json|ya?ml|toml|sh)$/i;

// headings that open a "file structure" section in design.md
const STRUCTURE_HEADING = /^#{1,6}\s+.*\b(file|project|directory|folder|module|code|source|repo(?:sitory)?)\s+(structure|layout|tree|organi[sz]ation)\b/i;
const STRUCTURE_HEADING_BARE = /^#{1,6}\s+(structure|layout)\s*$/i;

// T4-lite dangling-forward-reference phrases (vague deferral of wiring/assembly)
const FORWARD_REF = /\((?:in\s+)?(?:a\s+)?(?:later|subsequent|future|following|another)\s+task[^)]*\)|\(see\s+task\s+\d|\b(?:wired|mounted|assembled|registered|integrated|hooked\s+up)\s+(?:up\s+)?(?:in\s+a\s+)?later\b|\b(?:will|to)\s+be\s+(?:wired|mounted|assembled|registered|integrated)\b/i;

function normalizeLF(s) {
  return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function basename(p) {
  const x = String(p).replace(/\/+$/, '');
  const i = x.lastIndexOf('/');
  return i === -1 ? x : x.slice(i + 1);
}

/**
 * Pull a file path out of one design-tree line: strip tree glyphs / bullets / backticks /
 * trailing inline comments, take the first token, accept it only if it ends in a code ext.
 * Returns the cleaned path or null (directories, prose, and headings → null).
 */
function extractPathFromLine(raw) {
  let s = String(raw).replace(/[│├└─┌┐┘┤┬┴┼`|]/g, ' ').replace(/^[\s\-*+>]+/, '').trim();
  s = s.replace(/\s+(?:#|\/\/|<!--).*$/, '').trim();      // cut a trailing inline comment
  if (!s) return null;
  const tok = s.split(/\s+/)[0].replace(/[,:;]+$/, '');
  if (!tok || !CODE_EXT.test(tok)) return null;
  return tok.replace(/^\.\//, '');
}

/**
 * Extract the file paths the design says to build, from a File-Structure-ish section.
 * Only files (code ext) are returned — a bare directory cannot be coverage-checked. If the
 * design has no recognizable structure section, returns [] (conservative: no findings).
 */
function extractDesignFiles(designMd) {
  const lines = normalizeLF(designMd).split('\n');
  const files = [];
  const seen = new Set();
  let inSection = false;
  let sectionLevel = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (STRUCTURE_HEADING.test(line) || STRUCTURE_HEADING_BARE.test(line)) {
        inSection = true;
        sectionLevel = h[1].length;
        continue;
      }
      if (inSection && h[1].length <= sectionLevel) inSection = false;   // a sibling/parent heading closes the section
    }
    if (!inSection) continue;
    const p = extractPathFromLine(line);
    if (p && !seen.has(p)) { seen.add(p); files.push({ path: p, line: i + 1 }); }
  }
  return files;
}

/**
 * computeCoverage: a design file is COVERED iff its full path OR its (distinctive) basename
 * appears anywhere in tasks.md (a boundary OR task body text). Lenient on purpose — only a file
 * mentioned NOWHERE is flagged, which is the strong FB-LR-05 signal (design says build it, no
 * task touches it). A ≤3-char basename is treated as too generic to match on (skipped → covered
 * only on full-path match) to avoid `index`/`db` style false hits.
 */
function computeCoverage(designFiles, tasksMd) {
  const hay = normalizeLF(tasksMd).toLowerCase();
  const covered = [];
  const uncovered = [];
  for (const f of designFiles) {
    const full = f.path.toLowerCase();
    const base = basename(f.path).toLowerCase();
    const hit = hay.includes(full) || (base.length > 3 && hay.includes(base));
    (hit ? covered : uncovered).push(f);
  }
  return { covered, uncovered };
}

/** T4-lite: lines whose text defers wiring to a vague later task (dangling forward reference). */
function extractForwardRefs(tasksMd) {
  const lines = normalizeLF(tasksMd).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(FORWARD_REF);
    if (m) out.push({ line: i + 1, phrase: m[0], text: lines[i].trim().slice(0, 200) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { design: null, tasks: null, output: null, help: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    if (t === '--design') a.design = rest[(i += 1)];
    else if (t === '--tasks') a.tasks = rest[(i += 1)];
    else if (t === '--output') a.output = rest[(i += 1)];
    else if (t === '--help' || t === '-h') a.help = true;
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'design-coverage-oracle.cjs — design→tasks structural-coverage oracle (Orchestrator P4 / T4)',
    '',
    'Usage: node design-coverage-oracle.cjs --design <design.md> --tasks <tasks.md>',
    '  → JSON { design_files, covered, uncovered_design_files, forward_refs }',
    '  uncovered_design_files = design File-Structure files no task touches (FB-LR-05 unmounted-module).',
    '  forward_refs = T4-lite dangling-forward-reference candidates (PARTIAL — confirm semantically).',
    '',
    'Exit: 0 no uncovered files · 1 ≥1 uncovered file · 2 usage/read error.',
  ].join('\n') + '\n');
}

function readOrDie(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (e) { console.error(`ERROR: cannot read ${p}: ${e.message}`); process.exit(2); }
}

function main() {
  const a = parseArgs(process.argv);
  if (a.help) { printHelp(); process.exit(0); }
  if (!a.design || !a.tasks) { console.error('ERROR: --design <design.md> and --tasks <tasks.md> are both required'); printHelp(); process.exit(2); }

  const designFiles = extractDesignFiles(readOrDie(a.design));
  const tasksMd = readOrDie(a.tasks);
  const { covered, uncovered } = computeCoverage(designFiles, tasksMd);
  const forwardRefs = extractForwardRefs(tasksMd);

  const output = {
    design_coverage_schema_version: DESIGN_COVERAGE_SCHEMA_VERSION,
    design_file: path.resolve(a.design),
    tasks_file: path.resolve(a.tasks),
    design_files: designFiles,
    covered_count: covered.length,
    uncovered_design_files: uncovered,
    forward_refs: forwardRefs,
  };
  const json = JSON.stringify(output, null, 2);
  if (a.output) fs.writeFileSync(a.output, json, 'utf8'); else process.stdout.write(json + '\n');
  process.exit(uncovered.length ? 1 : 0);
}

if (require.main === module) main();

module.exports = {
  DESIGN_COVERAGE_SCHEMA_VERSION,
  CODE_EXT,
  FORWARD_REF,
  normalizeLF,
  basename,
  extractPathFromLine,
  extractDesignFiles,
  computeCoverage,
  extractForwardRefs,
};
