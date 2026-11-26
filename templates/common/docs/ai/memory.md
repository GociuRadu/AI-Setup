# {{PROJECT}} memory

Decisions and non-obvious bugs.

## Decisions

Review = when to re-check: a date or a trigger with how to measure it ("table > 1M rows: `SELECT COUNT(*)` on DEV"); `-` when none. When it fires: re-confirm with a new Review, or add the new decision and mark this row `superseded <date>`.

| Date | Decision | Reason | Review |
|---|---|---|---|

## Bugs

| Date | Symptom | Cause | Fix / status |
|---|---|---|---|
