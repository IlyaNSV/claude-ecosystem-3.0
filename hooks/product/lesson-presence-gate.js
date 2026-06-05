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
 * SHIPS DEFAULTED TO WARN (per the "Strict Stop, warn PreToolUse" decision): the
 * deny path below is DORMANT unless env LESSON_GATE_MODE=strict is set, because
 * the marker-exemption logic (don't deny the lesson-capture protocol's own
 * writes/Bash) must be validated by a live smoke (S-LE) before it can be trusted
 * to gate without self-deadlocking the very protocol that resolves the lesson.
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
 *   - unset | "warn"  → reminder only (PreToolUse: stderr nag; UPS: additionalContext); never denies
 *   - "strict"        → PreToolUse denies mutating calls (with marker-exemption); UPS still reminder-only
 *   - "off"           → exit 0, silent
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
      const id = (name.match(/^(LESSON-\d+)/) || [null, name])[1];
      open.push(id);
    }
  }
  return open;
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
  const mode = (process.env.LESSON_GATE_MODE || 'warn').toLowerCase();
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
      // Exempt the lesson-capture protocol's own work (its fix Edits + verify Bash).
      if (captureInProgress(projectRoot)) return;
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

module.exports = { frontmatterStatus, openLessons, captureInProgress, resolveProjectRoot };
