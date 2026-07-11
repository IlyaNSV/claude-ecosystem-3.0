#!/usr/bin/env node
'use strict';
/**
 * d7-hygiene-reminder.js — consolidated D7 feedback-contour hygiene reminder
 * (SessionStart hook, DEC-DEV-0181). Closes the "capture happened, consumption
 * forgotten" class of gaps G25 / G26 / G27 from the process-fabric GAP analysis
 * (dev/process-fabric/audit/APPENDIX-B-gap-analysis.md §Tier-3).
 *
 * Three standing-backlog conditions it surfaces (only the tripped arms print):
 *   G25 — audit-index.md has Pending markers older than a threshold, but nothing
 *         obliges a `/meta:audit-smoke` run. → nudge to audit them.
 *   G26 — the upstream feedback contour (FB-ledger; DEC-DEV-0090/0097) carries
 *         findings that feedback-intake would classify `open` (not yet ported to a
 *         DEC-DEV), but a human must remember to run the reconciliation. → nudge.
 *   G27 — a patch-candidate that SURVIVED adversarial verification sits at
 *         `gate: pending` (the manual [Y/N/E/D] gate) without movement. → nudge.
 *
 * Design notes (why this shape) — mirrors the existing D7 warn-reminders
 * (dev-journal / phase-closure / memory-drift-reminder + rails-session-start):
 *   - CONSOLIDATED, not three hooks. All three are *standing-backlog* conditions
 *     (accumulation over time), NOT commit events — so unlike the reminder trio
 *     (which is `git commit`-gated on PostToolUse:Bash) the natural trigger is
 *     SessionStart: surface the backlog ONCE per session, not on every Bash call.
 *     One file / one registration entry / one injected block = minimum noise.
 *   - THRESHOLD-GATED, not unconditional. Each arm has a conservative staleness /
 *     count gate; a fresh capture does not nag. If no arm trips, the hook is silent
 *     (emits nothing, exit 0) — same "no summary → exit" contract as rails.
 *   - DETECT-ONLY. Never writes any file / state / marker. It reads the SSOT docs
 *     (audit-index.md, the FB-ledger + DEV_JOURNAL via the real feedback-intake
 *     reconciler, patch-candidates/*.md) and reports. Acting is a human/Claude act.
 *   - CONSOLIDATE-DON'T-DUPLICATE. G26 reuses scripts/feedback-intake.js's real
 *     intake() (dedupe against DEV_JOURNAL) rather than re-implementing "is this
 *     ported?" — an honest signal, not a heuristic guess.
 *   - Non-blocking, no-op-safe, fail-silent: exits 0 always; any parse/require
 *     error just drops that arm. A reminder must never wedge session start.
 *
 * Reachability caveat (honest scope): the *pilot* meta-feedback outbox lives at a
 * pilot's `.product/.upstream/feedback-outbox.md` (an external path this ecosystem
 * repo does not know) — so the G26 arm covers only the IN-REPO FB-ledger arm of the
 * intake. A human bringing a pilot outbox still runs `feedback-intake --outbox` by
 * hand; this hook guarantees the in-repo backlog is not silently forgotten.
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  D7_HYGIENE_REMINDER=0
 *   - Disable entirely: remove the SessionStart entry from .claude/settings.local.json
 *     (registration is local — that file is gitignored in the ecosystem repo).
 *   - Remove the feature: revert the wiring commit (DEC-DEV-0181).
 *
 * Registration (ecosystem repo, .claude/settings.local.json — see
 * dev/meta-improvement/CONVENTIONS.md hooks table):
 *   "SessionStart": [{ "hooks": [{ "type": "command",
 *     "command": "node dev/meta-improvement/hooks/d7-hygiene-reminder.js" }] }]
 *
 * Output: SessionStart hookSpecificOutput.additionalContext (valid JSON on stdout,
 * exit 0), the documented SessionStart channel — same as rails-session-start.js.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── thresholds (conservative — a fresh capture must not nag) ──────────────────
const AUDIT_PENDING_STALE_DAYS = 7;   // G25: pending marker older than this
const PATCH_CANDIDATE_STALE_DAYS = 14; // G27: survived+pending candidate idle this long
const DAY_MS = 24 * 60 * 60 * 1000;

// Toggle OFF without touching settings.
if (process.env.D7_HYGIENE_REMINDER === '0') process.exit(0);

// ── G25: stale Pending markers in audit-index.md ──────────────────────────────
// Rows live between the <!-- PENDING_ROWS_START --> / _END --> sentinels; each is
// `| session_id | ended_at | target | transcript |`. ended_at is ISO-8601.
function staleAuditPending(auditIndexText, now) {
  const src = String(auditIndexText || '');
  const m = src.match(/<!--\s*PENDING_ROWS_START\s*-->([\s\S]*?)<!--\s*PENDING_ROWS_END\s*-->/);
  if (!m) return { total: 0, stale: 0, oldestDays: 0 };
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  let total = 0; let stale = 0; let oldestDays = 0;
  for (const line of m[1].split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
    if (cells.length < 2) continue;
    total += 1;
    const endedAt = Date.parse(cells[1]);
    if (Number.isNaN(endedAt)) continue;
    const ageDays = (nowMs - endedAt) / DAY_MS;
    if (ageDays > oldestDays) oldestDays = ageDays;
    if (ageDays >= AUDIT_PENDING_STALE_DAYS) stale += 1;
  }
  return { total, stale, oldestDays: Math.floor(oldestDays) };
}

// ── G26: open upstream feedback the intake would flag (FB-ledger arm) ──────────
// Reuse the real reconciler so "already ported?" is deduped against DEV_JOURNAL,
// not guessed. Count only feedback-journal-source findings with disposition `open`
// (session-audit findings are patch-synth's domain — G27 — not the intake trigger).
function openFeedbackIntake(intakeMod, ledgerText, devJournalText) {
  if (!intakeMod || ledgerText == null) return { open: 0, refs: [] };
  let res;
  try {
    res = intakeMod.intake({ ledgerText, devJournalText: devJournalText || '' });
  } catch (e) {
    return { open: 0, refs: [] };
  }
  const ledgerSource = (intakeMod.SOURCES && intakeMod.SOURCES.LEDGER) || 'feedback-journal';
  const open = (res.findings || []).filter(
    (f) => f.source === ledgerSource && f.disposition === 'open'
  );
  return { open: open.length, refs: open.map((f) => f.source_ref).slice(0, 8) };
}

// ── G27: patch-candidate that SURVIVED but sits at gate: pending, idle ─────────
function stalePatchCandidates(candidatesDir, now, lastMovedFn) {
  const out = { pending: 0, stale: 0, files: [] };
  let entries;
  try { entries = fs.readdirSync(candidatesDir); } catch (e) { return out; }
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  for (const name of entries) {
    if (!name.endsWith('.md') || name.toLowerCase() === 'readme.md') continue;
    const file = path.join(candidatesDir, name);
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const verdict = (fm[1].match(/^verdict:\s*(\w+)/m) || [])[1];
    const gate = (fm[1].match(/^gate:\s*(\w+)/m) || [])[1];
    if (verdict !== 'survived' || gate !== 'pending') continue;
    out.pending += 1;
    const movedMs = lastMovedFn(file);
    if (movedMs == null) { out.stale += 1; out.files.push(name); continue; }
    const ageDays = (nowMs - movedMs) / DAY_MS;
    if (ageDays >= PATCH_CANDIDATE_STALE_DAYS) { out.stale += 1; out.files.push(name); }
  }
  return out;
}

// Last-movement time of a file: last git-commit date, else filesystem mtime.
function lastMoved(file) {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (iso) return Date.parse(iso);
  } catch (e) { /* uncommitted / no git — fall through */ }
  try { return fs.statSync(file).mtimeMs; } catch (e) { return null; }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function findRepoRoot(start) {
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'DEV_JOURNAL.md')) && fs.existsSync(path.join(dir, 'CLAUDE.md'))) return dir;
    dir = path.dirname(dir);
  }
  const fallback = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(fallback, 'DEV_JOURNAL.md'))) return fallback;
  return null;
}

