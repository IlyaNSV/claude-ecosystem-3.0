# capture-pilot-state.ps1 -- snapshot pilot project state for S7 update-compat smoke
# (see dev/PHASE_6_SMOKE_TEST_PLAN.md S7 "/ecosystem:update compatibility post 1.4.0").
#
# Use cases:
#   1. Pre-update snapshot -- capture state before /ecosystem:update invocation
#   2. Post-update snapshot -- re-run after update; diff snapshots to verify invariants
#   3. Generic pilot health audit -- periodic snapshot for drift detection between sessions
#
# Run from pilot project root (NOT ecosystem repo). Output: .smoke-snapshot-<timestamp>.txt
# in current directory. Read-only -- no mutations to pilot state.
#
# Native Windows PowerShell variant. Bash sibling: dev/scripts/capture-pilot-state.sh
#
# Encoding: pure ASCII only -- PowerShell 5.1 default code page (CP1252) cannot read
# UTF-8-no-BOM files reliably. Em-dashes and Cyrillic in original draft caused parse
# errors. Keep this script ASCII-only.
#
# Origin: DEC-DEV-0053 (Phase 6 implementation closure follow-up, 2026-05-28).

$ErrorActionPreference = 'Continue'

if (-not (Test-Path .product) -and -not (Test-Path .claude)) {
  Write-Error "Neither .product\ nor .claude\ found in $(Get-Location). Run from pilot project root, NOT ecosystem repo."
  exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = ".smoke-snapshot-$timestamp.txt"
$out = New-Object System.Collections.ArrayList

function Add-Line($text) { [void]$out.Add($text) }

function Get-ShortHash($path) {
  if (Test-Path $path) {
    $h = (Get-FileHash $path -Algorithm SHA256).Hash
    return $h.Substring(0, 16).ToLower()
  }
  return $null
}

function Get-FullHash($path) {
  if (Test-Path $path) {
    return ((Get-FileHash $path -Algorithm SHA256).Hash).ToLower()
  }
  return $null
}

Add-Line "=== Pilot state snapshot ($timestamp) ==="
Add-Line "Working dir: $(Get-Location)"
Add-Line "Hostname: $env:COMPUTERNAME"
Add-Line ""

Add-Line "--- .product/ file inventory ---"
if (Test-Path .product) {
  $allProductFiles = Get-ChildItem .product -Recurse -File -ErrorAction SilentlyContinue
  Add-Line "Total files: $($allProductFiles.Count)"
  Add-Line "Key artifact checksums (truncated to 16 hex):"
  $patterns = @(
    'FM-*-*.md', 'SC-*-*.md', 'BR-*-*.md', 'LC-*-*.md',
    'VC-*-*.md', 'IC-*-*.md', 'RPM-*.md',
    'HYP-*-*.md', 'VP-*-*.md', 'SEG-*-*.md', 'RL-*-*.md', 'NFR-*-*.md',
    'design-system.md', 'glossary.md',
    'MK-*-*.md', 'NM-*-*.md'
  )
  $matched = @()
  foreach ($pat in $patterns) {
    $matched += Get-ChildItem .product -Recurse -File -Filter $pat -ErrorAction SilentlyContinue
  }
  $matched = $matched | Sort-Object -Property FullName -Unique
  foreach ($f in $matched) {
    $rel = $f.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    $h = Get-ShortHash $f.FullName
    Add-Line "  $h  $rel"
  }
} else {
  Add-Line "ABSENT"
}
Add-Line ""

Add-Line "--- .claude/ ecosystem namespaces ---"
foreach ($d in @('commands', 'skills', 'agents', 'hooks')) {
  $dir = ".claude\$d"
  if (Test-Path $dir) {
    $ns = Get-ChildItem $dir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
    $nsStr = ($ns -join ' ')
    Add-Line "  .claude/${d}/: $nsStr"
  }
}
Add-Line ""

Add-Line "--- .claude/settings.local.json ---"
$slPath = ".claude\settings.local.json"
if (Test-Path $slPath) {
  $h = Get-FullHash $slPath
  Add-Line "$h *.claude/settings.local.json"
  $hookCount = (Select-String -Path $slPath -Pattern '"command"' -AllMatches -ErrorAction SilentlyContinue).Matches.Count
  if ($null -eq $hookCount) { $hookCount = 0 }
  Add-Line "hook entries count: $hookCount"
} else {
  Add-Line "ABSENT"
}
Add-Line ""

Add-Line "--- .claude/design.yaml (per-project Design Module config -- DEC-DEV-0053) ---"
$dyPath = ".claude\design.yaml"
if (Test-Path $dyPath) {
  $h = Get-FullHash $dyPath
  Add-Line "$h *.claude/design.yaml"
  Add-Line "default_design_tool:"
  $line = Select-String -Path $dyPath -Pattern '^default_design_tool:' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($line) { Add-Line $line.Line } else { Add-Line "(missing key)" }
} else {
  Add-Line "ABSENT (expected pre-Phase-6 OR if no /design:start yet -- auto-creates on first call)"
}
Add-Line ""

Add-Line "--- .claude/integrator/active-tools.yaml ---"
$atPath = ".claude\integrator\active-tools.yaml"
if (Test-Path $atPath) {
  $h = Get-FullHash $atPath
  Add-Line "$h *.claude/integrator/active-tools.yaml"
  Add-Line "claude_primitives paths outside .claude/ (for backup Step 2b verification):"
  $paths = Select-String -Path $atPath -Pattern '^\s+path:' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '\.claude/' } | Select-Object -First 20
  if ($paths) {
    foreach ($p in $paths) { Add-Line $p.Line }
  } else {
    Add-Line "  (none)"
  }
} else {
  Add-Line "ABSENT"
}
Add-Line ""

