# Decisions

Read only the topic needed. Each topic: the question, the default, when to deviate. Ask the user one consequential decision at a time with a recommendation.

## store: where the data lives

- Needs row-level updates, constraints, joins and many small queries: relational database (engine per `project.md`).
- Large append-only data, scanned in bulk, read by Spark/BI: lake or lakehouse files with Delta/Parquet; keep SQL for the serving slice.
- Both: land in the lake, publish the serving slice to SQL.
- Over ~100 GB in Azure SQL Database or huge scans: ask whether it belongs in the lake first ([scale](./scale.md)).

| Need | Azure SQL Database | Delta (lake) |
|---|---|---|
| Readers | apps, BI, many small keyed queries | Spark, bulk scans, data science |
| Integrity | PK/FK/CHECK enforced, transactions across tables | per-table commits only; constraints limited to NOT NULL/CHECK |
| Change marker | needs a column or CDC | table version and change feed built in |
| Replay | point-in-time restore of the database | time travel while files are retained (vacuum) |
| Atomic publish | staging + SWITCH or TRUNCATE+INSERT in one transaction | one overwrite/merge commit |
| Cost driver | service tier, log rate, sessions | storage and Spark compute |

Publishing from Delta to SQL: [Azure SQL transaction vs Delta commit](../pipeline/templates/restartable-snapshot.md#azure-sql-transaction-vs-delta-commit).

## file_format (lake only)

Delta for tables that are updated or merged; Parquet for immutable bulk. Partition by a low-cardinality filter column (date), aiming at 128 MB to 1 GB files; do not partition by a high-cardinality key.

## json_in_db

JSON only for attributes that vary by row and are not filtered or summed (case 09). Anything filtered, joined or aggregated becomes a typed column. Many items per row that are counted or filtered become a child table.

## model_kind: how to shape it

- Operational/serving: entities, links and lookups (cases 02-05).
- Reporting: facts at a stated grain with dimensions (08), unknown member -1, a date dimension when needed.
- History needed: 06. Events: 07.
- Do not build a star schema for an application table, or a normalized schema for a BI-only extract.

## key

- Natural key: unique, stable, meaningful to the source (item number). Always keep it unique-constrained.
- Surrogate key (INT IDENTITY, BIGINT for logs): the durable id others point to; used when natural keys are long, composite, change, or come from several sources.
- Composite grain key on facts: the grain columns.
- Hash key: only for long text keys ([scale](./scale.md) section 3).
- Never use GUID clustered keys for big appended tables. Never reuse an id.

## relationships

FK for every reference between small or row-loaded tables; every FK column indexed. Big bulk-loaded facts: no FK, the pipeline checks orphans and the unknown member catches the rest. One-to-many: FK on the many side. Many-to-many: link table (04). Optional relationships: NULL FK or unknown member, chosen once per model.

## lookup

Fewer than about 50 stable codes, named, with `is_active`. Values live in the DDL file and a MERGE applies them each deploy. A code used in a CHECK instead (a few fixed values, no names) is acceptable when it never needs a description.

## tree

Adjacency list (parent_id) is the source of truth. Derived forms for reads: closure table (frequent subtree questions), path string (exports), flattened levels (BI). Fixed named levels with their own attributes: one entity per level. A node with several parents is a graph, not a tree: edge table.

## history

Keep history only when someone asks "as it was on date X". Options: a version table (06, business time, default); system-versioned temporal (database change time, audits of config tables); snapshots (a fact of state per date, cheap for few attributes). History costs complexity and size: a nightly full reload that makes every row "change" is the main trap, so the hash must exclude audit columns and compare only tracked columns.

## change_with_data

A table with data is changed by a migration, not DROP/CREATE: a user-run, idempotent script (checks the current state before each step), each step with a rollback. Draft the check that shows the table is in the expected state first.

| Change | Risk | Approach |
|---|---|---|
| Add NULLable column | low | `ALTER TABLE ADD`, metadata only |
| Add NOT NULL column | medium | add with a DEFAULT (metadata-only for constants) or add NULL, backfill in batches, then set NOT NULL |
| Widen a type | low-medium | `ALTER COLUMN`, check indexes and statistics; may rewrite on some types |
| Narrow or change a type | high | add a new column, backfill in batches, switch readers, drop the old one later |
| Drop a column | high | after readers are gone; keep a rollback copy request |
| Add a constraint or FK | medium | add `WITH NOCHECK`, fix violations (count first), then `CHECK CONSTRAINT` |
| Add or change an index | medium on big tables | build online, resumable where supported, off-hours, named query it serves |
| Rename | high | views or synonyms for the old name during the move |
| Move rows between tables | high | batches by key range, counts before and after, no TRUNCATE without being asked |

For big tables, backfills go in key-range batches (for example 50k-500k rows per transaction) so the log and locks stay small and the work can resume.

## types_naming

Smallest correct type. Money and quantities as DECIMAL(p,s), never FLOAT. Dates as DATE; instants as DATETIME2(3) in UTC. Text as NVARCHAR(n) when Unicode is possible, VARCHAR(n) for codes. BIT for flags, named `is_...`. No MAX unless the data really is large and never keyed. Names (defaults; an existing project's convention wins): snake_case; tables singular; `<table>_id` keys; `_loaded_at`/`_source`/`_loaded_by` audit columns last; constraints `pk_`, `uq_`, `fk_`, `ck_`, `df_`; indexes `ix_`, `ux_`. Follow the existing subject's names where they exist.

## indexes

An index exists only for a named query (`-- serves:`). Order key columns by equality columns first, then range, then sort. Put the covering columns in INCLUDE. Selective filters on a subset: filtered index. Each index costs writes, so big load targets get few. Check duplicate or overlapping indexes in review. Foreign key columns are indexed.

## views_compression_partitioning

- Views: a reader view hides audit columns and soft-deleted rows; they are not for speed.
- Compression: PAGE for big read-mostly rowstore tables, columnstore for facts/events, none on small or hot-write tables.
- Partitioning: only with a switch or retention reason ([scale](./scale.md) section 5).
