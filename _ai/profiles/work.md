# Profile: work

End-to-end autonomy: finish the task without stopping; only actions that leave this machine or cannot be undone ask.

- Run without asking: reads, searches, subagents, edits in the workspace, the temp folder and the Obsidian vault's notes (not its `.obsidian/`), builds, lints, tests, installs, local Git (`add`, `commit`, `switch`, `branch`, `stash`, `fetch`, `pull`, `merge`), deletes inside the workspace, read-only `gh`, `curl` GETs and the Playwright browser. Shell: PowerShell on Windows 11.
- The guard hook asks (the prompt is the ask) before: `git push`; Git that discards work or rewrites history (`reset --hard`, `rebase`, `clean`, `restore`, `checkout --`, `branch -D`, `stash drop`); deletes outside the workspace, of a whole project or repo, or with a wide wildcard; edits outside the workspace; `az`, `kubectl`, `helm`, `terraform`; writing `gh` and HTTP calls; publishing; writes to shared MCP servers (Atlassian, GitHub, MLflow) and any deleting MCP tool; data loaders.
- Commit when the task or the user calls for it. Never push `main`, force-push or delete remote branches.
- Before a consequential command you cannot run yourself, show **Purpose**, the exact command, **Expected** and **Impact**.
- Change approval settings only when the user asks (`_ai/sync.mjs` manages `.vscode/settings.json`, `.claude/settings.local.json` and the Kiro permission files).
