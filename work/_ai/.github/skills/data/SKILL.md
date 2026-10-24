---
name: data
description: "Data engineering: table/schema design (grain, keys, history, indexes, large tables), ingestion and load pipelines (staging, atomic publish, rerun, chunked parallel loads), and Synapse PySpark notebooks (parameters, runtime, JDBC limits, Spark performance). Use for data model, DDL, schema, pipeline, notebook, load, migration, Spark, JDBC or slow-load/slow-table requests."
argument-hint: "<table, pipeline, notebook, design question or review>"
user-invocable: true
---

# Data

One skill for schema design, load pipelines and Spark notebooks. Correct first, then fast. Small changes stay small.

## Safety (on top of the global rules)

- Knowledge, not permission: never run loaders, notebooks or pipelines, deploy, or touch a database (local test containers in the global rules excepted).
- Queries go to the user in the SQL request format (global rules). No TRUNCATE or DROP unless the user names it. A repair is a scoping read, then a narrow write with expected count and rollback.
- Platform, engine, DDL folder, naming and audit table come from the active project's `project.md`. Project conventions override the defaults here. Mark any platform fact not verified as unverified. No preview features in production.

## Defaults

- Smallest complete change; reuse the nearest existing notebook, DDL, test and pattern. Keep existing names and behavior unless a change is approved.
- Routine full-snapshot load: one main table + one reusable staging table per dataset, one publish path, the existing audit table. No previous copy, fallback mode, extra layer or helper framework without a concrete need and approval; state the post-commit recovery limit. Keep setup and run instructions short. Do not force this layout on history, append-only or streaming workflows.
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
| R6 | Target tables are designed by the user (real types, a key, audit columns last); never guessed, never dropped. |
| R7 | Read the source once; take counts and totals in that pass. |
| R8 | Everything is bounded (parallelism, transactions, retries, timeouts) and sized from one measured chunk, never a constant copied from another job. |
| R9 | Never invent names, keys, lengths, owners or schedules. Ask only a consequential gap, one question with a recommendation; mark harmless assumptions. |
| R10 | No secrets in code. UTC everywhere. Environment through parameters. |
| R11 | Every index serves a named query. Long text keys are bounded or hashed; no MAX types in keys, joins or filters. Tables that must keep data change only through guarded, idempotent migrations with a rollback. |
| R12 | Vanilla flow first, then only the add-ons the signals justify (at most three suggested). Material decisions belong to the user, per table or pipeline, never copied from another one. |

## Workflow

1. **Frame.** Read existing code, DDL, design record and runbook. Infer source, target, grain, volume, frequency, readers; mark each inferred or unknown. Volumes come from a drafted size-check query, not from asking.
2. **Pick the case** and the size tier (small, medium, large): table design tiers in [model/scale](model/scale.md), load tiers in [pipeline/performance](pipeline/performance.md); they measure different things. Medium and large need user-run size evidence before chunk, batch or parallelism values.
3. **Decide** only the choices the case needs.
4. **Build** the case flow from `pipeline/cases.md` or `model/cases.md` in the existing artifact paths (DDL: one setup file per subject as in `project.md`).
5. **Review** with the mode file below; fix S1 and S2 before showing. Review findings go to chat; save them only on request (`docs/ai/reports/YYYY-MM-DD-data-<topic>.md`). Run side-effect-free local tests.
6. **Handoff:** user-run steps in order; runbook and design record only for new or changed pipelines (`docs/ai/reports/<name>.runbook.md`, `<name>.design.yaml`; table designs `<name>.model.yaml`).

## Spark on Synapse (notebook exports)

1. **Parameters:** one parameter cell with literal values; the pipeline passes every parameter and its defaults equal the cell (a unit test asserts it). Validate parameters at the start of `run()`.
2. **Runtime:** pool versions live in `project.md`; unverified values say "to verify on the pool". Local tests use the same major.minor ([runtime matrix](spark/runtime-matrix.md)).
3. **Testable code:** transformations are functions DataFrame -> DataFrame; I/O, `mssparkutils` and the final `run()` stay in their own cells. Tests load definitions with the project's AST loader. Extract a module only when two notebooks share it.
4. **JDBC:** sessions, partitions, batch size, timeouts: [JDBC limits](spark/jdbc-limits.md).
5. **Performance:** evidence first, never invented Spark UI metrics: [performance review](spark/performance-review.md).

## Resources (read only what the task needs)

Case numbers are per file: pipeline cases (01-06) and table cases (01-09) are different lists; write them as `pipeline 02` or `table 02`.

| Need | Read |
|---|---|
| Table case, DDL shape, add-ons | [model/cases](model/cases.md) |
| Key, history, tree, store, types, index, migration decision | [model/decisions](model/decisions.md) |
| Big or slow table, partitioning, columnstore, long keys | [model/scale](model/scale.md) |
| Grain/key/null/cardinality contract checks | [schema contract](model/templates/schema-contract.md) |
| Model review, decide, debug, design record | [model/modes](model/modes.md) |
| Pipeline case flow, traps, Done when, add-ons | [pipeline/cases](pipeline/cases.md) |
| Blocks, change detection, publish, run log, alerts | [pipeline/core](pipeline/core.md) |
| Speed, chunks, parallelism, batch writes, SWITCH | [pipeline/performance](pipeline/performance.md) |
| Pipeline adapt, review, debug, runbook, design record | [pipeline/modes](pipeline/modes.md) |
| Staging + publish proc | [publish](pipeline/templates/publish.md) |
| Restartable snapshot, uncertain commit, audit reuse | [restartable snapshot](pipeline/templates/restartable-snapshot.md) |
| Control list + ForEach, concurrency budget | [metadata ingestion](pipeline/templates/metadata-ingestion.md) |

## Done when

Choices and artifact paths are recorded where the task needs them; review S1/S2 are closed or explicitly open; every check is marked passed, failed or not run; database execution and deployment stay user actions.
