# Table cases

Pick the case per table, first match wins. A table can mix cases (an entity with JSON attributes): take the main case and add the other's columns. Outside the nine: take the closest, say what differs, ask.

| # | Case | Pick when | Grain example | Key | Data |
|---|---|---|---|---|---|
| 01 | staging | lands here before any check | one row per source row per run | none (the pipeline validates) | rebuild |
| 02 | entity | none of the above: a business thing | one row per customer | surrogate + unique natural key | keep |
| 03 | lookup | a short list of codes | one row per status | the code | keep: create if missing, values applied every deploy |
| 04 | link | many-to-many between two things | one row per item per warehouse | both ids | keep |
| 05 | tree | parent-child inside one table | one row per node | surrogate + unique natural + parent_id | keep |
| 06 | history | past versions must be kept | one row per customer per version | version id + unique (entity id, valid_from) | keep |
| 07 | event | something that happened, never updated | one row per event | BIGINT id + the source event id | keep |
| 08 | fact | numbers summed in reports at a grain | one row per item per site per day | the grain columns | rebuild when rebuilt from core, keep for state snapshots |
| 09 | flexible | attributes vary row to row | one row per product, attributes in JSON | like an entity | keep |

Data: rebuild = may be dropped any time and reloaded fully. Keep = must survive, so the guard is on and changes go through migrations ([decisions](./decisions.md) change_with_data).

## DDL file shape (every table)

File layout: follow the DDL file convention in `project.md`. If none is named: one setup SQL file per subject (`<subject>_setup.sql`) under the project's DDL folder; extend it, don't split per table. Each table in it = base + the case + chosen add-ons. T-SQL is the default unless `project.md` names another engine; then translate and say so.

Header comment: What, Grain (one row per ...), Case, Read by (who and main queries), Data (rebuild | keep). Session settings (`SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON;`). Schema created if missing. Guard for keep tables. Drop and create for rebuild tables. Every constraint and index named. Every index has a `-- serves: <query>` comment. No comment, no index.

```sql
/* <schema>.<table>
   What:    <one line>
   Grain:   one row per <...>
   Case:    <case>
   Read by: <who, and the main queries>
   Data:    rebuild | keep
*/
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOEXEC OFF;
GO
IF SCHEMA_ID(N'<schema>') IS NULL EXEC (N'CREATE SCHEMA <schema>');
GO
-- Guard (Data: keep only; delete this block for Data: rebuild). NOEXEC skips the rest of the file.
IF EXISTS (SELECT 1 FROM sys.partitions
           WHERE object_id = OBJECT_ID(N'<schema>.<table>') AND index_id IN (0, 1) AND rows > 0)
BEGIN
    RAISERROR (N'<schema>.<table> has data - use a migration', 16, 1);
    SET NOEXEC ON;
END;
GO
DROP TABLE IF EXISTS <schema>.<table>;
GO
CREATE TABLE <schema>.<table> (
    <table>_id     INT IDENTITY(1, 1) NOT NULL,
    <natural_key>  NVARCHAR(50)       NOT NULL,
    <column>       <type>             NOT NULL,
    _loaded_at     DATETIME2(3)       NOT NULL CONSTRAINT df_<table>__loaded_at DEFAULT SYSUTCDATETIME(),
    _source        NVARCHAR(200)      NOT NULL,
    _loaded_by     NVARCHAR(200)      NOT NULL,
    CONSTRAINT pk_<table> PRIMARY KEY CLUSTERED (<table>_id),
    CONSTRAINT uq_<table>_<natural_key> UNIQUE (<natural_key>)
);
GO
-- serves: <the query this index is for>
CREATE INDEX ix_<table>_<column> ON <schema>.<table> (<column>);
GO
SET NOEXEC OFF;
GO
```

Rules: audit columns only on tables a pipeline writes. Checks that run after each load (cycles, overlaps) belong to the loading pipeline, and the file holds them as a commented query. Run order: lookups, parent entities (with -1 rows), entities, version/edge/key map/link, facts. An FK to a missing table fails the CREATE. Traps: another table points here with an FK so DROP fails (rebuild children too, or migrate); a keep table with its guards deleted is wiped by one run.

Base add-ons (per table): SOURCE_IN_THE_KEY (the same code from two systems: `UNIQUE (source_system, item_no)`); SOFT_DELETE (`_is_deleted`, `_deleted_at`); UPDATED_AT (other pipelines read incrementally); CASE_SENSITIVE_KEY (binary collation); TENANT (tenant_id first in the key, plus row-level security); READER_VIEW (a view with only what readers need and `_is_deleted = 0`); COMPRESSION (page, big read-mostly); PARTITIONING (see [scale](./scale.md)); DESCRIPTIONS (extended properties when others maintain it).

