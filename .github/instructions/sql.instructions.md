---
applyTo: "**/*.sql"
---
<!-- Generated from .claude/rules/sql.md by node _ai/check.mjs --fix; edit the source. -->
# SQL rules

- Engine, DDL folder and audit tables come from `project.md`. Schema-qualify objects; put new DDL in the existing subject folder.
- State grain, keys, nullability, constraints and rerun behavior; describe truncate, sync-delete, incremental or transactional behavior accurately. Keep existing set-based staging and reload strategies unless asked.
- T-SQL: `THROW`, not `RAISERROR` (except the DDL guard followed by `SET NOEXEC ON`); no `SELECT *`; no `NOLOCK`; dynamic SQL only with `QUOTENAME` or a fixed mapping.
- Bound validation reads by key, date range or `TOP`; state purpose, target, environment and expected result.
- Data repair: a scoping read, then the exact narrow write with expected count and rollback, in a transaction. Verify with reads; never rerun a write to check it.
