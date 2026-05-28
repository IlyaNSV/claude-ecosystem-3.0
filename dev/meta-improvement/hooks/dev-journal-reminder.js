#!/usr/bin/env node
/**
 * dev-journal-reminder.js — D7 hook
 *
 * Triggers: PostToolUse on Bash matching git commit invocations.
 *
 * Logic:
 *   1. Parse tool input (Bash command)
 *   2. Check if command is `git commit` with message
 *   3. Detect non-trivial commit patterns per CLAUDE.md triggers:
 *      - `feat:` / `feat(scope):` — always non-trivial
 *      - `fix:` / `fix(scope):` — always non-trivial (CLAUDE.md: «always — root cause + lesson»)
 *      - message mentions «spec» / «SPEC» or commit touched a SPEC.md under docs/
 *      - message contains DEC-DEV-NNNN reference (architectural decision)
 *   4. SKIP triggers: docs (typo/polish), chore, test, style, refactor (если trivial)
 *   5. Check if HEAD commit touched DEV_JOURNAL.md (git show --name-only)
 *   6. If non-trivial AND no DEV_JOURNAL touch → stderr reminder
 *
 * Sibling to phase-closure-reminder.js — both can fire on same commit.
 * dev-journal-reminder catches broader pattern; phase-closure catches end-of-phase specifically.
 *
 * Output:
 *   - stderr (visible to user): reminder if applicable
 *
 * Per CLAUDE.md §1 «DEV_JOURNAL обязателен для значимых решений»:
 *   Триггеры: архитектурные решения, root causes, scope cuts, spec adjustments
 *   НЕ триггеры: typo fixes, dep bumps, рутинные правки документации
 */

const { execSync } = require('child_process');
const fs = require('fs');

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

    // Skip amends — amending an existing commit doesn't introduce new scope to journal
    if (/\bgit\s+commit\b[^|;&]*--amend/.test(command)) return;

    // Extract message
    let message = '';
    const heredocMatch = command.match(/-m\s+"\$\(cat\s+<<\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1/);
    const dashMmatch = command.match(/-m\s+["']([^"']+)["']/);
    const longFlagMatch = command.match(/--message[=\s]+["']([^"']+)["']/);

    if (heredocMatch) message = heredocMatch[2].split('\n')[0];
    else if (dashMmatch) message = dashMmatch[1];
    else if (longFlagMatch) message = longFlagMatch[1];

    if (!message) return;

    // Classify commit
    const trivialPrefixes = /^(chore|test|style|build|ci|perf)(\(|:)/;
    if (trivialPrefixes.test(message)) return;

    const isFeat = /^feat(\(|:)/i.test(message);
    const isFix = /^fix(\(|:)/i.test(message);
    const isRefactor = /^refactor(\(|:)/i.test(message);
    const isDocs = /^docs(\(|:)/i.test(message);

    const mentionsSpec = /\bspec\b/i.test(message);
    const mentionsDecDev = /DEC-DEV-\d+/i.test(message);
    const mentionsScope = /\bscope\s*(cut|change|reduc|expand)/i.test(message);
    const mentionsRootCause = /\broot\s*cause\b/i.test(message);

    // Decision: should this commit have DEV_JOURNAL entry?
    let shouldHaveEntry = false;
    let reasonHint = '';

    if (isFeat) {
        shouldHaveEntry = true;
        reasonHint = 'feat: — record tradeoffs if there were ≥2 architecture alternatives';
    } else if (isFix) {
        shouldHaveEntry = true;
        reasonHint = 'fix: — CLAUDE.md «всегда — root cause + lesson»';
    } else if (mentionsDecDev) {
        shouldHaveEntry = true;
        reasonHint = 'DEC-DEV-N referenced — ensure full entry exists in DEV_JOURNAL';
    } else if (mentionsSpec || mentionsScope) {
        shouldHaveEntry = true;
        reasonHint = 'spec/scope mentioned — CLAUDE.md «spec change → всегда rationale + impact»';
    } else if (isRefactor && mentionsRootCause) {
        shouldHaveEntry = true;
        reasonHint = 'refactor with root cause — non-trivial';
    } else if (isDocs && /SPEC|architecture|decision/i.test(message)) {
        shouldHaveEntry = true;
        reasonHint = 'docs touching SPEC/architecture/decisions — non-trivial';
    }

    if (!shouldHaveEntry) return;

    // Check whether HEAD commit (just made) touched DEV_JOURNAL.md
    let touchedJournal = false;
    try {
        const stat = execSync('git show HEAD --name-only --format=', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        touchedJournal = stat.split('\n').some(line => line.trim() === 'DEV_JOURNAL.md');
    } catch (e) {
        // git not available or commit failed — fail silent
        return;
    }

    if (touchedJournal) return;

    // Surface reminder
    const reminder = `
🔔 DEV_JOURNAL reminder

Commit: «${message}»
Pattern: ${reasonHint}
HEAD diff не содержит DEV_JOURNAL.md изменений.

Per CLAUDE.md §1 — нужна ли запись?
  Триггеры: architecture choice between alternatives | root cause | scope cut | spec adjustment
  НЕ триггеры: typo, dep bump, рутинная правка docs

Если да — добавь entry в DEV_JOURNAL.md и amend / follow-up commit.
Если нет (false positive) — игнорируй; hook не блокирует.
`;
    process.stderr.write(reminder);
}

try {
    main();
} catch (e) {
    // Fail silently
}
