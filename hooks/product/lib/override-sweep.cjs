'use strict';
/**
 * override-sweep.cjs — deterministic sweeper for expired approve_overrides.
 *
 * Closes audit gap G28 (APPENDIX-B §69 / DEC-DEV-0180): the D2 override machinery
 * (validation.md §9.4, DEC-DEV-0012 C.5) lets an artifact carry a *temporary*
 * `approve_overrides[]` entry with an optional `expires_at`. The inline validator
 * (hooks/product/artifact-validate.js → buildOverrideMap) already treats an expired
 * override as inactive AT READ TIME, but nothing ever proactively surfaces or reaps
 * expired entries — they accumulate as dead frontmatter config. This module is that
 * missing sweep: it scans every .product/ artifact, classifies each approve_override,
 * and (report by default; --clean on demand) reaps the expired ones.
 *
 * INLINE-CONSISTENT classification (mirrors buildOverrideMap semantics exactly so the
 * sweeper never disagrees with the validator):
 *   - no expires_at            → 'no-expiry'    (inline keeps ACTIVE forever; report-only)
 *   - expires_at unparseable   → 'invalid-date' (inline keeps ACTIVE — `!isNaN && <now`
 *                                                 is false on NaN; report as a config
 *                                                 smell, NEVER cleaned — it is not expired)
 *   - expires_at parses, >= now→ 'active'
 *   - expires_at parses, < now → 'expired'      (inline re-applies the rule; --clean reaps)
 *
 * --clean removes ONLY 'expired' entries. Because the inline validator already ignores
 * them, removal is validation-behaviour-neutral (pure hygiene) — it cannot resurrect a
 * gate or drop one. Default behaviour is a dry-run report; mutation requires --clean.
 *
 * Node stdlib only. Pure functions are unit-tested (tests/product/override-sweep.test.cjs,
 * in the `verify` chain). The proactive runtime call is the SessionStart hook
 * hooks/product/override-sweep-check.js (detect-only warn).
 *
 * CLI:  node override-sweep.cjs [root] [--clean] [--json] [--strict] [--quiet]
 *   root      project root (dir containing .product/); default cwd
 *   --clean   rewrite artifacts, removing expired approve_overrides entries
 *   --json    machine-readable output
 *   --strict  exit 1 if any expired entry is found (CI signal); default exit 0
 *   --quiet   suppress the "nothing to report" line
 */

const fs = require('fs');
const path = require('path');

// ── frontmatter / override parsing (mirrors artifact-validate.js) ─────────────

function parseScalar(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~' || val === '') return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  return val;
}

/**
 * Parse the `approve_overrides:` list from an artifact's frontmatter, tracking the
 * absolute line span [startLine, endLine] of each list item so --clean can splice
 * items out losslessly. Line numbers are 0-based indices into content.split(/\r?\n/).
 *
 * Returns { headerLine, items: [{ ...fields, _start, _end }] } or null if no section.
 */
function parseApproveOverrides(content) {
  const lines = content.split(/\r?\n/);

  // Locate the frontmatter fence (opening --- must be the first line).
  if (lines[0] !== '---') return null;
  let fmEnd = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') { fmEnd = i; break; }
  }
  if (fmEnd === -1) return null;

  // Find the `approve_overrides:` header within the frontmatter body.
  let headerLine = -1;
  for (let i = 1; i < fmEnd; i += 1) {
    if (/^approve_overrides\s*:\s*$/.test(lines[i])) { headerLine = i; break; }
  }
  if (headerLine === -1) return null;

  const items = [];
  let current = null;

  for (let i = headerLine + 1; i < fmEnd; i += 1) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      // Blank line: tolerate inside the block, but attribute it to the current item
      // only if it is followed by more indented content (handled by the -end bump below).
      if (current) current._end = i;
      continue;
    }
    // A new top-level frontmatter key ends the section.
    if (/^[a-zA-Z_]/.test(line)) break;

    const listStart = /^(\s*)-\s+([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (listStart) {
      if (current) items.push(current);
      current = { _start: i, _end: i };
      const val = listStart[3].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
      current[listStart[2]] = parseScalar(val);
      continue;
    }

    const contKey = /^\s+([a-zA-Z_]+)\s*:\s*(.*)$/.exec(line);
    if (contKey && current) {
      const val = contKey[2].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
      current[contKey[1]] = parseScalar(val);
      current._end = i;
      continue;
    }
  }
  if (current) items.push(current);

  return { headerLine, items };
}

