#!/usr/bin/env node
/**
 * install-dev-hooks.cjs — installer for the ecosystem repo's OWN dev hooks
 * (DEF-CTX-4, dev/tech-debt/CONTEXT_AUDIT_D6.md).
 *
 * THE DEFECT. The dev hooks (SessionStart digests + PostToolUse reminders) were registered
 * ONLY in <repo>/.claude/settings.local.json — a GITIGNORED file. So they existed on exactly
 * one machine. A fresh clone, the VM, a worktree, CI: zero dev hooks, and no signal at all,
 * because the hooks are fail-safe — they fail by staying silent. Meanwhile the BLOCKING git
 * hooks had an installer (install-git-hooks.cjs, DEC-DEV-0157) and were delivered automatically.
 * Asymmetry: what blocks you is installed for you; what merely informs you is folklore.
 *
 * This is the missing twin. Same mechanics as install-git-hooks.cjs on purpose (repo-root
 * resolution, --best-effort under npm `prepare`, idempotency, backup-before-overwrite).
 *
 * Entry points:
 *   - npm "prepare" → runs on every `npm install` / `npm ci`, with --best-effort:
 *     NEVER fails the install (no git / no manifest / unreadable settings → warn, exit 0)
 *   - manual strict: node dev/meta-improvement/scripts/install-dev-hooks.cjs
 *   - drift gate:    node dev/meta-improvement/scripts/install-dev-hooks.cjs --check
 *                    (wired as `npm run check:devhooks`, inside `npm run verify`)
 *
 * ── SOURCE OF TRUTH ─────────────────────────────────────────────────────────────────────
 * dev/meta-improvement/hooks/dev-hooks.manifest.json — NOT a list hardcoded here.
 *
 * Why a manifest and not "derive it from the hook files' headers": the headers DO name their
 * events, but in bilingual free prose («Triggers: PostToolUse on Bash…» / «SessionStart hook
 * (…)»), and prose is the channel this repo has already been burned by (a checker that reads
 * prose goes blind the moment prose is reworded — see check-inventory-sync.cjs «ЧЕКЕР ОСЛЕП»).
 * Two failures would be silent: reword a header → the hook quietly stops being installed; and
 * — live counter-example — session-audit.js says «SessionEnd hook» in its header but is
 * deliberately NOT wired from this repo (it is registered from the pilot project). A
 * prose-deriving installer would have switched it on everywhere. Headers describe what a hook
 * IS; only a manifest can state whether it is WIRED, under which matcher, with which guard.
 *
 * The manifest's own failure mode (it silently lags a newly added hook file — exactly the
 * drift class this whole fix exists to kill) is neutralised, not tolerated: crossCheck()
 * compares the manifest against the actual *.js on disk in BOTH directions, and --check gates
 * `npm run verify` on it. Adding a hook file without declaring it → red build, not silence.
 *
 * ── MERGE CONTRACT (wipe-protection is a contract, not an option) ───────────────────────
 * settings.local.json is a USER file (permissions, third-party hooks, experiment flags).
 * We touch NOTHING but the ecosystem-owned hook entries, identified by their command
 * containing `dev/meta-improvement/hooks/`:
 *   1. prune every ecosystem-owned entry, then 2. re-emit from the manifest.
 * Everything else — other top-level keys, other events, third-party entries inside the very
 * same event group — is preserved verbatim, in place. This is the `update.md` Step 6
 * "re-derive" semantics (NOT bootstrap's additive union, which cannot prune: see DEF-CTX-3),
 * so removing a hook from the manifest actually removes it, and re-running never duplicates.
 *
 * Idempotent BY CONSTRUCTION, not by claim: the result is compared with the file as parsed;
 * if nothing would change, the file is not written at all (mtime untouched).
 *
 * ── WHAT --check DOES NOT GATE ON (stated, not faked) ───────────────────────────────────
 * --check validates the manifest against the repo. It does NOT gate on the contents of
 * .claude/settings.local.json: that file is gitignored, per-machine, and reconciled by
 * `npm install`. A gate has no right to fail on state it cannot know or share.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARGV = process.argv.slice(2);
const BEST_EFFORT = ARGV.includes('--best-effort');
const CHECK = ARGV.includes('--check');

const HOOKS_REL = 'dev/meta-improvement/hooks/';
const MANIFEST_REL = `${HOOKS_REL}dev-hooks.manifest.json`;

const say = (m) => process.stdout.write(`install-dev-hooks: ${m}\n`);
const warn = (m) => process.stderr.write(`install-dev-hooks: ${m}\n`);

/** Cannot proceed. Under `prepare` (--best-effort) this must never fail the install. */
function bail(msg) {
  warn(msg);
  process.exit(BEST_EFFORT ? 0 : 1);
}

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8', cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    return null;
  }
}

