#!/usr/bin/env node
/**
 * hooks/product/lesson-presence-gate.js — LESSON-* non-deferrability backstop
 * (PRONG B, PreToolUse + UserPromptSubmit).
 *
 * Per DEC-DEV-0062 (LESSON-* atomic self-correction mechanism).
 *
 * Closes the "session never ends, so the Stop gate never fires" deferral hole:
 * while a corrective LESSON-* is left `status: open`, this hook re-surfaces it on
 * every user turn (UserPromptSubmit) and — in strict mode — refuses the next
 * MUTATING tool call (PreToolUse) until the lesson is resolved.
 *
 * SHIPS DEFAULTED TO STRICT (flipped 2026-07-11, owner decision after the S-LE
 * re-run — smoke-batch DEC-DEV-0177; previously warn per the original "Strict
 * Stop, warn PreToolUse" decision). History: the armed S-LE live smoke (pilot
 * session 4fb6e0f2, 2026-07-04) CONFIRMED the self-deadlock the original
 * marker-only exemption predicted: the protocol's FIRST writes (the LESSON-*
 * file, then the lesson-in-progress marker — lesson-capture.md steps 3-4) happen
 * BEFORE any marker can exist, so marker-only exemption denies the very write
 * that would create the marker. Fixed by the TARGET carve-out below
 * (isLessonResolutionTarget, DEC-DEV-0143); the fix was live-re-validated on the
 * 2026-07-11 re-run (deny + exemption both PASS, session 9e5dab52) — that PASS
 * unlocked this flip. Downgrade escape: env LESSON_GATE_MODE=warn.
 *
 * BLOCKING CONTRACT (verified against code.claude.com/docs/en/hooks, 2026-06):
 *   - PreToolUse denies a tool call via stdout JSON
 *       {"hookSpecificOutput":{"hookEventName":"PreToolUse",
 *         "permissionDecision":"deny","permissionDecisionReason":"..."}}
 *     (exit 0; do NOT also exit 2 — Claude Code ignores JSON when you exit 2).
 *   - UserPromptSubmit can inject context via
 *       {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit",
 *         "additionalContext":"..."}}
 *     We use additionalContext (a reminder into Claude's context) and NEVER block
 *     a user prompt — trapping the user at the prompt level is too aggressive.
 *   Platform-independent (Windows == macOS == Linux).
 *
 * MODE (env LESSON_GATE_MODE):
 *   - unset | "strict" → PreToolUse denies mutating calls (with target carve-out + marker-exemption); UPS reminder-only. DEFAULT since 2026-07-11.
 *   - "warn"           → reminder only (PreToolUse: stderr nag; UPS: additionalContext); never denies
 *   - "off"            → exit 0, silent
 *
 * MARKER-EXEMPTION (strict only): while `/product:lesson` is actively resolving,
 * it keeps a fresh `.product/.sessions/lesson-in-progress.<id>` marker. If any
 * such marker is fresh (mtime within TTL), the protocol is mid-flow — do NOT deny
 * (its own Write/Edit/Bash for the fix + verification must proceed). A stale/
 * absent marker + an open lesson = a parked lesson → deny.
 *
 * FAIL-OPEN: entire main() try/catch → exit 0 (no deny) on ANY error.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MUTATING_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash']);
const MARKER_TTL_MS = 2 * 60 * 60 * 1000; // 2h — covers a long capture, expires a crashed one

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function resolveProjectRoot(payload) {
  const candidates = [
    payload && payload.cwd,
    process.env.CLAUDE_PROJECT_DIR,
    process.cwd(),
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      if (fs.existsSync(path.join(c, '.product'))) return c;
    } catch (_) { /* keep trying */ }
  }
  return null;
}

function frontmatterStatus(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return null;
  let status = null;
  m[1].split(/\r?\n/).forEach((line) => {
    const kv = /^status\s*:\s*(.*)$/.exec(line);
    if (kv) status = kv[1].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
  });
  return status;
}

function openLessons(projectRoot) {
  const dir = path.join(projectRoot, '.product', 'lessons');
  const open = [];
  let names;
  try {
    if (!fs.existsSync(dir)) return open;
    names = fs.readdirSync(dir);
  } catch (_) {
    return open;
  }
  for (const name of names) {
    if (!/^LESSON-.*\.md$/.test(name)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(dir, name), 'utf8');
    } catch (_) {
      continue;
    }
    if (frontmatterStatus(text) === 'open') {
      // Numeric ids extract as LESSON-NNN; non-numeric ids (e.g. a synthetic smoke
      // lesson) fall back to the filename sans .md — never with the extension
      // (cosmetic S-LE finding, DEC-DEV-0143).
      const id = (name.match(/^(LESSON-\d+)/) || [null, name.replace(/\.md$/, '')])[1];
      open.push(id);
    }
  }
  return open;
}