// ── classification (inline-consistent) ────────────────────────────────────────

/** Classify one override object against `now` (ms). See module header. */
function classifyOverride(ov, now) {
  if (ov.expires_at === undefined || ov.expires_at === null || ov.expires_at === '') {
    return 'no-expiry';
  }
  const t = Date.parse(String(ov.expires_at));
  if (Number.isNaN(t)) return 'invalid-date';
  return t < now ? 'expired' : 'active';
}

/**
 * Sweep a single artifact's content. Returns buckets by classification.
 * Only approve_overrides carrying a `rule` are considered (matches inline: `if (!ov.rule) continue`).
 */
function sweepArtifact(content, now) {
  const out = {
    expired: [], active: [], noExpiry: [], invalidDate: [], _parsed: null,
  };
  const parsed = parseApproveOverrides(content);
  if (!parsed) return out;
  out._parsed = parsed;
  for (const item of parsed.items) {
    if (!item.rule) continue;
    const cls = classifyOverride(item, now);
    if (cls === 'expired') out.expired.push(item);
    else if (cls === 'active') out.active.push(item);
    else if (cls === 'invalid-date') out.invalidDate.push(item);
    else out.noExpiry.push(item);
  }
  return out;
}

/**
 * Produce cleaned content: physically remove the line-spans of EXPIRED entries.
 * Validation-neutral (inline already ignores them). If removal empties the section,
 * the `approve_overrides:` header line is dropped too. Returns { content, removed }.
 */
function cleanContent(content, now) {
  const sweep = sweepArtifact(content, now);
  if (sweep.expired.length === 0) return { content, removed: [] };

  const lines = content.split(/\r?\n/);
  const removeSet = new Set();
  for (const item of sweep.expired) {
    for (let i = item._start; i <= item._end; i += 1) removeSet.add(i);
  }

  // If every surviving list item is being removed, drop the header line as well.
  const remaining = sweep.active.length + sweep.noExpiry.length + sweep.invalidDate.length;
  if (remaining === 0) removeSet.add(sweep._parsed.headerLine);

  const kept = lines.filter((_, idx) => !removeSet.has(idx));
  // Preserve original trailing-newline shape.
  return { content: kept.join('\n'), removed: sweep.expired };
}

// ── tree walk ─────────────────────────────────────────────────────────────────

/** Recursively collect .md artifacts under .product, skipping hook-meta dirs (.pending/.sessions). */
function collectArtifactFiles(productDir) {
  const results = [];
  const stack = [productDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '.pending' || ent.name === '.sessions') continue;
        stack.push(full);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        results.push(full);
      }
    }
  }
  results.sort();
  return results;
}

/**
 * Sweep the whole tree under <root>/.product. `now` defaults to Date.now().
 * Returns { root, files: [{ path, rel, expired, invalidDate, active, noExpiry }], summary }.
 * `files` contains only artifacts with something worth reporting (expired or invalid-date),
 * unless opts.all is set.
 */
