# {{PROJECT}} - project facts

Stable facts only. Created {{DATE}}. Mark unverified items.

## At a glance

- Purpose: <one line>
- Stack: <language, framework, runtime>
- Code root / Git root: <folder> / <folder or none>
- Entry points: <files>
- Reference docs: <e.g. known-issues file>

## Guardrails

- Environments: DEV <server/db> (queries sent to the user); PROD never, not even reads.
- Never open: <secret files, e.g. local.env, .test.env>
- Never run: <writers, services, endpoints>

## Commands

Run from `<folder>`.

| Purpose | Command |
|---|---|
| Tests | `<command>` |
| Lint | `<command>` |

## Conventions

- DDL folder and file convention: <folder; one setup file per subject or per table>
- <project-specific coding rule>

## Review focus

- <project-specific risks a reviewer must check>
