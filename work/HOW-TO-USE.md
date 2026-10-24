# How to use the AI setup

Shared Copilot setup for `Work`. Rules, agents and skills live in `_ai/` ([maintenance](_ai/README.md)); each project keeps its facts in `<project>/docs/ai/`.

## Requirements

- Open `Work.code-workspace` in VS Code and start a new chat after customization changes.
- project1: PowerShell and WSL2 Debian with Docker Engine. The standard unit, Spark and SQL tiers use the Docker runner; the project `.venv` is an optional non-Docker unit-test path. The runner mounts only test fixtures, notebooks, DDL and pipeline JSON read-only; `Data/excels` is not mounted.
- project2: Python 3.11 and `uv`. Dependency installation uses the configured package index and may require network access.

## Start

1. Open `Work.code-workspace` (not a single folder) and start a new chat.
2. Name the project or paths in the request (`project1/...`, `project2/...`). Change `_ai/` only when you mean to change the setup.
3. Say goal, scope, expected result and constraints. No credentials, customer rows or project2 content: use placeholders.

## Pick the way to work

| Need | Use |
|---|---|
| Small question or edit | default chat |
| Multi-file work with research, edits and review | agent **lead** on the picked model (Sonnet, Opus or GPT); it writes the code and delegates to `scout`, `worker`, `tester`, `reviewer` (Haiku or GPT-6 Luna) |
| Design, architecture, hard debugging | agent **lead** with **Opus** in the model picker |
| Run tests | ask "run the tests"; `lead` or the default agent uses `tester` |
| A repeatable workflow | a skill (type `/`) |

