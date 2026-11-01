# Platforms

The project's `project.md` names its platforms (for example Azure SQL Database + Synapse in production, SQL Server in Docker + local PySpark for tests). Read only those columns. Facts marked *verify* were not checked against the current docs or the real pool; confirm before relying on them.

## SQL engines

| Topic | Azure SQL Database | SQL Server 2025 in Docker (local) |
|---|---|---|
| Edition and features | managed; feature set depends on the service tier | Developer edition (all Enterprise features): partitioning, SWITCH, columnstore, `ONLINE = ON`, `RESUMABLE = ON` |
| Logging | always fully logged (full recovery, no minimal logging) | recovery model is yours; SIMPLE or BULK_LOGGED can make bulk loads minimally logged, so local load speed is **not** representative |
| Log rate and resource limits | log rate governance per tier: `sys.dm_db_resource_stats` (`avg_log_write_percent`), `LOG_RATE_GOVERNOR` waits, `sys.dm_user_db_resource_governance` (size, log rate, workers, sessions, tempdb) | no governance; `sys.dm_db_resource_stats` and `sys.dm_user_db_resource_governance` do not exist. Look at `WRITELOG` waits (`sys.dm_os_wait_stats`, `sys.dm_exec_requests`) and `sys.dm_io_virtual_file_stats` for the log file |
| Columnstore | supported on vCore tiers and Premium; not on lower DTU tiers (*verify* for the project's tier) | supported |
| Partitioning, SWITCH | supported (all partitions on the PRIMARY filegroup) | supported; filegroups are yours, but keep PRIMARY so DDL matches Azure |
| Native `json` type, `CREATE JSON INDEX` | `json` type available (*verify* GA for the tier); JSON index *verify* (preview) | SQL Server 2025 adds the native `json` type and JSON index (*verify* for the pinned CU and that it matches Azure's behavior); when unsure use `NVARCHAR` + `ISJSON`, the form both sides accept |
| Cross-database queries, SQL Agent | not available (no three-part names to another database, no Agent jobs) | available; do not use them in code that also runs on Azure |
| Authentication | Microsoft Entra ID tokens (managed identity, service principal) or SQL login | SQL login (`sa` or a test login) |
| Compatibility level | 160 by default for new databases (*verify*) | 170 by default on SQL Server 2025 (*verify*); set the local database to the Azure database's level |

## Spark

| Topic | Synapse Spark pool | Local PySpark |
|---|---|---|
| Versions | Spark 3.5 runtime: Java 17, Scala 2.12.18, Delta 3.2, Python 3.11 or 3.10 (*verify on the pool*, see [runtime](spark.md#runtime)) | `pyspark==3.5.*`, `delta-spark==3.2.*`, Java 17, Python 3.11 |
| Delta | built in | `configure_spark_with_delta_pip` plus the Delta SQL extension and catalog settings on the session builder |
| `mssparkutils` / `notebookutils`, linked services, `getToken` | available | absent: put these calls behind one wrapper (one cell or module) with a local stand-in driven by parameters or fixtures, so `run()` and the tests run locally |
| JDBC driver to SQL | mssql-jdbc bundled with the runtime (version: read it on the pool, [runtime](spark.md#runtime)) | add `com.microsoft.sqlserver:mssql-jdbc:<version>` via `spark.jars.packages`, same major version as the pool (*verify*) |
| Spark SQL connector for SQL Server (`tableLock`, bulk) | *verify* it is installed on the pool | install the matching connector jar only if production uses it |
| Authentication to SQL | Entra token per chunk from the linked service or `getToken` | SQL login with the test password from an environment variable |

## Local test container

- Image `mcr.microsoft.com/mssql/server:2025-latest` (pin a CU tag once chosen), environment `ACCEPT_EULA=Y`, `MSSQL_PID=Developer`, `MSSQL_SA_PASSWORD` from an environment variable set for the test run. The `data-eng` template runs it through Docker Compose (`code/local/`) with no published port and no volume: only the test runner on the Compose network reaches it, and its data dies with the container.
- The password is a throwaway test value, never a real secret, never committed and never printed. The project's secret files stay closed (core rules).
- Tests create their own database and objects, reset them in setup and remove the container or database afterwards. The harness refuses any host other than the container ([test tiers](test-tiers.md#integration-guard)).
- Start and stop it through the project's test runner; queries against it are reads (SKILL.md Safety).

## What local tests cannot cover

Azure SQL log rate, tier, session and worker limits; real throughput and timings; Entra tokens, managed identity rights, firewall and private endpoints; `mssparkutils`, linked services and pipeline orchestration (triggers, ForEach, parameters passed by the pipeline); the native `json` type and other Azure-only features. List these as not run; reads on DEV can check some of them.
