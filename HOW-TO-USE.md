# How to use the AI setup

Shared Claude Code setup for `projects`. Rules, agents and skills live in `.claude/`; maintenance notes in `_ai/` ([README](_ai/README.md)); each project keeps its facts in `<project>/docs/ai/` and its Git checkout in `<project>/code/`.

## Start

1. Open Claude Code in `C:\Users\radug\Desktop\projects` (not in a project or `code/` folder), so `.claude/` skills, agents and settings load.
2. Name the project or paths in the request (`<project>/...`). Change `.claude/` or `_ai/` only when you mean to change the setup.
3. Say goal, scope, expected result and constraints. No credentials or customer rows: use placeholders.

## Pick the way to work

| Need | Use |
|---|---|
| Small question or edit | default chat |
| Multi-file work with research, edits and review | `lead` (starts on its own, or type `/lead`; runs on `/model` Opus or Sonnet, helpers on Haiku) |
| Design, architecture, hard debugging | `/model opus` first, then `lead` |
| A repeatable workflow | a skill (type `/`) |

Skills: `/analyze`, `/review`, `/bug`, `/data`, `/confluence`, `/ponytail`.

Tests: ask "run the tests"; I use the `tester` agent (Haiku).

## Safety rules

Single source: [.claude/instructions/global.instructions.md](.claude/instructions/global.instructions.md). Permissions: [.claude/settings.json](.claude/settings.json) runs everything without prompts (personal device). Hard stops denied: production/staging/hostinger/monitoring compose files, release/rollback scripts, SSH/SCP, Hostinger MCP write tools, force-push, `down -v` and volume deletion, reading `.env` files.

## Where results go

| Result | Location |
|---|---|
| Stable facts, commands, review focus | `<project>/docs/ai/project.md` |
| Current state and open work | `<project>/docs/ai/context.md` |
| Decisions, lessons, bugs | `<project>/docs/ai/memory.md` |
| Reports, runbooks, design records | `<project>/docs/ai/reports/` |
| Tests | `<project>/code/tests/` |

## Projects

One folder per project (not versioned here): its `CLAUDE.md` says what to read, `docs/ai/project.md` holds type, code root, guardrails and commands.

## Add a project

1. Copy `_ai/templates/project/` to `projects/<Name>/` and replace `{{PROJECT}}`.
2. Clone the repo into `projects/<Name>/code`.
3. Fill `docs/ai/project.md`.

## Troubleshooting

| Symptom | Try |
|---|---|
| Skill or agent missing | Claude Code started outside `projects`; restart it there and start a new session |
| Wrong project's rules used | Name the project/path in the request |
| A command was not run | A hard stop (deny list in settings.json); remove the line there if you really want it |
| Prompts still appear | In VS Code pick "Bypass permissions" in the mode selector once, or start a new session |
| Confluence unavailable | Check the Atlassian connector in Claude settings |
