#!/usr/bin/env bash
#
# install-pre-commit.sh — install pre-commit hook for ecosystem repo.
#
# Idempotent: safe to re-run. Backs up existing pre-commit hook (if any) к
# .git/hooks/pre-commit.bak.<timestamp> before overwriting.
#
# Usage:
#   bash dev/meta-improvement/scripts/install-pre-commit.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "ERROR: not в a git repo"
    exit 1
fi

SOURCE="$REPO_ROOT/dev/meta-improvement/scripts/pre-commit.sh"
TARGET="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$SOURCE" ]; then
    echo "ERROR: source script missing: $SOURCE"
    exit 1
fi

# Backup existing hook (if any)
if [ -f "$TARGET" ] && ! cmp -s "$SOURCE" "$TARGET"; then
    BACKUP="$TARGET.bak.$(date +%Y%m%d-%H%M%S)"
    cp "$TARGET" "$BACKUP"
    echo "Existing $TARGET backed up к $BACKUP"
fi

cp "$SOURCE" "$TARGET"
chmod +x "$TARGET"

echo "Installed $TARGET"
echo "Pre-commit hook will now run on every commit, blocking if hooks/ verification fails."
echo ""
echo "Test it: edit a file in hooks/, git add, git commit — should run verify-hooks.js."
echo "Bypass: git commit --no-verify (use sparingly)."
