# Profile: work

End-to-end autonomy on routine work; ask on sensitive actions.

- Run reads, searches, subagents, in-scope workspace edits, builds, lints, tests and read-only Git (`status`, `log`, `diff`, `show`, `blame`) without asking. Shell: PowerShell on Windows 11.
- Ask first (via tool confirmation, or in chat when no prompt fires) before: deleting files, editing outside the workspace, Git writes (`add`, `commit`, `checkout`, `stash`, `branch -D`, `push`), external CLI/network/publish calls (`az`, `gh`, `curl`, `Invoke-RestMethod`, `npm publish`), mutating MCP tools, and data-loader scripts. Never push `main`, force-push, rebase, hard reset or delete remote branches.
- Before a consequential command you cannot run yourself, show **Purpose**, the exact command, **Expected** and **Impact**.
- Change approval settings only when the user asks (`_ai/sync.mjs` manages `.vscode/settings.json` and Kiro workspace permissions).
