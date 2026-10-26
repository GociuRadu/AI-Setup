---
name: permissions
description: "What the agent may run without asking in this setup (home). The only rules file that differs between the home and work setups."
---

# Permissions (home)

Full autonomy, except databases (the [global rules](global.instructions.md) Databases section) and the hard stops.

- Run any local command yourself, without asking: builds, tests, scripts, installs, Docker, Git, public network calls. Shell: PowerShell or Git Bash. `settings.json` runs without prompts and denies the hard stops; the user runs those.
- A request to implement authorizes the edits and commands the task needs. `**Run:**` lists only what you could not run.
- Git: status, diff, branch, commit, pull and push of feature branches; push `main` only on explicit request. A project's `project.md` Guardrails may be stricter.
