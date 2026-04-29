# verify-update.ps1 — D7 verification script для post-/ecosystem:update outcome (PowerShell)
#
# Validates that /ecosystem:update produced correct state on a pilot project.
# Complements Step 7 (cleanup + verify) of /ecosystem:update.md.
#
# Usage:
#   .\verify-update.ps1 [-ProjectPath <path>]
#
# Default ProjectPath = current working directory.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#
# Per DEC-DEV-0021 Stage 4b. User concern: «убедиться что update работает корректно».

param(
    [string]$ProjectPath = (Get-Location).Path
)

$ProjectPath = (Resolve-Path $ProjectPath).Path

$script:PassCount = 0
$script:FailCount = 0
$script:WarnCount = 0

function Pass($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:PassCount++
}

function Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:FailCount++
}

function Warn($msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
    $script:WarnCount++
}

Write-Host "================================================================"
Write-Host "  /ecosystem:update outcome verification"
Write-Host "================================================================"
Write-Host ""
Write-Host "Project: $ProjectPath"
Write-Host ""

# Check 1: Project has .claude/ directory
Write-Host "Check 1: .claude/ directory present"
if (Test-Path -Path "$ProjectPath\.claude" -PathType Container) {
    Pass ".claude/ exists"
} else {
    Fail ".claude/ MISSING — wrong path? not bootstrapped?"
    Write-Host ""
    Write-Host "Result: ABORT (no .claude/ to verify)"
    exit 1
}
Write-Host ""

# Check 2: Ecosystem signature
Write-Host "Check 2: Ecosystem signature (3 critical files)"
$sigFiles = @(
    ".claude\docs\pmo\pmo-map.md",
    ".claude\commands\ecosystem\bootstrap.md",
    ".claude\docs\integrator-module\SPEC.md"
)
foreach ($f in $sigFiles) {
    if (Test-Path -Path "$ProjectPath\$f" -PathType Leaf) {
        Pass $f
    } else {
        Fail "$f MISSING"
    }
}
Write-Host ""

# Check 3: Backup directory
Write-Host "Check 3: Backup directory present (post-update default)"
$backups = Get-ChildItem -Path $ProjectPath -Directory -Filter ".claude-backup-*" -ErrorAction SilentlyContinue
if ($backups.Count -ge 1) {
    Pass "Found $($backups.Count) backup directory(ies) — rollback path available"
    $latest = $backups | Sort-Object Name -Descending | Select-Object -First 1
    Write-Host "      Latest: $($latest.Name)"
} else {
    Warn "No .claude-backup-* directory — was --no-backup used? Or never updated?"
}
Write-Host ""

# Check 4: Allowlist subdirs
Write-Host "Check 4: Ecosystem-zone subdirs present"
$allowDirs = @("commands", "skills", "agents", "hooks", "docs", "templates")
foreach ($d in $allowDirs) {
    $dirPath = "$ProjectPath\.claude\$d"
    if (Test-Path -Path $dirPath -PathType Container) {
        $count = (Get-ChildItem -Path $dirPath -Recurse -File -ErrorAction SilentlyContinue).Count
        Pass ".claude/$d/ ($count files)"
    } else {
        Fail ".claude/$d/ MISSING"
    }
}
Write-Host ""

# Check 5: Hook manifest
Write-Host "Check 5: Hook manifest"
$manifest = "$ProjectPath\.claude\hooks\product\manifest.yaml"
$hookCount = 0
if (Test-Path -Path $manifest -PathType Leaf) {
    Pass "manifest.yaml present"
    $hookCount = (Select-String -Path $manifest -Pattern "^  - id:" -ErrorAction SilentlyContinue).Count
    Write-Host "      Registered hooks в manifest: $hookCount"
} else {
    Fail "hooks/product/manifest.yaml MISSING"
}
Write-Host ""

