# Copies the AI setup from this vault copy into a workspace (vault dot-* names -> .*). Never deletes.
# -Setup work (default): agents, instructions, skills and hooks into <Work>\_ai\.github; keeps the workspace's own prod-markers.txt.
# -Setup personal: the Claude setup (vault root: .claude, _ai with templates, CLAUDE.md, AGENTS.md, guides) into the projects folder.
# Usage (from the vault's work folder): .\apply-from-vault.ps1 -Workspace <path> [-Setup work|personal] [-WhatIf]
param(
    [Parameter(Mandatory)][string]$Workspace,
    [ValidateSet('work', 'personal')][string]$Setup = 'work',
    [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
if ($Setup -eq 'personal') {
    $source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $target = $Workspace
    $parts = 'dot-claude', '.claude', '_ai', 'CLAUDE.md', 'AGENTS.md', 'README.md', 'HOW-TO-USE.md'
}
else {
    $source = Join-Path $PSScriptRoot '_ai\dot-github'
    if (-not (Test-Path $source)) { $source = Join-Path $PSScriptRoot '_ai\.github' }  # repo copy keeps real names
    $target = Join-Path $Workspace '_ai\.github'
    if (-not (Test-Path (Join-Path $Workspace '_ai'))) { throw "No _ai folder in $Workspace" }
    $parts = 'agents', 'instructions', 'skills', 'hooks'
}

$copied = 0
foreach ($part in $parts) {
    $dir = Join-Path $source $part
    if (-not (Test-Path $dir)) { continue }
    foreach ($file in Get-ChildItem $dir -Recurse -File -Force) {
        $rel = $file.FullName.Substring($source.TrimEnd('\').Length + 1) -replace '(^|\\)dot-', '$1.'
        $dest = Join-Path $target $rel
        if ($rel -eq 'hooks\prod-markers.txt' -and (Test-Path $dest)) { Write-Host "keep   $rel (workspace names)"; continue }
        if ((Test-Path $dest) -and ((Get-FileHash $dest).Hash -eq (Get-FileHash $file.FullName).Hash)) { continue }
        Write-Host "copy   $rel"
        if (-not $WhatIf) {
            New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
            Copy-Item $file.FullName $dest -Force
        }
        $copied++
    }
}
$next = if ($Setup -eq 'personal') { 'Start a new Claude Code session in the workspace.' } else { 'Reload VS Code, then run sync-to-vault.ps1.' }
Write-Host ("{0} file(s) {1}. {2}" -f $copied, $(if ($WhatIf) { 'would change' } else { 'updated' }), $next)