function readIf(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

// ── main ──────────────────────────────────────────────────────────────────────
function main() {
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch (e) { /* fine */ }

  const root = findRepoRoot(payload.cwd || process.cwd());
  if (!root) process.exit(0);

  const now = new Date();
  const lines = [];

  // G25
  const auditIndex = readIf(path.join(root, 'dev', 'meta-improvement', 'audit-index.md'));
  if (auditIndex != null) {
    const g25 = staleAuditPending(auditIndex, now);
    if (g25.stale > 0) {
      lines.push(
        `• [G25] ${g25.stale} Pending audit marker(s) ≥${AUDIT_PENDING_STALE_DAYS}d old in ` +
        `dev/meta-improvement/audit-index.md (oldest ~${g25.oldestDays}d). ` +
        'Run `/meta:audit-smoke` (or `node dev/meta-improvement/scripts/audit-watch.js`) to audit them.'
      );
    }
  }

  // G26
  let intakeMod = null;
  try { intakeMod = require('../scripts/feedback-intake.js'); } catch (e) { /* arm off */ }
  const ledgerPath = path.join(root, 'dev', 'ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md');
  const ledgerText = readIf(ledgerPath);
  if (intakeMod && ledgerText != null) {
    const g26 = openFeedbackIntake(intakeMod, ledgerText, readIf(path.join(root, 'DEV_JOURNAL.md')));
    if (g26.open > 0) {
      lines.push(
        `• [G26] ${g26.open} upstream feedback finding(s) unreconciled (open, not ported to a DEC-DEV): ` +
        `${g26.refs.join(', ')}. Run \`node dev/meta-improvement/scripts/feedback-intake.js ` +
        '--ledger dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md\` (add `--outbox <pilot outbox>` if you brought one).'
      );
    }
  }

  // G27
  const g27 = stalePatchCandidates(path.join(root, 'dev', 'meta-improvement', 'patch-candidates'), now, lastMoved);
  if (g27.stale > 0) {
    lines.push(
      `• [G27] ${g27.stale} survived patch-candidate(s) idle ≥${PATCH_CANDIDATE_STALE_DAYS}d at gate: pending ` +
      `(${g27.files.join(', ')}). Run the [Y/N/E/D] gate in dev/meta-improvement/patch-candidates/.`
    );
  }

  if (lines.length === 0) process.exit(0); // nothing stale → silent

  const context =
    'D7 feedback-contour hygiene (auto-checked on session start; detect-only warn, ' +
    'nothing was written; toggle env D7_HYGIENE_REMINDER=0). Standing backlog whose ' +
    'capture happened but consumption is pending:\n\n' + lines.join('\n') +
    '\n\nEach is a nudge, not a block — clear or dismiss at your discretion.';

  // hookEventName обязателен в hookSpecificOutput — без него Claude Code отбрасывает
  // весь payload (DEC-DEV-0162, рецидив DEC-DEV-0191).
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
  process.exit(0);
}

if (require.main === module) {
  try { main(); } catch (e) { process.exit(0); } // fail-silent — never wedge session start
}

module.exports = { staleAuditPending, openFeedbackIntake, stalePatchCandidates, lastMoved, findRepoRoot };
