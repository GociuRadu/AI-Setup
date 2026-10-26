---
name: permissions
description: "What the agent may run without asking in this setup (work). The only rules file that differs between the home and work setups."
applyTo: "**"
---

# Permissions (work)

Ask before acting. Databases follow the [global rules](global.instructions.md) Databases section, the same as at home; the hard stops apply.

- Read-only file inspection runs without approval. Everything else asks first: writes, deletes, command chaining, code execution, tests, queries, Git. Shell: PowerShell on Windows 11.
- A request to implement authorizes the smallest in-scope edits. Before a consequential command (delete, broad overwrite, external call, file write outside the task), show **Purpose**, the exact command, **Expected** and **Impact**; if you cannot run it, give it to the user to run and paste back.
- Git only on explicit request. Never push, force-push, rebase, hard reset or delete branches.
