#!/usr/bin/env node
/**
 * check-counts.js — D7 canonical-count reconciler (DEC-DEV-0083).
 *
 * Closes the worst count-drift blind spot found by the 2026-06-19 D7 process audit:
 * the patch-cut count-sweep covered only SOME docs, so per-command / per-doc counts
 * silently rotted (e.g. verify.md said "23 type files" while canon was 24).
 *
 * GROUND TRUTH (computed, not asserted):
 *   CORE (blocking — shipped 2026-06-19, DEC-DEV-0083):
 *   - artifact types = (# of docs/pmo/artifacts/*.md) − 1 (README.md)
 *   - validation rules = SSOT number parsed from docs/pmo/validation.md ("N активных правил")
 *
 *   EXTENDED (added 2026-07-17 by the coherence audit, S1; BLOCKING since the owner's flip):
 *   - commands       = # of .md under commands/<ns>/, total and per namespace
 *   - hooks          = # of `- id:` entries across hooks/<module>/manifest.yaml
 *   - skills         = # of .md under skills/ (recursive)
 *   - agents         = # of .md under agents/ (recursive)
 *   - patterns       = # of .md under dev/meta-improvement/patterns/ − 1 (README.md)
 *
 * WHY EXTENDED SHIPPED WARN-ONLY FIRST, AND WHY IT BLOCKS NOW: this script is called by
 * process-gate.js, a BLOCKING commit-msg gate. A false positive here does not annoy — it stops
 * every commit in the repo, for everyone. Core patterns (artifact/rule) earned blocking status
 * over a year of use; the extended patterns match freer prose ("13 команд", "12 hooks") and had
 * not. They therefore rode one cycle reporting loudly at exit 0 — the same on-ramp used by
 * `check-inventory-sync.cjs` and `lesson-presence-gate.js`. That cycle came back clean (zero
 * false positives against the live repo, five real drifts caught), so the owner flipped them
 * on 2026-07-17. The empirical on-ramp is the point: a pattern earns the right to block by
 * being quiet on a real corpus first, never by its author being confident.
 *   Downgrade to warn:  --warn-extended     or   COUNTS_EXTENDED_STRICT=0
 *   Silence entirely:   --core-only         or   COUNTS_EXTENDED=0
 *
 * A kind whose ground truth cannot be established (directory absent — sparse checkout, partial
 * clone) is SKIPPED, never failed: "чекер ослеп" ≠ "нашёл дрейф" — a gate must not fail on what
 * it cannot know (same law as check-inventory-sync.cjs and the coordinate warden).
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
 *   node dev/meta-improvement/scripts/check-counts.js                    # human report
 *   node dev/meta-improvement/scripts/check-counts.js --json             # machine-readable
 *   node dev/meta-improvement/scripts/check-counts.js --warn-extended    # extended kinds warn, do not block
 *   node dev/meta-improvement/scripts/check-counts.js --core-only        # core kinds only
 *
 * Exit: 0 = all consistent (or only extended drift, warn-mode) · 1 = blocking drift found
 *       · 2 = could not establish CORE ground truth.
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
const CORE_ONLY = process.argv.includes('--core-only') || process.env.COUNTS_EXTENDED === '0';
// STRICT is the default since the owner's flip (2026-07-17). The escape hatch is deliberate and
// must stay: a gate on a shared resource with no off-switch eventually wedges someone else's
// cycle — and the one who pays is not the one who broke it (same law as INVENTORY_SYNC_STRICT=0).
// `--strict-extended` is still accepted as a no-op: it is the default now, but it appears in
// merged CHANGELOG/journal prose and in muscle memory, and silently rejecting it would be rude.
const EXTENDED_STRICT = !(
  process.argv.includes('--warn-extended') || process.env.COUNTS_EXTENDED_STRICT === '0'
);

// Kinds whose drift BLOCKS. Since the flip, extended kinds block too — unless downgraded above.
const CORE_KINDS = new Set(['artifact', 'rule']);
const isBlocking = (kind) => CORE_KINDS.has(kind) || EXTENDED_STRICT;

// ─── Ground truth ────────────────────────────────────────────────────────────
// Every helper returns null when it cannot know (missing dir/file) → the kind is skipped,
// never failed. Absence of evidence is not evidence of absence.

function countMd(relDir, { excludeReadme = false, recursive = false } = {}) {
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return null;
  let n = 0;
  const walkDir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (recursive) walkDir(p);
      } else if (e.name.endsWith('.md')) {
        if (excludeReadme && e.name === 'README.md') continue;
        n++;
      }
    }
  };
  walkDir(abs);
  return n;
}

function artifactGroundTruth() {
  const dir = path.join(ROOT, 'docs', 'pmo', 'artifacts');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
  return files.length;
}

function rulesGroundTruth() {
  const vp = path.join(ROOT, 'docs', 'pmo', 'validation.md');
  if (!fs.existsSync(vp)) return null;
  const text = fs.readFileSync(vp, 'utf8');
  const m = text.match(/(\d+)\s*активны[а-яё]*\s*правил/i);
  return m ? parseInt(m[1], 10) : null;
}

// commands/<ns>/*.md — total + per namespace. Namespaces are discovered, not hard-coded:
// a new namespace must not need a code edit here to be counted.
function commandGroundTruth() {
  const dir = path.join(ROOT, 'commands');
  if (!fs.existsSync(dir)) return { total: null, byNs: {} };
  const byNs = {};
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const n = countMd(path.join('commands', e.name));
    if (n == null) continue;
    byNs[e.name] = n;
    total += n;
  }
  return { total, byNs };
}

// hooks/<module>/manifest.yaml — count `- id:` entries. The manifest is the registration SSOT
// (docs/product-module/SPEC.md says so explicitly), so it is ground truth, not the .js file count:
// a .js on disk that no manifest registers is not a live hook.
function hookGroundTruth() {
  const dir = path.join(ROOT, 'hooks');
  if (!fs.existsSync(dir)) return { total: null, byNs: {} };
  const byNs = {};
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const mf = path.join(dir, e.name, 'manifest.yaml');
    if (!fs.existsSync(mf)) continue;
    const n = (fs.readFileSync(mf, 'utf8').match(/^\s*-\s*id:/gm) || []).length;
    byNs[e.name] = n;
    total += n;
  }
  return { total: total || null, byNs };
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

  // ── EXTENDED (blocking since the owner's flip, 2026-07-17) ──
  // Deliberately NARROW. A missed count is a doc that stays stale one more day; a false
  // positive is a gate that cries wolf and gets switched off — costing every future count.
  // Prefer under-matching: blocking status was earned by a quiet warn period, and any pattern
  // widened later owes the same on-ramp before it may block.
  //
  // NB the `(?<![\w.§×~-])` guard on every number. Without it the first empirical run drowned in
  // noise, and the noise was instructive: "### 14.1 Skills" matched as 1 skill, "A11 hook" as 11
  // hooks, "×2 subagents" as 2 agents, "§7.6 pattern" as 6 patterns. A digit glued to a section
  // number, a version, an identifier or a multiplier is never an inventory total.
  { kind: 'command', re: /(?<![\w.§×~-])(\d+)\s*(?:slash-)?команд/gi },
  { kind: 'command', re: /(?<![\w.§×~-])(\d+)\s*(?:slash[- ])?commands?\b/gi },
  { kind: 'hook', re: /(?<![\w.§×~-])(\d+)\s*hooks?\b/gi },
  { kind: 'hook', re: /(?<![\w.§×~-])(\d+)\s*хук/gi },
  { kind: 'skill', re: /(?<![\w.§×~-])(\d+)\s*скилл/gi },
  { kind: 'skill', re: /(?<![\w.§×~-])(\d+)\s*skills?\b/gi },
  { kind: 'agent', re: /(?<![\w.§×~-])(\d+)\s*субагент/gi },
  { kind: 'agent', re: /(?<![\w.§×~-])(\d+)\s*(?:sub)?agents?\b/gi },
  // NO `pattern` kind, deliberately. In this repo "pattern" means at least three different
  // things — D7 patterns in patterns/, the anti-pattern dictionary in pattern-linter.md,
  // regex patterns — and the checker cannot tell them apart. An unfixable homonym is a
  // permanent false-positive source, so the pattern count stays a human's job.
];

// A module SPEC talking about "13 slash-команд" means ITS namespace, not the repo total.
// Without this the checker "finds" drift in every correct per-module count — the loudest and
// most trust-destroying false positive of the first run.
const FILE_NS = [
  [/docs[\\/]product-module[\\/]/i, 'product'],
  [/docs[\\/]integrator-module[\\/]/i, 'integrator'],
  [/docs[\\/]design-module[\\/]/i, 'design'],
  [/docs[\\/]orchestrator-module[\\/]/i, 'orchestrator'],
  [/[\\/]?commands[\\/]([a-z-]+)[\\/]/i, null], // null → namespace = capture group 1
];

function fileNamespace(rel) {
  for (const [re, ns] of FILE_NS) {
    const m = rel.match(re);
    if (m) return ns === null ? m[1] : ns;
  }
  return null;
}

// Per-namespace command counts. Group 1 = number. Built from the generated catalog's own shape
// ("## /product:* (23)") plus the prose form README uses ("integrator/ — 9 команд").
function nsPatterns(ns) {
  return [
    new RegExp('/' + ns + ':\\*?\\s*\\(\\s*(\\d+)\\s*(?:команд[а-яё]*|commands?)?\\s*\\)', 'gi'),
    new RegExp('`?' + ns + '/`?[^\\n]{0,12}?(\\d+)\\s*команд', 'gi'),
    new RegExp('(\\d+)\\s*команд[а-яё]*\\s+(?:в\\s+)?`?' + ns + '\\b', 'gi'),
    new RegExp('`?' + ns + '`?\\s*[—:-]\\s*(\\d+)\\s*команд', 'gi'),
  ];
}

// A line naming a SUBSET is not the total. Extended kinds need this even more than artifacts do:
// prose says "3 команды для discovery" or "2 хука на событие PostToolUse" constantly.
const EXT_SUBSET_GUARD = /подмножеств|остальн|например|e\.g\.|из\s+них|только|лишь|поднабор|каждый|per\b|на\s+событие|перечислен|добавь|добавил|новых?\s|перв[ыа]|CHANGELOG|версии|релиз|stage\b|шаг\b|preserved|utility|refactor|итерац|\+|×|\bx\d|~/i;

// Extended counts are claims about THIS repo's inventory. A line about a pilot project or an
// external tool is not that claim.
// NB: `.claude/` is deliberately NOT here. It first was, and it silently ate a real finding —
// "12 hooks ... `.claude/hooks/product/`" — because in THIS repo `.claude/` is the delivery
// TARGET of our own artifacts, not a foreign context. A guard that broad hides what it guards.
const EXT_FOREIGN_GUARD = /пилот|my-first-test|external|внешн|cc-sdd|kiro|user'?s|проект[а-яё]*\s+пользовател/i;

// Lines mentioning a SUBSET of the catalog ("3 типа артефактов D2-B04", "3 типа из
// pmo/artifacts/", "остальными 21 типами") are not the catalog total — skip artifact checks.
// NB: JS \b is ASCII-only — it does NOT bound Cyrillic words. So Cyrillic markers are matched as
// substrings (anchored with surrounding spaces where ambiguous, e.g. " из ").
const SUBSET_GUARD = /производит|остальн|поднабор|слой|\sиз\s|produces|layer|subset|D2-?B?\d/i;

function scan(files, truth, nsTruth, hookNsTruth) {
  const mismatches = [];
  const push = (rel, i, kind, found, expected, line) => {
    if (expected == null || found === expected) return;
    mismatches.push({
      file: rel.replace(/\\/g, '/'),
      line: i + 1,
      kind,
      found,
      expected,
      blocking: isBlocking(kind),
      text: line.trim().slice(0, 120),
    });
  };

  for (const rel of files) {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    const ns = fileNamespace(rel);
    let inFence = false;
    lines.forEach((line, i) => {
      if (/^\s*```/.test(line)) { inFence = !inFence; return; }
      // A markdown heading is section navigation ("### 14.2 Hooks"), not an inventory claim.
      // The one heading form that IS a claim — the generated catalog's "## /product:* (23)" —
      // is matched by nsPatterns below, which runs regardless of this skip.
      const isHeading = /^\s{0,3}#{1,6}\s/.test(line);
      // Fenced blocks hold sample OUTPUT and config ("Total ecosystem: 9 hooks" is what the
      // command PRINTS for a pilot, not a claim about this repo). Generic kinds skip them;
      // nsPatterns still run, because the README's directory tree — a real, drifting count —
      // lives inside a fence.
      const extBlocked = inFence || isHeading || EXT_SUBSET_GUARD.test(line) || EXT_FOREIGN_GUARD.test(line);

      for (const { kind, re } of PATTERNS) {
        const core = CORE_KINDS.has(kind);
        if (core && kind === 'artifact' && SUBSET_GUARD.test(line)) continue;
        if (!core && (CORE_ONLY || extBlocked)) continue;
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          const found = parseInt(m[1], 10);
          // Inside a module's own docs, a command/hook count is that module's, not the repo
          // total. Without this, product SPEC's honest "12 hooks" (its own, ground truth 13)
          // gets compared to 19 — the checker would report drift AND the wrong expected value,
          // which is worse than silence: it sends the reader to "fix" a correct number.
          if (kind === 'command' && ns && nsTruth[ns] != null) {
            push(rel, i, `command:${ns}`, found, nsTruth[ns], line);
          } else if (kind === 'hook' && ns && hookNsTruth[ns] != null) {
            push(rel, i, `hook:${ns}`, found, hookNsTruth[ns], line);
          } else {
            push(rel, i, kind, found, truth[kind], line);
          }
        }
      }

      // per-namespace command counts — the form README got wrong (9 vs 13 integrator).
      // Runs even inside fences/headings: "/integrator:* (9 команд)" is unambiguous wherever
      // it appears, so it needs no context guard.
      if (!CORE_ONLY && !EXT_FOREIGN_GUARD.test(line)) {
        for (const [ns, expected] of Object.entries(nsTruth)) {
          for (const re of nsPatterns(ns)) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(line)) !== null) {
              push(rel, i, `command:${ns}`, parseInt(m[1], 10), expected, line);
            }
          }
        }
      }
    });
  }
  return mismatches;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const cmd = commandGroundTruth();
  const hooks = hookGroundTruth();
  const truth = {
    artifact: artifactGroundTruth(),
    rule: rulesGroundTruth(),
    command: cmd.total,
    hook: hooks.total,
    skill: countMd('skills', { recursive: true }),
    agent: countMd('agents', { recursive: true }),
    pattern: countMd('dev/meta-improvement/patterns', { excludeReadme: true }),
  };

  // Only CORE ground truth is mandatory: without it the script cannot do the job it already had.
  if (truth.artifact == null || truth.rule == null) {
    if (JSON_MODE) process.stdout.write(JSON.stringify({ ok: false, error: 'no-ground-truth', truth }));
    else process.stderr.write('check-counts: could not establish ground truth (artifacts dir / validation.md)\n');
    process.exit(2);
  }

  const skipped = Object.entries(truth).filter(([, v]) => v == null).map(([k]) => k);

  const files = [];
  for (const r of SCAN_ROOTS) walk(r, files);
  const mismatches = scan(files, truth, CORE_ONLY ? {} : cmd.byNs, CORE_ONLY ? {} : hooks.byNs);

  const blocking = mismatches.filter(m => m.blocking);
  const warnings = mismatches.filter(m => !m.blocking);
  const exitCode = blocking.length === 0 ? 0 : 1;

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify({
      ok: mismatches.length === 0,
      blocking_ok: blocking.length === 0,
      extended_mode: CORE_ONLY ? 'off' : (EXTENDED_STRICT ? 'strict' : 'warn'),
      truth,
      ns_truth: cmd.byNs,
      skipped_kinds: skipped,
      mismatches,
    }, null, 2));
    process.exit(exitCode);
  }

  const summary = `${truth.artifact} artifact types, ${truth.rule} validation rules` +
    (CORE_ONLY ? '' : `, ${truth.command} commands, ${truth.hook} hooks, ${truth.skill} skills, ${truth.agent} agents, ${truth.pattern} patterns`);

  if (blocking.length > 0) {
    process.stderr.write(`check-counts: ✗ COUNT DRIFT — ground truth: ${summary}.\n`);
    process.stderr.write(`Stated counts disagreeing with ground truth:\n`);
    for (const m of blocking) {
      process.stderr.write(`  ${m.file}:${m.line}  [${m.kind}] found ${m.found}, expected ${m.expected}\n      ${m.text}\n`);
    }
  }

  if (warnings.length > 0) {
    const w = process.stderr;
    w.write(`\ncheck-counts: ⚠ EXTENDED COUNT DRIFT (warn-only — NOT blocking this run):\n`);
    for (const m of warnings) {
      w.write(`  ${m.file}:${m.line}  [${m.kind}] found ${m.found}, expected ${m.expected}\n      ${m.text}\n`);
    }
    w.write(`\n  These do not fail the gate — extended kinds are downgraded to warn in this run.\n`);
    w.write(`  Drop --warn-extended / COUNTS_EXTENDED_STRICT=0 to restore blocking (the default).\n`);
  }

  if (skipped.length > 0 && !CORE_ONLY) {
    process.stderr.write(`\ncheck-counts: note — no ground truth for [${skipped.join(', ')}] (directory absent?); those kinds were SKIPPED, not failed.\n`);
  }

  if (mismatches.length === 0) {
    process.stdout.write(`check-counts: ✓ consistent — ${summary} (ground truth) match all live docs.\n`);
    process.exit(0);
  }

  if (blocking.length > 0) {
    process.stderr.write(`\nFix the stale numbers above (or correct ground truth if it is wrong), then re-run.\n`);
  } else {
    process.stdout.write(`\ncheck-counts: ✓ core counts consistent — ${truth.artifact} artifact types, ${truth.rule} validation rules. (${warnings.length} extended warning(s) above.)\n`);
  }
  process.exit(exitCode);
}

main();
