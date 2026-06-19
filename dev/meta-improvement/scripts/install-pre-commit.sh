#!/usr/bin/env bash
#
# install-pre-commit.sh — install the ecosystem git hooks (DEC-DEV-0023 + DEC-DEV-0083).
#
# Installs TWO hooks:
#   - pre-commit  → pre-commit.sh   (hook-smoke gate; blocks on hooks/ verification failure)
#   - commit-msg  → commit-msg.sh   (D7 process gate; blocks on count drift / missing
#                                     CHANGELOG / missing DEV_JOURNAL — process-gate.js)
#
# Idempotent: safe to re-run. Backs up any pre-existing hook before overwriting.
# Worktree-safe: resolves the real hooks dir via `git rev-parse --git-path hooks`
# (in a worktree `.git` is a file, so the old hard-coded `$REPO_ROOT/.git/hooks` was wrong).
#
# Usage:
#   bash dev/meta-improvement/scripts/install-pre-commit.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "ERROR: not in a git repo"
    exit 1
fi

# Worktree-safe hooks dir (shared common dir across worktrees)
HOOKS_DIR="$(git rev-parse --git-path hooks)"
mkdir -p "$HOOKS_DIR"

install_hook() {
    local name="$1"          # git hook name (pre-commit / commit-msg)
    local source_basename="$2"
    local source="$REPO_ROOT/dev/meta-improvement/scripts/$source_basename"
    local target="$HOOKS_DIR/$name"

    if [ ! -f "$source" ]; then
        echo "ERROR: source script missing: $source"
        exit 1
    fi

    if [ -f "$target" ] && ! cmp -s "$source" "$target"; then
        local backup="$target.bak.$(date +%Y%m%d-%H%M%S)"
        cp "$target" "$backup"
        echo "Existing $target backed up to $backup"
    fi

    cp "$source" "$target"
    chmod +x "$target"
    echo "Installed $name → $target"
}

install_hook pre-commit pre-commit.sh
install_hook commit-msg  commit-msg.sh

echo ""
echo "Git hooks installed:"
echo "  pre-commit — runs verify-hooks.js when hooks/ change (DEC-DEV-0023)"
echo "  commit-msg — D7 process gate: count drift / CHANGELOG / DEV_JOURNAL (DEC-DEV-0083)"
echo ""
echo "Bypass a single commit: add [skip-process-gate] to the message, or git commit --no-verify"
echo "(use sparingly — CLAUDE.md forbids --no-verify without explicit need)."
