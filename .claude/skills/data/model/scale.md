# Physical design for volume

Design the table for how it is loaded and read. Pairs with the [pipeline performance playbook](../pipeline/performance.md): the pipeline writes in parallel chunks, this file makes the table able to take it. Numbers are starting points to verify on DEV with the real engine tier, not universal.

## 1. Size it first

Estimate before choosing structures: bytes per row (sum of column widths + about 10 overhead) × rows now × rows in 2 years, plus indexes (about +30-100%). Record it in the design (`size`).

| Tier | Rough size | Design |
|---|---|---|
| small | under 1M rows, under ~1 GB | plain clustered table, simple keys, no partitioning, no columnstore |
| medium | 1M-100M rows, ~1-50 GB | narrow clustered key, indexes only for named queries, columnstore for read-mostly facts and events, partitioning only for a retention or switch need |
| large | over 100M rows or over ~50 GB | columnstore plus partitioning by load/retention window, SWITCH-compatible staging, no row-by-row work. Over ~100 GB in Azure SQL Database: ask whether it belongs in the lake/lakehouse instead and only serve aggregates from SQL |

Check the tier limits: max database size, log-rate limit and tempdb for the service tier (read on DEV; Azure SQL Database only, see [platforms](../platforms.md#sql-engines)). The log rate caps load speed, so a bigger table does not load faster by adding workers.

## 2. Load-friendly structures

- **Staging**: a heap, no constraints, no triggers; column types per [table 01](cases.md#01-staging) (typed like the target for high-volume loads, so nothing converts on the way in). Rebuilt or truncated per run. Exception: when publish uses SWITCH, staging must match the target's structure, including its clustered key and indexes, before the switch ([publish](../pipeline/templates/publish.md)). Parallel writers each insert a slice into the same heap; a heap has no clustered-key contention.
- **Narrow, ever-increasing clustered key** (IDENTITY, or date + id) for tables that are appended: inserts go to the end, no page splits, parallel writers do not fight over the middle of the index. A random GUID clustered key at volume causes splits and fragmentation; use `NEWSEQUENTIALID()` or a different key.
- **Few indexes on big load targets.** Every index is written on every insert. Load first, build secondary indexes after (or keep them on the serving table only). Named-query test: no query, no index.
- **No triggers, no per-row defaults that call functions, no scalar UDF computed columns** on bulk-load targets.
- **Constraints**: keep PK and unique keys (they are the correctness guard). On big bulk-loaded facts, leave FKs to the pipeline's orphan check; add them `WITH CHECK` only where loads are small.
- **Types**: smallest type that fits (INT vs BIGINT, DATE vs DATETIME2, DECIMAL(p,s) sized, VARCHAR where no Unicode). Row width drives both load speed and scan speed. Avoid NVARCHAR(MAX)/VARCHAR(MAX) in anything keyed, joined or filtered (large-object columns also block some bulk paths and index builds).

## 3. Long text keys

A key over 900 bytes (clustered) or 1700 bytes (nonclustered) cannot be indexed, and grouping or joining on long text is slow even when it fits.
- First choice: bound the key columns (`NVARCHAR(200)`) and validate length in the loader.
- Otherwise a persisted `key_hash BINARY(32)` computed from the key columns with the history case's length-prefixed encoding, and a `UNIQUE` index on `key_hash`. The loader's duplicate check, joins and MERGE use the hash. Keep the readable columns for display.
- Never compare hashes built by different recipes.

## 4. Columnstore (facts, events, large read-mostly tables)

- Clustered columnstore gives 5-10× compression and fast scans/aggregates; it is poor for point lookups and frequent single-row updates.
- Bulk loads compress straight into rowgroups only when a batch is at least 102,400 rows. Smaller batches land in delta stores and need the tuple mover (`REORGANIZE`). So a columnstore target takes fewer, larger batches (102,400 to 1,048,576 rows); a rowstore target takes 10k-50k.
- Keep the PK as NONCLUSTERED when the table is clustered columnstore. Add nonclustered rowstore indexes only for proven point lookups.
- Rebuild/reorganize rowgroups after heavy deletes or many small loads (read `sys.dm_db_column_store_row_group_physical_stats` first: deleted rows share and trimmed rowgroups; the rebuild is a draft for the user).
- Order the load by the filter column (date) so rowgroups carry tight min/max and elimination works.

## 5. Partitioning (for switch-in and retention, not for speed)

Use only when at least one is true: a load replaces a whole window (switch-in), old data is dropped by window (switch-out/truncate partition), or the table is large with maintenance per window. Otherwise do not partition: it adds complexity and rarely makes queries faster.
- Function RANGE RIGHT on a date or load-window column that is part of the clustered key (and unique keys must include it). Plan the boundaries ahead (next windows pre-created) and a job to add the next boundary.
- Align the staging table for SWITCH: same columns, types, nullability, clustered and nonclustered indexes, compression and filegroup as the target partition, plus a `CHECK` constraint on the partition column matching the range (`WITH CHECK`). The target partition must be empty when switching in, or use switch-out first.
- A global unique key needs the partition column in it, which breaks "one source_event_id globally unique" for events. Reject partitioning there (see case 07) unless an approved, enforced global dedupe exists.
- Prefer partition-level `TRUNCATE ... WITH (PARTITIONS (...))` and SWITCH over `DELETE` of millions of rows (log-heavy).

## 6. After the load

Part of the pipeline's publish step, written down by the model so it is not forgotten:
- `UPDATE STATISTICS` (or `FULLSCAN` on the affected partition for big loads), because auto-update thresholds are too coarse for a table that just grew a lot.
- Build or rebuild the secondary indexes that were deferred (`ONLINE = ON` where supported; `MAXDOP` set so it does not starve readers; `RESUMABLE = ON` for very large builds).
- Reorganize/rebuild columnstore only if the rowgroup check says so.
- Serving tables swap by SWITCH or rename in one short transaction; readers go through a view or the main name, never through staging.

## 7. Model checklist for large tables

- Size tier recorded with rows, bytes per row, growth.
- Clustered key narrow and increasing for appends; secondary indexes each with a `serves:` comment and deferred until after load where possible.
- Staging mirrors the target (and for SWITCH: indexes, filegroup, CHECK range).
- Long text keys bounded or hashed. No MAX types in keys.
- Partitioning has a stated switch/retention reason and a boundary-maintenance owner, or is absent.
- Columnstore tables: batch size ≥ 102,400 noted for the pipeline.
- Post-load statistics and index steps named for the pipeline.
- Log rate and size limits checked for the tier (read on DEV).
