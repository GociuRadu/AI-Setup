# PreToolUse guard: hard-blocks tool calls that target production or destroy data, even when a prompt is approved.
# Input: hook JSON on stdin. Block = exit 2 with the reason on stderr plus a deny decision on stdout.
# Extra patterns (real prod hostnames, one regex per line, # comments): prod-markers.txt next to this script.
$ErrorActionPreference = 'Stop'
try {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
} catch {
    exit 0  # shortcut: unreadable input passes; the command-approval hook still asks
}

# Only fields that reach a system are checked, so editing docs that mention "production" is not blocked.
$fieldPattern = '^(command|commandLine|cmd|script|query|sql|server|host|hostname|database|connection.*|url|uri|endpoint)$'
$values = New-Object System.Collections.Generic.List[string]
function Add-Values($node) {
    if ($null -eq $node) { return }
    foreach ($p in $node.PSObject.Properties) {
        if ($p.Value -is [string]) {
            if ($p.Name -match $fieldPattern) { $values.Add($p.Value) }
            # A bare target field (server = sql-prd-01) has no "Server=" prefix, so tag it for the connection rule.
            if ($p.Name -match '^(server|host|hostname|endpoint)$') { $values.Add("server=$($p.Value)") }
        }
        elseif ($p.Value -is [System.Management.Automation.PSCustomObject]) { Add-Values $p.Value }
    }
}
# Copilot preToolUse sends toolName/toolArgs (args may arrive as a JSON string); the PreToolUse alias sends tool_name/tool_input.
$toolName = if ($payload.toolName) { $payload.toolName } else { $payload.tool_name }
$toolArgs = if ($null -ne $payload.toolArgs) { $payload.toolArgs } else { $payload.tool_input }
if ($toolArgs -is [string]) {
    try { $toolArgs = $toolArgs | ConvertFrom-Json } catch { $values.Add($toolArgs); $toolArgs = $null }
}
Add-Values $toolArgs
if ($values.Count -eq 0) { exit 0 }
$text = $values -join "`n"

$rules = [ordered]@{
    'production Azure endpoint'        = '(?i)\b[\w-]*(prod|prd)[\w-]*\.(database\.windows\.net|sql\.azuresynapse\.net|dev\.azuresynapse\.net|blob\.core\.windows\.net|dfs\.core\.windows\.net)'
    'production server in a connection' = '(?i)(server|data source|host|-S)\s*[=: ]\s*["'']?(tcp:)?[\w.-]*(prod|prd)\b'
    'production context in a CLI call' = '(?i)\b(kubectl|helm|az|azcopy|func)\b[^\n]*\b(prod|prd|production)\b'
    'DROP DATABASE'                    = '(?i)\bDROP\s+DATABASE\b'
    'force push'                       = '(?i)\bgit\s+push\b[^\n]*(\s--force\b|\s-f\b|--force-with-lease)'
    'volume deletion'                  = '(?i)\b(down\b[^\n]*(\s-v\b|--volumes)|docker\s+volume\s+(rm|prune)|docker\s+system\s+prune)'
}
$markers = Join-Path $PSScriptRoot 'prod-markers.txt'
if (Test-Path $markers) {
    Get-Content $markers | Where-Object { $_.Trim() -and -not $_.TrimStart().StartsWith('#') } |
        ForEach-Object { $rules["prod marker '$($_.Trim())'"] = '(?i)' + $_.Trim() }
}

foreach ($name in $rules.Keys) {
    if ($text -match $rules[$name]) {
        $reason = "prod-guard blocked ${toolName}: $name. Production and data-loss actions are user-run only (global rules, Hard stops)."
        # Exit 2 denies on its own; the JSON carries the reason (top level for Copilot, hookSpecificOutput for the Claude format).
        @{ permissionDecision = 'deny'; permissionDecisionReason = $reason
           hookSpecificOutput = @{ hookEventName = 'PreToolUse'; permissionDecision = 'deny'; permissionDecisionReason = $reason } } |
            ConvertTo-Json -Compress -Depth 3
        [Console]::Error.WriteLine($reason)
        exit 2
    }
}
exit 0
