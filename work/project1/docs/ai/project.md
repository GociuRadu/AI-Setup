# project1 - project facts

Stable facts only. Mark assumptions and unverified platform details.

## At a glance

- Purpose: <one line>
- Stack/runtime: <language, Spark/runtime, database>
- Code/Git root: <paths or none>
- Entry points: <notebooks, pipelines, scripts>
- Source/target systems: <systems, no credentials>

## Guardrails

- Environments and permitted operations: <DEV/test/prod boundary>
- Never open: <secret and private-data paths>
- Never run: <writers, pipelines, services, endpoints>
- Local test data: synthetic only; database name must end in `_test`.

## Commands

Run from `<project-root>`.

| Purpose | Command | Side effects |
|---|---|---|
| Unit tests | <command> | <none/test DB> |
| Spark tests | <command> | <none/local files> |
| SQL tests | <command> | <disposable database> |

## Conventions

- Notebook/source layout: <folders>
- SQL/DDL layout: <folders and naming>
- Tests and fixtures: <paths>

## Review focus

- <data correctness, idempotency, publish safety, cardinality, runtime limits>
