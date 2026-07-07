#!/usr/bin/env node
/**
 * check-counts.js — D7 canonical-count reconciler (DEC-DEV-0083).
 *
 * Closes the worst count-drift blind spot found by the 2026-06-19 D7 process audit:
 * the patch-cut count-sweep covered only SOME docs, so per-command / per-doc counts
 * silently rotted (e.g. verify.md said "23 type files" while canon was 24).
 *
 * GROUND TRUTH (computed, not asserted):
 *   - artifact types = (# of docs/pmo/artifacts/*.md) − 1 (README.md)
 *   - validation rules = SSOT number parsed from docs/pmo/validation.md ("N активных правил")
 *
 * Then scans LIVE docs (docs/, commands/, skills/, root README/ROADMAP/CLAUDE, templates/) for
 * stated counts and flags any that disagree with ground truth. templates/ is included because
 * its files are consumer-zone: they get instantiated verbatim into every new pilot project at
 * bootstrap, so stale counts there are live drift, not history — they must track ground truth,
 * not the project's historical numbers. Historical zones (dev/, _archive, audit-reports,
 * patch-candidates, DEV_JOURNAL, CHANGELOG) are NOT scanned — they legitimately contain old
 * numbers.
 *
 * Usage:
 *   node dev/meta-improvement/scripts/check-counts.js            # human report
 *   node dev/meta-improvement/scripts/check-counts.js --json     # machine-readable
 *
 * Exit: 0 = all consistent · 1 = drift found · 2 = could not establish ground truth.
 *
 * Used standalone, by patch-cut Step 4, and by process-gate.js (commit-msg gate).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function repoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch (e) {
    return process.cwd();
  }
}

const ROOT = repoRoot();
const JSON_MODE = process.argv.includes('--json');

// ─── Ground truth ────────────────────────────────────────────────────────────

function artifactGroundTruth() {
  const dir = path.join(ROOT, 'docs', 'pmo', 'artifacts');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
  return files.length;
}

function rulesGroundTruth() {
  const vp = path.join(ROOT, 'docs', 'pmo', 'validation.md');
  const text = fs.readFileSync(vp, 'utf8');
  const m = text.match(/(\d+)\s*активны[а-яё]*\s*правил/i);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Live-doc scan ───────────────────────────────────────────────────────────

const SCAN_ROOTS = ['README.md', 'ROADMAP.md', 'CLAUDE.md', 'docs', 'commands', 'skills', 'templates'];
const EXCLUDE = /(^|[\\/])(_archive|node_modules|\.git|audit-reports|patch-candidates)([\\/]|$)/;

function walk(rel, acc) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  if (EXCLUDE.test(rel)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const child of fs.readdirSync(abs)) walk(path.join(rel, child), acc);
  } else if (abs.endsWith('.md') || abs.endsWith('.md.template')) {
    acc.push(rel);
  }
}

// Each pattern captures a number in group 1; `kind` says which ground truth to compare to.
const PATTERNS = [
  { kind: 'artifact', re: /(\d+)\s*тип[а-яё]*\s+артефакт/gi },
  { kind: 'artifact', re: /artifacts?\b[^\n]{0,18}?\(\s*(\d+)\s*тип/gi },
  { kind: 'artifact', re: /артефакт[а-яё]*\s*\(\s*(\d+)\s*тип/gi },
  { kind: 'artifact', re: /(\d+)\s*type\s*files?/gi },
  { kind: 'artifact', re: /(\d+)\s*artifact\s*types?/gi },
  { kind: 'rule', re: /(\d+)\s*активны[а-яё]*\s*правил/gi },
  { kind: 'rule', re: /validation\.md[^\n]{0,18}?\(\s*(\d+)\s*правил/gi },
  { kind: 'rule', re: /(\d+)\s*validation\s*rules?/gi },
  { kind: 'rule', re: /\(\s*(\d+)\s*rules?\b/gi },
];

// Lines mentioning a SUBSET of the catalog ("3 типа артефактов D2-B04", "3 типа из
// pmo/artifacts/", "остальными 21 типами") are not the catalog total — skip artifact checks.
// NB: JS \b is ASCII-only — it does NOT bound Cyrillic words. So Cyrillic markers are matched as
// substrings (anchored with surrounding spaces where ambiguous, e.g. " из ").
const SUBSET_GUARD = /производит|остальн|поднабор|слой|\sиз\s|produces|layer|subset|D2-?B?\d/i;

function scan(files, truth) {
  const mismatches = [];
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { kind, re } of PATTERNS) {
        if (kind === 'artifact' && SUBSET_GUARD.test(line)) continue;
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          const found = parseInt(m[1], 10);
          const expected = truth[kind];
          if (expected != null && found !== expected) {
            mismatches.push({
              file: rel.replace(/\\/g, '/'),
              line: i + 1,
              kind,
              found,
              expected,
              text: line.trim().slice(0, 120),
            });
          }
        }
      }
    });
  }
  return mismatches;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const truth = { artifact: artifactGroundTruth(), rule: rulesGroundTruth() };

  if (truth.artifact == null || truth.rule == null) {
    if (JSON_MODE) process.stdout.write(JSON.stringify({ ok: false, error: 'no-ground-truth', truth }));
    else process.stderr.write('check-counts: could not establish ground truth (artifacts dir / validation.md)\n');
    process.exit(2);
  }

  const files = [];
  for (const r of SCAN_ROOTS) walk(r, files);
  const mismatches = scan(files, truth);

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify({ ok: mismatches.length === 0, truth, mismatches }, null, 2));
    process.exit(mismatches.length === 0 ? 0 : 1);
  }

  if (mismatches.length === 0) {
    process.stdout.write(`check-counts: ✓ consistent — ${truth.artifact} artifact types, ${truth.rule} validation rules (ground truth) match all live docs.\n`);
    process.exit(0);
  }

  process.stderr.write(`check-counts: ✗ COUNT DRIFT — ground truth: ${truth.artifact} artifact types, ${truth.rule} validation rules.\n`);
  process.stderr.write(`Stated counts disagreeing with ground truth:\n`);
  for (const m of mismatches) {
    process.stderr.write(`  ${m.file}:${m.line}  [${m.kind}] found ${m.found}, expected ${m.expected}\n      ${m.text}\n`);
  }
  process.stderr.write(`\nFix the stale numbers above (or correct ground truth if it is wrong), then re-run.\n`);
  process.exit(1);
}

main();
