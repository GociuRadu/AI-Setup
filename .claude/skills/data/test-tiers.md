# Test tiers

## Fixtures and assertions

- Fixtures are synthetic: invented identifiers, no customer rows, small (a few rows per case), stored under the project's `tests/fixtures/`.
- Spark: build inputs from the fixture with an explicit schema, write a temporary local Delta table when the code reads Delta, and compare with `assertDataFrameEqual` (rows) and `assertSchemaEqual` (types and nullability).
- SQL: seed staging and audit rows per test, reset tables in `setUp`, assert target rows, staging rows and audit status after each call.
- Load notebook code with the project's AST loader; never execute a notebook export or a module with top-level writes.

## Required failure-path tests

| Area | Tests |
|---|---|
| Validation | empty input, NULL key or required column, duplicate key, type or length overflow, missing source column: each blocks publication |
| Publication | success; count mismatch rolls back with the target unchanged; same or older version rejected; stale or abandoned run rejected |
| Concurrency | second session on a held lock is skipped (busy), not blocked forever |
| Recovery | after an uncertain commit, audit Succeeded makes the rerun skip; failure handlers never rewrite a Succeeded row |
| Contracts | pipeline JSON parameters and defaults equal the notebook parameter cell; DDL columns equal the loader contract |
| Grain | key unique, required columns non-NULL, joins do not fan out (row count before = after for N:1) |

## Integration guard

Tier 3 harnesses refuse any host or database other than the local test container (the [global rules](../../instructions/global.instructions.md): tests never reach a connected system), and include one test that proves the refusal.