---

## 01 staging

Where a load lands before its checks. Rebuilt or emptied every run.
- Heap: no PK, no constraints, few NOT NULLs (bad rows must land so the checks can count them). Columns as the source sends them (text, generous but not max) plus audit columns. Data: rebuild, no guard.
- Add-ons: TYPED_COLUMNS (a typed, trusted DB source); MERGE_INDEX (an index on the key built after the load, when publish reads staging by key); RUN_COLUMN (`_run_id`, when staging is appended per run).
- For high-volume loads: staging mirrors the target's columns and types, and for SWITCH also its indexes, filegroup and partition range check ([scale](./scale.md)).
- Traps: constraints in staging (the load fails on the first bad row); every column NVARCHAR(MAX).

## 02 entity

A business thing with a durable id everything points to. Base file as is: surrogate PK plus UNIQUE natural key, an FK to every lookup or parent it points to, each FK column indexed.

```sql
    <lookup>_code VARCHAR(20) NOT NULL,
    CONSTRAINT fk_<table>_<lookup> FOREIGN KEY (<lookup>_code) REFERENCES <schema>.<lookup> (<lookup>_code)
-- serves: joins from <lookup>
CREATE INDEX ix_<table>_<lookup>_code ON <schema>.<table> (<lookup>_code);
```

- Add-ons: UNKNOWN_MEMBER (row -1 that facts point to; needed when a fact points here); INFERRED_MEMBER (placeholder when a fact arrives before its entity, `is_inferred = 1`); KEY_MAP (one real thing with keys in several systems); HISTORY (06); JSON_ATTRIBUTES (09).
- UNKNOWN_MEMBER: after the CREATE, before the last `SET NOEXEC OFF`, safe to run twice. Every NOT NULL column needs a value in the unknown row. A lookup it points to needs its UNKNOWN code. A parent entity it points to needs its own -1 row, and its file runs first.

```sql
IF NOT EXISTS (SELECT 1 FROM <schema>.<table> WHERE <table>_id = -1)
BEGIN
    SET IDENTITY_INSERT <schema>.<table> ON;
    INSERT INTO <schema>.<table> (<table>_id, <natural_key>, <other NOT NULL columns>, _source, _loaded_by)
    VALUES (-1, N'#unknown', <'UNKNOWN' for codes, N'Unknown' for names>, N'model:default', N'<schema>.<table>.sql');
    SET IDENTITY_INSERT <schema>.<table> OFF;
END;
GO
```

- KEY_MAP (its own file): `<table>_key_map (source_system VARCHAR(20), source_key NVARCHAR(50), <table>_id INT)`, PK clustered (source_system, source_key), FK to the entity, and an index on `<table>_id` ("all source keys of one entity").
- Traps: only the surrogate key (duplicates load silently); an FK column without an index.

## 03 lookup

A short list of codes. Values live in the file and are applied on every deploy. No guard and no drop: created only if missing, structure changes via migration. The code is the PK, with name and is_active. An UNKNOWN code exists when tables point here with a NOT NULL column and an unknown member exists.

```sql
IF OBJECT_ID(N'<schema>.<table>') IS NULL
BEGIN
    CREATE TABLE <schema>.<table> (
        <table>_code VARCHAR(20)   NOT NULL,
        name         NVARCHAR(100) NOT NULL,
        is_active    BIT           NOT NULL CONSTRAINT df_<table>_is_active DEFAULT 1,
        CONSTRAINT pk_<table> PRIMARY KEY CLUSTERED (<table>_code)
    );
END;
GO
MERGE <schema>.<table> AS t
USING (VALUES ('UNKNOWN', N'Unknown'), ('<code_1>', N'<name_1>')) AS s (<table>_code, name)
   ON t.<table>_code = s.<table>_code
WHEN MATCHED AND t.name <> s.name THEN UPDATE SET name = s.name
WHEN NOT MATCHED BY TARGET THEN INSERT (<table>_code, name) VALUES (s.<table>_code, s.name);
GO
```

- Add-ons: ORDERED (`sort_order`); CHECK_INSTEAD (a few fixed values, no names); TRANSLATIONS (a name per language).
- Traps: values added by hand in prod (put them in the file); deleting a value still used (set `is_active = 0`, the MERGE never deletes).

## 04 link

