# {{PROJECT}} - project facts

Data-engineering project. Stable facts only. Created {{DATE}}. Mark unverified items.

## At a glance

- Purpose: <one line>
- Stack/runtime: <Python/PySpark version, Spark runtime (e.g. Synapse), database engine>
- Code root / Git root: `{{CODEDIR}}` / <folder or none>
- Entry points: <notebooks, pipelines, scripts>
- Source/target systems: <systems, no credentials>

## Guardrails

- Environments: DEV <server/db> ({{DB_ACCESS}}); PROD never, not even reads.
- Never open: <secret files, e.g. local.env, .test.env>; input workbooks in `{{CODEDIR}}/Data/`.
- Never run: <writers, pipelines, triggers, endpoints>
- Local test data: synthetic only; database name must end in `_test`.

## Commands

Run from `{{CODEDIR}}`. Local runner: [local/README.md](../../{{CODE}}local/README.md).

| Purpose | Command | Side effects |
|---|---|---|
| Unit tests | `& '.\local\test.ps1' -Tier Unit` | none |
| Spark tests | `& '.\local\test.ps1' -Tier Spark` | local files in the container |
| SQL tests | `& '.\local\test.ps1' -Tier Sql` | disposable `{{PROJECT}}_test` database |
| All tiers | `& '.\local\test.ps1' -Tier All` | as above |

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
