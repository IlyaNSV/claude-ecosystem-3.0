# Ecosystem 3.0 - Global Installer (Windows PowerShell)
#
# One-liner:
#   iwr -useb https://raw.githubusercontent.com/IlyaNSV/claude-ecosystem-3.0/main/install.ps1 | iex
#
# Or manual:
#   git clone https://github.com/IlyaNSV/claude-ecosystem-3.0.git $env:TEMP\eco
#   & $env:TEMP\eco\install.ps1

$ErrorActionPreference = "Stop"

# ============================================================
# Output encoding (PowerShell 5.1 defaults to Windows-1252 which
# mangles non-ASCII. Force UTF-8 for consistent rendering.)
# ============================================================
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Non-fatal: just means box chars may render imperfectly on old consoles
}

# ============================================================
# Configuration
# ============================================================
$RepoUrl       = if ($env:ECOSYSTEM_REPO_URL) { $env:ECOSYSTEM_REPO_URL } else { "https://github.com/IlyaNSV/claude-ecosystem-3.0.git" }
$Branch        = if ($env:ECOSYSTEM_BRANCH)   { $env:ECOSYSTEM_BRANCH }   else { "main" }
$ClaudeHome    = if ($env:CLAUDE_HOME)        { $env:CLAUDE_HOME }        else { Join-Path $env:USERPROFILE ".claude" }
$EcosystemDir  = Join-Path $ClaudeHome "ecosystem"
$CommandsDir   = Join-Path $ClaudeHome "commands\ecosystem"

# ============================================================
# Helpers (ASCII-only output for PowerShell 5.1 compatibility)
# ============================================================
function Say     { param($msg) Write-Host "-> $msg" -ForegroundColor Cyan }
function Ok      { param($msg) Write-Host "[ok] $msg" -ForegroundColor Green }
function Warn    { param($msg) Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Die     { param($msg) Write-Host "[fail] $msg" -ForegroundColor Red; exit 1 }
function Divider { Write-Host "=================================================" -ForegroundColor DarkGray }

Divider
Write-Host "  Ecosystem 3.0 - Global Installer (Windows)"
Divider
Write-Host ""

# ============================================================
# Prerequisites
# ============================================================
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Die "git not found. Install Git for Windows first: https://git-scm.com/download/win"
}

# ============================================================
# Clone or update ecosystem repo (global cache)
# ============================================================
if (Test-Path (Join-Path $EcosystemDir ".git")) {
    Say "Updating existing ecosystem at $EcosystemDir..."
    Push-Location $EcosystemDir
    try {
        git fetch origin $Branch --quiet
        git checkout $Branch --quiet
        git reset --hard "origin/$Branch" --quiet
    } finally {
        Pop-Location
    }
} else {
    Say "Cloning ecosystem to $EcosystemDir..."
    New-Item -ItemType Directory -Force -Path $ClaudeHome | Out-Null
    git clone --branch $Branch --quiet $RepoUrl $EcosystemDir
}

# ============================================================
# Install user-global slash commands (/ecosystem:*)
# ============================================================
Say "Installing global /ecosystem:* commands to $CommandsDir..."
New-Item -ItemType Directory -Force -Path $CommandsDir | Out-Null

$sourceCmds = Join-Path $EcosystemDir "commands\ecosystem\*.md"
if (Test-Path (Join-Path $EcosystemDir "commands\ecosystem")) {
    $mdFiles = Get-ChildItem -Path (Join-Path $EcosystemDir "commands\ecosystem") -Filter *.md -ErrorAction SilentlyContinue
    if ($mdFiles.Count -gt 0) {
        Copy-Item -Force -Path $sourceCmds -Destination $CommandsDir
    } else {
        Warn "No commands/ecosystem/*.md found in cache. Slash commands NOT installed."
    }
} else {
    Warn "commands/ecosystem/ directory missing in cache. Slash commands NOT installed."
}

# ============================================================
# Version reporting
# ============================================================
$version = "unknown"
$changelogPath = Join-Path $EcosystemDir "CHANGELOG.md"
if (Test-Path $changelogPath) {
    $match = Select-String -Path $changelogPath -Pattern '^## \[([^\]]+)\]' | Select-Object -First 1
    if ($match) {
        $version = $match.Matches.Groups[1].Value
    }
}

Write-Host ""
Ok "Ecosystem 3.0 installed globally (version $version)."
Write-Host ""
Write-Host "    Global cache:    $EcosystemDir"
Write-Host "    Global commands: $CommandsDir"
Write-Host ""

# ============================================================
# Next steps
# ============================================================
Divider
Write-Host "  Next steps"
Divider
Write-Host ""
Write-Host "  1. Create a new product folder:"
Write-Host "     > mkdir my-new-product; cd my-new-product"
Write-Host ""
Write-Host "  2. Launch Claude Code:"
Write-Host "     > claude"
Write-Host ""
Write-Host "  3. In Claude Code, type (autocomplete available):"
Write-Host "     > /ecosystem:bootstrap"
Write-Host ""
Write-Host "  The ecosystem will install itself into the project's .claude\"
Write-Host "  directory and guide you through API keys, MCP setup, and config."
Write-Host ""
Write-Host "  Docs:            $EcosystemDir\README.md"
Write-Host "  Human checklist: $EcosystemDir\INSTALL-HUMAN.md"
Write-Host ""
