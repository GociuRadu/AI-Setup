# Runs the local test tiers in Docker Engine inside WSL2 (see SETUP-WSL.md). Run from {{PROJECT}}/code.
param(
	[ValidateSet('Unit', 'Spark', 'Sql', 'All')][string]$Tier = 'All',
	[string]$Distro = 'Debian'
)
$ErrorActionPreference = 'Stop'

function Invoke-Docker {
	wsl -d $Distro -u root -- docker @args
	if ($LASTEXITCODE -ne 0) { throw "docker $($args -join ' ') failed ($LASTEXITCODE)" }
}

$compose = "$(wsl -d $Distro -- wslpath -a (Join-Path $PSScriptRoot 'docker-compose.yml'))".Trim()
if ($LASTEXITCODE -ne 0 -or -not $compose) { throw "WSL distro '$Distro' is not available; see local/SETUP-WSL.md." }
$label = 'label=com.docker.compose.project={{project}}-local'
$existing = wsl -d $Distro -u root -- docker ps -aq --filter $label
if ($LASTEXITCODE -ne 0) { throw "docker ps failed ($LASTEXITCODE); is Docker running in $Distro?" }
$existingNetwork = wsl -d $Distro -u root -- docker network ls -q --filter $label
if ($LASTEXITCODE -ne 0) { throw "docker network ls failed ($LASTEXITCODE)" }
if ($existing -or $existingNetwork) {
	throw '{{PROJECT}} test containers or network already exist; stop and inspect them before continuing.'
}

$tiers = if ($Tier -eq 'All') { 'Unit', 'Spark', 'Sql' } else { , $Tier }
$previousPassword = [Environment]::GetEnvironmentVariable('MSSQL_SA_PASSWORD', 'Process')
$previousWslEnv = [Environment]::GetEnvironmentVariable('WSLENV', 'Process')
try {
	Invoke-Docker compose -f $compose config -q
	Invoke-Docker compose -f $compose build runner
	foreach ($t in $tiers) {
		if ($t -eq 'Sql') {
			$env:MSSQL_SA_PASSWORD = 'Aa1!' + [Guid]::NewGuid().ToString('N')
			$forwarded = @($previousWslEnv -split ':' | Where-Object { $_ -and $_ -notmatch '^MSSQL_SA_PASSWORD(?:/.*)?$' })
			$env:WSLENV = (@($forwarded) + 'MSSQL_SA_PASSWORD/u') -join ':'
			Invoke-Docker compose -f $compose up -d --wait sqlserver
		}
		Write-Host "== $t tier"
		Invoke-Docker compose -f $compose run --rm --no-deps runner python -B -m unittest discover -s "tests/$($t.ToLower())" -t . -v
	}
}
finally {
	try { wsl -d $Distro -u root -- docker compose -f $compose down }
	finally {
		if ($null -eq $previousPassword) { Remove-Item Env:MSSQL_SA_PASSWORD -ErrorAction SilentlyContinue }
		else { Set-Item Env:MSSQL_SA_PASSWORD $previousPassword }
		if ($null -eq $previousWslEnv) { Remove-Item Env:WSLENV -ErrorAction SilentlyContinue }
		else { Set-Item Env:WSLENV $previousWslEnv }
	}
}
