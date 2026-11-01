---
inclusion: always
---
# Kiro

The core rules are in `AGENTS.md`, which Kiro loads on its own; if it is not in your context, read it now. This file only maps names.

- Skills: `.kiro/skills/<name>/SKILL.md` are wrappers that load `.claude/skills/<name>/SKILL.md`; links inside a skill resolve from its `.claude/skills/<name>/` folder. A user-level `confluence` skill, if installed, is personal; project pages use `confluence-project`.
- Helpers: `scout`, `worker`, `tester`, `reviewer` are custom agents in `.kiro/agents/` (their prompt is `.claude/agents/<name>.md`); start them with the subagent tool and that exact name. "Never a built-in subagent" includes `context-gatherer` and `general-task-execution`.
- Models: cheap = `claude-haiku-5.5`, medium = `claude-sonnet-5.5`, top = `claude-opus-5.5`.
- Tool names: Read = `read_file`/`read_code`, Grep = `grep_search`, Glob = `file_search`/`list_directory`, Edit = `str_replace`, Write = `fs_write`, shell = `execute_pwsh`/`execute_bash`, web = `remote_web_search`/`web_fetch`.
- Guards: `.kiro/hooks/guard.json` runs `_ai/hooks/guard.mjs` before shell, read and write tools. The profile is `.kiro/steering/profile.md`, written by `node _ai/setup.mjs`.
