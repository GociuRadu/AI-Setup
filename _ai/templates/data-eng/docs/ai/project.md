# {{PROJECT}} - project facts

Data-engineering project. Stable facts only. Created {{DATE}}. Mark unverified items.

## At a glance
- Type: `data-eng`

- Purpose: <one line>
- Platform: Azure SQL Database + Synapse Spark 3.5 (Spark 3.5, Delta 3.2, Java 17, Python 3.11; *verify on the pool*); local: SQL Server 2025 container + Spark runner in Docker Engine on WSL2 Debian. Rows that apply in the data skill `platforms.md`: Azure SQL Database, SQL Server 2025 in Docker, Synapse Spark pool, local PySpark.
- Code root / Git root: `{{PROJECT}}/code` / `{{PROJECT}}/code`
- Entry points: <notebooks, pipelines, scripts>
- Source/target systems: <systems and roles; no credentials>
- Confluence site: <site>.atlassian.net or none

## Guardrails

- Databases: the core rules in `AGENTS.md` (Databases section). DEV: <server/db>.
- PRODUCTION <server/db>: never, not even reads.
- Tests: synthetic data only; they write only to their disposable local container, database name ending in `_test`.
- Never open: <secret files, e.g. local.env, .test.env>; input workbooks in `code/Data/`.
- Never run: loaders, notebooks, pipelines, triggers <and other writers or endpoints>; the agent drafts their run steps.

## Commands

Run from `{{PROJECT}}/code`. Local runner: [local/README.md](../../code/local/README.md); machine setup: [local/SETUP-WSL.md](../../code/local/SETUP-WSL.md).

| Purpose | Command | Side effects |
|---|---|---|
| Unit tests | `powershell -NoProfile -File local/test.ps1 -Tier Unit` | none |
| Spark tests | `powershell -NoProfile -File local/test.ps1 -Tier Spark` | local files in the runner container |
| SQL tests | `powershell -NoProfile -File local/test.ps1 -Tier Sql` | disposable `{{project}}_test` database in the local container |
| All tiers | `powershell -NoProfile -File local/test.ps1 -Tier All` | as above |

## Glossary

- <term>: <one-line meaning in this project>

## Conventions

- `Notebooks/`: exported notebook definitions (cell banners kept; `%pip`/`%run` in own cells).
- `pipelines/`: orchestration JSON. `TablesDataBase/`: DDL and procedures, one setup file per <subject or table>.
- `tests/{unit,spark,sql}`: test tiers; `tests/fixtures`: synthetic data; `tests/support`: helpers.
- `Data/`: input files, not mounted in the test runner.

## Review focus

- Data correctness, idempotent reruns, atomic publish, join cardinality, NULL/duplicate keys, runtime and JDBC limits.

## Asset index

| Asset | Type | Runbook / design record |
|---|---|---|
