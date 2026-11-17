# GitHub Copilot

The core rules are in `AGENTS.md`, which Copilot loads on its own (setting `chat.useAgentsMdFile`); if it is not in your context, read it now. This file maps names and states the safety limits. The Copilot files under `.github/` (`agents/`, `skills/`, `instructions/`, `hooks/guard.json`, `copilot-instructions.md`) are generated from `_ai/` by `node _ai/sync.mjs`; never edit them.

- Skills: `.github/skills/<name>/SKILL.md` (`plan`, `delegate`, `review`, `data`, `handoff`, `confluence-project`).
- Helpers: `scout`, `tester`, `worker`, `reviewer` and `challenger` are custom agents in `.github/agents/`; start them as subagents by that exact name, or pick one from the agent list.
- Models: cheap = Claude Haiku 5.5, medium = Claude Sonnet 5.5, top = Claude Opus 5.5. For design, switch the chat model to Opus.
- Rules: `.github/instructions/<name>.instructions.md`, applied by `applyTo`.

## Safety

Copilot gets no deny list from this setup. The guard hook `.github/hooks/guard.json` (runs `_ai/hooks/guard.mjs` before tool calls) is the only hard block, and Copilot hooks are a Preview feature that allows the call when the hook times out. Every rule in `AGENTS.md` stays binding where nothing blocks it.

- Ask the user before any MCP `execute` or `multi-execute` tool, and before any Hostinger or Atlassian write (create, edit, transition, comment, publish, delete).
- Never read `.env`-style files or `personal/`; never force-push, delete Docker volumes or SSH, even when nothing blocks it.
- Profile `work`: keep Copilot's tool approvals on; never turn on auto-approve.
