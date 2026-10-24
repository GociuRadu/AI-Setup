# Publish templates (Azure SQL)

## Staging + publish procedure

One reusable staging table per dataset with the target's columns and types. The loader writes and validates staging, then calls one procedure. Identifiers come from a fixed mapping inside the procedure, never from parameters.

```sql
CREATE OR ALTER PROCEDURE <schema>.<Dataset>_Publish
    @RunId UNIQUEIDENTIFIER, @LoadBatchId UNIQUEIDENTIFIER, @ExpectedRows BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- 1 Serialize publishers: sp_getapplock @LockOwner = N'Transaction', or UPDLOCK, HOLDLOCK on the audit rows.
        -- 2 Run guard: this RunId and LoadBatchId are Started (and younger than the run limit).
        -- 3 Version guard: no Succeeded row with an equal or newer source version.
        -- 4 Staging guard: COUNT_BIG(*) of @LoadBatchId = @ExpectedRows; THROW otherwise.
        -- 5 Replace the target (see Atomic replacement).
        -- 6 UPDATE audit SET Status = N'Succeeded' ... WHERE RunId = @RunId AND Status = N'Started';
        --   IF @@ROWCOUNT <> 1 THROW.
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
```

Review lines: schema-qualified names; `THROW`, not `RAISERROR`; parameterized dynamic SQL only with `QUOTENAME` or a fixed mapping; no `SELECT *`; no `NOLOCK`.

## Atomic replacement

| | TRUNCATE + SWITCH | TRUNCATE + INSERT ... WITH (TABLOCK) |
|---|---|---|
| Cost | metadata only | full copy, fully logged in Azure SQL Database |
| Requires | staging identical to target (columns, identity, clustered key, nonclustered indexes, filegroup); staging holds only this batch; ALTER on both | same column list; ALTER (TRUNCATE) and INSERT on target |
| After commit | staging is empty | staging keeps the batch until the next run truncates it |
| Readers | blocked briefly by the schema lock | blocked for the copy |
| Use when | large tables or tight windows | small and medium tables, or staging cannot match the target structure |

Both run in the same transaction as the audit update. No previous copy is kept unless approved: state the post-commit recovery limit (source replay or point-in-time restore).
