# project1 local test containers

Docker Engine runs in WSL2 Debian (no Docker Desktop). Always call it from PowerShell as `wsl -d Debian -u root -- docker ...` with Linux paths. Test commands per tier: [docs/ai/project.md](../docs/ai/project.md) (Commands). Not a Synapse emulator.

```powershell
Set-Location .\project1
& '.\local\test.ps1' -Tier All
```

The script validates Compose, builds the runner, runs the selected tier(s), waits for the SQL healthcheck when needed, and cleans up with plain `down`. SQL has no persistent volume, so its data is ephemeral. The runner mounts only tests, fixtures, notebooks, DDL and pipeline JSON read-only; Excel files are excluded. The script refuses to run when project containers or the network already exist. Use `-Tier Unit`, `-Tier Spark`, or `-Tier Sql` to run one tier.

## Shell in the runner

```powershell
$compose = '/mnt/c/<workspace>/project1/local/docker-compose.yml'
wsl -d Debian -u root -- docker compose -f $compose run --rm --no-deps runner bash
```

`/workspace` contains only `tests/`, `project1/Notebooks/`, `project1/TablesDataBase/` and `project1/pipelines/`, mounted read-only; `project1/Data/excels/` is not mounted. Scratch files go to `/tmp`. The SQL password is set only by the SQL test tier.

## Query the local SQL Server yourself

```powershell
$compose = '/mnt/c/<workspace>/project1/local/docker-compose.yml'
$existing = wsl -d Debian -u root -- docker ps -aq --filter label=com.docker.compose.project=project1-local
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker containers in WSL Debian.' }
$existingNetwork = wsl -d Debian -u root -- docker network ls -q --filter label=com.docker.compose.project=project1-local
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker networks in WSL Debian.' }
if ($existing -or $existingNetwork) { throw 'project1 test containers or network already exist; stop and inspect them before continuing.' }
$previousPassword = [Environment]::GetEnvironmentVariable('MSSQL_SA_PASSWORD', 'Process')
$previousWslEnv = [Environment]::GetEnvironmentVariable('WSLENV', 'Process')
try {
	$env:MSSQL_SA_PASSWORD = 'Aa1!' + [Guid]::NewGuid().ToString('N')
	$forwardedNames = @($previousWslEnv -split ':' | Where-Object {
		$_ -and $_ -notmatch '^MSSQL_SA_PASSWORD(?:/.*)?$'
	})
	$env:WSLENV = (@($forwardedNames) + 'MSSQL_SA_PASSWORD/u') -join ':'
	wsl -d Debian -u root -- docker compose -f $compose up -d --wait sqlserver
	if ($LASTEXITCODE -ne 0) { throw 'SQL Server did not start healthy.' }
	wsl -d Debian -u root -- docker compose -f $compose run --rm runner python -B -m unittest discover -s tests/sql -t . -v
	if ($LASTEXITCODE -ne 0) { throw 'The SQL test tier failed.' }
	wsl -d Debian -u root -- docker compose -f $compose exec sqlserver bash
	if ($LASTEXITCODE -ne 0) { throw 'The SQL Server shell exited with an error.' }
	# inside: /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d project1_test   (end batches with GO)
}
finally {
	try {
		wsl -d Debian -u root -- docker compose -f $compose down
	}
	finally {
		if ($null -eq $previousPassword) { Remove-Item Env:MSSQL_SA_PASSWORD -ErrorAction SilentlyContinue }
		else { Set-Item Env:MSSQL_SA_PASSWORD $previousPassword }
		if ($null -eq $previousWslEnv) { Remove-Item Env:WSLENV -ErrorAction SilentlyContinue }
		else { Set-Item Env:WSLENV $previousWslEnv }
	}
}
```

The SQL tests create and mutate synthetic objects and rows in `project1_test`. The port is not published, so SSMS cannot connect.

## Clean up and check

```powershell
$compose = '/mnt/c/<workspace>/project1/local/docker-compose.yml'
wsl -d Debian -u root -- docker compose -f $compose down
wsl -d Debian -u root -- docker ps -a --filter label=com.docker.compose.project=project1-local   # empty = clean
wsl -d Debian -u root -- docker network ls --filter label=com.docker.compose.project=project1-local   # empty = clean
```

The SQL service and both images declare no persistent data volumes; SQL test data is removed with the container. The runner has separate read-only binds for its required test/source folders, not the Excel workbooks. The query snippet restores the prior password and `WSLENV` values in `finally`; the standalone cleanup only stops containers and networks.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker` not found in PowerShell | Expected; prefix with `wsl -d Debian -u root --` |
| `permission denied` on the Docker socket | Add `-u root` |
| SQL Server does not start / login fails | Set `MSSQL_SA_PASSWORD` and `WSLENV` in this session |
| Runner build certificate error | Maven TLS is inspected; the build uses the `hostca` context. Do not disable TLS checks |
| `ModuleNotFoundError: tests` | Run from `Work\project1` and keep `-t .` |
