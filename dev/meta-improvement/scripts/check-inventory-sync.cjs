#!/usr/bin/env node
/**
 * check-inventory-sync.cjs — verify.md ↔ repo inventory drift linter
 * (DEC-DEV-0197 / D11; mechanizes CLAUDE.md «Process triggers» Row 5).
 *
 * Row 5 («добавил/убрал команду / скилл / хук ⇒ обнови commands/ecosystem/verify.md
 * Step 4 + summary») was the one obligation in the table with NEITHER a blocking gate
 * NOR a warn hook — pure prose, and prose buys ~60-68% compliance. This is the
 * deterministic half.
 *
 * ── What it checks (only claims verify.md ACTUALLY makes; see «Not covered» below) ──
 *   [1] NAMESPACE-SET   Step 4 prose «For each namespace (…)» == the live commands/<ns>/ dirs.
 *   [2] NAMESPACE-ECHO  Step 9 summary COMMANDS block lists the same namespaces as [1].
 *                       (Row 5 says «Step 4 + summary» — both, hence two checks.)
 *   [3] FLOOR           Step 4 runtime-dir floors («— expect N+») are ≤ the live file count.
 *   [4] MARKER-LIVE     Every Step 4.5 / 4.6 marker string is really present in the repo
 *                       source file that row names. verify.md itself flags this class
 *                       («that's list-drift, not a bad install») but nothing detected it.
 *   [5] HOOK-CLAIM      Every hook verify.md claims is «registered under <Event>» exists in
 *                       some hooks/<module>/manifest.yaml with that event type.
 *
 * ── Deploy mapping ──
 * verify.md describes the INSTALLED tree (`.claude/product/processes/`), the repo is the
 * SSOT (`product/processes/`). Mapping = strip the leading `.claude/` (the bootstrap deploy
 * contract). Encoded in repoPathOf().
 *
 * ── NOT covered (stated honestly, not faked) ──
 *   · SKILLS. verify.md has no skill inventory at all — skills appear once, as a dir-existence
 *     check in Step 1. So Row 5's «скилл» prong currently has NO target in verify.md: there is
 *     nothing to sync. Either verify.md should grow a skills check or Row 5 should drop the
 *     prong — an owner call, not a linter's.
 *   · HOOKS beyond the two LESSON-* ones named in Step 8.5. The other manifest entries
 *     (4 modules) are unrepresented in verify.md, so their add/remove is undetectable here.
 *   · Commands at ITEM granularity — already covered elsewhere: verify.md Step 4 derives
 *     per-namespace counts from the generated catalog docs/guide/02-commands.md, which is
 *     drift-gated by `gen:catalog:check` (blocking, in `npm run verify`). This linter adds the
 *     one thing that catalog cannot see: the NAMESPACE SET itself.
 *   · Artifact counts in verify.md (Step 3 «25 files») — already covered by check-counts.js.
 *   · `status.md` / `docs/MAP.md` (the other half of Row 5): docs/MAP.md is gated by
 *     `gen:map:check`; the status.md overview templates need a judgment call («does this new
 *     command belong in the overview?») and are deliberately left to the human.
 *
 * ── Enforcement posture (DEC-DEV-0197 law of method) ──
 * WARN-ONLY: exit 0 always. NOT wired into `npm run verify`, NOT in process-gate.
 * A strict gate with false positives is worse than no gate — it performs a harmful action
 * wearing the costume of discipline. `--strict` exists (exit 1 on drift) but stays unwired
 * until the owner flips it on measured precision.
 *
 * Usage:
 *   node dev/meta-improvement/scripts/check-inventory-sync.cjs [--strict] [--verify-md=<path>]
 *   --verify-md=<path>  lint an alternate copy of verify.md against the live repo
 *                       (used for negative-control testing).
 */

'use strict';

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
const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const VERIFY_MD = (() => {
  const a = argv.find(x => x.startsWith('--verify-md='));
  return a ? path.resolve(a.slice('--verify-md='.length))
           : path.join(ROOT, 'commands', 'ecosystem', 'verify.md');
})();

const KNOWN_EVENTS = [
  'PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SessionStart',
  'SubagentStop', 'PreCompact', 'Notification', 'Stop',
];

function die(msg) {
  process.stderr.write(`check-inventory-sync: ${msg}\n`);
  process.exit(2); // ground truth unestablished — distinct from "drift found"
}

// `.claude/product/processes/` (installed) → `product/processes/` (repo SSOT)
function repoPathOf(installedPath) {
  return installedPath.replace(/^\.claude\//, '').replace(/^\/+/, '');
}

function listDir(rel, filterRe) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readdirSync(abs).filter(f => (filterRe ? filterRe.test(f) : true));
}

// ─── Ground truth: the repo ──────────────────────────────────────────────────