function sweepTree(root, opts) {
  const options = opts || {};
  const now = options.now == null ? Date.now() : options.now;
  const productDir = path.join(root, '.product');
  const summary = {
    filesScanned: 0, expiredCount: 0, invalidDateCount: 0,
    activeCount: 0, noExpiryCount: 0, filesWithExpired: 0,
  };
  const files = [];
  if (!fs.existsSync(productDir)) return { root, files, summary };

  for (const file of collectArtifactFiles(productDir)) {
    let content;
    try { content = fs.readFileSync(file, 'utf-8'); } catch (_) { continue; }
    summary.filesScanned += 1;
    const s = sweepArtifact(content, now);
    summary.expiredCount += s.expired.length;
    summary.invalidDateCount += s.invalidDate.length;
    summary.activeCount += s.active.length;
    summary.noExpiryCount += s.noExpiry.length;
    if (s.expired.length) summary.filesWithExpired += 1;
    if (s.expired.length || s.invalidDate.length || options.all) {
      files.push({
        path: file,
        rel: path.relative(root, file).replace(/\\/g, '/'),
        expired: s.expired,
        invalidDate: s.invalidDate,
        active: s.active,
        noExpiry: s.noExpiry,
      });
    }
  }
  return { root, files, summary };
}

/** One compact line per finding for hook additionalContext / CLI report. */
function summarizeLines(sweepResult) {
  const out = [];
  for (const f of sweepResult.files) {
    for (const ov of f.expired) {
      out.push(`  EXPIRED  ${f.rel}: ${ov.rule} (expires_at ${ov.expires_at}) — validator already re-applies this rule`);
    }
    for (const ov of f.invalidDate) {
      out.push(`  BAD-DATE ${f.rel}: ${ov.rule} (expires_at "${ov.expires_at}" unparseable — validator treats as ACTIVE)`);
    }
  }
  return out;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function runCli(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positional = args.filter((a) => !a.startsWith('--'));
  const root = path.resolve(positional[0] || process.cwd());
  const doClean = flags.has('--clean');
  const asJson = flags.has('--json');
  const strict = flags.has('--strict');
  const quiet = flags.has('--quiet');

  const result = sweepTree(root);

  if (doClean) {
    const cleaned = [];
    for (const f of result.files) {
      if (!f.expired.length) continue;
      let content;
      try { content = fs.readFileSync(f.path, 'utf-8'); } catch (_) { continue; }
      const { content: newContent, removed } = cleanContent(content, Date.now());
      if (removed.length) {
        try {
          fs.writeFileSync(f.path, newContent);
          cleaned.push({ rel: f.rel, removed: removed.map((r) => r.rule) });
        } catch (e) {
          process.stderr.write(`[override-sweep] failed to write ${f.rel}: ${e.message}\n`);
        }
      }
    }
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ cleaned, summary: result.summary }, null, 2)}\n`);
    } else if (cleaned.length === 0) {
      if (!quiet) process.stdout.write('override-sweep --clean: no expired approve_overrides to remove.\n');
    } else {
      process.stdout.write('override-sweep --clean: removed expired approve_overrides:\n');
      for (const c of cleaned) process.stdout.write(`  ${c.rel}: ${c.removed.join(', ')}\n`);
    }
    return 0;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      summary: result.summary,
      files: result.files.map((f) => ({
        rel: f.rel,
        expired: f.expired.map((o) => ({ rule: o.rule, expires_at: o.expires_at })),
        invalidDate: f.invalidDate.map((o) => ({ rule: o.rule, expires_at: o.expires_at })),
      })),
    }, null, 2)}\n`);
  } else {
    const lines = summarizeLines(result);
    if (lines.length === 0) {
      if (!quiet) process.stdout.write('override-sweep: no expired or malformed approve_overrides found.\n');
    } else {
      process.stdout.write(`override-sweep: ${result.summary.expiredCount} expired, `
        + `${result.summary.invalidDateCount} malformed approve_override(s) across `
        + `${result.summary.filesScanned} artifact(s):\n`);
      for (const l of lines) process.stdout.write(`${l}\n`);
      process.stdout.write('\nRun with --clean to remove expired entries (validation-neutral); fix malformed dates by hand.\n');
    }
  }

  return strict && result.summary.expiredCount > 0 ? 1 : 0;
}

module.exports = {
  parseScalar,
  parseApproveOverrides,
  classifyOverride,
  sweepArtifact,
  cleanContent,
  collectArtifactFiles,
  sweepTree,
  summarizeLines,
  runCli,
};

if (require.main === module) {
  process.exit(runCli(process.argv));
}
