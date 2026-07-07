#!/usr/bin/env bash
#
# install-pre-commit.sh — thin wrapper kept for the documented entry point
# (CLAUDE.md «Установить gate»). The actual logic lives in install-git-hooks.cjs —
# single cross-platform implementation, also auto-run via npm "prepare" on every
# `npm install` / `npm ci` (DEC-DEV-0157; closes audit gap G23: fresh clones used
# to carry NO blocking gate until this script was remembered and run by hand).
#
# Usage:
#   bash dev/meta-improvement/scripts/install-pre-commit.sh   # strict (exit 1 on error)

set -e
exec node "$(dirname "$0")/install-git-hooks.cjs" "$@"
