# GitHub Copilot
The core rules are in [AGENTS.md](../AGENTS.md), which Copilot loads on its own; if it is not in your context, read it now. This file only maps names.
- Skills: `.claude/skills/<name>/SKILL.md` (Copilot discovers this folder), each also a slash command with its name (`/review`, `/data`, ...).
- Helpers: `scout`, `worker`, `tester`, `reviewer` are custom agents in `.github/agents/` (generated from `.claude/agents/`); run them as subagents by that exact name. Never the built-in `general-purpose`, `explore`, `task` or another unnamed subagent.
- Models: cheap = `claude-haiku-5.5` (or `gpt-6-luna`), medium = `claude-sonnet-5.5`, top = `claude-opus-5.5`.
- Guards: `.github/hooks/guard.json` (and the hooks in `.claude/settings.json`, which Copilot also runs) run `_ai/hooks/guard.mjs` before every tool. The profile is `.github/instructions/profile.instructions.md`, written by `node _ai/setup.mjs`.
