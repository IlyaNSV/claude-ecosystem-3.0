#!/usr/bin/env node
/**
 * check-information-map.js — INFORMATION-MAP P3 path-resolvability guard (DEC-DEV-0179).
 *
 * Closes gap G34 (dev/process-fabric/audit/APPENDIX-B-gap-analysis.md, root-cause class (e):
 * spec-без-импл). dev/INFORMATION-MAP.yaml states design principle P3 — "Каталог verifiable:
 * каждый `ssot:`-путь обязан существовать. Дешёвый будущий guard — скрипт, проверяющий
 * резолвимость путей." — but the guard was never built, so the principle was aspirational and
 * a moved/renamed/deleted file could rot a `ssot:` pointer silently.
 *
 * WHAT IT DOES. Parses dev/INFORMATION-MAP.yaml as raw text (paths live embedded in prose across
 * ssot/mirrors/verify/note fields, not in clean fields), extracts every repo-relative path-like
 * reference, and checks each resolves against the repo root. Red (exit 1) with the list of broken
 * references; green (exit 0) when all resolve.
 *
 * WHAT COUNTS AS A CHECKABLE PATH (deliberately conservative to avoid false positives on prose):
 *   - Has a directory separator ('/'), OR is one of the known repo-root docs (ROOT_DOCS).
 *   - AND has a recognized extension (.md/.js/.cjs/.mjs/.yaml/.yml/.json), ends with '/'
 *     (directory), or contains a glob '*'. (Extension-less prose abbreviations like
 *     "artifacts/README" or bare tool names like "gen-command-catalog.cjs" are intentionally
 *     skipped — they are not path claims.)
 *
 * NORMALIZATION / SKIP RULES:
 *   - Section anchors: "file.md#секция" → only the file part is checked.
 *   - Placeholders: "<TYPE>", "<module>", "<N>" → treated as a glob '*'.
 *   - Globs: "dir/*.md" must match ≥1 file; "dir/*" (bare contents) requires the parent dir;
 *     trailing-slash "dir/" requires the directory.
 *   - Out-of-repo lines (contain "out-of-repo" or "~/", e.g. the memory-location class) are skipped
 *     wholesale — those references (~/.claude/.../memory/, MEMORY.md, project_*.md) are not repo files.
 *   - Gitignored paths (e.g. the regenerated dev/meta-improvement/rails/RAILS.md) are skipped —
 *     their on-disk presence is environment-dependent, not a committed contract.
 *
 * Usage:
 *   node dev/meta-improvement/scripts/check-information-map.js          # human report
 *   node dev/meta-improvement/scripts/check-information-map.js --json   # machine-readable
 *
 * Exit: 0 = all references resolve · 1 = broken reference(s) · 2 = could not read the map.
 *
 * Wired into `npm run verify` (package.json → check:infomap), same pattern as check:doctype /
 * check:validation-sync.
 */

const { execSync, execFileSync } = require('child_process');
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
const MAP_REL = 'dev/INFORMATION-MAP.yaml';

// Repo-root docs referenced by bare name (no directory separator). A bare '.md' not in this set
// (e.g. the out-of-repo memory index MEMORY.md, or memory mirrors project_*.md) is NOT checked.
const ROOT_DOCS = new Set([
  'README.md', 'ROADMAP.md', 'CHANGELOG.md', 'CLAUDE.md', 'DEV_JOURNAL.md',
  'HOME.md', 'BOOTSTRAP.md', 'INSTALL-HUMAN.md',
]);