Many-to-many between `<a>` and `<b>`. PK on both ids, an FK to each side, and an index for the other direction. A side keyed by a lookup code uses the code column.

```sql
CREATE TABLE <schema>.<a>_<b> (
    <a>_id INT NOT NULL, <b>_id INT NOT NULL,
    <audit columns>
    CONSTRAINT pk_<a>_<b> PRIMARY KEY CLUSTERED (<a>_id, <b>_id),
    CONSTRAINT fk_<a>_<b>_<a> FOREIGN KEY (<a>_id) REFERENCES <schema>.<a> (<a>_id),
    CONSTRAINT fk_<a>_<b>_<b> FOREIGN KEY (<b>_id) REFERENCES <schema>.<b> (<b>_id)
);
GO
-- serves: lookups from the <b> side
CREATE INDEX ix_<a>_<b>_<b>_id ON <schema>.<a>_<b> (<b>_id, <a>_id);
GO
```

- Add-ons: ATTRIBUTES (columns about the pair); VALIDITY (each pair valid for a period: add `valid_from DATE`, `valid_to DATE DEFAULT '9999-12-31'` exclusive, PK `(<a>_id, <b>_id, valid_from)`, `CHECK (valid_from < valid_to)`, and `CREATE UNIQUE INDEX ux_<a>_<b>_open ... (<a>_id, <b>_id) WHERE valid_to = '9999-12-31'`. The pipeline checks for overlaps with LEAD over `valid_from`).

## 05 tree

Parent-child in one table (adjacency list). Closure, path and flattened levels are derived from it. For fixed levels with their own attributes, use one 02 entity per level with an FK to its parent level.

```sql
CREATE TABLE <schema>.<table> (
    <table>_id    INT IDENTITY(1, 1) NOT NULL,
    parent_id     INT                NULL,          -- NULL = root
    <natural_key> NVARCHAR(50)       NOT NULL,
    name          NVARCHAR(100)      NOT NULL,
    <audit columns>
    CONSTRAINT pk_<table> PRIMARY KEY CLUSTERED (<table>_id),
    CONSTRAINT uq_<table>_<natural_key> UNIQUE (<natural_key>),
    CONSTRAINT fk_<table>_parent FOREIGN KEY (parent_id) REFERENCES <schema>.<table> (<table>_id),
    CONSTRAINT ck_<table>_not_own_parent CHECK (parent_id <> <table>_id)
);
GO
-- serves: children of a node, recursive queries
CREATE INDEX ix_<table>_parent_id ON <schema>.<table> (parent_id);
GO
```

- Every recursive query carries `OPTION (MAXRECURSION 100)`. After each load the pipeline runs a cycle check: nodes not reachable from a root (a recursive CTE from `parent_id IS NULL`) must return 0 rows.
- When the source sends parent codes: insert all nodes first, then set `parent_id` by joining on the natural key.
- Several parents per node is not a tree: use a link table of edges.
- Add-ons: NODE_TYPE; SIBLING_NAMES (`UNIQUE (parent_id, name)`); CLOSURE_TABLE (`<table>_closure (ancestor_id, descendant_id, depth)`, PK (ancestor, descendant), index (descendant, ancestor); rebuilt after each load; for frequent subtree questions, deep trees or BI); FLATTENED_VIEW (level columns for BI); PATH (`/1/4/9/` for exports); HISTORY_ON_EDGES (the parent moves to `<table>_edge (child_id, parent_id, valid_from, valid_to)`, PK (child_id, valid_from), one open parent per child through a filtered unique index, overlap check per child, cycle check per date).
- Trap: a level stored as a column and not updated after a move.

## 06 history

Past versions in `<table>_version` next to its 02 entity. The entity keeps the durable id. Facts point to the entity for "as it is now" and to the version for "as it was then" (08 POINT_IN_TIME_KEY).