/** The command string a hook entry gets. The ONLY place a command is minted. */
function commandFor(hook) {
  const p = `${HOOKS_REL}${hook.file}`;
  return hook.guard === 'exists'
    ? `[ -f ${p} ] && node ${p} || true`
    : `node ${p}`;
}

const isOwned = (cmd) => typeof cmd === 'string' && cmd.includes(HOOKS_REL);
const sameMatcher = (a, b) => (a || '') === (b || '');

function loadManifest(root) {
  const abs = path.join(root, MANIFEST_REL);
  if (!fs.existsSync(abs)) return bail(`manifest missing: ${MANIFEST_REL} — cannot know which hooks to install`);
  let m;
  try {
    m = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    return bail(`manifest is not valid JSON (${MANIFEST_REL}): ${e.message}`);
  }
  if (!m || !Array.isArray(m.hooks)) return bail(`manifest has no "hooks" array (${MANIFEST_REL})`);
  for (const h of m.hooks) {
    if (!h || typeof h.file !== 'string' || typeof h.event !== 'string') {
      return bail(`manifest entry needs at least {file, event}: ${JSON.stringify(h)}`);
    }
    if (h.register === false && !h.why) {
      return bail(`manifest entry "${h.file}" has register:false but no "why" — an undeclared omission is how DEF-CTX-4 happened`);
    }
  }
  return m;
}

/**
 * Manifest ⟷ disk, BOTH directions. This is the anti-drift mechanism: without it the manifest
 * is just a second place to forget.
 *
 * «Не вижу ⇒ мертво» is forbidden (the D4 law): if the hooks DIR itself is absent we are in a
 * sparse/partial checkout and know nothing — say so and claim no drift.
 */
function crossCheck(root, manifest) {
  const dir = path.join(root, HOOKS_REL);
  if (!fs.existsSync(dir)) {
    return { blind: `${HOOKS_REL} is not on disk (sparse / partial checkout?) — cannot compare, claiming nothing`, problems: [] };
  }
  const onDisk = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const declared = manifest.hooks.map((h) => h.file);
  const problems = [];

  for (const f of onDisk) {
    if (!declared.includes(f)) {
      problems.push(
        `hook file NOT declared: ${HOOKS_REL}${f} — add it to ${MANIFEST_REL} ` +
        '(register:true to wire it, or register:false + "why" to record that it is deliberately not wired). ' +
        'An undeclared hook file is a hook that exists on your machine and nowhere else — that IS DEF-CTX-4.'
      );
    }
  }
  for (const f of declared) {
    if (!onDisk.includes(f)) {
      problems.push(`manifest declares ${HOOKS_REL}${f}, but no such file is on disk — remove the entry or restore the file`);
    }
  }
  return { blind: null, problems };
}

/** Desired ecosystem-owned groups, in manifest order. */
function desiredGroups(manifest) {
  const groups = new Map(); // `${event}\u0000${matcher}` → {event, matcher, hooks:[]}
  for (const h of manifest.hooks) {
    if (h.register === false) continue;
    const key = `${h.event}\u0000${h.matcher || ''}`;
    if (!groups.has(key)) groups.set(key, { event: h.event, matcher: h.matcher, hooks: [] });
    groups.get(key).hooks.push({ type: 'command', command: commandFor(h) });
  }
  return [...groups.values()];
}

/** Prune-then-re-emit, in place. Mutates `settings`. Everything not ecosystem-owned survives verbatim. */
function applyTo(settings, desired) {
  if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) settings.hooks = {};
  const events = new Set([...Object.keys(settings.hooks), ...desired.map((d) => d.event)]);

  for (const event of events) {
    const groups = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];

    // 1. prune — every ecosystem-owned entry, wherever it sits. («gone from the manifest ⇒ gone from settings»)
    for (const g of groups) {
      if (g && Array.isArray(g.hooks)) g.hooks = g.hooks.filter((h) => !isOwned(h && h.command));
    }

    // 2. re-emit — into the group with the matching matcher, appended AFTER any surviving third-party entries.
    for (const d of desired.filter((x) => x.event === event)) {
      let g = groups.find((x) => x && Array.isArray(x.hooks) && sameMatcher(x.matcher, d.matcher));
      if (!g) {
        g = d.matcher ? { matcher: d.matcher, hooks: [] } : { hooks: [] };
        groups.push(g);
      }
      g.hooks.push(...d.hooks.map((h) => ({ ...h })));
    }

    // 3. drop groups the prune emptied (a hook removed from the manifest must leave no husk behind).
    const kept = groups.filter((g) => g && Array.isArray(g.hooks) && g.hooks.length > 0);
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return settings;
}

