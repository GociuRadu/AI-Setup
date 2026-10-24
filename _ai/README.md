# AI core (`.claude` + `_ai`)

Claude Code setup for the `projects` workspace. User guide: [HOW-TO-USE.md](../HOW-TO-USE.md).

## Layout

| Path | Purpose |
|---|---|
| `CLAUDE.md` (root) | Core entrypoint; imports the global rules |
| `.claude/instructions/` | `global`, `python`, `sql` rules (edit only here) |
| `.claude/rules/python.md`, `sql.md` | Path-scoped loaders for the language rules |
| `.claude/settings.json` | Permissions |
| `.claude/agents/` | Subagents `scout`, `worker`, `tester`, `reviewer` |
| `.claude/skills/` | `analyze`, `review`, `bug`, `data`, `confluence`, `ponytail`, `lead` |
| `_ai/templates/project/` | Skeleton for a new project |
| `_ai/SOURCES.md` | External origins and licenses |
| `work/` | Copy of the Copilot work setup (strict permissions), refreshed from the Obsidian vault `Me/Code/Setup/work`; `dot-*` names restored to `.*`; `personal/` excluded |

Project module: `<project>/CLAUDE.md` (what to read), `docs/ai/` (`project.md`, `context.md`, `memory.md`, `reports/`), `code/` (Git checkout).

## Maintenance

- Add a skill: `.claude/skills/<name>/SKILL.md`. Record external sources in `SOURCES.md`.
- Change a model: `model:` in the agent frontmatter; `lead` follows the session model (`/model`).
- After any change: start a new Claude Code session in `projects`, then commit and push. The setup is versioned in `GociuRadu/AI-Setup` (`projects` is the repo root; the whitelist `.gitignore` keeps project folders and `personal/` out).
