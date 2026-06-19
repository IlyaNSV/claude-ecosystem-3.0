#!/usr/bin/env bash
#
# commit-msg.sh — git commit-msg hook for the ecosystem repo (D7 process gate, DEC-DEV-0083).
#
# Delegates to process-gate.js, which blocks the commit if accumulation/consistency
# obligations are unmet (count drift / missing CHANGELOG / missing DEV_JOURNAL).
#
# Installed (alongside pre-commit) by:
#   bash dev/meta-improvement/scripts/install-pre-commit.sh
#
# No-ops in any repo that is not this ecosystem (process-gate.js absent → exit 0).
# Bypass an individual commit with [skip-process-gate] in the message, or --no-verify
# (last resort — don't make a habit; CLAUDE.md forbids it without explicit need).

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO_ROOT" ] && exit 0

GATE="$REPO_ROOT/dev/meta-improvement/scripts/process-gate.js"
[ -f "$GATE" ] || exit 0

node "$GATE" "$1"