- One row per version, FK to the entity. `valid_from`, `valid_to` (exclusive, open = 9999-12-31), `is_current`. `UNIQUE (<entity>_id, valid_from)`, `CHECK (valid_from < valid_to)`, a CHECK that `is_current` agrees with `valid_to`, and a filtered unique index `WHERE is_current = 1` (one current row per entity).
- `row_hash`: a persisted computed SHA2_256 of the tracked columns, the same recipe for every writer. Encode in a fixed order: NULL as `N;`, a value as `V` + its UTF-16 byte length (`DATALENGTH`, not `LEN`) + `:` + value + `;`. Use fixed CONVERT styles for dates and decimals. Never truncate long tracked values. Never include audit columns. Delimiter-only hashes collide (`('a|b','c')` vs `('a','b|c')`).
- Columns overwritten in place (a typo fix) stay out of the hash and live on the entity.
- Decision first_version_start (asked): 1900-01-01 (older facts find a version) or the source creation date (when reliable).
- With POINT_IN_TIME_KEY on facts: seed version -1 for entity -1, open from 1900-01-01.
- After each load the pipeline checks gaps and overlaps: LEAD(valid_from) per entity must equal the previous `valid_to`.
- Add-ons: CURRENT_VIEW (only `is_current = 1`, joined to the entity); TEMPORAL_INSTEAD (system-versioned table, AS OF queries, DB change time not business time; always keep; the guard checks the history table too; for audit of app or config tables); RETENTION (`HISTORY_RETENTION_PERIOD`); COMPRESSION.
- Traps: `valid_to` NULL in one table and 9999-12-31 in another (pick 9999-12-31); a temporal table reloaded in full nightly (every row "changes" daily); facts pointing to the version id when they need "as it is now".

## 07 event

Something that happened, appended and never updated.
- `<table>_id BIGINT IDENTITY` (logs outgrow INT). `source_event_id NVARCHAR(50) NOT NULL UNIQUE` (a replayed event is refused; with no such id, a unique key over the identifying business columns or a persisted hash; only if nothing identifies the event, the header says "no dedupe" and why). `event_at DATETIME2(3)` in UTC (when it happened), with an index for reads by time. `<what_id>` indexed when read by it. The loader skips events already there (`WHERE NOT EXISTS`) so one replayed row does not fail the batch. A correction is a new event.
- An FK on `<what_id>` only while the table is small or loaded row by row. Big bulk loads let the pipeline check orphans.
- Replay identity is the global `source_event_id` (plus source system where needed), never `(source_event_id, event_at)`. Reject partitioning unless an approved, enforced global dedupe preserves that identity across all partitions.
- Add-ons: COLUMNSTORE (PK becomes NONCLUSTERED; millions of rows read by reports); CLUSTER_BY_TIME (clustered on `(event_at, id)`, PK nonclustered; reads by time range); APPEND_ONLY (`DENY UPDATE, DELETE` for the loader role); PARTITIONING (only with the global dedupe above).
- Traps: updating events to "correct" them; INT id on a busy log; `UNIQUE (source_event_id, event_at)` alone.

## 08 fact

Numbers for reports at one grain, built by a pipeline.
- The PK is the grain (the dimension columns of the grain sentence). Dimension ids are never NULL: they point to the dimension's -1 unknown member, which must exist. Measures are fixed decimals. Ratios are stored as their parts.
- Decision fact_kind (goes in the header): transactions (sums over everything) or a snapshot of state (stock, balance: sum across items, never across dates).

```sql
CREATE TABLE <schema>.<table> (
    <date>   DATE NOT NULL, <dim>_id INT NOT NULL,   -- -1 = unknown member
    <measure> DECIMAL(18, 2) NOT NULL,
    <audit columns>
    CONSTRAINT pk_<table> PRIMARY KEY CLUSTERED (<date>, <dim>_id)   -- = the grain
);
```

- Add-ons: COLUMNSTORE (over about 1M rows read by reports; PK NONCLUSTERED, then `CREATE CLUSTERED COLUMNSTORE INDEX cci_<table>`; see [scale](./scale.md)); POINT_IN_TIME_KEY (the version id valid when it happened); FOREIGN_KEYS (small or row-by-row loaded; big bulk loads let the pipeline check); RELOAD_WINDOW (a reload replaces only a date range, by delete + insert or partition switch); DATE_DIMENSION.
- Traps: the header grain differs from the PK; NULL dimension ids, or -1 without its row; averages stored as measures; stock summed over 30 days.

## 09 flexible

Attributes that vary by row: typed columns for what is queried, the rest in JSON. Like an entity plus `attributes JSON NULL` (the native JSON type where the engine and tier support it as generally available, else a validated NVARCHAR with `ISJSON`). Everything filtered, joined or summed is a typed column.
- Add-ons: JSON_INDEX (`CREATE JSON INDEX jx_<table>_attributes ... FOR ('$.<path>')`, needs a clustered PK; check general availability before prod); COMPUTED_COLUMN (typed from a path with `TRY_CAST(JSON_VALUE(...))`, indexed); CHILD_TABLE (an array whose items are filtered or counted).
- Traps: an attribute used in most reports left in JSON (promote it); numbers or dates compared as text.
