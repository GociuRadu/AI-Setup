# JDBC to Azure SQL: limits

| Setting | Meaning | Rule |
|---|---|---|
| Write partitions (`coalesce`/`repartition` n) | one SQL session per partition | n fits the [session budget](../pipeline/templates/metadata-ingestion.md#concurrency-budget-worksheet); `coalesce` when reducing |
| `batchsize` | rows per round trip | start values and columnstore rule: [performance](../pipeline/performance.md) section 4 |
| `queryTimeout` (writer), `setQueryTimeout` (control statements) | per statement, seconds; 0 = none | set explicitly; full-table scans and publish calls need the run limit |
| Activity timeout | whole notebook run | above the sum of stage limits |
| Access token | expires during long phases | fetch per stage; reopen control connections after long Spark phases |
| `useBulkCopyForBatchInsert` | driver bulk-insert path | verify the pool's mssql-jdbc version and column types; keep only with a measured gain |
| Control sessions | audit, lock, keepalive | count them in the budget |
| Read `numPartitions` | concurrent source connections | agree the limit with the source owner |
