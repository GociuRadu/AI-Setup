---
name: data
description: "Use for every data model, table, DDL, schema, ingestion or load pipeline, Spark notebook, migration, JDBC or slow-load/slow-table request on Azure SQL Database, Synapse Spark or local SQL Server/PySpark, also small loads into a local database and questions like 'is this table or load well designed?'; invoke before writing the DDL or loader or answering the design question."
argument-hint: "<table, pipeline, notebook, design question or review>"
---
<!-- Generated from _ai/skills/data/SKILL.md by node _ai/sync.mjs; edit the source. -->

# Data

One skill for schema design, load pipelines and Spark notebooks. Correct first, then fast. Small changes stay small.

## Safety (on top of the core rules)

- Databases: the [core rules](../../../AGENTS.md#databases) Databases section; the checks in the files below follow it.
- TRUNCATE, DROP or emptying a table only when the user names it, except these steps, which the agent writes and the user runs:
  - `Data: rebuild` tables (DDL header): emptying staging in the load path, the approved publish step, the target of an approved full-snapshot publish, drop-and-create in their DDL file.
  - `Data: keep` tables: only drop-and-create of an empty table behind the has-data guard. One exception: the new target of a one-time load that the case gate confirmed nobody reads may be emptied on a pipeline 01 rerun and on a pipeline 01 or 04 undo (04 reruns resume missing chunks). Nothing else on `keep` tables.
- A new table is `rebuild` only when the user asked for a full reload of it; otherwise `keep`.
- Platform, engine, DDL folder, naming and audit table come from the active project's `project.md`; read only the matching rows of [platforms](platforms.md). Project conventions override the defaults here. No preview features in production.

## Defaults

- Reuse the nearest existing notebook, DDL, test and pattern; keep existing names and behavior unless a change is approved.
- Routine full-snapshot load: one main table + one reusable staging table per dataset, one publish path, the existing audit table (none in `project.md`: propose a minimal one as a separate, optional DDL marked assumed). No previous copy, fallback mode, extra layer or helper framework without a concrete need and approval; state the post-commit recovery limit. Do not force this layout on history, append-only or streaming workflows.
- Validation (schema, types, keys, duplicates, counts, version guards) lives in the loader/publish path. A failed load never publishes partial data.
- Tests: a few behavior tests (success, failure protection, rerun) plus a contract check ([test tiers](test-tiers.md)).
- Small change (one column, one parameter, one fix) = steps Frame, Build, Review only; no runbook.

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

1. **Frame.** Read existing code, DDL, `memory.md` and any runbook. Infer source, target, grain, volume, frequency, readers; mark each inferred or unknown. Volumes come from a size-check read on local/DEV, not from asking; when only production has the data, mark the volume unknown and draft the query.
2. **Pick the case** and the size tier (small, medium, large): table tiers in [model/scale](model/scale.md), load tiers in [pipeline/performance](pipeline/performance.md) (different thresholds: one sizes the table, the other the run). Medium and large need measured size evidence before chunk, batch or parallelism values.
3. **Decide** only the choices the case needs.
4. **Build** the case flow from `pipeline/cases.md` or `model/cases.md` in the existing artifact paths (DDL: one setup file per subject as in `project.md`). Notebook code follows the [notebook rules](spark.md#notebook-rules).
5. **Review** with [modes](modes.md); for every new or changed DDL, load or publish step also run the `reviewer` agent before handoff; fix Must fix findings before showing. Review findings go to chat; save them only on request (`docs/ai/reports/YYYY-MM-DD-data-<topic>.html`, `_ai/rules/report.md`). Run the focused side-effect-free tests.
6. **Handoff:** list user-run steps in order (production, deploy, every write, load and DDL). Record settled design choices in `plans/` and `memory.md`. For a new or changed pipeline (not a small fix), write or update `docs/ai/runbooks/<safe-name>.md` and link it in `project.md` Asset index: case, source -> target, schedule, readers, decisions/add-ons, failure/alert behavior, rerun and undo steps, measured throughput/bottleneck (medium/large), and post-commit recovery limit.

## Resources (read only what the task needs)

Read only the rows that match, one file at a time, at most three before the first draft (`spark` not counted). Case numbers are per file (`pipeline 02`, `table 02`).

| Need | Read |
|---|---|
| Any notebook code (parameters, Synapse vs local, JDBC, Spark speed) | [spark](spark.md) |
| Azure SQL Database, Synapse, local SQL Server or PySpark differences, local test container | [platforms](platforms.md) |
| Table case, DDL shape, add-ons | [model/cases](model/cases.md) |
| Key, history, tree, store, types, index, migration decision | [model/decisions](model/decisions.md) |
| Big or slow table, partitioning, columnstore, long keys | [model/scale](model/scale.md) |
| Grain/key/null/cardinality contract checks | [schema contract](model/templates/schema-contract.md) |
| Review, decide, debug, adapt (tables and pipelines) | [modes](modes.md) |
| Pipeline case flow, traps, Done when, add-ons | [pipeline/cases](pipeline/cases.md) |
| Blocks, change detection, publish, run log, alerts | [pipeline/core](pipeline/core.md) |
| Speed, chunks, parallelism, batch writes, SWITCH | [pipeline/performance](pipeline/performance.md) |
| Test tier contents, fixtures, integration guard | [test tiers](test-tiers.md) |
| Staging + publish proc | [publish](pipeline/templates/publish.md) |
| Restartable snapshot, uncertain commit, audit reuse | [restartable snapshot](pipeline/templates/restartable-snapshot.md) |
| Control list + ForEach, concurrency budget | [metadata ingestion](pipeline/templates/metadata-ingestion.md) |

## Done when

Choices and artifact paths are recorded where the task needs them; review Must fix findings are closed or explicitly open; every check is marked passed, failed or not run; database writes, loads, DDL and deployment stay user actions.
