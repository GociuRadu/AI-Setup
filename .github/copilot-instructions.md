# GitHub Copilot

The core rules are in [AGENTS.md](../AGENTS.md), which Copilot loads on its own; if it is not in your context, read it now. This file only maps names.

- Skills: `.claude/skills/<name>/SKILL.md` (Copilot discovers this folder), each also a slash command with its name (`/review`, `/data`, ...).
- Helpers: `scout`, `worker`, `tester`, `reviewer` in `.claude/agents/` (Claude agent format, which VS Code reads); run them as subagents by that exact name. Never the built-in execution subagent or an unnamed subagent.
- Models: cheap = Claude Haiku 5.5 (or GPT-6 Luna), medium = Claude Sonnet 5.5, top = Claude Opus 5.5.
- Guards: `.github/hooks/guard.json` runs `_ai/hooks/guard.mjs` before every tool. The profile is `.github/instructions/profile.instructions.md`, written by `node _ai/setup.mjs`.
