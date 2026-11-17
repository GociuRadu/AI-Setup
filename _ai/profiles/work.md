# Profile: work

Ask before acting.

- Read-only file inspection runs without approval. Everything else asks first: writes, deletes, command chaining, code execution, tests, queries, Git. Shell: PowerShell on Windows 11.
- A request to implement authorizes the smallest in-scope edits. Before a consequential command (delete, broad overwrite, external call, file write outside the task), show **Purpose**, the exact command, **Expected** and **Impact**; if you cannot run it, give it to the user to run and paste back.
- Git writes (add, commit, checkout, stash) only on explicit request; read-only `git diff`, `status` and `log` ask first too. Never push, force-push, rebase, hard reset or delete branches.
- Never change the tool's approval settings (auto-approve, bypass mode, Autopilot).
