#!/usr/bin/env bash
# capture-pilot-state.sh — snapshot pilot project state для S7 update-compat smoke
# (см. dev/PHASE_6_SMOKE_TEST_PLAN.md S7 «/ecosystem:update compatibility post 1.4.0»).
#
# Use cases:
#   1. Pre-update snapshot — capture state before `/ecosystem:update` invocation
#   2. Post-update snapshot — re-run после update; diff два файла для verify invariants
#   3. Generic pilot health audit — periodic snapshot для drift detection between sessions
#
# Run from pilot project root (NOT ecosystem repo). Output: .smoke-snapshot-<timestamp>.txt
# в текущей директории. Read-only — no mutations к pilot state.
#
# Cross-platform: bash (works в git bash на Windows; native bash на Linux/macOS).
# Dependencies: find, sha256sum, grep, ls — POSIX standard.
#
# Origin: DEC-DEV-0053 (Phase 6 implementation closure follow-up, 2026-05-28).

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT=".smoke-snapshot-${TIMESTAMP}.txt"

if [ ! -d .product ] && [ ! -d .claude ]; then
  echo "ERROR: neither .product/ nor .claude/ found в $(pwd)." >&2
  echo "Run этот script from pilot project root, NOT ecosystem repo." >&2
  exit 1
fi

{
  echo "=== Pilot state snapshot ($TIMESTAMP) ==="
  echo "Working dir: $(pwd)"
  echo "Hostname: $(hostname 2>/dev/null || echo unknown)"
  echo

  echo "--- .product/ file inventory ---"
  if [ -d .product ]; then
    echo "Total files: $(find .product -type f 2>/dev/null | wc -l)"
    echo "Key artifact checksums (truncated to 16 hex):"
    find .product -type f \( \
        -name "FM-*-*.md" -o -name "SC-*-*.md" -o -name "BR-*-*.md" \
        -o -name "LC-*-*.md" -o -name "VC-*-*.md" -o -name "IC-*-*.md" \
        -o -name "RPM-*.md" -o -name "HYP-*-*.md" -o -name "VP-*-*.md" \
        -o -name "SEG-*-*.md" -o -name "RL-*-*.md" -o -name "NFR-*-*.md" \
        -o -name "design-system.md" -o -name "glossary.md" \
        -o -name "MK-*-*.md" -o -name "NM-*-*.md" \
      \) 2>/dev/null | sort | while read -r f; do
      h=$(sha256sum "$f" 2>/dev/null | cut -c1-16)
      echo "  $h  $f"
    done
  else
    echo "ABSENT"
  fi
  echo

  echo "--- .claude/ ecosystem namespaces ---"
  for d in commands skills agents hooks; do
    if [ -d ".claude/$d" ]; then
      ns=$(ls -1 ".claude/$d" 2>/dev/null | tr '\n' ' ')
      echo "  .claude/$d/: $ns"
    fi
  done
  echo

  echo "--- .claude/settings.local.json ---"
  if [ -f .claude/settings.local.json ]; then
    sha256sum .claude/settings.local.json 2>/dev/null
    echo "hook entries count: $(grep -c '"command"' .claude/settings.local.json 2>/dev/null || echo 0)"
  else
    echo "ABSENT"
  fi
  echo

  echo "--- .claude/design.yaml (per-project Design Module config — DEC-DEV-0053) ---"
  if [ -f .claude/design.yaml ]; then
    sha256sum .claude/design.yaml 2>/dev/null
    echo "default_design_tool:"
    grep '^default_design_tool:' .claude/design.yaml 2>/dev/null || echo "(missing key)"
  else
    echo "ABSENT (expected pre-Phase-6 OR if no /design:start invocation yet — auto-created on first call)"
  fi
  echo

  echo "--- .claude/integrator/active-tools.yaml ---"
  if [ -f .claude/integrator/active-tools.yaml ]; then
    sha256sum .claude/integrator/active-tools.yaml 2>/dev/null
    echo "claude_primitives paths outside .claude/ (для backup Step 2b verification):"
    grep -E '^\s+path:' .claude/integrator/active-tools.yaml 2>/dev/null | grep -v '\.claude/' | head -20 || echo "  (none)"
  else
    echo "ABSENT"
  fi
  echo

  echo "--- .claude/pending-actions.md ---"
  if [ -f .claude/pending-actions.md ]; then
    sha256sum .claude/pending-actions.md 2>/dev/null
    echo "PA entry count: $(grep -c '^## PA-' .claude/pending-actions.md 2>/dev/null || echo 0)"
  else
    echo "ABSENT"
  fi
  echo

  echo "--- Third-party external paths (integrator-managed — backup target Step 2b) ---"
  for ext in .kiro .beads .obsidian; do
    if [ -d "$ext" ]; then
      cnt=$(find "$ext" -type f 2>/dev/null | wc -l)
      echo "  $ext/: $cnt files"
    fi
  done
  echo

  echo "--- Third-party namespaces в .claude/ (managed by Integrator, preserved by 1.3.5 namespace-aware sync) ---"
  for d in commands skills agents hooks; do
    if [ -d ".claude/$d" ]; then
      # Managed ecosystem namespaces: product / integrator / ecosystem / design
      # Anything else = third-party (cc-sdd kiro-*, etc.)
      third_party=$(ls -1 ".claude/$d" 2>/dev/null | grep -v -E '^(product|integrator|ecosystem|design|manifest\.yaml)$' || true)
      if [ -n "$third_party" ]; then
        echo "  .claude/$d/: $(echo "$third_party" | tr '\n' ' ')"
      fi
    fi
  done
  echo

  echo "--- Existing .claude-backup-* directories ---"
  ls -d .claude-backup-* 2>/dev/null | head -5 || echo "  (none)"
} > "$OUT"

echo "Snapshot saved: $OUT"
echo
echo "Next steps for S7 update-compat verification:"
echo "  1. Review snapshot: cat $OUT"
echo "  2. Run /ecosystem:update --dry-run (в Claude Code сессии на pilot) — preview changeset"
echo "  3. Verify preview: design namespaces в added list; third-party preserved; design.yaml не в overwrite path"
echo "  4. Apply: /ecosystem:update (без --dry-run; backup default — creates .claude-backup-<ts>/)"
echo "  5. Re-run этот script — output: новый .smoke-snapshot-<new-ts>.txt"
echo "  6. diff old new — verify invariants (см. dev/PHASE_6_SMOKE_TEST_PLAN.md S7 pass criteria):"
echo "     • .product/ checksums identical (invariant)"
echo "     • .claude/{commands,skills,agents,hooks}/ now includes 'design' namespace (managed re-derived)"
echo "     • settings.local.json hook count +1 (design-artifact-validate registered); third-party hooks preserved"
echo "     • .claude/design.yaml ABSENT both snapshots (auto-creates only at first /design:start)"
echo "     • Third-party namespaces preserved (kiro-*, etc. — namespace-aware sync 1.3.5)"
echo "     • External paths (.kiro, .beads file counts identical)"
echo "     • .claude-backup-<ts>/ directory created (rollback path)"
