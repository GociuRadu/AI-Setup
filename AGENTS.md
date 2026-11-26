# Working on this repo

This repo is the source of the AI setup; `node install.mjs` copies it into the work folder. These rules are for changing the repo itself; the always-on rules for every session are in `rules/always.md`.

- Edit the sources here (`rules/`, `skills/`, `agents/`, `hooks/`, `mcp/`, `templates/`, `setup.json`, `install.mjs`), never the generated copies in `work/`.
- A new component gets its folder or file and an entry in `setup.json` (the tests fail otherwise). A skill folder's `SKILL.md` has `name` = folder name and a `description` that says what it does and when to use it, under 500 lines.
- Something that must never happen goes into `hooks/guard.mjs` with a test; keep each check a regex on the call before any file-system call, because Copilot runs a call when the hook times out.
- After a change: `node --test`, then `node install.mjs` from this folder, and start a new chat in each tool. Leave the commit to the user.