const EXT_RE = /\.(md|js|cjs|mjs|ya?ml|json)$/i;
// Path-ish token: starts with a word char or dot, then path/glob/anchor chars. JS \w + our set
// are ASCII-only, so a Cyrillic anchor (…#где-мы-сейчас) naturally terminates the match at '#'.
const TOKEN_RE = /[A-Za-z0-9_.][A-Za-z0-9_./*<>#-]*/g;
// A line describing an out-of-repo location — skip every token on it.
const OUT_OF_REPO_RE = /out-of-repo|~\//i;

// ─── Extraction ────────────────────────────────────────────────────────────

function extractCandidates(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (OUT_OF_REPO_RE.test(line)) return;
    const matches = line.match(TOKEN_RE) || [];
    for (let raw of matches) {
      // Strip section anchor: keep only the file part.
      raw = raw.split('#')[0];
      // Strip a trailing '.' (sentence punctuation caught by the char class).
      raw = raw.replace(/\.+$/, m => (EXT_RE.test(raw) ? m : '')); // keep real extensions
      raw = raw.replace(/[.,;:]+$/, '');
      if (!raw) continue;
      // Substitute placeholders <TYPE>/<module>/<N> → glob.
      const token = raw.replace(/<[^>]*>/g, '*');
      if (token.includes('~')) continue;
      out.push({ token, line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
  return out;
}

function isCheckable(token) {
  const hasSep = token.includes('/');
  const isRootDoc = ROOT_DOCS.has(token);
  if (!hasSep && !isRootDoc) return false;
  // A single-segment trailing-slash token ("word/") is almost always prose — Russian text uses
  // '/' as an "or" separator ("ROADMAP/память", "tech-debt/в бэклоге"), and the Cyrillic tail is
  // stripped by the ASCII token regex, leaving a bogus "dir/". Real directory references in this
  // catalog are always multi-segment (dev/tech-debt/, docs/pmo/artifacts/). Require an interior '/'.
  if (token.endsWith('/') && !token.slice(0, -1).includes('/')) return false;
  const looksLikePath = EXT_RE.test(token) || token.endsWith('/') || token.includes('*');
  return looksLikePath;
}

// ─── Resolution ──────────────────────────────────────────────────────────────

// `rel` is a path token extracted from INFORMATION-MAP.yaml. Interpolating it into a shell string
// was a (narrow, dev-only) injection sink — L-5, SECURITY_REVIEW_2026-07-11. execFileSync passes a
// discrete argv with no shell, so the quoting question disappears entirely.
function isGitIgnored(rel) {
  try {
    execFileSync('git', ['check-ignore', '-q', rel], { cwd: ROOT, stdio: 'ignore' });
    return true; // exit 0 = ignored
  } catch (e) {
    return false; // exit 1 = not ignored
  }
}

// Minimal glob: resolve a '/'-separated pattern whose segments may contain '*'. Returns matches.
function globResolve(pattern) {
  const segs = pattern.split('/').filter(s => s.length > 0);
  let current = [ROOT];
  for (const seg of segs) {
    const next = [];
    if (seg.includes('*')) {
      const re = new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      for (const dir of current) {
        let entries = [];
        try { entries = fs.readdirSync(dir); } catch (e) { continue; }
        for (const e of entries) if (re.test(e)) next.push(path.join(dir, e));
      }
    } else {
      for (const dir of current) {
        const p = path.join(dir, seg);
        if (fs.existsSync(p)) next.push(p);
      }
    }
    current = next;
    if (current.length === 0) break;
  }
  return current;
}

// Returns true if the token resolves (file/dir/glob), false if broken.
function resolves(token) {
  const rel = token.replace(/\/+$/, ''); // normalize trailing slash for gitignore/dir handling
  // Glob patterns.
  if (token.includes('*')) {
    if (token.endsWith('/*')) {
      // Bare directory-contents glob → require the parent directory to exist.
      const dir = token.slice(0, -2);
      return fs.existsSync(path.join(ROOT, dir));
    }
    return globResolve(token).length > 0;
  }
  // Directory (trailing slash) or plain file.
  return fs.existsSync(path.join(ROOT, rel));
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const mapAbs = path.join(ROOT, MAP_REL);
  if (!fs.existsSync(mapAbs)) {
    if (JSON_MODE) process.stdout.write(JSON.stringify({ ok: false, error: 'map-not-found', map: MAP_REL }));
    else process.stderr.write(`check-information-map: could not find ${MAP_REL}\n`);
    process.exit(2);
  }

  const text = fs.readFileSync(mapAbs, 'utf8');
  const candidates = extractCandidates(text);

  const seen = new Set();
  const checked = [];
  const broken = [];
  for (const c of candidates) {
    if (!isCheckable(c.token)) continue;
    const key = c.token;
    if (seen.has(key)) continue; // report each distinct reference once
    seen.add(key);
    // Skip gitignored concrete paths (regenerated / local artifacts).
    if (!c.token.includes('*')) {
      const rel = c.token.replace(/\/+$/, '');
      if (isGitIgnored(rel)) continue;
    }
    checked.push(c.token);
    if (!resolves(c.token)) broken.push(c);
  }

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify(
      { ok: broken.length === 0, checked: checked.length, checkedPaths: checked, broken }, null, 2));
    process.exit(broken.length === 0 ? 0 : 1);
  }

  if (broken.length === 0) {
    process.stdout.write(
      `check-information-map: ✓ all ${checked.length} path references in ${MAP_REL} resolve.\n`);
    process.exit(0);
  }

  process.stderr.write(
    `check-information-map: ✗ BROKEN PATHS — ${broken.length} of ${checked.length} references in ${MAP_REL} do not resolve:\n`);
  for (const b of broken) {
    process.stderr.write(`  ${MAP_REL}:${b.line}  → ${b.token}\n      ${b.text}\n`);
  }
  process.stderr.write(`\nFix the moved/renamed/deleted path(s) above (P3: every ssot path must resolve), then re-run.\n`);
  process.exit(1);
}

main();
