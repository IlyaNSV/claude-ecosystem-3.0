#!/usr/bin/env node
/**
 * hooks/product/lesson-gate.js — LESSON-* non-deferrability gate (PRONG A, Stop event).
 *
 * Per DEC-DEV-0061 (LESSON-* atomic self-correction mechanism).
 *
 * Stop hook. Refuses a CLEAN session close while a corrective LESSON-* is left
 * unresolved — i.e. any `.product/lessons/LESSON-*.md` with `status: open`, or
 * any lesson file that is mid-write-truncated (opening `---` fence with no
 * closing fence — an interrupted atomic write, itself a tripwire).
 *
 *   - status:open found        → block (strict) / nag (warn)
 *   - truncated lesson file     → block (the ONE place failing-open is wrong)
 *   - nothing unresolved        → exit 0 (the common path)
 *
 * BLOCKING CONTRACT (verified against the official Claude Code hooks reference,
 * code.claude.com/docs/en/hooks, 2026-06): a Stop hook CAN prevent the agent
 * from stopping via `exit 2` (stderr is fed back to Claude as feedback). This is
 * platform-independent (Windows == macOS == Linux). Do NOT confuse with
 * SessionEnd, which canNOT block ("session already ending"). The repo's earlier
 * assumption that Stop cannot block was a Stop/SessionEnd conflation — corrected
 * in DEC-DEV-0061. Claude Code auto-overrides a Stop hook after 8 consecutive
 * blocks, so strict mode cannot permanently wedge a session (documented safety
 * valve); the `stop_hook_active` guard below avoids re-blocking within one stop.
 *
 * MODE (env LESSON_GATE_MODE, default = strict for this Stop prong per the
 * "Strict Stop, warn PreToolUse" decision):
 *   - unset | "strict"  → exit 2 (block) + stderr resolution instructions
 *   - "warn"            → stderr instructions + exit 0 (no block)
 *   - "off"             → exit 0, silent
 *
 * FAIL-OPEN: the entire main() is try/catch-wrapped → exit 0 on ANY parse/fs
 * error. The gate blocks ONLY on a positively-parsed open lesson or a
 * confirmed-truncated lesson file. Reading stdin cannot hang: Claude Code always
 * pipes a JSON payload to Stop hooks (documented).
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- IO ----------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

// ---------- Project root ----------
//
// A Stop payload has NO tool_input.file_path, so the file_path walk-up idiom
// (bg-extractor) does not apply here. Resolve from payload.cwd, then env, then
// process.cwd(); accept the root only if it actually contains a .product dir.

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

// ---------- Lesson scan ----------

function frontmatterStatus(text) {
  // Returns { truncated: bool, status: string|null }.
  if (!/^---\r?\n/.test(text)) {
    // No opening fence at all — not a well-formed artifact; treat as not-open
    // (a fully empty / non-fenced file is not a tripwire here).
    return { truncated: false, status: null };
  }
  const closing = /\r?\n---\r?\n?/m.exec(text.replace(/^---\r?\n/, ''));
  if (!closing) {
    // Opening fence but no closing fence → interrupted atomic write.
    return { truncated: true, status: null };
  }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(text);
  if (!m) return { truncated: true, status: null };
  let status = null;
  m[1].split(/\r?\n/).forEach((line) => {
    if (/^\s*(#|$)/.test(line)) return;
    const kv = /^status\s*:\s*(.*)$/.exec(line);
    if (kv) {
      status = kv[1].trim().replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1');
    }
  });
  return { truncated: false, status };
}

function scanUnresolved(projectRoot) {
  const dir = path.join(projectRoot, '.product', 'lessons');
  const unresolved = [];
  let names;
  try {
    if (!fs.existsSync(dir)) return unresolved;
    names = fs.readdirSync(dir);
  } catch (_) {
    return unresolved;
  }
  for (const name of names) {
    if (!/^LESSON-.*\.md$/.test(name)) continue;
    const fp = path.join(dir, name);
    let text;
    try {
      text = fs.readFileSync(fp, 'utf8');
    } catch (_) {
      continue;
    }
    const { truncated, status } = frontmatterStatus(text);
    if (truncated) {
      unresolved.push({ file: name, reason: 'interrupted-write (no closing frontmatter fence)' });
    } else if (status === 'open') {
      unresolved.push({ file: name, reason: 'status: open' });
    }
  }
  return unresolved;
}

// ---------- Message ----------

function buildMessage(unresolved) {
  const lines = [
    '',
    '🛑 LESSON GATE — open corrective lesson(s) must be resolved before closing the session.',
    '',
  ];
  for (const u of unresolved) {
    lines.push('   • ' + u.file + '  (' + u.reason + ')');
  }
  lines.push('');
  lines.push('   A LESSON-* is non-deferrable: an error was found and must be FIXED + recorded now,');
  lines.push('   not parked. Resolve each:');
  lines.push('     /product:lesson --resume <LESSON-id>     apply/finish the fix, set status: active');
  lines.push('     /product:lesson --withdraw <LESSON-id> "<reason>"   only if it was a genuine false alarm (no fix landed)');
  lines.push('');
  lines.push('   (To downgrade this gate to a non-blocking reminder: set env LESSON_GATE_MODE=warn.)');
  lines.push('');
  return lines.join('\n');
}

// ---------- Main ----------

function main() {
  const mode = (process.env.LESSON_GATE_MODE || 'strict').toLowerCase();
  if (mode === 'off') return 0;

  const raw = readStdinSync();
  if (!raw.trim()) return 0;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return 0;
  }

  // Re-entrancy: if a Stop hook is already blocking this stop, don't pile on.
  if (payload && payload.stop_hook_active === true) return 0;

  const projectRoot = resolveProjectRoot(payload);
  if (!projectRoot) return 0;

  const unresolved = scanUnresolved(projectRoot);
  if (!unresolved.length) return 0;

  process.stderr.write(buildMessage(unresolved));

  // strict (default) → exit 2 blocks the stop; stderr is fed back to Claude.
  // warn → exit 0 (advisory only).
  return mode === 'warn' ? 0 : 2;
}

if (require.main === module) {
  let code = 0;
  try {
    code = main();
  } catch (_) {
    code = 0; // fail-open: never wedge on an internal error
  }
  process.exit(code);
}

module.exports = { frontmatterStatus, scanUnresolved, resolveProjectRoot };
