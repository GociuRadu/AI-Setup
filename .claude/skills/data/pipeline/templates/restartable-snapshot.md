# Restartable full snapshot with audit

For a source with an immutable version (Delta) and the project's audit table.

Flow: resolve source version -> take the dataset lock (busy -> audit Skipped, end green) -> sweep this dataset's abandoned Started rows -> skip if that version is Succeeded -> audit Started -> read `versionAsOf` once, counts in the same pass -> truncate and write staging -> validate staging -> `EXEC <Dataset>_Publish` -> exit with status.

Rerun = start again. Each attempt gets its own RunId and LoadBatchId; staging is rebuilt, never resumed.

## Uncertain commit

An error or lost connection during `EXEC ..._Publish` leaves the outcome unknown. Read the attempt's audit row first:

| Audit row | Meaning | Action |
|---|---|---|
| Succeeded | target and audit committed together | nothing; the next run skips that version |
| Started | publish rolled back or never ran | next run's sweep marks it Abandoned (Failed); rerun |
| Failed | failure recorded | rerun |

Never re-mark a run after commit: failure handlers update only `WHERE Status = 'Started'`. Run the sweep under the same lock that guards the load; if only pipeline concurrency guards it, a manual run is unsafe.

## Restart vs durable chunk resume

| | Restart | Durable chunk resume |
|---|---|---|
| State | source version and attempt in the audit table | chunk ledger in SQL (id, range, status, counts) |
| Rerun | rebuild staging from scratch | redo pending and failed chunks; each chunk removes its range first |
| Fits | snapshot that fits the window | case 04, or a snapshot that does not fit the window |

Spark checkpointing (`checkpoint()`, streaming checkpoint folders) is not ETL state: it truncates lineage or tracks a stream and is not a resume ledger. Resume state lives in SQL.

## Azure SQL transaction vs Delta commit

No transaction spans both systems. Safe order: Delta is the pinned, immutable input; one SQL transaction commits target and audit together. A Delta write and a SQL publish in one run are two commits: make each idempotent and record each step in the audit so a rerun redoes only the missing one.

## Audit table reuse

Reuse the shared audit table only for sources it can describe. When its source-version columns are NOT NULL (Delta version and write timestamp), it fits Delta sources only. For Excel, SAP or API sources, ask the user for a design; never invent markers.