# Check 6: settings.json
Write-Host "Check 6: settings.json structure"
$settings = "$ProjectPath\.claude\settings.json"
if (Test-Path -Path $settings -PathType Leaf) {
    Pass "settings.json present"
    try {
        $json = Get-Content -Path $settings -Raw | ConvertFrom-Json
        Pass "settings.json is valid JSON"
        # Count hook command entries
        $cmdMatches = (Select-String -Path $settings -Pattern '"command"' -AllMatches).Matches.Count
        $hookRegistered = [math]::Floor($cmdMatches / 2)
        if ($hookRegistered -gt 0) {
            Pass "settings.json contains $hookRegistered hook command entries"
            if ($hookCount -gt 0) {
                if ($hookRegistered -eq $hookCount) {
                    Pass "settings.json hooks count matches manifest count ($hookCount)"
                } else {
                    Warn "settings.json hook count ($hookRegistered) != manifest count ($hookCount) — may need re-derivation"
                }
            }
        } else {
            Fail "settings.json hooks section EMPTY — hooks installed but unregistered"
        }
    } catch {
        Fail "settings.json INVALID JSON — manual inspection needed"
    }
} else {
    Fail "settings.json MISSING"
}
Write-Host ""

# Check 7: No dev contamination (CRITICAL)
Write-Host "Check 7: Dev contamination absent (DEC-DEV-0019 Finding A)"
$contaminationFiles = @(
    ".claude\CLAUDE.md",
    ".claude\DEV_JOURNAL.md",
    ".claude\INSTALL-HUMAN.md"
)
foreach ($f in $contaminationFiles) {
    if (Test-Path -Path "$ProjectPath\$f" -PathType Leaf) {
        Fail "$f PRESENT — dev contamination! Should NOT exist в user project."
    } else {
        Pass "$f correctly absent"
    }
}

# .claude/dev/ check
$devDir = "$ProjectPath\.claude\dev"
if (Test-Path -Path $devDir -PathType Container) {
    $devFiles = Get-ChildItem -Path $devDir -Recurse -File -ErrorAction SilentlyContinue
    if ($devFiles.Count -gt 0) {
        $contamination = $devFiles | Where-Object { $_.Name -match "PHASE_|v1_1_backlog" -or $_.FullName -match "meta-improvement" }
        if ($contamination.Count -gt 0) {
            Fail ".claude/dev/ contains ecosystem-dev files (contamination):"
            $contamination | ForEach-Object { Write-Host "        $($_.FullName)" }
        } else {
            Pass ".claude/dev/ contains only user files ($($devFiles.Count) files, all non-ecosystem)"
        }
    }
} else {
    Pass ".claude/dev/ correctly absent"
}
Write-Host ""

# Check 8: User zone preserved
Write-Host "Check 8: User zone preserved"
$userFiles = @(".claude\settings.local.json", ".claude\product.yaml")
foreach ($f in $userFiles) {
    if (Test-Path -Path "$ProjectPath\$f" -PathType Leaf) {
        Pass "$f present"
    } else {
        Warn "$f absent — was bootstrap completed? (Optional file may be missing if user removed)"
    }
}

if (Test-Path -Path "$ProjectPath\.product" -PathType Container) {
    $productCount = (Get-ChildItem -Path "$ProjectPath\.product" -Recurse -File -ErrorAction SilentlyContinue).Count
    Pass ".product/ present ($productCount files — artifacts intact)"
} else {
    Warn ".product/ absent — bootstrap pending or .product/ removed?"
}
Write-Host ""

# Check 9: Self-update validation
Write-Host "Check 9: Self-update validation"
if (Test-Path -Path "$ProjectPath\.claude\commands\ecosystem\update.md" -PathType Leaf) {
    Pass ".claude/commands/ecosystem/update.md present (update synced itself successfully)"
} else {
    Warn ".claude/commands/ecosystem/update.md absent — first-time install? OR upstream missing file? OR allowlist filter excluded it?"
}
Write-Host ""

# Summary
Write-Host "================================================================"
Write-Host "  Summary"
Write-Host "================================================================"
Write-Host "  Passed:   $script:PassCount"
Write-Host "  Failed:   $script:FailCount"
Write-Host "  Warnings: $script:WarnCount"
Write-Host ""

if ($script:FailCount -eq 0) {
    Write-Host "[PASS] Update verification PASSED" -ForegroundColor Green
    if ($script:WarnCount -gt 0) {
        Write-Host "  ($($script:WarnCount) warnings — review above; not blocking)"
    }
    exit 0
} else {
    Write-Host "[FAIL] Update verification FAILED ($($script:FailCount) critical issues)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Recommended actions:"
    Write-Host "  - Review failures above"
    Write-Host "  - Consider rollback: Remove-Item -Recurse .claude; Move-Item .claude-backup-<timestamp> .claude"
    Write-Host "  - File issue with findings"
    exit 1
}
