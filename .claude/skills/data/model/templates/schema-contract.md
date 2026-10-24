# Schema contract

One contract per table, kept next to its DDL (comment header) and enforced by the loader and tests. Names follow the project's convention.

| Item | State | Example |
|---|---|---|
| Grain | one row per what | one row per BOM path per root material and plant |
| Key | columns that are unique and never NULL | `(root_matno, root_plant, bom_path)` |
| Nullability | NOT NULL columns and required business columns | key + audit columns |
| Cardinality | per relationship: 1:1, 1:N, N:1; allowed fan-out after joins | supplier -> path: N:1 |
| Duplicates | rule for identical rows and same-key/different-content rows | identical: drop and count; same key: fail |

Check SQL (run on DEV or in the local test container; bound reads):

```sql
-- Key unique and not NULL (expect 0, 0)
SELECT
    (SELECT COUNT_BIG(*) FROM (SELECT k1, k2 FROM <schema>.<table> GROUP BY k1, k2 HAVING COUNT_BIG(*) > 1) AS d) AS duplicate_keys,
    (SELECT COUNT_BIG(*) FROM <schema>.<table> WHERE k1 IS NULL OR k2 IS NULL) AS null_keys;

-- Required columns (expect 0)
SELECT COUNT_BIG(*) AS null_required FROM <schema>.<table> WHERE <required_col> IS NULL;

-- Cardinality N:1 child -> parent: orphans and fan-out (expect 0, 0)
SELECT
    (SELECT COUNT_BIG(*) FROM <schema>.<child> AS c
      WHERE NOT EXISTS (SELECT 1 FROM <schema>.<parent> AS p WHERE p.key = c.parent_key)) AS orphans,
    (SELECT COUNT_BIG(*) FROM (SELECT key FROM <schema>.<parent> GROUP BY key HAVING COUNT_BIG(*) > 1) AS f) AS parent_key_fanout;

-- Join keeps grain: rows after join = rows before (expect equal)
SELECT (SELECT COUNT_BIG(*) FROM <schema>.<child>) AS before_join,
       (SELECT COUNT_BIG(*) FROM <schema>.<child> AS c JOIN <schema>.<parent> AS p ON p.key = c.parent_key) AS after_join;
```

Spark equivalents for tests: `groupBy(keys).count().where("count > 1")` is empty; `where(col.isNull())` is empty for key and required columns; `joined.count() == left.count()` for N:1 joins; `assertSchemaEqual` for types and nullability.
