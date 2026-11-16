# {{PROJECT}} - project facts

Application/service project. Stable facts only. Created {{DATE}}. Mark unverified items.

## At a glance
- Type: `app`
- Purpose: <one line>
- Platform: <language, framework, runtime, hosting>
- Code root / Git root: `{{PROJECT}}/code` / `{{PROJECT}}/code` (clone the repo from the project folder: `git clone <url> code`)
- Entry points / routes: <files>
- Integrations: <systems and roles; no credentials>
- Confluence site: <site>.atlassian.net or none

## Guardrails

- Databases: the core rules in `AGENTS.md` (Databases section). DEV: <server/db>.
- PRODUCTION <servers, databases, hosting>: never, not even reads.
- Tests: isolated settings <required local services>; they write only to their disposable local container, database name ending in `_test`.
- Never open: <secret files, private data>
- Never run: <state-changing endpoints, live integrations, deploy and release scripts>

## Commands

Run from `{{PROJECT}}/code`.

| Purpose | Command | Side effects |
|---|---|---|
| Unit tests | `<command>` | <none or what it touches> |
| Integration tests | `<command>` | <local container only> |
| Lint / type check | `<command>` | none |
| Build | `<command>` | <local only> |

## Definition of done

- Unit tests and lint pass; a bug fix has a test that failed before it.
- API or schema change: callers and migrations updated, backward compatible or the break named.
- `context.md` updated; the user has a commit message and any run steps (the user commits).

## Release and rollback

- Release: <who deploys, how, where it is described>; the agent never deploys.
- Rollback: <previous version, feature flag or down migration>; a migration without a rollback is named in the change.

## Glossary

- <term>: <one-line meaning in this project>

## Conventions

- <project-specific coding rule>

## Review focus

- Security, input validation, retries and idempotency, data handling, external side effects, API contract, test coverage.
