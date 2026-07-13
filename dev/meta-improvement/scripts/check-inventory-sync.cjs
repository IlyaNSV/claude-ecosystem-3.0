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
 *   [3] FLOOR           Step 4 floors («— expect N+») are ≤ the live file count.
 *   [4] MARKER-LIVE     Every Step 4.5 / 4.6 marker string is really present in the repo
 *                       source file that row names. verify.md itself flags this class
 *                       («that's list-drift, not a bad install») but nothing detected it.
 *   [5] HOOK-CLAIM      Every hook verify.md claims is «registered under <Event>» exists in
 *                       some hooks/<module>/manifest.yaml with that event type.
 *   [6] SKILL-FLOOR     Row 5's «скилл» prong. [3] already catches a REMOVED skill
 *                       (live < floor). [6] adds the other direction — the floor must not
 *                       LAG the repo (live > floor ⇒ a skill was ADDED and verify.md was not
 *                       updated) — plus the Step 9 summary echo of that same number.
 *                       ⚠ WEAK BY CONSTRUCTION: a count-preserving swap (one skill deleted,
 *                       another added) passes. The strong form needs a generated skill catalog
 *                       (à la gen-command-catalog.cjs) — deferred as DEF-CTX-5,
 *                       dev/tech-debt/CONTEXT_AUDIT_D6.md.
 *
 * ── Deploy mapping ──
 * verify.md describes the INSTALLED tree (`.claude/product/processes/`), the repo is the
 * SSOT (`product/processes/`). Mapping = strip the leading `.claude/` (the bootstrap deploy
 * contract). Encoded in repoPathOf(). Globs: `*` = this dir, `**` = recursive; `README.md`
 * is never counted as an inventory item.
 *
 * ── «ЧЕКЕР ОСЛЕП» ≠ ДРЕЙФ (the D4 law, applied here) ──
 * Every claim above is parsed out of the PROSE of verify.md. Restructure the document and the
 * parser stops finding its anchors. That is NOT evidence of inventory drift — it is evidence
 * that the checker can no longer see. A gate has no right to fail on what it cannot know
 * (same principle that stopped context-health.js from declaring 17 live commits «dead»).
 * ⇒ Two disjoint buckets:
 *     findings[] — a claim was parsed AND ground truth was established AND they disagree.
 *                  Only this gates (exit 1 under --strict).
 *     blind[]    — a claim could not be parsed, or ground truth could not be established.
 *                  Loud warning, NEVER gates — not even under --strict.
 * Blindness has TWO sources, and both are handled:
 *   · doc-side — the prose anchor is gone (verify.md restructured) ⇒ the parser is stale;
 *   · repo-side — the file/dir is not on disk, but `git ls-files` still tracks it ⇒ a cone-mode
 *     sparse/partial checkout. «Not on disk» ≠ «removed from the repo». Without this guard the
 *     linter emitted 12 confident «a file was REMOVED» findings against a sparse checkout where
 *     nothing had been removed at all — the exact fallacy this law exists to forbid.
 * An internal crash is the same class: a checker that threw knows nothing, so it screams and
 * exits 0 rather than asserting a drift it never measured.
 *
 * ── NOT covered (stated honestly, not faked) ──
 *   · SKILLS at ITEM granularity — see [6]: a floor, not a catalog. DEF-CTX-5.
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
 * ── Enforcement posture ──
 * STRICT, wired into `npm run verify` as `check:inventory:strict` (owner's flip, 2026-07-13).
 * Precision: 0 findings on HEAD ⇒ precision is NOT observable from HEAD and must be injected.
 * Measured on the warn-only version (7 defects: 7/7 caught, 0 FP) and RE-measured after this
 * rewrite, because a rewritten checker inherits no evidence from the one it replaced:
 *   · 8 drift injections (one per class, both floor directions) → 8/8 caught, exit 1 each;
 *   · 1 real filesystem probe (an actual 64th skill file dropped into skills/product/) → caught;
 *   · 1 unmodified control → silent, exit 0;
 *   · 3 restructured docs (partial / echo-only / total anchor loss) → BLIND, exit 0, no false drift;
 *   · 1 real cone-mode sparse checkout (skills/, product/, hooks/ tracked but not on disk)
 *     → BLIND, exit 0 (before the git-index guard: 12 false «REMOVED» findings, exit 1);
 *   · 1 forced crash (--verify-md=<a directory>) → screams, exit 0;
 *   · kill-switch verified on a run that WOULD have failed (a green toggle proves nothing).
 * A green verdict is printed ONLY when blind.length === 0 — «no drift in what I could see» is a
 * warning, never a ✓.
 *
 * Аварийный тумблер: INVENTORY_SYNC_STRICT=0 — снимает strict (по образцу CONTEXT_HEALTH_STRICT).
 * Гейт на общем ресурсе без выключателя однажды склинит чужой цикл.
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
const STRICT = argv.includes('--strict') && process.env.INVENTORY_SYNC_STRICT !== '0';
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
  process.exit(2); // input error (no such file) — distinct from "drift" and from "blind"
}

// `.claude/product/processes/` (installed) → `product/processes/` (repo SSOT)
function repoPathOf(installedPath) {
  return installedPath.replace(/^\.claude\//, '').replace(/^\/+/, '');
}

const isSkillsGlob = g => /(^|\/)skills\//.test(repoPathOf(g));

// Does git's INDEX know this path? «Not on disk» and «not in the repo» are different facts:
// a cone-mode sparse checkout omits whole directories that git still tracks. Calling that
// «a file was REMOVED» is the same fallacy as calling an unreachable commit «dead» — the
// search space is incomplete, so the negative result proves nothing. (D4 law, ground-truth side.)
function gitTracks(rel) {
  try {
    const out = execSync(`git ls-files -- "${rel}"`, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().length > 0;
  } catch (e) {
    return false; // no git / not a repo → cannot claim tracking either way
  }
}

// `skills/**/*.md` → `skills` ; `product/processes/*.mjs` → `product/processes`
function baseDirOf(glob) {
  const parts = repoPathOf(glob).split('/');
  const starAt = parts.findIndex(p => p.includes('*'));
  return (starAt === -1 ? parts.slice(0, -1) : parts.slice(0, starAt)).join('/');
}

// Glob-aware file count. `*` = this dir only, `**` = recursive. README.md is never an item.
// Returns null when the base dir does not exist (ground truth unestablished for that glob).
function countFiles(glob) {
  const rel = repoPathOf(glob);
  const parts = rel.split('/');
  const ext = path.extname(parts[parts.length - 1]).toLowerCase();
  const recursive = parts.includes('**');
  const absBase = path.join(ROOT, baseDirOf(glob));
  if (!fs.existsSync(absBase)) return null;

  let n = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (recursive) walk(path.join(dir, e.name)); continue; }
      if (!e.name.toLowerCase().endsWith(ext)) continue;
      if (e.name.toLowerCase() === 'readme.md') continue;
      n++;
    }
  };
  walk(absBase);
  return n;
}