Add-Line "--- .claude/pending-actions.md ---"
$paPath = ".claude\pending-actions.md"
if (Test-Path $paPath) {
  $h = Get-FullHash $paPath
  Add-Line "$h *.claude/pending-actions.md"
  $paCount = (Select-String -Path $paPath -Pattern '^## PA-' -AllMatches -ErrorAction SilentlyContinue).Matches.Count
  if ($null -eq $paCount) { $paCount = 0 }
  Add-Line "PA entry count: $paCount"
} else {
  Add-Line "ABSENT"
}
Add-Line ""

Add-Line "--- Third-party external paths (integrator-managed -- backup target Step 2b) ---"
foreach ($ext in @('.kiro', '.beads', '.obsidian')) {
  if (Test-Path $ext) {
    $cnt = (Get-ChildItem $ext -Recurse -File -ErrorAction SilentlyContinue).Count
    Add-Line "  ${ext}/: $cnt files"
  }
}
Add-Line ""

Add-Line "--- Third-party namespaces in .claude/ (managed by Integrator, preserved by 1.3.5 namespace-aware sync) ---"
$managed = @('product', 'integrator', 'ecosystem', 'design', 'manifest.yaml')
foreach ($d in @('commands', 'skills', 'agents', 'hooks')) {
  $dir = ".claude\$d"
  if (Test-Path $dir) {
    $thirdParty = Get-ChildItem $dir -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin $managed } | ForEach-Object { $_.Name }
    if ($thirdParty.Count -gt 0) {
      $tpStr = ($thirdParty -join ' ')
      Add-Line "  .claude/${d}/: $tpStr"
    }
  }
}
Add-Line ""

Add-Line "--- Existing .claude-backup-* directories ---"
$backups = Get-ChildItem -Directory -Filter '.claude-backup-*' -ErrorAction SilentlyContinue | Select-Object -First 5
if ($backups) {
  foreach ($b in $backups) { Add-Line $b.Name }
} else {
  Add-Line "  (none)"
}

# Write snapshot -- explicit UTF-8 encoding so PowerShell 5.1 reads back reliably
$out -join "`r`n" | Out-File -FilePath $outFile -Encoding utf8

Write-Host "Snapshot saved: $outFile"
Write-Host ""
Write-Host "Next steps for S7 update-compat verification:"
Write-Host "  1. Review snapshot: Get-Content $outFile"
Write-Host "  2. Run /ecosystem:update --dry-run (in Claude Code session on pilot) -- preview changeset"
Write-Host "  3. Verify preview: design namespaces in added list; third-party preserved; design.yaml NOT in overwrite path"
Write-Host "  4. Apply: /ecosystem:update (without --dry-run; backup default -- creates .claude-backup-<ts>\)"
Write-Host "  5. Re-run this script -- output: new .smoke-snapshot-<new-ts>.txt"
Write-Host "  6. Compare-Object (Get-Content old) (Get-Content new) -- verify invariants:"
Write-Host "     - .product/ checksums identical (invariant)"
Write-Host "     - .claude/{commands,skills,agents,hooks}/ now includes 'design' namespace"
Write-Host "     - settings.local.json hook count +1 (design-artifact-validate registered); third-party hooks preserved"
Write-Host "     - .claude/design.yaml ABSENT both snapshots (auto-creates only at first /design:start)"
Write-Host "     - Third-party namespaces preserved (kiro-*, etc.)"
Write-Host "     - External paths (.kiro, .beads file counts identical)"
Write-Host "     - .claude-backup-<ts>\ directory created (rollback path)"
