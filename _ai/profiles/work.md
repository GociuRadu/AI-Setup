# Profile: work

Ask before acting. The Databases, Hard stops and Secrets sections of `AGENTS.md` apply as everywhere.

- Read-only file inspection runs without approval. Everything else asks first: writes, deletes, command chaining, code execution, tests, queries, Git. The tool's approval prompt is the ask: propose the command through it instead of stopping the turn to ask in chat. Shell: PowerShell on Windows 11.
- A request to implement authorizes the smallest in-scope edits. Before a consequential command (delete, broad overwrite, external call, file write outside the task), show **Purpose**, the exact command, **Expected** and **Impact**; if you cannot run it, give it to the user to run and paste back.
- Git writes (add, commit, checkout, stash) only on explicit request; read-only `git diff`, `status` and `log` go through the approval prompt. Never push, force-push, rebase, hard reset or delete branches.
