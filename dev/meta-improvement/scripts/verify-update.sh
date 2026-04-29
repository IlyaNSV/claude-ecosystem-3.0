#!/usr/bin/env bash
#
# verify-update.sh — D7 verification script для post-/ecosystem:update outcome
#
# Validates that /ecosystem:update produced correct state on a pilot project.
# Complements Step 7 (cleanup + verify) of /ecosystem:update.md.
#
# Usage:
#   ./verify-update.sh [path-to-pilot-project]
#
# Default path = current working directory.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#
# Per DEC-DEV-0021 Stage 4b. User concern: «убедиться что update работает корректно».

set -u

PROJECT_PATH="${1:-.}"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
    echo "  ✓ $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo "  ✗ $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
    echo "  ⚠ $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

echo "================================================================"
echo "  /ecosystem:update outcome verification"
echo "================================================================"
echo ""
echo "Project: $PROJECT_PATH"
echo ""

# Check 1: Project has .claude/ directory
echo "Check 1: .claude/ directory present"
if [ -d "$PROJECT_PATH/.claude" ]; then
    pass ".claude/ exists"
else
    fail ".claude/ MISSING — wrong path? not bootstrapped?"
    echo ""
    echo "Result: ABORT (no .claude/ to verify)"
    exit 1
fi
echo ""

# Check 2: Ecosystem signature
echo "Check 2: Ecosystem signature (3 critical files)"
SIG_FILES=(
    ".claude/docs/pmo/pmo-map.md"
    ".claude/commands/ecosystem/bootstrap.md"
    ".claude/docs/integrator-module/SPEC.md"
)
for f in "${SIG_FILES[@]}"; do
    if [ -f "$PROJECT_PATH/$f" ]; then
        pass "$f"
    else
        fail "$f MISSING"
    fi
done
echo ""

# Check 3: Backup directory exists (post-update default)
echo "Check 3: Backup directory present (post-update default)"
BACKUP_COUNT=$(find "$PROJECT_PATH" -maxdepth 1 -type d -name ".claude-backup-*" 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -ge 1 ]; then
    pass "Found $BACKUP_COUNT backup directory(ies) — rollback path available"
    LATEST_BACKUP=$(find "$PROJECT_PATH" -maxdepth 1 -type d -name ".claude-backup-*" | sort -r | head -1)
    echo "      Latest: $(basename "$LATEST_BACKUP")"
else
    warn "No .claude-backup-* directory — was --no-backup used? Or never updated?"
fi
echo ""

# Check 4: Allowlist subdirs present
echo "Check 4: Ecosystem-zone subdirs present"
ALLOWLIST_DIRS=(
    "commands"
    "skills"
    "agents"
    "hooks"
    "docs"
    "templates"
)
for d in "${ALLOWLIST_DIRS[@]}"; do
    if [ -d "$PROJECT_PATH/.claude/$d" ]; then
        COUNT=$(find "$PROJECT_PATH/.claude/$d" -type f 2>/dev/null | wc -l)
        pass ".claude/$d/ ($COUNT files)"
    else
        fail ".claude/$d/ MISSING"
    fi
done
echo ""

# Check 5: Hook manifest present + parseable
echo "Check 5: Hook manifest"
MANIFEST="$PROJECT_PATH/.claude/hooks/product/manifest.yaml"
if [ -f "$MANIFEST" ]; then
    pass "manifest.yaml present"
    HOOK_COUNT=$(grep -c "^  - id:" "$MANIFEST" 2>/dev/null || echo "0")
    echo "      Registered hooks в manifest: $HOOK_COUNT"
else
    fail "hooks/product/manifest.yaml MISSING"
fi
echo ""

# Check 6: settings.json valid + hooks section present
echo "Check 6: settings.json structure"
SETTINGS="$PROJECT_PATH/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
    pass "settings.json present"
    if command -v node >/dev/null 2>&1; then
        if node -e "JSON.parse(require('fs').readFileSync('$SETTINGS','utf8'))" 2>/dev/null; then
            pass "settings.json is valid JSON"
        else
            fail "settings.json INVALID JSON — manual inspection needed"
        fi
        # Count hook command entries
        HOOK_CMD_COUNT=$(grep -c '"command"' "$SETTINGS" 2>/dev/null || echo "0")
        # Each hook entry has 2 "command" matches (type + command field)
        HOOK_REGISTERED=$((HOOK_CMD_COUNT / 2))
        if [ "$HOOK_REGISTERED" -gt 0 ]; then
            pass "settings.json contains $HOOK_REGISTERED hook command entries"
            if [ -n "${HOOK_COUNT:-}" ] && [ "$HOOK_COUNT" -gt 0 ]; then
                if [ "$HOOK_REGISTERED" -eq "$HOOK_COUNT" ]; then
                    pass "settings.json hooks count matches manifest count ($HOOK_COUNT)"
                else
                    warn "settings.json hook count ($HOOK_REGISTERED) ≠ manifest count ($HOOK_COUNT) — may need re-derivation"
                fi
            fi
        else
            fail "settings.json hooks section EMPTY — hooks installed but unregistered"
        fi
    else
        warn "node not available — skipping JSON validity check"
    fi
