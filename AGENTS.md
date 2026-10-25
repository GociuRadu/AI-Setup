# Agents entrypoint (Copilot, Codex and other agents)

Same setup as [CLAUDE.md](CLAUDE.md), for agents that do not read `.claude/` on their own.

- Rules: [global](.claude/instructions/global.instructions.md); for `.py`/`.sql` also [python](.claude/instructions/python.instructions.md) and [sql](.claude/instructions/sql.instructions.md).
- Workflows: read the matching `.claude/skills/<name>/SKILL.md` before the task (`analyze`, `review`, `bug`, `data`, `confluence`, `ponytail`, `lead`). Helper roles: `.claude/agents/`; without subagents, do their work yourself.
- Per project: `<project>/AGENTS.md`, then `docs/ai/`.
