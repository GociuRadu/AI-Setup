# Spark

Notebook rules, runtime, JDBC limits and performance review for Spark notebooks (Synapse or local). Platform differences (Synapse vs local): [platforms](platforms.md).

## Notebook rules

1. **Parameters:** one parameter cell with literal values; the pipeline passes every parameter and its defaults equal the cell (a unit test asserts it). Validate parameters at the start of `run()`. Everything that differs between Synapse and a local run is a parameter in that cell (`Environment` = `DEV`/`PROD`/`LOCAL`, `DbServer`, `DbName`, `SourcePath`, `ExpectedWorkspaceName`); no hardcoded server, `abfss://` path or workspace name outside it, and no per-notebook `if LOCAL` copies.
2. **Runtime:** local tests use the same major.minor ([runtime](#runtime)).
3. **Testable code:** transformations are functions DataFrame -> DataFrame; I/O, `mssparkutils` and the final `run()` stay in their own cells, and Synapse-only calls sit behind one wrapper so the code runs locally ([platforms](platforms.md)). Connection differences live in one `jdbc_options(settings, token)` function: `Environment == "LOCAL"` gives SQL login + `trustServerCertificate`, otherwise `accessToken`. The local runner executes the parameter cell, applies `-P Name=Value` overrides (as the pipeline does on Synapse), then runs the other cells, and fakes `mssparkutils` (`env`, `credentials`, `fs.cp`, `notebook.exit`); the notebook body stays identical to what runs on Synapse. Extract a module only when two notebooks share it. Exports keep their cell banners; `%pip` and `%run` sit in dedicated cells.

## Runtime

| Synapse runtime | Spark | Java | Scala | Delta | Python | Status |
|---|---|---|---|---|---|---|
| Apache Spark 3.4 | 3.4 | - | - | - | - | support ended 2026-03-31 (verify on the pool); do not target |
| Apache Spark 3.5 | 3.5 | 17 | 2.12.18 | 3.2 | 3.11 or 3.10 (Microsoft docs disagree) | supported (verify on the pool) |

Local runner: `pyspark==3.5.*`, `delta-spark==3.2.*`, Java 17, Python 3.11. What local tests cannot cover: [platforms](platforms.md#what-local-tests-cannot-cover).

Give the user this read-only DEV cell to run on the pool (notebooks are user-run), then record the values:

```python
import sys
jvm = spark.sparkContext._jvm
print(spark.version, sys.version, jvm.java.lang.System.getProperty("java.version"),
      jvm.scala.util.Properties.versionNumberString())
driver = jvm.com.microsoft.sqlserver.jdbc.SQLServerDriver()
print("mssql-jdbc", driver.getMajorVersion(), driver.getMinorVersion())
spark.sql("DESCRIBE DETAIL delta.`<source path>`").select("minReaderVersion", "minWriterVersion").show()
```

The Delta library version is listed in the pool's runtime page and `spark.sparkContext.getConf().get("spark.jars", "")` when custom jars are added.

## JDBC limits

JDBC to Azure SQL:

| Setting | Meaning | Rule |
|---|---|---|
| Write partitions (`coalesce`/`repartition` n) | one SQL session per partition | n fits the [session budget](pipeline/templates/metadata-ingestion.md#concurrency-budget-worksheet); `coalesce` when reducing |
| `queryTimeout` (writer), `setQueryTimeout` (control statements) | per statement, seconds; 0 = none | set explicitly; full-table scans and publish calls need the run limit |
| Activity timeout | whole notebook run | above the sum of stage limits |
| Access token | expires during long phases | fetch per stage; reopen control connections after long Spark phases |
| Control sessions | audit, lock, keepalive | count them in the budget |

Batch size, bulk copy and read `numPartitions`: [performance](pipeline/performance.md) sections 3-4.

## Performance review

Evidence first: each finding cites a measured number supplied by the user or a log (stage time, shuffle bytes, spill, task skew, `stage_timing` lines, SQL DMV output). Never invent Spark UI metrics. Without evidence, name the exact metric to capture and label the finding "hypothesis".

| Anti-pattern | Why | Instead |
|---|---|---|
| `collect()` / `toPandas()` on large data | driver memory, single thread | aggregate in Spark; `limit(1).first()` for probes |
| Python UDF on a hot path | row serialization to Python | built-in functions; a vectorized pandas UDF if unavoidable |
| RDD round-trips (`df.rdd.map`, `rdd.toDF`) | leaves the optimizer, serializes rows | DataFrame API (`df.rdd.getNumPartitions()` is fine) |
| Same lazy frame acted on repeatedly | recomputes the source read | one pass with aggregates; persist once (DISK_ONLY for very large frames), unpersist after |
| `distinct()` over wide text to dedupe | full-row shuffle | dedupe by key with a window, or `dropDuplicates(keys)` when duplicates are defined by key |
| Default shuffle partitions on very large or small jobs | many tiny or few huge tasks | about shuffle bytes / 128 MB; AQE on |

Output: `| # | Evidence | Finding | Fix | Expected gain (measured or hypothesis) |`.
