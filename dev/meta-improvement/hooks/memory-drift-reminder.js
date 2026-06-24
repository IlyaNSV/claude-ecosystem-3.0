#!/usr/bin/env node
/**
 * memory-drift-reminder.js — D7 hook (DEC-DEV-0100)
 *
 * Triggers: PostToolUse on Bash matching git commit invocations.
 *
 * Logic:
 *   1. Parse tool input (Bash command); skip unless it is `git commit` (non-amend)
 *   2. Look at the just-made HEAD commit (git show HEAD --name-only)
 *   3. If HEAD touched any STATUS-BEARING file (DEV_JOURNAL.md / ROADMAP.md /
 *      CHANGELOG.md / CLAUDE.md) → the project status moved → remind to run
 *      memory-sync at end of session (Claude-persistent memory is not auto-written)
 *   4. ADDITIONALLY, when the status moved, compare the memory-sync date marker:
 *      CLAUDE.md `last memory-sync: YYYY-MM-DD` vs ROADMAP.md
 *      `**Последнее обновление:** YYYY-MM-DD`. If they diverge → surface the drift.
 *
 * Design notes (why this shape):
 *   - EVENT-GATED, not unconditional. Firing only when HEAD touched a status doc
 *     avoids nagging on every unrelated commit (the date can drift for days; we
 *     surface it when you are already editing status docs, the moment to fix it).
 *   - DETECT-ONLY. The hook never writes to CLAUDE.md / ROADMAP / memory — a
 *     self-editing hook would recurse (Write → PostToolUse → Write) and create
 *     git noise. The actual sync is the behavioural memory-sync protocol in
 *     CLAUDE.md «## Memory», executed by Claude.
 *   - Cannot reach Claude-persistent memory files (they live outside the repo at
 *     a harness-specific slug path) — so stale-file detection stays in the
 *     protocol, not here. This hook reasons only over in-repo SSOT docs.
 *
 * Sibling to dev-journal-reminder.js / phase-closure-reminder.js — all three are
 * PostToolUse:Bash warn-only reminders; none block.
 *
 * Output: stderr (visible to user). Never blocks. Fail-silent on any error.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATUS_FILES = ['DEV_JOURNAL.md', 'ROADMAP.md', 'CHANGELOG.md', 'CLAUDE.md'];

function repoRoot() {
    try {
        return execSync('git rev-parse --show-toplevel', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch (e) {
        return '';
    }
}

function readMarker(file, re) {
    try {
        const text = fs.readFileSync(file, 'utf8');
        const m = text.match(re);
        return m ? m[1] : null;
    } catch (e) {
        return null;
    }
}

function main() {
    let input;
    try {
        const stdin = fs.readFileSync(0, 'utf8');
        if (!stdin) return;
        input = JSON.parse(stdin);
    } catch (e) {
        return;
    }

    if ((input.tool_name || '') !== 'Bash') return;
    const command = (input.tool_input && input.tool_input.command) || '';
    if (!command) return;
    if (!/\bgit\s+commit\b/.test(command)) return;
    // Skip amends — they don't introduce a fresh status snapshot
    if (/\bgit\s+commit\b[^|;&]*--amend/.test(command)) return;

    // Which files did the just-made HEAD commit touch?
    let touched = [];
    try {
        const stat = execSync('git show HEAD --name-only --format=', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        touched = stat.split('\n').map(l => l.trim()).filter(Boolean);
    } catch (e) {
        // git not available or commit failed — fail silent
        return;
    }

    const touchedStatus = STATUS_FILES.filter(f => touched.includes(f));
    if (touchedStatus.length === 0) return; // event gate: status didn't move

    // Status moved — check the memory-sync date marker for drift
    const root = repoRoot();
    let dateLine = '';
    if (root) {
        const claudeDate = readMarker(
            path.join(root, 'CLAUDE.md'),
            /last memory-sync:\s*(\d{4}-\d{2}-\d{2})/
        );
        const roadmapDate = readMarker(
            path.join(root, 'ROADMAP.md'),
            /\*\*Последнее обновление:\*\*\s*(\d{4}-\d{2}-\d{2})/
        );
        if (claudeDate && roadmapDate && claudeDate !== roadmapDate) {
            dateLine =
                `\n⚠ Date marker drift: CLAUDE.md last memory-sync=${claudeDate} ` +
                `≠ ROADMAP «Последнее обновление»=${roadmapDate} — выровняй при sync.`;
        }
    }

    const reminder = `
🧠 memory-sync reminder

Status-bearing файлы изменены этим коммитом: ${touchedStatus.join(', ')}.
Статус проекта сдвинулся → Claude-память (MEMORY.md + записи) НЕ обновляется сама.${dateLine}

В конце сессии (или на «готово») прогони memory-sync протокол (CLAUDE.md «## Memory»):
обнови затронутые записи + индекс MEMORY.md + дату last memory-sync (= ROADMAP «Последнее обновление»).
Полная процедура — dev/meta-improvement/skills/memory-sync.md. Hook не блокирует.
`;
    process.stderr.write(reminder);
}

try {
    main();
} catch (e) {
    // Fail silently — a reminder hook must never wedge the flow
}
