# Copies the AI setup from this vault copy into the real work workspace (vault dot-* names -> .*).
# Only agents, instructions, skills and hooks; never deletes; keeps the workspace's own prod-markers.txt.
# Usage (from the vault's work folder): .\apply-from-vault.ps1 -Workspace <path to Work> [-WhatIf]
param(
    [Parameter(Mandatory)][string]$Workspace,
    [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '_ai\dot-github'
if (-not (Test-Path $source)) { $source = Join-Path $PSScriptRoot '_ai\.github' }  # repo copy keeps real names
$target = Join-Path $Workspace '_ai\.github'
if (-not (Test-Path (Join-Path $Workspace '_ai'))) { throw "No _ai folder in $Workspace" }

$copied = 0
foreach ($part in 'agents', 'instructions', 'skills', 'hooks') {
    $dir = Join-Path $source $part
    if (-not (Test-Path $dir)) { continue }
    foreach ($file in Get-ChildItem $dir -Recurse -File) {
        $rel = $file.FullName.Substring($source.Length + 1) -replace '(^|\\)dot-', '$1.'
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
Write-Host ("{0} file(s) {1}. Reload VS Code, then run sync-to-vault.ps1." -f $copied, $(if ($WhatIf) { 'would change' } else { 'updated' }))
