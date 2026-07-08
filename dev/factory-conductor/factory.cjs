#!/usr/bin/env node
/**
 * factory.cjs — the Factory Conductor "console": orchestrate several PARALLEL,
 * interactive Claude Code sessions on a Linux VM through tmux (design approved
 * 2026-07-08, see memory "Factory Conductor initiative").
 *
 * WHY THIS EXISTS:
 *   The Orchestrator drives HEADLESS Workflow agents; it has no handle on the
 *   other half of the factory — the human-in-the-loop, long-lived `claude`
 *   TUI sessions a solo dev fans out across a VM. This CLI is the durable
 *   dispatcher pane for those: each "lane" = one detached tmux session
 *   (`cf-<lane>`) running `claude` in its own git worktree, with Claude Code
 *   hooks wired so the lane self-reports session-id / busy / idle to disk. From
 *   one console you spawn / send-prompt / peek / status / harvest / stop lanes,
 *   and every lane's lifecycle is stitched into the run-ledger for observability.
 *
 *   There is NO LLM in here — pure mechanics over tmux + git + the filesystem.
 *   It runs ON the Ubuntu VM (Linux paths, HOME from the environment); it is not
 *   meant to run on Windows (no tmux).
 *
 * DETERMINISM NOTE (so a future reader does not "fix" it): unlike the resumable
 *   Workflow bodies, this is a DISPATCHER-side CLI — the Workflow determinism
 *   contract (never read the wall clock) does NOT apply here; `Date.now()` /
 *   `new Date()` are used freely and intentionally for timestamps and ids.
 *
 * EXIT CODES: 0 ok · 2 usage / environment / internal error.
 * Dual-use: require() it for the pure helpers, or run it as a CLI.
 * Node stdlib only (fs, path, child_process, os).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const os = require('os');

// ---------------------------------------------------------------------------
// Constants & state layout
// ---------------------------------------------------------------------------

const HOME = process.env.HOME || os.homedir();
const FACTORY_ROOT = process.env.FACTORY_ROOT || path.join(HOME, '.factory');
const LANE_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;

function lanesDir() { return path.join(FACTORY_ROOT, 'lanes'); }
function laneRoot(lane) { return path.join(lanesDir(), lane); }
function metaPath(lane) { return path.join(laneRoot(lane), 'meta.json'); }
function settingsPath(lane) { return path.join(laneRoot(lane), 'settings.json'); }
function sessionName(lane) { return `cf-${lane}`; }
function worktreePath(lane) { return path.join(HOME, 'projects', 'lanes', lane); }

// run-ledger integration ----------------------------------------------------
function ledgerBaseRoot() { return path.join(FACTORY_ROOT, 'runs'); }
function fallbackLedgerPath() { return path.join(FACTORY_ROOT, 'ledger.ndjson'); }

function loadLedgerModule() {
  const p = process.env.FACTORY_RUN_LEDGER
    || path.join(HOME, 'projects', 'claude-ecosystem-3.0', 'orchestrator', 'lib', 'run-ledger.cjs');
  try { return require(p); } catch (_e) { return null; }
}

function appendFallbackLedger(entry) {
  try {
    fs.mkdirSync(path.dirname(fallbackLedgerPath()), { recursive: true });
    fs.appendFileSync(fallbackLedgerPath(), JSON.stringify(entry) + '\n');
  } catch (_e) { /* ledger is best-effort */ }
}

// Start a ledger run; returns a run_id string (module or fallback).
function ledgerStart(lane, repo, branch) {
  const iso = new Date().toISOString();
  const mod = loadLedgerModule();
  if (mod && typeof mod.startRun === 'function') {
    try {
      const r = mod.startRun({
        process: `lane-${lane}`,
        iso,
        argsSummary: `${repo} ${branch}`,
        baseRoot: ledgerBaseRoot(),
      });
      if (r && r.runId) return r.runId;
    } catch (_e) { /* fall through */ }
  }
  const runId = `${lane}-${Date.now().toString(36)}`;
  appendFallbackLedger({ run_id: runId, event: 'start', process: `lane-${lane}`, at: iso, args: `${repo} ${branch}` });
  return runId;
}

