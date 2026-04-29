#!/usr/bin/env bash
#
# pre-commit.sh — git pre-commit hook for ecosystem repo. Blocks commits if hook
# verification fails (smoke runner + optional eslint).
#
# Install (once):
#   bash dev/meta-improvement/scripts/install-pre-commit.sh
# OR manually:
#   cp dev/meta-improvement/scripts/pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Per DEC-DEV-0023: hook lint pipeline blocking pre-commit. Phase 3 smoke test
# revealed bg-extractor TDZ bug (119 silent failures) — pre-commit gate would
# have caught it on first commit.
#
# Bypass with --no-verify if absolutely needed (don't make a habit).

set -e

# Anchor at repo root (this script lives в .git/hooks/pre-commit when installed)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "pre-commit: not в a git repo, skipping"
    exit 0
fi

# Skip if no hooks/ directory (this hook is ecosystem-specific)
if [ ! -d "$REPO_ROOT/hooks" ]; then
    exit 0
fi

# Only run if any staged file touches hooks/
STAGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
if ! echo "$STAGED" | grep -q "^hooks/"; then
    exit 0
fi

echo "pre-commit: hooks/ change detected — running verify-hooks…"
echo ""

if ! node "$REPO_ROOT/dev/meta-improvement/scripts/verify-hooks.js"; then
    echo ""
    echo "pre-commit: hook verification FAILED — commit blocked."
    echo "  Fix issues above, OR bypass с --no-verify (last resort)."
    exit 1
fi

echo "pre-commit: hooks/ verification passed."
exit 0