// ─── Ground truth: the repo ──────────────────────────────────────────────────
// Each returns null when it cannot be established → the dependent class goes BLIND,
// it does NOT become drift. (Unestablished ground truth cannot prove a claim false.)

function liveNamespaces() {
  const abs = path.join(ROOT, 'commands');
  if (!fs.existsSync(abs)) return null;
  const dirs = fs.readdirSync(abs, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  return dirs.length ? dirs : null;
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
  return Object.keys(hooks).length ? hooks : null; // nothing parsed ⇒ manifest schema changed ⇒ blind
}

// ─── Claims: verify.md ───────────────────────────────────────────────────────

function backticked(s) {
  return [...s.matchAll(/`([^`]+)`/g)].map(m => m[1]);
}

// [1] «For each namespace (`ecosystem`, `integrator`, …)»
function claimedNamespaces(text) {
  const m = text.match(/For each namespace\s*\(([^)]*)\)/);
  if (!m) return null;
  const ns = backticked(m[1]).sort();
  return ns.length ? ns : null;
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

// [3]/[6] «- `.claude/product/processes/*.mjs` — expect 3+ (…)»
function claimedFloors(text) {
  const floors = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^-\s*`([^`]+)`\s*—\s*expect\s+(\d+)\+/);
    if (m) floors.push({ glob: m[1], floor: parseInt(m[2], 10) });
  }
  return floors;
}

// [6] Step 9 summary echo of the skills floor: «  ✓ skills/**:     63+»
function echoedSkillFloor(text) {
  const m = text.match(/^\s*[✓✗🟡]\s*skills\/\*\*:\s*(\d+)\+/m);
  return m ? parseInt(m[1], 10) : null;
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

  const findings = [];  // parsed claim + established ground truth + they disagree → GATES
  const blind = [];     // claim unparseable OR ground truth unestablished → NEVER gates
  const checked = { ns: 0, echo: 0, floors: 0, markers: 0, hooks: 0, skills: null };

  const live = liveNamespaces();
  const hooks = liveHooks();

  // [1] NAMESPACE-SET
  const claimedNs = claimedNamespaces(text);
  if (!claimedNs) {
    blind.push('[1] NAMESPACE-SET — the «For each namespace (…)» sentence (Step 4) did not parse');
  } else if (!live) {
    blind.push('[1] NAMESPACE-SET — ground truth unestablished: no commands/<ns>/ dirs found in the repo');
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
    blind.push('[2] NAMESPACE-ECHO — the COMMANDS block of the Step 9 summary did not parse');
  } else if (!live) {
    blind.push('[2] NAMESPACE-ECHO — ground truth unestablished: no commands/<ns>/ dirs found in the repo');
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

  // [3] FLOOR — every floor line: the repo must hold AT LEAST what verify.md promises.
  const floors = claimedFloors(text);
  if (floors.length === 0) {
    blind.push('[3] FLOOR — no «- `<glob>` — expect N+» lines parsed out of Step 4');
  }
  for (const { glob, floor } of floors) {
    const n = countFiles(glob);
    checked.floors++;
    if (n === null) {
      const base = baseDirOf(glob);
      if (gitTracks(base)) {
        // git tracks it, the worktree lacks it ⇒ sparse / partial checkout, NOT a deletion.
        blind.push(`[3] FLOOR — «${glob}»: git tracks ${base}/ but it is absent from the worktree (partial / sparse checkout) — the checker cannot see it, so it says nothing`);
      } else {
        findings.push(`[3] FLOOR — verify.md expects «${glob}» ≥ ${floor}, but repo dir ${base}/ does not exist (git tracks nothing there)`);
      }
      continue;
    }
    if (n < floor) {
      findings.push(`[3] FLOOR — verify.md expects «${glob}» ≥ ${floor}, but the repo has ${n} (a file was REMOVED and the floor was not lowered, or the floor over-claims)`);
    }
  }

  // [6] SKILL-FLOOR — Row 5's «скилл» prong (the other direction + the summary echo).
  const skillFloor = floors.find(f => isSkillsGlob(f.glob));
  if (!skillFloor) {
    blind.push('[6] SKILL-FLOOR — no skills floor line («- `.claude/skills/**/*.md` — expect N+») parsed out of Step 4');
  } else {
    const liveSkills = countFiles(skillFloor.glob);
    if (liveSkills === null) {
      const base = baseDirOf(skillFloor.glob);
      blind.push(`[6] SKILL-FLOOR — ground truth unestablished: ${base}/ is not on disk ` +
        `(${gitTracks(base) ? 'git tracks it — partial / sparse checkout' : 'git tracks nothing there'})`);
    } else {
      checked.skills = liveSkills;
      // A REMOVED skill is already caught by [3] (live < floor). Here: the floor must not LAG.
      if (liveSkills > skillFloor.floor) {
        findings.push(`[6] SKILL-FLOOR — the repo has ${liveSkills} skills (skills/**/*.md) but Step 4's floor still says ${skillFloor.floor}+ (a skill was ADDED and verify.md was not updated — CLAUDE.md «Process triggers» Row 5)`);
      }
      const echoFloor = echoedSkillFloor(text);
      if (echoFloor === null) {
        blind.push('[6] SKILL-FLOOR — the Step 9 summary echo («✓ skills/**: N+») did not parse');
      } else if (echoFloor !== skillFloor.floor) {
        findings.push(`[6] SKILL-FLOOR — Step 4 says ${skillFloor.floor}+ skills, the Step 9 summary says ${echoFloor}+ (Row 5 requires «Step 4 + summary» — both)`);
      }
    }
  }

  // [4] MARKER-LIVE
  const markers = claimedMarkers(text);
  if (markers.length === 0) {
    blind.push('[4] MARKER-LIVE — no Step 4.5/4.6 marker table rows parsed');
  }
  for (const { marker, file, dir } of markers) {
    checked.markers++;
    const rel = path.posix.join(repoPathOf(dir), file);
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      if (gitTracks(rel)) {
        blind.push(`[4] MARKER-LIVE — ${rel} is tracked by git but absent from the worktree (partial / sparse checkout) — «${marker}» cannot be verified from here`);
      } else {
        findings.push(`[4] MARKER-LIVE — verify.md spot-checks «${marker}» in ${dir}${file}, but the repo has no ${rel} (file renamed/removed → the check can never pass; git tracks nothing there)`);
      }
      continue;
    }
    if (!fs.readFileSync(abs, 'utf8').includes(marker)) {
      findings.push(`[4] MARKER-LIVE — verify.md claims «${marker}» is in ${rel}, but the repo source does NOT contain it (list-drift: the contract evolved, the marker table did not)`);
    }
  }

  // [5] HOOK-CLAIM
  const hookClaims = claimedHooks(text);
  if (hookClaims.length === 0) {
    blind.push('[5] HOOK-CLAIM — no «<hook>.js is registered under <Event>» lines parsed (Step 8.5)');
  } else if (!hooks) {
    blind.push('[5] HOOK-CLAIM — ground truth unestablished: nothing parsed out of hooks/*/manifest.yaml (schema changed?)');
  } else {
    for (const { file, events } of hookClaims) {
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
  }

  // ── report ────────────────────────────────────────────────────────────────
  const scope = `${checked.ns} namespaces · ${checked.echo} summary rows · ` +
    `${checked.floors} floors · ${checked.skills === null ? 'skills n/a' : checked.skills + ' skills'} · ` +
    `${checked.markers} markers · ${checked.hooks} hook claims`;

  // Blind goes to stderr — same stream as findings, so a mixed run stays ordered.
  if (blind.length) {
    const classes = new Set(blind.map(b => b.slice(0, 3))).size;
    process.stderr.write(`check-inventory-sync: ⚠ ЧЕКЕР ОСЛЕП — ${blind.length} проверк(а/и) НЕ выполнен(ы) ` +
      `(классы: ${classes}):\n\n`);
    for (const b of blind) process.stderr.write(`  ${b}\n`);
    process.stderr.write('\n  Это НЕ дрейф инвентаря — чекер не смог ПОСМОТРЕТЬ. Две причины:\n' +
      '    · изменилась структура verify.md ⇒ обнови парсер (dev/meta-improvement/scripts/check-inventory-sync.cjs);\n' +
      '    · ground truth недоступен отсюда (частичный / sparse checkout; сменилась схема манифеста).\n' +
      '  Отсутствие доказательства ≠ доказательство отсутствия ⇒ blind НИКОГДА не гейтит, даже под --strict.\n\n');
  }

  if (findings.length === 0) {
    if (blind.length) {
      // NOT a green. The checker found no drift IN WHAT IT COULD SEE — and it could not see
      // everything. Printing «✓ matches the repo» here would be the very costume this linter
      // exists to strip off: an unmeasured pass wearing a measured one's clothes.
      process.stderr.write(`check-inventory-sync: ⚠ дрейфа НЕ найдено В ТОМ, ЧТО УДАЛОСЬ ПРОВЕРИТЬ — ` +
        `но ${blind.length} проверк(а/и) не выполнен(ы) (см. выше). Это НЕ «✓ всё синхронно».\n`);
      process.stderr.write(`  scope: ${scope}\n`);
      return 0;
    }
    process.stdout.write(`check-inventory-sync: ✓ verify.md matches the repo — ${scope}.\n`);
    process.stdout.write('  (not covered: skills at item granularity — floor only, DEF-CTX-5; ' +
      'hooks beyond the LESSON-* pair; status.md overview templates. See the header.)\n');
    return 0;
  }

  process.stderr.write(`check-inventory-sync: ${STRICT ? '✗' : '⚠'} verify.md is STALE vs the repo — ${findings.length} finding(s):\n\n`);
  for (const f of findings) process.stderr.write(`  ${f}\n`);
  process.stderr.write(`\n  scope: ${scope}\n`);
  process.stderr.write('  Fix: update commands/ecosystem/verify.md (Step 4 + Step 9 summary) — ' +
    'CLAUDE.md «Process triggers» Row 5.\n');
  if (STRICT) {
    process.stderr.write('  Чужая незакрытая правка блокирует твой цикл? → INVENTORY_SYNC_STRICT=0 npm run verify\n');
  } else {
    process.stderr.write('  (warn-only — exit 0. Strict: --strict, wired as `npm run check:inventory:strict`.)\n');
  }
  return STRICT ? 1 : 0;
}

let code = 0;
try {
  code = main();
} catch (e) {
  // A checker that threw measured nothing. It may not assert a drift it never saw. Scream, don't gate.
  process.stderr.write(`check-inventory-sync: ⚠ ЧЕКЕР УПАЛ — ${e.message}\n`);
  process.stderr.write('  Это НЕ дрейф инвентаря: упавший чекер ничего не измерил ⇒ не гейтит (exit 0).\n');
  process.stderr.write('  Почини dev/meta-improvement/scripts/check-inventory-sync.cjs — иначе Row 5 не проверяется.\n');
  code = 0;
}
process.exit(code);
