# Throughput and parallelism playbook

Read when volume is medium or large, when a load is slow, or when the user mentions speed, batches, parallelism or chunks. All numbers are starting points. Measure on one chunk or dataset, then set the value in the design record. Never copy a constant from another pipeline.

## 1. Size first

Run a SIZE_CHECK on local/DEV: rows, GB, average row bytes, widest columns, key distribution and skew, partition or file layout, change rate per day.

| Tier | Rough size | Consequence |
|---|---|---|
| small | up to ~10M rows or a few GB | one pass; no chunking |
| medium | ~10M to ~500M rows or up to ~100 GB | partitioned parallel read and write; bounded transactions; indexes after the load |
| large | above that, or a window that does not fit | chunk ledger, resumable chunks, bounded parallelism, scale-up; consider lake as the target |

Estimate wall time as rows / (rows per second per writer x writers). Take rows per second from one measured chunk, never from a guess. If the estimate exceeds the allowed window, change the design (more parallelism within the limits, SCALE_UP, bigger tier, lake target). Do not shorten the checks.

## 2. Plan the chunks

- Chunk by an indexed key range, a date range, a Delta partition or a file set. Never OFFSET paging.
- Size chunks by bytes, not rows: about 0.5 to 5 GB or 2 to 15 minutes each. A failed chunk then costs minutes. A chunk must finish well inside the token lifetime and the run timeout.
- Freeze the chunk plan in the run log (id, range, expected rows). Never change chunk size between reruns of the same load.
- Equal-size ranges on a skewed key give unequal chunks: split by quantiles from the SIZE_CHECK, or by a hash bucket.
- Chunk ledger columns: chunk id, range, status (pending, running, done, failed), attempt, rows read, rows written, totals, start, end, error. A rerun takes pending and failed chunks only.

## 3. Read fast

- Prune columns and partitions. No SELECT *. Push filters to the source.
- JDBC source: partitionColumn, lowerBound, upperBound and numPartitions on an indexed numeric or date column. numPartitions is the number of concurrent source connections, so agree the limit with the source owner. Prefer a replica, snapshot or off-hours window for a production source.
- Lake source: target 128 MB to 1 GB per file. Small files cost more than the data. Compact with OPTIMIZE where the format supports it. Read only the needed partitions.
- Spark code anti-patterns (UDFs, collect, repeated counts, RDD round-trips, distinct over wide text) and the evidence rule: [Spark performance review](../spark/performance-review.md).
- Joins: broadcast only small dimensions. Check skew, and use AQE and its skew handling. Assert cardinality after joins that can fan out.

## 4. Write fast to Azure SQL

- Staging is a heap without indexes or constraints. Build indexes once, after the load. Create the key at the end.
- One writer connection per Spark partition. Reduce partitions with coalesce(n) before the write, where possible without a shuffle. n is the connection budget, usually 4 to 16 and capped by the target tier. Raise it only while throughput still scales.
- Batch size: start at 10,000 to 50,000 rows per batch. For columnstore targets, batches of at least 102,400 rows (ideally about 1M) go straight to compressed rowgroups and skip the delta store.
- Bulk path: the Microsoft JDBC driver supports `useBulkCopyForBatchInsert=true` (verify driver version and column types on DEV). The Spark SQL connector with `tableLock` and `batchsize` is another option. Verify that it exists on the pool before authoring anything that depends on it. If existing project loaders use the generic jdbc format on purpose (see `project.md`), keep it unless a measured gain is proven on DEV.
- Azure SQL Database is always fully logged. The usual ceiling is log rate governance. Check `sys.dm_db_resource_stats` (avg_log_write_percent) and the `LOG_RATE_GOVERNOR` waits. If log write sits near 100% while the writers wait, more parallelism does not help. Scale up for the load (SCALE_UP), or reduce the transaction size and row width.
- Bound transaction size. Never one giant MERGE or one giant INSERT for tens of millions of rows (log growth, lock escalation, long rollback). For atomic publication of a big batch, use staging plus SWITCH or partition SWITCH (metadata-only). Otherwise MERGE or INSERT in key-range slices of about 1M to 5M rows, each slice in its own transaction, with the visible swap at the end.
- Partitioned targets: chunk i loads its own staging table or partition. Staging must match the target structure, indexes and filegroup, and carry a CHECK on the partition range. Switching is then instant and per partition.
- After the load: UPDATE STATISTICS on the target (do not rely on auto-update for a freshly loaded big table). Rebuild or reorganize columnstore indexes where rowgroups are small. Check rowgroup quality.
- Authentication: a token expires during a long write. Fetch it per chunk on the driver, never print it, and keep each chunk short.
- If the move is plain, with no transform, dedupe or cast, a pipeline Copy activity with parallelCopies and partition options (dynamic range or physical partitions) is often cheaper and faster than Spark. Use Spark when the data is transformed.

## 5. Orchestrate parallelism

- Cap concurrency at every level: source connections, Spark partitions or writers, ForEach batchCount (maximum 50, default 20), notebook DatasetWorkers, target connections. The product of the levels must stay inside the agreed limits: fill in the [concurrency budget worksheet](templates/metadata-ingestion.md#concurrency-budget-worksheet).
- Independent datasets can run in parallel in one Spark session (a bounded ThreadPool, as in the dataset loader). Memory and executor pressure grows with each dataset, so measure with two workers first.
- One writer per target table. Two concurrent loads into the same staging table or target corrupt each other. The run log, or an application lock with heartbeat, enforces it.
- A slow cluster start eats short intervals. For 5-60 minute loads use compute that starts in seconds.

## 6. Fail small, retry cheap

- Retries happen per chunk, not per run. A retried chunk first removes its range, or rebuilds its staging, and then writes again, so retries never duplicate.
- Per-chunk checks: rows read = rows written + empty dropped (+ set aside), plus totals. After all chunks: key unique, rows = sum of chunk rows, target totals = sum of chunk totals (no second read of the source).
- A failure of one chunk never publishes partial data to readers. Publish only after every chunk and every check has passed.

## 7. Prove the speed

Record in the runbook, from the first DEV or measured run: rows per second per writer, writer count, total wall time and time per stage (read, transform, write, index, publish), the limiting resource (source, Spark, log rate, network) and the tuning change that was accepted. A tuning change without a before and after number is a guess. Reject it.

## 8. Review traps (performance area)

Chunk column not indexed at the source. OFFSET paging. Chunks sized by rows. More parallelism than the target log rate can take. Indexes maintained during a bulk load. One MERGE over tens of millions of rows. SELECT *. Spark code anti-patterns ([Spark performance review](../spark/performance-review.md)). Thousands of tiny files. Verification by a second full read of the source. A token that expires mid-chunk. Spark partition count copied from another job. Retried chunk written without removing its range.