// Finish a ledger run at most once per lane (guarded by meta.ledger_finished).
function ledgerFinish(lane, resultKind, counts) {
  const meta = readMeta(lane);
  if (!meta || meta.ledger_finished) return;
  const iso = new Date().toISOString();
  const mod = loadLedgerModule();
  let done = false;
  if (mod && typeof mod.finishRun === 'function' && meta.run_id) {
    try {
      mod.finishRun({
        runId: meta.run_id,
        iso,
        result: { result: resultKind, counts: counts || {} },
        baseRoot: ledgerBaseRoot(),
      });
      done = true;
    } catch (_e) { /* fall through */ }
  }
  if (!done) {
    appendFallbackLedger({ run_id: meta.run_id, event: 'finish', at: iso, result: resultKind, counts: counts || {} });
  }
  meta.ledger_finished = true;
  writeMeta(lane, meta);
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function die(msg) { process.stderr.write(`ERROR: ${msg}\n`); process.exit(2); }
function warn(msg) { process.stderr.write(`WARN: ${msg}\n`); }

// Run an external command WITHOUT a shell. Never throws — returns a result.
function run(cmd, args, opts) {
  try {
    const stdout = child_process.execFileSync(cmd, args || [], Object.assign({ encoding: 'utf8' }, opts || {}));
    return { ok: true, stdout: stdout || '', stderr: '', code: 0 };
  } catch (e) {
    return {
      ok: false,
      stdout: e.stdout != null ? String(e.stdout) : '',
      stderr: e.stderr != null ? String(e.stderr) : (e.message || ''),
      code: typeof e.status === 'number' ? e.status : 1,
      enoent: e.code === 'ENOENT',
    };
  }
}

// Synchronous sleep in seconds (dispatcher-side; blocking is fine here).
function sleepSync(seconds) { run('sleep', [String(seconds)]); }

function ensureTmux() {
  const r = run('tmux', ['-V'], { stdio: 'pipe' });
  if (r.enoent) die('tmux not found on PATH — this console requires tmux (run it on the Linux VM).');
}

function ensureGit() {
  const r = run('git', ['--version'], { stdio: 'pipe' });
  if (r.enoent) die('git not found on PATH.');
}

function validateLane(lane) {
  if (!lane) die('lane name required');
  if (!LANE_RE.test(lane)) die(`invalid lane "${lane}" — must match [a-z0-9][a-z0-9-]{0,30}`);
  return lane;
}

function tmuxHasSession(lane) {
  const r = run('tmux', ['has-session', '-t', sessionName(lane)], { stdio: 'pipe' });
  return r.ok;
}

function readMeta(lane) {
  try { return JSON.parse(fs.readFileSync(metaPath(lane), 'utf8')); } catch (_e) { return null; }
}
function writeMeta(lane, meta) {
  fs.mkdirSync(laneRoot(lane), { recursive: true });
  fs.writeFileSync(metaPath(lane), JSON.stringify(meta, null, 2) + '\n');
}

function listLaneNames() {
  try {
    return fs.readdirSync(lanesDir(), { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(metaPath(d.name)))
      .map((d) => d.name)
      .sort();
  } catch (_e) { return []; }
}

// Pointer text sent to a lane when a brief file is delivered.
const BRIEF_POINTER = 'Прочитай файл FACTORY-BRIEF.md в корне рабочей директории и выполни описанную там задачу.';

// ---------------------------------------------------------------------------
// settings.json hook generation
// ---------------------------------------------------------------------------

// Build the lane's Claude Code settings.json object. The only interpolated
// value is laneDir (an absolute path under FACTORY_ROOT). It is embedded inside
// a single-quoted `bash -c '...'` payload; the path is wrapped in DOUBLE quotes
// (see DEVIATION note in the header of the returned summary) so any space in
// FACTORY_ROOT stays safe without breaking the outer single-quote.
function buildSettings(laneDir) {
  const q = `"${laneDir}"`;
  const sessionStart = `bash -c 'mkdir -p ${q}; jq -r .session_id > ${q}/session_id 2>/dev/null; date -Is > ${q}/started'`;
  const userPrompt = `bash -c 'rm -f ${q}/idle'`;
  const stop = `bash -c 'date -Is > ${q}/idle'`;
  return {
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: sessionStart }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: userPrompt }] }],
      Stop: [{ hooks: [{ type: 'command', command: stop }] }],
    },
  };
}

