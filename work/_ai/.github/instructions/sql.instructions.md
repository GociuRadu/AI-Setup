---
name: sql
applyTo: "**/*.sql"
description: "Use when authoring or reviewing SQL DDL, validation queries or data-repair drafts in any project."
---

# SQL

- Follow the [global rules](global.instructions.md): the agent never executes SQL (only exception: the local test-container permission there); DEV-only reads go to the user as `**Env: DEV | Purpose: <one line> | Query:**`; PRODUCTION is never touched.
- Engine, DDL folder convention and audit tables come from the active project's `docs/ai/project.md`.
- Schema-qualify objects. Keep new DDL in the project's existing subject folder.
- State grain, keys, nullability, constraints and rerun behavior. Prefer existing set-based staging patterns; do not silently replace a reload strategy.
- Describe truncate, sync-delete, incremental or transactional behavior accurately.
- Bound validation reads by key, date range or `TOP`. State purpose, target, environment and expected result.
- Data repair: scoping read first, then the exact narrow write draft, expected affected count and rollback. The user runs it, on DEV only.
- After the user reports execution, verify only through DEV read-only queries sent to the user. Never rerun a write to check it.
