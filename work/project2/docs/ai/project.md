# project2 - project facts

Stable facts only. Mark assumptions and unverified details.

## At a glance

- Purpose: <one line>
- Stack/runtime: <language, framework, runtime>
- Code/Git root: <paths or none>
- Entry points/routes: <files>
- Integrations: <systems, roles only; no credentials>

## Guardrails

- Local test configuration: <isolated settings and required services>
- Never open: <secret files, private data>
- Never run: <state-changing endpoints, live integrations, deployment actions>
- Production boundary: <explicit restrictions>

## Commands

Run from `<project-root>`.

| Purpose | Command | Verification/effects |
|---|---|---|
| Unit tests | <command> | <result/side effects> |
| Lint/type check | <command> | <result> |
| Build | <command> | <local-only or approval required> |

## Review focus

- Security, retries/idempotency, data handling, external side effects, API contract, test coverage.