function isLessonResolutionTarget(projectRoot, payload) {
  // DEADLOCK BREAKER (S-LE smoke 2026-07-04, DEC-DEV-0143). The resolution protocol's
  // first writes are the LESSON-* file itself and the lesson-in-progress marker — both
  // happen BEFORE a marker can exist, so a marker-only exemption self-deadlocks (the
  // deny blocks the very write that would create the marker). A mutation whose TARGET
  // is a lesson-resolution instrument is therefore always allowed:
  //   - .product/lessons/**                       (author / open→active-flip the lesson)
  //   - .product/.sessions/lesson-in-progress.*   (the protocol marker)
  // Bash stays gated (its targets are not parseable from the command string) — the
  // protocol writes the marker and the lesson via Write/Edit (lesson-capture.md steps
  // 3-4) and deletes the marker only after the open→active flip, when no open lesson
  // gates Bash anymore.
  const ti = (payload && payload.tool_input) || {};
  const fp = ti.file_path || ti.notebook_path || '';
  if (!fp) return false;
  let abs;
  let lessons;
  let sessions;
  try {
    abs = path.resolve(fp);
    lessons = path.resolve(projectRoot, '.product', 'lessons');
    sessions = path.resolve(projectRoot, '.product', '.sessions');
  } catch (_) {
    return false;
  }
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const a = norm(abs);
  if (a === norm(lessons) || a.startsWith(norm(lessons) + path.sep)) return true;
  if (a.startsWith(norm(sessions) + path.sep) && /^lesson-in-progress\./.test(path.basename(abs))) return true;
  return false;
}

function captureInProgress(projectRoot) {
  // True if a fresh lesson-in-progress marker exists (protocol actively resolving).
  const sessDir = path.join(projectRoot, '.product', '.sessions');
  let names;
  try {
    if (!fs.existsSync(sessDir)) return false;
    names = fs.readdirSync(sessDir);
  } catch (_) {
    return false;
  }
  for (const name of names) {
    if (!/^lesson-in-progress\./.test(name)) continue;
    try {
      const st = fs.statSync(path.join(sessDir, name));
      if (Date.now() - st.mtimeMs <= MARKER_TTL_MS) return true;
    } catch (_) { /* ignore */ }
  }
  return false;
}

function denyJSON(ids) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Open corrective lesson(s) ' + ids.join(', ') + ' must be resolved first ' +
        '(non-deferrable). Run /product:lesson --resume <id> to apply/finish the fix, ' +
        'or --withdraw <id> "<reason>" if it was a false alarm. ' +
        '(Set LESSON_GATE_MODE=warn to downgrade this gate.)',
    },
  });
}

function reminderJSON(ids) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        '⚠️ Open LESSON-* still unresolved: ' + ids.join(', ') + '. A corrective lesson is ' +
        'non-deferrable — finish it via /product:lesson --resume <id> (apply/record the fix) ' +
        'before moving on, or --withdraw <id> if it was a false alarm.',
    },
  });
}

function main() {
  const mode = (process.env.LESSON_GATE_MODE || 'strict').toLowerCase();
  if (mode === 'off') return;

  const raw = readStdinSync();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return;
  }

  const event = payload.hook_event_name || payload.hook_event || '';
  const projectRoot = resolveProjectRoot(payload);
  if (!projectRoot) return;

  const ids = openLessons(projectRoot);
  if (!ids.length) return;

  if (event === 'UserPromptSubmit') {
    // Always reminder-only — inject context, never block the prompt.
    process.stdout.write(reminderJSON(ids));
    return;
  }

  if (event === 'PreToolUse') {
    const toolName = payload.tool_name || payload.tool || '';
    if (!MUTATING_TOOLS.has(toolName)) return;

    if (mode === 'strict') {
      // Exempt (a) the protocol mid-flow — fresh marker (its fix Edits + verify Bash) —
      // and (b) any mutation whose TARGET is a lesson-resolution instrument (the
      // deadlock breaker, see isLessonResolutionTarget).
      if (captureInProgress(projectRoot) || isLessonResolutionTarget(projectRoot, payload)) return;
      process.stdout.write(denyJSON(ids));
      return;
    }

    // warn (default): non-blocking stderr nag.
    process.stderr.write(
      '\n⚠️ LESSON GATE (reminder): open ' + ids.join(', ') +
      ' — resolve via /product:lesson --resume <id> before other work.\n\n'
    );
    return;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (_) {
    /* fail-open: never deny on an internal error */
  }
  process.exit(0);
}

module.exports = { frontmatterStatus, openLessons, captureInProgress, resolveProjectRoot, isLessonResolutionTarget };
