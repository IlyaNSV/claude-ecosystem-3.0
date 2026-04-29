#!/usr/bin/env node
/**
 * phase-closure-reminder.js — D7 hook
 *
 * Triggers: PostToolUse on Bash matching git commit invocations.
 *
 * Logic:
 *   1. Parse tool input (Bash command)
 *   2. Check if command is `git commit` with -m flag
 *   3. Extract commit message
 *   4. Detect phase implementation completion patterns:
 *      - "Phase <N>" + completion verb (complete, done, finished, ship, implementation)
 *   5. Check DEV_JOURNAL.md for closure entry для that phase
 *      - Look for DEC-DEV-NNNN entry mentioning "phase-closure" + Phase <N>
 *   6. If pattern matches AND no closure entry yet → stderr reminder
 *
 * Output:
 *   - stderr (visible to user): reminder if applicable
 *   - JSON to stdout: per Claude Code hook contract (decision: continue)
 *
 * Registration: D7 hook, registered в repo's .claude/settings.local.json.
 * NOT в hooks/<module>/manifest.yaml — D7 hooks are dev-only, не deployed (per CONVENTIONS §2).
 *
 * Per DEC-DEV-0021 Stage 4c. User concern: «убедиться что хук точно будет триггериться».
 *
 * Manual test:
 *   echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: Phase 7 implementation complete\""}}' | node phase-closure-reminder.js
 */

const fs = require('fs');
const path = require('path');

function main() {
    let input;
    try {
        const stdin = fs.readFileSync(0, 'utf8');
        if (!stdin) {
            // No input — nothing to do
            return;
        }
        input = JSON.parse(stdin);
    } catch (e) {
        // Malformed input — fail silent (hook не должен block on parse errors)
        return;
    }

    // Check tool is Bash
    const toolName = input.tool_name || '';
    if (toolName !== 'Bash') {
        return;
    }

    // Extract command
    const command = (input.tool_input && input.tool_input.command) || '';
    if (!command) {
        return;
    }

    // Check if command is git commit (handles HEREDOC -m, simple -m, with --message etc.)
    if (!/\bgit\s+commit\b/.test(command)) {
        return;
    }

    // Extract commit message
    // Patterns:
    //   git commit -m "message"
    //   git commit -m 'message'
    //   git commit -m "$(cat <<EOF\nmessage\nEOF\n)"  (HEREDOC — best effort на first line)
    //   git commit --message "message"
    //   git commit -am "message"
    let message = '';
    const dashMmatch = command.match(/-m\s+["']([^"']+)["']/);
    const heredocMatch = command.match(/-m\s+"\$\(cat\s+<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1/);
    const longFlagMatch = command.match(/--message[=\s]+["']([^"']+)["']/);

    if (heredocMatch) {
        message = heredocMatch[2].split('\n')[0]; // first line of HEREDOC
    } else if (dashMmatch) {
        message = dashMmatch[1];
    } else if (longFlagMatch) {
        message = longFlagMatch[1];
    }

    if (!message) {
        return;
    }

    // Detect phase implementation completion pattern
    // Examples:
    //   "feat: Phase 4 implementation complete"
    //   "feat(handoff): Phase 4 done"
    //   "Phase 5 — Integrator Phase 2 finished"
    const phaseMatch = message.match(/[Pp]hase\s+(\d+)/);
    if (!phaseMatch) {
        return;
    }
    const phaseNum = phaseMatch[1];

    const completionWords = [
        'complete', 'completed', 'completion',
        'done', 'finish', 'finished',
        'ship', 'shipped', 'shipping',
        'implementation',
        'closure',
        'final',
    ];
    const messageLower = message.toLowerCase();
    const hasCompletionWord = completionWords.some(w => messageLower.includes(w));
    if (!hasCompletionWord) {
        return;
    }

    // Find DEV_JOURNAL.md (search up from cwd)
    let cwd = process.cwd();
    let devJournalPath = null;
    for (let i = 0; i < 5; i++) {
        const candidate = path.join(cwd, 'DEV_JOURNAL.md');
        if (fs.existsSync(candidate)) {
            devJournalPath = candidate;
            break;
        }
        const parent = path.dirname(cwd);
        if (parent === cwd) break;
        cwd = parent;
    }

    if (!devJournalPath) {
        // No DEV_JOURNAL.md found — hook not applicable in this repo
        return;
    }

    // Check if closure entry exists для this phase
    let journalContent;
    try {
        journalContent = fs.readFileSync(devJournalPath, 'utf8');
    } catch (e) {
        return;
    }

    // Heuristic: closure entry contains "phase-closure" or "Phase <N> closure" + DEC-DEV-NNNN entry
    const closureEntryRegex = new RegExp(
        `## DEC-DEV-\\d+ — [^\\n]*Phase\\s+${phaseNum}[^\\n]*closure`,
        'i'
    );
    const hasClosureEntry = closureEntryRegex.test(journalContent);

    if (hasClosureEntry) {
        // Closure entry already exists — quiet OK
        return;
    }

    // Surface reminder via stderr
    const reminder = `
🔔 D7 phase-closure reminder

Detected commit: «${message}»
Phase ${phaseNum} implementation completion pattern matched, но closure entry в DEV_JOURNAL не найден.

Перед Phase ${parseInt(phaseNum) + 1} kickoff — пройди:
  → dev/meta-improvement/checklists/phase-closure.md (Phase ${phaseNum})

Closure ritual ловит doc rot, bootstrap regression, doc consistency drift, cleanup debt, memory MCP staleness — без него gaps compound across phases (per DEC-DEV-0018 13 findings).

Это не блокирует commit — reminder only.
`;
    process.stderr.write(reminder);
}

try {
    main();
} catch (e) {
    // Fail silently — hook должен not block on errors
    // process.stderr.write('phase-closure-reminder.js error: ' + e.message + '\\n');
}