// ---------------------------------------------------------------------------
// worktree pre-trust
// ---------------------------------------------------------------------------

// A fresh worktree is an unknown directory to Claude Code — without this the
// TUI blocks on the folder-trust dialog and SessionStart never fires (observed
// live 2026-07-08). Pre-mark the worktree trusted in ~/.claude.json. Known
// race: a claude running in another lane may rewrite ~/.claude.json over this
// patch — the window is tiny (we write right before launch); if the dialog
// still appears, the operator confirms with `tmux send-keys -t cf-<lane> Enter`.
function preTrustWorktree(wt) {
  const cfgPath = path.join(HOME, '.claude.json');
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (_e) {
    warn(`cannot read/parse ${cfgPath} — skipping worktree pre-trust (trust dialog may appear)`);
    return false;
  }
  if (!cfg.projects || typeof cfg.projects !== 'object') cfg.projects = {};
  if (!cfg.projects[wt] || typeof cfg.projects[wt] !== 'object') cfg.projects[wt] = {};
  cfg.projects[wt].hasTrustDialogAccepted = true;
  cfg.projects[wt].hasCompletedProjectOnboarding = true;
  try {
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    return true;
  } catch (_e) {
    warn(`cannot write ${cfgPath} — skipping worktree pre-trust`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// send mechanics (shared by spawn's auto-prompt and the `send` command)
// ---------------------------------------------------------------------------

// Type text into the lane's TUI and submit it (literal keys, then Enter).
function sendToLane(lane, text) {
  const sess = sessionName(lane);
  try { fs.rmSync(path.join(laneRoot(lane), 'idle'), { force: true }); } catch (_e) { /* ignore */ }
  const r1 = run('tmux', ['send-keys', '-t', sess, '-l', '--', text], { stdio: 'pipe' });
  if (!r1.ok) { warn(`send-keys (text) failed: ${r1.stderr.trim()}`); return false; }
  sleepSync(0.3);
  const r2 = run('tmux', ['send-keys', '-t', sess, 'Enter'], { stdio: 'pipe' });
  if (!r2.ok) { warn(`send-keys (Enter) failed: ${r2.stderr.trim()}`); return false; }
  return true;
}

// Wait until `file` exists, polling. Returns true if it appeared in time.
function waitForFile(file, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  const step = (intervalMs || 500) / 1000;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return true;
    sleepSync(step);
  }
  return fs.existsSync(file);
}

// ---------------------------------------------------------------------------
// harvest core (git + transcript capture, NO ledger side-effect)
// ---------------------------------------------------------------------------

// Capture scrollback + git snapshot for a lane. Returns { txt, json, commits_count, dirty_count }.
function doHarvest(lane, meta) {
  const ts = Date.now();
  const dir = laneRoot(lane);
  fs.mkdirSync(dir, { recursive: true });
  const sess = sessionName(lane);
  const baseSha = meta && meta.base_sha ? meta.base_sha : null;
  const wt = meta && meta.worktree ? meta.worktree : worktreePath(lane);

  // 1. Full scrollback transcript (best-effort; skip if session is dead).
  let txtPath = null;
  if (tmuxHasSession(lane)) {
    const cap = run('tmux', ['capture-pane', '-p', '-t', sess, '-S', '-'], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
    if (cap.ok) {
      txtPath = path.join(dir, `harvest-${ts}.txt`);
      fs.writeFileSync(txtPath, cap.stdout);
    } else {
      warn(`capture-pane failed for ${lane}: ${cap.stderr.trim()}`);
    }
  } else {
    warn(`tmux session ${sess} not alive — skipping transcript capture`);
  }

  // 2. Git snapshot (all best-effort).
  let commits = [];
  let dirtyLines = [];
  let diffstat = '';
  if (baseSha) {
    const logR = run('git', ['-C', wt, 'log', '--oneline', `${baseSha}..HEAD`], { stdio: 'pipe' });
    if (logR.ok) commits = logR.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
    const stR = run('git', ['-C', wt, 'status', '--porcelain'], { stdio: 'pipe' });
    if (stR.ok) dirtyLines = stR.stdout.split('\n').filter((l) => l.length > 0);
    const dsR = run('git', ['-C', wt, 'diff', '--stat', baseSha], { stdio: 'pipe' });
    if (dsR.ok) diffstat = dsR.stdout;
  } else {
    warn(`no base_sha in meta for ${lane} — git snapshot skipped`);
  }

  // 3. Structured harvest record.
  const jsonPath = path.join(dir, `harvest-${ts}.json`);
  const record = {
    lane,
    at: new Date(ts).toISOString(),
    commits,
    commits_count: commits.length,
    dirty_count: dirtyLines.length,
    diffstat,
    transcript: txtPath,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2) + '\n');
  return { txt: txtPath, json: jsonPath, commits_count: commits.length, dirty_count: dirtyLines.length, record };
}

function hasAnyHarvest(lane) {
  try {
    return fs.readdirSync(laneRoot(lane)).some((f) => /^harvest-\d+\.json$/.test(f));
  } catch (_e) { return false; }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdSpawn(lane, a) {
  validateLane(lane);
  ensureTmux();
  ensureGit();

  // 1. Refuse if already live.
  if (tmuxHasSession(lane)) die(`tmux session ${sessionName(lane)} already alive`);
  const existing = readMeta(lane);
  if (existing && !existing.stopped_at) die(`lane "${lane}" already active (meta.json without stopped_at)`);

  // 2. Resolve repo.
  if (!a.repo) die('spawn needs --repo <path>');
  const repo = path.resolve(a.repo);
  if (!fs.existsSync(path.join(repo, '.git'))) die(`no .git under repo "${repo}"`);

  // 3. Worktree.
  const wt = worktreePath(lane);
  if (fs.existsSync(wt)) die(`worktree path already exists: ${wt}`);
  fs.mkdirSync(path.dirname(wt), { recursive: true });
  const baseRef = a.base || 'HEAD';
  const addR = run('git', ['-C', repo, 'worktree', 'add', wt, '-b', `lane/${lane}`, baseRef], { stdio: 'pipe' });
  if (!addR.ok) die(`git worktree add failed: ${addR.stderr.trim()}`);
  const shaR = run('git', ['-C', repo, 'rev-parse', baseRef], { stdio: 'pipe' });
  const baseSha = shaR.ok ? shaR.stdout.trim() : null;

  // 4. G23 compensation — install repo pre-commit hooks into the worktree.
  if (!a.noHooksInstall) {
    const installScript = path.join(repo, 'dev', 'meta-improvement', 'scripts', 'install-pre-commit.sh');
    if (fs.existsSync(installScript)) {
      const ins = run('bash', [installScript], { cwd: wt, stdio: 'pipe' });
      if (!ins.ok) warn(`install-pre-commit.sh failed (non-fatal): ${ins.stderr.trim()}`);
    }
  }

  // 5. Lane settings.json with self-reporting hooks. Stale markers from a
  // previous life of this lane name would fool the `started` wait below —
  // clear them before the new session boots.
  const laneDir = laneRoot(lane);
  fs.mkdirSync(laneDir, { recursive: true });
  for (const marker of ['started', 'idle', 'session_id']) {
    try { fs.rmSync(path.join(laneDir, marker), { force: true }); } catch (_e) { /* ignore */ }
  }
  const settings = buildSettings(laneDir);
  fs.writeFileSync(settingsPath(lane), JSON.stringify(settings, null, 2) + '\n');

  // 6. Optional brief file → worktree/FACTORY-BRIEF.md (not committed).
  let briefDelivered = false;
  if (a.brief) {
    if (!fs.existsSync(a.brief)) die(`--brief file not found: ${a.brief}`);
    fs.copyFileSync(a.brief, path.join(wt, 'FACTORY-BRIEF.md'));
    briefDelivered = true;
  }

  // 7. Pre-trust the worktree so the TUI does not block on the trust dialog.
  preTrustWorktree(wt);

  // 8. Launch the detached tmux session running claude, keeping the pane alive.
  const shellCmd = `bash -lc '~/.local/bin/claude --dangerously-skip-permissions --settings "${settingsPath(lane)}"; exec bash'`;
  const newR = run('tmux', ['new-session', '-d', '-s', sessionName(lane), '-c', wt, shellCmd], { stdio: 'pipe' });
  if (!newR.ok) die(`tmux new-session failed: ${newR.stderr.trim()}`);

  // 9. meta.json + ledger start.
  const runId = ledgerStart(lane, repo, `lane/${lane}`);
  const meta = {
    lane,
    repo,
    worktree: wt,
    branch: `lane/${lane}`,
    base_ref: baseRef,
    base_sha: baseSha,
    created_at: new Date().toISOString(),
    run_id: runId,
    stopped_at: null,
  };
  writeMeta(lane, meta);

  // 10. Auto-prompt if requested (wait for the SessionStart marker first).
  const wantsSend = a.prompt || briefDelivered;
  if (wantsSend) {
    const startedFile = path.join(laneDir, 'started');
    const ready = waitForFile(startedFile, 90000, 500);
    if (!ready) {
      warn('lane did not signal `started` within 90s — skipping auto-prompt (send manually)');
    } else {
      sleepSync(2);
      const text = a.prompt ? a.prompt : BRIEF_POINTER;
      const flat = text.indexOf('\n') >= 0 ? text.replace(/\n/g, ' ') : text;
      if (flat !== text) warn('prompt contained newlines — flattened to a single line (TUI submits on Enter)');
      sendToLane(lane, flat);
    }
  }

  // 11. Summary.
  process.stdout.write([
    `spawned lane "${lane}"`,
    `  worktree : ${wt}`,
    `  branch   : lane/${lane}`,
    `  tmux     : ${sessionName(lane)}`,
    `  run_id   : ${runId}`,
    `  base_sha : ${baseSha || '?'}`,
  ].join('\n') + '\n');
}

function cmdSend(lane, a) {
  validateLane(lane);
  ensureTmux();
  if (!tmuxHasSession(lane)) die(`tmux session ${sessionName(lane)} not alive`);

  let text;
  if (a.file) {
    if (!fs.existsSync(a.file)) die(`--file not found: ${a.file}`);
    const meta = readMeta(lane);
    const wt = meta && meta.worktree ? meta.worktree : worktreePath(lane);
    fs.copyFileSync(a.file, path.join(wt, 'FACTORY-BRIEF.md'));
    text = BRIEF_POINTER;
  } else if (a.text != null) {
    text = a.text;
    if (text.indexOf('\n') >= 0) {
      warn('text contained newlines — flattened to a single line (TUI submits on Enter)');
      text = text.replace(/\n/g, ' ');
    }
  } else {
    die('send needs --text "<text>" or --file <path>');
  }

  if (sendToLane(lane, text)) process.stdout.write(`sent to ${sessionName(lane)}\n`);
  else process.exit(2);
}

function cmdPeek(lane, a) {
  validateLane(lane);
  ensureTmux();
  if (!tmuxHasSession(lane)) die(`tmux session ${sessionName(lane)} not alive`);
  const lines = a.n && /^\d+$/.test(String(a.n)) ? String(a.n) : '40';
  const r = run('tmux', ['capture-pane', '-p', '-t', sessionName(lane), '-S', `-${lines}`], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
  if (!r.ok) die(`capture-pane failed: ${r.stderr.trim()}`);
  process.stdout.write(r.stdout);
}

function laneState(lane, meta) {
  if (meta && meta.stopped_at) return 'stopped';
  if (!tmuxHasSession(lane)) return meta ? 'dead' : 'unknown';
  if (fs.existsSync(path.join(laneRoot(lane), 'idle'))) return 'idle';
  return 'busy';
}

function lastActivity(lane) {
  let newest = 0;
  for (const marker of ['idle', 'started']) {
    const f = path.join(laneRoot(lane), marker);
    try {
      const st = fs.statSync(f);
      if (st.mtimeMs > newest) newest = st.mtimeMs;
    } catch (_e) { /* absent */ }
  }
  return newest ? new Date(newest).toISOString() : '-';
}

function laneStatusRow(lane) {
  const meta = readMeta(lane);
  const wt = meta && meta.worktree ? meta.worktree : worktreePath(lane);
  const baseSha = meta && meta.base_sha ? meta.base_sha : null;
  const state = laneState(lane, meta);
  const branch = meta && meta.branch ? meta.branch : `lane/${lane}`;

  let ahead = '?';
  if (baseSha) {
    const r = run('git', ['-C', wt, 'rev-list', '--count', `${baseSha}..HEAD`], { stdio: 'pipe' });
    if (r.ok) ahead = r.stdout.trim();
  }
  let dirty = '?';
  const stR = run('git', ['-C', wt, 'status', '--porcelain'], { stdio: 'pipe' });
  if (stR.ok) dirty = String(stR.stdout.split('\n').filter((l) => l.length > 0).length);

  return { lane, state, branch, ahead, dirty, last_activity: lastActivity(lane) };
}

function cmdStatus(lane, a) {
  ensureTmux();
  const lanes = lane ? [validateLane(lane)] : listLaneNames();
  if (lane && !fs.existsSync(metaPath(lane))) die(`no such lane "${lane}"`);
  const rows = lanes.map(laneStatusRow);

  if (a.json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }

  const headers = { lane: 'LANE', state: 'STATE', branch: 'BRANCH', ahead: 'AHEAD', dirty: 'DIRTY', last_activity: 'LAST_ACTIVITY' };
  const cols = ['lane', 'state', 'branch', 'ahead', 'dirty', 'last_activity'];
  const widths = {};
  for (const c of cols) {
    widths[c] = headers[c].length;
    for (const r of rows) widths[c] = Math.max(widths[c], String(r[c]).length);
  }
  const fmt = (r) => cols.map((c) => String(r[c]).padEnd(widths[c])).join('  ').replace(/\s+$/, '');
  process.stdout.write(fmt(headers) + '\n');
  if (rows.length === 0) { process.stdout.write('(no lanes)\n'); return; }
  for (const r of rows) process.stdout.write(fmt(r) + '\n');
}

function cmdHarvest(lane) {
  validateLane(lane);
  ensureTmux();
  ensureGit();
  const meta = readMeta(lane);
  if (!meta) die(`no such lane "${lane}"`);
  const h = doHarvest(lane, meta);
  ledgerFinish(lane, 'harvested', { commits: h.commits_count, dirty: h.dirty_count });
  process.stdout.write([
    `harvested lane "${lane}"`,
    `  commits   : ${h.commits_count}`,
    `  dirty     : ${h.dirty_count}`,
    `  transcript: ${h.txt || '(none — session dead)'}`,
    `  record    : ${h.json}`,
  ].join('\n') + '\n');
}

function cmdStop(lane, a) {
  validateLane(lane);
  ensureTmux();
  const meta = readMeta(lane);
  if (!meta) die(`no such lane "${lane}"`);
  const sess = sessionName(lane);

  // 1. Mini-harvest BEFORE exiting — capture-pane needs the session alive,
  // killing first would lose the scrollback forever.
  if (!hasAnyHarvest(lane)) doHarvest(lane, meta);

  // 2. Graceful /exit, then hard kill if it lingers.
  if (tmuxHasSession(lane)) {
    run('tmux', ['send-keys', '-t', sess, '-l', '--', '/exit'], { stdio: 'pipe' });
    sleepSync(0.3);
    run('tmux', ['send-keys', '-t', sess, 'Enter'], { stdio: 'pipe' });
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && tmuxHasSession(lane)) sleepSync(0.5);
    if (tmuxHasSession(lane)) {
      const k = run('tmux', ['kill-session', '-t', sess], { stdio: 'pipe' });
      if (!k.ok) warn(`kill-session failed: ${k.stderr.trim()}`);
    }
  }

  // 3. Optional worktree removal (branch lane/<lane> is preserved).
  if (a.rmWorktree) {
    const wt = meta.worktree || worktreePath(lane);
    const repo = meta.repo;
    if (repo) {
      const rm = run('git', ['-C', repo, 'worktree', 'remove', '--force', wt], { stdio: 'pipe' });
      if (!rm.ok) warn(`worktree remove failed: ${rm.stderr.trim()}`);
      run('git', ['-C', repo, 'worktree', 'prune'], { stdio: 'pipe' });
    } else {
      warn('no repo in meta — cannot remove worktree');
    }
  }

  // 4. Mark stopped + finish ledger.
  const fresh = readMeta(lane) || meta;
  fresh.stopped_at = new Date().toISOString();
  writeMeta(lane, fresh);
  ledgerFinish(lane, 'stopped', {});

  process.stdout.write(`stopped lane "${lane}"${a.rmWorktree ? ' (worktree removed)' : ''}\n`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const rest = argv.slice(3); // skip node, script, subcommand
  const a = { _: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--repo': a.repo = next(); break;
      case '--base': a.base = next(); break;
      case '--prompt': a.prompt = next(); break;
      case '--brief': a.brief = next(); break;
      case '--no-hooks-install': a.noHooksInstall = true; break;
      case '--text': a.text = next(); break;
      case '--file': a.file = next(); break;
      case '-n': a.n = next(); break;
      case '--json': a.json = true; break;
      case '--rm-worktree': a.rmWorktree = true; break;
      default:
        if (t && t[0] === '-') { /* unknown flag: ignore */ }
        else a._.push(t);
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'factory.cjs — Factory Conductor console: orchestrate parallel interactive Claude Code',
    'sessions via tmux on a Linux VM. State root: FACTORY_ROOT (default ~/.factory).',
    '',
    'COMMANDS:',
    '  spawn <lane> --repo <path> [--base <ref>] [--prompt "<t>"] [--brief <file>] [--no-hooks-install]',
    '      Create a worktree + detached tmux session (cf-<lane>) running claude, wire hooks,',
    '      optionally deliver a first prompt / brief.',
    '  send <lane> (--text "<t>" | --file <path>)',
    '      Type a prompt into a live lane and submit it (--file → FACTORY-BRIEF.md + pointer).',
    '  peek <lane> [-n <lines>=40]        Print the tail of the lane pane.',
    '  status [<lane>] [--json]           Table of lanes (state/branch/ahead/dirty/activity). Alias: list',
    '  harvest <lane>                     Capture full scrollback + git snapshot to harvest-<ts>.{txt,json}.',
    '  stop <lane> [--rm-worktree]        /exit the lane, mini-harvest, mark stopped, finish ledger.',
    '',
    'Runs ON the Linux VM (needs tmux + git). Exit codes: 0 ok, 2 usage/environment error.',
  ].join('\n') + '\n');
}

function main() {
  const sub = process.argv[2];
  if (!sub || sub === '--help' || sub === '-h') { printHelp(); process.exit(sub ? 0 : 2); }
  const a = parseArgs(process.argv);
  if (a.help) { printHelp(); process.exit(0); }
  const lane = a._[0];

  try {
    switch (sub) {
      case 'spawn': cmdSpawn(lane, a); break;
      case 'send': cmdSend(lane, a); break;
      case 'peek': cmdPeek(lane, a); break;
      case 'status': case 'list': cmdStatus(lane, a); break;
      case 'harvest': cmdHarvest(lane, a); break;
      case 'stop': cmdStop(lane, a); break;
      default:
        console.error(`ERROR: unknown command "${sub}" (spawn|send|peek|status|harvest|stop)`);
        process.exit(2);
    }
    process.exit(0);
  } catch (e) {
    console.error(`ERROR: ${e && e.message ? e.message : e}`);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  FACTORY_ROOT,
  LANE_RE,
  laneRoot,
  metaPath,
  settingsPath,
  sessionName,
  worktreePath,
  validateLane,
  buildSettings,
  preTrustWorktree,
  readMeta,
  writeMeta,
  listLaneNames,
  laneState,
  laneStatusRow,
  doHarvest,
  hasAnyHarvest,
  parseArgs,
  ledgerStart,
  ledgerFinish,
};
