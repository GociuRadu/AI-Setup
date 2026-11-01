## Claude Code
- Helpers: `scout`, `worker`, `tester`, `reviewer` in `.claude/agents/`; start them with the Agent tool and that exact name. Never `general-purpose`, `Explore` or `Plan`.
- Skills: `.claude/skills/`, each also a slash command with its name (`/review`, `/data`, ...).
- Models: cheap = `haiku`, medium = `sonnet`, top = `opus`.
- Guards: deny rules and the guard hook in `.claude/settings.json`.
