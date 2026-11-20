---
name: clean
description: "Use when the user asks to clean junk, clear caches, delete old debug-logs, transcripts, chat sessions, editor logs, .tmp scratch files or unreferenced setup reports."
argument-hint: "[--days 7] [--reports]"
---
# Clean

1. Run `node _ai/clean.mjs` (plus `--days <N>` or `--reports` when asked) to show the dry-run inventory by category and MB.
2. Run `node _ai/clean.mjs --apply` with the same flags; the guard hook asks the user once to confirm the deletion.
3. Never delete `<project>/docs/ai/` plans or reports automatically: list any done or unreferenced project files and ask before touching them.
