# AI setup context

Current state and open work, under 40 lines. Decisions: [memory.md](memory.md) (replaced ones in [memory-archive.md](memory-archive.md)); full decision set and build plan: [plan.md](plan.md).

## Current state

- Updated: 2026-11-26. `main` = `review-fixes` = `6f3a3c7` on GitHub; CI (Windows `node --test` + gitleaks) green on `24bca62`, later pushes not checked.
- `node --test`: 44 tests pass (2026-11-26). `node install.mjs` twice: "nothing to change".
- Home laptop: installed for Claude Code, Copilot and Kiro; the old setup is gone (backup in `work/.ai/backup/old-setup-2026-11-26/`).
- Today's review and fixes: [report](reports/2026-11-26-review-ai-setup.html); every fix with its reason is in memory.md (guard bypasses, Kiro asks are blocks, Copilot hook writes `hookSpecificOutput`, Kiro YAML and backups, CI 8.3 temp path, Copilot models as `"Claude Haiku 5.5 (copilot)"`).
- A `reviewer` graded the setup 7.5/10 before the last improvements (weakest: per-tool integration 7, MCP and tools 6.5, docs 7).
- Helpers: rules send commands and Git history to `tester` (Haiku) and searches to `researcher` (Sonnet); built-in agents in Claude Code default to Sonnet (`CLAUDE_CODE_SUBAGENT_MODEL`); forks run on the main model, so last resort.

## Open work

| Item | Status | Next action |
|---|---|---|
| Skill and helper evaluation | next (user, 2026-11-26) | per skill and helper, run a few real tasks with and without it and compare result, tokens and time; keep, trim or drop it; changes go into the repo (setup level), not local copies |
| Duplicate and bloat review | after the evaluation | a fresh `reviewer` (Sonnet) audits the whole repo for duplicated or useless text across rules, skills, agents, README and docs; fix in the repo, add a test where a duplicate could come back |
| Smoke prompts (step 10) | Claude Code 4/4 pass; Kiro pass; Copilot: rules and skills pass, `tester` model and the guard ask not yet confirmed (this laptop has no Copilot account) | rerun [smoke.md](smoke.md) in Copilot on the work laptop |
| Work laptop (step 11) | not started | clone into `work/`, `node AI-Setup/install.mjs --vault <path>`, Copilot smoke prompt, check Claude 5.5 in the Copilot and Kiro model pickers |
| Missing CLIs | open | install `gh`, `gitleaks`, `playwright-cli` on both laptops |
| Remaining checks (plan 5) | open | Copilot writes to the vault, Copilot skill discovery with `.claude/skills` off, Obsidian Sync of edits made while closed |
| Vault notes | open | `Agentic AI Design Patterns` (too long, footnotes) and `Git` (footnotes) fail `vault.mjs check`; `My AI Coding Setup` rewritten and clean |