| Skill | Use it for | Example |
|---|---|---|
| `/analyze` | Explain or assess code, a flow or tests; save a note | `/analyze project2 trigger_processing flow` |
| `/review` | Review a change, or `audit` a folder/project (saved report) | `/review audit project1 tests` |
| `/bug` | Prove and fix a concrete defect (recorded in `memory.md` or the project's known-issues catalog) | `/bug duplicate rows after retry in dataset Silver` |
| `/data` | Tables, DDL, load pipelines, Synapse notebooks, JDBC, Spark performance | `/data review BOM Raw Ext rerun behavior` |
| `/confluence` | Read/update a page whose link you give | `/confluence <link> update the load section` |
| `/ponytail` | Change the simplicity level for this chat (`lite`, `full`, `ultra`, `off`) | `/ponytail lite` |

Use `/analyze` to explain or document; use `/review` for defect-focused review; use `/bug` when a concrete failure should be reproduced and fixed. For pipeline documentation, `/data` maintains the runbook/design record rather than a second general document mode.

## Safety rules

Shared privacy, terminal, database, external-system and Confluence boundaries have one source of truth in [_ai/.github/instructions/global.instructions.md](_ai/.github/instructions/global.instructions.md). Read-only file inspection is prompt-free; file changes and command execution still require approval. The `prod-guard` hook refuses production targets, `DROP DATABASE`, force-push and volume deletion outright, even if a prompt is approved. Private and secret files remain off-limits under the shared rules.

## Where results go

| Result | Location |
|---|---|
| Stable facts, commands, review focus | `<project>/docs/ai/project.md` |
| Current state and open work | `<project>/docs/ai/context.md` |
| Decisions, lessons, bugs | `<project>/docs/ai/memory.md` |
| Reports, runbooks, design records | `<project>/docs/ai/reports/` |
| Tests | `<project>/tests/` (project2: `project2/tests/`) |

## Project notes

- **project1:** `project1/local/test.ps1` validates, builds, tests, waits for SQL health and removes containers/network with plain `down`. SQL has no persistent volume, so its data is ephemeral; only test-required source folders are mounted. Manual use: [project1/local/README.md](project1/local/README.md). Never open the Excel workbooks.
- **project2:** do not start the app against live configuration or call `/public/trigger_processing`; use the local tests and lint commands below. Known issues: [project2/docs/DOCUMENTATION.md](project2/docs/DOCUMENTATION.md) section 12.

## Commands

Run these from the listed project directory and shell. Verification states are from 2026-10-23.

| Directory | Shell | Command | Purpose | Verification |
|---|---|---|---|---|
| `Work\project1` | PowerShell | `wsl -d Debian -u root -- docker compose -f /mnt/c/<workspace>/project1/local/docker-compose.yml config --quiet` | Validate Compose syntax | Passed |
| `Work\project1` | PowerShell | `wsl -d Debian -u root -- docker compose -f /mnt/c/<workspace>/project1/local/docker-compose.yml build runner` | Build the project1 test image | Passed |
| `Work\project1` | PowerShell | `& '.\local\test.ps1' -Tier All` | Compose validation, runner build, unit/Spark/SQL tests, safe cleanup | Passed: 38 + 12 + 12; no containers or network left; SQL has no persistent volume |
| `Work\project1` | PowerShell | `& '.\local\test.ps1' -Tier Sql` | Run only SQL tier | Exercised as part of `-Tier All`; not run separately |
| `Work\project1` | PowerShell | `& '.\local\test.ps1' -Tier Unit` | Fast unit/contract tier | Passed: 38/38; cleanup verified |
| `Work\project1` | PowerShell | `wsl -d Debian -u root -- docker ps -a --filter label=com.docker.compose.project=project1-local` | Debug/check project containers | Passed: empty after test cleanup |
| `Work\project1` | PowerShell | `wsl -d Debian -u root -- docker compose -f /mnt/c/<workspace>/project1/local/docker-compose.yml down` | Stop manually started test services | Passed; containers/network removed; SQL has no persistent volume |
| `Work\project1` | PowerShell | `wsl -d Debian -u root -- docker logs --tail 80 project1-local-sqlserver-1` | Debug SQL Server startup | Used; startup recovered, no explicit error in the inspected tail |
| `Work\project2` | PowerShell | `uv run --no-sync pytest tests/unit -q -p no:cacheprovider` | Run retained project2 example tests | Passed after test cleanup: 3/3; two Pydantic deprecation warnings |
| `Work\project2` | PowerShell | `uv run --no-sync ruff check --select E4,E7,E9,F backend_app/app_functions/app_utils.py` | Check changed module syntax/imports/names | Passed |
| `Work\project2` | PowerShell | `uv sync` | Install project2 dependencies | Not run; existing environment was ready and install may contact the internal package index |
| `Work\project2` | PowerShell | `uv run python -m backend_app.app` | Start the project2 API with confirmed isolated settings | Not run; app startup can initialize external clients; never call the processing trigger; stop an approved foreground run with `Ctrl+C` |
| `Work` | PowerShell | `& '.\_ai\scripts\sync-config.ps1' -WhatIf` | Check AI model/ponytail sync targets | Passed: all four agents and global instructions unchanged |

For individual project1 tiers, use `-Tier Unit`, `-Tier Spark`, or `-Tier Sql`. The script creates a throwaway SQL password only in process environment and uses plain `docker compose down`; SQL data is ephemeral, and `Data/excels` is not mounted into the runner. For project2 setup, run `uv sync` from the project2 directory only when dependencies need installation; it was not needed for these verified tests. The project2 API start command above was not run; use only confirmed isolated settings and never call the processing trigger; stop an approved run with `Ctrl+C`.

## Update from the personal setup

Skills, helper agents, `python`/`sql` instructions and hooks are maintained in the personal setup and arrive in the Obsidian vault (`Me\Code\Setup\work`). To install them here:

1. Wait until Obsidian has synced.
2. Preview: `& "<vault>\Me\Code\Setup\work\apply-from-vault.ps1" -Workspace "<Work folder>" -WhatIf`, then run it without `-WhatIf`. It copies only agents, instructions, skills and hooks, restores `.` names, never deletes, and keeps your `prod-markers.txt`.
3. First time only: put the real production server names in `_ai\.github\hooks\prod-markers.txt` (one regex per line; never in the vault).
4. Reload VS Code. Check: ask the agent to run `sqlcmd -S <a prod name>`; it must be refused without a prompt.
5. Only then run `sync-to-vault.ps1`; running it first overwrites the update in the vault.

## Troubleshooting

| Symptom | Try |
|---|---|
| Skill or agent missing | Open `Work.code-workspace`, reload VS Code, new chat, check **Chat: Open Customizations** |
| Wrong project's rules used | Name the project/path in the request |
| Model or ponytail level unchanged | Edit `_ai/config/ai.config.json`, run `_ai/scripts/sync-config.ps1`, reload |
| A command was not run | Probably a safety boundary; ask for the user-run steps |
| Confluence unavailable | Check the Atlassian MCP server; sign in when VS Code prompts |
| project1 SQL is unhealthy | Run `wsl -d Debian -u root -- docker ps -a --filter label=com.docker.compose.project=project1-local`, inspect `docker logs --tail 80 <container>`, then rerun `& '.\local\test.ps1' -Tier Sql` after the project resources are stopped |
| project1 script says resources already exist | Inspect containers/networks first; stop only this test project with the documented `down` command |
| project2 settings/test fails | Never open `.env` or print environment values; check test output and the safe settings/test guidance in [project2/README.md](project2/README.md) |
