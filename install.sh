#!/usr/bin/env bash
# Ecosystem 3.0 — Global Installer (Unix / macOS / WSL / Git Bash)
#
# One-liner:
#   curl -sSL https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.sh | bash
#
# Or manual:
#   git clone https://github.com/IlyaNSV/claude-ecosystem-3.0.git /tmp/eco && bash /tmp/eco/install.sh

set -euo pipefail

# ============================================================
# Configuration
# ============================================================
REPO_URL="${ECOSYSTEM_REPO_URL:-https://github.com/IlyaNSV/claude-ecosystem-3.0.git}"
BRANCH="${ECOSYSTEM_BRANCH:-main}"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
ECOSYSTEM_DIR="$CLAUDE_HOME/ecosystem"
COMMANDS_DIR="$CLAUDE_HOME/commands/ecosystem"

# ============================================================
# Helpers
# ============================================================
say()     { printf "\033[1;36m→\033[0m %s\n" "$*"; }
ok()      { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn()    { printf "\033[1;33m⚠\033[0m %s\n" "$*" >&2; }
die()     { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }
divider() { printf "\033[1;30m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n"; }

divider
echo "  Ecosystem 3.0 — Global Installer"
divider
echo ""

# ============================================================
# Prerequisites
# ============================================================
command -v git >/dev/null 2>&1 || die "git not found. Install git first: https://git-scm.com/"

# ============================================================
# Clone or update ecosystem repo (global cache)
# ============================================================
if [ -d "$ECOSYSTEM_DIR/.git" ]; then
  say "Updating existing ecosystem at $ECOSYSTEM_DIR..."
  (
    cd "$ECOSYSTEM_DIR"
    git fetch origin "$BRANCH" --quiet
    git checkout "$BRANCH" --quiet
    git reset --hard "origin/$BRANCH" --quiet
  )
else
  say "Cloning ecosystem to $ECOSYSTEM_DIR..."
  mkdir -p "$CLAUDE_HOME"
  git clone --branch "$BRANCH" --quiet "$REPO_URL" "$ECOSYSTEM_DIR"
fi

# ============================================================
# Install user-global slash commands (/ecosystem:*)
# ============================================================
say "Installing global /ecosystem:* commands to $COMMANDS_DIR..."
mkdir -p "$COMMANDS_DIR"

if [ -d "$ECOSYSTEM_DIR/commands/ecosystem" ] && \
   ls "$ECOSYSTEM_DIR/commands/ecosystem/"*.md >/dev/null 2>&1; then
  cp -f "$ECOSYSTEM_DIR/commands/ecosystem/"*.md "$COMMANDS_DIR/"
else
  warn "No commands/ecosystem/*.md found in cache. Slash commands NOT installed."
  warn "Global cache available at $ECOSYSTEM_DIR, but /ecosystem:bootstrap won't autocomplete."
fi

# ============================================================
# Version reporting
# ============================================================
VERSION="unknown"
if [ -f "$ECOSYSTEM_DIR/CHANGELOG.md" ]; then
  VERSION=$(grep -m1 '^## \[' "$ECOSYSTEM_DIR/CHANGELOG.md" 2>/dev/null | sed -E 's/^## \[([^]]+)\].*/\1/' || echo "unknown")
fi

echo ""
ok  "Ecosystem 3.0 installed globally (version $VERSION)."
echo ""
echo "    Global cache:       $ECOSYSTEM_DIR"
echo "    Global commands:    $COMMANDS_DIR"
echo ""

# ============================================================
# Next steps
# ============================================================
divider
echo "  Next steps"
divider
echo ""
echo "  1. Create a new product folder:"
echo "     \$ mkdir my-new-product && cd my-new-product"
echo ""
echo "  2a. Launch Claude Code WITH bypass (fastest, 0 prompts):"
echo "     \$ claude --dangerously-skip-permissions"
echo ""
echo "  2b. Or standard launch (asks to pre-stage allowlist at Step 1d):"
echo "     \$ claude"
echo ""
echo "  3. In Claude Code, type (autocomplete available):"
echo "     > /ecosystem:bootstrap"
echo ""
echo "  After bootstrap completes (Mode 2a only):"
echo "     > /exit"
echo "     \$ claude        # relaunch normally for daily work"
echo ""
echo "  The ecosystem will install itself into the project's .claude/"
echo "  and guide you through API keys, MCP setup, and initial config."
echo ""
echo "  Docs:  $ECOSYSTEM_DIR/README.md"
echo "  Human checklist: $ECOSYSTEM_DIR/INSTALL-HUMAN.md"
echo ""
