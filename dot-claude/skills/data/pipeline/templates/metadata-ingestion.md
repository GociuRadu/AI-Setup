# Metadata-driven ingestion and concurrency budget

## Control list + ForEach

Pattern reference only (procfwk, ADF metadata-driven copy); no framework.

| Column | Example |
|---|---|
| DatasetId | `orders` |
| Enabled | `1` |
| Source | Delta path or `schema.table` |
| Target, Staging | `<schema>.<Table>`, `<schema>.<Table>_Staging` |
| PublishProc | `<schema>.<Dataset>_Publish` |
| Priority | `10` |

Pipeline: Lookup (enabled rows, ordered by Priority) -> ForEach (`isSequential: false`, `batchCount: B`) -> Notebook (`DatasetId = @item().DatasetId`). Each item keeps its own lock, audit row, staging table and transaction; one failed item never blocks the others' publication. Keep the list in code or a pipeline parameter until there are more than a handful of datasets; a control table is one more deployed object.

## Concurrency budget worksheet

Use one knob per level and record every value in the design record.

| Level | Symbol | Value | Source |
|---|---|---|---|
| ForEach batchCount or concurrent pipelines | B | | pipeline JSON |
| Datasets in parallel per notebook | W | | notebook parameter |
| JDBC write partitions per dataset | P | | notebook parameter |
| Control sessions per dataset (audit, lock) | C | | code |
| Peak SQL sessions | S = B x W x (P + C) | | computed |
| Measured DB session and worker limit | L | | DEV evidence: service tier limits, peak of `sys.dm_exec_sessions` / `sys.dm_exec_requests` |
| Source read connections | R | | source owner |

Rule: S stays well under L, with headroom for other users. Unknown L: do not raise any level. Raise one level at a time, with a before and after measurement (performance.md section 7).