function liveNamespaces() {
  const abs = path.join(ROOT, 'commands');
  if (!fs.existsSync(abs)) die('commands/ not found — parse broken?');
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

// Minimal hand-parse of hooks/<module>/manifest.yaml (no YAML dep, matches repo style).
function liveHooks() {
  const hooks = {}; // file.js -> { id, module, events: [] }
  const modules = fs.existsSync(path.join(ROOT, 'hooks'))
    ? fs.readdirSync(path.join(ROOT, 'hooks'), { withFileTypes: true }).filter(d => d.isDirectory())
    : [];
  for (const m of modules) {
    const mf = path.join(ROOT, 'hooks', m.name, 'manifest.yaml');
    if (!fs.existsSync(mf)) continue;
    let cur = null;
    for (const line of fs.readFileSync(mf, 'utf8').split('\n')) {
      const id = line.match(/^\s*-\s+id:\s*(\S+)/);
      if (id) { cur = { id: id[1], module: m.name, file: null, events: [] }; continue; }
      if (!cur) continue;
      const file = line.match(/^\s*file:\s*(\S+)/);
      if (file) { cur.file = file[1]; hooks[cur.file] = cur; continue; }
      const ev = line.match(/^\s*-\s+type:\s*(\S+)/);
      if (ev && cur.file) cur.events.push(ev[1]);
    }
  }
  if (Object.keys(hooks).length === 0) die('no hooks parsed from hooks/*/manifest.yaml — parse broken?');
  return hooks;
}

// ─── Claims: verify.md ───────────────────────────────────────────────────────

function backticked(s) {
  return [...s.matchAll(/`([^`]+)`/g)].map(m => m[1]);
}

// [1] «For each namespace (`ecosystem`, `integrator`, …)»
function claimedNamespaces(text) {
  const m = text.match(/For each namespace\s*\(([^)]*)\)/);
  if (!m) return null;
  return backticked(m[1]).sort();
}

// [2] Step 9 summary: the COMMANDS block's «✓ <ns>/: …» lines.
function echoedNamespaces(text) {
  const start = text.indexOf('COMMANDS (');
  if (start === -1) return null;
  const out = [];
  for (const line of text.slice(start).split('\n')) {
    if (out.length && line.trim() === '') break;      // block ends at the blank line
    const m = line.match(/^\s*[✓✗🟡]\s*([A-Za-z][\w-]*)\/:/); // «product/processes: 3+» has no «/:»
    if (m) out.push(m[1]);
  }
  return out.length ? out.sort() : null;
}

// [3] «- `.claude/product/processes/*.mjs` — expect 3+ (…)»
function claimedFloors(text) {
  const floors = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^-\s*`([^`]+)`\s*—\s*expect\s+(\d+)\+/);
    if (m) floors.push({ glob: m[1], floor: parseInt(m[2], 10) });
  }
  return floors;
}

// [4] Steps 4.5/4.6 marker tables. Header cell 2 carries the dir: «File (`.claude/…/`)».
function claimedMarkers(text) {
  const markers = [];
  const lines = text.split('\n');
  let dir = null;
  for (const line of lines) {
    if (/^\|\s*Marker\b/i.test(line)) {
      const cells = line.split('|');
      const d = cells[2] ? backticked(cells[2])[0] : null;
      dir = d && d.endsWith('/') ? d : null;
      continue;
    }
    if (!dir) continue;
    if (!line.startsWith('|')) { dir = null; continue; }        // table ended
    if (/^\|\s*-+/.test(line.replace(/\s/g, ''))) continue;      // |---|---| separator
    const cells = line.split('|').slice(1, -1);
    if (cells.length < 2) continue;
    const marker = backticked(cells[0])[0];
    const file = backticked(cells[1])[0];
    if (marker && file) markers.push({ marker, file, dir });
  }
  return markers;
}

// [5] Lines claiming a hook is registered: «`lesson-gate.js` is registered under **`Stop`**».
function claimedHooks(text) {
  const claims = [];
  for (const line of text.split('\n')) {
    if (!/registered/i.test(line)) continue;
    const f = line.match(/`?([\w-]+\.js)`?/);
    if (!f) continue;
    const events = KNOWN_EVENTS.filter(e => new RegExp(`\\b${e}\\b`).test(line));
    claims.push({ file: f[1], events, line: line.trim() });
  }
  return claims;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(VERIFY_MD)) die(`cannot read ${VERIFY_MD}`);
  const text = fs.readFileSync(VERIFY_MD, 'utf8');

  const live = liveNamespaces();
  const hooks = liveHooks();
  const findings = [];
  const checked = { ns: 0, echo: 0, floors: 0, markers: 0, hooks: 0 };

  // [1] NAMESPACE-SET
  const claimedNs = claimedNamespaces(text);
  if (!claimedNs) {
    findings.push('[1] NAMESPACE-SET — could not find the «For each namespace (…)» sentence in Step 4 (doc restructured? parser stale?)');
  } else {
    checked.ns = claimedNs.length;
    for (const ns of live) {
      if (!claimedNs.includes(ns)) {
        findings.push(`[1] NAMESPACE-SET — commands/${ns}/ exists in the repo but Step 4 does not list it (a namespace was ADDED; verify.md would never check it)`);
      }
    }
    for (const ns of claimedNs) {
      if (!live.includes(ns)) {
        findings.push(`[1] NAMESPACE-SET — Step 4 lists «${ns}» but commands/${ns}/ does not exist (a namespace was REMOVED; verify.md points at nothing)`);
      }
    }
  }

  // [2] NAMESPACE-ECHO
  const echoNs = echoedNamespaces(text);
  if (!echoNs) {
    findings.push('[2] NAMESPACE-ECHO — could not find the COMMANDS block in the Step 9 summary (doc restructured? parser stale?)');
  } else {
    checked.echo = echoNs.length;
    for (const ns of live) {
      if (!echoNs.includes(ns)) {
        findings.push(`[2] NAMESPACE-ECHO — commands/${ns}/ exists but the Step 9 summary block omits it (Row 5 requires «Step 4 + summary»)`);
      }
    }
    for (const ns of echoNs) {
      if (!live.includes(ns)) {
        findings.push(`[2] NAMESPACE-ECHO — the Step 9 summary lists «${ns}/» but commands/${ns}/ does not exist`);
      }
    }
  }

  // [3] FLOOR
  for (const { glob, floor } of claimedFloors(text)) {
    const rel = repoPathOf(glob);
    const dir = path.dirname(rel);
    const ext = path.extname(rel);
    const files = listDir(dir, new RegExp(`\\${ext}$`));
    checked.floors++;
    if (files === null) {
      findings.push(`[3] FLOOR — verify.md expects «${glob}» ≥ ${floor}, but repo dir ${dir}/ does not exist`);
      continue;
    }
    if (files.length < floor) {
      findings.push(`[3] FLOOR — verify.md expects «${glob}» ≥ ${floor}, but the repo has ${files.length} (a file was REMOVED, or the floor was never lowered)`);
    }
  }

  // [4] MARKER-LIVE
  for (const { marker, file, dir } of claimedMarkers(text)) {
    checked.markers++;
    const rel = path.join(repoPathOf(dir), file);
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      findings.push(`[4] MARKER-LIVE — verify.md spot-checks «${marker}» in ${dir}${file}, but the repo has no ${rel} (file renamed/removed → the check can never pass)`);
      continue;
    }
    if (!fs.readFileSync(abs, 'utf8').includes(marker)) {
      findings.push(`[4] MARKER-LIVE — verify.md claims «${marker}» is in ${rel}, but the repo source does NOT contain it (list-drift: the contract evolved, the marker table did not)`);
    }
  }

  // [5] HOOK-CLAIM
  for (const { file, events } of claimedHooks(text)) {
    checked.hooks++;
    const h = hooks[file];
    if (!h) {
      findings.push(`[5] HOOK-CLAIM — verify.md says «${file}» is registered, but no hooks/*/manifest.yaml declares it (hook renamed/removed)`);
      continue;
    }
    for (const e of events) {
      if (!h.events.includes(e)) {
        findings.push(`[5] HOOK-CLAIM — verify.md says «${file}» is registered under ${e}, but hooks/${h.module}/manifest.yaml lists events [${h.events.join(', ') || '—'}]`);
      }
    }
  }

  const scope = `${checked.ns} namespaces · ${checked.echo} summary rows · ` +
    `${checked.floors} floors · ${checked.markers} markers · ${checked.hooks} hook claims`;

  if (findings.length === 0) {
    process.stdout.write(`check-inventory-sync: ✓ verify.md matches the repo — ${scope}.\n`);
    process.stdout.write('  (not covered: skills — verify.md has no skill inventory; ' +
      'hooks beyond the LESSON-* pair; status.md overview templates. See the header.)\n');
    return 0;
  }

  process.stderr.write(`check-inventory-sync: ⚠ verify.md is STALE vs the repo — ${findings.length} finding(s):\n\n`);
  for (const f of findings) process.stderr.write(`  ${f}\n`);
  process.stderr.write(`\n  scope: ${scope}\n`);
  process.stderr.write('  Fix: update commands/ecosystem/verify.md (Step 4 + Step 9 summary) — ' +
    'CLAUDE.md «Process triggers» Row 5.\n');
  if (!STRICT) {
    process.stderr.write('  (warn-only — exit 0. Precision measured per DEC-DEV-0197 / D11; ' +
      'the warn→strict flip is the owner\'s call.)\n');
  }
  return STRICT ? 1 : 0;
}

let code = 0;
try {
  code = main();
} catch (e) {
  process.stderr.write(`check-inventory-sync: internal error — ${e.message}\n`);
  code = STRICT ? 2 : 0; // warn-only must never wedge anything
}
process.exit(code);
