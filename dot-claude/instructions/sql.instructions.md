---
name: sql
description: "Use when authoring or reviewing SQL DDL, validation queries or data-repair drafts in any project."
---

# SQL

- Follow the [global rules](global.instructions.md); what may run on which database is in its Databases section.
- Engine, DDL folder convention and audit tables come from the active project's `docs/ai/project.md`.
- Schema-qualify objects. Keep new DDL in the project's existing subject folder.
- State grain, keys, nullability, constraints and rerun behavior, and describe truncate, sync-delete, incremental or transactional behavior accurately. Prefer existing set-based staging patterns; do not silently replace a reload strategy.
- T-SQL: `THROW`, not `RAISERROR` (except the DDL guard that must `SET NOEXEC ON` after it); no `SELECT *`; no `NOLOCK`; dynamic SQL only with `QUOTENAME` or a fixed mapping, never raw parameters.
- Bound validation reads by key, date range or `TOP`. State purpose, target, environment and expected result.
- Data repair: scoping read first, then the exact narrow write with expected affected count and a rollback, run in a transaction.
- Verify a write with read-only queries. Never rerun a write to check it.