else
    fail "settings.json MISSING"
fi
echo ""

# Check 7: No dev contamination (CRITICAL — primary fix from DEC-DEV-0019)
echo "Check 7: Dev contamination absent (DEC-DEV-0019 Finding A)"
CONTAMINATION_FILES=(
    ".claude/CLAUDE.md"
    ".claude/DEV_JOURNAL.md"
    ".claude/INSTALL-HUMAN.md"
)
for f in "${CONTAMINATION_FILES[@]}"; do
    if [ -f "$PROJECT_PATH/$f" ]; then
        fail "$f PRESENT — dev contamination! Should NOT exist в user project. Recommend: rm $PROJECT_PATH/$f"
    else
        pass "$f correctly absent"
    fi
done

# .claude/dev/ check — accept user-added files like discovery_session_log.txt
if [ -d "$PROJECT_PATH/.claude/dev" ]; then
    DEV_FILES=$(find "$PROJECT_PATH/.claude/dev" -type f 2>/dev/null)
    DEV_COUNT=$(echo "$DEV_FILES" | grep -c "." 2>/dev/null || echo "0")
    if [ -n "$DEV_FILES" ]; then
        # Check if any are ecosystem-internal (PHASE_*, meta-improvement/, v1_1_backlog)
        ECOSYSTEM_DEV_CONTAMINATION=$(echo "$DEV_FILES" | grep -E "PHASE_|meta-improvement|v1_1_backlog" 2>/dev/null || true)
        if [ -n "$ECOSYSTEM_DEV_CONTAMINATION" ]; then
            fail ".claude/dev/ contains ecosystem-dev files (contamination):"
            echo "$ECOSYSTEM_DEV_CONTAMINATION" | sed 's/^/        /'
            echo "      Recommend: rm -rf $PROJECT_PATH/.claude/dev/{PHASE_*,meta-improvement,v1_1_backlog.md}"
        else
            pass ".claude/dev/ contains only user files ($DEV_COUNT files, all non-ecosystem)"
        fi
    fi
else
    pass ".claude/dev/ correctly absent"
fi
echo ""

# Check 8: User zone preserved
echo "Check 8: User zone preserved"
USER_FILES=(
    ".claude/settings.local.json"
    ".claude/product.yaml"
)
for f in "${USER_FILES[@]}"; do
    if [ -f "$PROJECT_PATH/$f" ]; then
        pass "$f present"
    else
        warn "$f absent — was bootstrap completed? (Optional file may be missing if user removed)"
    fi
done

# .product/ check
if [ -d "$PROJECT_PATH/.product" ]; then
    PRODUCT_COUNT=$(find "$PROJECT_PATH/.product" -type f 2>/dev/null | wc -l)
    pass ".product/ present ($PRODUCT_COUNT files — artifacts intact)"
else
    warn ".product/ absent — bootstrap pending or .product/ removed?"
fi
echo ""

# Check 9: Self-update validation (update.md present after sync)
echo "Check 9: Self-update validation"
if [ -f "$PROJECT_PATH/.claude/commands/ecosystem/update.md" ]; then
    pass ".claude/commands/ecosystem/update.md present (update synced itself successfully)"
else
    warn ".claude/commands/ecosystem/update.md absent — first-time install? OR upstream missing file? OR allowlist filter excluded it?"
fi
echo ""

# Summary
echo "================================================================"
echo "  Summary"
echo "================================================================"
echo "  Passed:   $PASS_COUNT"
echo "  Failed:   $FAIL_COUNT"
echo "  Warnings: $WARN_COUNT"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "✓ Update verification PASSED"
    if [ "$WARN_COUNT" -gt 0 ]; then
        echo "  ($WARN_COUNT warnings — review above; не blocking)"
    fi
    exit 0
else
    echo "✗ Update verification FAILED ($FAIL_COUNT critical issues)"
    echo ""
    echo "Recommended actions:"
    echo "  - Review failures above"
    echo "  - Consider rollback: rm -rf .claude && mv .claude-backup-<timestamp> .claude"
    echo "  - File issue с findings"
    exit 1
fi
