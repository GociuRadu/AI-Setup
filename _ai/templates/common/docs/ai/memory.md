# {{PROJECT}} memory

Durable decisions, lessons learned, bugs. No secrets, no customer data.

## Decisions

Review = when to re-check: a date or a trigger with how to measure it ("table > 1M rows: `SELECT COUNT(*)` on DEV"); `-` when none. When it fires: re-confirm with a new Review, or add the new decision and mark this row `superseded <date>`; never delete a row.

| Date | Decision | Reason | Review |
|---|---|---|---|

## Lessons learned

## Bugs

| Date | Symptom | Cause | Fix / status |
|---|---|---|---|