function main() {
  const root = repoRoot();
  if (!root) return bail('not inside a git repo (tarball install?) — skipping dev-hook install');

  const manifest = loadManifest(root);
  const { blind, problems } = crossCheck(root, manifest);

  if (blind) warn(`⚠ ${blind}`);

  if (problems.length) {
    warn(`✗ manifest is OUT OF SYNC with ${HOOKS_REL} — ${problems.length} problem(s):\n`);
    for (const p of problems) warn(`  · ${p}`);
    warn('');
    // Under --check this GATES. Under `prepare` it must not break the install: shout, then
    // install what is still installable (a broken manifest entry must not cost you the other hooks).
    if (CHECK || !BEST_EFFORT) process.exit(1);
  } else if (CHECK) {
    const wired = manifest.hooks.filter((h) => h.register !== false).length;
    const declined = manifest.hooks.length - wired;
    say(`✓ ${MANIFEST_REL} matches ${HOOKS_REL} — ${manifest.hooks.length} hook file(s): ${wired} wired, ${declined} deliberately not wired.`);
    say('  (does NOT check .claude/settings.local.json — gitignored, per-machine, reconciled by `npm install`.)');
    return;
  }

  if (CHECK) return; // problems were reported above; exit(1) already happened

  // Skip hooks whose file vanished — never register a command pointing at nothing.
  const installable = {
    ...manifest,
    hooks: manifest.hooks.filter((h) => fs.existsSync(path.join(root, HOOKS_REL, h.file))),
  };
  const desired = desiredGroups(installable);
  if (!desired.length) return bail('manifest wires no hooks — nothing to install');

  const target = path.join(root, '.claude', 'settings.local.json');
  let raw = null;
  if (fs.existsSync(target)) {
    try {
      raw = fs.readFileSync(target, 'utf8');
    } catch (e) {
      return bail(`cannot read ${target}: ${e.message}`);
    }
  }

  let before;
  if (raw === null) {
    before = {};
  } else {
    try {
      before = JSON.parse(raw);
    } catch (e) {
      // Do NOT overwrite a file we failed to understand — that is how user state gets wiped.
      return bail(`${target} exists but is not valid JSON (${e.message}) — refusing to touch it. Fix it by hand, then re-run.`);
    }
    if (!before || typeof before !== 'object' || Array.isArray(before)) {
      return bail(`${target} is not a JSON object — refusing to touch it`);
    }
  }

  const after = applyTo(JSON.parse(JSON.stringify(before)), desired);

  if (raw !== null && JSON.stringify(before) === JSON.stringify(after)) {
    say(`${desired.reduce((n, g) => n + g.hooks.length, 0)} dev hook(s) already registered in .claude/settings.local.json — no changes needed (file untouched)`);
    say('done — no-op.');
    return;
  }

  // Delta, before we write: say what actually changes rather than "installed ✓".
  const cmds = (o) => {
    const out = [];
    for (const [event, groups] of Object.entries((o && o.hooks) || {})) {
      for (const g of groups || []) for (const h of (g && g.hooks) || []) if (isOwned(h.command)) out.push(`${event}: ${h.command}`);
    }
    return out;
  };
  const wasOwned = cmds(before);
  const nowOwned = cmds(after);
  const added = nowOwned.filter((c) => !wasOwned.includes(c));
  const removed = wasOwned.filter((c) => !nowOwned.includes(c));

  if (raw !== null) {
    const backup = `${target}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(target, backup);
    say(`existing settings.local.json backed up to ${path.basename(backup)}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(after, null, 2)}\n`, 'utf8');

  say(`${raw === null ? 'created' : 'updated'} .claude/settings.local.json`);
  for (const c of added) say(`  + ${c}`);
  for (const c of removed) say(`  - ${c}   (no longer in the manifest)`);
  const untouched = Object.keys(before).filter((k) => k !== 'hooks');
  say(`preserved verbatim: ${untouched.length ? untouched.join(', ') : '(nothing else in the file)'}` +
      ' — plus any non-ecosystem hook entries.');
  say('done — dev hooks (SessionStart digests + PostToolUse reminders) are wired for THIS checkout.');
}

try {
  main();
} catch (e) {
  // A crashed installer knows nothing and must not cost anyone their `npm install`.
  warn(`⚠ CRASHED — ${e.message}`);
  warn('  Dev hooks may be missing in this checkout. Re-run manually: node dev/meta-improvement/scripts/install-dev-hooks.cjs');
  process.exit(BEST_EFFORT ? 0 : 1);
}
