# How to use the AI setup

Open the workspace root (not a project or `code/` folder) so the rules, skills and agents load. Name the project or path in the request and say goal, scope and expected result. No credentials or customer rows.

## Pick the way to work

| Need | Use | Output |
|---|---|---|
| Turn a rough request into a clear prompt first | `/p <request>` (waits for your OK; Haiku at home) | Goal, Scope, Done when, Constraints |
| Question, small change in a few files | default chat | answer or changes |
| Plan or design, risky path, 5+ files, research | just ask: the main session plans and starts the helpers itself | plan or changes |
| Explain, document, write up a decision | `/analyze <scope>` | `docs/ai/reports/…-analyze-…md` |
| Review a change / audit a project | `/review [files]` / `/review audit` | chat / `docs/ai/reports/…-review-…md` |
| Something is wrong | `/bug <symptom>` | report with cause and proposed fix (no code change) |
| Tables, DDL, loads, Spark notebooks | `/data <task>` | changes, runbook and design record when new |
| Confluence page (link required) | `/confluence <link> <change>` | page title and new version |
| Smaller or larger code changes | `/ponytail lite\|full\|ultra\|off` | this chat only |
| Run the tests | "run the tests" | counts in chat (`tester`) |

## Helpers

| Agent | Model (Claude / Copilot) | Does |
|---|---|---|
| `scout` | Haiku 5.5 / Haiku 5.5, GPT-6 Luna | read-only search in files and the public web |
| `worker` | Haiku 5.5 / Haiku 5.5, GPT-6 Luna | bulk mechanical edits from an exact spec |
| `tester` | Haiku 5.5 / Haiku 5.5, GPT-6 Luna | runs tests and lint, reports counts |
| `reviewer` | Sonnet 5.5 / Sonnet 5.5 | read-only review before handoff |

## Safety

- Databases (everywhere): the agent runs only read-only queries on the local Docker database and DEV; every write, DDL, load or repair is a draft you run; you create the tables; PRODUCTION never. The `block-db-writes` hook blocks writing SQL sent through a database client.
- Home: `settings.json` runs everything without prompts and denies the hard stops (secret files, force-push, volume deletion, production compose files, SSH, hosting write tools). Work: the agent asks before anything that is not a file read.

## Where results go

| Result | Location |
|---|---|
| Stable facts, commands, guardrails | `<project>/docs/ai/project.md` |
| Current state, open work | `<project>/docs/ai/context.md` |
| Decisions, lessons, bugs | `<project>/docs/ai/memory.md` |
| Reports, runbooks, design records | `<project>/docs/ai/reports/` |
| Code and tests | `<project>/code/` (the Git checkout) |

## Add a project

`node _ai/scripts/new-project.mjs <Name> [--template app|data-eng] [--dest <dir>]`, then clone the repo into `code/` (`app`) or `git init` there (`data-eng`), and fill `docs/ai/project.md` (at least At a glance, Guardrails, Commands). `data-eng` includes the local Docker test environment: see `code/local/SETUP-WSL.md` and `code/local/README.md`.

## Change the setup

Edit the AI-Setup source repo (`dot-claude/`, `_ai/`; never a built workspace), then `node _ai/scripts/build.mjs --home <home workspace> --work <work workspace>`, start a new session and commit. The Obsidian vault (`Me/Code/Setup`) holds only the built work setup, with `.github` stored as `dot-github`: at work, copy it into the workspace and rename `dot-github` to `.github`. Refresh it with `--work` into the vault, then rename `.github` to `dot-github`.
