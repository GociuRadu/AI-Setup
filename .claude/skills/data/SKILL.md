---
name: data
description: "Data engineering on Azure SQL Database, Synapse Spark and local SQL Server/PySpark: tables and DDL (grain, keys, history, indexes, large tables), ingestion and load pipelines (staging, atomic publish, rerun, chunked parallel loads) and Spark notebooks (parameters, runtime, JDBC limits, Spark performance). Use for every data model, DDL, schema, pipeline, notebook, load, migration, Spark, JDBC or slow-load/slow-table request, also small loads into a local database; invoke before writing the DDL or loader."
argument-hint: "<table, pipeline, notebook, design question or review>"
user-invocable: true
---

# Data

One skill for schema design, load pipelines and Spark notebooks. Correct first, then fast. Small changes stay small.

## Safety (on top of the core rules)

- Databases: the [core rules](../../../AGENTS.md#databases-every-profile) Databases section; the checks in the files below follow it. When only production has the data, draft the check for the user.
- TRUNCATE, DROP or emptying a table only when the user names it, except these steps, which the agent writes and the user runs:
  - `Data: rebuild` tables (DDL header): emptying staging in the load path, the approved publish step, the target of an approved full-snapshot publish, drop-and-create in their DDL file.
  - `Data: keep` tables: only drop-and-create of an empty table behind the has-data guard. One exception: the new target of a one-time load that the case gate confirmed nobody reads may be emptied on a pipeline 01 rerun and on a pipeline 01 or 04 undo (04 reruns resume missing chunks). Nothing else on `keep` tables.
- A new table is `rebuild` only when the user asked for a full reload of it; otherwise `keep`. Repairs follow the [SQL rules](../../../AGENTS.md#sql).
- Platform, engine, DDL folder, naming and audit table come from the active project's `project.md`; read only the matching rows of [platforms](platforms.md). Project conventions override the defaults here. Mark any platform fact not verified as unverified. No preview features in production.

## Defaults

- Smallest complete change per the [ponytail](../ponytail/SKILL.md) skill (read it before any code change); reuse the nearest existing notebook, DDL, test and pattern. Keep existing names and behavior unless a change is approved.
- Routine full-snapshot load: one main table + one reusable staging table per dataset, one publish path, the existing audit table (none in `project.md`: propose a minimal one as a separate, optional DDL marked assumed). No previous copy, fallback mode, extra layer or helper framework without a concrete need and approval; state the post-commit recovery limit. Keep setup and run instructions short. Do not force this layout on history, append-only or streaming workflows.
- Validation (schema, types, keys, duplicates, counts, version guards) lives in the loader/publish path. A failed load never publishes partial data.
- Tests: a few behavior tests (success, failure protection, rerun) plus a contract check. What each test tier must contain: [test tiers](test-tiers.md).
- Small change (one column, one parameter, one fix) = steps Frame, Build, Review only. No design record.

## Rules

| # | Rule |
|---|---|
| R1 | Grain first: "one row per what" per table, and the key matches it. |
| R2 | Readers never see an empty or half-loaded table: load on the side, publish in one atomic step (a new table nobody reads may be written directly). |
| R3 | Every run, chunk and publish is rerunnable: twice = once, no duplicates, no gaps. |
| R4 | A failed exact check fails the run (unique key, no empty key, casts, counts). No row-count bands against history. |
| R5 | Newer wins by an explicit version field; the watermark comes from the source marker and moves only at finish. |
| R6 | Existing target tables are the user's design: never guessed, never changed without a request, never dropped (except under Safety). A new table the user asks for: propose its DDL derived from the source (real types, a key, audit columns last) with assumed types marked; the user creates it. |
| R7 | Read the source once; take counts and totals in that pass. |
| R8 | Everything is bounded (parallelism, transactions, retries, timeouts) and sized from one measured chunk, never a constant copied from another job. |
| R9 | Never invent names, keys, lengths, owners or schedules. Ask only a consequential gap, one question with a recommendation; mark harmless assumptions. |
| R10 | No secrets in code. UTC everywhere. Environment through parameters. |
| R11 | Every index serves a named query. Long text keys are bounded or hashed; no MAX types in keys, joins or filters. Tables that must keep data change only through guarded, idempotent migrations with a rollback. |
| R12 | Vanilla flow first, then only the add-ons the signals justify (at most three suggested). Material decisions belong to the user, per table or pipeline, never copied from another one. |

## Workflow

1. **Frame.** Read existing code, DDL, design record and runbook. Infer source, target, grain, volume, frequency, readers; mark each inferred or unknown. Volumes come from a size-check read on local/DEV, not from asking; when only production has the data, mark the volume unknown and draft the query.
2. **Pick the case** and the size tier (small, medium, large): table tiers in [model/scale](model/scale.md), load tiers in [pipeline/performance](pipeline/performance.md) (different thresholds: one sizes the table, the other the run). Medium and large need measured size evidence before chunk, batch or parallelism values.
3. **Decide** only the choices the case needs.
4. **Build** the case flow from `pipeline/cases.md` or `model/cases.md` in the existing artifact paths (DDL: one setup file per subject as in `project.md`). Notebook code follows the [notebook rules](spark.md#notebook-rules).
5. **Review** with [modes](modes.md); for every new or changed DDL, load or publish step also run the `reviewer` agent before handoff; fix Must fix findings before showing. Review findings go to chat; save them only on request (`docs/ai/reports/YYYY-MM-DD-data-<topic>.md`). Run the focused side-effect-free tests; a full-suite run goes to `tester`.
6. **Handoff:** the steps left to the user (production, deploy, every write, load and DDL) in order; a design record for new or changed pipelines and table designs, a runbook for pipelines only ([records](records.md)).

## Resources (read only what the task needs)

Read only the files in the rows that match, one at a time: at most three before the first draft (`spark` for notebook code not counted); `modes`, `records`, `test-tiers` and `performance` only at Review, Handoff or when sizing. Never read the whole folder.

Case numbers are per file: pipeline cases (01-06) and table cases (01-09) are different lists; write them as `pipeline 02` or `table 02`.

| Need | Read |
|---|---|
| Any notebook code (parameters, Synapse vs local, JDBC, Spark speed) | [spark](spark.md) |
| Azure SQL Database, Synapse, local SQL Server or PySpark differences, local test container | [platforms](platforms.md) |
| Table case, DDL shape, add-ons | [model/cases](model/cases.md) |
| Key, history, tree, store, types, index, migration decision | [model/decisions](model/decisions.md) |
| Big or slow table, partitioning, columnstore, long keys | [model/scale](model/scale.md) |
| Grain/key/null/cardinality contract checks | [schema contract](model/templates/schema-contract.md) |
| Review, decide, debug, adapt (tables and pipelines) | [modes](modes.md) |
| Design record, runbook | [records](records.md) |
| Pipeline case flow, traps, Done when, add-ons | [pipeline/cases](pipeline/cases.md) |
| Blocks, change detection, publish, run log, alerts | [pipeline/core](pipeline/core.md) |
| Speed, chunks, parallelism, batch writes, SWITCH | [pipeline/performance](pipeline/performance.md) |
| Test tier contents, fixtures, integration guard | [test tiers](test-tiers.md) |
| Staging + publish proc | [publish](pipeline/templates/publish.md) |
| Restartable snapshot, uncertain commit, audit reuse | [restartable snapshot](pipeline/templates/restartable-snapshot.md) |
| Control list + ForEach, concurrency budget | [metadata ingestion](pipeline/templates/metadata-ingestion.md) |

## Done when

Choices and artifact paths are recorded where the task needs them; review Must fix findings are closed or explicitly open; every check is marked passed, failed or not run; database writes, loads, DDL and deployment stay user actions.
